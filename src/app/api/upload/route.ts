/**
 * /api/upload — US-18 (Iteration 3).
 *
 * POST (public, rate-limited) — Datei in Vercel Blob hochladen.
 *
 * Verhalten:
 *   1. Rate-Limit (10/min/IP).
 *   2. multipart/form-data parsen, `file` extrahieren.
 *   3. Größe (max 20 MB) und MIME-Type validieren.
 *   4. Vercel Blob `put()` aufrufen.
 *   5. BookingAttachment mit bookingId=null anlegen.
 *   6. 201 mit attachmentId + url.
 *
 * Falls BLOB_READ_WRITE_TOKEN nicht gesetzt: 502 mit klarem Hint.
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
  UPLOAD_MAX_FILE_BYTES,
  UPLOAD_ACCEPTED_CONTENT_TYPES,
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

    // 3. Validierung
    if (f.size > UPLOAD_MAX_FILE_BYTES) {
      return apiError({
        code: 'PAYLOAD_TOO_LARGE',
        message: `Datei ist zu groß (max. ${Math.floor(
          UPLOAD_MAX_FILE_BYTES / (1024 * 1024),
        )} MB).`,
        field: 'file',
      });
    }
    if (f.size === 0) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Datei ist leer.',
        field: 'file',
      });
    }
    if (!ACCEPTED_TYPES.has(f.type)) {
      return apiError({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `Dateityp ${f.type || '(unbekannt)'} wird nicht unterstützt.`,
        field: 'file',
      });
    }

    // 4. Blob-Token-Check
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return apiError({
        code: 'INTERNAL_ERROR',
        message:
          'Datei-Upload ist nicht konfiguriert (BLOB_READ_WRITE_TOKEN fehlt). Bitte den Administrator informieren.',
        status: 502,
      });
    }

    // 5. Vercel Blob put()
    const safeName = sanitizeFilename(f.name);
    const blobPath = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;

    let blob: { url: string };
    try {
      blob = await put(blobPath, f, {
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
