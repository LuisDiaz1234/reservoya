// apps/web/app/api/webhooks/yappy/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const orderId = (searchParams.get('orderId') || '').trim();
  const ozxId = (searchParams.get('ozxId') || '').trim();
  const idForSign = (orderId || ozxId).trim();

  const status = (searchParams.get('status') || '').trim().toUpperCase();
  const domain = (searchParams.get('domain') || '').trim();
  const hash = (searchParams.get('hash') || '').trim();
  const confirmationNumber = (searchParams.get('confirmationNumber') || '').trim();

  const payload = {
    orderId, ozxId, idForSign, status, domain, confirmationNumber,
    raw: Object.fromEntries(searchParams.entries())
  };

  if (!idForSign || !status || !hash || !domain) {
    await supabaseAdmin.from('events').insert({
      workspace_id: null, source: 'webhook', type: 'yappy.ipn.bad_request', payload
    });
    return NextResponse.json({ ok: false, error: 'params inválidos' }, { status: 400 });
  }

  const verified = verifyHash(idForSign, status, domain, hash);
  await supabaseAdmin.from('events').insert({
    workspace_id: null, source: 'webhook', type: 'yappy.ipn.received', payload: { ...payload, verified }
  });
  if (!verified) return NextResponse.json({ ok: false, error: 'firma inválida' }, { status: 401 });

  // 1) Busca el payment por external_reference = idForSign
  let { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, workspace_id, status, created_at')
    .eq('provider', 'YAPPY')
    .eq('external_reference', idForSign)
    .maybeSingle();

  // 2) Fallback: si no existe y status=E, asociar al PENDING más reciente (≤15m)
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
        workspace_id: fb.data.workspace_id || null,
        source: 'webhook', type: 'yappy.ipn.fallback.linked',
        payload: { ...payload, linked_payment_id: fb.data.id }
      });
    }
  }

  if (!payment) {
    await supabaseAdmin.from('events').insert({
      workspace_id: null, source: 'webhook', type: 'yappy.ipn.not_found', payload
    });
    return NextResponse.json({ ok: true, note: 'payment no encontrado' });
  }

  if (status !== 'E') {
    await supabaseAdmin.from('events').insert({
      workspace_id: payment.workspace_id || null,
      source: 'webhook', type: `yappy.ipn.status_${status}`, payload
    });
    return NextResponse.json({ ok: true });
  }

  try {
    // Actualiza PAYMENT (sin tocar updated_at explícito)
    const updPay = await supabaseAdmin
      .from('payments')
      .update({
        status: 'PAID',
        external_payment_id: confirmationNumber || idForSign,
        raw_payload: { ...(payload as any) }
      })
      .eq('id', payment.id)
      .select('id, booking_id, workspace_id')
      .maybeSingle();
    if (updPay.error) throw new Error(`upd payments: ${updPay.error.message}`);

    // Actualiza BOOKING
    const updBook = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'PAID',
        status: 'CONFIRMED'
      })
      .eq('id', payment.booking_id);
    if (updBook.error) throw new Error(`upd bookings: ${updBook.error.message}`);

    await supabaseAdmin.from('events').insert([
      { workspace_id: payment.workspace_id || null, source: 'webhook', type: 'webhook.paid.ok',  ref: payment.id, payload },
      { workspace_id: payment.workspace_id || null, source: 'webhook', type: 'booking.confirmed', ref: payment.booking_id, payload: { orderId: idForSign, confirmationNumber } }
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await supabaseAdmin.from('events').insert({
      workspace_id: payment.workspace_id || null,
      source: 'webhook', type: 'webhook.paid.error',
      payload: { ...payload, error: e?.message || String(e), payment_id: payment.id }
    });
    return NextResponse.json({ ok: false, error: 'update failed' }, { status: 500 });
  }
}
