/**
 * NextAuth-Customer-Handler — OAuth2 für Kunden (Iteration 5 / US-31).
 *
 * Verbindlich getrennt vom Admin-NextAuth (`/api/auth/[...nextauth]`).
 *
 * Feature-Flag-Verhalten: Wenn weder `GOOGLE_CLIENT_ID` noch
 * `GITHUB_CLIENT_ID` (mit zugehörigen Secrets) gesetzt sind ODER
 * `FEATURE_OAUTH_LOGIN=false`, antworten wir mit 503. Damit kann das
 * Frontend die OAuth-Buttons konditional ausblenden, ohne dass Tests
 * gegen einen NextAuth-Handler laufen, der ohne Provider 500-Fehler
 * werfen würde.
 */

import { customerOAuthHandlers, isCustomerOAuthEnabled } from '@/lib/customer-oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SERVICE_UNAVAILABLE = new Response(
  JSON.stringify({
    error: {
      code: 'OAUTH_NOT_CONFIGURED',
      message:
        'OAuth-Login ist derzeit nicht konfiguriert. Bitte wenden Sie sich an den Betreiber.',
    },
  }),
  {
    status: 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  },
);

export async function GET(req: Request, ctx: unknown): Promise<Response> {
  if (!isCustomerOAuthEnabled()) {
    return SERVICE_UNAVAILABLE.clone();
  }
  // Cast: NextAuth-Handler haben eine kompatible Signatur — TypeScript
  // sieht das aufgrund des dynamischen Catch-All-Routings nicht direkt.
  return (
    customerOAuthHandlers as unknown as {
      GET: (req: Request, ctx: unknown) => Promise<Response>;
    }
  ).GET(req, ctx);
}

export async function POST(req: Request, ctx: unknown): Promise<Response> {
  if (!isCustomerOAuthEnabled()) {
    return SERVICE_UNAVAILABLE.clone();
  }
  return (
    customerOAuthHandlers as unknown as {
      POST: (req: Request, ctx: unknown) => Promise<Response>;
    }
  ).POST(req, ctx);
}
