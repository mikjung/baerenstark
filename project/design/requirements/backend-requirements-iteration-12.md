# Backend Requirements — Iteration 12

> Source-of-Truth ist `ARCHITECTURE_IT12.md` (Repo-Root).
> Stack-Reminder: Next.js Route-Handlers, Prisma + Postgres (Neon),
> NextAuth v5 (Customer-OAuth + Admin-Credentials separat),
> Vercel Blob, Resend, Zod-Validation in `lib/schemas.ts`.

---

## Schritt 0 — Quick-Win VOR allem anderen: Prisma-Migration verifizieren

**Hypothese:** Drei Bug-Stories (S06, S12, S13) und Symptom-Bug S11
haben dieselbe Ursache: Migration `20260504100000_add_booking_cancellation_audit`
ist in Production nicht deployed.

**Aktion:**

```bash
# In sicherer Shell mit prod env:
npx prisma migrate status
# Erwartet: keine "Pending" Migrationen.
# Bei Pending:
npx prisma migrate deploy
```

Nach dem Deploy:

1. Vercel-Logs prüfen, dass die drei Endpoints (`/api/customer/bookings`,
   `/api/admin/upcoming-bookings`, `/api/bookings` admin-GET) wieder
   200 liefern.
2. Smoke-Tests:
   - Customer-Login → `/konto` → Buchungen sehen oder leere Liste.
   - Admin-Login → `/admin` → Upcoming Termine + Buchungsanfragen rendern.

**Falls die Migration BEREITS deployed war:** Vercel-Function-Stack-
Trace lesen, an Architect zurückmelden.

---

## Story-by-Story

### IT12-S01 — Google OAuth „Bad Request"

**Backend-Anteil (Code):** Keiner. Kein Code-Change in
`src/lib/customer-oauth.ts` oder `src/app/api/auth/customer/[...nextauth]/route.ts`.

**Konfiguration (Vercel + Google Cloud):** Siehe ARCHITECTURE §1.

**Verifikation:**

- Vercel Env: `NEXTAUTH_URL=https://www.baerenstark-hausservice.app`
- Vercel Env: `AUTH_SECRET` und `NEXTAUTH_SECRET` identisch und non-empty.
- Google Cloud: Authorized redirect URI exakt
  `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`.
- Test: Inkognito-Browser, Production-URL, „Mit Google anmelden".

---

### IT12-S03 — Buchungskalender langsam

**Endpoint:** `GET /api/availability/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`

**Datei:** `src/app/api/availability/calendar/route.ts` (lesen, profilen).

**Erwartetes Vorgehen:**

1. Query-Profile in Vercel-Logs / Neon-Slow-Query-Log einsehen.
2. Wenn der Endpoint in einer Schleife pro Tag eine `prisma.booking.findMany`
   ODER `prisma.dayOverride.findUnique` macht → in eine einzige Query
   konsolidieren:
   ```ts
   const dates = enumerateDates(from, to);          // String[] YYYY-MM-DD
   const [bookings, overrides, templates] = await Promise.all([
     prisma.booking.findMany({
       where: { date: { in: dates }, status: { in: ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'] } },
       select: { date: true, startTime: true, endTime: true, durationMinutes: true },
     }),
     prisma.dayOverride.findMany({ where: { date: { in: dates } } }),
     prisma.availabilityTemplate.findMany(),
   ]);
   ```
3. Aggregation in Memory pro Tag.

**Indexe (sind bereits vorhanden):**

- `bookings(date, status)` ✔
- `bookings(status, date, startTime)` ✔
- `day_overrides(date)` ✔ (mit @unique)
- `availability_template(dayOfWeek)` ✔

**Caching:**

- Response-Header: `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
- Tag-basierte Invalidation: `revalidateTag('availability')` in jedem
  POST/PUT-Endpoint, der Buchungen / Verfügbarkeit ändert.

**Test:** Unit-Test für die Aggregation; Integration-Test gegen
60-Tage-Range mit 100 Bookings → Response-Time < 300ms p95.

---

### IT12-S05 — Konto-Erstellung nach Gast-Buchung

**Neuer Endpoint:** `POST /api/customer/register-from-booking`

**Datei:** `src/app/api/customer/register-from-booking/route.ts` (NEU)

**Request-Schema (Zod):**

```ts
const RegisterFromBookingSchema = z.object({
  bookingId: z.string().min(1),
  confirmationToken: z.string().min(1),
  password: z.string().min(12).max(200),
});
```

**Logik:**

1. Rate-Limit (5/h/IP — gleicher Bucket wie `register`).
2. Validate Token: `verifyBookingConfirmationToken(token)` (existiert in
   `lib/booking-tokens.ts`). Muss zur `bookingId` passen.
3. Booking aus DB laden. Wenn nicht existiert → 404.
4. `customerEmail` aus der Booking auslesen. Wenn null → 400.
5. Prüfen, ob `CustomerUser` mit dieser E-Mail existiert:
   - Wenn ja → 409 CONFLICT, subcode `ACCOUNT_EXISTS`.
6. Sonst:
   - Passwort hashen (`bcryptjs`, cost 10).
   - Vorname/Nachname aus `booking.customerName` splitten (gleiches Pattern
     wie in `customer-oauth.ts.splitName`).
   - `prisma.customerUser.create({ ... emailVerified: true ... })`
     — der Confirmation-Token-Besitz beweist E-Mail-Zugang.
   - **Verknüpfung:** `prisma.booking.updateMany({
       where: { customerEmail: email, customerId: null },
       data: { customerId: newUser.id }
     })` → liefert `count`.
7. Customer-Session-Cookie setzen (gleicher Pfad wie `/api/customer/login`).
8. Response 201 mit `{ customerId, linkedBookingsCount }`.

**Auth:** Public Endpoint (Token validiert), kein Admin-Cookie.

**DB-Änderungen:** Keine neuen Tabellen.

**Test-Anforderungen:**

- Happy Path: Gast bucht, registriert mit Token → eingeloggt + Booking
  ist verknüpft.
- Token-Mismatch: 401.
- Konto existiert: 409.
- Mehrfache Bookings mit derselben E-Mail: alle werden verknüpft.

---

### IT12-S06 — Customer Bookings Endpoint

**Bug-Fix:** Migration deployen (siehe Schritt 0).

**Verifikation:** `GET /api/customer/bookings` muss für eingeloggten
Customer:
- 200 liefern.
- `{ upcoming: [], past: [] }` bei keinen Bookings.
- `cancelledAt` und `cancelledBy` korrekt aus DB lesen
  (`lib/cancellation.ts`).

**Defensives Refactor:** Kein Code-Change zwingend nötig.

---

### IT12-S07 — Login-State-Sync (Backend-Anteil)

**Endpoint:** `PATCH /api/customer/me`

**Verify, dass:**

- Endpoint NICHT die Session invalidiert.
- Endpoint NICHT den `customer-session`-Cookie regeneriert.
- Response 200 mit dem aktualisierten `CustomerUserPublic` (so dass
  Frontend den State aktualisieren kann ohne erneuten me-Call).

**Falls der Endpoint das Cookie irgendwo neu setzt:** Bug, korrigieren.

---

### IT12-S08 — Profil-Vorausfüllung (Backend-Anteil)

`GET /api/customer/me` muss alle relevanten Profilfelder liefern:
`firstName`, `lastName`, `email`, `phone`, `streetAndNumber`, `postalCode`,
`city`. Aktuelle DTO `CustomerUserPublic` (in `lib/dto/`) prüfen, dass
diese Felder enthalten sind.

---

### IT12-S10 — Bild-Upload (Backend-Anteil)

**Endpoint:** `POST /api/upload` (`src/app/api/upload/route.ts`)

**Bug-Fix:** Token-Konfiguration in Vercel verifizieren / regenerieren.
Kein Code-Change zwingend nötig — Implementierung ist sauber.

**Optional Refactor:** Im `catch (err)` von `put()` (Z. 248-256) den
`err.message` und `err.code` (falls Resend-/Vercel-Blob-spezifischer
Code) ins Log schreiben — erleichtert künftige Diagnose.

---

### IT12-S11 — Submission ohne Feedback (Backend-Anteil)

**Endpoint:** `POST /api/bookings`

**Verify, dass:**

- Bei Erfolg ein 201 mit `{ id, confirmationToken, ... }` zurück kommt
  (existiert).
- Bei eingeloggtem Customer: `revalidateTag('customer-bookings')` ODER
  ein vergleichbarer Cache-Invalidate, damit `/konto` die neue Anfrage
  sofort zeigt.
- POST-Endpoint reagiert nicht mit 500 wegen fehlender Migration
  (siehe Schritt 0).

---

### IT12-S12 + S13 — Admin Endpoints

**Bug-Fix:** Migration deployen. Kein Code-Change.

**Verifikation:**

- `GET /api/admin/upcoming-bookings` → 200 mit Array.
- `GET /api/bookings?status=PENDING` → 200 mit Array.

---

### IT12-S14 — Admin-Navigation (Backend-Anteil)

**Backend-Anteil:** Keiner. Reine Frontend/UX-Aufgabe. Hinweis:
sicherstellen, dass keine API-Pfade gebrochen werden — alle bestehenden
`/admin/*`-Server-Components rendern weiterhin korrekt nach dem
Layout-Refactor.

---

### IT12-S15 — Marketing-E-Mail (zentrales Feature)

#### 15.1 Datenmodell-Migration (NEU)

**Datei:** `prisma/migrations/20260504_<...>_marketing_emails/migration.sql`

```sql
-- Marketing-E-Mail-Audit
CREATE TABLE "marketing_emails" (
  "id" TEXT PRIMARY KEY,
  "sentByAdminId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "bodyHtml" TEXT,
  "filterServices" TEXT NOT NULL,    -- JSON-Array
  "recipientCount" INTEGER NOT NULL,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP,
  CONSTRAINT "marketing_emails_sentByAdmin_fk" FOREIGN KEY ("sentByAdminId") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "marketing_emails_sentByAdmin_createdAt_idx"
  ON "marketing_emails"("sentByAdminId", "createdAt");

-- Pro-Empfänger-Records
CREATE TABLE "marketing_email_recipients" (
  "id" TEXT PRIMARY KEY,
  "marketingEmailId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "resendMessageId" TEXT,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP,
  CONSTRAINT "mer_marketingEmail_fk" FOREIGN KEY ("marketingEmailId") REFERENCES "marketing_emails"("id") ON DELETE CASCADE,
  CONSTRAINT "mer_customer_fk" FOREIGN KEY ("customerId") REFERENCES "customer_users"("id") ON DELETE CASCADE
);
CREATE INDEX "mer_marketingEmail_status_idx"
  ON "marketing_email_recipients"("marketingEmailId", "status");
CREATE INDEX "mer_customer_idx"
  ON "marketing_email_recipients"("customerId");

-- Customer-Marketing-Preferences (Unsubscribe)
CREATE TABLE "customer_marketing_preferences" (
  "customerId" TEXT PRIMARY KEY,
  "unsubscribed" BOOLEAN NOT NULL DEFAULT FALSE,
  "unsubscribedAt" TIMESTAMP,
  "unsubscribeTokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL,
  CONSTRAINT "cmp_customer_fk" FOREIGN KEY ("customerId") REFERENCES "customer_users"("id") ON DELETE CASCADE,
  CONSTRAINT "cmp_token_unique" UNIQUE ("unsubscribeTokenHash")
);
```

`prisma/schema.prisma` entsprechend ergänzen (siehe ARCHITECTURE §14.1).

#### 15.2 Endpoints

**`GET /api/admin/customers/marketing-list?services=&search=&page=&limit=`**

Auth: Admin-Session.

Query-Params:
- `services` — Komma-getrennte Service-Slugs, optional.
- `search` — Such-String, optional (matcht E-Mail / firstName / lastName).
- `page`, `limit` — Pagination, defaults 1/50, max-limit 200.

Response:
```jsonc
{
  "data": [
    {
      "customerId": "...",
      "email": "...",
      "firstName": "...",
      "lastName": "...",
      "bookedServices": ["entruempelung", "reinigung"],
      "lastBookingAt": "2025-12-01T10:00:00Z",
      "completedBookingCount": 3,
      "unsubscribed": false
    }
  ],
  "total": 134,
  "page": 1,
  "limit": 50
}
```

Logik:
```ts
// Subquery: Customer-IDs mit relevanten COMPLETED-Bookings.
const matchingCustomerIds = await prisma.booking.findMany({
  where: {
    status: 'COMPLETED',
    customerId: { not: null },
    ...(services && { service: { in: services } }),
  },
  select: { customerId: true, service: true, createdAt: true },
});
// In-Memory Aggregation pro customerId → bookedServices, lastBookingAt.
// Dann findMany auf customer_users WHERE id IN (matchingIds).
// Search-Filter top-up.
// Join mit customer_marketing_preferences für unsubscribed-Flag.
```

**`POST /api/admin/marketing/email`**

Auth: Admin-Session.

Request:
```jsonc
{
  "subject": "string (1..200)",
  "body": "string (1..10000)",
  "recipientIds": ["customerId", ...],
  "filterServices": ["entruempelung", ...]
}
```

Logik:

1. Rate-Limit pro Admin (5/h).
2. Validate (Zod).
3. Resolve `recipientIds` → `CustomerUser[]` mit
   `customer_marketing_preferences` JOIN. Filter raus:
   `unsubscribed === true`.
4. `MarketingEmail.create({ ..., recipientCount: filtered.length })`.
5. Pro Empfänger ein `MarketingEmailRecipient`-Record (status PENDING).
6. **Async-Send:** Concurrency 5, sequentiell in Batches.
   ```ts
   const batches = chunk(filtered, 5);
   for (const batch of batches) {
     await Promise.allSettled(batch.map(r => sendOneMarketingMail(...)));
     await sleep(200);
   }
   ```
7. Pro Send: `resend.emails.send({ to, subject, html: renderHtml(...) })`,
   Result in `MarketingEmailRecipient` updaten.
8. Nach allen Sends: `MarketingEmail.update({ completedAt, successCount, failureCount })`.
9. Response 200 mit `{ marketingEmailId, intendedRecipients, actualRecipients, status: "completed" | "processing" }`.

Bei mehr als 50 Empfängern: Response sofort mit `status: "processing"`,
Frontend pollt `GET /api/admin/marketing/email/:id`.

**`GET /api/admin/marketing/email/:id`**

Auth: Admin-Session.

Liefert den aktuellen Status (Audit-Sicht):

```jsonc
{
  "id": "...",
  "subject": "...",
  "createdAt": "...",
  "completedAt": "...",
  "recipientCount": 60,
  "successCount": 58,
  "failureCount": 2,
  "status": "completed",
  "failedRecipients": [
    { "email": "x@y.de", "errorMessage": "Bounce: ..." }
  ]
}
```

**`GET /api/marketing/unsubscribe?token=…`** (PUBLIC)

Auth: Token-basiert.

Logik:

1. Token aus Query lesen, `sha256` davon bilden.
2. `customer_marketing_preferences.findUnique({ where: { unsubscribeTokenHash } })`.
3. Wenn nicht gefunden → 404 (rendert "Token ungültig oder abgelaufen"-Page).
4. Wenn gefunden: `update({ unsubscribed: true, unsubscribedAt: now() })`.
5. 302 Redirect auf `/marketing/abgemeldet?ok=1`.

#### 15.3 `lib/marketing-mail.ts` (NEU)

Verantwortung:
- HTML-Rendering aus Plaintext-Body (einfaches Template, mit Customer-
  Anrede {{firstName}} und Footer-Unsubscribe-Link).
- Unsubscribe-URL-Generierung.
- Resend-Send mit Concurrency 5.
- DSGVO-Footer (Pflichttext) ans Ende jeder Mail anhängen.

#### 15.4 `lib/marketing-tokens.ts` (NEU)

```ts
export function generateUnsubscribeToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}
```

Beim ersten Versand für einen Customer: Token generieren, in
`customer_marketing_preferences` speichern. Bei Folgesends derselbe
Token wiederverwenden.

#### 15.5 Test-Anforderungen

- Filter-Logik: nur Customer mit COMPLETED-Bookings im gewählten Service.
- Unsubscribe-Filter: ein abgemeldeter Customer wird beim Senden
  ignoriert, auch wenn explizit ausgewählt.
- Token-Verify: Falscher Token → 404. Gültig → Customer ist abgemeldet.
- Resend-Failure: ein Send schlägt fehl → andere laufen durch,
  `failureCount` korrekt.
- Rate-Limit: 6. Aufruf von `POST /api/admin/marketing/email` in 1h
  → 429.
- Audit: Nach Send liegen `MarketingEmail` + `MarketingEmailRecipient`-
  Records in der DB.

---

## Coverage Matrix (Backend)

| Story | Backend-Deliverable |
|-------|---------------------|
| IT12-S01 | Konfiguration (Vercel Env, Google Cloud) |
| IT12-S03 | Endpoint-Optimierung `/api/availability/calendar` |
| IT12-S05 | NEU: `POST /api/customer/register-from-booking` |
| IT12-S06/S11/S12/S13 | `prisma migrate deploy` (gemeinsame Wurzel) |
| IT12-S07 | Verify `PATCH /api/customer/me` invalidiert keine Session |
| IT12-S08 | Verify `GET /api/customer/me` liefert Adress-Felder |
| IT12-S10 | Konfiguration `BLOB_READ_WRITE_TOKEN` |
| IT12-S15 | 3 neue Models, 4 neue Endpoints, Resend-Integration |

---

## Open Items

- **NEEDS INPUT:** Resend-Tier (Free vs Pro) — Free hat 100 mails/day-Cap.
- **NEEDS INPUT:** Vercel-Plan (Hobby vs Pro) — Function-Timeout 10s vs 60s
  beeinflusst S15-Async-Send-Strategie.
- Nach Production-Migration: Vercel-Logs aktiv beobachten, ob noch
  unbekannte 500er auftreten.

---

## Post-QA Revision (2026-05-04)

> Diese Sektion überschreibt frühere Sektionen bei Konflikten. SSOT für
> Endpoints und DSGVO-Datenmodell. Vollständige Begründung siehe
> `ARCHITECTURE_IT12.md` §Phase-2-Revision (R.0-R.11).

### Stakeholder-Vorgaben (verbindlich)

- DSGVO: Variante 3 (UWG §7 Abs. 3) — kein Opt-In-Modell, sondern Opt-Out via Unsubscribe-Link + `unsubscribedAt`-Flag.
- Mail-Format: Plain-Text only.
- Resend: Free-Tier (100/Tag).
- Vercel: Hobby (10s Timeout). → **Hard-Cap 50 Empfänger pro Send.**

### S01 — NEXTAUTH_URL korrigiert

- `.env.production` ist im Repo bereits korrigiert auf `https://www.baerenstark-hausservice.app`.
- **DevOps muss Vercel-Production-Env-Vars `NEXTAUTH_URL` und `NEXT_PUBLIC_BASE_URL`** auf denselben Wert aktualisieren, sonst überschreibt Vercel beim nächsten Deploy nichts (Vercel-Env hat Priorität).
- Verifikation: Inkognito → `/konto/login` → „Mit Google anmelden" → kein 4xx.

### S05 — Endpoint final (überschreibt §S05 oben)

`POST /api/customer/register-from-booking`

- **Request:** `{ bookingId: string, confirmationToken: string, password: string (min 12, max 200) }`
- **Auth:** Public, Token-validiert (kein Cookie nötig).
- **Response 201:** `{ customerId, linkedBookingsCount }` + Set-Cookie `customer-session`.
- **Errors:**
  - 400 `VALIDATION_ERROR` (Zod-Fehler).
  - 401 `INVALID_TOKEN` (Token-Mismatch oder abgelaufen).
  - 404 `BOOKING_NOT_FOUND`.
  - 409 `CONFLICT` mit `subcode: ACCOUNT_EXISTS` (NICHT `EMAIL_EXISTS`).
  - 429 `RATE_LIMITED` (5/h/IP).

### S15 — Marketing-Endpoints final (überschreibt §15.2)

**Datenmodell-Update (überschreibt §14.1 in ARCHITECTURE_IT12 und §15.1 hier):**

```prisma
// CustomerUser bekommt 2 neue Felder (statt eigener Tabelle CustomerMarketingPreference):
model CustomerUser {
  // ... bestehende Felder ...
  unsubscribedAt        DateTime?  // NEU IT12-S15
  unsubscribedReason    String?    // NEU IT12-S15
}

// MarketingEmail + MarketingEmailRecipient unverändert (siehe §14.1).
// MarketingUnsubscribeToken-Tabelle entfällt — wir nutzen stateless HMAC-Tokens.
```

Migration-SQL (überschreibt `customer_marketing_preferences`-CREATE-TABLE in §15.1):

```sql
ALTER TABLE customer_users
  ADD COLUMN unsubscribedAt TIMESTAMP NULL,
  ADD COLUMN unsubscribedReason TEXT NULL;

CREATE INDEX customer_users_unsubscribedAt_idx
  ON customer_users(unsubscribedAt);
```

**Neuer Env-Var (für HMAC-Token):** `UNSUBSCRIBE_TOKEN_SECRET` (32+ Bytes Random). Separat von `BOOKING_TOKEN_SECRET`.

**Endpoints (SSOT — alle anderen früheren Pfade sind ungültig):**

| Endpoint | Method | Auth | Zweck |
|----------|--------|------|-------|
| `/api/admin/marketing/recipients` | GET | adminSession | Liste aller potentiellen Empfänger mit Filter |
| `/api/admin/marketing/emails` | POST | adminSession | Marketing-Mail anlegen (draft oder send) |
| `/api/admin/marketing/emails` | GET | adminSession | Historie (Liste) |
| `/api/admin/marketing/emails/{id}` | GET | adminSession | Detail + Audit |
| `/api/admin/marketing/emails/{id}/test-send` | POST | adminSession | Test an Admin-Email |
| `/api/admin/marketing/emails/{id}/send` | POST | adminSession | Bulk-Send (Hard-Cap 50) |
| `/api/customer/unsubscribe?token=...` | GET | Public (HMAC) | Public Unsubscribe |

**`GET /api/admin/marketing/recipients`** — Query-Params:
- `service` (string, optional) — Slug-Filter, z.B. `entruempelung`. Mehrere Services kommagetrennt.
- `hasBooked` (boolean, default `true`) — nur Customer mit mind. 1 COMPLETED-Booking.
- `unsubscribed` (boolean, default `false`) — wenn `false`: nur aktive; wenn `true`: nur abgemeldete; wenn nicht gesetzt: beide.
- `search` (string, optional) — Name/E-Mail.
- `page`, `limit` (default 1/50, max 200).

Response:
```jsonc
{
  "data": [
    {
      "customerId": "...",
      "email": "...",
      "firstName": "...",
      "lastName": "...",
      "bookedServices": ["entruempelung", "reinigung"],
      "completedBookingCount": 3,
      "lastBookingAt": "2025-12-01T10:00:00Z",
      "unsubscribedAt": null
    }
  ],
  "total": 134, "page": 1, "limit": 50
}
```

**`POST /api/admin/marketing/emails`** — Request:
```jsonc
{
  "subject": "string (1..200)",
  "body": "string (1..5000)",      // Plain-Text. Char-Cap 5000 (UX-Konsens).
  "recipientIds": ["customerId", ...],  // 1..50 (Hard-Cap)
  "filterServices": ["entruempelung", ...],  // Audit
  "status": "draft" | "send"       // 'draft' = nur anlegen; 'send' = direkt versenden
}
```

Wenn `status === 'send'`: führt sofort `POST .../{id}/send` aus.

Response 201:
```jsonc
{ "id": "marketing_email_id", "status": "draft" | "sent" | "partial_failure" | "failed" }
```

**`POST /api/admin/marketing/emails/{id}/test-send`** — kein Body. Sendet die Mail (draft) an `session.user.email`, ohne Audit-Records anzulegen. Response: `{ ok: true, sentTo: "tom@..." }`.

**`POST /api/admin/marketing/emails/{id}/send`** — Hard-Cap 50 Recipients. Synchroner Send (Concurrency 5 + 200ms-Throttle). Response:
```jsonc
{
  "id": "...",
  "intendedRecipients": 47,
  "actualRecipients": 45,        // 2 wegen unsubscribed gefiltert
  "successCount": 44,
  "failureCount": 1,
  "status": "partial_failure"    // 'sent' | 'partial_failure' | 'failed'
}
```

Bei > 50 Empfängern: 413 `RECIPIENT_CAP_EXCEEDED` (Frontend zeigt Hinweis „Bitte in mehreren Schüben senden"). Bei Resend-Outage: 502 `RESEND_ERROR`.

**Daily-Quota-Check:** Vor Send: Summe der `MarketingEmailRecipient.sentAt`-Records des aktuellen Tages prüfen. Wenn `current_day_sent + intended > 100` → 429 `DAILY_QUOTA_EXCEEDED` mit Body `{ remaining: number }`. Frontend zeigt verbleibendes Kontingent.

**`GET /api/customer/unsubscribe?token=...`** (PUBLIC):
- Token-Verify via `verifyUnsubscribeToken(token)` → liefert `customerId | null`.
- Wenn null → 302 → `/marketing/abgemeldet?error=invalid`.
- Sonst `update CustomerUser SET unsubscribedAt = now(), unsubscribedReason = 'EMAIL_FOOTER'` und 302 → `/marketing/abgemeldet?ok=1`.

### Idempotency-Key (S11/M8)

`POST /api/bookings` akzeptiert optional Header `Idempotency-Key: <UUID>`. Backend speichert `(key, customerEmail, responseHash, createdAt)` für 24h. Bei doppeltem Submit mit gleichem Key → cached Response 201 ohne neuen Insert. Tabelle `idempotency_keys` (id, key UNIQUE, response JSON, expiresAt, indexed).

### Performance-Targets (S03/M1)

- `GET /api/availability/calendar` p95 < 300ms (62-Tage-Range, 100 Bookings, kalter Cache, in der Region eu-west).
- DB-Indizes vor Build verifizieren: `bookings(date, status)`, `bookings(status, date, startTime)`, `day_overrides(date)` UNIQUE, `availability_template(dayOfWeek)`, NEU `customer_users(unsubscribedAt)`.

### Pflicht-Footer Marketing-Mails (DSGVO)

```
--
Sie erhalten diese E-Mail, weil Sie Kunde bei Bärenstark Hausservice
sind. Wenn Sie keine weiteren Marketing-Mails von uns erhalten möchten,
melden Sie sich hier ab: {unsubscribeUrl}

Bärenstark Hausservice · Tom Siefert · Darmstadt · Impressum: {baseUrl}/impressum
```

Backend hängt diesen Footer **immer und unveränderlich** an jede Marketing-Mail an (auch Test-Send). Frontend kann den Footer NICHT überschreiben.

### Coverage-Update Backend (Override)

| Story | Backend-Deliverable (final) |
|-------|------------------------------|
| IT12-S01 | `.env.production` ✓ + Vercel-Env-Update durch DevOps |
| IT12-S05 | `POST /api/customer/register-from-booking` (mit `confirmationToken`, 409 `ACCOUNT_EXISTS`) |
| IT12-S11 | + Idempotency-Key-Logik in `POST /api/bookings` |
| IT12-S15 | 2 neue Customer-Felder + 2 neue Tabellen, 6 Endpoints (Plural-`/emails/`-Konvention), HMAC-Unsubscribe-Token, Hard-Cap 50, DSGVO-Footer |
