/**
 * Availability-Helpers für Iteration 2 (WeeklyAvailability) und Iteration 3
 * (AvailabilityTemplate, DayOverride, computeAvailableSlots).
 *
 * Berlin-TZ-First: Datums- und Uhrzeit-Strings sind im Berlin-Lokalzeit-
 * Format ("YYYY-MM-DD" / "HH:MM"). Zur Vermeidung von DST-Bugs werden
 * keine UTC-Konvertierungen für Tagesvergleiche durchgeführt.
 */

import { prisma } from './prisma';
import type { AvailableTimeSlot } from './schemas';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_DURATION_ALL_DAY,
} from './schemas';
import { getBufferConfig } from './buffer-config';

const TZ = 'Europe/Berlin';

// ---------------------------------------------------------------------------
// Iteration 2 (Bestand) — WeeklyAvailability
// ---------------------------------------------------------------------------

export async function ensureWeeklyAvailabilitySeed(): Promise<void> {
  const existing = await prisma.weeklyAvailability.findMany({
    select: { dayOfWeek: true },
  });
  const have = new Set(existing.map((d) => d.dayOfWeek));
  const missing: number[] = [];
  for (let day = 0; day < 7; day++) {
    if (!have.has(day)) missing.push(day);
  }
  if (missing.length === 0) return;

  await prisma.$transaction(
    missing.map((day) =>
      prisma.weeklyAvailability.create({
        data: { dayOfWeek: day, isActive: false },
      }),
    ),
  );
}

export async function getAllWeeklyAvailability(): Promise<
  { dayOfWeek: number; isActive: boolean }[]
> {
  await ensureWeeklyAvailabilitySeed();
  const days = await prisma.weeklyAvailability.findMany({
    orderBy: { dayOfWeek: 'asc' },
    select: { dayOfWeek: true, isActive: true },
  });
  return days;
}

// ---------------------------------------------------------------------------
// Iteration 3 — AvailabilityTemplate (US-17)
// ---------------------------------------------------------------------------

const TEMPLATE_ACTIVE_DEFAULTS: Record<number, boolean> = {
  0: false, // Sonntag
  1: true,
  2: true,
  3: true,
  4: true,
  5: true,
  6: false, // Samstag
};

export interface TemplateDay {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}

/**
 * Stellt sicher, dass alle 7 AvailabilityTemplate-Datensätze existieren.
 * Bestehende Werte bleiben unverändert.
 *
 * Übernimmt isActive aus WeeklyAvailability als Initial-Wert (Migration-
 * Helfer, falls die Iteration-3-Seed-Migration nicht gelaufen sein sollte).
 */
export async function ensureAvailabilityTemplateSeed(): Promise<void> {
  const existing = await prisma.availabilityTemplate.findMany({
    select: { dayOfWeek: true },
  });
  const have = new Set(existing.map((d) => d.dayOfWeek));
  const missing: number[] = [];
  for (let day = 0; day < 7; day++) {
    if (!have.has(day)) missing.push(day);
  }
  if (missing.length === 0) return;

  // Versuche, isActive aus WeeklyAvailability zu übernehmen.
  const weekly = await prisma.weeklyAvailability.findMany({
    where: { dayOfWeek: { in: missing } },
    select: { dayOfWeek: true, isActive: true },
  });
  const weeklyMap = new Map(weekly.map((w) => [w.dayOfWeek, w.isActive]));

  await prisma.$transaction(
    missing.map((day) =>
      prisma.availabilityTemplate.create({
        data: {
          dayOfWeek: day,
          isActive: weeklyMap.get(day) ?? TEMPLATE_ACTIVE_DEFAULTS[day] ?? false,
          startTime: '08:00',
          endTime: '17:00',
          slotDurationMinutes: 60,
        },
      }),
    ),
  );
}

/**
 * Liefert alle 7 AvailabilityTemplate-Einträge in aufsteigender Reihenfolge.
 * Seedet on-the-fly, wenn welche fehlen.
 */
export async function getAvailabilityTemplate(): Promise<TemplateDay[]> {
  await ensureAvailabilityTemplateSeed();
  const days = await prisma.availabilityTemplate.findMany({
    orderBy: { dayOfWeek: 'asc' },
    select: {
      dayOfWeek: true,
      isActive: true,
      startTime: true,
      endTime: true,
      slotDurationMinutes: true,
    },
  });
  return days;
}

// ---------------------------------------------------------------------------
// Berlin-TZ-Helfer
// ---------------------------------------------------------------------------

/**
 * Liefert das heutige Datum in Berlin-Lokalzeit als "YYYY-MM-DD".
 * Nutzt `Intl.DateTimeFormat('en-CA', ...)` weil das Format dort genau
 * "YYYY-MM-DD" entspricht.
 */
export function todayInBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

/**
 * Liefert den Wochentag (0..6, Sonntag=0) für ein "YYYY-MM-DD"-Datum
 * (Berlin-Interpretation).
 *
 * Hinweis: Wir parsen das Datum als UTC-Tag und nutzen `getUTCDay()`.
 * Das ist korrekt, weil "YYYY-MM-DD" ein Kalendertag ohne Zeit ist —
 * der Wochentag ist unabhängig von der TZ.
 */
export function weekdayOfDateString(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCDay();
}

// ---------------------------------------------------------------------------
// Iteration 3 — Resolver: Verfügbarkeit für ein konkretes Datum
// ---------------------------------------------------------------------------

export interface ResolvedDay {
  isActive: boolean;
  startTime?: string;
  endTime?: string;
  slotDurationMinutes?: number;
  reason?: string | null;
}

/**
 * Resolviert die Verfügbarkeit für ein konkretes Datum.
 *
 * Reihenfolge:
 *   1. DayOverride hat Vorrang über Template.
 *      - isActive=false → return { isActive: false, reason }
 *      - isActive=true → Override-Zeiten oder Template-Defaults.
 *   2. Sonst: AvailabilityTemplate für den Wochentag.
 *
 * Liefert null, wenn weder Template noch Override existieren — Aufrufer
 * sollten dann einen Default-Tag (inaktiv) zurückgeben.
 */
export async function getAvailabilityForDate(
  date: string,
): Promise<ResolvedDay> {
  const weekday = weekdayOfDateString(date);

  const [override, template] = await Promise.all([
    prisma.dayOverride.findUnique({ where: { date } }),
    prisma.availabilityTemplate.findUnique({ where: { dayOfWeek: weekday } }),
  ]);

  if (override) {
    if (!override.isActive) {
      return { isActive: false, reason: override.reason };
    }
    // Override-Zeiten ODER Template-Defaults.
    return {
      isActive: true,
      startTime: override.startTime ?? template?.startTime ?? '08:00',
      endTime: override.endTime ?? template?.endTime ?? '17:00',
      slotDurationMinutes: template?.slotDurationMinutes ?? 60,
    };
  }

  if (!template || !template.isActive) {
    return { isActive: false };
  }

  return {
    isActive: true,
    startTime: template.startTime,
    endTime: template.endTime,
    slotDurationMinutes: template.slotDurationMinutes,
  };
}

// ---------------------------------------------------------------------------
// Slot-Generierung
// ---------------------------------------------------------------------------

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Generiert alle Zeit-Blöcke (HH:MM) zwischen `startTime` und `endTime`
 * mit der angegebenen Dauer.
 *
 * Beispiel: ("08:00", "10:00", 60) → ["08:00", "09:00"]
 * (letzter Slot 09:00–10:00 endet exakt bei endTime; 10:00–11:00 würde
 * über das Fenster hinausragen und wird nicht generiert).
 */
export function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
): string[] {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const result: string[] = [];
  let cur = startMin;
  while (cur + durationMinutes <= endMin) {
    result.push(minutesToTime(cur));
    cur += durationMinutes;
  }
  return result;
}

/**
 * Liefert die Liste der bereits gebuchten startTimes für ein Datum
 * (Status PENDING/CONFIRMED/COUNTER_PROPOSED).
 */
export async function getBookedTimesForDate(date: string): Promise<string[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      date,
      status: { in: ACTIVE_BOOKING_STATUSES as unknown as string[] },
    },
    select: { startTime: true },
  });
  return bookings
    .map((b) => b.startTime)
    .filter((t): t is string => typeof t === 'string' && t.length > 0);
}

/**
 * Berechnet die verfügbaren Zeit-Slots für ein Datum (IT3 + IT5).
 *
 * 1. Vergangenheit → leeres Array.
 * 2. Resolver liefert Verfügbarkeitsfenster (oder Tag-inaktiv).
 * 3. Schritt = `slotDurationMinutes` aus dem Template (Schrittweite).
 *    Block-Größe = `effectiveDuration`:
 *      - Param `duration` (US-33) ist gesetzt → diese Dauer.
 *      - Param `BOOKING_DURATION_ALL_DAY` (-1) → Fenster komplett.
 *      - sonst → `slotDurationMinutes` (IT3-Verhalten).
 * 4. Aktive Buchungen (PENDING/CONFIRMED/COUNTER_PROPOSED) werden gegen den
 *    Block geprüft (Overlap = `bStart < aEnd && bEnd > aStart`).
 * 5. CONFIRMED-Buchungen blockieren ZUSÄTZLICH den Buffer-Bereich
 *    `[aEnd, aEnd + bufferMinutes)` (US-34). PENDING/COUNTER_PROPOSED
 *    NICHT — Tom hat noch nicht zugesagt.
 */
export async function computeAvailableSlots(
  date: string,
  duration?: number,
): Promise<{
  date: string;
  isDayActive: boolean;
  slots: AvailableTimeSlot[];
  overrideReason?: string | null;
}> {
  const today = todayInBerlin();
  if (date < today) {
    return { date, isDayActive: false, slots: [] };
  }

  const day = await getAvailabilityForDate(date);
  if (!day.isActive) {
    return {
      date,
      isDayActive: false,
      slots: [],
      overrideReason: day.reason ?? null,
    };
  }

  const startTime = day.startTime!;
  const endTime = day.endTime!;
  const stepMinutes = day.slotDurationMinutes!;

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  // IT5: effektive Block-Größe.
  const effectiveDuration =
    duration === BOOKING_DURATION_ALL_DAY
      ? endMin - startMin
      : (duration ?? stepMinutes);

  if (effectiveDuration <= 0 || endMin - startMin < effectiveDuration) {
    return { date, isDayActive: true, slots: [] };
  }

  // Bei Ganztag: genau EIN Block über das gesamte Fenster.
  const blocks: { startTime: string; endTime: string }[] = [];
  if (duration === BOOKING_DURATION_ALL_DAY) {
    blocks.push({
      startTime: minutesToTime(startMin),
      endTime: minutesToTime(endMin),
    });
  } else {
    // Schritt = stepMinutes (Template-Default), Block-Größe = effectiveDuration.
    let cur = startMin;
    while (cur + effectiveDuration <= endMin) {
      blocks.push({
        startTime: minutesToTime(cur),
        endTime: minutesToTime(cur + effectiveDuration),
      });
      cur += stepMinutes;
    }
  }

  // Aktive Buchungen + Buffer-Konfiguration parallel laden.
  const [bookings, bufferCfg] = await Promise.all([
    prisma.booking.findMany({
      where: {
        date,
        status: { in: ACTIVE_BOOKING_STATUSES as unknown as string[] },
      },
      select: { startTime: true, endTime: true, status: true },
    }),
    getBufferConfig(),
  ]);

  const bufferMinutes = bufferCfg.bufferMinutes;

  type ActiveBooking = { startMin: number; endMin: number; status: string };
  const activeBookings: ActiveBooking[] = bookings
    .filter((b) => b.startTime && b.endTime)
    .map((b) => ({
      startMin: timeToMinutes(b.startTime as string),
      endMin: timeToMinutes(b.endTime as string),
      status: b.status,
    }));

  const slots: AvailableTimeSlot[] = blocks.map((b) => {
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);

    let available = true;
    for (const ab of activeBookings) {
      // Buchungs-Overlap.
      if (bStart < ab.endMin && bEnd > ab.startMin) {
        available = false;
        break;
      }
      // Buffer-Overlap (nur nach CONFIRMED).
      if (ab.status === 'CONFIRMED' && bufferMinutes > 0) {
        const bufferEnd = ab.endMin + bufferMinutes;
        if (bStart < bufferEnd && bEnd > ab.endMin) {
          available = false;
          break;
        }
      }
    }
    return {
      startTime: b.startTime,
      endTime: b.endTime,
      available,
    };
  });

  return { date, isDayActive: true, slots };
}
