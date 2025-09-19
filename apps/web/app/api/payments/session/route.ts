// apps/web/app/api/payments/session/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function moneyFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}
function shortOrderId(fromUuid: string) {
  return 'B' + fromUuid.replace(/-/g, '').slice(0, 14); // máx 15 chars
}

export async function POST(req: Request) {
  try {
    const { bookingId } = await req.json() as { bookingId: string };

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId requerido' }, { status: 400 });
    }

    // 1) Traer booking para conocer depósito
    const { data: booking, error: be } = await supabaseAdmin
      .from('bookings')
      .select('id, workspace_id, customer_name, customer_phone, start_at, status, deposit_cents, currency')
      .eq('id', bookingId)
      .single();

    if (be || !booking) {
      return NextResponse.json({ error: 'booking no encontrada' }, { status: 404 });
    }
    if (!booking.deposit_cents || booking.deposit_cents <= 0) {
      return NextResponse.json({ error: 'booking sin depósito definido' }, { status: 400 });
    }

    // 2) Crear payment PENDING
    const { data: payment, error: pe } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id: booking.id,
        workspace_id: booking.workspace_id,
        amount_cents: booking.deposit_cents,
        status: 'PENDING',
        provider: 'YAPPY',
        raw_payload: null
      })
      .select()
      .single();

    if (pe || !payment) {
      return NextResponse.json({ error: 'no se pudo crear payment' }, { status: 500 });
    }

    // 3) Llamadas a Yappy
    const API_BASE = process.env.YAPPY_API_BASE!;
    const merchantId = process.env.YAPPY_MERCHANT_ID!;
    const domain = process.env.YAPPY_DOMAIN || process.env.APP_BASE_URL!;
    const baseUrl = process.env.APP_BASE_URL!;

    if (!API_BASE || !merchantId || !domain || !baseUrl) {
      return NextResponse.json({ error: 'Yappy no está configurado en variables de entorno' }, { status: 500 });
    }

    // Paso 1: validar comercio -> obtener token
    const vRes = await fetch(`${API_BASE}/payments/validate/merchant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, urlDomain: domain }),
      cache: 'no-store',
    });
    const vJson = await vRes.json();
    const token = vJson?.body?.token as string | undefined;
    if (!token) {
      return NextResponse.json({ error: 'No se obtuvo token de Yappy', detail: vJson }, { status: 502 });
    }

    // Paso 2: crear orden
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
      subtotal: moneyFromCents(booking.deposit_cents),
      total: moneyFromCents(booking.deposit_cents)
    };

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
    const body = oJson?.body;
    if (!body?.transactionId || !body?.token || !body?.documentName) {
      return NextResponse.json({ error: 'No se pudo crear orden en Yappy', detail: oJson }, { status: 502 });
    }

    // Guardar referencia del proveedor (orderId) e info cruda
    await supabaseAdmin
      .from('payments')
      .update({ external_reference: orderId, raw_payload: oJson })
      .eq('id', payment.id);

    // Devolver info para el botón
    return NextResponse.json({
      provider: 'YAPPY',
      yappy: {
        transactionId: body.transactionId,
        token: body.token,
        documentName: body.documentName,
      },
      paymentId: payment.id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'falló session', detail: e?.message }, { status: 500 });
  }
}
