# QA_DESIGN_REVIEW_IT8.md

**Mode:** Design QA (Pre-Build, vor Phase 3)
**Datum:** 2026-05-03
**Reviewer:** QA-Engineer
**Reviewed Artefakte:**
- `PROJECT.md` §"Iteration 8" (Zeilen 1770–2049, 5 Stories)
- `ARCHITECTURE_IT8.md` (Root-Cause-Analyse + Fix-Strategien)
- Stichproben aus `src/`: `api/admin/admins/route.ts`, `lib/api.ts`,
  `lib/api-client-it6.ts`, `lib/api-client.ts`, `components/admin/admins/*.tsx`,
  `components/admin/AdminCalendarView.tsx`, `components/admin/AdminSlotManager.tsx`,
  `components/admin/SlotForm.tsx`, `components/admin/DayOverrideManager.tsx`,
  `app/api/slots/route.ts`, `app/api/admin/day-overrides/route.ts`,
  `app/api/auth/diagnose/route.ts`, `app/admin/admins/page.tsx`.

---

## 0. Executive Summary

| Story | Verdict | Severity der Restbefunde |
|-------|---------|--------------------------|
| US-IT8-01 | **APPROVED_WITH_CONCERNS** | 1× Major, 2× Minor |
| US-IT8-02 | **APPROVED_WITH_CONCERNS** | 1× Major, 1× Minor |
| US-IT8-03 | **APPROVED_WITH_CONCERNS** | 1× Major, 2× Minor |
| US-IT8-04 | **APPROVED_WITH_CONCERNS** | 2× Minor |
| US-IT8-05 | **APPROVED_WITH_CONCERNS** | 1× Major, 1× Minor |

**Top-Level-Verdikt:** **APPROVED_WITH_CONCERNS — go für Phase 3.**

Alle fünf Root-Cause-Analysen sind via Code-Inspektion verifiziert und die
Fix-Strategien adressieren die ACs vollständig. Die unten gelisteten
Major-Befunde sind keine Blocker, sondern Lücken in der Fix-Spezifikation,
die der Engineer beim Bauen oder spätestens im QA-Smoketest schließen kann.
Es ist nicht erforderlich, dass der Architekt nochmal nachbessert; jedoch
sollten die Major-Befunde explizit in die Build-Tickets aufgenommen werden,
damit sie nicht im Implementierungs-Sprint vergessen werden.

---

## 1. US-IT8-01 — Admin-Verwaltungsseite Crash

### Verdict: **APPROVED_WITH_CONCERNS**

### Begründung

Root Cause durch eigene Code-Inspektion verifiziert:
- `src/app/api/admin/admins/route.ts:68-71` ruft tatsächlich `apiSuccess({data: …, total: …})`.
- `src/lib/api.ts:110-118` umhüllt mit zusätzlichem `{ data }` → Response-Body
  ist `{ data: { data: AdminListItem[], total: number } }`.
- `src/lib/api-client-it6.ts:119-121` typisiert die Response als
  `AdminListResponse` und gibt sie unverändert zurück.
- `src/components/admin/admins/AdminUserTable.tsx:60-61` ruft `setAdmins(res.data)` —
  was bei der doppelten Verschachtelung das Objekt `{ data: [...], total: N }`
  setzt, **kein Array**. `admins.filter(...)` in Zeile 84 wirft `TypeError`.

Das Fix-Pattern (Variante A: Backend liefert `apiSuccess(array)`, FE-Client
mappt auf `{ data, total }` — symmetrisch zu `createAdmin`/`updateAdmin`)
ist sauber und konsistent mit der etablierten `DataEnvelope<T>`-Konvention.

Defense-in-Depth-Maßnahmen (Error-Boundary, `Array.isArray`-Guard) sind
sinnvoll und adressieren AC2 + AC3.

Es wurde geprüft, ob es **weitere** TypeError-Quellen auf der Seite gibt:
- `CreateAdminDialog` und `EditAdminDialog` nutzen `createAdmin`/`updateAdmin`
  die `DataEnvelope<AdminListItem>` korrekt entpacken (`return res.data`).
  → **Kein zweiter Bug.**
- `AdminUserTable.activeCount`, `admins.map`, `admins.length` sind alle
  Folgeschäden desselben Bugs — Fix der Root Cause behebt alle.

### Issues

#### BUG-IT8-01-A — Major: Server-Fehler-Behandlung des `internalError`-Falls nicht in Test-Hooks

- **Layer:** Spec/Test
- **Beschreibung:** `route.ts:73` ruft bei DB-Fehler `internalError(err)`. In
  `AdminUserTable.load()` Zeile 64–76 wird der ApiClientError gefangen und in
  `setStatus('error') + Banner` umgesetzt. Die Architektur sagt zwar Error-Boundary
  als zusätzliche Sicherung, **aber:** Der häufigste Fall (Backend wirft 500)
  führt schon heute nicht zur weißen Seite. Test-Hook §1.4 ("Seite mit künstlich
  provoziertem 500er") überprüft die Error-Boundary, nicht den existierenden
  Banner-Pfad. Der Engineer könnte den Eindruck bekommen, dass der Banner-Pfad
  gar nicht funktioniert und die Error-Boundary der einzige Schutz ist.
- **Fix-Empfehlung:** Test-Hook ergänzen: "Bei DB-Stop zeigt der Banner-Fehler
  `Admins konnten nicht geladen werden.` — die Error-Boundary fängt nur
  unbehandelte Render-Exceptions, nicht behandelte Fetch-Fehler."

#### BUG-IT8-01-B — Minor: Vertragsänderung unterbricht zukünftige Konsumenten

- **Layer:** Backend / Vertrag
- **Beschreibung:** Wenn jemals ein Skript oder ein zweiter FE-Client die
  Route `/api/admin/admins` mit dem alten Schema (`res.data.data`, `res.data.total`)
  liest, brechen sie still mit dem Variante-A-Fix. Die Architektur erwähnt das
  Risiko in §1.5, aber nur für den FE-Client. Es gibt keinen `grep`-Beleg, dass
  außer `fetchAdmins()` niemand sonst die Route konsumiert.
- **Fix-Empfehlung:** Engineer macht vor dem Fix einen `rg "admin/admins"
  src/ scripts/ tests/`, um sicherzustellen, dass es keinen weiteren Konsumenten
  gibt. Falls doch, mitanpassen.

#### BUG-IT8-01-C — Minor: Architektur überschätzt Schutz durch Error-Boundary

- **Layer:** Spec
- **Beschreibung:** `app/admin/error.tsx` fängt nur Errors aus dem
  **Server-Component**-Render von `app/admin/**` und Errors der
  Client-Components, die *während des Renders* geworfen werden.
  `admins.filter is not a function` wird im Render-Pfad geworfen → wird
  gefangen — gut. Aber: Die Boundary wird in der Architektur als
  "fängt zukünftige unerwartete Crashes ab" beschrieben, das gilt nur für
  Render-Pfade. Async-Errors aus `useEffect` ohne `try/catch` werden NICHT
  gefangen.
- **Fix-Empfehlung:** Hinweis in §1.2 ergänzen, dass die Boundary keine
  unbehandelten Promise-Rejections fängt. Engineer prüft beim Bauen auf
  fehlende `try/catch` in async useEffect-Funktionen (im aktuellen Code
  ist `load()` korrekt umschlossen).

### Edge Cases — abgedeckt? — JA, aber:

- ✅ Empty State: `admins.length === 0` zeigt "Noch keine Admins vorhanden."
  (AC1 wird erfüllt — bestehender Code).
- ✅ Error-State via Banner (AC2).
- ✅ Console keine TypeErrors nach Fix (AC3).
- ⚠️ AC4 (`next build` ohne Fehler): Nicht direkt durch Fix-Strategie adressiert.
  Da Fix nur Laufzeit-Verhalten ändert (Schema-Form), bleibt der Build grün —
  außer die TypeScript-Typen für `AdminListResponse` werden inkonsistent.
  Engineer muss sicherstellen, dass `AdminListResponse.data: AdminListItem[]`
  bleibt (intern), aber die HTTP-Response auf `DataEnvelope<AdminListItem[]>`
  umgestellt wird. Spezifikation §1.2 ist hier präzise — kein Defekt, aber
  ein Stolperstein.

### Risiken/Regressionen außerhalb der Architektur-Liste

- **Keine** weiteren signifikanten Risiken erkannt.

---

## 2. US-IT8-02 — Admin-Kalender rendert nicht

### Verdict: **APPROVED_WITH_CONCERNS**

### Begründung

State-Machine-Deadlock verifiziert: `AdminCalendarView.tsx:215-225` rendert
`<AppCalendar>` nur wenn `status !== 'idle' && status !== 'loading'`. Der
einzige Code-Pfad nach `'ready'` ist `loadEvents()` in der `handleRangeChange`-
Callback (Zeile 88-96), die per `onRangeChange`-Prop an `<AppCalendar>` übergeben
wird. Da `<AppCalendar>` nie gemountet wird, wird `onRangeChange` nie gefeuert,
`status` bleibt `'idle'` — Deadlock. Bestätigt.

Variante (3) der Fix-Strategie (initialer manueller `loadEvents`-Trigger im
`useEffect`) ist die robusteste Wahl und korrekt empfohlen.

### Issues

#### BUG-IT8-02-A — Major: De-Duplizierungs-Strategie für initialen Fetch unspezifiziert

- **Layer:** Spec / Frontend
- **Beschreibung:** Architektur §2.5 erwähnt Risiko "doppeltes Range-Fetching
  (initial + erstes `datesSet`)" und schlägt `useRef` auf letzten Range vor.
  Das ist aber NICHT verbindlich in §2.2 spezifiziert — der Engineer könnte
  nur die `useEffect`-Variante implementieren und das `useRef`-Pattern
  vergessen. Folge: Beim Page-Load würde `loadEvents` 2× hintereinander
  laufen (initial + `datesSet`), was unter Last zu Race-Conditions führen
  kann (zweiter Fetch könnte `setEvents` mit einem älteren Result überschreiben,
  wenn die Responses out-of-order ankommen).
- **Fix-Empfehlung:** §2.2 muss explizit fordern: (a) `useRef<{from, to}>`
  zum Tracking des letzten Range, (b) `loadEvents` macht early-return, wenn
  `from`/`to` sich nicht geändert haben. Alternativ: AbortController, der
  laufende Fetches beim nächsten `loadEvents` abbricht — der Code-Stand hat
  bereits `signal?: AbortSignal` im `fetchAdminCalendarEvents`-Setup, aber
  `loadEvents` benutzt es nicht.

#### BUG-IT8-02-B — Minor: AC4 (CSS-Asset-Network-Check) nicht direkt durch Fix-Strategie adressiert

- **Layer:** Spec
- **Beschreibung:** AC4 verlangt Browser-DevTools Network: CSS-Assets HTTP 200.
  Architektur §2.1 sagt: "FullCalendar v6.1.20 injiziert CSS zur Laufzeit selbst,
  ein expliziter CSS-Import wäre nicht nötig." Damit wird AC4 *trivialerweise
  erfüllt* (es gibt keine CSS-Assets als separate HTTP-Calls), aber die
  Architektur spricht das nicht explizit an. Engineer könnte verwirrt sein,
  wenn er im Network-Tab keinen CSS-Request sieht.
- **Fix-Empfehlung:** §2.4 ergänzen: "AC4 ist ein Rest-Smoke-Test — falls
  FullCalendar v6.1.20 nicht alle Styles injiziert (was sehr unwahrscheinlich
  ist), muss zusätzlich `import '@fullcalendar/core/...'` ergänzt werden."

### Edge Cases — abgedeckt?

- ✅ AC1 (Kalender immer sichtbar, auch ohne Buchungen): Variante 3 macht das.
- ✅ AC2 (Buchungen erscheinen): unverändertes `loadEvents`-Verhalten.
- ✅ AC3 (leeres Raster bei keinen Buchungen): Direkt aus AC1.
- ✅ AC4 (CSS-Assets HTTP 200): Trivialerweise OK (s.o.).
- ⚠️ Fehlerfall: Wenn `loadEvents` fehlschlägt, bleibt `status === 'error'` —
  und nach Fix wird dann `<AppCalendar>` mit `events=[]` gerendert PLUS
  Banner-Fehler. Das ist ein neues Verhalten, das die Architektur nicht explizit
  beschreibt. Akzeptabel, weil es UX-konform ist (User sieht Raster + Fehlermeldung
  statt nur Skeleton + Fehler).

### Risiken/Regressionen außerhalb der Architektur-Liste

- **Mittel:** Race-Condition durch Doppel-Fetch (siehe BUG-IT8-02-A) — sollte
  vor Build geklärt werden.

---

## 3. US-IT8-03 — Zeitfenster nach Save nicht in Liste

### Verdict: **APPROVED_WITH_CONCERNS**

### Begründung

Root Cause verifiziert:
- `src/app/api/slots/route.ts:33-38`: `from = now()`, `to = now() + 90d`,
  WHERE `startsAt: { gte: from }`. Bestätigt.
- `src/components/admin/SlotForm.tsx:21-28`: `combineToIso` nutzt
  `new Date('YYYY-MM-DDTHH:MM')` — Browser-Local-Time-Interpretation.
  Konsequenz: Tom in Berlin gibt "heute 09:00" ein → `startsAt` ist
  09:00 Berlin = 07:00Z UTC. Wenn er um 14:30 Berlin Zeit speichert,
  ist `now()` = 12:30Z UTC. `startsAt (07:00Z) >= from (12:30Z)` ist
  **false** → Slot wird ausgefiltert. Root-Cause-Analyse bestätigt.

Variante A (Default-`from` auf "heute 00:00 Berlin") + Variante B
(Frontend übergibt explizit `from`) ist robust und reduziert Server-Client-Drift.

### Issues

#### BUG-IT8-03-A — Major: Public-View-Regression nicht ausreichend gemitigated

- **Layer:** Backend / Public-View
- **Beschreibung:** Architektur §3.6 erwähnt Risiko, dass die Public-View
  ("/buchen") nach Variante A *theoretisch* verstrichene Slots zeigt
  ("heutige Vormittag-Slots"). Die Mitigation ist: "Buchungs-Endpoint lehnt
  sie sowieso ab." **ABER:** Das ist eine Verschlechterung der UX —
  Customer sehen einen Slot, klicken drauf, bekommen Fehlermeldung. Architektur
  sagt zwar "UI kann optional auf Customer-Seite zusätzlich filtern", aber
  spezifiziert das nicht als Pflicht.
- **Fix-Empfehlung:** Es gibt zwei saubere Wege:
  1. **Server-Seite verzweigen:** GET-Endpoint erkennt Admin-Session
     (`auth()` aufrufen wie in POST). Wenn Admin → Default-`from` ist
     "heute 00:00". Wenn nicht → Default-`from` ist `now()`. Damit ist
     Public-Verhalten unverändert.
  2. **Variante B alleinstehend (Architektur Variante B):** Public-FE-Client
     übergibt explizit `from=now()`, Admin-FE übergibt `from=startOfTodayBerlin()`.
     Backend-Default bleibt `now()`. Empfohlen, weil keine Auth-Logik im GET.

  Empfehlung: **Variante B alleinstehend** (Variante A weglassen). Das ist
  weniger invasiv und vermeidet Public-View-Regression komplett.

#### BUG-IT8-03-B — Minor: AC4 ("genau ein GET nach POST") nicht durch Fix-Strategie validiert

- **Layer:** Spec / Frontend
- **Beschreibung:** AC4 verlangt: nach POST 200/201 wird **exakt ein** GET ausgelöst.
  Architektur §3.4 sagt: "Frontend-State-Reload ist nicht der Bug" — also
  unverändert. `AdminSlotManager.tsx:35` ruft `<SlotForm onCreated={load} />`,
  `load()` ist die einzige Re-Fetch-Quelle. Das stimmt aktuell. **ABER:** Wenn
  Engineer im Rahmen von US-IT8-02-Lerneffekt (Race-Conditions) in
  `AdminSlotManager` einen ähnlichen Pattern einbaut wie in `AdminCalendarView`,
  könnte das brechen. Test-Hook §3.5 prüft das nicht.
- **Fix-Empfehlung:** Test-Hook ergänzen: "Im Network-Tab sollte nach
  Slot-anlegen genau ein GET `/api/slots` erscheinen (nicht 0, nicht 2)."

#### BUG-IT8-03-C — Minor: `endsAt`-Filter nicht erwähnt

- **Layer:** Backend / Spec
- **Beschreibung:** Der Bug ist bei `startsAt: { gte: from }`. Aber der WHERE
  hat auch `lte: to` — Slots, deren `startsAt` nach `to` liegt, werden
  ausgefiltert. Das ist nicht der gemeldete Bug, aber es bedeutet: Wenn Tom
  einen Slot für 91 Tage in der Zukunft anlegt, sieht er ihn auch nicht
  in der Liste. Die Architektur erwähnt das nicht. Variante B (Frontend
  übergibt expliziten Range) gibt dem Engineer die Möglichkeit, `to=180d`
  zu setzen — was die Architektur in §3.2-Variante-B explizit empfiehlt
  ("`to: in180dIso`"). Gut.
- **Fix-Empfehlung:** Engineer muss sicherstellen, dass die Frontend-Range
  in der Praxis breit genug ist — Architektur sagt `180d`, das sollte als
  Konstante (nicht Magic Number) festgelegt werden.

### Edge Cases — abgedeckt?

- ✅ AC1 (sofortiges Erscheinen ohne Reload): Fix erfüllt das.
- ✅ AC2 (F5 → Slot weiterhin sichtbar): Persistenz unverändert.
- ✅ AC3 (Persistenz-Check vor Code-Fix): explizit als Pflicht-Schritt.
- ⚠️ AC4 (genau ein GET): siehe BUG-IT8-03-B.
- ⚠️ Tom-Vormittag-Pflege-Edge-Case: korrekt adressiert.
- ❓ Was passiert, wenn Tom einen Slot für **gestern** anlegt? Zod-Schema
  `CreateSlotSchema` müsste das ablehnen — wenn nicht, würde Variante A das
  Problem nicht lösen (gestern liegt vor "heute 00:00 Berlin"). Architektur
  spricht das nicht an. Engineer sollte beim Persistenz-Check (AC3) auch
  `CreateSlotSchema` lesen, um zu wissen, ob Vergangenheits-Slots überhaupt
  validiert werden.

### Risiken/Regressionen außerhalb der Architektur-Liste

- **Mittel:** Public-View-Regression (siehe BUG-IT8-03-A). Empfehlung
  Variante B alleinstehend.

---

## 4. US-IT8-04 — DayOverride-Liste vollständig sichtbar

### Verdict: **APPROVED_WITH_CONCERNS**

### Begründung

Root Cause verifiziert: `DayOverrideManager.tsx:71-88` ruft
`fetchDayOverrides(monthString)`. `app/api/admin/day-overrides/route.ts:50-86`
unterstützt nur `?month=`-Filter (Zod-Schema `DayOverrideMonthQuerySchema`).
Liste ist auf einen Monat begrenzt. Bestätigt.

Fix-Strategie (additive `?scope=all`-Erweiterung + UI-Umbau auf
chronologische Gesamtliste mit Past-Markierung) ist sauber, rückwärtskompatibel
und adressiert alle ACs.

### Issues

#### BUG-IT8-04-A — Minor: AC4 (sofortige Aktualisierung nach Anlegen) hat doppelte Verantwortung

- **Layer:** Spec
- **Beschreibung:** AC4 verlangt "neuer Eintrag erscheint sofort in der Liste"
  — Architektur §4.2 sagt "nach Erfolg `load()` neu triggern → Liste
  aktualisiert (analog US-IT8-03)". Der bestehende Code in
  `DayOverrideManager.handleBlockDay` ruft bereits `void load()` (Zeile 143).
  Das funktioniert mit dem `?month=`-Filter aktuell — würde mit `?scope=all`
  weiterhin funktionieren. Aber: `load()` setzt `status('loading')` was bei
  einer großen Liste zu einem flackernden Loading-Skeleton führt. Optimistic
  Update wäre besser.
- **Fix-Empfehlung:** §4.2 ergänzen: "Nach erfolgreichem POST in
  `handleBlockDay` zusätzlich optimistic-update: `setOverrides(prev => [...prev, newOverride].sort(byDate))`,
  `load()` ist nur Backup. Damit kein Skeleton-Flackern."

#### BUG-IT8-04-B — Minor: 365-Cap kann Tom täuschen

- **Layer:** Backend / UX
- **Beschreibung:** §4.5 begrenzt `take: 365` als DOS-Schutz. Wenn Tom irgendwann
  mehr als 365 Overrides hat, sieht er nur die ersten 365 — sortiert chronologisch
  ASC, also alle alten zuerst. Die jüngsten (relevantesten) Einträge wären
  unsichtbar. Das ist ein UX-Problem, das aktuell unwahrscheinlich, aber
  nicht unmöglich ist.
- **Fix-Empfehlung:** Wenn `count > 365`: API zurückgibt zusätzliches Feld
  `truncated: true` und das Frontend zeigt einen Banner: "Es gibt mehr als
  365 Einträge — älteste werden zuerst gezeigt. Bitte alte Einträge manuell
  löschen oder Pagination anfragen." Alternativ Sortierung umkehren auf DESC
  (jüngste zuerst). Sortierung in Architektur ist ASC begründet — bleibt
  Designentscheidung.

### Edge Cases — abgedeckt?

- ✅ AC1 (Liste mit Datum, Zeiten, Lösch-Button): adressiert.
- ✅ AC2 (Empty-State-Text "Keine Überschreibungen eingetragen."): wörtlich
  spezifiziert.
- ✅ AC3 (Löschen ohne Reload): bestehender Code unverändert.
- ✅ AC4 (sofortiges Anlegen): siehe BUG-IT8-04-A.
- ✅ AC5 (vergangene Einträge ausgegraut): explizit spezifiziert mit
  `opacity-60` + Badge.
- ⚠️ Race: Wenn Tom in derselben Sekunde 2 Overrides für verschiedene Tage
  anlegt, kann der zweite POST den ersten überschreiben (Optimistic-Update-Race).
  Aktuell unwahrscheinlich, weil Tom nur ein Formular hat — aber wenn jemals
  Bulk-Anlage kommt, wäre das ein Bug.

### Risiken/Regressionen außerhalb der Architektur-Liste

- **Niedrig.** Additiver Fix.

---

## 5. US-IT8-05 — OAuth-Diagnose: Code-Bug vs. Config

### Verdict: **APPROVED_WITH_CONCERNS**

### Begründung

Bestehender Endpoint `app/api/auth/diagnose/route.ts` verifiziert: liefert
nur flache `env.*`/`providersActive.*`/`expectedCallbacks.*`-Felder, kein
Per-Check-Status, kein Top-Level-Verdikt. Bestätigt.

Fix-Strategie (additive `checks[]` + `verdict.actionRequired`) ist sauber
und rückwärtskompatibel. Schema-Definition in §5.2.1 ist verbindlich genug.

### Tom-Verständlichkeits-Test (zentrale Reviewer-Frage)

**Frage:** Reichen `checks[]` + `verdict.actionRequired` aus, damit Tom
(nicht-technischer User) versteht, ob Code oder Config?

**Antwort:** Konzeptionell ja, aber die JSON-Antwort selbst ist immer noch
roher JSON-Dump — Tom wird das im Browser sehen als `{ "verdict": { ... } }`-
Wand. Er muss wissen, **wo im JSON er hinschauen muss**. Architektur-§5.2
empfiehlt optional einen CLI (`scripts/auth-check.ts`) für farbige Tabelle —
das ist die ehrliche Tom-Lösung. Im JSON sollte zumindest `verdict.summary`
(Deutsch, 1-2 Sätze) als allererstes Feld stehen, damit Tom es sofort sieht.

**Score:** Schema robust (✅), aber UX-Lücke: Tom muss aktiv im
Browser-JSON-Dump suchen oder den CLI nutzen. Wenn der CLI optional bleibt,
ist die Lösung für Tom marginal besser als der IT7-Stand.

### Schema-Robustheit gegen Ambiguität (zweite Reviewer-Frage)

**Frage:** Wer detektiert "ENV gesetzt aber falsch" (z.B. `NEXTAUTH_URL=http://wrong.example.com`)?

- ✅ `nextauth_url_format` (§5.3) prüft URL-Parsbarkeit.
- ✅ `nextauth_url_set` prüft Trailing-Slash und `http://` in Prod.
- ❌ **NICHT geprüft:** Ob `NEXTAUTH_URL` mit der **tatsächlichen Production-URL
  übereinstimmt** (`baerenstark-hausservice.app` vs. `baerenstark-hausservice.vercel.app`
  vs. `localhost:3000`). Das ist EXAKT die häufigste Ursache von
  `redirect_uri_mismatch`.
- ❌ **NICHT geprüft:** Ob die Google Cloud Console wirklich die in
  `expectedCallbacks.googleC` gelistete URL akzeptiert — das kann der Server
  natürlich nicht prüfen, aber er könnte einen "Selbst-Test" machen, der
  einen GET auf `expectedCallbacks.googleC` macht und prüft, ob NextAuth
  den Pfad routet.

### Issues

#### BUG-IT8-05-A — Major: `actionRequired`-Mapping in §5.3 inkonsistent mit "Tom-soll-selbst-fixen"-Versprechen

- **Layer:** Spec
- **Beschreibung:** Architektur §5.3-Tabelle markiert `nextauth_url_set` als
  `actionRequired: "code"` — aber in der Hinweis-Spalte steht "ENV-Var ist
  deploy-config — siehe Hinweis unten". Im Hinweis-Block §5.3 (unter der Tabelle)
  wird klargestellt: ENV-Vars sind *immer* "config". **Widerspruch:** Die
  Tabelle sagt "code", der Hinweis sagt "config". Wenn der Engineer die Tabelle
  blindly umsetzt, kommt Tom in den Fall: `actionRequired: "code"` — er denkt
  "Engineer muss fixen" — aber faktisch muss Tom selbst die ENV in Vercel
  setzen. Tom hat keine Möglichkeit, das zu disambiguieren.
- **Fix-Empfehlung:** Tabelle in §5.3 vor Build überarbeiten. Konsistente Regel:
  - **Alle** "ENV-Var fehlt"-Checks → `actionRequired: "config"` (Tom geht in
    Vercel-Dashboard).
  - **Code-Bugs** sind: Provider-Builder-Bugs, fehlerhaftes Lesen der ENV im
    Code, Bugs in Auth-Callbacks. Davon ist aktuell **keiner** geplant —
    konsistent mit dem Hinweis "vermutlich `actionRequired: 'config'`".
  - Konkret: `nextauth_url_set` → `config`, `expected_callback_*_present` →
    `config` (folgt aus `nextauth_url_set`).

#### BUG-IT8-05-B — Minor: `verdict.summary` fehlt als prominentes Top-Level-Feld

- **Layer:** Spec / UX
- **Beschreibung:** §5.2.1 listet `verdict` als Objekt — `summary` ist verschachtelt.
  Im JSON-Dump sieht Tom als allererstes `env: {…}` (alphabetisch oder
  Insertion-Order). `verdict` käme weit unten. Tom muss scrollen.
- **Fix-Empfehlung:** Spec-Anweisung, dass `verdict` als allererstes Feld im
  JSON-Body steht (vor `env`, `checks`, etc.). Beispiel-Response in §5.2.1
  entsprechend umsortieren.

### Edge Cases — abgedeckt?

- ✅ AC1 (`checks[]` mit `status` + `message` deutsch): explizit.
- ✅ AC2 (`NEXTAUTH_URL` mit Trailing-Slash → Trailing-Slash-Check):
  `nextauth_url_set` mit `warn`-Status.
- ✅ AC3 (`AUTH_SECRET` ungesetzt → Secret nie ausgegeben): `auth_secret_present`
  prüft nur `set: true|false`.
- ✅ AC4 (`GOOGLE_CLIENT_ID/SECRET` fehlen): zwei Checks decken das ab.
- ✅ AC5 (alle Code-Checks ok → `actionRequired: "config"` mit
  `expectedCallbacks.google` zum Eintragen): Verdikt-Logik §5.2.2 deckt das
  ab.
- ✅ AC6 (mind. ein Code-Check `error` → `actionRequired: "code"` mit
  Liste): Verdikt-Logik deckt das ab.
- ✅ AC7 (alles grün + Tom config korrekt → kein `redirect_uri_mismatch`):
  manueller Tom-Test, kein Code-Test.
- ⚠️ Was passiert, wenn `AUTH_DIAGNOSE_ENABLED=false` in Prod aber Tom
  ruft trotzdem auf? IT7-Garantie: 404. Architektur erwähnt das in §5.5 als
  Test-Hook. Gut.
- ❌ "ENV gesetzt aber falsch (URL-Mismatch)": siehe Reviewer-Analyse oben —
  nicht abgedeckt. Edge-Case-Hinweis.

### Risiken/Regressionen außerhalb der Architektur-Liste

- **Niedrig.** Additive Erweiterung.
- **Sicherheit:** Architektur §5.2.1 macht expliziten Hinweis, dass `actual`
  niemals Secret-Werte enthält. Code-Review-Punkt für Backend-Engineer
  ist explizit benannt — gut.

---

## 6. Cross-Cutting Concerns

### 6.1 Build-Reihenfolge (§7) — Konsistent?

✅ Reihenfolge logisch: US-IT8-01 zuerst (entsperrt Tom), US-IT8-02 parallel
(reines FE), US-IT8-03 nach Persistenz-Check, US-IT8-04 parallel.
US-IT8-05 zuletzt — sinnvoll, weil Diagnose-Output dann nicht von anderen
Bugs überlagert wird.

### 6.2 Aufgabenverteilung (§6) — Vollständig?

✅ Jede Story hat klare BE/FE-Trennung. Keine "Wer macht das?"-Lücken.

### 6.3 Fehlende globale Test-Strategie

⚠️ **Major (Spec-Lücke):** Die Architektur listet pro Story eigene Test-Hooks,
aber es gibt **keine** explizite Pflicht zu einem End-to-End-Test
(z.B. Playwright-Spec) für die kritischen Bugs. Das ist Tom gegenüber riskant:
wenn ein Engineer den Fix einbaut und nur lokal manuell prüft, könnte ein
Regression-Bug bei einem Vercel-Deploy zurückkommen. Der Engineer ist nicht
explizit verpflichtet, einen automatisierten Smoke-Test zu schreiben.

**Empfehlung:** Architektur §7 oder neue §9 ergänzen:
> "Jeder Bug-Fix in IT8 wird durch mindestens einen Smoke-Test abgesichert:
> US-IT8-01 → `tests/contracts/admins-list-shape.test.ts` (in §1.3 schon
> als optional erwähnt — sollte verbindlich sein).
> US-IT8-02 → `tests/components/AdminCalendarView.smoke.test.tsx`
> (Mount + Initial-Fetch).
> US-IT8-03 → `tests/api/slots-from-default.test.ts` (Range-Default).
> US-IT8-04 → `tests/api/day-overrides-scope-all.test.ts` (in §4.3 schon
> verbindlich genannt).
> US-IT8-05 → `tests/api/diagnose-verdict-logic.test.ts` (Verdikt-Mapping
> mit verschiedenen ENV-Konstellationen)."

### 6.4 Offene Annahmen (§8) — Akzeptabel?

✅ Architektur ist transparent über nicht-verifizierte Annahmen. Engineer
weiß explizit, wo er nachprüfen muss.

---

## 7. Top-Level-Verdikt

### **APPROVED_WITH_CONCERNS — go für Phase 3 (Build).**

### Begründung

- Alle 5 Root-Cause-Analysen sind **via Code-Inspektion verifiziert** — der
  Architekt hat solide Detektivarbeit geleistet.
- Alle Fix-Strategien adressieren **die vollen Akzeptanzkriterien**, nicht
  nur Symptome.
- Es gibt **keine Blocker**. Die Major-Befunde sind Spec-Lücken, die der
  Engineer beim Bauen schließen kann (oder die spätestens im QA-Smoketest
  auffliegen würden).
- Es ist **nicht erforderlich**, dass der Architekt eine zweite Iteration
  macht.

### Verbindliche Anpassungen, die in die Build-Tickets aufgenommen werden müssen

1. **BUG-IT8-03-A:** US-IT8-03 → Variante B alleinstehend (nicht A+B), um
   Public-View-Regression zu vermeiden. **Hoch wichtig.**
2. **BUG-IT8-05-A:** US-IT8-05 → §5.3-Tabelle vor Build korrigieren:
   ENV-Var-Checks haben **immer** `actionRequired: "config"`. **Hoch wichtig.**
3. **BUG-IT8-02-A:** US-IT8-02 → De-Duplizierungsstrategie für initialen
   Fetch verbindlich spezifizieren (`useRef` + AbortController).
4. **§6.3 (Cross-Cutting):** Smoke-Tests pro Story als verbindlich
   spezifizieren.

### Empfehlung an den Orchestrator

→ **Phase 3 starten**, aber:
- Die 4 oben gelisteten Punkte als zusätzliche Tickets/Notizen an die
  Engineers übergeben.
- Insbesondere US-IT8-03 sollte mit dem Backend-Engineer noch einmal kurz
  durchgesprochen werden (Variante A vs. B alleinstehend).
- Falls der Architekt verfügbar ist, kann er die §5.3-Tabelle und §3.2-Empfehlung
  parallel zum Build-Start in 5–10 min nachschärfen — das ist aber nicht
  blockierend.

---

**Ende QA_DESIGN_REVIEW_IT8.md**
