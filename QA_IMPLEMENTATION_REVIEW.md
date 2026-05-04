# QA Implementation Review — Konsolidiert (Stand IT12, 2026-05-04)

Reviewer: qa-engineer
Konsolidiert aus: QA_IMPLEMENTATION_REVIEW_IT2.md … QA_IMPLEMENTATION_REVIEW_IT12.md
Methode: Statische Code-Analyse + `tsc --noEmit` + `npm run build`/`next build` + `npm test` + `npm run lint` + cURL-Smoke-Tests, je nach Iteration ergänzt durch Schema-/Vertrags-Diff und Live-Smoke gegen `localhost:3000`.

---

## Übersicht aller Iterationen

| Iteration | Datum | Verdict | tsc | build | tests | Critical | Major | Minor | Loops nötig? |
|-----------|-------|---------|-----|-------|-------|----------|-------|-------|--------------|
| IT2 | 2026-05-02 | Ready (mit minor follow-ups) | PASS | PASS | n/a (Smoke) | 0 | 0 | 4 | Nein |
| IT3 | 2026-05-02 | Ready (mit 2 kosmetischen Findings) | PASS | PASS | n/a (Smoke) | 0 | 0 | 4 | Nein |
| IT4 | 2026-05-02 | Approved with Fixes | PASS | PASS | grün | 0 | 1 (BUG-IT4-QA-001 Verify-Redirect-Param) | 3 | Nein |
| IT5 | 2026-05-02 | Done | PASS | PASS | grün | 0 | 0 | 4 (pre-existing) | Nein |
| IT6 | 2026-05-03 | Bedingt-DONE → DONE (Final-Pass) | PASS | n/a | 171/171 (+2 SKIP) | 0 | 2 (D1, D2) | 2 (D3, D4) | Ja — 1 Loop, alle 4 Defekte behoben |
| IT7 | 2026-05-03 | Done (m6-IT7 = Tom-Aktion) | PASS | n/a | 181/181 | 0 | 0 | 2 (D1-IT7, D2-IT7) | Nein |
| IT8 | 2026-05-03 | Done — Production-deploybar | PASS | n/a | 181/181 + 32/32 Diagnose | 0 | 0 | 0 | Nein |
| IT9 | 2026-05-03 | Done | PASS | n/a | 181/181 | 0 | 0 | 3 | Nein |
| IT10 | 2026-05-03 | Done — Go Live (mit DevOps-Auflagen) | PASS | n/a | 181/181 + 24/24 IT10 | 0 | 0 | 0 | Nein |
| IT11 | 2026-05-04 | Done (Code) — wartet auf Tom-Smoke | PASS | PASS | 181/181 + 33/33 IT11 | 0 | 0 | 4 | Nein |
| IT12 | 2026-05-04 | BLOCKED → APPROVED with caveats (nach Re-Verify) | PASS | PASS | 19/19 → 20/20 IT12 | 1 (BUG-001 BLOCKER) | 3 (BUG-002,-003,-004) | 6 FIND + 2 Caveats | **Ja** — 1 Loop, alle Critical/Major resolved |

---

## Wiederkehrende Patterns / Lessons Learned

### 1. Migrations-Drift `P2022` als wiederkehrende Bug-Klasse

- IT8: BUG-IT8-01 — Admin-Verwaltungs-Crash durch Envelope-Mismatch.
- IT9: US-IT9-01 — `/admin/users` Crash, exakt gleiches Schema-Drift-Pattern wie IT8-01.
- IT10: STRUCT-1 — `internalError()` Logging-Härtung, damit künftige Migrations-Drifts sichtbar werden.
- IT12: S06/S12/S13 — alle drei Bug-Stories ziehen sich auf `prisma migrate deploy` zurück (nicht Code-Bug).

**Lesson:** Vor jedem PR auf Bug-Endpoints: `prisma migrate status` gegen Prod ist Pflicht-Schritt 1. Im PR-Body dokumentieren.

### 2. Defense-in-Depth bei Schema-Drift

- IT8/IT9/IT12: `Array.isArray`-Guard in API-Client + erneuter Guard in der Komponente + Error-Boundary im Layout-Segment.

**Lesson:** Belt-and-suspenders ist verbindliches Pattern für jede Liste/Tabellen-Komponente.

### 3. Conditional UPDATE für Race-Mitigation

- IT6: `disableAdminSafely` als Vorbild.
- IT7: `password_reset_tokens` Conditional UPDATE (m2-IT7).
- IT8: `lastRangeRef` + AbortController für Calendar-Race.
- IT11: BookingConflict mit atomarem Cancel-Update + 60s-Window-Dedup.
- IT12: Idempotency-Key (S11).

### 4. Microcopy / Wortlaut-Drift

- IT3: US-22 AC-2 Schnitt 4,0 vs 4,6 (Test-Daten).
- IT4: BUG-IT4-QA-001 Verify-Redirect-Param `?verified=1` vs `?verified=true`.
- IT9: MINOR-IT9-01-A „Noch keine Kunden" vs „Keine Kunden".
- IT11: NBSP in Telefonnummern verifiziert (`0157 74787512`).

**Lesson:** Story-Wortlaut für UI-Strings ist verbindlich, Engineer übernimmt 1:1.

### 5. ESLint-Config-Drift / Edge-Runtime-Warnings (technische Schulden)

- IT2: MIN-001 ESLint-Plugin-Init-Fehler (`Converting circular structure to JSON`).
- IT3/IT4/IT5: gleicher Befund.
- IT4: BUG-IT4-QA-003 `jose`/`CompressionStream`-Warning persistent — Workaround: Sub-Path-Imports.

**Lesson:** Tech-Debt-Story am Anfang einer Iteration einplanen, sonst eskaliert Lint-Drift.

### 6. Operative DevOps-Aktionen (Tom)

- IT4: Resend-API-Key, ENV-Konfig.
- IT10: 5 operative Aufgaben (`MAIL_FROM`, Resend-Domain, migrate deploy, Vercel-ENV).
- IT11: 12-Schritte-Smoke + `BOOKING_TOKEN_SECRET`.
- IT12: Phase-1 (NEXTAUTH_URL, Google-Cloud-Console-Redirect-URI, Migrationen, BLOB_READ_WRITE_TOKEN, UNSUBSCRIBE_TOKEN_SECRET, MAIL_FROM).

**Lesson:** Code-Verdict ≠ Production-Ready. Tom-Smoke-Schritte sind Sign-Off-Kriterium.

### 7. Tests-Suite wächst, Hygiene bleibt grün

- IT6: 171/171 Tests + DTO-Leak-Scanner.
- IT7: 181/181 Tests + IT7-Suiten.
- IT8: 181/181 + 32/32 Diagnose-Tests.
- IT10: 181/181 + 24/24 IT10-Tests.
- IT11: 181/181 + 33/33 IT11-Tests.
- IT12: 19/19 → 20/20 IT12-Tests (+1 Bestandskunden-Filter).

**Lesson:** Pro Iteration eigener Test-Block + Smoke-Suite-Erhalt. Skips müssen explizit mit Begründung dokumentiert sein.

---

## Per Iteration

### IT2 — BUG US-04, US-13/14/15/16 (Counter-Proposal, Storno, Wochentag-Verfügbarkeit, Kunden-Kalender)

- **Verdict:** Ready (mit minor follow-ups)
- **Build:** tsc PASS, build PASS, Migrate Deploy PASS, alle 13 API-Routen vorhanden.
- **Smoke (Live-Dev):** 6/6 Tests PASS (Verfügbarkeit, Kalender, Booking-Validation, Auth-Schutz, Token-Action-Redirect).

**Story-Verdicts:**

| Story | Verdict | Bemerkung |
|-------|---------|-----------|
| BUG US-04 | DONE | 201 auch bei Mail-Failure, Placeholder-Resend-Key gefiltert, customerEmail Pflichtfeld |
| US-13 | DONE | Counter-Proposal-Flow, drei Action-Buttons, Slot-Locking COUNTER_PROPOSED aktiv |
| US-14 | DONE | Customer-Storno via cancelToken, Tom-Mail mit allen Daten |
| US-15 | DONE | 7-Wochentage-Toggle, COCONFIRMED-Booking als Blocker, sofortiges Re-Render |
| US-16 | DONE | Monatsansicht Grün/Rot, Klick auf Tag, Vergangenheit blockiert, mobile-friendly |

**Critical/Major:** Keine.

**Minor (alle erhalten):**

- MIN-001 — ESLint im `next build` schlägt mit Circular-Reference fehl (non-blocking). Routing: `frontend-engineer`.
- MIN-002 — `npm run build` lädt `.env.local` nicht für Prisma-CLI. Routing: `solution-architect` / `backend-engineer`.
- MIN-003 — `Calendar.goNext` Hard-Cap-Logik undurchsichtig (Modulo-Formel statt Backend-Konstante). Routing: `frontend-engineer`.
- MIN-004 — ARIA-Rollen-Verschachtelung in `Calendar.tsx` (`<button role="gridcell">`). Routing: `frontend-engineer`.

**Re-Verify-Outcome:** Iteration 2 als abgeschlossen markiert. Minor-Defekte als Tech-Debt für IT3.

---

### IT3 — BUG IT3, US-17/18/19/20/21/22/23/24

- **Verdict:** Ready (mit zwei kosmetischen Findings)
- **Build:** tsc PASS, build PASS (14 Routen).

**Story-Verdicts:**

| Story | Verdict | Bemerkung |
|-------|---------|-----------|
| BUG IT3 | DONE | slotId nicht mehr via register() gebunden, 201 bei Mail-Fehler |
| US-17 | DONE | Default-Vorlage Mo-Fr 08-17, AvailabilityTemplate-Seed 7 Einträge, TimeSlotPicker |
| US-18 | DONE (mit MIN-002) | File-Upload Bilder/Videos/PDFs, 20MB-Limit, Anhänge im Admin |
| US-19 | DONE | „Sonstiges" als letzter Service, ≥30 Zeichen-Validation deutsch |
| US-20 | DONE | Alle 7 Preise korrekt, Disclaimer „Endpreise nach individueller Besichtigung" |
| US-21 | DONE | Upcoming-Bookings-List sortiert, „Heute"-Badge |
| US-22 | DONE (mit DEF-001 + MIN-001) | 10 Bewertungen, Schnitt 4,6 vs Spec 4,0 |
| US-23 | DONE | Service-Popups mit ESC/Backdrop, Focus-Trap, Body-Scroll-Lock |
| US-24 | DONE | Bestätigungs-/Storno-/Reject-Mails an Kunden, Berlin-TZ |

**Critical/Major:** Keine.

**Minor (alle erhalten):**

- DEF-001 — US-22 AC-3 „Mehr anzeigen"-Button fehlt. Routing: `frontend-engineer`.
- MIN-001 — US-22 AC-2 Schnitt 4,6 statt 4,0; PM-Klärung. Routing: `project-manager`.
- MIN-002 — US-18 BLOB_NOT_CONFIGURED-Code-Mismatch (Server `INTERNAL_ERROR` vs Client erwartet `BLOB_NOT_CONFIGURED`). Routing: `backend-engineer`.
- MIN-003 — US-21 AC-3 Klick auf Termin → Detailseite fehlt (keine separate Route). Routing: `project-manager`.
- MIN-004 — ESLint-Plugin-Init-Fehler. Routing: `backend-engineer`.

**Re-Verify-Outcome:** Loop zurück an `frontend-engineer` für DEF-001, parallel `project-manager` für MIN-001.

---

### IT4 — US-25 bis US-29 (Kunden-Auth, Auftragsübersicht, Storno-Portal, Stripe, Reviews)

- **Verdict:** Approved with Fixes
- **Build:** tsc PASS, build PASS (25/25 Static Pages).

**Story-Verdicts:**

| Story | Verdict | Bemerkung |
|-------|---------|-----------|
| US-25 | DONE (mit MAJOR-Bug) | Register/Login/Verify, BUG-401-Fix `verificationTokenExpiry`, BUG-402-Fix `.strict()` ohne email |
| US-26 | DONE | `GET /api/customer/bookings` upcoming/past, isCancellable mit DST-Schutz |
| US-27 | DONE | Customer-Storno-Portal mit Frist-Check |
| US-28 | DONE | Stripe-Session + Idempotenz + Webhook + raw-body-Verify |
| US-29 | DONE | Reviews POST mit COMPLETED-Check + Ownership, Admin-PATCH Idempotenz |

**Critical/Major:**

- **BUG-IT4-QA-001 (Major)** — US-25 AC. Verify-Redirect-Param-Mismatch: Backend `?verified=true`, Spec `?verified=1`. Verify-Success-Banner zeigt sich nicht auf `/konto`. Routing: `backend-engineer`.

**Minor:**

- BUG-IT4-QA-002 — `verify-email`-Alias-Endpoint mit `DYNAMIC_SERVER_USAGE`-Warning. Routing: `backend-engineer`.
- BUG-IT4-QA-003 — `jose`-Edge-Runtime-Warnings (`CompressionStream`); Workaround Sub-Path-Imports. Routing: `backend-engineer`.
- BUG-IT4-QA-004 — ESLint-Config (`Converting circular structure to JSON`). Routing: `backend-engineer`.

**Re-Verify-Outcome:** Patch BUG-IT4-QA-001 (one-line), dann DONE. MINOR-Issues in IT5-Backlog.

---

### IT5 — US-30 bis US-34 (Admin-Pwd-Reset, OAuth-Customer, Adressfeld, Buchungsdauer, Buffer-Zeit)

- **Verdict:** Done
- **Build:** tsc PASS, build PASS (Exit 0, alle 30 Static Pages, 8 IT5-Routen sichtbar).

**Story-Verdicts:**

| Story | Verdict | Bemerkung |
|-------|---------|-----------|
| US-30 | DONE | Forgot/Reset-UI mit Loading + Erfolgs-Banner + 3s-Countdown, `adminBaseUrl()`-Fallback-Kette, Public-Routes in Middleware |
| US-31 | DONE | Feature-Flag, OAuth-Buttons Login+Register, eigene NextAuth-Customer-Instanz, BUG-IT5-004 Hijacking-Schutz, Cookie-Trennung |
| US-32 | DONE | Adress-Pflichtfelder + 5-Stellen-PLZ-Regex + DB-Persistenz |
| US-33 | DONE | DurationPicker 1h-8h + Preisschätzung, Serializable-Transaktion in `booking-create.ts` |
| US-34 | DONE | Buffer-Config 0/15/30/45/60, Default 30, defense-in-depth (Slot-Anzeige + Insert-Pfad) |

**Critical/Major:** Keine.

**Sicherheits-Bewertung IT5:** Alle 7 Bereiche (Account-Linking, Cookie-Trennung, Open-Redirect, Race-Conditions, User-Enumeration, Token-Lifecycle, Admin-Schutz) sauber.

**Minor (offene Punkte, nicht-blockierend):**

- US-33 AC1 — „Ganztag"-Kachel nicht explizit in UI. Routing: `frontend-engineer`.
- US-34 AC5 — Buffer-Bereich nicht visuell als grauer Block im Admin-Kalender. Routing: `frontend-engineer`.
- Pre-existing Build-Warnung `aria-pressed` auf `gridcell` in `Calendar.tsx`. Routing: `frontend-engineer`.
- Pre-existing IT4-Verhalten `DYNAMIC_SERVER_USAGE` in `verify-email`. Routing: `backend-engineer`.

**Re-Verify-Outcome:** Iteration 5 als DONE markiert. Polish-Punkte als Backlog.

---

### IT6 — US-IT6-01 bis US-IT6-09 (Multi-Admin, Kalender, Reviews, SEO, Auth-Bereinigung, Wipe, Customer-Userverwaltung, Final-Preis, Analytics)

- **Verdict:** Bedingt-DONE → **DONE (Final Verification Pass)**
- **Build:** tsc 0, lint 0, npm test 171/171 + 2 SKIP, DTO-Leak-Scanner OK, Migration `20260503083723_iteration_6` OK.

**Story-Verdicts pro Story:** 9/9 DONE.

**Critical/Major (alle erhalten):**

- **D1 (Major) — US-IT6-04 — Sitemap referenziert nicht-existente Service-Detail-Pages.** Lighthouse-SEO + Google-Indexierung leiden. Routing: `frontend-engineer` (Service-Detail-Page anlegen) ODER `solution-architect` (Sitemap-Einträge raus). **RESOLVED** — `src/app/services/[slug]/page.tsx` mit `generateStaticParams()` für 6 Slugs angelegt, `dynamicParams = false`, JSON-LD + Canonical.
- **D2 (Major) — US-IT6-01 — DISABLED-Admin kann Page-Shells öffnen.** Page-Components prüfen nur `session?.user`, nicht `User.status === 'ACTIVE'`. AC verletzt. Routing: `backend-engineer` + `frontend-engineer`. **RESOLVED** — Helper `requireActiveAdmin()` in `src/lib/require-admin.ts` redirected bei `status !== 'ACTIVE'` zu `/admin/login?error=account_disabled`. Alle 6 Admin-Pages migriert.

**Minor:**

- D3 — US-IT6-05 — Legacy-Auth-Endpoints liefern 410 statt 404. Routing: `solution-architect` / `backend-engineer`. **RESOLVED** — Verzeichnisse gelöscht; Next.js liefert nativ 404.
- D4 — US-IT6-06 — `reset-users.ts` ohne `--dry-run` und ohne NODE_ENV-Production-Guard. Routing: `backend-engineer`. **RESOLVED** — `--dry-run`-Flag, Production-Guard `CONFIRM_PRODUCTION_WIPE=true`, 5-Sekunden-Countdown vor real-Run.

**Sicherheits-Sign-Off:** F1, F2, F3 alle PASS. CI-Test-Suiten für DTO-Leak grün.

**Re-Verify-Outcome (Final Pass):** Alle 4 Defekte resolved. Hygiene komplett grün, F1/F2/F3-Garantien unverändert in place. **Iteration 6 ist DONE — go-live freigegeben.**

---

### IT7 — US-IT7-01 bis US-IT7-05 (Email/Pwd-Reversion, Google+Facebook OAuth, Promote-Skript, Reset-Flow)

- **Verdict:** DONE (kein Re-Loop nötig); m6-IT7 = Tom-Aktion bleibt offen
- **Build:** tsc PASS, lint 0, npm test 181/181, DTO-Leak-Scanner OK, Migration Plan A + Plan B vorhanden.

**Story-Verdicts:** 5/5 DONE (US-IT7-02/03 Code-DONE — manueller Sign-Off durch Tom).

**Critical/Major:** Keine.

**IT6-Regression:** F1, F2, F3 alle aktiv und um IT7-Felder (`passwordHash`, `verificationToken`, `verificationTokenExpiry`, `oauthId`) erweitert. Tests grün.

**m-Findings-Auflagen-Status:**

- m1-IT7 (Latency-Floor 750ms) — PASS
- m2-IT7 (Conditional UPDATE Reset) — PASS
- m3-IT7 (Migration Plan B) — PASS
- m4-IT7 (Stdin Pwd / History-Warning) — PASS
- m5-IT7 (`secret_source` Aliasing) — PASS
- m6-IT7 (Tom-OAuth-Sign-Off) — TOM-AKTION (Orchestrator-Termin)

**Minor (Cosmetic, nicht-blockierend):**

- D1-IT7 — `customerLoginLimiter` 15min/10 (strenger als Spec 1h/10). Routing: `solution-architect` (Doku) / `backend-engineer`.
- D2-IT7 — Schema `User.resetToken` bleibt für Admin-Reset-Flow erhalten (kein Defekt, Doku-Hinweis). Routing: `solution-architect`.

**Re-Verify-Outcome:** Iteration 7 als DONE markiert. Tom-Sign-Off-Termin einplanen für US-IT7-02/03 OAuth.

---

### IT8 — US-IT8-01 bis US-IT8-05 (Admin-Crash, Calendar, Slot-Save, DayOverride-Liste, OAuth-Diagnose)

- **Verdict:** DONE — Production-deploybar
- **Build:** tsc 0, npm run test:diagnose 32/32, npm test 181/181 + 0 Fails.

**Story-Verdicts:** 5/5 DONE.

**Critical/Major:** Keine.

**Verifikation der QA-Design-Major-Concerns:**

- BUG-IT8-01-A (Envelope-Mismatch + Defense-in-Depth) — Backend `apiSuccess(array)`, FE `Array.isArray`-Guard, Konsumenten-Audit grün.
- BUG-IT8-02-A (`useRef` + AbortController) — `lastRangeRef`/`abortRef`/`mountedRef` vollständig umgesetzt.
- BUG-IT8-03-A (Public-View kein Regression) — Server-Verzweigung auf `auth()` + FE übergibt explizit `from`.
- BUG-IT8-05-A (alle ENV-Var-Checks `actionRequired: 'config'`) — 14/14 Checks korrekt; Test verifiziert.

**Live-Browser-Smoke (NICHT im Sandbox testbar):** 7-Schritte-Checkliste für Tom auf Vercel-Preview.

**Re-Verify-Outcome:** Phase 4 starten (Production-Deploy zu Vercel-Preview). Kein weiterer Build-Loop erforderlich.

---

### IT9 — US-IT9-01 bis US-IT9-04 (`/admin/users`-Crash, Customer-Adresse, Buchungs-Kalender, Google-OAuth-Setup-Guide)

- **Verdict:** DONE
- **Build:** tsc clean, npm test 181/181.

**Story-Verdicts:** 4/4 DONE.

**Critical/Major:** Keine.

**Verifikation der QA-Design-Major-Concerns:**

- MAJOR-IT9-02-A (Migration sicher, additive ALTER COLUMN) — bestätigt.
- MAJOR-IT9-02-B (CustomerLoginResponseSchema robust) — bestätigt; Mapper mit `?? null`.
- MAJOR-IT9-02-C (alle `toCustomerPublic`-Aufrufer via `selectCustomerUserPublic`) — bestätigt.
- MAJOR-IT9-02-D (Schema-Pflicht-Felder vs. Mapper) — bestätigt.
- MAJOR-IT9-03-A (Helper-Name `computeInitialMonthRangeBerlin()` als neue Datei `src/lib/calendar-range.ts`) — bestätigt; kein Refactor des IT8-Helpers.
- MAJOR-IT9-04-A (Redirect-URI-Pfad gegen Diagnose-Endpoint) — bestätigt; 1:1-Match.

**Minor (alle erhalten):**

- MINOR-IT9-01-A — Empty-State-Wortlaut „Noch keine Kunden registriert." statt Story-„Keine Kunden registriert." Routing: `frontend-engineer`.
- MINOR-IT9-01-B — AC4 Status-Spalte unklar; aktuell `bookingCount` + `adminRating` als Proxy. Routing: `frontend-engineer`.
- MINOR-IT9-02-A — Server-Banner-Pfad bei 400 `address_required` ohne Profil-Link (Defense-in-Depth, UI verhindert Fall heute kaum). Routing: `frontend-engineer`.

**Open Manual:** US-IT9-04 AC4 — Live-Login mit Google nach Setup → manueller Smoke durch Tom auf Vercel-Preview.

**Re-Verify-Outcome:** Loop schließen. Minor-Findings in Follow-up-PR oder Backlog.

---

### IT10 — US-IT10-01 bis US-IT10-05 (Reset-Mail, Admin-Nutzerliste, Booking-POST, Quick-Booking-Modal, Customer-Self-Service)

- **Verdict:** DONE — Go Live (vorbehaltlich 5 operative Tom-Aufgaben)
- **Build:** lint PASS, typecheck PASS, smoke 181/181, IT10-Tests 24/24.

**Story-Verdicts:** 5/5 DONE.

**Critical/Major:** Keine.

**Phase-2-QA-Auflagen-Status (alle aus dem Design-Review umgesetzt):**

- STRUCT-1 (`internalError()`-Logging-Härtung mit `[internal_error]`/`[prisma_error]`-Markern + Endpoint-Tag + Stack + Prisma-Code im Log; Response leakt nichts) — PASS.
- STRUCT-3 (`BOOKING_SLOT_TAKEN`-Subcode in BE + FE) — PASS, `BookingConflictError` mit Subcode + `field: 'date'`.
- STRUCT-4 (Service-Pflichtfeld im Modal, Submit disabled bis Service gewählt) — PASS.
- UX-2 (`COMPLETED`-Badge ergänzt, 6 Varianten, A11y-konform Text+Icon) — PASS.
- PM-1 (`MAIL_FROM` kanonisch im Code; `RESEND_FROM_EMAIL` nicht referenziert) — PASS.
- STRUCT-5 (Vor-Account-Buchungen-Filter als bewusste Limitation, im UI dokumentiert) — PASS.

**Beobachtungen ohne Defekt-Klassifikation:**

- `lucide-react` nicht installiert; `src/components/ui/icons.tsx` mit Inline-SVG-Eigenimplementierungen. Akzeptabel.
- `useCustomer()` (Client-Hook) statt SSR-Pre-Fill (Architektur §2.2 hatte „empfohlen Variante A"). Vertretbar; Backlog IT11+.
- Frontend-seitige Pagination für `GET /api/customer/bookings`. Pragmatisch akzeptabel; Backlog bei Wachstum.

**Operative Aufgaben für Tom (nicht-Code):**

1. `MAIL_FROM` in Vercel setzen.
2. Resend-Domain verifizieren.
3. Pflicht-ENV `RESEND_API_KEY`, `MAIL_TO_ADMIN`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`.
4. `prisma migrate deploy` gegen Prod-libSQL/Turso.
5. Live-Smoke-Test in Prod nach Vercel-Setup.

**Re-Verify-Outcome:** Code-Qualität hoch. Tom muss vor Live-Deployment die 5 operativen Aufgaben abarbeiten — sonst werden Bug-Symptome (Reset-Mail kommt nicht an, `/admin/users` 500, Booking-POST 500) weiter sichtbar.

---

### IT11 — US-IT11-01 bis US-IT11-06 (Buchung-E2E, Modal-Konsolidierung, Bestätigung+Token, Datei-Upload, Profil-Vorausfüllung, Storno)

- **Verdict:** DONE (Code) — wartet auf Tom-Smoke-Test in Prod
- **Build:** test:it11 33/33, test 181/181 (+2 SKIP), tsc clean, lint 0, build erfolgreich.

**Story-Verdicts:** 6/6 DONE aus Code-Sicht.

**Critical/Major:** Keine. Statisch und dynamisch wurde kein AC-Bruch identifiziert.

**Vertragskonformität (OpenAPI v11.1):** Vollständig konform. Alle 11 Vertragsteile passing.

**Microcopy + A11y Stichproben:** Telefon-NBSP, `tel:`-Link E.164, Modal-Trigger `aria-haspopup="dialog"`, Cancel-Dialog `role="dialog"` + Focus auf Abbrechen — alle PASS.

**Minor (alle erhalten, nicht-blockierend):**

- MIN-01 — Magic-Bytes-Check kann silently übersprungen werden (Defense-in-Depth). Routing: `backend-engineer` (Backlog IT12).
- MIN-02 — Doppel-Submit-Dedup nur bei `customerEmail`-Match. Routing: `backend-engineer` (Wartungs-Backlog).
- MIN-03 — Bestätigungs-Page bei `kind: 'error'` rendert dieselbe `<TokenExpiredPage>` wie bei `kind: 'unauthorized'`. Routing: `frontend-engineer` (Backlog IT12).
- MIN-04 — Tom-Mail-Pfad bei Cancel: best-effort, kein Retry/DLQ. Routing: `backend-engineer` (Backlog).

**Manuelle Smoke-Tests für Tom:** 12 Schritte (Phase A operative Vorbedingungen + Phase B E2E).

**Sign-off-Kriterium:** (1) Alle 12 Smoke-Schritte funktionieren UND (2) mindestens eine Mail an Tom (`hausservice-baerenstark@outlook.com`) bei einem Nicht-Test-Empfänger angekommen.

**Re-Verify-Outcome:** Nach Tom-Smoke-Test final abnehmbar.

---

### IT12 — IT12-S01 bis IT12-S15 (OAuth-Fix, Service-Bilder, Kalender-Performance, 9 Bug-Fixes, Marketing-Mailer)

- **Verdict (Original):** **BLOCKED** — Loop nötig.
- **Verdict (Re-Verify nach Bug-Fixes):** **APPROVED with caveats** — alle Critical/Major resolved, deploy-ready für Production.
- **Build:** tsc clean, test:it12 19/19 → 20/20, build erfolgreich.

**Story-Verdicts:** 7 Done + 7 Done with conditions + 1 Not done (S15, BLOCKER vor Re-Verify).

**Critical (alle erhalten):**

- **BUG-001 (Critical, Blocker) — S15 Bulk-Send-Endpoint FE↔BE Body-Mismatch.** FE `sendMarketingEmail(draftId)` ohne Body, Backend erwartet `recipientIds`-Body. Routing: `backend-engineer` / `frontend-engineer`. **RESOLVED** in Re-Verify (Option A — Frontend sendet `recipientIds`+`subject`+`body`; Backend persistiert FE-Edits vor Send).

**Major (alle erhalten):**

- **BUG-002 (Major) — S05 AC2 E-Mail-Vorausfüllung im Konto-Card.** `displayEmail=""` weil `public-summary` E-Mail aus PII-Gründen nicht liefert. Routing: `solution-architect` → `frontend-engineer`. **RESOLVED** — `BookingPublicSummary` liefert `customerEmail` aus, wenn Token-Auth ODER Cookie-Owner; `CreateAccountOfferSheet` zeigt Email read-only.
- **BUG-003 (Major, Compliance) — S15 DSGVO/UWG-Risiko, Backend-Send filtert nicht auf Bestandskunde.** UWG §7 Abs. 3 verletzt, wenn Customer ohne COMPLETED-Booking Marketing-Mail erhält. Routing: `backend-engineer` + `solution-architect`. **RESOLVED** — `marketing-bulk-send.ts` filtert auf `bookings: { some: { status: 'COMPLETED' } }`; `strictRecipients: true` wirft 422 INVALID_RECIPIENTS; dedicated Test verifiziert.
- **BUG-004 (Major, Doku) — OpenAPI-Spec Drift: `/send` ohne Body, Implementierung mit Body.** Routing: `solution-architect`. **RESOLVED** — `iteration-12.openapi.yaml` aktualisiert mit `MarketingEmailSendRequest`-Schema + 422-Response + Header-Doku.

**Findings (Should fix, alle erhalten):**

- FIND-001 (Minor, Contract) — S05 Backend gibt 401 statt subcode `INVALID_TOKEN`. Funktioniert dank FE-Mehrfach-Check. Routing: `backend-engineer`.
- FIND-002 (Minor, UX) — Marketing-Composer auto-saved Draft kann nicht aktualisiert werden. **RESOLVED** in Re-Verify (Composer schickt aktuelle State-Werte an `/send`, Backend persistiert vor Send).
- FIND-003 (Minor) — S15 Marketing-Historie nicht implementiert (Should-Have). Bestätigt als IT13-Backlog.
- FIND-004 (Should fix) — S03 Performance-Target Production-Verifikation. Routing: Tom (Browser DevTools-Messung nach Deploy).
- FIND-005 (Minor) — S02 Service-Tests nicht im Test-Lauf. Manueller Smoke akzeptabel.
- FIND-006 (Minor, defensive) — S07 ProfileForm: `router.refresh()` für Server-Components fehlt. Routing: `frontend-engineer`.

**Caveats nach Re-Verify (kein Blocker):**

- CAVEAT-001 (Minor) — Frontend-Composer liest ausgeschlossene Recipient-IDs aus `err.details`, Backend liefert via Header `X-Excluded-Ids`. Tom sieht Fehlermeldung, aber nicht ID-Liste im UI. Backlog IT13.
- CAVEAT-002 (Minor) — FIND-001 nicht erneut verifiziert (war Optional/kosmetisch).

**Operative Tom-Aufgaben:**

1. Vercel-Env: `NEXTAUTH_URL=https://www.baerenstark-hausservice.app`, `NEXT_PUBLIC_BASE_URL=https://www.baerenstark-hausservice.app`, `UNSUBSCRIBE_TOKEN_SECRET`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `MAIL_FROM`.
2. Google Cloud Console — Authorized Redirect URI `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`.
3. `npx prisma migrate deploy` (Marketing-Tabellen + `customer_users.unsubscribedAt/Reason` + `idempotency_keys`).

**Re-Verify-Outcome:** **APPROVED with caveats** — alle Critical/Major-Bugs resolved, deploy-ready für Production. Caveats nicht-blockierend, IT13-Backlog. Tom-Smoke-Tests (S01-S15) in 18 Schritten dokumentiert.

---

## Manueller Smoke-Plan für Tom (jüngste Iteration IT12)

### Phase 1 — DevOps-Pflichtaktionen (vor allem)

1. Vercel-ENV setzen/verifizieren (siehe oben IT12-Block).
2. Google Cloud Console — Authorized Redirect URI exakt.
3. `npx prisma migrate deploy`.

### Phase 2 — Smoke-Tests pro Story

4. S01: Inkognito → `/konto/login` → „Mit Google anmelden" → erwartet eingeloggt auf `/konto`, kein 4xx.
5. S02: `/services/entruempelung` (+ 5 weitere Slugs) → Hero-Foto sichtbar, Icon klein neben H1.
6. S03: `/buchung` → Schritt „Wann?" → Stoppuhr < 1.5s.
7. S04: Slot auswählen → Scrollposition unverändert.
8. S05: Als Gast Buchung absenden → Bestätigungsseite → Konto-Card sichtbar → Passwort eingeben → eingeloggt → `/konto` zeigt Anfrage.
9. S06: Als Customer eingeloggt → `/konto` → Anfragen-Liste rendert (kein 500).
10. S07: `/konto/profil` → Adresse ändern → Speichern → Header zeigt weiterhin „Mein Konto".
11. S08: Als Customer eingeloggt → `/buchung` → Form prüfen vorausgefüllt.
12. S09: Wechsel zwischen Feldern → KEIN Scroll-Sprung.
13. S10: `/buchung` → Bild-Upload (1 MB JPEG) erfolgreich. Großdatei (>10 MB) → klare Fehlermeldung.
14. S11: Submit als Customer → Loader weg, Toast „Anfrage gesendet", Redirect → `/konto` zeigt neue Anfrage. Doppelklick-Schutz (Idempotency-Key).
15. S12: Admin → `/admin` → Widget „Bevorstehende Termine" lädt.
16. S13: Admin → `/admin/bookings` → Liste rendert.
17. S14: Admin-Sidebar prüfen: 3 Gruppen, Bewertungen NUR in Auswertungen, Welcome-Banner einmalig.
18. S15: `/admin/marketing` → Service-Filter → Wizard → Test-Send → Mail prüfen → UWG-Checkbox → Senden → Step 6. Unsubscribe-Test, Daily-Quota-Test.

### Phase 3 — Logs & Monitoring

19. Vercel-Logs auf 4xx/5xx prüfen.
20. Resend-Dashboard auf bounced/failed Mails prüfen.

---

**Ende konsolidiertes Implementation-Review IT2–IT12.**
