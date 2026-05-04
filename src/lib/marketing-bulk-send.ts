/**
 * IT12 / US-IT12-15 — Bulk-Send-Helper für Marketing-Mails.
 *
 * Wird von `POST /api/admin/marketing/emails` (status='send') und von
 * `POST /api/admin/marketing/emails/{id}/send` aufgerufen. Logik ist
 * identisch — Caller unterscheiden sich nur darin, ob die `MarketingEmail`
 * gerade frisch angelegt wurde oder schon als Draft existiert.
 *
 * Hard-Cap-Validierung erfolgt im Caller (Schema enforces `recipientIds <= 50`).
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.6 (Bulk-Send-Architektur),
 * backend-requirements-iteration-12.md §S15 / Post-QA Revision.
 */

import { prisma } from './prisma';
import { sendMarketingMails } from './marketing-mail';

export interface BulkSendInput {
  marketingEmailId: string;
  subject: string;
  body: string;
  recipientCustomerIds: string[];
  /**
   * IT12 BUG-003: Wenn `true` und mindestens ein Recipient nach dem
   * Bestandskunden-Filter wegfällt → Abbruch mit `INVALID_RECIPIENTS`.
   * Wenn `false` (Bestand-Verhalten) → wegfallende IDs werden still
   * ignoriert. Der `/send`-Endpoint nutzt strict, der inline-Send aus
   * `POST /api/admin/marketing/emails` (status='send') auch.
   */
  strictRecipients?: boolean;
}

export type BulkSendOutcome =
  | {
      ok: true;
      intendedRecipients: number;
      actualRecipients: number;
      successCount: number;
      failureCount: number;
      status: 'sent' | 'partial_failure' | 'failed';
      failedRecipients: { email: string; errorMessage: string }[];
      /**
       * IT12 Bug-Fix BUG-003: IDs, die aus den `recipientCustomerIds`
       * herausgefiltert wurden, weil der Customer KEINE COMPLETED-Booking
       * besitzt oder bereits unsubscribed ist. Audit-Transparenz.
       */
      excludedRecipientIds: string[];
    }
  | {
      ok: false;
      errorCode: 'DAILY_QUOTA_EXCEEDED';
      message: string;
      remaining: number;
    }
  | {
      ok: false;
      errorCode: 'INVALID_RECIPIENTS';
      message: string;
      /**
       * IDs, die NICHT versendet werden dürfen (kein Bestandskunde,
       * unsubscribed oder Email leer). Caller liefert sie im
       * 422-Response zurück, damit Tom die Auswahl korrigieren kann.
       */
      excludedRecipientIds: string[];
    };

/**
 * Synchroner Bulk-Send mit:
 *   - Daily-Quota-Check (Resend Free 100/Tag) BEFORE send.
 *   - Hart-Filter auf `unsubscribedAt IS NULL`.
 *   - Pro-Empfänger PENDING-Audit-Insert.
 *   - Concurrency 5 + 200ms-Throttle.
 *   - Pro-Empfänger SENT/FAILED-Update nach Resend-Result.
 *   - Final-Status-Update auf MarketingEmail.
 */
export async function performMarketingBulkSend(args: BulkSendInput): Promise<BulkSendOutcome> {
  // 1. Daily-Quota.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const sentToday = await prisma.marketingEmailRecipient.count({
    where: { status: 'SENT', sentAt: { gte: startOfDay } },
  });
  const dailyCap = 100;
  const remaining = Math.max(0, dailyCap - sentToday);

  // 2. Empfänger-Filter.
  // IT12 BUG-003 (UWG §7 Abs. 3): Marketing-Mails dürfen ausschließlich an
  // Bestandskunden gehen — Customer mit MINDESTENS einer COMPLETED-Booking.
  // Backend ist die letzte Verteidigungslinie und darf nicht annehmen, dass
  // das Frontend bereits korrekt gefiltert hat.
  const validCustomers = await prisma.customerUser.findMany({
    where: {
      id: { in: args.recipientCustomerIds },
      unsubscribedAt: null,
      bookings: { some: { status: 'COMPLETED' } },
    },
    select: { id: true, email: true, firstName: true },
  });
  const sendable = validCustomers.filter((c) => !!c.email && c.email.length > 0);

  // Audit: welche IDs wurden ausgeschlossen?
  const sendableIdSet = new Set(sendable.map((c) => c.id));
  const excludedRecipientIds = args.recipientCustomerIds.filter(
    (id) => !sendableIdSet.has(id),
  );

  // eslint-disable-next-line no-console
  console.info(
    `[marketing-audit] bulk-send filter result emailId=${args.marketingEmailId} ` +
      `intended=${args.recipientCustomerIds.length} sendable=${sendable.length} ` +
      `excluded=${excludedRecipientIds.length}`,
  );

  // IT12 BUG-003: Wenn der Caller den `strictRecipients`-Modus aktiviert hat
  // (d.h. der Send-Endpoint mit explizitem recipientIds-Body), brechen wir
  // mit INVALID_RECIPIENTS ab, sobald MINDESTENS EINE ID ausgeschlossen
  // wurde. Tom soll die Liste bewusst korrigieren statt eine Teilmenge zu
  // versenden.
  if (args.strictRecipients && excludedRecipientIds.length > 0) {
    return {
      ok: false,
      errorCode: 'INVALID_RECIPIENTS',
      message:
        `${excludedRecipientIds.length} Empfänger sind nicht zulässig ` +
        '(kein Bestandskunde mit abgeschlossener Buchung, abgemeldet oder ' +
        'fehlende Email). Bitte Auswahl korrigieren.',
      excludedRecipientIds,
    };
  }

  if (sendable.length === 0) {
    await prisma.marketingEmail.update({
      where: { id: args.marketingEmailId },
      data: {
        recipientCount: 0,
        status: 'failed',
        completedAt: new Date(),
      },
    });
    return {
      ok: true,
      intendedRecipients: args.recipientCustomerIds.length,
      actualRecipients: 0,
      successCount: 0,
      failureCount: 0,
      status: 'failed',
      failedRecipients: [],
      excludedRecipientIds,
    };
  }

  if (sendable.length > remaining) {
    return {
      ok: false,
      errorCode: 'DAILY_QUOTA_EXCEEDED',
      message: `Tägliches Versandkontingent überschritten. Verbleibend: ${remaining}, geplant: ${sendable.length}.`,
      remaining,
    };
  }

  // 3. Status auf sending + recipientCount aktualisieren.
  await prisma.marketingEmail.update({
    where: { id: args.marketingEmailId },
    data: { status: 'sending', recipientCount: sendable.length },
  });

  // 4. Pro-Empfänger PENDING-Records.
  const recipientRecords: { id: string; customerId: string }[] = [];
  for (const c of sendable) {
    const rec = await prisma.marketingEmailRecipient.create({
      data: {
        marketingEmailId: args.marketingEmailId,
        customerId: c.id,
        email: c.email,
        status: 'PENDING',
      },
      select: { id: true, customerId: true },
    });
    recipientRecords.push(rec);
  }

  // 5. Bulk-Send.
  const results = await sendMarketingMails({
    subject: args.subject,
    body: args.body,
    recipients: sendable.map((c) => ({
      customerId: c.id,
      email: c.email,
      firstName: c.firstName,
    })),
  });

  let successCount = 0;
  let failureCount = 0;
  const failed: { email: string; errorMessage: string }[] = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const rec = recipientRecords[i];
    try {
      if (r.ok) {
        successCount += 1;
        await prisma.marketingEmailRecipient.update({
          where: { id: rec.id },
          data: {
            status: 'SENT',
            resendMessageId: r.resendMessageId ?? null,
            sentAt: new Date(),
          },
        });
      } else {
        failureCount += 1;
        const msg = (r.errorMessage ?? 'Unbekannter Fehler').slice(0, 500);
        failed.push({ email: r.email, errorMessage: msg });
        await prisma.marketingEmailRecipient.update({
          where: { id: rec.id },
          data: { status: 'FAILED', errorMessage: msg },
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[marketing] recipient persist failed:', err);
    }
  }

  let finalStatus: 'sent' | 'partial_failure' | 'failed';
  if (successCount > 0 && failureCount === 0) finalStatus = 'sent';
  else if (successCount === 0) finalStatus = 'failed';
  else finalStatus = 'partial_failure';

  await prisma.marketingEmail.update({
    where: { id: args.marketingEmailId },
    data: {
      status: finalStatus,
      successCount,
      failureCount,
      completedAt: new Date(),
    },
  });

  return {
    ok: true,
    intendedRecipients: args.recipientCustomerIds.length,
    actualRecipients: sendable.length,
    successCount,
    failureCount,
    status: finalStatus,
    failedRecipients: failed,
    excludedRecipientIds,
  };
}
