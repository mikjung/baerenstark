/**
 * GET /api/customer/verify?token=… — Iteration 7 / US-IT7-01.
 *
 * Query:   `CustomerVerifyTokenQuerySchema` — `{ token }`.
 * Auth:    keine.
 * Response 200: `{ ok: true }`.
 * Errors:
 *   - 410 INVALID_OR_EXPIRED_TOKEN — Token unbekannt, abgelaufen, oder schon verbraucht.
 *   - 429 RATE_LIMITED.
 *
 * Side-Effect: setzt `emailVerified=true`, `emailVerifiedAt=now()`,
 * `verificationToken=null`, `verificationTokenExpiry=null`.
 *
 * Token wird beim Lookup über UNIQUE-Index `verificationToken` gefunden.
 * `verificationTokenExpiry` (BUG-401-Fix) ist die Authority für Ablauf.
 *
 * Rate-Limit: 30 / 60 min / IP (Token-Brute-Force-Schutz).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  apiError,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import { CustomerVerifyTokenQuerySchema } from '@/lib/schemas';
import { verifyTokenLimiter, getClientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    // 1. Rate-Limit.
    const ip = getClientIp(req.headers);
    const ipLimit = await verifyTokenLimiter.limit(`verify:ip:${ip}`);
    if (!ipLimit.success) {
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Versuche. Bitte später erneut.',
      });
    }

    // 2. Token aus Query parsen.
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const parsed = CustomerVerifyTokenQuerySchema.parse({ token: token ?? '' });

    // 3. Conditional UPDATE — atomare Verifikation.
    //    Wir nutzen wieder `$executeRaw` mit Bedingung „token gültig
    //    UND noch nicht abgelaufen UND noch unverbraucht" — affectedRows
    //    ist die Authority.
    //    Prisma + SQLite/libSQL — DateTime-Spalten sind ISO-Text (UTC).
    //    `new Date()` per Parameter binden, statt `CURRENT_TIMESTAMP`
    //    (würde lexikografisch falsch vergleichen).
    const now = new Date();
    const affected = await prisma.$executeRaw`
      UPDATE customer_users
         SET emailVerified           = 1,
             emailVerifiedAt         = ${now},
             verificationToken       = NULL,
             verificationTokenExpiry = NULL,
             updatedAt               = ${now}
       WHERE verificationToken       = ${parsed.token}
         AND (verificationTokenExpiry IS NULL OR verificationTokenExpiry > ${now})
    `;

    if (Number(affected) !== 1) {
      return apiError({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Dieser Verifizierungs-Link ist nicht mehr gültig.',
      });
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
