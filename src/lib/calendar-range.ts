/**
 * IT9 / US-IT9-03 — Helpers zur Berechnung des initialen Range-Fetchs für
 * den öffentlichen Buchungs-Kalender (`BookingCalendar.tsx`).
 *
 * Symmetrisch zum IT8-02-Pattern in `AdminCalendarView.tsx`
 * (`computeInitialRangeBerlin`), aber mit eigenem Namen
 * (`computeInitialMonthRangeBerlin`), weil:
 *   - der Customer-Kalender den Initial-View `dayGridMonth` rendert
 *     (`AppCalendar.tsx` Zeile 184) und damit eine MONATS-Spanne braucht,
 *   - der Admin-Kalender im IT8-02-Fix eine 14-Tages-Spanne braucht
 *     (Wochen- bzw. Tages-Default-View).
 *
 * Der Helper liegt bewusst in einer eigenen Datei (`src/lib/calendar-range.ts`),
 * damit der Name-Konflikt zur Admin-Variante (`computeInitialRangeBerlin` in
 * `AdminCalendarView.tsx`) sofort beim Code-Review sichtbar ist und damit
 * keine versehentliche Helper-Duplikation entsteht.
 */

const BERLIN_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Liefert YYYY-MM-DD für ein `Date` in Europe/Berlin. */
export function isoBerlin(d: Date): string {
  return BERLIN_DATE_FMT.format(d);
}

/**
 * Initialer Fetch-Range für den öffentlichen Customer-Buchungs-Kalender.
 *
 * Default-View ist `dayGridMonth` (siehe `AppCalendar.tsx` `initialView`),
 * der eine ganze Monatsmatrix zeigt — typischerweise 6 Wochen × 7 Tage = 42
 * Tage, beginnend mit dem Montag VOR dem 1. des aktuellen Monats und endend
 * mit dem Sonntag NACH dem letzten Tag.
 *
 * Wir laden eine etwas konservativere Spanne (7 Tage vor heute bis +42 Tage)
 * — das deckt jeden Fall sicher ab, ohne die Backend-Cap (62 Tage,
 * `AvailabilityCalendarSchema`) zu überschreiten. Sobald FullCalendar
 * gemountet ist, feuert sein `datesSet`-Hook und liefert den exakten View-
 * Range; der `useRef`-Dedup-Filter in `BookingCalendar.tsx` fängt einen
 * etwaigen Doppel-Fetch ab.
 */
export function computeInitialMonthRangeBerlin(): { from: string; to: string } {
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 7);
  const toDate = new Date(now);
  toDate.setDate(toDate.getDate() + 42);
  return { from: isoBerlin(fromDate), to: isoBerlin(toDate) };
}
