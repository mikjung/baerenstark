# Architektur — Iteration 10

**Stand:** 2026-05-03
**Autor:** Solution Architect
**Stack-Anker:** Next.js 14 App Router · Prisma · SQLite (libSQL/Turso in Prod) · NextAuth/Auth.js · Resend · Zod

Dieses Dokument ergänzt `ARCHITECTURE.md` (Bestand) und `ARCHITECTURE_IT9.md` für die fünf Stories der Iteration 10. Es enthält:

- **Teil A:** Bug-Diagnose für US-IT10-01, US-IT10-02, US-IT10-03 inkl. Fix-Strategie (keine Code-Beispiele, nur Architektur-Ebene).
- **Teil B:** Feature-Architektur für US-IT10-04 (Quick-Booking-Modal) und US-IT10-05 (Customer-Self-Service).
- **Teil C:** Datenmodell-, API-Vertrag- und Migrations-Hinweise.
- **Offene Fragen** an PM/Tom.

---

## 1. Bug-Analyse (Teil A)

### 1.1 US-IT10-01 — Passwort-Reset-E-Mail wird nicht versendet

**Beobachtung:** `POST /api/customer/forgot-password` antwortet konstant `200 { ok: true }` (Email-Enumeration-Schutz mit 750 ms Latenz-Floor — siehe `src/app/api/customer/forgot-password/route.ts` Z. 169–172). Das ist by design — ob der Mail-Versand wirklich erfolgreich war, lässt sich aus der Antwort **nicht** ableiten. Der eigentliche Defekt liegt also im Mail-Dispatch oder in der ENV-Konfiguration.

**Root-Cause-Hypothesen** (in Prio-Reihenfolge):

1. **Höchstwahrscheinlich — ENV-Variable falsch benannt (Konfig-Drift).**
   - Die Story-Hinweise des PM nennen `RESEND_FROM_EMAIL` als ENV-Variable.
   - Die App liest aber `MAIL_FROM` (siehe `src/lib/mail.ts` Z. 131–133, `fromAddress()`-Funktion). Default-Fallback ist `onboarding@resend.dev`, der nur aus dem Resend-Sandbox an verifizierte Empfänger zustellt — Echte Kunden-Adressen erhalten **keine** Mail (Resend liefert die Mail nicht zu, antwortet aber strukturell nicht zwingend mit Fehler).
   - In Vercel Production ist mit hoher Wahrscheinlichkeit `MAIL_FROM` nicht gesetzt → Default → keine Mail.
   - **Beleg:** `.env.example` Z. 27 listet `MAIL_FROM`, nicht `RESEND_FROM_EMAIL`.

2. **Resend-Domain nicht verifiziert.** Wenn `MAIL_FROM` zwar gesetzt ist, aber auf eine nicht-verifizierte Custom-Domain zeigt (`noreply@baerenstark-hausservice.de`), antwortet Resend mit `403`/`422` und der Mail-Versand scheitert silent (siehe `rawSend()` Z. 165–179, fängt Resend-Fehler in `MailResult.error`).

3. **Latenz-Floor maskiert Mail-Fehler.** Selbst wenn `sendPasswordResetEmail()` mit `{ ok: false, error: '…' }` antwortet, loggt der Code nur `console.warn` (siehe `forgot-password/route.ts` Z. 154–163) — ohne Vercel-Log-Inspection sieht Tom keinen Hinweis. **Architekturschwachstelle**, kein Bug.

4. **`NEXTAUTH_URL` zeigt auf `localhost`.** Der Reset-Link wird mit `buildResetUrl()` aus `NEXTAUTH_URL` (Z. 60–67) gebaut. Wenn die Variable in Production fehlt oder `http://localhost:3000` zeigt, ist die Mail unbenutzbar. Nicht der Hauptverdacht, weil dann zumindest **eine** Mail käme — aber ein Folge-Defekt, der in QA mit auffallen würde.

**Fix-Strategie (architektonisch, keine Code-Beispiele):**

- **Sofort-Fix (ENV-Konsolidierung):**
  - Festhalten: kanonischer Name ist `MAIL_FROM` (bestehender Code-Vertrag, in `.env.example` und `mail.ts` etabliert). PM-Hinweis `RESEND_FROM_EMAIL` ist ein Aliasname, **nicht** das, was die App liest.
  - In Vercel Production setzen: `MAIL_FROM`, `RESEND_API_KEY`, `MAIL_TO_ADMIN`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`.
  - Engineer prüft via Vercel-CLI (`vercel env ls`) oder Diagnose-Endpoint, welche dieser Variablen gesetzt sind.

- **Sofort-Fix (Resend-Domain):**
  - Tom verifiziert die Absender-Domain im Resend-Dashboard (DNS-Records: SPF, DKIM, optional DMARC). Bis dahin Fallback-Absender `onboarding@resend.dev` mit Test-Empfänger Toms verifizierter E-Mail.

- **Diagnose-Verbesserung (architektonisch sinnvoll, optional):**
  - Im Backend einen Diagnose-Endpoint `GET /api/admin/diagnose/mail` (Admin-only, Dev-only oder mit ENV-Gate `ALLOW_MAIL_DIAGNOSE=true`) ergänzen, der `getResend()`, `MAIL_FROM`, `MAIL_TO_ADMIN` und `NEXTAUTH_URL` prüft und einen strukturierten Health-Bericht liefert. Analog zu US-IT7-02-Diagnose-Endpoint in IT7. **Nicht zwingend** für IT10 — wenn der ENV-Fix wirkt, kein Code-Change.
  - Im `forgot-password`-Pfad zusätzlich zum `console.warn` ein strukturiertes Logging mit `request_id` einführen, damit Vercel-Logs nach `[forgot-password] reset mail failed` filterbar sind. **Backlog**, kein IT10-Scope.

**Akzeptanztest (für QA):** Tom fordert über `/konto/passwort-vergessen` mit einer in der DB existierenden E-Mail-Adresse einen Reset an; innerhalb von 2 Minuten erscheint die deutschsprachige Reset-Mail im Posteingang, der Link öffnet `/konto/passwort-zuruecksetzen?token=…` und das neue Passwort kann erfolgreich gesetzt werden.

---

### 1.2 US-IT10-02 — Admin `/admin/users` wirft 500

**Beobachtung:** Die Page `/admin/users` (Server-Component, `src/app/admin/users/page.tsx`) ruft `requireActiveAdmin()` und rendert `<UserTable />`. Die UserTable lädt die Liste via `fetchAdminUsers()` aus `src/lib/api-client-it6.ts` (Z. 257–282), das die Endpoint-Response `{ data: { items, total, page, pageSize } }` unwrappt.

Die Backend-Route `GET /api/admin/users` liegt in `src/app/api/admin/users/route.ts`. Der IT9-Fix (US-IT9-01) hat den Response-Shape von `data` auf `items` geändert (Z. 115–127, Doku-Block). Der FE-Client wurde synchron angepasst.

**Root-Cause-Hypothesen** (in Prio-Reihenfolge):

1. **Höchstwahrscheinlich — Prisma-Query auf `_count.bookings` mit gleichzeitiger Sort-Whitelist `bookingCount_desc` schlägt fehl.**
   - `route.ts` Z. 72–94: Wenn `parsed.sort === 'bookingCount_desc'` läuft die Query mit `orderBy: [{ bookings: { _count: 'desc' } }, { lastName: 'asc' }]`.
   - Bei SQLite-Backend (Provider `sqlite` in `prisma/schema.prisma` Z. 205) ist `orderBy: { _count }` auf einer Relation seit Prisma 5 stabil, aber nur bei korrektem Index. Index `[lastName, firstName]` ist auf `customer_users` vorhanden — kein Index auf `bookings(customerId)`. Bei größeren Datenmengen ein Performance-Risiko, aber bei kleiner DB unkritisch.
   - **Eigentlicher Defekt:** Wenn Tom die Page **ohne** Sort-Parameter (Default) öffnet, läuft der `lastName_asc`-Pfad. Hier prüfen wir, ob die Query die neue **IT9-Adress-Spalte** (`streetAndNumber`, `postalCode`, `city`) selektiert (Z. 100–102) — die DB hat sie via Migration `20260503163821_add_customer_address`. Das ist konsistent.

2. **Höchstwahrscheinlich — Fehlende DB-Migration in Production.**
   - Die letzte Migration `20260503163821_add_customer_address` ist im Repo, aber **möglicherweise nicht** in Production deployed (Vercel/libSQL/Turso). `selectCustomerUserAdmin()` in `src/lib/dto/user.ts` selektiert `streetAndNumber/postalCode/city` (Z. 100–102). Wenn die Spalten in Prod fehlen, wirft Prisma einen `PrismaClientKnownRequestError` (Code `P2022` „Column does not exist") → der `internalError(err)` Z. 134–137 mappt das auf 500 mit generischer Fehlermeldung „Interner Serverfehler".
   - **Indikator:** US-IT10-03 (Booking-Bug) hat exakt dieselbe Symptomatik (500 + generic message) — beide Endpunkte greifen Tabellen mit IT9-Erweiterungen ab, beide würden bei einer verschlafenen Migration crashen.

3. **Möglich — `requireActiveAdmin()` wirft bei DISABLED-Admin.**
   - Wenn Toms Admin-Account in der DB als `status = DISABLED` markiert ist (durch QA, US-IT8 oder Manual-Edit), wirft `requireActiveAdmin()` einen Redirect statt 500. Anders als bei einem 500. Eher nicht der Defekt.

4. **Unwahrscheinlich — DTO-Leak-Scanner-Block.**
   - `selectCustomerUserAdmin()` ist die korrekte Variante und enthält `adminNote` und `adminRating`. Kein Leak.

**Fix-Strategie (architektonisch):**

- **Sofort-Diagnose:** Engineer öffnet Vercel-Function-Logs für `/api/admin/users` und prüft den Stack-Trace. Wenn `P2022` (column does not exist) → Migration in Prod nachholen (`prisma migrate deploy`). Wenn TypeError oder Mapping-Fehler → in `route.ts` analysieren.

- **Strukturschutz (architektonisch sinnvoll):**
  - Die Default-Sortierung im Backend ist `lastName_asc` (siehe Z. 53–55). Bei NULL-`lastName` (sollte nicht vorkommen, weil `lastName` NOT NULL ist) crasht Prisma nicht. Kein Eingriff nötig.
  - **`internalError()` in `lib/api.ts` muss in Production zumindest einen `request_id`-Header setzen**, damit QA und Tom den Vercel-Log-Eintrag korrelieren können. **Backlog**, nicht IT10-Scope.

- **Pflicht-Aktion:**
  - Engineer prüft `_prisma_migrations`-Tabelle in Prod und stellt Migration nach, falls fehlend. Kein Code-Change im Endpoint, wenn die Hypothese „verschlafene Migration" stimmt.
  - **Falls** doch ein Code-Defekt sichtbar wird (TypeError im Mapping Z. 96–113), wird die fehlerhafte Zeile gezielt korrigiert. Dieser Fall ist nach IT9-QA unwahrscheinlich.

**Akzeptanztest (für QA):** Tom ruft als eingeloggter ACTIVE-Admin `/admin/users` auf; die Seite rendert die Liste aller Customer-User mit Name, Email, Registrierungsdatum, `bookingCount`, optional `adminNote`/`adminRating`. Bei leerer DB erscheint `Keine Kunden registriert.` ohne Fehlerbanner.

---

### 1.3 US-IT10-03 — Booking-POST wirft 500

**Beobachtung:** `POST /api/bookings` (`src/app/api/bookings/route.ts` Z. 185–534) ist ein langer Handler mit zwei Modi (Date-Mode + Slot-Mode), Adress-Pflicht (IT9), Overlap-Check in Serializable-Tx (`booking-create.ts`), Attachment-Verknüpfung und Fire-and-forget-Mail-Dispatch.

Der FE-Form (`src/components/booking/BookingForm.tsx` Z. 224–267) sendet im Date-Modus: `date`, `startTime`, `endTime`, `durationMinutes`, plus Customer-Felder, Adress-Felder, `privacyAccepted` und optional `attachmentIds`.

**Root-Cause-Hypothesen** (in Prio-Reihenfolge):

1. **Höchstwahrscheinlich — Prisma-Schema-Drift (genau wie US-IT10-02).**
   - Das `Booking`-Modell enthält seit IT5 `addressStreet/addressZip/addressCity` (`prisma/schema.prisma` Z. 188+, Migration `20260502235443_iteration5`). Wenn diese Migration in Prod fehlt, wirft `prisma.booking.create({ data: { addressStreet, ... } })` einen `P2022` → 500.
   - **Stärker:** Die `customer_users`-Spalten `streetAndNumber/postalCode/city` werden im Adress-Pflicht-Pfad (Z. 229–256) per `prisma.customerUser.findUnique({ select: { streetAndNumber, postalCode, city } })` gelesen. Wenn die IT9-Migration fehlt, crasht **bereits dieser Read** (`P2022`) — der Booking ist tot, sobald ein eingeloggter Kunde ohne Adress-Body postet.
   - **Beleg, dass IT10-02 und IT10-03 zusammenhängen:** beide Endpunkte wurden in IT9 angefasst (Adress-Erweiterung), beide werfen 500. Das ist der diagnostische Fingerabdruck einer fehlenden Migration.

2. **Möglich — Resend-Mail-Fehler kippt den Handler nicht (fire-and-forget gilt seit IT2/BUG US-04 Fix 1).**
   - `runMailDispatch()` läuft als `void runMailDispatch(...).catch(...)` (Z. 511–513) — der Mail-Pfad kann den Booking-Insert **nicht** mehr 500-en. Diese Hypothese ist seit IT2 architektonisch ausgeschlossen, **es sei denn** ein neuerer Code-Change hat den `void`-Wrapper versehentlich entfernt. Kurzer Code-Audit bestätigt: Wrapper steht.

3. **Möglich — `endTime` wird von FE nicht mitgeschickt → superRefine schlägt fehl mit unklarer Meldung.**
   - `CreateBookingSchema.superRefine()` (`contracts/zod-schemas.ts` Z. 466–477) erwartet `data.date && data.startTime && data.endTime` ODER `slotId`. Wenn FE im Date-Modus `endTime` weglässt → `hasDateMode === false`, `hasSlotMode === false`, Validation-Fehler `Bitte einen Termin auswählen (Datum + Uhrzeit).` Aber das ergäbe **400 VALIDATION_ERROR**, nicht 500. Nicht der Hauptverdacht.
   - **Aber:** Wenn das Quick-Booking-Modal aus US-IT10-04 implementiert wird, MUSS der FE `endTime` weiter mitschicken. Dokumentieren.

4. **Möglich — Race im Serializable-Tx-Timeout.**
   - `booking-create.ts` Z. 153–158 setzt `timeout: 5000ms`, `maxWait: 2000ms`. Bei langsamer libSQL-Verbindung in Prod wirft Prisma `P2028` (Transaction timeout). Das kippt zu 500. Nicht der Hauptverdacht — würde sporadisch, nicht reproduzierbar auftreten.

5. **Unwahrscheinlich — Validation-Fehler im Adress-Schema.**
   - PLZ-Schema ist `^\d{5}$`. Tom hätte beim Test wahrscheinlich gültige Werte verwendet. Bei Validation-Fehler wäre die Antwort 400, nicht 500.

**Fix-Strategie (architektonisch):**

- **Sofort-Diagnose (Pflicht):**
  - Engineer öffnet Vercel-Function-Logs für `POST /api/bookings`, isoliert den Stack-Trace, prüft Prisma-Error-Code.
  - Wenn `P2022` → Migration nachholen (`prisma migrate deploy` in Prod gegen libSQL/Turso). Wahrscheinlich gehen IT10-02 und IT10-03 mit einem einzigen Migrate-Run weg.
  - Wenn `P2028` (Tx-Timeout) → `timeout` in `booking-create.ts` auf 10000 ms erhöhen, `maxWait` auf 4000 ms. Architektur-Eingriff klein und lokal.
  - Wenn TypeError → konkreter Fix-Patch im betroffenen Pfad.

- **Strukturschutz:**
  - `internalError()` in `lib/api.ts` sollte den Prisma-Error-Code im Vercel-Log mit-loggen (defensives Logging). **Backlog**, optional in IT10.
  - Im FE-`BookingForm` ist die `handleApiError`-Fallback-Behandlung (`status: 'error'`) deutsch und benutzbar. Kein Eingriff nötig.

**Akzeptanztest (für QA):** Anonymer Kunde füllt das Buchungsformular vollständig aus (Name, Telefon, E-Mail, Adresse, Service, Datum + Uhrzeit + Dauer, Beschreibung, Datenschutz-Checkbox), klickt „Anfrage absenden"; Erfolgsseite `/buchung/bestaetigt` erscheint, Tom sieht den Eintrag in `/admin/bookings` mit Status `Offen`, Tom erhält Benachrichtigungs-Mail an `MAIL_TO_ADMIN`.

---

### 1.4 Querschnitt — gemeinsame Empfehlung

**Pflicht-Schritt vor Code-Änderungen:** Engineer prüft den Migrations-Stand in Production via:

1. Vercel-Logs (welche Prisma-Fehlercodes treten auf?)
2. Vergleich `prisma/migrations/`-Verzeichnis mit der `_prisma_migrations`-Tabelle in der Prod-DB (libSQL/Turso).
3. `prisma migrate deploy` in Prod ausführen, falls Drift festgestellt.

**Strukturelle Erkenntnis:** IT9 war eine Schema-Erweiterungs-Iteration. Wenn die Migration nicht in Prod gezogen wurde, schlagen **alle** Endpunkte fehl, die das neue Schema anfassen — `/api/admin/users`, `POST /api/bookings`, indirekt auch der Adress-Pflicht-Pfad. Drei Bugs mit einer Migration heilbar.

**Wenn die Migration vorhanden ist und die Bugs trotzdem auftreten,** liegen unabhängige Defekte vor und müssen einzeln per Stack-Trace analysiert werden.

---

## 2. Feature-Architektur (Teil B)

### 2.1 US-IT10-04 — Kalender-Quick-Booking-Modal

#### Ziel

Klick auf einen verfügbaren Slot im Kalender-Widget öffnet ein Modal mit dem vollständigen Buchungsformular (Datum + Uhrzeit + Dauer vorausgewählt). Der bestehende Seiten-Flow (Kalender-Seite → Form-Seite) bleibt als Fallback erhalten (für No-JS und Direkt-Aufruf).

#### Architektur-Entscheidung

- **Wiederverwendung der `BookingForm`-Komponente** (`src/components/booking/BookingForm.tsx`). Kein Form-Duplikat — der Wrapper ist neu, das Form bleibt unverändert.
- **Modal-Komponente:** Neue Client-Komponente `src/components/booking/QuickBookingModal.tsx`. Implementierung mit nativem `<dialog>`-Element ODER Headless-Pattern (Tab-Trap, Focus-Restore, Escape-Schließen, Backdrop-Klick) — die Wahl trifft der UX-Designer im Detail-Spec, das Architektur-Dokument verlangt nur:
  - WAI-ARIA Dialog-Pattern (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).
  - Focus-Trap im Modal.
  - Escape, Backdrop-Klick und Close-Button schließen das Modal.
  - Auf Mobile vollflächig (`min-height: 100vh`) oder Bottom-Sheet — UX-Designer entscheidet.
- **State-Management — vorausgewählter Slot:**
  - Der Kalender (`BookingCalendar`) hält bereits `selectedTimeSlot` als Client-State im Parent (Page `/buchung`).
  - Bei Klick auf einen verfügbaren Slot ruft der Kalender den bestehenden `onSelectTimeSlot`-Callback. Statt direkt das Formular zu rendern, setzt der Parent zwei States parallel: `selectedTimeSlot` und `isQuickBookingOpen=true`.
  - Das Modal erhält `selectedTimeSlot` als Prop und reicht es an `BookingForm` weiter (gleicher Prop-Name wie heute).
  - **Keine URL-Parameter** für die Slot-Übergabe — Modal-State ist ephemerer Client-State, Tiefen-Verlinkung nicht erforderlich (siehe „Offene Fragen").
- **Datenverlust-Vermeidung (AC3):**
  - Beim Schließen ohne Submit bleiben Form-Werte in der RHF-State erhalten, **wenn** das Modal nicht unmounted wird (Variante A: `display:none` statt Conditional Render). Variante B (saubere): Wir lifeten den Form-Default-State in den Parent (z.B. mit `useState<Partial<BookingFormInput>>` und Pre-Fill aus `useFormContext`).
  - Architektur-Empfehlung: **Variante A (Modal bleibt gemountet)** — minimaler Eingriff, kein Lifting nötig. Performance unkritisch (Form ist klein).
- **Validation:** RHF + Zod (`BookingFormSchema`) wie bisher. Inline-Fehler am Feld (AC4). Kein Architektur-Eingriff.
- **Submit:** Bleibt `POST /api/bookings` (Date-Mode). **Keine** API-Änderung. Kein Optimistic UI — auf Fehler 409/CONFLICT zeigt das Modal den bestehenden „conflict"-State und schließt sich nicht (User wählt anderen Slot).
- **Erfolg:** Modal schließt, Erfolgs-Toast oder Inline-Banner auf der Buchungs-Seite. Bestehender `/buchung/bestaetigt`-Flow bleibt für den Direkt-Form-Fallback erhalten — im Modal-Pfad **kein** Seitenwechsel (AC2).
- **Fallback (No-JS, Direkt-URL):** Die bestehende Buchungs-Seite mit eingebettetem Form bleibt unter `/buchung` erreichbar, wenn der User mit einem `?date=…&time=…`-Query-Param ankommt (z.B. aus E-Mail-Link). UX-Designer bestätigt das Fallback-Flow.

#### Wiederverwendete Endpoints

- `GET /api/availability/calendar` — Kalender-Status-Feed. **Unverändert**.
- `GET /api/slots/available?date=YYYY-MM-DD` — Slot-Liste pro Tag. **Unverändert**.
- `POST /api/bookings` — Booking-Anlage. **Unverändert**.
- `POST /api/upload` — Datei-Anhänge (US-18). **Unverändert**.

**Keine neuen API-Felder oder -Parameter.** Story ist rein FE.

#### Frontend-Struktur

```
src/components/booking/
  ├── BookingCalendar.tsx        (UPDATE — onSelectTimeSlot ruft Parent-State, der das Modal öffnet)
  ├── BookingForm.tsx            (UNVERÄNDERT — bleibt Single-Source-Of-Truth)
  └── QuickBookingModal.tsx      (NEU — Wrapper mit Dialog/Sheet)

src/app/buchung/page.tsx          (UPDATE — Parent hält Modal-State, rendert Modal + Form)
src/app/buchung/page-client.tsx   (oder Equivalent — UPDATE)
```

---

### 2.2 US-IT10-05 — Customer-Self-Service (Anfragen-Übersicht + Form-Pre-Fill)

#### Teil A — Anfragen-Übersicht

- **Status quo:** `/konto` zeigt bereits eine Auflistung der Buchungen via `GET /api/customer/bookings` (US-26, IT4). Endpoint liefert `{ upcoming, past }` mit Booking-Details inkl. Status, Datum, Adresse, Anhängen, Bewertung.
- **Architektur-Entscheidung:** **Kein neuer Endpoint** nötig. Wir benutzen weiter `GET /api/customer/bookings`. Frontend prüft, ob alle in der Story geforderten Felder bereits geliefert werden:
  - Datum, Uhrzeit, Service, Status, `createdAt`, Beschreibung, Adresse, Anhänge — alles vorhanden.
  - Status-Badge auf Deutsch — Frontend-Mapping (`PENDING → Offen` etc.). Kein Backend-Eingriff.
  - **Lücke:** `COUNTER_PROPOSED` (Gegenvorschlag ausstehend) ist im Backend-Status-Enum vorhanden (siehe `BookingStatus` in `schema.prisma`). Wir prüfen, ob das aktuelle FE diesen Status korrekt rendert; falls nicht, wird der Status-Mapper im FE ergänzt.
- **Detailseite:** Klick auf einen Eintrag → `/konto/anfragen/:id` (oder bestehender Detail-Pfad falls vorhanden).
  - **Status quo:** `GET /api/customer/bookings/:id` ist in api-routes.md Z. 1502 spezifiziert und unter `src/app/api/customer/bookings/[id]/` implementiert. **Wiederverwenden, kein neuer Endpoint.**
- **Empty-State:** „Sie haben noch keine Anfragen" + CTA-Button „Jetzt erste Anfrage stellen" → linkt auf `/buchung`. Pure FE.

#### Teil B — Form-Pre-Fill mit Profildaten

- **Profildaten-Quelle:**
  - `CustomerUser`-Tabelle enthält bereits seit IT9 (`streetAndNumber`, `postalCode`, `city`) plus seit IT4 (`firstName`, `lastName`, `email`, `phone`).
  - **Keine neue „Profile"-Entität** — die `CustomerUser`-Felder reichen.
- **Pre-Fill-Strategie:**
  - **Server-Side-Fetch.** Die Page `/buchung` (Server-Component) liest die Customer-Session via `getCustomerFromRequest()` und reicht das Profil als `defaultValues` an `BookingForm`. Wenn nicht eingeloggt → `defaultValues = {}` (leer).
  - Mapping:
    - `profile.firstName + ' ' + profile.lastName` → `customerName`
    - `profile.email` → `customerEmail`
    - `profile.phone` → `customerPhone`
    - `profile.streetAndNumber` → `addressStreet`
    - `profile.postalCode` → `addressZip`
    - `profile.city` → `addressCity`
  - **Hinweis:** Das BookingForm hat bereits einen `profileAddress`-Prop und mapped diese Felder (siehe `BookingForm.tsx` Z. 134–145 im Bestand). Wir erweitern das Pre-Fill auf Name, Email, Telefon — **kleines** FE-Refactor, das den Prop um drei weitere Felder erweitert.
- **Profil-Adresse fehlt → Hinweisbanner:** AC besagt: Wenn Profil keine Adresse hat → Adressfelder bleiben leer + Banner „Adresse in Ihrem Profil hinterlegen" mit Link zu `/konto`. Pure FE.
- **Werte-Override im Form:** Schon heute kann der Kunde geänderte Werte abschicken; Backend persistiert die im Booking, das Profil bleibt unangetastet (Booking-Adresse ist Auftrags-Snapshot, Profil-Adresse ist Default — siehe Doku in `schema.prisma` Z. 591–607). Kein Eingriff.
- **Gast-Pfad:** Nicht eingeloggt → Form leer, identisches Verhalten wie heute. Kein Eingriff.

#### Architektur-Optionen — `useSession` vs. SSR-Pre-Fill

Zwei tragfähige Varianten:

| Variante                                        | Vor                                                                      | Nach                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **A. SSR-Pre-Fill (empfohlen)**                 | Page liest Session, fetcht `CustomerUser`, gibt `defaultValues` an Form. | Kein Flash unausgefüllter Felder, kein Client-Roundtrip.            |
| **B. Client-Side via `GET /api/customer/me`**  | Form mountet leer, fetcht Profil im `useEffect`, befüllt Felder.         | Sichtbarer Flash, doppelter API-Call, RHF-`reset()` nötig.          |

**Architektur-Entscheidung: Variante A (SSR).**

- Die Buchungs-Seite ist heute schon eine Server-Component (`src/app/buchung/page.tsx`).
- `getCustomerFromRequest()` ist server-tauglich.
- Performance: Ein DB-Roundtrip mehr beim Page-Load — vernachlässigbar.

#### Schema-Änderungen

**Keine.** Alle benötigten Felder existieren in `CustomerUser` (IT4 + IT9).

#### API-Vertrag-Änderungen

- `GET /api/customer/bookings` — **unverändert**, Felder reichen.
- `GET /api/customer/bookings/:id` — **unverändert**.
- `GET /api/customer/me` — **unverändert** (liefert bereits Profil-Felder inkl. Adresse).
- **Kein neuer Endpoint.**

#### Frontend-Struktur

```
src/app/konto/page.tsx                       (UPDATE — Status-Badges-Mapping prüfen, Empty-State präzisieren)
src/app/konto/anfragen/[id]/page.tsx         (UPDATE/PRÜFEN — Detailseite vorhanden? sonst NEU)
src/app/buchung/page.tsx                     (UPDATE — Profil-SSR-Lookup ergänzen)
src/components/booking/BookingForm.tsx       (UPDATE — defaultValues-Prop um Name/Email/Phone erweitern)
src/components/booking/ProfileAddressHint.tsx (NEU — Banner „Adresse in Profil hinterlegen")
```

---

## 3. Datenmodell-Änderungen

**Keine.** Alle Stories der Iteration 10 kommen ohne Schema-Änderungen aus:

- Bug-Stories: kein Modell-Eingriff.
- US-IT10-04: kein Modell-Eingriff (rein FE).
- US-IT10-05: alle benötigten Felder bestehen bereits (`CustomerUser.streetAndNumber/postalCode/city/phone/firstName/lastName/email`).

**Migration-Plan:** keine neue Migration in `prisma/migrations/` für Iteration 10.

**Aber:** Engineer muss den Migrations-Stand der Prod-DB prüfen (siehe §1.4) und ggf. die IT9-Migration `20260503163821_add_customer_address` nachziehen, falls sie in Prod fehlt.

---

## 4. API-Vertrag-Änderungen

**Keine neuen Endpoints.** Keine Schema-Änderungen an bestehenden Request/Response-Bodies.

| Endpoint                                | Iteration-10-Änderung                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/customer/forgot-password`    | **kein API-Change.** Konfig-Fix (`MAIL_FROM`, Resend-Domain). Verhalten und Response-Shape unverändert.                                     |
| `POST /api/customer/reset-password`     | **kein API-Change.** Funktioniert unverändert; profitiert vom Fix von US-IT10-01.                                                            |
| `GET /api/admin/users`                  | **kein API-Change.** Migration-Drift fixen, Stack-Trace prüfen, Code-Patch nur falls Hypothese „Migration" nicht greift.                     |
| `POST /api/bookings`                    | **kein API-Change.** Migration-Drift fixen, Stack-Trace prüfen.                                                                              |
| `GET /api/customer/bookings`            | **kein API-Change.** Reuse für US-IT10-05 Teil A.                                                                                            |
| `GET /api/customer/bookings/:id`        | **kein API-Change.** Reuse für US-IT10-05 Teil A (Detailseite).                                                                              |
| `GET /api/customer/me`                  | **kein API-Change.** Reuse für US-IT10-05 Teil B (Profil-SSR-Lookup).                                                                        |

`contracts/api-routes.md` erhält einen IT10-Anhang, der die Wiederverwendung dokumentiert (siehe §6).

---

## 5. Migrationen / Breaking-Changes

- **Keine Breaking-Changes** in API-Verträgen.
- **Keine Datenbank-Migration** in IT10.
- **Konfig-Drift in Vercel:** `MAIL_FROM`, `RESEND_API_KEY`, `MAIL_TO_ADMIN`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL` müssen geprüft und gesetzt sein. Resend-Domain verifizieren.
- **Prod-Migrations-Drift (Hypothese):** Falls IT9-Migration in Prod fehlt → `prisma migrate deploy` ausführen. **Kein** Re-Deploy nötig, sobald die Migration durch ist.

---

## 6. Updates an Vertragsdokumenten

- `contracts/api-routes.md` — neuer Anhang **§24 Iteration 10**, der die Wiederverwendungen und Fix-Maßnahmen dokumentiert (kein neuer Endpoint).
- `contracts/zod-schemas.ts` — **keine Änderungen** in IT10. Alle bestehenden Schemas decken die Stories ab.
- `contracts/schema.prisma` — **keine Änderungen** in IT10.
- `project/design/requirements/backend-requirements.md` — Anhang IT10 (Bug-Fix-Aktionen + Self-Service-Reuse).
- `project/design/requirements/frontend-requirements.md` — Anhang IT10 (Quick-Booking-Modal + Pre-Fill + Anfragen-Übersicht-Refinement).

---

## 7. Offene Fragen (für PM/Tom)

1. **`MAIL_FROM` vs. `RESEND_FROM_EMAIL`:** Der PM-Hinweis zu US-IT10-01 nennt `RESEND_FROM_EMAIL`. Im bestehenden Code (`src/lib/mail.ts`) und in `.env.example` heißt die Variable `MAIL_FROM`. **Vorschlag des Architekten:** `MAIL_FROM` bleibt der kanonische Name (kein Code-Change), in der Story-Dokumentation `RESEND_FROM_EMAIL` als Alias-Hinweis streichen. Bestätigt der PM?

2. **Tiefen-Verlinkung Quick-Booking-Modal:** Soll der Slot-Klick den State **nur** im Browser halten oder zusätzlich als URL-Param spiegeln (`/buchung?date=2026-05-10&time=10:00&duration=60`), damit Tom den Link teilen kann? Die Story sagt nichts dazu. **Vorschlag des Architekten:** Phase 1 ohne URL-Param (rein Modal-State); URL-Sync ist Backlog. Bestätigung Tom?

3. **Anfragen-Detailseite:** Existiert `/konto/anfragen/:id` bereits aus IT4 (US-26)? Wenn ja, was fehlt zu den IT10-AC? Wenn nein, ist die Detailseite Teil von US-IT10-05 oder wird sie als separate Story geschnitten? **Vorschlag des Architekten:** Detailseite ist im Scope von US-IT10-05 Teil A AC3, weil dort explizit „Detailseite zeigt alle Buchungsdetails inkl. hochgeladene Dateien" gefordert wird — **kein** separater Story-Cut.

4. **Diagnose-Endpoint Mail (optional in IT10?):** Ein `GET /api/admin/diagnose/mail` würde künftige ähnliche Bugs schneller diagnostizierbar machen. PM-Entscheidung: Scope von IT10 oder Backlog für IT11?

5. **Prod-Migrations-Drift verifizieren:** Engineer braucht Zugriff auf Vercel-Logs UND auf den Migrations-Stand der Prod-DB (libSQL/Turso-Console oder `prisma migrate status` mit Prod-Connection-String). PM/Tom muss bestätigen, dass dieser Zugriff verfügbar ist; sonst kann der Engineer die Hypothese „verschlafene Migration" nicht überprüfen.

---

## 8. Querschnittliche Hinweise für Engineering

- **Stack bleibt unverändert:** Next.js 14 App Router · Prisma + SQLite (libSQL) · NextAuth/Auth.js · Resend · Tailwind · Zod · RHF.
- **Keine neuen Dependencies** für IT10 erforderlich. Modal kann nativ (`<dialog>`) oder mit der bereits vorhandenen UI-Bibliothek (sofern eine eingebunden ist) gebaut werden — UX-Designer entscheidet die Pattern-Wahl im UX-Spec.
- **Tests:** Bug-Fixes brauchen Regressions-Smoke (1× Forgot-Password End-to-End, 1× `GET /api/admin/users`, 1× `POST /api/bookings`). Features brauchen Modal-Open/Close-Tests, Pre-Fill-Tests (Mock-Session) und Empty-State-Tests.
- **DSGVO / Datenhoheit:** Pre-Fill nutzt nur Profildaten des eingeloggten Kunden (= seine eigenen Daten). Booking-Adresse bleibt Auftrags-Snapshot, Profil-Adresse bleibt customer-owned und unabhängig editierbar (siehe IT9-Architektur). Kein Eingriff in DSGVO-Verträge.

---

## 9. Updates nach QA-Design-Review (2026-05-03)

QA hat im Design-Review (`QA_DESIGN_REVIEW_IT10.md`) vier strukturelle Defekte und drei PM-Klärungen identifiziert. Dieses Kapitel dokumentiert die abschließenden Architektur-Entscheidungen, die den Stand vor Build-Phase fixieren.

### 9.1 STRUCT-3 — Slot-Konflikt-Error-Code vereinheitlicht

**Problem:** UX-Spec §1.5 + §5.2 Pkt. 6 + §5.3 referenzieren `BOOKING_SLOT_TAKEN` als Mapping-Schlüssel für die Slot-Belegt-Microcopy. Backend liefert in `POST /api/bookings` aktuell `409` mit Top-Level-Code `CONFLICT` bzw. `OVERLAP` — `BOOKING_SLOT_TAKEN` existiert weder im Vertragsdokument noch im Code. FE-Mapping würde fehlschlagen, User sieht 5xx-Fallback statt UX-konformer Slot-Belegt-Meldung.

**Entscheidung (Single-Source-Of-Truth):**

- **Kanonischer Error-Code für Slot-Konflikte:** `BOOKING_SLOT_TAKEN` (FE-Mapping-Schlüssel und Backend-Subcode in einem).
- **HTTP-Status:** unverändert `409`.
- **Response-Shape (verbindlich für IT10):**

  ```json
  {
    "error": {
      "code": "CONFLICT",
      "subcode": "BOOKING_SLOT_TAKEN",
      "message": "Dieser Termin wurde inzwischen leider von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot.",
      "field": "date"
    }
  }
  ```

  - `code` bleibt `CONFLICT` (Rückwärts-Kompatibilität mit allen bestehenden 409-Konsumenten).
  - **Neu:** optionales Feld `subcode` mit dem Wert `BOOKING_SLOT_TAKEN`. Frontend mapped primär auf `subcode`; wenn `subcode` fehlt und `code === 'CONFLICT'` mit `field === 'date'`, gilt es als äquivalent zu `BOOKING_SLOT_TAKEN` (defensiver Fallback, falls ein anderer Endpoint mit Konflikten antwortet, der den Subcode noch nicht setzt).

- **Geltungsbereich:** alle Buchungs-erzeugenden Endpoints, die in eine Doppelbuchung münden können — derzeit ausschließlich `POST /api/bookings`. (Andere 409-Konflikte wie `LAST_ADMIN_LOCK`, `EMAIL_TAKEN`, `SELF_MUTATION_FORBIDDEN`, `ALREADY_VERIFIED` etc. behalten ihre eigenen Subcodes. Die Liste in `contracts/api-routes.md` §22.4 wird um `BOOKING_SLOT_TAKEN` ergänzt.)
- **Code-Eingriff (klein, lokal):**
  - `src/lib/booking-create.ts`: bei Overlap-Verstoß und Partial-Unique-Constraint-Verletzung wird die ApiError-Antwort um `subcode: 'BOOKING_SLOT_TAKEN'` ergänzt.
  - `src/app/api/bookings/route.ts`: Rückgabe via bestehenden `conflict()`-Helper, optionalen `subcode`-Parameter ergänzen.
  - `contracts/zod-schemas.ts` `ApiErrorSchema`: optionales `subcode: z.string().optional()` ergänzen, Type bleibt rückwärts-kompatibel (alter Client ignoriert `subcode`).
- **FE-Mapping-Pflicht:**
  - `BookingForm` und `QuickBookingModal` lesen bei `409`-Antwort primär `error.subcode === 'BOOKING_SLOT_TAKEN'`. Fallback: `error.code === 'CONFLICT' && error.field === 'date'`.
  - Microcopy unverändert (UX-Spec §5.3 `open-slot-taken`).

**Alignment-Notiz für UX:** Die UX-Spec §1.5/§5.2 verwendet `BOOKING_SLOT_TAKEN` schon korrekt. Mit dieser Entscheidung ist der Code jetzt offizieller Backend-Subcode — UX muss nichts ändern. (Sollte UX die Spec parallel angepasst haben, gilt diese Architektur-Entscheidung trotzdem als verbindlich.)

### 9.2 STRUCT-4 — Service-Auswahl im Quick-Booking-Modal

**Problem:** Component-Library §1 macht `service` zu einem Pflicht-Prop des Modals; UX-Spec §5.6 sagt „Service ist im Header sichtbar, nicht editierbar". Was passiert, wenn der Kunde direkt im Kalender auf einen Slot klickt, ohne vorher einen Service auszuwählen? Architektur war stumm.

**Entscheidung: Service ist Bestandteil des Modal-Forms (Variante „Service im Modal").**

Begründung: Die Alternative — Slot-Klick ohne Vorauswahl deaktivieren oder Inline-Hinweis — bricht den natürlichen Flow ("ich sehe einen passenden Slot, will buchen"). Service im Modal hält den Flow durchgängig.

**Spezifikation:**

- **Modal-Trigger-Bedingung:** Slot-Klick im Kalender öffnet das Modal **immer**, unabhängig davon, ob ein Service auf der Page vorausgewählt ist. Es gibt **keine** Vorbedingung.
- **Default-Service:** **kein Default**. Wenn die Page-State einen `serviceSlug` hält (z. B. via URL-Param `?service=…` oder ServiceGrid-Klick), wird dieser ins Modal vorausgewählt. Sonst startet das Service-Feld leer und ist Pflicht.
- **Modal-UI:**
  - Neues Pflicht-Feld im Modal-Body (oberhalb der Beschreibung): „Service" als Radio-Group oder Select mit allen `SERVICES`-Slugs (`reinigung`, `entruempelung`, `gartenpflege`, `hausmeister`, `umzugshilfe`, `sonstiges` — final via `SERVICE_LABELS` aus `src/lib/services.ts`).
  - UX-Spec §5.6 wird angepasst (UX-Designer übernimmt parallel): Service-Chip im Header zeigt entweder den vorausgewählten Service ODER „Service wählen" als Placeholder-Pille; bei Klick scrollt der Fokus zum Service-Feld im Body.
  - Validation: leerer Service → Inline-Fehler „Bitte wählen Sie einen Service." + Banner oben.
- **Component-Library `<QuickBookingModal />` Props (final):**

  | Prop                    | Typ                              | Pflicht | Hinweis                                                                                  |
  | ----------------------- | -------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
  | `isOpen`                | `boolean`                        | ja      | unverändert                                                                              |
  | `onClose`               | `() => void`                     | ja      | unverändert                                                                              |
  | `selectedTimeSlot`      | `TimeSlotInfo \| null`           | ja      | Datum + Start/End + Dauer aus Kalender                                                   |
  | `defaultService`        | `ServiceSlug \| null`            | nein    | **NEU.** Falls Page-State einen Service hält, wird er vorausgewählt; sonst `null`.        |
  | `defaultValues`         | `Partial<BookingFormInput>`      | nein    | Pre-Fill aus Profil (US-IT10-05 Teil B)                                                  |
  | `onSubmitted`           | `() => void`                     | ja      | unverändert                                                                              |

  Der bisherige Pflicht-Prop `service` entfällt — er wird durch `defaultService` (optional) ersetzt. Die endgültige Service-Auswahl steckt im Form-State.

- **API-Vertrag (`POST /api/bookings`):** unverändert. Body enthält wie bisher `serviceId` (String, einer der `SERVICES`-Slugs); Backend-Validation in `CreateBookingSchema` greift wie bisher (`enum SERVICES`).
- **Validation-Regeln:**
  - `service` Pflichtfeld; ohne Auswahl → 400 `VALIDATION_ERROR` mit `field: 'service'`. (Bestehender Vertrag.)
  - Frontend prüft per Zod vor Submit, zeigt Inline-Fehler, Submit bleibt blockiert.

**Hand-off an UX-Designer:** Die UX-Spec §5.2 Pkt. 1, §5.4 (Header-Chips) und §5.6 (Field Order) müssen entsprechend angepasst werden:
- §5.2 Pkt. 1: „Slot-Klick öffnet das Modal **immer**, unabhängig von der Service-Vorauswahl auf der Page."
- §5.4: Service-Chip im Header zeigt entweder Label oder „Service wählen" Placeholder + Klick scrollt zum Service-Feld.
- §5.6: neuer Pflichtabschnitt zwischen „Adresse" und „Beschreibung" (oder nach den Slot-Chips, vor den Kontaktdaten — UX-Designer entscheidet die Position): „Service auswählen" als `<fieldset>` mit Radio-Group oder Select.

### 9.3 STRUCT-1 — Backend-Logging-Härtung als verbindliche IT10-Regel

**Problem:** Aktuell mappt `internalError(err)` in `src/lib/api.ts` jeden unbekannten Fehler auf eine generische 500-Antwort, ohne den Stack-Trace oder Prisma-Error-Code zu loggen. Künftige Migrations-Drift-Bugs (genau die Symptomatik von US-IT10-02 und -03) bleiben unerkennbar — Tom muss sich durch Vercel-Function-Logs forensisch durcharbeiten.

**Entscheidung: Logging-Härtung wird in den IT10-Build aufgenommen (vorher als „Backlog" markiert).** Der Eingriff ist klein, lokal und schließt strukturell die Wiederholung des Bugs.

**Verbindliche Regeln (gelten für alle Route-Handler in `src/app/api/**/route.ts`):**

1. **Jeder Catch-Block, der einen unbekannten Fehler abfängt, MUSS loggen** — entweder mit `console.error` (Production: Vercel-Function-Log) oder einem Logger-Adapter, sofern eingeführt. Mindestens:
   - Endpoint-Marker (z. B. `[POST /api/bookings]`).
   - Fehler-Klassenname (`err?.name`).
   - Stack-Trace (`err?.stack`).
   - Bei Prisma-Fehlern zusätzlich: `err.code` (z. B. `P2022`, `P2002`, `P2028`) und `err.meta`.
2. **Prisma-Errors müssen spezifisch gefangen werden** (in `internalError()` oder im Handler):
   - `PrismaClientKnownRequestError` (`P2022` Column missing, `P2002` Unique-Constraint, `P2025` Record not found, `P2028` Tx-Timeout) loggen mit eindeutigem Marker `[prisma_error]` und Code, antworten weiterhin mit generischer 500, **niemals** als generic 500 ohne Log.
   - `PrismaClientInitializationError` (DB-Connection) loggen mit Marker `[prisma_init_error]`, antworten 500.
3. **Frontend-Verhalten bleibt unverändert** — User sieht weiterhin generischen Fehler-Text aus dem `error.message`-Feld der API-Response. Der Server-Log enthält die Diagnose-Details. **Kein** Stack-Trace oder Prisma-Code im Response-Body (Security: keine Schema-Hinweise an Angreifer).
4. **`internalError()`-Helper-Pattern:** Nutze den bestehenden `internalError(err)`-Helper aus `src/lib/api.ts`. Er ist die zentrale Stelle für Logging — der Helper wird so erweitert, dass er die Pflicht-Logging-Regel automatisch erfüllt. Route-Handler müssen lediglich `try/catch (err) { return internalError(err) }` einhalten; alle anderen Logging-Sorgen entfallen damit.
5. **Optional (empfohlen, nicht zwingend):** `request_id` aus `x-vercel-id` oder einem self-generierten UUID als Tag in jeder Log-Zeile — erleichtert die Korrelation mit Vercel-Function-Aufrufen.

**Akzeptanztest (für QA):** Engineer triggert künstlich einen `P2022` (z. B. lokal eine Spalte in der DB droppen, Endpoint aufrufen). Die Vercel-Function-Logs zeigen einen strukturierten Eintrag mit `[prisma_error] P2022 column does not exist: …`. Frontend zeigt weiterhin nur „Interner Serverfehler".

**Aufwand-Schätzung:** ~2 h Engineer (Erweiterung von `internalError()` + Stichprobe in 2–3 Routes prüfen, dass der Helper überall genutzt wird).

### 9.4 PM-Klarstellungen

#### 9.4.1 PM-1 — `MAIL_FROM` ist Single-Source-Of-Truth

- Im Code (`src/lib/mail.ts` Z. 131–133, `.env.example` Z. 27) heißt die ENV-Variable `MAIL_FROM`.
- Die Story-Hinweise in PROJECT.md zu US-IT10-01 nannten alternativ `RESEND_FROM_EMAIL` — **dieser Alias wird nicht implementiert**.
- **Verbindlich:** Engineer setzt in Vercel `MAIL_FROM` (zusätzlich zu `RESEND_API_KEY`, `MAIL_TO_ADMIN`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`). PROJECT.md wird vom PM bereinigt.
- **Backend-Code:** keine Änderung — `MAIL_FROM` bleibt Quelle der Wahrheit.

#### 9.4.2 PM-2 — Modal-URL-Deep-Link → Backlog

- Die Tiefen-Verlinkung des Quick-Booking-Modals via URL-Param (`/buchung?date=…&time=…&duration=…&service=…`) ist **out of scope für IT10**.
- Modal-State bleibt rein ephemerer Client-State (Variante A aus Architektur §2.1).
- **Frontend-Requirements:** Tiefen-Verlinkungs-Anforderung aus `frontend-requirements.md` IT10 explizit als Backlog markiert. UX-Spec wird vom UX-Designer entsprechend angepasst (kein Hinweis auf URL-Sync in IT10).
- **Backlog-Eintrag (für IT11+):** Modal kann via URL-Param (`?date=…&time=…&duration=…[&service=…]`) deep-linkbar gemacht werden, sodass Tom Termine direkt teilen kann.

#### 9.4.3 PM-3 — Storno bestätigter Anfragen → Backlog

- US-IT10-05 zeigt im Self-Service nur den **Status** der Buchungen. Eine Storno-Funktion für `CONFIRMED`/`COUNTER_PROPOSED`-Buchungen ist **nicht** Teil von IT10-AC.
- **Bestehender Endpoint:** `POST /api/customer/bookings/:id/cancel` (api-routes.md §1522) bleibt aktiv für die bereits ausgelieferte IT4-Storno-Funktion (`PENDING`-Buchungen innerhalb von 24h vor Termin). **Keine** Erweiterung in IT10.
- **UX-Spec §6.9** (Storno-UX im Detail) wird vom UX-Designer mit „Backlog IT11" markiert; die Detail-Page rendert in IT10 **keinen** Storno-Button für `CONFIRMED`-Buchungen.
- **Backlog-Eintrag (für IT11+):** Self-Service-Storno für bestätigte Anfragen, 24h-Frist, ConfirmDialog, Status-Wechsel `CONFIRMED → CANCELLED`.

### 9.5 Anonyme Vor-Account-Buchungen (STRUCT-5) — Klarstellung

Aufgrund der QA-Klassifikation und der Orchestrator-Anweisung gilt verbindlich:

- `GET /api/customer/bookings` filtert **ausschließlich** nach `customerId === session.user.id`.
- Buchungen, die der Nutzer als Gast (mit gleicher E-Mail) **vor** seiner Account-Anlage stellte (`customerId IS NULL`), werden im Self-Service **nicht** angezeigt.
- Dies ist eine **bewusste, akzeptierte Limitation** für IT10 — kein Bug. UX-Spec sollte den Hinweis ergänzen: „Sie sehen Anfragen, die Sie als angemeldeter Kunde gestellt haben."
- **Backlog-Eintrag (für IT11+):** Backfill-Mechanismus bei `POST /api/customer/register` — alle `customerEmail = lc(email) AND customerId IS NULL`-Bookings werden auf den neuen Account gemappt. (Variante A aus QA STRUCT-5.)

### 9.6 Sign-off-Status

| QA-Defekt    | Severity | Status nach diesem Doc | Owner für Build |
| ------------ | -------- | ---------------------- | --------------- |
| STRUCT-1     | Major    | **In IT10-Scope** (Logging-Härtung) | backend-engineer |
| STRUCT-2     | Minor    | Defer (operativ; Engineer löst beim Bauen) | backend-engineer |
| STRUCT-3     | Major    | **Gefixt** — `BOOKING_SLOT_TAKEN` als kanonischer Subcode | backend-engineer + frontend-engineer |
| STRUCT-4     | Major    | **Gefixt** — Service im Modal | frontend-engineer + ux-designer |
| STRUCT-5     | Minor    | Backlog (bewusste Limitation) | — |
| UX-1         | Minor    | UX-Designer (parallel) | ux-designer |
| UX-2         | Minor    | UX-Designer (parallel) | ux-designer |
| PM-1         | Minor    | **Geklärt** — `MAIL_FROM` kanonisch | backend-engineer (env in Vercel) |
| PM-2         | Trivial  | Backlog | — |
| PM-3         | Minor    | Backlog | — |
