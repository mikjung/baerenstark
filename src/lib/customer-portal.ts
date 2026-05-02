/**
 * Hilfsfunktionen rund ums Kundenportal — Status-Mapping, Datums-Formatter,
 * gemeinsame Konstanten. Server-Component- UND Client-Component-sicher
 * (keine Browser-API-Aufrufe, kein DOM).
 */

import type { BookingStatus } from './schemas';

/** Deutsche Anzeige-Labels für die Booking-Status (US-26 AC3 + IT4 COMPLETED). */
export const PORTAL_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Offen',
  CONFIRMED: 'Bestätigt',
  COUNTER_PROPOSED: 'Gegenvorschlag ausstehend',
  REJECTED: 'Abgelehnt',
  CANCELLED: 'Storniert',
  COMPLETED: 'Abgeschlossen',
};

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/**
 * Farbcodes pro Status — aus den IT4-Anforderungen:
 *   Offen=gelb, Bestätigt=grün, Gegenvorschlag=orange, Storniert=grau,
 *   Abgelehnt=rot, Abgeschlossen=info/blau.
 */
export const PORTAL_STATUS_TONE: Record<BookingStatus, BadgeTone> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COUNTER_PROPOSED: 'warning',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  COMPLETED: 'info',
};

/**
 * Formatiert ein "YYYY-MM-DD" als deutsches Lang-Datum
 * "Donnerstag, 15. Mai 2026". Berlin-TZ.
 */
export function formatBerlinDateLong(date: string | null): string {
  if (!date) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

/**
 * Formatiert eine Buchungs-Zeitspanne als "HH:MM – HH:MM Uhr" ODER `null`,
 * wenn keine Uhrzeiten gesetzt sind.
 */
export function formatTimeRange(startTime: string | null, endTime: string | null): string {
  if (!startTime || !endTime) return '';
  return `${startTime}–${endTime} Uhr`;
}

/**
 * Wandelt einen Cents-Betrag in eine deutsche Euro-Anzeige um:
 * 14000 → "140,00 €".
 */
export function formatCentsAsEuro(cents: number): string {
  const euro = cents / 100;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(euro);
}

/**
 * Formatiert einen ISO-DateTime (mit Offset) als deutsches Datum + Uhrzeit
 * in Berlin-Zeit, z.B. "02.05.2026, 14:30".
 */
export function formatIsoBerlinShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Sicherheits-Helfer: validiert eine als Query-Param erhaltene `redirectUrl`.
 * Akzeptiert nur relative Pfade ohne Host (siehe ARCHITECTURE.md §17.1).
 */
export function safeCustomerCallback(input: unknown): string {
  const FALLBACK = '/konto';
  if (typeof input !== 'string' || input.length === 0) return FALLBACK;
  if (!input.startsWith('/')) return FALLBACK;
  if (input.startsWith('//')) return FALLBACK;
  if (/[:\\\s]/.test(input)) return FALLBACK;
  if (input.length > 512) return FALLBACK;
  return input;
}
