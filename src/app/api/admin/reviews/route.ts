/**
 * GET /api/admin/reviews — US-29 AC6.
 *
 * Liefert alle Bewertungen (approved + pending), inkl. voller Kunden-
 * Identität (für Moderations-Entscheidung). Sortiert nach createdAt desc.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError } from '@/lib/api';
import { SERVICES } from '@/lib/services';
import type { Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QuerySchema = z.object({
  approved: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});

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

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      approved: url.searchParams.get('approved') ?? undefined,
    });
    if (!parsed.success) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'approved muss "true" oder "false" sein.',
        field: 'approved',
      });
    }

    const reviews = await prisma.review.findMany({
      where:
        parsed.data.approved !== undefined
          ? { approved: parsed.data.approved }
          : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        booking: { select: { service: true } },
      },
    });

    return apiSuccess(
      reviews.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        bookingId: r.bookingId,
        customerName: adminCustomerName(r.customer),
        service: safeService(r.booking?.service),
        stars: r.stars,
        text: r.text,
        approved: r.approved,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    return internalError(err);
  }
}
