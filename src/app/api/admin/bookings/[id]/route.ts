/**
 * Iteration 6 / US-IT6-08 — PATCH /api/admin/bookings/:id (konsolidiert).
 *
 * Body: `AdminBookingPatchSchema`
 *   {
 *     status?: BookingStatus,
 *     finalPriceEur?: string|number|null,
 *     finalPriceNote?: string|null,
 *   }
 *
 * Verhalten:
 *   - Status-Wechsel folgt der State-Machine (analog `/api/bookings/:id`).
 *   - finalPriceEur akzeptiert "185,00" oder 185 — Schema normalisiert
 *     auf number (oder null = entfernen).
 *   - Cache-Invalidation (m5, §17.9): `revalidateTag('analytics')`,
 *     wenn finalPriceEur geschrieben oder Status zu/von COMPLETED wechselt.
 *   - Auto-Reject Review (m7, §17.11): wenn Buchung aus COMPLETED
 *     herausläuft (z.B. CANCELLED), wird die zugehörige Review automatisch
 *     auf REJECTED gesetzt + `revalidateTag('public-reviews')`.
 *
 * Hinweis: der alte Endpoint `/api/bookings/:id` (PATCH) bleibt als
 * Alias bestehen (siehe §22.5 Hinweis); wir konzentrieren die neue
 * IT6-Logik hier.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { AdminBookingPatchSchema } from '@/lib/schemas';
import {
  apiError,
  apiSuccess,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import {
  sendBookingConfirmationToCustomer,
  sendBookingRejectionToCustomer,
} from '@/lib/mail';
import type { Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ALLOWED_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['REJECTED', 'CANCELLED', 'CONFIRMED', 'COMPLETED'],
  REJECTED: ['CONFIRMED', 'REJECTED'],
  COUNTER_PROPOSED: [
    'CONFIRMED',
    'REJECTED',
    'CANCELLED',
    'COUNTER_PROPOSED',
  ],
  CANCELLED: [],
  COMPLETED: ['COMPLETED', 'CANCELLED'],
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const { id } = await ctx.params;
    if (!id) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Booking-ID fehlt.',
        field: 'id',
      });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    const body = AdminBookingPatchSchema.parse(json);

    // Vorzustand laden inkl. Review für m7.
    const before = await prisma.booking.findUnique({
      where: { id },
      include: {
        slot: true,
        review: { select: { id: true, approved: true, rejectedAt: true } },
      },
    });
    if (!before) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    // Status-Wechsel-Validierung (nur wenn body.status gesetzt).
    if (body.status !== undefined && body.status !== before.status) {
      if (before.status === 'CANCELLED') {
        return apiError({
          code: 'GONE',
          message:
            'Die Buchung wurde storniert; ein Statuswechsel ist nicht mehr möglich.',
        });
      }
      const allowed = ADMIN_ALLOWED_TRANSITIONS[before.status] ?? [];
      if (!allowed.includes(body.status)) {
        return apiError({
          code: 'CONFLICT',
          message: `Übergang von ${before.status} zu ${body.status} ist nicht erlaubt.`,
        });
      }
    }

    // Update-Daten zusammenstellen.
    const updateData: Prisma.BookingUpdateInput = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.finalPriceEur !== undefined) {
      updateData.finalPriceEur =
        body.finalPriceEur === null
          ? null
          : new Prisma.Decimal(body.finalPriceEur);
    }
    if (body.finalPriceNote !== undefined) {
      updateData.finalPriceNote = body.finalPriceNote;
    }

    // Wenn aus COUNTER_PROPOSED in CANCELLED/REJECTED → Slot disconnect.
    if (
      before.status === 'COUNTER_PROPOSED' &&
      (body.status === 'CANCELLED' || body.status === 'REJECTED')
    ) {
      updateData.counterProposalSlot = { disconnect: true };
    }

    // m7 / Auto-Reject-Detection.
    const willCancel =
      body.status === 'CANCELLED' && before.status !== 'CANCELLED';
    const willLeaveCompleted =
      before.status === 'COMPLETED' &&
      body.status !== undefined &&
      body.status !== 'COMPLETED';

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const u = await tx.booking.update({
          where: { id },
          data: updateData,
        });

        // m7-Fix: Auto-Reject der Review.
        if ((willCancel || willLeaveCompleted) && before.review?.id) {
          await tx.review.update({
            where: { id: before.review.id },
            data: {
              approved: false,
              rejectedAt: new Date(),
              moderatedAt: new Date(),
              moderatedById: me.id,
            },
          });
        }

        return u;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return apiError({
          code: 'CONFLICT',
          message: 'Dieser Slot ist bereits anderweitig vergeben.',
        });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
      }
      throw err;
    }

    // Mail-Side-Effects (kompatibel zu /api/bookings/:id).
    if (updated.customerEmail && body.status !== undefined) {
      const slotForMail = before.slot
        ? { startsAt: before.slot.startsAt, endsAt: before.slot.endsAt }
        : null;
      if (before.status === 'PENDING' && updated.status === 'CONFIRMED') {
        void sendBookingConfirmationToCustomer({
          customerName: updated.customerName,
          customerEmail: updated.customerEmail,
          service: updated.service as Service,
          date: updated.date,
          startTime: updated.startTime,
          endTime: updated.endTime,
          slot: slotForMail,
          cancelToken: updated.cancelToken,
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[mail] booking confirmation failed:', err);
        });
      } else if (
        (before.status === 'PENDING' || before.status === 'CONFIRMED') &&
        updated.status === 'REJECTED'
      ) {
        void sendBookingRejectionToCustomer({
          customerName: updated.customerName,
          customerEmail: updated.customerEmail,
          service: updated.service as Service,
          date: updated.date,
          startTime: updated.startTime,
          endTime: updated.endTime,
          slot: slotForMail,
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[mail] booking rejection failed:', err);
        });
      }
    }

    // Cache-Invalidation (m5).
    const finalPriceTouched = body.finalPriceEur !== undefined;
    const statusFlipsCompleted =
      (before.status !== 'COMPLETED' && updated.status === 'COMPLETED') ||
      (before.status === 'COMPLETED' && updated.status !== 'COMPLETED');
    if (finalPriceTouched || statusFlipsCompleted) {
      try {
        revalidateTag('analytics');
      } catch {
        /* ignore */
      }
    }
    if (willCancel || willLeaveCompleted) {
      try {
        revalidateTag('public-reviews');
      } catch {
        /* ignore */
      }
    }
    // Slot-Tags weiterhin invalidieren (Bestand IT3).
    try {
      revalidateTag('slots');
      revalidateTag('available-slots');
    } catch {
      /* ignore */
    }

    return apiSuccess({
      id: updated.id,
      status: updated.status,
      finalPriceEur:
        updated.finalPriceEur != null
          ? String(updated.finalPriceEur as unknown as string | number)
          : null,
      finalPriceNote: updated.finalPriceNote,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
