/**
 * Iteration 6 / US-IT6-02 — Öffentlicher Kalender-Tag-Status-Feed.
 * Iteration 12 / US-IT12-03 — Performance-Optimierung (N+1 → Batch).
 *
 * GET /api/availability/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&serviceId=...
 *
 * Pro Tag im Range den Status:
 *   - 'available':   irgend ein Slot im Tag noch buchbar.
 *   - 'partial':     Tag aktiv, aber alle Slots durch Buchungen+Buffer belegt
 *                    (Default-Dauer).
 *   - 'unavailable': Tag inaktiv (Template `isActive=false` oder DayOverride
 *                    `isActive=false`).
 *
 * Range-Hard-Limit: 62 Tage (siehe `AvailabilityCalendarQuerySchema`).
 *
 * `serviceId` ist reserviert für IT7 — MVP ignoriert ihn.
 *
 * Cache: `public, max-age=60, s-maxage=300, stale-while-revalidate=600`.
 *
 * IT12-S03 — Root-Cause des „nicht klickbar"-Bugs:
 *   Vor IT12 lief pro Tag eine eigene `getAvailabilityForDate()`-Kaskade
 *   (2 Queries pro Tag, ≈124 Queries für 62 Tage) plus pro Tag
 *   `computeAvailableSlots()` (weitere 2 Queries) → ~248 sequentielle
 *   Queries gegen Turso pro Aufruf. Bei einer Latenz von 30-50ms pro Query
 *   gegen die Edge-Region → mehrere Sekunden, Frontend rendert lange einen
 *   Spinner und wirkt „nicht klickbar".
 *
 *   Fix: Batch-Lade aller relevanten Tabellen einmalig
 *   (`bookings WHERE date IN (...)`, `dayOverrides WHERE date IN (...)`,
 *    `availabilityTemplate.findMany`, `bufferConfig.findFirst`),
 *   Aggregation in Memory pro Tag.
 *
 *   Performance-Target (R.8): p95 < 300ms gegen Turso eu-west bei 62-Tage-
 *   Range, 100 Bookings, kalter Cache.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  AvailabilityCalendarQuerySchema,
  ACTIVE_BOOKING_STATUSES,
  BUFFER_MINUTES_DEFAULT,
} from '@/lib/schemas';
import { todayInBerlin, weekdayOfDateString } from '@/lib/availability';
import { timeToMinutes } from '@/lib/time-utils';
import { apiError, internalError, zodErrorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Berlin-only — wir bleiben bei String-Vergleichen für Tagesgrenzen.

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function eachDate(from: string, to: string): string[] {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const dt = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  const out: string[] = [];
  while (dt.getTime() <= end.getTime()) {
    out.push(`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`);
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  return out;
}

interface ResolvedWindow {
  isActive: boolean;
  startTime?: string;
  endTime?: string;
  slotDurationMinutes?: number;
}

/**
 * In-Memory-Resolver: nutzt vorgeladene Maps (kein DB-Zugriff).
 */
function resolveWindow(
  date: string,
  templateByDayOfWeek: Map<number, { isActive: boolean; startTime: string; endTime: string; slotDurationMinutes: number }>,
  overrideByDate: Map<string, { isActive: boolean; startTime: string | null; endTime: string | null }>,
): ResolvedWindow {
  const override = overrideByDate.get(date);
  const tpl = templateByDayOfWeek.get(weekdayOfDateString(date));

  if (override) {
    if (!override.isActive) return { isActive: false };
    return {
      isActive: true,
      startTime: override.startTime ?? tpl?.startTime ?? '08:00',
      endTime: override.endTime ?? tpl?.endTime ?? '17:00',
      slotDurationMinutes: tpl?.slotDurationMinutes ?? 60,
    };
  }
  if (!tpl || !tpl.isActive) return { isActive: false };
  return {
    isActive: true,
    startTime: tpl.startTime,
    endTime: tpl.endTime,
    slotDurationMinutes: tpl.slotDurationMinutes,
  };
}

interface BookingLite {
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
}

/**
 * Berechnet pro Tag, ob mindestens ein Slot frei ist (Default-Dauer =
 * `slotDurationMinutes`). Gibt 'available' / 'partial' / 'unavailable'.
 */
function computeDayStatus(
  date: string,
  win: ResolvedWindow,
  bookingsForDay: BookingLite[],
  bufferMinutes: number,
): 'available' | 'partial' | 'unavailable' {
  if (!win.isActive) return 'unavailable';
  const startMin = timeToMinutes(win.startTime!);
  const endMin = timeToMinutes(win.endTime!);
  const step = win.slotDurationMinutes!;
  const blockSize = step;

  if (blockSize <= 0 || endMin - startMin < blockSize) return 'partial';

  // Aktive Buchungen mit gefüllten Zeiten in Minuten konvertieren.
  type ActiveBooking = { startMin: number; endMin: number; status: string };
  const active: ActiveBooking[] = [];
  for (const b of bookingsForDay) {
    if (!b.startTime || !b.endTime) continue;
    active.push({
      startMin: timeToMinutes(b.startTime),
      endMin: timeToMinutes(b.endTime),
      status: b.status,
    });
  }

  // Slots iterieren — bei Default-Dauer entspricht Step = blockSize.
  let cur = startMin;
  while (cur + blockSize <= endMin) {
    const bStart = cur;
    const bEnd = cur + blockSize;
    let available = true;
    for (const ab of active) {
      // Booking-Overlap.
      if (bStart < ab.endMin && bEnd > ab.startMin) {
        available = false;
        break;
      }
      // Buffer-Block (nur nach CONFIRMED).
      if (ab.status === 'CONFIRMED' && bufferMinutes > 0) {
        const bufferEnd = ab.endMin + bufferMinutes;
        if (bStart < bufferEnd && bEnd > ab.endMin) {
          available = false;
          break;
        }
      }
    }
    if (available) return 'available';
    cur += step;
  }
  return 'partial';
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const parsed = AvailabilityCalendarQuerySchema.parse({
      from: url.searchParams.get('from') ?? '',
      to: url.searchParams.get('to') ?? '',
      serviceId: url.searchParams.get('serviceId') ?? undefined,
    });

    const dates = eachDate(parsed.from, parsed.to);
    const today = todayInBerlin();

    // ---- BATCH-LOAD (einmalig, parallel) ----
    const [bookings, overrides, templates, bufferCfg] = await Promise.all([
      prisma.booking.findMany({
        where: {
          date: { in: dates },
          status: { in: ACTIVE_BOOKING_STATUSES as unknown as string[] },
        },
        select: {
          date: true,
          startTime: true,
          endTime: true,
          status: true,
        },
      }),
      prisma.dayOverride.findMany({
        where: { date: { in: dates } },
        select: {
          date: true,
          isActive: true,
          startTime: true,
          endTime: true,
        },
      }),
      prisma.availabilityTemplate.findMany({
        select: {
          dayOfWeek: true,
          isActive: true,
          startTime: true,
          endTime: true,
          slotDurationMinutes: true,
        },
      }),
      prisma.bufferConfig.findFirst({ select: { bufferMinutes: true } }),
    ]);

    // ---- IN-MEMORY MAPS ----
    const templateByDayOfWeek = new Map<number, { isActive: boolean; startTime: string; endTime: string; slotDurationMinutes: number }>();
    for (const t of templates) {
      templateByDayOfWeek.set(t.dayOfWeek, {
        isActive: t.isActive,
        startTime: t.startTime,
        endTime: t.endTime,
        slotDurationMinutes: t.slotDurationMinutes,
      });
    }
    const overrideByDate = new Map<string, { isActive: boolean; startTime: string | null; endTime: string | null }>();
    for (const o of overrides) {
      overrideByDate.set(o.date, {
        isActive: o.isActive,
        startTime: o.startTime,
        endTime: o.endTime,
      });
    }
    const bookingsByDate = new Map<string, BookingLite[]>();
    for (const b of bookings) {
      if (!b.date) continue;
      const arr = bookingsByDate.get(b.date) ?? [];
      arr.push({
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
      });
      bookingsByDate.set(b.date, arr);
    }

    const bufferMinutes = bufferCfg?.bufferMinutes ?? BUFFER_MINUTES_DEFAULT;

    // ---- AGGREGATE PER DAY ----
    const days = dates.map((date) => {
      // Vergangenheit → unavailable.
      if (date < today) {
        return { date, status: 'unavailable' as const };
      }
      const win = resolveWindow(date, templateByDayOfWeek, overrideByDate);
      if (!win.isActive) {
        return { date, status: 'unavailable' as const };
      }
      const dayBookings = bookingsByDate.get(date) ?? [];
      const status = computeDayStatus(date, win, dayBookings, bufferMinutes);
      return { date, status };
    });

    return NextResponse.json(
      { data: { days } },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    if (err instanceof Error && err.name === 'ZodError') {
      return apiError({ code: 'VALIDATION_ERROR', message: err.message });
    }
    return internalError(err, 'GET /api/availability/calendar');
  }
}
