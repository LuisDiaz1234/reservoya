// apps/web/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/app') && !pathname.startsWith('/app/login')) {
    const token = req.cookies.get('app_session')?.value;
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/app/login';
      url.search = ''; // limpia query
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
