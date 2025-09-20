import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function moneyFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}
function shortOrderId(fromUuid: string) {
  return 'B' + fromUuid.replace(/-/g, '').slice(0, 14); // ≤ 15 chars
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const bookingId = body?.bookingId as string | undefined;
    const testOneCent = Boolean(body?.testOneCent);

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId requerido' }, { status: 400 });
    }

    // 1) Traer booking con su depósito
    const { data: booking, error: be } = await supabaseAdmin
      .from('bookings')
      .select('id, workspace_id, customer_name, customer_phone, deposit_cents, currency')
      .eq('id', bookingId)
      .single();

    if (be || !booking) return NextResponse.json({ error: 'booking no encontrada' }, { status: 404 });
    if (!booking.deposit_cents || booking.deposit_cents <= 0) {
      return NextResponse.json({ error: 'booking sin depósito definido' }, { status: 400 });
    }

    // 2) Determinar el monto a cobrar
    const amountCents = testOneCent ? 1 : Number(booking.deposit_cents);

    // 3) Crear payment PENDING con ese monto
    const { data: payment, error: pe } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id: booking.id,
        workspace_id: booking.workspace_id,
        amount_cents: amountCents,
        status: 'PENDING',
        provider: 'YAPPY',
        raw_payload: { testOneCent }
      })
      .select()
      .single();

    if (pe || !payment) return NextResponse.json({ error: 'no se pudo crear payment' }, { status: 500 });

    // 4) Configuración Yappy
    const API_BASE = process.env.YAPPY_API_BASE!;
    const merchantId = process.env.YAPPY_MERCHANT_ID!;
    const domain = process.env.YAPPY_DOMAIN || process.env.APP_BASE_URL!;
    const baseUrl = process.env.APP_BASE_URL!;
    const testAlias = (process.env.YAPPY_TEST_ALIAS || '').trim(); // opcional

    if (!API_BASE || !merchantId || !domain || !baseUrl) {
      return NextResponse.json({ error: 'Yappy no está configurado en variables de entorno' }, { status: 500 });
    }

    // 5) Validar comercio → token
    const vRes = await fetch(`${API_BASE}/payments/validate/merchant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, urlDomain: domain }),
      cache: 'no-store',
    });
    const vJson = await vRes.json();
    const token = vJson?.body?.token as string | undefined;
    if (!token) {
      await supabaseAdmin.from('events').insert({
        workspace_id: booking.workspace_id,
        source: 'yappy',
        type: 'validate.error',
        payload: { vJson, merchantId, domain }
      });
      return NextResponse.json({ error: 'No se obtuvo token de Yappy', detail: vJson }, { status: 502 });
    }

    // 6) Crear orden
    const orderId = shortOrderId(payment.id);
    const ipnUrl = `${baseUrl}/api/webhooks/yappy`;

    const payload: Record<string, any> = {
      merchantId,
      orderId,
      domain,
      paymentDate: Math.floor(Date.now() / 1000),
      ipnUrl,
      discount: '0.00',
      taxes: '0.00',
      subtotal: moneyFromCents(amountCents),
      total: moneyFromCents(amountCents),
    };
    if (testAlias) payload.aliasYappy = testAlias;

    const oRes = await fetch(`${API_BASE}/payments/payment-wc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const oJson = await oRes.json();

    if (!oRes.ok || !oJson?.body?.transactionId || !oJson?.body?.token || !oJson?.body?.documentName) {
      await supabaseAdmin.from('events').insert({
        workspace_id: booking.workspace_id,
        source: 'yappy',
        type: 'order.error',
        payload: { request: payload, response: oJson }
      });
      return NextResponse.json({ error: 'No se pudo crear orden en Yappy', detail: oJson }, { status: 502 });
    }

    // 7) Guardar referencia y devolver datos al botón
    await supabaseAdmin
      .from('payments')
      .update({ external_reference: orderId, raw_payload: oJson })
      .eq('id', payment.id);

    return NextResponse.json({
      provider: 'YAPPY',
      yappy: {
        transactionId: oJson.body.transactionId,
        token: oJson.body.token,
        documentName: oJson.body.documentName,
      },
      paymentId: payment.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'falló session', detail: e?.message }, { status: 500 });
  }
}
