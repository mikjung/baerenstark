/**
 * IT12 / US-IT12-15 — POST /api/admin/marketing/emails/{id}/test-send
 *
 * Sendet die Mail einmalig an die Admin-Email-Adresse aus der NextAuth-
 * Session. Kein Audit-Insert (kein `MarketingEmailRecipient`-Record).
 *
 * Voraussetzungen:
 *   - MarketingEmail.status === 'draft'.
 *   - Resend ist konfiguriert.
 *
 * Footer ist identisch zur echten Mail (Pflicht — Tom soll 1:1 sehen, was
 * Empfänger bekommen). Unsubscribe-URL nutzt einen Pseudo-Customer-ID
 * (Test-Token), damit der Footer-Link nicht aus Versehen Tom selbst aus
 * dem Marketing-Verteiler abmeldet.
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.7 + §R.4 (Endpoint #7).
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError } from '@/lib/api';
import { requireAdmin } from '@/lib/require-admin';
import { sendMarketingTestMail } from '@/lib/marketing-mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: { id: string };
}

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  try {
    const me = await requireAdmin();
    if ('error' in me) return me.error;

    const id = ctx.params.id;
    if (!id) {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Ungültige ID' });
    }

    if (!me.email) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Admin-Email fehlt in der Session — Test-Send nicht möglich.',
      });
    }

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
        message: 'Test-Send ist nur im Status "draft" erlaubt.',
        subcode: 'EMAIL_NOT_DRAFT',
      });
    }

    // Audit-Logging (Test-Send wird auch geloggt, ohne DB-Insert).
    const userAgent = req.headers.get('user-agent')?.slice(0, 200) ?? '';
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    // eslint-disable-next-line no-console
    console.info(
      `[marketing-audit] POST emails/${id}/test-send admin=${me.id} ua="${userAgent}" ip=${ip}`,
    );

    // Wenn der Admin auch als CustomerUser existiert, nutzen wir dessen ID
    // damit der Test-Token verifizier-bar bleibt. Sonst Pseudo-ID.
    const adminAsCustomer = await prisma.customerUser.findUnique({
      where: { email: me.email.toLowerCase() },
      select: { id: true, firstName: true },
    });

    const firstName = adminAsCustomer?.firstName ?? me.name ?? 'Tom';
    const result = await sendMarketingTestMail({
      subject: email.subject,
      body: email.bodyText,
      toEmail: me.email,
      firstName,
      customerId: adminAsCustomer?.id,
    });

    if (!result.ok) {
      return apiError({
        code: 'MAIL_FAILED',
        message:
          result.errorMessage === 'RESEND_NOT_CONFIGURED'
            ? 'Resend ist nicht konfiguriert. Bitte den Administrator informieren.'
            : `Test-Versand fehlgeschlagen: ${result.errorMessage ?? 'unbekannter Fehler'}.`,
        subcode: 'RESEND_ERROR',
      });
    }

    return apiSuccess({ ok: true, sentTo: me.email });
  } catch (err) {
    return internalError(err, 'POST /api/admin/marketing/emails/[id]/test-send');
  }
}
