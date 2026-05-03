/**
 * Iteration 6 / US-IT6-02 — Admin-Kalender-Aggregator.
 *
 * GET /api/admin/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Aggregator-Endpoint für FullCalendar-Admin-View. Liefert in einem
 * Roundtrip:
 *   - Buchungen (alle aktiven Stati: PENDING, CONFIRMED, COUNTER_PROPOSED, COMPLETED).
 *   - Verfügbarkeitsfenster (Template + DayOverride zusammenkombiniert).
 *   - Buffer-Blöcke nach CONFIRMED-Buchungen.
 *
 * Range-Hard-Limit: 90 Tage (`AdminCalendarEventsQuerySchema`).
 * ISO-8601-Strings mit Berlin-Offset (Sommer-/Winterzeit berücksichtigt).
 * Cache: keiner (Daten ändern sich häufig).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { AdminCalendarEventsQuerySchema } from '@/lib/schemas';
import { apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import { getAvailabilityForDate } from '@/lib/availability';
import { getBufferConfig } from '@/lib/buffer-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    out.push(
      `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`,
    );
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  return out;
}

/**
 * Berlin-Offset-Approximation (DST-aware via Intl).
 * Wir geben einen ISO-Datums-Time-String mit "+02:00" / "+01:00" zurück.
 */
function berlinIso(date: string, time: string): string {
  // Konstruiere als Berlin-lokal — verwende Intl.DateTimeFormat-Trick.
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // UTC-Date korrespondierend zur Berlin-Wallclock-Zeit:
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
  // Bestimme Offset für diesen Zeitpunkt in Berlin.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });
  // Iteratives Bestimmen des Offsets: kleinere Funktion.
  const parts = dtf.formatToParts(new Date(utcGuess));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  const localY = Number(get('year'));
  const localM = Number(get('month'));
  const localD = Number(get('day'));
  const localH = Number(get('hour'));
  const localMin = Number(get('minute'));
  const localUtc = Date.UTC(localY, localM - 1, localD, localH, localMin);
  const diffMin = (utcGuess - localUtc) / (1000 * 60);
  // diffMin ist Wallclock(UTC) - Wallclock(Berlin) bei gleichem Instant.
  // Berlin = UTC + offset → offset = -diffMin
  const offsetMinutes = -diffMin;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offAbs = Math.abs(offsetMinutes);
  const offH = Math.floor(offAbs / 60);
  const offM = offAbs % 60;
  return `${date}T${pad(hh)}:${pad(mm)}:00${sign}${pad(offH)}:${pad(offM)}`;
}

const BOOKING_COLORS: Record<string, string> = {
  PENDING: '#3b82f6',         // blau
  CONFIRMED: '#22c55e',       // grün
  COUNTER_PROPOSED: '#f59e0b', // amber
  COMPLETED: '#6b7280',        // grau
};

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${pad(hh)}:${pad(mm)}`;
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const url = new URL(req.url);
    const parsed = AdminCalendarEventsQuerySchema.parse({
      from: url.searchParams.get('from') ?? '',
      to: url.searchParams.get('to') ?? '',
    });

    const { from, to } = parsed;

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED', 'COMPLETED'] },
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        customerName: true,
        service: true,
        status: true,
        date: true,
        startTime: true,
        endTime: true,
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const dates = eachDate(from, to);

    const events: unknown[] = [];

    // Buchungen + Buffer-Blöcke.
    const bufferCfg = await getBufferConfig();
    for (const b of bookings) {
      if (!b.date || !b.startTime || !b.endTime) continue;
      events.push({
        id: b.id,
        type: 'BOOKING',
        title: `${b.customerName} — ${b.service}`,
        start: berlinIso(b.date, b.startTime),
        end: berlinIso(b.date, b.endTime),
        status: b.status,
        color: BOOKING_COLORS[b.status] ?? '#3b82f6',
        url: `/admin/bookings/${b.id}`,
      });
      if (b.status === 'CONFIRMED' && bufferCfg.bufferMinutes > 0) {
        events.push({
          id: `buf_${b.id}`,
          type: 'BUFFER',
          title: 'Pufferzeit',
          start: berlinIso(b.date, b.endTime),
          end: berlinIso(b.date, addMinutesToTime(b.endTime, bufferCfg.bufferMinutes)),
          color: '#9ca3af',
        });
      }
    }

    // Verfügbarkeits-Fenster pro Tag.
    for (const d of dates) {
      const day = await getAvailabilityForDate(d);
      if (day.isActive && day.startTime && day.endTime) {
        events.push({
          id: `avail_${d}`,
          type: 'AVAILABILITY',
          title: 'Verfügbar',
          start: berlinIso(d, day.startTime),
          end: berlinIso(d, day.endTime),
          display: 'background',
        });
      }
    }

    return apiSuccess({ events });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
