/**
 * IT12 / US-IT12-15 — Stateless HMAC-Tokens für Marketing-Mail-Unsubscribe.
 *
 * Stateless: kein DB-Lookup, keine Token-Tabelle. Der Token wird
 * deterministisch aus `customerId` + `UNSUBSCRIBE_TOKEN_SECRET` abgeleitet.
 * Daher ist derselbe Token für denselben Customer in allen Mails identisch
 * (kein TTL nötig, solange der Customer existiert).
 *
 * Token-Format: `base64url(customerId + ':' + hmac.slice(0, 32))`.
 *
 * Sicherheits-Eigenschaften:
 *   - HMAC-SHA256 mit eigenem Secret (NIE reuse mit AUTH_SECRET oder
 *     BOOKING_TOKEN_SECRET). Separater Blast-Radius.
 *   - 32-Hex-Zeichen Signatur (= 128 Bit) ist mehr als ausreichend gegen
 *     Brute-Force.
 *   - Customer-Enumeration-Schutz: 404 bei invaliden Tokens —
 *     `verifyUnsubscribeToken` liefert null, der Endpoint redirect't dann
 *     auf `/marketing/abgemeldet?error=invalid` (kein Hint, ob die
 *     Customer-ID existiert).
 *
 * Architektur-Verweis:
 *   - ARCHITECTURE_IT12.md §R.5
 *   - backend-requirements-iteration-12.md §S15 / Post-QA Revision
 */

import { createHmac } from 'node:crypto';

function getSecret(): string {
  const raw = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  if (!raw || raw.length < 16) {
    // Wir werfen NICHT bei jedem Modul-Load — aber jeder Aufruf von
    // `generateUnsubscribeToken` schlägt fehl, was das eigentliche Senden
    // von Marketing-Mails verhindert. Endpoint `verifyUnsubscribeToken`
    // gibt bei fehlendem Secret immer null zurück (Token kann nicht
    // verifiziert werden — sicherer Default).
    throw new Error(
      'UNSUBSCRIBE_TOKEN_SECRET is not configured (or too short, min 16 chars). ' +
        'Generate via `openssl rand -base64 32`.',
    );
  }
  return raw;
}

function computeHmac(customerId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`unsubscribe:${customerId}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Erzeugt einen Unsubscribe-Token für einen Customer. Idempotent —
 * mehrfache Aufrufe liefern denselben Token (deterministisch).
 *
 * Wirft, wenn `UNSUBSCRIBE_TOKEN_SECRET` nicht konfiguriert ist (Hard-Fail
 * bevor irgendwas an den Customer rausgeht).
 */
export function generateUnsubscribeToken(customerId: string): string {
  const secret = getSecret();
  const sig = computeHmac(customerId, secret);
  return Buffer.from(`${customerId}:${sig}`).toString('base64url');
}

/**
 * Verifiziert einen Unsubscribe-Token. Liefert die `customerId` bei
 * Erfolg, sonst `null`. Wirft niemals — alle Fehlerfälle (Secret fehlt,
 * Token kaputt, Signatur falsch) werden zu null gemappt.
 */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== 'string') return null;
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    // Secret fehlt → wir können den Token nicht verifizieren → Fallback null.
    return null;
  }
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const idx = decoded.indexOf(':');
    if (idx <= 0) return null;
    const customerId = decoded.slice(0, idx);
    const sig = decoded.slice(idx + 1);
    if (!customerId || !sig) return null;
    const expected = computeHmac(customerId, secret);
    // Constant-time comparison — beide Strings sind 32 Hex-Chars.
    if (sig.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) {
      diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0 ? customerId : null;
  } catch {
    return null;
  }
}

/**
 * Baut die Public-URL für den Unsubscribe-Endpoint.
 * Nutzt `NEXT_PUBLIC_BASE_URL` mit Fallback auf `NEXTAUTH_URL` und schließlich
 * auf localhost (Dev).
 */
export function buildUnsubscribeUrl(customerId: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';
  const cleanBase = base.replace(/\/+$/, '');
  const token = generateUnsubscribeToken(customerId);
  return `${cleanBase}/api/customer/unsubscribe?token=${encodeURIComponent(token)}`;
}
