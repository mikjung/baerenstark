/**
 * Auth-Diagnose-Logik (US-IT8-05).
 *
 * Pure Funktionen für die Diagnose-Checks und das Verdikt — bewusst
 * außerhalb des `route.ts`-Files, weil Next.js App Router keine
 * zusätzlichen Exports neben den Handler-Funktionen erlaubt.
 *
 * Wird von `src/app/api/auth/diagnose/route.ts` und von
 * `tests/diagnose-verdict.test.ts` importiert.
 *
 * **Sicherheitsvorgabe:** `actual` darf NIEMALS einen Secret-Wert enthalten —
 * nur „set"/„unset"/„alias-only" oder nicht-sensitive Konfig-Werte (URL,
 * Boolean-String).
 *
 * **QA BUG-IT8-05-A:** Fehlende ENV-Variablen sind STETS
 * `actionRequired: "config"` — der Engineer kann nichts daran tun, dass Tom
 * in Vercel keine ENV-Var gesetzt hat. „code" ist nur reserviert für echte
 * Code-Bugs.
 */

export type DiagnoseCheckStatus = 'ok' | 'warn' | 'fail';
export type DiagnoseActionRequired = 'code' | 'config' | 'none';

export interface DiagnoseCheck {
  /** Stabile ID (Snake-Case, kein i18n) — für Cross-Reference im Verdikt. */
  id: string;
  /** Kurzbeschreibung in Deutsch (UI-tauglich). */
  label: string;
  status: DiagnoseCheckStatus;
  /** Niemals ein Secret-Wert. „set"/„unset"/„alias-only"/URL/Boolean-String. */
  actual: string;
  expected: string;
  actionRequired: DiagnoseActionRequired;
  /** Deutsch, eine Zeile, max ~200 Zeichen. */
  message: string;
}

export interface DiagnoseVerdict {
  actionRequired: DiagnoseActionRequired;
  /** Deutsch, 1–2 Sätze. Steht prominent im Response-Body (allererstes Feld). */
  summary: string;
  /** IDs der Checks, die einen Code-Fix erfordern (sollte i.d.R. leer sein). */
  codeFailures: string[];
  /** Tom-lesbare Anweisungen, was in der Cloud-Console / Vercel zu tun ist. */
  configActions: string[];
}

export interface DiagnoseEnvInput {
  NODE_ENV?: string;
  NEXTAUTH_URL?: string;
  AUTH_SECRET?: string;
  NEXTAUTH_SECRET?: string;
  AUTH_TRUST_HOST?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  FACEBOOK_CLIENT_ID?: string;
  FACEBOOK_CLIENT_SECRET?: string;
  FEATURE_OAUTH_LOGIN?: string;
  RESEND_API_KEY?: string;
  BOOTSTRAP_ADMIN_EMAIL?: string;
}

export function isSet(v: string | undefined): boolean {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Erzeugt die strukturierten Diagnose-Checks aus einem ENV-Snapshot.
 */
export function buildDiagnoseChecks(env: DiagnoseEnvInput): DiagnoseCheck[] {
  const checks: DiagnoseCheck[] = [];
  const isProd = env.NODE_ENV === 'production';

  // ---- NEXTAUTH_URL ----------------------------------------------------------
  const url = env.NEXTAUTH_URL;
  if (!isSet(url)) {
    checks.push({
      id: 'nextauth_url_set',
      label: 'NEXTAUTH_URL ist gesetzt',
      status: 'fail',
      actual: 'unset',
      expected:
        'volle Origin ohne Trailing-Slash, z.B. https://www.baerenstark-hausservice.app',
      actionRequired: 'config',
      message:
        'ENV-Var NEXTAUTH_URL fehlt. In Vercel-Dashboard für die richtige Umgebung setzen, dann redeploy.',
    });
  } else {
    const hasTrailingSlash = url!.endsWith('/');
    const isHttp = /^http:\/\//i.test(url!);
    let status: DiagnoseCheckStatus = 'ok';
    let message = 'NEXTAUTH_URL gesetzt und plausibel formatiert.';
    if (hasTrailingSlash) {
      status = 'warn';
      message =
        'NEXTAUTH_URL endet mit „/". Trailing-Slash entfernen, sonst bricht der OAuth-Callback.';
    } else if (isHttp && isProd) {
      status = 'fail';
      message = 'NEXTAUTH_URL nutzt http:// in Production. Auf https:// umstellen.';
    }
    checks.push({
      id: 'nextauth_url_set',
      label: 'NEXTAUTH_URL ist gesetzt',
      status,
      actual: url!,
      expected: 'volle Origin ohne Trailing-Slash, https:// in Production',
      // QA BUG-IT8-05-A: ENV-Wert ist immer Config, nicht Code.
      actionRequired: status === 'ok' ? 'none' : 'config',
      message,
    });
  }

  // ---- NEXTAUTH_URL Format ---------------------------------------------------
  if (isSet(url)) {
    let parseable = true;
    try {
      // eslint-disable-next-line no-new
      new URL(url!);
    } catch {
      parseable = false;
    }
    checks.push({
      id: 'nextauth_url_format',
      label: 'NEXTAUTH_URL ist parseable',
      status: parseable ? 'ok' : 'fail',
      actual: parseable ? 'parseable' : 'not-parseable',
      expected: 'gültige absolute URL',
      actionRequired: parseable ? 'none' : 'config',
      message: parseable
        ? 'URL-Parser akzeptiert NEXTAUTH_URL.'
        : 'NEXTAUTH_URL kann nicht als URL geparst werden. Wert in Vercel korrigieren.',
    });
  }

  // ---- AUTH_SECRET / NEXTAUTH_SECRET (alias) --------------------------------
  const authSecretSet = isSet(env.AUTH_SECRET);
  const nextauthSecretSet = isSet(env.NEXTAUTH_SECRET);
  let secretActual: string;
  let secretStatus: DiagnoseCheckStatus;
  let secretMessage: string;
  if (authSecretSet) {
    secretActual = 'set';
    secretStatus = 'ok';
    secretMessage = 'AUTH_SECRET gesetzt.';
  } else if (nextauthSecretSet) {
    secretActual = 'alias-only';
    secretStatus = 'warn';
    secretMessage =
      'Nur NEXTAUTH_SECRET (Read-Compat-Alias) gesetzt. Besser AUTH_SECRET direkt setzen.';
  } else {
    secretActual = 'unset';
    secretStatus = 'fail';
    secretMessage =
      'Weder AUTH_SECRET noch NEXTAUTH_SECRET gesetzt. Auth bricht. `openssl rand -base64 32` und in Vercel setzen.';
  }
  checks.push({
    id: 'auth_secret_present',
    label: 'AUTH_SECRET (oder Alias) gesetzt',
    status: secretStatus,
    actual: secretActual,
    expected: 'AUTH_SECRET gesetzt (≥ 32 Zeichen)',
    actionRequired: secretStatus === 'ok' ? 'none' : 'config',
    message: secretMessage,
  });

  // ---- AUTH_SECRET Länge (nicht direkt prüfbar; immer warn-Hinweis) ---------
  checks.push({
    id: 'auth_secret_length',
    label: 'AUTH_SECRET ≥ 32 Zeichen',
    status: 'warn',
    actual: 'not-checked',
    expected: '≥ 32 Zeichen (Best Practice)',
    actionRequired: 'config',
    message:
      'Länge wird hier nicht serverseitig geprüft (Secret darf nicht ausgegeben werden). Tom verifiziert manuell, dass das Secret aus `openssl rand -base64 32` ≥ 32 Zeichen hat.',
  });

  // ---- AUTH_TRUST_HOST in Production ----------------------------------------
  const trustHost = env.AUTH_TRUST_HOST;
  if (isProd) {
    const trustOk = trustHost === 'true';
    checks.push({
      id: 'auth_trust_host_set_in_prod',
      label: 'AUTH_TRUST_HOST=true in Production',
      status: trustOk ? 'ok' : 'fail',
      actual: trustHost ?? 'unset',
      expected: 'true',
      actionRequired: trustOk ? 'none' : 'config',
      message: trustOk
        ? 'AUTH_TRUST_HOST=true gesetzt — NextAuth v5 vertraut dem Host (Pflicht auf Vercel).'
        : 'AUTH_TRUST_HOST fehlt oder ist nicht "true". In Production-ENV setzen, sonst „Bad request" beim Login.',
    });
  } else {
    checks.push({
      id: 'auth_trust_host_set_in_prod',
      label: 'AUTH_TRUST_HOST=true in Production',
      status: 'ok',
      actual: trustHost ?? 'unset',
      expected: 'true (nur in Production relevant)',
      actionRequired: 'none',
      message: 'NODE_ENV ist nicht "production" — Check ist hier nicht relevant.',
    });
  }

  // ---- Google ----------------------------------------------------------------
  const googleId = isSet(env.GOOGLE_CLIENT_ID);
  const googleSecret = isSet(env.GOOGLE_CLIENT_SECRET);

  checks.push({
    id: 'google_client_id_set',
    label: 'GOOGLE_CLIENT_ID gesetzt',
    status: googleId ? 'ok' : 'fail',
    actual: googleId ? 'set' : 'unset',
    expected: 'set (für Google-OAuth)',
    actionRequired: googleId ? 'none' : 'config',
    message: googleId
      ? 'GOOGLE_CLIENT_ID gesetzt.'
      : 'ENV-Var GOOGLE_CLIENT_ID fehlt. Aus Google Cloud Console kopieren und in Vercel setzen.',
  });

  checks.push({
    id: 'google_client_secret_set',
    label: 'GOOGLE_CLIENT_SECRET gesetzt',
    status: googleSecret ? 'ok' : 'fail',
    actual: googleSecret ? 'set' : 'unset',
    expected: 'set (für Google-OAuth)',
    actionRequired: googleSecret ? 'none' : 'config',
    message: googleSecret
      ? 'GOOGLE_CLIENT_SECRET gesetzt.'
      : 'ENV-Var GOOGLE_CLIENT_SECRET fehlt. Aus Google Cloud Console kopieren und in Vercel setzen.',
  });

  const googleProviderLoaded = googleId && googleSecret;
  checks.push({
    id: 'google_provider_loaded',
    label: 'Google-Provider in NextAuth aktiv',
    status: googleProviderLoaded ? 'ok' : 'fail',
    actual: googleProviderLoaded ? 'true' : 'false',
    expected: 'true (folgt aus den beiden GOOGLE_*-ENV-Vars)',
    actionRequired: googleProviderLoaded ? 'none' : 'config',
    message: googleProviderLoaded
      ? 'Google-Provider wird beim Auth-Boot geladen.'
      : 'Google-Provider wird nicht geladen — fehlende GOOGLE_CLIENT_ID/SECRET. Folgefehler von google_client_id_set / google_client_secret_set.',
  });

  // ---- Facebook --------------------------------------------------------------
  const fbId = isSet(env.FACEBOOK_CLIENT_ID);
  const fbSecret = isSet(env.FACEBOOK_CLIENT_SECRET);

  checks.push({
    id: 'facebook_client_id_set',
    label: 'FACEBOOK_CLIENT_ID gesetzt',
    status: fbId ? 'ok' : 'fail',
    actual: fbId ? 'set' : 'unset',
    expected: 'set (für Facebook-OAuth)',
    actionRequired: fbId ? 'none' : 'config',
    message: fbId
      ? 'FACEBOOK_CLIENT_ID gesetzt.'
      : 'ENV-Var FACEBOOK_CLIENT_ID fehlt. Aus Meta Developer Portal kopieren und in Vercel setzen.',
  });

  checks.push({
    id: 'facebook_client_secret_set',
    label: 'FACEBOOK_CLIENT_SECRET gesetzt',
    status: fbSecret ? 'ok' : 'fail',
    actual: fbSecret ? 'set' : 'unset',
    expected: 'set (für Facebook-OAuth)',
    actionRequired: fbSecret ? 'none' : 'config',
    message: fbSecret
      ? 'FACEBOOK_CLIENT_SECRET gesetzt.'
      : 'ENV-Var FACEBOOK_CLIENT_SECRET fehlt. Aus Meta Developer Portal kopieren und in Vercel setzen.',
  });

  // ---- expectedCallback Plausibilität ---------------------------------------
  // Beide Callback-URLs basieren auf NEXTAUTH_URL. Wenn die nicht gesetzt
  // ist, sind die Callbacks `<UNSET>/...` — Tom kann das nicht in Console
  // eintragen, bevor NEXTAUTH_URL geklärt ist.
  const callbackBaseOk = isSet(url);
  checks.push({
    id: 'expected_callback_google_present',
    label: 'expectedCallbacks.googleC ist plausibel',
    status: callbackBaseOk ? 'ok' : 'fail',
    actual: callbackBaseOk
      ? 'derived-from-NEXTAUTH_URL'
      : '<UNSET>/api/auth/customer/callback/google',
    expected: 'enthält keinen <UNSET>-Platzhalter',
    actionRequired: callbackBaseOk ? 'none' : 'config',
    message: callbackBaseOk
      ? 'Google-Callback-URL kann aus NEXTAUTH_URL abgeleitet werden.'
      : 'Google-Callback enthält <UNSET> — NEXTAUTH_URL setzen, dann erneut prüfen.',
  });

  checks.push({
    id: 'expected_callback_facebook_present',
    label: 'expectedCallbacks.facebook ist plausibel',
    status: callbackBaseOk ? 'ok' : 'fail',
    actual: callbackBaseOk
      ? 'derived-from-NEXTAUTH_URL'
      : '<UNSET>/api/auth/customer/callback/facebook',
    expected: 'enthält keinen <UNSET>-Platzhalter',
    actionRequired: callbackBaseOk ? 'none' : 'config',
    message: callbackBaseOk
      ? 'Facebook-Callback-URL kann aus NEXTAUTH_URL abgeleitet werden.'
      : 'Facebook-Callback enthält <UNSET> — NEXTAUTH_URL setzen, dann erneut prüfen.',
  });

  // ---- Resend / Bootstrap (warn, nicht fail — Auth funktioniert auch ohne) ---
  const resendSet = isSet(env.RESEND_API_KEY);
  checks.push({
    id: 'resend_api_key_set',
    label: 'RESEND_API_KEY gesetzt',
    status: resendSet ? 'ok' : 'warn',
    actual: resendSet ? 'set' : 'unset',
    expected: 'set (für Verify-/Reset-Mails)',
    actionRequired: resendSet ? 'none' : 'config',
    message: resendSet
      ? 'RESEND_API_KEY gesetzt.'
      : 'RESEND_API_KEY fehlt — Verify-/Reset-Mails werden nicht versandt.',
  });

  const bootstrapSet = isSet(env.BOOTSTRAP_ADMIN_EMAIL);
  checks.push({
    id: 'bootstrap_admin_email_set',
    label: 'BOOTSTRAP_ADMIN_EMAIL gesetzt',
    status: bootstrapSet ? 'ok' : 'warn',
    actual: bootstrapSet ? 'set' : 'unset',
    expected: 'set (für initialen Admin-Bootstrap)',
    actionRequired: bootstrapSet ? 'none' : 'config',
    message: bootstrapSet
      ? 'BOOTSTRAP_ADMIN_EMAIL gesetzt.'
      : 'BOOTSTRAP_ADMIN_EMAIL fehlt — kein neuer Bootstrap-Admin möglich (nicht kritisch, falls bereits ein Admin existiert).',
  });

  return checks;
}

/**
 * Aggregiert die einzelnen Checks zu einem Top-Level-Verdikt.
 *
 * Regeln (siehe ARCHITECTURE_IT8.md §5.2.2):
 *   1. Mindestens ein `fail` mit `actionRequired === "code"` → "code".
 *   2. Sonst, mindestens ein `fail` ODER `warn` mit `actionRequired === "config"` → "config".
 *   3. Sonst → "none".
 */
export function computeDiagnoseVerdict(checks: DiagnoseCheck[]): DiagnoseVerdict {
  const codeFailures = checks
    .filter((c) => c.status === 'fail' && c.actionRequired === 'code')
    .map((c) => c.id);

  const configIssues = checks.filter(
    (c) =>
      (c.status === 'fail' || c.status === 'warn') &&
      c.actionRequired === 'config',
  );

  if (codeFailures.length > 0) {
    return {
      actionRequired: 'code',
      summary:
        'Im Code ist mindestens ein Fehler. Engineer muss fixen, bevor Tom in der Cloud-Console etwas tun kann.',
      codeFailures,
      configActions: [],
    };
  }

  if (configIssues.length > 0) {
    return {
      actionRequired: 'config',
      summary:
        'Code ist OK. Tom muss im Vercel-Dashboard oder in der Cloud-Console die unten gelisteten Schritte ausführen.',
      codeFailures: [],
      configActions: configIssues.map((c) => `[${c.id}] ${c.message}`),
    };
  }

  return {
    actionRequired: 'none',
    summary:
      'Alle Checks grün. Falls Login trotzdem fehlschlägt, prüfe Browser-Cookies / Inkognito-Tab.',
    codeFailures: [],
    configActions: [],
  };
}
