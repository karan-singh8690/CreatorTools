import { NextRequest, NextResponse } from 'next/server';
import { createJobDir, saveUpload, getPdfInfo, sanitizeFilename, assertSystemBinaries } from '@/lib/pdf-cleanup/utils';
import { analyzePdf } from '@/lib/pdf-cleanup/detect';
import { createJob, updateJob } from '@/lib/pdf-cleanup/job-store';
import { AnalyzeResponse } from '@/lib/pdf-cleanup/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Verify system binaries are available (Vercel doesn't have them).
    // Throws a clear, actionable error if missing — instead of ENOENT.
    await assertSystemBinaries();

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file uploaded.' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (!buf.slice(0, 5).toString('latin1').startsWith('%PDF')) {
      return NextResponse.json({ ok: false, error: 'Not a valid PDF.' }, { status: 400 });
    }

    const job = await createJob(sanitizeFilename(file.name), buf.length);
    const jobDir = await createJobDir('analyze');
    const uploadPath = await saveUpload(buf, file.name, jobDir);
    await updateJob(job.id, { originalPath: uploadPath });

    const detection = await analyzePdf(uploadPath);
    const res: AnalyzeResponse = { ok: true, jobId: job.id, detection };
    return NextResponse.json(res);
  } catch (e) {
    const err = e as Error & { code?: string };
    const status = err.code === 'ENCRYPTED' ? 422 : 500;
    return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status });
  }
}
