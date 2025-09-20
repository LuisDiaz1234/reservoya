// apps/web/app/api/webhooks/yappy/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePA } from '@/lib/phone';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function verifyHash(idForSign: string, status: string, domain: string, hash: string) {
  const secretB64 = process.env.YAPPY_SECRET_KEY!;
  if (!secretB64) return false;
  const decoded = Buffer.from(secretB64, 'base64').toString('utf-8');
  const key = decoded.split('.')[0];
  const signature = crypto.createHmac('sha256', key).update(idForSign + status + domain).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
  } catch {
    return false;
  }
}

function fmtDatePanama(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short' });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const orderId = (searchParams.get('orderId') || '').trim();
  const ozxId = (searchParams.get('ozxId') || '').trim();
  const idForSign = (orderId || ozxId).trim();

  const status = (searchParams.get('status') || '').trim().toUpperCase();
  const domain = (searchParams.get('domain') || '').trim();
  const hash = (searchParams.get('hash') || '').trim();
  const confirmationNumber = (searchParams.get('confirmationNumber') || '').trim();

  const payload = { orderId, ozxId, idForSign, status, domain, confirmationNumber, raw: Object.fromEntries(searchParams.entries()) };

  if (!idForSign || !status || !hash || !domain) {
    await supabaseAdmin.from('events').insert({ workspace_id: null, source: 'webhook', type: 'yappy.ipn.bad_request', payload });
    return NextResponse.json({ ok: false, error: 'params inválidos' }, { status: 400 });
  }

  const verified = verifyHash(idForSign, status, domain, hash);
  await supabaseAdmin.from('events').insert({ workspace_id: null, source: 'webhook', type: 'yappy.ipn.received', payload: { ...payload, verified } });
  if (!verified) return NextResponse.json({ ok: false, error: 'firma inválida' }, { status: 401 });

  // Buscar payment por external_reference; fallback al PENDING más reciente (<=15m)
  let { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, workspace_id, status, created_at')
    .eq('provider', 'YAPPY')
    .eq('external_reference', idForSign)
    .maybeSingle();

  if (!payment && status === 'E') {
    const fifteenAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const fb = await supabaseAdmin
      .from('payments')
      .select('id, booking_id, workspace_id, status, created_at')
      .eq('provider', 'YAPPY')
      .eq('status', 'PENDING')
      .gte('created_at', fifteenAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fb.data) {
      await supabaseAdmin.from('payments').update({ external_reference: idForSign }).eq('id', fb.data.id);
      payment = fb.data;
      await supabaseAdmin.from('events').insert({
        workspace_id: fb.data.workspace_id || null, source: 'webhook', type: 'yappy.ipn.fallback.linked',
        payload: { ...payload, linked_payment_id: fb.data.id }
      });
    }
  }

  if (!payment) {
    await supabaseAdmin.from('events').insert({ workspace_id: null, source: 'webhook', type: 'yappy.ipn.not_found', payload });
    return NextResponse.json({ ok: true, note: 'payment no encontrado' });
  }

  if (status !== 'E') {
    await supabaseAdmin.from('events').insert({
      workspace_id: payment.workspace_id || null, source: 'webhook', type: `yappy.ipn.status_${status}`, payload
    });
    return NextResponse.json({ ok: true });
  }

  try {
    // 1) Marcar pago y reserva
    await supabaseAdmin.from('payments')
      .update({ status: 'PAID', external_payment_id: confirmationNumber || idForSign, raw_payload: payload })
      .eq('id', payment.id);

    // Obtener booking para mensajes
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, workspace_id, customer_phone, start_at')
      .eq('id', payment.booking_id)
      .maybeSingle();

    await supabaseAdmin.from('bookings')
      .update({ payment_status: 'PAID', status: 'CONFIRMED' })
      .eq('id', payment.booking_id);

    // 2) Encolar WhatsApp si hay teléfono
    if (booking?.customer_phone) {
      const to = normalizePA(booking.customer_phone);
      if (to) {
        const startTxt = booking.start_at ? fmtDatePanama(booking.start_at) : '';
        const bodyConfirm = `✅ Reserva confirmada.\nFecha: ${startTxt}\nGracias por reservar con ReservoYA.`;
        const now = new Date();

        // Confirmación inmediata
        await supabaseAdmin.from('notification_outbox').insert({
          workspace_id: booking.workspace_id,
          to_phone: to.replace('whatsapp:', ''), // guardamos sin el prefijo, lo agrega el cron
          template: 'booking_confirmed',
          body: bodyConfirm,
          payload: { booking_id: booking.id },
          status: 'PENDING',
          scheduled_at: now.toISOString()
        });

        // Recordatorios 24h y 3h antes (si la fecha es futura)
        if (booking.start_at) {
          const start = new Date(booking.start_at);
          const r24 = new Date(start.getTime() - 24 * 60 * 60 * 1000);
          const r3 = new Date(start.getTime() - 3 * 60 * 60 * 1000);
          const body24 = `⏰ Recordatorio: tu reserva es el ${startTxt} (24h).`;
          const body3 = `⏰ Recordatorio: tu reserva es a las ${startTxt} (3h).`;
          if (r24 > now) {
            await supabaseAdmin.from('notification_outbox').insert({
              workspace_id: booking.workspace_id, to_phone: to.replace('whatsapp:', ''),
              template: 'booking_reminder_24h', body: body24, payload: { booking_id: booking.id },
              status: 'PENDING', scheduled_at: r24.toISOString()
            });
          }
          if (r3 > now) {
            await supabaseAdmin.from('notification_outbox').insert({
              workspace_id: booking.workspace_id, to_phone: to.replace('whatsapp:', ''),
              template: 'booking_reminder_3h', body: body3, payload: { booking_id: booking.id },
              status: 'PENDING', scheduled_at: r3.toISOString()
            });
          }
        }
      }
    }

    // Eventos OK
    await supabaseAdmin.from('events').insert([
      { workspace_id: payment.workspace_id || null, source: 'webhook', type: 'webhook.paid.ok',  ref: payment.id, payload },
      { workspace_id: payment.workspace_id || null, source: 'webhook', type: 'booking.confirmed', ref: payment.booking_id, payload: { orderId: idForSign, confirmationNumber } }
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await supabaseAdmin.from('events').insert({
      workspace_id: payment.workspace_id || null, source: 'webhook', type: 'webhook.paid.error',
      payload: { ...payload, error: e?.message || String(e), payment_id: payment.id }
    });
    return NextResponse.json({ ok: false, error: 'update failed' }, { status: 500 });
  }
}
