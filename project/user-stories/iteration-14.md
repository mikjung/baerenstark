# EPIC-IT14: Iteration 14 — Live-Feedback aus Tom's Praxisbetrieb

Live-Feedback aus dem Produktionsbetrieb beheben: Auth-Härtung der Admin-Sektion,
Workflow-Bugs im Admin-Dashboard (Preis-Persistierung, Default-Filter, Kalender-404)
und Analytics-Korrektheit — damit Tom seinen Betrieb zuverlässig steuern kann.

## Vision context

Iteration 13 hat die Kernfunktionalität stabilisiert und Facebook-OAuth vorbereitet.
Tom hat das Live-System aktiv genutzt und dabei acht konkrete Probleme identifiziert:
einen Sicherheits-Gap (Admin ohne Auth-Gate), mehrere Admin-Workflow-Bugs die seinen
Daily-Use blockieren (Preis wird nicht gespeichert, Kalender-404, Analytics zeigt
abgeschlossene Aufträge nicht), und kleinere Komfort-Defekte (Prefill-Regression,
Default-Filter, Cash-Zahlung). Diese Iteration räumt alle acht Punkte als fokussierte
Bug- und Härtungs-Stories ab — kein Neubau, nur Fixes.

---

## Story: IT14-S01 — Bug: Prefill funktioniert in Production nicht (Regression S04/IT13)

**Kategorie:** Bug
**Priorität:** P1 (Tom blockiert in Daily-Use)

**Als** eingeloggter Kunde,
**möchte ich** dass meine Konto-Informationen im Termin-Anfrage-Formular automatisch
eingetragen sind,
**so dass** ich nicht jedes Mal Name, E-Mail, Telefon und Adresse neu eingeben muss.

### Fehlerbeschreibung / Kontext

IT13-S04 hat das Prefill-Feature implementiert und der QA-Reviewer hat es auf
Code-Ebene als ✅ Done verifiziert. In Production funktioniert es aber nicht.
Das deutet auf eine Production-spezifische Ursache hin: z.B. Session-Cookie
(`customer-session`) wird nicht korrekt gelesen wenn die `GET /api/customer/me`-Route
aufgerufen wird, ein ENV-Variable-Drift nach Re-Deployment, ein Hydration-Problem
das nur mit echten Nutzerdaten auftritt, oder ein Race-Condition im `useCustomer()`-
Hook unter Production-Latenz. Diese Story ist ein Regressions-Bug — das Feature
existiert, funktioniert aber in Produktion nicht.

### Acceptance Criteria

- [ ] GIVEN ein eingeloggter Kunde öffnet `/buchen` oder das Quick-Booking-Modal, WHEN das Formular geladen ist, THEN sind die Felder Vorname, Nachname und E-Mail mit den im Profil hinterlegten Werten vorausgefüllt.
- [ ] GIVEN ein eingeloggter Kunde hat eine Adresse im Profil hinterlegt, WHEN das Buchungsformular geladen ist, THEN sind Straße & Hausnummer, PLZ und Ort ebenfalls vorausgefüllt.
- [ ] GIVEN ein eingeloggter Kunde hat keine Adresse im Profil, WHEN das Buchungsformular geladen ist, THEN sind Adressfelder leer und der Hinweis-Banner mit Link zu `/konto` ist sichtbar.
- [ ] GIVEN ein nicht eingeloggter Nutzer öffnet das Buchungsformular, WHEN das Formular geladen ist, THEN sind alle Felder leer — kein Fehler, kein 401-Banner.
- [ ] GIVEN `GET /api/customer/me` in den Vercel-Production-Logs nach dem Fix aufgerufen wird, THEN antwortet der Endpoint mit HTTP 200 und dem Session-Nutzer-Objekt — kein 401 bei eingeloggtem Nutzer.
- [ ] GIVEN die Root-Ursache identifiziert ist, THEN ist sie im PR dokumentiert (z.B. „Cookie-Name-Mismatch", „ENV-Variable `AUTH_SECRET` nicht korrekt gesetzt", „Race-Condition bei erster Hydration").

### Out of Scope

- Keine Erweiterung des Prefill-Umfangs (andere Felder oder andere Formulare) — nur Regression beheben.
- Kein Refactoring des `useCustomer()`-Hooks über die nötige Bugfix-Änderung hinaus.

### Hinweise an Architect/Engineers

- Diagnose-Reihenfolge: (1) In Vercel-Production-Logs prüfen ob `GET /api/customer/me` für eingeloggte Nutzer 401 oder 200 zurückgibt. (2) Prüfen ob `AUTH_SECRET` in Vercel für den Production-Branch gesetzt ist — ein Key-Mismatch erklärt Session-Ungültigkeit. (3) `src/lib/customer-oauth.ts` und den `useCustomer()`-Hook auf Race-Conditions prüfen: Läuft der API-Call bevor die Session-Cookie gesetzt ist? (4) Skeleton-Gating in `BookingClient.tsx` prüfen — rendert der Parent das Formular bereits, bevor `customerStatus` settled ist? (5) Sicherstellen dass `basePath: '/api/auth/customer'` bei `getSession()`-Calls korrekt übergeben wird.
- IT13-QA-Review §3.3: „Hydration-safe: Server-Render mit leeren Defaults, Client-Hydration mountet Form erst nach Customer-Status-Settle" — genau diesen Pfad in Production mit echten Cookies nachverfolgen.

### Story Points: 3
### Status: Draft

---

## Story: IT14-S02 — Härtung: Admin-Seiten nur für Admins zugänglich (Auth-Gate)

**Kategorie:** Härtung
**Priorität:** P0 (Sicherheit / Datenleck)

**Als** Inhaber,
**möchte ich** dass ausschließlich verifizierte Admin-Accounts die Admin-Seiten
aufrufen können,
**so dass** Kundendaten, Preise und Geschäftsinformationen vor unbefugtem Zugriff
geschützt sind.

### Fehlerbeschreibung / Kontext

Tom meldet, dass die Admin-Seite nicht korrekt gesichert ist — es fehlt ein Auth-Gate
das nicht-Admin-Anfragen blockiert. Ein eingeloggter Customer-Account (oder auch ein
nicht eingeloggter Nutzer) kann `/admin` und Unterseiten aufrufen. Das ist ein
kritisches Sicherheitsproblem: Admin-Seiten enthalten alle Buchungsanfragen inkl.
Kundendaten (Name, E-Mail, Telefon, Adresse), Admin-Notizen und Preise.

### Acceptance Criteria

- [ ] GIVEN ein nicht eingeloggter Nutzer ruft `/admin` oder eine beliebige `/admin/**`-Route auf, WHEN der Request verarbeitet wird, THEN antwortet der Server mit HTTP 302 Redirect auf `/admin/login` — kein Admin-Inhalt wird ausgeliefert.
- [ ] GIVEN ein eingeloggter Customer-Account (kein Admin) ruft `/admin` oder `/admin/**` auf, WHEN der Request verarbeitet wird, THEN antwortet der Server mit HTTP 403 und Redirect auf `/admin/login` — kein Admin-Inhalt wird ausgeliefert.
- [ ] GIVEN ein verifizierter Admin-Account ist eingeloggt und ruft `/admin` auf, WHEN die Seite geladen wird, THEN wird das Admin-Dashboard korrekt angezeigt — kein Redirect, kein 403.
- [ ] GIVEN alle Admin-API-Routen (`/api/admin/**`), WHEN ohne gültige Admin-Session aufgerufen, THEN antworten sie mit HTTP 401 oder 403 — kein Datenleck in der API-Response.
- [ ] GIVEN der Schutz implementiert ist, WHEN `curl -i https://www.baerenstark-hausservice.app/admin` ohne Cookies aufgerufen wird, THEN ist die Antwort HTTP 302 nach `/admin/login` — kein Admin-HTML im Response-Body.

### Out of Scope

- Kein neues Admin-Rollen-System (nur das bestehende Admin-Account-Konzept nutzen).
- Kein Rate-Limiting für Admin-Login (separates Thema).
- Keine Änderung des Admin-Login-Formulars selbst.

### Hinweise an Architect/Engineers

- Prüfen ob `src/middleware.ts` die `/admin`-Pfade mit einer Admin-Session-Prüfung abdeckt. NextAuth v5 mit separater Admin-Auth (`basePath: '/api/auth/admin'`?) muss korrekt in den Middleware-Matcher eingebunden sein.
- Typisches Problem: Middleware prüft `auth()` aber nur gegen die Customer-Session-Provider, nicht gegen die Admin-Session. Admin-Session-Cookie-Name muss in der Middleware-Prüfung explizit referenziert werden.
- Prüfen ob `src/app/admin/layout.tsx` (oder `page.tsx`) bereits einen `auth()`-Call hat — wenn ja, warum greift er nicht? Server-Component-`auth()` vs. Edge-Middleware sind unterschiedliche Prüfstellen.
- Alle `/api/admin/**`-Routen ebenfalls prüfen: haben alle Route Handler eine explizite Admin-Session-Prüfung am Anfang?

### Story Points: 3
### Status: Draft

---

## Story: IT14-S03 — Bug: Admin-Dashboard zeigt falschen Default-Filter (soll Offen + Bestätigt)

**Kategorie:** Bug
**Priorität:** P1 (Tom blockiert in Daily-Use)

**Als** Admin,
**möchte ich** beim Öffnen des Admin-Dashboards sofort die offenen und bestätigten
Buchungsanfragen sehen,
**so dass** ich ohne manuelles Filtern erkenne was meine Aufmerksamkeit braucht.

### Acceptance Criteria

- [ ] GIVEN Tom öffnet `/admin` (oder den Buchungsanfragen-Bereich), WHEN die Seite initial geladen wird, THEN sind die Filter-Optionen „Offen" und „Bestätigt" vorausgewählt — alle anderen Status (Abgelehnt, Abgesagt, Abgeschlossen) sind deaktiviert.
- [ ] GIVEN der Default-Filter aktiv ist, WHEN Buchungsanfragen geladen werden, THEN zeigt die Liste nur Anfragen mit Status `PENDING` (Offen) und `CONFIRMED` (Bestätigt) — keine abgelehnten oder abgeschlossenen Anfragen.
- [ ] GIVEN Tom ändert den Filter manuell (z.B. auf „Alle"), WHEN er die Seite neu lädt, THEN ist der Default-Filter wieder aktiv (Offen + Bestätigt) — keine persistierte Filter-Auswahl über Sitzungen hinweg.
- [ ] GIVEN keine offenen oder bestätigten Buchungen vorhanden, WHEN der Default-Filter aktiv ist, THEN erscheint ein freundlicher Leerstand „Keine offenen Anfragen" — kein Fehler.

### Out of Scope

- Kein Speichern des Filters in der Datenbank oder LocalStorage über Sessions hinweg.
- Keine neuen Filter-Optionen (nur Default-Wert ändern).

### Hinweise an Architect/Engineers

- Prüfen wo der initiale Filter-State im Admin-Dashboard gesetzt wird (z.B. `useState(['ALL'])` oder `useState([])`). Auf `useState(['PENDING', 'CONFIRMED'])` oder äquivalente Enum-Werte ändern.
- Sicherstellen dass der API-Call für die Buchungsliste den Default-Filter beim ersten Render korrekt mitschickt — nicht erst nach User-Interaktion.
- Status-Enum-Werte aus dem Prisma-Schema prüfen (z.B. `BookingStatus.PENDING`, `BookingStatus.CONFIRMED`).

### Story Points: 2
### Status: Draft

---

## Story: IT14-S04 — Bug: Preis wird im Admin-Dashboard nicht gespeichert

**Kategorie:** Bug
**Priorität:** P0 (Datenintegrität / Tom kann Einnahmen nicht tracken)

**Als** Admin,
**möchte ich** einen Preis für eine Buchungsanfrage hinterlegen und speichern,
**so dass** ich meine Einnahmen korrekt erfassen und in den Auswertungen sehen kann.

### Fehlerbeschreibung / Kontext

Tom öffnet eine Buchungsanfrage im Admin-Dashboard, trägt einen Preis ein und
speichert — der Preis wird jedoch nicht persistiert. Beim nächsten Öffnen der
Anfrage ist das Preisfeld leer. Dies blockiert sowohl die manuelle Einnahmen-
erfassung als auch die Analytics (IT14-S07).

### Acceptance Criteria

- [ ] GIVEN Tom öffnet eine Buchungsanfrage im Admin-Dashboard und trägt einen Preis ein (z.B. „150"), WHEN er auf Speichern klickt, THEN antwortet der Server mit HTTP 200 und einer Erfolgs-Meldung — kein Fehler.
- [ ] GIVEN der Preis gespeichert wurde, WHEN Tom die Detailseite der Buchungsanfrage erneut öffnet (oder die Seite neu lädt), THEN ist der Preis-Wert korrekt im Feld vorausgefüllt.
- [ ] GIVEN Tom den gespeicherten Preis auf einen neuen Wert ändert, WHEN er erneut speichert, THEN wird der neue Wert persistiert — der alte Wert wird überschrieben.
- [ ] GIVEN der Preis als leeres Feld gespeichert wird, WHEN die Anfrage erneut geöffnet wird, THEN ist das Preisfeld leer (kein alter Wert bleibt stehen).
- [ ] GIVEN der Preis gespeichert ist, WHEN `GET /api/admin/bookings/[id]` aufgerufen wird, THEN enthält die API-Response das Preisfeld mit dem gespeicherten Wert.

### Out of Scope

- Keine automatische Preisberechnung.
- Keine Validierung von Preis-Formaten über eine einfache Zahlen-Prüfung hinaus.
- Kein Audit-Log für Preisänderungen.

### Hinweise an Architect/Engineers

- Den PATCH/PUT-Endpoint für Admin-Booking-Updates prüfen (wahrscheinlich `PATCH /api/admin/bookings/[id]`): Wird das Preis-Feld (`finalPrice`, `final_price_eur` o.ä.) im Request-Body mitgeschickt? Wird es im Prisma-`update`-Call tatsächlich übergeben (`data: { finalPrice: value }`)?
- Im Frontend prüfen ob das Preisfeld im Formular-`handleSubmit` oder im Submit-Payload enthalten ist — oft wird ein Feld vergessen wenn der Payload manuell zusammengebaut wird.
- Prisma-Schema prüfen: Heißt das Feld `finalPrice`, `final_price_eur` oder anders? Spaltname muss im API-Handler und im Frontend konsistent sein.
- Prüfen ob das Feld in der Zod-Validierung des Admin-Update-Endpoints definiert ist — fehlt es dort, wird es vom Validator stillschweigend verworfen.

### Story Points: 3
### Status: Draft

---

## Story: IT14-S05 — Feature: Barzahlung als Zahlungsoption hinzufügen

**Kategorie:** Feature
**Priorität:** P1 (kaputte / fehlende Funktion)

**Als** Admin,
**möchte ich** bei einer Buchungsanfrage „Barzahlung" als Zahlungsart auswählen
und speichern,
**so dass** ich Aufträge die vor Ort in bar bezahlt werden korrekt erfassen kann.

### Acceptance Criteria

- [ ] GIVEN Tom öffnet die Detail-Ansicht einer Buchungsanfrage im Admin-Dashboard, WHEN die Zahlungsart-Auswahl angezeigt wird, THEN ist „Barzahlung" (oder „Bar") als Option neben den bestehenden Optionen auswählbar.
- [ ] GIVEN Tom wählt „Barzahlung" und speichert, WHEN die Anfrage erneut geöffnet wird, THEN ist „Barzahlung" als gewählte Zahlungsart angezeigt.
- [ ] GIVEN die bestehenden Zahlungsoptionen (z.B. Überweisung, Karte), WHEN „Barzahlung" hinzugefügt wird, THEN funktionieren sie weiterhin unverändert — keine Regression.
- [ ] GIVEN Barzahlung gewählt und gespeichert, WHEN `GET /api/admin/bookings/[id]` aufgerufen wird, THEN enthält die API-Response den Zahlungsart-Wert `CASH` (oder äquivalent laut Enum).

### Out of Scope

- Kein automatisches E-Mail-Versand an den Kunden bei Barzahlung-Auswahl.
- Keine Änderung am Kunden-sichtbaren Buchungsformular (Zahlungsart ist ein Admin-internes Feld).
- Kein Kassenbuch oder Bargeld-Tracking.

### Hinweise an Architect/Engineers

- Prisma-Schema prüfen: Gibt es ein `PaymentMethod`-Enum? Falls ja, `CASH` als neuen Wert hinzufügen und Migration erstellen. Falls die Zahlungsart als String gespeichert wird, ist keine Migration nötig.
- Prüfen ob `CASH` bereits als Enum-Wert existiert aber nur im Frontend fehlt (UI-only-Fix) oder ob das Schema erweitert werden muss.
- Wenn eine Prisma-Migration nötig ist, muss sie in `scripts/apply-it14-migrations.sh` (oder analog zu IT13) für Production eingespielt werden.
- Frontend: das Dropdown/Select für Zahlungsart in der Admin-Booking-Detail-Komponente um den neuen Eintrag erweitern.

### Story Points: 2
### Status: Draft

---

## Story: IT14-S06 — Bug: Admin-Kalender „Buchung öffnen" führt zu 404

**Kategorie:** Bug
**Priorität:** P1 (kaputte Funktion)

**Als** Admin,
**möchte ich** im Kalender einen Termin auswählen und direkt zur zugehörigen
Buchungsanfrage navigieren,
**so dass** ich schnell Detailinfos zu einem Auftrag aufrufen kann ohne manuell
im Dashboard suchen zu müssen.

### Fehlerbeschreibung / Kontext

Tom öffnet `/admin/calendar`, klickt auf einen Kalender-Eintrag und klickt dann
auf „Buchung öffnen" — er erhält HTTP 404. Die Detail-Route stimmt nicht: entweder
der Link im Kalender verweist auf eine nicht existente Route (z.B. `/admin/booking/[id]`
statt `/admin/bookings/[id]`), oder die Route existiert unter einem anderen Pfad,
oder die Booking-ID wird falsch übergeben.

### Acceptance Criteria

- [ ] GIVEN Tom öffnet `/admin/calendar` und klickt auf einen Kalender-Eintrag, WHEN das Eintrag-Popup oder die Detail-Ansicht erscheint, THEN ist ein „Buchung öffnen"-Link oder -Button sichtbar.
- [ ] GIVEN Tom klickt auf „Buchung öffnen", WHEN der Browser navigiert, THEN lädt die Buchungsdetail-Seite korrekt mit den Informationen der ausgewählten Buchung — HTTP 200, kein 404.
- [ ] GIVEN mehrere Kalender-Einträge vorhanden sind, WHEN Tom bei verschiedenen Einträgen auf „Buchung öffnen" klickt, THEN wird jeweils die korrekte Buchung geöffnet (korrekte ID-Zuordnung).
- [ ] GIVEN die Kalenderansicht auf einem Smartphone (Viewport < 768px) geöffnet ist, WHEN Tom einen Eintrag auswählt, THEN ist der „Buchung öffnen"-Link ohne Scrollen oder Zoomen erreichbar.

### Out of Scope

- Kein Redesign der Kalenderansicht.
- Kein neues Routing-System.

### Hinweise an Architect/Engineers

- Im Kalender-Komponenten-Code (wahrscheinlich `src/app/admin/calendar/`) die Link-Generierung prüfen: Welche URL wird für „Buchung öffnen" zusammengebaut? Ist es `/admin/bookings/${id}` oder `/admin/booking/${id}` (Singular vs. Plural)?
- Prüfen welche Admin-Routen tatsächlich unter `src/app/admin/` existieren: `app/admin/bookings/[id]/page.tsx`? `app/admin/requests/[id]/page.tsx`? Den korrekten Pfad im Kalender-Link verwenden.
- Prüfen ob die Booking-ID die der Kalender-Event-Handler weitergibt tatsächlich die DB-ID ist oder ein anderes Identifier-Format (z.B. eine Slot-ID statt Booking-ID).

### Story Points: 2
### Status: Draft

---

## Story: IT14-S07 — Bug: Abgeschlossene Aufträge erscheinen nicht in den Analytics

**Kategorie:** Bug
**Priorität:** P0 (Datenintegrität / Tom kann Einnahmen nicht tracken)

**Als** Admin,
**möchte ich** in den Auswertungen alle abgeschlossenen Aufträge inklusive ihrer
Endpreise sehen,
**so dass** ich meine tatsächlichen Einnahmen korrekt auswerten kann.

### Fehlerbeschreibung / Kontext

Tom hat einen Auftrag abgeschlossen und den Endpreis notiert — dieser erscheint
in den Analytics nicht. Mögliche Ursachen: (1) Analytics aggregiert nur Buchungen
mit Status `PAID` statt `DONE`/`COMPLETED`, (2) der Default-Zeitraum-Filter
schließt den Auftrag aus (z.B. „dieser Monat" wenn der Auftrag letzten Monat war),
(3) der `finalPrice` wird nicht korrekt in die Aggregations-Abfrage einbezogen
(Preis-Persistierungs-Bug aus IT14-S04 könnte ebenfalls hier wirken).

### Acceptance Criteria

- [ ] GIVEN Tom hat einen Auftrag mit Status „Abgeschlossen" (DONE/COMPLETED) und einem gespeicherten Endpreis, WHEN er die Auswertungen aufruft, THEN erscheint dieser Auftrag in der Umsatz-Übersicht.
- [ ] GIVEN der Default-Zeitraum-Filter der Analytics, WHEN Tom die Auswertungen aufruft, THEN zeigt der Filter den aktuellen Monat an — oder einen Zeitraum der aktuelle Daten enthält (nicht z.B. „letztes Jahr" als Default).
- [ ] GIVEN mehrere abgeschlossene Aufträge mit Endpreisen, WHEN die Umsatz-Summe angezeigt wird, THEN entspricht die Summe der Addition aller `finalPrice`-Werte der abgeschlossenen Aufträge.
- [ ] GIVEN ein Auftrag hat keinen Endpreis gesetzt, WHEN er in den Analytics erscheint, THEN wird er als „0 €" oder „Kein Preis" dargestellt — er fehlt nicht vollständig aus der Auftragsliste.
- [ ] GIVEN die Root-Ursache identifiziert ist (Status-Filter-Bug, Zeitraum-Bug oder fehlendes Join), THEN ist sie im PR dokumentiert.

### Out of Scope

- Kein Redesign der Analytics-Seite.
- Keine neuen Diagrammtypen oder Export-Funktionen.
- Diese Story setzt voraus dass IT14-S04 (Preis speichern) behoben ist — ein Preis der nie gespeichert wurde kann auch in Analytics nicht erscheinen.

### Hinweise an Architect/Engineers

- Analytics-API-Endpoint prüfen (wahrscheinlich `GET /api/admin/analytics` oder `/api/admin/stats`): Welche Status-Werte werden in der `WHERE`-Klausel gefiltert? Wenn nur `status = 'PAID'`, muss auf `status IN ('DONE', 'COMPLETED', 'PAID')` erweitert werden (je nach Enum-Wert im Prisma-Schema).
- Prisma-Abfrage für die Umsatz-Aggregation prüfen: Wird `finalPrice` als Feld korrekt in der `sum`-Aggregation referenziert? (`_sum: { finalPrice: true }` in Prisma).
- Default-Zeitraum-Filter prüfen: Wenn der Filter auf `createdAt >= startOfMonth` gesetzt ist und der Auftrag in einem anderen Monat abgeschlossen wurde, fehlt er. Prüfen ob der Filter auf `updatedAt` oder `completedAt` stützt, und ob der Default-Zeitraum sinnvoll ist.
- IT14-S04 muss zuerst behoben sein — ohne korrekte Preis-Persistierung nützt auch ein korrekter Analytics-Filter nichts.

### Story Points: 3
### Status: Draft

---

## Story: IT14-S08 — Bug: Image-Upload funktioniert in Production nicht

**Kategorie:** Bug
**Priorität:** P1 (kaputte Funktion)

**Als** Kunde,
**möchte ich** Bilder zum Buchungsformular hochladen können,
**so dass** Tom einen visuellen Eindruck des Auftrags erhält.

### Fehlerbeschreibung / Kontext

Tom meldet, dass Image-Uploads in Production weiterhin nicht funktionieren.
IT13-S05 hat das Upload-System komplett auf einen Direct-Upload-Flow umgestellt
(Token-Endpoint → Vercel Blob direkt → Confirm-Endpoint) und der QA-Reviewer
hat den Code als ✅ Conditional (Code ready, Tom-Setup nötig) bewertet. Die
Production-Verifikation aus IT13 hat den Upload offenbar nicht bestätigt —
entweder wurde der `BLOB_READ_WRITE_TOKEN` nicht korrekt gesetzt, oder es gibt
ein Problem mit dem neuen Direct-Upload-Flow in Production das lokal nicht
reproduzierbar ist.

### Acceptance Criteria

- [ ] GIVEN ein Nutzer (eingeloggt oder Gast) öffnet das Buchungsformular und wählt ein JPEG oder PNG unter 10 MB, WHEN der Upload gestartet wird, THEN erscheint eine Fortschrittsanzeige (0–100 %) und nach Abschluss eine Bildvorschau — kein Fehler.
- [ ] GIVEN der Upload erfolgreich abgeschlossen ist und die Buchungsanfrage abgesendet wird, WHEN Tom die Anfrage im Admin-Dashboard öffnet, THEN sind die Bilder mit Vorschau und Download-Link sichtbar.
- [ ] GIVEN eine Datei über 10 MB ausgewählt wird, WHEN die Validierung greift, THEN erscheint die Fehlermeldung „Datei zu groß (max. 10 MB)" — kein technischer Fehler.
- [ ] GIVEN die Ursache des Production-Fehlers identifiziert ist (BLOB_READ_WRITE_TOKEN-Problem, Token-Drift, New-Endpoint-Issue), THEN ist sie im PR dokumentiert.
- [ ] GIVEN der Fix deployed ist, WHEN `POST /api/upload/token` in den Vercel-Production-Logs geprüft wird, THEN keine 503-Antworten mit `BLOB_NOT_CONFIGURED` und keine INTERNAL_ERROR-Antworten mehr.

### Out of Scope

- Kein Umbau des Upload-Flows (Direct-Upload aus IT13 bleibt bestehen).
- Keine Änderung der Upload-Größenlimits.
- Kein Video-Upload-Test (nur Bilder laut Tom's Feedback).

### Hinweise an Architect/Engineers

- Diagnose-Reihenfolge: (1) Vercel-Dashboard → Storage → Blob-Store: Existiert der Store noch? Ist das Project korrekt verbunden? (2) Vercel-Dashboard → Project → Settings → Environment Variables: Ist `BLOB_READ_WRITE_TOKEN` für den Production-Branch gesetzt? (3) Vercel-Production-Logs auf `[POST /api/upload/token]`-Einträge prüfen — gibt es `503 BLOB_NOT_CONFIGURED`? Wenn ja: Token fehlt oder Store-Zuordnung ist gebrochen. (4) Falls Token gesetzt: ist er dem richtigen Store zugeordnet? Ein neuer Deploy nach Store-Reinitialisierung kann den Token invalidieren.
- IT13-QA-Review §3.4: „Conditional-Begründung: AC#2/AC#3/AC#5/AC#6 erfordern Production-Verifikation dass `BLOB_READ_WRITE_TOKEN` korrekt zum aktuellen Vercel-Blob-Store gehört." — genau diesen Punkt verifizieren.
- Nach Token-Fix: manuellen Upload-Test in Production durchführen (kleines JPEG < 1 MB) und `X-Request-Id` aus dem Response-Header notieren um Logs korrelieren zu können.

### Story Points: 2
### Status: Draft

---

## Dependencies

- IT14-S04 (Preis speichern) sollte vor IT14-S07 (Analytics) behoben werden — ohne korrekte Preis-Persistierung fehlen Analytics-Daten an der Quelle.
- IT14-S02 (Auth-Gate) ist unabhängig von allen anderen Stories und sollte als erstes deployed werden (P0-Sicherheit).
- IT14-S01, IT14-S03, IT14-S05, IT14-S06, IT14-S08 sind unabhängig voneinander und können parallel bearbeitet werden.
- Empfohlene Bearbeitungsreihenfolge: IT14-S02 → IT14-S04 → IT14-S07 → IT14-S08 → IT14-S01 → IT14-S06 → IT14-S03 → IT14-S05.
