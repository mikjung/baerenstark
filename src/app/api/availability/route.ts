/**
 * /api/availability — Wochentag-basierte Verfügbarkeit (US-15).
 *
 * GET  (public) — alle 7 Wochentag-Datensätze (seedet on-the-fly, falls leer).
 * PUT  (admin)  — Upsert für die übergebenen Wochentage.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UpdateWeeklyAvailabilitySchema } from '@/lib/schemas';
import {
  apiError,
  apiSuccess,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import {
  ensureWeeklyAvailabilitySeed,
  getAllWeeklyAvailability,
} from '@/lib/availability';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    const days = await getAllWeeklyAvailability();
    return apiSuccess({ days });
  } catch (err) {
    return internalError(err);
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const { days } = UpdateWeeklyAvailabilitySchema.parse(json);

    // Sicherstellen, dass alle 7 Datensätze existieren (idempotent, kein Overwrite).
    await ensureWeeklyAvailabilitySeed();

    // Upsert in einer Transaktion.
    await prisma.$transaction(
      days.map((d) =>
        prisma.weeklyAvailability.upsert({
          where: { dayOfWeek: d.dayOfWeek },
          create: { dayOfWeek: d.dayOfWeek, isActive: d.isActive },
          update: { isActive: d.isActive },
        }),
      ),
    );

    const result = await getAllWeeklyAvailability();

    try {
      revalidateTag('availability');
      revalidateTag('calendar');
    } catch {
      /* ignore */
    }

    return apiSuccess({ days: result });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
