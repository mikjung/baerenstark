/**
 * Anfrage-Mailer — sendet eine Kontaktanfrage von der Website an Tom.
 *
 * Keine DB, keine Bestätigungs-Tokens, keine Storno-Links: einfache
 * E-Mail mit den Anfrage-Daten + optionalen Anhängen. Bei vorhandener
 * Customer-Mail wird zusätzlich eine Eingangsbestätigung an den Kunden
 * verschickt (best-effort).
 */

import { Resend } from 'resend';
import { SERVICE_LABELS, type Service } from './services';

export interface AnfrageMailPayload {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  service: Service;
  description: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export type MailResult = { ok: true } | { ok: false; error: string };

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fromAddress(): string {
  const v = process.env.MAIL_FROM?.trim();
  if (v && v.length > 0) return v;
  return 'onboarding@resend.dev';
}

function adminToAddress(): string {
  return process.env.MAIL_TO_ADMIN || 'hausservice-baerenstark@outlook.com';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface RawSendInput {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
  replyTo?: string;
}

async function rawSend(input: RawSendInput): Promise<MailResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY is not configured' };
  }
  try {
    const result = await resend.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
      attachments: input.attachments,
    });
    if (result?.error) {
      return {
        ok: false,
        error: String(result.error.message ?? result.error).slice(0, 500),
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
    };
  }
}

const RETRY_DELAYS_MS = [0, 300, 1500];

async function sendWithRetry(input: RawSendInput, maxAttempts = 3): Promise<MailResult> {
  let lastError = 'unknown error';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    if (delay > 0) await sleep(delay);
    const res = await rawSend(input);
    if (res.ok) return { ok: true };
    lastError = res.error;
  }
  return { ok: false, error: lastError.slice(0, 500) };
}

function buildAdminText(p: AnfrageMailPayload): string {
  return [
    'Neue Anfrage über die Bärenstark-Website:',
    '',
    `Name:      ${p.customerName}`,
    `Telefon:   ${p.customerPhone}`,
    `E-Mail:    ${p.customerEmail}`,
    `Service:   ${SERVICE_LABELS[p.service]}`,
    '',
    'Beschreibung:',
    p.description,
    '',
    p.attachments && p.attachments.length > 0
      ? `Anhänge:   ${p.attachments.length} Datei(en) angehängt`
      : 'Anhänge:   keine',
    '',
    'Antworten Sie einfach auf diese E-Mail, um direkt mit dem Kunden in Kontakt zu treten.',
    '',
    '— Ihr Haus in Bärenstarken Händen!',
  ].join('\n');
}

function buildAdminHtml(p: AnfrageMailPayload): string {
  const safeDescription = escapeHtml(p.description).replace(/\n/g, '<br/>');
  const attachmentsLine =
    p.attachments && p.attachments.length > 0
      ? `${p.attachments.length} Datei(en) angehängt`
      : '<span style="color:#888">keine</span>';

  return `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 8px; font-size:20px; color:#3D2B1F;">Neue Anfrage</h1>
    <p style="margin:0 0 16px; color:#7B5E3C;">Über die Bärenstark-Website ist eine neue Anfrage eingegangen.</p>

    <table style="border-collapse:collapse; width:100%; margin-bottom:16px;">
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Name</strong></td><td>${escapeHtml(p.customerName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Telefon</strong></td><td><a href="tel:${escapeHtml(
        p.customerPhone.replace(/[^+\d]/g, ''),
      )}" style="color:#3D2B1F">${escapeHtml(p.customerPhone)}</a></td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>E-Mail</strong></td><td><a href="mailto:${escapeHtml(
        p.customerEmail,
      )}" style="color:#3D2B1F">${escapeHtml(p.customerEmail)}</a></td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Service</strong></td><td>${escapeHtml(SERVICE_LABELS[p.service])}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Anhänge</strong></td><td>${attachmentsLine}</td></tr>
    </table>

    <h2 style="font-size:14px; color:#7B5E3C; margin:16px 0 4px;">Beschreibung</h2>
    <p style="margin:0 0 24px; line-height:1.5;">${safeDescription}</p>

    <p style="margin:24px 0 0; color:#7B5E3C; font-size:12px;">Antworten Sie einfach auf diese E-Mail, um direkt mit dem Kunden in Kontakt zu treten.</p>
    <p style="margin:8px 0 0; color:#7B5E3C; font-size:12px;">— Ihr Haus in Bärenstarken Händen!</p>
  </div>
</body>
</html>`;
}

function buildCustomerReceiptText(p: AnfrageMailPayload): string {
  return [
    `Hallo ${p.customerName},`,
    '',
    'vielen Dank für Ihre Anfrage bei Bärenstark Hausservice. Wir haben sie erhalten und melden uns zeitnah bei Ihnen, um alles Weitere zu besprechen.',
    '',
    'Ihre Anfrage im Überblick:',
    `Service:   ${SERVICE_LABELS[p.service]}`,
    '',
    'Beschreibung:',
    p.description,
    '',
    'Bei Fragen erreichen Sie uns telefonisch unter 0157 74787512.',
    '',
    '— Ihr Haus in Bärenstarken Händen!',
  ].join('\n');
}

function buildCustomerReceiptHtml(p: AnfrageMailPayload): string {
  const safeDesc = escapeHtml(p.description).replace(/\n/g, '<br/>');
  return `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
    <h1 style="margin:0 0 8px; font-size:20px;">Ihre Anfrage ist eingegangen</h1>
    <p style="margin:0 0 16px;">Hallo ${escapeHtml(p.customerName)},</p>
    <p style="margin:0 0 16px;">vielen Dank für Ihre Anfrage. Wir haben sie erhalten und melden uns zeitnah bei Ihnen, um alles Weitere zu besprechen.</p>
    <table style="border-collapse:collapse; width:100%; margin-bottom:16px;">
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Service</strong></td><td>${escapeHtml(SERVICE_LABELS[p.service])}</td></tr>
    </table>
    <h2 style="font-size:14px; color:#7B5E3C; margin:16px 0 4px;">Beschreibung</h2>
    <p style="margin:0 0 16px; line-height:1.5;">${safeDesc}</p>
    <p style="margin:24px 0 0; color:#7B5E3C; font-size:12px;">Bei Fragen: 0157 74787512 — Ihr Haus in Bärenstarken Händen!</p>
  </div>
</body>
</html>`;
}

export async function sendAnfrageToAdmin(payload: AnfrageMailPayload): Promise<MailResult> {
  return sendWithRetry({
    from: fromAddress(),
    to: adminToAddress(),
    replyTo: payload.customerEmail,
    subject: `Neue Anfrage von ${payload.customerName} — ${SERVICE_LABELS[payload.service]}`,
    text: buildAdminText(payload),
    html: buildAdminHtml(payload),
    attachments: payload.attachments,
  });
}

export async function sendAnfrageReceiptToCustomer(
  payload: AnfrageMailPayload,
): Promise<MailResult> {
  if (!payload.customerEmail) {
    return { ok: false, error: 'No customer email' };
  }
  return sendWithRetry({
    from: fromAddress(),
    to: payload.customerEmail,
    subject: 'Ihre Anfrage bei Bärenstark Hausservice ist eingegangen',
    text: buildCustomerReceiptText(payload),
    html: buildCustomerReceiptHtml(payload),
  });
}
