// apps/web/app/api/cron/notifications/process/route.ts
import { NextResponse } from 'next/server';
import { processOutbox } from '@/lib/outbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function assertAuth(url: URL) {
  const key = url.searchParams.get('key') || '';
  return !!process.env.CRON_SECRET && key === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!assertAuth(url)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await processOutbox({ max: 20, onlyImmediate: true });
  if (!result.ok) return NextResponse.json(result, { status: 500 });
  return NextResponse.json(result);
}
