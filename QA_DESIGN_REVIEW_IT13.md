# QA Design-Review — Iteration 13

**Datum:** 2026-05-04
**Mode:** Design QA (Pre-Build Pressure-Test)
**Iteration:** 13 (Stories S01–S08)
**Reviewer:** QA Engineer Subagent

---

## 1. Zusammenfassung

Das Design ist **bedingt baufähig** mit einem **harten Blocker (URL-Konflikt S01)** und zwei **Build-relevanten Klärungen** (Body-Size-Strategie S05, Section-IDs S03). Architecture, UX-Spec, Component-Library und Design-System sind in sich solide und decken die Acceptance Criteria substanziell ab. Drei Inkonsistenzen zwischen den Spec-Dokumenten müssen *vor* dem Engineering-Start vom PM/Architect aufgelöst werden — sonst bauen Backend und Frontend an unterschiedlichen Wahrheiten vorbei. Production-Bugs (S05/S06) haben gute Diagnose-Pfade, aber Logging-Plan-B fehlt teilweise. Ohne URL-Entscheidung S01 darf S02 (Facebook Live-Schaltung) nicht freigegeben werden — Facebook-Console-Eintrag wäre falsch.

**Verdict gesamt: ⚠ Needs Clarification** (1 Blocker, 4 Needs-Clarification, 3 Ready).

---

## 2. Story-by-Story Verdict

### S01 — Datenlöschungsseite ❌ **Blocker**

**Geprüft:** AC#1 (URL HTTP 200), AC#2 (Inhalt Headline/E-Mail/30-Tage/Daten-Auflistung), AC#3 (Facebook-URL-Validation), AC#4 (Datenschutz-Anchor), AC#5 (Footer-Link). Microcopy gegen UX-Spec §3.1.2.

**Risiken / Lücken:**
- 🔴 **HARTER URL-KONFLIKT**: Story-AC, UX-Spec, Component-Library und Design-System verwenden alle **`/datenschutz/datenloesung`** als kanonische URL. Backend-Requirements und Architecture-Diagramm setzen **`/datenschutz/loeschung`** als kanonisch (mit 308-Redirect von `datenloesung` → `loeschung`). Das ist kein kosmetisches Detail — wenn Facebook die falsche URL bekommt, schlägt die App-Validation entweder gar nicht oder mit 308 fehl, je nach Crawler-Verhalten. AC#1 nennt explizit `…/datenschutz/datenloesung` — das ist der **PM-/Story-Stand**.
- ⚠ Frontend-Requirements §S01 verlinkt im Footer auf `/datenschutz/loeschung` — kollidiert mit UX-Spec, die `/datenschutz/datenloesung` als kanonisch nennt.
- ⚠ Datenschutz-Hauptseite-Update: Backend-Doc nennt Abschnitt-Anchor anders (kein konkreter `id`), UX-Spec spezifiziert `<section id="datenloesung">` mit Anker — Architect sollte verbindlich machen.
- ⚠ Story-AC verlangt „Auflistung welche Daten gespeichert werden (Name, E-Mail, ggf. Buchungshistorie)". UX-Spec listet zusätzlich Telefon und Adresse. Backend-Doc führt zusätzlich „Bewertungen" und einen 6-Jahre-HGB-Hinweis. Keine Konflikte, aber drei Quellen mit drei Listen — Engineer muss die Union umsetzen.
- ⚠ Backend-Doc erwähnt 6-Jahre-HGB-Aufbewahrungspflicht für Audit-Daten; UX-Spec nennt 10 Jahre nach AO §147 für Rechnungen. Beides legitim, aber **inkonsistent in der gleichen Iteration** — User wird verwirrt.

**Behebungsvorschläge:**
- **PM (Tom) entscheidet:** Welche URL ist im Facebook Developer Dashboard eingetragen oder soll eingetragen werden? Das ist die kanonische URL, alles andere bekommt 308. Empfehlung: `/datenschutz/datenloesung` (UX-Spec + Story-AC), weil die Story-AC explizit ist und die UX-Spec daran ausgerichtet wurde.
- **architect:** Architecture-Diagramm und Backend-Requirements an Story-AC angleichen (nicht umgekehrt). Backend-Routes-Tabelle und Mermaid-Diagramm auf `/datenschutz/datenloesung` umstellen, Redirect-Regel umkehren (308 von `loeschung` → `datenloesung`, falls überhaupt nötig).
- **architect/ux:** Auf eine einheitliche Aufbewahrungs-Begründung einigen (entweder HGB §147 = 10 Jahre für Rechnungen, oder AO §147 = 10 Jahre — Konsistenz zwischen Backend-Doc-„6 Jahre HGB" und UX-Spec-„10 Jahre AO §147"). Tom oder ein Steuer-/Rechtsberater sollte den richtigen Wert bestätigen.

---

### S02 — Facebook OAuth aktivieren ⚠ **Needs Clarification**

**Geprüft:** AC#1 (Button sichtbar), AC#2 (OAuth-Flow → /konto), AC#3 (neuer CustomerUser), AC#4 (E-Mail-Konto-Linking), AC#5 (Vercel-ENV), AC#6 (App-Live + Datenlöschungs-URL), AC#7 (deutsche Fehler). Code-Stand: `customer-oauth.ts` registriert FacebookProvider seit IT6, `LoginForm.tsx` rendert Button bereits. Pipeline existiert, ist nur deaktiviert.

**Risiken / Lücken:**
- 🟠 **Callback-URL-Inkonsistenz**: Story-Notes (Z. 95) sagen `…/api/auth/callback/facebook` (ohne `customer/`). Architect (Backend-Req §S02 + Architecture §Auth-Provider-Routing) sagt `…/api/auth/customer/callback/facebook` (mit `customer/`). **Architect hat Recht**: NextAuth-Customer-Handler hat `basePath: '/api/auth/customer'` (verifiziert in `customer-oauth.ts:366`); Google-Callback nutzt schon den `customer/`-Path produktiv. **Story-Notes sind veraltet** — vermutlich aus früher Iteration kopiert. Aber: Wenn Tom die *Story-Notes-URL* in der Facebook Developer Console eingetragen hat (was nicht ausgeschlossen ist), läuft der OAuth-Flow auf `redirect_uri_mismatch`. UX-Spec §6.2 markiert genau diesen Punkt als Open Question.
- ⚠ **ENV-Naming-Migration**: Backend-Doc führt `AUTH_FACEBOOK_ID`/`AUTH_FACEBOOK_SECRET` als kanonisch ein, mit `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` als Fallback. Code (`customer-oauth.ts:351-352`) liest aktuell **nur** `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET`. Wenn Engineer die Backend-Doc 1:1 umsetzt, müssen `||`-Fallback-Patterns ergänzt werden — ist explizit genannt. ✓
- ⚠ **Scope-Format**: Code (`customer-oauth.ts:344`) verwendet aktuell `'email public_profile'` (space-separated, Google-Style). Backend-Doc verlangt `'email,public_profile'` (Komma-separated, Facebook-Konvention). Code-Patch in S02 nicht groß, aber konkret nötig — ist im Backend-Doc benannt. ✓
- ⚠ **Multi-OAuth-Konflikt** (Backend-Doc Open Question #3): Wenn Kunde bisher mit Google verlinkt war und nun Facebook nutzt (gleiche E-Mail), wird `oauthProvider`-Spalte überschrieben. „Akzeptierter Trade-off" laut Architect, weil E-Mail-Match-Pfad weiterhin beide Provider zulässt. Aber: Frontend zeigt aktuell **keinen** Hinweis „Du hast bisher mit Google angemeldet" — User wird verwirrt sein. UX-Spec §3.2 deckt diesen Edge-Case nicht explizit ab.
- ⚠ **Datenlöschungs-URL** (für Facebook Developer Console) hängt direkt an S01-URL-Entscheidung — siehe S01 Blocker.
- ⚠ **OAuth-Button-Variant-Refactor** (Component-Library §2 Option A vs. B): Spec lässt explizit die Wahl Option A (Inline) vs. B (Refactor zu `<OAuthButton variant>`). Engineer muss eine Entscheidung treffen — UX empfiehlt A. Sollte vom architect bestätigt werden, sonst Refactor-Spirale.

**Behebungsvorschläge:**
- **PM (Tom):** Ist im Facebook Developer Dashboard die Callback-URL bereits eingetragen? Wenn ja, **welche**? Das ist Source-of-Truth.
- **architect:** Story-Notes (Z.95 in iteration-13.md) korrigieren auf `/api/auth/customer/callback/facebook` — sonst macht Engineer beim Lesen einen Vorzeichenfehler. Backend-Doc ist korrekt, aber Story-Notes sind die andere Sicht-Quelle.
- **ux:** Edge-Case „User hatte bisher Google, nutzt nun Facebook mit gleicher E-Mail" als sechsten Page-State in §3.2.6 ergänzen; Microcopy-Eintrag ergänzen (z. B. „Du hast bisher mit Google angemeldet — wir haben die Konten verbunden.").
- **architect:** Im PR-Template explizit dokumentieren, ob Option A oder B umgesetzt wird.

---

### S03 — Scroll-Bug ⚠ **Needs Clarification**

**Geprüft:** AC zu Tag/Dauer/Slot-Übergängen, dynamische Header-Höhe, prefers-reduced-motion, Modal-Inneres-scrollen, Profil-Form, Kontaktformular.

**Risiken / Lücken:**
- 🟠 **Section-ID-Inkonsistenz Frontend ↔ UX-Spec**: Frontend-Requirements führt IDs `calendar-section`, `duration-section`, `slot-list-section`, `booking-form-section` (= Bestand IT12). UX-Spec führt IDs `service`, `when`, `duration`, `time-slot`, `contact`, `address`, `description`, `confirm` (= neues IT13-Pattern mit `data-section-anchor`). Das sind **zwei unterschiedliche ID-Schemata**. Engineer muss wissen: bestehende IDs migrieren oder additiv? UX-Spec etabliert ein neues Markup-Pattern (`data-section-anchor`, `tabindex="-1"` am Heading), Frontend-Doc beschreibt nur die Migration der existierenden 5 Aufrufstellen ohne neues Pattern.
- 🟠 **Selektor-Attribut-Inkonsistenz**: Frontend-Doc verwendet `[data-header]` für Sticky-Header. UX-Spec + Component-Library nutzen `[data-app-header]`. Das ist ein **anderer Selector** — wenn Frontend-Code `[data-header]` sucht, aber Header-Markup `data-app-header` trägt, scheitert die Höhen-Detektion silently und es greift der Default (64px), der wieder einen Off-by-N px erzeugt — exakt der Bug, den S03 zu beheben sucht.
- 🟠 **Modal-Scroll-Container-Selector**: Frontend-Doc nutzt `[data-scroll-container]`, UX-Spec/Component-Library nutzen `[data-modal-body]`. Wieder zwei Selektoren für dasselbe Konzept.
- ⚠ **Helper-Datei-Pfad**: Frontend-Doc spricht von `src/lib/scroll-to-section.ts`, Component-Library von `src/hooks/useScrollToSection.ts`. Funktion vs. Hook ist auch ein API-Unterschied — `scrollToSection(id)` (imperatives Aufrufen pro Klick) vs. `useScrollToSection({activeSection})` (deklarativ via State). Die zwei Patterns sind **nicht austauschbar** — der Engineer muss eines wählen, sonst werden beide gebaut.
- ⚠ **Focus-Management**: UX-Spec verlangt `heading.focus({ preventScroll: true })` nach Scroll. Frontend-Doc erwähnt das nicht. Wenn Engineer nur Frontend-Doc liest, wird Accessibility-AC nicht erfüllt.
- ⚠ **Existing IT12-Bestand**: `scroll-into-view.ts` (`scrollIntoViewIfNeeded`) hat eine Anti-Jump-Heuristik („nicht scrollen, wenn schon im Viewport"). UX-Spec §1.1.3 schreibt deterministisches Scrollen nach jedem Step-Wechsel vor. Konflikt mit IT12-Regression-Schutz (BUG-IT12-S04/S09 aus iteration-13.md Z. 158)? Wenn der neue Helper *immer* scrollt, kann man den alten IT12-Bug wieder einschleppen. Frontend-Doc sieht eine Komfort-Tolerance ±8 px vor, UX-Spec nicht. **Verbindliche Tolerance fehlt in der UX-Spec**.
- ⚠ **Kontaktformular**: AC nennt es, beide Specs sagen „existiert nicht in IT13" → AC ist N/A. Engineer muss das im PR-Kommentar dokumentieren — Audit-Trail-Pfad ist klar, aber leicht zu vergessen.

**Behebungsvorschläge:**
- **architect + ux gemeinsam:** Eine Entscheidung treffen für jedes Selector-Paar (`data-header` vs. `data-app-header`, `data-scroll-container` vs. `data-modal-body`, `scroll-to-section.ts` vs. `useScrollToSection`-Hook). Beide Dokumente synchronisieren.
- **architect:** ID-Schema klären — Migration aller existierenden IDs auf neues Pattern (Aufwand!) oder additives `data-section-anchor`-Attribut neben `id`? UX-Empfehlung: additiv, weil bestehende IDs schon im DOM verteilt sind.
- **ux:** Komfort-Tolerance ±8 px (oder anderer Wert) verbindlich in §1.1.3 ergänzen, sodass IT12-Anti-Jump-Verhalten erhalten bleibt.

---

### S04 — Formular-Prefill ⚠ **Needs Clarification**

**Geprüft:** AC zu allen Feldern Buchungs-Wizard, Profilformular, Kontaktformular, Grenzfälle (nicht eingeloggt, 401-Fehler, geänderter Wert).

**Risiken / Lücken:**
- 🟠 **„Andere Adresse als im Profil"**: Story-AC sagt: „User editiert vorausgefülltes Feld → Profil bleibt unangetastet". UX-Spec §1.2 deckt das ab. Aber: Was wenn Kunde eine *Buchung an Großmutters Wohnung* macht und gleichzeitig die Profil-Adresse beibehalten will? UX-Spec §1.2 erwähnt das genau als Beispiel und sagt: lokale Anpassung, kein Profil-Update. ✓ ist konsistent. **Aber**: Es gibt **keine UI-Affordanz** wie „Andere Adresse für diese Buchung" oder „Adresse aus Profil verwenden / abweichend angeben" — das wäre der UX-typische Pattern (siehe Amazon, Stripe Checkout). Aktuell muss der Kunde die Felder einfach überschreiben — nicht falsch, aber **keine Bestätigungs-/Hinweis-Reduktion** für Wiederholungsbuchungen. Tom-Feedback-Risiko: er meldet später, dass „die Profil-Adresse als Default-Plus-Toggle" gewünscht wäre.
- 🟠 **Telefon-Format-Konflikt**: Profilformular `phone` ist optional. Buchungsformular hat `customerPhone` als Pflichtfeld (siehe IT11 Booking-Schema). Wenn Kunde keine Telefon im Profil hat → Buchungs-Feld leer prefilled → Kunde muss manuell eingeben → Validation kann dann fehlschlagen, falls Format nicht passt. UX-Spec §3.4.4 hat den `partial-prefill`-State, aber **kein expliziter Validation-Hint** für leere Pflicht-Felder.
- ⚠ **Hydration-Mismatch-Risiko** (Frontend-Doc benannt): Skeleton-Gating ist die richtige Lösung, aber Frontend-Doc spricht nur das Buchungsformular an („`BookingClient.tsx` macht das bereits richtig"). Im Profilformular und im (zukünftigen) Kontaktformular ist das Pattern **nicht implementiert** — Engineer muss wissen: gleiches Skeleton-Gating überall.
- ⚠ **`customerName` Split**: Frontend-Doc Z. 391-402 erklärt: aktuelles Schema hat `customerName` als ein Feld, kein First/Last separat → Prefill ist `${firstName} ${lastName}`.trim(). UX-Spec §3.4.1 listet aber „Vorname"/„Nachname" als zwei Buchungs-Form-Felder. Auch wenn das ein Hinweis darauf ist, dass eines der beiden Specs die echte UI-Wahrheit nicht trifft — Engineer muss im PR konkret prüfen, wie das Formular-Schema heute aussieht.
- ⚠ **Auth-Loss-Verhalten**: UX-Spec §1.2 (Logout während offener Sitzung) und Frontend-Doc §S04 widersprechen sich nicht direkt, aber UX-Spec verlangt explizit „Werte bleiben sichtbar, kein Reset" — das ist ein Pattern, das im React-Code bewusst implementiert werden muss (z. B. nicht `useCustomer()`-Reset-Trigger an Form-State koppeln). Frontend-Doc erwähnt das nur knapp („`error-fallback`-State").

**Behebungsvorschläge:**
- **pm/ux:** Klären: soll es einen Toggle „Adresse aus Profil verwenden / abweichende Adresse für diese Buchung" geben? UX-Empfehlung: **ja, in IT14**; für IT13 reicht das stille Override-Pattern, aber explizit auf das Backlog setzen.
- **architect:** Bestätigen, dass `customerName` wirklich ein einzelnes Feld ist (vs. Vorname/Nachname); UX-Spec §3.4.1 entsprechend anpassen.
- **ux:** §3.4.4 um „Partial-prefill mit fehlendem Pflicht-Telefon" erweitern: Validation-Hint sollte sichtbar sein, sobald User das Feld berührt — nicht erst beim Submit.

---

### S05 — Production-Bug Bilder-Upload ⚠ **Needs Clarification**

**Geprüft:** Diagnose-Pfad in Backend-Doc; Code-Stand `src/app/api/upload/route.ts`; Hypothesen-Liste; Variante A/B/C für Body-Size.

**Risiken / Lücken:**
- 🟠 **Body-Size-Strategie nicht entschieden** (Backend-Doc Open Question #2): Variante A (Direct-Upload-Refactor, ~4h), Variante B (Client-Resize 5MB Quick-Fix), Variante C (Pro-Plan-Upgrade). Story-AC nennt 10 MB als Limit. **Vercel Hobby Default ist 4.5 MB** — wenn der User wirklich 10 MB hochladen will, scheitert es **unabhängig vom Token**. Backend-Doc beschreibt das gut, aber **trifft keine Entscheidung**. Wenn Engineer „nur den Token fixt" und das echte Problem das Body-Limit ist, kommt der Bug in einer Iteration zurück.
- 🟠 **Logging-Plan-B fehlt**: Wenn die primäre Hypothese (BLOB_READ_WRITE_TOKEN ungültig) falsch ist, gibt es keinen klaren Eskalationspfad. Backend-Doc empfiehlt eine Logging-Verbesserung um `prismaCode`/`X-Request-Id` (steht als „optional, kann auf Backlog wenn Zeit-knapp"). **Empfehlung: das ist nicht Backlog, das ist Voraussetzung**, sonst läuft die nächste Iteration in eine ähnliche Sackgasse.
- ⚠ **Diagnose-Schritte sind sequenziell** (`vercel env ls`, `vercel logs`, etc.) — aber Engineer hat möglicherweise keinen direkten Vercel-CLI-Zugang. Tom hat Zugang. Wer führt die Diagnose-Schritte aus? **PM/Tom muss involviert sein**, sonst ist der Engineer blockiert.
- ⚠ **„Token falsch" — Solution ohne Code-Change**: Wenn Hypothese 1 stimmt, ist die Lösung rein im Vercel-Dashboard (Storage → Blob → „Connect to Project"). **Kein PR nötig, kein Engineer nötig** — Tom selbst kann das fixen. Backend-Doc sagt das nicht klar genug. Risiko: Engineer öffnet einen PR mit Code-Change, der eigentlich nichts beiträgt.

**Behebungsvorschläge:**
- **pm (Tom) + architect:** Body-Size-Entscheidung **vor** Build treffen. Wenn 10 MB als Hard-Limit bleiben sollen → Variante A (Direct-Upload) ist Pflicht, ~4h Refactor. Wenn 5 MB akzeptabel sind → Variante B reicht. UX-Empfehlung: Variante B als Quick-Fix in IT13 + Variante A als IT14-Backlog.
- **architect:** Logging-Verbesserung in `internalError()` als **Pflicht** in S05 + S06 schreiben, nicht „optional" — sonst diagnostiziert man den nächsten Production-Bug auch wieder im Blindflug.
- **pm (Tom):** Die ENV-Diagnose-Schritte (`vercel env ls`, Vercel-Dashboard-Token-Refresh) selbst durchführen *bevor* der Engineer-Sprint startet — möglicherweise ist der „Bug" damit bereits behoben und man hat 3 Story-Punkte Luft.

---

### S06 — Production-Bug Anfrage absenden ⚠ **Needs Clarification**

**Geprüft:** Diagnose-Pfad, Migration-Liste, ENV-Liste, Code-Pfade in `src/app/api/bookings/route.ts`, `BOOKING_TOKEN_SECRET`-Verhalten.

**Risiken / Lücken:**
- 🟠 **Migration-Auto-Apply nicht entschieden** (Backend-Doc Open Question #5): Manuelles `turso db shell < migration.sql` ist die akute Lösung, aber das ist die **dritte Iteration mit demselben Migration-Drift-Bug** (IT10, IT12 und nun IT13). UX-Spec sagt nichts; Backend-Doc empfiehlt ein `scripts/migrate-turso.sh`-Wrapper. Ohne diesen Wrapper kommt der Bug in IT14 wieder. **Strukturelles Risiko, nicht Story-Risiko.**
- 🟠 **`BOOKING_TOKEN_SECRET` Soft-Fail-Verhalten** (Backend-Doc Open Question #4): Aktuell loggt der Code nur, wenn die ENV fehlt, und schreibt `confirmationToken=null`. Backend-Doc empfiehlt: hart fehlen lassen. Aber Empfehlung ist ja noch nicht **Entscheidung**. Wenn die Entscheidung „weich" lautet, sollte Frontend einen Fallback-Pfad haben (kein Confirmation-Link in der E-Mail) — **dafür gibt es keine UX-Spec**.
- ⚠ **Prisma-Code-Logging**: Backend-Doc empfiehlt `internalError()`-Erweiterung um `prismaCode`/`meta`. Identisch zu S05 — als Pflicht statt Optional definieren.
- ⚠ **Smoke-Test-AC**: AC#5 verlangt „Smoke-Test in Production durchgeführt wird (Gast-Buchung + eingeloggte Buchung)". Wer testet? Tom oder Engineer? Wenn Tom: muss er einen Test-Mail-Account haben oder fakt sich seine eigene Buchung an? UX-Spec liefert keinen Smoke-Test-Plan, Architect liefert nur den `curl`-Command (Z. 513-518) — **keiner liefert einen End-to-End-Browser-Smoke-Plan**.
- ⚠ **Idempotency-Tabelle als P2021-Risiko**: Hypothese 5 in Backend-Doc nennt das genau — `idempotency_keys` fehlt vermutlich in der Production-DB. Wenn Engineer die Migrations nachzieht und das fixt, sollte er aber auch verifizieren, dass das **Frontend** seinen `Idempotency-Key`-Header tatsächlich setzt. Frontend-Requirements §S06 sagt: „FE-Verhalten unverändert". Trotzdem: schnelle Verifikation der Header-Setzung im Frontend gehört in den Smoke-Test.

**Behebungsvorschläge:**
- **pm (Tom):** Wer macht den Smoke-Test in Production? Tom oder Engineer? Konkretes Skript für den manuellen Test bereitstellen (UX/QA kann das in IT13 oder als Backlog-Item liefern).
- **architect:** Open Question #4 hart entscheiden: `BOOKING_TOKEN_SECRET` fehlt → 503 + Klartext-Fehler im Frontend („Konfiguration unvollständig — bitte später wiederholen"). UX-Spec ergänzen.
- **architect:** Migration-Wrapper-Skript (`scripts/migrate-turso.sh`) als Story IT13-S09 (oder Backlog) anlegen, sonst kommt der Bug in IT14 wieder.

---

### S07 — PNG-Transparenz ✅ **Ready**

**Geprüft:** Container-Klassen-Konvention, alle 7 Service-Detail-Pages, Service-Cards, DOM-Inspect-AC. Code-Stand: `ServiceDetailHero.tsx:56` hat `bg-baerenstark-cream/40` → Fix-Pfad ist `bg-transparent` (Frontend-Doc) bzw. `bg-baerenstark-cream/60` (UX-Spec — Letterbox-Token).

**Risiken / Lücken:**
- ⚠ **Konflikt zwischen S07 und S08 in der Container-Klasse**: S07 (Frontend-Doc) verlangt `bg-transparent` am Container. S08 (UX-Spec §1.4 + Design-System IT13-D2) verlangt `bg-baerenstark-cream/60` als Letterbox-Hintergrund **am gleichen Container**. Das sind **gegensätzliche Anweisungen** für *eine Tailwind-Klasse*. UX-Spec §1.4 löst das auf: Container = Cream/60 (Letterbox), `<Image>` selbst = `bg-transparent`. Das funktioniert, weil das Bild vor dem Container liegt — die transparenten PNG-Pixel zeigen Cream/60 statt direkt den Page-Hintergrund. **Frontend-Doc widerspricht dem Pattern**. Engineer muss dem UX-Spec folgen, sonst: entweder kein Letterbox-Hintergrund (S08 bricht visuell) oder kein Transparenz-Effekt (S07 bricht).
- ⚠ Tailwind-Token-Konsistenz: `bg-baerenstark-cream/60` ist nur ein Tailwind-Opacity-Modifier auf einem Bestand-Token, **kein neuer Token**. Design-System IT13-D2 dokumentiert das korrekt. ✓ Token-konsistent.

**Behebungsvorschläge:**
- **architect:** Frontend-Doc §S07 gegen UX-Spec §1.4 abgleichen — die UX-Wahrheit ist: Container = Cream/60, `<Image>` = bg-transparent. Frontend-Doc Z. 482-487 entsprechend korrigieren.
- **ux:** S07-Acceptance-Mapping AC#3 („kein `bg-white`/`bg-gray-100`/`bg-cream` an `<img>` oder direktem Container") in §1.3 ist verbindlich. Bei DOM-Inspect wird `bg-baerenstark-cream/60` am Container nicht-AC-verletzend sein, weil das **kein** weißer/grauer Hintergrund ist und der `<Image>` selbst transparent ist. **Aber**: ein QA-Tester, der nur die Story-AC liest („kein opaker Hintergrund"), könnte `bg-baerenstark-cream/60` als Verletzung interpretieren. Story-AC wording schärfen oder UX-Spec-Verweis dazuschreiben.

---

### S08 — Service-Detail-Bilder Frame ✅ **Ready**

**Geprüft:** `object-cover` → `object-contain`, max-Breite, Aspect-Ratios Mobile/Desktop, Letterbox-Strategie, Component-Library §4.

**Risiken / Lücken:**
- ⚠ **Aspect-Ratio-Inkonsistenz Frontend-Doc ↔ UX-Spec**: Frontend-Doc nennt `aspect-[4/3]` Mobile / `aspect-[3/2]` Desktop **und** `max-h-[28rem]` als Hard-Cap. UX-Spec § 1.4 nennt dieselben Aspect-Ratios, aber **kein** `max-h-[28rem]` — nur `max-w-640px` Desktop. Beide widerspruchsfrei lösbar (Cap auf Höhe + Cap auf Breite gleichzeitig OK), aber Engineer muss wissen, ob `max-h-[28rem]` Pflicht oder optional ist.
- ⚠ **Letterbox-Token-Konsistenz mit S07**: identisch zum S07-Punkt oben — Container = Cream/60, kein Konflikt mit S07 wenn UX-Spec gefolgt wird. ✓
- ⚠ **Hover-Skalierung**: Frontend-Doc behält `motion-safe:hover:scale-[1.02]`, UX-Spec §3.8.4 erwähnt es ebenfalls. Bei `object-contain` und einem Bild kleiner als der Container kann die Skalierung das Bild **über die Letterbox-Streifen hinaus** vergrößern und die Frame-Border treffen. **Visuell prüfen** beim Build.

**Behebungsvorschläge:**
- **architect/ux:** Eine Quelle für die Frame-Dimensionen festlegen. UX-Empfehlung: Component-Library §4.2-4.3 als Source-of-Truth, `max-h-[28rem]` als optional vermerken (oder weglassen).

---

## 3. Cross-Cutting Concerns

### 3.1 Open Questions Status

Konsolidierte Liste — siehe Sektion 4 unten.

### 3.2 Konflikte zwischen Architect und UX

| # | Konflikt | Architect | UX | Empfehlung |
|---|----------|-----------|----|----|
| 1 | **Datenlöschungs-URL** (S01) | `/datenschutz/loeschung` | `/datenschutz/datenloesung` | UX folgen (Story-AC ist UX) |
| 2 | **Header-Selector** (S03) | `[data-header]` | `[data-app-header]` | UX folgen (neuere Konvention) |
| 3 | **Modal-Scroll-Selector** (S03) | `[data-scroll-container]` | `[data-modal-body]` | UX folgen |
| 4 | **Scroll-Helper-API** (S03) | `scrollToSection()` Funktion | `useScrollToSection()` Hook | UX folgen (deklarativ, React-Hook-konform) |
| 5 | **Section-IDs** (S03) | Bestand IT12 `*-section` | Neu `data-section-anchor="*"` | additiv beide nutzen, oder Migration auf neues Pattern (architect klärt) |
| 6 | **Container-Bg S07/S08** | `bg-transparent` | `bg-baerenstark-cream/60` | UX folgen (löst S07 + S08 gleichzeitig sauber auf) |
| 7 | **Frame-Dim-Cap S08** | `max-h-[28rem]` | nicht erwähnt | optional |
| 8 | **Aufbewahrungsfrist** (S01) | 6 Jahre HGB | 10 Jahre AO §147 | rechtliche Klärung — Tom/Steuerberater |

### 3.3 Facebook-Callback-URL — die Wahrheit

**Architect-Wahrheit:** `https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook` (mit `customer/`).

**Story-Notes-Wahrheit (Z. 95):** `https://www.baerenstark-hausservice.app/api/auth/callback/facebook` (ohne `customer/`).

**Code-Wahrheit:** `customer-oauth.ts` hat `basePath: '/api/auth/customer'` (Z. 366). Google-Callback nutzt produktiv `…/api/auth/customer/callback/google`. **Architect hat Recht.**

**Aktion:** Story-Notes Z. 95 korrigieren (oder im PR explizit als überholt markieren). Sonst trägt jemand die falsche URL in Facebook-Console ein und der OAuth-Flow scheitert.

### 3.4 Testbarkeit — wie wird verifiziert?

| Story | Test-Methode | Verantwortlich |
|-------|--------------|----------------|
| S01 | `curl -I` für 200, manueller Browser-Aufruf für Inhalt, Footer-Link-Klick, Datenschutz-Anchor-Klick | Engineer + QA |
| S02 | Vercel-Logs für `redirect_uri_mismatch`-Frei, manueller Klick auf Facebook-Button (Smoke-Test in Production), App-Live-Status-Prüfung im Facebook Developer Dashboard | Tom (mit Hilfe Engineer) |
| S03 | Browser-Test bei 360 px, 1280 px, mit / ohne `prefers-reduced-motion`, Modal-Steps durchklicken, Tab-Navigation (Heading-Focus prüfen), Lighthouse Accessibility | QA-Browser-Test + Unit-Test für Hook |
| S04 | Eingeloggter Browser-Test: Buchungs-Form-Felder geprüft, Profilformular-Felder geprüft, Logout-während-Form-Open simulieren, 401-Fall (Cookie löschen) | QA-Browser-Test |
| S05 | Vercel-Logs „kein INTERNAL_ERROR mehr", Production-Upload eines 5 MB JPEG, eines 10 MB JPEG (für Body-Limit-Test), DOM-Vorschau-Check, Admin-Dashboard-Bild-Anzeige | Tom + Engineer |
| S06 | Vercel-Logs „kein 500 mehr", `curl`-Production-Test, Browser-Smoke-Test (Gast + eingeloggt), Admin-Dashboard-Anzeige | Tom + Engineer |
| S07 | DOM-Inspect aller Service-Card-Container, Browser-Screenshot-Diff (Letterbox sichtbar als Cream/60), 7 Service-Detail-Pages durchklicken | QA-Browser-Test |
| S08 | Browser-Test bei 360/768/1280 px, alle 7 Detail-Pages, Bild vollständig sichtbar (kein Cropping), Letterbox-Streifen sichtbar | QA-Browser-Test |

**Lücken:** Kein automatisierter E2E-Test für den Buchungs-Wizard. Kein Unit-Test-Skelett für `useScrollToSection`-Hook (Component-Library nennt nur das API). Lighthouse-/Axe-Pass für S03+S04 wäre wertvoll, ist aber nicht in den Acceptance Criteria.

### 3.5 Production-Bug-Risiko (S05/S06): Diagnose vs. Hypothese

**Risiko:** Beide Stories leben von Hypothesen über die Ursache. Backend-Doc listet jeweils 5-8 Hypothesen pro Bug. Wenn die Hypothese richtig ist, ist der Fix trivial (ENV setzen, Migration nachziehen). Wenn die Hypothese **falsch** ist, gibt es **keinen klaren Plan-B** im Spec.

**Mitigation (im Backend-Doc empfohlen, aber als „optional" markiert):**
- Logging-Verbesserung: Prisma-Code in Vercel-Logs sichtbar machen — sollte **Pflicht** sein, nicht optional. Andernfalls steht Engineer beim ersten Fehlversuch ohne Diagnose-Daten da.
- `X-Request-Id` im Response-Header: erlaubt Vercel-Log-Korrelation — sollte **Pflicht** sein.

**Konkrete Empfehlung:** S05 und S06 in zwei Phasen splitten:
- Phase 1 (PM/Tom-Aufgabe, 0 Code): ENV-Vars und Migration-Status manuell prüfen + ggf. fixen. Smoke-Test. Wenn behoben → Story-Punkt eingespart.
- Phase 2 (Engineer-Aufgabe, falls Phase 1 nicht ausreicht): Code-Patch mit Logging-Verbesserung + ggf. Body-Size-Strategie für S05.

---

## 4. Konsolidierte Open Questions

| # | Frage | Quelle | Blockiert Build? | Wer antwortet? |
|---|-------|--------|------------------|----------------|
| 1 | Welche URL kanonisch für Datenlöschung: `/datenschutz/loeschung` oder `/datenschutz/datenloesung`? | Backend-Doc, UX-Spec, Story-AC | **JA** (S01 + S02 hängen daran) | **PM/Tom** (Facebook-Console-Wahrheit) |
| 2 | Body-Size-Strategie für Upload (S05): Variante A/B/C? | Backend-Doc OQ#2, Architecture-Risiken | **JA** (sonst kommt Bug zurück) | PM/Tom + architect |
| 3 | Multi-OAuth-Linking-Verhalten (S02): single-valued überschreiben oder Multi-Schema? | Backend-Doc OQ#3 | NEIN (akzeptabler Trade-off für IT13) | architect (Backlog für IT14) |
| 4 | `BOOKING_TOKEN_SECRET`-Fallback (S06): hart fehlen oder Soft-Fail? | Backend-Doc OQ#4 | NEIN (Soft-Fail aktuell, harten Fail empfohlen) | architect |
| 5 | Migration-Auto-Apply (S06): `scripts/migrate-turso.sh` in IT13 oder Backlog? | Backend-Doc OQ#5 | NEIN (manueller Fix möglich) | architect (Empfehlung: in IT13) |
| 6 | Modal-Header-Höhe für Scroll-Helper (S03): 0 oder `[data-modal-header]`? | Frontend-Doc OQ#1, UX-Spec §1.1.5 | NEIN (Default 0 funktioniert) | ux/architect |
| 7 | Service-Card-Hintergrund S07: vollständig transparent oder nur Bild-Wrapper? | Frontend-Doc OQ#2, UX-Spec §1.3 | NEIN (UX-Empfehlung klar) | ux |
| 8 | Letterbox-Theme S08: Cream/60 vs. transparent? | Frontend-Doc OQ#3, UX-Spec §1.4 | NEIN (UX entschieden) | ux |
| 9 | Adress-Banner-Wording S04: Anker-Link oder Page-Link? | Frontend-Doc OQ#4 | NEIN | ux (Anker empfohlen) |
| 10 | Telefon-Hint S04: opt-in Hint oder still leer? | Frontend-Doc OQ#5 | NEIN | ux/pm |
| 11 | Facebook-Callback-URL: Story-Notes vs. Architect — welche ist eingetragen? | UX-Spec §6 OQ#2, Story-Notes Z.95 | **JA** (S02 OAuth-Flow scheitert sonst) | **PM/Tom** (Facebook-Console-Wahrheit) |
| 12 | Section-Anchor-Schema S03: Migration der bestehenden `*-section`-IDs oder additiv `data-section-anchor`? | Frontend-Doc vs. UX-Spec | **JA** (Engineer kann beides bauen, doppelte Arbeit) | architect/ux |
| 13 | Header-Selector S03: `[data-header]` vs. `[data-app-header]`? | Frontend-Doc vs. UX-Spec | **JA** (Selektor-Mismatch silently failing) | architect/ux |
| 14 | Scroll-Helper-API S03: Funktion `scrollToSection()` vs. Hook `useScrollToSection()`? | Frontend-Doc vs. Component-Library | **JA** (zwei verschiedene API-Patterns) | architect/ux |
| 15 | OAuthButton-Refactor (S02): Option A (Inline) oder Option B (Generic Variant)? | Component-Library §2 | NEIN (UX-Empfehlung A) | architect |
| 16 | Rechtliche Aufbewahrungsfrist S01: 6 Jahre HGB oder 10 Jahre AO §147? | Backend-Doc vs. UX-Spec | NEIN (kosmetisch, aber auf der Compliance-Seite) | pm/Tom (Steuerberater?) |
| 17 | Auto-Save Form-State bei Auth-Loss (§1.2): sessionStorage-Persistenz? | UX-Spec §6 OQ#6 | NEIN (Backlog) | architect |
| 18 | PrefillNotice-Component-Refactor: zentralisieren? | Component-Library OQ#1 | NEIN (Engineer-Entscheidung) | architect |
| 19 | Smoke-Test-Verantwortung S05/S06: Tom oder Engineer? | nicht explizit | **JA** (sonst kein Sign-off) | pm/Tom |
| 20 | Andere-Adresse-für-Buchung-Toggle S04: in IT13 oder Backlog? | nicht erwähnt | NEIN (Backlog empfohlen) | pm/ux |

**Build-Blocker zusammengefasst:** OQ #1, #2, #11, #12, #13, #14, #19. Sieben Klärungen, zwei davon (#1, #11) gehen direkt an Tom. Fünf gehen an architect/ux gemeinsam.

---

## 5. Test-Strategie für Phase 4

### Manuelle Browser-Tests
- **Login-Flow** (S02): Facebook-Button sichtbar, Klick-Flow durchspielen (Production), Fehler-Banner für `oauth_no_email` und `oauth_unverified_conflict` provozieren.
- **Buchungs-Wizard** (S03 + S04): Step-für-Step-Klick mit aktiviertem `prefers-reduced-motion: reduce` (DevTools → Rendering); Heading-Focus visuell prüfen (Outline-Ring); Tab-Navigation; Eingeloggt vs. Gast.
- **Quick-Booking-Modal** (S03): Modal-Inneres scrollt, Hintergrund nicht; Esc schließt.
- **Profilformular** (S04): Hash-Anker-Sprung (`/konto/profil#profile-section-address`).
- **Service-Detail-Pages** (S07 + S08): Alle 7 Slugs durchklicken, 360/768/1280 px Viewports, DOM-Inspect-Check, Screenshot-Diff.
- **Datenlöschungs-Page** (S01): direkter Aufruf, Footer-Link, Datenschutz-Anchor, Mailto-Klick (öffnet Mail-Client mit Betreff).

### Production-Verifikation
- **Vercel Logs Tail** während Smoke-Test: keine `INTERNAL_ERROR`, keine `redirect_uri_mismatch`, keine `prismaCode=P*`.
- **Facebook Developer Dashboard:** App-Status „Live", Datenlöschungs-URL eingetragen, Valid OAuth Redirect URI mit `customer/` korrekt.
- **`curl -I https://www.baerenstark-hausservice.app/datenschutz/{datenloesung|loeschung}`** → 200 erwartet (kanonische URL nach OQ#1-Klärung).
- **`curl -X POST https://…/api/bookings`** mit Test-Payload (Backend-Doc Z. 513) — 201 erwartet.

### Unit-/Integration-Tests
- **`useScrollToSection`-Hook** (S03): Jest-Test mit jsdom — `scrollIntoView`-Mock, `requestAnimationFrame`-Mock, `prefers-reduced-motion`-MediaQuery-Mock. Verifikation: Hook ruft `scrollIntoView` mit korrektem `behavior`-Wert; ruft `focus()` auf Heading-`tabindex="-1"`-Element.
- **`scrollToElement` Modal-Branch**: Test, dass `closest('[data-modal-body]')` korrekt erkannt wird und `scrollContainer.scrollTo(...)` statt `window.scrollTo(...)` aufgerufen wird.
- **Prefill-Logic** (S04): Test der `useCustomer()`-`status`-Übergänge gegen Form-`reset()`-Aufrufe; Skeleton-State während `loading`.
- **`internalError()`-Logging-Erweiterung** (S05/S06): Snapshot-Test für `console.error`-Output mit `prismaCode`-Annotation.

### E2E-Tests (Playwright/Cypress, falls in Codebase vorhanden)
- **Buchungs-Wizard End-to-End**: Service → Tag → Dauer → Slot → Form → Submit. Verifizieren: Scroll-Verhalten + Prefill (eingeloggt) + Submit-201-Erfolg.
- **Wenn keine E2E-Suite existiert** (Status zu prüfen): Manueller Smoke-Test in QA durch QA-Engineer, Test-Skript dokumentieren als Markdown-Checkliste im PR.

### Accessibility-Pass (S03 + S07 + S08)
- Lighthouse Accessibility-Score ≥ 95 auf `/buchung`, `/konto/profil`, `/services/entruempelung`, `/datenschutz/{datenloesung|loeschung}`.
- Axe-DevTools-Run.
- Screenreader-Pass (VoiceOver auf macOS oder NVDA): Heading-Focus nach Step-Wechsel hörbar.

### Visual Regression
- Screenshot-Diff der Service-Detail-Pages **vor / nach** S07+S08 (Tom-Sign-off).
- Letterbox-Streifen sind sichtbar (Cream/60), Bilder zentriert, kein Cropping.

---

## 6. Empfehlung an den Orchestrator

1. **Vor Build-Start: Open-Questions-Round abfangen.** Mindestens OQ #1, #11 zu Tom. OQ #12, #13, #14 zwischen architect und ux klären. OQ #2, #19 zu PM/Tom.
2. **Architect bekommt Patch-Auftrag** für Backend-Requirements + Architecture-Diagramm: URL-Konflikt auflösen, Story-Notes Z.95 korrigieren, Selector-Konflikt zwischen Frontend-Doc und UX-Spec auflösen.
3. **UX bekommt Patch-Auftrag** für UX-Spec §1.1: Komfort-Tolerance ±8 px ergänzen; Edge-Case Multi-OAuth-Conflict in §3.2.6.
4. **PM/Tom Action Items** (vor Build): ENV-Vars in Vercel verifizieren, Migration-Status auf Turso prüfen, Facebook-Developer-Console-URL bestätigen.
5. **Engineer-Sprint kann parallel starten** für S07, S08 (✅ Ready) — diese sind unabhängig von den Klärungen.

---

*Ende des QA-Design-Reviews IT13.*
