// apps/web/app/api/public/bookings/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Normaliza teléfono de Panamá: agrega +507 si viene sin prefijo
function normalizePA(input: string | null | undefined) {
  let s = (input ?? '').trim().replace(/\s+/g, '');
  if (!s) return s;
  if (!s.startsWith('+')) s = '+507' + s.replace(/^0+/, '');
  return s;
}

// Construye respuesta de validación tipo { error:'Validación', details:{ fieldErrors:{...} } }
function validationError(fieldErrors: Record<string, string[]>) {
  return NextResponse.json(
    { error: 'Validación', details: { formErrors: [], fieldErrors } },
    { status: 400 }
  );
}

export async function POST(req: Request) {
  // 1) Leer JSON una sola vez
  let raw: any;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // 2) Flexibilidad en nombres de campos
  const workspace = raw.workspace ?? raw.workspaceSlug ?? '';
  const serviceId = raw.serviceId ?? raw.service_id ?? '';
  const providerId = raw.providerId ?? raw.provider_id ?? null; // puede ser null
  const startAt = raw.startAt ?? raw.start_at ?? '';
  const customerName = raw.customerName ?? raw.customer_name ?? '';
  const phone = normalizePA(raw.phone ?? raw.customerPhone ?? raw.customer_phone);
  const email = raw.email ?? raw.customerEmail ?? null;
  const notes = raw.notes ?? null;

  // 3) Validaciones mínimas
  const errs: Record<string, string[]> = {};
  if (!workspace) errs.workspace = ['Required'];
  if (!serviceId) errs.serviceId = ['Required'];
  if (!startAt) errs.startAt = ['Required'];
  if (!customerName) errs.customerName = ['Required'];
  if (!phone) errs.phone = ['Required'];

  if (Object.keys(errs).length > 0) return validationError(errs);

  // 4) Llamar a RPC (SECURITY DEFINER) que creamos en Fase 1
  //    Firma esperada (variantes comunes):
  //    - create_booking_public(p_workspace_slug, p_service_id, p_provider_id, p_customer_name, p_customer_phone, p_start_at_local, p_notes)
  const supa = admin();
  const argsA = {
    p_workspace_slug: workspace,
    p_service_id: serviceId,
    p_provider_id: providerId,
    p_customer_name: customerName,
    p_customer_phone: phone,
    p_start_at_local: startAt,
    p_notes: notes,
  };

  // Intento 1: con p_workspace_slug (la más común)
  let rpc = await supa.rpc('create_booking_public', argsA);

  // Si la función no aceptara esos nombres exactos, prueba una variante común p_workspace
  if (rpc.error && /function .* does not exist|No function matches/i.test(rpc.error.message)) {
    const argsB = {
      p_workspace: workspace,
      p_service_id: serviceId,
      p_provider_id: providerId,
      p_customer_name: customerName,
      p_customer_phone: phone,
      p_start_at_local: startAt,
      p_notes: notes,
    };
    rpc = await supa.rpc('create_booking_public', argsB);
  }

  if (rpc.error) {
    // Devuelve error de negocio de forma clara
    return NextResponse.json(
      { error: 'No se pudo crear la reserva', details: rpc.error.message },
      { status: 500 }
    );
  }

  // La función suele retornar booking_id y deposit_cents; si no, igual entregamos lo que venga
  return NextResponse.json({ ok: true, result: rpc.data ?? null });
}
