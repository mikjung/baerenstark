/**
 * IT12 / US-IT12-11 (M8) — Idempotency-Key-Helper.
 *
 * `POST /api/bookings` akzeptiert optional einen `Idempotency-Key`-Header
 * (UUID oder beliebiger eindeutiger String, vom Frontend pro Submit
 * generiert). Bei doppeltem Submit mit dem gleichen Key innerhalb der
 * TTL → cached Response zurück, kein neuer Insert.
 *
 * TTL: 24h. Reaper läuft beim nächsten Cache-Hit (siehe `cleanupExpired`).
 *
 * Format-Validation: 8..200 chars. Wir akzeptieren bewusst nicht-UUIDs
 * (z.B. ULIDs, oder vom Frontend generierte Strings) — Hauptsache eindeutig.
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.8 (M8) +
 *                      backend-requirements-iteration-12.md §S11 / Post-QA.
 */

import { prisma } from './prisma';

const TTL_MS = 24 * 60 * 60 * 1000;
const KEY_MIN = 8;
const KEY_MAX = 200;

/**
 * Validiert den Header-Wert. Gibt `null`, wenn der Header fehlt oder das
 * Format nicht passt — der Caller behandelt das als „kein Idempotency-Check".
 */
export function readIdempotencyKey(headers: Headers): string | null {
  const v = headers.get('Idempotency-Key') || headers.get('idempotency-key');
  if (!v) return null;
  const trimmed = v.trim();
  if (trimmed.length < KEY_MIN || trimmed.length > KEY_MAX) return null;
  // Charakter-Whitelist: Buchstaben, Ziffern, `-`, `_`. UUIDs matchen.
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Sucht einen existierenden Cached-Response. Wenn der Key existiert ABER
 * abgelaufen ist, wird er aufgeräumt und null zurückgegeben.
 */
export async function lookupIdempotencyResponse(
  key: string,
  scope?: string,
): Promise<{ status: number; body: unknown } | null> {
  const row = await prisma.idempotencyKey.findUnique({
    where: { key },
    select: { id: true, response: true, expiresAt: true, scope: true },
  });
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await prisma.idempotencyKey.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  // Scope-Bind: wenn beide Seiten einen Scope haben, MUSS er matchen.
  // Mismatch → wir behandeln den Key als "kollidiert" und antworten mit
  // einem 409 — aber das ist Caller-Responsibility. Hier signalisieren wir
  // schlicht kein Match.
  if (scope && row.scope && row.scope !== scope) return null;
  try {
    const parsed = JSON.parse(row.response) as { status: number; body: unknown };
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.status === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persistiert einen Response unter dem angegebenen Key. Idempotent — wenn
 * der Key zwischenzeitlich angelegt wurde, wird er stillschweigend
 * überschrieben (unwahrscheinlicher Race, aber unproblematisch).
 */
export async function storeIdempotencyResponse(
  key: string,
  args: { status: number; body: unknown; scope?: string },
): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_MS);
  const response = JSON.stringify({ status: args.status, body: args.body });
  try {
    await prisma.idempotencyKey.upsert({
      where: { key },
      create: {
        key,
        scope: args.scope ?? null,
        response,
        expiresAt,
      },
      update: {
        response,
        expiresAt,
        scope: args.scope ?? null,
      },
    });
  } catch (err) {
    // Defensive: ein Fehler im Idempotency-Cache darf den Booking-Insert
    // nicht kippen. Loggen + weiter.
    // eslint-disable-next-line no-console
    console.warn('[idempotency] store failed:', err);
  }
}
