// apps/web/app/api/app/login/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { signSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { slug, role, code } = await req.json();
  if (!slug || !role || !code) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('verify_workspace_code', {
    p_slug: String(slug),
    p_role: String(role),
    p_code: String(code)
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || !data.length || !data[0].ok) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 401 });
  }

  const sess = signSession({
    workspace_id: data[0].workspace_id,
    workspace_slug: data[0].slug,
    role: data[0].role
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set('app_session', sess, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8h
  });
  return res;
}
