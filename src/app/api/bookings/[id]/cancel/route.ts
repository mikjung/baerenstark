/**
 * POST /api/bookings/:id/cancel  — IT11 / US-IT11-06.
 *
 * Kanonischer Storno-Endpoint mit Auth-Polymorphismus:
 *   1. `?token=<jwt>` (Scope `booking-cancellation`, strict). Pflicht für
 *      Gast-Storno. Auch für eingeloggte Kunden zulässig.
 *   2. Customer-Session-Cookie + `booking.customerId === me.id`.
 *
 * Idempotent: zweiter Aufruf nach erfolgreichem Cancel → 200 mit
 * `alreadyCancelled: true`, KEINE zweite Mail.
 *
 * 24h-Frist: bei CONFIRMED-Status muss der Termin > 24h in der Zukunft
 * liegen. Bei Verletzung → 409 (auch via Token, schützt vor Last-Minute-
 * Cancel-Missbrauch über alten Mail-Link).
 *
 * Mail-Scanner-Race-Schutz: dieser Endpoint ist STRIKT POST. Ein GET führt
 * nicht zum Cancel. Frontend rendert nur UI; Submit ist explizit (siehe
 * ARCHITECTURE_IT11.md §6.3).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  apiError,
  apiSuccess,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import { CancelBookingBodySchema } from '@/lib/schemas';
import { verifyBookingCancellationToken } from '@/lib/booking-tokens';
import { getCustomerFromRequest } from '@/lib/customer-auth-server';
import { isCancellable } from '@/lib/cancellation';
import { sendCancellationToAdmin } from '@/lib/mail';
import type { Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    // -----------------------------------------------------------------
    // Body parsen (optional `reason`).
    // -----------------------------------------------------------------
    let reason: string | undefined;
    if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
      const json = await req.json().catch(() => null);
      if (json && typeof json === 'object') {
        const parsed = CancelBookingBodySchema.parse(json);
        reason = parsed.reason;
      }
    }

    // -----------------------------------------------------------------
    // Auth — Token zuerst, sonst Cookie.
    // -----------------------------------------------------------------
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    let authorizedViaToken = false;
    let cookieCustomerId: string | null = null;

    if (token) {
      const verify = await verifyBookingCancellationToken(token);
      if (!verify.ok) {
        const message =
          verify.reason === 'TOKEN_EXPIRED'
            ? 'Dieser Storno-Link ist abgelaufen. Bitte rufen Sie 0157-74787512 an.'
            : 'Ungültiger Storno-Link.';
        return apiError({
          code: 'UNAUTHORIZED',
          message,
          subcode: verify.reason,
        });
      }
      if (verify.payload.sub !== id) {
        return apiError({
          code: 'UNAUTHORIZED',
          message: 'Ungültiger Storno-Link.',
          subcode: 'TOKEN_INVALID',
        });
      }
      authorizedViaToken = true;
    } else {
      const me = await getCustomerFromRequest(req);
      if (!me) {
        return apiError({
          code: 'UNAUTHORIZED',
          message: 'Bitte einloggen oder den Link aus der Bestätigungs-E-Mail verwenden.',
        });
      }
      cookieCustomerId = me.id;
    }

    // -----------------------------------------------------------------
    // Booking laden — bestimmt Frist, Ownership-Check, idempotenter Pfad.
    // -----------------------------------------------------------------
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { slot: true },
    });

    if (!booking) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    // Ownership-Hide bei Cookie-Auth (kein 403, kein Existenz-Leak).
    if (!authorizedViaToken) {
      if (booking.customerId === null || booking.customerId !== cookieCustomerId) {
        return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
      }
    }

    // -----------------------------------------------------------------
    // Idempotenz-Vorab-Check: bereits storniert → 200 mit alreadyCancelled.
    // -----------------------------------------------------------------
    if (booking.status === 'CANCELLED') {
      return apiSuccess({
        id: booking.id,
        status: 'CANCELLED',
        cancelledAt: (booking.cancelledAt ?? booking.updatedAt).toISOString(),
        alreadyCancelled: true,
      });
    }

    // -----------------------------------------------------------------
    // Status-Whitelist + 24h-Frist.
    // -----------------------------------------------------------------
    const cancellableStatuses = ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'];
    if (!cancellableStatuses.includes(booking.status)) {
      // REJECTED, COMPLETED, …
      return apiError({
        code: 'CONFLICT',
        message: 'Diese Buchung kann nicht mehr storniert werden.',
      });
    }
    if (!isCancellable(booking)) {
      return apiError({
        code: 'CONFLICT',
        message:
          'Stornierung nicht mehr möglich. Bitte rufen Sie uns an: 0157-74787512.',
        subcode: 'CANCELLATION_DEADLINE_PASSED',
      });
    }

    // -----------------------------------------------------------------
    // Atomarer Conditional-Update — verhindert Race mit parallelem Cancel
    // ODER mit parallelem Booking-POST auf demselben Slot.
    // -----------------------------------------------------------------
    const now = new Date();
    const result = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        status: { in: cancellableStatuses },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancelledBy: 'CUSTOMER',
        cancellationReason: reason ?? null,
        // Mail-Status zurücksetzen, da neue Tom-Mail folgt.
        mailSent: false,
        mailError: null,
      },
    });

    if (result.count === 0) {
      // Race: zwischen `findUnique` und `updateMany` hat ein anderer Pfad
      // den Status verändert. Lade den aktuellen Stand, behandle CANCELLED
      // idempotent, sonst 409.
      const current = await prisma.booking.findUnique({
        where: { id: booking.id },
        select: { status: true, cancelledAt: true, updatedAt: true },
      });
      if (current?.status === 'CANCELLED') {
        return apiSuccess({
          id: booking.id,
          status: 'CANCELLED',
          cancelledAt: (current.cancelledAt ?? current.updatedAt).toISOString(),
          alreadyCancelled: true,
        });
      }
      return apiError({
        code: 'CONFLICT',
        message: 'Diese Buchung kann nicht mehr storniert werden.',
      });
    }

    // -----------------------------------------------------------------
    // Side-Effects (NUR im echten Cancel-Pfad, nie bei Idempotenz).
    // -----------------------------------------------------------------
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
            console.error('[bookings/cancel] db-update failed:', err),
          ),
      )
      .catch((err) =>
        console.error('[bookings/cancel] mail send threw:', err),
      );

    try {
      revalidateTag('slots');
      revalidateTag('available-slots');
    } catch {
      /* ignore */
    }

    return apiSuccess({
      id: booking.id,
      status: 'CANCELLED',
      cancelledAt: now.toISOString(),
      alreadyCancelled: false,
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err, 'POST /api/bookings/:id/cancel');
  }
}
