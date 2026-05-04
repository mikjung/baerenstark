/**
 * /api/upload — US-18 (Iteration 3) + IT11 / US-IT11-04 (Hardening).
 *
 * POST (public, rate-limited) — Datei in Vercel Blob hochladen.
 *
 * Verhalten:
 *   1. Rate-Limit (10/min/IP).
 *   2. multipart/form-data parsen, `file` extrahieren.
 *   3. Validierung:
 *        - 0-Byte → 400 FILE_EMPTY (IT11).
 *        - Akzeptierter MIME → Whitelist-Check (sonst 415).
 *        - Split-by-MIME-Limit (IT11): image/* 10 MB, video/* 50 MB,
 *          application/pdf 10 MB. Bei Überschreitung 413 FILE_TOO_LARGE.
 *        - Magic-Bytes-Check (IT11): erste ~4100 Bytes via `file-type`
 *          gegen den deklarierten MIME prüfen. Bei Mismatch 400
 *          FILE_TYPE_MISMATCH. Defensiv: wenn `file-type` nicht
 *          installiert ist, Schutz wird übersprungen mit Vercel-Log.
 *   4. Vercel Blob `put()`.
 *   5. BookingAttachment mit bookingId=null anlegen.
 *   6. 201 mit attachmentId + url.
 *
 * Falls BLOB_READ_WRITE_TOKEN nicht gesetzt: 503 BLOB_NOT_CONFIGURED.
 */

import type { NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import {
  apiError,
  apiSuccess,
  internalError,
} from '@/lib/api';
import { uploadLimiter, getClientIp } from '@/lib/ratelimit';
import {
  UPLOAD_ACCEPTED_CONTENT_TYPES,
  UPLOAD_MAX_IMAGE_BYTES,
  UPLOAD_MAX_VIDEO_BYTES,
  UPLOAD_MAX_DOCUMENT_BYTES,
  getUploadLimitForType,
} from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACCEPTED_TYPES: ReadonlySet<string> = new Set(UPLOAD_ACCEPTED_CONTENT_TYPES);

/**
 * Sanitize-Dateiname: erlaubte Zeichen [A-Za-z0-9._-], ungültige werden zu `_`.
 * Verhindert Pfad-Traversal und ungültige Blob-Pfade.
 */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'upload';
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200);
  return cleaned || 'upload';
}

/**
 * Magic-Bytes-Check via `file-type` (ESM-only, deshalb dynamic-import).
 * Liefert `{ ok: true, mime }` oder `{ ok: false, reason }`. Wenn das
 * Package nicht installiert ist, wird die Prüfung übersprungen
 * (`{ ok: 'skipped' }`).
 */
async function detectFileMime(
  bytes: Uint8Array,
): Promise<
  | { ok: true; mime: string }
  | { ok: false; reason: 'NO_DETECTION' }
  | { ok: 'skipped' }
> {
  try {
    // Dynamic import damit der Build nicht hart bricht, wenn `file-type`
    // (noch) nicht installiert ist.
    const mod = (await import('file-type').catch(() => null)) as
      | { fileTypeFromBuffer?: (b: Uint8Array) => Promise<{ mime?: string } | undefined> }
      | null;
    if (!mod || typeof mod.fileTypeFromBuffer !== 'function') {
      // eslint-disable-next-line no-console
      console.warn(
        '[upload] file-type missing — MIME-spoofing-Schutz disabled.',
      );
      return { ok: 'skipped' };
    }
    const detected = await mod.fileTypeFromBuffer(bytes);
    if (!detected || !detected.mime) {
      return { ok: false, reason: 'NO_DETECTION' };
    }
    return { ok: true, mime: detected.mime };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[upload] file-type detection threw:', err);
    return { ok: 'skipped' };
  }
}

/**
 * Aliase für Magic-Bytes-MIME, die Browser-MIMEs anders rendern.
 * Beispiel: `video/quicktime` (Browser) ↔ `video/quicktime` (file-type).
 * Stand jetzt 1:1 — Helper bleibt für künftige Erweiterungen.
 */
function mimeAliasMatch(declared: string, detected: string): boolean {
  const d = declared.toLowerCase();
  const x = detected.toLowerCase();
  if (d === x) return true;
  // image/jpg ↔ image/jpeg
  if ((d === 'image/jpg' && x === 'image/jpeg') || (d === 'image/jpeg' && x === 'image/jpg')) {
    return true;
  }
  return false;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // 1. Rate-Limit
    const ip = getClientIp(req.headers);
    const limit = await uploadLimiter.limit(`upload:${ip}`);
    if (!limit.success) {
      const retryAfter = Math.max(0, Math.ceil((limit.reset - Date.now()) / 1000));
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Datei-Uploads. Bitte später erneut versuchen.',
        headers: { 'Retry-After': String(retryAfter || 60) },
      });
    }

    // 2. multipart parsen
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Body muss multipart/form-data sein.',
      });
    }

    const file = formData.get('file');
    if (!(file instanceof Blob) || typeof (file as File).name !== 'string') {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Datei-Feld "file" fehlt.',
        field: 'file',
      });
    }
    const f = file as File;

    // 3a. 0-Byte-Check (IT11 / BUG-MAJOR-05).
    if (f.size === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Die hochgeladene Datei ist leer.',
        subcode: 'FILE_EMPTY',
        field: 'file',
      });
    }

    // 3b. Whitelist-Check (Browser-MIME).
    if (!ACCEPTED_TYPES.has(f.type)) {
      return apiError({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `Dateityp ${f.type || '(unbekannt)'} wird nicht unterstützt.`,
        field: 'file',
      });
    }

    // 3c. Split-by-MIME-Limit (IT11 / US-IT11-04).
    const limitBytes = getUploadLimitForType(f.type);
    if (limitBytes === null) {
      // Sollte durch Whitelist-Check oben nie passieren — defensive Branch.
      return apiError({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `Dateityp ${f.type} wird nicht unterstützt.`,
        field: 'file',
      });
    }
    if (f.size > limitBytes) {
      const limitMb = Math.floor(limitBytes / (1024 * 1024));
      return apiError({
        code: 'PAYLOAD_TOO_LARGE',
        message: `Datei ist zu groß (Bilder & PDFs: max. ${Math.floor(UPLOAD_MAX_IMAGE_BYTES / (1024 * 1024))} MB, Videos: max. ${Math.floor(UPLOAD_MAX_VIDEO_BYTES / (1024 * 1024))} MB). Limit für diesen Typ: ${limitMb} MB.`,
        subcode: 'FILE_TOO_LARGE',
        field: 'file',
      });
    }

    // 3d. Magic-Bytes-Check (IT11 / BUG-MAJOR-05).
    // Erste 4100 Bytes lesen reicht laut file-type-Doku.
    let fileBytes: Uint8Array | null = null;
    try {
      const arrayBuffer = await f.arrayBuffer();
      fileBytes = new Uint8Array(arrayBuffer);
    } catch (err) {
      console.warn('[upload] arrayBuffer read failed:', err);
    }

    if (fileBytes) {
      const head = fileBytes.subarray(0, Math.min(4100, fileBytes.byteLength));
      const detection = await detectFileMime(head);
      if (detection.ok === false) {
        return apiError({
          code: 'VALIDATION_ERROR',
          message: 'Datei-Inhalt passt nicht zum angegebenen Typ.',
          subcode: 'FILE_TYPE_MISMATCH',
          field: 'file',
        });
      }
      if (detection.ok === true) {
        // PDFs sind bei manchen Browsern als `application/octet-stream`
        // deklariert — wir matchen über `application/pdf` und akzeptieren
        // detection.mime === 'application/pdf' wenn deklariert pdf war.
        if (!mimeAliasMatch(f.type, detection.mime)) {
          return apiError({
            code: 'VALIDATION_ERROR',
            message: 'Datei-Inhalt passt nicht zum angegebenen Typ.',
            subcode: 'FILE_TYPE_MISMATCH',
            field: 'file',
          });
        }
      }
      // 'skipped' → Schutz disabled, Logging schon erfolgt.
    }

    // Fallback Limit-Konstante referenzieren um „unused"-Lint zu beruhigen.
    void UPLOAD_MAX_DOCUMENT_BYTES;

    // 4. Blob-Token-Check
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return apiError({
        code: 'BLOB_NOT_CONFIGURED',
        message:
          'Datei-Upload ist nicht konfiguriert (BLOB_READ_WRITE_TOKEN fehlt). Bitte den Administrator informieren.',
        status: 503,
      });
    }

    // 5. Vercel Blob put()
    const safeName = sanitizeFilename(f.name);
    const blobPath = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;

    let blob: { url: string };
    try {
      // Wenn wir oben den Buffer schon gelesen haben, reuse — sonst Blob direkt.
      const body: Blob | Uint8Array = fileBytes ?? f;
      blob = await put(blobPath, body, {
        access: 'public',
        token: blobToken,
        contentType: f.type,
      });
    } catch (err) {
      console.error('[upload] vercel blob put failed:', err);
      return apiError({
        code: 'INTERNAL_ERROR',
        message: 'Upload zum Speicher fehlgeschlagen. Bitte später erneut versuchen.',
        status: 502,
      });
    }

    // 6. BookingAttachment anlegen (bookingId=null, wird beim Booking verknüpft).
    const attachment = await prisma.bookingAttachment.create({
      data: {
        bookingId: null,
        url: blob.url,
        filename: f.name,
        contentType: f.type,
        sizeBytes: f.size,
      },
    });

    return apiSuccess(
      {
        attachmentId: attachment.id,
        url: attachment.url,
        filename: attachment.filename,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
      },
      201,
    );
  } catch (err) {
    return internalError(err);
  }
}
