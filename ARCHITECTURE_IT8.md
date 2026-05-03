# ARCHITECTURE_IT8.md — Iteration 8

**Bugfix-Sweep & DayOverride-Sichtbarkeit**

Datum: 2026-05-03
Vorgänger: `ARCHITECTURE_IT7.md` (Auth-Stabilisierung), `ARCHITECTURE_IT6.md`.
Stack: Next.js 14 App Router, Prisma 5, libSQL/Turso, NextAuth v5, Vercel.

> Diese Iteration enthält **keine** neuen Features. Sie liefert ausschließlich
> Root-Cause-Fixes für fünf gemeldete Bugs aus dem IT7-Go-Live + eine
> Erweiterung des bereits in IT7 angelegten Diagnose-Endpoints
> (`/api/auth/diagnose`).

---

## 0. Untersuchungs-Ergebnis (Kurzfassung)

| Story | Symptom | Root Cause | Schicht |
|-------|---------|------------|---------|
| US-IT8-01 | Weiße Seite `/admin/admins` | Response-Envelope-Mismatch: API liefert `{ data: { data: [...], total } }`, FE-Client gibt das ganze Objekt unverändert zurück, `setAdmins(res.data)` setzt ein Objekt statt Array → `admins.filter(...)` crasht. | Backend-Routen-Vertrag **oder** FE-Client (eine Seite muss nachgeben — siehe §1). |
| US-IT8-02 | Kein Kalender sichtbar | State-Machine-Deadlock in `AdminCalendarView`: `<AppCalendar>` wird nur gerendert, wenn `status === 'ready'`. `status` wird aber erst durch `datesSet` (kommt vom `AppCalendar`) auf `ready` gesetzt → Kalender ist permanent hinter `<SkeletonCard />`. | Frontend (`AdminCalendarView.tsx`). |
| US-IT8-03 | Neuer Slot erscheint nicht in Liste | `GET /api/slots` filtert mit `startsAt: { gte: from }` und `from = now()`. Slots, deren `startsAt < now` (heute Vormittag eingetragen) werden ausgeblendet. Der Default-Range deckt nur `[now, now+90d]` ab. | Backend (`/api/slots/route.ts`) — Filter-Semantik ist für die Admin-Sicht falsch. |
| US-IT8-04 | DayOverrides nicht überblickbar | Die Komponente listet bestehende Overrides — **aber nur für den ausgewählten Monat**. Es gibt keinen "alle Einträge"-Modus, kein API-Mode für globale Liste. | Backend + Frontend (kleines API-Erweiterung + UI-Toggle). |
| US-IT8-05 | Diagnose-Output zu vage | Der bestehende Endpoint listet ENV-Werte, aber gibt **kein** maschinenlesbares pro-Check-Verdikt und **keinen** Top-Level "actionRequired"-Hinweis. Tom kann daraus nicht eindeutig ableiten, ob er die Cloud-Console oder ein Engineer den Code anfassen muss. | Backend (`/api/auth/diagnose/route.ts`) — additive Erweiterung. |

---

## 1. US-IT8-01 — `/admin/admins` Crash

### 1.1 Root Cause (verifiziert)

- `src/app/api/admin/admins/route.ts:68` — handler ruft
  `apiSuccess({ data: admins.map(toListItem), total: admins.length })`.
- `src/lib/api.ts:110` — `apiSuccess(data)` umhüllt mit `{ data }` →
  Response-Body ist `{ data: { data: [...], total: N } }`.
- `src/lib/api-client-it6.ts:114-121` — `fetchAdmins()` gibt
  `request<AdminListResponse>(...)` direkt zurück. `AdminListResponse` ist
  als `{ data: AdminListItem[]; total: number }` typisiert. Aufgrund der
  doppelten Verschachtelung ist `res.data` zur Laufzeit das innere `{ data, total }`-Objekt — **kein Array**.
- `src/components/admin/admins/AdminUserTable.tsx:61` — `setAdmins(res.data)`
  speichert dieses Objekt als angeblichen `AdminListItem[]`.
- `AdminUserTable.tsx:84` — `admins.filter((a) => a.status === 'ACTIVE')`
  wirft **`TypeError: admins.filter is not a function`**. React
  ohne Error-Boundary → weiße Seite.

### 1.2 Fix-Strategie

**Variante A (bevorzugt — Vertrag bereinigen, Symmetrie zu `createAdmin`):**

Backend-Route ändert sich auf
```ts
return apiSuccess(admins.map(toListItem));
```
und gibt damit `{ data: AdminListItem[] }`. FE-Client `fetchAdmins()`:
```ts
const res = await request<DataEnvelope<AdminListItem[]>>('/api/admin/admins', { signal });
return { data: res.data, total: res.data.length };
```

Damit ist die Response-Form **identisch** mit `createAdmin`/`updateAdmin`
(beide geben heute schon `{ data: AdminListItem }`).

**Zusätzlich Defense-in-Depth:**

1. Error-Boundary auf Admin-Layout-Ebene
   (`src/app/admin/error.tsx` falls noch nicht vorhanden) — fängt
   *zukünftige* unerwartete Crashes ab und zeigt eine deutsche Fehlermeldung +
   "Erneut versuchen"-Button.
2. In `AdminUserTable.load()`: `Array.isArray(res.data)`-Guard ergänzen,
   damit ein zukünftiger Schema-Drift sichtbar wird statt zu crashen.

### 1.3 Berührte Dateien

- `src/app/api/admin/admins/route.ts` (Response-Shape)
- `src/lib/api-client-it6.ts` (`fetchAdmins`)
- `src/components/admin/admins/AdminUserTable.tsx` (Defensive Guard)
- `src/app/admin/error.tsx` (NEU — Error-Boundary)
- *Optional:* `tests/contracts/admins-list-shape.test.ts` (regressionssicherer Smoke).

### 1.4 Test-Hooks

- QA: `/admin/admins` lädt, zeigt Tabelle (oder leeren Zustand) — kein Crash.
- DevTools-Console: keine `TypeError`.
- `curl -b cookies.txt /api/admin/admins | jq '.data | type'` → `"array"`.
- Seite mit künstlich provoziertem 500er (z.B. DB-Stop) zeigt Error-Boundary,
  nicht weißen Bildschirm.

### 1.5 Risk

- **Mittel.** Die Vertrags-Änderung muss in EINEM Deploy passieren — wenn
  Backend zuerst deployt und FE-Client noch alt, bricht die Seite anders
  (`res.data.filter` auf Array → ok; aber `setAdmins(res.data)` würde
  `total` als `undefined` setzen und nirgends gelesen — also egal). Trotzdem
  empfehle ich, Backend und FE-Client als ein Commit zu mergen.
- Andere Routen (Bookings, Reviews etc.) verwenden bereits `apiSuccess(array)`
  ohne `total` — kein Kollateralschaden.

---

## 2. US-IT8-02 — Admin-Kalender rendert nicht

### 2.1 Root Cause (verifiziert)

`src/components/admin/AdminCalendarView.tsx`:

- Zeile 57: `const [status, setStatus] = useState<LoadStatus>('idle');`
- Zeile 215: `{status === 'idle' || status === 'loading' ? <SkeletonCard /> : <AppCalendar ...>}`
- `<AppCalendar>` ruft `onRangeChange` (→ `loadEvents`) erst aus seinem
  internen `datesSet`-Hook, wenn FullCalendar **gemountet** ist.
- Da `<AppCalendar>` nie gemountet wird (immer Skeleton), wird `loadEvents`
  nie aufgerufen → `status` bleibt für immer `'idle'`.

**Verifikations-Hinweis:** FullCalendar v6.1.20 injiziert sein CSS zur
Laufzeit selbst, ein expliziter CSS-Import wäre **nicht** nötig. Die im
Story-Hinweis erwähnte CSS-Spur ist hier nicht der Bug. (Nicht
verifiziert via Browser-Test, aber Code-Pfad und Lib-Doku eindeutig.)

### 2.2 Fix-Strategie

Dead-Lock auflösen:

1. Initialer State `status: 'idle'` → **Kalender immer mounten**, Skeleton
   nur als *Overlay* während `'loading'` rendern (nicht als Ersatz).
2. Konkret: Bedingung in Zeile 215 ändern zu

   ```tsx
   <AppCalendar mode="admin" events={events} ... />
   {(status === 'idle' || status === 'loading') && (
     <div className="absolute inset-0 ..."><SkeletonCard /></div>
   )}
   ```
3. Alternative (sauberer): in `useEffect` einen *initialen* Range-Berechnen
   (z.B. aktuelle Woche `Mo`–`So`) und `loadEvents` *einmal* manuell
   triggern, bevor `<AppCalendar>` gemountet ist:

   ```tsx
   useEffect(() => {
     const { from, to } = computeInitialWeekRangeBerlin();
     void loadEvents(from, to);
   }, [loadEvents]);
   ```

   Variante (3) ist robuster, weil sie kein doppeltes Rendering bei
   View-Wechsel verursacht.

### 2.3 Berührte Dateien

- `src/components/admin/AdminCalendarView.tsx` (State-Machine + initialer Fetch)
- *Optional:* `src/components/calendar/AppCalendar.tsx` — keine Änderung nötig.

### 2.4 Test-Hooks

- QA: `/admin/calendar` zeigt sofort ein leeres Wochen-/Tages-Raster.
- Network-Tab: ein `GET /api/admin/calendar/events?from=…&to=…` direkt nach
  Page-Load (nicht erst nach View-Klick).
- DevTools-Console: keine "FullCalendar is undefined"-Meldung.

### 2.5 Risk

- **Niedrig.** Reine Frontend-Änderung in einer einzelnen Komponente.
- Risiko: doppeltes Range-Fetching möglich (initial + erstes `datesSet`).
  Mit Variante (3) und dedupliziertem Range-State (z.B. `useRef` auf
  letzten Range) eliminiert.

---

## 3. US-IT8-03 — Zeitfenster nach Save nicht in Liste

### 3.1 Root Cause (verifiziert)

`src/app/api/slots/route.ts` Zeilen 27–82 (GET):

- Default-Filter: `from = now()`, `to = now() + 90 Tage`.
- WHERE-Klausel: `startsAt: { gte: from, lte: to }`.

**Folge:** Slots, deren `startsAt` heute aber **vor** dem Zeitpunkt des
GET-Requests liegt, werden ausgeblendet. Beispiel: Tom legt um 14:30 Uhr
einen Slot für "heute, 09:00–11:00" an (nachträgliche Pflege) → POST
erfolgreich, GET filtert ihn aus → "Liste nicht aktualisiert".

**Sekundäreffekt:** Selbst Slots, die heute *nach* `now()` starten, aber
in den Sekunden zwischen POST-Response und GET-Re-Fetch verschoben werden,
können fehlen — eher Edge-Case.

`AdminSlotManager` ruft `load()` korrekt nach erfolgreichem POST
(`SlotForm.onCreated()` → `load()`). `request()` benutzt
`cache: 'no-store'`. Frontend-State-Reload ist **nicht** der Bug.

### 3.2 Fix-Strategie

Backend: Admin-Sicht braucht eine andere Default-Range als die öffentliche
Sicht. Zwei Optionen:

**A — Default-Range erweitern (minimal-invasiv):**
Ohne Query-Parameter `from`/`to` defaultet die Route auf

```ts
const startOfToday = startOfDayBerlin(new Date());
const from = fromParam ? new Date(fromParam) : startOfToday;
```

Damit bleiben heutige Slots sichtbar. `to` bleibt `now + 90d`.

**B — Frontend übergibt explizit `from`/`to` (sauberer):**
`AdminSlotManager` ruft `fetchSlots({ from: startOfTodayIso, to: in180dIso })`.
Backend bleibt unverändert.

**Empfehlung:** **Variante A** UND zusätzlich Frontend-Variante B —
Backend-Default für Robustheit, Frontend-Explicit für Audit-Klarheit.

> Hinweis: Die *öffentliche* Slot-Liste (`/api/slots` ohne Auth) sollte
> sehr wohl nur zukünftige Slots anzeigen. Sie wird vom Customer-Frontend
> aufgerufen und filtert korrekt. Der Fix darf das Public-Verhalten **nicht**
> brechen — Variante A verschiebt die Untergrenze nur von „now" auf „heute
> 00:00 lokale Zeit", was customer-seitig akzeptabel ist (heutige Slots
> sind weiterhin nutzbar bis zu ihrer Startzeit; verstrichene Slots des
> heutigen Vormittags sind sowieso nicht buchbar — separater Filter im
> Buchungs-Endpoint).

### 3.3 Persistenz-Check (Pflicht vor UI-Fix, US-IT8-03 AC3)

Engineer prüft vor dem Code-Fix mit Prisma Studio oder
`sqlite3 dev.db 'SELECT id, startsAt FROM slots ORDER BY startsAt DESC LIMIT 5;'`,
dass die zuletzt erstellten Slots tatsächlich in der DB stehen. Dies
bestätigt, dass POST persistiert und der Bug eindeutig im GET-Filter
liegt — nicht in der Schreibroute.

### 3.4 Berührte Dateien

- `src/app/api/slots/route.ts` (Default-`from` umstellen)
- `src/components/admin/AdminSlotManager.tsx` (explizite Range — optional)
- *Optional:* `src/lib/date-helpers.ts` neue Helper `startOfDayBerlin`.

### 3.5 Test-Hooks

- QA: Slot anlegen für "heute 08:00–10:00" um 14:30 → erscheint sofort.
- QA: Slot anlegen für "morgen" → erscheint sofort.
- F5-Reload: Liste enthält denselben Slot weiterhin.
- Public-View `/buchen` zeigt heutige Slots, deren Startzeit noch in der
  Zukunft liegt, wie zuvor — keine Regression.

### 3.6 Risk

- **Mittel.** Public-View könnte unbeabsichtigt verstrichene Slots zeigen.
  Mitigation: `to`-Default unverändert, `from` nur auf "heute Mitternacht"
  vorverlegen — verstrichene Slots des heutigen Vormittags sind dann
  *theoretisch* in der Public-Liste, ABER der Buchungs-Endpoint
  (`/api/bookings POST`) lehnt sie sowieso ab (Server-Validierung
  Buchung ≥ now). UI kann optional auf Customer-Seite zusätzlich filtern.

---

## 4. US-IT8-04 — DayOverride-Liste vollständig sichtbar machen

### 4.1 Root Cause (verifiziert)

`src/components/admin/DayOverrideManager.tsx` zeigt **bereits eine Liste**
mit Lösch-Button (Zeilen 275–316). ABER: die Liste ist auf den **aktuell
gewählten Monat** beschränkt (`monthString = year-month`, GET ruft
`/api/admin/day-overrides?month=YYYY-MM`).

`src/app/api/admin/day-overrides/route.ts` Zeilen 50–86: GET unterstützt
**ausschließlich** den `?month=`-Filter (Zod-Schema
`DayOverrideMonthQuerySchema`). Es gibt keinen "alle Einträge"-Modus.

**Folge:** Hat Tom z.B. einen Override für 2026-08-12 angelegt, aber sein
Manager steht auf Mai → Eintrag ist unsichtbar. AC1 verlangt "alle
DayOverrides", nicht nur einen Monat.

### 4.2 Fix-Strategie

**Backend:** GET-Endpoint um optionalen "alle Einträge"-Modus erweitern.

- Wenn `?scope=all` (oder `?month` weggelassen wird), liefere alle Einträge,
  sortiert chronologisch aufsteigend, gecappt auf z.B. 365 Einträge
  (DOS-Schutz).
- Existierende `?month=`-Pfad bleibt unverändert (für FullCalendar-Hintergrund-Layer
  in IT6).

```ts
// Pseudo-Code (route.ts GET)
const scope = url.searchParams.get('scope');
if (scope === 'all') {
  const overrides = await prisma.dayOverride.findMany({
    orderBy: { date: 'asc' },
    take: 365,
  });
  return apiSuccess({ scope: 'all', overrides: overrides.map(serializeOverride) });
}
// sonst: bestehender month-Pfad
```

Response-Form bleibt eingebettet in `apiSuccess({ ... })` →
`{ data: { scope: 'all', overrides: [...] } }`.

**Frontend:** `DayOverrideManager` baut um auf:

1. Default-Modus: "Alle Einträge" (ein einzelner Render aller Overrides,
   sortiert nach Datum aufsteigend).
2. Vergangene Einträge bleiben sichtbar, aber **ausgegraut** (`opacity-60`
   + Badge "vergangen") — siehe AC5.
3. Optional Monatsnavigation entfällt zugunsten einer **Gruppierung nach
   Monat** in der Liste (Header-Zeile pro Monat).
4. Empty-State-Text: „Keine Überschreibungen eingetragen." (AC2 wörtlich).
5. Anlegen + Löschen verhalten sich unverändert; nach Erfolg `load()` neu
   triggern → Liste aktualisiert (analog US-IT8-03).

**Schema-Erweiterung in `contracts/zod-schemas.ts`:**

```ts
export const DayOverrideListAllQuerySchema = z.object({
  scope: z.literal('all'),
});
```

**Optional Backend-Cleanup:** Skript/Cron, das Overrides älter als 1 Jahr
löscht — **nicht Teil dieser Story** (Backlog).

### 4.3 Berührte Dateien

- `src/app/api/admin/day-overrides/route.ts` (GET-Erweiterung `?scope=all`)
- `contracts/zod-schemas.ts` (neues Query-Schema)
- `src/components/admin/DayOverrideManager.tsx` (UI-Umbau auf Gesamtliste)
- `src/lib/api-client.ts` (`fetchAllDayOverrides()` neu)
- `tests/api/day-overrides-scope-all.test.ts` (Smoke-Test).

### 4.4 Test-Hooks

- 3 Overrides anlegen für 3 verschiedene Monate → alle in der Liste sichtbar.
- 1 Override für gestern anlegen → in Liste sichtbar, ausgegraut markiert.
- Löschen eines Eintrags → verschwindet sofort ohne Reload.
- Anlegen → erscheint sofort in Liste.
- Empty-State zeigt korrekten deutschen Text.

### 4.5 Risk

- **Niedrig.** Erweiterung ist additiv, alte `?month=`-Aufrufe bleiben
  kompatibel.
- Skalierungs-Risiko (>365 Einträge): durch `take: 365` begrenzt; wenn
  Tom mehr Einträge hat, wird die UI eine "Älter anzeigen"-Aktion brauchen
  — aktuell unwahrscheinlich (Tom legt < 50 Overrides/Jahr an).

---

## 5. US-IT8-05 — OAuth-Diagnose: Code-Bug vs. Config-Aufgabe

### 5.1 Root Cause (verifiziert)

`src/app/api/auth/diagnose/route.ts` (IT7-Stand) liefert ein flaches JSON
mit `env.*`, `providersActive.*`, `expectedCallbacks.*`, `secret_source`,
`notes`. Es gibt **kein** Per-Check-Status-Feld und **keinen** Top-Level-
Verdikt. Tom muss die Felder manuell mit dem Runbook abgleichen.

### 5.2 Fix-Strategie — Erweitertes Schema (additiv, rückwärtskompatibel)

Bestehende Top-Level-Felder bleiben unverändert (für Skripte, die sie
heute schon parsen). NEU hinzu:

- `checks: Check[]` — array von strukturierten Checks.
- `verdict: { actionRequired: 'code' | 'config' | 'none', summary: string, codeFailures: string[], configActions: string[] }`.

#### 5.2.1 JSON-Schema (verbindlich)

```jsonc
{
  // bestehend (unverändert):
  "env":               { "...": "..." },
  "secret_source":     "AUTH_SECRET" | "NEXTAUTH_SECRET (alias)" | null,
  "providersActive":   { "google": true, "facebook": true, "credentialsCustomer": true, "credentialsAdmin": true },
  "expectedCallbacks": { "admin": "...", "googleC": "...", "facebook": "..." },
  "notes":             ["..."],

  // NEU:
  "checks": [
    {
      "id": "nextauth_url_set",
      "label": "NEXTAUTH_URL ist gesetzt",
      "status": "ok" | "warn" | "fail",
      "actual":   "https://www.baerenstark-hausservice.app",
      "expected": "ohne Trailing-Slash, Schema https://",
      "actionRequired": "none" | "code" | "config",
      "message": "Deutsch, eine Zeile, max 200 Zeichen."
    }
    // weitere Checks: siehe §5.3 Liste
  ],
  "verdict": {
    "actionRequired": "code" | "config" | "none",
    "summary": "Deutsch, 1–2 Sätze.",
    "codeFailures":   ["check.id1", "check.id2"],
    "configActions":  ["Trag in Google Cloud Console …", "Setze AUTH_TRUST_HOST=true …"]
  }
}
```

**Sicherheits-Garantie:** `actual` darf NIEMALS einen Secret-Wert enthalten.
Nur `set: true|false`-äquivalente Strings (z.B. `"set"`, `"unset"`,
`"alias-only"`) oder nicht-sensitive Konfigurationswerte (URL, Boolean-String).

#### 5.2.2 Verdikt-Logik (Pseudo-Code)

```
function computeVerdict(checks):
  codeFailures   = [c.id for c in checks if c.status == "fail" and c.actionRequired == "code"]
  configFailures = [c   for c in checks if c.status in ("fail","warn") and c.actionRequired == "config"]

  if codeFailures.length > 0:
    return {
      actionRequired: "code",
      summary: "Im Code/in der ENV ist mindestens ein Fehler. Engineer muss " +
               "fixen, bevor Tom in der Cloud-Console etwas tun kann.",
      codeFailures,
      configActions: []
    }

  if configFailures.length > 0:
    return {
      actionRequired: "config",
      summary: "Code ist OK. Tom muss in der Cloud-Console oder im Vercel-" +
               "Dashboard die unten gelisteten Schritte ausführen.",
      codeFailures: [],
      configActions: configFailures.map(formatActionString)
    }

  return {
    actionRequired: "none",
    summary: "Alle Checks grün. Falls Login trotzdem fehlschlägt, prüfe Browser-Cookies / Inkognito.",
    codeFailures: [],
    configActions: []
  }
```

### 5.3 Liste der Checks (verbindlich)

| id | label | status-Logik | actionRequired |
|----|-------|--------------|----------------|
| `nextauth_url_set` | NEXTAUTH_URL gesetzt | `fail` wenn unset; `warn` wenn Trailing-Slash; `fail` wenn `http://` in Prod | `code` (ENV-Var ist deploy-config — siehe Hinweis unten) |
| `nextauth_url_format` | NEXTAUTH_URL Format korrekt | `fail` wenn nicht parseable URL | `config` |
| `auth_secret_present` | AUTH_SECRET (oder Alias) gesetzt | `fail` wenn `secret_source == null` | `config` (Vercel-ENV) |
| `auth_secret_length` | AUTH_SECRET ≥ 32 Zeichen | nicht prüfbar (Wert wird nicht geladen) → immer `warn`, Hinweistext | `config` |
| `auth_trust_host_set_in_prod` | AUTH_TRUST_HOST=true wenn NODE_ENV=production | `fail` wenn Prod & nicht "true" | `config` |
| `google_client_id_set` | GOOGLE_CLIENT_ID gesetzt | `fail` wenn unset und Provider aktiv erwartet | `config` |
| `google_client_secret_set` | GOOGLE_CLIENT_SECRET gesetzt | `fail` wenn unset | `config` |
| `google_provider_loaded` | Google-Provider in NextAuth aktiv | `fail` wenn `providersActive.google == false` ABER Tom Google nutzen will | `config` (folgt aus den beiden ENV-Vars) |
| `facebook_client_id_set` | analog | analog | `config` |
| `facebook_client_secret_set` | analog | analog | `config` |
| `expected_callback_google_present` | `expectedCallbacks.googleC` ist plausibel | `fail` wenn `<UNSET>` enthalten | `code` (folgt aus `nextauth_url_set`) |
| `expected_callback_facebook_present` | analog | analog | `code` |
| `resend_api_key_set` | RESEND_API_KEY gesetzt | `warn` wenn unset (Verify-Mails brechen) | `config` |
| `bootstrap_admin_email_set` | BOOTSTRAP_ADMIN_EMAIL gesetzt | `warn` wenn unset (kein neuer Bootstrap möglich) | `config` |

> **Hinweis zu „code" vs. „config" bei ENV-Vars:**
> Strenge Auslegung — fehlende ENV-Vars sind *immer* Config (Vercel-Dashboard
> oder `.env`). Das einzige *echte* `actionRequired: "code"` sind
> Inkonsistenzen, die nur ein Engineer beheben kann (z.B. wenn der Code
> selbst NEXTAUTH_URL nicht richtig liest, oder wenn ein Provider-Builder
> fehlerhaft Provider verschluckt). Aktuell ist mir aus dem Code-Studium
> *kein* solcher Code-Bug bekannt — der Diagnose-Endpoint wird in der Praxis
> für IT8 vermutlich `actionRequired: "config"` ausgeben. Das ist genau die
> Information, die Tom in US-IT8-05 verlangt.

### 5.4 Berührte Dateien

- `src/app/api/auth/diagnose/route.ts` (Erweiterung — additiv).
- `contracts/zod-schemas.ts` — neues `AuthDiagnoseResponseSchema` mit
  `checks` und `verdict` (für FE/Skript-Konsumenten).
- `docs/AUTH_GOOGLE_FIX_RUNBOOK.md` — Update: TOP-1-Schritt heißt jetzt
  „Aufruf `/api/auth/diagnose` und im JSON `verdict.actionRequired` lesen".
- *Optional:* `scripts/auth-check.ts` — CLI, das den Endpoint aufruft und
  eine farbige Tabelle in den Terminal druckt (Tom-Self-Service).

### 5.5 Test-Hooks

- `AUTH_SECRET` unsetzen → `verdict.actionRequired === "config"`,
  `auth_secret_present` ist `fail`.
- Alles korrekt gesetzt → `verdict.actionRequired === "none"`.
- `NEXTAUTH_URL` mit Trailing-Slash → eigener Check `warn`,
  `verdict.summary` sagt klar „Slash entfernen".
- Endpoint in Prod ohne `AUTH_DIAGNOSE_ENABLED=true` → 404 (unverändert,
  IT7-Garantie).

### 5.6 Risk

- **Niedrig.** Additive Änderung, bestehende Felder bleiben.
- Sicherheit: streng prüfen, dass `checks[].actual` **niemals** einen
  Secret-Wert enthält. Code-Review-Punkt für Backend-Engineer.
- Akzeptanz: Story-Erfolg ist explizit „grün/rot-Output", nicht
  funktionierender Login (s. Story-Hinweis).

---

## 6. Aufgaben-Verteilung Backend vs. Frontend

| Story | Backend-Engineer | Frontend-Engineer |
|-------|------------------|-------------------|
| **US-IT8-01** | Route `GET /api/admin/admins`: Response-Shape von `{ data: { data, total } }` auf `{ data: AdminListItem[] }` umstellen (s. §1.2). | `fetchAdmins()` in `api-client-it6.ts` anpassen (Mapper) + Defensive Guard in `AdminUserTable` + Error-Boundary `app/admin/error.tsx`. |
| **US-IT8-02** | — (keine Backend-Änderung) | `AdminCalendarView.tsx` State-Machine umbauen (initialer Range-Fetch, Skeleton als Overlay). |
| **US-IT8-03** | `GET /api/slots` Default-`from` auf "heute 00:00 lokale Zeit" verschieben (s. §3.2 Variante A). Persistenz-Check vor Code-Fix dokumentieren (AC3). | `AdminSlotManager` ruft `fetchSlots({ from, to })` mit explizitem Range (Variante B). |
| **US-IT8-04** | GET `?scope=all` ergänzen + Zod-Schema erweitern + Smoke-Test. | `DayOverrideManager` UI-Umbau auf Gesamtliste mit Past-Markierung; `fetchAllDayOverrides()` im Client. |
| **US-IT8-05** | Diagnose-Endpoint um `checks[]` und `verdict` erweitern (s. §5.2). Schema in `contracts/zod-schemas.ts`. Runbook-Update (Pfad: `docs/AUTH_GOOGLE_FIX_RUNBOOK.md`). | — (kein FE-Render nötig; Tom liest JSON direkt; optional CLI-Pretty-Print). |

**Reine Frontend-Stories:** US-IT8-02.
**Reine Backend-Stories:** US-IT8-05 (modulo optionaler CLI).
**Geteilt (BE führt, FE folgt):** US-IT8-01, US-IT8-03, US-IT8-04.

---

## 7. Build-Reihenfolge (empfohlen)

1. **US-IT8-01** zuerst (BE + FE als ein Commit) — entsperrt Tom unmittelbar.
2. **US-IT8-02** parallel (reines Frontend, kein Konflikt).
3. **US-IT8-03** danach — braucht Persistenz-Check vor Code-Änderung.
4. **US-IT8-04** parallel mit (3) — disjunkte Dateien.
5. **US-IT8-05** kann jederzeit, blockiert nichts; bevorzugt nach (1)–(4),
   damit der Diagnose-Output nicht von anderen Bugs überlagert wird.

---

## 8. Offene Annahmen / nicht verifiziert

- **US-IT8-01:** Verifiziert via Code-Inspektion. Nicht via Browser-Run
  reproduziert — die Schlussfolgerung „weiße Seite" basiert auf der
  Annahme, dass kein Error-Boundary darüber sitzt. Das stützt sich auf
  fehlende `app/admin/error.tsx`-Datei (nicht im Repo gefunden).
- **US-IT8-02:** Nicht verifiziert, dass FullCalendar v6.1.20 wirklich
  alle CSS-Klassen runtime-injiziert — schnellster QA-Test ist „nach Fix
  prüfen, ob Raster sichtbar ist". Falls nicht: zusätzlich
  `import '@fullcalendar/core/main.css'` (oder äquivalent) ergänzen.
- **US-IT8-03:** Nicht direkt mit Prisma Studio verifiziert, dass POST
  korrekt schreibt — Engineer ist verpflichtet, das vor Code-Fix zu prüfen
  (AC3 verlangt es ausdrücklich).
- **US-IT8-04:** Annahme, dass Tom < 365 DayOverrides hat. Wenn doch mehr,
  braucht es Pagination — aktuell nicht eingeplant.
- **US-IT8-05:** Annahme, dass aktuell tatsächlich KEIN Code-Bug vorliegt
  (nur Config). Nicht via Live-Test verifiziert — wird sich beim
  Diagnose-Output zeigen.

---

**Ende ARCHITECTURE_IT8.md**
