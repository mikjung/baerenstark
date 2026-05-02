/**
 * POST /api/customer/reset-password — US-25 AC6.
 *
 * Setzt ein neues Passwort. Validiert Token + Expiry.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { CustomerResetPasswordSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { customerResetLimiter, getClientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(req.headers);
    const limit = await customerResetLimiter.limit(`reset:${ip}`);
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

    const data = CustomerResetPasswordSchema.parse(json);

    const user = await prisma.customerUser.findUnique({
      where: { resetToken: data.token },
    });

    if (
      !user ||
      !user.resetTokenExpiry ||
      user.resetTokenExpiry.getTime() <= Date.now()
    ) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Der Link ist nicht mehr gültig.',
        field: 'token',
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    await prisma.customerUser.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return apiSuccess({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
