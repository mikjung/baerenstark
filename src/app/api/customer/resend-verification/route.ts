/**
 * POST /api/customer/resend-verification — US-25 AC1, AC2.
 *
 * Sendet die Verifikations-Mail neu. **Immer 200** (kein Enumeration-Leak).
 *
 * BUG-401-Fix (v1.4.1): setzt `verificationToken` UND
 * `verificationTokenExpiry = now + 24h` in einer Transaktion.
 */

import type { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { sendVerificationEmail } from '@/lib/mail';
import { customerSensitiveActionLimiter, getClientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Bitte eine gültige E-Mail-Adresse angeben')
    .max(254),
});

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function publicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

function generateToken(): string {
  const rnd =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `vrf_${rnd}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(req.headers);
    const limit = await customerSensitiveActionLimiter.limit(`resend:${ip}`);
    if (!limit.success) {
      const retryAfter = Math.max(0, Math.ceil((limit.reset - Date.now()) / 1000));
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Anfragen. Bitte später erneut versuchen.',
        headers: { 'Retry-After': String(retryAfter || 3600) },
      });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    const data = Schema.parse(json);

    const user = await prisma.customerUser.findUnique({
      where: { email: data.email },
    });

    if (!user || user.emailVerified) {
      // Enumeration-Schutz: immer 200, ohne Mail.
      return apiSuccess({ ok: true });
    }

    const token = generateToken();
    const expiry = new Date(Date.now() + VERIFICATION_TTL_MS);

    await prisma.customerUser.update({
      where: { id: user.id },
      data: {
        verificationToken: token,
        verificationTokenExpiry: expiry,
      },
    });

    const verificationUrl = `${publicBaseUrl()}/konto/verifizieren?token=${encodeURIComponent(
      token,
    )}`;
    void sendVerificationEmail(user.email, verificationUrl).catch((err) => {
      console.warn('[resend-verification] mail failed:', err);
    });

    return apiSuccess({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
