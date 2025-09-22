// apps/web/app/api/public/bookings/route.ts
import { NextResponse } from 'next/server';
import { bookingPublicSchema } from '@/lib/validation';
import { normalizePA } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRate } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'unknown';
  const rate = await checkRate(ip, '/api/public/bookings', 10, 60); // 10 req/min
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Rate limit excedido.' }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = bookingPublicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validación', details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

  // Normaliza y valida teléfono
  const phoneNorm = normalizePA(input.customerPhone);
  if (!phoneNorm || phoneNorm.replace('whatsapp:', '').trim().length < 6) {
    return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });
  }

  // Llamamos la RPC pública (SECURITY DEFINER) para crear la reserva PENDING
  const { data, error } = await supabaseAdmin.rpc('create_booking_public', {
    p_workspace_slug: input.workspace,
    p_service_id: input.serviceId,
    p_provider_id: input.providerId ?? null,
    p_customer_name: input.customerName,
    p_customer_phone: phoneNorm.replace('whatsapp:', ''), // guardamos sin el prefijo
    p_start_at_local: input.startAt, // server normaliza a tz Panamá
    p_notes: input.notes ?? null
  });

  if (error) {
    console.error('booking.create.error', { error: error.message });
    return NextResponse.json({ error: 'No se pudo crear la reserva.' }, { status: 500 });
  }

  console.info('booking.created', { booking_id: data?.booking_id, workspace: input.workspace });
  return NextResponse.json({ ok: true, bookingId: data?.booking_id });
}
