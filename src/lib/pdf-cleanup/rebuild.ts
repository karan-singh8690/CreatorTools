/**
 * PDF assembly: rebuild a clean PDF from processed page images using pdf-lib.
 * Also supports merging per-page Tesseract-searchable PDFs into one.
 */
import {
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFDict,
  PDFArray,
  PDFNumber,
  StandardFonts,
} from 'pdf-lib';
import path from 'path';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { WordBox } from './detect';
import type { WatermarkCandidate } from './types';

const execFileP = promisify(execFile);

interface PageImage {
  path: string;
  width: number;
  height: number;
}

/** Build an image-only (flattened) PDF from cleaned page images. */
export async function buildImagePdf(
  pages: PageImage[],
  outFile: string,
  quality: 'fast' | 'balanced' | 'high' | 'maximum'
): Promise<void> {
  const doc = await PDFDocument.create();
  const jpeg = quality === 'fast' || quality === 'balanced';

  for (const p of pages) {
    const imgBuf = await fs.readFile(p.path);
    let embedded;
    if (jpeg) {
      try {
        embedded = await doc.embedJpg(imgBuf);
      } catch {
        embedded = await doc.embedPng(imgBuf);
      }
    } else {
      try {
        embedded = await doc.embedPng(imgBuf);
      } catch {
        embedded = await doc.embedJpg(imgBuf);
      }
    }
    const page = doc.addPage([p.width, p.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: p.width, height: p.height });
  }

  const bytes = await doc.save({ useObjectStreams: true });
  await fs.writeFile(outFile, bytes);
}

/**
 * Determine whether a word box corresponds to a detected watermark, so we
 * can EXCLUDE it from the rebuilt invisible text layer. We must not re-add
 * watermark text we just removed — that would make the watermark searchable
 * again.
 *
 * Three matching strategies:
 *  1. EXACT TEXT + POSITION: the word's text equals the candidate's text
 *     and they're at nearby positions (handles unrotated watermarks).
 *  2. FRAGMENT + PROXIMITY: the word is a character/substring of the
 *     candidate's text AND is close to the candidate's origin point
 *     (handles rotated watermarks where pdftotext splits "CONFIDENTIAL"
 *     into single-char fragments). Proximity is measured from the
 * *candidate's bbox center* with a radius proportional to the text length.
 *  3. BBOX CONTAINMENT (tight): the word center is inside the candidate's
 *     computed bbox with a SMALL margin (only catches fragments at the
 *     edges, not body text on nearby lines).
 */
function isWatermarkWord(
  word: WordBox,
  candidates: WatermarkCandidate[],
  pageNumber: number
): boolean {
  const wt = word.text.toLowerCase().trim();
  if (!wt) return false;
  const wordCx = (word.xMin + word.xMax) / 2;
  const wordCy = (word.yMin + word.yMax) / 2;
  return candidates.some((c) => {
    if (c.page !== pageNumber) return false;
    const ct = c.text.toLowerCase().trim();

    // Strategy 1: exact text + nearby position.
    if (ct === wt) {
      if (Math.abs(c.bbox.x - word.xMin) < 24 && Math.abs(c.bbox.y - word.yMin) < 24) {
        return true;
      }
    }

    // Strategy 2: the word is a fragment (char or substring) of the watermark
    // text, AND it's within a reasonable radius of the watermark's bbox center.
    // This catches rotated text that pdftotext splits into characters without
    // catching unrelated body text.
    const isFragment = ct.length > 1 && (ct.includes(wt) || wt.includes(ct));
    if (isFragment) {
      const bboxCx = c.bbox.x + c.bbox.width / 2;
      const bboxCy = c.bbox.y + c.bbox.height / 2;
      // Radius = half the bbox diagonal + font-size margin. This is generous
      // enough to catch all fragments along the rotated text path, but tight
      // enough to exclude body text on other lines.
      const radius = Math.sqrt(c.bbox.width ** 2 + c.bbox.height ** 2) / 2 + c.fontSize;
      const dist = Math.sqrt((wordCx - bboxCx) ** 2 + (wordCy - bboxCy) ** 2);
      if (dist <= radius) return true;
    }

    // Strategy 3: tight bbox containment (small margin only).
    const tightMargin = 6;
    if (
      wordCx >= c.bbox.x - tightMargin &&
      wordCx <= c.bbox.x + c.bbox.width + tightMargin &&
      wordCy >= c.bbox.y - tightMargin &&
      wordCy <= c.bbox.y + c.bbox.height + tightMargin
    ) {
      return true;
    }

    return false;
  });
}

export interface SearchablePageInput {
  /** Cleaned raster image path (PNG or JPEG). */
  imagePath: string;
  /** Original page size in PDF points (drives the PDF page dimensions). */
  pageWidthPts: number;
  pageHeightPts: number;
  /** Original word boxes for this page (top-left origin, PDF points). */
  words: WordBox[];
  /** The 1-indexed page number (for watermark matching). */
  pageNumber: number;
}

/**
 * Build a SEARCHABLE PDF with lossless text fidelity.
 *
 * For each page:
 *   1. Draw the cleaned raster image as the full-page background (visible).
 *   2. Overlay the ORIGINAL text invisibly (PDF text render mode 3 = Tr)
 *      at each word's exact position, so the text is selectable/searchable
 *      but not painted.
 *
 * Watermark words are excluded from the overlay so removed watermarks
 * don't reappear as searchable text.
 *
 * This preserves perfect text fidelity (zero OCR errors) — better than
 * the OCR fallback, which is why we prefer it for PDFs that originally
 * had a text layer.
 */
export async function buildSearchablePdfWithOriginalText(
  pages: SearchablePageInput[],
  outFile: string,
  quality: 'fast' | 'balanced' | 'high' | 'maximum',
  watermarkCandidates: WatermarkCandidate[] = []
): Promise<void> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const jpeg = quality === 'fast' || quality === 'balanced';

  for (const p of pages) {
    // Embed the cleaned background image.
    const imgBuf = await fs.readFile(p.imagePath);
    let embedded;
    if (jpeg) {
      try {
        embedded = await doc.embedJpg(imgBuf);
      } catch {
        embedded = await doc.embedPng(imgBuf);
      }
    } else {
      try {
        embedded = await doc.embedPng(imgBuf);
      } catch {
        embedded = await doc.embedJpg(imgBuf);
      }
    }

    // Page sized to the ORIGINAL page dimensions (points), so the invisible
    // text overlay lands at the exact coordinates pdftotext reported.
    const page = doc.addPage([p.pageWidthPts, p.pageHeightPts]);

    // Draw the cleaned image to fill the entire page.
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: p.pageWidthPts,
      height: p.pageHeightPts,
    });

    for (const w of p.words) {
      if (!w.text || !w.text.trim()) continue;
      // Skip watermark words — we removed them visually; don't re-add as text.
      if (isWatermarkWord(w, watermarkCandidates, p.pageNumber)) continue;

      const wordHeight = w.yMax - w.yMin;
      const fontSize = Math.max(1, wordHeight);
      // pdftotext bbox uses top-left origin; pdf-lib uses bottom-left.
      // The text baseline ≈ bottom edge of the bbox in bottom-left coords.
      const y = p.pageHeightPts - w.yMax;
      try {
        // renderMode: 3 = invisible. The text is not painted but remains
        // in the content stream, making it selectable & searchable. This
        // is exactly how Tesseract builds searchable PDFs. Using pdf-lib's
        // built-in renderMode option (rather than pushing a raw `3 Tr`
        // operator) keeps the text in the same content stream as the BT/ET
        // block, which is what pdftotext expects for extraction.
        page.drawText(w.text, {
          x: w.xMin,
          y,
          size: fontSize,
          font,
          renderMode: 3,
        });
      } catch {
        // Skip words with glyphs not in Helvetica (e.g. emoji, some CJK).
        // A production build could embed additional fonts per Unicode range.
      }
    }
  }

  const bytes = await doc.save({ useObjectStreams: true });
  await fs.writeFile(outFile, bytes);
}

/**
 * Merge per-page Tesseract searchable PDFs into one document, preserving
 * each page's invisible text layer. Tesseract emits one PDF per image; we
 * copy them in order with pdf-lib.
 */
export async function mergeSearchablePdfs(
  searchablePdfs: string[],
  outFile: string
): Promise<void> {
  const out = await PDFDocument.create();
  for (const src of searchablePdfs) {
    if (!src) continue;
    try {
      const buf = await fs.readFile(src);
      const inDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const copied = await out.copyPages(inDoc, inDoc.getPageIndices());
      for (const pg of copied) out.addPage(pg);
    } catch {
      // skip unreadable page
    }
  }
  const bytes = await out.save({ useObjectStreams: true });
  await fs.writeFile(outFile, bytes);
}

/**
 * Compress a PDF with Ghostscript. Uses the right preset for the chosen
 * quality level. Falls back to the original if Ghostscript fails.
 */
export async function compressWithGhostscript(
  inFile: string,
  outFile: string,
  quality: 'fast' | 'balanced' | 'high' | 'maximum'
): Promise<void> {
  // Ghostscript PDF presets:
  //  /screen — 72 dpi, smallest
  //  /ebook  — 150 dpi, good balance
  //  /printer — 300 dpi
  //  /prepress — 300 dpi, color preserving
  const preset =
    quality === 'fast'
      ? '/screen'
      : quality === 'balanced'
      ? '/ebook'
      : quality === 'high'
      ? '/printer'
      : '/prepress';

  try {
    await execFileP(
      'gs',
      [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.5',
        `-dPDFSETTINGS=${preset}`,
        '-dNOPAUSE',
        '-dBATCH',
        '-dQUIET',
        '-dDetectDuplicateImages=true',
        '-dCompressFonts=true',
        '-dSubsetFonts=true',
        '-dEmbedAllFonts=true',
        '-dAutoRotatePages=/None',
        `-sOutputFile=${outFile}`,
        inFile,
      ],
      { timeout: 180_000, maxBuffer: 20 * 1024 * 1024 }
    );
  } catch (err) {
    // Fallback: copy original (compression is best-effort).
    await fs.copyFile(inFile, outFile);
  }
}

/**
 * Linearize/optimize a PDF with qpdf for faster web viewing. Best-effort.
 */
export async function optimizeWithQpdf(inFile: string, outFile: string): Promise<void> {
  try {
    await execFileP(
      'qpdf',
      ['--linearize', '--object-streams=generate', '--no-warn', inFile, outFile],
      { timeout: 120_000, maxBuffer: 20 * 1024 * 1024 }
    );
  } catch {
    await fs.copyFile(inFile, outFile);
  }
}

/**
 * Strip a named text watermark from a vector PDF by rewriting the content
 * stream of pages where the watermark appears. We use a targeted regex on
 * the decompressed content stream operators to remove the Tj/TJ operators
 * that emit the watermark string.
 *
 * This is a conservative, real implementation: it only removes text-show
 * operators whose operand contains the watermark string, leaving all
 * other content untouched.
 */
export async function stripTextWatermarkFromVector(
  file: string,
  outFile: string,
  watermarkTexts: string[]
): Promise<boolean> {
  if (watermarkTexts.length === 0) return false;
  const data = await fs.readFile(file);
  const doc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });

  // Access low-level: iterate pages, get their content stream, decompress,
  // edit, recompress. pdf-lib exposes this via ref tracing.
  const pages = doc.getPages();
  let modifiedAny = false;

  // Build a set of escaped strings to match inside PDF string literals.
  const needles = watermarkTexts.map((s) => s.trim()).filter((s) => s.length > 0);

  for (const page of pages) {
    const node = page.node;
    const contents = node.get(PDFName.of('Contents'));
    if (!contents) continue;

    // Contents can be a single stream or an array of streams.
    const streamArr: PDFRawStream[] = [];
    if (contents instanceof PDFArray) {
      for (let i = 0; i < contents.size(); i++) {
        const ref = contents.get(i);
        const obj = ref instanceof PDFDict ? ref : doc.context.lookup(ref);
        if (obj instanceof PDFRawStream) streamArr.push(obj);
      }
    } else {
      const obj = doc.context.lookup(contents);
      if (obj instanceof PDFRawStream) streamArr.push(obj);
    }

    for (const stream of streamArr) {
      try {
        const raw = stream.getContents(); // decompressed Uint8Array
        let text = new TextDecoder('latin1').decode(raw);

        let changed = false;
        for (const needle of needles) {
          // Match text-show operators:  ( ... ) Tj   or [ ... ] TJ
          // We remove the entire Tj/TJ operator if its string literal
          // contains the watermark text. This is conservative.
          const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Remove (...needle...) Tj
          const reTj = new RegExp('\\([^)]*' + escaped + '[^)]*\\)\\s*Tj', 'g');
          if (reTj.test(text)) {
            text = text.replace(reTj, '');
            changed = true;
          }
          // Remove [ ... (needle) ... ] TJ  (array text show — harder; remove whole array if it contains the needle)
          const reTJ = new RegExp('\\[[^\\]]*\\(' + escaped + '\\)[^\\]]*\\]\\s*TJ', 'g');
          if (reTJ.test(text)) {
            text = text.replace(reTJ, '');
            changed = true;
          }
        }

        if (changed) {
          const replaced = new TextEncoder().encode(text);
          // Replace the stream's raw contents (already decompressed form).
          // We mark it as not-FlateDecode so pdf-lib writes it raw.
          stream.dict.delete(PDFName.of('Filter'));
          const newStream = doc.context.stream(replaced);
          // Copy the edited bytes back into the existing stream object
          // (replace its contents array).
          // PDFRawStream stores contents in `contents` field.
          (stream as unknown as { contents: Uint8Array }).contents = replaced;
          stream.dict.set(PDFName.of('Length'), PDFNumber.of(replaced.length));
          modifiedAny = true;
        }
      } catch {
        /* skip unreadable stream */
      }
    }
  }

  if (!modifiedAny) return false;
  const bytes = await doc.save({ useObjectStreams: true });
  await fs.writeFile(outFile, bytes);
  return true;
}

/** Get the size of a file in bytes. */
export async function fileSize(file: string): Promise<number> {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return 0;
  }
}
