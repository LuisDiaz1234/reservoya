// apps/web/app/api/cron/notifications/process/route.ts
// Permite correr el outbox manualmente o desde Vercel Cron
import { NextResponse } from 'next/server';
import { processOutbox } from '@/lib/outbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || '';

  // Seguridad simple por token
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Acepta también objeto { max, onlyImmediate }; usamos 20 por batch
    const result = await processOutbox({ max: 20, onlyImmediate: true });
    // Agregamos ok:true para que el caller no falle por TypeScript
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
