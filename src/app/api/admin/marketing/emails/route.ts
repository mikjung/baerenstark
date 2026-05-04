/**
 * IT12 / US-IT12-15 — POST /api/admin/marketing/emails  +  GET (Liste).
 *
 * POST: legt eine `MarketingEmail` an. Bei `status: "send"` wird sofort
 *       der Bulk-Send getriggert (siehe `./[id]/send/route.ts`-Logik —
 *       hier inline aufgerufen, damit der Caller nur einen Roundtrip braucht).
 *
 * GET:  paginierte Audit-Historie aller Marketing-Mails.
 *
 * Constraints:
 *   - `recipientIds.length` 1..50 (Hard-Cap, Vercel-Hobby-Timeout).
 *   - `body.length` 1..5000 (UX-Vorgabe).
 *   - `subject.length` 1..200.
 *   - `filterServices` ist Audit-only — wird NICHT zur Empfänger-Filterung
 *     genutzt (das Frontend hat schon gefiltert + Admin hat ausgewählt).
 *   - DSGVO: `unsubscribedAt != null`-Customer werden HARD aussortiert.
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.4 (Endpoint #6, #9),
 * backend-requirements-iteration-12.md §S15 / Post-QA Revision.
 */

import type { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { requireAdmin } from '@/lib/require-admin';
import { SERVICES } from '@/lib/services';
import { performMarketingBulkSend } from '@/lib/marketing-bulk-send';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ServiceEnum = z.enum(SERVICES);

const CreateMarketingEmailSchema = z.object({
  subject: z.string().trim().min(1, 'Betreff darf nicht leer sein').max(200, 'Betreff ist zu lang'),
  body: z
    .string()
    .min(1, 'Nachricht darf nicht leer sein')
    .max(5000, 'Nachricht überschreitet das 5000-Zeichen-Limit'),
  recipientIds: z
    .array(z.string().min(1))
    .min(1, 'Mindestens ein Empfänger erforderlich')
    .max(50, 'Maximal 50 Empfänger pro Versand'),
  filterServices: z.array(ServiceEnum).optional(),
  status: z.enum(['draft', 'send']),
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const me = await requireAdmin();
    if ('error' in me) return me.error;

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    let parsed;
    try {
      parsed = CreateMarketingEmailSchema.parse(json);
    } catch (err) {
      if (err instanceof ZodError) {
        // Special-case: zu viele Empfänger → 413 RECIPIENT_CAP_EXCEEDED.
        const recipientIssue = err.issues.find(
          (i) => i.path[0] === 'recipientIds' && i.code === 'too_big',
        );
        if (recipientIssue) {
          return apiError({
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Maximal 50 Empfänger pro Versand. Bitte in mehreren Schüben senden.',
            subcode: 'RECIPIENT_CAP_EXCEEDED',
            field: 'recipientIds',
          });
        }
        return zodErrorResponse(err);
      }
      throw err;
    }

    // 1. Audit-Logging (User-Agent, IP, AdminId).
    const userAgent = req.headers.get('user-agent')?.slice(0, 200) ?? '';
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    // eslint-disable-next-line no-console
    console.info(
      `[marketing-audit] POST emails admin=${me.id} ua="${userAgent}" ip=${ip} recipients=${parsed.recipientIds.length} status=${parsed.status}`,
    );

    // 2. Draft anlegen (recipientCount wird nach Filter aktualisiert).
    const created = await prisma.marketingEmail.create({
      data: {
        sentByAdminId: me.id,
        subject: parsed.subject,
        bodyText: parsed.body,
        filterServices: JSON.stringify(parsed.filterServices ?? []),
        recipientCount: parsed.recipientIds.length,
        status: 'draft',
      },
      select: { id: true, status: true, createdAt: true },
    });

    if (parsed.status === 'draft') {
      return apiSuccess(
        {
          id: created.id,
          status: 'draft' as const,
          createdAt: created.createdAt.toISOString(),
        },
        201,
      );
    }

    // 3. Direkt senden.
    // IT12 BUG-003: strictRecipients aktiviert UWG-§7-Filter (nur
    // Bestandskunden mit COMPLETED-Booking + nicht unsubscribed).
    const sendResult = await performMarketingBulkSend({
      marketingEmailId: created.id,
      subject: parsed.subject,
      body: parsed.body,
      recipientCustomerIds: parsed.recipientIds,
      strictRecipients: true,
    });

    if (!sendResult.ok) {
      if (sendResult.errorCode === 'INVALID_RECIPIENTS') {
        return apiError({
          code: 'UNPROCESSABLE_ENTITY',
          message: sendResult.message,
          subcode: 'INVALID_RECIPIENTS',
          headers: {
            'X-Excluded-Count': String(sendResult.excludedRecipientIds.length),
            'X-Excluded-Ids': sendResult.excludedRecipientIds.join(','),
          },
        });
      }
      // Daily-Quota-Limit. MarketingEmail bleibt im 'draft'-Status, damit Tom
      // morgen erneut senden kann.
      return apiError({
        code: 'RATE_LIMITED',
        message: sendResult.message,
        subcode: sendResult.errorCode,
      });
    }

    return apiSuccess(
      {
        id: created.id,
        status: sendResult.status,
        intendedRecipients: sendResult.intendedRecipients,
        actualRecipients: sendResult.actualRecipients,
        successCount: sendResult.successCount,
        failureCount: sendResult.failureCount,
        failedRecipients: sendResult.failedRecipients,
        excludedRecipientIds: sendResult.excludedRecipientIds,
        excludedRecipients: sendResult.excludedRecipientIds.map((id) => ({
          customerId: id,
          reason: 'NOT_ELIGIBLE',
        })),
      },
      201,
    );
  } catch (err) {
    return internalError(err, 'POST /api/admin/marketing/emails');
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const me = await requireAdmin();
    if ('error' in me) return me.error;

    const url = new URL(req.url);
    const parsed = ListQuerySchema.safeParse({
      page: url.searchParams.get('page') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const total = await prisma.marketingEmail.count();
    const skip = (parsed.data.page - 1) * parsed.data.limit;

    const items = await prisma.marketingEmail.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: parsed.data.limit,
      select: {
        id: true,
        subject: true,
        recipientCount: true,
        successCount: true,
        failureCount: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return apiSuccess({
      data: items.map((m) => ({
        id: m.id,
        subject: m.subject,
        recipientCount: m.recipientCount,
        successCount: m.successCount,
        failureCount: m.failureCount,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        completedAt: m.completedAt ? m.completedAt.toISOString() : null,
      })),
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
  } catch (err) {
    return internalError(err, 'GET /api/admin/marketing/emails');
  }
}

