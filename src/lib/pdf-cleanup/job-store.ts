/**
 * File-based job store for async cleanup jobs.
 *
 * We persist job metadata as JSON files under uploads/cleanup/<jobId>.json
 * rather than in-memory Maps, because Next.js dev mode can give each route
 * handler a separate module instance (the Map wouldn't be shared).
 *
 * Jobs auto-expire (file + record) after 30 minutes to honor the security
 * requirement: "Delete uploaded files automatically. Never store PDFs
 * permanently."
 */
import path from 'path';
import { promises as fs } from 'fs';
import { ProgressStage } from './types';
import { rmrf } from './utils';

export interface CleanupJob {
  id: string;
  createdAt: number;
  stage: ProgressStage;
  message: string;
  currentPage?: number;
  totalPages?: number;
  percent: number;
  originalPath?: string;
  originalName: string;
  originalSizeBytes: number;
  outputPath?: string;
  outputName?: string;
  outputSizeBytes?: number;
  error?: string;
  resultUrl?: string;
}

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const JOBS_DIR = path.join(process.cwd(), 'uploads', 'cleanup');

async function ensureJobsDir() {
  await fs.mkdir(JOBS_DIR, { recursive: true });
}

function jobFile(id: string): string {
  return path.join(JOBS_DIR, `${id}.json`);
}

/** Read a job from disk. Returns undefined if missing/expired. */
export async function getJob(id: string): Promise<CleanupJob | undefined> {
  try {
    const raw = await fs.readFile(jobFile(id), 'utf8');
    const job = JSON.parse(raw) as CleanupJob;
    if (Date.now() - job.createdAt > TTL_MS) {
      void cleanupJob(job.id);
      return undefined;
    }
    return job;
  } catch {
    return undefined;
  }
}

export async function createJob(originalName: string, originalSizeBytes: number): Promise<CleanupJob> {
  await ensureJobsDir();
  const id = `cln-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const job: CleanupJob = {
    id,
    createdAt: Date.now(),
    stage: 'queued',
    message: 'Queued for processing',
    percent: 0,
    originalName,
    originalSizeBytes,
  };
  await fs.writeFile(jobFile(id), JSON.stringify(job, null, 2));
  return job;
}

/** Update a job by merging a patch and persisting. */
export async function updateJob(id: string, patch: Partial<CleanupJob>): Promise<void> {
  const job = await getJob(id);
  if (!job) return;
  Object.assign(job, patch);
  try {
    await fs.writeFile(jobFile(id), JSON.stringify(job, null, 2));
  } catch {
    /* ignore write errors */
  }
}

/** Update progress fields and persist. */
export async function updateProgress(
  id: string,
  p: { stage: ProgressStage; message: string; currentPage?: number; totalPages?: number; percent: number }
): Promise<void> {
  await updateJob(id, {
    stage: p.stage,
    message: p.message,
    currentPage: p.currentPage,
    totalPages: p.totalPages,
    percent: Math.max(0, Math.min(100, p.percent)),
  });
}

/** Delete the job and its files immediately. */
export async function cleanupJob(id: string): Promise<void> {
  const job = await getJob(id);
  if (job) {
    if (job.originalPath) await rmrf(path.dirname(job.originalPath));
    if (job.outputPath && job.outputPath !== job.originalPath) {
      try {
        await fs.unlink(job.outputPath);
      } catch {
        /* ignore */
      }
    }
  }
  try {
    await fs.unlink(jobFile(id));
  } catch {
    /* ignore */
  }
}

/** Periodic sweep of expired jobs. */
export async function sweepExpired(): Promise<void> {
  try {
    const entries = await fs.readdir(JOBS_DIR);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const id = entry.replace(/\.json$/, '');
      const job = await getJob(id);
      if (job && now - job.createdAt > TTL_MS) {
        await cleanupJob(id);
      }
    }
  } catch {
    /* ignore */
  }
}

export async function jobToStatus(job: CleanupJob) {
  return {
    ok: true,
    jobId: job.id,
    stage: job.stage,
    message: job.message,
    currentPage: job.currentPage,
    totalPages: job.totalPages,
    percent: job.percent,
    resultUrl: job.resultUrl,
    error: job.error,
    outputFileName: job.outputName,
    outputSizeBytes: job.outputSizeBytes,
    originalSizeBytes: job.originalSizeBytes,
    reductionPercent:
      job.outputSizeBytes && job.originalSizeBytes
        ? Math.round((1 - job.outputSizeBytes / job.originalSizeBytes) * 100)
        : undefined,
  };
}

import { fileSize as _fileSize } from './rebuild';
export const fileSize = _fileSize;
