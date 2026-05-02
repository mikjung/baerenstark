/**
 * /api/slots/available?date=YYYY-MM-DD — US-17 (Iteration 3).
 *
 * Public-Endpoint. Berechnet die verfügbaren Zeitslots für ein Datum
 * basierend auf AvailabilityTemplate + DayOverride und zieht bereits
 * gebuchte Slots ab.
 */

import type { NextRequest } from 'next/server';
import { AvailableSlotsQuerySchema } from '@/lib/schemas';
import { computeAvailableSlots } from '@/lib/availability';
import {
  apiError,
  apiSuccess,
  internalError,
} from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const dateRaw = url.searchParams.get('date');
    const parsed = AvailableSlotsQuerySchema.safeParse({ date: dateRaw });
    if (!parsed.success) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Ungültiges Datum',
        field: 'date',
      });
    }

    const result = await computeAvailableSlots(parsed.data.date);

    return apiSuccess(result);
  } catch (err) {
    return internalError(err);
  }
}
