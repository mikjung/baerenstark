/**
 * Mail-Versand via Resend mit 3-Retry-Strategie (BUG-002).
 *
 * Iteration 2 (US-13/US-14):
 *  - getResend() filtert Placeholder-API-Keys aktiv (BUG US-04 Fix 3).
 *  - runMailDispatch(): fire-and-forget Wrapper für POST /api/bookings, der
 *    die Booking-Response NIEMALS blockiert (BUG US-04 Fix 1).
 *  - Neue Templates:
 *      - bookingReceiptToCustomer (Eingangsbestätigung)
 *      - counterProposalToCustomer (Vorschlag-Mail)
 *      - counterAcceptedToAdmin
 *      - rebookingToAdmin
 *      - cancellationToAdmin
 *
 * Backoff-Delays: 0 ms / 300 ms / 1500 ms (Gesamt < 4 Sekunden).
 * Buchung wird in jedem Fall persistiert; mailSent / mailError am Datensatz
 * spiegeln den Status der Tom-Mail.
 */

import { Resend } from 'resend';
import { SERVICE_LABELS, type Service } from './services';
import { prisma } from './prisma';

// ---------------------------------------------------------------------------
// Resend-Client (mit Placeholder-Filter)
// ---------------------------------------------------------------------------

let resendClient: Resend | null = null;

/**
 * Liefert einen Resend-Client oder null, wenn der API-Key nicht konfiguriert
 * ist (Default `.env.example` enthält `re_xxxxxxxxxxxx`, das soll als
 * "nicht konfiguriert" zählen).
 *
 * BUG US-04 Fix 3: Placeholder-Werte werden aktiv gefiltert.
 */
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[mail] RESEND_API_KEY not configured — mail dispatch skipped.',
      );
    }
    return null;
  }

  // Placeholder-Erkennung: `re_xxxxxxxxxxxx` (.env.example), oder allgemein
  // ein Schlüssel, der mit `re_` + 11 mal `x` beginnt (typischer Platzhalter).
  if (
    key === 're_xxxxxxxxxxxx' ||
    /^re_x{11}/.test(key) ||
    key.startsWith('re_xxxx')
  ) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[mail] RESEND_API_KEY appears to be a placeholder — mail dispatch skipped.',
      );
    }
    return null;
  }

  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Liefert die Public-Base-URL für Mail-Aktionslinks. Reihenfolge:
 *   1. NEXT_PUBLIC_BASE_URL (Iteration 2 — empfohlen)
 *   2. NEXTAUTH_URL (Fallback)
 *   3. http://localhost:3000 (Dev-Notfall)
 */
function publicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

/** Gleiche Quelle wie publicBaseUrl(); für Admin-Links. */
function adminBaseUrl(): string {
  return publicBaseUrl();
}

/**
 * Zentraler Helfer für alle Aktions-Links in Kunden-Mails.
 *
 * `actionUrl(token, 'accept')` →
 *    https://.../api/bookings/respond?token=...&action=accept
 * `actionUrl(token, 'cancel')` →
 *    https://.../api/bookings/respond?token=...&action=cancel
 * `actionUrl(token, 'rebook')` →
 *    https://.../buchung?rebookToken=...
 */
export function actionUrl(
  token: string,
  action: 'accept' | 'cancel' | 'rebook',
): string {
  const base = publicBaseUrl();
  const t = encodeURIComponent(token);
  if (action === 'rebook') return `${base}/buchung?rebookToken=${t}`;
  return `${base}/api/bookings/respond?token=${t}&action=${action}`;
}

/**
 * Liefert die Absender-Adresse aus `MAIL_FROM`. Wenn die Variable fehlt
 * oder leer ist, fällt der Mailer auf den Resend-Sandbox-Absender
 * `onboarding@resend.dev` zurück und loggt eine einmalige Warnung.
 *
 * IT10 / US-IT10-01 + IT11 / US-IT11-01:
 *   `MAIL_FROM` ist die Single-Source-Of-Truth. In Prod muss der Wert auf
 *   eine im Resend-Dashboard verifizierte Domain zeigen — sonst stellt
 *   Resend die Mail nicht an Drittempfänger zu. Der Fallback ist defensiv:
 *   solange die Domain noch nicht verifiziert ist, kann zumindest an die
 *   Resend-Test-Empfänger-Liste gemailt werden.
 */
let mailFromFallbackWarned = false;
function fromAddress(): string {
  const v = process.env.MAIL_FROM?.trim();
  if (v && v.length > 0) return v;
  if (!mailFromFallbackWarned && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn(
      '[mail] MAIL_FROM not configured — falling back to onboarding@resend.dev. ' +
        'In production set MAIL_FROM to a verified Resend domain.',
    );
    mailFromFallbackWarned = true;
  }
  return 'onboarding@resend.dev';
}

function adminToAddress(): string {
  return (
    process.env.MAIL_TO_ADMIN || 'hausservice-baerenstark@outlook.com'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Mail-Result Type + Send-Helper
// ---------------------------------------------------------------------------

export type MailResult = { ok: true } | { ok: false; error: string };

interface RawSendInput {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Internes Send (ohne Retry). Fängt jede Exception sicher ab und liefert
 * ein einheitliches MailResult — wirft nie. Wenn der Resend-Client nicht
 * konfiguriert ist, wird die Mail als "skipped" mit einem aussagekräftigen
 * Fehler markiert (verhindert false-positives im mailSent-Flag).
 */
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

/**
 * Send-with-retry. Jede Exception wird intern in MailResult überführt;
 * der Aufrufer muss diesen Helfer NIE in einen try/catch packen.
 */
async function sendWithRetry(
  input: RawSendInput,
  maxAttempts = 3,
): Promise<MailResult> {
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

// ---------------------------------------------------------------------------
// Iteration 1 Template — Buchungsbenachrichtigung an Tom
// ---------------------------------------------------------------------------

export interface BookingMailPayload {
  bookingId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  service: Service;
  description: string;
  /** Bestand IT2 — Counter-Proposal-Cancel-Token (eigener Pfad). */
  cancelToken?: string | null;
  /**
   * IT11 / US-IT11-03 — signierter Booking-Confirmation-Token (JWT, HS256,
   * Scope `booking-confirmation`, 30 Tage gültig). Wird bei Vorhandensein
   * in der Receipt-Mail als „Buchung anzeigen"-Link eingebettet.
   */
  confirmationToken?: string | null;
  /**
   * IT11 / US-IT11-06 — signierter Booking-Cancellation-Token (JWT, HS256,
   * Scope `booking-cancellation`, 30 Tage gültig). Bei Vorhandensein wird
   * der Storno-Link in der Receipt-Mail darüber gerendert; sonst Fallback
   * auf den Bestand-`cancelToken`.
   */
  cancellationToken?: string | null;
  /** Bestand IT1/IT2: Slot mit Date-Objekten. */
  slot?: {
    startsAt: Date;
    endsAt: Date;
    description: string | null;
  } | null;
  /** Iteration 3: Date/Time-basierte Buchung ("YYYY-MM-DD" + "HH:MM"). */
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

function buildAdminSubject(p: BookingMailPayload): string {
  return `Neue Buchungsanfrage von ${p.customerName} — ${SERVICE_LABELS[p.service]}`;
}

/** Liefert die Termin-Zeile (Datum + Uhrzeit) je nach Modus (IT3 oder Bestand). */
function bookingSlotLine(p: BookingMailPayload): string {
  if (p.date && p.startTime && p.endTime) {
    return `${formatBerlinDate(p.date)}, ${p.startTime}–${p.endTime} Uhr`;
  }
  if (p.slot) {
    return `${formatSlot(p.slot.startsAt)} – ${formatSlot(p.slot.endsAt)}`;
  }
  return '(kein Termin)';
}

function bookingSlotDescription(p: BookingMailPayload): string {
  return p.slot?.description ?? '';
}

function buildAdminText(p: BookingMailPayload): string {
  const slotLine = bookingSlotLine(p);
  const desc = bookingSlotDescription(p);
  const descNote = desc ? ` (${desc})` : '';
  const emailLine = p.customerEmail
    ? `E-Mail:    ${p.customerEmail}`
    : 'E-Mail:    (nicht angegeben)';

  return [
    'Neue Buchungsanfrage über die Bärenstark-Website:',
    '',
    `Name:      ${p.customerName}`,
    `Telefon:   ${p.customerPhone}`,
    emailLine,
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

function buildAdminHtml(p: BookingMailPayload): string {
  const slotLine = bookingSlotLine(p);
  const desc = bookingSlotDescription(p);
  const descNote = desc ? ` (${escapeHtml(desc)})` : '';
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

/**
 * Versucht, eine Buchungsbenachrichtigung an Tom zu senden (US-08).
 * Wirft niemals — liefert MailResult.
 */
export async function sendBookingNotification(
  payload: BookingMailPayload,
  maxAttempts = 3,
): Promise<MailResult> {
  return sendWithRetry(
    {
      from: fromAddress(),
      to: adminToAddress(),
      subject: buildAdminSubject(payload),
      text: buildAdminText(payload),
      html: buildAdminHtml(payload),
    },
    maxAttempts,
  );
}

// ---------------------------------------------------------------------------
// Iteration 2 Template — Eingangsbestätigung an Kunden
// ---------------------------------------------------------------------------

/**
 * IT11 / US-IT11-03 + 06 — neue Token-basierte Aktions-Links
 * (Bestätigungsseite + Storno-Page).
 *
 * Format:
 *   confirmationUrl = ${base}/buchung/bestaetigung/<id>?token=<jwt>
 *   cancellationUrl = ${base}/buchung/<id>/stornieren?token=<jwt>
 */
export function buildBookingConfirmationUrl(
  bookingId: string,
  confirmationToken: string,
): string {
  const base = publicBaseUrl();
  return `${base}/buchung/bestaetigung/${encodeURIComponent(bookingId)}?token=${encodeURIComponent(confirmationToken)}`;
}

export function buildBookingCancellationUrl(
  bookingId: string,
  cancellationToken: string,
): string {
  const base = publicBaseUrl();
  return `${base}/buchung/${encodeURIComponent(bookingId)}/stornieren?token=${encodeURIComponent(cancellationToken)}`;
}

function buildReceiptText(p: BookingMailPayload): string {
  const slotLine = bookingSlotLine(p);

  // IT11: Token-Links bevorzugt (signiert, scope-getrennt). Fallback auf
  // den klassischen `cancelToken`-Link (Bestand IT2) bleibt erhalten,
  // damit alte Mails / Counter-Proposal-Flows nicht brechen.
  const confirmationLink = p.confirmationToken
    ? `\nBuchung anzeigen:    ${buildBookingConfirmationUrl(p.bookingId, p.confirmationToken)}`
    : '';
  const cancelLinkLine = p.cancellationToken
    ? `\nAnfrage stornieren:  ${buildBookingCancellationUrl(p.bookingId, p.cancellationToken)}\n`
    : p.cancelToken
      ? `\nAnfrage stornieren:  ${actionUrl(p.cancelToken, 'cancel')}\n`
      : '';

  return [
    `Hallo ${p.customerName},`,
    '',
    'vielen Dank für Ihre Anfrage bei Bärenstark Hausservice. Wir haben sie erhalten und melden uns bei Ihnen, sobald Tom Ihren Wunschtermin bestätigt hat.',
    '',
    'Ihre Anfrage im Überblick:',
    `Service:   ${SERVICE_LABELS[p.service]}`,
    `Zeitraum:  ${slotLine}`,
    '',
    'Beschreibung:',
    p.description,
    confirmationLink + cancelLinkLine,
    'Bei Fragen erreichen Sie uns telefonisch unter 0157-74787512.',
    '',
    '— Ihr Haus in bärenstarken Händen!',
  ].join('\n');
}

function buildReceiptHtml(p: BookingMailPayload): string {
  const slotLine = bookingSlotLine(p);
  const safeDesc = escapeHtml(p.description).replace(/\n/g, '<br/>');

  const confirmationButton = p.confirmationToken
    ? `<a href="${buildBookingConfirmationUrl(p.bookingId, p.confirmationToken)}" style="display:inline-block; padding:10px 20px; background:#4A5D3A; color:#fff; text-decoration:none; border-radius:6px; margin:8px 8px 0 0;">Buchung anzeigen</a>`
    : '';
  const cancelButton = p.cancellationToken
    ? `<a href="${buildBookingCancellationUrl(p.bookingId, p.cancellationToken)}" style="display:inline-block; padding:10px 20px; background:#7B5E3C; color:#fff; text-decoration:none; border-radius:6px; margin-top:8px;">Anfrage stornieren</a>`
    : p.cancelToken
      ? `<a href="${actionUrl(p.cancelToken, 'cancel')}" style="display:inline-block; padding:10px 20px; background:#7B5E3C; color:#fff; text-decoration:none; border-radius:6px; margin-top:8px;">Anfrage stornieren</a>`
      : '';

  return `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
    <h1 style="margin:0 0 8px; font-size:20px;">Ihre Anfrage ist eingegangen</h1>
    <p style="margin:0 0 16px;">Hallo ${escapeHtml(p.customerName)},</p>
    <p style="margin:0 0 16px;">vielen Dank für Ihre Anfrage. Wir haben sie erhalten und melden uns bei Ihnen, sobald Tom Ihren Wunschtermin bestätigt hat.</p>
    <table style="border-collapse:collapse; width:100%; margin-bottom:16px;">
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Service</strong></td><td>${escapeHtml(SERVICE_LABELS[p.service])}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C; vertical-align:top;"><strong>Zeitraum</strong></td><td>${escapeHtml(slotLine)}</td></tr>
    </table>
    <h2 style="font-size:14px; color:#7B5E3C; margin:16px 0 4px;">Beschreibung</h2>
    <p style="margin:0 0 16px; line-height:1.5;">${safeDesc}</p>
    ${confirmationButton}
    ${cancelButton}
    <p style="margin:24px 0 0; color:#7B5E3C; font-size:12px;">Bei Fragen: 0157-74787512 — Ihr Haus in bärenstarken Händen!</p>
  </div>
</body>
</html>`;
}

export async function sendBookingReceiptToCustomer(
  payload: BookingMailPayload,
): Promise<MailResult> {
  if (!payload.customerEmail) {
    return { ok: false, error: 'No customer email' };
  }
  return sendWithRetry({
    from: fromAddress(),
    to: payload.customerEmail,
    subject: 'Ihre Anfrage bei Bärenstark Hausservice ist eingegangen',
    text: buildReceiptText(payload),
    html: buildReceiptHtml(payload),
  });
}

// ---------------------------------------------------------------------------
// Iteration 2 Template — Counter-Proposal an Kunden
// ---------------------------------------------------------------------------

export interface CounterProposalMailPayload {
  customerName: string;
  customerEmail: string;
  service: Service;
  cancelToken: string;
  originalSlot: {
    startsAt: Date;
    endsAt: Date;
  };
  proposedSlot: {
    startsAt: Date;
    endsAt: Date;
    description: string | null;
  };
}

function buildCounterProposalText(p: CounterProposalMailPayload): string {
  const orig = `${formatSlot(p.originalSlot.startsAt)} – ${formatSlot(p.originalSlot.endsAt)}`;
  const prop = `${formatSlot(p.proposedSlot.startsAt)} – ${formatSlot(p.proposedSlot.endsAt)}`;
  return [
    `Hallo ${p.customerName},`,
    '',
    `Tom kann Ihren ursprünglichen Wunschtermin am ${orig} leider nicht anbieten und schlägt stattdessen folgenden Termin vor:`,
    '',
    prop,
    '',
    'Bitte wählen Sie eine der folgenden Optionen:',
    '',
    `Vorschlag annehmen:        ${actionUrl(p.cancelToken, 'accept')}`,
    `Anderen Termin wählen:     ${actionUrl(p.cancelToken, 'rebook')}`,
    `Anfrage stornieren:        ${actionUrl(p.cancelToken, 'cancel')}`,
    '',
    'Hinweis: Die Links funktionieren jeweils nur einmal — bitte nicht weiterleiten.',
    '',
    'Bei Fragen: 0157-74787512',
    '',
    '— Ihr Haus in bärenstarken Händen!',
  ].join('\n');
}

function buildCounterProposalHtml(p: CounterProposalMailPayload): string {
  const orig = `${formatSlot(p.originalSlot.startsAt)} – ${formatSlot(p.originalSlot.endsAt)}`;
  const prop = `${formatSlot(p.proposedSlot.startsAt)} – ${formatSlot(p.proposedSlot.endsAt)}`;

  const btn = (label: string, href: string, bg: string): string =>
    `<a href="${href}" style="display:block; padding:12px 20px; background:${bg}; color:#fff; text-decoration:none; border-radius:6px; margin:6px 0; text-align:center;">${escapeHtml(label)}</a>`;

  return `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
    <h1 style="margin:0 0 8px; font-size:20px;">Alternativtermin-Vorschlag</h1>
    <p style="margin:0 0 16px;">Hallo ${escapeHtml(p.customerName)},</p>
    <p style="margin:0 0 8px;">Tom kann Ihren ursprünglichen Wunschtermin am ${escapeHtml(orig)} leider nicht anbieten und schlägt stattdessen vor:</p>
    <p style="margin:0 0 16px; font-size:18px; color:#3D2B1F;"><strong>${escapeHtml(prop)}</strong></p>
    ${btn('Vorschlag annehmen', actionUrl(p.cancelToken, 'accept'), '#4A5D3A')}
    ${btn('Anderen Termin wählen', actionUrl(p.cancelToken, 'rebook'), '#7B5E3C')}
    ${btn('Anfrage stornieren', actionUrl(p.cancelToken, 'cancel'), '#3D2B1F')}
    <p style="margin:16px 0 0; color:#7B5E3C; font-size:12px;">Hinweis: Die Buttons funktionieren jeweils nur einmal — bitte nicht weiterleiten.</p>
    <p style="margin:8px 0 0; color:#7B5E3C; font-size:12px;">Bei Fragen: 0157-74787512 — Ihr Haus in bärenstarken Händen!</p>
  </div>
</body>
</html>`;
}

export async function sendCounterProposalToCustomer(
  payload: CounterProposalMailPayload,
): Promise<MailResult> {
  return sendWithRetry({
    from: fromAddress(),
    to: payload.customerEmail,
    subject: 'Bärenstark schlägt einen anderen Termin vor',
    text: buildCounterProposalText(payload),
    html: buildCounterProposalHtml(payload),
  });
}

// ---------------------------------------------------------------------------
// Iteration 2 Template — "Kunde hat Vorschlag angenommen" an Tom
// ---------------------------------------------------------------------------

export interface CounterAcceptedMailPayload {
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  service: Service;
  newSlot: {
    startsAt: Date;
    endsAt: Date;
    description: string | null;
  };
}

export async function sendCounterAcceptedToAdmin(
  p: CounterAcceptedMailPayload,
): Promise<MailResult> {
  const slotLine = `${formatSlot(p.newSlot.startsAt)} – ${formatSlot(p.newSlot.endsAt)}`;
  const subject = `${p.customerName} hat den Alternativtermin angenommen`;
  const text = [
    `${p.customerName} hat den Alternativtermin am ${slotLine} bestätigt.`,
    '',
    `Service:   ${SERVICE_LABELS[p.service]}`,
    `Telefon:   ${p.customerPhone}`,
    `E-Mail:    ${p.customerEmail ?? '(nicht angegeben)'}`,
    '',
    `Im Admin öffnen: ${adminBaseUrl()}/admin/bookings`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="de"><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
<div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
  <h1 style="margin:0 0 12px; font-size:20px;">Vorschlag angenommen</h1>
  <p>${escapeHtml(p.customerName)} hat den Alternativtermin <strong>${escapeHtml(slotLine)}</strong> bestätigt.</p>
  <table style="border-collapse:collapse; width:100%; margin:16px 0;">
    <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Service</strong></td><td>${escapeHtml(SERVICE_LABELS[p.service])}</td></tr>
    <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Telefon</strong></td><td>${escapeHtml(p.customerPhone)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>E-Mail</strong></td><td>${p.customerEmail ? escapeHtml(p.customerEmail) : '(nicht angegeben)'}</td></tr>
  </table>
  <a href="${adminBaseUrl()}/admin/bookings" style="display:inline-block; padding:10px 20px; background:#7B5E3C; color:#fff; text-decoration:none; border-radius:6px;">Im Admin-Bereich öffnen</a>
</div></body></html>`;

  return sendWithRetry({
    from: fromAddress(),
    to: adminToAddress(),
    subject,
    text,
    html,
  });
}

// ---------------------------------------------------------------------------
// Iteration 2 Template — "Kunde hat neuen Termin gewählt" an Tom
// ---------------------------------------------------------------------------

export async function sendRebookingToAdmin(
  p: CounterAcceptedMailPayload,
): Promise<MailResult> {
  const slotLine = `${formatSlot(p.newSlot.startsAt)} – ${formatSlot(p.newSlot.endsAt)}`;
  const subject = `${p.customerName} hat einen neuen Termin gewählt`;
  const text = [
    `${p.customerName} hat einen anderen Termin als Antwort auf Ihren Vorschlag gewählt:`,
    slotLine,
    '',
    `Service:   ${SERVICE_LABELS[p.service]}`,
    `Telefon:   ${p.customerPhone}`,
    `E-Mail:    ${p.customerEmail ?? '(nicht angegeben)'}`,
    '',
    'Bitte prüfen und bestätigen oder ablehnen.',
    '',
    `Im Admin öffnen: ${adminBaseUrl()}/admin/bookings`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="de"><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
<div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
  <h1 style="margin:0 0 12px; font-size:20px;">Neuer Wunschtermin vom Kunden</h1>
  <p>${escapeHtml(p.customerName)} hat als Antwort auf Ihren Vorschlag einen neuen Termin gewählt:</p>
  <p style="font-size:18px;"><strong>${escapeHtml(slotLine)}</strong></p>
  <p>Bitte prüfen und bestätigen oder ablehnen.</p>
  <a href="${adminBaseUrl()}/admin/bookings" style="display:inline-block; padding:10px 20px; background:#7B5E3C; color:#fff; text-decoration:none; border-radius:6px;">Im Admin-Bereich öffnen</a>
</div></body></html>`;

  return sendWithRetry({
    from: fromAddress(),
    to: adminToAddress(),
    subject,
    text,
    html,
  });
}

// ---------------------------------------------------------------------------
// Iteration 2 Template — "Kunde hat storniert" an Tom
// ---------------------------------------------------------------------------

export interface CancellationMailPayload {
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  service: Service;
  description: string;
  /** Bestand-Modus: Slot mit Date-Objekten. */
  originalSlot?: {
    startsAt: Date;
    endsAt: Date;
  } | null;
  /** Iteration 3 / Date-Modus: Datum + Uhrzeit. */
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

function cancellationSlotLine(p: CancellationMailPayload): string {
  if (p.date && p.startTime && p.endTime) {
    return `${formatBerlinDate(p.date)}, ${p.startTime}–${p.endTime} Uhr`;
  }
  if (p.originalSlot) {
    return `${formatSlot(p.originalSlot.startsAt)} – ${formatSlot(p.originalSlot.endsAt)}`;
  }
  return '(kein Termin)';
}

export async function sendCancellationToAdmin(
  p: CancellationMailPayload,
): Promise<MailResult> {
  const slotLine = cancellationSlotLine(p);
  const subject = `${p.customerName} hat die Anfrage storniert`;
  const text = [
    `${p.customerName} hat die Anfrage am ${slotLine} storniert.`,
    '',
    `Service:    ${SERVICE_LABELS[p.service]}`,
    `Telefon:    ${p.customerPhone}`,
    `E-Mail:     ${p.customerEmail ?? '(nicht angegeben)'}`,
    '',
    'Beschreibung:',
    p.description,
    '',
    'Der Slot ist wieder als verfügbar markiert.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="de"><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
<div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
  <h1 style="margin:0 0 12px; font-size:20px;">Anfrage storniert</h1>
  <p>${escapeHtml(p.customerName)} hat die Anfrage am <strong>${escapeHtml(slotLine)}</strong> storniert.</p>
  <table style="border-collapse:collapse; width:100%; margin:16px 0;">
    <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Service</strong></td><td>${escapeHtml(SERVICE_LABELS[p.service])}</td></tr>
    <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Telefon</strong></td><td>${escapeHtml(p.customerPhone)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>E-Mail</strong></td><td>${p.customerEmail ? escapeHtml(p.customerEmail) : '(nicht angegeben)'}</td></tr>
  </table>
  <p style="color:#7B5E3C;">Der Slot ist wieder als verfügbar markiert.</p>
</div></body></html>`;

  return sendWithRetry({
    from: fromAddress(),
    to: adminToAddress(),
    subject,
    text,
    html,
  });
}

// ---------------------------------------------------------------------------
// Iteration 3 Template — Bestätigung an Kunden (US-24, PENDING → CONFIRMED)
// ---------------------------------------------------------------------------

/**
 * Berlin-TZ-formatierte Datums-/Zeit-Ausgabe für IT3-Mails.
 *
 * Erlaubt sowohl Date/Time-basierte Buchungen ("YYYY-MM-DD" + "HH:MM")
 * als auch Bestand-Buchungen (Slot-Date als Date-Objekt).
 */
function formatBerlinDate(dateStr: string): string {
  // "YYYY-MM-DD" → "Donnerstag, 15. Mai 2026"
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dt);
}

export interface BookingConfirmationMailPayload {
  customerName: string;
  customerEmail: string;
  service: Service;
  /** "YYYY-MM-DD" (Berlin-TZ) — optional, fallback auf slot. */
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  /** Bestandsbuchungen mit slot — werden alternativ gerendert. */
  slot?: {
    startsAt: Date;
    endsAt: Date;
  } | null;
  cancelToken: string;
}

function renderTerminLine(p: {
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  slot?: { startsAt: Date; endsAt: Date } | null;
}): string {
  if (p.date && p.startTime && p.endTime) {
    return `${formatBerlinDate(p.date)}, ${p.startTime}–${p.endTime} Uhr`;
  }
  if (p.slot) {
    return `${formatSlot(p.slot.startsAt)} – ${formatSlot(p.slot.endsAt)}`;
  }
  return '(kein Termin)';
}

function buildConfirmationText(p: BookingConfirmationMailPayload): string {
  const terminLine = renderTerminLine(p);
  const cancelLink = actionUrl(p.cancelToken, 'cancel');
  return [
    `Hallo ${p.customerName},`,
    '',
    'gute Nachrichten — Tom hat Ihren Termin bestätigt!',
    '',
    'Ihr Termin im Überblick:',
    `Service:   ${SERVICE_LABELS[p.service]}`,
    `Termin:    ${terminLine}`,
    '',
    'Bei Fragen oder kurzfristigen Änderungen erreichen Sie Tom direkt unter:',
    'Telefon: 0157-74787512',
    '',
    `Falls Sie den Termin nicht wahrnehmen können, stornieren Sie bitte hier: ${cancelLink}`,
    '',
    '— Ihr Haus in bärenstarken Händen!',
  ].join('\n');
}

function buildConfirmationHtml(p: BookingConfirmationMailPayload): string {
  const terminLine = renderTerminLine(p);
  const cancelLink = actionUrl(p.cancelToken, 'cancel');
  return `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
    <h1 style="margin:0 0 8px; font-size:20px;">Termin bestätigt!</h1>
    <p style="margin:0 0 16px;">Hallo ${escapeHtml(p.customerName)},</p>
    <p style="margin:0 0 16px;">gute Nachrichten — Tom hat Ihren Termin bestätigt!</p>
    <table style="border-collapse:collapse; width:100%; margin-bottom:16px;">
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Service</strong></td><td>${escapeHtml(SERVICE_LABELS[p.service])}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Termin</strong></td><td><strong>${escapeHtml(terminLine)}</strong></td></tr>
    </table>
    <p style="margin:16px 0; line-height:1.5;">Bei Fragen oder kurzfristigen Änderungen erreichen Sie Tom direkt unter <a href="tel:015774787512" style="color:#3D2B1F"><strong>0157-74787512</strong></a>.</p>
    <a href="${cancelLink}" style="display:inline-block; padding:10px 20px; background:#7B5E3C; color:#fff; text-decoration:none; border-radius:6px; margin-top:8px;">Termin stornieren</a>
    <p style="margin:24px 0 0; color:#7B5E3C; font-size:12px;">— Ihr Haus in bärenstarken Händen!</p>
  </div>
</body>
</html>`;
}

export async function sendBookingConfirmationToCustomer(
  payload: BookingConfirmationMailPayload,
): Promise<MailResult> {
  if (!payload.customerEmail) {
    return { ok: false, error: 'No customer email' };
  }
  return sendWithRetry({
    from: fromAddress(),
    to: payload.customerEmail,
    subject: 'Ihr Termin bei Bärenstark Hausservice ist bestätigt',
    text: buildConfirmationText(payload),
    html: buildConfirmationHtml(payload),
  });
}

// ---------------------------------------------------------------------------
// Iteration 3 Template — Ablehnung an Kunden (US-24, PENDING/CONFIRMED → REJECTED)
// ---------------------------------------------------------------------------

export interface BookingRejectionMailPayload {
  customerName: string;
  customerEmail: string;
  service: Service;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  slot?: {
    startsAt: Date;
    endsAt: Date;
  } | null;
}

function buildRejectionText(p: BookingRejectionMailPayload): string {
  const terminLine = renderTerminLine(p);
  const base = publicBaseUrl();
  return [
    `Hallo ${p.customerName},`,
    '',
    'leider können wir Ihren angefragten Termin nicht wahrnehmen:',
    `Service:   ${SERVICE_LABELS[p.service]}`,
    `Termin:    ${terminLine}`,
    '',
    'Wir würden uns freuen, wenn Sie es noch einmal mit einem anderen Termin versuchen. Auf unserer Buchungsseite finden Sie alle freien Zeitfenster:',
    `${base}/buchung`,
    '',
    'Bei Rückfragen erreichen Sie Tom direkt unter:',
    'Telefon: 0157-74787512',
    '',
    '— Ihr Haus in bärenstarken Händen!',
  ].join('\n');
}

function buildRejectionHtml(p: BookingRejectionMailPayload): string {
  const terminLine = renderTerminLine(p);
  const base = publicBaseUrl();
  return `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
    <h1 style="margin:0 0 8px; font-size:20px;">Leider keine Zusage möglich</h1>
    <p style="margin:0 0 16px;">Hallo ${escapeHtml(p.customerName)},</p>
    <p style="margin:0 0 16px;">leider können wir Ihren angefragten Termin nicht wahrnehmen:</p>
    <table style="border-collapse:collapse; width:100%; margin-bottom:16px;">
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Service</strong></td><td>${escapeHtml(SERVICE_LABELS[p.service])}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Termin</strong></td><td>${escapeHtml(terminLine)}</td></tr>
    </table>
    <p style="margin:16px 0; line-height:1.5;">Wir würden uns freuen, wenn Sie es noch einmal mit einem anderen Termin versuchen.</p>
    <a href="${base}/buchung" style="display:inline-block; padding:10px 20px; background:#7B5E3C; color:#fff; text-decoration:none; border-radius:6px; margin-top:8px;">Neuen Termin anfragen</a>
    <p style="margin:24px 0 0;">Bei Rückfragen erreichen Sie Tom direkt unter <a href="tel:015774787512" style="color:#3D2B1F"><strong>0157-74787512</strong></a>.</p>
    <p style="margin:24px 0 0; color:#7B5E3C; font-size:12px;">— Ihr Haus in bärenstarken Händen!</p>
  </div>
</body>
</html>`;
}

export async function sendBookingRejectionToCustomer(
  payload: BookingRejectionMailPayload,
): Promise<MailResult> {
  if (!payload.customerEmail) {
    return { ok: false, error: 'No customer email' };
  }
  return sendWithRetry({
    from: fromAddress(),
    to: payload.customerEmail,
    subject: 'Ihr Terminwunsch bei Bärenstark Hausservice',
    text: buildRejectionText(payload),
    html: buildRejectionHtml(payload),
  });
}

// ===========================================================================
// Iteration 4 — Kunden-Auth, Zahlungen, Reviews (US-25 / US-28 / US-29)
// ===========================================================================

// ---------------------------------------------------------------------------
// IT4 Template — E-Mail-Verifikation (US-25 AC1, AC2)
// ---------------------------------------------------------------------------

function buildVerificationText(verificationUrl: string): string {
  return [
    'Willkommen bei Bärenstark Hausservice!',
    '',
    'Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.',
    '',
    `Bestätigungs-Link: ${verificationUrl}`,
    '',
    'Der Link ist 24 Stunden gültig.',
    'Falls Sie diese Registrierung nicht ausgelöst haben, ignorieren Sie diese E-Mail einfach.',
    '',
    '— Ihr Haus in bärenstarken Händen!',
  ].join('\n');
}

function buildVerificationHtml(verificationUrl: string): string {
  return `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
    <h1 style="margin:0 0 8px; font-size:20px;">Willkommen bei Bärenstark</h1>
    <p style="margin:0 0 16px;">Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.</p>
    <p style="margin:0 0 16px;">
      <a href="${verificationUrl}" style="display:inline-block; padding:12px 24px; background:#7B5E3C; color:#fff; text-decoration:none; border-radius:6px;">E-Mail bestätigen</a>
    </p>
    <p style="margin:16px 0 0; color:#7B5E3C; font-size:12px;">Der Link ist 24 Stunden gültig.</p>
    <p style="margin:8px 0 0; color:#7B5E3C; font-size:12px;">Falls Sie diese Registrierung nicht ausgelöst haben, ignorieren Sie diese E-Mail einfach.</p>
    <p style="margin:24px 0 0; color:#7B5E3C; font-size:12px;">— Ihr Haus in bärenstarken Händen!</p>
  </div>
</body>
</html>`;
}

export async function sendVerificationEmail(
  to: string,
  verificationUrl: string,
): Promise<MailResult> {
  if (!to) return { ok: false, error: 'No email address' };
  return sendWithRetry({
    from: fromAddress(),
    to,
    subject: 'Bitte bestätigen Sie Ihre E-Mail-Adresse',
    text: buildVerificationText(verificationUrl),
    html: buildVerificationHtml(verificationUrl),
  });
}

// ---------------------------------------------------------------------------
// IT4 Template — Passwort-Reset (US-25 AC5)
// ---------------------------------------------------------------------------

function buildPasswordResetText(resetUrl: string): string {
  return [
    'Hallo,',
    '',
    'Sie haben einen Passwort-Reset für Ihr Bärenstark-Konto angefordert.',
    '',
    `Reset-Link: ${resetUrl}`,
    '',
    'Der Link ist 1 Stunde gültig.',
    'Falls Sie diesen Reset nicht ausgelöst haben, ignorieren Sie diese E-Mail.',
    '',
    '— Ihr Haus in bärenstarken Händen!',
  ].join('\n');
}

function buildPasswordResetHtml(resetUrl: string): string {
  return `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
    <h1 style="margin:0 0 8px; font-size:20px;">Passwort zurücksetzen</h1>
    <p style="margin:0 0 16px;">Sie haben einen Passwort-Reset für Ihr Bärenstark-Konto angefordert.</p>
    <p style="margin:0 0 16px;">
      <a href="${resetUrl}" style="display:inline-block; padding:12px 24px; background:#7B5E3C; color:#fff; text-decoration:none; border-radius:6px;">Passwort zurücksetzen</a>
    </p>
    <p style="margin:16px 0 0; color:#7B5E3C; font-size:12px;">Der Link ist 1 Stunde gültig.</p>
    <p style="margin:8px 0 0; color:#7B5E3C; font-size:12px;">Falls Sie diesen Reset nicht ausgelöst haben, ignorieren Sie diese E-Mail.</p>
  </div>
</body>
</html>`;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<MailResult> {
  if (!to) return { ok: false, error: 'No email address' };
  return sendWithRetry({
    from: fromAddress(),
    to,
    subject: 'Passwort zurücksetzen — Bärenstark Hausservice',
    text: buildPasswordResetText(resetUrl),
    html: buildPasswordResetHtml(resetUrl),
  });
}

// ---------------------------------------------------------------------------
// IT4 Template — Zahlungsaufforderung an Kunden (US-28 AC1)
// ---------------------------------------------------------------------------

export interface PaymentRequestMailPayload {
  bookingId: string;
  amount: number; // Cents
  paymentUrl: string;
  customerName: string;
  service: Service;
  date: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

function formatEuro(amountCents: number): string {
  const euros = amountCents / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

function buildPaymentRequestText(p: PaymentRequestMailPayload): string {
  const dateLine =
    p.date && p.startTime && p.endTime
      ? `${formatBerlinDate(p.date)}, ${p.startTime}–${p.endTime} Uhr`
      : p.date
        ? formatBerlinDate(p.date)
        : '(Datum unbekannt)';
  return [
    `Hallo ${p.customerName},`,
    '',
    'vielen Dank für Ihren Auftrag. Sie können den fälligen Betrag jetzt bequem online begleichen.',
    '',
    `Service:   ${SERVICE_LABELS[p.service]}`,
    `Termin:    ${dateLine}`,
    `Betrag:    ${formatEuro(p.amount)}`,
    '',
    `Zur Zahlung: ${p.paymentUrl}`,
    '',
    'Sie haben die Wahl zwischen Karte, PayPal, Apple Pay und Google Pay.',
    '',
    'Bei Fragen erreichen Sie uns unter 0157-74787512.',
    '',
    '— Ihr Haus in bärenstarken Händen!',
  ].join('\n');
}

function buildPaymentRequestHtml(p: PaymentRequestMailPayload): string {
  const dateLine =
    p.date && p.startTime && p.endTime
      ? `${formatBerlinDate(p.date)}, ${p.startTime}–${p.endTime} Uhr`
      : p.date
        ? formatBerlinDate(p.date)
        : '(Datum unbekannt)';
  return `<!doctype html>
<html lang="de">
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
    <h1 style="margin:0 0 8px; font-size:20px;">Ihre Rechnung von Bärenstark</h1>
    <p style="margin:0 0 16px;">Hallo ${escapeHtml(p.customerName)},</p>
    <p style="margin:0 0 16px;">vielen Dank für Ihren Auftrag. Sie können den fälligen Betrag jetzt bequem online begleichen.</p>
    <table style="border-collapse:collapse; width:100%; margin-bottom:16px;">
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Service</strong></td><td>${escapeHtml(SERVICE_LABELS[p.service])}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Termin</strong></td><td>${escapeHtml(dateLine)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Betrag</strong></td><td><strong>${escapeHtml(formatEuro(p.amount))}</strong></td></tr>
    </table>
    <a href="${p.paymentUrl}" style="display:inline-block; padding:12px 24px; background:#4A5D3A; color:#fff; text-decoration:none; border-radius:6px;">Jetzt bezahlen</a>
    <p style="margin:16px 0 0; color:#7B5E3C; font-size:12px;">Karte, PayPal, Apple Pay oder Google Pay — Ihre Wahl.</p>
    <p style="margin:8px 0 0; color:#7B5E3C; font-size:12px;">Bei Fragen: 0157-74787512</p>
  </div>
</body>
</html>`;
}

export async function sendPaymentRequestEmail(
  to: string,
  payload: PaymentRequestMailPayload,
): Promise<MailResult> {
  if (!to) return { ok: false, error: 'No customer email' };
  return sendWithRetry({
    from: fromAddress(),
    to,
    subject: 'Ihre Rechnung von Bärenstark Hausservice',
    text: buildPaymentRequestText(payload),
    html: buildPaymentRequestHtml(payload),
  });
}

// ---------------------------------------------------------------------------
// IT4 Template — Zahlung eingegangen, Tom-Mail (US-28 AC6)
// ---------------------------------------------------------------------------

export interface PaymentReceivedMailPayload {
  amount: number; // Cents
  customerName: string;
  service: Service;
  bookingId: string;
}

export async function sendPaymentReceivedEmail(
  to: string,
  payload: PaymentReceivedMailPayload,
): Promise<MailResult> {
  if (!to) return { ok: false, error: 'No email address' };
  const subject = `Zahlung eingegangen: ${formatEuro(payload.amount)} von ${payload.customerName}`;
  const text = [
    `Es ist eine Zahlung eingegangen.`,
    '',
    `Kunde:    ${payload.customerName}`,
    `Service:  ${SERVICE_LABELS[payload.service]}`,
    `Betrag:   ${formatEuro(payload.amount)}`,
    `Booking:  ${payload.bookingId}`,
    '',
    `Im Admin öffnen: ${adminBaseUrl()}/admin/bookings`,
  ].join('\n');
  const html = `<!doctype html>
<html lang="de"><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
<div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
  <h1 style="margin:0 0 12px; font-size:20px;">Zahlung eingegangen</h1>
  <table style="border-collapse:collapse; width:100%; margin:16px 0;">
    <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Kunde</strong></td><td>${escapeHtml(payload.customerName)}</td></tr>
    <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Service</strong></td><td>${escapeHtml(SERVICE_LABELS[payload.service])}</td></tr>
    <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Betrag</strong></td><td><strong>${escapeHtml(formatEuro(payload.amount))}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0; color:#7B5E3C;"><strong>Booking</strong></td><td>${escapeHtml(payload.bookingId)}</td></tr>
  </table>
  <a href="${adminBaseUrl()}/admin/bookings" style="display:inline-block; padding:10px 20px; background:#7B5E3C; color:#fff; text-decoration:none; border-radius:6px;">Im Admin öffnen</a>
</div></body></html>`;
  return sendWithRetry({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  });
}

/** Bestätigung an den Kunden, dass Zahlung eingegangen ist. */
export async function sendPaymentReceivedToCustomer(
  to: string,
  payload: PaymentReceivedMailPayload,
): Promise<MailResult> {
  if (!to) return { ok: false, error: 'No email address' };
  const subject = 'Zahlungsbestätigung — Bärenstark Hausservice';
  const text = [
    `Hallo ${payload.customerName},`,
    '',
    `vielen Dank! Wir haben Ihre Zahlung in Höhe von ${formatEuro(payload.amount)} erhalten.`,
    '',
    `Service: ${SERVICE_LABELS[payload.service]}`,
    '',
    'Sie erhalten in den nächsten Tagen Ihre Rechnung. Bei Fragen: 0157-74787512.',
    '',
    '— Ihr Haus in bärenstarken Händen!',
  ].join('\n');
  const html = `<!doctype html>
<html lang="de"><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5EBDD; padding:24px; color:#3D2B1F;">
<div style="max-width:560px; margin:0 auto; background:#fff; border-radius:8px; padding:24px;">
  <h1 style="margin:0 0 12px; font-size:20px;">Vielen Dank!</h1>
  <p>Hallo ${escapeHtml(payload.customerName)},</p>
  <p>wir haben Ihre Zahlung in Höhe von <strong>${escapeHtml(formatEuro(payload.amount))}</strong> erhalten.</p>
  <p style="color:#7B5E3C;">Service: ${escapeHtml(SERVICE_LABELS[payload.service])}</p>
  <p style="color:#7B5E3C; font-size:12px;">Bei Fragen: 0157-74787512</p>
</div></body></html>`;
  return sendWithRetry({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  });
}

// ---------------------------------------------------------------------------
// Fire-and-forget Mail-Dispatch für POST /api/bookings (BUG US-04 Fix 1)
// ---------------------------------------------------------------------------

/**
 * Wird aus POST /api/bookings als `void runMailDispatch(...)` aufgerufen.
 * Wirft NIEMALS — interne Errors werden in console.error geloggt.
 *
 * Aufgabe:
 *   1. Eingangsbestätigung an Kunden (best-effort, nur Log).
 *   2. Buchungsbenachrichtigung an Tom (mailSent/mailError am Booking persistiert).
 */
export async function runMailDispatch(
  bookingId: string,
  payload: BookingMailPayload,
): Promise<void> {
  // 1. Kunden-Eingangsbestätigung — nur Logging, kein Persist (best-effort).
  if (payload.customerEmail) {
    sendBookingReceiptToCustomer(payload)
      .then((res) => {
        if (!res.ok) {
          console.warn(
            '[mail-dispatch] customer receipt failed:',
            res.error.slice(0, 200),
          );
        }
      })
      .catch((err) => {
        console.warn('[mail-dispatch] customer receipt threw:', err);
      });
  }

  // 2. Tom-Mail (US-08) — Status persistieren.
  let result: MailResult;
  try {
    result = await sendBookingNotification(payload);
  } catch (err) {
    result = {
      ok: false,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
    };
  }

  try {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        mailSent: result.ok,
        mailError: result.ok ? null : result.error.slice(0, 500),
      },
    });
  } catch (err) {
    console.error('[mail-dispatch] db-update failed:', err);
  }
}
