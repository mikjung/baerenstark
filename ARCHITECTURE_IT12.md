# Architecture — Iteration 12 (Stakeholder-Feedback-Sweep)

> Status: Draft for engineering. Author: Solution Architect, 2026-05-04.
> Liest sich als Inkrement zu `ARCHITECTURE.md` und `ARCHITECTURE_IT11.md`.
> Iteration 12 ist primär eine Bug-Fix-Welle (Live-Probleme, die Tom direkt
> reproduziert hat) plus zwei neue Features (Service-Bilder, Marketing-E-Mail).

---

## 0. Cross-Cutting Concerns

Bevor die Stories einzeln durchgegangen werden, hier die Querschnittsthemen,
die mehrere Stories betreffen oder als Quick-Win zuerst gelöst werden sollten:

### 0.1 Production-Migration verifizieren (Quick-Win für S06, S11, S12, S13)

`prisma/migrations/` enthält alle Migrationen bis einschließlich
`20260504100000_add_booking_cancellation_audit` (IT11 / `cancelledAt`,
`cancelledBy`, `cancellationReason` an `bookings`). Der GET-Endpoint
`/api/customer/bookings` liefert `isCancellable` über `lib/cancellation.ts`,
das aktiv `cancelledAt`/`cancelledBy` liest. Wenn diese Migration in
Production noch nicht gelaufen ist, schlagen *alle* Endpoints fehl, die
`booking.cancelledAt` / `booking.cancelledBy` lesen — und das sind genau die
drei kaputten Endpoints aus S06, S12, S13 sowie ein Teil von S11 (Customer-
Dashboard listet Buchungen, die per Sub-Reads fehlschlagen).

**Aktion (Backend-Engineer, Schritt 1 der Iteration):**

1. `vercel env pull` → in einer kontrollierten Shell `npx prisma migrate
   status` gegen die Production-Database ausführen.
2. Falls `20260504100000_add_booking_cancellation_audit` als
   `Pending` gemeldet wird → `npx prisma migrate deploy`.
3. Vercel-Logs für `/api/customer/bookings`, `/api/admin/upcoming-bookings`,
   `/api/bookings` (admin GET) checken — der konkrete Stack-Trace muss
   eindeutig auf `cancelledAt`/`cancelledBy` zeigen, um die Hypothese zu
   bestätigen.
4. Nach dem Migrate alle drei Endpoints mit Smoke-Tests verifizieren
   (siehe Story-Sektionen).

Falls die Migration *bereits* gelaufen ist, sind die Endpoints aus einem
anderen Grund kaputt — dann auf den Vercel-Log-Stack-Trace eskalieren
(siehe Risiken §13).

### 0.2 Scroll-Jump-Verhalten (S04, S09)

Beide Stories haben dieselbe Wurzel: `BookingClient.tsx` ruft an fünf
Stellen `element.scrollIntoView({ behavior: 'smooth', block: 'start' })`
auf — bei Tag-Auswahl, Dauer-Auswahl, Slot-Auswahl, Slot-Klick (rebook),
und in `onSlotChange` aus dem QuickBookingModal. Diese Smooth-Scrolls
fühlen sich auf Desktop wie „Scroll-Jumps" an, weil der Browser den
Top-of-Section ansteuert. Das ist *funktional* korrekter Code, aber UX-
kaputt sobald der Nutzer schon weiter unten im Form ist.

**Lösungsansatz:** Scroll-Aufrufe nur dann triggern, wenn das Ziel
*nicht bereits* im Viewport ist (`getBoundingClientRect().top < 0` oder
`> window.innerHeight`). Helper `scrollIntoViewIfNeeded(id)` in einer
neuen Datei `src/lib/scroll-into-view.ts`. Alle fünf Aufrufstellen in
`BookingClient.tsx` migrieren.

S09 (Form-Feldwechsel) ist subtiler: Es gibt im `BookingForm` (oder
einem darunterliegenden Component) keine offensichtliche `scrollTo`-
Quelle, aber die `Banner` (z. B. `kind: 'conflict'`/`'error'`) wird bei
State-Änderung neu gemountet *am Anfang* des Forms — dadurch wachsen
die oberen Sektionen, das DOM verlängert sich, und `scrollIntoView`-
Triggers aus dem Parent-Effect (`onServiceChange` ruft `setPickedService`
→ `BookingClient` re-rendert) feuern erneut. **Untersuchen:** den
`useEffect`-Block bei `watchedService` (Zeile 161) — er feuert bei jedem
Service-Change und triggert `onServiceChange` → Parent setzt State →
Re-Render. Das alleine springt nicht; aber kombiniert mit der QuickBookingModal,
die offen ist, wird der Hintergrund-DOM repaint'et. Frontend-Engineer
soll mit einem Console-Log auf jeden Scroll-Aufruf in der Production-
Build (oder via DevTools Performance-Recording) die exakte Quelle
einkreisen. Falls keine `scrollTo`-Quelle gefunden wird: Browser-Behavior
(autofocus durch `aria-invalid`) prüfen.

### 0.3 NEXTAUTH_URL & Production-Domain (S01)

Der Customer-OAuth-Flow setzt `trustHost: true` — gut. Aber NextAuth
v5 berechnet die Provider-Callback-URL aus `NEXTAUTH_URL` (oder
`AUTH_URL` ab v5). Die Story sagt explizit, der Wert in Vercel muss
`https://www.baerenstark-hausservice.app` sein. Wenn jemand einen Wert
ohne `www.` setzt (oder mit Trailing-Slash), divergiert die berechnete
`redirect_uri` von der in der Google Cloud Console hinterlegten — das
ist exakt das „Bad request"-Symptom. Siehe Detailanalyse in §S01.

### 0.4 Customer-Session-Sync (S07)

Der `useCustomer()`-Hook in `src/lib/use-customer.ts` ist pro Component-
Instanz — er fetcht beim Mount und exposed `refresh()`. Es gibt keinen
globalen Store / Event-Bus. Nach `PATCH /api/customer/me` (Profil-
Speichern) ruft `ProfileForm` weder `router.refresh()` noch invalidiert
es den Header-`useCustomer`. Wenn der Header zwischen den Renders
remount'et oder eine andere Komponente das Cookie-Cache mitliest und
einen `null`-Wert zurückliefert, fällt der Header auf `unauthenticated`
zurück → „Anmelden"-Button. Lösung: ein simpler EventTarget-basierter
Store oder ein `BroadcastChannel('customer-auth')`-Sync — siehe §S07.

### 0.5 Admin-Navigation-Architektur (S14)

Aktuell: `AdminDashboard.tsx` rendert in zwei Layern:
- **QuickLinks** (oben): Kalender, Admins, Nutzer, Analytics, Bewertungen.
- **Tabs** (mitte): Buchungsanfragen, Zeitfenster, Verfügbarkeit, Bewertungen.

→ „Bewertungen" doppelt (QuickLink *und* Tab) — exakt der gemeldete Bug.

Ziel-IA aus der Story (drei Gruppen):

1. **Kalender & Zeitmanagement** — Kalender, Zeitfenster, Verfügbarkeit, Buchungsanfragen
2. **Nutzerverwaltung** — Kunden, Admins
3. **Auswertungen** — Analytics, Bewertungen

Architektur-Entscheidung: Wir bleiben bei dem hybriden Layout (Sidebar
mit Gruppen + content tabbar nur dort wo es einen Sub-Bereich gibt),
aber die genaue visuelle Umsetzung gehört zu `ux-designer`. Pflicht:
Bewertungen darf in der gerenderten DOM nur einmal vorkommen.

### 0.6 Resend-Rate-Limiting (S15)

Resend Free-Tier: 100 mails/day, ~10 mails/sec. Free-Plan-API erlaubt
keinen Bulk-Send, aber `Promise.allSettled` mit kleinem Concurrency-
Limit (z. B. 5 parallel via einfaches Semaphor) ist deutlich
schneller als sequenziell und respektiert das Rate-Limit. Bei mehr als
50 Empfängern: zusätzlich `setTimeout`-Throttle (200ms zwischen Batches)
um den 10-mails/sec-Cap nicht zu reißen.

---

## 1. IT12-S01 — Google OAuth „Bad Request" in Production

### Root-Cause-Hypothese (mit Evidenz)

Code ist korrekt: `src/lib/customer-oauth.ts` setzt `trustHost: true`,
das Routenfile `[...nextauth]/route.ts` ist ein Catch-All, GET und POST
sind beide korrekt eingerichtet. `redirect_uri` wird *nicht* manuell
überschrieben (NextAuth berechnet sie aus `baseUrl + '/api/auth/customer/callback/google'`).

Damit verbleiben drei realistische Ursachen, in absteigender
Wahrscheinlichkeit:

1. **`NEXTAUTH_URL` ist in Vercel falsch** — z. B. `https://baerenstark-hausservice.app`
   (ohne `www.`) oder mit Trailing-Slash. Das Auto-Trust funktioniert,
   aber die Provider-`redirect_uri`-Validierung schlägt fehl, weil die
   Google Cloud Console exakt `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`
   erwartet.
2. **`AUTH_SECRET` / `NEXTAUTH_SECRET` fehlt oder ist zwischen Preview-/
   Production-Env unterschiedlich** — der State-Cookie aus `/customer/google`
   kann im Callback nicht entschlüsselt werden, NextAuth gibt 400.
3. **Cookie-Konflikte:** Der Custom-Cookie-Name `__customer-next-auth.csrf-token`
   ist gesetzt — Vercel `Secure`-Flag zwingt HTTPS-Domain-Match. Wenn der
   Nutzer von `baerenstark-hausservice.app` (apex) auf
   `www.baerenstark-hausservice.app` (www) umgeleitet wird, geht der
   Cookie verloren → CSRF-Mismatch → 400.

### Lösungsansatz

1. Vercel-Env-Variables prüfen und korrigieren:
   - `NEXTAUTH_URL=https://www.baerenstark-hausservice.app` (ohne Slash, mit www).
   - `AUTH_SECRET` muss in Production identisch zu Preview sein (oder
     bewusst unterschiedlich, aber dann nur in Production hinterlegt).
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` doppelt prüfen.
2. Vercel-Domain-Config: apex (`baerenstark-hausservice.app`) muss per
   301 auf `www.` umleiten **bevor** NextAuth-Routen hit'en. Wenn das
   schon in `next.config.js` oder Vercel-Domain-Settings passiert — gut.
   Falls nicht, eine Redirect-Rule ergänzen.
3. Google Cloud Console:
   `Authorized redirect URI = https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`
   exakt so eintragen. Keine zusätzlichen Pfade.
4. Test: Inkognito + Vercel-Production-URL aufrufen, `/konto/login` →
   „Mit Google anmelden". Erwartet: 302 → Google → 302 → `/api/customer/oauth-finalize` → `/konto`.
5. Falls weiterhin „Bad request" auf der Callback-URL: Vercel-Function-Logs
   für `/api/auth/customer/[...nextauth]` öffnen, exakte Stack-Trace lesen.

### Betroffene Dateien

- **Konfiguration (Vercel):** Env-Variablen, Domain-Settings.
- **Konfiguration (Google Cloud Console):** Authorized Redirect URIs.
- *Kein Source-Code-Change* erforderlich, sofern die Hypothesen 1+3 stimmen.

### Risiken

- Falls die Ursache in NextAuth selbst (v5-Bug) liegt: `next-auth@^5.0.0-beta.x`
  hatte bekannte CSRF-Cookie-Issues mit Cross-Domain. Fallback-Plan:
  Auf `useSecureCookies: false` für Debug schalten — aber NIEMALS in
  Production lassen.

---

## 2. IT12-S02 — Service-Detailseiten Bilder + Icon-Position

### Design

Die Service-Detailseite (`src/app/services/[slug]/page.tsx`) hat aktuell
ein 7xl-Icon in einer 44x44-Box als Hero-Visual rechts. Das Icon bleibt
als Element, wird aber:

1. Von der Hero-Box rechts entfernt (aktuell Zeilen 229–236).
2. Klein neben der `<h1>` platziert (links, ca. 1.5em hoch).
3. Stattdessen rendert das Hero ein `next/image` mit dem zugeordneten
   Service-Bild aus `/public`.

### Service-Slug → Bild-Mapping

```
'gruenflaechenpflege'  → '/grünflächenpflege.png'
'entruempelung'        → '/entruemplungen.png'
'entkernung'           → '/entkernungsarbeiten.png'
'reinigung'            → '/reinigungsarbeiten.png'
'muelltonnenservice'   → '/mülltonnenservice.png'
'entsorgung'           → '/metal_schrott.png'
```

**Wichtig — Umlaute in Dateinamen:** `grünflächenpflege.png` und
`mülltonnenservice.png` haben Umlaute im Dateinamen. `next/image`
URL-codiert das automatisch beim Rendern (`%C3%BC`, `%C3%A4`), aber:

- Vercel-Blob/CDN-Cache liefert Dateien mit URL-encoded Pfaden korrekt
  aus, vorausgesetzt der Dateiname auf der Disk hat die Originalzeichen.
- Der Build-Prozess (Next.js static-asset-handling) erwartet normalerweise
  keine Umlaute. **Empfehlung:** Im Mapping den String-Literal mit
  Unicode-Original schreiben (`'/grünflächenpflege.png'`), Next.js
  rendert ihn korrekt.

**Fallback** (Story AC3): Wenn das Bild fehlt (`onError` am `<Image>`),
ein neutraler Container mit grauem Hintergrund + Icon. Implementierung
über eine Wrapper-Komponente `<ServiceHeroImage>` mit
`useState('loaded'|'errored')`.

### Betroffene Dateien

- **NEU:** `src/lib/service-images.ts` — Mapping `slug → imagePath`,
  zentrale Single-Source-of-Truth.
- **GEÄNDERT:** `src/app/services/[slug]/page.tsx` — Hero-Sektion mit
  `next/image`, Icon kleiner neben `<h1>`.
- **NEU:** `src/components/seo/ServiceHeroImage.tsx` — Image-mit-Fallback-
  Component (oder inline in der Page).

### Risiken

- Bilder können groß sein (Public Folder hat keine Optimierung), `next/image`
  optimiert sie aber zur Build-Zeit. Vercel-Limits: Image Optimization
  ist auf 1000 transformations/month (Free) begrenzt — 6 Bilder * mehrere
  Größen ist unkritisch.
- Pfade mit Umlauten könnten in alten Browsern oder bei Reverse-Proxies
  Probleme machen. **Mitigation:** Falls in QA Probleme auftreten, die
  Dateien umbenennen (`gruenflaechenpflege.png`, `muelltonnenservice.png`)
  und Mapping anpassen — kein User-facing Breaking-Change.

---

## 3. IT12-S03 — Buchungskalender langsam & nicht klickbar

### Root-Cause-Analyse

Der `BookingCalendar` in `src/components/booking/BookingCalendar.tsx`
ruft `fetchAvailabilityCalendar(from, to)` für ein 62-Tage-Range. Das
Backend ist `GET /api/availability/calendar` (in `src/app/api/availability/calendar/`).
Wir haben *nicht* nachgesehen, was dieser Endpoint genau macht — der
PM-Hinweis weist auf N+1 hin. Das Backend muss für jeden Tag
mindestens prüfen: AvailabilityTemplate für Wochentag, DayOverride,
existierende Bookings → das *kann* N+1 sein wenn naiv pro Tag eine
Query läuft.

Die „nicht klickbar"-Komponente ist auch verdächtig: In
`BookingCalendar.tsx` Zeile 155–163 ist `handleDaySelect` per `onSelectDay`
weitergegeben, aber nur die Tage mit `dateIso >= todayIso()` werden
durchgelassen. Die FullCalendar-Komponente in `AppCalendar.tsx` muss
prüfen, ob der `dateClick`-Event registriert ist und ob `selectable: true`
gesetzt ist.

### Lösungsansatz

**Backend-Engineer:**

1. Vercel-Logs für `/api/availability/calendar` zur Reproduktionszeit
   öffnen — Query-Times messen.
2. Endpoint analysieren: gibt es eine Schleife, die pro Tag eine Query
   absetzt? Falls ja: in eine einzige `prisma.booking.findMany({ where: { date: { in: [...] } } })`
   plus eine einmalige Query für `AvailabilityTemplate` und `DayOverride`
   konsolidieren.
3. **Index prüfen:** `bookings` hat `@@index([date, status])` und
   `@@index([status, date, startTime])` — für die Range-Query passt das.
   `dayOverrides` hat `@@unique` auf `date` und `@@index([date])` —
   passt.
4. Cache: Output kann mit `revalidateTag('availability')` und einer
   60-Sekunden-Cache (`s-maxage=60, stale-while-revalidate=300`)
   versehen werden — der Kalender-Inhalt ändert sich nicht im Sekunden-Takt.

**Frontend-Engineer:**

1. AppCalendar.tsx (FullCalendar-Wrapper) prüfen — sind `dateClick`
   und `selectable` korrekt für Mode `'customer'` gesetzt? Ggf. ein
   Console-Log direkt im Click-Handler einbauen.
2. `BookingCalendar` `enrichedDays` ist aktuell ein No-Op (Zeilen 166–171,
   `useMemo` gibt einfach `days` zurück). Solange das so bleibt, kein
   Problem — nur prüfen, dass `<AppCalendar>` die `disabled` für
   `unavailable`-Tage korrekt rendert und nicht *alle* Tage disabled.

### Betroffene Dateien

- `src/app/api/availability/calendar/route.ts` (Backend, Query-Optimierung).
- `src/components/calendar/AppCalendar.tsx` (Frontend, Click-Handler-Validierung).
- `src/components/booking/BookingCalendar.tsx` (Frontend, ggf. nicht).

### Risiken

- Wenn die Endpoint-Logik komplexer ist als gedacht (Buffer-Berechnung
  pro Tag, Counter-Proposal-Slots etc.) kann die Optimierung mehr als
  einen Sprint-Day kosten. Story-Points 5 ist passend.

---

## 4. IT12-S04 — Scroll-Jump bei Slot-Auswahl („Wie lange?")

### Root-Cause

`BookingClient.tsx` Zeile 214–218: `handleDurationSelect` triggert
`scrollIntoView` auf `#slot-list-section`. Wenn der Nutzer den Slot
auswählt, läuft `handleTimeSlotSelect` (Zeile 221–236) — und im
Non-Rebook-Mode öffnet das den `QuickBookingModal` (Zeile 228), nicht
den ScrollIntoView. **Aber:** wenn der Nutzer im Rebook-Mode ist, oder
das Modal nicht öffnet (z. B. Modal-Bug), läuft der else-Pfad: `scrollIntoView`
auf `#booking-form-section`.

Wahrscheinlicher Bug: Der `setTimeout(50ms)`-Scroll-Aufruf bei
`handleDurationSelect` (Z. 214) feuert auch nach Slot-Auswahl, weil
ein State-Update den Effekt im Parent triggert — d. h. der „Sprung
nach oben" ist tatsächlich ein „Sprung zur Slot-Liste-Sektion".

### Lösungsansatz

Siehe §0.2 — `scrollIntoViewIfNeeded(id)` Helper anwenden. Zusätzlich:
in `handleTimeSlotSelect` den ScrollIntoView NUR im Rebook-Mode
ausführen — nicht im Quick-Modal-Mode.

### Betroffene Dateien

- `src/lib/scroll-into-view.ts` (NEU)
- `src/app/buchung/BookingClient.tsx` (5x scrollIntoView-Aufrufe ersetzen)

---

## 5. IT12-S05 — Konto-Erstellung nach Gast-Buchung anbieten

### Design

**Fluss (Frontend):**

1. Gast (kein Customer-Cookie) füllt Buchungsformular, klickt „Anfrage absenden".
2. POST `/api/bookings` liefert 201 mit `{ id, confirmationToken, … }`.
3. Frontend redirect'et zu `/buchung/bestaetigung/[id]?token=…&new=true`
   (siehe Zeile 286 in BookingForm.tsx — schon gegeben).
4. **NEU:** Auf der Bestätigungsseite ein Modal/CTA „Konto anlegen?" anzeigen,
   wenn folgende Bedingungen erfüllt sind:
   - Customer-Cookie ist NICHT gesetzt.
   - Anfrage hat eine `customerEmail`.
   - URL-Param `?new=true` ist gesetzt.
   - **NEU (Idempotenz):** Backend hat noch kein Konto mit dieser E-Mail
     erstellt (sonst wäre der Login der bessere CTA).
5. Klick auf „Jetzt Konto erstellen" → öffnet ein Modal (oder navigiert
   zu `/konto/registrieren?from=booking&bookingId=…&token=…`) mit
   E-Mail/Vorname/Nachname pre-filled, der Nutzer setzt nur ein Passwort.
6. Erfolgs-Submit:
   - Neues `CustomerUser` anlegen (E-Mail = Buchungs-E-Mail, Name aus
     der Buchung gesplittet).
   - **Verknüpfung:** Die existierende Booking (`Booking.customerId = NULL`)
     auf den neuen `CustomerUser.id` setzen — UND alle weiteren Bookings
     mit derselben `customerEmail` (case-insensitive) und `customerId IS NULL`
     ebenfalls.
   - `customer-session`-Cookie setzen (langlebig, wie bei Login).
   - Redirect zu `/konto`.

### Endpoint-Design (NEU)

`POST /api/customer/register-from-booking`

```jsonc
// Request
{
  "bookingId": "clxxx...",
  "confirmationToken": "ey...",   // signed JWT, scope=booking-confirmation
  "password": "min12chars"        // App-Layer: ≥12, nicht im 1000-most-common
}
// Response 201
{
  "customerId": "clyyy...",
  "linkedBookingsCount": 3        // wie viele Bookings mit dieser E-Mail
                                  // verknüpft wurden
}
```

**Sicherheits-Eigenschaften:**

- `confirmationToken` ist Pflicht — verhindert, dass jemand fremde Bookings
  „kapert" (sonst könnte man via geleakte `bookingId` Konten anlegen).
- Token-Scope ist `booking-confirmation` (existiert schon in
  `lib/booking-tokens.ts`).
- E-Mail des Tokens MUSS der `customerEmail` der Booking entsprechen.
- Wenn ein `CustomerUser` mit dieser E-Mail bereits existiert: 409 CONFLICT,
  Frontend zeigt „Du hast schon ein Konto — bitte einloggen" mit Login-Link.
- Idempotent: Nochmaliges Aufrufen mit demselben Token + gleicher Booking
  → 409 (Konto existiert), Frontend behandelt das als „bereits gemacht".

### Betroffene Dateien

- **NEU:** `src/app/api/customer/register-from-booking/route.ts`
- **NEU:** `src/components/booking/CreateAccountAfterBookingPrompt.tsx`
  (Modal/Card auf der Bestätigungsseite)
- **GEÄNDERT:** `src/app/buchung/bestaetigung/[id]/page.tsx` (oder
  vergleichbarer Pfad — den genauen File checkt der Frontend-Engineer)
- **GEÄNDERT:** `src/lib/booking-tokens.ts` — ggf. `verifyBookingConfirmationToken`
  einsetzbar machen.

### Risiken

- Wenn die Bestätigungsseite cache't (statisch generiert), muss der
  Modal-Trigger client-side laufen — das ist ohnehin so, aber explizit
  prüfen.

---

## 6. IT12-S06 — Kundendashboard „Anfragen konnten nicht geladen werden"

### Root-Cause-Hypothese

`/api/customer/bookings` (Code in `src/app/api/customer/bookings/route.ts`)
ist sauber implementiert, aber ruft `lib/cancellation.ts` auf, das
`booking.cancelledAt` und `booking.cancelledBy` liest. Wenn die IT11-
Migration `20260504100000_add_booking_cancellation_audit` in Production
nicht gelaufen ist → Prisma-Query failed mit "Unknown column" → 500
"Interner Serverfehler".

### Lösungsansatz

Siehe §0.1.

**Sekundär:** Selbst wenn die Migration durchläuft, sollte
`/api/customer/bookings` *defensiver* mit Errors umgehen — die
`internalError(err, 'GET /api/customer/bookings')`-Funktion (in
`lib/api.ts`) gibt aktuell einen generischen 500. Story-AC sagt: bei
keinen Bookings → leere Liste. Das funktioniert schon (line 119
initialisiert leere Arrays). Also: kein Code-Fix, nur Migration + Verify.

### Betroffene Dateien

- *Keine* (Production-Migration). Sollte Migration nicht der Grund sein:
  Vercel-Log-Stack-Trace einsehen, dann zurück an den Architect.

---

## 7. IT12-S07 — „Anmelden"-Button trotz Login

### Root-Cause

`useCustomer()` (`src/lib/use-customer.ts`) ist ein lokaler Hook ohne
globalen Store. Jede Component-Instanz fetcht beim Mount via
`getCustomerMe()`. Bei Network/Server-Fehler (Z. 38–44, `catch`-Block)
wird der State *stillschweigend* auf `'unauthenticated'` gesetzt.

**Bug-Pfad:**

1. Customer ist eingeloggt, Header zeigt „Mein Konto".
2. Customer geht auf `/konto/profil`, ändert die Adresse, klickt „Speichern".
3. `ProfileForm.onSubmit` ruft `updateCustomerProfile(...)` (PATCH /api/customer/me).
4. Erfolg → `setSuccess(...)` aber: KEIN `router.refresh()`, KEIN
   `useCustomer().refresh()`.
5. Bei einem Re-Render des Headers — z. B. weil ein anderer Effekt einen
   neuen Render triggert — fetcht `useCustomer` erneut. *Wenn* das
   `getCustomerMe()`-Call kurzfristig fehlschlägt (z. B. Race mit dem
   PATCH-Server-Roundtrip, oder ein 304-Cache-Issue), → fallback auf
   `'unauthenticated'` → Header zeigt „Anmelden".

Alternativ-Hypothese: `getCustomerMe()` returnt `null` wenn der API-
Response 401 ist — und der PATCH-Endpoint hat (versehentlich?) das
Cookie invalidiert.

### Lösungsansatz

1. **`getCustomerMe()` darf bei Network-Fehler NICHT auf `unauthenticated`
   fallen** — der vorherige State muss erhalten bleiben. Stattdessen:
   neuer State `'error'`, Header zeigt weiterhin den letzten bekannten
   Customer.
2. **Globaler Sync-Mechanismus:** Ein leichter Event-Bus in
   `src/lib/customer-sync.ts`:
   ```ts
   const target = new EventTarget();
   export function emitCustomerChanged() { target.dispatchEvent(new Event('change')); }
   export function onCustomerChanged(cb: () => void) { … }
   ```
   `useCustomer` hört auf das Event und re-fetched. Jede Customer-State-
   ändernde Stelle (Login, Logout, Profil-Save, Register-from-Booking,
   OAuth-Finalize) ruft `emitCustomerChanged()`.
3. **`PATCH /api/customer/me` darf das Cookie NICHT invalidieren** —
   Backend-Engineer muss prüfen, ob der Endpoint die Session-Token
   regeneriert (sollte er nicht).

### Betroffene Dateien

- **NEU:** `src/lib/customer-sync.ts`
- **GEÄNDERT:** `src/lib/use-customer.ts` (Event-Subscription, Error-Handling)
- **GEÄNDERT:** `src/components/customer/ProfileForm.tsx` (`emitCustomerChanged()` aufrufen)
- **GEÄNDERT:** `src/lib/api-client.ts` (`logoutCustomer`, `loginCustomer` → `emitCustomerChanged()`)

---

## 8. IT12-S08 — Buchungsformular mit Profildaten vorausfüllen

### Root-Cause / Status

Der Code in `BookingForm.tsx` (Zeile 110–112, 134–148) füllt bereits
`defaultName`, `defaultEmail`, `defaultPhone`, `profileAddress` aus
dem `useCustomer`-Hook in `BookingClient.tsx` (Zeile 75) vor.

**Wahrscheinliche Ursachen, warum es in Production trotzdem nicht
funktioniert:**

1. `useCustomer()` ist im `BookingClient` per Client-Component, läuft
   AFTER mount → in dem Moment, wo `BookingForm` gemountet wird,
   ist `customer === null` (weil noch nicht zurückgekehrt). React Hook
   Form initialisiert `defaultValues` *einmalig* beim Mount → wenn
   `customer` später lädt, sind die Defaults schon „leer" gesetzt.
2. Der `customer-session`-Cookie wird vom Browser nicht mitgesendet
   (CORS / SameSite-Lax — sollte nicht das Problem sein, aber prüfen).

### Lösungsansatz

Frontend-Pattern für RHF + async Defaults:

1. **Render-Gate:** `BookingForm` erst rendern, sobald
   `useCustomer()` `'authenticated'` ODER `'unauthenticated'` zurückgibt
   (nicht mehr `'loading'`). Während `'loading'` ein Skeleton zeigen.
2. ODER: `reset()`-Call im `useEffect` von `BookingForm`, sobald
   `customer` sich von `null` zu einem Wert ändert.

Empfehlung: Variante 1 — sauberer, weniger Re-Render. Bringt aber
1 Frame Skeleton mehr für den Customer.

### Betroffene Dateien

- `src/app/buchung/BookingClient.tsx`: Render-Gate auf `useCustomer().status`.
- `src/components/booking/BookingForm.tsx`: optional `reset()` bei
  Defaults-Änderung als Fallback.

### Risiken

- Diese Story überschneidet sich mit US-IT11-05 — der QA-Review IT11
  müsste klären, ob das schon einmal abgeschlossen wurde. Wenn ja:
  Retest reicht.

---

## 9. IT12-S09 — Scroll-Jump beim Feldwechsel im Buchungsformular

### Root-Cause-Hypothese

Wahrscheinlich derselbe Mechanismus wie S04 (siehe §0.2). Konkret:
`BookingForm` hat ein `useEffect`-Hook bei `watchedService` (Z. 161–163),
das bei *jedem* Service-Wechsel `onServiceChange?.(watchedService ?? null)`
aufruft. Der Parent (`BookingClient.tsx`, Z. 406) setzt dann
`setPickedService(...)` → State-Change → Re-Render → DurationPicker
re-rendert → ggf. Layout-Shift → der Browser kann die Scrollposition
in einem subtilen Race verlieren.

Alternativ: Ein `<button>` im Form ohne `type="button"`. Aber: alle
inline-Buttons haben `type="button"` (Z. 416, 651, 660). Der Submit-
Button hat `type="submit"` (Z. 660), korrekt im `<form>`-Kontext.

### Lösungsansatz

1. **Repro:** Frontend-Engineer öffnet Production, baut DevTools-
   Performance-Recording, wechselt Felder. Schaut sich die `Layout`-
   und `Scroll`-Events an. Identifiziert den exakten Trigger.
2. Wenn `setPickedService` der Trigger ist: den State-Update auf
   einen Throttle / `useDeferredValue` setzen, damit das Re-Render
   nicht bei jedem Tastendruck im (anderen) Feld feuert.
3. Quick-Fix: In `BookingForm.tsx` Z. 161–163, den `useEffect` durch
   einen `useDeferredValue`-Pattern ersetzen oder `onServiceChange`
   nur dann triggern, wenn der Service tatsächlich geändert wurde
   (dedupe gegen letzten Wert via Ref).

### Betroffene Dateien

- `src/components/booking/BookingForm.tsx` (useEffect dedupe)
- ggf. `src/app/buchung/BookingClient.tsx` (DurationPicker-Memo)

### Risiken

- Falls die Repro nicht eindeutig ist, könnte das auch ein Browser-
  Behavior (Chrome-spezifisch) sein. Frontend-Engineer testet auf
  Chrome + Safari.

---

## 10. IT12-S10 — Bild-Upload INTERNAL_ERROR

### Root-Cause-Hypothese

`/api/upload` (siehe `src/app/api/upload/route.ts`) ist gut implementiert.
Der `INTERNAL_ERROR`-Pfad triggert nur in zwei Fällen:

1. **`@vercel/blob#put()` wirft** (Zeile 248 catch). Häufigste Gründe:
   - `BLOB_READ_WRITE_TOKEN` ist gesetzt, aber ungültig / expired.
   - Vercel Blob Store ist nicht im aktuellen Project erstellt
     (Marketplace-Integration aktiv?).
   - Der Token gehört zu einem anderen Storage-Slot.
2. **Generic `internalError(err)`** am Ende (Zeile 280) — bei einem
   Bug im File-Type-Detection oder Prisma-Insert.

Beachte: Wenn `BLOB_READ_WRITE_TOKEN` *fehlt*, wird 503
`BLOB_NOT_CONFIGURED` zurückgegeben (Zeile 232) — das wäre ein
*anderer* Fehlercode als INTERNAL_ERROR. Story sagt eindeutig
"INTERNAL_ERROR", also ist der Token *gesetzt* aber etwas am
`put()`-Aufruf läuft schief.

**Verdacht:** Filename mit Umlauten. Der `sanitizeFilename`-Helper
(Zeile 51–55) ersetzt Nicht-ASCII durch `_` — also nicht das Problem.

**Wahrscheinlichste Ursache:** Der `BLOB_READ_WRITE_TOKEN` in Production
ist abgelaufen oder gehört zu einem anderen Store. Beim Vercel-
Marketplace-Onboarding (Iteration 11) könnte ein Token rotiert worden
sein.

### Lösungsansatz

1. Vercel Dashboard → Storage → Blob → Token regenerieren / verifizieren.
2. Token in Production-Env-Variables aktualisieren.
3. Smoke-Test: 1MB JPEG hochladen, Vercel-Function-Log live prüfen.
4. Falls weiterhin Fehler: `console.error('[upload] vercel blob put failed:', err)`
   gibt die Exception aus — Stack-Trace lesen.

### Betroffene Dateien

- *Konfiguration*. Sollte ein Code-Bug die Ursache sein:
  `src/app/api/upload/route.ts` (Error-Handling verfeinern, mehr
  Logging-Kontext).

### Risiken

- Wenn Vercel-Blob als Service ausgefallen ist: Statusseite checken,
  Resend bis Service zurück ist.

---

## 11. IT12-S11 — Submission ohne Feedback

### Root-Cause

`BookingForm.onSubmitNewBooking` (Z. 231–290) hat ein `await createBooking(payload)`
und ruft im `try` `setStatus({ kind: 'success' })`. Im `catch` (`handleApiError`)
werden alle Fehlerklassen abgehandelt. Es gibt *keinen* offensichtlichen
Bug, der zu „Loader bleibt stehen" führt — alle Pfade setzen den Status.

**Aber:** der Loader ist `isBusy = isSubmitting || rebookSubmitting || status.kind === 'submitting'`
(Z. 382). Der `<Button isLoading={isBusy}>` (Z. 660) zeigt den Loader.

Wenn `createBooking` *intern* einen Fehler wirft, der NICHT von
`ApiClientError` gefangen wird (z. B. Promise-Reject ohne typierte
Error), läuft das in den generischen `else`-Pfad (Z. 375–379) —
setzt `status.kind = 'error'`, Loader weg, Banner zeigt eine Meldung.

**Mögliche Ursachen für „Loader bleibt stehen":**

1. Der `await createBooking()` resolved nie — z. B. weil der Server
   500 zurückgibt, der Browser keinen Body lesen kann, und die
   `api-client.ts`-Implementierung von `createBooking` nicht in den
   Reject-Pfad geht. Bei einem 500 mit kaputtem Body kann der `fetch`
   hängen oder `.json()` werfen → das *sollte* aber durch
   `ApiClientError`-Wrapping abgefangen werden.
2. Der Submit-Button hat kein `disabled={isSubmitting}` direkt — RHF
   schützt davor doppelte Submits, aber wenn `isSubmitting` sich nicht
   zurücksetzt (because of unawaited rejection), bleibt das Form busy.

**Hauptsymptom (Story sagt explizit) ist aber: „Buchungsanfrage
erscheint nicht im Kundenkonto".** → das ist ein *anderer* Bug:
`/api/customer/bookings` ist kaputt (S06 — fehlende Migration). Sobald
S06 fixed ist, erscheint die Anfrage. Der Loader-Bug ist ein
*sekundäres* Symptom: der Server brennt einen 500 (weil eine
Migration fehlt — möglicherweise auch bei `POST /api/bookings`?), die
Response ist nicht gut typisiert, und der Client hängt.

### Lösungsansatz

1. **Primär:** S06-Fix (Migration deploy). Sobald `POST /api/bookings`
   und `GET /api/customer/bookings` wieder 200/201 liefern, sollte der
   Submit-Loader korrekt verschwinden und die Anfrage im Dashboard
   erscheinen.
2. **Defensiv:** In `BookingForm.tsx` einen `try/catch/finally`-Wrapper
   um den ganzen Submit-Block legen, der im `finally` IMMER den
   Loading-State zurücksetzt:
   ```ts
   try {
     setStatus({ kind: 'submitting' });
     const res = await createBooking(payload);
     // ...
   } catch (err) {
     handleApiError(err);
   } finally {
     // Zusätzliches Sicherheitsnetz — auch wenn handleApiError nichts
     // tut, gehen wir zurück zu idle. ABER: success-Pfad würde auch
     // resetten — also nur wenn aktuell submitting.
     setStatus((s) => (s.kind === 'submitting' ? { kind: 'idle' } : s));
   }
   ```
3. **Test:** Sobald die Anfrage gespeichert ist, `router.refresh()`
   für `/konto` triggern (oder der Customer landet eh auf der
   Bestätigungsseite, danach wenn er auf `/konto` navigiert wird das
   Server-Component neu gerendert).

### Betroffene Dateien

- `src/components/booking/BookingForm.tsx` (defensives finally)
- *Indirekt:* Production-Migration (siehe §0.1)

### Risiken

- Wenn S06 nicht der Grund für den Hang-Loader ist, müssen wir tiefer
  graben — möglicherweise hängt der Vercel-Function-Cold-Start. Der
  Frontend-Engineer beobachtet `Network`-Tab in DevTools beim Submit.

---

## 12. IT12-S12 + S13 — Admin „Bevorstehende Termine" + „Buchungsanfragen"

Beide haben dieselbe Wurzel wie S06: fehlende Migration. Siehe §0.1.

`/api/admin/upcoming-bookings/route.ts` und `/api/bookings` (Admin GET)
greifen beide auf das `bookings`-Table zu, das nach IT11 die neuen
Cancellation-Felder enthält. Nach `prisma migrate deploy` sind alle drei
Endpoints (S06, S12, S13) wieder funktional.

### Betroffene Dateien

- *Keine Code-Änderungen.* Migration in Production deployen.

---

## 13. IT12-S14 — Admin-Navigation-Restrukturierung

### Design

Aktueller Stand siehe §0.5. Ziel-IA aus der Story.

**Lösungs-Skizze (Sidebar-Variante, technisch):**

`src/components/admin/AdminLayout.tsx` (NEU) als Wrapper für alle
Admin-Routen. Linke Sidebar (Desktop) bzw. Top-Bar mit Accordion
(Mobile). Drei Gruppen, in jeder Gruppe Links auf existierende Routen:

```
1. Kalender & Zeitmanagement
   - /admin/calendar         → Kalender-Übersicht
   - /admin?tab=slots        → Zeitfenster verwalten
   - /admin?tab=availability → Verfügbarkeit
   - /admin?tab=bookings     → Buchungsanfragen

2. Nutzerverwaltung
   - /admin/users            → Kunden
   - /admin/admins           → Admins

3. Auswertungen
   - /admin/analytics        → Analytics
   - /admin/reviews          → Bewertungen
```

`AdminDashboard.tsx` rendert dann nur noch den Content (kein QuickLink-
Block mehr, keine duplizierten Nav-Items). Die Tab-Bar bleibt für
Sub-Bereiche innerhalb von `/admin` (Buchungsanfragen, Zeitfenster,
Verfügbarkeit, Bewertungen) — aber DERER Inhalt ist nicht mehr
„Bewertungen" doppelt.

**Wichtig:** Keine API-Pfade brechen — alle Routen existieren bereits.

### Architektur-Vorgabe

- Reine UX-Aufgabe; visuelle Umsetzung gehört zu `ux-designer`.
- DOM-Constraint: „Bewertungen" darf in der gerenderten Admin-Seite nur
  einmal als Nav-Element vorkommen (Test: `Cypress: cy.contains('Bewertungen').should('have.length', 1)`).

### Betroffene Dateien

- **NEU:** `src/components/admin/AdminLayout.tsx`
- **GEÄNDERT:** `src/components/admin/AdminDashboard.tsx` (Nav weg)
- **GEÄNDERT:** `src/app/admin/layout.tsx` (Wrapper einziehen, falls noch nicht)

---

## 14. IT12-S15 — Admin Marketing-E-Mail mit Service-Filter

### Design

#### 14.1 Datenmodell

**Neue Tabellen** (zwei Migrationen oder eine kombinierte):

```prisma
/// IT12 / US-IT12-15 — Marketing-E-Mail-Audit (Compliance / DSGVO).
/// Dokumentiert: Wer hat wann an welche Empfänger welchen Betreff gesendet.
model MarketingEmail {
  id            String    @id @default(cuid())
  /// Welcher Admin (User.id) hat den Versand initiiert.
  sentByAdminId String
  sentByAdmin   User      @relation("MarketingEmailSentBy", fields: [sentByAdminId], references: [id], onDelete: Restrict)
  subject       String    /// Max 200 chars (App-Layer).
  bodyText      String    /// Plaintext. Max 10k chars (App-Layer).
  bodyHtml      String?   /// Optional HTML-Render. Wird vom Backend aus bodyText
                          /// generiert wenn null.
  /// Filter, der bei der Empfänger-Auswahl angewandt wurde — für Audit.
  filterServices String   /// JSON-Array of service slugs, z.B. '["entruempelung"]'.
  /// Anzahl der intendierten Empfänger zum Zeitpunkt des Versands.
  recipientCount Int
  /// Anzahl, an die tatsächlich erfolgreich versendet wurde.
  successCount  Int       @default(0)
  /// Anzahl, an die der Versand fehlgeschlagen ist.
  failureCount  Int       @default(0)
  createdAt     DateTime  @default(now())
  /// Zeitpunkt, an dem alle Sends abgeschlossen waren.
  completedAt   DateTime?

  recipients    MarketingEmailRecipient[]

  @@index([sentByAdminId, createdAt])
  @@map("marketing_emails")
}

/// IT12 / US-IT12-15 — Pro Empfänger ein Record (Sent-Status + Unsubscribe).
model MarketingEmailRecipient {
  id                String          @id @default(cuid())
  marketingEmailId  String
  marketingEmail    MarketingEmail  @relation(fields: [marketingEmailId], references: [id], onDelete: Cascade)
  customerId        String
  customer          CustomerUser    @relation("MarketingEmailRecipient", fields: [customerId], references: [id], onDelete: Cascade)
  email             String          /// Snapshot der E-Mail zum Versandzeitpunkt.
  status            String          @default("PENDING")  /// 'PENDING' | 'SENT' | 'FAILED' | 'UNSUBSCRIBED'
  resendMessageId   String?         /// Resend-Response-ID für Trace.
  errorMessage      String?
  sentAt            DateTime?

  @@index([marketingEmailId, status])
  @@index([customerId])
  @@map("marketing_email_recipients")
}

/// IT12 / US-IT12-15 — Customer-Level Unsubscribe-Flag (DSGVO).
/// Wenn TRUE, werden zukünftige Marketing-Mails an diesen Customer gestoppt.
/// Transaktionale E-Mails (Bestätigung, Storno, Reset) sind NICHT betroffen.
model CustomerMarketingPreference {
  customerId        String     @id
  customer          CustomerUser @relation("MarketingPreference", fields: [customerId], references: [id], onDelete: Cascade)
  unsubscribed      Boolean    @default(false)
  unsubscribedAt    DateTime?
  /// Token für den E-Mail-Footer-Link (sha256-hex). Pro Customer einmal generiert,
  /// stabil für Wiederverwendung.
  unsubscribeTokenHash String  @unique
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  @@map("customer_marketing_preferences")
}
```

**Begründung Auslagerung in eigene Tabelle:** `CustomerMarketingPreference`
ist nicht in `CustomerUser` integriert, weil:
- Der `unsubscribeTokenHash` (sha256) sollte nicht in der primären
  User-Tabelle indiziert sein.
- DSGVO-Compliance: Das Unsubscribe-Event ist ein eigenes Audit-fähiges
  Datum, kein User-Attribut.

#### 14.2 Endpoints

**GET `/api/admin/customers/marketing-list?services=entruempelung,reinigung&search=…`**

- Auth: Admin-Session.
- Liefert eine paginierte Liste aller `CustomerUser`s, die mind. eine
  *abgeschlossene* (Status = COMPLETED) Buchung in den gefilterten
  Services haben. Wenn `services` leer → alle Customer mit mind. einer
  COMPLETED-Buchung.
- Pro Customer: `id`, `email`, `firstName`, `lastName`, `bookedServices: string[]`,
  `unsubscribed: boolean`, `lastBookingAt: DateTime`.
- Query-Logik (Backend):
  ```sql
  SELECT cu.*, ARRAY_AGG(DISTINCT b.service) as booked_services, COUNT(b.id), MAX(b.createdAt)
  FROM customer_users cu
  JOIN bookings b ON b.customerId = cu.id AND b.status = 'COMPLETED'
  WHERE b.service IN (...)
  GROUP BY cu.id
  ```
  In Prisma wegen SQLite mit `findMany` + `groupBy` und nachträglicher
  Aggregation.
- **Wichtig:** `unsubscribed = TRUE`-Customer werden in der Liste
  angezeigt, aber visuell markiert (z. B. Tag „Abgemeldet"). Beim
  Senden werden sie automatisch aus dem Empfänger-Set ausgeschlossen
  (Backend zwingt das, Frontend zeigt's auch).

**POST `/api/admin/marketing/email`**

- Auth: Admin-Session.
- Request:
  ```jsonc
  {
    "subject": "Frühjahrsangebot",
    "body": "Hallo {{firstName}}, ...",  // {{firstName}} optional templating
    "recipientIds": ["cust_1", "cust_2", ...],
    "filterServices": ["entruempelung"]  // für Audit
  }
  ```
- Validierung:
  - Mind. 1 Recipient.
  - Subject 1..200 chars.
  - Body 1..10_000 chars.
  - RecipientIds müssen alle existieren UND `unsubscribed === false`
    (Backend filtert harte raus).
- Verarbeitung:
  1. `MarketingEmail`-Record anlegen (Status = pending,
     `recipientCount` = filtered.length).
  2. Für jeden Empfänger einen `MarketingEmailRecipient`-Record (status =
     PENDING).
  3. **Async-Versand mit Concurrency 5:**
     - Promise-Pool / einfaches Semaphor.
     - Für jeden Recipient: `resend.emails.send({ to, subject, html: renderHtml(body, customer, unsubscribeUrl) })`.
     - Ergebnis in `MarketingEmailRecipient` updaten (SENT / FAILED).
  4. Nach allen Sends: `MarketingEmail.completedAt = now()`,
     `successCount` und `failureCount` aktualisieren.
- Response (synchron):
  ```jsonc
  {
    "marketingEmailId": "...",
    "intendedRecipients": 47,
    "actualRecipients": 45,    // 2 ausgefiltert wegen Unsubscribe
    "status": "processing"
  }
  ```
  Oder, bei kleinem Empfängerkreis (< 10), synchron warten und direkt
  `status: "completed"` mit `successCount`/`failureCount` zurückgeben.

**GET `/api/admin/marketing/email/:id`**

- Liefert den Status eines Sendvorgangs (für UI-Polling).

**GET `/api/marketing/unsubscribe?token=…`** *(public)*

- Public, kein Auth.
- Verifiziert das Token (sha256 vergleich gegen `unsubscribeTokenHash`).
- Setzt `CustomerMarketingPreference.unsubscribed = true`.
- Zeigt eine Bestätigungsseite („Sie wurden abgemeldet").

#### 14.3 Resend-Integration

- Verwende existierende `lib/mail.ts`-Infrastruktur, falls sie schon
  Resend-Client kapselt. Andernfalls neuer Helper `lib/marketing-mail.ts`.
- Concurrency 5, sequenzielle Batches mit kurzem `await new Promise(r => setTimeout(r, 200))`
  zwischen Batches.
- Bei Resend-Errors: `MarketingEmailRecipient.errorMessage = err.message`,
  status = FAILED, weitermachen (kein Throw nach oben).

#### 14.4 Unsubscribe-Footer

Jede Marketing-Mail enthält am Ende:

```
Diese E-Mail haben Sie erhalten, weil Sie Kunde von Bärenstark Hausservice
sind. Wenn Sie keine weiteren Marketing-Mails erhalten möchten, klicken
Sie hier: {unsubscribeUrl}
```

`unsubscribeUrl = ${baseUrl}/api/marketing/unsubscribe?token=${unsubscribeToken}`

Token wird beim ersten Senden für jeden Customer generiert und im
`CustomerMarketingPreference`-Record als `unsubscribeTokenHash`
persistiert; das *Klartext-Token* lebt nur in der Mail (gleicher
Pattern wie Password-Reset-Tokens).

#### 14.5 Rate-Limiting & Bestätigung

- Frontend: Bei > 50 Empfängern Confirm-Dialog mit Anzahl.
- Backend: Pro Admin max 5 Marketing-Mail-Aktionen/h.

### Betroffene Dateien

- **Migration NEU:** `prisma/migrations/20260504_<...>_marketing_emails/migration.sql`
- **Schema GEÄNDERT:** `prisma/schema.prisma` (drei neue Models, zwei
  neue Relations auf `User` und `CustomerUser`).
- **NEU:** `src/app/api/admin/customers/marketing-list/route.ts`
- **NEU:** `src/app/api/admin/marketing/email/route.ts` (POST)
- **NEU:** `src/app/api/admin/marketing/email/[id]/route.ts` (GET status)
- **NEU:** `src/app/api/marketing/unsubscribe/route.ts` (public GET)
- **NEU:** `src/app/marketing/abgemeldet/page.tsx` (Bestätigungsseite)
- **NEU:** `src/lib/marketing-mail.ts` (Resend-Sender mit Concurrency)
- **NEU:** `src/lib/marketing-tokens.ts` (Token-Generation + Verify)
- **NEU:** `src/app/admin/users/page.tsx` Erweiterung mit Service-Filter
  + Bulk-Select + „E-Mail senden"-Button.
- **NEU:** `src/components/admin/users/MarketingEmailComposeModal.tsx`

### Risiken

- **Resend-Quota:** Free-Plan nur 100 Mails/Tag. Tom muss bei einer
  Kampagne von ≥ 50 Empfängern aufpassen. Frontend zeigt eine Warnung
  bei mehr als 50. Empfehlung: Resend-Tier prüfen, ggf. Pro upgraden.
- **GDPR-Audit:** Die `MarketingEmail`-Records sind die zentrale
  Compliance-Datenspur. Backend-Engineer muss sicherstellen, dass die
  Records *nie* gelöscht werden (kein CASCADE bei Customer-Delete —
  stattdessen E-Mail-Field nullable machen oder die Foreign-Key
  `onDelete: SetNull`).
- **Async-Versand-Failure-Recovery:** Wenn der Vercel-Function-Timeout
  (10s im Hobby, 60s im Pro) bei großen Recipient-Listen schlägt zu:
  Nicht alle Sends laufen durch. Lösung: bei > 10 Empfängern das
  Senden in einer separaten Vercel-Cron oder Background-Function
  starten. Für IT12-MVP: Annahme, dass < 50 Empfänger im 60s-Limit
  passen (5 parallel * 200ms = 2s pro Batch * 10 Batches = 20s).

---

## 15. Build-Reihenfolge (Empfehlung)

Reihenfolge mit minimalem Risiko, parallel-safe:

1. **Backend, Tag 1:** Migration in Production deployen (§0.1).
   Alle drei Endpoints (S06/S12/S13) mit Smoke-Test verifizieren.
2. **Backend, Tag 1:** Vercel-Env-Variables prüfen (S01 OAuth + S10 Blob).
3. **Frontend, Tag 1:** S02 Service-Bilder (rein deklarativ, schnell).
4. **Frontend, Tag 1:** S04 + S09 Scroll-Fixes (Helper anlegen).
5. **Frontend + Backend, Tag 2:** S07 Login-State-Sync.
6. **Backend, Tag 2:** S03 Kalender-Performance.
7. **Frontend, Tag 2:** S08 Profil-Vorausfüllung (Render-Gate).
8. **Frontend, Tag 2:** S11 Submission-Feedback (defensives Finally).
9. **Frontend + Backend, Tag 3:** S05 Konto-aus-Anfrage.
10. **Frontend, Tag 3:** S14 Admin-Nav (UX-Spec abwarten).
11. **Backend + Frontend, Tag 3-4:** S15 Marketing-E-Mail (größtes
    Feature).

Parallel: S02, S04, S09 können vom Frontend-Engineer gemacht werden,
während Backend an Migration + S03 + S15 arbeitet.

---

## 16. Offene Punkte / Eskalation an Orchestrator

- **NEEDS INPUT:** Soll für S15 Marketing-E-Mail der Resend-Pro-Plan
  upgegradet werden? (Free = 100 Mails/Tag.)
- **NEEDS INPUT:** Vercel-Plan-Tier (Hobby vs. Pro) für S15-Async-
  Versand-Timeout-Handling.
- **Annahme:** `prisma migrate deploy` ist die Wurzel von S06/S12/S13.
  Falls Vercel-Logs anders zeigen → Eskalation an Architect.
- **Annahme:** Service-Bilder mit Umlauten funktionieren mit
  `next/image`. Falls in QA Probleme → Dateien umbenennen.
- **Annahme:** S08 ist möglicherweise schon in IT11 gelöst —
  Frontend-Engineer verifiziert zuerst und meldet zurück, ob
  Code-Change nötig ist.

---

## Phase-2-Revision (Post-QA, 2026-05-04)

> Diese Sektion adressiert die in `QA_DESIGN_REVIEW_IT12.md` aufgeführten
> Critical Issues C1-C8 und relevante Major Concerns. Ergänzt um
> Stakeholder-Antworten (DSGVO Variante 3, Plain-Text only, Resend Free,
> Vercel Hobby, embedded Konto-Card, 3-Gruppen-Admin-Nav).
>
> **Diese Sektion ist Single-Source-of-Truth.** Bei Konflikten mit
> früheren Sektionen oder mit UX-Specs / Frontend-/Backend-Reqs gilt:
> diese Sektion gewinnt.

### R.0 Stakeholder-Entscheidungen (verbindlich)

| Thema | Entscheidung |
|-------|--------------|
| DSGVO Marketing | UWG §7 Abs. 3 (Bestandskunden-Sonderregel). Kein explizites Opt-In. Pflicht: Unsubscribe-Link, Widerspruchshinweis im Footer, `unsubscribedAt`-Flag pro Customer. |
| Mail-Format | Plain-Text only für IT12. Rich-HTML Backlog. |
| Resend-Tier | Free (100/Tag, 3.000/Monat). |
| Vercel-Plan | Hobby (10s Function-Timeout). |
| Konto-Anbieten (S05) | Embedded-Card auf Erfolgsseite (kein Modal, kein Bottom-Sheet). |
| Admin-Nav (S14) | 3 Gruppen: Kalender & Zeitmanagement / Nutzerverwaltung (inkl. Marketing-Mails) / Auswertungen. |

### R.1 Quick-Fix C1: NEXTAUTH_URL korrigiert

**Befund (aus `.env.production` Zeile 12-13):**
```
NEXTAUTH_URL="https://baerenstark-hausservice.app"          # FALSCH
NEXT_PUBLIC_BASE_URL="https://baerenstark-hausservice.app"  # FALSCH
```

**Aktion (durchgeführt):** Beide Werte auf `https://www.baerenstark-hausservice.app` korrigiert (Repo-File). DevOps muss die Vercel-Production-Env-Vars **vor dem nächsten Deploy** ebenfalls aktualisieren.

**Verifikation nach Deploy:**
1. Vercel Dashboard → Settings → Environment Variables → `NEXTAUTH_URL` und `NEXT_PUBLIC_BASE_URL` beide auf `https://www.baerenstark-hausservice.app` (Production).
2. Inkognito-Test gegen Production-URL: `/konto/login` → „Mit Google anmelden" → erwartet 302 → Google → 302 → `/api/customer/oauth-finalize` → `/konto`.
3. Vercel Function-Logs: Kein 4xx auf `/api/auth/customer/callback/google`.

### R.2 SSOT: Service-Slugs (C2)

**Verbindliche Slugs aus `src/lib/services.ts` (`SERVICES`-Konstante):**

```
entruempelung
entkernung
reinigung
gruenflaechenpflege
muelltonnenservice
entsorgung
sonstiges    # nur intern, keine Detail-Page
```

**Bild-Mapping (`src/lib/service-images.ts` NEU):**

| Slug | Bilddatei in `/public/` |
|------|-------------------------|
| `entruempelung` | `/entruemplungen.png` |
| `entkernung` | `/entkernungsarbeiten.png` |
| `reinigung` | `/reinigungsarbeiten.png` |
| `gruenflaechenpflege` | `/grünflächenpflege.png` |
| `muelltonnenservice` | `/mülltonnenservice.png` |
| `entsorgung` | `/metal_schrott.png` |

**UX-Designer-Aufgabe:** UX-Spec §3.2.2 + alle Verweise auf falsche Slugs (`entruempelungen`, `entkernungsarbeiten`, `reinigungsarbeiten`, `entsorgung-schrott-metalle`) auf die obigen Codebase-Slugs korrigieren. **Datenbank wird NICHT geändert** (würde URLs brechen, SEO-relevant).

### R.3 SSOT: Routen (C3)

**Verbindlich aus Codebase:**

| Bereich | Pfad | Hinweis |
|---------|------|---------|
| Service-Detail | `/services/[slug]` | (NICHT `/leistungen/...`) |
| Buchung | `/buchung` | |
| Buchungsbestätigung | `/buchung/bestaetigung/[id]?token=...` | |
| Customer-Konto | `/konto` | |
| Customer-Profil | `/konto/profil` | |
| Customer-Login | `/konto/login` | |
| Customer-Registrierung (Self-Service) | `/konto/registrieren` | |
| Admin-Dashboard | `/admin` | |
| Admin-Kalender | `/admin/calendar` | |
| Admin-Kunden | `/admin/users` | (mit Marketing-Aktion) |
| Admin-Reviews | `/admin/reviews` | |
| Admin-Analytics | `/admin/analytics` | |
| Marketing-Abmeldung | `/marketing/abgemeldet` | Public, Bestätigungsseite |

**UX-Designer-Aufgabe:** UX-Spec §3.2 + alle Verweise auf `/leistungen/[slug]` durch `/services/[slug]` ersetzen.

### R.4 SSOT: Endpoint-Tabelle (C4/C5/C6/C8)

**Diese Tabelle ist die einzige Quelle. Alle Specs müssen sich daran ausrichten.**

| # | Method + Path | Auth | Request-Body | Response | Error-Codes |
|---|---------------|------|--------------|----------|-------------|
| 1 | `POST /api/customer/register-from-booking` | Public (Token-gated) | `{ bookingId, confirmationToken, password }` | 201 `{ customerId, linkedBookingsCount }` + Set-Cookie | 400 VALIDATION_ERROR / 401 INVALID_TOKEN / 404 BOOKING_NOT_FOUND / 409 CONFLICT subcode `ACCOUNT_EXISTS` / 429 RATE_LIMITED |
| 2 | `GET /api/availability/calendar?from=&to=` | Public | — | 200 `{ days: [...] }` | 400 / 500 |
| 3 | `POST /api/bookings` | Public/Customer | `BookingPayload` + `Idempotency-Key`-Header (M8) | 201 `{ id, confirmationToken, ... }` | 400 / 409 SLOT_TAKEN / 429 / 500 |
| 4 | `GET /api/customer/bookings` | customerSession | — | 200 `{ upcoming, past }` | 401 / 500 |
| 5 | `GET /api/admin/marketing/recipients?service=&hasBooked=&unsubscribed=&search=&page=&limit=` | adminSession | — | 200 `{ data: MarketingRecipient[], total, page, limit }` | 401 |
| 6 | `POST /api/admin/marketing/emails` | adminSession | `{ subject, body, recipientIds[], filterServices[], status: 'draft' \| 'send' }` | 201 `{ id, status }` | 400 / 401 / 429 / 502 |
| 7 | `POST /api/admin/marketing/emails/{id}/test-send` | adminSession | — (sendet an Admin-Email aus Session) | 200 `{ ok: true, sentTo }` | 400 / 401 / 502 RESEND_ERROR |
| 8 | `POST /api/admin/marketing/emails/{id}/send` | adminSession | — (Bulk-Send-Trigger) | 200 `{ id, intendedRecipients, actualRecipients, successCount, failureCount, status: 'completed' \| 'partial_failure' \| 'failed' }` | 400 EMAIL_NOT_DRAFT / 401 / 413 RECIPIENT_CAP_EXCEEDED / 429 / 502 |
| 9 | `GET /api/admin/marketing/emails?limit=&page=` | adminSession | — | 200 `{ data: MarketingEmail[], total, page, limit }` | 401 |
| 10 | `GET /api/admin/marketing/emails/{id}` | adminSession | — | 200 `MarketingEmailDetail` (inkl. failedRecipients) | 401 / 404 |
| 11 | `GET /api/customer/unsubscribe?token=...` | Public (HMAC-Token) | — | 302 → `/marketing/abgemeldet?ok=1` (oder ?error=invalid bei 404) | 404 INVALID_TOKEN |

**Begründung der Endpoint-Wahl:**

- **S05 → `POST /api/customer/register-from-booking`** (NICHT als Erweiterung von `/api/auth/customer/register`). Begründung: Token-gated Logik (Confirmation-Token-Verify, Booking-Lookup, Multi-Booking-Linking) ist zu fremd für den Self-Service-Register-Pfad; eigener Endpoint ist sauberer und sicherheits-konzentrierter. Keine Code-Duplikation, da Backend-Helper (`hashPassword`, `setCustomerSessionCookie`, `splitName`) wiederverwendet werden.
- **S15 Endpoints unter `/api/admin/marketing/emails/` als Sub-Resource** (statt früher `/api/admin/marketing/email/{id}`). Begründung: Konsistenz mit REST-Konventionen (Plural für Collection); leichter zu lesen; Test-Send als sub-action `/test-send` semantisch klar getrennt vom Bulk-Send.
- **S15 Recipients-Endpoint umbenannt** von `/api/admin/customers/marketing-list` zu `/api/admin/marketing/recipients`. Begründung: gehört zur Marketing-Domäne, nicht zur Customer-Verwaltung; einheitlicher Prefix.
- **Unsubscribe unter `/api/customer/unsubscribe`** (statt früher `/api/marketing/unsubscribe`). Begründung: ist eine Customer-zentrische Aktion. URL ist in Plain-Text-Mails sichtbar — `/customer/unsubscribe` ist für den Empfänger verständlicher.

**Error-Subcode-SSOT (C5):** Konflikt 409 wird einheitlich `subcode: ACCOUNT_EXISTS` (nicht `EMAIL_EXISTS`). UX-Designer aktualisiert UX-Spec §3.5.4 + cl-it12 §3.

### R.5 DSGVO-Variante 3 — Datenmodell-Update (C7)

**Geändert ggü. §14.1:**

- ✗ **`CustomerMarketingPreference`-Modell entfällt** (war für Opt-In-Variante gedacht).
- ✓ **Stattdessen 2 Felder direkt auf `CustomerUser`:**

```prisma
model CustomerUser {
  // ... bestehende Felder ...
  unsubscribedAt        DateTime?  /// IT12-S15 — wann hat sich Customer abgemeldet
  unsubscribedReason    String?    /// IT12-S15 — optional, „Email-Footer-Click", manuell durch Admin etc.
}
```

**Migration:** `ALTER TABLE customer_users ADD COLUMN unsubscribedAt TIMESTAMP NULL; ADD COLUMN unsubscribedReason TEXT NULL;`

**Unsubscribe-Token: HMAC-deterministisch (stateless).** Kein eigener Token-Tabelle.

```ts
// src/lib/marketing-tokens.ts
import { createHmac } from 'node:crypto';

const SECRET = process.env.UNSUBSCRIBE_TOKEN_SECRET; // NEU in .env.production

export function generateUnsubscribeToken(customerId: string): string {
  const hmac = createHmac('sha256', SECRET).update(`unsubscribe:${customerId}`).digest('hex');
  // Token = base64url(customerId + ':' + hmac.slice(0, 32))
  return Buffer.from(`${customerId}:${hmac.slice(0, 32)}`).toString('base64url');
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const [customerId, sig] = decoded.split(':');
    if (!customerId || !sig) return null;
    const expected = createHmac('sha256', SECRET).update(`unsubscribe:${customerId}`).digest('hex').slice(0, 32);
    return sig === expected ? customerId : null;
  } catch { return null; }
}
```

**Vorteil:** Stateless, keine Tabelle, keine Migration für Tokens, kein TTL nötig (Token bleibt gültig solange Customer existiert), gleicher Token in allen Mails.

**Pflicht-Footer (verbindlich, Plain-Text, deutsch):**

```
--
Sie erhalten diese E-Mail, weil Sie Kunde bei Bärenstark Hausservice
sind. Wenn Sie keine weiteren Marketing-Mails von uns erhalten möchten,
melden Sie sich hier ab: {unsubscribeUrl}

Bärenstark Hausservice · Tom Siefert · Darmstadt · Impressum: {baseUrl}/impressum
```

`unsubscribeUrl = ${NEXT_PUBLIC_BASE_URL}/api/customer/unsubscribe?token=${token}`

**Audit-Trail bleibt:** `MarketingEmail` + `MarketingEmailRecipient` Tabellen wie in §14.1 (mit Snapshot der Empfänger zum Sendezeitpunkt).

**Sende-Filter-Logik (Backend, hart):**
```ts
// Vor Send: alle recipientIds laden, filter
const validRecipients = await prisma.customerUser.findMany({
  where: {
    id: { in: recipientIds },
    unsubscribedAt: null,
    email: { not: null },
  },
});
// Differenz zu intendedRecipients ist sichtbar im Response (actualRecipients).
```

### R.6 Bulk-Send-Architektur unter Free/Hobby-Constraints (M11/M12)

**Hard-Cap IT12: 50 Empfänger pro Send-Operation.**

Begründung der Zahlen:
- Resend Free: 100/Tag → 1× 50 Empfänger pro Tag ist nutzbar; bei 2× pro Tag warnen.
- Vercel Hobby: 10s Timeout. Resend-Send: ~150-300ms latency pro Mail. Mit Concurrency 5 + 200ms Throttle: 50 Mails ≈ 50/5 × (300ms send + 200ms throttle) = 5000ms = 5s. Sicherheitsmarge bleibt.
- > 50 Empfänger im UI: Confirm-Dialog blockiert + Hinweis „Bitte in mehreren Schüben senden, oder warte auf IT13 mit Cron-Job-Support".

**State-Machine `MarketingEmail.status`:**

```
draft       → Tom hat Mail im Composer angelegt, noch nicht abgeschickt
queued      → Send-Trigger empfangen, Backend bereitet Recipient-Set vor
sending     → Resend-Calls laufen
sent        → Alle Recipients SUCCESS
partial_failure → Mind. 1 FAILED, mind. 1 SUCCESS
failed      → 0 SUCCESS (z.B. Resend-Outage)
```

**Kein Vercel-Cron in IT12** (Hobby-Plan unterstützt nur 1×/Tag — nicht praktikabel für UX-getriggerten Send). Wenn IT13 oder Pro-Plan: Cron + Resume-Endpoint nachrüsten.

**Pragmatik IT12:** Synchroner Send mit Hard-Cap 50 + sofortige Response (`status: 'sent' | 'partial_failure' | 'failed'`). Kein Polling-Endpoint nötig im Happy-Path; nur bei Vercel-Timeout-Kollision (Edge-Case > 50, die wir hart blocken).

**Tom warnt:** UI zeigt verbleibendes Tageskontingent (`Heute: X von 100 Mails versendet`). Backend speichert `MarketingEmail.sentAt` und summiert per Tag.

### R.7 Test-Send (C8)

**Endpoint:** `POST /api/admin/marketing/emails/{id}/test-send`

- Voraussetzung: `MarketingEmail.status === 'draft'`.
- Verhalten:
  1. Lädt die Mail aus der DB.
  2. Sendet sie an Admin-E-Mail aus `session.user.email` (Tom's Admin-Mail).
  3. Mit Tom's Vornamen als `{firstName}` und einem Dummy-Unsubscribe-Token (verify-bar, aber harmlos — Token gehört zu Tom's Customer-ID falls existent, sonst Pseudo-Token).
  4. **Kein** Audit-Record (kein `MarketingEmailRecipient`-Insert für Test).
  5. Resend-Call gegen Production-Account (zählt zum Tageskontingent).
- Response: `{ ok: true, sentTo: 'tom@...' }` oder Error.
- Footer ist in der Test-Mail identisch zur echten Mail (damit Tom es 1:1 sieht).

### R.8 Major Concerns adressiert

**M1/S03 Performance-Targets:**
- Backend `/api/availability/calendar` p95 < 300ms (62-Tage-Range, 100 Bookings, kalter Cache).
- Frontend Render-Time Skeleton-zu-Grid p95 < 200ms.
- E2E Step-Wechsel zu sichtbarem Grid p95 < 1500ms.
- CI-Gate: Lighthouse-Run in Verify-Phase gegen Preview-Deployment.

**M2/S03 DB-Indizes:** Vor Build-Start `npx prisma migrate status` + `psql -c '\d bookings'` (oder Turso-Equivalent) gegen Prod ausführen und in Build-Notes dokumentieren. Indizes:
- `bookings(date, status)` ✓
- `bookings(status, date, startTime)` ✓
- `day_overrides(date)` UNIQUE ✓
- `availability_template(dayOfWeek)` ✓
- **NEU für IT12:** `customer_users(unsubscribedAt)` (sparse, für Filter-Performance).

**M9/S14 Bewertungs-Duplikat:** Frontend-Engineer muss vor Build-Start in `src/components/admin/AdminDashboard.tsx` und `AdminLayout.tsx`-Sub-Components grep'en, wo „Bewertungen" als Nav-Link/Tab gerendert wird. Erwartung: Quick-Link oben + Tab in der Mitte; nach Refactor nur noch Sidebar-Link in Gruppe „Auswertungen". Verify-AC: `cy.contains('Bewertungen').should('have.length', 1)` auf jeder Admin-Page.

**M8/S11 Idempotency-Key:** `POST /api/bookings` akzeptiert `Idempotency-Key`-Header (UUID). Backend speichert Key+Response für 24h in In-Memory-LRU oder kleiner DB-Tabelle. Bei doppeltem Submit mit gleichem Key: Cached-Response zurück, kein neuer Insert.

### R.9 Admin-Navigation 3-Gruppen (S14, präzisiert)

**Verbindliche Sidebar-Struktur:**

```
Kalender & Zeitmanagement
├── Kalender-Übersicht   → /admin/calendar
├── Buchungsanfragen     → /admin?tab=bookings
├── Zeitfenster          → /admin?tab=slots
└── Verfügbarkeit        → /admin?tab=availability

Nutzerverwaltung
├── Kunden               → /admin/users
├── Marketing-Mails      → /admin/users (mit ?action=marketing) ODER /admin/marketing
└── Admins               → /admin/admins

Auswertungen
├── Analytics            → /admin/analytics
└── Bewertungen          → /admin/reviews
```

**„Marketing-Mails"-Position:** Verortet unter Nutzerverwaltung, da Aktion auf Customer-Liste. Eigene Sidebar-Entry „Marketing-Mails" als Shortcut zur `/admin/users`-Page mit aktiviertem Marketing-Modus (Filter-Bar sichtbar) ODER eigene Page `/admin/marketing` falls UX-Designer eine eigenständige Übersichts-Page bevorzugt (Marketing-Historie, Templates, Stats).

**Empfehlung:** Eigene Page `/admin/marketing` mit drei Sub-Tabs: „Kunden auswählen" (= aktuelle `/admin/users`-Liste mit Marketing-Filter), „Versand-Historie", „Statistiken". Frontend-Engineer entscheidet finale Aufteilung gemeinsam mit UX-Designer.

### R.10 Coverage-Mapping QA-Issue → Fix-Location

| QA-Issue | Status | Fix-Location |
|----------|--------|--------------|
| C1 NEXTAUTH_URL | ✓ Fixed | `.env.production` korrigiert; DevOps muss Vercel-Env nachziehen |
| C2 Slug-Mismatch | ✓ Doc-Fixed | SSOT in §R.2; UX-Designer-TODO |
| C3 Routen-Mismatch | ✓ Doc-Fixed | SSOT in §R.3; UX-Designer-TODO |
| C4 S05-Endpoint-Konflikt | ✓ Doc-Fixed | Endpoint #1 in §R.4 |
| C5 409-Subcode | ✓ Doc-Fixed | `ACCOUNT_EXISTS` in §R.4 |
| C6 S15-Endpoint-Konflikt | ✓ Doc-Fixed | Endpoints #5-#11 in §R.4 |
| C7 DSGVO-Modell | ✓ Doc-Fixed | §R.5 (Variante 3, kein Consent-Modell) |
| C8 Test-Send-Endpoint | ✓ Doc-Fixed | Endpoint #7 in §R.4 + §R.7 |
| M1 Performance-Targets | ✓ Doc-Fixed | §R.8 |
| M2 DB-Indizes-Verify | ✓ Doc-Fixed | §R.8 |
| M8 Idempotency | ✓ Doc-Fixed | §R.8 |
| M9 Bewertungs-Duplikat | ✓ Doc-Fixed | §R.8 |
| M11 Rate-Limit Resend | ✓ Doc-Fixed | §R.6 (Hard-Cap 50 + Quota-Anzeige) |
| M12 Async-Recovery | ✓ Doc-Fixed | §R.6 (Hard-Cap eliminiert das Problem in IT12) |

### R.11 Aufgaben-Verteilung Post-Revision

**Solution Architect (selbst, in dieser Revision erledigt):**
- ARCHITECTURE_IT12.md §R-Sektionen.
- backend-requirements-iteration-12.md aktualisiert.
- frontend-requirements-iteration-12.md aktualisiert.
- contracts/iteration-12.openapi.yaml synchronisiert.
- `.env.production` NEXTAUTH_URL korrigiert.

**UX-Designer (TODO, nicht in dieser Revision):**
- ux-spec-iteration-12.md §3.2 — Routen `/leistungen/...` → `/services/...` (alle Vorkommen).
- ux-spec-iteration-12.md §3.2.2 — Service-Slugs auf SSOT (R.2).
- ux-spec-iteration-12.md §3.5.4 — `EMAIL_EXISTS` → `ACCOUNT_EXISTS`.
- ux-spec-iteration-12.md §3.5 — Konto-Anbieten als embedded Card (kein Modal/Bottom-Sheet) auch auf Mobile.
- marketing-email-flow.md §7 — Endpoint-Tabelle auf SSOT (R.4).
- component-library-iteration-12.md §3, §6 — Endpoints + Microcopy synchronisieren.
- Microcopy-Footer für Marketing-Mails (R.5) in UX-Spec §1 / Microcopy-Bibliothek aufnehmen.

**DevOps / Backend-Engineer (TODO, vor Build):**
- Vercel-Production-Env: `NEXTAUTH_URL` und `NEXT_PUBLIC_BASE_URL` auf `https://www.baerenstark-hausservice.app`.
- Vercel-Production-Env NEU: `UNSUBSCRIBE_TOKEN_SECRET` (32+ random bytes, separate Secret von `BOOKING_TOKEN_SECRET`).
- `npx prisma migrate status` gegen Prod, falls pending → `migrate deploy`.
- Google Cloud Console: Authorized Redirect URI exakt `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`.

*Ende Phase-2-Revision.*
