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
  | 'RATE_LIMITED'
  | 'MAIL_FAILED'
  | 'INTERNAL_ERROR';

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
  RATE_LIMITED: 429,
  MAIL_FAILED: 502,
  INTERNAL_ERROR: 500,
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
