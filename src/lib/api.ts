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
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

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
  | 'ALREADY_VERIFIED';

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
};

export interface ApiErrorOptions {
  code: ApiErrorCode;
  message: string;
  field?: string;
  status?: number;
  headers?: Record<string, string>;
}

export function apiError(opts: ApiErrorOptions): NextResponse {
  const status = opts.status ?? STATUS_BY_CODE[opts.code];
  const body: { error: { code: string; message: string; field?: string } } = {
    error: { code: opts.code, message: opts.message },
  };
  if (opts.field) body.error.field = opts.field;

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
 * Default-Handler für unerwartete Fehler. Loggt den Fehler serverseitig,
 * schickt aber generische 500-Response.
 */
export function internalError(err: unknown): NextResponse {
  // eslint-disable-next-line no-console
  console.error('[api] internal error:', err);
  return apiError({
    code: 'INTERNAL_ERROR',
    message: 'Interner Serverfehler. Bitte später erneut versuchen.',
  });
}
