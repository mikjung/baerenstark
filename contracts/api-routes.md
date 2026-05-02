# API-Routen — Bärenstark Hausservice

**Verbindliche Spezifikation für Frontend & Backend.**
Alle Endpunkte sind Next.js Route Handlers unter `src/app/api/`.

**Version:** 1.3 (Iteration 3 — US-17 bis US-24, BUG IT3)

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

## 8. Auth (NextAuth-managed)

Unverändert seit IT2. Geschützte Routen-Patterns erweitert:

| Pfad-Pattern                                                | Auth                |
| ----------------------------------------------------------- | ------------------- |
| `GET /admin/*` (Browser)                                    | Session erforderlich |
| `POST/PUT/DELETE /api/admin/*` (Iteration 3 NEU)            | Session erforderlich |
| `POST /api/upload`                                          | Öffentlich, Rate-Limit |
| `GET /api/slots/available`                                  | Öffentlich          |
| `GET /api/bookings/respond`, `POST /api/bookings/rebook`    | Öffentlich (Token)  |

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
