# QA Design-Review — Iteration 14

**Datum:** 2026-05-04
**Mode:** Design-QA (Phase 2 — vor Code)
**Reviewer:** Senior QA
**Scope:** 8 Stories (IT14-S01 bis IT14-S08), Architektur, OpenAPI, Migration, Frontend-Requirements, UX-Spec, Component-Library.

---

## 1. Verdict gesamt

**Pass mit Auflagen — Phase 3 darf starten, sobald die fünf in §3 als „Critical" markierten Lücken geschlossen sind.**

Der Plan ist insgesamt gut durchgearbeitet — die Architect-Code-Lokalisierungen für S03, S04, S06 sind verifizierbar korrekt (ich habe `BookingTable.tsx` Zeile 75, `bookings/route.ts` Zeile 107, `calendar/events/route.ts` Zeile 149 und `middleware.ts` Zeile 94 gegengelesen). Die OpenAPI-Diffs und die Migration sind sauber.

Aber es gibt **mehrere Inkonsistenzen** zwischen UX-Spec und Architektur (insbesondere S05 Enum-Werte, S06 Link-URL und S04 Save-Verhalten), eine **migrations-seitige Lücke** für S05 (Bestandsbuchungen mit `paymentMethod = NULL`), eine **Sicherheits-Lücke** in S02 (Defense-in-Depth ist genannt aber **nicht eingebaut** in den Code-Skizzen) sowie eine ungeklärte **Test-Plan-Frage** für S01/S08 (Production-Diagnose ohne Production-Logs).

---

## 2. Pro-Story-Verdict

### S01 — Prefill-Regression

- **AC-Coverage:**
  - AC#1, AC#2, AC#3, AC#4 sind „grün" sobald die Production-Ursache behoben ist — die UX-Manifestation ist in `ux-spec` §1 sauber dokumentiert.
  - AC#5 (Vercel-Logs zeigen 200) und **AC#6 (Root-Cause im PR dokumentiert)** sind nur dann erfüllbar, wenn der Engineer **Zugriff auf die Production-Logs hat** — der Architect-Plan benennt den Diagnose-Reihenfolge in §1.1 sehr konkret (5 nummerierte Schritte), aber **keiner dieser Schritte ist Engineer-seitig ausführbar**:
    - Schritt 1 (Browser-DevTools auf Production) → Tom-only.
    - Schritt 2 (`vercel logs`) → Tom-only.
    - Schritt 3 (Vercel-ENV-Settings) → Tom-only.
    - Schritt 4 (NetworkTab in Production) → Tom-only.
    - Schritt 5 (Lokal mit Throttling reproduzieren) → kann Engineer.
- **Risiken:**
  - **Risiko A (Critical-Test-Plan-Lücke):** AC#6 verlangt PR-Doku der Root-Cause. Wenn Tom die Logs nicht teilt, **kann der Engineer die Root-Cause nicht eindeutig benennen** — er kann nur Hypothese 3 (Hydration-Race) lokal verifizieren. Wenn die Hypothesen 1, 2 oder 4 stimmen (was laut Architect die wahrscheinlichsten sind), bleibt die Story **technisch unfertig** mit Code-Workaround statt Root-Cause-Fix.
  - **Risiko B:** Der defensive Retry-Patch in `frontend-requirements-it14.md` §6 (200ms-Verzögerung + Retry) ist eine Hypothese — wenn er ohne Diagnose blind eingebaut wird, **maskiert er einen anderen Fehler** und macht das System schwerer zu debuggen. Das Architect-Doc sagt das auch („nur einbauen, wenn Diagnose-Schritte 1+2 keine Production-Setup-Ursache zeigen") — aber ohne Tom's Mitwirkung ist das nicht entscheidbar.
- **Auflage an Architect/PM:** Tom muss in Phase 3 entweder (a) die Vercel-Logs für `[GET /api/customer/me]` der letzten 30 Tage exportieren und dem Engineer übergeben, oder (b) selbst die fünf Diagnose-Schritte aus §1.1 durchführen und das Ergebnis zurückspielen. Ohne diese Mitwirkung ist AC#6 nicht erfüllbar — dann muss die Story formell auf „Diagnose-blocker" gestellt werden, nicht heimlich als „erledigt" markiert.
- **Verdict:** **Pass mit Auflage** — Plan ist gut, aber der AC#6-Erfüllungspfad braucht Tom-Mitwirkung, und das fehlt im Plan als expliziter Schritt.

---

### S02 — Admin Auth-Gate

- **AC-Coverage:**
  - AC#1 (302 ohne Cookie), AC#2 (Customer → 403/Redirect), AC#3 (Admin OK), AC#5 (curl-Test) — durch den Middleware-Patch in §2.4 abgedeckt.
  - AC#4 (`/api/admin/**` ohne Session → 401/403) — abgedeckt durch den **neuen Matcher-Eintrag** `/api/admin/:path*` in `config.matcher`.
- **Verifikation:** Der aktuelle `middleware.ts`-Matcher hat tatsächlich nur `['/admin/:path*', '/konto/:path*']` (Zeile 94, gegengelesen) — die Architect-Diagnose stimmt.
- **Risiken:**
  - **Risiko A (Critical):** Die Code-Skizze in §2.4 ist gut, aber der Architect-Plan sagt selbst „Server-Component-`requireActiveAdmin()` bleibt als zweite Schicht (Defense-in-Depth)" — und dann liefert der Plan **keinen Auftrag an den Engineer**, diese zweite Schicht zu prüfen. In `admin/layout.tsx` (oder pro Page) muss `requireActiveAdmin()` **tatsächlich aufgerufen** werden — es gibt 11 `/admin/*` Subdirs (gegengelesen via `ls`: `passwort-reset, calendar, bookings, setup, passwort-vergessen, admins, users, marketing, slots, login, analytics, reviews`). Hat **jede** Server-Page einen Auth-Check? Der Plan sagt es nicht, das Audit fehlt.
  - **Risiko B (Major):** Die JSON-401-Response in §2.4 setzt `Content-Type: application/json` — das ist OK für API-Clients. Aber: der bestehende `requireAdmin()`-Check im Route-Handler liefert ein anderes JSON-Format (siehe `lib/require-admin.ts`). **Inkonsistenz:** wenn die Middleware jetzt vor dem Route-Handler 401 sendet, sieht der Frontend-Client zwei verschiedene 401-Shapes je nachdem, wo der Request hängenbleibt. Der OpenAPI-Contract zeigt nur ein `ApiError`-Schema — Engineer muss verifizieren, dass beide Pfade dieselbe Response-Form liefern.
  - **Risiko C (Major — Sicherheits-Pressure-Test):** Cookie-Manipulation. Wenn ein Customer den Cookie-Namen `__Secure-next-auth.session-token` selbst setzt (Browser-DevTools), wird er von der Middleware geprüft — `req.auth?.user` aus NextAuth läuft `decode(JWT)` mit dem Secret. Ohne valides Secret-signed Token wird der Cookie verworfen. **Das ist sicher**, sofern `AUTH_SECRET` nicht leakt. Plan erwähnt diese Threat-Modeling-Frage aber **nicht explizit** — sollte als „verifiziert" dokumentiert werden, sonst bleibt es eine offene Annahme.
  - **Risiko D (Minor):** Der Architect erwähnt in „Hypothese B" dass Tom's Beobachtung ein „Mess-Artefakt" sein könnte (alter Cookie noch gültig). Wenn das tatsächlich die Wurzel ist, kostet der ganze Middleware-Umbau Aufwand für nichts. **Diagnose:** Inkognito-Test in Phase 3 **bevor** der Code-Fix beginnt, nicht danach. Plan sagt das, aber ohne expliziten Engineer-Schritt.
  - **Risiko E (Critical — Server-Action-Pfad):** Eine wichtige Lücke im Plan: Next.js Server-Actions laufen über `POST /` mit einem speziellen `Next-Action`-Header — sie werden vom Matcher `/admin/:path*` und `/api/admin/:path*` **nicht** automatisch abgedeckt, sofern die Action über eine Public-Page läuft (z.B. ein Customer ruft eine Action auf, die intern eine Admin-Mutation macht). Im aktuellen Codebase werden Admin-Mutationen über Route-Handler gemacht (gegengelesen: alle haben `requireAdmin()`), aber der Plan sollte explizit dokumentieren: „Es gibt keine Admin-Server-Actions; falls in Zukunft welche eingeführt werden, ist die Middleware-Matcher-Anpassung nötig."
- **Auflage an Architect:**
  1. **Audit aller `src/app/admin/**/page.tsx` und `layout.tsx` auf `requireActiveAdmin()`-Aufruf** — einmal als Liste in der Architektur-Doku, vom Engineer in Phase 3 abzuhaken.
  2. **OpenAPI ApiError-Shape** für Middleware-401 muss exakt dem Route-Handler-Shape gleichen — Engineer-Aufgabe in Phase 3, im Architektur-Doc als Auflage festhalten.
  3. **Curl-Smoke-Tests in §7.2 erweitern** um: `curl -i -H "Cookie: __Secure-next-auth.session-token=invalid" .../admin` → 302 erwartet (nicht 200). Das fehlt aktuell.
- **Verdict:** **Pass mit Auflagen** — Code-Skizze ist OK, aber Defense-in-Depth-Audit ist nicht abgenommen.

---

### S03 — Default-Filter

- **AC-Coverage:**
  - AC#1 (Default Offen+Bestätigt), AC#2 (Listenfilter greift), AC#3 (kein Persist nach Reload), AC#4 (Empty-State) — durch das Multi-Select-Refactor in `frontend-requirements-it14.md` §2 abgedeckt.
- **Verifikation:** Der aktuelle `BookingTable.tsx` Zeile 75 hat tatsächlich `useState<StatusFilter>('ALL')` (gegengelesen) — die Architect-Diagnose stimmt.
- **Risiken / Widerspruch:**
  - **Risiko A (Major — UX/FE-Widerspruch):** UX-Spec §2.1 sagt: „Pills bleiben das UI-Pattern. **Multi-Select**." — gut. **Aber der aktuelle `BookingTable.tsx` ist Single-Select** (Zeile 75 `StatusFilter = 'ALL' | BookingStatus`, Zeile 110-113 `if (filter === 'ALL') return bookings; return bookings.filter(b => b.status === filter)`). Frontend-Requirements §2 sagt **explizit** der Refactor auf Multi-Select muss passieren. UX-Spec §2.1 sagt aber „Pattern bleibt unverändert" — ist das nur das Pill-**Visual** oder auch die **Multi-Select-Semantik**? **Inkonsistenz!** UX impliziert „heute sind es Multi-Select-Pills", Code beweist das Gegenteil — also muss der Frontend-Engineer aus IT12-Bestand neu bauen, was UX-Spec als „Bestand" annimmt. Engineer muss aus zwei widersprüchlichen Beschreibungen die richtige ableiten.
  - **Risiko B (Minor):** UX §2.3 Default-Reload-Pfad: „Reload setzt zurück auf Default. Falls heute kein expliziter Reset-Button existiert, wird in IT14 keiner hinzugefügt." Der Empty-State CTA „Alle Anfragen anzeigen →" (UX §2.4) schaltet **alle 5 Status aktiv** — das ist semantisch der entgegengesetzte Reset (alles anzeigen vs. Default zurück zu „Offen+Bestätigt"). UX-Spec §9.1 nennt das eine `[NEEDS INPUT - Tom]`-Frage. **Nicht trivial:** Wenn Tom das CTA klickt, denkt er „jetzt sehe ich alles" — aber der Memo-State ist **kein Persist** (AC#3), also nach Reload ist er wieder auf Default. Das ist verwirrend. Architect-Empfehlung sollte sein: das CTA setzt auf alle aktiv; bei nächstem Reload ist Default zurück — UX dokumentiert das, Engineer implementiert es so.
  - **Risiko C (Minor — Component-Library-Widerspruch):** `component-library-iteration-14.md` §1.5 listet die `BookingStatus`-Werte als `PENDING | CONFIRMED | CANCELLED | REJECTED | DONE` — aber der Prisma-Enum hat tatsächlich `COMPLETED` (gegengelesen via Architect-Doc §1.2 „Im Schema ist der einzige Endwert für abgeschlossene Aufträge `'COMPLETED'`. Es gibt KEIN `'DONE'`."). Component-Library §1.5 sagt: „`DONE` / `COMPLETED` (exakter Enum prüfen)". **Genau das ist ein Smell** — die Komponenten-Doku räumt selbst ein, sich nicht sicher zu sein. Der Architect hat das eindeutig geklärt: es ist **nur** `COMPLETED`. Component-Library muss korrigiert werden, sonst kopiert ein Engineer den falschen Enum-Wert.
  - **Risiko D (Minor):** Frontend-Requirements §2 fehlt der Hinweis: was zeigt die UI bei `COUNTER_PROPOSED`? Der `BookingStatus`-Enum hat 6 Werte (`PENDING, CONFIRMED, REJECTED, COUNTER_PROPOSED, CANCELLED, COMPLETED`), die Component-Library §1.5 listet nur 5 (`COUNTER_PROPOSED` fehlt komplett). Falls Tom einen Gegenvorschlag gemacht hat, fehlt diese Buchung im Default-Filter UND im manuellen Filter — das ist ein **Datenleck im Filter**, kein Sicherheits-, aber ein UX-Datenleck. Buchungen verschwinden de facto.
- **Auflage:** Component-Library §1.5 + Frontend-Requirements §2 müssen den vollen 6-Werte-Enum auflisten, inkl. `COUNTER_PROPOSED`. Architect klärt den UX/FE-Widerspruch (Multi-Select war oder ist der Bestand?).
- **Verdict:** **Pass mit Auflagen** — Plan ist OK, aber drei Konsistenz-Patches sind nötig vor Phase 3.

---

### S04 — Preis-Persistierung

- **AC-Coverage:**
  - AC#1 (200 + Erfolgs-Toast), AC#2 (Reload zeigt Wert), AC#3 (Überschreiben), AC#5 (GET enthält Wert) — durch den GET-Handler-Mapping-Fix abgedeckt (`bookings/route.ts` Zeile 107 ergänzen).
- **Verifikation:** Ich habe den GET-Handler gegengelesen — Zeile 107-173 mappt tatsächlich nicht `finalPriceEur` und nicht `finalPriceNote` ins Response-DTO. **Diagnose hieb- und stichfest.** Auch das BookingTable-Cast (`as BookingAdmin & { finalPriceEur?: ... }`) habe ich auf Zeile 289-290 + 470-471 gegengelesen — ist exakt dort.
- **AC#4 — Edge-Case „leerer Preis löscht alten Wert":**
  - PATCH-Handler-Code-Read: `AdminBookingPatchSchema` (Zeile 2112 in `zod-schemas.ts`, gegengelesen) hat `finalPriceEur: finalPriceEurInputSchema` — ich muss prüfen, ob dieses Schema `null` als „explizit löschen" akzeptiert. Architect §3.2 sagt, der PATCH-Handler ist OK; FinalPriceEditor sendet `finalPriceEur: v.value` (Zeile 95-98) und `validate('')` liefert `{ ok: true, value: null }`. **Frage:** Schreibt Prisma bei `data: { finalPriceEur: null }` einen NULL-Wert in die DB? **Ja** — das ist Prisma-Default für `Decimal?`. AC#4 sollte funktionieren, **aber nur wenn**:
    - Der Frontend-Submit `null` (nicht `undefined`, nicht `''`) im JSON-Body hat. Engineer muss verifizieren.
    - Der Server `data: { finalPriceEur: null }` an Prisma weitergibt (nicht `data: {}`).
  - **Risiko:** Falls beim leeren Submit der Frontend `undefined` sendet, ignoriert die Zod-`.optional()`-Logik den Key, und Prisma bekommt kein Feld → der alte Wert bleibt. **Engineer-Aufgabe in Phase 3:** explizit testen mit `curl -X PATCH ... -d '{"finalPriceEur": null}'` vs. `'{}'`.
- **Risiken:**
  - **Risiko A (Major — Architect-Frage):** Die Story-Reporting-Annahme war: „Preis wird nicht gespeichert". Architect-Diagnose: „Preis wird gespeichert, aber GET-Liste vergisst ihn". **Wenn Tom in der Praxis stets nach Speichern + sofortiger Liste-Re-Fetch (z.B. nach einer Status-Aktion) checkt, sieht er ihn nicht** — das ist exakt Tom's Symptom. **Aber:** falls Tom auch beim Detail-Drawer (nicht Liste) einen leeren Wert sieht, muss zusätzlich der Detail-Endpoint geprüft werden — gibt es einen `GET /api/admin/bookings/[id]` der das Mapping ebenfalls vergisst? Architect-Doc §3.7 sagt nur „nur GET /api/bookings korrigieren" — aber das ist nicht durch ein vollständiges Audit aller Booking-Lese-Endpoints belegt. Engineer-Auflage.
  - **Risiko B (Major — UX/Architect-Widerspruch):** UX-Spec §3.2 verlangt **ein Save-Button + Toast (4s) + Inline-Chip „Gespeichert" (3s) parallel**. Component-Library §3.5 zeigt das im Markup. **Aber:** der bestehende `FinalPriceEditor.tsx` (gegengelesen via Architect-Doc §3.3 mit Zeile 95-98 `await patchAdminBooking(...)`) — hat der einen Save-Button **oder Save-on-Blur**? Architect dokumentiert das nicht. Wenn Bestand Save-on-Blur ist, **macht das UX-Spec §3.4 einen Pattern-Wechsel** (Save-on-Blur → expliziter Button) — das ist ein UX-Refactor, **kein Bug-Fix**. UX-Spec §3.4 sagt selbst „kann in QA-Phase angepasst werden, falls Tom Save-on-Blur klar wünscht" — und nennt das eine Default-Entscheidung. Es ist **also kein Default**, sondern eine Patternsänderung. **Architect-Auflage:** klären, was Bestand ist, und wenn ein Pattern-Wechsel nötig ist, das in der Story explizit vermerken (sonst wundert sich der Engineer).
  - **Risiko C (Critical — UI-State nach Save):** Der Architect-Plan §3.6 fixiert das Backend-DTO. **Aber:** in §3.4 (vorletzter Absatz) steht: „der `FinalPriceEditor` updated beim Speichern den lokalen State korrekt — solange Tom auf der Seite bleibt sieht er den Preis. Beim Reload (oder Re-fetch via `load()` z.B. nach einer Status-Aktion Zeile 131) verschwindet er." **Das ist die Falle:** wenn der Engineer **nur** das Backend fixt aber den Frontend-State nach `load()` nicht prüft, kann es einen zweiten Bug geben — wenn der State-Reset mit fehlendem `finalPriceEur` aus dem GET den lokalen Save-State überschreibt. **Konkret:** wenn der GET-Handler den Preis korrekt liefert, aber `BookingTable.tsx` den Cast auf `BookingAdmin & { finalPriceEur?: ... }` macht und `BookingAdmin` (der Bestand-Schema) das Feld nicht hat, läuft TypeScript stillschweigend daran vorbei — Engineer könnte einen Schema-Refactor (BookingAdminSchemaIT6 als Liste-Type) zusätzlich brauchen. Frontend-Requirements §5 erwähnt das als „kosmetisch" — ich sehe es als **funktional**, weil sonst der Cast `as` weiterhin Annahmen macht, die der echte Server-Response brechen kann (z.B. wenn er als Number serialisiert statt String).
- **Auflage:**
  1. **Audit aller Booking-Read-Endpoints** auf `finalPriceEur`/`finalPriceNote`/`paymentMethod` — explizit als Engineer-Schritt.
  2. **Klärung Save-Pattern** mit Tom (Save-on-Blur war/ist? Pattern-Wechsel nötig?).
  3. **Schema-Refactor** der Liste-Response-Types: `BookingAdminSchemaIT6` als `data`-Type statt `BookingAdmin` mit Cast — sonst bleibt der Bug latent.
- **Verdict:** **Pass mit Auflagen** — Backend-Diagnose stimmt, aber drei Frontend-Folgefragen sind im Plan unter dem Tisch.

---

### S05 — Cash-Payment

- **AC-Coverage:**
  - AC#1 (Bar als Option), AC#2 (Save + Reload), AC#3 (Bestand-Optionen funktionieren), AC#4 (`paymentMethod: 'CASH'` in API) — Plan ist abgedeckt durch Migration + Schema + Zod-Update + UI-Änderung.
- **Verifikation:** Migration-SQL ist sauber (`ALTER TABLE bookings ADD COLUMN paymentMethod TEXT;`).
- **Risiken / Widersprüche:**
  - **Risiko A (Critical — Enum-Werte-Widerspruch):** **Drei verschiedene Definitionen!**
    - **Architect §4.5:** `'CASH' | 'STRIPE' | 'TRANSFER'` (3 Werte).
    - **OpenAPI §components/PaymentMethod:** `[CASH, STRIPE, TRANSFER]` (3 Werte). ✓ konsistent.
    - **UX-Spec §4.3:** `BANK_TRANSFER`, `CASH`, `CARD`, `INVOICE` (4 Werte). ✗ **anders!**
    - **Component-Library §4.2:** `BANK_TRANSFER`, `CASH`, `CARD`, `INVOICE` (4 Werte). ✗ **anders!**
    - Der Architect hat `'TRANSFER'`, UX hat `'BANK_TRANSFER'`. UX hat zusätzlich `CARD` und `INVOICE` — Architect nicht. Migration-Doku erwähnt nur `'CASH' | 'STRIPE' | 'TRANSFER'`. **Wenn der Engineer der UX-Spec folgt und `BANK_TRANSFER` sendet, validiert die Backend-Zod-Whitelist es als ungültig → 400-Fehler. Das ist ein direkter Build-Time-Bug.**
    - **OQ-IT14-2 im Architect-Doc** sagt: „Will Tom für S05 wirklich nur „Bar" oder auch „Überweisung"? Falls Tom NUR Bar will, kann das Schema auch nur `CASH` enthalten." — das verschärft die Inkonsistenz: UX hat **vier** Werte, Architect zwischen **drei und einem**.
  - **Risiko B (Critical — Migration-Lücke für existierende Buchungen):** Die Migration ist `ALTER TABLE bookings ADD COLUMN paymentMethod TEXT;` ohne Default. Existierende Bookings haben `paymentMethod = NULL`. **Was rendert die UI?**
    - UX-Spec §4.3 sagt der Default-Eintrag im Select ist „— bitte wählen —". OK für Detail-Edit-View.
    - **Aber:** UX §4.6 erwähnt Badge-Anzeige in der Liste, Frontend-Requirements §3 (S05) sagt: „wenn `paymentMethod === 'CASH'` → Badge ‚Bar'". **Was wenn `null`?** Plan sagt nichts. **Default-Verhalten muss explizit:** kein Badge bei NULL? Badge mit Text „—"? Engineer-Aufgabe — aber sollte spezifiziert sein.
    - **Architect-Doc §4.5 sagt:** „NULL = nicht erfasst (Default)". Das ist die Backend-Sicht. UX-Spec sagt: „— bitte wählen —" als Display für leeres Dropdown. **Konsistent.** Aber für die Listen-Badge fehlt die Regel.
  - **Risiko C (Major — Customer-Buchungs-Submit):** Story-Out-of-Scope sagt explizit „Keine Änderung am Kunden-sichtbaren Buchungsformular". **Gut.** Aber: was passiert beim **Customer-Booking-Submit** ohne `paymentMethod`? Architect-Plan ergänzt das Feld zum Booking-Modell. Wird `paymentMethod` jetzt im Customer-`POST /api/bookings`-Path **erwartet** oder **optional**? OpenAPI-Diff zeigt nur die Admin-Endpoints.
    - **Antwort aus dem Code-Read:** das Feld ist `paymentMethod String?` (nullable), Migration setzt keine Defaults — also Customer-Submit ohne `paymentMethod` läuft durch und speichert NULL. **Sauber.** Aber: das fehlt explizit in der Architektur-Doku. Engineer-Aufgabe: in `POST /api/bookings` Zod-Schema **kein** `paymentMethod`-Feld einführen (sonst ist Pflicht!).
  - **Risiko D (Minor):** UX-Spec hat „Position 2 (nach Überweisung)" vs. Architect-Doc keine Reihenfolge-Vorgabe. UX gewinnt — Engineer richtet sich nach UX.
- **Auflage (kritisch):**
  1. **Enum-Werte einigen** vor Phase 3: `BANK_TRANSFER` vs. `TRANSFER`, plus `CARD`/`INVOICE` mitnehmen oder weglassen. **Architect entscheidet, UX-Spec und Component-Library werden anschließend angepasst.** Sonst Build-Bug.
  2. **NULL-Render-Verhalten** für die Listen-Badge spezifizieren (kein Badge ist ein vernünftiger Default).
  3. **`POST /api/bookings`-Schema** explizit dokumentieren, dass `paymentMethod` **nicht** im Customer-Body erwartet wird.
- **Verdict:** **Fail bzw. Pass mit harten Auflagen** — die Enum-Inkonsistenz ist ein Showstopper. Wenn Architect das **vor** Phase 3 löst, dann „Pass mit Auflagen". Sonst „Fail — Architect/UX müssen aligned sein bevor Engineer codiert".

---

### S06 — Calendar-404

- **AC-Coverage:** AC#1 („Buchung öffnen"-Link sichtbar), AC#2 (kein 404), AC#3 (korrekte ID-Zuordnung), AC#4 (Mobile Touch-Target).
- **Verifikation:** Architect §5.2 — `app/admin/bookings/[id]/page.tsx` existiert nicht (gegengelesen: nur `app/admin/bookings/page.tsx` mit Redirect). **Diagnose stimmt.**
- **Risiken / Widersprüche:**
  - **Risiko A (Critical — UX/Architect-Direkter-Widerspruch zur URL):**
    - **Architect §5.4:** URL ändert auf `/admin?tab=bookings&focus=<id>#booking-<id>` (Anker-Lösung).
    - **UX-Spec §5.3 / Component-Library §5.3:** „Verbindliche URL-Konvention: `/admin/bookings/{id}` (Plural). Falls Code aktuell `/admin/booking/{id}` (Singular) generiert: das ist der Bug." — d.h. UX **erwartet** eine echte Detail-Route.
    - **Das ist ein direkter Widerspruch.** Architect wählt **Option A (Anker)**. UX dokumentiert **Option B (Detail-Route).** **Engineer hat zwei sich widersprechende Vorgaben.**
    - **Konsequenz:** Wenn Engineer Architect folgt, ist die UX-Spec falsch („das war ein Bug" — nein, es war eine Architektur-Entscheidung). Wenn Engineer UX folgt, fehlt das gesamte `/admin/bookings/[id]/page.tsx` Routing (~80 LOC) das der Architect nicht mit eingeplant hat.
    - **Architect-Doc OQ-IT14-4** erwähnt das ausdrücklich: „Engineer-Aufgabe in Phase 3: mit Tom kurz abstimmen." **Das reicht nicht** — UX/Component-Library müssen synchronisiert werden, **bevor** der Engineer codiert.
  - **Risiko B (Major — Edge-Case AC#2 i.V.m. S03 Default-Filter):** Die Architect-Plan-Skizze in `frontend-requirements-it14.md` §4 setzt im `useEffect` bei `?focus=` aktiv: „erweitern den Filter automatisch (nicht zwingend nötig, aber UX-freundlich) — `setFilter(new Set([alle 6 Status]))`". **Aber das verletzt S03-AC#3** (kein Persist über Sessions hinaus) **nicht direkt**, weil State nicht persistiert wird, **aber:** wenn Tom einen abgeschlossenen Auftrag im Kalender klickt und die Liste expandiert, dann seine Statusübersicht zerstört — er kommt auf die Liste „Alle 6 Status sichtbar" anstatt „Default Offen+Bestätigt". Beim nächsten Reload ist Default zurück. **Akzeptabel**, aber **muss in S03-Default-Filter dokumentiert werden** als „Ausnahme bei Calendar-Anker", sonst Engineer überlegt sich eine andere Lösung. Actually `frontend-requirements-it14.md` §4 erwähnt es korrekt — **gut.**
  - **Risiko C (Major):** Bei Anker-Lösung scrollt die Page zur Buchung. Was wenn der Auftrag **nicht im aktuellen Default-Filter ist** (Default = Offen+Bestätigt) — z.B. ein abgeschlossener Auftrag (`COMPLETED`)? Filter zeigt ihn nicht, Anker geht ins Leere. Plan §4 sagt: Filter wird auf alle 6 Status erweitert. **Aber:** Plan §4 in `frontend-requirements-it14.md` sagt `setFilter(new Set(['PENDING', 'CONFIRMED', 'COMPLETED', 'COUNTER_PROPOSED', 'CANCELLED', 'REJECTED']))`. **5 explizit aufgeführt — fehlt einer?** Zähle: PENDING, CONFIRMED, COMPLETED, COUNTER_PROPOSED, CANCELLED, REJECTED → das sind alle 6. **Gut.** Aber **Component-Library §1.5** kennt nur 5 (`COUNTER_PROPOSED` fehlt). Konsistenz-Risiko siehe S03 Risiko D.
  - **Risiko D (Minor):** UX-Spec §5.3 zeigt Variant „Eintrag ohne `bookingId`": Button **nicht rendern**. Architect-Plan §5.4 erwähnt das Pattern aber **nicht explizit für die Backend-Response**: was setzt der Backend (`/api/admin/calendar/events/route.ts` Zeile 149) für `url` bei BUFFER/AVAILABILITY-Events? Code-Read: Zeile 149 ist nur in dem Branch, der eine Buchung hat. **Andere Branches setzen `url`?** Wenn nicht, ist `url=undefined` in der Response, OpenAPI §components/CalendarEvent zeigt `url: nullable: true` — **konsistent**. UX und Architect hier OK; nur sollte Architect explizit dokumentieren, **was** `url` für BUFFER/AVAILABILITY ist (`null`).
- **Auflage:**
  1. **URL-Format zwischen Architect und UX/Component-Library aligned** vor Phase 3. Empfehlung: Architect-Variante (Anker) ist die schnellere Lösung; UX-Spec + Component-Library werden entsprechend angepasst (Tom soll einmal abstimmen — UX OQ-IT14-4).
  2. UX und Component-Library aktualisieren mit der gewählten URL.
- **Verdict:** **Pass mit Auflagen** — Plan funktioniert, aber UX/Architect-URL-Widerspruch muss aufgelöst werden, bevor Code geschrieben wird.

---

### S07 — Analytics

- **AC-Coverage:** Plan ist klar (zwei Queries: Counts ohne Preis-Filter, Revenue mit Preis-Filter), AC#4 ist erfüllt durch separate KPI-Kachel.
- **Verifikation:** `analytics.ts` Code-Read bestätigt: Zeile 156-158 hat `finalPriceEur: { not: null }` im `where`, Zeile 169 `completedCount = completedInRange.length`. Architect-Diagnose stimmt.
- **Risiken:**
  - **Risiko A (Major — Reihenfolge-Abhängigkeit):** S07 hängt an S04 — das wird im Plan an mehreren Stellen erwähnt. **Aber:** wenn S04 nur teilweise gefixt ist (z.B. nur das DTO, nicht der Frontend-State-Reset siehe S04 Risiko C), zeigen Bestandsbuchungen weiterhin keinen Preis → Analytics zeigt sie als „COMPLETED ohne Preis" → AC#4 sagt: „erscheint mit 0 € — fehlt nicht". **Architect hat das mit dem Counts-Query gelöst** — und sollte das aber zusätzlich klar dokumentieren, dass die KPI-Kachel **vor** dem S04-Fix sinnvoll bleibt: zeigt Tom rückwirkend „X Aufträge abgeschlossen" auch wenn er bei keinem den Preis erfasst hatte. **Ist das gewünscht?** Wahrscheinlich ja, weil Tom weiß dass er Preise nachtragen muss.
  - **Risiko B (Major — UX/Architect-Inkonsistenz):**
    - UX-Spec §0 sagt: „Stories ohne UX-Anteil: IT14-S07 (Analytics-Datenkorrektur, kein UI-Change)." — aber **AC#4 ist UI-relevant!** Die separate KPI „Abgeschlossene Buchungen" muss visuell von der „Umsatz"-Kachel **abgegrenzt** sein, sonst missversteht Tom: er sieht „Abgeschlossen: 7" und „Umsatz: 850 €" und denkt durchschnittlich 121 €/Auftrag — **aber** der Avg ist `850/x` wo `x` < 7 ist (nur die mit Preis). **Tom kann das missverstehen!** UX/Component-Library sollte explizit vermerken: „Tooltip oder Legend bei der Umsatz-Kachel: Basis sind nur Aufträge mit erfasstem Preis. Abgeschlossen-Count zählt alle." — fehlt komplett.
  - **Risiko C (Minor):** OpenAPI-Schema sagt `kpis.completedBookings` ist `integer` — aber das war es vorher auch. Sollte noch eine `completedWithoutPriceCount` als zusätzliche KPI haben? Architect-§6.3 deutet das nicht an — UX könnte das brauchen für die User-Aufklärung.
- **Auflage:**
  1. UX-Spec ergänzen: Tooltip/Legend an der Analytics-Page um die KPI-Definitionen zu disambiguieren.
  2. (Optional) Drittes KPI „Abgeschlossen ohne Preis" als Counter — hilft Tom die Lücke aktiv zu schließen.
- **Verdict:** **Pass mit Auflagen** — Backend ist OK, aber UX-Doku ist unterspezifiziert.

---

### S08 — Image-Upload

- **AC-Coverage:** AC#1-AC#3 (Upload, Preview, Limits), AC#4 (Root-Cause im PR), AC#5 (keine 503/INTERNAL_ERROR in Logs).
- **Risiken:**
  - **Risiko A (Critical — kein Plan B):** Architect-Doc §1.3 listet 4 Hypothesen, die alle „Token-Konfiguration" sind. **Wenn keine davon stimmt** (z.B. ein Vercel-SDK-Bug, ein neuer Edge-Case in `generateClientTokenFromReadWriteToken`), hat der Plan **keinen Fallback**. Story-Auftrag „Plan B" ist nicht beantwortet.
  - **Risiko B (Critical — Engineer kann nicht alleine handeln):** Wie bei S01, alle Diagnose-Schritte sind Tom-only:
    - Vercel-Dashboard-Zugriff → Tom-only.
    - Vercel-Logs → Tom-only.
    - Production-Test-Upload → Tom-only.
    - **Engineer kann nichts tun ohne Tom.** Das muss explizit als „Tom-Aufgabe" in der Story stehen — aktuell ist die Story als P1 gekennzeichnet aber der Engineer hat keinen einzigen ausführbaren Schritt.
  - **Risiko C (Major):** Component-Library §6.2 listet 7 `UploadErrorCode`-Werte. **Aber:** der bestehende `FileUpload.tsx` (laut Architect §1.3 schon da) **mappt schon deutsche Texte für `BLOB_NOT_CONFIGURED`** (IT13 Bestand, gegengelesen via Architect-Doc §1.3 „Frontend `FileUpload.tsx` mappt deutsche Fehler inkl. `BLOB_NOT_CONFIGURED`"). **Was ist neu in IT14?** Component-Library macht es so, als wäre das ganze Mapping-Konzept neu — ist es nicht. Engineer-Aufgabe in Phase 3 wird Trivial-Werk: ggf. neue `CONFIRM_FAILED`/`BLOB_DIRECT_NETWORK`-Codes ergänzen. Das sollte UX-Spec klarer machen — sonst implementiert Engineer einen Refactor anstatt eines Diff-Patches.
  - **Risiko D (Minor — `X-Request-Id`-Display):** UX §6.2 + Component-Library §6.4 zeigen optional die `X-Request-Id` „klein und neutral". Empfehlung gut, aber: **Frontend kann den Header nur lesen, wenn der Server ihn als CORS-Header `Access-Control-Expose-Headers: X-Request-Id` ausliefert.** Plan checkt das nicht. Engineer-Aufgabe: verifizieren oder im Backend ergänzen.
- **Auflage:**
  1. **Plan B-Sektion** in Architect-Doc §1.3 ergänzen: was tun, wenn keine der 4 Hypothesen stimmt? Mindestens: „eskalieren zu Vercel Support; Workaround: `BLOB_READ_WRITE_TOKEN` neu erstellen, alten revoken".
  2. **Tom-only-Steps explizit** in der Story als „Setup-Aufgabe Tom" (klar trennen von Engineer-Aufgabe).
  3. **`X-Request-Id`-CORS-Expose** prüfen.
- **Verdict:** **Pass mit Auflagen** — wie S01: Plan ist gut, aber ohne Tom geht der Engineer nicht voran, und es fehlt ein Fallback.

---

## 3. Critical Issues

| # | Issue | Story | Routing |
|---|-------|-------|---------|
| C-1 | **Enum-Inkonsistenz S05:** Architect/OpenAPI sagen `[CASH, STRIPE, TRANSFER]` (3 Werte), UX-Spec/Component-Library sagen `[BANK_TRANSFER, CASH, CARD, INVOICE]` (4 Werte, anderer Name für Transfer). Zod-Validation schlägt fehl, sobald UI sendet — **Build-Bug**. | S05 | solution-architect (entscheidet endgültig) + dann UX-Spec & Component-Library aktualisieren |
| C-2 | **URL-Widerspruch S06:** Architect wählt Anker-Lösung `/admin?tab=bookings&focus=<id>#booking-<id>`. UX-Spec und Component-Library schreiben verbindlich `/admin/bookings/{id}`. Engineer hat zwei sich widersprechende Vorgaben. | S06 | solution-architect (entscheidet, mit Tom-Bestätigung via OQ-IT14-4) + UX-Spec & Component-Library angleichen |
| C-3 | **Defense-in-Depth-Audit S02 fehlt:** Plan sagt SSR-Layout-`auth()`-Calls bleiben als zweite Schicht — aber liefert keine Liste der `app/admin/**/page.tsx` und `layout.tsx` zur Verifikation. 11 Subdirs, kein systematisches Audit. | S02 | solution-architect (Audit-Liste erstellen) + backend-engineer (Phase 3 abhakt) |
| C-4 | **Production-Diagnose-Pfad ohne Tom-Mitwirkung S01/S08:** AC#6 in S01 (Root-Cause-Doku) und Story-Auftrag „Plan B" in S08 sind nicht erfüllbar ohne Tom's Logs/Setup-Zugriff. Plan markiert das nicht als Blocker. Engineer kann technisch ausgelöst werden, aber Story-Abnahme nicht. | S01, S08 | project-manager (Tom-Coordination) + solution-architect (Story-Pfad zerschneidet in „Engineer-Code" + „Tom-Setup"-Subtasks) |
| C-5 | **Frontend-State nach S04-Fix:** `BookingTable.tsx` nutzt `as`-Cast für `finalPriceEur`. Wenn der Server jetzt das Feld liefert, ändert sich der Type nicht automatisch — Liste-Type ist `BookingAdmin[]`, nicht `BookingAdminIT6[]`. Latentes Bug-Risiko bei Re-Fetch nach Status-Aktion. Plan nennt das „kosmetisch" — ich nenne es funktional. | S04 | frontend-engineer (Schema-Refactor), solution-architect (klarstellen) |

## 4. Major Issues

| # | Issue | Story | Routing |
|---|-------|-------|---------|
| M-1 | **Multi-Select vs. Single-Select-Widerspruch S03:** Aktueller `BookingTable.tsx` ist Single-Select (verifiziert via Code-Read Zeile 75, 110-113). UX-Spec §2.1 sagt „Pattern bleibt unverändert". Frontend-Requirements §2 sagt explizit Refactor auf Multi-Select. UX-Spec ist intern widersprüchlich. | S03 | ux-designer / solution-architect (UX-Spec-Klarstellung) |
| M-2 | **`COUNTER_PROPOSED` fehlt in Component-Library §1.5 und teilweise in den Filter-Optionen:** Prisma hat 6 Status-Werte, Component-Library listet 5. Buchungen mit Counter-Proposal verschwinden in der UI. | S03 | ux-designer (Component-Library aktualisieren) |
| M-3 | **Bestandsbuchungen mit `paymentMethod = NULL` Render-Verhalten:** Listen-Badge-Logik ist nicht spezifiziert für NULL. UX/FE-Spec klafft. | S05 | ux-designer / frontend-engineer |
| M-4 | **OpenAPI-401-Shape vs. Route-Handler-401-Shape S02:** Middleware liefert eigenes JSON, Route-Handler liefert via `requireAdmin`-Lib eigenes Format. Konsistenz nicht abgenommen. | S02 | backend-engineer (Phase 3) + solution-architect |
| M-5 | **Save-Button vs. Save-on-Blur S04:** UX-Spec §3.4 macht eine Pattern-Default-Entscheidung („expliziter Save-Button"), aber ohne den aktuellen Bestand zu kennen. Falls Bestand Save-on-Blur ist, ist das ein UX-Refactor jenseits der Bug-Iteration-Idee. | S04 | solution-architect (Bestand-Klärung) + ux-designer |
| M-6 | **S07 UX-Doku fehlt:** UX-Spec sagt „kein UI-Change", aber AC#4 erfordert eine semantische Disambiguierung der KPI-Kacheln (Tom darf den Avg nicht missverstehen). | S07 | ux-designer (Tooltip/Legend ergänzen) |
| M-7 | **`POST /api/bookings`-Customer-Schema:** Migration fügt `paymentMethod`-Spalte hinzu — explizit dokumentieren, dass Customer-Submit das Feld nicht erwartet (nullable, nicht im Customer-Zod-Schema). | S05 | solution-architect / backend-engineer |
| M-8 | **Calendar-Url für BUFFER/AVAILABILITY-Events:** Architect §5.4 erwähnt nicht explizit, was `url` für Nicht-Booking-Events ist. OpenAPI sagt `nullable: true`. Plan kann konsistent sein, sollte aber dokumentiert sein. | S06 | solution-architect (Klarstellung) |
| M-9 | **Audit aller Booking-Read-Endpoints S04:** Plan §3.7 sagt „nur GET /api/bookings korrigieren" — aber kein systematisches Audit, ob `GET /api/admin/bookings/[id]` (falls existent) oder `/api/admin/upcoming-bookings` ebenfalls das Feld vergessen. | S04 | backend-engineer (Phase 3 — explizite Aufgabe) |

## 5. Minor Issues

| # | Issue | Story | Routing |
|---|-------|-------|---------|
| m-1 | UX-Spec §2.4 Empty-State-CTA „Alle anzeigen" schaltet alle Status aktiv — semantisch verwirrend, weil `[NEEDS INPUT]`-Frage offen. | S03 | ux-designer (Tom-Klärung) |
| m-2 | UX-Spec §5.6 erwähnt Mobile-Variant „Bottom-Sheet" als Bestand. Falls nicht implementiert, Default „Popover bleibt mit Full-Width-Link". Klarstellung welches gilt. | S06 | ux-designer / frontend-engineer |
| m-3 | Component-Library §6 erweckt den Eindruck, das Microcopy-Mapping sei neu. Tatsächlich ist das in IT13 weitgehend Bestand — Diff-Hinweis fehlt. | S08 | ux-designer |
| m-4 | `X-Request-Id`-CORS-Expose-Header für Frontend-Konsum nicht verifiziert. | S08 | backend-engineer |
| m-5 | Architect-Smoke-Test §7.2 fehlt der Negativ-Test mit invalidem Cookie (S02 AC erweitern um Cookie-Manipulation-Probe). | S02 | solution-architect |
| m-6 | `_prisma_migrations`-Eintrag in Production muss manuell gesetzt werden (§7.1) — gilt als Tom-Aufgabe, ist Bestand-Pattern; Engineer-Pfad muss klar sein. | S05 | project-manager (Tom-Coordination) |

---

## 6. Open Questions, die Tom entscheiden sollte

1. **OQ-IT14-2 (S05): Welche Zahlungsarten?** Nur `CASH` oder die volle Liste `CASH/STRIPE/TRANSFER` — oder die UX-erweiterten `CASH/BANK_TRANSFER/CARD/INVOICE`? **Auswirkung: Schema, Migration-Doku, OpenAPI, UI-Optionen-Liste.**
2. **OQ-IT14-4 (S06): Anker-Link oder Detail-Route?** Architect bevorzugt Anker (schnell), UX-Spec/Component-Library schreiben Detail-Route vor (sauberer). **Tom: was ist dein bevorzugter Workflow?**
3. **(neu) S04 Save-Pattern:** Wenn der bestehende `FinalPriceEditor` Save-on-Blur nutzt, wechseln wir auf expliziten Save-Button (Aufwand) oder bleiben bei Save-on-Blur (UX-Spec anpassen)?
4. **(neu) S03 Multi-Select:** Falls heute Single-Select ist (Code-Beweis liegt vor), willst du explizit Multi-Select? Architect/UX gehen davon aus dass Bestand schon Multi-Select ist — das stimmt nicht.
5. **(neu) S01/S08 Logs/Setup-Zugriff:** Können wir die Vercel-Production-Logs für die letzten 30 Tage einsehen? Wenn nein: müssen wir die Diagnose-Schritte in einer Live-Session zusammen durchgehen?

---

## 7. Test-Plan-Lücken

Stories und ihre **fehlenden** Test-Pfade:

| Story | Was fehlt im Test-Plan |
|-------|------------------------|
| S01 | Smoke-Skript für Engineer-seitige Verifikation (lokal mit Mock-Cookie). Aktuell: nur Production-Tests definiert. |
| S02 | Curl-Probe mit invalid-signed-Cookie (Cookie-Manipulation-Threat). Curl-Probe für Server-Action-Pfade falls existent. |
| S03 | Test-Pfad für Reload-Verhalten — Cypress/E2E nötig oder Hand-Test reicht? Architect-Plan dokumentiert nichts. |
| S04 | (a) Curl-Test `PATCH ... -d '{"finalPriceEur": null}'` vs. `'{}'` — verifiziert AC#4. (b) Re-Fetch nach Status-Action-Test (sieht Tom den Preis nach dem `load()`-Reset?). (c) Schema-Type-Sanity-Check (BookingAdminSchemaIT6 vs. cast). |
| S05 | Test-Pfad für Bestandsbuchungen mit NULL — sieht Tom keinen Crash, kein Empty-Box-Glitch in der UI? |
| S06 | Test-Pfad für Calendar-Click auf abgeschlossenen Auftrag (außerhalb Default-Filter) — Filter-Erweitern + Scroll. |
| S07 | Sanity-Check der zwei Queries — was wenn `from > to` oder leerer Range? |
| S08 | Wie reproduziert der Engineer den Production-Bug lokal, wenn der Token-Pfad lokal funktioniert? Plan sagt nichts. Lokaler Mock-Server für Vercel Blob? |

**Globale Lücke:** der Architect-Plan §7.2 hat eine schöne Smoke-Tabelle, aber **die ist Tom-only** (alles auf `https://www.baerenstark-hausservice.app`). Engineer-Phase-3-Smoke-Tests fehlen — wäre nützlich für lokales `npm run dev`.

---

## 8. Empfehlung an Orchestrator

**Verdict: Pass mit Auflagen — Phase 3 darf nicht starten, bevor folgende fünf Korrekturen umgesetzt sind:**

1. **C-1:** Architect entscheidet endgültig den `PaymentMethod`-Enum-Wertebereich. UX-Spec + Component-Library werden auf den Architect-Wert angeglichen. (Geschätzt 30 Min Architect-Arbeit + 15 Min UX-Update.)
2. **C-2:** Architect/Tom entscheiden Anker-Lösung vs. Detail-Route. UX-Spec + Component-Library werden auf die gewählte Lösung angeglichen. (30 Min — eine Tom-Frage.)
3. **C-3:** Architect erstellt Audit-Liste für SSR-Layout/Page-Level-`requireActiveAdmin()`-Calls. (30 Min Architect-Arbeit, einmalig.)
4. **C-4:** Project-Manager bricht S01 und S08 in „Engineer-Code-Subtask" + „Tom-Setup-Subtask" auf, dokumentiert klar wo Tom mitziehen muss. (Dokumentation.)
5. **C-5:** Architect dokumentiert in Frontend-Requirements §5 explizit, dass der `as`-Cast in `BookingTable.tsx` durch einen Schema-Refactor ersetzt werden muss — nicht „kosmetisch", sondern Bestandteil von S04. (10 Min Doku.)

Die 9 Major-Issues und 6 Minor-Issues können in Phase 3 vom Engineer parallel gelöst werden — **müssen** aber als Engineer-Auflagen in den Story-Tickets stehen, sonst werden sie übersehen.

Sobald die fünf Critical-Items gelöst sind: **freigeben für Phase 3 (Implementation)**. Engineer arbeitet die Auflagen aus §3 bis §5 ab, QA prüft in Phase 4 (Build-QA) erneut.

**Kein Redesign nötig.** Plan-Architektur ist insgesamt korrekt, die Diagnosen sind hieb- und stichfest (verifiziert via Code-Read an 4 Stellen). Die Probleme sind Konsistenz-Lücken zwischen den Doku-Artefakten und Tom-Coordination-Pfade — beides ist im Tagesgeschäft heilbar.

---

## Verdict-Bestätigung

**Pass mit Auflagen.** Phase 3 freigeben **nach** Korrektur der 5 Critical Items. Veto bei C-1 und C-2 (Showstopper für Build-Time-Compliance bzw. zwei sich widersprechende Vorgaben für den Engineer).
