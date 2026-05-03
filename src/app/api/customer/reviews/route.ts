/**
 * POST /api/customer/reviews — US-29 AC1, AC2, AC3, AC4.
 *
 * Erstellt eine Bewertung zu einer abgeschlossenen Buchung des eingeloggten
 * Kunden.
 *
 * Voraussetzungen:
 *   - Kunde eingeloggt.
 *   - Buchung existiert UND gehört dem Kunden (sonst 404).
 *   - Buchungs-Status === 'COMPLETED' (sonst 409).
 *   - Es existiert noch keine Review für diese Buchung (sonst 409).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CreateReviewSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { getCustomerFromRequest } from '@/lib/customer-auth-server';
import { customerReviewLimiter } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const me = await getCustomerFromRequest(req);
    if (!me) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const limit = await customerReviewLimiter.limit(`rev:${me.id}`);
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

    const data = CreateReviewSchema.parse(json);

    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { review: true },
    });

    if (!booking || booking.customerId !== me.id) {
      // Ownership-Check: 404 (KEIN 403).
      return apiError({
        code: 'NOT_FOUND',
        message: 'Buchung nicht gefunden.',
      });
    }

    // IT6 / US-IT6-03: Vorbedingung verschärft auf COMPLETED.
    if (booking.status !== 'COMPLETED') {
      return apiError({
        code: 'BOOKING_NOT_COMPLETED',
        message: 'Bewertung erst nach Auftragsabschluss möglich.',
      });
    }

    // IT6 / US-IT6-03: Spam-Schutz — Idempotenz auch über REJECTED-State.
    if (booking.review) {
      return apiError({
        code: 'REVIEW_EXISTS',
        message: 'Sie haben diese Buchung bereits bewertet.',
      });
    }

    let review;
    try {
      review = await prisma.review.create({
        data: {
          customerId: me.id,
          bookingId: booking.id,
          stars: data.stars,
          text: data.text ?? null,
          approved: false,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return apiError({
          code: 'REVIEW_EXISTS',
          message: 'Sie haben diese Buchung bereits bewertet.',
        });
      }
      throw err;
    }

    return apiSuccess(
      {
        id: review.id,
        stars: review.stars,
        text: review.text,
        approved: review.approved,
        createdAt: review.createdAt.toISOString(),
      },
      201,
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
