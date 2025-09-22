// apps/web/app/api/app/bookings/bulk/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePA } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// tratar horas sin zona como Panamá
function forcePA(iso?: string | null) {
  if (!iso) return null;
  const m = String(iso).replace('T',' ').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return new Date(iso);
  const [, y, mo, d, hh, mi, ss] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +hh + 5, +mi, +(ss || '0')));
}
const fmtPA = (iso?: string | null) =>
  forcePA(iso)?.toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short' }) ?? '';

export async function POST(req: Request) {
  const token = cookies().get('app_session')?.value || '';
  let workspace_id = '';
  try {
    const decoded = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf-8'));
    workspace_id = decoded.workspace_id;
  } catch {
    return NextResponse.json({ error: 'no-session' }, { status: 401 });
  }

  const { action, ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids vacíos' }, { status: 400 });
  if (!['confirm','cancel','remind'].includes(action)) return NextResponse.json({ error: 'acción inválida' }, { status: 400 });

  // Traer reservas a tocar
  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select('id, workspace_id, customer_phone, start_at, status, payment_status')
    .eq('workspace_id', workspace_id)
    .in('id', ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (action === 'confirm') {
    const { error: e } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'CONFIRMED' })
      .eq('workspace_id', workspace_id)
      .in('id', ids);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }

  if (action === 'cancel') {
    const { error: e } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'CANCELLED' })
      .eq('workspace_id', workspace_id)
      .in('id', ids);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });

    // WhatsApp de cancelación
    const inserts = (rows || []).flatMap(r => {
      const to = normalizePA(r.customer_phone || '');
      if (!to) return [];
      const body = `⚠️ Tu reserva ha sido cancelada.\nFecha: ${fmtPA(r.start_at)}\nSi fue un error, contáctanos para reprogramar.`;
      return [{
        workspace_id,
        to_phone: to.replace('whatsapp:',''),
        template: 'booking_cancelled',
        body,
        payload: { booking_id: r.id },
        status: 'PENDING',
        scheduled_at: new Date().toISOString()
      }];
    });
    if (inserts.length) {
      await supabaseAdmin.from('notification_outbox').insert(inserts);
    }
  }

  if (action === 'remind') {
    const inserts = (rows || []).flatMap(r => {
      const to = normalizePA(r.customer_phone || '');
      if (!to) return [];
      const body = `🔔 Recordatorio: tu reserva es el ${fmtPA(r.start_at)}.`;
      return [{
        workspace_id,
        to_phone: to.replace('whatsapp:',''),
        template: 'booking_manual_reminder',
        body,
        payload: { booking_id: r.id },
        status: 'PENDING',
        scheduled_at: new Date().toISOString()
      }];
    });
    if (inserts.length) {
      await supabaseAdmin.from('notification_outbox').insert(inserts);
    }
  }

  return NextResponse.json({ ok: true, affected: ids.length });
}
