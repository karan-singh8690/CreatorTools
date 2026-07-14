/**
 * Shared helpers for the cleanup API routes: multipart parsing, option
 * parsing, job creation, and the common "start a cleanup job" flow.
 */
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { createJobDir, saveUpload, sanitizeFilename, assertSystemBinaries } from '@/lib/pdf-cleanup/utils';
import { createJob, updateJob } from '@/lib/pdf-cleanup/job-store';
import { runCleanup } from '@/lib/pdf-cleanup';
import { CleanupOptions, CleanupMode, DEFAULT_OPTIONS } from '@/lib/pdf-cleanup/types';

const MAX_FILE_BYTES = 500 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf'];
const ALLOWED_EXT = /\.pdf$/i;

export interface ParsedUpload {
  buf: Buffer;
  originalName: string;
  options: CleanupOptions;
}

/** Parse a multipart form with `file` (PDF) + optional `options` (JSON). */
export async function parseCleanupForm(req: NextRequest): Promise<ParsedUpload> {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw Object.assign(new Error('No file uploaded. Use field name "file".'), { code: 'NO_FILE' });
  }
  if (file.size > MAX_FILE_BYTES) {
    throw Object.assign(new Error(`File too large (${file.size} bytes). Max ${MAX_FILE_BYTES}.`), {
      code: 'TOO_LARGE',
    });
  }
  // Validate MIME / extension
  const isPdfMime = ALLOWED_MIME.includes(file.type) || file.type === '';
  const isPdfExt = ALLOWED_EXT.test(file.name);
  if (!isPdfMime && !isPdfExt) {
    throw Object.assign(new Error('Only PDF files are supported.'), { code: 'BAD_TYPE' });
  }
  // Validate PDF magic bytes
  const buf = Buffer.from(await file.arrayBuffer());
  if (!buf.slice(0, 5).toString('latin1').startsWith('%PDF')) {
    throw Object.assign(new Error('File does not appear to be a valid PDF.'), { code: 'BAD_PDF' });
  }

  // Parse options JSON if present; merge with defaults.
  let options: CleanupOptions = { ...DEFAULT_OPTIONS };
  const rawOpts = form.get('options');
  if (rawOpts && typeof rawOpts === 'string') {
    try {
      const parsed = JSON.parse(rawOpts) as Partial<CleanupOptions>;
      options = { ...DEFAULT_OPTIONS, ...parsed };
    } catch {
      throw Object.assign(new Error('Invalid options JSON.'), { code: 'BAD_OPTIONS' });
    }
  }

  return { buf, originalName: sanitizeFilename(file.name), options };
}

/**
 * Start a cleanup job: save upload, create job record, kick off background
 * processing (fire-and-forget), return the job descriptor.
 *
 * `forceMode` (when set) overrides options.mode — this is how the three
 * mode-specific endpoints (/api/remove-background, /api/remove-watermark,
 * /api/clean-scan) enforce their mode while still accepting full options.
 */
export async function startCleanupJob(
  req: NextRequest,
  forceMode?: CleanupMode
): Promise<NextResponse> {
  // Verify system binaries (gs, tesseract, poppler, qpdf) are installed.
  // On Vercel they're not — return a clear message instead of ENOENT.
  try {
    await assertSystemBinaries();
  } catch (e) {
    const err = e as Error & { code?: string };
    return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 503 });
  }

  let parsed: ParsedUpload;
  try {
    parsed = await parseCleanupForm(req);
  } catch (e) {
    const err = e as Error & { code?: string };
    const status = err.code === 'NO_FILE' ? 400 : err.code === 'TOO_LARGE' ? 413 : 400;
    return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status });
  }

  const options = forceMode ? { ...parsed.options, mode: forceMode } : parsed.options;

  const job = await createJob(parsed.originalName, parsed.buf.length);
  const jobDir = await createJobDir('cleanup');
  const uploadPath = await saveUpload(parsed.buf, parsed.originalName, jobDir);

  // Persist the original path so the TTL sweeper can clean it up later.
  await updateJob(job.id, { originalPath: uploadPath });

  // Fire-and-forget background processing.
  runCleanup({ jobId: job.id, originalPath: uploadPath, options }).catch(async (err) => {
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
    totalPages: 0, // filled in by status polling once analysis completes
    estimatedSeconds: 30,
  });
}

/** Helper to ensure the uploads/cleanup dir exists (idempotent). */
export async function ensureUploadDir() {
  await fs.mkdir(path.join(process.cwd(), 'uploads', 'cleanup'), { recursive: true });
}
