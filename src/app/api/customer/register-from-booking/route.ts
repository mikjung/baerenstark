/**
 * IT12 / US-IT12-05 — POST /api/customer/register-from-booking.
 *
 * Public, Token-gated. Erstellt einen `CustomerUser` aus einer bestehenden
 * Gast-Buchung. Verknüpft alle Bookings mit derselben E-Mail (case-
 * insensitive) auf den neuen Account und setzt sofort das langlebige
 * `customer-session`-Cookie.
 *
 * Verlauf:
 *   1. Rate-Limit (5/h/IP — gleicher Bucket wie Self-Service-Register).
 *   2. Zod-Validierung: `{ bookingId, confirmationToken, password }`.
 *   3. Confirmation-Token verifizieren (scope=booking-confirmation).
 *      Token-Mismatch → 401 INVALID_TOKEN.
 *   4. Booking aus DB laden. Wenn nicht existiert → 404 BOOKING_NOT_FOUND.
 *   5. `customerEmail` der Booking holen (Pflicht — sonst 400 NO_EMAIL).
 *   6. Email-Existenz-Check. Wenn schon ein CustomerUser → 409 ACCOUNT_EXISTS.
 *   7. Vorname/Nachname aus `customerName` splitten.
 *   8. bcrypt-Hash (cost 12).
 *   9. CustomerUser anlegen (emailVerified=true — Token-Besitz beweist
 *      E-Mail-Zugang).
 *   10. updateMany alle Bookings mit dieser Email + customerId=null →
 *       customerId = newUser.id.
 *   11. Customer-Session-Cookie setzen.
 *   12. 201 Response mit `{ customerId, linkedBookingsCount }`.
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §5 + §R.4 (Endpoint #1),
 * backend-requirements-iteration-12.md §S05 / Post-QA Revision.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  apiError,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import {
  customerRegisterLimiter,
  getClientIp,
} from '@/lib/ratelimit';
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
  createCustomerSession,
} from '@/lib/customer-auth';
import { verifyBookingConfirmationToken } from '@/lib/booking-tokens';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RegisterFromBookingSchema = z.object({
  bookingId: z.string().trim().min(1, 'bookingId fehlt'),
  confirmationToken: z.string().trim().min(1, 'confirmationToken fehlt'),
  password: z
    .string()
    .min(12, 'Das Passwort muss mindestens 12 Zeichen lang sein.')
    .max(200, 'Das Passwort ist zu lang.'),
});

function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const trimmed = (full ?? '').trim();
  if (!trimmed) return { firstName: 'Kunde', lastName: '—' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '—' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // 1. Rate-Limit (gleicher Bucket wie Self-Service-Register).
    const ip = getClientIp(req.headers);
    const ipLimit = await customerRegisterLimiter.limit(`register-from-booking:ip:${ip}`);
    if (!ipLimit.success) {
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Anfragen. Bitte später erneut.',
      });
    }

    // 2. Body parsen.
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    let parsed;
    try {
      parsed = RegisterFromBookingSchema.parse(json);
    } catch (err) {
      if (err instanceof ZodError) return zodErrorResponse(err);
      throw err;
    }

    // 3. Token verifizieren.
    const verify = await verifyBookingConfirmationToken(parsed.confirmationToken);
    if (!verify.ok) {
      return apiError({
        code: 'UNAUTHORIZED',
        message:
          verify.reason === 'TOKEN_EXPIRED'
            ? 'Der Bestätigungs-Link ist abgelaufen.'
            : 'Der Bestätigungs-Link ist ungültig.',
        subcode: 'INVALID_TOKEN',
      });
    }
    if (verify.payload.sub !== parsed.bookingId) {
      return apiError({
        code: 'UNAUTHORIZED',
        message: 'Der Token passt nicht zur angegebenen Buchung.',
        subcode: 'INVALID_TOKEN',
      });
    }

    // 4. Booking laden.
    const booking = await prisma.booking.findUnique({
      where: { id: parsed.bookingId },
      select: {
        id: true,
        customerEmail: true,
        customerName: true,
        customerId: true,
      },
    });
    if (!booking) {
      return apiError({
        code: 'NOT_FOUND',
        message: 'Buchung nicht gefunden.',
        subcode: 'BOOKING_NOT_FOUND',
      });
    }

    // 5. Email-Pflicht.
    if (!booking.customerEmail || booking.customerEmail.length === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Die Buchung enthält keine E-Mail-Adresse.',
        field: 'customerEmail',
      });
    }
    const lcEmail = booking.customerEmail.toLowerCase();

    // 6. Email-Existenz-Check.
    const existing = await prisma.customerUser.findUnique({
      where: { email: lcEmail },
      select: { id: true },
    });
    if (existing) {
      return apiError({
        code: 'CONFLICT',
        message: 'Es existiert bereits ein Konto mit dieser E-Mail-Adresse. Bitte melden Sie sich an.',
        subcode: 'ACCOUNT_EXISTS',
      });
    }

    // 7. Name splitten.
    const { firstName, lastName } = splitName(booking.customerName);

    // 8. Passwort hashen.
    const passwordHash = await bcrypt.hash(parsed.password, 12);

    // 9. CustomerUser anlegen. emailVerified=true, weil der Token-Besitz
    //    den E-Mail-Zugang nachweist (der Confirmation-Token kommt aus der
    //    Bestätigungs-Mail an dieselbe Adresse).
    let newUser;
    try {
      newUser = await prisma.customerUser.create({
        data: {
          email: lcEmail,
          passwordHash,
          firstName,
          lastName,
          phone: null,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, email: true },
      });
    } catch (err) {
      // P2002 (Race auf email-Unique zwischen Step 6 und 9) → wie 409.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        return apiError({
          code: 'CONFLICT',
          message: 'Es existiert bereits ein Konto mit dieser E-Mail-Adresse.',
          subcode: 'ACCOUNT_EXISTS',
        });
      }
      throw err;
    }

    // 10. Alle Bookings mit dieser Email + customerId=null verknüpfen
    //     (case-insensitive durch lcEmail-Vergleich). Wir matchen sowohl
    //     auf customerEmail = lcEmail wie auch auf den Original-Case
    //     (in case alte Bookings mit Mixed-Case existieren).
    const linkResult = await prisma.booking.updateMany({
      where: {
        customerEmail: { in: [lcEmail, booking.customerEmail] },
        customerId: null,
      },
      data: { customerId: newUser.id },
    });

    // 11. Session-Cookie setzen.
    const jwt = await createCustomerSession(newUser.id, newUser.email);

    const res = NextResponse.json(
      {
        data: {
          customerId: newUser.id,
          linkedBookingsCount: linkResult.count,
        },
      },
      { status: 201 },
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

    // eslint-disable-next-line no-console
    console.info(
      `[register-from-booking] customerId=${newUser.id} linkedBookings=${linkResult.count}`,
    );

    return res;
  } catch (err) {
    return internalError(err, 'POST /api/customer/register-from-booking');
  }
}
