/**
 * POST /api/customer/logout — US-25 + IT5 Erweiterung (US-31).
 *
 * Löscht das `customer-session`-Cookie (Custom-JWT).
 *
 * IT5: Löscht ZUSÄTZLICH die NextAuth-Customer-Cookies (kurzlebige
 * 60s-Session, normalerweise schon expired, aber zur Sicherheit explizit
 * räumen). Dadurch ist nach dem Logout garantiert kein Reststand der
 * OAuth-Brücke mehr im Browser.
 *
 * Idempotent.
 */

import { NextResponse } from 'next/server';
import { CUSTOMER_SESSION_COOKIE } from '@/lib/customer-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NEXTAUTH_CUSTOMER_COOKIES = [
  '__customer-next-auth.session-token',
  '__customer-next-auth.callback-url',
  '__customer-next-auth.csrf-token',
  // Secure-Variante (Vercel/HTTPS).
  '__Secure-__customer-next-auth.session-token',
  '__Host-__customer-next-auth.csrf-token',
];

export async function POST(): Promise<Response> {
  const res = NextResponse.json(
    { data: { loggedOut: true } },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
  // Custom-JWT-Cookie löschen.
  res.cookies.set({
    name: CUSTOMER_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  // NextAuth-Customer-Cookies löschen (IT5).
  for (const name of NEXTAUTH_CUSTOMER_COOKIES) {
    res.cookies.set({
      name,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
  return res;
}
