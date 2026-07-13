/**
 * Main orchestrator: runs the full cleanup pipeline for a job.
 *
 * Strategy selection:
 *  - watermark mode on a vector PDF → strip text watermarks from content
 *    streams (stripTextWatermarkFromVector); fall back to raster masking
 *    for any watermark that can't be removed cleanly.
 *  - background mode on a vector PDF with detected bg rectangles → try
 *    vector removal; otherwise raster flatten.
 *  - clean-scan / scanned PDFs → render → sharp cleanup → rebuild image PDF.
 *  - full mode → analyze, then apply the best combination.
 *
 * Progress is reported via the job store so /api/cleanup/status can poll.
 */
import path from 'path';
import { promises as fs } from 'fs';
import { CleanupOptions } from './types';
import {
  createJobDir,
  saveUpload,
  getPdfInfo,
  renderPagesToPng,
  rmrf,
  run,
} from './utils';
import { analyzePdf, repairPdf, extractWordBoxes } from './detect';
import { cleanPageRaster, maskWatermarkRegion } from './raster-clean';
import { ocrPages } from './ocr';
import {
  buildImagePdf,
  buildSearchablePdfWithOriginalText,
  mergeSearchablePdfs,
  compressWithGhostscript,
  optimizeWithQpdf,
  stripTextWatermarkFromVector,
  surgicalWatermarkRepair,
  fileSize,
} from './rebuild';
import { updateProgress, updateJob } from './job-store';
import sharp from 'sharp';

const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_PAGES = 1000;

export interface RunArgs {
  jobId: string;
  originalPath: string; // already-saved upload path
  options: CleanupOptions;
}

function pct(part: number, total: number, base: number, span: number): number {
  if (total <= 0) return base + span;
  return Math.round(base + (span * part) / total);
}

/** Page indices to process (0-based) given options.pageRange. */
function pageIndicesToProcess(totalPages: number, range: CleanupOptions['pageRange']): number[] {
  if (!range) return Array.from({ length: totalPages }, (_, i) => i);
  const from = Math.max(1, range.from);
  const to = Math.min(totalPages, range.to);
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i - 1);
  return out;
}

export async function runCleanup({ jobId, originalPath, options }: RunArgs): Promise<void> {
  let jobDir = '';
  try {
    // ── Validate file ────────────────────────────────────────────────────
    const stat = await fs.stat(originalPath);
    if (stat.size > MAX_FILE_BYTES) {
      throw Object.assign(new Error('File exceeds the 500 MB limit.'), { code: 'TOO_LARGE' });
    }

    await updateProgress(jobId, {
      stage: 'analyzing',
      message: 'Analyzing PDF structure…',
      percent: 2,
    });

    // Try to load info; if it fails, attempt a qpdf repair.
    let workPath = originalPath;
    let info;
    try {
      info = await getPdfInfo(workPath);
    } catch {
      jobDir = await createJobDir('cleanup');
      const repaired = await repairPdf(workPath, jobDir);
      workPath = repaired;
      info = await getPdfInfo(workPath);
    }

    if (info.encrypted) {
      throw Object.assign(new Error('PDF is encrypted. Decrypt it first.'), { code: 'ENCRYPTED' });
    }
    if (info.pageCount === 0) {
      throw Object.assign(new Error('PDF has no pages.'), { code: 'EMPTY' });
    }
    if (info.pageCount > MAX_PAGES) {
      throw Object.assign(
        new Error(`PDF has ${info.pageCount} pages; max is ${MAX_PAGES}.`),
        { code: 'TOO_MANY_PAGES' }
      );
    }

    await updateJob(jobId, { totalPages: info.pageCount });

    // ── Analyze (detect watermarks / backgrounds / scanned) ──────────────
    await updateProgress(jobId, {
      stage: 'detecting-watermarks',
      message: 'Detecting watermarks & backgrounds…',
      percent: 5,
    });
    const detection = await analyzePdf(workPath, { brightnessSamplePages: Math.min(3, info.pageCount) });
    await updateJob(jobId, { totalPages: detection.pageCount });

    if (!jobDir) jobDir = await createJobDir('cleanup');

    const dpi =
      options.quality === 'fast'
        ? 150
        : options.quality === 'balanced'
        ? 200
        : options.quality === 'high'
        ? 300
        : 400;

    const pagesToProcess = pageIndicesToProcess(detection.pageCount, options.pageRange);
    const pageNumbers = pagesToProcess.map((i) => i + 1); // 1-indexed

    // Decide if we need full-page raster rendering. We AVOID full raster
    // for watermark-only removal on vector PDFs — instead we use surgical
    // vector strip + region repair (keeps the page vector, small file).
    // Full raster is only needed for: background removal, clean-scan,
    // scanned/mixed PDFs, flattened/searchable output, OCR, or full mode.
    const isWatermarkOnlyVector =
      (options.mode === 'watermark' ||
        (options.removeWatermark && !options.removeBackground && !options.cleanScan)) &&
      detection.hasTextLayer &&
      detection.kind !== 'scanned';

    const wantsRaster =
      !isWatermarkOnlyVector &&
      (options.mode === 'clean-scan' ||
        options.cleanScan ||
        options.removeBackground ||
        options.removeWatermark ||
        detection.kind === 'scanned' ||
        detection.kind === 'mixed' ||
        detection.watermarkCandidates.length > 0 ||
        options.outputFormat === 'flattened' ||
        options.outputFormat === 'searchable' ||
        options.runOcr ||
        options.mode === 'full');

    const wantsVectorWatermarkStrip =
      (options.removeWatermark || options.mode === 'watermark' || options.mode === 'full') &&
      detection.hasTextLayer &&
      detection.watermarkCandidates.length > 0;

    let currentPath = workPath;
    let vectorStripSucceeded = false;

    // ── Step 1: watermark removal — preserve vectors ─────────────────────
    // Strategy: try surgical vector strip first (removes the exact Tj/TJ
    // operator emitting the watermark text → 100% vector output). If that
    // fails (image watermarks, complex paths), fall back to surgical region
    // repair (rasterize ONLY the watermark bbox, composite a white patch,
    // keep everything else vector). Full-page raster is the last resort,
    // used only for background/clean-scan modes.
    if (wantsVectorWatermarkStrip) {
      const uniqueTexts = Array.from(
        new Set(detection.watermarkCandidates.map((w) => w.text).filter((t) => t && t.trim()))
      );

      // 1a. Try vector text-show-op removal (keeps 100% vector).
      await updateProgress(jobId, {
        stage: 'detecting-watermarks',
        message: `Removing ${detection.watermarkCandidates.length} watermark(s) from vector content…`,
        percent: 10,
      });
      const strippedPath = path.join(jobDir, 'vector-watermark-stripped.pdf');
      try {
        const ok = await stripTextWatermarkFromVector(currentPath, strippedPath, uniqueTexts);
        if (ok) {
          currentPath = strippedPath;
          vectorStripSucceeded = true;
        }
      } catch {
        /* fall through to surgical repair */
      }

      // 1b. If vector strip didn't catch everything, do surgical region
      // repair: patch only the watermark bbox, keep the rest vector.
      if (!vectorStripSucceeded) {
        await updateProgress(jobId, {
          stage: 'detecting-watermarks',
          message: 'Patching watermark regions (surgical repair, keeping vectors)…',
          percent: 20,
        });
        const repairedPath = path.join(jobDir, 'surgical-repaired.pdf');
        try {
          const surgicalDpi =
            options.quality === 'fast' ? 200
            : options.quality === 'balanced' ? 300
            : options.quality === 'high' ? 400
            : 600;
          const ok = await surgicalWatermarkRepair(
            currentPath,
            repairedPath,
            detection.watermarkCandidates.filter((w) => pageNumbers.includes(w.page)),
            { dpi: surgicalDpi, paddingPts: 4 }
          );
          if (ok) currentPath = repairedPath;
        } catch {
          /* fall through to full raster (if enabled) */
        }
      }
    }

    // ── Step 2: raster processing (if needed) ────────────────────────────
    if (wantsRaster) {
      await updateProgress(jobId, {
        stage: 'cleaning-background',
        message: 'Rendering pages for cleanup…',
        percent: 15,
      });

      // Render only the pages we'll process.
      const firstPage = pageNumbers[0] ?? 1;
      const lastPage = pageNumbers[pageNumbers.length - 1] ?? detection.pageCount;
      const renderDir = path.join(jobDir, 'render');
      await fs.mkdir(renderDir, { recursive: true });
      // Render the whole needed range once, then pick the pages we want.
      const allPngs = await renderPagesToPng(currentPath, renderDir, {
        dpi,
        first: firstPage,
        last: lastPage,
        prefix: 'p',
      });

      // Build the list of (page number, png path) for pages in our range.
      const pagePngs: { page: number; png: string }[] = [];
      for (let i = 0; i < allPngs.length; i++) {
        const pageNum = firstPage + i;
        if (pageNumbers.includes(pageNum)) {
          pagePngs.push({ page: pageNum, png: allPngs[i] });
        }
      }

      // Mask any remaining watermark regions (raster inpainting) for watermarks
      // we couldn't strip from the vector stream.
      const remainingWm =
        options.removeWatermark || options.mode === 'watermark' || options.mode === 'full'
          ? detection.watermarkCandidates.filter((w) => pageNumbers.includes(w.page))
          : [];
      if (remainingWm.length > 0 && detection.pageCount > 0) {
        await updateProgress(jobId, {
          stage: 'cleaning-background',
          message: 'Masking watermark regions…',
          percent: 25,
        });
        const pagePoints = info.pageSize ?? { width: 612, height: 792 };
        for (const wm of remainingWm) {
          const entry = pagePngs.find((p) => p.page === wm.page);
          if (!entry) continue;
          const meta = await sharp(entry.png).metadata();
          const masked = path.join(renderDir, `masked-${wm.page}-${wm.bbox.x.toFixed(0)}.png`);
          try {
            // pdftotext gives top-left-origin y; maskWatermarkRegion expects
            // bottom-left (PDF native). Convert before masking.
            const pdfOriginRegion = {
              x: wm.bbox.x,
              y: pagePoints.height - wm.bbox.y - wm.bbox.height,
              width: wm.bbox.width,
              height: wm.bbox.height,
            };
            await maskWatermarkRegion(
              entry.png,
              masked,
              pdfOriginRegion,
              pagePoints,
              { width: meta.width ?? 0, height: meta.height ?? 0 }
            );
            entry.png = masked;
          } catch {
            /* keep original */
          }
        }
      }

      // Clean each page raster.
      const cleanDir = path.join(jobDir, 'clean');
      await fs.mkdir(cleanDir, { recursive: true });
      const cleanPages: { page: number; path: string; width: number; height: number }[] = [];
      for (let i = 0; i < pagePngs.length; i++) {
        const { page, png } = pagePngs[i];
        const baseProgress = 30;
        const span = 45; // raster cleanup occupies 30%..75%
        await updateProgress(jobId, {
          stage: options.cleanScan || options.mode === 'clean-scan' ? 'cleaning-scan' : 'cleaning-background',
          message: `Cleaning page ${page} of ${detection.pageCount}…`,
          currentPage: page,
          totalPages: detection.pageCount,
          percent: pct(i, pagePngs.length, baseProgress, span),
        });
        const r = await cleanPageRaster(png, cleanDir, page, options);
        cleanPages.push({ page, path: r.pngPath, width: r.width, height: r.height });
      }

      // ── Step 3: Rebuild the output PDF — preserve searchability ────────
      //
      // Professional tools (Adobe Acrobat, iLovePDF, Smallpdf) preserve the
      // searchable text layer whenever possible. We do the same with three
      // strategies, chosen in priority order:
      //
      //   1. LOSSLESS OVERLAY (preferred): the source had a text layer, so
      //      we overlay the ORIGINAL words invisibly (PDF text render mode
      //      3) on the cleaned image. Zero OCR errors — perfect fidelity.
      //      Watermark words are excluded so removed watermarks don't
      //      reappear as searchable text.
      //
      //   2. OCR FALLBACK: the source had no text layer (scanned), OR the
      //      user explicitly requested OCR. We run Tesseract on each
      //      cleaned image to build a fresh searchable text layer.
      //
      //   3. IMAGE-ONLY: only when the user explicitly chose "flattened"
      //      output (discard text). This is the only path that loses
      //      searchability, and it's an explicit user choice.
      //
      const wantsFlattened = options.outputFormat === 'flattened';
      const useLosslessOverlay =
        !wantsFlattened && detection.hasTextLayer;
      const useOcrFallback =
        !wantsFlattened &&
        !useLosslessOverlay &&
        (options.runOcr || options.outputFormat === 'searchable');

      if (useLosslessOverlay) {
        await updateProgress(jobId, {
          stage: 'optimizing',
          message: 'Preserving searchable text layer (lossless overlay)…',
          percent: 76,
        });

        // Re-extract word boxes for the ORIGINAL pdf (pre-strip) so the
        // overlay matches the original text positions exactly.
        const wmPages =
          pageNumbers.length > 0
            ? await extractWordBoxes(originalPath, pageNumbers[0], pageNumbers[pageNumbers.length - 1])
            : [];
        // Map cleaned images → their word boxes by page number.
        const overlayPages = cleanPages.map((cp) => {
          const wp = wmPages.find((w) => w.pageNumber === cp.page);
          return {
            imagePath: cp.path,
            pageWidthPts: wp?.width ?? info.pageSize?.width ?? cp.width,
            pageHeightPts: wp?.height ?? info.pageSize?.height ?? cp.height,
            words: wp?.words ?? [],
            pageNumber: cp.page,
          };
        });

        const searchablePdf = path.join(jobDir, 'searchable-lossless.pdf');
        await buildSearchablePdfWithOriginalText(
          overlayPages,
          searchablePdf,
          options.quality,
          detection.watermarkCandidates
        );
        currentPath = searchablePdf;
      } else if (useOcrFallback) {
        await updateProgress(jobId, {
          stage: 'running-ocr',
          message: 'Running OCR to build a searchable text layer…',
          percent: 76,
        });
        const ocrDir = path.join(jobDir, 'ocr');
        await fs.mkdir(ocrDir, { recursive: true });
        const results = await ocrPages(
          cleanPages.map((p) => p.path),
          ocrDir,
          'eng',
          3,
          async (done, total) => {
            await updateProgress(jobId, {
              stage: 'running-ocr',
              message: `OCR page ${done}/${total}…`,
              percent: pct(done, total, 76, 12),
            });
          }
        );
        const searchablePdf = path.join(jobDir, 'searchable-ocr.pdf');
        await mergeSearchablePdfs(
          results.map((r) => r.searchablePdfPath),
          searchablePdf
        );
        currentPath = searchablePdf;
      } else {
        // Image-only (flattened) — explicit user choice to discard text.
        // Pass original page dimensions so the PDF page has the correct
        // physical size (e.g. A4), not pixel-as-points.
        const imagePdf = path.join(jobDir, 'image.pdf');
        await buildImagePdf(
          cleanPages.map((p) => ({
            path: p.path,
            width: p.width,
            height: p.height,
            pageWidthPts: info.pageSize?.width,
            pageHeightPts: info.pageSize?.height,
          })),
          imagePdf,
          options.quality
        );
        currentPath = imagePdf;
      }
    }

    // ── Step 4: optimization / compression ──────────────────────────────
    await updateProgress(jobId, {
      stage: 'optimizing',
      message: 'Optimizing output PDF…',
      percent: 90,
    });

    const finalPath = path.join(jobDir, 'output.pdf');

    if (options.compressAfter || options.outputFormat === 'compressed') {
      const tmp = path.join(jobDir, 'compressed.pdf');
      await compressWithGhostscript(currentPath, tmp, options.quality);
      await optimizeWithQpdf(tmp, finalPath);
    } else {
      await optimizeWithQpdf(currentPath, finalPath);
    }

    // ── Step 5: finalize ────────────────────────────────────────────────
    await updateProgress(jobId, {
      stage: 'preparing-download',
      message: 'Preparing download…',
      percent: 97,
    });

    const outSize = await fileSize(finalPath);
    const baseName = (await fs.stat(originalPath), path.basename(originalPath, '.pdf'));
    const outName = `${baseName}-cleaned.pdf`;

    await updateJob(jobId, {
      outputPath: finalPath,
      outputName: outName,
      outputSizeBytes: outSize,
      resultUrl: `/api/cleanup/download?jobId=${encodeURIComponent(jobId)}`,
      stage: 'complete',
      message: 'Cleanup complete!',
      percent: 100,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error';
    await updateJob(jobId, {
      stage: 'error',
      message,
      error: message,
      percent: 100,
    });
    // Best-effort cleanup of the job dir, but keep the output if any for download.
    if (jobDir) {
      // keep output; only nuke intermediate render dirs on fatal error
    }
  }
}

/** Generate a before/after preview pair for a single page (used by preview API). */
export async function generatePreview(
  file: Buffer,
  originalName: string,
  page: number,
  options: CleanupOptions
): Promise<{ beforeUrl: string; afterUrl: string; width: number; height: number }> {
  const jobDir = await createJobDir('preview');
  try {
    const uploadPath = await saveUpload(file, originalName, jobDir);
    const info = await getPdfInfo(uploadPath);
    if (page < 1 || page > info.pageCount) {
      throw Object.assign(new Error(`Invalid page ${page} (1..${info.pageCount})`), { code: 'BAD_PAGE' });
    }
    const dpi = options.quality === 'fast' ? 120 : 150;
    const pngs = await renderPagesToPng(uploadPath, jobDir, { dpi, first: page, last: page, prefix: 'orig' });
    if (pngs.length === 0) throw new Error('Failed to render page.');
    const beforePng = pngs[0];
    const afterPng = path.join(jobDir, `after.png`);

    // Produce the "after" using the raster pipeline for visual preview.
    const cleaned = await cleanPageRaster(beforePng, jobDir, page, options);
    // Copy to a stable name
    await fs.copyFile(cleaned.pngPath, afterPng);

    const meta = await sharp(beforePng).metadata();

    // We can't return URLs to temp files directly; the preview API will
    // return base64 data URIs instead. Build them here.
    const beforeBuf = await fs.readFile(beforePng);
    const afterBuf = await fs.readFile(afterPng);
    return {
      beforeUrl: `data:image/png;base64,${beforeBuf.toString('base64')}`,
      afterUrl: `data:image/png;base64,${afterBuf.toString('base64')}`,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    };
  } finally {
    // Temp dir cleaned by the TTL sweeper; previews are short-lived.
  }
}

// Silence unused-import warnings for tools reserved for future hooks.
void run;
