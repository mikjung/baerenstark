/**
 * /api/bookings
 *
 * GET  (admin)   — Liste der Buchungen, optional gefiltert nach Status.
 * POST (public)  — Buchungsanfrage anlegen + Mail-Versand mit Retry (US-04, US-08).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CreateBookingSchema, BookingStatusSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { sendBookingNotification } from '@/lib/mail';
import { bookingLimiter, getClientIp } from '@/lib/ratelimit';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/bookings — admin only.
 * Query: ?status=PENDING|CONFIRMED|REJECTED (optional)
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');
    let statusFilter: 'PENDING' | 'CONFIRMED' | 'REJECTED' | undefined;
    if (statusParam) {
      const parsed = BookingStatusSchema.safeParse(statusParam);
      if (!parsed.success) {
        return apiError({
          code: 'VALIDATION_ERROR',
          message: 'Status muss PENDING, CONFIRMED oder REJECTED sein.',
          field: 'status',
        });
      }
      statusFilter = parsed.data;
    }

    const bookings = await prisma.booking.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { slot: true },
    });

    const data = bookings.map((b) => ({
      id: b.id,
      slot: {
        id: b.slot.id,
        startsAt: b.slot.startsAt.toISOString(),
        endsAt: b.slot.endsAt.toISOString(),
        description: b.slot.description,
        deletedAt: b.slot.deletedAt ? b.slot.deletedAt.toISOString() : null,
      },
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      customerEmail: b.customerEmail,
      service: b.service,
      description: b.description,
      status: b.status,
      mailSent: b.mailSent,
      mailError: b.mailError,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));

    return apiSuccess(data);
  } catch (err) {
    return internalError(err);
  }
}

/**
 * POST /api/bookings (public).
 *   1. Rate-Limit-Check (10/h/IP, no-op ohne Upstash-Konfig).
 *   2. Zod-Validierung.
 *   3. Slot existiert und ist nicht soft-deleted.
 *   4. Insert; Race-Condition-Schutz via Partial Unique Index → 409 CONFLICT.
 *   5. Mail mit 3-Retry; mailSent/mailError persistieren.
 *   6. 201 Response unabhängig vom Mail-Ergebnis (Buchung steht sicher).
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(req.headers);
    const limit = await bookingLimiter.limit(`booking:${ip}`);
    if (!limit.success) {
      const retryAfter = Math.max(0, Math.ceil((limit.reset - Date.now()) / 1000));
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Anfragen. Bitte später erneut versuchen.',
        headers: { 'Retry-After': String(retryAfter || 600) },
      });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    const data = CreateBookingSchema.parse(json);

    const slot = await prisma.slot.findUnique({
      where: { id: data.slotId },
    });
    if (!slot || slot.deletedAt !== null) {
      return apiError({
        code: 'NOT_FOUND',
        message: 'Das gewählte Zeitfenster ist nicht mehr verfügbar.',
        field: 'slotId',
      });
    }

    let booking;
    try {
      booking = await prisma.booking.create({
        data: {
          slotId: data.slotId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail ?? null,
          service: data.service,
          description: data.description,
          // status default 'PENDING'
          // mailSent default false
        },
      });
    } catch (err) {
      // Partial Unique Index uniq_active_booking_per_slot → P2002.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return apiError({
          code: 'CONFLICT',
          message:
            'Dieses Zeitfenster wurde gerade gebucht. Bitte wählen Sie ein anderes.',
        });
      }
      throw err;
    }

    // Mail-Versand mit Retry. Wir warten auf das Ergebnis, weil wir mailSent/
    // mailError persistieren wollen (Admin-Dashboard-Sichtbarkeit).
    const mailResult = await sendBookingNotification({
      bookingId: booking.id,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail,
      service: data.service,
      description: booking.description,
      slot: {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        description: slot.description,
      },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        mailSent: mailResult.ok,
        mailError: mailResult.ok ? null : mailResult.error.slice(0, 500),
      },
    });

    try {
      revalidateTag('slots');
    } catch {
      /* ignore */
    }

    return apiSuccess(
      {
        id: booking.id,
        status: booking.status,
        createdAt: booking.createdAt.toISOString(),
      },
      201,
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
