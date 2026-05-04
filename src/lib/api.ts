/**
 * Helfer für API-Routen — einheitliches Fehler-Format und Status-Codes.
 *
 * Spec-Codes (siehe contracts/api-routes.md):
 *   VALIDATION_ERROR 400
 *   UNAUTHORIZED     401
 *   FORBIDDEN        403
 *   NOT_FOUND        404
 *   CONFLICT         409
 *   OVERLAP          409
 *   RATE_LIMITED     429
 *   MAIL_FAILED      502
 *   INTERNAL_ERROR   500
 *
 * IT10 / STRUCT-3 — Subcode-Support:
 *   `apiError({ code: 'CONFLICT', subcode: 'BOOKING_SLOT_TAKEN', ... })`
 *   rendert `error.subcode` in der Response. Frontend liest primär den
 *   Subcode (siehe contracts/api-routes.md §24.3.1).
 *
 * IT10 / STRUCT-1 — Logging-Härtung:
 *   `internalError(err)` loggt jeden unbekannten Fehler mit Stack-Trace
 *   und (bei Prisma-Errors) `code` + `meta`. HTTP-Antwort bleibt generisch.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import {
  logRequestError,
  newRequestId,
  type RequestAuthState,
} from './log-request-error';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OVERLAP'
  | 'GONE'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'BLOB_NOT_CONFIGURED'
  | 'EMAIL_NOT_VERIFIED'
  | 'OAUTH_ONLY_ACCOUNT'
  | 'OAUTH_ERROR'
  | 'STRIPE_ERROR'
  | 'STRIPE_NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'MAIL_FAILED'
  | 'INTERNAL_ERROR'
  // IT6 / US-IT6-01 — Multi-Admin
  | 'ACCOUNT_DISABLED'
  | 'LAST_ADMIN_LOCK'
  | 'SELF_MUTATION_FORBIDDEN'
  // IT6 / US-IT6-03 — Reviews
  | 'BOOKING_NOT_COMPLETED'
  | 'REVIEW_EXISTS'
  // IT6 / US-IT6-01 + F1 — Bootstrap
  | 'BOOTSTRAP_NOT_ALLOWED'
  | 'SETUP_NOT_CONFIGURED'
  // IT7 / US-IT7-01 + US-IT7-05 — Email-Auth-Reaktivierung
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'INVALID_OR_EXPIRED_TOKEN'
  | 'ALREADY_VERIFIED'
  // IT12 / US-IT12-15 Bug-Fix BUG-003 — Marketing-Send Recipient-Filter
  | 'UNPROCESSABLE_ENTITY';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OVERLAP: 409,
  GONE: 410,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  BLOB_NOT_CONFIGURED: 503,
  EMAIL_NOT_VERIFIED: 422,
  OAUTH_ONLY_ACCOUNT: 422,
  OAUTH_ERROR: 502,
  STRIPE_ERROR: 502,
  STRIPE_NOT_CONFIGURED: 503,
  RATE_LIMITED: 429,
  MAIL_FAILED: 502,
  INTERNAL_ERROR: 500,
  // IT6 codes
  ACCOUNT_DISABLED: 422,
  LAST_ADMIN_LOCK: 409,
  SELF_MUTATION_FORBIDDEN: 409,
  BOOKING_NOT_COMPLETED: 409,
  REVIEW_EXISTS: 409,
  BOOTSTRAP_NOT_ALLOWED: 403,
  SETUP_NOT_CONFIGURED: 503,
  // IT7
  INVALID_CREDENTIALS: 401,
  EMAIL_ALREADY_REGISTERED: 409,
  INVALID_OR_EXPIRED_TOKEN: 410,
  ALREADY_VERIFIED: 409,
  // IT12
  UNPROCESSABLE_ENTITY: 422,
};

export interface ApiErrorOptions {
  code: ApiErrorCode;
  message: string;
  field?: string;
  /**
   * Optionaler semantischer Subcode (seit IT10 / STRUCT-3).
   * Aktuell verwendet: `BOOKING_SLOT_TAKEN` für 409 CONFLICT auf
   * `POST /api/bookings`, wenn der Konflikt aus dem Partial-Unique-Index
   * `uniq_active_booking_per_timeslot` oder dem Serializable-Tx-Overlap-
   * Check stammt. Frontend mapped primär auf den Subcode.
   * Vertrag: contracts/api-routes.md §2 + §24.3.1.
   */
  subcode?: string;
  status?: number;
  headers?: Record<string, string>;
}

export function apiError(opts: ApiErrorOptions): NextResponse {
  const status = opts.status ?? STATUS_BY_CODE[opts.code];
  const body: {
    error: { code: string; message: string; field?: string; subcode?: string };
  } = {
    error: { code: opts.code, message: opts.message },
  };
  if (opts.field) body.error.field = opts.field;
  if (opts.subcode) body.error.subcode = opts.subcode;

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) headers.set(k, v);
  }
  return NextResponse.json(body, { status, headers });
}

export function apiSuccess(data: unknown, status = 200): NextResponse {
  return NextResponse.json(
    { data },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

export function apiNoContent(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Wandelt einen Zod-Fehler in eine 400-Response mit erstem Feldfehler.
 */
export function zodErrorResponse(err: ZodError): NextResponse {
  const first = err.issues[0];
  const field = first?.path?.length ? String(first.path[0]) : undefined;
  return apiError({
    code: 'VALIDATION_ERROR',
    message: first?.message ?? 'Eingaben sind ungültig',
    field,
  });
}

/**
 * Default-Handler für unerwartete Fehler. Loggt den Fehler strukturiert
 * serverseitig, schickt aber generische 500-Response (kein Stack/Code-
 * Leak im Response-Body).
 *
 * IT10 / STRUCT-1 — Logging-Härtung:
 *   - Alle unbekannten Errors loggen mit `[internal_error]`-Marker, plus
 *     Klasse, Message und Stack-Trace.
 *   - Prisma-Known-Request-Errors zusätzlich mit `[prisma_error]`-Marker
 *     und `code` + `meta` (z. B. P2022 Column missing, P2002 Unique-
 *     Constraint, P2025 Record not found, P2028 Tx-Timeout).
 *   - Prisma-Initialization-Errors mit `[prisma_init_error]`-Marker.
 *
 * @param err - der gefangene Fehler.
 * @param context - optionaler Endpoint-Marker (z. B. `'POST /api/bookings'`),
 *   landet als Tag im Log-Eintrag und erleichtert die Vercel-Filterung.
 * @param ctx   - IT13: optionale Logging-Erweiterung. Wenn gesetzt, wird der
 *                strukturierte `logRequestError`-Eintrag mit `requestId`,
 *                `authState` und `customerId` geschrieben, und die Antwort
 *                bekommt einen `X-Request-Id`-Header. Falls `ctx.requestId`
 *                fehlt, wird ein frischer UUID erzeugt — sodass jede 5xx-
 *                Antwort die Header-Korrelation hat.
 */
export function internalError(
  err: unknown,
  context?: string,
  ctx?: {
    requestId?: string;
    authState?: RequestAuthState;
    customerId?: string | null;
  },
): NextResponse {
  const tag = context ? ` ${context}` : '';
  const errAny = err as
    | { name?: string; message?: string; stack?: string; code?: string; meta?: unknown }
    | null
    | undefined;
  const name = errAny?.name ?? typeof err;
  const message = errAny?.message ?? String(err);
  const stack = errAny?.stack ?? '';

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // eslint-disable-next-line no-console
    console.error(
      `[prisma_error]${tag} code=${err.code} name=${err.name} message=${message}`,
      { meta: err.meta, stack },
    );
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    // eslint-disable-next-line no-console
    console.error(
      `[prisma_init_error]${tag} name=${err.name} message=${message}`,
      { stack },
    );
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    // eslint-disable-next-line no-console
    console.error(
      `[prisma_error]${tag} kind=validation name=${err.name} message=${message}`,
      { stack },
    );
  } else {
    // eslint-disable-next-line no-console
    console.error(
      `[internal_error]${tag} name=${name} message=${message}`,
      { stack },
    );
  }

  // IT13 / S05+S06 — Strukturiertes Pflicht-Logging.
  // Jede 5xx-Antwort bekommt einen frischen oder vorher reservierten
  // `requestId` und einen entsprechenden `X-Request-Id`-Header. Der
  // strukturierte Log-Eintrag ergänzt den oben geschriebenen klassischen
  // `[internal_error]`/`[prisma_error]`-Eintrag und liefert dem Operator
  // ein deterministisches Grep-Format.
  const requestId = ctx?.requestId ?? newRequestId();
  logRequestError(
    {
      endpoint: context ?? 'unknown',
      requestId,
      authState: ctx?.authState ?? 'anonymous',
      customerId: ctx?.customerId ?? null,
      status: 500,
    },
    err,
  );

  // TEMP IT13 diagnostic: echo error class + message + Prisma code via
  // header so the operator can pinpoint the throw without Vercel-Log access.
  // Header is safe (no stack, no PII), gated by env flag for opt-out.
  const diagHeaders: Record<string, string> = { 'X-Request-Id': requestId };
  if (process.env.IT13_ECHO_ERROR !== '0') {
    const code = (err as { code?: string } | null)?.code;
    const safeName = String(name).slice(0, 64);
    const safeMessage = String(message).slice(0, 240).replace(/[\r\n\t]+/g, ' ');
    diagHeaders['X-Diag-Error'] = `${safeName}${code ? `:${code}` : ''} | ${safeMessage}`;
  }

  return apiError({
    code: 'INTERNAL_ERROR',
    message: 'Interner Serverfehler. Bitte später erneut versuchen.',
    headers: diagHeaders,
  });
}
