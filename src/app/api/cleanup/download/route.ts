import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getJob } from '@/lib/pdf-cleanup/job-store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'Missing jobId.' }, { status: 400 });
  }
  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { ok: false, error: 'Job not found or expired.' },
      { status: 404 }
    );
  }
  if (job.stage !== 'complete' || !job.outputPath) {
    return NextResponse.json(
      { ok: false, error: 'Job not complete.', stage: job.stage },
      { status: 409 }
    );
  }
  try {
    const buf = await fs.readFile(job.outputPath);
    const name = job.outputName || 'cleaned.pdf';
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Output file missing.' }, { status: 410 });
  }
}

// Allow manual cleanup via DELETE
export async function DELETE(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ ok: false, error: 'Missing jobId.' }, { status: 400 });
  const { cleanupJob } = await import('@/lib/pdf-cleanup/job-store');
  await cleanupJob(jobId);
  return NextResponse.json({ ok: true });
}

// keep path import for potential future use
void path;
