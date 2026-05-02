/**
 * POST /api/customer/bookings/:id/cancel — US-27.
 *
 * Storniert eine Buchung des eingeloggten Kunden, sofern die 24h-Frist
 * eingehalten ist UND der Status erlaubt (PENDING / CONFIRMED /
 * COUNTER_PROPOSED).
 *
 * Server ist Authority — Frontend-Check ist nur kosmetisch.
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError } from '@/lib/api';
import { getCustomerFromRequest } from '@/lib/customer-auth-server';
import { isCancellable } from '@/lib/cancellation';
import { sendCancellationToAdmin } from '@/lib/mail';
import type { Service } from '@/lib/services';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
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
      include: { slot: true },
    });

    if (!booking || booking.customerId !== me.id) {
      // Ownership-Check: 404 (KEIN 403).
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    // Status-Whitelist (siehe PORTAL_CANCELLABLE_STATUSES) und 24h-Frist.
    if (!isCancellable(booking)) {
      const reachableStatuses = ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'];
      if (!reachableStatuses.includes(booking.status)) {
        return apiError({
          code: 'CONFLICT',
          message: 'Diese Buchung kann nicht mehr storniert werden.',
        });
      }
      // Frist-Verletzung.
      return apiError({
        code: 'CONFLICT',
        message:
          'Stornierung nur bis 24 Stunden vor dem Termin möglich. Bitte rufen Sie uns an: 0157-74787512.',
      });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        // Mail-Status zurücksetzen, weil eine neue Tom-Mail folgt.
        mailSent: false,
        mailError: null,
      },
    });

    // Fire-and-forget Mail an Tom.
    void sendCancellationToAdmin({
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail,
      service: booking.service as Service,
      description: booking.description,
      originalSlot: booking.slot
        ? { startsAt: booking.slot.startsAt, endsAt: booking.slot.endsAt }
        : null,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
    })
      .then((res) =>
        prisma.booking
          .update({
            where: { id: booking.id },
            data: {
              mailSent: res.ok,
              mailError: res.ok ? null : res.error.slice(0, 500),
            },
          })
          .catch((err) =>
            console.error('[customer-cancel] db-update failed:', err),
          ),
      )
      .catch((err) =>
        console.error('[customer-cancel] mail send threw:', err),
      );

    try {
      revalidateTag('slots');
      revalidateTag('available-slots');
    } catch {
      /* ignore */
    }

    return apiSuccess({
      id: updated.id,
      status: updated.status,
      cancelledAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    return internalError(err);
  }
}
