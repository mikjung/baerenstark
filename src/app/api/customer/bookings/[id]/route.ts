/**
 * GET /api/customer/bookings/:id — US-26 AC4.
 *
 * Liefert eine einzelne Buchung des eingeloggten Kunden. Bei
 * Fremdzugriff → 404 (NICHT 403, kein Existenz-Leak).
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError } from '@/lib/api';
import { getCustomerFromRequest } from '@/lib/customer-auth-server';
import {
  bookingStartUTC,
  hoursUntilStart,
  isCancellable,
} from '@/lib/cancellation';
import type { Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const me = await getCustomerFromRequest(req);
    if (!me) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const params = await ctx.params;
    const { id } = params;
    if (!id) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        slot: true,
        attachments: { orderBy: { createdAt: 'asc' } },
        payment: true,
        review: true,
      },
    });

    if (!booking || booking.customerId !== me.id) {
      // Ownership-Check: 404 (KEIN 403 — kein Existenz-Leak).
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    const cancellable = isCancellable(booking);
    const hoursUntil = hoursUntilStart(booking);
    const canReview = booking.status === 'COMPLETED' && !booking.review;
    void bookingStartUTC; // referenced via isCancellable

    return apiSuccess({
      id: booking.id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      // IT5 / US-33: Auftragsdauer in Minuten.
      durationMinutes: booking.durationMinutes,
      service: booking.service as Service,
      description: booking.description,
      // IT5 / US-32: Adresse — nullable für Bestandsbuchungen.
      addressStreet: booking.addressStreet,
      addressZip: booking.addressZip,
      addressCity: booking.addressCity,
      status: booking.status,
      cancellableUntilHours: cancellable ? hoursUntil : null,
      isCancellable: cancellable,
      canReview,
      attachments: booking.attachments.map((a) => ({
        id: a.id,
        url: a.url,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
      })),
      payment: booking.payment
        ? {
            id: booking.payment.id,
            amount: booking.payment.amount,
            currency: booking.payment.currency,
            status: booking.payment.status as
              | 'PENDING'
              | 'PAID'
              | 'FAILED'
              | 'REFUNDED',
            paidAt: booking.payment.paidAt
              ? booking.payment.paidAt.toISOString()
              : null,
          }
        : null,
      review: booking.review
        ? {
            id: booking.review.id,
            stars: booking.review.stars,
            text: booking.review.text,
            approved: booking.review.approved,
            createdAt: booking.review.createdAt.toISOString(),
          }
        : null,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    });
  } catch (err) {
    return internalError(err, 'GET /api/customer/bookings/:id');
  }
}
