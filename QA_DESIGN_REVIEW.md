# QA Design Review — Bärenstark Hausservice

**Modus:** Design QA (vor Code-Erstellung)
**Datum:** 2026-05-02
**Iteration:** 1
**Reviewer:** Senior QA Engineer
**Geprüfte Artefakte:**
- `PROJECT.md` (User Stories US-01 bis US-12)
- `ARCHITECTURE.md` (v1.0 MVP)
- `contracts/api-routes.md`
- `contracts/schema.prisma`

---

## Verdict (Kurzfassung)

**Design muss überarbeitet werden.**

Pass-Quote der Akzeptanzkriterien (Testbarkeit gegen Spec): 14/19 (74 %).
Kritische Defekte: **5**, Wichtige: **8**, Minor: **6**.

Das Design ist solide und die Architekturentscheidungen sind für den Use-Case angemessen. Es gibt jedoch **mehrere kritische Lücken**, die VOR Implementierungsbeginn geschlossen werden müssen — insbesondere eine Race-Condition auf `slotId`, eine inkonsistente Definition von „belegt" zwischen US-03/US-04 und der API-Spec, sowie ein Konflikt zwischen `Booking.customerEmail = NULL` (Prisma) und dem Vorhandensein des Felds im API-Request-Body.

---

## 1. Test-Matrix (Akzeptanzkriterien gegen Design)

| Story | AC      | Test-Case (gegen Spec)                                                                       | Layer    | Status | Anmerkung                                                                                                  |
| ----- | ------- | -------------------------------------------------------------------------------------------- | -------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| US-01 | AC-1    | 6 Services aus `lib/services.ts` werden auf `/` gerendert                                    | FE       | Pass   | Vollständig spezifiziert.                                                                                  |
| US-01 | AC-2    | Mobile-Layout ohne horizontales Scrollen                                                     | FE       | Partial| Tailwind reicht in der Theorie, aber **kein konkretes Mobile-Breakpoint-Layout für ServiceGrid spezifiziert**. |
| US-02 | AC-1    | Footer mit Telefon, E-Mail, Standort                                                          | FE       | Pass   |                                                                                                            |
| US-02 | AC-2    | `tel:`-Link springt aus Smartphone in Telefon-App                                            | FE       | Pass   | `tel:+4915774787512` in §9 spezifiziert.                                                                   |
| US-03 | AC-1    | `/buchung` zeigt freigegebene Slots                                                          | FE+BE    | Pass   | `GET /api/slots` deckt das ab.                                                                             |
| US-03 | AC-2    | Ausgebuchtes Zeitfenster ist als nicht-buchbar markiert UND nicht auswählbar                  | FE+BE    | **Fail** | Siehe **BUG-001**: `isBooked` setzt `CONFIRMED` voraus — `PENDING` Slots werden weiter angeboten und damit doppelt buchbar. |
| US-04 | AC-1    | Buchungsanfrage abschicken → Bestätigung auf Seite                                            | FE+BE    | Pass   |                                                                                                            |
| US-04 | AC-2    | Pflichtfeld leer → Inline-Fehler ohne Page-Reload                                            | FE       | Pass   | React Hook Form + Zod abgebildet.                                                                           |
| US-05 | AC-1    | Neuer Slot erscheint **sofort** in öffentlicher Buchungsansicht                              | FE+BE    | Partial| Siehe **BUG-007**: Caching/Revalidation für `GET /api/slots` ist nicht spezifiziert.                       |
| US-05 | AC-2    | Slot löschen → innerhalb von Sekunden nicht buchbar                                          | FE+BE    | **Fail** | Siehe **BUG-003**: `ON DELETE RESTRICT` verhindert Löschen, wenn ein PENDING vorliegt — AC ist nicht erfüllbar. |
| US-06 | AC-1    | Anfragen-Liste mit Name, Service, Zeitfenster, Status                                        | FE+BE    | Pass   | `GET /api/bookings` liefert alles.                                                                         |
| US-06 | AC-2    | „Bestätigen" → Status `CONFIRMED` → Slot wird in Buchungsansicht als belegt markiert         | FE+BE    | Pass   | `PATCH /api/bookings/:id` deckt das ab; siehe aber BUG-001 für die andere Richtung.                        |
| US-07 | AC-1    | Login mit gültigen Credentials → Redirect zum Dashboard                                       | BE       | Pass   |                                                                                                            |
| US-07 | AC-2    | Falsche Credentials → generische Fehlermeldung                                                | BE       | Pass   |                                                                                                            |
| US-07 | AC-3    | Direkter Aufruf einer Admin-URL ohne Session → Redirect zur Login-Seite                       | BE       | Partial| Siehe **BUG-005**: `callbackUrl` Open-Redirect-Schutz nicht spezifiziert.                                  |
| US-08 | AC-1    | E-Mail an Tom mit Name, Service, Zeitfenster, Kontaktdaten                                   | BE       | Partial| Siehe **BUG-002**: kein Retry/Outbox bei Resend-Ausfall, „non-blocking" und „verlässliche Zustellung" stehen im Widerspruch. |
| US-12 | AC-1    | Footer-Links zu Impressum/Datenschutz                                                         | FE       | Pass   | Statische Seiten reichen.                                                                                  |

---

## 2. Kritische Defekte (Blocker — vor Code beheben)

---

### BUG-001 (Critical, Contract/Design): `isBooked`-Logik führt zu Doppelbuchungen

**Story:** US-03 AC-2, US-04
**Layer:** API-Spec / Datenmodell / Frontend-UX

**Beschreibung:**
Laut `api-routes.md` (Z. 77) gilt `isBooked = true` ⇔ es existiert eine Booking mit Status **`CONFIRMED`**. Das bedeutet: Sobald ein Kunde A einen Slot anfragt (Status `PENDING`), bleibt der Slot für Kunde B weiterhin buchbar, weil `isBooked` noch `false` ist. Tom hat dann zwei `PENDING`-Anfragen für denselben Slot.

`POST /api/bookings` prüft laut Spec ebenfalls nur „Slot muss existieren und nicht `isBooked=true` sein" (Z. 169) — also blockiert nur `CONFIRMED`. Das öffnet eine UX-Lücke und einen Vertrauensbruch (Kunde wird angeschrieben, weil bereits jemand anders bestätigt wurde).

US-03 AC-2 sagt: **„Given ein Zeitfenster ist bereits ausgebucht, Then ist dieses Zeitfenster als nicht buchbar markiert."** Die User-Story-Sprache („ausgebucht") legt nahe, dass nach der ersten Anfrage der Slot nicht mehr offen sein sollte — zumindest bis Tom entschieden hat.

**Schritte zur Reproduktion (gedanklich gegen Spec):**
1. Tom legt Slot S1 an.
2. Kunde A bucht S1 → `Booking { status: PENDING, slotId: S1 }`.
3. `GET /api/slots` liefert S1 mit `isBooked: false`.
4. Kunde B sieht S1 als verfügbar, bucht S1 → akzeptiert (es greift kein 409).
5. Tom hat nun zwei PENDING-Anfragen für denselben Slot, muss eine ablehnen, der Kunde fühlt sich verschaukelt.

**Erwartet:** Slot ist ab erster Anfrage (oder spätestens nach Bestätigung) für weitere Kunden gesperrt. Wenn parallel-pending erlaubt sein soll, muss das **explizit** im Design dokumentiert werden, weil es ein UX-Anti-Pattern ist.

**Vorschlag:**
- Option A (empfohlen): `isBooked = true` ⇔ es existiert **mindestens eine Booking mit Status `PENDING` oder `CONFIRMED`**. POST-Bookings auf solche Slots → 409 `CONFLICT`. Wenn Tom ablehnt (`REJECTED`), wird der Slot wieder frei. Das ist eindeutig, deckt US-03 AC-2 sauber ab und vermeidet Doppel-PENDINGs.
- Option B: `Slot.bookings` per DB-Constraint auf max. 1 aktive Buchung beschränken (Partial-Index `WHERE status IN ('PENDING','CONFIRMED')`). SQLite/libSQL unterstützt Partial-Indexes. Damit wird die Race-Condition (siehe BUG-006) gleich auf DB-Ebene abgefangen.
- Option C (falls Tom Mehrfach-Anfragen wünscht): Explizit dokumentieren, FE muss „X weitere Anfragen für dieses Zeitfenster" anzeigen.

**Routing:** `solution-architect`

---

### BUG-002 (Critical, Design): E-Mail-Versand ist nicht zuverlässig — US-08 AC-1 kann fehlschlagen, ohne dass jemand es merkt

**Story:** US-08 AC-1
**Layer:** Backend / E-Mail

**Beschreibung:**
ARCHITECTURE.md §6 sagt: „Versand erfolgt non-blocking … wenn Resend fehlschlägt, wird die Buchung trotzdem persistiert; Fehler werden geloggt, aber dem Kunden nicht angezeigt." Dies erfüllt US-08 AC-1 **nur scheinbar**. Wörtlich verlangt AC-1: „**Then erhält Tom eine E-Mail**" — das ist eine Garantie, kein Best-Effort.

Das aktuelle Design kennt **keinen Retry, keine Outbox, keine Alerting-Pflicht für Tom**. Wenn Resend einmal pro Monat 500ert, weiß Tom nichts von der Anfrage, der Kunde wartet, das Geschäft schadet.

**Erwartet:** US-08 muss eine zuverlässige Zustellung garantieren oder das AC muss heruntergesetzt werden.

**Vorschlag:**
- Outbox-Pattern: bei jedem `POST /api/bookings` zusätzlich Eintrag in `EmailOutbox` (id, payload, status `PENDING/SENT/FAILED`, attempts, lastError, sentAt). Cron oder serverseitige Retry-Logik (Vercel Cron Job, kostenlos im Hobby-Plan: 2/Tag — reicht).
- Alternativ: Einfacher Retry mit exponential Backoff im Request-Handler (3 Versuche, max. 3 s) und Fail-Loud im Admin-Dashboard (rotes Banner „1 Buchung mit fehlgeschlagener Mail-Benachrichtigung — bitte prüfen").
- Mindestens: Tom braucht im Admin-Dashboard einen **Mail-Status pro Booking** (`mailSent: boolean`, `mailError: string?`), damit er manuelle Fehlfälle sieht. Das Feld fehlt komplett im Schema.
- Fallback dokumentieren: Wenn Resend down ist, soll die Buchung weiterhin gespeichert werden (richtig so) — aber Tom muss vom Admin-Dashboard regelmäßig informiert werden („3 ungesehene Anfragen seit gestern").

**Routing:** `solution-architect` (Schema + API-Spec) / ggf. `project-manager` (US-08 AC-1 schärfen oder neue Story für Outbox)

---

### BUG-003 (Critical, Design): Slot-Löschung bei PENDING-Anfrage blockiert — US-05 AC-2 unerfüllbar

**Story:** US-05 AC-2
**Layer:** API-Spec / Datenmodell

**Beschreibung:**
`api-routes.md` Z. 132–140 und Prisma-Schema Z. 47 (`onDelete: Restrict`) sagen: ein Slot kann **nicht** gelöscht werden, solange eine Booking (Status egal — der Constraint kennt den Status nicht!) darauf verweist. Die Fehlermeldung lautet „Slot kann nicht gelöscht werden, solange Buchungsanfragen existieren. Bitte erst die Anfragen ablehnen."

US-05 AC-2 sagt aber: „**When ich ein bestehendes Zeitfenster lösche, Then ist es innerhalb von Sekunden nicht mehr buchbar.**" Das AC garantiert dem Admin, dass Löschen funktioniert. Im aktuellen Design **funktioniert es nicht**, sobald irgendeine Anfrage existiert (auch eine alte abgelehnte).

Zusätzlicher Bug: Der Constraint sagt nichts über `REJECTED`-Bookings — auch die blockieren das Löschen, was reine Daten-Friedhof-Logik ist und keinen fachlichen Sinn ergibt.

**Erwartet:**
1. Tom kann einen Slot jederzeit löschen.
2. PENDING/CONFIRMED-Bookings auf diesem Slot werden entweder mit-gelöscht (Cascade) oder atomar abgelehnt + benachrichtigt.

**Vorschlag:**
- Variante A: `onDelete: Cascade` für `Booking.slot`. Tom kann löschen; alle Bookings (unabhängig vom Status) verschwinden mit. Einfach, aber Datenverlust für die Historie.
- Variante B (empfohlen): Soft-Delete für Slots (`deletedAt: DateTime?`). `GET /api/slots` filtert `deletedAt IS NULL`. `DELETE /api/slots/:id` setzt nur `deletedAt`, lehnt offene PENDINGs automatisch ab und schickt eine Mail an die betroffenen Kunden (Begründung: Slot wurde zurückgezogen). Erfüllt US-05 AC-2 sauber, behält die Historie und erspart Tom Datenmüll.
- Variante C: Wenn der Architekt RESTRICT behalten will, muss US-05 AC-2 abgeschwächt werden, und es braucht eine prominente Admin-UI „Anfragen ablehnen UND Slot löschen" als Combo-Action.

In jedem Fall: **die Logik für REJECTED-Bookings als Lösch-Blocker entfernen** — das ergibt fachlich keinen Sinn.

**Routing:** `solution-architect`

---

### BUG-004 (Critical, Security): Rate-Limiting im Single-Instance-Memory funktioniert auf Vercel nicht zuverlässig

**Story:** US-07 (Sicherheit)
**Layer:** Backend / Infrastruktur

**Beschreibung:**
ARCHITECTURE.md §5 schlägt vor: „Rate-Limiting auf `/api/auth/callback/credentials`: 5 Versuche / 15 min / IP (via `next-safe-action` oder einfacher in-memory Map)."

Vercel Hobby + App Router läuft auf **serverless / edge functions, mehrere parallele Instanzen, jede mit eigenem Speicher**. Eine in-memory Map verhindert keinen Brute-Force, weil ein Angreifer bei 5 parallelen Requests an 5 verschiedene Instanzen geht und jede Instance „1/5" zählt — Resultat: praktisch kein Rate-Limit.

Das ist im MVP zwar eine kleine Lücke (nur 1 Admin, kein Hochwert-Asset), aber es **suggeriert eine Sicherheit, die nicht existiert**. Wenn der Architekt das so dokumentiert, müssen es Engineers korrekt umsetzen.

**Erwartet:** Entweder echtes shared Rate-Limit (z.B. via Upstash/Redis Free Tier oder Turso-Tabelle als Counter) oder ehrliche Doku „Im MVP kein wirksames Rate-Limit, weil Single-Instance-Annahme auf Vercel nicht haltbar — akzeptiertes Restrisiko."

**Vorschlag:**
- Empfohlen: Upstash-Redis Free Tier (10.000 cmds/Tag) oder Vercel-KV Free Tier. Beides ist kostenlos und macht den Counter persistent.
- Alternativ: Tabelle `LoginAttempt(ip, attemptedAt)` in Turso, mit Cleanup-Cron. Funktioniert, fügt aber DB-Last hinzu.
- Zusätzlich: bcrypt-Hashing reicht als Bremse für Brute-Force, wenn Cost-Factor 10 bleibt (~100 ms/Versuch). Das ist die wichtigste Verteidigungsschicht.

**Routing:** `solution-architect`

---

### BUG-005 (Critical, Security): `callbackUrl` ist ein offener Open-Redirect

**Story:** US-07 AC-3
**Layer:** Backend / Auth

**Beschreibung:**
`api-routes.md` Z. 322 sagt: bei nicht eingeloggten Aufrufen von `/admin/*` erfolgt ein „302 → `/admin/login?callbackUrl=<originalPath>`". NextAuth nimmt diesen `callbackUrl` und leitet nach erfolgreichem Login dorthin weiter.

Wenn der Wert nicht validiert wird, kann ein Angreifer Tom einen Link wie `https://baerenstark-hausservice.de/admin/login?callbackUrl=https://evil.com/phish` schicken. Tom loggt sich ein, wird zu `evil.com` weitergeleitet, gibt dort Daten ein. NextAuth's Default-Verhalten erlaubt **nur same-origin callbacks**, aber das ist nicht im Spec dokumentiert und Engineers könnten es per `useNextAuthUrl: false` versehentlich aushebeln.

**Erwartet:** Spec dokumentiert explizit, dass `callbackUrl` nur same-origin akzeptiert wird, und dass NextAuth's `redirect`-Callback diese Validierung trägt.

**Vorschlag:** Im Architecture-Doc (§5) ergänzen:
> `callbackUrl` wird via NextAuth `callbacks.redirect` validiert und auf same-origin Pfade beschränkt. Ungültige Werte → Redirect zu `/admin`.

**Routing:** `solution-architect`

---

## 3. Wichtige Defekte (Major — sollten vor Code-Start behoben werden)

---

### BUG-006 (Major, Design): Race-Condition bei gleichzeitiger Buchung desselben Slots

**Story:** US-04 (Edge Case)
**Layer:** Backend / Datenmodell

**Beschreibung:**
Auch wenn BUG-001 behoben ist (PENDING blockiert Slot), bleibt eine klassische Lost-Update-Race: zwei `POST /api/bookings` für denselben Slot kommen gleichzeitig im Handler an, beide lesen `isBooked = false`, beide insertieren — beide gewinnen. Das Design erwähnt das Thema **gar nicht**.

**Schritte:**
1. Slot S1 ist frei.
2. T0: Request A liest `Slot { isBooked: false }`.
3. T0+1ms: Request B liest `Slot { isBooked: false }`.
4. T0+5ms: Beide Booking-INSERTs landen erfolgreich.

**Erwartet:** Genau eine Buchung pro Slot bei gleichzeitigen Anfragen.

**Vorschlag:**
- Partial Unique Index: `CREATE UNIQUE INDEX uniq_active_booking_per_slot ON bookings(slotId) WHERE status IN ('PENDING', 'CONFIRMED');` Damit gewinnt der erste Insert, der zweite bekommt einen DB-Constraint-Error → der Handler übersetzt das in 409 `CONFLICT`. Nutzt die Datenbank als Source of Truth, ohne explizite Locking-Logik.
- Alternativ: `prisma.$transaction` mit `SELECT ... FOR UPDATE` — funktioniert in SQLite/libSQL eingeschränkt, ist also nicht der erste Wahl-Ansatz.

**Routing:** `solution-architect`

---

### BUG-008 (Major, Validation): `endsAt > startsAt` reicht nicht — fehlende Sanity-Checks für Slots

**Story:** US-05 AC-1
**Layer:** Backend / Validation

**Beschreibung:**
`POST /api/slots` validiert nur „`endsAt > startsAt`" und „`startsAt` in der Zukunft". Das lässt unsinnige Slots zu:
- Slot von 2026-05-15 08:00 bis 2030-12-31 23:59 (mehr als 4 Jahre — nicht buchbar in vernünftiger Form, sprengt UI).
- Slot 1 Sekunde lang (08:00:00 → 08:00:01) — technisch valide, fachlich unsinnig.
- Mehrere Slots, die sich überlappen (Tom legt versehentlich denselben Termin zweimal an, oder Slot 09:00–13:00 und 11:00–15:00 — beide werden nebeneinander angezeigt, Kunde verwirrt).

**Erwartet:** Vernünftige Plausibilitätsprüfungen.

**Vorschlag:**
- Min-Dauer: 30 Minuten.
- Max-Dauer: 12 Stunden (alles längere ist Multi-Slot oder Daueraufenthalt).
- Max-Vorlaufzeit: `startsAt` <= now + 1 Jahr.
- Überlappungs-Check: Beim INSERT prüfen, ob ein anderer Slot zeitlich überlappt → 409 `CONFLICT` mit Code `OVERLAP`.

**Routing:** `solution-architect`

---

### BUG-009 (Major, Contract): Inkonsistenz zwischen `customerEmail` Pflicht-Status

**Story:** US-04, US-08
**Layer:** Contract

**Beschreibung:**
- `schema.prisma` Z. 51: `customerEmail String?` — optional in DB.
- `api-routes.md` Z. 167–171: `customerEmail` als optional dokumentiert.
- `PROJECT.md` US-04 AC-1: nennt nur „Name, Telefon, Service, kurze Beschreibung" — Email ist da nicht erwähnt.
- Aber `ARCHITECTURE.md` Z. 159 sagt: „im MVP **nicht in der UI gefordert**, Feld vorhanden für US-11."

Das ist eine inkonsistente Botschaft: Soll das Feld im Buchungsformular angezeigt werden oder nicht? Frontend-Engineer wird raten. Wenn das Feld nicht im Formular ist, gibt es **niemals** einen Wert, was wiederum US-11 später aushebelt.

**Erwartet:** Eine klare Aussage:
- Im MVP-Formular: Email-Feld vorhanden, optional, beschriftet „E-Mail (optional, für Bestätigung)". Damit wird US-11 vorbereitet, ohne den User zu zwingen.
- Oder: Email-Feld fehlt komplett im MVP-Formular, dann muss `customerEmail` aus dem `POST /api/bookings`-Body raus.

**Vorschlag:** Email-Feld jetzt schon mit ins Formular nehmen (optional). Ist eine Zeile FE-Code, vereinfacht US-11 später.

**Routing:** `project-manager` (Entscheidung) → `solution-architect` (Spec-Update)

---

### BUG-010 (Major, Validation): Telefon-Regex „nur Ziffern und + - / ( ) Leerzeichen" ist zu permissiv

**Story:** US-04
**Layer:** Backend / Validation

**Beschreibung:**
`api-routes.md` Z. 170 erlaubt 5–40 Zeichen aus dem Set `[0-9 + - / ( ) Leerzeichen]`. Das akzeptiert Werte wie `+++++`, `(((-)))`, `12345` — alles fachlich Müll. Tom bekommt unbrauchbare Telefonnummern und kann den Kunden nicht zurückrufen. Das **bricht die ganze Buchungs-UX**, weil das primäre Kontaktmittel im MVP das Telefon ist.

**Erwartet:** Mindestens X Ziffern, plausibles Format.

**Vorschlag:**
- Mindestens 6 Ziffern in der Eingabe nach Strip von Nicht-Ziffern.
- Akzeptiere weiterhin gängige Trenner (`+`, `-`, `/`, `(`, `)`, ` `).
- Optional: `libphonenumber-js` für robuste DE-Validierung (~25 KB gzip — vertretbar, nur für eine Seite).

**Routing:** `solution-architect`

---

### BUG-011 (Major, Validation): Datum/Uhrzeit-Format-Fehler nicht spezifiziert

**Story:** US-05 (Edge Case)
**Layer:** Backend / API-Spec

**Beschreibung:**
`api-routes.md` sagt zu Slots „ISO 8601, in der Zukunft", aber liefert kein Beispiel für Fehlermeldungen bei kaputten Inputs:
- `startsAt: "2026-13-45T99:00:00Z"` — Zod-Standard-Fehler oder eigene?
- `startsAt: "morgen 10 Uhr"` — Plain-Text aus FE-Bug.
- `startsAt: ""` — Leerstring.
- Zeitzone fehlend (`2026-05-15T08:00:00`, ohne `Z`)?

Die Architecture sagt „ISO 8601 in UTC", die FE könnte aber `2026-05-15T10:00:00+02:00` schicken (ist auch valide ISO 8601, aber nicht UTC). Wird das akzeptiert oder abgelehnt? Falls akzeptiert, muss BE konvertieren — falls abgelehnt, klare Fehlermeldung.

**Erwartet:** Spec definiert:
- Akzeptiertes Format genau (z.B. `Z`-suffixed UTC oder beliebiger ISO-8601-Offset, BE konvertiert).
- Beispiel-Error-Response für ungültiges Datum.

**Routing:** `solution-architect`

---

### BUG-012 (Major, UX): Loading-, Error- und Empty-States für FE nicht spezifiziert

**Story:** US-03, US-04, US-06
**Layer:** Frontend-Design

**Beschreibung:**
ARCHITECTURE.md beschreibt das FE auf Komponenten-Ebene, aber **keine** Spec für:
- Loading-State von `/buchung` während `GET /api/slots` lädt (Skeleton? Spinner? Was bei langsamer Verbindung?).
- Empty-State: Tom hat noch keine Slots angelegt → was sieht der Kunde? Aktuell wäre das eine leere Liste, die wie ein Bug aussieht.
- Error-State: `GET /api/slots` 500ert → Was sieht der Kunde? „Fehler" reicht nicht; Telefon-Fallback (US-02 ist da relevant) sollte prominent sein.
- Submit-State von BookingForm während POST: Button disabled? Spinner?
- Conflict-State: Slot wurde gerade von jemand anders gebucht → 409 → was sieht der Kunde?

**Erwartet:** Jede Page hat dokumentierte Loading-, Error-, Empty- und Conflict-States.

**Vorschlag:** ARCHITECTURE.md §9 oder neue §10 mit einer Tabelle pro Page (Loading/Error/Empty/Success-Pfad).

**Routing:** `solution-architect`

---

### BUG-013 (Major, Spec): PATCH-State-Machine widerspricht sich selbst

**Story:** US-06
**Layer:** API-Spec

**Beschreibung:**
`api-routes.md` Z. 261–266:
- `PENDING → CONFIRMED ✅`
- `PENDING → REJECTED ✅`
- `CONFIRMED → REJECTED ✅`
- `REJECTED → CONFIRMED ✅`
- „Direkter Status-Übergang `PENDING` → `PENDING` führt zu 400."

Aber:
- Kein Wort zu `CONFIRMED → CONFIRMED` (idempotenter Doppel-Klick — sollte 400 oder 200 idempotent sein?).
- Kein Wort zu `REJECTED → REJECTED`.
- Es gibt **keinen** Pfad zurück zu `PENDING` — wenn Tom versehentlich auf „Bestätigen" klickt, kann er nur auf `REJECTED` und dann zurück auf `CONFIRMED` springen. Damit wechselt der Slot zwischen frei/belegt mehrfach in der öffentlichen Ansicht. Das ist Confusing.

Außerdem: Wenn Tom `CONFIRMED → REJECTED` macht, wird der Slot wieder frei (`isBooked: false`), aber der Kunde wurde schon (außerhalb des Systems) angerufen und vorgemerkt. UX-Risiko.

**Erwartet:** Klare State-Machine inklusive Idempotenz und „undo"-Pfad.

**Vorschlag:**
- Idempotenz erlauben: gleicher Status erneut → 200, kein Update.
- Optional: `PENDING ← REJECTED/CONFIRMED` als „Reset"-Action erlauben, aber UI-seitig hinter „mehr Optionen" verstecken.

**Routing:** `solution-architect`

---

## 4. Minor Defekte

---

### BUG-014 (Minor, Spec): Sortierung & Filter für `GET /api/bookings` unvollständig

`api-routes.md` zeigt nur `?status=` als Filter. Wenn Tom 200 Anfragen hat, will er filtern nach Datum, sortieren nach Slot-Zeit usw. Für den MVP OK, aber sollte als „MVP-Limitation, wird später ergänzt" dokumentiert sein.

**Routing:** `project-manager`

---

### BUG-015 (Minor, Schema): `Slot.endsAt` ohne Index — Filter-Performance

`@@index([startsAt])` ist da, aber ein Slot wird in `GET /api/slots?from=...&to=...` mit beiden Grenzen abgefragt. Bei wachsender Datenmenge kann ein Composite-Index `[startsAt, endsAt]` helfen. Im MVP irrelevant, aber als TODO notieren.

**Routing:** `solution-architect`

---

### BUG-016 (Minor, UX): „Bestätigt"-Button gibt Tom keine Bestätigungs-Pflicht

Im UI wird beschrieben „auf Bestätigen klicken". Ein Doppel-Klick aus Versehen ist nicht abgesichert. Empfehlung: Confirm-Modal („Anfrage von Maria Müller wirklich bestätigen?"). Klein, aber relevant für UX.

**Routing:** `frontend-engineer` (Implementation) — Spec sollte es benennen, also `solution-architect`.

---

### BUG-017 (Minor, Security): Keine Content-Security-Policy / Security-Headers spezifiziert

ARCHITECTURE.md sagt nichts zu HTTP-Security-Headers (CSP, X-Frame-Options, Strict-Transport-Security). Auf Vercel sind Defaults OK, aber für eine Production-Site sollte CSP zumindest skizziert sein (Resend-Mail-Bilder, Tailwind inline styles).

**Routing:** `solution-architect`

---

### BUG-018 (Minor, Observability): „Fehler werden geloggt" — wohin, wer schaut nach?

ARCHITECTURE.md §6 + §7: Vercel-Logs reichen laut Doku. Aber: kein Alerting, kein „daily digest". Wenn 5 Mails an Tom verloren gehen, wird Tom es nie selbst herausfinden — er müsste täglich Vercel-Logs lesen, was er nicht tun wird. Empfehlung: einfache Heuristik („alle 6h ein Cron-Check, wenn ungelesene Anfragen > X UND keine Mail in den letzten 24 h gesendet → Alert-Mail an Tom").

**Routing:** `project-manager` (Backlog-Story?) / `solution-architect`

---

### BUG-019 (Minor, A11y): „Fokus-Ring auf allen Interaktiv-Elementen" reicht nicht als A11y-Spec

ARCHITECTURE.md §9 nennt WCAG 2.1 AA als Ziel und Fokus-Ring. Das ist ein guter Anfang, aber WCAG AA verlangt mehr (Form-Errors für Screen-Reader, ARIA-Live-Region für Toast-Bestätigung in US-04, Kontrast-Check der Braun/Beige-Farbtokens — `cream #F5EBDD` auf `wood #7B5E3C` muss verifiziert werden).

**Routing:** `solution-architect`

---

## 5. Vertrags-Inkonsistenzen (FE/BE-Drift)

| # | Vertrag                                                                  | Problem                                                                                                                          |
| - | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 1 | `customerEmail` Pflicht/Optional (siehe BUG-009)                         | Drei Quellen, drei Antworten.                                                                                                    |
| 2 | `isBooked`-Definition (siehe BUG-001)                                    | API sagt „CONFIRMED only", US-03 AC-2 impliziert „belegt = nicht buchbar = jegliche aktive Anfrage".                             |
| 3 | `description` in `Booking` vs. `description` in `Slot`                   | Beides Felder mit demselben Namen — FE muss aufpassen, beim Mapping nicht zu vertauschen. Spec sollte explizit darauf hinweisen. |
| 4 | `service`-Werte: Slug-only oder mit deutschem Label?                      | API erwartet Slug. Aber `GET /api/bookings` liefert nur den Slug, kein Label. FE muss alle Labels selbst kennen — fragil, wenn Tom später einen 7. Service hinzufügt. Empfehlung: Eine einzige `lib/services.ts` als Single-Source-of-Truth, klar dokumentiert. |
| 5 | Fehler-Code-Liste: `OVERLAP` (BUG-008), `MAIL_FAILED`, `RATE_LIMITED` fehlen | Wenn die im Code auftauchen, muss FE sie erkennen.                                                                               |

---

## 6. Anforderungs-Lücken (Things spec'd but missing or under-specified)

- **Timezone-Handling im Frontend:** Spec sagt „UTC speichern, Berlin rendern", aber wie? `Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' })` als Konvention dokumentieren. Sonst entstehen Off-by-one-Stunden-Bugs (DST!).
- **Pagination-Grenze:** „<100 erwartet" — was passiert bei 200? Crashed das Admin-UI? Dokumentieren: harte Grenze 500, danach Pagination retrofitten.
- **Robots/SEO:** Keine Spec zu `robots.txt`, OpenGraph-Tags, sitemap.xml. Für ein lokales Hausservice-Geschäft ist Local-SEO **wichtiger als das ganze MVP-Backend**. Sollte zumindest als Backlog-Story drin sein.
- **DSGVO:** US-12 deckt Impressum/Datenschutz ab, aber Daten werden in US-04 erhoben (Name, Telefon, optional Email, Beschreibung). Wo steht der Hinweis im Buchungsformular auf den Datenschutz? Welche Aufbewahrungsdauer? Welche Rechte (Auskunft, Löschung)? Das ist DSGVO-Pflicht in DE.
- **Backups:** Turso macht automatische Backups, aber Spec sagt nichts. Wenn Tom die DB versehentlich verliert, was passiert? Mindestens dokumentieren: Turso Free Tier hat X Tage Point-in-Time-Recovery.
- **Initiales Admin-Passwort:** `seed.ts` braucht `SEED_ADMIN_PASSWORD` — wo bekommt Tom das? Wer setzt es? Empfohlen: ein einmaliger Setup-Wizard auf `/admin/setup`, der nur greift, wenn keine User in der DB sind, und Tom selbst das Passwort wählen lässt. Sonst muss ein Engineer das Passwort kennen, was ein Insider-Risiko ist.

---

## 7. Out-of-Scope-Findings

- `customerEmail` im Schema, obwohl Architecture sagt „nicht in MVP-UI". Das ist Scope-Creep im Schema, der für US-11 nützlich ist, aber explizit als „prepared for backlog" markiert werden sollte (ist es teilweise — der Kommentar in `schema.prisma` Z. 51 reicht).
- Open: Service-Slug-Liste hat 6 Werte, aber `PROJECT.md` listet 6 Services mit teils anderen Namen („Entsorgung von Schrott und Metallen" → Slug `entsorgung`). Mapping ist eindeutig, aber Tom könnte später „Entsorgung" und „Schrott" als zwei Services trennen wollen — Schema unterstützt das nur mit Schema-Änderung.

---

## 8. Non-Functional Findings

| Bereich        | Befund                                                                                                              | Routing             |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Security       | bcrypt cost 10 OK; Rate-Limit-Konzept defekt (BUG-004); Open-Redirect (BUG-005); CSP-Headers fehlen (BUG-017).        | solution-architect  |
| Accessibility  | A11y-Spec zu generisch (BUG-019); Kontrast-Check der Farbtokens fehlt; ARIA-Live für Toast/Form-Errors fehlt.        | solution-architect  |
| Performance    | Keine Probleme erwartet bei MVP-Größe; Composite-Index nice-to-have (BUG-015).                                       | solution-architect  |
| Observability  | Vercel-Logs only — kein Alerting für Mail-Fehler (BUG-018); kein Mail-Status-Feld pro Booking (BUG-002).             | solution-architect  |
| GDPR/Legal     | Datenschutz-Hinweis im Buchungsformular fehlt; Aufbewahrungsfrist undefiniert.                                       | project-manager     |

---

## 9. Empfehlungen für nächste Iteration

**Vor Code-Start (kritisch):**
1. BUG-001 lösen: `isBooked` muss PENDING einschließen, oder Mehrfach-PENDINGs explizit erlaubt + UI-spec.
2. BUG-002 lösen: Mindestens ein Mail-Status pro Booking + Admin-Sichtbarkeit, idealerweise Outbox-Pattern.
3. BUG-003 lösen: Slot-Löschung muss funktionieren (Soft-Delete empfohlen).
4. BUG-004 lösen: Rate-Limit ehrlich dokumentieren oder shared Store nutzen.
5. BUG-005 lösen: callbackUrl-Same-Origin-Validierung im Spec verankern.
6. BUG-006 lösen: Partial Unique Index für aktive Bookings pro Slot.

**Stories zum Schärfen / Aufnehmen ins Backlog:**
- US-04 AC-1 ergänzen: „Datenschutzhinweis und Pflichtfeld-Markierung im Formular sichtbar."
- US-08 AC-1 schärfen: „Tom hat in jedem Fall innerhalb von 24 h Sichtbarkeit über alle eingegangenen Anfragen, auch bei Mail-Fehler."
- Neue Story: „Local SEO Basics (robots.txt, OG-Tags, Google Business Profile-Verknüpfung)" — Backlog Should-Have, MVP-relevant für Auffindbarkeit.
- Neue Story (Backlog): „Outbox/Retry für E-Mail-Versand mit Dashboard-Sichtbarkeit."
- Neue Story (Backlog): „Admin-Setup-Wizard für Initial-Passwort statt ENV-Seed."

**Technical Debt zu tracken:**
- In-Memory-Rate-Limit als Übergangslösung dokumentieren mit Ablauf-Datum.
- Pagination-Retrofit ab >100 Bookings.
- Composite-Index `[startsAt, endsAt]` ab >1000 Slots.

---

## 10. Sign-off Checklist

- [ ] BUG-001 bis BUG-006 (kritisch) sind im Architektur-Doc und in `contracts/` adressiert.
- [ ] State-Machine für Booking-Status ist eindeutig (BUG-013).
- [ ] FE-States (Loading/Error/Empty/Conflict) sind pro Page dokumentiert (BUG-012).
- [ ] Vertrags-Inkonsistenzen (Abschnitt 5) aufgelöst.
- [ ] DSGVO-Hinweis und Aufbewahrungsfristen ergänzt.
- [ ] Tom kann das initiale Admin-Passwort selbst setzen (kein Insider-Risiko).

---

## Finales Urteil

**Design muss überarbeitet werden.**

Die kritischen Defekte BUG-001 (Doppelbuchung möglich), BUG-002 (Mail-Garantie nicht erfüllt), BUG-003 (Slot-Löschen unmöglich bei aktiver Anfrage), BUG-004 (effektives Rate-Limit fehlt), BUG-005 (Open-Redirect-Risiko) und BUG-006 (Race-Condition) sind allesamt **Korrektheits- oder Sicherheitsthemen, die im Code teurer zu fixen sind als jetzt im Spec**. Der Architekt sollte das Design um diese Punkte überarbeiten, bevor Backend-Engineer und Frontend-Engineer beginnen.

Die wichtigen Defekte (BUG-008 bis BUG-013) sollten ebenfalls in derselben Iteration adressiert werden — sie sind klein zu beheben, sparen aber später Re-Work.

Nach Behebung dieser Punkte ist das Design solide und freigabefähig.

---

## Zweite Review (v1.1)

**Datum:** 2026-05-02
**Reviewer:** Senior QA Engineer
**Geprüfte Artefakte (überarbeitet):**
- `ARCHITECTURE.md` v1.1
- `contracts/schema.prisma` v1.1
- `contracts/api-routes.md` v1.1
- `contracts/zod-schemas.ts` v1.1

**Scope:** Gezielte Re-Verifikation der kritischen Bugs BUG-001 bis BUG-006 sowie Prüfung auf neu entstandene Widersprüche/Probleme.

---

### BUG-001 — `isBooked` deckt PENDING + CONFIRMED ab? Partial-Unique-Index?

**Status:** **Behoben.**

**Begründung:**
- `ARCHITECTURE.md` §3 (Z. 193–196): „Ein Slot gilt als belegt, wenn mindestens eine Booking mit Status **PENDING oder CONFIRMED** darauf verweist. REJECTED-Bookings geben den Slot wieder frei." — eindeutig.
- `api-routes.md` Z. 116–119: gleiche Definition explizit unter „`isBooked`-Definition (BUG-001)".
- `schema.prisma` Z. 39–41 (Doc-Kommentar): identische Aussage.
- `zod-schemas.ts` Z. 59–62: konsistente Beschreibung im `SlotPublicSchema`.
- Partial-Unique-Index siehe BUG-006.

Konsistenz über alle vier Artefakte gegeben. Doppelt-PENDING-Szenarien werden dadurch sowohl semantisch (Anzeige) als auch DB-seitig (Constraint) verhindert.

---

### BUG-002 — `mailSent`/`mailError` im Schema? Retry-Logik dokumentiert? Admin-Sichtbarkeit?

**Status:** **Behoben.**

**Begründung:**
- `schema.prisma` Z. 100–102: `mailSent Boolean @default(false)` und `mailError String?` am `Booking`-Modell vorhanden.
- `ARCHITECTURE.md` §6 (Z. 397–435): Retry-Strategie mit 3 Versuchen, Backoff `0/300/1500 ms`, Gesamt-Timeout 4 s, Pseudocode für Engineers.
- Admin-Sichtbarkeit: Roter Badge „Mail nicht zugestellt", Tooltip mit `mailError`, „Mail erneut senden"-Button → `POST /api/bookings/:id/resend-mail` (neu in `api-routes.md` §2 Z. 444–470).
- UI-State-Tabelle in §10 (Z. 565) deckt `MailFailed` als eigenen Zustand auf `/admin/bookings` ab.
- Begründung gegen Outbox-Pattern (Z. 429–435) ist nachvollziehbar dokumentiert: 1 Admin, ~10 Mails/Tag, manueller Resend deckt Recovery ab. Outbox bleibt im Backlog.
- `BookingAdminSchema` (zod-schemas.ts Z. 257–258) enthält `mailSent`/`mailError`.

Vollständig adressiert. Recovery-Pfad (manueller Resend) ist sauberer Kompromiss für MVP.

---

### BUG-003 — Soft-Delete via `deletedAt`? GET-Filter `deletedAt IS NULL`?

**Status:** **Behoben.**

**Begründung:**
- `schema.prisma` Z. 52: `deletedAt DateTime?` am `Slot`-Modell, plus `@@index([deletedAt])`.
- `api-routes.md` Z. 91: `GET /api/slots` filtert „immer aktiv, nicht abschaltbar: `deletedAt IS NULL`."
- `DELETE /api/slots/:id` (api-routes.md Z. 196–226): Soft-Delete in einer Transaktion + atomares `UPDATE bookings SET status='REJECTED' WHERE slot_id = :id AND status='PENDING'`. Damit ist US-05 AC-2 erfüllbar.
- `CONFIRMED`-Bookings werden bewusst nicht automatisch storniert; UI bietet kombinierte Aktion (Z. 222–226) — sinnvolle Abwägung gegen ungewolltes Stornieren.
- UI-State-Tabelle §10 dokumentiert `DeleteConfirm` und `DeleteConflict` (Z. 579–580).

Sauber gelöst inkl. UX-Pfad und Index-Performance.

---

### BUG-004 — Rate-Limit-Lösung (Upstash oder dokumentiertes Risiko)?

**Status:** **Behoben.**

**Begründung:**
- `ARCHITECTURE.md` §1 (Z. 51): Upstash Redis Free Tier + `@upstash/ratelimit` als gewählte Stack-Komponente eingetragen.
- §5 (Z. 324–358): Konkrete Implementation mit Codebeispiel (Login: 5/15 min, Booking: 10/60 min); shared Counter über alle Vercel-Instanzen — exakt der Punkt, an dem die in-memory-Map versagt hätte.
- ENV-Variablen `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` in §8 dokumentiert.
- Fallback-Verhalten ehrlich dokumentiert (Z. 349–358 + Z. 526–529): bei fehlender Upstash-Config greift kein Application-Layer-Rate-Limit; bcrypt cost 10 wirkt als natürliche Bremse, Restrisiko explizit als akzeptabel markiert (1 Admin, 12-Zeichen-Passwort-Mindestlänge erzwungen).
- API-Spec (`api-routes.md` Z. 303–317, 519–524) enthält `RATE_LIMITED`-Response inkl. `Retry-After`-Header.

Solide adressiert mit klarer Engineering-Anleitung.

---

### BUG-005 — `callbackUrl` Same-Origin-Validierung dokumentiert?

**Status:** **Behoben.**

**Begründung:**
- `ARCHITECTURE.md` §5 (Z. 290–318): vollständiger NextAuth `callbacks.redirect`-Codeblock mit drei klaren Regeln (relative Pfade erlaubt, same-origin via `URL().origin === baseUrl`, sonst Fallback auf `/admin`).
- `api-routes.md` Z. 496–517: identische Spec im Auth-Abschnitt; konkretes Angreifer-Beispiel widerlegt.
- Risiko des `useNextAuthUrl: false`-Ausweichens, das in der Erstreview erwähnt war, ist durch den expliziten redirect-Callback-Code geschlossen — Engineers haben keine Auslegungsfreiheit mehr.

Vollständig adressiert.

---

### BUG-006 — Race-Condition-Schutz (Partial Unique Index) in `schema.prisma`?

**Status:** **Behoben.**

**Begründung:**
- `schema.prisma` Z. 65–76: ausführlicher Doc-Kommentar mit dem konkreten Raw-SQL-Statement
  `CREATE UNIQUE INDEX uniq_active_booking_per_slot ON bookings(slot_id) WHERE status IN ('PENDING','CONFIRMED');`
  und expliziter Hinweis, dass Prisma keine Partial Indexes deklarativ kennt → Migration in `prisma/migrations/<ts>_active_booking_per_slot/migration.sql`.
- `ARCHITECTURE.md` §2 (Z. 92–95): Migration im Projektbaum erwähnt; §7 Z. 447: `prisma migrate deploy` als Build-Step → Index landet automatisch in Prod.
- `api-routes.md` Z. 263–272: Constraint-Verletzung wird im Handler in HTTP 409 `CONFLICT` übersetzt — sauberer Ende-zu-Ende-Pfad.
- PATCH-Endpoint (Z. 412–417) berücksichtigt Index ebenfalls (REJECTED → CONFIRMED kann durch Index-Verstoß scheitern → 409).

Race-Condition zuverlässig auf DB-Ebene abgefangen.

---

### Neu eingebrachte Probleme oder Widersprüche?

Geprüft auf Folge-Effekte der Fixes:

| Bereich                          | Befund                                                                                                                                                                                                                                                                          | Schweregrad |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| FK `Booking.slot` mit `Restrict` | Schema-Kommentar (Z. 86–88) erklärt, warum Restrict trotz Soft-Delete bleibt: zusätzlicher Schutz gegen versehentliches physisches Löschen. Konsistent — keine Friktion mit dem Soft-Delete-Pfad, der `Slot` nicht löscht, sondern `deletedAt` setzt.                            | OK          |
| Idempotenz-State-Machine         | `UpdateBookingStatusSchema` lässt nur `CONFIRMED`/`REJECTED` zu (Z. 230–232), passend zur Tabelle in api-routes.md Z. 397–407. Keine Inkonsistenz.                                                                                                                                | OK          |
| `customerEmail`-Pflichtstatus    | Drei Quellen (Schema, API-Spec, Zod-Schema) beschreiben jetzt einheitlich „optional, im MVP-Formular vorhanden". DSGVO-Hinweis und UI-Label klar. BUG-009 sauber geschlossen.                                                                                                    | OK          |
| Mail-Retry-Idempotenz            | `POST /api/bookings/:id/resend-mail` ist als no-op markiert, wenn `mailSent === true` (api-routes.md Z. 451–452). Verhindert versehentliche Doppelmails. Sauber.                                                                                                                  | OK          |
| Rate-Limit-Fallback-Doku         | Fallback ohne Upstash ist klar als „akzeptiertes Restrisiko" markiert; der ursprüngliche Kritikpunkt (Schein-Sicherheit) ist neutralisiert, weil keine in-memory-Map mehr genannt wird.                                                                                          | OK          |
| Setup-Wizard-Race                | Annahme „Tom ruft `/admin/setup` direkt nach Deploy auf" ist explizit in §13 (Z. 646) als Annahme markiert; `robots.txt` blockt Crawler. Restrisiko klein und transparent.                                                                                                          | OK          |
| Composite-Index `(startsAt, endsAt)` | Schema Z. 57 ergänzt; passt zum Range-Query-Pattern in `GET /api/slots` (BUG-015).                                                                                                                                                                                            | OK          |
| `MAIL_FAILED` als HTTP-Code       | Inkonsistenz auf Detail-Ebene: api-routes.md Z. 72–77 sagt „MAIL_FAILED → 502" und nutzt das beim Resend-Endpoint (Z. 468); zod-schemas.ts Z. 312–315 dokumentiert es etwas zweideutig als „nicht als HTTP-Antwort bei POST /api/bookings, sondern für Admin-Dashboard und Resend-Trigger". Sinngemäß identisch (POST /api/bookings antwortet immer 201, der Resend-Endpoint kann 502 zurückgeben), aber die Zod-Doku könnte präziser formuliert sein. | Minor (nicht-kritisch) |

**Fazit zu neuen Problemen:** Keine kritischen oder wichtigen Folge-Bugs eingeführt. Eine Minor-Doku-Unschärfe (`MAIL_FAILED`-Beschreibung im Zod-Schema) — kein Blocker, kann beim ersten Code-Touch nebenbei geschärft werden.

---

### Sign-off Checklist (Re-Check)

- [x] BUG-001 bis BUG-006 (kritisch) sind im Architektur-Doc und in `contracts/` adressiert.
- [x] State-Machine für Booking-Status ist eindeutig (BUG-013 — siehe api-routes.md §2 PATCH-Tabelle).
- [x] FE-States (Loading/Error/Empty/Conflict) sind pro Page dokumentiert (BUG-012 — ARCHITECTURE.md §10).
- [x] Vertrags-Inkonsistenzen (Abschnitt 5 der Erstreview) aufgelöst (`isBooked`, `customerEmail`, neue Fehlercodes).
- [x] DSGVO-Hinweis und Aufbewahrungsfristen ergänzt (ARCHITECTURE.md §11).
- [x] Tom kann das initiale Admin-Passwort selbst setzen (Setup-Wizard, kein ENV-Seed).

---

### Finales Urteil (v1.1)

**Design freigegeben.**

Alle sechs kritischen Bugs (BUG-001 bis BUG-006) sind in der überarbeiteten Spec konsistent über alle vier Artefakte adressiert. Auch die wichtigen Defekte aus der Erstreview (BUG-008 bis BUG-013) sowie die Sign-off-Items (Setup-Wizard, DSGVO, FE-States) sind eingearbeitet. Es wurden keine neuen kritischen oder wichtigen Probleme eingebracht; die einzige verbleibende Beobachtung ist eine minimale Doku-Unschärfe zu `MAIL_FAILED` im Zod-Schema, die nicht-blockierend ist.

Die Implementierung kann beginnen.

---

## Iteration 2 Design Review

**Modus:** Design QA (vor Code-Erstellung)
**Datum:** 2026-05-02
**Iteration:** 2
**Reviewer:** Senior QA Engineer
**Geprüfte Artefakte:**
- `PROJECT.md` (US-13 bis US-16, BUG US-04)
- `ARCHITECTURE.md` v1.2
- `contracts/api-routes.md` v1.2
- `contracts/schema.prisma` v1.2
- `contracts/zod-schemas.ts` v1.2
- `contracts/BUG_US04_ANALYSIS.md`

### Verdict (Kurzfassung)

**Design freigegeben (mit empfohlenen Härtungen für Engineers).**

Pass-Quote der Akzeptanzkriterien (Testbarkeit gegen Spec): 18/19 (95 %).
Kritische Defekte: **0**, Wichtige: **3**, Minor: **5**.

Das Iteration-2-Design ist sauber, in sich konsistent und behandelt die meisten erwartbaren Edge-Cases explizit. Die State-Machine in §15.2 ist vollständig, die Token-Semantik ist nachvollziehbar, und der Trade-off zur Slot-Locking-Strategie bei Counter-Proposals ist offen dokumentiert. Die wichtigen Befunde betreffen Robustheits-Hinweise, die Engineers während der Implementierung ohne Spec-Re-Roundtrip umsetzen können — es gibt keine Block-or-Loop-Issues.

---

### 1. Test-Matrix (Akzeptanzkriterien gegen Spec)

| Story    | AC   | Test-Case (gegen Spec)                                                                                              | Layer | Status   | Anmerkung                                                                                                  |
| -------- | ---- | ------------------------------------------------------------------------------------------------------------------- | ----- | -------- | ---------------------------------------------------------------------------------------------------------- |
| BUG US-04| —    | POST /api/bookings antwortet immer 201, sobald Booking persistiert                                                  | BE    | Pass     | Fire-and-forget `runMailDispatch` + `void promise`, BUG_US04_ANALYSIS.md Z. 119–148.                        |
| BUG US-04| —    | Admin-Portal listet Booking, auch bei Mail-Fehler                                                                   | BE+FE | Pass     | `mailSent`/`mailError` + roter Badge, ARCHITECTURE §10 + §6.                                                |
| BUG US-04| —    | `customerEmail` mit Whitespace führt nicht zu 400                                                                   | BE    | Pass     | `z.preprocess` + Trim → undefined-Mapping in `customerEmailRequiredSchema`.                                 |
| BUG US-04| —    | `getResend()` filtert Placeholder-Keys (`re_xxxxx*`)                                                                | BE    | Pass     | Konkrete Pseudocode-Anweisung in BUG_US04_ANALYSIS.md Z. 257–270.                                            |
| US-13    | AC-1 | Admin → "Alternativtermin vorschlagen" → COUNTER_PROPOSED + Mail mit Aktionslink                                    | BE+FE | Pass     | POST /api/bookings/:id/counter-proposal + `counterProposalToCustomer`-Template.                              |
| US-13    | AC-2 | Aktionslink öffnet Seite mit 3 Optionen (Annehmen / Neu wählen / Stornieren)                                        | FE    | Pass     | Mail-Template-Skizze ARCHITECTURE §15.6, drei Buttons benannt.                                              |
| US-13    | AC-3 | Vorschlag annehmen → CONFIRMED + Slot belegt + Mail an Tom                                                          | BE    | Pass     | `GET /api/bookings/respond?action=accept`, atomare Transaktion mit Slot-Switch + Index-Re-Check (api-routes.md Z. 540–555). |
| US-13    | AC-4 | Neuen Termin wählen → `?rebookToken=...` → POST /api/bookings/rebook → Status PENDING + Mail an Tom                  | BE+FE | Pass     | Re-Booking-Flow vollständig (api-routes.md Z. 591–642 + UI-State `Rebook-Mode` §14).                          |
| US-13    | AC-5 | Bereits verwendeter Aktionslink → Hinweisseite, dass Link nicht mehr gültig                                         | BE+FE | Pass     | 410 GONE, Redirect auf `/buchung/storno?status=gone` bzw. `/buchung/bestaetigt?status=gone`. UI-States §14. |
| US-14    | AC-1 | Storno-Link → CANCELLED + Slot wieder frei                                                                          | BE    | Pass     | `GET /api/bookings/respond?action=cancel`, Status zu CANCELLED → Partial-Index gibt Slot frei.              |
| US-14    | AC-2 | Storno → Mail an Tom mit Name, Service, ursprünglicher Termin                                                       | BE    | Pass     | Template `cancellationToAdmin` ARCHITECTURE §15.6.                                                          |
| US-14    | AC-3 | Bereits storniert / Endstatus → Hinweisseite                                                                        | BE+FE | Pass     | 410 GONE → `/buchung/storno?status=gone`. UI-State `AlreadyDone` §14.                                       |
| US-15    | AC-1 | `/admin/availability` zeigt 7 Toggles                                                                               | FE    | Pass     | UI-State-Tabelle §14, `WeeklyAvailabilityForm.tsx` benannt.                                                 |
| US-15    | AC-2 | Mo–Fr aktiv, Sa+So nicht buchbar in öffentlicher Kalenderansicht                                                    | BE+FE | Pass     | Kalenderlogik ARCHITECTURE §15.4, `weeklyActive` AND `isFuture` AND `!hasBlocker`.                          |
| US-15    | AC-3 | Bestätigte Buchungen als Blocker im Admin-UI sichtbar                                                               | FE    | **Partial** | UI-State `InfoBlocker` ist als „kompakte Liste der CONFIRMED-Termine" benannt — siehe **MAJOR-201**: AC-3 verlangt zusätzlich „Anzahl bestätigter Buchungen pro Tag". Die Liste erfüllt das implizit, aber die explizite Tagesanzahl fehlt. |
| US-15    | AC-4 | Änderung der Verfügbarkeit → in Sekunden in öffentlicher Kalenderansicht sichtbar                                    | BE+FE | Pass     | `revalidateTag('availability')` + `revalidateTag('calendar')` in PUT-Handler, `Cache-Control: no-store`.    |
| US-16    | AC-1 | Monatsansicht mit grün/rot                                                                                          | FE    | Pass     | `Calendar.tsx`, Logik aus `GET /api/calendar`.                                                              |
| US-16    | AC-2 | Klick auf grünen Tag → Buchungsformular mit Datum vorausgefüllt                                                     | FE    | Pass     | UI-State „Klick auf grünen Tag" §14: filtert Slot-Liste (`?day=YYYY-MM-DD`).                                |
| US-16    | AC-3 | Klick auf roten Tag → Hinweis, kein Formular                                                                        | FE    | Pass     | UI-State „Klick auf roten Tag" §14, `aria-disabled="true"`.                                                  |
| US-16    | AC-4 | Vergangene Tage als nicht-buchbar                                                                                   | BE+FE | Pass     | `available = ... AND isFuture` in `buildCalendarMonth`.                                                     |
| US-16    | AC-5 | Touch-freundlich, keine horizontalen Scroll-Bars auf Mobile                                                         | FE    | Partial  | „mobile-first, touch-freundlich" benannt (§15.5), aber **kein konkretes Mobile-Grid-Layout** für Calendar (z.B. 7-Spalten-Grid mit Min-Touch-Target 44 px) — siehe **MINOR-205**. |

---

### 2. Befunde pro Story

#### BUG US-04 — Bug-Analyse

**Status:** **Überzeugend analysiert; Fix-Anweisungen sind konkret und ausführbar.**

- Beide Root-Causes sind plausibel: Placeholder-Key (`re_xxxxxxxxxxxx`), der zur Resend-API kommt; und enge Kopplung des Mail-Versands an den Booking-Erfolgspfad. Sekundärursache (Tom prüft Mailbox, statt Admin-Portal) ist eine ehrliche Wahrnehmungs-Erklärung — nicht jeder Bug ist nur Code.
- Fix-Anweisungen sind dateigenau (`src/app/api/bookings/route.ts`, `src/lib/mail.ts`, `contracts/zod-schemas.ts`, `.env.example`) mit Vorher-/Nachher-Snippets — ein Backend-Engineer kann das 1:1 umsetzen ohne Rückfragen.
- Die 6 Test-Plan-Szenarien (Happy Path, Resend-down, temporary failure, Whitespace-Email, leere Email, invalid Email) decken sowohl die positive als auch die negative Pfad-Validierung ab.
- **Minor-Beobachtung (MINOR-201):** Der Vercel-Hinweis zu `unstable_after` (Z. 184–189) ist mit „Engineers sollen ausprobieren" formuliert. Für eine MVP-Live-Umgebung wäre eine klare Default-Anweisung („nutzt `unstable_after` falls verfügbar; ansonsten `void promise` mit Warn-Log") deterministischer. Engineers können das während der Implementierung schärfen — kein Blocker.

#### US-13 — Alternativtermin vorschlagen

**Status:** State-Machine ist vollständig, Token-Semantik ist eindeutig, alle 5 ACs sind abgedeckt.

- **State-Machine-Übergänge (§15.2):** Alle relevanten Pfade explizit notiert. PENDING → COUNTER_PROPOSED → {CONFIRMED|PENDING|CANCELLED}. CANCELLED ist Endstatus mit 410. Keine Lücken im Diagramm.
- **Slot-Belegungsstrategie:** Der ursprüngliche Slot bleibt durch den Partial Unique Index gesperrt (Status COUNTER_PROPOSED zählt als „aktiv"). Der vorgeschlagene Slot ist NICHT zusätzlich gesperrt — Trade-off ist transparent in §3 Z. 275–287 dokumentiert. Engineers wissen, dass beim Annehmen ein 409 möglich ist, weil der Index erst zur Annahme-Zeit greift.
- **Antwort auf die explizit gestellten Prüf-Fragen:**

  1. *„Was passiert, wenn der vorgeschlagene Alternativslot inzwischen belegt wurde, bevor der Kunde antwortet?"*
     → Beim `accept`-Handler greift der Partial Unique Index → 409 CONFLICT → die Erfolgsseite zeigt entsprechend „Vorschlag nicht mehr offen" (api-routes.md Z. 545–550, ARCHITECTURE §15.5 Erfolgsseite `/buchung/bestaetigt?status=gone`). Das ist sauber. **MAJOR-203 (siehe unten):** Die UI-State-Tabelle für `/buchung/bestaetigt` listet nur `Default` und `Gone` — der `409`-Pfad sollte ergänzt werden („Vorschlag wurde inzwischen anderweitig vergeben").
  2. *„Was passiert bei abgelaufenem/ungültigem cancelToken?"*
     → 404 NOT_FOUND (Token unbekannt) bzw. 410 GONE (Booking in Endstatus). UI-State `AlreadyDone` und `TokenInvalid` in `/buchung/storno` (§14). Korrekt.
  3. *„Was passiert, wenn GET /api/bookings/respond mehrfach aufgerufen wird?"*
     → Erste erfolgreiche Aktion versetzt Booking in Endstatus → 410 bei jedem Folgeaufruf. Idempotent (semantisch). Sauber.
  4. *„Werden beide Slots korrekt gesperrt/freigegeben?"*
     → Original-Slot via Index gesperrt, neuer Slot bewusst nicht hart gelockt; Trade-off dokumentiert. **WICHTIG-204 (siehe unten):** Engineers müssen darauf hingewiesen werden, dass beim `accept`-Handler vor dem `slotId`-Switch zwingend zu prüfen ist, dass der `counterProposalSlotId` weiterhin existiert UND nicht soft-deleted ist (api-routes.md Z. 545 sagt das richtig, aber in §15.2 wird's nicht wiederholt — Engineers könnten den Soft-Delete-Check übersehen).
- **Mail-Templates (§15.6):** Alle 4 neuen Templates (`bookingReceiptToCustomer`, `counterProposalToCustomer`, `counterAcceptedToAdmin`, `rebookingToAdmin`) inhaltlich skizziert. Aktionslink-Helfer `actionUrl()` als zentrale Funktion vorgeschrieben → kein Drift zwischen Templates.
- **Resend-Limitierung (§13 Annahmen):** Klar formuliert, dass `onboarding@resend.dev` für US-13/US-14 NICHT ausreicht (Resend Free Tier verbietet Mail an beliebige Empfänger ohne DNS-Verifikation). Das ist als „Offene Entscheidung [NEEDS INPUT]" markiert — Tom muss aktiv DNS-Records setzen, sonst geht Iteration 2 nicht produktiv. Korrekt eskaliert.

#### US-14 — Stornierung durch Kunden

**Status:** Vollständig, mit kleinem Verbesserungsvorschlag zur Sichtbarkeit des Tokens.

- **Antwort auf die explizit gestellten Prüf-Fragen:**

  1. *„Wie bekommt der Kunde seinen cancelToken?"*
     → Über die Eingangsbestätigungs-Mail (`bookingReceiptToCustomer`) direkt nach `POST /api/bookings`. Template-Skizze in §15.6 Z. 1099 enthält den Storno-Link explizit. Korrekt.
  2. *„Was passiert, wenn Booking bereits CONFIRMED ist — kann Kunde trotzdem stornieren?"*
     → Nein. State-Machine §15.2: CONFIRMED ist Endstatus, alle Token-Aktionen → 410 GONE (api-routes.md Z. 561). Das ist eine bewusste Geschäftsentscheidung: Sobald Tom bestätigt hat, soll Tom selbst das Storno einleiten (Telefonkontakt). Konsistent dokumentiert.
- **Slot-Wiederfreigabe:** CANCELLED-Bookings werden vom Partial Unique Index nicht mehr als „aktiv" gezählt → Slot ist sofort wieder buchbar. Index-Definition stimmt (`WHERE status IN ('PENDING','CONFIRMED','COUNTER_PROPOSED')`).
- **MINOR-202:** Es gibt keine Spezifikation für eine optionale "Storno-Bestätigungs-Mail an den Kunden" (Bestätigung, dass die Stornierung verarbeitet wurde). Die Spec sendet nur an Tom (`cancellationToAdmin`). Da die `/buchung/storno`-Seite eine on-page-Bestätigung liefert, ist das akzeptabel — sollte aber als Backlog-Item notiert werden.

#### US-15 — Wochentag-Verfügbarkeit

**Status:** Datenmodell und API sind sauber; eine Detail-Lücke (siehe MAJOR-201).

- **Initial-Seed:** §15.3 Z. 992–993 spezifiziert `iteration2_seed_weekly_availability/migration.sql` mit 7 Default-Datensätzen (alle inaktiv). Konsistent zu §3 Z. 296–298. Tom kann nach Deploy direkt auf `/admin/availability` togglen, ohne dass die DB leer wirkt.
- **Public Endpoint `GET /api/availability`:** Sortierung nach `dayOfWeek` aufsteigend, `Cache-Control: no-store`. Korrekt.
- **MAJOR-201:** US-15 AC-3 verlangt: „Der entsprechende Tag zeigt **die Anzahl bestätigter Buchungen**." Die UI-State-Tabelle für `/admin/availability` (§14 InfoBlocker) zeigt eine Liste der CONFIRMED-Termine, aber kein explizites Aggregat „X Buchungen am 14.05.". Das könnte beim Frontend-Engineer zu Interpretation führen. Empfehlung: Frontend-Engineer rendert die Liste gruppiert nach Datum mit Count-Header („14.05.2026 — 2 bestätigte Buchungen"). Das ist eine kleine UI-Spec-Lücke, die ohne Re-Architecture-Roundtrip im Build behebbar ist, aber explizit benannt werden muss.
- **Blocker-Anzeige:** Der Begriff „Blocker" in US-15 ist konsistent zur Kalender-Logik (CONFIRMED-Buchungen blockieren den Tag). Die Doku ist eindeutig.

#### US-16 — Kalenderansicht

**Status:** Backend-Logik vollständig, ein Edge-Case ist offen (siehe MAJOR-202).

- **Antwort auf die explizit gestellten Prüf-Fragen:**

  1. *„Werden alle Randfälle (Monatsübergang, DST, Vergangenheit) abgedeckt?"*
     - **Monatsübergang:** `GET /api/calendar?year=2026&month=5` liefert genau die Tage von Mai 2026. Das Frontend muss bei Klick auf „Vorheriger/Nächster Monat" einen neuen Request mit angepassten Parametern stellen — das ist nicht explizit in §15.5 / §14 spezifiziert, aber implizit klar. **MINOR-203:** Explizite UI-State-Spec für „Monat-Navigation" (Vor/Zurück-Buttons, ggf. Disabled-Logik für „vor heute") fehlt. Frontend-Engineer kann das pragmatisch lösen.
     - **DST:** Der Pseudocode in §15.4 nutzt `Europe/Berlin` als feste Zeitzone und `formatDateInTz` für die Tagesgrenzen. Wenn das korrekt umgesetzt wird (z.B. via `Intl.DateTimeFormat` oder `date-fns-tz`), sind DST-Übergänge (letzter Sonntag im März/Oktober) automatisch korrekt. **WICHTIG-203:** Die Implementations-Vorgabe für `formatDateInTz`/`startOfMonthInTz`/`endOfMonthInTz`/`getWeekdayInTz` existiert nicht — Engineers müssen sich auf eine Bibliothek (`date-fns-tz`, `luxon`, `tzdata`) festlegen. Empfehlung an Engineers: `date-fns-tz` (gzip ~10 KB), getestet, einheitlich. Kein Blocker.
     - **Vergangenheit:** `available = ... AND isFuture` in §15.4 Z. 1043. Korrekt.
  2. *„Was zeigt der Kalender, wenn keine WeeklyAvailability konfiguriert ist?"*
     → Initial sind alle 7 Datensätze `isActive: false` → `weeklyActive` ist immer `false` → `available` ist überall `false` → alle Tage rot. Die UI-State-Tabelle für `/buchung` (§10/§14) listet keinen „Calendar-Empty"-State (analog zu „SlotList-Empty"). **MAJOR-202:** Wenn der Kunde einen Kalender mit allen roten Tagen sieht, hat er keinen klaren Hinweis, was zu tun ist. Empfehlung: Wenn `days.every(d => !d.available)` → Banner über dem Kalender: „Aktuell sind keine Termine freigeschaltet. Bitte rufen Sie uns direkt an: [tel:-Link]." Analog zu `/buchung` Empty-State (§10). Das ist eine UI-Spec-Lücke, die beim Build-Start sauber benannt werden sollte.
- **Mobile-Layout (US-16 AC-5):** §9 sagt „mobile-first, touch-freundlich" allgemein, aber für die Kalenderkomponente sind keine konkreten Touch-Target-Mindestgrößen oder Grid-Spalten spezifiziert. **MINOR-205:** Empfehlung: Frontend-Engineer dimensioniert Tagezellen auf >= 44 × 44 px (WCAG 2.5.5 AA-Guideline) und nutzt `grid-cols-7` mit `aspect-square`. Kein Blocker, normale Frontend-Disziplin.

#### Sicherheit — `GET /api/bookings/respond`

**Status:** **Sicher genug für MVP, aber mit konkretem Engineering-Hinweis zur Token-Loggung.**

- **Antwort auf die explizit gestellten Prüf-Fragen:**

  1. *„Ist GET /api/bookings/respond öffentlich (kein Auth) aber zustandsverändernd — sicher genug mit cancelToken?"*
     → Ja, mit dem in §15.7 dokumentierten Reasoning: cuid() ist 24+ Zeichen kollisionsarm; brute-forcen über HTTPS gegen ~2^120 Möglichkeiten ist statistisch chancenlos. Die Trade-off-Erklärung „GET nötig, weil Mail-Clients keine JS-Forms ausführen" ist akzeptiert und in §13 Z. 837–840 als bewusste Design-Entscheidung markiert.
  2. *„Ist cancelToken schwer genug zu raten (cuid())?"*
     → Ja. cuid() ist nicht ganz so stark wie cuid2() oder eine 256-Bit-UUID, aber für die Bedrohungsmodellierung (kein finanzieller Schaden, nur Storno einer Anfrage) absolut ausreichend. **MINOR-204:** Optional kann der Architekt cuid2 erwägen — aber das ist eine kleine Härtung, kein Defekt.
- **Token-Loggung (positiv):** §15.7 Z. 1149–1151 weist Engineers explizit an, Tokens nicht in `console.log`-Calls zu loggen oder zu hashen. Das ist ein professioneller Hinweis und beugt einem realistischen Leak vor (Vercel-Logs werden u.a. von Sub-Agents/Auto-Tools angesehen).
- **Rate-Limit:** §15.7 nennt explizit „kein Limit auf `GET /api/bookings/respond` — Token ist die Authority". Konsistent. `POST /api/bookings/rebook` hat 5/60 min/IP — verhindert Bot-Scraping nach Token-Diebstahl. Sauber.

---

### 3. Wichtige Befunde (Major)

#### MAJOR-201 — US-15 AC-3: „Anzahl bestätigter Buchungen pro Tag" nicht explizit in UI-Spec

- **Story:** US-15 AC-3
- **Layer:** Frontend / UI-Spec
- **Beschreibung:** Die UI-State-Tabelle in §14 für `/admin/availability` benennt eine Liste von CONFIRMED-Terminen, aber das AC verlangt explizit eine Tagesanzahl-Anzeige. Engineers könnten das übersehen oder nur als Liste umsetzen.
- **Empfohlener Fix:** ARCHITECTURE.md §14 ergänzen: „InfoBlocker zeigt pro Datum eine Header-Zeile mit Count („14.05.2026 — 2 bestätigte Buchungen"), darunter die Einzelbuchungen mit Slot-Zeit + Kundenname." Alternativ kann der Frontend-Engineer das während der Implementierung pragmatisch ergänzen — keine Architektur-Änderung nötig.
- **Routing:** `frontend-engineer` (Implementierung) oder optional `solution-architect` (kleine Spec-Schärfung).

#### MAJOR-202 — `/buchung` Calendar-Empty-State fehlt

- **Story:** US-16 (UX-Edge-Case)
- **Layer:** Frontend / UI-Spec
- **Beschreibung:** Wenn keine WeeklyAvailability aktiv ist (Initial-Zustand nach Deploy oder bei Test-Tom-Klick „alles aus"), sieht der Kunde einen Kalender voller roter Tage ohne Erklärung. Das ist UX-feindlich: der Kunde könnte denken „die Seite ist kaputt", statt zum Telefon zu greifen.
- **Empfohlener Fix:** ARCHITECTURE.md §14 in der `/buchung`-Tabelle einen State `Calendar-AllBlocked` ergänzen: „Wenn `data.days.every(d => !d.available)` → Banner über dem Kalender mit tel:-Link und Hinweis 'Aktuell sind keine Termine freigeschaltet. Bitte rufen Sie uns direkt an: 0157-74787512.'" Analog zum bestehenden `/buchung` Empty-State (§10).
- **Routing:** `frontend-engineer` (Implementierung) oder `solution-architect` (Spec-Ergänzung).

#### MAJOR-203 — `/buchung/bestaetigt` 409-Pfad fehlt in UI-States

- **Story:** US-13 AC-3 (Edge-Case)
- **Layer:** Frontend / UI-Spec
- **Beschreibung:** Die UI-State-Tabelle für `/buchung/bestaetigt` in §14 listet nur `Default` (Erfolg) und `Gone` (Token verbraucht). Wenn der Kunde annehmen will, der vorgeschlagene Slot aber inzwischen anderweitig vergeben ist (409 CONFLICT vom Index), wird der Handler keinen passenden Redirect-Pfad haben.
- **Empfohlener Fix:** ARCHITECTURE.md §14 ergänzen: `/buchung/bestaetigt?status=conflict` mit Banner „Der vorgeschlagene Termin wurde inzwischen anderweitig vergeben. Bitte direkt anrufen: …" — und entsprechend `GET /api/bookings/respond` redirectet bei 409 auf diesen Pfad statt eine reine 409-JSON-Antwort zu liefern (Mail-Klick muss in einen sichtbaren UI-Pfad münden).
- **Routing:** `solution-architect` (Spec) oder `backend-engineer` + `frontend-engineer` (gemeinsam beim Build).

---

### 4. Minor Befunde

#### MINOR-201 — `unstable_after` als deterministischer Default für Mail-Dispatch

BUG_US04_ANALYSIS.md sagt „Engineers sollen `unstable_after` ausprobieren". Empfehlung: Klare Default-Anweisung („Wenn Next 14.2+, nutze `unstable_after`; sonst `void promise`"). Backend-Engineer kann das während Implementation klären. Routing: `backend-engineer`.

#### MINOR-202 — Kunden-Storno-Bestätigungs-Mail nicht im Template-Set

US-14 sendet nur an Tom (`cancellationToAdmin`). Eine optionale Bestätigung an den Kunden wäre nett, ist aber durch die `/buchung/storno`-Erfolgsseite abgedeckt. Backlog-Eintrag genügt. Routing: `project-manager`.

#### MINOR-203 — Monat-Navigation im Kalender nicht spezifiziert

§14 für `/buchung` benennt „Calendar-Loading" und „Calendar-Ready", aber keine UI-Spec für „Vor/Zurück-Monat"-Buttons (z.B. Disabled-Logik für Vergangenheit, Tasten-Bedienung mit Pfeiltasten). Frontend-Engineer kann pragmatisch handhaben. Routing: `frontend-engineer`.

#### MINOR-204 — cuid() vs. cuid2() für cancelToken

cuid() ist sicher genug für den Use-Case, cuid2() wäre eine kleine Härtung mit kompatiblerem 24-Char-Format. Optional. Routing: `solution-architect` (Backlog).

#### MINOR-205 — Mobile-Touch-Targets im Calendar nicht explizit dimensioniert

§9 nennt Mobile-First allgemein, aber 44×44 px Mindesttouch-Target (WCAG 2.5.5) ist nicht für Calendar-Tageszellen festgehalten. Frontend-Engineer-Disziplin. Routing: `frontend-engineer`.

---

### 5. Positive Beobachtungen

- **State-Machine-Diagramm (§15.2):** Das ASCII-Diagramm ist verständlich und vollständig — alle 9 möglichen Übergänge sind benannt, jeder Übergang ist einem Endpoint zugeordnet, Idempotenz-Regel ist explizit formuliert.
- **Trade-off-Transparenz:** §3 (Slot-Locking) und §13 (Annahmen) machen kontroverse Designentscheidungen explizit sichtbar (z.B. „neuer Slot wird nicht hart gesperrt", „GET-Endpoint mit Zustandsänderung", „customerEmail Pflichtfeld"). Tom kann das überstimmen, aber er weiß, was zu überstimmen ist.
- **Engineering-Hinweise sind dateigenau:** BUG_US04_ANALYSIS.md hat dateigenaue Anweisungen (`src/app/api/bookings/route.ts`, `src/lib/mail.ts`, `.env.example`) — Engineers können das ohne Spec-Studium umsetzen.
- **Kontrakt-Konsistenz:** Alle 5 neuen API-Endpunkte sind in `api-routes.md`, `schema.prisma`, `zod-schemas.ts` und der Endpoint-Story-Matrix konsistent. Keine Drift gefunden.
- **Mail-Templates skizziert:** §15.6 hat alle 5 neuen Templates (Subject + Inhalts-Skizze) — Frontend/Mail-Engineer hat eine klare Vorlage.
- **Resend-DNS-Verifikation als „[NEEDS INPUT]"** explizit eskaliert — das verhindert, dass Iteration 2 mit `onboarding@resend.dev` live geht und dann an der Resend-Free-Tier-Policy scheitert.

---

### 6. Sign-off Checklist (Iteration 2)

- [x] BUG US-04 Root-Cause-Analyse ist überzeugend, Fixes sind dateigenau spezifiziert.
- [x] State-Machine für Booking-Status (Iteration 2) ist eindeutig und vollständig (§15.2).
- [x] Token-Sicherheit + Token-Loggung-Hinweis dokumentiert (§15.7).
- [x] Slot-Locking-Trade-off bei Counter-Proposals explizit (§3 Z. 275–287).
- [x] Datenmodell-Erweiterungen (cancelToken, counterProposalSlotId, WeeklyAvailability) konsistent über Schema/API/Zod.
- [x] DST/TZ-Handling im Kalender benannt (Berlin-TZ, `formatDateInTz`).
- [x] Resend-DNS-Verifikation als Open-Decision für Tom eskaliert.
- [ ] (Empfohlen, nicht-blocking) MAJOR-201 bis MAJOR-203 in §14 ergänzen — kann auch beim Build-Start geschehen.

---

### Finales Urteil (Iteration 2)

**Design freigegeben.**

Es gibt keine kritischen Blocker. Die State-Machine ist vollständig, alle expliziten Prüf-Fragen werden von der Spec sauber beantwortet, der BUG-US-04-Fix ist konkret und ausführbar, und die Token-Sicherheit ist für den Use-Case angemessen begründet.

Die drei Major-Findings (MAJOR-201/202/203) betreffen UI-State-Tabellen für Edge-Cases und können entweder vom Architekten als kleine Spec-Ergänzungen nachgereicht werden ODER pragmatisch von Frontend- und Backend-Engineer beim Build mitgefangen werden — beides ist legitim. Sie verhindern den Build-Start nicht, weil die Lösungsrichtung jeweils klar im umliegenden Kontext angedeutet ist.

Die Minor-Findings sind klassische Implementation-Detail-Fragen, die in normaler Engineering-Disziplin gelöst werden.

**Empfohlene Reihenfolge für die Engineers:**
1. **Zuerst BUG US-04 fixen** (Backend) — danach erst US-13/14/15/16 starten, weil US-13/14 auf der Mail-Pipeline aufsetzen.
2. **WeeklyAvailability + Migration zuerst** (US-15 BE), weil US-16 (Calendar) das konsumiert.
3. **Counter-Proposal + Token-Endpoints** (US-13 BE) parallel zu US-15 BE.
4. **Frontend-Komponenten** (Calendar, CounterProposalDialog, WeeklyAvailabilityForm, Re-Booking-Mode) nach BE-Endpoint-Stabilität.
5. **Bei Build-Start** sollte der Architekt MAJOR-201/202/203 in einem kleinen v1.3-Patch ergänzen oder an die Engineers explizit weiterreichen.

Implementation kann beginnen.

---

## Iteration 3 Design Review

**Modus:** Design QA (vor Code-Erstellung)
**Datum:** 2026-05-02
**Iteration:** 3
**Reviewer:** Senior QA Engineer
**Geprüfte Artefakte:**
- `PROJECT.md` (User Stories US-17 bis US-24, BUG IT3)
- `ARCHITECTURE.md` v1.3 (§16 Iteration 3)
- `contracts/schema.prisma` v1.3
- `contracts/api-routes.md` v1.3
- `contracts/zod-schemas.ts` v1.3
- `contracts/BUG_BOOKING_IT3.md`

### Verdict (Kurzfassung)

**Design freigegeben — mit Auflagen.**

- 0 Blocker. Alle echten Showstopper sind in der Spec adressiert.
- 4 Major-Findings, die Engineers beim Build inline lösen können (klare Lösungsrichtung jeweils dokumentiert).
- 6 Minor-Findings.
- Pass-Rate: 30/34 prüfbare Spec-Punkte.

Die Architektur-Entscheidung "Variante 2 = Server-Component liest Template/Overrides direkt aus Prisma" (siehe §16.15) ist die wichtigste neue Festlegung in IT3 und wird im Review konsequent als Maßstab verwendet.

### 1. Test-Matrix (Stories in Scope)

| Story  | AC                                | Spec-Stelle                       | Testbar? | Status |
|--------|-----------------------------------|-----------------------------------|----------|--------|
| BUG IT3 | Form-Submit feuert POST mit korrektem Payload         | §16.1 + BUG_BOOKING_IT3.md §5/§7 | ja       | Pass   |
| BUG IT3 | Validation-Fehler sichtbar (kein silent fail)         | BUG_BOOKING_IT3.md §3, Patch 3    | ja       | Pass   |
| US-17  | Default-Vorlage „auf alle Tage anwenden"                | §16.2, PUT /api/admin/availability-template | ja | Pass   |
| US-17  | Einzelner Tag überschreiben (ohne andere zu ändern)    | DayOverride-Modell, §16.2 Resolver | ja      | Pass   |
| US-17  | Kunde wählt Uhrzeit innerhalb des Fensters              | GET /api/slots/available + TimeSlotPicker | ja | Pass   |
| US-17  | 30-Min-Schritte aus Annahme PROJECT.md                  | `slotDurationMinutes` (Default 60, NICHT 30) | ja | **Fail** (siehe MAJOR-301) |
| US-17  | Race-Condition Doppelbuchung                            | Partial Unique Index + 409 CONFLICT | ja      | Pass   |
| US-17  | Bestandsbuchungen bleiben lesbar/funktionsfähig         | §16.10 Migration, schema.prisma   | ja       | Pass   |
| US-18  | Datei-Upload (image/video/pdf)                          | POST /api/upload, §16.3, UPLOAD_ACCEPTED_CONTENT_TYPES | ja | Pass |
| US-18  | 20 MB-Limit erzwungen                                   | UPLOAD_MAX_FILE_BYTES, 413 PAYLOAD_TOO_LARGE | ja  | Pass   |
| US-18  | 5 Dateien-Limit erzwungen                               | `attachmentIds.max(5)` (FE-only!) | partial  | **Fail** (siehe MAJOR-302) |
| US-18  | Tom sieht Anhänge im Admin-Portal                       | BookingAttachmentList, §16.3      | ja       | Pass   |
| US-18  | Upload optional (kein Datei → Submit OK)                | `attachmentIds.optional()`         | ja       | Pass   |
| US-18  | Orphan-Cleanup bei Storno/Abandon                       | §16.3 Cleanup-Cron als Backlog    | partial  | **Fail** (siehe MAJOR-303) |
| US-18  | DSGVO-Aufbewahrung 2 Jahre                              | §11 erwähnt nur Bookings, NICHT Attachments | nein | **Fail** (siehe MINOR-301) |
| US-19  | „Sonstiges" als letzter Eintrag                          | SERVICES-Konstante                | ja       | Pass   |
| US-19  | Pflichtfeld 30+ Zeichen                                 | superRefine in beiden Schemas     | ja       | Pass   |
| US-19  | Anzeige im Admin als „Sonstiges / Individuelle Anfrage" | §16.4 + Admin-Service-Label-Map   | partial  | siehe MINOR-302 |
| US-20  | Richtpreis pro Service-Karte                            | §16.5 + lib/services.ts           | ja       | Pass   |
| US-20  | Disclaimer Mobile + Desktop                             | §16.5 Tooltip-Pattern             | ja       | Pass   |
| US-21  | Chronologische Liste bevorstehender Termine              | GET /api/admin/upcoming-bookings, §16.6 | ja  | Pass   |
| US-21  | „Heute"-Badge                                           | UpcomingBookingSchema.isToday     | ja       | Pass   |
| US-21  | Klick → Detail                                          | Anchor-Link auf /admin/bookings#id | ja      | Pass   |
| US-22  | 10 Bewertungen, Ø ~4.5                                  | §16.7, lib/reviews.ts             | ja       | Pass   |
| US-22  | „Mehr anzeigen" ab >6 Reviews                           | §16.7 ReviewSection               | ja       | Pass   |
| US-22  | Kompatibilität mit US-29-Datenmodell                    | §16.7 explizit dokumentiert       | ja       | Pass   |
| US-23  | Popup mit Vorher/Nachher + CTA                          | §16.8 ServiceModal                | ja       | Pass   |
| US-23  | Schließen via X / Klick / Escape                         | §16.8                              | ja       | Pass   |
| US-23  | „Jetzt anfragen" → Formular mit vorausgewähltem Service  | Query-Param `?service=<slug>`      | ja       | Pass   |
| US-24  | Eingangsbestätigung mit cancelToken-Link                | §16.9 + Bestand `bookingReceiptToCustomer` (IT2) | ja | Pass |
| US-24  | Bestätigungs-Mail bei PENDING→CONFIRMED                  | §16.9 Trigger im PATCH-Handler    | ja       | Pass   |
| US-24  | Ablehnungs-Mail bei →REJECTED                            | §16.9 Trigger im PATCH-Handler    | ja       | Pass   |
| US-24  | Storno-Link in Bestätigung                              | `actionUrl(token, 'cancel')`      | ja       | Pass   |
| US-24  | Mails auf Deutsch + Tom-Footer                          | §16.9 Subject/Body skizziert      | ja       | Pass   |
| Sec    | Upload-Endpoint Rate-Limit                              | §16.13 — 20/h/IP                  | ja       | Pass   |
| Sec    | Public Endpoints geschützt                              | §16.13 Rate-Limit-Tabelle         | ja       | Pass   |

### 2. BUG IT3 — Root-Cause-Analyse

**Verdict: Überzeugend, dateigenau, ausführbar.**

Die Analyse in `BUG_BOOKING_IT3.md` ist die qualitativ beste Bug-Analyse, die bisher in diesem Projekt vorliegt:

- **Root Cause klar identifiziert:** `register('slotId')` an Hidden-Input mit `value=` ist ein bekanntes RHF-Anti-Pattern. Der Mechanismus (RHF-State-Quelle vs. DOM-`value`-Konflikt) ist korrekt erklärt.
- **Sekundärursachen eskaliert:** Bug B (Mount-Reihenfolge), Bug C (unsichtbare Validation auf hidden Input), Bug D (`'sonstiges'` fehlt in SERVICES) und Bug E (IT3-Slot-Modell-Übergang) sind alle benannt und priorisiert.
- **Patch ist konkret:** `BookingFormSchema = CreateBookingSchema.omit({ slotId: true })` ist exakt der richtige Move — die API-Vertrags-Wahrheit bleibt in `CreateBookingSchema`, das Form benutzt eine reduzierte Variante. Genau dasselbe Pattern ist im Zod-Schema bereits umgesetzt (`BookingFormSchema` in `zod-schemas.ts`, Zeilen 327–357).
- **Verifikations-Schritte testbar:** §6 listet 5 reproduzierbare Test-Schritte mit erwartetem Ergebnis.
- **Akzeptanzkriterien für QA in §7:** 8 Bullets mit konkreten Erwartungen.

**Eine Lücke (MINOR-303):** §5 Patch 5 (Console-Logging) fehlt der Hinweis, dass das Logging vor Production wieder entfernt oder durch strukturiertes Logging ersetzt werden muss — sonst landen PII-Daten (Name, Telefon, E-Mail) in den Browser-Console-Logs.

### 3. Findings nach Schwerpunkt

#### MAJOR-301 — `slotDurationMinutes` widerspricht Annahme „30 Minuten" aus PROJECT.md

`PROJECT.md` Zeile 669 Annahmen:

> Zeitfenster-Schritte für Kundenbuchung: 30 Minuten (Annahme — Tom bestätigen).

`AvailabilityTemplate.slotDurationMinutes` hat den Default `60` (schema.prisma Zeile 210; api-routes.md Zeile 333–339). Der seed initialisiert jeden Tag mit 60 Minuten (§16.10 SQL-Migration).

**Risiko:** Inkonsistenz zwischen User-Story-Annahme und Implementation. Wenn Tom erwartet, dass der Default 30 Minuten ist (und das ihm so ankündigt wurde), wird er beim ersten Login 60-Min-Slots sehen und ist verwirrt.

**Lösungsrichtung:**
- Entweder Default in `schema.prisma` (Zeile 210), `seed.sql` (§16.10 Zeile 1769) und API-Beispiel (api-routes.md Zeilen 333–339) auf `30` ändern.
- ODER Annahme in `PROJECT.md` Zeile 669 explizit auf 60 Minuten korrigieren („initial 60 Minuten, Tom kann pro Tag anpassen").

Das Schema erlaubt 15–480 Minuten, also ist das eine reine Default-Wert-Frage. Engineers können das beim Build entscheiden, brauchen aber eine eindeutige Vorgabe.

**Routing:** `solution-architect` (1 Zeile in der Spec) oder `project-manager` (Tom kurz fragen).

#### MAJOR-302 — `attachmentIds.max(5)` ist nur im CreateBookingSchema, nicht im POST /api/upload

§16.3 sagt Server-side Limit: „max. 5 Dateien pro Buchung". Der Schema-Code in `zod-schemas.ts` (Zeile 250) erzwingt das tatsächlich beim `POST /api/bookings`-Aufruf.

**Aber:** `POST /api/upload` validiert nicht, wie viele Dateien bereits vom selben Client/IP hochgeladen wurden. Ein böswilliger Client kann 100 Dateien zu je 19 MB hochladen (= 1.9 GB), bevor `POST /api/bookings` mit nur 5 IDs aufgerufen wird oder gar nicht. Die übrigen 95 Dateien bleiben als Orphans im Vercel Blob.

Das wird zwar durch das Rate-Limit „20 Uploads / 60 min / IP" (§16.13) gemildert, aber:
- 20 × 19 MB = 380 MB pro IP / Stunde
- 380 MB × 24 = 9.1 GB pro IP / Tag
- Free-Tier-Limit = 2 GB total

Zwei IPs füllen das Free-Tier in einem Tag. Engineers brauchen eine Strategie:

**Lösungsrichtung:**
- Empfehlung: Aufträgliche Validation reicht für MVP, ABER der Cleanup-Cron (§16.3) ist NICHT mehr Backlog, sondern Pflicht für Iteration 3.
- Alternativ: Rate-Limit auf 5 oder 10 Uploads / 60 min / IP senken (statt 20) — passt zur Stories-Annahme „max. 5 Dateien pro Buchung".

**Routing:** `solution-architect` (Spec-Klarstellung) → `backend-engineer` (Cleanup-Cron implementieren).

#### MAJOR-303 — Orphan-Attachments bei abgebrochener Buchung sind nicht spec'd

Use-Case: Kunde lädt 3 Fotos hoch, schließt dann den Tab ohne Submit. `BookingAttachment.bookingId` bleibt `null`, Vercel-Blob-Datei bleibt liegen.

§16.3 erwähnt den Cleanup-Cron als „Backlog" (1×/Tag, 24h-Cutoff). Das ist für die Datei-Größen vernünftig, aber:

1. **DSGVO-Risiko:** Der Kunde könnte eine Datei mit personenbezogenen Daten (Foto eines Mahnbescheids, Vollmacht-PDF) hochgeladen haben, ohne die Anfrage abzuschicken. Die Datei landet auf einer **öffentlichen** Vercel-Blob-URL und liegt dort bis zum nächsten Cleanup-Lauf. Bis Cleanup-Cron in Backlog ist: **liegt sie unbegrenzt**.
2. **Stornierte Buchungen:** §16.3 spricht nur von `bookingId === null`. Wenn eine Buchung später storniert wird (Status CANCELLED/REJECTED), bleiben die Anhänge bestehen. Das ist im DSGVO-Sinne fragwürdig.

**Lösungsrichtung:**
- Cleanup-Cron für `bookingId === null && createdAt < now-24h` ist Pflicht für IT3 (nicht Backlog).
- Ergänzung: Bei Status-Wechsel auf CANCELLED/REJECTED + Mail an Kunde gesendet → Anhänge nach Aufbewahrungsfrist (2 Jahre, analog zu Bookings) löschen. Das kann an §11 Aufbewahrungsfristen angedockt werden.

**Routing:** `solution-architect` (Spec-Ergänzung in §16.3 + §11) → `backend-engineer`.

#### MAJOR-304 — Variante 2 (Server-Component) widerspricht §10 Frontend-Aufrufer-Mapping

§16.15 Annahme: „Iteration 3 nutzt **Variante 2** der Calendar-Daten-Beschaffung (Server-Component liest direkt aus Prisma), kein öffentlicher GET-Endpoint für Template/Overrides."

Aber:

- `api-routes.md` §7 Zeile 770–774 sagt: „Engineers können einen ungeschützten `GET /api/availability-template` implementieren, falls Engineers das implementieren möchten" — also offen gelassen.
- `api-routes.md` §10 (Frontend-Aufrufer-Mapping, Zeile 829): `GET /api/admin/availability-template` wird von `app/admin/availability/page.tsx` aufgerufen — das ist Admin-only, OK. Aber der Calendar (`CalendarV2.tsx`) ruft **keinen** Endpoint für die Template-Daten auf, das passt zu Variante 2.
- §16.2 zeigt im Buchungs-Flow-Pseudocode (Zeile 1286–1287): `GET /api/availability-template` und `GET /api/day-overrides?month=...` — beide ohne `/admin`-Präfix, also ÖFFENTLICH. Das ist Variante 1, nicht Variante 2.

**Drei widersprüchliche Aussagen in derselben Spec.** Engineers müssen raten.

**Lösungsrichtung:**
- Spec eindeutig auf Variante 2 festlegen (was §16.15 sagt).
- §16.2 Pseudocode-Block (Zeile 1283–1301) aktualisieren: Server-Component-Pattern statt Client-Fetches.
- §7 (Zeile 762–776) entfernen oder präzisieren.

**Routing:** `solution-architect`.

#### MAJOR-305 — Zeitstrings als HH:MM/YYYY-MM-DD ohne TZ — DST-Risiko unzureichend behandelt

Schema (Zeile 96–103 schema.prisma) und §16.2 erklären das Berlin-TZ-First-Konzept. Das ist konzeptionell richtig — Strings ohne Offset vermeiden Auto-Konvertierung. Aber:

- **DST-Übergang:** Am 26.10.2026 (Winterzeit-Wechsel) gibt es zwei mögliche „02:30 Uhr". Am 29.03.2026 (Sommerzeit-Wechsel) gibt es kein „02:30 Uhr" überhaupt. Die Spec adressiert das nicht — sie sagt nur „kein Shift bei DST" (Zeile 103). Der Mail-Versand verwendet `Intl.DateTimeFormat` mit `timeZone: 'Europe/Berlin'` (Zeile 1694), was korrekt ist, aber:
- **`computeAvailableSlots()` in `lib/availability.ts`:** Wenn Tom Slot-Dauer auf 30 Min setzt und Fenster 02:00–03:30, würden am DST-Tag entweder 2 oder 4 Slots erscheinen, je nach Logik. Engineers müssen entscheiden.

**Risiko:** In der Praxis ist das in IT3 ein theoretisches Problem (Tom arbeitet nicht um 02:00 Uhr). Aber die Spec sollte explizit sagen „DST-Übergänge sind out-of-scope für IT3, weil die Verfügbarkeitsfenster typischerweise zwischen 06:00 und 22:00 liegen". Sonst riskiert Iteration 4 mit Zahlungs-Cron einen verdeckten Bug.

**Lösungsrichtung:**
- Spec-Hinweis in §16.2 oder §16.15: „Verfügbarkeitsfenster werden zwischen 06:00 und 22:00 erwartet — DST-Übergangszeiten (02:00–03:00) sind out-of-scope für IT3."

**Routing:** `solution-architect` (1 Zeile Annahme).

#### MINOR-301 — DSGVO-Aufbewahrung für Attachments fehlt in §11

§11 nennt nur Bookings (2 Jahre) und Slots/User. Attachments fehlen. **Lösung:** Eine Zeile in §11 ergänzen: „Attachments folgen dem Booking — werden mit dem Booking gelöscht (Cascade auf DB-Ebene); Blob-Datei muss separat über Cleanup-Cron entfernt werden."

**Routing:** `solution-architect`.

#### MINOR-302 — `'sonstiges'`-Anzeige im Admin

§16.4 zeigt das Verhalten im Form, aber es fehlt der Hinweis, wie das Admin-Bookings-UI den Service rendert. `SERVICE_LABELS['sonstiges']` muss in `lib/services.ts` definiert werden, sonst zeigt die Tabelle den nackten Slug. Engineers können das beim Build mitfangen.

**Routing:** `frontend-engineer`.

#### MINOR-303 — Console-Logging in Patch 5 ist PII-Risiko

`BUG_BOOKING_IT3.md` §5 Patch 5 ergänzt `console.log(values)` zum Debugging. `values` enthält Name, Telefon, E-Mail. In Production fließt das in die Browser-Console (für jeden mit Zugang zum Browser sichtbar) und potenziell in Vercel-Logs. Die Anweisung sollte ein „Vor Deploy entfernen oder durch `if (process.env.NODE_ENV === 'development')` schützen" enthalten.

**Routing:** `frontend-engineer` (Disziplin-Ergänzung).

#### MINOR-304 — Fehlende UI-State-Definition für `POST /api/upload` `502` (Vercel Blob downstream)

api-routes.md §4 Fehlerliste listet 502 (Vercel Blob upstream nicht erreichbar). §16.12 (UI-States Iteration 3) definiert FileUpload-Error für 413/415/Netzwerk, aber NICHT explizit für 502. Engineers fangen das vermutlich als generischen Netzwerkfehler ab; eine Zeile in §16.12 würde das festzurren.

**Routing:** `solution-architect` oder `frontend-engineer`.

#### MINOR-305 — `BookingAttachment.bookingId` im Schema vs. §16.3 sagt „nullable"

`schema.prisma` Zeile 272 zeigt `bookingId String` (Pflicht). §16.3 (Zeile 1373–1384) und api-routes.md §4 (Zeile 638–648) sagen „muss nullable sein, Engineers passen Live-Schema an". Das ist eine bekannte Lücke, im Schema-Header kommentiert — aber strenggenommen ist `contracts/schema.prisma` damit NICHT die Single Source of Truth.

**Lösung:** `schema.prisma` direkt auf `bookingId String?` ändern. Sonst muss der Engineer beim Sync zwei Stellen anfassen und kann den Hinweis übersehen.

**Routing:** `solution-architect`.

#### MINOR-306 — `customerEmail` in `BookingAdminSchema` ist `z.string()`, nicht nullable — aber Bestand kann `null` haben

`zod-schemas.ts` Zeile 427 sagt `customerEmail: z.string()`. In IT2 wurde `customerEmail` zur Pflicht — aber Bestandsbuchungen aus IT1 können `null` haben. Wenn das Admin-UI eine alte Buchung lädt, knallt die Zod-Validation. Im Schema (`schema.prisma` Zeile 147) ist `customerEmail String?` korrekt nullable.

**Lösung:** `customerEmail: z.string().nullable()` im BookingAdminSchema. Backend-Engineer kann das beim Build sehen, muss aber daran erinnert werden.

**Routing:** `solution-architect`.

### 4. Race-Conditions und Sicherheit

| Risiko                                                    | Bewertung                                                                                                  |
|-----------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Doppelbuchung auf gleichem Zeitslot                       | **Gelöst** durch Partial Unique Index `uniq_active_booking_per_timeslot`. P2002 → 409 CONFLICT.            |
| Kunde wählt Zeitslot der nicht der Vorlage entspricht      | **Gelöst** durch `endTime - startTime === slotDurationMinutes`-Check im Backend (§16.2 Zeile 1334).         |
| Tag wird zwischen Slot-Auswahl und Submit auf inaktiv gesetzt | **Gelöst** durch Verfügbarkeitsfenster-Check beim Submit (§api-routes.md §2 Zeile 172–187). 409 Response. |
| Zwei Kunden buchen gleichzeitig denselben Block            | **Gelöst** durch Partial Unique Index. Last writer verliert mit 409.                                       |
| Beim Override-Anlegen (`isActive: false`) bestehen aktive Buchungen weiter | **Bewusst** so gelöst — Tom muss manuell stornieren. Warning in Response (`ACTIVE_BOOKINGS_AFFECTED`). Sinnvoll für MVP. |
| Upload-Endpoint ohne Auth                                 | **OK** — Rate-Limit + MIME-Whitelist + Size-Limit. Public-Bucket-Hinweis in Datenschutz (§16.13).          |
| `attachmentIds` fremder Buchungen verknüpfen              | **Risiko nicht klar gelöst.** Wenn Angreifer eine `attachmentId` einer fremden Buchung kennt, könnte er sie in seiner eigenen `POST /api/bookings`-Request übergeben. Der `updateMany`-Filter `where: { id: { in: attachmentIds }, bookingId: null }` schützt nur, wenn `bookingId` noch nicht gesetzt ist. Akzeptabel für MVP (cuids sind raterisch unwahrscheinlich), aber sollte als Annahme dokumentiert sein. |

### 5. Positive Beobachtungen

- **Schema-Migration ist transparent:** §16.10 listet alle SQL-Statements explizit (ALTER TABLE, neue Indexe, Seed). Das `slot_id`-Nullable-Migration-Hack für SQLite ist erwähnt.
- **Bestandskompatibilität durchgezogen:** Slot-basierte Bestandsbuchungen können weiterhin gelesen, gepatcht und counter-proposed werden. Keine Daten-Migration nötig — beide Modi koexistieren über zwei Partial Unique Indexe.
- **BookingFormSchema vs. CreateBookingSchema:** Saubere Trennung von API-Wahrheit und Form-Wahrheit. Der RHF-Bug aus IT3 wird strukturell verhindert (siehe Zeile 322–326 in zod-schemas.ts).
- **Mail-Templates skizziert:** §16.9 hat Subject + Body-Skizze für die zwei neuen Kunden-Mails. Engineers haben eine klare Vorlage.
- **`isToday`-Flag im UpcomingBookingSchema:** Wird vom Backend berechnet, nicht vom Frontend (§16.6 Algorithmus Zeile 705–712). Vermeidet TZ-Bugs auf Client-Seite.
- **Bug-Analyse ist ausführbar:** BUG_BOOKING_IT3.md ist die qualitativ beste Bug-Analyse des Projekts und kann direkt als Engineering-Anweisung verwendet werden.
- **Vercel Blob-Wahl gut begründet:** §16.3 listet 5 Alternativen mit explizitem Begründung gegen — Engineers müssen die Stack-Entscheidung nicht erneut hinterfragen.
- **API-Versionierung sauber:** v1.3-Header und Änderungslog in api-routes.md, schema.prisma und zod-schemas.ts sind synchron — keine Version-Drift.

### 6. Sign-off Checklist (Iteration 3)

- [x] BUG IT3 Root-Cause-Analyse ist überzeugend, Patch dateigenau (Patch 1–5).
- [x] AvailabilityTemplate + DayOverride + Resolver-Logik konsistent über Schema/API/Zod.
- [x] Race-Condition-Schutz für Doppelbuchung via Partial Unique Index.
- [x] Bestandsbuchungen (Slot-basiert) bleiben im Schema und Endpoint-Set lesbar.
- [x] Datei-Upload-Limits (5 Dateien, 20 MB) im Zod-Schema durchgesetzt.
- [x] DSGVO-Hinweis für Public-Blob-URLs in §16.13 erwähnt.
- [x] Kunden-Mail-Trigger im PATCH-Handler dokumentiert.
- [ ] (Empfohlen, NICHT-blocking) MAJOR-301 (slotDurationMinutes-Default) klären.
- [ ] (Empfohlen, NICHT-blocking) MAJOR-302 (Upload-Cleanup) als IT3-Pflicht statt Backlog.
- [ ] (Empfohlen, NICHT-blocking) MAJOR-304 (Variante 2 vs. öffentliche Endpunkte) widerspruchsfrei machen.
- [ ] (Empfohlen, NICHT-blocking) MINOR-305 (`bookingId` nullable im Schema direkt) ergänzen.
- [ ] (Empfohlen, NICHT-blocking) MINOR-306 (`customerEmail.nullable()` in BookingAdminSchema) ergänzen.

### Finales Urteil (Iteration 3)

**Design freigegeben.**

Es gibt **keine echten Blocker.** Die kritischen Architekturänderungen (US-17 Verfügbarkeitsfenster, US-18 Datei-Upload, US-24 Kunden-Mails) sind durchdacht, die Spec ist rückwärtskompatibel, der RHF-Bug ist strukturell adressiert, und die Race-Conditions sind über Partial Unique Indexe abgesichert.

**Die fünf Major-Findings betreffen Inkonsistenzen und Lücken,** die Engineers entweder beim Build inline lösen oder durch eine kurze Architekt-Klärung präzisieren können:

1. **MAJOR-301** (slotDurationMinutes-Default): 1 Zeile-Klärung mit Tom oder im Spec-Annahme-Block.
2. **MAJOR-302** (Upload-Cleanup): Pflicht-Status für Cleanup-Cron klarstellen.
3. **MAJOR-303** (Orphan-Attachments DSGVO): §11 ergänzen, dass Attachments dem Booking folgen.
4. **MAJOR-304** (Variante 1 vs. 2): Widerspruch zwischen §16.2 Pseudocode und §16.15 Annahme auflösen.
5. **MAJOR-305** (DST-Annahme): 1 Zeile in §16.15 ergänzen.

Alle Fixes sind 1–3-Zeilen-Spec-Edits. Engineers können den Build starten, sobald entweder der Architekt diese inline ergänzt oder der Orchestrator sie als bekannte Build-Disziplin an die Engineers weitergibt.

**Empfohlene Reihenfolge für die Engineers (Iteration 3):**

1. **BUG IT3 fixen zuerst** — `BookingForm.tsx` umbauen entsprechend `BUG_BOOKING_IT3.md` Patch 1+3+4. Ohne diesen Fix funktioniert keine andere IT3-Story.
2. **Schema-Migration** (US-17): `bookingId String?` direkt im schema.prisma; AvailabilityTemplate + DayOverride + Indexe; Seed-Migration aus WeeklyAvailability.
3. **Backend-Endpunkte** parallelisieren:
   - `GET /api/slots/available` (US-17, blockiert FE).
   - `POST /api/upload` + `BookingAttachment.bookingId` nullable (US-18, blockiert FE).
   - `GET /api/admin/upcoming-bookings` (US-21, blockiert Dashboard-FE).
   - `PUT /api/admin/availability-template` + `POST /api/admin/day-overrides` (US-17 Admin).
   - PATCH-Handler-Erweiterung mit Mail-Triggern (US-24).
4. **Frontend nach BE-Stabilität:**
   - `BookingForm` + `TimeSlotPicker` + `FileUpload` (BUG IT3 + US-17 + US-18).
   - Service-Modal + Service-Karten-Preise (US-20 + US-23).
   - ReviewSection (US-22).
   - Admin-Availability-UI + Admin-Dashboard (US-17 Admin + US-21).
5. **Mail-Templates** parallel (US-24): `bookingConfirmationToCustomer` + `bookingRejectionToCustomer`.

Implementation kann beginnen.

---

## Iteration 4 Design Review

**Modus:** Design QA (vor Code-Erstellung)
**Datum:** 2026-05-02
**Iteration:** 4 (US-25 Kunden-Auth & Portal, US-26 Auftragsübersicht, US-27 Stornierung, US-28 Stripe-Zahlung, US-29 Reviews mit Backend)
**Reviewer:** Senior QA Engineer
**Geprüfte Artefakte:**
- `PROJECT.md` (US-25 bis US-29)
- `ARCHITECTURE.md` §17 (Iteration 4 Detail-Spec)
- `contracts/schema.prisma` v1.4
- `contracts/api-routes.md` v1.4 §11–§20
- `contracts/zod-schemas.ts` v1.4

### Verdict (Kurzfassung)

**Design muss überarbeitet werden.**

Pass-Quote der Akzeptanzkriterien (Testbarkeit gegen Spec): 28/35 (80 %).
Kritische Defekte: **2**, Wichtige: **5**, Minor: **6**.

Die Iteration-4-Spec ist umfangreich, sicherheitsbewusst und behandelt die meisten Race-Conditions explizit (Stripe-Webhook-Idempotenz, UNIQUE auf `reviews.bookingId`, separate Cookie-Namen für Admin/Customer). Drei Subsysteme sind im Großen und Ganzen schlüssig spezifiziert — **aber zwei kritische Lücken müssen vor dem Build geschlossen werden**, weil sie im Live-Betrieb zu Datenverlust bzw. dauerhaft kaputten Konten führen:

1. **BUG-401 (Critical):** Verifikations-Token-Ablauf ist fehlerhaft an `customer_users.createdAt` geknüpft. Resend-Verification erzeugt einen neuen Token, ohne dass das Ablaufkriterium aktualisiert wird → Konto wird nach 24 h **nicht mehr aktivierbar**.
2. **BUG-402 (Critical):** E-Mail-Änderung im Profil ist intern widersprüchlich spezifiziert. „Konto bleibt unter alter E-Mail bedienbar bis zur Verifikation der neuen" lässt sich mit dem aktuellen Schema nicht umsetzen — es gibt keine Pending-E-Mail-Spalte.

Alle anderen Findings sind durch kleine Spec-Edits oder Engineer-Disziplin lösbar; sie sollten in den Engineering-Notes als bekannte Build-Disziplin verankert werden.

### 1. Test-Matrix (Akzeptanzkriterien gegen Spec)

| Story | AC      | Test-Case (gegen Spec)                                                                              | Layer    | Status   | Anmerkung                                                                       |
| ----- | ------- | --------------------------------------------------------------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------- |
| US-25 | AC-1    | Registrierung (Email + Passwort ≥ 8) → Mail mit Verifikationslink                                    | BE       | Pass     | `CustomerRegisterSchema` + Mail-Template `customerVerificationMail`.            |
| US-25 | AC-2    | Klick auf Verifikationslink (max 24 h) aktiviert Konto + Redirect auf `/konto`                       | BE       | **Fail** | **BUG-401**: Token-Ablauf an `createdAt` gekoppelt — bleibt nach Resend stehen. |
| US-25 | AC-3    | Login mit verifizierten Daten → Redirect `/konto`                                                    | BE+FE    | Pass     | `POST /api/customer/login`, JWT-Cookie. Cookie-Name `customer-session`.         |
| US-25 | AC-4    | Falsche Credentials → generische Meldung „E-Mail oder Passwort ungültig"                              | BE       | Pass     | Konstante bcrypt-Last gegen DUMMY-Hash + 401.                                   |
| US-25 | AC-5    | Forgot-Password → Mail mit Reset-Link in 1 h gültig                                                   | BE       | Pass     | Token + Expiry persistiert (`resetTokenExpiry`), Enumeration-Schutz dokumentiert.|
| US-25 | AC-6    | Reset-Link → neues Passwort → Redirect `/konto/login`                                                 | BE       | Pass     | `CustomerResetPasswordSchema` + bcrypt-Hash-Update.                             |
| US-25 | AC-7    | Gastbuchung funktioniert weiterhin                                                                    | BE+FE    | Pass     | `customerId` ist nullable; CreateBookingSchema unverändert.                     |
| US-25 | AC-8    | Eingeloggter Kunde bucht → wird automatisch dem Konto zugeordnet                                      | BE       | Pass     | §15 von `api-routes.md`: Backend liest `customer-session` und befüllt `customerId`.|
| US-25 | AC-9    | Direktaufruf von `/konto/*` ohne Login → Redirect auf `/konto/login`                                  | FE       | Pass     | Middleware §17.1 incl. Public-Whitelist.                                        |
| US-25 | AC-10   | Profil-Update (Name, Telefon, E-Mail) → speichert + Bestätigung                                       | BE+FE    | **Fail** | **BUG-402**: E-Mail-Wechsel ist intern widersprüchlich spezifiziert.            |
| US-26 | AC-1    | `/konto` zeigt zwei Listen: Bevorstehend + Vergangen                                                  | BE+FE    | Pass     | `GET /api/customer/bookings` mit `upcoming/past`-Split.                         |
| US-26 | AC-2    | Eintrag enthält Datum, Uhrzeit, Service, Status-Badge, Preis (wenn vorhanden)                         | BE+FE    | Pass     | `CustomerBookingSchema` + `payment.amount`.                                     |
| US-26 | AC-3    | Status-Badges DE: Offen, Bestätigt, Abgelehnt, Storniert, Gegenvorschlag ausstehend                   | FE       | Pass     | DE-Mapping ist ein FE-Konstante; Status-Enum vollständig.                       |
| US-26 | AC-4    | Detailseite zeigt alle Buchungsdetails inkl. Anhänge + Zahlungsstatus                                  | BE+FE    | Pass     | `GET /api/customer/bookings/:id` liefert vollen `CustomerBookingSchema`.        |
| US-26 | AC-5    | Empty-State + CTA „Ersten Auftrag buchen"                                                              | FE       | Pass     | UI-State in §17.6 dokumentiert.                                                  |
| US-27 | AC-1    | Confirm-Dialog vor Storno                                                                              | FE       | Pass     | UI-State `CancelDialog`.                                                         |
| US-27 | AC-2    | Storno → Status sofort „Storniert", Button verschwindet, Mail an Tom                                   | BE+FE    | Pass     | `POST /api/customer/bookings/:id/cancel` + `cancellationToAdmin`-Template.       |
| US-27 | AC-3    | CONFIRMED-Termin > 24 h → Storno erlaubt, Slot wird wieder frei                                       | BE       | Partial  | **MAJOR-401**: 24-h-Berechnung ist nicht eindeutig DST-fest dokumentiert.       |
| US-27 | AC-4    | CONFIRMED-Termin < 24 h → Button disabled mit Hinweis + Telefonnummer                                  | BE+FE    | Pass     | `isCancellable`-Algorithmus + `cancellableUntilHours: null`-Trigger.            |
| US-27 | AC-5    | Termin in Endstatus / Vergangenheit → kein Storno-Button                                              | BE+FE    | Pass     | `PORTAL_CANCELLABLE_STATUSES`-Whitelist + Datum-Check.                           |
| US-28 | AC-1    | Tom hinterlegt Betrag → Mail an Kunden mit Link zur Zahlungsseite                                     | BE       | Pass     | `POST /api/admin/bookings/:id/payment` + `paymentRequestToCustomer`-Template.   |
| US-28 | AC-2    | `/konto/zahlung/:id` zeigt Auftragsdetails + Betrag + Zahlungsoptionen                                 | FE       | Pass     | UI-State in §17.6 + Stripe-Checkout-Integration.                                 |
| US-28 | AC-3    | „Mit PayPal bezahlen" startet Stripe-Flow                                                              | FE+BE    | Pass     | `payment_method_types: ['card', 'paypal']` in §13.                              |
| US-28 | AC-4    | Apple Pay nur auf kompatiblem Gerät                                                                     | FE       | Pass     | Stripe Checkout rendert Wallet automatisch (Annahme dokumentiert).              |
| US-28 | AC-5    | Google Pay analog                                                                                       | FE       | Pass     | Wie AC-4.                                                                        |
| US-28 | AC-6    | Erfolgreiche Zahlung → Status „Bezahlt" im Admin + Mail an beide Parteien                              | BE       | Pass     | Webhook `checkout.session.completed` setzt PAID + sendet beide Mails.           |
| US-28 | AC-7    | Zahlung fehlgeschlagen → DE-Fehlermeldung + Retry möglich                                              | BE+FE    | Partial  | **MAJOR-402**: Fehler-UX bei Stripe-Embedded-Errors zwischen Submit und Webhook unklar; Polling-Logik der Erfolgsseite ist nicht für Gäste definiert. |
| US-28 | AC-8    | Bezahlt-Badge sichtbar; Zahlungs-Button verschwindet                                                   | FE       | Pass     | UI-State `AlreadyPaid`.                                                          |
| US-29 | AC-1    | COMPLETED-Status → „Bewertung abgeben"-Button in Detailseite                                           | BE+FE    | Pass     | `canReview = (status === 'COMPLETED' && review === null)` aus Backend.          |
| US-29 | AC-2    | Formular: 1–5 Sterne (Pflicht) + optional Text (max 500, Zähler)                                      | FE       | Pass     | `CreateReviewSchema` + UI-State `ReviewForm`.                                    |
| US-29 | AC-3    | Ohne Sterne → Inline-Fehler                                                                              | FE       | Pass     | Zod min(1).                                                                      |
| US-29 | AC-4    | Erfolgreiche Abgabe → Bestätigung + Button disabled                                                    | BE+FE    | Pass     | Response liefert die soeben angelegte Review zurück.                            |
| US-29 | AC-5    | Bereits bewertete Buchung → Read-only-Anzeige                                                          | FE       | Pass     | UI-State `ReviewExisting`.                                                       |
| US-29 | AC-6    | Admin-Moderationsliste mit Approve/Reject                                                              | BE+FE    | Pass     | `GET/PATCH /api/admin/reviews/:id`.                                              |
| US-29 | AC-7    | Tom gibt Bewertung frei → erscheint auf der Startseite                                                 | BE+FE    | Pass     | `GET /api/reviews` filter `approved=true`.                                       |
| US-29 | AC-8    | Bei mind. 4 echten Reviews ersetzen sie die Platzhalter aus IT3                                        | FE       | Partial  | **MINOR-401**: `<ReviewSection>` umgebaut — Migrationsweg von `lib/reviews.ts` zu Live-Daten ist nicht in §17.3 verankert. |

### 2. Kritische Defekte (Blocker — vor Code beheben)

#### BUG-401 (Critical, Design): Verifikations-Token-Ablauf ist nicht resend-fest

**Story:** US-25 AC-1, AC-2
**Layer:** Datenmodell / Backend
**Quellen:** `schema.prisma` Z. 296 (`verificationToken String? @unique`), §17.1 Sicherheits-Praktiken („verificationToken: 24 h (geprüft via createdAt)"), `api-routes.md` Z. 1140–1158 (`POST /api/customer/resend-verification`).

**Beschreibung:**
Die Spec sagt explizit: „Verifikations-Token läuft nach 24 h ab (Backend-Check via `createdAt`, kein dedizierter Expiry-Timestamp — verworfener Token bleibt einfach in der Tabelle)." Gleichzeitig erlaubt `POST /api/customer/resend-verification`, den Token neu zu generieren („neuen `verificationToken` generieren, Mail neu senden") — **ohne** `createdAt` zu aktualisieren (Prisma würde `createdAt` ohnehin nicht überschreiben).

**Konsequenz:**
- Tag 0: Maria registriert sich um 10 Uhr. `createdAt = T0`. Mail kommt nicht an (Spam-Filter).
- Tag 0 + 25 h: Maria klickt „Bestätigungs-E-Mail erneut senden". Backend setzt `verificationToken = newCuid()`, sendet Mail.
- Maria klickt sofort den neuen Link.
- Backend prüft: `now - createdAt > 24h` → 400 „Der Verifikationslink ist ungültig oder bereits verwendet". **Das Konto ist permanent unaktivierbar.**

Maria kann sich nicht erneut registrieren (E-Mail bereits in `customer_users`, AC-1 → 409). Sie kann sich nicht einloggen (`emailVerified: false` → 422 EMAIL_NOT_VERIFIED). Sie kann sich nicht selbst löschen (kein DELETE-Endpoint im MVP). **Sackgasse.**

**Erwartet:**
US-25 AC-1 garantiert „Bestätigungs-E-Mail … Bitte bestätigen Sie Ihre E-Mail-Adresse" — das impliziert, dass eine erneut gesendete Mail **funktional** sein muss.

**Vorschlag:**
- **Empfohlen:** Eigene Spalte `verificationTokenExpiry DateTime?` analog zu `resetTokenExpiry`. Bei `POST /register` und `POST /resend-verification` setzen auf `now + 24h`. Verifikations-Endpunkt prüft gegen diese Spalte. Spec-Edit in `schema.prisma` (1 Feld) + §17.1 + `api-routes.md` Z. 1131 (Verify-Logik) + Z. 1154 (Resend-Logik).
- **Alternative:** `verificationTokenIssuedAt DateTime?` neu, beim Insert/Resend gesetzt, Endpoint prüft `now - verificationTokenIssuedAt > 24h`. Gleicher Effekt, anderer Name.
- **Ohne neue Spalte (NICHT empfohlen):** Bei `resend-verification` zusätzlich `createdAt = now` aktualisieren — verfälscht aber das Audit-Feld, mit dem Tom sehen würde, wann das Konto entstand.

**Routing:** `solution-architect`

---

#### BUG-402 (Critical, Design): E-Mail-Änderung im Profil hat keinen Pending-Mechanismus — Spec ist intern widersprüchlich

**Story:** US-25 AC-10
**Layer:** Datenmodell / Backend
**Quellen:** `api-routes.md` Z. 1102–1108 („`email`-Änderung: setzt `emailVerified: false`, generiert neuen `verificationToken`, sendet Verifikations-Mail an die NEUE Adresse. Bis zur Verifikation funktioniert das Konto **mit der alten E-Mail weiter** …"), `schema.prisma` (kein `pendingEmail`-Feld vorhanden), §17.1 (Spec-Annahme: „Konto bleibt unter alter E-Mail bedienbar, bis neue verifiziert ist").

**Beschreibung:**
`PATCH /api/customer/me` mit neuer E-Mail bekommt zwei zueinander widersprüchliche Anforderungen:

1. **„Konto bleibt unter alter E-Mail bedienbar, bis neue verifiziert ist"** (Annahme §17.10, API-Spec Z. 1106).
2. **„setzt `emailVerified: false`, generiert neuen `verificationToken`"** (API-Spec Z. 1103).

Wenn Punkt 2 wörtlich umgesetzt wird (also die Spalte `email` direkt mit der neuen Adresse überschrieben wird), tritt **eines** der folgenden Probleme auf:

- (a) Login mit alter E-Mail-Adresse schlägt fehl, weil die DB sie nicht mehr kennt (UNIQUE-Lookup mit alter E-Mail → 0 Treffer → 401).
- (b) Login mit neuer E-Mail-Adresse schlägt mit `EMAIL_NOT_VERIFIED` fehl, weil `emailVerified=false` ist.
- (c) Das Customer-JWT enthält die alte E-Mail im Payload (`{ customerId, email }`); ein Server-Side-Decode-Lookup über `me.id` würde noch funktionieren, aber das Cookie wird nach Logout (oder Cookie-Verlust) nutzlos, weil keiner der beiden E-Mail-Werte mehr funktioniert.

→ **Das Konto ist effektiv für Login gesperrt, bis die neue E-Mail verifiziert ist.** Genau das, was die Annahme verhindern wollte.

**Schritte zur Reproduktion (gedanklich gegen Spec):**
1. Maria ist eingeloggt (`customer-session` enthält alte E-Mail).
2. Maria ändert Profil-E-Mail auf neu@example.com → 200 OK, `email = 'neu@example.com'`, `emailVerified = false`.
3. Maria loggt sich aus (oder Cookie läuft ab).
4. Maria versucht Login mit alter E-Mail → 401 (nicht mehr in DB).
5. Maria versucht Login mit neuer E-Mail → 422 EMAIL_NOT_VERIFIED.
6. Maria klickt „Erneut senden" → bekommt Mail an neue Adresse, klickt Link → `emailVerified=true`, kann jetzt einloggen.

→ Funktioniert technisch, **aber nur, wenn die Verifikations-Mail ankommt**. Der Spec-Wortlaut „mit alter E-Mail weiter bedienbar" trifft nicht zu.

**Erwartet:**
- Entweder die Annahme dahingehend korrigieren, dass das Konto ab Profil-Update **gesperrt bleibt**, bis Maria die neue E-Mail verifiziert (Engineers-Hinweis: Maria muss vor Logout verifizieren).
- Oder ein `pendingEmail String?` + `pendingEmailToken String?` einführen, sodass `email` erst nach Verifikation umgesetzt wird. Bis dahin Login mit alter E-Mail weiter möglich.

**Vorschlag:**
- **Empfohlen (Alternative B):** Spec auf das einfachere Modell zurückziehen: „Bei E-Mail-Änderung wird das Konto gesperrt (`emailVerified = false`) bis die neue E-Mail verifiziert ist. Frontend zeigt nach dem Profil-Update den Hinweis ‚Bitte bestätigen Sie Ihre neue E-Mail-Adresse, bevor Sie sich erneut einloggen.‘"
  - Schema-Edit: keiner.
  - API-Spec-Edit: Z. 1106 streichen / umformulieren.
  - Risiko-mindernd: Frontend hindert daran, sich abzumelden, solange Verifikation aussteht (nicht zwingend, aber UX-freundlich).
- **Alternative A (sauberer, aber Mehraufwand):** `pendingEmail` + `pendingEmailToken` + `pendingEmailTokenExpiry`. Verify-Endpoint überschreibt `email = pendingEmail` und löscht alle drei Pending-Felder. Schema bekommt 3 neue Spalten + 1 Index.

**Routing:** `solution-architect`

### 3. Wichtige Defekte (Major — Fix vor Build empfohlen, vom Architekten klären)

#### MAJOR-401 (Major, Design): 24-h-Stornofrist ist nicht DST-fest dokumentiert

**Story:** US-27 AC-3
**Layer:** Backend
**Quelle:** `api-routes.md` Z. 1287–1296 (`isCancellable()`-Algorithmus), §17.7 Race-Conditions („Frontend-Check + Server-Check beide vorhanden; Server-Check ist Authority").

**Beschreibung:**
Der `isCancellable`-Algorithmus berechnet `parseBerlinDateTime(b.date, b.startTime).getTime() - Date.now() > 24*60*60*1000`. Beim DST-Wechsel (letzter Sonntag im März / Oktober) ist ein Berliner Tag 23 oder 25 Stunden lang. Wenn der Termin am Tag des DST-Wechsels liegt:

- März-DST (Spring-forward): „Tom hat um 10 Uhr Berlin am Sonntag einen Termin. Maria will Samstag 10 Uhr stornieren." → Differenz physisch nur 23 h, Algorithmus sieht aber 24 h Berlin-Strings → erlaubt Storno, obwohl in Wirklichkeit < 24 h Echtzeit.
- Oktober-DST (Fall-back): umgekehrt — Frist verstreicht 1 h früher als erwartet.

Das Risiko ist klein (nur 2 Tage/Jahr betroffen), aber spürbar: ein Kunde könnte sich „nur knapp innerhalb der Frist" wähnen und bekommt 409. Oder umgekehrt: er kann „nicht mehr stornieren" laut Frontend, aber Server würde es erlauben.

**Erwartet:**
Die Spec sollte explizit dokumentieren, ob `parseBerlinDateTime` einen UTC-Zeitpunkt erzeugt (richtig) oder eine naïve Berlin-Wall-Clock (falsch).

**Vorschlag:**
- 1-Zeile-Spec-Edit in §17.6 oder §17.7: „`parseBerlinDateTime(date, time)` interpretiert die Berlin-Wall-Clock korrekt und liefert einen UTC-Zeitpunkt (z.B. via `Intl.DateTimeFormat` + `Date.UTC`). DST-Übergänge werden korrekt aufgelöst — ein Termin am 26.10.2025 02:30 Berlin existiert zweimal; im MVP wird die spätere Belegung gewählt." Engineers übernehmen das in `parseBerlinDateTime()`.
- Engineering-Test: 2 explizite Test-Cases im Test-Plan §17.8 ergänzen (Spring-forward + Fall-back).

**Routing:** `solution-architect`

---

#### MAJOR-402 (Major, Design): `/konto/zahlung/erfolg` Polling-Logik fehlt für Gäste

**Story:** US-28 AC-6, AC-7
**Layer:** Frontend / Backend
**Quelle:** §17.6 UI-State `WaitingWebhook` („Page polled `/api/customer/bookings/:id`"), §13 `cancel_url` und `success_url`, `api-routes.md` Z. 1494 (`success_url: ${BASE_URL}/konto/zahlung/erfolg?session_id=...`).

**Beschreibung:**
Die Erfolgsseite `/konto/zahlung/erfolg` polled laut §17.6 `GET /api/customer/bookings/:id` — dieser Endpunkt erfordert Customer-Session. Aber die Stripe-Integration erlaubt auch **Gäste**: Tom kann einem nicht-registrierten Kunden via `cancelToken` eine Zahlungsseite schicken. Wenn dieser Gast nach erfolgreicher Stripe-Zahlung auf `/konto/zahlung/erfolg?session_id=...` landet, hat er kein `customer-session`-Cookie:

- Polling auf `GET /api/customer/bookings/:id` → 401 → Page bricht ab oder hängt.
- Auf `/konto/auftrag/:id` (Detail) klicken → Middleware-Redirect auf `/konto/login` → Login-Hürde, obwohl Gast-Konto gar nicht existiert.

**Konsequenz:** Gäste sehen nach Zahlung keine saubere Erfolgsbestätigung. Spec ist hier lückenhaft.

**Erwartet:**
- Entweder: Erfolgsseite zeigt für Gäste eine reduzierte Bestätigung („Vielen Dank, Ihre Zahlung wurde verarbeitet. Tom wurde benachrichtigt.") **ohne Polling**.
- Oder: ein öffentlicher Status-Endpoint `GET /api/payments/by-session?session_id=...` (kein Login nötig, Stripe-Session-ID ist tokenartig).
- Oder: Polling per `cancelToken`-Auth — analog zu `POST /api/payments/create-session` Auth-Fallback.

**Vorschlag:**
- Spec ergänzen in §17.6 (UI-State `WaitingWebhook`): „Wenn kein Customer-Cookie vorhanden ist, zeigt die Erfolgsseite die statische Meldung ‚Vielen Dank, Ihre Zahlung wurde übermittelt. Eine Bestätigung erhalten Sie per Mail‘ — kein Polling. Mit Cookie polled die Page `/api/customer/bookings/:id`."
- Engineering-Test in §17.8: „Stripe-Erfolg ohne Login → Erfolgsseite zeigt statische Meldung, keine 401-Fehler".

**Routing:** `solution-architect`

---

#### MAJOR-403 (Major, Design): Schema-Inkonsistenz — `Review.customerName` wird in der Zod-Spec verlangt, aber im DB-Schema fehlt sie

**Story:** US-29 AC-7, AC-8
**Layer:** Datenmodell / Contract
**Quellen:**
- `zod-schemas.ts` Z. 989–1001 (`ReviewSchema.customerName: z.string()`).
- `zod-schemas.ts` Z. 1010 (`PublicReviewSchema.customerName: z.string()`).
- `schema.prisma` Z. 408–429 (`Review`-Modell — **kein** `customerName`-Feld).
- `schema.prisma` Z. 380–388 (Doc-Block: „Engineers persistieren daher `customerName` (Snapshot) bei der Review-Erstellung. Diese Snapshot-Spalte ist aktuell **nicht** im Schema").

**Beschreibung:**
Die Zod-Schemas verlangen `customerName` in der API-Antwort (für Admin-Moderation und öffentliche Reviews). Das Prisma-Modell hat aber **kein** `customerName`-Feld auf `Review`. Spec sagt: live-Join mit `CustomerUser.firstName + lastName[0]`. Aber:

- **Konto-Löschung-Pfad:** Wenn `CustomerUser` gelöscht wird → `Review.customerId` per `SET NULL` → kein Join möglich → öffentliche `GET /api/reviews` würde `customerName` als leeren String oder Fallback liefern. Der Doc-Block selbst sagt: „Engineers ergänzen Snapshot-Spalte, falls Konto-Löschung implementiert wird" — aber bis dahin ist die DB-Schema-Spec unvollständig: die `ReviewSchema` Pflicht-Spalte hat keinen DB-Backup.
- **Test-Story-Pfad:** US-29 AC-7 sagt „Bewertung erscheint auf der Startseite". `<ReviewSection>` zeigt Reviews mit Name. Wenn der Kunde kein registriertes Konto hat (was im MVP nicht passiert, aber theoretisch durch `customer_id?` möglich ist), gibt es keinen Namen.

Aktueller Zustand ist ein Spec-Widerspruch: Zod sagt „immer present", Prisma sagt „nicht persistiert". Engineers können das **erst** beim Build entscheiden — dabei drohen Inkonsistenzen zwischen Frontend (rendert `customerName` immer) und Backend (kann ihn nicht garantieren).

**Erwartet:**
Eindeutige Spec, ob (a) `Review.customerName` als Snapshot persistiert wird oder (b) im API-Layer durchgängig joined wird und Konto-Löschung im MVP ausgeschlossen ist.

**Vorschlag:**
- **Empfohlen:** `Review` bekommt `customerName String` (Snapshot bei Review-Erstellung, Format „Vorname Nachname"). Backend kürzt für `GET /api/reviews` auf „Vorname N.". Damit ist die Anzeige konto-unabhängig stabil. Schema-Edit + 1-Zeile in §17.5.
- **Alternative:** Spec explizit auf „MVP hat keine Konto-Löschung" festlegen (steht schon in §17.7), und im `ReviewSchema` `customerName` aus dem Live-Join herleiten. Engineers-Hinweis: bei `customerId === null` muss ein Default („Anonym") greifen.

**Routing:** `solution-architect`

---

#### MAJOR-404 (Major, Design): `isCancellable()` ist nicht null-fest gegen Bestandsbuchungen

**Story:** US-27
**Layer:** Backend
**Quelle:** `api-routes.md` Z. 1287–1296 (`isCancellable`-Algorithmus referenziert `b.date`, `b.startTime`).

**Beschreibung:**
`isCancellable()` greift direkt auf `b.date` und `b.startTime` zu, ohne null-Check. In der Praxis (IT4) sollten Bestandsbuchungen (IT1/IT2 Slot-basiert, mit `slotId` und `date=null`) **nie** im Customer-Portal erscheinen, weil sie keinen `customerId` haben. Aber:

- Die Filterung in `GET /api/customer/bookings` ist `where: { customerId: me.id }` — Bestandsbuchungen mit `customerId` (theoretisch falls Tom oder ein Engineer `customerId` manuell setzt) würden auftauchen.
- Wenn die Frist-Logik `parseBerlinDateTime(null, null)` aufruft → NaN-Vergleich → `> 24*60*60*1000` ist `false` → Storno gesperrt → Customer hängt fest.

Spec sollte robust sein: `if (!b.date || !b.startTime) return false` als Vorab-Check, oder die Customer-Portal-Query explizit auf `date IS NOT NULL` filtern.

**Erwartet:**
Algorithmus dokumentiert das Null-Verhalten oder fängt es ab.

**Vorschlag:**
- In §17.7 oder API-Spec Z. 1289 ergänzen: „`isCancellable` setzt `date` und `startTime` voraus. Für Bestandsbuchungen ohne Date/Time-Felder gibt die Funktion `false` zurück." Engineers fügen 1 Zeile im Code ein.

**Routing:** `solution-architect`

---

#### MAJOR-405 (Major, Design): Open-Redirect-Schutz für `/konto/login?callbackUrl=...` fehlt

**Story:** US-25 AC-9
**Layer:** Frontend / Middleware
**Quelle:** `api-routes.md` §11 (Customer-Auth — kein Hinweis auf callbackUrl-Validation), ARCHITECTURE.md §5 BUG-005 (Admin-Login-Schutz), §17.1 Middleware (`loginUrl.searchParams.set('callbackUrl', pathname)` — schreibt, aber liest nicht später validierend).

**Beschreibung:**
Die Customer-Middleware leitet Unauthentifizierte mit `?callbackUrl=<pathname>` auf `/konto/login`. Beim Login erfolgt im Frontend dann die Weiterleitung an `callbackUrl`. Spec dokumentiert **nicht**, dass nur relative Pfade akzeptiert werden — analog BUG-005 für Admin.

**Konsequenz:** Phishing-Angriff via `https://baerenstark.de/konto/login?callbackUrl=https://evil.example/clone-login` möglich.

**Erwartet:**
Der Login-Erfolgs-Redirect validiert callbackUrl strikt (relativ oder selbe Origin). Sonst Default `/konto`.

**Vorschlag:**
- Spec-Edit in §17.1 nach dem Middleware-Pseudocode: „Frontend (`LoginForm.tsx`) validiert `callbackUrl` analog zu `auth.config.ts.callbacks.redirect` (nur relative Pfade ODER selbe Origin; sonst Fallback auf `/konto`)."
- 1 Hilfs-Funktion `safeCustomerCallback(url)` in `lib/customer-auth.ts`.

**Routing:** `solution-architect`

### 4. Minor-Findings (nicht-blocking)

- **MINOR-401 (FE/Design):** §17.3 erwähnt `<ReviewSection>` umgebaut, aber der Migrationsweg von `lib/reviews.ts` zur Live-API ist nicht detailliert. AC US-29 AC-8 verlangt aber einen klar geregelten Übergang (≥ 4 approved → echt; sonst Fallback). Empfehlung: 1-Zeile in §17.3 — „Engineers behalten `lib/reviews.ts` als Fallback bei `total < REVIEW_MIN_APPROVED_TO_REPLACE_STATIC`."
- **MINOR-402 (Sicherheit):** Gemeinsame `AUTH_SECRET` für NextAuth-Admin und Customer-JWT. Da Cookie-Namen verschieden sind und Middleware sauber trennt, ist die praktische Angriffsfläche null — defense-in-depth wäre aber zwei separate Secrets (`CUSTOMER_AUTH_SECRET`). Spec empfiehlt das bereits als Option (§17.9). Empfehlung: Engineering-Hinweis, dass das in der Production-Konfig **vorgenommen** werden soll.
- **MINOR-403 (Sicherheit):** Customer-JWT-Payload enthält `email` — bei Profil-E-Mail-Wechsel (BUG-402) wird das Cookie nicht rotiert; das Cookie bleibt 7 Tage gültig mit altem `email`-Claim. Konsequenz hängt mit BUG-402 zusammen — ohnehin bei Architekt-Klärung mit erledigt.
- **MINOR-404 (Sicherheit):** `resetToken` wird bei jedem Forgot-Password-Aufruf überschrieben (`resetToken @unique`). Wenn ein Angreifer mit Mail-Zugriff einen Reset auslöst, bevor der echte Kunde es bemerkt, würde das den Reset-Link rotieren. Akzeptabel, aber Spec könnte das als bewusste Entscheidung dokumentieren (§17.1).
- **MINOR-405 (Idempotenz):** Stripe-Webhook-Idempotenz nutzt Status-Check. Best-Practice wäre zusätzlich `Stripe-Event-ID` deduplizieren (z.B. `processed_stripe_events` Tabelle). Status-Check reicht im MVP, weil unsere Übergänge monoton sind, aber die Spec sollte das ausdrücklich vermerken (§17.4).
- **MINOR-406 (Datenschutz):** §17.7 Datenschutz-Block dokumentiert „Reviews mit Konto-Löschung bleiben sichtbar". Aber DSGVO-Recht-zur-Löschung verlangt theoretisch Entfernung personenbezogener Daten. Wenn ein Kunde explizit Löschung anfordert, muss Tom in Prisma Studio die Review **selbst** löschen oder anonymisieren. Spec sollte das erwähnen (1-Zeilen-Note).

### 5. Vertrags-Mismatches (FE/BE-Sicht)

Keine Field-Name-Mismatches zwischen `zod-schemas.ts` und `api-routes.md` gefunden — die Zod-Schemas sind die Quelle der Wahrheit, und alle dokumentierten Endpoints verwenden die korrekten Schema-Imports. **Ausnahme:** `Review.customerName` (siehe MAJOR-403).

Status-Codes / Fehlerformat:
- `EMAIL_NOT_VERIFIED` (422) ist konsistent in `ApiErrorSchema`-Enum + API-Spec + UI-State.
- `STRIPE_ERROR` (502) konsistent in `ApiErrorSchema`-Enum + `POST /api/payments/create-session`.
- Customer-spezifische 401/404-Strategie („404 statt 403 bei Fremdzugriff") ist in §17.7 dokumentiert und in den Endpoints einheitlich.

### 6. Anforderungs-Lücken

- **GAP-401:** Spec erwähnt im AC US-28 AC-6 „Beide Parteien erhalten eine Zahlungsbestätigung per E-Mail". Mail-Templates `paymentReceivedToCustomer` + `paymentReceivedToAdmin` sind in §17.5 gelistet — Inhalte sind aber nicht weiter detailliert. Engineers sollen das analog zu IT2/IT3-Templates lösen — 1-Zeile-Note ausreichend.
- **GAP-402:** US-28 AC-7 (Fehlerfall-DE-Meldung): Spec sagt nur „deutschsprachige Fehlermeldung". UI-State `Failed` in §17.6 sagt „Letzte Zahlung fehlgeschlagen — bitte erneut versuchen". Welche Stripe-Fehler werden mit DE-Texten gemappt (Karten-Abweisung, 3DS-Fail, etc.)? Im MVP wahrscheinlich akzeptabel mit generischer Message — Spec sollte das explizit als Annahme verankern.
- **GAP-403:** US-29 AC-8 sagt „Platzhalter werden ersetzt". Aber: was passiert mit `<ReviewSection>` zwischen 1 und 3 echten approved Reviews (also mehr als 0, weniger als 4)? Spec REVIEW_MIN_APPROVED_TO_REPLACE_STATIC=4 bedeutet: bis 3 echte Reviews → 100% statisch. Das ist eine harte Schwelle, die Frontend nicht erklären muss. OK, aber sollte als bewusste Entscheidung dokumentiert sein.
- **GAP-404:** Tom kann eine Buchung als COMPLETED markieren (PATCH-Bookings). Aber: gibt es einen Hinweis, **welcher** Kunde Tom dazu auffordert (z.B. Mail an Tom „Heute ist Marias Termin — bitte als COMPLETED markieren")? Spec §17.10 sagt: „manuelle Markierung via Admin-UI". Akzeptabel als MVP-Pragmatismus, aber Engineers sollten im Test-Plan §17.8 das auch testen (heute keine Erinnerung — Tom muss aktiv).

### 7. Out-of-Scope-Findings

Keine.

### 8. Nicht-funktionale Findings

- **Sicherheit:** bcrypt cost 10, Cookie-Flags, Stripe-Signatur-Check, Enumeration-Schutz, Ownership-Check (404 statt 403) — alles sauber spezifiziert. Open-Redirect-Schutz fehlt für Customer (MAJOR-405).
- **Rate-Limits:** Auth-Endpoints, Reviews, Payments — alle dokumentiert (§20). Reasonably restrictive ohne übermäßig hart.
- **Observability:** Webhook-Fehler werden geloggt; Mail-Status pro Booking persistiert (Bestand IT2). Spec für Stripe-Webhook-Logs nicht detailliert — Engineers sollen analog zu §17.4 strukturierte Logs (event.id, type, durations) hinzufügen.
- **Performance:** Indexe sind in §17.2 erwähnt; `@@index([customerId, date])` auf `bookings` ist vorhanden. `@@index([approved, createdAt])` auf `reviews` für `GET /api/reviews`. PASS.
- **Accessibility:** Stripe-Checkout ist eine externe Page — wir haben keinen Einfluss auf deren a11y. Eigene Customer-Pages sollten sich an die IT3-Tailwind/Radix-UI-Pattern halten (§9). Spec erwähnt das nicht explizit — Engineers sollen die a11y-Checkliste aus IT3 weiterführen.

### 9. Empfehlungen für die nächste Iteration

- **Build-Disziplin:** Engineers müssen vor dem ersten Commit die Architekt-Antworten zu BUG-401 und BUG-402 abwarten. Beide sind Schema-relevant, also kostet eine spätere Korrektur eine Migration.
- **Reihenfolge im Build:**
  1. **Schema-Migration** (US-25/26/28/29): nach BUG-401/BUG-402-Klärung. Erst dann `prisma migrate dev`.
  2. **Customer-Auth** (US-25, isoliert): Helper-Funktionen, Endpoints, Pages, Middleware-Erweiterung.
  3. **Customer-Portal Read-Only** (US-26): `GET /api/customer/bookings` + `/konto`-Page + `/konto/auftrag/:id`.
  4. **Customer-Portal Write** (US-27): Storno-Endpoint + UI.
  5. **Stripe-Integration** (US-28): erstmal `POST /api/admin/bookings/:id/payment` + `paymentRequestToCustomer`-Mail. Dann `create-session` + Webhook + Test-Flow mit Stripe CLI.
  6. **Reviews** (US-29): zuletzt — keine Abhängigkeit auf Stripe, aber abhängig von COMPLETED-Status (PATCH-Erweiterung).
- **Test-Plan ergänzen:** DST-Test (MAJOR-401), Resend-Verification-nach-25h-Test (BUG-401), Profil-E-Mail-Wechsel-Login-Pfad (BUG-402), Gast-Erfolgsseite (MAJOR-402).
- **Sicherheits-Audit nach Stripe-Integration:** Webhook-Endpoint mit unsigniertem POST testen; ohne `STRIPE_WEBHOOK_SECRET`-Konfig testen (sollte konfig-Fehler werfen, nicht offen sein).

### 10. Sign-off-Checkliste

- [ ] **BUG-401 (Critical) — Verifikations-Token-Ablauf:** Architekt entscheidet zwischen `verificationTokenExpiry`-Spalte (empfohlen) oder Resend-aktualisiertes `createdAt`. Schema + §17.1 + API-Spec angepasst.
- [ ] **BUG-402 (Critical) — E-Mail-Profil-Update:** Architekt entscheidet zwischen „Konto wird gesperrt bis Verifikation" (Spec-Edit) oder `pendingEmail`-Schema-Erweiterung. API-Spec Z. 1102–1108 angepasst.
- [ ] **MAJOR-401 — DST-Verhalten** in §17.6/17.7 dokumentiert.
- [ ] **MAJOR-402 — Erfolgsseiten-Logik für Gäste** in §17.6 dokumentiert.
- [ ] **MAJOR-403 — `Review.customerName`-Quelle** entschieden + Schema-Edit (falls Snapshot-Variante) oder Annahme dokumentiert (falls Live-Join).
- [ ] **MAJOR-404 — `isCancellable` Null-Verhalten** in API-Spec dokumentiert.
- [ ] **MAJOR-405 — Customer-Login-Open-Redirect-Schutz** spezifiziert.
- [ ] (Empfohlen, nicht-blocking) MINOR-401 bis MINOR-406 als Engineering-Notes erfassen.

### Finales Urteil (Iteration 4)

**Design muss überarbeitet werden.**

Es gibt **zwei echte Blocker** (BUG-401, BUG-402), bei denen Schema- und API-Spec-Anpassungen vor dem Build erforderlich sind. Beide sind klein im Code-Aufwand (1–3 Spalten / 1 Pseudocode-Block), aber sie erfordern explizit eine Architekt-Entscheidung — Engineers können das nicht inline klären, weil es um Datenmodell-Form geht.

Sobald diese zwei Defekte behoben sind, sind die fünf Major-Findings als Spec-Klarstellungen lösbar (1–5 Zeilen je Defekt). Das Subsystem-Design (Kunden-Auth getrennt vom Admin-Auth, Stripe-Checkout statt Elements, Admin-moderierte Reviews) ist überzeugend und sicherheitsbewusst.

Sobald BUG-401 und BUG-402 entschieden sind, kann der Build starten — die Major-Findings können parallel zur Implementierung als kleine Spec-Edits eingespielt werden.

**Empfohlene nächste Schritte:**
1. Architekt entscheidet BUG-401 + BUG-402 (Spec-Edit, kein Code).
2. Architekt klärt MAJOR-401 bis MAJOR-405 (Spec-Edit, kein Code).
3. QA re-reviewt **nur die geänderten Abschnitte** (10 min).
4. Bei „Design freigegeben" → Implementation-Start (Reihenfolge oben).

### Zweite Review (v1.4.1)

**Modus:** Design QA — Re-Review nach Architekt-Revision
**Datum:** 2026-05-02
**Reviewer:** Senior QA Engineer
**Geprüfte Artefakte (v1.4.1):**
- `contracts/schema.prisma` v1.4.1
- `contracts/api-routes.md` v1.4.1
- `contracts/zod-schemas.ts` v1.4.1
- `ARCHITECTURE.md` §17 (insb. §17.1, §17.5, §17.6, §17.7, §17.8 + Änderungslog v1.4.1)

#### Verdict (Kurzfassung)

**Design freigegeben.**

Alle 2 kritischen Defekte und alle 5 Major-Findings aus der ersten Review sind sauber, konsistent und über alle drei Contract-Artefakte hinweg synchron behoben. Es wurden **keine** neuen kritischen oder Major-Probleme durch die Fixes eingebracht. Die Schema-Änderung beschränkt sich auf eine einzige neue Spalte (`verificationTokenExpiry`) — der Build kann ohne weitere Architekt-Loops starten.

#### Re-Check der kritischen Defekte

**BUG-401 — Verifikations-Token-Ablauf (Status: ✅ Pass)**

| Prüfpunkt                                                                                      | Quelle                                          | Status |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------ |
| Neue Spalte `verificationTokenExpiry DateTime?` im Schema                                       | `schema.prisma` Z. 326–331                      | ✅     |
| Spalte ist nullable und wird nach erfolgreicher Verifikation auf NULL gesetzt                   | `schema.prisma` Doc-Block + `api-routes.md` Z. 1194 | ✅     |
| Registrierung setzt `verificationTokenExpiry = now + 24h`                                      | `api-routes.md` Z. 988                          | ✅     |
| `POST /api/customer/resend-verification` setzt **beide** Felder in einer Transaktion            | `api-routes.md` Z. 1220–1227                    | ✅     |
| Verify-Endpoint prüft `verificationTokenExpiry > now`, NICHT mehr `createdAt`                   | `api-routes.md` Z. 1188–1193                    | ✅     |
| `createdAt` bleibt unverändert (Audit-Feld intakt)                                              | `api-routes.md` Z. 1225                         | ✅     |
| Engineering-Hinweis im Architecture-Doc, dass `createdAt` nicht mehr für Ablauf benutzt werden darf | ARCHITECTURE.md §17.1 (Sicherheits-Praktiken)   | ✅     |
| Pflicht-Test im Test-Plan §17.8 ergänzt (25h-Resend-Szenario)                                   | ARCHITECTURE.md §17.8 (Zeile „BUG-401 Resend")  | ✅     |
| Mail-Template-Doc dokumentiert, dass `customerVerificationMail` aus beiden Triggern den Expiry mit-aktualisiert | ARCHITECTURE.md §17.5                           | ✅     |
| Migration-Hinweis (kein Backfill nötig, alte unverifizierte Konten brauchen Resend)             | ARCHITECTURE.md Änderungslog v1.4.1, Z. 29       | ✅     |

Maria-Szenario re-walked: Registrieren → 25h warten → Resend → Token-Klick → `verificationTokenExpiry = now + 24h` ist jetzt frisch → Verify ist erfolgreich. **Sackgasse beseitigt.**

---

**BUG-402 — E-Mail-Änderung im Profil (Status: ✅ Pass)**

| Prüfpunkt                                                                                       | Quelle                                          | Status |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------ |
| `CustomerProfileUpdateSchema` enthält **kein** `email`-Feld                                      | `zod-schemas.ts` Z. 818–824                     | ✅     |
| Schema ist `.strict()` — unbekannte Felder werfen 400 `VALIDATION_ERROR`                         | `zod-schemas.ts` Z. 824                         | ✅     |
| API-Spec dokumentiert die Strict-Validation explizit (mit `email` als Beispiel)                  | `api-routes.md` Z. 1133–1156                    | ✅     |
| Frontend-Hinweis (Profil-Form: E-Mail read-only mit Erklär-Text)                                 | `api-routes.md` Z. 1157–1159                    | ✅     |
| Architecture-Begründung dokumentiert, warum Pending-Mechanismus erforderlich wäre                | ARCHITECTURE.md §17.1 (Profil-E-Mail-Änderung)  | ✅     |
| `customerEmailChangedMail`-Template aus §17.5 entfernt + Backlog-Hinweis hinterlegt              | ARCHITECTURE.md §17.5 Z. 2414–2417              | ✅     |
| Backlog-Eintrag „Pending-State-Mechanismus für E-Mail-Änderung" in §17.10 verankert              | ARCHITECTURE.md §17.10 Z. 2755–2759             | ✅     |
| Schema-Doc-Block referenziert die Backlog-Story                                                  | `schema.prisma` Z. 297–305                      | ✅     |
| Pflicht-Test im Test-Plan §17.8 ergänzt (PATCH mit `email` → 400, mit `firstName` → 200)         | ARCHITECTURE.md §17.8 (Zeile „BUG-402 Profile") | ✅     |
| Notbehelf für Tom (manuelle Korrektur via Prisma Studio) im Doc verankert                        | `schema.prisma` Z. 305 + ARCHITECTURE.md §17.1  | ✅     |

Der frühere intern widersprüchliche Spec-Wortlaut „Konto bleibt unter alter E-Mail bedienbar" ist **vollständig** entfernt. Der Trade-off (Komfort vs. Schema-Mehraufwand) ist transparent zugunsten der einfachen, sicheren Variante entschieden.

#### Re-Check der Major-Findings

**MAJOR-401 — DST-Festigkeit der 24-h-Stornofrist (Status: ✅ Pass)**

- ARCHITECTURE.md §17.7 hat einen eigenen Block „Storno-Frist-Algorithmus — Berlin-Zeitzone & DST" (Z. 2593–2642).
- `parseBerlinDateTime()` ist explizit über `fromZonedTime` aus `date-fns-tz` definiert; DST-Verhalten ist sowohl für Spring-forward als auch Fall-back textuell **und** als Pseudocode dokumentiert.
- Die intuitive Tom-Lesart („physische 24 h echte Vorlaufzeit") ist als bewusste Designentscheidung markiert; die alternative Interpretation („Kalender-24h") wird ausdrücklich verworfen.
- Zwei explizite Pflicht-Tests in §17.8 (29.03.2026 / 26.10.2026).
- API-Spec Z. 1359–1414 zeigt die `isCancellable`-Implementierung mit den richtigen Helper-Aufrufen — konsistent zu §17.7.

**MAJOR-402 — Erfolgsseite für Gäste (Status: ✅ Pass)**

- Neuer öffentlicher Endpoint `GET /api/payments/session-status?session_id=...` (`api-routes.md` Z. 1637–1694).
- Sicherheits-Begründung: Stripe-Session-IDs sind hochentropisch / token-artig; Endpoint liefert ausschließlich `{ sessionId, status, paidAt, bookingId }` — kein PII (`api-routes.md` + ARCHITECTURE.md §17.7 „Stripe-Session-Status-Endpoint").
- Schema neu in `zod-schemas.ts`: `SessionStatusQuerySchema` mit Pattern-Validation `^cs_(test|live)_[A-Za-z0-9]+$` (Z. 996–1001), `SessionStatusSchema` (Z. 1016–1023).
- Frontend-Polling konstanten zentral festgelegt (`PAYMENT_SESSION_POLL_MAX_ATTEMPTS = 5`, `PAYMENT_SESSION_POLL_INTERVAL_MS = 1000`, Z. 1030–1031), Rate-Limit synchron auf 60 / 5 min / IP (api-routes.md §20).
- UI-States in §17.6 dokumentieren WaitingWebhook, Success, Failed, StillProcessing **und** NotFound (Race-Case), inkl. Gäste-Erkennung über `/api/customer/me`-Probe.
- Pflicht-Test in §17.8 (Stripe-Checkout ohne Login → keine 401-Fehler).
- **Race-Robustheit verifiziert:** Im Endpoint-Verhalten wird `stripeSessionId` in `POST /api/payments/create-session` Schritt 5 **vor** dem Return der URL gesetzt — d.h. wenn der Browser auf `/erfolg` landet, ist der DB-Eintrag schon vorhanden. Der `NotFound`-Fallback im UI ist trotzdem für den seltenen Race korrekt vorgesehen.

**MAJOR-403 — `Review.customerName` Schema-Inkonsistenz (Status: ✅ Pass)**

- Klare Architekten-Entscheidung: **kein DB-Feld**, Live-Join im Response-Mapper.
- Code-Skizze in ARCHITECTURE.md §17.7 „Review-Anzeigename" (Z. 2682–2714) zeigt vollständige Mapper-Funktion mit Fallback `'Anonym'`.
- API-Spec dokumentiert die Berechnung in `GET /api/reviews` (Z. 1808–1812) und `GET /api/admin/reviews` (Z. 1862–1865), inklusive der Unterschiedlichkeit (öffentlich gekürzt vs. Admin volltändig).
- Schema-Doc-Block in `schema.prisma` Z. 420–434 hat den expliziten Hinweis, dass `customerName` **nicht** persistiert wird, sowie die Zukunfts-Bedingung für Snapshot-Spalte (falls Self-Service-Account-Delete kommt).
- Zod-Schemas (`ReviewSchema.customerName`, `PublicReviewSchema.customerName`) bleiben Pflicht-Strings — der Mapper garantiert immer einen Wert (entweder „Vorname N.", „Vorname Nachname" oder „Anonym"). **Kein Schema-Null-Risiko mehr.**
- DSGVO-Hinweis in §17.7 Datenschutz-Abschnitt (Z. 2567–2582) dokumentiert manuelles Löschen via Prisma Studio + automatischen `'Anonym'`-Fallback.
- Pflicht-Test in §17.8 (Review mit `customerId = NULL` → kein 500, sondern `'Anonym'`).

**MAJOR-404 — `isCancellable()` Null-Robustheit (Status: ✅ Pass)**

- Explizite Helper-Funktion `bookingStartUTC()` in API-Spec (Z. 1371–1375) UND ARCHITECTURE.md §17.7 (Z. 2650–2654) — **identisch**, kein Drift.
- Drei Eingangsfälle dokumentiert: `date+startTime` (IT3+, DST-fest), `slot.startsAt` (IT1/IT2-Bestand, UTC), und **null** (defensiv `true` zurückgeben, Server bleibt Authority via 24h-Frist im POST-Cancel).
- Pflicht-Test in §17.8 (Slot-Bestand-Buchung mit `date = null`, `slot.startsAt 26h` in der Zukunft → cancellable).
- **Hinweis (akzeptabel, nicht-blocking):** Die Wahl, bei unbekanntem Termin defensiv `true` zurückzugeben (statt `false`), ist eine klare Architekten-Entscheidung mit Begründung („Kunde nicht in Sackgasse, Server prüft nochmal"). Ein Restrisiko (Cancel-Endpoint mit ebenfalls `bookingStartUTC === null`) muss Engineers im Cancel-Endpoint sauber behandeln; das war bereits in der ersten Review als „Engineer-Disziplin" markiert. Die API-Spec für `POST /api/customer/bookings/:id/cancel` Z. 1455–1462 ruft `isCancellable()` auf und antwortet 409 — sollte ein null-Termin durchschlüpfen, wird er hier **fälschlich erlaubt**. **Nicht blockierend**, aber engineering-Hinweis: Cancel-Endpoint sollte `bookingStartUTC === null` analog zur Frontend-Authority-Regel als 409 zurückweisen ODER Status-Update durchwinken (defensiver Default → 200). Die Spec lässt beide Lesarten zu — Engineer kann das in der Pull-Request-Review zur Sprache bringen.

**MAJOR-405 — Open-Redirect-Schutz für Customer-Login (Status: ✅ Pass)**

- Helper `safeCustomerCallback()` mit vollständigem Pseudocode in ARCHITECTURE.md §17.1 (Z. 2182–2203). Validierung deckt Schema, protokoll-relativ (`//evil.example`), Whitespace, Backslash, Backtick und Längen-Sanity ab.
- API-Spec dokumentiert die Validation an drei Wirkungsstellen: Login-Body, Login-Response, Middleware-Redirect (Z. 2205–2211).
- `CustomerLoginSchema` akzeptiert optional `redirectUrl` (`zod-schemas.ts` Z. 776).
- Neuer `CustomerLoginResponseSchema` enthält geprüften `redirectUrl`-Wert (Z. 848–850) — Frontend nutzt diesen ohne weitere Prüfung.
- Pflicht-Tests in §17.8: Externe URL → Fallback `/konto`, protokoll-relativ → Fallback, gültiger Pfad → durchgereicht. Plus separater Unit-Test für `safeCustomerCallback` mit 6 Eingaben.
- Architecture §17.7 referenziert konsistent das Pattern aus BUG-005 (Admin-Login).

#### Querprüfung — neue Risiken durch die Fixes?

| Bereich                                                                                       | Befund                                                                                            |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Schema-Migration (`verificationTokenExpiry`)                                                   | Eine neue nullable Spalte — keine Datenverlustgefahr; kein Backfill (alte Konten brauchen Resend). |
| `CustomerLoginResponseSchema` extends `CustomerUserPublicSchema`                               | Konsistenz geprüft: Login-Response und Me-Response teilen die Felder; keine Drift.                |
| `SessionStatusSchema` ist öffentlich, enthält `bookingId` (nicht-nullable)                     | `Payment.bookingId` ist `@unique` und CASCADE — kein Null-Risiko. Gäste ignorieren das Feld.      |
| `PaymentSchema` Reihenfolge der Felder im Response                                             | Konsistent zwischen `BookingAdminSchema.payment` (api-routes-Beispiele) und Stand-Alone-Response. |
| `Review`-Mapper für Admin vs. öffentlich                                                       | Klarer Split (gekürzt vs. volltändig) — keine Vermischung. Cache-Header korrekt verschieden.       |
| Mail-Templates                                                                                 | `customerEmailChangedMail` ist sauber entfernt, kein Trigger-Pfad mehr. Andere Templates unverändert. |
| Test-Plan §17.8                                                                                | 8 neue Tests für die Fixes — gute Abdeckung; Engineers haben klare Akzeptanzkriterien.             |
| API-Versionierung                                                                              | Versionsbump auf v1.4.1 in allen drei Contract-Files identisch.                                    |

**Keine** neuen Inkonsistenzen, Contract-Drifts oder Sicherheitslücken festgestellt.

#### Restliche Minor-Findings

- **MINOR-401 (FE/Design)** — Migrationsweg `lib/reviews.ts` → Live-API: API-Spec Z. 1797–1798 referenziert jetzt `REVIEW_MIN_APPROVED_TO_REPLACE_STATIC = 4` als Schwelle, FE-Komponenten-Tabelle in §17.3 markiert `<ReviewSection>` als „UMGEBAUT" mit Fallback. **Hinreichend für Build.**
- **MINOR-402 bis MINOR-406** — Engineering-Hinweise (separate Customer-Secret, Cookie-Rotation bei E-Mail-Wechsel ist mit BUG-402-Fix obsolet, `resetToken`-Rotation, Stripe-Event-ID-Idempotenz, DSGVO-Manual-Delete) — alle als Backlog/Engineering-Notes belassen, **kein Build-Blocker**.

Eine kleine ergänzende Beobachtung (nicht-blocking, Engineering-Note für die Implementierung): Im POST-Cancel-Endpoint sollte der Server beim Aufruf von `isCancellable()` bei `bookingStartUTC === null` defensiv entscheiden — die Spec lässt beide Lesarten offen. Empfehlung in Engineer-PR-Review: bei null-Start → 409 mit Hinweis „Termin nicht eindeutig — bitte telefonisch melden", konsistent zur sonstigen Authority-Logik.

#### Sign-off-Checkliste (Re-Check)

- [x] **BUG-401** — Schema, Register-, Resend-, Verify-Endpunkt + ARCHITECTURE + Test ✓
- [x] **BUG-402** — Strict-Schema, API-Spec, ARCHITECTURE, Mail-Template-Removal, Backlog-Eintrag, Test ✓
- [x] **MAJOR-401** — DST-Algorithmus + Pflicht-Tests ✓
- [x] **MAJOR-402** — Öffentlicher Status-Endpoint + Polling-Spec + Rate-Limit + UI-States + Test ✓
- [x] **MAJOR-403** — Live-Join-Mapper + Fallback + DSGVO-Note + Test ✓
- [x] **MAJOR-404** — Helper `bookingStartUTC` + 3-Fall-Behandlung + Test ✓
- [x] **MAJOR-405** — `safeCustomerCallback`-Helper + 3 Wirkungsstellen + Schema-Erweiterung + Test ✓
- [x] Keine neuen Critical/Major-Probleme durch die Fixes eingebracht ✓
- [x] Schema-Migration ist trivial (1 nullable Spalte, kein Backfill) ✓
- [x] Versions-Synchronität v1.4.1 in `schema.prisma`, `api-routes.md`, `zod-schemas.ts`, `ARCHITECTURE.md` ✓

#### Finales Urteil (Iteration 4, Zweite Review v1.4.1)

**Design freigegeben.**

Alle Blocker sind sauber und konsistent über die drei Contract-Artefakte und das Architecture-Doc hinweg behoben. Engineers können mit der Iteration-4-Implementierung in der vorgeschlagenen Reihenfolge (Schema-Migration → Customer-Auth → Read-Portal → Cancel → Stripe → Reviews) starten. QA empfiehlt:

1. **Build-Start freigegeben** — keine weitere Architekt-Loop nötig.
2. **Engineering-Notes** für Build mitgeben:
   - Cancel-Endpoint: bei `bookingStartUTC === null` defensive 409-Antwort wählen (nicht-blocking, Best-Practice).
   - Customer-JWT: Cookie wird beim E-Mail-Update nicht rotiert — mit BUG-402-Fix obsolet, weil keine E-Mail-Änderung mehr stattfindet.
   - `safeCustomerCallback`: Pflicht-Unit-Test wie in §17.8 spezifiziert.
3. **Build-QA** wird die Implementierung gegen genau die in §17.8 gelisteten Pflicht-Tests prüfen.

---

## Iteration 5 Design Review

**Datum:** 2026-05-02
**Reviewer:** QA Engineer (Design-QA-Mode, vor Code-Start)
**Scope:** US-30 (Admin-Pw-Reset UX), US-31 (OAuth2 Customer-Login), US-32 (Adressfeld), US-33 (Buchungsdauer), US-34 (Buffer-Zeit)
**Geprüfte Artefakte:**
- `PROJECT.md` — Stories US-30 bis US-34 (aktuelle Iteration 5)
- `ARCHITECTURE.md` v1.5 — §18.1 bis §18.13
- `contracts/schema.prisma` v1.5 (oauth-Felder, durationMinutes, address fields, BufferConfig)
- `contracts/api-routes.md` v1.5 — §21.1 bis §21.9
- `contracts/zod-schemas.ts` v1.5 — BookingAddressSchema, bookingDurationSchema, BufferConfigSchema, OAuthProfileNormalizedSchema, neue Fehlercodes

### Verdict (Kurzfassung)

| Größe                       | Wert         |
| --------------------------- | ------------ |
| Stories in Scope            | 5 (US-30–US-34) |
| Akzeptanzkriterien geprüft  | 31           |
| Spec deckt AC vollständig   | 28 / 31 (90%) |
| Critical Issues             | 1            |
| Major Issues                | 4            |
| Minor Issues                | 5            |

**Verdict:** ⚠️ **Design freigegeben mit Auflagen** — der Build kann starten, der einzige Critical-Befund (BUG-IT5-001 Race-Condition bei variabler Dauer) MUSS aber von Engineers während der Implementierung adressiert werden, sonst entstehen Doppelbuchungen. Major-Befunde sollen Engineers während der Implementierung mitberücksichtigen, sind aber nicht alleinstehend Build-blockierend, weil der Architekt die Lücken per Engineering-Notes schließen kann.

### 1. Test-Matrix (Akzeptanzkriterien gegen Spec)

| Story | AC | Test Case (Design-Sicht) | Layer | Status |
| ----- | -- | ----------------------- | ----- | ------ |
| US-30 | AC1 | Reset-Link prominent unter Pw-Feld | Frontend | Pass |
| US-30 | AC2 | Reset-Mail nutzt korrekte Umgebungs-URL (lokal vs. Prod) | Backend/Config | Pass |
| US-30 | AC3 | Reset-Link öffnet Formular mit zwei Feldern, gültig 1h | Backend | Pass |
| US-30 | AC4 | Pw-Min-Länge auf 8 Zeichen reduziert | Backend | Pass |
| US-30 | AC5 | Inline-Validierung leeres / nicht-übereinstimmendes Pw | Frontend | Pass |
| US-30 | AC6 | Abgelaufener / verbrauchter Token zeigt verständliche Meldung | Backend | Pass |
| US-30 | AC7 | Unbekannte Mail → neutrale Meldung (Enumeration-Schutz) | Backend | Pass |
| US-31 | AC1 | OAuth-Buttons unter Pw-Form sichtbar | Frontend | Pass |
| US-31 | AC2 | Google-Flow → Konto angelegt + Redirect /konto + Name in Nav | Backend/Frontend | **Major** (siehe BUG-IT5-002) |
| US-31 | AC3 | GitHub-Flow analog | Backend | **Major** (siehe BUG-IT5-003 GitHub-Email) |
| US-31 | AC4 | Erst-OAuth-Login → emailVerified true automatisch | Backend | Pass |
| US-31 | AC5 | Mail-Match → bestehendes Konto verknüpft, beide Methoden nutzbar | Backend | **Major** (siehe BUG-IT5-004 Hijacking-Vektor) |
| US-31 | AC6 | OAuth-Profil → kein Pw-Feld | Frontend | Pass |
| US-31 | AC7 | Pw-Login bleibt unverändert | Backend | Pass |
| US-31 | AC8 | OAuth-Fehler/Abbruch → deutsche Meldung auf /konto/login | Backend/Frontend | Partial (Fehlertext wird gerendert, aber Mapping-Tabelle fehlt) |
| US-32 | AC1 | Drei Pflichtfelder im Form, klar markiert | Frontend | Pass |
| US-32 | AC2 | Inline-Validierung leerer Felder | Frontend | Pass |
| US-32 | AC3 | PLZ ≠ 5 Ziffern → Fehler | Frontend/Backend | Pass |
| US-32 | AC4 | Daten persistiert | Backend | Pass |
| US-32 | AC5 | Admin-Detail zeigt Adresse als eigenen Abschnitt | Frontend | Pass |
| US-32 | AC6 | Admin-Liste zeigt PLZ + Ort | Frontend | Pass |
| US-32 | AC7 | Kunden-Portal-Detail zeigt Adresse | Frontend | Pass |
| US-33 | AC1 | 8 Kacheln (1h–6h, 8h, Ganztag) | Frontend | Pass |
| US-33 | AC2 | Preisschätzung pro Kachel | Frontend | Pass |
| US-33 | AC3 | Aktive Kachel hervorgehoben | Frontend | Pass |
| US-33 | AC4 | Verfügbarkeit prüft Zeitfenster — Kacheln ggf. ausgegraut | Frontend/Backend | Pass |
| US-33 | AC5 | Ganztag → reserviert gesamtes Verfügbarkeitsfenster | Backend | Pass |
| US-33 | AC6 | Tom sieht Dauer im Admin-Detail | Frontend | Pass |
| US-33 | AC7 | Tom sieht Dauer in Termin-Liste | Frontend | Pass |
| US-33 | AC8 | Fehlende Dauer → Inline-Fehler | Frontend | Pass |
| US-33 | (impl. AC) | **Konkurrente Buchungen mit überlappender Dauer werden verhindert** | Backend/DB | **Critical** (BUG-IT5-001) |
| US-34 | AC1 | Konfigurations-Bereich mit Auswahl 0/15/30/45/60 | Frontend | Pass |
| US-34 | AC2 | Speichern → Bestätigungstoast, Wert dauerhaft aktiv | Backend/Frontend | Pass |
| US-34 | AC3 | Buffer 30min nach 14:00 → 14:00–14:30 nicht buchbar | Backend | Pass |
| US-34 | AC4 | Beispiel mit konkreten Zeiten | Backend | Pass |
| US-34 | AC5 | Admin-Kalender zeigt Buffer als grauen Block | Frontend | Pass |
| US-34 | AC6 | Default 30min wenn kein Wert gesetzt | Backend | Pass |
| US-34 | AC7 | Buffer = 0 → keine Blockaden | Backend | Pass |

### 2. Critical Defects (Build-Blocker — vor / während Code-Start adressieren)

#### BUG-IT5-001 — Partial Unique Index schützt nicht gegen überlappende Dauern

- **Story:** US-33 (Buchungsdauer) — und implizit US-34 (weil Buffer zusätzlich an überlappende aktive Buchungen anknüpft).
- **Severity:** Critical
- **Layer:** Backend / DB-Constraint
- **Befund:** Der seit IT3 bestehende Partial Unique Index (siehe `ARCHITECTURE.md` §16.2 / §16.10) lautet:
  ```sql
  CREATE UNIQUE INDEX uniq_active_booking_per_timeslot
    ON bookings(date, start_time, end_time)
    WHERE date IS NOT NULL
      AND status IN ('PENDING','CONFIRMED','COUNTER_PROPOSED');
  ```
  Er verhindert nur den **exakten** Tupel-Duplikat. Mit US-33 wählt jeder Kunde frei eine Dauer; das Tupel ist nicht mehr aus einer fixen Slot-Granularität. Konkretes Race-Szenario:
  1. Kunde A POST /api/bookings mit `09:00–11:00` (`durationMinutes: 120`) → application-level overlap-Check sieht keine Konflikte → Insert läuft → DB-Insert OK.
  2. Parallel Kunde B POST /api/bookings mit `10:00–11:00` (`durationMinutes: 60`) → application-level overlap-Check (vor dem Insert von A committed?) sieht keine Konflikte → Insert läuft → DB-Insert OK, weil `(date, '10:00', '11:00')` ≠ `(date, '09:00', '11:00')`.

  Resultat: Zwei aktive Buchungen, die im Slot-API als "blocked" angezeigt würden, aber simultan eingefügt wurden. ARCHITECTURE.md §16.2 dokumentiert das Limit ("Wenn das Frontend NUR die vom Backend angebotenen Blöcke wählen darf …"), in IT5 ist die zugrundeliegende Annahme aber nicht mehr gültig.
- **Erwartet:** DB-Garantie gegen überlappende aktive Buchungen pro Tag, ODER eine serialisierende Sperre auf Application-Layer (z.B. `BEGIN IMMEDIATE` in SQLite + Re-Check in Transaktion + Insert), die zwischen Overlap-Check und Insert keine zweite Buchung zulässt.
- **Empfohlener Fix (eine der drei Varianten — Engineers + Architekt entscheiden vor Build):**
  1. **SQLite-Transaktion mit `BEGIN IMMEDIATE`** um den Block "Overlap-Check + Buffer-Check + Insert". SQLite serialisiert Writer; zwei parallele Anfragen werden sequentialisiert.
  2. **Advisory-Lock** auf `date` (z.B. via `SELECT ... FOR UPDATE` auf einen Tages-Datensatz oder einen synthetischen Lock-Datensatz). In SQLite: über die globale Schreib-Sperre kombiniert mit einem Re-Check.
  3. **Range-Check als zusätzliche DB-Constraint** via `BEFORE INSERT`-Trigger: Trigger prüft `EXISTS (SELECT 1 FROM bookings WHERE date = NEW.date AND status IN ('PENDING','CONFIRMED','COUNTER_PROPOSED') AND NEW.start_time < end_time AND NEW.end_time > start_time)` und wirft bei Treffer einen Fehler. Sauberere Lösung als Variante 1 + 2, aber zusätzlicher Migrationsaufwand.
- **Routing-Hinweis:** **solution-architect** (Konzept-Klärung im Architektur-Doc), dann **backend-engineer** (Implementierung).
- **Begründung der Critical-Einstufung:** Doppelbuchungen sind für Tom direkt wirtschaftlich schädlich (zwei zugesagte Termine zur gleichen Zeit, einer muss abgesagt werden) und untergraben die ganze Verfügbarkeits-Logik. Die TOCTOU-Lücke ist mit gleichzeitigen mobilen POSTs in der Praxis keine Hypothese, sondern ein erwarteter Edge-Case (gerade mit US-22 / Beworben durch Online-Marketing).

### 3. Major Defects (Spec-Klärung empfohlen — nicht alleinstehend Build-blockierend)

#### BUG-IT5-002 — `signIn`-Callback hat keinen `Response`-Zugriff für `Set-Cookie`

- **Story:** US-31
- **Severity:** Major
- **Layer:** Backend / Auth-Architektur
- **Befund:** §18.2.4 ARCHITECTURE.md sagt "Variante 1, weil weniger Hops" und merkt gleichzeitig in §18.2.4 an: "Nicht direkt im signIn-Callback (kein Response-Zugriff)". NextAuth v5 erlaubt zwar das Setzen eigener Cookies in der `cookies`-Config, aber **nicht dynamisch** mit Werten, die erst im `signIn`-Callback berechnet werden (CustomerId aus DB). Die "Inline-Variante" funktioniert in NextAuth v5 also nicht ohne Workaround. §18.2.4 räumt die "Finalize-Route" als Alternative ein, lehnt sie aber nicht-zwingend ab.
- **Erwartet:** Ein eindeutiger, technisch tragfähiger Mechanismus für das Setzen des `customer-session`-Cookies nach dem OAuth-Callback. **Empfehlung QA:** Variante 2 (Finalize-Route `/api/auth/customer/finalize`) als Default festlegen — das ist robust, debug-bar (eigener Endpoint), und vermeidet undokumentierte NextAuth-internals. Die Finalize-Route bekommt einen kurzlebigen, signierten One-Time-Token (60s, HMAC) als Query-Param und tauscht ihn gegen das `customer-session`-Cookie.
- **Routing-Hinweis:** **solution-architect** — eine konkrete, als verbindlich markierte Variante in §18.2.4 verankern, bevor der Build startet.

#### BUG-IT5-003 — GitHub-„private email"-Pfad ist im AC nicht spezifiziert, im signIn-Callback aber notwendig

- **Story:** US-31 AC3 (GitHub-OAuth)
- **Severity:** Major
- **Layer:** Backend / OAuth-Integration
- **Befund:** ARCHITECTURE.md §18.2.7 + §18.12 + api-routes.md §21.2 erwähnen das `users/emails`-Endpoint-Fallback und den Redirect `/konto/login?error=oauth_no_email`. AC3 selber sagt nur „GitHub bestätigt meine Identität → eingeloggt". Spec-Lücke: Was passiert, wenn der GitHub-User keine **verifizierte** primäre E-Mail hat (z.B. Account ist `email-noreply@github.com`)? Architecture sagt: Redirect mit Fehlercode. Schema fordert in `OAuthProfileNormalizedSchema` aber `email: z.string().email()` — Schema-Validation würde an leerer / nicht vorhandener E-Mail vorher scheitern, bevor der Redirect-Pfad griffe.
- **Erwartet:** Klarer Flow im Code: Wenn GitHub-API keine `verified && primary` E-Mail liefert → bevor `OAuthProfileNormalizedSchema` aufgerufen wird, Redirect mit `error=oauth_no_email` setzen. AC um diese Edge-Case-Handhabung ergänzen (Hinweis: "Bitte E-Mail-Sichtbarkeit im GitHub-Account aktivieren").
- **Routing-Hinweis:** **solution-architect** — AC im Architektur-Doc erweitern, **frontend-engineer** — Fehlertext-Mapping (`oauth_no_email` → deutsche Erläuterung).

#### BUG-IT5-004 — Account-Verknüpfung über E-Mail ist potentieller Hijacking-Vektor

- **Story:** US-31 AC5
- **Severity:** Major
- **Layer:** Sicherheit / Backend
- **Befund:** §18.2.3 spezifiziert: bei Mail-Match wird das bestehende Konto erkannt, `oauthProvider/oauthId` werden gesetzt, **`emailVerified: true` wird gesetzt** (auch wenn es vorher false war). §18.9.1 verlangt zwar `email_verified === true` vom Provider. Aber: ein Angreifer registriert lokal `victim@example.com` per E-Mail/Pw (verifiziert nie), wartet, und meldet sich später mit Google-Konto `victim@example.com` an. Das System verknüpft beide. Wenn das Opfer später denselben Account erstellen will, scheitert die Registrierung (E-Mail bereits belegt) — der Account ist faktisch gekapert. **Mitigations sind nicht spezifiziert:**
  1. Wenn das vorhandene lokale Konto `emailVerified: false` ist: die Verknüpfung ist akzeptabel (Opfer war nie der Inhaber).
  2. Wenn `emailVerified: true` ist: Verknüpfung ist ebenfalls akzeptabel, weil das Opfer zur fraglichen E-Mail-Inbox verifizierten Zugriff hatte und Google ebenfalls den E-Mail-Owner verifiziert.
  Aber: Beide Pfade sind im Architektur-Doc nicht explizit unterschieden. Die §18.2.3 Pseudo-Code-Update setzt `emailVerified: true` immer.
- **Erwartet:** Im Code:
  - Wenn lokales Konto `emailVerified: false` UND `oauthProvider === null` → Verknüpfung OK (mit `emailVerified: true`-Setzung), weil das lokale Konto faktisch unbenutzt ist.
  - Wenn lokales Konto `emailVerified: true` → Verknüpfung OK (Provider-Verifikation deckt sich mit lokaler Verifikation).
  - Beide Wege müssen im Architektur-Doc explizit dokumentiert werden, damit Engineers nicht unbeabsichtigt den falschen Pfad aktivieren.
- **Routing-Hinweis:** **solution-architect** — §18.2.3 + §18.9.2 um diese Differenzierung erweitern.

#### BUG-IT5-005 — Buffer-Berechnung ignoriert Vortage-Buchungen über Mitternacht

- **Story:** US-34
- **Severity:** Major (Edge-Case, im MVP unwahrscheinlich)
- **Layer:** Backend / Slot-Berechnung
- **Befund:** §21.4 Algorithmus berechnet Slots pro Tag und holt `activeBookings` für `where: { date }`. Eine CONFIRMED-Buchung am Vortag, die kurz vor Mitternacht endet (z.B. „Ganztag" Sa 08:00–22:00, oder ein händisch in DB gepflegter Sonderfall mit `endTime: '23:30'` und Buffer 60min), reicht in den Folgetag (00:30) — wird aber im Algorithmus für den Folgetag nicht berücksichtigt, weil Buffer nur gegen `activeBookings` desselben `date` geprüft wird.
- **Erwartet:** Entweder explizite Annahme im Architektur-Doc, dass Buchungen tagesweise enden müssen (und das Verfügbarkeitsfenster des Templates < 24h ist), ODER eine Erweiterung: lese auch Buchungen mit `date = previous day` und prüfe, ob `endTime + bufferMinutes` über Mitternacht reicht.
- **Routing-Hinweis:** **solution-architect** — entweder dokumentieren, dass dieser Fall im MVP nicht auftreten kann (Hinweis im §18.5.2), oder Algorithmus erweitern.

### 4. Minor Defects (nicht-blocking, aber im Build-Plan mitnehmen)

#### MIN-IT5-001 — `BufferConfigSchema` lässt 0–240 zu, `UpdateBufferConfigSchema` whitelistet 0/15/30/45/60

- **Story:** US-34
- **Severity:** Minor
- **Befund:** `zod-schemas.ts` Zeile 1441–1448: `BufferConfigSchema.bufferMinutes` validiert `min(0).max(240)`. `UpdateBufferConfigSchema` (PUT-Body) prüft Whitelist [0,15,30,45,60]. Wenn die DB jemals einen Wert außerhalb der Whitelist enthält (z.B. manuell via Prisma Studio von Tom auf 90 gesetzt), liefert `GET /api/admin/buffer-config` ihn aus und das Admin-UI muss damit umgehen können. Das Architecture-Doc dokumentiert diese „Forward-Kompatibilität" zwar (§Schema-Kommentar), aber das `<select>` in §18.5.3 hat nur 5 Optionen — der Drift ist nicht abgefangen.
- **Empfehlung:** Frontend `<select>` rendert bei Drift einen zusätzlichen, deaktivierten `<option>` mit dem Live-Wert, damit der gespeicherte Wert lesbar bleibt.
- **Routing-Hinweis:** **frontend-engineer** (Engineering-Notes).

#### MIN-IT5-002 — Schema sagt `passwordHash: String?` (nullable), API-Login-Pfad meldet `OAUTH_ONLY_ACCOUNT` — aber Mail-Existenz-Leak möglich

- **Story:** US-31
- **Severity:** Minor (Sicherheit)
- **Befund:** Wenn `POST /api/customer/login` mit einer existierenden OAuth-only-E-Mail aufgerufen wird, antwortet das Backend mit 422 `OAUTH_ONLY_ACCOUNT`. Bei einer **nicht existierenden** E-Mail sollte aus Sicherheitsgründen die generische "E-Mail oder Passwort ungültig"-Antwort kommen (keine Auskunft über Account-Existenz). Wenn `OAUTH_ONLY_ACCOUNT` vor dem generischen Fehler greift, leakt das Backend implizit, dass die E-Mail-Adresse als OAuth-Konto existiert. Der Architekt erwähnt das Pattern „generische Login-Fehler" (§17.7 IT4) — IT5 muss explizit klarstellen, dass `OAUTH_ONLY_ACCOUNT` ein anderes UX-Trade-off ist (Hilfe für legitime User vs. Enumeration-Risk).
- **Empfehlung:** Architektur dokumentiert die Entscheidung: „Wir akzeptieren das schwache Enumeration-Leak im Tausch gegen UX-Klarheit für OAuth-only-User." ODER: nur generischen Fehler liefern und im Frontend einen Hinweis-Link „Mit Google/GitHub anmelden?" als sichtbare Alternative ausgeben.
- **Routing-Hinweis:** **solution-architect** — Trade-off in §18.9.x dokumentieren.

#### MIN-IT5-003 — Adress-PLZ-Regex deckt nur deutsche PLZ — kein expliziter Hinweis im Form

- **Story:** US-32
- **Severity:** Minor (DSGVO/UX)
- **Befund:** `ZipCodeSchema = /^\d{5}$/` akzeptiert exakt 5 Ziffern. Tom betreut „Darmstadt und Umgebung" — ein österreichischer Kunde mit 4-stelliger PLZ würde abgewiesen, ohne im UI eine Begründung zu bekommen. AC sagt nur „PLZ muss 5 Ziffern enthalten" — Annahme ist OK für Bärenstark-Region, aber das UI sollte einen kleinen Hinweis „(Deutschland)" zeigen, sonst ist die Fehlermeldung verwirrend.
- **Empfehlung:** `BookingForm` Label „PLZ (Deutschland)" oder Placeholder „z.B. 64283" verwenden.
- **Routing-Hinweis:** **frontend-engineer** (kosmetisch).

#### MIN-IT5-004 — Bestandsbuchungen ohne Adresse: UI-Verhalten teilweise unspezifiziert

- **Story:** US-32 AC5/AC6/AC7
- **Severity:** Minor
- **Befund:** §18.11 Test-Plan listet einen Fall „Bestandsbuchung → Detail-Page rendert Hinweis 'Adresse nicht erfasst' (kein Crash)". §18.3.4 sagt aber nicht, was die **Liste** im Admin-Bereich oder die Kunden-Portal-Detail-Seite tun sollen, wenn `addressZip / addressCity` null sind. Frontend-Engineer könnte:
  1. die Zeile leer lassen,
  2. „—" rendern,
  3. „Adresse nicht erfasst" rendern,
  4. die ganze Adresszeile auslassen.
- **Empfehlung:** Architektur-Doc gibt einen Default vor („—" für Listen, Hinweistext für Detail).
- **Routing-Hinweis:** **solution-architect** (Engineering-Note in §18.3.4).

#### MIN-IT5-005 — Fehlertext-Mapping für `oauth_*`-Codes nicht im Doc

- **Story:** US-31 AC8
- **Severity:** Minor
- **Befund:** Architecture nennt Fehlercodes (`oauth_error`, `oauth_no_email`, `oauth_unverified`, `oauth_email_conflict`), aber das genaue UI-Mapping (deutscher Text pro Code) ist nicht im Architektur-Doc oder in einem zentralen i18n-File definiert.
- **Empfehlung:** Eine Mapping-Tabelle in §18.2 oder in `app/konto/login/page.tsx`-Pseudo-Code dokumentieren.
- **Routing-Hinweis:** **solution-architect** + **frontend-engineer**.

### 5. Vertrags-Konsistenz (FE/BE)

| Prüfung | Ergebnis |
| ------- | -------- |
| `Booking.durationMinutes` Typ konsistent (int, Schema + Zod + API) | Pass |
| `addressStreet/Zip/City` nullable konsistent (Schema nullable, API-Zod im IT5-Modus pflicht) | Pass |
| `BufferConfigSchema` GET-Response-Form == `UpdateBufferConfigSchema` Body-Form | Pass (beide nutzen `bufferMinutes: int`) |
| `OAuthProfileNormalizedSchema` Felder decken Provider-Mapping (Google `given_name/family_name`, GitHub `name` split) | Pass |
| Fehlercodes in `ApiErrorSchema.error.code` enum erweitert um `OAUTH_ONLY_ACCOUNT`, `OAUTH_ERROR` | Pass |
| `CustomerUserPublicSchema.oauthProvider` Enum enthält genau `'google' | 'github'` (synchron mit `CUSTOMER_OAUTH_PROVIDERS`) | Pass |
| `BOOKING_DURATION_OPTIONS` (60..480) entspricht Architektur-Tabelle in §18.4.1 | Pass |
| `BUFFER_MINUTES_OPTIONS [0,15,30,45,60]` deckt sich mit AC1 von US-34 | Pass |
| `GET /api/slots/available?duration=...` Query-Schema akzeptiert `BOOKING_DURATION_ALL_DAY` (-1) | Pass |
| Middleware-Whitelist `/api/auth/customer/[...nextauth]` (NextAuth-Customer-Pfad) — die `/konto/*`-Middleware matcht das nicht (anderer Pfad), `/admin/*`-Middleware ebenfalls nicht. Public-Access OK. | Pass |

Keine Vertrags-Mismatches gefunden.

### 6. Anforderungs-Lücken / Out-of-Scope

| Befund | Bewertung |
| ------ | --------- |
| Kein Endpoint für „OAuth-Provider entkoppeln" (Kunde will Google-Verknüpfung wieder lösen) | Out-of-Scope für IT5 — Backlog-Kandidat. Tom sollte das per Prisma Studio händisch machen können bis dahin. Architektur-Doc nennt es nicht. |
| Kein Pre-Buffer (Anfahrt VOR dem Termin) | §18.12 dokumentiert das als Backlog. OK. |
| Kein Service-spezifischer Buffer | §18.12 dokumentiert das als Backlog. OK. |
| Adress-Geocoding / Karten-Darstellung | Out-of-Scope. OK. |
| Strikte Pflichtgrenze für `durationMinutes >= 15` (DB-CHECK) | Spec sagt es, Schema setzt es nicht hart durch. Akzeptabel weil App-Layer-Whitelist greift. |

### 7. Non-Functional Findings

| Bereich | Befund |
| ------- | ------ |
| **Sicherheit** | OAuth-Setup mit PKCE + State-Param = OK. CSRF wird von NextAuth gehandhabt. Open-Redirect-Schutz via `safeCustomerCallback` ist verbindlich, aber das `redirect`-Callback in §21.2 ignoriert den `url`-Parameter komplett und liefert immer `${baseUrl}/konto`. Damit funktioniert auch der intern gewünschte `callbackUrl: '/konto'`. Annehmbar, aber Engineers müssen das akzeptieren, dass beliebige `callbackUrl`-Werte schweigend verworfen werden. |
| **Datenschutz** | Adresse nur eingeloggt sichtbar — OK. Logging-Hinweis fehlt: Beim Booking-Insert sollte die Adresse nicht ungekürzt in Application-Logs landen. Engineering-Note empfehlen. |
| **Performance** | Slot-API-Algorithmus: O(blocks × bookings) — mit 30-Min-Schritt + 9h-Fenster + 5 Buchungen/Tag = 18 × 5 = 90 Operationen. Vernachlässigbar. |
| **Accessibility** | Buffer-Block im Admin-Kalender als „graue Schraffur" — ARIA-Label fehlt im Doc. Engineering-Note: `aria-label="Pufferzeit nach Buchung"` ergänzen. |
| **Observability** | Keine Mention von Logs für OAuth-Callback-Fehler (Provider-Auth-Fehler, `oauth_no_email`). Engineering-Note: Strukturiertes Logging per `console.warn` mit Provider-Name + Fehlertyp (kein PII!). |
| **Rate-Limiting** | OAuth-Endpoints sind nicht eigen-limited (NextAuth/Provider drosseln). Akzeptabel. `PUT /api/admin/buffer-config` 30/60min/Admin — angemessen. |

### 8. Antworten auf die expliziten QA-Schwerpunkte

#### US-31 OAuth2 (Schwerpunkt 1)

| Frage | Antwort der Spec |
| ----- | ---------------- |
| OAuth + bestehendes E-Mail/Pw-Konto: Merge oder 409? | **Merge** (§18.2.3 + AC5). Beide Methoden sind anschließend nutzbar, `passwordHash` bleibt erhalten. Siehe BUG-IT5-004 für die Hijacking-Frage. |
| GitHub liefert keine E-Mail (private)? | Server fragt `https://api.github.com/user/emails` ab, nimmt `primary && verified`. Wenn keine vorhanden → Redirect `oauth_no_email`. Siehe BUG-IT5-003 (AC-Lücke). |
| Account-Übernahme via OAuth möglich? | **Teilweise** — Hijacking eines unverifizierten lokalen Kontos ist technisch möglich. BUG-IT5-004 verlangt explizite Differenzierung im Doc. Real-World-Risiko ist gering (Opfer hatte lokale Reg ohne Verify), MVP-akzeptabel mit dokumentierter Mitigation. |
| Wann/wie wird `customer-session`-Cookie nach OAuth gesetzt? | **Architektur-konflikt**: §18.2.4 nennt zwei Varianten (Inline vs. Finalize-Route), bevorzugt Variante 1, die in NextAuth v5 aber nicht direkt funktioniert (kein Response-Zugriff im signIn-Callback). BUG-IT5-002 fordert verbindliche Festlegung auf Variante 2. |

#### US-33 Buchungsdauer (Schwerpunkt 2)

| Frage | Antwort |
| ----- | ------- |
| Race-Condition zwei Kunden mit überlappenden Dauern? | **NICHT abgedeckt.** BUG-IT5-001 (Critical). Partial Unique Index schützt nur exakte Tupel. |
| `durationMinutes` länger als Template-Fenster? | Spec OK: §21.3 Schritt 3 prüft `endTimeMin <= templateEndTimeMin`, antwortet 409 mit `field: 'durationMinutes'`. |
| Partial Unique Index deckt Überlappungen ab? | **Nein** (§16.2 dokumentiert das Limit explizit). Die §16.2-Annahme „Frontend wählt nur Backend-angebotene Blöcke" gilt in IT5 nicht mehr automatisch — siehe BUG-IT5-001. |

#### US-34 Buffer-Zeit (Schwerpunkt 3)

| Frage | Antwort |
| ----- | ------- |
| `BufferConfig`-Tabelle leer → Default 30min? | **Pass.** §18.5.1 `getBufferConfig()` legt Datensatz on-the-fly an. AC6 erfüllt. |
| Buffer nur nach CONFIRMED korrekt für UX? | **Pass mit Begründung.** §18.5.2 begründet: PENDING blockt nur eigenen Slot, weil Tom noch nicht zugesagt hat — andere Kunden sollen parallel anfragen können. Realistisch und akzeptabel. |
| Buffer + Dauer kombiniert (09:00–11:00 + 30min → 09:00–11:30 blockiert)? | **Pass.** §21.4 Algorithmus prüft `block ∩ [bookingEnd, bookingEnd + bufferMinutes)`, also wird der 11:00–11:30-Bereich nach einer 09:00–11:00 CONFIRMED-Buchung als blocked markiert. Korrekt. |

#### US-32 Adressfeld (Schwerpunkt 4)

| Frage | Antwort |
| ----- | ------- |
| Bestandsbuchungen ohne Adresse — UI-Verhalten? | **Teilweise spec'd.** Detail-Page hat Hinweis „Adresse nicht erfasst" (§18.11 Test). Liste / Card-Verhalten ist offen → MIN-IT5-004. |
| PLZ-Regex nur deutsche PLZ (5 Ziffern)? | **Pass mit kleiner UX-Anmerkung MIN-IT5-003** (Label „PLZ (Deutschland)" empfehlen). |

### 9. Sign-off Checklist (Iteration 5)

- [x] Alle 5 Stories haben mindestens eine konkrete Spec-Sektion in §18.
- [x] Alle 31 ACs haben einen erkennbaren Implementierungs-Anker in der Architektur (Datenmodell-Feld, Endpoint, oder UI-Komponente).
- [x] Schema-Migration ist additiv und ohne Daten-Verlust-Risiko (alle neuen Felder nullable oder mit Default).
- [x] Vertrags-Artefakte (schema.prisma, api-routes.md, zod-schemas.ts) sind konsistent (keine Mismatches).
- [x] Test-Plan §18.11 deckt die wichtigsten ACs ab (mit kleinen Lücken für die Race-Condition).
- [x] ENV-Variablen + OAuth-Setup-Anleitung für Tom dokumentiert (§18.10 + §18.2.7).
- [ ] **Race-Condition-Schutz für variable Dauer in §18.4 / §18.6 verankert.** ⚠️ **OFFEN** — siehe BUG-IT5-001.
- [ ] **Verbindliche Cookie-Strategie nach OAuth-Callback** (Variante 1 vs. 2) in §18.2.4. ⚠️ **OFFEN** — BUG-IT5-002.
- [ ] **Account-Verknüpfungs-Sicherheits-Differenzierung** (verifiziertes vs. unverifiziertes lokales Konto) in §18.9.2. ⚠️ **OFFEN** — BUG-IT5-004.

### Finales Urteil (Iteration 5)

**Design freigegeben — mit verbindlicher Auflage zur Schließung von BUG-IT5-001.**

Der Build kann starten, weil:
- Vertrags-Artefakte (Schema, Zod, API) sind konsistent.
- Schema-Migration ist sicher (additiv).
- 28 / 31 ACs sind klar testbar gegen die Spec.
- US-30 (UX-Fix) ist trivial-bereit — kein Architektur-Risiko.
- US-32 (Adressfeld), US-34 (Buffer) sind sauber spezifiziert.

**Verbindliche Engineering-Notes vor Build-Start (Architekt-Loop nicht zwingend, aber dringend empfohlen):**

1. **BUG-IT5-001 (Critical):** Race-Condition-Schutz für überlappende Dauern. Engineers müssen vor dem Insert in `POST /api/bookings` einen serialisierenden Mechanismus einsetzen (SQLite `BEGIN IMMEDIATE` + Re-Check Overlap + Insert in einer Transaktion, ODER ein DB-Trigger). Ohne diese Maßnahme entstehen unter Last Doppelbuchungen — Tom kann manuell moderieren, aber die Code-Logik darf das nicht zulassen.
2. **BUG-IT5-002 (Major):** Cookie-Setzen nach OAuth — Engineers wählen die **Finalize-Route**-Variante (kurzlebiger HMAC-Token, eigener Endpoint). Die "Inline-Variante" funktioniert in NextAuth v5 nicht ohne Hacks. Architekt soll §18.2.4 entsprechend nachschärfen.
3. **BUG-IT5-003 (Major):** GitHub-`oauth_no_email`-Flow als expliziter Code-Pfad **vor** der Schema-Validation in `lib/customer-oauth.ts` implementieren.
4. **BUG-IT5-004 (Major):** Account-Verknüpfung per E-Mail nur dann durchführen, wenn entweder das lokale Konto `emailVerified === true` ist oder `emailVerified === false` ist und keine Buchungs-Historie existiert. Architekt soll §18.9.2 nachschärfen.
5. **BUG-IT5-005 (Major):** Buffer-Berechnung ist tagesweise — Architekt soll explizit dokumentieren, dass Verfügbarkeitsfenster nicht über Mitternacht reichen dürfen, ODER den Algorithmus auf Vortag erweitern.
6. **MIN-IT5-001 bis MIN-IT5-005:** Engineers nehmen die Punkte in den Build-Plan auf (siehe oben).

**Build-QA wird die Implementierung gegen genau diese sechs Punkte plus die Test-Tabelle aus §18.11 prüfen.**

Empfohlene Implementierungs-Reihenfolge:
1. Schema-Migration (alle neuen Felder + BufferConfig-Tabelle).
2. US-30 (Pw-Reset UX-Fix) — niedriges Risiko, schneller Win.
3. US-32 (Adressfeld) — additiv, kein Risiko.
4. US-34 (Buffer) — Slot-API-Erweiterung, zentral.
5. US-33 (Dauer) — Slot-API-Erweiterung + Race-Condition-Schutz (BUG-IT5-001).
6. US-31 (OAuth) — Komplexeste Story, isoliert vom Rest, am Ende.


