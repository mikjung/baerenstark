/**
 * GET /api/reviews — US-29 AC7, AC8 (öffentlich).
 *
 * Liefert alle approved Reviews mit gekürztem Anzeigenamen
 * ("Vorname N." — MAJOR-403-Fix v1.4.1).
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, internalError } from '@/lib/api';
import type { Service } from '@/lib/services';
import { SERVICES } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function publicCustomerName(
  customer: { firstName: string; lastName: string } | null,
): string {
  if (!customer) return 'Anonym';
  const initial = customer.lastName ? `${customer.lastName.charAt(0)}.` : '';
  return `${customer.firstName} ${initial}`.trim();
}

function safeService(slug: string | null | undefined): Service | null {
  if (!slug) return null;
  if ((SERVICES as readonly string[]).includes(slug)) return slug as Service;
  return null;
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const parsedQuery = QuerySchema.safeParse({
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!parsedQuery.success) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: parsedQuery.error.issues[0]?.message ?? 'Ungültiger Query-Parameter',
        field: 'limit',
      });
    }
    const limit = parsedQuery.data.limit ?? 20;

    const [items, totalApproved, statsAgg] = await Promise.all([
      prisma.review.findMany({
        where: { approved: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          customer: { select: { firstName: true, lastName: true } },
          booking: { select: { service: true } },
        },
      }),
      prisma.review.count({ where: { approved: true } }),
      prisma.review.aggregate({
        where: { approved: true },
        _avg: { stars: true },
      }),
    ]);

    const data = {
      items: items.map((r) => ({
        id: r.id,
        customerName: publicCustomerName(r.customer),
        service: safeService(r.booking?.service),
        stars: r.stars,
        text: r.text,
        createdAt: r.createdAt.toISOString(),
      })),
      average: Number((statsAgg._avg.stars ?? 0).toFixed(2)),
      total: totalApproved,
    };

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
