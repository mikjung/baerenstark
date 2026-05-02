# QA Implementation Review — Iteration 4

**Datum:** 2026-05-02
**Reviewer:** QA-Engineer (Subagent)
**Modus:** Build QA — Iteration 4 (US-25 bis US-29)
**Quellen:** `PROJECT.md` (US-25 … US-29), `contracts/api-routes.md` §11–§20

---

## Zusammenfassung

| Bereich            | Ergebnis                                |
| ------------------ | --------------------------------------- |
| TypeScript-Check   | PASS — keine Fehler                     |
| Build (`next build`) | PASS — 25/25 statische Seiten generiert |
| US-25 Kunden-Auth  | **Done** mit 1 funktionalen MAJOR-Bug   |
| US-26 Auftragsübersicht | **Done**                            |
| US-27 Storno im Portal  | **Done**                            |
| US-28 Stripe-Zahlung    | **Done**                            |
| US-29 Reviews           | **Done**                            |

**Anzahl Defekte:** 1 MAJOR · 3 MINOR · 0 BLOCKER.

**Finales Urteil:** *Approved with Fixes* — Iteration 4 ist funktional vollständig und alle BUG-401/402/403/404/405-Fixes sind sauber umgesetzt. Die einzige funktionale Abweichung ist BUG-IT4-QA-001 (Verify-Redirect-Param-Mismatch), die einen kleinen, gut isolierten Patch braucht. Alle anderen Funde sind Polish/Hygiene.

---

## Build-Status

### `npx tsc --noEmit`

Resultat: **PASS** — keine TypeScript-Fehler. Der Lauf erzeugt nur eine harmlose Experimental-Warning zu ESM-loading.

### `npm run build`

Resultat: **PASS** — `Exit Code 0`.

Beobachtungen:

1. Compilierung erfolgreich, alle 25 statischen Seiten generiert.
2. **Edge-Runtime-Warnings**: `node_modules/jose/dist/webapi/lib/deflate.js` nutzt `CompressionStream` / `DecompressionStream` — wird in der Edge-Middleware via `customer-auth.ts` gezogen. Funktioniert in der Praxis, weil die JWE-Pfade nicht aufgerufen werden (wir nutzen nur HS256 JWT). **MINOR**, aber dauerhafte Warning bei jedem Build.
3. **ESLint-Fehler im Build-Pipeline**: `Converting circular structure to JSON … property 'react' closes the circle` — kommt aus `.eslintrc.json`-Konfig. Build läuft trotzdem durch (ESLint ist separat von TypeScript). **MINOR**.
4. **Static-render Fehler-Log**: `Route /api/customer/verify-email couldn't be rendered statically because it used 'request.url'` — der Alias-Endpoint (`src/app/api/customer/verify-email/route.ts`) re-exportiert nur `GET` aus `../verify/route`, ohne eigene `dynamic = 'force-dynamic'`-Direktive. Build-Status nicht betroffen, aber Log-Lärm. **MINOR**.

---

## Pro Story

### US-25 — Kundenportal-Auth: **Done** (mit MAJOR-Bug)

| Checkliste                                                          | Status | Evidenz                                                                     |
| ------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------- |
| `POST /api/customer/register` legt CustomerUser mit `emailVerified=false` an | PASS   | `src/app/api/customer/register/route.ts:67-78`                              |
| `verificationTokenExpiry` gesetzt (BUG-401-Fix)                     | PASS   | `register/route.ts:63,76`; expiry = `now + 24h`                             |
| `POST /api/customer/login` setzt `customer-session`-Cookie          | PASS   | `login/route.ts:85,105-114`                                                 |
| `UpdateProfileSchema` ohne `email`-Feld (BUG-402-Fix)               | PASS   | `contracts/zod-schemas.ts:820-827` `.strict()` ohne `email`                 |
| `/konto/*` durch Middleware geschützt (außer `login`/`registrieren`/`verifizieren`/`passwort-*`/`zahlung?token=`) | PASS | `src/middleware.ts:22-61`                          |
| `safeCustomerCallback` nur same-origin (MAJOR-405-Fix)              | PASS   | `customer-auth.ts:111-119` lehnt `//`, `:`, `\\`, Whitespace ab             |
| Login-Fehler generisch ("E-Mail oder Passwort ungültig")            | PASS   | `login/route.ts:64-67,71-75`; live-Test bestätigt Wortlaut                  |
| Verify-Endpoint gegen `verificationTokenExpiry` (BUG-401-Fix)       | PASS   | `verify/route.ts:46-50`                                                     |
| Resend-Verification: neuer Token + neue Expiry                      | PASS   | `resend-verification/route.ts` (geprüft) — Token + Expiry werden in Transaktion neu gesetzt |
| Auto-Login nach Verifikation                                        | PARTIAL | Verify-Route setzt KEIN Session-Cookie (Spec sagt "optional"); Redirect → `/konto?verified=true`, Middleware schickt zurück zu `/konto/login`. Akzeptabel pro Spec-Wording. |
| **Verify-Success-Banner zeigt sich auf `/konto`**                   | **FAIL** | **BUG-IT4-QA-001 (MAJOR)** — siehe unten                                  |

**Schemata + API-Verträge:**

- `CustomerRegisterSchema` (`zod-schemas.ts:751-760`): vollständig mit `privacyAccepted: literal(true)`.
- `CustomerLoginSchema` (`zod-schemas.ts:774-779`): `redirectUrl` optional, max 512 Zeichen.
- `CustomerProfileUpdateSchema` (`zod-schemas.ts:820-826`): `.strict()`, akzeptiert `firstName`, `lastName`, `phone`. `email`-Feld korrekt entfernt — manuell verifiziert per Code-Read.

**Live-Verifikationen (gegen `localhost:3000`):**

```
POST /api/customer/login {wrong creds}
→ 401 {"error":{"code":"UNAUTHORIZED","message":"E-Mail oder Passwort ungültig."}}  PASS

POST /api/customer/register {valid}
→ 201 {"data":{"id":"cmoos2m5f00009ide5rruy4x7","email":"qa-test@example.com","emailVerified":false,"verificationMailSent":true}}  PASS

GET /api/customer/verify?token=invalid
→ 302 Location: http://localhost:3000/konto/login?error=invalid_token  PASS

GET /konto (ohne Cookie)
→ 307 Location: /konto/login?callbackUrl=%2Fkonto  PASS
```

---

### US-26 — Auftragsübersicht: **Done**

| Checkliste                                                          | Status | Evidenz                                                              |
| ------------------------------------------------------------------- | :----: | -------------------------------------------------------------------- |
| `GET /api/customer/bookings` nur eigene Buchungen                   | PASS   | `bookings/route.ts:101-102` (`where: { customerId: me.id }`)         |
| Split nach `upcoming` / `past`                                       | PASS   | `bookings/route.ts:113-136`                                           |
| Berlin-TZ-Heute via `todayInBerlin()`                                | PASS   | `cancellation.ts:101-111` (`Intl.DateTimeFormat` mit `en-CA` + Berlin) |
| Sortierung upcoming asc, past desc                                   | PASS   | `bookings/route.ts:82-92,138-139`                                    |
| Backend rechnet `isCancellable`, `cancellableUntilHours`, `canReview` | PASS  | `bookings/route.ts:36-80`                                            |
| Status-Badges deutsch (PENDING → "Offen" etc.)                       | PASS   | `customer-portal.ts` (Mapping vorhanden); UI in `CustomerBookingCard.tsx` |
| Empty-State "Sie haben noch keine Aufträge"                          | PASS   | `CustomerDashboard.tsx` (manuell geprüft, hat Empty-State)           |
| Auftragsauto-Zuordnung an Konto bei `POST /api/bookings`             | PASS   | `bookings/route.ts:285,295` (`customerId: customerSession?.customerId ?? null`) |

**isCancellable-Algorithmus deckt beide Modi (date+startTime UND slot.startsAt):**

```ts
// src/lib/cancellation.ts:32-40
export function bookingStartUTC(b) {
  if (b.date && b.startTime) return parseBerlinDateTime(b.date, b.startTime);
  if (b.slot?.startsAt) return new Date(b.slot.startsAt);
  return null;
}
```

PASS — IT3-Format (date+time) UND IT1/IT2-Slot-Format werden beide unterstützt. MAJOR-401 (DST) und MAJOR-404 (Null-Schutz) sind sichtbar adressiert.

---

### US-27 — Stornierung im Portal: **Done**

| Checkliste                                                          | Status | Evidenz                                                            |
| ------------------------------------------------------------------- | :----: | ------------------------------------------------------------------ |
| `POST /api/customer/bookings/:id/cancel` Ownership-Check (404 statt 403) | PASS | `cancel/route.ts:44-47`                                            |
| `isCancellable` server-seitig erneut geprüft (Authority)            | PASS   | `cancel/route.ts:50-64`                                             |
| 24h-Frist auf Berlin-Wall-Clock via `parseBerlinDateTime` (DST-fest) | PASS   | `cancellation.ts:23-25,53-75`                                      |
| Mail an Tom (`sendCancellationToAdmin`) fire-and-forget             | PASS   | `cancel/route.ts:77-105`                                           |
| Slot wird wieder freigegeben (`revalidateTag('slots')`)             | PASS   | `cancel/route.ts:107-112`                                           |
| Konflikt-Messages: zwei distincte Texte (Status / 24h)              | PASS   | `cancel/route.ts:52-57,59-63` — beide beinhalten Telefonnummer 0157-74787512 |

---

### US-28 — Stripe-Zahlung: **Done**

| Checkliste                                                          | Status | Evidenz                                                            |
| ------------------------------------------------------------------- | :----: | ------------------------------------------------------------------ |
| `POST /api/admin/bookings/:id/payment` legt Payment + sendet Mail   | PASS   | `admin/bookings/[id]/payment/route.ts:85-127`                      |
| Status-Check: nur CONFIRMED / COMPLETED erlaubt                     | PASS   | `admin/bookings/[id]/payment/route.ts:69-74`                       |
| `DELETE` nur für PENDING                                            | PASS   | `admin/bookings/[id]/payment/route.ts:180-186`                      |
| `POST /api/payments/webhook` prüft Stripe-Signatur                  | PASS   | `payments/webhook/route.ts:148-180`                                |
| Webhook idempotent (doppelter `checkout.session.completed` → kein Doppel-Mail) | PASS | `webhook/route.ts:51-54` (Status-Check vor Update) |
| Raw-Body via `req.text()` (NICHT json)                              | PASS   | `webhook/route.ts:169`                                              |
| Webhook-Events: completed / expired / payment_failed / refunded     | PASS   | `webhook/route.ts:182-199`                                          |
| `GET /api/payments/session-status` für Gäste-Polling                | PASS   | `payments/session-status/route.ts:20-62`; live-Test gibt 404 ohne PII zurück |
| Public-Endpoint, kein PII (nur `sessionId`, `status`, `paidAt`, `bookingId`) | PASS | `session-status/route.ts:53-58` |
| `STRIPE_NOT_CONFIGURED` → graceful degradation (kein Crash)         | PASS   | `stripe.ts:22-46`; `create-session/route.ts:47-53` (503-Antwort); `webhook/route.ts:158-165` |
| Admin-Payment-Endpoint funktioniert auch ohne Stripe (`stripeConfigured: false` im Body) | PASS | `admin/bookings/[id]/payment/route.ts:129-148` |
| `/konto/zahlung/[bookingId]` Seite vorhanden                        | PASS   | `src/app/konto/zahlung/[bookingId]/page.tsx`                       |
| `/konto/zahlung/erfolg` Seite vorhanden mit Polling-Client          | PASS   | `src/app/konto/zahlung/erfolg/page.tsx` + `PaymentSuccessClient`   |
| Cancel-Token-Fallback für Gäste                                     | PASS   | `create-session/route.ts:79-82`; Middleware lässt `?token=` durch (`middleware.ts:36-40`) |
| Stripe-Session: `payment_method_types: ['card', 'paypal']` + `locale: 'de'` | PASS | `create-session/route.ts:107-133` |

**Live-Verifikationen:**

```
POST /api/payments/webhook (no signature header)
→ 400 VALIDATION_ERROR  PASS

POST /api/payments/webhook (invalid signature, no STRIPE_WEBHOOK_SECRET set)
→ 503 STRIPE_NOT_CONFIGURED  PASS (graceful)

GET /api/payments/session-status?session_id=cs_test_xyz
→ 404 {"error":{"code":"NOT_FOUND","message":"Session nicht gefunden."}}  PASS

GET /api/payments/session-status?session_id=invalid
→ 400 VALIDATION_ERROR field=session_id  PASS
```

---

### US-29 — Reviews mit echtem Backend: **Done**

| Checkliste                                                          | Status | Evidenz                                                              |
| ------------------------------------------------------------------- | :----: | -------------------------------------------------------------------- |
| `POST /api/customer/reviews` erfordert COMPLETED                    | PASS   | `customer/reviews/route.ts:67-72`                                    |
| Doppel-Review verhindert (Prisma P2002 + DB-Check)                  | PASS   | `customer/reviews/route.ts:74-79,93-101`                             |
| Review wird mit `approved: false` angelegt                          | PASS   | `customer/reviews/route.ts:89`                                       |
| Rate-Limit: 5/h pro Customer                                        | PASS   | `ratelimit.ts:97`; `customer/reviews/route.ts:33-41`                  |
| `GET /api/reviews` gibt nur `approved=true` zurück                  | PASS   | `api/reviews/route.ts:54`                                            |
| Public-Name-Format "Maria M." (MAJOR-403-Fix)                       | PASS   | `api/reviews/route.ts:23-29` (`firstName + lastName.charAt(0) + '.'`) |
| `Cache-Control: public, max-age=60, stale-while-revalidate=300`     | PASS   | `api/reviews/route.ts:84-89`                                          |
| `GET /api/admin/reviews` zeigt volle Identität                      | PASS   | `admin/reviews/route.ts:26-31` (volltändiger Name)                    |
| `PATCH /api/admin/reviews/:id` (freigeben/ablehnen)                 | PASS   | `admin/reviews/[id]/route.ts:34-107`                                  |
| Idempotenz: gleicher Wert → keine DB-Schreibung                     | PASS   | `admin/reviews/[id]/route.ts:69-89`                                   |
| Review-Tab im Admin-Dashboard                                       | PASS   | `components/admin/AdminDashboard.tsx:13,77-90`                       |
| `/admin/reviews` Page (separater Pfad)                              | PASS   | `src/app/admin/reviews/page.tsx`                                     |
| `ReviewForm` im Kundenportal                                         | PASS   | `src/components/portal/ReviewForm.tsx` (Sterne + Text + Counter, a11y-konform) |
| `ReviewSection` lädt live von API mit statischem Fallback           | PASS   | `components/home/ReviewSection.tsx:37-49,52-54` — fällt auf `lib/reviews.ts` zurück, wenn `< REVIEW_MIN_APPROVED_TO_REPLACE_STATIC (4)` echte Reviews vorhanden sind |
| `REVIEW_MIN_APPROVED_TO_REPLACE_STATIC = 4`                         | PASS   | `zod-schemas.ts:1068`                                                 |

---

## Defekte

### BUG-IT4-QA-001 (MAJOR) — Verify-Redirect-Query-Param stimmt nicht mit der `/konto`-Seite überein

**Severity:** MAJOR
**Layer:** Frontend / Contract
**Story:** US-25 AC2 (Erfolgs-Feedback nach E-Mail-Verifikation)
**Routing-Hint:** `frontend-engineer` (oder Backend, je nach Fix-Stelle)

**Datei + Zeilen:**
- `src/app/api/customer/verify/route.ts:62`  →  `return redirectTo('/konto?verified=true');`
- `src/app/konto/page.tsx:34`                →  `const justVerified = searchParams.verified === '1';`
- `src/components/customer/LoginForm.tsx:115` →  `if (verifiedQuery === '1') { ... }`

**Problem:** Der Verify-Endpoint redirected mit `?verified=true`, sowohl die `/konto`-Server-Component als auch das `LoginForm` prüfen aber explizit auf `=== '1'`. Folge: Der Erfolgs-Banner ("Deine E-Mail-Adresse wurde bestätigt …") wird nach erfolgreicher Verifikation **niemals angezeigt**. AC2 fordert "wird mein Konto aktiviert und ich werde automatisch zu `/konto` weitergeleitet" — die Weiterleitung klappt, aber der Nutzer bekommt kein sichtbares Feedback, dass die Verifikation tatsächlich erfolgreich war.

Zudem entspricht der Spec-Text in `contracts/api-routes.md:1200`:
```
**Response:** 302 Redirect auf `/konto?verified=1` (mit Set-Cookie-Header bei Auto-Login).
```
Der Vertrag fordert also explizit `=1`, nicht `=true`.

**Reproduktion:**
1. Konto registrieren (`POST /api/customer/register`).
2. Verifikations-Token aus DB holen, `GET /api/customer/verify?token=<token>`.
3. Browser folgt Redirect zu `/konto?verified=true`.
4. Middleware schickt zu `/konto/login?callbackUrl=%2Fkonto%3Fverified%3Dtrue` (wegen fehlendem Auto-Login-Cookie).
5. Login-Form zeigt KEIN Erfolgs-Banner (`verifiedQuery` ist `'true'`, nicht `'1'`).
6. Nach Login folgt Redirect auf `/konto?verified=true` — auch dort kein Banner.

**Erwartet:** Sichtbares Erfolgs-Feedback nach Verifikation.

**Suggested Fix (eine der beiden Seiten anpassen, Backend ist die einfachere Stelle):**

```diff
- // src/app/api/customer/verify/route.ts:62
- return redirectTo('/konto?verified=true');
+ return redirectTo('/konto?verified=1');
```

(Spec-Text als Vertrag bevorzugen.)

---

### BUG-IT4-QA-002 (MINOR) — `verify-email`-Alias-Endpoint loggt Static-Render-Error

**Severity:** MINOR
**Layer:** Backend / Build-Hygiene
**Routing-Hint:** `backend-engineer`

**Datei + Zeile:** `src/app/api/customer/verify-email/route.ts:9`

**Problem:** Die Datei re-exportiert nur `GET` aus `../verify/route.ts`, ohne eigene `dynamic = 'force-dynamic'` und `runtime = 'nodejs'` Direktiven zu setzen. Bei `next build` versucht Next.js den Endpoint statisch zu rendern, schlägt mit `Dynamic server usage: Route /api/customer/verify-email couldn't be rendered statically because it used 'request.url'` fehl. Der Build-Fehler wird abgefangen, taucht aber als Stack-Trace im Build-Log auf:

```
[customer-verify] unexpected error: B [Error]: Dynamic server usage: Route /api/customer/verify-email couldn't be rendered statically because it used 'request.url'.
```

Funktional: Endpoint funktioniert zur Laufzeit korrekt (Live-Test redirected zu `/konto/login?error=invalid_token` für ungültige Tokens). Das Problem ist nur Log-Lärm.

Außerdem: dieser Alias ist nicht in `contracts/api-routes.md` spezifiziert — er ist Scope-Creep. Wenn er als Convenience-Alias bleiben soll, gehört er in den Vertrag.

**Suggested Fix:**

```ts
// src/app/api/customer/verify-email/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export { GET } from '../verify/route';
```

ODER entfernen, falls nicht im Vertrag.

---

### BUG-IT4-QA-003 (MINOR) — Edge-Runtime-Warnings durch `jose`

**Severity:** MINOR
**Layer:** Build-Hygiene
**Routing-Hint:** `backend-engineer`

**Datei:** `src/lib/customer-auth.ts:19` (`import { SignJWT, jwtVerify } from 'jose'`).

**Problem:** Bei `next build` werden zwei Warnings produziert:
```
A Node.js API is used (CompressionStream at line: 10) which is not supported in the Edge Runtime.
A Node.js API is used (DecompressionStream at line: 26) which is not supported in the Edge Runtime.
```

`jose` zieht intern `webapi/lib/deflate.js` ein (für JWE-Compression), den wir nicht nutzen — wir signieren nur HS256-JWTs. Tree-Shaking erfasst es trotzdem nicht, weil `jose` das ganze `webapi/index.js` exportiert.

**Workaround:** Direkter Import: `import { SignJWT } from 'jose/jwt/sign'` und `import { jwtVerify } from 'jose/jwt/verify'`. Beide Sub-Pfade vermeiden die Compression-Imports.

Funktional kein Bug — nur Log-Lärm.

---

### BUG-IT4-QA-004 (MINOR) — ESLint-Config wirft `Converting circular structure to JSON`

**Severity:** MINOR
**Layer:** DevOps / Build-Hygiene
**Routing-Hint:** `backend-engineer`

**Datei:** `.eslintrc.json` (Plugin-Config).

**Problem:** Beim Linting-Schritt im `next build`:
```
⨯ ESLint: Converting circular structure to JSON … property 'react' closes the circle
Referenced from: /Users/mikesiefert/Desktop/baerenstark/.eslintrc.json
```

Build läuft trotzdem durch (ESLint blockiert in der aktuellen Konfig nicht den Build), aber das Linting-Resultat ist effektiv `nicht ausgeführt`. Damit könnte schleichende Lint-Drift (ungenutzte Variablen, fehlende Hooks-Deps usw.) unbemerkt einsickern.

**Suggested Fix:** ESLint-Config auflösen — vermutlich kollidiert ein älterer Flat-Config-Export mit einem Legacy-Config-Pfad. `npm run lint` lokal laufen lassen und Fehlermeldung untersuchen.

---

## Spec-Compliance-Matrix

| §       | Vertrag                                                  | Implementierung                          | Status |
| ------- | -------------------------------------------------------- | ----------------------------------------- | :----: |
| §11     | `POST /api/customer/register` 201 + `verificationMailSent: true` | konform                          | PASS   |
| §11     | `POST /api/customer/login` 200 + Cookie + `redirectUrl` validiert | konform                            | PASS   |
| §11     | `GET /api/customer/me` 200 / 401                         | konform                                   | PASS   |
| §11     | `PATCH /api/customer/me` `.strict()` ohne `email`        | konform (BUG-402-Fix bestätigt)           | PASS   |
| §11     | `GET /api/customer/verify` 302 → `/konto?verified=1`     | **`?verified=true` statt `=1`**           | FAIL (BUG-IT4-QA-001) |
| §11     | `POST /api/customer/resend-verification` 200, neuer Token + Expiry | konform                          | PASS   |
| §11     | `POST /api/customer/forgot-password` / `reset-password`  | konform                                   | PASS   |
| §12     | `GET /api/customer/bookings` upcoming/past + isCancellable | konform (DST + Null-Schutz)             | PASS   |
| §12     | `GET /api/customer/bookings/:id` 404 wenn nicht ownership | konform                                  | PASS   |
| §12     | `POST /api/customer/bookings/:id/cancel` 200 / 404 / 409 | konform                                   | PASS   |
| §13     | `POST /api/admin/bookings/:id/payment` 201 + Payment + Mail | konform                                | PASS   |
| §13     | `DELETE /api/admin/bookings/:id/payment` nur PENDING     | konform                                   | PASS   |
| §13     | `POST /api/payments/create-session` Stripe-Session + Idempotenz | konform                            | PASS   |
| §13     | `GET /api/payments/session-status` öffentlich, kein PII   | konform (Pattern-Validierung + 404 ohne Hinweis) | PASS   |
| §13     | `POST /api/payments/webhook` Raw-Body + Signatur + Idempotenz | konform                            | PASS   |
| §14     | `POST /api/customer/reviews` COMPLETED + Ownership       | konform                                   | PASS   |
| §14     | `GET /api/reviews` only approved + Cache-Header          | konform                                   | PASS   |
| §14     | `GET /api/admin/reviews` mit voller Identität            | konform                                   | PASS   |
| §14     | `PATCH /api/admin/reviews/:id` Idempotenz                 | konform                                   | PASS   |
| §15     | `POST /api/bookings` mit `customerId` aus Session         | konform (`bookings/route.ts:285,295`)      | PASS   |
| §16     | `PATCH /api/bookings/:id` State-Machine inkl. COMPLETED   | nicht im QA-Scope dieser Iteration; Bestand-Tests grün |  —    |
| §17     | Endpoint-zu-Story-Matrix vollständig                      | 22/22 Endpoints implementiert             | PASS   |
| §18     | Frontend-Aufrufer-Mapping                                 | alle gelisteten Files vorhanden           | PASS   |
| §19     | ENV-Variablen `STRIPE_*`, `AUTH_SECRET`                   | sauber konsumiert mit Fallbacks           | PASS   |
| §20     | Rate-Limits                                               | alle Limiter in `ratelimit.ts:80-103` definiert + im Endpoint genutzt | PASS   |

---

## Empfehlungen für Iteration 5 / Backlog

1. BUG-IT4-QA-001 fixen (one-line patch in `verify/route.ts`).
2. `jose`-Sub-Path-Imports (BUG-IT4-QA-003) — saubere Edge-Builds, schnellere Cold-Starts.
3. ESLint-Config (BUG-IT4-QA-004) reparieren — sonst eskaliert Code-Hygiene-Drift.
4. `verify-email`-Alias entweder im Vertrag dokumentieren oder entfernen (BUG-IT4-QA-002).
5. **Auto-Login nach E-Mail-Verifikation**: Spec sagt "optional"; aktuelle Implementierung verzichtet darauf. UX wäre besser, wenn der Verify-Endpoint direkt das `customer-session`-Cookie setzt — sonst muss der Nutzer nach Klick auf Verify-Link nochmal manuell einloggen.
6. **E-Mail-Änderung im Profil**: derzeit per `.strict()`-Schema verhindert. Story für Iteration 5: Pending-State-Mechanismus (BUG-402-Backlog).

---

## Sign-off-Checklist

- [x] Alle kritischen / blockierenden Issues identifiziert (es gibt keine Blocker).
- [x] Alle Akzeptanzkriterien US-25 bis US-29 geprüft.
- [x] Contract-Compliance gegen `contracts/api-routes.md` §11–§20 verifiziert.
- [x] BUG-401, BUG-402, MAJOR-401, MAJOR-402, MAJOR-403, MAJOR-404, MAJOR-405 — alle Fixes sichtbar im Code und im Verhalten.
- [x] Build erfolgreich, TypeScript clean.
- [x] Live-Smoke-Tests gegen `localhost:3000` zeigen erwartetes Verhalten.

---

## Finales Urteil

**Approved with Fixes** — Iteration 4 ist funktional vollständig. BUG-IT4-QA-001 ist der einzige funktionale Defekt und braucht einen einzeiligen Patch. Die drei MINOR-Issues sind Polish/Hygiene und blockieren weder Release noch Folge-Iterationen.

Empfehlung an den Orchestrator: Patch für BUG-IT4-QA-001 anwenden, danach Iteration 4 als **Done** markieren. MINOR-Issues in den Iteration-5-Backlog übernehmen.
