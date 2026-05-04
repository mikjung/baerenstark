/**
 * IT12 / US-IT12-15 — POST /api/admin/marketing/emails/{id}/send
 *
 * Bulk-Send einer als 'draft' angelegten MarketingEmail. Hard-Cap 50.
 * Synchron mit Concurrency 5 + 200ms-Throttle.
 *
 * Voraussetzungen:
 *   - MarketingEmail.status === 'draft'.
 *   - Hard-Cap 50, Daily-Cap 100/Tag.
 *
 * IT12 Bug-Fix BUG-001 / FIND-002 (Backend-Engineer Iteration 12 Fix-Loop):
 * Body ist optional + flexibel. Es gibt zwei legitime Aufruf-Pfade:
 *
 *   A) Frontend sendet aktuelle Werte aus dem Composer-State mit:
 *      ```json
 *      { "recipientIds": ["c1", "c2"], "subject": "…", "body": "…" }
 *      ```
 *      Backend persistiert subject/body in der MarketingEmail-Row (Tom
 *      kann seinen Draft beim Send noch editieren — FIND-002), und sendet
 *      an die übergebenen recipientIds.
 *
 *   B) Frontend sendet KEINEN Body (oder leeres JSON):
 *      Backend fällt auf die in der DB gespeicherten Subject/Body und
 *      auf die `MarketingEmailRecipient`-Liste der Mail zurück (sofern
 *      vorhanden — Bestandsverhalten für „resend draft as-is").
 *
 * IT12 Bug-Fix BUG-003 (UWG §7 Abs. 3):
 *   `performMarketingBulkSend` mit `strictRecipients: true` rejected den
 *   Send mit 422 INVALID_RECIPIENTS, sobald mindestens ein recipientId
 *   keinen Bestandskunden mit COMPLETED-Booking referenziert oder bereits
 *   unsubscribed ist.
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.4 (Endpoint #8) + §R.6.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin } from '@/lib/require-admin';
import { performMarketingBulkSend } from '@/lib/marketing-bulk-send';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: { id: string };
}

const SendBodySchema = z.object({
  recipientIds: z
    .array(z.string().min(1))
    .min(1, 'Mindestens ein Empfänger erforderlich')
    .max(50, 'Maximal 50 Empfänger pro Versand')
    .optional(),
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
});

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  try {
    const me = await requireAdmin();
    if ('error' in me) return me.error;

    const id = ctx.params.id;
    if (!id) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Ungültige ID' });
    }

    // Email laden.
    const email = await prisma.marketingEmail.findUnique({
      where: { id },
      select: { id: true, subject: true, bodyText: true, status: true },
    });
    if (!email) {
      return apiError({ code: 'NOT_FOUND', message: 'Marketing-Mail nicht gefunden.' });
    }
    if (email.status !== 'draft') {
      return apiError({
        code: 'CONFLICT',
        message: `Mail kann nicht erneut gesendet werden (Status: ${email.status}).`,
        subcode: 'EMAIL_NOT_DRAFT',
      });
    }

    // Body parsen — optional. Leerer Body ist erlaubt (Fallback-Pfad).
    const rawJson = await req.json().catch(() => null);
    const json = rawJson && typeof rawJson === 'object' ? rawJson : {};
    const parsed = SendBodySchema.safeParse(json);
    if (!parsed.success) {
      const tooBig = parsed.error.issues.find(
        (i) => i.path[0] === 'recipientIds' && i.code === 'too_big',
      );
      if (tooBig) {
        return apiError({
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Maximal 50 Empfänger pro Versand. Bitte in mehreren Schüben senden.',
          subcode: 'RECIPIENT_CAP_EXCEEDED',
          field: 'recipientIds',
        });
      }
      return zodErrorResponse(parsed.error);
    }

    // ----- recipientIds: Body oder Fallback aus DB-Recipients -----
    let recipientCustomerIds = parsed.data.recipientIds ?? null;
    if (!recipientCustomerIds || recipientCustomerIds.length === 0) {
      const existingRecipients = await prisma.marketingEmailRecipient.findMany({
        where: { marketingEmailId: id },
        select: { customerId: true },
      });
      recipientCustomerIds = Array.from(
        new Set(existingRecipients.map((r) => r.customerId)),
      );
    }

    if (recipientCustomerIds.length === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message:
          'Keine Empfänger gefunden — bitte Auswahl im Composer prüfen.',
        field: 'recipientIds',
      });
    }
    if (recipientCustomerIds.length > 50) {
      return apiError({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Maximal 50 Empfänger pro Versand. Bitte in mehreren Schüben senden.',
        subcode: 'RECIPIENT_CAP_EXCEEDED',
        field: 'recipientIds',
      });
    }

    // ----- Subject/Body: Body oder Fallback auf DB-Werte -----
    const finalSubject = parsed.data.subject?.trim() ?? email.subject;
    const finalBody = parsed.data.body ?? email.bodyText;

    // Wenn FE neue Werte mitgegeben hat, persistieren wir sie auf der
    // MarketingEmail-Row (FIND-002: Tom kann den Draft beim Send noch editieren).
    if (parsed.data.subject != null || parsed.data.body != null) {
      await prisma.marketingEmail.update({
        where: { id },
        data: {
          subject: finalSubject,
          bodyText: finalBody,
        },
      });
    }

    // Audit-Logging.
    const userAgent = req.headers.get('user-agent')?.slice(0, 200) ?? '';
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    // eslint-disable-next-line no-console
    console.info(
      `[marketing-audit] POST emails/${id}/send admin=${me.id} ua="${userAgent}" ip=${ip} ` +
        `recipients=${recipientCustomerIds.length} bodyOverride=${
          parsed.data.body != null ? 'yes' : 'no'
        }`,
    );

    const result = await performMarketingBulkSend({
      marketingEmailId: id,
      subject: finalSubject,
      body: finalBody,
      recipientCustomerIds,
      strictRecipients: true,
    });

    if (!result.ok) {
      if (result.errorCode === 'INVALID_RECIPIENTS') {
        // 422 — Frontend kann die Liste korrigieren und erneut senden.
        // Wir hängen die ausgeschlossenen IDs als JSON-encoded Header an,
        // weil der ApiError-Body keine zusätzlichen Felder unterstützt.
        return apiError({
          code: 'UNPROCESSABLE_ENTITY',
          message: result.message,
          subcode: 'INVALID_RECIPIENTS',
          headers: {
            'X-Excluded-Count': String(result.excludedRecipientIds.length),
            'X-Excluded-Ids': result.excludedRecipientIds.join(','),
          },
        });
      }
      return apiError({
        code: 'RATE_LIMITED',
        message: result.message,
        subcode: result.errorCode,
      });
    }

    return apiSuccess({
      id,
      intendedRecipients: result.intendedRecipients,
      actualRecipients: result.actualRecipients,
      successCount: result.successCount,
      failureCount: result.failureCount,
      status: result.status,
      failedRecipients: result.failedRecipients,
      // IT12 BUG-003: Audit-Transparenz auch im Erfolgsfall (sollte hier
      // praktisch immer leer sein, da strict-mode bei Ausschluss bereits
      // 422 wirft — Sicherheitsnetz für nicht-strict-Pfade in Zukunft).
      excludedRecipientIds: result.excludedRecipientIds,
      excludedRecipients: result.excludedRecipientIds.map((id) => ({
        customerId: id,
        reason: 'NOT_ELIGIBLE',
      })),
    });
  } catch (err) {
    return internalError(err, 'POST /api/admin/marketing/emails/[id]/send');
  }
}
