/**
 * GET /api/customer/oauth-finalize — Iteration 5 / US-31, Fix BUG-IT5-002.
 *
 * Brücken-Endpoint zwischen NextAuth-Customer-OAuth-Callback und unserem
 * langlebigen `customer-session`-JWT-Cookie (siehe `lib/customer-auth.ts`).
 *
 * Verhalten:
 *   1. NextAuth-Session lesen (`customerOAuthAuth()`).
 *   2. CustomerId + Email aus der Session extrahieren.
 *   3. Defense-in-Depth: CustomerUser per ID prüfen.
 *   4. `customer-session`-Cookie setzen (HttpOnly, Secure, SameSite=Lax, 7d).
 *   5. 302 Redirect auf `/konto?oauth=success`.
 *
 * Bei Fehlern (keine Session, Konto in DB nicht vorhanden, etc.):
 *   302 Redirect auf `/konto/login?error=oauth_finalize_failed`.
 *
 * Idempotent — mehrfacher Aufruf während gültiger NextAuth-Session
 * setzt einfach erneut das Cookie. Kein One-Time-Token nötig.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { selectCustomerUserPublic } from '@/lib/dto/user';
import {
  customerOAuthAuth,
  isCustomerOAuthEnabled,
} from '@/lib/customer-oauth';
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  createCustomerSession,
} from '@/lib/customer-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function redirectToLoginError(req: Request, errorCode: string): Response {
  const url = new URL(`/konto/login?error=${errorCode}`, req.url);
  const res = NextResponse.redirect(url, { status: 302 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function GET(req: Request): Promise<Response> {
  if (!isCustomerOAuthEnabled()) {
    return redirectToLoginError(req, 'oauth_not_configured');
  }

  // NextAuth v5: `auth()` ist überladen — bei keinem Argument liefert es
  // die aktuelle Session (oder null). TypeScript wählt die falsche
  // Overload, deshalb explizit casten.
  type AuthFn = () => Promise<unknown>;
  let session: unknown;
  try {
    session = await (customerOAuthAuth as unknown as AuthFn)();
  } catch (err) {
    console.error('[oauth-finalize] failed to read NextAuth session:', err);
    return redirectToLoginError(req, 'oauth_finalize_failed');
  }

  // Token kommt über das session-Callback — wir haben `customerId` /
  // `customerEmail` als zusätzliche Felder darangeklemmt.
  const sessionLike = session as
    | { customerId?: string; customerEmail?: string }
    | null
    | undefined;
  const customerId = sessionLike?.customerId ?? null;
  const customerEmail = sessionLike?.customerEmail ?? null;

  if (!customerId || !customerEmail) {
    return redirectToLoginError(req, 'oauth_finalize_failed');
  }

  // Defense-in-Depth: CustomerUser muss in DB existieren.
  // F3-Schutz: nutze `selectCustomerUserPublic()` — wir lesen zwar nur
  // id+email, aber wir verzichten konsequent auf Default-Selects.
  const user = await prisma.customerUser.findUnique({
    where: { id: customerId },
    select: selectCustomerUserPublic(),
  });
  if (!user) {
    return redirectToLoginError(req, 'oauth_finalize_failed');
  }

  // Custom-JWT signieren + Cookie setzen.
  const jwt = await createCustomerSession(user.id, user.email);

  const successUrl = new URL('/konto?oauth=success', req.url);
  const res = NextResponse.redirect(successUrl, { status: 302 });
  res.cookies.set({
    name: CUSTOMER_SESSION_COOKIE,
    value: jwt,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
