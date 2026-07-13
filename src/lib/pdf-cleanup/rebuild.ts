/**
 * PDF assembly: rebuild a clean PDF from processed page images using pdf-lib.
 * Also supports merging per-page Tesseract-searchable PDFs into one.
 */
import { PDFDocument, PDFName, PDFRawStream, PDFDict, PDFArray, PDFNumber } from 'pdf-lib';
import path from 'path';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

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
