/**
 * GET /api/auth/diagnose — Iteration 7 / US-IT7-02 + US-IT7-03.
 *
 * **Zweck:** Self-Service-Diagnose-Endpoint für Tom und Engineers, der die
 * relevanten Auth-Konfigurations-Bits in einer JSON-Antwort zusammenfasst —
 * ohne dass dafür der Code gelesen werden muss.
 *
 * **Sicherheit (verbindlich):**
 *   - Endpoint antwortet **nur**, wenn `NODE_ENV !== 'production'` ODER
 *     `AUTH_DIAGNOSE_ENABLED === 'true'` gesetzt ist. In Produktion sonst
 *     404 (Next.js `notFound()`).
 *   - Der Endpoint liefert NIEMALS Secret-Werte im Klartext — nur Bool-Flags
 *     („ist die Variable gesetzt?") + die erwarteten Callback-URLs.
 *
 * **m5-IT7 (Aliasing-Transparenz):**
 *   - Zusätzliches Feld `secret_source` zeigt, welche ENV-Variable den
 *     `AUTH_SECRET`-Wert tatsächlich geliefert hat:
 *       'AUTH_SECRET'             — Pflicht-Name, korrekt gesetzt.
 *       'NEXTAUTH_SECRET (alias)' — Read-Compat-Alias, nur dieser ist gesetzt.
 *       null                       — keiner gesetzt.
 *
 * **Story-Verknüpfung:** US-IT7-02 (Google) + US-IT7-03 (Facebook).
 */

import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DiagnoseResponseBody {
  env: {
    NODE_ENV: string | null;
    NEXTAUTH_URL: string | null;
    AUTH_SECRET_set: boolean;
    NEXTAUTH_SECRET_set: boolean;
    AUTH_TRUST_HOST: string | null;
    GOOGLE_CLIENT_ID_set: boolean;
    GOOGLE_CLIENT_SECRET_set: boolean;
    FACEBOOK_CLIENT_ID_set: boolean;
    FACEBOOK_CLIENT_SECRET_set: boolean;
    FEATURE_OAUTH_LOGIN: string | null;
    RESEND_API_KEY_set: boolean;
    BOOTSTRAP_ADMIN_EMAIL_set: boolean;
  };
  /** m5-IT7: welche ENV-Var den effektiven AUTH_SECRET-Wert liefert. */
  secret_source: 'AUTH_SECRET' | 'NEXTAUTH_SECRET (alias)' | null;
  providersActive: {
    google: boolean;
    facebook: boolean;
    credentialsCustomer: boolean;
    credentialsAdmin: boolean;
  };
  expectedCallbacks: {
    admin: string;
    googleC: string;
    facebook: string;
  };
  notes: string[];
}

function isDiagnoseEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.AUTH_DIAGNOSE_ENABLED === 'true';
}

export async function GET(): Promise<Response> {
  if (!isDiagnoseEnabled()) {
    notFound();
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? '<UNSET>';

  const authSecret = process.env.AUTH_SECRET;
  const nextauthSecret = process.env.NEXTAUTH_SECRET;
  let secretSource: DiagnoseResponseBody['secret_source'] = null;
  if (authSecret && authSecret.length > 0) {
    secretSource = 'AUTH_SECRET';
  } else if (nextauthSecret && nextauthSecret.length > 0) {
    secretSource = 'NEXTAUTH_SECRET (alias)';
  }

  const body: DiagnoseResponseBody = {
    env: {
      NODE_ENV: process.env.NODE_ENV ?? null,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
      AUTH_SECRET_set: !!process.env.AUTH_SECRET,
      NEXTAUTH_SECRET_set: !!process.env.NEXTAUTH_SECRET,
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? null,
      GOOGLE_CLIENT_ID_set: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET_set: !!process.env.GOOGLE_CLIENT_SECRET,
      FACEBOOK_CLIENT_ID_set: !!process.env.FACEBOOK_CLIENT_ID,
      FACEBOOK_CLIENT_SECRET_set: !!process.env.FACEBOOK_CLIENT_SECRET,
      FEATURE_OAUTH_LOGIN: process.env.FEATURE_OAUTH_LOGIN ?? null,
      RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
      BOOTSTRAP_ADMIN_EMAIL_set: !!process.env.BOOTSTRAP_ADMIN_EMAIL,
    },
    secret_source: secretSource,
    providersActive: {
      google: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
      facebook: !!(
        process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ),
      credentialsCustomer: true, // ab IT7 immer aktiv
      credentialsAdmin: true,
    },
    expectedCallbacks: {
      admin: `${baseUrl}/api/auth/callback/credentials`,
      googleC: `${baseUrl}/api/auth/customer/callback/google`,
      facebook: `${baseUrl}/api/auth/customer/callback/facebook`,
    },
    notes: [
      'NEXTAUTH_URL darf KEINEN Trailing-Slash haben.',
      'Google: Authorized Redirect URI muss exakt expectedCallbacks.googleC entsprechen.',
      'Facebook: gleiche Regel + App-Domain im Meta-Portal verifiziert + App-Status "Live".',
      'AUTH_SECRET ist NextAuth v5 Pflicht (32+ Zeichen). NEXTAUTH_SECRET ist Read-Compat-Alias.',
      'AUTH_TRUST_HOST=true ist auf Vercel/Tunnel/Production Pflicht.',
      'Dieser Endpoint liefert NIEMALS Secret-Werte im Klartext — nur Bool-Flags.',
    ],
  };

  return NextResponse.json(body, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
