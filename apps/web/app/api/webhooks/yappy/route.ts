// apps/web/app/api/webhooks/yappy/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Firma HMAC: sha256( secretKeyPart + (orderId + status + domain) )
function verifyHash(orderId: string, status: string, domain: string, hash: string) {
  const secretB64 = process.env.YAPPY_SECRET_KEY!;
  if (!secretB64) return false;
  const decoded = Buffer.from(secretB64, 'base64').toString('utf-8');
  const key = decoded.split('.')[0];
  const signature = crypto.createHmac('sha256', key).update(orderId + status + domain).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Yappy puede enviar orderId o ozxId (según flujo)
  const orderId = (searchParams.get('orderId') || searchParams.get('ozxId') || '').trim();
  const status = (searchParams.get('status') || '').trim().toUpperCase();
  const hash = (searchParams.get('hash') || '').trim();
  const domain = (searchParams.get('domain') || '').trim();
  const confirmationNumber = (searchParams.get('confirmationNumber') || '').trim();

  const basePayload = { orderId, status, domain, confirmationNumber, raw: Object.fromEntries(searchParams.entries()) };

  // Validación básica
  if (!orderId || !status || !hash || !domain) {
    await supabaseAdmin.from('events').insert({
      workspace_id: null, source: 'webhook', type: 'yappy.ipn.bad_request', payload: basePayload
    });
    return NextResponse.json({ ok: false, error: 'params inválidos' }, { status: 400 });
  }

  const verified = verifyHash(orderId, status, domain, hash);
  await supabaseAdmin.from('events').insert({
    workspace_id: null, source: 'webhook', type: 'yappy.ipn.received', payload: { ...basePayload, verified }
  });

  if (!verified) {
    return NextResponse.json({ ok: false, error: 'firma inválida' }, { status: 401 });
  }

  // Buscar el payment por external_reference = orderId/ozxId
  const { data: payment, error: pErr } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, status, workspace_id')
    .eq('provider', 'YAPPY')
    .eq('external_reference', orderId)
    .maybeSingle();

  if (pErr || !payment) {
    await supabaseAdmin.from('events').insert({
      workspace_id: null, source: 'webhook', type: 'yappy.ipn.not_found', payload: { ...basePayload, db_error: pErr?.message }
    });
    return NextResponse.json({ ok: true, note: 'payment no encontrado' });
  }

  // Solo marcamos pagado cuando status = E (Ejecutado)
  if (status === 'E') {
    const { error: rpcErr } = await supabaseAdmin.rpc('mark_payment_paid', {
      p_payment_id: payment.id,
      p_external_payment_id: confirmationNumber || orderId,
      p_raw_payload: basePayload
    });

    if (rpcErr) {
      await supabaseAdmin.from('events').insert({
        workspace_id: payment.workspace_id || null,
        source: 'webhook',
        type: 'webhook.mark_payment_paid.error',
        payload: { ...basePayload, rpc_error: rpcErr.message, payment_id: payment.id }
      });
      return NextResponse.json({ ok: false, error: 'rpc error', detail: rpcErr.message }, { status: 500 });
    }

    await supabaseAdmin.from('events').insert({
      workspace_id: payment.workspace_id || null,
      source: 'webhook',
      type: 'webhook.mark_payment_paid.ok',
      payload: { ...basePayload, payment_id: payment.id }
    });
  } else {
    await supabaseAdmin.from('events').insert({
      workspace_id: payment.workspace_id || null,
      source: 'webhook',
      type: `yappy.ipn.status_${status}`,
      payload: basePayload
    });
  }

  return NextResponse.json({ ok: true });
}
