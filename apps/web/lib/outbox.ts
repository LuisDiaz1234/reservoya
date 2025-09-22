// apps/web/lib/outbox.ts
import { supabaseAdmin } from './supabaseAdmin';
import { normalizePA } from './phone';
import { sendWhatsApp } from './twilio';

type OutboxRow = {
  id: string;
  workspace_id: string;
  to_phone: string | null;
  template: string | null;
  body: string | null;
  payload: any; // jsonb
  status: string;
  attempts: number;
  scheduled_at: string | null;
};

const MAX_ATTEMPTS = 5;

export async function enqueueNotification(args: {
  workspace_id: string;
  to: string;
  template: string;
  body: string;
  payload?: any;
  scheduledAt?: string; // ISO
}) {
  const normalized = normalizePA(args.to);
  if (!normalized || normalized.replace('whatsapp:', '').trim().length < 6) {
    throw new Error('Invalid destination phone');
  }
  const toNorm = normalized.replace('whatsapp:', '');

  const insert = {
    workspace_id: args.workspace_id,
    to_phone: toNorm,
    template: args.template,
    body: args.body,
    payload: args.payload ?? {},
    status: 'PENDING',
    scheduled_at: args.scheduledAt ?? new Date().toISOString()
  };
  const { error } = await supabaseAdmin.from('notification_outbox').insert(insert);
  if (error) throw new Error(error.message);
}

type ProcessOpts = {
  max?: number;
  onlyImmediate?: boolean; // ignorado; filtramos por scheduled_at <= now
  onlyBookingId?: string;  // filtra payload.booking_id == X
  workspaceId?: string;    // filtra por workspace_id
};

export async function processOutboxBatch(
  limit = 20,
  filters?: { onlyBookingId?: string; workspaceId?: string }
) {
  const nowIso = new Date().toISOString();

  let qb = supabaseAdmin
    .from('notification_outbox')
    .select('id, workspace_id, to_phone, template, body, payload, status, attempts, scheduled_at')
    .eq('status', 'PENDING')
    .lte('scheduled_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (filters?.workspaceId) {
    qb = qb.eq('workspace_id', filters.workspaceId);
  }
  if (filters?.onlyBookingId) {
    // requiere payload con { booking_id: '...' }
    qb = qb.contains('payload', { booking_id: filters.onlyBookingId });
  }

  const { data: rows, error } = await qb;
  if (error) throw new Error(error.message);

  let sent = 0, retried = 0, dead = 0;

  for (const r of (rows ?? []) as OutboxRow[]) {
    const to = (r.to_phone || '').trim();
    const body = (r.body || '').trim();

    if (!to || !body) {
      await supabaseAdmin
        .from('notification_outbox')
        .update({
          status: 'DEAD',
          attempts: (r.attempts || 0) + 1,
          error: 'missing to/body',
          updated_at: new Date().toISOString()
        })
        .eq('id', r.id);
      dead++;
      continue;
    }

    try {
      await sendWhatsApp({ to, body });
      await supabaseAdmin
        .from('notification_outbox')
        .update({
          status: 'SENT',
          attempts: (r.attempts || 0) + 1,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', r.id);
      sent++;
    } catch (e: any) {
      const attempts = (r.attempts || 0) + 1;
      const isDead = attempts >= MAX_ATTEMPTS;
      await supabaseAdmin
        .from('notification_outbox')
        .update({
          status: isDead ? 'DEAD' : 'RETRY',
          attempts,
          error: String(e?.message || e),
          scheduled_at: isDead ? r.scheduled_at : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', r.id);
      if (isDead) dead++; else retried++;
    }
  }

  return { processed: rows?.length || 0, sent, retried, dead };
}

/**
 * Compatibilidad: acepta número (límite) o { max, onlyImmediate, onlyBookingId, workspaceId }.
 */
export async function processOutbox(arg?: number | ProcessOpts) {
  if (typeof arg === 'number') {
    return processOutboxBatch(arg);
  }
  const max = arg?.max ?? 20;
  const filters = {
    onlyBookingId: arg?.onlyBookingId,
    workspaceId: arg?.workspaceId,
  };
  return processOutboxBatch(max, filters);
}
