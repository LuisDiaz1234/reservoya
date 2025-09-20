// apps/web/app/api/webhooks/yappy/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Calcula HMAC con (secretKeyPart + orderId + status + domain)
function verifyHash(idForSign: string, status: string, domain: string, hash: string) {
  const secretB64 = process.env.YAPPY_SECRET_KEY!;
  if (!secretB64) return false;
  const decoded = Buffer.from(secretB64, 'base64').toString('utf-8');
  const key = decoded.split('.')[0]; // Yappy => "secret.signature"
  const signature = crypto.createHmac('sha256', key).update(idForSign + status + domain).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Yappy puede enviar orderId o ozxId según el flujo/banco
  const orderId = (searchParams.get('orderId') || '').trim();
  const ozxId = (searchParams.get('ozxId') || '').trim();
  const idForSign = (orderId || ozxId).trim();

  const status = (searchParams.get('status') || '').trim().toUpperCase();
  const domain = (searchParams.get('domain') || '').trim();
  const hash = (searchParams.get('hash') || '').trim();
  const confirmationNumber = (searchParams.get('confirmationNumber') || '').trim();

  const payload = {
    orderId, ozxId, idForSign, status, domain, hash_len: hash.length,
    confirmationNumber,
    raw: Object.fromEntries(searchParams.entries()),
  };

  // Validación básica
  if (!idForSign || !status || !hash || !domain) {
    await supabaseAdmin.from('events').insert({
      workspace_id: null, source: 'webhook', type: 'yappy.ipn.bad_request', payload
    });
    return NextResponse.json({ ok: false, error: 'params inválidos' }, { status: 400 });
  }

  // Verificación de firma
  const verified = verifyHash(idForSign, status, domain, hash);
  await supabaseAdmin.from('events').insert({
    workspace_id: null, source: 'webhook', type: 'yappy.ipn.received', payload: { ...payload, verified }
  });
  if (!verified) {
    return NextResponse.json({ ok: false, error: 'firma inválida' }, { status: 401 });
  }

  // 1) Intento normal: buscar por external_reference = idForSign
  let paymentRes = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, workspace_id, status, created_at')
    .eq('provider', 'YAPPY')
    .eq('external_reference', idForSign)
    .maybeSingle();

  // 2) Fallback: si no se encontró, tomamos el PENDING más reciente de YAPPY
  // en los últimos 15 minutos y lo "vinculamos" actualizando external_reference.
  if ((!paymentRes.data || paymentRes.error) && status === 'E') {
    const fifteenAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const fallback = await supabaseAdmin
      .from('payments')
      .select('id, booking_id, workspace_id, status, created_at')
      .eq('provider', 'YAPPY')
      .eq('status', 'PENDING')
      .gte('created_at', fifteenAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallback.data) {
      // Vinculamos ese pago con el id que manda Yappy
      await supabaseAdmin.from('payments')
        .update({ external_reference: idForSign })
        .eq('id', fallback.data.id);
      paymentRes = fallback;
      await supabaseAdmin.from('events').insert({
        workspace_id: fallback.data.workspace_id || null,
        source: 'webhook',
        type: 'yappy.ipn.fallback.linked',
        payload: { ...payload, linked_payment_id: fallback.data.id }
      });
    }
  }

  const payment = paymentRes.data;
  if (!payment) {
    await supabaseAdmin.from('events').insert({
      workspace_id: null, source: 'webhook', type: 'yappy.ipn.not_found', payload
    });
    return NextResponse.json({ ok: true, note: 'payment no encontrado' });
  }

  // Sólo marcamos pagado con status E (Ejecutado)
  if (status !== 'E') {
    await supabaseAdmin.from('events').insert({
      workspace_id: payment.workspace_id || null,
      source: 'webhook',
      type: `yappy.ipn.status_${status}`,
      payload
    });
    return NextResponse.json({ ok: true });
  }

  try {
    // Actualiza PAYMENT
    const updPay = await supabaseAdmin
      .from('payments')
      .update({
        status: 'PAID',
        external_payment_id: confirmationNumber || idForSign,
        raw_payload: { ...(payload as any) },
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
      .select('id, booking_id, workspace_id')
      .maybeSingle();

    if (updPay.error) throw new Error(`upd payments: ${updPay.error.message}`);

    // Actualiza BOOKING vinculada
    const updBook = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'PAID',
        status: 'CONFIRMED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.booking_id);

    if (updBook.error) throw new Error(`upd bookings: ${updBook.error.message}`);

    // Eventos OK
    await supabaseAdmin.from('events').insert([
      {
        workspace_id: payment.workspace_id || null,
        source: 'webhook',
        type: 'webhook.paid.ok',
        ref: payment.id,
        payload
      },
      {
        workspace_id: payment.workspace_id || null,
        source: 'webhook',
        type: 'booking.confirmed',
        ref: payment.booking_id,
        payload: { orderId: idForSign, confirmationNumber }
      }
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    await supabaseAdmin.from('events').insert({
      workspace_id: payment.workspace_id || null,
      source: 'webhook',
      type: 'webhook.paid.error',
      payload: { ...payload, error: e?.message || String(e), payment_id: payment.id }
    });
    return NextResponse.json({ ok: false, error: 'update failed' }, { status: 500 });
  }
}
