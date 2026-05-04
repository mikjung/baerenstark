/**
 * Booking-Erstellung mit Overlap-/Buffer-Check (Iteration 5).
 *
 * Implementiert §18.5.5 ARCHITECTURE.md (BUG-IT5-001 Fix). Der
 * Overlap-Check, Buffer-Check und Insert laufen in einer SQLite-
 * Serializable-Transaktion (entspricht `BEGIN IMMEDIATE`). Damit werden
 * zwei parallele POSTs auf überlappende Dauern garantiert nacheinander
 * abgearbeitet — der zweite sieht das Insert des ersten und antwortet
 * mit 409 CONFLICT.
 *
 * Verwendet ausschließlich vom POST /api/bookings im IT3/IT5-Modus
 * (mit `date`/`startTime`/`durationMinutes`). Slot-Modus (Bestand IT2)
 * geht nicht durch dieses Modul.
 */

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { addMinutesToTime, timeToMinutes } from './time-utils';
import { getBufferConfig } from './buffer-config';

export class BookingConflictError extends Error {
  readonly code: 'CONFLICT' | 'BUFFER_BLOCKED';
  /**
   * IT10 / STRUCT-3 — optionaler semantischer Subcode für die HTTP-Response.
   * Wird in `src/app/api/bookings/route.ts` als `error.subcode` weitergegeben.
   *
   * Aktuell gesetzt:
   *   - `'BOOKING_SLOT_TAKEN'` bei Overlap-Verstoß (Race-Condition zwischen
   *     Slot-Anzeige und Submit). Frontend mapped primär auf diesen Subcode.
   *
   * Buffer-Konflikte (`code: 'BUFFER_BLOCKED'`) liefern KEINEN Subcode —
   * sie sind kein „Slot belegt"-Race, sondern eine harte Verfügbarkeitsregel.
   */
  readonly subcode?: string;
  constructor(
    message: string,
    code: 'CONFLICT' | 'BUFFER_BLOCKED' = 'CONFLICT',
    subcode?: string,
  ) {
    super(message);
    this.code = code;
    this.subcode = subcode;
    this.name = 'BookingConflictError';
  }
}

export interface CreateBookingTxInput {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  service: string;
  description: string;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
}

export interface CreateBookingTxResult {
  id: string;
  cancelToken: string;
  status: string;
  createdAt: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

/**
 * Wendet den Overlap-/Buffer-Check + Insert atomisch in einer
 * Serializable-Transaktion an.
 *
 * @throws {BookingConflictError} bei Overlap/Buffer-Konflikt.
 * @throws {Prisma.PrismaClientKnownRequestError} bei P2002 Unique-Verletzung
 *   (zweite Verteidigungslinie über `uniq_active_booking_per_timeslot`).
 */
export async function createBookingWithOverlapCheck(
  input: CreateBookingTxInput,
): Promise<CreateBookingTxResult> {
  const reqStart = input.startTime;
  // endTime wird IMMER aus durationMinutes neu berechnet (Authority).
  const reqEnd = addMinutesToTime(input.startTime, input.durationMinutes);
  const reqStartMin = timeToMinutes(reqStart);
  const reqEndMin = timeToMinutes(reqEnd);

  // IT13 / S06 Bugfix:
  // Buffer-Config VOR der Transaktion lesen. Innerhalb der libSQL-/Turso-
  // Transaktion einen separaten globalen Prisma-Client zu benutzen erzeugt
  // eine zweite Connection und führt zu sequenziellen Network-Round-Trips,
  // die Vercels 10s-Function-Limit kosten — Symptom: P2028 „Transaction
  // already closed". Wir lesen die Config einmal vorher und reichen den
  // Wert als Closure in die Transaktion.
  const cfg = await getBufferConfig();
  const bufferMinutes = cfg.bufferMinutes;

  const result = await prisma.$transaction(
    async (tx) => {
      // 1) Overlap-Check gegen aktive Buchungen am gleichen Tag.
      const overlapping = await tx.booking.findFirst({
        where: {
          date: input.date,
          status: { in: ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'] },
          AND: [
            { startTime: { lt: reqEnd } },
            { endTime: { gt: reqStart } },
          ],
        },
        select: { id: true },
      });
      if (overlapping) {
        // IT10 / STRUCT-3: Slot-Konflikt → Subcode `BOOKING_SLOT_TAKEN`.
        // FE-Mapping (verbindlich, contracts/api-routes.md §24.3.1).
        throw new BookingConflictError(
          'Dieser Termin wurde inzwischen leider von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot.',
          'CONFLICT',
          'BOOKING_SLOT_TAKEN',
        );
      }

      // 2) Buffer-Check: gibt es eine CONFIRMED-Buchung, deren
      //    [endTime, endTime + bufferMinutes) mit [reqStart, reqEnd)
      //    überlappt? SQLite kann Minuten-Arithmetik auf "HH:MM" nicht
      //    direkt — wir laden alle CONFIRMED-Buchungen am Tag (max ~5)
      //    und prüfen in JS. `bufferMinutes` ist VOR der Transaktion
      //    eingelesen worden — siehe IT13/S06-Bugfix oberhalb.
      if (bufferMinutes > 0) {
        const confirmed = await tx.booking.findMany({
          where: {
            date: input.date,
            status: 'CONFIRMED',
          },
          select: { startTime: true, endTime: true },
        });
        for (const c of confirmed) {
          if (!c.startTime || !c.endTime) continue;
          const cEnd = timeToMinutes(c.endTime);
          const bufferEnd = cEnd + bufferMinutes;
          if (reqStartMin < bufferEnd && reqEndMin > cEnd) {
            throw new BookingConflictError(
              'Pufferzeit nach bestehender Buchung kollidiert. Bitte einen anderen Termin wählen.',
              'BUFFER_BLOCKED',
            );
          }
        }
      }

      // 3) Insert.
      const created = await tx.booking.create({
        data: {
          slotId: null,
          date: input.date,
          startTime: reqStart,
          endTime: reqEnd,
          durationMinutes: input.durationMinutes,
          customerId: input.customerId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail,
          service: input.service,
          description: input.description,
          addressStreet: input.addressStreet,
          addressZip: input.addressZip,
          addressCity: input.addressCity,
        },
        select: {
          id: true,
          cancelToken: true,
          status: true,
          createdAt: true,
          startTime: true,
          endTime: true,
          durationMinutes: true,
        },
      });

      return created;
    },
    {
      // libSQL/Turso über @prisma/adapter-libsql akzeptiert `isolationLevel`
      // NICHT — der Adapter wirft sonst und der Booking-POST endet in 500
      // (Tom-Feedback IT13). libSQL ist ohnehin single-writer (BEGIN
      // IMMEDIATE-äquivalent), die Serialisierungs-Garantie bleibt erhalten.
      // IT10 / US-IT10-03: timeout/maxWait defensiv erhöht für Turso-Latenz.
      timeout: 10000,
      maxWait: 4000,
    },
  );

  return {
    id: result.id,
    cancelToken: result.cancelToken,
    status: result.status,
    createdAt: result.createdAt,
    startTime: result.startTime as string,
    endTime: result.endTime as string,
    durationMinutes: result.durationMinutes,
  };
}
