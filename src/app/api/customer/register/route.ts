/**
 * POST /api/customer/register — Iteration 7 / US-IT7-01.
 *
 * **Reversion** des in IT6 (D3-Fix) gelöschten Endpoints. Erlaubt Kunden
 * wieder, sich per Email/Passwort zu registrieren.
 *
 * Body:    `CustomerRegisterSchema`
 * Auth:    keine.
 * Response 201: `{ data: CustomerUserPublicSchema }` — kein passwordHash,
 *               kein verificationToken.
 *
 * Sicherheits-Anker:
 *   - bcrypt cost 12 für `passwordHash`.
 *   - 32-Byte-`crypto.randomBytes` Base64url als verificationToken.
 *   - Resend-Mail mit Verify-Link `${NEXTAUTH_URL}/konto/verifizieren?token=…`.
 *   - F3-Helper: Response geht ausschließlich durch `selectCustomerUserPublic()`
 *     + `toCustomerPublic()` → kein Sensible-Field-Leak.
 *   - Rate-Limit: 5/h pro IP, 3/h pro Email.
 *   - Email-Dupe (case-insensitive) → 409 EMAIL_ALREADY_REGISTERED.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  apiError,
  apiSuccess,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import { CustomerRegisterSchema } from '@/lib/schemas';
import {
  customerRegisterLimiter,
  customerRegisterEmailLimiter,
  getClientIp,
} from '@/lib/ratelimit';
import { selectCustomerUserPublic } from '@/lib/dto/user';
import { toCustomerPublic } from '@/lib/customer-auth-server';
import { sendVerificationEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildVerificationUrl(token: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000';
  const cleanBase = base.replace(/\/+$/, '');
  return `${cleanBase}/konto/verifizieren?token=${encodeURIComponent(token)}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // 1. Rate-Limit IP.
    const ip = getClientIp(req.headers);
    const ipLimit = await customerRegisterLimiter.limit(`register:ip:${ip}`);
    if (!ipLimit.success) {
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Registrierungsversuche. Bitte später erneut.',
      });
    }

    // 2. Body parsen + validieren.
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const data = CustomerRegisterSchema.parse(json);
    const lcEmail = data.email.toLowerCase();

    // 3. Rate-Limit Email.
    const emailLimit = await customerRegisterEmailLimiter.limit(
      `register:email:${lcEmail}`,
    );
    if (!emailLimit.success) {
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Registrierungsversuche. Bitte später erneut.',
      });
    }

    // 4. Duplicate-Check (case-insensitive via lowercased email).
    //    F3-Convention: nutze selectCustomerUserPublic() — hier lesen wir
    //    den Public-Select; wir prüfen nur, ob ein User existiert.
    const existing = await prisma.customerUser.findUnique({
      where: { email: lcEmail },
      select: selectCustomerUserPublic(),
    });
    if (existing) {
      return apiError({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Diese E-Mail-Adresse ist bereits registriert.',
        field: 'email',
      });
    }

    // 5. Hashing + Token.
    const passwordHash = await bcrypt.hash(data.password, 12);
    const verificationToken = randomBytes(32).toString('base64url');
    const verificationTokenExpiry = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    // 6. Insert.
    // IT9 / US-IT9-02 — Adresse ist bei Registrierung optional. Nur
    // Felder mitschreiben, wenn der Caller sie geliefert hat (sonst bleibt
    // der DB-Default `null`, kein expliziter NULL-Write nötig).
    let user;
    try {
      user = await prisma.customerUser.create({
        data: {
          email: lcEmail,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          emailVerified: false,
          verificationToken,
          verificationTokenExpiry,
          ...(data.streetAndNumber !== undefined
            ? { streetAndNumber: data.streetAndNumber }
            : {}),
          ...(data.postalCode !== undefined
            ? { postalCode: data.postalCode }
            : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
        },
        // F3 — Public-Select. KEIN passwordHash, KEIN verificationToken
        // in der Response.
        select: selectCustomerUserPublic(),
      });
    } catch (err) {
      // Race auf email-Unique → 409.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        return apiError({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Diese E-Mail-Adresse ist bereits registriert.',
          field: 'email',
        });
      }
      throw err;
    }

    // 7. Verify-Mail (best-effort — bei Fehler trotzdem 201).
    try {
      const url = buildVerificationUrl(verificationToken);
      const mailResult = await sendVerificationEmail(lcEmail, url);
      if (!mailResult.ok) {
        console.warn(
          '[customer/register] verification mail failed:',
          mailResult.error.slice(0, 200),
        );
      }
    } catch (err) {
      console.warn('[customer/register] verification mail threw:', err);
    }

    // 8. Response — strict-validated DTO.
    const dto = toCustomerPublic(user);
    return NextResponse.json({ data: dto }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
