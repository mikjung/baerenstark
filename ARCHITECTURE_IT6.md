# Architektur — Iteration 6

**Bärenstark Hausservice — Admin-Reife, Auth-Bereinigung, SEO & Wachstums-Features**

**Version:** 1.6.1 (Iteration 6 Design — QA-Revision)
**Stand:** 2026-05-03
**Autor:** Solution Architect
**Status:** Design — bereit für Implementierung (revidiert nach QA-Review)
**Bezug:** PROJECT.md §„Iteration 6", `project/user-stories/iteration-6.md` (US-IT6-01 bis US-IT6-09)

> Dieses Dokument ist die verbindliche Spec für IT6. Es ergänzt
> `ARCHITECTURE.md`. Bei Konflikten gilt: für IT6-Themen → IT6-Doc;
> für IT1-IT5-Themen → Hauptdoc. Querverweise sind explizit
> markiert (§-Verweise auf `ARCHITECTURE.md`).
>
> **Wichtig (v1.6.1):** Nach QA-Pressure-Test (`QA_DESIGN_REVIEW_IT6.md`,
> 2026-05-03) wurden drei Major-Findings (F1–F3) und sieben Minor-
> Findings (m1–m7) verbindlich aufgelöst. Die Auflösungen leben in
> **Anhang B (§17)** am Ende dieses Dokuments. Die ursprünglichen
> Kapitel sind erhalten (Lesefluss / Diff), aber jeder betroffene
> Abschnitt enthält am Anfang einen **„REVISED — siehe Anhang B"**-
> Hinweis. Bei Widerspruch zwischen Original-Kapitel und Anhang B
> gilt **Anhang B**.

---

## Inhalt

1. [Überblick & Architektur-Entscheidungen](#1-überblick--architektur-entscheidungen)
2. [Datenmodell-Migration IT6](#2-datenmodell-migration-it6)
3. [US-IT6-01 — Mehrere Admins verwalten](#3-us-it6-01--mehrere-admins-verwalten)
4. [US-IT6-02 — Kalender-UX (Outlook/Google-Style)](#4-us-it6-02--kalender-ux-outlookgoogle-style)
5. [US-IT6-03 — Reviews mit COMPLETED-Trigger & Admin-Approval](#5-us-it6-03--reviews-mit-completed-trigger--admin-approval)
6. [US-IT6-04 — SEO-Optimierung](#6-us-it6-04--seo-optimierung)
7. [US-IT6-05 — Auth-Bereinigung + Google-Bad-Request-Fix](#7-us-it6-05--auth-bereinigung--google-bad-request-fix)
8. [US-IT6-06 — User-Wipe-Skript](#8-us-it6-06--user-wipe-skript)
9. [US-IT6-07 — Admin-Userverwaltung mit interner Notiz/Rating](#9-us-it6-07--admin-userverwaltung-mit-interner-notizrating)
10. [US-IT6-08 — Finaler Preis pro Buchung](#10-us-it6-08--finaler-preis-pro-buchung)
11. [US-IT6-09 — Analytics-Seite](#11-us-it6-09--analytics-seite)
12. [Querschnitt: Authorization-Helper](#12-querschnitt-authorization-helper)
13. [Migrations-Reihenfolge & Roll-out](#13-migrations-reihenfolge--roll-out)
14. [Test-Plan IT6](#14-test-plan-it6)
15. [Annahmen & offene Punkte](#15-annahmen--offene-punkte)
16. [Akzeptanzkriterien-Mapping IT6](#16-akzeptanzkriterien-mapping-it6)
17. [Anhang B — Revisions nach QA Design Review IT6 (2026-05-03)](#17-anhang-b--revisions-nach-qa-design-review-it6-2026-05-03)

---

## 1. Überblick & Architektur-Entscheidungen

| Bereich              | Entscheidung                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack (Beibehaltung) | Next.js 14 App Router, Prisma + libSQL/Turso, NextAuth v5 (Admin), Custom-JWT (Customer), Tailwind, Zod, Resend, Stripe.                                                                                                                  |
| Neue Libs            | `@fullcalendar/react` + `@fullcalendar/daygrid` + `@fullcalendar/timegrid` + `@fullcalendar/interaction` (US-IT6-02). `recharts` (US-IT6-09).                                                                                              |
| Auth-Vereinfachung   | NextAuth-Customer auf **Google + Facebook** reduziert. GitHub raus. Kunden-Email/Passwort raus (Routes liefern 404). Admin-Auth bleibt Credentials (Tom + weitere Admins).                                                                |
| Multi-Admin          | Bestehender `User`-Tabelle zwei Felder hinzufügen (`status`, `createdById`). Self-Service-Admin-Verwaltung via neuer `/admin/admins`-Page. Audit-Spalten reichen für MVP — separates `AuditLog` ist Backlog (siehe §15).                  |
| Kalender             | **`@fullcalendar/react`** als gemeinsame Lib für Admin (Wochen-/Tagesansicht, Drag-to-create) und Kunden (Monatsansicht). Begründung siehe §4.                                                                                            |
| Reviews              | Bestehendes `Review`-Modell wird **nicht** umgebaut. Status-Migration: vorhandenes `approved: bool` bleibt, neues Feld `status: enum` ist redundant → wir bleiben bei Boolean + zusätzlicher Spalte `rejectedAt` für Moderationsläufe.    |
| Analytics            | Server-Component mit Prisma-`groupBy`, ISR (`revalidate: 300`). Charts: `recharts` (Client-Component-Inseln) — kein heavy SPA-Bundle.                                                                                                     |
| Authorization        | Neuer Helper `requireAdmin()` in `src/lib/auth-server.ts` (siehe §12). Wird in **allen** Admin-API-Endpoints und Admin-Pages aufgerufen. Prüft zusätzlich `User.status === 'ACTIVE'`.                                                     |
| DTO-Trennung         | Für US-IT6-07: zwei Zod-Output-Schemas — `CustomerUserPublicDTO` (existiert) und neuer `CustomerUserAdminDTO` mit `adminNote`/`adminRating`. Backend-Layer mappt explizit; nie via `prisma.findMany()` ohne `select` direkt zurückgeben. |

---

## 2. Datenmodell-Migration IT6

### 2.1 Schema-Änderungen (kompakt)

| Tabelle         | Feld                | Typ              | Default     | Begründung |
| --------------- | ------------------- | ---------------- | ----------- | ---------- |
| `users`         | `status`            | TEXT (enum)      | `'ACTIVE'`  | US-IT6-01: `ACTIVE` \| `DISABLED`. Admin-Login prüft. |
| `users`         | `createdById`       | TEXT (nullable)  | NULL        | US-IT6-01: Wer hat diesen Admin angelegt? Audit-Light. Self-FK auf `users.id`, ON DELETE SET NULL. |
| `users`         | `lastLoginAt`       | DATETIME?        | NULL        | US-IT6-01 nice-to-have für Liste; QA kann es ignorieren wenn nicht angezeigt. |
| `customer_users`| `adminNote`         | TEXT?            | NULL        | US-IT6-07. Max 1000 Zeichen (App-Layer). |
| `customer_users`| `adminRating`       | INTEGER?         | NULL        | US-IT6-07. 1–5 (App-Layer). |
| `bookings`      | `finalPriceEur`     | DECIMAL(10,2)?   | NULL        | US-IT6-08. SQLite speichert als TEXT (Prisma `Decimal`-Typ). |
| `bookings`      | `finalPriceNote`    | TEXT?            | NULL        | US-IT6-08 optional (Engineer-Hinweis: Frontend kann Feld vorerst weglassen, Spalte aber anlegen — Forward-kompatibel). |
| `reviews`       | `rejectedAt`        | DATETIME?        | NULL        | US-IT6-03. Wird beim Reject-Klick gesetzt; APPROVED-Reviews haben es NULL. Boolean `approved` bleibt Authority. |
| `reviews`       | `moderatedById`     | TEXT?            | NULL        | US-IT6-03. FK auf `users.id`. ON DELETE SET NULL. |

### 2.2 Migrations-Datei-Struktur

```
prisma/migrations/
  20260503100000_iteration6_admins_status/
    migration.sql            -- users.status + createdById + lastLoginAt
  20260503100100_iteration6_customer_admin_fields/
    migration.sql            -- customer_users.adminNote + adminRating
  20260503100200_iteration6_booking_final_price/
    migration.sql            -- bookings.finalPriceEur + finalPriceNote
  20260503100300_iteration6_review_moderation/
    migration.sql            -- reviews.rejectedAt + moderatedById
  20260503100400_iteration6_indexes/
    migration.sql            -- Performance-Indexe (siehe §2.3)
```

> **Reihenfolge ist signifikant.** Die Indexe-Migration läuft zuletzt,
> damit alle Spalten existieren. Engineer-Hinweis: Prisma generiert
> die SQL via `pnpm prisma migrate dev --name <ordner>`; manuelle
> Anpassung nur dort, wo Singleton-Defaults oder Backfill erforderlich
> sind (siehe §2.4).

### 2.3 Indexe (neu in IT6)

```sql
-- US-IT6-01: Liste der Admins gefiltert nach Status.
CREATE INDEX "users_status_idx" ON "users" ("status");

-- US-IT6-07: Admin-Userverwaltung (Suche per Name/Email, Sortierung).
CREATE INDEX "customer_users_lastName_firstName_idx"
  ON "customer_users" ("lastName", "firstName");

-- US-IT6-09: Analytics — Umsatz pro Monat.
-- Filter: status = 'COMPLETED' AND finalPriceEur IS NOT NULL.
-- Aggregation: GROUP BY substr(date, 1, 7).
CREATE INDEX "bookings_status_date_idx"
  ON "bookings" ("status", "date");

-- US-IT6-09: Top-Kunden-Aggregation.
CREATE INDEX "bookings_customerId_status_idx"
  ON "bookings" ("customerId", "status");

-- US-IT6-03: Moderation-Queue (PENDING-Reviews) + öffentliche Liste.
DROP INDEX IF EXISTS "reviews_approved_createdAt_idx";
CREATE INDEX "reviews_approved_rejectedAt_createdAt_idx"
  ON "reviews" ("approved", "rejectedAt", "createdAt" DESC);
```

### 2.4 Backfill-Logik

- `users.status` = `'ACTIVE'` für alle bestehenden Datensätze (DEFAULT
  greift auch ohne Backfill — Engineer kann den `UPDATE` weglassen).
- `users.createdById` = NULL für Bestand (Tom hat sich selbst via Setup-
  Wizard angelegt).
- Reviews: `rejectedAt` bleibt NULL für alle Bestand-Reviews (Boolean
  bleibt Authority — siehe §5).

> **Achtung:** Wenn US-IT6-06 (User-Wipe) **vor** der Schema-Migration
> läuft, ist der Backfill leer und harmlos. Wenn der Wipe **nach** der
> Migration läuft, betrifft er auch die neuen Felder
> (`adminNote`/`adminRating` werden mit dem User gelöscht). Beide
> Reihenfolgen sind erlaubt — siehe §13.

---

## 3. US-IT6-01 — Mehrere Admins verwalten

> **REVISED (v1.6.1) — siehe Anhang B §17.2 (F2 Letzter-Admin-Race).**
> Der Lock-out-Schutz in §3.1 („Server prüft `count > 1` vor jedem
> Disable/Delete") ist **nicht atomar** und damit Race-anfällig.
> Verbindlich ist die Conditional-UPDATE-Implementierung aus §17.2.

### 3.1 Konzept

- Tom legt weitere Admins **direkt** an (Name + E-Mail + initiales
  Passwort). Kein Magic-Link, kein Einladungs-Token im MVP.
  Begründung: einfacher zu bauen, Tom kann das Passwort persönlich
  übergeben (Telefon, WhatsApp). Magic-Link/Reset-Flow für Fremd-Admins
  ist IT7-Backlog (siehe `iteration-6.md` Notes zu US-IT6-01).
- Status-Modell: `ACTIVE` | `DISABLED`. „Löschen" deaktiviert den
  Account hart (siehe §3.2 zu Lock-out-Schutz). Echtes Löschen würde
  FK-Beziehungen zu `Review.moderatedById` brechen — daher nur
  Disable.
- Lock-out-Schutz (verbindlich):
  - **Selbst-Disable/Selbst-Delete:** verboten. Server prüft `me.id !== targetId`.
  - **Letzter aktiver Admin:** verboten. Server prüft `count({ status: 'ACTIVE' }) > 1` vor jedem Disable/Delete.
  - **Disabled Admin → Login:** scheitert mit `ACCOUNT_DISABLED` (422).
  - **Disabled Admin → Direkter URL-Aufruf:** Middleware kann den Status nicht prüfen (Edge-Runtime + kein Prisma) → erste Prüfung passiert in `requireAdmin()` im Route-Handler / Page-Component, der dann zur Login-Seite redirected mit `?error=account_disabled`.

### 3.2 Datenmodell

```prisma
model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  name         String
  // IT6 / US-IT6-01 — neu:
  status       UserStatus @default(ACTIVE)
  createdById  String?
  createdBy    User?      @relation("UserCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  createdAdmins User[]    @relation("UserCreatedBy")
  lastLoginAt  DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  // IT6 / US-IT6-03 — Backref auf moderierte Reviews:
  moderatedReviews Review[] @relation("ReviewModeratedBy")

  @@index([status])
  @@map("users")
}

enum UserStatus {
  ACTIVE
  DISABLED
}
```

> Engineer-Hinweis: SQLite kennt kein nativ ENUM — Prisma serialisiert
> als TEXT. Beim Migrieren auf bestehender DB ist das `@default(ACTIVE)`
> ausreichend; vorhandene Zeilen bekommen automatisch `'ACTIVE'`.

### 3.3 API

| Methode + Pfad                     | Story    | Zweck                                                                |
| ---------------------------------- | -------- | -------------------------------------------------------------------- |
| `GET    /api/admin/admins`         | US-IT6-01 | Liste aller Admins (auch DISABLED). Sortierung: `createdAt asc`.    |
| `POST   /api/admin/admins`         | US-IT6-01 | Neuer Admin (Name, E-Mail, Passwort). Body siehe §3.4.               |
| `PATCH  /api/admin/admins/:id`     | US-IT6-01 | Edit Name / E-Mail / Status. Body siehe §3.4.                        |
| `DELETE /api/admin/admins/:id`     | US-IT6-01 | Hart-Disable (Status auf DISABLED). Lock-out-Schutz greift.          |

Voll-Spec mit Bodies/Errors siehe `contracts/api-routes.md` §22.1.

### 3.4 Validierung (Zod)

```ts
// Neu in src/lib/schemas.ts (synchron mit contracts/zod-schemas.ts).

export const ADMIN_PASSWORD_MIN_LENGTH = 12; // strenger als Customer (8).
export const ADMIN_PASSWORD_MAX_LENGTH = 200;

export const CreateAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(ADMIN_PASSWORD_MIN_LENGTH)
    .max(ADMIN_PASSWORD_MAX_LENGTH)
    .regex(/[A-Z]/, 'Mind. ein Großbuchstabe.')
    .regex(/[a-z]/, 'Mind. ein Kleinbuchstabe.')
    .regex(/[0-9]/, 'Mind. eine Ziffer.'),
});

export const UpdateAdminSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

export const AdminListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  status: z.enum(['ACTIVE', 'DISABLED']),
  createdAt: z.string().datetime({ offset: true }),
  lastLoginAt: z.string().datetime({ offset: true }).nullable(),
  createdById: z.string().nullable(),
});
```

### 3.5 Frontend

- Neue Page: `src/app/admin/admins/page.tsx` — Server-Component, lädt
  Liste via `requireAdmin()` + `prisma.user.findMany`.
- Neue Komponenten:
  - `src/components/admin/AdminTable.tsx` — Tabelle mit Status-Badge.
  - `src/components/admin/AdminCreateForm.tsx` — Modal für Neuanlage.
  - `src/components/admin/AdminEditDrawer.tsx` — Side-Drawer für Edit/Disable.
- Navigations-Item „Admins" wird nur für eingeloggten Admin angezeigt
  (selbe Auth-Schicht wie übriges Admin-Menü).
- Confirm-Modal vor Disable mit Hinweis-Text aus §3.1.

### 3.6 Sicherheit

- `requireAdmin()` lädt den User samt `status` (siehe §12). Ein eingeloggter Admin, dessen Status zwischenzeitlich auf `DISABLED` gesetzt wurde, sieht beim nächsten Request einen Redirect auf `/admin/login?error=account_disabled` und wird per `signOut()` ausgeloggt.
- Passwort-Reset für Fremd-Admins ist **bewusst Backlog** — Tom kann via Prisma Studio oder via `scripts/reset-admin-password.ts` (existierendes Skript) jeden Admin neu vergeben.

---

## 4. US-IT6-02 — Kalender-UX (Outlook/Google-Style)

> **REVISED (v1.6.1) — siehe Anhang B §17.8 (m4 Calendar-Prefetch +
> Mobile-Touch-Floor).** §4.3/§4.5 erhalten verbindliche Range-Limits
> (max 90 d Admin / max 62 d Public — bereits gesetzt), Prefetch-Regel
> für den Folgemonat im Public-Calendar und Mobile-Min-Touch-Höhe von
> 44 px.

### 4.1 Bibliotheks-Wahl: `@fullcalendar/react`

Vergleich:

| Kriterium             | `@fullcalendar/react`                           | `react-big-calendar`                  |
| --------------------- | ------------------------------------------------ | ------------------------------------- |
| Lizenz (Core/Plugins) | MIT                                              | MIT                                   |
| Bundle-Size (gz)      | ~80 KB Core + ~20 KB pro Plugin                 | ~70 KB                                |
| Drag-to-create        | Nativ via `interaction`-Plugin                  | Nur via Custom-Wrapper                |
| Touch-UX (Mobile)     | Out-of-the-box, sehr gut                        | Schwächer, Custom-CSS nötig           |
| Wochen+Monat+Tag      | Alle drei Plugins offiziell                      | Alle drei nativ                       |
| Resource-View         | Pro-Plan kostenpflichtig                         | Frei                                  |
| Active Maintenance    | Sehr aktiv (2024)                                | Aktiv                                  |
| Theming               | CSS-Variablen + Tailwind möglich                 | Voll Tailwind-kompatibel               |

**Entscheidung:** `@fullcalendar/react` für **beide** Ansichten. Resource-Views brauchen wir nicht (kein Multi-Mitarbeiter); MIT-Plugins reichen aus. Drag-to-create ist die UX-Anforderung von Tom („wie Outlook/Google") — FullCalendar liefert es direkt. Bundle-Size wird durch dynamic import isoliert (siehe §4.4).

> **Engineer-Hinweis:** Falls FullCalendar bei der Performance auf
> Smartphone (Lighthouse Mobile) reißt, ist der Plan B `react-big-calendar`
> + Custom-Drag-Handler. Beide Libs werden via `dynamic(() => …, { ssr: false })`
> geladen, damit Server-Bundle unbelastet bleibt.

### 4.2 Datenmodell

Wir nutzen die **bestehenden** Tabellen:

- `AvailabilityTemplate` (US-17): wöchentliches Default-Fenster pro Wochentag.
- `DayOverride` (US-17): tagesgenaue Abweichung.
- `Booking` (US-IT6-02 zeigt Buchungen als farbige Blöcke).
- `BufferConfig` (US-34) — wird im Tag-View als grauer Schraffur-Block visualisiert.

**Kein neues `Availability`-Modell.** Begründung: das bestehende
Template + Override-System modelliert die Verfügbarkeit auf Minuten-
Ebene über `lib/availability.ts`. Ein zusätzliches Slot-Modell würde
Doppel-Quellen erzeugen.

> **Engineer-Hinweis:** Tom hat bisher kein Mittel, **außerplanmäßig**
> einen Slot zu reservieren (z.B. „heute 14:00 frei für Materialfahrt").
> Drag-to-create im Admin-Kalender erzeugt einen `DayOverride` mit
> `isActive: false` und passender Zeit-Lücke — **DEFER:** Genaue UX-
> Semantik mit Tom abstimmen (siehe §15 Annahme A2). Im MVP zunächst
> nur **lesender** Admin-Kalender + Drag-to-create öffnet die
> bestehende `DayOverrideManager`-Form mit vorausgefüllten Werten.

### 4.3 API (Wiederverwendung — keine neuen Endpoints außer Aggregator)

- `GET /api/admin/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD` (NEU,
  Admin) — gibt Buchungen + Template-Verfügbarkeitsfenster + Day-
  Overrides + Buffer-Blöcke als FullCalendar-kompatibles Event-Array
  zurück. Vereinheitlicht das, was sonst drei separate Calls wären.
  Reduziert Wasserfall-Loads im Admin-Kalender.
- `GET /api/availability/calendar?from=&to=&serviceId=` (NEU,
  öffentlich) — gibt pro Tag den Status zurück (`available` |
  `partial` | `unavailable`) für die Kunden-Monatsansicht. Kein
  Auth, gecached (`Cache-Control: public, max-age=60`).
- Bestehende Endpoints `GET /api/slots/available?date=&duration=`
  und `GET/PUT /api/admin/availability-template`,
  `GET/POST/DELETE /api/admin/day-overrides` bleiben unverändert.

Voll-Spec der neuen Endpoints siehe `contracts/api-routes.md` §22.2.

### 4.4 Frontend

| Page                                         | Komponente                                             | Anmerkung |
| -------------------------------------------- | ------------------------------------------------------ | --------- |
| `/admin/kalender` (NEU)                       | `<AdminCalendarView>`                                  | FullCalendar Wochen+Tag; klickbare Buchungs-Blöcke + Drag-to-create. |
| `/admin/slots` (Bestand) und `/admin/availability` (Bestand) | bleiben | Tom kann die alten Formulare weiter nutzen, neue Kalenderansicht ist additiv (keine Breaking Change). |
| `/buchung` (Bestand)                         | `<BookingCalendar>` (NEU) ersetzt aktuell wahrscheinliches `<Calendar>` aus `src/components/booking/Calendar.tsx` | Monatsansicht mit Tag-Status-Farben; Klick auf Tag → nutzt bestehenden `<TimeSlotPicker>`. |

Komponenten-Verzeichnis:

- `src/components/admin/AdminCalendarView.tsx` (Client)
- `src/components/booking/BookingCalendar.tsx` (Client)
- `src/components/admin/CalendarEventPopover.tsx` (Client) — Detail-Popover beim Klick auf Buchung.

Beide `*.tsx` werden via `dynamic(() => import(...), { ssr: false })`
in den Pages geladen, damit FullCalendar nicht im Server-Bundle landet.

### 4.5 Mobil-UX

- FullCalendar mit `initialView="timeGridWeek"` (Desktop) / `dayGridMonth`
  (Mobile, Breakpoint `< 768px`).
- Touch-Events: FullCalendar liefert `eventClick`, `dateClick`, `select`.
- Tailwind: `prose-sm` für Event-Inhalte; Farben über CSS-Variable
  `--fc-event-bg-color` themeable.
- AC „touch-optimiert ohne horizontales Scrollen": auf < 768px schalten
  wir auf Monats-View, der nicht horizontal scrollt.

### 4.6 Akzeptanzkriterien-Mapping (US-IT6-02)

Siehe §16. Kurz:

- Wochen-/Tagesraster im Admin → FullCalendar `timeGridWeek` + `timeGridDay`.
- Drag-to-create → `interaction`-Plugin `select`-Callback öffnet `<DayOverrideManager>`-Formular vorausgefüllt.
- Farbige Blöcke nach Status → FullCalendar-Event mit `backgroundColor` aus Mapping `{ CONFIRMED: 'green-500', PENDING: 'blue-500', BUFFER: 'gray-300' }`.
- Klick auf Block → `<CalendarEventPopover>` mit Link zur Buchungsdetailseite (`/admin/bookings/[id]`).

---

## 5. US-IT6-03 — Reviews mit COMPLETED-Trigger & Admin-Approval

> **REVISED (v1.6.1) — siehe Anhang B §17.5 (m1 Public-Reviews-Schema)
> und §17.11 (m7 Booking-CANCELLED-Rollback).** §5.3 (`GET /api/reviews`-
> Filter) wird um die explizite Output-Schema-Bindung an
> `PublicReviewSchema.strict()` ergänzt; §5 wird um die Edge-Case-Regel
> für Booking-Status-Rollbacks (`CONFIRMED → COMPLETED → review →
> CANCELLED`) erweitert.

### 5.1 Status-Modell

Bestehend ist bereits:

- `Review.approved Boolean @default(false)` — false = nicht freigegeben.
- `GET /api/reviews` (öffentlich) filtert auf `approved: true`.
- `PATCH /api/admin/reviews/:id` mit `{ approved: boolean }`.

**Was fehlt für US-IT6-03 (laut QA-Anforderung):**

1. **Trigger-Bedingung** beim Kunden: Review-Button NUR bei
   `Booking.status === 'COMPLETED'` (nicht bei CONFIRMED).
2. **Anti-Leak-Garantie**: `approved: false` UND `rejectedAt`-Reviews
   dürfen niemals in `GET /api/reviews` erscheinen.
3. **Reject-Spur** für Admin: bei „Ablehnen" wird die Review nicht
   gelöscht, sondern markiert (`rejectedAt`), damit der Kunde keine
   neue Review für dieselbe Buchung schicken kann (Spam-Schutz).

### 5.2 Datenmodell-Erweiterung

```prisma
model Review {
  // ... Bestand ...
  approved        Boolean   @default(false)
  // IT6 / US-IT6-03 — neu:
  rejectedAt      DateTime?
  moderatedById   String?
  moderatedBy     User?     @relation("ReviewModeratedBy", fields: [moderatedById], references: [id], onDelete: SetNull)
  moderatedAt     DateTime?
  // ...
}
```

**Effektiver Status (abgeleitet, kein DB-Feld):**

| `approved` | `rejectedAt` | Status              | Sichtbar in `GET /api/reviews`? |
| ---------- | ------------ | ------------------- | -------------------------------- |
| `false`    | `null`       | PENDING_APPROVAL    | nein                             |
| `true`     | `null`       | APPROVED            | **ja**                           |
| `false`    | `<DateTime>` | REJECTED            | nein                             |

> Begründung: Wir behalten den bestehenden Boolean-Mechanismus, weil
> Code in `lib/reviews.ts` bereits darauf basiert. Ein migratorischer
> Umbau auf `enum status` würde alle Caller brechen ohne semantischen
> Gewinn. Engineering darf gerne in IT7 ein `status: enum` einführen,
> aber **nicht** in IT6.

### 5.3 API-Anpassung

- `POST /api/customer/reviews` — Backend-Vorbedingung verschärfen:
  `booking.status === 'COMPLETED'` (war evtl. CONFIRMED in IT4 — siehe AC1 / Notes der Story). Wenn die Buchung CONFIRMED ist: 409 `CONFLICT` mit `code: 'BOOKING_NOT_COMPLETED'` (neuer Subcode).
- `POST /api/customer/reviews` — Idempotenz: bereits vorhandene Review (egal welcher Status) → 409 `CONFLICT` `code: 'REVIEW_EXISTS'`. Auch bei `rejectedAt != null` — kein Spam-Re-Submit.
- `GET /api/reviews` — Filter: `WHERE approved = true AND rejectedAt IS NULL` (zweite Bedingung ist eigentlich redundant, aber als Defense-in-Depth verbindlich).
- `PATCH /api/admin/reviews/:id` — Body bleibt `{ approved: boolean }`. Backend-Logik:
  - `approved: true` → setzt `approved=true`, `rejectedAt=null`, `moderatedAt=now()`, `moderatedById=me.id`.
  - `approved: false` → setzt `approved=false`, `rejectedAt=now()`, `moderatedAt=now()`, `moderatedById=me.id`.
- `GET /api/admin/reviews?status=PENDING_APPROVAL|APPROVED|REJECTED` — neuer optionaler Query-Param, vereinfacht Tom's Moderation-Queue. Default: alle.

Voll-Spec siehe `contracts/api-routes.md` §22.3.

### 5.4 Frontend

- Bestand: `<ReviewForm>` in `src/components/portal/ReviewForm.tsx` —
  Sichtbarkeits-Bedingung von `status === 'CONFIRMED'` auf
  `status === 'COMPLETED'` ändern. (Kunde sieht den Button nur bei
  COMPLETED.)
- Bestand: `<ReviewModerationTable>` — drei Tabs/Filter „Offen"
  (PENDING_APPROVAL), „Freigegeben" (APPROVED), „Abgelehnt" (REJECTED).
  Reject-Button mit Bestätigungs-Dialog.
- Neu (öffentlich): falls noch nicht vorhanden, kurze Reviews-Sektion
  auf der Landingpage `/` (Karussell oder Grid). Liest
  `GET /api/reviews?limit=6&minStars=4` (existiert bereits seit IT4).

---

## 6. US-IT6-04 — SEO-Optimierung

### 6.1 Datei-Inventar (neu/angepasst)

| Datei                                           | Zweck                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `src/app/sitemap.ts` (NEU)                       | Next.js Route Handler `MetadataRoute.Sitemap` — generiert XML-Sitemap. |
| `src/app/robots.ts` (NEU)                        | Next.js Route Handler `MetadataRoute.Robots` — robots.txt.            |
| `src/app/layout.tsx` (Bestand)                   | Root-Metadata: `title.template`, OG/Twitter-Defaults, JSON-LD-Skript. |
| `src/app/page.tsx` (Bestand, Landingpage)        | `generateMetadata()` + `<JsonLd type="LocalBusiness">`.               |
| `src/app/buchung/page.tsx` (Bestand)             | `generateMetadata()` mit eigener Beschreibung.                        |
| `src/app/services/[slug]/page.tsx` (NEU)         | Service-Detail-Page (1 pro Service-Slug). `generateMetadata()` + `<JsonLd type="Service">`. |
| `src/app/impressum/page.tsx` (Bestand)           | `generateMetadata()` minimal.                                         |
| `src/app/datenschutz/page.tsx` (Bestand)         | `generateMetadata()` minimal.                                         |
| `src/lib/seo/jsonLd.ts` (NEU)                    | Helper-Funktionen für `localBusinessJsonLd()`, `serviceJsonLd()`, `aggregateRatingJsonLd()`. |
| `src/components/seo/JsonLd.tsx` (NEU)            | `<script type="application/ld+json">`-Wrapper.                        |
| `public/opengraph-image.png` (NEU)               | 1200×630 Default-OG-Bild.                                              |

> **Engineer-Hinweis:** `app/services/[slug]/page.tsx` ist evtl. **neu**.
> Falls bestehende Service-Inhalte nur als Akkordeon auf der Landingpage
> liegen, muss die Page parallel angelegt werden — sonst verfehlt SEO
> die Service-spezifische Tiefe (jeder Service braucht eigene URL +
> Title für SERP).

### 6.2 Beispiel-JSON-LD

```ts
// src/lib/seo/jsonLd.ts
export function localBusinessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Bärenstark Hausservice',
    image: 'https://www.baerenstark-hausservice.app/opengraph-image.png',
    '@id': 'https://www.baerenstark-hausservice.app/#localbusiness',
    url: 'https://www.baerenstark-hausservice.app',
    telephone: '+49-???-?????',                  // [NEEDS INPUT — Tom]
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Mustergasse 1',            // [NEEDS INPUT — Tom]
      addressLocality: 'Darmstadt',
      postalCode: '64283',                        // [NEEDS INPUT — Tom]
      addressCountry: 'DE',
    },
    areaServed: ['Darmstadt', 'Darmstadt-Dieburg', 'Bergstraße'],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
        opens: '07:00',
        closes: '18:00',
      },
    ],
  };
}
```

### 6.3 Performance-Maßnahmen

- **`next/image`** für alle Bilder (Hero, Service-Cards, Reviews-Avatar).
- **`font-display: swap`** für `next/font/google` (bereits Default).
- **Dynamic Import** für FullCalendar + recharts (siehe §4.4 / §11.3).
- **`Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=86400`** für Landingpage und Service-Pages (ISR via `export const revalidate = 600`).
- **Lighthouse-Ziele:**
  - Performance Mobile ≥ 80 (AC US-IT6-04 Punkt 7).
  - SEO ≥ 95.
  - Best Practices ≥ 90.
  - Accessibility ≥ 90 (eigenes Sub-Ziel, nicht in AC; Engineering soll's anstreben).

### 6.4 Robots.txt-Regeln

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /admin
Disallow: /api/
Disallow: /konto/
Disallow: /konto

Sitemap: https://www.baerenstark-hausservice.app/sitemap.xml
```

> **Hinweis:** `/konto/*` blocken wir, weil es nichts crawlbares ist
> (Login-Wand). Falls Tom meint, die Login-Page selber soll indexiert
> werden, kann der Disallow präzisiert werden auf
> `Disallow: /konto/profil`, `Disallow: /konto/auftrag/` etc.
> [DEFER: nicht blockierend für IT6.]

---

## 7. US-IT6-05 — Auth-Bereinigung + Google-Bad-Request-Fix

### 7.1 Scope (genau)

| Was raus                                                                 | Was bleibt                                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Customer-Email/Passwort-Login (`/api/customer/login`, `/register`, `/forgot-password`, `/reset-password`, `/resend-verification`, `/verify`). | Customer-OAuth via Google + **Facebook**.                                   |
| Customer-Pages `/konto/registrieren`, `/konto/passwort-vergessen`, `/konto/passwort-zuruecksetzen`, `/konto/verifizieren`, `/konto/passwort-reset`. | Customer-Page `/konto/login` (vereinfacht — siehe §7.4).                    |
| GitHub-Provider (`GITHUB_CLIENT_ID/SECRET` ENV).                          | Google + Facebook OAuth.                                                    |
| `CustomerUser.passwordHash` (Spalte bleibt erhalten, ist aber forevermore NULL für neue Konten — siehe §7.6).                          | `CustomerUser.email`, `oauthProvider`, `oauthId`, `avatarUrl`.              |
| **Admin**-Auth: ändert sich **nicht**. Admins bleiben Email/Passwort.     | NextAuth-Admin-Handler unter `/api/auth/[...nextauth]`.                      |

### 7.2 Datei-Änderungen

| Datei                                                       | Aktion |
| ----------------------------------------------------------- | ------ |
| `src/lib/customer-oauth.ts`                                  | GitHubProvider-Block entfernen, Facebook-Provider hinzufügen. `CUSTOMER_OAUTH_PROVIDERS = ['google','facebook']`. |
| `src/lib/schemas.ts` und `contracts/zod-schemas.ts`          | `CUSTOMER_OAUTH_PROVIDERS` umsetzen. `CustomerOAuthProviderSchema` enum entsprechend. |
| `src/components/customer/OAuthButtons.tsx`                   | GitHub-Button raus, Facebook-Button rein (Brand-Logo SVG inline oder via lucide). |
| `src/components/customer/LoginForm.tsx`                      | Email/Passwort-Felder entfernen — Komponente wird zur reinen Banner-Anzeige + `<OAuthButtons>`. |
| `src/components/customer/RegisterForm.tsx`                   | **Datei löschen.** |
| `src/components/customer/ForgotPasswordForm.tsx`             | **Datei löschen.** |
| `src/components/customer/ResetPasswordForm.tsx`              | **Datei löschen.** |
| `src/app/konto/registrieren/`, `/passwort-vergessen/`, `/passwort-zuruecksetzen/`, `/passwort-reset/`, `/verifizieren/` | **Verzeichnisse löschen.** Next.js gibt für entfernte Pages 404 zurück (US-IT6-05 AC5). |
| `src/app/api/customer/login/`, `/register/`, `/forgot-password/`, `/reset-password/`, `/resend-verification/`, `/verify/`, `/verify-email/` | **Verzeichnisse löschen.** API-Routes geben dann 404. |
| `src/middleware.ts`                                          | `PUBLIC_KONTO_PATHS` reduzieren auf `['/konto/login']`. |
| `.env.example`                                               | `GITHUB_CLIENT_ID/SECRET` raus, `FACEBOOK_CLIENT_ID/SECRET` rein. |

### 7.3 Provider-Konfiguration: Facebook

```ts
// src/lib/customer-oauth.ts (Auszug)
import FacebookProvider from 'next-auth/providers/facebook';

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      authorization: { params: { scope: 'email public_profile' } },
    }),
  );
}
```

Profile-Normalisierung: Facebook-Profil hat `id` (oauthId), `email`,
`name` (gesplittet), `picture.data.url` (avatar). `normalizeProfile()`
bekommt einen neuen Branch:

```ts
} else if (provider === 'facebook') {
  const p = profile as RawProfileFacebook;
  if (!p.email) return null;            // Hinweis: Facebook kann email weglassen, wenn der User es entzieht.
  const split = splitName(p.name);
  candidate = {
    provider: 'facebook',
    oauthId: account?.providerAccountId ?? String(p.id ?? ''),
    email: p.email,
    firstName: split.firstName || 'Kunde',
    lastName: split.lastName || '—',
    avatarUrl: p.picture?.data?.url ?? null,
  };
}
```

> **Wichtig:** Facebook Login **kann** ohne `email` zurückkommen, wenn
> der Nutzer den Scope abgelehnt hat. Wir behandeln das wie GitHub
> bisher (Redirect mit `?error=oauth_no_email`).

### 7.4 Login-Page UX

`/konto/login` zeigt:

```
─────────────────────────────────────────────────
 Bei Bärenstark anmelden
 [G  Mit Google anmelden]
 [f  Mit Facebook anmelden]

 (kleiner Hinweis-Text:)
 Eine Anmeldung mit E-Mail und Passwort ist nicht
 mehr möglich. Falls Sie früher einen Account hatten,
 melden Sie sich bitte mit Google oder Facebook unter
 derselben E-Mail-Adresse an.
─────────────────────────────────────────────────
```

`?error=`-Codes der Login-Seite (Bestand + neu):
- `oauth_error` — Provider-Fehler.
- `oauth_no_email` — Provider gab keine E-Mail.
- `oauth_unverified_conflict` — bestehendes lokales Konto noch
  unverifiziert (siehe IT5 §18.9.2). Nach dem Wipe (US-IT6-06) +
  Auth-Bereinigung dürfte dieser Fall faktisch nicht mehr
  auftreten.
- `legacy_credentials` (NEU) — wenn die obsolete `/api/customer/login`-
  URL doch noch erreichbar ist und Frontend versehentlich darauf
  redirecten würde, gibt es eine deutsche Hinweis-Meldung.

### 7.5 Google-„Bad Request"-Diagnose-Schritte (verbindlich)

QA-Hinweis aus Story US-IT6-05: Tom hat „Bad Request" beim Google-
Login gesehen. Häufige Ursachen — Engineering arbeitet **diese
Liste in Reihenfolge ab**, bevor Code-Anpassungen geprüft werden:

1. **Redirect-URI in Google Cloud Console**:
   - Muss exakt sein: `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`.
   - **Nicht** `/api/auth/signin/google` (das ist NextAuth v3-Style; v5 nutzt `/callback/`).
   - Auch lokale Dev-URI eintragen: `http://localhost:3000/api/auth/customer/callback/google`.
   - **Trailing-Slash beachten:** Google ist exakt-match. Wenn Frontend mit Slash redirected und Console ohne Slash hinterlegt ist → 400.
2. **`NEXTAUTH_URL`** Env-Var:
   - Prod: `https://www.baerenstark-hausservice.app` (kein Slash am Ende).
   - Dev: `http://localhost:3000`.
   - **Vercel-Preview-Deployments**: hier ist `NEXTAUTH_URL` automatisch dynamisch — falls Tom Previews testen will, bracht er pro Preview-Domain einen separaten Eintrag in der Google-Console (siehe §7.7 Workaround).
3. **`AUTH_SECRET`** muss in beiden ENVs (`AUTH_SECRET` + `NEXTAUTH_SECRET`-Fallback) gesetzt sein. NextAuth v5 prüft beide.
4. **Cookie-Name-Konflikt:** Customer-OAuth-Cookie heißt `__customer-next-auth.session-token` (siehe `customer-oauth.ts`). Wenn der Admin-NextAuth gleichzeitig Cookies setzt, sind sie via Path/Name getrennt — kein Konflikt erwartet, aber bei Debugging beachten.
5. **OAuth-Consent-Screen-Status:** Wenn der Google-OAuth-App-Status auf „Testing" steht, dürfen nur explizit eingetragene Test-Nutzer den Flow abschließen. Tom muss sich als Test-User eintragen ODER die App auf „In Production" schalten (Verification durch Google nötig, falls sensitive scopes gewünscht; `openid email profile` ist unkritisch).
6. **Scope-Mismatch:** `authorization.params.scope = 'openid email profile'` — exakt so. Wenn jemand `'email,profile'` (Komma) gesetzt hat, gibt Google 400.
7. **Browser-Drittanbieter-Cookies blockiert:** Safari ITP / Brave Shields kann den OAuth-Round-Trip stören. Test in Chrome-Inkognito ausschließen.

> **Engineer-Hinweis:** Wenn nach Schritten 1–7 immer noch 400, im
> Network-Tab den `error=`-Param der Google-Redirect-URL aufschlüsseln:
> Google gibt detaillierte Sub-Codes (`redirect_uri_mismatch`,
> `invalid_client`, `unauthorized_client`).

### 7.6 Datenmigration `passwordHash`

- Spalte `passwordHash String?` in `CustomerUser` bleibt erhalten
  (US-31 hat sie nullable gemacht).
- **Kein Migrations-Skript nötig**: nach US-IT6-06-Wipe sind alle
  CustomerUser-Datensätze weg → keine Altlasten.
- Wenn US-IT6-06 **nicht** läuft (Tom entscheidet doch um), soll ein
  zusätzliches Skript `scripts/null-customer-passwords.ts` alle
  `passwordHash` auf NULL setzen, damit niemand „heimlich" noch via
  alter API einloggt — aber im aktuellen Plan ist das nicht nötig,
  weil die Routes ohnehin gelöscht werden und 404 liefern.

### 7.7 Facebook-OAuth-App-Setup (für Tom)

Tom muss in Meta Developer Portal eine App anlegen:

1. https://developers.facebook.com → Neue App → Typ „Consumer".
2. Produkt „Facebook Login" hinzufügen → Web.
3. **Valid OAuth Redirect URIs**:
   - `https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook`
   - `http://localhost:3000/api/auth/customer/callback/facebook`
4. App-Domain: `baerenstark-hausservice.app`.
5. App Review für `email` Scope: **nicht** erforderlich (Standard-Permission).
6. App Status auf „Live" schalten — sonst dürfen nur App-Admins/Tester einloggen.
7. ENV liefern: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`.

---

## 8. US-IT6-06 — User-Wipe-Skript

> **REVISED (v1.6.1) — siehe Anhang B §17.1 (F1 Bootstrap-Race),
> §17.7 (m3 Stripe-Customer-Records) und §17.10 (m6 Reihenfolge
> Wipe vs. Auth-Bereinigung).** §8.4 („Tom ruft `/admin/setup` auf
> — bedingungslos zugänglich, sobald User-Tabelle leer ist") ist
> **NICHT** sicher und wird durch ein **`BOOTSTRAP_ADMIN_EMAIL`-
> Allowlist-Gate** ersetzt. §8.2 Cascade-Reihenfolge gilt unverändert.

### 8.1 Skript

`scripts/reset-users.ts` — TypeScript via `tsx`. Engineering-Skripte-
Konvention im Repo (siehe vorhandenes `scripts/reset-admin-password.ts`).

```ts
// scripts/reset-users.ts (Pseudo-Code)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.ALLOW_USER_WIPE !== 'true') {
    throw new Error('Refusing to run without ALLOW_USER_WIPE=true.');
  }
  const dryRun = process.argv.includes('--dry-run');

  const summary = await prisma.$transaction(async (tx) => {
    // 1. Anonymisiere historische Buchungen (COMPLETED, CONFIRMED).
    const anonymized = await tx.booking.updateMany({
      where: {
        customerId: { not: null },
        status: { in: ['COMPLETED', 'CONFIRMED'] },
      },
      data: { customerId: null },
    });

    // 2. Storniere offene Buchungen (PENDING, COUNTER_PROPOSED).
    const cancelled = await tx.booking.updateMany({
      where: {
        customerId: { not: null },
        status: { in: ['PENDING', 'COUNTER_PROPOSED'] },
      },
      data: { customerId: null, status: 'CANCELLED' },
    });

    // 3. Lösche Reviews verwaister Kunden (cascade per ON DELETE SET NULL
    //    auf customerId → Review.customerId NULL; Review bleibt erhalten).
    //    OPTIONAL: alle PENDING-Reviews löschen, damit keine "Anonym"-Anhängsel
    //    auftauchen. Hier Hartlöschen aller PENDING/REJECTED, APPROVED bleiben:
    const pendingReviewsDeleted = await tx.review.deleteMany({
      where: { approved: false },
    });

    // 4. Lösche CustomerUser (kein UI-Fenster für Bestätigung — Skript-Nutzer ist Admin).
    const customerUsersDeleted = await tx.customerUser.deleteMany({});

    // 5. Lösche User (Admins) — ABER nur, wenn nach dem Wipe Tom sich
    //    via Setup-Wizard neu registrieren kann (was er via /admin/setup tut).
    //    Voraussetzung: Setup-Wizard ist bedingungslos zugänglich, wenn
    //    User-Tabelle leer ist (Bestand IT1).
    const adminUsersDeleted = await tx.user.deleteMany({});

    return {
      anonymizedBookings: anonymized.count,
      cancelledBookings: cancelled.count,
      pendingReviewsDeleted: pendingReviewsDeleted.count,
      customerUsersDeleted: customerUsersDeleted.count,
      adminUsersDeleted: adminUsersDeleted.count,
    };
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().finally(() => prisma.$disconnect());
```

### 8.2 Cascade-Reihenfolge (verbindlich)

Logisch:

1. **Bookings anonymisieren / stornieren** (FK `customerId` auf NULL).
2. **Reviews** mit `approved=false` hart löschen (Spam-Cleanup).
   APPROVED-Reviews bleiben (sie haben evtl. SEO-Wert).
3. **CustomerUser** löschen.
4. **User** (Admins) löschen.

> **Nicht zu löschen:** `BufferConfig`, `AvailabilityTemplate`, `DayOverride`,
> `Slot`, `BookingAttachment` — diese sind Stammdaten / FK-frei.

### 8.3 Sicherheits-Gate

- `ALLOW_USER_WIPE=true` Env-Var **muss** gesetzt sein.
- Empfehlung: das Skript bricht zusätzlich ab, wenn `NODE_ENV === 'production'` und nicht zusätzlich `--force` mitgegeben wurde.
- `--dry-run` Modus zählt nur, ohne zu schreiben.

### 8.4 Nach dem Wipe

- Tom ruft `/admin/setup` auf — die Setup-Page (Bestand IT1) prüft, ob die `User`-Tabelle leer ist, und legt den ersten Admin an.
- Frische Stripe-Test-Daten / Webhooks bleiben erhalten (kein Stripe-Dashboard-Eingriff durch das Skript).

---

## 9. US-IT6-07 — Admin-Userverwaltung mit interner Notiz/Rating

> **REVISED (v1.6.1) — siehe Anhang B §17.3 (F3 DTO-Leak strukturell)
> und §17.6 (m2 Sort-Whitelist).** §9.2 („Backend-Regel: explizit
> `select` setzen") ist **nicht durchsetzbar als reine Konvention**.
> Verbindlich werden zwei strukturelle Maßnahmen kombiniert: (1) zentrale
> Helper-Funktionen `selectCustomerUserPublic()` /
> `selectCustomerUserAdmin()` in `src/lib/dto/user.ts`, (2)
> Output-Validierung mit `.strict()` auf jedem Customer-facing Endpoint.
> Sort-Param-Whitelist nur für Admin-Endpoints, Customer-API darf
> NIE Sort über interne Felder erlauben.

### 9.1 Datenmodell (siehe §2)

```prisma
model CustomerUser {
  // ... Bestand ...
  // IT6 / US-IT6-07:
  adminNote     String?     // max 1000 Zeichen (App-Layer).
  adminRating   Int?        // 1..5 (App-Layer).
  // ...
}
```

### 9.2 DTO-Trennung (verbindlich)

Zwei Schemas für Output — **niemals** beide vermischen:

```ts
// Bestand: CustomerUserPublicSchema  ← darf NIEMALS adminNote/adminRating enthalten.
// NEU:
export const CustomerUserAdminSchema = CustomerUserPublicSchema.extend({
  adminNote: z.string().max(1000).nullable(),
  adminRating: z.number().int().min(1).max(5).nullable(),
  bookingCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
});
export type CustomerUserAdmin = z.infer<typeof CustomerUserAdminSchema>;
```

**Backend-Regel:** in `lib/customer-portal.ts` und allen Customer-
Endpoints (`/api/customer/*`) wird `prisma.customerUser.findUnique({ select: { …Public-Felder } })`
**explizit** verwendet — niemals `findUnique()` ohne `select`. Engineers-
Hinweis im Header der Datei: „NIE `adminNote` / `adminRating` in
`CustomerUserPublicSchema` aufnehmen oder per Default selecten."

### 9.3 API

| Methode + Pfad                          | Story    | Zweck                                                                       |
| ---------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `GET    /api/admin/users`                | US-IT6-07 | Paginiert (Default 25), suchbar (`?q=`), sortierbar (`?sort=…`). Response: `CustomerUserAdminSchema[]` + `total`. |
| `GET    /api/admin/users/:id`            | US-IT6-07 | Detail-DTO inkl. Buchungen-Liste.                                            |
| `PATCH  /api/admin/users/:id`            | US-IT6-07 | Edit Profil (`firstName`, `lastName`, `phone`) und/oder `adminNote`, `adminRating`. |
| `DELETE /api/admin/users/:id`            | US-IT6-07 | Hartlöschen. Verknüpfte Buchungen werden anonymisiert (FK `customerId` → NULL via `onDelete: SetNull`). |

Voll-Spec siehe `contracts/api-routes.md` §22.4.

### 9.4 Frontend

- Neue Page: `src/app/admin/users/page.tsx` — Server-Component, lädt initial Liste; Client-Komponente für Suche + Pagination.
- Neue Komponenten:
  - `src/components/admin/UserTable.tsx` (Client) — Tabelle mit Sterne-Spalte.
  - `src/components/admin/UserDetailDrawer.tsx` (Client) — Side-Drawer mit Profil-Edit + `adminNote` + `adminRating`-Sterne.
  - `src/components/admin/StarRatingInput.tsx` (Client) — wiederverwendbar (5 klickbare Sterne).
  - `src/components/admin/UserDeleteConfirmDialog.tsx`.

### 9.5 Sicherheits-Tests (zwingend für QA)

- **Leak-Test 1:** `GET /api/customer/me` mit gültiger Customer-Session → Response darf weder `adminNote` noch `adminRating` enthalten. Snapshot-Test gegen `CustomerUserPublicSchema`.
- **Leak-Test 2:** `GET /api/customer/bookings` Response (mit Customer-Join) → Customer-Untertyp identisch zu Public-Schema.
- **403-Test:** Kunde ruft `GET /api/admin/users/:id` → 403.

---

## 10. US-IT6-08 — Finaler Preis pro Buchung

### 10.1 Datenmodell (siehe §2)

```prisma
model Booking {
  // ... Bestand ...
  finalPriceEur     Decimal? @db.Decimal(10, 2)   // 0..99999.99
  finalPriceNote    String?                       // max 200 Zeichen (App-Layer).
  // ...
}
```

> **SQLite + Prisma Decimal:** Prisma serialisiert `Decimal` als
> Strings über die Wire (`"185.00"`). Engineering muss in Frontend
> via `parseFloat` lesen und mit `toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })` formatieren.

### 10.2 API

`PATCH /api/admin/bookings/:id` (existiert; **erweitert** um
`finalPriceEur` und `finalPriceNote`):

```jsonc
// Request body
{
  "finalPriceEur": "185.00",       // String, da Decimal — alternativ number; Backend akzeptiert beide.
  "finalPriceNote": "inkl. Anfahrt",
  // andere Felder bleiben optional
}
```

**Validierung:**
- `finalPriceEur`: `>= 0` und `<= 100000`. Komma-Eingabe im Frontend wird vor Submit zu Punkt-Eingabe konvertiert.
- `finalPriceNote`: max 200 Zeichen.

**Sichtbarkeit:**
- Admin-API `GET /api/bookings`, `GET /api/admin/upcoming-bookings`: enthalten `finalPriceEur` + `finalPriceNote` als nullable.
- Customer-API `GET /api/customer/bookings(/:id)`: **enthalten beide Felder NICHT** (Schema-Filter via `CustomerBookingSchema`).
- `GET /api/bookings/:id` (Bestand, Admin) → enthält Felder.

Voll-Spec siehe `contracts/api-routes.md` §22.5.

### 10.3 Zod-Erweiterung

```ts
// In UpdateBookingStatusSchema oder neuem AdminBookingPatchSchema:
export const AdminBookingPatchSchema = z.object({
  status: BookingStatusSchema.optional(),
  finalPriceEur: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null || v === '') return null;
      const n = typeof v === 'string'
        ? Number(v.replace(',', '.'))
        : v;
      return isFinite(n) ? n : NaN;
    })
    .refine((n) => n === null || (n >= 0 && n <= 100_000), {
      message: 'Bitte einen gültigen Betrag in Euro eingeben (0–100.000).',
    }),
  finalPriceNote: z.string().trim().max(200).optional().nullable(),
});
```

### 10.4 Frontend

- `src/components/admin/BookingTable.tsx`: zusätzliche Spalte „Preis" — `finalPriceEur` formatiert oder „—".
- Bestand `/admin/bookings/[id]` Detail-Page → Eingabefeld „Finaler Preis (EUR)" + optionaler Notiz-Text. Komma als Dezimaltrenner; Frontend-Validierung: nur `[0-9.,]`.

---

## 11. US-IT6-09 — Analytics-Seite

> **REVISED (v1.6.1) — siehe Anhang B §17.9 (m5 Cache-Invalidation).**
> §11.1 (`revalidate: 300`) bleibt als Cache-Default, wird aber durch
> einen **Pflicht-MVP** On-Demand-Revalidation-Aufruf ergänzt: jede
> `PATCH /api/admin/bookings/:id`, die `finalPriceEur` schreibt, ruft
> `revalidateTag('analytics')` auf. Der `?refresh=1`-Toggle bleibt
> Backlog.

### 11.1 Page-Architektur

- Page: `src/app/admin/analytics/page.tsx` — **Server-Component**.
- Daten-Loader: `src/lib/analytics.ts` — gekapselte Prisma-Queries.
- Caching: `export const revalidate = 300;` (5 Minuten ISR). Tom kann manuell `?refresh=1` anhängen — Engineering kann dafür einen `force-dynamic` Toggle einbauen, ist aber Backlog.
- Berechtigung: `requireAdmin()` zuerst.

### 11.2 KPIs & Aggregationen

| KPI                        | Quelle                                                                                 | Prisma                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Gesamtumsatz (gesetzt)     | `SUM(finalPriceEur)` über `Booking` mit `status = 'COMPLETED' AND finalPriceEur != NULL` | `prisma.booking.aggregate({ _sum: { finalPriceEur }, where: { status: 'COMPLETED', finalPriceEur: { not: null } } })` |
| Buchungen abgeschlossen    | `COUNT(*)` über dieselbe Bedingung                                                      | `_count`                                                                                                      |
| Durchschnittlicher Auftragswert | Gesamtumsatz / Anzahl COMPLETED (mit Preis)                                          | abgeleitet                                                                                                    |
| Buchungen diesen Monat     | `COUNT(*)` über `Booking` mit `date LIKE 'YYYY-MM-%'`                                   | `count` mit `where.date.startsWith`                                                                           |
| Umsatz pro Monat (12 M.)   | `GROUP BY substr(date,1,7)` über `Booking` COMPLETED + `finalPriceEur != null`          | Raw-SQL via `prisma.$queryRaw` — Prisma `groupBy` unterstützt kein `substr`. Siehe §11.4.                    |
| Buchungen pro Service      | `groupBy(['service'])` über `Booking` COMPLETED                                          | `prisma.booking.groupBy({ by: ['service'], _count: true, where: { status: 'COMPLETED' } })`                  |
| Top-Kunden                 | `groupBy(['customerId'])` SUM(finalPriceEur)                                            | analog (mit anschließendem Join auf `CustomerUser` für Namen)                                                |

### 11.3 Charting

- **Library:** `recharts` (MIT, ~70 KB gz). In Client-Komponenten-Inseln eingebettet, damit Server-Rendering nicht blockiert wird.
- Komponenten:
  - `src/components/admin/analytics/RevenueChart.tsx` (Client) — Bar/Line.
  - `src/components/admin/analytics/ServicePieChart.tsx` (Client).
  - `src/components/admin/analytics/KpiTile.tsx` (Server).
  - `src/components/admin/analytics/TopCustomersList.tsx` (Server).

Engineer-Hinweis: Als Plan B kann statt `recharts` eine selbstgebaute SVG-Sparkline-Komponente reichen, falls QA-Performance-Test die Lighthouse-Mobile-Score reißt.

### 11.4 Raw-SQL für Monats-Aggregation

```ts
// lib/analytics.ts
const rows = await prisma.$queryRaw<
  Array<{ month: string; total: number; count: number }>
>`
  SELECT
    substr(date, 1, 7) AS month,
    SUM(CAST(finalPriceEur AS REAL)) AS total,
    COUNT(*) AS count
  FROM bookings
  WHERE status = 'COMPLETED'
    AND finalPriceEur IS NOT NULL
    AND date >= date('now', '-12 months')
  GROUP BY month
  ORDER BY month ASC;
`;
```

> **SQLite-Hinweis:** `Decimal` wird als TEXT gespeichert; `CAST(... AS REAL)` ist der saubere Weg für Sums. Falls später Postgres: Type ist Decimal nativ — Cast obsolet.

### 11.5 API (optional)

- `GET /api/admin/analytics?range=30d|90d|12m|ytd` (NEU) — gibt JSON
  zurück, falls Tom später ein Dashboard-Widget außerhalb der Page
  bauen will. Im MVP wird die Page direkt via `lib/analytics.ts`
  gerendert (kein API-Roundtrip nötig).
- AC US-IT6-09 #7: 401 ohne Auth — der Endpoint nutzt `requireAdmin()`.

Voll-Spec siehe `contracts/api-routes.md` §22.6.

### 11.6 Empty-State

Wenn `SUM(finalPriceEur)` NULL ist:
- KPI-Kachel zeigt „—".
- Banner unter den Kacheln: „Noch keine Umsatzdaten — finalen Preis pro Buchung im Detail eintragen, dann erscheinen hier die Auswertungen."

---

## 12. Querschnitt: Authorization-Helper

### 12.1 `requireAdmin()`

Neuer Helper in **`src/lib/auth-server.ts`** (Datei kann existieren; falls nicht, neu anlegen). Wird in **jedem** Admin-Route-Handler als allererste Action aufgerufen.

```ts
// src/lib/auth-server.ts
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

/**
 * Strenges Admin-Gating: lädt User aus DB und prüft Status.
 * - Für API-Routes: wirft `Response` (401/403) — Caller muss `try/catch` ODER `return await requireAdmin()`.
 * - Für Server-Components: redirected via Next.js `redirect()`.
 *
 * Engineering-Convention: in Route-Handlers via `requireAdminApi()`
 * Wrapper benutzen, in Pages via `requireAdminPage()`.
 */
export async function requireAdmin(): Promise<{ id: string; email: string; name: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Login erforderlich.' } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, status: true },
  });
  if (!user) {
    throw new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Account nicht gefunden.' } }), { status: 401 });
  }
  if (user.status !== 'ACTIVE') {
    throw new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Account deaktiviert.' } }), { status: 403 });
  }
  return user;
}

export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (e) {
    redirect('/admin/login?error=account_disabled');
  }
}
```

### 12.2 Migration der bestehenden Endpoints

Engineering soll alle bestehenden `src/app/api/admin/**/route.ts` darauf umstellen. Diff ist mechanisch:

```diff
-  const session = await auth();
-  if (!session?.user) return NextResponse.json({ error: { code: 'UNAUTHORIZED', ... } }, { status: 401 });
+  let me;
+  try { me = await requireAdmin(); } catch (e) { return e as Response; }
```

(Konkret: ein `try { me = await requireAdmin(); } catch (e) { return e as Response; }`-Block am Anfang.)

---

## 13. Migrations-Reihenfolge & Roll-out

> **REVISED (v1.6.1) — siehe Anhang B §17.10 (m6 Reihenfolge
> Wipe vs. Auth-Bereinigung).** Die Reihenfolge in §13.1 (T-06 vor
> T-07) ist mit R2 in §15 inkonsistent. Verbindlich gilt die
> **revidierte** Reihenfolge aus §17.10: **T-07 (Wipe) MUSS vor T-06
> (Auth-Bereinigung) deployed werden**, oder beide werden atomar im
> Bootstrap-Skript zusammengefasst.

### 13.1 Empfohlene Reihenfolge

Umfangreiches Re-Stack — Engineering arbeitet die Tasks in dieser Reihenfolge ab. Stories ohne Querbezug können parallelisiert werden.

```
Phase 1 — Foundation (Backend zuerst):
  T-01  Schema-Migration `users` (US-IT6-01) + `requireAdmin()`-Helper      (Backend)
  T-02  Schema-Migration `customer_users` (US-IT6-07)                      (Backend)
  T-03  Schema-Migration `bookings.finalPriceEur` (US-IT6-08)               (Backend)
  T-04  Schema-Migration `reviews.rejectedAt/moderatedById` (US-IT6-03)     (Backend)
  T-05  Indexe-Migration                                                    (Backend)

Phase 2 — Auth-Bereinigung & Wipe (kritischer Pfad, sequenziell):
  T-06  Auth-Bereinigung: Routen+Komponenten löschen, FB-Provider, Diag.   (Full-Stack)
  T-07  User-Wipe-Skript schreiben, lokal testen                            (Backend)
  T-08  Tom führt Wipe in Staging aus, Engineer im Pair                    (Operational)

Phase 3 — Feature-Build (parallelisierbar):
  T-09  Multi-Admin (US-IT6-01) — API + Page + Components                  (Full-Stack)
  T-10  Admin-Userverwaltung (US-IT6-07) — API + Page + Components         (Full-Stack)
  T-11  Final-Preis (US-IT6-08) — PATCH-Erweiterung + UI                   (Full-Stack)
  T-12  Reviews IT6-Verschärfung (US-IT6-03)                                (Full-Stack)

Phase 4 — Frontend-Heavy (parallel zu Phase 3 möglich):
  T-13  Analytics-Page (US-IT6-09)                                          (Frontend-lastig)
  T-14  Kalender-UX FullCalendar-Integration (US-IT6-02)                    (Frontend-lastig)
  T-15  SEO-Pakete (US-IT6-04) inkl. /services/[slug]/page.tsx              (Frontend-lastig)

Phase 5 — Polish & QA-Gate:
  T-16  Vollständige Smoke-Test-Suite (siehe §14)                           (QA + Eng)
```

### 13.2 Frontend vs. Backend — Engineer-Aufteilung

| Story        | Backend-Tasks                                              | Frontend-Tasks                                                  |
| ------------ | ---------------------------------------------------------- | --------------------------------------------------------------- |
| US-IT6-01    | Migration, 4 Routes, `requireAdmin()`, Login-Status-Gate    | Page `/admin/admins`, AdminTable, Forms                         |
| US-IT6-02    | `/api/admin/calendar/events`, `/api/availability/calendar` | FullCalendar Integration, Mobile-Switch, Popover                |
| US-IT6-03    | Migration, Patch in `/api/customer/reviews`, `/api/admin/reviews` | Trigger-Bedingung in `<ReviewForm>`, ModerationTable Reject-Tab |
| US-IT6-04    | `sitemap.ts`, `robots.ts`, evtl. `/services/[slug]` Loader | `generateMetadata`, OG-Image, JSON-LD-Wrapper, ISR-Config       |
| US-IT6-05    | Routen+Components löschen, FB-Provider integrieren         | Login-Page UX, Banner, Buttons                                  |
| US-IT6-06    | `scripts/reset-users.ts`, ENV-Gate                          | —                                                                |
| US-IT6-07    | Migration, 4 Admin-Routes, DTO-Trennung                    | Page `/admin/users`, Drawer, StarRatingInput                    |
| US-IT6-08    | Migration, `PATCH /api/admin/bookings/:id` Erweiterung     | Eingabefeld in Detail-Page, Spalte in Liste                     |
| US-IT6-09    | `lib/analytics.ts`, optional `GET /api/admin/analytics`    | Page `/admin/analytics`, KpiTile, RevenueChart                  |

---

## 14. Test-Plan IT6

### 14.1 Pflicht-Smoke-Tests (QA-Gate)

1. **Multi-Admin**:
   - Tom legt zweiten Admin an → Liste zeigt 2.
   - Tom deaktiviert sich selbst → Server lehnt ab.
   - Tom deaktiviert zweiten Admin → ok. Versuch, sich neu einzuloggen mit deaktiviertem Account → 422 `ACCOUNT_DISABLED`.
   - Letzter aktiver Admin: Disable verboten.
2. **Auth-Bereinigung**:
   - `POST /api/customer/login` → 404.
   - `POST /api/customer/register` → 404.
   - `/konto/registrieren` → 404.
   - Login mit Google funktioniert.
   - Login mit Facebook funktioniert.
3. **Wipe**:
   - Mit `ALLOW_USER_WIPE=true` → Skript läuft, Summary geprintet.
   - Ohne ENV → Skript bricht ab.
   - Nach Wipe: Setup-Wizard erreichbar; Tom legt sich neu an.
4. **Adminuserverwaltung**:
   - Notiz speichern → erscheint nicht in `GET /api/customer/me`.
   - Snapshot-Test gegen `CustomerUserPublicSchema` (kein `adminNote`).
   - User löschen → verknüpfte Buchungen `customerId === null`.
5. **Reviews**:
   - Review für CONFIRMED-Buchung → 409.
   - Review für COMPLETED → 201.
   - Reject → erscheint nicht mehr in `/api/reviews`.
   - Re-Submit für rejectete Buchung → 409.
6. **Final-Preis**:
   - PATCH mit „185,50" → gespeichert.
   - PATCH mit „-5" → 400.
   - Customer-API liefert keinen `finalPriceEur`-Schlüssel.
7. **Analytics**:
   - Empty-State sichtbar auf frischer DB.
   - Nach Eintragen von 3 finalen Preisen: Summen + Charts korrekt.
   - 401 ohne Auth.
8. **Kalender**:
   - Drag-to-create öffnet Form.
   - Klick auf Buchung öffnet Popover.
   - Mobile (<768px): Monatsansicht ohne H-Scroll.
9. **SEO**:
   - `/sitemap.xml` enthält öffentliche Pages.
   - `/robots.txt` blockt `/admin`, `/api`, `/konto`.
   - Lighthouse Mobile Performance ≥ 80, SEO ≥ 95.

### 14.2 Pressure-Tests (QA muss explizit durchspielen)

- **Race**: zwei parallele Browser-Tabs deaktivieren denselben (vorletzten) Admin → einer von beiden 409 / 422 mit klarer Fehlermeldung.
- **DTO-Leak**: jeder Customer-facing Endpoint per `curl` + JSON-Schema-Validierung gegen `CustomerUserPublicSchema`.
- **OAuth-Edge-Cases**:
  - Google-Konto ohne `email_verified=true` → wir akzeptieren weiterhin (kein Block, aber Notiz im Log).
  - Facebook-User ohne email-Permission → Redirect mit `?error=oauth_no_email`.
- **Wipe-Idempotenz**: Skript zweimal hintereinander → zweiter Run läuft ohne Fehler durch (`deleteMany` ist idempotent).

---

## 15. Annahmen & offene Punkte

> Dies ist die **definitive** Liste. Alles, was hier mit `[NEEDS INPUT]`
> markiert ist, MUSS Tom vor dem Start der jeweiligen Story bestätigen.

### Annahmen (Architekt hat entschieden, Tom kann widersprechen)

- **A1 (US-IT6-01):** Tom legt Fremd-Admins **direkt mit Passwort** an
  (kein Magic-Link). Passwort-Übergabe out-of-band (Telefon/WhatsApp).
  Selbst-Service-Reset für Fremd-Admins ist IT7-Backlog.
- **A2 (US-IT6-02):** Drag-to-create im Admin-Kalender legt einen
  `DayOverride` an (nicht eine separate Slot-Tabelle). Genaue UX
  („was passiert mit der gezogenen Selektion?") nutzt
  `<DayOverrideManager>` mit Vorausfüllung.
- **A3 (US-IT6-04):** SEO-Daten verwendet zunächst Platzhalter für
  Telefon, Adresse, Öffnungszeiten — siehe NEEDS INPUT.
- **A4 (US-IT6-05):** Facebook OAuth wird komplett neu von Tom in
  Meta Developer Portal angelegt; ENV-Variablen werden frisch gesetzt.
- **A5 (US-IT6-05):** Google-„Bad Request" wird **primär** durch
  Konfiguration (Redirect-URI / NEXTAUTH_URL) gefixt — die Code-
  Pfade in `customer-oauth.ts` sind aus IT5 funktional korrekt.
- **A6 (US-IT6-06):** Reset löscht **auch** die User-Tabelle (Admins).
  Tom registriert sich danach via `/admin/setup` neu. Wenn Tom das
  **nicht** möchte, ist das Skript trivial anpassbar — bitte
  klären.
- **A7 (US-IT6-07):** „Hartlöschen" eines CustomerUser anonymisiert
  alle Buchungen via existierendem `onDelete: SetNull`. Reviews mit
  `customerId` bleiben erhalten und zeigen „Anonym" (Bestand IT4).
- **A8 (US-IT6-08):** `finalPriceEur` ist **unabhängig** vom Stripe-
  `Payment.amount`. Tom kann beide unterschiedlich setzen (z.B. Stripe
  100 €, finaler Preis 100 € + 50 € bar = 150 €). Engineering darf sie
  später optional verknüpfen — Backlog.
- **A9 (US-IT6-09):** Analytics zählt **nur** `Booking.status === 'COMPLETED' AND finalPriceEur IS NOT NULL`. Buchungen ohne finalen Preis ignorieren wir komplett, auch wenn Stripe `Payment.amount` existiert. Das ist konsistent mit der AC-Story.

### NEEDS INPUT (Orchestrator soll Tom rückfragen)

- **NI-1 (US-IT6-04):** Telefonnummer für `LocalBusiness` JSON-LD?
  Aktuelle Platzhalter `+49-???-?????`.
- **NI-2 (US-IT6-04):** Vollständige Geschäftsadresse für JSON-LD
  (Straße, PLZ)? Aktuell nur Darmstadt.
- **NI-3 (US-IT6-04):** Bestätigt Tom die Öffnungszeiten Mo–Fr 07:00–18:00
  oder soll Sa abweichend? Aktuell Sa+So aus.
- **NI-4 (US-IT6-04):** OG-Default-Bild — soll ein neues 1200×630
  Markenbild her, oder vorhandenes Hero verwenden?
- **NI-5 (US-IT6-05):** Hat Tom die Facebook-App in Meta Developer
  Portal schon angelegt, oder muss Engineering das Setup begleiten?
- **NI-6 (US-IT6-05):** Sollen wir bestehenden Customer-Konten **vor**
  dem Wipe eine „Bald verschwindet dein Account"-Mail schicken? Wenn
  ja: separate Story / Mail-Template — kein Blocker für IT6.
- **NI-7 (US-IT6-09):** Will Tom auch „Buchungen abgelehnt / storniert"
  als KPI-Kachel? AC-Liste sagt nein, aber wäre nützlich. Backlog.
- **NI-8 (US-IT6-02):** Drag-Verschieben **bestätigter** Buchungen
  (US-IT6-02 Notes nennen das als Could-Have/IT7) — Tom okay damit,
  dass das in IT6 noch nicht da ist? Aktuell sind Buchungs-Blöcke
  read-only.

### Risiken (für QA besonders prüfen)

- **R1 (DTO-Leak)**: das größte Risiko ist, dass `adminNote`/
  `adminRating` doch via `findUnique({ select: undefined })` in einem
  Customer-facing Endpoint geleakt werden. QA muss jeden Customer-
  Endpoint per JSON-Schema-Linter validieren.
- **R2 (Auth-Reihenfolge)**: Wenn die Auth-Bereinigung (US-IT6-05)
  vor dem Wipe (US-IT6-06) live geht und es **noch** Customer-Email/
  Passwort-Konten gibt, sind die mit OAuth-only-Konten verknüpft —
  und können nach Routen-Löschung nicht mehr ihr Passwort zurücksetzen.
  → Reihenfolge `06 → 05` ist sicherer.
- **R3 (Lock-out)**: Wenn `requireAdmin()` einen Bug hat und alle
  laufenden Sessions invalidiert, sperrt sich Tom selbst aus. QA muss
  einen Session-Replay-Test fahren.
- **R4 (Kalender-Performance)**: FullCalendar mit 500+ Buchungen kann
  langsam werden. QA mit Seed-Daten 1.000 Buchungen testen.
- **R5 (SQLite + Decimal)**: `Decimal`-Casting in Raw-SQL (§11.4) kann
  bei sehr großen Beträgen Float-Präzisions-Verluste haben. QA mit
  fiktivem Booking 99.999,99 testen.
- **R6 (Facebook-Email-Optional)**: Wenn Tom nicht klarkommuniziert,
  dass FB ohne Email-Scope abgelehnt wird, hat er Support-Aufwand.
  Frontend-Hinweis nötig.

---

## 16. Akzeptanzkriterien-Mapping IT6

| Story        | Erfüllt durch                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| US-IT6-01    | `User.status` + `requireAdmin()`-Status-Check + Lock-out-Schutz im API. Page `/admin/admins`. Login prüft Status.                          |
| US-IT6-02    | FullCalendar-Integration mit drei Views; `/api/admin/calendar/events`-Aggregator; Drag-to-create öffnet `<DayOverrideManager>`.            |
| US-IT6-03    | `Review.rejectedAt`+`moderatedAt`/`moderatedById` neu; `POST /api/customer/reviews` prüft `status='COMPLETED'`; `GET /api/reviews` filtert hart. |
| US-IT6-04    | `sitemap.ts`, `robots.ts`, `generateMetadata` pro Page, `<JsonLd>`-Wrapper, `next/image`+ISR; Service-Detail-Pages.                        |
| US-IT6-05    | NextAuth-Customer auf Google+Facebook reduziert; alle Customer-Email/Pw-Routes/Pages gelöscht (404). Diagnose-Checkliste in §7.5.          |
| US-IT6-06    | `scripts/reset-users.ts` mit ENV-Gate + Cascade-Reihenfolge.                                                                                |
| US-IT6-07    | `CustomerUser.adminNote/adminRating` neu; `CustomerUserAdminSchema` separates DTO; `/admin/users` Page; Customer-API garantiert leak-frei. |
| US-IT6-08    | `Booking.finalPriceEur` neu; `PATCH /api/admin/bookings/:id` erweitert; UI-Eingabe in Detail; Customer-API filtert das Feld aus.           |
| US-IT6-09    | Page `/admin/analytics` mit Server-Component; Prisma-Aggregationen + Raw-SQL für Monatsumsätze; recharts in Client-Inseln; Empty-State.    |

---

## 17. Anhang B — Revisions nach QA Design Review IT6 (2026-05-03)

> Quelle: `QA_DESIGN_REVIEW_IT6.md` vom 2026-05-03. Verdict:
> **„Needs revision"** — drei Major (F1–F3), sieben Minor (m1–m7).
> Dieser Anhang löst alle Findings verbindlich auf. Die Auflösungen
> sind **Implementierungs-Spec** — Backend setzt sie 1:1 um, kein
> „könnte man machen".
>
> **Versions-Marker:** v1.6.1. Engineering darf keinen Code committen,
> der Anhang B widerspricht. Bei Konflikt mit §1–§16 gilt Anhang B.

---

### 17.1 F1 — Bootstrap-Schutz nach Wipe (US-IT6-06 + US-IT6-01)

**Problem (Recap):** Nach `scripts/reset-users.ts` ist die Tabelle
`users` leer. `/admin/setup` ist in `PUBLIC_ADMIN_PATHS` (siehe
`contracts/api-routes.md` §22.6) und damit **bedingungslos öffentlich**,
solange `users` leer ist. Zwischen Wipe und Toms Setup-Submit kann
ein beliebiger Angreifer die Setup-URL aufrufen und sich als ersten
Admin registrieren — Account-Takeover.

**Entscheidung:** **Variante 1 — `BOOTSTRAP_ADMIN_EMAIL`-Allowlist
(ENV-Var).** Begründung: einfachster strukturell sicherer Mechanismus;
keine Skript-Erweiterung um Initial-Insert nötig (das wäre Variante 3
und erzeugt einen weiteren Code-Pfad mit Passwort-Übergabe-Risiko);
Tom kennt seine Email, ENV ist bereits vorhanden. Die Variante 2
(separater Bootstrap-Token) wurde verworfen, weil Tom dann zwei
Geheimnisse synchron halten müsste (ENV-Var + Form-Eingabe), und der
Token-Roundtrip via Server-Log fehleranfällig ist.

#### 17.1.1 Verbindliche Backend-Spec

`POST /api/admin/setup` (existiert seit IT1) wird wie folgt erweitert:

```ts
// src/app/api/admin/setup/route.ts (Pseudo-Code, verbindlich)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { AdminSetupSchema } from '@/lib/schemas';

export async function POST(req: Request) {
  // 1. Anzahl existierender Admins prüfen.
  const adminCount = await prisma.user.count();

  // 2. Wenn >=1 Admin existiert: Setup ist abgeschlossen → 410 GONE.
  //    (Im Live-Code IT1 ist das schon so; hier nur Bestätigung.)
  if (adminCount >= 1) {
    return NextResponse.json(
      { error: { code: 'GONE', message: 'Setup bereits abgeschlossen.' } },
      { status: 410 },
    );
  }

  // 3. **Allowlist-Gate (NEU, F1-Fix):** ENV `BOOTSTRAP_ADMIN_EMAIL`
  //    MUSS gesetzt sein. Fehlt sie → 503 SETUP_NOT_CONFIGURED.
  const allowedEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) {
    return NextResponse.json(
      {
        error: {
          code: 'SETUP_NOT_CONFIGURED',
          message:
            'Setup ist nicht konfiguriert. ENV `BOOTSTRAP_ADMIN_EMAIL` fehlt.',
        },
      },
      { status: 503 },
    );
  }

  // 4. Body validieren.
  const parsed = AdminSetupSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues } },
      { status: 400 },
    );
  }
  const { email, password, name } = parsed.data;

  // 5. **Email-Match-Gate (NEU, F1-Fix):** Eingabe MUSS exakt der
  //    Allowlist entsprechen. Sonst 403 BOOTSTRAP_NOT_ALLOWED.
  if (email.trim().toLowerCase() !== allowedEmail) {
    return NextResponse.json(
      {
        error: {
          code: 'BOOTSTRAP_NOT_ALLOWED',
          message:
            'Diese E-Mail-Adresse ist für das initiale Setup nicht freigeschaltet.',
        },
      },
      { status: 403 },
    );
  }

  // 6. Admin anlegen.
  const passwordHash = await hash(password, 10);
  const created = await prisma.user.create({
    data: {
      email: email.trim().toLowerCase(),
      name: name.trim(),
      passwordHash,
      status: 'ACTIVE',
      // createdById bleibt NULL (Bootstrap).
    },
    select: { id: true, email: true, name: true, status: true, createdAt: true },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
```

#### 17.1.2 Failure-Modes (verbindlich für QA-Smoke-Tests)

| Szenario                                                                | Ergebnis                              |
| ----------------------------------------------------------------------- | ------------------------------------- |
| `users` leer, `BOOTSTRAP_ADMIN_EMAIL` **fehlt** → POST `/api/admin/setup` | 503 `SETUP_NOT_CONFIGURED` (Setup blockiert) |
| `users` leer, ENV gesetzt, Body-Email **stimmt nicht** mit ENV          | 403 `BOOTSTRAP_NOT_ALLOWED`           |
| `users` leer, ENV gesetzt, Body-Email **stimmt** mit ENV                | 201, Admin angelegt                   |
| `users` enthält bereits ≥1 Datensatz → POST `/api/admin/setup`          | 410 `GONE` (ENV wird **ignoriert**)   |

> **Wichtig (Sicherheits-Architekt):** Sobald `count(users) >= 1` ist,
> gilt das **Setup-Gate aus Schritt 2** — die ENV `BOOTSTRAP_ADMIN_EMAIL`
> wird komplett ignoriert. Damit kann ein Angreifer nicht „warten",
> bis Tom in Zukunft erneut einen Wipe macht und dann mit derselben
> Email einen frischen User „kapern". Der Allowlist-Mechanismus greift
> ausschließlich im Bootstrap-Fenster (Tabellen-leer-Zustand).

#### 17.1.3 Operativ — Roll-out-Reihenfolge (F1 + m6)

1. Eng setzt in Produktion **vor** dem Wipe-Run die ENV-Var:
   ```
   BOOTSTRAP_ADMIN_EMAIL=hausservice-baerenstark@outlook.com
   ```
   (Tom's Allowlist-Email; in Vercel/Hosting-Env-Settings.)
2. Eng führt `scripts/reset-users.ts` mit Tom im Pair aus (siehe §13.1
   T-07 / T-08). **Vor diesem Schritt** ist `BOOTSTRAP_ADMIN_EMAIL`
   bereits live in Prod-Env.
3. Tom ruft `/admin/setup` auf, gibt **seine** Email + neues Passwort
   ein. POST liefert 201.
4. Eng prüft: `prisma.user.count() === 1` und Login funktioniert.
5. **Empfehlung (nicht Pflicht):** ENV-Var `BOOTSTRAP_ADMIN_EMAIL`
   nach erfolgreichem Bootstrap aus dem Hosting-Env entfernen.
   Schadet nicht (Schritt 2 ignoriert sie sowieso), aber sauberer.

#### 17.1.4 Schema/Contract-Eingriffe

- `contracts/api-routes.md` §22.6: ENV-Tabelle erhält
  `BOOTSTRAP_ADMIN_EMAIL` (siehe §22.9 in der Live-Datei).
- `contracts/zod-schemas.ts`: keine neuen Schemas nötig
  (`AdminSetupSchema` existiert seit IT1). Neue Fehlercodes
  `SETUP_NOT_CONFIGURED` (503) und `BOOTSTRAP_NOT_ALLOWED` (403) werden
  in der `ApiErrorSchema`-enum-Liste der Live-Codebase ergänzt
  (Engineering-Hinweis in §17.13 unten).

---

### 17.2 F2 — Letzter-Admin-Race (US-IT6-01)

**Problem (Recap):** TOCTOU zwischen `count({ status: 'ACTIVE' }) > 1`
und folge-`update`. Zwei parallele PATCH-Requests können beide den
Check passieren und sich gegenseitig deaktivieren → keine aktiven
Admins mehr → Lock-out.

**Entscheidung:** **Conditional UPDATE per `prisma.$queryRaw`** mit
Bedingung „target ist ACTIVE **und** es gibt mindestens einen anderen
ACTIVE-Admin". Backend prüft die Anzahl betroffener Zeilen
(`affectedRows`); bei 0 → 409 `LAST_ADMIN_LOCK`.

Begründung gegen `$transaction({ isolationLevel: 'Serializable' })`:
libSQL/Turso ist SQLite-basiert; in SQLite ist die einzige verfügbare
Isolation effektiv `SERIALIZABLE` per Default (ein-Schreiber-Modell).
Aber Prisma's `$transaction`-Wrapper bietet **kein** explizites
Pessimistic-Locking-Primitiv (`SELECT ... FOR UPDATE` wird in SQLite
als No-Op geparst). Die einzig portable und nachweisbar atomare
Variante ist ein **einziger UPDATE-Statement**, dessen WHERE-Klausel
die Vorbedingung enthält. Postgres-Migrations-Pfad bleibt
kompatibel (`UPDATE ... WHERE EXISTS (...)` ist ANSI-SQL).

#### 17.2.1 Verbindliche Backend-Spec

Helper in `src/lib/admin-status.ts` (NEU):

```ts
// src/lib/admin-status.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Atomar disable-fähig?
 *
 * Setzt `status = 'DISABLED'` für `targetId`, **aber nur**, wenn:
 *   1. `targetId` aktuell `status = 'ACTIVE'` ist (idempotent),
 *   2. Mindestens **ein anderer** ACTIVE-Admin existiert.
 *
 * Gibt `true` zurück, wenn das Update erfolgreich war,
 * `false` (→ 409 LAST_ADMIN_LOCK) sonst.
 *
 * **Race-Verhalten:** Bei zwei parallelen Disable-Requests auf zwei
 * unterschiedliche Targets gewinnt **einer** das Update — der zweite
 * Request sieht in seinem WHERE-Subselect schon den ersten als
 * DISABLED und liefert `affectedRows = 0`.
 */
export async function disableAdminSafely(targetId: string): Promise<boolean> {
  // libSQL/Turso-kompatibles Conditional UPDATE.
  // Wichtig: Subselect prüft `id != targetId AND status = 'ACTIVE'`
  // — d.h. der Target zählt nicht zum Mindestbestand.
  const result = await prisma.$executeRaw`
    UPDATE users
    SET status = 'DISABLED',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${targetId}
      AND status = 'ACTIVE'
      AND EXISTS (
        SELECT 1 FROM users u2
        WHERE u2.id <> ${targetId}
          AND u2.status = 'ACTIVE'
      )
  `;
  // `$executeRaw` liefert die Anzahl betroffener Zeilen (number).
  return result === 1;
}
```

#### 17.2.2 Verbindliche Verwendung in Endpoints

`PATCH /api/admin/admins/:id` (siehe `contracts/api-routes.md` §22.1):

```ts
// src/app/api/admin/admins/[id]/route.ts (Auszug, verbindlich)
const me = await requireAdmin(); // siehe §12.1
const targetId = params.id;
const body = UpdateAdminSchema.parse(await req.json());

// Self-Mutation-Check (außerhalb der Transaktion ok — das ist nicht
// Race-anfällig, weil Self-Mutation keine "Anzahl"-Bedingung hat).
if (body.status === 'DISABLED' && targetId === me.id) {
  return NextResponse.json(
    { error: { code: 'SELF_MUTATION_FORBIDDEN', message: 'Selbst-Deaktivierung verboten.' } },
    { status: 409 },
  );
}

// Letzter-Admin-Race: atomar via Helper.
if (body.status === 'DISABLED') {
  const ok = await disableAdminSafely(targetId);
  if (!ok) {
    // Entweder Target ist schon DISABLED (idempotent OK → 200) ODER
    // letzter aktiver Admin (409). Wir unterscheiden via einem zweiten
    // gezielten Read.
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { status: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Admin nicht gefunden.' } },
        { status: 404 },
      );
    }
    if (target.status === 'DISABLED') {
      // Bereits disabled — Idempotenz: 200 mit aktuellem Datensatz.
      return NextResponse.json({ data: await loadAdminListItem(targetId) }, { status: 200 });
    }
    // → letzter Admin
    return NextResponse.json(
      { error: { code: 'LAST_ADMIN_LOCK', message: 'Mindestens ein aktiver Admin muss übrig bleiben.' } },
      { status: 409 },
    );
  }
  return NextResponse.json({ data: await loadAdminListItem(targetId) }, { status: 200 });
}

// Alle übrigen Felder (name/email) sind nicht Race-anfällig.
const updated = await prisma.user.update({
  where: { id: targetId },
  data: pickDefined({ name: body.name, email: body.email }),
});
return NextResponse.json({ data: AdminListItemSchema.parse(updated) }, { status: 200 });
```

`DELETE /api/admin/admins/:id` (Soft-Delete = Disable, semantisch
identisch): nutzt **denselben** Helper `disableAdminSafely(targetId)`.
Self-DELETE ist analog verboten (`SELF_MUTATION_FORBIDDEN`).

#### 17.2.3 Andere Endpoints, die Admin-Status ändern

Aktuell gibt es nur **diesen einen** Endpoint, der `users.status`
mutiert. Sollte in IT7 ein weiterer Endpoint hinzukommen
(z.B. „Admin demoten zur CUSTOMER-Rolle" — IT7-Backlog), MUSS er
ebenfalls den Helper `disableAdminSafely()` (oder eine analoge
`demoteAdminSafely()`-Variante mit identischer Subselect-Logik)
nutzen. Dies ist eine Architektur-Regel: **jeder Code-Pfad, der
einen Admin-Status auf `DISABLED` setzt oder die Admin-Rolle
entzieht, MUSS atomar prüfen, dass mindestens ein anderer ACTIVE-
Admin verbleibt.**

#### 17.2.4 QA-Test-Spec (Pflicht-Smoke, nicht „Pressure")

> §14.2-Eintrag „Race" wird zu §14.1-Pflicht-Smoke-Test (siehe §17.12 unten).

```bash
# Race-Test (zwei parallele Sessions, je gegenseitig disablen).
# QA-Skript: tools/qa/last-admin-race.sh

# Setup: zwei aktive Admins (Tom, Lisa), beide mit gültigen Sessions.
# Beide Calls werden via `&` parallel gestartet:

curl -s -X PATCH /api/admin/admins/$LISA_ID \
  -H "Cookie: $TOM_SESSION" \
  -d '{"status":"DISABLED"}' &
curl -s -X PATCH /api/admin/admins/$TOM_ID \
  -H "Cookie: $LISA_SESSION" \
  -d '{"status":"DISABLED"}' &
wait

# Erwartung: GENAU EINER liefert 200, der andere 409 LAST_ADMIN_LOCK.
# Verifikation: prisma.user.count({ where: { status: 'ACTIVE' } }) === 1.
```

---

### 17.3 F3 — DTO-Leak `adminNote`/`adminRating` strukturell absichern (US-IT6-07)

**Problem (Recap):** Engineering-Convention „setze `select` per Hand"
ist nicht durchsetzbar. Ein zukünftiger PR kann
`prisma.customerUser.findUnique({ where: ... })` ohne `select` aufrufen
und das Ergebnis durch ein Zod-Schema parsen, das Extra-Felder per
Default ignoriert (Zod ohne `.strict()`). → `adminNote` leakt im Body.

**Entscheidung:** **Kombination aus 1 + 2** aus dem QA-Vorschlag —
zentrale Helper-Funktionen für den `select`-Block UND `.strict()` als
Output-Validation-Pflicht in jedem Customer-Response. Plus ein
CI-Test (Variante 3), der per AST-Scan sicherstellt, dass keine
unmaskierten Prisma-Calls im Customer-Pfad existieren.

#### 17.3.1 Verbindliche Helper-Datei `src/lib/dto/user.ts`

```ts
// src/lib/dto/user.ts (NEU, verbindlich)
import { Prisma } from '@prisma/client';

/**
 * **Zentrale Wahrheit für Customer-User-Selects.**
 *
 * Jeder Code-Pfad, der `prisma.customerUser.find*` in einem
 * Customer-facing Endpoint aufruft, MUSS einen dieser beiden
 * Helper als `select` übergeben. Direkter Aufruf von
 * `findUnique({ where: ... })` ohne `select` ist verboten und
 * wird vom Lint/CI-Test (siehe §17.3.4) abgelehnt.
 */

/**
 * Public-/Customer-Select. Enthält **niemals** `adminNote` oder `adminRating`.
 *
 * Strukturell garantiert, dass keine internen Felder rausgehen — selbst
 * wenn das Schema später erweitert wird.
 */
export const selectCustomerUserPublic = () =>
  ({
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    emailVerified: true,
    oauthProvider: true,
    avatarUrl: true,
    hasPassword: true, // computed im Mapper, falls nicht direkt in DB.
    createdAt: true,
  }) satisfies Prisma.CustomerUserSelect;

/**
 * Admin-Select. Erweitert Public um die internen Felder.
 * Wird ausschließlich in `/api/admin/users*`-Endpoints verwendet.
 */
export const selectCustomerUserAdmin = () =>
  ({
    ...selectCustomerUserPublic(),
    adminNote: true,
    adminRating: true,
    // bookingCount wird via Aggregation/Subselect ergänzt — siehe Mapper.
  }) satisfies Prisma.CustomerUserSelect;

/**
 * Type-Aliases (TypeScript zwingt die Caller, das richtige Shape zu
 * importieren — kein „raw row"-Pass-Through).
 */
export type CustomerUserPublicRow = Prisma.CustomerUserGetPayload<{
  select: ReturnType<typeof selectCustomerUserPublic>;
}>;

export type CustomerUserAdminRow = Prisma.CustomerUserGetPayload<{
  select: ReturnType<typeof selectCustomerUserAdmin>;
}>;
```

#### 17.3.2 Verbindliche Output-Validierung mit `.strict()`

Alle relevanten Zod-Output-Schemas werden auf `.strict()` umgestellt
(`contracts/zod-schemas.ts`). `.strict()` lässt Zod im Output-Parse
einen Fehler werfen, wenn das geparste Objekt **unbekannte** Keys
enthält. Damit fängt ein versehentliches `findUnique` ohne `select`
**laufzeit-sicher** auf.

**Schemas, die `.strict()` bekommen (verbindlich):**

| Schema                        | Zweck                                             | Pflicht-Endpoints                       |
| ----------------------------- | ------------------------------------------------- | --------------------------------------- |
| `CustomerUserPublicSchema`    | Customer eigene-Profile-Antwort                   | `GET /api/customer/me` u.a.             |
| `CustomerBookingSchema`       | Buchung im Kundenportal                            | `GET /api/customer/bookings(/:id)`      |
| `PublicReviewSchema`          | Öffentlicher Review-Output                         | `GET /api/reviews`                      |

**Beispiel-Patch in `contracts/zod-schemas.ts`:**

```ts
// VORHER:
export const CustomerUserPublicSchema = z.object({ ... });

// NACHHER (verbindlich):
export const CustomerUserPublicSchema = z.object({ ... }).strict();
```

#### 17.3.3 Verbindliche Output-Parse-Pflicht im Response-Layer

Jeder Customer-facing Route-Handler muss **vor** dem `NextResponse.json()`-
Call das Output-Objekt durch das `.strict()`-Schema parsen. Das ist
nicht „Belt-and-Suspenders" — das ist die zweite Sicherung, die ein
versehentliches Leak (Spread-Operator-Fehler im Mapper, Prisma-Result
ohne `select`) bei der **Response** abfängt:

```ts
// src/app/api/customer/me/route.ts (Auszug, verbindlich)
import { selectCustomerUserPublic } from '@/lib/dto/user';
import { CustomerUserPublicSchema } from '@/lib/schemas';

export async function GET(req: Request) {
  const me = await requireCustomer(); // bestehender Helper.
  const row = await prisma.customerUser.findUnique({
    where: { id: me.id },
    select: selectCustomerUserPublic(), // ← Pflicht (kein direktes Default-Find).
  });
  if (!row) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  // ↓ Zweite Sicherung: .strict() wirft 500, wenn der Mapper unbekannte
  //   Keys (z.B. adminNote) durchschleusen würde.
  const validated = CustomerUserPublicSchema.parse({
    ...row,
    hasPassword: row.passwordHash !== null, // computed (kein Leak von passwordHash selbst).
  });
  return NextResponse.json({ data: validated });
}
```

> **Engineering-Hinweis:** Wenn `.strict().parse()` zur Laufzeit wirft,
> ist das ein **Server-Bug** (DTO-Leak). Der Caller bekommt 500 mit
> Code `INTERNAL_ERROR` — das ist gewollt. Niemals den `.strict()`-
> Check unterdrücken oder auf `.passthrough()` umstellen.

#### 17.3.4 CI-Test (Variante 3, Defense-in-Depth)

Ergänzend zu Helper + `.strict()` wird ein CI-Test eingeführt, der
verhindert, dass jemand aus Versehen den Helper umgeht.

`tests/architecture/no-raw-customer-user-find.test.ts` (NEU,
verbindlich):

```ts
// Vitest + AST-Grep oder eslint-Programmatic-API.
// Pseudo-Implementation:
import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import path from 'node:path';

describe('Architecture: no leaky customerUser selects in customer paths', () => {
  const project = new Project({
    tsConfigFilePath: path.resolve(__dirname, '../../tsconfig.json'),
  });

  it('every prisma.customerUser.find* in src/app/api/customer/** uses selectCustomerUserPublic()', () => {
    const files = project.getSourceFiles('src/app/api/customer/**/*.ts');
    const offenders: string[] = [];

    for (const file of files) {
      file.forEachDescendant((node) => {
        const text = node.getText();
        // Match: prisma.customerUser.findUnique / findFirst / findMany
        // Forbidden: any such call without `selectCustomerUserPublic()` in args.
        if (/prisma\.customerUser\.find(Unique|First|Many)\b/.test(text)) {
          if (!text.includes('selectCustomerUserPublic()')) {
            offenders.push(`${file.getFilePath()}:${node.getStartLineNumber()} → ${text.slice(0, 120)}`);
          }
        }
      });
    }

    expect(offenders, `Customer-API leaks: \n${offenders.join('\n')}`).toEqual([]);
  });

  it('every prisma.customerUser.find* in src/lib/customer-portal.ts uses selectCustomerUserPublic()', () => {
    // analog für die zentrale Customer-Lib.
    // ...
  });
});
```

> **CI-Pflicht:** Test läuft im Pre-Merge-Gate (`pnpm test:arch` als
> Teil von `pnpm test`). Fail blockiert den Merge.

#### 17.3.5 Snapshot-Test (Build-Phase, QA)

Zur Sicherheit ergänzt QA in der Build-Phase einen Integrations-
Snapshot-Test:

```ts
// tests/api/customer-leak.test.ts (Build-Phase, QA-Pflicht)
it('GET /api/customer/me does not leak adminNote/adminRating', async () => {
  // Seed: Customer A mit adminNote='SECRET' und adminRating=1.
  await seedCustomer({ id: 'cu_a', adminNote: 'SECRET', adminRating: 1 });
  const res = await fetchAs('cu_a', 'GET /api/customer/me');
  const body = await res.json();
  expect(body.data).not.toHaveProperty('adminNote');
  expect(body.data).not.toHaveProperty('adminRating');
  // Doppelter Strict-Check (würde im Server schon werfen).
  expect(() => CustomerUserPublicSchema.parse(body.data)).not.toThrow();
});

it('GET /api/customer/bookings does not leak adminNote in joined customer', async () => {
  // analog.
});
```

---

### 17.4 (frei — wird in zukünftigen Patches verwendet)

---

### 17.5 m1 — Public-Reviews-Output-Schema verbindlich binden (US-IT6-03)

**Problem (Recap):** `GET /api/reviews` antwortet aktuell konzeptionell
mit „Reviews" — die Bindung an `PublicReviewSchema` (statt dem
breiteren `ReviewSchema`, das `customerId`/`bookingId` enthält) ist
nicht eindeutig dokumentiert.

**Verbindlich (Auflösung):**

1. **Output-Schema für `GET /api/reviews`** ist
   `PublicReviewSchema.strict()` — kein `customerId`, kein `bookingId`,
   kein `userId`, kein `moderatedById`. Whitelist:
   - `id`
   - `customerName` (Format `"Vorname N."` — Backend kürzt
     `lastName` auf den ersten Buchstaben + Punkt; bei
     `customerId === null` → `"Anonym"`)
   - `service`
   - `stars`
   - `text`
   - `createdAt`

2. **User-Felder im Output:** **nur Vorname + Nachname-Initial.** Die
   Email, vollständige Nachname, Telefonnummer, OAuth-Provider und
   Avatar werden NIEMALS in der öffentlichen Review-Response
   ausgegeben. Backend-Mapper:

   ```ts
   // src/lib/reviews.ts
   function publicCustomerName(customer: { firstName: string; lastName: string } | null): string {
     if (!customer) return 'Anonym';
     const initial = customer.lastName.trim().charAt(0).toUpperCase();
     return `${customer.firstName.trim()} ${initial}.`;
   }
   ```

3. **Response-Parse-Pflicht:** Vor `NextResponse.json()` wird das Array
   durch `z.array(PublicReviewSchema).parse(...)` gejagt. Bei Strict-
   Verstoß → 500 (Server-Bug, kein User-Error).

4. **Snapshot-Test (QA-Pflicht):**
   `tests/api/public-reviews-shape.test.ts` validiert, dass der
   Endpoint **nur** die obigen 6 Keys liefert. Schlägt fehl, sobald
   `customerId` oder `bookingId` durchschlägt.

---

### 17.6 m2 — Sort-Whitelist im Admin-Users-Endpoint (US-IT6-07)

**Problem (Recap):** `adminRating_desc` ist Admin-only, aber falls
Engineering versehentlich Sort-Pass-Through im Customer-API einbaut,
wäre das ein Inferenz-Side-Channel.

**Verbindlich (Auflösung):**

1. **Admin-API:** Sort-Param ist auf die folgende, abschließende
   Whitelist beschränkt:
   - `lastName_asc` (default)
   - `createdAt_desc`
   - `bookingCount_desc`
   - `adminRating_desc`

   Werte außerhalb der Liste → 400 `VALIDATION_ERROR` (Zod-Enum
   greift, siehe `AdminUsersQuerySchema` in `contracts/zod-schemas.ts`
   §1801).

2. **Customer-API:** Sort-Param ist **vollständig verboten**. Kein
   Endpoint unter `/api/customer/*` akzeptiert einen `sort`-Query-
   Parameter. Falls IT7 eine Customer-Liste einführt
   (z.B. Buchungs-Sortierung im Portal), MUSS die Whitelist explizit
   neu definiert werden — und sie darf **niemals** Felder enthalten,
   die auf interne Daten (`adminNote`, `adminRating`,
   `finalPriceEur`, `passwordHash`) abbilden.

3. **CI-Test (analog §17.3.4):** Neuer Architektur-Test
   `tests/architecture/no-internal-sort-in-customer.test.ts` scannt
   nach `sort.*adminRating|sort.*adminNote|sort.*finalPriceEur` in
   `src/app/api/customer/**` — fail blockiert den Merge.

---

### 17.7 m3 — Stripe-Customer-Records beim Wipe (US-IT6-06)

**Problem (Recap):** Aus DSGVO-Sicht ist der lokale Wipe rechtlich
zulässig. Stripe hält jedoch **eigene** Customer-Records (Email,
Adresse) — der Hinweis fehlt im Doc.

**Verbindlich (Auflösung):**

1. **Skript-Verhalten (klarstellend, kein Code-Eingriff):**
   `scripts/reset-users.ts` macht **keine** Stripe-API-Calls. Lokale
   `Payment`-Records bleiben in der `payments`-Tabelle stehen
   (Stammdaten / Audit) — ihre `bookingId` bleibt referenziert; nur
   `Booking.customerId` wird auf NULL gesetzt (siehe §8.2).

2. **Operativer Schritt für Tom (DSGVO-Verantwortung, dokumentiert):**
   Tom muss nach erfolgreichem Wipe in **Stripe Dashboard**
   (Customers-Tab) die nicht mehr benötigten Customer-Records
   manuell archivieren oder löschen. Die Liste der zu archivierenden
   Customer-IDs wird vom Wipe-Skript im Summary-Output als optionales
   Feld gedruckt — **NEU als Pflicht**:

   ```ts
   // scripts/reset-users.ts — Erweiterung des summary-Outputs:
   const stripeCustomerIds = await tx.payment.findMany({
     select: { stripeSessionId: true /* ggf. customerId, falls vorhanden */ },
     where: { /* ... */ },
   });
   summary.stripeCustomerIds = stripeCustomerIds
     .map(p => p.stripeSessionId)
     .filter(Boolean);
   ```

   > Engineering-Hinweis: Falls `Payment` keinen `stripeCustomerId`-
   > Spalten hat (aktuelles Schema hat nur `stripeSessionId`), liefert
   > das Skript stattdessen die Liste der Sessions; Tom kann pro
   > Session in Stripe den Customer aufrufen.

3. **Doku-Eintrag (Tom-Brief):**
   `docs/runbook-wipe-IT6.md` (Engineering legt das Runbook im
   Build-Phase an) enthält ab sofort einen Abschnitt
   „**Stripe-Cleanup (manuell, DSGVO-Verantwortung Tom)**" mit der
   Schritt-Liste.

---

### 17.8 m4 — Calendar-Prefetch + Mobile-Touch-Floor (US-IT6-02)

**Problem (Recap):** Range-Limits sind ok (max 90 d Admin, max 62 d
Public). Aber: keine Prefetch-Strategie für Folgemonate; keine
explizite Mobile-Touch-Floor-Höhe für Slots.

**Verbindlich (Auflösung):**

1. **Public-Calendar-Prefetch (`/buchung`, `<BookingCalendar>`):**
   - Initial-Load: aktueller sichtbarer Monat
     (`from = first(visibleMonth)`, `to = last(visibleMonth)`).
   - **Prefetch-Pflicht:** unmittelbar nach dem Initial-Load (im
     `useEffect` mit `setTimeout(..., 200ms)` Idle-Hint) lädt der
     Component den Folgemonat im Hintergrund (gleicher Endpoint,
     `from`/`to` für nächsten Monat).
   - Cache-Strategie: SWR/Tanstack-Query `staleTime: 5min`. Beim
     Vorwärts-Wechsel des Users ist der Folgemonat schon im Cache —
     kein Spinner.
   - Range-Hard-Limit: 62 Tage pro Anfrage (existiert via
     `AvailabilityCalendarQuerySchema`). Wenn Frontend-Code
     versehentlich >62 Tage anfordert, antwortet das Backend mit
     400 `VALIDATION_ERROR`.

2. **Admin-Calendar-Prefetch (`/admin/kalender`):**
   - Initial-Load: aktuell sichtbarer Bereich (Wochenview = 7 Tage,
     Monatsview = ~31 Tage).
   - Beim Bereichs-Wechsel (next/prev): kein Prefetch (Tom navigiert
     selten weit, und der Endpoint ist Admin-only mit `cache: no-store`).
   - Range-Hard-Limit: 90 Tage pro Anfrage.

3. **Mobile-Touch-Floor (verbindlich):**
   - Min-Höhe pro Slot/Day-Cell auf Mobile (<768px): **44 px**
     (Apple HIG-Standard für Touch-Targets, WCAG-AAA-Empfehlung).
   - FullCalendar-Konfiguration: `slotMinTime: '07:00'`,
     `slotMaxTime: '18:00'`, `slotDuration: '00:30'`,
     `aspectRatio: 0.7` auf Mobile, plus eigenes CSS:
     ```css
     /* src/styles/calendar-mobile.css */
     @media (max-width: 767px) {
       .fc .fc-timegrid-slot { min-height: 44px; }
       .fc .fc-daygrid-day  { min-height: 44px; }
     }
     ```
   - Tap-Targets (Klick auf Tag/Buchungsblock): mindestens 44×44 px.
     QA validiert mit Lighthouse-Mobile-Tap-Target-Audit.

4. **Lighthouse-Hard-Floor (anstelle „Richtwert"):**
   - Mobile Performance: **≥ 75** (war: 80+ Soft-Target). 75 als
     verbindlicher Acceptance-Gate, Trigger für Plan-B-Fallback.
   - Wenn Lighthouse-Mobile-Performance < 75: Engineering wechselt
     auf `react-big-calendar` (Plan B aus §4.1). Pflicht im QA-Build-
     Gate.

---

### 17.9 m5 — Analytics On-Demand-Cache-Invalidation (US-IT6-09)

**Problem (Recap):** ISR `revalidate: 300` bedeutet bis zu 5 Minuten
Stale-Daten — Tom ändert `finalPriceEur` und sieht in `/admin/analytics`
weiterhin alte KPIs.

**Verbindlich (Auflösung):**

1. **Tag-basiertes Caching auf der Analytics-Seite und der API-Route:**

   ```ts
   // src/app/admin/analytics/page.tsx
   export const revalidate = 300;
   export const fetchCache = 'force-cache';
   export const dynamic = 'force-static'; // oder 'auto' — Engineering wählt.

   import { unstable_cache } from 'next/cache';
   import { computeAnalytics } from '@/lib/analytics';

   const getCachedAnalytics = unstable_cache(
     (range: string) => computeAnalytics(range),
     ['analytics'],
     { revalidate: 300, tags: ['analytics'] },
   );
   ```

2. **Pflicht-Invalidation im PATCH-Endpoint:**

   ```ts
   // src/app/api/admin/bookings/[id]/route.ts (PATCH)
   import { revalidateTag } from 'next/cache';

   export async function PATCH(req: Request, { params }: { params: { id: string } }) {
     const me = await requireAdmin();
     const body = AdminBookingPatchSchema.parse(await req.json());

     const before = await prisma.booking.findUnique({
       where: { id: params.id },
       select: { finalPriceEur: true, status: true },
     });
     if (!before) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

     const updated = await prisma.booking.update({
       where: { id: params.id },
       data: pickDefined({ status: body.status, finalPriceEur: body.finalPriceEur, finalPriceNote: body.finalPriceNote }),
     });

     // ← NEU (m5-Fix, Pflicht):
     // Invalidiere Analytics, wenn:
     //   - finalPriceEur wurde geschrieben (auch wenn Wert gleich ist), ODER
     //   - status wechselte zu/von 'COMPLETED'.
     const finalPriceTouched = body.finalPriceEur !== undefined;
     const statusFlipsCompleted =
       (before.status !== 'COMPLETED' && updated.status === 'COMPLETED') ||
       (before.status === 'COMPLETED' && updated.status !== 'COMPLETED');
     if (finalPriceTouched || statusFlipsCompleted) {
       revalidateTag('analytics');
     }

     return NextResponse.json({ data: BookingAdminSchemaIT6.parse(updated) });
   }
   ```

3. **API-Route `GET /api/admin/analytics`:** identisches
   `unstable_cache`-Wrapping (selber Tag `analytics`). Damit
   invalidiert ein einzelner `revalidateTag('analytics')`-Call beide
   Caches (Page + API).

4. **`?refresh=1`-Toggle (klarstellend, weiterhin Backlog):** kein
   MVP-Bestandteil. Wird durch m5-Fix obsolet.

5. **QA-Smoke-Test (Pflicht):**
   - PATCH `finalPriceEur` von `null` → `250.00`.
   - Direkt danach: `GET /admin/analytics` (oder API-Variante) →
     `totalRevenueEur` enthält die 250 €.
   - Maximal-Latenz: 2 s (Render-Zeit). Wenn länger: Tag-
     Invalidation greift nicht — Bug.

---

### 17.10 m6 — Reihenfolge §13.1 vs. R2 vereindeutigen (US-IT6-05 + US-IT6-06)

**Problem (Recap):** §13.1 listet `T-06 Auth-Bereinigung` vor
`T-07 Wipe`, R2 in §15 sagt aber „Reihenfolge `06 → 05` ist sicherer".
Inkonsistenz im Doc.

**Verbindlich (Auflösung):**

**Reihenfolge ist `06 → 05`** (Wipe **vor** Auth-Bereinigung).
Begründung: Wenn die Auth-Bereinigung (Routes-Löschung) vor dem Wipe
deployed wird, gibt es ein Zeitfenster, in dem bestehende Customer-
Email/Pw-Konten nicht mehr Passwort-Reset machen können. Wipe-zuerst
räumt diese Konten weg → Auth-Bereinigung kann gefahrlos folgen.

**Aktualisierte Phase-2-Reihenfolge (verbindlich):**

```
Phase 2 — Wipe & Auth-Bereinigung (kritischer Pfad, sequenziell):
  T-06a  ENV `BOOTSTRAP_ADMIN_EMAIL` in Prod setzen                       (Operational)
  T-06b  Setup-Endpoint mit Allowlist-Gate deployen (F1-Fix, §17.1)        (Backend)
  T-07   User-Wipe-Skript schreiben + lokal testen                         (Backend)
  T-08   Tom + Engineer im Pair: Wipe in Staging,
         dann Prod (--force, ALLOW_USER_WIPE=true)                         (Operational)
  T-09   Tom ruft /admin/setup auf, Bootstrap-Admin angelegt               (Operational)
  T-10   Auth-Bereinigung deployen (Routes löschen, FB-Provider rein)     (Full-Stack)
```

Die alten Task-Labels T-06/T-07/T-08 werden in Anhang B durch das obige
Schema **ersetzt**. Der ursprüngliche §13.1-Text ist erhalten, aber
**nicht mehr maßgeblich** — diese Reihenfolge gilt.

**R2 in §15 wird umformuliert (verbindlich):** „Wipe (US-IT6-06) MUSS
**vor** Auth-Bereinigung (US-IT6-05) deployed werden. Begründung wie
oben."

---

### 17.11 m7 — Review bei Booking-CANCELLED-Rollback (US-IT6-03)

**Problem (Recap):** Edge-Case: Buchung wird COMPLETED → Review
geschrieben → Tom approved → Buchung wird auf CANCELLED zurückgesetzt
(Stornierung im Nachgang). Review bleibt sichtbar — gewollt?

**Verbindlich (Auflösung):**

**Bei Rückkehr in einen nicht-COMPLETED-Status (insbesondere CANCELLED)
wird die Review automatisch als REJECTED markiert (`approved=false`,
`rejectedAt=now()`).** Die Review bleibt im Datenmodell erhalten
(Audit-Spur), erscheint aber **nicht mehr** in `GET /api/reviews` (siehe
§5.3-Filter). Der Kunde bekommt **keine** neue Möglichkeit,
einzureichen (UNIQUE auf `bookingId` greift, plus existierender
Spam-Schutz „REVIEW_EXISTS").

**Implementierung (verbindlich):**

```ts
// src/app/api/admin/bookings/[id]/route.ts (PATCH, ergänzt §17.9)
const before = await prisma.booking.findUnique({
  where: { id: params.id },
  select: { status: true, review: { select: { id: true, approved: true } } },
});

const willCancel =
  body.status === 'CANCELLED' && before?.status !== 'CANCELLED';
const willLeaveCompleted =
  before?.status === 'COMPLETED' && body.status && body.status !== 'COMPLETED';

await prisma.$transaction(async (tx) => {
  await tx.booking.update({
    where: { id: params.id },
    data: pickDefined({ status: body.status, finalPriceEur: body.finalPriceEur, finalPriceNote: body.finalPriceNote }),
  });

  // m7-Fix: Auto-Reject der Review, falls Booking aus COMPLETED
  // herausläuft oder hart storniert wird.
  if ((willCancel || willLeaveCompleted) && before?.review?.id) {
    await tx.review.update({
      where: { id: before.review.id },
      data: {
        approved: false,
        rejectedAt: new Date(),
        moderatedAt: new Date(),
        moderatedById: me.id,
      },
    });
  }
});

// Cache-Invalidation (m5).
if (finalPriceTouched || statusFlipsCompleted || willCancel) {
  revalidateTag('analytics');
  revalidateTag('public-reviews'); // siehe §17.5: GET /api/reviews
                                    // wird per Tag gecached (`revalidate=60`).
}
```

**QA-Edge-Case-Test (Pflicht):**

1. Seed: COMPLETED-Buchung B1 mit `Review.approved=true`.
2. PATCH `B1.status = 'CANCELLED'`.
3. GET `/api/reviews` → Review zu B1 erscheint **nicht**.
4. DB-Check: `review.approved=false`, `review.rejectedAt!=null`,
   `review.moderatedById=me.id`.

---

### 17.12 Aktualisierter Test-Plan (Pflicht-Smoke-Tests)

Die folgenden Tests werden aus §14.2 (Pressure-Test) in §14.1 (Pflicht-
Smoke-Test) **hochgestuft**, weil ihr Ausfall katastrophale
Konsequenzen hat:

| Test                                                                      | Bezug    |
| ------------------------------------------------------------------------- | -------- |
| Bootstrap-Race: leerer DB-Zustand + fremde Email → 403 `BOOTSTRAP_NOT_ALLOWED` | §17.1 / F1 |
| Letzter-Admin-Race: zwei parallele Disable-Requests → genau einer 200, einer 409 | §17.2 / F2 |
| DTO-Leak `adminNote`: Customer-Endpoint liefert kein Feld + `.strict()`-Parse | §17.3 / F3 |
| Public-Reviews-Strict: GET `/api/reviews` enthält nur Whitelist-Keys      | §17.5 / m1 |
| Analytics-Invalidation: PATCH `finalPriceEur` → unmittelbar in KPIs sichtbar | §17.9 / m5 |
| Review-Auto-Reject bei Booking-CANCELLED                                    | §17.11 / m7 |

---

### 17.13 Zusammenfassung der Contract-Eingriffe (durch Anhang B)

| Datei                        | Eingriff                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `contracts/zod-schemas.ts`   | (a) `CustomerUserPublicSchema`, `PublicReviewSchema`, `CustomerBookingSchema` werden auf `.strict()` umgestellt. (b) Neue Fehlercodes `BOOTSTRAP_NOT_ALLOWED` (403), `SETUP_NOT_CONFIGURED` (503) im Engineering-Hinweis-Block. |
| `contracts/api-routes.md`    | (a) §22 erhält Anhang-B-Verweis. (b) `POST /api/admin/setup` ergänzt um Allowlist-Gate. (c) `BOOTSTRAP_ADMIN_EMAIL` neu in §22.9 ENV-Tabelle. (d) `GET /api/reviews` Output-Schema explizit auf `PublicReviewSchema.strict()` gebunden. |
| `contracts/schema.prisma`    | **Keine** Schema-Änderungen nötig (alle F1–F3-Fixes leben im App-Layer). |
| `src/lib/dto/user.ts` (NEU)  | Helper `selectCustomerUserPublic()` / `selectCustomerUserAdmin()` (siehe §17.3.1). |
| `src/lib/admin-status.ts` (NEU) | Helper `disableAdminSafely()` (siehe §17.2.1). |
| `tests/architecture/*.test.ts` (NEU) | CI-Architektur-Tests (siehe §17.3.4 + §17.6). |

---

**Ende Anhang B (Revisions v1.6.1).**

---

**Ende ARCHITECTURE_IT6.md**
