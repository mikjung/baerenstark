# QA Design Review — Iteration 6

Datum: 2026-05-03
Reviewer: qa-engineer
Scope: Pressure-Test des IT6-Designs (PROJECT.md §„Iteration 6", `project/user-stories/iteration-6.md`, `ARCHITECTURE_IT6.md`, `contracts/schema.prisma`, `contracts/api-routes.md` §22, `contracts/zod-schemas.ts`).
Methode: Dokument-Lesen + Cross-Check Story↔Architektur↔Contracts. Kein Code-Run.

---

## Verdict

**Needs revision** — drei Major Findings, fünf Minor Findings.

Begründung: Drei Spezifikationslücken sind echte Pre-Build-Blocker, weil sie sich nach Implementierung nur mit großem Aufwand (DB-Backfill, Auth-Reset, oder Skript-Re-Run) korrigieren lassen. Die übrigen Findings sind nicht-blockierend, sollten aber vor Build adressiert werden, damit QA in der Build-Phase keine Zeit auf Auslegungsfragen verliert.

Zähler:
- Major Findings: 3
- Minor Findings: 5
- Pflicht-Checkliste-Punkte: 11 (A–K) — alle explizit beantwortet, siehe §„Pflicht-Checkliste".

---

## Major Findings

### F1 — Bootstrap-Race „leerer User-Tabelle = jeder darf erster Admin werden" ist ungemindert

**Story:** US-IT6-06 + US-IT6-01
**Quellen:** `ARCHITECTURE_IT6.md` §8.4 („Tom ruft `/admin/setup` auf — die Setup-Page (Bestand IT1) prüft, ob die `User`-Tabelle leer ist, und legt den ersten Admin an."); §13.1 Phase 2 (`T-08 Tom führt Wipe in Staging aus, Engineer im Pair`); `contracts/api-routes.md` §22.6 PUBLIC_ADMIN_PATHS.

**Problem:** Nach dem Wipe (US-IT6-06) ist `User` leer. Die Setup-Page `/admin/setup` ist dann **bedingungslos** öffentlich (in `PUBLIC_ADMIN_PATHS`). Zwischen dem Wipe-Run und Toms Setup-Submit kann **jede beliebige Person**, die die URL kennt oder errät, sich als erster Admin registrieren — Lock-out für Tom und volle Kontrolle für den Angreifer.

Das ist kein theoretisches Risiko: Tom soll laut Plan den Wipe in Staging ausführen, danach Prod (Empfehlung im Doc). Während des Maintenance-Fensters (mehrere Minuten) ist die Setup-Page öffentlich erreichbar.

**Vom Design nicht abgedeckt:**
- Kein `BOOTSTRAP_ADMIN_EMAIL`-ENV-Allowlist (z.B. „nur diese Email darf via Setup-Wizard durch"). Tom hat eine deklarierte Email (`hausservice-baerenstark@outlook.com`).
- Kein Bootstrap-Token (z.B. zufälliger 32-Byte-Wert in ENV, der einmalig im Setup-Form geprüft wird).
- Kein „Maintenance-Mode" der Setup-Page sperrt, bis ein operatives Signal kommt.
- Kein zeitlich limitiertes Bootstrap-Fenster (z.B. gilt nur für 60 Minuten nach dem Wipe-Skript-Run).

**Severity:** Major (Authorization-Bypass / Account-Takeover).

**Empfohlener Fix vor Build (eine der drei Optionen):**
1. **ENV-Allowlist (einfachste Variante):** `BOOTSTRAP_ADMIN_EMAIL=tom@…` setzen. `POST /api/admin/setup` lehnt jede andere Email-Eingabe mit 403 `BOOTSTRAP_NOT_ALLOWED` ab. Vorgabe: Architekt nimmt diesen Mechanismus in §8.3 oder §15 verbindlich auf.
2. **Bootstrap-Token:** Zufalls-Token in `BOOTSTRAP_TOKEN`-ENV; das Form verlangt diesen als zusätzliches Feld. Tom liest den Token aus dem Server-Log/ENV.
3. **Atomares Kombi-Skript:** Wipe-Skript erstellt im selben `prisma.$transaction` direkt einen Initial-Admin (Args: `--initial-admin-email`, `--initial-admin-password`). Setup-Page bleibt nach dem Wipe niemals offen.

**Routing-Hint:** `solution-architect`.

---

### F2 — Letzter-Admin-Schutz nicht atomar / Race-Condition beim parallelen Disable

**Story:** US-IT6-01
**Quellen:** `ARCHITECTURE_IT6.md` §3.1 („Server prüft `count({ status: 'ACTIVE' }) > 1` vor jedem Disable/Delete."); `contracts/api-routes.md` §22.1 Lock-out-Schutz; §14.2 erwähnt Race-Test als Pressure-Test, dokumentiert aber **keine** atomare Lösung.

**Problem:** Das Design schreibt die Logik vor als
```
1. count({ status: 'ACTIVE' }) === 1 → ablehnen
2. sonst: update target → DISABLED
```
Bei zwei parallelen Requests (z.B. Tom in Tab A demoted Lisa, Lisa in Tab B demoted Tom — beide mit gültiger Session und beide noch `ACTIVE`) **lesen beide Schritt 1 mit `count = 2`**, beide bestehen den Check, beide gehen zu Schritt 2 — Ergebnis: beide DISABLED, kein aktiver Admin mehr → Lock-out genau das Szenario, das der Schutz verhindern soll.

Das Design erwähnt **keine** atomare Transaktion (`prisma.$transaction` mit `SELECT … FOR UPDATE`-Semantik / SQLite `BEGIN IMMEDIATE`) noch eine `WHERE`-Bedingung im UPDATE, die den Check zur Update-Bedingung macht. §14.2 sagt nur „QA muss durchspielen", lässt aber offen, was die richtige Implementierung ist.

§14.2: „zwei parallele Browser-Tabs deaktivieren denselben (vorletzten) Admin → einer von beiden 409 / 422" — aber das Doc liefert das **Wie** nicht.

**Severity:** Major (Lock-out kann Tom als einzigen verbleibenden Admin treffen).

**Empfohlener Fix vor Build:**
- Architektur muss explizit eine der folgenden Lösungen vorschreiben:
  a) **Conditional UPDATE**: `UPDATE users SET status='DISABLED' WHERE id=:id AND status='ACTIVE' AND (SELECT COUNT(*) FROM users WHERE status='ACTIVE') > 1` — Backend-prüft `affectedRows`, bei 0 → 409 `LAST_ADMIN_LOCK`.
  b) **`prisma.$transaction` mit Isolation `Serializable`** (für libSQL/Turso explizit prüfen, ob das supported wird).
  c) **App-Lock** (Mutex auf `users`-Tabelle für Disable/Delete) — pragmatisch akzeptabel im Single-Server-Setup.
- §14.2 muss in „Smoke-Test" hochgestuft werden, nicht „Pressure-Test", weil Lock-out katastrophal ist.

**Routing-Hint:** `solution-architect`.

---

### F3 — DTO-Leak-Risiko `adminNote`/`adminRating`: Backend-Convention ist nicht maschinell durchsetzbar

**Story:** US-IT6-07
**Quellen:** `ARCHITECTURE_IT6.md` §9.2 + §9.5; `contracts/api-routes.md` §22.4; `contracts/zod-schemas.ts` §1720–1755; Risiko R1.

**Problem:** Das Design verlässt sich auf eine **Engineering-Convention**: „in `lib/customer-portal.ts` und allen Customer-Endpoints wird `prisma.customerUser.findUnique({ select: { …Public-Felder } })` **explizit** verwendet — niemals `findUnique()` ohne `select`."

Das Risiko (R1, im Doc selbst flagged) ist groß und das Design liefert keine **strukturelle** Absicherung dagegen:
- Es gibt kein Lint-Rule-Vorschlag (z.B. ESLint-Regel: `customerUser.findUnique` ohne `select` verboten).
- Es gibt kein Runtime-Guard (z.B. Response-Layer, der gegen `CustomerUserPublicSchema` strict-parst und 500 wirft).
- Es gibt kein DB-View-Trick (z.B. eine `customer_users_public`-View, die die Felder nicht enthält).
- Die Risk-Mitigation (R1) sagt: „QA muss jeden Customer-Endpoint per JSON-Schema-Linter validieren." — Das ist **reaktiv**, nicht **präventiv**, und greift nur, wenn QA jeden zukünftigen Endpoint testet.

`CustomerUserAdminSchema` extends nicht von `CustomerUserPublicSchema` (siehe `zod-schemas.ts` §1735) — sie sind voneinander unabhängige Schemas. Das ist sauber, aber Engineers können trotzdem `prisma.customerUser.findFirst({ where: ... })` ohne `select` aufrufen und das Ergebnis durch `CustomerUserPublicSchema.parse()` jagen — Zod **ignoriert** Extra-Felder per Default (kein `.strict()`).

**Severity:** Major (PII-Leak — Tom legt eventuell schreibt „Zahlt nie pünktlich, vermeiden" in `adminNote` und exposed das an den betroffenen Kunden).

**Empfohlener Fix vor Build:**
- Architektur ergänzt §9.2: alle Customer-facing Output-DTOs werden mit `.strict()` erzwungen UND der Layer macht nicht `parse()` auf dem rohen Prisma-Result, sondern auf einem expliziten Mapping. Beispiel-Code im Doc verbindlich.
- Alternativ (besser): `CustomerUserPublicSchema` wird ein `as const`-Field-Array exportiert, und es gibt eine Helper-Function `selectCustomerUserPublic()` die das Prisma-`select`-Object zurückgibt — Engineering nutzt **diese** Funktion, nicht `select` per Hand.
- QA-Sicherheits-Tests in §9.5 werden zur Pflicht für CI (nicht „QA muss sie laufen lassen", sondern „CI failed, wenn nicht").
- Snapshot-Test: für jeden Customer-Endpoint wird der Response-Body gegen `CustomerUserPublicSchema.strict().parse()` validiert und mit allen IT6-Feldern (`adminNote=…`, `adminRating=5`) im Test-Setup geseedet. Wenn der Endpoint die Felder leakt, schlägt der Test fehl.

**Routing-Hint:** `solution-architect` (Konvention härten) + `backend-engineer` (Implementierung sicherstellen).

---

## Minor Findings

### m1 — Public-Reviews: Legacy-Schema enthält `customerId`, neuer öffentlicher Path filtert es nicht explizit

**Story:** US-IT6-03
**Quellen:** `contracts/zod-schemas.ts` §1335 (`ReviewSchema` mit `customerId`), §1353 (`PublicReviewSchema`, ohne `customerId`); `contracts/api-routes.md` §22.3 GET /api/reviews.

**Problem:** `PublicReviewSchema` (§1353) ist sauber definiert ohne `customerId`. Aber: das Design **schreibt nicht verbindlich vor**, welches Schema `GET /api/reviews` rendert. In der heutigen IT4/IT5-Implementierung (vermutlich) gibt es nur `ReviewSchema` als gemeinsamer Output. Wenn Engineering versehentlich `ReviewSchema` (admin-fähig, mit `customerId`) auf der öffentlichen Route serialisiert, leakt es die opaque CUID des Kunden.

Architektur §5 erwähnt nur den Filter (`approved=true AND rejectedAt IS NULL`), aber nicht das **Output-Schema**.

**Empfohlener Fix:** §5.3 explizit ergänzen: „GET /api/reviews antwortet gegen `PublicReviewSchema` (kein `customerId`, kein `bookingId`)." + Snapshot-Test in §14.1.

**Severity:** Minor (CUID ist nicht direkt PII, aber Aggregation auf Anfrage-Niveau möglich).

**Routing-Hint:** `solution-architect`.

---

### m2 — `adminRating`-Sortierung kann Reihenfolge-Side-Channel öffnen

**Story:** US-IT6-07
**Quellen:** `contracts/api-routes.md` §22.4 (Sort-Param `adminRating_desc`); `contracts/zod-schemas.ts` §1801.

**Problem:** Sort-Option `adminRating_desc` ist Admin-only und API-side gating ist da. Aber: bei einem Bug, in dem `requireAdmin()` aussetzt, würde der Request durchlaufen und die Sortierung nach einer **internen Spalte** machen — sichtbar via Reihenfolge im Output, ohne dass `adminRating` selbst geschickt wird (klassischer Inferenz-Side-Channel).

Im Customer-API-Path ist diese Sort-Option nicht erlaubt (`/api/customer/*` hat keinen Sort-Param), das ist gut. Aber falls Engineering versehentlich eine Customer-Liste mit Sort-Pass-Through baut (Backlog?), wäre das eine Falle.

**Empfohlener Fix:** §9.3 ergänzen: „Sort-Param-Whitelist nur für Admin-Endpoint. Customer-API darf NIE Sort nach internen Feldern erlauben." Reine Doku-Sache.

**Severity:** Minor.

**Routing-Hint:** `solution-architect`.

---

### m3 — Wipe-Skript löscht keine Stripe-Customer-Records

**Story:** US-IT6-06
**Quellen:** `ARCHITECTURE_IT6.md` §8.4 („Frische Stripe-Test-Daten / Webhooks bleiben erhalten — kein Stripe-Dashboard-Eingriff durch das Skript.").

**Problem:** Aus DSGVO-Sicht ist „harter Lösch-Befehl auf Tom's Anweisung" zulässig — aber nur **lokal**. Stripe hält weiterhin Customer-Records (mit Email, ggf. Adresse). Das Design erwähnt das nicht aktiv. In der Praxis kann Tom die Stripe-Customers im Stripe-Dashboard löschen, das Doc sollte aber **dokumentieren**, dass dieser Schritt extern erfolgt + Hinweis im DSGVO-Kontext.

Für IT6 ist das nicht-blockierend (Stripe-Cleanup ist eine Operation außerhalb der App), aber das Doc sollte den Punkt explizit nennen.

**Empfohlener Fix:** §8.4 ergänzen: „Stripe-Customer-Records werden vom Skript NICHT angefasst. Tom muss sie ggf. manuell im Stripe-Dashboard archivieren — DSGVO-Verantwortung liegt dann bei ihm."

**Severity:** Minor (Operations-Hinweis, kein Code-Defect).

**Routing-Hint:** `solution-architect` (Doku) + `project-manager` (Tom über extra Schritt informieren).

---

### m4 — Kalender-Performance: Range-Limits nicht eindeutig + kein Lazy-Loading-Fallback

**Story:** US-IT6-02
**Quellen:** `ARCHITECTURE_IT6.md` §4.3 (max 90 Tage Range Admin / 62 Tage Public); §15 R4 („FullCalendar mit 500+ Buchungen kann langsam werden. QA mit Seed-Daten 1.000 Buchungen testen.").

**Problem:** Range-Limits sind klar (gut). Aber für die Kunden-Monatsansicht (`/api/availability/calendar?from=&to=`) ist 62 Tage die Obergrenze **pro Anfrage** — wenn der Kunde durch 6 Monate blättert, sind das 6 Aufrufe. Cache (`max-age=60`) hilft. Aber: das Design sagt **nicht**, ob der Frontend-Calendar-Component prefetcht (next month ahead) oder reaktiv lädt. Bei langsamen Mobile-Verbindungen kann das ein UX-Problem geben.

Design liefert auch keinen Fallback für den Fall, dass FullCalendar in Lighthouse-Mobile reißt (R4 erwähnt Plan B `react-big-calendar`, aber kein Akzeptanzkriterium für „wann switchen wir"). „Performance-Score 80+" ist Richtwert, nicht Acceptance Gate.

**Empfohlener Fix:**
- §4.3 ergänzen: „Frontend lädt initial den sichtbaren Monat + Pre-fetcht den Folgemonat. Switch zwischen Monaten = ohne Loading-Spinner, weil prefetched."
- §15 R4 ergänzen: „QA-Gate: Wenn Lighthouse-Mobile-Performance < 75, ist Plan B (`react-big-calendar`) Pflicht."

**Severity:** Minor (UX/Performance, nicht Korrektheit).

**Routing-Hint:** `solution-architect`.

---

### m5 — `GET /api/admin/analytics`: Cache `private, max-age=300` widerspricht Frontend-Erwartung „Tom sieht Final-Preis-Änderung sofort"

**Story:** US-IT6-09
**Quellen:** `ARCHITECTURE_IT6.md` §11.1 (`revalidate: 300`); `contracts/api-routes.md` §22.6 Cache (`private, max-age=300`).

**Problem:** ISR + 5-Minuten-Cache bedeutet: Tom ändert in Buchung X den `finalPriceEur` von 0 auf 250 €. Er klickt auf „Analytics" — sieht **alte** Zahlen, weil ISR-revalidate noch nicht abgelaufen ist. Das ist nicht direkt eine Story-Verletzung (keine AC sagt „sofort sichtbar"), aber es widerspricht der UX-Erwartung an einem internen Tool.

Das Doc nennt zwar einen `?refresh=1`-Toggle (§11.1), markiert ihn aber als Backlog. Damit landet Tom in einem Verwirrungs-Szenario („Ich habe doch gerade 250 € eingetragen, warum sehe ich das nicht?").

**Empfohlener Fix:** §11.1 als Pflicht-MVP nehmen: „On-demand-Revalidation via `revalidatePath('/admin/analytics')` im PATCH-Handler von `/api/admin/bookings/:id`, sobald `finalPriceEur` geändert wurde." Das ist 3 Zeilen Code im Backend, kein Backlog.

**Severity:** Minor (UX-Confusion, nicht funktional kaputt).

**Routing-Hint:** `solution-architect`.

---

## Pflicht-Checkliste — Punkt-für-Punkt

### A. Acceptance-Criteria-Vollständigkeit pro Story

| Story | Status | Anmerkung |
|-------|--------|-----------|
| US-IT6-01 | **Concern** (siehe F2) | Endpoints, Schemas, UI gemappt. Letzter-Admin-Race nicht atomar gelöst. |
| US-IT6-02 | **Pass** | FullCalendar-Wahl begründet, Aggregator-Endpoint definiert, Mobile-Switch dokumentiert. AC „Touch ohne H-Scroll" durch View-Switch < 768px abgedeckt. |
| US-IT6-03 | **Pass** | UNIQUE auf `bookingId` bleibt → kein Re-Submit. Trigger auf COMPLETED serverseitig validiert (§5.3). Reject-Spur via `rejectedAt`. AC „nach Reject keine neue Review" abgedeckt. |
| US-IT6-04 | **Pass mit Concern** | NEEDS-INPUT-Markierungen klar (§15 NI-1..NI-4). Lighthouse 80+ als „Richtwert" — könnte härter sein. JSON-LD `LocalBusiness` mit `openingHours` Platzhalter explizit markiert. |
| US-IT6-05 | **Pass** | Diagnose-Liste in §7.5 ist konkret und prüfbar (7 Schritte mit Codes). Datei-Inventar (§7.2) vollständig. |
| US-IT6-06 | **Concern** (siehe F1) | Cascade-Reihenfolge dokumentiert (§8.2). Anonymisierung gut. **Bootstrap-Race ungemindert.** |
| US-IT6-07 | **Concern** (siehe F3) | DTO-Trennung definiert. Convention-basiert, nicht strukturell. |
| US-IT6-08 | **Pass** | Range 0..100000 €, Komma→Punkt-Normalisierung, `null` zum Löschen, Sichtbarkeits-Filter klar. |
| US-IT6-09 | **Pass mit Concern (m5)** | Empty-State definiert. KPI-Mapping vollständig. Cache-Invalidation suboptimal. |

### B. Sicherheits-Pressure-Test (R1)

- `adminNote` / `adminRating` werden NUR über Admin-Endpoints exposed? — **Concern (F3):** Spec sagt ja, aber Convention-basiert ohne strukturelle Absicherung.
- Listet das Design für jeden Customer-/Public-Endpoint die exakte Whitelist? — **Pass:** `CustomerUserPublicSchema` ist explizit definiert (`zod-schemas.ts` §1053). Aber **strikte Validierung (`.strict()`) fehlt** — siehe F3.
- `GET /api/reviews` mappt `userId` → nur Vorname? — **Pass mit Concern (m1):** `PublicReviewSchema` enthält nur `customerName: "Vorname N."` (gekürzt) — keine `customerId`, keine `userId`. Aber Output-Schema-Bindung an die öffentliche Route ist nicht eindeutig dokumentiert.
- `GET /api/admin/analytics` autorisiert? — **Pass:** §11.1 + §22.6 sagen explizit `requireAdmin()` zuerst. AC US-IT6-09 #7 = 401 ohne Auth. CSRF: NextAuth-Sessions sind `sameSite: lax` per Default, GET-Endpoints brauchen kein CSRF-Token. Doc erwähnt das nicht explizit, aber ist Standard.

### C. Auth-Migration & Reihenfolge (R2)

- Erster-Admin-Bootstrap nach Wipe? — **Fail (F1):** Setup-Page öffentlich, sobald `User` leer ist. Kein Token, kein Email-Allowlist, kein BOOTSTRAP_ADMIN_EMAIL.
- Build vor Wipe → Lockout-Risiko Tom? — **Pass:** §13.1 Phase 2 ordnet Auth-Bereinigung NACH Migration und VOR Wipe ein. Engineer im Pair für Tom-Wipe (T-08). Risiko R2 erkennt die Reihenfolge `06 → 05 ist sicherer` — das **widerspricht** allerdings §13.1, wo `T-06 Auth-Bereinigung` vor `T-07 Wipe` steht. **Inkonsistenz im Doc.** Sollte vor Build vereindeutigt werden — siehe m6 unten.
- Google-„Bad request"-Fix konkret? — **Pass:** §7.5 liefert 7 prüfbare Schritte (Redirect-URI, NEXTAUTH_URL, AUTH_SECRET, Cookie-Name, Consent-Screen, Scope, Browser-ITP).

> **Nachgetragen als m6:** Reihenfolge T-06/T-07 in §13.1 widerspricht R2 in §15 — Architektur muss klären.

### D. Letzter-Admin-Schutz (R3 + US-IT6-01 Edge)

- Letzter Admin DELETE/Demote verhindert? — **Fail (F2):** Logik beschrieben, aber **nicht atomar**. `count() > 1` + nachgelagerter UPDATE ist klassisches TOCTOU.
- Race-Condition zwei Admins demoten gleichzeitig? — **Fail (F2):** Doc erwähnt das im Pressure-Test (§14.2), liefert aber keine Implementierungs-Vorgabe.
- Atomare Transaktion erwähnt? — **Nein.** Weder `$transaction` noch `SELECT FOR UPDATE` noch Conditional-UPDATE.

### E. Kalender-UX (US-IT6-02)

- FullCalendar-Wahl begründet (Drag/Touch/DE/Views)? — **Pass:** §4.1 vergleicht mit `react-big-calendar`, begründet via Drag-to-create + Touch + Resource-View-Argument.
- Kollisionsregeln (überlappende Buchungen)? — **Pass mit Concern:** Bestehende Schema-Constraint (`schema.prisma` §279: „Pro (date, startTime, endTime) darf höchstens EINE aktive Buchung existieren") gilt weiter. IT6 ändert das nicht. Aber: Was passiert beim Drag-to-create im Admin-Kalender, wenn Tom in einen Block reinzieht, der durch CONFIRMED belegt ist? §4.2 sagt nur „Drag-to-create öffnet `<DayOverrideManager>` mit Vorausfüllung" — Behandlung der Kollision (Validierungs-Fehler beim Save?) bleibt unkonkret. Annahme A2 markiert das als „DEFER mit Tom abstimmen". Akzeptabel als „später", aber Engineering muss vor Build wissen, dass es eine Validierungs-Fehlerseite braucht.
- Timezone Europe/Berlin / DST? — **Pass:** §22.2 sagt explizit „ISO-8601 mit Berlin-Offset (Sommer/Winter berücksichtigt)."
- Performance R4 (1000+ Buchungen) — Lazy-Loading via `from`/`to`? — **Pass mit Minor (m4):** Range-Limit (90 Tage Admin / 62 Tage Public) implementiert Lazy-Loading. Prefetch unklar.
- Kunde sieht NUR freie Slots? — **Pass:** Public-Endpoint `/api/availability/calendar` gibt nur `available` | `partial` | `unavailable` zurück, **keine** Kundennamen oder Buchungs-Daten anderer Kunden.

### F. Reviews (US-IT6-03)

- UNIQUE auf `bookingId`? — **Pass:** `schema.prisma` §673: `bookingId String? @unique`. Bestand seit IT4.
- POST validiert `status='COMPLETED'` serverseitig? — **Pass:** §5.3: „`booking.status === 'COMPLETED'` (war evtl. CONFIRMED in IT4) … 409 `BOOKING_NOT_COMPLETED`."
- Edge: Booking nach Review auf CANCELLED? — **Concern:** Design behandelt das **nicht explizit**. Annahme: Review bleibt erhalten (UNIQUE auf `bookingId` schützt nicht, aber Review-Datensatz ist nicht von `Booking.status` abhängig). Aus AC-Sicht: Reviews mit `approved=true` zu cancelled Buchungen können theoretisch bestehen → Tom freigegeben + Buchung nachträglich abgesagt → Review ist auf der Startseite zu lesen. **Empfehlung als m7:** AC ergänzen oder Architektur klärt: Wenn Booking auf CANCELLED zurückgesetzt wird, was passiert mit `Review.approved`? Vorschlag: `approved` automatisch auf `false` setzen.
- Spam-Schutz / Rate-Limit auf POST /api/reviews? — **Pass:** §22.10 → 5 / Stunde / Customer-Session.

### G. DB-Wipe (US-IT6-06)

- Cascade-Reihenfolge dokumentiert? — **Pass:** §8.2 listet 4-Schritt-Reihenfolge (Bookings anonymisieren → Reviews lokal Cleanup → CustomerUser → User).
- Dry-Run / Confirmation? — **Pass:** §8.3: `--dry-run` Modus + `ALLOW_USER_WIPE`-ENV.
- ENV-Var-Guard reicht? — **Pass mit Hinweis:** §8.3: zusätzlich `NODE_ENV === 'production'` → Skript bricht ab, außer `--force` mitgegeben. Tom WILL Prod-Wipe → muss `--force` setzen, was bewusst ist. Akzeptabel.
- Stripe-Customer-Records? — **Concern (m3):** Skript fasst sie nicht an, Doc dokumentiert das aber zu beiläufig.

### H. Final-Preis (US-IT6-08)

- Decimal vs. Cents — SQLite-Verhalten? — **Pass mit Risiko-Awareness:** §11.4 + R5 erkennen das Problem („Decimal als TEXT in SQLite, CAST AS REAL für Sums"). Architekt empfiehlt „QA mit fiktivem Booking 99.999,99 testen" — gut.
- Validierungsbereich (0..100000)? — **Pass:** `zod-schemas.ts` §1810–1837 explizit.
- Negative Werte abgelehnt? — **Pass:** `BOOKING_FINAL_PRICE_MIN_EUR = 0`.
- `finalPriceEur` NUR im Admin-DTO? — **Pass:** §10.2: „NICHT in `CustomerBookingSchema`." `CustomerBookingSchema` (§1093) ist verifiziert ohne `finalPriceEur`.

### I. Analytics (US-IT6-09)

- Empty-State sauber bei wenigen/keinen Buchungen? — **Pass:** §11.6 + AC US-IT6-09 #5 + Schema `AnalyticsKpisSchema` mit `nullable()`-Werten.
- Zeitzone Europe/Berlin durchgängig? — **Concern:** Raw-SQL in §11.4 nutzt `substr(date,1,7)`. `date`-Spalte ist `String?` (`schema.prisma` §289 — IT3 Format `YYYY-MM-DD`), also lokales Datum, also faktisch Berlin. Aber: KPI „Buchungen diesen Monat" und Range-Default `12m` gegenüber `now()` — `date('now', '-12 months')` in SQLite ist UTC. **Subtiler Off-by-Stunden-Bug möglich** in den letzten/ersten Tagen eines Monats. Empfehlung: Doc explizit klären, dass alle Date-Comparisons als UTC-Date interpretiert werden, oder Engineering nutzt `date('now', '-12 months', 'localtime')`. Als Minor erfasst.
- Cache-Invalidation? — **Concern (m5):** 5-Min-ISR ohne On-Demand-Revalidation widerspricht UX.

### J. SEO (US-IT6-04)

- Lighthouse-Targets? — **Pass:** §6.3: Performance 80+, SEO 95+, Best Practices 90+. AC US-IT6-04 #7 verbindlich.
- JSON-LD `LocalBusiness` Platzhalter markiert? — **Pass:** §6.2 mit `[NEEDS INPUT — Tom]`-Comments. NI-1..NI-4 in §15 explizit.
- `sitemap.ts` alle dynamischen Service-Pages drin? — **Pass mit Hinweis:** §6.1 erwähnt `/services/[slug]/page.tsx` als NEU. Engineer-Hinweis: „muss Service-Liste im Sitemap dynamisch generieren". Doc benennt das, ohne tiefen Code-Beispiel. Akzeptabel.
- `robots.ts` sperrt Admin und API? — **Pass:** §6.4 zeigt verbindliche Regeln. Auch `/konto` blockiert (richtig).

### K. Tom als erster Admin nach Wipe — Bootstrap-Mechanismus

- Mechanismus erwähnt? — **Fail (F1):** Doc verweist auf „Setup-Wizard (Bestand IT1)" und sagt „Setup ist bedingungslos zugänglich, wenn User-Tabelle leer ist." Das ist **kein Schutz** — es ist die **genaue Lücke**. Kein BOOTSTRAP_ADMIN_EMAIL, kein Token, kein Allowlist-Mechanismus.

→ **MAJOR FINDING (F1)** wie oben.

---

## Test-Strategie pro Story

> Diese Notes nehmen vorweg, was QA in der Build-QA-Phase prüfen MUSS — als Vorbereitung für Engineering-Tests (TDD-Stil).

### US-IT6-01 — Multi-Admin
- Smoke: GET-Liste, POST-Create, PATCH-Edit (Name+Email), PATCH-Status (Disable), DELETE-=PATCH-Disable.
- Lock-out: Self-Disable → 409 `SELF_MUTATION_FORBIDDEN`.
- Lock-out: Letzter aktiver Admin Disable → 409 `LAST_ADMIN_LOCK`.
- **Kritisch (F2): Race-Test.** Mit zwei parallelen Sessions (Tom + Lisa, beide ACTIVE) gleichzeitig PATCH `{status:'DISABLED'}` aufeinander → genau einer gewinnt.
- Disabled Admin → Login → 422 `ACCOUNT_DISABLED`.
- Disabled Admin → Direkt `/admin/users` → Redirect auf `/admin/login?error=account_disabled`.
- requireAdmin() laufende Session: Status-Switch ACTIVE→DISABLED **während** Session offen → next API-Call → 403, sign-out.

### US-IT6-02 — Kalender-UX
- Smoke: Admin Wochen/Tag/Monat Toggle ohne Reload (Client-State).
- Drag-to-create öffnet `<DayOverrideManager>` mit vorausgefülltem Datum/Startzeit/Endzeit.
- Klick auf Buchungsblock öffnet Popover; Link führt zu `/admin/bookings/[id]`.
- Kunden-Monatsansicht: Tag mit nur belegten Slots = `partial` (grau), aktiv mit verfügbaren = `available` (grün), inaktiv = `unavailable` (rot).
- Mobile (<768px): Forced Monthly View, kein H-Scroll, Touch-Tap = Klick.
- Performance: 1000 Seed-Buchungen, Lighthouse Mobile ≥ 75 (siehe m4).
- DST-Test: 2026-03-29 (Sommerzeit-Beginn DE) als Buchungs-Datum → 09:00 Slot rendert auch nach Mitternacht-Switch korrekt.
- **Cross-Test:** Kunde sieht in `/api/availability/calendar?from=…&to=…` keine fremden Kundenamen — Response enthält nur `date` + `status`. JSON-Schema-Test gegen `AvailabilityCalendarDaySchema`.

### US-IT6-03 — Reviews
- Smoke: POST mit `booking.status=CONFIRMED` → 409 `BOOKING_NOT_COMPLETED`.
- POST mit `booking.status=COMPLETED` → 201, Review angelegt mit `approved=false`.
- POST zweite Review für selbe Buchung (auch nach Reject) → 409 `REVIEW_EXISTS`.
- PATCH Reject → `approved=false`, `rejectedAt!=null`, `moderatedById=me.id`. Review erscheint NICHT mehr in `GET /api/reviews`.
- PATCH Approve nach Reject → `rejectedAt=null`, `approved=true`. Erscheint wieder.
- **Edge (m7):** Booking → CONFIRMED → COMPLETED → Review erstellt → Tom approved → Booking-Status auf CANCELLED zurück. Review **bleibt sichtbar?** Architekt muss Antwort liefern. QA-Test: prüfen.
- Public-Endpoint Schema: GET `/api/reviews` Response gegen `PublicReviewSchema.strict()` validieren — keine `customerId`, kein `bookingId`.

### US-IT6-04 — SEO
- HTML-Source jeder öffentlichen Page: `<title>` (≤ 60 Z.), `<meta description>` (≤ 160 Z.) je unique.
- Open-Graph: WhatsApp-Preview-Test (Facebook-Sharing-Debugger).
- `/sitemap.xml` enthält `/`, `/buchung`, `/services/<slug>`, `/impressum`, `/datenschutz`. Alle mit `<lastmod>`.
- `/robots.txt` enthält `Disallow: /admin/`, `/api/`, `/konto/`. Sitemap-URL drin.
- Google Rich Results Test → `LocalBusiness` valide.
- Lighthouse Desktop: Performance ≥ 80, SEO ≥ 95.
- Lighthouse Mobile: Performance ≥ 75 (Soft-Target — Architekt-Empfehlung).

### US-IT6-05 — Auth-Bereinigung
- `/konto/login` Source: nur Google + Facebook Buttons, kein Email-Form.
- `POST /api/customer/register` → 404. (Verzeichnis gelöscht.)
- `POST /api/customer/login` → 404.
- `POST /api/customer/forgot-password` → 404.
- `GET /api/customer/verify` → 404.
- `/konto/registrieren` Page → 404.
- Google-Login Happy-Path durchlaufen → `/konto`.
- Facebook-Login Happy-Path → `/konto`.
- Facebook-Login OHNE Email-Scope → Redirect mit `?error=oauth_no_email`.
- NextAuth-Config (`customer-oauth.ts`): nur GoogleProvider + FacebookProvider, kein GitHub, kein Credentials.
- §7.5 Diagnose-Schritte 1–7: jeden Schritt manuell durchgehen + dokumentieren, dass die Config in Prod stimmt.

### US-IT6-06 — Wipe
- Skript ohne `ALLOW_USER_WIPE` → bricht mit Error ab.
- Skript mit `ALLOW_USER_WIPE=true` + `NODE_ENV=production` ohne `--force` → bricht ab.
- Skript mit `--dry-run` → schreibt nichts, gibt Summary mit Zählern aus.
- Skript-Run → COMPLETED+CONFIRMED Buchungen anonymisiert (`customerId=null`, `customerName` bleibt), PENDING+COUNTER_PROPOSED → CANCELLED, CustomerUser leer, User leer, PENDING-Reviews gelöscht, APPROVED-Reviews bleiben (mit `customerId=null`).
- **Kritisch (F1):** Nach Wipe-Run, vor Tom's Setup-Submit → kein Mechanismus blockt fremde Setup-Versuche. Test: `curl POST /api/admin/setup` mit beliebiger Email → muss durch BOOTSTRAP_ADMIN_EMAIL-Check abgelehnt werden, sobald F1 gefixt ist.
- Idempotenz: Skript zweimal hintereinander → kein Fehler.

### US-IT6-07 — Admin-Userverwaltung
- Smoke: GET-Liste, GET-Detail, PATCH (Profil + adminNote + adminRating), DELETE.
- **DTO-Leak Test (F3, R1):** Setup mit Customer A, der `adminNote='SECRET'` hat. Ruf `GET /api/customer/me` mit Customer A's Session → JSON darf `SECRET` nicht enthalten. Schema-Strict-Validation gegen `CustomerUserPublicSchema`.
- DTO-Leak Test 2: `GET /api/customer/bookings` (joined Customer) → kein `adminNote`/`adminRating`.
- DTO-Leak Test 3: alle anderen `/api/customer/*`-Endpoints durchgehen.
- 403-Test: Customer-Session → `GET /api/admin/users` → 403.
- DELETE Customer → `Booking.customerId=null`, Booking bleibt. `Review.customerId=null`.
- Suche `?q=mar` (case-insensitive) → matcht `Maria Müller`.

### US-IT6-08 — Final-Preis
- PATCH mit `"185,00"` (String-Komma) → gespeichert als 185.00.
- PATCH mit `185.50` (Number) → ok.
- PATCH mit `"-5"` → 400 `VALIDATION_ERROR`.
- PATCH mit `"abc"` → 400.
- PATCH mit `null` → Wert entfernt.
- PATCH mit `100001` → 400.
- Customer-API `GET /api/customer/bookings/:id` → keine `finalPriceEur`-Key (Schema-Strict).
- Admin-API `GET /api/bookings/:id` → enthält Wert.

### US-IT6-09 — Analytics
- Empty-State (frische DB, keine Buchung mit `finalPriceEur`) → KPI-Kachel zeigt „—", Banner sichtbar.
- 3 COMPLETED-Buchungen mit Preisen (50, 100, 250) → totalRevenueEur=400, completedBookings=3, averageOrderValueEur=133.33.
- Range-Filter `30d`, `90d`, `12m`, `ytd` → Werte ändern sich.
- Range `custom` ohne `from`/`to` → 400.
- 401 ohne Auth.
- KPI-Kachel-Klick → führt zu gefilterter Buchungsliste.
- 99999.99 € Test (R5 / SQLite-Decimal) → ohne Float-Drift.
- **Cache-Test (m5):** PATCH ändert `finalPriceEur` → reload `/admin/analytics` → sieht alten oder neuen Wert? Wenn ohne Revalidation → m5 reproduziert.
- DST-Edge: Booking am 2026-03-29 02:30 → erscheint korrekt im März-Bucket.

---

## Empfehlung an Orchestrator

**Verdict:** Needs revision. Build kann nicht starten, bevor F1, F2, F3 vom Architekten beantwortet sind. m1–m7 sollten ebenfalls geklärt werden, sind aber nicht-blockierend.

**Klarstellungen, die der Architekt liefern muss (Top-3-Fragen):**

1. **F1 (Bootstrap):** Welcher Mechanismus verhindert nach dem Wipe einen fremden Setup-Submit auf `/admin/setup`? — Vorschlag: `BOOTSTRAP_ADMIN_EMAIL`-ENV-Allowlist + 422 für andere Emails. Architekt entscheidet zwischen den drei vorgeschlagenen Optionen.

2. **F2 (Letzter-Admin-Race):** Welcher konkrete Concurrency-Mechanismus (Conditional UPDATE, $transaction Isolation, App-Lock) wird im Backend genutzt, damit zwei parallele Disable-Requests nicht beide den Lock-out-Schutz umgehen? — Vorschlag: Conditional UPDATE mit `WHERE status='ACTIVE' AND (SELECT count … >1)` und Backend-prüft `affectedRows`.

3. **F3 (DTO-Leak):** Welche **strukturelle** Absicherung (nicht nur Convention) verhindert, dass ein Customer-Endpoint `adminNote`/`adminRating` leakt? — Vorschlag: `CustomerUserPublicSchema.strict()` Pflicht in jedem Customer-Response + dedizierter Helper `selectCustomerUserPublic()` für Prisma-Selects.

**Sekundäre Klarstellungen (m1–m7):**
- m1: Public-Reviews-Output gegen `PublicReviewSchema.strict()` binden.
- m2: Sort-Whitelist verbindlich, Customer-API darf keinen `adminRating`-Sort.
- m3: Stripe-Customer-Cleanup als Operations-Schritt dokumentieren.
- m4: Mobile-Calendar Prefetch + Lighthouse-Hard-Floor 75.
- m5: Analytics On-Demand-Revalidation als MVP-Pflicht.
- m6: §13.1 vs. R2-Inkonsistenz in Phase-Reihenfolge auflösen.
- m7: Review-Verhalten bei Booking-CANCELLED-Rollback klären.

**Nach Klärung:** Re-Review oder direkt Build-Start mit Auflage, dass F1/F2/F3 in der Implementierung verbindlich sind und QA in der Build-Phase per Smoke-Test prüft.

---

**Ende Report.**

---

## Re-Review (2026-05-03 - nach Architekt-Revision v1.6.1)

Reviewer: qa-engineer
Quellen: `ARCHITECTURE_IT6.md` Anhang B §17.1–§17.13, `contracts/zod-schemas.ts` (v1.6.1), `contracts/api-routes.md` (REVISED-Markierungen).
Methode: Cross-Check Original-Findings ↔ Anhang B ↔ Contract-Eingriffe (Schema + Routes). Stichproben in Code-Skeletten geprüft.

### Verdict

**Approved with minor notes.** Alle drei Major Findings (F1, F2, F3) sind mit konkreter, implementierbarer Spec geschlossen. Sechs der sieben Minor Findings sind RESOLVED, m3 ist PARTIAL (kein Blocker, Doku-Restanz). Build kann starten.

### Status pro Finding

- **F1 — RESOLVED.** Bootstrap-Schutz ist deterministisch sicher.
  - Variante 1 (`BOOTSTRAP_ADMIN_EMAIL`-Allowlist) gewählt mit klarer Begründung, warum Variante 2/3 verworfen wurden (§17.1).
  - Reihenfolge der Checks ist im Code-Skelett (§17.1.1) **eindeutig**: (1) `count(users) >= 1` → 410 GONE, (2) ENV vorhanden? → sonst 503 SETUP_NOT_CONFIGURED, (3) Body-Validate, (4) Email-Match → sonst 403 BOOTSTRAP_NOT_ALLOWED, (5) Create.
  - Antwort auf Frage „ENV bleibt nach Setup gesetzt": §17.1.1 Schritt 2 ignoriert die ENV explizit, sobald `count >= 1` ist (`410 GONE` vorrangig). §17.1.2 Failure-Mode-Tabelle bestätigt das mit Bemerkung „ENV wird **ignoriert**". Damit kein „Wait-for-Wipe-Hijack"-Pfad. Empfehlung in §17.1.3 Schritt 5, ENV nach erfolgreichem Bootstrap zu entfernen, ist ein „nice-to-have", kein Risiko.
  - Contract-Eingriffe konsistent: `api-routes.md` §22.6 hat REVISED-Banner; ENV-Tabelle (§22.9, Zeile 3383) listet `BOOTSTRAP_ADMIN_EMAIL`; neue Codes `BOOTSTRAP_NOT_ALLOWED` / `SETUP_NOT_CONFIGURED` in §22 Error-Codes-Liste (Zeilen 2749–2750) und im `zod-schemas.ts`-Kommentar (Zeilen 2009–2017). Alles auffindbar.
  - Failure-Mode-Tabelle in §17.1.2 ist QA-direkt-konsumierbar (Smoke-Test-Spec).

- **F2 — RESOLVED.** Conditional UPDATE atomar via `prisma.$executeRaw`.
  - `disableAdminSafely(targetId)` in §17.2.1 ist libSQL/SQLite-kompatibel formuliert — `EXISTS (SELECT 1 FROM users u2 WHERE u2.id <> :targetId AND u2.status = 'ACTIVE')` ist ANSI-SQL und in SQLite/libSQL portabel ausführbar. Begründung gegen `$transaction` mit Serializable explizit (Prisma's Wrapper bietet kein `SELECT ... FOR UPDATE` für SQLite).
  - Subselect `id <> :targetId AND status = 'ACTIVE'` schließt das Target aus dem Mindestbestand aus → genau die richtige Semantik für „mindestens ein **anderer** ACTIVE-Admin muss bleiben".
  - Race-Verhalten: Begründung in §17.2.1 (Zeilen 1509–1512) ist korrekt — bei zwei parallelen Disable-Requests gewinnt **einer**, der zweite sieht in seinem Subselect schon den ersten als DISABLED → `affectedRows = 0`. SQLite serialisiert Writes; ein Wechselseitiges-Self-Disable scheitert für genau einen der beiden Requests.
  - Helper-Pflicht: §17.2.3 fordert verbindlich, dass **jeder** Code-Pfad, der einen Admin-Status auf DISABLED setzt oder die Admin-Rolle entzieht, den Helper (oder analoge Variante) nutzen MUSS. PATCH-Status und DELETE (Soft-Delete) sind explizit darauf gemappt (§17.2.2 + `api-routes.md` §22.1 PATCH/DELETE). Es gibt **keinen** PATCH-role-Endpoint in IT6 — die Architektur stellt explizit fest, dass aktuell nur ein Endpoint betroffen ist; bei IT7-Erweiterung ist die Regel niedergeschrieben.
  - QA-Test-Spec (§17.2.4) ist Bash-konkret und in §14.1 hochgestuft (siehe §17.12).
  - Idempotenz: Bei `affectedRows=0` differenziert der Handler via Read zwischen „bereits DISABLED → 200" und „letzter Admin → 409 LAST_ADMIN_LOCK" (§17.2.2). Kein 409-Spam für Re-Submit-Klicks.

- **F3 — RESOLVED.** Strukturelle Absicherung (Helper + .strict() + CI-Test).
  - Beide Helper existieren als verbindliche Spec in §17.3.1: `selectCustomerUserPublic()` (ohne adminNote/adminRating) und `selectCustomerUserAdmin()` (extends Public um die internen Felder). Kombination Helper + `satisfies Prisma.CustomerUserSelect` zwingt Type-Korrektheit und blockiert Spread-Operator-Lecks im Mapper.
  - `.strict()` ist auf den 3 genannten Schemas verifiziert in `zod-schemas.ts`:
    - `CustomerUserPublicSchema` (Zeile 1095): `.strict()` gesetzt.
    - `CustomerBookingSchema` (Zeile 1175): `.strict()` gesetzt; auch innere `payment` (1159) und `review` (1170) sind strict.
    - `PublicReviewSchema` (Zeile 1413): `.strict()` gesetzt; Whitelist auf 6 Felder reduziert (id, customerName, service, stars, text, createdAt).
  - CI-Test (§17.3.4): AST-Scan mit `ts-morph` blockt jeden `prisma.customerUser.find*`-Call in `src/app/api/customer/**` ohne `selectCustomerUserPublic()`. Pre-Merge-Gate (`pnpm test:arch`). Damit ist die Convention strukturell erzwungen.
  - Defense-in-Depth-Layer: (1) Helper-Pflicht im Select, (2) `.strict()` Output-Parse, (3) CI-AST-Scan, (4) Build-Phase-Snapshot-Test (§17.3.5). Jede Schicht fängt unabhängig ein DTO-Leak ab.
  - Snapshot-Test im QA-Plan: `tests/api/customer-leak.test.ts` seedet einen Customer mit `adminNote='SECRET'` und prüft `expect(body.data).not.toHaveProperty('adminNote')` (§17.3.5).

- **m1 — RESOLVED.** §17.5 bindet `GET /api/reviews` an `PublicReviewSchema.strict()`. Whitelist auf 6 Felder. `customerName` als `"Vorname N."`-Format (Mapper-Code geliefert). Fallback `"Anonym"` bei `customerId === null`. Snapshot-Test verbindlich. `api-routes.md` Zeilen 3048–3050 bestätigen die Bindung.

- **m2 — RESOLVED.** §17.6 schreibt verbindlich: Admin-API hat abschließende Sort-Whitelist (`lastName_asc`, `createdAt_desc`, `bookingCount_desc`, `adminRating_desc`); Customer-API verbietet `sort` komplett für IT6. Plus CI-Test, der nach `sort.*adminRating|adminNote|finalPriceEur` in `/api/customer/*` sucht.

- **m3 — PARTIAL.** §17.7 dokumentiert Stripe-Cleanup als Tom-Operativ-Schritt + Runbook `docs/runbook-wipe-IT6.md` ist gefordert. Der Skript-Code-Eingriff (Zeilen 1950–1959) referenziert `Payment.stripeSessionId` (existierende Spalte) statt eines `stripeCustomerId`-Feldes — dieser Workaround ist akzeptabel, aber Tom muss in Stripe pro Session navigieren statt Bulk-Customer-Liste zu bekommen. Engineering-Hinweis in §17.7 macht das transparent. Nicht-blockierend für Build, aber Build-Phase muss prüfen, ob das Runbook vor Wipe-Run tatsächlich existiert.

- **m4 — RESOLVED.** §17.8 schreibt Public-Calendar-Prefetch (Folgemonat im Idle-Hint, SWR/Tanstack staleTime 5min), Admin-Calendar ohne Prefetch (klar getrennt), 44px-Touch-Floor mit konkretem CSS, Lighthouse-Mobile-Hard-Floor 75 als Plan-B-Trigger.

- **m5 — RESOLVED.** §17.9 schreibt `unstable_cache` mit Tag `analytics`, `revalidateTag('analytics')` im PATCH-Handler bei `finalPriceEur`-Touch oder Status-Flip zu/von COMPLETED. QA-Smoke mit Max-Latenz 2s. `?refresh=1` ist obsolet.

- **m6 — RESOLVED, mit Doku-Restanz.** §17.10 ist eindeutig: Reihenfolge ist `06 → 05` (Wipe vor Auth-Bereinigung), neue T-06a/T-06b/T-07/T-08/T-09/T-10-Tasks-Liste verbindlich. Doku-Konsistenz: Architekt hat REVISED-Banner an drei Stellen platziert — §8.4 (Zeile 707–712), §13.1 (Zeile 1102–1107), Anhang B §17.10 (Zeile 2117). Der **alte** §13.1-Tasks-Block bleibt physisch im Doc stehen (Zeile 1121–1124 mit T-06 Auth-Bereinigung VOR T-07 Wipe), aber der vorangestellte Banner („Verbindlich gilt die revidierte Reihenfolge aus §17.10 …") überschreibt eindeutig. Akzeptabel — Engineering kann nicht versehentlich der alten Reihenfolge folgen, weil der Banner direkt oberhalb der Phase-2-Box steht. **Trotzdem leichte Doku-Restanz**: ein zukünftiger Engineer kann bei Diff-Review §13.1 als „aktuell" lesen, wenn er den Banner überspringt. Empfehlung (nicht-blockierend): Architekt sollte in einer späteren v1.6.2 den alten T-06/T-07-Block durch das neue Schema **ersetzen**, statt zu admonieren. Aber für Build-Start nicht nötig. R2 in §15 (Zeile 1275–1279) ist mit der finalen Reihenfolge konsistent.

- **m7 — RESOLVED.** §17.11 schreibt verbindlich: Wenn Booking aus COMPLETED rauswandert oder hart auf CANCELLED geht, wird die Review automatisch auf `approved=false`, `rejectedAt=now()` gesetzt. Im selben `prisma.$transaction` mit dem Booking-Update (atomar). `revalidateTag('public-reviews')` im selben Pfad. UNIQUE auf `bookingId` schützt vor Re-Submit. QA-Edge-Case-Test verbindlich (§17.11 Pflicht-Test 1–4).

### Verbleibende Concerns (nicht-blockierend)

1. **m3 (Stripe-Runbook):** `docs/runbook-wipe-IT6.md` muss in der Build-Phase tatsächlich angelegt werden — der Architekt hat es spezifiziert, aber QA muss in Build-QA verifizieren, dass die Datei existiert und Toms Schritte enthält.
2. **m6 (Doku-Restanz):** Alter §13.1-Tasks-Block bleibt physisch im Doc stehen; Banner überschreibt zwar verbindlich, ist aber Style-suboptimal. Kein Build-Blocker.
3. **OAuth-Provider-Enum (out-of-scope für diese Re-Review, aber Hinweis):** `CustomerUserPublicSchema.oauthProvider` listet weiterhin `['google', 'github']` als Zod-Enum (Zeile 1090), während §17.5 / US-IT6-05 auf `['google', 'facebook']` umstellt. Die Architektur löst das via separater Konstante `CUSTOMER_OAUTH_PROVIDERS_IT6` (Zeile 1576). Das ist eine **Engineering-Verantwortung in der Build-Phase**: das Enum im `CustomerUserPublicSchema` muss vor Go-Live getauscht werden, sonst akzeptiert die Strict-Validation keinen Facebook-User. QA muss das im Build-QA-Smoke-Test prüfen (`oauthProvider='facebook'` durchgereicht). Nicht F1/F2/F3-relevant, aber Verweis-würdig.

### Empfehlung an Orchestrator

Build kann starten. F1/F2/F3 sind verbindlich gespect, m1/m2/m4/m5/m7 sind ebenfalls implementierbar geschlossen, m3 und m6 sind Doku-Restanz ohne Build-Blocker.

**QA-Schwerpunkte für Phase 4 (Build-QA):** in dieser Priorität:

1. **F1 Smoke-Suite** — Failure-Mode-Tabelle aus §17.1.2 1:1 als Test durchspielen (alle 4 Szenarien: ENV fehlt → 503; ENV gesetzt + falsche Email → 403; ENV gesetzt + richtige Email → 201; bereits Admin existiert → 410).
2. **F2 Race-Test** — `tools/qa/last-admin-race.sh` ausführen mit zwei parallelen Sessions; verifizieren `count({status:'ACTIVE'}) === 1` post-Race.
3. **F3 Leak-Test** — Customer mit `adminNote='SECRET'` seeden, alle 5+ `/api/customer/*`-Endpoints auf fehlende Keys prüfen; CI-AST-Scan-Test (§17.3.4) muss grün sein.
4. **m5 Cache-Invalidation** — PATCH `finalPriceEur` → unmittelbar in `/admin/analytics` sichtbar (Max 2s).
5. **m7 Review-Auto-Reject** — COMPLETED-Buchung mit approved Review → CANCELLED → Review verschwindet aus `GET /api/reviews`, DB zeigt `rejectedAt!=null`.
6. **m3 Runbook** — Datei `docs/runbook-wipe-IT6.md` existiert mit Stripe-Cleanup-Abschnitt.
7. **OAuth-Enum-Switch** — `CustomerUserPublicSchema.oauthProvider` ist auf `['google','facebook']` umgestellt vor Go-Live; Strict-Parse für Facebook-User fail-frei.

Build-Engineer kann sequenziell loslegen: erst Phase-1-Foundation (T-01..T-05), dann Phase-2 in der **revidierten** Reihenfolge (T-06a/b → T-07 → T-08 → T-09 → T-10), dann Phase-3-Features parallel.

---

**Ende Re-Review (v1.6.1).**
