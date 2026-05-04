/**
 * IT12 / US-IT12-15 — GET /api/admin/marketing/recipients
 *
 * Admin-only. Liefert eine paginierte Liste potentieller Empfänger für
 * eine Marketing-Mail. Filter:
 *   - service     — Komma-getrennte Service-Slugs.
 *   - hasBooked   — bool, default true (nur Customer mit ≥1 COMPLETED-Booking).
 *   - unsubscribed — bool. Wenn weggelassen → beide. true → nur abgemeldete,
 *                    false → nur aktive.
 *   - search      — Substring auf E-Mail / firstName / lastName.
 *   - page, limit — Pagination, 1/50, max 200.
 *
 * Response:
 *   { data: MarketingRecipient[], total, page, limit, dailyQuotaRemaining }
 *
 * MarketingRecipient enthält pro Customer die zusammengefasste
 * Service-Historie + Anzahl COMPLETED-Bookings + lastBookingAt.
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.4 (Endpoint #5),
 * backend-requirements-iteration-12.md §S15 / Post-QA Revision.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin } from '@/lib/require-admin';
import { SERVICES, type Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QuerySchema = z.object({
  service: z.string().trim().optional(),
  hasBooked: z
    .union([z.literal('true'), z.literal('false'), z.undefined()])
    .optional(),
  unsubscribed: z
    .union([z.literal('true'), z.literal('false'), z.undefined()])
    .optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const SERVICE_SET = new Set<string>(SERVICES);

/**
 * Ermittelt verbleibendes Tageskontingent für Resend Free (100/Tag).
 * Zählt erfolgreich gesendete `MarketingEmailRecipient.sentAt`-Records ab
 * 00:00 UTC heute. Bewusst UTC, weil Resend selbst UTC-Quotas nutzt.
 */
async function dailyQuotaRemaining(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const sentToday = await prisma.marketingEmailRecipient.count({
    where: { status: 'SENT', sentAt: { gte: startOfDay } },
  });
  return Math.max(0, 100 - sentToday);
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const me = await requireAdmin();
    if ('error' in me) return me.error;

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      service: url.searchParams.get('service') ?? undefined,
      hasBooked: url.searchParams.get('hasBooked') ?? undefined,
      unsubscribed: url.searchParams.get('unsubscribed') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const q = parsed.data;

    // Service-Slug-Validierung.
    let serviceFilter: string[] | null = null;
    if (q.service) {
      const requested = q.service
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const invalid = requested.filter((s) => !SERVICE_SET.has(s));
      if (invalid.length > 0) {
        return apiError({
          code: 'VALIDATION_ERROR',
          message: `Unbekannte Service-Slugs: ${invalid.join(', ')}.`,
          field: 'service',
        });
      }
      serviceFilter = requested;
    }

    // hasBooked default true.
    const hasBooked = q.hasBooked === undefined ? true : q.hasBooked === 'true';

    // 1. Subquery: Customer-IDs mit relevanten COMPLETED-Bookings + Aggregation.
    //
    // Für hasBooked === false können wir den Filter weglassen und alle
    // Customer auflisten (ohne Booking-Aggregation). hasBooked === true
    // (Default) ist der Hauptfall.
    let aggregatedCustomerIds: Set<string> | null = null;
    let bookingsByCustomer = new Map<
      string,
      { services: Set<string>; lastBookingAt: Date | null; count: number }
    >();

    if (hasBooked) {
      const bookings = await prisma.booking.findMany({
        where: {
          status: 'COMPLETED',
          customerId: { not: null },
          ...(serviceFilter ? { service: { in: serviceFilter } } : {}),
        },
        select: {
          customerId: true,
          service: true,
          createdAt: true,
        },
      });

      bookingsByCustomer = new Map();
      for (const b of bookings) {
        if (!b.customerId) continue;
        const entry = bookingsByCustomer.get(b.customerId) ?? {
          services: new Set<string>(),
          lastBookingAt: null,
          count: 0,
        };
        entry.services.add(b.service);
        entry.count += 1;
        if (!entry.lastBookingAt || b.createdAt > entry.lastBookingAt) {
          entry.lastBookingAt = b.createdAt;
        }
        bookingsByCustomer.set(b.customerId, entry);
      }
      aggregatedCustomerIds = new Set(bookingsByCustomer.keys());

      if (aggregatedCustomerIds.size === 0) {
        const remaining = await dailyQuotaRemaining();
        return apiSuccess({
          data: [],
          total: 0,
          page: q.page,
          limit: q.limit,
          dailyQuotaRemaining: remaining,
        });
      }
    }

    // 2. Customer laden (mit ggf. Service-Filter via Subquery-Set).
    const where: Record<string, unknown> = {};
    if (aggregatedCustomerIds) {
      where.id = { in: Array.from(aggregatedCustomerIds) };
    }
    if (q.unsubscribed === 'true') {
      where.unsubscribedAt = { not: null };
    } else if (q.unsubscribed === 'false') {
      where.unsubscribedAt = null;
    }
    if (q.search) {
      const s = q.search;
      where.OR = [
        { email: { contains: s.toLowerCase() } },
        { firstName: { contains: s } },
        { lastName: { contains: s } },
      ];
    }

    const total = await prisma.customerUser.count({ where });
    const skip = (q.page - 1) * q.limit;

    const customers = await prisma.customerUser.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take: q.limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        unsubscribedAt: true,
      },
    });

    // 3. Wenn hasBooked=false: Service-Historie trotzdem mit-laden, damit das
    //    Frontend die Service-Tags rendern kann (best-effort, optional).
    if (!hasBooked) {
      const ids = customers.map((c) => c.id);
      if (ids.length > 0) {
        const allBookings = await prisma.booking.findMany({
          where: {
            customerId: { in: ids },
            status: 'COMPLETED',
            ...(serviceFilter ? { service: { in: serviceFilter } } : {}),
          },
          select: { customerId: true, service: true, createdAt: true },
        });
        for (const b of allBookings) {
          if (!b.customerId) continue;
          const entry = bookingsByCustomer.get(b.customerId) ?? {
            services: new Set<string>(),
            lastBookingAt: null,
            count: 0,
          };
          entry.services.add(b.service);
          entry.count += 1;
          if (!entry.lastBookingAt || b.createdAt > entry.lastBookingAt) {
            entry.lastBookingAt = b.createdAt;
          }
          bookingsByCustomer.set(b.customerId, entry);
        }
      }
    }

    // 4. Zusammenstellen.
    const data = customers.map((c) => {
      const agg = bookingsByCustomer.get(c.id);
      const services: Service[] = agg
        ? (Array.from(agg.services).filter((s) => SERVICE_SET.has(s)) as Service[]).sort()
        : [];
      return {
        customerId: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        bookedServices: services,
        completedBookingCount: agg?.count ?? 0,
        lastBookingAt: agg?.lastBookingAt
          ? agg.lastBookingAt.toISOString()
          : null,
        unsubscribedAt: c.unsubscribedAt
          ? c.unsubscribedAt.toISOString()
          : null,
      };
    });

    const remaining = await dailyQuotaRemaining();
    return apiSuccess({
      data,
      total,
      page: q.page,
      limit: q.limit,
      dailyQuotaRemaining: remaining,
    });
  } catch (err) {
    return internalError(err, 'GET /api/admin/marketing/recipients');
  }
}
