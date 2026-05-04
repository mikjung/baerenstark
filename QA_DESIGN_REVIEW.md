# QA Design Review — Konsolidiert (Stand IT12, 2026-05-04)

Reviewer: qa-engineer
Konsolidiert aus: QA_DESIGN_REVIEW_IT6.md … QA_DESIGN_REVIEW_IT12.md
Methode: Pressure-Test der Architektur/Contracts vor Build-Phase, Cross-Check Story ↔ Architektur ↔ Contracts.

---

## Übersicht aller Iterationen

| Iteration | Datum | Verdict | Critical | Major | Loops nötig? |
|-----------|-------|---------|----------|-------|--------------|
| IT6 | 2026-05-03 | Needs revision → Approved with minor notes (nach Re-Review v1.6.1) | 0 | 3 (F1/F2/F3) | Ja — 1 Loop (Architekt-Anhang B §17) |
| IT7 | 2026-05-03 | Approved with minor notes | 0 | 0 | Nein |
| IT8 | 2026-05-03 | Approved with concerns (go für Phase 3) | 0 | 4 (BUG-IT8-01-A, -02-A, -03-A, -05-A) | Nein |
| IT9 | 2026-05-03 | Approved with concerns | 0 | 8 (IT9-02-A..F, IT9-03-A..D, IT9-04-A..C) | Nein |
| IT10 | 2026-05-03 | Go-mit-Auflagen | 0 | 5 STRUCT (1,3,4) + UX-1/2 + 3 PM | Nein |
| IT11 | 2026-05-04 | Needs Fixes (Blocker durch Spec-Konflikte) | 4 (CRITICAL-01..-04) | 9 | **Ja** — Loop an architect + ux-designer |
| IT12 | 2026-05-04 | Needs Revision before Build | 8 (C1..C8) | 12 | **Ja** — Loop an architect + ux-designer + PM |

---

## Wiederkehrende Patterns / Lessons Learned

Themen, die in mehreren Iterationen aufkamen:

### 1. Endpoint-/Pfad-/Schema-Drift FE ↔ BE ↔ UX-Spec

- IT8: BUG-IT8-03-A (BOOKING_SLOT_TAKEN-Code in UX-Spec, aber nicht im Backend).
- IT10: STRUCT-3 (`BOOKING_SLOT_TAKEN` Slot-Konflikt-Code mismatch FE↔BE) — gleicher Bug.
- IT11: BUG-CRITICAL-01..03 (Routing-Format Bestätigung+Storno, Phantom-Endpoint `cancel-preview`).
- IT12: C2 (Service-Slug-Mismatch UX vs `src/lib/services.ts`), C3 (`/leistungen` vs `/services`), C4/C5 (Konto-aus-Buchung Endpoint+Subcode), C6 (Marketing-Endpoints), M5 (Profil-Feld `street` vs `streetAndNumber`), M7 (502 vs 503 vs INTERNAL_ERROR).

**Lesson:** UX-Spec und Backend-Vertrag müssen vor jedem Build-Start in einem zentralen OpenAPI-/Schema-Anker eingefroren werden. Vorschlag: Vor Build-Start verbindlicher 30-min Sync architect+ux-designer für Endpoint-/Slug-/Status-Code-Konflikte.

### 2. DTO-Leak (F3) und Strict-Schema-Garantien

- IT6: F3 → strukturelle Helper-Lösung (`selectCustomerUserPublic`) + AST-Scanner + `.strict()` + Snapshot-Test.
- IT7: F3 erweitert um `passwordHash`, `verificationToken`, `oauthId`.
- IT9: MAJOR-IT9-02-B/C/D — Migration neuer Adress-Felder zwingt zu disziplinierter Mapper-Konsistenz.
- IT10: STRUCT-1 — `internalError()` Logging-Härtung mit Prisma-Code im Header.

**Lesson:** Helper-Pflicht + `.strict()` + CI-AST-Scan ist die Defense-in-Depth-Architektur, an der jede neue Iteration F3 fortschreibt. Engineer muss bei jeder Schema-Erweiterung ALLE Aufrufer von `toCustomerPublic` verifizieren.

### 3. State-Machine / Race-Conditions (Conditional UPDATE)

- IT6: F2 — `disableAdminSafely()` Conditional-UPDATE als Vorbild.
- IT7: m2-IT7 — Reset-Token-Race löst dasselbe Pattern auf `password_reset_tokens`.
- IT8: BUG-IT8-02-A — Calendar-Initial-Fetch Race (`useRef` + AbortController).
- IT11: BUG-MAJOR-02 (TimeSlot-Race Cancel+Book), BUG-MAJOR-03 (Doppel-Submit-Schutz).
- IT12: M8 (Idempotency-Key für Booking-Submit).

**Lesson:** Jeder schreibende Endpoint braucht atomare Race-Mitigation (Conditional UPDATE / Idempotency-Key / Optimistic Dedup). `prisma.$transaction` Function-API alleine reicht auf libSQL nicht.

### 4. DSGVO / UWG / Werbe-Einwilligung

- IT6: m3 — Stripe-Customer-Records bleiben nach Wipe.
- IT9: §2.5 GET-Endpoint stellt sicher, dass Adresse nur unter eigener Customer-Session lesbar ist.
- IT12: C7 (DSGVO-Lücke Werbe-Einwilligung in S15 Marketing-Mailer) — Critical, weil Abmahn-Risiko.

**Lesson:** Bei jedem Customer-Daten-Touch DSGVO-Pfad explizit dokumentieren (Lese- vs. Schreib-Authority, Löschpfad, Einwilligungsmodell für Marketing).

### 5. Loading-/Empty-/Error-States + Microcopy

- IT8: BUG-IT8-04-A (Optimistic Update für DayOverrides).
- IT9: MINOR-IT9-01-A/-03-E (Wortlaut-Drift Empty-/Error-Microcopy zwischen Story und Architektur).
- IT10: UX-1 (Pagination fehlt für `/admin/users` und `/konto`), UX-2 (Status `COMPLETED` Badge fehlt).
- IT11: BUG-CRITICAL-04 (Storno-State `frist-abgelaufen` fehlt), BUG-MINOR-01 (Microcopy-Drift Telefon).
- IT12: M4 (Auth-Sync-Pattern Drift NextAuth vs. customer-sync), M9 (Bewertungen-Duplikat in Admin-Nav), M10 (Backwards-Compat-Routen).

**Lesson:** UX-Spec muss für jeden interaktiven Flow alle States explizit mit deutscher Microcopy + `aria-live` definieren. Story-Wortlaut für Empty-/Error-Strings ist verbindlich.

### 6. Migrations-Disziplin (libSQL/Turso)

- IT6: Migration-Reihenfolge T-06/T-07 widersprüchlich → in Re-Review aufgelöst.
- IT7: m3-IT7 Plan B (Tabelle-Recreate-SQL) für `DROP COLUMN`.
- IT9: MAJOR-IT9-02-A — additive ALTER TABLE auf Turso-Branch testen vor Prod.
- IT10: STRUCT-2 (Engineer-Zugriff auf Prod-Logs/Turso muss vor Build geklärt sein).
- IT12: S06/S12/S13 Bug-Hypothese „Migration nicht deployed".

**Lesson:** Pflicht-Schritt vor jedem Schema-Code-Change: `prisma migrate status` gegen Prod, dokumentiert im PR-Body. Tom muss vor Build Engineer-Zugriff bestätigen.

### 7. Operative DevOps-Aktionen (Tom)

- IT10: 5 operative Aufgaben (Vercel-ENV, Resend-Domain, migrate deploy, Smoke).
- IT11: 12-Schritte-Smoke-Liste.
- IT12: Phase-1 DevOps-Pflichtaktionen (NEXTAUTH_URL, Google-Cloud-Redirect-URI, Migrationen) **bevor** Code-Smoke greift.

**Lesson:** Jede Iteration mit Schema- oder ENV-Touchpoints muss eine explizite „Tom muss in Vercel/Stripe/Google/Resend/Turso erledigen"-Checkliste produzieren. Code-Verdict alleine ist nicht „deploy-ready".

---

## Per Iteration

### IT6 — Multi-Admin, Kalender, Reviews, SEO, Auth-Bereinigung, Wipe, Final-Preis, Analytics

- **Verdict:** Needs revision → **Approved with minor notes** (nach Re-Review v1.6.1)
- **Loop:** Ja, 1 Loop. Architekt liefert Anhang B §17.1–§17.13 mit konkreter Spec für F1/F2/F3.

**Critical / Major Issues (alle erhalten):**

- **F1 (Major) — Bootstrap-Race „leerer User-Tabelle = jeder darf erster Admin werden".** Story US-IT6-06+01. Nach Wipe ist `User` leer; `/admin/setup` ist `PUBLIC_ADMIN_PATHS` → fremder Setup-Submit möglich. **Fix (gewählt):** ENV-Allowlist `BOOTSTRAP_ADMIN_EMAIL` + Failure-Mode-Tabelle mit 410 GONE wenn `count(users) >= 1`. Routing: `solution-architect`. **RESOLVED in v1.6.1.**
- **F2 (Major) — Letzter-Admin-Schutz nicht atomar.** Story US-IT6-01. `count > 1` + nachgelagerter UPDATE = klassisches TOCTOU. **Fix:** Conditional UPDATE via `$executeRaw` mit Subselect-Constraint, libSQL-kompatibel. Routing: `solution-architect`. **RESOLVED in v1.6.1.**
- **F3 (Major) — DTO-Leak `adminNote`/`adminRating` Convention-basiert.** Story US-IT6-07. **Fix:** Helper `selectCustomerUserPublic()`/`selectCustomerUserAdmin()` + `.strict()` Schemas + CI-AST-Scan via `ts-morph` + Snapshot-Test. Routing: `solution-architect` + `backend-engineer`. **RESOLVED in v1.6.1.**

**Major (kompakt):**

- m1 — Public-Reviews-Schema-Bindung (`PublicReviewSchema.strict()`). RESOLVED.
- m2 — Sort-Whitelist Customer-API. RESOLVED.
- m3 — Stripe-Customer-Cleanup als Doku-Schritt. PARTIAL (Runbook-Pflicht).
- m4 — Mobile-Calendar Prefetch + Lighthouse-Hard-Floor 75. RESOLVED.
- m5 — Analytics On-Demand-Revalidation via `revalidateTag('analytics')`. RESOLVED.
- m6 — Phase-2-Reihenfolge (Wipe vor Auth-Bereinigung). RESOLVED mit Doku-Restanz.
- m7 — Review-Auto-Reject bei Booking-CANCELLED-Rollback. RESOLVED.

**Re-Verify-Outcome (v1.6.1):** Alle 3 Major-Findings RESOLVED, 6 von 7 Minor RESOLVED, m3 PARTIAL (Runbook-Restanz). Build kann starten. Architekt-Antwort konkret und verbindlich.

---

### IT7 — Email-/Password-Reversion, OAuth-Reparatur, Promote-Skript, Reset-Flow

- **Verdict:** Approved with minor notes
- **Loop:** Nein. m1–m6-IT7 nicht-blockierend.

**IT6-Regression-Check:** F1/F2/F3 alle NICHT regressiert. F3 sauber erweitert um `passwordHash`/`verificationToken`/`oauthId` in `FORBIDDEN_FIELDS`.

**Major:** Keine.

**Minor (kompakt):**

- m1-IT7 — Email-Enumeration-Latenz auf `/forgot-password` weich spezifiziert; Latenz-Floor 750 ms verbindlich. Routing: `solution-architect`.
- m2-IT7 — Reset-Token-Race nicht conditional-locked. Conditional UPDATE auf `password_reset_tokens` als atomare Authority. Routing: `solution-architect`.
- m3-IT7 — Migration `DROP COLUMN` Plan B (Tabelle-Recreate-SQL) liefern. Routing: `solution-architect`.
- m4-IT7 — Promote-Skript `--password` über Shell-History; Stdin-Read-Mode + WARN-Block ergänzen. Routing: `solution-architect` + `backend-engineer`.
- m5-IT7 — `AUTH_SECRET` vs. `NEXTAUTH_SECRET` Aliasing-Transparenz; Diagnose-Endpoint liefert `secret_source`. Routing: `solution-architect`.
- m6-IT7 — Manueller OAuth-Sign-Off-Schritt (T-M1) Tom + Engineer mit Screenshot in PR. Routing: `solution-architect` + `project-manager`.

**Re-Verify-Outcome:** Kein Re-Review nötig. Build kann starten. m1–m6-IT7 in Build-Phase einarbeiten; Smoke-Tests in Phase 4 verifizieren.

---

### IT8 — Bug-Fix-Iteration: Admin-Crash, Calendar, Slot-Save, DayOverride-Liste, OAuth-Diagnose

- **Verdict:** Approved with concerns — go für Phase 3
- **Loop:** Nein. 4 Major-Concerns sind Spec-Lücken, in Build-Tickets aufnehmbar.

**Top-Level:** Alle 5 Root-Cause-Analysen via Code-Inspektion verifiziert. Fix-Strategien adressieren volle ACs.

**Major (alle erhalten):**

- **BUG-IT8-01-A (Major)** — US-IT8-01. Server-`internalError`-Pfad nicht in Test-Hooks; Engineer könnte Banner-Pfad fälschlich als Error-Boundary-Verantwortung sehen. Routing: `solution-architect` (Doku) / Build-Engineer (Test).
- **BUG-IT8-02-A (Major)** — US-IT8-02. De-Duplizierungs-Strategie für initialen Calendar-Fetch unspezifiziert; `useRef` + AbortController verbindlich gefordert. Routing: `solution-architect`.
- **BUG-IT8-03-A (Major)** — US-IT8-03. Public-View-Regression-Risiko bei Variante A; Empfehlung Variante B alleinstehend (FE übergibt explizit `from`). Routing: `solution-architect` + `backend-engineer`.
- **BUG-IT8-05-A (Major)** — US-IT8-05. `actionRequired`-Mapping inkonsistent: ENV-Var-Checks müssen IMMER `"config"` (nicht `"code"`) sein. Routing: `solution-architect`.

**Minor (kompakt):**

- BUG-IT8-01-B/-C — Konsumenten-Audit + Error-Boundary-Limitation dokumentieren.
- BUG-IT8-02-B — AC4 (CSS-Asset HTTP 200) trivial erfüllt.
- BUG-IT8-03-B/-C — AC4 Test-Hook + `endsAt`-Filter erwähnen.
- BUG-IT8-04-A/-B — Optimistic-Update + 365-Cap-Truncated-Banner.
- BUG-IT8-05-B — `verdict.summary` als erstes Feld im JSON-Response.
- §6.3 — Smoke-Tests pro Story als verbindlich speccen.

**Re-Verify-Outcome:** Phase 3 starten. 4 Punkte als Build-Tickets übergeben. Architekt kann §5.3-Tabelle und §3.2-Empfehlung parallel zum Build-Start in 5–10 min nachschärfen.

---

### IT9 — `/admin/users`-Crash, Customer-Adresse, Buchungs-Kalender, OAuth-Setup-Guide

- **Verdict:** Approved with concerns
- **Loop:** Nein. Major-Punkte sind Engineer-Hygiene, nicht Re-Architecting.

**Major (alle erhalten):**

- **MAJOR-IT9-02-A** — Migration auf Production-Daten gegen Turso-Branch testen vor Prod. Routing: `solution-architect` + `backend-engineer`.
- **MAJOR-IT9-02-B** — `CustomerLoginResponseSchema` extends Public; Login-Response inkl. neuer Adressfelder muss durch `toCustomerPublic` mit `?? null` belegt sein, sonst Login-Crash. Routing: `backend-engineer`.
- **MAJOR-IT9-02-C** — `oauth-finalize` und Register-Response: alle `toCustomerPublic`-Aufrufer müssen `selectCustomerUserPublic` zwingend nutzen. Routing: `backend-engineer`.
- **MAJOR-IT9-02-D** — Schema-Pflicht-Felder vs. Mapper: `nullable()` aber required → Engineer prüft Tests/scripts auf Mock-Konstruktionen. Routing: `backend-engineer`.
- **MAJOR-IT9-02-E** — Naming-Kollision Doku ↔ Story (`addressStreet/addressZip/addressCity` vs `streetAndNumber/postalCode/city`). Routing: `backend-engineer` + `frontend-engineer`.
- **MAJOR-IT9-02-F** — DTO-Leak-Test (`scripts/check-dto-leaks.ts`) auf neue Felder erweitern. Routing: `backend-engineer`.
- **MAJOR-IT9-03-A** — Helper-Name-Drift: `computeInitialMonthRangeBerlin()` vs IT8-`computeInitialRangeBerlin()`; neuer File `src/lib/date-helpers.ts`. Routing: `solution-architect`.
- **MAJOR-IT9-03-B/C/D** — Initial-View für `mode='customer'`, `useRef`-Dedup-Pattern aus IT8 wiederverwenden, AC4 Empty-State (TimeSlotPicker). Routing: `solution-architect` + `frontend-engineer`.
- **MAJOR-IT9-04-A** — Redirect-URI-Pfad gegen `/api/auth/diagnose` verifizieren VOR Veröffentlichung des Guides. Routing: `backend-engineer`.
- **MAJOR-IT9-04-B/C** — `localhost`-Eintrag im Production-Guide markieren, OAuth-Consent-„VERÖFFENTLICHEN"-Risiko (kein App-Review für Standard-Scopes) prominent. Routing: `solution-architect`.

**Minor (kompakt):**

- MINOR-IT9-01-A/-B/-C/-D — Empty-State-Wortlaut-Drift, AC4 Status-Spalte unklar, Defensive Guard Pflicht statt Empfehlung, Vertragstest Pflicht.
- MINOR-IT9-02-G/-H/-I — Lösch-UX still, Profil-Adresse-Vollständigkeit-Check, kombinierter Update-Test.
- MINOR-IT9-03-E/-F — Fehlerpfad-Wortlaut, `loadDays`-Dependency in `useEffect` mit `useCallback([])`.
- MINOR-IT9-04-D/-E/-F — Domain-Verifizierung, `AUTH_DIAGNOSE_ENABLED`-Lifecycle Pflicht entfernen, Tom liest Guide-Entwurf.

**Re-Verify-Outcome:** Build kann starten. Engineers adressieren MAJOR-Punkte vor Merge. MINOR-Punkte in PRs oder Backlog.

---

### IT10 — Bug-Fix-Iteration: Reset-Mail, Admin-User-List, Booking-POST + Quick-Booking-Modal + Customer-Self-Service

- **Verdict:** Go-mit-Auflagen
- **Loop:** Nein. Spec-Updates müssen vor Build-Start adressiert werden.

**Critical / Major (alle erhalten):**

- **STRUCT-1 (Major) — Migrations-Drift-Strukturschwäche.** `internalError()` mappt alle BE-Fehler auf generische 500 ohne Prisma-Error-Code im Log. Fix-Vorschlag: `x-error-prisma-code`-Header + strukturierte Log-Zeile. Routing: `solution-architect` + `backend-engineer`.
- **STRUCT-2 (Major→PM) — Engineer-Zugriff auf Prod-Logs/Turso unklar.** Build-Blocker, vor Engineer-Hand-off klären. Routing: `project-manager`.
- **STRUCT-3 (Major) — Contract-Drift Slot-Konflikt-Code FE↔BE.** `BOOKING_SLOT_TAKEN` existiert nicht im Backend (`CONFLICT`/`OVERLAP`). Fix Variante A: Subcode `BOOKING_SLOT_TAKEN` im Backend + im UX-Spec. Routing: `solution-architect`.
- **STRUCT-4 (Major) — Modal-Trigger ohne Service-Vorauswahl unspezifiziert.** Vorbedingung „Service muss gewählt sein" + Verhalten bei kein-Service speccen. Routing: `solution-architect` + `ux-designer`.
- **STRUCT-5 (Minor→Major) — Anonyme Vor-Account-Buchungen werden nicht im Self-Service abgedeckt.** PM-Klärung Backfill (Variante A/B) oder Scope-Cut (Variante C). Routing: `project-manager` + `solution-architect`.
- **UX-1 — Pagination fehlt für `/admin/users` und `/konto`-Anfragen.** Routing: `ux-designer` + `solution-architect`.
- **UX-2 — Status `COMPLETED` ist kein Badge-Variant in der UX-Spec.** 6. Variante ergänzen (Component-Library + Design-System). Routing: `ux-designer`.
- **PM-1/2/3** — `MAIL_FROM` vs `RESEND_FROM_EMAIL`, Modal-Tiefen-Verlinkung, Storno-Funktion-Scope für US-IT10-05. Routing: `project-manager`.

**Re-Verify-Outcome:** Phase 3 starten nach Spec-Updates und PM-Klärungen. Engineer-Disziplin: Pflicht-Schritt 1 = `prisma migrate status` vor Code-Change.

---

### IT11 — Buchung-E2E, Modal-Konsolidierung, Bestätigung+Token, Datei-Upload, Profil-Vorausfüllung, Storno

- **Verdict:** **Needs Fixes — 4 Critical Blocker + 9 Major.** Konzeptionell solide, aber harte Spec-Konflikte.
- **Loop:** **Ja**, Loop an `solution-architect` + `ux-designer`.

**Critical (alle erhalten):**

- **BUG-CRITICAL-01 (US-IT11-03) — Bestätigungsseiten-Routing widerspricht sich.** Architecture/FE-Req: `/buchung/bestaetigt?id=&token=`. UX-Spec/Component-Lib: `/buchung/bestaetigung/[bookingId]?token=`. Empfehlung: UX-Variante. Routing: `solution-architect` + `ux-designer`.
- **BUG-CRITICAL-02 (US-IT11-06) — Storno-Page-Routing widerspricht sich.** `?id=` Query vs Path-Param. Empfehlung: UX-Variante (RESTful). Routing: `solution-architect`.
- **BUG-CRITICAL-03 (US-IT11-06) — Phantom-Endpoint `GET /api/bookings/{id}/cancel-preview`.** Wiederverwendung des bestehenden `public-summary`. Routing: `ux-designer` + `solution-architect`.
- **BUG-CRITICAL-04 (US-IT11-06) — Storno-Token-Lifecycle Edge-Case fehlt.** State `frist-abgelaufen` (200 OK Preview, 409 Submit) ergänzen. Routing: `ux-designer`.

**Major (kompakt):**

- BUG-MAJOR-01 — `cancelledBy`-Enum-Drift `'GUEST_TOKEN'` vs `'CUSTOMER'`. Routing: `solution-architect` + `ux-designer`.
- BUG-MAJOR-02 — TimeSlot-Race Cancel+Book: optimistisch mit klarem 409. Routing: `solution-architect`.
- BUG-MAJOR-03 — Doppel-Submit-Schutz für `POST /api/bookings`: optimistic Dedup `(customerEmail, slotId, createdAt within 60s)`. Routing: `solution-architect`.
- BUG-MAJOR-04 — Resend-Sandbox-Modus-Übergang nicht im Akzeptanztest. Routing: `solution-architect` + `project-manager`.
- BUG-MAJOR-05 — Datei-Upload-Edge-Cases (0-Byte, MIME-Spoof, korruptes Video, paralleler Upload). Routing: `solution-architect`.
- BUG-MAJOR-06 — Lightbox-Spec widerspricht „Backlog IT12". Tom-Entscheidung. Routing: `project-manager` + `ux-designer`.
- BUG-MAJOR-07 — Profil-Vorausfüllung: Edit-Dann-Schließen → Modal frisch laden. Routing: `ux-designer`.
- BUG-MAJOR-08 — Storno-Token-Re-Verbrauch durch Mail-Provider-Scanner; POST nie via GET. Routing: `solution-architect`.
- BUG-MAJOR-09 — `BookingDialogProvider`-State-Reset nach Submit. Routing: `solution-architect` / `ux-designer`.

**Minor:** Telefon-Format, Microcopy-Drift, A11y-Tab-Order, Toaster-Position.

**Verdict-Reasoning:** US-IT11-01/02/05 direkt go-ahead. US-IT11-03/04/06 nach Spec-Update. **Nicht zur Implementierung vor Resolution.**

---

### IT12 — OAuth-Fix, Service-Bilder, Kalender-Performance, Konto-aus-Buchung, Marketing-Mailer + 9 Bug-Fixes

- **Verdict:** **Needs Revision before Build** — 8 Critical + 12 Major.
- **Loop:** **Ja**, Loop an `solution-architect` + `ux-designer` + `project-manager`.

**Critical (alle erhalten):**

- **C1 (S01) — `.env.production` enthält FALSCHEN `NEXTAUTH_URL` (ohne `www.`).** Repo-Bestätigung der Hypothese. Vercel-Env korrigieren + Repo-File synchronisieren. Routing: `backend-engineer` / DevOps.
- **C2 (S02) — Service-Slug-Mismatch UX-Spec vs Codebase.** Codebase: `entruempelung`/`entkernung`/`reinigung`/`gruenflaechenpflege`/`muelltonnenservice`/`entsorgung`. UX-Spec: Plural+Suffixe. Architecture stimmt mit Code überein, UX-Spec nicht. Routing: `ux-designer` + `solution-architect`.
- **C3 (S02) — Routen-Mismatch UX `/leistungen/[slug]` vs Codebase `/services/[slug]`.** Routing: `ux-designer`.
- **C4 (S05) — Endpoint-Konflikt Konto-aus-Buchung.** UX/component-lib: `POST /api/auth/customer/register`. Backend/OpenAPI: `/api/customer/register-from-booking` mit `confirmationToken`. Architect-Spec gewinnt (Token-Schutz DSGVO/Security). Routing: `solution-architect` + `ux-designer`.
- **C5 (S05) — 409-Subcode-Naming-Konflikt `EMAIL_EXISTS` vs `ACCOUNT_EXISTS`.** Auf `ACCOUNT_EXISTS` standardisieren. Routing: `solution-architect`.
- **C6 (S15) — Marketing-Mail Endpoint-Pfade weichen UX↔Backend komplett ab.** Backend-Spec gewinnt. Test-Send + History entscheiden. Routing: `solution-architect` + `ux-designer`.
- **C7 (S15) — DSGVO-Lücke: Werbe-Einwilligungs-Modell fehlt.** UWG §7 Abs. 3 Risiko. `customer_marketing_preferences.consentGivenAt`/`consentSource`/`consentText` ergänzen oder Scope auf transaktionale Reminder reduzieren. Routing: Stakeholder (Tom) + `solution-architect`.
- **C8 (S15) — Test-Send-Endpoint nicht im Backend-Vertrag.** Variante A: `POST /api/admin/marketing/email/test`. Routing: `solution-architect`.

**Major (kompakt):**

- M1 — Kein konkretes p95-Performance-Ziel für Kalender-Endpoint (`< 1.5s` Story-AC vs `< 300ms` Backend). Routing: `solution-architect`.
- M2 — Indexe auf prod nicht verifiziert (`prisma migrate status` + `\d bookings`). Routing: `backend-engineer`.
- M3 — `confirmationToken` nicht in Story-AC erwähnt. Routing: `project-manager`.
- M4 — Konkurrierende Sync-Pattern `useSession().update()` vs eigener `customer-sync.ts`-EventBus. Customer-Bereich nutzt Custom-JWT-Cookie, kein NextAuth-`useSession()`. UX-Spec auf den korrekten Pattern korrigieren. Routing: `ux-designer` + `solution-architect`.
- M5 — Profil-Feld-Naming `street` vs `streetAndNumber`. Routing: `ux-designer`.
- M6 — Root-Cause für S09 Scroll-Jump nicht bestätigt; Frontend-Engineer 1h zur Repro. Routing: `frontend-engineer`.
- M7 — Status-Code-Mismatch UX vs Backend (502 vs 503 vs 500 INTERNAL_ERROR). Routing: `solution-architect`.
- M8 — Idempotency-Key fehlt für Booking-Submit (`Idempotency-Key`-Header). Routing: `solution-architect`.
- M9 — „Bewertungen"-Duplikat-Quelle nicht im Code identifiziert. Routing: `solution-architect`.
- M10 — Backwards-Compat-Routen (308-Redirect für Bookmarks). Routing: `solution-architect`.
- M11 — Rate-Limit Marketing-Send vs Resend-Free-Tier (100/Tag). Stakeholder-Plan-Tier. Routing: `project-manager`.
- M12 — Async-Send-Failure-Recovery (Vercel-Function-Timeout 10s/60s). Resume-fähig via `MarketingEmailRecipient.PENDING`. Routing: `solution-architect`.

**Minor:** Mn1–Mn9 — Umlaute in Bilddateinamen, Cypress pro Slug, Skeleton-Min-Anzeigedauer 250 ms, Mobile-Bottom-Sheet, sessionStorage-Naming, Dropdown-Menü, Char-Counter 5000, Welcome-Hint localStorage, Footer-Unsubscribe-Microcopy.

**Open Questions an Tom (7):** DSGVO/Werbe-Einwilligung, Resend-Tier, Vercel-Plan, Marketing-Historie Scope, Pause-Funktion, Test-Send-Empfänger, Bewertungs-Duplikat-Quelle.

**Verdict-Reasoning:** 4 Stories haben Build-Blocker (S02, S05, S15, S01-DevOps). Build kann nicht starten ohne C1-C8-Resolution. M1-M12 sollten ebenfalls vor Build geklärt werden.

---

**Ende konsolidiertes Design-Review IT6–IT12.**
