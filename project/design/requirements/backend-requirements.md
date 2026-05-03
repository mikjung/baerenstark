# Backend Requirements — Iteration 7 (Auth-Stabilisierung & Email-Auth-Reversion)

> **Hinweis:** Diese Datei ist die IT7-spezifische Backend-Anforderungsspez.
> Quelle der Wahrheit: `ARCHITECTURE_IT7.md`. Vertrags-Schemas:
> `contracts/schema.prisma`, `contracts/api-routes.md` §23,
> `contracts/zod-schemas.ts`. F1/F2/F3-Garantien aus IT6 §17 bleiben
> **vollständig aktiv**.

## Overview

IT7 Backend-Eingriffe:

1. **Customer-Auth-Endpoints reaktivieren** (US-IT7-01, US-IT7-05): 6 in IT6
   D3-Fix gelöschte Routes wiederherstellen.
2. **NextAuth Customer-Konfig erweitern** (US-IT7-01): Credentials-Provider
   neben Google/Facebook hinzufügen, `debug:true` in Dev, Härtung der
   Config.
3. **Diagnose-Endpoint** (US-IT7-02 + US-IT7-03):
   `GET /api/auth/diagnose` (Dev-only, 404 in Prod) für Self-Service.
4. **Promote-Skript** (US-IT7-04): `scripts/promote-admin.ts` mit
   ENV-Guard.
5. **Schema-Migration** (`iteration_7_email_auth`): neue Tabelle
   `password_reset_tokens`, `customer_users.emailVerifiedAt` ergänzen,
   alte Reset-Felder entfernen.
6. **DTO-Garantie erweitern** (F3): `selectCustomerUserPublic()` schließt
   strukturell `passwordHash`/`verificationToken`/`oauthId` aus,
   CI-Scanner pflegt diese in der Blacklist.

## Tech Stack

Bestand (unverändert):

- **Runtime:** Node 20, Next.js 14 (App Router) Route Handlers
- **DB:** libSQL/Turso (SQLite-kompatibel) mit Prisma 5
- **Auth:** NextAuth v5 (zwei Instanzen — Admin + Customer)
- **Hashing:** bcryptjs (cost 12)
- **Token-Crypto:** Node `crypto` (`randomBytes`, `createHash('sha256')`)
- **Mails:** Resend (`src/lib/mail.ts`)
- **Rate-Limit:** Upstash Redis (`src/lib/ratelimit.ts`)
- **Validation:** Zod (`contracts/zod-schemas.ts` ↔ `src/lib/schemas.ts`)

Keine neuen Backend-Dependencies in IT7.

## Data Model

Verbindlich: `contracts/schema.prisma` (v1.7).

### Entity: `CustomerUser` (Update)

Neue/geänderte Felder:

| Feld                      | Typ          | Constraint          | Anmerkung                                                     |
| ------------------------- | ------------ | ------------------- | ------------------------------------------------------------- |
| `emailVerifiedAt`         | `DateTime?`  | nullable, neu       | Audit-Timestamp, wann verifiziert wurde. NULL solange unverifiziert. |
| `resetToken`              | —            | **entfernt**        | wandert nach `password_reset_tokens.tokenHash`.              |
| `resetTokenExpiry`        | —            | **entfernt**        | s.o.                                                          |
| `passwordResetTokens`     | Backref      | neu                 | `PasswordResetToken[]`.                                       |
| `passwordHash`            | `String?`    | bleibt              | bcrypt cost 12. Nullable für OAuth-only Konten.              |
| `emailVerified`           | `Boolean`    | bleibt              | Default false. Kein harter Login-Block.                       |
| `verificationToken`       | `String?`    | bleibt              | UNIQUE.                                                       |
| `verificationTokenExpiry` | `DateTime?`  | bleibt              | 24h nach Erstellung.                                          |

Indexe (alle bleiben aus IT6):
- `@@index([email])`
- `@@index([oauthProvider, oauthId])`
- `@@index([lastName, firstName])`
- `@@index([adminRating])`

### Entity: `PasswordResetToken` (NEU)

| Feld         | Typ          | Constraint                                    |
| ------------ | ------------ | --------------------------------------------- |
| `id`         | `String`     | `@id @default(cuid())`                        |
| `customerId` | `String`     | FK → `CustomerUser.id`, ON DELETE CASCADE     |
| `tokenHash`  | `String`     | UNIQUE, SHA-256 hex digest (64 chars)         |
| `expiresAt`  | `DateTime`   | createdAt + 1h                                 |
| `usedAt`     | `DateTime?`  | nullable, single-use                          |
| `createdAt`  | `DateTime`   | `@default(now())`                              |

Indexe:
- `@@unique([tokenHash])` (implizit durch `@unique`)
- `@@index([customerId, expiresAt])` — für künftige Cleanup-Jobs

### Entity: `User` (Admin) — unverändert

`scripts/promote-admin.ts` arbeitet auf bestehender Tabelle, kein
Schema-Eingriff.

## API Endpoints

### `GET /api/auth/diagnose` (NEU IT7, Dev-only)

- **Linked story:** US-IT7-02, US-IT7-03.
- **Auth:** keine.
- **Pre-condition:** `process.env.NODE_ENV !== 'production'` — sonst
  `notFound()` (404).
- **Response 200:** JSON mit Bool-Flags zu ENVs, Provider-Aktivität,
  erwarteten Callback-URLs (siehe `contracts/api-routes.md` §23.1).
- **Sicherheit:** Liefert **niemals** Secrets im Klartext. Nur Bool.
- **Errors:** 404 in Prod.

### `POST /api/customer/register` (Reaktivierung)

- **Linked story:** US-IT7-01.
- **Auth:** keine.
- **Body:** `CustomerRegisterSchema`.
- **Logic:**
  1. Rate-Limit Check (IP + Email).
  2. Zod-Parse.
  3. `prisma.customerUser.findUnique({ where: { email: lc } })` →
     409 `EMAIL_ALREADY_REGISTERED`, falls existiert.
  4. `bcrypt.hash(password, 12)`.
  5. `verificationToken = randomBytes(32).toString('base64url')`.
  6. `prisma.customerUser.create({ data: { …, passwordHash, emailVerified: false, verificationToken, verificationTokenExpiry: now+24h } })`.
  7. Mail via Resend (Verify-Link).
  8. Response: `{ data: toCustomerPublic(created) }` 201.
- **Errors:** 400 `VALIDATION_ERROR`, 409 `EMAIL_ALREADY_REGISTERED`,
  429 `RATE_LIMITED`.
- **DTO-Garantie:** Response wird via `CustomerUserPublicSchema.strict()`
  validiert. Kein `passwordHash`, kein `verificationToken` durchschlägt.

### `POST /api/customer/login` (Reaktivierung)

- **Linked story:** US-IT7-01.
- **Auth:** keine.
- **Body:** `CustomerLoginSchema`.
- **Logic (Engineer wählt zwischen Variante A und B aus
  `ARCHITECTURE_IT7.md` §4.2):**

  **Variante A — eigener Endpoint (empfohlen, einfacher):**
  1. Rate-Limit (IP + Email).
  2. Zod-Parse.
  3. Lookup `customer_users.findUnique({ where: { email: lc } })`.
     - Wenn nicht existiert: `bcrypt.compare(password, DUMMY_HASH)` (Timing-
       Schutz) → 401 `INVALID_CREDENTIALS`.
     - Wenn `passwordHash IS NULL`: 422 `OAUTH_ONLY_ACCOUNT`.
     - `bcrypt.compare(password, passwordHash)`. Mismatch → 401.
  4. `safeCustomerCallback(redirectUrl)` (Open-Redirect-Schutz).
  5. Cookie `customer-session` setzen (existing Helper in
     `lib/customer-auth.ts`).
  6. Response: `{ data: { …toCustomerPublic(user), redirectUrl } }`.

  **Variante B — NextAuth Credentials + Finalize:**
  Credentials-Provider in `customer-oauth.ts` `authorize()`-Callback,
  Redirect zu `/api/customer/oauth-finalize` setzt das langlebige
  Cookie. Frontend macht `signIn('credentials', …)`.

  Engineer dokumentiert die Wahl im PR-Body.
- **Errors:** 400, 401, 422, 429.

### `GET /api/customer/verify?token=…` (Reaktivierung)

- **Linked story:** US-IT7-01.
- **Auth:** keine.
- **Query:** `CustomerVerifyTokenQuerySchema`.
- **Logic:**
  1. Rate-Limit (IP).
  2. `findFirst({ where: { verificationToken: token, verificationTokenExpiry: { gt: new Date() } } })`.
  3. Bei Match: Update `emailVerified=true`, `emailVerifiedAt=now()`,
     `verificationToken=null`, `verificationTokenExpiry=null`. → 200.
  4. Sonst: 410 `INVALID_OR_EXPIRED_TOKEN`.
- **Errors:** 410, 429.

### `POST /api/customer/resend-verification` (Reaktivierung)

- **Linked story:** US-IT7-01.
- **Auth:** Customer-Session.
- **Logic:**
  1. Rate-Limit (Email).
  2. Wenn `emailVerified === true` → 409 `ALREADY_VERIFIED`.
  3. Neuen `verificationToken` generieren, `expiry = now+24h`.
  4. Update + Mail via Resend.
  5. → 200.
- **Errors:** 401, 409, 429.

### `POST /api/customer/forgot-password` (Reaktivierung — neue Implementierung)

- **Linked story:** US-IT7-05.
- **Auth:** keine.
- **Body:** `CustomerForgotPasswordSchema`.
- **Logic (verbindlich, Email-Enumeration-Schutz):**
  1. Rate-Limit (IP + Email).
  2. Zod-Parse.
  3. `findUnique({ where: { email: lc } })`.
  4. Wenn existiert:
     - `tokenPlain = randomBytes(32).toString('base64url')`.
     - `tokenHash = sha256Hex(tokenPlain)`.
     - `prisma.passwordResetToken.create({ data: { customerId, tokenHash, expiresAt: now+1h } })`.
     - `sendPasswordResetMail(email, firstName, tokenPlain)` via Resend.
  5. **Immer** `{ ok: true }` 200 zurückgeben — auch wenn nicht existiert.
- **Errors:** 400, 429.
- **Sicherheit:** Konstante Latenz simulieren (`bcrypt.compare` Dummy
  oder `sleep(150)`), wenn User nicht existiert.

### `POST /api/customer/reset-password` (Reaktivierung — neue Implementierung)

- **Linked story:** US-IT7-05.
- **Auth:** keine.
- **Body:** `CustomerResetPasswordSchema`.
- **Logic (atomar in `prisma.$transaction`):**
  1. Rate-Limit (IP).
  2. Zod-Parse.
  3. `tokenHash = sha256Hex(token)`.
  4. `tx.passwordResetToken.findUnique({ where: { tokenHash }, select: { id, customerId, expiresAt, usedAt } })`.
  5. Validate: `row && !row.usedAt && row.expiresAt > new Date()` → sonst 410.
  6. `bcrypt.hash(newPassword, 12)`.
  7. `tx.customerUser.update({ where: { id: row.customerId }, data: { passwordHash } })`.
  8. `tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } })`.
  9. → `{ ok: true }` 200.
- **Errors:** 400, 410 `INVALID_OR_EXPIRED_TOKEN`, 429.
- **Sicherheit:** Reset-Endpoint setzt **kein** Login-Cookie. Kunde muss
  sich neu einloggen — verhindert Session-Hijacking via gestohlenen Reset-
  Tokens. Antwort enthält **niemals** `customerUser`-DTO.

## Business Logic

### `src/lib/customer-oauth.ts` (Provider-Erweiterung)

- Provider-Liste erweitern um `Credentials`-Provider (siehe
  `ARCHITECTURE_IT7.md` §4.2). Engineer entscheidet Variante A oder B
  des Login-Endpoints (siehe oben).
- `debug: process.env.NODE_ENV === 'development'` ergänzen.
- `trustHost: true` bleibt.
- `secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET` bleibt.
- Cookie-Trennung zwischen Customer-NextAuth und Admin-NextAuth bleibt
  unangetastet.

### `src/lib/auth.ts` (Admin-NextAuth)

- `debug: process.env.NODE_ENV === 'development'` ergänzen.
- Kein anderer Eingriff.

### `src/lib/dto/user.ts` (DTO-Helper, F3-Erweiterung)

- `selectCustomerUserPublic()` bleibt strukturell wie heute (selektiert
  `passwordHash` für `hasPassword`-Ableitung, mappt aber raus).
- Doc-Block erweitern: `verificationToken`/`verificationTokenExpiry`
  werden NICHT selektiert.
- Keine Code-Änderung am Mapper — `toCustomerPublic()` produziert
  bereits `CustomerUserPublicSchema.strict()`-Output.

### `scripts/check-dto-leaks.ts`

- `FORBIDDEN_FIELDS`-Konstante erweitern um:
  ```ts
  const FORBIDDEN_FIELDS = [
    'adminNote',
    'adminRating',
    'passwordHash',
    'verificationToken',
    'oauthId',
  ];
  ```
- Test in `tests/architecture/no-customer-dto-leak.test.ts` läuft
  parameter-basiert über alle Felder.

### `scripts/promote-admin.ts` (NEU)

Spec siehe `ARCHITECTURE_IT7.md` §1.2.

Verbindlich:
- ENV-Guard `ALLOW_ADMIN_PROMOTE=true`, sonst exit(1).
- Args: `<email>` (Pflicht), `--password=<pwd>` (optional).
- Idempotent: bestehender User → Update auf ACTIVE; neuer User → Insert.
- Bei neuem User ohne `--password` → Random-Pwd generieren + ausgeben.
- Bei `--password` mit < 12 Zeichen → exit(1).
- Output: druckt Aktion + ggf. temporäres Klartext-Passwort.
- Niemals über HTTP erreichbar.

`scripts/README.md` erhält Quick-Start-Block (siehe
`ARCHITECTURE_IT7.md` §1.3).

### `src/lib/mail.ts` (Mail-Templates)

Neue Funktionen:

- `sendVerificationMail(email, firstName, tokenPlain)` — bereits in IT4
  vorhanden, ggf. nur reaktivieren / verifizieren.
- `sendPasswordResetMail(email, firstName, tokenPlain)` — NEU.
  Subject: „Passwort zurücksetzen — Bärenstark Hausservice".
  Body: deutsche Vorlage mit Reset-Link, Ablaufhinweis, Bärenstark-
  Branding (Logo, Markenfarben).

### `src/lib/ratelimit.ts` (Rate-Limit-Limiter ergänzen)

Neue Limiter-Instanzen (siehe `ARCHITECTURE_IT7.md` §8 für Tabelle):

- `customerRegisterLimiter` — 5/h IP.
- `customerRegisterEmailLimiter` — 3/h Email.
- `customerLoginIpLimiter` — 10/h IP.
- `customerLoginEmailLimiter` — 5/h Email.
- `forgotPasswordIpLimiter` — 3/15min IP.
- `forgotPasswordEmailLimiter` — 3/h Email.
- `resetPasswordIpLimiter` — 5/h IP.
- `verifyResendLimiter` — 3/h Email.

Ohne Upstash-Konfiguration sind alle Limiter No-Op (Dev-Mode-Fallback —
wie bestehend in IT5/IT6).

## Authentication & Authorization

### Customer

- **Mechanismus (ab IT7):** Email/Password (Credentials) + Google OAuth
  + Facebook OAuth.
- **Cookie:** `customer-session` (langlebig, JWT, signiert) — wird vom
  Login-Endpoint (Variante A) oder Finalize-Route (Variante B) gesetzt.
- **TTL:** existing (siehe `lib/customer-auth.ts`).
- **Kein Block bei `emailVerified=false`** (Vorentscheidung Orchestrator).

### Admin

- **Mechanismus:** Credentials (NextAuth v5), unverändert seit IT1.
- **Cookie:** `next-auth.session-token`.
- **DISABLED-Schutz:** F2-Garantie (IT6 §17.2) bleibt aktiv.
- **Lock-out-Recovery:** CLI-Skript `scripts/promote-admin.ts`.

### Auth-Trennung Customer ↔ Admin

| Pfad                                  | Instanz                | Cookie                                    |
| ------------------------------------- | ---------------------- | ----------------------------------------- |
| `/api/auth/[...nextauth]`             | `lib/auth.ts`          | `next-auth.session-token`                 |
| `/api/auth/customer/[...nextauth]`    | `lib/customer-oauth.ts`| `__customer-next-auth.session-token` (60s)|
| (eigener Login-Endpoint Variante A)   | `lib/customer-auth.ts` | `customer-session` (langlebig)            |

## Background Jobs

Keine in IT7. Cleanup von abgelaufenen `password_reset_tokens` ist
Backlog.

## External Integrations

| Integration | Verwendet von              | ENV                                                |
| ----------- | -------------------------- | -------------------------------------------------- |
| Resend      | Verify- + Reset-Mails      | `RESEND_API_KEY`, `MAIL_FROM`                      |
| Google OAuth| `customer-oauth.ts`        | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST` |
| Facebook OAuth| `customer-oauth.ts`      | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `NEXTAUTH_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST` |
| Upstash     | `ratelimit.ts`             | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (optional) |

## ENV-Variablen (IT7-Erweiterung)

Verbindlich, siehe `contracts/api-routes.md` §23.4 für vollständige Tabelle.
Neue Variable:

- `ALLOW_ADMIN_PROMOTE` — nur für `scripts/promote-admin.ts`.

`AUTH_SECRET` und `AUTH_TRUST_HOST` waren in IT6 schon dokumentiert,
werden in IT7 aber als **harte Pflichtchecks** im Diagnose-Endpoint und
im Runbook geführt.

## Non-functional Requirements

- **Security:**
  - bcrypt cost 12 (Tom-Convention seit IT1).
  - SHA-256-Hex auf Reset-Tokens — Klartext nie in DB.
  - Konstante Latenz auf Login + Forgot (Side-Channel-Schutz).
  - Email-Enumeration-Schutz auf `forgot-password`.
  - DTO-Helper + `.strict()`-Output garantiert keine
    `passwordHash`/`verificationToken`-Leaks.
- **Performance:** alle Auth-Endpoints p95 < 300ms (bcrypt cost 12 ist
  der dominante Block, ~150ms; Rest ist DB-Lookup + Mail-Async).
- **Availability:** Resend-Ausfall blockiert Registrierung **nicht**
  (User wird angelegt, Mail-Versand schlägt still fehl, Server-Log
  weist hin). User kann via `resend-verification` retry.
- **Logging:** NextAuth-`debug:true` in Dev. In Prod nur strukturierte
  Logs auf Auth-Fehler-Pfaden (kein Klartext-Token, kein Hash).
- **Observability:** `/api/auth/diagnose` ist die primäre
  Self-Service-Sicht.

## Story Coverage (Backend)

| Story        | Backend Deliverable                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| US-IT7-01    | 4 Endpoints (`POST /register`, `POST /login`, `GET /verify`, `POST /resend-verification`), Credentials-Provider, Schema-Migration `emailVerifiedAt`, Resend-Verify-Mail |
| US-IT7-02    | `GET /api/auth/diagnose` (Dev-only), `debug:true` in `customer-oauth.ts` + `auth.ts`, aktualisiertes Runbook, `npm run auth:check`-Skript     |
| US-IT7-03    | Diagnose-Endpoint (geteilt), Facebook-Provider-Härtung, Runbook-Abschnitt für Tom-Self-Service im Meta-Portal, `oauth_no_email`-Failure-Mode |
| US-IT7-04    | `scripts/promote-admin.ts` mit ENV-Guard, `scripts/README.md`, F1-Garantie aus IT6 §17.1 bleibt aktiv                                          |
| US-IT7-05    | 2 Endpoints (`POST /forgot-password`, `POST /reset-password`), neue Tabelle `password_reset_tokens`, Resend-Reset-Mail                        |

## File Inventory (Backend)

Neue Dateien:

```
src/app/api/customer/register/route.ts                      (REAKTIVIERT)
src/app/api/customer/login/route.ts                         (REAKTIVIERT)
src/app/api/customer/verify/route.ts                        (REAKTIVIERT)
src/app/api/customer/resend-verification/route.ts           (REAKTIVIERT)
src/app/api/customer/forgot-password/route.ts               (REAKTIVIERT, neue Logik)
src/app/api/customer/reset-password/route.ts                (REAKTIVIERT, neue Logik)
src/app/api/auth/diagnose/route.ts                          (NEU)
scripts/promote-admin.ts                                    (NEU)
scripts/README.md                                           (NEU oder UPDATE)
prisma/migrations/20260503090000_iteration_7_email_auth/migration.sql  (NEU)
```

Updates:

```
prisma/schema.prisma                                        (UPDATE — siehe Migration)
src/lib/customer-oauth.ts                                   (UPDATE — Credentials + debug)
src/lib/auth.ts                                             (UPDATE — debug)
src/lib/mail.ts                                             (UPDATE — sendPasswordResetMail)
src/lib/ratelimit.ts                                        (UPDATE — neue Limiter)
src/lib/dto/user.ts                                         (UPDATE — Doc-Block)
src/lib/schemas.ts                                          (UPDATE — neue Fehlercodes in ApiErrorSchema)
scripts/check-dto-leaks.ts                                  (UPDATE — Blacklist erweitern)
.env.example                                                (UPDATE — ALLOW_ADMIN_PROMOTE)
docs/AUTH_GOOGLE_FIX_RUNBOOK.md                             (UPDATE — TOP-5-Liste)
package.json                                                (UPDATE — `auth:check`-Skript)
```

## Migration-Plan

Datei: `prisma/migrations/20260503090000_iteration_7_email_auth/migration.sql`

```sql
-- 1. Neue Spalte emailVerifiedAt (nullable).
ALTER TABLE customer_users ADD COLUMN emailVerifiedAt DATETIME;

-- 2. Alte Reset-Felder entfernen (libSQL ≥ 3.35 unterstützt DROP COLUMN).
ALTER TABLE customer_users DROP COLUMN resetToken;
ALTER TABLE customer_users DROP COLUMN resetTokenExpiry;

-- 3. Neue Tabelle password_reset_tokens.
CREATE TABLE password_reset_tokens (
  id         TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  tokenHash  TEXT NOT NULL UNIQUE,
  expiresAt  DATETIME NOT NULL,
  usedAt     DATETIME,
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customer_users(id) ON DELETE CASCADE
);

CREATE INDEX password_reset_tokens_customerId_expiresAt_idx
  ON password_reset_tokens(customerId, expiresAt);
```

Roll-out:

1. Migration auf Staging gegen frische DB testen.
2. In Prod: Migration **vor** Deploy von Phase B (Customer-Auth-Code) ziehen.
3. CI: `tsx scripts/check-dto-leaks.ts` muss vor Merge grün sein.

## Test-Plan

Pflicht-Smoke (siehe `ARCHITECTURE_IT7.md` §12.1) — 12 Tests:
S1–S12 (CLI-Skript-Idempotenz, Login-Flows mit/ohne Verify, Forgot-
Password Email-Enumeration, Reset-Password TOCTOU, DTO-Leak, Diagnose-
Endpoint Dev/Prod).

Pressure (§12.2) — 6 Tests: Rate-Limits, parallele Reset-Token-Race,
Garbage-Token, Facebook-No-Email-Path.
