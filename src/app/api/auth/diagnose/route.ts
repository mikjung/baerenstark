/**
 * GET /api/auth/diagnose — Iteration 7 / US-IT7-02 + US-IT7-03,
 *                         erweitert in Iteration 8 / US-IT8-05.
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
 *   - `checks[].actual` darf NIEMALS einen Secret-Wert enthalten — nur
 *     "set"/"unset"/"alias-only" oder nicht-sensitive Konfig-Strings (URL,
 *     Boolean-String).
 *
 * **m5-IT7 (Aliasing-Transparenz):**
 *   - Zusätzliches Feld `secret_source` zeigt, welche ENV-Variable den
 *     `AUTH_SECRET`-Wert tatsächlich geliefert hat:
 *       'AUTH_SECRET'             — Pflicht-Name, korrekt gesetzt.
 *       'NEXTAUTH_SECRET (alias)' — Read-Compat-Alias, nur dieser ist gesetzt.
 *       null                       — keiner gesetzt.
 *
 * **IT8 / US-IT8-05 (Verdikt-Schicht):**
 *   - Neues Top-Level-Feld `verdict` (steht als allererstes Feld im Body,
 *     damit Tom es im Browser-JSON-Dump sofort sieht).
 *   - Neues Top-Level-Feld `checks[]` mit pro-Check-Status (ok/warn/fail)
 *     und `actionRequired` ("code" | "config" | "none").
 *   - Verdikt- und Check-Logik leben in `src/lib/auth-diagnose.ts` (so
 *     unit-testbar; Next-App-Router erlaubt keine zusätzlichen Exports
 *     in route.ts-Dateien).
 *
 * **Story-Verknüpfung:** US-IT7-02 (Google) + US-IT7-03 (Facebook) +
 *                        US-IT8-05 (Verdikt-Schicht).
 */

import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import {
  buildDiagnoseChecks,
  computeDiagnoseVerdict,
  isSet,
  type DiagnoseCheck,
  type DiagnoseEnvInput,
  type DiagnoseVerdict,
} from '@/lib/auth-diagnose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DiagnoseEnvSnapshot {
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
}

interface DiagnoseProvidersActive {
  google: boolean;
  facebook: boolean;
  credentialsCustomer: boolean;
  credentialsAdmin: boolean;
}

interface DiagnoseExpectedCallbacks {
  admin: string;
  googleC: string;
  facebook: string;
}

interface DiagnoseResponseBody {
  // IT8 — Verdikt steht als ALLERERSTES Feld im Body (QA BUG-IT8-05-B):
  verdict: DiagnoseVerdict;
  checks: DiagnoseCheck[];
  // IT7-Felder (unverändert, für Skripte, die sie heute schon parsen):
  env: DiagnoseEnvSnapshot;
  secret_source: 'AUTH_SECRET' | 'NEXTAUTH_SECRET (alias)' | null;
  providersActive: DiagnoseProvidersActive;
  expectedCallbacks: DiagnoseExpectedCallbacks;
  notes: string[];
}

function readEnv(): DiagnoseEnvInput {
  return {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID,
    FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET,
    FEATURE_OAUTH_LOGIN: process.env.FEATURE_OAUTH_LOGIN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL,
  };
}

function isDiagnoseEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.AUTH_DIAGNOSE_ENABLED === 'true';
}

export async function GET(): Promise<Response> {
  if (!isDiagnoseEnabled()) {
    notFound();
  }

  const env = readEnv();
  const baseUrl = env.NEXTAUTH_URL ?? '<UNSET>';

  const authSecretSet = isSet(env.AUTH_SECRET);
  const nextauthSecretSet = isSet(env.NEXTAUTH_SECRET);
  let secretSource: DiagnoseResponseBody['secret_source'] = null;
  if (authSecretSet) {
    secretSource = 'AUTH_SECRET';
  } else if (nextauthSecretSet) {
    secretSource = 'NEXTAUTH_SECRET (alias)';
  }

  const checks = buildDiagnoseChecks(env);
  const verdict = computeDiagnoseVerdict(checks);

  // WICHTIG: `verdict` und `checks` sollen als ALLERERSTE Felder im Body
  // stehen (QA BUG-IT8-05-B), damit Tom sie im rohen JSON-Dump sofort sieht.
  // JSON.stringify respektiert die Property-Insertion-Order der Engine.
  const body: DiagnoseResponseBody = {
    verdict,
    checks,
    env: {
      NODE_ENV: env.NODE_ENV ?? null,
      NEXTAUTH_URL: env.NEXTAUTH_URL ?? null,
      AUTH_SECRET_set: authSecretSet,
      NEXTAUTH_SECRET_set: nextauthSecretSet,
      AUTH_TRUST_HOST: env.AUTH_TRUST_HOST ?? null,
      GOOGLE_CLIENT_ID_set: isSet(env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET_set: isSet(env.GOOGLE_CLIENT_SECRET),
      FACEBOOK_CLIENT_ID_set: isSet(env.FACEBOOK_CLIENT_ID),
      FACEBOOK_CLIENT_SECRET_set: isSet(env.FACEBOOK_CLIENT_SECRET),
      FEATURE_OAUTH_LOGIN: env.FEATURE_OAUTH_LOGIN ?? null,
      RESEND_API_KEY_set: isSet(env.RESEND_API_KEY),
      BOOTSTRAP_ADMIN_EMAIL_set: isSet(env.BOOTSTRAP_ADMIN_EMAIL),
    },
    secret_source: secretSource,
    providersActive: {
      google: isSet(env.GOOGLE_CLIENT_ID) && isSet(env.GOOGLE_CLIENT_SECRET),
      facebook:
        isSet(env.FACEBOOK_CLIENT_ID) && isSet(env.FACEBOOK_CLIENT_SECRET),
      credentialsCustomer: true, // ab IT7 immer aktiv
      credentialsAdmin: true,
    },
    expectedCallbacks: {
      admin: `${baseUrl}/api/auth/callback/credentials`,
      googleC: `${baseUrl}/api/auth/customer/callback/google`,
      facebook: `${baseUrl}/api/auth/customer/callback/facebook`,
    },
    notes: [
      'Lies zuerst `verdict.actionRequired` — "code" = Engineer; "config" = Tom; "none" = alles ok.',
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
