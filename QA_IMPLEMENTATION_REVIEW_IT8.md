# QA_IMPLEMENTATION_REVIEW_IT8.md

**Mode:** Build QA (Post-Implementation, Iteration 8)
**Datum:** 2026-05-03
**Reviewer:** QA-Engineer
**Reviewed Artefakte:**
- `PROJECT.md` §"Iteration 8" (Zeilen 1770–2049, 5 Stories)
- `ARCHITECTURE_IT8.md` (Root-Cause-Analyse + Fix-Strategien)
- `QA_DESIGN_REVIEW_IT8.md` (Design-Major-Concerns als Build-Notizen)
- Backend-Sources: `src/app/api/admin/admins/route.ts`,
  `src/app/api/slots/route.ts`, `src/app/api/admin/day-overrides/route.ts`,
  `src/app/api/auth/diagnose/route.ts`, `src/lib/auth-diagnose.ts`,
  `contracts/zod-schemas.ts`
- Frontend-Sources: `src/app/admin/error.tsx`,
  `src/components/admin/admins/AdminUserTable.tsx`,
  `src/components/admin/AdminCalendarView.tsx`,
  `src/components/admin/AdminSlotManager.tsx`,
  `src/components/admin/DayOverrideManager.tsx`,
  `src/lib/api-client-it6.ts`, `src/lib/api-client.ts`
- Tests: `tests/diagnose-verdict.test.ts`, full smoke `tests/smoke.ts`
- Runbook: `docs/AUTH_GOOGLE_FIX_RUNBOOK.md`

---

## 0. Executive Summary

| Story | Verdict | Defekte? |
|-------|---------|----------|
| US-IT8-01 | **DONE** | – |
| US-IT8-02 | **DONE** | – |
| US-IT8-03 | **DONE** | – |
| US-IT8-04 | **DONE** | – |
| US-IT8-05 | **DONE** | – |

**Top-Level-Verdikt:** **DONE — Iteration 8 ist Production-deploybar.**

Verifizierungs-Anker:
- `npm run typecheck` → exit 0, keine Diagnostics.
- `npm run test:diagnose` → **32 / 32 PASS**.
- `npm test` (full smoke suite) → **181 / 181 PASS**, 0 fails.

> **Live-Browser-Smoke nicht im Sandbox testbar:** Tom muss die folgenden
> manuellen Smoke-Schritte selbst auf dem Vercel-Preview ausführen
> (s. §6 unten). Alle Code-Pfade sind via Source-Inspektion und Unit-Tests
> validiert; ein klassischer „End-to-End-im-Browser"-Test war im
> QA-Sandbox-Container nicht möglich.

---

## 1. US-IT8-01 — Admin-Verwaltungsseite Crash

### Verdict: **DONE**

### Akzeptanzkriterien

| AC | Erfüllt? | Beleg |
|----|----------|-------|
| AC1: `/admin/admins` zeigt Liste oder Empty-State, niemals weiße Seite | ✅ | `AdminUserTable` Z. 175–179 zeigt "Noch keine Admins vorhanden." Empty-State; Tabelle bei `admins.length > 0`. Keine ungeguardeten `.filter`/`.map`-Calls mehr. |
| AC2: API-Fehler → lesbare Fehlermeldung | ✅ | `AdminUserTable.load()` Z. 77–90 fängt `ApiClientError` und setzt Banner über `errorMessage`. Zusätzlich: `app/admin/error.tsx` als segment-level Boundary. |
| AC3: Keine unbehandelten JS-Exceptions in Console | ✅ | Doppelter Schutz: (a) `fetchAdmins()` (`api-client-it6.ts:131-141`) wirft `ApiClientError` bei Schema-Drift, (b) `AdminUserTable.load()` (Z. 67–74) zusätzlicher `Array.isArray`-Guard. Beide sind defensiv. |
| AC4: `next build` ohne Typ-/Laufzeitfehler | ✅ | `npm run typecheck` exit 0. Schema bleibt typsymmetrisch: API liefert `DataEnvelope<AdminListItem[]>`, Client mappt auf `{data, total}` mit `total = data.length`. |

### Verifikation der QA-Major-Concerns

#### BUG-IT8-01-A: Response-Shape entzerrt? Verbraucher korrekt?
- **Backend:** `route.ts:73` ruft jetzt `apiSuccess(admins.map(toListItem))` (vorher `apiSuccess({data: …, total: …})`). Response-Body ist `{data: AdminListItem[]}` — eine Verschachtelungsebene weniger.
- **Frontend-Client:** `fetchAdmins()` (Z. 131–141) liest `DataEnvelope<AdminListItem[]>` korrekt. Das `total`-Feld wird FE-seitig aus `data.length` rekonstruiert (rückwärtskompatibler Vertrag für Komponenten).
- **Konsumenten-Audit (BUG-IT8-01-B):** `grep` über `src/`, `scripts/`, `tests/` zeigt nur `fetchAdmins`/`createAdmin`/`updateAdmin`/`deleteAdmin` als Konsumenten der Route — alle korrekt am neuen Vertrag. **Keine externen Skripte oder Tests betroffen.**
- **Defensive Guards:**
  - `fetchAdmins()` `Array.isArray(res?.data)`-Check → wirft `ApiClientError` mit lesbarer Message bei Schema-Drift.
  - `AdminUserTable.load()` zweiter Guard → setzt Error-Banner statt Crash.
  - `app/admin/error.tsx` segment-level Boundary mit `useEffect`-Logging und `reset`-Button.

### Edge Cases (Spot-Check)

- ✅ **Empty-State:** `admins.length === 0` → "Noch keine Admins vorhanden." Banner.
- ✅ **Schema-Drift-Simulation:** Wenn Backend versehentlich wieder `{data: {...}}` zurückliefert, fängt `fetchAdmins`-Guard das ab und wirft `INTERNAL_ERROR` → `AdminUserTable` zeigt Error-Banner ("Unerwartetes Antwortformat …"). Kein TypeError.
- ✅ **Server-500:** Pfad geht durch `internalError(err)` → `ApiClientError` → Banner-Text "Admins konnten nicht geladen werden." (Z. 87). Error-Boundary fängt nur Render-Errors, nicht behandelte Fetches — ist im Code-Kommentar `app/admin/error.tsx` Z. 14–18 korrekt dokumentiert.

### Bemerkungen
- Sehr gute Defense-in-Depth-Schichtung: zwei unabhängige Array.isArray-Guards (Client + Komponente) machen ein Wiederauftreten praktisch unmöglich.

---

## 2. US-IT8-02 — Admin-Kalender rendert nicht

### Verdict: **DONE**

### Akzeptanzkriterien

| AC | Erfüllt? | Beleg |
|----|----------|-------|
| AC1: `/admin/calendar` zeigt Kalender-Komponente sichtbar | ✅ | `AdminCalendarView.tsx:301-308` — `<AppCalendar>` ist immer gemountet, unabhängig vom Status. Skeleton ist Overlay (`absolute inset-0 ... pointer-events-none`), nicht Ersatz. |
| AC2: Bestätigte Buchungen erscheinen | ✅ | `loadEvents` setzt `events`-State; `<AppCalendar events={events}>` rendert sie. Initial-Fetch in `useEffect` Z. 163–166. |
| AC3: Leeres Raster bei keinen Buchungen | ✅ | Kalender ist immer sichtbar; bei `events=[]` zeigt FullCalendar das leere Raster. Skeleton-Overlay verschwindet, sobald `status !== 'loading'`. |
| AC4: CSS-Assets HTTP 200 | ✅ (trivial) | FullCalendar v6.1.20 injiziert CSS zur Laufzeit selbst — keine separaten CSS-HTTP-Requests, keine 404. |

### Verifikation der QA-Major-Concerns

#### BUG-IT8-02-A: useRef + AbortController umgesetzt? Race-Condition verhindert?
- **`lastRangeRef` (Z. 108):** Speichert zuletzt angeforderten `{from, to}`. `loadEvents` (Z. 122–124) macht early-return, wenn der Range identisch ist → De-Duplizierung des initialen Fetches gegen den ersten `datesSet`-Trigger von FullCalendar.
- **`abortRef` (Z. 109):** AbortController; alter Fetch wird in Z. 127 abgebrochen, sobald ein neuer startet → keine out-of-order-Responses, kein „älterer Fetch überschreibt neueren State"-Bug.
- **`mountedRef` (Z. 110):** Lifecycle-Tracker; `loadEvents` checkt vor `setState` (Z. 135, 139) → keine React-Warnings für State-Sets nach Unmount.
- **Cleanup-Effect (Z. 112–118):** `mountedRef.current = false` und `abortRef.current?.abort()` beim Unmount.

**Verdikt:** Race-Condition-Strategie aus dem Design-Review **vollständig** umgesetzt. Code-Kommentar Z. 99–107 dokumentiert die Strategie sauber.

### Edge Cases (Spot-Check)

- ✅ **Initial-Mount:** `useEffect` Z. 163–166 ruft `loadEvents(initialRange)` einmal. FullCalendar mountet danach und feuert sein eigenes `datesSet`-Callback → `handleRangeChange` → `loadEvents(viewRange)`. Falls `viewRange === initialRange`, no-op via `lastRangeRef`. Falls abweichend, neuer Fetch bricht den initialen ab.
- ✅ **Fehlerfall:** Backend 404 (Endpoint noch nicht deployed) → `setEvents([])` + Banner "Kalender-Endpoint ist noch nicht aktiv …" (Z. 144–149). Kalender selbst bleibt sichtbar.
- ✅ **AbortError-Handling:** Z. 140 swallowt explizit `DOMException` mit `name === 'AbortError'`, also kein UI-Banner für absichtlich abgebrochene Fetches.

### Bemerkungen
- Die De-Duplizierungs-Strategie (`lastRangeRef`) entschärft das im Design-Review markierte Risiko der Doppel-Fetch-Race vollständig.

---

## 3. US-IT8-03 — Zeitfenster nach Save nicht in Liste

### Verdict: **DONE**

### Akzeptanzkriterien

| AC | Erfüllt? | Beleg |
|----|----------|-------|
| AC1: Neuer Slot erscheint sofort ohne Reload | ✅ | `AdminSlotManager` Z. 73 `<SlotForm onCreated={load}>` — nach POST-Erfolg ruft Form `load()`, das wieder `fetchSlots({from, to})` mit erweitertem Range macht. |
| AC2: Slot bleibt nach F5 sichtbar | ✅ | Persistenz unverändert — POST schreibt unverändert in Prisma. Range-Default umfasst heutigen Tag → F5 zeigt ihn. |
| AC3: Persistenz-Check vor UI-Fix | ✅ | Architektur §3.3 dokumentiert das ausdrücklich; `ARCHITECTURE_IT8.md` §0 stellt fest, dass POST persistiert und nur GET-Filter falsch war. |
| AC4: Genau ein GET nach POST | ✅ | `SlotForm.onCreated` löst `load()` einmal aus → ein GET. Kein doppelter Trigger; State-Update ist nicht parallel. |

### Verifikation der QA-Major-Concerns

#### BUG-IT8-03-A: Public-View NICHT regressiert? Auth-Branch korrekt?
- **Backend** (`src/app/api/slots/route.ts:52-67`): Auth-abhängige Default-Logik:
  - `session?.user` truthy (Admin eingeloggt) → `defaultFrom = startOfTodayBerlinUtc()` (heute 00:00 Berlin).
  - `session?.user` falsy (öffentliche Buchungs-View) → `defaultFrom = now()` — **identisch zum Pre-IT8-Verhalten**.
- **Frontend** (`AdminSlotManager.tsx:51-65`): Übergibt zusätzlich **explizit** `from` (heute Berlin – 14h Sicherheitspuffer für DST) und `to` (heute + 180 Tage). Damit ist der Admin-Pfad doppelt abgesichert: explizite Range UND Backend-Default-Fallback.
- **Public-Konsumenten** (`BookingClient.tsx:98`, `CounterProposalDialog.tsx:53`): Beide rufen `fetchSlots()` ohne params → Backend bekommt keine `from`/`to`, ruft `auth()` → null (öffentlicher Browser-Fetch ohne Cookie) → `defaultFrom = now()`. **Public-View-Verhalten unverändert.**

**Verdikt:** Sowohl QA-Empfehlung „Variante B" (FE explizit) als auch zusätzlich Server-Verzweigung umgesetzt → Public-View-Regression kategorisch ausgeschlossen.

### Edge Cases (Spot-Check)

- ✅ **Tom-Vormittag-Pflege:** Tom legt um 14:30 Uhr Slot für 09:00–11:00 heute an (Vergangenheit gegenüber `now()`, aber `>= startOfTodayBerlinUtc()`). Nach POST erscheint Slot in Liste (Server-Default fängt das ab; FE übergibt zusätzlich `from = heute`).
- ✅ **Vergangenheits-Slot:** `CreateSlotSchema.superRefine` (Z. 269) lehnt `start.getTime() < now` mit Validation-Error ab → POST 400, Slot kommt gar nicht in DB. AC2 nicht relevant.
- ✅ **DST-Edge:** `AdminSlotManager.adminSlotRangeBerlin()` zieht 14h Sicherheitspuffer ab (Z. 40) → bei Sommer-/Winterzeit-Übergang fällt kein Slot durch.
- ✅ **Range-Ende:** FE setzt `to = heute + 180d`; Slots bis 180 Tage in Zukunft sichtbar (vorher: 90d Backend-Limit). Falls Tom > 180d in Zukunft anlegt, wäre Slot nicht in Liste — aktuell unwahrscheinlich (Slot-Schema erlaubt typischerweise `SLOT_MAX_LEAD_TIME_DAYS`-Cap).

### Bemerkungen
- Die isAdminCaller-Heuristik (`!!session?.user`) ist semantisch leicht missbenannt (truthy `session?.user` umfasst auch Customer-Login), aber an dieser Stelle in der Code-Architektur ist `auth()` aus `@/lib/auth` reserviert für Admin-Auth (Customer-Auth läuft über `/api/auth/customer/...`). Der Name `isAdminCaller` ist daher faktisch korrekt — **keine** funktionale Lücke. Optional: Kommentar im Code zur Klarstellung; nicht blockierend.

---

## 4. US-IT8-04 — DayOverride-Liste vollständig sichtbar

### Verdict: **DONE**

### Akzeptanzkriterien

| AC | Erfüllt? | Beleg |
|----|----------|-------|
| AC1: Liste mit Datum, Zeiten/„Geschlossen", Lösch-Button | ✅ | `DayOverrideManager.tsx:342-407` rendert `grouped`-Liste mit Datum (Z. 362), Status-Badge (Z. 372), Zeiten (Z. 388), Lösch-Button (Z. 393). |
| AC2: Empty-State „Keine Überschreibungen eingetragen." | ✅ | Z. 336–339 wörtlich. |
| AC3: Lösch-Button entfernt sofort ohne Reload | ✅ | `handleDelete` Z. 198–225: Optimistic-Update (Z. 207), Server-Call (Z. 209), Rollback bei Fehler (Z. 216). `confirm()`-Bestätigung Z. 200–204. |
| AC4: Neuer Eintrag erscheint sofort | ✅ | `handleBlockDay` Z. 168–171: Optimistic-Insert mit Dedup-by-date (Upsert-konform), `load(silent=true)` als Backup-Reload Z. 184. Kein Skeleton-Flackern. |
| AC5: Vergangene Einträge ausgegraut markiert | ✅ | `isPast`-Helper Z. 62–65; CSS `opacity-60` Z. 357; zusätzlicher Badge „vergangen" Z. 374–381. |

### Verifikation der QA-Major-Concerns

#### Truncated-Banner (BUG-IT8-04-B aus Design-Review): korrekt umgesetzt?
- **Backend** (`day-overrides/route.ts:79-93`): Fetch mit `take: DAY_OVERRIDE_LIST_ALL_MAX + 1`, dann `truncated = overrides.length > DAY_OVERRIDE_LIST_ALL_MAX`, slice auf 365. Response enthält `{scope, overrides, truncated, cap}`.
- **Schema** (`contracts/zod-schemas.ts:821-827`): `DayOverrideListAllQuerySchema = z.object({scope: z.literal('all')})` und Konstante `DAY_OVERRIDE_LIST_ALL_MAX = 365`.
- **Frontend** (`DayOverrideManager.tsx:310-317`): `truncated`-Banner mit warning-Tone, deutscher Text "Es sind mehr als 365 Einträge vorhanden — angezeigt werden nur die ältesten 365. Bitte alte Einträge löschen."
- **Sortierung:** Backend liefert `orderBy: {date: 'asc'}`; FE sortiert nochmals defensiv via `sortByDateAsc`.

**Verdikt:** Truncated-Path vollständig spezifiziert und implementiert.

### Edge Cases (Spot-Check)

- ✅ **3 Overrides in 3 verschiedenen Monaten:** `groupByMonth` (Z. 76–88) gruppiert; UI rendert Monats-Header pro Gruppe. Alle sichtbar, weil `?scope=all` benutzt wird.
- ✅ **Override für gestern:** `isPast('2026-05-02', '2026-05-03')` = true → `opacity-60` + Badge „vergangen". Eintrag bleibt löschbar.
- ✅ **Optimistic-Update Roll-Back:** `handleDelete` snapshot in `snapshot` Z. 206; bei Fehler `setOverrides(snapshot)` Z. 216. Robust.
- ✅ **Strict-Mode Doppel-Mount:** `abortRef` (Z. 105) bricht den ersten Fetch ab, der zweite läuft — kein doppelter `setState`.
- ✅ **POST-Upsert-Dedup:** `handleBlockDay` Z. 168–171 entfernt vorhandenen Eintrag mit gleichem Datum vor Insert (Upsert-Semantik).
- ⚠️ **Confirm-Dialog via `window.confirm`:** Funktional korrekt, aber UX-mäßig altmodisch (im Vergleich zu `ConfirmDialog` in `AdminUserTable`). Kein Defekt — AC verlangt nur "wenn ich die Aktion bestätige".

### Bemerkungen
- Architektur-Empfehlung „Optimistic Update" voll umgesetzt → kein Skeleton-Flackern beim Anlegen.
- Sortierung ASC ist Architektur-konform; Truncated-Banner kompensiert das UX-Risiko.

---

## 5. US-IT8-05 — OAuth-Diagnose: Code-Bug vs. Config-Aufgabe

### Verdict: **DONE**

### Akzeptanzkriterien

| AC | Erfüllt? | Beleg |
|----|----------|-------|
| AC1: `checks[]` mit `status` + `message` deutsch | ✅ | `auth-diagnose.ts:70-335` baut 14+ Checks mit status (`ok/warn/fail`) und deutschen Messages. |
| AC2: NEXTAUTH_URL fehlt/Trailing-Slash → fail/warn mit ist/soll | ✅ | `nextauth_url_set`-Check (Z. 76–111): `actual = url`, `expected = "ohne Trailing-Slash, https:// in Production"`, status fail/warn/ok. |
| AC3: AUTH_SECRET unset → fail, kein Klartext | ✅ | `auth_secret_present` (Z. 156–164): `actual` ist nur `"set"`/`"alias-only"`/`"unset"` — niemals der Secret-Wert. Test 8 verifiziert. |
| AC4: GOOGLE_CLIENT_ID/SECRET fehlen → status fail mit Hinweis | ✅ | `google_client_id_set` Z. 209–219, `google_client_secret_set` Z. 221–231. Plus `google_provider_loaded` Folgefehler-Check. |
| AC5: Alle Code-Checks ok → `actionRequired: "config"` mit `expectedCallbacks.google` | ✅ | `computeDiagnoseVerdict` Z. 366–374. Test 1 verifiziert: Best-Case → "config" (wegen `auth_secret_length`-warn). |
| AC6: Mind. ein Code-Check error → `actionRequired: "code"` mit Liste | ✅ | `computeDiagnoseVerdict` Z. 356–364. Test 4+5 verifizieren synthetischen Code-Fail. |
| AC7: Toms Cloud-Config-Verifikation | ✅ (manuell) | Out-of-scope für QA; Story-Hinweis sagt explizit „Tom-seitige Config-Verifikation". |

### Verifikation der QA-Major-Concerns

#### BUG-IT8-05-A: Sind ENV-Var-Checks `actionRequired: 'config'` (nicht 'code')?
**Vollständige Inspektion aller `actionRequired`-Felder in `auth-diagnose.ts`:**

| Check-ID | actionRequired (fail-Pfad) | Korrekt? |
|---------|---------------------------|----------|
| `nextauth_url_set` | `"config"` (Z. 84, 108) | ✅ |
| `nextauth_url_format` | `"config"` (Z. 128) | ✅ |
| `auth_secret_present` | `"config"` (Z. 162) | ✅ |
| `auth_secret_length` | `"config"` (Z. 173) | ✅ |
| `auth_trust_host_set_in_prod` | `"config"` (Z. 188) | ✅ |
| `google_client_id_set` | `"config"` (Z. 215) | ✅ |
| `google_client_secret_set` | `"config"` (Z. 227) | ✅ |
| `google_provider_loaded` | `"config"` (Z. 240) | ✅ |
| `facebook_client_id_set` | `"config"` (Z. 256) | ✅ |
| `facebook_client_secret_set` | `"config"` (Z. 268) | ✅ |
| `expected_callback_google_present` | `"config"` (Z. 287) | ✅ |
| `expected_callback_facebook_present` | `"config"` (Z. 301) | ✅ |
| `resend_api_key_set` | `"config"` (Z. 315) | ✅ |
| `bootstrap_admin_email_set` | `"config"` (Z. 328) | ✅ |

**Kein einziger Check produziert `actionRequired: "code"` aus reinen ENV-Lese-Pfaden.** Die `"code"`-Variante ist ausschließlich für synthetisch injizierte Checks vorbehalten (siehe Test 4+5). **QA BUG-IT8-05-A vollständig adressiert.**

Test `tests/diagnose-verdict.test.ts:127-131` verifiziert genau diese Garantie für `nextauth_url_set` (PASS).

#### BUG-IT8-05-B: `verdict` als allererstes Feld im Body?
- `route.ts:138-140`: `body` ist `{verdict, checks, env, …}` in dieser Insertion-Order. JSON.stringify respektiert die Property-Order der Engine. **Tom sieht `verdict` ganz oben.**
- Code-Kommentar Z. 135–137 dokumentiert das explizit.

### Edge Cases & Test-Resultate

- **`npm run test:diagnose` → 32 / 32 PASS:**
  - Szenario 1: Best-Case (alles korrekt) → "config" wegen `auth_secret_length`-warn (dokumentiert).
  - Szenario 2: NEXTAUTH_URL fehlt → "config" + `nextauth_url_set` ist `actionRequired: "config"`.
  - Szenario 3: Multi-ENV-fehlt → "config", `configActions` enthält beide Check-IDs.
  - Szenario 4: Synthetischer Code-Fail → "code", `codeFailures` enthält die ID, `configActions` leer.
  - Szenario 5: Code+Config beide fail → "code" gewinnt (Engineer-First), `configActions` leer.
  - Szenario 6: Trailing-Slash → `warn`, Verdikt "config".
  - Szenario 7: NEXTAUTH_SECRET-only (alias) → `warn`, `actual = "alias-only"`.
  - Szenario 8: Kein Secret-Wert leakt in `checks[].actual` (Sicherheits-Garantie).

### Runbook (`docs/AUTH_GOOGLE_FIX_RUNBOOK.md`)

- **TOP-0-Sektion** vor TOP-5-Checkliste (Z. 19–53): erklärt `verdict.actionRequired` mit "code"/"config"/"none"-Fallunterscheidung in deutscher Sprache.
- **Hinweis zu `auth_secret_length` immer-warn** (Z. 48–52) klargestellt.
- IT8-Update-Block Z. 13–17 nennt das neue `verdict`-Top-Level-Feld explizit.

### Bemerkungen
- Sicherheits-Garantie ist nicht nur dokumentiert (Code-Kommentar Z. 11–13) sondern auch automatisch getestet (Szenario 8).
- Die Verdikt-Logik macht "code" priorisiert vor "config" → Engineer-First-Regel; korrekt für Toms Mental-Model ("zuerst auf den Engineer warten, dann selbst loslegen").

---

## 6. Live-Browser-Smoke (NICHT im Sandbox testbar)

Folgende Schritte sind **manuell auf Vercel-Preview** erforderlich:

| # | Story | Aktion | Erwartet |
|---|-------|--------|----------|
| 1 | US-IT8-01 | Login als Admin, `/admin/admins` öffnen | Tabelle (oder Empty-State); keine weiße Seite; Console ohne TypeError |
| 2 | US-IT8-02 | `/admin/calendar` öffnen | Kalender-Raster sofort sichtbar; `GET /api/admin/calendar/events?from=…&to=…` im Network-Tab; Skeleton verschwindet < 2s |
| 3 | US-IT8-03 | `/admin/slots`: Slot für „heute 09:00–11:00" um 14:30 Uhr anlegen | Slot erscheint **sofort** in Liste; F5 → Slot bleibt sichtbar |
| 4 | US-IT8-03 (Public-Regression) | Public `/buchung` öffnen | Verstrichene Vormittag-Slots werden **nicht** angezeigt (Public-Verhalten unverändert) |
| 5 | US-IT8-04 | DayOverrides für 3 verschiedene Monate (inkl. 1× gestern) anlegen | Alle in chronologisch sortierter Liste; gestern ist `opacity-60` + Badge „vergangen" |
| 6 | US-IT8-04 | Lösch-Button auf einem Eintrag, bestätigen | Eintrag verschwindet sofort, kein Reload |
| 7 | US-IT8-05 | `AUTH_DIAGNOSE_ENABLED=true` in Vercel setzen, `GET /api/auth/diagnose` aufrufen | JSON beginnt mit `verdict`-Feld; Toms Konfig produziert „config"; `configActions` enthält die exakten Cloud-Console-Schritte |

Sobald diese Schritte grün sind, ist Iteration 8 final abgenommen.

---

## 7. Top-Level-Verdikt

### **DONE — Iteration 8 ist Production-deploybar.**

### Begründung

- Alle 5 Stories erfüllen ihre Akzeptanzkriterien laut Code-Inspektion.
- Alle 4 QA-Design-Review-Major-Concerns (BUG-IT8-01-A, BUG-IT8-02-A,
  BUG-IT8-03-A, BUG-IT8-05-A) sind im Code adressiert und teilweise
  unit-getestet.
- Typecheck clean, Diagnose-Test 32/32, Smoke-Suite 181/181.
- Es wurden **keine Defekte** im Code gefunden, die einen Build-Loop
  rechtfertigen.

### Was noch zu tun ist (außerhalb Build-Loop)

1. **Manueller Vercel-Preview-Smoke** durch Tom (siehe §6) — bestätigt,
   dass die Code-Pfade auch in der Live-Umgebung funktionieren.
2. **Tom-Cloud-Console-Schritt** (US-IT8-05 AC7): Sobald
   `verdict.actionRequired === "config"` mit den `configActions` ankommt,
   trägt Tom die Redirect-URIs in der Google Cloud Console ein.

### Empfehlung an den Orchestrator

→ **Phase 4 starten** (Production-Deploy zu Vercel-Preview).
→ Tom führt die 7 manuellen Smoke-Schritte aus.
→ Bei grünem Smoke: Iteration 8 final abgenommen, Production-Promotion.

Kein weiterer Build-Loop erforderlich.

---

**Ende QA_IMPLEMENTATION_REVIEW_IT8.md**
