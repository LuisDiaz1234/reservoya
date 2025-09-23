// apps/web/app/api/tools/create-service/test/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') ?? '';
  const ok = key === process.env.CRON_SECRET;
  return NextResponse.json({ ok, method: 'GET' }, { status: ok ? 200 : 401 });
}
