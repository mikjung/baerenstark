# QA Design Review — Iteration 12

> **Author:** QA Engineer (Subagent), 2026-05-04
> **Mode:** Design QA (vor Build-Phase)
> **Scope:** Iteration 12, Stories IT12-S01 bis IT12-S15
> **Inputs:** PROJECT.md §IT12, ARCHITECTURE_IT12.md, frontend-/backend-requirements-iteration-12.md, ux-spec-iteration-12.md, component-library-iteration-12.md, admin-information-architecture.md, marketing-email-flow.md, contracts/iteration-12.openapi.yaml + Repo-Inspektion (`.env.production`, `prisma/migrations/`, `src/lib/services.ts`, `src/app/services/[slug]/`, `src/app/buchung/bestaetigung/[bookingId]/`).

---

## 0. Zusammenfassung Verdict

| Kategorie | Anzahl |
|-----------|--------|
| Critical (Build-Blocker) | **8** |
| Major (Should-fix vor Build) | 12 |
| Minor (Nice-to-fix) | 9 |
| Open Questions an Stakeholder | 7 |

**Gesamt-Verdict:** ⚠ **Needs Revision before Build** — 4 Stories haben Build-Blocker (Spec-Konflikte, Endpoint-Mismatches, Pfad-Mismatches), die ohne Klärung unweigerlich zu Frontend↔Backend-Fehlbau und Build-Loop in Verify-Phase führen.

---

## 1. Verdict per Story

| Story | Verdict | Critical Issues |
|-------|---------|------------------|
| IT12-S01 (OAuth) | ⚠ Pass with conditions | C1 (NEXTAUTH_URL real falsch in `.env.production` — ohne `www.`) |
| IT12-S02 (Service-Bilder) | ❌ Fail | C2 (Slug-Mismatch zwischen Spec-Mapping und Codebase), C3 (Routen-Mismatch `/leistungen` vs. `/services`) |
| IT12-S03 (Kalender) | ⚠ Pass with conditions | M1 (kein konkretes p95-Performanceziel), M2 (Indexe nicht verifiziert auf prod) |
| IT12-S04 (Scroll-Jump Slot) | ✓ Pass | — |
| IT12-S05 (Konto nach Buchung) | ❌ Fail | C4 (Endpoint-Konflikt UX↔Backend: `/api/auth/customer/register` vs. `/api/customer/register-from-booking`), C5 (409-Subcode-Mismatch `EMAIL_EXISTS` vs `ACCOUNT_EXISTS`), M3 (Confirmation-Token in Story nicht erwähnt) |
| IT12-S06 (Customer-Bookings 500) | ✓ Pass | — |
| IT12-S07 (Login-State) | ⚠ Pass with conditions | M4 (zwei konkurrierende Sync-Pattern: `useSession().update()` vs. eigener EventBus `customer-sync.ts`) |
| IT12-S08 (Prefill) | ⚠ Pass with conditions | M5 (Profil-Feld-Naming inkonsistent: `streetAndNumber` vs. `street`) |
| IT12-S09 (Scroll-Jump Form) | ⚠ Pass with conditions | M6 (Root-Cause unbestätigt — Architect schreibt explizit „Repro nicht eindeutig") |
| IT12-S10 (Upload) | ⚠ Pass with conditions | M7 (Status-Code-Mismatch UX vs Backend: 502 vs 503 vs INTERNAL_ERROR) |
| IT12-S11 (Submit-Feedback) | ⚠ Pass with conditions | M8 (Idempotency-Key fehlt: doppel-fire bei Retry) |
| IT12-S12 (Admin Upcoming) | ✓ Pass | — |
| IT12-S13 (Admin Bookings) | ✓ Pass | — |
| IT12-S14 (Admin-Nav) | ⚠ Pass with conditions | M9 (Bewertungs-Duplikat-Quelle nicht im Code identifiziert), M10 (welche Reviews-Route gelöscht?) |
| IT12-S15 (Marketing-E-Mail) | ❌ Fail | C6 (Endpoint-Pfad-Mismatch UX↔Backend), C7 (DSGVO-Lücke: kein dokumentiertes Werbe-Einwilligungs-Modell), C8 (Test-Send-Endpoint fehlt in Backend-Spec) |

---

## 2. Critical Issues (Müssen vor Build-Phase gefixt werden)

### C1 — `.env.production` enthält FALSCHEN `NEXTAUTH_URL` (S01)
**Story:** IT12-S01
**Routing:** Backend-Engineer / DevOps (Konfigurations-Fix)
**Severity:** Critical (Live-Bug)

**Befund:** Beim Lesen von `.env.production` wurde gefunden:
```
NEXTAUTH_URL="https://baerenstark-hausservice.app"
```
**ohne `www.`** — exakt das, was der Architect in §1 / S01 als Hauptursache vermutet. Das ist nicht nur eine Vercel-Env-Vermutung; das File im Repo bestätigt die Hypothese 1:1.

**Empfehlung:**
1. Sofort in Vercel-Production-Env auf `https://www.baerenstark-hausservice.app` aktualisieren.
2. Auch im Repo-File `.env.production` korrigieren — sonst überschreibt der nächste `vercel env push` bzw. Code-Review die Vercel-Variable wieder auf den falschen Wert.
3. Sicherheitsnetz: Vercel-Domain-Settings prüfen, dass Apex (`baerenstark-hausservice.app`) auf `www.`-Subdomain mit 308 (permanent redirect) umgeleitet wird, **bevor** NextAuth-Routen treffen.
4. Acceptance: Nach Korrektur: Inkognito-Test, Vercel-Function-Log darf keinen 4xx auf `/api/auth/customer/callback/google` zeigen.

**Warum kritisch:** Das ist die einzige reale Konfig-Quelle, die wir im Repo haben (Vercel-Env ist nicht inspiziert). Der Build kann nicht starten, ohne dies zu klären — sonst lebt der Bug weiter.

---

### C2 — Service-Slug-Mismatch zwischen Spec und Codebase (S02)
**Story:** IT12-S02
**Routing:** UX-Designer + Architect (beide Slug-Mappings müssen aligned werden)
**Severity:** Critical (Frontend kann Bilder NICHT laden, wenn der Service-Slug nicht stimmt)

**Befund:** Die Codebase definiert in `src/lib/services.ts`:
```ts
SERVICES = ['entruempelung', 'entkernung', 'reinigung', 'gruenflaechenpflege', 'muelltonnenservice', 'entsorgung', 'sonstiges']
```

UX-Spec §3.2.2 nennt aber:
- `entruempelungen` (Plural mit `n` am Ende)
- `entsorgung-schrott-metalle` (mit Detail-Suffix)
- `entkernungsarbeiten` (`-arbeiten`)
- `reinigungsarbeiten` (`-arbeiten`)

Architecture §2 (separater Mapping-Block) wiederum nennt:
- `entruempelung` (richtig, ohne `n`)
- `entsorgung` (richtig)
- `entkernung` (richtig)
- `reinigung` (richtig)

→ **Architecture stimmt mit Code überein, UX-Spec nicht.**

**Empfehlung:**
- UX-Spec §3.2.2 muss korrigiert werden auf die echten Slugs aus `src/lib/services.ts`.
- Gleichzeitig in `src/lib/service-images.ts` den kanonischen Mapping zentralisieren (Architect schlägt das schon in §2 vor — gut).
- Acceptance-Testfall: Cypress-Test, der für JEDEN Slug aus `SERVICES` (außer `'sonstiges'`) prüft, dass das zugeordnete Bild lädt.

---

### C3 — Routen-Mismatch: UX-Spec sagt `/leistungen/[slug]`, Codebase hat `/services/[slug]` (S02)
**Story:** IT12-S02
**Routing:** UX-Designer (UX-Spec korrigieren) ODER Architect (Re-Routing planen)
**Severity:** Critical (Frontend-Engineer würde an einer nicht-existierenden Route arbeiten)

**Befund:** UX-Spec §3.2 nennt mehrfach Route `/leistungen/[slug]`:
> **Route:** `/leistungen/[slug]`

Aber die echte Codebase hat:
- `src/app/services/[slug]/page.tsx` (existiert)
- `src/app/leistungen/...` (existiert NICHT)

Auch Frontend-Reqs (Z. 74): `src/app/services/[slug]/page.tsx`. → UX-Spec ist als einzige falsch.

**Empfehlung:** UX-Spec §3.2 + sämtliche Verweise in der UX-Doku müssen auf `/services/[slug]` korrigiert werden. ODER Architect plant einen Rename + Redirect (`/services/*` → 308 → `/leistungen/*`). Letzteres ist zusätzliche Arbeit, die nicht in IT12-S02 gescoped ist — daher Empfehlung: UX-Spec anpassen.

---

### C4 — Endpoint-Konflikt für Konto-Erstellung nach Buchung (S05)
**Story:** IT12-S05
**Routing:** Architect + UX-Designer (eines der beiden Specs muss angepasst werden)
**Severity:** Critical (Frontend-Build wird gegen einen Endpoint gebaut, den Backend nicht implementiert oder umgekehrt)

**Befund:** UX-Spec §3.5.3 (Flow-Diagramm) und component-library-it12 §3 (Behaviour) nennen:
```
POST /api/auth/customer/register
{ email, firstName, lastName, password, linkBookingId }
```

Backend-Reqs §S05 + ARCHITECTURE §5 + OpenAPI nennen aber:
```
POST /api/customer/register-from-booking
{ bookingId, confirmationToken, password }
```

Zwei unterschiedliche Endpoints, zwei unterschiedliche Request-Bodies, eine Spec ohne `confirmationToken` (UX), eine mit. Das ist nicht versöhnbar ohne Designentscheidung.

**Empfehlung:** Architect-Spec gewinnt (Confirmation-Token-Schutz ist DSGVO-/Security-relevant — sonst kann jemand mit geleakter `bookingId` fremde Konten erstellen). UX-Spec-Komponente muss:
1. Den Token aus dem URL-Param `?token=…` lesen (existiert bereits — siehe `BookingForm.tsx` Z. 283-285 generiert genau diesen Token).
2. Den neuen Endpoint `/api/customer/register-from-booking` aufrufen.
3. Bei `409 ACCOUNT_EXISTS` (nicht `EMAIL_EXISTS`!) den Hinweis-Banner zeigen.

---

### C5 — 409-Subcode-Naming-Konflikt (S05)
**Story:** IT12-S05
**Routing:** Architect (single source of truth festlegen)
**Severity:** Critical (Frontend wird auf `EMAIL_EXISTS` parsen, Backend liefert `ACCOUNT_EXISTS` → kein User-feedback)

**Befund:**
- UX-Spec §3.5.4: `Server 409 EMAIL_EXISTS`
- component-library-it12 §3: `Server 409 EMAIL_EXISTS`
- OpenAPI + Backend-Reqs: `subcode: ACCOUNT_EXISTS`
- Frontend-Reqs §S05 (Z. 207): `subcode: ACCOUNT_EXISTS`

**Empfehlung:** Auf `ACCOUNT_EXISTS` standardisieren (passt besser zur Domäne — der Konflikt ist „Konto-Exists", nicht „Email-Exists" — die E-Mail kann auch z.B. zu einem deaktivierten Konto gehören). UX-Spec §3.5.4 + cl-it12 §3 anpassen.

---

### C6 — Marketing-E-Mail: Endpoint-Pfade weichen UX↔Backend komplett ab (S15)
**Story:** IT12-S15
**Routing:** Architect (Backend-Spec gewinnt) + UX-Designer (Flow-Doku + cl-it12 anpassen)
**Severity:** Critical (Frontend würde Endpoints aufrufen, die nicht existieren — Marketing-Mailer-Feature wäre tot beim Deploy)

**Befund:** Drei Quellen, drei verschiedene API-Verträge:

| Endpoint-Zweck | UX (`marketing-email-flow.md` §7) | Backend-Reqs §15.2 / OpenAPI |
|----------------|----------------------------------|------------------------------|
| Customer-Liste | `GET /api/admin/customers?serviceIds=...` | `GET /api/admin/customers/marketing-list?services=...` |
| Test-Send | `POST /api/admin/marketing/test-send` | **fehlt komplett** (nicht in OpenAPI, nicht in Backend-Reqs) |
| Bulk-Send | `POST /api/admin/marketing/send` | `POST /api/admin/marketing/email` |
| Status | `GET /api/admin/marketing/send/:jobId/status` | `GET /api/admin/marketing/email/:id` |
| Historie | `GET /api/admin/marketing/history?limit=20` | **fehlt komplett** (nur als Should-Have erwähnt) |

Auch Query-Parameter sind unterschiedlich: `serviceIds` (UX) vs `services` (Backend).

**Empfehlung:**
1. Architect entscheidet, ob die Backend-Spec gewinnt (vermutlich ja, weil sie konkreter ist und Audit-/Unsubscribe-Felder enthält).
2. UX-Designer aktualisiert `marketing-email-flow.md` §7 + alle Querverweise in cl-it12 §6.
3. **Test-Send-Endpoint** muss klar entschieden werden: Soll er existieren? Wenn ja, in Backend-Reqs + OpenAPI ergänzen. Wenn nein, in UX-Spec §4.2 + Microcopy entfernen.
4. **Marketing-Historie** als Should-Have explizit committen oder droppen — aktuell ist sie in UX-Spec §8 mit Wireframe versehen, aber Backend-Schema enthält keine Historie-Endpoint-Route. Beim Build steht der Frontend-Engineer ohne Quelle.

---

### C7 — DSGVO-Lücke: Werbe-Einwilligungs-Modell ist nicht im Spec (S15)
**Story:** IT12-S15
**Routing:** Stakeholder (Tom) + Architect + Datenschutz-Verantwortlicher
**Severity:** Critical (Compliance-Risiko: Versand von Marketing-Mails ohne dokumentierte Einwilligung ist UWG/DSGVO-Verstoß)

**Befund:** Backend-Reqs §15.1 modelliert `CustomerMarketingPreference` mit `unsubscribed`-Flag — gut für **Opt-Out**. Aber Marketing in DE-DSGVO ist **Opt-In** (oder „berechtigtes Interesse" nach § 7 UWG mit engen Grenzen):

> § 7 Abs. 3 UWG: Marketing-Mails nur an Bestandskunden zu **ähnlichen** eigenen Produkten erlaubt, mit Werbe-Einwilligung beim Erstkauf, und Hinweis auf Widerspruch in jeder Mail.

Aktueller Plan:
- Kein `marketingConsentGivenAt`/`marketingConsentSource`-Feld in Customer-Schema.
- Buchungsformular erfasst aktuell keine Werbe-Einwilligung.
- Tom kann theoretisch alle 134 Customer aus der DB heraus per Marketing-Mail anschreiben — auch wenn diese nie eingewilligt haben.

**Empfehlung:**
1. **Sofort entscheiden**: Will der Stakeholder echte Marketing-Mails schicken (mit Risiko Abmahnung), oder beschränkt er S15 auf **transaktionale Service-Reminder** (z. B. „Ihre nächste Mülltonnen-Reinigung ist fällig" — das ist nach UWG kein „Marketing")?
2. Falls Marketing: Modell erweitern um:
   - `customer_marketing_preferences.consentGivenAt` (Timestamp)
   - `customer_marketing_preferences.consentSource` (Enum: `BOOKING_FORM`, `IMPORT`, `MANUAL_ADMIN`)
   - `customer_marketing_preferences.consentText` (Snapshot des Einwilligungstexts zum Zeitpunkt der Einwilligung)
3. Beim Senden: Backend filtert nicht nur nach `unsubscribed = false`, sondern AUCH nach `consentGivenAt != null`.
4. Jede Mail enthält: Impressum-Link, Unsubscribe-Link (geplant ✓), Hinweis auf den Erfassungs-Kontext („Sie erhalten diese Mail, weil Sie am {date} Service X gebucht haben.").
5. Booking-Form erweitern: Checkbox „Ich willige ein, gelegentlich Informationen zu ähnlichen Services per E-Mail zu erhalten." (default UNCHECKED — DSGVO).

**Warum kritisch:** Ohne ein dokumentiertes Einwilligungsmodell ist der Marketing-Mailer eine Abmahn-Rakete. Tom muss das verstehen, bevor wir das Feature ausliefern. Dies ist KEIN Engineering-Issue, sondern ein PM-/Stakeholder-Gespräch.

---

### C8 — Test-Send-Endpoint nicht in Backend-Vertrag definiert (S15)
**Story:** IT12-S15
**Routing:** Architect (Endpoint hinzufügen oder Feature droppen)
**Severity:** Critical (UX-Wizard-Step 2 hat einen „📤 Test an mich senden"-Button, der ins Leere läuft)

**Befund:** UX-Spec §4.2 dokumentiert detailliert:
> Button „📤 Test an mich senden" (Sekundär). Versendet die zusammengesetzte Mail an Tom's Admin-Email-Adresse.

`marketing-email-flow.md` §7 Backend-Vertrag listet `POST /api/admin/marketing/test-send`. Aber:
- Backend-Reqs §15.2 hat keinen Test-Send-Endpoint.
- OpenAPI hat keinen Test-Send-Endpoint.
- ARCHITECTURE_IT12.md §14.2 hat keinen Test-Send-Endpoint.

**Empfehlung:** Architect entscheidet:
- **Variante A** (empfohlen): Test-Send als eigener Endpoint hinzufügen. Macht Sinn, weil der Test einen kompletten Render-Cycle triggern soll, ohne Audit-Records / `MarketingEmail`-Rows anzulegen. Pfad-Vorschlag: `POST /api/admin/marketing/email/test`.
- **Variante B**: Test-Send als Special-Mode im Bulk-Send-Endpoint (`recipientIds=[<admin-self-id>]` + Flag `isTest=true`). Backend skippt Audit, schickt 1 Mail.
- **Variante C**: Feature droppen aus IT12.

**Gleichzeitig:** Frage 4.2: An welche Mail wird Test-Send geschickt? Die Admin-User-Mail (aus Session) oder eine konfigurierbare Adresse? Tom hat in seiner Session evtl. eine andere Adresse als die echte Inbox, die er prüfen möchte. UX-Spec §10 hat das schon als Open Question — bitte klären.

---

## 3. Major Concerns (Should-fix; sonst Risiko Loop in Verify)

### M1 — Kein konkretes p95-Performance-Ziel für Kalender-Endpoint (S03)
**Routing:** Architect

Story-AC sagt „< 1.5 Sekunden vollständig sichtbar". Aber Frontend-Time = API-Time + Render-Time + Network-Latenz. Backend-Reqs §S03 sagt „< 300ms p95" — gut, aber nirgendwo verbindlich verlinkt zur Story-AC. Die Story zwingt den Build nicht, einen Performance-Test zu schreiben.

**Empfehlung:** Backend-Reqs ergänzen mit:
- API-Endpoint p95 < 300ms (mit definiertem Test-Setup: 60-Tage-Range, 100 Bookings, kalter Cache).
- Frontend-Render p95 < 200ms (Skeleton → echte Grid-Replacement).
- Zusammen sollte „Step-Wechsel → echtes Grid" < 1.5s p95 sein.
- Diese Werte als CI-Gate in einer Lighthouse-Run oder dedizierten Perf-Test verankern.

**Performance-Math (Sanity-Check):** 62 Tage Range. Pro Tag mind. 1 Status-Lookup (Booking-Existenz) + 1 Slot-Berechnung. Naiv: 62×2 = 124 Queries. Mit der vom Architect vorgeschlagenen Konsolidierung (1 Query für Bookings + 1 für Overrides + 1 für Templates = 3 Queries) und Index `bookings(date, status)` — realistisch < 50ms im warm-cache, < 200ms im cold. Ziel ist erreichbar. Aber: Wenn Architect es nicht so umsetzt, kommt's in der Verify-Phase wieder.

### M2 — Indexe auf prod nicht verifiziert (S03)
Backend-Reqs §S03 sagt „Indexe sind bereits vorhanden ✔" — das ist nicht durch einen `\d` gegen die Production-DB belegt. Falls die IT11-Migration nicht durchgelaufen ist (S06-Hypothese), ist das Schema in Prod inkonsistent. Empfehlung: Beim Schritt 0 (`prisma migrate status`) zusätzlich `psql ... -c '\d bookings'` ausführen und in Build-Notes dokumentieren.

### M3 — `confirmationToken` ist in Story-AC nicht erwähnt (S05)
Story-Text §S05 listet die ACs ohne den Token zu erwähnen. Die UX-Spec verschweigt ihn ebenfalls. Nur Architecture + Backend-Reqs + OpenAPI erwähnen ihn. Das kann zu Loop führen, wenn der Frontend-Engineer den UX-Flow strikt nach UX-Spec implementiert. Empfehlung: Story-Hinweis ergänzen, dass Token aus URL-Param mitgesendet werden muss; Frontend-Reqs §S05 macht das schon richtig.

### M4 — Konkurrierende Sync-Pattern für Auth-State (S07)
UX-Spec §1.3 verlangt: nach Auth-State-Änderungen `useSession().update()` UND `router.refresh()`. Aber die Codebase nutzt KEIN NextAuth für Customer (siehe `src/lib/customer-session.ts`, eigener JWT-Cookie!). Es gibt KEIN `useSession()` im Customer-Context. Architecture §0.4 + Frontend-Reqs §S07 schlagen einen eigenen EventBus `customer-sync.ts` vor — das ist die richtige Lösung. UX-Spec §1.3 + §3.7.2 sind aber **falsch** für die Customer-Pages und verwirrend.

**Empfehlung:** UX-Spec §1.3, §3.7.2 anpassen:
- Im Admin-Bereich (NextAuth) — `useSession().update()` + `router.refresh()`.
- Im Customer-Bereich (custom JWT-Cookie) — `emitCustomerChanged()` aus `customer-sync.ts` + `router.refresh()`.

Sonst implementiert ein verwirrter Frontend-Engineer NextAuth-Patterns gegen Custom-Cookie-Auth → Bugs.

### M5 — Profil-Feld-Naming inkonsistent: `street` vs. `streetAndNumber` (S08)
- UX-Spec §3.8.2 nennt `street`.
- Backend-Reqs §S08 + Architecture §S05 nennen `streetAndNumber`.
- Existierende `CustomerUser`-DTO muss geprüft werden — der Architect schreibt nur „prüfen, dass die Felder enthalten sind".

**Empfehlung:** Vor Build den existierenden DTO + DB-Schema bestätigen; UX-Spec auf den realen Feldnamen aktualisieren. Außerdem: Wenn das Profil leer ist (kein Telefon, keine Adresse) — UX-Spec §3.8.4 hat `partial-prefill` und `empty-no-notice` — das ist gut, aber explizit klarstellen: Pflichtfelder im Buchungsformular bleiben Pflicht (auch wenn Profil leer ist).

### M6 — Root-Cause für S09 Scroll-Jump nicht bestätigt (S09)
Architecture §0.2 + §9 sagt selbst: „Repro nicht eindeutig", „Frontend-Engineer testet". Das bedeutet: Story-AC ist nicht testbar bis der Bug reproduziert ist. Das ist ein typisches „Bug-Ticket ohne Repro" — könnte durchschlagen oder im Fix-Ping-Pong landen.

**Empfehlung:** Vor Build-Start Frontend-Engineer 1 Stunde Zeit geben, um den Scroll-Jump in Production reproduzierbar zu machen (DevTools Performance-Recording, exakter Scroll-Source identifizieren). Erst dann Story splitten in Sub-Tasks ODER aus IT12 droppen falls nicht reprozierbar.

### M7 — Status-Code-Mismatch UX vs Backend (S10)
- UX-Spec §3.10.1 mappt: `5xx INTERNAL_ERROR`.
- Frontend-Reqs §S10 sagt: „bei `BLOB_NOT_CONFIGURED` (503)" und „Bei `INTERNAL_ERROR` (502)".
- Architecture §10 sagt: 503 ist `BLOB_NOT_CONFIGURED`, 500 ist `INTERNAL_ERROR`.

Inkonsistenz zwischen Frontend-Reqs (502) und Architecture (500). Frontend-Engineer wird auf `502` parsen, Backend liefert `500`. **Empfehlung:** Standardisieren auf `500 INTERNAL_ERROR`, Frontend-Reqs korrigieren.

### M8 — Idempotency-Key fehlt für Booking-Submit (S11)
Story-AC `S11` sagt nicht explizit was passiert, wenn Network-Error mid-flight: Request kommt am Server an, Response geht verloren, Client retried → Doppel-Buchung in der DB.

Backend hat aktuell keine Idempotency-Key-Logik (nicht in OpenAPI, nicht in Reqs). Architecture §11 erwähnt Idempotency nicht.

**Empfehlung:**
1. POST `/api/bookings` mit `Idempotency-Key`-Header (UUID, Frontend generiert pro Submit).
2. Backend speichert für 24h: Wenn gleicher Key + gleicher Customer + gleiche Booking-Hash → return cached Response (kein neuer Insert).
3. Frontend retried bei Network-Error mit demselben Key.
4. Tom als Admin sieht nur 1 Booking — keine Duplikate.

Alternativ: Acceptance-AC ergänzen: „Bei Doppel-Submit innerhalb von 5 Sekunden: Backend erkennt Duplikat anhand `(customerEmail, date, startTime, service)` und gibt 200 mit existierender Booking zurück." (schwächer aber implementierbar).

### M9 — „Bewertungen"-Duplikat-Quelle nicht im Code identifiziert (S14)
Admin-IA §3 listet das Duplikat „Bewertungen (Eintrag 2 — Duplikat) | (unklar, evtl. /admin/calendar/reviews?)" als unklar. Architecture §0.5 ist konkreter: AdminDashboard rendert in zwei Layern (QuickLinks oben + Tabs in der Mitte). Aber die echte Code-Inspektion zeigt: AdminDashboard.tsx und seine Sub-Components müssten gegrep-t werden.

**Empfehlung:** Vor Build kurze Code-Recherche (10 Minuten): wo wird „Bewertungen" als Sidebar-Link/Tab gerendert? Welche Komponente? Welche Routes? Architect dokumentiert in 1 Bullet, dann Frontend-Engineer kann sicher loslegen. Verify-AC sollte sein: `cy.contains('Bewertungen').should('have.length', 1)` auf JEDEM Admin-Page-State (Dashboard, Bookings-Tab, Slots-Tab, Availability-Tab).

### M10 — Backwards-Compat-Routen für Admin-IA-Refactor (S14)
Admin-IA §3 sagt „Keine Route wird umbenannt" — gut. Aber: Werden Bookmarks weiterhin funktionieren? Tom hat ggf. `https://...app/admin/bewertungen` als Bookmark. Wenn das alte Duplikat tatsächlich auf `/admin/calendar/reviews` lag, brauchen wir einen 308-Redirect.

**Empfehlung:** In `next.config.js` einen Redirect-Block hinzufügen für die alten Pfade. Beispiel:
```js
async redirects() {
  return [
    { source: '/admin/calendar/reviews', destination: '/admin/reviews', permanent: true },
    // ggf. weitere
  ];
}
```

### M11 — Rate-Limit für Marketing-Send vs. Audit-Compliance (S15)
Backend-Reqs §15.2: „Rate-Limit: 5/h pro Admin." Aber: Was wenn Tom 200 Customer hat, in zwei Tranchen senden will (er entdeckt später noch 50 weitere Customer für dieselbe Kampagne)? 5/h zwingt ihn auf 5 Versand-Aktionen, also 1000 Mails/h max. Sounds reasonable, aber:
- Resend-Free-Tier: 100/Tag. Tom kommt nach 1 großer Kampagne ans Limit.
- Architecture §0.6 erwähnt das, ARCHITECTURE_IT12 §16 hat es als Open Question.

**Empfehlung:** Stakeholder-Entscheidung jetzt einholen: Resend-Pro-Plan oder nicht? Wenn nicht, harte Begrenzung im Frontend einbauen + sichtbares Quota-Display („Heute: 23 von 100 Mails versendet").

### M12 — Async-Send-Failure-Recovery (S15)
Architecture §14.2: Concurrency 5, sequenzielle Batches mit 200ms zwischen Batches. Vercel-Hobby-Function-Timeout: 10s. Vercel-Pro: 60s. 50 Empfänger × 200ms = 10s — exakt am Hobby-Limit.

ARCHITECTURE §16 hat das als Open-Question. Aber: was passiert real, wenn die Vercel-Function nach 10s killed wird?
- 25 Mails wurden versandt, 25 stehen noch in `MarketingEmailRecipient` als PENDING.
- `MarketingEmail.completedAt` bleibt null.
- Tom sieht im Frontend nur „processing", nichts mehr.
- Resume? Re-Run der Function? Manueller Eingriff?

**Empfehlung:**
1. Stakeholder klärt Vercel-Plan-Tier.
2. Wenn Hobby: Hard-Limit auf 30 Empfänger pro Send (UX-Validation), sonst Multi-Trigger-Pattern (Frontend ruft mehrfach für 30er-Batches).
3. Backend stellt sicher, dass `MarketingEmailRecipient` mit `status=PENDING` ein Resume-fähiger State ist: Beim erneuten POST mit gleicher `marketingEmailId` werden nur PENDING-Recipients gepickt.

---

## 4. Minor Suggestions

### Mn1 — Umlaute in Bilddateinamen (S02)
`grünflächenpflege.png`, `mülltonnenservice.png` — Architecture §2 sagt es funktioniert mit `next/image`. **Empfehlung:** Vor Build kurzer Smoke-Test: Bilder lokal in `public/` zu Pfaden mit Umlauten platzieren, `npm run dev`, Vercel-CDN-Cache aufmerksam prüfen. Falls Probleme: Umbenennen auf `gruenflaechenpflege.png`/`muelltonnenservice.png` (kein User-facing Breaking).

### Mn2 — Frontend Cypress-Test für jeden Slug (S02)
Frontend-Reqs §S02 erwähnt Cypress-Coverage; cl-it12 §1 nicht. UX-Spec §3.2.8 hat keine konkrete Test-Anweisung. **Empfehlung:** UX-Spec § Acceptance ergänzen: für jeden Service in `SERVICES` muss `<img>` mit dem zugeordneten Pfad sichtbar sein.

### Mn3 — Skeleton-Min-Anzeigedauer ist arbiträr (S03)
UX-Spec §3.3.1 sagt 200ms; cl-it12 §2.1 ebenfalls. Bei sehr schnellem Cache-Hit (50ms) wirkt der Skeleton wie ein Blink. **Empfehlung:** 250ms (UX-Spec §1.2 nutzt das schon für Submit-Buttons — Konsistenz).

### Mn4 — Mobile-Bottom-Sheet-Variante S05 ungenau (S05)
UX-Spec §3.5.1 sagt: „Mobile: Eingebettete Card. Falls Nutzer auf 'Konto erstellen' klickt → öffnet sich Bottom-Sheet". Das ist ein Verhaltens-Switch zwischen embedded und modal — ist das wirklich nötig oder reicht die embedded-Card auf Mobile? cl-it12 §3 hat 3 Variants `inline-card`, `mobile-bottom-sheet`, `desktop-inline-expanded`. Das ist viel UI für 2 KB Code-Aufwand.

**Empfehlung:** Auf Mobile auch nur embedded-Card, kein Bottom-Sheet. Spart Code, weniger Test-Aufwand, gleicher User-Goal erreicht.

### Mn5 — sessionStorage-Flag-Naming-Konflikt (S05)
UX-Spec §3.5.6: `'booking-account-offer-dismissed'`.
Frontend-Reqs §S05: `'accountPromptDismissed:'+bookingId` (per-Booking).

**Empfehlung:** Per-Booking ist robuster (User stornt, bucht neu, will diesmal Konto). Auf Frontend-Reqs-Variante standardisieren.

### Mn6 — Dropdown-Menü „Mein Konto" / „Profil" (S07)
cl-it12 §4: Dropdown-Items „Mein Konto" → `/konto`, „Profil" → `/konto/profil`. Aber `/konto` IST das Dashboard mit den Buchungen, das ist semantisch identisch zu „Mein Konto". Dann nochmal „Profil" — etwas redundant. **Empfehlung:** Dropdown vereinfachen zu „Mein Konto" → `/konto`, „Profil bearbeiten" → `/konto/profil`, „Abmelden". (Naming-Frage; UX entscheidet.)

### Mn7 — Char-Counter-Feld inkonsistent (S15)
UX-Spec §3.15 Marketing-Body: Backend-Spec sagt `1..10000`, UX-Spec sagt `1..5000`. cl-it12 §6.3 nennt 5000. Backend-Reqs §15.2 nennt 10000.

**Empfehlung:** Auf 5000 standardisieren (UX und cl-it12 stimmen überein, Backend-Reqs anpassen). 5000 = ca. 1.5 A4-Seiten Text → reicht für Marketing-Mail.

### Mn8 — Welcome-Hint-Banner: localStorage vs DB (S14)
Admin-IA §6.1 lässt offen ob localStorage oder DB-Feld. Empfehlung: localStorage — einfacher, akzeptabel für 1-Admin-Setup.

### Mn9 — Footer-Unsubscribe-Microcopy nicht im UX-Spec festgelegt (S15)
Architecture §14.4 hat den Footer-Text. UX-Spec §1 hat ihn nicht als „verbindliche Microcopy". **Empfehlung:** UX-Microcopy §4 ergänzen.

---

## 5. Open Questions for Stakeholder

1. **DSGVO/Werbe-Einwilligung (S15):** Will Tom rechtssicher Werbe-Mails versenden? Oder soll S15 auf transaktionale Mails (z. B. Service-Reminder) beschränkt werden? Fix für C7 hängt davon ab.
2. **Resend-Tier (S15):** Free (100/d) oder Pro (höher)? Ohne diese Entscheidung wird der Send-Code 2x neu geschrieben.
3. **Vercel-Plan (S15):** Hobby (10s Function-Timeout) oder Pro (60s)? Beeinflusst Async-Send-Strategie maßgeblich (M12).
4. **Marketing-Historie (S15 Should-Have):** In IT12 implementieren oder droppen?
5. **Pause-Funktion Marketing-Send (S15):** Implementieren oder droppen?
6. **Test-Send-Endpoint Empfänger (S15):** An Tom's Admin-Mail aus Session oder konfigurierbare Adresse?
7. **`/admin/calendar/reviews`-Pfad existiert?** Vor S14-Build muss klar sein, was die Quelle des Bewertungs-Duplikats ist (M9).

---

## 6. Test-Strategy Notes (für Phase 4 Verify)

### E2E-Tests (Cypress) — zwingend erforderlich
- **S01** OAuth: echter Inkognito-Run gegen Production nach Env-Korrektur (kein Cypress-Mock).
- **S03** Kalender: Step öffnen, < 1500ms Skeleton-zu-Grid messen, klickbarer Tag → Slot-Liste erscheint.
- **S05** Konto-aus-Buchung: Gast bucht → Erfolgsseite → Konto erstellen → Auto-Login → /konto zeigt Buchung. Plus 409-Pfad bei existierender E-Mail.
- **S07** Login-State: Profil-Save → Header zeigt weiter „Mein Konto", nicht „Anmelden".
- **S11** Submission: Form abschicken → Loader weg → Erfolgs-Banner → /konto zeigt neue Anfrage.
- **S14** Admin-Nav: `cy.contains('Bewertungen').should('have.length', 1)` auf jeder Admin-Page.
- **S15** Marketing-Mailer: Filter setzen → Customer auswählen → Wizard-Steps durchgehen → Confirm bei > 50 → Send → Report.

### Integration-Tests (API) — für Backend-Logik
- **S03** `/api/availability/calendar`: 60-Tage-Range mit 100 Bookings → < 300ms p95, korrekte Aggregation pro Tag.
- **S05** `/api/customer/register-from-booking`: Token-Mismatch (401), Konto-Exists (409), Happy Path (201 + linkedBookingsCount), mehrere Bookings mit gleicher E-Mail werden alle verknüpft.
- **S15** `/api/admin/marketing/email`: Unsubscribe-Filter, Concurrency-5-Versand, Failure-Counter korrekt, Audit-Records persistent.
- **S15** `/api/marketing/unsubscribe`: gültiges Token → 302 + DB-Update, ungültig → 404.

### Unit-Tests
- **S04/S09** `scrollIntoViewIfNeeded` Helper: in-viewport → no-op, out-of-viewport → scroll.
- **S07** `customer-sync.ts` EventBus: emit/subscribe/unsubscribe.
- **S15** `marketing-tokens.ts` Token-Generation: deterministische Hash, Token-Verify-Function.

### Manuelle Smoke-Tests (Stakeholder durch Tom)
- **S01** Google-Login durchspielen.
- **S02** alle 6 Service-Detailseiten besuchen.
- **S10** Bild hochladen, > 10MB-File hochladen (Error-Mapping prüfen).
- **S15** echte Marketing-Mail an 3 Test-Customer schicken, Inhalt verifizieren, Unsubscribe-Link klicken.

### Hochrisiko-Stories (Regressions-Gefahr)
- **S07** kann den gesamten Header brechen → ALLE Customer-Pages müssen smoke-getestet werden.
- **S08** Render-Gate könnte in Edge-Cases (Customer-API hängt, Status bleibt `loading`) das Buchungsformular permanent skeleton zeigen → Timeout-Logik einbauen.
- **S14** Admin-Nav-Refactor → Risiko, dass eine Sub-Page nach Layout-Wrap nicht mehr rendert oder eine bestehende Bookmark bricht.
- **S15** ist die größte Story (8 SP), berührt: DB-Schema, 4 Endpoints, Resend-Integration, DSGVO-Compliance, Async-Send. Hohes Bug-Potenzial.

### Niedriges Risiko (Quick-Wins)
- **S02, S04, S09** sind isoliert und können vom Frontend-Engineer parallel an Tag 1 abgehakt werden.
- **S06, S12, S13** sind alle „nur Migration deployen" — wenn die Migration läuft, sind die drei automatisch grün.

---

## 7. Empfehlungen für Build-Phase

### Vor Build-Start (Architect / UX / PM)
1. **C1 fixen** — Vercel-Env korrigieren, NEXTAUTH_URL auf `https://www.baerenstark-hausservice.app`, Repo-`.env.production` synchronisieren. **Heute, vor allem anderen.**
2. **C7 Stakeholder-Gespräch** — Tom muss die DSGVO-Implikation verstehen, bevor wir S15 starten. Ohne diese Klärung würde S15 in eine rechtliche Falle laufen.
3. **C2/C3/C4/C5/C6/C8 Spec-Updates** — UX-Designer und Architect klären die Endpoint-/Slug-/Path-/Status-Code-Konflikte. Empfehlung: Architect schreibt das verbindlich, UX-Spec wird angepasst.

### Build-Reihenfolge (überarbeitet, gegenüber Architecture §15)
0. **Tag 0 (heute):** Vercel-Env-Fix (C1), Spec-Anpassungen (C2-C8), Stakeholder-Klärungen (C7 + Open Questions 1-3).
1. **Tag 1 Backend:** `prisma migrate deploy` Verifikation (S06/S11/S12/S13). Vercel-Blob-Token (S10).
2. **Tag 1 Frontend (parallel zu Backend):** S02 Service-Bilder, S04 Scroll-Helper, S09 useEffect-Dedup. Diese Stories haben null Backend-Abhängigkeit.
3. **Tag 2 Backend:** S03 Kalender-Optimierung, S05-Endpoint, S07 PATCH-Verify, S08 me-Endpoint-DTO-Verify, S15-Migration + Endpoints (Phase 1: list-Endpoint).
4. **Tag 2 Frontend:** S07 customer-sync.ts, S08 Render-Gate, S11 defensives Finally + Idempotency-Key (M8).
5. **Tag 3 Backend:** S15 Bulk-Send + Test-Send + Status-Polling.
6. **Tag 3 Frontend:** S05 CreateAccountOfferSheet, S14 AdminLayout-Refactor.
7. **Tag 4 Frontend:** S15 Composer-Wizard, RecipientPicker, ComposeForm, Preview, Progress, Report.
8. **Tag 5 Verify:** End-to-End-Tests, Smoke-Tests durch Tom, QA-Pass-2.

### Parallel-Strategie
- **Backend und Frontend KÖNNEN parallel** ab Tag 1 starten — vorausgesetzt:
  - Spec-Konflikte (C2-C8) sind aufgelöst.
  - Endpoints-Verträge (insbesondere S05, S15) sind in OpenAPI eingefroren, **bevor** beide Seiten anfangen zu coden.
  - Frontend nutzt für nicht-fertige Endpoints einen MSW-Mock.
- **Anti-parallel:** S07 sollte sequenziell laufen — Backend-Verify zuerst, dann Frontend customer-sync.ts. Sonst hängt Frontend an einer Hypothese.

---

*Ende des QA Design Reviews IT12.*
