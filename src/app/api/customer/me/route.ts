/**
 * GET  /api/customer/me — US-25.
 * PATCH /api/customer/me — US-25 AC10.
 *
 * GET liefert den eingeloggten Kunden (ohne passwordHash).
 * PATCH erlaubt nur firstName, lastName, phone (BUG-402-Fix v1.4.1).
 *   E-Mail-Änderung ist im MVP NICHT erlaubt — `.strict()` Schema lehnt
 *   unbekannte Felder mit 400 ab.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { CustomerProfileUpdateSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import {
  getCustomerFromRequest,
  toCustomerPublic,
} from '@/lib/customer-auth-server';
import { selectCustomerUserPublic } from '@/lib/dto/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const user = await getCustomerFromRequest(req);
    if (!user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }
    return apiSuccess(toCustomerPublic(user));
  } catch (err) {
    return internalError(err);
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  try {
    const user = await getCustomerFromRequest(req);
    if (!user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    // strict() lehnt unbekannte Felder ab — insbesondere `email`.
    const parsed = CustomerProfileUpdateSchema.parse(json);

    const updated = await prisma.customerUser.update({
      where: { id: user.id },
      data: {
        ...(parsed.firstName !== undefined ? { firstName: parsed.firstName } : {}),
        ...(parsed.lastName !== undefined ? { lastName: parsed.lastName } : {}),
        ...(parsed.phone !== undefined ? { phone: parsed.phone ?? null } : {}),
      },
      // F3-Schutz: Public-Select — KEIN adminNote/adminRating in der Response.
      select: selectCustomerUserPublic(),
    });

    return apiSuccess(toCustomerPublic(updated));
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
