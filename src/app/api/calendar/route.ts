/**
 * /api/calendar  GET (public) — US-16.
 *
 * Liefert für jeden Tag eines Monats:
 *   { date: "YYYY-MM-DD", available: boolean, slotIds: string[] }
 *
 * Logik (Berlin-TZ):
 *   weeklyActive = WeeklyAvailability(weekday).isActive
 *   hasConfirmedBlocker = ∃ Booking { status='CONFIRMED', slot.startsAt fällt in den Tag }
 *   isFuture = date > heute (Berlin-Tag-Vergleich)
 *
 *   available = weeklyActive AND NOT hasConfirmedBlocker AND isFuture
 *
 * slotIds: alle nicht-soft-deleted Slots an diesem Tag, die KEINE aktive
 * Buchung (PENDING/CONFIRMED/COUNTER_PROPOSED) haben.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { CalendarQuerySchema } from '@/lib/schemas';
import {
  apiError,
  apiSuccess,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import {
  berlinDateStartUtc,
  daysInMonth,
  formatDateInBerlin,
  pad2,
  weekdayInBerlin,
} from '@/lib/calendar';
import { getAllWeeklyAvailability } from '@/lib/availability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'];

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const parsed = CalendarQuerySchema.safeParse({
      year: url.searchParams.get('year'),
      month: url.searchParams.get('month'),
    });
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }
    const { year, month } = parsed.data;

    // Monatsgrenzen in Berlin → in UTC umrechnen.
    const monthStartUtc = berlinDateStartUtc(year, month, 1);
    const monthEndUtc = berlinDateStartUtc(year, month, daysInMonth(year, month) + 1); // exklusive Obergrenze

    const [weekly, slots, confirmedBookings] = await Promise.all([
      getAllWeeklyAvailability(),
      prisma.slot.findMany({
        where: {
          deletedAt: null,
          startsAt: { gte: monthStartUtc, lt: monthEndUtc },
        },
        include: {
          bookings: {
            where: { status: { in: ACTIVE_STATUSES } },
            select: { id: true },
          },
        },
      }),
      prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          slot: {
            startsAt: { gte: monthStartUtc, lt: monthEndUtc },
            deletedAt: null,
          },
        },
        include: { slot: true },
      }),
    ]);

    const activeWeekdays = new Set(
      weekly.filter((d) => d.isActive).map((d) => d.dayOfWeek),
    );

    // Map: ISO-Datum (YYYY-MM-DD, Berlin) → Liste von Slot-IDs (frei).
    const slotsByDate = new Map<string, string[]>();
    for (const s of slots) {
      const dateKey = formatDateInBerlin(s.startsAt);
      if (s.bookings.length > 0) {
        // Slot belegt → trotzdem Map-Eintrag, aber ohne Slot-ID.
        if (!slotsByDate.has(dateKey)) slotsByDate.set(dateKey, []);
      } else {
        const arr = slotsByDate.get(dateKey) ?? [];
        arr.push(s.id);
        slotsByDate.set(dateKey, arr);
      }
    }

    // Set: Tage mit CONFIRMED-Booking als Blocker.
    const blockedDates = new Set<string>();
    for (const b of confirmedBookings) {
      if (!b.slot) continue;
      blockedDates.add(formatDateInBerlin(b.slot.startsAt));
    }

    const today = formatDateInBerlin(new Date());
    const totalDays = daysInMonth(year, month);
    const days: { date: string; available: boolean; slotIds: string[] }[] = [];

    for (let d = 1; d <= totalDays; d++) {
      const date = `${year}-${pad2(month)}-${pad2(d)}`;
      // Mittagszeit als Pivot, um den Berliner Wochentag stabil zu bestimmen.
      const pivot = berlinDateStartUtc(year, month, d);
      // pivot ist 00:00 Berlin → wir wollen den Wochentag desselben Tages, nicht den Vortag.
      // Da wir das Berliner Mitternachts-UTC genommen haben, liefert weekdayInBerlin
      // (das eine en-US-formatierte Wochentag-Abkürzung in Berlin-TZ holt) genau
      // den richtigen Wochentag.
      const weekday = weekdayInBerlin(pivot);
      const weeklyActive = activeWeekdays.has(weekday);
      const hasBlocker = blockedDates.has(date);
      const isFuture = date > today;

      const slotIds = slotsByDate.get(date) ?? [];
      const available = weeklyActive && !hasBlocker && isFuture;

      days.push({ date, available, slotIds });
    }

    return apiSuccess({ year, month, days });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
