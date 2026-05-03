/**
 * Admin Setup-Wizard (US-07 Initial-Setup, IT6 / US-IT6-01 + F1-Resolution).
 *
 * GET  /api/admin/setup → { data: { available: boolean } }
 *   available === true ⇔ Tabelle users ist leer.
 *
 * POST /api/admin/setup → 201 mit { data: { id, email, name, status, createdAt } }
 *   Greift nur, solange users leer ist; danach 410 GONE.
 *
 * Iteration 6 (US-IT6-01 + F1-Resolution, siehe ARCHITECTURE_IT6.md
 * Anhang B §17.1):
 *   - Allowlist-Gate via ENV `BOOTSTRAP_ADMIN_EMAIL`. Pflicht-Match
 *     der Body-Email mit der ENV. Ohne ENV → 503 SETUP_NOT_CONFIGURED;
 *     bei Mismatch → 403 BOOTSTRAP_NOT_ALLOWED. Verhindert das „Erster-
 *     Setup-Submit-gewinnt"-Race-Condition nach einem User-Wipe.
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
    // 1. Anzahl existierender Admins prüfen. Wenn ≥1 → Setup ist
    //    abgeschlossen (410 GONE). ENV `BOOTSTRAP_ADMIN_EMAIL` wird
    //    in diesem Fall **ignoriert** — siehe §17.1.2.
    const existingAdmins = await prisma.user.count();
    if (existingAdmins >= 1) {
      return apiError({
        code: 'GONE',
        message: 'Setup wurde bereits abgeschlossen.',
      });
    }

    // 2. Allowlist-Gate (NEU, F1-Fix). ENV MUSS gesetzt sein.
    const allowedEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    if (!allowedEmail) {
      return apiError({
        code: 'SETUP_NOT_CONFIGURED',
        message:
          'Setup ist nicht konfiguriert. Bitte ENV `BOOTSTRAP_ADMIN_EMAIL` setzen.',
      });
    }

    // 3. Body validieren.
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const data = AdminSetupSchema.parse(json);

    // 4. Email-Match-Gate (NEU, F1-Fix). Eingabe MUSS exakt der Allowlist
    //    entsprechen. Sonst 403 BOOTSTRAP_NOT_ALLOWED.
    const submittedEmail = data.email.trim().toLowerCase();
    if (submittedEmail !== allowedEmail) {
      return apiError({
        code: 'BOOTSTRAP_NOT_ALLOWED',
        message:
          'Diese E-Mail-Adresse ist für das initiale Setup nicht freigeschaltet.',
      });
    }

    // 5. Atomarer Insert mit "nur, wenn Tabelle leer"-Bedingung.
    //    Falls zwischen Schritt 1 und 5 ein anderer Bootstrap-Submit
    //    durchgegangen ist (theoretisch unmöglich, weil F1-Gate beide
    //    blockt), greift trotzdem das `count`-Read im $transaction.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.count();
      if (existing > 0) return { type: 'closed' as const };

      const passwordHash = await bcrypt.hash(data.password, 10);
      const user = await tx.user.create({
        data: {
          email: submittedEmail,
          name: data.name.trim(),
          passwordHash,
          status: 'ACTIVE',
          // createdById bleibt NULL (Bootstrap).
        },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
        },
      });
      return { type: 'created' as const, user };
    });

    if (result.type === 'closed') {
      return apiError({
        code: 'GONE',
        message: 'Setup wurde bereits abgeschlossen.',
      });
    }

    return apiSuccess(
      {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        status: result.user.status,
        createdAt: result.user.createdAt.toISOString(),
      },
      201,
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
