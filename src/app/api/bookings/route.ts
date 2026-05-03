/**
 * /api/bookings
 *
 * GET  (admin)   — Liste der Buchungen, optional gefiltert nach Status.
 * POST (public)  — Buchungsanfrage anlegen + fire-and-forget Mail-Dispatch.
 *
 * Iteration 5 Änderungen:
 *  - POST akzeptiert `durationMinutes` (US-33). endTime wird im IT3/IT5-
 *    Modus aus `startTime + durationMinutes` als Authority neu berechnet.
 *  - POST akzeptiert Adressfelder (US-32) — Pflicht im IT3/IT5-Modus.
 *  - Race-Condition-Fix BUG-IT5-001: Overlap- und Buffer-Check laufen in
 *    SQLite-Serializable-Transaktion (`lib/booking-create.ts`).
 *  - Ganztag-Auflösung (`durationMinutes === -1`): startTime/endTime werden
 *    auf das Verfügbarkeitsfenster gesetzt.
 *  - GET liefert zusätzlich `durationMinutes` + Adressfelder.
 *
 * Iteration 3:
 *  - POST akzeptiert beide Modi: slotId (Bestand) und date/startTime/endTime.
 *  - POST verknüpft optional übergebene attachmentIds (US-18).
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
  BOOKING_DURATION_ALL_DAY,
} from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { runMailDispatch, type BookingMailPayload } from '@/lib/mail';
import { bookingLimiter, getClientIp } from '@/lib/ratelimit';
import { getAvailabilityForDate } from '@/lib/availability';
import { revalidateTag } from 'next/cache';
import { readCustomerSessionFromRequest } from '@/lib/customer-auth';
import {
  createBookingWithOverlapCheck,
  BookingConflictError,
} from '@/lib/booking-create';
import { addMinutesToTime, timeToMinutes } from '@/lib/time-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/bookings — admin only.
 * Query: ?status=PENDING|CONFIRMED|REJECTED|COUNTER_PROPOSED|CANCELLED|COMPLETED (optional)
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
            'Status muss PENDING, CONFIRMED, REJECTED, COUNTER_PROPOSED, CANCELLED oder COMPLETED sein.',
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
      // IT5 / US-33: Auftragsdauer in Minuten.
      durationMinutes: b.durationMinutes,
      customerId: b.customerId,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      customerEmail: b.customerEmail,
      service: b.service,
      description: b.description,
      // IT5 / US-32: Adressfelder.
      addressStreet: b.addressStreet,
      addressZip: b.addressZip,
      addressCity: b.addressCity,
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
 *   - Modus IT3/IT5: { date, startTime, durationMinutes, address*, ... }
 *   - Modus Bestand: { slotId, ... }
 *
 * Verifizierung (IT3/IT5):
 *   1. Rate-Limit (10/h/IP).
 *   2. Zod-Validierung (CreateBookingSchema mit superRefine).
 *   3. Verfügbarkeitsfenster prüfen.
 *   4. Ganztag-Auflösung (durationMinutes === -1) → startTime/endTime aus
 *      Template/Override.
 *   5. endTime aus durationMinutes neu berechnen (Authority).
 *   6. Window-Check (endTime <= templateEnd).
 *   7. Overlap-Check + Buffer-Check + Insert in Serializable-Transaktion.
 *   8. attachmentIds verknüpfen, fire-and-forget Mail.
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
    const isDateMode = !!(data.date && data.startTime);
    const isSlotMode = !!data.slotId;

    // ---------------------------------------------------------------------
    // IT9 / US-IT9-02 — Adress-Pflicht für eingeloggte Kunden (Date-Modus).
    //
    // AC7: Eingeloggter Kunde ohne Profil-Adresse UND ohne Adresse im
    //      Booking-Body → 400 mit `address_required` (klare Fehlermeldung,
    //      Frontend zeigt Banner mit Link auf /konto/profil).
    //
    // Fallback-Pfad: Wenn der Body keine Adresse mitliefert, der eingeloggte
    // Kunde aber eine Profil-Adresse hat → Profil-Adresse in den Body
    // hineinkopieren (vollständige drei Felder müssen gesetzt sein, sonst
    // greift AC7).
    //
    // Hinweis: Wir lesen die Customer-Session VOR dem Block, damit die
    // existierende `customerSession`-Variable im Insert-Pfad weiter
    // funktioniert.
    // ---------------------------------------------------------------------
    const customerSession = await readCustomerSessionFromRequest(req);

    if (isDateMode && customerSession?.customerId) {
      const bodyHasAddress =
        !!data.addressStreet && !!data.addressZip && !!data.addressCity;
      if (!bodyHasAddress) {
        const profile = await prisma.customerUser.findUnique({
          where: { id: customerSession.customerId },
          select: {
            streetAndNumber: true,
            postalCode: true,
            city: true,
          },
        });
        const profileComplete =
          !!profile &&
          !!profile.streetAndNumber &&
          !!profile.postalCode &&
          !!profile.city;
        if (profileComplete) {
          // Profil-Adresse in den Body übernehmen — beide Naming-Welten
          // (`profile.streetAndNumber → data.addressStreet` etc.).
          data.addressStreet = profile!.streetAndNumber!;
          data.addressZip = profile!.postalCode!;
          data.addressCity = profile!.city!;
        } else {
          // AC7 — Adresse weder im Body noch vollständig im Profil.
          return apiError({
            code: 'VALIDATION_ERROR',
            message:
              'Bitte vervollständige zuerst deine Adresse in deinem Profil.',
            field: 'address_required',
          });
        }
      }
    }

    // ---------------------------------------------------------------------
    // Modus-spezifische Verifizierung
    // ---------------------------------------------------------------------
    let slotForMail: { startsAt: Date; endsAt: Date; description: string | null } | null = null;
    // IT3/IT5: berechnete Termin-Daten nach Ganztag-/Duration-Auflösung.
    let resolvedDate: string | null = null;
    let resolvedStartTime: string | null = null;
    let resolvedEndTime: string | null = null;
    let resolvedDuration: number = 60;

    if (isDateMode) {
      const day = await getAvailabilityForDate(data.date!);
      if (!day.isActive) {
        return apiError({
          code: 'CONFLICT',
          message: 'Der gewählte Tag ist nicht verfügbar. Bitte einen anderen Tag wählen.',
          field: 'date',
        });
      }

      const fenStart = timeToMinutes(day.startTime!);
      const fenEnd = timeToMinutes(day.endTime!);

      // Duration ist im IT3/IT5-Modus Pflicht (Schema enforced).
      const reqDuration = data.durationMinutes;
      if (reqDuration === undefined || reqDuration === null) {
        return apiError({
          code: 'VALIDATION_ERROR',
          message: 'Bitte wählen Sie eine Auftragsdauer.',
          field: 'durationMinutes',
        });
      }

      // ---- Ganztag-Auflösung (US-33 §18.4.5) ----
      if (reqDuration === BOOKING_DURATION_ALL_DAY) {
        resolvedDate = data.date!;
        resolvedStartTime = day.startTime!;
        resolvedEndTime = day.endTime!;
        resolvedDuration = fenEnd - fenStart;
      } else {
        // ---- Standard-Dauer ----
        const startMin = timeToMinutes(data.startTime!);
        const computedEndTime = addMinutesToTime(data.startTime!, reqDuration);
        const endMin = startMin + reqDuration;

        if (startMin < fenStart) {
          return apiError({
            code: 'CONFLICT',
            message: 'Die gewählte Startzeit liegt außerhalb der Verfügbarkeit.',
            field: 'startTime',
          });
        }
        if (endMin > fenEnd) {
          return apiError({
            code: 'CONFLICT',
            message: 'Die gewählte Dauer passt nicht in den verfügbaren Zeitraum.',
            field: 'durationMinutes',
          });
        }

        resolvedDate = data.date!;
        resolvedStartTime = data.startTime!;
        resolvedEndTime = computedEndTime;
        resolvedDuration = reqDuration;

        // Hinweis: bei abweichendem `data.endTime` greift Backend-Authority —
        // wir überschreiben silent mit `computedEndTime` und loggen.
        if (data.endTime && data.endTime !== computedEndTime) {
          console.info(
            `[bookings] endTime corrected from ${data.endTime} to ${computedEndTime} based on durationMinutes=${reqDuration}`,
          );
        }
      }
    } else if (isSlotMode) {
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
    // (IT9 / US-IT9-02: `customerSession` wurde bereits oben für den
    //  Adress-Pflicht-Check gelesen — wir reusen die Variable hier.)
    const customerId = customerSession?.customerId ?? null;

    let bookingId: string;
    let bookingStatus: string;
    let bookingCreatedAt: Date;
    let bookingCancelToken: string;

    if (isDateMode && resolvedDate && resolvedStartTime && resolvedEndTime) {
      // IT3/IT5: Serializable-Transaktion mit Overlap-/Buffer-Check.
      try {
        const created = await createBookingWithOverlapCheck({
          date: resolvedDate,
          startTime: resolvedStartTime,
          endTime: resolvedEndTime,
          durationMinutes: resolvedDuration,
          customerId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          service: data.service,
          description: data.description,
          addressStreet: data.addressStreet ?? null,
          addressZip: data.addressZip ?? null,
          addressCity: data.addressCity ?? null,
        });
        bookingId = created.id;
        bookingStatus = created.status;
        bookingCreatedAt = created.createdAt;
        bookingCancelToken = created.cancelToken;
      } catch (err) {
        if (err instanceof BookingConflictError) {
          return apiError({
            code: 'CONFLICT',
            message: err.message,
          });
        }
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          return apiError({
            code: 'CONFLICT',
            message:
              'Dieses Zeitfenster wurde gerade gebucht. Bitte wählen Sie ein anderes.',
          });
        }
        throw err;
      }
    } else {
      // Slot-Modus (Bestand) — kein Overlap-Check (Slot-FK + Unique reichen).
      try {
        const booking = await prisma.booking.create({
          data: {
            slotId: data.slotId,
            date: null,
            startTime: null,
            endTime: null,
            customerId,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            customerEmail: data.customerEmail,
            service: data.service,
            description: data.description,
            // Adresse im Slot-Modus optional — wir persistieren wenn vorhanden.
            addressStreet: data.addressStreet ?? null,
            addressZip: data.addressZip ?? null,
            addressCity: data.addressCity ?? null,
          },
        });
        bookingId = booking.id;
        bookingStatus = booking.status;
        bookingCreatedAt = booking.createdAt;
        bookingCancelToken = booking.cancelToken;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          return apiError({
            code: 'CONFLICT',
            message:
              'Dieses Zeitfenster wurde gerade gebucht. Bitte wählen Sie ein anderes.',
          });
        }
        throw err;
      }
    }

    // ---------------------------------------------------------------------
    // Attachments verknüpfen
    // ---------------------------------------------------------------------
    if (attachmentIds.length > 0) {
      try {
        await prisma.bookingAttachment.updateMany({
          where: { id: { in: attachmentIds }, bookingId: null },
          data: { bookingId },
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
      bookingId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      service: data.service,
      description: data.description,
      cancelToken: bookingCancelToken,
      slot: slotForMail,
      date: isDateMode ? resolvedDate : null,
      startTime: isDateMode ? resolvedStartTime : null,
      endTime: isDateMode ? resolvedEndTime : null,
    };
    void runMailDispatch(bookingId, mailPayload).catch((err) => {
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
        id: bookingId,
        status: bookingStatus,
        createdAt: bookingCreatedAt.toISOString(),
      },
      201,
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
