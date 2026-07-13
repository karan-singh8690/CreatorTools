/**
 * OCR via Tesseract.
 *
 * Tesseract can produce a searchable PDF directly:
 *   tesseract <image-or-pdf> <out-basename> -l eng pdf
 * The output PDF has the original image as the visible layer plus an
 * invisible text layer. We use this to rebuild searchable PDFs from
 * cleaned page images.
 *
 * For multi-page input, we OCR each page image and merge with pdf-lib.
 */
import path from 'path';
import { promises as fs } from 'fs';
import { run } from './utils';

export interface OcrPageResult {
  searchablePdfPath: string;
  textPath: string;
}

/** OCR a single PNG/JPEG to a searchable PDF + sidecar .txt. */
export async function ocrImageToPdf(
  imageFile: string,
  outDir: string,
  page: number,
  lang = 'eng'
): Promise<OcrPageResult> {
  const base = path.join(outDir, `ocr-${String(page).padStart(4, '0')}`);
  // tesseract writes base.pdf and base.txt
  await run('tesseract', [imageFile, base, '-l', lang, 'pdf', 'txt'], {
    timeoutMs: 120_000,
  });
  return {
    searchablePdfPath: `${base}.pdf`,
    textPath: `${base}.txt`,
  };
}

/** OCR every page image to individual searchable PDFs (parallel, bounded). */
export async function ocrPages(
  imageFiles: string[],
  outDir: string,
  lang = 'eng',
  concurrency = 3,
  onProgress?: (done: number, total: number) => void
): Promise<OcrPageResult[]> {
  const results: OcrPageResult[] = new Array(imageFiles.length);
  let done = 0;
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= imageFiles.length) break;
      try {
        results[i] = await ocrImageToPdf(imageFiles[i], outDir, i + 1, lang);
      } catch {
        // Fallback: produce an empty text file + skip OCR for this page.
        const txtPath = path.join(outDir, `ocr-${String(i + 1).padStart(4, '0')}.txt`);
        await fs.writeFile(txtPath, '');
        results[i] = { searchablePdfPath: '', textPath: txtPath };
      }
      done++;
      onProgress?.(done, imageFiles.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, imageFiles.length) }, worker));
  return results;
}
