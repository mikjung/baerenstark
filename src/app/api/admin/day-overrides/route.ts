/**
 * /api/admin/day-overrides — US-17 (Iteration 3).
 *
 * GET  ?month=YYYY-MM (admin) — alle Overrides eines Monats.
 * POST              (admin) — Upsert (date ist UNIQUE).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  CreateDayOverrideSchema,
  DayOverrideMonthQuerySchema,
  ACTIVE_BOOKING_STATUSES,
} from '@/lib/schemas';
import {
  apiError,
  apiSuccess,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function serializeOverride(o: {
  id: string;
  date: string;
  isActive: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: o.id,
    date: o.date,
    isActive: o.isActive,
    startTime: o.startTime,
    endTime: o.endTime,
    reason: o.reason,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const url = new URL(req.url);
    const monthRaw = url.searchParams.get('month');
    const parsed = DayOverrideMonthQuerySchema.safeParse({ month: monthRaw });
    if (!parsed.success) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Ungültiger Monat',
        field: 'month',
      });
    }
    const { month } = parsed.data;

    // Filter via String-Range: month + "-01" .. month + "-31".
    // SQLite vergleicht TEXT lexikographisch — bei "YYYY-MM-DD" reicht das.
    const start = `${month}-01`;
    const end = `${month}-32`; // exklusiver Endwert > "YYYY-MM-31"

    const overrides = await prisma.dayOverride.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });

    return apiSuccess({
      month,
      overrides: overrides.map(serializeOverride),
    });
  } catch (err) {
    return internalError(err);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const data = CreateDayOverrideSchema.parse(json);

    const upserted = await prisma.dayOverride.upsert({
      where: { date: data.date },
      create: {
        date: data.date,
        isActive: data.isActive,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        reason: data.reason ?? null,
      },
      update: {
        isActive: data.isActive,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        reason: data.reason ?? null,
      },
    });

    // Warnung, falls aktive Buchungen am gesperrten Tag existieren.
    let warning:
      | { code: string; message: string; affectedBookingCount: number }
      | undefined;
    if (!data.isActive) {
      const affected = await prisma.booking.count({
        where: {
          date: data.date,
          status: { in: ACTIVE_BOOKING_STATUSES as unknown as string[] },
        },
      });
      if (affected > 0) {
        warning = {
          code: 'ACTIVE_BOOKINGS_AFFECTED',
          message: `Es gibt ${affected} aktive Buchung${
            affected === 1 ? '' : 'en'
          } an diesem Tag. Diese bleiben bestehen.`,
          affectedBookingCount: affected,
        };
      }
    }

    try {
      revalidateTag('available-slots');
    } catch {
      /* ignore */
    }

    const body: Record<string, unknown> = {
      data: serializeOverride(upserted),
    };
    if (warning) body.warning = warning;

    return new Response(JSON.stringify(body), {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
