/**
 * POST /api/customer/login — Iteration 7 / US-IT7-01.
 *
 * **Reversion** des in IT6 (D3-Fix) gelöschten Endpoints. Klassischer
 * Email/Passwort-Login (parallel zu Google + Facebook OAuth).
 *
 * Body:    `CustomerLoginSchema` — `{ email, password, redirectUrl? }`.
 * Auth:    keine.
 * Response 200: `{ data: CustomerLoginResponseSchema }` (= Public + redirectUrl).
 *               Cookie `customer-session` wird gesetzt.
 *
 * Sicherheits-Anker:
 *   - bcrypt cost 12, konstante bcrypt-Last bei nicht-existierendem User
 *     (Timing-Side-Channel-Schutz).
 *   - Email-Enumeration-Schutz: 401 INVALID_CREDENTIALS in beiden Fällen
 *     (User existiert nicht ODER Passwort falsch). Keine Differenzierung.
 *   - emailVerified ist KEIN Block (Vorentscheidung Orchestrator,
 *     ARCHITECTURE_IT7.md §4.4). Frontend zeigt Banner.
 *   - F3-DTO: Response geht ausschließlich durch `toCustomerPublic()`.
 *   - Rate-Limit: 10/h IP + 5/h Email (Credential-Stuffing).
 *   - OAuth-only-Account (passwordHash IS NULL) → 422 OAUTH_ONLY_ACCOUNT.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  apiError,
  apiSuccess,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import { CustomerLoginSchema } from '@/lib/schemas';
import {
  customerLoginLimiter,
  customerLoginEmailLimiter,
  getClientIp,
} from '@/lib/ratelimit';
import { selectCustomerUserPublic } from '@/lib/dto/user';
import { toCustomerPublic } from '@/lib/customer-auth-server';
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  createCustomerSession,
  safeCustomerCallback,
} from '@/lib/customer-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Konstanter Bcrypt-Hash für Timing-Side-Channel-Schutz, falls User
// nicht existiert (oder OAuth-only ist). Hash matcht nie — es geht
// nur um konstante Last.
const DUMMY_BCRYPT_HASH =
  '$2a$10$CwTycUXWue0Thq9StjUM0uJ8j.zk8aYPX8Z5OTUyIzKb8C5nrYgtq';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // 1. Rate-Limit IP.
    const ip = getClientIp(req.headers);
    const ipLimit = await customerLoginLimiter.limit(`customer-login:ip:${ip}`);
    if (!ipLimit.success) {
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Login-Versuche. Bitte später erneut.',
      });
    }

    // 2. Body parsen + validieren.
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const data = CustomerLoginSchema.parse(json);
    const lcEmail = data.email.toLowerCase();

    // 3. Rate-Limit Email (Credential-Stuffing-Schutz).
    const emailLimit = await customerLoginEmailLimiter.limit(
      `customer-login:email:${lcEmail}`,
    );
    if (!emailLimit.success) {
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Login-Versuche für diese Adresse.',
      });
    }

    // 4. Lookup. F3-Helper — wir lesen den Public-Select inkl. passwordHash
    //    (der Helper erlaubt den Hash zur internen Verwendung; Mapper
    //    droppt ihn vor der Response).
    const user = await prisma.customerUser.findUnique({
      where: { email: lcEmail },
      select: selectCustomerUserPublic(),
    });

    if (!user) {
      // Konstante Bcrypt-Last (Side-Channel-Schutz).
      await bcrypt.compare(data.password, DUMMY_BCRYPT_HASH);
      return apiError({
        code: 'INVALID_CREDENTIALS',
        message: 'E-Mail oder Passwort ungültig.',
      });
    }

    // 5. OAuth-only-Account?
    if (!user.passwordHash) {
      // Wieder konstante Last.
      await bcrypt.compare(data.password, DUMMY_BCRYPT_HASH);
      return apiError({
        code: 'OAUTH_ONLY_ACCOUNT',
        message:
          'Dieses Konto wurde mit Google oder Facebook angelegt. Bitte melden Sie sich entsprechend an.',
      });
    }

    // 6. bcrypt-Compare.
    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) {
      return apiError({
        code: 'INVALID_CREDENTIALS',
        message: 'E-Mail oder Passwort ungültig.',
      });
    }

    // 7. Cookie + Response. F3-Schutz: Mapper baut das DTO.
    const dto = toCustomerPublic(user);
    const redirectUrl = safeCustomerCallback(data.redirectUrl);
    const jwt = await createCustomerSession(user.id, user.email);

    const res = NextResponse.json(
      { data: { ...dto, redirectUrl } },
      { status: 200 },
    );
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
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
