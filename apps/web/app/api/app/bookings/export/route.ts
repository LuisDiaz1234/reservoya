// apps/web/app/api/app/bookings/export/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function toISOEdge(dateStr?: string | null) {
  if (!dateStr) return null;
  try { return new Date(dateStr + 'T00:00:00Z').toISOString(); } catch { return null; }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = cookies().get('app_session')?.value || '';

  let workspace_id = '';
  try {
    const decoded = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf-8'));
    workspace_id = decoded.workspace_id;
  } catch {
    return NextResponse.json({ error: 'no-session' }, { status: 401 });
  }

  const from = toISOEdge(url.searchParams.get('from'));
  const to = toISOEdge(url.searchParams.get('to'));
  const q = (url.searchParams.get('q') || '').trim();

  let qb = supabaseAdmin
    .from('bookings')
    .select('id, customer_name, customer_phone, start_at, status, payment_status')
    .eq('workspace_id', workspace_id)
    .order('start_at', { ascending: true });

  if (from) qb = qb.gte('start_at', from);
  if (to) qb = qb.lte('start_at', new Date(new Date(to).getTime() + 24*60*60*1000).toISOString());
  if (q) qb = qb.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`);

  const { data, error } = await qb.limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = ['id','cliente','telefono','inicio','estado','pago'].join(',');
  const rows = (data || []).map(r => [
    r.id,
    JSON.stringify(r.customer_name ?? ''), // quote-safe
    JSON.stringify(r.customer_phone ?? ''),
    new Date(r.start_at ?? '').toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' }),
    r.status,
    r.payment_status,
  ].join(','));
  const csv = [header, ...rows].join('\n');

  const res = new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="reservas.csv"`,
    },
  });
  return res;
}
