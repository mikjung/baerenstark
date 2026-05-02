/**
 * POST /api/customer/forgot-password — US-25 AC5.
 *
 * Startet den Passwort-Reset-Flow. **Immer 200** (Enumeration-Schutz).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { CustomerForgotPasswordSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { sendPasswordResetEmail } from '@/lib/mail';
import { customerSensitiveActionLimiter, getClientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RESET_TTL_MS = 60 * 60 * 1000; // 1h

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
  return `rst_${rnd}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(req.headers);
    const limit = await customerSensitiveActionLimiter.limit(`forgot:${ip}`);
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

    const data = CustomerForgotPasswordSchema.parse(json);

    const user = await prisma.customerUser.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // Enumeration-Schutz: immer 200.
      return apiSuccess({ ok: true });
    }

    const token = generateToken();
    const expiry = new Date(Date.now() + RESET_TTL_MS);

    await prisma.customerUser.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    const resetUrl = `${publicBaseUrl()}/konto/passwort-zuruecksetzen?token=${encodeURIComponent(
      token,
    )}`;
    void sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
      console.warn('[forgot-password] mail failed:', err);
    });

    return apiSuccess({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
