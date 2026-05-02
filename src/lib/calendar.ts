/**
 * Helfer für Kalender-Berechnungen in Europe/Berlin-Zeitzone (US-16).
 *
 * Wir nutzen `Intl.DateTimeFormat`-basiertes Mapping, um aus einem absoluten
 * Datum (UTC-Zeit) den Berlin-Wochentag und das Berlin-Datum (YYYY-MM-DD)
 * zu bestimmen. Das ist robust gegenüber Sommer-/Winterzeit, ohne dass wir
 * eine Library wie luxon einziehen müssen.
 */

const TZ = 'Europe/Berlin';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
});

/** "en-CA" mit YYYY-MM-DD-Format → liefert ISO-Date. */
export function formatDateInBerlin(date: Date): string {
  return DATE_FORMATTER.format(date);
}

const WEEKDAY_TO_NUM: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function weekdayInBerlin(date: Date): number {
  const short = WEEKDAY_FORMATTER.format(date);
  return WEEKDAY_TO_NUM[short] ?? new Date(date).getUTCDay();
}

/**
 * Liefert für ein Berlin-lokales Datum (YYYY-MM-DD) den UTC-Zeitpunkt
 * "00:00 Uhr Berlin-Zeit" als Date-Objekt. Wir nutzen einen iterativen
 * Trick: die UTC-Stunde, die in Berlin den Tag startet, hängt von DST ab.
 * Wir berechnen aus dem TZ-Offset zur Berliner Mittagszeit das passende UTC.
 */
export function berlinDateStartUtc(year: number, month: number, day: number): Date {
  // Pivot: Berliner Mittagszeit am gewünschten Tag → davon ausgehend
  // berechnen wir den exakten UTC-Zeitpunkt für 00:00 Berlin-Zeit.
  const pivot = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetMin = berlinOffsetMinutes(pivot);
  // 00:00 Berlin = (00 - offsetMin)Uhr UTC am gleichen Datum.
  return new Date(Date.UTC(year, month - 1, day, 0, -offsetMin, 0));
}

/** Berlin-Offset in Minuten (positiv = östlich von UTC). */
function berlinOffsetMinutes(d: Date): number {
  // Manuell aus TZ-aware Formatter ablesen.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const tzAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((tzAsUtc - d.getTime()) / 60000);
}

/** Tage im Monat (year, month=1..12). */
export function daysInMonth(year: number, month: number): number {
  // month-1 mit day=0 → letzter Tag des Vormonats. Bei month=12, year=2026:
  // new Date(2026, 12, 0) liefert 2026-12-31 = 31 Tage.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "YYYY-MM-DD" als String. */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
