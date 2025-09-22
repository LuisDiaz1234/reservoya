// apps/web/app/api/tools/create-service/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function authOk(url: URL) {
  const key = url.searchParams.get('key');
  return key && process.env.CRON_SECRET && key === process.env.CRON_SECRET;
}

// GET simple para probar key/route desde el navegador
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!authOk(url)) return json(401, { ok: false, error: 'Unauthorized' });
  return json(200, { ok: true, method: 'GET', hint: 'POST con JSON para crear servicio' });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!authOk(url)) return json(401, { ok: false, error: 'Unauthorized' });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: 'JSON inválido en el cuerpo' });
  }

  const {
    workspaceSlug,
    name,
    durationMinutes,
    priceUsd,
    depositType,   // 'FIXED' | 'PERCENT'
    depositValue,  // FIXED: USD, PERCENT: número entero %
  } = body ?? {};

  if (!workspaceSlug || !name || !durationMinutes || priceUsd === undefined) {
    return json(400, { ok: false, error: 'Campos requeridos faltantes' });
  }

  // 1) Buscar workspace por slug
  const { data: ws, error: ews } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('slug', workspaceSlug)
    .single();

  if (ews || !ws) return json(404, { ok: false, error: 'Workspace no encontrado' });

  // 2) Preparar valores
  const price_cents = Math.round(Number(priceUsd) * 100);

  const typeRaw = String(depositType || 'FIXED').toUpperCase();
  const type = typeRaw === 'PERCENT' ? 'PERCENT' : 'FIXED';
  const isFixed = type === 'FIXED';

  const depValNum = Number(depositValue ?? 0);
  const deposit_cents   = isFixed ? Math.max(0, Math.round(depValNum * 100)) : null;
  const deposit_percent = !isFixed ? Math.max(0, Math.round(depValNum))     : null;

  try {
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

    if (error) return json(400, { ok: false, error: error.message });

    return json(200, { ok: true, service: data });
  } catch (e: any) {
    return json(500, { ok: false, error: String(e?.message || e) });
  }
}
