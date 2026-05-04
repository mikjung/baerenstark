/**
 * /api/upload/token — IT13 / S05 (Direct-Upload-Refactor).
 *
 * POST: erzeugt einen kurz-lebigen, signierten Vercel-Blob-Client-Token,
 *       legt ein BookingAttachment mit `bookingId=null` und leerem `url`
 *       als Platzhalter an, und liefert (uploadUrl, token, blobPath,
 *       attachmentId, maxBytes) zurück. Der Browser lädt anschließend
 *       die Datei direkt zu Vercel Blob hoch — KEIN Server-Function-
 *       Body-Pfad mehr, das Vercel-Hobby-4.5-MB-Body-Limit ist damit
 *       irrelevant. AC: 10-MB-Bilder + 50-MB-Videos sind sauber möglich.
 *
 * Decision IT13:
 *   - Anonyme Direct-Uploads sind ERLAUBT (Gast-Buchungen brauchen den
 *     Pfad). Schutz: 5-Min-Token-TTL, 10/min/IP-Rate-Limit, MIME- und
 *     Size-Limit im Token eingebrannt, randomisiertes Pfad-Präfix.
 *   - Strukturiertes Pflicht-Logging (`logRequestError`) bei jedem 5xx.
 *   - `runtime = 'nodejs'`, kein Edge.
 *
 * Response 201:
 *   { data: { uploadUrl, token, blobPath, attachmentId, maxBytes } }
 *
 * Errors:
 *   400 VALIDATION_ERROR          (Zod, fehlende Felder)
 *   413 PAYLOAD_TOO_LARGE         (sizeBytes über MIME-Limit)
 *   415 UNSUPPORTED_MEDIA_TYPE    (MIME nicht in Whitelist)
 *   429 RATE_LIMITED              (10/min/IP)
 *   500 INTERNAL_ERROR            (Token-Generation fehlgeschlagen,
 *                                  Prisma-Fehler etc.)
 *   503 BLOB_NOT_CONFIGURED       (BLOB_READ_WRITE_TOKEN fehlt)
 *
 * Frontend-Folge-Schritt: PATCH /api/upload/attachments/[id] (Confirm-
 * Step) trägt die finale Blob-URL nach Direct-Upload nach.
 */

import type { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { uploadLimiter, getClientIp } from '@/lib/ratelimit';
import {
  UPLOAD_ACCEPTED_CONTENT_TYPES,
  getUploadLimitForType,
} from '@/lib/schemas';
import { readCustomerSessionFromRequest } from '@/lib/customer-auth';
import {
  logRequestError,
  newRequestId,
  type RequestAuthState,
} from '@/lib/log-request-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACCEPTED_TYPES: ReadonlySet<string> = new Set(UPLOAD_ACCEPTED_CONTENT_TYPES);

/** 5 Minuten Gültigkeit für den Client-Token (gemäß Backend-Spec §S05). */
const TOKEN_TTL_MS = 5 * 60 * 1000;

const UploadTokenRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
  // 1 .. 50 MB hard upper bound — präzises Limit folgt aus contentType.
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024),
});

/** Sanitize-Dateiname: Whitelist + Umlaut-Transliteration (analog Bestand). */
function transliterateUmlauts(name: string): string {
  return name
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
}

function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'upload';
  const transliterated = transliterateUmlauts(base);
  const cleaned = transliterated.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200);
  return cleaned || 'upload';
}

function randomSuffix(): string {
  // 8 Zeichen Base36 — kollisionssicher genug für Upload-Pfade,
  // crypto-schwach aber nicht sicherheitskritisch (Pfadschutz erfolgt
  // serverseitig durch DB-Lookup auf attachmentId).
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = newRequestId();
  let authState: RequestAuthState = 'anonymous';
  let customerId: string | null = null;

  try {
    // 1. Customer-Session lesen (optional — anonyme Uploads sind erlaubt).
    const session = await readCustomerSessionFromRequest(req);
    if (session?.customerId) {
      authState = 'authenticated';
      customerId = session.customerId;
    }

    // 2. Rate-Limit (10/min/IP — gleicher Pool wie Bestand-/api/upload).
    const ip = getClientIp(req.headers);
    const limit = await uploadLimiter.limit(`upload-token:${ip}`);
    if (!limit.success) {
      const retryAfter = Math.max(0, Math.ceil((limit.reset - Date.now()) / 1000));
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Datei-Uploads. Bitte später erneut versuchen.',
        headers: {
          'Retry-After': String(retryAfter || 60),
          'X-Request-Id': requestId,
        },
      });
    }

    // 3. JSON-Body parsen + Zod-Validate.
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Body muss JSON sein.',
        headers: { 'X-Request-Id': requestId },
      });
    }
    const parsed = UploadTokenRequestSchema.parse(json);

    // 4. MIME-Whitelist + Size-Limit.
    if (!ACCEPTED_TYPES.has(parsed.contentType)) {
      return apiError({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `Dateityp ${parsed.contentType || '(unbekannt)'} wird nicht unterstützt.`,
        field: 'contentType',
        headers: { 'X-Request-Id': requestId },
      });
    }
    const limitBytes = getUploadLimitForType(parsed.contentType);
    if (limitBytes === null) {
      // Defensive Branch — sollte durch Whitelist oben nie greifen.
      return apiError({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `Dateityp ${parsed.contentType} wird nicht unterstützt.`,
        field: 'contentType',
        headers: { 'X-Request-Id': requestId },
      });
    }
    if (parsed.sizeBytes > limitBytes) {
      const limitMb = Math.floor(limitBytes / (1024 * 1024));
      return apiError({
        code: 'PAYLOAD_TOO_LARGE',
        message: `Datei ist zu groß. Limit für diesen Typ: ${limitMb} MB.`,
        field: 'sizeBytes',
        subcode: 'FILE_TOO_LARGE',
        headers: { 'X-Request-Id': requestId },
      });
    }

    // 5. Blob-Token-Verfügbarkeit (Pflicht-ENV-Check).
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return apiError({
        code: 'BLOB_NOT_CONFIGURED',
        message:
          'Datei-Upload ist nicht konfiguriert (BLOB_READ_WRITE_TOKEN fehlt). Bitte den Administrator informieren.',
        status: 503,
        headers: { 'X-Request-Id': requestId },
      });
    }

    // 6. BookingAttachment vorab anlegen (bookingId=null, url=''),
    //    damit der spätere PATCH /api/upload/attachments/[id]-Confirm-Step
    //    eine stabile ID hat und verwaiste Records vom Cleanup-Cron
    //    eingesammelt werden können (ARCHITECTURE §12, IT13-Backlog).
    const safeName = sanitizeFilename(parsed.filename);
    const blobPath = `uploads/${Date.now()}-${randomSuffix()}-${safeName}`;
    const attachment = await prisma.bookingAttachment.create({
      data: {
        bookingId: null,
        url: '',
        filename: parsed.filename,
        contentType: parsed.contentType,
        sizeBytes: parsed.sizeBytes,
      },
    });

    // 7. Vercel-Blob-Client-Token erzeugen — MIME + Size sind in das
    //    Token EINGEBRANNT (kein Bypass möglich), Pfad ist deterministisch
    //    (kein zufälliges Suffix von Vercel-Seite — wir kontrollieren ihn).
    let clientToken: string;
    try {
      clientToken = await generateClientTokenFromReadWriteToken({
        token: blobToken,
        pathname: blobPath,
        allowedContentTypes: [parsed.contentType],
        maximumSizeInBytes: limitBytes,
        validUntil: Date.now() + TOKEN_TTL_MS,
        addRandomSuffix: false,
        // `access: 'public'` ist beim Token-Issuer KEIN Pflicht-Feld — der
        // Browser-`upload()`-Call übergibt es. Wir müssen es hier nicht
        // doppelt setzen.
      });
    } catch (err) {
      // Häufigste Ursache: Token gehört zu einem nicht (mehr) existierenden
      // Blob-Store — also Token-Drift im Vercel-Dashboard.
      logRequestError(
        {
          endpoint: 'POST /api/upload/token',
          requestId,
          authState,
          customerId,
          status: 500,
        },
        err,
      );
      return apiError({
        code: 'INTERNAL_ERROR',
        message:
          'Upload-Token konnte nicht erzeugt werden. Bitte später erneut versuchen.',
        status: 500,
        headers: { 'X-Request-Id': requestId },
      });
    }

    // 8. uploadUrl ist die offizielle Vercel-Blob-Direct-Upload-Endpoint —
    //    der Client-`upload()`-Helper kennt sie auch ohne expliziten Hinweis,
    //    aber wir liefern sie der Vollständigkeit halber mit (Frontend-Spec).
    const uploadUrl = 'https://blob.vercel-storage.com';

    return apiSuccess(
      {
        uploadUrl,
        token: clientToken,
        blobPath,
        attachmentId: attachment.id,
        maxBytes: limitBytes,
      },
      201,
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err, 'POST /api/upload/token', {
      requestId,
      authState,
      customerId,
    });
  }
}
