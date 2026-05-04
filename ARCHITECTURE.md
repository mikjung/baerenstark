# Bärenstark Hausservice — Architektur (Stand IT12, 2026-05-04)

**Owner:** Tom Siefert (Inhaber)
**Konsolidiert von:** Solution Architect, 2026-05-04
**Dokument-Status:** Single Source of Truth. Frühere Iterations-Dateien
(`ARCHITECTURE_IT6.md` ... `ARCHITECTURE_IT12.md`) werden archiviert.
Bei Konflikten gilt dieses Dokument.

> Dieses Dokument beschreibt den **finalen Stand nach Iteration 12** als
> aktuelle Wahrheit. Iterations-Notizen in §11 erklären den historischen
> Kontext. Detail-Verträge (OpenAPI, Zod-Schemas) liegen unter
> `contracts/`. User-Stories sind die Truth in `PROJECT.md` /
> `project/user-stories/`.

---

## 1. Stack-Übersicht

| Layer            | Technologie                                                   |
|------------------|---------------------------------------------------------------|
| Frontend         | Next.js 14 App Router, TypeScript, TailwindCSS, React Hook Form + Zod |
| Backend          | Next.js Route Handlers (Node-Runtime), Zod-Validation          |
| ORM              | Prisma 5.22 — `provider = "sqlite"`                           |
| Datenbank Prod   | **Turso (libSQL)** — `baerenstark-prod`, `DATABASE_URL=libsql://…` |
| Datenbank Dev    | Lokales SQLite-File über Prisma                               |
| Admin-Auth       | NextAuth v5 (Credentials) auf `/api/auth/[...nextauth]`        |
| Customer-Auth    | NextAuth v5 (Google OAuth) auf `/api/auth/customer/[...nextauth]` + Custom-JWT-Cookie `customer-session` (E-Mail/Passwort, OAuth-Finalize) |
| Mail-Provider    | Resend (Free Tier: 100/Tag, 3 000/Monat)                      |
| File-Storage     | Vercel Blob (`@vercel/blob` 2.3.x), `BLOB_READ_WRITE_TOKEN`   |
| Hosting          | Vercel **Hobby Plan** (10 s Function-Timeout)                 |
| Domain           | `https://www.baerenstark-hausservice.app` (mit `www`!)         |
| Calendar-Lib     | FullCalendar 6 (`@fullcalendar/react`)                        |
| Charts           | Recharts (Analytics)                                          |
| Tokens           | `jose` (JWT) — Confirmation/Cancellation Tokens, transitive Dep über NextAuth |

**Kein Stripe in IT12 produktiv aktiv**: Das `Payment`-Modell und der
`/api/payments/*`-Pfad sind aus IT4 vorhanden; Stripe-API-Keys sind
operativ nicht gesetzt, der Buchungs-Flow ist payment-frei. Backlog.

---

## 2. Datenmodell

Alle Modelle liegen in `prisma/schema.prisma`. Geltende Grundsätze:

- SQLite kennt kein natives `ENUM` → Status-Felder sind `String`,
  Werte werden im App-Layer durch Zod-Schemas erzwungen
  (`contracts/zod-schemas.ts`).
- IDs sind durchgängig `cuid()`.
- Zeitstempel sind UTC (`DateTime` in Prisma → ISO 8601).
- Money: `Decimal?` für `Booking.finalPriceEur` (intern), `Int` (Cents) für `Payment.amount`.

### 2.1 Tabellen-Übersicht

| Tabelle                       | Zweck                                                                |
|-------------------------------|----------------------------------------------------------------------|
| `users`                       | Admins (NextAuth v5 Credentials). Status `ACTIVE`/`DISABLED`.        |
| `customer_users`              | Kunden-Account (E-Mail/Pw + Google-OAuth). Profil-Adresse, Marketing-Opt-Out. |
| `password_reset_tokens`       | SHA-256 Token-Hash, 1h-Ablauf, single-use (Customer-Reset).          |
| `slots`                       | Admin-erstellte Zeitslots (DEPRECATED ab IT3 zugunsten Date/Time-Modus, aber für Bestand erhalten). |
| `bookings`                    | Buchungen (PENDING/CONFIRMED/REJECTED/COUNTER_PROPOSED/CANCELLED/COMPLETED). |
| `booking_attachments`         | Datei-Anhänge zu Bookings (Vercel-Blob-URL).                         |
| `availability_template`       | Wochentag-Defaults (genau 7 Datensätze).                             |
| `day_overrides`               | Tagesgenaue Verfügbarkeits-Überschreibungen.                         |
| `weekly_availability`         | DEPRECATED ab IT3.                                                   |
| `payments`                    | Stripe-Zahlung 1:1 zu Booking (IT4 — operativ ruhend).               |
| `reviews`                     | Kundenbewertung 1..5 Sterne, Admin-Approval.                         |
| `buffer_config`               | Singleton — globaler Puffer in Minuten (Default 30).                 |
| `marketing_emails`            | IT12 — Audit pro versendeter Marketing-Mail.                         |
| `marketing_email_recipients`  | IT12 — pro Empfänger ein Record + Resend-Message-ID.                 |
| `idempotency_keys`            | IT12 — Cache für `Idempotency-Key`-Header bei `POST /api/bookings`.  |

### 2.2 Wichtige Felder & Beziehungen

**`User` (Admin)**
- `email` UNIQUE, `passwordHash`, `name`, `status` ('ACTIVE'|'DISABLED').
- Self-FK `createdById` (Audit), `lastLoginAt`.
- Relation: `moderatedReviews`, `marketingEmailsSent` (RESTRICT — Admin-Löschung darf Audit-Trail nicht brechen).

**`CustomerUser`**
- `email` UNIQUE, `passwordHash` NULLABLE (OAuth-only-Konten).
- `firstName`, `lastName`, `phone?`, `emailVerified`, `emailVerifiedAt?`.
- OAuth: `oauthProvider?`, `oauthId?`, `avatarUrl?`. Index `[oauthProvider, oauthId]`.
- Profil-Adresse (IT9): `streetAndNumber?`, `postalCode?` (5-stellig DE), `city?`.
- Admin-intern (IT6): `adminNote?`, `adminRating?` — NIEMALS customer-facing (DTO-Filter).
- Marketing (IT12 / DSGVO Variante 3): `unsubscribedAt?`, `unsubscribedReason?`. Sparse-Index auf `unsubscribedAt`.
- Indizes: `[email]`, `[lastName, firstName]`, `[adminRating]`, `[unsubscribedAt]`.

**`Booking`**
- IT3: Date/Time-Modus (`date`, `startTime`, `endTime`). Slot-Modus (`slotId`) deprecated, bleibt für Bestand.
- IT5: `durationMinutes` (Default 60), Adresse (`addressStreet?`, `addressZip?`, `addressCity?` — DB-nullable, API-Pflicht).
- IT4: optional `customerId?` → `CustomerUser` (`onDelete: SetNull`).
- IT6: `finalPriceEur Decimal?`, `finalPriceNote?` — INTERN, NIE customer-facing.
- IT11 (Audit-Storno): `cancelledAt?`, `cancelledBy?` ('CUSTOMER'|'ADMIN'|'SYSTEM'), `cancellationReason?`.
- Status-Werte: `PENDING` | `CONFIRMED` | `REJECTED` | `COUNTER_PROPOSED` | `CANCELLED` | `COMPLETED`.
- `cancelToken` UNIQUE — Tom→Kunde-Counter-Proposal-Antwort (IT2).
- `mailSent`, `mailError` für fire-and-forget Mail-Diagnose.
- Indizes: `[date, status]`, `[status, date, startTime]`, `[customerId, date]`, `[customerId, status]`, `[status, createdAt]`.

**`MarketingEmail` + `MarketingEmailRecipient`** (siehe §7)

**`IdempotencyKey`**
- Vom Frontend pro `POST /api/bookings` generiert (UUID), Header `Idempotency-Key`.
- TTL 24h. JSON-Response wird bei Re-Submit zurückgespielt.

### 2.3 Migrations-Workflow (Turso libSQL!)

**Wichtige Eigenheit:** Prisma `migrate deploy` funktioniert **nicht**
gegen `libsql://`-URLs (`prisma migrate` versteht nur native SQLite-Files
und Postgres/MySQL). Die Migrationen werden in Production stattdessen
direkt per Turso-Shell ausgerollt:

```bash
turso db shell baerenstark-prod < prisma/migrations/<id>/migration.sql
```

**Ablauf in Production:**

1. Migration lokal erstellen (`npx prisma migrate dev --name <id>`).
2. Migration in den passenden `prisma/migrations/`-Ordner committen.
3. SQL in einer kontrollierten Shell gegen Turso ausführen:
   `turso db shell baerenstark-prod < prisma/migrations/<id>/migration.sql`.
4. `_prisma_migrations`-Tabelle manuell mit dem Migration-Eintrag erweitern,
   damit `prisma migrate status` (Dev) keinen Drift mehr meldet.
5. Vercel re-deploy → Prisma-Client kennt das neue Schema, App läuft mit den neuen Spalten.

Aktuelle Migrationen (in Reihenfolge):

```
20260502000000_init
20260502000001_active_booking_per_slot
20260502122601_iteration2
20260502122700_iteration2_active_booking_index_v2_and_seed_availability
20260502180205_iteration3
20260502180206_iteration3_indexes_and_seed
20260502194905_iteration4
20260502235443_iteration5
20260503000000_admin_password_reset
20260503000001_iteration5_indexes_and_seed
20260503083723_iteration_6
20260503090000_iteration_7_email_auth
20260503163821_add_customer_address
20260504100000_add_booking_cancellation_audit
20260504120000_iteration_12_marketing
```

---

## 3. API-Verträge (Übersicht)

Detail-Verträge: `contracts/api-routes.md`,
`contracts/iteration-12.openapi.yaml`,
`contracts/bookings-cancel.openapi.yaml`. Hier nur die Endpoint-Liste mit
einer Zeile Zweck. Auth-Spalten:

- **Public** = ohne Auth.
- **Public (Token)** = HMAC/JWT-Token im Query-Param.
- **CustomerSession** = Cookie `customer-session` (Custom-JWT, 7d).
- **AdminSession** = NextAuth-v5-Session-Cookie + `requireActiveAdmin()`.

### 3.1 Public

| Path                                              | Method | Zweck                                                      |
|---------------------------------------------------|--------|------------------------------------------------------------|
| `/api/availability/calendar?from&to`              | GET    | Tages-Verfügbarkeitsstatus für 62-Tage-Range (Calendar-UI). |
| `/api/slots/available?date&duration?`             | GET    | Slot-Liste für ein Datum, optional gefiltert auf Dauer.     |
| `/api/bookings`                                   | POST   | Neue Buchung anlegen (Gast oder Kunde). Akzeptiert `Idempotency-Key`-Header. |
| `/api/bookings/[id]/public-summary?token`         | GET    | Read-only-Buchungsdetails — Token-Scope `booking-confirmation` ODER `booking-cancellation`. Auch per CustomerSession-Cookie. |
| `/api/bookings/[id]/cancel?token?`                | POST   | Storno (Token oder CustomerSession). Idempotent. Audit-Felder. |
| `/api/bookings/respond?token`                     | GET    | Tom→Kunde-Counter-Proposal-Antwort (legacy `cancelToken`).  |
| `/api/customer/register`                          | POST   | Self-Service-Registrierung (E-Mail/Pw).                    |
| `/api/customer/register-from-booking`             | POST   | Konto aus Anfrage anlegen (Token-gated mit Confirmation-Token). |
| `/api/customer/login`                             | POST   | E-Mail/Pw-Login → setzt `customer-session`-Cookie.         |
| `/api/customer/logout`                            | POST   | Cookie löschen.                                            |
| `/api/customer/verify`                            | GET    | E-Mail-Verifikation (Token).                               |
| `/api/customer/resend-verification`               | POST   | Verifikations-Mail nochmal anfordern.                      |
| `/api/customer/forgot-password`                   | POST   | Reset-Mail anfordern (E-Mail-Enumeration-Schutz, 750 ms Floor). |
| `/api/customer/reset-password`                    | POST   | Token einlösen, neues Passwort setzen.                     |
| `/api/customer/oauth-finalize`                    | GET    | Setzt `customer-session`-Cookie nach NextAuth-OAuth-Callback. |
| `/api/customer/unsubscribe?token`                 | GET    | DSGVO-Unsubscribe via stateless HMAC-Token (302-Redirect).  |
| `/api/auth/customer/[...nextauth]`                | GET/POST | NextAuth Customer (Google OAuth).                        |
| `/api/auth/[...nextauth]`                         | GET/POST | NextAuth Admin (Credentials).                            |
| `/api/auth/diagnose`                              | GET    | Diagnose-Endpoint (Dev/ENV-gated).                          |
| `/api/upload`                                     | POST   | Multipart-Upload, Magic-Bytes-Check, Vercel-Blob.           |

### 3.2 Customer

| Path                                              | Method | Zweck                                                      |
|---------------------------------------------------|--------|------------------------------------------------------------|
| `/api/customer/me`                                | GET    | Eigenes Profil (inkl. Adress-Felder).                      |
| `/api/customer/me`                                | PATCH  | Profil aktualisieren (firstName, lastName, phone, Adresse). E-Mail-Wechsel NICHT erlaubt. |
| `/api/customer/bookings`                          | GET    | `{ upcoming, past }` mit `isCancellable`-Flag pro Booking. |
| `/api/customer/bookings/[id]`                     | GET    | Booking-Detail (incl. Anhänge).                            |
| `/api/customer/bookings/[id]/cancel`              | POST   | Customer-Storno (eingeloggt). Delegiert an `/api/bookings/[id]/cancel`. |
| `/api/customer/reviews`                           | POST   | Bewertung anlegen (zu COMPLETED-Booking).                  |

### 3.3 Admin

| Path                                              | Method  | Zweck                                                      |
|---------------------------------------------------|---------|------------------------------------------------------------|
| `/api/admin/setup`                                | POST    | Bootstrap-Allowlist: nur wenn `count(users) === 0`. Sonst 410 GONE. |
| `/api/admin/admins`                               | GET/POST | Admin-Liste / neuen Admin anlegen.                        |
| `/api/admin/admins/[id]`                          | PATCH/DELETE | Admin-Status ändern, Lock-out-Schutz (atomarer Conditional-Update). |
| `/api/admin/users?search&page&pageSize&sort`      | GET     | Customer-Liste mit Pagination, Filter, Sort (Whitelist). Response `{ data: { items, total, page, pageSize } }`. |
| `/api/admin/users/[id]`                           | GET/PATCH/DELETE | Customer-Detail, Admin-Note/Rating, DSGVO-Delete.   |
| `/api/admin/bookings` (alias `/api/bookings` admin GET) | GET | Buchungs-Liste für Tom.                              |
| `/api/admin/upcoming-bookings`                    | GET     | Bevorstehende Termine (Status PENDING/CONFIRMED, future).  |
| `/api/admin/bookings/[id]`                        | PATCH   | Status, finalPriceEur, finalPriceNote, adminNote.          |
| `/api/admin/bookings/[id]/payment`                | POST    | Stripe-Session anlegen (operativ ruhend).                  |
| `/api/admin/calendar/events?from&to`              | GET     | FullCalendar-Events (admin-Sicht).                          |
| `/api/admin/availability-template`                | GET/PUT | Wochentag-Defaults (7 Datensätze).                         |
| `/api/admin/day-overrides?from&to`                | GET/POST/DELETE | Tagesgenaue Overrides.                              |
| `/api/admin/buffer-config`                        | GET/PUT | Singleton-Buffer in Minuten (Whitelist 0/15/30/45/60).     |
| `/api/admin/reviews?status`                       | GET     | Moderation-Queue (PENDING/APPROVED/REJECTED).              |
| `/api/admin/reviews/[id]`                         | PATCH   | Approve/Reject (setzt `moderatedAt`, `moderatedById`, `rejectedAt`). |
| `/api/admin/analytics`                            | GET     | Aggregierte Stats (Umsatz, Top-Kunden). ISR `revalidate: 300`. |
| `/api/admin/forgot-password` / `reset-password`   | POST    | Admin-Passwort-Reset.                                       |
| `/api/admin/marketing/recipients?service&search&page&limit` | GET | Empfänger-Liste mit Service-Filter (nur COMPLETED-Bookings). |
| `/api/admin/marketing/emails`                     | GET/POST | Marketing-Mail-Liste / Draft anlegen.                      |
| `/api/admin/marketing/emails/[id]`                | GET     | Detail (inkl. failedRecipients).                           |
| `/api/admin/marketing/emails/[id]/test-send`      | POST    | An eigene Admin-Mail senden (kein Audit-Insert).           |
| `/api/admin/marketing/emails/[id]/send`           | POST    | Bulk-Send (Hard-Cap 50 Empfänger). Synchron + State-Machine. |
| `/api/payments/session-status?session_id`         | GET     | Stripe-Session-Polling für Erfolgsseite (Gäste-tauglich).  |

### 3.4 Integrations-Konventionen

- **Transport:** REST/JSON über HTTPS.
- **Envelope:**
  - Single: `{ "data": <object> }`.
  - List + Pagination: `{ "data": { "items": [...], "total": N, "page": N, "pageSize": N } }`.
  - Error: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details"?: ... } }`.
- **Auth-Header / Cookie:** `customer-session` (Custom-JWT, 7d) oder NextAuth-Session-Cookie.
- **Token-Query:** `?token=<jwt|hmac>` für public-Token-gated Routes.
- **Idempotency:** `Idempotency-Key`-Header (UUID, 24h-Cache) bei `POST /api/bookings`.
- **Datumsformat:** ISO 8601, UTC. Zeit-Vergleiche in Berlin-Zeitzone via `parseBerlinDateTime()` (DST-fest).
- **IDs:** `cuid()` (kein UUID).
- **Fehlercodes (Auswahl, nicht abschließend):**
  `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `TOKEN_EXPIRED` (401),
  `TOKEN_INVALID` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
  `CONFLICT` (409, subcodes z. B. `ACCOUNT_EXISTS`, `SLOT_TAKEN`),
  `FILE_EMPTY` / `FILE_TOO_LARGE` / `FILE_TYPE_MISMATCH` (400/413),
  `RECIPIENT_CAP_EXCEEDED` (413), `RATE_LIMITED` (429), `BLOB_NOT_CONFIGURED` (503),
  `OAUTH_ONLY_ACCOUNT` (422), `OAUTH_UNVERIFIED_CONFLICT` (422),
  `RESEND_ERROR` (502).

---

## 4. Modulare Architektur

```
src/
├── app/                       # Next.js App Router
│   ├── (public)               # Hero, Service-Grid, Reviews-Block
│   ├── services/[slug]/       # Service-Detailseite (mit Hero-Bild — IT12)
│   ├── buchung/               # Inline-Buchungs-Flow (Fallback)
│   │   ├── BookingClient.tsx
│   │   ├── bestaetigung/[bookingId]/   # Initial-Confirmation (IT11)
│   │   ├── bestaetigt/                 # Counter-Proposal-Antwort (IT2 — separat!)
│   │   ├── [id]/stornieren/            # Gast-Storno-Page (IT11)
│   │   └── storno/                     # Counter-Proposal-Storno-Erfolg
│   ├── konto/                 # Customer-Portal
│   │   ├── login, registrieren, profil
│   │   ├── passwort-vergessen, passwort-zuruecksetzen
│   │   └── anfragen/[id]/
│   ├── admin/                 # Admin-Portal
│   │   ├── calendar/, users/, admins/, analytics/, reviews/
│   │   └── marketing/         # IT12 — Marketing-Composer + Historie
│   ├── marketing/abgemeldet/  # Public Bestätigungsseite Unsubscribe
│   └── api/                   # Route-Handlers (siehe §3)
│
├── components/
│   ├── booking/               # BookingForm, BookingCalendar, TimeSlotPicker, DurationPicker
│   │                          # QuickBookingModal, BookingDialogProvider, FileUpload
│   │                          # CancelConfirmationDialog
│   ├── calendar/              # AppCalendar (FullCalendar-Wrapper)
│   ├── admin/                 # AdminLayout (3-Gruppen-Sidebar — IT12), BookingTable,
│   │                          # AdminCalendarView, UserTable, ReviewTable, AnalyticsView
│   │   └── marketing/         # MarketingEmailComposer, RecipientPicker
│   ├── customer/              # ProfileForm, BookingsList
│   ├── home/                  # Hero, ServiceGrid, ServiceDetailModal
│   ├── layout/                # Header, Footer
│   └── seo/                   # ServiceHeroImage, JSON-LD-Helpers
│
└── lib/
    ├── prisma.ts              # Prisma-Client-Singleton
    ├── api.ts                 # apiSuccess(), apiError(), internalError(), envelope-helpers
    ├── api-client.ts          # Customer-fetch-Helper (credentials: 'include')
    ├── api-client-it6.ts      # Admin-Helper (typed)
    ├── auth.ts                # NextAuth Admin (v5)
    ├── auth.config.ts
    ├── auth-diagnose.ts       # /api/auth/diagnose-Logik
    ├── customer-auth.ts       # E-Mail/Pw-Helper (bcryptjs)
    ├── customer-auth-server.ts # getCustomerFromRequest()
    ├── customer-oauth.ts      # NextAuth Customer (Google OAuth)
    ├── customer-session.ts    # Custom-JWT-Cookie sign/verify
    ├── customer-sync.ts       # IT12 — EventTarget-Bus für Header-Re-Render
    ├── use-customer.ts        # Client-Hook (useCustomer())
    ├── customer-portal.ts
    ├── booking-create.ts      # Serializable-Tx, Overlap-Check, Buffer-Check
    ├── booking-tokens.ts      # signBookingConfirmationToken / Cancellation (jose, JWT, 30d)
    ├── cancellation.ts        # isCancellable() (24h-Frist, Status-Whitelist)
    ├── availability.ts
    ├── calendar-range.ts
    ├── calendar.ts
    ├── time-utils.ts          # Berlin-Zeitzone, DST-fest
    ├── buffer-config.ts
    ├── services.ts            # SERVICES-Konstante (slug → label, priceFrom)
    ├── service-images.ts      # IT12 — slug → /public/<image>.png Mapping
    ├── reviews.ts
    ├── analytics.ts
    ├── mail.ts                # Resend-Wrapper, Templates (Plain-Text)
    ├── marketing-mail.ts      # IT12 — Plain-Text + DSGVO-Footer-Render
    ├── marketing-bulk-send.ts # IT12 — Promise-Pool, Concurrency 5, Throttle
    ├── marketing-tokens.ts    # IT12 — HMAC-deterministisch, stateless
    ├── marketing/             # Builder/Helper
    ├── idempotency.ts         # IT12 — Idempotency-Key-Cache
    ├── ratelimit.ts
    ├── require-admin.ts       # requireActiveAdmin() (Status-Check)
    ├── admin-status.ts        # disableAdminSafely() — Conditional-UPDATE
    ├── stripe.ts              # ruhend
    ├── format.ts, contact.ts, baseUrl.ts, scroll-into-view.ts (IT12), toast.ts
    ├── seo/
    └── dto/
        └── user.ts            # selectCustomerUserPublic / Admin (DTO-Trennung)
```

### 4.1 Conventions

- **DTO-Trennung:** `customer_users` darf NIEMALS direkt aus
  `prisma.findMany()` an Customer-facing-Routes durchgereicht werden.
  `selectCustomerUserPublic()` (filtert `adminNote`, `adminRating`,
  `passwordHash`) vs. `selectCustomerUserAdmin()`. CI-Test
  `tests/architecture/no-internal-sort-in-customer.test.ts` blockt
  Drift.
- **Envelope:** Alle JSON-Responses durch `apiSuccess(...)` /
  `apiError(...)` aus `src/lib/api.ts`. Listen mit Pagination
  verwenden `{ items, total, page, pageSize }` als inneres Objekt.
- **`internalError(err, route)`** loggt mit `console.error('[route] ...')`,
  gibt 500 + `{ code: 'INTERNAL_ERROR', message: 'Interner Serverfehler' }`
  zurück. Niemals Stack-Trace an den Client.
- **Microcopy:** Niemals "Interner Serverfehler" pur — UI-Layer
  übersetzt zu "Bitte später erneut versuchen oder anrufen: 0157 74787512".
- **Auth-Server-Helpers:** `requireActiveAdmin()` (redirected zu
  `/admin/login` bei DISABLED), `getCustomerFromRequest()`
  (returns `null` wenn keine Session).
- **Server vs. Client:** Server-Components fetchen über `prisma`
  direkt; Client-Components über `api-client.ts` mit
  `credentials: 'include'` und `cache: 'no-store'`.

---

## 5. Auth-Architektur

### 5.1 Admin (`/admin/*`)

- **Provider:** NextAuth v5 mit `Credentials`-Provider (E-Mail + Passwort, bcryptjs).
- **Routen:** `/admin/login`, NextAuth-Handler unter `/api/auth/[...nextauth]`.
- **Helper:** `requireActiveAdmin()` (`src/lib/require-admin.ts`) prüft
  Session + `User.status === 'ACTIVE'`. Bei `DISABLED` →
  Redirect mit `?error=account_disabled`. Edge-Middleware kann den
  Status nicht prüfen (kein Prisma in Edge-Runtime), die Prüfung
  läuft im Page-Loader / Route-Handler.
- **Bootstrap:** `/api/admin/setup` antwortet mit 410 GONE, sobald
  `count(users) >= 1`. Lock-out → CLI-Skript
  `scripts/promote-admin.ts` mit `ALLOW_ADMIN_PROMOTE=true`-ENV-Guard.
- **Multi-Admin (IT6):** Self-Service-Page `/admin/admins`. Letzter aktiver
  Admin darf sich nicht selbst sperren — atomarer Conditional-UPDATE
  in `disableAdminSafely()`.

### 5.2 Customer (`/konto/*`)

Zwei parallele Eingangswege, ein gemeinsamer Session-Cookie:

1. **E-Mail/Passwort** (IT4 + IT7):
   `POST /api/customer/login` → bcryptjs-Verify →
   `setCustomerSessionCookie()` (Custom-JWT, 7d, HttpOnly, SameSite=Lax).
2. **Google OAuth** (IT5 + IT12-Bugfix):
   - NextAuth-Customer-Handler unter `/api/auth/customer/[...nextauth]`
     (separat von Admin-NextAuth, eigener Cookie-Namespace
     `__customer-next-auth.*`, eigener Secret).
   - Nach erfolgreichem Provider-Callback → Redirect zu
     `/api/customer/oauth-finalize`, dort wird der CustomerUser
     gefunden/angelegt (Account-Linking via E-Mail) und das
     `customer-session`-Cookie gesetzt.
   - **CRITICAL** (IT12): `NEXTAUTH_URL` und `NEXT_PUBLIC_BASE_URL`
     müssen exakt `https://www.baerenstark-hausservice.app` sein
     (mit `www`, ohne Trailing-Slash). Domain-Apex wird per 301 auf
     `www.` umgeleitet. Google-Console-Authorized-Redirect-URI exakt
     `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`.

**Account-Linking-Sicherheit (IT5 BUG-IT5-004):**
- Verifiziertes lokales Konto + OAuth same email → automatische Verknüpfung.
- Unverifiziertes lokales Konto → KEINE automatische Verknüpfung,
  Fehler `OAUTH_UNVERIFIED_CONFLICT` (422).

**Passwort-Reset:**
- `password_reset_tokens` (SHA-256-Hash, 1h-Ablauf, single-use).
- Atomarer Token-Verbrauch via Conditional-UPDATE.
- E-Mail-Enumeration-Schutz: `forgot-password` antwortet konstant 200
  mit 750 ms-Latenz-Floor.

### 5.3 Session-Sync (IT12)

- `useCustomer()` (`src/lib/use-customer.ts`) ist ein Client-Hook ohne
  globalen Store; jede Component-Instanz fetcht `GET /api/customer/me`
  beim Mount.
- Bei Network-Fehler bleibt der vorherige State erhalten (kein
  Fallback auf `unauthenticated` — IT12-S07-Fix).
- Globaler Event-Bus `src/lib/customer-sync.ts` (EventTarget-basiert):
  ```ts
  emitCustomerChanged()  // bei Login/Logout/Profile-Save/Register-from-Booking/OAuth-Finalize
  onCustomerChanged(cb)  // useCustomer() subscribed → re-fetch
  ```
- `PATCH /api/customer/me` darf das Cookie NICHT invalidieren (verifiziert).

---

## 6. Booking-Flow

### 6.1 Eingangspunkte

- **Header-CTA „Termin buchen"** (Site-weit) → öffnet
  `BookingDialog`-Modal (IT11).
- **Hero-CTA „Jetzt Termin buchen"** (Startseite) → gleiches Modal.
- **`/buchung`-Page** (Fallback für No-JS / Direkt-Aufruf / Re-Book) →
  Inline-`BookingForm` mit eigenem Slot-Picker.
- **Service-Detail-Modal** → optional mit `defaultService=<slug>` ins
  Modal.

`BookingDialogProvider` (Client-Component im RootLayout) hält
`{ isOpen, defaultService }`-State und exposed `open()`, `close()`,
`reset()`. `reset()` inkrementiert einen `key`-Prop am inneren
Modal → Form-State wird per Remount geleert (IT11 BUG-MAJOR-09).

### 6.2 Slot-Verfügbarkeit

Verfügbarkeit wird **dynamisch berechnet** aus:

1. `AvailabilityTemplate` (Wochentag-Defaults) +
2. `DayOverride` (tagesgenaue Überschreibung) → ergeben das Tagesfenster.
3. `Booking WHERE status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED')` →
   blockierte Zeitfenster.
4. `BufferConfig.bufferMinutes` (Singleton) → Puffer **nach
   CONFIRMED-Buchungen** (nicht nach PENDING/COUNTER_PROPOSED).

**Performance (IT12-S03):** `/api/availability/calendar` liefert
einen 62-Tage-Range. Targets: p95 < 300 ms (kalter Cache, 100 Bookings).
Caching: `revalidateTag('availability')`, `revalidateTag('available-slots')`.
Indizes vorhanden: `bookings(date, status)`, `bookings(status, date, startTime)`,
`day_overrides(date)` UNIQUE, `availability_template(dayOfWeek)`.

### 6.3 Booking-Submission

`POST /api/bookings`:

1. **Idempotency-Key (IT12):** Header `Idempotency-Key` (UUID).
   Cache-Lookup → Cached-Response zurück, kein neuer Insert.
2. **Doppel-Submit-Schutz (IT11 BUG-MAJOR-03):** 60-s-Window-Dedup auf
   `customerEmail`/`customerId` + `slotId`. Bei Match: gleiche
   Booking-ID + frisch signierte Tokens, KEINE zweite Mail.
3. **Validation (Zod):** `CreateBookingSchema` mit `superRefine` (Date-
   ODER Slot-Modus, Adress-Pflicht, Privacy-Accept).
4. **Adress-Pflicht:** Eingeloggte Customer mit Profil-Adresse →
   Backend übernimmt Profil-Adresse, falls Body fehlt. Sonst Pflicht-
   Validation greift.
5. **Slot-Reservierung (Serializable-Tx):**
   `prisma.$transaction(...)` mit Isolation `serializable`,
   `timeout: 5000ms`, `maxWait: 2000ms`. Innerhalb: Overlap-Check
   (`start < requestedEnd AND end > requestedStart`) gegen aktive
   Buchungen + Buffer-Check + Insert. Partial-Unique-Index als
   zweite Verteidigungslinie. Race-Resolution gegen parallel-laufende
   Cancel-Operationen ist deterministisch (siehe §6.4).
6. **Token-Issue:** Nach Insert werden zwei JWTs signiert
   (`booking-tokens.ts`):
   - `signBookingConfirmationToken({ bookingId, customerId })` — Scope `booking-confirmation`.
   - `signBookingCancellationToken({ bookingId, customerId })` — Scope `booking-cancellation`.
   Beide HS256, 30 Tage gültig, `BOOKING_TOKEN_SECRET` separat von `AUTH_SECRET`.
7. **Mail-Dispatch:** `void runMailDispatch(...).catch(...)` —
   fire-and-forget. Bestätigungsmail an Kunde + Notification an Tom.
   `mailSent`/`mailError` werden persistiert.
8. **Response:** `201 { data: { id, status, createdAt, confirmationToken, cancellationToken } }`.
9. **Frontend:** `router.push('/buchung/bestaetigung/<id>?token=<jwt>')`.
   `BookingDialogProvider.reset()` vor dem Push.
10. **Konto-Anbieten (IT12-S05):** Wenn Gast-Buchung mit
    `customerEmail` und kein bestehendes Konto → embedded Card auf
    Bestätigungsseite ("Konto anlegen?") → `POST /api/customer/register-from-booking`
    mit `confirmationToken` + `password`. Backend verknüpft alle
    Bookings mit dieser E-Mail.

### 6.4 Bestätigungsseite (IT11 — reload-fest)

Route: `/buchung/bestaetigung/[bookingId]?token=<jwt>` (Server-Component,
verifiziert Token serverseitig, lädt Summary via interner Funktion oder
`GET /api/bookings/[id]/public-summary`).

Alte Route `/buchung/bestaetigt` bleibt **separat erhalten** — sie
behandelt den Counter-Proposal-Antwort-Flow (Tom→Kunde mit
`?accepted=true` / `?status=gone`). Klare semantische Trennung.

### 6.5 Stornierung (IT11 — Audit + Gast-Token)

**Endpoints:**
- `POST /api/bookings/[id]/cancel?token?` — kanonisch. Akzeptiert
  Cancellation-Token ODER `customer-session`-Cookie.
- `POST /api/customer/bookings/[id]/cancel` — dünner Wrapper, intern
  delegiert.

**Logik (`isCancellable()` in `src/lib/cancellation.ts`):**
- Status muss in `['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED']` sein.
- 24-h-Vorlauf-Frist auf `start = parseBerlinDateTime(date, startTime)`
  (DST-fest). Auch Token-basierter Cancel unterliegt der Frist.

**Idempotenz (atomarer Conditional-UPDATE):**
```ts
await prisma.booking.updateMany({
  where: { id, status: { in: ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'] } },
  data: { status: 'CANCELLED', cancelledAt: now(), cancelledBy: 'CUSTOMER', ... }
})
// Wenn count === 0 und current.status === 'CANCELLED' → 200 + alreadyCancelled: true,
// keine zweite Mail, kein Cache-Revalidate.
```

`cancelledBy` ist einheitlich `'CUSTOMER' | 'ADMIN' | 'SYSTEM'` —
Gast-Token-Cancel wird als `'CUSTOMER'` markiert (keine Differenzierung).

**Mail-Scanner-Race-Schutz:** Storno-Page rendert NUR UI; Submit ist
explizit `<form method="POST">` nach User-Klick. Mail-Provider-Preview-
Fetch (GET) konsumiert den Token nicht versehentlich.

**Slot-Re-Freigabe:** Implizit — Verfügbarkeit wird aus Status berechnet.
`revalidateTag('available-slots')` triggert Cache-Refresh.

---

## 7. Marketing-Mails (DSGVO Variante 3)

### 7.1 Rechtliche Basis

**UWG §7 Abs. 3** Bestandskunden-Sonderregel: Wer im Rahmen einer
Geschäftsbeziehung E-Mails der Kunden erhalten hat, darf diese für
Direktwerbung ähnlicher Leistungen nutzen — solange (a) Widerspruchs-
hinweis bei Erhebung, (b) Widerspruchshinweis in jeder Mail,
(c) Widerspruchsmöglichkeit kostenlos.

→ **Kein Opt-In-Modell**. Stattdessen: jeder Customer mit
`unsubscribedAt = NULL` darf Bulk-Marketing erhalten. Footer enthält
zwingend Unsubscribe-Link.

### 7.2 Datenmodell

`MarketingEmail` (Audit pro Sendvorgang) und
`MarketingEmailRecipient` (pro Empfänger ein Record). Status-Werte:

```
MarketingEmail.status: 'draft' → 'queued' → 'sending' → 'sent'
                                                     | 'partial_failure'
                                                     | 'failed'
MarketingEmailRecipient.status: 'PENDING' | 'SENT' | 'FAILED'
```

`CustomerUser.unsubscribedAt` + `unsubscribedReason` direkt am Kunden.
Sparse-Index `[unsubscribedAt]`. **`onDelete: Restrict`** auf
`MarketingEmail.sentByAdmin` (Admin-Löschung darf Audit-Trail nicht brechen).

### 7.3 Stateless HMAC-Unsubscribe-Tokens

Kein Token-Tabellen-State. Token deterministisch pro Customer:

```ts
// src/lib/marketing-tokens.ts
const SECRET = process.env.UNSUBSCRIBE_TOKEN_SECRET; // separater Secret

generateUnsubscribeToken(customerId) → base64url(`${customerId}:${hmac32}`)
verifyUnsubscribeToken(token) → customerId | null   // HMAC-compare
```

Vorteile: keine Token-Tabelle, keine Migration, keine TTL nötig
(gültig solange Customer existiert), gleicher Token in allen Mails.

### 7.4 Bulk-Send-Strategie (Vercel Hobby + Resend Free)

- **Hard-Cap: 50 Empfänger pro Send-Operation** (Vercel-10 s-Timeout).
- **Daily-Cap UI: 100/Tag** (Resend-Free); Frontend zeigt aktuelles
  Tageskontingent (`Heute: X von 100`).
- **Concurrency 5** parallel via Promise-Pool / Semaphor in
  `src/lib/marketing-bulk-send.ts`. Throttle 200 ms zwischen Batches.
- Synchroner Send mit sofortiger Response — kein Polling-Endpoint
  notwendig im Happy-Path (50 × Send ≈ 5 s).
- **Bei > 50 Empfängern:** Frontend-Confirm blockiert, Hinweis "Bitte
  in Schüben oder warten auf IT13 mit Cron".
- **Test-Send:** `/api/admin/marketing/emails/[id]/test-send` sendet
  nur an Admin-Mail aus Session, KEIN Audit-Insert, footer 1:1.

### 7.5 Plain-Text-Footer (verbindlich)

```
--
Sie erhalten diese E-Mail, weil Sie Kunde bei Bärenstark Hausservice
sind. Wenn Sie keine weiteren Marketing-Mails von uns erhalten möchten,
melden Sie sich hier ab: {unsubscribeUrl}

Bärenstark Hausservice · Tom Siefert · Darmstadt · Impressum: {baseUrl}/impressum
```

`unsubscribeUrl = ${NEXT_PUBLIC_BASE_URL}/api/customer/unsubscribe?token=${token}`

`/api/customer/unsubscribe` ist public, validiert Token, setzt
`CustomerUser.unsubscribedAt = now()` + `unsubscribedReason = 'EMAIL_FOOTER'`,
302 → `/marketing/abgemeldet`.

### 7.6 Sende-Filter-Logik (Backend, hart)

```ts
const validRecipients = await prisma.customerUser.findMany({
  where: { id: { in: recipientIds }, unsubscribedAt: null, email: { not: null } },
});
// Differenz zu intendedRecipients sichtbar im Response (actualRecipients).
```

Frontend-Filter ist informativ, Backend-Filter ist verbindlich.

---

## 8. Storage & Uploads (Vercel Blob)

**`POST /api/upload`** — Multipart-Upload, gibt `{ attachmentId, url }` zurück.

- ENV-Pflicht: `BLOB_READ_WRITE_TOKEN`. Fehlt → 503 `BLOB_NOT_CONFIGURED`,
  UI blendet die Sektion aus mit Hinweis "ohne Anhang absenden".
- **Limits (IT11):** 10 MB Bilder (`image/*`), 50 MB Videos (`video/*`),
  10 MB PDFs. Max 5 Dateien pro Booking, max 3 parallele Uploads.
- **Validation:**
  - Min-Size 1 Byte (0-Byte → 400 `FILE_EMPTY`).
  - Magic-Bytes-Check via `file-type`-Package (Schutz vor MIME-Spoof).
    Bei Mismatch → 400 `FILE_TYPE_MISMATCH`.
  - Body-Stream-Check vor `put()` → 413 `FILE_TOO_LARGE`.
- **Datenmodell:** `BookingAttachment` mit nullable `bookingId` —
  Upload erstellt Attachment mit `bookingId=null`, das Booking-POST
  setzt die Verknüpfung über `attachmentIds[]`.
- **Cleanup:** Orphan-Attachments mit `bookingId=null` werden NICHT
  automatisch gelöscht. Backlog für IT13.
- **Admin-Anzeige:** `BookingTable.tsx` rendert Thumbnail bei `image/*`,
  Dateiname, Dateigröße, Download-Link in neuem Tab. Empty-State
  "Keine Dateien hochgeladen". Lightbox ist Backlog.

**Service-Bilder (IT12-S02):**
- `src/lib/service-images.ts` — Single-Source-of-Truth Mapping
  Slug → `/public/<image>.png`.
- Komponente `ServiceHeroImage` mit `next/image` + Fallback-Container
  bei `onError`.
- Slug → File:
  ```
  entruempelung      → /entruemplungen.png
  entkernung         → /entkernungsarbeiten.png
  reinigung          → /reinigungsarbeiten.png
  gruenflaechenpflege → /grünflächenpflege.png
  muelltonnenservice → /mülltonnenservice.png
  entsorgung         → /metal_schrott.png
  ```
- Umlaute werden von `next/image` URL-encoded; aktuell verifiziert in
  Production. Falls QA-Probleme: Dateien umbenennen (kein User-facing
  Breaking-Change, da Mapping zentral).

---

## 9. Performance & Caching

### 9.1 ISR / Cache-Tags

| Tag                    | Verbraucher                                   | Trigger zur Re-Validierung                                     |
|------------------------|-----------------------------------------------|----------------------------------------------------------------|
| `availability`         | `/api/availability/calendar`                  | Slot-/AvailabilityTemplate-/DayOverride-Änderung               |
| `available-slots`      | `/api/slots/available`                        | Booking-Insert / Cancel / DayOverride                          |
| `slots`                | Admin-Slot-Liste                              | Slot-CRUD                                                      |
| (analytics, ISR 300 s) | `/admin/analytics`                            | Auto-Revalidate                                                |

### 9.2 Calendar-Performance (IT12-S03)

- `BookingCalendar` ruft `fetchAvailabilityCalendar(from, to)` für
  62-Tage-Range.
- Backend muss Bookings + DayOverrides + Template in **einem**
  Round-Trip laden (kein N+1 pro Tag).
- Cache-Header: `s-maxage=60, stale-while-revalidate=300`.
- Frontend Render-Time Skeleton-zu-Grid p95 < 200 ms.
- E2E Step-Wechsel zu sichtbarem Grid p95 < 1500 ms.

### 9.3 Datenbank-Indizes (Pflicht-Liste)

```sql
bookings(date, status)
bookings(status, date, startTime)
bookings(customerId, date)
bookings(customerId, status)
bookings(status, createdAt)
day_overrides(date)               UNIQUE
availability_template(dayOfWeek)
customer_users(email)
customer_users(oauthProvider, oauthId)
customer_users(lastName, firstName)
customer_users(adminRating)
customer_users(unsubscribedAt)    SPARSE
users(status)
reviews(approved, rejectedAt, createdAt)
marketing_emails(sentByAdminId, createdAt)
marketing_emails(status, createdAt)
marketing_email_recipients(marketingEmailId, status)
marketing_email_recipients(sentAt)
idempotency_keys(expiresAt)
```

---

## 10. Deployment & Env-Vars

### 10.1 Vercel-Konfiguration

- **Plan:** Hobby (10 s Function-Timeout, 100 GB Bandwidth/Monat).
- **Region:** Auto.
- **Domain:** `https://www.baerenstark-hausservice.app`. Apex
  `baerenstark-hausservice.app` 301-Redirect auf `www.`.
- **Build-Command:** `npm run build` (Next.js 14, Turbo).
- **Install-Command:** `npm install`.
- **Storage:** Vercel Blob aus dem Marketplace (setzt
  `BLOB_READ_WRITE_TOKEN` automatisch).

### 10.2 Pflicht-Env-Vars

| Variable                    | Beispiel                                                  | Begründung |
|-----------------------------|-----------------------------------------------------------|------------|
| `DATABASE_URL`              | `libsql://baerenstark-prod-…?authToken=…`                  | Turso-Prod-DB. |
| `AUTH_SECRET`               | 32+ Random-Bytes                                          | NextAuth-Sign. |
| `NEXTAUTH_URL`              | `https://www.baerenstark-hausservice.app`                  | OAuth-Callback-URL-Berechnung. **MIT www!** |
| `NEXT_PUBLIC_BASE_URL`      | `https://www.baerenstark-hausservice.app`                  | E-Mail-Links, Token-URLs. |
| `RESEND_API_KEY`            | `re_…`                                                    | Mail-Provider. |
| `MAIL_FROM`                 | `noreply@<verifizierte-domain>`                           | Resend Sender. Sandbox-Fallback `onboarding@resend.dev`. |
| `MAIL_TO_ADMIN`             | `hausservice-baerenstark@outlook.com`                     | Tom-Notifications. |
| `BLOB_READ_WRITE_TOKEN`     | `vercel_blob_rw_…`                                        | Vercel-Blob. |
| `BOOKING_TOKEN_SECRET`      | 48 Byte Base64 (separat von AUTH_SECRET)                   | Confirmation/Cancellation-JWT. |
| `UNSUBSCRIBE_TOKEN_SECRET`  | 32+ Random-Bytes (separat von BOOKING_TOKEN_SECRET)        | HMAC-Unsubscribe-Token. |
| `GOOGLE_CLIENT_ID`          | `…apps.googleusercontent.com`                             | Customer-OAuth. |
| `GOOGLE_CLIENT_SECRET`      | `GOCSPX-…`                                                | Customer-OAuth. |

**Optional:**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — operativ ruhend.
- `ALLOW_ADMIN_PROMOTE=true` — nur lokal für `scripts/promote-admin.ts`.
- `ALLOW_USER_WIPE=true` — nur lokal für `scripts/reset-users.ts`.

### 10.3 Google Cloud Console

- Authorized JavaScript Origin: `https://www.baerenstark-hausservice.app`
- Authorized Redirect URI:
  `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`
  (exakt — kein Trailing-Slash, mit `www`!).

### 10.4 Turso-Migrations-Workflow (siehe §2.3)

```bash
# Lokal Migration erstellen
npx prisma migrate dev --name <migration_id>

# In Production gegen Turso ausrollen
turso db shell baerenstark-prod < prisma/migrations/<id>/migration.sql

# Dann Vercel re-deploy (oder Auto-Deploy nach Commit)
```

`prisma migrate deploy` funktioniert NICHT gegen `libsql://`-URLs.

### 10.5 Operative Skripte

- `scripts/promote-admin.ts` — Admin-Bootstrap-Reset, ENV-Guard `ALLOW_ADMIN_PROMOTE=true`.
- `scripts/reset-users.ts` — DSGVO-Wipe, ENV-Guard `ALLOW_USER_WIPE=true`. Stripe-Customer-Cleanup ist **manuell** in Stripe-Dashboard nach dem Skript-Lauf (Skript gibt Liste der `stripeSessionId`s aus).

---

## 11. Iterations-Notizen (kurze History)

Die Architektur entwickelte sich in 12 Iterationen. Diese Sektion gibt
für jede Iteration 2–3 Sätze Kontext, damit zukünftige Eingriffe die
historischen Entscheidungen verstehen.

**IT1–IT5 (Foundation, 2026-05-02):**
IT1 — Initiales Setup, Admin-Auth, Slot-CRUD. IT2 — Booking-CRUD,
Counter-Proposal-Flow (`cancelToken`), Mail-Versand. IT3 — Date/Time-
Modus löst Slot-Modus ab; AvailabilityTemplate + DayOverride;
File-Upload (BookingAttachment). IT4 — Customer-Portal mit eigener
Auth (`customer-session`-Cookie, getrennt von Admin), Stripe Payment,
Reviews. IT5 — OAuth2 (Google) für Kunden via separatem NextAuth-
Customer-Handler unter `/api/auth/customer/[...nextauth]` mit
`oauth-finalize`-Redirect-Pattern; Adresse pro Buchung;
DurationPicker; BufferConfig (Singleton, Default 30 min).

**IT6 — Admin-Reife & Auth-Bereinigung (2026-05-03):**
Multi-Admin (`User.status`, `createdById`, Self-Service `/admin/admins`,
atomarer Lock-out-Schutz via Conditional-UPDATE). FullCalendar-Adoption.
Reviews mit COMPLETED-Trigger + Admin-Approval. SEO-Pass. **Auth-Bereinigung:**
Customer-E-Mail/Pw temporär deaktiviert (D3) — wurde in IT7 reverted.
DTO-Trennung (`selectCustomerUserPublic` vs. `…Admin`) verbindlich.
Admin-User-Verwaltung (`adminNote`, `adminRating`). `finalPriceEur`.
Analytics mit Recharts.

**IT7 — Email-Auth wiederherstellen (2026-05-03):**
Customer-Credentials-Provider re-aktiviert (6 Endpoints + 4 Pages
wiederhergestellt). Diagnose-Endpoint `/api/auth/diagnose` für
OAuth-Setup-Probleme. CLI-Skript `scripts/promote-admin.ts` für
Admin-Lock-out (kein Public-Setup-Endpoint). Neue Tabelle
`PasswordResetToken` (SHA-256-Hash, 1h, single-use, atomarer
Conditional-UPDATE).

**IT8 — Bugfix-Sweep (2026-05-03):**
Fünf Production-Bugs nach IT7-Go-Live: `/admin/admins`-Crash
(Envelope-Mismatch — Backend gab `apiSuccess({ data, total })` mit
doppelter `data`-Verschachtelung), Admin-Kalender-Deadlock (Kalender
nur gemountet wenn `status==='ready'`, aber Status erforderte
gemounteten Kalender), `/api/slots`-Filter (`startsAt >= now()`
versteckte heutige Slots), DayOverride-Liste (alle Einträge nicht nur
aktueller Monat), Diagnose-Endpoint mit `actionRequired`-Verdikt.

**IT7-Erinnerung — Customer-Address im Profil (IT9, 2026-05-03):**
`CustomerUser.streetAndNumber/postalCode/city` (alle nullable),
PLZ-Validation `/^\d{5}$/`. Profil-Adresse ist Default für Booking-Form,
Booking-Adresse ist Auftrags-Snapshot. Public Buchungs-Kalender-Bug
(gleicher Deadlock wie IT8 in `BookingCalendar.tsx`). `/admin/users`
Envelope-Bug repariert (jetzt `{ items, total, page, pageSize }`).

**IT10 — Form-Polish & Bug-Triage (2026-05-03):**
Reset-Mail-Diagnose (`MAIL_FROM` vs. `RESEND_FROM_EMAIL`-Verwirrung
gelöst — kanonisch `MAIL_FROM`). `/admin/users` und `POST /api/bookings`
500-Bugs als Production-Migrations-Drift erkannt
(`20260503163821_add_customer_address` nicht in Prod). Quick-Booking-Modal
als Wiederverwendung von `BookingForm` (Modal-Wrapper). Customer-Self-
Service: SSR-Pre-Fill aus `CustomerUser` für Booking-Form.

**IT11 — Storno + E-Mail-Sending + Vercel Blob (2026-05-04):**
Buchungs-Flow mit Bestätigungsseite/Reload-Festigkeit via signiertem
JWT (`BOOKING_TOKEN_SECRET`, Scope `booking-confirmation`, 30 d).
Storno-Feature für Kunden (eingeloggt) UND Gäste (Token-basiert) —
einheitlicher kanonischer Endpoint `POST /api/bookings/[id]/cancel`,
idempotent via atomarem `updateMany`. Audit-Spalten `cancelledAt`,
`cancelledBy` ('CUSTOMER'|'ADMIN'|'SYSTEM' — keine Differenzierung
zwischen Login und Gast-Token), `cancellationReason`. Mail-Scanner-
Race-Schutz: Storno-Page rendert UI, Submit ist explizit POST. Vercel
Blob produktionsfertig integriert (`BLOB_READ_WRITE_TOKEN`),
File-Upload-Limits 10 MB Bilder / 50 MB Videos / 10 MB PDFs,
Magic-Bytes-Check via `file-type`-Package, Parallel-Upload-Limit 3.
Doppel-Submit-Schutz für `POST /api/bookings` (60-s-Window-Dedup).
Resend-Sandbox-Sign-off-Checkliste eingeführt.

**IT12 — Bug-Sweep & Marketing-Mails (2026-05-04):**
Production-Bug-Sweep nach Stakeholder-Feedback: NEXTAUTH_URL musste auf
`https://www.baerenstark-hausservice.app` (mit `www`!) korrigiert
werden — OAuth-Callback funktionierte nicht. Service-Detail-Bilder
(SSOT-Mapping in `service-images.ts`). Calendar-Performance-Optimierung
(N+1 → ein Round-Trip, Cache-Tags). Scroll-Helper
`scrollIntoViewIfNeeded` (5 Aufrufstellen in `BookingClient.tsx`).
Customer-Session-Sync via `EventTarget`-Bus (`customer-sync.ts`) — Header
zeigt nicht mehr "Anmelden" trotz Login. Konto-Anbieten nach Gast-
Buchung als embedded Card auf Bestätigungsseite (`POST /api/customer/register-from-booking`).
Admin-Navigation 3-Gruppen-Sidebar
(Kalender & Zeitmanagement / Nutzerverwaltung / Auswertungen) —
"Bewertungen" nur einmal in DOM. Idempotency-Key (`Idempotency-Key`-Header,
`idempotency_keys`-Tabelle, 24 h TTL). **Marketing-Mail-Feature**
(US-IT12-15) komplett: DSGVO Variante 3 (UWG §7 Abs. 3 Bestandskunden),
stateless HMAC-Unsubscribe-Tokens (kein Token-Tabelle nötig), Plain-Text
only, Hard-Cap 50 Empfänger pro Send (Vercel-Hobby-Timeout-konform),
Test-Send an Admin-Mail, Audit-Trail in `MarketingEmail` +
`MarketingEmailRecipient` mit Resend-Message-IDs.

**IT13 — Bug-Fix-Sweep + Facebook OAuth + Direct-Upload-Refactor (2026-05-04):**
Production-Bug-Sweep nach Tom's Stakeholder-Feedback nach IT12-Go-Live.
Zwei Production-Blocker strukturell behoben:
**`/api/upload` Refactor auf Direct-Upload via `@vercel/blob/client`**
— neue Endpoints `POST /api/upload/token` (signed Token, 5 min,
MIME/Size in Token eingebrannt) + `PATCH /api/upload/attachments/[id]`;
alter `POST /api/upload` antwortet während der Übergangsphase mit
410 GONE. Browser lädt Datei direkt zu Vercel Blob, Server-Function-
Body-Limit von Vercel Hobby (4.5 MB) ist damit irrelevant — 10-MB-Bilder
und 50-MB-Videos sauber möglich. `/api/bookings` 500 (Prisma-Migrations-
Drift gegen Turso erneut — IT11 + IT12 Migrations nicht vollständig
eingespielt; manuelle Turso-Shell-Schritte nachgezogen).
**Strukturiertes Pflicht-Logging** in beiden Bug-Routen via neuem
`src/lib/log-request-error.ts`: jede 5xx-Antwort erzeugt einen single-
line `console.error`-Eintrag mit `requestId` (UUID), `prismaCode`/
`prismaMeta`, `resendCode`, `blobErrorName`, `authState`, `customerId`,
`endpoint`, `status`, `errorClass`, `message`. `internalError()` in
`src/lib/api.ts` erweitert: ruft intern `logRequestError` auf und gibt
`X-Request-Id`-Header zurück; FE zeigt diese ID dem Kunden bei 5xx zur
Support-Korrelation. UX-Bugs: **`useScrollToSection()`-Hook** neu in
`src/lib/scroll-to-section.ts` (Pflicht-Sequenz `requestAnimationFrame
× 2 → scrollIntoView → heading.focus({ preventScroll: true })`),
ersetzt `scroll-into-view.ts` (gelöscht). Header-Höhe via
`[data-app-header]`, Modal-aware via `[data-modal-body]` (mit
optionalem `[data-modal-header]` für Modal-internen Sticky-Header),
prefers-reduced-motion-konform, ±8 px Komfort-Tolerance. Form-Prefill
konsolidiert über `useCustomer()` in allen Forms (Buchungs-Wizard,
Profil) mit Skeleton-Gating gegen Hydration-Mismatch. Service-Detail-
Bilder (`/services/[slug]`): Drei-Schicht-Modell — Outer-Wrapper
`bg-baerenstark-cream/60` (Letterbox-Token), Image-Container
`bg-transparent`, `<Image>` `bg-transparent object-contain` mit
`max-h-[28rem]` (Stories S07/S08). Compliance: neue statische Server-
Component-Page `/datenschutz/datenloesung` (kein Backend-State) als
Voraussetzung für Facebook App Review live; Footer-Link
„Datenlöschung" + Datenschutz-Seite-Abschnitt mit Querverweis.
**Facebook OAuth produktiv aktiv** (Provider in
`src/lib/customer-oauth.ts` schon seit IT6 registriert, IT13 erstmals
live): ENV-Naming auf `AUTH_FACEBOOK_ID`/`AUTH_FACEBOOK_SECRET`
harmonisiert (mit Alias-Akzeptanz für `FACEBOOK_CLIENT_ID/SECRET`),
Scope-String auf `'email,public_profile'` (Facebook-Komma-Konvention),
Redirect-URI in Facebook Developer Console exakt
`https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook`
(mit `customer/`-Pfadsegment). Account-Linking konsistent mit Google:
verifiziert → auto-link, unverifiziert → 422 `oauth_unverified_conflict`
(Hijacking-Schutz). Single-Valued `oauthProvider`-Spalte: bei
Multi-OAuth wird überschrieben — Login funktioniert weiter über
E-Mail-Match-Pfad (akzeptierter Trade-off; Multi-OAuth-Schema bleibt
im Backlog).

---

## 12. Risiken & Tech-Debt (offen)

| Bereich                       | Risiko / Schuld                                                                 | Mitigation / Backlog |
|-------------------------------|--------------------------------------------------------------------------------|----------------------|
| **Vercel Hobby Timeout**      | 10-s-Limit bei Marketing-Send → harter 50-Empfänger-Cap.                        | IT13: Pro-Plan oder Vercel-Cron + Resume-Endpoint. |
| **Resend Free Quota**         | 100/Tag, 3000/Monat. Bei Marketing-Welle riskant.                              | UI-Quota-Anzeige + Warnung. Pro-Plan-Upgrade ab IT13. |
| **Turso Migration-Workflow**  | `prisma migrate deploy` funktioniert nicht; manueller Turso-Shell-Schritt.     | Skript `scripts/migrate-turso.sh` als Wrapper (Backlog). |
| **Stripe operativ ruhend**    | `Payment`-Modell + Endpoints existieren, aber kein API-Key gesetzt.            | Aktivierung erst auf Tom-Trigger. |
| **OAuth-Cookie auf apex/www** | Cookie geht verloren wenn User von apex zu www redirected wird.                 | 301-Redirect am Edge sichergestellt; trotzdem Watch-Item. |
| **Admin-Edge-Middleware**     | Kann `User.status` nicht prüfen (kein Prisma in Edge).                          | Status-Check im Page-Loader / Route-Handler. Akzeptierter Zustand. |
| **Orphan Attachments**        | `BookingAttachment` mit `bookingId=null` werden nicht gelöscht.                | IT13 — Cleanup-Cron (DELETE older than 24h). |
| **Lightbox für Anhänge**      | Admin-Anhang-Klick öffnet neuen Tab, nicht Lightbox.                            | UX-Backlog IT13. |
| **Scroll-Jump Bookingform**   | Layout-Shift bei `setPickedService` kann Scroll-Jump auslösen.                  | `useDeferredValue` / Dedup-Ref via `scrollIntoViewIfNeeded`. |
| **Self-Delete Customer**      | Kein Customer-Self-Delete-Endpoint; Delete läuft über Tom.                     | Backlog (DSGVO-Optimum, aber Adress-Leeren reicht für AC). |
| **Pending-E-Mail-Wechsel**    | E-Mail-Änderung im Profil aktuell verboten (BUG-402).                          | IT13 — Pending-Email-Flow mit Re-Verify. |
| **Vercel-Image-Optimization** | Free-Limit 1000 Transformations/Monat — bei viel Traffic eng.                  | Watch. |
| **Mail-Domain-Verifizierung** | Resend-Domain `baerenstark-hausservice.app` verifiziert? Sonst Sandbox-Modus.  | Tom verifiziert SPF/DKIM. |
| **Rate-Limit-Library**        | `src/lib/ratelimit.ts` ist In-Memory — auf Vercel-Function-Cold-Start verloren. | Upstash-Redis bei IT13. |
| **`internalError()` Logging** | Kein `request_id`-Header für Vercel-Log-Korrelation.                            | IT13 — `request_id`-Wrapper. |

---

*Ende — ARCHITECTURE.md (Konsolidierung, Stand IT12, 2026-05-04).*
