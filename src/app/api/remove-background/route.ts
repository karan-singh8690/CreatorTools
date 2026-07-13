import { NextRequest } from 'next/server';
import { startCleanupJob } from '@/lib/pdf-cleanup/api-helpers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return startCleanupJob(req, 'background');
}
