/**
 * /api/admin/availability-template — US-17 (Iteration 3).
 *
 * GET (admin) — alle 7 Wochentag-Standardzeiten (seedet on-the-fly).
 * PUT (admin) — Bulk-Update: Upsert für die übergebenen Wochentage.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { UpdateAvailabilityTemplateSchema } from '@/lib/schemas';
import {
  apiError,
  apiSuccess,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import { getAvailabilityTemplate } from '@/lib/availability';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    // IT14 / S02 — `requireAdmin()` statt `auth()`: einheitliches 401/403,
    // DISABLED-Check inklusive.
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const days = await getAvailabilityTemplate();
    return apiSuccess({ days });
  } catch (err) {
    return internalError(err);
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  try {
    // IT14 / S02 — `requireAdmin()` statt `auth()`: einheitliches 401/403,
    // DISABLED-Check inklusive.
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const { days } = UpdateAvailabilityTemplateSchema.parse(json);

    await prisma.$transaction(
      days.map((d) =>
        prisma.availabilityTemplate.upsert({
          where: { dayOfWeek: d.dayOfWeek },
          create: {
            dayOfWeek: d.dayOfWeek,
            isActive: d.isActive,
            startTime: d.startTime,
            endTime: d.endTime,
            slotDurationMinutes: d.slotDurationMinutes,
          },
          update: {
            isActive: d.isActive,
            startTime: d.startTime,
            endTime: d.endTime,
            slotDurationMinutes: d.slotDurationMinutes,
          },
        }),
      ),
    );

    const result = await getAvailabilityTemplate();

    try {
      revalidateTag('availability-template');
      revalidateTag('available-slots');
    } catch {
      /* ignore */
    }

    return apiSuccess({ days: result });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
