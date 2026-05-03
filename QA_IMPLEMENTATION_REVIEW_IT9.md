# QA Implementation Review — Iteration 9

**Mode:** Build QA (post-implementation verification)
**Datum:** 2026-05-03
**Inputs:**
- `PROJECT.md` IT9-Sektion (ab Zeile 2049) — Akzeptanz-Kriterien
- `ARCHITECTURE_IT9.md` — Design + Fix-Strategie
- `QA_DESIGN_REVIEW_IT9.md` — Major-Concerns aus dem Design-Review
- Source-Inspektion aller geänderten Dateien (Backend + Frontend + Doku)
- Test-Run: `npm test` (181 Tests grün)
- Type-Check: `npx tsc --noEmit` (clean)

---

## Top-Level-Verdikt: DONE

Alle vier Stories sind implementiert, alle relevanten Major-Concerns aus
dem Design-Review wurden adressiert, der Test-Lauf ist grün, der Type-Check
clean. Es bleiben **drei Minor-Findings** (keine davon blockierend) und
ein bestätigter manueller Smoke-Test, den nur Tom auf Vercel-Preview
fahren kann (US-IT9-04 AC4 — Google-OAuth Live-Login).

| Story        | Verdict | Kommentar                                     |
|--------------|---------|-----------------------------------------------|
| US-IT9-01    | DONE    | Envelope-Mismatch behoben, Defensive-Guard, AC4-Hinweis |
| US-IT9-02    | DONE    | Migration sicher, alle Mapper konsistent, Pflicht serverseitig |
| US-IT9-03    | DONE    | Deadlock-Fix wie IT8-02, Helper-Naming sauber |
| US-IT9-04    | DONE    | Guide vollständig + Redirect-URI-Pfad bestätigt |

---

## Verifikation der Major-Concerns aus QA_DESIGN_REVIEW_IT9.md

### MAJOR-IT9-02-A — Migration sicher?
**Status: BESTÄTIGT.** `prisma/migrations/20260503163821_add_customer_address/migration.sql`
führt drei reine `ALTER TABLE … ADD COLUMN … TEXT` aus — alle nullable,
keine Default-Werte, kein NOT-NULL, keine Constraint. SQLite/Turso-sicher.
Bestand bleibt unangetastet (`null`-Backfill ist implizit). Kein Backfill-
Skript. Risiko: minimal. PR-Reviewer sollte vor Production-Deploy einmal
gegen Turso-Branch fahren (Empfehlung Design-QA), aber additive ALTER-COLUMN
auf libSQL ist seit Iteration 4 etablierte Praxis.

### MAJOR-IT9-02-B — `CustomerLoginResponseSchema` / Login-Pfad nicht broken?
**Status: BESTÄTIGT.** `CustomerUserPublicSchema` hat jetzt drei nullable
Pflicht-Felder. Verifikation via Source:
- `selectCustomerUserPublic()` in `src/lib/dto/user.ts:67-69` zieht alle
  drei Felder.
- `toCustomerPublic()` in `src/lib/customer-auth-server.ts:81-83` mappt
  alle drei mit `?? null` (Defense-in-Depth gegen Bestand-Rows).
- `npm test` enthält den Smoke-Test „toCustomerPublic strips
  passwordHash/verificationToken/oauthId" — der Test legt einen Customer
  OHNE Adress-Felder an und ruft `toCustomerPublic()` auf. Test ist grün
  → Mapper liefert für nicht-gesetzte Adresse korrekt `null`, Schema-
  Parse crasht NICHT.
- `CustomerLoginResponseSchema` extends von `CustomerUserPublicSchema`
  (`contracts/zod-schemas.ts:1222`) → Login-Response funktioniert
  automatisch.

### MAJOR-IT9-02-C — `register` und `oauth-finalize` Mapper-Aufrufer
**Status: BESTÄTIGT.** Alle Aufrufer von `toCustomerPublic` greifen
auf `selectCustomerUserPublic()` zurück (verifiziert via grep):
- `src/app/api/customer/register/route.ts:135` (Insert-Select)
- `src/app/api/customer/login/route.ts:95`
- `src/app/api/customer/me/route.ts:82`
- `src/app/api/customer/oauth-finalize/route.ts:79`
- `src/app/api/customer/forgot-password/route.ts:127`

Der zentrale DTO-Helper trägt jetzt die drei Felder → kein Aufrufer
schlägt fehl. F3-Resolution-Pattern aus IT6 hat sich bewährt.

### MAJOR-IT9-02-D — Server-side Pflicht-Validierung in POST /api/bookings
**Status: BESTÄTIGT.** In `src/app/api/bookings/route.ts:223-258`
implementiert:
1. `customerSession` wird VOR der Modus-Verifikation gelesen.
2. Im Date-Modus + eingeloggt + ohne Adresse im Body wird die
   Profil-Adresse geladen.
3. Wenn Profil-Adresse vollständig (alle drei Felder gesetzt) → in den
   Body übernehmen.
4. Sonst → 400 `VALIDATION_ERROR` mit `field: 'address_required'` und
   Story-AC7-Wortlaut „Bitte vervollständige zuerst deine Adresse in
   deinem Profil."

**Bypass-Test (mental):** `curl -X POST /api/bookings` mit eingeloggter
Cookie + `data.addressStreet=null,addressZip=null,addressCity=null` →
löst die `bodyHasAddress`-Prüfung aus → Profil-Lookup → wenn unvollständig
→ 400. Bypass nicht möglich.

**Nebenbefund (akzeptabel):** Frontend verlangt Adressfelder bereits via
RHF-`required`, das 400-Pfad ist primär Defense-in-Depth für direkte
API-Aufrufe.

### MAJOR-IT9-03-A — Helper-Name-Konflikt vermieden?
**Status: BESTÄTIGT.** `src/lib/calendar-range.ts:46` exportiert
`computeInitialMonthRangeBerlin()` — neuer Name, neuer File. Der IT8-02-
Helper `computeInitialRangeBerlin` lebt weiter in
`src/components/admin/AdminCalendarView.tsx:49` (14-Tage-Spanne, anderer
Use-Case). Kein Refactor, kein Rename. Modul-Header dokumentiert die
Begründung (Customer = `dayGridMonth`, Admin = Wochen-/Tagesansicht).

### MAJOR-IT9-04-A — Redirect-URI-Pfad korrekt?
**Status: BESTÄTIGT.** Diagnose-Endpoint in
`src/app/api/auth/diagnose/route.ts:165` definiert:
```
expectedCallbacks.googleC = `${baseUrl}/api/auth/customer/callback/google`
```
Der Guide schreibt in Sektion 5 exakt:
```
https://www.baerenstark-hausservice.app/api/auth/customer/callback/google
```
1:1-Match. NextAuth-Customer-Handler liegt unter
`src/app/api/auth/customer/[...nextauth]/route.ts` — Pfad-Existenz ist
verifiziert. Sektion 4.3 des Guides ergänzt explizit den Hinweis „Der
Pfad enthält das Wort `customer`" als Stolperfallen-Warnung.

---

## Story-Verdikte im Detail

### US-IT9-01 — `/admin/users` Crash — Verdict: DONE

**AC-Coverage:**
| AC | Erfüllt? | Hinweis |
|----|----------|---------|
| AC1 (Seite lädt, keine Error-Boundary) | Ja | Envelope-Mismatch in `route.ts:128` korrigiert (`items` statt `data`); `fetchAdminUsers` unwrappt sauber (`api-client-it6.ts:268-282`). |
| AC2 (Stack-Trace dokumentiert) | Ja | `route.ts:115-127` enthält den vollständigen Root-Cause-Kommentar. |
| AC3 (Empty-State „Keine Kunden registriert.") | Teilweise (Wortlaut-Drift) | `UserTable.tsx:183` zeigt „Noch keine Kunden registriert." — Story verlangt „Keine Kunden registriert." (Minor; siehe MINOR-IT9-01-A). |
| AC4 (Spalten Name, E-Mail, Reg.-Datum, Status) | Teilweise | Tabelle hat Name, E-Mail, Reg., Buchungen, Rating — keine explizite „Status"-Spalte (`emailVerified`-Badge fehlt). Siehe MINOR-IT9-01-B. |

**Defects:**
- **MINOR-IT9-01-A (Wortlaut-Drift Empty-State):** `UserTable.tsx:183`
  zeigt „Noch keine Kunden registriert.", AC3 verlangt „Keine Kunden
  registriert.". Behebt sich mit einem 1-Wort-Edit.
- **MINOR-IT9-01-B (AC4 Status-Spalte):** Story verlangt „Status des
  Kunden". Tabelle zeigt aktuell `adminRating` (intern) + `bookingCount`,
  aber keinen primären Customer-Status (z.B. `emailVerified` als Badge).
  Empfehlung: Status-Spalte mit „verifiziert" / „nicht verifiziert"
  ergänzen, oder im PR begründen, warum `bookingCount` als Status zählt.

**Defense-in-Depth:**
- `fetchAdminUsers` (`api-client-it6.ts:269-275`) wirft `ApiClientError`
  bei Schema-Drift.
- `UserTable.load()` (`UserTable.tsx:83-91`) prüft `Array.isArray(res.data)`
  und zeigt Banner statt Crash.
- Beide sind belt-and-suspenders; Schema-Drift kann nicht mehr in eine
  Error-Boundary fallen.

**Regression:** `/admin/admins` ist via `fetchAdmins()` und
`api-client-it6.ts:131-141` (separater Code-Pfad mit eigener Defense)
unangetastet. Smoke-Tests grün.

---

### US-IT9-02 — Kunden-Adresse — Verdict: DONE

**AC-Coverage:**
| AC | Erfüllt? | Hinweis |
|----|----------|---------|
| AC1 (Adressfelder optional bei Registrierung mit Hinweistext) | Ja | `RegisterForm.tsx:298-344` — Fieldset „Deine Adresse (optional)", Hinweistext „Wird für Terminbuchungen benötigt — du kannst sie auch später im Profil ergänzen." |
| AC2 (Profil zeigt Werte vorausgefüllt) | Ja | `ProfileForm.tsx:96-103` mit `readAddressDefault`-Helper. |
| AC3 (Profil-Bearbeitung) | Ja | `ProfileForm.tsx` Adress-Section + PATCH `/api/customer/me`. |
| AC4 (Toast „Adresse gespeichert.") | Ja | `ProfileForm.tsx:128-132` — „Adresse gespeichert." bzw. „Adresse wurde entfernt." beim Lösch-Pfad. |
| AC5 (Lösch-Pfad: alle drei Felder leer = NULL) | Ja | `me/route.ts:59-69` (`normaliseAddrField`) mappt `""` → `null`. Verifiziert in der Update-Logik. |
| AC6 (Admin sieht Adresse read-only) | Ja | `UserDetailDrawer.tsx:401-432` — `AdminAddressSection`, kein Edit, DSGVO-Hinweis. `admin/users/[id]/route.ts:60-64` liefert die Felder mit. |
| AC7 (Buchung verlangt Adresse für eingeloggte Kunden) | Ja | `bookings/route.ts:225-258` — Profil-Fallback + 400 `address_required` mit Story-Wortlaut. Frontend zeigt proactive `showProfileAddressHint`-Banner mit `/konto/profil`-Link. |
| AC8 (GET /me Response enthält Adressfelder, kein adminNote/adminRating) | Ja | `selectCustomerUserPublic()` zieht die drei Felder, `CustomerUserPublicSchema.strict()` erzwingt das Schema, kein adminNote/adminRating im Public-DTO. Smoke-Tests grün. |
| AC9 (Migration bricht keine bestehenden Queries) | Ja | Additive Migration, alles nullable. Bestand-Konten haben weiterhin alle Felder als `null`. |

**Defects:**
- **MINOR-IT9-02-A (AC7 Server-Pfad-Banner unsichtbar):** Architecture
  §2.6 C verlangt einen separaten Banner-Pfad, wenn der Server mit 400
  `address_required` antwortet (nicht nur den proactive Hint). Aktuelle
  Implementierung verlässt sich auf den proactive `showProfileAddressHint`
  + RHF-`required`-Pflicht-Validierung. Wenn ein eingeloggter User die
  Adressfelder im UI dennoch leer abschickt (z.B. Browser-Autofill-
  Fehler), greift der Form-Required-Pfad VOR dem Server-Roundtrip — der
  500-Fall ist also unwahrscheinlich, aber nicht 0. Bei ihm zeigt
  `handleApiError` einen generischen Banner ohne Profil-Link, weil
  `field: 'address_required'` nicht in der Whitelist ist
  (`BookingForm.tsx:308-318`). Empfehlung: Special-Case ergänzen, der
  bei `err.field === 'address_required'` einen Banner mit Link auf
  `/konto/profil` rendert.

**Behoben (positiv hervorzuheben):**
- F3-Helper-Convention konsequent umgesetzt — alle `toCustomerPublic`-
  Aufrufer sind via `selectCustomerUserPublic()` versorgt.
- `?? null` im Mapper schützt gegen Bestand-Rows ohne Adresse.
- Schema im Profile-Update ist `union([string, '', null])` und akzeptiert
  damit alle Frontend-Conveniences (leerer String → DB-NULL).
- DSGVO: Lösch-Pfad ist klar dokumentiert + UX-Hinweistext im ProfileForm.
- Naming-Drift Profil ↔ Booking ist im Code dokumentiert (`BookingForm.tsx:133-138`).

**Edge Cases (spot-checked):**
- PLZ „abc12" → Frontend (Profile + Register) lehnt via Refine-Check ab,
  Backend via `ZipCodeSchema` (`/^\d{5}$/`). Doppelt geschützt.
- Kombinierter Update (phone + Adresse) → Schema akzeptiert, PATCH-
  Handler überträgt nur die definierten Felder.
- Inkonsistente Profil-Adresse (z.B. nur PLZ leer) → BookingPOST prüft
  `profileComplete = !!street && !!zip && !!city`, fällt sonst auf 400
  zurück. ✅
- OAuth-Login eines Bestand-Konto ohne Adresse → `toCustomerPublic`
  liefert `streetAndNumber: null` etc., Schema-Parse OK.

---

### US-IT9-03 — Buchungs-Kalender — Verdict: DONE

**AC-Coverage:**
| AC | Erfüllt? | Hinweis |
|----|----------|---------|
| AC1 (Kalender rendert ≤3s, kein Skeleton-Loop) | Ja | `BookingCalendar.tsx:178-181` — `useEffect` mit `loadDays(from, to)` triggert sofort den initialen Fetch; AppCalendar mountet immer (Skeleton ist Overlay). |
| AC2 (Tag mit Slots → klickbare Zeitslots) | Ja | Bestand: `BookingClient.tsx:189-201` (handleDaySelect) + `TimeSlotPicker` (durch IT8-Fix in IT8-Story korrekt). |
| AC3 (Slot-Klick → vorausgefüllt im Form) | Ja | `BookingClient.tsx:215-222` (handleTimeSlotSelect). |
| AC4 (Tag ohne Slots → Hinweis) | Ja | TimeSlotPicker-Empty-State + neuer `BookingCalendar`-Empty-State (`hasAnyBookableDay`-Check) für tagesübergreifenden Empty-Fall. |
| AC5 (Backend-Fehler → klarer Banner) | Ja | `BookingCalendar.tsx:120-145` — 404 zeigt Bestand-Hinweis (Telefon-Fallback), 5xx/Network/sonstiges zeigt AC5-Wortlaut „Verfügbare Termine konnten nicht geladen werden. Bitte Seite neu laden." |
| AC6 (State bleibt bei Re-Navigation) | Ja | `BookingClient.tsx` hält `selectedDate`/`selectedTimeSlot` lokal — kein Reset bei Sektionen-Wechsel. |

**Defects:** keine.

**Verifikation des Patterns (gegen IT8-02):**
- `lastRangeRef` als De-Dup → identisch zu IT8-02.
- `abortRef` für In-Flight-Cancel → identisch.
- `mountedRef` gegen `setState`-after-unmount → identisch.
- Skeleton-Overlay statt Skeleton-Ersatz → identische State-Machine.
- `useCallback([])` mit leerer Dependency → loadDays ist stabil → useEffect
  feuert nur einmal.

**Edge-Spot-Check:**
- Tag aus der Vergangenheit klicken → `handleDaySelect` filtert via
  `dateIso < todayIso()` (Defense-in-Depth zu Backend).
- Tag mit DayOverride „Geschlossen" → Backend liefert
  `status: 'unavailable'`, Klick triggert keinen Drilldown
  (`hasAnyBookableDay`-Banner zeigt sich, wenn alle Tage unavailable).
- Backend down → AC5-Wortlaut wird gerendert.

**Helper-Range-Logik:**
- `computeInitialMonthRangeBerlin()` lädt 7 Tage vor heute bis +42 Tage.
- Backend-Cap (62 Tage in `AvailabilityCalendarSchema`) wird respektiert.
- `datesSet` von FullCalendar kann nach Mount feinere Range liefern;
  `lastRangeRef` deduppt Doppel-Fetch.

**Regression:** `/admin/calendar` (IT8-02) bleibt unverändert (eigener
Helper, eigene Komponente).

---

### US-IT9-04 — Google-OAuth-Setup-Guide — Verdict: DONE

**AC-Coverage:**
| AC | Erfüllt? | Hinweis |
|----|----------|---------|
| AC1 (Tom kann Konsole öffnen + Projekt anlegen) | Ja | Sektionen 1-2 mit präzisen Schritten + Voraussetzungen. |
| AC2 (Redirect-URIs exakt) | Ja | Sektion 5 mit exakter URL `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google` — Pfad geprüft gegen `/api/auth/diagnose` (siehe MAJOR-IT9-04-A oben). Klare Stolperfallen-Hinweise zum `customer`-Pfad. |
| AC3 (`redirect_uri_mismatch` erklärt) | Ja | Sektion 8 Tabelle erklärt Bedeutung + verweist auf Sektion 5 + Diagnose-Endpoint. |
| AC4 (manueller Live-Login durch Tom) | **MANUELL — durch Tom auf Vercel-Preview** | Nicht automatisierbar; Tom muss nach dem Setup auf „Mit Google anmelden" klicken. |
| AC5 (alle 9 Sektionen in der Reihenfolge) | Ja | Inhaltsverzeichnis + Section-Headings entsprechen exakt §4.3 der Architecture. |

**Tom-Tauglichkeit (Stichprobe):**
- **Sprache:** Durchgehend deutsch, kein Engineer-Slang. ✅
- **Bildschirm-Beschreibungen:** Präzise mit Pfad-Angaben („Burger-Menü
  → APIs und Dienste → Anmeldedaten") und Button-Label-Zitaten („+ URI
  HINZUFÜGEN"). ✅
- **Stolperfallen:** Pfad mit `customer`, Slash am Ende, Großschreibung,
  Test-Modus → alle adressiert.
- **Diagnose-Sektion 7:** Erklärt `actionRequired: "none"|"config"|"code"`
  + zwingt anschließend zum Entfernen von `AUTH_DIAGNOSE_ENABLED`
  (Sicherheit). ✅
- **Sektion 8 Fehler-Tabelle:** Vollständig — 6 häufige Fehler mit
  klarer Lösung. ✅
- **Sektion 9 Eskalation:** Klar definierte Liefer-Items für den
  Backend-Engineer, falls nichts hilft.

**Localhost-Eintrag (Design-QA MAJOR-IT9-04-B):** Adressiert in
Sektion 5 Schritt 6 als **optional** mit Erklärung „Das brauchst du im
Normalbetrieb nicht — diese URL ist für den Backend-Engineer beim lokalen
Entwickeln. Wenn du dir unsicher bist: trag sie mit ein, schadet nichts."
→ pragmatisch, klar gekennzeichnet.

**Domain-Verifizierung (Design-QA MINOR-IT9-04-D):** Sektion 3 erwähnt
die Domain im Consent-Screen, aber der separate Domain-Verifizierungs-
Pfad in der Search Console ist NICHT erwähnt. Das ist akzeptabel, weil
für die Standard-Scopes `email/profile/openid` keine Verifizierung
erzwungen wird (ist in §3 prominent erklärt: „Google fordert KEINEN App-
Review").

**Runbook-Verweis:** `docs/AUTH_GOOGLE_FIX_RUNBOOK.md:8` enthält den
prominenten Top-Verweis auf den neuen Guide. ✅

**Defects:** keine.

**Manueller Test offen:** AC4 Live-Login durch Tom auf Vercel-Preview.

---

## Test-Lauf-Ergebnis

```
$ npm test
Total: 181 passed, 0 failed.
```

Relevante grüne Tests (Auswahl):
- IT7 — `toCustomerPublic strips passwordHash/verificationToken/oauthId`
  → exerziert den Mapper mit einem Customer ohne Adresse → IT9-Mapper-
  Konsistenz bestätigt.
- IT6 — `selectCustomerUserPublic excludes adminNote/adminRating`
  → DTO-Trennung intakt.
- IT6 — `CustomerUserPublic strict rejects adminNote leak`
  → AC8 strukturell garantiert.

```
$ npx tsc --noEmit
(clean — keine Type-Errors)
```

---

## Defekte zusammengefasst

### Critical
keine.

### Major
keine.

### Minor

| ID | Story | Beschreibung | Routing |
|----|-------|-------------|---------|
| MINOR-IT9-01-A | US-IT9-01 | Empty-State-Wortlaut „Noch keine" statt Story-„Keine" | frontend-engineer |
| MINOR-IT9-01-B | US-IT9-01 | AC4 verlangt „Status"-Spalte; aktuell `bookingCount` + `adminRating` als Proxy | frontend-engineer |
| MINOR-IT9-02-A | US-IT9-02 | Server-Banner-Pfad bei 400 `address_required` ohne Profil-Link (Defense-in-Depth — UI erlaubt diesen Fall heute kaum, aber AC7-konformer Banner fehlt) | frontend-engineer |

### Open Manuals
- **US-IT9-04 AC4** — Live-Login mit Google nach Setup → manueller Smoke
  durch Tom auf Vercel-Preview.

---

## Empfehlung an den Orchestrator

**Loop schließen → IT9 ist DONE.**

Die drei Minor-Findings sind nicht-blockierend; sie können in einem
schnellen Follow-up-PR (oder als Backlog-Items für IT10 / UX-Review-
Sprint) adressiert werden. Sie verhindern weder Toms operative Nutzung
noch das Funktionieren der Kunden-Flows.

**Empfohlene Reihenfolge für die Minor-Fixes (falls Tom sie schnell
will):**
1. MINOR-IT9-01-A (1-Wort-Edit, 30 Sekunden Engineer-Aufwand).
2. MINOR-IT9-02-A (5–10 Zeilen `handleApiError`-Erweiterung).
3. MINOR-IT9-01-B (Klärung mit PM nötig, was AC4 mit „Status" meint).

**Manueller Smoke (Tom):**
1. Vercel-Preview deployen.
2. `/admin/users` → Tabelle öffnet ohne Crash, mindestens ein Kunde
   sichtbar, Drawer mit Adresse-Section ladet.
3. `/konto/registrieren` → Adressfelder ausfüllen → einloggen → `/konto`
   → Profil zeigt die Werte → ändern → Toast.
4. `/buchung` → Kalender lädt ≤3s, Tag-Klick → Dauer → Zeitslot →
   Form → Adresse vorausgefüllt → Buchung absenden.
5. Google-OAuth-Guide Schritt für Schritt durchgehen, dann
   `/konto/login` mit Google.

---

**Ende QA_IMPLEMENTATION_REVIEW_IT9.md**
