// apps/web/app/api/webhooks/yappy/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  const orderId = searchParams.get('orderId') || '';
  const status = searchParams.get('status') || '';
  const hash = searchParams.get('hash') || '';
  const domain = searchParams.get('domain') || '';

  const basePayload = { orderId, status, domain, hash_len: hash.length };

  if (!orderId || !status || !hash || !domain) {
    await supabaseAdmin.from('events').insert({
      workspace_id: null,
      source: 'webhook',
      type: 'yappy.ipn.bad_request',
      payload: basePayload
    });
    return NextResponse.json({ ok: false, error: 'params inválidos' }, { status: 400 });
  }

  const verified = verifyHash(orderId, status, domain, hash);
  await supabaseAdmin.from('events').insert({
    workspace_id: null,
    source: 'webhook',
    type: 'yappy.ipn.received',
    payload: { ...basePayload, verified }
  });

  if (!verified) {
    return NextResponse.json({ ok: false, error: 'firma inválida' }, { status: 401 });
  }

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, booking_id, status, workspace_id')
    .eq('provider', 'YAPPY')
    .eq('external_reference', orderId)
    .maybeSingle();

  if (!payment) {
    await supabaseAdmin.from('events').insert({
      workspace_id: null,
      source: 'webhook',
      type: 'yappy.ipn.not_found',
      payload: basePayload
    });
    return NextResponse.json({ ok: true, note: 'payment no encontrado' });
  }

  if (status === 'E') {
    if (payment.status !== 'PAID') {
      await supabaseAdmin.rpc('mark_payment_paid', {
        p_payment_id: payment.id,
        p_external_payment_id: orderId,
        p_raw_payload: { query: Object.fromEntries(searchParams.entries()) }
      });
    }
  } else {
    await supabaseAdmin.from('events').insert({
      workspace_id: payment.workspace_id || null,
      source: 'webhook',
      type: 'yappy.ipn.status_' + status,
      payload: basePayload
    });
  }

  return NextResponse.json({ ok: true });
}
