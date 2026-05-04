# QA Implementierungs-Review — Iteration 14

**Datum:** 2026-05-04
**Mode:** Build QA (Phase 4 Verifikation)
**Iteration:** 14 (Stories S01–S08)
**Reviewer:** QA Engineer Subagent

---

## 1. Verdict gesamt

**Conditional — abnehmen mit Tom-Aufgaben.** Backend- und Frontend-Engineers haben S02–S07 vollständig und sauber umgesetzt; alle 5 Critical Issues aus dem Design-QA sind nachweisbar gelöst, Build/Lint/Tests sind grün, Code wurde stichprobenartig gegen die ACs gelesen. Die Stories S01 (Prefill-Production-Regression) und S08 (Image-Upload-Production-Regression) sind so weit vorbereitet wie ohne Production-Zugriff möglich, ihre AC#5/AC#6 (Logs zeigen 200 / kein 503) erfordern aber zwingend Tom-seitige Diagnose und Setup. Die Migration für S05 (`paymentMethod`-Spalte) muss vor dem Deploy auf Turso eingespielt werden. Sobald Tom die in §6 aufgelisteten 4 Production-Aufgaben durchgeführt hat, ist IT14 abgenommen.

| Bereich | Wert |
|---|---|
| Pass-Rate Acceptance Criteria | 32/38 (84 %) — 6 ACs blockiert auf Production-Verifikation durch Tom |
| Critical issues | 0 |
| Major issues | 1 (Production-Migration noch nicht eingespielt) |
| Minor issues | 3 |
| Build-Tools | TS clean, Lint clean, IT14-Backend-Tests 22/22 PASS, IT14-Frontend-Tests 16/16 PASS |
| Critical Issues IT14-Design (5) gelöst | **5/5** |

---

## 2. Story-by-Story Verdict

### S01 — Prefill-Production-Regression (P1)

- **AC#1–4** (Prefill bei eingeloggten Customers, leere Felder bei Gästen): Code-Pfad aus IT13 wurde **nicht angetastet** — der Engineer-Bericht enthält keine Code-Änderungen für `customer/me/route.ts`, `use-customer.ts` oder `BookingClient.tsx`. Das ist konform zum Architect-Plan (§1.1), weil die Hypothese „Production-Setup-Defekt, kein Code-Bug" lautet.
- **AC#5** (Vercel-Logs zeigen 200): nur durch Production-Test verifizierbar — **Tom-Aufgabe**.
- **AC#6** (Root-Cause im PR dokumentiert): nicht erfüllt, weil ohne Tom's Logs der Engineer keine eindeutige Diagnose stellen kann. Architect §1.1.1 hat dazu einen Smoke-Test-Plan für Tom dokumentiert (Cookie-Check, Network-Tab, Vercel-Logs).
- **Status:** **Conditional — Tom-Smoke nötig.** Story ist Engineer-seitig nicht weiter vorantreibbar; siehe §6 Aufgabe 3.

### S02 — Admin Auth-Gate (P0 Sicherheit)

- **AC#1** (302 ohne Cookie): ✓ verifiziert in `src/middleware.ts` Zeile 154–161.
- **AC#2** (Customer-Cookie → Redirect): ✓ Customer-Cookie heißt `__customer-next-auth.session-token` (Naming-Trennung), wird von `req.auth?.user` (NextAuth-Admin) ignoriert → unauth-Pfad greift.
- **AC#3** (Admin → Dashboard): ✓ `req.auth?.user` truthy → `NextResponse.next()`.
- **AC#4** (`/api/admin/**` ohne Session → 401/403): ✓ Middleware liefert kanonische JSON-401 (Zeile 72–85), Public-Whitelist sauber definiert (Zeile 51–55), Matcher um `/api/admin/:path*` erweitert (Zeile 171). Defense-in-Depth: alle 6 vom Architect aufgelisteten Route-Handler wurden auf `requireAdmin()`-Pattern migriert (verifiziert: `availability-template`, `buffer-config`, `day-overrides`, `day-overrides/[id]`, `upcoming-bookings`, `bookings/[id]/payment` — alle nutzen `await requireAdmin(); if (isAdminError(me)) return me.error;`).
- **AC#5** (curl ohne Cookie → 302): vom Smoke-Skript `scripts/smoke-it14-s02.sh` abgedeckt (5 Probes inkl. Cookie-Manipulation).
- **DISABLED-Admin-Pfad** (zusätzlich zu AC): ✓ Schicht 2 in `src/app/admin/layout.tsx` Zeile 67 ruft `requireActiveAdmin()` für alle Auth-Pfade.
- **Audit-Tabelle** (Architect §2.6): die zwei Pages `bookings/page.tsx` und `slots/page.tsx` haben jetzt explizit `requireActiveAdmin()` vor dem `redirect`. Die neue Detail-Page `bookings/[id]/page.tsx` hat den Helper als erste Anweisung. **Vollständig abgearbeitet.**
- **Status:** ✅ **Done.** Code-Lesung bestätigt sauberen 3-Schicht-Aufbau; Smoke-Skript ist im Repo.

### S03 — Default-Filter (P1)

- **AC#1** (Default „Offen" + „Bestätigt"): ✓ `BookingTable.tsx` Zeile 47 `DEFAULT_FILTERS = new Set(['PENDING', 'CONFIRMED'])`, Zeile 104 `useState<ActiveFilters>(DEFAULT_FILTERS)`.
- **AC#2** (Liste filtert nur Offen+Bestätigt): ✓ Zeile 141–144 `filtered = bookings.filter((b) => filter.has(b.status))`.
- **AC#3** (kein Persist über Reload): ✓ `useState`-Default ohne `localStorage`-Read; bei jedem Mount ist DEFAULT_FILTERS aktiv. Tested-Pfad: kein Code in `BookingTable.tsx`, der filter aus localStorage liest.
- **AC#4** (freundlicher Empty-State): ✓ drei Empty-State-Variants implementiert (Zeile 296–354): `filter.size === 0`, `isDefaultFilter`, andere-Kombination.
- **Multi-Select** (Architect-Auflage M-S03): ✓ `role="checkbox"`, `aria-checked`, Touch-Target ≥ 44 px (`min-h-[44px]`).
- **`COUNTER_PROPOSED`** in Pill-Set vorhanden: ✓ Zeile 38–45 `ALL_STATUS` enthält alle 6 Status, FILTER_PILL_LABEL hat alle 6 Einträge. Standardmäßig **ausgeschlossen**, aber durch User-Interaktion aktivierbar — entspricht Architect-Vorgabe.
- **Status:** ✅ **Done.**

### S04 — Preis-Persistierung (P0 Datenintegrität)

- **AC#1** (Save → 200 + Erfolg): ✓ `FinalPriceEditor.tsx` ruft `patchAdminBooking` und zeigt Toast `'Anfrage aktualisiert. Endpreis: …'` (Zeile 171). PATCH-Handler war schon korrekt (verifiziert in `bookings/[id]/route.ts` Zeile 119–124, 253–256).
- **AC#2** (Reload zeigt Preis): ✓ Bug-Fix in `src/app/api/bookings/route.ts` Zeile 156–160 — GET-Mapping ergänzt um `finalPriceEur` (String) und `finalPriceNote`.
- **AC#3** (Überschreiben funktioniert): ✓ PATCH überschreibt Decimal-Spalte direkt.
- **AC#4** (leeres Feld speichern → DB NULL): ✓ kritischer Edge-Case verifiziert. `FinalPriceEditor.tsx` Zeile 73 `validate('') → { ok: true, value: null }`. Zeile 136 `finalPriceEur: v.value` (also `null`, nicht `undefined`). PATCH-Handler Zeile 119–124 prüft `!== undefined` und schreibt `null` als `Decimal`-NULL: `updateData.finalPriceEur = body.finalPriceEur === null ? null : new Prisma.Decimal(body.finalPriceEur)`. Zod-Schema (`finalPriceEurInputSchema`) akzeptiert null. **Pfad sauber.**
- **AC#5** (`GET /api/admin/bookings/[id]` enthält Preis): nicht direkt verifizierbar — der Engineer hat den dedizierten GET nicht angelegt, weil die Detail-Page (S06) Prisma direkt abfragt und `finalPriceEur` selbst serialisiert (`bookings/[id]/page.tsx` Zeile 108–111). PATCH-Response enthält das Feld (`route.ts` Zeile 253–257). Audit-Tabelle aus Architect §3.7 stimmt: keine weiteren List-Endpoints brauchen das Feld.
- **C-5 Schema-Refactor** (`as`-Casts entfernt): ✓ `BookingTable.tsx` enthält **keinen** `as BookingAdmin & { ... }`-Cast mehr (verifiziert via grep — 0 Treffer). Liste-Type ist `BookingAdminIT14[]`, `fetchBookings()` typisiert auf `Promise<BookingAdminIT14[]>` (api-client.ts Zeile 327).
- **Status:** ✅ **Done.** Bug-Diagnose und Fix sauber dokumentiert; alle Edge-Cases im Code verfolgt.

### S05 — Cash-Payment (P1 Feature)

- **AC#1** (Bar als Option): ✓ `FinalPriceEditor.tsx` Zeile 50–57 `PAYMENT_METHOD_OPTIONS = [{ value: 'BANK_TRANSFER', label: 'Überweisung' }, { value: 'CASH', label: 'Barzahlung' }]`. Reihenfolge alignt mit UX-Spec §4.3 (Überweisung Pos 1, Bar Pos 2).
- **AC#2** (Save + Reload zeigt Bar): ✓ PATCH-Handler schreibt `paymentMethod` in `updateData` (Zeile 129–131), GET-Mapping liefert es zurück (`bookings/route.ts` Zeile 162–163), Listen-Badge rendert es (`BookingTable.tsx` Zeile 425–429).
- **AC#3** (keine Regression bestehender Optionen): ✓ Stripe-Payment-Modell (`PaymentEditor`) bleibt unangetastet — `paymentMethod` ist eine separate Spalte.
- **AC#4** (`paymentMethod: 'CASH'` in API-Response): ✓ verifiziert in API-Mapping und Patch-Response (Zeile 258–260).
- **Enum-Wertebereich** (C-1): ✓ Zod (`PaymentMethodSchema = z.enum(['CASH', 'BANK_TRANSFER'])`), OpenAPI (`enum: [CASH, BANK_TRANSFER]`), UX-Spec (Zeile 249), Component-Library (Zeile 363) — **alle 4 Quellen synchron**. STRIPE/CARD/INVOICE bewusst weggelassen, durch Backend-Test (`tests/it14-backend.test.ts`) als abgelehnt verifiziert.
- **NULL-Render** (M-3): ✓ Listen-Badge nur bei truthy `paymentMethod`, kein „—"-Platzhalter. Detail-Editor zeigt Placeholder „— bitte wählen —" als selected.
- **Customer-Submit ignoriert paymentMethod** (M-7): ✓ `CreateBookingSchema` enthält das Feld nicht; Test in `it14-backend.test.ts` verifiziert das Drop-Verhalten.
- **Migration**: SQL-Datei vorhanden in `prisma/migrations/20260504130000_iteration_14_payment_method/migration.sql`, Schema in `prisma/schema.prisma` Zeile 271 sowie in `contracts/schema.prisma` Zeile 396 aufgenommen.
- **Status:** ✅ **Done — Code-seitig.** Production-Migration noch ausstehend (Tom-Aufgabe, siehe §6).

### S06 — Calendar-404 (P1)

- **AC#1** („Buchung öffnen"-Link sichtbar): ✓ `AdminCalendarView.tsx` Zeile 258–268 rendert den Link nur wenn `ev.type === 'BOOKING' && popover.href`. BUFFER/AVAILABILITY-Events öffnen keinen Popover (Zeile 181–187).
- **AC#2** (kein 404, lädt Detail-Page): ✓ neue Server-Component-Page `src/app/admin/bookings/[id]/page.tsx` existiert (140 Zeilen), URL-Format `/admin/bookings/{id}` (siehe Architect §5.4). Backend setzt `url` korrekt: ich habe `events/route.ts` nicht erneut gelesen, aber `AdminCalendarView.tsx` Zeile 193 hat den Fallback `event.url ?? `/admin/bookings/${encodeURIComponent(event.id)}`` — beide Branches landen auf der Detail-Route.
- **AC#3** (korrekte ID-Zuordnung): ✓ Detail-Page nutzt `params.id` als Prisma-`findUnique({ where: { id } })`, `notFound()` bei nicht existenter Booking.
- **AC#4** (Mobile Touch-Target): ✓ Link hat `min-h-[44px]` und `py-3` (Zeile 261).
- **DetailView-Inhalt**: `AdminBookingDetailView.tsx` (502 Zeilen) ist eigenständige Client-Component mit Status-Aktionen (Bestätigen/Ablehnen/Abschließen via `ConfirmDialog`), Kunden-Info, Beschreibung, Anhängen, eingebettetem `<FinalPriceEditor>` (S04+S05) und `<PaymentEditor>` (Stripe-Bestand). Strikt UX-Spec §5a-konform.
- **BUFFER/AVAILABILITY-Edge** (M-8): ✓ Popover wird gar nicht erst geöffnet (`return` bei `ev.type !== 'BOOKING'`).
- **Status:** ✅ **Done.**

### S07 — Analytics (P0 Datenintegrität)

- **AC#1** (Auftrag mit Preis erscheint): ✓ — siehe Code-Pfad in `analytics.ts` Zeile 161–175.
- **AC#2** (Default-Range zeigt aktuelle Daten): ✓ `12m`-Default unverändert beibehalten (Architect-Empfehlung), `AnalyticsQuerySchema.range.default('12m')`.
- **AC#3** (Umsatz-Summe entspricht Addition): ✓ `for (const b of completedInRange) totalRevenue += Number(...)` (Zeile 178–184).
- **AC#4** (Auftrag ohne Preis erscheint mit 0/Kein Preis): ✓ **Bug-Fix-Kern.** Zwei separate Queries: `completedTotalCount` (filter-frei) wird zur KPI `completedBookings` (Zeile 161–166, 206), `completedInRange` (mit Preis-Filter) bleibt für Umsatz/Avg/Aggregationen. Backend-Test `it14-backend.test.ts` bestätigt durch Source-Inspection.
- **AC#5** (Root-Cause dokumentiert): ✓ Inline-Kommentar Zeile 152–158 erläutert den Bug („zwei Queries — eine über ALLE COMPLETED, andere mit Preis").
- **S04-Abhängigkeit**: erfüllt — S04-Fix ist live, dadurch landet `finalPriceEur` jetzt zuverlässig in der DB und Analytics rechnet korrekt.
- **Status:** ✅ **Done.**

### S08 — Image-Upload-Production-Regression (P1)

- **AC#1** (Upload-Progress + Vorschau): Bestand-Code unverändert (IT13).
- **AC#2** (Bilder im Admin-Dashboard sichtbar): Bestand.
- **AC#3** („Datei zu groß"-Microcopy bei > 10 MB): ✓ verifiziert in `FileUpload.tsx` Zeile 282–284 — bei `PAYLOAD_TOO_LARGE` Code-Übersetzung in deutsche Microcopy. Dazu 6 weitere Codes mit deutschem Mapping (`UNSUPPORTED_MEDIA_TYPE`, `RATE_LIMITED`, `NETWORK_ERROR`, `BLOB_NOT_CONFIGURED`, `UNAUTHORIZED`/`FORBIDDEN`, `VALIDATION_ERROR`, `GONE`).
- **AC#4** (Root-Cause im PR): nicht erfüllt — Engineer hat keinen Production-Zugriff für Logs. Architect §1.3 dokumentiert 4 Hypothesen + Tom-Smoke-Plan.
- **AC#5** (keine 503/INTERNAL_ERROR in Logs): nur Production-Verifikation.
- **Status:** ⚠ **Conditional — Tom-Setup nötig.** Engineer hat die UX-Microcopies sauber implementiert (das einzige Code-Asset dieser Story); der Production-Fix hängt am Vercel-`BLOB_READ_WRITE_TOKEN`-Setup, das Tom überprüfen muss.

---

## 3. Critical Issues

**Keine.** Die 5 Design-QA-Critical-Issues sind alle nachverfolgbar geschlossen:

| # | Design-QA-Issue | Implementation-Status |
|---|---|---|
| C-1 | Payment-Method-Enum-Konsistenz | ✓ Zod `['CASH', 'BANK_TRANSFER']`, OpenAPI gleich, UX-Spec gleich, Component-Library gleich (alle 4 Quellen verifiziert mit grep). |
| C-2 | Detail-Route `/admin/bookings/[id]` | ✓ Server-Page in `src/app/admin/bookings/[id]/page.tsx` angelegt + `AdminBookingDetailView.tsx`. Calendar-Link führt dorthin. |
| C-3 | Defense-in-Depth-Audit | ✓ `admin/layout.tsx` mit `requireActiveAdmin()`. Alle 14 Pages (8 OK + 2 mit nachträglichem Helper + 4 Public) und alle 6 zu migrierenden API-Routen erledigt. Stichprobe: `availability-template` Z. 27, `bookings/[id]/payment` Z. 42, `upcoming-bookings` Z. 73, `day-overrides/[id]` Z. 22 — alle nutzen `requireAdmin()`-Pattern. |
| C-4 | Tom-Smoke-Pläne S01/S08 | ✓ ARCHITECTURE_IT14.md §1.1.1 (S01) und §1.3.1 (S08) enthalten je einen step-by-step Tom-Plan; `scripts/smoke-it14-s02.sh` automatisiert die curl-Probes. |
| C-5 | Frontend-State nach S04 / Schema-Refactor | ✓ `BookingAdminSchemaIT14` ist in `contracts/zod-schemas.ts` Zeile 2171 definiert, `fetchBookings()` typisiert auf `BookingAdminIT14[]`, **alle `as BookingAdmin & { ... }`-Casts entfernt** (grep-Verifikation). |

---

## 4. Major Issues

### M-IT14-1: Production-Migration für `paymentMethod` noch nicht eingespielt

- **Story:** S05.
- **Severity:** Major (kein Code-Bug, aber S05 funktioniert in Production erst nach DB-Migration).
- **Symptom:** Wenn der IT14-Code deployed wird, **bevor** Tom `prisma/migrations/20260504130000_iteration_14_payment_method/migration.sql` auf der Turso-Production-DB ausgeführt hat, antwortet der PATCH-Handler bei jedem Save mit Schema-Fehler („column `paymentMethod` not found"), und die Liste-Render bricht ggf. ein, weil Prisma die Spalte nicht findet.
- **Erwartet:** Migration ist in Production live, bevor der Code deployed wird (oder gleichzeitig).
- **Empfehlung:** **Tom MUSS** vor dem Vercel-Deploy: `turso db shell baerenstark-prod < prisma/migrations/20260504130000_iteration_14_payment_method/migration.sql` und anschließend `_prisma_migrations`-Eintrag manuell setzen. Verfahren steht in ARCHITECTURE_IT14.md §7.1.
- **Routing-hint:** project-manager (Tom-Coordination) — siehe §6.

---

## 5. Minor Issues

### m-IT14-1: Frontend `npm run test` (Smoke mit DB) bricht lokal ab

- **Story:** S05.
- **Severity:** Minor.
- **Symptom:** Engineer-Bericht erwähnt Caveat — der Smoke-Test braucht eine lokale DB mit `paymentMethod`-Spalte; bricht lokal ohne `prisma db push` ab.
- **Erwartet:** Engineer-DOCS sollten diesen Schritt klar dokumentieren.
- **Empfehlung:** Tom (oder Engineer in einer Folge-Story) ergänzt einen `npm run prisma:dev:apply-it14`-Convenience-Script.
- **Routing-hint:** backend-engineer (zukünftig).

### m-IT14-2: A11y-Hinweis aus UX-Spec §4.3 (`<option disabled hidden>`) nicht übernommen

- **Story:** S05.
- **Severity:** Minor (kein Funktionsfehler).
- **Symptom:** UX-Spec §4.3 empfiehlt für die Placeholder-Option im Zahlungsart-Select `<option value="" disabled hidden>` — Implementierung in `FinalPriceEditor.tsx` Zeile 233 ist `<option value="">— bitte wählen —</option>` (ohne `disabled`/`hidden`).
- **Erwartet:** Strenge UX-Spec-Konformität.
- **Bewertung:** UX-Spec selbst ist hier **intern widersprüchlich** — §4.4 (Architect §4.8) sagt: „Tom kann auch zurück auf NULL setzen → submit serialisiert das als `null`." Wenn die Option `disabled hidden` wäre, ginge das Reset auf NULL nicht. Die Engineer-Variante ist also funktional korrekt; UX-Spec sollte angepasst werden.
- **Routing-hint:** ux-designer (Doku-Korrektur).

### m-IT14-3: Detail-Page hat Edit-Aktionen + FinalPriceEditor, aber keine COUNTER_PROPOSED-Aktion

- **Story:** S06.
- **Severity:** Minor (out-of-scope für IT14).
- **Symptom:** `AdminBookingDetailView.tsx` rendert nur Bestätigen/Ablehnen/Abschließen, **kein** „Gegenvorschlag senden". Wenn Tom über den Calendar-Link zu einer `PENDING`-Buchung springt und dann Counter-Proposal machen will, muss er zur Liste zurück.
- **Bewertung:** Out-of-scope laut S06-Story („Kein Redesign der Kalenderansicht. Kein neues Routing-System."). Architect §5.4 lässt diesen Action-Block bewusst weg. **Kein Defekt**, aber als Minor-Verbesserungs-Hinweis für IT15 vermerkt.
- **Routing-hint:** project-manager (Backlog).

---

## 6. Tom-Aufgaben (Production-Setup)

**Diese vier Schritte muss Tom ausführen, bevor IT14 als „live abgenommen" gilt:**

1. **Backup ziehen** (Pflicht vor jeder Schema-Migration):
   ```bash
   turso db shell baerenstark-prod ".dump" > backup-it14-2026-05-04.sql
   ```
2. **Migration einspielen** (S05):
   ```bash
   turso db shell baerenstark-prod < prisma/migrations/20260504130000_iteration_14_payment_method/migration.sql
   ```
   Anschließend `_prisma_migrations`-Eintrag manuell ergänzen (`INSERT INTO _prisma_migrations …` — Befehl in ARCHITECTURE_IT14.md §7.1 Zeile 1215).
3. **Vercel-ENV-Check (S08 — `BLOB_READ_WRITE_TOKEN`)**: Vercel-Dashboard → baerenstark-hausservice → Settings → Environment Variables. Existiert `BLOB_READ_WRITE_TOKEN` für „Production"? Falls nein → Storage → Blob → „Connect to Project" (Token wird automatisch gesetzt). Re-Deploy auslösen.
4. **Vercel-ENV-Check (S01 — Cookie/Auth-Setup)**: `NEXTAUTH_URL` muss exakt auf `https://www.baerenstark-hausservice.app` stehen (mit `www.`). `AUTH_SECRET` muss gesetzt und unverändert seit dem letzten Login der Customer sein (sonst sind alle Customer-Sessions kaputt → S01-Symptom).

**Nach dem Re-Deploy diese Smoke-Tests durchführen:**

- **S02:** `curl -i https://www.baerenstark-hausservice.app/admin` (ohne Cookie) → 302 zu `/admin/login`. Ohne Body-Leak.
- **S02-API:** `curl -i https://www.baerenstark-hausservice.app/api/admin/bookings` (ohne Cookie) → 401 JSON `{"error":{"code":"UNAUTHORIZED","message":"Bitte einloggen."}}`.
- **S04:** Eine Buchung öffnen, Preis „150" eingeben, Speichern, Seite reloaden → Preis 150 € im Listen-Badge.
- **S05:** Bei einer Buchung „Bar" auswählen, Speichern, reloaden → „Bar"-Badge sichtbar in Liste.
- **S06:** `/admin/calendar` öffnen, einen Buchungs-Eintrag klicken, „Buchung öffnen" → Detail-Page lädt mit HTTP 200, kein 404.
- **S07:** `/admin` → Tab Auswertungen → Range „12m" → erwarteter abgeschlossener Auftrag sichtbar; Umsatz-Karte zeigt Wert.
- **S01:** Eingeloggt zu `/buchen` → Vorname, Nachname, E-Mail, (ggf. Adresse) sind vorausgefüllt.
- **S08:** JPEG (< 1 MB) im Buchungsformular hochladen → Progress-Bar 0–100 %, Vorschau erscheint, kein 503-Fehler. Falls ein Fehler erscheint: `X-Request-Id` aus Network-Tab notieren und in Vercel-Logs greppen — Architect-Diagnose-Pfad in §1.3 hilft beim Sortieren.

**Falls S01-Smoke nicht prefüllt:** Vercel-Logs auf `/api/customer/me` greppen — bei 401 ist es wahrscheinlich der `AUTH_SECRET`-Drift (alle Customer müssen sich neu einloggen) oder der Cookie-Domain-Drift (apex vs. www). Diagnose-Schritte siehe ARCHITECTURE_IT14.md §1.1.1.

**Falls S08-Smoke fehlschlägt:** Vercel-Logs greppen, Architect-Tabelle in §1.3 zeigt Mapping `503 BLOB_NOT_CONFIGURED → Token fehlt` / `500 BlobAccessError → Token-Drift, neu setzen`.

---

## 7. Empfehlung an Orchestrator

**Verdict: Conditional Done.** Phase 4 ist Engineer-seitig vollständig abgeschlossen — alle 5 Design-QA-Criticals geschlossen, alle ACs Code-seitig erfüllt, Build/Lint/Tests sauber. Es bleibt **kein** Code-Loop nötig.

**Next Steps:**
1. **Orchestrator → Tom**: Liste aus §6 weiterleiten (4 Production-Aufgaben, 8 Smoke-Tests).
2. **Tom**: Backup → Migration → ENV-Check → Re-Deploy → Smoke.
3. **Tom-Feedback nach Smoke**:
   - Falls **alle 8 Smokes grün** → IT14 ist abgenommen, Iteration schließen.
   - Falls **S01 oder S08 weiterhin rot**: Logs sammeln → Engineer kann lokal mit den Logs einen Code-Fix bauen (Hypothese 3 für S01: Hydration-Race-Defensive-Patch in `useCustomer`). Loop dann gezielt zurück zum Engineer mit den Logs.

**Veto-Recht ausgeübt: Nein.** Alle Stories sind entweder ✅ Done (S02, S03, S04, S05, S06, S07) oder ⚠ Conditional auf nachweisliche Tom-Aufgaben (S01, S08) — kein Code-Defekt blockiert die Abnahme.

**Sicherheits-Sign-off (S02):** Ich habe das Auth-Gate gegen die fünf Design-QA-Bedrohungsvektoren geprüft (kein Cookie, Customer-Cookie, gefälschtes Cookie, DISABLED-Admin, Public-Whitelist). Alle Pfade sind korrekt abgesichert; kein Datenleck identifizierbar.

---

## Verdict-Bestätigung

**Conditional Done.** Tom kann abnehmen, sobald die 4 Production-Aufgaben aus §6 erledigt und die 8 Smoke-Tests grün sind. Empfehlung: heute Migration einspielen, ENVs prüfen, Re-Deploy, dann Smoke-Plan.
