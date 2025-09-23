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
  let body: any;
  try { body = await req.json(); } catch { 
    return NextResponse.json({ ok:false, error:'invalid json' }, { status:400 });
  }

  const key = (body?.key ?? '') as string;
  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok:false, error:'unauthorized' }, { status:401 });
  }

  const supabase = createClient(
    need('NEXT_PUBLIC_SUPABASE_URL'),
    need('SUPABASE_SERVICE_ROLE_KEY')
  );

  const { workspaceSlug, name, durationMin, priceUsd, depositType, depositValue, providerName } = body;

  const { data: ws } = await supabase
    .from('workspaces').select('id').eq('slug', workspaceSlug).single();

  if (!ws?.id) return NextResponse.json({ ok:false, error:'workspace not found' }, { status:404 });

  // provider opcional
  let provider_id: string | null = null;
  if (providerName?.trim()) {
    const { data: found } = await supabase
      .from('providers').select('id').eq('workspace_id', ws.id).eq('name', providerName.trim()).maybeSingle();
    if (found?.id) provider_id = found.id;
    else {
      const ins = await supabase.from('providers').insert({ workspace_id: ws.id, name: providerName.trim() }).select('id').single();
      if (ins.error) return NextResponse.json({ ok:false, error:ins.error.message }, { status:400 });
      provider_id = ins.data.id;
    }
  }

  const price_cents = Math.round(Number(priceUsd) * 100);
  const dep_val = depositType === 'FIXED'
    ? Math.round(Number(depositValue) * 100)
    : Math.round(Number(depositValue)); // porcentaje 0-100

  const ins = await supabase.from('services').insert({
    workspace_id: ws.id,
    provider_id,
    name,
    duration_min: Number(durationMin),
    price_cents,
    deposit_type: depositType,
    deposit_value: dep_val,
    is_active: true
  }).select('id,name').single();

  if (ins.error) return NextResponse.json({ ok:false, error:ins.error.message }, { status:400 });

  return NextResponse.json({ ok:true, created: ins.data });
}
