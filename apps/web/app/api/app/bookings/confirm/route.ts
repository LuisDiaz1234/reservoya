// apps/web/app/api/app/bookings/confirm/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const form = await req.formData();
  const id = String(form.get('id') || '');

  const token = cookies().get('app_session')?.value || '';
  if (!token) return NextResponse.json({ error: 'no-session' }, { status: 401 });

  let workspace_id = '';
  try {
    const decoded = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf-8'));
    workspace_id = decoded.workspace_id;
  } catch {
    return NextResponse.json({ error: 'bad-session' }, { status: 401 });
  }

  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ status: 'CONFIRMED' })
    .eq('id', id)
    .eq('workspace_id', workspace_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Volver al dashboard
  const url = new URL('/app/dashboard', req.url);
  return NextResponse.redirect(url, { status: 302 });
}
