/**
 * Iteration 6 / US-IT6-09 — Analytics-Aggregationen für Admin-Konsole.
 *
 * Server-Side-Aggregations + Tag-Cache (m5-Resolution, siehe
 * `ARCHITECTURE_IT6.md` Anhang B §17.9):
 *
 *   - On-Demand-Cache via `unstable_cache(..., { tags: ['analytics'],
 *     revalidate: 300 })`.
 *   - PATCH `/api/admin/bookings/:id` ruft `revalidateTag('analytics')`,
 *     wenn `finalPriceEur` geschrieben wurde oder `status` zu/von
 *     `COMPLETED` wechselt → Tom sieht Wert sofort.
 *
 * Umsatz-Definition (verbindlich, US-IT6-09):
 *   Umsatz = Summe `finalPriceEur` aller `Booking` mit `status='COMPLETED'`
 *   im gewünschten Range. Buchungen ohne gesetztes `finalPriceEur` werden
 *   ignoriert (NULL = kein Wert).
 *
 * Empty-State (verbindlich):
 *   Bei 0 Treffern werden `totalRevenueEur` und `averageOrderValueEur`
 *   auf `null` gesetzt; numerische Counts auf `0`. Kein Crash.
 */

import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';
import { SERVICES, type Service } from './services';
import type { AnalyticsRange } from './schemas';

// ---------------------------------------------------------------------------
// Range-Resolver (verbindlich: Berlin-Tage in YYYY-MM-DD).
// ---------------------------------------------------------------------------

export interface RangeBounds {
  /** ISO-Datum (YYYY-MM-DD), inklusiv. */
  from: string;
  /** ISO-Datum (YYYY-MM-DD), inklusiv. */
  to: string;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function todayBerlin(): { y: number; m: number; d: number; iso: string } {
  // Vereinfachung: server-Zeit. Berlin-Offset ist für Aggregation
  // unkritisch — Tagesgrenzen werden über `bookings.date` (TEXT YYYY-MM-DD)
  // gelesen, das selbst Berlin-Tag-basiert ist.
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  return { y, m, d, iso: `${y}-${pad(m)}-${pad(d)}` };
}

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function resolveRange(
  range: AnalyticsRange,
  customFrom?: string,
  customTo?: string,
): RangeBounds {
  const { iso: today, y } = todayBerlin();
  switch (range) {
    case '30d':
      return { from: shiftIso(today, -29), to: today };
    case '90d':
      return { from: shiftIso(today, -89), to: today };
    case '12m':
      return { from: shiftIso(today, -365), to: today };
    case 'ytd':
      return { from: `${y}-01-01`, to: today };
    case 'custom':
      if (!customFrom || !customTo) {
        return { from: shiftIso(today, -365), to: today };
      }
      return { from: customFrom, to: customTo };
    default:
      return { from: shiftIso(today, -365), to: today };
  }
}

// ---------------------------------------------------------------------------
// Aggregations.
// ---------------------------------------------------------------------------

interface KPIs {
  totalRevenueEur: string | null;
  completedBookings: number;
  averageOrderValueEur: string | null;
  bookingsThisMonth: number;
}

interface RevenueByMonthRow {
  month: string;
  totalEur: string;
  count: number;
}

interface BookingsByServiceRow {
  service: Service;
  count: number;
}

interface TopCustomerRow {
  customerId: string;
  customerName: string;
  totalEur: string;
  bookingCount: number;
}

export interface AnalyticsResult {
  range: RangeBounds;
  kpis: KPIs;
  revenueByMonth: RevenueByMonthRow[];
  bookingsByService: BookingsByServiceRow[];
  topCustomers: TopCustomerRow[];
}

/** Decimal → "123.45" String oder null. */
function toDecimalString(n: number | null): string | null {
  if (n === null || !Number.isFinite(n)) return null;
  return n.toFixed(2);
}

function publicShortName(
  customer: { firstName: string; lastName: string } | null,
): string {
  if (!customer) return 'Anonym';
  const initial = (customer.lastName ?? '').trim().charAt(0).toUpperCase();
  return initial
    ? `${customer.firstName.trim()} ${initial}.`
    : customer.firstName.trim();
}

/**
 * Eigentliche Aggregations-Funktion (un-cached). Der Caller wraps das
 * Ergebnis mit `unstable_cache(..., { tags: ['analytics'] })`.
 */
async function computeAnalyticsRaw(
  range: AnalyticsRange,
  customFrom?: string,
  customTo?: string,
): Promise<AnalyticsResult> {
  const bounds = resolveRange(range, customFrom, customTo);
  const { from, to } = bounds;

  // KPIs ----------------------------------------------------------------
  // IT14 / US-IT14-S07 — Bug-Fix: vorher hat ein Filter
  // `finalPriceEur: { not: null }` auch die KPI „Abgeschlossene Buchungen"
  // verzerrt — Buchungen ohne Preis fielen aus dem Count. Lösung:
  // zwei Queries — ein Count über ALLE COMPLETED im Range (Tom sieht
  // damit die wahre Anzahl seiner abgeschlossenen Aufträge), und eine
  // zweite über die mit Preis für Umsatz/Avg/Aggregationen.
  //
  // `revenueByMonth`, `bookingsByService` und `topCustomers` bleiben auf
  // `finalPriceEur != null` gefiltert — sonst keine sinnvolle Aussage.
  const completedTotalCount = await prisma.booking.count({
    where: {
      status: 'COMPLETED',
      date: { not: null, gte: from, lte: to },
    },
  });

  const completedInRange = await prisma.booking.findMany({
    where: {
      status: 'COMPLETED',
      date: { not: null, gte: from, lte: to },
      finalPriceEur: { not: null },
    },
    select: { finalPriceEur: true, date: true, service: true, customerId: true },
  });

  let totalRevenue = 0;
  for (const b of completedInRange) {
    if (b.finalPriceEur != null) {
      // Prisma serialisiert Decimal als string oder Decimal-Instance.
      const v = Number(b.finalPriceEur as unknown as string | number);
      if (Number.isFinite(v)) totalRevenue += v;
    }
  }
  const completedWithPriceCount = completedInRange.length;
  const avg =
    completedWithPriceCount > 0 ? totalRevenue / completedWithPriceCount : null;

  // Buchungen "diesen Monat" (unabhängig vom Range — User-erwartetes KPI).
  const today = todayBerlin();
  const monthPrefix = `${today.y}-${pad(today.m)}`;
  const bookingsThisMonth = await prisma.booking.count({
    where: {
      status: 'COMPLETED',
      date: { not: null, startsWith: monthPrefix },
    },
  });

  const kpis: KPIs = {
    // Umsatz und Avg basieren auf Buchungen MIT Preis (sonst keine Aussage).
    totalRevenueEur:
      completedWithPriceCount > 0 ? toDecimalString(totalRevenue) : null,
    // IT14 / S07: Anzahl ALLER abgeschlossenen Aufträge im Range — auch
    // ohne Preis — damit Tom sieht, wie viele Aufträge er insgesamt
    // abgeschlossen hat.
    completedBookings: completedTotalCount,
    averageOrderValueEur: avg !== null ? toDecimalString(avg) : null,
    bookingsThisMonth,
  };

  // Revenue per month --------------------------------------------------
  const monthMap = new Map<string, { total: number; count: number }>();
  for (const b of completedInRange) {
    if (!b.date) continue;
    const key = b.date.slice(0, 7); // YYYY-MM
    const v = b.finalPriceEur != null ? Number(b.finalPriceEur as unknown as string | number) : 0;
    const cur = monthMap.get(key) ?? { total: 0, count: 0 };
    cur.total += Number.isFinite(v) ? v : 0;
    cur.count += 1;
    monthMap.set(key, cur);
  }
  const revenueByMonth: RevenueByMonthRow[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([month, v]) => ({
      month,
      totalEur: toDecimalString(v.total) ?? '0.00',
      count: v.count,
    }));

  // Bookings per service ----------------------------------------------
  const serviceMap = new Map<string, number>();
  for (const b of completedInRange) {
    serviceMap.set(b.service, (serviceMap.get(b.service) ?? 0) + 1);
  }
  const bookingsByService: BookingsByServiceRow[] = Array.from(
    serviceMap.entries(),
  )
    .filter(([slug]) => (SERVICES as readonly string[]).includes(slug))
    .map(([service, count]) => ({ service: service as Service, count }))
    .sort((a, b) => b.count - a.count);

  // Top customers (max 10) --------------------------------------------
  const custMap = new Map<string, { total: number; count: number }>();
  for (const b of completedInRange) {
    if (!b.customerId) continue;
    const v = b.finalPriceEur != null ? Number(b.finalPriceEur as unknown as string | number) : 0;
    const cur = custMap.get(b.customerId) ?? { total: 0, count: 0 };
    cur.total += Number.isFinite(v) ? v : 0;
    cur.count += 1;
    custMap.set(b.customerId, cur);
  }
  const topIds = Array.from(custMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);

  let topCustomers: TopCustomerRow[] = [];
  if (topIds.length > 0) {
    const customers = await prisma.customerUser.findMany({
      where: { id: { in: topIds.map(([id]) => id) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const cMap = new Map(customers.map((c) => [c.id, c]));
    topCustomers = topIds.map(([id, v]) => {
      const c = cMap.get(id) ?? null;
      return {
        customerId: id,
        customerName: publicShortName(c),
        totalEur: toDecimalString(v.total) ?? '0.00',
        bookingCount: v.count,
      };
    });
  }

  return {
    range: bounds,
    kpis,
    revenueByMonth,
    bookingsByService,
    topCustomers,
  };
}

/**
 * Tag-gecachte Variante. Cache-Key kombiniert Range + custom-Boundaries.
 *
 * Der Cache wird via `revalidateTag('analytics')` invalidiert (siehe
 * PATCH `/api/admin/bookings/:id` und Tag-Pflicht in §17.9).
 */
export async function computeAnalytics(
  range: AnalyticsRange,
  customFrom?: string,
  customTo?: string,
): Promise<AnalyticsResult> {
  const cacheKey = ['analytics', range, customFrom ?? '', customTo ?? ''];
  const fn = unstable_cache(
    async (r: AnalyticsRange, f?: string, t?: string) =>
      computeAnalyticsRaw(r, f, t),
    cacheKey,
    {
      tags: ['analytics'],
      revalidate: 300,
    },
  );
  return fn(range, customFrom, customTo);
}
