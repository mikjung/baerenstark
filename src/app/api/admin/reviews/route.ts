/**
 * GET /api/admin/reviews — IT6 / US-IT6-03 (verschärft).
 *
 * Liefert alle Bewertungen (auch REJECTED + PENDING_APPROVAL).
 *
 * Iteration 6 Erweiterung (siehe `ARCHITECTURE_IT6.md` §22.3 +
 * `contracts/zod-schemas.ts.AdminReviewsQuerySchema`):
 *   - Filter `?status=PENDING_APPROVAL|APPROVED|REJECTED|<omit>`.
 *   - Mapping:
 *       PENDING_APPROVAL: approved=false AND rejectedAt IS NULL
 *       APPROVED:         approved=true
 *       REJECTED:         approved=false AND rejectedAt IS NOT NULL
 *
 * Output enthält die Audit-Felder `rejectedAt`, `moderatedAt`,
 * `moderatedById`, damit das Admin-UI Status + Verlauf anzeigen kann.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import { AdminReviewsQuerySchema } from '@/lib/schemas';
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

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const url = new URL(req.url);
    const parsed = AdminReviewsQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
    });

    let where: { approved?: boolean; rejectedAt?: { not: null } | null } = {};
    if (parsed.status === 'PENDING_APPROVAL') {
      where = { approved: false, rejectedAt: null };
    } else if (parsed.status === 'APPROVED') {
      where = { approved: true };
    } else if (parsed.status === 'REJECTED') {
      where = { approved: false, rejectedAt: { not: null } };
    }

    const reviews = await prisma.review.findMany({
      where,
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
        // IT6 Audit-Felder:
        rejectedAt: r.rejectedAt ? r.rejectedAt.toISOString() : null,
        moderatedAt: r.moderatedAt ? r.moderatedAt.toISOString() : null,
        moderatedById: r.moderatedById,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
