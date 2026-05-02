/**
 * Datums- und Zeit-Formatierung in deutscher Locale (Europe/Berlin).
 *
 * Wir nutzen Intl.DateTimeFormat statt date-fns, um die Bundle-Größe klein
 * zu halten. Backend liefert ISO-8601 mit Offset, Frontend rendert konsistent
 * für deutsche Nutzer.
 */

const DATE_LONG = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const DATE_SHORT = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const TIME_HM = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
});

const DATETIME_FULL = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_LONG.format(d);
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_SHORT.format(d);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return TIME_HM.format(d);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATETIME_FULL.format(d);
}

/**
 * Formatiert ein Slot-Zeitfenster als
 * "Donnerstag, 15. Mai 2026 · 08:00 – 12:00 Uhr".
 */
export function formatSlotRange(startsAt: string, endsAt: string): string {
  return `${formatDateLong(startsAt)} · ${formatTime(startsAt)} – ${formatTime(endsAt)} Uhr`;
}

/**
 * Kompakte Variante für Tabellen.
 */
export function formatSlotRangeCompact(startsAt: string, endsAt: string): string {
  return `${formatDateShort(startsAt)} · ${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

/**
 * Lokale Datetime-Werte aus einem `<input type="datetime-local">` (ohne
 * Zeitzone) interpretieren als Europe/Berlin und in ISO 8601 mit Offset
 * konvertieren — entspricht dem, was das Backend laut api-routes.md akzeptiert.
 */
export function localInputToIso(local: string): string {
  // Browser liefert "2026-05-15T08:00" ohne TZ-Suffix.
  // new Date(...) interpretiert das als Local Time des Nutzer-Browsers.
  // Für den MVP nehmen wir an: Tom administriert von Deutschland aus, daher
  // entspricht Browser-Local-Time bereits Europe/Berlin. Wir schicken einen
  // ISO-String mit Z (UTC) — Backend konvertiert ohnehin in UTC.
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  return d.toISOString();
}
