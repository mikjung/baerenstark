/**
 * Booking-Tokens — signierte JWTs für Bestätigungs- und Storno-Links
 * (Iteration 11 / US-IT11-03 + US-IT11-06).
 *
 * Signing/Verify via `jose` (HS256), Secret aus ENV `BOOKING_TOKEN_SECRET`.
 * Default-Gültigkeit: 30 Tage. Scopes:
 *   - `booking-confirmation`  — Bestätigungslink in der Eingangs-Mail.
 *   - `booking-cancellation`  — Storno-Link in der Eingangs-Mail.
 *
 * Read-Endpoints (`GET /api/bookings/:id/public-summary`) akzeptieren
 * BEIDE Scopes (read-only-äquivalent). Schreibender Cancel
 * (`POST /api/bookings/:id/cancel`) akzeptiert NUR `booking-cancellation`.
 *
 * Sicherheit:
 *   - `BOOKING_TOKEN_SECRET` ist eine eigene ENV-Variable, NIEMALS reusen
 *     mit AUTH_SECRET (separater Blast-Radius).
 *   - Token-Werte werden niemals geloggt.
 */

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BookingTokenScope =
  | 'booking-confirmation'
  | 'booking-cancellation';

export interface SignBookingTokenInput {
  bookingId: string;
  customerId: string | null;
  /** Optional override für die Gültigkeit (Default: 30 Tage). */
  expiresInSeconds?: number;
}

export interface BookingTokenPayload {
  /** sub = bookingId */
  sub: string;
  /** cid = customerId, null bei Gast-Buchungen */
  cid: string | null;
  scope: BookingTokenScope;
  iat: number;
  exp: number;
}

export type VerifyResult =
  | { ok: true; payload: BookingTokenPayload }
  | { ok: false; reason: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' };

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** 30 Tage Default-Gültigkeit. */
export const BOOKING_TOKEN_DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

const ALG = 'HS256';

// ---------------------------------------------------------------------------
// Secret-Loader
// ---------------------------------------------------------------------------

let cachedSecret: Uint8Array | null = null;

/**
 * Lädt das Booking-Token-Secret aus `BOOKING_TOKEN_SECRET`. Wirft eine
 * klare Fehlermeldung, wenn die ENV-Variable fehlt oder zu kurz ist.
 *
 * Hard-Fail-Semantik: in Prod fehlt das Secret nie, weil der Boot-Check
 * (Module-Load) das prüft. In Tests wird ein Default-Secret gesetzt.
 */
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.BOOKING_TOKEN_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error(
      'BOOKING_TOKEN_SECRET is not configured (or too short). ' +
        'Set a 32+ character random value in env (openssl rand -base64 48).',
    );
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

/**
 * Test-Hook: Cache zurücksetzen, damit Tests neue Secrets injizieren können.
 * Nicht für Produktiv-Code.
 */
export function _resetBookingTokenSecretCache(): void {
  cachedSecret = null;
}

// ---------------------------------------------------------------------------
// Internal sign/verify helper
// ---------------------------------------------------------------------------

async function signWithScope(
  input: SignBookingTokenInput,
  scope: BookingTokenScope,
): Promise<string> {
  const ttl = input.expiresInSeconds ?? BOOKING_TOKEN_DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;

  const jwt = await new SignJWT({
    cid: input.customerId,
    scope,
  })
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .setSubject(input.bookingId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getSecret());

  return jwt;
}

async function verifyWithAcceptedScopes(
  token: string,
  acceptedScopes: ReadonlyArray<BookingTokenScope>,
): Promise<VerifyResult> {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'TOKEN_INVALID' };
  }
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });

    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    const cid =
      typeof payload.cid === 'string' || payload.cid === null
        ? (payload.cid as string | null)
        : null;
    const scope =
      typeof (payload as Record<string, unknown>).scope === 'string'
        ? ((payload as Record<string, unknown>).scope as string)
        : null;

    if (!sub) return { ok: false, reason: 'TOKEN_INVALID' };
    if (!scope || !acceptedScopes.includes(scope as BookingTokenScope)) {
      return { ok: false, reason: 'TOKEN_INVALID' };
    }

    const iat = typeof payload.iat === 'number' ? payload.iat : 0;
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;

    return {
      ok: true,
      payload: {
        sub,
        cid,
        scope: scope as BookingTokenScope,
        iat,
        exp,
      },
    };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return { ok: false, reason: 'TOKEN_EXPIRED' };
    }
    return { ok: false, reason: 'TOKEN_INVALID' };
  }
}

// ---------------------------------------------------------------------------
// Public API — Confirmation
// ---------------------------------------------------------------------------

/** Signiert einen `booking-confirmation`-Token. */
export async function signBookingConfirmationToken(
  input: SignBookingTokenInput,
): Promise<string> {
  return signWithScope(input, 'booking-confirmation');
}

/**
 * Verifiziert einen `booking-confirmation`-Token (strict scope). Wird vom
 * Frontend `/buchung/bestaetigung/[id]` Server-Component genutzt.
 */
export async function verifyBookingConfirmationToken(
  token: string,
): Promise<VerifyResult> {
  return verifyWithAcceptedScopes(token, ['booking-confirmation']);
}

// ---------------------------------------------------------------------------
// Public API — Cancellation
// ---------------------------------------------------------------------------

/** Signiert einen `booking-cancellation`-Token. */
export async function signBookingCancellationToken(
  input: SignBookingTokenInput,
): Promise<string> {
  return signWithScope(input, 'booking-cancellation');
}

/**
 * Verifiziert einen `booking-cancellation`-Token (strict scope). Wird vom
 * `POST /api/bookings/[id]/cancel`-Endpoint genutzt.
 */
export async function verifyBookingCancellationToken(
  token: string,
): Promise<VerifyResult> {
  return verifyWithAcceptedScopes(token, ['booking-cancellation']);
}

// ---------------------------------------------------------------------------
// Public API — Public-Summary (akzeptiert beide Scopes)
// ---------------------------------------------------------------------------

/**
 * Verifiziert einen Token und akzeptiert SOWOHL `booking-confirmation` als
 * AUCH `booking-cancellation`. Read-only-Äquivalenz für den
 * `GET /api/bookings/:id/public-summary`-Endpoint.
 */
export async function verifyBookingReadToken(
  token: string,
): Promise<VerifyResult> {
  return verifyWithAcceptedScopes(token, [
    'booking-confirmation',
    'booking-cancellation',
  ]);
}
