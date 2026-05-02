# Architektur — Bärenstark Hausservice Website

**Version:** 1.4.1 (Iteration 4 Revision — QA-Fixes BUG-401/402, MAJOR-401–405)
**Stand:** 2026-05-02
**Autor:** Solution Architect

---

## Änderungslog v1.4.1 (Iteration 4 — QA-Revision)

Auslöser: QA-Design-Review zu Iteration 4 (siehe `QA_DESIGN_REVIEW.md`,
Abschnitt "Iteration 4 Design Review"). 2 kritische und 5 wichtige
Defekte wurden vor dem Code-Build im Design behoben. Schema-Änderung
ist auf 1 neues Feld beschränkt; alle anderen Findings werden durch
Spec-Klarstellungen + 1 neuen öffentlichen Endpoint adressiert.

| ID         | Severity | Bereich         | Fix-Strategie                                                                                                                                  |
| ---------- | -------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-401    | Critical | Schema / Auth   | Neues Feld `CustomerUser.verificationTokenExpiry DateTime?`. Wird bei Registrierung UND `resend-verification` auf `now + 24h` gesetzt. Verify prüft gegen diese Spalte. |
| BUG-402    | Critical | API / Profil    | E-Mail-Änderung im MVP NICHT erlaubt. `CustomerProfileUpdateSchema` ist `.strict()` und akzeptiert nur firstName/lastName/phone. Pending-Email-Mechanismus bleibt Backlog (IT5). |
| MAJOR-401  | Major    | Backend / Time  | Storno-Frist wird in Berlin-Zeitzone berechnet. `parseBerlinDateTime()` interpretiert die Wall-Clock korrekt und liefert UTC — DST-fest dokumentiert in §17.7. |
| MAJOR-402  | Major    | API / FE        | Neuer öffentlicher Endpoint `GET /api/payments/session-status?session_id=...`. Erfolgsseite polled diesen Endpoint (max 5×, 1s Intervall) — Gäste-tauglich. |
| MAJOR-403  | Major    | Schema / API    | `Review.customerName` bleibt KEIN DB-Feld. Backend leitet ihn live aus dem Customer-Join ab (`firstName + lastName[0] + '.'`); Fallback `"Anonym"` bei null-Kunde. |
| MAJOR-404  | Major    | Backend / Logic | `isCancellable()` ist null-fest: für Bestandsbuchungen (Slot-basiert ohne `date`) wird `slot.startsAt` herangezogen. Buchungen ohne bekannten Termin → `true` (Server-Authority gilt). |
| MAJOR-405  | Major    | Sicherheit / FE | `redirectUrl` (im POST-Body) bzw. `callbackUrl` (Query) wird via `safeCustomerCallback()` validiert: nur relative Pfade ohne Protokoll/Host. Sonst Fallback `/konto`. |

Detaillierte Fix-Spezifikation: §17.1 (Auth + Profile), §17.4 (Stripe-Status-Endpoint), §17.5 (Mail-Templates verändert), §17.7 (Sicherheits-Aspekte).

Schema-Migration: 1 ALTER TABLE auf `customer_users` (neue Spalte `verification_token_expiry DATETIME NULL`). Kein Backfill nötig — bestehende unverifizierte Konten erhalten beim nächsten `resend-verification` einen frischen Wert; eine 24h+alte Mail bleibt ungültig (gewünschtes Verhalten).

---

## Änderungslog v1.4 (Iteration 4)

Auslöser: Iteration-4-Stories US-25 bis US-29. Diese Version dokumentiert
das neue Kundenportal mit eigener Auth-Mechanik, die Stripe-basierte
Zahlungsabwicklung, das echte Backend für Kundenbewertungen und den
neuen Booking-Status `COMPLETED`.

| ID                | Bereich       | Erweiterung / Fix                                                                                |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| US-25 Datenmodell | Schema        | Neue Tabelle `customer_users` mit eigenem Cookie `customer-session` (JWT, 7d). Vollständig getrennt vom Admin-`User`. |
| US-25 API         | Endpunkte     | 9 neue Endpunkte unter `/api/customer/*` (register/login/logout/me/verify/resend-verification/forgot-password/reset-password). |
| US-25 Mail        | Templates     | 2 neue Templates: `customerVerificationMail`, `customerPasswordResetMail`. (`customerEmailChangedMail` war ursprünglich geplant, wurde in v1.4.1 entfernt — siehe BUG-402.) |
| US-25 Middleware  | Routing       | `/konto/*` (außer Public-Whitelist) prüft `customer-session`-Cookie. Edge-sicher (nur Cookie-Existenz, JWT-Verify im Handler). |
| US-26 Datenmodell | Schema        | `Booking.customerId` (FK → customer_users, ON DELETE SET NULL). Backfill-Strategie: keine — Gastbuchungen bleiben sichtbar nur für Tom. |
| US-26 API         | Endpunkte     | `GET /api/customer/bookings` (Split upcoming/past), `GET /api/customer/bookings/:id`. |
| US-27 API         | Endpunkte     | `POST /api/customer/bookings/:id/cancel` mit serverseitigem 24h-Frist-Check. |
| US-28 Stack       | Stack         | **Stripe** als Zahlungs-Provider (deckt Karte, PayPal, Apple Pay, Google Pay über Checkout-Sessions). Alternativen verworfen — siehe §17.4. |
| US-28 Datenmodell | Schema        | Neue Tabelle `payments` (1:1 zu Booking). Beträge in Cents (Int). |
| US-28 API         | Endpunkte     | `POST /api/admin/bookings/:id/payment` (Admin), `DELETE /api/admin/bookings/:id/payment` (Admin), `POST /api/payments/create-session`, `POST /api/payments/webhook` (Stripe). |
| US-28 Mail        | Templates     | 4 neue Templates: `paymentRequestToCustomer`, `paymentReceivedToCustomer`, `paymentReceivedToAdmin`, `paymentRefundedToCustomer`. |
| US-29 Datenmodell | Schema        | Neue Tabelle `reviews` mit Admin-Freigabe-Mechanismus (`approved` boolean). 1:1 zu Booking, optional zu CustomerUser. |
| US-29 API         | Endpunkte     | `POST /api/customer/reviews`, `GET /api/reviews` (öffentlich, nur approved), `GET /api/admin/reviews`, `PATCH /api/admin/reviews/:id`. |
| US-29 Status      | State-Machine | `BookingStatus.COMPLETED` neu — Tom markiert Termin nach Erbringung als abgeschlossen, was Bewertungs-Button im Portal freischaltet. |
| US-29 Frontend    | UI            | `lib/reviews.ts` (statisch, IT3) wird ersetzt durch `GET /api/reviews`-Aufruf — sobald ≥4 approved Reviews vorhanden sind. |
| Neue ENV          | Operational   | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`. `AUTH_SECRET` (alias `NEXTAUTH_SECRET`) wird wiederverwendet für Customer-JWT-Signing. |
| Neue Fehlercodes  | API           | `EMAIL_NOT_VERIFIED` (422), `STRIPE_ERROR` (502).                                                |

Detaillierte Iteration-4-Spezifikation: siehe **§17** in diesem Dokument.

---

## Änderungslog v1.3 (Iteration 3)

Auslöser: Iteration-3-Stories US-17 bis US-24 plus Blocker-Bug
**BUG IT3** ("Buchungsformular schlägt erneut fehl"). Diese Version
dokumentiert das neue Verfügbarkeitsfenster-Modell, Datei-Upload via
Vercel Blob, Preis-Datenstruktur, Feedback-Sektion, Service-Popups und
die erweiterten Kunden-E-Mails.

| ID                | Bereich       | Erweiterung / Fix                                                                                |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| BUG-IT3 Fix       | Frontend      | `BookingForm.tsx` umgebaut: `slotId`/Date/Time werden außerhalb von RHF gehalten (siehe `BUG_BOOKING_IT3.md`). |
| US-17 Datenmodell | Schema        | `AvailabilityTemplate` (7 Wochentage mit startTime/endTime/slotDurationMinutes), `DayOverride` (individuelle Tages-Überschreibung). |
| US-17 Booking     | Schema        | `Booking.date / startTime / endTime` neu (nullable). `slotId` wird nullable (Bestand). Neuer Partial Unique Index `uniq_active_booking_per_timeslot`. |
| US-17 API         | Endpunkte     | `GET/PUT /api/admin/availability-template`, `GET/POST /api/admin/day-overrides`, `DELETE /api/admin/day-overrides/:id`, `GET /api/slots/available`. |
| US-18 Storage     | Storage       | Vercel Blob als Datei-Storage (kostenfrei bis 2 GB). `BookingAttachment`-Modell, `POST /api/upload`. |
| US-19 Service     | Konstante     | `'sonstiges'` zu `SERVICES` hinzugefügt; bei diesem Service zwingt `CreateBookingSchema` `description ≥ 30` Zeichen. |
| US-20 Preise      | Frontend      | Statische Preisangaben in `lib/services.ts` (`priceFrom`, `priceUnit`, `priceNote`). Anzeige auf Service-Karten + Popups. |
| US-21 Dashboard   | API + UI      | `GET /api/admin/upcoming-bookings`. Neue Sektion oben auf `/admin` Dashboard. |
| US-22 Reviews     | Frontend      | Statische Bewertungen in `lib/reviews.ts`. Neue Section auf Startseite. |
| US-23 Popups      | Frontend      | Service-Karten-Klick öffnet Modal; Inhalt aus `lib/services.ts.details`. |
| US-24 Mails       | Mail          | 2 neue Templates: `bookingConfirmationToCustomer` (PENDING→CONFIRMED), `bookingRejectionToCustomer` (PENDING→REJECTED). Trigger in `PATCH /api/bookings/:id`. Eingangsbestätigung an Kunden ist bereits IT2 vorhanden. |
| Neue ENV          | Operational   | `BLOB_READ_WRITE_TOKEN` (Vercel Blob).                                                            |
| Neue Fehlercodes  | API           | `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415) für `POST /api/upload`.                |

Detaillierte Iteration-3-Spezifikation: siehe **§16** in diesem Dokument.

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

---

## 16. Iteration 3 — Detail-Spec (US-17 bis US-24, BUG IT3)

### 16.1 BUG IT3 (Zusammenfassung)

Vollständige Analyse + Patch-Anweisungen: **`contracts/BUG_BOOKING_IT3.md`**.

**Kurzfassung:**

Das Buchungsformular schlägt fehl, weil `register('slotId')` an einen
Hidden-Input mit explizit gesetztem `value=` gebunden wurde — RHF ignoriert
DOM-Werte, der Form-State bleibt auf `''`. Zod-Validation auf `slotId.min(1)`
schlägt fehl, der Submit-Handler-Body wird nie erreicht, der Benutzer
sieht keinen sichtbaren Fehler (hidden Input hat kein Error-Element).

**Fix:** `slotId` (bzw. IT3: `date/startTime/endTime`) komplett aus dem
RHF-Form-Schema entfernen. Stattdessen externes React-State und beim
Submit programmatisch in `createBooking()`-Payload mergen. Siehe
`BookingFormSchema` in `contracts/zod-schemas.ts`.

### 16.2 Verfügbarkeitsfenster-Modell (US-17)

#### Konzept

Statt vorab manuell Slots anzulegen (IT1/IT2-Modell), definiert Tom in
IT3:

- **`AvailabilityTemplate`**: pro Wochentag (0–6) ein Standardfenster
  `(isActive, startTime, endTime, slotDurationMinutes)`.
- **`DayOverride`**: pro konkretem Datum eine Überschreibung
  `(date, isActive, startTime?, endTime?, reason?)`.

#### Resolver-Logik (`lib/availability.ts`)

```ts
// Pseudocode
async function resolveDay(date: string): Promise<ResolvedDay> {
  const tz = 'Europe/Berlin';

  // 1. Vergangenheit?
  if (date < todayInBerlin()) return { isActive: false };

  // 2. Override?
  const override = await prisma.dayOverride.findUnique({ where: { date } });
  const weekday = getWeekdayInTz(date, tz); // 0..6
  const template = await prisma.availabilityTemplate.findUnique({
    where: { dayOfWeek: weekday },
  });

  if (override) {
    if (!override.isActive) {
      return { isActive: false, reason: override.reason ?? null };
    }
    // Override-Zeiten ODER Template-Defaults
    return {
      isActive: true,
      startTime: override.startTime ?? template?.startTime ?? '08:00',
      endTime: override.endTime ?? template?.endTime ?? '17:00',
      slotDurationMinutes: template?.slotDurationMinutes ?? 60,
    };
  }

  if (!template || !template.isActive) return { isActive: false };

  return {
    isActive: true,
    startTime: template.startTime,
    endTime: template.endTime,
    slotDurationMinutes: template.slotDurationMinutes,
  };
}

async function computeAvailableSlots(date: string): Promise<AvailableSlotsResponse> {
  const day = await resolveDay(date);
  if (!day.isActive) {
    return { date, isDayActive: false, slots: [], overrideReason: day.reason ?? null };
  }

  const blocks = generateBlocks(day.startTime, day.endTime, day.slotDurationMinutes);

  const activeBookings = await prisma.booking.findMany({
    where: {
      date,
      status: { in: ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'] },
    },
    select: { startTime: true, endTime: true },
  });

  const taken = new Set(activeBookings.map((b) => `${b.startTime}-${b.endTime}`));

  const slots = blocks.map((b) => ({
    ...b,
    available: !taken.has(`${b.startTime}-${b.endTime}`),
  }));

  return { date, isDayActive: true, slots };
}
```

#### Buchungs-Flow (Iteration 3)

```
User öffnet /buchung
  └→ ClientCalendar lädt:
       GET /api/availability-template     (alle 7 Wochentage — Cache 60 s)
       GET /api/day-overrides?month=YYYY-MM (Override-Liste — Cache 60 s)
     Daraus Monatskalender-Rendering (rot/grün/Heute) ohne Backend-Roundtrip.

User klickt grünen Tag
  └→ TimeSlotPicker:
       GET /api/slots/available?date=YYYY-MM-DD
     → Liste von { startTime, endTime, available } anzeigen.
     User klickt einen verfügbaren Block.

User füllt Formular aus + Upload-Files (siehe §16.3)
  └→ Form-Submit:
       POST /api/upload (per Datei, vor Submit)  → attachmentIds[]
       POST /api/bookings { date, startTime, endTime, ..., attachmentIds }
     → 201, Eingangsbestätigung-Mail wird fire-and-forget versendet.
```

**Wichtig — öffentlicher Read-Endpoint für Availability-Template:**

Der Calendar-Renderer braucht die Template-Daten ohne Admin-Login.
Engineers haben zwei Optionen:

1. **(empfohlen)** Den Endpoint `GET /api/availability-template`
   öffentlich machen (read-only) — gleiche Response wie
   `/api/admin/availability-template`, aber kein Auth-Check. Day-Overrides
   ebenfalls als `GET /api/day-overrides?month=...`.
2. **Alternative:** Server-Component auf `/buchung` rendert die Daten
   direkt aus der DB (Prisma) und übergibt sie an den Client — kein
   öffentlicher API-Endpoint nötig.

Diese Architektur empfiehlt **Variante 2** (Server-Component), weil sie
keinen weiteren öffentlichen Endpunkt erfordert und das Caching
automatisch über Next.js abgebildet wird.

#### Race-Condition-Schutz

Der Partial Unique Index
```sql
CREATE UNIQUE INDEX uniq_active_booking_per_timeslot
  ON bookings(date, start_time, end_time)
  WHERE date IS NOT NULL
    AND status IN ('PENDING','CONFIRMED','COUNTER_PROPOSED');
```
verhindert Doppelbuchung auf DB-Ebene. Verstoß → SQLite P2002 →
Handler wandelt in 409 `CONFLICT` um.

**Beachte:** Der Index wirkt auf exakte Tupel `(date, startTime, endTime)`.
Wenn das Frontend NUR die vom Backend angebotenen Blöcke wählen darf
(was per Schema-Validation `endTime - startTime === slotDurationMinutes`
erzwungen wird), passt das. Wenn Tom später die `slotDurationMinutes`
ändert, können Bestandsbuchungen mit alter Dauer parallel zu neuen
Buchungen mit neuer Dauer existieren — das ist im MVP akzeptabel
(Tom moderiert Doppel-Konflikte manuell).

### 16.3 Datei-Upload (US-18)

#### Stack-Entscheidung: Vercel Blob

| Alternative      | Begründung gegen                                              |
| ---------------- | ------------------------------------------------------------- |
| AWS S3           | Account-Setup, IAM, Kosten ab Day 1.                          |
| Cloudflare R2    | DNS-Verifikation, kein Vercel-Integration.                    |
| Lokales FS       | Vercel hat read-only FS, nicht möglich.                       |
| Base64 in DB     | DB-Bloat, 33 % Overhead, keine direkten URLs.                 |
| **Vercel Blob**  | **Native Integration, 2 GB free, Public-URL-Support, kein Setup.** |

#### Architektur

```
[BookingForm]  →  selectFiles()
       │
       ├─→ FileUpload-Komponente:
       │     for each file:
       │       client-side check (size, type)
       │       POST /api/upload (multipart) → { attachmentId, url, ... }
       │     attachmentIds[] sammeln
       │
       └─→ Submit:
             POST /api/bookings { ..., attachmentIds }
             Backend: prisma.bookingAttachment.updateMany({
               where: { id: { in: attachmentIds }, bookingId: null },
               data:  { bookingId: newBookingId }
             })
```

#### Schema-Anpassung Engineers

`BookingAttachment.bookingId` muss nullable sein (in `prisma/schema.prisma`
und `schema.sql`), damit Upload vor Booking-Insert möglich ist. Cascade-
Delete bleibt erhalten — greift nur, wenn `bookingId` gesetzt ist.

```prisma
model BookingAttachment {
  // ...
  bookingId String?
  booking   Booking? @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  // ...
}
```

#### Cleanup orphan attachments (Backlog)

Vercel Cron 1×/Tag:
```ts
// pseudocode (app/api/cron/cleanup-attachments/route.ts)
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
const orphans = await prisma.bookingAttachment.findMany({
  where: { bookingId: null, createdAt: { lt: cutoff } },
});
for (const o of orphans) {
  await del(o.url);  // Vercel Blob delete
  await prisma.bookingAttachment.delete({ where: { id: o.id } });
}
```

Im MVP nicht zwingend — die paar verwaisten Dateien kosten <1 ¢/Monat.

#### Limits & Validation

- **Client-side (BookingForm/FileUpload.tsx):**
  - max. 5 Dateien.
  - max. 20 MB pro Datei.
  - Akzeptierte MIME-Types (siehe `UPLOAD_ACCEPTED_CONTENT_TYPES`).
- **Server-side (`POST /api/upload`):**
  - Doppelt validiert (Browser-Manipulation umgehen).
  - 413 `PAYLOAD_TOO_LARGE` bei Größenverstoß.
  - 415 `UNSUPPORTED_MEDIA_TYPE` bei MIME-Verstoß.
  - Rate-Limit 20/h/IP.

#### Sichtbarkeit für Tom

`/admin/bookings` zeigt pro Booking eine Attachment-Liste mit:
- Vorschaubild (für `image/*`).
- Datei-Icon + Dateiname für PDF/Video.
- Klick → öffnet `url` in neuem Tab (Public-Blob, kein Auth-Token nötig).

### 16.4 Service-Erweiterung "Sonstiges" (US-19)

In `lib/services.ts` und `contracts/zod-schemas.ts` wird `'sonstiges'`
zur SERVICES-Liste hinzugefügt:

```ts
export const SERVICES = [
  'entruempelung', 'entkernung', 'reinigung',
  'gruenflaechenpflege', 'muelltonnenservice', 'entsorgung',
  'sonstiges',  // IT3
] as const;
```

UI-Verhalten (BookingForm):

```tsx
const watchService = watch('service');
const isCustom = watchService === 'sonstiges';

<Textarea
  label={isCustom ? 'Beschreiben Sie Ihr Anliegen *' : 'Beschreibung'}
  required
  rows={isCustom ? 6 : 4}
  hint={isCustom ? 'Mindestens 30 Zeichen, damit Tom Ihr Anliegen einschätzen kann.' : undefined}
  error={errors.description?.message}
  {...register('description')}
/>
```

`CreateBookingSchema.superRefine` und `BookingFormSchema.superRefine`
erzwingen `description.length >= 30` bei `service === 'sonstiges'`.

### 16.5 Preise (US-20)

Statische Anreicherung von `lib/services.ts`:

```ts
export interface ServiceInfo {
  slug: Service;
  label: string;
  short: string;
  description: string;
  icon: string;
  // IT3:
  priceFrom: number | null;            // null bei 'sonstiges'
  priceUnit: 'hour' | 'task' | null;   // 'hour' = "ab X €/h", 'task' = "ab X €/Entleerung"
  priceNote: string;                    // freier Disclaimer-Text
  // US-23:
  details: ServiceDetails;
}

export interface ServiceDetails {
  before: string;
  after: string;
  includes: string[];
}
```

Preise (Richtwerte Darmstadt):

| Slug                  | priceFrom | priceUnit | priceNote                                                      |
| --------------------- | --------- | --------- | -------------------------------------------------------------- |
| entruempelung         | 35        | hour      | "ab 35 €/Std., final nach Besichtigung"                        |
| entkernung            | 45        | hour      | "ab 45 €/Std., individuell nach Aufwand"                       |
| reinigung             | 25        | hour      | "ab 25 €/Std."                                                 |
| gruenflaechenpflege   | 30        | hour      | "ab 30 €/Std."                                                 |
| muelltonnenservice    | 20        | task      | "ab 20 €/Entleerung"                                           |
| entsorgung            | 40        | hour      | "ab 40 €/Std., zzgl. Materialwert"                             |
| sonstiges             | null      | null      | "Auf Anfrage — wir machen Ihnen ein individuelles Angebot."    |

UI-Anzeige auf Service-Karte:

```
[Icon]
Entrümpelungen
Wohnungen, Keller, Dachböden, Garagen.
🪙 ab 35 €/Std.
[Mehr erfahren]
```

Mit Disclaimer (sichtbar auf Mobile, Hover/Aria-Tooltip auf Desktop):
"Richtpreis für die Region Darmstadt. Finale Preise nach Besichtigung
oder auf Anfrage."

### 16.6 Admin-Dashboard "Heute & Bevorstehend" (US-21)

`app/admin/page.tsx` (Dashboard) bekommt **oben** eine neue Sektion
`<UpcomingBookingsList />`:

```tsx
// Server-Component
async function UpcomingBookingsList() {
  const bookings = await fetchUpcomingBookings({ limit: 10 });
  return (
    <section className="...">
      <h2 className="...">Heute & Bevorstehend</h2>
      {bookings.length === 0 && <Banner tone="info">Keine bevorstehenden Termine.</Banner>}
      <ul>
        {bookings.map((b) => (
          <li key={b.id}>
            {b.isToday && <Badge tone="warning">Heute</Badge>}
            <Link href={`/admin/bookings#${b.id}`}>
              {formatDate(b.date)} — {b.startTime}–{b.endTime} · {b.customerName} · {SERVICE_LABELS[b.service]}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Daten: `GET /api/admin/upcoming-bookings?limit=10` (siehe API-Spec §5).

Klick auf Eintrag → Anchor-Link auf den Eintrag in `/admin/bookings#<id>`.
Engineers ergänzen einen passenden `id={...}` auf Booking-Rows.

### 16.7 Feedback-Sektion (US-22)

Statische Daten in `lib/reviews.ts`:

```ts
export interface Review {
  id: string;
  customerName: string;       // "Maria M."
  service: Service | 'allgemein';
  stars: 1 | 2 | 3 | 4 | 5;
  text: string;               // Kurztext, max ~300 Zeichen
  date: string;               // "2026-03-15", für Sortierung
}

export const REVIEWS: readonly Review[] = [
  // 4× 5-Sterne, 5× 4-Sterne, 1× 4-Sterne — Ø ~4.4
  // (Spec sagt "Ø ~4.5"; 4×5 + 6×4 = 44/10 = 4.4 — Engineers
  // dürfen die Verteilung leicht justieren, um näher an 4.5 zu kommen,
  // z.B. 5×5 + 4×4 + 1×4 = 4.4, oder 6×5 + 4×4 = 4.6).
];

export const REVIEWS_AVERAGE = computeAverage(REVIEWS); // ~4.5
```

UI-Komponente `components/home/ReviewSection.tsx`:

- Initial 6 Bewertungen sichtbar, "Mehr anzeigen"-Button für die übrigen.
- Sterne als 5 Span-Elemente mit gefülltem/leeren Bär-Icon (oder
  ⭐ Unicode für MVP).
- Karten-Layout (Mobile: 1 Col, Tablet: 2, Desktop: 3).
- Header mit Durchschnitt: "★★★★★ 4,5 von 5 — basierend auf 10 Bewertungen".

Auf Startseite (`app/page.tsx`) zwischen `ServiceGrid` und Footer
einbinden.

**Hinweis Iteration 4 (US-29):** Die `Review`-Datenstruktur ist
zukunftskompatibel mit dem späteren Backend-Modell — Engineers achten
darauf, identische Felder zu verwenden, sodass nur die Datenquelle
gewechselt werden muss.

### 16.8 Service-Popups (US-23)

`components/home/ServiceModal.tsx`:

- Klick auf Service-Karte (oder "Mehr erfahren"-Button) öffnet das
  Modal mit:
  - Service-Titel, Icon.
  - Lange Beschreibung (`description` aus `services.ts`).
  - "Vorher / Nachher"-Block (Platzhalter-Bilder + Texte aus
    `details.before` / `details.after`).
  - "Was wir tun" — Liste aus `details.includes` (Aufzählung).
  - Preis-Block (siehe US-20).
  - CTA "Jetzt anfragen" → schließt Modal, scrollt zu Buchungssektion
    UND setzt `service` im Form vorausgewählt (via `?service=<slug>`-
    Query-Parameter und `BookingForm.useEffect`).
- Schließen via X-Button, Hintergrund-Klick (`onOverlayClick`),
  Escape-Taste.
- Focus-Trap im Modal (a11y).
- Animation: Tailwind `transition-opacity` + `transition-transform`
  (~150 ms).

Daten in `lib/services.ts.SERVICE_LIST[i].details`:

```ts
{
  slug: 'entruempelung',
  // ...
  details: {
    before: 'Vollgestellte Räume, jahrelang gewachsene Sammlungen, schwere Möbel.',
    after: 'Besenrein übergebene Räume, fachgerecht entsorgt, alles wiederverwertbar wo möglich.',
    includes: [
      'Sortierung wertvoller Gegenstände',
      'Demontage von Möbeln',
      'Fachgerechte Entsorgung (Sperrmüll, Wertstoff, Sondermüll)',
      'Besenreine Übergabe',
    ],
  },
}
```

Bilder: Platzhalter `images/popups/<slug>-before.jpg` /
`<slug>-after.jpg` (8 Dateien). Tom liefert echte Bilder nach Iteration 3.

### 16.9 Kunden-E-Mails (US-24)

#### Templates (3 neue + 1 Bestand = 4 Mails an Kunden in IT3)

| Template-Key                     | Trigger                                 | Status            |
| -------------------------------- | --------------------------------------- | ----------------- |
| `bookingReceiptToCustomer`       | `POST /api/bookings`                    | **Bestand IT2**   |
| `bookingConfirmationToCustomer`  | `PATCH /api/bookings/:id` (PENDING→CONFIRMED) | **NEU IT3** |
| `bookingRejectionToCustomer`     | `PATCH /api/bookings/:id` (PENDING→REJECTED, CONFIRMED→REJECTED) | **NEU IT3** |
| `counterProposalToCustomer`      | `POST /api/bookings/:id/counter-proposal` | **Bestand IT2** |

#### Implementation in `lib/mail.ts`

Engineers ergänzen zwei neue Funktionen analog zu den IT2-Mails:

```ts
export interface BookingConfirmationMailPayload {
  customerName: string;
  customerEmail: string;
  service: Service;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  cancelToken: string;
}

export async function sendBookingConfirmationToCustomer(
  p: BookingConfirmationMailPayload,
): Promise<MailResult> {
  // Subject: "Ihr Termin am DD.MM.YYYY ist bestätigt"
  // Body: Datum, Uhrzeit, Service, Adresse/Telefon Tom (0157-74787512),
  //       Storno-Link (`actionUrl(token, 'cancel')`).
  return sendWithRetry({ ... });
}

export interface BookingRejectionMailPayload {
  customerName: string;
  customerEmail: string;
  service: Service;
  // Optional: Original-Termin für Kontext im Mail-Text.
  date?: string;
  startTime?: string;
  endTime?: string;
}

export async function sendBookingRejectionToCustomer(
  p: BookingRejectionMailPayload,
): Promise<MailResult> {
  // Subject: "Leider können wir Ihren Termin nicht wahrnehmen"
  // Body: Höfliche Absage, Telefon-CTA für Rückfrage,
  //       Hinweis auf neue Anfrage (Link zur Buchungsseite).
  return sendWithRetry({ ... });
}
```

#### Trigger-Integration in `PATCH /api/bookings/:id`

```ts
// app/api/bookings/[id]/route.ts (PATCH, vereinfacht)
const before = await prisma.booking.findUnique({ where: { id } });
const updated = await prisma.booking.update({
  where: { id },
  data: { status: nextStatus },
});

// IT3: Kunden-Mail bei Status-Wechsel
if (updated.customerEmail) {
  if (before.status === 'PENDING' && updated.status === 'CONFIRMED') {
    void sendBookingConfirmationToCustomer({
      customerName: updated.customerName,
      customerEmail: updated.customerEmail,
      service: updated.service as Service,
      date: updated.date ?? formatDateInTz(updated.slot.startsAt, 'Europe/Berlin'),
      startTime: updated.startTime ?? formatTimeInTz(updated.slot.startsAt, 'Europe/Berlin'),
      endTime: updated.endTime ?? formatTimeInTz(updated.slot.endsAt, 'Europe/Berlin'),
      cancelToken: updated.cancelToken,
    }).catch((err) => console.warn('[mail] confirm failed', err));
  } else if (
    (before.status === 'PENDING' || before.status === 'CONFIRMED') &&
    updated.status === 'REJECTED'
  ) {
    void sendBookingRejectionToCustomer({
      customerName: updated.customerName,
      customerEmail: updated.customerEmail,
      service: updated.service as Service,
      date: updated.date,
      startTime: updated.startTime,
      endTime: updated.endTime,
    }).catch((err) => console.warn('[mail] reject failed', err));
  }
}
```

Fire-and-forget — der PATCH-Handler antwortet sofort 200, unabhängig
vom Mail-Ergebnis.

### 16.10 Datenmodell-Migration (Iteration 3)

#### Neue Tabellen

1. `availability_template` (siehe Schema).
2. `day_overrides` (siehe Schema).
3. `booking_attachments` (siehe Schema).

#### Neue Booking-Felder

```sql
ALTER TABLE bookings ADD COLUMN date TEXT NULL;
ALTER TABLE bookings ADD COLUMN start_time TEXT NULL;
ALTER TABLE bookings ADD COLUMN end_time TEXT NULL;
-- slot_id muss zu nullable migriert werden:
-- SQLite-Hack: neue Tabelle erstellen, Daten migrieren, alte droppen
-- (wird von Prisma migrate-dev automatisch ausgeführt).
```

#### Index-Anpassungen

```sql
-- Bestand: nur greifen, wenn slot_id gesetzt
DROP INDEX IF EXISTS uniq_active_booking_per_slot;
CREATE UNIQUE INDEX uniq_active_booking_per_slot
  ON bookings(slot_id)
  WHERE slot_id IS NOT NULL
    AND status IN ('PENDING','CONFIRMED','COUNTER_PROPOSED');

-- NEU IT3
CREATE UNIQUE INDEX uniq_active_booking_per_timeslot
  ON bookings(date, start_time, end_time)
  WHERE date IS NOT NULL
    AND status IN ('PENDING','CONFIRMED','COUNTER_PROPOSED');

-- Performance-Indexe
CREATE INDEX idx_bookings_date_status        ON bookings(date, status);
CREATE INDEX idx_bookings_status_date_time   ON bookings(status, date, start_time);
```

#### Seed (Iteration 3)

Migration `iteration3_seed_availability_template/migration.sql`:

```sql
-- Übernimmt isActive aus weekly_availability (falls vorhanden), sonst Defaults.
INSERT INTO availability_template (id, day_of_week, is_active, start_time, end_time, slot_duration_minutes)
SELECT
  hex(randomblob(12)) AS id,
  d.day_of_week,
  COALESCE((SELECT is_active FROM weekly_availability WHERE day_of_week = d.day_of_week), 0),
  '08:00', '17:00', 60
FROM (
  SELECT 0 AS day_of_week UNION ALL
  SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
  SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
) d
WHERE NOT EXISTS (SELECT 1 FROM availability_template WHERE day_of_week = d.day_of_week);
```

### 16.11 Frontend-Architektur Iteration 3

#### Neue / geänderte Komponenten

| Pfad                                                     | Status   | Zweck                                                                          |
| -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `components/booking/BookingForm.tsx`                     | UMGEBAUT | BUG IT3 Fix; Date/Time/Attachments via React-State außerhalb von RHF.          |
| `components/booking/TimeSlotPicker.tsx`                  | NEU      | Zeigt verfügbare Blöcke nach Tag-Auswahl (US-17).                              |
| `components/booking/FileUpload.tsx`                      | NEU      | Drag-and-Drop + Datei-Picker mit Vorschau (US-18).                             |
| `components/booking/CalendarV2.tsx`                      | NEU      | IT3-Kalender: Template + Overrides als Datenquelle.                            |
| `components/admin/AvailabilityTemplateForm.tsx`          | NEU      | 7 Wochentage konfigurieren (US-17).                                            |
| `components/admin/DayOverrideManager.tsx`                | NEU      | Liste + Anlegen/Löschen von Tages-Überschreibungen (US-17).                    |
| `components/admin/UpcomingBookingsList.tsx`              | NEU      | Dashboard-Top-Sektion (US-21).                                                 |
| `components/admin/BookingAttachmentList.tsx`             | NEU      | Anhang-Anzeige in Booking-Detail (US-18).                                      |
| `components/home/ReviewSection.tsx`                      | NEU      | Feedback-Sektion (US-22).                                                      |
| `components/home/ServiceModal.tsx`                       | NEU      | Service-Popup (US-23).                                                          |
| `components/home/ServiceGrid.tsx`                        | ERWEITERT | Klick-Handler für Modal; Preis-Anzeige (US-20).                              |
| `lib/services.ts`                                        | ERWEITERT | `'sonstiges'`, `priceFrom/priceUnit/priceNote`, `details`.                    |
| `lib/reviews.ts`                                         | NEU      | 10 statische Review-Datensätze (US-22).                                        |
| `lib/availability.ts`                                    | NEU      | `resolveDay()`, `computeAvailableSlots()`, Helper für Berlin-TZ-Datum/Zeit.    |
| `lib/api-client.ts`                                      | ERWEITERT | `fetchAvailableSlots()`, `uploadFile()`, `fetchUpcomingBookings()`, `fetchAvailabilityTemplate()`, `updateAvailabilityTemplate()`, `fetchDayOverrides()`, `createDayOverride()`, `deleteDayOverride()`. |
| `lib/mail.ts`                                            | ERWEITERT | `sendBookingConfirmationToCustomer`, `sendBookingRejectionToCustomer`.        |

#### Neue Pages

- `/admin/availability` wird umgebaut: alte
  `WeeklyAvailabilityForm` durch `AvailabilityTemplateForm` +
  `DayOverrideManager` ersetzt (Tabs oder Stack-Layout).

### 16.12 UI-States Iteration 3

#### `/buchung` (umgebaut für IT3)

| State                | Trigger                                                  | UI                                                                    |
| -------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| Calendar-Loading     | Initial-Load                                              | Skeleton-Grid für 5–6 Wochenreihen.                                   |
| Calendar-Ready       | Template + Overrides geladen                              | Klickbare grüne Tage, ausgegraute rote Tage.                           |
| TimeSlotsLoading     | `GET /api/slots/available` läuft                          | Spinner-Liste in TimeSlotPicker.                                       |
| TimeSlotsReady       | Slots geladen                                             | Verfügbare Blöcke als klickbare Buttons; belegte als ausgegraut.       |
| TimeSlotsEmpty       | `isDayActive: false` mit/ohne reason                      | Hinweis "Tag nicht verfügbar" + ggf. Override-Reason.                  |
| FileUpload-Pending   | `POST /api/upload` läuft pro Datei                        | Liste mit Progressbar pro Datei; "Hochladen 2/3...".                   |
| FileUpload-Error     | 413 / 415 / Netzwerk                                      | Inline-Fehler beim betreffenden Eintrag, andere bleiben gültig.        |
| Submit-Conflict      | `POST /api/bookings` → 409 (Tag inaktiv oder Slot belegt) | Banner "Termin nicht mehr verfügbar"; TimeSlotPicker neu laden.        |
| Submit-Validation    | Service=sonstiges + Beschreibung < 30                     | Inline-Fehler unter Beschreibungs-Feld.                                |

#### `/admin` (Dashboard, IT3 erweitert)

`<UpcomingBookingsList>` oben:

| State        | UI                                                        |
| ------------ | --------------------------------------------------------- |
| Loading      | Skeleton mit 3 Zeilen.                                    |
| Empty        | "Keine bevorstehenden bestätigten Termine."               |
| Today-Badge  | Termine mit `isToday: true` mit gelb-orange Badge.        |

#### `/admin/availability` (IT3 umgebaut)

| Tab/Section                | UI                                                             |
| -------------------------- | -------------------------------------------------------------- |
| Default-Vorlage (US-17)    | 7 Karten (Mo–So) mit Toggle, Start/End-Time, Slot-Dauer-Select. |
| Tages-Überschreibungen     | Kalender-Picker, Liste der bestehenden Overrides, Edit/Delete. |

#### `/admin/bookings` (IT3 erweitert)

- Spalte "Termin" zeigt jetzt entweder
  `formatDate(date) startTime–endTime` (IT3-Buchungen) ODER
  `formatSlotRange(slot.startsAt, slot.endsAt)` (Bestand).
- Neue Spalte "Anhänge": Anzahl + Klick öffnet Lightbox-/Liste.

### 16.13 Sicherheit Iteration 3

#### Datei-Upload-Hardening (US-18)

- **Server-side MIME-Check via `file.type`.** Browser kann
  manipuliert werden — daher zusätzlich Magic-Byte-Check empfohlen
  (Engineers: optional `file-type`-Lib, im MVP genügt `file.type`).
- **Public-Bucket-Risiko:** Vercel Blob ist standardmäßig öffentlich.
  Engineers sollten:
  - Dateinamen mit `cuid()` randomisieren (kein erratbare Paths).
  - Sensible Dokumente NICHT erlauben (z.B. keine Excel/Word — wird
    durch MIME-Whitelist verhindert).
  - Im Datenschutz-Hinweis explizit darauf hinweisen, dass Anhänge
    auf einer öffentlichen URL liegen.
- **Größenlimit:** 20 MB hart durchgesetzt (Vercel Blob hat eigenes
  Limit von 500 MB — wir liegen weit darunter).
- **Total-Quota-Sicht:** 2 GB Free-Tier. Bei ~10 Buchungen/Tag mit
  ~5 MB Anhängen wären das 50 MB/Tag = 1.5 GB/Monat. Engineers
  monitoren über Vercel Dashboard. Bei Annäherung an Limit:
  Cleanup-Cron (siehe §16.3) priorisieren.

#### Rate-Limits Iteration 3

| Endpoint                                  | Rate-Limit                                              |
| ----------------------------------------- | ------------------------------------------------------- |
| `POST /api/upload`                        | 20 Anfragen / 60 min / IP.                              |
| `POST /api/bookings` (mit Attachments)    | Bestand: 10 / 60 min / IP.                              |
| `GET /api/slots/available`                | Kein Limit (öffentlich, Read-Only).                     |
| `GET /api/admin/upcoming-bookings`        | Kein Limit (Admin-Session).                             |
| `PUT /api/admin/availability-template`    | Kein Limit (Admin-Session).                             |
| `POST /api/admin/day-overrides`           | Kein Limit (Admin-Session).                             |

### 16.14 ENV-Variablen Iteration 3

| Variable                  | Pflicht | Wert / Beispiel                                | Zweck                              |
| ------------------------- | ------- | ---------------------------------------------- | ---------------------------------- |
| `BLOB_READ_WRITE_TOKEN`   | ja      | `vercel_blob_rw_xxxxxxxxxxxx`                  | Vercel Blob (US-18).               |

`.env.example` entsprechend ergänzen.

### 16.15 Offene Punkte / Annahmen Iteration 3

- **Annahme:** `BookingAttachment.bookingId` wird nullable, damit
  Upload vor Booking-Insert möglich ist (siehe §16.3). Engineers
  passen das Live-Schema entsprechend an.
- **Annahme:** Counter-Proposal-Flow (US-13) bleibt im Bestand-Modus
  (Slot-basiert) — neue IT3-Buchungen ohne `slotId` können in IT3
  noch nicht counter-proposed werden. Diese Lücke ist akzeptabel,
  weil Tom in der Praxis selten Counter-Proposals sendet und im
  Worst Case manuell anrufen kann. Vollständige IT3-Counter-Proposal-
  Logik ist Iteration 4.
- **Annahme:** Vercel Blob-Region ist EU (DSGVO-konform). Engineers
  setzen das beim Provisionieren über Vercel Dashboard.
- **Annahme:** Statische Review-Daten (US-22) werden später durch
  Backend-Modell ersetzt (Iteration 4 / US-29) — Datenstruktur ist
  schon kompatibel.
- **Annahme:** Service-Popup-Bilder (Vorher/Nachher) sind Platzhalter
  in IT3; Tom liefert echte Fotos nach.
- **Annahme:** Iteration 3 nutzt **Variante 2** der Calendar-Daten-
  Beschaffung (Server-Component liest direkt aus Prisma), kein
  öffentlicher GET-Endpoint für Template/Overrides.
- **Annahme:** "Sonstiges"-Beschreibung wird mit 30 Zeichen
  (`CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH`) abgesichert. Tom kann
  diesen Wert später anpassen.

### 16.16 Akzeptanzkriterien-Mapping IT3

| Story | Erfüllt durch                                                                                                              |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| BUG IT3 | `BookingForm.tsx`-Refactor (siehe `BUG_BOOKING_IT3.md`); slot/date/time aus RHF-Form-Schema entfernt.                   |
| US-17 | `AvailabilityTemplate` + `DayOverride` Schemas; `GET /api/slots/available` als öffentlicher Calc-Endpoint; Admin-UI unter `/admin/availability`. |
| US-18 | Vercel Blob via `POST /api/upload`; `BookingAttachment`-Modell; `FileUpload.tsx` + `BookingAttachmentList.tsx`.            |
| US-19 | `'sonstiges'` in `SERVICES`; `superRefine` zwingt 30-Zeichen-Beschreibung.                                                |
| US-20 | Statische Preise in `lib/services.ts` (`priceFrom`/`priceUnit`/`priceNote`); UI-Anzeige auf Service-Karten + Popups.       |
| US-21 | `GET /api/admin/upcoming-bookings`; `<UpcomingBookingsList>` auf Dashboard-Page.                                          |
| US-22 | `lib/reviews.ts` mit 10 statischen Datensätzen; `<ReviewSection>` auf Startseite.                                         |
| US-23 | `<ServiceModal>` mit Vorher/Nachher, Inhalt aus `services.ts.details`.                                                    |
| US-24 | `bookingConfirmationToCustomer` + `bookingRejectionToCustomer` in `lib/mail.ts`; Trigger im `PATCH /api/bookings/:id`.    |

---

## 17. Iteration 4 — Detail-Spec (US-25 bis US-29)

Iteration 4 ist die bisher umfangreichste Iteration. Sie führt drei
voneinander entkoppelte Subsysteme ein:

1. **Kunden-Auth & Portal** (US-25, US-26, US-27) — eigene Auth-Mechanik
   neben NextAuth-Admin, ohne dass eines das andere beeinflusst.
2. **Stripe-Zahlungen** (US-28) — externer Payment-Provider, integriert
   via Checkout-Sessions + Webhook.
3. **Bewertungs-Backend** (US-29) — Admin-moderierte Reviews ersetzen
   die statische Liste aus IT3.

Verbindendes Element: der neue Booking-Status `COMPLETED` schaltet den
Bewertungs-Flow frei und kann optional Voraussetzung für die endgültige
Zahlungs-Quittung sein (im MVP nicht erzwungen — Tom kann Zahlung schon
vor COMPLETED hinterlegen).

### 17.1 Kunden-Auth-Architektur (US-25)

#### Entscheidung: Eigenes JWT-Cookie vs. zweite NextAuth-Instanz

**Gewählt: Eigenes JWT-Cookie `customer-session`.**

Begründung:

- NextAuth v5 unterstützt zwar mehrere Provider, aber die Trennung von
  zwei voneinander unabhängigen User-Tabellen (Admin vs. Kunde) führt
  zu Komplexität in `auth.config.ts` (verschiedene `pages.signIn`-
  Routen, getrennte Callbacks, Session-Cookie-Namensraum).
- Eine eigene, leichtgewichtige JWT-Session ist ~150 Zeilen Code
  (Cookie setzen / lesen / löschen + JWT-Sign/Verify). Sie hat:
  - keine Auswirkung auf das bestehende Admin-Auth (BUG-005-Härtung
    bleibt unverändert),
  - einen eigenen Cookie-Namen (`customer-session`),
  - identische Sicherheits-Eigenschaften (httpOnly, Secure, SameSite=Lax).
- Beide Sessions können parallel im selben Browser existieren — ein
  CustomerUser, der zufällig auch Admin ist (Tom?), kann sich in beide
  Bereiche einloggen.

#### Helper-Funktionen (`src/lib/customer-auth.ts`)

```ts
// Pseudocode
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET!,
);
const COOKIE_NAME = 'customer-session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 Tage

export interface CustomerSession {
  customerId: string;
  email: string;
}

export async function createCustomerSession(
  payload: CustomerSession,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(SECRET);
}

export function setCustomerSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearCustomerSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function readCustomerSession(): Promise<CustomerSession | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return { customerId: String(payload.customerId), email: String(payload.email) };
  } catch {
    return null;
  }
}

/** Variante für Edge-Middleware (cookie-only — kein DB-Lookup). */
export async function readCustomerSessionFromRequest(
  req: NextRequest,
): Promise<CustomerSession | null> { /* gleiche Logik mit req.cookies */ }
```

**Wichtig — Edge vs. Node:** Die Middleware (Edge-Runtime) darf nur
`jose` (ESM, edge-kompatibel) und keinen Prisma-Client importieren. Sie
prüft **nur** die JWT-Validität (Signatur + exp). Tieferer DB-Check
(z.B. emailVerified) erfolgt im Route-Handler.

#### Middleware-Erweiterung (`src/middleware.ts`)

Die bestehende Middleware schützt nur `/admin/*`. Iteration 4 ergänzt
einen zweiten Matcher für `/konto/*`:

```ts
// Pseudocode (vereinfacht — Engineers fassen die zwei matcher in einer
// einzigen Middleware-Funktion zusammen).
import { authConfig } from '@/lib/auth.config';
import { readCustomerSessionFromRequest } from '@/lib/customer-auth';

const PUBLIC_KONTO_PATHS = [
  '/konto/login',
  '/konto/registrieren',
  '/konto/passwort-vergessen',
  '/konto/passwort-zuruecksetzen',
  '/konto/verifizieren',
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /admin/* — bestehende Logik
  if (pathname.startsWith('/admin')) { /* unverändert */ }

  // /konto/* — IT4
  if (pathname.startsWith('/konto')) {
    // /konto/zahlung/:id ist öffentlich, wenn ?token=cancelToken vorhanden
    // ist — sonst Login-Pflicht.
    if (pathname.startsWith('/konto/zahlung/')) {
      const token = req.nextUrl.searchParams.get('token');
      if (token) return NextResponse.next();
    }
    if (PUBLIC_KONTO_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return NextResponse.next();
    }
    const session = await readCustomerSessionFromRequest(req);
    if (session) return NextResponse.next();
    const loginUrl = new URL('/konto/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/konto/:path*'],
};
```

#### Sicherheits-Praktiken (Kunden-Auth)

- **Passwort-Hashing:** bcrypt cost 10 (gleich wie Admin).
- **Login-Fehler:** generische Message — keine Auskunft, ob E-Mail
  existiert (BUG-005-Pattern wiederverwendet, inkl. konstanter
  bcrypt-Last gegen Timing-Angriff).
- **Verifikations-Pflicht:** Login mit `emailVerified: false` schlägt
  mit 422 fehl. Konto kann erst nach Verifikation genutzt werden.
- **Token-Ablauf (BUG-401-Fix v1.4.1):**
  - `verificationToken`: 24h, geprüft via dedizierter Spalte
    `verificationTokenExpiry DateTime?`. Bei Registrierung UND bei
    `POST /api/customer/resend-verification` wird das Feld gesetzt
    auf `now + 24h`. Verify-Endpoint prüft `verificationTokenExpiry > now`.
    Engineers-Hinweis: NICHT mehr `createdAt` für die Ablauf-Prüfung
    nutzen — das ist das Symptom, das BUG-401 ausgelöst hat.
  - `resetToken`: 1h (`resetTokenExpiry`).
- **Profil-E-Mail-Änderung (BUG-402-Fix v1.4.1):**
  - Im MVP **nicht erlaubt**. `CustomerProfileUpdateSchema` ist
    `.strict()` und akzeptiert nur firstName/lastName/phone. Versuche,
    `email` zu setzen, geben 400 `VALIDATION_ERROR` zurück.
  - Begründung: Eine echte E-Mail-Änderung erfordert einen Pending-
    State-Mechanismus (`pendingEmail`, `pendingEmailToken`,
    `pendingEmailTokenExpiry`), damit der Login unter der alten
    Adresse bedienbar bleibt, bis die neue verifiziert ist. Diese
    drei Spalten + Verify-Endpoint sind Backlog (IT5, eigene Story).
  - Frontend-Verhalten: Profil-Form zeigt das `email`-Feld read-only
    mit Hinweistext: "E-Mail-Adresse kann derzeit nicht selbst geändert
    werden. Bitte wenden Sie sich an unser Team."
  - Engineers-Hinweis: Tom kann im Notfall (z.B. Tippfehler bei
    Registrierung) eine E-Mail manuell via Prisma Studio korrigieren.
- **Enumeration-Schutz:** `forgot-password` und `resend-verification`
  antworten **immer** 200, unabhängig von Konto-Existenz.
- **Brute-Force:** Rate-Limits via Upstash (siehe API-Spec §20).
- **CSRF:** Da wir SameSite=Lax und JSON-Bodies nutzen, ist CSRF für
  POST-Endpunkte automatisch entschärft. Engineers sollten KEIN
  Form-Submit (multipart) für Customer-Endpunkte nutzen (außer Upload,
  der keine Auth-Aktion ist).
- **Open-Redirect-Schutz für Login (MAJOR-405-Fix v1.4.1):**
  - `POST /api/customer/login` akzeptiert ein optionales `redirectUrl`
    im Body. Middleware setzt es als `?callbackUrl=<pathname>` beim
    Login-Redirect.
  - Beide Werte werden vor Verwendung durch
    `safeCustomerCallback(input)` (in `src/lib/customer-auth.ts`)
    validiert:

```ts
/**
 * Akzeptiert NUR relative Pfade ohne Protokoll/Host.
 * Liefert bei Verstoß den Default '/konto'.
 *
 * Verworfen wird:
 *   - Strings ohne führendes '/' ('konto' → fail)
 *   - Protokoll-relative URLs ('//evil.example/login' → fail)
 *   - URLs mit Schema (':' oder '\\' enthalten → fail)
 *   - Strings mit Whitespace
 *   - Externe Origins (URL-Parse → host !== '')
 */
export function safeCustomerCallback(input: unknown): string {
  const FALLBACK = '/konto';
  if (typeof input !== 'string' || input.length === 0) return FALLBACK;
  if (!input.startsWith('/')) return FALLBACK;
  if (input.startsWith('//')) return FALLBACK;       // protocol-relative
  if (/[:\\\s]/.test(input)) return FALLBACK;        // scheme/backslash/whitespace
  if (input.length > 512) return FALLBACK;           // sanity
  return input;
}
```

  - Wirkungs-Punkte:
    1. `POST /api/customer/login` — Backend validiert `redirectUrl`
       (Body) und gibt den geprüften Wert in `data.redirectUrl` zurück.
    2. `LoginForm.tsx` — vor `router.push()` validieren, falls
       Frontend zusätzlich aus der Query liest.
    3. Middleware — `loginUrl.searchParams.set('callbackUrl', pathname)`
       schreibt eingehende Pfade weiter, validiert wird beim Login.
  - Engineers-Hinweis: Der Helper-Test (`safeCustomerCallback`) ist
    Pflicht-Unit-Test im Test-Plan §17.8 (mit den oben genannten
    Failure-Cases als Negative-Cases).

### 17.2 Datenmodell-Änderungen IT4

#### Neue Tabellen

| Tabelle         | Zweck                                                                               | Schema-Detail                                                                     |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `customer_users`| Kunden-Account (US-25).                                                             | id, email (UNIQUE), password_hash, first_name, last_name, phone?, email_verified, verification_token (UNIQUE), reset_token (UNIQUE), reset_token_expiry, created_at, updated_at. |
| `payments`      | Stripe-Zahlung 1:1 zu Booking (US-28).                                              | id, booking_id (UNIQUE), stripe_session_id (UNIQUE), amount (Cents), currency, description, status, paid_at, created_at, updated_at. |
| `reviews`       | Kundenbewertung 1:1 zu Booking (US-29).                                             | id, customer_id?, booking_id (UNIQUE), stars (1–5), text?, approved, created_at, updated_at. |

#### Neue Felder an `bookings`

| Feld           | Typ      | Constraints                                                  | Bemerkung                                            |
| -------------- | -------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| `customer_id`  | TEXT     | NULL, FK → customer_users.id ON DELETE SET NULL, INDEX       | Verknüpfung zum Kundenkonto (Gastbuchung = NULL).    |

#### Status-Erweiterung

`BookingStatus` erhält den neuen Wert `COMPLETED`. CHECK-Constraint in
`schema.sql` entsprechend erweitert. Prisma-Enum-Eintrag ebenso.

#### Migration (Prisma)

```bash
prisma migrate dev --name iteration4_customer_portal_payments_reviews
```

Migrationsschritte (Engineers):

1. `customer_users`-Tabelle anlegen.
2. `bookings.customer_id` als nullable Spalte mit FK ergänzen.
3. `bookings.status`-CHECK aktualisieren (`COMPLETED` zusätzlich erlaubt).
   Prisma erzeugt das automatisch aus dem Enum; SQLite erfordert ggf.
   ein manuelles Recreate-Pattern (Engineers prüfen Prisma-Output).
4. `payments`-Tabelle anlegen.
5. `reviews`-Tabelle anlegen.
6. Indexe anlegen (siehe `schema.sql`).

**Datenmigration:** Keine Backfill nötig. Bestehende Buchungen behalten
`customer_id = NULL` (Gastbuchungen).

### 17.3 Frontend-Architektur Iteration 4

#### Neue Pages

```
src/app/
├── konto/
│   ├── layout.tsx                       # Kunden-Header + Footer
│   ├── login/page.tsx                   # US-25 AC3
│   ├── registrieren/page.tsx            # US-25 AC1
│   ├── passwort-vergessen/page.tsx      # US-25 AC5
│   ├── passwort-zuruecksetzen/page.tsx  # US-25 AC6 (?token=...)
│   ├── verifizieren/page.tsx            # US-25 AC2 (?token=...)
│   ├── page.tsx                         # Auftragsübersicht (US-26)
│   ├── auftrag/[id]/page.tsx            # Detail (US-26 AC4, US-27, US-29)
│   ├── profil/page.tsx                  # Profil-Update (US-25 AC10)
│   └── zahlung/
│       ├── [bookingId]/page.tsx         # Stripe-Checkout-Auslöser (US-28)
│       └── erfolg/page.tsx              # Stripe-Redirect-Ziel (?session_id=...)
└── admin/
    └── reviews/page.tsx                 # NEU IT4 — Bewertungs-Moderation (US-29)
```

#### Neue Komponenten

| Pfad                                             | Status   | Zweck                                                                |
| ------------------------------------------------ | -------- | -------------------------------------------------------------------- |
| `components/customer/CustomerHeaderMenu.tsx`     | NEU      | Header-Menü mit Logout-Button, Profil-Link.                          |
| `components/customer/RegisterForm.tsx`           | NEU      | Registrierungs-Formular.                                             |
| `components/customer/LoginForm.tsx`              | NEU      | Login-Formular.                                                      |
| `components/customer/ForgotPasswordForm.tsx`     | NEU      |                                                                       |
| `components/customer/ResetPasswordForm.tsx`      | NEU      |                                                                       |
| `components/customer/CustomerBookingsList.tsx`   | NEU      | Liste mit Tabs "Bevorstehend"/"Vergangen".                           |
| `components/customer/BookingDetailCard.tsx`      | NEU      | Detail-Anzeige inkl. Status-Badge.                                   |
| `components/customer/CancelBookingButton.tsx`    | NEU      | Confirm-Dialog + POST `/api/customer/bookings/:id/cancel`.           |
| `components/customer/ReviewForm.tsx`             | NEU      | 5-Sterne-Picker + Textarea.                                           |
| `components/customer/StripeCheckoutButton.tsx`   | NEU      | "Mit PayPal/Karte/Apple Pay/Google Pay bezahlen" → POST create-session. |
| `components/admin/PaymentEditor.tsx`             | NEU      | Modal: Betrag in Euro eingeben, in Cents umrechnen, POST.            |
| `components/admin/ReviewModerationTable.tsx`     | NEU      | Reviews mit Approve/Reject-Buttons.                                  |
| `components/home/ReviewSection.tsx`              | UMGEBAUT | Liest jetzt von `GET /api/reviews`; Fallback auf statische Daten falls < 4 approved. |

#### API-Client-Erweiterungen (`src/lib/api-client.ts`)

```ts
// Neue Funktionen (Auswahl):
export async function customerRegister(input: CustomerRegisterInput): Promise<...>;
export async function customerLogin(input: CustomerLoginInput): Promise<CustomerUserPublic>;
export async function customerLogout(): Promise<void>;
export async function fetchMe(): Promise<CustomerUserPublic | null>;
export async function fetchMyBookings(): Promise<CustomerBookingsResponse>;
export async function cancelMyBooking(id: string): Promise<...>;
export async function createPaymentSession(bookingId: string, cancelToken?: string): Promise<{ url: string }>;
export async function createReview(input: CreateReviewInput): Promise<Review>;
export async function fetchPublicReviews(limit?: number): Promise<{ items: PublicReview[]; average: number; total: number }>;
```

### 17.4 Stripe-Integration Architektur (US-28)

#### Stack-Entscheidung: Stripe Checkout vs. Stripe Elements

Wir nutzen **Stripe Checkout** (hosted page) statt Stripe Elements (embedded).

| Kriterium             | Checkout (gewählt)                                        | Elements                                            |
| --------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| PCI-Compliance        | Stripe handhabt alles (SAQ-A).                            | Wir hosten Karten-Eingabe — höhere PCI-Anforderung. |
| Implementierungsaufwand | ~50 Zeilen Code (`stripe.checkout.sessions.create`).    | UI-Komponenten + Stripe.js + Theme-Anpassung.        |
| PayPal/Apple/Google Pay | Out-of-the-box.                                          | Manuell zu konfigurieren.                            |
| Branding              | Begrenzt (Logo + Farbe in Stripe Dashboard).              | Vollständig.                                         |
| Mobile UX             | Stripe-optimiert (Wallets, Touch-friendly).               | Eigene Mobile-Optimierung nötig.                    |

Stripe Checkout deckt unsere Anforderung (US-28: PayPal + Apple Pay +
Google Pay) ab und reduziert PCI-Verantwortung auf SAQ-A. Branding-
Trade-off ist akzeptabel.

#### Beträge in Cents

Stripe-Konvention: Beträge sind Integer in der Subwährungs-Einheit
(Cents für EUR). Wir persistieren **immer** Cents (Spalte
`payments.amount INTEGER`). Frontend rechnet bei Anzeige in Euro um.

Begründung: Float-Persistenz verursacht Rundungsfehler (`14.99 € →
1499 cent`, nicht `14.989999... €`). Stripe erwartet ohnehin Cents.

#### Webhook-Sicherheit

Stripe sendet Webhooks an `POST /api/payments/webhook`. Drei
Verteidigungslinien:

1. **Signatur-Check** mit `STRIPE_WEBHOOK_SECRET`. Verstoß → 400.
2. **Idempotenz**: vor jedem Update Status-Check (PAID + erneuter
   `checkout.session.completed` → keine zweite Mail).
3. **Raw-Body-Lesen**: Next.js parst JSON automatisch. Für Webhook
   muss der Handler `await req.text()` aufrufen (vor dem JSON-Parse),
   damit die Signatur über den unveränderten Bytes berechnet werden
   kann.

```ts
// Pseudocode src/app/api/payments/webhook/route.ts
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature', { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': await handleCompleted(event); break;
    case 'checkout.session.expired':   await handleExpired(event); break;
    case 'payment_intent.payment_failed': await handleFailed(event); break;
    case 'charge.refunded':            await handleRefunded(event); break;
    default: /* ignore */ break;
  }

  return Response.json({ received: true });
}
```

#### Test-Mode vs. Live-Mode

- **Development:** `STRIPE_SECRET_KEY=sk_test_...` + Stripe CLI
  (`stripe listen --forward-to localhost:3000/api/payments/webhook`)
  für lokale Webhook-Tests.
- **Production:** `sk_live_...` + Webhook-Endpoint im Stripe Dashboard
  registrieren mit den 4 oben genannten Event-Types.

#### `lib/stripe.ts` — Singleton

```ts
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY ist nicht gesetzt.');
  _stripe = new Stripe(key, { apiVersion: '2024-04-10' });
  return _stripe;
}
```

### 17.5 E-Mail-Templates Iteration 4

| Template-Key                       | Trigger                                          | Empfänger | Wesentliche Inhalte                                            |
| ---------------------------------- | ------------------------------------------------ | --------- | -------------------------------------------------------------- |
| `customerVerificationMail`         | `POST /api/customer/register` UND `POST /api/customer/resend-verification` | Kunde | Verifikations-Link `${BASE_URL}/konto/verifizieren?token=...`. **Hinweis (BUG-401-Fix):** beide Trigger setzen den Token UND `verificationTokenExpiry = now + 24h`. |
| `customerPasswordResetMail`        | `POST /api/customer/forgot-password`             | Kunde     | Reset-Link `${BASE_URL}/konto/passwort-zuruecksetzen?token=...` |
| `paymentRequestToCustomer`         | `POST /api/admin/bookings/:id/payment`           | Kunde     | Fälliger Betrag, Link `${BASE_URL}/konto/zahlung/:bookingId?token=...` |
| `paymentReceivedToCustomer`        | Stripe `checkout.session.completed`              | Kunde     | "Vielen Dank, Zahlung eingegangen"; Auftragsdetails.           |
| `paymentReceivedToAdmin`           | Stripe `checkout.session.completed`              | Tom       | "Zahlung eingegangen"; Kundendaten + Betrag.                    |
| `paymentRefundedToCustomer`        | Stripe `charge.refunded`                         | Kunde     | "Rückerstattung erfolgt"; Betrag.                              |

**ENTFERNT in v1.4.1 (BUG-402-Fix):** `customerEmailChangedMail` —
E-Mail-Änderung im MVP nicht angeboten, Template entfällt damit
ebenfalls. Wenn Tom dies in IT5 wieder aktiviert (Story
"E-Mail-Änderung mit Pending-State"), kommt das Template zurück.

Implementation analog zu IT2/IT3-Templates in `src/lib/mail.ts`.

### 17.6 UI-States Iteration 4

#### `/konto/login` (US-25 AC3, AC4)

| State           | Trigger                                          | UI                                                                |
| --------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| Idle            | Initial-Load                                      | Form mit E-Mail + Passwort + "Passwort vergessen"-Link.            |
| Submitting      | POST läuft                                        | Submit-Button disabled, Spinner.                                   |
| AuthError       | 401                                               | Banner "E-Mail oder Passwort ungültig" (generisch).                |
| EmailNotVerified| 422 EMAIL_NOT_VERIFIED                            | Banner + "Bestätigungs-E-Mail erneut senden"-Button (resend-verification). |
| RateLimited     | 429                                               | Banner "Zu viele Anmelde-Versuche. Bitte 15 Minuten warten."        |
| Success         | 200                                               | Redirect auf `?callbackUrl=...` oder `/konto`.                     |

#### `/konto/registrieren` (US-25 AC1)

| State        | UI                                                                                  |
| ------------ | ----------------------------------------------------------------------------------- |
| Idle         | Form: Vorname, Nachname, E-Mail, Passwort, Telefon (optional), DSGVO-Checkbox.       |
| Submitting   | Disabled.                                                                           |
| Success      | Banner "Bitte bestätigen Sie Ihre E-Mail-Adresse." + Hinweis auf Spam-Ordner.        |
| EmailTaken   | 409 → Inline-Error am E-Mail-Feld: "Diese E-Mail ist bereits registriert."           |
| Validation   | Inline-Errors (Passwort < 8, ungültige Mail, etc.).                                  |

#### `/konto` (Übersicht, US-26)

| State        | UI                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------- |
| Loading      | Skeleton-Cards (3 Stück).                                                                    |
| Empty        | "Sie haben noch keine Aufträge." + CTA "Ersten Auftrag buchen" → `/buchung`.                |
| Ready        | Zwei Sektionen: "Bevorstehende Termine" und "Vergangene Aufträge", jeweils chronologisch.    |
| Error        | Banner mit Retry-Button.                                                                     |

#### `/konto/auftrag/:id` (Detail, US-26 AC4, US-27, US-29)

| State              | UI                                                                                |
| ------------------ | --------------------------------------------------------------------------------- |
| Loading            | Skeleton-Card.                                                                    |
| Ready              | Buchungsdetails, Status-Badge, ggf. Stornieren-Button, ggf. Bewerten-Button, ggf. Bezahlen-Button. |
| CancelDialog       | "Möchten Sie diesen Termin wirklich stornieren?" mit Ja/Nein.                     |
| Cancelled          | Status-Badge wechselt sofort, Stornieren-Button verschwindet, Toast.              |
| CancelTooLate      | Stornieren-Button disabled mit Hint "Stornierung nur bis 24h vor Termin möglich. Bitte rufen Sie uns an: 0157-74787512." |
| ReviewSubmitting   | Bewertungs-Button disabled mit Spinner.                                            |
| ReviewSubmitted    | "Vielen Dank für Ihre Bewertung! Sie wird nach Freigabe veröffentlicht." + Form schreibgeschützt. |
| ReviewExisting     | Schon bewertet: Sterne + Text werden read-only angezeigt.                          |

#### `/konto/zahlung/:bookingId` (US-28)

| State        | UI                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------- |
| Loading      | Spinner.                                                                                            |
| Ready        | Auftragsdetails + Betrag + "Mit PayPal/Karte/Apple Pay/Google Pay bezahlen"-Button (Stripe-Checkout). |
| AlreadyPaid  | Banner "Diese Buchung wurde bereits bezahlt am ...".                                                 |
| Failed       | Banner "Letzte Zahlung fehlgeschlagen — bitte erneut versuchen.".                                    |
| Submitting   | Button disabled mit Spinner; nach Response: window.location = stripe-url.                            |

#### `/konto/zahlung/erfolg` (Stripe-Redirect-Ziel) — MAJOR-402-Fix v1.4.1

Client-Component liest `?session_id=...`, **polled** den öffentlichen
Endpoint `GET /api/payments/session-status?session_id=...`
(siehe API-Spec §13). Der Endpoint braucht **keine** Customer-Session —
damit funktioniert die Erfolgsseite auch für Gäste, die ohne Login
über einen Bezahl-Mail-Link zur Stripe-Checkout-Seite kamen.

**Polling-Verhalten:**

```ts
// Frontend pseudocode
const MAX = PAYMENT_SESSION_POLL_MAX_ATTEMPTS; // 5
const INTERVAL = PAYMENT_SESSION_POLL_INTERVAL_MS; // 1000

for (let i = 0; i < MAX; i++) {
  const res = await fetch(`/api/payments/session-status?session_id=${sid}`);
  const { data } = await res.json();
  if (data.status === 'PAID')   { showSuccess(data); return; }
  if (data.status === 'FAILED') { showFailed(data);  return; }
  await sleep(INTERVAL);
}
showStillProcessing(); // Fallback nach 5 Tries
```

| State           | Trigger                                    | UI                                                                                                |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| WaitingWebhook  | Initial / `status === 'PENDING'`           | "Wir verarbeiten Ihre Zahlung..." mit Spinner. Polling läuft (max 5 × 1s).                        |
| Success         | `status === 'PAID'`                        | "Vielen Dank! Zahlung erhalten." Eingeloggte Kunden bekommen zusätzlich einen Link auf `/konto/auftrag/<bookingId>`. Gäste sehen nur statischen Text. |
| Failed          | `status === 'FAILED'`                      | "Die Zahlung konnte nicht abgeschlossen werden. Bitte erneut versuchen." + Retry-Link auf `/konto/zahlung/<bookingId>?token=...` (Gast) bzw. `/konto/zahlung/<bookingId>` (eingeloggt). |
| StillProcessing | Nach 5 Polling-Versuchen weiterhin PENDING | "Wir verarbeiten Ihre Zahlung. Sie erhalten in Kürze eine E-Mail-Bestätigung." (kein weiterer Poll-Loop). |
| NotFound        | 404 von session-status                     | Freundlicher Fallback "Bitte später erneut prüfen." (passiert im Race-Case, wenn Stripe schneller redirected als unsere DB den `stripeSessionId` schreibt — sollte selten sein). |

**Gäste-Erkennung:** Frontend prüft, ob `customer-session`-Cookie
clientseitig sichtbar ist (oder fragt `/api/customer/me` mit
`credentials: 'include'`; bei 401 ist der User Gast). Der Detail-Link
`/konto/auftrag/...` wird ausgeblendet — der Gast hätte sonst nur
einen 401 nach dem Klick.

#### `/admin/reviews` (US-29 Moderation)

| State        | UI                                                                                  |
| ------------ | ----------------------------------------------------------------------------------- |
| Tabs         | "Wartend auf Freigabe" / "Veröffentlicht" / "Alle".                                  |
| Per Eintrag  | Sterne, Text, Kunde, Service, Datum, "Freigeben"-Button bzw. "Zurückziehen"-Button. |
| Confirm      | Modal: "Bewertung freigeben? Sie wird sofort auf der Startseite sichtbar."           |

### 17.7 Sicherheits-Aspekte Iteration 4

#### Authentifizierung (Kunden)

- bcrypt cost 10 (gleich wie Admin).
- JWT mit HS256, signiert mit `AUTH_SECRET` (32+ Zeichen Random).
- Cookie httpOnly + Secure + SameSite=Lax.
- Rate-Limits siehe API-Spec §20.

#### Autorisierung

- Jeder `/api/customer/*`-Endpunkt (außer Auth-Aktionen) prüft die
  Session am Anfang und antwortet 401 ohne Cookie.
- Ressourcen-Zugriff: jeder Booking/Review/Payment-Endpunkt prüft
  Ownership (`customerId === me.id`) und antwortet **404** (NICHT 403)
  bei Fremdzugriff — verhindert Existenz-Enumeration.

#### Open-Redirect-Schutz für Customer-Login (MAJOR-405-Fix v1.4.1)

Identische Pattern wie BUG-005-Fix für Admin: `redirectUrl` (Body) und
`callbackUrl` (Query) werden via `safeCustomerCallback()` geprüft.
Akzeptiert sind ausschließlich relative Pfade ohne Protokoll/Host
(siehe §17.1 für Helper-Code). Ungültige Werte → Fallback `/konto`.

#### Stripe-Webhook-Authentizität

Pflicht-Signatur-Check via `STRIPE_WEBHOOK_SECRET`. Ohne Check
könnte jeder POSTen und Bezahl-Status faken — deshalb **harte
Anforderung**, dass die Signatur vor jeder DB-Schreibaktion validiert
ist (siehe §17.4).

#### Stripe-Session-Status-Endpoint (MAJOR-402-Fix v1.4.1)

`GET /api/payments/session-status?session_id=cs_...` ist öffentlich
(kein Auth-Cookie). Begründung: Stripe-Session-IDs sind hochentropisch
und nur dem Käufer bekannt — sie wirken token-artig. Der Endpoint
liefert ausschließlich `{ sessionId, status, paidAt, bookingId }` —
**kein** Kunden-PII, keine Booking-Details. Damit ist eine Enumerierung
auch im Worst Case (Angreifer kennt die Session-ID) unproblematisch:
er erfährt nur "wurde bezahlt: ja/nein", was er als Käufer eh wüsste.

Rate-Limit: 60 / 5 min / IP (das FE-Polling braucht max. 5 Calls in 5s,
die Begrenzung ist ein Sanity-Cap gegen Polling-Loop-Bugs).

#### Datenschutz

- Reviews: `customerName` wird auf der öffentlichen API auf "Vorname N."
  gekürzt (Backend, im Response-Mapper, MAJOR-403-Fix v1.4.1 — kein
  DB-Snapshot, nur Live-Join).
- Konto-Löschung: im MVP kein Self-Service. Wird Tom benötigt, kann er
  via Prisma Studio einen `CustomerUser` löschen — die FK
  `Booking.customerId` wird dann auf NULL gesetzt (SET NULL); Reviews
  bleiben ebenfalls erhalten (nur ohne Bezug zum gelöschten Konto).
  In diesem Fall greift der Review-Anzeige-Fallback `customerName = 'Anonym'`.
  Engineers ergänzen einen `DELETE /api/customer/me`-Endpunkt nur
  auf Anforderung. Wird Tom später Account-Delete einführen, müssen
  Engineers eine Snapshot-Spalte `Review.customerName` ergänzen, damit
  ältere Reviews ihren Anzeigenamen nicht verlieren.
- Aufbewahrung: CustomerUser-Daten unbegrenzt (analog zum Admin). Bei
  Anfrage zur DSGVO-Löschung manuell in Prisma Studio.

#### Race-Conditions

- **Doppelter Stripe-Webhook**: Status-Check vor Update verhindert
  doppelten Mail-Versand.
- **Doppelte Review-Erstellung**: UNIQUE-Index auf `reviews.booking_id`
  fängt parallele Inserts auf DB-Ebene → 409.
- **Stornierung kurz vor 24h-Frist**: Frontend-Check + Server-Check
  beide vorhanden; Server-Check ist Authority.

#### Storno-Frist-Algorithmus — Berlin-Zeitzone & DST (MAJOR-401-Fix v1.4.1)

**Frist:** 24 Stunden physische Echtzeit (NICHT 24 naïve Berlin-
Wand-Uhr-Stunden). Algorithmus:

```ts
// Pseudocode in src/lib/cancellation.ts
import { fromZonedTime } from 'date-fns-tz';

const TZ = 'Europe/Berlin';

/**
 * Interpretiert "YYYY-MM-DD" + "HH:MM" als Berlin-Wall-Clock und
 * liefert einen UTC-Date. DST-fest: am letzten Sonntag im März
 * existiert die Stunde 02:00–03:00 nicht (Spring-Forward); wenn ein
 * Termin in dieser Lücke liegt, gibt date-fns-tz die nächst-folgende
 * gültige Wall-Clock zurück. Am letzten Sonntag im Oktober existiert
 * die Stunde 02:00–03:00 doppelt; wir wählen die SPÄTERE (zweite)
 * Belegung — Stripe-Mail-Versand und Tom-Tagesplanung sind so
 * deterministisch.
 */
export function parseBerlinDateTime(date: string, time: string): Date {
  return fromZonedTime(`${date}T${time}:00`, TZ);
}

export function isCancellableConfirmed(date: string, time: string, now = new Date()): boolean {
  const start = parseBerlinDateTime(date, time);
  return start.getTime() - now.getTime() > 24 * 60 * 60 * 1000;
}
```

**Konsequenz für DST-Tage:**

- *Spring-forward (März):* Termin Sonntag 10:00 Berlin nach DST. Storno
  Samstag 10:00 Berlin → Differenz physisch nur **23 Stunden** → 24h-
  Test schlägt fehl → Storno gesperrt. (Korrekt: weniger als 24h echte
  Vorlaufzeit für Tom.)
- *Fall-back (Oktober):* Termin Sonntag 10:00 Berlin nach DST. Storno
  Samstag 10:00 Berlin → Differenz physisch **25 Stunden** → 24h-Test
  passiert → Storno erlaubt. (Korrekt: Tom hat physisch 25h Vorlauf.)

Dies ist die intuitive Lesart aus Tom-Sicht („wirklich 24 h vor dem
Termin Bescheid geben"); die andere Lesart („1 Kalendertag vorher")
wird damit bewusst verworfen.

**Test-Plan §17.8 Pflichttests:**
1. Termin am 26.10.2026 10:00 Berlin (Fall-back-Sonntag), Storno am
   25.10.2026 10:00 Berlin → erlaubt (25h echte Differenz).
2. Termin am 29.03.2026 10:00 Berlin (Spring-forward-Sonntag), Storno
   am 28.03.2026 10:00 Berlin → gesperrt (23h echte Differenz).

#### `isCancellable()` Null-Robustheit (MAJOR-404-Fix v1.4.1)

Der Algorithmus für die Cancellable-Bewertung muss drei Eingangs-Fälle
sauber behandeln:

```ts
function bookingStartUTC(b: Booking & { slot?: Slot | null }): Date | null {
  if (b.date && b.startTime) return parseBerlinDateTime(b.date, b.startTime);
  if (b.slot?.startsAt)      return new Date(b.slot.startsAt);   // IT1/IT2-Bestand
  return null;                                                    // unbekannt
}

function isCancellable(b: Booking & { slot?: Slot | null }): boolean {
  if (!PORTAL_CANCELLABLE_STATUSES.includes(b.status)) return false;
  const start = bookingStartUTC(b);
  if (!start) return true;          // unbekannter Termin → defensiv true; Server prüft erneut
  if (b.status === 'CONFIRMED') {
    return start.getTime() - Date.now() > 24 * 60 * 60 * 1000;
  }
  return start.getTime() > Date.now();
}
```

**Begründung:**

- Buchungen mit `date && startTime` (Standard-Fall IT3+) → Berlin-DST-fest.
- Buchungen mit `slot.startsAt` (IT1/IT2-Bestand) → UTC direkt.
- Buchungen ohne beides → semantisch: unbekannter Termin. Wir geben
  `true` zurück, damit der Kunde nicht in einer Sackgasse hängt; der
  POST-Cancel-Endpoint wiederholt den Check und 409, falls die Frist
  nicht erfüllt ist (Server bleibt Authority).

**Frontend-Komponente:** `<CancelBookingButton>` zeigt bei
`isCancellable === false` und `b.status === 'CONFIRMED'` den 24h-
Hinweis mit Telefonnummer (siehe §17.6 UI-State `CancelTooLate`). Bei
Status nicht in `PORTAL_CANCELLABLE_STATUSES` (REJECTED/CANCELLED/
COMPLETED) wird der Button gar nicht gerendert.

#### Review-Anzeigename — Datenschutz & Anonymisierung (MAJOR-403-Klärung v1.4.1)

`Review.customerName` ist **kein DB-Feld**. Stattdessen leitet der
Backend-Response-Mapper den Anzeigenamen aus der include'd
`customer`-Relation ab:

```ts
function reviewToPublic(r: Review & { customer: CustomerUser | null; booking: { service: string } | null }): PublicReview {
  const customerName =
    r.customer != null
      ? `${r.customer.firstName} ${r.customer.lastName.charAt(0)}.`  // "Maria M."
      : 'Anonym';                                                     // FK SetNull-Fall
  return {
    id: r.id,
    customerName,
    service: r.booking?.service ?? null,
    stars: r.stars,
    text: r.text,
    createdAt: r.createdAt.toISOString(),
  };
}
```

Im Admin-Endpoint `GET /api/admin/reviews` wird `customerName` aus
demselben Relation-Lookup gebildet — dort allerdings UNGEKÜRZT
(`firstName + ' ' + lastName`), weil Tom die volle Identität für die
Moderations-Entscheidung braucht.

**Wichtig — MVP-Annahme:** Solange kein Self-Service-Account-Delete
existiert, wird `customer === null` praktisch nie auftreten. Wenn Tom
aber eine DSGVO-Löschung manuell ausführt, greift der `'Anonym'`-
Fallback automatisch. Engineers brauchen also keinen Snapshot — bis
Self-Service-Delete (Backlog) kommt.

### 17.8 Test-Plan Iteration 4 (Engineer-Hinweise)

| Bereich          | Test                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Customer-Auth    | E2E: Register → Verify-Mail-Klick → Login → /konto sichtbar.                                |
| Forgot-Password  | E2E: Forgot → Mail → Reset-Link → neues Passwort → Login mit neuem Passwort.                |
| Booking-Zuordnung| Eingeloggt: Buchung absenden → erscheint in `/konto`. Nicht eingeloggt: erscheint nicht.    |
| Cancel 24h-Frist | Buchung 26h in Zukunft → cancellable. 22h → not cancellable, server check 409.              |
| Payment-Flow     | Test-Mode: Tom legt Betrag → Mail an Kunden → Stripe-Checkout (Test-Karte 4242…) → Webhook → Status PAID. |
| Webhook-Idempotenz | Webhook 2× senden → nur 1× Mail.                                                          |
| Webhook-Signatur | Manueller POST ohne Signatur → 400; mit invalider Signatur → 400.                           |
| Review-Flow      | Booking auf COMPLETED → Bewerten-Button sichtbar → Review submit → Tom genehmigt → Review auf Startseite. |
| **BUG-401 Resend** | Konto registrieren, 25h warten (Mock `Date.now`), `resend-verification`, Link sofort klicken → Verifikation **erfolgreich** (NICHT 400). |
| **BUG-402 Profile** | `PATCH /api/customer/me` mit `{ email: 'neu@example.com' }` → 400 `VALIDATION_ERROR`. Mit `{ firstName: 'Maria' }` → 200. |
| **MAJOR-401 DST Spring** | Termin 29.03.2026 10:00 Berlin (Spring-Forward), Storno-Versuch 28.03.2026 10:00 Berlin → 409 (23h echte Differenz). |
| **MAJOR-401 DST Fall** | Termin 26.10.2026 10:00 Berlin (Fall-Back), Storno-Versuch 25.10.2026 10:00 Berlin → 200 (25h echte Differenz). |
| **MAJOR-402 Gast-Erfolg** | Stripe-Checkout ohne Login abschließen → `/konto/zahlung/erfolg?session_id=...` zeigt Success ohne 401. Polling auf `session-status` läuft. |
| **MAJOR-403 Anonym** | Review mit `customerId = NULL` (manuell in DB gesetzt) → `GET /api/reviews` liefert `customerName: "Anonym"`, KEIN 500. |
| **MAJOR-404 Slot-Bestand** | Buchung mit `slotId` und `date = NULL`, Status CONFIRMED, slot.startsAt 26h in Zukunft → `isCancellable === true`. |
| **MAJOR-405 Open-Redirect** | `POST /api/customer/login` mit `redirectUrl: "https://evil.example/login"` → Login OK, Response `data.redirectUrl === '/konto'`. Mit `"//evil.example/login"` → ebenfalls Fallback. Mit `"/konto/auftrag/abc"` → durchgereicht. |
| **safeCustomerCallback unit** | Pflicht-Unit-Tests: `'/konto'` → ok; `''` → `/konto`; `'//x'` → `/konto`; `'http://x'` → `/konto`; `'\\\\x'` → `/konto`; `'/konto?a=b'` → ok. |

### 17.9 ENV-Variablen Iteration 4

| Variable                  | Pflicht | Wert / Beispiel                        | Zweck                                  |
| ------------------------- | ------- | -------------------------------------- | -------------------------------------- |
| `STRIPE_SECRET_KEY`       | ja      | `sk_test_...` / `sk_live_...`          | Stripe-API-Auth (Server-side, US-28).  |
| `STRIPE_PUBLISHABLE_KEY`  | ja      | `pk_test_...` / `pk_live_...`          | Optional (Embedded-Forms, im MVP nicht genutzt — bleibt Backlog für Stripe Elements). |
| `STRIPE_WEBHOOK_SECRET`   | ja      | `whsec_...`                            | Webhook-Signatur-Validierung (US-28).  |
| `AUTH_SECRET`             | ja      | bestehender NEXTAUTH_SECRET-Wert       | Wird für Customer-JWT-Signing wiederverwendet. Engineers können auch ein eigenes `CUSTOMER_AUTH_SECRET` setzen — dann Helper anpassen. |

`.env.example` wird entsprechend ergänzt mit Hinweisen auf den
Test-Mode (`sk_test_...`).

### 17.10 Offene Punkte / Annahmen Iteration 4

- **Annahme:** Stripe-Account ist verfügbar / wird von Tom angelegt
  (kostenlos im Test-Mode). DNS-Verifikation der Stripe-Empfangsdomäne
  ist nicht nötig — nur API-Key + Webhook-URL im Stripe-Dashboard.
- **Annahme (BUG-402-Fix v1.4.1):** Im MVP wird **keine** E-Mail-Änderung
  via Profil angeboten. Der Pending-Email-Mechanismus
  (`pendingEmail` / `pendingEmailToken` / `pendingEmailTokenExpiry`)
  ist Backlog (eigene Story IT5). Wenn ein Kunde die E-Mail unbedingt
  ändern muss, korrigiert Tom sie manuell in Prisma Studio.
- **Annahme:** "Termin abschließen" wird **manuell** von Tom im Admin-UI
  ausgelöst (`PATCH /api/bookings/:id { status: 'COMPLETED' }`). Eine
  automatische Markierung via Cron (z.B. 24h nach Termin-Datum) ist
  Backlog.
- **Annahme:** Stripe-Sessions laufen nach 24h ab (Stripe-Default).
  Wenn ein Kunde eine alte Mail nach >24h klickt, wird automatisch eine
  neue Session erstellt (`POST create-session` ist idempotent / handled
  failed-state).
- **Annahme:** Der Apple-Pay-/Google-Pay-Button wird **automatisch** von
  Stripe Checkout gerendert, wenn das Endgerät kompatibel ist
  ("progressive enhancement" — siehe US-28 AC4/AC5). Engineers
  konfigurieren in Stripe-Dashboard die Wallet-Optionen.
- **Annahme:** Im MVP kein Self-Service-Account-Delete (`DELETE /api/customer/me`)
  — wird auf Backlog gesetzt. DSGVO-Löschung läuft über Tom + Prisma
  Studio.
- **Annahme (MAJOR-403-Klärung v1.4.1):** Statt einer separaten
  `Review.customerName`-Snapshot-Spalte bleibt der Anzeigename live aus
  `CustomerUser.firstName + lastName[0]` per Join. Backend liefert für
  öffentlich `"Vorname N."`, im Admin-Endpoint `"Vorname Nachname"`
  (volle Identität). Bei `customerId === null` (theoretisch nach
  Konto-Löschung) greift der Fallback `'Anonym'`. Wird Tom später
  Account-Delete einführen, müssen Engineers eine Snapshot-Spalte
  ergänzen — solange kein Self-Service-Delete existiert, ist das
  unkritisch.
- [NEEDS INPUT] **Stripe-Account-Region & Steuerregeln.** Tom muss in
  Stripe-Dashboard sein Steuersystem konfigurieren (Kleinunternehmer-
  Status nach §19 UStG?). Das beeinflusst die `tax_behavior`-
  Einstellung der Checkout-Session (`inclusive` vs. `exclusive`).
  Engineers warten auf Tom-Input, sonst Default `inclusive` (Bruttopreis).
- [NEEDS INPUT] **Mail-Versand vor Stripe-PaymentRequest:** Soll das
  System bei Anlegen eines Payment-Datensatzes wirklich automatisch
  eine Mail an den Kunden schicken? Annahme: **ja** (US-28 AC1
  impliziert es). Wenn Tom erst manuell prüfen will, müsste ein
  separater `POST /api/admin/bookings/:id/payment/send-request`-
  Endpunkt entstehen.

### 17.11 Akzeptanzkriterien-Mapping IT4

| Story | Erfüllt durch                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| US-25 | `customer_users`-Tabelle, `/api/customer/*`-Endpunkte, `customer-session`-Cookie, `/konto/login` + `/konto/registrieren` Pages, Verifikations-Mail-Flow, Forgot/Reset-Flow, Profil-Update unter `/konto/profil`. Middleware schützt `/konto/*` (außer Public-Whitelist). |
| US-26 | `Booking.customerId`-Feld (auto-befüllt aus Cookie), `GET /api/customer/bookings` mit upcoming/past-Split, `/konto`-Page mit Liste, `/konto/auftrag/:id`-Detail. Status-Badges DE-Mapping. Empty-State mit CTA. |
| US-27 | `POST /api/customer/bookings/:id/cancel` mit serverseitigem 24h-Frist-Check und Status-Whitelist. `<CancelBookingButton>` mit Confirm-Dialog. Disabled-State + Hinweistext bei < 24h. |
| US-28 | `Payment`-Modell, Stripe-Integration via `lib/stripe.ts`, `POST /api/admin/bookings/:id/payment` (Tom hinterlegt Betrag), `POST /api/payments/create-session` (Stripe Checkout mit card/paypal/wallets), `POST /api/payments/webhook` (Status-Update + Mails), `/konto/zahlung/:id` Page, Status-Badge "Bezahlt". |
| US-29 | `Review`-Modell mit Admin-Freigabe, `POST /api/customer/reviews` (nur bei COMPLETED + ohne bestehende Review), `GET /api/reviews` (öffentlich, kürzt Namen, sortiert), `GET/PATCH /api/admin/reviews/:id` (Moderation), `/admin/reviews`-UI, `<ReviewSection>` umgebaut. `BookingStatus.COMPLETED` neu. |
