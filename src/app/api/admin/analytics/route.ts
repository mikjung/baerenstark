/**
 * Iteration 6 / US-IT6-09 — Analytics-API.
 *
 * GET /api/admin/analytics?range=30d|90d|12m|ytd|custom&from=&to=
 *
 * Cache: Tag `analytics` (siehe `lib/analytics.ts`). Wird von
 * PATCH `/api/admin/bookings/:id` invalidiert (m5-Fix, §17.9).
 *
 * Empty-State: Bei 0 Treffern werden `totalRevenueEur` und
 * `averageOrderValueEur` als `null` zurückgegeben — kein Crash.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { AnalyticsQuerySchema } from '@/lib/schemas';
import { apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import { computeAnalytics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const url = new URL(req.url);
    const parsed = AnalyticsQuerySchema.parse({
      range: url.searchParams.get('range') ?? undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
    });

    const result = await computeAnalytics(parsed.range, parsed.from, parsed.to);
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
