// apps/web/app/api/app/logout/route.ts
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.redirect(new URL('/app/login', process.env.APP_BASE_URL || 'http://localhost'));
  res.cookies.set('app_session', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
