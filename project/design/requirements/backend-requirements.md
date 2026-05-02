# Backend Requirements — Iteration 4

## Overview

Backend-Erweiterungen für Iteration 4 (US-25–US-29), umgesetzt im
bestehenden Next.js-App-Router-Backend. Drei Subsysteme:

1. **Kunden-Auth (US-25)** — eigene JWT-Cookie-basierte Session
   (`customer-session`), separat vom NextAuth-Admin. Endpunkte unter
   `/api/customer/*`.
2. **Stripe-Zahlung (US-28)** — Stripe Checkout via Server-side SDK,
   Webhook für Status-Updates.
3. **Bewertungen (US-29)** — Admin-moderierte Reviews mit eigener
   Tabelle.

## Tech Stack

Bestand:

- **Language/Runtime:** Node.js 20 (Vercel-Default).
- **Framework:** Next.js 14 (App Router) Route Handlers.
- **Database:** SQLite via Turso (libSQL). Lokal: `file:./dev.db`.
- **ORM:** Prisma.
- **Validation:** Zod (`contracts/zod-schemas.ts`).
- **Cache / Rate-Limit:** Upstash Redis Free Tier mit `@upstash/ratelimit`.
- **Mail:** Resend.
- **Storage:** Vercel Blob (US-18 Bestand, in IT4 unverändert).

Neu Iteration 4:

- **Auth (Kunden):** `jose`-Library für HS256-JWT-Sign/Verify
  (Edge-kompatibel, ESM). Cookie-Handling über `next/headers`.
- **Stripe:** `stripe` npm-Paket (Server-side SDK, API-Version
  `2024-04-10`). Singleton in `src/lib/stripe.ts`.
- **Hashing:** bcrypt cost 10 (Bestand für Admin, wiederverwendet für Kunden).

## Data Model

Vollständige Spec in `contracts/schema.prisma` und `contracts/schema.sql`.
Hier die IT4-relevanten Modelle:

### Entity: `CustomerUser` (NEU IT4)

| Feld                | Typ      | Constraints                  | Bemerkung                                                |
| ------------------- | -------- | ---------------------------- | -------------------------------------------------------- |
| `id`                | TEXT     | PK (cuid)                    |                                                           |
| `email`             | TEXT     | UNIQUE, NOT NULL             | Lowercase im Storage. Index auf email.                    |
| `passwordHash`      | TEXT     | NOT NULL                     | bcrypt cost 10.                                           |
| `firstName`         | TEXT     | NOT NULL                     | 1–120 Zeichen.                                            |
| `lastName`          | TEXT     | NOT NULL                     | 1–120 Zeichen.                                            |
| `phone`             | TEXT     | NULL                         | Optional.                                                 |
| `emailVerified`     | BOOLEAN  | NOT NULL, DEFAULT false      | Wird nach Verifikations-Klick true.                       |
| `verificationToken` | TEXT     | UNIQUE, NULL                 | cuid, gesetzt bei Registrierung.                         |
| `resetToken`        | TEXT     | UNIQUE, NULL                 | cuid, gesetzt bei Forgot-Password.                       |
| `resetTokenExpiry`  | DATETIME | NULL                         | now + 1h.                                                 |
| `createdAt`         | DATETIME | DEFAULT now()                |                                                           |
| `updatedAt`         | DATETIME | UPDATE now()                 |                                                           |

**Relationen:** 1:N zu Booking (`customerId`), 1:N zu Review (`customerId`).

### Entity: `Booking` (erweitert)

Alle Bestandsfelder unverändert. Neue Felder:

| Feld         | Typ    | Constraints                                              | Bemerkung                                       |
| ------------ | ------ | -------------------------------------------------------- | ----------------------------------------------- |
| `customerId` | TEXT   | NULL, FK → customer_users.id ON DELETE SET NULL          | Index auf `(customerId, date)` für Portal-Liste. |

**Status-Erweiterung:** `BookingStatus.COMPLETED` neu (Endstatus, nur via
`PATCH /api/bookings/:id` von Admin gesetzt). State-Machine siehe Schema-Doku.

### Entity: `Payment` (NEU IT4)

| Feld              | Typ          | Constraints                                          | Bemerkung                                              |
| ----------------- | ------------ | ---------------------------------------------------- | ------------------------------------------------------ |
| `id`              | TEXT         | PK (cuid)                                             |                                                        |
| `bookingId`       | TEXT         | UNIQUE, NOT NULL, FK → bookings.id ON DELETE CASCADE  | 1:1.                                                   |
| `stripeSessionId` | TEXT         | UNIQUE, NULL                                          | "cs_test_..." / "cs_live_..."                          |
| `amount`          | INTEGER      | NOT NULL, > 0                                         | In Cents.                                               |
| `currency`        | TEXT         | NOT NULL, DEFAULT 'eur'                               | MVP: nur 'eur'.                                         |
| `description`     | TEXT         | NULL                                                  | Wird Stripe als description weitergereicht.            |
| `status`          | TEXT         | NOT NULL, DEFAULT 'PENDING' (CHECK in [PENDING, PAID, FAILED, REFUNDED]) |                                                        |
| `paidAt`          | DATETIME     | NULL                                                  | Gesetzt bei Webhook `checkout.session.completed`.      |
| `createdAt`       | DATETIME     | DEFAULT now()                                         |                                                        |
| `updatedAt`       | DATETIME     | UPDATE now()                                          |                                                        |

**Indexe:** `(status)`, `(stripe_session_id)`.

### Entity: `Review` (NEU IT4)

| Feld          | Typ      | Constraints                                              | Bemerkung                                          |
| ------------- | -------- | -------------------------------------------------------- | -------------------------------------------------- |
| `id`          | TEXT     | PK (cuid)                                                 |                                                    |
| `customerId`  | TEXT     | NULL, FK → customer_users.id ON DELETE SET NULL           | Verwaisen nach Konto-Löschung erlaubt.             |
| `bookingId`   | TEXT     | UNIQUE, NULL, FK → bookings.id ON DELETE SET NULL         | 1:1; verwaisen nach Booking-Löschung erlaubt.      |
| `stars`       | INTEGER  | NOT NULL, CHECK BETWEEN 1 AND 5                           |                                                    |
| `text`        | TEXT     | NULL                                                      | App-Layer-Limit max 500.                            |
| `approved`    | BOOLEAN  | NOT NULL, DEFAULT false                                   |                                                    |
| `createdAt`   | DATETIME | DEFAULT now()                                             |                                                    |
| `updatedAt`   | DATETIME | UPDATE now()                                              |                                                    |

**Indexe:** `(approved, createdAt DESC)` für öffentliche Liste,
`(customerId)` für "meine Reviews"-Lookup.

## API Endpoints

Vollständige Spec mit Request/Response-Schemas in
`contracts/api-routes.md` §11–§14. Hier die wichtigsten Logik-Aspekte:

### Kunden-Auth (US-25)

#### `POST /api/customer/register`
- **Auth:** öffentlich.
- **Rate-Limit:** 5 / 60 min / IP.
- **Logik:**
  1. Body parse mit `CustomerRegisterSchema`.
  2. E-Mail in lowercase normalisieren.
  3. Existiert `customer_users` mit dieser E-Mail? → 409 `CONFLICT`
     mit `field: 'email'`.
  4. `passwordHash = bcrypt.hash(password, 10)`.
  5. `verificationToken = cuid()`.
  6. CustomerUser anlegen mit `emailVerified: false`.
  7. Mail `customerVerificationMail` an die E-Mail-Adresse mit Link
     `${BASE_URL}/konto/verifizieren?token=<verificationToken>`.
     Fire-and-forget mit Retry-Logik (siehe `lib/mail.ts`).
  8. Antwort 201 mit `{ id, email, emailVerified: false, verificationMailSent: <bool> }`.

#### `POST /api/customer/login`
- **Auth:** öffentlich.
- **Rate-Limit:** 10 / 15 min / IP.
- **Logik:**
  1. Lookup `customer_users.findUnique({ where: { email: lowercase } })`.
  2. Wenn nicht gefunden → konstante bcrypt-Last gegen DUMMY-Hash + 401
     mit Message "E-Mail oder Passwort ungültig".
  3. `bcrypt.compare(password, hash)` — bei false → 401 (gleiche Message).
  4. Wenn `emailVerified === false` → 422 `EMAIL_NOT_VERIFIED`.
  5. JWT signieren: `{ customerId, email }` mit `AUTH_SECRET`, exp 7d.
  6. Cookie `customer-session` setzen (httpOnly, Secure, SameSite=Lax,
     Max-Age 604800, Path=/).
  7. Antwort 200 mit `CustomerUserPublicSchema`.

#### `POST /api/customer/logout`
- Cookie löschen (`Max-Age=0`). 200 OK.

#### `GET /api/customer/me`
- Session lesen (helper `readCustomerSession()`).
- Wenn null → 401.
- DB-Lookup auf `customer_users.findUnique({ where: { id } })`. Wenn
  nicht gefunden (gelöschtes Konto, aber Cookie noch da) → 401 +
  Cookie löschen.
- Antwort `CustomerUserPublicSchema`.

#### `PATCH /api/customer/me`
- Auth via Session.
- Body `CustomerProfileUpdateSchema`.
- Wenn `email` im Body und ≠ aktueller Email:
  1. Existiert anderer User mit dieser E-Mail? → 409.
  2. `emailVerified: false`, `verificationToken = cuid()`, persistieren.
  3. Mail `customerVerificationMail` an die NEUE Adresse senden.
- Andere Felder direkt updaten.
- Antwort `CustomerUserPublicSchema`.

#### `GET /api/customer/verify?token=...`
- Lookup `customer_users.findUnique({ where: { verificationToken } })`.
- Wenn nicht gefunden ODER `createdAt < now - 24h` → Redirect 302 auf
  `/konto/login?error=invalid_token`.
- Sonst: `emailVerified: true`, `verificationToken: null`. **Auto-Login:**
  JWT signieren + Cookie setzen. Redirect 302 auf `/konto?verified=1`.

#### `POST /api/customer/resend-verification`
- Body `{ email }`. Lookup. Wenn nicht gefunden ODER schon verified → 200
  ohne Mail (Enumeration-Schutz). Sonst neuen `verificationToken`,
  Mail neu senden.
- Rate-Limit: 3 / 60 min / IP + 3 / 24h / Email.

#### `POST /api/customer/forgot-password`
- Body `{ email }`. Lookup. Wenn nicht gefunden → 200 ohne Mail.
- Sonst: `resetToken = cuid()`, `resetTokenExpiry = now + 1h`. Mail mit
  Link `${BASE_URL}/konto/passwort-zuruecksetzen?token=<resetToken>`.
- Rate-Limit: 3 / 60 min / IP + 3 / 24h / Email.

#### `POST /api/customer/reset-password`
- Body `CustomerResetPasswordSchema` (token + password + passwordConfirm).
- Lookup auf `resetToken`. Wenn nicht gefunden ODER
  `resetTokenExpiry < now` → 400 `VALIDATION_ERROR` mit Message "Der
  Link ist nicht mehr gültig".
- `passwordHash = bcrypt.hash(...)`. `resetToken: null,
  resetTokenExpiry: null`.
- Antwort 200.
- Rate-Limit: 5 / 60 min / IP.

### Kundenportal-Buchungen (US-26, US-27)

#### `GET /api/customer/bookings`
- **Auth:** Customer-Session.
- **Logik:**
  1. `me = readCustomerSession()`. 401 wenn null.
  2. `today = todayInBerlin()` ("YYYY-MM-DD").
  3. SELECT mit `customerId === me.id`, include `attachments, payment, review`.
  4. Split:
     - `upcoming`: `(date >= today AND status !== 'COMPLETED')` ODER
       (Slot-basiert: `slot.startsAt >= startOfTodayUTC` AND
       `status !== 'COMPLETED'`).
     - `past`: alles andere (insb. COMPLETED).
  5. Sortierung: upcoming asc, past desc.
  6. Pro Booking `isCancellable` und `cancellableUntilHours` und `canReview` berechnen:
     - `isCancellable`:
       - Status muss in `PORTAL_CANCELLABLE_STATUSES` sein.
       - Bei CONFIRMED: `bookingDateTime > now + 24h`.
       - Bei PENDING / COUNTER_PROPOSED: `date >= today`.
     - `cancellableUntilHours`: Stunden bis `bookingDateTime`. Negativ → null.
     - `canReview`: `status === 'COMPLETED' AND review === null`.
  7. Antwort `CustomerBookingsResponseSchema`.

#### `GET /api/customer/bookings/:id`
- Wie oben, aber für eine einzelne Buchung.
- Ownership-Check: wenn `customerId !== me.id` → 404 (nicht 403).

#### `POST /api/customer/bookings/:id/cancel`
- Booking-Lookup, Ownership-Check.
- `isCancellable` neu berechnen → 409 wenn false:
  - Status nicht erlaubt: Message "Diese Buchung kann nicht mehr
    storniert werden."
  - 24h-Frist verletzt: Message "Stornierung nur bis 24 Stunden vor
    Termin möglich. Bitte rufen Sie uns an: 0157-74787512."
- `prisma.booking.update({ data: { status: 'CANCELLED' } })`.
- Mail `cancellationToAdmin` (IT2-Bestand wiederverwendet) — fire-and-forget.
- Antwort 200 mit `{ id, status: 'CANCELLED', cancelledAt }`.

### Zahlung (US-28)

#### `POST /api/admin/bookings/:id/payment`
- **Auth:** Admin (NextAuth).
- **Body:** `CreatePaymentSchema` (`amount` in Cents, optional `description`).
- **Logik:**
  1. Booking-Lookup. Status muss `CONFIRMED` oder `COMPLETED` sein → sonst 409.
  2. Existiert bereits Payment? → 409 (Tom soll erst DELETE machen).
  3. Payment anlegen `{ bookingId, amount, currency: 'eur', description, status: 'PENDING' }`.
  4. Mail `paymentRequestToCustomer` an `booking.customerEmail` mit Link
     `${BASE_URL}/konto/zahlung/${bookingId}?token=${booking.cancelToken}`
     (Fallback-Token, falls Kunde nicht eingeloggt).
  5. Antwort 201 `PaymentSchema`.

#### `DELETE /api/admin/bookings/:id/payment`
- Admin. Payment muss `status === 'PENDING'` sein. Sonst 409.
- Delete + 204.

#### `POST /api/payments/create-session`
- **Auth:** Customer-Session ODER `cancelToken` im Body als Fallback.
- **Body:** `{ bookingId, cancelToken? }`.
- **Logik:**
  1. Auth-Check:
     - Cookie vorhanden: Booking muss `customerId === me.id`.
     - Sonst: `cancelToken` muss zur Booking gehören. Sonst 401.
  2. Payment-Lookup. Wenn null → 404.
  3. Status-Check:
     - PAID → 409.
     - REFUNDED → 409.
     - PENDING / FAILED → weiter.
  4. Stripe `checkout.sessions.create({ mode: 'payment', payment_method_types: ['card', 'paypal'], line_items: [...], metadata: { bookingId, paymentId }, success_url: '${BASE_URL}/konto/zahlung/erfolg?session_id={CHECKOUT_SESSION_ID}', cancel_url: '${BASE_URL}/konto/zahlung/${bookingId}', customer_email: booking.customerEmail, locale: 'de' })`.
     - Wallet-Buttons (Apple/Google Pay) sind über Stripe-Dashboard-
       Einstellung "Wallet" aktiv und werden auf Stripe-Hosted-Page
       progressively rendered.
  5. Payment update: `stripeSessionId = session.id`. Wenn vorher FAILED
     → status zurück auf PENDING.
  6. Antwort 201 `{ url, sessionId }`.

**Bei Stripe-Fehler:** 502 `STRIPE_ERROR`. Engineers loggen den
Stripe-Error für Tom.

#### `POST /api/payments/webhook`
- **Auth:** Stripe-Signatur (`stripe-signature`-Header) gegen
  `STRIPE_WEBHOOK_SECRET`.
- **Logik:**
  1. **WICHTIG**: Raw-Body lesen (`await req.text()`), NICHT `req.json()`,
     bevor Signatur geprüft ist (Body-Bytes müssen unverändert sein).
  2. `stripe.webhooks.constructEvent(rawBody, sigHeader, secret)` — wirft
     bei Invalidität → 400.
  3. Switch auf `event.type`:
     - `checkout.session.completed`:
       - `session = event.data.object` (cast als Stripe.Checkout.Session).
       - `bookingId = session.metadata.bookingId`.
       - Payment lookup. Wenn schon `status === 'PAID'` → 200, kein Update
         (Idempotenz).
       - `prisma.payment.update({ data: { status: 'PAID', paidAt: now } })`.
       - Mail `paymentReceivedToCustomer` + `paymentReceivedToAdmin` (fire-and-forget).
     - `checkout.session.expired` / `payment_intent.payment_failed`:
       - Status auf FAILED. Keine Mail.
     - `charge.refunded`:
       - Status auf REFUNDED. Mail `paymentRefundedToCustomer`.
     - Andere Events: ignorieren.
  4. Antwort 200 `{ received: true }`.

**Bei DB-Fehler nach Signatur-Check:** 500 (Stripe wiederholt
automatisch bis 3 Tage lang). Engineers loggen.

### Reviews (US-29)

#### `POST /api/customer/reviews`
- **Auth:** Customer-Session.
- **Rate-Limit:** 5 / 60 min / Customer.
- **Body:** `CreateReviewSchema`.
- **Logik:**
  1. Booking-Lookup. Wenn `customerId !== me.id` → 404.
  2. Status muss `COMPLETED` sein → 409 ("Bewertung erst nach
     Auftragsabschluss möglich.").
  3. `booking.review === null` prüfen → 409 ("Sie haben diese Buchung
     bereits bewertet.").
  4. Review anlegen mit `approved: false`.
  5. Optional: Mail an Tom "Neue Bewertung wartet auf Freigabe" (fire-and-forget).
  6. Antwort 201.

#### `GET /api/reviews`
- **Auth:** öffentlich.
- **Cache:** `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
- **Logik:**
  1. SELECT * FROM reviews WHERE approved = 1 ORDER BY createdAt DESC LIMIT ?
  2. Join mit Booking + CustomerUser, um `customerName` ("Vorname N.")
     und `service` (Slug) auszuliefern. Wenn CustomerUser oder Booking
     null (verwaiste Review), Fallback: customerName='Anonym', service=null.
  3. `average = SUM(stars) / COUNT(*)`. `total = COUNT(*)`.
  4. Antwort `{ items, average, total }`.

#### `GET /api/admin/reviews`
- Admin. Optionaler `?approved=true|false`-Filter. Sortierung
  `createdAt desc`. Volle Daten.

#### `PATCH /api/admin/reviews/:id`
- Admin. Body `{ approved }`. Idempotent.
- Optional: Mail an Kunden bei Erst-Freigabe.

### Booking-Erweiterung (US-26)

#### `POST /api/bookings` (erweitert)
- Body unverändert.
- **Backend liest Customer-Session und befüllt `customerId` automatisch.**
  ```ts
  const session = await readCustomerSession();
  const data = CreateBookingSchema.parse(body);
  await prisma.booking.create({
    data: { ...data, customerId: session?.customerId ?? null },
  });
  ```
- Sonst alles wie IT3.

#### `PATCH /api/bookings/:id` (erweitert)
- Admin. `UpdateBookingStatusSchema` akzeptiert jetzt
  `'COMPLETED'` zusätzlich.
- State-Machine:
  - CONFIRMED → COMPLETED: erlaubt.
  - Andere Übergänge zu COMPLETED: 400.
  - COMPLETED → andere: 400 (Endstatus).
- Optional: Mail an Kunden "Termin abgeschlossen — bitte bewerten Sie uns!"
  bei CONFIRMED → COMPLETED-Übergang. Fire-and-forget.

## Business Logic

### Stornierungsfrist (US-27)

Konstante: `PORTAL_CANCEL_DEADLINE_HOURS = 24`.

```ts
function isPortalCancellable(booking: Booking, now: Date): boolean {
  if (!PORTAL_CANCELLABLE_STATUSES.includes(booking.status)) return false;

  // Heutige Buchung ohne Datum (Bestand IT1/IT2 Slot) → Slot-Datum nutzen.
  const bookingDateTime = booking.date && booking.startTime
    ? parseBerlinDateTime(booking.date, booking.startTime)
    : booking.slot?.startsAt ?? null;

  if (!bookingDateTime) return false;

  if (booking.status === 'CONFIRMED') {
    return bookingDateTime.getTime() - now.getTime() > 24 * 60 * 60 * 1000;
  }

  // PENDING / COUNTER_PROPOSED dürfen IMMER storniert werden, solange
  // der Termin nicht in der Vergangenheit liegt.
  return bookingDateTime > now;
}
```

### E-Mail-Verifikations-Flow (US-25)

- Token gültig 24h (gemessen über `createdAt`, kein dedizierter Expiry).
- Verifikation per `GET /api/customer/verify?token=...`. Nach Erfolg:
  Auto-Login (Cookie wird gesetzt) + Redirect auf `/konto?verified=1`.

### Stripe-Webhook-Idempotenz (US-28)

- Vor jedem Status-Update prüfen, ob der neue Status bereits gesetzt
  ist. Wenn ja, 200 ohne Mail-Versand. Verhindert doppelte
  Bestätigungs-Mails bei Stripe-Retries.

### Review-Approval (US-29)

- `approved: false` ist Default. Tom sieht in `/admin/reviews` alle
  pending Reviews und drückt "Freigeben" → `PATCH /api/admin/reviews/:id`
  mit `{ approved: true }`.
- Öffentliche Liste (`GET /api/reviews`) zeigt nur `approved: true`.
- Replacement-Schwelle: ≥ 4 freigegebene Reviews → Frontend ersetzt
  statische Daten aus IT3.

### CustomerName-Anonymisierung in `GET /api/reviews`

```ts
function publicCustomerName(user: CustomerUser | null): string {
  if (!user) return 'Anonym';
  return `${user.firstName} ${user.lastName.charAt(0)}.`;
}
```

## Authentication & Authorization

### Mechanismen

| Bereich  | Mechanismus                                | Cookie                       | Lifetime |
| -------- | ------------------------------------------ | ---------------------------- | -------- |
| Admin    | NextAuth Credentials Provider (Bestand)    | `next-auth.session-token`    | 24h sliding |
| Kunde    | Eigenes JWT-Cookie (HS256, `AUTH_SECRET`)  | `customer-session`           | 7d fix   |

Beide Cookies können parallel existieren (verschiedene Namen).

### Helper

- `src/lib/auth.ts` (NextAuth, Bestand) — Admin-Auth.
- `src/lib/customer-auth.ts` (NEU IT4):
  - `createCustomerSession({ customerId, email })` → JWT.
  - `setCustomerSessionCookie(token)` / `clearCustomerSessionCookie()`.
  - `readCustomerSession()` (für Route-Handler, nutzt `next/headers`).
  - `readCustomerSessionFromRequest(req)` (für Middleware, edge-safe).

### Middleware-Routing

Bestehende Middleware (`src/middleware.ts`) erweitert:

- Matcher: `['/admin/:path*', '/konto/:path*']`.
- `/admin/*`: bestehende Logik.
- `/konto/*`:
  - Public-Whitelist: `/konto/login`, `/konto/registrieren`,
    `/konto/passwort-vergessen`, `/konto/passwort-zuruecksetzen`,
    `/konto/verifizieren`.
  - `/konto/zahlung/:id?token=...`: öffentlich, wenn `token` vorhanden.
  - Sonst: `customer-session`-Cookie-Validität prüfen → Redirect auf
    `/konto/login?callbackUrl=...`.

### Role/Permission-Modell

Im MVP zwei Rollen:

- **Admin (User):** Vollzugriff auf `/admin/*` + `/api/admin/*`.
- **Kunde (CustomerUser):** Zugriff auf `/konto/*` + `/api/customer/*`,
  beschränkt auf eigene Ressourcen (Ownership-Check `customerId === me.id`).

Es gibt keine geteilten Endpunkte zwischen Admin und Kunde.
Existenz-Enumeration wird durch 404 (statt 403) bei Fremdzugriff
verhindert.

## Background Jobs

**Stripe-Webhook** ist kein klassischer Background-Job, sondern ein
HTTP-Endpoint, der von Stripe asynchron getriggert wird. Stripe
wiederholt fehlgeschlagene Webhooks bis 3 Tage lang — Backend muss
robust mit Retries umgehen (Idempotenz).

**Verzichtet auf:**

- Self-Service-Account-Delete-Cron (Backlog).
- Auto-Mark-COMPLETED-Cron (Tom markiert manuell).

## External Integrations

### Stripe

- **SDK:** `stripe` npm-Paket.
- **Endpoints genutzt:** `stripe.checkout.sessions.create`,
  `stripe.webhooks.constructEvent`.
- **API-Version:** `2024-04-10`.
- **Webhook-Events abonniert:**
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `payment_intent.payment_failed`
  - `charge.refunded`
- **Test-Mode:** `sk_test_...`. Lokal: `stripe listen --forward-to
  localhost:3000/api/payments/webhook` (Stripe CLI).
- **Wallet-Buttons (Apple Pay / Google Pay):** in Stripe-Dashboard
  unter "Settings → Payment methods" aktiviert; Stripe Checkout zeigt
  sie automatisch auf kompatiblen Geräten.

### Resend (Bestand IT1, neue Templates IT4)

Neue Templates in `src/lib/mail.ts`:

| Template                              | Trigger                                        | Empfänger |
| ------------------------------------- | ---------------------------------------------- | --------- |
| `customerVerificationMail`            | Register / Email-Change                        | Kunde     |
| `customerPasswordResetMail`           | Forgot-Password                                | Kunde     |
| `customerEmailChangedMail`            | Profile-Update mit Email-Änderung              | Kunde (NEU) |
| `paymentRequestToCustomer`            | Admin legt Payment an                          | Kunde     |
| `paymentReceivedToCustomer`           | Stripe-Webhook `checkout.session.completed`    | Kunde     |
| `paymentReceivedToAdmin`              | Stripe-Webhook `checkout.session.completed`    | Tom       |
| `paymentRefundedToCustomer`           | Stripe-Webhook `charge.refunded`               | Kunde     |
| `bookingCompletedReviewInviteToCustomer` (optional) | `PATCH bookings/:id` zu COMPLETED | Kunde     |
| `newReviewToAdmin` (optional)         | `POST /api/customer/reviews`                   | Tom       |

Template-Inhalte folgen dem IT2-Pattern (Anrede, Termin/Service-Info, CTA-Link, Footer mit Tom-Kontakt).

## Non-functional Requirements

### Performance

- API-Antwortzeiten: p95 < 300 ms (Bestand-Ziel; Iteration 4 ergänzt
  keine schweren Queries).
- `GET /api/customer/bookings`: erwartete Mengen < 50 Bookings/Kunde →
  kein Pagination im MVP (Index `(customerId, date)` deckt Sort).
- `GET /api/reviews`: ggf. mehrere hundert Einträge möglich → Default
  limit 20, max 100. Cache `max-age=60`.

### Sicherheit

- bcrypt cost 10 (~100 ms/Versuch) als natürliche Brute-Force-Bremse.
- Rate-Limits via Upstash siehe API-Spec §20.
- Stripe-Webhook **muss** Signatur prüfen, bevor DB geschrieben wird.
- Generic Error-Messages bei Login (kein Existenz-Leak).
- 404 statt 403 bei Fremdzugriff auf Bookings/Reviews/Payments.
- httpOnly + Secure (Production) + SameSite=Lax für `customer-session`.

### Logging & Observability

- Vercel-Logs für alle Route-Handler (Bestand).
- Stripe-Webhook-Events: bei jedem Event `console.info('[stripe-webhook]', event.type, event.id)`. Bei Fehler `console.error`.
- Rate-Limit-Treffer: `console.warn` mit IP-Hash.
- Nicht loggen: Reset-Tokens, Verifikations-Tokens, Stripe-Session-Secrets.

### Datenschutz

- `GET /api/reviews` kürzt `customerName` automatisch.
- Kein Klartext-Passwort-Logging. Bei bcrypt-Fehlern nur Error-Code.
- Aufbewahrungsfristen siehe ARCHITECTURE.md §11 — Iteration 4 ändert
  daran nichts (CustomerUsers, Payments, Reviews bleiben unbegrenzt).

## Story Coverage

| Story | Backend Deliverable                                                                                                                                                                                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-25 | Tabelle `customer_users`, 9 Endpunkte unter `/api/customer/*` (register, login, logout, me GET/PATCH, verify, resend-verification, forgot-password, reset-password), JWT-Cookie-Helper `lib/customer-auth.ts`, Middleware-Erweiterung, 3 neue Mail-Templates. |
| US-26 | Feld `bookings.customer_id` mit FK + Index, automatische Befüllung in `POST /api/bookings` aus Customer-Session, `GET /api/customer/bookings` (upcoming/past Split), `GET /api/customer/bookings/:id`, `isCancellable` + `cancellableUntilHours` + `canReview` Berechnung. |
| US-27 | `POST /api/customer/bookings/:id/cancel` mit serverseitigem 24h-Frist-Check (Konstante `PORTAL_CANCEL_DEADLINE_HOURS`), Status-Whitelist, IT2-Mail-Template `cancellationToAdmin` wiederverwendet. |
| US-28 | Tabelle `payments`, Stripe-SDK-Integration `lib/stripe.ts`, `POST /api/admin/bookings/:id/payment` (Tom legt Betrag an), `DELETE /api/admin/bookings/:id/payment` (Tom korrigiert), `POST /api/payments/create-session` (Stripe Checkout), `POST /api/payments/webhook` (mit Signatur-Check + 4 Event-Types + Idempotenz), 4 neue Mail-Templates. |
| US-29 | Tabelle `reviews` mit `approved`-Flag, Status `BookingStatus.COMPLETED` neu, `POST /api/customer/reviews` (Vorbedingungs-Checks COMPLETED + ohne bestehende Review), `GET /api/reviews` (öffentlich, kürzt customerName, sortiert + Cache), `GET /api/admin/reviews` (Filter), `PATCH /api/admin/reviews/:id` (Approve/Reject), `PATCH /api/bookings/:id` erlaubt jetzt `COMPLETED`. |

## ENV Variables (Iteration 4 ergänzt)

| Variable                  | Pflicht | Beispiel                          | Zweck                                                          |
| ------------------------- | ------- | --------------------------------- | -------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`       | ja      | `sk_test_...` / `sk_live_...`     | Stripe-API-Auth (Server).                                       |
| `STRIPE_PUBLISHABLE_KEY`  | ja      | `pk_test_...` / `pk_live_...`     | Reserviert für Stripe Elements (im MVP nicht aktiv genutzt).    |
| `STRIPE_WEBHOOK_SECRET`   | ja      | `whsec_...`                       | Signatur-Validierung im Webhook-Handler.                        |
| `AUTH_SECRET`             | ja      | bestehender NEXTAUTH_SECRET-Wert  | Wird auch fürs Customer-JWT-Signing genutzt (alias OK).         |

`.env.example` entsprechend ergänzen mit Hinweisen zu Test-Mode-Keys und
Stripe-CLI-Setup.
