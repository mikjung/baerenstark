/**
 * /api/bookings
 *
 * GET  (admin)   — Liste der Buchungen, optional gefiltert nach Status.
 * POST (public)  — Buchungsanfrage anlegen + fire-and-forget Mail-Dispatch.
 *
 * Iteration 3 Änderungen:
 *  - POST akzeptiert beide Modi: slotId-basiert (Bestand) und
 *    date/startTime/endTime-basiert (US-17, neu).
 *  - POST verknüpft optional übergebene attachmentIds mit der Buchung (US-18).
 *  - Verfügbarkeits-Check für IT3-Modus (DayOverride/Template + Slot-Block).
 *  - GET liefert zusätzlich date/startTime/endTime und attachments.
 *
 * Iteration 2 (Bestand):
 *  - POST antwortet IMMER 201 sobald die Buchung in der DB liegt; Mail
 *    läuft fire-and-forget (BUG US-04 Fix 1).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  CreateBookingSchema,
  BookingStatusSchema,
  type BookingStatus,
  UPLOAD_MAX_FILES_PER_BOOKING,
} from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { runMailDispatch, type BookingMailPayload } from '@/lib/mail';
import { bookingLimiter, getClientIp } from '@/lib/ratelimit';
import { getAvailabilityForDate } from '@/lib/availability';
import { revalidateTag } from 'next/cache';
import { readCustomerSessionFromRequest } from '@/lib/customer-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * GET /api/bookings — admin only.
 * Query: ?status=PENDING|CONFIRMED|REJECTED|COUNTER_PROPOSED|CANCELLED (optional)
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');
    let statusFilter: BookingStatus | undefined;
    if (statusParam) {
      const parsed = BookingStatusSchema.safeParse(statusParam);
      if (!parsed.success) {
        return apiError({
          code: 'VALIDATION_ERROR',
          message:
            'Status muss PENDING, CONFIRMED, REJECTED, COUNTER_PROPOSED oder CANCELLED sein.',
          field: 'status',
        });
      }
      statusFilter = parsed.data;
    }

    const bookings = await prisma.booking.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        slot: true,
        counterProposalSlot: true,
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
        payment: true,
      },
    });

    const data = bookings.map((b) => ({
      id: b.id,
      slot: b.slot
        ? {
            id: b.slot.id,
            startsAt: b.slot.startsAt.toISOString(),
            endsAt: b.slot.endsAt.toISOString(),
            description: b.slot.description,
            deletedAt: b.slot.deletedAt ? b.slot.deletedAt.toISOString() : null,
          }
        : null,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      customerId: b.customerId,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      customerEmail: b.customerEmail,
      service: b.service,
      description: b.description,
      status: b.status,
      mailSent: b.mailSent,
      mailError: b.mailError,
      cancelToken: b.cancelToken,
      counterProposalSlot: b.counterProposalSlot
        ? {
            id: b.counterProposalSlot.id,
            startsAt: b.counterProposalSlot.startsAt.toISOString(),
            endsAt: b.counterProposalSlot.endsAt.toISOString(),
            description: b.counterProposalSlot.description,
          }
        : null,
      attachments: b.attachments.map((a) => ({
        id: a.id,
        url: a.url,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
      payment: b.payment
        ? {
            id: b.payment.id,
            bookingId: b.payment.bookingId,
            stripeSessionId: b.payment.stripeSessionId,
            amount: b.payment.amount,
            currency: b.payment.currency,
            status: b.payment.status as
              | 'PENDING'
              | 'PAID'
              | 'FAILED'
              | 'REFUNDED',
            description: b.payment.description,
            paidAt: b.payment.paidAt ? b.payment.paidAt.toISOString() : null,
            createdAt: b.payment.createdAt.toISOString(),
            updatedAt: b.payment.updatedAt.toISOString(),
          }
        : null,
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
 *
 * Akzeptiert beide Modi:
 *   - Modus IT3 (NEU): { date, startTime, endTime, customerName, ... }
 *   - Modus Bestand:   { slotId, customerName, ... }
 *
 * Verifizierung:
 *   1. Rate-Limit (10/h/IP).
 *   2. Zod-Validierung — superRefine sorgt dafür, dass GENAU einer der
 *      Modi erfüllt ist (sonst 400 mit field-Hinweis).
 *   3. IT3-Modus: Verfügbarkeits-Check (DayOverride/Template + Slot-Block);
 *      Bestand-Modus: Slot existiert und ist nicht soft-deleted.
 *   4. Insert; Race-Condition-Schutz via Partial Unique Index → 409 CONFLICT.
 *   5. attachmentIds verknüpfen (falls übergeben).
 *   6. Sofort 201 Response — Mail läuft fire-and-forget.
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
    const isDateMode = !!(data.date && data.startTime && data.endTime);

    // ---------------------------------------------------------------------
    // Modus-spezifische Verifizierung
    // ---------------------------------------------------------------------
    let slotForMail: { startsAt: Date; endsAt: Date; description: string | null } | null = null;

    if (isDateMode) {
      // IT3-Modus: Verfügbarkeitsfenster prüfen.
      const day = await getAvailabilityForDate(data.date!);
      if (!day.isActive) {
        return apiError({
          code: 'CONFLICT',
          message: 'Der gewählte Tag ist nicht verfügbar. Bitte einen anderen Tag wählen.',
          field: 'date',
        });
      }

      const startMin = timeToMinutes(data.startTime!);
      const endMin = timeToMinutes(data.endTime!);
      const fenStart = timeToMinutes(day.startTime!);
      const fenEnd = timeToMinutes(day.endTime!);

      if (startMin < fenStart || endMin > fenEnd) {
        return apiError({
          code: 'CONFLICT',
          message: 'Das gewählte Zeitfenster liegt außerhalb der Verfügbarkeit.',
          field: 'startTime',
        });
      }

      // Slot-Block-Länge (verhindert "Custom"-Slots).
      if (endMin - startMin !== day.slotDurationMinutes) {
        return apiError({
          code: 'VALIDATION_ERROR',
          message: `Termin muss ${day.slotDurationMinutes} Minuten dauern.`,
          field: 'endTime',
        });
      }
    } else {
      // Bestand-Modus: Slot existiert.
      const slot = await prisma.slot.findUnique({
        where: { id: data.slotId! },
      });
      if (!slot || slot.deletedAt !== null) {
        return apiError({
          code: 'NOT_FOUND',
          message: 'Das gewählte Zeitfenster ist nicht mehr verfügbar.',
          field: 'slotId',
        });
      }
      slotForMail = {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        description: slot.description,
      };
    }

    // ---------------------------------------------------------------------
    // Attachments-Vorvalidierung (US-18)
    // ---------------------------------------------------------------------
    const attachmentIds = data.attachmentIds ?? [];
    if (attachmentIds.length > UPLOAD_MAX_FILES_PER_BOOKING) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: `Maximal ${UPLOAD_MAX_FILES_PER_BOOKING} Dateien pro Buchung.`,
        field: 'attachmentIds',
      });
    }
    if (attachmentIds.length > 0) {
      const existing = await prisma.bookingAttachment.findMany({
        where: { id: { in: attachmentIds } },
        select: { id: true, bookingId: true },
      });
      if (existing.length !== attachmentIds.length) {
        return apiError({
          code: 'NOT_FOUND',
          message: 'Mindestens ein Datei-Anhang konnte nicht gefunden werden.',
          field: 'attachmentIds',
        });
      }
      const alreadyLinked = existing.find((a) => a.bookingId !== null);
      if (alreadyLinked) {
        return apiError({
          code: 'CONFLICT',
          message: 'Mindestens ein Anhang ist bereits einer Buchung zugeordnet.',
          field: 'attachmentIds',
        });
      }
    }

    // ---------------------------------------------------------------------
    // Booking-Insert
    // ---------------------------------------------------------------------
    // IT4 (US-25 AC8): eingeloggte Kunden bekommen ihre Buchung automatisch
    // zugeordnet. Gastbuchungen lassen `customerId` leer.
    const customerSession = await readCustomerSessionFromRequest(req);

    let booking;
    try {
      booking = await prisma.booking.create({
        data: {
          slotId: isDateMode ? null : data.slotId,
          date: isDateMode ? data.date : null,
          startTime: isDateMode ? data.startTime : null,
          endTime: isDateMode ? data.endTime : null,
          customerId: customerSession?.customerId ?? null,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          service: data.service,
          description: data.description,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return apiError({
          code: 'CONFLICT',
          message:
            'Dieses Zeitfenster wurde gerade gebucht. Bitte wählen Sie ein anderes.',
        });
      }
      throw err;
    }

    // ---------------------------------------------------------------------
    // Attachments verknüpfen
    // ---------------------------------------------------------------------
    if (attachmentIds.length > 0) {
      try {
        await prisma.bookingAttachment.updateMany({
          where: { id: { in: attachmentIds }, bookingId: null },
          data: { bookingId: booking.id },
        });
      } catch (err) {
        // Attachment-Linkage darf den 201 nicht kippen — loggen und weiter.
        console.warn('[bookings] attachment link failed:', err);
      }
    }

    // ---------------------------------------------------------------------
    // Fire-and-forget Mail-Dispatch
    // ---------------------------------------------------------------------
    const mailPayload: BookingMailPayload = {
      bookingId: booking.id,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail,
      service: data.service,
      description: booking.description,
      cancelToken: booking.cancelToken,
      slot: slotForMail,
      date: isDateMode ? data.date! : null,
      startTime: isDateMode ? data.startTime! : null,
      endTime: isDateMode ? data.endTime! : null,
    };
    void runMailDispatch(booking.id, mailPayload).catch((err) => {
      console.error('[mail-dispatch] unexpected error:', err);
    });

    try {
      revalidateTag('slots');
      revalidateTag('available-slots');
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
