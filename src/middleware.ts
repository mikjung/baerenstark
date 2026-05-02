/**
 * Edge-Middleware — schützt /admin/* (außer /admin/login und /admin/setup).
 *
 * Nutzt die Edge-sichere `auth.config.ts` (kein bcrypt, kein Prisma).
 * API-Routen prüfen Session direkt im Handler, weil dort das einheitliche
 * JSON-Fehlerformat zurückgegeben werden soll.
 */

import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';

const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/setup'];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  if (!pathname.startsWith('/admin')) return NextResponse.next();

  const isPublicAdmin = PUBLIC_ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isPublicAdmin) return NextResponse.next();

  const isLoggedIn = !!req.auth?.user;
  if (isLoggedIn) return NextResponse.next();

  const loginUrl = new URL('/admin/login', req.nextUrl.origin);
  loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ['/admin/:path*'],
};
