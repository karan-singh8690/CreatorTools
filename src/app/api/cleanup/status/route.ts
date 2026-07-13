import { NextRequest, NextResponse } from 'next/server';
import { getJob, jobToStatus } from '@/lib/pdf-cleanup/job-store';

export const runtime = 'nodejs';

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
  return NextResponse.json(await jobToStatus(job));
}
