/**
 * Utilities: temp working dir, filename sanitization, safe child-process
 * spawning, and PDF page rendering via Poppler (pdftoppm) + sharp.
 */
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

const execFileP = promisify(execFile);

const TMP_ROOT = path.join(os.tmpdir(), 'creatortools-cleanup');
const JOBS_ROOT = path.join(process.cwd(), 'uploads', 'cleanup');

export async function ensureDirs() {
  await fs.mkdir(TMP_ROOT, { recursive: true });
  await fs.mkdir(JOBS_ROOT, { recursive: true });
}

/** Create a unique temp job dir; caller must clean it up. */
export async function createJobDir(prefix = 'job'): Promise<string> {
  await ensureDirs();
  const dir = path.join(TMP_ROOT, `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function rmrf(p: string) {
  try {
    await fs.rm(p, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/** Sanitize a user-supplied filename into something safe to store/serve. */
export function sanitizeFilename(name: string): string {
  const base = path.basename(name || 'document.pdf');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

/** Persist an uploaded PDF to the job dir, return the local path. */
export async function saveUpload(buf: Buffer, originalName: string, jobDir: string): Promise<string> {
  const safe = sanitizeFilename(originalName).replace(/\.pdf$/i, '') || 'document';
  const dest = path.join(jobDir, `${safe}.pdf`);
  await fs.writeFile(dest, buf);
  return dest;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** Run a child process with a hard timeout; rejects on non-zero exit. */
export async function run(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; cwd?: string } = {}
): Promise<ExecResult> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  try {
    const { stdout, stderr } = await execFileP(cmd, args, {
      cwd: opts.cwd,
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, OMP_NUM_THREADS: '2' },
    });
    return { stdout: stdout.toString(), stderr: stderr.toString(), code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; signal?: string; message: string };
    const code = typeof e.code === 'number' ? e.code : -1;
    const msg = `Command '${cmd}' failed (code ${code}, signal ${e.signal ?? 'n/a'}): ${e.message}`;
    const er: ExecResult = {
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? msg,
      code,
    };
    throw Object.assign(new Error(msg), { result: er });
  }
}

// ─── PDF page rendering ──────────────────────────────────────────────────────

/** Get page count + page sizes using pdfinfo (fast). */
export interface PdfInfo {
  pageCount: number;
  encrypted: boolean;
  pageSize: { width: number; height: number } | null;
  fileSize: number;
}

export async function getPdfInfo(file: string): Promise<PdfInfo> {
  const { stdout } = await run('pdfinfo', [file]);
  const lines = stdout.split('\n');
  const get = (k: string) => lines.find((l) => l.startsWith(k))?.split(':').slice(1).join(':').trim();
  const pageCount = parseInt(get('Pages') ?? '0', 10) || 0;
  const encrypted = (get('Encrypted') ?? '').toLowerCase().includes('yes');
  let pageSize: { width: number; height: number } | null = null;
  const sizeStr = get('Page size');
  if (sizeStr) {
    // e.g. "612 x 792 pts (letter)"
    const m = sizeStr.match(/([\d.]+)\s*x\s*([\d.]+)/);
    if (m) pageSize = { width: parseFloat(m[1]), height: parseFloat(m[2]) };
  }
  const stat = await fs.stat(file);
  return { pageCount, encrypted, pageSize, fileSize: stat.size };
}

/**
 * Render a range of PDF pages to PNG using Poppler's pdftoppm.
 * Returns the list of generated PNG file paths (sorted by page).
 */
export async function renderPagesToPng(
  file: string,
  outDir: string,
  opts: { dpi?: number; first?: number; last?: number; prefix?: string } = {}
): Promise<string[]> {
  const dpi = opts.dpi ?? 200;
  const first = opts.first ?? 1;
  const last = opts.last ?? 0; // 0 = all
  const prefix = opts.prefix ?? 'page';
  const outPrefix = path.join(outDir, prefix);
  const args = ['-png', '-r', String(dpi), '-f', String(first)];
  if (last > 0) args.push('-l', String(last));
  args.push(file, outPrefix);
  await run('pdftoppm', args, { timeoutMs: 180_000 });
  // pdftoppm names files page-1.png .. page-10.png (zero-padded to max width)
  const entries = await fs.readdir(outDir);
  const pngs = entries
    .filter((f) => f.startsWith(prefix + '-') && f.endsWith('.png'))
    .sort((a, b) => {
      const na = parseInt(a.match(/-(\d+)\.png$/)?.[1] ?? '0', 10);
      const nb = parseInt(b.match(/-(\d+)\.png$/)?.[1] ?? '0', 10);
      return na - nb;
    })
    .map((f) => path.join(outDir, f));
  return pngs;
}

/** Compute the average brightness (0..255) of an image, cheaply. */
export async function avgBrightness(pngFile: string): Promise<number> {
  const { data, info } = await sharp(pngFile)
    .resize(64, 64, { fit: 'inside' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return Math.round(sum / Math.max(1, data.length));
}

export async function imageSize(pngFile: string): Promise<{ width: number; height: number }> {
  const meta = await sharp(pngFile).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}
