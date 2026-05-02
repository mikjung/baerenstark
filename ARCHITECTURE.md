# Architektur — Bärenstark Hausservice Website

**Version:** 1.2 (Iteration 2 — Counter-Proposal, Storno, Wochentag-Verfügbarkeit, Kalender)
**Stand:** 2026-05-02
**Autor:** Solution Architect

---

## Änderungslog v1.2 (Iteration 2)

Auslöser: Iteration-2-Stories US-13 bis US-16 plus Blocker-Bug **BUG US-04**
("Buchungsanfrage absenden schlägt fehl"). Diese Version dokumentiert die
neuen Datenmodell-Felder, Endpunkte, State-Machine-Übergänge und E-Mail-
Templates. Detaillierte Wire-Specs in `contracts/api-routes.md` (v1.2),
`contracts/schema.prisma` (v1.2), `contracts/zod-schemas.ts` (v1.2). Die
Bug-Analyse mit konkreten Patch-Anweisungen liegt in
`contracts/BUG_US04_ANALYSIS.md`.

| ID                | Bereich       | Erweiterung / Fix                                                                                |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| BUG-US-04 Fix 1   | Backend-Logik | `POST /api/bookings` antwortet sofort 201, Mail läuft fire-and-forget (`runMailDispatch`).        |
| BUG-US-04 Fix 2   | Schema        | `customerEmail` via `z.preprocess` gegen Whitespace gehärtet (Iteration 2 macht es zur Pflicht). |
| BUG-US-04 Fix 3   | Operational   | `getResend()` filtert Placeholder-Keys aktiv; `.env.example` mit Hinweis.                         |
| US-13 (Datenmodell) | Schema      | `Booking.cancelToken` (UNIQUE), `Booking.counterProposalSlotId` (FK).                            |
| US-13 (Status)    | State-Machine | Neue Statuswerte `COUNTER_PROPOSED`, `CANCELLED`. State-Machine in §15 dokumentiert.              |
| US-13 (API)       | Endpunkte     | `POST /api/bookings/:id/counter-proposal`, `GET /api/bookings/respond`, `POST /api/bookings/rebook` neu. |
| US-13 (Mail)      | Templates     | 4 neue Mail-Templates (Eingangsbestätigung, Counter-Proposal, Bestätigung-an-Tom, Storno-an-Tom). |
| US-14             | Endpunkte     | Storno via `GET /api/bookings/respond?action=cancel` plus öffentliche Storno-Bestätigungs-Page. |
| US-15             | Datenmodell   | Neues Modell `WeeklyAvailability` (7 Datensätze, Toggle pro Wochentag).                           |
| US-15 (API)       | Endpunkte     | `GET /api/availability`, `PUT /api/availability`.                                                |
| US-16             | API           | `GET /api/calendar?year=YYYY&month=M`. Frontend-Komponente `components/booking/Calendar.tsx`.     |
| Index-Update      | DB            | Partial Unique Index erweitert um `COUNTER_PROPOSED`.                                            |
| Soft-Delete-Update| DB            | `DELETE /api/slots/:id` setzt jetzt auch `COUNTER_PROPOSED → CANCELLED`.                          |
| Customer-Email    | Schema        | `customerEmail` ist im `CreateBookingSchema` jetzt **Pflicht** (US-13/US-14 brauchen sie).        |
| Neuer Fehlercode  | API           | `GONE` (HTTP 410) für verbrauchte Token / Endstatus-Versuche.                                     |
| Neue ENV          | Operational   | `NEXT_PUBLIC_BASE_URL` für Aktionslinks in Mails (Default-Fallback: `NEXTAUTH_URL`).              |

Detaillierte Iteration-2-Spezifikation: siehe **§15** in diesem Dokument.

---

## Änderungslog v1.1

Auslöser: `QA_DESIGN_REVIEW.md` vom 2026-05-02 mit 5 kritischen, 8 wichtigen,
6 minor Findings. Folgende Fixes sind in dieser Version umgesetzt:

| ID       | Bereich     | Fix                                                                                              |
| -------- | ----------- | ------------------------------------------------------------------------------------------------ |
| BUG-001  | Logik       | `isBooked` schließt PENDING ein. Slot wird ab erster Anfrage gesperrt; REJECTED gibt ihn frei.   |
| BUG-002  | Mail        | `mailSent`/`mailError` am Booking. 3 Retries im Handler. Admin-Dashboard markiert Fehlversände.  |
| BUG-003  | Schema      | Soft-Delete für Slots (`deletedAt`). DELETE setzt PENDING-Bookings atomar auf REJECTED.          |
| BUG-004  | Security    | Rate-Limit via Upstash Redis (shared); Fallback dokumentiert.                                    |
| BUG-005  | Security    | NextAuth `callbacks.redirect` validiert `callbackUrl` auf same-origin.                            |
| BUG-006  | DB          | Partial Unique Index `uniq_active_booking_per_slot` verhindert Doppelbuchungen DB-seitig.        |
| BUG-008  | Validation  | Slot: Min 30 min, Max 12 h, Max-Vorlauf 1 Jahr, Überlappungs-Check → 409 `OVERLAP`.              |
| BUG-009  | Contract    | `customerEmail` ist im MVP-Formular vorhanden, optional, beschriftet entsprechend.               |
| BUG-010  | Validation  | Telefon: mindestens 6 Ziffern nach Strip von Trennzeichen.                                       |
| BUG-011  | Validation  | Datums-Format: ISO 8601 mit Offset akzeptiert, BE konvertiert in UTC.                            |
| BUG-012  | UX          | Loading-/Error-/Empty-/Conflict-States pro Page dokumentiert (siehe §10).                        |
| BUG-013  | API         | State-Machine inkl. Idempotenz: gleicher Status → 200 OK, kein Update.                           |
| GDPR     | Legal       | Datenschutz-Hinweis im Buchungsformular Pflicht; Aufbewahrung 2 Jahre.                            |
| Setup    | Auth        | Admin-Setup-Wizard auf `/admin/setup` ersetzt ENV-Seed-Variante.                                  |
| BUG-015  | Performance | Composite-Index `(startsAt, endsAt)` für Range-Queries.                                          |

Neue Fehlercodes: `OVERLAP`, `RATE_LIMITED`, `MAIL_FAILED`.

---

## 1. Stack-Entscheidung

Gewählter Stack: **Next.js 14 (App Router) + SQLite + Prisma + NextAuth + Resend + Tailwind CSS**, deployed auf **Vercel**, mit **Upstash Redis** für Rate-Limiting.

| Layer            | Technologie                                | Begründung                                                                                                  |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 14 (App Router) + TypeScript       | Frontend + Backend in einem Projekt, eine Code-Basis, eine Deployment-Pipeline. Senkt Wartungsaufwand drastisch. |
| Styling          | Tailwind CSS                               | Mobile-first by default, kein eigenes CSS-System nötig, lässt sich perfekt an Braun/Beige-Farbschema anpassen. |
| Datenbank        | SQLite via **Turso** (libSQL)              | Kostenloser Tier (500 DB / 9 GB), edge-replicated, kein eigener DB-Server, kein Backup-Setup. Fallback: lokale SQLite-Datei für Dev. |
| ORM              | Prisma                                     | Typisiertes Schema, Migrations-Tooling, einfache Wartung. Generiert Client automatisch. Partial-Unique-Index via Raw-SQL-Migration. |
| Auth             | NextAuth.js (Auth.js v5) — Credentials Provider | Built-in Session-Handling, Middleware-Schutz für `/admin/*`. Ein einziger Admin-User reicht (Tom).        |
| Passwort-Hashing | bcrypt (cost 10)                           | Standard. ~100 ms/Versuch dient gleichzeitig als Brute-Force-Bremse.                                         |
| E-Mail           | Resend                                     | Kostenloser Tier (3.000 Mails/Monat), simple HTTP-API, keine SMTP-Konfiguration nötig.                      |
| Validierung      | Zod                                        | Schema-Validierung für API-Eingaben + Formulare. Single source of truth für FE/BE-Contracts.                |
| Forms            | React Hook Form + Zod Resolver             | Inline-Validierung ohne Page-Reload (US-04 AC2).                                                            |
| Rate-Limit       | **Upstash Redis (Free Tier)** + `@upstash/ratelimit` | Shared Counter über alle Vercel-Instanzen. 10.000 cmds/Tag reichen für MVP. Fallback siehe §5. |
| Hosting          | Vercel (Hobby Plan, kostenlos)             | Automatisches Deployment via Git-Push, integrierte Edge-Functions, kein Server-Management.                  |
| Domain           | Über Vercel oder externer Registrar         | Tom registriert eine Domain (z.B. baerenstark-hausservice.de) und verbindet sie via DNS mit Vercel.         |

### Warum nicht alternative Stacks?

- **Statisches HTML/CSS:** Reicht nicht, da US-04/05/06 dynamische Daten und Auth verlangen.
- **WordPress:** Mehr Wartungsaufwand (Plugin-Updates, Sicherheits-Patches) als Tom übernehmen kann.
- **Astro + Backend:** Zwei Codebasen, mehr Komplexität ohne Mehrwert für diese Größenordnung.
- **PostgreSQL:** Overkill für ein paar hundert Buchungen pro Jahr.

### Kosten

Der gesamte MVP läuft im **Free Tier**:

- Vercel Hobby: 0 €
- Turso Starter: 0 €
- Resend Free: 0 € (für ~10 Mails/Tag absolut ausreichend)
- Upstash Redis Free: 0 € (10.000 Commands/Tag)
- Domain: ~10 €/Jahr (einmaliger Ausgabenposten von Tom)

---

## 2. Projektstruktur

```
baerenstark/
├── ARCHITECTURE.md                    # Dieses Dokument
├── PROJECT.md                         # User Stories
├── README.md                          # Setup-Anleitung
├── contracts/                         # Verbindliche Specs (FE/BE-Vertrag)
│   ├── schema.prisma                  # Datenmodell (Prisma)
│   ├── schema.sql                     # SQL-Referenz
│   ├── api-routes.md                  # Endpoint-Spezifikation
│   └── zod-schemas.ts                 # Geteilte Validierungs-Schemas
├── images/
│   └── logo.png                       # Bärenstark-Logo
├── public/
│   ├── logo.png                       # Static-Asset (kopiert aus images/)
│   └── favicon.ico
├── prisma/
│   ├── schema.prisma                  # Live-Schema (sync mit contracts/)
│   ├── migrations/
│   │   └── <ts>_active_booking_per_slot/
│   │       └── migration.sql          # Raw-SQL: Partial Unique Index
│   └── seed.ts                        # NUR Beispiel-Slots in Dev — KEIN User
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root-Layout: Header + Footer
│   │   ├── page.tsx                   # Startseite (US-01, US-02)
│   │   ├── globals.css                # Tailwind + Custom Tokens
│   │   ├── buchung/
│   │   │   └── page.tsx               # Buchungsseite (US-03, US-04)
│   │   ├── impressum/
│   │   │   └── page.tsx               # Statisch (US-12)
│   │   ├── datenschutz/
│   │   │   └── page.tsx               # Statisch (US-12) — auch von Booking-Form verlinkt
│   │   ├── admin/
│   │   │   ├── layout.tsx             # Geschützt via Middleware
│   │   │   ├── setup/page.tsx         # Setup-Wizard (einmalig)
│   │   │   ├── login/page.tsx         # US-07
│   │   │   ├── page.tsx               # Dashboard (Übersicht)
│   │   │   ├── slots/page.tsx         # US-05: Zeitfenster
│   │   │   └── bookings/page.tsx      # US-06: Anfragen
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts   # NextAuth-Handler
│   │       ├── admin/setup/route.ts          # POST + GET (einmalig)
│   │       ├── slots/route.ts                # GET (public), POST (admin)
│   │       ├── slots/[id]/route.ts           # DELETE (admin, soft)
│   │       ├── bookings/route.ts             # GET (admin), POST (public)
│   │       ├── bookings/[id]/route.ts        # PATCH (admin: status)
│   │       └── bookings/[id]/resend-mail/route.ts  # POST (admin)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx             # US-02: Kontaktdaten + tel:-Link
│   │   ├── home/
│   │   │   ├── Hero.tsx
│   │   │   └── ServiceGrid.tsx        # US-01
│   │   ├── booking/
│   │   │   ├── SlotList.tsx           # US-03
│   │   │   └── BookingForm.tsx        # US-04 (mit DSGVO-Checkbox)
│   │   ├── admin/
│   │   │   ├── SlotForm.tsx
│   │   │   ├── SlotTable.tsx
│   │   │   ├── BookingTable.tsx       # mit Mail-Status-Markierung
│   │   │   └── ConfirmDialog.tsx      # Bestätigungs-Modal
│   │   └── ui/                        # Button, Input, Card, Badge, Skeleton, ...
│   ├── lib/
│   │   ├── prisma.ts                  # Prisma-Client-Singleton
│   │   ├── auth.ts                    # NextAuth-Konfiguration (mit redirect-Callback)
│   │   ├── mail.ts                    # Resend-Client + Templates + Retry-Logik
│   │   ├── ratelimit.ts               # Upstash-Wrapper
│   │   ├── schemas.ts                 # Re-export aus contracts/zod-schemas.ts
│   │   └── services.ts                # Service-Liste (statische Konstante)
│   ├── middleware.ts                  # Schützt /admin/*
│   └── types/
│       └── index.ts
├── .env.local                         # Lokale Secrets (NICHT committen)
├── .env.example                       # Template
├── next.config.js
├── tailwind.config.ts                 # Braun/Beige-Farbtokens
├── tsconfig.json
├── package.json
└── .gitignore
```

---

## 3. Datenmodell

Drei Tabellen reichen für den MVP. Schema-Definition als Prisma + SQL siehe `contracts/schema.prisma` und `contracts/schema.sql`.

### Tabelle: `User` (Admin)

| Feld          | Typ        | Constraints                  | Bemerkung                                 |
| ------------- | ---------- | ---------------------------- | ----------------------------------------- |
| `id`          | TEXT (cuid)| PK                           |                                           |
| `email`       | TEXT       | UNIQUE, NOT NULL             | Login-Identifikator                       |
| `passwordHash`| TEXT       | NOT NULL                     | bcrypt (cost factor 10)                   |
| `name`        | TEXT       | NOT NULL                     | Anzeigename (z.B. "Tom")                  |
| `createdAt`   | DATETIME   | DEFAULT now()                |                                           |

Anlage **ausschließlich** über Setup-Wizard `/admin/setup` (einmalig, nur wenn
`users` leer ist). Kein Seed mit Initial-Passwort, kein Insider-Risiko.

### Tabelle: `Slot` (Zeitfenster)

| Feld           | Typ        | Constraints                      | Bemerkung                                         |
| -------------- | ---------- | -------------------------------- | ------------------------------------------------- |
| `id`           | TEXT (cuid)| PK                               |                                                   |
| `startsAt`     | DATETIME   | NOT NULL, INDEX                  | Beginn (UTC)                                      |
| `endsAt`       | DATETIME   | NOT NULL                         | Ende (UTC)                                        |
| `description`  | TEXT       | NULL                             | Optional (US-05): "Vormittag", "ab 14 Uhr" etc.   |
| `createdAt`    | DATETIME   | DEFAULT now()                    |                                                   |
| `deletedAt`    | DATETIME   | NULL, INDEX                      | Soft-Delete: nicht NULL ⇒ unsichtbar in Listen.    |

**Indexe:**
- `Slot(startsAt)`
- `Slot(startsAt, endsAt)` — Composite für Range-Queries (BUG-015).
- `Slot(deletedAt)` — schnelles Filtern aktiver Slots.

**Belegt-Status (`isBooked`)** ist abgeleitet, nicht gespeichert:
> Ein Slot gilt als belegt, wenn mindestens eine Booking mit Status
> **`PENDING` oder `CONFIRMED`** darauf verweist (BUG-001).
> REJECTED-Bookings geben den Slot wieder frei.

### Tabelle: `Booking` (Buchungsanfrage)

| Feld             | Typ        | Constraints                             | Bemerkung                                            |
| ---------------- | ---------- | --------------------------------------- | ---------------------------------------------------- |
| `id`             | TEXT (cuid)| PK                                      |                                                      |
| `slotId`         | TEXT       | FK → Slot.id, ON DELETE RESTRICT, INDEX | Verknüpfung zum Zeitfenster                          |
| `customerName`   | TEXT       | NOT NULL                                | Pflichtfeld (US-04)                                  |
| `customerPhone`  | TEXT       | NOT NULL                                | Pflichtfeld; min. 6 Ziffern (BUG-010)                |
| `customerEmail`  | TEXT       | NULL                                    | **Optional, im MVP-Formular vorhanden** (BUG-009).    |
| `service`        | TEXT       | NOT NULL                                | Wert aus fester Service-Liste (siehe `lib/services.ts`) |
| `description`    | TEXT       | NOT NULL                                | Kurzbeschreibung (US-04)                             |
| `status`         | TEXT       | NOT NULL, DEFAULT 'PENDING'             | Enum: `PENDING` \| `CONFIRMED` \| `REJECTED`         |
| `mailSent`       | BOOLEAN    | NOT NULL, DEFAULT false                 | Resend-Versand erfolgreich? (BUG-002)                |
| `mailError`      | TEXT       | NULL                                    | Letzter Fehler (truncated 500 Z.) bei Versand.       |
| `createdAt`      | DATETIME   | DEFAULT now()                           |                                                      |
| `updatedAt`      | DATETIME   | UPDATE now()                            |                                                      |

**Indexe:**
- `Booking(slotId)`
- `Booking(status, createdAt DESC)` — für Admin-Listenansicht.
- **`UNIQUE INDEX uniq_active_booking_per_slot ON bookings(slot_id) WHERE status IN ('PENDING','CONFIRMED')`** — Partial Unique Index (BUG-006). Verhindert auf DB-Ebene, dass für denselben Slot mehrere aktive Bookings existieren. Verstoß → SQLITE_CONSTRAINT_UNIQUE → Handler übersetzt in HTTP 409 `CONFLICT`.

### Iteration-2-Erweiterungen am Booking-Modell (US-13/US-14)

| Feld                    | Typ        | Constraints                                       | Bemerkung                                                                                  |
| ----------------------- | ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `cancelToken`           | TEXT       | NOT NULL, UNIQUE, DEFAULT cuid()                  | Eindeutiger Aktions-Token für Kunden-Links (Storno, Counter-Proposal-Antwort). Lebenslang gültig pro Booking. |
| `counterProposalSlotId` | TEXT       | NULL, FK → Slot.id ON DELETE SET NULL, INDEX       | ID des vom Admin vorgeschlagenen Alternativ-Slots. NULL, solange kein Vorschlag aktiv.      |

**`customerEmail`**: war in v1.1 nullable und im UI optional — **ab Iteration 2
Pflichtfeld** im `CreateBookingSchema`. DB-seitig bleibt das Feld
`String?`/nullable, um Bestandsdaten ohne Migration zu handhaben. Der App-Layer
erzwingt Pflicht via Zod.

**Status-Werte (erweitert):** `PENDING | CONFIRMED | REJECTED | COUNTER_PROPOSED | CANCELLED`.

**Partial Unique Index (erweitert):**
```sql
DROP INDEX IF EXISTS uniq_active_booking_per_slot;
CREATE UNIQUE INDEX uniq_active_booking_per_slot
  ON bookings(slot_id)
  WHERE status IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED');
```

> **Wichtig zur Slot-Locking-Semantik bei Counter-Proposals:** Der Vorschlag
> sperrt **den ursprünglichen Slot** weiter (über die Booking selbst, deren
> `slotId` unverändert bleibt — die Booking ist im Status COUNTER_PROPOSED, was
> der Index als "aktiv" zählt). Der **vorgeschlagene** Slot
> (`counterProposalSlotId`) wird **nicht** zusätzlich gesperrt — er bleibt
> für andere Kunden buchbar, bis der Kunde den Vorschlag annimmt
> (Übergang zu CONFIRMED auf dem neuen Slot, Index-Check zur Annahme-Zeit).
>
> **Trade-off:** Nicht ideal — theoretisch könnte ein anderer Kunde den
> vorgeschlagenen Slot in der Zwischenzeit buchen, sodass die Annahme später
> mit 409 abgelehnt wird. **Mitigation für MVP:** Tom ist einziger Admin,
> Vorschläge sind selten, Race-Risiko niedrig. Bei Bedarf: separate
> `slot_holds`-Tabelle (Backlog).

### Tabelle: `WeeklyAvailability` (Iteration 2 — US-15)

| Feld         | Typ          | Constraints                              | Bemerkung                                            |
| ------------ | ------------ | ---------------------------------------- | ---------------------------------------------------- |
| `id`         | TEXT (cuid)  | PK                                       |                                                       |
| `dayOfWeek`  | INT          | NOT NULL, UNIQUE, CHECK 0–6              | 0 = Sonntag, 1 = Montag, …, 6 = Samstag (JS-Convention). |
| `isActive`   | BOOLEAN      | NOT NULL, DEFAULT false                  |                                                       |
| `updatedAt`  | DATETIME     | UPDATE now()                             |                                                       |

**Initial-Seed:** Migration legt 7 Datensätze an (alle 7 Wochentage,
`isActive: false`). Tom toggelt die gewünschten Tage selbst über
`PUT /api/availability` (Admin-UI unter `/admin/availability`).

### Service-Werte

Definiert in `src/lib/services.ts` als Konstante:

```ts
export const SERVICES = [
  'entruempelung',
  'entkernung',
  'reinigung',
  'gruenflaechenpflege',
  'muelltonnenservice',
  'entsorgung',
] as const;
```

Frontend zeigt deutsche Labels (mit Mapping in derselben Datei), gespeichert wird der ID-Slug. **Single Source of Truth** ist `lib/services.ts` — `zod-schemas.ts` re-exportiert nur die Liste.

---

## 4. API-Routen

Vollständige Spec inkl. Request/Response-Beispielen in `contracts/api-routes.md`. Hier die Übersicht:

| Methode | Pfad                                        | Auth      | Story  | Zweck                                              |
| ------- | ------------------------------------------- | --------- | ------ | -------------------------------------------------- |
| GET     | `/api/slots`                                | public    | US-03  | Verfügbare Slots (mit `isBooked`-Flag, Soft-Filter) |
| POST    | `/api/slots`                                | admin     | US-05  | Neuen Slot anlegen (mit Sanity-Checks + Overlap)    |
| DELETE  | `/api/slots/:id`                            | admin     | US-05  | Slot soft-löschen, PENDINGs auf REJECTED            |
| POST    | `/api/bookings`                             | public    | US-04, US-08 | Buchungsanfrage + Mail (mit Retry)            |
| GET     | `/api/bookings`                             | admin     | US-06  | Alle Anfragen (inkl. `mailSent`/`mailError`)        |
| PATCH   | `/api/bookings/:id`                         | admin     | US-06  | Status setzen (idempotent)                          |
| POST    | `/api/bookings/:id/resend-mail`             | admin     | US-08  | Mail-Versand erneut anstoßen                        |
| POST    | `/api/auth/callback/credentials`            | public    | US-07  | Login (NextAuth)                                    |
| POST    | `/api/auth/signout`                         | public    | US-07  | Logout (NextAuth)                                   |
| GET     | `/api/admin/setup`                          | public    | Setup  | Verfügbarkeits-Check                                |
| POST    | `/api/admin/setup`                          | public    | Setup  | Initial-User anlegen (einmalig)                     |
| POST    | `/api/bookings/:id/counter-proposal`        | admin     | US-13  | Alternativtermin vorschlagen (Iteration 2)          |
| GET     | `/api/bookings/respond?token=...&action=...` | public   | US-13/14 | Kunde nimmt an oder storniert (Token-basiert)     |
| POST    | `/api/bookings/rebook`                      | public    | US-13  | Kunde wählt neuen Slot (Token-basiert)              |
| GET     | `/api/availability`                         | public    | US-15/16 | Wochentag-Konfiguration                            |
| PUT     | `/api/availability`                         | admin     | US-15  | Wochentag-Konfiguration aktualisieren                |
| GET     | `/api/calendar?year=YYYY&month=M`           | public    | US-16  | Kalender-Daten pro Tag (verfügbar/blockiert)        |

### Konventionen (verbindlich)

- **Transport:** HTTPS, JSON.
- **Content-Type:** `application/json` für alle Bodies.
- **Datumsformat:** ISO 8601 mit Offset (z.B. `2026-05-15T08:00:00.000Z` oder `2026-05-15T10:00:00+02:00`). Backend normalisiert in UTC und liefert immer UTC mit `Z`-Suffix zurück. Frontend rendert in lokaler Zeit (Europe/Berlin).
- **IDs:** `cuid` (Strings), niemals raten oder konstruieren.
- **Fehlerformat:**
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Name ist ein Pflichtfeld", "field": "customerName" } }
  ```
  Codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `OVERLAP`, `GONE`, `RATE_LIMITED`, `MAIL_FAILED`, `INTERNAL_ERROR`.
- **Status-Codes:** 200, 201, 204, 302, 400, 401, 403, 404, 409, 410, 429, 500, 502.
- **Pagination:** Im MVP nicht erforderlich (erwartete Mengen <100). Ab >100 Bookings als Tech-Debt nachrüsten.
- **Rate-Limit-Header:** `Retry-After` bei 429 gesetzt.
- **Caching:** Schreib-Endpunkte invalidieren Next-Tag `slots`. Lese-Endpunkte
  setzen `Cache-Control: no-store`.

---

## 5. Authentifizierung & Autorisierung

### Mechanismus: NextAuth.js mit Credentials Provider

- Login auf `/admin/login` → POST an `/api/auth/callback/credentials`.
- Bei Erfolg setzt NextAuth ein **HttpOnly-Session-Cookie** (`next-auth.session-token`).
- Strategie: **JWT-Sessions** (kein DB-Lookup pro Request, leichtgewichtig).
- Session-Lifetime: **24 Stunden**, sliding refresh.

### Schutz von Routen

- **Edge Middleware** (`src/middleware.ts`) matcht `/admin/:path*` (außer `/admin/login` und `/admin/setup`) und `/api/(slots|bookings)` mit Methoden `POST/PATCH/DELETE` ausgenommen `POST /api/bookings`.
- Ohne gültige Session → 302 Redirect auf `/admin/login` (für UI) bzw. 401 JSON (für API).

### `callbackUrl` — Open-Redirect-Schutz (BUG-005)

NextAuth's `callbacks.redirect` (in `src/lib/auth.ts`) **muss** wie folgt
implementiert werden:

```ts
// src/lib/auth.ts (NextAuth-Konfiguration)
callbacks: {
  async redirect({ url, baseUrl }) {
    // 1. Relative Pfade (beginnend mit "/") sind erlaubt.
    if (url.startsWith('/')) return `${baseUrl}${url}`;

    // 2. Absolute URLs nur, wenn sie auf dieselbe Origin zeigen.
    try {
      const target = new URL(url);
      if (target.origin === baseUrl) return target.toString();
    } catch {
      // Ungültige URL → fall through
    }

    // 3. Alles andere (externe Domains, nicht parsbare Werte) → /admin.
    return `${baseUrl}/admin`;
  },
},
```

Damit wird ein Angreifer-Link wie
`https://baerenstark-hausservice.de/admin/login?callbackUrl=https://evil.com/phish`
auf `/admin` umgeleitet — keine externe Weiterleitung möglich.

### Sicherheits-Praktiken

- Passwörter via bcrypt (cost 10) — niemals plaintext speichern.
- Login-Fehler: generische Meldung ("E-Mail oder Passwort falsch") — keine Auskunft, ob E-Mail existiert (US-07 AC2).
- **Rate-Limiting** (BUG-004):
  - **Empfohlen (Production):** Upstash Redis Free Tier + `@upstash/ratelimit`.
    Ein Counter pro IP, shared über alle Vercel-Funktionen.
    - Login: 5 Versuche / 15 min.
    - Booking: 10 Anfragen / 60 min.
  - **Implementation-Hinweis für Engineers:**
    ```ts
    // src/lib/ratelimit.ts
    import { Ratelimit } from '@upstash/ratelimit';
    import { Redis } from '@upstash/redis';

    export const loginLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      analytics: false,
      prefix: 'rl:login',
    });

    export const bookingLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '60 m'),
      prefix: 'rl:booking',
    });
    ```
    ENV-Variablen: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
  - **Fallback (lokal/dev oder fehlende Upstash-Konfiguration):** Kein
    serverseitiges Rate-Limit. Bcrypt-cost-10 (~100 ms/Versuch) wirkt als
    natürliche Brute-Force-Bremse. Restrisiko ist akzeptabel, weil:
    - Genau ein Admin-User existiert.
    - Der Setup-Wizard erzwingt mindestens 12 Zeichen Passwort.
    - In-Memory-Maps wären in Vercel serverless ohnehin wirkungslos
      (mehrere Instanzen, eigener Speicher).
  - **Ehrliche Doku:** Sollte Upstash später ausfallen, ist das System weiterhin
    nutzbar — nur ohne wirksames Rate-Limit. Diese Eigenschaft wird in den
    Engineering-Notes vermerkt.
- CSRF: NextAuth handhabt das automatisch via Token.
- HTTPS-only: Cookie-Flag `Secure` in Production.
- **Security-Headers (BUG-017, leichtgewichtig):**
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - CSP minimal: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'`
  - Konfiguration via `next.config.js` `headers()`.

### Initial-Setup für Tom — Setup-Wizard (kein ENV-Seed)

**Ablauf:**
1. Beim ersten Aufruf von `/admin/login` prüft die Login-Seite per `GET /api/admin/setup`, ob die `users`-Tabelle leer ist. Wenn ja → Redirect auf `/admin/setup`.
2. Tom füllt das Setup-Formular aus (E-Mail, Name, Passwort, Passwort-Bestätigung).
3. `POST /api/admin/setup` legt den User an. Greift nur, solange die Tabelle leer ist; danach 409 `CONFLICT`.
4. Anschließend wird Tom direkt eingeloggt und auf `/admin` weitergeleitet.

**Vorteile:**
- Kein Engineer kennt jemals das Initial-Passwort.
- Kein `SEED_ADMIN_PASSWORD`-ENV-Geheimnis im Vercel-Dashboard.
- Setup ist im Browser machbar — kein CLI-Zugang nötig.

**Risiko:** Wer als Erster `/admin/setup` aufruft, wird Admin. Mitigation: Tom
ruft die Seite direkt nach dem Deploy auf (im selben Browser-Tab, in dem er
die Domain getestet hat). Die Setup-Seite ist sonst nicht öffentlich verlinkt,
und Suchmaschinen werden via `robots.txt` ferngehalten.

Passwort-Reset im MVP: manuell via Prisma Studio oder Turso-Dashboard. Self-Service-Reset ist Backlog.

---

## 6. E-Mail-Versand (US-08, US-13, US-14)

- E-Mail-Templates (Plaintext + HTML) liegen in `src/lib/mail.ts`. Inhalt: Name,
  Telefon, E-Mail, Service, Zeitfenster (DE-formatiert via
  `Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'full', timeStyle: 'short' })`),
  Beschreibung, Aktions-Links (siehe Iteration 2).
- Absender-Adresse: `noreply@<deine-domain>` (DNS-verified bei Resend) oder im ersten Schritt `onboarding@resend.dev`.
- Empfänger Tom: `MAIL_TO_ADMIN` (Default `hausservice-baerenstark@outlook.com`).
- Empfänger Kunde: `customerEmail` aus dem Booking (Iteration 2 ist es Pflicht).

### Iteration-2-Mail-Templates

| Template-Key                | Trigger                                                              | Empfänger | Wesentliche Inhalte                                                                                          |
| --------------------------- | -------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `bookingNotificationToAdmin` | `POST /api/bookings` (US-08)                                        | Tom       | Name/Telefon/Mail/Service/Termin/Beschreibung + Link `/admin/bookings`.                                      |
| `bookingReceiptToCustomer`   | `POST /api/bookings` (US-04 / Iteration 2)                          | Kunde     | "Ihre Anfrage ist eingegangen", Termin, Service, Storno-Link `/api/bookings/respond?token=…&action=cancel`.  |
| `counterProposalToCustomer`  | `POST /api/bookings/:id/counter-proposal` (US-13 AC1)               | Kunde     | "Tom schlägt einen anderen Termin vor", neuer Termin, drei Aktionslinks (Annehmen / Neu wählen / Stornieren). |
| `counterAcceptedToAdmin`     | `GET /api/bookings/respond?action=accept` (US-13 AC3)               | Tom       | "Kunde hat den Alternativvorschlag angenommen", Termin, Kontaktdaten.                                        |
| `rebookingToAdmin`           | `POST /api/bookings/rebook` (US-13 AC4)                             | Tom       | "Kunde hat einen neuen Termin gewählt", neuer Termin, Kontaktdaten.                                          |
| `cancellationToAdmin`        | `GET /api/bookings/respond?action=cancel` (US-14 AC2)               | Tom       | "Kunde hat die Anfrage storniert", ursprünglicher Termin, Kontaktdaten, Service.                             |

**Aktionslink-Struktur (verbindlich):**

```
${BASE_URL}/api/bookings/respond?token=${cancelToken}&action=accept
${BASE_URL}/api/bookings/respond?token=${cancelToken}&action=cancel
${BASE_URL}/buchung?rebookToken=${cancelToken}
```

Wo `BASE_URL` aus `NEXT_PUBLIC_BASE_URL` (Fallback `NEXTAUTH_URL`) gelesen wird.
Engineers: einen einzigen Helfer `actionUrl(token, action)` in `src/lib/mail.ts`
zentral anlegen — keine ad-hoc-String-Konkatenation in Templates.

### Reliability-Strategie (BUG-002 + BUG US-04 Fix 1)

**Iteration 2 — Fire-and-forget Mail-Dispatch:**

```ts
// src/app/api/bookings/route.ts (POST, vereinfacht)
const booking = await prisma.booking.create({ ... });

void runMailDispatch(booking.id, payload).catch((err) =>
  console.error('[mail-dispatch] unexpected error', err),
);

return apiSuccess({ id: booking.id, status, createdAt }, 201);
```

```ts
// src/lib/mail.ts
export async function runMailDispatch(
  bookingId: string,
  payload: BookingMailPayload,
): Promise<void> {
  // 1. Mail an Tom (US-08)
  const adminResult = await sendBookingNotificationToAdmin(payload).catch(
    (err) => ({ ok: false as const, error: String(err).slice(0, 500) }),
  );

  // 2. Eingangsbestätigung an Kunden (Iteration 2)
  await sendBookingReceiptToCustomer(payload).catch((err) =>
    console.warn('[mail] customer receipt failed', err),
  );

  // 3. Booking-Datensatz mit Mail-Status updaten (Sichtbarkeit für Admin).
  await prisma.booking
    .update({
      where: { id: bookingId },
      data: {
        mailSent: adminResult.ok,
        mailError: adminResult.ok ? null : adminResult.error.slice(0, 500),
      },
    })
    .catch((err) => console.error('[mail] db-update failed', err));
}
```

**Eigenschaften:**
- Booking-201 wird an Kunden geliefert, **bevor** Mail-Versuch beginnt → kein
  Bug-US-04-Symptom mehr (Booking ist in DB sichtbar, auch wenn Mail crasht).
- Beide Mails (Tom + Kunde) werden nacheinander versucht. Tom-Mail bestimmt
  `mailSent`/`mailError`-Felder (Admin-Dashboard nutzt das als Indikator).
  Kunden-Receipt ist „nice to have" und schreibt nur ins Log.
- Retry-Logik (3 Versuche, Backoff 0/300/1500 ms) bleibt **innerhalb** jedes
  einzelnen Mail-Sends bestehen.
- **Vercel-Hinweis:** Auf Vercel Functions wird die Function nach Response
  möglicherweise terminiert. Engineers: `unstable_after` aus `next/server`
  (Next.js 14.2+) verwenden — andernfalls reicht der MVP-Trade-off
  (Function läuft i.d.R. noch ein paar 100 ms weiter, was für einen
  Resend-Roundtrip ausreicht).

**Sichtbarkeit für Tom (unverändert):**
- Admin-Dashboard listet Bookings mit `mailSent === false` rot, mit
  Resend-Button.
- Bei Counter-Proposal-Mail-Fehlern (US-13): das Admin-UI zeigt den
  Counter-Proposal-Status weiter an und bietet einen "Vorschlag neu
  versenden"-Button (über `POST /api/bookings/:id/resend-mail` — der Endpoint
  unterscheidet selbst, welche Mail je nach aktuellem Status fällig ist).

**Begründung gegen Outbox-Pattern für MVP:** unverändert (siehe v1.1).

### Reliability-Strategie (BUG-002)

**Retry im Request-Handler (kein Outbox-Pattern für MVP):**

```ts
// src/lib/mail.ts (Pseudocode für Engineers)
async function sendWithRetry(payload, maxAttempts = 3): Promise<MailResult> {
  const delays = [0, 300, 1500]; // ms
  let lastError: Error | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    if (delays[i] > 0) await sleep(delays[i]);
    try {
      await resend.emails.send(payload);
      return { ok: true };
    } catch (err) {
      lastError = err;
    }
  }
  return { ok: false, error: String(lastError).slice(0, 500) };
}
```

Der `POST /api/bookings`-Handler:
1. Persistiert die Buchung (Status PENDING).
2. Triggert `sendWithRetry()` (max. ~4 Sekunden Gesamt-Timeout).
3. Updated `mailSent` und `mailError` am Booking entsprechend.
4. Antwortet dem Kunden mit 201 — unabhängig vom Mail-Ergebnis.

**Sichtbarkeit für Tom:**
- Admin-Dashboard listet Bookings mit `mailSent === false` mit einem **roten Indikator** (Badge "Mail nicht zugestellt") und einem **„Mail erneut senden"-Button**, der `POST /api/bookings/:id/resend-mail` aufruft.
- Eine Zeile mit `mailSent === false` UND `status === 'PENDING'` älter als 1 Stunde wird zusätzlich als „dringend" markiert.

**Begründung gegen Outbox-Pattern für MVP:**
- 1 Admin, ~10 Mails/Tag, Resend SLA 99,9 %.
- Outbox + Cron erhöht Komplexität (+1 Tabelle, +1 Vercel-Cron-Job).
- Retry-im-Handler + sichtbarer Mail-Status im Dashboard liefert eine
  ausreichende Recovery-UX (Tom sieht den Fehlversand und kann mit einem
  Klick neu auslösen).
- Outbox bleibt als Backlog-Story dokumentiert, falls Volumen steigt.

---

## 7. Deployment

### Empfohlener Workflow

1. Code im GitHub-Repo `baerenstark-website`.
2. Vercel-Account mit GitHub verbinden, Repo importieren.
3. Upstash-Redis-Datenbank in der Free-Tier-Region nahe Vercel-Region erstellen.
4. ENV-Variablen im Vercel-Dashboard hinterlegen (siehe §8).
5. Push auf `main` → automatischer Build & Deploy. Prisma-Migrate läuft als Build-Step (`prisma migrate deploy`), inkl. der Raw-SQL-Migration für den Partial Unique Index.
6. Domain in Vercel-Settings hinzufügen, DNS umbiegen.
7. **Setup-Wizard:** Tom öffnet `/admin/setup` und legt sein Passwort fest.

### Branching

- `main` = Production.
- Feature-Branches → Pull Request → Vercel erzeugt automatisch Preview-Deployments für QA.

### Monitoring (kostenlos)

- Vercel-Logs (eingebaut) genügen für MVP.
- Mail-Reliability-Monitoring: Admin-Dashboard ist die primäre Sichtbarkeit (siehe §6).
- Optional später: Sentry Free Tier für Frontend-Fehler.

### Backups

Turso Free Tier bietet Point-in-Time-Recovery für die letzten 24 Stunden.
Manueller Export-Befehl: `turso db dump <db-name> > backup.sql` — empfohlen
einmal/Woche von Tom über Turso-CLI oder via einfachem Vercel-Cron.

---

## 8. Umgebungsvariablen

Alle in `.env.local` (lokal) und Vercel-Dashboard (Production) zu setzen.

| Variable                       | Pflicht | Wert / Beispiel                                      | Zweck                                       |
| ------------------------------ | ------- | ---------------------------------------------------- | ------------------------------------------- |
| `DATABASE_URL`                 | ja      | `libsql://baerenstark-...turso.io?authToken=...`     | Turso-Connection-String                     |
| `DIRECT_DATABASE_URL`          | ja      | gleiche URL ohne Pooling                             | Für Prisma-Migrations                       |
| `NEXTAUTH_URL`                 | ja      | `https://baerenstark-hausservice.de`                 | Basis-URL für NextAuth                      |
| `NEXTAUTH_SECRET`              | ja      | 32+ Zeichen Zufallsstring (`openssl rand -base64 32`)| JWT-Signaturschlüssel                       |
| `RESEND_API_KEY`               | ja      | `re_xxxxxxxxxxxx`                                    | Resend-API-Auth                             |
| `MAIL_FROM`                    | ja      | `noreply@baerenstark-hausservice.de`                 | Absender-Adresse                            |
| `MAIL_TO_ADMIN`                | ja      | `hausservice-baerenstark@outlook.com`                | Empfänger der Buchungs-Mails (US-08)        |
| `UPSTASH_REDIS_REST_URL`       | empfohlen | `https://...upstash.io`                            | Rate-Limit-Store (siehe §5)                 |
| `UPSTASH_REDIS_REST_TOKEN`     | empfohlen | `AX...`                                            | Rate-Limit-Auth                              |
| `NEXT_PUBLIC_BASE_URL`         | empfohlen | `https://baerenstark-hausservice.de`               | Iteration 2: Public Base-URL für Mail-Aktionslinks. Fallback auf `NEXTAUTH_URL`. |

**Entfernt** gegenüber v1.0: `SEED_ADMIN_EMAIL` und `SEED_ADMIN_PASSWORD`.
Stattdessen wird `/admin/setup` verwendet.

`.env.example` wird ohne Werte ins Repo committet als Vorlage.

---

## 9. Frontend-Design-Konventionen

### Farbtokens (Tailwind, in `tailwind.config.ts`)

```ts
colors: {
  baerenstark: {
    bark:   '#3D2B1F',  // dunkelbraun, primary text
    wood:   '#7B5E3C',  // mittelbraun, primary action
    cream:  '#F5EBDD',  // beige hell, page background
    sand:   '#D9C2A2',  // beige mittel, cards/sections
    forest: '#4A5D3A',  // grün-akzent (Grünflächenpflege)
    accent: '#C8A064',  // honiggelb, CTAs / Hover
  }
}
```

### Typografie

- Headings: `font-serif` (z.B. Merriweather oder system-serif).
- Body: `font-sans` (Inter oder system-ui).

### Breakpoints (Tailwind-Default)

- Mobile-first: Basis-Styles für `<640px`.
- `sm:` ≥640, `md:` ≥768, `lg:` ≥1024, `xl:` ≥1280.

### Mobile-Layout für ServiceGrid (US-01 AC2)

- `<640px`: 1 Spalte (`grid-cols-1`), Cards full-width mit 16 px Padding.
- `≥640px`: 2 Spalten.
- `≥1024px`: 3 Spalten.

### Accessibility (WCAG 2.1 AA)

- Alle Interaktiv-Elemente mit klarem Fokus-Ring (Tailwind `focus-visible:ring-2 ring-offset-2 ring-baerenstark-accent`).
- Telefon im Footer als `<a href="tel:+4915774787512">` (US-02 AC2).
- Formular-Labels immer sichtbar, nicht nur als Placeholder.
- Form-Errors als `<p id="..." role="alert">` mit `aria-describedby` am Input.
- Toast-Bestätigungen (US-04) in einer ARIA-Live-Region (`role="status"`, `aria-live="polite"`).
- Kontrast-Targets (zu verifizieren mit Axe oder Stark während Implementation):
  - `bark` (#3D2B1F) auf `cream` (#F5EBDD) → ≥7:1 (Headings).
  - `wood` (#7B5E3C) auf `cream` → ≥4.5:1 (Body, Buttons).
  - Falls Kombination unter AA fällt: Token anpassen (Variante `wood-dark`).

---

## 10. UI-States pro Page (BUG-012)

Jede dynamische Page hat dokumentierte Loading-, Error-, Empty- und Conflict-States. Frontend-Engineer setzt sie 1:1 um.

### `/buchung` (öffentliche Buchungsseite — US-03/US-04)

| State        | Trigger                                                | UI                                                                                                              |
| ------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Loading      | `GET /api/slots` läuft                                 | 3 Skeleton-Cards in der `SlotList`. BookingForm bleibt versteckt.                                                |
| Empty        | Response 200 mit leerer `data`                          | Hinweisbox: „Aktuell sind keine Termine freigeschaltet. Bitte rufen Sie uns direkt an." + tel:-Link prominent.   |
| Error        | `GET /api/slots` schlägt fehl (Netz, 5xx)               | Banner: „Termine konnten nicht geladen werden." + Retry-Button + sichtbarer tel:-Fallback.                       |
| Idle/Success | Slots geladen, keiner ausgewählt                        | Slot-Cards anzeigen. BookingForm noch ausgegraut/disabled bis Slot gewählt.                                       |
| Submitting   | `POST /api/bookings` läuft                              | Submit-Button disabled mit Spinner; alle Form-Inputs schreibgeschützt; `aria-busy="true"` auf Form.              |
| Conflict     | `POST /api/bookings` → 409 `CONFLICT`                   | Inline-Banner über Form: „Dieser Termin wurde gerade vergeben. Bitte einen anderen wählen." Slot wird in der Liste sofort als belegt markiert (lokales Re-Fetch). |
| RateLimited  | `POST /api/bookings` → 429 `RATE_LIMITED`               | Hinweis: „Sie haben zu viele Anfragen gesendet. Bitte später erneut versuchen." (mit `Retry-After`-Anzeige).      |
| Success      | `POST /api/bookings` → 201                              | Toast (`role="status"`) „Anfrage erfolgreich gesendet — Tom meldet sich zeitnah." Form zurückgesetzt, Slot-Liste neu geladen. |
| ValidationErr| Zod-Fehler (clientseitig oder 400 vom BE)               | Inline-Fehler unter dem betroffenen Feld; Fokus springt zum ersten ungültigen Feld.                              |

### `/admin` und `/admin/bookings` (US-06)

| State        | Trigger                                                | UI                                                                                                                                                            |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading      | `GET /api/bookings` läuft                               | Tabellen-Skeleton (5 Zeilen).                                                                                                                                 |
| Empty        | Response 200 mit leerer `data`                          | Hinweis: „Noch keine Anfragen."                                                                                                                                |
| Error        | 5xx                                                    | Banner mit Retry-Button.                                                                                                                                      |
| MailFailed   | Booking mit `mailSent === false`                        | Zeile farblich hervorgehoben (rot/orange-Badge „Mail nicht zugestellt"); Tooltip mit `mailError`; Aktion „Mail erneut senden" → `POST /api/bookings/:id/resend-mail`. |
| StatusUpdate | `PATCH /api/bookings/:id` läuft                         | Aktions-Button disabled mit Spinner.                                                                                                                          |
| Conflict     | `PATCH` → 409 (REJECTED → CONFIRMED bei aktivem Slot)   | Toast: „Dieser Slot ist inzwischen anderweitig vergeben." Liste neu laden.                                                                                    |
| ConfirmDialog| Tom klickt „Bestätigen" oder „Ablehnen"                  | Modal „Anfrage von Maria Müller wirklich bestätigen?" mit Cancel/OK (BUG-016). Verhindert versehentliches Doppel-Klick-Update.                                |

### `/admin/slots` (US-05)

| State        | Trigger                                                | UI                                                                                                                       |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Loading      | `GET /api/slots` läuft                                  | Tabellen-Skeleton.                                                                                                       |
| Empty        | Keine Slots                                             | Hinweis: „Noch keine Zeitfenster angelegt." + Großer „Neuen Slot anlegen"-Button.                                         |
| Submitting   | `POST /api/slots` läuft                                 | Submit-Button disabled mit Spinner.                                                                                      |
| Overlap      | `POST` → 409 `OVERLAP`                                  | Inline-Banner: „Dieses Zeitfenster überschneidet sich mit einem bestehenden. Bitte Zeit anpassen."                         |
| ValidationErr| Zod / 400                                              | Inline-Fehler unter Feldern.                                                                                             |
| DeleteConfirm| Tom klickt Löschen                                      | Modal: „Slot wirklich löschen? Offene Anfragen werden automatisch abgelehnt." (BUG-016).                                  |
| DeleteConflict| `DELETE` → 409 (CONFIRMED-Buchungen)                   | Modal: „Dieser Slot hat bestätigte Buchungen. Erst die Bestätigung zurückziehen?" → Aktion „Bestätigung zurückziehen + Löschen". |

### `/admin/login` und `/admin/setup` (US-07)

| State        | Trigger                                                | UI                                                                                                              |
| ------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Setup-Check  | `/admin/login` lädt → `GET /api/admin/setup`            | Spinner, dann Redirect auf `/admin/setup` falls `available: true`.                                              |
| Submitting   | Login oder Setup-POST läuft                             | Button disabled mit Spinner.                                                                                    |
| AuthError    | NextAuth-Redirect mit `?error=CredentialsSignin`        | Banner: „E-Mail oder Passwort falsch." (generisch).                                                              |
| RateLimited  | `?error=RateLimited`                                    | Banner: „Zu viele Anmelde-Versuche. Bitte 15 Minuten warten."                                                    |
| SetupClosed  | Setup-Aufruf nach bereits angelegtem User → 409          | Hinweis: „Setup wurde bereits abgeschlossen." mit Link auf `/admin/login`.                                        |

---

## 11. DSGVO / Legal

### Datenschutz-Hinweis im Buchungsformular (US-04)

- Direkt unter dem Submit-Button: Pflicht-Checkbox „Ich habe die [Datenschutzerklärung](/datenschutz) gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung der Anfrage zu." (`privacyAccepted: true`).
- Frontend lehnt das Submit ohne Häkchen ab. Backend validiert dasselbe via Zod (`privacyAccepted: z.literal(true)`).
- Das Häkchen wird **nicht** in der DB persistiert — die Bestätigung ergibt sich aus dem Vorhandensein des Booking-Datensatzes.

### Aufbewahrungsfristen

- **Bookings:** 2 Jahre nach `createdAt`. Danach werden sie via einfachem Vercel-Cron (1× pro Monat) aus der DB gelöscht. Die Cleanup-Logik ist nicht im MVP — bis dahin: manueller Export + Löschung.
- **Slots:** unbegrenzt (auch soft-deleted). Slots enthalten keine personenbezogenen Daten.
- **User:** unbegrenzt, einzelner Admin-Account.

### Datenschutzerklärung-Inhalte (Backlog: Tom liefert finalen Text)

- Was wird erhoben (Name, Telefon, optional E-Mail, Beschreibung).
- Zweck (Bearbeitung der Anfrage).
- Rechtsgrundlage (Art. 6 Abs. 1 lit. b DSGVO).
- Speicherdauer (2 Jahre).
- Auftragsverarbeiter: Resend (Mail), Turso (DB), Vercel (Hosting), Upstash (Rate-Limit).
- Rechte der Betroffenen (Auskunft, Berichtigung, Löschung, Beschwerde).

### `robots.txt`

- `/admin/*` und `/api/*` sind disallowed.
- Standard-Sitemap mit nur öffentlichen Pages: `/`, `/buchung`, `/impressum`, `/datenschutz`.

---

## 12. Akzeptanzkriterien-Mapping (Sanity-Check)

| Story | Erfüllt durch                                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| US-01 | `app/page.tsx` + `components/home/ServiceGrid.tsx` + statische Service-Liste in `lib/services.ts`. Mobile-Grid 1/2/3-Spalten siehe §9.        |
| US-02 | `components/layout/Footer.tsx` mit `tel:`-Link, E-Mail und Standort.                                                                          |
| US-03 | `app/buchung/page.tsx` ruft `GET /api/slots`, rendert via `SlotList.tsx` mit `isBooked`-Flag (PENDING+CONFIRMED). Loading/Empty/Error siehe §10. |
| US-04 | `BookingForm.tsx` (React Hook Form + Zod) → `POST /api/bookings`, Inline-Validierung, DSGVO-Checkbox, Bestätigungs-Toast.                     |
| US-05 | `app/admin/slots/page.tsx` → `POST /api/slots` (mit Sanity-Checks) und `DELETE /api/slots/:id` (Soft-Delete).                                  |
| US-06 | `app/admin/bookings/page.tsx` → `GET /api/bookings`, Status-Buttons → `PATCH /api/bookings/:id`, Mail-Status-Anzeige + Resend-Action.         |
| US-07 | `app/admin/login/page.tsx` + `middleware.ts` + NextAuth Credentials Provider mit Redirect-Validierung. Setup über `/admin/setup`.            |
| US-08 | Innerhalb `POST /api/bookings`: `lib/mail.ts.sendWithRetry()` an `MAIL_TO_ADMIN`; Mail-Status persistiert; Admin-Dashboard zeigt Fehlversände. |
| US-12 | Statische `app/impressum/page.tsx` + `app/datenschutz/page.tsx` mit Footer-Links.                                                              |
| US-13 | `components/admin/CounterProposalDialog.tsx` → `POST /api/bookings/:id/counter-proposal`. Mail-Templates `counterProposalToCustomer`, `counterAcceptedToAdmin`, `rebookingToAdmin`. Endpunkte `GET /api/bookings/respond`, `POST /api/bookings/rebook`. Re-Booking-Flow in `app/buchung/BookingClient.tsx` (`?rebookToken=`). Siehe §15.   |
| US-14 | `cancelToken` (Booking) + `GET /api/bookings/respond?action=cancel` + Mail-Template `cancellationToAdmin`. Öffentliche Bestätigungsseite `app/buchung/storno/page.tsx`. Storno-Link in jeder Kunden-Mail. Siehe §15.    |
| US-15 | `WeeklyAvailability`-Modell + `app/admin/availability/page.tsx` → `PUT /api/availability`. Confirmierte Buchungen werden als Blocker im Admin-UI angezeigt. Siehe §15.                                                       |
| US-16 | `app/buchung/page.tsx` rendert `components/booking/Calendar.tsx` mit Daten aus `GET /api/calendar?year=YYYY&month=M`. Klick auf grünen Tag triggert Slot-Auswahl. Touch-freundlich, mobile-first. Siehe §15.            |

---

## 13. Offene Punkte / Annahmen

- **Annahme (Iteration 2):** `customerEmail` ist im Buchungsformular ab sofort
  Pflichtfeld. Kunden ohne E-Mail nutzen den prominent platzierten tel:-Link.
  Diese Entscheidung vereinfacht US-13/US-14 (keine zwei Code-Pfade) und ist
  vom Sub-Agent dokumentiert; Tom darf sie revidieren — siehe „Offene
  Entscheidungen" unten.
- **Annahme (Iteration 2):** Counter-Proposal-Slot wird nicht hart gesperrt
  (Trade-off in §3 dokumentiert). Im MVP akzeptabel, da Tom einziger Admin
  ist und Vorschläge selten sind.
- **Annahme (Iteration 2):** `GET /api/bookings/respond` ist ein GET-Endpoint
  trotz Zustandsänderung. Begründung: E-Mail-Klick muss ohne Browser-JS
  funktionieren. Idempotenz wird über Status-Check (Token verbraucht → 410)
  garantiert.
- **Annahme:** Tom liefert Impressum-/Datenschutz-Texte als Fließtext.
- **Annahme:** Eine Domain ist verfügbar oder Tom registriert sie. Bis dahin läuft die Site auf `*.vercel.app`.
- **Annahme:** Resend-Domain wird einmalig DNS-verifiziert; bis dahin nutzen wir `onboarding@resend.dev` als Absender. **Hinweis Iteration 2:** Mit `onboarding@resend.dev` als Absender erlaubt Resend nur Mail-Versand an die Resend-Account-E-Mail. Für US-13/US-14 (Mail an beliebige Kunden) ist eine DNS-verifizierte Absender-Domain Pflicht.
- **Annahme:** Single-Admin-Setup (kein User-Management-UI im MVP).
- **Annahme:** Tom ruft direkt nach dem ersten Deploy `/admin/setup` auf und legt sein Passwort fest, bevor jemand anderes die Seite findet.
- **Annahme:** Upstash Redis Free Tier wird konfiguriert. Falls bewusst nicht: Engineers dokumentieren das im Deployment-Log; Login-Bremse durch bcrypt-cost-10.

### Offene Entscheidungen (für Tom / Orchestrator)

- [NEEDS INPUT] **DNS-verifizierte Absender-Domain für Resend.** Wenn die
  Domain `baerenstark-hausservice.de` (oder ähnlich) noch nicht bei Resend
  verifiziert ist, kann Iteration 2 nicht produktiv gehen — Mails an Kunden
  werden sonst von Resend abgewiesen. Tom muss DNS-Records (DKIM, SPF) bei
  seinem Registrar setzen. Engineers liefern die Records.
- [NEEDS INPUT] **`customerEmail` als Pflichtfeld?** Empfehlung: ja (siehe
  Annahmen oben). Falls Tom das nicht will, müsste die State-Machine zwei
  Pfade kennen (mit/ohne E-Mail), was den Iteration-2-Scope verdoppelt —
  Empfehlung: gegen US-11 verschoben, hier konsequent Pflicht.
- [NEEDS INPUT] **Geltungsbereich „Gegenvorschlag annehmen"-Mail an Tom.**
  Soll Tom auch eine SMS-/Slack-Notification erhalten, oder reicht E-Mail?
  Aktuell: nur E-Mail.

### Backlog (nicht im MVP):

- Bestätigungs-Mail an Kunden (US-11) — **wird durch Iteration 2 teilweise
  umgesetzt**: `bookingReceiptToCustomer` ist bereits Teil der Iteration-2-
  Mail-Templates.
- Outbox-Pattern für E-Mail-Versand (sobald Volumen >50/Tag).
- Self-Service-Passwort-Reset.
- Pagination für `GET /api/bookings` (ab >100 Datensätzen).
- Local-SEO (OG-Tags, Sitemap, Google-Business-Profile).
- Auto-Cleanup-Cron für Bookings älter als 2 Jahre.
- Instagram-Feed (US-09), Bewertungen (US-10).
- Hard-Lock auf vorgeschlagenen Slot bei Counter-Proposal (`slot_holds`-Tabelle).
- SMS-Benachrichtigung an Tom (parallel zu E-Mail).

---

## 14. UI-States für Iteration-2-Pages

(Ergänzt §10 — bestehende Pages bleiben unverändert.)

### `/admin/availability` (US-15)

| State        | Trigger                                                | UI                                                                                            |
| ------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Loading      | `GET /api/availability` läuft                           | Skeleton mit 7 Toggle-Switches.                                                               |
| Ready        | Daten geladen                                           | 7 Switches (Mo–So), aktueller Stand. Speichern-Button disabled bis Änderung.                  |
| Submitting   | `PUT /api/availability` läuft                           | Button disabled mit Spinner; Toggles read-only.                                               |
| Success      | 200 erhalten                                            | Toast „Verfügbarkeit gespeichert".                                                            |
| Error        | 4xx/5xx                                                 | Banner mit Retry-Button.                                                                      |
| InfoBlocker  | Bestätigte Buchungen in dieser Woche                    | Unter den Toggles: kompakte Liste der CONFIRMED-Termine als „Blocker" (Datum, Slot, Kunde).    |

### `/admin/bookings` Erweiterungen (US-13)

| State                | UI                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Status-Filter        | Filter-Chips: Alle / Offen (PENDING) / Vorschlag offen (COUNTER_PROPOSED) / Bestätigt / Abgelehnt / Storniert.            |
| Counter-Proposal-Action | Bei Booking-Status PENDING: Button „Alternativtermin vorschlagen" → Modal `CounterProposalDialog`. Slot-Picker mit `GET /api/slots`. |
| Counter-Proposal-Anzeige | Bei Status COUNTER_PROPOSED: zwei Slots werden angezeigt (Original + Vorschlag), mit Hinweis „Wartet auf Kunden-Reaktion". |
| Cancelled-Anzeige    | Bei Status CANCELLED: Datum + Hinweis „Vom Kunden storniert am …".                                                       |

### `/buchung` Erweiterungen (US-16, US-13 Re-Booking)

| State        | Trigger                                                | UI                                                                                                              |
| ------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Calendar-Loading | `GET /api/calendar?year=...&month=...` läuft         | Kalender-Grid mit Skeleton (5–6 Wochen-Reihen).                                                                  |
| Calendar-Ready  | Daten geladen                                       | Kalendergrid: grüne Tage klickbar, rote Tage `aria-disabled="true"`, vergangene Tage ausgegraut.                  |
| Klick auf grünen Tag | —                                              | Slot-Liste filtert auf diesen Tag (`?day=YYYY-MM-DD`); BookingForm bleibt bis Slot-Auswahl ausgeblendet.          |
| Klick auf roten Tag | —                                              | Toast / Inline-Hinweis: „Dieser Tag ist nicht verfügbar." (US-16 AC3)                                              |
| Rebook-Mode  | URL hat `?rebookToken=xxx`                              | Banner oben: „Du wählst einen neuen Termin für deine Anfrage." Form ist auf Slot-Auswahl reduziert; bei Submit → `POST /api/bookings/rebook`. |
| RebookSuccess | 200 erhalten                                           | Banner: „Neuer Wunschtermin gespeichert. Tom meldet sich, sobald er ihn bestätigt." Redirect auf `/`.             |
| RebookGone   | 410 GONE                                                | Banner: „Diese Anfrage ist nicht mehr aktiv (z.B. bereits bestätigt oder storniert)." Link zum Neu-Buchen.        |

### `/buchung/storno` (US-14)

Public Page, zeigt Bestätigung nach Storno-Aktion.

| State          | Trigger                                                                                                | UI                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| FromAction     | Redirect von `GET /api/bookings/respond?action=cancel`                                                  | „Deine Anfrage wurde erfolgreich storniert. Tom wurde informiert." + Link zur Startseite.          |
| AlreadyDone    | Redirect-Flag `?status=gone`                                                                            | „Diese Anfrage wurde bereits storniert oder ist nicht mehr aktiv."                                  |
| TokenInvalid   | `?error=not_found`                                                                                      | „Der Storno-Link ist nicht mehr gültig. Bitte direkt anrufen: …"                                    |

### `/buchung/bestaetigt` (US-13 Erfolgs-Page)

| State        | UI                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Default      | „Vielen Dank! Du hast den Alternativtermin bestätigt: <Datum>. Tom freut sich darauf." + tel:-Link.                |
| Gone         | „Dieser Vorschlag ist nicht mehr offen. Bitte direkt anrufen: …"                                                    |

---

## 15. Iteration 2 — Detail-Spec (US-13 bis US-16, BUG US-04)

### 15.1 BUG US-04 (Zusammenfassung)

Vollständige Analyse + Patch-Anweisungen: **`contracts/BUG_US04_ANALYSIS.md`**.

Kurzfassung der Fixes:

1. **Backend**: `POST /api/bookings` antwortet 201 vor dem Mail-Versand;
   `runMailDispatch` läuft fire-and-forget.
2. **Schema**: `customerEmail` via `z.preprocess` Whitespace-tolerant.
3. **Operational**: `getResend()` filtert Placeholder-Keys aktiv;
   `.env.example` mit Hinweistext.

### 15.2 State-Machine (komplett)

```
            +-----------+
            |  PENDING  |  ← initialer Zustand bei POST /api/bookings
            +-----------+
              |   |   |   |
              |   |   |   +---- (Kunde, Token)        --> CANCELLED  [Endstatus, 410 ab hier]
              |   |   +-------- (Admin, PATCH)        --> REJECTED   [Endstatus, kann zu CONFIRMED zurück]
              |   +------------ (Admin, PATCH)        --> CONFIRMED  [Endstatus, kann zu REJECTED zurück]
              +---------------- (Admin, counter-prop) --> COUNTER_PROPOSED
                                                           |   |   |
                                                           |   |   +---- (Kunde, Token)    --> CANCELLED
                                                           |   +-------- (Kunde, Rebook)   --> PENDING (slotId neu)
                                                           +------------ (Kunde, Token)    --> CONFIRMED (slotId = counterProposalSlotId)
            +-----------+
            | CANCELLED |  ← Endstatus, alle Token-Aktionen → 410 GONE
            +-----------+
```

**Idempotenz (für Admin-PATCH):** Gleicher Zielstatus → 200 OK ohne Update.

**Token-Validität:** `cancelToken` ist bis zum Erreichen eines Endstatus
(CONFIRMED, REJECTED, CANCELLED) gültig. Danach 410 GONE für jede Aktion.

### 15.3 Datenmodell-Änderungen (Zusammenfassung)

| Modell             | Änderung                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| Booking            | `+cancelToken: String @unique @default(cuid())`                                                       |
| Booking            | `+counterProposalSlotId: String?` (FK → Slot.id, ON DELETE SET NULL)                                  |
| Booking            | `+status` erweitert um `COUNTER_PROPOSED`, `CANCELLED`                                                |
| Booking            | `customerEmail` bleibt String? in DB, **App-Layer macht es zur Pflicht**                              |
| Slot               | `+proposedForBookings` (opposite-Relation für `counterProposalSlotId`)                                |
| WeeklyAvailability | **Neu**: `id, dayOfWeek (0–6, UNIQUE), isActive, updatedAt`. Initial 7 Datensätze, alle inaktiv.       |
| Partial Index      | Erweitert: `WHERE status IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED')`                              |

Migration:
1. `prisma migrate dev --name iteration2_counter_proposal_and_cancel`
   legt die Spalten + WeeklyAvailability-Tabelle an.
2. Raw-SQL-Migration `iteration2_active_booking_index_v2/migration.sql`
   droppt + recreated den Partial Unique Index.
3. Seed-Migration `iteration2_seed_weekly_availability/migration.sql` fügt
   die 7 Default-Datensätze in `weekly_availability` ein.

### 15.4 Kalenderlogik (US-16) — Backend

**Endpoint:** `GET /api/calendar?year=YYYY&month=M`.

**Pseudocode:**

```ts
// Pseudocode (lib/calendar.ts)
async function buildCalendarMonth(year: number, month: number): Promise<CalendarMonth> {
  const tz = 'Europe/Berlin';
  const firstDay = startOfMonthInTz(year, month, tz);
  const lastDay = endOfMonthInTz(year, month, tz);

  const [weekly, slots, confirmedBookings] = await Promise.all([
    prisma.weeklyAvailability.findMany(),
    prisma.slot.findMany({
      where: {
        deletedAt: null,
        startsAt: { gte: firstDay, lte: lastDay },
      },
      include: { bookings: { where: { status: { in: ACTIVE_BOOKING_STATUSES } } } },
    }),
    prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        slot: {
          startsAt: { gte: firstDay, lte: lastDay },
          deletedAt: null,
        },
      },
      include: { slot: true },
    }),
  ]);

  const activeWeekdays = new Set(weekly.filter((d) => d.isActive).map((d) => d.dayOfWeek));
  const blockedDates = new Set(
    confirmedBookings.map((b) => formatDateInTz(b.slot.startsAt, tz)),
  );
  const today = formatDateInTz(new Date(), tz);

  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const date = `${year}-${pad2(month)}-${pad2(d)}`;
    const weekday = getWeekdayInTz(date, tz); // 0..6
    const isFuture = date > today;
    const weeklyActive = activeWeekdays.has(weekday);
    const hasBlocker = blockedDates.has(date);

    const slotsForDay = slots.filter(
      (s) => formatDateInTz(s.startsAt, tz) === date && s.bookings.length === 0,
    );

    days.push({
      date,
      available: weeklyActive && !hasBlocker && isFuture,
      slotIds: slotsForDay.map((s) => s.id),
    });
  }

  return { year, month, days };
}
```

**Wichtig:** TZ-Konsistenz Berlin auf Backend. Frontend rendert mit
demselben TZ-Mapping (Intl.DateTimeFormat) — keine Umrechnung mehr nötig.

### 15.5 Frontend-Architektur Iteration 2

**Neue Pages:**
- `app/admin/availability/page.tsx` (US-15)
- `app/buchung/storno/page.tsx` (US-14)
- `app/buchung/bestaetigt/page.tsx` (US-13)

**Neue Komponenten:**
- `components/booking/Calendar.tsx` — Monats-Grid, mobile-first, touch-freundlich.
- `components/admin/CounterProposalDialog.tsx` — Modal mit Slot-Picker (lädt
  freie Slots via `GET /api/slots`).
- `components/admin/WeeklyAvailabilityForm.tsx` — 7 Toggle-Switches.

**Erweiterung Bestehende:**
- `components/admin/BookingTable.tsx` — Status-Spalte zeigt 5 Werte; neue
  Aktion „Alternativtermin vorschlagen" für PENDING-Zeilen.
- `app/buchung/BookingClient.tsx` — Re-Booking-Mode bei `?rebookToken=`.
- `components/booking/BookingForm.tsx` — `customerEmail` ist Pflichtfeld
  (Label „E-Mail (für Bestätigung & Storno-Link)").

**Neue API-Client-Funktionen** in `src/lib/api-client.ts`:
- `proposeCounter(bookingId, newSlotId): Promise<BookingAdmin>`
- `respondToBookingViaToken(token, action): Promise<{ redirectTo: string }>`
- `rebookViaToken(token, newSlotId): Promise<CreateBookingResponse>`
- `fetchAvailability(): Promise<WeeklyAvailabilityDay[]>`
- `updateAvailability(days): Promise<WeeklyAvailabilityDay[]>`
- `fetchCalendar(year, month): Promise<CalendarMonth>`

### 15.6 E-Mail-Templates — Inhalt-Skizzen

Engineers übernehmen 1:1 aus `src/lib/mail.ts`-Modulen, mit dem Branding aus §9.

**`bookingReceiptToCustomer` (Eingangsbestätigung — neu in Iteration 2)**

Subject: `Ihre Anfrage bei Bärenstark Hausservice ist eingegangen`
Inhalt:
- Anrede „Hallo {customerName},"
- „Vielen Dank für Ihre Anfrage. Wir haben sie erhalten und melden uns bei Ihnen, sobald Tom Ihren Wunschtermin bestätigt hat."
- Termin-Übersicht (Datum/Uhrzeit, Service, Beschreibung).
- Link „Anfrage stornieren": `${BASE_URL}/api/bookings/respond?token=${cancelToken}&action=cancel`
- Footer mit Telefon-Fallback.

**`counterProposalToCustomer` (US-13)**

Subject: `Bärenstark schlägt einen anderen Termin vor`
Inhalt:
- Anrede.
- „Tom kann Ihren ursprünglichen Wunschtermin am {originalSlot} leider nicht anbieten und schlägt stattdessen vor: **{counterProposalSlot}**."
- Drei prominente Buttons:
  - „Vorschlag annehmen" → `${BASE_URL}/api/bookings/respond?token=${cancelToken}&action=accept`
  - „Anderen Termin wählen" → `${BASE_URL}/buchung?rebookToken=${cancelToken}`
  - „Anfrage stornieren" → `${BASE_URL}/api/bookings/respond?token=${cancelToken}&action=cancel`
- Hinweis: „Die Buttons funktionieren nur einmalig — bitte nicht weiterleiten."

**`counterAcceptedToAdmin` (US-13 AC3)**

Subject: `{customerName} hat Ihren Alternativtermin angenommen`
Inhalt:
- „{customerName} hat den Alternativtermin am {newSlot} bestätigt."
- Kontaktdaten + Service + Beschreibung + Link `/admin/bookings`.

**`rebookingToAdmin` (US-13 AC4)**

Subject: `{customerName} hat einen neuen Termin gewählt`
Inhalt:
- „{customerName} hat einen anderen Termin als Antwort auf Ihren Vorschlag gewählt: {newSlot}."
- Kontaktdaten + Link `/admin/bookings`.
- „Bitte prüfen und bestätigen oder ablehnen."

**`cancellationToAdmin` (US-14 AC2)**

Subject: `{customerName} hat die Anfrage storniert`
Inhalt:
- „{customerName} hat die Anfrage am {originalSlot} storniert."
- Kontaktdaten + Service + Beschreibung.
- „Der Slot ist wieder als verfügbar markiert."

### 15.7 Sicherheit / Rate-Limits Iteration 2

| Endpoint                                  | Rate-Limit                                                       |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `POST /api/bookings/:id/counter-proposal` | Admin-only, kein zusätzliches Limit (Session ist die Authority). |
| `GET /api/bookings/respond`               | Kein Limit — Token ist die Authority.                            |
| `POST /api/bookings/rebook`               | 5 Anfragen / 60 min / IP — verhindert Bot-Scraping.              |
| `GET /api/calendar`                       | Kein Limit (öffentlich, Read-Only, leichtgewichtig).             |
| `PUT /api/availability`                   | Admin-only, kein zusätzliches Limit.                              |

**Token-Sicherheit:** `cancelToken` ist cuid() (24+ Zeichen). Brute-Force über
HTTPS gegen 2^120 Möglichkeiten ist statistisch chancenlos. Token werden
**niemals** in URLs gelogged (Vercel-Logs maskieren Query-Params nicht
automatisch — Engineers achten darauf, Token in `console.log`-Calls zu
truncaten oder zu hashen).
