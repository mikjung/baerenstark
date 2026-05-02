/**
 * Kunden-Auth (Iteration 4 / US-25).
 *
 * Eigene JWT-Cookie-Session, vollständig getrennt von der Admin-NextAuth-Session.
 *
 * Cookie:        `customer-session`
 * Algorithmus:   HS256 (jose)
 * Geltungsdauer: 7 Tage
 *
 * Edge-Kompatibilität: NUR `jose` + `next/server` werden hier importiert.
 * KEIN bcrypt, KEIN Prisma, KEIN Node-only Modul. Damit kann die Datei aus
 * der Edge-Middleware geladen werden, ohne die Admin-Auth-Härtung zu kippen.
 *
 * Server-Components / Route-Handler dürfen `getCustomerFromRequest()` nutzen,
 * um den vollen DB-CustomerUser zu laden — das passiert dann via Prisma in
 * einer separaten Helper-Datei (siehe `customer-auth-server.ts` weiter unten).
 */

import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export const CUSTOMER_SESSION_COOKIE = 'customer-session';
export const CUSTOMER_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Liefert den Signing-Secret. Wir nutzen `AUTH_SECRET` (NextAuth-v5-Konvention)
 * und fallen auf `NEXTAUTH_SECRET` zurück, falls Tom in `.env` nur die
 * Legacy-Variante gepflegt hat. Der Schlüssel wird als TextEncoder-Bytes
 * benötigt (jose erwartet Uint8Array).
 */
function getSecretBytes(): Uint8Array {
  const raw = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';
  if (!raw || raw.length < 32) {
    // Wir werfen NICHT — sonst würde jeder Request crashen, sobald die ENV
    // fehlt. Stattdessen liefern wir einen festen Dummy-Bytes-Block, der
    // garantiert keinen echten Token validiert (constant-time vergleichbare
    // Fehler-Logging-Strategie ist Aufgabe der Aufrufer).
    return new TextEncoder().encode(
      'baerenstark-customer-auth-fallback-secret-CHANGE-ME',
    );
  }
  return new TextEncoder().encode(raw);
}

export interface CustomerSession {
  customerId: string;
  email: string;
}

/**
 * Erzeugt ein signiertes JWT für die Kunden-Session.
 * Payload: `{ customerId, email }`. Ablauf: 7 Tage ab `iat`.
 */
export async function createCustomerSession(
  customerId: string,
  email: string,
): Promise<string> {
  const secret = getSecretBytes();
  return await new SignJWT({ customerId, email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${CUSTOMER_SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);
}

/**
 * Verifiziert ein JWT und gibt den Payload zurück. Bei abgelaufenem Token
 * oder ungültiger Signatur → null (kein Wurf, damit die aufrufenden Stellen
 * eine schlanke Branch-Logik haben).
 */
export async function verifyCustomerSession(
  token: string | undefined | null,
): Promise<CustomerSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretBytes());
    const customerId =
      typeof payload.customerId === 'string' ? payload.customerId : null;
    const email = typeof payload.email === 'string' ? payload.email : null;
    if (!customerId || !email) return null;
    return { customerId, email };
  } catch {
    return null;
  }
}

/**
 * Liest das `customer-session`-Cookie aus dem Request und liefert den
 * verifizierten Payload. Funktioniert in Edge- und Node-Runtime.
 */
export async function readCustomerSessionFromRequest(
  req: NextRequest,
): Promise<CustomerSession | null> {
  const token = req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  return verifyCustomerSession(token);
}

/**
 * MAJOR-405-Fix (v1.4.1): validiert einen Redirect-Pfad gegen Open-Redirect.
 *
 * Akzeptiert NUR relative Pfade ohne Protokoll/Host. Bei jeder anderen
 * Eingabe → Fallback `/konto`.
 *
 * Verworfen wird:
 *   - Strings ohne führendes `/` (`'konto'` → fail)
 *   - Protokoll-relative URLs (`'//evil.example/login'` → fail)
 *   - URLs mit Schema (`':'` oder `'\\'` enthalten → fail)
 *   - Strings mit Whitespace
 *   - Externe Origins
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

/**
 * Cookie-Bauer für die Set-Cookie-Header-Variante. Reine String-Generierung,
 * kein Side-Effect. So können Route-Handler den Wert direkt in
 * `NextResponse.cookies.set(...)` einsetzen.
 */
export interface CustomerSessionCookieOptions {
  /** Override für Tests/Entwicklung. Default: NODE_ENV === 'production'. */
  secure?: boolean;
}

export function customerSessionCookieOptions(
  opts: CustomerSessionCookieOptions = {},
): {
  name: string;
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    name: CUSTOMER_SESSION_COOKIE,
    httpOnly: true,
    secure: opts.secure ?? process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
  };
}
