// apps/web/app/api/cron/notifications/process/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTwilioClient } from '@/lib/twilio';
import { normalizePA } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_PER_RUN = 20;
const MAX_ATTEMPTS = 3;

function assertAuth(url: URL) {
  const key = url.searchParams.get('key') || '';
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return false;
  }
  return true;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!assertAuth(url)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Toma mensajes pendientes cuyo scheduled_at <= ahora
  const { data: rows, error } = await supabaseAdmin
    .from('notification_outbox')
    .select('id, workspace_id, to_phone, body, template, payload, attempts')
    .eq('status', 'PENDING')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, taken: 0, sent: 0, retried: 0, dead: 0 });
  }

  const client = getTwilioClient();
  const from = process.env.TWILIO_WHATSAPP_FROM!;
  let sent = 0, retried = 0, dead = 0;

  for (const msg of rows) {
    const to = normalizePA(msg.to_phone || '');
    if (!to) {
      // Sin teléfono: márcalo como DEAD y registra error
      await supabaseAdmin.from('notification_outbox')
        .update({ status: 'DEAD', error: 'missing to_phone' })
        .eq('id', msg.id);
      dead++;
      continue;
    }
    try {
      await client.messages.create({
        from,
        to,
        body: msg.body || 'Notificación'
      });
      await supabaseAdmin.from('notification_outbox')
        .update({ status: 'SENT', error: null })
        .eq('id', msg.id);
      sent++;
    } catch (e: any) {
      const attempts = (msg.attempts ?? 0) + 1;
      const newStatus = attempts >= MAX_ATTEMPTS ? 'DEAD' : 'RETRY';
      await supabaseAdmin.from('notification_outbox')
        .update({ status: newStatus, attempts, error: e?.message || String(e) })
        .eq('id', msg.id);
      if (newStatus === 'DEAD') dead++; else retried++;
    }
  }

  return NextResponse.json({ ok: true, taken: rows.length, sent, retried, dead });
}
