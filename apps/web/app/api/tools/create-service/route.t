// apps/web/app/api/tools/create-service/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');

  if (!key || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const {
    workspaceSlug,
    name,
    durationMinutes,
    priceUsd,
    depositType,   // 'FIXED' | 'PERCENT'
    depositValue,  // si FIXED: USD; si PERCENT: número entero %
  } = body ?? {};

  if (!workspaceSlug || !name || !durationMinutes || !priceUsd) {
    return NextResponse.json({ ok: false, error: 'Campos requeridos faltantes' }, { status: 400 });
  }

  // 1) Buscar el workspace
  const { data: ws, error: ews } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('slug', workspaceSlug)
    .single();

  if (ews || !ws) {
    return NextResponse.json({ ok: false, error: 'Workspace no encontrado' }, { status: 404 });
  }

  // 2) Preparar valores
  const price_cents = Math.round(Number(priceUsd) * 100);
  const type = String(depositType || 'FIXED').toUpperCase();
  const isFixed = type === 'FIXED';
  const deposit_cents = isFixed ? Math.round(Number(depositValue || 0) * 100) : null;
  const deposit_percent = !isFixed ? Math.round(Number(depositValue || 0)) : null;

  // 3) Insertar servicio (service role → bypass RLS)
  const { data, error } = await supabaseAdmin
    .from('services')
    .insert({
      workspace_id: ws.id,
      name,
      duration_minutes: Number(durationMinutes),
      price_cents,
      deposit_type: type,          // 'FIXED' | 'PERCENT'
      deposit_cents,               // si FIXED
      deposit_percent,             // si PERCENT
      active: true
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, service: data });
}
