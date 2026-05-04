# Architektur — Iteration 11

**Stand:** 2026-05-03
**Autor:** Solution Architect
**Modus:** Bug-Fix + UX-Konsolidierung (kein neues Feature)
**Stack-Anker:** Next.js 14 App Router · Prisma 5.22 · libSQL/Turso (Prod) / SQLite (Dev) · NextAuth 5 · Resend · Vercel Blob 2.3 · Zod 3.23 · `jose` (JWT, bereits transitive Dep über NextAuth)

Dieses Dokument ergänzt `ARCHITECTURE_IT10.md` für die sechs Stories US-IT11-01 bis US-IT11-06. Es folgt dem Format der Vor-Iterationen: pro Story Root-Cause, Datei-Inventar, konkreter Fix-Plan, Migrations-/ENV-Hinweise, Akzeptanztest.

Übergreifende Richtschnur: **fünf von sechs Stories sind Bug-Fixes oder UX-Konsolidierung**, US-IT11-06 (Storno) ist ein neues Feature. Datenmodell-Änderung: ein optionales `cancelledBy`-Feld an `Booking` (Audit-Spur) — alles andere bleibt aufwärtskompatibel. Konfiguration wird scharf gestellt, fragmentierte UX wird zusammengeführt, und vorhandene Code-Wege werden produktionsfest gemacht.

**Revision v2 (2026-05-03, nach Detail-Klärung mit Tom):**
- US-IT11-03: signierter JWT-Token (`BOOKING_TOKEN_SECRET`) macht die Bestätigungsseite reload-fest. 30 Tage gültig.
- US-IT11-04: Upload-Limits auf **10 MB Bilder / 50 MB Videos** konkretisiert (kein einheitliches 25 MB-Limit mehr).
- US-IT11-06: Auftrag-Storno-Feature (Kunde + Gast-via-Token) — neuer Abschnitt §6.

**Revision v3 (2026-05-04, nach QA-Review IT11):**
- US-IT11-03 — Bestätigungsseiten-Routing: kanonische neue Route `/buchung/bestaetigung/[bookingId]?token=…` (Path-Param-ID, nicht Query). Neue Komponente `BookingConfirmation` unter `src/app/buchung/bestaetigung/[bookingId]/page.tsx` (Server-Component). Bestehende `BestaetigtClient.tsx` unter `/buchung/bestaetigt` bleibt **unangetastet** für den Counter-Proposal-Use-Case (Tom→Kunde-Antwort-Flow). Klarere semantische Trennung: `/bestaetigt` = Counter-Proposal-Antwort, `/bestaetigung/[id]` = initiale Buchungs-Bestätigung.
- US-IT11-06 — Storno-Routing: kanonische Route `/buchung/[id]/stornieren?token=…` (Path-Param-ID, RESTful). Neue Server-Component unter `src/app/buchung/[id]/stornieren/page.tsx`.
- `cancel-preview`-Endpoint **gestrichen** — Wiederverwendung von `GET /api/bookings/[id]/public-summary?token=…`. Endpoint akzeptiert ab v3 Tokens mit Scope `booking-confirmation` ODER `booking-cancellation` (beide sind read-only-tauglich; Storno-Page nutzt den Cancellation-Token, Bestätigungs-Page den Confirmation-Token).
- `cancelledBy`-Enum **vereinheitlicht** auf `'CUSTOMER' | 'ADMIN' | 'SYSTEM'`. Gast-Storno via Token wird als `'CUSTOMER'` markiert (keine Differenzierung). Admin-UI zeigt nur „vom Kunde storniert". Tom-Entscheidung 2026-05-04. Ältere Spec-Stellen, die `'GUEST_TOKEN'` nennen, sind ungültig.
- Lightbox im Admin: **out of scope für IT11**, in IT12-Backlog. Klick auf Anhang-Thumbnail öffnet weiterhin in neuem Tab. Architecture bleibt korrekt — UX-Spec wird zurückgerudert.
- Datei-Upload — Edge-Cases vollständig spezifiziert: Min-Size 1 Byte (0-Byte → 400), Magic-Bytes-Check serverseitig (`file-type` Package, neue Dependency), Parallel-Upload-Limit max 3 gleichzeitig (synchron mit Component-Lib).
- TimeSlot-Race und Doppel-Submit-Schutz: explizite Concurrency-Strategien dokumentiert (siehe §6.5 + §3.7).
- Resend-Sandbox-Übergang: Sign-off-Checkliste §12 erweitert.
- Mail-Scanner-Race: expliziter Hinweis „POST nie via GET auslösen" in §6.3.
- `BookingDialogProvider`: `reset()`-Methode dokumentiert.
- Idempotenz Storno + Mail: Bei `result.count === 0` (idempotent) wird **keine** zweite Mail versendet, auch wenn der erste Versuch `mailError` hatte. `mailError`-Status bleibt für Admin-Sicht erhalten.

---

## 0. Kontextlage zu Beginn von IT11

| Layer        | Status                                                         |
|--------------|----------------------------------------------------------------|
| Code IT10    | Sign-off (alle 24 IT10-Tests + 181 Smoke-Tests grün)           |
| Migration `20260503163821_add_customer_address` | im Repo vorhanden, **noch nicht** in Prod-Turso ausgeführt |
| Vercel-ENV   | `MAIL_FROM=onboarding@resend.dev`, `NEXTAUTH_URL/NEXT_PUBLIC_BASE_URL=https://baerenstark-hausservice.app` (verifiziert in `.env.production`) |
| Resend-Domain| **nicht** verifiziert — Default `onboarding@resend.dev` liefert nur an verifizierte Test-Empfänger |
| Vercel Blob  | `@vercel/blob: 2.3.3` als Dependency vorhanden, `BLOB_READ_WRITE_TOKEN` **wahrscheinlich nicht** gesetzt |
| Quick-Booking-Modal | implementiert (`src/components/booking/QuickBookingModal.tsx`), aber nur als Folge-Schritt im `/buchung`-Flow erreichbar — **nicht** vom Header- oder Hero-CTA |
| Bestätigungsseite `/buchung/bestaetigt` | existiert, aber für Counter-Proposal-Antwort (Tom→Kunde-Flow) — **nicht** für die initiale Buchungs-Bestätigung |

Das ist der Ausgangspunkt. Wer in IT11 implementiert, beginnt nicht auf dem grünen Rasen.

---

## 1. Story US-IT11-01 — Buchung end-to-end zum Laufen bringen

### 1.1 Root-Cause-Analyse

Der Code-Pfad `POST /api/bookings` ist seit IT10 sauber (siehe `QA_IMPLEMENTATION_REVIEW_IT10.md` §US-IT10-03). Symptom „500 bei jedem Booking-POST in Prod" ist **nicht** ein Code-Defekt sondern ein **Konfigurations-Defekt** mit zwei unabhängigen Faktoren:

1. **Migrations-Drift gegen Prod-Turso.** Die Migration `20260503163821_add_customer_address` fügt `customer_users.streetAndNumber/postalCode/city` hinzu. `prisma/schema.prisma` Z. 119–124 selektiert diese Spalten in der Profil-Adress-Logik (`src/app/api/customer/me/route.ts` Z. 71–83). `src/app/api/bookings/route.ts` Z. 229–236 liest sie für die Pflicht-Adress-Logik (US-IT9-02). Wenn die Migration in Prod fehlt, wirft Prisma `P2022 Column 'customer_users.streetAndNumber' does not exist` und `internalError()` (`src/lib/api.ts` Z. 179–219) maskiert das in eine generische 500-Antwort.
2. **ENV-Variablen für Mail.** `MAIL_FROM` ist gesetzt, aber auf den Resend-Sandbox-Default `onboarding@resend.dev` — Mails an `hausservice-baerenstark@outlook.com` werden silent verworfen. `RESEND_API_KEY` und `MAIL_TO_ADMIN` müssen ebenfalls gesetzt sein (sind laut `.env.production` vorhanden — operative Kontrolle in Vercel).

Sekundärer Risiko-Faktor: das Booking-Schema referenziert `Booking.durationMinutes` (Default 60, IT5) und `Booking.addressStreet/addressZip/addressCity` (IT5). Diese Spalten sind **bereits** durch frühere Migrationen in Prod-Turso vorhanden — Migrations-Drift betrifft **ausschliesslich** die `customer_users`-Tabelle.

### 1.2 Betroffene Dateien (read-only — kein Code-Change nötig)

| Datei                                                          | Rolle                                              |
|----------------------------------------------------------------|----------------------------------------------------|
| `prisma/migrations/20260503163821_add_customer_address/migration.sql` | Migration die deployed werden muss          |
| `src/app/api/bookings/route.ts`                                | Liest Profil-Adress-Felder Z. 229–236             |
| `src/app/api/admin/users/route.ts`                             | Selektiert via `selectCustomerUserAdmin()`         |
| `src/app/api/customer/me/route.ts`                             | Liest und schreibt Adress-Felder                   |
| `src/lib/dto/user.ts`                                          | `selectCustomerUserPublic()`/`selectCustomerUserAdmin()` selektieren die drei Spalten |
| `src/lib/mail.ts`                                              | Liest `MAIL_FROM` (Z. 132)                         |

### 1.3 Fix-Plan (operativ + Code-Härtung)

**Operativ (Pflicht — Tom + Engineer in Vercel-Konsole):**

1. **DB-Migration deployen.**
   - In Vercel-Project-Settings → Environment Variables sicherstellen: `DATABASE_URL` zeigt auf die Prod-Turso-DB.
   - Lokal aus dem Repo-Root: `DATABASE_URL=$PROD_TURSO_URL npx prisma migrate deploy`.
   - Verifikation: `SELECT name FROM _prisma_migrations WHERE name='20260503163821_add_customer_address'` muss eine Zeile liefern.
2. **Resend-Domain-Verifizierung.**
   - Im Resend-Dashboard die Custom-Domain `baerenstark-hausservice.app` (oder Toms gewünschte Sender-Domain) verifizieren — DNS-Records SPF + DKIM, optional DMARC.
   - In Vercel Production-ENV: `MAIL_FROM=noreply@<verifizierte-domain>` setzen.
   - Solange die Verifikation läuft: `MAIL_FROM=onboarding@resend.dev` und im Resend-Dashboard die Test-Empfänger-Liste um `hausservice-baerenstark@outlook.com` und Toms Test-Adresse erweitern (Resend-Sandbox-Modus).
3. **ENV-Pflicht-Set kontrollieren.** In Vercel-Production gesetzt:
   - `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO_ADMIN`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`, `AUTH_SECRET`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` (siehe US-IT11-04).
4. **Smoke-Test gegen Prod.**
   - Gast-Flow: Buchungsformular auf `https://baerenstark-hausservice.app/buchung` öffnen, Buchung absenden → Erwartung: 201, Toast (siehe US-IT11-03), Eintrag in Admin-Liste, E-Mail an `MAIL_TO_ADMIN`.
   - Eingeloggter Flow: gleicher Test als Customer-User mit Profil-Adresse → Erwartung: Adressfelder vorausgefüllt (US-IT11-05), 201, Eintrag mit `customerId`.

**Code-Härtung (optional, kein Akzeptanzkriterium):**

- `src/lib/api.ts`: in `internalError()` einen `request_id` (UUID) generieren, in den Response-Body und in das Vercel-Log loggen — damit Tom bei zukünftigen 500ern den Vercel-Function-Log gezielt finden kann. **Backlog**, nicht IT11-Scope.

### 1.4 Migrations-Befehle

```bash
# Pre-Flight-Check
DATABASE_URL=$PROD_TURSO_URL npx prisma migrate status

# Deploy (idempotent)
DATABASE_URL=$PROD_TURSO_URL npx prisma migrate deploy

# Verifikation
DATABASE_URL=$PROD_TURSO_URL npx prisma migrate status
```

Erwartete Ausgabe: `Database schema is up to date!`. Kein App-Re-Deploy notwendig — der bestehende Code läuft mit den neuen Spalten direkt korrekt.

### 1.5 Akzeptanztest

- AC2: `curl -X POST https://baerenstark-hausservice.app/api/bookings -H 'Content-Type: application/json' -d '<gültiger Booking-Payload>'` → 201 mit `{ data: { id, status, createdAt } }`.
- AC3: Admin-E-Mail `hausservice-baerenstark@outlook.com` erhält Booking-Notification innerhalb von 60 s.
- AC4: `/admin/bookings` zeigt die neue Buchung mit Status „Offen" oben in der Liste.
- AC5: Smoke-Tests Gast + eingeloggter Kunde liefern beide grün.

---

## 2. Story US-IT11-02 — Buchungsweg konsolidieren

### 2.1 Root-Cause-Analyse

Der Buchungs-Einstiegspunkt ist heute **doppelt** vorhanden:

| Einstiegspunkt | Datei | Zielzustand IT11 |
|----------------|-------|------------------|
| Header „Termin buchen" → `/buchung` | `src/components/layout/Header.tsx` Z. 28–33 | umstellen auf Modal-Trigger |
| Hero „Jetzt Termin buchen" → `/buchung` | `src/components/home/Hero.tsx` Z. 27–32 | umstellen auf Modal-Trigger |
| `/buchung`-Seite mit eigenem Slot-Picker und Inline-Form | `src/app/buchung/page.tsx` + `BookingClient.tsx` | bleibt als Fallback (SEO + JS-Off + direkte URL) — keine Änderung am Inhalt |
| Inline-Slot-Picker auf der Startseite | **existiert nicht** (geprüft in `src/app/page.tsx`, `Hero.tsx`, `ServiceGrid.tsx`) | nichts zu entfernen |

Tom's Variante A: **Header + Hero CTAs öffnen das Quick-Booking-Modal direkt**. Die `/buchung`-Seite bleibt unverändert als Fallback für direkte URL-Aufrufe und SEO.

Knackpunkt: das Quick-Booking-Modal heute (`QuickBookingModal.tsx`) erwartet einen **bereits gewählten Slot** (`selectedTimeSlot`-Prop). Es ist als „Step 4" innerhalb des `/buchung`-Flows konzipiert. Für die Variante A muss das Modal so erweitert werden, dass es **eigenständig** funktioniert: es zeigt erst Kalender + Slot-Auswahl, dann das Formular.

### 2.2 Architektur-Entscheidung: Modal-Skelett

Wir bauen **keinen** zweiten Modal — wir hängen den existierenden Kalender + TimeSlotPicker als interne Steps in das Modal-Skelett. Der User-Journey im Modal:

```
Step A: Service-Auswahl (Pflicht)
Step B: Kalender (Tag wählen)
Step C: Dauer + TimeSlotPicker
Step D: Formular (Kontakt, Adresse, Beschreibung, Datenschutz)
Submit → Toast + Bestätigungsseite (US-IT11-03)
```

Mobile: vertikales Bottom-Sheet mit Scrollen durch alle Steps.
Desktop: zweispaltiges Modal (links Kalender/Slots, rechts Form), kein Mehrschritt-Wizard.

Wir **trennen** das aus dem heutigen `BookingClient.tsx`-Layout heraus und kapseln es in ein neues Wrapper-Komponente:

- **Neu:** `src/components/booking/BookingDialog.tsx` — Modal-Wrapper, der die Steps A–D hält und das Quick-Booking-Modal ersetzt im Globalkontext.
- **Bleibt:** `src/components/booking/QuickBookingModal.tsx` — wird intern vom `BookingDialog` als Step-D-Form verwendet ODER (bevorzugte Implementierung) der `BookingDialog` ist ein eigenständiges Modal das die Logik aus QuickBookingModal absorbiert.

**Architektonische Empfehlung:** den `QuickBookingModal` zu `BookingDialog` umbenennen/erweitern statt zwei parallele Modal-Komponenten zu pflegen. Begründung: weniger Cognitive Load, eine Single-Source-Of-Truth für die Buchungs-UX.

### 2.3 Globaler Modal-State

Damit Header und Hero **dasselbe** Modal öffnen, brauchen wir einen App-weiten Trigger. Optionen:

| Option | Pro | Contra |
|--------|-----|--------|
| Lift-State in einer neuen `<BookingDialogProvider>` im Root-Layout | sauber, typisiert, keine globalen Variablen | RootLayout ist server-component → Provider muss als Client-Component-Wrapper eingehängt werden |
| Custom-Event auf `window` (`window.dispatchEvent(new CustomEvent('open-booking'))`) | Null Coupling | nicht typisiert, Test-Hostility |
| Zustand-Store (zustand-Library) | reaktiv, einfach | neue Dependency |

**Entscheidung:** Provider-Pattern mit Context.

```
src/components/booking/BookingDialogProvider.tsx  (Client-Component, hält den State)
src/components/booking/use-booking-dialog.ts      (Hook: openBookingDialog(serviceSlug?))
src/app/layout.tsx                                (RootLayout rendert <BookingDialogProvider> um <main>)
```

Der `BookingDialogProvider` rendert das Dialog-Skelett intern, sodass Header/Hero/ServiceGrid einfach `useBookingDialog().open()` aufrufen können.

### 2.4 Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/booking/BookingDialogProvider.tsx` | **neu** — Client-Component-Provider, hält `isOpen`, `defaultService`, rendert das Dialog |
| `src/components/booking/use-booking-dialog.ts` | **neu** — Hook `useBookingDialog()` |
| `src/components/booking/QuickBookingModal.tsx` | **erweitern** — akzeptiert optionalen `mode: 'standalone' \| 'embedded'`-Prop (Default `embedded`); im `standalone`-Mode rendert es selbst Kalender+Slot-Picker als Step B/C |
| `src/components/booking/BookingCalendar.tsx` | **read-only** — bleibt; wird im Standalone-Mode des Modal verwendet |
| `src/components/booking/TimeSlotPicker.tsx` | **read-only** — bleibt |
| `src/components/booking/DurationPicker.tsx` | **read-only** — bleibt |
| `src/app/layout.tsx` | **edit** — `<BookingDialogProvider>` wraps `<main>` (oder gesamtes `<body>`-Children) |
| `src/components/layout/Header.tsx` | **edit** — `Link href="/buchung"` ersetzen durch `<button onClick={openBookingDialog}>` |
| `src/components/home/Hero.tsx` | **edit** — gleiche Ersetzung |
| `src/app/buchung/page.tsx` | **read-only** — bleibt als Fallback unverändert |
| `src/app/buchung/BookingClient.tsx` | **read-only** — bleibt als Fallback; Slot-Klick öffnet weiterhin das Modal (intern bestehende Logik) |
| Alle weiteren `/buchung`-Verlinkungen prüfen: `src/app/konto/anfragen/[id]/page.tsx` Z. 198, `src/app/buchung/storno/StornoClient.tsx` Z. 46/79 — **bleiben** auf `/buchung`, weil der Fallback-Pfad ja erhalten bleibt |

### 2.5 Verbliebene CTAs nach IT11

| Wo | CTA | Verhalten |
|----|-----|-----------|
| Header (alle Seiten) | „Termin buchen" | öffnet Modal (`onClick`) |
| Hero (Startseite) | „Jetzt Termin buchen" | öffnet Modal |
| Hero (Startseite, sekundär) | Telefonnummer | bleibt `tel:`-Link |
| `/buchung` (Fallback-Seite) | Inline-Form | unverändert |
| `/services/[slug]` Detail-Seite (falls existent — siehe Notes unten) | „Termin buchen" | öffnet Modal mit `defaultService=<slug>` |
| ServiceGrid auf der Startseite | **bleibt Modal-Trigger** für ServiceDetailModal (öffnet das Service-Detail, **nicht** das Booking-Modal) — kein CTA-Konflikt |
| Footer | Telefonnummer | bleibt `tel:`-Link |

**Notes für UX-Designer / Tom:**

- Soll der ServiceDetailModal (`src/components/home/ServiceDetailModal.tsx`) einen sekundären CTA „Diesen Service buchen" enthalten, der das Booking-Modal mit vorgewähltem Service öffnet? Das wäre konsistent mit dem heutigen `/buchung?service=<slug>`-Param. **Empfehlung: ja**, aber als Sub-Decision dem UX-Designer überlassen. Wenn umgesetzt: gleicher Hook `openBookingDialog(serviceSlug)`.

### 2.6 Rebook-Flow bleibt auf /buchung

Der Re-Booking-Flow (`/buchung?rebookToken=…`) ist konzeptionell ein anderer Pfad: Kunde klickt aus E-Mail auf einen Link, kommt auf eine Seite mit eigenem Banner und Slot-Auswahl. Diesen Pfad **nicht** ins Modal verschieben — der Banner-Kontext ist auf einer eigenen Seite klarer.

### 2.7 Akzeptanztest

- AC1: Klick auf Hero-CTA → Modal öffnet (kein Page-Navigate, URL bleibt `/`).

### 2.8 BookingDialogProvider — State-Reset (v3, BUG-MAJOR-09)

Der Provider exponiert eine `reset()`-Methode neben `open()` und `close()`:

```typescript
interface BookingDialogContextValue {
  isOpen: boolean;
  defaultService: Service | null;
  open: (options?: { service?: Service }) => void;
  close: () => void;
  reset: () => void; // v3 — setzt isOpen=false, defaultService=null, internen Form-Step-State zurück
}
```

**Aufruf-Punkte:**
- Nach erfolgreicher Booking-Submission im `QuickBookingModal`: vor dem `router.push('/buchung/bestaetigung/...')` wird `reset()` aufgerufen. Damit zeigt der Provider beim nächsten `open()` (z.B. „Eine weitere Anfrage stellen"-Button auf der Bestätigungsseite) ein frisches Modal ohne Reste der vorherigen Buchung.
- Auch nach Backdrop-Click oder Escape-Schließen ohne Submit: `close()` ruft intern `reset()` auf (sodass beim nächsten Open das Form leer ist — Tom-Entscheidung „frisches Modal", siehe BUG-MAJOR-07).

**Implementations-Hinweis:** der interne Form-State im `QuickBookingModal` ist via `useForm()` lokal; ein `key`-Prop am Modal-Wrapper, der bei `reset()` inkrementiert wird, erzwingt einen Remount → Form startet leer.
- AC2: Scroll durch die Startseite → exakt ein primärer Booking-CTA pro Viewport.
- AC3: Direkt-Aufruf `/buchung` → Inline-Form rendert komplett wie heute.
- AC4: Header-CTA von `/services/<slug>` → Modal öffnet mit Service vorgewählt (wenn der Service-Detail-CTA implementiert wird).
- AC5: Tom's Smoke-Test der Startseite zeigt prominenten primären CTA, kein anderes Booking-UI im Hero.

---

## 3. Story US-IT11-03 — Klare Rückmeldung nach Buchungsabsenden

### 3.1 Root-Cause-Analyse

Die Toast-Infrastruktur ist **bereits vollständig vorhanden** (siehe `src/lib/toast.ts`, `<Toaster />` global in `src/app/layout.tsx` Z. 61). Die Komponenten rufen den Toast bei Erfolg/Fehler:

- `QuickBookingModal.tsx` Z. 200: `toast.success('Anfrage gesendet. Wir melden uns innerhalb von 24 Stunden.')` — schon ok für AC2.
- `BookingForm.tsx` (Inline-Form auf `/buchung`): zeigt heute einen **In-Page-Banner** statt Toast. Das ist nach IT11-Spec inkonsistent → wir brauchen entweder eine **Bestätigungsseite** (AC1 verlangt explizit „Weiterleitung auf eine Bestätigungsseite mit Buchungsnummer") oder einen Toast plus Inline-Banner.

Lücken gegenüber IT11-AC:

1. Bestätigungsseite **/buchung/bestaetigt** existiert nur für den Counter-Proposal-Flow (`status=gone`/`accepted=true` aus dem `respond`-Redirect). Wir müssen sie um einen neuen Pfad erweitern: `/buchung/bestaetigt?bookingId=<id>&new=true` → zeigt Buchungsnummer + Service + Datum.
2. Tom's Telefonnummer (AC4) muss im Erfolgs-Toast enthalten sein.
3. Kunden-Übersicht `/konto` muss die neue Anfrage zeigen (AC5) — code-seitig korrekt seit IT10, hängt nur an US-IT11-01-Migration.

### 3.2 Bestätigungsseite — Erweiterung mit signiertem Token

**Neue kanonische Route (v3):** `/buchung/bestaetigung/[bookingId]?token=<jwt>`

**Neue Komponente:** `src/app/buchung/bestaetigung/[bookingId]/page.tsx` (Server-Component) + `src/app/buchung/bestaetigung/[bookingId]/BookingConfirmation.tsx` (Client-Component für CTAs).

**Bestand bleibt unangetastet:** `src/app/buchung/bestaetigt/BestaetigtClient.tsx` und `src/app/buchung/bestaetigt/page.tsx` werden in IT11 **nicht** geändert. Die Route `/buchung/bestaetigt` bleibt für den Counter-Proposal-Antwort-Flow (Tom→Kunde, `?accepted=true` / `?status=gone`) reserviert. Semantische Trennung:

| Route | Use-Case |
|-------|----------|
| `/buchung/bestaetigt` (Bestand) | Counter-Proposal-Antwort des Kunden (US-14) |
| `/buchung/bestaetigung/[bookingId]` (NEU IT11) | Initiale Buchungs-Bestätigung (US-IT11-03) |

Tom hat bestätigt: die Bestätigungsseite muss **reload-fest** sein. Ein Kunde, der die Bestätigungs-E-Mail noch eine Stunde später öffnet, soll die Buchungsbestätigung weiterhin sehen — ohne Login. Das löst sich nicht über URL-Params allein (weil ein Reload die URL behält, aber die Daten sollen zentral aus der DB kommen, nicht aus dem Client-State). Stattdessen: **signierter JWT-Token in der URL**.

**Architektur-Entscheidung — signierter Booking-Confirmation-Token (BCT):**

```
URL-Format:  /buchung/bestaetigung/<bookingId>?token=<jwt>
JWT-Header:  { alg: "HS256", typ: "JWT" }
JWT-Payload: {
  sub: <bookingId>,                  // = bookingId-Path-Param
  cid: <customerId> | null,          // null bei Gast-Buchungen
  scope: "booking-confirmation",     // verhindert Token-Verwechslung mit anderen Tokens
  iat: <unix-seconds>,
  exp: <unix-seconds + 30*24*3600>   // 30 Tage
}
JWT-Signing: HS256 mit `BOOKING_TOKEN_SECRET` (>= 32 Zeichen, separater Secret von AUTH_SECRET)
```

**Token-Lifecycle:**
1. **Issue:** `POST /api/bookings` generiert nach erfolgreicher DB-Persistierung den BCT (siehe §3.4 — neue Helper `signBookingConfirmationToken()`). Token wird (a) als Teil der Response zurückgegeben, sodass das Frontend die Redirect-URL bauen kann, und (b) in die Bestätigungs-E-Mail an den Kunden eingebettet (siehe US-IT11-06 wegen kombiniertem Storno-Link).
2. **Verify:** `GET /api/bookings/[id]/public-summary?token=<jwt>` (neuer Endpoint, siehe §3.5) verifiziert den Token, prüft `sub === id`, prüft `scope ∈ {"booking-confirmation", "booking-cancellation"}` (beide Scopes sind read-only-tauglich — siehe v3-Klarstellung unten), prüft `exp`, und liefert die Buchungs-Summary (id, service, date, startTime, status, createdAt). KEIN customer-personal-data-Leak: nur die Buchungs-Daten die der User selbst eingegeben hat, plus Status.
3. **Auth-Fallback:** Eingeloggte Kunden brauchen keinen Token — wenn der Cookie der Session zum `customerId` der Buchung passt, geht der Endpoint auch ohne Token-Param und liefert dieselben Daten.
4. **Expiry:** abgelaufener Token → 401 mit Body `{ error: { code: "TOKEN_EXPIRED", message: "Dieser Bestätigungslink ist abgelaufen. Bitte rufen Sie 0157-74787512 an." } }`. Frontend zeigt freundlichen Fallback (kein Crash).

**Scope-Polymorphismus für `public-summary` (v3):** Der Endpoint akzeptiert sowohl `booking-confirmation` als auch `booking-cancellation` Tokens. Begründung: Die Storno-Page muss vor dem Confirm-Klick die Buchungsdetails anzeigen (Service, Datum) — sie braucht read-only Zugriff. Statt einen separaten `cancel-preview`-Endpoint zu definieren, recyceln wir `public-summary` mit beiden Token-Scopes. Beide Scopes sind read-only äquivalent; nur der Cancel-Endpoint (`POST /api/bookings/[id]/cancel`) unterscheidet strikt zwischen Scopes.

**Warum nicht den existierenden `Booking.cancelToken` recyceln?** `cancelToken` wird in der `respond`-Pipeline (US-14) für admin-getriggerte Cancel-Links verwendet. Recycling würde Scope-Vermischung erzeugen. Trennung: ein Token pro Use-Case, ein Scope pro Token. Saubere Auditierbarkeit.

**Warum JWT statt HMAC-Hash gegen Booking-ID?** JWT erlaubt eingebauten Expiry-Check (`exp`) ohne extra DB-Spalte. Standard-Bibliothek `jose` ist über NextAuth-Dependency-Tree bereits vorhanden — keine neue Dep.

**Sicherheits-Constraints:**
- `BOOKING_TOKEN_SECRET` ist eine NEUE ENV-Variable. Niemals reusen mit `AUTH_SECRET` (separates Secret = separater Blast-Radius).
- Token wird per **HTTPS-only** transportiert. Niemand sollte den Link copy-pasten — falls doch, ist er 30 Tage gültig (akzeptables Risiko, da er nur Read-Access auf eine Buchung gibt, nicht Write).
- Logging: Token-Werte werden NIEMALS geloggt (weder in Vercel-Logs noch in DB). `internalError()` filtert.

### 3.3 Toast-Microcopy

**Erfolg (Toast, 6 s, mit Action):**

> „Anfrage erfolgreich gesendet. Tom meldet sich in Kürze bei Ihnen.
> Bei dringenden Anliegen: 0157 74787512"

Action-Button im Toast (optional aus `ToastEntry.action`-Feld der `toast.ts`-Lib): „Anrufen" → `tel:+4915774787512`.

**Fehler 4xx (Inline-Banner):** wie heute pro Feld via `setError`.
**Fehler 5xx / Network (Toast oder Banner):**

> „Ihre Anfrage konnte nicht gesendet werden. Bitte später erneut versuchen oder anrufen: 0157 74787512."

Niemals „Interner Serverfehler" — bestehende Microcopy-Regel aus IT10 / STRUCT-1.

### 3.4 Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/lib/booking-tokens.ts` | **neu** — Helper `signBookingConfirmationToken({ bookingId, customerId })` und `verifyBookingConfirmationToken(jwt)`. Wrapped `jose.SignJWT` und `jose.jwtVerify`. Ein Modul für alle Booking-Tokens (Confirmation + Cancellation, siehe §6). |
| `src/app/api/bookings/route.ts` | **edit (klein)** — nach `prisma.booking.create(...)`: Token signieren, in Response einfügen, in `sendBookingConfirmationToCustomer()` an Mailer übergeben. Doppel-Submit-Schutz integriert (siehe §3.7). |
| `src/app/api/bookings/[id]/public-summary/route.ts` | **neu** — `GET` liest Token aus Query, verifiziert (akzeptiert Scope `booking-confirmation` ODER `booking-cancellation`), lädt Buchung über `prisma`, liefert Summary-DTO. Auth-Fallback für eingeloggte Kunden. |
| `src/lib/mail.ts` | **edit** — `sendBookingConfirmationToCustomer()` erhält jetzt eine `confirmationUrl`-Variable mit eingebettetem Token (verlinkt auf `/buchung/bestaetigung/[id]?token=…`) und eine `cancellationUrl` (verlinkt auf `/buchung/[id]/stornieren?token=…`). |
| `src/components/booking/QuickBookingModal.tsx` | nach Erfolg: `router.push('/buchung/bestaetigung/<id>?token=<jwt>')` statt nur `onClose()` + Toast. Modal schließt sich vor dem Push. **Provider-Reset:** ruft `useBookingDialog().reset()` auf vor dem Push (siehe §2.8). |
| `src/components/booking/BookingForm.tsx` | gleicher Push nach Erfolg; aktueller Inline-Success-Banner entfernen (durch Bestätigungsseite ersetzt). |
| `src/app/buchung/bestaetigung/[bookingId]/page.tsx` | **neu** (v3) — Server-Component, liest Path-Param `bookingId` und Query `token`. Verifiziert Token serverseitig (`verifyBookingConfirmationToken`). Lädt Summary via interner Funktion oder `GET /api/bookings/[id]/public-summary`. Bei 401 → rendert `<TokenExpiredPage flow="confirmation" />`. Bei Erfolg → reicht Summary an `<BookingConfirmation />`. |
| `src/app/buchung/bestaetigung/[bookingId]/BookingConfirmation.tsx` | **neu** (v3) — Client-Component, rendert Heading, Buchungsnummer (gekürzt), Service-Label, Datum/Uhrzeit, Status-Badge, Telefonnummer-CTA, Links „Zur Startseite" und „Eine weitere Anfrage stellen" (öffnet Booking-Modal via `useBookingDialog`). |
| `src/app/buchung/bestaetigt/BestaetigtClient.tsx` | **read-only** (v3) — bleibt **unangetastet** für Counter-Proposal-Flow. KEIN Edit in IT11. |
| `src/app/buchung/bestaetigt/page.tsx` | **read-only** (v3) — bleibt unangetastet. |
| `src/lib/toast.ts` | keine Änderung. |
| `src/lib/contact.ts` | keine Änderung. |

### 3.5 Neuer API-Endpoint (Public-Summary)

```
GET /api/bookings/:id/public-summary
  Query:    ?token=<jwt>           (optional, wenn auth-cookie vorhanden)
  Auth:     Customer-Session-Cookie ODER signed Token (Scope: booking-confirmation ODER booking-cancellation)
  Success:  200 { data: { id, service, date, startTime, status, createdAt, customerName } }
  Errors:
    401 TOKEN_EXPIRED        → JWT exp < now
    401 TOKEN_INVALID        → JWT-Verify fehlgeschlagen, Scope nicht in {confirmation, cancellation}, sub != id
    401 UNAUTHORIZED         → kein Token UND kein passender Auth-Cookie
    404 NOT_FOUND            → Booking-ID existiert nicht
```

Antwort-DTO ist bewusst minimal — zeigt nur Daten die der Kunde selbst eingegeben hat. Keine `addressStreet/Zip/City`, keine `description`, keine `phone`, keine internen Felder (`finalPriceEur`, `adminNote`).

**Scope-Akzeptanz (v3):** Der Endpoint akzeptiert beide Scopes `booking-confirmation` und `booking-cancellation`. Damit kann die Storno-Page (`/buchung/[id]/stornieren`) ihre Preview-Daten direkt aus dem `public-summary`-Endpoint laden, ohne einen separaten `cancel-preview`-Endpoint zu benötigen. Schreibender Cancel bleibt strikt scope-getrennt (POST `/cancel` akzeptiert ausschließlich `booking-cancellation`).

### 3.6 Akzeptanztest

- AC1: Submit auf `/buchung` → Modal/Form schließt, grüner Toast, Push auf `/buchung/bestaetigung/<id>?token=<jwt>`, Buchungsnummer + Service + Datum sichtbar.
- AC2: Submit aus Modal → identisches Verhalten.
- AC3: 400/422-Antwort → Inline-Fehler am Pflicht-Feld; 5xx → Banner + Toast mit Telefonnummer.
- AC4: Toast enthält Tel.-Nummer als CTA.
- AC5: Eingeloggter Kunde → `/konto` zeigt die neue Anfrage (hängt an US-IT11-01-Migration; kein eigener Code-Change in IT11-03).

### 3.7 Doppel-Submit-Schutz für `POST /api/bookings` (v3 — BUG-MAJOR-03)

**Problem:** Bei Network-Retry oder Doppel-Klick könnten zwei DB-Zeilen + zwei Tom-Mails entstehen. Frontend hat zwar einen Submit-Disabled-State, aber bei Slow-Connection + ungeduldigem Klick + tab-wechsel kann der Race trotzdem auftreten.

**Architektur-Entscheidung — Optimistic Server-Side-Dedup:**

Vor dem `prisma.booking.create(...)`-Call prüft der Endpoint, ob in den letzten 60 Sekunden bereits eine identische Buchungsanfrage angekommen ist:

```typescript
// Match-Kriterien:
// - customerId (eingeloggt) ODER customerEmail (Gast)
// - slotId (gleicher TimeSlot)
// - createdAt > now() - 60s
const recentDuplicate = await prisma.booking.findFirst({
  where: {
    ...(customerId ? { customerId } : { customerEmail }),
    slotId,
    createdAt: { gt: new Date(Date.now() - 60_000) },
    status: { in: ['PENDING', 'CONFIRMED'] }, // bereits stornierte ignorieren
  },
  orderBy: { createdAt: 'desc' },
});

if (recentDuplicate) {
  // Idempotente Antwort: gleiche Booking-ID + gleicher Token, KEINE neue Mail.
  const confirmationToken = await signBookingConfirmationToken({
    bookingId: recentDuplicate.id,
    customerId: recentDuplicate.customerId,
  });
  return apiSuccess({
    id: recentDuplicate.id,
    status: recentDuplicate.status,
    createdAt: recentDuplicate.createdAt,
    confirmationToken,
    cancellationToken: await signBookingCancellationToken({ bookingId: recentDuplicate.id, customerId: recentDuplicate.customerId }),
    deduplicated: true, // Hinweis für Frontend (Tests)
  });
}
```

**Properties:**
- 60-Sekunden-Fenster ist großzügig genug für Network-Retries und Doppel-Tabs, eng genug für legitimate „User sendet zweite Anfrage zum gleichen Slot" (extrem selten — Slot ist nach erstem Submit ohnehin belegt; dies ist nur defensiv).
- Match auf `customerEmail` für Gäste statt `phone` (Email ist stabiler, Phone-Format-Drift möglich).
- Tokens werden für die existierende Booking re-signiert — der Frontend-Redirect funktioniert genauso wie beim erfolgreichen Erstcall.
- Antwort-Body enthält `deduplicated: true` (optional) zur Test-Verifikation; Frontend ignoriert dieses Feld im Happy-Path.

**Test-Case (zu ergänzen in `tests/it11-backend.test.ts`):**

```typescript
test('POST /api/bookings — Doppel-Submit innerhalb 60s ist idempotent', async () => {
  const payload = { /* gültige Booking-Daten */ };
  const r1 = await POST('/api/bookings', payload);
  const r2 = await POST('/api/bookings', payload);
  expect(r1.data.id).toBe(r2.data.id);
  expect(r2.data.deduplicated).toBe(true);
  // Mail-Counter: nur 1 Mail an Tom
});
```

---

## 4. Story US-IT11-04 — Datei-Upload im Admin anzeigen

### 4.1 Root-Cause-Analyse

Vorhanden:
- `BookingAttachment`-Model in Prisma (`prisma/schema.prisma` Z. 292–304) mit `url`, `filename`, `contentType`, `sizeBytes`, `bookingId?`.
- API `POST /api/upload` (`src/app/api/upload/route.ts`) — schreibt nach Vercel Blob, legt `BookingAttachment` mit `bookingId=null` an, gibt `attachmentId+url` zurück.
- `FileUpload.tsx` (`src/components/booking/FileUpload.tsx`) — vollständige Upload-UI mit Drag-and-Drop, Pro-Datei-Status, BLOB-not-configured-Banner.
- Verknüpfung in `POST /api/bookings` (`route.ts` Z. 498–508) — nimmt `attachmentIds[]` entgegen und setzt `bookingId` auf den neuen Booking.
- Admin-Anzeige in `BookingTable.tsx` (Z. 354–387) — rendert pro Buchung eine Liste von Anhang-Links mit Icon (🖼️/📄/🎬/📎), Filename, Download-Link.

**Was fehlt für IT11-04:**

1. **`BLOB_READ_WRITE_TOKEN` in Vercel-Production setzen.** Ohne den Token antwortet der Upload-Endpoint mit `503 BLOB_NOT_CONFIGURED` — `FileUpload.tsx` Z. 260–272 blendet die Sektion dann aus und sagt „Du kannst die Anfrage trotzdem ohne Anhang absenden". Tom sieht keine Anhänge, weil keine entstehen.
2. **`FileUpload` ist nicht im Quick-Booking-Modal eingebunden.** `QuickBookingModal.tsx` enthält **keine** `<FileUpload />`-Komponente — nur die Inline-`BookingForm` auf `/buchung` hat sie. Wenn Tom's Quick-Booking-Modal der primäre Pfad wird (US-IT11-02), kann der Kunde aus dem Modal heraus **keine** Anhänge schicken. Defekt.
3. **Admin-Anzeige der Anhänge ist heute kompakt** — nur Filename + Icon + Open-Link. Die IT11-AC verlangt:
   - Vorschaubild bei Bildern (Thumbnail).
   - Dateigröße (heute nicht angezeigt).
   - Hinweis „Keine Dateien hochgeladen" wenn leer (heute kein Hinweis — die Sektion fehlt einfach).
   - Inline-Vorschau für Videos optional, Download-Link Pflicht.

### 4.2 Storage-Lösung

**Entscheidung: Vercel Blob (Marketplace).** Gründe:
- Bereits als Dependency installiert (`@vercel/blob: 2.3.3`).
- Server-Code (`src/app/api/upload/route.ts`) ist bereits vollständig integriert.
- Keine zusätzliche Infra (kein S3-Account, kein eigener Filesystem-Mount).
- Cold-Start-Friendly auf Vercel.

Alternativen (verworfen):
- **Lokales Filesystem `/tmp`** — auf Vercel non-persistent zwischen Function-Invocations. Würde zu „Anhang erstellt, aber URL bricht beim nächsten Aufruf" führen. **No-go.**
- **S3-kompatibel (Cloudflare R2 / AWS S3)** — funktioniert, aber neue Infra, neue Credentials, neuer Code-Pfad. Unnötiger Aufwand wenn Vercel Blob da ist.

**Pflicht-Setup (operativ):**
- Vercel-Dashboard → Storage → Blob → Create Store. Verbindet automatisch mit dem Projekt und setzt `BLOB_READ_WRITE_TOKEN` in Vercel-ENV.
- Verifikation lokal (`vercel env pull .env.production.local`) → `BLOB_READ_WRITE_TOKEN=vercel_blob_rw_…` im Pull.

### 4.3 DB-Schema — keine Änderungen

`BookingAttachment` ist vollständig:

| Feld | Typ | Hinweis |
|------|-----|---------|
| `id` | String CUID | Primärschlüssel |
| `bookingId` | String? | NULL bis das Booking submittet wird |
| `url` | String | Vercel-Blob-URL (öffentlich) |
| `filename` | String | Original-Filename, beim Display unverändert |
| `contentType` | String | MIME-Type (z.B. `image/jpeg`) |
| `sizeBytes` | Int | Validiert in der Upload-Route |
| `createdAt` | DateTime | Default `now()` |

Limitierungen aus `src/lib/schemas.ts` (heute):
- `UPLOAD_MAX_FILE_BYTES = 20 MB` (einheitlich, nicht differenziert).
- `UPLOAD_ACCEPTED_CONTENT_TYPES`: Whitelist (JPG, PNG, PDF, MP4 — siehe `FileUpload.tsx` Z. 78–80).
- `UPLOAD_MAX_FILES_PER_BOOKING = 5`.

**Architektur-Entscheidung (Tom-Bestätigung 2026-05-03):** **Split-by-MIME — 10 MB für Bilder, 50 MB für Videos.** Begründung: Bilder von Smartphone-Kameras liegen typischerweise unter 5 MB, 10 MB ist generös. Videos brauchen mehr Spielraum, weil Tom kurze Schadens-Clips bekommen soll. Vercel Blob unterstützt bis 5 GB — kein Storage-seitiges Limit.

**Konkrete Limit-Konstanten (neu in `src/lib/schemas.ts`):**

```typescript
/** 10 MB für Bilder (image/*). AC US-IT11-04. */
export const UPLOAD_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** 50 MB für Videos (video/*). AC US-IT11-04. */
export const UPLOAD_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
/** 10 MB für PDFs (application/pdf) — analog zu Bildern. */
export const UPLOAD_MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Hilfsfunktion: liefert das Limit für einen MIME-Type oder null bei nicht-akzeptiertem Type. */
export function getUploadLimitForType(contentType: string): number | null {
  if (contentType.startsWith('image/')) return UPLOAD_MAX_IMAGE_BYTES;
  if (contentType.startsWith('video/')) return UPLOAD_MAX_VIDEO_BYTES;
  if (contentType === 'application/pdf') return UPLOAD_MAX_DOCUMENT_BYTES;
  return null;  // nicht akzeptiert
}
```

`UPLOAD_MAX_FILE_BYTES = 20 MB` wird **deprecated** (markiert mit JSDoc-`@deprecated`-Tag, bleibt für Bestand-Code-Pfade noch eine Iteration referenzierbar, dann in IT12 entfernen).

**Validation-Pflicht:**

| Layer | Verantwortung |
|-------|---------------|
| **Client (FileUpload.tsx)** | Bei `change`-Event: `getUploadLimitForType(file.type)` prüfen. Bei Überschreitung: rote Inline-Meldung pro File-Entry („Datei zu groß. Maximum für Bilder: 10 MB. Ihre Datei: 12 MB."). KEIN Upload-Request abschicken. **Min-Size-Check:** `file.size === 0` → Inline-Fehler „Diese Datei ist leer." Parallel-Upload-Limit: max **3 gleichzeitige** Uploads (siehe §4.3.1). |
| **Server (POST /api/upload)** | Body-Stream prüfen: bei Überschreitung HTTP **413 Payload Too Large** mit Body `{ error: { code: "FILE_TOO_LARGE", message: "Datei überschreitet das Maximum (Bilder: 10 MB, Videos: 50 MB).", limit: <bytes>, actual: <bytes> } }`. **0-Byte-Check:** `sizeBytes === 0` → 400 mit `{ error: { code: "FILE_EMPTY", message: "Die hochgeladene Datei ist leer." } }`. **Magic-Bytes-Check:** Server liest die ersten ~4100 Bytes des Streams und prüft via `file-type` Package, ob der detektierte MIME-Type zum vom Client deklarierten `contentType` passt. Bei Mismatch → 400 `{ error: { code: "FILE_TYPE_MISMATCH", message: "Datei-Inhalt passt nicht zum angegebenen Typ." } }`. Schutz vor MIME-Spoofing (z.B. `.exe` umbenannt nach `.jpg`). |
| **Storage (Vercel Blob)** | `put()` wird gar nicht erst aufgerufen — Validierung blockt vorher. |

**Microcopy-Konsistenz:** alle clientseitigen Hinweise referenzieren explizit die zwei Limits. Beispiel-Hint-Text unter dem File-Input: „Bilder bis 10 MB · Videos bis 50 MB · max. 5 Dateien · max. 3 gleichzeitige Uploads".

#### 4.3.1 Edge-Cases (v3, BUG-MAJOR-05)

| Edge-Case | Client-Verhalten | Server-Verhalten |
|-----------|------------------|------------------|
| 0-Byte-Datei | Inline-Fehler vor Upload-Request | 400 `FILE_EMPTY` (defense-in-depth) |
| MIME-Spoofing (`.exe` → `.jpg`) | Whitelist-Check via `file.type` (Browser-MIME) | 400 `FILE_TYPE_MISMATCH` nach Magic-Bytes-Check |
| Korruptes Video (kein gültiger MP4-Header) | nicht detektierbar clientseitig | 400 `FILE_TYPE_MISMATCH` (Magic-Bytes-Check schlägt fehl) |
| 4. Datei während 3 Uploads laufen | Datei wird in Queue gestellt; UI zeigt „Wartet…", startet sobald ein Slot frei | n/a |
| Total > 5 Dateien pro Booking | Inline-Fehler „Maximal 5 Dateien" | n/a (Frontend blockt) |

**Neue Server-Dependency:** `file-type` (npm package, ~50 KB, MIT-License). Wird in `package.json` ergänzt — Boot-Check in `POST /api/upload`-Route stellt sicher, dass das Package installiert ist; falls nicht, wird der Magic-Bytes-Check übersprungen mit Vercel-Log-Warnung „file-type missing — MIME-spoofing-Schutz disabled". (Defensive Implementation, kein hard-fail.)

**Parallel-Upload-Limit (Client):** `FileUpload.tsx` hält einen Semaphore mit `max=3` aktiven Promises. 4. und folgende Dateien werden in einer FIFO-Queue gepuffert; UI-Status pro Entry: `pending → uploading → done/error`. Synchron mit Component-Library-Spezifikation des UX-Designers (Bestand).

### 4.4 API-Vertrag — keine Änderungen

`POST /api/upload` und `POST /api/bookings` mit `attachmentIds[]` sind bereits korrekt verdrahtet. Keine neuen Endpoints.

Optional, **nicht IT11-Scope**: ein `DELETE /api/upload/:attachmentId` für „User entfernt Datei vor dem Submit". Heute räumt der Cleanup nichts auf — orphan attachments mit `bookingId=null` bleiben in der DB. Bei kleinem Volumen kein Problem; Backlog für IT12.

### 4.5 Frontend — Pflicht-Änderungen

| Datei | Änderung |
|-------|----------|
| `src/components/booking/QuickBookingModal.tsx` | **edit** — `<FileUpload onAttachmentsChange={…} />` zwischen „Beschreibung" (Step D) und „Datenschutz" einfügen. State `attachmentIds` zur Komponente hinzufügen, beim Submit in den Payload mergen. |
| `src/components/admin/BookingTable.tsx` | **edit** — Anhang-Anzeige um Thumbnail (Image-Tag bei `image/*`-MIME), Dateigröße (Bytes-Format aus `format.ts`), und „Keine Dateien hochgeladen"-Hinweis erweitern. |
| `src/components/booking/FileUpload.tsx` | **read-only** — vorhandene Komponente bleibt, wird nur an einer zweiten Stelle (Modal) verwendet. |

### 4.6 ENV-Variable

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_<token>   # in Vercel Production via Storage-Marketplace gesetzt
```

### 4.7 Test-Hinweise

- Smoke: JPG 2 MB hochladen, Buchung absenden. Admin-Liste → Buchungs-Karte → Sektion „Anhänge" → Thumbnail visible, Klick → Vercel-Blob-URL öffnet Bild in neuem Tab.
- Smoke: MP4 30 MB hochladen → bei 20 MB-Limit erwarteter Fehler (siehe Open Question oben).
- Smoke: Buchung ohne Anhang → Admin-Liste zeigt „Keine Dateien hochgeladen".

---

## 5. Story US-IT11-05 — Profildaten-Vorausfüllung produktionsfähig machen

### 5.1 Root-Cause-Analyse

Die Pre-Fill-Logik ist code-seitig korrekt seit IT10:

- `BookingClient.tsx` Z. 75–88 nutzt `useCustomer()` (Client-Hook), liest `customer.streetAndNumber/postalCode/city` defensiv (Index-Cast) und gibt sie als Prop an `BookingForm` und `QuickBookingModal`.
- `BookingForm.tsx` Z. 129–150 setzt RHF-`defaultValues` aus den Props.
- `QuickBookingModal.tsx` Z. 109–122 mappt die gleichen Defaults.
- `useCustomer()` (`src/lib/use-customer.ts`) ruft `GET /api/customer/me` und behandelt Fehler still (setzt `unauthenticated`).

**Warum funktioniert es in Prod nicht?**

Drei Hypothesen, in Prio-Reihenfolge:

1. **Migrations-Drift (gleicher Root-Cause wie US-IT11-01).** `GET /api/customer/me` selektiert via `selectCustomerUserPublic()` die Felder `streetAndNumber/postalCode/city`. Wenn die Spalten in Prod-Turso fehlen, wirft Prisma `P2022` und `internalError()` antwortet 500. Der Client-Hook `useCustomer()` fängt das (Z. 38–44) und setzt still `unauthenticated` — der eingeloggte Kunde wird im Frontend wie ein Gast behandelt, das Form bleibt leer. **Sehr wahrscheinlich der Hauptdefekt.** Sobald die Migration deployed ist (IT11-01), funktioniert es.
2. **`NEXTAUTH_URL` zeigt nicht auf Prod-Domain.** `.env.production` zeigt `NEXTAUTH_URL=https://baerenstark-hausservice.app` — passt. Wenn aber in Vercel-ENV-Settings ein anderer Wert (oder gar leer) gesetzt ist, prüft NextAuth die Session-Cookie-Domain falsch und `getCustomerFromRequest()` (`src/lib/customer-auth-server.ts`) liefert `null`.
3. **Customer-Session-Cookie wird nicht gesendet.** `useCustomer()` macht `fetch('/api/customer/me')` mit `credentials: 'include'` (siehe `api-client.ts` `getCustomerMe()`). Sollte same-origin korrekt funktionieren. Riskanter Pfad nur in dev über Cross-Origin-Tools.

### 5.2 Architektur-Entscheidung — Variante A vs. B

In IT10 hatte die Architektur SSR (Variante A: Server-Component holt das Profil und reicht es als Prop weiter) als „empfohlen" gelistet, der Engineer hat aber Variante B (Client-Hook `useCustomer()`) gewählt. QA-Verdikt: „vertretbar, kein Defekt".

**IT11-Entscheidung: Variante B (Client-Hook) bleibt** — kein Refactor in IT11. Begründung:

- Der eigentliche Defekt ist nicht die Variante, sondern die fehlende Migration.
- Variante A verbessert UX (kein Flash), kostet aber Refactor-Zeit ohne AC-relevante Verbesserung.
- Backlog-Eintrag für IT12: SSR-Pre-Fill auf der `/buchung`-Seite implementieren um den Kurz-Flash zu eliminieren.

### 5.3 Hardening — defensive Lese-Helper bleibt

`BookingClient.tsx` Z. 80–88 nutzt einen `Record<string, unknown>`-Cast um die drei Adress-Felder defensiv zu lesen — falls die DB-Migration fehlt, fällt das Frontend nicht crash sondern gibt einfach `null` zurück. Dieser Defensiv-Code ist **wichtig** und bleibt unverändert. Er sorgt dafür, dass die Adressfelder leer sind, statt das ganze Form zu crashen.

Nach US-IT11-01 (Migration deployed) wird der Cast zwar überflüssig, sollte aber bleiben — als Schutz gegen zukünftige Migrations-Drift.

### 5.4 Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/lib/use-customer.ts` | **read-only** — keine Änderung |
| `src/app/buchung/BookingClient.tsx` | **read-only** — keine Änderung |
| `src/components/booking/BookingForm.tsx` | **read-only** — keine Änderung |
| `src/components/booking/QuickBookingModal.tsx` | **edit** (nur im Rahmen US-IT11-02) — wenn das Modal als Standalone-Modal aus dem Header-CTA geöffnet wird, muss es genauso `useCustomer()` selbst aufrufen (oder den `BookingDialogProvider` ruft es einmal und reicht durch). Empfehlung: der Provider hält `useCustomer()`, alle Sub-Komponenten lesen aus dem Provider-Context. |
| `src/components/booking/BookingDialogProvider.tsx` | **neu** (in US-IT11-02 ohnehin) — ruft `useCustomer()` einmal, reicht den Customer-Context an alle Booking-Sub-Komponenten weiter. |
| `src/lib/dto/user.ts` | **read-only** — `selectCustomerUserPublic()` selektiert die drei Adress-Felder bereits korrekt. |
| `src/app/api/customer/me/route.ts` | **read-only** — nutzt `selectCustomerUserPublic()` automatisch. |

### 5.5 ENV-Variable

```
NEXTAUTH_URL=https://baerenstark-hausservice.app
NEXT_PUBLIC_BASE_URL=https://baerenstark-hausservice.app
```

Beide aus `.env.production` ablesbar — operative Verifikation in Vercel-ENV-Settings notwendig (US-IT11-01).

### 5.6 Akzeptanztest

- AC1: Eingeloggt + Profil-Adresse vorhanden → Formular zeigt Name/Email/Phone/Adresse vorausgefüllt (sowohl im Inline-Form wie im Modal).
- AC2: `curl -H 'Cookie: customer-session=…' https://baerenstark-hausservice.app/api/customer/me` → 200 + JSON-Body mit Profil-Feldern (kein 401, kein 500).
- AC3: Eingeloggt ohne Adresse → Name/Email/Phone vorausgefüllt, Adresse leer, Banner mit Link auf `/konto`.
- AC4: Vorausgefülltes Feld editieren und Submit → Buchung speichert den geänderten Wert, Profil-Adresse bleibt unverändert.
- AC5: Nicht eingeloggt → Form lädt mit allen Feldern leer, kein Crash.

---

## 6. Story US-IT11-06 — Auftrag stornieren (Kunde + Gast)

### 6.1 Bestand & Root-Cause-Analyse

**Wichtige Erkenntnis:** ein Customer-Cancel-Endpoint existiert **bereits** seit Iteration 4 (US-27):

- `POST /api/customer/bookings/[id]/cancel` (`src/app/api/customer/bookings/[id]/cancel/route.ts`).
- Validation: `isCancellable()` aus `src/lib/cancellation.ts` (Status-Whitelist + 24h-Frist).
- Status-Wechsel auf `CANCELLED`.
- Mail an Tom über `sendCancellationToAdmin()` (fire-and-forget).
- Slot-Re-Freigabe implizit: `available-slots`-Cache-Tag wird re-validated; Slot-Verfügbarkeit wird in Iteration 3+ aus `bookings WHERE status NOT IN ('CANCELLED', 'REJECTED')` errechnet — kein explizites `slotId = null`-Reset nötig.

**Gap-Analyse für US-IT11-06:**

| Anforderung | Bestand IT10 | IT11-Lücke |
|-------------|--------------|-----------|
| Kunden-Cancel-Endpoint | vorhanden | **nichts zu tun** |
| 24h-Frist-Logik | vorhanden | **bleibt** — Tom hat das in IT4 explizit gewünscht |
| Idempotenz (zweiter Aufruf = 200 + `alreadyCancelled: true`) | **fehlt** — heute wird `CANCELLED` als nicht-stornierbar gewertet → 409 | **NEU: idempotenter Pfad** |
| Slot-Re-Freigabe | implizit (cache-revalidate) | bleibt; ergänzen um expliziten Kommentar |
| Mail an Tom | vorhanden | bleibt |
| Audit-Felder (`cancelledAt`, `cancelledBy`, `cancellationReason`) | **fehlen** — nur `updatedAt` | **NEU: Migration** |
| **Gast-Cancel via Token** | **fehlt komplett** | **NEU: Endpoint + Token-Verify** |
| Stornieren-Button im Dashboard `/konto` | vorhanden (über `isCancellable`-Flag in `GET /api/customer/bookings`) | bleibt; UI-Polish (Toast nach Erfolg) im FE-Doc |
| Confirmation-Dialog vor Submit | UI-seitig vorhanden | bleibt |
| Storno-Link in Bestätigungs-E-Mail | **fehlt** | **NEU: Mailer-Erweiterung** |

### 6.2 Datenmodell-Änderungen — neue Migration

**Migration:** `prisma/migrations/<YYYYMMDD>_add_booking_cancellation_audit/migration.sql`

```sql
-- Booking — Audit-Felder für Stornierung (US-IT11-06)
ALTER TABLE "bookings" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "bookings" ADD COLUMN "cancelledBy" TEXT;        -- 'CUSTOMER' | 'ADMIN' | 'SYSTEM' (App-Layer-Validation via Zod)
ALTER TABLE "bookings" ADD COLUMN "cancellationReason" TEXT; -- optional, max 500 chars (App-Layer)
```

**Prisma-Schema-Änderung** (`prisma/schema.prisma` — `Booking`-Model):

```prisma
model Booking {
  // ... bestehende Felder ...

  // IT11 / US-IT11-06 — Audit-Trail für Stornierungen.
  /// Zeitpunkt der Stornierung (UTC). NULL solange nicht storniert.
  cancelledAt        DateTime?
  /// Initiator: 'CUSTOMER' (eingeloggt oder via Gast-Token), 'ADMIN' (Tom), 'SYSTEM' (zukünftig: Auto-Cleanup).
  /// App-Layer-Validation via Zod `CancelledBySchema = z.enum(['CUSTOMER', 'ADMIN', 'SYSTEM'])`.
  cancelledBy        String?
  /// Optionaler Freitext (max 500 chars, App-Layer). Customer kann optional „Warum?" eingeben — heute UI-leer-Default.
  cancellationReason String?

  // ... rest ...
}
```

**Warum kein neues Enum-Feld in SQLite?** SQLite hat keine ENUMs; wir folgen dem etablierten Muster (`status: String`) und validieren im App-Layer.

**Kein neues `BookingStatus`-Enum-Wert nötig:** `CANCELLED` ist seit IT4 erlaubt (siehe Schema-Z. 187 Comment). Kein Schema-Diff dort.

**Backwards Compatibility:** alle drei Felder sind nullable → Bestand-Buchungen bleiben unangetastet. Migration ist ein additiver `ADD COLUMN`-Diff, läuft auf libSQL/Turso ohne Lock.

### 6.3 Token-System — kombinierter Bestätigungs-/Storno-Token

**Architektur-Entscheidung — gemeinsamer Token, getrennte Scopes:**

Wir verwenden den in §3.2 definierten `signBookingConfirmationToken()` + einen zusätzlichen `signBookingCancellationToken()` mit **eigenem Scope**, beide aus dem zentralen Modul `src/lib/booking-tokens.ts`.

```typescript
// Bestätigungs-Token (US-IT11-03):
{ sub: bookingId, cid: customerId|null, scope: "booking-confirmation", exp: now + 30d }

// Storno-Token (US-IT11-06):
{ sub: bookingId, cid: customerId|null, scope: "booking-cancellation", exp: now + 30d }
```

**Warum zwei Tokens statt einem?** Unterschiedliche Use-Cases brauchen unterschiedliche Risiko-Scopes. Wenn ein Confirmation-Link in falsche Hände gerät (z.B. der Kunde leitet die Mail weiter), ist nur Read-Access auf die Bestätigung möglich — kein Cancel. Saubere Trennung. Kosten: zwei Signing-Calls beim E-Mail-Versand (nano-overhead).

**E-Mail-Layout:** in `sendBookingConfirmationToCustomer()` werden **beide** Links eingebettet:

```
Ihre Anfrage ist bei uns eingegangen.

→ Buchung anzeigen:        https://…/buchung/bestaetigung/<id>?token=<confirmationJWT>
→ Anfrage stornieren:      https://…/buchung/<id>/stornieren?token=<cancellationJWT>

Bei Fragen: 0157 74787512
```

**Pfad-Wahl (v3):** `/buchung/[id]/stornieren?token=…` (Path-Param-ID, RESTful, kanonisch). NICHT `/buchung/storno` — letzteres ist die Erfolgsseite des `respond`-Flows (Tom→Kunde-Cancel via cancelToken). Trennung verhindert URL-Kollision. Wir benennen die existierende Page zwar nicht um (wäre Breaking Change für ältere `respond`-Mails), aber neue Page ist klar separiert.

**Mail-Scanner-Race-Schutz (v3, BUG-MAJOR-08):**
> **WICHTIG:** `POST /api/bookings/[id]/cancel` darf NIE per GET-Request ausgelöst werden. Die Storno-Page (`/buchung/[id]/stornieren`) rendert ausschließlich einen Confirm-Dialog mit „Ja, stornieren"-Button. Submit ist explizit ein POST nach User-Klick. Damit kann ein Mail-Provider-Scanner (Outlook, Gmail), der Links in E-Mails preview-fetched, den Cancel-Token NICHT versehentlich konsumieren — der GET auf `/buchung/[id]/stornieren` ist read-only und rendert nur die UI. Erst der explizite Form-Submit löst den Cancel aus.

Engineer-Implementation-Note: keine `<form method="GET">` und kein `<a href="…/cancel">` im Cancel-Flow. Der Submit-Button ist `<button type="submit">` innerhalb eines `<form method="POST">` (oder JavaScript-`fetch('POST', …)` aus dem Client).

**Token-Lifecycle Storno:**
1. **Issue:** in `POST /api/bookings` direkt nach DB-Persist erzeugt.
2. **Verify:** in `POST /api/bookings/:id/cancel` (neuer Endpoint, siehe §6.4) wenn `?token=<jwt>` Query-Param gesetzt ist.
3. **Single-Use semantisch, nicht technisch:** der Token bleibt 30 Tage gültig, aber nach dem ersten Cancel ist der Booking-Status bereits `CANCELLED` → Idempotenz-Pfad greift (siehe §6.4).
4. **Expiry:** abgelaufen → 401 mit `{ error: { code: "TOKEN_EXPIRED", message: "Bitte rufen Sie 0157-74787512 an" } }`.

### 6.4 API-Endpoint — neuer Public Cancel-Pfad

**Architektur-Entscheidung — Endpoint-Topologie:**

| Endpoint | Auth | Use Case |
|----------|------|----------|
| `POST /api/customer/bookings/[id]/cancel` | Customer-Session-Cookie (Pflicht) | **Bestand** — eingeloggter Kunde im Dashboard |
| `POST /api/bookings/[id]/cancel` | Signed Token in `?token=` Query-Param **ODER** Customer-Session-Cookie | **NEU** — Gast-Storno via E-Mail-Link, **auch** als unifizierter Endpoint für eingeloggte Kunden |

Der neue Endpoint ist die **kanonische Storno-Route**. Der Bestand-Endpoint unter `/api/customer/bookings/...` wird zum dünnen Wrapper, der intern auf den neuen Endpoint delegiert (oder bleibt parallel mit identischer Implementation — Engineer-Entscheidung). Vorteile der Topologie:

1. **Ein Code-Pfad** für Storno-Logik (Status-Update, Mail, Cache-Revalidate, Audit-Felder, Idempotenz).
2. **Auth-Polymorphismus:** Token oder Cookie — der erste der greift, gewinnt. Kein Endpoint-Duplikat.
3. Frontend kann beide Pfade gleichbehandeln (`POST` mit oder ohne Token-Query).

**Vertrag (`POST /api/bookings/[id]/cancel`):**

```
POST /api/bookings/:id/cancel?token=<jwt>?
Body: { reason?: string }   (optional, max 500 chars)

Auth-Logik (in Reihenfolge):
  1. Wenn `?token=<jwt>` vorhanden:
       - jwtVerify(token, BOOKING_TOKEN_SECRET)
       - sub === id?  scope === "booking-cancellation"? exp > now?
       - Wenn alle OK → Authority erteilt; cancelledBy = 'CUSTOMER'.
       - Wenn Token expired → 401 { error: { code: "TOKEN_EXPIRED", message: "Bitte rufen Sie 0157-74787512 an" } }.
       - Wenn Token sonst invalid → 401 { error: { code: "TOKEN_INVALID", message: "Ungültiger Storno-Link." } }.
  2. Wenn kein Token, aber Customer-Session-Cookie:
       - getCustomerFromRequest(req)
       - booking.customerId === me.id? → ja: Authority erteilt; cancelledBy = 'CUSTOMER'.
       - nein: 404 NOT_FOUND (Ownership-Hide, kein 403).
  3. Wenn weder noch → 401 UNAUTHORIZED.

Status-Wechsel:
  - booking.status === 'CANCELLED' → idempotent:
      200 { data: { id, status: 'CANCELLED', cancelledAt, alreadyCancelled: true } }
      KEINE neue Mail, KEIN Cache-Revalidate.
  - booking.status NOT IN ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'] → 409 CONFLICT
      (REJECTED → 409, COMPLETED → 409). Kein Status-Change.
  - 24h-Frist-Check via `isCancellable()` (CONFIRMED braucht > 24h Vorlauf, sonst 409
    mit Hinweis „Bitte rufen Sie 0157-74787512 an"). Token-basierter Aufruf
    UNTERLIEGT der gleichen Frist — Schutz vor Last-Minute-Cancel-Missbrauch.
  - Sonst: prisma.booking.update({
      status: 'CANCELLED',
      cancelledAt: now(),
      cancelledBy: 'CUSTOMER',
      cancellationReason: body.reason ?? null,
      mailSent: false,
      mailError: null,
    })

Side Effects (nur im NICHT-idempotenten Pfad):
  - sendCancellationToAdmin(...) (fire-and-forget; Tom-Mail).
  - revalidateTag('slots'); revalidateTag('available-slots').

Response (Erfolg, neuer Cancel):
  200 { data: { id, status: 'CANCELLED', cancelledAt: ISO-8601, alreadyCancelled: false } }

Response (Erfolg, idempotent):
  200 { data: { id, status: 'CANCELLED', cancelledAt: ISO-8601 (vom ersten Aufruf), alreadyCancelled: true } }

Errors:
  401 TOKEN_EXPIRED        → Gast-Token abgelaufen.
  401 TOKEN_INVALID        → Gast-Token ungültig (Sig-Fail, falsche Scope, sub != id).
  401 UNAUTHORIZED         → kein Token UND keine Session.
  404 NOT_FOUND            → Booking-ID existiert nicht ODER (eingeloggt) gehört nicht dem User.
  409 CONFLICT             → Status nicht stornierbar (REJECTED/COMPLETED) ODER Frist abgelaufen.
```

**Idempotenz-Implementierung — atomarer Conditional-Update (v3):**

```typescript
// Verhindert Race-Condition zwischen Doppel-Klick (Customer-Mail-Reload + Tab-Reload),
// UND zwischen Cancel + parallelem Booking-POST auf denselben Slot (Optimistic Concurrency).
const result = await prisma.booking.updateMany({
  where: {
    id: bookingId,
    status: { in: ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'] },
  },
  data: {
    status: 'CANCELLED',
    cancelledAt: new Date(),
    cancelledBy: 'CUSTOMER', // v3: einheitlich CUSTOMER, auch bei Gast-Token (keine Differenzierung)
    cancellationReason: reason ?? null,
    mailSent: false,
    mailError: null,
  },
});

if (result.count === 0) {
  // Entweder schon CANCELLED (Idempotenz) oder anderer Endstatus (CONFLICT):
  const current = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (current?.status === 'CANCELLED') {
    // Idempotenz: keine zweite Mail, keine Cache-Revalidation, kein mailError-Reset.
    // Auch wenn der erste Versuch mailError != null hatte — bleibt erhalten für Admin-Sicht.
    return apiSuccess({
      id,
      status: 'CANCELLED',
      cancelledAt: current.cancelledAt,
      alreadyCancelled: true,
    });
  }
  return apiError({ code: 'CONFLICT', message: 'Diese Buchung kann nicht mehr storniert werden.' });
}

// Erfolg → Mail + Cache-Revalidate.
```

**`cancelledBy` v3 — keine Differenzierung:** Tom hat 2026-05-04 entschieden, dass Backend nur `'CUSTOMER' | 'ADMIN' | 'SYSTEM'` speichert. Gast-Storno via Token wird als `'CUSTOMER'` gespeichert (nicht als `'GUEST_TOKEN'`). Im Admin-UI wird in beiden Fällen „vom Kunde storniert" angezeigt. Das simplifiziert die UI-Microcopy und verhindert Drift zwischen verschiedenen Spec-Quellen.

Damit hat der Doppel-Klick-Edge-Case keine doppelte Tom-Mail, keinen doppelten Slot-Reset.

**TimeSlot-Race bei parallel Cancel + Book (v3, BUG-MAJOR-02):**

Szenario: Customer A ist auf Buchung X (Slot S) eingebucht und klickt „Stornieren" zum gleichen Zeitpunkt, an dem Customer B auf `/buchung` Slot S wählt und absendet.

Strategie — **Optimistic Concurrency, kein Lock**:

| Operation | Atomare DB-Query |
|-----------|------------------|
| Cancel (`POST /api/bookings/[id]/cancel`) | `prisma.booking.updateMany({ where: { id, status: { in: [PENDING, CONFIRMED, COUNTER_PROPOSED] } }, data: { status: CANCELLED, … } })` — siehe oben |
| Book (`POST /api/bookings`) | Slot-Verfügbarkeits-Check als Teil der Booking-Create-Transaction: `WHERE slotId = S AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED')` muss 0 Zeilen liefern (Bestand-Logik). |

**Race-Resolution:**
- Cancel-Query läuft zuerst durch → Booking X ist CANCELLED, Slot S frei → Booking-POST von B trifft 0 Zeilen → 201 Created ✓
- Book-Query läuft zuerst durch → Slot S noch belegt durch X → Book-POST von B → 409 CONFLICT (Bestand-Verhalten). Cancel-Query läuft danach durch → Booking X ist CANCELLED, Slot wird frei → B kann erneut versuchen. **Verlierer ist B**, kriegt klare 409-Antwort, kein Datenverlust.

Beide Pfade sind SQLite-atomar (single-statement `UPDATE … WHERE` bzw. `INSERT … WHERE NOT EXISTS`), kein expliziter Transaction-Wrap nötig. Race ist deterministisch lösbar.

**Test-Case (zu ergänzen in `tests/it11-backend.test.ts`):**

```typescript
test('Race: Cancel + Book auf demselben Slot — genau ein Erfolg', async () => {
  // Setup: Booking X mit Slot S, status=CONFIRMED, > 24h Vorlauf.
  const [cancelResult, bookResult] = await Promise.allSettled([
    POST(`/api/bookings/${X.id}/cancel?token=${cancellationToken}`),
    POST('/api/bookings', { ...payload, slotId: S }),
  ]);
  // Genau einer von beiden ist 200/201, der andere 409 — oder beide haben Erfolg
  // (Cancel war zuerst, Slot frei). Niemals beide CONFLICT.
  expect(
    (cancelResult.status === 'fulfilled' && cancelResult.value.status === 200) ||
    (bookResult.status === 'fulfilled' && bookResult.value.status === 201)
  ).toBe(true);
});
```

### 6.5 Slot-Re-Freigabe

Slot-Verfügbarkeit wird seit IT3 dynamisch berechnet aus:

- `AvailabilityTemplate` (Wochentag-Defaults) und `DayOverride` (Tages-Override) — definieren das Verfügbarkeits-Fenster.
- `Booking WHERE status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED')` — definieren die belegten Zeitfenster.

Das heisst: sobald `Booking.status = 'CANCELLED'` gesetzt ist, wird der Slot **automatisch** wieder als verfügbar berechnet — kein expliziter `slotId = null`-Reset nötig. Das User-Story-Wording „TimeSlot wird wieder als verfügbar markiert (Status `AVAILABLE`)" ist konzeptionell korrekt, aber implementierungstechnisch leer (es gibt keinen physischen `TimeSlot.status`-State, nur die berechnete Sicht).

**Pflicht:** `revalidateTag('available-slots')` direkt nach dem `updateMany` aufrufen. Ohne das werden Browser-Caches stale gehen.

**Edge-Case:** wenn `Booking.slotId` (Bestand-IT2) ODER `Booking.counterProposalSlotId` gesetzt ist — beide bleiben unverändert. Sie referenzieren historisch den ursprünglichen Slot-Datensatz; das löscht die Buchungs-Spur nicht (für Tom-Audit). Der Slot ist trotzdem frei, weil der Status `CANCELLED` ihn aus dem Verfügbarkeits-Filter rauswirft.

### 6.6 Mail an Tom

Bestand `sendCancellationToAdmin()` (`src/lib/mail.ts`) wird **wiederverwendet**. Erweiterung: ein zusätzlicher Body-Parameter `cancelledBy: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'`, sodass der Betreff die Quelle anzeigt:

```
Subject: [Bärenstark] Storno durch Kunden — <Service> am <Datum>
Body:
  Storniert durch:    Kunde (Login-Mail oder Gast-Token)
  Buchungs-ID:        #<id-short>
  Kunde:              <name>
  Telefon:            <phone>
  Service:            <service-label>
  Datum/Zeit:         <date> <startTime>–<endTime>
  Grund (optional):   <cancellationReason>
```

Bei Idempotenz (zweiter Cancel-Call): **keine Mail**.

### 6.7 Frontend — Pflicht-Komponenten

| Datei | Aktion |
|-------|--------|
| `src/app/konto/page.tsx` (oder zugehöriger Client) | bestehende Stornieren-Button-Logik nutzt `b.isCancellable` aus `GET /api/customer/bookings`. **Edit:** nach Erfolg `toast.success('Auftrag storniert.')` + Status-Badge sofort auf „Storniert" aktualisieren (Optimistic Update + Re-Fetch der Liste). |
| `src/components/booking/CancelConfirmationDialog.tsx` | **neu** (oder existierend?) — Modal mit „Möchten Sie diese Anfrage wirklich stornieren?" + „Ja, stornieren" / „Abbrechen". Optionaler Reason-Textarea. |
| `src/app/buchung/[id]/stornieren/page.tsx` | **neu** (v3) — Server-Component, liest Path-Param `id` und Query `token`, verifiziert serverseitig (`verifyBookingCancellationToken()`), lädt Buchungsdetails (z.B. via interner DB-Query oder `GET /api/bookings/[id]/public-summary?token=…` — Cancel-Token wird vom public-summary-Endpoint v3 akzeptiert), rendert `<GuestCancelClient />`. Bei Token-Expired → rendert `<TokenExpiredPage flow="cancellation" />` direkt server-side. **WICHTIG:** rendert nur UI, KEINEN auto-submit; Mail-Scanner-Race-Schutz (siehe §6.3). |
| `src/app/buchung/[id]/stornieren/GuestCancelClient.tsx` | **neu** (v3) — Client-Component, zeigt `<CancelConfirmationDialog />`, ruft `POST /api/bookings/[id]/cancel?token=…` (explizit POST nach User-Klick, nie GET), behandelt 401/409. |
| `src/lib/api-client.ts` | **edit** — neue Funktion `cancelBookingAsGuest(id, token, reason?)` für den `POST`-Call mit Token-Param. |
| `src/lib/mail.ts` | **edit** — `sendBookingConfirmationToCustomer()` rendert beide Links (Confirmation + Cancellation-Storno). |

### 6.8 ENV-Variable (neu)

```
BOOKING_TOKEN_SECRET=<openssl rand -base64 48>   # Pflicht. Niemals reusen mit AUTH_SECRET.
```

In Vercel-ENV (Production + Preview) setzen, in `.env.production` als Pflicht-Eintrag dokumentieren.

### 6.9 Akzeptanztests US-IT11-06

| AC | Test |
|----|------|
| AC1 — Button sichtbar bei OFFEN/BESTAETIGT | `GET /api/customer/bookings` liefert `isCancellable: true` für PENDING/CONFIRMED/COUNTER_PROPOSED, `false` für REJECTED/CANCELLED/COMPLETED. UI prüft das Flag. |
| AC2 — Confirmation-Dialog vor Submit | Klick auf „Stornieren" öffnet Modal; ohne „Ja"-Bestätigung kein API-Call. |
| AC3 — Status-Wechsel sofort sichtbar | Nach 200-Response: Optimistic UI-Update + Re-Fetch. Toast „Auftrag storniert". |
| AC4 — E-Mail an Tom | `sendCancellationToAdmin()` wird gefeuert; bei Mail-Fail → `mailError`-Spalte gesetzt, Tom kann nachrecherchieren. |
| AC5 — TimeSlot wieder verfügbar | `revalidateTag('available-slots')`; nächster `GET /api/admin/slots` zeigt den Slot frei. |
| AC6 — Gast-Storno via Token | `POST /api/bookings/<id>/cancel?token=<jwt>` mit gültigem Token → 200 + `cancelledBy: 'CUSTOMER'`. |
| AC7 — Abgelaufener Token | Mit `exp: now - 1` → 401 `TOKEN_EXPIRED` + Frontend rendert Hinweisseite mit Tel-Nummer. |
| AC8 — Idempotenz | Zweiter Aufruf direkt nach dem ersten → 200 + `alreadyCancelled: true`, keine zweite Tom-Mail. |

**Zusätzlich (Architect-Eigentest):**
- 24h-Frist-Verletzung via Token → 409, kein Status-Change. (Schützt vor Last-Minute-Cancel über alten Mail-Link.)
- Customer A versucht Buchung von Customer B zu stornieren ohne Token → 404 (Ownership-Hide).
- Token mit falschem Scope (`booking-confirmation` statt `booking-cancellation`) → 401 `TOKEN_INVALID`.

### 6.10 OpenAPI-Stub

Optional: `contracts/bookings-cancel.openapi.yaml` mit dem Vertrag aus §6.4. Nicht-blockierend — der Engineer kann den Vertrag direkt aus diesem Doc bauen.

---

## 7. Datenmodell-Änderungen

**Eine Migration:** `<YYYYMMDD>_add_booking_cancellation_audit` — drei nullable Spalten an `Booking` (`cancelledAt`, `cancelledBy`, `cancellationReason`). Siehe §6.2.

**Pflicht-Aktion zusätzlich:** die Bestand-Migration `20260503163821_add_customer_address` in Prod ausrollen (siehe §1.4).

**Migrations-Reihenfolge in Prod (atomar einzeln deployen):**
1. `20260503163821_add_customer_address`
2. `<YYYYMMDD>_add_booking_cancellation_audit` (neu in IT11)

---

## 8. API-Vertrag-Änderungen

**Neue Endpoints:**

- `GET /api/bookings/:id/public-summary?token=<jwt>` — siehe §3.5.
- `POST /api/bookings/:id/cancel?token=<jwt>?` — siehe §6.4.

**Bestand bleibt unverändert:**

- `POST /api/bookings` mit `attachmentIds[]` — vorhanden.
- `POST /api/upload` Multipart → `{ attachmentId, url, filename, contentType, sizeBytes }` — vorhanden.
- `GET /api/customer/me` → `CustomerUserPublic` mit `streetAndNumber/postalCode/city` — vorhanden.
- `GET /api/customer/bookings` → `{ upcoming[], past[] }` — vorhanden.

**Optional (Backlog):** `DELETE /api/upload/:id` für orphan-cleanup, `GET /api/admin/diagnose/health` für Tom's Smoke-Tests. **Nicht IT11.**

---

## 9. ENV-Variablen — Pflicht-Set für IT11

| Variable                  | Beispiel                                            | Quelle                  |
|---------------------------|-----------------------------------------------------|-------------------------|
| `DATABASE_URL`            | `libsql://baerenstark-prod-…?authToken=…`           | Turso-Dashboard         |
| `AUTH_SECRET`             | `<32+ Zeichen Random>`                              | `openssl rand -base64 32` |
| `NEXTAUTH_URL`            | `https://baerenstark-hausservice.app`               | Prod-Domain             |
| `NEXT_PUBLIC_BASE_URL`    | `https://baerenstark-hausservice.app`               | Prod-Domain             |
| `RESEND_API_KEY`          | `re_…`                                              | Resend-Dashboard        |
| `MAIL_FROM`               | `noreply@<verifizierte-domain>` (oder `onboarding@resend.dev` mit verifiziertem Empfänger als Übergang) | Resend-Domain-Verify |
| `MAIL_TO_ADMIN`           | `hausservice-baerenstark@outlook.com`               | Tom                     |
| `BLOB_READ_WRITE_TOKEN`   | `vercel_blob_rw_…`                                  | Vercel Blob Marketplace |
| `BOOKING_TOKEN_SECRET`    | `<48 Byte Base64 Random>`                           | `openssl rand -base64 48` (NEU IT11 / US-IT11-03 + 06) |
| `GOOGLE_CLIENT_ID`        | `…apps.googleusercontent.com`                       | Google Cloud Console    |
| `GOOGLE_CLIENT_SECRET`    | `GOCSPX-…`                                          | Google Cloud Console    |

OAuth-Variablen sind optional (US-31 / IT5) — fehlen sie, blendet `next.config.js` Z. 35–39 die OAuth-Buttons aus.

`BOOKING_TOKEN_SECRET` ist Pflicht ab IT11 — fehlt er, schlägt der `signBookingConfirmationToken()`-Aufruf in `POST /api/bookings` fehl, und das Booking wird mit 500 abgelehnt. Engineer setzt eine **expliziten Boot-Check** in `src/lib/booking-tokens.ts`: bei Modul-Load wird die ENV-Var einmal gelesen; fehlt sie in Prod, wird hard-fail mit klarer Fehlermeldung im Vercel-Log.

---

## 10. Test-Strategie

### 10.1 Bestehende Suiten (Pflicht-Pass)

| Suite                  | Befehl              | Erwartung                  |
|------------------------|---------------------|----------------------------|
| Lint                   | `npm run lint`      | 0 Warnungen / 0 Fehler     |
| Typecheck              | `npm run typecheck` | `tsc --noEmit` ohne Fehler |
| Smoke-Bestand          | `npm test`          | 181 / 181 Tests             |
| IT10-spezifisch        | `npm run test:it10` | 24 / 24 Tests               |

### 10.2 Neue IT11-Tests (zu ergänzen unter `tests/it11-backend.test.ts`)

Pro Story:

| Test | Coverage |
|------|----------|
| Migration-Smoke: Profil-Adress-Felder lesbar | US-IT11-01 |
| Migration-Smoke: `cancelledAt`/`cancelledBy`/`cancellationReason` lesbar | US-IT11-06 |
| Token-Sign + Verify Roundtrip (`booking-confirmation` + `booking-cancellation` Scopes) | US-IT11-03 + 06 |
| Token-Verify lehnt abgelaufenen Token ab → `TOKEN_EXPIRED` | US-IT11-03 + 06 |
| Token-Verify lehnt falschen Scope ab → `TOKEN_INVALID` | US-IT11-06 |
| `GET /api/bookings/:id/public-summary` mit gültigem Token → 200 | US-IT11-03 |
| `GET /api/bookings/:id/public-summary` mit Auth-Cookie + ohne Token → 200 | US-IT11-03 |
| `POST /api/bookings/:id/cancel?token=…` Erfolgsfall → 200 + Status CANCELLED + Mail | US-IT11-06 |
| `POST /api/bookings/:id/cancel?token=…` Idempotenz: zweiter Aufruf → 200 + `alreadyCancelled: true`, KEINE zweite Mail | US-IT11-06 |
| `POST /api/bookings/:id/cancel?token=…` mit REJECTED-Status → 409 | US-IT11-06 |
| `POST /api/bookings/:id/cancel?token=…` mit < 24h Vorlauf → 409 | US-IT11-06 |
| Upload-Validation: 12 MB JPG → 413 FILE_TOO_LARGE | US-IT11-04 |
| Upload-Validation: 60 MB MP4 → 413 FILE_TOO_LARGE | US-IT11-04 |
| Upload-Validation: 8 MB JPG → 200 + Attachment-ID | US-IT11-04 |
| Upload-Validation: 30 MB MP4 → 200 + Attachment-ID | US-IT11-04 |
| **Upload-Validation: 0-Byte-Datei → 400 FILE_EMPTY** (v3) | US-IT11-04 |
| **Upload-Validation: MIME-Spoof (.exe als image/jpeg) → 400 FILE_TYPE_MISMATCH** (v3) | US-IT11-04 |
| **Upload-Validation: korruptes MP4 (kein gültiger Header) → 400 FILE_TYPE_MISMATCH** (v3) | US-IT11-04 |
| **Doppel-Submit `POST /api/bookings` innerhalb 60s → idempotent (gleiche ID, 1 Mail)** (v3) | US-IT11-03 |
| **Race: Cancel + Book auf demselben Slot — genau ein Erfolg, kein Doppel-Conflict** (v3) | US-IT11-06 |
| **`public-summary` akzeptiert Scope `booking-cancellation` → 200** (v3) | US-IT11-06 |
| **`public-summary` akzeptiert Scope `booking-confirmation` → 200** (v3) | US-IT11-03 |
| **`public-summary` mit unbekanntem Scope → 401 TOKEN_INVALID** (v3) | US-IT11-03 + 06 |
| **Idempotenz Storno: zweiter Aufruf nach Mail-Fail → keine zweite Mail, mailError bleibt** (v3) | US-IT11-06 |
| Toast erscheint nach Booking-Submit | US-IT11-03 (Frontend-Test, Playwright optional) |
| FileUpload im Modal sendet Anhänge | US-IT11-04 |
| Admin-Anzeige zeigt Thumbnail bei Bild | US-IT11-04 |
| Pre-Fill-Felder korrekt nach Login | US-IT11-05 |

### 10.3 Live-Smoke-Tests in Prod (Pflicht vor Sign-off)

1. Gast-Buchung: Header-CTA → Modal → Service + Slot + Form + 1 JPG (8 MB) hochladen → Submit → Toast → Bestätigungsseite mit Booking-ID + Token in URL (`/buchung/bestaetigung/<id>?token=…`).
1.5. **Resend-Sandbox-Test (v3, BUG-MAJOR-04):** Booking-Smoke mit einer **nicht-Test-Empfänger-Adresse** (z.B. einer Freebie-Mail-Adresse, die nicht in der Resend-Test-Empfänger-Liste steht). Wenn die Domain `baerenstark-hausservice.app` verifiziert ist → Mail kommt an. Wenn die Domain noch nicht verifiziert ist → erwartete Beobachtung: Resend-Dashboard zeigt „blocked: recipient not in test list". Damit bestätigt sich der Sandbox-Übergang vor dem Go-Live.
2. Bestätigungsseite Reload-Test: F5 auf `/buchung/bestaetigung/<id>?token=…` → Buchung weiterhin sichtbar (kein 401).
3. Eingeloggt-Buchung: Login → Header-CTA → Modal → Pre-Fill verifizieren → Submit → `/konto` zeigt die Anfrage.
4. Admin-Login → `/admin/bookings` → neue Buchung sichtbar mit Anhang-Thumbnail.
5. Reset-Mail: `/konto/passwort-vergessen` mit registrierter Adresse → Mail kommt in 2 min an.
6. **Storno-Smoke (eingeloggt):** Customer öffnet `/konto`, klickt „Stornieren", bestätigt im Dialog → Toast „Auftrag storniert", Status-Badge wechselt auf „Storniert", Tom-Mail kommt in 2 min an, Slot wieder als verfügbar in `/admin/slots` sichtbar.
7. **Storno-Smoke (Gast via Token):** Gast-Buchung absenden → Bestätigungs-Mail öffnen → „Anfrage stornieren"-Link (`/buchung/<id>/stornieren?token=…`) klicken → Confirmation-Page öffnet (rendert nur UI, kein Auto-Submit) → „Ja, stornieren" → 200 + Erfolgsmeldung. Zweiter Klick auf den gleichen Link → 200 + Hinweis „Bereits storniert".
8. **Storno-Smoke abgelaufener Token:** Test-Token mit `exp: now - 1` generieren → Link öffnen → freundliche Fehlerseite mit Tel-Nummer 0157-74787512.
9. **Upload-Limit:** 12 MB JPG hochladen → Inline-Fehler im UI, kein Upload-Request. 60 MB MP4 hochladen → gleicher Block. 30 MB MP4 → erfolgreicher Upload.

---

## 11. Offene Fragen

- **(US-IT11-02, Q2):** Soll der ServiceDetailModal (Hover-Card mit Service-Beschreibung auf der Startseite) einen sekundären „Diesen Service buchen"-CTA bekommen, der das Booking-Modal mit `defaultService=<slug>` öffnet? Heute existiert nur der Hauptkurs-CTA. Empfehlung: ja, konsistent mit dem heutigen `/buchung?service=<slug>`-Pfad. **Antwort von UX-Designer** vor dem Engineering.
- **(US-IT11-03, Q3):** Wenn der Kunde im Modal abgeschickt hat und auf die Bestätigungsseite weitergeleitet wird — soll die Bestätigungsseite einen „Eine weitere Anfrage stellen"-Button enthalten (zurück auf Modal/`/buchung`)? Empfehlung: ja, plus „Zur Startseite". **UX-Designer entscheidet Microcopy**.
- **(US-IT11-04, Q4):** Soll im Admin neben dem Thumbnail auch eine Lightbox-Vorschau (Bild im Modal grosser anzeigen) implementiert werden? Heute öffnet der Klick die Blob-URL in neuem Tab. Empfehlung: nein, neuer-Tab reicht für MVP. **Backlog für IT12.**
- **(US-IT11-06, Q5):** Soll der Customer beim Stornieren einen optionalen „Grund"-Textarea bekommen (mappt auf `cancellationReason`)? Empfehlung: ja, optional, max. 500 Zeichen, Placeholder „Grund (optional, hilft uns, den Service zu verbessern)". **Antwort von UX-Designer**.
- **(US-IT11-06, Q6):** Soll der Storno-Link in der Bestätigungs-E-Mail auch in der Tom-Notification erscheinen, sodass Tom mit einem Klick im Namen des Kunden stornieren könnte? Empfehlung: **nein** — Tom hat seinen eigenen Cancel-Pfad via Admin-PATCH, separate Wege bleiben sauber getrennt. **Bestätigung von Tom** (Default: nein).
- **(US-IT11-01, Q7):** Soll der `internalError()`-Wrapper in `src/lib/api.ts` einen `request_id`-Header für Vercel-Log-Korrelation ergänzen? Empfehlung: ja, **Backlog**, nicht IT11.

---

## 12. Sign-off-Checkliste

- [ ] Migration `20260503163821_add_customer_address` in Prod-Turso ausgeführt
- [ ] Migration `<YYYYMMDD>_add_booking_cancellation_audit` erstellt + in Prod ausgeführt
- [ ] Vercel-ENV: `MAIL_FROM` zeigt auf verifizierte Domain — **ODER** Resend-Domain `baerenstark-hausservice.app` ist verifiziert — **ODER** Test-Empfänger-Liste enthält Tom (`hausservice-baerenstark@outlook.com`) UND eine Customer-Test-Adresse (v3, BUG-MAJOR-04)
- [ ] Vercel-ENV: `BLOB_READ_WRITE_TOKEN` gesetzt (über Vercel Blob Marketplace)
- [ ] Vercel-ENV: `BOOKING_TOKEN_SECRET` gesetzt (NEU IT11)
- [ ] `BookingDialogProvider` integriert in `app/layout.tsx`, mit `reset()`-Methode (v3)
- [ ] Header- und Hero-CTAs öffnen das Modal (kein `/buchung`-Navigate mehr)
- [ ] `FileUpload` in `QuickBookingModal` eingebunden, Limits 10 MB Bild / 50 MB Video, Min-Size 1 Byte, Magic-Bytes-Check via `file-type`, Parallel-Limit 3 (v3)
- [ ] **Dependency `file-type` in `package.json` ergänzt** (v3)
- [ ] Admin-Anzeige um Thumbnail + Dateigröße + Empty-State erweitert (Lightbox out-of-scope, IT12-Backlog)
- [ ] Toast erscheint bei Erfolg + Tel.-Nummer; Bestätigungsseite zeigt Booking-ID + ist reload-fest mit Token
- [ ] **Bestätigungsseite unter neuer Route `/buchung/bestaetigung/[bookingId]?token=…` (v3); `/buchung/bestaetigt` bleibt unangetastet für Counter-Proposal-Flow**
- [ ] **Storno-Page unter neuer Route `/buchung/[id]/stornieren?token=…` (v3, Path-Param)**
- [ ] `src/lib/booking-tokens.ts` mit `signBookingConfirmationToken()` + `signBookingCancellationToken()` + Verify-Pendants
- [ ] `GET /api/bookings/:id/public-summary` implementiert — akzeptiert Scope `booking-confirmation` ODER `booking-cancellation` (v3)
- [ ] `POST /api/bookings/:id/cancel` implementiert (Token + Cookie-Auth, idempotent, `cancelledBy` einheitlich `'CUSTOMER'` für Gast-Token)
- [ ] **Doppel-Submit-Schutz für `POST /api/bookings` aktiv (60s-Window-Dedup, v3)**
- [ ] **Storno-Page rendert nur UI, kein Auto-Submit (Mail-Scanner-Race-Schutz, v3)**
- [ ] Bestätigungs-Mail rendert Confirmation- + Cancellation-Links auf neue Routen (v3)
- [ ] Lint + Typecheck + Smoke-Suite + IT10-Suite + IT11-Suite alle grün
- [ ] Live-Smoke-Tests 1–9 in Prod erfolgreich (inkl. 1.5 Resend-Sandbox-Test mit nicht-Test-Empfänger)
- [ ] QA-Review IT11 zeichnet GO-LIVE

---

**Ende ARCHITECTURE_IT11.md (v3 — 2026-05-04, QA-Review-Resolution: Routing-Fixes, Edge-Cases, Concurrency).**

---

**Ende ARCHITECTURE_IT11.md.**
