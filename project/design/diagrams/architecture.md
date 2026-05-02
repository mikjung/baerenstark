# System Architecture — Iteration 4

Erweiterung der Bestand-Architektur (IT1–IT3) um **Kundenportal**,
**Stripe-Zahlungen** und **Bewertungs-Backend**. Alles bleibt im
Vercel-deployten Next.js-Monolith — keine Microservices.

## Component Diagram

```mermaid
graph TB
    subgraph Browser["Browser (Public + Customer + Admin)"]
        Visitor[Besucher]
        Customer[Kunde<br/>eingeloggt]
        Admin[Tom<br/>Admin]
    end

    subgraph Vercel["Vercel — Next.js 14 App"]
        subgraph Pages["App Router Pages"]
            HomePage["/<br/>Startseite + Reviews"]
            BookingPage["/buchung<br/>Buchungsformular"]
            KontoPages["/konto/*<br/>Kundenportal (NEU IT4)"]
            AdminPages["/admin/*<br/>Admin-UI (erweitert)"]
        end

        subgraph API["API Route Handlers"]
            CustomerAuth["/api/customer/*<br/>Register/Login/Reset (NEU IT4)"]
            CustomerData["/api/customer/bookings<br/>/api/customer/reviews (NEU IT4)"]
            Payments["/api/payments/*<br/>create-session + webhook (NEU IT4)"]
            AdminReviews["/api/admin/reviews<br/>(NEU IT4)"]
            AdminPayment["/api/admin/bookings/:id/payment<br/>(NEU IT4)"]
            ExistingAPI["Bestand: /api/bookings, /api/upload,<br/>/api/admin/availability-template, ..."]
        end

        subgraph Lib["src/lib"]
            CustomerAuthLib[customer-auth.ts<br/>JWT helpers]
            StripeLib[stripe.ts<br/>SDK singleton]
            MailLib[mail.ts<br/>Resend templates]
            PrismaLib[prisma.ts]
        end

        Middleware[middleware.ts<br/>schützt /admin + /konto]
    end

    subgraph External["External Services"]
        Turso[(Turso<br/>SQLite + libSQL)]
        VercelBlob[(Vercel Blob<br/>uploads)]
        Resend[Resend<br/>Mail-Provider]
        Stripe[Stripe<br/>Checkout + Webhooks]
        Upstash[Upstash Redis<br/>Rate-Limit]
    end

    Visitor --> HomePage
    Visitor --> BookingPage
    Customer --> KontoPages
    Admin --> AdminPages

    HomePage -.GET /api/reviews.-> CustomerData
    BookingPage -.POST /api/bookings.-> ExistingAPI
    KontoPages --> CustomerAuth
    KontoPages --> CustomerData
    KontoPages --> Payments
    AdminPages --> AdminReviews
    AdminPages --> AdminPayment
    AdminPages --> ExistingAPI

    Middleware -.cookie-check.-> KontoPages
    Middleware -.cookie-check.-> AdminPages

    CustomerAuth --> CustomerAuthLib
    CustomerAuth --> MailLib
    CustomerAuth --> PrismaLib
    CustomerData --> CustomerAuthLib
    CustomerData --> PrismaLib
    Payments --> StripeLib
    Payments --> MailLib
    Payments --> PrismaLib
    AdminReviews --> PrismaLib
    AdminPayment --> StripeLib
    AdminPayment --> MailLib

    PrismaLib --> Turso
    StripeLib --> Stripe
    MailLib --> Resend
    ExistingAPI --> VercelBlob
    CustomerAuth -.rate-limit.-> Upstash
    Payments -.rate-limit.-> Upstash

    Stripe -.webhook POST.-> Payments
```

## Sequence Diagram — Kunden-Zahlung (US-28)

Der wichtigste neue Flow in IT4: ein Kunde bezahlt einen vom Admin
hinterlegten Betrag.

```mermaid
sequenceDiagram
    actor Tom as Tom (Admin)
    actor Customer as Kunde
    participant FE as Frontend (Next.js)
    participant BE as Backend (API)
    participant DB as Turso DB
    participant Stripe as Stripe
    participant Mail as Resend

    Note over Tom,FE: Tom hinterlegt Betrag im Admin-UI
    Tom->>FE: PaymentEditor öffnen,<br/>Betrag (€) eingeben
    FE->>BE: POST /api/admin/bookings/:id/payment<br/>{ amount, description }
    BE->>DB: INSERT payments (status: PENDING)
    BE->>Mail: paymentRequestToCustomer<br/>(Link → /konto/zahlung/:id?token=...)
    Mail-->>Customer: E-Mail mit Zahlungslink
    BE-->>FE: 201 Payment

    Note over Customer,FE: Kunde öffnet Zahlungsseite
    Customer->>FE: GET /konto/zahlung/:bookingId<br/>(eingeloggt ODER ?token=cancelToken)
    FE->>BE: GET /api/customer/bookings/:id
    BE->>DB: SELECT booking + payment
    BE-->>FE: { booking, payment: { status: PENDING, amount } }
    FE-->>Customer: Zeigt Betrag + Bezahlen-Button

    Customer->>FE: Klick "Bezahlen"
    FE->>BE: POST /api/payments/create-session<br/>{ bookingId, cancelToken? }
    BE->>BE: Auth-Check (Cookie ODER Token)
    BE->>DB: SELECT payment WHERE bookingId
    BE->>Stripe: stripe.checkout.sessions.create({<br/>amount, success_url, cancel_url,<br/>payment_method_types: [card, paypal],<br/>metadata: { bookingId, paymentId } })
    Stripe-->>BE: { id, url }
    BE->>DB: UPDATE payments SET stripeSessionId
    BE-->>FE: { url: "https://checkout.stripe.com/..." }
    FE->>Customer: window.location = url

    Note over Customer,Stripe: Kunde bezahlt auf Stripe-Hosted-Page
    Customer->>Stripe: Karte/PayPal/Apple Pay/Google Pay
    Stripe-->>Customer: Erfolg → Redirect success_url

    Note over Stripe,BE: Asynchrone Webhook-Verarbeitung
    Stripe->>BE: POST /api/payments/webhook<br/>event: checkout.session.completed<br/>+ stripe-signature header
    BE->>BE: stripe.webhooks.constructEvent<br/>(rawBody, sig, WEBHOOK_SECRET)
    BE->>DB: UPDATE payments<br/>SET status=PAID, paidAt=now<br/>(idempotent: skip wenn schon PAID)
    BE->>Mail: paymentReceivedToCustomer
    BE->>Mail: paymentReceivedToAdmin
    Mail-->>Customer: "Vielen Dank, Zahlung eingegangen"
    Mail-->>Tom: "Zahlung von ... eingegangen"
    BE-->>Stripe: 200 { received: true }

    Note over Customer,FE: Kunde wird auf Erfolgsseite weitergeleitet
    Customer->>FE: GET /konto/zahlung/erfolg?session_id=...
    FE->>BE: GET /api/customer/bookings/:bookingId<br/>(Polling, max 10s)
    BE->>DB: SELECT booking + payment
    BE-->>FE: { payment: { status: PAID } }
    FE-->>Customer: "Zahlung erfolgreich" + Link auf Auftragsdetails
```

## Sequence Diagram — Kunden-Registrierung & Verifikation (US-25)

```mermaid
sequenceDiagram
    actor Customer as Kunde
    participant FE as Frontend
    participant BE as Backend (API)
    participant DB as Turso DB
    participant Mail as Resend

    Customer->>FE: GET /konto/registrieren
    Customer->>FE: Form ausfüllen + Submit
    FE->>BE: POST /api/customer/register<br/>{ email, password, firstName, lastName, ... }
    BE->>BE: bcrypt.hash(password, 10)
    BE->>BE: cuid() → verificationToken
    BE->>DB: INSERT customer_users<br/>(emailVerified: false, verificationToken)
    BE->>Mail: customerVerificationMail<br/>(Link mit Token)
    Mail-->>Customer: E-Mail mit Verifikations-Link
    BE-->>FE: 201 { id, email, emailVerified: false }
    FE-->>Customer: "Bitte bestätigen Sie Ihre E-Mail"

    Note over Customer: Kunde klickt Link
    Customer->>FE: GET /konto/verifizieren?token=...
    FE->>BE: GET /api/customer/verify?token=...
    BE->>DB: SELECT WHERE verificationToken
    alt Token gültig (< 24h alt)
        BE->>DB: UPDATE emailVerified=true,<br/>verificationToken=null
        BE->>BE: createCustomerSession({ id, email })<br/>→ JWT
        BE-->>FE: 302 Redirect /konto?verified=1<br/>+ Set-Cookie: customer-session
    else Token ungültig/abgelaufen
        BE-->>FE: 302 Redirect /konto/login?error=invalid_token
    end
    FE-->>Customer: Eingeloggt → Auftragsübersicht
```

## Sequence Diagram — Stornierung mit 24h-Check (US-27)

```mermaid
sequenceDiagram
    actor Customer as Kunde
    participant FE as Frontend
    participant BE as Backend
    participant DB as Turso
    participant Mail as Resend
    actor Tom

    Customer->>FE: /konto/auftrag/:id<br/>(sieht "Stornieren"-Button)
    Customer->>FE: Klick "Stornieren"<br/>→ Confirm-Dialog
    Customer->>FE: "Ja, stornieren"
    FE->>BE: POST /api/customer/bookings/:id/cancel
    BE->>BE: readCustomerSession() → me
    BE->>DB: SELECT booking WHERE id, customerId=me
    alt Booking nicht gefunden / fremd
        BE-->>FE: 404 NOT_FOUND
    else Status nicht in {PENDING, CONFIRMED, COUNTER_PROPOSED}
        BE-->>FE: 409 CONFLICT<br/>"Diese Buchung kann nicht mehr storniert werden."
    else CONFIRMED + < 24h vor Termin
        BE-->>FE: 409 CONFLICT<br/>"Stornierung nur bis 24h vorher. Bitte anrufen."
    else OK
        BE->>DB: UPDATE booking SET status=CANCELLED
        BE->>Mail: cancellationToAdmin (fire-and-forget)
        Mail-->>Tom: "Kunde hat storniert"
        BE-->>FE: 200 { id, status: CANCELLED }
        FE-->>Customer: Status-Badge wechselt + Toast
    end
```

## Data Flow Notes

### `customer-session`-Cookie

- Vom Backend ausgestellt bei `POST /api/customer/login` und nach
  erfolgreicher `GET /api/customer/verify`.
- Vom Frontend nur indirekt sichtbar (httpOnly = nicht via JS lesbar).
- Bei jedem Request zu `/konto/*` und `/api/customer/*` automatisch
  mitgesendet (Browser-Default).
- Inhalt: signiertes JWT mit `{ customerId, email, iat, exp }`.

### Booking-Customer-Zuordnung

- Beim `POST /api/bookings`: Backend liest `customer-session`-Cookie
  via `readCustomerSession()` und befüllt `customerId` automatisch.
  Frontend sendet **kein** zusätzliches Feld.
- Bei eingeloggter Buchung: `bookings.customerId !== null`.
- Bei Gastbuchung: `bookings.customerId === null` (sichtbar nur im
  Admin-UI, nicht im Kundenportal).

### Stripe-Webhook-Idempotenz

- Stripe-Webhooks können **mehrfach** ankommen (bei Timeout, Retry).
- Backend prüft vor jedem Status-Update, ob der Status schon gesetzt ist.
- `paymentReceivedToCustomer` + `paymentReceivedToAdmin` werden nur
  beim **ersten** PENDING → PAID-Übergang gesendet.

### Review-Sichtbarkeit

- `POST /api/customer/reviews` legt mit `approved: false` an.
- Tom sieht in `/admin/reviews` (Tab "Wartend") alle pending Reviews.
- Nach `PATCH /api/admin/reviews/:id { approved: true }` wird die
  Review von `GET /api/reviews` ausgeliefert.
- `<ReviewSection>` auf der Startseite ersetzt die statischen IT3-Daten,
  sobald `total >= 4` echte (approved) Reviews vorliegen.

## Integration Contract

Verbindlich für FE und BE. Mehrteilige Konventionen für IT4-spezifische
Aspekte ergänzen den Bestand-Vertrag aus IT1–IT3.

### Transport
- HTTPS in Production. JSON für Bodies (außer `/api/upload`:
  multipart/form-data; `/api/payments/webhook`: rohes JSON ohne
  unser Pre-Parse — Stripe-Signatur).

### Auth-Header / Cookie
- **Admin (Bestand):** `next-auth.session-token` Cookie (NextAuth).
- **Kunde (NEU IT4):** `customer-session` Cookie (eigenes JWT).
- **Token-Auth (Bestand IT2):** `?token=cancelToken` Query.
- **Stripe-Webhook (NEU IT4):** `stripe-signature` Header
  (Validierung gegen `STRIPE_WEBHOOK_SECRET`).

### Error-Format

Unverändert seit IT2:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "field": "email" } }
```

Neue Codes IT4: `EMAIL_NOT_VERIFIED` (422), `STRIPE_ERROR` (502).
Vollständige Liste siehe `contracts/zod-schemas.ts.ApiErrorSchema`.

### Pagination

Im MVP nicht erzwungen. `GET /api/reviews` akzeptiert optional
`?limit=N` (1–100, Default 20). Andere Listen ohne Pagination
(erwartete Mengen < 100).

### Timestamps
- Alle DateTime-Werte im API-Response: ISO 8601 mit Offset (Z-Suffix).
- Customer-side Datums-Strings für Termine: `"YYYY-MM-DD"` (Berlin-TZ),
  `"HH:MM"` (Bestand IT3).

### IDs
- Alle IDs: `cuid` (Strings).
- Stripe-Session-IDs: `cs_test_...` / `cs_live_...` — werden separat in
  `payments.stripeSessionId` persistiert.
- Cancel-/Reset-/Verification-Tokens: `cuid()` erzeugt.

### Beträge
- **Im API-Wire-Format:** Cents als Integer (`amount: 14000` = 140,00 €).
- **In der UI:** Euro mit `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`.
- Frontend rechnet Euro → Cents via `Math.round(parseFloat(eurInput) * 100)`.

### Stripe-Checkout-Session-Konvention
- `mode: 'payment'` (one-time, kein Subscription).
- `payment_method_types: ['card', 'paypal']` — Apple Pay / Google Pay
  laufen automatisch über `card`, sofern im Stripe-Dashboard aktiviert.
- `success_url`: `${BASE_URL}/konto/zahlung/erfolg?session_id={CHECKOUT_SESSION_ID}`.
- `cancel_url`: `${BASE_URL}/konto/zahlung/${bookingId}`.
- `metadata`: `{ bookingId, paymentId }` — Webhook-Handler nutzt das
  zum Lookup.
- `customer_email`: vorab aus Booking gefüllt (Kunde muss nicht erneut
  eingeben).
- `locale: 'de'`.

### Customer-Session-JWT

```
Algorithm: HS256
Secret:    AUTH_SECRET (32+ Zeichen Random)
Payload:   { customerId: string, email: string, iat: number, exp: number }
Lifetime:  7 Tage (604800 s)
```

Der Token wird **nicht serverseitig persistiert** (kein Token-Store). Bei
Logout wird das Cookie nur clientseitig gelöscht — bestehende JWTs
bleiben bis zum exp gültig (akzeptabler MVP-Trade-off).

### Webhook-Endpoint-Anforderungen

- Path: `/api/payments/webhook`.
- Methode: POST.
- Authentication: ausschließlich Stripe-Signatur (`stripe-signature`
  Header).
- Body-Parsing: **rohes** Text-Reading (`await req.text()`) vor
  Signatur-Check. Kein Next.js-JSON-Auto-Parse zulassen.
- Antwort: 200 `{ received: true }` bei Erfolg; 400 bei Signatur-Fehler.
- Idempotenz: Status-Check vor Update; doppelte Events liefern 200, kein
  zweiter Mail-Versand.

### `/konto/*`-Routing-Vertrag

Public-Whitelist (kein Login nötig):

- `/konto/login`
- `/konto/registrieren`
- `/konto/passwort-vergessen`
- `/konto/passwort-zuruecksetzen?token=...`
- `/konto/verifizieren?token=...`
- `/konto/zahlung/:bookingId?token=...` (mit Token: öffentlich;
  ohne: Login-Pflicht)

Alle anderen `/konto/*`-Pfade → Middleware-Redirect auf
`/konto/login?callbackUrl=<original-path>`.
