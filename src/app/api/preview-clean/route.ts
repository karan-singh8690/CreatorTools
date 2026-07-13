import { NextRequest, NextResponse } from 'next/server';
import { generatePreview } from '@/lib/pdf-cleanup';
import { DEFAULT_OPTIONS, CleanupOptions } from '@/lib/pdf-cleanup/types';
import { sanitizeFilename } from '@/lib/pdf-cleanup/utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file uploaded.' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (!buf.slice(0, 5).toString('latin1').startsWith('%PDF')) {
      return NextResponse.json({ ok: false, error: 'Not a valid PDF.' }, { status: 400 });
    }
    const pageRaw = Number(form.get('page') ?? 1);
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;

    let options: CleanupOptions = { ...DEFAULT_OPTIONS };
    const rawOpts = form.get('options');
    if (rawOpts && typeof rawOpts === 'string') {
      try {
        options = { ...DEFAULT_OPTIONS, ...JSON.parse(rawOpts) };
      } catch {
        /* ignore */
      }
    }

    const result = await generatePreview(buf, sanitizeFilename(file.name), page, options);
    return NextResponse.json({ ok: true, ...result, page });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
