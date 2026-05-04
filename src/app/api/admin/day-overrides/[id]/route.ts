/**
 * /api/admin/day-overrides/:id — US-17 (Iteration 3).
 *
 * DELETE (admin) — Override löschen; Tag fällt zurück auf die Default-Vorlage.
 */

import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { apiError, apiNoContent, internalError } from '@/lib/api';
import { requireAdmin, isAdminError } from '@/lib/require-admin';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    // IT14 / S02 — `requireAdmin()` statt `auth()` (DISABLED-Check + 401/403-Konsistenz).
    const me = await requireAdmin();
    if (isAdminError(me)) return me.error;

    const params = await ctx.params;
    const { id } = params;
    if (!id) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Override-ID fehlt.',
        field: 'id',
      });
    }

    try {
      await prisma.dayOverride.delete({ where: { id } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return apiError({
          code: 'NOT_FOUND',
          message: 'Override nicht gefunden.',
        });
      }
      throw err;
    }

    try {
      revalidateTag('available-slots');
    } catch {
      /* ignore */
    }

    return apiNoContent();
  } catch (err) {
    return internalError(err);
  }
}
