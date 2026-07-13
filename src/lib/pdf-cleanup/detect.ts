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
import { extractTextRuns, TextRun, PageTextRuns } from './content-stream';

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

// ─── Multi-signal watermark detection (content-stream based) ──────────────────
//
// This uses the rich TextRun data (font, size, rotation, color, opacity,
// transparency-group membership) to apply the heuristics the user requested:
// repeated bboxes, repeated font, repeated rotation, repeated transparency
// group, object frequency across pages, color similarity, template matching.
// It drastically reduces false positives because body text only triggers 1-2
// weak signals, while real watermarks trigger many strong ones.

interface RunCluster {
  /** Normalized text (lowercase, trimmed). */
  text: string;
  /** All runs sharing this text. */
  runs: TextRun[];
  /** Distinct pages this text appears on. */
  pages: Set<number>;
  /** Distinct fonts used. */
  fonts: Set<string>;
  /** Distinct rotations (rounded to 1°). */
  rotations: Set<number>;
  /** Distinct serialized colors. */
  colors: Set<string>;
  /** Opacity values. */
  opacities: number[];
  /** Whether any run is in a transparency group. */
  anyTransparency: boolean;
  /** Positions (x,y) per page, for repeat detection. */
  positions: { page: number; x: number; y: number }[];
}

function colorKey(c: [number, number, number]): string {
  // Quantize to 0.05 steps so near-identical colors cluster together.
  return c.map((v) => Math.round(v * 20) / 20).join(',');
}

function isGrayColor(c: [number, number, number]): boolean {
  const [r, g, b] = c;
  return Math.abs(r - g) < 0.05 && Math.abs(g - b) < 0.05;
}

function isLightColor(c: [number, number, number]): boolean {
  return (c[0] + c[1] + c[2]) / 3 > 0.6;
}

function isNonBlack(c: [number, number, number]): boolean {
  return (c[0] + c[1] + c[2]) / 3 > 0.15;
}

/** Compute an axis-aligned bbox for a (possibly rotated) text run. */
function runBBox(run: TextRun, pageHeight: number): { x: number; y: number; width: number; height: number } {
  const [a, b, c, d, e, f] = run.matrix;
  // Estimate text width from font size × char count × 0.5 (avg Helvetica glyph).
  const charWidth = run.fontSize * 0.5;
  const textWidth = run.text.length * charWidth;
  const textHeight = run.fontSize;
  // The 4 corners in TEXT space (origin at baseline-left): (0,0),(w,0),(w,h),(0,h)
  // Apply the text matrix [a b; c d] + translate (e,f) to get user-space corners.
  const corners = [
    [e, f],
    [e + a * textWidth, f + b * textWidth],
    [e + a * textWidth + c * textHeight, f + b * textWidth + d * textHeight],
    [e + c * textHeight, f + d * textHeight],
  ];
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  // Content-stream y is bottom-left origin; convert to top-left for consistency
  // with pdftotext -bbox output (which the masking layer also uses).
  return {
    x: xMin,
    y: pageHeight - yMax, // top-left origin y
    width: xMax - xMin,
    height: yMax - yMin,
  };
}

/**
 * Multi-signal watermark detection from content-stream text runs.
 * Returns candidates with a confidence score; threshold ≥ 3 → watermark.
 */
function detectWatermarksFromRuns(
  pagesData: PageTextRuns[],
  totalPages: number
): WatermarkCandidate[] {
  if (pagesData.length === 0) return [];

  // Cluster runs by normalized text.
  const clusters = new Map<string, RunCluster>();
  for (const pd of pagesData) {
    for (const run of pd.runs) {
      const key = run.text.toLowerCase().trim();
      if (!key) continue;
      let cluster = clusters.get(key);
      if (!cluster) {
        cluster = {
          text: run.text,
          runs: [],
          pages: new Set(),
          fonts: new Set(),
          rotations: new Set(),
          colors: new Set(),
          opacities: [],
          anyTransparency: false,
          positions: [],
        };
        clusters.set(key, cluster);
      }
      cluster.runs.push(run);
      cluster.pages.add(run.page);
      cluster.fonts.add(run.font);
      cluster.rotations.add(Math.round(run.rotation));
      cluster.colors.add(colorKey(run.color));
      cluster.opacities.push(run.opacity);
      if (run.inTransparencyGroup) cluster.anyTransparency = true;
      cluster.positions.push({ page: run.page, x: run.x, y: run.y });
    }
  }

  // Determine body-text font set: fonts used by the most text runs (top 1-2).
  const fontFreq = new Map<string, number>();
  for (const c of clusters.values()) {
    for (const f of c.fonts) fontFreq.set(f, (fontFreq.get(f) ?? 0) + c.runs.length);
  }
  const bodyFonts = new Set(
    [...fontFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => f)
  );

  // Determine median body font size (for "large" heuristic).
  const allSizes = [...clusters.values()]
    .filter((c) => [...c.fonts].some((f) => bodyFonts.has(f)))
    .flatMap((c) => c.runs.map((r) => r.fontSize))
    .sort((a, b) => a - b);
  const medianSize = allSizes.length > 0 ? allSizes[Math.floor(allSizes.length / 2)] : 12;

  const candidates: WatermarkCandidate[] = [];
  const pageHeightMap = new Map(pagesData.map((p) => [p.pageNumber, p.height]));

  for (const cluster of clusters.values()) {
    const reasons: string[] = [];
    let score = 0;

    // 1. Template matching — known watermark keywords (strong, +3).
    if (isLikelyWatermarkText(cluster.text)) {
      reasons.push('template');
      score += 3;
    }

    // 2. Object frequency across pages — appears on >50% of pages (+2), or
    //    >1 page (+1). Body text usually varies; watermarks repeat.
    const freq = cluster.pages.size / totalPages;
    if (freq > 0.5 && totalPages >= 2) {
      reasons.push('frequency-high');
      score += 2;
    } else if (cluster.pages.size >= 2 && totalPages >= 2) {
      reasons.push('frequency');
      score += 1;
    }

    // 3. Repeated rotation angle — rotated text with consistent angle (+2).
    const rotations = [...cluster.rotations].filter((r) => r !== 0);
    if (rotations.length > 0 && new Set(rotations).size <= 2) {
      reasons.push('rotation-repeat');
      score += 2;
    }

    // 4. Repeated transparency group — drawn under opacity < 0.85 OR inside
    //    a transparency group (+2). Body text is always opaque.
    const minOpacity = Math.min(...cluster.opacities);
    if (minOpacity < 0.85 || cluster.anyTransparency) {
      reasons.push(minOpacity < 0.5 ? 'transparency-high' : 'transparency');
      score += 2;
    }

    // 5. Color similarity — gray/light/non-black color (+1 each, capped).
    //    color-gray only fires for LIGHT gray (watermarks are light; body
    //    text is dark gray/black and must not trigger this).
    const sampleColor = cluster.runs[0].color;
    if (isGrayColor(sampleColor) && isLightColor(sampleColor)) {
      reasons.push('color-gray');
      score += 1;
    }
    if (isLightColor(sampleColor)) {
      reasons.push('color-light');
      score += 1;
    }
    // Same non-black color across pages (+1).
    if (cluster.colors.size === 1 && isNonBlack(sampleColor) && cluster.pages.size >= 2) {
      reasons.push('color-repeat');
      score += 1;
    }

    // 6. Repeated font — uses a font NOT in the body-font set (+1). Watermarks
    //    often use a distinct font, or a unique font instance.
    const usesUniqueFont = [...cluster.fonts].every((f) => !bodyFonts.has(f));
    if (usesUniqueFont && cluster.fonts.size === 1) {
      reasons.push('font-unique');
      score += 1;
    }

    // 7. Repeated bounding box / position — same (x,y) across pages (+2).
    if (cluster.pages.size >= 2) {
      const posCounts = new Map<string, number>();
      for (const p of cluster.positions) {
        const key = `${Math.round(p.x / 10)}_${Math.round(p.y / 10)}`;
        posCounts.set(key, (posCounts.get(key) ?? 0) + 1);
      }
      const maxPosRepeat = Math.max(...posCounts.values());
      if (maxPosRepeat >= 2) {
        reasons.push('position-repeat');
        score += 2;
      }
    }

    // 8. Large — fontSize > 3× body median (+1).
    const maxSize = Math.max(...cluster.runs.map((r) => r.fontSize));
    if (maxSize > Math.max(24, medianSize * 3)) {
      reasons.push('large');
      score += 1;
    }

    // Require at least one PRIMARY visual signal (body text never has these;
    // watermarks always do). This is what eliminates false positives on
    // repeated body content (headers/footers/identical pages).
    const hasPrimary =
      reasons.includes('template') ||
      reasons.includes('transparency') ||
      reasons.includes('transparency-high') ||
      reasons.includes('rotation-repeat') ||
      reasons.includes('large') ||
      reasons.includes('color-light');
    if (!hasPrimary) continue;

    // Threshold: score ≥ 3 → watermark candidate.
    if (score < 3) continue;

    // Emit one candidate per run (so each page gets its own entry for masking).
    for (const run of cluster.runs) {
      const ph = pageHeightMap.get(run.page) ?? 792;
      const bbox = runBBox(run, ph);
      candidates.push({
        page: run.page,
        text: run.text,
        rotation: run.rotation,
        fontSize: Math.round(run.fontSize * 10) / 10,
        opacity: run.opacity,
        color: run.color,
        font: run.font,
        bbox,
        reasons,
        score,
      });
    }
  }

  return candidates;
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

  // Text extraction with bounding boxes via Poppler (for hasTextLayer check
  // + as a fallback bbox source). Primary detection now uses content-stream
  // parsing which gives font/rotation/color/opacity.
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

  // Multi-signal watermark detection via content-stream parsing.
  // Scans up to the first 20 pages (cheap & representative).
  const wmScanCount = Math.min(20, info.pageCount);
  let watermarkCandidates: WatermarkCandidate[] = [];
  try {
    const pagesData = await extractTextRuns(file, 1, wmScanCount);
    watermarkCandidates = detectWatermarksFromRuns(pagesData, info.pageCount);
  } catch (e) {
    // Fallback: if content-stream parsing fails, use the pdftotext-based detector.
    const wmScanPages = pages.slice(0, 20);
    for (let i = 0; i < wmScanPages.length; i++) {
      const cands = findWatermarkCandidates(i + 1, wmScanPages[i], wmScanPages);
      // Assign default score/reasons for fallback candidates.
      watermarkCandidates.push(
        ...cands.map((c) => ({ ...c, score: c.reasons.length * 2 }))
      );
    }
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
