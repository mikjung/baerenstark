/**
 * Iteration 6 / US-IT6-02 — Öffentlicher Kalender-Tag-Status-Feed.
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
 * Range-Hard-Limit: 62 Tage (siehe `AvailabilityCalendarQuerySchema` +
 * Anhang B §17.8 / m4).
 *
 * `serviceId` ist reserviert für IT7 — MVP ignoriert ihn.
 *
 * Cache: `public, max-age=60, s-maxage=300, stale-while-revalidate=600`.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AvailabilityCalendarQuerySchema } from '@/lib/schemas';
import {
  computeAvailableSlots,
  getAvailabilityForDate,
} from '@/lib/availability';
import { apiError, internalError, zodErrorResponse } from '@/lib/api';

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

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const parsed = AvailabilityCalendarQuerySchema.parse({
      from: url.searchParams.get('from') ?? '',
      to: url.searchParams.get('to') ?? '',
      serviceId: url.searchParams.get('serviceId') ?? undefined,
    });

    const dates = eachDate(parsed.from, parsed.to);

    // Mapping pro Tag.
    const days = await Promise.all(
      dates.map(async (date) => {
        const cfg = await getAvailabilityForDate(date);
        if (!cfg.isActive) {
          return { date, status: 'unavailable' as const };
        }
        const computed = await computeAvailableSlots(date);
        if (!computed.isDayActive) {
          return { date, status: 'unavailable' as const };
        }
        const hasFree = computed.slots.some((s) => s.available);
        return {
          date,
          status: hasFree
            ? ('available' as const)
            : ('partial' as const),
        };
      }),
    );

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
    return internalError(err);
  }
}
