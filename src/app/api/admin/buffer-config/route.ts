/**
 * /api/admin/buffer-config — US-34.
 *
 * GET (admin)  — liefert den globalen Buffer-Wert (seedet on-the-fly).
 * PUT (admin)  — setzt einen neuen Wert (Whitelist 0/15/30/45/60).
 *
 * Beide Endpoints sind Admin-only (NextAuth-Session). Die Singleton-
 * Bewirtschaftung passiert im Helper `lib/buffer-config.ts`.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { revalidateTag } from 'next/cache';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { UpdateBufferConfigSchema } from '@/lib/schemas';
import { getBufferConfig, setBufferConfig } from '@/lib/buffer-config';
import { requireAdmin, isAdminError } from '@/lib/require-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    // IT14 / S02 — `requireAdmin()` statt `auth()` (DISABLED-Check + 401/403-Konsistenz).
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const cfg = await getBufferConfig();
    return apiSuccess({
      bufferMinutes: cfg.bufferMinutes,
      updatedAt: cfg.updatedAt.toISOString(),
    });
  } catch (err) {
    return internalError(err);
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  try {
    // IT14 / S02 — `requireAdmin()` statt `auth()` (DISABLED-Check + 401/403-Konsistenz).
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    const data = UpdateBufferConfigSchema.parse(json);
    const cfg = await setBufferConfig(data.bufferMinutes);

    // Slot-API neu generieren, damit FE den geänderten Buffer sofort sieht.
    try {
      revalidateTag('available-slots');
    } catch {
      /* ignore */
    }

    return apiSuccess({
      bufferMinutes: cfg.bufferMinutes,
      updatedAt: cfg.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
