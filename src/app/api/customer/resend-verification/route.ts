/**
 * POST /api/customer/resend-verification — Iteration 7 / US-IT7-01.
 *
 * Body:    keiner.
 * Auth:    Customer-Session (Cookie `customer-session`).
 * Response 200: `{ ok: true }`.
 * Errors:
 *   - 401 UNAUTHORIZED   — keine Customer-Session.
 *   - 409 ALREADY_VERIFIED — `emailVerified === true`.
 *   - 429 RATE_LIMITED.
 *
 * Side-Effect: generiert neuen `verificationToken` (32-Byte-Random,
 * Base64url), setzt `verificationTokenExpiry = now + 24h` und schickt
 * Verify-Mail via Resend.
 *
 * Rate-Limit: 3 / Stunde / Email.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import {
  apiError,
  internalError,
} from '@/lib/api';
import { verifyResendLimiter } from '@/lib/ratelimit';
import { getCustomerFromRequest } from '@/lib/customer-auth-server';
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
    // 1. Auth.
    const user = await getCustomerFromRequest(req);
    if (!user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    // 2. Bereits verifiziert?
    if (user.emailVerified) {
      return apiError({
        code: 'ALREADY_VERIFIED',
        message: 'Diese E-Mail-Adresse ist bereits bestätigt.',
      });
    }

    // 3. Rate-Limit pro Email.
    const lcEmail = user.email.toLowerCase();
    const limit = await verifyResendLimiter.limit(`verify-resend:email:${lcEmail}`);
    if (!limit.success) {
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Anfragen. Bitte später erneut.',
      });
    }

    // 4. Neuen Token generieren + speichern.
    const verificationToken = randomBytes(32).toString('base64url');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.customerUser.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiry,
      },
    });

    // 5. Verify-Mail (best-effort).
    try {
      const url = buildVerificationUrl(verificationToken);
      const mailResult = await sendVerificationEmail(user.email, url);
      if (!mailResult.ok) {
        console.warn(
          '[resend-verification] mail failed:',
          mailResult.error.slice(0, 200),
        );
      }
    } catch (err) {
      console.warn('[resend-verification] mail threw:', err);
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return internalError(err);
  }
}
