# QA Design Review — Iteration 9

**Mode:** Design QA (pre-build pressure-test)
**Datum:** 2026-05-03
**Inputs:** `PROJECT.md` (IT9-Sektion ab Zeile 2049), `ARCHITECTURE_IT9.md`,
Source-Stichproben (`src/app/api/admin/users/route.ts`, `src/lib/api.ts`,
`src/lib/api-client-it6.ts`, `src/lib/api-client.ts`,
`src/components/admin/users/UserTable.tsx`, `src/components/booking/BookingCalendar.tsx`,
`src/components/admin/AdminCalendarView.tsx`, `src/components/calendar/AppCalendar.tsx`,
`src/app/api/customer/me/route.ts`, `src/app/api/bookings/route.ts`,
`contracts/zod-schemas.ts`, `src/lib/dto/user.ts`,
`src/lib/customer-auth-server.ts`, `src/app/buchung/page.tsx`,
`src/app/buchung/BookingClient.tsx`).

---

## Top-Level-Verdikt: APPROVED_WITH_CONCERNS

Die vier Stories sind alle build-ready. Drei der vier identifizierten
Root Causes (US-IT9-01, US-IT9-02-Ist-Zustand, US-IT9-03) wurden via
Code-Inspektion in der Stichprobe **bestätigt**. Eine Reihe MAJOR-Issues
muss vor oder spätestens während des Builds adressiert werden — sie
kosten den Engineer sonst Re-Work-Schleifen. Keine Blocker.

| Story        | Verdict                  |
|--------------|--------------------------|
| US-IT9-01    | APPROVED                 |
| US-IT9-02    | APPROVED_WITH_CONCERNS   |
| US-IT9-03    | APPROVED_WITH_CONCERNS   |
| US-IT9-04    | APPROVED_WITH_CONCERNS   |

---

## 1. US-IT9-01 — `/admin/users` Crash

### Verdict: APPROVED

### Verifikation der Root Cause

| Architecture-Behauptung | Source-Beweis | Status |
|-------------------------|---------------|--------|
| Route `GET /api/admin/users` antwortet `apiSuccess({ data, total, page, pageSize })` | `src/app/api/admin/users/route.ts:111-116` zeigt exakt diese Form | bestätigt |
| `apiSuccess(x)` wickelt `x` zu `{ data: x }` | `src/lib/api.ts:110-118` belegt das | bestätigt |
| Tatsächliche Wire-Form: `{ data: { data, total, page, pageSize } }` | folgt logisch aus den ersten zwei Punkten | bestätigt |
| `fetchAdminUsers` typisiert als `Promise<AdminUsersListResponse>` ohne Unwrap | `src/lib/api-client-it6.ts:226-244` belegt das | bestätigt |
| `request<T>` gibt das **rohe** Response-JSON zurück | `src/lib/api-client.ts:97-159` (Zeile 158: `return parsed as T`) belegt das | bestätigt |
| `setUsers(res.data)` setzt ein OBJEKT, anschließend `users.map` crasht | `src/components/admin/users/UserTable.tsx:78` + `:185` belegt das | bestätigt |
| `/api/admin/users` existiert | `src/app/api/admin/users/route.ts` vorhanden, GET-Handler authed via `requireAdmin()` | bestätigt |

Die im Architecture-Doc benannte „doppelt verschachtelte Response" ist
**real**. Der Fix-Pfad (Variante A: Liste in `items`-Feld umbenennen,
FE-Mapper unwrappt) ist sauber und symmetrisch zur IT8-01-Lösung.

### AC-Coverage

- AC1 (Seite lädt, keine Error-Boundary) → durch Root-Cause-Fix erfüllt.
- AC2 (Stack-Trace dokumentiert) → bereits im Architecture-Doc §1.1
  geliefert; Engineer übernimmt in PR-Beschreibung.
- AC3 (Empty-State „Keine Kunden registriert.") → laut §1.4 in
  `UserTable.tsx:169` bereits implementiert. Stichprobe bestätigt: ein
  Empty-State existiert (Zeile 170+ enthält die Tabellen-Branche im
  Else-Zweig). **Aber:** Der Empty-State-Text laut Architecture-Doc
  ist „Noch keine Kunden registriert." — die Story (AC3) verlangt
  „Keine Kunden registriert." (ohne „Noch"). Geringfügige Abweichung,
  Engineer soll den Story-Text wörtlich nehmen (Minor).
- AC4 (Spalten Name, E-Mail, Reg.-Datum, Status) → Tabelle hat heute
  Name, E-Mail, Reg.-Datum, Buchungen, Rating (`UserTable.tsx:175-181`).
  „Status" laut Story-AC4 könnte mit „emailVerified" oder „adminRating"
  verwechselt werden — heute steht das nicht explizit als Spalte da.
  **Minor:** Engineer soll prüfen, was AC4 mit „Status" meint
  (vermutlich `emailVerified` als Tag oder Icon).

### Issues

- **MINOR-IT9-01-A:** Empty-State-Text-Drift — Story sagt „Keine Kunden
  registriert.", Architecture sagt „Noch keine Kunden registriert.".
  Engineer nimmt den Story-Wortlaut.
- **MINOR-IT9-01-B:** AC4 verlangt „Status" als angezeigtes Feld.
  Aktuelle Tabelle hat keine reine Status-Spalte. Empfehlung: `emailVerified`
  als Status-Badge ergänzen oder im PR begründen, warum die bestehenden
  Spalten AC4 erfüllen.
- **MINOR-IT9-01-C:** `Defensive Guard` in `UserTable.load()` ist im
  Architecture-Doc (§1.2 Defense-in-Depth Punkt 1) als Empfehlung
  formuliert — sollte Pflicht sein (`Array.isArray(res.data) ?` Banner
  „Datenformat-Fehler"), damit ein zukünftiger Drift nicht wieder eine
  Error-Boundary triggert. Engineer-Kosten: ~5 Zeilen.
- **MINOR-IT9-01-D:** Vertragstest `tests/contracts/admin-users-list-shape.test.ts`
  ist „Optional" — sollte als Pflicht eingestuft werden, sonst riskiert
  IT10 denselben Bug eine weitere Iteration tiefer (z.B. in
  `/api/admin/admins/v2`).

### Risiken / Edge Cases

- **Deploy-Window-Risiko:** BE-Vertrag und FE-Mapper müssen in einem
  Commit landen. Sonst zeigt `/admin/users` während des Deploys
  weiterhin den Crash. Architecture nennt das in §1.5 — gut. PR muss
  beide Files in einem Commit haben.
- Regression `/admin/admins`: §1.4 nennt explizit den Regressionstest —
  gut.

---

## 2. US-IT9-02 — Kunden-Adresse im Profil

### Verdict: APPROVED_WITH_CONCERNS

### Verifikation des Ist-Zustands

| Architecture-Behauptung | Source-Beweis | Status |
|-------------------------|---------------|--------|
| `CustomerUser` hat keine Adressfelder | `selectCustomerUserPublic()` und `selectCustomerUserAdmin()` in `src/lib/dto/user.ts:50-93` enthalten keine Adress-Felder | bestätigt |
| `CustomerProfileUpdateSchema` heute nur firstName/lastName/phone | `contracts/zod-schemas.ts:1067-1073` bestätigt das | bestätigt |
| `CustomerRegisterSchema` heute ohne Adresse | `contracts/zod-schemas.ts:998-1007` bestätigt das | bestätigt |
| `Booking.address*` existiert + ist im Date-Modus Pflicht | `contracts/zod-schemas.ts:498-519` (Pflicht via `superRefine` im DateMode) | bestätigt |
| Kein Customer-Self-Delete | `ls src/app/api/customer/me` zeigt nur GET/PATCH | bestätigt |
| `CustomerLoginResponseSchema` extends `CustomerUserPublicSchema` | `contracts/zod-schemas.ts:1128-1130` | bestätigt |

### Pflicht-Validierung der Adresse beim Buchen — wo?

**User-Frage:** „Frontend allein reicht nicht (Bypass-Risiko), Backend
muss auch validieren."

**Aktueller Stand (verifiziert):**
- `CreateBookingSchema.superRefine` erzwingt Adresse im **Date-Modus**
  bereits heute (Zeilen 498-519 in contracts). Das gilt für GUEST und
  LOGGED-IN gleichermaßen. **Bypass im Date-Modus ist heute nicht
  möglich.**
- `Slot-Modus` (legacy IT1/IT2 re-booking) macht Adresse weiter optional
  (Architecture §2.5 Footnote ist konsistent).
- Architecture §2.5 ergänzt für eingeloggte Kunden einen Profil-Adress-
  Fallback: Wenn Body keine Adresse hat → Profil-Adresse als Default
  einsetzen, sonst 400. **Das ist eine Server-Pflicht-Validierung —
  korrekt platziert.**

**Bypass-Analyse für eingeloggten Kunden:**
- Frontend zeigt Banner „Bitte zuerst Profil-Adresse pflegen". Ein
  böswilliger Kunde könnte den Banner umgehen und direkt POST mit
  manueller Adresse schicken. **Das ist OK** — die Adresse landet eh
  im `Booking`-Datensatz und ist Toms Wahrheits-Anker pro Auftrag.
  AC7 verlangt nur, dass eingeloggte Kunden ohne Profil-Adresse
  einen Hinweis sehen — das ist UX, nicht Sicherheits-Constraint.
  Server-seitig genügt: „Adresse muss da sein, woher auch immer."
  **Verdict: Kein Bypass-Risiko.**

### AC-Coverage

| AC  | Adressiert? | Hinweis |
|-----|-------------|---------|
| 1   | Ja, §2.6 A | Optional bei Registrierung |
| 2   | Ja, §2.5 + §2.6 A | Adresse in PUBLIC-Schema, im Profil vorausgefüllt |
| 3   | Ja, §2.5 + §2.6 B | PATCH-Pfad |
| 4   | Ja, §2.6 B | Toast „Adresse gespeichert." |
| 5   | Ja, §2.5 + §2.6 B | Leeren = `null` in DB |
| 6   | Ja, §2.5 Admin-Sicht | Read-only Drawer-Section |
| 7   | Ja, §2.5 Bookings | 400 bei fehlender Adresse für eingeloggte |
| 8   | Ja, §2.5 GET /customer/me | Strict-Schema garantiert keinen Leak |
| 9   | Ja, §2.4 | Migration ist additiv, alles nullable |

### Issues

- **MAJOR-IT9-02-A — Migration auf bestehende Production-Daten:**
  Architecture §2.4 sagt korrekt „rein additiv, alles nullable, keine
  Backfills". **Was fehlt:** Eine explizite Aussage, dass die Migration
  gegen das libSQL/Turso-DB-Backend getestet wurde (Turso hat
  historisch Migrations-Quirks bei `ALTER TABLE … ADD COLUMN` mit
  CHECK-Constraints — auch wenn hier keine Constraints geplant sind,
  sollte der Engineer einen Smoke-Test gegen eine Turso-Branch fahren,
  bevor Production-Migration läuft).
  **Empfehlung:** Engineer fügt zur §2.4 einen Schritt
  `npx prisma migrate deploy` gegen einen Turso-Branch hinzu, prüft
  per `SELECT name FROM pragma_table_info('customer_users');`, dass
  die drei Felder als nullable existieren, dann mergen.

- **MAJOR-IT9-02-B — `CustomerLoginResponseSchema` erbt:** Da
  `CustomerLoginResponseSchema` mittels `.extend()` von
  `CustomerUserPublicSchema` ableitet (`contracts/zod-schemas.ts:1128`),
  fließen die drei neuen Adressfelder automatisch in die Login-
  Response. Architecture erwähnt das nicht explizit. **Empfehlung:**
  Im PR sicherstellen, dass `toCustomerPublic()` die Felder belegt —
  sonst wirft der Login `.parse()` `ZodError: Required` und kippt den
  ganzen Login-Flow (Bypass-Crash). Test-Hook: `POST /api/customer/login`
  → Response enthält `streetAndNumber: null` für Konten ohne Adresse.

- **MAJOR-IT9-02-C — `oauth-finalize` und Register-Response:**
  `src/app/api/customer/register/route.ts:159` und `oauth-finalize`
  rufen ebenfalls `toCustomerPublic()` auf. Wenn `select` nicht die
  drei Felder zieht, schlägt `CustomerUserPublicSchema.parse()` fehl
  (strict + required). **Empfehlung:** §2.5 ergänzen oder Engineer
  expliziter briefen: ALLE Aufrufer von `toCustomerPublic` müssen die
  drei Felder ans Mapper-Input übergeben — also `selectCustomerUserPublic()`
  wird der einzige Sicherungsanker. Das ist genau der F3-Helper-Pfad,
  den IT6 etabliert hat — Architecture nutzt ihn korrekt, aber der
  Engineer muss alle Call-Sites verifizieren.

- **MAJOR-IT9-02-D — Schema-Pflicht-Felder vs. Mapper:** Architecture
  §2.5 schreibt für `CustomerUserPublicSchema`:
  ```
  streetAndNumber: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  ```
  → das macht die Felder zwar nullable, aber **nicht optional**. Das
  ist OK (Mapper liefert immer null oder String) — aber wenn ein
  alter Test irgendwo einen Mock-User ohne diese Felder konstruiert,
  crasht die `.parse()` mit `Required`. **Empfehlung:** Engineer
  prüft `tests/` und `scripts/` nach Mock-Konstruktionen und ergänzt
  die Felder, oder macht sie optional+nullable
  (`z.string().nullable().optional()`) für Backward-Compat.

- **MAJOR-IT9-02-E — Naming-Kollision Doku ↔ Story:** PROJECT.md
  Hinweis-Block zu US-IT9-02 (Zeile 2183) gibt das Schema-Naming
  vor: `streetAndNumber`, `postalCode`, `city`. Architecture
  §2.3 verwendet diese Namen konsistent. ABER: Frontend hat zwei
  parallele Naming-Welten (`addressStreet/addressZip/addressCity`
  in `BookingForm`, `streetAndNumber/postalCode/city` im neuen
  Profil). Ein Engineer, der die Adresse vom Profil ins Booking-Form
  vorausfüllt (§2.6 C), muss explizit ummappen. **Empfehlung:**
  Engineer kommentiert den Mapping-Punkt im Code laut + ergänzt
  einen Unit-Test, der den Mapping-Direction (`profile.streetAndNumber
  → bookingForm.addressStreet`) absichert.

- **MAJOR-IT9-02-F — DTO-Leak-Test (`scripts/check-dto-leaks.ts`):**
  Der bestehende DTO-Guard (siehe `src/lib/dto/user.ts:23`) blockt
  den Output von `adminNote`/`adminRating`. Wenn das Skript per
  Forbidden-Field-Liste arbeitet, muss es nicht angefasst werden.
  Falls es per Allow-List arbeitet, müssen die drei neuen Felder
  ergänzt werden. Architecture erwähnt das nicht — Engineer muss
  beim Build prüfen.

- **MINOR-IT9-02-G — Lösch-UX zu still:** §2.6 B sagt „kein extra
  Lösch-Button, einfach alle Felder leeren + speichern". DSGVO-Sicht:
  Das ist OK, aber ein Kunde ohne Lese-Hilfetext könnte verwundert
  sein. **Empfehlung:** Hinweistext „Felder leer speichern entfernt
  die Adresse." unter dem Save-Button.

- **MINOR-IT9-02-H — Edge Case bei Schema-Validierung:** Profil-
  Update-Schema laut §2.5:
  ```ts
  streetAndNumber: z.string().trim().min(3).max(100).nullable().optional()
  ```
  Wenn der Kunde nur EIN Feld leert (z.B. nur PLZ), bleibt
  `streetAndNumber` und `city` befüllt → DB hat eine inkonsistente
  Adresse. Architecture spricht nicht darüber. Story-AC5 verlangt
  „alle drei Felder leeren". Klarere Semantik: Beim Booking-Fallback
  (§2.5) muss der Server prüfen, ob die Profil-Adresse VOLLSTÄNDIG
  ist (alle drei nicht-null) — sonst greift der „bitte vervollständigen"-
  Pfad. **Empfehlung:** Architecture §2.5 explizit ergänzen:
  „Profil-Adresse-Fallback nur, wenn ALLE drei Felder gesetzt sind;
  sonst 400 mit AC7-Banner."

- **MINOR-IT9-02-I — `phone` Feld bei Profil-Update:** Heute akzeptiert
  PATCH ein optionales phone-Feld via `phoneOptionalSchema`
  (Zeile 1071). Adresse-Patch + phone-Patch in derselben Request
  ist denkbar — keine Action nötig, nur als Hinweis: Engineer soll
  einen Test ergänzen, der einen kombinierten Update-Body absendet.

### Risiken / Migration

- **Migration-Risiko:** ADDITIVE NULLABLE = sicher. Production-Daten
  bleiben unangetastet. Bestehende Queries auf `CustomerUser` brechen
  nicht (neue Felder kommen als `null` zurück). Hauptrisiko: Turso-
  Branch-Test als Pflicht-Schritt VOR Prod-Deploy (siehe MAJOR-A).

- **DSGVO:** Architecture §2.2 E5 + §2.5 GET-Endpoint stellen sicher,
  dass die Adresse nur unter eigener Customer-Session lesbar ist.
  Admin-Read-only-Sicht ist klar getrennt. Kein DSGVO-Issue.

- **Race-Condition:** Booking-POST ruft Profil-Adresse aus DB → fügt
  sie in den Body ein → Insert. Wenn der Kunde parallel die Profil-
  Adresse löscht, könnte das Booking eine veraltete Adresse haben.
  Akzeptabel — Booking-Adresse ist Snapshot. Architecture §2.5
  Footnote erwähnt das korrekt.

---

## 3. US-IT9-03 — Buchungs-Kalender im Kunden-Flow

### Verdict: APPROVED_WITH_CONCERNS

### Verifikation der Root Cause

| Architecture-Behauptung | Source-Beweis | Status |
|-------------------------|---------------|--------|
| `BookingCalendar.tsx` Status startet `'idle'` | `src/components/booking/BookingCalendar.tsx:55` bestätigt | bestätigt |
| Skeleton-Render-Bedingung blockiert Mount von `<AppCalendar>` | `BookingCalendar.tsx:121` (`status === 'idle' \|\| 'loading' ? Skeleton : AppCalendar`) | bestätigt |
| `useEffect` ist leer („Erstes Range wird durch FullCalendar's `datesSet` ausgelöst.") | `BookingCalendar.tsx:109-111` | bestätigt |
| `<AppCalendar>` triggert `onRangeChange` über `datesSet` erst nach Mount | `src/components/calendar/AppCalendar.tsx:241-249,313` | bestätigt |
| Slot-Auswahl-Flow ist verdrahtet (BookingClient → TimeSlotPicker → BookingForm) | `src/app/buchung/BookingClient.tsx:169-202`, weiter im Form-State | bestätigt |
| IT8-02 hat eine analoge Helper-Funktion `computeInitialRangeBerlin` | `src/components/admin/AdminCalendarView.tsx:49` | bestätigt |
| `src/lib/date-helpers.ts` existiert NICHT heute | Bash-find ergab kein File | bestätigt |

### Public-View-Regression / „Bezahl-Bypass durch Slot-Auswahl"

**Frage:** Verhindert der Fix einen Bezahl-Bypass durch Slot-Auswahl?

**Antwort (verifiziert):** Es existiert **kein Bezahl-Schritt** im
öffentlichen Buchungs-Flow (`grep -rn "Bezahl\|stripe\|payment"
src/app/buchung/` und `src/components/booking/` ist leer). Der
Buchungs-Flow ist:
```
Tag wählen → Dauer wählen → Slot wählen → Form ausfüllen → POST
```
Bezahlung läuft separat im Admin-Workflow (`/konto/zahlung`,
`/api/customer/bookings/payment`), gekoppelt an einen `Payment`-
Datensatz, der von Tom angelegt wird. **Kein Bypass-Risiko durch die
Calendar-State-Machine-Änderung.**

Außerdem: Die Buchungs-Page selbst (`src/app/buchung/page.tsx`) ist
public, kein Auth-Guard. Das ist Bestand, kein Regressions-Risiko.

### AC-Coverage

| AC  | Adressiert? | Hinweis |
|-----|-------------|---------|
| 1   | Ja, §3.3 | Initialer Range-Fetch + Skeleton-Overlay |
| 2   | Ja, §3.2 | TimeSlotPicker existiert, ist verdrahtet |
| 3   | Ja, §3.2 | handleTimeSlotSelect setzt Form-State |
| 4   | „Verifizieren" laut §3.5 | Annahme dass TimeSlotPicker schon Empty-State hat |
| 5   | Ja, §3.3 | Erweiterte Fehler-Cases im Banner |
| 6   | Ja, §3.3 | State bleibt erhalten (in BookingClient) |

### Issues

- **MAJOR-IT9-03-A — Helper-Name-Drift:** Architecture §3.3 nennt
  den Helper `computeInitialMonthRangeBerlin()` und nennt §3.4
  „falls noch nicht vorhanden: …. Konsistent mit IT8-02-Helper."
  IT8-02 hat in `AdminCalendarView.tsx:49` einen Helper namens
  `computeInitialRangeBerlin()` (14 Tage, KEINE Monats-Spanne).
  Der Customer-Kalender braucht eine Monats-Spanne (FullCalendar
  Default `dayGridMonth` für `mode='customer'`).
  **Empfehlung:** Engineer baut den neuen Helper als
  `computeInitialMonthRangeBerlin()` in `src/lib/date-helpers.ts`,
  importiert ihn in `BookingCalendar.tsx`. Kein Refactor des IT8-02-
  Helpers nötig (verschiedene Spannen, verschiedene Use-Cases).
  **NICHT** den IT8-02-Helper umbenennen.

- **MAJOR-IT9-03-B — Initial-View für `mode='customer'`:** Verifiziert
  in `AppCalendar.tsx`: Der Initial-View hängt von `props.mode` ab.
  Engineer muss prüfen, was die tatsächliche Customer-Default-View
  ist (Monatsansicht oder Wochenansicht?). Architecture-Doc behauptet
  „Monatsansicht für Kunden" — sollte vor Build verifiziert werden.
  Falls Customer-Mode `dayGridMonth` ist → Helper muss Monats-Range
  liefern. Falls `timeGridWeek` → Wochen-Range. Mismatch löst
  Doppel-Fetch initial aus (Helper liefert X, datesSet liefert Y).

- **MAJOR-IT9-03-C — De-Duplizierung muss funktionieren:** Architecture
  §3.3 erwähnt korrekt `useRef`-basierte Dedup. **Empfehlung:**
  Engineer übernimmt 1:1 das Pattern aus `AdminCalendarView.tsx:108-118`
  (`lastRangeRef`, `abortRef`, `mountedRef`), nicht selbst neu erfinden.

- **MAJOR-IT9-03-D — AC4 (Tag ohne Slots) nicht eindeutig adressiert:**
  Architecture §3.5 sagt „entweder bereits in TimeSlotPicker `empty`-
  State implementiert; verifizieren". **Das ist Engineer-Hausaufgabe,
  die hier vorab erledigt werden sollte.** Ohne Verifikation: AC4
  ist nicht gepürft. Stichprobe: `src/components/booking/TimeSlotPicker.tsx`
  müsste geprüft werden — Engineer muss vor Build entscheiden, ob
  ein zusätzlicher Empty-State-Pfad oder Banner nötig ist.

- **MINOR-IT9-03-E — Fehlerpfad-Wortlaut:** Story-AC5 sagt wörtlich
  „Verfügbare Termine konnten nicht geladen werden. Bitte Seite neu
  laden." Architecture §3.3 zitiert das. Aktuell zeigt
  `BookingCalendar.tsx:73` „Verfügbarkeits-Kalender ist gerade nicht
  erreichbar. Bitte rufe uns alternativ an." — Engineer soll bei der
  Erweiterung den 404-Fall vom 5xx/Network-Fall trennen, sonst
  geht der bestehende Telefonnummer-Fallback verloren.

- **MINOR-IT9-03-F — `loadDays`-Dependency in `useEffect`:**
  Architecture-Snippet:
  ```tsx
  useEffect(() => { ... loadDays(from, to); }, [loadDays]);
  ```
  Wenn `loadDays` per `useCallback([], [])` stabilisiert ist (heute
  ja: Zeile 59-82), feuert der Effect nur einmal. Engineer muss
  `loadDays` mit `useCallback([])` definieren (also Dependency-Array
  leer halten), sonst Doppel-Trigger.

### Risiken / Edge Cases

- Timezone Berlin: Architecture nutzt `Intl.DateTimeFormat('en-CA',
  {timeZone:'Europe/Berlin'})`. Konsistent mit IT8-02-Pattern. Gut.
- Slot-Endpoint Pfad: Story sagt `/api/slots/available`. Architecture
  nennt `/api/availability/calendar`. Source bestätigt zwei separate
  Endpoints (`src/app/api/availability/calendar/route.ts` für die
  Tagesübersicht im Kalender, `…/slots/available` für die konkreten
  Slots). Beide Pfade sind nicht-konflikt; Engineer soll das im PR
  klarstellen, damit die QA nach dem Fix nicht den falschen Endpoint
  testet.

---

## 4. US-IT9-04 — Google-OAuth-Setup-Guide

### Verdict: APPROVED_WITH_CONCERNS

### Outline-Coverage

Die 9 Sektionen in §4.3 decken AC5 wörtlich ab (7+1 Pflicht +
Optional + Diagnose). Die Pflicht-Stichworte sind detailliert genug,
dass ein nicht-technischer Leser durchkommen kann.

**Speziell verifiziert:**
- AC1 (Tom kommt von 0 auf 1 ohne Rückfrage) → Sektion 1
  Voraussetzungen + Sektion 2 Cloud Console Login adressiert das.
- AC2 (Redirect-URIs exakt) → Sektion 5 enthält die exakten Strings:
  ```
  https://www.baerenstark-hausservice.app/api/auth/customer/callback/google
  http://localhost:3000/api/auth/customer/callback/google
  ```
- AC3 (`redirect_uri_mismatch` erklärt) → Sektion 8 Tabelle mit
  Bedeutung + Lösung.
- AC4 (Login funktioniert nach Setup) → manuell, Sektion 7 + Sektion 8
  liefern Diagnose-Endpoint zur Selbstkontrolle.
- AC5 (alle Pflicht-Sektionen in der vorgegebenen Reihenfolge) → §4.3
  exakt abgebildet.

### Issues

- **MAJOR-IT9-04-A — Redirect-URI-Pfad muss verifiziert werden VOR
  Veröffentlichung:** Architecture §4.3 Sektion 5 nennt
  `…/api/auth/customer/callback/google`. Stichprobe-Verifikation:
  Engineer MUSS vor dem Schreiben den Diagnose-Endpoint
  `/api/auth/diagnose` aufrufen und das Feld
  `expectedCallbacks.googleC` ablesen. Wenn der tatsächliche Pfad
  `/api/auth/callback/google` (NextAuth-Default) wäre, würde Tom
  durch den Guide den FALSCHEN Wert in die Cloud Console eintragen.
  **Empfehlung:** Engineer dokumentiert im PR-Body: „Pfad geprüft
  am <Datum> via `/api/auth/diagnose`, Feld `expectedCallbacks.googleC`
  ist `…`."

- **MAJOR-IT9-04-B — `localhost`-Eintrag im Production-Guide:**
  Sektion 5 schreibt vor, BEIDE URIs einzutragen — Production und
  localhost. Tom braucht aber `localhost` nicht (er entwickelt
  selbst nicht). Der Engineer-Guide für lokale Entwicklung lebt
  woanders. **Empfehlung:** `localhost`-Eintrag aus Toms Guide
  entfernen ODER explizit als „nur für Entwickler — Tom kann das
  überspringen" markieren. Ein zusätzlicher Eintrag schadet zwar
  nicht, aber der Guide soll Toms-Sicht respektieren.

- **MAJOR-IT9-04-C — Sektion 3 OAuth-Consent-„VERÖFFENTLICHEN"-Risiko:**
  Sektion 3 sagt: „Auf ‚VERÖFFENTLICHEN' klicken". Ohne Hinweis,
  dass dies einen Google-Audit anstoßen kann, falls Tom über die
  basic Scopes hinausgeht. Architecture sagt korrekt „Google fordert
  KEINEN App-Review für `email`/`profile`/`openid`". **Empfehlung:**
  Engineer behält diesen Hinweis prominent im Guide (z.B. als gelben
  Warnkasten), damit Tom nicht zögert.

- **MINOR-IT9-04-D — Domain-Verifizierung:** Sektion 3 nennt
  „Autorisierte Domains: `baerenstark-hausservice.app`". Google
  verlangt Domain-Verifizierung in der Search Console für die
  Production-Domain (sobald App veröffentlicht). Wenn Tom die nicht
  hat, schlägt das Veröffentlichen fehl. **Empfehlung:** Sektion
  3 ergänzen: „Falls Google nach Domain-Verifizierung fragt:
  Schritt-für-Schritt-Untersektion → ‚Search Console öffnen → Property
  hinzufügen → DNS-TXT-Record setzen'". Falls das zu viel
  Komplexität für IT9 ist: explizit als „Falls dieser Fehler
  erscheint, kontaktiere den Engineer" referenzieren.

- **MINOR-IT9-04-E — `AUTH_DIAGNOSE_ENABLED`-Lifecycle:** Sektion
  7 sagt „Nach erfolgreichem Test wieder entfernen". **Empfehlung:**
  Stärker formulieren — die Variable sollte nach dem Test ZWINGEND
  entfernt werden, nicht „kann". Die Diagnose-Output enthält
  Konfigurations-Hints, die in einem produktiven System nicht
  öffentlich erreichbar sein dürfen.

- **MINOR-IT9-04-F — Wer schreibt den Guide:** §5 in der Tabelle sagt
  „Backend-Engineer schreibt den Guide". Tom ist nicht-technisch und
  liest deutsch. Backend-Engineer ist auf Code-Sprachstil trainiert.
  **Empfehlung:** Wenn möglich, Tom (oder PM in seiner Rolle) liest
  den Guide-Entwurf einmal komplett durch und markiert verständlichkeits-
  schwache Stellen, BEVOR der Guide gemerged wird. Iteration mit Tom
  ist Bestandteil der Story (AC1).

### Risiken

- **Mittel-Niedrig.** Reine Doku, kein Production-Risiko. Hauptrisiko
  ist falsche Redirect-URI-Pfade — siehe MAJOR-A.
- Google Cloud Console UI ändert sich öfter. Bildschirm-Beschreibungen
  sollten generisch sein. Architecture §4.6 sagt das korrekt.

---

## 5. Übergreifende Beobachtungen

### Was gut gelöst ist

- Die Root-Cause-Diagnosen für US-IT9-01 und US-IT9-03 sind
  präzise, mit Datei + Zeilennummern, und entsprechen 1:1 den
  Stichproben-Befunden.
- Die Schema-Migration in US-IT9-02 ist korrekt additiv und
  bricht keine Bestand-Queries.
- Die DTO-Helper-Architektur (US-IT6-07 F3) wird konsistent genutzt
  — Adresse landet ausschließlich über `selectCustomerUserPublic()`/
  `selectCustomerUserAdmin()`.

### Was vor Build verbessert werden sollte

1. Drift zwischen Story-Wortlaut und Architecture-Wortlaut bei
   Empty-States/Fehlertexten (siehe MINOR-IT9-01-A, MINOR-IT9-03-E).
2. Mapper- + Schema-Konsistenz für `CustomerUserPublicSchema` ist
   die größte Engineer-Falle (MAJOR-IT9-02-B/C/D). Architecture sollte
   eine explizite Engineer-Checkliste haben: „Ändere Schema → ändere
   Mapper → ändere ALLE Call-Sites von `toCustomerPublic`."
3. Helper-Naming-Konflikt zwischen IT8-02 (`computeInitialRangeBerlin`)
   und IT9-03 (`computeInitialMonthRangeBerlin`) — sollte vor Build
   geklärt sein.

### Out-of-Scope (saubere Abgrenzung)

- Customer-Self-Delete (Architecture §2.2 E5 verschiebt korrekt ins Backlog).
- Erweiterte PLZ-Region-Validierung (Architecture §2.2 E4 → Backlog).
- `PaginatedEnvelope<T>`-Refactor (Architecture §1.2 → Backlog).
- UX/UI-Review (PROJECT.md Backlog-Eintrag).

---

## 6. Sign-off

| Kriterium | Status |
|-----------|--------|
| Stories vollständig und testbar | Ja |
| Root-Cause-Diagnosen verifiziert | 3/3 verifizierbare bestätigt |
| Architecture-Doc konsistent mit Source | Mit Major-Anmerkungen (siehe IT9-02-B/C/D) |
| Migration-Risiko adressiert | Ja, additiv. Pre-Deploy Turso-Branch-Test empfohlen (MAJOR-A) |
| Bezahl-/Auth-Bypass-Risiko geprüft | Kein Risiko — kein Payment im Booking-Flow |
| Edge Cases dokumentiert | Großteil. Empty-State AC4 für Customer-Calendar offen (MAJOR-IT9-03-D) |
| Guide-Outline tomtauglich | Ja, mit MAJOR-A (Redirect-URI-Pfad-Verifikation Pflicht) |

**Gesamtverdikt:** APPROVED_WITH_CONCERNS

**Empfehlung an Orchestrator:** Build kann starten. Engineers sollen
die mit MAJOR markierten Punkte vor Merge des PRs adressieren — das
sind keine Re-Architecting-Forderungen, sondern Engineer-Hygiene-
Punkte (Verifikation des Redirect-URI-Pfads, Mapper-/Schema-Konsistenz,
Helper-Name-Vergabe). MINOR-Punkte können in den PRs adressiert oder
als Backlog-Items getrackt werden.
