// apps/web/app/api/app/onboarding/seed/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { slug, adminCode, operCode, svcName, price, depositType, depositValue } = await req.json();

  if (!slug) return NextResponse.json({ error: 'slug requerido' }, { status: 400 });

  const { data: ws } = await supabaseAdmin.from('workspaces').select('id, slug').eq('slug', slug).maybeSingle();
  if (!ws) return NextResponse.json({ error: 'workspace no existe' }, { status: 404 });

  // set codes (hash en DB)
  const { error: e1 } = await supabaseAdmin.rpc('set_workspace_codes', {
    p_workspace_id: ws.id,
    p_admin_code: adminCode || null,
    p_operator_code: operCode || null
  });
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // proveedor por defecto (si no existe)
  const { data: provExists } = await supabaseAdmin
    .from('providers')
    .select('id')
    .eq('workspace_id', ws.id)
    .limit(1);
  let providerId = provExists?.[0]?.id as string | undefined;
  if (!providerId) {
    const { data: insProv, error: e2 } = await supabaseAdmin
      .from('providers')
      .insert({ workspace_id: ws.id, name: 'General' })
      .select('id')
      .maybeSingle();
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    providerId = insProv!.id;
  }

  // servicio por defecto
  if (svcName) {
    await supabaseAdmin.from('services').insert({
      workspace_id: ws.id,
      name: String(svcName),
      provider_id: providerId!,
      price_cents: Number(price ?? 0),
      deposit_type: String(depositType ?? 'FIXED'),
      deposit_value: Number(depositValue ?? 0),
      duration_min: 60
    });
  }

  return NextResponse.json({ ok: true });
}
