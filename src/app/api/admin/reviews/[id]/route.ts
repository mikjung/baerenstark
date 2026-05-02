/**
 * PATCH /api/admin/reviews/:id — US-29 AC6, AC7.
 *
 * Setzt `approved` auf true (Freigabe) oder false (Rückzug).
 * Idempotenz: gleicher Wert → 200 ohne DB-Schreiben.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ApproveReviewSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
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
    const session = await auth();
    if (!session?.user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

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
    if (existing.approved !== data.approved) {
      try {
        updated = await prisma.review.update({
          where: { id },
          data: { approved: data.approved },
          include: {
            customer: { select: { firstName: true, lastName: true } },
            booking: { select: { service: true } },
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2025'
        ) {
          return apiError({ code: 'NOT_FOUND', message: 'Bewertung nicht gefunden.' });
        }
        throw err;
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
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
