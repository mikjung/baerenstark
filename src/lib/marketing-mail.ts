/**
 * IT12 / US-IT12-15 — Marketing-Mail-Sender via Resend.
 *
 * Plain-Text only (Mail-Format-Vorgabe IT12). Concurrency 5 + 200ms-Throttle
 * pro Batch (Vercel-Hobby 10s Timeout + Resend Free 100/Tag, 10/sec).
 *
 * Hard-Cap pro Send-Operation: 50 Empfänger (siehe ARCHITECTURE_IT12.md §R.6).
 * Sicherheitsmarge:
 *   50 Mails / 5 parallel = 10 Batches × (≈300ms send + 200ms throttle) ≈ 5 s.
 *
 * Verantwortung dieser Datei:
 *   - HMAC-Unsubscribe-URL pro Empfänger generieren.
 *   - {{firstName}}-Templating anwenden.
 *   - DSGVO-Pflicht-Footer anhängen.
 *   - Resend-Aufruf mit Concurrency-Gate.
 *   - Pro-Empfänger ein normalisiertes Result zurück, das der Caller in
 *     `MarketingEmailRecipient`-Records persistiert.
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.5 + §R.6.
 */

import { Resend } from 'resend';
import { applyMarketingTemplate, appendMarketingFooter } from './marketing/footer';
import { buildUnsubscribeUrl } from './marketing-tokens';

// ---------------------------------------------------------------------------
// Resend-Client (lokal — wir reusen NICHT mail.ts, weil dortiger Client mit
// `from = MAIL_FROM` fest ist und wir hier sauber unterscheiden wollen).
// ---------------------------------------------------------------------------

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  // Placeholder-Erkennung wie in lib/mail.ts.
  if (
    key === 're_xxxxxxxxxxxx' ||
    /^re_x{11}/.test(key) ||
    key.startsWith('re_xxxx')
  ) {
    return null;
  }
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

function fromAddress(): string {
  const v = process.env.MAIL_FROM?.trim();
  return v && v.length > 0 ? v : 'onboarding@resend.dev';
}

function publicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MarketingRecipientInput {
  customerId: string;
  email: string;
  firstName: string;
}

export interface MarketingSendInput {
  subject: string;
  /** Plain-Text-Body, max 5000 chars (App-Layer-Validierung). */
  body: string;
  recipients: MarketingRecipientInput[];
}

export interface MarketingSendResult {
  customerId: string;
  email: string;
  ok: boolean;
  resendMessageId?: string;
  errorMessage?: string;
}

/**
 * Rendert den endgültigen Plain-Text-Body für einen einzelnen Empfänger:
 *   1. {{firstName}} wird substituiert.
 *   2. DSGVO-Footer mit individuellem Unsubscribe-Link wird angehängt.
 */
export function renderMarketingBody(
  body: string,
  recipient: { customerId: string; firstName: string },
): string {
  const personalised = applyMarketingTemplate(body, { firstName: recipient.firstName });
  const unsubscribeUrl = buildUnsubscribeUrl(recipient.customerId);
  return appendMarketingFooter(personalised, {
    unsubscribeUrl,
    baseUrl: publicBaseUrl(),
  });
}

/**
 * Sendet eine Marketing-Mail an einen einzelnen Empfänger. Wirft nie —
 * gibt immer ein normalisiertes `MarketingSendResult`. Wenn Resend nicht
 * konfiguriert ist, ist `ok: false` mit Error `RESEND_NOT_CONFIGURED`.
 */
export async function sendOneMarketingMail(
  subject: string,
  body: string,
  recipient: MarketingRecipientInput,
): Promise<MarketingSendResult> {
  const resend = getResend();
  if (!resend) {
    return {
      customerId: recipient.customerId,
      email: recipient.email,
      ok: false,
      errorMessage: 'RESEND_NOT_CONFIGURED',
    };
  }

  const text = renderMarketingBody(body, recipient);

  try {
    const result = await resend.emails.send({
      from: fromAddress(),
      to: recipient.email,
      subject,
      text,
    });
    if ('error' in result && result.error) {
      const err = result.error as { message?: string; name?: string };
      return {
        customerId: recipient.customerId,
        email: recipient.email,
        ok: false,
        errorMessage: (err.message ?? String(err)).slice(0, 500),
      };
    }
    const data = (result as { data?: { id?: string } }).data;
    return {
      customerId: recipient.customerId,
      email: recipient.email,
      ok: true,
      resendMessageId: data?.id,
    };
  } catch (err) {
    return {
      customerId: recipient.customerId,
      email: recipient.email,
      ok: false,
      errorMessage:
        err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    };
  }
}

/**
 * Sendet Marketing-Mails an mehrere Empfänger mit Concurrency 5 + 200ms-
 * Throttle pro Batch. Wirft nie — gibt einen Result-Eintrag pro Empfänger
 * (in derselben Reihenfolge wie input.recipients).
 *
 * Hard-Cap-Validierung erfolgt im Caller (`POST /emails/{id}/send`).
 */
export async function sendMarketingMails(
  input: MarketingSendInput,
): Promise<MarketingSendResult[]> {
  const concurrency = 5;
  const throttleMs = 200;
  const results: MarketingSendResult[] = new Array(input.recipients.length);

  for (let i = 0; i < input.recipients.length; i += concurrency) {
    const batch = input.recipients.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((r) => sendOneMarketingMail(input.subject, input.body, r)),
    );

    for (let j = 0; j < batchResults.length; j++) {
      const settled = batchResults[j];
      const recipient = batch[j];
      if (settled.status === 'fulfilled') {
        results[i + j] = settled.value;
      } else {
        results[i + j] = {
          customerId: recipient.customerId,
          email: recipient.email,
          ok: false,
          errorMessage:
            settled.reason instanceof Error
              ? settled.reason.message.slice(0, 500)
              : String(settled.reason).slice(0, 500),
        };
      }
    }

    if (i + concurrency < input.recipients.length) {
      // Letzter Batch braucht keinen Throttle.
      await sleep(throttleMs);
    }
  }

  return results;
}

/**
 * Hilfsfunktion: Test-Send ohne Audit-Insert. Sendet die Mail einmalig an
 * `toEmail` mit `firstName` (typischerweise Tom's Admin-Email + Vorname).
 *
 * Footer und Unsubscribe-URL werden mit einer Pseudo-Customer-ID befüllt,
 * damit der Footer in der Test-Mail 1:1 wie die echte Mail aussieht.
 * Falls Tom als Customer existiert, kann der Caller dessen ID übergeben.
 */
export async function sendMarketingTestMail(args: {
  subject: string;
  body: string;
  toEmail: string;
  firstName: string;
  /** Wenn vorhanden: Tom's Customer-ID (für korrekt verifizierbaren Token). */
  customerId?: string;
}): Promise<MarketingSendResult> {
  const recipient: MarketingRecipientInput = {
    customerId: args.customerId ?? 'test-recipient',
    email: args.toEmail,
    firstName: args.firstName,
  };
  return sendOneMarketingMail(args.subject, args.body, recipient);
}
