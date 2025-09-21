// apps/web/app/api/app/logout/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  // Usamos la URL de la solicitud para construir una redirección válida en Vercel
  const url = new URL('/app/login', req.url);
  const res = NextResponse.redirect(url, { status: 302 });
  res.cookies.set('app_session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  return res;
}
