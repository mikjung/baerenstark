/**
 * POST /api/customer/logout — US-25.
 *
 * Löscht das `customer-session`-Cookie. Idempotent.
 */

import { NextResponse } from 'next/server';
import { CUSTOMER_SESSION_COOKIE } from '@/lib/customer-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  const res = NextResponse.json(
    { data: { loggedOut: true } },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
  // Cookie via Max-Age=0 löschen (Lokale + Produktion).
  res.cookies.set({
    name: CUSTOMER_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
