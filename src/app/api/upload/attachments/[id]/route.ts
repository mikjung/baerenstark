/**
 * /api/upload/attachments/[id] — IT13 / S05 (Direct-Upload-Confirm-Step).
 *
 * PATCH: nach erfolgreichem Browser-Direct-Upload zu Vercel Blob trägt
 *        der Client die finale Blob-URL nach. Server validiert, dass
 *           - das BookingAttachment existiert,
 *           - es noch nicht mit einem Booking verknüpft ist (`bookingId === null`),
 *           - die `url` zu einer plausiblen Vercel-Blob-Domain gehört,
 *           - der bisherige `url`-Wert leer ist (idempotenter Re-Submit erlaubt,
 *             solange dieselbe URL übermittelt wird).
 *
 * Decision IT13:
 *   - Anonymer Zugriff erlaubt (Gast-Buchungen) — Schutz ergibt sich
 *     aus der Zufälligkeit der `attachmentId` + Confirm-Step-Window
 *     (typischerweise wenige Sekunden zwischen Token-Issue und Confirm).
 *   - `runtime = 'nodejs'`.
 *   - Pflicht-Logging via `logRequestError` bei 5xx.
 *
 * Response 200:
 *   { data: { attachmentId, url, filename, contentType, sizeBytes } }
 *
 * Errors:
 *   400 VALIDATION_ERROR  (url-Format/Domain ungültig oder fehlt)
 *   404 NOT_FOUND         (attachmentId existiert nicht)
 *   409 CONFLICT          (already linked — bookingId !== null)
 *   409 CONFLICT          (url bereits gesetzt und unterscheidet sich)
 *   500 INTERNAL_ERROR    (DB-Fehler)
 */

import type { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { readCustomerSessionFromRequest } from '@/lib/customer-auth';
import {
  newRequestId,
  type RequestAuthState,
} from '@/lib/log-request-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PatchSchema = z.object({
  url: z.string().url().max(2048),
});

/**
 * Akzeptierte Vercel-Blob-Domains. Default: `*.public.blob.vercel-storage.com`.
 * Wir lassen auch die generische `blob.vercel-storage.com`-Variante zu, falls
 * der Vercel-Plan/Store einen anderen Subdomain-Stil verwendet.
 */
function isAcceptedBlobUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return (
      host.endsWith('.public.blob.vercel-storage.com') ||
      host === 'blob.vercel-storage.com' ||
      host.endsWith('.blob.vercel-storage.com')
    );
  } catch {
    return false;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const requestId = newRequestId();
  let authState: RequestAuthState = 'anonymous';
  let customerId: string | null = null;

  try {
    const session = await readCustomerSessionFromRequest(req);
    if (session?.customerId) {
      authState = 'authenticated';
      customerId = session.customerId;
    }

    const attachmentId = params?.id;
    if (!attachmentId || typeof attachmentId !== 'string') {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Anhang-ID fehlt.',
        field: 'id',
        headers: { 'X-Request-Id': requestId },
      });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Body muss JSON sein.',
        headers: { 'X-Request-Id': requestId },
      });
    }
    const parsed = PatchSchema.parse(json);

    if (!isAcceptedBlobUrl(parsed.url)) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'URL gehört nicht zu einer gültigen Vercel-Blob-Domain.',
        field: 'url',
        headers: { 'X-Request-Id': requestId },
      });
    }

    const existing = await prisma.bookingAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!existing) {
      return apiError({
        code: 'NOT_FOUND',
        message: 'Anhang nicht gefunden.',
        field: 'id',
        headers: { 'X-Request-Id': requestId },
      });
    }
    if (existing.bookingId !== null) {
      return apiError({
        code: 'CONFLICT',
        message: 'Anhang ist bereits einer Buchung zugeordnet.',
        field: 'id',
        headers: { 'X-Request-Id': requestId },
      });
    }
    if (existing.url && existing.url !== parsed.url) {
      // URL bereits gesetzt und weicht ab — niemand darf einen bestehenden
      // Anhang umziehen, sonst könnte ein Angreifer eine fremde Blob-URL
      // unterschieben.
      return apiError({
        code: 'CONFLICT',
        message: 'Anhang hat bereits eine URL.',
        field: 'url',
        headers: { 'X-Request-Id': requestId },
      });
    }

    // Idempotent: gleicher Wert → no-op-Update + 200 (kein Crash, kein 409).
    const updated = await prisma.bookingAttachment.update({
      where: { id: attachmentId },
      data: { url: parsed.url },
    });

    return apiSuccess({
      attachmentId: updated.id,
      url: updated.url,
      filename: updated.filename,
      contentType: updated.contentType,
      sizeBytes: updated.sizeBytes,
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err, 'PATCH /api/upload/attachments/[id]', {
      requestId,
      authState,
      customerId,
    });
  }
}
