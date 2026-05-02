/**
 * /api/bookings/:id  PATCH (admin) — Status setzen mit State-Machine + Idempotenz.
 *
 * State-Machine (BUG-013):
 *   PENDING   → CONFIRMED | REJECTED
 *   CONFIRMED → REJECTED  (oder identisch CONFIRMED → idempotent, kein Update)
 *   REJECTED  → CONFIRMED | REJECTED (idempotent)
 *
 * Bei REJECTED → CONFIRMED kann der Partial Unique Index zuschlagen, wenn
 * inzwischen ein anderes Booking aktiv ist → 409 CONFLICT.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UpdateBookingStatusSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const { status: targetStatus } = UpdateBookingStatusSchema.parse(json);

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    // Idempotenz: gleicher Status → 200 ohne Update, kein updatedAt-Bump.
    if (existing.status === targetStatus) {
      return apiSuccess({
        id: existing.id,
        status: existing.status,
        updatedAt: existing.updatedAt.toISOString(),
      });
    }

    let updated;
    try {
      updated = await prisma.booking.update({
        where: { id },
        data: { status: targetStatus },
      });
    } catch (err) {
      // Partial Unique Index → REJECTED → CONFIRMED konkurriert mit aktivem Eintrag.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return apiError({
          code: 'CONFLICT',
          message: 'Dieser Slot ist bereits anderweitig vergeben.',
        });
      }
      throw err;
    }

    try {
      revalidateTag('slots');
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
