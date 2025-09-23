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

function normalizePA(input: string | null | undefined) {
  let s = (input ?? '').trim().replace(/\s+/g, '');
  if (!s) return s;
  if (!s.startsWith('+')) s = '+507' + s.replace(/^0+/, '');
  return s;
}

function validationError(fieldErrors: Record<string, string[]>) {
  return NextResponse.json(
    { error: 'Validación', details: { formErrors: [], fieldErrors } },
    { status: 400 }
  );
}

// --- parser robusto del body (json, form, o query) ---
async function parseBody(req: Request): Promise<Record<string, any>> {
  const ct = (req.headers.get('content-type') || '').toLowerCase();

  // 1) JSON explícito
  if (ct.includes('application/json')) {
    // usa .text() para evitar “stream already read”
    const txt = await req.text();
    if (!txt) return {};
    try { return JSON.parse(txt); } catch { /* sigue abajo */ }
  }

  // 2) x-www-form-urlencoded
  if (ct.includes('application/x-www-form-urlencoded')) {
    const txt = await req.text();
    const params = new URLSearchParams(txt);
    return Object.fromEntries(params.entries());
  }

  // 3) multipart/form-data
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  }

  // 4) Fallback: intenta parsear texto como JSON
  try {
    const txt = await req.text();
    if (txt) return JSON.parse(txt);
  } catch { /* sigue abajo */ }

  // 5) Último recurso: query params
  const url = new URL(req.url);
  return Object.fromEntries(url.searchParams.entries());
}

export async function POST(req: Request) {
  let raw: any = null;
  try {
    raw = await parseBody(req);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // Flexibilidad en nombres de campos
  const workspace = raw.workspace ?? raw.workspaceSlug ?? '';
  const serviceId = raw.serviceId ?? raw.service_id ?? '';
  const providerId = raw.providerId ?? raw.provider_id ?? null;
  const startAt = raw.startAt ?? raw.start_at ?? '';
  const customerName = raw.customerName ?? raw.customer_name ?? '';
  const phone = normalizePA(raw.phone ?? raw.customerPhone ?? raw.customer_phone);
  const email = raw.email ?? raw.customerEmail ?? null;
  const notes = raw.notes ?? null;

  // Validación mínima
  const errs: Record<string, string[]> = {};
  if (!workspace) errs.workspace = ['Required'];
  if (!serviceId) errs.serviceId = ['Required'];
  if (!startAt) errs.startAt = ['Required'];
  if (!customerName) errs.customerName = ['Required'];
  if (!phone) errs.phone = ['Required'];
  if (Object.keys(errs).length > 0) return validationError(errs);

  // Llamada a la RPC SECURITY DEFINER
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

  let rpc = await supa.rpc('create_booking_public', argsA);

  // Compatibilidad con otra firma común (p_workspace)
  if (rpc.error && /does not exist|No function matches/i.test(rpc.error.message)) {
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
    return NextResponse.json(
      { error: 'No se pudo crear la reserva', details: rpc.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, result: rpc.data ?? null });
}

// (Opcional) ayuda para probar rápido vía navegador con query params
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('ping') === '1') {
    return NextResponse.json({ ok: true, hint: 'POST /api/public/bookings con JSON o form data' });
  }
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
