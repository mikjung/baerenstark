/**
 * GET /api/reviews — Öffentliche Reviews-Liste (US-29 / IT6 US-IT6-03).
 *
 * IT6 (m1-Resolution, siehe ARCHITECTURE_IT6.md Anhang B §17.5):
 *   - Filter ist verschärft: `WHERE approved=true AND rejectedAt IS NULL`.
 *   - Output-Schema-Bindung: jedes Item wird gegen `PublicReviewSchema.strict()`
 *     geparst, bevor es in die Response geht. Strict verhindert das
 *     versehentliche Leaken von `customerId`, `bookingId`, `userId`,
 *     `moderatedById`, etc.
 *   - Cache-Tag: `public-reviews` — wird invalidiert von
 *     PATCH `/api/admin/reviews/:id` (Approve/Reject) sowie vom Auto-Reject
 *     in PATCH `/api/admin/bookings/:id` (m7).
 *
 * Anzeigename: `"Vorname N."` (Vorname + Nachname-Initial + Punkt). Bei
 * `customerId === null` (anonymisierte Buchung) → `"Anonym"`.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { apiError, internalError } from '@/lib/api';
import type { Service } from '@/lib/services';
import { SERVICES } from '@/lib/services';
import { PublicReviewSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  minStars: z.coerce.number().int().min(1).max(5).optional(),
});

function publicCustomerName(
  customer: { firstName: string; lastName: string } | null,
): string {
  if (!customer) return 'Anonym';
  const initial = customer.lastName
    ? `${customer.lastName.trim().charAt(0).toUpperCase()}.`
    : '';
  return initial
    ? `${customer.firstName.trim()} ${initial}`
    : customer.firstName.trim();
}

function safeService(slug: string | null | undefined): Service | null {
  if (!slug) return null;
  if ((SERVICES as readonly string[]).includes(slug)) return slug as Service;
  return null;
}

// Cached fetch — Tag `public-reviews`.
const getApprovedReviews = unstable_cache(
  async (limit: number, minStars: number) => {
    const [items, totalApproved, statsAgg] = await Promise.all([
      prisma.review.findMany({
        where: {
          approved: true,
          rejectedAt: null,
          stars: { gte: minStars },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          customer: { select: { firstName: true, lastName: true } },
          booking: { select: { service: true } },
        },
      }),
      prisma.review.count({
        where: {
          approved: true,
          rejectedAt: null,
          stars: { gte: minStars },
        },
      }),
      prisma.review.aggregate({
        where: { approved: true, rejectedAt: null },
        _avg: { stars: true },
      }),
    ]);
    return {
      items: items.map((r) =>
        PublicReviewSchema.parse({
          id: r.id,
          customerName: publicCustomerName(r.customer),
          service: safeService(r.booking?.service),
          stars: r.stars,
          text: r.text,
          createdAt: r.createdAt.toISOString(),
        }),
      ),
      total: totalApproved,
      average: Number((statsAgg._avg.stars ?? 0).toFixed(2)),
    };
  },
  ['public-reviews'],
  {
    tags: ['public-reviews'],
    revalidate: 60,
  },
);

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const parsedQuery = QuerySchema.safeParse({
      limit: url.searchParams.get('limit') ?? undefined,
      minStars: url.searchParams.get('minStars') ?? undefined,
    });
    if (!parsedQuery.success) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: parsedQuery.error.issues[0]?.message ?? 'Ungültiger Query-Parameter',
        field: parsedQuery.error.issues[0]?.path[0]?.toString(),
      });
    }
    const limit = parsedQuery.data.limit ?? 20;
    const minStars = parsedQuery.data.minStars ?? 1;

    const data = await getApprovedReviews(limit, minStars);

    return NextResponse.json(
      { data },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (err) {
    return internalError(err);
  }
}
