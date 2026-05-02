/**
 * Mail-Versand via Resend mit 3-Retry-Strategie (BUG-002).
 *
 * Backoff-Delays: 0 ms / 300 ms / 1500 ms (Gesamt < 4 Sekunden).
 * Bei Erfolg: { ok: true }.
 * Bei finalem Fehlschlag: { ok: false, error: string (max 500 Z.) }.
 *
 * Buchung wird in jedem Fall persistiert; mailSent / mailError am Datensatz
 * spiegeln das Ergebnis. Outbox-Pattern bleibt Backlog (siehe ARCHITECTURE.md §6).
 */

import { Resend } from 'resend';
import { SERVICE_LABELS, type Service } from './services';

export interface BookingMailPayload {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  service: Service;
  description: string;
  slot: {
    startsAt: Date;
    endsAt: Date;
    description: string | null;
  };
}

export type MailResult = { ok: true } | { ok: false; error: string };

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

const SLOT_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  dateStyle: 'full',
  timeStyle: 'short',
});

function formatSlot(date: Date): string {
  if (Number.isNaN(date.getTime())) return String(date);
  return SLOT_FORMATTER.format(date);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function adminBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000'
  );
}

function buildSubject(p: BookingMailPayload): string {
  return `Neue Buchungsanfrage von ${p.customerName} — ${SERVICE_LABELS[p.service]}`;
}

function buildText(p: BookingMailPayload): string {
  const slotLine = `${formatSlot(p.slot.startsAt)} – ${formatSlot(p.slot.endsAt)}`;
  const descNote = p.slot.description ? ` (${p.slot.description})` : '';
  const emailLine = p.customerEmail
    ? `E-Mail:    ${p.customerEmail}\n`
    : 'E-Mail:    (nicht angegeben)\n';

  return [
    'Neue Buchungsanfrage über die Bärenstark-Website:',
    '',
    `Name:      ${p.customerName}`,
    `Telefon:   ${p.customerPhone}`,
    emailLine.trimEnd(),
    `Service:   ${SERVICE_LABELS[p.service]}`,
    `Zeitraum:  ${slotLine}${descNote}`,
    '',
    'Beschreibung:',
    p.description,
    '',
    `Anfrage im Admin-Bereich öffnen: ${adminBaseUrl()}/admin/bookings`,
    '',
    '— Ihr Haus in bärenstarken Händen!',
  ].join('\n');
}

function buildHtml(p: BookingMailPayload): string {
  const slotLine = `${formatSlot(p.slot.startsAt)} – ${formatSlot(p.slot.endsAt)}`;
  const descNote = p.slot.description ? ` (${escapeHtml(p.slot.description)})` : '';
  const emailRow = p.customerEmail
    ? `<tr><td style="padding:4px 12px 4px 0; color:#7B5E3C; vertical-align:top;"><strong>E-Mail</strong></td><td><a href="mailto:${escapeHtml(
        p.customerEmail,
      )}" style="color:#3D2B1F">${escapeHtml(p.customerEmail)}</a></td></tr>`
    : '<tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>E-Mail</strong></td><td style="color:#888">(nicht angegeben)</td></tr>';

  const safeDescription = escapeHtml(p.description).replace(/\n/g, '<br/>');

  return `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 8px; font-size:20px; color:#3D2B1F;">Neue Buchungsanfrage</h1>
    <p style="margin:0 0 16px; color:#7B5E3C;">Über die Bärenstark-Website ist eine neue Anfrage eingegangen.</p>

    <table style="border-collapse:collapse; width:100%; margin-bottom:16px;">
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Name</strong></td><td>${escapeHtml(p.customerName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Telefon</strong></td><td><a href="tel:${escapeHtml(
        p.customerPhone.replace(/[^+\d]/g, ''),
      )}" style="color:#3D2B1F">${escapeHtml(p.customerPhone)}</a></td></tr>
      ${emailRow}
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Service</strong></td><td>${escapeHtml(SERVICE_LABELS[p.service])}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C; vertical-align:top;"><strong>Zeitraum</strong></td><td>${escapeHtml(slotLine)}${descNote}</td></tr>
    </table>

    <h2 style="font-size:14px; color:#7B5E3C; margin:16px 0 4px;">Beschreibung</h2>
    <p style="margin:0 0 24px; line-height:1.5;">${safeDescription}</p>

    <a href="${adminBaseUrl()}/admin/bookings"
       style="display:inline-block; padding:10px 20px; background:#7B5E3C; color:#fff; text-decoration:none; border-radius:6px;">
      Im Admin-Bereich öffnen
    </a>

    <p style="margin:24px 0 0; color:#7B5E3C; font-size:12px;">— Ihr Haus in bärenstarken Händen!</p>
  </div>
</body>
</html>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const RETRY_DELAYS_MS = [0, 300, 1500];

async function sendOnce(payload: BookingMailPayload): Promise<MailResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY is not configured' };
  }

  const from = process.env.MAIL_FROM || 'onboarding@resend.dev';
  const to = process.env.MAIL_TO_ADMIN || 'hausservice-baerenstark@outlook.com';

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject: buildSubject(payload),
      text: buildText(payload),
      html: buildHtml(payload),
    });
    if (result.error) {
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

/**
 * Versucht den Versand bis zu maxAttempts-mal mit Backoff. Liefert
 * { ok: true } bei erstem Erfolg, sonst { ok: false, error } mit der
 * letzten Fehlermeldung (max. 500 Zeichen).
 */
export async function sendBookingNotification(
  payload: BookingMailPayload,
  maxAttempts = 3,
): Promise<MailResult> {
  let lastError = 'unknown error';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    if (delay > 0) await sleep(delay);

    const res = await sendOnce(payload);
    if (res.ok) return { ok: true };
    lastError = res.error;
  }

  return { ok: false, error: lastError.slice(0, 500) };
}
