/**
 * /api/bookings/:id  PATCH (admin) — Status setzen mit State-Machine + Idempotenz.
 *
 * State-Machine (Iteration 2):
 *   PENDING            → CONFIRMED | REJECTED | CANCELLED
 *   CONFIRMED          → REJECTED  (oder identisch CONFIRMED → idempotent)
 *   REJECTED           → CONFIRMED | REJECTED (idempotent)
 *   COUNTER_PROPOSED   → CONFIRMED | CANCELLED   (Admin-Override; normalerweise via Token)
 *   CANCELLED          → (jeder)              → 410 GONE
 *
 * Iteration 3 (US-24):
 *   Bei PENDING → CONFIRMED → fire-and-forget bookingConfirmationToCustomer.
 *   Bei PENDING/CONFIRMED → REJECTED → fire-and-forget bookingRejectionToCustomer.
 */

import type { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import {
  sendBookingConfirmationToCustomer,
  sendBookingRejectionToCustomer,
} from '@/lib/mail';
import type { Service } from '@/lib/services';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const AdminPatchBookingSchema = z.object({
  status: z.enum(['CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED']),
});

const ADMIN_ALLOWED_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['REJECTED', 'CANCELLED', 'CONFIRMED', 'COMPLETED'],
  REJECTED: ['CONFIRMED', 'REJECTED'],
  COUNTER_PROPOSED: ['CONFIRMED', 'REJECTED', 'CANCELLED', 'COUNTER_PROPOSED'],
  CANCELLED: [],
  COMPLETED: ['COMPLETED'],
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const params = await ctx.params;
    const { id } = params;
    if (!id) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Booking-ID fehlt.', field: 'id' });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const { status: targetStatus } = AdminPatchBookingSchema.parse(json);

    const existing = await prisma.booking.findUnique({
      where: { id },
      include: { slot: true },
    });
    if (!existing) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    if (existing.status === 'CANCELLED') {
      return apiError({
        code: 'GONE',
        message: 'Die Buchung wurde storniert; ein Statuswechsel ist nicht mehr möglich.',
      });
    }

    if (existing.status === targetStatus) {
      return apiSuccess({
        id: existing.id,
        status: existing.status,
        updatedAt: existing.updatedAt.toISOString(),
      });
    }

    const allowed = ADMIN_ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      return apiError({
        code: 'CONFLICT',
        message: `Übergang von ${existing.status} zu ${targetStatus} ist nicht erlaubt.`,
      });
    }

    let updated;
    try {
      const data: Prisma.BookingUpdateInput = { status: targetStatus };
      if (
        existing.status === 'COUNTER_PROPOSED' &&
        (targetStatus === 'CANCELLED' || targetStatus === 'REJECTED')
      ) {
        data.counterProposalSlot = { disconnect: true };
      }

      updated = await prisma.booking.update({
        where: { id },
        data,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return apiError({
          code: 'CONFLICT',
          message: 'Dieser Slot ist bereits anderweitig vergeben.',
        });
      }
      throw err;
    }

    // -------------------------------------------------------------------
    // Iteration 3 / US-24: Kunden-Mail bei Status-Wechsel (fire-and-forget)
    // -------------------------------------------------------------------
    if (updated.customerEmail) {
      const slotForMail = existing.slot
        ? { startsAt: existing.slot.startsAt, endsAt: existing.slot.endsAt }
        : null;

      if (existing.status === 'PENDING' && updated.status === 'CONFIRMED') {
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
          console.warn('[mail] booking confirmation failed:', err);
        });
      } else if (
        (existing.status === 'PENDING' || existing.status === 'CONFIRMED') &&
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
          console.warn('[mail] booking rejection failed:', err);
        });
      }
    }

    try {
      revalidateTag('slots');
      revalidateTag('available-slots');
    } catch {
      /* ignore */
    }

    return apiSuccess({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
