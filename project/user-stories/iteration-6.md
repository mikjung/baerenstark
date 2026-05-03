# EPIC-IT6: Iteration 6 — Admin-Reife, Auth-Bereinigung & Wachstums-Features

Neun Stories für den Übergang von Bärenstark Hausservice von einem funktionsfähigen MVP zu einer
produktionsreifen, mehrbenutzer-fähigen Plattform mit sauberem Auth-Stack, professioneller
Kalender-UX, Umsatz-Transparenz und lokaler SEO-Sichtbarkeit.

## Vision context

Mit Iteration 6 adressiert Bärenstark Hausservice die drei dringendsten Wachstumsblocker:
(1) Tom kann nicht alleine alle Admin-Aufgaben tragen — mehrere Admins werden unterstützt.
(2) Der bestehende Auth-Stack ist überladen und enthält einen aktiven Google-OAuth-Bug — er wird
auf zwei stabile Provider reduziert.
(3) Die Website ist organisch kaum auffindbar — SEO-Grundlage wird gelegt. Parallel dazu erhält
Tom interne Werkzeuge (Kundenbewertung mit echtem Abschluss-Trigger, interne Kundennotizen,
finaler Buchungspreis, Analytics), die ihn vom Handwerker zum informierten Unternehmer machen.

---

## Story: US-IT6-01 Weitere Admins anlegen

**Als** Admin (Tom),
**I want to** neue Admin-Konten anlegen, bestehende Admins deaktivieren und löschen können,
**so that** ich z.B. einer Unterstützungskraft Zugang zur Admin-Konsole geben kann, ohne mein
eigenes Passwort weiterzugeben.

### Acceptance Criteria
- [ ] Given ich öffne „Admin-Verwaltung", when die Seite lädt, then sehe ich alle Admin-Accounts mit Name, E-Mail und Status (aktiv/inaktiv).
- [ ] Given ich lege einen neuen Admin an (Name + E-Mail + initiales Passwort) und klicke Speichern, when verarbeitet, then erscheint der Account sofort in der Liste.
- [ ] Given nur noch ein Admin-Account existiert, when ich dessen Löschen-Button anklicke, then ist er deaktiviert mit Hinweis „Mindestens ein Admin muss immer vorhanden sein."
- [ ] Given ich deaktiviere einen Admin, when er sich einloggen will, then erhält er die Meldung „Ihr Konto wurde deaktiviert." und der Zugang wird verweigert.
- [ ] Given ein deaktivierter Admin ruft eine Admin-URL direkt auf, when die Middleware prüft, then wird er zur Login-Seite umgeleitet.
- [ ] Given ich editiere Name oder E-Mail eines bestehenden Admins und speichere, when verarbeitet, then ist die Änderung sofort in der Liste sichtbar.
- [ ] Given der aktuell eingeloggte Admin, when er versucht, seinen eigenen Account zu löschen oder zu deaktivieren, then wird die Aktion mit einem Hinweis blockiert.

### Notes
- Ein eingeloggter Admin kann sich nicht selbst löschen oder deaktivieren (Lock-out-Schutz).
- Passwort-Reset für Fremd-Admins: IT7-Backlog.

### Story Points: 5
### Priority: Must Have

---

## Story: US-IT6-02 Kalender-UX — Outlook/Google-Calendar-Style

**Als** Admin (Tom) und als Kunde,
**I want to** Zeitfenster in einer intuitiven Kalenderansicht verwalten bzw. buchen, vergleichbar mit Google Calendar oder Microsoft Outlook — mit dynamischer Zeitfenster-Erstellung,
**so that** die Termin-UX professionell wirkt und Fehler bei der Terminauswahl minimiert werden.

### Acceptance Criteria

**Admin-Kalender:**
- [ ] Given ich öffne „Kalender / Verfügbarkeit", when geladen, then sehe ich eine Wochen-/Tagesansicht mit Stunden-Zeitraster (analog Google Calendar).
- [ ] Given ich klicke auf einen freien Zeitblock oder markiere per Drag per-and-drop, when Interaktion, then öffnet sich ein Formular zur Slot-Erstellung mit vorausgefülltem Datum/Uhrzeit.
- [ ] Given bestätigte Buchungen existieren, when Kalender geladen, then sind sie als farbige Blöcke sichtbar (Grün = CONFIRMED, Blau = PENDING, Grau = Buffer).
- [ ] Given ich klicke auf einen Buchungsblock, when verarbeitet, then öffnet sich eine Detail-Popover mit Kundenname, Service, Dauer und Link zur Buchungsdetailseite.
- [ ] Given ich togglee zwischen Wochen- und Monatsansicht, when Klick, then wechselt die Ansicht ohne Seitenneuladen.

**Kunden-Kalender:**
- [ ] Given ich rufe die Buchungsseite auf, when geladen, then sehe ich eine Monatsansicht mit farblich markierten Tagen: verfügbar (grün), nicht verfügbar (grau/rot), heute (blau umrandet).
- [ ] Given ich klicke auf einen verfügbaren Tag, when ausgewählt, then erscheinen die buchbaren Zeitslots als klickbare Chips in 30-Minuten-Schritten.
- [ ] Given ich wähle einen Zeitslot, when ausgewählt, then ist er visuell hervorgehoben und das Buchungsformular wird mit Datum + Uhrzeit vorausgefüllt.
- [ ] Given ich nutze ein Smartphone, when ich den Kalender bediene, then sind alle Interaktionen touch-optimiert ohne horizontales Scrollen.

### Notes
- Empfohlene Admin-Bibliothek: `react-big-calendar` oder `@fullcalendar/react` (MIT-lizenziert).
- Drag-and-drop zum Verschieben bestätigter Buchungen ist Could Have / IT7, nicht IT6.
- Ersetzt/erweitert die Kalender-Implementierungen aus US-15, US-16, US-17 (Datenbasis bleibt erhalten).

### Story Points: 8
### Priority: Must Have

---

## Story: US-IT6-03 Kundenbewertungen nach Abschluss mit Admin-Freigabe (Verbesserung)

**Als** Kunde mit einem abgeschlossenen Auftrag (Status `COMPLETED`),
**I want to** eine Bewertung (1–5 Sterne + optionaler Text) abgeben können,
**so that** andere Interessenten von meiner Erfahrung profitieren und die Bewertung erst nach Abschluss und Admin-Freigabe erscheint.

### Acceptance Criteria
- [ ] Given mein Auftrag hat Status `COMPLETED`, when ich die Auftragsdetails öffne, then sehe ich den Button „Jetzt bewerten".
- [ ] Given mein Auftrag hat einen anderen Status (PENDING, CONFIRMED, REJECTED, CANCELLED), when ich die Auftragsdetails öffne, then ist kein Bewertungs-Button sichtbar.
- [ ] Given ich schicke eine Bewertung ab, when gespeichert, then hat sie den internen Status `PENDING_APPROVAL` und ist für Endkunden nicht sichtbar.
- [ ] Given Tom öffnet die Bewertungsverwaltung im Admin-Bereich, when eine neue Bewertung mit Status `PENDING_APPROVAL` vorliegt, then sieht er Kundenname, Buchungsdatum, Service, Sternezahl, Text und kann „Freigeben" oder „Ablehnen" klicken.
- [ ] Given Tom gibt eine Bewertung frei (Status `APPROVED`), when die Startseite geladen wird, then erscheint die Bewertung in der öffentlichen Feedback-Sektion.
- [ ] Given `GET /api/reviews` aufgerufen wird, when verarbeitet, then enthält die Response ausschließlich Bewertungen mit Status `APPROVED` — niemals `PENDING_APPROVAL` oder `REJECTED`.
- [ ] Given ich habe für einen Auftrag bereits eine Bewertung abgegeben, when ich den Auftrag erneut öffne, then ist der Bewertungs-Button deaktiviert und die Bewertung schreibgeschützt sichtbar.

### Notes
- US-29 (IT4) hat die Grundstruktur implementiert; US-IT6-03 stellt sicher, dass der Trigger ausschließlich auf `COMPLETED` (nicht `CONFIRMED`) basiert und dass `PENDING_APPROVAL`-Bewertungen niemals in öffentlichen API-Responses erscheinen.

### Story Points: 3
### Priority: Must Have

---

## Story: US-IT6-04 SEO-Optimierung der gesamten Website

**Als** Besucher (und Google-Crawler),
**I want to** eine technisch sauber optimierte Website vorfinden,
**so that** Bärenstark bei lokalen Suchanfragen in Darmstadt und Umgebung gut auffindbar ist.

### Acceptance Criteria
- [ ] Given ich prüfe den Quelltext einer beliebigen öffentlichen Seite, when geladen, then enthält jede Seite ein eindeutiges `<title>` (max. 60 Zeichen) und eine `<meta name="description">` (max. 160 Zeichen) mit relevantem Keyword-Bezug.
- [ ] Given ich teile die Startseite auf WhatsApp oder Facebook, when der Link gepostet wird, then zeigt die Vorschau korrekte Open-Graph-Tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`).
- [ ] Given ein Crawler ruft `/sitemap.xml` auf, when geliefert, then gibt die Datei eine gültige XML-Sitemap mit allen öffentlichen Seiten (Startseite, Services, Buchung, Impressum, Datenschutz) samt `<loc>` und `<lastmod>` zurück.
- [ ] Given ein Crawler ruft `/robots.txt` auf, when geliefert, then erlaubt die Datei das Crawlen öffentlicher Seiten und sperrt `/admin/*` und `/api/*`.
- [ ] Given ich prüfe den HTML-Output mit einem SEO-Linter, when geprüft, then enthalten alle Seiten semantische HTML5-Elemente (`<header>`, `<main>`, `<footer>`, `<nav>`, `<article>`, `<section>`).
- [ ] Given ich prüfe die Startseite mit Google Rich Results Test, when geprüft, then ist ein valides `LocalBusiness`-JSON-LD vorhanden mit `name`, `address`, `telephone`, `url`, `openingHours`.
- [ ] Given ich messe die Startseite mit Lighthouse Desktop, when gemessen, then erzielt die Seite einen Performance-Score von mindestens 80/100.

### Notes
- `sitemap.xml` und `robots.txt` als Next.js Route Handler implementieren.
- `openingHours` im Structured Data: Tom muss Werte bestätigen. Platzhalter: Mo–Fr 07:00–18:00.
- Lighthouse 80+ setzt `next/image` und WebP-Bilder voraus.

### Story Points: 5
### Priority: Must Have

---

## Story: US-IT6-05 Auth-Bereinigung — nur Google und Facebook OAuth

**Als** Admin (Tom),
**I want to** dass sich Kunden ausschließlich über Google OAuth oder Facebook OAuth anmelden können — alle anderen Provider werden entfernt und der Google-„Bad request"-Fehler wird behoben —,
**so that** die Anmeldestrecke übersichtlich und wartungsarm ist.

### Acceptance Criteria
- [ ] Given ich rufe `/konto/login` auf, when geladen, then sehe ich ausschließlich „Mit Google anmelden" und „Mit Facebook anmelden" — kein E-Mail/Passwort-Formular, kein GitHub-Button.
- [ ] Given ein Kunde klickt „Mit Google anmelden" und schließt den Flow ab, when verarbeitet, then ist er eingeloggt und wird zu `/konto` weitergeleitet — ohne „Bad request"-Fehler.
- [ ] Given ein Kunde klickt „Mit Facebook anmelden" und schließt den Flow ab, when verarbeitet, then ist er eingeloggt und wird zu `/konto` weitergeleitet.
- [ ] Given ein Kunde bricht den OAuth-Flow ab oder der Provider gibt einen Fehler zurück, when zurückgeleitet, then erscheint eine deutschsprachige Fehlermeldung auf `/konto/login`.
- [ ] Given die Route `/konto/registrieren` (E-Mail/Passwort) und `/api/auth/register` existierten bisher, when IT6 deployed wird, then geben diese Routen HTTP 404 zurück.
- [ ] Given ein bestehender E-Mail/Passwort-Kunde versucht sich einzuloggen, when der Versuch verarbeitet wird, then erscheint der Hinweis „Die E-Mail/Passwort-Anmeldung ist nicht mehr verfügbar. Bitte melden Sie sich mit Google oder Facebook an."
- [ ] Given ich prüfe die NextAuth-Konfiguration, when gelesen, then sind nur `GoogleProvider` und `FacebookProvider` konfiguriert — kein `GitHubProvider`, kein `CredentialsProvider`.

### Notes
- Der Google-„Bad request"-Fehler ist voraussichtlich auf falsch konfigurierte Redirect-URIs in der Google Cloud Console zurückzuführen. Architekt muss OAuth-App-Konfigurationen in Google Cloud Console und Meta Developer Portal prüfen.
- Facebook OAuth erfordert verifizierte App-Domain (kein localhost in Produktion).
- Benötigte Env-Variablen: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` — Tom liefert diese.

### Story Points: 5
### Priority: Must Have

---

## Story: US-IT6-06 Alle User-Accounts löschen (Datenbank-Reset)

**Als** Admin (Tom),
**I want to** alle bestehenden Kunden-Registrierungen und Admin-Accounts aus der Datenbank löschen lassen,
**so that** ich mit einem sauberen Stand neu starten und mich als erster Admin frisch registrieren kann.

### Acceptance Criteria
- [ ] Given das Migrations-Skript wurde ausgeführt, when ich die DB prüfe, then enthält `CustomerUser` keine Einträge.
- [ ] Given das Migrations-Skript wurde ausgeführt, when ich die DB prüfe, then enthält `User` (Admin) keine Einträge.
- [ ] Given Buchungen mit Status `COMPLETED` oder `CONFIRMED` existierten, when das Skript läuft, then werden diese anonymisiert: `customerId` = NULL, Buchungsdaten (Datum, Service, Preis) bleiben erhalten.
- [ ] Given Buchungen mit Status `PENDING` oder `COUNTER_PROPOSED` existierten, when das Skript läuft, then werden diese auf `CANCELLED` gesetzt und `customerId` = NULL.
- [ ] Given das Skript erfolgreich durchgelaufen ist, when die Zusammenfassung ausgegeben wird, then enthält sie: Anzahl gelöschter CustomerUser-Einträge, Anzahl gelöschter User-Einträge, Anzahl anonymisierter Buchungen, Anzahl stornierter Buchungen.
- [ ] Given Tom nach dem Reset `/admin/login` aufruft und sich einloggt, when authentifiziert, then ist er der einzige Admin.

### Notes
- Einmaliges Migrations-Skript, kein dauerhafter Feature-Toggle.
- Implementierung als `scripts/reset-users.ts` (ts-node).
- Datenbank-Backup vor Ausführung empfohlen.
- DSGVO: Hartes Löschen auf explizitem Betreiberauftrag (Tom ist Verantwortlicher) zulässig. Anonymisierung abgeschlossener Buchungen erhält Buchhaltungsdaten.

### Story Points: 2
### Priority: Must Have

---

## Story: US-IT6-07 Admin-Nutzerverwaltung mit internem Kommentar und Rating

**Als** Admin (Tom),
**I want to** alle registrierten Kunden einsehen, editieren, löschen sowie interne Notizen und eine interne Sternebewertung (1–5) pro Kunde hinterlegen können,
**so that** ich gute und schlechte Kunden unterscheiden und interne Hinweise festhalten kann — ohne dass diese Daten jemals für Kunden sichtbar sind.

### Acceptance Criteria
- [ ] Given ich öffne „Nutzerverwaltung", when geladen, then sehe ich eine Tabelle aller CustomerUser mit Name, E-Mail, Registrierungsdatum, Buchungsanzahl und internem Admin-Rating (Sterne-Icon).
- [ ] Given ich öffne das Kundenprofil, when geladen, then sehe ich alle Profilfelder plus zwei admin-exklusive Felder: „Internes Kommentarfeld" (Freitext, max. 1000 Zeichen) und „Interne Bewertung" (1–5 klickbare Sterne).
- [ ] Given ich speichere eine interne Notiz oder ein Admin-Rating, when gespeichert, then erscheint „Gespeichert" und die Werte sind beim nächsten Öffnen noch vorhanden.
- [ ] Given ein Kunde ruft `/konto/profil` auf, when geladen, then sind weder `adminNote` noch `adminRating` sichtbar oder in der HTTP-Response enthalten.
- [ ] Given `GET /api/customer/profile` aufgerufen wird, when Response, then enthält kein `adminNote`- und kein `adminRating`-Feld.
- [ ] Given ich lösche einen Kunden, when der Dialog bestätigt wird, then wird der CustomerUser-Eintrag hart gelöscht; verknüpfte Buchungen werden anonymisiert (customerId = NULL, Buchungsdaten erhalten).
- [ ] Given ich editiere Profildaten eines Kunden und speichere, when verarbeitet, then sind die Änderungen sofort in Nutzerliste und Kundenprofil sichtbar.
- [ ] Given ich suche per Freitext (Name oder E-Mail, mind. 2 Zeichen), when eingegeben (Debounce 300 ms), then wird die Liste auf passende Einträge gefiltert (case-insensitive).

### Notes
- `adminNote` (String, nullable) und `adminRating` (Int, nullable, 1–5) als neue Felder im `CustomerUser`-Prisma-Modell.
- Prisma-Select in allen Kunden-facing Endpunkten (`/api/customer/*`, `/api/auth/*`) muss diese Felder explizit ausschließen.
- Das interne Admin-Rating hat nichts mit öffentlichen Kundenbewertungen (US-IT6-03 / US-29) zu tun.

### Story Points: 5
### Priority: Must Have

---

## Story: US-IT6-08 Finaler Preis pro Buchung (EUR-Betrag)

**Als** Admin (Tom),
**I want to** bei jeder Buchung einen finalen Euro-Betrag (`final_price_eur`) hinterlegen können,
**so that** ich meine Einnahmen pro Auftrag direkt in der Buchungsübersicht sehe und eine Datenbasis für die Analytics-Auswertung habe.

### Acceptance Criteria
- [ ] Given ich öffne die Buchungsdetailansicht im Admin-Portal, when geladen, then sehe ich das editierbare Feld „Finaler Preis (EUR)" (leer = nicht gesetzt, Platzhalter: „0,00 €").
- [ ] Given ich gebe einen Betrag ein (z.B. „185,00") und speichere, when verarbeitet, then erscheint „Gespeichert" und der Betrag ist in der Buchungsübersichtsliste sichtbar.
- [ ] Given ich gebe einen ungültigen Wert ein (negativ oder nicht-numerisch), when ich speichere, then erscheint „Bitte geben Sie einen gültigen Betrag in Euro ein (z.B. 150,00)."
- [ ] Given eine Buchung hat `final_price_eur` gesetzt, when die Buchungsübersicht geladen wird, then ist der Betrag pro Eintrag als Badge oder Spalte sichtbar.
- [ ] Given ein Kunde ruft Buchungsdetails im Kundenportal auf, when geladen, then ist `final_price_eur` nicht sichtbar.
- [ ] Given `GET /api/bookings/:id` (Kunden-API) aufgerufen wird, when Response, then enthält kein `final_price_eur`-Feld.

### Notes
- `final_price_eur` als `Decimal?` (nullable) im `Booking`-Prisma-Modell ergänzen.
- Vom Stripe-Betrag (US-28) unabhängig — deckt auch Barzahlung ab.
- Dezimaltrenner in der UI: Komma (DE-Format). API-Validierung: `>= 0`.
- Wird als Umsatz-Basis für US-IT6-09 (Analytics) verwendet.

### Story Points: 3
### Priority: Must Have

---

## Story: US-IT6-09 Analytics-Seite in der Admin-Konsole

**Als** Admin (Tom),
**I want to** in der Admin-Konsole eine Übersichtsseite mit Umsatz, Buchungsvolumen und Service-Performance sehen,
**so that** ich auf einen Blick erkenne, wie sich das Geschäft entwickelt, und fundierte Entscheidungen treffen kann.

### Acceptance Criteria
- [ ] Given ich öffne „Analytics" in der Admin-Konsole, when geladen, then sehe ich KPI-Kacheln: „Gesamtumsatz (gesetzt)", „Abgeschlossene Buchungen gesamt", „Durchschnittlicher Auftragswert", „Buchungen diesen Monat".
- [ ] Given ich wähle einen Zeitraum-Filter (Monat, Quartal, Jahr, benutzerdefiniert), when angewendet, then aktualisieren sich alle KPI-Kacheln und Diagramme.
- [ ] Given das Umsatz-Diagramm angezeigt wird, when geladen, then zeigt es monatlichen Umsatz (Summe `final_price_eur` nach COMPLETED-Buchungen) der letzten 12 Monate als Balken- oder Liniendiagramm.
- [ ] Given die Service-Aufschlüsselung angezeigt wird, when geladen, then zeigt ein Tortendiagramm oder eine sortierte Liste die Anzahl abgeschlossener Buchungen pro Service-Typ.
- [ ] Given keine Buchungen mit gesetztem `final_price_eur` existieren, when die Analytics-Seite geladen wird, then zeigen die Kacheln „0" oder „–" ohne Fehler und es erscheint der Hinweis „Noch keine Umsatzdaten vorhanden."
- [ ] Given ich klicke auf eine KPI-Kachel (z.B. „Abgeschlossene Buchungen diesen Monat"), when Klick, then navigiere ich zur gefilterten Buchungsliste mit den entsprechenden Buchungen.
- [ ] Given `GET /api/admin/analytics` von einem nicht-autorisierten Request aufgerufen wird, when verarbeitet, then gibt der Endpoint HTTP 401 zurück.

### Notes
- Empfohlene Charting-Bibliothek: `recharts` (MIT, weit verbreitet in Next.js-Projekten) oder `chart.js` + `react-chartjs-2`.
- Buchungen ohne `final_price_eur` = NULL werden nicht in Umsatzsummen gezählt.
- Datums-Aggregation erfolgt serverseitig im API-Endpunkt.
- Abhängig von US-IT6-08 (final_price_eur muss existieren).

### Story Points: 5
### Priority: Must Have

---

## Dependencies

- US-IT6-03 hängt implizit von bestehendem US-29 (IT4) ab — Grundstruktur bleibt erhalten, wird korrigiert.
- US-IT6-08 ist Voraussetzung für US-IT6-09 (`final_price_eur`-Feld muss existieren, bevor Analytics darauf zugreift).
- US-IT6-06 (DB-Reset) sollte vor US-IT6-07 (Nutzerverwaltung) ausgeführt werden, da danach ein frischer Zustand besteht.
- US-IT6-05 (Auth-Bereinigung) ist unabhängig, aber beeinflusst US-IT6-06 (nach Reset registrieren sich neue Nutzer nur noch per OAuth).
- US-IT6-01 (Admin-Verwaltung) hängt von keiner anderen IT6-Story ab — kann parallel entwickelt werden.
- US-IT6-04 (SEO) ist vollständig unabhängig — kann parallel zu allen anderen Stories entwickelt werden.
