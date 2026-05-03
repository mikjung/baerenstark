# API-Routen — Bärenstark Hausservice

**Verbindliche Spezifikation für Frontend & Backend.**
Alle Endpunkte sind Next.js Route Handlers unter `src/app/api/`.

**Version:** 1.6.0 (Iteration 6 — US-IT6-01 bis US-IT6-09)

**Änderungen v1.6.0 gegenüber v1.5.1:**

- **US-IT6-01 (Multi-Admin):** 4 neue Admin-Endpunkte (`/api/admin/admins(/:id)`).
- **US-IT6-02 (Kalender-UX):** 2 neue Endpunkte — `/api/admin/calendar/events` (Aggregator), `/api/availability/calendar` (öffentlicher Tag-Status-Feed).
- **US-IT6-03 (Reviews):** Vorbedingung `POST /api/customer/reviews` auf `status='COMPLETED'` verschärft. `GET /api/admin/reviews?status=` neuer Filter. `PATCH /api/admin/reviews/:id` setzt zusätzlich `rejectedAt`/`moderatedAt`/`moderatedById`. Neue Fehlercodes `BOOKING_NOT_COMPLETED`, `REVIEW_EXISTS`.
- **US-IT6-04 (SEO):** `sitemap.xml` und `robots.txt` als Next.js-Routes — keine API-Endpunkte.
- **US-IT6-05 (Auth-Bereinigung):** Folgende Endpunkte werden **gelöscht** (404 nach IT6): `POST /api/customer/login`, `POST /api/customer/register`, `POST /api/customer/forgot-password`, `POST /api/customer/reset-password`, `POST /api/customer/resend-verification`, `GET /api/customer/verify`. Customer-OAuth-Provider auf Google + Facebook reduziert (GitHub raus).
- **US-IT6-06 (User-Wipe):** kein HTTP-Endpoint; nur Skript `scripts/reset-users.ts` mit ENV-Gate `ALLOW_USER_WIPE=true`.
- **US-IT6-07 (Admin-Userverwaltung):** 4 neue Endpunkte (`/api/admin/users(/:id)`). Neues DTO `CustomerUserAdminSchema` (mit `adminNote`/`adminRating`); `CustomerUserPublicSchema` bleibt leak-frei.
- **US-IT6-08 (Finaler Preis):** `PATCH /api/admin/bookings/:id` erweitert um `finalPriceEur` + `finalPriceNote`. `BookingAdminSchema` erweitert; `CustomerBookingSchema` filtert die Felder explizit aus.
- **US-IT6-09 (Analytics):** Neuer Endpoint `GET /api/admin/analytics?range=`. Page `/admin/analytics` lädt direkt via `lib/analytics.ts` (Server-Component); API ist Future-Use.
- **Querschnitt:** `requireAdmin()`-Helper (siehe ARCHITECTURE_IT6.md §12) ist verbindlich für alle Admin-Endpunkte. Neue Fehlercodes `ACCOUNT_DISABLED` (422), `LAST_ADMIN_LOCK` (409), `SELF_MUTATION_FORBIDDEN` (409).

---

**Version:** 1.5.1 (Iteration 5 — Design-Revision nach QA, US-30 bis US-34)

**Änderungen v1.5.1 gegenüber v1.5 (Design-Revision, kein Code-Bruch
— nur Spec-Schärfung + 1 neuer öffentlicher Endpoint):**

- **BUG-IT5-001 (Critical):** `POST /api/bookings` IT3/IT5-Modus
  führt jetzt verbindlich Overlap-Check + Buffer-Check + Insert in
  einer SQLite-Transaktion mit `BEGIN IMMEDIATE`-Semantik aus
  (Prisma `$transaction` mit `isolationLevel: 'Serializable'`).
  Schutz gegen Race-Condition bei überlappenden Dauern. Siehe
  ARCHITECTURE.md §18.5.5.
- **BUG-IT5-002 (Major):** **NEUER öffentlicher Endpoint**
  `GET /api/customer/oauth-finalize` — Brücke zwischen
  NextAuth-OAuth-Callback und unserem `customer-session`-JWT-Cookie
  (siehe §21.2.1 unten).
- **BUG-IT5-004 (Major):** Account-Linking-Sicherheit
  differenziert. `OAUTH_UNVERIFIED_CONFLICT` (422) als neuer
  Fehlercode (Redirect-Query-Param). Siehe ARCHITECTURE.md §18.9.2.
- **Deployment-URL:** Produktions-Domain wechselt von
  `baerenstark.vercel.app` auf `https://www.baerenstark-hausservice.app`.
  Alle OAuth-Callback-URLs (Google + GitHub) und ENV-Variablen
  entsprechend aktualisiert.

**Änderungen v1.5 gegenüber v1.4.1:**

- **US-30 (Admin-Pw-Reset UX-Fix):** kein neuer Endpoint; bestehende
  `POST /api/admin/forgot-password` und `POST /api/admin/reset-password`
  bleiben funktional. Fix ist UX/Routing-Layer (Middleware-Whitelist
  verifizieren, BASE_URL-Resolver härten — siehe ARCHITECTURE.md §18.1).
- **US-31 (OAuth2 Customer-Login):** **Neuer NextAuth-Handler** für
  Kunden mit Google + GitHub:
  - `GET/POST /api/auth/customer/[...nextauth]` — NextAuth-Routes für
    Customer-OAuth (separater Handler-Pfad, kollidiert NICHT mit dem
    Admin-NextAuth unter `/api/auth/[...nextauth]`).
  - Nach erfolgreichem OAuth-Callback: Backend findet/erstellt einen
    `CustomerUser` (Lookup via E-Mail, dann Provider-ID), setzt das
    bestehende `customer-session`-JWT-Cookie und redirect zu `/konto`.
  - Bestehender `POST /api/customer/login` bleibt **unverändert** —
    OAuth ist additiv. Versucht ein Kunde sich per Pw gegen ein
    OAuth-only-Konto einzuloggen → 422 `OAUTH_ONLY_ACCOUNT`.
- **US-32 (Adressfeld):** `POST /api/bookings` Body um drei Pflichtfelder
  erweitert (`addressStreet`, `addressZip`, `addressCity`). Response von
  `GET /api/bookings`, `GET /api/customer/bookings(/:id)`,
  `GET /api/admin/upcoming-bookings` enthält die Felder (nullable für
  Bestand).
- **US-33 (Buchungsdauer):** `POST /api/bookings` Body um `durationMinutes`
  erweitert (Pflicht im IT3/IT5-Modus). `GET /api/slots/available` erhält
  optionalen Query-Param `?duration=NNN` und prüft Verfügbarkeit für die
  gewünschte Dauer (Default = `slotDurationMinutes` aus dem Template,
  IT3-rückwärtskompatibel).
- **US-34 (Buffer-Zeit):** Zwei neue Admin-Endpunkte:
  - `GET  /api/admin/buffer-config` — aktuellen Wert lesen.
  - `PUT  /api/admin/buffer-config` — neuen Wert setzen (Whitelist).
  - `GET /api/slots/available` berücksichtigt Buffer-Blöcke nach
    CONFIRMED-Buchungen automatisch.
- **Neue Fehlercodes:** `OAUTH_ONLY_ACCOUNT` (422), `OAUTH_ERROR` (502),
  `OAUTH_UNVERIFIED_CONFLICT` (422, v1.5.1 Fix BUG-IT5-004 — wird als
  Redirect-Query-Param `?error=oauth_unverified_conflict` ausgeliefert,
  nicht als API-Response).

**Version:** 1.4.1 (Iteration 4 Revision — QA-Fixes BUG-401/402, MAJOR-401/402/403/404/405)

**Änderungen v1.4.1 gegenüber v1.4 (QA-Revision, kein Code-Bruch — nur Spec-Klarstellung + 1 neuer öffentlicher Endpoint):**

- **BUG-401:** `POST /api/customer/resend-verification` aktualisiert
  jetzt `verificationToken` UND `verificationTokenExpiry = now + 24h`.
  `GET /api/customer/verify` prüft `verificationTokenExpiry > now`
  statt `createdAt + 24h`.
- **BUG-402:** `PATCH /api/customer/me` akzeptiert NUR `firstName`,
  `lastName`, `phone` — `email` ist nicht mehr im Schema (siehe
  `CustomerProfileUpdateSchema`). E-Mail-Änderung ist Backlog (IT5).
- **MAJOR-401:** Storno-Frist-Algorithmus ist jetzt explizit
  Berlin-zonen-fest dokumentiert (siehe ARCHITECTURE.md §17.7).
- **MAJOR-402:** **NEUER öffentlicher Endpoint** `GET /api/payments/session-status?session_id=xxx`
  — Stripe-Erfolgsseite kann den Zahlungs-Status auch ohne Customer-
  Session prüfen (Polling-fähig, max 5 × 1s).
- **MAJOR-403:** `Review.customerName` wird im Response per Live-Join
  aus `customer.firstName + lastName[0] + '.'` berechnet (kein DB-Feld);
  Fallback `"Anonym"` bei `customerId === null`.
- **MAJOR-404:** `isCancellable()` ist null-fest gegen Bestandsbuchungen
  ohne `date`/`startTime` — fällt auf `slot.startsAt` zurück.
- **MAJOR-405:** `redirectUrl` / `callbackUrl` bei Customer-Login werden
  validiert (nur Pfade ohne Host akzeptiert; sonst Fallback `/konto`).

**Änderungen v1.4 gegenüber v1.3:**

- US-25: **Neue Kunden-Auth-Endpunkte** (`/api/customer/*`, eigenes Cookie
  `customer-session`, JWT, separat von NextAuth-Admin):
  - `POST /api/customer/register`
  - `POST /api/customer/login`
  - `POST /api/customer/logout`
  - `GET  /api/customer/me`
  - `PATCH /api/customer/me` (Profil)
  - `GET  /api/customer/verify?token=...`
  - `POST /api/customer/resend-verification`
  - `POST /api/customer/forgot-password`
  - `POST /api/customer/reset-password`
- US-26/US-27: **Neue Kundenportal-Endpunkte:**
  - `GET  /api/customer/bookings` (Split: upcoming / past)
  - `GET  /api/customer/bookings/:id`
  - `POST /api/customer/bookings/:id/cancel` (mit 24h-Frist-Check)
- US-28: **Neue Zahlungs-Endpunkte (Stripe-Integration):**
  - `POST /api/admin/bookings/:id/payment` (Admin: Betrag hinterlegen)
  - `POST /api/payments/create-session` (Kunde: Stripe-Checkout-Session)
  - `GET  /api/payments/session-status` (öffentlich, Erfolgsseiten-Polling — MAJOR-402-Fix v1.4.1)
  - `POST /api/payments/webhook` (Stripe → uns)
- US-29: **Neue Review-Endpunkte:**
  - `POST /api/customer/reviews`
  - `GET  /api/reviews` (öffentlich, nur approved)
  - `GET  /api/admin/reviews` (Admin)
  - `PATCH /api/admin/reviews/:id`
- **Booking-Erweiterung:** `POST /api/bookings` setzt automatisch
  `customerId`, wenn ein gültiges `customer-session`-Cookie vorhanden ist.
  Body unverändert (kein neues Pflichtfeld). Response enthält weiterhin
  nur `{ id, status, createdAt }`.
- **`PATCH /api/bookings/:id`** akzeptiert jetzt zusätzlich
  `status: 'COMPLETED'` (US-29-Vorbedingung — Bewertung erst nach
  COMPLETED möglich).
- **Neue Fehlercodes:** `EMAIL_NOT_VERIFIED` (422), `STRIPE_ERROR` (502).
- **Middleware-Erweiterung:** `/konto/*` (außer `/konto/login`,
  `/konto/registrieren`, `/konto/passwort-vergessen`,
  `/konto/passwort-zuruecksetzen`, `/konto/verifizieren`,
  `/konto/zahlung/:id`) → Redirect auf `/konto/login` ohne
  `customer-session`-Cookie.

**Änderungen v1.3 gegenüber v1.2:**

- BUG IT3: `POST /api/bookings` akzeptiert jetzt zusätzlich
  `{ date, startTime, endTime }` (US-17). `slotId` bleibt für Rebook-Flows
  und Bestandsbuchungen erlaubt — genau einer der beiden Modi muss erfüllt
  sein (siehe `CreateBookingSchema`).
- US-17: **Neue Endpunkte** für Verfügbarkeitsfenster:
  - `GET /api/admin/availability-template` (Admin)
  - `PUT /api/admin/availability-template` (Admin)
  - `GET /api/admin/day-overrides?month=YYYY-MM` (Admin)
  - `POST /api/admin/day-overrides` (Admin)
  - `DELETE /api/admin/day-overrides/:id` (Admin)
  - `GET /api/slots/available?date=YYYY-MM-DD` (öffentlich)
- US-18: **Neuer Endpoint** `POST /api/upload` (öffentlich, Datei-Upload via
  Vercel Blob).
- US-19: Service-Slug `'sonstiges'` neu in der `SERVICES`-Konstante; bei
  diesem Service zwingt das Schema `description.length >= 30`.
- US-21: **Neuer Endpoint** `GET /api/admin/upcoming-bookings?limit=N`
  (Admin).
- US-24: Erweiterte Mail-Templates (Eingangsbestätigung an Kunden bereits
  in IT2 vorhanden; **Neu** Bestätigungs-Mail bei `PENDING → CONFIRMED` und
  Ablehnungs-Mail bei `PENDING → REJECTED`). Trigger: `PATCH
  /api/bookings/:id`.
- Neue Fehlercodes: `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE`
  (415) für Datei-Upload.
- Bestehende Endpunkte (`/api/slots`, `/api/availability`, `/api/calendar`)
  bleiben für Rückwärtskompatibilität erhalten — werden aber im neuen
  Buchungs-Flow NICHT mehr aktiv genutzt.

**Änderungen v1.2 gegenüber v1.1:** siehe Git-History bzw. v1.2-Header.

---

## Globale Konventionen

| Aspekt          | Wert                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| Base-URL (Prod) | `https://www.baerenstark-hausservice.app` (v1.5.1, vorher `baerenstark.vercel.app`) |
| Base-URL (Dev)  | `http://localhost:3000`                                                    |
| Content-Type    | `application/json` (Request & Response) — Ausnahme: `POST /api/upload` `multipart/form-data` |
| Datumsformat    | ISO 8601 mit Offset (Bestand IT1/IT2). **Iteration 3 zusätzlich**: "YYYY-MM-DD" + "HH:MM" als Berlin-TZ-Strings (kein Offset). |
| IDs             | `cuid` (String)                                                            |
| Auth (Admin)    | Session-Cookie via NextAuth (`next-auth.session-token`, HttpOnly, Secure)  |
| Charset         | UTF-8                                                                      |
| Rate-Limit-Header | Bei 429: `Retry-After` (Sekunden) gesetzt.                               |

### Datums-/Zeit-Format

Iteration 3 nutzt zwei Formate parallel:

1. **ISO 8601 mit Offset** (Bestand IT1/IT2): Slot-basierte Endpunkte
   (`/api/slots`, `/api/calendar`).
2. **Berlin-Lokalzeit-Strings** (Iteration 3, neu):
   - `"YYYY-MM-DD"` für Tagesangaben (kein TZ).
   - `"HH:MM"` für Uhrzeiten innerhalb eines Tages (24h, Berlin).

   Begründung: Tom denkt in Berlin-Zeit; explizite TZ-Strings vermeiden DST-
   Bugs ("08:00 wird zu 07:00" beim DST-Wechsel). Backend rendert in Mails
   via `Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' })`.

### Einheitliches Fehlerformat

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name ist ein Pflichtfeld",
    "field": "customerName"
  }
}
```

| Code                     | HTTP | Bedeutung                                                                  |
| ------------------------ | ---- | -------------------------------------------------------------------------- |
| `VALIDATION_ERROR`       | 400  | Eingaben sind ungültig (Zod-Fehler).                                       |
| `UNAUTHORIZED`           | 401  | Keine oder ungültige Session.                                              |
| `FORBIDDEN`              | 403  | Eingeloggt, aber nicht berechtigt.                                         |
| `NOT_FOUND`              | 404  | Ressource existiert nicht.                                                 |
| `CONFLICT`               | 409  | Slot/Timeslot bereits aktiv gebucht oder Status-Konflikt.                  |
| `OVERLAP`                | 409  | Neuer Slot überschneidet bestehenden Slot.                                 |
| `GONE`                   | 410  | Token bereits verwendet / Booking in Endstatus.                            |
| `PAYLOAD_TOO_LARGE`      | 413  | **IT3** — Datei-Upload > 20 MB (US-18).                                    |
| `UNSUPPORTED_MEDIA_TYPE` | 415  | **IT3** — Datei-Upload mit nicht erlaubtem MIME-Type (US-18).              |
| `RATE_LIMITED`           | 429  | Rate-Limit überschritten. `Retry-After`-Header gesetzt.                    |
| `MAIL_FAILED`            | 502  | Resend-Versand fehlgeschlagen.                                             |
| `INTERNAL_ERROR`         | 500  | Unerwarteter Server-Fehler.                                                |

---

## 1. Slots (Bestand IT1/IT2 — DEPRECATED in IT3)

`GET /api/slots`, `POST /api/slots`, `DELETE /api/slots/:id` bleiben
unverändert (siehe v1.2). Werden in der neuen Buchungs-UI NICHT mehr
verwendet, bleiben aber für Counter-Proposal-Flow (US-13) und
Bestandsbuchungen (Re-Booking) erhalten.

Konkret:

- **Admin-UI versteckt** den "Neuen Slot anlegen"-Pfad in IT3 (Tom nutzt
  stattdessen die Verfügbarkeits-Vorlage).
- **Counter-Proposal** kann weiter via Slot-IDs operieren (Bestandsfeld in
  Booking).
- `GET /api/slots` liefert nur noch Bestandsslots; das Iteration-3-Frontend
  fragt **stattdessen** `GET /api/slots/available?date=...` ab.

---

## 2. Bookings

### `POST /api/bookings`

**Auth:** öffentlich
**Story:** US-04, US-08, US-17, US-18, US-19, US-24 (Eingangsbestätigung)

Erstellt eine Buchungsanfrage. Sendet eine E-Mail an Tom **und** eine
Eingangsbestätigung an den Kunden — beide fire-and-forget nach 201-Response.

**Request Body — Modus IT3 (Standard, neu in IT3):**

```json
{
  "date": "2026-05-15",
  "startTime": "09:00",
  "endTime": "10:00",
  "customerName": "Maria Müller",
  "customerPhone": "0157-12345678",
  "customerEmail": "maria@example.com",
  "service": "entruempelung",
  "description": "Keller entrümpeln, ca. 30 m³",
  "attachmentIds": ["clatt1...", "clatt2..."],
  "privacyAccepted": true
}
```

**Request Body — Modus Bestand (Re-Booking-Flow für IT1/IT2 Buchungen):**

```json
{
  "slotId": "clx9k...",
  "customerName": "Maria Müller",
  "customerPhone": "0157-12345678",
  "customerEmail": "maria@example.com",
  "service": "entruempelung",
  "description": "Keller entrümpeln, ca. 30 m³",
  "privacyAccepted": true
}
```

**Genau einer der beiden Modi muss erfüllt sein.** Sonst 400.

| Feld              | Typ            | Pflicht | Validierung                                                                                                  |
| ----------------- | -------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `date`            | string         | bedingt | "YYYY-MM-DD" Berlin-TZ. Pflicht im IT3-Modus, sonst leer/abwesend.                                            |
| `startTime`       | string         | bedingt | "HH:MM" Berlin-TZ. Pflicht im IT3-Modus, < endTime.                                                          |
| `endTime`         | string         | bedingt | "HH:MM" Berlin-TZ. Pflicht im IT3-Modus, > startTime.                                                        |
| `slotId`          | string         | bedingt | Pflicht im Bestand-Modus.                                                                                    |
| `customerName`    | string         | ja      | 2–120 Zeichen, getrimmt.                                                                                     |
| `customerPhone`   | string         | ja      | Nur Ziffern + `+ - / ( ) Leerzeichen`, max. 40 Zeichen, mindestens 6 Ziffern.                                  |
| `customerEmail`   | string         | ja      | Pflicht (US-13/US-14/US-24).                                                                                 |
| `service`         | enum           | ja      | Einer der `SERVICES`-Slugs inkl. **`'sonstiges'`** (US-19).                                                  |
| `description`     | string         | ja      | 5–2000 Zeichen, getrimmt. **Bei `service === 'sonstiges'`: mind. 30 Zeichen** (US-19).                       |
| `attachmentIds`   | string[]       | nein    | 0–5 IDs, jede aus vorhergehendem `POST /api/upload`-Response (US-18).                                         |
| `privacyAccepted` | boolean        | ja      | Muss `true` sein. Wird **nicht** persistiert.                                                                |

**Server-seitiger Verfügbarkeits-Check (IT3-Modus):**

1. `date` muss in der Zukunft liegen (Berlin-TZ-Tag-Vergleich).
2. Verfügbarkeitsfenster für `date` wird berechnet (siehe Resolver in
   `lib/availability.ts`):
   - Wenn `DayOverride` für `date` existiert: dessen Werte greifen.
     Wenn `isActive: false` → 409 `CONFLICT` mit `field: "date"`.
   - Sonst: `AvailabilityTemplate` für `date.weekday`. Wenn
     `isActive: false` → 409 `CONFLICT` mit `field: "date"`.
3. `startTime` und `endTime` müssen innerhalb des resolvierten Fensters
   liegen.
4. `endTime - startTime === slotDurationMinutes` der Vorlage. (Backend
   stellt damit sicher, dass nur die vom Frontend angebotenen Blöcke
   gebucht werden.)
5. Partial Unique Index `uniq_active_booking_per_timeslot` schützt
   gegen Doppelbuchung — bei Verstoß: 409 `CONFLICT`.

**Verhalten:**

1. Persistiert die Buchung (Status PENDING).
2. Generiert `cancelToken` automatisch.
3. Verknüpft `attachmentIds` mit der Buchung (Update der
   `BookingAttachment`-Datensätze).
4. **Antwortet sofort mit 201**.
5. Fire-and-forget Mail-Dispatch:
   - `bookingNotificationToAdmin` (US-08): Mail an Tom.
   - `bookingReceiptToCustomer` (US-24): Eingangsbestätigung an Kunden mit
     Storno-Link.
6. Mail-Status (`mailSent`/`mailError`) wird am Booking persistiert.

**Response 201:**

```json
{
  "data": {
    "id": "clb...",
    "status": "PENDING",
    "createdAt": "2026-05-02T13:42:00.000Z"
  }
}
```

**Rate-Limiting:** 10 Anfragen / 60 min / IP.

**Fehler:**
- 400 `VALIDATION_ERROR` (inkl. Modus-Konflikt, "Sonstiges"-Description-Länge).
- 404 `NOT_FOUND` — `slotId` oder `attachmentIds` nicht gefunden.
- 409 `CONFLICT` — Slot/Timeslot bereits aktiv gebucht **oder** Tag ist
  nicht verfügbar (DayOverride/Template inaktiv).
- 429 `RATE_LIMITED`.

---

### `GET /api/bookings`

**Auth:** Admin
**Story:** US-06

Listet Buchungsanfragen. **Iteration 3 erweitert:** Response enthält
`date / startTime / endTime` (für IT3-Buchungen) und `attachments` (US-18).

**Query-Parameter (optional):**

| Name     | Typ    | Default | Beschreibung                                                                                       |
| -------- | ------ | ------- | -------------------------------------------------------------------------------------------------- |
| `status` | enum   | alle    | `PENDING` \| `CONFIRMED` \| `REJECTED` \| `COUNTER_PROPOSED` \| `CANCELLED`                        |

**Response 200:**

```json
{
  "data": [
    {
      "id": "clb...",
      "slot": null,
      "date": "2026-05-15",
      "startTime": "09:00",
      "endTime": "10:00",
      "customerName": "Maria Müller",
      "customerPhone": "0157-12345678",
      "customerEmail": "maria@example.com",
      "service": "sonstiges",
      "description": "...",
      "status": "PENDING",
      "mailSent": true,
      "mailError": null,
      "cancelToken": "clb...token",
      "counterProposalSlot": null,
      "attachments": [
        {
          "id": "clatt1...",
          "url": "https://abc.public.blob.vercel-storage.com/a.jpg",
          "filename": "keller.jpg",
          "contentType": "image/jpeg",
          "sizeBytes": 1843200,
          "createdAt": "2026-05-02T13:41:00.000Z"
        }
      ],
      "createdAt": "2026-05-02T13:42:00.000Z",
      "updatedAt": "2026-05-02T13:42:00.000Z"
    }
  ]
}
```

Bestandsbuchungen (IT1/IT2) haben `slot` befüllt und `date/startTime/endTime`
auf `null`. Iteration-3-Buchungen haben `slot: null` und Date/Time-Felder
befüllt.

Sortierung: `createdAt` desc.

---

### `PATCH /api/bookings/:id`

**Auth:** Admin
**Story:** US-06, US-24

**Iteration 3 erweitert:** Bei Status-Änderung wird zusätzlich eine
**Kunden-E-Mail** ausgelöst (US-24):

| Übergang             | Mail an Kunden                          | Template-Key                  |
| -------------------- | --------------------------------------- | ----------------------------- |
| PENDING → CONFIRMED  | "Dein Termin ist bestätigt"             | `bookingConfirmationToCustomer` |
| PENDING → REJECTED   | "Leider können wir nicht zusagen"       | `bookingRejectionToCustomer`  |
| CONFIRMED → REJECTED | (gleich wie PENDING → REJECTED)         | `bookingRejectionToCustomer`  |

Mails sind fire-and-forget; Fehlversand wird in den Server-Logs
erfasst, blockiert aber nicht den Status-Wechsel-Erfolg.

Übrige Verhaltens- und Validierungsregeln (Idempotenz, State-Machine,
Slot-Konflikt-Prüfung) **unverändert seit IT2**.

---

### Übrige Booking-Endpoints (unverändert seit IT2)

| Endpoint                                         | Verhalten |
| ------------------------------------------------ | --------- |
| `POST /api/bookings/:id/counter-proposal`        | Admin schlägt Alternativtermin vor (Iteration 2). **Hinweis IT3:** funktioniert weiterhin auf Bestandsbuchungen mit `slotId`; für IT3-Date/Time-Buchungen ist Counter-Proposal Backlog (Iteration 4). |
| `GET /api/bookings/respond?token=...&action=...` | Kunde nimmt an / storniert. Unverändert. |
| `POST /api/bookings/rebook`                      | Kunde wählt neuen Slot. Unverändert. |
| `POST /api/bookings/:id/resend-mail`             | Mail neu versenden. Iteration 3: kann auch Eingangsbestätigung neu senden. |

---

## 3. Verfügbarkeitsfenster (Iteration 3 — US-17)

### `GET /api/admin/availability-template`

**Auth:** Admin
**Story:** US-17

Liefert die globale Default-Vorlage (alle 7 Wochentage).

**Response 200:**

```json
{
  "data": {
    "days": [
      { "dayOfWeek": 0, "isActive": false, "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
      { "dayOfWeek": 1, "isActive": true,  "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
      { "dayOfWeek": 2, "isActive": true,  "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
      { "dayOfWeek": 3, "isActive": true,  "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
      { "dayOfWeek": 4, "isActive": true,  "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
      { "dayOfWeek": 5, "isActive": true,  "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
      { "dayOfWeek": 6, "isActive": false, "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 }
    ]
  }
}
```

Sortierung: aufsteigend nach `dayOfWeek`. **Genau 7 Einträge.**

`Cache-Control: no-store`.

---

### `PUT /api/admin/availability-template`

**Auth:** Admin
**Story:** US-17

Bulk-Update der Default-Vorlage. Alle 7 Tage in einem einzigen Request.

**Request Body:**

```json
{
  "days": [
    { "dayOfWeek": 0, "isActive": false, "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
    { "dayOfWeek": 1, "isActive": true,  "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
    { "dayOfWeek": 2, "isActive": true,  "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
    { "dayOfWeek": 3, "isActive": true,  "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
    { "dayOfWeek": 4, "isActive": true,  "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
    { "dayOfWeek": 5, "isActive": true,  "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 },
    { "dayOfWeek": 6, "isActive": false, "startTime": "08:00", "endTime": "17:00", "slotDurationMinutes": 60 }
  ]
}
```

| Feld   | Typ                       | Pflicht | Validierung                                                              |
| ------ | ------------------------- | ------- | ------------------------------------------------------------------------ |
| `days` | Array<TemplateDay>        | ja      | 1–7 Einträge, dayOfWeek 0–6, jede dayOfWeek max 1×, endTime > startTime, Fenster ≥ slotDurationMinutes. |

**Verhalten:** Upsert pro Tag in einer Transaktion.

**Response 200:** wie GET (komplette aktuelle Vorlage).

**Side-Effect:** `revalidateTag('availability-template')` und `revalidateTag('available-slots')`.

**Fehler:**
- 400 `VALIDATION_ERROR` (z.B. endTime ≤ startTime, Fenster zu kurz für Slot-Dauer).
- 401 `UNAUTHORIZED`.

---

### `GET /api/admin/day-overrides?month=YYYY-MM`

**Auth:** Admin
**Story:** US-17

Liefert alle DayOverrides für einen Monat (für Kalender-Annotation im
Admin-UI).

**Query:**

| Name    | Typ    | Pflicht | Validierung               |
| ------- | ------ | ------- | ------------------------- |
| `month` | string | ja      | "YYYY-MM" (z.B. "2026-05") |

**Response 200:**

```json
{
  "data": {
    "month": "2026-05",
    "overrides": [
      {
        "id": "clo1...",
        "date": "2026-05-15",
        "isActive": false,
        "startTime": null,
        "endTime": null,
        "reason": "Urlaub",
        "createdAt": "2026-05-01T10:00:00.000Z",
        "updatedAt": "2026-05-01T10:00:00.000Z"
      }
    ]
  }
}
```

Sortierung: `date` aufsteigend.

**Fehler:**
- 400 `VALIDATION_ERROR`.
- 401 `UNAUTHORIZED`.

---

### `POST /api/admin/day-overrides`

**Auth:** Admin
**Story:** US-17

Legt einen neuen DayOverride an oder überschreibt einen bestehenden für
dasselbe Datum (Upsert auf `date`).

**Request Body:**

```json
{
  "date": "2026-05-15",
  "isActive": false,
  "startTime": null,
  "endTime": null,
  "reason": "Urlaub"
}
```

| Feld        | Typ              | Pflicht | Validierung                                                                                              |
| ----------- | ---------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `date`      | string           | ja      | "YYYY-MM-DD".                                                                                            |
| `isActive`  | boolean          | ja      | false = Tag gesperrt; true = Tag aktiv (mit eigenen oder Template-Zeiten).                                |
| `startTime` | string \| null   | nein    | "HH:MM" oder null. Wenn `isActive: true` und `endTime` gesetzt ist, muss `startTime` ebenfalls gesetzt sein. |
| `endTime`   | string \| null   | nein    | "HH:MM" oder null. > startTime.                                                                          |
| `reason`    | string \| null   | nein    | Max. 200 Zeichen.                                                                                        |

**Verhalten:**

1. Upsert auf `date`.
2. Wenn `isActive: false` UND es gibt aktive (PENDING/CONFIRMED/COUNTER_PROPOSED)
   Buchungen für diesen Tag → Response enthält Warning, **die Buchungen
   bleiben aber bestehen**. Tom muss sie manuell stornieren oder umlegen.
   Antwort:
   ```json
   {
     "data": { "id": "clo1...", "date": "2026-05-15", "isActive": false, ... },
     "warning": {
       "code": "ACTIVE_BOOKINGS_AFFECTED",
       "message": "Es gibt 2 aktive Buchungen an diesem Tag. Diese bleiben bestehen.",
       "affectedBookingCount": 2
     }
   }
   ```

**Response 201:** Override-Datensatz (siehe DayOverrideSchema).

**Side-Effect:** `revalidateTag('available-slots')`.

**Fehler:**
- 400 `VALIDATION_ERROR`.
- 401 `UNAUTHORIZED`.

---

### `DELETE /api/admin/day-overrides/:id`

**Auth:** Admin
**Story:** US-17

Löscht einen DayOverride. Der Tag fällt damit auf die Default-Vorlage
zurück.

**Response 204:** Kein Body.

**Side-Effect:** `revalidateTag('available-slots')`.

**Fehler:**
- 401 `UNAUTHORIZED`.
- 404 `NOT_FOUND`.

---

### `GET /api/slots/available?date=YYYY-MM-DD`

**Auth:** öffentlich
**Story:** US-17

**Kern-Endpoint des IT3-Buchungs-Flows.** Berechnet die verfügbaren Zeit-
Slots für einen Tag.

**Query:**

| Name   | Typ    | Pflicht | Validierung   |
| ------ | ------ | ------- | ------------- |
| `date` | string | ja      | "YYYY-MM-DD". |

**Algorithmus (siehe `lib/availability.ts.computeAvailableSlots()`):**

1. `date` < heute (Berlin-TZ) → `isDayActive: false`, `slots: []`.
2. DayOverride für `date` lookup → wenn vorhanden:
   - `isActive: false` → `isDayActive: false`, `slots: []`,
     `overrideReason` aus Override.
   - `isActive: true` → `(startTime, endTime)` aus Override
     (Fallback auf Template-Defaults für null-Werte). Slot-Dauer aus
     Template (Override hat keine eigene Dauer).
3. Sonst: AvailabilityTemplate für `date.weekday` lookup → wenn
   `isActive: false`, dann `isDayActive: false`. Sonst `(startTime,
   endTime, slotDurationMinutes)` aus Template.
4. Slots aus dem Fenster generieren:
   ```ts
   const slots: AvailableTimeSlot[] = [];
   let cur = startMinutes;
   while (cur + duration <= endMinutes) {
     slots.push({ startTime: minToHHMM(cur), endTime: minToHHMM(cur + duration), available: true });
     cur += duration;
   }
   ```
5. Belegte Slots ermitteln: `prisma.booking.findMany({ where: { date, status: { in: ACTIVE_BOOKING_STATUSES } } })`
   → für jeden Treffer den passenden Slot auf `available: false` setzen.

**Response 200 (Tag aktiv):**

```json
{
  "data": {
    "date": "2026-05-15",
    "isDayActive": true,
    "slots": [
      { "startTime": "08:00", "endTime": "09:00", "available": true },
      { "startTime": "09:00", "endTime": "10:00", "available": false },
      { "startTime": "10:00", "endTime": "11:00", "available": true },
      { "startTime": "11:00", "endTime": "12:00", "available": true },
      { "startTime": "12:00", "endTime": "13:00", "available": true },
      { "startTime": "13:00", "endTime": "14:00", "available": true },
      { "startTime": "14:00", "endTime": "15:00", "available": true },
      { "startTime": "15:00", "endTime": "16:00", "available": true },
      { "startTime": "16:00", "endTime": "17:00", "available": true }
    ]
  }
}
```

**Response 200 (Tag inaktiv):**

```json
{
  "data": {
    "date": "2026-05-15",
    "isDayActive": false,
    "slots": [],
    "overrideReason": "Urlaub"
  }
}
```

`Cache-Control: no-store`.

**Fehler:**
- 400 `VALIDATION_ERROR`.

---

## 4. Datei-Upload (Iteration 3 — US-18)

### `POST /api/upload`

**Auth:** öffentlich
**Story:** US-18

Lädt eine einzelne Datei in Vercel Blob hoch und legt einen
`BookingAttachment`-Datensatz an. Der zurückgegebene `attachmentId` muss
beim anschließenden `POST /api/bookings` im `attachmentIds`-Array
referenziert werden.

**Request:** `multipart/form-data` mit Feld `file` (eine Datei).

**Pseudocode:**

```ts
import { put } from '@vercel/blob';

const formData = await req.formData();
const file = formData.get('file');

if (!(file instanceof File)) return validationError('file fehlt');
if (file.size > UPLOAD_MAX_FILE_BYTES) return error('PAYLOAD_TOO_LARGE', 413);
if (!UPLOAD_ACCEPTED_CONTENT_TYPES.includes(file.type)) return error('UNSUPPORTED_MEDIA_TYPE', 415);

const blob = await put(`uploads/${cuid()}-${sanitize(file.name)}`, file, { access: 'public' });

const attachment = await prisma.bookingAttachment.create({
  data: {
    bookingId: PENDING_PLACEHOLDER,  // siehe Hinweis unten
    url: blob.url,
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  },
});

return apiSuccess({
  attachmentId: attachment.id,
  url: blob.url,
  filename: file.name,
  contentType: file.type,
  sizeBytes: file.size,
}, 201);
```

**Wichtig — `bookingId` beim Upload-Insert:**

Beim Upload existiert die Buchung noch nicht. Es gibt zwei mögliche Ansätze:

1. **(empfohlen)** `BookingAttachment.bookingId` wird als optional/nullable
   gemodelt; beim `POST /api/bookings` wird die ID dann nachgeladen
   (`prisma.bookingAttachment.updateMany({ where: { id: { in: attachmentIds }, bookingId: null }, data: { bookingId: newBooking.id } })`).
   **Schema-Anpassung:** `bookingId` muss in `BookingAttachment` nullable
   sein (siehe schema.prisma — Engineers passen das beim Implementieren an).
2. **Alternative:** Pre-flight `POST /api/bookings/draft` legt eine
   "draft" Booking an, die beim finalen `POST /api/bookings` aktualisiert
   wird. Mehr Komplexität — nicht empfohlen für MVP.

**Engineering-Hinweis zur Schema-Anpassung:**

Das Schema-Beispiel oben listet `bookingId String` als Pflicht. Engineers
müssen das im Live-Schema (`prisma/schema.prisma`) auf `bookingId String?`
nullable setzen, damit das Upload-vor-Booking-Pattern funktioniert. Die
Cascade-Delete-Beziehung bleibt erhalten (gilt nur, wenn `bookingId`
gesetzt ist).

**Cleanup-Job (Backlog):** `BookingAttachment` mit `bookingId === null`
älter als 24 Stunden werden via Vercel Cron entfernt (zusammen mit der
Blob-Datei).

**Response 201:**

```json
{
  "data": {
    "attachmentId": "clatt1...",
    "url": "https://abc.public.blob.vercel-storage.com/uploads/clatt1-keller.jpg",
    "filename": "keller.jpg",
    "contentType": "image/jpeg",
    "sizeBytes": 1843200
  }
}
```

**Rate-Limiting:** 20 Uploads / 60 min / IP.

**Fehler:**
- 400 `VALIDATION_ERROR` — `file`-Feld fehlt.
- 413 `PAYLOAD_TOO_LARGE` — Datei > 20 MB.
- 415 `UNSUPPORTED_MEDIA_TYPE` — nicht erlaubter MIME-Type.
- 429 `RATE_LIMITED`.
- 502 — Vercel Blob upstream nicht erreichbar.

---

## 5. Admin-Dashboard — Bevorstehende Termine (US-21)

### `GET /api/admin/upcoming-bookings?limit=10`

**Auth:** Admin
**Story:** US-21

Liefert zukünftige bestätigte (CONFIRMED) Termine sortiert nach Datum
(aufsteigend), um sie auf dem Admin-Dashboard zu rendern.

**Query:**

| Name    | Typ    | Pflicht | Default | Validierung |
| ------- | ------ | ------- | ------- | ----------- |
| `limit` | number | nein    | 10      | 1–100       |

**Algorithmus:**

1. `today = todayInBerlinTZ()` ("YYYY-MM-DD").
2. SELECT Bookings WHERE
   - `status = 'CONFIRMED'` UND
   - (`date >= today` UND `date IS NOT NULL`) OR (`date IS NULL` UND
     `slot.startsAt >= startOfTodayUTC()`).
3. Sortieren:
   - IT3-Modus: `(date, startTime)` aufsteigend.
   - Bestand: `slot.startsAt` aufsteigend.
4. Mergen + LIMIT.
5. `isToday`-Flag: `date === today` (oder Slot-Tag === today für Bestand).

**Response 200:**

```json
{
  "data": [
    {
      "id": "clb...",
      "date": "2026-05-02",
      "startTime": "14:00",
      "endTime": "15:00",
      "customerName": "Maria Müller",
      "service": "entruempelung",
      "isToday": true
    },
    {
      "id": "clb...",
      "date": "2026-05-03",
      "startTime": "09:00",
      "endTime": "10:00",
      "customerName": "Peter Schmidt",
      "service": "reinigung",
      "isToday": false
    }
  ]
}
```

`Cache-Control: no-store`.

**Fehler:**
- 401 `UNAUTHORIZED`.

---

## 6. Verfügbarkeit (Iteration 2 — DEPRECATED)

`GET /api/availability` und `PUT /api/availability` (WeeklyAvailability)
bleiben für Bestandskompatibilität erhalten. Iteration 3 nutzt
`/api/admin/availability-template` stattdessen.

**Migration-Strategy:** Engineers ergänzen einen einmaligen Migrations-
Schritt, der bei Iteration-3-Deploy die `WeeklyAvailability.isActive`-
Werte in die neue `AvailabilityTemplate` kopiert (mit Default-Zeiten
08:00–17:00 und 60-min-Slot-Dauer). Danach kann das Admin-UI
ausschließlich `/api/admin/availability-template` nutzen.

---

## 7. Kalender (Iteration 2 — DEPRECATED in IT3)

`GET /api/calendar?year=YYYY&month=M` bleibt für Bestand erhalten. Wird in
der IT3-Buchungs-UI **nicht mehr** verwendet — stattdessen ruft das
Frontend pro Tag `GET /api/slots/available?date=...` ab, oder rendert
einen einfachen Monats-Kalender clientseitig basierend auf
`availabilityTemplate` + `dayOverrides`.

**Empfehlung Engineers:** Für IT3 einen neuen Client-seitigen
Kalender-Renderer in `components/booking/CalendarV2.tsx` implementieren,
der auf `GET /api/admin/availability-template` (öffentliche Variante:
ungeschützter `GET /api/availability-template`, falls Engineers das
implementieren möchten) + `GET /api/admin/day-overrides?month=...` baut.
Im MVP genügt der Standard-Pfad: pro Tag-Klick einen
`/api/slots/available`-Call.

---

## 8. Auth (NextAuth-managed Admin + JWT-Cookie Customer)

**Iteration 4** führt zwei Auth-Mechanismen parallel:

| Auth-Typ        | Cookie-Name               | Mechanismus                          | Pfad-Schutz             |
| --------------- | ------------------------- | ------------------------------------ | ----------------------- |
| Admin (NextAuth)| `next-auth.session-token` | NextAuth Credentials Provider (JWT)  | `/admin/*`, `/api/admin/*` |
| Kunde (eigen)   | `customer-session`        | JWT mit `AUTH_SECRET`, 7d, httpOnly  | `/konto/*`, `/api/customer/*` |

Beide Cookies können **gleichzeitig** existieren — eine Person kann
sowohl Admin als auch Kunde sein. Die beiden Sessions sind voneinander
unabhängig (verschiedene Cookie-Namen, verschiedene Secrets-Salts).

Geschützte Routen-Patterns:

| Pfad-Pattern                                                | Auth                                |
| ----------------------------------------------------------- | ----------------------------------- |
| `GET /admin/*` (Browser)                                    | Admin-Session erforderlich          |
| `POST/PUT/DELETE /api/admin/*`                              | Admin-Session erforderlich          |
| `POST /api/upload`                                          | Öffentlich, Rate-Limit              |
| `GET /api/slots/available`                                  | Öffentlich                          |
| `GET /api/bookings/respond`, `POST /api/bookings/rebook`    | Öffentlich (Token)                  |
| `GET /konto/*` (Browser, IT4)                               | Customer-Session erforderlich (siehe Public-Whitelist unten) |
| `/api/customer/*` (außer register/login/forgot/reset/verify) | Customer-Session erforderlich      |
| `POST /api/payments/webhook`                                | Öffentlich, Stripe-Signatur-Check   |
| `POST /api/payments/create-session`                         | Customer-Session ODER `cancelToken` |
| `GET /api/payments/session-status`                          | Öffentlich (Stripe-Session-ID = Token) |

**Public-Whitelist `/konto/*` (kein Login nötig):**
- `/konto/login`
- `/konto/registrieren`
- `/konto/passwort-vergessen`
- `/konto/passwort-zuruecksetzen?token=...`
- `/konto/verifizieren?token=...`
- `/konto/zahlung/:bookingId` (öffentlich; Auth via Login ODER `cancelToken`-Query)

### Customer-Session-Cookie-Spezifikation

```
Name:        customer-session
Value:       <JWT signed with AUTH_SECRET, payload { customerId, email, iat, exp }>
HttpOnly:    true
Secure:      true (Production)
SameSite:    Lax
Path:        /
Max-Age:     604800   (7 Tage in Sekunden)
```

Der Token-Payload enthält **nur** `customerId` und `email` —
`emailVerified` wird bei jedem Request frisch aus der DB gelesen, damit
ein nach Verifikation ausgestelltes Cookie sofort wirkt (sonst müsste
der Token rotiert werden).

---

## 9. Endpoint-zu-Story-Matrix (Iteration 3 erweitert)

| Endpoint                                       | US-04 | US-05 | US-06 | US-07 | US-08 | US-13 | US-14 | US-15 | US-16 | US-17 | US-18 | US-19 | US-21 | US-24 |
| ---------------------------------------------- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `GET /api/slots`                               |   ✓   |       |       |       |       |       |       |       |   ✓   |       |       |       |       |       |
| `POST /api/bookings`                           |   ✓   |       |       |       |   ✓   |       |       |       |       |   ✓   |   ✓   |   ✓   |       |   ✓   |
| `GET /api/bookings`                            |       |       |   ✓   |       |       |   ✓   |   ✓   |       |       |       |   ✓   |       |       |       |
| `PATCH /api/bookings/:id`                      |       |       |   ✓   |       |       |       |       |       |       |       |       |       |       |   ✓   |
| `POST /api/bookings/:id/counter-proposal`      |       |       |       |       |       |   ✓   |       |       |       |       |       |       |       |       |
| `GET /api/bookings/respond`                    |       |       |       |       |       |   ✓   |   ✓   |       |       |       |       |       |       |       |
| `POST /api/bookings/rebook`                    |       |       |       |       |       |   ✓   |       |       |       |       |       |       |       |       |
| `GET /api/admin/availability-template`         |       |       |       |       |       |       |       |       |       |   ✓   |       |       |       |       |
| `PUT /api/admin/availability-template`         |       |       |       |       |       |       |       |       |       |   ✓   |       |       |       |       |
| `GET /api/admin/day-overrides`                 |       |       |       |       |       |       |       |       |       |   ✓   |       |       |       |       |
| `POST /api/admin/day-overrides`                |       |       |       |       |       |       |       |       |       |   ✓   |       |       |       |       |
| `DELETE /api/admin/day-overrides/:id`          |       |       |       |       |       |       |       |       |       |   ✓   |       |       |       |       |
| `GET /api/slots/available`                     |       |       |       |       |       |       |       |       |       |   ✓   |       |       |       |       |
| `POST /api/upload`                             |       |       |       |       |       |       |       |       |       |       |   ✓   |       |       |       |
| `GET /api/admin/upcoming-bookings`             |       |       |       |       |       |       |       |       |       |       |       |       |   ✓   |       |
| `POST /api/auth/callback/credentials`          |       |       |       |   ✓   |       |       |       |       |       |       |       |       |       |       |
| `GET /api/admin/setup`                         |       |       |       |   ✓   |       |       |       |       |       |       |       |       |       |       |
| `POST /api/admin/setup`                        |       |       |       |   ✓   |       |       |       |       |       |       |       |       |       |       |

US-20 (Preise), US-22 (Reviews), US-23 (Service-Popups) sind **frontend-only**
— keine API-Endpunkte erforderlich.

---

## 10. Frontend-Aufrufer-Mapping (Iteration 3)

| Endpoint                                       | Aufgerufen von                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /api/slots/available`                     | `components/booking/TimeSlotPicker.tsx` (NEU IT3) |
| `POST /api/upload`                             | `components/booking/FileUpload.tsx` (NEU IT3) |
| `POST /api/bookings`                           | `components/booking/BookingForm.tsx` (umgebaut IT3) |
| `GET /api/admin/availability-template`         | `app/admin/availability/page.tsx` (umgebaut IT3) |
| `PUT /api/admin/availability-template`         | `components/admin/AvailabilityTemplateForm.tsx` (NEU IT3) |
| `GET /api/admin/day-overrides`                 | `components/admin/DayOverrideManager.tsx` (NEU IT3) |
| `POST /api/admin/day-overrides`                | `components/admin/DayOverrideManager.tsx` |
| `DELETE /api/admin/day-overrides/:id`          | `components/admin/DayOverrideManager.tsx` |
| `GET /api/admin/upcoming-bookings`             | `app/admin/page.tsx` (Dashboard-Top-Section, NEU IT3) |
| `GET /api/bookings`                            | `app/admin/bookings/page.tsx` (zeigt jetzt zusätzlich Attachments) |
| `PATCH /api/bookings/:id`                      | `components/admin/BookingTable.tsx` |

Übrige Endpoints unverändert (siehe v1.2).

---

## 11. Kunden-Auth (Iteration 4 — US-25)

Neuer Pfad-Prefix: `/api/customer/*`. Eigene JWT-basierte Session-
Verwaltung; keine NextAuth-Abhängigkeit. Cookie: `customer-session`,
httpOnly, Secure, SameSite=Lax, 7 Tage Gültigkeit.

### `POST /api/customer/register`

**Auth:** öffentlich
**Story:** US-25 AC1, AC2

Legt einen neuen Kunden-Account an. Sendet eine Verifikations-E-Mail.
Antwortet sofort mit 201, **ohne** Session-Cookie zu setzen — der Kunde
muss erst E-Mail bestätigen.

**Request Body** (`CustomerRegisterSchema`):

```json
{
  "email": "maria@example.com",
  "password": "geheim1234",
  "firstName": "Maria",
  "lastName": "Müller",
  "phone": "0157-12345678",
  "privacyAccepted": true
}
```

| Feld              | Typ      | Pflicht | Validierung                                                |
| ----------------- | -------- | ------- | ---------------------------------------------------------- |
| `email`           | string   | ja      | E-Mail, lowercase im Storage, max 254 Zeichen, UNIQUE.     |
| `password`        | string   | ja      | mind. 8 Zeichen, max 200.                                  |
| `firstName`       | string   | ja      | 1–120 Zeichen.                                             |
| `lastName`        | string   | ja      | 1–120 Zeichen.                                             |
| `phone`           | string   | nein    | Falls gesetzt: phone-Schema (siehe Booking).                |
| `privacyAccepted` | true     | ja      | Muss `true` sein. Wird **nicht** persistiert.              |

**Verhalten:**

1. E-Mail in lowercase normalisieren.
2. Existiert bereits ein CustomerUser mit dieser E-Mail? → 409 `CONFLICT` mit `field: 'email'`, message "Diese E-Mail ist bereits registriert."
3. Passwort mit bcrypt cost 10 hashen.
4. `verificationToken = cuid()` generieren, `verificationTokenExpiry = now + 24h` setzen (BUG-401-Fix v1.4.1).
5. CustomerUser anlegen (`emailVerified: false`, `verificationToken`, `verificationTokenExpiry`).
6. Mail an die angegebene Adresse: `customerVerificationMail` mit Link `${BASE_URL}/konto/verifizieren?token=<token>`. Fire-and-forget.

**Response 201:**

```json
{
  "data": {
    "id": "cu_abc...",
    "email": "maria@example.com",
    "emailVerified": false,
    "verificationMailSent": true
  }
}
```

**Rate-Limiting:** 5 Registrierungen / 60 min / IP.

**Fehler:**
- 400 `VALIDATION_ERROR`.
- 409 `CONFLICT` (E-Mail bereits registriert; `field: 'email'`).
- 429 `RATE_LIMITED`.

---

### `POST /api/customer/login`

**Auth:** öffentlich
**Story:** US-25 AC3, AC4

Authentifiziert einen Kunden und setzt das `customer-session`-Cookie.

**Request Body** (`CustomerLoginSchema`):

```json
{
  "email": "maria@example.com",
  "password": "geheim1234",
  "redirectUrl": "/konto/auftrag/bk_abc..."
}
```

| Feld          | Typ    | Pflicht | Validierung                                                                          |
| ------------- | ------ | ------- | ------------------------------------------------------------------------------------ |
| `email`       | string | ja      | E-Mail-Format.                                                                       |
| `password`    | string | ja      | mind. 1 Zeichen (Server-Side erfolgt Vergleich gegen Hash).                          |
| `redirectUrl` | string | nein    | Ziel-Pfad nach Login. **MAJOR-405-Fix:** nur relativer Pfad ohne Host (`/konto/...`). |

**Verhalten:**

1. E-Mail lowercase, CustomerUser lookup.
2. Wenn nicht vorhanden → konstante bcrypt-Last gegen DUMMY-Hash + 401 `UNAUTHORIZED` mit Message "E-Mail oder Passwort ungültig" (KEINE Auskunft, ob E-Mail existiert).
3. bcrypt.compare(password, hash) — bei false → 401 `UNAUTHORIZED` (gleiche Message).
4. Wenn `emailVerified === false` → 422 `EMAIL_NOT_VERIFIED` mit Hinweis "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse." (Frontend zeigt "Erneut senden"-Button).
5. JWT signieren: `{ customerId, email }`, `exp: now + 7d`. Cookie `customer-session` setzen (httpOnly, Secure, SameSite=Lax, Max-Age=604800).
6. **MAJOR-405-Fix (v1.4.1):** Wenn `redirectUrl` angegeben ist, validiere
   ihn via `safeCustomerCallback(url)` (siehe ARCHITECTURE.md §17.1):
     - String muss mit `/` beginnen UND darf KEIN `//` als Präfix haben
       (verhindert protokoll-relative URLs wie `//evil.example/`).
     - Darf KEIN `:` (Schema), `\\`, oder Whitespace enthalten.
     - Falls Validierung fehlschlägt → Fallback auf `/konto`.
   Frontend nutzt diesen geprüften Wert beim Redirect; das Backend
   gibt ihn zusätzlich als `data.redirectUrl` zurück, sodass Server-
   Components dieselbe Authority haben.
7. 200 OK.

**Response 200:**

```json
{
  "data": {
    "id": "cu_abc...",
    "email": "maria@example.com",
    "firstName": "Maria",
    "lastName": "Müller",
    "phone": "0157-12345678",
    "emailVerified": true,
    "createdAt": "2026-04-15T10:00:00.000Z",
    "redirectUrl": "/konto/auftrag/bk_abc..."
  }
}
```

`redirectUrl` ist der vom Backend validierte Pfad; bei fehlendem oder
ungültigem Input gibt das Backend `"/konto"` zurück (MAJOR-405-Fix).

(`Set-Cookie: customer-session=...` Header zusätzlich.)

**Rate-Limiting:** 10 Login-Versuche / 15 min / IP.

**Fehler:**
- 400 `VALIDATION_ERROR`.
- 401 `UNAUTHORIZED` (generische Message).
- 422 `EMAIL_NOT_VERIFIED`.
- 429 `RATE_LIMITED`.

---

### `POST /api/customer/logout`

**Auth:** Customer-Session (idempotent — funktioniert auch ohne).
**Story:** US-25

Löscht das Cookie via `Set-Cookie: customer-session=; Max-Age=0`.

**Response 200:** `{ "data": { "loggedOut": true } }`.

---

### `GET /api/customer/me`

**Auth:** Customer-Session
**Story:** US-25

Liefert den eingeloggten Kunden. Wird vom Frontend nach Login UND beim
initialen Page-Load von `/konto/*` aufgerufen, um Cookie-Validität zu
prüfen.

**Response 200** (`CustomerUserPublicSchema`):

```json
{
  "data": {
    "id": "cu_abc...",
    "email": "maria@example.com",
    "firstName": "Maria",
    "lastName": "Müller",
    "phone": "0157-12345678",
    "emailVerified": true,
    "createdAt": "2026-04-15T10:00:00.000Z"
  }
}
```

**Fehler:**
- 401 `UNAUTHORIZED` — kein/abgelaufenes Cookie.

---

### `PATCH /api/customer/me`

**Auth:** Customer-Session
**Story:** US-25 AC10

Aktualisiert Profil-Daten. **BUG-402-Fix (v1.4.1):** Im MVP NUR
`firstName`, `lastName`, `phone`. Eine E-Mail-Änderung ist NICHT
erlaubt — sie würde einen Pending-State-Mechanismus erfordern (damit
das Konto unter der alten Adresse bedienbar bleibt, bis die neue
verifiziert ist) und ist Backlog/IT5.

**Request Body** (`CustomerProfileUpdateSchema`, `.strict()`):

```json
{
  "firstName": "Maria",
  "lastName": "Müller-Neu",
  "phone": "0157-99999999"
}
```

| Feld         | Typ            | Pflicht | Validierung                        |
| ------------ | -------------- | ------- | ---------------------------------- |
| `firstName`  | string         | nein    | trim, 1–120 Zeichen                |
| `lastName`   | string         | nein    | trim, 1–120 Zeichen                |
| `phone`      | string \| null | nein    | `phoneOptionalSchema`              |

**Strict mode:** Unbekannte Felder (insb. `email`) führen zu 400
`VALIDATION_ERROR` mit `field: 'email'` (bzw. dem unbekannten Feld).
Frontend zeigt das `email`-Feld im Profilformular nur read-only an
mit Hinweistext: "E-Mail-Adresse kann derzeit nicht selbst geändert
werden. Bitte wenden Sie sich an unser Team."

**Verhalten:**

1. Session-Lookup → 401 wenn fehlt.
2. Body via `CustomerProfileUpdateSchema` parsen → 400 bei unbekannten
   Feldern oder Validierungs-Fehlern.
3. `prisma.customerUser.update({ where: { id: me.id }, data: { ... } })`.
4. Response 200 mit aktualisiertem `CustomerUserPublicSchema`.

**Response 200:** `CustomerUserPublicSchema`.

**Fehler:**
- 400 `VALIDATION_ERROR` (unbekanntes Feld inkl. `email`, oder Format-Fehler).
- 401 `UNAUTHORIZED`.

---

### `GET /api/customer/verify?token=...`

**Auth:** öffentlich (Token-basiert)
**Story:** US-25 AC2

Aktiviert ein Konto via Verifikations-Link aus der Mail.

**Verhalten:**

1. Token-Lookup (`customer_users.verification_token === token`).
2. Wenn nicht gefunden → 302 Redirect `/konto/login?error=invalid_token`.
3. **BUG-401-Fix (v1.4.1):** Wenn `verificationTokenExpiry IS NULL`
   ODER `verificationTokenExpiry <= now` → 302 Redirect
   `/konto/login?error=invalid_token` (Token abgelaufen).
   *(Vorher fälschlich gegen `createdAt + 24h` geprüft — was beim
   Resend nicht aktualisiert wurde und damit zu Sackgassen-Konten
   führte.)*
4. Sonst: in einer Transaktion `emailVerified = true`, `verificationToken = NULL`,
   `verificationTokenExpiry = NULL` setzen.
5. **Optional**: setze gleich das `customer-session`-Cookie (Auto-Login
   nach Verifikation), damit der Redirect zu `/konto` direkt klappt
   (US-25 AC2).

**Response:** 302 Redirect auf `/konto?verified=1` (mit Set-Cookie-Header bei Auto-Login).

**Fehler:** Bei Token-Fehler: 302 Redirect auf `/konto/login?error=invalid_token`.

---

### `POST /api/customer/resend-verification`

**Auth:** öffentlich (Body enthält E-Mail).
**Story:** US-25 AC1, AC2

Sendet die Verifikations-Mail neu.

**Request Body:** `{ "email": "maria@example.com" }`

**Verhalten:**

1. Lookup CustomerUser via E-Mail. Wenn nicht gefunden ODER schon
   verifiziert → trotzdem **200 OK** zurückgeben (Enumeration-Schutz),
   ohne Mail zu senden.
2. Sonst (BUG-401-Fix v1.4.1): in einer Transaktion **beide** Felder
   setzen — `verificationToken = newCuid()` UND
   `verificationTokenExpiry = now + 24h`. Anschließend
   `customerVerificationMail` mit dem neuen Token senden.

   **Wichtig:** `createdAt` bleibt unverändert (Audit-Feld bleibt
   intakt). Der Ablauf-Check im Verify-Endpoint vergleicht
   `verificationTokenExpiry` (siehe `GET /api/customer/verify`).

**Response 200:** `{ "data": { "ok": true } }` (immer).

**Rate-Limiting:** 3 Anfragen / 60 min / IP + 3 / 24h / Email.

---

### `POST /api/customer/forgot-password`

**Auth:** öffentlich
**Story:** US-25 AC5

Startet den Passwort-Reset-Flow.

**Request Body** (`CustomerForgotPasswordSchema`):

```json
{ "email": "maria@example.com" }
```

**Verhalten:**

1. CustomerUser-Lookup (lowercase).
2. Wenn nicht vorhanden → trotzdem **200 OK** (Enumeration-Schutz).
3. Wenn vorhanden: `resetToken = cuid()`, `resetTokenExpiry = now + 1h`.
4. Persistieren + Mail an `email` mit Link
   `${BASE_URL}/konto/passwort-zuruecksetzen?token=<resetToken>`.

**Response 200:** `{ "data": { "ok": true } }` (immer).

**Rate-Limiting:** 3 Anfragen / 60 min / IP + 3 / 24h / Email.

---

### `POST /api/customer/reset-password`

**Auth:** öffentlich (Token-basiert)
**Story:** US-25 AC6

Setzt ein neues Passwort.

**Request Body** (`CustomerResetPasswordSchema`):

```json
{
  "token": "rst_abc...",
  "password": "neuesPasswort12",
  "passwordConfirm": "neuesPasswort12"
}
```

**Verhalten:**

1. Token-Lookup.
2. Wenn nicht gefunden ODER `resetTokenExpiry < now` → 400 `VALIDATION_ERROR` ("Der Link ist nicht mehr gültig.").
3. bcrypt-Hash erzeugen, `passwordHash` setzen, `resetToken` + `resetTokenExpiry` auf null.
4. **Wichtig**: alle bestehenden `customer-session`-JWTs werden NICHT
   invalidiert (kein Server-Side-Token-Store). Engineers-Hinweis:
   das ist akzeptabel im MVP, weil Reset üblicherweise nach Konto-
   Übernahme passiert UND der Angreifer das alte JWT ohnehin nicht hat.

**Response 200:** `{ "data": { "ok": true } }`.

**Rate-Limiting:** 5 Versuche / 60 min / IP.

---

## 12. Kundenportal — Buchungen (Iteration 4 — US-26/US-27)

### `GET /api/customer/bookings`

**Auth:** Customer-Session
**Story:** US-26 AC1, AC2, AC3

Liefert alle Buchungen des eingeloggten Kunden, gesplittet nach
"Bevorstehend" und "Vergangen". Sortierung pro Bucket: chronologisch
(upcoming aufsteigend, past absteigend).

**Algorithmus:**

```
me = readCustomerSession(req)
today = todayInBerlin() // "YYYY-MM-DD"

bookings = prisma.booking.findMany({
  where: { customerId: me.id },
  include: { attachments, payment, review }
})

upcoming = bookings.filter(b => b.date >= today && b.status !== 'COMPLETED')
                   .sort((a, b) => compareDateTime(a, b)) // asc

past = bookings.filter(b => b.date < today || b.status === 'COMPLETED')
               .sort((a, b) => compareDateTime(b, a)) // desc
```

**Response 200** (`CustomerBookingsResponseSchema`):

```json
{
  "data": {
    "upcoming": [
      {
        "id": "bk_abc...",
        "date": "2026-05-15",
        "startTime": "09:00",
        "endTime": "10:00",
        "service": "entruempelung",
        "description": "Keller entrümpeln",
        "status": "CONFIRMED",
        "cancellableUntilHours": 48,
        "isCancellable": true,
        "canReview": false,
        "attachments": [],
        "payment": {
          "id": "pay_xyz",
          "amount": 14000,
          "currency": "eur",
          "status": "PENDING",
          "paidAt": null
        },
        "review": null,
        "createdAt": "2026-05-02T10:00:00.000Z",
        "updatedAt": "2026-05-02T10:00:00.000Z"
      }
    ],
    "past": []
  }
}
```

**`isCancellable`-Berechnung (Backend) — v1.4.1, MAJOR-401 + MAJOR-404 berücksichtigt:**

```ts
/**
 * Liefert den Termin-Zeitpunkt einer Buchung als UTC-Date.
 *
 * - IT3+: aus b.date + b.startTime via parseBerlinDateTime()
 *   (interpretiert "YYYY-MM-DD" + "HH:MM" als Berlin-Wall-Clock und
 *   gibt einen UTC-Zeitpunkt zurück; DST-fest, siehe ARCHITECTURE.md §17.7).
 * - IT1/IT2 (Bestand): aus b.slot.startsAt (UTC-DateTime).
 * - sonst: null (Buchung hat keinen bekannten Termin).
 */
function bookingStartUTC(b: Booking & { slot?: Slot | null }): Date | null {
  if (b.date && b.startTime) return parseBerlinDateTime(b.date, b.startTime);
  if (b.slot?.startsAt)      return new Date(b.slot.startsAt);
  return null;
}

function isCancellable(b: Booking & { slot?: Slot | null }): boolean {
  if (!PORTAL_CANCELLABLE_STATUSES.includes(b.status)) return false;

  const start = bookingStartUTC(b);

  // MAJOR-404: Bestandsbuchungen ohne bekannten Termin (weder date noch slot)
  // können nicht sinnvoll bewertet werden. Wir geben TRUE zurück, damit der
  // Kunde nicht fest hängt — Server-Endpoint wird die 24h-Frist selbst
  // erneut prüfen (Authority).
  if (!start) return true;

  // 24h-Frist gilt nur für CONFIRMED.
  if (b.status === 'CONFIRMED') {
    return start.getTime() - Date.now() > 24 * 60 * 60 * 1000;
  }

  // PENDING / COUNTER_PROPOSED: solange Termin in der Zukunft liegt.
  return start.getTime() > Date.now();
}
```

**Eigenschaften:**

- **MAJOR-401** (DST-Fest): `parseBerlinDateTime(date, time)` interpretiert
  Berlin-Wall-Clock korrekt und liefert einen UTC-Zeitpunkt. DST-Übergänge
  (letzter Sonntag im März / Oktober) werden korrekt aufgelöst — die
  24h-Frist ist physische Echtzeit, nicht naïve Tag-Differenz.
- **MAJOR-404** (Null-Fest): Buchungen ohne `date` UND ohne `slot` werden
  defensiv als cancellable behandelt; der Cancel-Endpoint führt seinen
  eigenen 24h-Check durch und ist Authority.
- **Bestandsbuchungen** (Slot-basiert, IT1/IT2 mit `slot.startsAt`):
  Datum kommt aus `slot.startsAt` (UTC). `isCancellable` funktioniert
  damit auch für historische Buchungen, die Tom evtl. nachträglich
  einem Customer-Konto zuweist.

`cancellableUntilHours` zeigt die Stunden, die noch bis zum Termin
fehlen — wenn negativ ODER Status nicht cancellable ODER `start === null`
ist, Wert ist `null`.

`canReview` ist true gdw. `status === 'COMPLETED'` UND `review === null`.

`Cache-Control: no-store`.

**Fehler:**
- 401 `UNAUTHORIZED`.

---

### `GET /api/customer/bookings/:id`

**Auth:** Customer-Session
**Story:** US-26 AC4

Liefert eine einzelne Buchung des eingeloggten Kunden mit vollen Details.

**Verhalten:**

1. Booking lookup. Wenn `customerId !== me.id` → 404 `NOT_FOUND` (NICHT 403 — Existenz nicht preisgeben).
2. Sonst: Response wie Items aus `GET /api/customer/bookings`.

**Response 200:** `CustomerBookingSchema`.

**Fehler:**
- 401 `UNAUTHORIZED`.
- 404 `NOT_FOUND`.

---

### `POST /api/customer/bookings/:id/cancel`

**Auth:** Customer-Session
**Story:** US-27

Storniert eine Buchung des eingeloggten Kunden, sofern Bedingungen
erfüllt sind.

**Request Body:** keiner (POST ohne Body).

**Verhalten:**

1. Booking-Lookup, Ownership-Check (`customerId === me.id`) → sonst 404.
2. `isCancellable(booking)` prüfen → sonst 409 `CONFLICT` mit Message:
   - Status nicht erlaubt: "Diese Buchung kann nicht mehr storniert werden."
   - 24h-Frist verletzt: "Stornierung nur bis 24 Stunden vor dem Termin möglich. Bitte rufen Sie uns an: 0157-74787512."
3. `prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } })`.
4. Mail an Tom (`cancellationToAdmin`, vorhandenes IT2-Template). Fire-and-forget.

**Response 200:**

```json
{
  "data": {
    "id": "bk_abc...",
    "status": "CANCELLED",
    "cancelledAt": "2026-05-02T13:42:00.000Z"
  }
}
```

**Fehler:**
- 401 `UNAUTHORIZED`.
- 404 `NOT_FOUND` — Buchung gehört nicht dem Kunden / existiert nicht.
- 409 `CONFLICT` — Status nicht stornierbar oder 24h-Frist überschritten.

---

## 13. Zahlung — Stripe-Integration (Iteration 4 — US-28)

### `POST /api/admin/bookings/:id/payment`

**Auth:** Admin
**Story:** US-28 AC1

Tom hinterlegt einen Zahlbetrag für eine bestätigte Buchung. Erstellt
einen `Payment`-Datensatz (Status PENDING) und sendet eine
Zahlungsaufforderung per Mail an den Kunden.

**Voraussetzungen:**

- Booking-Status muss `CONFIRMED` oder `COMPLETED` sein. Sonst 409
  `CONFLICT` ("Zahlbetrag erst nach Terminbestätigung möglich.").
- Booking darf noch keine Payment haben (Update via DELETE + neu
  anlegen, falls Tom korrigieren will). Sonst 409 `CONFLICT`
  ("Für diese Buchung wurde bereits ein Betrag hinterlegt.").

**Request Body** (`CreatePaymentSchema`):

```json
{
  "amount": 14000,
  "currency": "eur",
  "description": "Entrümpelung Keller, 4h"
}
```

| Feld          | Typ    | Pflicht | Validierung                                  |
| ------------- | ------ | ------- | -------------------------------------------- |
| `amount`      | number | ja      | Cents, integer, 100 <= x <= 1_000_000.        |
| `currency`    | string | nein    | Default `'eur'`. Aktuell nur 'eur' erlaubt.   |
| `description` | string | nein    | max 500 Zeichen. Wird Stripe als description weitergereicht. |

**Verhalten:**

1. Booking laden, Status-Check.
2. Payment anlegen: `{ bookingId, amount, currency, description, status: 'PENDING' }`.
3. Mail an `booking.customerEmail` (`paymentRequestToCustomer`-Template):
   - Subject: "Ihre Rechnung von Bärenstark Hausservice"
   - Inhalt: Datum/Service/Betrag, Link `${BASE_URL}/konto/zahlung/${booking.id}?token=${booking.cancelToken}` (fallback-Token, falls der Kunde nicht eingeloggt ist).
4. Antwort 201 mit Payment-Datensatz.

**Response 201:** `PaymentSchema`.

**Fehler:**
- 400 `VALIDATION_ERROR`.
- 401 `UNAUTHORIZED`.
- 404 `NOT_FOUND`.
- 409 `CONFLICT` — Booking nicht in zulässigem Status / Payment existiert bereits.

---

### `DELETE /api/admin/bookings/:id/payment`

**Auth:** Admin
**Story:** US-28 (Hilfs-Endpoint)

Löscht eine PENDING-Payment, damit Tom den Betrag korrigieren kann
(z.B. Tippfehler).

**Voraussetzungen:**
- Payment muss `status === 'PENDING'` sein (PAID/FAILED/REFUNDED dürfen
  NICHT gelöscht werden — historische Konsistenz).

**Response 204:** kein Body.

**Fehler:**
- 401 `UNAUTHORIZED`.
- 404 `NOT_FOUND`.
- 409 `CONFLICT` — Payment ist bereits bezahlt / refunded / failed.

---

### `POST /api/payments/create-session`

**Auth:** Customer-Session ODER `cancelToken` als Auth-Fallback (siehe Body).
**Story:** US-28 AC2, AC3, AC4, AC5

Erzeugt eine Stripe-Checkout-Session und gibt die Stripe-URL zurück.
Frontend macht `window.location = url`.

**Request Body** (`CreatePaymentSessionSchema`):

```json
{
  "bookingId": "bk_abc...",
  "cancelToken": "tok_xyz..."
}
```

`cancelToken` ist optional — nur erforderlich, wenn der Kunde nicht
eingeloggt ist (Fallback für E-Mail-Klick ohne Konto).

**Verhalten:**

1. Auth-Check:
   - Wenn `customer-session`-Cookie vorhanden: Booking muss `customerId === me.id` haben.
   - Sonst: `cancelToken` muss zur Booking gehören. Sonst 401.
2. Payment-Lookup über `bookingId`. Wenn nicht vorhanden → 404 (Tom hat noch keinen Betrag hinterlegt).
3. Status-Check:
   - PAID: 409 `CONFLICT` ("Diese Buchung wurde bereits bezahlt.").
   - REFUNDED: 409 `CONFLICT` ("Diese Zahlung wurde zurückerstattet.").
   - PENDING/FAILED: weiter.
4. Stripe Checkout Session erstellen via Stripe SDK:
   ```ts
   const session = await stripe.checkout.sessions.create({
     mode: 'payment',
     payment_method_types: ['card', 'paypal'],
     // Apple Pay / Google Pay laufen über 'card' (automatisch mit Wallets).
     line_items: [{
       price_data: {
         currency: payment.currency,
         product_data: { name: `Bärenstark — ${SERVICE_LABELS[booking.service]}` , description: payment.description ?? undefined },
         unit_amount: payment.amount,
       },
       quantity: 1,
     }],
     metadata: { bookingId, paymentId: payment.id },
     success_url: `${BASE_URL}/konto/zahlung/erfolg?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url:  `${BASE_URL}/konto/zahlung/${bookingId}`,
     customer_email: booking.customerEmail,
     locale: 'de',
   });
   ```
5. Payment.stripeSessionId mit `session.id` aktualisieren. Wenn vorher `status === 'FAILED'`, auf `PENDING` zurücksetzen (neuer Versuch).
6. Antwort `{ url: session.url, sessionId: session.id }`.

**Response 201** (`CreatePaymentSessionResponseSchema`):

```json
{
  "data": {
    "url": "https://checkout.stripe.com/c/pay/cs_test_abc...",
    "sessionId": "cs_test_abc..."
  }
}
```

**Idempotenz:** Wenn die bestehende Payment-Session noch nicht abgelaufen
ist (Stripe-Sessions: 24h Default), wird sie wiederverwendet (gleiche
`stripeSessionId`, gleiche URL). Engineers-Hinweis: einfaches
Re-Generate ist auch akzeptabel — Stripe verrechnet erst beim Abschluss.

**Fehler:**
- 400 `VALIDATION_ERROR`.
- 401 `UNAUTHORIZED`.
- 404 `NOT_FOUND` — Booking oder Payment nicht gefunden.
- 409 `CONFLICT` — Payment bereits PAID/REFUNDED.
- 502 `STRIPE_ERROR` — Stripe-API nicht erreichbar.

---

### `GET /api/payments/session-status?session_id=...`

**Auth:** öffentlich (Stripe-Session-ID wirkt token-artig).
**Story:** US-28 AC6, AC7 (MAJOR-402-Fix v1.4.1)

Liefert den aktuellen Payment-Status zu einer Stripe-Checkout-Session.
Wird vom Frontend auf `/konto/zahlung/erfolg?session_id=cs_test_...`
**polled** — auch von Gästen, die nicht eingeloggt sind und somit
`/api/customer/me` / `/api/customer/bookings/:id` nicht nutzen können.

**Hintergrund (MAJOR-402):** Die alte Spec verlangte Polling auf
`GET /api/customer/bookings/:id` — das schlägt für Gäste mit 401 fehl.
Der neue öffentliche Endpoint löst das, ohne sensitive Kunden-Daten
zu exponieren (er liefert nur Status + paidAt + bookingId).

**Query** (`SessionStatusQuerySchema`):

| Name         | Typ    | Pflicht | Validierung                                              |
| ------------ | ------ | ------- | -------------------------------------------------------- |
| `session_id` | string | ja      | Pattern `^cs_(test\|live)_[A-Za-z0-9]+$` (Stripe-Format). |

**Verhalten:**

1. `prisma.payment.findUnique({ where: { stripeSessionId: query.session_id } })`.
2. Wenn nicht gefunden → 404 `NOT_FOUND` (kein Hinweis auf Existenz).
3. Sonst Response 200 mit `SessionStatusSchema`.

**Response 200** (`SessionStatusSchema`):

```json
{
  "data": {
    "sessionId": "cs_test_abc...",
    "status": "PAID",
    "paidAt": "2026-05-02T13:45:21.000Z",
    "bookingId": "bk_abc..."
  }
}
```

**Frontend-Polling (Konsument):**

- Direkt nach Page-Load: erster Call.
- Wenn `status === 'PENDING'`: bis zu **5 Wiederholungen** (`PAYMENT_SESSION_POLL_MAX_ATTEMPTS`)
  im Abstand von **1 s** (`PAYMENT_SESSION_POLL_INTERVAL_MS`).
- Wenn nach den 5 Versuchen weiterhin PENDING → Frontend zeigt:
  "Wir verarbeiten Ihre Zahlung. Sie erhalten in Kürze eine E-Mail-Bestätigung."
- Eingeloggte Kunden bekommen zusätzlich einen Link zu `/konto/auftrag/<bookingId>`;
  Gäste sehen nur den statischen Bestätigungstext (kein Login-Hinweis).

`Cache-Control: no-store`.

**Rate-Limiting:** 60 Calls / 5 min / IP (sanity-cap; Frontend macht max 5 in 5s).

**Fehler:**
- 400 `VALIDATION_ERROR` (ungültiges `session_id`-Format).
- 404 `NOT_FOUND`.
- 429 `RATE_LIMITED`.

---

### `POST /api/payments/webhook`

**Auth:** Stripe-Signatur-Check (`STRIPE_WEBHOOK_SECRET`)
**Story:** US-28 AC6

Stripe-Webhook-Endpoint. Stripe sendet POST mit Event-Payload und
Header `stripe-signature`. Backend muss:

1. **Raw-Body** lesen (kein automatisches Parsing — Next.js: in Route-
   Handler `await req.text()` statt `req.json()`).
2. `stripe.webhooks.constructEvent(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET)` aufrufen — wirft bei ungültiger Signatur.
3. Auf Event-Type matchen:

| Event-Type                          | Aktion                                                        |
| ----------------------------------- | ------------------------------------------------------------- |
| `checkout.session.completed`        | Payment auf PAID, paidAt = now. Mail an Kunden + Tom.          |
| `checkout.session.expired`          | Payment auf FAILED. Keine Mail (Kunde hat einfach geschlossen). |
| `payment_intent.payment_failed`     | Payment auf FAILED. Optional Mail an Kunden ("Bitte erneut").  |
| `charge.refunded`                   | Payment auf REFUNDED. Mail an Kunden ("Rückerstattung erfolgt"). |
| Andere                              | Ignoriert, 200 OK.                                            |

**Idempotenz**: Stripe sendet Events potenziell mehrfach. Backend prüft
vor jedem Update den Status — wenn schon PAID, kein erneuter
Mail-Versand (kein Update).

**Authentizität-Check ist Pflicht** — ohne Signatur-Check kann jeder die
URL POSTen und Bezahl-Status faken. `STRIPE_WEBHOOK_SECRET` wird beim
Anlegen des Webhooks im Stripe-Dashboard generiert.

**Response 200:** `{ "received": true }` (Stripe akzeptiert nur 2xx).

**Bei Signatur-Fehler:** 400 `VALIDATION_ERROR`. Stripe wiederholt automatisch.

**Bei DB-Fehler:** 500 (Stripe wiederholt automatisch — bis zu 3 Tage lang).

---

## 14. Reviews (Iteration 4 — US-29)

### `POST /api/customer/reviews`

**Auth:** Customer-Session
**Story:** US-29 AC1, AC2, AC3, AC4

Erstellt eine Bewertung zu einer abgeschlossenen Buchung.

**Request Body** (`CreateReviewSchema`):

```json
{
  "bookingId": "bk_abc...",
  "stars": 5,
  "text": "Super Service, jederzeit wieder!"
}
```

| Feld        | Typ    | Pflicht | Validierung                                              |
| ----------- | ------ | ------- | -------------------------------------------------------- |
| `bookingId` | string | ja      | Existiert + gehört Kunden + Status COMPLETED + keine Review. |
| `stars`     | number | ja      | 1–5 (integer).                                           |
| `text`      | string | nein    | trim, max 500 Zeichen.                                   |

**Verhalten:**

1. Booking-Lookup, Ownership-Check.
2. Status muss `COMPLETED` sein → sonst 409 `CONFLICT` ("Bewertung erst nach Auftragsabschluss möglich.").
3. `booking.review === null` → sonst 409 `CONFLICT` ("Sie haben diese Buchung bereits bewertet.").
4. Review anlegen mit `approved: false`.
5. Optional: Mail an Tom ("Neue Bewertung wartet auf Freigabe") — fire-and-forget.

**Response 201** (`ReviewSchema` — eingeschränkt):

```json
{
  "data": {
    "id": "rv_xyz...",
    "stars": 5,
    "text": "Super Service, jederzeit wieder!",
    "approved": false,
    "createdAt": "2026-05-02T13:42:00.000Z"
  }
}
```

**Fehler:**
- 400 `VALIDATION_ERROR`.
- 401 `UNAUTHORIZED`.
- 404 `NOT_FOUND`.
- 409 `CONFLICT`.

---

### `GET /api/reviews`

**Auth:** öffentlich
**Story:** US-29 AC7, AC8

Liefert alle freigegebenen Bewertungen für die Startseiten-Sektion.
Ersetzt die statische Liste aus `lib/reviews.ts` (US-22), sobald
mindestens `REVIEW_MIN_APPROVED_TO_REPLACE_STATIC = 4` echte Reviews
vorhanden sind.

**Query-Parameter:**

| Name    | Typ    | Pflicht | Default | Validierung |
| ------- | ------ | ------- | ------- | ----------- |
| `limit` | number | nein    | 20      | 1–100       |

**Verhalten:**

1. `prisma.review.findMany({ where: { approved: true }, orderBy: { createdAt: 'desc' }, take: limit, include: { customer: true, booking: { select: { service: true } } } })`.
2. **MAJOR-403-Klärung (v1.4.1):** Server berechnet `customerName` im Response-Mapper (kein DB-Feld):
   - `customer !== null` → `customerName = customer.firstName + ' ' + customer.lastName[0] + '.'`
   - `customer === null` (FK SET NULL nach Konto-Löschung — im MVP nicht möglich) → `customerName = 'Anonym'`
3. `service` aus `booking.service` (kann null sein, falls Booking gelöscht wurde — dann wird Service auch `null`).

**Response 200:**

```json
{
  "data": {
    "items": [
      {
        "id": "rv_xyz...",
        "customerName": "Maria M.",
        "service": "entruempelung",
        "stars": 5,
        "text": "Super Service, jederzeit wieder!",
        "createdAt": "2026-05-02T13:42:00.000Z"
      }
    ],
    "average": 4.7,
    "total": 12
  }
}
```

`average` = arithmetisches Mittel aller approved-stars. `total` = Gesamtanzahl approved Reviews.

`Cache-Control: public, max-age=60, stale-while-revalidate=300`.

**Fehler:** keine spezifischen.

---

### `GET /api/admin/reviews`

**Auth:** Admin
**Story:** US-29 AC6

Liefert alle Bewertungen (approved + pending), sortiert nach createdAt
desc, für die Moderations-UI.

**Query-Parameter:**

| Name       | Typ      | Pflicht | Default | Beschreibung                         |
| ---------- | -------- | ------- | ------- | ------------------------------------ |
| `approved` | boolean  | nein    | alle    | true / false → filtert auf Status.    |

**Response 200:** `{ "data": Review[] }` mit vollem `ReviewSchema`
(inkl. customerName aus User+Booking, customerId, bookingId, alle
Felder — **keine** Nachnamen-Kürzung, Tom sieht die volle Identität
für die Moderations-Entscheidung).

**`customerName`-Berechnung (Admin-Layer, MAJOR-403-Klärung v1.4.1):**

- `customer !== null` → `customerName = customer.firstName + ' ' + customer.lastName` (volltändig).
- `customer === null` → `customerName = 'Anonym'`.

`Cache-Control: no-store`.

---

### `PATCH /api/admin/reviews/:id`

**Auth:** Admin
**Story:** US-29 AC6, AC7

Setzt `approved` auf true (Freigabe) oder false (Ablehnung / Rückzug).

**Request Body** (`ApproveReviewSchema`):

```json
{ "approved": true }
```

**Verhalten:**

- Update direkt; Idempotenz: gleicher Wert → 200 ohne DB-Schreiben.
- Bei Ablehnung (true → false): keine Mail an Kunden (Stille).
- Bei Erst-Freigabe: optional Mail an Kunden ("Ihre Bewertung wurde veröffentlicht").

**Response 200:** `ReviewSchema`.

**Fehler:**
- 401 `UNAUTHORIZED`.
- 404 `NOT_FOUND`.

---

## 15. Booking-Erweiterung — `POST /api/bookings` (IT4)

`POST /api/bookings` bleibt **bezüglich Body unverändert** (kein neues
Feld). Backend liest beim Request:

```ts
const customerSession = await readCustomerSession(req); // null oder { id }
const body = CreateBookingSchema.parse(await req.json());

await prisma.booking.create({
  data: {
    ...body,
    customerId: customerSession?.id ?? null, // <-- IT4
  },
});
```

So bekommt eine eingeloggte Kundin ihre Buchung automatisch zugeordnet
(US-25 AC8). Gastbuchungen funktionieren weiter wie bisher.

---

## 16. PATCH /api/bookings/:id — IT4-Erweiterung

`UpdateBookingStatusSchema` akzeptiert in IT4 den neuen Status
`COMPLETED`. State-Machine-Übergänge:

| Vorher    | Nachher    | Erlaubt? | Mail-Trigger                    |
| --------- | ---------- | -------- | ------------------------------- |
| CONFIRMED | COMPLETED  | ✓        | Optional: "Termin abgeschlossen — bitte bewerten Sie uns" mit Link `/konto/auftrag/:id`. |
| PENDING   | COMPLETED  | ✗ (400)  | —                               |
| Andere    | COMPLETED  | ✗ (400)  | —                               |
| COMPLETED | →anderes   | ✗ (400)  | Endstatus, nur Idempotenz erlaubt. |

Übrige Übergänge wie IT3 (siehe Section 2). Mail-Trigger
`bookingConfirmationToCustomer` bleibt.

---

## 17. Endpoint-zu-Story-Matrix (Iteration 4 erweitert)

| Endpoint                                       | US-25 | US-26 | US-27 | US-28 | US-29 |
| ---------------------------------------------- | :---: | :---: | :---: | :---: | :---: |
| `POST /api/customer/register`                  |   ✓   |       |       |       |       |
| `POST /api/customer/login`                     |   ✓   |       |       |       |       |
| `POST /api/customer/logout`                    |   ✓   |       |       |       |       |
| `GET /api/customer/me`                         |   ✓   |       |       |       |       |
| `PATCH /api/customer/me`                       |   ✓   |       |       |       |       |
| `GET /api/customer/verify`                     |   ✓   |       |       |       |       |
| `POST /api/customer/resend-verification`       |   ✓   |       |       |       |       |
| `POST /api/customer/forgot-password`           |   ✓   |       |       |       |       |
| `POST /api/customer/reset-password`            |   ✓   |       |       |       |       |
| `GET /api/customer/bookings`                   |       |   ✓   |       |       |       |
| `GET /api/customer/bookings/:id`               |       |   ✓   |       |   ✓   |   ✓   |
| `POST /api/customer/bookings/:id/cancel`       |       |       |   ✓   |       |       |
| `POST /api/admin/bookings/:id/payment`         |       |       |       |   ✓   |       |
| `DELETE /api/admin/bookings/:id/payment`       |       |       |       |   ✓   |       |
| `POST /api/payments/create-session`            |       |       |       |   ✓   |       |
| `GET /api/payments/session-status`             |       |       |       |   ✓   |       |
| `POST /api/payments/webhook`                   |       |       |       |   ✓   |       |
| `POST /api/customer/reviews`                   |       |       |       |       |   ✓   |
| `GET /api/reviews`                             |       |       |       |       |   ✓   |
| `GET /api/admin/reviews`                       |       |       |       |       |   ✓   |
| `PATCH /api/admin/reviews/:id`                 |       |       |       |       |   ✓   |
| `POST /api/bookings` (erweitert)               |       |   ✓   |       |       |       |
| `PATCH /api/bookings/:id` (COMPLETED)          |       |   ✓   |       |       |   ✓   |

---

## 18. Frontend-Aufrufer-Mapping (Iteration 4)

| Endpoint                                       | Aufgerufen von                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `POST /api/customer/register`                  | `app/konto/registrieren/page.tsx` (Form)                                        |
| `POST /api/customer/login`                     | `app/konto/login/page.tsx` (Form)                                               |
| `POST /api/customer/logout`                    | `components/customer/CustomerHeaderMenu.tsx`                                    |
| `GET /api/customer/me`                         | `app/konto/layout.tsx` (Server-Component) + `lib/customer-auth.ts` (Client-Hook) |
| `PATCH /api/customer/me`                       | `app/konto/profil/page.tsx`                                                      |
| `GET /api/customer/verify`                     | `app/konto/verifizieren/page.tsx` (Server-Action)                                |
| `POST /api/customer/forgot-password`           | `app/konto/passwort-vergessen/page.tsx`                                          |
| `POST /api/customer/reset-password`            | `app/konto/passwort-zuruecksetzen/page.tsx`                                      |
| `GET /api/customer/bookings`                   | `app/konto/page.tsx` (Server-Component)                                          |
| `GET /api/customer/bookings/:id`               | `app/konto/auftrag/[id]/page.tsx`                                                |
| `POST /api/customer/bookings/:id/cancel`       | `components/customer/CancelBookingButton.tsx`                                    |
| `POST /api/admin/bookings/:id/payment`         | `components/admin/PaymentEditor.tsx` (NEU IT4)                                   |
| `POST /api/payments/create-session`            | `app/konto/zahlung/[bookingId]/page.tsx`                                         |
| `GET /api/payments/session-status`             | `app/konto/zahlung/erfolg/page.tsx` (Polling, MAJOR-402)                         |
| `POST /api/customer/reviews`                   | `components/customer/ReviewForm.tsx`                                             |
| `GET /api/reviews`                             | `components/home/ReviewSection.tsx` (umgebaut IT4)                               |
| `GET /api/admin/reviews`                       | `app/admin/reviews/page.tsx` (NEU IT4)                                           |
| `PATCH /api/admin/reviews/:id`                 | `components/admin/ReviewModerationTable.tsx`                                     |

---

## 19. ENV-Variablen (Iteration 4 ergänzt)

| Variable                  | Pflicht | Wert / Beispiel                        | Zweck                                  |
| ------------------------- | ------- | -------------------------------------- | -------------------------------------- |
| `STRIPE_SECRET_KEY`       | ja      | `sk_test_...` / `sk_live_...`          | Stripe-API-Auth (Server-side, US-28).  |
| `STRIPE_PUBLISHABLE_KEY`  | ja      | `pk_test_...` / `pk_live_...`          | Stripe-Frontend (optional für Embedded).|
| `STRIPE_WEBHOOK_SECRET`   | ja      | `whsec_...`                            | Webhook-Signatur-Validierung (US-28).  |
| `AUTH_SECRET`             | ja      | bestehend (NEXTAUTH_SECRET kann genutzt werden) | Wird auch fürs Customer-JWT verwendet. |

`AUTH_SECRET` ist im Bestand (NextAuth heißt sie `NEXTAUTH_SECRET` — Engineers können denselben Wert für Customer-JWT-Signing wiederverwenden, alternativ ein eigenes `CUSTOMER_AUTH_SECRET` setzen).

---

## 20. Rate-Limits (Iteration 4 ergänzt)

| Endpoint                                  | Rate-Limit                                                |
| ----------------------------------------- | --------------------------------------------------------- |
| `POST /api/customer/register`             | 5 / 60 min / IP                                            |
| `POST /api/customer/login`                | 10 / 15 min / IP                                           |
| `POST /api/customer/forgot-password`      | 3 / 60 min / IP, 3 / 24h / Email                            |
| `POST /api/customer/reset-password`       | 5 / 60 min / IP                                            |
| `POST /api/customer/resend-verification`  | 3 / 60 min / IP, 3 / 24h / Email                            |
| `POST /api/customer/reviews`              | 5 / 60 min / Customer (per customerId)                     |
| `POST /api/payments/create-session`       | 20 / 60 min / IP (Stripe-API-Schutz)                       |
| `GET /api/payments/session-status`        | 60 / 5 min / IP (sanity-cap; FE-Poll macht max 5 in 5s)    |
| `POST /api/payments/webhook`              | Kein Limit (Stripe-IPs trusted, Signatur-Check ist Authority). |


---

## 21. Iteration 5 — Endpoints (US-30 bis US-34)

### 21.1 Admin-Passwort-Reset (US-30) — UX-Fix, keine API-Änderung

Bestehende Endpoints bleiben unverändert:

- `POST /api/admin/forgot-password` — Body `{ email }`, antwortet
  immer 200 (Enumeration-Schutz). **Fix v1.5:** BASE_URL wird strikt
  aus `NEXTAUTH_URL` (mit Fallback `NEXT_PUBLIC_BASE_URL` und
  zuletzt `VERCEL_URL`) abgeleitet — damit funktioniert der Reset-
  Link in lokaler Entwicklung (`http://localhost:3000`) UND auf
  Vercel-Produktion. Reihenfolge der Auswertung ist im Helper
  `lib/baseUrl.ts.adminBaseUrl()` festgelegt (siehe
  ARCHITECTURE.md §18.1).
- `POST /api/admin/reset-password` — Body `{ token, password }`,
  Mindestlänge 8 Zeichen (war vorher 12; angepasst auf US-30 AC4).
  Bei abgelaufenem/verbrauchtem Token: 410 `GONE`.

**Mail-Template:** `sendPasswordResetEmail(to, resetUrl)` (Bestand IT4)
wird wiederverwendet. Engineers müssen sicherstellen, dass die Mail-
Variante für den Admin-Kontext den korrekten Subject und Sender-Namen
nutzt — falls Tom das Template optisch trennen möchte, ist
`sendAdminPasswordResetEmail()` als Alias-Wrapper erlaubt (gleiche
Implementation, anderer Subject).

**Middleware-Whitelist (verifiziert):**
```
PUBLIC_ADMIN_PATHS = [
  '/admin/login',
  '/admin/setup',
  '/admin/passwort-vergessen',  // bereits vorhanden, nicht ändern
  '/admin/passwort-reset',      // bereits vorhanden, nicht ändern
];
```

> **REVISED v1.6.1 (QA-Revision F1) — siehe `ARCHITECTURE_IT6.md`
> Anhang B §17.1.** `/admin/setup` bleibt zwar in
> `PUBLIC_ADMIN_PATHS`, aber `POST /api/admin/setup` ist **nicht mehr
> bedingungslos** akzeptiert. Der Endpoint blockiert jeden Request,
> dessen Email **nicht** mit der ENV-Var `BOOTSTRAP_ADMIN_EMAIL`
> übereinstimmt (403 `BOOTSTRAP_NOT_ALLOWED`). Fehlt die ENV → 503
> `SETUP_NOT_CONFIGURED`. Sobald `users` ≥ 1 Datensatz enthält,
> liefert der Endpoint 410 `GONE` (ENV wird ignoriert).

---

### 21.2 OAuth2 Customer-Login (US-31)

#### `GET/POST /api/auth/customer/[...nextauth]`

**Auth:** öffentlich (NextAuth verwaltet Sessions selbst)
**Story:** US-31

NextAuth-Handler **speziell für Kunden-OAuth**. Liegt unter dem
separaten Pfad `/api/auth/customer/...`, damit er nicht mit dem
bestehenden Admin-NextAuth-Handler unter `/api/auth/[...nextauth]`
kollidiert.

**Provider-Konfiguration** (in `lib/customer-oauth.ts`):

```ts
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';

export const customerOauthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // E-Mail-Scope ist Default; explizit für Klarheit:
      authorization: { params: { scope: 'openid email profile' } },
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // GitHub liefert E-Mail nicht standardmäßig — Scope erweitern:
      authorization: { params: { scope: 'read:user user:email' } },
    }),
  ],
  pages: {
    signIn: '/konto/login',
    error: '/konto/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // v1.5.1 Fix BUG-IT5-002: Cookie-Setzen passiert NICHT hier
      // (kein Response-Zugriff im signIn-Callback). Stattdessen:
      // 1. GitHub kein E-Mail? → return '/konto/login?error=oauth_no_email'
      //    (BUG-IT5-003).
      // 2. Profile via OAuthProfileNormalizedSchema normalisieren.
      // 3. handleCustomerOAuthSignIn() → CustomerUser lookup/create
      //    inkl. Account-Linking-Sicherheits-Check (BUG-IT5-004,
      //    siehe ARCHITECTURE.md §18.9.2):
      //      - Lokales Konto verifiziert → Verknüpfung OK.
      //      - Lokales Konto unverifiziert + gleiche E-Mail
      //        → return '/konto/login?error=oauth_unverified_conflict'.
      // 4. Erfolgsfall: customerId in jwt-Callback-Token schreiben
      //    (s.u.) und return true.
      return true;
    },
    async jwt({ token, user, account, profile }) {
      // v1.5.1 Fix BUG-IT5-002: customerId für oauth-finalize-Route
      // hier in den Session-Token schreiben.
      if (account && profile) {
        const result = await handleCustomerOAuthSignIn(...);
        if (result.ok) {
          token.customerId = result.customerId;
          token.customerEmail = result.email;
        }
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      // v1.5.1 Fix BUG-IT5-002: IMMER zur Finalize-Route umleiten.
      // Open-Redirect-Schutz: externe `url`-Werte werden ignoriert.
      return `${baseUrl}/api/customer/oauth-finalize`;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 60,  // NextAuth-eigene Session ist Kurzzeit-Brücke
                 // bis zum customer-session-Cookie.
  },
};
```

**Verhalten im Detail (v1.5.1, Redirect-basierte Finalize-Route):**

1. Frontend: User klickt „Mit Google anmelden" → `signIn('google',
   { callbackUrl: '/konto' })` (NextAuth-Helper, mit
   `basePath: '/api/auth/customer'`).
2. NextAuth leitet zum Provider, übernimmt Auth-Flow (state, PKCE).
3. Provider-Callback: `GET /api/auth/customer/callback/google?code=...`
   (oder `.../callback/github?code=...`).
4. Im `signIn`-Callback (siehe Code oben):
   - GitHub-Spezialfall: kein E-Mail → return-String
     `/konto/login?error=oauth_no_email`.
   - `profile` wird via `OAuthProfileNormalizedSchema` normalisiert
     (siehe `lib/customer-oauth.ts.normalizeProfile()`).
   - **Lookup-Reihenfolge:**
     a. `findFirst({ where: { oauthProvider, oauthId } })` —
        Provider-ID-Match (existierender OAuth-Login).
     b. Wenn nicht gefunden: `findUnique({ where: { email: lc(email) } })`
        — E-Mail-Match (case-insensitive).
        - **v1.5.1 Sicherheit (Fix BUG-IT5-004):** Wenn das gefundene
          Konto `emailVerified: false` hat → return-String
          `/konto/login?error=oauth_unverified_conflict` (KEINE
          automatische Verknüpfung). Siehe ARCHITECTURE.md §18.9.2.
        - Wenn `emailVerified: true` → `update` setzt
          `oauthProvider`, `oauthId`, `avatarUrl`. `passwordHash`
          bleibt **unangetastet** (Konto behält Pw + OAuth parallel).
     c. Wenn nicht gefunden: `create(...)` — neuer Account, mit
        `emailVerified: true`, `passwordHash: null`,
        `oauthProvider/oauthId/avatarUrl` aus Profile.
5. `jwt`-Callback schreibt `customerId` und `customerEmail` in den
   NextAuth-Session-Token (HMAC-signiert mit `AUTH_SECRET`).
6. `redirect`-Callback liefert
   `${baseUrl}/api/customer/oauth-finalize` zurück.
7. Browser folgt 302 zu `GET /api/customer/oauth-finalize`
   (siehe §21.2.1 unten):
   - Liest NextAuth-Session via `auth()`.
   - Setzt `customer-session`-Cookie (HttpOnly, Secure, SameSite=Lax,
     7 Tage) via `setCustomerSession(customerId, email)`.
   - 302 Redirect zu `/konto?oauth=success`.
8. Frontend (`/konto`) erkennt `?oauth=success`-Param und kann
   optional einen Erfolgs-Toast anzeigen.

**Fehler-Behandlung:**
- Provider-Fehler / Flow-Abbruch → Redirect zu
  `/konto/login?error=oauth_error`. Frontend zeigt deutsche Meldung
  „Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut."
- Wenn Provider keine E-Mail liefert (GitHub mit Privacy-Setting) →
  Redirect zu `/konto/login?error=oauth_no_email` mit Hinweis „Bitte
  E-Mail-Sichtbarkeit im Provider freigeben."
- Wenn lokales Konto mit gleicher E-Mail existiert und unverifiziert
  ist (v1.5.1) → Redirect zu
  `/konto/login?error=oauth_unverified_conflict` mit Hinweis „Bitte
  E-Mail bestätigen oder Passwort-Reset nutzen."
- Wenn `email` von einem **bestätigten anderen Account** mit anderer
  Provider-ID belegt ist (theoretisch unmöglich, da unsere Logik den
  E-Mail-Lookup zur Verknüpfung nutzt) → Redirect zu
  `/konto/login?error=oauth_email_conflict`.
- Wenn `oauth-finalize` ohne aktive NextAuth-Session aufgerufen wird
  → Redirect zu `/konto/login?error=oauth_finalize_failed`.

**Logout:** Bestehender `POST /api/customer/logout` löscht das
`customer-session`-Cookie. **v1.5.1:** Engineers ergänzen den Logout-
Handler um einen zusätzlichen `signOut({ basePath:
'/api/auth/customer', redirect: false })`-Call, damit die kurzlebige
NextAuth-Customer-Session ebenfalls invalidiert wird (alternativ:
Cookies `next-auth.session-token` mit Path `/api/auth/customer`
manuell löschen).

**Provider-Profile-Mapping:**

| Provider | E-Mail            | Vorname        | Nachname                        | Avatar       |
| -------- | ----------------- | -------------- | ------------------------------- | ------------ |
| Google   | `profile.email`   | `given_name`   | `family_name`                   | `picture`    |
| GitHub   | `profile.email`*  | split(`name`)[0] | split(`name`).slice(1).join(' ')| `avatar_url` |

*GitHub liefert `email` nur wenn der User eine öffentliche oder
verifizierte primäre E-Mail hat. Engineers müssen ggf. den `emails`-
Endpoint zusätzlich abfragen (`https://api.github.com/user/emails`)
und die `primary && verified` Adresse nehmen.

**Rate-Limiting:** keine eigenen Limits (NextAuth/Provider handhaben
das). Schutz gegen Bot-Abuse durch CAPTCHA ist Backlog.

---

### 21.2.1 OAuth-Finalize-Route (US-31, v1.5.1 Fix BUG-IT5-002)

#### `GET /api/customer/oauth-finalize`

**Auth:** öffentlich (liest die NextAuth-Customer-Session via
`auth()`-Helper aus `lib/customer-oauth.ts`).
**Story:** US-31, Architektur-Fix BUG-IT5-002.

Brücken-Endpoint zwischen NextAuth-OAuth-Callback und unserer
Custom-Auth-Schicht (`customer-session`-JWT-Cookie). Setzt nach
erfolgreichem OAuth-Flow das langlebige (7d) `customer-session`-
Cookie und leitet auf `/konto` weiter.

**Hintergrund:** NextAuth v5's `signIn`-Callback hat keinen
Response-Zugriff — wir können dort kein Set-Cookie an die Antwort
hängen, das auf einer DB-ermittelten CustomerId basiert. Lösung:
NextAuth schreibt die CustomerId in seinen eigenen Session-Token
(im `jwt`-Callback), redirectet zu dieser Finalize-Route, und die
Route liest die NextAuth-Session und setzt unser Custom-Cookie.

**Query-Parameter:**

| Name       | Pflicht | Validierung                                                                          |
| ---------- | ------- | ------------------------------------------------------------------------------------ |
| —          | —       | Keine. Alle Daten kommen aus der NextAuth-Customer-Session (HMAC-signiert).          |

**Verhalten:**

1. `auth()` aus `lib/customer-oauth.ts` aufrufen — liefert die
   NextAuth-Customer-Session mit `token.customerId` und
   `token.customerEmail` (vom `jwt`-Callback gesetzt).
2. Wenn keine Session oder `customerId` fehlt:
   - 302 Redirect zu
     `/konto/login?error=oauth_finalize_failed`.
3. Sonst:
   - Optional: CustomerUser via `prisma.customerUser.findUnique({
     where: { id: customerId } })` validieren (defense-in-depth —
     verhindert verwaiste Sessions, falls Konto inzwischen gelöscht
     wurde).
   - `setCustomerSession(response, customerId, email)` (Bestand IT4,
     `lib/customer-auth-server.ts`) → setzt
     `customer-session`-Cookie (HttpOnly, Secure in Prod,
     SameSite=Lax, 7 Tage TTL).
   - 302 Redirect zu `/konto?oauth=success`.

**Response 302** (immer Redirect, kein JSON-Body):

| Header           | Wert                                              |
| ---------------- | ------------------------------------------------- |
| `Location`       | `/konto?oauth=success` (Erfolg) oder `/konto/login?error=oauth_finalize_failed` |
| `Set-Cookie`     | `customer-session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800` (nur bei Erfolg) |
| `Cache-Control`  | `no-store`                                        |

**Beispiel-Flow:**

```
1. Browser: GET /api/auth/customer/callback/google?code=abc&state=xyz
   ← NextAuth-Handler verarbeitet OAuth-Response, setzt
     `next-auth.session-token` (60s)
   ← redirect-Callback returns "https://www.baerenstark-hausservice.app/api/customer/oauth-finalize"
   → 302 Location: /api/customer/oauth-finalize

2. Browser: GET /api/customer/oauth-finalize
   (mit Cookie next-auth.session-token=...)
   ← auth() decodiert Token, liefert { customerId: 'cuid123', email: 'user@example.com' }
   ← setCustomerSession() setzt customer-session-Cookie
   → 302 Location: /konto?oauth=success
   → Set-Cookie: customer-session=<7d-jwt>

3. Browser: GET /konto?oauth=success
   (mit Cookie customer-session=...)
   ← Page-Handler liest Cookie via getCustomerFromSession()
   → 200 Render Kundenkonto-Übersicht
```

**Fehler:**

| Status | Code                       | Wann?                                                                  |
| ------ | -------------------------- | ---------------------------------------------------------------------- |
| 302    | (Redirect mit Error-Param) | Keine NextAuth-Session vorhanden → `/konto/login?error=oauth_finalize_failed`. |
| 302    | (Redirect mit Error-Param) | CustomerUser nicht in DB (gelöscht zwischen jwt-Callback und Finalize) → `/konto/login?error=oauth_finalize_failed`. |

**Sicherheits-Eigenschaften:**

- Idempotent — mehrfacher Aufruf während gültiger NextAuth-Session
  setzt einfach erneut das Cookie. Kein One-Time-Token nötig, weil
  NextAuth-Session selbst HMAC-signiert ist.
- Kein User-kontrollierter Input wird vertraut — `customerId` kommt
  ausschließlich aus dem signierten NextAuth-Token.
- Open-Redirect-sicher — Ziel ist hardcoded `/konto?oauth=success`
  (keine `?next=`-Param-Verarbeitung).
- Kein Rate-Limit nötig (NextAuth-Auth + günstige Cookie-Set-
  Operation).

**Cache-Control:** `no-store` (jede Antwort ist user-spezifisch).

**Engineering-Hinweis:** Die NextAuth-Customer-Session-Cookie hat
einen kurzen `maxAge: 60` (Session-Konfiguration in
`lib/customer-oauth.ts`) — d.h. sie ist nur als Brücke zwischen
Provider-Callback und Finalize-Route gedacht. Nach 60s expired sie;
unser `customer-session`-Cookie ist dann die alleinige Authority.

---

### 21.3 Buchungs-Endpoint-Erweiterung (US-32 + US-33)

#### `POST /api/bookings` — Body-Erweiterung

**Auth:** öffentlich (mit optionalem Customer-Session-Cookie)
**Story:** US-04, US-32, US-33

Body **erweitert um:**

```json
{
  "date": "2026-05-15",
  "startTime": "09:00",
  "endTime": "13:00",
  "durationMinutes": 240,
  "customerName": "Maria Müller",
  "customerPhone": "0157-12345678",
  "customerEmail": "maria@example.com",
  "service": "entruempelung",
  "description": "Keller entrümpeln, ca. 30 m³",
  "addressStreet": "Musterstraße 12",
  "addressZip": "64283",
  "addressCity": "Darmstadt",
  "attachmentIds": ["clatt1..."],
  "privacyAccepted": true
}
```

**Neue Felder:**

| Feld              | Typ    | Pflicht | Validierung                                                                   |
| ----------------- | ------ | ------- | ----------------------------------------------------------------------------- |
| `durationMinutes` | number | ja*     | One of `[60, 120, 180, 240, 300, 360, 480]` ODER `-1` (Ganztag).              |
| `addressStreet`   | string | ja*     | 3–100 Zeichen, getrimmt.                                                      |
| `addressZip`      | string | ja*     | Genau 5 Ziffern.                                                              |
| `addressCity`     | string | ja*     | 2–100 Zeichen, getrimmt.                                                      |

*Pflicht im IT3/IT5-Modus (mit `date`/`startTime`); im Slot-Bestand-Modus
optional / ignoriert (Re-Booking-Flow).

**Server-Verhalten (IT5-Modus):**

1. Validierung wie IT3.
2. **Ganztag-Auflösung:** Wenn `durationMinutes === -1`:
   - `getAvailabilityForDate(date)` aufrufen.
   - Wenn Tag inaktiv → 409 `CONFLICT`.
   - `endTime` = `startTime` ist NICHT relevant — Backend setzt
     `startTime = template.startTime` und `endTime = template.endTime`
     (Termin reserviert das gesamte Verfügbarkeitsfenster).
   - `durationMinutes = endTimeMin - startTimeMin` wird persistiert.
3. **Standard-Dauer:** Wenn `durationMinutes ∈ [60..480]`:
   - Backend berechnet `endTime = startTime + durationMinutes`.
   - Wenn das vom Frontend mitgesendete `endTime` abweicht → BE
     überschreibt es (durationMinutes ist Authority).
   - Prüfen: `endTimeMin <= templateEndTimeMin` (Fenster reicht aus).
     Wenn nicht → 409 `CONFLICT` mit `field: 'durationMinutes'`,
     Message „Die gewählte Dauer passt nicht in den verfügbaren
     Zeitraum."
4. **Buffer-Berücksichtigung:** Bei Insert wird der `uniq_active_booking_per_timeslot`-
   Index gegen Doppelbuchung schützen. Buffer-Konflikte werden vom
   Slot-API (nicht vom Insert-Endpoint) gefiltert — wenn Frontend
   einen Buffer-konfliktbehafteten Slot trotzdem postet, ist das
   ein Bug auf FE-Seite, das BE würde dennoch akzeptieren.
   **Engineers-Hinweis:** ZUSÄTZLICH zur Index-Prüfung führt das BE
   einen expliziten Buffer-Check durch (siehe §21.5) und antwortet
   bei Verletzung mit 409 `CONFLICT`.
5. Persistenz inkl. Adresse + Dauer + (berechneter) `endTime`.

**Fehler:** unverändert (siehe §2), zusätzlich:
- 409 `CONFLICT` mit `field: 'durationMinutes'` — Dauer passt nicht.
- 409 `CONFLICT` mit Code-Hinweis „BUFFER_BLOCKED" in `message` —
  Buffer eines bestehenden CONFIRMED-Termins überlappt.

---

### 21.4 Slot-Verfügbarkeit (US-33 + US-34)

#### `GET /api/slots/available?date=YYYY-MM-DD&duration=NNN`

**Auth:** öffentlich
**Story:** US-17, US-33, US-34

**Query (erweitert):**

| Name       | Typ    | Pflicht | Validierung                                                                                |
| ---------- | ------ | ------- | ------------------------------------------------------------------------------------------ |
| `date`     | string | ja      | "YYYY-MM-DD".                                                                              |
| `duration` | number | nein    | One of `[60, 120, 180, 240, 300, 360, 480]` oder `-1` (Ganztag). Default = Template-Dauer. |

**Algorithmus (erweitert für US-33 + US-34):**

```ts
async function computeAvailableSlots(date: string, duration?: number):
  Promise<{ date, isDayActive, slots: AvailableTimeSlot[], overrideReason? }>
{
  // 1. Vergangenheit / inaktiver Tag → leer (wie IT3).
  // 2. Resolver liefert (startTime, endTime, slotDurationMinutes).
  // 3. Effektive Dauer:
  const effectiveDuration =
    duration === BOOKING_DURATION_ALL_DAY
      ? endMin - startMin               // Ganztag → gesamtes Fenster
      : duration ?? day.slotDurationMinutes;

  // 4. Slots im Fenster generieren — Schritt = Template-Slot-Dauer
  //    (z.B. 30 Min), Block-Größe = effectiveDuration:
  const blocks = [];
  let cur = startMin;
  while (cur + effectiveDuration <= endMin) {
    blocks.push({
      startTime: minutesToTime(cur),
      endTime: minutesToTime(cur + effectiveDuration),
    });
    cur += day.slotDurationMinutes;     // Schrittweite
  }

  // 5. Belegte Zeiträume aus aktiven Buchungen ermitteln:
  const activeBookings = await prisma.booking.findMany({
    where: { date, status: { in: ACTIVE_BOOKING_STATUSES } },
    select: { startTime: true, endTime: true, status: true },
  });

  // 6. US-34: Buffer aus BufferConfig laden (Singleton).
  const { bufferMinutes } = await getBufferConfig();

  // 7. Pro Block prüfen:
  //    - Überlappung mit aktiver Buchung [bookingStart, bookingEnd) → blocked.
  //    - Überlappung mit Buffer [bookingEnd, bookingEnd + bufferMinutes)
  //      EINER CONFIRMED-Buchung → blocked.
  for (const block of blocks) {
    const bStart = timeToMinutes(block.startTime);
    const bEnd   = timeToMinutes(block.endTime);

    let available = true;
    for (const b of activeBookings) {
      if (!b.startTime || !b.endTime) continue;
      const aStart = timeToMinutes(b.startTime);
      const aEnd   = timeToMinutes(b.endTime);

      // Buchungs-Overlap
      if (bStart < aEnd && bEnd > aStart) { available = false; break; }

      // Buffer-Overlap (nur nach CONFIRMED)
      if (b.status === 'CONFIRMED') {
        const bufferEnd = aEnd + bufferMinutes;
        if (bStart < bufferEnd && bEnd > aEnd) { available = false; break; }
      }
    }
    block.available = available;
  }

  return { date, isDayActive: true, slots: blocks };
}
```

**Wichtige Eigenschaften:**

- **Schrittweite (`cur += day.slotDurationMinutes`)** ist die Template-
  Standard-Dauer (typ. 30 oder 60 Min) — nicht die effektive Dauer.
  So sieht der Kunde Start-Optionen alle 30 Min, auch wenn er 4h
  buchen möchte (z.B. 08:00–12:00, 08:30–12:30, 09:00–13:00 …).
- **Buffer wirkt nur nach CONFIRMED.** PENDING und COUNTER_PROPOSED
  blockieren ihren eigenen Slot (Doppelbuchung), aber **keinen
  Buffer**, weil Tom den Termin noch nicht bestätigt hat.
- **Kein Buffer am Tag-Ende:** Wenn eine CONFIRMED-Buchung um
  16:30 endet und das Fenster um 17:00 schließt, wird der Buffer
  (z.B. 30 Min) nominell bis 17:00 reichen — es können ohnehin
  keine Slots mehr generiert werden (Block würde über 17:00
  hinausgehen). Kein Sonderfall nötig.

**Response (unverändert):** `AvailableSlotsResponseSchema`.

`Cache-Control: no-store`.

---

### 21.5 Buffer-Config-Verwaltung (US-34 Admin)

#### `GET /api/admin/buffer-config`

**Auth:** Admin
**Story:** US-34

Liefert den aktuellen Buffer-Wert. Seedet on-the-fly mit Default 30,
falls noch kein Datensatz existiert.

**Response 200** (`BufferConfigSchema`):

```json
{
  "data": {
    "bufferMinutes": 30,
    "updatedAt": "2026-05-02T13:42:00.000Z"
  }
}
```

`Cache-Control: no-store`.

**Fehler:**
- 401 `UNAUTHORIZED`.

---

#### `PUT /api/admin/buffer-config`

**Auth:** Admin
**Story:** US-34

Setzt einen neuen Buffer-Wert. Whitelist-validiert auf [0, 15, 30, 45, 60].

**Request Body** (`UpdateBufferConfigSchema`):

```json
{
  "bufferMinutes": 45
}
```

**Verhalten:**

1. Auth-Check (Admin-Session).
2. Whitelist prüfen.
3. Singleton via `prisma.bufferConfig.upsert(...)` aktualisieren
   (Engineering: feste ID `'global'` ODER ersten Datensatz updaten —
   beides ist akzeptabel; im Helper `getBufferConfig()` festlegen).
4. `revalidateTag('available-slots')` (damit Slot-API frische Werte
   liefert).
5. 200 OK mit aktualisiertem Wert.

**Response 200:** `BufferConfigSchema`.

**Fehler:**
- 400 `VALIDATION_ERROR` (Wert nicht in Whitelist).
- 401 `UNAUTHORIZED`.

---

### 21.6 Endpoint-zu-Story-Matrix (Iteration 5)

| Endpoint                                       | US-30 | US-31 | US-32 | US-33 | US-34 |
| ---------------------------------------------- | :---: | :---: | :---: | :---: | :---: |
| `POST /api/admin/forgot-password` (UX-Fix)     |   ✓   |       |       |       |       |
| `POST /api/admin/reset-password` (UX-Fix)      |   ✓   |       |       |       |       |
| `GET/POST /api/auth/customer/[...nextauth]`    |       |   ✓   |       |       |       |
| `GET /api/customer/oauth-finalize` (v1.5.1)    |       |   ✓   |       |       |       |
| `POST /api/bookings` (erweitert: Adresse+Dauer)|       |       |   ✓   |   ✓   |       |
| `GET /api/bookings` (Response erweitert)       |       |       |   ✓   |   ✓   |       |
| `GET /api/customer/bookings` (Response erweitert)|     |       |   ✓   |   ✓   |       |
| `GET /api/customer/bookings/:id` (Response erweitert)|  |       |   ✓   |   ✓   |       |
| `GET /api/admin/upcoming-bookings` (Response erweitert)| |       |   ✓   |   ✓   |       |
| `GET /api/slots/available?duration=...`        |       |       |       |   ✓   |   ✓   |
| `GET /api/admin/buffer-config`                 |       |       |       |       |   ✓   |
| `PUT /api/admin/buffer-config`                 |       |       |       |       |   ✓   |

---

### 21.7 Frontend-Aufrufer-Mapping (Iteration 5)

| Endpoint                                       | Aufgerufen von                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `POST /api/admin/forgot-password`              | `app/admin/passwort-vergessen/page.tsx` (Bestand, Verbesserungen UX)              |
| `POST /api/admin/reset-password`               | `app/admin/passwort-reset/page.tsx` (Bestand, Verbesserungen UX)                  |
| `signIn('google', ...)` / `signIn('github', ...)` | `app/konto/login/page.tsx` — neue OAuth-Buttons unter dem Pw-Formular            |
| `GET /api/customer/oauth-finalize` (v1.5.1)    | Nicht direkt aus FE — Browser-Redirect aus NextAuth-`redirect`-Callback nach OAuth. |
| `POST /api/bookings` (erweitert)               | `components/booking/BookingForm.tsx` (Adressfelder + Dauer-Picker neu)            |
| `GET /api/slots/available?duration=...`        | `components/booking/TimeSlotPicker.tsx` (umgebaut: ruft mit ausgewählter Dauer)   |
| `GET /api/admin/buffer-config`                 | `app/admin/availability/page.tsx` (Buffer-Section neu)                             |
| `PUT /api/admin/buffer-config`                 | `components/admin/BufferConfigForm.tsx` (NEU IT5)                                  |

---

### 21.8 ENV-Variablen (Iteration 5 ergänzt)

| Variable                | Pflicht                       | Wert / Beispiel             | Zweck                                                    |
| ----------------------- | ----------------------------- | --------------------------- | -------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`      | nur wenn Google-Login aktiv   | `<Google OAuth Client-ID>`  | NextAuth Google-Provider (US-31).                         |
| `GOOGLE_CLIENT_SECRET`  | nur wenn Google-Login aktiv   | `<Google OAuth Secret>`     | NextAuth Google-Provider (US-31).                         |
| `GITHUB_CLIENT_ID`      | nur wenn GitHub-Login aktiv   | `<GitHub OAuth App ID>`     | NextAuth GitHub-Provider (US-31).                         |
| `GITHUB_CLIENT_SECRET`  | nur wenn GitHub-Login aktiv   | `<GitHub OAuth Secret>`     | NextAuth GitHub-Provider (US-31).                         |
| `NEXTAUTH_URL`          | ja (bereits vorhanden)        | `https://www.baerenstark-hausservice.app` (Prod, v1.5.1) | Wird für Reset-Mail-Links + OAuth-Callback-URLs genutzt. |

**OAuth Callback-URLs (für Provider-Konfiguration, v1.5.1 aktualisiert):**

| Provider     | Callback-URL                                                                       |
| ------------ | ---------------------------------------------------------------------------------- |
| Google       | `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`        |
| GitHub       | `https://www.baerenstark-hausservice.app/api/auth/customer/callback/github`        |
| Google (Dev) | `http://localhost:3000/api/auth/customer/callback/google`                          |
| GitHub (Dev) | `http://localhost:3000/api/auth/customer/callback/github`                          |

Tom (Inhaber) muss die OAuth-Apps in den Developer-Konsolen anlegen
und die Callback-URLs eintragen, dann Client-ID + Secret an Engineers
für `.env.local` und Vercel-Environment liefern. **Hinweis v1.5.1:**
Die Produktions-URL hat sich von `baerenstark.vercel.app` auf
`www.baerenstark-hausservice.app` geändert — bestehende OAuth-Apps in
Google Cloud Console und GitHub Developer Settings müssen aktualisiert
werden, damit der OAuth-Flow nach dem Domain-Wechsel weiter
funktioniert.

---

### 21.9 Rate-Limits (Iteration 5 ergänzt)

| Endpoint                                  | Rate-Limit                                                |
| ----------------------------------------- | --------------------------------------------------------- |
| `GET/POST /api/auth/customer/[...nextauth]` | NextAuth-intern; kein eigenes Limit (Provider rate-limited). |
| `GET /api/customer/oauth-finalize` (v1.5.1) | Kein eigenes Limit (NextAuth-Session ist Authority + nur Cookie-Set). |
| `GET /api/admin/buffer-config`            | Kein Limit (Admin-only).                                   |
| `PUT /api/admin/buffer-config`            | 30 / 60 min / Admin-Session (Sanity-Cap gegen Tippfehler). |

---

## 22. Iteration 6 — Endpoints (US-IT6-01 bis US-IT6-09)

**Version:** 1.6.1 (Iteration 6 Design — QA-Revision 2026-05-03)

> **REVISED v1.6.1 — `ARCHITECTURE_IT6.md` Anhang B (§17) ist
> verbindlich.** Bei Konflikt zwischen einem Bestand-Abschnitt in §22
> und Anhang B gilt Anhang B. Betroffene Abschnitte sind oben in §22.1
> (Lock-out via `disableAdminSafely`), §22.3 (Public-Reviews-Schema-
> Bindung), §22.4 (DTO-Helper + Sort-Whitelist), §22.5
> (Cache-Invalidation + Review-Auto-Reject), §22.9 (neue ENV-Var
> `BOOTSTRAP_ADMIN_EMAIL`).

**Querschnitts-Convention:** Jeder Admin-Endpoint ruft als allerersten
Schritt `requireAdmin()` (siehe `ARCHITECTURE_IT6.md` §12). Der Helper
prüft Session UND `User.status === 'ACTIVE'`. Disabled-Admins erhalten
403 `FORBIDDEN`.

**Neue Fehlercodes IT6:**
- `ACCOUNT_DISABLED` (422, Subtyp von `FORBIDDEN`) — Login mit deaktiviertem Admin-Konto. Frontend zeigt Hinweis-Banner auf der Login-Page.
- `LAST_ADMIN_LOCK` (409, Subtyp von `CONFLICT`) — Versuch, den letzten aktiven Admin zu deaktivieren/löschen.
- `SELF_MUTATION_FORBIDDEN` (409) — eingeloggter Admin will sich selbst deaktivieren oder löschen.
- `BOOKING_NOT_COMPLETED` (409, Subtyp von `CONFLICT`) — Review für nicht-COMPLETED-Buchung.
- `REVIEW_EXISTS` (409) — Review für die Buchung existiert bereits (auch wenn rejected).
- `WIPE_NOT_ALLOWED` (— nur Skript) — `ALLOW_USER_WIPE`-ENV fehlt.
- `BOOTSTRAP_NOT_ALLOWED` (403, NEU v1.6.1, F1) — `POST /api/admin/setup`-Email matched nicht `BOOTSTRAP_ADMIN_EMAIL`.
- `SETUP_NOT_CONFIGURED` (503, NEU v1.6.1, F1) — `POST /api/admin/setup` aufgerufen, aber `BOOTSTRAP_ADMIN_EMAIL` ist nicht gesetzt.

---

### 22.1 Multi-Admin (US-IT6-01)

#### `GET /api/admin/admins`

**Auth:** Admin (`requireAdmin()`)
**Story:** US-IT6-01 AC1

Liste aller Admins (auch DISABLED). Sortierung: `createdAt asc`.

**Response 200:**

```json
{
  "data": [
    {
      "id": "u_abc",
      "name": "Tom Siefert",
      "email": "tom@baerenstark-hausservice.de",
      "status": "ACTIVE",
      "createdAt": "2026-04-01T08:00:00.000Z",
      "lastLoginAt": "2026-05-03T07:14:00.000Z",
      "createdById": null
    },
    {
      "id": "u_xyz",
      "name": "Lisa Aushilfe",
      "email": "lisa@example.de",
      "status": "ACTIVE",
      "createdAt": "2026-05-03T09:00:00.000Z",
      "lastLoginAt": null,
      "createdById": "u_abc"
    }
  ],
  "total": 2
}
```

Schema: Array von `AdminListItemSchema` (siehe `contracts/zod-schemas.ts` §16).

---

#### `POST /api/admin/admins`

**Auth:** Admin
**Story:** US-IT6-01 AC2

Legt einen neuen Admin an.

**Request Body** (`CreateAdminSchema`):

```json
{
  "name": "Lisa Aushilfe",
  "email": "lisa@example.de",
  "password": "Sehr-Sicher-2026!"
}
```

| Feld     | Validierung                                                                        |
| -------- | ----------------------------------------------------------------------------------- |
| name     | trim, 2–120 Zeichen.                                                                |
| email    | lowercased, gültige Adresse, UNIQUE in `users.email`. Bei Konflikt 409 `EMAIL_TAKEN`. |
| password | mind. 12 Zeichen; ein Großbuchstabe + ein Kleinbuchstabe + eine Ziffer (Regex).     |

**Verhalten:**
1. `requireAdmin()` → wirft 401/403.
2. Email-Lookup; falls existiert → 409.
3. `bcrypt.hash(password, 10)`.
4. `prisma.user.create({ data: { ..., createdById: me.id, status: 'ACTIVE' } })`.

**Response 201:** `AdminListItemSchema` (ohne `password`).

**Fehler:** 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 409 `CONFLICT` (mit `field: 'email'`).

---

#### `PATCH /api/admin/admins/:id`

**Auth:** Admin
**Story:** US-IT6-01 AC3, AC4, AC6

Edit Name, Email oder Status.

**Request Body** (`UpdateAdminSchema`, alle Felder optional, mind. eines):

```json
{
  "name": "Lisa Aushilfe (Senior)",
  "email": "lisa.neu@example.de",
  "status": "DISABLED"
}
```

**Lock-out-Schutz (REVISED v1.6.1 — F2, siehe `ARCHITECTURE_IT6.md`
Anhang B §17.2):**
- Wenn `status === 'DISABLED'` und `:id === me.id` → 409 `SELF_MUTATION_FORBIDDEN`.
- Wenn `status === 'DISABLED'`: der Status-Wechsel erfolgt
  **atomar** über den Helper `disableAdminSafely(targetId)`
  (`src/lib/admin-status.ts`). Der Helper führt einen einzigen
  Conditional UPDATE aus:
  ```sql
  UPDATE users
  SET status = 'DISABLED'
  WHERE id = :targetId
    AND status = 'ACTIVE'
    AND EXISTS (
      SELECT 1 FROM users u2
      WHERE u2.id <> :targetId AND u2.status = 'ACTIVE'
    );
  ```
  Bei `affectedRows === 0` differenziert der Handler via Read:
  Target schon DISABLED → idempotente 200; sonst → 409 `LAST_ADMIN_LOCK`.
  Damit ist die Letzter-Admin-Race (TOCTOU zwischen `count()` und
  `update()`) konstruktionsbedingt ausgeschlossen.
- Email-Konflikt: 409 `CONFLICT` (field='email').

**Response 200:** `AdminListItemSchema`.

**Fehler:** 400, 401, 403, 404, 409.

---

#### `DELETE /api/admin/admins/:id`

**Auth:** Admin
**Story:** US-IT6-01 AC3, AC7

**Verhalten:** Soft-Delete via `status: 'DISABLED'` (echtes DELETE würde `Review.moderatedById`-FK brechen). Identisch zur PATCH-Variante mit `{ status: 'DISABLED' }`. Im Frontend als „Löschen"-Button beschriftet, weil Tom semantisch das meint.

**Lock-out-Schutz (REVISED v1.6.1):** wie PATCH — nutzt denselben
`disableAdminSafely()`-Helper. `SELF_MUTATION_FORBIDDEN` und
`LAST_ADMIN_LOCK` sind die einzigen 409-Subcodes.

**Response 204:** kein Body.

**Fehler:** 401, 403, 404, 409.

---

### 22.2 Kalender-UX (US-IT6-02)

#### `GET /api/admin/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD`

**Auth:** Admin
**Story:** US-IT6-02

Aggregator-Endpoint: liefert in einem Roundtrip alle Daten, die der
FullCalendar-Admin-View braucht — Buchungen, Verfügbarkeitsfenster
(Template + Override), Buffer-Blöcke. Reduziert Wasserfall.

**Query-Parameter:**

| Name | Pflicht | Format | Range                                          |
| ---- | ------- | ------ | ---------------------------------------------- |
| from | ja      | `YYYY-MM-DD` | inklusiv. Max 90 Tage Range (`to - from <= 90`). |
| to   | ja      | `YYYY-MM-DD` | inklusiv.                                       |

**Response 200:**

```json
{
  "data": {
    "events": [
      {
        "id": "bk_abc",
        "type": "BOOKING",
        "title": "Maria Müller — Entrümpelung",
        "start": "2026-05-15T09:00:00+02:00",
        "end":   "2026-05-15T13:00:00+02:00",
        "status": "CONFIRMED",
        "color":  "#22c55e",
        "url":    "/admin/bookings/bk_abc"
      },
      {
        "id": "buf_bk_abc",
        "type": "BUFFER",
        "title": "Pufferzeit",
        "start": "2026-05-15T13:00:00+02:00",
        "end":   "2026-05-15T13:30:00+02:00",
        "color": "#9ca3af"
      },
      {
        "id": "avail_2026-05-15",
        "type": "AVAILABILITY",
        "title": "Verfügbar",
        "start": "2026-05-15T08:00:00+02:00",
        "end":   "2026-05-15T17:00:00+02:00",
        "display": "background"
      }
    ]
  }
}
```

**Verhalten:**
- Buchungen: alle aktiven Stati (`PENDING`, `CONFIRMED`, `COUNTER_PROPOSED`, `COMPLETED`) im Range.
- Verfügbarkeit: kombiniert `AvailabilityTemplate[dayOfWeek]` + `DayOverride[date]` per `lib/availability.ts.resolveDay(date)`.
- Buffer-Blöcke: für jede CONFIRMED-Buchung im Range mit `BufferConfig.bufferMinutes`-Suffix.
- ISO-8601 mit Berlin-Offset (Sommer/Winter berücksichtigt).
- Cache: keiner (Daten ändern sich häufig).

**Fehler:** 400 `VALIDATION_ERROR` (`from`/`to`-Range), 401, 403.

---

#### `GET /api/availability/calendar?from=&to=&serviceId=`

**Auth:** öffentlich
**Story:** US-IT6-02 (Kunden-Monatsansicht)

Pro Tag im Range den Status. Wird vom Kunden-`<BookingCalendar>` für
die Monatsansicht verwendet.

**Query-Parameter:**

| Name      | Pflicht | Anmerkung |
| --------- | ------- | --------- |
| from      | ja      | `YYYY-MM-DD`, inklusiv. Max 62 Tage Range. |
| to        | ja      | `YYYY-MM-DD`, inklusiv.                    |
| serviceId | nein    | Reserviert für IT7 (Service-spezifische Verfügbarkeit). MVP ignoriert ihn. |

**Response 200:**

```json
{
  "data": {
    "days": [
      { "date": "2026-05-15", "status": "available" },
      { "date": "2026-05-16", "status": "partial"   },
      { "date": "2026-05-17", "status": "unavailable" }
    ]
  }
}
```

`status`-Mapping:
- `available` — irgend ein Slot im Tag noch buchbar.
- `partial` — Tag aktiv, aber alle Slots durch Buchungen+Buffer belegt für Default-Dauer.
- `unavailable` — Tag inaktiv (Template `isActive=false` oder DayOverride `isActive=false`).

**Cache:** `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`.

**Fehler:** 400 (Range > 62 Tage).

---

### 22.3 Reviews IT6-Verschärfung (US-IT6-03)

#### `POST /api/customer/reviews` — verschärft

**Auth:** Customer-Session
**Story:** US-IT6-03 AC1, AC2, AC3, AC7

**Body:** unverändert (`CreateReviewSchema`).

**Geänderte Vorbedingung:** `booking.status === 'COMPLETED'` (vorher
laut IT4-Spec evtl. CONFIRMED — siehe Story-Notes). Bei
`status !== 'COMPLETED'` → 409 `BOOKING_NOT_COMPLETED`.

**Idempotenz / Spam-Schutz:** wenn `booking.review` existiert (egal
ob PENDING/APPROVED/REJECTED), → 409 `REVIEW_EXISTS`.

**Response 201:** `ReviewSchema`.

---

#### `PATCH /api/admin/reviews/:id` — Erweiterung

**Auth:** Admin
**Story:** US-IT6-03 AC4, AC5

**Body** (unverändert: `ApproveReviewSchema`):

```json
{ "approved": true }
```

**Verhalten:**
- `approved: true` → setzt `approved=true`, `rejectedAt=null`, `moderatedAt=now()`, `moderatedById=me.id`.
- `approved: false` → setzt `approved=false`, `rejectedAt=now()`, `moderatedAt=now()`, `moderatedById=me.id`.

**Response 200:** erweitertes `ReviewSchema` mit `rejectedAt`, `moderatedAt`, `moderatedById`.

---

#### `GET /api/reviews` — verschärft

**Auth:** öffentlich
**Story:** US-IT6-03 AC6

**Filter (verbindlich):** `WHERE approved = true AND rejectedAt IS NULL`.
Defense-in-Depth: zweite Bedingung verhindert Bug-Klasse, in der
`approved` versehentlich nicht zurückgesetzt wird.

**Output-Schema (REVISED v1.6.1 — m1, siehe `ARCHITECTURE_IT6.md`
Anhang B §17.5):** Response-Body wird **ausschließlich** gegen
`PublicReviewSchema.strict()` (siehe `contracts/zod-schemas.ts`)
serialisiert.

Whitelist-Felder im Output (verbindlich):
- `id`
- `customerName` (Format `"Vorname N."` — Backend kürzt `lastName`
  auf den ersten Buchstaben + Punkt; Fallback `"Anonym"` bei
  `customerId === null`)
- `service`
- `stars`
- `text`
- `createdAt`

**Verboten im Output:** `customerId`, `bookingId`, `userId`,
`moderatedById`, `rejectedAt`, `moderatedAt`, vollständiger Nachname,
Email, Telefonnummer, OAuth-Provider, Avatar.

**Cache-Tag (m5/m7):** Antwort wird mit
`unstable_cache([...], { tags: ['public-reviews'], revalidate: 60 })`
gewrapped. Tag-Invalidation erfolgt im PATCH-Pfad von
`/api/admin/reviews/:id` (Approve/Reject) und beim Auto-Reject im
PATCH `/api/admin/bookings/:id` (Status-Rollback aus COMPLETED, siehe
§17.11).

---

#### `GET /api/admin/reviews?status=`

**Auth:** Admin
**Story:** US-IT6-03 AC4

**Query (NEU):**

| Name   | Werte                                              |
| ------ | -------------------------------------------------- |
| status | `PENDING_APPROVAL` \| `APPROVED` \| `REJECTED` \| (omit für alle) |

**Mapping:**
- `PENDING_APPROVAL`: `approved=false AND rejectedAt IS NULL`
- `APPROVED`: `approved=true`
- `REJECTED`: `approved=false AND rejectedAt IS NOT NULL`

---

### 22.4 Admin-Userverwaltung (US-IT6-07)

> **REVISED v1.6.1 (F3 + m2, siehe `ARCHITECTURE_IT6.md` Anhang B §17.3
> + §17.6).** Alle Endpoints unter `/api/admin/users*` MÜSSEN
> Prisma-Selects ausschließlich über den Helper
> `selectCustomerUserAdmin()` (`src/lib/dto/user.ts`) bauen. Direktes
> `prisma.customerUser.find*()` ohne Helper ist verboten — der
> CI-Architektur-Test (siehe Anhang B §17.3.4) blockt PRs, die das
> umgehen. Die korrespondierenden Customer-Endpoints unter
> `/api/customer/*` nutzen `selectCustomerUserPublic()` und parsen den
> Output durch `CustomerUserPublicSchema.strict()`.
>
> **Sort-Whitelist (m2):** Der `sort`-Param ist auf
> `lastName_asc | createdAt_desc | bookingCount_desc | adminRating_desc`
> beschränkt (Zod-Enum). Für Customer-API ist `sort` **vollständig
> verboten** — kein Customer-Endpoint nimmt den Param entgegen.

#### `GET /api/admin/users`

**Auth:** Admin
**Story:** US-IT6-07 AC1, AC8

**Query:**

| Name      | Default | Anmerkung                                                |
| --------- | ------- | -------------------------------------------------------- |
| q         | —       | Freitext, mind. 2 Zeichen, sucht in `firstName`+`lastName`+`email` (case-insensitive). |
| page      | `1`     | 1-basiert.                                               |
| pageSize  | `25`    | max 100.                                                 |
| sort      | `lastName_asc` | enum: `lastName_asc`, `createdAt_desc`, `bookingCount_desc`, `adminRating_desc`. |

**Response 200:**

```json
{
  "data": [
    {
      "id": "cu_abc",
      "email": "maria@example.de",
      "firstName": "Maria",
      "lastName": "Müller",
      "phone": "0157-12345678",
      "emailVerified": true,
      "oauthProvider": "google",
      "avatarUrl": "https://...",
      "adminNote": "VIP — pünktliche Zahlung",
      "adminRating": 5,
      "bookingCount": 7,
      "createdAt": "2026-03-12T10:30:00.000Z"
    }
  ],
  "total": 142,
  "page": 1,
  "pageSize": 25
}
```

Schema: `CustomerUserAdminSchema[]` (siehe `contracts/zod-schemas.ts` §16).

---

#### `GET /api/admin/users/:id`

**Auth:** Admin
**Story:** US-IT6-07 AC2

**Response 200:** `CustomerUserAdminSchema` + `bookings: CustomerBookingSchema[]` (alle Buchungen des Kunden, sortiert nach `date desc`).

---

#### `PATCH /api/admin/users/:id`

**Auth:** Admin
**Story:** US-IT6-07 AC3, AC7

**Body** (`UpdateCustomerUserAdminSchema`, alle optional, mind. eines):

```json
{
  "firstName": "Maria",
  "lastName":  "Müller-Schmidt",
  "phone":     "0157-99999999",
  "adminNote": "VIP",
  "adminRating": 5
}
```

| Feld         | Validierung                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| firstName    | trim, 1–120.                                                                  |
| lastName     | trim, 1–120.                                                                  |
| phone        | bestehendes `phoneSchema` (nullable).                                         |
| adminNote    | trim, max 1000 Zeichen, oder `null` zum Löschen.                              |
| adminRating  | int 1..5, oder `null` zum Löschen.                                            |

**Wichtig:** `email`-Änderung ist **nicht** zulässig (Engineering-
Konvention; siehe BUG-402 in IT4 — auch im Admin-Pfad gilt das, weil
sonst OAuth-Konsistenz bricht). Versuche ergeben 400 `VALIDATION_ERROR`.

**Response 200:** `CustomerUserAdminSchema`.

---

#### `DELETE /api/admin/users/:id`

**Auth:** Admin
**Story:** US-IT6-07 AC6

**Verhalten:**
1. `prisma.customerUser.delete({ where: { id } })`.
2. ON DELETE SET NULL auf `Booking.customerId` macht Anonymisierung automatisch.
3. Reviews mit `customerId === id` bekommen `customerId = null` (siehe IT4 onDelete-Verhalten).

**Response 204.**

**Fehler:** 401, 403, 404.

---

### 22.5 Finaler Preis pro Buchung (US-IT6-08)

#### `PATCH /api/admin/bookings/:id` — Erweiterung

**Auth:** Admin
**Story:** US-IT6-08 AC1, AC2, AC3

> **Hinweis:** in IT1–IT5 lief der Status-Update über `PATCH /api/bookings/:id` (Admin-only). In IT6 wird der Update-Endpoint **konsolidiert** unter `/api/admin/bookings/:id`, damit alle Admin-Mutations konsistent unter `/api/admin/*` liegen. Der alte `PATCH /api/bookings/:id` bleibt als Alias und delegiert.

**Body** (`AdminBookingPatchSchema`, alle optional):

```json
{
  "status": "COMPLETED",
  "finalPriceEur": "185.00",
  "finalPriceNote": "inkl. Anfahrt"
}
```

| Feld           | Validierung                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| status         | Enum (siehe State-Machine-Spec IT4).                                                                                        |
| finalPriceEur  | string oder number; nach Komma→Punkt-Normalisierung muss `0 <= x <= 100000` gelten. `null` = entfernen. Validation message: "Bitte einen gültigen Betrag in Euro eingeben (0–100.000)." |
| finalPriceNote | trim, max 200 Zeichen. `null` = entfernen.                                                                                  |

**Sichtbarkeit:** `finalPriceEur` und `finalPriceNote` erscheinen in `BookingAdminSchema`, `UpcomingBookingSchema` (NEU für Spalte/Badge in der Liste). NICHT in `CustomerBookingSchema`.

**Response 200:** `BookingAdminSchema` (erweitert).

**Cache-Invalidation (REVISED v1.6.1 — m5, siehe `ARCHITECTURE_IT6.md`
Anhang B §17.9):** Im Erfolgs-Pfad ruft der Handler `revalidateTag('analytics')`
auf, wenn

- `finalPriceEur` im Body gesetzt ist (auch bei `null` zum Löschen), ODER
- der Status zu/von `COMPLETED` wechselt.

Damit reflektiert `/admin/analytics` (sowie `GET /api/admin/analytics`)
sofort den neuen Wert (Latenz < 2 s).

**Side-Effect: Review-Auto-Reject (REVISED v1.6.1 — m7, siehe Anhang B
§17.11):** Wenn die Buchung eine Review hat (`booking.review != null`)
und der Status aus `COMPLETED` zurückläuft (typischerweise `CANCELLED`),
setzt der Handler in derselben Transaktion automatisch:

- `review.approved = false`
- `review.rejectedAt = now()`
- `review.moderatedAt = now()`
- `review.moderatedById = me.id`

Anschließend `revalidateTag('public-reviews')`. Damit verschwindet die
Review aus `GET /api/reviews` (siehe §22.3-Filter).

---

### 22.6 Analytics (US-IT6-09)

#### `GET /api/admin/analytics?range=`

**Auth:** Admin
**Story:** US-IT6-09 AC1, AC2, AC7

**Query:**

| Name  | Werte                                | Default |
| ----- | ------------------------------------ | ------- |
| range | `30d` \| `90d` \| `12m` \| `ytd` \| `custom` | `12m`   |
| from  | `YYYY-MM-DD` (nur bei `custom`)      | —       |
| to    | `YYYY-MM-DD` (nur bei `custom`)      | —       |

**Response 200:**

```json
{
  "data": {
    "range": { "from": "2025-05-01", "to": "2026-05-03" },
    "kpis": {
      "totalRevenueEur": "12450.00",
      "completedBookings": 87,
      "averageOrderValueEur": "143.10",
      "bookingsThisMonth": 12
    },
    "revenueByMonth": [
      { "month": "2025-06", "totalEur": "1200.00", "count": 8 },
      { "month": "2025-07", "totalEur": "1450.00", "count": 9 }
    ],
    "bookingsByService": [
      { "service": "entruempelung", "count": 31 },
      { "service": "reinigung",     "count": 24 }
    ],
    "topCustomers": [
      {
        "customerId": "cu_abc",
        "customerName": "Maria M.",
        "totalEur": "1340.00",
        "bookingCount": 6
      }
    ]
  }
}
```

**Empty-State:** wenn alle Aggregationen 0/null sind, `kpis` enthält `null`-Werte für `totalRevenueEur`/`averageOrderValueEur`. Frontend zeigt Banner "Noch keine Umsatzdaten".

**Fehler:** 400 `VALIDATION_ERROR` (Custom-Range-Validation), 401, 403.

**Cache:** `Cache-Control: private, max-age=300` + Server-side ISR (Page-Komponente, siehe ARCHITECTURE_IT6.md §11.1).

---

### 22.7 Endpoint-zu-Story-Matrix (Iteration 6)

| Endpoint                                            | Story        | Methode  |
| --------------------------------------------------- | ------------ | -------- |
| `/api/admin/admins`                                  | US-IT6-01    | GET      |
| `/api/admin/admins`                                  | US-IT6-01    | POST     |
| `/api/admin/admins/:id`                              | US-IT6-01    | PATCH    |
| `/api/admin/admins/:id`                              | US-IT6-01    | DELETE   |
| `/api/admin/calendar/events`                         | US-IT6-02    | GET      |
| `/api/availability/calendar`                         | US-IT6-02    | GET      |
| `/api/customer/reviews` (Vorbedingung verschärft)    | US-IT6-03    | POST     |
| `/api/admin/reviews?status=`                         | US-IT6-03    | GET      |
| `/api/admin/reviews/:id` (Reject-Spur)               | US-IT6-03    | PATCH    |
| `/api/reviews` (Filter verschärft)                   | US-IT6-03    | GET      |
| `/sitemap.xml` (Next.js-Route)                       | US-IT6-04    | GET      |
| `/robots.txt` (Next.js-Route)                        | US-IT6-04    | GET      |
| `/api/auth/customer/[...nextauth]` (Provider-Wechsel)| US-IT6-05    | GET/POST |
| `/api/customer/login` (404 nach IT6)                 | US-IT6-05    | —        |
| `/api/customer/register` (404 nach IT6)              | US-IT6-05    | —        |
| `/api/customer/forgot-password` (404)                | US-IT6-05    | —        |
| `/api/customer/reset-password` (404)                 | US-IT6-05    | —        |
| `/api/customer/resend-verification` (404)            | US-IT6-05    | —        |
| `/api/customer/verify` (404)                         | US-IT6-05    | —        |
| `scripts/reset-users.ts` (kein HTTP-Endpoint)        | US-IT6-06    | tsx      |
| `/api/admin/users`                                   | US-IT6-07    | GET      |
| `/api/admin/users/:id`                               | US-IT6-07    | GET      |
| `/api/admin/users/:id`                               | US-IT6-07    | PATCH    |
| `/api/admin/users/:id`                               | US-IT6-07    | DELETE   |
| `/api/admin/bookings/:id` (Erweiterung)              | US-IT6-08    | PATCH    |
| `/api/admin/analytics`                               | US-IT6-09    | GET      |

---

### 22.8 Frontend-Aufrufer-Mapping (Iteration 6)

| Page                          | Endpoints                                                            |
| ----------------------------- | -------------------------------------------------------------------- |
| `/admin/admins`               | GET/POST/PATCH/DELETE `/api/admin/admins(/:id)`                      |
| `/admin/kalender`             | GET `/api/admin/calendar/events?from=&to=`                          |
| `/admin/users`                | GET `/api/admin/users?q=&page=&sort=`                                |
| `/admin/users/:id` (Drawer)   | GET/PATCH/DELETE `/api/admin/users/:id`                              |
| `/admin/bookings/:id`         | PATCH `/api/admin/bookings/:id` (mit `finalPriceEur`/`finalPriceNote`) |
| `/admin/reviews`              | GET `/api/admin/reviews?status=` + PATCH `/api/admin/reviews/:id`    |
| `/admin/analytics`            | direktes Server-Component-Loading via `lib/analytics.ts` (kein API-Roundtrip) — optional `GET /api/admin/analytics` für Future-Use. |
| `/buchung`                    | GET `/api/availability/calendar?from=&to=`                          |
| `/konto/login`                | NextAuth-OAuth-Buttons (Google + Facebook)                           |
| `/` (Landingpage)             | GET `/api/reviews?limit=6&minStars=4` (Bestand)                      |
| `/services/:slug`             | statisch ISR — kein API-Call                                          |

---

### 22.9 ENV-Variablen (Iteration 6 ergänzt)

| Variable            | Pflicht | Beschreibung                                                                                |
| ------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `FACEBOOK_CLIENT_ID`     | wenn FB OAuth aktiv | Meta Developer Portal → App-Settings → App ID.                                  |
| `FACEBOOK_CLIENT_SECRET` | wenn FB OAuth aktiv | Meta Developer Portal → App-Settings → App Secret.                              |
| `GITHUB_CLIENT_ID`       | **entfernt**       | GitHub-Provider raus. Variablen können in `.env` belassen bleiben (ignored).    |
| `GITHUB_CLIENT_SECRET`   | **entfernt**       | s.o.                                                                              |
| `ALLOW_USER_WIPE`        | nur für Wipe-Skript | `true`, sonst lehnt `scripts/reset-users.ts` ab.                                  |
| `NEXTAUTH_URL`           | ja                 | Muss exakt der Produktions-Domain entsprechen (kein Trailing-Slash). Siehe ARCHITECTURE_IT6.md §7.5. |
| `BOOTSTRAP_ADMIN_EMAIL`  | nur Bootstrap-Fenster (NEU v1.6.1, F1) | Allowlist-Email für `POST /api/admin/setup`. **MUSS** vor dem Wipe gesetzt sein, sonst blockiert Setup mit 503 `SETUP_NOT_CONFIGURED`. Wird vom Endpoint **nur** ausgewertet, solange `users` leer ist (siehe ARCHITECTURE_IT6.md Anhang B §17.1). Empfohlen: nach erfolgreichem Bootstrap aus Hosting-Env entfernen. |

---

### 22.10 Rate-Limits (Iteration 6 ergänzt)

| Endpoint                              | Rate-Limit                                                              |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `POST /api/admin/admins`              | 10 / Stunde / Admin-Session.                                            |
| `PATCH /api/admin/admins/:id`         | 30 / Stunde / Admin-Session.                                            |
| `DELETE /api/admin/admins/:id`        | 10 / Stunde / Admin-Session.                                            |
| `PATCH /api/admin/users/:id`          | 60 / Stunde / Admin-Session (Tom darf Notizen flüssig pflegen).         |
| `DELETE /api/admin/users/:id`         | 30 / Stunde / Admin-Session.                                            |
| `GET /api/admin/calendar/events`      | 120 / Minute / Admin-Session (Kalender-Polling).                        |
| `GET /api/availability/calendar`      | 60 / Minute / IP (öffentlich, gecached).                                |
| `GET /api/admin/analytics`            | 30 / Minute / Admin-Session.                                            |
| `POST /api/customer/reviews`          | 5 / Stunde / Customer-Session (Spam-Schutz).                            |

---

## 23. Iteration 7 — Auth-Stabilisierung & Email-Auth-Reversion (US-IT7-01 bis US-IT7-05)

> **Quelle der Wahrheit:** `ARCHITECTURE_IT7.md`. Dieses Kapitel listet die
> verbindlichen HTTP-Verträge. F1/F2/F3 aus IT6 §17 bleiben unangetastet —
> `/api/admin/setup` antwortet weiter mit 410 GONE, sobald `count(users) >= 1`.
>
> **Reversion:** Die in IT6 (D3-Fix) gelöschten Customer-Auth-Endpoints
> werden vollständig wieder implementiert (kein 404, kein 410 mehr).
> NextAuth v5 bekommt zusätzlich zum Google- und Facebook-Provider einen
> `Credentials`-Provider für Customer-Email/Password-Login.

### 23.1 Diagnose-Endpoint (Dev-only, US-IT7-02 + US-IT7-03)

#### `GET /api/auth/diagnose`

- **Story:** US-IT7-02, US-IT7-03 (Self-Service-Diagnose).
- **Auth:** keine. Antwortet **nur**, wenn `NODE_ENV !== 'production'`.
  In Prod liefert er 404 (Next.js `notFound()`).
- **Response 200 (Dev):**
  ```json
  {
    "env": {
      "NODE_ENV": "development",
      "NEXTAUTH_URL": "http://localhost:3000",
      "AUTH_SECRET_set": true,
      "NEXTAUTH_SECRET_set": true,
      "AUTH_TRUST_HOST": "true",
      "GOOGLE_CLIENT_ID_set": true,
      "GOOGLE_CLIENT_SECRET_set": true,
      "FACEBOOK_CLIENT_ID_set": false,
      "FACEBOOK_CLIENT_SECRET_set": false,
      "FEATURE_OAUTH_LOGIN": null,
      "RESEND_API_KEY_set": true
    },
    "providersActive": {
      "google": true,
      "facebook": false,
      "credentialsCustomer": true,
      "credentialsAdmin": true
    },
    "expectedCallbacks": {
      "admin":    "http://localhost:3000/api/auth/callback/credentials",
      "googleC":  "http://localhost:3000/api/auth/customer/callback/google",
      "facebook": "http://localhost:3000/api/auth/customer/callback/facebook"
    },
    "notes": ["…"]
  }
  ```
- **Sicherheit:** Endpoint gibt **niemals** Secrets im Klartext zurück —
  ausschließlich Bool-Flags (Var ist gesetzt / nicht gesetzt). In Prod
  ist er nicht erreichbar (404).
- **Story-Verknüpfung:** liefert Tom Self-Service-Sicht, ohne dass er
  in den Code schauen muss.

### 23.2 Customer-Email-Auth (US-IT7-01)

Alle nachfolgenden Endpoints sind **Reaktivierungen** der in IT6 D3
gelöschten Routes. Schemas existieren bereits in `contracts/zod-schemas.ts`
(IT4/§11) und werden **unverändert** wiederverwendet.

#### `POST /api/customer/register`

- **Story:** US-IT7-01.
- **Body:** `CustomerRegisterSchema` — `{ email, password, firstName, lastName, phone?, privacyAccepted: true }`.
- **Auth:** keine.
- **Response 201:** `{ data: CustomerUserPublicSchema }` (kein `passwordHash`,
  kein `verificationToken`, kein `adminNote`/`adminRating` — DTO-Helper
  `selectCustomerUserPublic()` strukturell garantiert).
- **Errors:**
  - 400 `VALIDATION_ERROR` — Zod-Fehler.
  - 409 `EMAIL_ALREADY_REGISTERED` — case-insensitive Email-Dupe.
  - 429 `RATE_LIMITED`.
- **Side-effects:**
  - bcrypt-Hash (cost 12) auf `passwordHash`.
  - `verificationToken` als 32-Byte-`crypto.randomBytes` Base64url.
  - `verificationTokenExpiry = now + 24h`.
  - Resend-Mail an `email` mit Verify-Link
    `${NEXTAUTH_URL}/konto/verifizieren?token=…`.
  - Mail-Versand-Fehler → 201 trotzdem, aber `mailError` im Server-Log
    (User kann später `resend-verification` aufrufen).
- **Rate-Limit:** 5 / Stunde / IP, 3 / Stunde / Email.

#### `POST /api/customer/login`

- **Story:** US-IT7-01.
- **Body:** `CustomerLoginSchema` — `{ email, password, redirectUrl? }`.
- **Auth:** keine.
- **Response 200:** `{ data: CustomerLoginResponseSchema }` (= `CustomerUserPublicSchema` + `redirectUrl`).
  Cookie `customer-session` wird gesetzt.
- **Errors:**
  - 400 `VALIDATION_ERROR`.
  - 401 `INVALID_CREDENTIALS` — Meldung „E-Mail oder Passwort ungültig"
    (kein Hint, welches Feld falsch ist; auch bei nicht-existierender
    Email — Email-Enumeration-Schutz).
  - 422 `OAUTH_ONLY_ACCOUNT` — wenn `passwordHash IS NULL` (User hat
    sich bisher nur per Google/Facebook angemeldet). Frontend zeigt
    Hinweis „Bitte melden Sie sich mit Google/Facebook an".
  - 429 `RATE_LIMITED`.
- **Verifizierung:** Login funktioniert auch mit `emailVerified=false`
  (Vorentscheidung Orchestrator). Frontend zeigt Banner; Backend wirft
  KEINE 422.
- **Implementierungs-Hinweis (Architekt):** Engineer wählt zwischen
  (a) NextAuth-Credentials-Provider + Finalize-Brücke (siehe
  `customer-oauth.ts` Pattern), oder (b) klassischer eigener
  POST-Endpoint mit direktem Cookie-Setter (wie vor IT6). Beide Wege
  produzieren dieselbe Response-Form. Engineer dokumentiert die Wahl
  im PR.
- **Rate-Limit:** 10 / Stunde / IP, 5 / Stunde / Email.

#### `GET /api/customer/verify?token=…`

- **Story:** US-IT7-01.
- **Query:** `CustomerVerifyTokenQuerySchema` — `{ token: string }`.
- **Auth:** keine.
- **Response 200:** `{ ok: true }`. Setzt `emailVerified=true`,
  `emailVerifiedAt=now()`, `verificationToken=null`,
  `verificationTokenExpiry=null`.
- **Errors:**
  - 410 `INVALID_OR_EXPIRED_TOKEN` — Token unbekannt, abgelaufen oder
    bereits verbraucht.
  - 429 `RATE_LIMITED`.
- **Frontend-Flow:** `/konto/verifizieren?token=…` ruft den GET auf.
  Bei 200 → Redirect auf `/konto/verifizieren/erfolg`.

#### `POST /api/customer/resend-verification`

- **Story:** US-IT7-01.
- **Body:** keiner.
- **Auth:** Customer-Session (Cookie).
- **Response 200:** `{ ok: true }`.
- **Errors:**
  - 401 `UNAUTHORIZED` — keine Customer-Session.
  - 409 `ALREADY_VERIFIED` — `emailVerified === true`.
  - 429 `RATE_LIMITED`.
- **Side-effect:** generiert neuen `verificationToken`,
  `verificationTokenExpiry=now+24h`, sendet Resend-Mail.
- **Rate-Limit:** 3 / Stunde / Email.

### 23.3 Customer-Passwort-Reset (US-IT7-05)

Beide Endpoints arbeiten auf der neuen Tabelle `password_reset_tokens`
(siehe `contracts/schema.prisma` und `ARCHITECTURE_IT7.md` §5).

#### `POST /api/customer/forgot-password`

- **Story:** US-IT7-05.
- **Body:** `CustomerForgotPasswordSchema` — `{ email }`.
- **Auth:** keine.
- **Response 200:** `{ ok: true }` — **immer**, egal ob User existiert.
- **Errors:**
  - 400 `VALIDATION_ERROR`.
  - 429 `RATE_LIMITED`.
- **Side-effects (nur wenn User existiert):**
  - 32-Byte-`crypto.randomBytes` Base64url-Klartext-Token.
  - SHA-256-Hex-Digest in `password_reset_tokens.tokenHash`.
  - `expiresAt = now + 1h`.
  - Resend-Mail mit Reset-Link
    `${NEXTAUTH_URL}/konto/passwort-zuruecksetzen?token=<klartext>`.
- **Sicherheit (Email-Enumeration-Schutz):** Bei nicht-existierendem
  User wird **kein** DB-INSERT und **kein** Mail-Versand getriggert,
  aber die Latenz wird simuliert (`bcrypt.compare`-Dummy oder
  `await sleep(~200ms)`), damit Side-Channel-Timing-Angriffe scheitern.
- **Rate-Limit:** 3 / 15 Minuten / IP, 3 / Stunde / Email.

#### `POST /api/customer/reset-password`

- **Story:** US-IT7-05.
- **Body:** `CustomerResetPasswordSchema` — `{ token, password, passwordConfirm }`.
- **Auth:** keine (Token = Authority).
- **Response 200:** `{ ok: true }` — **niemals** `customerUser`-DTO,
  **niemals** `passwordHash`. Cookie wird **nicht** gesetzt; Kunde muss
  neu einloggen (= explizite Re-Authentication).
- **Errors:**
  - 400 `VALIDATION_ERROR` (z.B. Pwd zu kurz oder `passwordConfirm` mismatch).
  - 410 `INVALID_OR_EXPIRED_TOKEN` — Token unbekannt, abgelaufen oder
    bereits verbraucht.
  - 429 `RATE_LIMITED`.
- **Side-effects (atomar in `prisma.$transaction`):**
  - bcrypt-Hash (cost 12) → `customer_users.passwordHash`.
  - `password_reset_tokens.usedAt = now()` (single-use).
- **Frontend-Flow:** `/konto/passwort-zuruecksetzen?token=…` zeigt
  Form. POST → 200 → Redirect zu `/konto/login` mit Erfolgsmeldung.
- **Rate-Limit:** 5 / Stunde / IP.

### 23.4 ENV-Variablen (Iteration 7 ergänzt)

| Variable                | Pflicht                              | Beschreibung                                                                          |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| `ALLOW_ADMIN_PROMOTE`   | nur für `scripts/promote-admin.ts`   | `true`, sonst lehnt das CLI-Skript ab. Analog `ALLOW_USER_WIPE`.                      |
| `AUTH_SECRET`           | **ja in Prod**                       | NextAuth v5 — 32+ Zeichen. Pflicht. `NEXTAUTH_SECRET` bleibt als Alias gleich gültig. |
| `AUTH_TRUST_HOST`       | **ja auf Vercel/Tunnel/Production**  | `"true"` — sonst NextAuth v5 wirft „Bad request" durch Host-Verifikation.            |
| `RESEND_API_KEY`        | **ja in Prod**                       | Verify- und Reset-Mails (Customer-Auth). Ohne Key schlagen Mails still fehl.          |
| `MAIL_FROM`             | **ja**                               | Bärenstark-Absender (Resend muss Domain verifiziert haben).                           |

### 23.5 Rate-Limits (Iteration 7 ergänzt)

| Endpoint                                  | Rate-Limit                                              |
| ----------------------------------------- | ------------------------------------------------------- |
| `POST /api/customer/register`             | 5 / Stunde / IP, 3 / Stunde / Email.                    |
| `POST /api/customer/login`                | 10 / Stunde / IP, 5 / Stunde / Email.                   |
| `GET /api/customer/verify`                | 30 / Stunde / IP (Token-Brute-Force-Schutz).            |
| `POST /api/customer/resend-verification`  | 3 / Stunde / Email.                                     |
| `POST /api/customer/forgot-password`      | 3 / 15min / IP, 3 / Stunde / Email.                     |
| `POST /api/customer/reset-password`       | 5 / Stunde / IP.                                        |
| `GET /api/auth/diagnose`                  | unlimitiert in Dev, 404 in Prod.                        |

### 23.6 Story-zu-Endpoint-Matrix (Iteration 7)

| Story        | Endpoints / Pages                                                                         | Pages / UI                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| US-IT7-01    | `POST /register`, `POST /login`, `GET /verify`, `POST /resend-verification`               | `/konto/registrieren`, `/konto/login`, `/konto/verifizieren`, `/konto/verifizieren/erfolg`              |
| US-IT7-02    | `GET /api/auth/diagnose`, `customer-oauth.ts` Härtung (`debug:true`, `trustHost:true`)    | unverändert; `/konto/login` zeigt Google-Button                                                         |
| US-IT7-03    | `GET /api/auth/diagnose`, `customer-oauth.ts` Facebook-Provider                          | unverändert; `/konto/login` zeigt Facebook-Button + dt. Fehlerbanner bei `?error=oauth_no_email`        |
| US-IT7-04    | (kein HTTP-Endpoint) `scripts/promote-admin.ts`                                           | (kein Page) `scripts/README.md`                                                                          |
| US-IT7-05    | `POST /forgot-password`, `POST /reset-password`                                           | `/konto/passwort-vergessen`, `/konto/passwort-zuruecksetzen`                                            |

### 23.7 Aufhebung der IT6-Spec

Die in IT6 §22 Zeile 14 verzeichnete Aussage „Folgende Endpunkte werden
**gelöscht** (404 nach IT6): …" wird mit IT7 **aufgehoben**. Alle
sechs Customer-Auth-Endpoints sind ab IT7 wieder vollständige
Implementierungen mit den oben spezifizierten Verträgen.

