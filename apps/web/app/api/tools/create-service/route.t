// apps/web/app/api/tools/create-service/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno ${name}`);
  return v;
}

type Body = {
  key?: string;
  workspaceSlug: string;
  name: string;
  durationMin: number;
  priceUsd: number;
  depositType: 'FIXED' | 'PERCENT';
  depositValue: number; // FIXED: USD; PERCENT: 0-100
  providerName?: string | null;
};

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') ?? '';
  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, method: 'GET' });
}

export async function POST(req: Request) {
  let body: Body | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const key =
    body?.key ??
    new URL(req.url).searchParams.get('key') ??
    '';

  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (!body) {
    return NextResponse.json({ ok: false, error: 'Sin body' }, { status: 400 });
  }

  const supabase = createClient(
    reqEnv('NEXT_PUBLIC_SUPABASE_URL'),
    reqEnv('SUPABASE_SERVICE_ROLE_KEY')
  );

  // 1) Buscar workspace por slug
  const { data: ws, error: werr } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', body.workspaceSlug)
    .single();

  if (werr || !ws) {
    return NextResponse.json({ ok: false, error: 'workspace no encontrado' }, { status: 404 });
  }

  // 2) Garantizar provider si viene por nombre
  let providerId: string | null = null;
  if (body.providerName && body.providerName.trim()) {
    const { data: prov } = await supabase
      .from('providers')
      .select('id')
      .eq('workspace_id', ws.id)
      .eq('name', body.providerName.trim())
      .maybeSingle();

    if (prov?.id) {
      providerId = prov.id;
    } else {
      const ins = await supabase
        .from('providers')
        .insert({ workspace_id: ws.id, name: body.providerName.trim() })
        .select('id')
        .single();
      if (ins.error) {
        return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400 });
      }
      providerId = ins.data.id;
    }
  }

  // 3) Calcular montos
  const price_cents = Math.round(Number(body.priceUsd) * 100);
  const deposit_value =
    body.depositType === 'FIXED'
      ? Math.round(Number(body.depositValue) * 100) // USD → cents
      : Math.round(Number(body.depositValue)); // porcentaje 0-100

  // 4) Insertar servicio
  const { data: svc, error: serr } = await supabase
    .from('services')
    .insert({
      workspace_id: ws.id,
      provider_id: providerId,
      name: body.name,
      duration_min: Number(body.durationMin),
      price_cents,
      deposit_type: body.depositType,
      deposit_value,
      is_active: true,
    })
    .select('id, name');

  if (serr) {
    return NextResponse.json({ ok: false, error: serr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    created: svc?.[0] ?? null,
  });
}
