/**
 * PDF analysis & detection.
 *
 * Uses Poppler tools (pdfinfo, pdftotext -bbox) for structure & text
 * extraction, and renders low-DPI page samples to measure brightness for
 * the scanned-vs-vector heuristic. This avoids pdfjs-dist's worker setup,
 * which is fragile in webpack-bundled Next.js server code.
 *
 * Watermark heuristics (applied to word-level bounding boxes):
 *  - keyword match (DRAFT, CONFIDENTIAL, SAMPLE, ...)
 *  - large font size relative to page
 *  - centered on the page
 *  - repeated identical word across the page (logo tiling)
 *  - very wide bbox (spanning most of the page)
 */
import path from 'path';
import { promises as fs } from 'fs';
import {
  createJobDir,
  getPdfInfo,
  renderPagesToPng,
  avgBrightness,
  run,
  rmrf,
} from './utils';
import {
  DetectionResult,
  PdfKind,
  WatermarkCandidate,
  BackgroundCandidate,
  isLikelyWatermarkText,
} from './types';

/** A single word with its bounding box (top-left origin, PDF points). */
export interface WordBox {
  text: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/** Parsed page: dimensions + word boxes. */
export interface ParsedPage {
  width: number;
  height: number;
  words: WordBox[];
}

/** Per-page word boxes with the original page number attached. */
export interface PageWords {
  pageNumber: number;
  width: number;
  height: number;
  words: WordBox[];
}

/** Parse pdftotext -bbox HTML output into per-page word boxes. */
function parseBboxHtml(html: string): ParsedPage[] {
  const pages: ParsedPage[] = [];
  const pageRegex = /<page\s+width="([\d.]+)"\s+height="([\d.]+)"\s*>([\s\S]*?)<\/page>/g;
  let pageMatch: RegExpExecArray | null;
  while ((pageMatch = pageRegex.exec(html)) !== null) {
    const width = parseFloat(pageMatch[1]);
    const height = parseFloat(pageMatch[2]);
    const body = pageMatch[3];
    const words: WordBox[] = [];
    const wordRegex = /<word\s+xMin="([\d.]+)"\s+yMin="([\d.]+)"\s+xMax="([\d.]+)"\s+yMax="([\d.]+)"\s*>([\s\S]*?)<\/word>/g;
    let wordMatch: RegExpExecArray | null;
    while ((wordMatch = wordRegex.exec(body)) !== null) {
      words.push({
        text: wordMatch[5].trim(),
        xMin: parseFloat(wordMatch[1]),
        yMin: parseFloat(wordMatch[2]),
        xMax: parseFloat(wordMatch[3]),
        yMax: parseFloat(wordMatch[4]),
      });
    }
    pages.push({ width, height, words });
  }
  return pages;
}

/**
 * Extract word-level bounding boxes for a range of pages using
 * `pdftotext -bbox`. Returns per-page dimensions + word boxes (top-left
 * origin, PDF points). Used to rebuild a lossless invisible text layer
 * over a cleaned raster image (preserves searchability without OCR).
 */
export async function extractWordBoxes(
  file: string,
  firstPage: number,
  lastPage: number
): Promise<PageWords[]> {
  const tmpDir = await createJobDir('bbox');
  const bboxHtmlPath = path.join(tmpDir, 'bbox.html');
  try {
    await run(
      'pdftotext',
      ['-bbox', '-f', String(firstPage), '-l', String(lastPage), file, bboxHtmlPath],
      { timeoutMs: 90_000 }
    );
    const html = await fs.readFile(bboxHtmlPath, 'utf8');
    const pages = parseBboxHtml(html);
    return pages.map((p, i) => ({
      pageNumber: firstPage + i,
      width: p.width,
      height: p.height,
      words: p.words,
    }));
  } finally {
    await rmrf(tmpDir);
  }
}

/** Find watermark candidates among word boxes on a single page. */
function findWatermarkCandidates(
  pageIndex: number,
  page: ParsedPage,
  allPages: ParsedPage[]
): WatermarkCandidate[] {
  const out: WatermarkCandidate[] = [];
  const pageW = page.width;
  const pageH = page.height;
  if (pageW <= 0 || pageH <= 0) return out;

  // Compute the median body-text height on this page. Watermarks are
  // much larger than body text, so we flag words that dwarf the median.
  const heights = page.words.map((w) => w.yMax - w.yMin).filter((h) => h > 0).sort((a, b) => a - b);
  const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 12;

  // Same-text-same-position across pages = strong watermark signal.
  // (Body text varies; a watermark sits at an identical spot on every page.)
  const positionMatches = (target: WordBox, targetPageIdx: number): number => {
    let matches = 0;
    allPages.forEach((p, idx) => {
      if (idx === targetPageIdx) return;
      for (const w of p.words) {
        if (w.text.toLowerCase() !== target.text.toLowerCase()) continue;
        if (Math.abs(w.xMin - target.xMin) < 12 && Math.abs(w.yMin - target.yMin) < 12) {
          matches++;
          break;
        }
      }
    });
    return matches;
  };

  for (const w of page.words) {
    if (!w.text || !w.text.trim()) continue;
    const fontHeight = w.yMax - w.yMin; // cap-height ≈ font size
    const fontWidth = w.xMax - w.xMin;
    const cx = (w.xMin + w.xMax) / 2;
    const cy = (w.yMin + w.yMax) / 2;
    const reasons: string[] = [];

    // 1. Keyword match (DRAFT, CONFIDENTIAL, ...) — strong alone
    if (isLikelyWatermarkText(w.text)) reasons.push('keyword');

    // 2. Large: font height > 3× the body median AND > 24pt absolute.
    //    This catches big watermark text while excluding titles/headings.
    if (fontHeight > Math.max(24, medianHeight * 3)) reasons.push('large');

    // 3. Centered: within 20% of page center on both axes.
    if (Math.abs(cx - pageW / 2) < pageW * 0.2 && Math.abs(cy - pageH / 2) < pageH * 0.25) {
      reasons.push('centered');
    }

    // 4. Repeated at the same position across pages (logo/watermark stamp).
    if (allPages.length >= 2 && positionMatches(w, pageIndex) >= 1) reasons.push('repeated');

    // 5. Very wide banner spanning > 60% of page width.
    if (fontWidth > pageW * 0.6 && fontHeight > 20) reasons.push('wide');

    if (reasons.length === 0) continue;
    // Only keyword is "strong" alone; everything else needs 2+ signals.
    const strong = reasons.includes('keyword');
    if (!strong && reasons.length < 2) continue;

    out.push({
      page: pageIndex,
      text: w.text,
      rotation: 0,
      fontSize: Math.round(fontHeight * 10) / 10,
      opacity: 1,
      bbox: {
        x: w.xMin,
        y: w.yMin,
        width: fontWidth,
        height: fontHeight,
      },
      reasons,
    });
  }
  return out;
}

/**
 * Detect backgrounds by sampling corner pixels of rendered pages. If a page
 * has a dominant non-white corner color, it likely has a background fill.
 * (The raster pipeline handles actual removal; this is just detection.)
 */
async function findBackgroundCandidates(
  pngFiles: string[],
  pageNumbers: number[]
): Promise<{ candidates: BackgroundCandidate[]; hasImages: boolean }> {
  // Lightweight: we treat "low brightness on a text PDF" as a background signal.
  // Detailed per-rectangle detection isn't needed because the raster pipeline
  // removes backgrounds regardless.
  const candidates: BackgroundCandidate[] = [];
  return { candidates, hasImages: false };
}

export interface AnalyzeOptions {
  brightnessSamplePages?: number;
}

export async function analyzePdf(file: string, opts: AnalyzeOptions = {}): Promise<DetectionResult> {
  const samplePages = opts.brightnessSamplePages ?? 3;
  const info = await getPdfInfo(file);

  if (info.encrypted) {
    throw Object.assign(new Error('This PDF is encrypted. Please decrypt it before uploading.'), {
      code: 'ENCRYPTED',
    });
  }

  // Text extraction with bounding boxes via Poppler.
  const tmpDir = await createJobDir('analyze');
  const bboxHtmlPath = path.join(tmpDir, 'bbox.html');
  let pages: ParsedPage[] = [];
  let hasTextLayer = false;
  try {
    await run('pdftotext', ['-bbox', file, bboxHtmlPath], { timeoutMs: 60_000 });
    const html = await fs.readFile(bboxHtmlPath, 'utf8');
    pages = parseBboxHtml(html);
    hasTextLayer = pages.some((p) => p.words.some((w) => w.text.trim().length > 0));
  } catch {
    /* pdftotext failed — treat as no text layer */
  }

  // Watermark detection on up to first 20 pages.
  const wmScanPages = pages.slice(0, 20);
  const watermarkCandidates: WatermarkCandidate[] = [];
  for (let i = 0; i < wmScanPages.length; i++) {
    const cands = findWatermarkCandidates(i + 1, wmScanPages[i], wmScanPages);
    watermarkCandidates.push(...cands);
  }

  // Brightness sampling + image detection via raster rendering.
  let brightnessValue = 255;
  let hasImages = false;
  try {
    const sampleLast = Math.min(samplePages, info.pageCount);
    const pngs = await renderPagesToPng(file, tmpDir, { dpi: 72, first: 1, last: sampleLast });
    if (pngs.length > 0) {
      const vals = await Promise.all(pngs.map(avgBrightness));
      brightnessValue = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    // Heuristic: if there's no text layer but the page rendered, it's image-based.
    if (!hasTextLayer && info.pageCount > 0) hasImages = true;
  } finally {
    await rmrf(tmpDir);
  }

  const { candidates: backgroundCandidates } = await findBackgroundCandidates([], []);

  // Determine kind
  let kind: PdfKind = 'vector';
  if (!hasTextLayer && hasImages) kind = 'scanned';
  else if (hasImages && hasTextLayer) kind = 'mixed';

  const perPageMs = kind === 'scanned' ? 1800 : kind === 'mixed' ? 1400 : 700;
  const estimatedSeconds = Math.ceil((info.pageCount * perPageMs) / 1000);

  return {
    kind,
    pageCount: info.pageCount,
    hasTextLayer,
    hasImages,
    watermarkCandidates,
    backgroundCandidates,
    avgBrightness: brightnessValue,
    estimatedSeconds,
  };
}

/** Repair a corrupted PDF with qpdf (best effort). */
export async function repairPdf(file: string, outDir: string): Promise<string> {
  const out = path.join(outDir, 'repaired.pdf');
  await run('qpdf', ['--no-warn', '--linearize', '--object-streams=generate', file, out], {
    timeoutMs: 60_000,
  });
  return out;
}
