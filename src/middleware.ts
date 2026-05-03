/**
 * Edge-Middleware — schützt /admin/* und /konto/*.
 *
 * Iteration 4: zweite Schutz-Schicht für `/konto/*` mit eigener
 * `customer-session`-Cookie-Logik (siehe `lib/customer-auth.ts`).
 *
 * Edge-Sicherheit: hier laufen ausschließlich Edge-kompatible Module
 * (NextAuth-`auth.config.ts` ohne Prisma/bcrypt; `customer-auth.ts` nutzt
 * nur `jose`). Kein DB-Lookup — der findet im Route-Handler statt.
 */

import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import {
  readCustomerSessionFromRequest,
  safeCustomerCallback,
} from '@/lib/customer-auth';

const PUBLIC_ADMIN_PATHS = [
  '/admin/login',
  '/admin/setup',
  '/admin/passwort-vergessen',
  '/admin/passwort-reset',
];

const PUBLIC_KONTO_PATHS = [
  '/konto/login',
  '/konto/registrieren',
  '/konto/passwort-vergessen',
  '/konto/passwort-zuruecksetzen',
  '/konto/verifizieren',
];

const { auth } = NextAuth(authConfig);

async function handleKonto(req: NextRequest): Promise<Response | null> {
  const { pathname, search } = req.nextUrl;

  // /konto/zahlung/:id ist mit cancelToken auch für Gäste zugänglich
  // (Stripe-Mail-Link ohne Login-Pflicht). Ohne Token → wie sonst.
  if (pathname.startsWith('/konto/zahlung/')) {
    const token = req.nextUrl.searchParams.get('token');
    if (token) return NextResponse.next();
  }

  if (
    PUBLIC_KONTO_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    return NextResponse.next();
  }

  const session = await readCustomerSessionFromRequest(req);
  if (session) return NextResponse.next();

  const loginUrl = new URL('/konto/login', req.nextUrl.origin);
  // safeCustomerCallback verhindert Open-Redirect-Schmuggel über das
  // pathname (kann theoretisch von Reverse-Proxy manipuliert werden).
  loginUrl.searchParams.set(
    'callbackUrl',
    safeCustomerCallback(`${pathname}${search}`),
  );
  return NextResponse.redirect(loginUrl);
}

export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;

  // /konto/* — IT4
  if (pathname.startsWith('/konto')) {
    const res = await handleKonto(req as unknown as NextRequest);
    if (res) return res;
    return NextResponse.next();
  }

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
  matcher: ['/admin/:path*', '/konto/:path*'],
};
