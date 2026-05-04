/**
 * IT12 / US-IT12-15 — GET + PATCH /api/admin/marketing/emails/{id}
 *
 * GET liefert das Detail einer Marketing-Mail inkl. Audit-Sicht (failed
 * recipients). Admin-only.
 *
 * PATCH (IT12 Bug-Fix-Loop / FIND-002): erlaubt das Aktualisieren von
 * `subject` und `bodyText` einer noch nicht gesendeten (`status === 'draft'`)
 * Marketing-Mail. Wird vom Composer-Auto-Save aufgerufen, damit Tom seinen
 * Draft mehrfach editieren kann ohne dass die DB-Werte stale werden.
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.4 (Endpoint #10).
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin } from '@/lib/require-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: { id: string };
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<Response> {
  try {
    const me = await requireAdmin();
    if ('error' in me) return me.error;

    const id = ctx.params.id;
    if (!id || typeof id !== 'string') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Ungültige ID' });
    }

    const email = await prisma.marketingEmail.findUnique({
      where: { id },
      include: {
        recipients: {
          where: { status: 'FAILED' },
          select: { email: true, errorMessage: true },
        },
      },
    });

    if (!email) {
      return apiError({ code: 'NOT_FOUND', message: 'Marketing-Mail nicht gefunden.' });
    }

    let filterServices: string[] = [];
    try {
      const parsed = JSON.parse(email.filterServices);
      if (Array.isArray(parsed)) filterServices = parsed;
    } catch {
      // ignore — gibt eine leere Liste.
    }

    return apiSuccess({
      id: email.id,
      subject: email.subject,
      bodyText: email.bodyText,
      filterServices,
      createdAt: email.createdAt.toISOString(),
      completedAt: email.completedAt ? email.completedAt.toISOString() : null,
      recipientCount: email.recipientCount,
      successCount: email.successCount,
      failureCount: email.failureCount,
      status: email.status,
      failedRecipients: email.recipients.map((r) => ({
        email: r.email,
        errorMessage: r.errorMessage ?? '',
      })),
    });
  } catch (err) {
    return internalError(err, 'GET /api/admin/marketing/emails/[id]');
  }
}

// ---------------------------------------------------------------------------
// PATCH — IT12 Bug-Fix FIND-002 (Composer Draft-Update).
// ---------------------------------------------------------------------------

const PatchBodySchema = z
  .object({
    subject: z
      .string()
      .trim()
      .min(1, 'Betreff darf nicht leer sein')
      .max(200, 'Betreff ist zu lang')
      .optional(),
    body: z
      .string()
      .min(1, 'Nachricht darf nicht leer sein')
      .max(5000, 'Nachricht überschreitet das 5000-Zeichen-Limit')
      .optional(),
  })
  .refine((d) => d.subject != null || d.body != null, {
    message: 'Mindestens subject oder body muss übergeben werden',
  });

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  try {
    const me = await requireAdmin();
    if ('error' in me) return me.error;

    const id = ctx.params.id;
    if (!id || typeof id !== 'string') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Ungültige ID' });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const parsed = PatchBodySchema.safeParse(json);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const existing = await prisma.marketingEmail.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return apiError({ code: 'NOT_FOUND', message: 'Marketing-Mail nicht gefunden.' });
    }
    if (existing.status !== 'draft') {
      return apiError({
        code: 'CONFLICT',
        message: `Mail kann nicht editiert werden (Status: ${existing.status}).`,
        subcode: 'EMAIL_NOT_DRAFT',
      });
    }

    const updated = await prisma.marketingEmail.update({
      where: { id },
      data: {
        ...(parsed.data.subject != null ? { subject: parsed.data.subject } : {}),
        ...(parsed.data.body != null ? { bodyText: parsed.data.body } : {}),
      },
      select: { id: true, subject: true, bodyText: true, status: true },
    });

    // eslint-disable-next-line no-console
    console.info(
      `[marketing-audit] PATCH emails/${id} admin=${me.id} ` +
        `subject=${parsed.data.subject != null ? 'updated' : 'unchanged'} ` +
        `body=${parsed.data.body != null ? 'updated' : 'unchanged'}`,
    );

    return apiSuccess({
      id: updated.id,
      subject: updated.subject,
      bodyText: updated.bodyText,
      status: updated.status,
    });
  } catch (err) {
    return internalError(err, 'PATCH /api/admin/marketing/emails/[id]');
  }
}
