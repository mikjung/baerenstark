/**
 * /api/admin/upcoming-bookings — US-21 (Iteration 3).
 *
 * GET (admin) — Liefert zukünftige bestätigte (CONFIRMED) Termine sortiert
 * nach Datum (aufsteigend), für das Admin-Dashboard.
 *
 * Query: ?limit=20&from=today (limit optional, default 10; from optional)
 *
 * Sortierung & Mergen:
 *  - IT3-Buchungen (date != null): nach (date, startTime).
 *  - Bestand-Buchungen (slot != null): nach slot.startsAt.
 *  - Beide werden in eine gemeinsame Liste gemerged und nach Datum sortiert.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  apiError,
  apiSuccess,
  internalError,
} from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import { todayInBerlin } from '@/lib/availability';
import { getBufferConfig } from '@/lib/buffer-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/** UTC-Start des heutigen Berlin-Tages (für slot-basierte Bestand-Bookings). */
function startOfTodayBerlinUTC(): Date {
  // Today in Berlin als "YYYY-MM-DD"
  const today = todayInBerlin();
  // Wir nutzen eine pragmatische Annäherung: heute 00:00 Berlin entspricht
  // im UTC heute 22:00/23:00 vorgestern (DST-abhängig). Für die WHERE-Clause
  // genügt es, alles ab "heute Berlin 00:00" zu matchen — wir nutzen den
  // einfachen Vergleich slot.startsAt >= heute UTC 00:00 als untere Schranke,
  // weil slot.startsAt in der DB als UTC gespeichert ist, aber Tom Termine
  // mit Berlin-Zeit anlegt — der Unterschied (1-2h) wird durch die Sortierung
  // korrigiert; im Worst Case zeigt das Dashboard 1-2 Termine, die heute sehr
  // früh waren, was akzeptabel ist (Tom sieht sowieso Datum & Uhrzeit).
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 2 * 60 * 60 * 1000);
}

interface UpcomingBookingItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  /** IT5 / US-33: Auftragsdauer in Minuten. */
  durationMinutes: number;
  customerName: string;
  customerPhone: string;
  service: string;
  /** IT5 / US-32: Adressfelder, nullable für Bestand. */
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  /** IT5 / US-34: globaler Buffer-Wert (für Kalender-Visualisierung). */
  bufferMinutes: number;
  isToday: boolean;
  /** Sortierschlüssel — nicht im Output. */
  _sortKey: string;
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    // IT14 / S02 — `requireAdmin()` statt `auth()` (DISABLED-Check + 401/403-Konsistenz).
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Ungültige Query',
        field: parsed.error.issues[0]?.path[0]?.toString(),
      });
    }
    const { limit } = parsed.data;
    const today = todayInBerlin();
    const bufferCfg = await getBufferConfig();
    const bufferMinutes = bufferCfg.bufferMinutes;

    // 1) IT3-Modus: date != null und date >= today.
    const it3Bookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        date: { not: null, gte: today },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: limit,
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        durationMinutes: true,
        customerName: true,
        customerPhone: true,
        service: true,
        addressStreet: true,
        addressZip: true,
        addressCity: true,
      },
    });

    // 2) Bestand-Modus: slotId != null und slot.startsAt >= today (Berlin).
    const startOfToday = startOfTodayBerlinUTC();
    const slotBookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        date: null,
        slotId: { not: null },
        slot: { startsAt: { gte: startOfToday } },
      },
      orderBy: { slot: { startsAt: 'asc' } },
      take: limit,
      include: {
        slot: { select: { startsAt: true, endsAt: true } },
      },
    });

    const items: UpcomingBookingItem[] = [];

    for (const b of it3Bookings) {
      if (!b.date || !b.startTime || !b.endTime) continue;
      items.push({
        id: b.id,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: b.durationMinutes,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        service: b.service,
        addressStreet: b.addressStreet,
        addressZip: b.addressZip,
        addressCity: b.addressCity,
        bufferMinutes,
        isToday: b.date === today,
        _sortKey: `${b.date}T${b.startTime}`,
      });
    }

    const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' });
    const fmtTime = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    for (const b of slotBookings) {
      if (!b.slot) continue;
      const dateStr = fmtDate.format(b.slot.startsAt);
      const startStr = fmtTime.format(b.slot.startsAt).replace('.', ':');
      const endStr = fmtTime.format(b.slot.endsAt).replace('.', ':');
      items.push({
        id: b.id,
        date: dateStr,
        startTime: startStr,
        endTime: endStr,
        durationMinutes: b.durationMinutes,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        service: b.service,
        addressStreet: b.addressStreet,
        addressZip: b.addressZip,
        addressCity: b.addressCity,
        bufferMinutes,
        isToday: dateStr === today,
        _sortKey: `${dateStr}T${startStr}`,
      });
    }

    // Mergen + sortieren + limit.
    items.sort((a, b) => a._sortKey.localeCompare(b._sortKey));
    const result = items.slice(0, limit).map(({ _sortKey: _omit, ...rest }) => rest);

    return apiSuccess(result);
  } catch (err) {
    return internalError(err);
  }
}
