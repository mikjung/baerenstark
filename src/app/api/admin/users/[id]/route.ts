/**
 * Iteration 6 / US-IT6-07 — Admin-Userverwaltung (Detail + Edit + Delete).
 *
 * GET    /api/admin/users/:id  → Profil + Buchungs-Historie.
 * PATCH  /api/admin/users/:id  → firstName/lastName/phone/adminNote/adminRating.
 *                                 Email-Änderung NICHT zulässig (siehe BUG-402).
 * DELETE /api/admin/users/:id  → Hart-Delete. Buchungen werden via
 *                                 ON DELETE SET NULL anonymisiert.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { UpdateCustomerUserAdminSchema } from '@/lib/schemas';
import {
  apiError,
  apiSuccess,
  apiNoContent,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import { selectCustomerUserAdmin } from '@/lib/dto/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AdminCustomerRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailVerified: boolean;
  oauthProvider: string | null;
  avatarUrl: string | null;
  adminNote: string | null;
  adminRating: number | null;
  // IT9 / US-IT9-02 — Default-Adresse (read-only für Admin).
  streetAndNumber: string | null;
  postalCode: string | null;
  city: string | null;
  createdAt: Date;
  _count?: { bookings: number };
}

function toAdminCustomer(u: AdminCustomerRow & { _count?: { bookings: number } }) {
  return {
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
    // IT9 / US-IT9-02 — Default-Adresse des Kunden, read-only für Tom.
    // Edit-Pfad bleibt customer-only (Profil-Page).
    streetAndNumber: u.streetAndNumber,
    postalCode: u.postalCode,
    city: u.city,
    bookingCount: u._count?.bookings ?? 0,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const { id } = await ctx.params;
    if (!id) {
      return apiError({ code: 'NOT_FOUND', message: 'Kunde nicht gefunden.' });
    }

    const customer = await prisma.customerUser.findUnique({
      where: { id },
      select: {
        ...selectCustomerUserAdmin(),
        _count: { select: { bookings: true } },
      },
    });
    if (!customer) {
      return apiError({ code: 'NOT_FOUND', message: 'Kunde nicht gefunden.' });
    }

    const bookings = await prisma.booking.findMany({
      where: { customerId: id },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        durationMinutes: true,
        service: true,
        description: true,
        addressStreet: true,
        addressZip: true,
        addressCity: true,
        status: true,
        finalPriceEur: true,
        finalPriceNote: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return apiSuccess({
      ...toAdminCustomer(customer),
      bookings: bookings.map((b) => ({
        id: b.id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: b.durationMinutes,
        service: b.service,
        description: b.description,
        addressStreet: b.addressStreet,
        addressZip: b.addressZip,
        addressCity: b.addressCity,
        status: b.status,
        finalPriceEur:
          b.finalPriceEur != null
            ? String(b.finalPriceEur as unknown as string | number)
            : null,
        finalPriceNote: b.finalPriceNote,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    return internalError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const { id } = await ctx.params;
    if (!id) {
      return apiError({ code: 'NOT_FOUND', message: 'Kunde nicht gefunden.' });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    // Zod ohne `.strict()` — aber wir prüfen explizit auf Email-Versuch.
    if (Object.prototype.hasOwnProperty.call(json, 'email')) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'E-Mail-Änderung ist nicht zulässig.',
        field: 'email',
      });
    }

    const data = UpdateCustomerUserAdminSchema.parse(json);

    let updated;
    try {
      updated = await prisma.customerUser.update({
        where: { id },
        data: {
          ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
          ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
          ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
          ...(data.adminNote !== undefined ? { adminNote: data.adminNote ?? null } : {}),
          ...(data.adminRating !== undefined
            ? { adminRating: data.adminRating ?? null }
            : {}),
        },
        select: {
          ...selectCustomerUserAdmin(),
          _count: { select: { bookings: true } },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return apiError({ code: 'NOT_FOUND', message: 'Kunde nicht gefunden.' });
      }
      throw err;
    }

    return apiSuccess(toAdminCustomer(updated));
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const { id } = await ctx.params;
    if (!id) {
      return apiError({ code: 'NOT_FOUND', message: 'Kunde nicht gefunden.' });
    }

    try {
      await prisma.customerUser.delete({ where: { id } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return apiError({ code: 'NOT_FOUND', message: 'Kunde nicht gefunden.' });
      }
      throw err;
    }

    // Booking.customerId wird via ON DELETE SET NULL automatisch
    // anonymisiert (siehe schema.prisma).

    return apiNoContent();
  } catch (err) {
    return internalError(err);
  }
}
