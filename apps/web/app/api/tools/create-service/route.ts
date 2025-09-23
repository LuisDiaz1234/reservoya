// apps/web/app/api/tools/create-service/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function authOk(req: Request) {
  const key = new URL(req.url).searchParams.get('key') ?? '';
  return key && key === process.env.CRON_SECRET;
}

export async function GET(req: Request) {
  if (!authOk(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized', method: 'GET' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, method: 'GET' });
}

type Body = {
  workspaceSlug: string;
  name: string;
  durationMin: number;
  priceUsd: number;
  depositType: 'fixed' | 'percent';
  depositValue: number;
  provider?: string | null;
};

export async function POST(req: Request) {
  if (!authOk(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized', method: 'POST' }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const {
    workspaceSlug,
    name,
    durationMin,
    priceUsd,
    depositType,
    depositValue,
    provider,
  } = body || ({} as Body);

  if (!workspaceSlug || !name) {
    return NextResponse.json({ ok: false, error: 'missing fields' }, { status: 400 });
  }

  const supa = admin();

  // 1) Buscar workspace
  const { data: ws, error: eWs } = await supa
    .from('workspaces')
    .select('id')
    .eq('slug', workspaceSlug)
    .single();

  if (eWs || !ws) {
    return NextResponse.json({ ok: false, error: 'workspace not found' }, { status: 404 });
  }

  // 2) (opcional) upsert de provider por nombre
  let providerId: string | null = null;
  if (provider && provider.trim()) {
    const nameClean = provider.trim();

    const { data: provExisting } = await supa
      .from('providers')
      .select('id')
      .eq('workspace_id', ws.id)
      .ilike('name', nameClean)
      .maybeSingle();

    if (provExisting?.id) {
      providerId = provExisting.id;
    } else {
      const { data: provIns, error: eProv } = await supa
        .from('providers')
        .insert({ workspace_id: ws.id, name: nameClean, is_active: true })
        .select('id')
        .single();

      if (eProv) {
        return NextResponse.json(
          { ok: false, error: 'provider insert failed', details: eProv.message },
          { status: 500 }
        );
      }
      providerId = provIns.id;
    }
  }

  // 3) Insert del servicio
  const price_cents = Math.round(Number(priceUsd || 0) * 100);
  const depType =
    depositType === 'percent' || depositType === 'PERCENT' ? 'PERCENT' : 'FIXED';
  const depValue = Number(depositValue || 0);
  const duration_min = Number(durationMin || 0);

  const { data: svc, error: eSvc } = await supa
    .from('services')
    .insert({
      workspace_id: ws.id,
      name,
      duration_min,
      price_cents,
      deposit_type: depType,   // 'FIXED' | 'PERCENT'
      deposit_value: depValue, // USD o %
      is_active: true,
    })
    .select('id')
    .single();

  if (eSvc) {
    return NextResponse.json(
      { ok: false, error: 'service insert failed', details: eSvc.message },
      { status: 500 }
    );
  }

  // 4) (best-effort) enlazar provider ⇄ service si existe tabla puente
  if (providerId) {
    try {
      await supa.from('provider_services').insert({
        workspace_id: ws.id,
        provider_id: providerId,
        service_id: svc.id,
      });
      // si la tabla no existe, ignoramos el error
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    workspaceId: ws.id,
    serviceId: svc.id,
    providerId,
  });
}
