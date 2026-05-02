# API-Routen — Bärenstark Hausservice

**Verbindliche Spezifikation für Frontend & Backend.**
Alle Endpunkte sind Next.js Route Handlers unter `src/app/api/`.

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
| Base-URL (Prod) | `https://baerenstark-hausservice.de`                                       |
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

