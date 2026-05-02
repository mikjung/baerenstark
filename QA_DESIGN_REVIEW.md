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

