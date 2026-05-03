/**
 * Iteration 6 / US-IT6-07 — Admin-Userverwaltung (Liste + Suche).
 *
 * GET /api/admin/users?q=&page=&pageSize=&sort=
 *
 * Sort-Whitelist (m2-Resolution, §17.6):
 *   - lastName_asc (default)
 *   - createdAt_desc
 *   - bookingCount_desc
 *   - adminRating_desc
 *
 * DTO-Schutz (F3-Resolution, §17.3): nutzt `selectCustomerUserAdmin()`.
 * `bookingCount` wird via `_count`-Aggregation ergänzt.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { AdminUsersQuerySchema } from '@/lib/schemas';
import { apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import { selectCustomerUserAdmin } from '@/lib/dto/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const url = new URL(req.url);
    const parsed = AdminUsersQuerySchema.parse({
      q: url.searchParams.get('q') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      sort: url.searchParams.get('sort') ?? undefined,
    });

    const where = parsed.q
      ? {
          OR: [
            { firstName: { contains: parsed.q } },
            { lastName: { contains: parsed.q } },
            { email: { contains: parsed.q } },
          ],
        }
      : {};

    // Sort-Mapping. SQLite case-insensitive Sort wird nur bei
    // String-Cols erzwungen (Prisma kann das via mode: 'insensitive'
    // nicht in SQLite — fallback: native lex-Sort).
    let orderBy: Record<string, 'asc' | 'desc'> | { adminRating: 'desc' }[] = {
      lastName: 'asc',
    };
    if (parsed.sort === 'createdAt_desc') {
      orderBy = { createdAt: 'desc' };
    } else if (parsed.sort === 'adminRating_desc') {
      // adminRating kann NULL sein → NULLs zuletzt durch separate Order.
      // Prisma unterstützt das nur via raw — workaround: ASC für NULLs raus.
      orderBy = { adminRating: 'desc' };
    } else if (parsed.sort === 'bookingCount_desc') {
      // Prisma bietet `orderBy: { bookings: { _count: 'desc' } }`.
      orderBy = { lastName: 'asc' }; // Fallback — wir sortieren unten manuell.
    }

    const total = await prisma.customerUser.count({ where });

    const skip = (parsed.page - 1) * parsed.pageSize;

    let rows;
    if (parsed.sort === 'bookingCount_desc') {
      rows = await prisma.customerUser.findMany({
        where,
        select: {
          ...selectCustomerUserAdmin(),
          _count: { select: { bookings: true } },
        },
        orderBy: [{ bookings: { _count: 'desc' } }, { lastName: 'asc' }],
        skip,
        take: parsed.pageSize,
      });
    } else {
      rows = await prisma.customerUser.findMany({
        where,
        select: {
          ...selectCustomerUserAdmin(),
          _count: { select: { bookings: true } },
        },
        orderBy,
        skip,
        take: parsed.pageSize,
      });
    }

    const data = rows.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      emailVerified: u.emailVerified,
      oauthProvider: u.oauthProvider,
      avatarUrl: u.avatarUrl,
      adminNote: u.adminNote,
      adminRating: u.adminRating,
      // IT9 / US-IT9-02 — Default-Adresse, read-only für Admin-Listing.
      streetAndNumber: u.streetAndNumber,
      postalCode: u.postalCode,
      city: u.city,
      bookingCount: u._count.bookings,
      createdAt: u.createdAt.toISOString(),
    }));

    // IT9 / US-IT9-01: Response-Shape entzerren.
    //
    // Vorher (defekt): `apiSuccess({ data, total, page, pageSize })` →
    //   `{ "data": { "data": [...], "total": …, "page": …, "pageSize": … } }`
    // Der FE-Client typisiert die äußere Hülle als
    // `{ data: CustomerUserAdmin[]; total; page; pageSize }` und reichte das
    // innere Objekt als `users.map(...)` an die Tabelle weiter — TypeError.
    //
    // Jetzt (gefixt): `items`-Feld statt `data` für die Liste, damit der
    // Konflikt mit der `apiSuccess`-Hülle verschwindet. Wire-Format:
    //   `{ "data": { "items": [...], "total": …, "page": …, "pageSize": … } }`
    // Symmetrisch zu IT8-01-Fix für `/admin/admins` (dort ohne Pagination,
    // daher `apiSuccess(array)`; hier mit Pagination, daher Envelope).
    return apiSuccess({
      items: data,
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
