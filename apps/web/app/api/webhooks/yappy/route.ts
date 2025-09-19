// apps/web/app/api/webhooks/yappy/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function verifyHash(orderId: string, status: string, domain: string, hash: string) {
  const secretB64 = process.env.YAPPY_SECRET_KEY!;
  if (!secretB64) return false;
  // Doc oficial: decodifica base64 y usa la PRIMERA parte (split('.')) como clave HMAC-SHA256
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
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId') || '';
    const status = searchParams.get('status') || '';
    const hash = searchParams.get('hash') || '';
    const domain = searchParams.get('domain') || '';
    const confirmationNumber = searchParams.get('confirmationNumber') || null;

    if (!orderId || !status || !hash || !domain) {
      return NextResponse.json({ ok: false, error: 'params inválidos' }, { status: 400 });
    }
    if (!verifyHash(orderId, status, domain, hash)) {
      return NextResponse.json({ ok: false, error: 'firma inválida' }, { status: 401 });
    }

    // Buscar el payment por la referencia de orden guardada al crearla
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, booking_id, status')
      .eq('provider', 'YAPPY')
      .eq('external_reference', orderId)
      .maybeSingle();

    if (!payment) {
      // Idempotente: no rompemos, registramos y devolvemos ok
      await supabaseAdmin.from('events').insert({
        workspace_id: null,
        source: 'webhook',
        type: 'yappy.ipn.not_found',
        payload: { orderId, status, domain }
      });
      return NextResponse.json({ ok: true, note: 'payment no encontrado' });
    }

    // Mapear estados: E=Ejecutado (pagado), R=Rechazado, C=Cancelado, X=Expirado
    if (status === 'E') {
      if (payment.status !== 'PAID') {
        await supabaseAdmin.rpc('mark_payment_paid', {
          p_payment_id: payment.id,
          p_external_payment_id: confirmationNumber || orderId,
          p_raw_payload: { query: Object.fromEntries(searchParams.entries()) }
        });
      }
    } else {
      // Para otros estados solo registramos evento
      await supabaseAdmin.from('events').insert({
        workspace_id: null,
        source: 'webhook',
        type: 'yappy.ipn',
        payload: { orderId, status, domain }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
