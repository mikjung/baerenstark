# API-Routen — Bärenstark Hausservice

**Verbindliche Spezifikation für Frontend & Backend.**
Alle Endpunkte sind Next.js Route Handlers unter `src/app/api/`.

**Version:** 1.2 (Iteration 2 — US-13 bis US-16, BUG US-04)

**Änderungen v1.2 gegenüber v1.1:**
- BUG US-04: `POST /api/bookings` kehrt jetzt **vor** dem Mail-Versand 201 zurück;
  Mail läuft fire-and-forget (siehe BUG_US04_ANALYSIS.md).
- `customerEmail` ist im `CreateBookingSchema` jetzt **Pflicht** (US-13/US-14).
- Neue Statuswerte: `COUNTER_PROPOSED`, `CANCELLED` (siehe Booking-State-Machine).
- Partial Unique Index erweitert: `COUNTER_PROPOSED` zählt als aktiv.
- **Neue Endpunkte:**
  - `POST /api/bookings/:id/counter-proposal` (Admin, US-13)
  - `GET /api/bookings/respond?token=...&action=accept|cancel` (öffentlich, US-13/US-14)
  - `POST /api/bookings/rebook` (öffentlich, US-13 AC4)
  - `GET /api/availability` (öffentlich, US-15/US-16)
  - `PUT /api/availability` (Admin, US-15)
  - `GET /api/calendar?year=YYYY&month=M` (öffentlich, US-16)
- Neuer Fehlercode `GONE` (HTTP 410) für verbrauchte Token / Endstatus-Versuche.
- Neue ENV-Variable `NEXT_PUBLIC_BASE_URL` (für Aktionslinks in Mails).

**Änderungen v1.1 gegenüber v1.0:**
- `isBooked` schließt PENDING ein (BUG-001).
- POST /api/bookings → 409 CONFLICT bei aktiv gebuchtem Slot (BUG-001/006).
- DELETE /api/slots/:id ist Soft-Delete + atomare PENDING→REJECTED-Migration (BUG-003).
- POST /api/slots prüft Min/Max-Dauer, Max-Vorlauf, Überlappung (BUG-008).
- Telefon-Validierung verschärft (BUG-010).
- Datums-Akzeptanz/Konvertierung explizit (BUG-011).
- Booking-State-Machine inklusive Idempotenz (BUG-013).
- Mail-Reliability-Felder `mailSent`, `mailError` in Responses (BUG-002).
- Fehlercodes `OVERLAP`, `RATE_LIMITED`, `MAIL_FAILED` neu.
- `callbackUrl` same-origin-Policy dokumentiert (BUG-005).
- Admin-Setup-Wizard `/api/admin/setup` neu.
- Resend-Mail-Retry-Endpoint `POST /api/bookings/:id/resend-mail` neu.
- Datenschutz-Pflicht-Bestätigung im Booking-Body.

---

## Globale Konventionen

| Aspekt          | Wert                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| Base-URL (Prod) | `https://baerenstark-hausservice.de`                                       |
| Base-URL (Dev)  | `http://localhost:3000`                                                    |
| Content-Type    | `application/json` (Request & Response)                                    |
| Datumsformat    | ISO 8601 mit Offset; intern in UTC normalisiert. Beispiele unten.          |
| IDs             | `cuid` (String)                                                            |
| Auth (Admin)    | Session-Cookie via NextAuth (`next-auth.session-token`, HttpOnly, Secure)  |
| Charset         | UTF-8                                                                      |
| Rate-Limit-Header | Bei 429: `Retry-After` (Sekunden) gesetzt.                               |

### Datums-/Zeit-Format (BUG-011)

- **Akzeptiert:** Jeder gültige ISO-8601-String mit Offset, also sowohl
  `2026-05-15T08:00:00.000Z` (UTC) als auch `2026-05-15T10:00:00+02:00` (Berlin
  im Sommer).
- **Backend** konvertiert beim Schreiben in UTC (`new Date(value).toISOString()`).
- **Backend liefert** stets UTC mit `Z`-Suffix in Responses.
- **Frontend** rendert via `Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', ... })`.
- **Ungültiges Format** (`"morgen"`, `""`, `"2026-13-45T99:00:00Z"`) → 400
  `VALIDATION_ERROR` mit `field: "startsAt"` (oder entsprechend).

### Einheitliches Fehlerformat

Jeder Fehler hat dieses Schema:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name ist ein Pflichtfeld",
    "field": "customerName"
  }
}
```

| Code               | HTTP | Bedeutung                                                                                |
| ------------------ | ---- | ---------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR` | 400  | Eingaben sind ungültig (Zod-Fehler).                                                     |
| `UNAUTHORIZED`     | 401  | Keine oder ungültige Session.                                                             |
| `FORBIDDEN`        | 403  | Eingeloggt, aber nicht berechtigt.                                                       |
| `NOT_FOUND`        | 404  | Ressource existiert nicht (oder ist soft-deleted).                                       |
| `CONFLICT`         | 409  | Slot ist bereits aktiv gebucht (PENDING/CONFIRMED/COUNTER_PROPOSED). Status-Konflikt.    |
| `OVERLAP`          | 409  | Neuer Slot überschneidet bestehenden, nicht-gelöschten Slot.                             |
| `GONE`             | 410  | Token bereits verwendet / Booking in Endstatus (US-13/US-14).                            |
| `RATE_LIMITED`     | 429  | Rate-Limit überschritten. `Retry-After`-Header gesetzt.                                  |
| `MAIL_FAILED`      | 502  | Resend-Versand für Trigger-Endpoint fehlgeschlagen (siehe Resend-Endpoint).              |
| `INTERNAL_ERROR`   | 500  | Unerwarteter Server-Fehler.                                                              |

`MAIL_FAILED` ist auch ein Marker auf dem Booking-Datensatz (`mailError != null`,
`mailSent === false`) — bei `POST /api/bookings` wird die Buchung trotzdem
persistiert und mit 201 quittiert; die fehlgeschlagene Mail ist intern.

---

## 1. Slots

### `GET /api/slots`

**Auth:** öffentlich
**Story:** US-03

Listet alle nicht-gelöschten, vom Admin angelegten Zeitfenster, inkl.
abgeleitetem `isBooked`-Flag.

**Filter (immer aktiv, nicht abschaltbar):** `deletedAt IS NULL`.

**Query-Parameter (optional):**

| Name    | Typ      | Default          | Beschreibung                                            |
| ------- | -------- | ---------------- | ------------------------------------------------------- |
| `from`  | ISO 8601 | jetzt            | Untergrenze für `startsAt`                              |
| `to`    | ISO 8601 | jetzt + 90 Tage  | Obergrenze für `startsAt`                               |
| `day`   | YYYY-MM-DD | —              | (Iteration 2) Filtert auf einen einzelnen Tag (Berlin-TZ). |

**Response 200:**

```json
{
  "data": [
    {
      "id": "clx9k...",
      "startsAt": "2026-05-15T08:00:00.000Z",
      "endsAt": "2026-05-15T12:00:00.000Z",
      "description": "Vormittag",
      "isBooked": false
    }
  ]
}
```

**`isBooked`-Definition (Iteration 2 erweitert):**
`isBooked = true` ⇔ es existiert mindestens eine Booking auf diesen Slot mit
Status **`PENDING`, `CONFIRMED` ODER `COUNTER_PROPOSED`**. REJECTED- und
CANCELLED-Bookings geben den Slot wieder frei.

**Caching/Freshness:** Route-Handler setzt `Cache-Control: no-store`.
Server-Components, die `GET /api/slots` aufrufen, nutzen `fetch(..., { cache: 'no-store' })`
oder Next-Revalidation-Tag `slots`, der bei jedem `POST/DELETE /api/slots` und
jedem statusverändernden Booking-Endpoint revalidiert wird.

Sortierung: `startsAt` aufsteigend.
Slots in der Vergangenheit werden ausgeblendet (Default-Filter `from = now`).

**Fehler:** keine spezifischen.

---

### `POST /api/slots`

**Auth:** Admin (Session erforderlich)
**Story:** US-05

Legt ein neues Zeitfenster an.

**Request Body:**

```json
{
  "startsAt": "2026-05-15T08:00:00.000Z",
  "endsAt": "2026-05-15T12:00:00.000Z",
  "description": "Vormittag"
}
```

| Feld          | Typ          | Pflicht | Validierung                                                |
| ------------- | ------------ | ------- | ---------------------------------------------------------- |
| `startsAt`    | string       | ja      | ISO 8601, in der Zukunft, max. 365 Tage entfernt.          |
| `endsAt`      | string       | ja      | ISO 8601, > `startsAt`. Dauer 30 min – 12 h.               |
| `description` | string\|null | nein    | Max. 500 Zeichen.                                          |

Vollständige Regeln (BUG-008) — durchgesetzt durch Zod (`CreateSlotSchema`):
- `endsAt - startsAt >= 30 Minuten`
- `endsAt - startsAt <= 12 Stunden`
- `startsAt <= now + 365 Tage`
- `startsAt > now`

**Server-seitiger Überlappungs-Check** vor dem Insert:
```sql
SELECT 1 FROM slots
WHERE deleted_at IS NULL
  AND id != :newId
  AND starts_at < :endsAt
  AND ends_at > :startsAt
```
Findet sich ein Treffer → 409 mit Code `OVERLAP`.

**Response 201:** `data: SlotPublic` mit `isBooked: false`.

**Fehler:**
- 400 `VALIDATION_ERROR`
- 401 `UNAUTHORIZED`
- 409 `OVERLAP`

---

### `DELETE /api/slots/:id`

**Auth:** Admin
**Story:** US-05

**Soft-Delete (BUG-003):** Setzt `deleted_at = now()`. Innerhalb derselben
DB-Transaktion werden alle zugehörigen `Booking`-Datensätze mit Status
`PENDING` ODER `COUNTER_PROPOSED` auf `CANCELLED` gesetzt (Iteration 2:
COUNTER_PROPOSED ist neu — die Vorschläge werden zurückgezogen).

`CONFIRMED`-Bookings bleiben unverändert: Tom hat dem Kunden bereits zugesagt;
falls er den Slot trotzdem zurückzieht, muss er die Bestätigung manuell auf
REJECTED setzen — die UI warnt entsprechend.

```sql
BEGIN;
UPDATE slots SET deleted_at = :now WHERE id = :id AND deleted_at IS NULL;
UPDATE bookings SET status = 'CANCELLED', updated_at = :now
  WHERE slot_id = :id AND status IN ('PENDING', 'COUNTER_PROPOSED');
COMMIT;
```

**Response 204:** Kein Body.

**Fehler:**
- 401 `UNAUTHORIZED`
- 404 `NOT_FOUND` — Slot existiert nicht oder ist bereits soft-deleted.
- 409 `CONFLICT` — Slot hat **CONFIRMED**-Bookings.

---

## 2. Bookings

### `POST /api/bookings`

**Auth:** öffentlich
**Story:** US-04 (mit Side-Effect US-08)

Erstellt eine Buchungsanfrage. Sendet eine E-Mail an Tom — **fire-and-forget
nach 201-Response** (BUG US-04 Fix 1).

**Request Body:**

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

| Feld              | Typ            | Pflicht | Validierung                                                                                                  |
| ----------------- | -------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `slotId`          | string         | ja      | Slot muss existieren, nicht soft-deleted, keine aktive (PENDING/CONFIRMED/COUNTER_PROPOSED) Booking haben.    |
| `customerName`    | string         | ja      | 2–120 Zeichen, getrimmt.                                                                                     |
| `customerPhone`   | string         | ja      | Nur Ziffern und `+ - / ( ) Leerzeichen`, max. 40 Zeichen, mindestens 6 Ziffern.                                |
| `customerEmail`   | string         | **ja**  | **Pflicht ab Iteration 2** (US-13/US-14). Whitespace wird via preprocess getrimmt; nur leere Trimms → Validierungsfehler. |
| `service`         | enum           | ja      | Einer der `SERVICES`-Slugs.                                                                                   |
| `description`     | string         | ja      | 5–2000 Zeichen, getrimmt.                                                                                    |
| `privacyAccepted` | boolean        | ja      | Muss `true` sein. Wird **nicht** persistiert.                                                                 |

**Verhalten:**

1. Persistiert die Buchung (Status PENDING).
2. Generiert `cancelToken` (cuid) automatisch beim Insert.
3. **Antwortet sofort mit 201** — Mail-Versand läuft anschließend asynchron.
4. Fire-and-forget Mail-Dispatch:
   - Eingangsbestätigung an Kunden (`customerEmail`) — mit Storno-Link.
   - Benachrichtigungs-Mail an Tom (US-08) — mit Quick-Action-Links.
   - Bei Erfolg: `mailSent = true`, `mailError = null`.
   - Bei Fehlschlag: `mailSent = false`, `mailError = <truncated 500 Z.>`.
5. Admin-Dashboard zeigt `mailSent === false` rot, mit Resend-Button.

**Verhalten bei aktiv gebuchtem Slot:**
Partial Unique Index `uniq_active_booking_per_slot` schlägt zu →

```json
HTTP/1.1 409 Conflict
{ "error": { "code": "CONFLICT", "message": "Dieses Zeitfenster wurde gerade gebucht. Bitte wählen Sie ein anderes." } }
```

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

**Rate-Limiting:** 10 Anfragen / 60 min / IP (Upstash, optional).

**Fehler:**
- 400 `VALIDATION_ERROR`
- 404 `NOT_FOUND` — `slotId` existiert nicht oder ist soft-deleted.
- 409 `CONFLICT` — Slot bereits aktiv gebucht.
- 429 `RATE_LIMITED`

---

### `GET /api/bookings`

**Auth:** Admin
**Story:** US-06

Listet Buchungsanfragen.

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
      "slot": {
        "id": "clx9k...",
        "startsAt": "2026-05-15T08:00:00.000Z",
        "endsAt": "2026-05-15T12:00:00.000Z",
        "description": "Vormittag",
        "deletedAt": null
      },
      "customerName": "Maria Müller",
      "customerPhone": "0157-12345678",
      "customerEmail": "maria@example.com",
      "service": "entruempelung",
      "description": "Keller entrümpeln, ca. 30 m³",
      "status": "PENDING",
      "mailSent": true,
      "mailError": null,
      "cancelToken": "clb...token",
      "counterProposalSlot": null,
      "createdAt": "2026-05-02T13:42:00.000Z",
      "updatedAt": "2026-05-02T13:42:00.000Z"
    }
  ]
}
```

Für eine Booking mit Status `COUNTER_PROPOSED` ist `counterProposalSlot`
befüllt mit dem vorgeschlagenen Slot:

```json
{
  "counterProposalSlot": {
    "id": "clx2...",
    "startsAt": "2026-05-22T08:00:00.000Z",
    "endsAt": "2026-05-22T12:00:00.000Z",
    "description": "Vormittag"
  }
}
```

Sortierung: `createdAt` absteigend.

**Vorsicht:** Sowohl `Slot` als auch `Booking` haben ein Feld `description`.
Beim Mapping im Frontend explizit über `booking.description` und
`booking.slot.description` zugreifen — niemals destrukturieren ohne Renaming.

**Fehler:**
- 401 `UNAUTHORIZED`

---

### `PATCH /api/bookings/:id`

**Auth:** Admin
**Story:** US-06

Setzt den Status einer Buchungsanfrage. **Beschränkt auf CONFIRMED|REJECTED.**
COUNTER_PROPOSED, CANCELLED haben dedizierte Endpunkte.

**Request Body:**

```json
{ "status": "CONFIRMED" }
```

**State-Machine (Iteration 2 — komplette Tabelle, siehe ARCHITECTURE.md §15):**

| Aktueller Status   | Ziel-Status   | Endpoint                                              | Verhalten                                                               |
| ------------------ | ------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| PENDING            | CONFIRMED     | `PATCH /api/bookings/:id`                             | Slot wird `isBooked: true`. Bestätigungs-Mail an Kunden.                |
| PENDING            | REJECTED      | `PATCH /api/bookings/:id`                             | Slot wird wieder frei. Optionale Info-Mail an Kunden (Backlog).         |
| PENDING            | COUNTER_PROPOSED | `POST /api/bookings/:id/counter-proposal`         | Vorschlag-Mail an Kunden mit 3 Aktionslinks.                            |
| PENDING            | CANCELLED     | `GET /api/bookings/respond?...&action=cancel`         | Kunde-Token-Endpoint. Mail an Tom.                                      |
| CONFIRMED          | REJECTED      | `PATCH /api/bookings/:id`                             | Slot wird wieder frei.                                                  |
| CONFIRMED          | CONFIRMED     | `PATCH /api/bookings/:id`                             | **Idempotent.** 200 OK, kein Update.                                    |
| REJECTED           | CONFIRMED     | `PATCH /api/bookings/:id`                             | Wenn Slot inzwischen aktiv besetzt → 409 `CONFLICT`.                    |
| REJECTED           | REJECTED      | `PATCH /api/bookings/:id`                             | **Idempotent.** 200 OK, kein Update.                                    |
| COUNTER_PROPOSED   | CONFIRMED     | `GET /api/bookings/respond?...&action=accept`         | Kunde nimmt an. slotId = counterProposalSlotId, counterProposalSlotId NULL. Mail an Tom. |
| COUNTER_PROPOSED   | PENDING       | `POST /api/bookings/rebook`                           | Kunde wählt neuen Slot. slotId = newSlotId. Mail an Tom.                 |
| COUNTER_PROPOSED   | CANCELLED     | `GET /api/bookings/respond?...&action=cancel`         | Kunde storniert. Mail an Tom.                                            |
| CANCELLED          | (jeder)       | —                                                     | **410 GONE.** Endstatus, Token verbraucht.                               |
| (alle)             | PENDING       | (Body erlaubt es nicht)                               | 400 `VALIDATION_ERROR`.                                                  |

**Idempotenz-Regel:** Wenn der Ziel-Status identisch zum Ist-Status ist, wird
**kein DB-Update** durchgeführt; die Response ist 200 OK mit dem unveränderten
Datensatz und unverändertem `updatedAt`.

**Response 200:**

```json
{
  "data": {
    "id": "clb...",
    "status": "CONFIRMED",
    "updatedAt": "2026-05-02T14:00:00.000Z"
  }
}
```

**Side-Effects:**
- Bei Status-Änderung wird `revalidateTag('slots')` aufgerufen.
- Wenn neu CONFIRMED: optionale Bestätigungs-Mail an Kunden (Backlog/Future).

**Fehler:**
- 400 `VALIDATION_ERROR`
- 401 `UNAUTHORIZED`
- 404 `NOT_FOUND`
- 409 `CONFLICT`
- 410 `GONE` — Booking ist in einem Endstatus (CANCELLED), Übergänge nicht mehr möglich.

---

### `POST /api/bookings/:id/counter-proposal`

**Auth:** Admin
**Story:** US-13

Admin schlägt einen Alternativtermin für eine offene (PENDING) Buchungsanfrage
vor. Wechselt den Status auf `COUNTER_PROPOSED` und sendet eine Mail an den
Kunden mit drei Aktionslinks.

**Request Body:**

```json
{
  "newSlotId": "clx2..."
}
```

| Feld        | Typ    | Pflicht | Validierung                                                                       |
| ----------- | ------ | ------- | --------------------------------------------------------------------------------- |
| `newSlotId` | string | ja      | Existierender Slot, nicht soft-deleted, keine aktive Buchung, ≠ aktueller slotId. |

**Verhalten:**

1. Booking muss Status `PENDING` haben (sonst 409 `CONFLICT`).
2. `newSlotId` muss existieren, nicht soft-deleted sein, und keine aktive
   (PENDING/CONFIRMED/COUNTER_PROPOSED) Booking haben (sonst 409 `CONFLICT`).
3. **Atomar in einer Transaktion:**
   - `Booking.status = 'COUNTER_PROPOSED'`
   - `Booking.counterProposalSlotId = newSlotId`
4. Versand einer **Vorschlag-Mail** an `customerEmail` mit folgenden Links
   (siehe ARCHITECTURE.md §15 für die Templates):
   - „Vorschlag annehmen": `${BASE_URL}/api/bookings/respond?token=${cancelToken}&action=accept`
   - „Anderen Termin wählen": `${BASE_URL}/buchung?rebookToken=${cancelToken}`
   - „Anfrage stornieren": `${BASE_URL}/api/bookings/respond?token=${cancelToken}&action=cancel`
5. Mail-Status (`mailSent`/`mailError`) wird wie bei `POST /api/bookings`
   (fire-and-forget) am Booking persistiert.

**Wichtig — Slot-Locking:** Da der vorgeschlagene Slot ab dem Versand der
Mail bis zur Kundenreaktion **reserviert** sein muss (sonst könnte ein
anderer Kunde ihn buchen), wird der Slot durch ein zusätzliches "Lock-Booking"
NICHT angelegt — stattdessen erweitert der Partial Unique Index die "aktive
Buchung pro Slot"-Garantie um den Status COUNTER_PROPOSED. Konkret: die
Booking selbst hat `slotId = ursprünglicher Slot` und
`counterProposalSlotId = neuer Slot`. Damit sperrt sie den **ursprünglichen**
Slot weiterhin (PENDING-Verhalten); für den vorgeschlagenen Slot wird
parallel beim Insert geprüft, dass er aktuell frei ist, **aber kein Lock-
Eintrag** in `bookings` angelegt — der Slot bleibt während des Vorschlags
formal offen für andere Kunden. **Trade-off-Akzeptanz:** Im MVP ist Tom der
einzige Admin, der Vorschläge macht; Race-Conditions sind unwahrscheinlich.
Bei Bedarf kann eine separate `slot_holds`-Tabelle nachgerüstet werden
(Backlog).

**Hinweis für Engineers:** Wenn Tom mehrere Vorschläge auf den gleichen
neuen Slot abgibt, bleibt das valide — der Slot ist erst "aktiv belegt",
wenn der Kunde den Vorschlag annimmt (Übergang zu CONFIRMED auf
counterProposalSlotId), und dann greift der Partial Unique Index gegen
parallele aktive Buchungen.

**Response 200:**

```json
{
  "data": {
    "id": "clb...",
    "status": "COUNTER_PROPOSED",
    "counterProposalSlot": {
      "id": "clx2...",
      "startsAt": "2026-05-22T08:00:00.000Z",
      "endsAt": "2026-05-22T12:00:00.000Z",
      "description": "Vormittag"
    },
    "updatedAt": "2026-05-02T15:00:00.000Z"
  }
}
```

**Fehler:**
- 400 `VALIDATION_ERROR` — `newSlotId` fehlt.
- 401 `UNAUTHORIZED`
- 404 `NOT_FOUND` — Booking oder neuer Slot nicht gefunden.
- 409 `CONFLICT` — Booking ist nicht im Status PENDING, oder neuer Slot nicht buchbar.

---

### `GET /api/bookings/respond?token=...&action=accept|cancel`

**Auth:** öffentlich (Token-basiert)
**Story:** US-13 / US-14

**Wichtig:** Dies ist ein **GET-Endpunkt**, weil er als Hyperlink in
E-Mails klickbar sein muss. Die Aktion ist **idempotent semantisch korrekt**
(zweiter Aufruf nach erfolgreicher Aktion → 410 GONE), aber technisch
zustandsverändernd. Trade-off: GET ist die einzig praktikable Variante in
E-Mail-Clients ohne Web-Browser-JS-Form.

**Query-Parameter:**

| Name     | Typ    | Pflicht | Werte                |
| -------- | ------ | ------- | -------------------- |
| `token`  | string | ja      | `cancelToken` der Buchung. |
| `action` | enum   | ja      | `accept` \| `cancel` |

**Verhalten — `action=accept`:**

Übergang `COUNTER_PROPOSED → CONFIRMED`:
1. Lookup Booking via `cancelToken`. Nicht gefunden → 404.
2. Wenn Status nicht `COUNTER_PROPOSED` → 410 `GONE` (oder 409, falls noch PENDING).
3. **Atomar in einer Transaktion:**
   - Sicherstellen, dass `counterProposalSlotId` immer noch existiert und
     nicht soft-deleted ist (sonst 410 `GONE`).
   - Sicherstellen, dass keine andere aktive Buchung auf
     `counterProposalSlotId` existiert (Partial Unique Index — bei
     Verstoß: 409 `CONFLICT`).
   - `slotId = counterProposalSlotId`
   - `counterProposalSlotId = NULL`
   - `status = 'CONFIRMED'`
4. Mail an Tom: „Kunde hat Alternativvorschlag angenommen" (US-13 AC3).
5. Antwort: HTTP 302 Redirect auf
   `/buchung/bestaetigt?bookingId=<id>` (öffentliche Erfolgsseite).
   Die Erfolgsseite zeigt den nun gültigen Termin und einen tel:-Link.

**Verhalten — `action=cancel`:**

Übergang `PENDING|COUNTER_PROPOSED → CANCELLED`:
1. Lookup Booking via `cancelToken`. Nicht gefunden → 404.
2. Wenn Status `CONFIRMED|REJECTED|CANCELLED` → 410 `GONE`.
3. `status = 'CANCELLED'` (Slot wird damit wieder frei).
4. Mail an Tom: „Kunde hat Anfrage storniert" (US-14 AC2).
5. Antwort: HTTP 302 Redirect auf `/buchung/storno?bookingId=<id>`.

**Antworten (für direkten API-Aufruf, z.B. via Frontend-Fetch im
Re-Booking-Flow):**

- 302 — Erfolgsfall, mit `Location`-Header (siehe oben).
  *Hinweis*: Bei direktem Browser-Klick aus der E-Mail führt das zu einer
  Bestätigungsseite. Das Frontend kann diesen Endpoint auch via fetch
  aufrufen und die Redirect-URL aus dem `Location`-Header lesen.
- 404 `NOT_FOUND` — Token unbekannt.
- 410 `GONE` — Booking ist in einem Endstatus. Body:
  ```json
  { "error": { "code": "GONE", "message": "Diese Aktion wurde bereits durchgeführt oder ist nicht mehr möglich." } }
  ```
- 409 `CONFLICT` — Bei `accept`: vorgeschlagener Slot inzwischen anderweitig vergeben.
- 400 `VALIDATION_ERROR` — `token` oder `action` fehlt/ungültig.

**Sicherheit:**

- Token (cuid) ist 24+ Zeichen, ausreichend kollisionsarm und nicht erratbar.
- **Kein Rate-Limit** auf diesem Endpoint, weil ein Angreifer mit gültigem
  Token ohnehin die Aktion auslösen kann; brute-forcen eines fremden Tokens
  ist statistisch chancenlos.
- HTTPS-only.

---

### `POST /api/bookings/rebook`

**Auth:** öffentlich (Token-basiert)
**Story:** US-13 AC4

Re-Booking-Flow: Kunde hat Counter-Proposal abgelehnt und im Frontend
(`/buchung?rebookToken=xxx`) einen neuen Slot ausgewählt.

**Request Body:**

```json
{
  "token": "clb...token",
  "newSlotId": "clx3..."
}
```

| Feld        | Typ    | Pflicht | Validierung                                                |
| ----------- | ------ | ------- | ---------------------------------------------------------- |
| `token`     | string | ja      | `cancelToken` der Buchung.                                  |
| `newSlotId` | string | ja      | Existierender, nicht-deleted, freier Slot.                  |

**Verhalten:**

1. Lookup Booking via `cancelToken`. Nicht gefunden → 404.
2. Wenn Status ≠ `COUNTER_PROPOSED` → 410 `GONE`.
3. `newSlotId` muss existieren, nicht soft-deleted, keine aktive Buchung.
4. **Atomar:**
   - `slotId = newSlotId`
   - `counterProposalSlotId = NULL`
   - `status = 'PENDING'`
5. Mail an Tom: „Kunde hat einen neuen Termin gewählt" (US-13 AC4).

**Response 200:**

```json
{
  "data": {
    "id": "clb...",
    "status": "PENDING",
    "slotId": "clx3...",
    "updatedAt": "2026-05-02T16:00:00.000Z"
  }
}
```

**Fehler:**
- 400 `VALIDATION_ERROR`
- 404 `NOT_FOUND` — Token unbekannt oder Slot nicht gefunden.
- 409 `CONFLICT` — neuer Slot bereits aktiv gebucht.
- 410 `GONE` — Booking ist nicht im Status COUNTER_PROPOSED.

---

### `POST /api/bookings/:id/resend-mail`

**Auth:** Admin
**Story:** US-06 / US-08 (Recovery, BUG-002)

Stößt den Mail-Versand für eine Buchung erneut an. Genau wie bisher (Iteration 1):
nutzbar für Bookings mit `mailSent === false`. Idempotent: bei `mailSent === true`
no-op.

**Hinweis Iteration 2:** Ergänzt um Resend für Counter-Proposal-Mail, falls
der ursprüngliche Versand fehlgeschlagen ist. Der Endpoint sendet die zur
aktuellen Status passende Mail neu (PENDING → "neue Anfrage"-Mail an Tom,
COUNTER_PROPOSED → "Vorschlag"-Mail an Kunden).

**Response 200:**
```json
{ "data": { "id": "clb...", "mailSent": true, "mailError": null } }
```

**Fehler:**
- 401 `UNAUTHORIZED`
- 404 `NOT_FOUND`
- 502 `MAIL_FAILED`

---

## 3. Verfügbarkeit (Iteration 2 — US-15)

### `GET /api/availability`

**Auth:** öffentlich
**Story:** US-15 / US-16

Liefert die aktuelle Wochentag-Verfügbarkeitskonfiguration.

**Response 200:**

```json
{
  "data": {
    "days": [
      { "dayOfWeek": 0, "isActive": false },
      { "dayOfWeek": 1, "isActive": true },
      { "dayOfWeek": 2, "isActive": true },
      { "dayOfWeek": 3, "isActive": true },
      { "dayOfWeek": 4, "isActive": true },
      { "dayOfWeek": 5, "isActive": true },
      { "dayOfWeek": 6, "isActive": false }
    ]
  }
}
```

Sortierung: aufsteigend nach `dayOfWeek` (0 = Sonntag, 6 = Samstag — kompatibel zu `Date.getDay()`).

`Cache-Control: no-store`.

**Fehler:** keine.

---

### `PUT /api/availability`

**Auth:** Admin
**Story:** US-15

Setzt die Wochentag-Verfügbarkeitskonfiguration.

**Request Body:**

```json
{
  "days": [
    { "dayOfWeek": 0, "isActive": false },
    { "dayOfWeek": 1, "isActive": true },
    { "dayOfWeek": 2, "isActive": true },
    { "dayOfWeek": 3, "isActive": true },
    { "dayOfWeek": 4, "isActive": true },
    { "dayOfWeek": 5, "isActive": true },
    { "dayOfWeek": 6, "isActive": false }
  ]
}
```

| Feld   | Typ                       | Pflicht | Validierung                                              |
| ------ | ------------------------- | ------- | -------------------------------------------------------- |
| `days` | Array<{dayOfWeek,isActive}> | ja    | 1–7 Einträge, dayOfWeek 0–6, jede dayOfWeek max 1× vorhanden. |

**Verhalten:** Upsert pro Eintrag in einer Transaktion. Nicht-mitgesendete
dayOfWeeks bleiben unverändert. Frontend sendet i.d.R. immer alle 7 Tage.

**Response 200:** Wie bei GET (vollständige aktuelle Konfiguration).

**Side-Effect:** `revalidateTag('availability')` und `revalidateTag('calendar')`.

**Fehler:**
- 400 `VALIDATION_ERROR`
- 401 `UNAUTHORIZED`

---

## 4. Kalender (Iteration 2 — US-16)

### `GET /api/calendar?year=YYYY&month=M`

**Auth:** öffentlich
**Story:** US-16

Liefert pro Tag eines Monats: Verfügbarkeit + buchbare Slot-IDs.

**Query-Parameter:**

| Name    | Typ    | Pflicht | Validierung                |
| ------- | ------ | ------- | -------------------------- |
| `year`  | number | ja      | 2025–2100 (Coerce aus String). |
| `month` | number | ja      | 1–12.                      |

**Response 200:**

```json
{
  "data": {
    "year": 2026,
    "month": 5,
    "days": [
      { "date": "2026-05-01", "available": false, "slotIds": [] },
      { "date": "2026-05-02", "available": true,  "slotIds": ["clx9k..."] },
      { "date": "2026-05-03", "available": false, "slotIds": [] }
    ]
  }
}
```

**Logik pro Tag** (Berlin-TZ):

```
weekday = new Date(date).getDay()  // 0..6
weeklyActive = WeeklyAvailability(weekday).isActive
hasConfirmedBlocker = ∃ Booking { status='CONFIRMED', slot.startsAt im Tag-Range }
isFuture = date > heute (Berlin-TZ, Tag-Vergleich)

available = weeklyActive AND NOT hasConfirmedBlocker AND isFuture
```

**slotIds** enthält die IDs aller nicht-soft-gelöschten Slots, die mindestens
teilweise in diesen Tag fallen UND deren `isBooked` aktuell `false` ist
(d.h. keine PENDING/CONFIRMED/COUNTER_PROPOSED-Buchung darauf).

Der Tag-Range ist: `[date 00:00 Berlin-TZ, date+1d 00:00 Berlin-TZ)`.

**Caching:** `Cache-Control: no-store`. Frontend nutzt kein Caching.

**Fehler:**
- 400 `VALIDATION_ERROR` — `year` oder `month` fehlt/ungültig.

---

## 5. Auth (NextAuth-managed)

NextAuth handhabt die Endpunkte unter `/api/auth/*` automatisch. Die
Frontend-Implementation nutzt `signIn()` / `signOut()` aus `next-auth/react`.

### `POST /api/auth/callback/credentials`

**Story:** US-07

(Unverändert seit v1.1 — siehe v1.1-Doku unten.)

### `callbackUrl`-Validierung (BUG-005)

(Unverändert.)

### `POST /api/auth/signout`

(Unverändert.)

### Geschützte Routen — Verhalten ohne Session

| Pfad-Pattern                        | Antwort                                            |
| ----------------------------------- | -------------------------------------------------- |
| `GET /admin/*` (Browser-Navigation) | 302 → `/admin/login?callbackUrl=<originalPath>`    |
| `POST/PATCH/PUT/DELETE /api/...` (admin) | 401 JSON `{ "error": { "code": "UNAUTHORIZED", ... } }` |

**Iteration-2-Ergänzung:** `POST /api/bookings/:id/counter-proposal`,
`PUT /api/availability` sind ebenfalls admin-geschützt.
`GET /api/bookings/respond` und `POST /api/bookings/rebook` sind
**explizit öffentlich** (Token-basiert).

---

## 6. Admin-Setup-Wizard (einmalig)

### `GET /api/admin/setup` und `POST /api/admin/setup`

(Unverändert seit v1.1.)

---

## 7. Endpoint-zu-Story-Matrix

| Endpoint                                  | US-04 | US-05 | US-06 | US-07 | US-08 | US-13 | US-14 | US-15 | US-16 |
| ----------------------------------------- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `GET /api/slots`                          |   ✓   |       |       |       |       |       |       |       |   ✓   |
| `POST /api/slots`                         |       |   ✓   |       |       |       |       |       |       |       |
| `DELETE /api/slots/:id`                   |       |   ✓   |       |       |       |       |       |       |       |
| `POST /api/bookings`                      |   ✓   |       |       |       |   ✓   |       |       |       |       |
| `GET /api/bookings`                       |       |       |   ✓   |       |       |   ✓   |   ✓   |       |       |
| `PATCH /api/bookings/:id`                 |       |       |   ✓   |       |       |       |       |       |       |
| `POST /api/bookings/:id/counter-proposal` |       |       |       |       |       |   ✓   |       |       |       |
| `GET /api/bookings/respond`               |       |       |       |       |       |   ✓   |   ✓   |       |       |
| `POST /api/bookings/rebook`               |       |       |       |       |       |   ✓   |       |       |       |
| `POST /api/bookings/:id/resend-mail`      |       |       |   ✓   |       |   ✓   |   ✓   |   ✓   |       |       |
| `GET /api/availability`                   |       |       |       |       |       |       |       |   ✓   |   ✓   |
| `PUT /api/availability`                   |       |       |       |       |       |       |       |   ✓   |       |
| `GET /api/calendar`                       |       |       |       |       |       |       |       |       |   ✓   |
| `POST /api/auth/callback/credentials`     |       |       |       |   ✓   |       |       |       |       |       |
| `GET /api/admin/setup`                    |       |       |       |   ✓   |       |       |       |       |       |
| `POST /api/admin/setup`                   |       |       |       |   ✓   |       |       |       |       |       |

US-01 und US-02 benötigen keine API-Aufrufe — Inhalt ist statisch.

---

## 8. Frontend-Aufrufer-Mapping

| Endpoint                                  | Aufgerufen von                                                  |
| ----------------------------------------- | --------------------------------------------------------------- |
| `GET /api/slots`                          | `app/buchung/page.tsx` (Server-Component) + `components/admin/SlotTable.tsx` |
| `POST /api/slots`                         | `components/admin/SlotForm.tsx`                                 |
| `DELETE /api/slots/:id`                   | `components/admin/SlotTable.tsx`                                |
| `POST /api/bookings`                      | `components/booking/BookingForm.tsx`                            |
| `GET /api/bookings`                       | `app/admin/bookings/page.tsx` (Server-Component)                |
| `PATCH /api/bookings/:id`                 | `components/admin/BookingTable.tsx`                             |
| `POST /api/bookings/:id/counter-proposal` | `components/admin/CounterProposalDialog.tsx` (neu, US-13)       |
| `GET /api/bookings/respond`               | E-Mail-Links (direkt aus Mail-Client) sowie optional via `lib/api-client.ts.respondToBooking()` aus dem Counter-Proposal-Frontend. |
| `POST /api/bookings/rebook`               | `app/buchung/BookingClient.tsx` (Re-Booking-Flow mit `?rebookToken=`) |
| `POST /api/bookings/:id/resend-mail`      | `components/admin/BookingTable.tsx`                             |
| `GET /api/availability`                   | `app/buchung/page.tsx` (für Kalender-Anzeige) + `app/admin/availability/page.tsx` |
| `PUT /api/availability`                   | `components/admin/WeeklyAvailabilityForm.tsx` (neu, US-15)      |
| `GET /api/calendar`                       | `components/booking/Calendar.tsx` (neu, US-16)                  |
| `GET /api/admin/setup`                    | `app/admin/login/page.tsx` (Pre-Check) + `app/admin/setup/page.tsx` |
| `POST /api/admin/setup`                   | `app/admin/setup/page.tsx`                                      |
| Auth-Endpunkte                            | `app/admin/login/page.tsx` via `next-auth/react`                |
