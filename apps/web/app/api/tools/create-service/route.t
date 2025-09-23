// apps/web/app/api/tools/create-service/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function need(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export async function POST(req: Request) {
  // 1) Leer JSON
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  // 2) Validar key de admin
  const key = (body?.key ?? '') as string;
  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // 3) Supabase (usa la service role key)
  const supabase = createClient(
    need('NEXT_PUBLIC_SUPABASE_URL'),
    need('SUPABASE_SERVICE_ROLE_KEY')
  );

  // 4) Datos del cuerpo
  const {
    workspaceSlug,
    name,
    durationMin,
    priceUsd,
    depositType,   // 'FIXED' | 'PERCENT'
    depositValue,  // number (USD si FIXED, % si PERCENT)
    providerName   // opcional
  } = body;

  // 5) Buscar workspace
  const { data: ws, error: wsErr } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', workspaceSlug)
    .single();

  if (wsErr || !ws?.id) {
    return NextResponse.json({ ok: false, error: 'workspace not found' }, { status: 404 });
  }

  // 6) Crear/buscar provider opcional
  let provider_id: string | null = null;
  if (providerName && String(providerName).trim()) {
    const nameTrim = String(providerName).trim();

    const { data: found } = await supabase
      .from('providers')
      .select('id')
      .eq('workspace_id', ws.id)
      .eq('name', nameTrim)
      .maybeSingle();

    if (found?.id) {
      provider_id = found.id;
    } else {
      const created = await supabase
        .from('providers')
        .insert({ workspace_id: ws.id, name: nameTrim })
        .select('id')
        .single();
      if (created.error) {
        return NextResponse.json({ ok: false, error: created.error.message }, { status: 400 });
      }
      provider_id = created.data.id;
    }
  }

  // 7) Normalizar valores
  const price_cents = Math.round(Number(priceUsd) * 100);
  const dep_val =
    depositType === 'FIXED'
      ? Math.round(Number(depositValue) * 100) // USD -> cents
      : Math.round(Number(depositValue));      // porcentaje 0-100

  // 8) Insertar servicio
  const ins = await supabase
    .from('services')
    .insert({
      workspace_id: ws.id,
      provider_id,
      name,
      duration_min: Number(durationMin),
      price_cents,
      deposit_type: depositType, // 'FIXED' | 'PERCENT'
      deposit_value: dep_val,
      is_active: true
    })
    .select('id,name')
    .single();

  if (ins.error) {
    return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, created: ins.data });
}
