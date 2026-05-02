/**
 * /api/slots/:id
 *
 * DELETE (admin) — Soft-Delete + atomare PENDING→REJECTED-Migration (BUG-003).
 *   Wenn der Slot CONFIRMED-Bookings hat: 409 CONFLICT (UI muss Tom anbieten,
 *   die Bestätigung zurückzuziehen, dann erneut zu löschen).
 */

import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, apiNoContent, internalError } from '@/lib/api';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
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
      return apiError({ code: 'VALIDATION_ERROR', message: 'Slot-ID fehlt.', field: 'id' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const slot = await tx.slot.findUnique({
        where: { id },
        include: {
          bookings: {
            where: { status: { in: ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'] } },
            select: { id: true, status: true },
          },
        },
      });

      if (!slot || slot.deletedAt !== null) {
        return { type: 'not_found' as const };
      }

      const confirmed = slot.bookings.filter((b) => b.status === 'CONFIRMED');
      if (confirmed.length > 0) {
        return { type: 'conflict' as const };
      }

      const now = new Date();

      // Iteration 2: PENDING und COUNTER_PROPOSED → CANCELLED beim Soft-Delete.
      // Vorschläge werden damit zurückgezogen.
      await tx.booking.updateMany({
        where: {
          slotId: id,
          status: { in: ['PENDING', 'COUNTER_PROPOSED'] },
        },
        data: { status: 'CANCELLED', updatedAt: now },
      });

      await tx.slot.update({
        where: { id },
        data: { deletedAt: now },
      });

      return { type: 'ok' as const };
    });

    if (result.type === 'not_found') {
      return apiError({ code: 'NOT_FOUND', message: 'Slot nicht gefunden.' });
    }
    if (result.type === 'conflict') {
      return apiError({
        code: 'CONFLICT',
        message:
          'Slot hat bestätigte Buchungen. Bitte erst die Bestätigung zurückziehen.',
      });
    }

    try {
      revalidateTag('slots');
    } catch {
      /* ignore */
    }

    return apiNoContent();
  } catch (err) {
    return internalError(err);
  }
}
