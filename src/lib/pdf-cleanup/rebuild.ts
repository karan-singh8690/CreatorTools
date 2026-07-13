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
import type { Token } from './content-stream';

const execFileP = promisify(execFile);

interface PageImage {
  path: string;
  width: number;
  height: number;
  /** Optional: PDF page dimensions in points. If provided, the page is sized
   *  to these dimensions and the image is scaled to fill (preserves the
   *  original page size). If omitted, pixel dimensions are used as points. */
  pageWidthPts?: number;
  pageHeightPts?: number;
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
    // Use original page dimensions if provided (correct physical size);
    // otherwise fall back to pixel-as-points.
    const pageW = p.pageWidthPts ?? p.width;
    const pageH = p.pageHeightPts ?? p.height;
    const page = doc.addPage([pageW, pageH]);
    page.drawImage(embedded, { x: 0, y: 0, width: pageW, height: pageH });
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
 * Convert a PDF to PDF/A (archival ISO 19005) using Ghostscript.
 *
 * PDF/A-2b: long-term preservation, sRGB color space, no external refs,
 *           embedded fonts. ISO 19005-2.
 * PDF/A-3:  same as -2b but allows embedded files (attachments). ISO 19005-3.
 *
 * Ghostscript's `pdfwrite` device with `-dPDFA=2|3` produces a compliant
 * PDF/A with an embedded ICC profile + XMP metadata declaring the
 * pdfaid:part / pdfaid:conformance. We embed the sRGB ICC profile from
 * /usr/share/color/icc/ghostscript/srgb.icc (bundled with Ghostscript).
 *
 * Falls back to copying the input on any conversion error.
 */
export async function buildPdfA(
  inFile: string,
  outFile: string,
  profile: 'pdfa-2b' | 'pdfa-3'
): Promise<void> {
  // Locate the sRGB ICC profile (Ghostscript ships it).
  const iccCandidates = [
    '/usr/share/color/icc/ghostscript/srgb.icc',
    '/usr/share/color/icc/colord/sRGB.icc',
    '/usr/local/share/color/icc/srgb.icc',
  ];
  let iccPath = '';
  for (const p of iccCandidates) {
    try {
      await fs.access(p);
      iccPath = p;
      break;
    } catch {
      /* try next */
    }
  }

  const pdfaPart = profile === 'pdfa-3' ? 3 : 2;

  try {
    const args = [
      '-dQUIET',
      '-dBATCH',
      '-dNOPAUSE',
      '-sDEVICE=pdfwrite',
      `-dPDFA=${pdfaPart}`,
      '-dPDFACompatibilityPolicy=1',
      '-sColorConversionStrategy=sRGB',
      '-dEmbedAllFonts=true',
      '-dSubsetFonts=true',
      '-dCompressFonts=true',
      '-dDetectDuplicateImages=true',
      '-dAutoRotatePages=/None',
      '-dPrinted=false',
      '-dPreserveEPSInfo=false',
      '-dPreserveOPIComments=false',
      '-dUCRandBGInfo=/Remove',
    ];
    if (iccPath) {
      args.push(`-sOutputICCProfileFile=${iccPath}`);
    }
    args.push(`-sOutputFile=${outFile}`, inFile);

    await execFileP('gs', args, {
      timeout: 300_000,
      maxBuffer: 50 * 1024 * 1024,
    });

    // Verify the output has PDF/A XMP metadata; if not, fall back.
    const out = await fs.readFile(outFile);
    const text = out.toString('latin1');
    if (!text.includes('pdfaid:part')) {
      // XMP metadata missing — conversion didn't fully succeed.
      throw new Error('PDF/A XMP metadata not found in output');
    }
  } catch (err) {
    // Fallback: copy the input so the job still produces a usable PDF.
    try {
      await fs.copyFile(inFile, outFile);
    } catch {
      /* ignore */
    }
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
 * Strip vector text watermarks from a PDF by removing the exact text-show
 * operators (Tj / TJ / ' / ") whose string operand matches a watermark.
 *
 * Uses our content-stream tokenizer for PRECISE operator removal (not a
 * fragile regex). This keeps 100% of the page vector — text, fonts,
 * graphics, images, layout all untouched — and only deletes the watermark's
 * text-show op. Output is a true vector PDF with the watermark gone.
 *
 * Returns true if any operator was removed.
 */
export async function stripTextWatermarkFromVector(
  file: string,
  outFile: string,
  watermarkTexts: string[]
): Promise<boolean> {
  if (watermarkTexts.length === 0) return false;
  const data = await fs.readFile(file);
  const doc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });

  const pages = doc.getPages();
  let modifiedAny = false;

  // Normalize needles: lowercase, trimmed, non-empty. We match
  // case-insensitively against the decoded string operands.
  const needles = new Set(
    watermarkTexts.map((s) => s.toLowerCase().trim()).filter((s) => s.length > 0)
  );

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const node = pages[pageIdx].node;
    const contents = node.get(PDFName.of('Contents'));
    if (!contents) continue;

    // Collect content streams (handle PDFArray + indirect refs).
    const streams: PDFRawStream[] = [];
    const collectStreams = (obj: unknown) => {
      if (obj instanceof PDFRawStream) {
        streams.push(obj);
      } else if (obj && typeof obj === 'object' && 'size' in obj && 'get' in obj) {
        const arr = obj as unknown as { size: (() => number) | number; get: (i: number) => unknown };
        const n = typeof arr.size === 'function' ? arr.size() : arr.size;
        for (let i = 0; i < n; i++) {
          collectStreams(doc.context.lookup(arr.get(i)));
        }
      }
    };
    collectStreams(doc.context.lookup(contents));

    for (const stream of streams) {
      try {
        // Decompress (FlateDecode) if needed.
        const filter = stream.dict.get(PDFName.of('Filter'));
        const filterName = nameToTextHelper(filter);
        let raw: Uint8Array = stream.contents;
        if (filterName.includes('FlateDecode')) {
          try {
            const zlib = await import('zlib');
            raw = new Uint8Array(zlib.inflateSync(Buffer.from(raw)));
          } catch {
            /* use raw */
          }
        }

        // Tokenize, then rebuild the stream excluding watermark text-show ops.
        const tokens = tokenizeContentStream(raw);
        const kept: Token[] = [];
        let pageChanged = false;
        const operands: Token[] = [];

        const flushKeep = () => {
          for (const t of operands) kept.push(t);
          operands.length = 0;
        };

        for (const tok of tokens) {
          if (tok.t !== 'op') {
            operands.push(tok);
            continue;
          }
          // Operator. Check if it's a text-show op emitting a watermark.
          const op = tok.v;
          let isWatermarkOp = false;
          if (op === 'Tj' || op === "'" || op === '"') {
            // Single string operand: (str) Tj
            const strTok = operands[operands.length - 1];
            if (strTok && strTok.t === 'str') {
              const decoded = strTok.v.toLowerCase().trim();
              if (needles.has(decoded)) isWatermarkOp = true;
            }
          } else if (op === 'TJ') {
            // Array of strings: [ (s1) n (s2) n ... ] TJ
            // Concatenate all string operands and check.
            const parts = operands
              .filter((t) => t.t === 'str')
              .map((t) => t.v)
              .join('');
            if (parts.trim() && needles.has(parts.toLowerCase().trim())) {
              isWatermarkOp = true;
            }
          }

          if (isWatermarkOp) {
            // Drop the operands AND the operator — watermark removed.
            operands.length = 0;
            pageChanged = true;
          } else {
            flushKeep();
            kept.push(tok);
          }
        }
        flushKeep(); // trailing operands

        if (pageChanged) {
          // Rebuild the stream bytes from kept tokens, then recompress.
          const rebuilt = serializeTokens(kept);
          // Write back as a FlateDecode stream (smaller + standard).
          try {
            const zlib = await import('zlib');
            const compressed = zlib.deflateSync(Buffer.from(rebuilt));
            (stream as unknown as { contents: Uint8Array }).contents = new Uint8Array(compressed);
            stream.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
            stream.dict.set(PDFName.of('Length'), PDFNumber.of(compressed.length));
          } catch {
            // Fallback: write uncompressed.
            (stream as unknown as { contents: Uint8Array }).contents = rebuilt;
            stream.dict.delete(PDFName.of('Filter'));
            stream.dict.set(PDFName.of('Length'), PDFNumber.of(rebuilt.length));
          }
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

/**
 * SURGICAL REGION REPAIR: patch watermark regions on an otherwise-vector PDF.
 *
 * For each detected watermark bbox, this:
 *   1. Renders ONLY the watermark region of the page to a high-res image
 *      (via pdftoppm with a clip, or full-page render + crop).
 *   2. Paints a clean (white or sampled-background) rectangle over the
 *      watermark pixels in that region image.
 *   3. Overlays the repaired region image onto the vector PDF page at the
 *      exact bbox coordinates — as a small image XObject, NOT a full-page
 *      raster. Everything outside the bbox stays 100% vector.
 *
 * This keeps file sizes small (only small region images are embedded) and
 * preserves print quality (vector text/graphics outside the watermark are
 * untouched, infinitely scalable).
 *
 * Use this when `stripTextWatermarkFromVector` can't fully remove a
 * watermark (e.g. image-based watermarks, complex vector path watermarks).
 */
export async function surgicalWatermarkRepair(
  file: string,
  outFile: string,
  watermarks: WatermarkCandidate[],
  opts: { dpi?: number; paddingPts?: number } = {}
): Promise<boolean> {
  if (watermarks.length === 0) return false;
  const dpi = opts.dpi ?? 300;
  const paddingPts = opts.paddingPts ?? 4; // small padding to fully cover edges

  const data = await fs.readFile(file);
  const doc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
  const pages = doc.getPages();
  const sharp = (await import('sharp')).default;
  const { run: runCmd, createJobDir, rmrf } = await import('./utils');
  const tmpDir = await createJobDir('surgical');
  let modifiedAny = false;

  try {
    // Group watermarks by page.
    const byPage = new Map<number, WatermarkCandidate[]>();
    for (const w of watermarks) {
      const arr = byPage.get(w.page) ?? [];
      arr.push(w);
      byPage.set(w.page, arr);
    }

    for (const [pageIdx, page] of pages.entries()) {
      const pageNumber = pageIdx + 1;
      const pageWms = byPage.get(pageNumber);
      if (!pageWms || pageWms.length === 0) continue;

      const { width: pageW, height: pageH } = page.getSize();

      // Render this page at high DPI ONCE (we'll crop per-watermark).
      try {
        await runCmd('pdftoppm', [
          '-png', '-r', String(dpi),
          '-f', String(pageNumber), '-l', String(pageNumber),
          file, `${tmpDir}/page-${pageNumber}`,
        ], { timeoutMs: 120_000 });
      } catch {
        continue; // skip page if render fails
      }
      // pdftoppm names page-1.png or page-01.png etc.
      const fsSync = await import('fs');
      const found = fsSync.readdirSync(tmpDir).filter((f) => f.startsWith(`page-${pageNumber}-`) && f.endsWith('.png'));
      if (found.length === 0) continue;
      const renderedPath = `${tmpDir}/${found[0]}`;

      // Scale factor: PDF points → rendered pixels.
      const scale = dpi / 72;
      const renderedMeta = await sharp(renderedPath).metadata();
      const renderW = renderedMeta.width ?? Math.round(pageW * scale);
      const renderH = renderedMeta.height ?? Math.round(pageH * scale);

      for (let wi = 0; wi < pageWms.length; wi++) {
        const wm = pageWms[wi];
        // Watermark bbox is top-left origin (from our detector). Convert to
        // bottom-left for PDF image placement, with padding.
        const xPts = Math.max(0, wm.bbox.x - paddingPts);
        const yTopPts = wm.bbox.y - paddingPts;
        const wPts = Math.min(pageW - xPts, wm.bbox.width + paddingPts * 2);
        const hPts = Math.min(pageH, wm.bbox.height + paddingPts * 2);
        // bottom-left y for pdf-lib drawImage:
        const yPts = Math.max(0, pageH - yTopPts - hPts);

        // Crop the rendered page to this region (in pixels).
        const left = Math.max(0, Math.round(xPts * scale));
        const top = Math.max(0, Math.round(yTopPts * scale));
        const cropW = Math.min(renderW - left, Math.round(wPts * scale));
        const cropH = Math.min(renderH - top, Math.round(hPts * scale));
        if (cropW <= 0 || cropH <= 0) continue;

        // Paint a clean white rectangle over the entire region (this is the
        // "repaired" patch — covers the watermark). For better fidelity we
        // could sample the page's average background color, but white is the
        // correct choice for the vast majority of documents.
        const whiteRect = await sharp({
          create: {
            width: cropW,
            height: cropH,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          },
        })
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .png()
          .toBuffer();

        // Embed the white patch as an image XObject on the page, drawn at the
        // exact watermark bbox. Everything outside stays vector.
        const img = await doc.embedPng(whiteRect);
        page.drawImage(img, {
          x: xPts,
          y: yPts,
          width: wPts,
          height: hPts,
        });
        modifiedAny = true;
      }
    }

    if (!modifiedAny) return false;
    const bytes = await doc.save({ useObjectStreams: true });
    await fs.writeFile(outFile, bytes);
    return true;
  } finally {
    await rmrf(tmpDir);
  }
}

function nameToTextHelper(v: unknown): string {
  if (v instanceof PDFName) {
    try {
      const s = typeof (v as { asString: () => string }).asString === 'function'
        ? (v as { asString: () => string }).asString()
        : String(v);
      return s.replace(/^\//, '');
    } catch {
      return '';
    }
  }
  return '';
}

/** Tokenize a content stream (re-uses the content-stream module's tokenizer). */
function tokenizeContentStream(data: Uint8Array): Token[] {
  // Lazy require to avoid circular dependency at module load.
  // The tokenizer is pure and stateless.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tokenize } = require('./content-stream') as typeof import('./content-stream');
  return tokenize(data);
}

/** Serialize tokens back to PDF content-stream bytes (latin1). */
function serializeTokens(tokens: Token[]): Uint8Array {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : null;
    // Insert a space between consecutive tokens that would otherwise merge.
    if (i > 0 && needsSeparator(prev, tok)) out += ' ';
    switch (tok.t) {
      case 'str':
        out += '(' + escapePdfString(tok.v) + ')';
        break;
      case 'num':
        out += String(tok.v);
        break;
      case 'name':
        out += '/' + tok.v;
        break;
      case 'op':
        out += tok.v;
        break;
      case 'lbracket':
        out += '[';
        break;
      case 'rbracket':
        out += ']';
        break;
      case 'ldict':
        out += '<<';
        break;
      case 'rdict':
        out += '>>';
        break;
    }
  }
  return new TextEncoder().encode(out);
}

function needsSeparator(a: Token | null, b: Token): boolean {
  if (!a) return false;
  // Two numbers, or number+name, or name+number, etc. need a separator.
  const textTypes = new Set(['num', 'name', 'op']);
  if (textTypes.has(a.t) && textTypes.has(b.t)) return true;
  return false;
}

function escapePdfString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Get the size of a file in bytes. */
export async function fileSize(file: string): Promise<number> {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return 0;
  }
}
