/**
 * Admin Setup-Wizard (US-07 Initial-Setup).
 *
 * GET  /api/admin/setup → { data: { available: boolean } }
 *   available === true ⇔ Tabelle users ist leer.
 *
 * POST /api/admin/setup → 201 mit { data: { id, email } }
 *   Greift nur, solange users leer ist; danach 409 CONFLICT.
 */

import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AdminSetupSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  try {
    const count = await prisma.user.count();
    return apiSuccess({ available: count === 0 });
  } catch (err) {
    return internalError(err);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    const data = AdminSetupSchema.parse(json);

    // Atomarer Insert mit "nur, wenn Tabelle leer"-Bedingung.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.count();
      if (existing > 0) return { type: 'closed' as const };

      const passwordHash = await bcrypt.hash(data.password, 10);
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          name: data.name.trim(),
          passwordHash,
        },
        select: { id: true, email: true },
      });
      return { type: 'created' as const, user };
    });

    if (result.type === 'closed') {
      return apiError({
        code: 'CONFLICT',
        message: 'Setup wurde bereits abgeschlossen.',
      });
    }
    return apiSuccess(result.user, 201);
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
