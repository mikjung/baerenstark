/**
 * POST /api/customer/login — US-25 AC3, AC4.
 *
 * Authentifiziert einen Kunden und setzt das `customer-session`-Cookie.
 *
 * Sicherheits-Details:
 *   - Generische 401-Message (kein User-Enumeration-Leak).
 *   - Konstante bcrypt-Last gegen Timing-Side-Channel (Dummy-Hash, wenn
 *     User nicht existiert — gleicher Pattern wie Admin-Auth).
 *   - 422 EMAIL_NOT_VERIFIED, wenn Konto noch nicht verifiziert ist.
 *   - Open-Redirect-Schutz via `safeCustomerCallback()` (MAJOR-405-Fix).
 *   - Rate-Limit: 10 Versuche / 15 min / IP.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { CustomerLoginSchema } from '@/lib/schemas';
import { apiError, internalError, zodErrorResponse } from '@/lib/api';
import {
  createCustomerSession,
  customerSessionCookieOptions,
  safeCustomerCallback,
} from '@/lib/customer-auth';
import { customerLoginLimiter, getClientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Gleicher Dummy-Hash wie Admin-Auth — konstante bcrypt-Last gegen
// Timing-Side-Channel.
const DUMMY_BCRYPT_HASH =
  '$2a$10$CwTycUXWue0Thq9StjUM0uJ8j.zk8aYPX8Z5OTUyIzKb8C5nrYgtq';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(req.headers);
    const limit = await customerLoginLimiter.limit(`login:${ip}`);
    if (!limit.success) {
      const retryAfter = Math.max(0, Math.ceil((limit.reset - Date.now()) / 1000));
      return apiError({
        code: 'RATE_LIMITED',
        message:
          'Zu viele Anmelde-Versuche. Bitte 15 Minuten warten und erneut versuchen.',
        headers: { 'Retry-After': String(retryAfter || 900) },
      });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    const data = CustomerLoginSchema.parse(json);

    const user = await prisma.customerUser.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // Konstante bcrypt-Last gegen Timing-Side-Channel.
      await bcrypt.compare(data.password, DUMMY_BCRYPT_HASH);
      return apiError({
        code: 'UNAUTHORIZED',
        message: 'E-Mail oder Passwort ungültig.',
      });
    }

    // IT5 / US-31: OAuth-only-Konten haben keinen lokalen `passwordHash`.
    // Wir antworten mit 422 OAUTH_ONLY_ACCOUNT, damit das Frontend dem
    // Kunden den Hinweis „Bitte mit Google/GitHub anmelden" zeigen kann.
    // Konstante bcrypt-Last gegen Timing-Side-Channel.
    if (!user.passwordHash) {
      await bcrypt.compare(data.password, DUMMY_BCRYPT_HASH);
      return apiError({
        code: 'OAUTH_ONLY_ACCOUNT',
        message:
          'Dieses Konto wurde mit einem externen Anbieter (Google/GitHub) erstellt. Bitte melden Sie sich darüber an.',
      });
    }

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) {
      return apiError({
        code: 'UNAUTHORIZED',
        message: 'E-Mail oder Passwort ungültig.',
      });
    }

    if (!user.emailVerified) {
      return apiError({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.',
      });
    }

    const token = await createCustomerSession(user.id, user.email);
    const redirectUrl = safeCustomerCallback(data.redirectUrl);

    const responseBody = {
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
        redirectUrl,
      },
    };

    const res = NextResponse.json(responseBody, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
    const cookieOpts = customerSessionCookieOptions();
    res.cookies.set({
      name: cookieOpts.name,
      value: token,
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    });
    return res;
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
