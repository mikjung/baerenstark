/**
 * PATCH /api/admin/reviews/:id — IT6 / US-IT6-03 (Audit-Spur).
 *
 * Body: `{ approved: boolean }`
 *
 * Verhalten:
 *   - approved=true  → setzt approved=true, rejectedAt=null,
 *                      moderatedAt=now(), moderatedById=me.id.
 *   - approved=false → setzt approved=false, rejectedAt=now(),
 *                      moderatedAt=now(), moderatedById=me.id.
 *
 * Cache-Tag: bei Status-Wechsel `revalidateTag('public-reviews')`,
 * damit `GET /api/reviews` sofort den neuen Stand zeigt.
 *
 * Idempotenz: gleicher `approved`-Wert → 200 ohne DB-Schreiben (außer
 * `moderatedAt` wird nicht erneut gesetzt — das passt zur Spec).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { ApproveReviewSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import { SERVICES } from '@/lib/services';
import type { Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function adminCustomerName(
  customer: { firstName: string; lastName: string } | null,
): string {
  if (!customer) return 'Anonym';
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function safeService(slug: string | null | undefined): Service | null {
  if (!slug) return null;
  if ((SERVICES as readonly string[]).includes(slug)) return slug as Service;
  return null;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const params = await ctx.params;
    const { id } = params;
    if (!id) {
      return apiError({ code: 'NOT_FOUND', message: 'Bewertung nicht gefunden.' });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const data = ApproveReviewSchema.parse(json);

    const existing = await prisma.review.findUnique({
      where: { id },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        booking: { select: { service: true } },
      },
    });
    if (!existing) {
      return apiError({ code: 'NOT_FOUND', message: 'Bewertung nicht gefunden.' });
    }

    let updated = existing;
    const now = new Date();
    const stateChanged =
      existing.approved !== data.approved ||
      (data.approved === false && existing.rejectedAt === null) ||
      (data.approved === true && existing.rejectedAt !== null);

    if (stateChanged) {
      try {
        const refreshed = await prisma.review.update({
          where: { id },
          data: {
            approved: data.approved,
            rejectedAt: data.approved ? null : now,
            moderatedAt: now,
            moderatedById: me.id,
          },
          include: {
            customer: { select: { firstName: true, lastName: true } },
            booking: { select: { service: true } },
          },
        });
        updated = refreshed;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2025'
        ) {
          return apiError({ code: 'NOT_FOUND', message: 'Bewertung nicht gefunden.' });
        }
        throw err;
      }

      // Cache-Invalidation für GET /api/reviews (öffentliche Liste).
      try {
        revalidateTag('public-reviews');
      } catch {
        /* ignore */
      }
    }

    return apiSuccess({
      id: updated.id,
      customerId: updated.customerId,
      bookingId: updated.bookingId,
      customerName: adminCustomerName(updated.customer),
      service: safeService(updated.booking?.service),
      stars: updated.stars,
      text: updated.text,
      approved: updated.approved,
      rejectedAt: updated.rejectedAt ? updated.rejectedAt.toISOString() : null,
      moderatedAt: updated.moderatedAt ? updated.moderatedAt.toISOString() : null,
      moderatedById: updated.moderatedById,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
