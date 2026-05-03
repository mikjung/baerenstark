/**
 * Zeit-String-Helfer (HH:MM ↔ Minuten-Arithmetik).
 *
 * Iteration 5 (US-33/US-34): genutzt für endTime-Berechnung aus
 * (startTime, durationMinutes) sowie Buffer-Overlap-Checks.
 */

/** Wandelt "HH:MM" → Minuten seit Mitternacht. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Wandelt Minuten seit Mitternacht → "HH:MM" (zero-padded). */
export function minutesToTime(min: number): string {
  // Clamp so wir nie negative oder 24h+ Werte rendern; in IT5-Domäne
  // bewegen wir uns immer zwischen 00:00 und 23:59.
  const clamped = Math.max(0, Math.min(24 * 60, min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "09:00" + 120 → "11:00". */
export function addMinutesToTime(t: string, minutes: number): string {
  return minutesToTime(timeToMinutes(t) + minutes);
}

/** "11:00" - 30 → "10:30". */
export function subtractMinutesFromTime(t: string, minutes: number): string {
  return minutesToTime(timeToMinutes(t) - minutes);
}
