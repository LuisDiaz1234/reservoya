// apps/web/app/api/payments/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { yappyValidateMerchant, yappyCreateOrder, normalizePaPhone } from '@/lib/yappy';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function buildOrigin(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host')!;
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => null);
    if (!payload || !payload.bookingId) {
      return NextResponse.json({ ok: false, error: 'payload inválido' }, { status: 400 });
    }
    const bookingId: string = String(payload.bookingId);

    const admin = getSupabaseAdmin();

    const { data: booking, error: eB } = await admin
      .from('bookings')
      .select('id, workspace_id, service_id, provider_id, customer_phone, status, start_at')
      .eq('id', bookingId)
      .single();
    if (eB || !booking) throw { message: 'booking no existe', details: eB?.message };

    const { data: ws, error: eW } = await admin
      .from('workspaces')
      .select('id, slug')
      .eq('id', booking.workspace_id)
      .single();
    if (eW || !ws) throw { message: 'workspace no existe', details: eW?.message };

    const { data: service, error: eS } = await admin
      .from('services')
      .select('price_cents, deposit_type, deposit_amount_cents, deposit_percent')
      .eq('id', booking.service_id)
      .single();
    if (eS || !service) throw { message: 'service no existe', details: eS?.message };

    let depositCents = 1;
    if (service.deposit_type === 'PERCENT') {
      depositCents = Math.max(1, Math.round((service.price_cents * (service.deposit_percent || 0)) / 100));
    } else {
      depositCents = Math.max(1, service.deposit_amount_cents || 1);
    }
    const totalStr = (depositCents / 100).toFixed(2);

    const aliasYappy = normalizePaPhone(booking.customer_phone || '');
    if (!aliasYappy) throw { message: 'aliasYappy vacío (teléfono cliente)' };

    const origin = buildOrigin(req);
    const { token, urlDomain } = await yappyValidateMerchant(origin);

    const short = String(bookingId).replace(/-/g, '').slice(0, 13);
    const orderId = `BK${short}`;
    const ipnUrl = `${origin}/api/webhooks/yappy?orderId=${orderId}&workspace=${ws.slug}`;

    const created = await yappyCreateOrder({
      token,
      orderId,
      domain: urlDomain,
      aliasYappy,
      total: totalStr,
      ipnUrl,
    });

    await admin.from('payments').upsert({
      booking_id: bookingId,
      workspace_id: booking.workspace_id,
      provider: 'YAPPY',
      external_id: created.transactionId,
      amount_cents: depositCents,
      status: 'PENDING',
    }, { onConflict: 'booking_id' });

    return NextResponse.json({
      ok: true,
      yappy: {
        transactionId: created.transactionId,
        token: created.token,
        documentName: created.documentName,
      },
    });
  } catch (err: any) {
    // Pasamos detalle exacto para ver en Network (step/status/body o message/details).
    return NextResponse.json(
      { ok: false, error: 'no se pudo iniciar yappy', detail: err?.step ? err : (err?.message || err) },
      { status: 400 }
    );
  }
}
