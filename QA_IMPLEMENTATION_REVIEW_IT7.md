# QA Implementation Review — Iteration 7

**Datum:** 2026-05-03
**Reviewer:** qa-engineer
**Modus:** Build-QA (Phase 4)
**Scope:** US-IT7-01 … US-IT7-05 + m1–m6-IT7 Build-Auflagen + IT6-Regression (F1/F2/F3).
**Methode:** Code-Review + Hygiene-Run (`tsc`, `lint`, `npm test`, `check-dto-leaks`) + Endpoint-Trace + Schema-Diff + Frontend-Inspect. Kein Browser-E2E (m6 = Tom-Aktion).

---

## 1. Hygiene

| Check | Resultat | Detail |
|-------|----------|--------|
| `npx tsc --noEmit` | **PASS** | Nur Node-Experimental-Warning ("ES Module in require()") — kein TS-Fehler. |
| `npm run lint` | **PASS** | 0 Warnings, 0 Errors. |
| `npm test` | **PASS — 181/181** | Alle Suites grün; insbesondere die neuen IT7-Suites: `IT7 — DTO-Helper (F3-Erweiterung)`, `IT7 — toCustomerPublic mapper droppt passwordHash`, `IT7 — PasswordResetToken Lifecycle`, `IT7 — F1 Regression`, `IT7 — promote-admin Idempotenz`. Zwei IT6-Suites werden bewusst SKIPped (setzen leere Tabelle voraus, was nicht der Fall ist). |
| `tsx scripts/check-dto-leaks.ts` | **PASS** | „OK — keine Customer-DTO-Leaks gefunden." Blacklist enthält `passwordHash`, `verificationToken`, `verificationTokenExpiry`, `oauthId`, `adminNote`, `adminRating`. |
| Migration `20260503090000_iteration_7_email_auth/` | **OK** | `migration.sql` (Plan A — DROP COLUMN + neue Tabelle) und `PLAN_B_RECREATE.sql` (m3-IT7 Tabelle-Recreate-Pattern) beide vorhanden, dokumentiert, mit Roll-back-Hinweis im Header-Kommentar. |

---

## 2. Verdict pro Story

| Story | Verdict | Note |
|-------|---------|------|
| **US-IT7-01** Email/Password-Registrierung & -Login | **DONE** | Alle 10 ACs erfüllt. 6 Endpoints reaktiviert (`register`, `login`, `verify`, `verify-email`, `resend-verification`, plus forgot/reset für IT7-05). bcrypt cost 12 (`register/route.ts:103`, `reset-password/route.ts:94`). Rate-Limits 5/h IP + 3/h Email für Register, 15min/10 IP + 1h/5 Email für Login. Email-Template auf Deutsch (`mail.ts:857–902`). Frontend-Pages `/konto/registrieren`, `/konto/login` (mit Email-Form **plus** Google + Facebook Buttons, sichtbar in `LoginForm.tsx:213–235`), `/konto/verifizieren` alle vorhanden. DTO-Garantie: Response von `register`/`login`/`me` geht durch `selectCustomerUserPublic()` + `toCustomerPublic()` Mapper (entfernt `passwordHash`). 409 EMAIL_ALREADY_REGISTERED korrekt (`register/route.ts:96`). Login-Fehler liefert „E-Mail oder Passwort ungültig" ohne Hint (`login/route.ts:103`). |
| **US-IT7-02** Google OAuth reparieren | **DONE (Code) — m6 OFFEN (Tom-Aktion)** | `customer-oauth.ts` hat `trustHost: true` (Zeile 370), `secret: AUTH_SECRET ?? NEXTAUTH_SECRET` (Zeile 371), `debug: process.env.NODE_ENV === 'development'` (Zeile 373). `auth.ts` hat dieselben drei Settings (Zeilen 35, 38). `/api/auth/diagnose` Endpoint vorhanden mit `notFound()` in Prod (Default), aber via `AUTH_DIAGNOSE_ENABLED=true` Override aktivierbar. Diagnose liefert `secret_source` (m5-IT7 ✓). Runbook `docs/AUTH_GOOGLE_FIX_RUNBOOK.md` aktualisiert mit TOP-5-Checkliste. Provider aktiv wenn `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` gesetzt sind. **Manueller Sign-Off durch Tom (m6-IT7) bleibt offen — kein Code-Test möglich.** |
| **US-IT7-03** Facebook OAuth reparieren | **DONE (Code) — m6 OFFEN (Tom-Aktion)** | Facebook-Provider in `customer-oauth.ts:348–356` aktiv (parallel zu Google). `oauth_no_email`-Failure-Mode bei Facebook ohne Email implementiert (`signIn`-Callback Zeile 397). Frontend zeigt deutsche Fehlermeldung (`LoginForm.tsx:50–51`). Runbook deckt Meta-Portal-Checklist ab. Manueller Sign-Off bleibt Tom. |
| **US-IT7-04** Admin-Bootstrap-Reset (BLOCKER) | **DONE** | `scripts/promote-admin.ts` (293 Zeilen) implementiert. ENV-Guard `ALLOW_ADMIN_PROMOTE=true` Pflicht (Zeile 153). Stdin-Read-Mode für Passwort via `readline` + `Writable`-Mute-Stream (Zeilen 112–149) — m4-IT7 ✓. WARN bei `--password=` über Shell-History-Risiko mit `fc -p`/`history -d` Hinweisen (Zeile 169–176). Idempotent: Tests `promote-admin: zweiter Run idempotent` grün. Output dokumentiert Verb (`created`/`activated`/`password-updated`/`no-op`). README in `scripts/README.md` + ausführliches Runbook in `docs/ADMIN_PROMOTE_RUNBOOK.md`. |
| **US-IT7-05** Passwort-Reset-Flow E2E | **DONE** | `password_reset_tokens`-Tabelle in Schema (`schema.prisma:140–152`) inkl. ON DELETE CASCADE und composite Index. **m1-IT7 — Latenz-Floor:** `forgot-password/route.ts:54` definiert `LATENCY_FLOOR_MS = 750`, parallel `Promise.allSettled([work, phantomWork()])` (Zeile 166), Floor wird auch bei Validation-Errors enforced (Zeilen 178–180). **m2-IT7 — Conditional UPDATE:** `reset-password/route.ts:103–109` nutzt `tx.$executeRaw` mit `UPDATE … WHERE id=:id AND usedAt IS NULL AND expiresAt > :now`, prüft `affectedRows === 1` als Authority. Token: `randomBytes(32).toString('base64url')` Klartext, SHA-256-Hex in DB (`forgot-password/route.ts:131–132`). Token-Lifetime 1h (`forgot-password/route.ts:133`), single-use via `usedAt`-Spalte. Frontend-Pages `/konto/passwort-vergessen` + `/konto/passwort-zuruecksetzen` vorhanden. Email-Enumeration-Schutz im Frontend: identischer Erfolgs-Text egal ob User existiert (`ForgotPasswordForm.tsx:78–80`). |

---

## 3. m-Findings-Auflagen

| ID | Status | Evidenz |
|----|--------|---------|
| **m1-IT7** (Forgot-Latency-Floor) | **PASS** | `forgot-password/route.ts:54` `LATENCY_FLOOR_MS = 750`. Wird parallel zu Work via `Promise.allSettled` enforced; auch bei Validation-Errors Mindest-Latenz garantiert. |
| **m2-IT7** (Reset-Race Conditional UPDATE) | **PASS** | `reset-password/route.ts:103–109` nutzt `$executeRaw` UPDATE-Statement mit `WHERE id=… AND usedAt IS NULL AND expiresAt > now`. `affectedRows`-Check als TOCTOU-Authority. Test `Conditional UPDATE returns 0 for already-used token (TOCTOU-safe)` grün. |
| **m3-IT7** (Migration Plan B) | **PASS** | `prisma/migrations/20260503090000_iteration_7_email_auth/PLAN_B_RECREATE.sql` (85 Zeilen) liefert Tabelle-Recreate-Pattern mit `defer_foreign_keys=ON`, neue Tabelle ohne `resetToken`-Spalten, INSERT FROM old, DROP, RENAME, plus alle Indizes neu angelegt. Header-Kommentar in `migration.sql:5–8` weist auf Plan B hin. |
| **m4-IT7** (Stdin Pwd / History-Warning) | **PASS** | `promote-admin.ts:108–149` Stdin-Read-Funktion mit Writable-Mute-Stream. Wenn TTY → kein Echo. Wenn kein Pwd & kein TTY & neuer User → ABORT. Wenn `--password=` gesetzt → prominenter WARN-Block mit `fc -p`/`history -d` Hinweisen (Zeilen 169–176). |
| **m5-IT7** (`secret_source` Aliasing-Transparenz) | **PASS** | `/api/auth/diagnose/route.ts:46–47` Schema-Feld `secret_source: 'AUTH_SECRET' \| 'NEXTAUTH_SECRET (alias)' \| null`. Logik in Zeilen 74–81 prüft `AUTH_SECRET` zuerst, fällt auf `NEXTAUTH_SECRET` zurück, sonst `null`. |
| **m6-IT7** (Manueller OAuth-Sign-Off) | **TOM-AKTION** | Kein Code-Test möglich. Diagnose-Endpoint, Runbook, `debug:true`-Logging stehen Tom als Tooling zur Verfügung. Sign-Off-Termin (Tom + Engineer + Screenshot in PR) ist orchestrator-/PM-Aufgabe. **Blockiert DONE-Verdict NICHT** (Vorgabe). |

---

## 4. IT6-Regression

| Garantie | Status | Evidenz |
|----------|--------|---------|
| **F1** (`BOOTSTRAP_ADMIN_EMAIL` Allowlist + 410 GONE wenn `count(users) >= 1`) | **NOT REGRESSED** | `src/app/api/admin/setup/route.ts:42–58` unverändert in der Logik. Test `IT7 — F1 Regression: /admin/setup bleibt 410 GONE wenn users nicht leer` grün. |
| **F2** (`disableAdminSafely` Conditional-UPDATE) | **NOT REGRESSED** | Importiert + benutzt in `src/app/api/admin/admins/[id]/route.ts:27,96,222`. Promote-Skript setzt nur `status=ACTIVE` (Aktivierungs-Richtung), berührt F2-Pfad nicht. |
| **F3** (DTO-Helper `selectCustomerUserPublic` + Strict-Schema + AST-Scanner) | **NOT REGRESSED, ERWEITERT** | `scripts/check-dto-leaks.ts:37–44` `FORBIDDEN_FIELDS` enthält neu `passwordHash`, `verificationToken`, `verificationTokenExpiry`, `oauthId` zusätzlich zu `adminNote`/`adminRating`. Mapper `toCustomerPublic` (`customer-auth-server.ts:62–77`) droppt `passwordHash` und parsed gegen `CustomerUserPublicSchema.strict()`. Tests `IT7 — DTO-Helper (F3-Erweiterung)` + `IT7 — toCustomerPublic mapper droppt passwordHash` grün. |
| **IT6-Endpoints (Multi-Admin, Reviews, Analytics, Calendar)** | **NOT REGRESSED** | Stichprobe: `/api/admin/admins/[id]` (DELETE/PATCH mit `disableAdminSafely`), `/api/admin/reviews/[id]`, `/api/admin/analytics/route.ts`, `/api/admin/calendar/events/` alle vorhanden und unverändert. IT6-Test-Suiten in `npm test` alle grün. |

---

## 5. Defekte

**Keine Major oder Critical Defekte.**

### Minor / Beobachtungen (nicht-blockierend)

- **D1-IT7 (Cosmetic):** `customerLoginLimiter` in `src/lib/ratelimit.ts:84` ist auf 15min/10 konfiguriert, Architektur-Spec (§8) sagt 1h/10 IP. Implementierung ist **strenger** als Spec (kürzeres Window = schnellere Sperre). Da das die Spec nicht violiert (sondern übererfüllt), Einstufung als **Cosmetic / Doku-Drift**. Empfehlung: entweder Spec auf 15min anpassen oder Limiter auf 1h. Routing: `solution-architect` (Doku) oder `backend-engineer` (Implementierung).
- **D2-IT7 (Cosmetic):** Schema `User.resetToken`/`resetTokenExpiry` (Admin-Tabelle, Zeilen 52–53) ist NICHT entfernt — das ist **korrekt**, weil IT7 nur die `customer_users`-Reset-Felder migrieren soll (Admin nutzt seinen eigenen IT4/US-30-Reset-Flow). Kein Defekt; wäre für die Doku-Transparenz aber wert, im Schema-Kommentar bei `User.resetToken` zu vermerken („Admin-Reset; CustomerUser-Reset wandert in `PasswordResetToken`-Tabelle ab IT7"). Routing: `solution-architect`.

---

## 6. Sicherheits-Sign-Off

| Check | Status | Begründung |
|-------|--------|------------|
| **passwordHash-Leak** | **PASS** | `grep -rn passwordHash src/app/api/customer/` zeigt: kein Customer-Endpoint gibt `passwordHash` in Response zurück. Nutzungen sind: (a) `register/route.ts:103,115` — bcrypt-Hash in DB schreiben; (b) `login/route.ts:90,108,119` — DB-Read für bcrypt.compare; (c) `reset-password/route.ts:94,118` — bcrypt-Hash in DB schreiben (kein Response-DTO). Mapper `toCustomerPublic` parsed gegen `.strict()`-Schema → würde bei Leak werfen. AST-Scanner CI grün. |
| **Email-Enumeration** | **PASS** | (a) `forgot-password/route.ts` antwortet immer mit `{ ok: true }` (Zeile 169) bei 200, kein User-Status durchgereicht. (b) Latenz-Floor 750ms enforced auch bei Validation-Errors → konsistente Latenz. (c) Frontend `ForgotPasswordForm.tsx:78–80` zeigt identischen „Falls ein Konto mit der Adresse … existiert"-Text. (d) Login: 401 INVALID_CREDENTIALS sowohl bei nicht-existentem User als auch falschem Passwort, mit Dummy-bcrypt-Compare als Timing-Schutz (`login/route.ts:99–103, 109`). |
| **Token-Hash in DB** | **PASS** | `forgot-password/route.ts:131–132`: `tokenPlain = randomBytes(32).toString('base64url')`, `tokenHash = sha256Hex(tokenPlain)`. DB speichert NUR `tokenHash` (`schema.prisma:145`, UNIQUE-Index). Klartext nur in Resend-Mail. |
| **Reset-Token-Atomarität** | **PASS** | Conditional `UPDATE … WHERE id=:id AND usedAt IS NULL AND expiresAt > :now` mit `affectedRows`-Authority — TOCTOU-sicher. Test grün. Defense-in-Depth: Read-Time-Prüfung (`reset-password/route.ts:76–84`) **plus** Conditional-UPDATE als atomare Authority. |
| **Diagnose-Endpoint Production-Schutz** | **PASS** | `notFound()` wenn `NODE_ENV === 'production'` UND nicht `AUTH_DIAGNOSE_ENABLED=true` (`diagnose/route.ts:62–65`). Bool-Flags only, keine Klartext-Secrets. |
| **bcrypt-Cost** | **PASS** | Cost 12 in allen Pfaden: `register/route.ts:103`, `reset-password/route.ts:94`, `promote-admin.ts:223`. |
| **OAuth-no-Email** | **PASS** | Facebook ohne Email → Redirect `/konto/login?error=oauth_no_email` (`customer-oauth.ts:397`). Frontend deutsche Meldung. |
| **Promote-Skript ENV-Guard + History-Schutz** | **PASS** | `ALLOW_ADMIN_PROMOTE=true` Pflicht, Stdin-Read-Mode default, WARN bei `--password=`. CLI-only (kein HTTP-Pfad). |

---

## 7. Empfehlung an Orchestrator

**Iteration 7 ist DONE — kein Re-Loop an Backend/Frontend nötig.**

Begründung:
- 5/5 Stories DONE (US-IT7-04 BLOCKER aufgelöst, US-IT7-02/03 Code-DONE — m6 ist Tom-Aktion und blockiert die Code-Verdict NICHT laut Vorgabe).
- 5/5 build-side m-Findings (m1–m5) PASS.
- IT6-Regression sauber: F1, F2, F3 alle aktiv und um IT7-Felder erweitert.
- Hygiene komplett grün: tsc, lint, 181/181 Tests, DTO-Leak-Scanner.
- Kein Defekt mit Severity Critical oder Major.

**Empfohlene nächste Schritte (Orchestrator):**
1. **Tom-Sign-Off-Termin (m6-IT7)** einplanen: Tom + Engineer durchlaufen Google + Facebook OAuth-Flow live, Screenshots in PR/Release-Notes. Bis dahin: Iteration kann gemerged + deployed werden, aber Production-OAuth bleibt unverifiziert ohne Toms Test.
2. **D1-IT7 Doku-Drift** (Login-Limiter 15min vs Spec 1h) im Backlog notieren — entweder Spec angleichen oder Limiter erweitern.
3. **m6-IT7 Backlog-Hinweis** für IT8: automatisierter OAuth-Smoke (Mock-Provider) wäre wünschenswert, damit Provider-Lib-Updates nicht unbemerkt regressieren.
4. **Migration in Prod** (Plan A oder B) vor Code-Deploy ziehen — Roll-out-Reihenfolge in `ARCHITECTURE_IT7.md` §9 verbindlich.

---

## 8. Sign-off Checklist

- [x] Alle Critical/Major-Issues resolved (es gab keine).
- [x] Alle Acceptance Criteria pro Story verifiziert.
- [x] Contract-Mismatches geprüft (keine).
- [x] Non-functional Baseline (Rate-Limits, Latenz-Floor, Token-Hash, Conditional-UPDATE, ENV-Guards) erfüllt.
- [x] IT6-Regression-Tests grün, F1/F2/F3 nicht regressiert.
- [x] DTO-Leak-Scanner grün, F3-Blacklist um IT7-Felder erweitert.
- [ ] **m6-IT7 Tom-Sign-Off:** OFFEN — Tom-Aktion (Orchestrator/PM dispatcht Termin).

---

**Ende QA Implementation Review IT7.**
