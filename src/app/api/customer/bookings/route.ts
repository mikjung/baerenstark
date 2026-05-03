/**
 * GET /api/customer/bookings — US-26 AC1, AC2, AC3.
 *
 * Liefert alle Buchungen des eingeloggten Kunden, gesplittet nach
 * `upcoming` und `past`. Sortierung: upcoming asc, past desc.
 *
 * Backend berechnet `isCancellable`, `cancellableUntilHours` und
 * `canReview`. Siehe `lib/cancellation.ts` (MAJOR-401 / MAJOR-404 Fix).
 */

import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError } from '@/lib/api';
import { getCustomerFromRequest } from '@/lib/customer-auth-server';
import {
  bookingStartUTC,
  hoursUntilStart,
  isCancellable,
  todayInBerlin,
} from '@/lib/cancellation';
import type { Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type BookingWithRels = Prisma.BookingGetPayload<{
  include: {
    slot: true;
    attachments: true;
    payment: true;
    review: true;
  };
}>;

function toCustomerBooking(b: BookingWithRels) {
  const cancellable = isCancellable(b);
  const hoursUntil = hoursUntilStart(b);
  const canReview = b.status === 'COMPLETED' && !b.review;

  return {
    id: b.id,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    // IT5 / US-33: Auftragsdauer in Minuten.
    durationMinutes: b.durationMinutes,
    service: b.service as Service,
    description: b.description,
    // IT5 / US-32: Adresse — nullable für Bestandsbuchungen.
    addressStreet: b.addressStreet,
    addressZip: b.addressZip,
    addressCity: b.addressCity,
    status: b.status,
    cancellableUntilHours: cancellable ? hoursUntil : null,
    isCancellable: cancellable,
    canReview,
    attachments: b.attachments.map((a) => ({
      id: a.id,
      url: a.url,
      filename: a.filename,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
    })),
    payment: b.payment
      ? {
          id: b.payment.id,
          amount: b.payment.amount,
          currency: b.payment.currency,
          status: b.payment.status as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED',
          paidAt: b.payment.paidAt ? b.payment.paidAt.toISOString() : null,
        }
      : null,
    review: b.review
      ? {
          id: b.review.id,
          stars: b.review.stars,
          text: b.review.text,
          approved: b.review.approved,
          createdAt: b.review.createdAt.toISOString(),
        }
      : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

function compareUpcoming(a: BookingWithRels, b: BookingWithRels): number {
  const sa = bookingStartUTC(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const sb = bookingStartUTC(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return sa - sb;
}

function comparePast(a: BookingWithRels, b: BookingWithRels): number {
  const sa = bookingStartUTC(a)?.getTime() ?? 0;
  const sb = bookingStartUTC(b)?.getTime() ?? 0;
  return sb - sa;
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const me = await getCustomerFromRequest(req);
    if (!me) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const bookings = await prisma.booking.findMany({
      where: { customerId: me.id },
      include: {
        slot: true,
        attachments: { orderBy: { createdAt: 'asc' } },
        payment: true,
        review: true,
      },
    });

    const today = todayInBerlin();

    const upcoming: BookingWithRels[] = [];
    const past: BookingWithRels[] = [];

    for (const b of bookings) {
      // COMPLETED ist immer "past", unabhängig vom Datum.
      if (b.status === 'COMPLETED') {
        past.push(b);
        continue;
      }
      // CANCELLED / REJECTED bleiben in upcoming, solange Termin in der
      // Zukunft — Spec sagt "past" wäre date<today ODER status=COMPLETED.
      // Wir folgen der Spec strikt:
      if (b.date && b.date >= today) {
        upcoming.push(b);
      } else if (b.date && b.date < today) {
        past.push(b);
      } else if (b.slot?.startsAt) {
        if (b.slot.startsAt.getTime() >= Date.now()) upcoming.push(b);
        else past.push(b);
      } else {
        // Termin unbekannt → defensiv upcoming.
        upcoming.push(b);
      }
    }

    upcoming.sort(compareUpcoming);
    past.sort(comparePast);

    return apiSuccess({
      upcoming: upcoming.map(toCustomerBooking),
      past: past.map(toCustomerBooking),
    });
  } catch (err) {
    return internalError(err, 'GET /api/customer/bookings');
  }
}
