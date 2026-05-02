/**
 * /api/slots
 *
 * GET  (public)  — Liste verfügbarer Slots inkl. abgeleitetem isBooked-Flag.
 * POST (admin)   — Neuen Slot anlegen (Sanity-Checks + Overlap).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CreateSlotSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LOOKAHEAD_DAYS = 90;

/**
 * GET /api/slots
 *   Filter: deletedAt IS NULL, startsAt zwischen `from` (default now) und `to`
 *   (default now + 90 Tage). Sortiert nach startsAt asc.
 *   isBooked = true ⇔ es existiert ein Booking mit Status PENDING ODER CONFIRMED.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const now = new Date();
    const from = fromParam ? new Date(fromParam) : now;
    const to =
      toParam
        ? new Date(toParam)
        : new Date(now.getTime() + DEFAULT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime())) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Parameter `from` muss ISO 8601 sein',
        field: 'from',
      });
    }
    if (Number.isNaN(to.getTime())) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Parameter `to` muss ISO 8601 sein',
        field: 'to',
      });
    }

    const slots = await prisma.slot.findMany({
      where: {
        deletedAt: null,
        startsAt: { gte: from, lte: to },
      },
      orderBy: { startsAt: 'asc' },
      include: {
        bookings: {
          // Iteration 2: COUNTER_PROPOSED zählt ebenfalls als belegt.
          where: { status: { in: ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'] } },
          select: { id: true },
        },
      },
    });

    const data = slots.map((s) => ({
      id: s.id,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      description: s.description,
      isBooked: s.bookings.length > 0,
    }));

    return apiSuccess(data);
  } catch (err) {
    return internalError(err);
  }
}

/**
 * POST /api/slots — Admin only.
 * Body: { startsAt, endsAt, description? }
 * 201: { data: { id, startsAt, endsAt, description, isBooked: false } }
 * 401 UNAUTHORIZED, 400 VALIDATION_ERROR, 409 OVERLAP.
 */
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

    const parsed = CreateSlotSchema.parse(json);
    const startsAt = new Date(parsed.startsAt);
    const endsAt = new Date(parsed.endsAt);

    // Overlap-Check (BUG-008): aktive (nicht-soft-deleted) Slots dürfen sich
    // nicht überschneiden. Halb-offenes Intervall: starts_at < newEndsAt UND ends_at > newStartsAt.
    const overlap = await prisma.slot.findFirst({
      where: {
        deletedAt: null,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true },
    });
    if (overlap) {
      return apiError({
        code: 'OVERLAP',
        message:
          'Slot überschneidet sich mit einem bestehenden Zeitfenster.',
      });
    }

    const created = await prisma.slot.create({
      data: {
        startsAt,
        endsAt,
        description: parsed.description ?? null,
      },
    });

    // Cache-Invalidierung für die öffentliche Slot-Liste.
    try {
      revalidateTag('slots');
    } catch {
      /* revalidateTag wirft in einigen Edge-Cases — ignorieren */
    }

    return apiSuccess(
      {
        id: created.id,
        startsAt: created.startsAt.toISOString(),
        endsAt: created.endsAt.toISOString(),
        description: created.description,
        isBooked: false,
      },
      201,
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
