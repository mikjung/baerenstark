/**
 * Unit-Tests für die Verdikt-Logik des Diagnose-Endpoints
 * (`src/app/api/auth/diagnose/route.ts`).
 *
 * Story: US-IT8-05 (Iteration 8). Wir prüfen die reinen Funktionen
 *   - `buildDiagnoseChecks(env)`
 *   - `computeDiagnoseVerdict(checks)`
 * gegen die in ARCHITECTURE_IT8.md §5.2.2 spezifizierte Verdikt-Logik:
 *
 *   1. fail mit actionRequired === "code"  → verdict.actionRequired = "code"
 *   2. fail/warn mit actionRequired === "config" → "config"
 *   3. sonst → "none"
 *
 * Plus QA BUG-IT8-05-A: ENV-Var-Checks haben STETS `actionRequired: "config"`,
 * niemals "code".
 *
 * Lauf: `npx tsx tests/diagnose-verdict.test.ts` (oder via `npm run test:diagnose`).
 * Exit-Code 0 = alle pass, 1 = mindestens ein fail.
 */

import {
  buildDiagnoseChecks,
  computeDiagnoseVerdict,
  type DiagnoseCheck,
  type DiagnoseEnvInput,
} from '../src/lib/auth-diagnose';

let pass = 0;
let fail = 0;

function ok(name: string): void {
  pass++;
  console.log(`  PASS  ${name}`);
}

function bad(name: string, detail?: unknown): void {
  fail++;
  console.log(`  FAIL  ${name}`);
  if (detail !== undefined) {
    console.log(`        ${JSON.stringify(detail)}`);
  }
}

function assertEq<T>(actual: T, expected: T, name: string): void {
  if (actual === expected) {
    ok(name);
  } else {
    bad(name, { actual, expected });
  }
}

function assertIncludes(haystack: string[], needle: string, name: string): void {
  if (haystack.includes(needle)) {
    ok(name);
  } else {
    bad(name, { haystack, needle });
  }
}

function findCheck(checks: DiagnoseCheck[], id: string): DiagnoseCheck | undefined {
  return checks.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Test-Konstanten
// ---------------------------------------------------------------------------

/** Ein vollständig korrektes Production-ENV. */
const FULL_OK_ENV: DiagnoseEnvInput = {
  NODE_ENV: 'production',
  NEXTAUTH_URL: 'https://www.baerenstark-hausservice.app',
  AUTH_SECRET: 'a'.repeat(40),
  AUTH_TRUST_HOST: 'true',
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  FACEBOOK_CLIENT_ID: 'fb-id',
  FACEBOOK_CLIENT_SECRET: 'fb-secret',
  RESEND_API_KEY: 'resend-key',
  BOOTSTRAP_ADMIN_EMAIL: 'tom@example.com',
};

// ---------------------------------------------------------------------------
// Szenario 1: Alles ok → "none" (oder warn-only "config")
// ---------------------------------------------------------------------------

console.log('\nSzenario 1: Alle ENV-Vars korrekt gesetzt (Production)');
{
  const checks = buildDiagnoseChecks(FULL_OK_ENV);
  const verdict = computeDiagnoseVerdict(checks);

  // `auth_secret_length` ist *immer* warn (nicht prüfbar) — daher hat das
  // Verdikt im Best-Case-Szenario `actionRequired: "config"`, nicht "none".
  // Das ist erwartetes Verhalten und in der Architektur dokumentiert.
  assertEq(
    verdict.actionRequired,
    'config',
    'Best-Case: actionRequired ist "config" (wegen auth_secret_length-warn)',
  );
  assertEq(verdict.codeFailures.length, 0, 'Best-Case: keine codeFailures');

  // Trotzdem: kein einziger fail.
  const fails = checks.filter((c) => c.status === 'fail');
  assertEq(fails.length, 0, 'Best-Case: keine fail-Checks');

  // Alle Provider-Checks ok.
  assertEq(findCheck(checks, 'google_provider_loaded')?.status, 'ok', 'Best-Case: google_provider_loaded ok');
  assertEq(findCheck(checks, 'auth_secret_present')?.status, 'ok', 'Best-Case: auth_secret_present ok');
  assertEq(findCheck(checks, 'auth_trust_host_set_in_prod')?.status, 'ok', 'Best-Case: auth_trust_host ok');
}

// ---------------------------------------------------------------------------
// Szenario 2: Nur Config kaputt (NEXTAUTH_URL fehlt) → "config"
// ---------------------------------------------------------------------------

console.log('\nSzenario 2: NEXTAUTH_URL fehlt → "config"');
{
  const env: DiagnoseEnvInput = { ...FULL_OK_ENV, NEXTAUTH_URL: undefined };
  const checks = buildDiagnoseChecks(env);
  const verdict = computeDiagnoseVerdict(checks);

  assertEq(verdict.actionRequired, 'config', 'NEXTAUTH_URL fehlt → "config"');
  assertEq(verdict.codeFailures.length, 0, 'NEXTAUTH_URL fehlt: keine codeFailures');

  const urlCheck = findCheck(checks, 'nextauth_url_set');
  assertEq(urlCheck?.status, 'fail', 'nextauth_url_set hat status fail');
  // QA BUG-IT8-05-A: ENV-Var fehlt → STETS "config", niemals "code".
  assertEq(
    urlCheck?.actionRequired,
    'config',
    'nextauth_url_set hat actionRequired "config" (nicht "code") — QA BUG-IT8-05-A',
  );

  // Folgefehler bei Callbacks.
  const cbGoogle = findCheck(checks, 'expected_callback_google_present');
  assertEq(cbGoogle?.status, 'fail', 'expected_callback_google_present fail (Folgefehler)');
  assertEq(cbGoogle?.actionRequired, 'config', 'expected_callback_google_present actionRequired "config"');
}

// ---------------------------------------------------------------------------
// Szenario 3: Mehrere Configs kaputt — zwei ENV fehlen → "config"
// ---------------------------------------------------------------------------

console.log('\nSzenario 3: AUTH_SECRET + GOOGLE_CLIENT_ID fehlen → "config"');
{
  const env: DiagnoseEnvInput = {
    ...FULL_OK_ENV,
    AUTH_SECRET: undefined,
    NEXTAUTH_SECRET: undefined,
    GOOGLE_CLIENT_ID: undefined,
  };
  const checks = buildDiagnoseChecks(env);
  const verdict = computeDiagnoseVerdict(checks);

  assertEq(verdict.actionRequired, 'config', 'Zwei fehlende ENV → "config"');
  assertEq(verdict.codeFailures.length, 0, 'Zwei fehlende ENV: keine codeFailures');

  const secretCheck = findCheck(checks, 'auth_secret_present');
  assertEq(secretCheck?.status, 'fail', 'auth_secret_present hat status fail');
  assertEq(secretCheck?.actual, 'unset', 'auth_secret_present.actual ist "unset"');

  const googleProvider = findCheck(checks, 'google_provider_loaded');
  assertEq(googleProvider?.status, 'fail', 'google_provider_loaded fail');

  // Beide IDs müssen in den configActions referenziert sein.
  const actionText = verdict.configActions.join(' | ');
  if (actionText.includes('auth_secret_present')) {
    ok('configActions enthält auth_secret_present');
  } else {
    bad('configActions enthält auth_secret_present', actionText);
  }
  if (actionText.includes('google_client_id_set')) {
    ok('configActions enthält google_client_id_set');
  } else {
    bad('configActions enthält google_client_id_set', actionText);
  }
}

// ---------------------------------------------------------------------------
// Szenario 4: Nur "Code kaputt" (synthetisch, da aktuell kein Code-Bug
// existiert). Wir injizieren manuell einen Check mit
// `actionRequired === "code"` und `status === "fail"` und prüfen, dass die
// Verdikt-Logik korrekt nach "code" verzweigt.
// ---------------------------------------------------------------------------

console.log('\nSzenario 4: Synthetischer Code-Fail → "code"');
{
  const baseChecks = buildDiagnoseChecks(FULL_OK_ENV);
  const syntheticCodeFail: DiagnoseCheck = {
    id: 'synthetic_code_bug',
    label: 'Synthetic code bug',
    status: 'fail',
    actual: 'broken',
    expected: 'fixed',
    actionRequired: 'code',
    message: 'Engineer must fix me.',
  };
  const verdict = computeDiagnoseVerdict([...baseChecks, syntheticCodeFail]);

  assertEq(verdict.actionRequired, 'code', 'Synthetic code-fail → "code"');
  assertIncludes(
    verdict.codeFailures,
    'synthetic_code_bug',
    'codeFailures enthält synthetic_code_bug',
  );
  // configActions sind leer, wenn "code" gewinnt — Engineer-First-Regel.
  assertEq(verdict.configActions.length, 0, 'Bei "code"-Verdikt sind configActions leer');
}

// ---------------------------------------------------------------------------
// Szenario 5: Beides kaputt — Code-Fail UND Config-Fail → "code" gewinnt
// ---------------------------------------------------------------------------

console.log('\nSzenario 5: Code-Fail UND Config-Fail → "code" gewinnt');
{
  const env: DiagnoseEnvInput = { ...FULL_OK_ENV, NEXTAUTH_URL: undefined };
  const baseChecks = buildDiagnoseChecks(env);
  const syntheticCodeFail: DiagnoseCheck = {
    id: 'synthetic_code_bug_2',
    label: 'Another synthetic code bug',
    status: 'fail',
    actual: 'broken',
    expected: 'fixed',
    actionRequired: 'code',
    message: 'Engineer must fix me.',
  };
  const verdict = computeDiagnoseVerdict([...baseChecks, syntheticCodeFail]);

  assertEq(
    verdict.actionRequired,
    'code',
    'Code+Config beide fail → "code" gewinnt (Engineer-First)',
  );
  assertIncludes(
    verdict.codeFailures,
    'synthetic_code_bug_2',
    'codeFailures enthält synthetic_code_bug_2',
  );
  assertEq(
    verdict.configActions.length,
    0,
    'Bei "code"-Verdikt: configActions leer (auch wenn Configs fehlen)',
  );
}

// ---------------------------------------------------------------------------
// Szenario 6: NEXTAUTH_URL mit Trailing-Slash → warn → "config"
// ---------------------------------------------------------------------------

console.log('\nSzenario 6: NEXTAUTH_URL mit Trailing-Slash → warn → "config"');
{
  const env: DiagnoseEnvInput = {
    ...FULL_OK_ENV,
    NEXTAUTH_URL: 'https://www.baerenstark-hausservice.app/',
  };
  const checks = buildDiagnoseChecks(env);
  const verdict = computeDiagnoseVerdict(checks);

  const urlCheck = findCheck(checks, 'nextauth_url_set');
  assertEq(urlCheck?.status, 'warn', 'Trailing-Slash → warn');
  assertEq(urlCheck?.actionRequired, 'config', 'Trailing-Slash → actionRequired "config"');
  assertEq(verdict.actionRequired, 'config', 'Trailing-Slash → Verdikt "config"');
}

// ---------------------------------------------------------------------------
// Szenario 7: NEXTAUTH_SECRET (alias) gesetzt aber AUTH_SECRET nicht → warn
// ---------------------------------------------------------------------------

console.log('\nSzenario 7: Nur NEXTAUTH_SECRET (alias) → warn');
{
  const env: DiagnoseEnvInput = {
    ...FULL_OK_ENV,
    AUTH_SECRET: undefined,
    NEXTAUTH_SECRET: 'a'.repeat(40),
  };
  const checks = buildDiagnoseChecks(env);
  const secretCheck = findCheck(checks, 'auth_secret_present');
  assertEq(secretCheck?.status, 'warn', 'Alias-only → warn');
  assertEq(secretCheck?.actual, 'alias-only', 'actual ist "alias-only"');

  const verdict = computeDiagnoseVerdict(checks);
  assertEq(verdict.actionRequired, 'config', 'Alias-only → Verdikt "config"');
}

// ---------------------------------------------------------------------------
// Szenario 8: Sicherheits-Garantie — `actual` enthält niemals den Secret-Wert
// ---------------------------------------------------------------------------

console.log('\nSzenario 8: Sicherheits-Garantie — kein Secret im actual');
{
  const env: DiagnoseEnvInput = {
    ...FULL_OK_ENV,
    AUTH_SECRET: 'TOPSECRET-NEVER-LEAK-THIS-VALUE-12345',
    GOOGLE_CLIENT_SECRET: 'GOOGLESECRET-NEVER-LEAK-THIS',
  };
  const checks = buildDiagnoseChecks(env);
  for (const c of checks) {
    if (c.actual.includes('TOPSECRET') || c.actual.includes('GOOGLESECRET')) {
      bad(`Check ${c.id} leaked secret in actual`, c.actual);
    }
  }
  ok('Kein Secret-Wert in checks[].actual gefunden');
}

// ---------------------------------------------------------------------------
// Zusammenfassung
// ---------------------------------------------------------------------------

console.log('');
console.log(`Total: ${pass} pass, ${fail} fail`);

if (fail > 0) {
  process.exit(1);
}
