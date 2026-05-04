/**
 * /api/upload — IT13 / S05 (Direct-Upload-Refactor).
 *
 * Decision IT13 (Source of Truth):
 *   Der bestehende Server-Side-Multipart-Upload (`POST /api/upload`)
 *   ist auf Vercel-Hobby durch das ~4.5-MB-Function-Body-Limit blockiert
 *   und wird strukturell durch Direct-Upload via `@vercel/blob/client`
 *   ersetzt. Dieser Endpoint liefert für den Übergangs-Deploy einen
 *   klar definierten **HTTP 410 GONE**, sodass alte Browser-Tabs eine
 *   sprechende Fehlermeldung statt eines stillen Fehlversuchs erhalten.
 *
 * Neue Endpoints:
 *   POST  /api/upload/token              — signiert Vercel-Blob-Client-Token
 *   PATCH /api/upload/attachments/[id]   — confirmed nach Direct-Upload die URL
 *
 * Migration:
 *   Sobald das Frontend (FE-Engineer) nachgezogen ist und Tom in Production
 *   verifiziert hat, kann diese Datei komplett entfernt werden. Bis dahin
 *   bleibt sie als Kompatibilitäts-Stopper.
 */

import type { NextRequest } from 'next/server';
import { apiError } from '@/lib/api';
import { newRequestId } from '@/lib/log-request-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: NextRequest): Promise<Response> {
  // requestId für Log-Korrelation auch hier — falls ein Operator den
  // Vercel-Log filtert, sieht er die Header-ID auch in 410-Antworten.
  const requestId = newRequestId();
  return apiError({
    code: 'GONE',
    // `UPLOAD_LEGACY` als semantischer Subcode — Frontend kann ein
    // freundliches „Bitte Seite neu laden"-Banner anzeigen.
    subcode: 'UPLOAD_LEGACY',
    message:
      'Der Upload-Pfad wurde aktualisiert. Bitte die Seite neu laden, dann erneut versuchen.',
    headers: { 'X-Request-Id': requestId },
  });
}
