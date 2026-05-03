# QA Design Review — Iteration 10

**Stand:** 2026-05-03
**Reviewer:** QA Engineer
**Modus:** Design QA (Pre-Build Pressure-Test)
**Scope:** US-IT10-01, -02, -03, -04, -05

---

## Zusammenfassung

**Verdikt: GO-MIT-AUFLAGEN**

Das Architektur-Paket ist insgesamt von hoher Qualität: die drei Bug-Hypothesen sind sauber begründet, die Feature-Architekturen für US-IT10-04/-05 sind realistisch („keine neuen Endpoints, keine Migrationen"), die UX-Spec ist sehr ausführlich (Microcopy + State-Tabellen + a11y) und der Component-Library-Anhang ist durchdacht. Die Frontend-Requirements wurden vom Solution Architect für IT10 ergänzt — die im UX-Spec antizipierte Lücke ist geschlossen.

Es bestehen aber **vier strukturelle Defekte** (drei davon mit Bauchfehler-Risiko: stille Migrations-Drift künftig, Contract-Drift FE↔BE, Pagination-Lücke), **zwei UX-Lücken** und **zwei Klärungsbedarfe Richtung PM/Tom**. Keiner ist ein Show-Stopper, aber alle sollten **vor** dem Build geklärt werden, sonst werden sie als Defekte in iteration-2-of-build wieder hochkommen.

**Quick-Stats:**
- Akzeptanzkriterien testbar: 22/24 (92%)
- Strukturelle Defekte: **4**
- UX-Defekte: **2**
- SCOPE/PM-Klärungen: **2**
- Echte Blocker: 0

---

## Pro-Story-Befunde

### US-IT10-01 — Passwort-Reset-Mail (Bug-Fix)

**Verdikt:** **GO** (mit einer Empfehlung).

**Testbarkeit der Akzeptanzkriterien:**

| AC | Testbar? | Anmerkung |
|----|----------|-----------|
| AC1 (Mail kommt in 2 min) | bedingt | Live-Smoke an verifizierter Test-Adresse via Resend-Sandbox. „Inbox-Polling in CI" ist nicht spezifiziert — QA muss das manuell verifizieren. **Akzeptabel**, aber Test-Plan in `backend-requirements.md` IT10 §S1 sollte den Empfänger explizit benennen (Toms verifizierte Mail). |
| AC2 (Ursache im PR dokumentiert) | ja | Process-AC, prüfbar im PR-Body. |
| AC3 (Reset-Link funktioniert, single-use, 1h) | ja | E2E-Test-fähig, IT7-Schema (`password_reset_tokens.usedAt` + `expiresAt`) deckt es. |
| AC4 (neues Passwort speichern, Redirect) | ja | E2E. |
| AC5 (abgelaufener Link → klare Meldung) | ja | UX-Spec §2.4 + Microcopy „Dieser Link ist nicht mehr gültig." gedeckt. |

**Edge Cases / Failure-Modes — Architektur-Antworten:**

- **Token-Ablauf, Mehrfach-Klick:** abgedeckt (`PasswordResetToken.usedAt` + `expiresAt` aus IT7, einmalig).
- **Race auf Doppel-Klick „Link senden":** Rate-Limit (`forgotPasswordEmailLimiter` 3/h) + Konstante Latenz greifen — abgedeckt.
- **Email-Enumeration:** in Architektur §1.1 explizit dokumentiert: Antwort konstant `200`, Latenz-Floor 750 ms — sauber.

**Bug-Hypothesen-Validität:**

- Hypothese (`MAIL_FROM` fehlt + Resend-Domain unverifiziert) ist **gut begründet**: Architektur §1.1 zitiert konkrete Codestellen (`src/lib/mail.ts` Z. 131–133, `.env.example` Z. 27).
- **Aber:** Die Architektur klassifiziert „strukturiertes Logging" und „Diagnose-Endpoint" als „Backlog, nicht IT10-Scope". Das ist akzeptabel, aber **schwach**: ohne Logging-Härtung wird der nächste Mail-Bug genauso lange unentdeckt bleiben. Siehe globaler Defekt **STRUCT-1**.

**Defekte:** keine eigenständigen, siehe globale Defekte **STRUCT-1** und **PM-1**.

---

### US-IT10-02 — Admin-Nutzerliste (Bug-Fix)

**Verdikt:** **GO-MIT-AUFLAGEN** (Pagination-UX fehlt).

**Testbarkeit:**

| AC | Testbar? | Anmerkung |
|----|----------|-----------|
| AC1 (Liste oder Empty) | ja | UX-Spec §3.2 deckt beide Pfade präzise ab. |
| AC2 (Ursache dokumentiert) | ja | Process-AC. |
| AC3 (Mind. Name/Email/Datum/Status) | ja | UX-Spec §3.3 listet die Spalten verbindlich. |
| AC4 (verbotene DTO-Felder nicht in UI) | ja | UX-Spec §3.3 dokumentiert das Verbot, F3-Garantie aus IT7 plus DTO-Leak-Scanner sichern es zusätzlich. |
| AC5 (`next build` grün) | ja | CI-Check, automatisch verifizierbar. |

**Edge Cases:**

- **Sehr große Datensätze:** Backend-Endpoint hat `page/pageSize` (api-routes.md §22.4 — bestehend) — **aber UX-Spec §3 erwähnt KEINE Pagination-UI** (kein „Vor"/"Zurück", keine Page-Size-Auswahl, kein Page-Indicator). Bei >25 Kunden in Prod ist das ein UX-Defekt → **DEFEKT UX-1**.
- **Sortierung:** Backend supportet `sort=lastName_asc|bookingCount_desc|…`, UX-Spec dokumentiert keine sortierbare Spaltenüberschrift. **Akzeptabel** für IT10 (Tom hat nur 5–20 Kunden), aber sollte als Backlog-Item benannt werden.
- **RBAC bei Nicht-Admin:** `requireActiveAdmin()` (IT6 §17.2 F2-Garantie) redirected auf `/login`, statt 500 zu werfen — abgedeckt.
- **`P2022` (Migrations-Drift):** Das ist die Hypothese der Bug-Story selbst. Wird durch `prisma migrate deploy` adressiert — siehe **STRUCT-2**.

**Defekte:** **UX-1** (siehe unten).

---

### US-IT10-03 — Booking-POST 500 (Bug-Fix)

**Verdikt:** **GO-MIT-AUFLAGEN** (Contract-Mismatch beim Slot-Konflikt).

**Testbarkeit:**

| AC | Testbar? | Anmerkung |
|----|----------|-----------|
| AC1 (Erfolg → Bestätigungsseite) | ja | E2E. |
| AC2 (Eintrag in `/admin/bookings`) | ja | E2E. |
| AC3 (Mail an `MAIL_TO_ADMIN`) | ja | Inbox-Polling oder Resend-Webhook. |
| AC4 (Ursache im PR dokumentiert) | ja | Process-AC. |
| AC5 (Validierungsfehler statt 500) | ja | UX-Spec §4.2 + §4.3 verbindlich. |

**Edge Cases:**

- **Race auf gleichzeitiges Buchen desselben Slots:** `booking-create.ts` macht Serializable-Tx mit Overlap-Check (Architektur §1.3 Pkt. 2). Backend antwortet `409 CONFLICT` (api-routes.md Z. 226 + Z. 327). UX-Spec §1.5 mappt das auf Code `BOOKING_SLOT_TAKEN`. **Aber:** Backend liefert NICHT diesen String — der existiert weder in `contracts/api-routes.md` noch im Code. → **DEFEKT STRUCT-3** (Contract-Drift FE↔BE).
- **XSS im Namen:** Backend serialisiert sauber (Prisma + JSON-Response), Frontend rendert Text via React (auto-escaped). Abgedeckt.
- **Sehr lange Beschreibung:** `BookingFormSchema.description.max(2000)`, Frontend prüft per Zod, Backend prüft per Zod — abgedeckt (UX-Spec §4.3 listet die Regel).
- **Tx-Timeout (`P2028`):** Architektur §1.3 Pkt. 4 erkennt das als Risiko und schlägt eine kleine, lokale Erhöhung vor. Konkret: `timeout: 5000 → 10000`, `maxWait: 2000 → 4000`. Akzeptabel.
- **Mail-Dispatch-Fehler kippt Handler nicht:** Architektur §1.3 Pkt. 2 verifiziert das Fire-and-Forget-Wrapper — abgedeckt.

**Bug-Hypothesen-Validität:**

- Migrations-Drift-Hypothese deckt sich mit US-IT10-02 (selbe Symptomatik, selber Stack) — **konsistent**.
- **Aber:** kein Plan für „falsch gelaufene Adress-Reads im eingeloggten-Kunden-Pfad" in der Diagnose. Der Architekt erwähnt das (§1.3 Pkt. 1: „crasht **bereits dieser Read**"), schlägt aber keinen defensiven Code-Eingriff vor. Akzeptabel als IT10-Scope-Entscheidung — siehe **STRUCT-1**.

**Defekte:** **STRUCT-3** (Contract-Drift) und siehe globale **STRUCT-1** + **STRUCT-2**.

---

### US-IT10-04 — Quick-Booking-Modal

**Verdikt:** **GO-MIT-AUFLAGEN** (Slot-belegt-Code-Mapping; Service-Auswahl im Header unklar).

**Testbarkeit:**

| AC | Testbar? | Anmerkung |
|----|----------|-----------|
| AC1 (Slot-Klick → Modal mit Datum/Uhrzeit pre-filled) | ja | Modal-Smoke M1 in FE-Req. |
| AC2 (Submit → Modal schließt + Erfolg, kein Page-Wechsel) | ja | Modal-Smoke M3. |
| AC3 (Schließen ohne Datenverlust) | ja | Modal-Smoke M2. UX-Spec §5.7 + Architektur §2.1 Variante A („Modal bleibt gemountet") sind klar. |
| AC4 (Pflichtfeld leer → Inline-Fehler, Modal bleibt) | ja | Modal-Smoke M4 + UX-Spec §5.3 `open-validation-error`. |
| AC5 (Mobile vollständig scrollbar, Submit ohne H-Scroll) | ja | UX-Spec §5.9 + §5.10 (Bottom-Sheet sticky-header/footer) sehr ausführlich. |

**Edge Cases / Failure-Modes:**

- **Slot wird belegt während Modal offen:** UX-Spec §5.2 Pkt. 6 dokumentiert das exzellent — Banner, Submit-Label-Wechsel, Form-State-Erhalt, Fokus-Restore. **Aber** der Backend-Error-Code-Mapping ist falsch (siehe **STRUCT-3**).
- **ESC schließt mit Daten:** UX-Spec §5.2 Pkt. 7 — Inline-Confirm im Footer (kein Heavy-Confirm-Dialog). Sauber.
- **Modal-Open via URL (Deep-Link):** Architektur §2.1 entscheidet **bewusst** für „kein URL-Param in Phase 1" und benennt es als Backlog. PM-Frage in Architektur §7 Pkt. 2 ist explizit. **Konsistent**, aber siehe **PM-2**.
- **Mehrfach-Submit (User klickt 2× bevor Spinner kommt):** UX-Spec §5.3 `open-loading` macht „Inputs disabled" — abgedeckt.
- **Service-Auswahl:** UX-Spec §5.6 sagt „Service ist im Header sichtbar, **nicht** als editierbares Feld im Form". Component-Library §1 listet `service` als **Pflicht-Prop** vom Modal. **Aber:** wo kommt der Service her, wenn der Kunde direkt auf dem Kalender landet, ohne vorher einen Service zu wählen? Bestehender `/buchung`-Flow hat eine ServiceGrid + URL-Param `?service=…`. UX-Spec verweist drauf, aber **die Architektur sagt nichts dazu, was passieren soll, wenn der User auf den Kalender klickt OHNE Service-Vorauswahl** → der Modal hätte keinen Service. → **DEFEKT STRUCT-4** (Lücke in Modal-Trigger-Bedingung).
- **Datei-Upload im Modal:** UX-Spec §5.6 erwähnt Datei-Upload, FE-Req nicht explizit als Modal-Feature. Component-Library §1 erwähnt es ebenfalls. Architektur §2.1 sagt „`POST /api/upload` unverändert" — abgedeckt, aber Tab-Order-Spec im Modal müsste den Upload-Button mit aufnehmen (UX-Spec §5.8 listet ihn nicht explizit). Minor-Lücke, kein Defekt.

**Defekte:** **STRUCT-3** (Slot-Konflikt-Code), **STRUCT-4** (Service-Vorauswahl-Bedingung).

---

### US-IT10-05 — Customer-Self-Service (Anfragen + Pre-Fill)

**Verdikt:** **GO-MIT-AUFLAGEN** (Status-Mapping inkonsistent; Storno-Scope unklar; Pagination fehlt; Anonyme-Vor-Account-Buchungen unspezifiziert).

**Testbarkeit:**

| AC | Testbar? | Anmerkung |
|----|----------|-----------|
| Teil A AC1 (Liste mit Status-Badges DE) | ja | UX-Spec §6.6 definiert 5 Varianten. **Aber:** FE-Req §`/konto` listet 6 (`COMPLETED` zusätzlich) → siehe **UX-2**. |
| Teil A AC2 (Empty-State + CTA) | ja | UX-Spec §6.4 + §6.11. |
| Teil A AC3 (Detail-Page mit allen Feldern) | ja | UX-Spec §6.8. **Aber:** Bezahlung/Bewertung in FE-Req-Detail-Spec aufgeführt, in UX-Spec §6.8 nicht ausreichend mit Spec versorgt. Minor-Lücke. |
| Teil B AC1 (Pre-Fill aus Profil) | ja | UX-Spec §6.10. |
| Teil B AC2 (Profil ohne Adresse → Hinweis) | ja | UX-Spec §6.10 `prefilled-partial`. |
| Teil B AC3 (Override im Form ändert Profil nicht) | ja | Architektur §2.2 explizit (Booking-Adresse = Snapshot). |
| Teil B AC4 (Gast → Felder leer) | ja | UX-Spec §6.10 `prefilled-empty`. |

**Edge Cases / Failure-Modes:**

- **Bestehende Buchungen mit `customerId NULL` (vor Account-Erstellung anonym gestellt):** Story sagt „alle meine Buchungsanfragen" — was, wenn ein Gast zuerst gebucht hat (`customerId=NULL`) und sich danach mit derselben E-Mail registriert? Werden die historischen Buchungen via `email`-Match dem Account zugeordnet? Architektur und UX schweigen dazu. → **DEFEKT STRUCT-5** (oder PM-Klärung).
- **Pagination der Anfragen-Liste auf `/konto`:** `GET /api/customer/bookings` liefert `{ upcoming, past }` — kein Limit dokumentiert. Bei einem Kunden mit 50 alten Anfragen wird die Page riesig. UX-Spec §6 erwähnt keine Pagination, kein „Mehr laden". → **DEFEKT UX-1** (gleicher Defekt wie US-IT10-02 in der Form, deshalb gemeinsam).
- **Sehr alte Anfragen:** kein Filter/Cutoff dokumentiert. Akzeptabel für IT10 (geringer Datenvolumen).
- **`COUNTER_PROPOSED` rendern:** UX-Spec §6.6 explizit als „Gegenvorschlag" mit `feedback-info`. Konsistent mit Backend.
- **Mehrere Ansichten gleichzeitig (Tab-Tab + Storno):** Wenn der Kunde in einem Tab storniert, der andere zeigt noch den alten Status — kein Refresh-Mechanismus dokumentiert. Akzeptabel als bekannte Limitation.
- **Storno-Funktion in UX-Spec §6.9:** UX-Spec definiert Storno-Logik (24h-Frist, ConfirmDialog, Status-Wechsel). **Aber:** US-IT10-05 enthält in den AC **keine Storno-Anforderung**. Storno ist Bestand aus IT4 (`POST /api/customer/bookings/:id/cancel`, api-routes.md §1522), aber als IT10-Story-Feature ist das **Scope-Creep**. UX-Spec §8 stellt das selbst als „Offene UX-Frage 1" an Tom. → **PM-Klärung PM-3**.

**Konsistenz Architektur ↔ UX:**

- **Status-Liste-Drift:** FE-Req-Tabelle nennt **6** Status-Werte (`PENDING`, `CONFIRMED`, `REJECTED`, `COUNTER_PROPOSED`, `CANCELLED`, `COMPLETED`). UX-Spec §6.6 + Component-Library `BookingStatusBadge` listen **5** (kein `COMPLETED`). Story-AC1 sagt explizit „mind.: Offen / Bestätigt / Abgelehnt / Storniert / Gegenvorschlag" — also auch nur 5. Aber `COMPLETED` ist im Schema-Enum. Wie wird ein Status `COMPLETED` in der UI gerendert? → **DEFEKT UX-2** (Status-Badge-Lücke).
- **Profil-Pre-Fill-Mapping:** api-routes.md §24.5, FE-Req §Pre-Fill-Mapping und Architektur §2.2 sind **deckungsgleich**. Sauber.

**Defekte:** **STRUCT-5**, **UX-1**, **UX-2**, **PM-3**.

---

## Globale Defekte (Querschnitt)

### **STRUCT-1** — Stille Migrations-Drift bleibt strukturell ungelöst (Severity: Major)

**Klassifikation:** STRUCTURAL (Architekt-Action).

**Befund:** Die Bug-Hypothese „verschlafene Migration → `P2022` → 500 mit generischer Meldung" ist plausibel und sehr wahrscheinlich richtig. **Aber** der einzige IT10-Fix ist `prisma migrate deploy`. Die strukturelle Schwachstelle (`internalError()` mappt **alle** Backend-Fehler auf eine generische 500-Meldung **ohne** Prisma-Error-Code im Vercel-Log) bleibt unangetastet — der Architekt klassifiziert das selbst als „Backlog" (Architektur §1.2 + §1.3 + Backend-Req §Logging).

**Risiko:** Wenn Tom in IT11 die nächste Schema-Erweiterung deployt und die Migration vergisst, sehen wir wieder „Interner Serverfehler" und brauchen Vercel-Stack-Trace-Forensik. Genau dieselbe halbe Stunde Tom-Wartezeit wie in IT10.

**Suggested fix (klein, IT10-tauglich):** `internalError()` in `src/lib/api.ts` so erweitern, dass in Prod der Prisma-Error-Code als Response-Header (`x-error-prisma-code`) und als strukturierte Log-Zeile (`{ level: 'error', prisma_code: 'P2022', request_id }`) emittiert wird. **Kein** Klartext im Body, kein Security-Risiko. **2 h Engineer-Aufwand**, vermeidet künftige Iteration-bei-jedem-Migrations-Bug.

**Routing:** solution-architect (Spec-Update) + backend-engineer (Implementierung).

**Verifikations-Strategie für die ursprüngliche Hypothese:** Die Architektur empfiehlt, **vor** Code-Änderungen `prisma migrate status` gegen Prod zu prüfen (§1.4 + §7 Pkt. 5). **Diese Reihenfolge ist verbindlich** und sollte vom Engineer im PR-Body explizit dokumentiert werden („Migrations-Stand vor Fix war: …, nach Fix: …"). Architektur-Dokument betont das, aber als „Pflicht-Schritt" — gut.

---

### **STRUCT-2** — Pflicht-Aktion „Prod-Migrations-Stand prüfen" ist organisatorisch nicht abgesichert (Severity: Minor)

**Klassifikation:** STRUCTURAL (PM/Tom-Klärung) — siehe **PM-1**.

**Befund:** Architektur §7 Pkt. 5 fragt, ob der Engineer Zugriff auf `prisma migrate status` gegen die Prod-libSQL/Turso hat. Ohne diesen Zugriff kann er die Hypothese **nicht** verifizieren — er muss raten. Das ist ein **Build-Blocker**, der vor dem Engineer-Hand-off zu klären ist.

**Suggested fix:** PM/Tom bestätigt im Sprint-Kickoff:
- (a) Engineer hat Zugriff auf Vercel-Function-Logs (für Stack-Trace).
- (b) Engineer hat Connection-String / Turso-Token für `prisma migrate status` und ggf. `migrate deploy` gegen Prod.

**Routing:** project-manager.

---

### **STRUCT-3** — Contract-Drift: Slot-Konflikt-Error-Code FE ↔ BE (Severity: Major)

**Klassifikation:** STRUCTURAL (Architekt-Action).

**Befund:** UX-Spec §1.5 (Fehler-Code-Mapping IT10) führt einen Code `BOOKING_SLOT_TAKEN` ein und mappt ihn auf Microcopy „Dieser Termin wurde inzwischen leider von jemand anderem gebucht." Auch `BOOKING_VALIDATION_ERROR`, `RESET_REQUEST_FAILED`, `BOOKING_SUBMIT_FAILED`, `ADMIN_USERS_FETCH_FAILED`, `BOOKING_CANCEL_FORBIDDEN` sind in derselben Tabelle.

**Aber:** Diese Codes existieren **nicht** im Backend-Vertrag:

- `contracts/api-routes.md` Z. 226 listet für Slot-Konflikt **`CONFLICT`** und **`OVERLAP`** (beide 409).
- `BOOKING_SLOT_TAKEN` taucht in **keinem** Backend-Code-File und keinem Vertragsdokument auf.
- `ADMIN_USERS_FETCH_FAILED` ist eine FE-interne Fehler-Klasse (5xx fallback), kein Server-Code.

Wenn das FE in IT10 nach `error.code === 'BOOKING_SLOT_TAKEN'` filtert, wird das **niemals** matchen, und der User sieht den 5xx-Fallback statt der gut formulierten Slot-Belegt-Meldung.

**Suggested fix:** Architektur und UX-Spec klären die Single-Source-Of-Truth:

- **Variante A (recommended):** Backend bleibt bei `409 CONFLICT` (kanonisch). FE mapped lokal `error.status === 409 && error.code === 'CONFLICT' && error.field === 'date'` → UX-Microcopy „Slot belegt". UX-Spec §1.5-Tabelle umformulieren: die linke Spalte ist **kein** Server-Code, sondern eine **FE-interne UI-State-Bezeichnung**.
- **Variante B:** Backend ergänzt ein optionales `subcode`-Feld (`BOOKING_SLOT_TAKEN`) in den 409-Responses. Aufwand: Anpassung in `booking-create.ts` und in `ApiErrorSchema`, plus Vertragsdokument-Update. Kleiner Eingriff, aber **schon Backend-Touchpoint** — nicht „kein Code-Change", wie IT10 verspricht.

UX-Spec §1.5 muss in jedem Fall an die Backend-Realität angeglichen werden, sonst funktioniert das gesamte Fehler-Mapping nicht.

**Routing:** solution-architect (Spec-Anpassung in api-routes.md + ux-spec) + Engineer-Klärung.

---

### **STRUCT-4** — Modal-Trigger ohne Service-Vorauswahl unspezifiziert (Severity: Major)

**Klassifikation:** STRUCTURAL (Architekt-Action).

**Befund:** UX-Spec §5.2 Pkt. 1 sagt: „Kunde wählt im Kalender ein Datum, dann eine Dauer, dann klickt auf einen verfügbaren Slot in `TimeSlotPicker`." Component-Library §1 macht `service` zu einem **Pflicht-Prop** des Modals.

**Aber:** Im aktuellen Flow (`/buchung`) kann der Kunde theoretisch zuerst auf den Kalender klicken, **ohne** vorher einen Service ausgewählt zu haben. Was passiert dann?

- (a) Wird der Slot-Klick deaktiviert, bis ein Service gewählt ist? (UI-Feedback nötig.)
- (b) Öffnet das Modal mit „Service: nicht gewählt" und einem Service-Picker im Modal-Header? (Widerspricht UX-Spec §5.6: „Service ist nicht editierbar im Form".)
- (c) Springt der Modal-Inhalt zurück zur Service-Auswahl? (Schlechte UX.)

Die Architektur §2.1 schweigt dazu. Der Bestand-Flow hat einen ServiceGrid + URL-Param `?service=…` — möglich, dass der Kalender heute schon nur sichtbar wird, wenn ein Service gewählt ist. **Bitte verifizieren** und im Spec festhalten.

**Suggested fix:** Architektur ergänzt eine Vorbedingung-Klausel im §2.1: „Voraussetzung für Modal-Trigger: gültiger `serviceSlug` im Page-State. Sonst wird der Slot-Klick im Kalender wie bisher behandelt (Smooth-Scroll zum Service-Picker)." UX-Spec §5.2 ergänzt diese Vorbedingung und definiert das Verhalten bei „kein Service gewählt".

**Routing:** solution-architect + ux-designer (gemeinsame Klärung).

---

### **STRUCT-5** — Anonyme Vor-Account-Buchungen werden nicht im Self-Service abgedeckt (Severity: Minor → Major bei Tom-Anwendungsfall)

**Klassifikation:** STRUCTURAL (Architekt + PM).

**Befund:** US-IT10-05 sagt „alle meine eigenen Buchungsanfragen". `GET /api/customer/bookings` filtert wahrscheinlich nur nach `customerId === session.userId`. **Aber:** seit IT2/IT3 ist der Booking-POST-Pfad als anonymer Flow erlaubt (Gast-Buchung → `customerId` ist NULL, `customerEmail` ist gefüllt).

Konkretes Tom-Szenario: Ein Kunde stellt eine Anfrage am Montag als Gast. Am Mittwoch registriert er sich mit derselben E-Mail. Sieht er die Montags-Anfrage im Self-Service? Aktuell **nein** (kein E-Mail-basierter Backfill-Mechanismus dokumentiert). Tom hat das aber sehr wahrscheinlich erwartet — und wird es als „Bug" melden.

**Suggested fix (zwei Optionen):**

- **Variante A (Backend-Backfill bei Account-Anlage):** Beim `POST /api/customer/register` werden alle Bookings mit `customerEmail = lc(email)` und `customerId IS NULL` auf den neuen Account gemappt. Architektur-Eingriff klein und einmalig.
- **Variante B (Read-Time-Match):** `GET /api/customer/bookings` matched zusätzlich `customerEmail = lc(session.email)`. Performance-Risiko (kein Index auf `customerEmail`), aber kein Schreibvorgang.
- **Variante C (Scope-Cut):** PM/Tom bestätigt explizit, dass Vor-Account-Buchungen aus dem IT10-Scope fallen. **Dann muss das in der UX-Spec dokumentiert werden** („Sie sehen nur Anfragen, die nach Ihrer Registrierung gestellt wurden.").

**Routing:** project-manager (Scope-Entscheidung) + solution-architect (Variante A oder B speccen).

---

## UX-Defekte

### **UX-1** — Pagination fehlt für `/admin/users` und `/konto`-Anfragen (Severity: Minor heute, Major bei Wachstum)

**Klassifikation:** UX (UX-Designer-Action).

**Befund:** Beide Listen-Pages (`/admin/users` mit Backend-`page/pageSize`, `/konto` mit `{ upcoming, past }`) liefern unbegrenzt viele Einträge ohne UI-Mechanismus zum Blättern oder Lazy-Load. UX-Spec §3 (Admin-Users) und §6 (Customer-Bookings) erwähnen keine Pagination-Controls.

**Risiko:** Heute (Tom hat 5–20 Kunden) unkritisch. In 6–12 Monaten (50+ Kunden, 200+ Buchungen) wird die Mobile-`/konto`-Seite extrem lang. Performance-Risiko auf langsamen Verbindungen.

**Suggested fix:** UX-Designer ergänzt Pagination-Pattern in `ux-spec-iteration-10.md` §3 und §6.4:
- Admin-Users: Standard-Pagination (`Vor` / `Zurück` + Page-Indicator), Page-Size 25.
- Customer-Bookings auf `/konto`: „Mehr laden"-Button am Ende der Liste, oder einfach ein „Frühere Anfragen anzeigen"-Toggle für `past`. Backend-Endpoint braucht ggf. ein `limit`-Param.

**Routing:** ux-designer (Spec) + solution-architect (Backend-Entscheidung „limit"-Param ja/nein).

---

### **UX-2** — Status `COMPLETED` ist kein Badge-Variant in der UX-Spec (Severity: Minor)

**Klassifikation:** UX (UX-Designer-Action).

**Befund:**

- `frontend-requirements.md` IT10 §`/konto` listet 6 Status-Werte inkl. `COMPLETED → "Abgeschlossen"`.
- UX-Spec §6.6 listet **nur 5** (kein `COMPLETED`).
- Component-Library `BookingStatusBadge` §3 listet ebenfalls **nur 5**.
- Schema (`BookingStatus`-Enum in `prisma/schema.prisma`) enthält `COMPLETED`.

Wenn das Backend einen `COMPLETED`-Status liefert (was es tut, sobald Tom einen Termin abgeschlossen markiert), rendert der Badge-Component **keinen** Wert oder einen Fallback (Default-Variante? Crash?).

**Suggested fix:** UX-Designer ergänzt 6. Variante in `ux-spec-iteration-10.md` §6.6, Component-Library §3 (`BookingStatusBadge`) und Design-System §1.4 (Status-Badge-Farb-Mapping). Vorschlag: `feedback-info` mit `CheckCircle2`-Icon (oder `Award`/`Trophy`), Text „Abgeschlossen".

**Routing:** ux-designer.

---

## SCOPE / PM-Klärungen

### **PM-1** — `MAIL_FROM` vs. `RESEND_FROM_EMAIL` (Severity: Minor)

**Klassifikation:** SCOPE (PM-Klärung).

**Befund:** Architektur §7 Pkt. 1 stellt diese Frage bereits. Story PROJECT.md US-IT10-01 nennt `RESEND_FROM_EMAIL`, App-Code liest `MAIL_FROM`. Architekt-Vorschlag: `MAIL_FROM` bleibt kanonisch, kein Code-Rename.

**Suggested fix:** PM bestätigt, Story-Hinweis zu `RESEND_FROM_EMAIL` wird in PROJECT.md gestrichen. **5 min Aufwand.**

**Routing:** project-manager.

---

### **PM-2** — Tiefen-Verlinkung Quick-Booking-Modal (Severity: Trivial)

**Klassifikation:** SCOPE (PM-Klärung).

**Befund:** Architektur §7 Pkt. 2 fragt explizit. Architekt-Vorschlag: Phase 1 ohne URL-Param, Backlog für später.

**Suggested fix:** PM/Tom bestätigt „kein URL-Param in IT10". **2 min Aufwand.**

**Routing:** project-manager.

---

### **PM-3** — Storno-Funktion Scope für US-IT10-05 (Severity: Minor)

**Klassifikation:** SCOPE (PM-Klärung).

**Befund:** UX-Spec §6.9 spezifiziert Storno-UX (24h-Frist, ConfirmDialog) für `/konto/anfragen/[id]`. **Aber** US-IT10-05-AC enthalten **keine** Storno-Anforderung. Backend-Endpoint `POST /api/customer/bookings/:id/cancel` existiert seit IT4.

UX-Spec §8 Frage 1 stellt diese Klärung explizit ans Tom: „Sollen Kunden auch bestätigte Anfragen selbst stornieren?"

Wenn die Storno-UX in IT10 mit ausgeliefert wird, ist das **Scope-Creep gegenüber dem Story-Vertrag**. Wenn sie weggelassen wird, klafft eine Lücke im UX-Spec, die der Engineer als „nicht implementieren" interpretieren muss.

**Suggested fix:** PM/Tom entscheidet:
- **Variante A:** Storno-UX **gehört** zu IT10 → AC zu US-IT10-05 ergänzen („Detailseite zeigt Storno-Button bei stornierbaren Anfragen"); UX-Spec ist verbindlich.
- **Variante B:** Storno-UX ist **out-of-scope** → UX-Spec §6.9 wird mit Hinweis „Backlog IT11" markiert; Detail-Page rendert keinen Storno-Button in IT10.

**Routing:** project-manager.

---

## Globale Risiken / Querschnitts-Themen

### Bug-Diagnose-Strategie

Die Architektur arbeitet mit einer einzigen, sehr starken Hypothese: „Migrations-Drift in Prod erklärt zwei der drei Bugs." Das Risiko: Wenn die Hypothese **falsch** ist (Migration ist da, Bugs trotzdem da), gibt es keinen Plan B außer „dann zielgenau patchen".

**Mitigation (siehe STRUCT-1 + STRUCT-2):** Vor jedem Code-Change steht **Pflicht-Schritt 1**: `prisma migrate status` + Vercel-Logs. Engineer dokumentiert das Ergebnis im PR-Body — daraus folgt entweder „Migration nachgezogen, Bug weg" (kein Code-Change) oder „Migration war OK → Stack-Trace-Analyse → zielgenauer Patch". Diese Disziplin **muss** im Engineer-Hand-off explizit gemacht werden, sonst springt der Engineer ins Patchen ohne Diagnose.

### Test-Strategie

Pflicht-Smoke-Tests sind in `backend-requirements.md` IT10 §Test-Plan und `frontend-requirements.md` §Test-Plan benannt — gut. **Aber:** Pressure-Tests gegen die identifizierten Edge-Cases fehlen:

- Race auf `POST /api/bookings` (zwei Clients buchen denselben Slot in <100 ms) — kein automatisierter Test.
- `POST /api/customer/forgot-password` mit Resend-Mock-Failure → wird der `console.warn` korrekt geloggt? (Manuell.)
- Migration Roll-Forward + Roll-Back gegen Staging-Snapshot — nicht spezifiziert.

Akzeptabel als Backlog, sollte aber im Build-Phase-Test-Plan benannt werden.

### Sicherheits-Querschnitt

Sauber:
- DTO-Leak-Scanner (IT7 F3-Garantie) ist aktiv und greift `passwordHash`/`adminNote`/`adminRating`.
- Email-Enumeration-Schutz auf Forgot-Password mit Konstant-Latenz.
- bcrypt cost 12.
- CSRF: NextAuth + JWT-Cookies + SameSite — abgedeckt seit IT6.

Keine neuen Sicherheits-Risiken in IT10.

### Accessibility-Querschnitt

UX-Spec ist a11y-stark:
- WCAG-AA-Kontraste explizit dokumentiert (Design-System §1.3).
- Modal-Focus-Trap, ESC, ARIA-Roles (UX-Spec §5.11).
- Status-Badges sind Text + Icon, nicht nur Farbe (Component-Library §3 — Akzeptanzkriterium aus US-IT10-02 implizit erfüllt).
- `aria-live` Trennung `polite` vs. `assertive` korrekt (UX-Spec §1.4).
- Reduced-Motion-Regel verbindlich (Design-System §4).

**Lücke:** Tab-Order-Spec für Modal nimmt den Datei-Upload-Button nicht explizit mit auf (UX-Spec §5.8). Minor, leicht in der Implementierung erkennbar.

---

## Empfehlungen für Phase 3 (Build)

### Vor Build-Start (Architekt + UX-Designer + PM):

1. **Architekt:** UX-Spec §1.5 Fehler-Code-Tabelle gegen Backend-Realität korrigieren (siehe **STRUCT-3**), Modal-Trigger-Vorbedingung „Service muss gewählt sein" speccen (**STRUCT-4**), Anonyme-Vor-Account-Buchungen klären (**STRUCT-5**), `internalError()`-Härtung als IT10-Scope-Item evaluieren (**STRUCT-1**).
2. **UX-Designer:** Status `COMPLETED` als Badge-Variante ergänzen (**UX-2**), Pagination-Pattern für beide Listen speccen (**UX-1**).
3. **PM/Tom:** Drei offene Fragen entscheiden (**PM-1**, **PM-2**, **PM-3**); Engineer-Zugriff auf Prod-Logs und libSQL/Turso bestätigen (**STRUCT-2**).

### Build-Phase Disziplin (Engineer):

4. **Pflicht-Schritt 1:** `prisma migrate status` gegen Prod **vor** jedem Code-Change auf den drei Bug-Endpoints. Ergebnis im PR-Body dokumentieren.
5. **Pflicht-Schritt 2:** Vercel-Function-Logs für die Endpoints aufrufen, Stack-Traces sichern, Prisma-Error-Code identifizieren.
6. **Pflicht-Schritt 3:** Fix nur dann implementieren, wenn Schritt 1+2 bestätigen, dass die Migrations-Hypothese **falsch** ist. Bei Bestätigung: nur Migration nachziehen, keine Code-Änderung.
7. **Modal-Build:** UX-Spec §5 verbindlich, Component-Library §1 verbindlich, **plus** STRUCT-3-Fix und STRUCT-4-Klärung.
8. **Pre-Fill-Build:** Architektur §2.2 Variante A (SSR) verbindlich. RHF-`reset()` mit `useEffect` bei Profil-Änderung.

### Test-Phase QA:

9. Smoke-Tests aus `backend-requirements.md` IT10 §Test-Plan und `frontend-requirements.md` §Test-Plan ausführen.
10. Zusätzlich: Race-Test auf `POST /api/bookings` (zwei parallele Clients), Migrations-Roll-Forward auf Staging-Snapshot, Resend-Mock-Failure-Test.
11. Re-QA der Bug-Akzeptanzkriterien live in Prod (nach Migration-Deploy) **bevor** der Build geschlossen wird.

### Backlog (außerhalb IT10-Scope, aber tracken):

- `internalError()` Logging-Härtung mit Prisma-Error-Code (sollte IT10-Scope sein, ist aber als „Backlog" markiert — siehe **STRUCT-1**).
- Modal-Tiefen-Verlinkung (URL-Param `?date=…&time=…`).
- Pagination auf `/konto` und `/admin/users`, falls Tom > 25 Kunden / Buchungen erreicht.
- Diagnose-Endpoint `GET /api/admin/diagnose/mail`.
- Storno-Annehmen/Ablehnen-Flow für `COUNTER_PROPOSED`.

---

## Sign-off Checkliste (für Iteration-10-Build-Closure)

- [ ] STRUCT-3 (Slot-Konflikt-Code) gefixt — UX-Spec §1.5 oder Backend ergänzt um `BOOKING_SLOT_TAKEN`-Code.
- [ ] STRUCT-4 (Modal-Service-Vorbedingung) gefixt in Architektur + UX-Spec.
- [ ] UX-2 (`COMPLETED`-Badge) ergänzt.
- [ ] PM-1, PM-2, PM-3 schriftlich entschieden.
- [ ] STRUCT-2 (Engineer-Prod-Zugriff) bestätigt vor Build-Kickoff.
- [ ] STRUCT-5 (Anonyme Vor-Account-Buchungen) entschieden.
- [ ] UX-1 (Pagination) entweder in IT10 ergänzt oder als Backlog dokumentiert.
- [ ] STRUCT-1 (`internalError()`-Logging-Härtung) entschieden — IT10 oder Backlog.
- [ ] Pflicht-Diagnose-Disziplin (`migrate status` vor Code-Change) im Engineer-Hand-off explizit.
- [ ] Smoke + Pressure-Tests gegen die fünf Stories grün.
- [ ] Re-QA in Prod nach Migration-Deploy.
