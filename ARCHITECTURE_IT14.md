# ARCHITECTURE_IT14 — Iteration 14 Spezifikation

**Owner:** Solution Architect
**Datum:** 2026-05-04
**Revision:** 2 (nach QA_DESIGN_REVIEW_IT14 — 5 Critical + 9 Major adressiert)
**Scope:** 8 Bug- und Härtungs-Stories (kein Neubau, keine Architekturänderung).
**Bezug:** ARCHITECTURE.md (IT12 SoT) bleibt gültig — dieses Dokument
ergänzt nur die Story-spezifischen Diagnosen und Fix-Wege.

> Hinweis: „Hypothese — vom Engineer in Phase 3 zu bestätigen: …" markiert
> Stellen, an denen der Code-Read das Problem stark nahelegt, aber die
> finale Production-Verifikation noch fehlt.

---

## Revision-Log

**2026-05-04 — Rev 2 (nach QA-Review):**
- C-1 (Payment-Method-Enum): final auf `['BANK_TRANSFER', 'CASH']` festgelegt
  (Backend ist Source of Truth). `STRIPE`/`CARD`/`INVOICE` entfallen für IT14
  — siehe §4.5.
- C-2 (S06-Calendar-URL): Detail-Route `/admin/bookings/[id]` wird neu angelegt
  (kein Anker-Pattern). Alignt mit UX-Spec — siehe §5.
- C-3 (S02-Defense-in-Depth-Audit): Audit-Tabelle für alle 14 Admin-Pages
  und 24 Admin-API-Routes ergänzt — siehe §2.6.
- C-4 (S01/S08-Tom-Mitwirkung): expliziter Smoke-Test-Plan für Tom in §1.1
  und §1.3.
- C-5 (Frontend-State nach S04-Fix): Schema-Refactor von `BookingAdminSchema`
  auf `BookingAdminSchemaIT14` ist verbindlich, kein `as`-Cast mehr — siehe
  Frontend-Requirements §5.
- M-S03 (Multi-Select): Frontend-Requirements bestätigen Multi-Select
  (Bestand ist Single, Refactor in IT14).
- M-COUNTER_PROPOSED: Default-Filter zeigt nur `PENDING + CONFIRMED`,
  `COUNTER_PROPOSED` ist standardmäßig **ausgeschlossen** (siehe §3.8).
- M-NULL-paymentMethod-Render: Listen-Badge-Regel ergänzt — kein Badge bei
  NULL (siehe §4.8).
- M-OpenAPI-401-Shape: `{ error: { code, message } }` ist die einheitliche
  Form für **alle** 401/403 (Middleware UND Route-Handler) — siehe §2.7.
- M-Save-Pattern: Bestand bestätigt — Save-Button + `savedTick`-State
  existiert bereits in `FinalPriceEditor.tsx`. Kein Pattern-Wechsel.
- M-Customer-Submit: explizit dokumentiert — `paymentMethod` ist im
  Customer-`POST /api/bookings` weder Input noch Output. Siehe §4.7.
- M-Calendar-URL-für-BUFFER: `url`-Feld nur bei `type='BOOKING'`. Bei
  `BUFFER`/`AVAILABILITY` fehlt das Feld (= `undefined`). Siehe §5.5.
- M-Audit-Booking-Reads: Nur `GET /api/bookings` liest die Liste mit
  `finalPriceEur` aus — andere Endpoints brauchen das Feld nicht.
  Audit-Tabelle in §3.7.

---

## 0. Konsolidierte Bug-Tabelle

| Story | Klassifikation | Datei(en) | Bug-Typ | Fix-Tiefe |
|---|---|---|---|---|
| S01 | Production-Regression | `src/app/api/customer/me/route.ts`, `src/lib/use-customer.ts`, `src/app/buchung/BookingClient.tsx` | Diagnose-Bug (Production-Pfad) | Diagnose + ggf. Edge-Case-Fix |
| S02 | Sicherheits-Härtung | `src/middleware.ts`, `src/lib/auth.config.ts` | Auth-Gate-Lücke | Code-Fix |
| S03 | Frontend-Bug | `src/components/admin/BookingTable.tsx` Zeile 75 | falscher Default-State | 1-Zeilen-Fix |
| S04 | Backend-Bug | `src/app/api/bookings/route.ts` GET-Handler Zeile 107–173 | Response-Mapping vergisst Felder | Backend-Fix (DTO ergänzen) |
| S05 | Feature/Schema | `src/components/admin/BookingTable.tsx`, neuer Booking-Field oder neues PaymentMethod-Konzept | Feld fehlt in Schema + UI | Schema + Migration + UI |
| S06 | Backend-Bug + neue Route | `src/app/api/admin/calendar/events/route.ts` Zeile 149, `src/components/admin/AdminCalendarView.tsx` Zeile 185, **neu:** `src/app/admin/bookings/[id]/page.tsx` + `src/components/admin/AdminBookingDetailView.tsx` | Link auf nicht existente Route | Detail-Route neu anlegen (Rev 2) |
| S07 | Backend-Bug | `src/lib/analytics.ts` `computeAnalyticsRaw` | abhängig von S04 + Default-Range | Diagnose + ggf. Range-Default |
| S08 | Setup-Verifikation | Vercel-ENV `BLOB_READ_WRITE_TOKEN`, ggf. `src/app/api/upload/token/route.ts` Logs | Production-Setup | ENV setzen + Smoke |

**Reihenfolge der Implementierung (Engineering-Priorität):**
S02 (Sicherheit P0) → S04 (Datenintegrität P0) → S07 (Analytics-Reparatur,
hängt an S04) → S03 (1-Zeile, schnellste Win) → S06 (1-Zeile-Frontend) →
S08 (Production-Verifikation, Tom-Aufgabe) → S01 (Production-Diagnose) →
S05 (Feature, neue Migration nötig).

---

## 1. Diagnose-Sektion: S01 / S07 / S08 (Production-Trio)

### 1.1 S01 — Prefill funktioniert in Production nicht

**Ausgangslage Code-Read (IT13-QA bestätigt):** Der Code-Pfad ist sauber.
- `BookingClient.tsx` Zeile 250–259: Skeleton-Gating bis `customerStatus !== 'loading'`.
- `use-customer.ts` Zeile 39–73: Bei `getCustomerMe()` → `null` (HTTP 401)
  → `status='unauthenticated'`. Bei Network/5xx → letzten bekannten
  Status halten.
- `BookingForm.tsx` Zeile 140–161 `defaultValues` aus `customer.firstName`
  + `customer.lastName`, `customer.email`, `customer.phone`,
  Profil-Adresse.
- `useEffect`-`reset()` Zeile 184: nur wenn `!isDirty`.
- `request()` aus `api-client.ts` Zeile 130: `credentials: 'same-origin'`.

**Wahrscheinlichste Root-Causes (in Reihenfolge der Wahrscheinlichkeit):**

1. **NEXTAUTH_URL / Cookie-Domain-Drift in Production (höchste Wahrscheinlichkeit).**
   Der Cookie `customer-session` wird mit `path: '/'`, `sameSite: 'lax'`,
   `secure: NODE_ENV === 'production'` gesetzt
   (`customer-auth.ts` Zeile 141–148). Wenn die Domain während des
   Login-Flows zwischen `baerenstark-hausservice.app` und
   `www.baerenstark-hausservice.app` wechselt (oder Vercel auf einer
   Preview-Subdomain ist), wird das Cookie auf einer anderen Hostname-
   Variante gesetzt als auf der der `/api/customer/me`-Call läuft.
   - **Diagnose:** in den Vercel-Production-Logs nach
     `[GET /api/customer/me]`-Einträgen greppen — wenn diese 401 für
     einen eingeloggten Nutzer zurückgeben, ist das Cookie nicht
     mitgegeben worden. Im Browser-DevTools (Application → Cookies)
     prüfen, ob `customer-session` für `www.baerenstark-hausservice.app`
     gesetzt ist (nicht nur für die nicht-www-Variante).
   - **Fix:** In `next.config.js` oder Vercel-Domains-Settings sicherstellen,
     dass nur eine kanonische Domain (`www.…`) genutzt wird; ggf. Redirect
     vom apex auf www einrichten. `NEXTAUTH_URL` muss exakt auf
     `https://www.baerenstark-hausservice.app` stehen.

2. **`AUTH_SECRET` / `BOOKING_TOKEN_SECRET` / Customer-JWT-Secret-Drift
   nach Re-Deploy.** Die Custom-JWT-Cookies werden mit einem Secret
   signiert. Wenn dieses Secret nach einem Vercel-Re-Deploy geändert oder
   entfernt wurde, sind alle existierenden Sessions kaputt — und das
   `/api/customer/me` antwortet bei verifyJWT-Fehler mit 401.
   - **Diagnose:** Vercel-Dashboard → Project → Settings → Environment
     Variables → den Customer-Session-Secret-Key prüfen. Das exakte ENV-
     Name-Mapping siehe `customer-session.ts` (lies in Phase 3, vermutlich
     `AUTH_SECRET` oder ein dedizierter Key).
   - **Fix:** Secret restoren ODER alle Customer aufgefordert sich erneut
     einzuloggen.

3. **Hydration-Race im Header / im Customer-Sync-Bus
   (`customer-sync.ts`).** `useCustomer()` subscribed auf
   `onCustomerChanged()`. Wenn ein anderes Element der Seite
   `emitCustomerChanged()` triggert, bevor das initiale `fetchMe()` durch
   ist, kann der Status-Übergang `loading → unauthenticated → authenticated`
   stattfinden — das Skeleton würde aber bereits verschwinden im
   `unauthenticated`-Zwischenzustand.
   - **Diagnose:** lokal mit künstlicher Latenz (DevTools-Throttling)
     reproduzieren; Logs `console.debug` an drei Stellen einbauen
     (`fetchMe enter / exit / status`).
   - **Fix:** Hypothese — vom Engineer in Phase 3 zu bestätigen: ggf.
     `lastKnownStatusRef.current` defensive auf 'loading' halten bis der
     erste fetch erfolgreich war.

4. **`getCustomerMe()` selbst gibt 401, aber das DB-Lookup im Endpoint
   bricht mit Prisma-Fehler (P1001, Connection-Timeout auf libSQL).** Bei
   Prisma-Init-Fehler wirft der Endpoint 500 → der `getCustomerMe`-Catch
   würde aber **nur** bei 401 nullen, sonst werfen. Der `useCustomer`-
   Hook fängt das in `catch` (Zeile 52) und hält den letzten Status.
   - **Diagnose:** Vercel-Logs nach `[GET /api/customer/me]` plus
     `prismaCode=P1001` filtern. IT13 hat das `internalError`-Logging
     bereits eingebaut.

**Diagnose-Reihenfolge in Phase 3:**
```
1. Production browser DevTools: Cookie 'customer-session' für www.… vorhanden?
2. Vercel-Logs: vercel logs --since=30m | grep "GET /api/customer/me"
   → Status 401? Status 500? prismaCode=P*?
3. Vercel ENV: AUTH_SECRET / BOOKING_TOKEN_SECRET / NEXTAUTH_URL exakt gesetzt?
4. NetworkTab: Request-Header → wird Cookie 'customer-session' mitgesendet?
5. Falls alles OK: Hydration-Race lokal mit Throttling reproduzieren.
```

**Hypothese — vom Engineer in Phase 3 zu bestätigen:** Die wahrscheinlichste
Ursache ist Punkt 1 oder 2 — beides Production-Setup-Defekte, KEIN Code-Bug.

#### 1.1.1 Smoke-Test-Plan für Tom (S01 Production-Diagnose)

**Diese Schritte muss Tom ausführen — Engineer kann sie nicht ohne
Production-Zugriff erledigen. Plan-B-Subtask, falls Tom nicht reagiert:
Engineer baut den defensiven Hydration-Guard aus
`frontend-requirements-it14.md` §6 ein und dokumentiert das im PR.**

```
Hallo Tom — bitte 5 Minuten:

1. Öffne in Chrome (NICHT Inkognito) https://www.baerenstark-hausservice.app
   und logge dich als Kunde ein.
2. Gehe zu /buchen.
   - Sind dein Name, E-Mail, Telefon und Adresse vorausgefüllt? (JA/NEIN)
   - Mach einen Screenshot der Felder.
3. Öffne Chrome DevTools (F12) → Tab "Application" → "Cookies" →
   https://www.baerenstark-hausservice.app
   - Findest du einen Cookie-Eintrag „customer-session"? Domain?
   - Screenshot.
4. Tab "Network" → Filter "me" → Lade /buchen neu (Strg+R).
   - Klick auf den /api/customer/me-Request.
   - Status-Code? (200, 401, 500, ...) Screenshot.
5. Vercel-Dashboard → baerenstark-hausservice → Deployments → aktueller
   Production-Deployment → Logs.
   - Filtere die letzten 30 Min auf "/api/customer/me".
   - Wenn 401: Screenshot der Zeile.
   - Wenn 500 oder „prismaCode": Screenshot — dann ist es Hypothese 4.

Wenn alle Punkte 200 anzeigen UND der Cookie da ist UND Tom trotzdem
keine Prefill sieht → Hydration-Race lokal beim Engineer reproduzieren
(Hypothese 3, defensiver Patch in `useCustomer`).
```

---

### 1.2 S07 — Analytics zeigt abgeschlossene Aufträge nicht

**Ausgangslage Code-Read (`src/lib/analytics.ts` + `route.ts`):**

- `AnalyticsQuerySchema` Default-Range: `'12m'` (12 Monate).
  `AnalyticsDashboard.tsx` Zeile 50 nutzt ebenfalls `useState<AnalyticsRange>('12m')`.
- `computeAnalyticsRaw` Zeile 152–159 filtert wie folgt:
  ```ts
  prisma.booking.findMany({
    where: {
      status: 'COMPLETED',                    // ← nur 'COMPLETED'
      date: { not: null, gte: from, lte: to }, // ← Booking.date (TEXT)
      finalPriceEur: { not: null },           // ← Buchungen ohne Preis fallen raus
    },
  })
  ```
- KPI „Buchungen diesen Monat" (Zeile 175–180) zählt mit
  `status='COMPLETED'` + `date startsWith YYYY-MM`.

**Root-Cause-Reihenfolge:**

1. **Direkter Side-Effect von S04 (Preis-Persistierung kaputt):** Wenn Toms
   `finalPriceEur` nicht in der DB landet (S04-Bug), filtert
   `finalPriceEur: { not: null }` jeden abgeschlossenen Auftrag heraus.
   Analytics ist damit per Definition leer. — **S04 muss zuerst gefixt sein**;
   danach kann S07 erneut verifiziert werden.

2. **Status-Wert-Mismatch:** Code prüft auf `'COMPLETED'`. Die State-Machine
   in `src/app/api/admin/bookings/[id]/route.ts` (`ADMIN_ALLOWED_TRANSITIONS`)
   erlaubt CONFIRMED → COMPLETED. Im Schema ist der einzige Endwert für
   abgeschlossene Aufträge `'COMPLETED'` (`prisma/schema.prisma` Zeile 204).
   Es gibt KEIN `'DONE'` und KEIN `'PAID'` als Booking-Status — `'PAID'`
   ist Stripe-Payment-Status, nicht Booking-Status. **Entscheidung:**
   `'COMPLETED'`-only-Filter ist semantisch korrekt. **Keine Erweiterung
   auf `'DONE'`/`'PAID'` nötig** — dieser Lehrbuch-Vorschlag aus dem
   Story-Hinweis-Block trifft auf diese Codebase nicht zu.

3. **Range-Bound auf `Booking.date` statt auf `updatedAt` / `completedAt`:**
   `Booking.date` ist das **Termindatum** (an dem der Auftrag durchgeführt
   werden soll), nicht das Datum der Status-Änderung auf COMPLETED. Wenn
   Tom heute (2026-05-04) einen Auftrag abschließt, dessen Termin im
   Februar 2025 lag, fällt er bei einem `12m`-Range
   (`gte=2025-05-05, lte=2026-05-04`) **knapp** noch rein — bei einem
   `30d` oder `90d`-Range fällt er heraus. Das ist semantisch strittig:
   - **Pro `Booking.date`:** Umsatz wird dem Tag zugeordnet, an dem die
     Leistung erbracht wurde — ist betriebswirtschaftlich „korrekter".
   - **Pro `updatedAt`:** Tom sieht den Umsatz dann, wenn er ihn
     erfasst — passt zur Anforderung „Tom hat einen Auftrag abgeschlossen
     und den Endpreis notiert — dieser erscheint nicht".
   - **Architect-Empfehlung:** Bestand belassen (`Booking.date`),
     **Default-Range bleibt 12m** — genug Toleranz dass abgeschlossene
     Aufträge der letzten 12 Monate sichtbar sind. Nur falls Tom in der
     Verifikation einen Auftrag hat, dessen `date` weiter zurückliegt als
     der gewählte Range, dokumentieren wir den 12m-Default als
     verbindlich (kein „30d" als Default).

4. **Cache-Stale (`unstable_cache` mit `revalidate: 300`):** Der Cache-Tag
   `analytics` wird invalidiert, wenn `finalPriceEur` geschrieben wird
   (`bookings/[id]/route.ts` Zeile 220, 224 → `revalidateTag('analytics')`).
   **Hypothese — vom Engineer in Phase 3 zu bestätigen:** wenn S04
   tatsächlich keinen DB-Update macht (Frontend zeigt Erfolg, Backend
   updated nichts), wird der Tag zwar invalidiert, aber im erneuten
   Compute findet die Aggregation nichts. → Symptom identisch.

**Fix-Plan S07 (nach S04):**
- Sicherstellen, dass nach S04-Fix der Default-Range 12m greift (kein
  hard-coded `30d`).
- AC#4 („Auftrag ohne Endpreis: 0 € statt komplett verschwinden") **ändert
  die Filter-Semantik**: `finalPriceEur: { not: null }` müsste raus,
  Aggregation muss `null` als 0 € behandeln. Engineer-Aufgabe in Phase 3:
  diesen Filter-Block aufweichen oder eine zweite Liste „Abgeschlossen
  ohne Preis" rendern. Architect-Vorschlag: Filter behalten für die
  KPIs (Umsatz/Avg), aber eine separate Sektion „Abgeschlossene Aufträge
  insgesamt" mit/ohne Preis zeigen — damit ist AC#4 erfüllt ohne
  KPI-Verzerrung.

---

### 1.3 S08 — Image-Upload funktioniert in Production nicht

**Ausgangslage Code-Read (IT13-QA bestätigt):** Code-Pfad ist robust.
- `POST /api/upload/token` (`route.ts`) hat:
  - `BLOB_READ_WRITE_TOKEN`-Check Zeile 167–176 → 503 BLOB_NOT_CONFIGURED.
  - Try/Catch um `generateClientTokenFromReadWriteToken` Zeile 198–230 →
    `logRequestError` + 500 + `X-Request-Id`-Header.
- `PATCH /api/upload/attachments/[id]` (Confirm-Step) ist idempotent.
- Frontend `FileUpload.tsx` mappt deutsche Fehler inkl. `BLOB_NOT_CONFIGURED`.

**Wahrscheinlichste Root-Causes (in Reihenfolge):**

1. **`BLOB_READ_WRITE_TOKEN` fehlt in der Production-ENV.**
   - **Diagnose:** Vercel → Project → Settings → Environment Variables
     → für „Production" `BLOB_READ_WRITE_TOKEN` muss gesetzt sein.
   - **Symptom:** `POST /api/upload/token` antwortet 503 mit
     `code: 'BLOB_NOT_CONFIGURED'`. Frontend zeigt deutsche Meldung
     „Datei-Upload ist nicht konfiguriert".
   - **Log-Grep:** `vercel logs --since=15m | grep "BLOB_NOT_CONFIGURED"`.

2. **Token gehört zu nicht (mehr) existierendem Vercel-Blob-Store.** Ein
   Token-Drift nach Store-Reinitialisierung oder Project-Reconnect.
   - **Diagnose:** `vercel logs --since=15m | grep "POST /api/upload/token"`
     filtern auf Status 500. Im Log-Eintrag erscheint dann der konkrete
     Vercel-Blob-SDK-Fehler (z.B. `BlobAccessError: not found`).
     `X-Request-Id`-Header korreliert.
   - **Fix:** Token aus dem Vercel-Dashboard neu kopieren (Storage → Blob-
     Store → „Connect to Project" → neuer Token wird automatisch in den
     Project-ENVs gesetzt) und re-deploy.

3. **`BLOB_READ_WRITE_TOKEN` ist gesetzt, aber Token-Generation läuft in
   Vercel-Hobby-10s-Timeout.** Unwahrscheinlich, weil die Token-Generation
   selbst <50 ms dauert. Würde sich aber in Logs als 504/Timeout zeigen.

4. **Frontend-`put()` schlägt fehl, weil Browser → Vercel Blob durch eine
   Firewall blockiert wird (Tom-spezifisches Netzwerk).** Würde im
   Browser-NetworkTab als CORS- oder Network-Error zu sehen sein. Sehr
   unwahrscheinlich.

**Diagnose-Schritt-für-Schritt (in Phase 3):**
```
1. Vercel ENV: BLOB_READ_WRITE_TOKEN für Production gesetzt?
   Wenn nein → Vercel Dashboard → Storage → Blob → Connect to Project.
2. Production-Test: kleines JPEG (<1 MB) hochladen, X-Request-Id notieren.
3. vercel logs --since=10m | grep <X-Request-Id>:
   - 503 BLOB_NOT_CONFIGURED → Token fehlt.
   - 500 mit BlobAccessError im Log → Token-Drift, neu setzen.
   - 200 + Confirm-Step 404 → BookingAttachment-Pre-Insert hat versagt
     (Prisma-Fehler im Pre-Insert).
   - 200 + Confirm-Step 409 → Idempotenz-Edge-Case, kein Bug.
```

**Code-Änderung in IT14 nicht erwartet** — falls die Token-Setup-Schritte
nicht reichen, ist eine Code-Änderung nur dann fällig, wenn ein neuer
Edge-Case im Log auftaucht. Architect dokumentiert hiermit, dass der
IT13-Direct-Upload-Flow als Architektur unverändert bleibt.

#### 1.3.1 Smoke-Test-Plan für Tom (S08 Production-Diagnose)

**Engineer-Plan-B falls Tom nicht reagiert: kein Code-Fix möglich, Story
bleibt auf „Diagnose-blockiert" — `BLOB_READ_WRITE_TOKEN` ist eine
Vercel-ENV, die nur Tom setzen kann.**

```
Hallo Tom — bitte 5 Minuten:

1. Vercel-Dashboard → baerenstark-hausservice → Settings → Environment
   Variables.
   - Existiert „BLOB_READ_WRITE_TOKEN" für „Production"? (JA/NEIN)
   - Wenn nein → Storage → Blob Store → „Connect to Project". Token wird
     automatisch gesetzt. Re-Deploy.
2. Falls Token existiert: öffne https://www.baerenstark-hausservice.app/buchen
   und versuche ein kleines JPEG (<1 MB) hochzuladen.
   - Wenn Fehler: notiere die deutsche Fehlermeldung wortwörtlich.
   - Öffne Chrome DevTools → Network → Filter "upload" → Klick auf den
     fehlerhaften Request → Header-Tab → notiere "X-Request-Id".
   - Screenshot.
3. Vercel-Dashboard → Deployments → aktueller Prod → Logs → letzte 10 Min.
   - Filtere auf die X-Request-Id aus Schritt 2.
   - Screenshot der Log-Zeile.

Erwartete Auswertung durch Engineer:
- 503 BLOB_NOT_CONFIGURED → Token-ENV fehlt → Tom setzt sie + Re-Deploy.
- 500 BlobAccessError → Token gehört zu nicht-existentem Store → Tom
  reconnectet im Vercel Dashboard.
- 200 + Confirm-Step 4xx → wirklicher Code-Bug, Engineer fixt.
```

---

## 2. S02 — Admin Auth-Gate (P0)

### 2.1 Aktueller Stand

`src/middleware.ts` Zeile 68–91 (im NextAuth-`auth()`-Wrapper):
```ts
if (!pathname.startsWith('/admin')) return NextResponse.next();

const isPublicAdmin = PUBLIC_ADMIN_PATHS.some(...);
if (isPublicAdmin) return NextResponse.next();

const isLoggedIn = !!req.auth?.user;  // ← NextAuth-Admin-Session
if (isLoggedIn) return NextResponse.next();

return NextResponse.redirect(new URL('/admin/login', req.nextUrl.origin));
```

`req.auth` kommt aus `NextAuth(authConfig)`. **Wichtig:** dieser
NextAuth-Default liest das **Admin-Cookie** (`__Secure-next-auth.session-token`
in Production, `next-auth.session-token` in Dev). Das Customer-Cookie
ist bewusst umbenannt auf `__customer-next-auth.session-token`
(`customer-oauth.ts` Zeile 477) — eine Cookie-Kollision ist also
ausgeschlossen.

Auf den ersten Blick sieht der Gate **korrekt** aus. Tom's Beobachtung
„Admin-Seite nicht korrekt gesichert" muss daher eine konkrete Lücke
sein. Mögliche Bugs:

**Hypothese A — ein Customer-Account-Cookie wird trotz Naming-Trennung
als Admin-Auth akzeptiert.** Sehr unwahrscheinlich, weil NextAuth strikt
nur sein eigenes Cookie liest. Müsste in Phase 3 mit einem Curl-Test
(`curl -i --cookie "__customer-next-auth.session-token=...; __Secure-next-auth.session-token="
https://www.baerenstark-hausservice.app/admin`) verifiziert werden.

**Hypothese B — Tom hat vor Tagen mit demselben Browser eine Admin-Session
aufgebaut und dieses Cookie ist noch gültig.** „Admin-Seite ist nicht
gesichert" kann auch heißen „Tom kann sie aufrufen ohne Login-Form" —
weil sein Cookie schon da war.
- **Diagnose:** im Inkognito-Modus testen → Inkognito kennt das Cookie
  nicht → wenn dann der Redirect erscheint, ist das System OK und Tom's
  Beobachtung ein Mess-Artefakt.

**Hypothese C — `requireActiveAdmin()` in Server-Components prüft den
DISABLED-Status, aber **nicht** der Middleware-Pfad.** Ein Admin mit
`status='DISABLED'` würde durch die Middleware kommen (Cookie ist
gültig), aber dann von der Server-Component umgeleitet. Das ist KEIN
Datenleck (Page wird nie gerendert), aber Tom könnte den Effekt als
„nicht gesichert" wahrnehmen.

**Hypothese D — die `/api/admin/**`-Routen haben unterschiedliche Auth-
Checks.** Liste prüfen (siehe §2.3): jede Route muss `requireAdmin()`
am Anfang haben. Im IT13-Codebase ist das überall der Fall (z.B.
`PATCH /api/admin/bookings/[id]` Zeile 67). **Hypothese — vom Engineer
in Phase 3 zu bestätigen:** vollständig auditieren.

### 2.2 Wo der Gate eingebaut wird

**Entscheidung:** Edge-Middleware ist die Pflicht-Verteidigung für **alle
`/admin/**`-Pfade**. Server-Component-`requireActiveAdmin()` bleibt als
zweite Schicht (DISABLED-Check + Audit-Trail in `lastLoginAt`).

Die Middleware ist die einzige Stelle, an der ein Request **vor** dem
Rendering blockiert werden kann — Server-Components rendern bereits, der
Redirect kommt zu spät, um das HTML aus der Render-Pipeline zu halten
(Vercel-Edge cached u.U. ein 200-Response vor dem Server-Redirect).

### 2.3 Geschützte und ausgeschlossene Pfade

**Zu schützen:**
- Alle `/admin/**` (außer der Whitelist unten).
- Alle `/api/admin/**` (NextAuth + `requireAdmin()` im Route-Handler —
  doppelt: Middleware-Layer als Catch-All, Route-Handler-Layer als
  Defense-in-Depth).

**Whitelist (kein Auth-Gate):**
- `/admin/login`
- `/admin/setup`
- `/admin/passwort-vergessen`
- `/admin/passwort-reset`
- `/admin/passwort-reset/**` (Token in URL)
- `/api/auth/[...nextauth]` — NextAuth eigene Route, MUSS unauth
  erreichbar sein (sonst kein Login möglich).
- `/api/admin/setup` — Bootstrap-Admin-Erstanlage (lebt unter
  `/api/admin/**`, ist aber **public** wenn `count(users)==0`).
- `/api/admin/forgot-password`, `/api/admin/reset-password` — public
  (Reset-Mail empfangen ohne Login).

**Keine Whitelist (alle anderen `/api/admin/**` brauchen
`requireAdmin()`):**
- `/api/admin/users/**`
- `/api/admin/bookings/**`
- `/api/admin/calendar/**`
- `/api/admin/availability-template`
- `/api/admin/day-overrides`
- `/api/admin/buffer-config`
- `/api/admin/reviews/**`
- `/api/admin/analytics`
- `/api/admin/marketing/**`
- `/api/admin/upcoming-bookings`
- `/api/admin/admins/**`

### 2.4 Code-Skizze (Pseudocode)

```ts
// src/middleware.ts — IT14-S02 Reinforcement

const PUBLIC_ADMIN_PATHS = [
  '/admin/login',
  '/admin/setup',
  '/admin/passwort-vergessen',
  '/admin/passwort-reset',
];

const PUBLIC_ADMIN_API_PATHS = [
  '/api/auth/',           // NextAuth itself (Admin + Customer)
  '/api/admin/setup',     // Bootstrap
  '/api/admin/forgot-password',
  '/api/admin/reset-password',
];

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Customer-Bereich: bestehender handleKonto-Pfad, unverändert.
  if (pathname.startsWith('/konto')) { ... }

  // Admin-API absichern (Defense-in-Depth — Route-Handler hat
  // zusätzlich requireAdmin(), aber Middleware blockt früher).
  if (pathname.startsWith('/api/admin')) {
    const isPublic = PUBLIC_ADMIN_API_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (isPublic) return NextResponse.next();
    if (req.auth?.user) return NextResponse.next();
    return new NextResponse(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Bitte einloggen.' }}),
      { status: 401, headers: { 'Content-Type': 'application/json' }}
    );
  }

  // Admin-UI absichern.
  if (pathname.startsWith('/admin')) {
    const isPublic = PUBLIC_ADMIN_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (isPublic) return NextResponse.next();
    if (req.auth?.user) return NextResponse.next();
    const loginUrl = new URL('/admin/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/admin/:path*',
    '/konto/:path*',
    '/api/admin/:path*',  // ← NEU: Middleware schützt jetzt auch die API.
  ],
};
```

**Wichtige Details:**
- `req.auth?.user` greift NUR auf das **Admin-NextAuth-Cookie**
  (`__Secure-next-auth.session-token` / `next-auth.session-token`) — das
  Customer-Cookie hat einen anderen Namen
  (`__customer-next-auth.session-token`) und wird hier nie gelesen.
- Customer-Sessions sollen **nicht** in `/admin/**` einlassen — der
  obige Code ist da bereits korrekt (Customer-Cookie ist NextAuth
  fremd und wird ignoriert).
- Für `/api/admin/**` gibt die Middleware **JSON 401** zurück (kein
  Redirect — API-Clients erwarten JSON, kein HTML).

### 2.5 AC-Verifikation

| AC | Ergebnis durch obigen Fix |
|---|---|
| AC#1 (302 auf `/admin/login` ohne Cookie) | ✓ Middleware-Branch |
| AC#2 (Customer-Account → 403 / Redirect) | ✓ Customer-Cookie ist NextAuth-Admin fremd → wie unauth |
| AC#3 (Admin → Dashboard) | ✓ Bestand |
| AC#4 (`/api/admin/**` ohne Session → 401/403) | ✓ Middleware-API-Branch + bestehender `requireAdmin()` |
| AC#5 (`curl -i .../admin` → 302 ohne HTML-Body) | ✓ |

### 2.6 Defense-in-Depth-Audit (S02 Acceptance-Liste für Engineer)

**Drei-Schicht-Strategie:**

1. **Schicht 1 — Edge-Middleware (`src/middleware.ts`)**: schützt
   `/admin/**` und `/api/admin/**` per `matcher`. Public-Whitelist siehe
   §2.3. **P0** — verhindert dass nicht-eingeloggte Anfragen überhaupt
   ins Routing gelangen.
2. **Schicht 2 — `app/admin/layout.tsx`**: ruft `auth()` und redirected
   bei fehlender Admin-Session — fängt Race-Conditions auf, wenn die
   Middleware-Edge-Cache stale ist.
3. **Schicht 3 — Server-Components & Route-Handler**: rufen
   `requireActiveAdmin()` (Pages) bzw. `requireAdmin()` (Routes) — prüfen
   zusätzlich `User.status === 'ACTIVE'` und liefern den Audit-Trail
   (lastLoginAt, etc.).

**Audit-Tabelle Pages (`src/app/admin/**/page.tsx` + `layout.tsx`)** —
Stand: `requireActiveAdmin()`-Aufruf ja/nein. Engineer-Aufgabe in
Phase 3: für jede Zeile mit „NEIN — TODO" den Helper einbauen.

| Datei | Aktueller Auth-Gate | Soll | Status |
|---|---|---|---|
| `src/app/admin/layout.tsx` | (kein Aufruf) | `await requireActiveAdmin()` einfügen (Schicht 2) | **NEIN — TODO (P0)** |
| `src/app/admin/page.tsx` | `requireActiveAdmin()` (Z. 21) | OK | OK |
| `src/app/admin/admins/page.tsx` | `requireActiveAdmin()` (Z. 19) | OK | OK |
| `src/app/admin/analytics/page.tsx` | `requireActiveAdmin()` (Z. 24) | OK | OK |
| `src/app/admin/calendar/page.tsx` | `requireActiveAdmin()` (Z. 22) | OK | OK |
| `src/app/admin/marketing/page.tsx` | `requireActiveAdmin()` (Z. 19) | OK | OK |
| `src/app/admin/reviews/page.tsx` | `requireActiveAdmin()` (Z. 22) | OK | OK |
| `src/app/admin/users/page.tsx` | `requireActiveAdmin()` (Z. 19) | OK | OK |
| `src/app/admin/bookings/page.tsx` | (kein Aufruf — redirected zu `/admin`) | `requireActiveAdmin()` ergänzen (vor Redirect) | **NEIN — TODO (P1)** |
| `src/app/admin/slots/page.tsx` | (kein Aufruf — Engineer prüfen) | `requireActiveAdmin()` ergänzen | **NEIN — TODO (P1)** |
| `src/app/admin/login/page.tsx` | (Public — Whitelist) | KEIN Aufruf — Public-Page | OK (Public) |
| `src/app/admin/setup/page.tsx` | (Public — Bootstrap) | KEIN Aufruf — Public bei `count(users)==0` | OK (Public) |
| `src/app/admin/passwort-vergessen/page.tsx` | (Public — Whitelist) | KEIN Aufruf | OK (Public) |
| `src/app/admin/passwort-reset/page.tsx` | (Public — Token-URL) | KEIN Aufruf | OK (Public) |
| **NEU: `src/app/admin/bookings/[id]/page.tsx`** | (existiert nicht — wird in S06 angelegt) | `await requireActiveAdmin()` AM ANFANG | **NEIN — TODO (S06)** |

**Audit-Tabelle Route-Handler (`src/app/api/admin/**/route.ts`)** —
Engineer-Aufgabe: alle Zeilen mit „session = await auth()" auf
`requireAdmin()` migrieren (Konsistenz + DISABLED-Check).

| Datei | Aktueller Check | Soll | Status |
|---|---|---|---|
| `api/admin/admins/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/admins/[id]/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/analytics/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/availability-template/route.ts` | `auth()` | → `requireAdmin()` migrieren | **NEIN — TODO (P1)** |
| `api/admin/bookings/[id]/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/bookings/[id]/payment/route.ts` | `auth()` | → `requireAdmin()` migrieren | **NEIN — TODO (P1)** |
| `api/admin/buffer-config/route.ts` | `auth()` | → `requireAdmin()` migrieren | **NEIN — TODO (P1)** |
| `api/admin/calendar/events/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/day-overrides/route.ts` | `auth()` | → `requireAdmin()` migrieren | **NEIN — TODO (P1)** |
| `api/admin/day-overrides/[id]/route.ts` | `auth()` | → `requireAdmin()` migrieren | **NEIN — TODO (P1)** |
| `api/admin/forgot-password/route.ts` | (kein Check) | KEIN Check — Public (Reset-Mail) | OK (Public) |
| `api/admin/marketing/emails/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/marketing/emails/[id]/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/marketing/emails/[id]/send/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/marketing/emails/[id]/test-send/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/marketing/recipients/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/reset-password/route.ts` | (kein Check) | KEIN Check — Public (Token-URL) | OK (Public) |
| `api/admin/reviews/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/reviews/[id]/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/setup/route.ts` | (kein Check) | KEIN Check — Bootstrap-Public | OK (Public) |
| `api/admin/upcoming-bookings/route.ts` | `auth()` | → `requireAdmin()` migrieren | **NEIN — TODO (P1)** |
| `api/admin/users/route.ts` | `requireAdmin` | OK | OK |
| `api/admin/users/[id]/route.ts` | `requireAdmin` | OK | OK |

**Engineer-TODO-Liste (P0/P1):**
- **P0:** `src/app/admin/layout.tsx` — `requireActiveAdmin()` einfügen
  (Schicht 2 Defense-in-Depth).
- **P1:** 6 Route-Handler von `auth()` auf `requireAdmin()` migrieren
  (siehe Tabelle oben). Liefert konsistente 401/403-Shape.
- **P1:** 2 Pages (`bookings/page.tsx`, `slots/page.tsx`) —
  `requireActiveAdmin()` ergänzen.
- **S06:** Neue `bookings/[id]/page.tsx` startet mit
  `await requireActiveAdmin()`.

**Threat-Model-Hinweis (verifiziert):** Cookie-Manipulation
(`__Secure-next-auth.session-token=invalid` in DevTools setzen) wird von
NextAuth verworfen, weil `decode(JWT)` ohne `AUTH_SECRET`-Signatur
fehlschlägt → `req.auth?.user` ist `undefined` → Middleware redirected.
**Voraussetzung:** `AUTH_SECRET` ist in Production gesetzt und nicht
geleakt. Tom-Aufgabe: einmalig im Vercel-Dashboard prüfen.

**Server-Action-Hinweis:** Die Codebase hat aktuell **keine** Admin-
Server-Actions — alle Admin-Mutationen laufen über Route-Handler unter
`/api/admin/**`, die durch die Middleware geschützt sind. Falls in
einer späteren Iteration Admin-Server-Actions eingeführt werden, muss
der Middleware-Matcher um den passenden Path-Prefix erweitert werden.

### 2.7 Einheitliche 401/403-Response-Shape

**Beide** Schichten (Middleware-`/api/admin/**`-Branch UND
`requireAdmin()`-Helper im Route-Handler) liefern dasselbe JSON-Format —
sonst sieht ein Frontend-Client widersprüchliche Fehler-Bodies, je
nachdem auf welcher Schicht der Request abgebrochen wurde.

**Kanonische Shape (Vertrag):**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Bitte einloggen."
  }
}
```
- HTTP-Status `401` → `code: 'UNAUTHORIZED'`.
- HTTP-Status `403` → `code: 'FORBIDDEN'` (Account deaktiviert).
- Content-Type: `application/json`.

**Implementierung Middleware** (`src/middleware.ts` §2.4 — bereits
korrekt im Pseudocode). Engineer prüft, dass das exakt identische
Format wie `apiError({ code: 'UNAUTHORIZED', ... })` aus
`require-admin.ts` Zeile 64–68 herauskommt.

**Smoke-Verifikation:**
```
curl -i https://www.baerenstark-hausservice.app/api/admin/bookings
# erwartet: 401 + body { "error": { "code": "UNAUTHORIZED", ... } }

curl -i -H "Cookie: __Secure-next-auth.session-token=invalid" \
  https://www.baerenstark-hausservice.app/admin
# erwartet: 302 redirect to /admin/login (kein 200, kein HTML-Leak).
```

---

## 3. S04 — Preis-Persistierung

### 3.1 Felder im Schema (verifiziert)

`prisma/schema.prisma` Zeile 254–262:
```prisma
finalPriceEur  Decimal?    // SQLite-Decimal, App-Layer 0..100000.
finalPriceNote String?     // App-Layer max 200 chars.
```

### 3.2 Update-Endpoint (verifiziert)

`PATCH /api/admin/bookings/[id]` (`src/app/api/admin/bookings/[id]/route.ts`):
- Zeile 84: `AdminBookingPatchSchema.parse(json)` → akzeptiert
  `finalPriceEur` (Komma→Punkt-Normalisierung in `zod-schemas.ts`
  Zeile 2090–2109).
- Zeile 119–127: schreibt `updateData.finalPriceEur` und
  `updateData.finalPriceNote` korrekt.
- Zeile 246–253: Response enthält `finalPriceEur` (als String) und
  `finalPriceNote`.

**Backend-Update-Pfad ist OK.** Kein Bug im PATCH-Handler.

### 3.3 Frontend-Submit (verifiziert)

`src/components/admin/FinalPriceEditor.tsx` Zeile 95–98:
```ts
await patchAdminBooking(bookingId, {
  finalPriceEur: v.value,
  finalPriceNote: noteInput.trim() === '' ? null : noteInput.trim(),
});
```

`src/lib/api-client-it6.ts` Zeile 326–335 sendet das Payload korrekt
als JSON-Body. **Frontend-Submit ist OK.**

### 3.4 BUG: GET /api/bookings (admin list) liefert finalPriceEur NICHT zurück

**`src/app/api/bookings/route.ts` Zeile 107–173 — der GET-Handler mappt
das Booking-Objekt manuell auf das Response-DTO:**

```ts
const data = bookings.map((b) => ({
  id: b.id,
  slot: ...,
  date: b.date,
  // ... alle Felder explizit ...
  payment: ...,
  createdAt: ...,
  updatedAt: ...,
  // ← KEIN finalPriceEur, KEIN finalPriceNote!
}));
```

**Das ist der Bug.** Der PATCH speichert korrekt, aber:
1. Frontend `BookingTable.tsx` ruft `fetchBookings()` →
   `GET /api/bookings`.
2. Response enthält `finalPriceEur` **nicht**.
3. `BookingTable.tsx` Zeile 287–303 + 469–475 liest
   `(b as BookingAdmin & { finalPriceEur?: ... }).finalPriceEur` →
   `undefined` → wird im Editor leer dargestellt.
4. Tom: „der Preis wurde nicht gespeichert" — **falsch**, der Preis IST
   in der DB, wird nur nicht in die Liste übertragen.

**Verifikation:** Der `FinalPriceEditor` updatet beim Speichern den
lokalen State korrekt (`onSaved`-Callback in `BookingTable.tsx` Zeile
477–490). **Solange Tom auf der Seite bleibt, sieht er den Preis** —
beim Reload (oder Re-fetch via `load()` z.B. nach einer Status-Aktion
Zeile 131) verschwindet er.

### 3.5 Klassifikation

**Backend-Bug** im DTO-Mapping. Der PATCH ist korrekt; nur der
GET-List-Endpoint vergisst die zwei Felder.

### 3.6 Fix (Backend, ein Patch)

`src/app/api/bookings/route.ts` Zeile 107 ff.: dem `data.map(b => ({...}))`
zwei Felder hinzufügen:

```ts
finalPriceEur: b.finalPriceEur != null ? String(b.finalPriceEur) : null,
finalPriceNote: b.finalPriceNote ?? null,
```

(Prisma-Decimal serialisiert als `Decimal`-Instance — `String(...)` macht
daraus einen `'123.00'`-String, was `BookingAdminSchemaIT6` erwartet.)

**Sekundärer Fix (kosmetisch):** der Endpoint sollte `BookingAdminSchemaIT6`
statt `BookingAdminSchema` als typischer Output-Vertrag dokumentieren.
Engineer-Aufgabe in Phase 3.

### 3.7 Audit aller Booking-Read-Endpoints (S04 + S05)

Engineer-Aufgabe: nach S04+S05-Fix muss diese Tabelle stimmen.

| Endpoint | Liefert `finalPriceEur` heute? | Soll | Aktion |
|---|---|---|---|
| `GET /api/bookings` (Admin-Liste) | NEIN (Bug, siehe §3.4) | JA inkl. `finalPriceNote`, `paymentMethod` | **FIX** |
| `GET /api/bookings/[id]/public-summary` | NEIN | NEIN — Customer-Sicht, keine internen Felder | OK |
| `GET /api/admin/upcoming-bookings` | NEIN | NEIN — nur kommende Termine, vor Abschluss | OK |
| `GET /api/admin/calendar/events` | NEIN | NEIN — nur Title/Start/End/Status | OK |
| `PATCH /api/admin/bookings/[id]` (Response) | JA (Z. 246–253) | JA inkl. `paymentMethod` (S05-Erweiterung) | **FIX (S05)** |

**Architect-Entscheidung:** Nur `GET /api/bookings` und PATCH-Response
korrigieren. Andere Endpoints brauchen das Feld nicht (Customer-Sicht
sieht den internen Endpreis explizit nicht — das war eine bewusste
IT6-Entscheidung).

### 3.8 Frontend-State-Refactor (C-5 Auflage)

`BookingTable.tsx` Zeile 287–303 + 469–475 nutzt aktuell den `as`-Cast:
```ts
const fp = (b as BookingAdmin & { finalPriceEur?: ... }).finalPriceEur;
```

**Problem:** wenn der Server nach S04-Fix das Feld liefert, ändert sich
der TypeScript-Type **nicht automatisch**. Der Cast funktioniert nur,
solange Prisma den Wert als String serialisiert — sobald jemand das
Feld umbenennt oder das Schema-Mapping ändert, bricht der Cast still.

**Lösung (verbindlich, NICHT „kosmetisch"):**
1. **Single Source of Truth** für den Booking-Liste-Type ist
   `BookingAdminSchemaIT14` (in `contracts/zod-schemas.ts`, neu in IT14)
   — eine Erweiterung von `BookingAdminSchemaIT6` um `paymentMethod`.
2. `fetchBookings()` (in `src/lib/api-client-it6.ts`) MUSS auf diesen
   Type typisieren (`Promise<BookingAdminIT14[]>`).
3. **Alle `as BookingAdmin & {...}`-Casts entfernen** — sowohl in
   `BookingTable.tsx` (Zeile 287–303, 469–475) als auch in eventuellen
   anderen Konsumenten von `fetchBookings()`.

Detail siehe `frontend-requirements-it14.md` §5.

---

## 4. S05 — Cash als Zahlungsoption

### 4.1 Aktueller Zustand: Zahlungs-Konzept

Die Codebase hat **zwei** voneinander unabhängige Zahlungs-Konzepte:

1. **Stripe-Payment** (`Payment`-Model in `schema.prisma` Zeile 348–364):
   - Felder: `stripeSessionId`, `amount` (Cents), `currency`, `status`
     (`PENDING|PAID|FAILED|REFUNDED`).
   - 1:1 zu Booking, nur via Stripe-Flow (operativ ruhend laut
     ARCHITECTURE.md §1).
   - UI: `PaymentEditor.tsx` (Tom hinterlegt Betrag → Stripe-Mail an
     Kunde).

2. **Final-Price** (`Booking.finalPriceEur` + `finalPriceNote`):
   - Reines internes Feld für Tom — keine UI-Auswahl der Zahlungsart.
   - UI: `FinalPriceEditor.tsx`.

**Es gibt KEINEN `PaymentMethod`-Enum.** Keine Spalte „Zahlungsart". Tom
kann aktuell nur einen Stripe-Betrag oder einen finalen Preis erfassen —
nirgends speichert das System „Bar".

### 4.2 Lösung: Erweiterung des Booking-Felds

**Architect-Entscheidung:** Die einfachste Lösung ist ein neues Feld
`Booking.paymentMethod` (TEXT, nullable) — analog zu `Booking.status`
(SQLite-TEXT mit App-Layer-Zod-Enum). **NICHT** das Stripe-Payment-
Modell um „CASH" erweitern (das ist ein dedizierter Stripe-Audit-Trail
und sollte sauber bleiben).

**Werte (kanonisch, finalisiert in Rev 2):** `'CASH' | 'BANK_TRANSFER'`
(Zod-Whitelist).
- `CASH` — Tom erfasst Bar-Zahlung manuell. (Pflicht laut Tom-Feedback.)
- `BANK_TRANSFER` — Banküberweisung (typischer Hausservice-Standard).
- `null` — nicht erfasst (Default für Bestand-Buchungen und neu
  erstellte Buchungen ohne explizite Wahl).

**Begründung der Wert-Auswahl (C-1 Critical-Auflösung):**

Das QA hat einen Drei-fach-Widerspruch zwischen ARCHITECTURE
(`CASH/STRIPE/TRANSFER`), OpenAPI (gleich) und UX-Spec/Component-Library
(`BANK_TRANSFER/CASH/CARD/INVOICE`) festgestellt. Der Architect
finalisiert wie folgt:

- **`STRIPE` entfällt** für IT14. Tom hat aktuell **keinen** funktionalen
  Stripe-Admin-UI-Pfad — eine Auswahl „Stripe" als `paymentMethod`
  würde falsche Erwartungen erzeugen (Tom denkt: hier wird per Stripe
  abgerechnet — tatsächlich passiert dort nichts). Das Bestand-`Payment`-
  Modell (mit `stripeSessionId` + `status`) bleibt als unabhängiger
  Audit-Trail vorhanden, ist aber operativ ruhend (siehe ARCHITECTURE.md
  §1). Wenn Tom in einer späteren Iteration Stripe wieder aktiviert,
  wird `STRIPE` der Whitelist hinzugefügt — und gleichzeitig eine
  Backfill-Strategie eingeführt (existierende Bookings mit
  `payment.status === 'PAID'` → `paymentMethod = 'STRIPE'`). **Heute:
  bewusst nicht.**
- **`CARD` entfällt** für IT14. Tom hat keine Kartenzahlung-Hardware.
  Hinzufügen, sobald reale Use-Case existiert.
- **`INVOICE` entfällt** für IT14. „Rechnung" ist im Hausservice-Kontext
  redundant zu `BANK_TRANSFER` (Rechnung wird per Überweisung beglichen).
  Wenn Tom später echte Zahlungsziele tracken will, kommt das als
  separates Feld (`paymentDueDate`).
- **`TRANSFER` → `BANK_TRANSFER` umbenannt.** UX-Spec hatte
  `BANK_TRANSFER` — der lange Name ist klarer und alignt automatisch
  mit der Component-Library. Architect war zu kurz.

**Empfehlung an UX-Designer (parallel umzusetzen):** Component-Library
und UX-Spec auf die finale Liste `['CASH', 'BANK_TRANSFER']` plus „leer
= Nicht erfasst" angleichen. `CARD`/`INVOICE` aus den Mock-Ups entfernen
oder als „in einer späteren Iteration"-Hinweis kennzeichnen.

**Migration ist nötig** (neue Spalte). SQLite-konform: `ALTER TABLE`
mit Default-NULL.

### 4.3 Migration-SQL (für Turso)

Datei: `prisma/migrations/20260504130000_iteration_14_payment_method/migration.sql`

```sql
-- IT14-S05 — Booking.paymentMethod hinzufügen.
-- SQLite kennt kein ENUM → TEXT, App-Layer validiert über Zod.
-- Werte (Rev 2 — final): 'CASH' | 'BANK_TRANSFER' | NULL (= nicht erfasst).
ALTER TABLE bookings ADD COLUMN paymentMethod TEXT;
```

**In Production einspielen:**
```bash
turso db shell baerenstark-prod < prisma/migrations/20260504130000_iteration_14_payment_method/migration.sql
```

**`_prisma_migrations`-Eintrag manuell ergänzen** (siehe ARCHITECTURE.md §2.3).

### 4.4 Schema-Update Prisma

`prisma/schema.prisma` Booking-Block ergänzen:
```prisma
/// IT14 / US-IT14-S05 — Zahlungsart (intern, von Tom erfasst).
/// Werte: 'CASH' | 'BANK_TRANSFER'. NULL = nicht erfasst.
/// SQLite hat kein ENUM — App-Layer validiert via Zod.
paymentMethod String?
```

### 4.5 Zod-Schema-Update

`contracts/zod-schemas.ts` (neu):
```ts
// IT14-S05 — Source of Truth für Zahlungsarten.
// HINWEIS: Wenn Stripe in einer späteren Iteration reaktiviert wird,
// hier 'STRIPE' ergänzen UND eine Backfill-Migration einplanen
// (existing Stripe-Bookings → paymentMethod = 'STRIPE').
export const PaymentMethodSchema = z.enum(['CASH', 'BANK_TRANSFER']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

// AdminBookingPatchSchema erweitern:
export const AdminBookingPatchSchema = z.object({
  status: BookingStatusSchema.optional(),
  finalPriceEur: finalPriceEurInputSchema,
  finalPriceNote: z.string().trim().max(200).nullable().optional(),
  paymentMethod: PaymentMethodSchema.nullable().optional(), // ← NEU
}).superRefine(...);

// NEU in IT14: BookingAdminSchemaIT14 als kanonischer Liste-Type.
export const BookingAdminSchemaIT14 = BookingAdminSchemaIT6.extend({
  paymentMethod: PaymentMethodSchema.nullable(), // ← NEU
});
export type BookingAdminIT14 = z.infer<typeof BookingAdminSchemaIT14>;
```

**Wichtig (C-5 Auflage):** `fetchBookings()` und alle Konsumenten der
Liste typisieren auf `BookingAdminIT14[]`. Keine `as`-Casts mehr.

### 4.6 Stellen wo die Liste der Zahlungsarten bekannt sein muss

1. `contracts/zod-schemas.ts` — neue `PaymentMethodSchema`-Konstante
   (Single Source of Truth).
2. `prisma/schema.prisma` — neues Feld `paymentMethod`.
3. `src/app/api/admin/bookings/[id]/route.ts` — PATCH-Handler liest
   `body.paymentMethod` aus `AdminBookingPatchSchema`, schreibt es ins
   `updateData`.
4. `src/app/api/bookings/route.ts` GET-Handler — Mapping um
   `paymentMethod: b.paymentMethod` ergänzen (analog zu S04-Fix).
5. `src/components/admin/FinalPriceEditor.tsx` ODER neue Komponente
   `PaymentMethodSelect.tsx` — Dropdown mit den drei Optionen + leer.
   Architect-Vorschlag: Erweiterung des `FinalPriceEditor` um ein
   drittes Feld „Zahlungsart" — minimaler UI-Aufwand, gleicher
   Submit-Pfad.
6. **Frontend-Anzeige** — Badge in der `BookingTable`-Karte (analog
   zu `finalPriceEur`-Badge): „Bar 150 €" / „Überweisung" / „Stripe".

### 4.7 Customer-Submit-Schema (M-7 Auflösung)

**Verbindlich:** `paymentMethod` ist im Customer-`POST /api/bookings`
**weder Input noch Output**.

- Customer-Buchungs-Submit (`BookingFormSchema` in
  `contracts/zod-schemas.ts`) **bleibt unverändert** — kein
  `paymentMethod`-Feld. Tom legt die Zahlungsart manuell im Admin fest.
- DB-Default für neue Customer-Buchungen: `paymentMethod = NULL`
  (Migration setzt keinen Default, Prisma schreibt nicht-explizit
  gesetzte Spalten als NULL).
- Customer-Sicht (`GET /api/bookings/[id]/public-summary` o.ä.) zeigt
  `paymentMethod` **nicht** — interne Information, kein Customer-Use-Case.

### 4.8 NULL-Render-Verhalten in der Liste (M-3 Auflösung)

**Listen-Badge in `BookingTable.tsx`:**
- `paymentMethod === 'CASH'` → Badge „Bar" (tone="info").
- `paymentMethod === 'BANK_TRANSFER'` → Badge „Überweisung" (tone="info").
- `paymentMethod === null` → **kein Badge** (sauber leer, kein „—",
  kein Empty-State). Tom sieht nur dort einen Badge, wo er bewusst
  eine Zahlungsart erfasst hat.

**Detail-Edit-View (`FinalPriceEditor` Select):**
- Initial `null` → Default-Option „— Nicht erfasst —" ist gewählt.
- Tom kann auf „Bar"/„Überweisung" wechseln und speichern.
- Tom kann auch zurück auf „— Nicht erfasst —" stellen → submit
  serialisiert das als `null` → DB wird `NULL`.

### 4.9 Out-of-Scope

- Kassenbuch / Bargeld-Tracking.
- Auto-Mail an Kunde bei „Bar".
- Frontend-sichtbare Zahlungsart-Auswahl im Buchungsformular (das ist
  ein Admin-internes Feld).
- Stripe-/Card-/Invoice-Optionen — siehe §4.2 Begründung.

---

## 5. S06 — Calendar-404

### 5.1 Bug-Lokalisierung

**Zwei Stellen erzeugen den Link:**

1. **Backend:** `src/app/api/admin/calendar/events/route.ts` Zeile 149:
   ```ts
   url: `/admin/bookings/${b.id}`,
   ```
2. **Frontend-Fallback:** `src/components/admin/AdminCalendarView.tsx`
   Zeile 185:
   ```ts
   href: event.url ?? `/admin/bookings/${encodeURIComponent(event.id)}`,
   ```

### 5.2 Existiert die Route?

**Nein.** `src/app/admin/bookings/page.tsx` existiert (redirected zu `/admin`),
aber `src/app/admin/bookings/[id]/page.tsx` **existiert nicht**.

Das Booking-Detail liegt **in einer Liste auf `/admin`** (via Tab
„Buchungsanfragen" in `AdminDashboard` → `BookingTable`). Es gibt keine
dedizierte Detail-Seite pro Booking.

### 5.3 Architect-Entscheidung (Rev 2 — C-2 Auflösung): Detail-Route

**Frühere Rev 1 hat Anker-Lösung gewählt (Option A) — Rev 2 wechselt
auf Detail-Route (Option B).**

**Begründung:**
- AC#3 von S06 verlangt „korrekte ID-Zuordnung". Eine Detail-Route ist
  eindeutig (URL = Booking-ID); das Anker-Pattern bricht in Edge-Cases:
  - Buchung nicht im aktuellen Filter sichtbar (S03 Default zeigt nur
    `PENDING + CONFIRMED` — abgeschlossene Aufträge fehlen!).
  - Mobile-Layout (Anker scrollen ist auf Touch unzuverlässig).
  - Deep-Link aus E-Mail (Tom bekommt eine Buchungs-Mail, klickt
    Link — Detail-Page ist robust, Anker abhängig vom aktuellen
    Dashboard-Zustand).
- Detail-Page existiert nicht → eine neue Page-File ist überschaubarer
  Scope (~80 LOC).
- Das alignt automatisch mit der UX-Spec und der Component-Library
  (beide verwenden `/admin/bookings/{id}` als verbindliche URL).

### 5.4 Code-Änderungen (Detail-Route)

**Neu anzulegen: `src/app/admin/bookings/[id]/page.tsx`**

Server-Component-Wrapper. Inhalt minimal:

```tsx
// src/app/admin/bookings/[id]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireActiveAdmin } from '@/lib/require-admin';
import { prisma } from '@/lib/prisma';
import { AdminBookingDetailView } from '@/components/admin/AdminBookingDetailView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Buchung – Bärenstark Admin',
  robots: { index: false, follow: false },
};

interface Params { id: string; }

export default async function AdminBookingDetailPage({
  params,
}: { params: Promise<Params> }) {
  await requireActiveAdmin();   // Schicht-3 Defense-in-Depth.

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    // alle Felder die der Detail-View braucht inkl. finalPriceEur,
    // finalPriceNote, paymentMethod, payment-Relation, attachments.
  });
  if (!booking) notFound();

  return <AdminBookingDetailView booking={booking} />;
}
```

**Neu anzulegen: `src/components/admin/AdminBookingDetailView.tsx`**

Client-Component, dünner Wrapper um existierende Booking-Card-
Bestandteile. UI minimal:
- Header mit Customer-Name, Status-Badge, „Zurück zur Liste"-Link.
- Booking-Details-Block (Datum, Service, Adresse, Beschreibung).
- Action-Buttons je nach `status`:
  - `PENDING` → Bestätigen / Ablehnen / Gegenvorschlag.
  - `CONFIRMED` → Abschließen / Stornieren.
  - `COMPLETED` → keine Aktionen außer „Preis bearbeiten".
- `<FinalPriceEditor>` (existiert bereits) — eingebettet, S05-erweitert
  um Zahlungsart-Select.
- `<PaymentEditor>` (existiert bereits, Stripe-Bestand) — falls
  vorhanden, Bestand-Block unten anzeigen.

**Engineer-Hinweis:** Der Detail-View darf zunächst Code aus
`BookingTable.tsx` Item-Render-Pfad (Zeile 257–520) extrahieren — ein
Refactor ist erlaubt, aber nicht zwingend für IT14. Minimal-Variante:
neue Komponente, die die Action-Handler-Funktionen (`patchBookingStatus`,
`patchAdminBooking`) direkt aufruft und nach Save zurück zur Liste
navigiert (oder auf der Detail-Seite bleibt mit aktualisiertem State).

**Backend** (`src/app/api/admin/calendar/events/route.ts` Zeile 149)
zurück auf saubere Detail-URL:
```ts
url: `/admin/bookings/${b.id}`,
```

**Frontend Fallback** (`src/components/admin/AdminCalendarView.tsx`
Zeile 185):
```ts
href: event.url ?? `/admin/bookings/${encodeURIComponent(event.id)}`,
```

**`BookingTable.tsx`** — kein Anker-`id={`booking-${b.id}`}` mehr nötig,
kein Highlight-Effect, kein `?focus=`-Effect. `BookingTable` bleibt
beim S03-Multi-Select-Refactor; der Calendar-Link führt nicht mehr in
die Liste.

**`AdminDashboard.tsx`** — keine Änderung.

**Mobile-Acceptance (AC#4):** Detail-Page ist eine eigene Route,
Mobile-Layout wird durch Tailwind responsive automatisch behandelt.

### 5.5 Calendar-URL-Logik bei BUFFER/AVAILABILITY (M-8 Auflösung)

`src/app/api/admin/calendar/events/route.ts` setzt `url` **nur im
BOOKING-Branch** (Zeile 141–150). Bei `BUFFER` (Zeile 154) und
`AVAILABILITY` (Zeile 169) wird das Feld **nicht** gesetzt → ist im
JSON `undefined` → in OpenAPI als `nullable: true`.

**Frontend (`AdminCalendarView`):** Zeile 178-Bereich verzweigt
bereits auf `event.type !== 'BOOKING'` und setzt den Popover ohne
Buchung-öffnen-Button. **Kein Code-Change** — Bestand funktioniert.

**Engineer-Verifikation:** im Popover-Markup darf der „Buchung öffnen"-
Button nur gerendert werden, wenn `event.type === 'BOOKING' && event.url`
truthy ist. Falls heute der Button auch bei `event.url === undefined`
gerendert wird → Bug-Fix mit ergänzen.

---

## 6. S07 — Analytics-Reparatur (siehe §1.2)

Die Analyse ist in §1.2. Konkrete Fix-Änderungen:

### 6.1 S04-Abhängigkeit

S07 kann erst nach S04-Fix verifiziert werden. Wenn S04 gelöst ist und
`finalPriceEur` korrekt persistiert, gilt:

### 6.2 Default-Range

`AnalyticsQuerySchema` Default `'12m'` ist OK. **Keine Änderung nötig**.
Tom soll sehen, ob seine Aufträge in den letzten 12 Monaten erscheinen.

### 6.3 AC#4 — „Auftrag ohne Endpreis erscheint nicht"

**Architect-Entscheidung:** Kompromiss — die KPIs (Umsatz, Avg) bleiben
auf `finalPriceEur != null` gefiltert. Aber eine **separate KPI-Kachel**
bleibt unverändert: „Abgeschlossene Buchungen" zählt **alle**
COMPLETED-Aufträge im Range, nicht nur die mit Preis. Damit ist Tom
sichtbar, wie viele Aufträge er abgeschlossen hat — auch wenn er bei
einigen den Preis vergessen hat.

**Code-Read:** `analytics.ts` Zeile 169 zählt aktuell `completedCount =
completedInRange.length` — und `completedInRange` ist mit
`finalPriceEur: { not: null }` gefiltert. Die KPI „Abgeschlossene
Buchungen" zeigt also nur Aufträge MIT Preis. **Bug.**

**Fix:** Zwei Queries — eine für KPI-Counts (ohne Preis-Filter), eine
für Umsatz-Aggregation (mit Preis-Filter):

```ts
// Anzahl abgeschlossener Aufträge im Range (auch ohne Preis):
const completedTotalCount = await prisma.booking.count({
  where: {
    status: 'COMPLETED',
    date: { not: null, gte: from, lte: to },
  },
});

// Aufträge MIT Preis für Umsatz-Aggregation:
const completedWithPrice = await prisma.booking.findMany({
  where: {
    status: 'COMPLETED',
    date: { not: null, gte: from, lte: to },
    finalPriceEur: { not: null },
  },
  select: { finalPriceEur: true, date: true, service: true, customerId: true },
});
```

`kpis.completedBookings` setzen auf `completedTotalCount` statt
`completedWithPrice.length`. AC#4 ist damit erfüllt.

### 6.4 Cache-Tag

Bestand bleibt: `revalidateTag('analytics')` in
`PATCH /api/admin/bookings/[id]` Zeile 224 wird ausgelöst, sobald
`finalPriceEur` oder Status-COMPLETED-Übergang. **Keine Änderung
nötig.**

---

## 7. Production-Migrations (Tom-Aufgabe nach IT14-Implementierung)

### 7.1 Reihenfolge

```bash
# 1. BACKUP zuerst:
turso db shell baerenstark-prod ".dump" > backup-it14-$(date +%Y%m%d).sql

# 2. Migration einspielen (S05 — paymentMethod):
turso db shell baerenstark-prod < prisma/migrations/20260504130000_iteration_14_payment_method/migration.sql

# 3. _prisma_migrations-Tabelle manuell ergänzen (Standard IT12-Procedure):
turso db shell baerenstark-prod "INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('<cuid>', '<sha256-of-sql>', datetime('now'), '20260504130000_iteration_14_payment_method', NULL, NULL, datetime('now'), 1);"

# 4. Vercel ENV (S08, falls noch nicht erfolgt):
#    BLOB_READ_WRITE_TOKEN für Production gesetzt? Falls nein:
#    Vercel Dashboard → Storage → Blob → Connect to Project.

# 5. Re-Deploy (Vercel Dashboard → Deployments → Redeploy).
```

### 7.2 Verifikation (Production-Smoke nach Re-Deploy)

| Story | Smoke-Test | Erwartet |
|---|---|---|
| S02 | `curl -i https://www.baerenstark-hausservice.app/admin` (ohne Cookie) | 302 Redirect auf `/admin/login` — kein Admin-HTML im Body |
| S02 | `curl -i https://www.baerenstark-hausservice.app/api/admin/bookings` (ohne Cookie) | 401 JSON `{ error: { code: 'UNAUTHORIZED' }}` |
| S02 | `curl -i -H "Cookie: __Secure-next-auth.session-token=invalid" .../admin` | 302 Redirect (kein 200, kein HTML-Leak) |
| S03 | `/admin` öffnen | Default-Filter zeigt nur „Offen" + „Bestätigt" (Multi-Select-Pills) |
| S04 | Preis bei einer Buchung speichern + Seite reloaden | Preis ist immer noch da |
| S05 | „Bar" als Zahlungsart wählen + speichern + reloaden | Bar ist immer noch ausgewählt |
| S06 | Kalender-Eintrag → „Buchung öffnen" | Landung auf `/admin/bookings/<id>` (Detail-Page, kein 404) |
| S07 | Analytics → 12m → erwarten dass abgeschl. Auftrag sichtbar ist | Umsatz-Karte zeigt den Wert |
| S08 | JPEG <10 MB hochladen | Progress-Bar, Vorschau, kein 503 |
| S01 | Eingeloggt zu `/buchen` | Name/E-Mail/Adresse vorausgefüllt |

---

## 8. Open Questions / Hypothesen

- **OQ-IT14-1 (offen):** Wie genau ist Tom's „Admin-Seite nicht
  gesichert"-Beobachtung zu interpretieren — Customer-Cookie kommt
  durch oder alte Admin-Session ist noch aktiv? Engineer in Phase 3
  muss das mit Inkognito-Test verifizieren. Smoke-Tests in §2.7
  decken den Defense-in-Depth-Fall ab; falls Tom's Beobachtung anhält
  → erneute Diagnose.
- **OQ-IT14-2 (geschlossen, Rev 2):** Zahlungsart-Liste finalisiert auf
  `['CASH', 'BANK_TRANSFER']` — siehe §4.2 Begründung.
- **OQ-IT14-3 (offen, niedrige Priorität):** S07 AC#4 — Architect
  bevorzugt „Anzahl abgeschlossener Aufträge im Range" als separate
  KPI (siehe §6.3). Falls Tom den AVG-Wert anders interpretiert haben
  möchte, in einer späteren Iteration ein Tooltip ergänzen (das ist
  ein UX-Designer-Thema, nicht Architekt).
- **OQ-IT14-4 (geschlossen, Rev 2):** S06 — Detail-Route wird neu
  angelegt (`/admin/bookings/[id]`). Anker-Pattern verworfen.

## 9. Engineer-Hand-Off (Auflage-Liste aus QA)

**P0 — vor Start nicht startbar:**
- C-1 final: `PaymentMethod = ['CASH', 'BANK_TRANSFER']` (siehe §4.2).
- C-2 final: Detail-Route `/admin/bookings/[id]/page.tsx` neu anlegen
  (siehe §5.4).
- C-3: Defense-in-Depth-Audit in §2.6 abarbeiten — `app/admin/layout.tsx`
  bekommt `requireActiveAdmin()`, 6 Route-Handler von `auth()` auf
  `requireAdmin()` migrieren, 2 Pages den Helper ergänzen.
- C-5: Schema-Refactor — `BookingAdminSchemaIT14` einführen,
  `as`-Casts entfernen (siehe §3.8).

**P1 — von Tom auszuführen, parallel:**
- C-4 / S01: Smoke-Test-Plan §1.1.1 an Tom geben.
- C-4 / S08: Smoke-Test-Plan §1.3.1 an Tom geben.
- Production-Migration nach §7.1.

**P1 — Engineer-Tasks:**
- M-S03 Multi-Select-Refactor in `BookingTable.tsx` (siehe
  Frontend-Requirements §2).
- M-COUNTER_PROPOSED: Default-Filter `['PENDING', 'CONFIRMED']` —
  `COUNTER_PROPOSED` ist standardmäßig **ausgeschlossen**, aber im
  Multi-Select-Pill-Set sichtbar (Tom kann manuell aktivieren).
- M-NULL-paymentMethod-Render: Listen-Badge-Regel in §4.8.
- M-OpenAPI-401-Shape: Response-Body-Konsistenz in §2.7.
- M-Audit-Booking-Reads: Nur `GET /api/bookings` korrigieren (siehe §3.7).

---

*Ende ARCHITECTURE_IT14.md — Solution Architect, 2026-05-04 (Rev 2).*
