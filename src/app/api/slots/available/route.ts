/**
 * /api/slots/available?date=YYYY-MM-DD&duration=NNN — US-17 + US-33 + US-34.
 *
 * Public-Endpoint. Berechnet die verfügbaren Zeitslots für ein Datum
 * basierend auf AvailabilityTemplate + DayOverride + aktive Buchungen +
 * Buffer-Config. Iteration 5 erweitert um optionalen `duration`-Param:
 * Slot ist nur verfügbar, wenn die gewünschte Dauer ab dem Start passt
 * (kein Booking-Overlap UND kein Buffer-Overlap nach CONFIRMED-Termin).
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
    const durationRaw = url.searchParams.get('duration');
    // `z.literal(-1)` matcht nicht den String `'-1'` — wir coercen die
    // Query-Param vorab zu Number, damit Ganztag (-1) durchkommt.
    let durationParsed: number | undefined;
    if (durationRaw !== null && durationRaw !== '') {
      const n = Number(durationRaw);
      if (Number.isFinite(n) && Number.isInteger(n)) {
        durationParsed = n;
      } else {
        return apiError({
          code: 'VALIDATION_ERROR',
          message: 'Ungültige Dauer.',
          field: 'duration',
        });
      }
    }
    const parsed = AvailableSlotsQuerySchema.safeParse({
      date: dateRaw,
      ...(durationParsed !== undefined ? { duration: durationParsed } : {}),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return apiError({
        code: 'VALIDATION_ERROR',
        message: first?.message ?? 'Ungültige Query',
        field: first?.path[0]?.toString() ?? 'date',
      });
    }

    const result = await computeAvailableSlots(
      parsed.data.date,
      parsed.data.duration,
    );

    return apiSuccess(result);
  } catch (err) {
    return internalError(err);
  }
}
