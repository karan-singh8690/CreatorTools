import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import path from 'path';
import { promises as fs } from 'fs';
import { createJobDir, saveUpload, sanitizeFilename, assertSystemBinaries } from '@/lib/pdf-cleanup/utils';
import { createJob, updateJob } from '@/lib/pdf-cleanup/job-store';
import { runCleanup } from '@/lib/pdf-cleanup';
import { DEFAULT_OPTIONS, CleanupOptions } from '@/lib/pdf-cleanup/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/cleanup/combine
 *
 * Accepts multiple PDF files + cleanup options, merges them into one PDF
 * (in upload order), then runs the full cleanup pipeline on the merged
 * result (watermark removal, scan cleanup, compression, PDF/A, etc.).
 *
 * Multipart form:
 *   - files[] = <pdf1>, files[] = <pdf2>, ...  (multiple file fields)
 *   - options  = <json>                          (CleanupOptions)
 *
 * Returns: { ok, jobId, totalPages, estimatedSeconds }
 */
export async function POST(req: NextRequest) {
  let jobDir = '';
  try {
    // Verify system binaries are available (Vercel doesn't have them).
    await assertSystemBinaries();

    const form = await req.formData();

    // Collect all PDF files (FormData supports multiple values per key).
    const files: File[] = [];
    for (const [key, value] of form.entries()) {
      if (key === 'files' && value instanceof File) {
        files.push(value);
      }
    }
    // Also accept "file" key for single-file compat.
    const single = form.get('file');
    if (single instanceof File) files.push(single);

    if (files.length < 2) {
      return NextResponse.json(
        { ok: false, error: 'At least 2 PDF files are required to combine.' },
        { status: 400 }
      );
    }

    // Validate all files are PDFs.
    for (const f of files) {
      if (f.size > 500 * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: `File "${f.name}" exceeds the 500 MB limit.` },
          { status: 413 }
        );
      }
      const buf = Buffer.from(await f.arrayBuffer());
      if (!buf.slice(0, 5).toString('latin1').startsWith('%PDF')) {
        return NextResponse.json(
          { ok: false, error: `"${f.name}" is not a valid PDF.` },
          { status: 400 }
        );
      }
    }

    // Parse cleanup options.
    let options: CleanupOptions = { ...DEFAULT_OPTIONS };
    const rawOpts = form.get('options');
    if (rawOpts && typeof rawOpts === 'string') {
      try {
        options = { ...DEFAULT_OPTIONS, ...JSON.parse(rawOpts) };
      } catch {
        return NextResponse.json(
          { ok: false, error: 'Invalid options JSON.' },
          { status: 400 }
        );
      }
    }

    // Create the job record.
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    const job = await createJob(`combined-${files.length}-files.pdf`, totalSize);
    jobDir = await createJobDir('combine');

    // ── Step 1: Merge all PDFs into one (in upload order) ────────────────
    const mergedDoc = await PDFDocument.create();
    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer());
      try {
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await mergedDoc.copyPages(src, src.getPageIndices());
        for (const p of pages) mergedDoc.addPage(p);
      } catch {
        // Skip unreadable files (encrypted/corrupted) — don't fail the whole job.
      }
    }
    const mergedBytes = await mergedDoc.save({ useObjectStreams: true });
    const mergedPath = path.join(jobDir, 'merged.pdf');
    await fs.writeFile(mergedPath, mergedBytes);

    // Store the merged path as the job's originalPath.
    await updateJob(job.id, { originalPath: mergedPath });

    // ── Step 2: Run the cleanup pipeline on the merged PDF ───────────────
    // Fire-and-forget; client polls /api/cleanup/status.
    runCleanup({ jobId: job.id, originalPath: mergedPath, options }).catch(async (err) => {
      await updateJob(job.id, {
        stage: 'error',
        message: err instanceof Error ? err.message : 'Processing failed.',
        error: err instanceof Error ? err.message : String(err),
        percent: 100,
      });
    });

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      totalPages: 0, // filled in by status polling
      estimatedSeconds: 30,
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json(
      { ok: false, error: err.message || 'Combine failed.' },
      { status: 500 }
    );
  }
}

// Keep sanitizeFilename import used (reserved for future per-file validation).
void sanitizeFilename;
