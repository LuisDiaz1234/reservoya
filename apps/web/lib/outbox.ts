// apps/web/lib/outbox.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTwilioClient } from '@/lib/twilio';
import { normalizePA } from '@/lib/phone';

type ProcessParams = {
  max?: number;
  onlyBookingId?: string;   // procesa solo mensajes de esa booking
  onlyImmediate?: boolean;  // solo scheduled_at <= ahora
};

export async function processOutbox(params: ProcessParams = {}) {
  const { max = 20, onlyBookingId, onlyImmediate = true } = params;

  // Traemos PENDING; si onlyImmediate, limitamos a scheduled_at <= ahora
  let query = supabaseAdmin
    .from('notification_outbox')
    .select('id, workspace_id, to_phone, body, template, payload, attempts, status, scheduled_at')
    .eq('status', 'PENDING')
    .order('scheduled_at', { ascending: true })
    .limit(max);

  if (onlyImmediate) {
    query = query.lte('scheduled_at', new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) return { ok: false, taken: 0, sent: 0, retried: 0, dead: 0, error: error.message };

  // Filtrado por booking en código (simple y seguro)
  const rows = (data || []).filter(r => {
    if (!onlyBookingId) return true;
    try { return r?.payload?.booking_id === onlyBookingId; } catch { return false; }
  });

  if (rows.length === 0) return { ok: true, taken: 0, sent: 0, retried: 0, dead: 0 };

  const client = getTwilioClient();
  const from = process.env.TWILIO_WHATSAPP_FROM!;
  let sent = 0, retried = 0, dead = 0;

  for (const msg of rows) {
    const to = normalizePA(msg.to_phone || '');
    if (!to) {
      await supabaseAdmin.from('notification_outbox')
        .update({ status: 'DEAD', error: 'missing to_phone' })
        .eq('id', msg.id);
      dead++; continue;
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
      const newStatus = attempts >= 3 ? 'DEAD' : 'RETRY';
      await supabaseAdmin.from('notification_outbox')
        .update({ status: newStatus, attempts, error: e?.message || String(e) })
        .eq('id', msg.id);
      if (newStatus === 'DEAD') dead++; else retried++;
    }
  }

  return { ok: true, taken: rows.length, sent, retried, dead };
}
