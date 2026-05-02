/**
 * Storno-Frist-Algorithmus (Iteration 4 / US-27).
 *
 * Frist: 24h physische Echtzeit (NICHT 24 naïve Berlin-Wand-Uhr-Stunden).
 * Berlin-Zeit-Interpretation via `date-fns-tz` (DST-fest).
 *
 * Siehe ARCHITECTURE.md §17.7 (MAJOR-401-Fix v1.4.1).
 */

import { fromZonedTime } from 'date-fns-tz';
import { PORTAL_CANCELLABLE_STATUSES, type BookingStatus } from './schemas';

const TZ = 'Europe/Berlin';

/**
 * Interpretiert "YYYY-MM-DD" + "HH:MM" als Berlin-Wall-Clock und liefert
 * den entsprechenden UTC-Date. DST-fest:
 *   - Spring-Forward (letzter So März): die Stunde 02:00–03:00 existiert
 *     nicht — `fromZonedTime` liefert die nächst-folgende gültige Wall-Clock.
 *   - Fall-Back (letzter So Oktober): die Stunde 02:00–03:00 existiert
 *     doppelt — wir wählen die SPÄTERE (zweite) Belegung.
 */
export function parseBerlinDateTime(date: string, time: string): Date {
  return fromZonedTime(`${date}T${time}:00`, TZ);
}

/**
 * Liefert den Termin-Zeitpunkt einer Buchung als UTC-Date — oder null,
 * wenn weder `date/startTime` (IT3+) noch `slot.startsAt` (IT1/IT2-Bestand)
 * gesetzt ist.
 */
export function bookingStartUTC(b: {
  date: string | null;
  startTime: string | null;
  slot?: { startsAt: Date } | null;
}): Date | null {
  if (b.date && b.startTime) return parseBerlinDateTime(b.date, b.startTime);
  if (b.slot?.startsAt) return new Date(b.slot.startsAt);
  return null;
}

/**
 * Bewertet, ob eine Buchung im Kundenportal stornierbar ist.
 *
 *   - Status nicht in PORTAL_CANCELLABLE_STATUSES → false.
 *   - Termin unbekannt → true (defensiv; Server prüft erneut).
 *   - CONFIRMED  → true gdw. Differenz > 24h.
 *   - PENDING / COUNTER_PROPOSED → true gdw. Termin in der Zukunft.
 *
 * MAJOR-404-Fix v1.4.1: Null-Robustheit für Buchungen ohne `date` UND
 * ohne `slot`.
 */
export function isCancellable(
  b: {
    status: BookingStatus | string;
    date: string | null;
    startTime: string | null;
    slot?: { startsAt: Date } | null;
  },
  now: Date = new Date(),
): boolean {
  const allowed = (PORTAL_CANCELLABLE_STATUSES as readonly string[]).includes(
    b.status,
  );
  if (!allowed) return false;

  const start = bookingStartUTC(b);
  if (!start) return true;

  const diffMs = start.getTime() - now.getTime();
  if (b.status === 'CONFIRMED') {
    return diffMs > 24 * 60 * 60 * 1000;
  }
  return diffMs > 0;
}

/**
 * Berechnet die verbleibenden Stunden bis zum Termin.
 * Liefert null, wenn der Termin unbekannt ist oder bereits überschritten.
 */
export function hoursUntilStart(
  b: {
    date: string | null;
    startTime: string | null;
    slot?: { startsAt: Date } | null;
  },
  now: Date = new Date(),
): number | null {
  const start = bookingStartUTC(b);
  if (!start) return null;
  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  return Math.floor(diffMs / (60 * 60 * 1000));
}

/**
 * Liefert das heutige Datum in Berlin-TZ als "YYYY-MM-DD".
 * Wird von GET /api/customer/bookings für die upcoming/past-Aufteilung
 * genutzt.
 */
export function todayInBerlin(now: Date = new Date()): string {
  // Nimmt das aktuelle Datum im Berlin-Kalender. Intl.DateTimeFormat
  // liefert die Komponenten zuverlässig in der gewünschten TZ.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now); // en-CA → "YYYY-MM-DD"
}
