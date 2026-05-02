/**
 * GET /api/payments/session-status?session_id=cs_...
 *
 * MAJOR-402-Fix (v1.4.1): öffentlicher Endpoint, damit auch Gäste auf
 * `/konto/zahlung/erfolg` ohne Login pollen können.
 *
 * Liefert NUR `{ sessionId, status, paidAt, bookingId }` — KEIN Kunden-PII,
 * keine Booking-Details.
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SessionStatusQuerySchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError } from '@/lib/api';
import { paymentStatusLimiter, getClientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(req.headers);
    const limit = await paymentStatusLimiter.limit(`pay-status:${ip}`);
    if (!limit.success) {
      const retryAfter = Math.max(0, Math.ceil((limit.reset - Date.now()) / 1000));
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Anfragen. Bitte später erneut versuchen.',
        headers: { 'Retry-After': String(retryAfter || 60) },
      });
    }

    const url = new URL(req.url);
    const parsed = SessionStatusQuerySchema.safeParse({
      session_id: url.searchParams.get('session_id') ?? '',
    });
    if (!parsed.success) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Ungültige session_id',
        field: 'session_id',
      });
    }

    const payment = await prisma.payment.findUnique({
      where: { stripeSessionId: parsed.data.session_id },
    });

    if (!payment) {
      return apiError({ code: 'NOT_FOUND', message: 'Session nicht gefunden.' });
    }

    return apiSuccess({
      sessionId: parsed.data.session_id,
      status: payment.status,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      bookingId: payment.bookingId,
    });
  } catch (err) {
    return internalError(err);
  }
}
