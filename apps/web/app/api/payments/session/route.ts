// apps/web/app/api/payments/session/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRate } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown';
  const rate = await checkRate(ip, '/api/payments/session', 20, 60);
  if (!rate.allowed) return NextResponse.json({ error: 'Rate limit excedido.' }, { status: 429 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { bookingId, payTestOneCent } = body || {};
  if (!bookingId) return NextResponse.json({ error: 'bookingId requerido' }, { status: 400 });

  // Lógica existente (Yappy): obtenemos paymentUrl desde tu función/servicio actual
  // Aquí asumimos que ya tenías el cálculo del monto y creación del registro payments.
  try {
    const res = await fetch(`${process.env.APP_BASE_URL}/api/internal/yappy/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bookingId, payTestOneCent: !!payTestOneCent }),
    });

    if (!res.ok) {
      const msg = await res.text();
      console.error('yappy.session.error', { bookingId, status: res.status, msg });
      return NextResponse.json({ error: 'No se pudo iniciar Yappy' }, { status: 502 });
    }

    const json = await res.json();
    console.info('yappy.session.created', { bookingId });
    return NextResponse.json({ paymentUrl: json.paymentUrl });
  } catch (e: any) {
    console.error('yappy.session.throw', { bookingId, err: String(e?.message || e) });
    return NextResponse.json({ error: 'Fallo al crear sesión de pago' }, { status: 500 });
  }
}
