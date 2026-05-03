# QA Design Review — Iteration 7

Datum: 2026-05-03
Reviewer: qa-engineer
Scope: Pressure-Test des IT7-Designs (`PROJECT.md` §„Iteration 7", `project/user-stories/iteration-7.md`, `ARCHITECTURE_IT7.md` §0–§15, `contracts/schema.prisma` IT7-Block, `contracts/api-routes.md` §23, `contracts/zod-schemas.ts` IT7-Block).
Methode: Cross-Check Story↔Architektur↔Contracts↔IT6-Regression-Garantien (F1/F2/F3). Kein Code-Run.

---

## Verdict

**Approved with minor notes** — keine Major Findings, sechs Minor Findings.

Begründung: Die drei IT6-Pre-Build-Blocker (F1/F2/F3) bleiben **strukturell erhalten**, IT7 erweitert F3 sauber um `passwordHash`/`verificationToken`/`oauthId` und führt für die neuen Auth-Pfade konsistente Helper- und Schema-Garantien fort. Sicherheits-Pressure-Tests (Token-Hashing, Reset-Token-Lifecycle, Email-Enumeration, Diagnose-Endpoint-Schutz) sind im Design adressiert. Die sechs Minor Findings sind Doku-/Hardening-Restanzen, kein einziges davon blockt Build-Start.

Zähler:
- Major Findings: 0
- Minor Findings: 6
- Pflicht-Pressure-Tests A–H: alle ausgeführt, siehe „Pressure-Test-Checkliste".

---

## IT6-Regression-Check (F1/F2/F3)

| Garantie | IT7-Status | Evidenz |
|----------|------------|---------|
| **F1 — Bootstrap-Allowlist (`BOOTSTRAP_ADMIN_EMAIL`, 410 GONE wenn `count(users) >= 1`)** | **NICHT regressiert** | `ARCHITECTURE_IT7.md` §1.1 (Begründung), §1.5 („`/api/admin/setup` ändert sich nicht"), §10 (ENV-Tabelle ohne Bootstrap-Bypass), `api-routes.md` §23 Eingangs-Disclaimer („F1/F2/F3 aus IT6 §17 bleiben unangetastet"), Smoke-Test S2 (§12.1). Promote-Skript läuft ausschließlich als CLI mit `ALLOW_ADMIN_PROMOTE`-Guard, ist nicht über HTTP erreichbar, und legt nach erstem Lauf einen User an → `/api/admin/setup` antwortet sofort wieder mit 410 GONE. Kein Konflikt zwischen Skript und Allowlist. |
| **F2 — `disableAdminSafely` Conditional-UPDATE** | **NICHT regressiert** | Promote-Skript setzt nur `status='ACTIVE'` (UPDATE-Richtung Aktivieren) — F2 schützt die **Deaktivierungs-Richtung** (DISABLE/DELETE). IT7 fügt keinen neuen Endpoint hinzu, der einen Admin disablen würde, also kein neuer Pfad, der den Helper umgehen könnte. Promote-Skript ist nicht idempotenz-feindlich (UNIQUE auf email, Re-Run = no-op). **Restzweifel:** siehe m4 (kein expliziter Verweis auf F2 in §1). |
| **F3 — DTO-Helper + `.strict()` + AST-Scanner** | **NICHT regressiert, korrekt erweitert** | `selectCustomerUserPublic()` bleibt Pflicht (§4.3 + §6.1). FORBIDDEN_FIELDS in `scripts/check-dto-leaks.ts` wird **explizit** um `passwordHash`, `verificationToken`, `oauthId` ergänzt (§6.2 + `zod-schemas.ts` Zeile 2052–2057). `CustomerUserPublicSchema.strict()` bleibt aktiv (Zeile 1098). Snapshot-Test S10 in §12.1 verbindlich. |

**Fazit:** Keine Regression. F3-Erweiterung ist explizit benannt und in CI-Helper, Zod-Kommentar und Architektur-Doku konsistent verankert.

---

## Major Findings (Blocker)

Keine.

---

## Minor Findings

### m1-IT7 — Email-Enumeration auf `/forgot-password`: Latenz-Konstanz nur weich spezifiziert

**Story:** US-IT7-05
**Quellen:** `ARCHITECTURE_IT7.md` §5.3 (forgot-password-Code-Skelett, Zeile 552 „Konstante Latenz (Side-Channel): immer Token generieren + bcrypt-Dummy."); `api-routes.md` §23.3 forgot-password („`bcrypt.compare`-Dummy oder `await sleep(~200ms)`").

**Problem:** Das Code-Skelett in §5.3 generiert **immer** Token + Hash (auch bei Nicht-User), aber es schreibt **nur dann** ein DB-Row, wenn der User existiert (`if (user) { … prisma.passwordResetToken.create … sendPasswordResetMail … }`). Das DB-INSERT + der Resend-API-Call dauern messbar länger als die fehlenden Side-Effects bei Nicht-Usern. `api-routes.md` §23.3 spricht von „bcrypt-Dummy ODER `sleep(~200ms)`" — beides ist nicht ausreichend, weil:
- DB-INSERT auf libSQL/Turso ist eine Netzwerk-Round-Trip (variable Latenz, nicht durch fixed-time-sleep abgedeckt).
- Resend.send() ist ein zweiter Netzwerk-Call (nochmal hunderte ms).
- Ein Angreifer kann durch repeat-Calls statistisch Email-Existenz inferieren.

**Severity:** Minor (Side-Channel-Inferenz, nicht harter Account-Takeover). Pflicht-Tests S6+S7 in §12.1 prüfen Verhalten, nicht Latenz.

**Empfohlener Fix vor Build:**
- §5.3 verbindlich: bei Nicht-User MUSS das gleiche „Phantom"-Verhalten ausgeführt werden — entweder INSERT in eine Wegwerf-Tabelle / Mock-Resend-Call **oder** ein klar dokumentiertes Latenz-Budget („alle Pfade bei +/- 50ms identisch, gemessen via Pflicht-Test"). Architekt benennt eine Methode konkret.
- Optional: Pressure-Test in §12.2 ergänzen — „1000 Calls mit existierendem vs. nicht-existierendem User; p50/p95-Latenz-Diff < 50ms".
- Schwächere Variante (akzeptabel als MVP): explizit dokumentieren, dass der Schutz nicht latenz-konstant ist und Email-Enumeration durch Rate-Limit allein gemindert wird.

**Routing-Hint:** `solution-architect`.

---

### m2-IT7 — Reset-Token-Race: Atomarität der `$transaction` ist nicht conditional-locked

**Story:** US-IT7-05
**Quellen:** `ARCHITECTURE_IT7.md` §5.3 reset-password-Skelett (Zeilen 581–601); §13 „Risiken und QA-Schwerpunkte" Punkt 5; Pressure-Test P4 in §12.2.

**Problem:** Das Skelett benutzt `prisma.$transaction(async (tx) => { findUnique → update CustomerUser → update PasswordResetToken })`. Auf libSQL/SQLite serialisiert die Engine zwar Writes, aber Prisma's `$transaction` mit Function-Callback-API garantiert **kein** `BEGIN IMMEDIATE` — die Default-Isolation ist auf SQLite/libSQL "Serializable" für `BEGIN`, aber Prisma sendet bei der Function-API einen einfachen `BEGIN`, was Reads zulassen kann.

In F2 wurde dieser Race konsistent über **Conditional-UPDATE** (`UPDATE … WHERE … AND EXISTS(…)` + `affectedRows`-Check) gelöst. IT7 fällt für reset-password auf das schwächere Pattern zurück, **obwohl es genau verfügbar wäre**:

```sql
UPDATE password_reset_tokens
   SET usedAt = now()
 WHERE id = :id
   AND usedAt IS NULL
   AND expiresAt > now()
```

→ check `affectedRows = 1`, nur dann Passwort updaten.

P4 in §12.2 fordert „TOCTOU im `$transaction` greift" — aber das Design **garantiert** das nicht, es **wünscht** es.

**Severity:** Minor (Race-Window ist sub-millisekund auf SQLite-libSQL, in der Praxis schwer ausnutzbar — aber inkonsistent zur F2-Härtung).

**Empfohlener Fix vor Build:**
- §5.3 ergänzen: explizit Conditional-UPDATE-Pattern auf `password_reset_tokens` als Single-Source-of-Truth für „Token-Verbrauch atomar". Wenn `affectedRows = 0` → `INVALID_OR_EXPIRED_TOKEN`. Anschließend `customer_users.passwordHash`-Update im selben `$transaction` (oder gar direkt nach erfolgreichem Token-Lock).
- Alternativ: Doku ergänzen, warum die Function-`$transaction`-Variante hier ausreichend ist (z.B. expliziter Verweis auf libSQL-`BEGIN IMMEDIATE`-Verhalten).
- Pflicht-Test P4 in §12.2 zu Smoke-Test S-neu hochstufen.

**Routing-Hint:** `solution-architect`.

---

### m3-IT7 — Migration `DROP COLUMN`: Plan B (Tabelle-Recreate) nicht spezifiziert

**Story:** US-IT7-01 + US-IT7-05
**Quellen:** `ARCHITECTURE_IT7.md` §9 (Migration-SQL Zeile 745–746); §13 Risiken Punkt 2 „falls die Drop-Column-Syntax im Cloud-Build fehlschlägt, Fallback auf Tabelle-Recreate-Pattern."

**Problem:** §9 schreibt `ALTER TABLE customer_users DROP COLUMN resetToken;` und `DROP COLUMN resetTokenExpiry;`. SQLite unterstützt `DROP COLUMN` erst seit Version 3.35 (2021), libSQL/Turso liegt darüber, **aber:**
- Die Migration-Datei selbst enthält keinen Fallback-Pfad.
- §13 nennt das Risiko, liefert aber keine **Tabelle-Recreate-SQL** (CREATE neue Tabelle ohne resetToken-Felder, INSERT FROM old, DROP old, RENAME).
- Wenn die Migration in Prod fehlschlägt, ist der Roll-out bereits halb-durch (`emailVerifiedAt` add-column ist evtl. schon erfolgreich) — Roll-back-Pfad fehlt.
- Außerdem: Alte `resetToken`-Werte gehen verloren — Design sagt **nicht**, ob das vor dem DROP COLUMN per `UPDATE customer_users SET resetToken=NULL` o.ä. abgesichert wird (irrelevant für Reset-Flow, aber relevant für Audit).

**Severity:** Minor (Migration-Risiko, kein Datenverlust für aktive Funktionalität, weil `resetToken`-Felder seit IT6 verwaist waren).

**Empfohlener Fix vor Build:**
- §9 mit komplettem Tabelle-Recreate-SQL als Plan B ergänzen — auch wenn Plan A erwartet wird zu funktionieren. Engineer darf zwischen A und B wählen, beide Pfade sind verbindlich gespect.
- Roll-back-SQL für jeden ALTER TABLE-Schritt (umgekehrte Reihenfolge) im Doc.
- Pflicht-Smoke: Migration zweimal hintereinander auf gleiche DB → idempotent oder klares Error-Verhalten.

**Routing-Hint:** `solution-architect`.

---

### m4-IT7 — Promote-Admin-Skript: Passwort via CLI-Argument landet im Shell-History

**Story:** US-IT7-04
**Quellen:** `ARCHITECTURE_IT7.md` §1.2 (Zeile 94 Usage-Hinweis: `--password=<pwd>`); §1.3 README; §14 (Tom-Self-Service-Tabelle Zeile 864).

**Problem:** Das Skript nimmt `--password=Temp1234!Change` als Positional-Arg. Auf Tom's Mac (zsh, default `HISTFILE=~/.zsh_history`) wird der komplette Befehl inklusive Passwort persistent geloggt. Selbst nach Passwort-Änderung in `/admin/forgot-password` (wie §1.3 empfiehlt) bleibt der ursprüngliche Bcrypt-Hash-Eingangswert kompromittierbar.

**Vom Design nicht abgedeckt:**
- Kein Stdin-Read-Modus (`promote-admin.ts <email>` → prompted Password ohne Echo).
- Kein Hinweis auf `HISTCONTROL=ignorespace` o.ä. im Runbook.
- Die README sagt zwar „Bitte SOFORT ändern", aber Tom muss wissen, **warum** (Shell-History-Leak).

**Severity:** Minor (lokale Maschine, nur Tom hat Zugriff). Aber: Wenn Tom Pair-Programming mit Engineer macht, sieht Engineer das Passwort im Terminal-Backlog.

**Empfohlener Fix vor Build:**
- Erste Wahl: `--password`-Arg wird optional gemacht. Wenn nicht gesetzt UND User existiert nicht → Random-Pwd generieren (heute-Verhalten). Wenn nicht gesetzt UND `--prompt-password` Flag → Stdin-Read ohne Echo (`readline.createInterface` + `output: null`).
- Zweitwahl (akzeptabel als MVP): README-Block erweitert um:
  ```
  >>> WICHTIG: Der Befehl wird in deiner Shell-History gespeichert.
  >>> Nach erfolgreichem Login das Passwort über /admin/forgot-password ändern
  >>> UND optional `history -d <line>` (zsh: `fc -W`) ausführen.
  ```
- Architekt entscheidet, welche Variante.

**Routing-Hint:** `solution-architect` (Doku) + optional `backend-engineer` (Stdin-Mode).

---

### m5-IT7 — `AUTH_SECRET` vs. `NEXTAUTH_SECRET`: Aliasing dokumentiert, aber Pflicht-Variante nicht festgelegt

**Story:** US-IT7-02
**Quellen:** `ARCHITECTURE_IT7.md` §2.2 (Zeile 275 `secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET`); §10 ENV-Tabelle (Zeile 777: `AUTH_SECRET` Pflicht); §13 Risiken Punkt 6 („Beide müssen lesbar sein. Smoke-Test S11 verifiziert das.").

**Problem:** Das Design liest **beide** ENV-Variablen, im Diagnose-Endpoint werden **beide** als Bool angezeigt. §10 sagt aber nur `AUTH_SECRET` ist Pflicht. Wenn ein Engineer `NEXTAUTH_SECRET=xxx` setzt und `AUTH_SECRET` leer lässt (legacy-Setup), funktioniert es zwar, aber:
- `.env.example` (§2.4 Zeile 313) listet nur `AUTH_SECRET=...`.
- Diagnose-Endpoint gibt `AUTH_SECRET_set: false, NEXTAUTH_SECRET_set: true` zurück — Tom sieht zwei Flags ohne Kontext, welcher Pflicht ist.
- §13 sagt „Smoke-Test S11" — aber S11 in §12.1 testet nur Diagnose-404-in-Prod, nicht das Aliasing.

**Severity:** Minor (Funktionalität ist gegeben, UX/Doku-Restanz für Tom).

**Empfohlener Fix vor Build:**
- §10 + §13 verbindlich: **`AUTH_SECRET` ist Pflicht-Name; `NEXTAUTH_SECRET` ist Read-Compat-Alias und im Diagnose-Output mit Kommentar `(Alias)` markiert.**
- Diagnose-Endpoint-JSON erweitert:
  ```json
  "AUTH_SECRET_set": true,
  "NEXTAUTH_SECRET_set": false,
  "secret_source": "AUTH_SECRET"   // oder "NEXTAUTH_SECRET (legacy alias)"
  ```
- Smoke-Test S-neu in §12.1: „Setze nur `NEXTAUTH_SECRET`, lasse `AUTH_SECRET` leer → Login funktioniert, Diagnose meldet `secret_source: 'NEXTAUTH_SECRET (legacy alias)'`."

**Routing-Hint:** `solution-architect`.

---

### m6-IT7 — OAuth-Reparatur (US-IT7-02/03): Keine **Build-side**-Verifikation, nur Manueller Tom-Test

**Story:** US-IT7-02 + US-IT7-03
**Quellen:** `ARCHITECTURE_IT7.md` §2.3 (Runbook-TOP-5), §3.3 (Tom-Checklist Meta-Portal); `iteration-7.md` US-IT7-02/03 ACs („when Tom auf … klickt, then ist er eingeloggt").

**Problem:** Beide ACs verlangen, dass **Tom sich erfolgreich einloggt** — nicht „weiß, was er prüfen soll". Das Design liefert:
- Diagnose-Endpoint (lesend, statisch)
- Runbook (manuelle Schritte)
- `debug:true` in NextAuth (logs, kein Test-Hook)

**Aber kein Mechanismus**, der im Build verifiziert, dass OAuth tatsächlich funktioniert:
- Kein Mock-Provider-Test (Engineer kann lokal mit echtem Google-OAuth-Sandbox testen, aber CI hat keinen Provider-Endpoint-Probe).
- Keine Storybook-/Playwright-Spec mit Mock-Tokens.
- Smoke-Tests S1–S12 in §12.1 enthalten **kein** OAuth-Smoke (nur S11/S12 für Diagnose-Endpoint selbst).
- AC „Tom kann sich einloggen" ist ein **Manuelle-Akzeptanz-Gate** — ohne Doku, wer das prüft (Tom selbst? Pair-Session?), und mit welchen Screenshots als Evidence.

**Severity:** Minor (Build kann formal abgeschlossen werden ohne dass Tom je einen Provider getestet hat). Bei IT8 fällt das auf.

**Empfohlener Fix vor Build:**
- §12.1 ergänzen: „Manueller Sign-Off-Schritt T-M1: Engineer + Tom durchlaufen `/konto/login` → Mit Google → Callback → `/konto`. Screenshot in PR. Gleiches für Facebook." Status muss vor Merge GREEN sein.
- Optional automated: Mock-OAuth-Provider via NextAuth-Test-Mode (`MockProvider`) — als Backlog-Hinweis.
- §13 Risiken-Tabelle ergänzen: „R-IT7-1: OAuth-Funktionalität ist nur per manueller Tom-Verifikation belegt — bei zukünftigen Provider-Updates (Google rotiert Client-Lib) kann Regression unbemerkt bleiben."

**Routing-Hint:** `solution-architect` (Doku/QA-Plan) + `project-manager` (Tom-Termin für Sign-Off einplanen).

---

## Pressure-Test-Checkliste — Punkt-für-Punkt

### A. F-Findings aus IT6 — Regression-Schutz

- **F1 (Bootstrap-Allowlist via `BOOTSTRAP_ADMIN_EMAIL`):** **Pass.** Promote-Skript ist CLI-only, kein HTTP-Pfad, ENV-Guard `ALLOW_ADMIN_PROMOTE=true` Pflicht. Nach erstem Lauf ist `count(users) >= 1` → `/api/admin/setup` antwortet 410 GONE wie in IT6 §17.1.1 spezifiziert. Kein Konflikt, kein Bypass-Pfad. Smoke-Test S2 (§12.1) verifiziert das. **Konkret:** wenn Promote-Skript einen User anlegt und parallel jemand `/api/admin/setup` aufruft, gibt der Endpoint 410 GONE — bestätigt durch S2.
- **F2 (`disableAdminSafely`):** **Pass mit Hinweis.** Promote-Skript setzt nur `status='ACTIVE'` (Aktivierungs-Richtung). F2 schützt die Deaktivierungs-Richtung; Aktivieren ist semantisch sicher (führt nie zu Lock-out). Im Design fehlt allerdings ein expliziter Verweis darauf — siehe m4 (es gehört zu §1, nicht zu m4 — Korrektur: das ist akzeptabel, aber ein Hinweis im Doc würde Klarheit bringen).
- **F3 (DTO-Leak `adminNote`/`adminRating`):** **Pass.** §6.2 in `ARCHITECTURE_IT7.md` erweitert FORBIDDEN_FIELDS in `scripts/check-dto-leaks.ts` explizit um `passwordHash`, `verificationToken`, `oauthId`. `zod-schemas.ts` Zeilen 2052–2057 listen alle 6 verbotenen Felder. CI-AST-Scanner aus IT6 §17.3.4 läuft weiter; Pre-Merge-Gate `pnpm test:arch` bleibt aktiv. Snapshot-Test S10 (§12.1) verbindlich.

### B. Sicherheits-Pressure-Test

- **Password-Hash-Leak:** **Pass.** `selectCustomerUserPublic()` ist Pflicht in jedem Customer-Endpoint (§4.3, §6.1). `CustomerUserPublicSchema.strict()` enthält **keine** `passwordHash`-Property → Strict-Parse wirft, falls durchgesickert. Snapshot-Test S10 in §12.1 prüft jeden Customer-Pfad. Defense-in-Depth: Helper + Strict + AST-Scan + Snapshot.
- **Email-Enumeration auf `/forgot-password`:** **Concern (m1-IT7).** Konstante Antwort ja, konstante Latenz nicht durchgehend garantiert.
- **Reset-Token-Race:** **Concern (m2-IT7).** `$transaction` mit Read-then-Write reicht zwar auf SQLite voraussichtlich, aber Conditional-UPDATE wäre konsistenter zur F2-Härtung.
- **Token-Klartext-Leak:** **Pass.** §5.1 (`schema.prisma` Zeile 612–614 + 634), §5.2/5.3: SHA-256-Hex-Digest in DB, Klartext nur in Resend-Mail. UNIQUE auf `tokenHash`. Kein DB-Klartext.
- **Reset-Token-Lifetime:** **Pass.** 1h (§5.1 + §5.3), single-use via `usedAt` (§5.2 + §5.3 Code-Skelett).
- **Rate-Limits:** **Pass.** §8 spezifiziert 8 Limiter mit Einzel-Limits. Login hat sowohl IP- als auch Email-Limiter (10/h IP + 5/h Email) → Credential-Stuffing kontrolliert. Forgot-Password hat IP- und Email-Limiter (3/15min IP + 3/h Email).
- **bcrypt-Cost:** **Pass.** Faktor 12 explizit (§4.2 Zeile 412+417, §5.3 Zeile 590, `api-routes.md` §23.2 Zeile 3476). PROJECT.md US-IT7-01 Hinweis Zeile 1550. Konsistent.

### C. Auth-Diagnose-Endpoint `/api/auth/diagnose`

- **Production-Schutz:** **Pass.** §2.1 Zeile 222: `if (process.env.NODE_ENV === 'production') notFound();`. Smoke-Test S11 (§12.1) verifiziert 404 in Prod, S12 verifiziert 200 in Dev.
- **Secrets-Leak:** **Pass.** §2.1 Zeile 263 ist explizit „Niemals ein Secret im Klartext ausliefern — nur Bool-Flags." Code-Skelett (Zeilen 232–251) liefert ausschließlich Booleans + `expectedCallbacks` + `notes`. Kein Klartext-Wert für `AUTH_SECRET`, `GOOGLE_CLIENT_SECRET` etc.
- **AUTH_SECRET / NEXTAUTH_SECRET-Aliasing:** **Concern (m5-IT7).** Aliasing funktioniert, aber Diagnose-Output gibt keine eindeutige „source"-Info, und Pflicht-Variante in `.env.example` ist `AUTH_SECRET`, aber in der Diagnose werden beide als Bool angezeigt ohne Hinweis.

### D. Promote-Skript-Sicherheit

- **ENV-Var-Schutz `ALLOW_ADMIN_PROMOTE=true`:** **Pass.** §1.2 Zeile 84–89, §1.3 README, §1.4 Failure-Mode-Tabelle erste Zeile. Skript bricht mit exit(1) ab.
- **CI/Prod-Schutz:** **Concern.** Der ENV-Guard ist da, aber **kein** zusätzlicher `NODE_ENV !== 'production'` o.ä. Wenn jemand `ALLOW_ADMIN_PROMOTE=true` versehentlich in Prod-CI setzt, läuft das Skript. §1.2 hat keinen Doppel-Guard wie `scripts/reset-users.ts` (`--force` für Prod). Akzeptabel, weil Skript idempotent + ohne destruktiven Effekt (außer Passwort-Überschreibung), aber schwächer als IT6-Wipe-Skript. Nicht-blockierend.
- **`--password` als CLI-Arg → Shell-History:** **Concern (m4-IT7).**
- **User existiert nicht:** **Pass.** §1.4 Zeile 195: „Email existiert nicht, kein --password → Random-Pwd generiert + ausgegeben." §1.2 Zeile 109–111 implementiert das. AC US-IT7-04 #3 abgedeckt.
- **Idempotenz auf bereits-ACTIVE-Admin:** **Pass.** §1.4 letzte Zeile: „Skript läuft 2x mit gleichen Args → idempotent, kein Duplikat (UNIQUE auf email)." Kein Error, das ist erwünscht (Re-Run für Tom safe).

### E. OAuth-Diagnose

- **Konkrete Diagnose-Schritte mit erwarteten Werten:** **Pass.** §2.3 Runbook auf TOP-5 reduziert. Diagnose-Endpoint liefert Live-Daten. AC US-IT7-02 #1 (4 mögliche Fehlercodes) ist abgedeckt durch Runbook-TOP-5 + DevTools-Inspect. **Aber:** Diagnose ist Lese-Werkzeug, nicht Aktiv-Reparatur — die ACs verlangen, dass Tom **eingeloggt** ist, nicht nur „weiß was zu prüfen". Siehe m6-IT7.
- **Code-Diff `auth.ts`/`customer-oauth.ts`:** **Pass.** §2.2 Zeilen 269–286 + §3 listet konkret die Eingriffe (`debug: true` in Dev, `trustHost: true` confirmed, `secret`-Aliasing). Engineer hat klare Skelett-Vorlage.
- **Test-Strategie OAuth funktional:** **Concern (m6-IT7).** Manueller Tom-Test ohne formales QA-Gate.

### F. Migration-Sicherheit

- **libSQL `DROP COLUMN`-Kompatibilität:** **Concern (m3-IT7).**
- **Bestehende User mit `passwordHash`:** **Pass.** §4.1 Tabelle Zeile 372: „`passwordHash` BLEIBT (seit IT5 nullable)." Bestand wird nicht angetastet. Verify-Status: `verificationToken` / `verificationTokenExpiry` bleiben erhalten (§4.1 Zeile 376).
- **Migration-Reihenfolge ggü. Promote-Skript:** **Pass.** §0 Build-Reihenfolge: Phase A (T-A1 Promote-Skript) ist parallel zu Phase B (T-B1 Migration). Promote-Skript benutzt nur `users`-Tabelle (Admin-Tabelle), nicht `customer_users`. Migration ist `customer_users`-Tabelle. Keine Kollision. T-A1 entsperrt Tom unabhängig von T-B1. Doku ist explizit (§0 Zeile 55).

### G. Frontend-Vollständigkeit

- **Alle 4 Customer-Pages:** **Pass mit Concern.** §23.6 in `api-routes.md` Story-Matrix listet:
  - `/konto/registrieren` ✓
  - `/konto/login` ✓
  - `/konto/verifizieren` + `/konto/verifizieren/erfolg` ✓ (zwei Sub-Pages, leicht zu übersehen)
  - `/konto/passwort-vergessen` ✓
  - `/konto/passwort-zuruecksetzen` ✓

  Das macht 5 (bzw. 6) Pages, nicht 4 wie im User-Story-Pivot-Hinweis genannt — keine Lücke, sondern Doku-Inkonsistenz. **Concern (m-doc):** im Story-Pivot-Hinweis (Zeile 39–44) sind 4 Pages genannt, in `api-routes.md` §23.6 sind es 6. Nicht-blockierend, aber Engineer sollte die §23.6-Liste als verbindlich ansehen.
- **`/konto/login` mit Email-Form + 2 OAuth-Buttons:** **Pass.** US-IT7-01 AC #4 ist eindeutig. Story `iteration-7.md` Zeile 41 bestätigt „Email-Form ZUSÄTZLICH zu OAuth-Buttons". `customer-oauth.ts` Provider-Liste in §4.2 hat alle 3 Provider. Keine Lücke.
- **Form-Validation auf Deutsch:** **Pass.** Zod-Schemas (`zod-schemas.ts` Zeilen 980–1034) haben deutschsprachige `errorMap`-Messages. Inline-Fehlermeldungen pro Feld sind in den ACs explizit (US-IT7-01 AC #3). Email-Template auf Deutsch (§5.4, `iteration-7.md` Zeile 350–352).

### H. Acceptance-Criteria-Vollständigkeit pro Story

- **US-IT7-01:** **Pass.** Alle 10 ACs (`iteration-7.md` Zeilen 54–88) sind abgedeckt durch §4 (Schema, Provider, Endpoints) + §6 (DTO) + §8 (Rate-Limits) + §10 (ENV) + Pages-Liste in `api-routes.md` §23.6.
- **US-IT7-02:** **Pass mit Concern (m6-IT7).** ACs 1–7 (`iteration-7.md` Zeilen 121–151) durch Diagnose-Endpoint + Runbook + `customer-oauth.ts`-Härtung abgedeckt. AC „Tom kann sich erfolgreich einloggen" ist nur manuell verifizierbar.
- **US-IT7-03:** **Pass mit Concern (m6-IT7).** ACs 1–6 abgedeckt analog Google. `oauth_no_email`-Failure-Mode in §3.2 verbindlich. Architect-Klärungsfrage „Must Have oder Should Have" ist in §3.4 entschieden („bleibt Must Have").
- **US-IT7-04:** **Pass.** Alle 6 ACs (`iteration-7.md` Zeilen 257–279) abgedeckt durch §1 + Failure-Mode-Tabelle §1.4. AC #5 „F1-Garantie bleibt erhalten" ist in §1.5 + S2 explizit.
- **US-IT7-05:** **Pass mit Concern (m1-IT7 + m2-IT7).** Alle 7 ACs (`iteration-7.md` Zeilen 315–343) abgedeckt durch §5 (Schema, Lifecycle, Endpoints) + §8 (Rate-Limits). Race + Latenz-Konstanz sind die offenen Punkte.

---

## Test-Strategie pro Story

> Vorbereitung für Build-QA-Phase. Ergänzt §12.1/§12.2 in `ARCHITECTURE_IT7.md`.

### US-IT7-01 — Email/Password-Auth Reversion
- **Smoke:** `POST /api/customer/register` mit gültigem Body → 201 + `CustomerUserPublicSchema.strict()`-Parse erfolgreich; **kein** `passwordHash`/`verificationToken` im Response-Body (Snapshot-Test).
- Register mit Duplicate-Email → 409 `EMAIL_ALREADY_REGISTERED`, Meldung deutsch.
- Register mit case-insensitive Email-Dupe (`Tom@x.de` vs `tom@x.de`) → 409.
- `POST /api/customer/login` mit korrekten Credentials → 200, Cookie `customer-session` gesetzt.
- Login mit falschen Credentials → 401 `INVALID_CREDENTIALS`, Meldung „E-Mail oder Passwort ungültig" (kein Hint).
- Login mit nicht-existierender Email → 401 `INVALID_CREDENTIALS` (nicht 404 — Email-Enumeration-Schutz).
- Login mit OAuth-only-Account (passwordHash IS NULL) → 422 `OAUTH_ONLY_ACCOUNT`.
- Login mit `emailVerified=false` → 200 (kein 422), Banner-Hint im Frontend.
- `GET /api/customer/verify?token=abc` mit unbekanntem Token → 410 `INVALID_OR_EXPIRED_TOKEN`.
- Verify mit gültigem Token → 200, `emailVerified=true`, `verificationToken=null`.
- `POST /api/customer/resend-verification` ohne Session → 401.
- Resend mit `emailVerified=true` → 409 `ALREADY_VERIFIED`.
- **Rate-Limit:** 11 Login-Versuche/IP in 1h → 429.
- **DTO-Leak (F3-Erweitert):** Customer mit `adminNote='SECRET'` + `passwordHash='HASHEDxx'` seeden → kein Endpoint-Response enthält diese Felder. AST-Scanner CI grün.

### US-IT7-02 — Google OAuth
- **Diagnose:** `GET /api/auth/diagnose` in Dev → 200, JSON-Response gegen erwarteten Schema validieren.
- Diagnose in Prod (`NODE_ENV=production`) → 404.
- Diagnose enthält **keine** Klartext-Secrets (regex-Scan auf Response-Body).
- **Manuell (T-M1):** Engineer + Tom durchlaufen Google-Login → `/konto`. Screenshot.
- Console-DevTools: `error=` URL-Parameter wird abgefangen und auf `/konto/login` als deutsche Meldung angezeigt.
- `customer-oauth.ts` enthält `trustHost: true`, `debug: true` in Dev, `secret: AUTH_SECRET ?? NEXTAUTH_SECRET`.

### US-IT7-03 — Facebook OAuth
- Analog US-IT7-02 mit Facebook-Provider.
- **Failure-Mode:** Facebook-User ohne Email → Redirect auf `/konto/login?error=oauth_no_email`. Frontend zeigt deutsche Meldung mit Button → `/konto/registrieren`.
- Tom-Checklist im Meta-Portal-Runbook (§3.3) abgehakt vor Sign-Off.

### US-IT7-04 — Promote-Admin-Skript
- **Smoke:** Skript ohne `ALLOW_ADMIN_PROMOTE` → exit(1).
- Skript ohne Email-Arg → exit(1) mit Usage-Hinweis.
- Skript mit `--password` < 12 Zeichen → exit(1).
- Skript mit neuem User → CREATE, Random-Pwd ausgegeben.
- Skript mit existierendem User ohne `--password` → UPDATE status=ACTIVE, Hash unverändert.
- Skript mit existierendem User + `--password` → UPDATE status=ACTIVE + neuer Hash.
- Skript zweimal idempotent → kein Duplicate-Error.
- **Kritisch (F1-Regression):** Nach Skript-Lauf, `count(users) === 1` → `curl /api/admin/setup` antwortet 410 GONE (S2 in §12.1).
- **F2-Regression:** Skript benutzt **keinen** Pfad, der einen Admin disablen würde (regex-Scan auf `disableAdminSafely` muss in Promote-Code 0 Treffer geben — aber das ist erwartet, weil das Skript nur ACTIVE setzt).

### US-IT7-05 — Passwort-Reset E2E
- **Smoke:** `POST /api/customer/forgot-password` mit existierendem User → 200, Token in DB, Mail-Mock-Aufruf.
- Forgot mit nicht-existierendem User → 200, **kein** Token in DB, **kein** Mail-Versand. Response-Body identisch.
- **Pressure (m1-IT7):** Latenz-Diff zwischen existierendem und nicht-existierendem User < 50ms (p95). Wenn >50ms → m1 reproduziert.
- `POST /api/customer/reset-password` mit gültigem Token → 200, neuer Hash in DB, `usedAt` gesetzt.
- Reset mit verwendetem Token → 410 `INVALID_OR_EXPIRED_TOKEN`.
- Reset mit abgelaufenem Token (>1h) → 410.
- Reset mit Long-Garbage-Token → 410, kein 500/Crash.
- Reset mit `password !== passwordConfirm` → 400 `VALIDATION_ERROR`.
- Reset-Response enthält **kein** `passwordHash`, **kein** `customerUser`-DTO. Strict-Schema-Parse.
- **Pressure (m2-IT7):** 2 parallele Reset-Calls mit gleichem Token → genau einer 200, einer 410. Wenn beide 200 → m2 reproduziert (TOCTOU-Hit).
- **Rate-Limit:** 4. Forgot-Password mit gleicher Email/IP in 15min → 429.
- E2E-Flow: Email → Reset-Mail → Klick → Page → neues Passwort → Login mit neuem Passwort → `/konto`.

---

## Empfehlung an Orchestrator

**Verdict:** Approved with minor notes. **Build kann starten.** F1/F2/F3 sind nicht regressiert; IT7 erweitert F3 sauber. Die sechs Minor Findings (m1–m6-IT7) sind allesamt nicht-blockierend, sollten aber vor oder während Build-Phase adressiert werden, weil sie Sicherheits-Härtung (m1, m2), Doku-Hardening (m4, m5) und QA-Gates (m3, m6) betreffen.

**Top-3 QA-Schwerpunkte für Phase 4 (Build-QA):**

1. **F3-Erweiterung verifizieren (höchstes Risiko):** Customer mit `adminNote='SECRET'` + `passwordHash='HASHEDxx'` + `verificationToken='TOKx'` + `oauthId='GOOG_xx'` seeden. Alle 6 reaktivierten Customer-Endpoints + `/api/customer/me` + `/api/customer/bookings` durchlaufen. Response-Body darf **keines** dieser Felder enthalten. CI-AST-Scanner muss grün sein. Snapshot-Test S10 verbindlich.

2. **F1-Smoke-Suite re-run nach Promote-Skript:** Promote-Skript laufen lassen → `count(users) === 1` → `curl POST /api/admin/setup` mit beliebiger Email → 410 GONE. Plus: Failure-Mode-Tabelle aus IT6 §17.1.2 erneut durchspielen (4 Szenarien).

3. **Passwort-Reset-Race + Latenz-Konstanz (m1-IT7 + m2-IT7):** 1000 parallele Calls auf `/api/customer/forgot-password` mit existierendem vs. nicht-existierendem User → p95-Latenz-Diff < 50ms (m1). 2 parallele Calls auf `/api/customer/reset-password` mit gleichem Token → genau einer 200, einer 410 (m2). Wenn einer der beiden Tests fehlschlägt → Architekt-Re-Loop.

**Zusätzlich für Build-Phase verbindlich:**
- m3-IT7: Migration-Plan-B (Tabelle-Recreate-SQL) muss vor Prod-Deploy als Fallback dokumentiert sein.
- m4-IT7: README-Block zu Shell-History-Leak ergänzen oder Stdin-Read-Mode für `--password` implementieren.
- m5-IT7: Diagnose-Endpoint-Output erweitert um `secret_source`-Feld (Aliasing-Transparenz).
- m6-IT7: Manueller OAuth-Sign-Off-Schritt (T-M1) im Build-Plan einplanen mit Screenshot in PR.

**Hinweis zu OAuth-Provider-Enum-Switch (Carry-over aus IT6 Re-Review):**
`CustomerUserPublicSchema.oauthProvider` ist bewusst auf `z.string().nullable()` gesetzt (Zeile 1093) — also kein Strict-Enum-Crash für `'facebook'`. Dieser Punkt aus IT6 bleibt damit dauerhaft entschärft.

**Re-Review erforderlich?** Nein. Architekt kann die m1–m6-IT7-Fixes direkt in Build-Phase einarbeiten; Re-QA passiert in Phase 4 (Build-QA) automatisch durch Smoke-Tests.

---

**Ende Report.**
