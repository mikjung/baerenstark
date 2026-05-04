/**
 * IT13 — Strukturiertes Pflicht-Logging für 5xx-Pfade in
 * `/api/upload/*` und `/api/bookings`.
 *
 * Vertrag: backend-requirements-iteration-13.md §Cross-Cutting.
 *
 * Verhalten:
 *   - Schreibt einen einzeiligen `console.error`-Eintrag mit
 *     stabilen Schlüssel=Wert-Feldern für Vercel-Log-Grep.
 *   - Reichert mit Prisma-Codes (P10xx/P20xx/P21xx), Resend-Codes
 *     und @vercel/blob-Fehlerklassen an, soweit aus dem Error-Objekt
 *     extrahierbar.
 *   - Liefert einen frischen UUID v4 pro Request via `newRequestId()`,
 *     der als `X-Request-Id`-Header an den Client zurückgeht.
 *
 * Bewusst KEIN externer Logging-Provider — Vercel-Log-Stream reicht
 * für die Produktions-Diagnose, und ein Plug-in (z. B. Logflare,
 * Better-Stack) würde Iterations-Scope sprengen.
 */

import { Prisma } from '@prisma/client';

export type RequestAuthState = 'anonymous' | 'authenticated' | 'admin';

export interface RequestErrorContext {
  /** z.B. 'POST /api/bookings' oder 'POST /api/upload/token'. */
  endpoint: string;
  /** UUID v4 — pro Request einmal erzeugt, im X-Request-Id-Header gespiegelt. */
  requestId: string;
  /** Auth-Klasse zum Zeitpunkt des Fehlers. */
  authState: RequestAuthState;
  /** Customer-ID falls aus Session bekannt — sonst null. */
  customerId?: string | null;
  /** HTTP-Status der Antwort (in der Regel 500/502/503). */
  status: number;
}

export interface ExtractedErrorFields {
  errorClass: string;
  errorMessage: string;
  prismaCode?: string;
  prismaMeta?: unknown;
  resendCode?: string;
  resendStatusCode?: number;
  blobErrorName?: string;
  blobStatusCode?: number;
}

interface ErrorShape {
  name?: string;
  code?: string;
  status?: number;
  statusCode?: number;
  message?: string;
  meta?: unknown;
  // Resend-SDK-Fehlerformat:
  // { name: 'validation_error', message: '...', statusCode: 422 }
  // — `code` und `statusCode` sind die Felder, die wir ggf. lesen.
  error?: { code?: string; statusCode?: number; message?: string };
}

function extractErrorFields(err: unknown): ExtractedErrorFields {
  const e = (err ?? {}) as ErrorShape;
  const errorClass =
    err && typeof err === 'object' && err.constructor
      ? (err.constructor as { name?: string }).name ?? 'UnknownError'
      : typeof err;
  const errorMessage =
    typeof e.message === 'string' && e.message.length > 0
      ? e.message
      : String(err);

  const out: ExtractedErrorFields = { errorClass, errorMessage };

  // Prisma-Felder
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    out.prismaCode = err.code;
    out.prismaMeta = err.meta;
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    // P1001 / P1017 etc. tauchen hier nicht als `code` auf, sondern als
    // Substring der Message — wir setzen einen Marker, damit der Operator
    // die Klasse auf einen Blick sieht.
    out.prismaCode = 'P1xxx';
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    out.prismaCode = 'PRISMA_VALIDATION';
  }

  // @vercel/blob — Fehler-Klassen heißen `BlobAccessError`,
  // `BlobUnknownError`, `BlobNotFoundError`, etc. — wir spiegeln Name+Status.
  if (
    typeof e.name === 'string' &&
    (e.name.startsWith('Blob') || /blob/i.test(e.name))
  ) {
    out.blobErrorName = e.name;
    if (typeof e.status === 'number') out.blobStatusCode = e.status;
    else if (typeof e.statusCode === 'number') out.blobStatusCode = e.statusCode;
  }

  // Resend-SDK — werfen i.d.R. `{ statusCode, name, message }`.
  // Wir picken `name` als `resendCode` (z.B. 'validation_error',
  // 'rate_limit_exceeded', 'missing_api_key').
  if (
    typeof e.name === 'string' &&
    /^[a-z][a-z_]+$/.test(e.name) &&
    typeof e.statusCode === 'number'
  ) {
    out.resendCode = e.name;
    out.resendStatusCode = e.statusCode;
  } else if (e.error && typeof e.error.code === 'string') {
    out.resendCode = e.error.code;
    if (typeof e.error.statusCode === 'number') {
      out.resendStatusCode = e.error.statusCode;
    }
  }

  return out;
}

/**
 * Schreibt einen strukturierten Log-Eintrag für einen Server-Fehler.
 * Single-line-Format für Vercel-Log-Grep + Strukturierte Suche, plus
 * der raw-Error als zweites Argument für den Stack-Trace im Log-Stream.
 */
export function logRequestError(
  ctx: RequestErrorContext,
  err: unknown,
): void {
  const fields = extractErrorFields(err);
  const parts: string[] = [
    `[${ctx.endpoint}]`,
    `requestId=${ctx.requestId}`,
    `status=${ctx.status}`,
    `auth=${ctx.authState}`,
    `customerId=${ctx.customerId ?? '-'}`,
    `errorClass=${fields.errorClass}`,
  ];
  if (fields.prismaCode) parts.push(`prismaCode=${fields.prismaCode}`);
  if (fields.prismaMeta !== undefined) {
    try {
      parts.push(`prismaMeta=${JSON.stringify(fields.prismaMeta)}`);
    } catch {
      parts.push(`prismaMeta=[unserializable]`);
    }
  }
  if (fields.resendCode) parts.push(`resendCode=${fields.resendCode}`);
  if (fields.resendStatusCode !== undefined) {
    parts.push(`resendStatus=${fields.resendStatusCode}`);
  }
  if (fields.blobErrorName) parts.push(`blobError=${fields.blobErrorName}`);
  if (fields.blobStatusCode !== undefined) {
    parts.push(`blobStatus=${fields.blobStatusCode}`);
  }
  parts.push(`message=${JSON.stringify(fields.errorMessage)}`);

  // eslint-disable-next-line no-console
  console.error(parts.join(' '), err);
}

/**
 * UUID v4 pro Request. Verwendet die globale `crypto.randomUUID()`
 * (Node 19+ und Vercel-Edge/Node-Runtimes haben das).
 */
export function newRequestId(): string {
  // `crypto.randomUUID` ist in Node 19+ und Vercel Runtime nativ verfügbar.
  // Ein Fallback braucht es hier nicht — wir laufen mit `runtime = 'nodejs'`.
  return crypto.randomUUID();
}

// Re-Export für Tests/Helpers.
export { extractErrorFields };
