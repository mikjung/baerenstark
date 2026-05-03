# QA Implementation Review — Iteration 6

Datum: 2026-05-03
Reviewer: qa-engineer
Scope: Implementation-Verifikation (Code-Review + Hygiene + Smoke-Tests) für Stories US-IT6-01 bis US-IT6-09 nach Architecture-Revision v1.6.1 / Anhang B §17.

---

## Hygiene

| Check | Ergebnis | Bemerkung |
|-------|----------|-----------|
| `npx tsc --noEmit` | **PASS** | 0 Errors |
| `npm run lint` | **PASS** | „No ESLint warnings or errors" |
| `npm test` | **PASS** | 171 passed, 0 failed (2 SKIP — F1/F2-Tests setzen leere Tabelle voraus, korrekt deklariert) |
| `tsx scripts/check-dto-leaks.ts` | **PASS** | „[check-dto-leaks] OK — keine Customer-DTO-Leaks gefunden." |
| Migration `20260503083723_iteration_6/migration.sql` | **PASS** | DECIMAL-Spalten, adminNote/adminRating, status-Index, reviews-Reject-Spalten, alle Indices vorhanden. Keine destruktiven Operationen. |
| Bonus: grep `adminNote` / `adminRating` in `src/app/api/customer/**`, `src/app/api/reviews/**`, `src/app/api/availability/**` | **PASS** | Nur ein Treffer im Kommentar (`/api/customer/me/route.ts` Zeile 59 als Reminder). Keine Datenleckage. |

---

## Verdict pro Story

| Story | Verdict | Note |
|-------|---------|------|
| US-IT6-01 | DONE | Setup-Allowlist (F1), `disableAdminSafely` (F2), Self-/Last-Admin-Lock, Idempotenz alles vorhanden. Middleware-Status-Check fehlt (siehe D2 — Architektur dokumentiert das aber als bewusste Edge-Limit; Page-Component-Redirect bei DISABLED ist trotzdem Pflicht und fehlt in `src/app/admin/*/page.tsx`). |
| US-IT6-02 | DONE | FullCalendar mit `locale=de`, `timeZone=Europe/Berlin`, 44px-Touch-Floor, Range-Limits 90 Tage Admin / 62 Tage Public verbindlich im Schema, Cache-Header für Public-Endpoint korrekt. |
| US-IT6-03 | DONE | POST validiert `status==='COMPLETED'` (409 `BOOKING_NOT_COMPLETED`), `PublicReviewSchema` ist `.strict()`, m7-Auto-Reject bei Booking-CANCELLED-Rollback in `prisma.$transaction` atomar, `revalidateTag('public-reviews')` getriggert, UNIQUE-bookingId-Schutz aktiv. |
| US-IT6-04 | DONE mit Note (D1) | sitemap+robots korrekt, JSON-LD `LocalBusiness` vollständig, generateMetadata gesetzt, `/admin` und `/api` und `/konto` in Disallow-Liste. **Defekt D1**: Sitemap referenziert `/services/<slug>`, aber `src/app/services/[slug]/page.tsx` existiert nicht → Crawler bekommt 404 für jede der 6 Service-URLs. |
| US-IT6-05 | DONE mit Note (D3) | Nur Google + Facebook in `customer-oauth.ts` (GitHub raus, Credentials raus), `docs/AUTH_GOOGLE_FIX_RUNBOOK.md` mit konkreten Fix-Schritten, `/konto/registrieren` redirectet zu `/konto/login`, LoginForm hat keine Email/Pwd. **Defekt D3 (Minor)**: Legacy-Endpoints liefern 410 GONE statt 404 (AC fordert HTTP 404). Funktional äquivalent (Resource-gone-Hinweis), aber AC-Wortlaut nicht erfüllt. |
| US-IT6-06 | DONE mit Note (D4) | ENV-Guard `ALLOW_USER_WIPE`, Cascade-Reihenfolge korrekt (Reviews → Bookings → CustomerUser → User), Stripe-Session-IDs werden für Tom ausgegeben, Anonymisierung statt Hard-Delete für CONFIRMED/COMPLETED. **Defekt D4 (Minor)**: Kein `--dry-run`-Flag, kein `NODE_ENV==='production'`-Schutz. Architektur-Re-Review §17.10 verlangt das nicht zwingend (Skript wird im Pair mit Tom ausgeführt), aber Design Review §G hatte das gefordert. |
| US-IT6-07 | DONE | `selectCustomerUserPublic()` / `selectCustomerUserAdmin()` als Helper, F3-CI-Check (`scripts/check-dto-leaks.ts`) green, Sort-Whitelist (m2) implementiert (`lastName_asc`, `createdAt_desc`, `bookingCount_desc`, `adminRating_desc`), `adminNote`/`adminRating` taucht NIRGENDS in Customer-/Public-Endpoints auf, Tests `CustomerUserPublic strict rejects adminNote leak` grün. |
| US-IT6-08 | DONE | `AdminBookingPatchSchema` mit Komma→Punkt-Normalisierung, Range 0–100000 EUR, `revalidateTag('analytics')` bei Touch und bei Status-Flip zu/von COMPLETED, m7-Trigger atomar im selben `$transaction`, kein Leak in Customer-API. |
| US-IT6-09 | DONE | KPIs mit Empty-State-Handling (`null` statt 0 bei keinen Daten + Banner „Noch keine Umsatzdaten"), `unstable_cache` mit Tag `analytics`, `requireAdmin()` zuerst → 401 ohne Auth. resolveRange-Tests grün. |

**Total: 9 / 9 DONE** (3 mit Minor-Notes — D1, D3, D4 — und 1 Major-Architektur-Hinweis D2).

---

## Defekte

### D1 — Sitemap referenziert nicht-existente Service-Detail-Pages (Major)

- **Story:** US-IT6-04
- **Erwartet:** Architecture §6.1 + Datei-Inventar Zeile 473 spezifiziert `src/app/services/[slug]/page.tsx` als NEU für IT6 + sitemap.xml soll alle öffentlichen Pages mit `<lastmod>` listen.
- **Tatsächlich:** `src/app/services/` Verzeichnis existiert NICHT. `src/app/sitemap.ts` Zeilen 50-55 generieren aber `${url}/services/${s.slug}` für jeden der 6 Services aus `SERVICE_LIST` → 6 URLs in der Sitemap führen zu 404 für Google-Crawler.
- **Repro:** `find src/app -path "*services*"` → leer. `cat src/app/sitemap.ts` zeigt die nicht-erfüllbaren Service-Einträge.
- **Severity:** **MAJOR** — Lighthouse-SEO-Score und Google-Indexierung leiden, AC „valide XML-Sitemap" wird de facto verletzt (404-URLs sind ungültig).
- **Routing:** `frontend-engineer` (Service-Detail-Page mit `generateMetadata` + `<JsonLd type="Service">` anlegen) ODER alternativ `solution-architect` (entscheiden, ob `/services/[slug]` für IT6 gestrichen wird → dann Sitemap-Einträge raus).

### D2 — DISABLED-Admin kann Page-Shells öffnen, weil Page-Components kein Status-Check (Major)

- **Story:** US-IT6-01
- **Erwartet:** Architecture §3.1 / Anhang B + AC „Given ein deaktivierter Admin ruft eine Admin-URL direkt auf, when die Middleware prüft, then wird er zur Login-Seite umgeleitet." Architektur §168 räumt zwar ein, dass Edge-Middleware den Status nicht prüfen kann, fordert aber explizit „erste Prüfung passiert in `requireAdmin()` im Route-Handler / Page-Component, der dann zur Login-Seite redirected mit `?error=account_disabled`."
- **Tatsächlich:** `src/app/admin/page.tsx`, `/admin/admins/page.tsx`, `/admin/users/page.tsx`, `/admin/analytics/page.tsx`, `/admin/calendar/page.tsx` etc. prüfen nur `session?.user`, **nicht** `User.status === 'ACTIVE'`. DISABLED-Admin mit gültigem Session-Cookie sieht das Page-Layout (API-Calls scheitern dann mit 403 → leere/fehlerhafte UI, kein Redirect zum Login).
- **Repro:** Admin auf DISABLED setzen, Cookie behalten, `/admin/users` aufrufen → Page-Shell rendert; `requireAdmin()` greift erst im API-Call, kein Login-Redirect.
- **Severity:** **MAJOR** — Lock-out-Schutz funktioniert für die Daten, nicht für die Navigation; AC explizit verletzt.
- **Suggested Fix:** Helper `requireAdminPage()` (Architecture §1076) implementieren und in jeder Page nutzen — `await requireAdminPage()` redirected bei `status !== 'ACTIVE'` zu `/admin/login?error=account_disabled` und ruft optional `signOut()`.
- **Routing:** `backend-engineer` (Helper) + `frontend-engineer` (Pages auf Helper umstellen).

### D3 — Legacy-Auth-Endpoints liefern 410 GONE statt 404 (Minor)

- **Story:** US-IT6-05
- **Erwartet:** AC „Given die Route /konto/registrieren (E-Mail/Passwort) und /api/auth/register existierten bisher, when IT6 deployed wird, then geben diese Routen HTTP 404 zurück." Architecture Zeile 55 + Zeilen 1167-1168 + Zeile 1302 sagen explizit „404".
- **Tatsächlich:** `src/app/api/customer/login/route.ts`, `register/route.ts`, `forgot-password/route.ts`, `reset-password/route.ts`, `resend-verification/route.ts`, `verify/route.ts`, `verify-email/route.ts` retournieren alle `apiError({ code: 'GONE' })` → HTTP 410.
- **Severity:** **MINOR** — Funktional äquivalent (Resource-gone-Hinweis), Frontend zeigt freundlichen Banner via `legacy_credentials`-Error. Aber der AC-Wortlaut „HTTP 404" ist verletzt; alte Clients (z.B. SDKs) erwarten 404.
- **Suggested Fix:** Entweder die Verzeichnisse löschen (Next.js liefert dann 404 von selbst — entspricht Spec Zeile 577), ODER ein einfaches `notFound()` aus `next/navigation` werfen, ODER die ACs/Architecture in 410 nachpflegen.
- **Routing:** `solution-architect` (entscheiden 404 vs. 410) oder `backend-engineer` (Verzeichnisse löschen, falls 404).

### D4 — `reset-users.ts` ohne `--dry-run` und ohne NODE_ENV-Production-Guard (Minor)

- **Story:** US-IT6-06
- **Erwartet:** Design Review §G hatte gefordert: „Skript ohne `ALLOW_USER_WIPE` → bricht ab. Skript mit `ALLOW_USER_WIPE=true` + `NODE_ENV=production` ohne `--force` → bricht ab. Skript mit `--dry-run` → schreibt nichts." Architektur §8.3 ergänzte: „`--dry-run` Modus + `ALLOW_USER_WIPE`-ENV. Zusätzlich `NODE_ENV === 'production'` → bricht ab, außer `--force`."
- **Tatsächlich:** Nur ENV-Guard implementiert (`ALLOW_USER_WIPE`). Kein `process.argv`-Parsing für `--dry-run`/`--force`, kein NODE_ENV-Check. Wenn ENV gesetzt, läuft das Skript sofort durch, auch in Prod.
- **Severity:** **MINOR** — Skript wird laut §17.10 im Pair mit Tom ausgeführt, ENV ist explizit zu setzen → Operations-Risk akzeptabel. Aber das Sicherheitsnetz aus Spec ist nicht eingebaut.
- **Suggested Fix:** `--dry-run`-Flag (vor allen `*.deleteMany`/`updateMany` `if (dryRun) return summary;`); zusätzliches `if (process.env.NODE_ENV === 'production' && !args.includes('--force')) exit(1)`.
- **Routing:** `backend-engineer`.

---

## Sicherheits-Sign-Off

### F1 — Bootstrap-Race (PASS)

- `src/app/api/admin/setup/route.ts` implementiert die Failure-Mode-Tabelle aus Anhang B §17.1.2 wortgetreu:
  1. `count(users) >= 1` → 410 GONE (ENV ignoriert) — Zeilen 42–48.
  2. ENV `BOOTSTRAP_ADMIN_EMAIL` fehlt → 503 `SETUP_NOT_CONFIGURED` — Zeilen 51–58.
  3. Body-Validation per `AdminSetupSchema.parse` — Zeile 65.
  4. Email-Mismatch → 403 `BOOTSTRAP_NOT_ALLOWED` — Zeilen 69–76.
  5. `prisma.$transaction` mit Re-Check `count > 0` vor Insert — Zeilen 82-103. **Atomar, keine Race-Window.**
- Tests `IT6 — Setup-Endpoint Bootstrap-Gates (F1)` sind im SKIP-Modus, weil bereits ein Admin in der Test-DB existiert. Implementierung wurde durch Code-Review bestätigt.

### F2 — Letzter-Admin-Race (PASS)

- `src/lib/admin-status.ts::disableAdminSafely()` ist exakt das in §17.2.1 spezifizierte Conditional UPDATE mit Subselect:
  ```
  UPDATE users SET status='DISABLED'
  WHERE id = :targetId AND status = 'ACTIVE'
    AND EXISTS (SELECT 1 FROM users u2
                WHERE u2.id <> :targetId AND u2.status = 'ACTIVE')
  ```
  TOCTOU-frei, libSQL/SQLite-kompatibel.
- PATCH und DELETE in `src/app/api/admin/admins/[id]/route.ts` rufen beide `disableAdminSafely(targetId)`. Bei `affectedRows === 0` liest der Caller den aktuellen Status und differenziert zwischen idempotent-200 (already DISABLED) und 409 `LAST_ADMIN_LOCK` (last active) — exakt §17.2.2.
- Self-Mutation-Check vorgelagert: PATCH-Status-DISABLED + targetId === me.id → 409 `SELF_MUTATION_FORBIDDEN`. DELETE same.

### F3 — DTO-Leak `adminNote` / `adminRating` (PASS)

- `src/lib/dto/user.ts` exportiert beide Helper (`selectCustomerUserPublic`, `selectCustomerUserAdmin`) mit `satisfies Prisma.CustomerUserSelect` → Type-Safe.
- Customer-Endpoints (`/api/customer/me`, `/api/customer/oauth-finalize`) verwenden `selectCustomerUserPublic()` korrekt.
- `scripts/check-dto-leaks.ts` läuft sauber durch (CI-AST-Scan analog zu §17.3.4).
- `CustomerUserPublicSchema.strict()` (Zeile 1095 in zod-schemas.ts) ist gesetzt — verifiziert via Test „CustomerUserPublic strict rejects adminNote leak".
- `PublicReviewSchema.strict()` (Zeile 1413) ist gesetzt — verifiziert via Test „PublicReviewSchema strict rejects customerId".
- grep nach `adminNote` / `adminRating` in `src/app/api/customer/`, `src/app/api/reviews/`, `src/app/api/availability/`, `src/app/api/bookings/` liefert keine Treffer (außer ein Kommentar in `/api/customer/me/route.ts` Zeile 59 als Reminder — keine Code-Leakage).

---

## Verträge

| Endpoint | api-routes.md §22 | Implementierung | Match |
|----------|-------------------|-----------------|-------|
| GET/POST /api/admin/admins | §22.1 | `src/app/api/admin/admins/route.ts` | PASS |
| PATCH/DELETE /api/admin/admins/:id | §22.1 | `src/app/api/admin/admins/[id]/route.ts` | PASS |
| GET/POST /api/admin/setup | §22.6 (REVISED) | `src/app/api/admin/setup/route.ts` | PASS |
| GET /api/admin/users + /:id PATCH/DELETE | §22.4 | `src/app/api/admin/users/{route,[id]/route}.ts` | PASS |
| GET /api/admin/analytics | §22 | `src/app/api/admin/analytics/route.ts` | PASS |
| GET /api/admin/calendar/events | §22.2 | `src/app/api/admin/calendar/events/route.ts` | PASS |
| GET /api/availability/calendar | §22.2 | `src/app/api/availability/calendar/route.ts` | PASS |
| POST /api/customer/reviews | §22.10 | `src/app/api/customer/reviews/route.ts` | PASS |
| GET /api/reviews (public) | §22.3 | `src/app/api/reviews/route.ts` | PASS (PublicReviewSchema.strict) |
| PATCH /api/admin/bookings/:id (final-price + auto-reject) | §22.5 | `src/app/api/admin/bookings/[id]/route.ts` | PASS |

---

## Frontend-Routing-Plausibilität

- `/konto/login` → keine Email/Pwd-Form, nur Google + Facebook-Buttons. **PASS**
- `/konto/registrieren` → `redirect('/konto/login')`. **PASS**
- `/admin/calendar`, `/admin/admins`, `/admin/users`, `/admin/analytics`, `/admin/reviews`, `/bewertungen` — alle `page.tsx` vorhanden. **PASS**
- Sitemap referenziert `/services/[slug]` — Pages fehlen → siehe D1.
- robots.txt sperrt `/admin`, `/api`, `/konto`. **PASS**

---

## Empfehlung

**Iteration 6 ist bedingt DONE.** Hygiene komplett grün, F1/F2/F3-Sign-Off bestanden, alle 9 Stories funktional implementiert.

Vor Go-Live MÜSSEN aber adressiert werden:

1. **D1 (MAJOR):** Service-Detail-Page anlegen ODER Service-URLs aus Sitemap entfernen → `frontend-engineer` (oder `solution-architect`-Klärung).
2. **D2 (MAJOR):** Page-Components mit `requireAdminPage()`-Helper instrumentieren, sodass DISABLED-Admin per Redirect zum Login geht → `backend-engineer` + `frontend-engineer`.

Empfohlene Folge-Maßnahmen (Minor, kein Go-Live-Blocker):

3. **D3 (MINOR):** 404 statt 410 für Legacy-Auth-Routes (oder AC-Wortlaut anpassen) → `solution-architect` Entscheidung.
4. **D4 (MINOR):** `--dry-run` + NODE_ENV-Gate im Wipe-Skript → `backend-engineer`.

**Gesamt-Verdict: ⚠️ Bedingt-DONE** — D1 und D2 sind Major-Defekte, die vor Go-Live behoben werden müssen, aber sie blockieren NICHT die Story-Funktionalität als solche und sind in weniger als einer Iteration fixbar.

---

**Ende Implementation-Review IT6.**

---

## Final Verification Pass (2026-05-03)

### Hygiene
- tsc: **PASS** (0 Errors)
- lint: **PASS** ("No ESLint warnings or errors")
- tests: **171 passed / 0 failed** (2 SKIP für F1/F2-Bootstrap-Tests, korrekt deklariert da bereits ein ACTIVE-Admin in Test-DB)
- dto-leaks: **PASS** ("[check-dto-leaks] OK — keine Customer-DTO-Leaks gefunden.")

### Defect Status

- **D1 Service-Detail-Pages: RESOLVED** — `src/app/services/[slug]/page.tsx` existiert (379 Zeilen, vollständige Hero/BA/Includes/FAQ/CTA-Struktur). `generateStaticParams()` exportiert (Zeile 39–41) und liefert exakt 6 Slugs aus `SERVICE_DETAIL_SLUGS` (`entruempelung`, `entkernung`, `reinigung`, `gruenflaechenpflege`, `muelltonnenservice`, `entsorgung`). `src/lib/services.ts` exportiert `SERVICE_DETAIL_SLUGS` (Zeile 279–280) als Filter `Service !== 'sonstiges'` und `getServiceBySlug()` (Zeile 268–272). Sitemap (`src/app/sitemap.ts` Zeilen 60–67) referenziert dieselbe Liste via `SERVICE_LIST.filter(s => s.slug !== 'sonstiges')` → **kein Slug-Mismatch**, beide Quellen leiten von der gemeinsamen `SERVICES`-Konstante ab. JSON-LD via `serviceJsonLd()` + `generateMetadata()` mit Canonical und OG/Twitter implementiert. `dynamicParams = false` schützt vor unbekannten Slugs (404).

- **D2 Admin-Status-Check: RESOLVED** — `src/lib/require-admin.ts` exportiert `requireActiveAdmin()` (Zeile 120–138), das `auth()` + `prisma.user.findUnique({ select: { ..., status } })` macht und bei `status !== 'ACTIVE'` per `redirect('/admin/login?error=account_disabled')` umleitet (zusätzlich `?error=session_invalid` falls User-Record fehlt). Alle 6 geforderten Admin-Pages rufen den Helper als ersten Befehl: `src/app/admin/page.tsx:21`, `admin/admins/page.tsx:19`, `admin/calendar/page.tsx:22`, `admin/users/page.tsx:19`, `admin/analytics/page.tsx:24`, `admin/reviews/page.tsx:22`. DISABLED-Admin sieht jetzt keine Page-Shell mehr.

- **D3 Legacy-Auth-Endpoints: RESOLVED** — Alle Verzeichnisse GELÖSCHT. `find src/app/api/customer -type d` listet nur noch `bookings`, `logout`, `me`, `oauth-finalize`, `reviews` (+ `bookings/[id]`, `bookings/[id]/cancel`). KEINE `login`, `register`, `forgot-password`, `reset-password`, `resend-verification`, `verify`, `verify-email` mehr → Next.js liefert nun nativ 404 (AC-Wortlaut „HTTP 404" erfüllt). `grep -rn 'api/customer/login\|api/customer/register' src/` liefert **null Treffer** — keine Frontend-Komponente importiert die Legacy-Endpoints mehr.

- **D4 Wipe-Skript-Schutz: RESOLVED** — `scripts/reset-users.ts` implementiert alle drei Schichten: `--dry-run`-Flag (Zeile 73–76 `parseArgs()`, Zeilen 121, 151–207 als `if (flags.dryRun)`-Branches mit `count()` statt `deleteMany`/`updateMany`), Production-Guard (Zeile 102–118: bei `NODE_ENV === 'production'` ohne `CONFIRM_PRODUCTION_WIPE=true` → `process.exit(1)`), 5-Sekunden-Countdown vor real-Run (Zeile 124–127, im Dry-Run übersprungen). `ALLOW_USER_WIPE`-Gate weiterhin aktiv (Zeile 87–96).

### F-Findings Regression

- **F1 (Bootstrap-Race): still in place** — `BOOTSTRAP_ADMIN_EMAIL` aktiv in `src/app/api/admin/setup/route.ts` (Zeile 51). Failure-Mode-Tabelle 1–5 (count-Check 410 GONE → ENV-Check 503 → Schema → Allowlist-Match → atomare `$transaction` mit Re-Count) unverändert.
- **F2 (Letzter-Admin-Race): still in place** — `disableAdminSafely()` in `src/lib/admin-status.ts:30` mit Conditional-UPDATE-Subselect; PATCH+DELETE in `src/app/api/admin/admins/[id]/route.ts` (Zeilen 96, 222) nutzen den Helper.
- **F3 (DTO-Leak): still in place** — `selectCustomerUserPublic()` / `selectCustomerUserAdmin()` werden in `customer/me`, `customer/oauth-finalize`, `customer-auth-server`, `admin/users` (route + [id]/route) konsistent benutzt; DTO-Leak-CI-Scan grün.

### Final Verdict

**Iteration 6 ist DONE — go-live freigegeben.**

Alle 4 Defekte (D1 Major, D2 Major, D3 Minor, D4 Minor) sauber behoben, Hygiene komplett grün (tsc 0, lint 0, tests 171/171, dto-leaks OK), F1/F2/F3-Architektur-Garantien unverändert in place. Keine offenen Punkte.
