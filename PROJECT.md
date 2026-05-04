# Bärenstark Hausservice — Projekt

## Vision
Professionelle, mobiloptimierte Website für Bärenstark Hausservice (Darmstadt), die Besuchern das Service-Portfolio präsentiert und unkomplizierte Online-Buchung ermöglicht. Tom Siefert verwaltet Anfragen zentral ohne technisches Vorwissen. Erfolg in 6 Monaten: stabiler Produktionsbetrieb, messbare Buchungsanfragen über die Website, keine manuellen Supportanfragen durch Systemfehler.

## Stack & Stammdaten
- **Stack:** Next.js 14 App Router, Prisma + Turso (libSQL), NextAuth v5 (separate Customer- und Admin-Auth), Vercel (Hobby), Resend, Vercel Blob
- **Domain:** https://www.baerenstark-hausservice.app
- **Inhaber:** Tom Siefert — 0157-74787512 — hausservice-baerenstark@outlook.com — Darmstadt
- **Services:** Entrümpelungen, Entkernungsarbeiten, Reinigungsarbeiten, Grünflächenpflege, Mülltonnenservice, Entsorgung Schrott/Metalle
- **Design:** Braun/Beige/Holz, Mobile-first, Logo: `public/logo.png`

## Iterations-Übersicht
| IT | Titel/Fokus | Stories | Status |
|----|-------------|---------|--------|
| IT1 | Portfolio, Buchung & Admin-MVP | US-01–US-08, US-12 | ✅ Done |
| IT2 | Alternativtermin, Storno, Wochentag-Kalender | BUG-US-04, US-13–US-16 | ✅ Done |
| IT3 | Zeitfenster-Redesign, Upload, Popups, E-Mails | BUG-IT3, US-17–US-24 | ✅ Done |
| IT4 | Kundenportal, Bewertungen, Zahlung | US-25–US-29 | ✅ Done |
| IT5 | Passwort-Reset, OAuth, Adresse, Dauer, Buffer | US-30–US-34 | ✅ Done |
| IT6 | Admin-Reife, Auth-Bereinigung, Analytics, SEO | US-IT6-01–US-IT6-09 | ✅ Done |
| IT7 | Auth-Stabilisierung, Email-Auth-Wiederherstellung | US-IT7-01–US-IT7-05 | ✅ Done |
| IT8 | Bugfix-Sweep, DayOverride-Sichtbarkeit | US-IT8-01–US-IT8-05 | ✅ Done |
| IT9 | Admin-Stabilität, Kunden-Adresse, Buchungs-Kalender | US-IT9-01–US-IT9-04 | ✅ Done |
| IT9-UX | UX-Review-Backlog (Buckets A–D) | US-UX-A-01–07, B-01–04, C-01–06, D-01–03 | 🟡 Backlog |
| IT10 | Bug-Triage & Customer-Self-Service | US-IT10-01–US-IT10-05 | ✅ Done |
| IT11 | Produktions-Stabilisierung & UX-Konsolidierung | US-IT11-01–US-IT11-06 | ✅ Done |
| IT12 | Stakeholder-Feedback-Sweep | IT12-S01–IT12-S15 | ✅ Done |

---

## User Stories — Vollständig

### Iteration 1 — Portfolio, Buchung & Admin-MVP

#### IT1-US-01 — Service-Portfolio einsehen
**Type:** Feature
**Story:** Als Besucher möchte ich alle Services auf einen Blick sehen, damit ich einschätzen kann, ob Bärenstark der richtige Anbieter ist.
**AC:**
- Given Startseite geladen, Then alle 6 Services mit Titel + Beschreibung sichtbar.
- Given Smartphone, Then Karten lesbar ohne horizontales Scrollen.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT1-US-02 — Kontaktinformationen finden
**Type:** Feature
**Story:** Als Besucher möchte ich Telefon und E-Mail sofort finden, damit ich direkt Kontakt aufnehmen kann.
**AC:**
- Given beliebige Seite, When Footer erreicht, Then Telefon, E-Mail und Standort sichtbar.
- Given Smartphone, When auf Telefonnummer getippt, Then Telefon-App öffnet sich.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 1

---

#### IT1-US-03 — Verfügbare Zeitfenster anzeigen
**Type:** Feature
**Story:** Als Kunde möchte ich sehen, wann Bärenstark verfügbar ist, damit ich einen passenden Termin wählen kann.
**AC:**
- Given Buchungsseite geladen, Then Liste/Kalender der freigegebenen Zeitfenster sichtbar.
- Given Zeitfenster ausgebucht, Then als nicht buchbar markiert und nicht wählbar.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT1-US-04 — Buchungsanfrage stellen
**Type:** Feature
**Story:** Als Kunde möchte ich ein Zeitfenster wählen und Kontaktdaten hinterlassen, damit Tom meine Anfrage prüfen kann.
**AC:**
- Given Formular ausgefüllt und abgeschickt, Then Bestätigungsmeldung erscheint.
- Given Pflichtfeld leer, When Absenden, Then Inline-Fehlermeldung am Feld.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT1-US-05 — Zeitfenster einpflegen (Admin)
**Type:** Feature
**Story:** Als Admin möchte ich Zeitfenster anlegen und löschen, damit Kunden nur verfügbare Termine buchen können.
**AC:**
- Given Zeitfenster gespeichert, Then sofort in öffentlicher Buchungsansicht sichtbar.
- Given Zeitfenster gelöscht, Then innerhalb von Sekunden nicht mehr buchbar.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT1-US-06 — Buchungsanfragen verwalten (Admin)
**Type:** Feature
**Story:** Als Admin möchte ich alle Anfragen einsehen und bestätigen/ablehnen, damit ich den Überblick behalte.
**AC:**
- Given Anfragen-Bereich geöffnet, Then Anfragen mit Name, Service, Zeitfenster, Status sichtbar.
- Given Klick auf „Bestätigen", Then Status auf „bestätigt", Zeitfenster als belegt markiert.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT1-US-07 — Admin-Login
**Type:** Feature
**Story:** Als Admin möchte ich mich mit Benutzername/Passwort einloggen, damit nur ich Zugang zur Verwaltung habe.
**AC:**
- Given gültige Zugangsdaten, Then Weiterleitung zu Admin-Dashboard.
- Given falsche Daten, Then Fehlermeldung ohne Offenlegung ob User existiert.
- Given nicht eingeloggt, When Admin-URL aufgerufen, Then Weiterleitung zu Login.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT1-US-08 — E-Mail-Benachrichtigung bei neuer Anfrage
**Type:** Feature
**Story:** Als Admin möchte ich eine E-Mail bei neuer Buchungsanfrage erhalten, damit ich schnell reagieren kann.
**AC:**
- Given Buchungsformular erfolgreich verarbeitet, Then E-Mail an hausservice-baerenstark@outlook.com mit Kundendetails.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT1-US-12 — Impressum und Datenschutz
**Type:** Feature
**Story:** Als Besucher möchte ich Impressum und Datenschutz einsehen, damit die Website rechtlich konform ist.
**AC:**
- Given Footer-Link geklickt, Then Unterseite mit gesetzlichen Angaben öffnet sich.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 1

---

### Iteration 2 — Alternativtermin, Storno, Wochentag-Kalender

#### IT2-BUG-US-04 — Buchungsanfrage absenden schlägt fehl
**Type:** Bug
**Story:** Als Kunde möchte ich eine Anfrage erfolgreich absenden, damit Tom sie im Portal sieht.
**AC:**
- Given Formular abgesendet, Then Anfrage erscheint sofort unter „Anfragen" im Admin-Portal.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT2-US-13 — Alternativtermin vorschlagen (Admin)
**Type:** Feature
**Story:** Als Admin möchte ich einer Anfrage einen Alternativtermin schicken, damit ich flexibel reagieren kann ohne sofort abzulehnen.
**AC:**
- Given Klick auf „Alternativtermin vorschlagen" + Datum eingegeben, Then Status auf „Alternativvorschlag gesendet", Kunde erhält E-Mail mit Aktionslink.
- Given Kunde klickt „Vorschlag annehmen", Then Status auf „bestätigt", Tom erhält Benachrichtigung.
- Given Aktionslink bereits verwendet, Then Hinweisseite „Link nicht mehr gültig".
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT2-US-14 — Anfrage stornieren (Kunde, ohne Portal)
**Type:** Feature
**Story:** Als Kunde möchte ich meine Anfrage über den cancelToken-Link stornieren, ohne Tom persönlich kontaktieren zu müssen.
**AC:**
- Given Stornierungslink geöffnet und bestätigt, Then Status auf „storniert", Zeitfenster freigegeben, Tom erhält E-Mail.
- Given Link bereits verwendet oder Anfrage in Endstatus, Then Hinweisseite.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT2-US-15 — Wochentag-basierte Verfügbarkeit (Admin)
**Type:** Feature
**Story:** Als Admin möchte ich Wochentage als verfügbar/nicht verfügbar definieren, damit Kunden nur realistisch buchbare Tage sehen.
**AC:**
- Given Wochentag-Einstellungen gespeichert, Then sofort in öffentlicher Kalenderansicht sichtbar.
- Given bestätigte Buchung vorhanden, Then als Blocker in Kalenderansicht hervorgehoben.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT2-US-16 — Kalenderansicht für Kunden
**Type:** Feature
**Story:** Als Kunde möchte ich einen Kalender mit grün/rot markierten Tagen sehen, damit ich sofort erkenne wann ich buchen kann.
**AC:**
- Given Buchungsseite geladen, Then Monatsansicht mit verfügbar (grün) / nicht verfügbar (rot) / vergangene Tage (nicht buchbar).
- Given Klick auf verfügbaren Tag, Then Buchungsformular mit vorausgefülltem Datum öffnet sich.
- Given Smartphone, Then Kalender touch-freundlich ohne horizontales Scrollen.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

### Iteration 3 — Zeitfenster-Redesign, Upload, Popups, E-Mails

#### IT3-BUG — Buchungsformular-Übermittlung schlägt fehl
**Type:** Bug
**Story:** Als Kunde möchte ich das Formular erfolgreich absenden, damit Tom die Anfrage erhält und ich Rückmeldung bekomme.
**AC:**
- Given Formular abgesendet, Then Anfrage im Admin-Portal, Tom erhält E-Mail, Kunde sieht Erfolgsmeldung.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT3-US-17 — Zeitfenster-Redesign: Von/Bis + Default-Vorlage
**Type:** Feature
**Story:** Als Admin möchte ich pro Wochentag ein Von/Bis-Fenster definieren und eine Default-Vorlage anwenden, damit ich keine Slots manuell anlegen muss.
**AC:**
- Given Default-Vorlage (z.B. Mo–Fr 08–17) angewendet, Then alle 7 Tage befüllt.
- Given einzelnen Tag manuell geändert, Then nur dieser Tag überschrieben.
- Given Verfügbarkeitsfenster gesetzt, When Kunde Tag wählt, Then Zeitauswahl in 30-min-Schritten innerhalb des Fensters.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT3-US-18 — Datei-Upload im Buchungsformular
**Type:** Feature
**Story:** Als Kunde möchte ich Fotos/Videos/Dokumente beim Buchen hochladen, damit Tom die Situation vorab einschätzen kann.
**AC:**
- Given Datei > 20 MB gewählt, Then Fehlermeldung „Datei zu groß".
- Given Dateien hochgeladen und Anfrage abgeschickt, Then Tom sieht Dateien als Links/Vorschau im Admin-Portal.
- Given kein Upload, Then Formular funktioniert trotzdem (optional).
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT3-US-19 — Individuelle Serviceanfrage
**Type:** Feature
**Story:** Als Kunde möchte ich „Sonstige / Individuelle Anfrage" als Service-Option wählen, damit ich auch für nicht gelistete Leistungen anfragen kann.
**AC:**
- Given „Sonstige" gewählt, Then Pflichtfeld „Beschreiben Sie Ihr Anliegen" erscheint.
- Given Anfrage abgeschickt, Then im Admin-Portal als „Sonstige" mit Freitext angezeigt.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT3-US-20 — Preise für Serviceleistungen anzeigen
**Type:** Feature
**Story:** Als Besucher möchte ich Richtpreise sehen (ab 20–45 €/h je Service), damit ich eine erste Preiseinschätzung bekomme.
**AC:**
- Given Service-Karten geladen, Then Richtpreis bei jedem Service sichtbar mit Disclaimer „Richtpreis Darmstadt, finale Preise auf Anfrage".
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT3-US-21 — Admin-Dashboard: Übersicht bevorstehende Termine
**Type:** Feature
**Story:** Als Admin möchte ich bevorstehende bestätigte Termine auf einen Blick sehen, damit ich den Arbeitstag planen kann.
**AC:**
- Given Dashboard geladen, Then zukünftige Termine chronologisch mit Uhrzeit, Kundenname, Service.
- Given heutige Termine vorhanden, Then mit „Heute"-Label hervorgehoben.
- Given Klick auf Termin, Then Weiterleitung zu Detailseite.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT3-US-22 — Feedback-Sektion mit Kundenbewertungen
**Type:** Feature
**Story:** Als Besucher möchte ich Kundenbewertungen mit Sternebewertung lesen, damit ich Vertrauen aufbaue.
**AC:**
- Given Feedback-Sektion geladen, Then bis zu 10 Bewertungen mit Name, Service, Text, Sternen.
- Given > 6 Bewertungen, Then initial 4–6 angezeigt mit „Mehr anzeigen"-Button.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT3-US-23 — Service-Popups mit Vorher/Nachher
**Type:** Feature
**Story:** Als Besucher möchte ich bei jedem Service ein Popup mit Vorher/Nachher-Beispielen öffnen, damit ich besser verstehe was mich erwartet.
**AC:**
- Given Klick auf Service-Karte, Then Popup mit Beschreibung, Bildpaar, CTA „Jetzt anfragen".
- Given X/Hintergrund/Escape, Then Popup schließt sich.
- Given Klick auf „Jetzt anfragen" im Popup, Then Buchungsformular mit vorausgewähltem Service.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT3-US-24 — Bestätigungs- und Storno-E-Mail an Kunden
**Type:** Feature
**Story:** Als Kunde möchte ich bei jeder Statusänderung eine E-Mail erhalten (Eingang, Bestätigung, Ablehnung, cancelToken), damit ich jederzeit informiert bin.
**AC:**
- Given Formular verarbeitet, Then Eingangsbestätigung mit cancelToken-Link.
- Given Admin bestätigt, Then Terminbestätigungs-E-Mail mit Datum, Uhrzeit, Service, Stornierungslink.
- Given Admin lehnt ab, Then E-Mail mit Hinweis und Einladung neu anzufragen.
- Given alle E-Mails, Then auf Deutsch, Absender „Bärenstark Hausservice", Toms Kontakt im Footer.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

### Iteration 4 — Kundenportal, Bewertungen, Zahlung

#### IT4-US-25 — Kundenportal: Registrierung und Login
**Type:** Feature
**Story:** Als Kunde möchte ich optional ein Konto anlegen und mich einloggen, damit ich Aufträge zentral verwalten kann.
**AC:**
- Given Registrierungsformular ausgefüllt, Then Bestätigungs-E-Mail mit Verifizierungslink.
- Given Login mit gültigen Daten, Then Weiterleitung zu `/konto`.
- Given falsche Daten, Then „E-Mail oder Passwort ungültig".
- Given „Passwort vergessen" + E-Mail eingegeben, Then Reset-Link innerhalb 2 Min (gültig 1 h).
- Given Gastbuchung, Then funktioniert weiterhin ohne Konto.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 8

---

#### IT4-US-26 — Kundenportal: Auftragsübersicht
**Type:** Feature
**Story:** Als eingeloggter Kunde möchte ich alle meine Aufträge in einer Liste sehen, damit ich Status und Details nachverfolgen kann.
**AC:**
- Given `/konto` geladen, Then „Bevorstehende Termine" (>= heute) und „Vergangene Aufträge" (< heute), chronologisch.
- Given Auftrag in Liste, Then Datum, Uhrzeit, Service, Status-Badge (DE: Offen/Bestätigt/Abgelehnt/Storniert/Gegenvorschlag ausstehend).
- Given keine Aufträge, Then „Sie haben noch keine Aufträge" mit CTA „Ersten Auftrag buchen".
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT4-US-27 — Kundenportal: Stornierung
**Type:** Feature
**Story:** Als eingeloggter Kunde möchte ich einen bevorstehenden Auftrag direkt im Portal stornieren, damit ich keinen cancelToken-Link suchen muss.
**AC:**
- Given PENDING/COUNTER_PROPOSED, When „Stornieren" + Bestätigung, Then Status sofort „Storniert", Tom erhält E-Mail.
- Given bestätigter Termin > 24 h in Zukunft, Then Stornierung möglich.
- Given bestätigter Termin < 24 h, Then Button deaktiviert mit Hinweis + Telefonnummer.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT4-US-28 — Zahlungsabwicklung (Stripe)
**Type:** Feature
**Story:** Als Kunde möchte ich nach Bestätigung per PayPal/Apple Pay/Google Pay bezahlen, damit keine Banküberweisung nötig ist.
**AC:**
- Given Tom Betrag hinterlegt, Then Kunde erhält Zahlungslink-E-Mail.
- Given Zahlungsseite geladen, Then Auftragsdetails + Betrag + Zahlungsoptionen sichtbar.
- Given Zahlung erfolgreich (Stripe Webhook), Then Status „Bezahlt" in Admin und Kunde, Bestätigungs-E-Mails.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 8

---

#### IT4-US-29 — Kundenbewertungen (echtes Backend)
**Type:** Feature
**Story:** Als eingeloggter Kunde mit COMPLETED-Auftrag möchte ich eine Bewertung (1–5 Sterne + Text) abgeben, damit andere Besucher profitieren.
**AC:**
- Given Status COMPLETED, Then „Bewertung abgeben"-Button sichtbar.
- Given Bewertung abgeschickt, Then Status PENDING_APPROVAL, Bestätigung „Wird nach Freigabe veröffentlicht".
- Given Tom gibt frei (APPROVED), Then Bewertung erscheint auf Startseite.
- Given bereits bewertet, Then Button deaktiviert, Bewertung schreibgeschützt.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

### Iteration 5 — Passwort-Reset, OAuth, Adresse, Dauer, Buffer

#### IT5-US-30 — Admin-Passwort-Reset verbessern
**Type:** Enhancement
**Story:** Als Admin möchte ich über „Passwort vergessen?" auf der Login-Seite einen Reset-Link erhalten, damit ich mich ohne fremde Hilfe wieder einloggen kann.
**AC:**
- Given Login-Seite, Then „Passwort vergessen?"-Link gut sichtbar unter Passwortfeld.
- Given E-Mail eingegeben, Then Reset-Link via Resend innerhalb 2 Min auf korrekte Umgebungs-URL.
- Given abgelaufener/benutzter Link, Then Fehlermeldung mit Link zu neuem Reset.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT5-US-31 — OAuth2-Login für Kunden (Google + GitHub)
**Type:** Feature
**Story:** Als Kunde möchte ich mich mit Google oder GitHub einloggen, damit ich kein separates Passwort anlegen muss.
**AC:**
- Given `/konto/login`, Then Buttons „Mit Google" und „Mit GitHub" zusätzlich zu E-Mail/Passwort.
- Given OAuth-Flow abgeschlossen, Then eingeloggt, zu `/konto` weitergeleitet.
- Given erste OAuth-Anmeldung, Then Account automatisch angelegt, keine E-Mail-Verifizierung.
- Given OAuth-Fehler/Abbruch, Then deutschsprachige Fehlermeldung auf `/konto/login`.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT5-US-32 — Adressfeld im Buchungsformular
**Type:** Feature
**Story:** Als Kunde möchte ich beim Buchen die Adresse des Auftragsorts angeben, damit Tom Anfahrt und Aufwand vorab einschätzen kann.
**AC:**
- Given Buchungsformular, Then 3 Pflichtfelder: Straße & Hausnummer, PLZ (5-stellig), Ort.
- Given PLZ nicht 5-stellig, Then Inline-Fehlermeldung.
- Given Tom öffnet Anfrage im Admin, Then Adresse gut sichtbar als eigener Abschnitt.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT5-US-33 — Buchungsdauer auswählen (Multi-Stunden)
**Type:** Feature
**Story:** Als Kunde möchte ich beim Buchen eine gewünschte Auftragsdauer wählen (1–8 h, Ganztag), damit Tom und ich dasselbe Zeitfenster einplanen.
**AC:**
- Given Startzeitpunkt gewählt, Then Kacheln 1h/2h/3h/4h/5h/6h/8h/Ganztag mit Preisschätzung.
- Given Kachel gewählt, Then visuell hervorgehoben, Verfügbarkeit geprüft (reicht Fenster?).
- Given Ganztag gewählt, Then ganzer Tag reserviert.
- Given Tom öffnet Anfrage, Then Dauer als eigenes Feld sichtbar.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT5-US-34 — Buffer-Zeit zwischen Buchungen (Admin)
**Type:** Feature
**Story:** Als Admin möchte ich eine globale Buffer-Zeit nach Buchungen konfigurieren, damit Fahrtzeiten automatisch reserviert werden.
**AC:**
- Given Einstellungen, Then Dropdown 0/15/30/45/60 min Buffer.
- Given Buffer 30 min + bestätigte Buchung bis 14:00, When Slots abgefragt, Then 14:00–14:30 nicht verfügbar.
- Given Buffer im Admin-Kalender, Then als grauer Block nach Buchung dargestellt.
- Given kein Wert gesetzt, Then Default 30 min.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

### Iteration 6 — Admin-Reife, Auth-Bereinigung & Wachstums-Features

#### IT6-US-IT6-01 — Weitere Admins anlegen
**Type:** Feature
**Story:** Als Admin möchte ich neue Admin-Konten anlegen, deaktivieren und löschen, damit Unterstützungskräfte Zugang bekommen ohne mein Passwort zu teilen.
**AC:**
- Given Admin-Verwaltung geladen, Then Liste aller Admins mit Name, E-Mail, Status.
- Given Letzter Admin vorhanden, Then Löschen-Button deaktiviert.
- Given Admin deaktiviert, When Login-Versuch, Then „Konto deaktiviert"-Meldung.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT6-US-IT6-02 — Kalender-UX: Google-Calendar-Style
**Type:** Feature
**Story:** Als Admin und Kunde möchte ich Zeitfenster in einer intuitiven Kalenderansicht verwalten (Wochen-/Monatsansicht mit Drag-and-drop für Admin).
**AC:**
- Given Admin-Kalender geladen, Then Wochen-/Tagesansicht mit Zeitraster, bestätigte Buchungen als farbige Blöcke.
- Given Klick auf Buchungsblock, Then Detail-Popover mit Kundenname, Service, Dauer.
- Given Kunden-Kalender, Then Monatsansicht mit verfügbaren Zeitslots als klickbare Chips nach Tag-Auswahl.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 8

---

#### IT6-US-IT6-03 — Kundenbewertungen: nur nach COMPLETED
**Type:** Enhancement
**Story:** Als Kunde mit COMPLETED-Auftrag möchte ich eine Bewertung abgeben (Trigger nur COMPLETED, nicht CONFIRMED), damit echte Abschlusskontrolle gewährleistet ist.
**AC:**
- Given Status COMPLETED, Then „Jetzt bewerten"-Button sichtbar; bei allen anderen Status kein Button.
- Given Bewertung abgeschickt, Then Status PENDING_APPROVAL, in keiner öffentlichen API sichtbar.
- Given Tom gibt frei, Then öffentlich auf Startseite sichtbar.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT6-US-IT6-04 — SEO-Optimierung
**Type:** Feature
**Story:** Als Google-Crawler möchte ich eine sauber optimierte Website vorfinden, damit Bärenstark bei lokalen Suchanfragen in Darmstadt gut gefunden wird.
**AC:**
- Given beliebige öffentliche Seite, Then eindeutiges `<title>` (≤ 60 Zeichen) + `<meta description>` (≤ 160 Zeichen).
- Given `/sitemap.xml`, Then gültige XML-Sitemap mit allen öffentlichen Seiten.
- Given `/robots.txt`, Then öffentliche Seiten erlaubt, `/admin/*` und `/api/*` gesperrt.
- Given Startseite Lighthouse Desktop, Then Performance-Score ≥ 80.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT6-US-IT6-05 — Auth-Bereinigung: nur Google + Facebook OAuth
**Type:** Enhancement
**Story:** Als Admin möchte ich, dass Kunden nur Google oder Facebook OAuth nutzen (E-Mail/Passwort und GitHub entfernt), damit die Anmeldestrecke übersichtlich ist.
**AC:**
- Given `/konto/login`, Then nur „Mit Google" und „Mit Facebook" — kein E-Mail/Passwort, kein GitHub.
- Given `/konto/registrieren`, Then HTTP 404.
- Note: In IT7 revertiert — E-Mail/Passwort wurde wieder eingeführt.
**Status:** ✅ Done (revertiert in IT7) | **Priority:** Must Have | **SP:** 5

---

#### IT6-US-IT6-06 — Alle User-Accounts löschen (DB-Reset)
**Type:** Feature
**Story:** Als Admin möchte ich alle bestehenden Kunden- und Admin-Registrierungen löschen, damit ich mit sauberem Stand neu starten kann.
**AC:**
- Given Skript `scripts/reset-users.ts` ausgeführt, Then CustomerUser- und User-Tabellen leer.
- Given COMPLETED/CONFIRMED-Buchungen, Then anonymisiert (customerId = NULL), nicht hart gelöscht.
- Given PENDING/COUNTER_PROPOSED-Buchungen verwaister Kunden, Then auf CANCELLED gesetzt.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT6-US-IT6-07 — Admin-Nutzerverwaltung mit Kommentar + Rating
**Type:** Feature
**Story:** Als Admin möchte ich Kunden einsehen, editieren, löschen sowie interne Notizen und Rating (1–5 Sterne) hinterlegen, die für Kunden nie sichtbar sind.
**AC:**
- Given Kundenprofil im Admin, Then `adminNote` (Freitext, max. 1000 Z) und `adminRating` (1–5 Sterne) editierbar.
- Given `GET /api/customer/profile`, Then kein `adminNote`/`adminRating` in Response.
- Given Freitextsuche ≥ 2 Zeichen, Then Liste gefiltert (case-insensitive, Debounce 300ms).
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT6-US-IT6-08 — Finaler Preis pro Buchung
**Type:** Feature
**Story:** Als Admin möchte ich bei jeder Buchung einen finalen EUR-Betrag (`final_price_eur`) hinterlegen, damit ich Einnahmen im Blick habe.
**AC:**
- Given Buchungsdetail im Admin, Then editierbares Feld „Finaler Preis (EUR)".
- Given Betrag gespeichert, Then in Buchungsübersicht als Badge sichtbar.
- Given Kunden-API, Then `final_price_eur` nicht in Response enthalten.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT6-US-IT6-09 — Analytics-Seite in Admin-Konsole
**Type:** Feature
**Story:** Als Admin möchte ich eine Analytics-Übersicht mit Umsatz, Buchungsvolumen und Service-Performance, damit ich Geschäftsentwicklung nachverfolgen kann.
**AC:**
- Given Analytics-Seite geladen, Then KPI-Kacheln: Gesamtumsatz, abgeschlossene Buchungen, Ø Auftragswert, Buchungen diesen Monat.
- Given Zeitraum-Filter gewählt, Then alle KPIs und Diagramme aktualisieren sich.
- Given Umsatz-Diagramm, Then Balken-/Liniendiagramm monatlicher Umsatz (COMPLETED + final_price_eur gesetzt) letzter 12 Monate.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

### Iteration 7 — Auth-Stabilisierung & Email-Auth-Wiederherstellung

#### IT7-US-IT7-01 — Email/Password-Registrierung wiederherstellen
**Type:** Enhancement (Reversion von IT6-US-IT6-05)
**Story:** Als Kunde möchte ich mich per E-Mail und Passwort bei Bärenstark registrieren und einloggen, damit ich kein Google- oder Facebook-Konto benötige.
**AC:**
- Given `/konto/registrieren`, Then Formular mit Vorname/Nachname/E-Mail/Passwort + OAuth-Buttons.
- Given korrektes Formular, Then Account angelegt, Bestätigungs-E-Mail via Resend.
- Given `/konto/login`, Then E-Mail/Passwort-Formular + OAuth-Buttons gleichzeitig sichtbar.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT7-US-IT7-02 — Google OAuth reparieren
**Type:** Bug
**Story:** Als Kunde möchte ich mich mit Google bei `/konto/login` anmelden, damit der OAuth-Flow fehlerfrei funktioniert.
**AC:**
- Given Redirect URI in Google Cloud Console korrekt gesetzt + NEXTAUTH_URL ohne Trailing-Slash, Then kein `redirect_uri_mismatch`.
- Given `trustHost: true` in NextAuth-Config, Then kein „Bad request"-Fehler.
- Given alle Korrekturen eingespielt, When Tom auf „Mit Google anmelden" klickt, Then eingeloggt, Weiterleitung zu `/konto`.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT7-US-IT7-03 — Facebook OAuth reparieren
**Type:** Bug
**Story:** Als Kunde möchte ich mich mit Facebook anmelden, damit eine weitere bequeme Anmelde-Option verfügbar ist.
**AC:**
- Given FACEBOOK_CLIENT_ID/-SECRET gesetzt + Redirect URI korrekt + App auf „Live", Then Login erfolgreich.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT7-US-IT7-04 — Admin-Bootstrap-Reset (BLOCKER)
**Type:** Bug
**Story:** Als Admin (Tom) möchte ich einen CLI-Befehl haben der mich als ACTIVE-Admin wiederherstellt, damit ich die Admin-Konsole wieder nutzen kann.
**AC:**
- Given `npx tsx scripts/promote-admin.ts <email>` ausgeführt, Then Admin mit ACTIVE-Status angelegt/gesetzt.
- Given Skript ohne `ALLOW_ADMIN_PROMOTE=true`, Then sofortiger Abbruch mit Hinweis.
- Given min. 1 ACTIVE-Admin, Then `/api/admin/setup` gibt weiterhin 410 zurück.
**Status:** ✅ Done | **Priority:** Must Have — BLOCKER | **SP:** 2

---

#### IT7-US-IT7-05 — Passwort-Reset-Flow E2E (Kunden)
**Type:** Feature
**Story:** Als Kunde möchte ich mein Passwort zurücksetzen, damit ich wieder Zugang zu meinem Konto erhalte.
**AC:**
- Given `/konto/passwort-vergessen` + E-Mail eingegeben, Then Reset-Link via Resend innerhalb 2 Min (gültig 1 h, single-use).
- Given Reset-Link geklickt, Then Formular mit „Neues Passwort" + „Bestätigen".
- Given > 5 Requests in 15 Min von selber IP, Then HTTP 429.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

### Iteration 8 — Bugfix-Sweep & DayOverride-Sichtbarkeit

#### IT8-US-IT8-01 — `/admin/admins` Client-Side-Crash beheben
**Type:** Bug
**Story:** Als Admin möchte ich `/admin/admins` fehlerfrei aufrufen, damit ich Admins verwalten kann ohne auf eine weiße Seite zu treffen.
**AC:**
- Given `/admin/admins` aufgerufen, Then Admin-Liste oder leerer Zustand — niemals weiße Seite.
- Given API-Call schlägt fehl, Then lesbare Fehlermeldung in der Komponente.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT8-US-IT8-02 — `/admin/calendar` Kalender-Komponente rendert nicht
**Type:** Bug
**Story:** Als Admin möchte ich auf `/admin/calendar` einen Kalender sehen, damit ich meinen Terminüberblick nutzen kann.
**AC:**
- Given `/admin/calendar` geladen, Then Kalender-Komponente sichtbar (Raster erkennbar), auch ohne Buchungen.
- Given CSS-Assets der Kalender-Bibliothek, Then HTTP 200 im Network-Tab.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT8-US-IT8-03 — `/admin/slots` Liste nach Speichern nicht aktualisiert
**Type:** Bug
**Story:** Als Admin möchte ich, dass ein neu gespeichertes Zeitfenster sofort in der Liste erscheint, damit ich den Erfolg direkt sehe.
**AC:**
- Given POST erfolgreich, Then neues Zeitfenster ohne Seitenreload in Liste.
- Given Seite manuell neu geladen, Then Zeitfenster weiterhin in Liste (persistent).
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT8-US-IT8-04 — DayOverride-Liste sichtbar machen
**Type:** Feature
**Story:** Als Admin möchte ich alle eingetragenen DayOverrides in einer Liste sehen und löschen können, damit ich tagesspezifische Überschreibungen überblicken kann.
**AC:**
- Given DayOverrideManager geladen, Then Liste mit Datum, Öffnungszeiten (oder „Geschlossen"), Löschen-Button.
- Given keine DayOverrides, Then „Keine Überschreibungen eingetragen."
- Given vergangenes Datum, Then Eintrag ausgegraut aber sichtbar.
**Status:** ✅ Done | **Priority:** Should Have | **SP:** 3

---

#### IT8-US-IT8-05 — Google-OAuth-Diagnose Endpoint
**Type:** Feature
**Story:** Als Admin möchte ich per `/api/auth/diagnose` sehen ob Google OAuth code-seitig korrekt konfiguriert ist, damit ich ohne Entwickler entscheiden kann was als nächstes getan werden muss.
**AC:**
- Given `AUTH_DIAGNOSE_ENABLED=true` gesetzt, Then `GET /api/auth/diagnose` gibt JSON mit `checks`-Array (status: ok/error/warning, message DE).
- Given alle Checks ok, Then `actionRequired: "config"` mit exakten Redirect-URIs für Google Cloud Console.
- Given Code-seitiger Check fehlerhaft, Then `actionRequired: "code"` mit Auflistung.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

### Iteration 9 — Admin-Stabilität, Kunden-Adresse & Buchungs-Kalender

#### IT9-US-IT9-01 — `/admin/users` Crash beheben
**Type:** Bug
**Story:** Als Admin möchte ich `/admin/users` fehlerfrei aufrufen, damit ich Kundendaten einsehen kann ohne die Error-Boundary zu sehen.
**AC:**
- Given `/admin/users` als eingeloggter Admin, Then Kundenübersicht oder leerer Zustand „Keine Kunden registriert."
- Given ≥ 1 Kunde in DB, Then Name/E-Mail, Registrierungsdatum und Status angezeigt.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT9-US-IT9-02 — Kunden-Adresse im Profil
**Type:** Feature
**Story:** Als Kunde möchte ich meine Adresse (Straße + Hausnummer, PLZ, Ort) angeben und ändern, damit Tom weiß wohin er fahren muss.
**AC:**
- Given `/konto/registrieren`, Then 3 optionale Adressfelder mit Hinweis „Für Terminbuchungen benötigt."
- Given Profil unter `/konto`, Then Adressfelder editierbar und speicherbar (ohne Seitenreload).
- Given Adresse geleert und gespeichert, Then auf NULL in DB gesetzt.
- Given Admin öffnet Kundenprofil, Then Adresse lesend sichtbar (Tom kann nicht im Namen des Kunden ändern).
**Status:** ✅ Done | **Priority:** Should Have | **SP:** 5

---

#### IT9-US-IT9-03 — Buchungs-Kalender: Slot interaktiv auswählen
**Type:** Bug
**Story:** Als Kunde möchte ich im Buchungs-Flow einen Kalender sehen und einen Slot per Klick auswählen, damit der Termin in das Formular übernommen wird.
**AC:**
- Given Kalender-Schritt erreicht, Then Kalender sichtbar innerhalb 3 Sekunden.
- Given Tag mit Slots gewählt, Then verfügbare Zeitslots als klickbare Elemente.
- Given Slot gewählt, Then visuell hervorgehoben, Datum/Uhrzeit im Formular vorausgefüllt.
- Given API-Fehler, Then Meldung „Termine konnten nicht geladen werden" statt Dauerskeleton.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT9-US-IT9-04 — Google-OAuth-Setup-Guide für Tom
**Type:** Feature
**Story:** Als Tom möchte ich eine Schritt-für-Schritt-Anleitung für die Google Cloud Console, damit ich Google-OAuth ohne Rückfragen konfigurieren kann.
**AC:**
- Given `docs/GOOGLE_OAUTH_SETUP_GUIDE.md` geöffnet, Then Guide auf Deutsch mit 7 Abschnitten: Voraussetzungen → Cloud Console → Consent-Screen → Client-ID → Redirect-URIs (exakte URLs) → Vercel ENV → Fehlerdiagnose.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

### UX-Backlog (aus UX-Review 2026-05-03) — Bucket A–D

#### UX-A-01 — Vertrauensleiste oberhalb Buchungs-Kalender
**Type:** Enhancement
**Story:** Als potenzieller Kunde möchte ich auf `/buchung` direkt unter der H1 eine Trust-Bar (Sterne-Schnitt, Anzahl, Tom-Hinweis, Telefon-CTA) sehen, damit ich Vertrauen schöpfe bevor ich einen Termin wähle.
**AC:**
- Given `/buchung` geladen, Then Trust-Bar mit REVIEWS_AVERAGE, REVIEWS_COUNT, Telefon-Link sichtbar — noch vor dem Kalender.
- Given Smartphone, Then Telefon-Button ≥ 44×44 px.
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 2

---

#### UX-A-02 — Adress-Hinweis für eingeloggte Kunden ohne Adresse
**Type:** Enhancement
**Story:** Als eingeloggter Kunde ohne Adresse möchte ich ganz oben auf der Buchungsseite einen Hinweis mit Link zum Profil sehen, damit ich nicht erst am Ende des Formulars davon erfahre.
**AC:**
- Given eingeloggt + keine Adresse, When `/buchung`, Then gelber Banner „Deine Adresse fehlt noch" mit Link zu `/konto`.
- Given eingeloggt + Adresse vorhanden, Then Banner nicht angezeigt.
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 1

---

#### UX-A-03 — Designsystem-Tokens für Feedback-Farben
**Type:** Enhancement
**Story:** Als Tom möchte ich konsistente Marken-konforme Farben für alle Status-Banner, damit Fehler/Erfolg-Meldungen zum Holz-/Beige-Design passen.
**AC:**
- Given Fehler-Banner, Then Token `error` (#B23A3A) statt generisches red-700.
- Given `Banner.tsx`, `Button.tsx` (danger), `Input.tsx` (Error), Then alle referenzieren semantische Tokens.
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 2

---

#### UX-A-04 — Telefon-Icon im Mobile-Header
**Type:** Enhancement
**Story:** Als mobiler Besucher möchte ich im Header einen sichtbaren Telefon-Icon-Button haben, damit ich Tom direkt anrufen kann ohne zum Footer zu scrollen.
**AC:**
- Given Viewport < 1024px, Then Telefon-Icon-Button (44×44 px Tap-Target) im Header.
- Given Viewport ≥ 1024px, Then Icon-Button ausgeblendet, Text-Telefon-Link sichtbar.
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 1

---

#### UX-A-05 — Buchungs-Erfolg auf dedizierte Bestätigungsseite umleiten
**Type:** Enhancement
**Story:** Als Kunde der eine Buchung abgesendet hat möchte ich auf eine eigene Bestätigungsseite weitergeleitet werden, damit ich sicher weiß dass meine Buchung angekommen ist.
**AC:**
- Given Server antwortet „Erfolg", Then Weiterleitung auf `/buchung/bestaetigt` — Formular nicht mehr sichtbar.
- Given `/buchung/bestaetigt`, Then Bestätigungsmeldung + Vertrauenssignal + „Was passiert als Nächstes?".
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 2

---

#### UX-A-06 — Service-Karten mit zwei CTAs
**Type:** Enhancement
**Story:** Als Besucher auf der Service-Übersicht möchte ich auf jeder Karte sowohl „Mehr erfahren" als auch „Direkt buchen" sehen, damit ich ohne Modal direkt buchen kann.
**AC:**
- Given Service-Karten geladen, Then je zwei Aktionen: „Mehr erfahren" (öffnet Modal) + „Direkt buchen" (→ `/buchung?service=<slug>`).
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 1

---

#### UX-A-07 — scroll-margin-top für Buchungs-Sektionen
**Type:** Enhancement
**Story:** Als mobiler Kunde möchte ich nach jeder Auswahl zur nächsten Sektion scrollen ohne dass die Überschrift hinter dem Sticky-Header verschwindet.
**AC:**
- Given Nach Kalender-Auswahl automatisches Scroll zur nächsten Sektion, Then H2 vollständig sichtbar.
- Given `scroll-margin-top` auf `#calendar-heading`, `#duration-heading`, `#slot-heading`, `#form-heading`, Then Wert ≥ 5 rem.
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 1

---

#### UX-B-01 — Buchungs-Flow als Stepper mit Auswahl-Pill
**Type:** Enhancement
**Story:** Als Kunde im Buchungs-Flow möchte ich oben einen Stepper mit Fortschrittsanzeige und eine Auswahl-Pill mit bisherigen Entscheidungen sehen.
**AC:**
- Given Auswahl getroffen, Then Sticky-Stepper aktualisiert sich sofort (Tag → Dauer → Slot → Daten).
- Given noch nicht relevanter Schritt, Then Abschnitt eingeklappt (Disclosure).
**Status:** 🟡 Backlog | **Priority:** Could Have | **SP:** 5

---

#### UX-B-02 — Mobile Tap-Targets systemisch auf 44 px
**Type:** Enhancement
**Story:** Als mobiler Nutzer möchte ich dass alle interaktiven Elemente ≥ 44×44 px Klickfläche haben, damit keine Fehlklicks passieren.
**AC:**
- Given `Button` size="sm", Then min-height 44px.
- Given Slot-Kacheln im TimeSlotPicker, Then gap ≥ 12px.
**Status:** 🟡 Backlog | **Priority:** Could Have | **SP:** 3

---

#### UX-B-03 — Datenschutz-Checkbox mit 44-px-Klickfläche
**Type:** Enhancement
**Story:** Als Kunde am Ende des Buchungsformulars möchte ich die Datenschutz-Checkbox bequem antippen, damit ich nicht mehrfach tippen muss.
**AC:**
- Given Buchungsformular Step 4, Then `<label>`-Fläche ≥ 44px Höhe, vollständig klickbar.
**Status:** 🟡 Backlog | **Priority:** Could Have | **SP:** 1

---

#### UX-B-04 — Status-Icons in Banner für Farbenblinde
**Type:** Enhancement
**Story:** Als Nutzer mit Rot-Grün-Schwäche möchte ich in Hinweis-Banners neben der Farbe auch ein Icon sehen, damit ich nicht allein auf Farbunterscheidung angewiesen bin.
**AC:**
- Given Fehler-Banner, Then `<AlertTriangle>`-Icon links neben dem Text.
- Given Erfolgs-Banner, Then `<CheckCircle>`-Icon links neben dem Text.
**Status:** 🟡 Backlog | **Priority:** Could Have | **SP:** 1

---

#### UX-C-01 — Admin-Navigation konsolidieren
**Type:** Enhancement
**Story:** Als Admin möchte ich eine einzige klare Navigationsleiste (kein doppelter „Bewertungen"-Eintrag), damit ich schnell navigiere.
**AC:**
- Given `/admin`, Then genau eine horizontale Navigationsleiste mit allen Bereichen, keine Quick-Link-Buttons parallel.
- Given zwischen Bereichen navigiert, Then Inhalt wechselt ohne Seitenwechsel, kein doppelter Eintrag.
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 3

---

#### UX-C-02 — Admin-Dashboard als „Was muss ich heute tun?"-Ansicht
**Type:** Enhancement
**Story:** Als Admin möchte ich auf `/admin` sofort sehen welche Buchungen meine Aufmerksamkeit brauchen (neue Anfragen, > 24h ohne Reaktion), damit ich meinen Arbeitstag effizient starte.
**AC:**
- Given offene Anfragen vorhanden, Then „Heute zu erledigen"-Sektion ganz oben mit rotem Punkt wenn > 24h ohne Reaktion.
- Given keine offenen Anfragen, Then freundlicher Leerstand.
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 5

---

#### UX-C-03 — Admin-Buchungskarten komprimieren
**Type:** Enhancement
**Story:** Als Admin möchte ich auf Buchungskarten sofort die wichtigste Aktion erkennen (z.B. „Bestätigen" bei PENDING), damit ich schnell entscheiden kann.
**AC:**
- Given PENDING-Buchung, Then primärer Button prominent (groß, oben rechts), Sekundäres hinter „..."-Menü.
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 3

---

#### UX-C-04 — Verfügbarkeits-Konfiguration mit Inline-Hilfe
**Type:** Enhancement
**Story:** Als Admin möchte ich zu jedem Konfigurationsbereich (Buffer, Wochenvorlage, Tages-Überschreibungen) einen erklärenden Titel und Hilfetext sehen.
**AC:**
- Given Verfügbarkeits-Tab geladen, Then ≥ 3 klar benannte Sektionen mit je kurzer Erklärung.
**Status:** 🟡 Backlog | **Priority:** Could Have | **SP:** 3

---

#### UX-C-05 — Adresse und Maps-Link in „Bevorstehende Termine"-Liste
**Type:** Enhancement
**Story:** Als Admin auf dem Weg zum Kunden möchte ich in der Terminliste direkt die Adresse sehen und per Tap in Maps öffnen, damit ich keine Buchungskarte aufklappen muss.
**AC:**
- Given Termin mit Adresse, Then Adresse direkt in Zeile + Tap öffnet Karten-App (geo: URI).
- Given Termin ohne Adresse, Then „Keine Adresse hinterlegt".
**Status:** 🟡 Backlog | **Priority:** Should Have | **SP:** 2

---

#### UX-C-06 — Zeitfenster-Formular einklappbar
**Type:** Enhancement
**Story:** Als Admin möchte ich das „Neues Zeitfenster anlegen"-Formular nicht dauerhaft aufgeklappt sehen, damit ich bei vielen Slots nicht daran vorbeiscrollen muss.
**AC:**
- Given Zeitfenster-Tab geladen, Then Formular eingeklappt, Button „+ Neues Zeitfenster anlegen" sichtbar.
**Status:** 🟡 Backlog | **Priority:** Could Have | **SP:** 2

---

#### UX-D-01 — Polymorphes Button-Komponente
**Type:** Enhancement
**Story:** Als Entwickler möchte ich `<Button as="a" href="…">` verwenden, damit alle Buttons und Links dieselbe Höhe, denselben Hover-State und Fokus-Ring haben.
**AC:**
- Given `Button as="a"` verwendet, Then natives `<a>` mit allen Button-Styles.
- Given Hero-CTA, Header-Link, CustomerBookingCard-Link, OAuth-Buttons verglichen, Then alle selbe Höhe/Hover/Fokus.
**Status:** 🟡 Backlog | **Priority:** Could Have | **SP:** 3

---

#### UX-D-02 — Datums-Formatierungs-Helfer konsolidieren
**Type:** Enhancement
**Story:** Als Entwickler möchte ich eine einzige zentrale `format(date, mode)`-API statt 6 konkurrierender Helfer-Funktionen, damit Datums-Darstellungen konsistent sind.
**AC:**
- Given `format(date, mode)` mit jedem der 4 Modi aufgerufen, Then korrektes deutsches Datum.
- Given Migration abgeschlossen, Then keine Aufrufe von `formatBerlinDateShort`, `formatDateShort`, etc. mehr im Code.
**Status:** 🟡 Backlog | **Priority:** Could Have | **SP:** 3

---

#### UX-D-03 — Kalender-Komponenten konsolidieren
**Type:** Enhancement
**Story:** Als Entwickler möchte ich nur eine Kalender-Implementierung im Buchungs-Flow statt zwei parallele, damit Bugfixes nicht doppelt gepflegt werden.
**AC:**
- Given Konsolidierung abgeschlossen, Then genau eine Kalender-Implementierung im Haupt-Flow.
- Given Regressionstest Buchungs-Flow, Then Slot-Auswahl funktioniert wie zuvor.
**Status:** 🟡 Backlog | **Priority:** Could Have | **SP:** 3

---

### Iteration 10 — Bug-Triage & Customer-Self-Service

#### IT10-US-IT10-01 — Passwort-Reset E-Mail funktioniert nicht
**Type:** Bug
**Story:** Als Kunde möchte ich nach Klick auf „Passwort vergessen" zuverlässig eine Reset-E-Mail erhalten, damit ich mein Passwort zurücksetzen kann.
**AC:**
- Given registrierte E-Mail eingegeben, When „Link anfordern", Then E-Mail innerhalb 2 Min (Link gültig 1 h, single-use).
- Given Ursache identifiziert (Vercel-Logs, Resend-Dashboard, ENV-Vars), Then im PR dokumentiert.
- Given abgelaufener Link, Then Meldung „Link nicht mehr gültig" mit Link zu neuem Reset.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT10-US-IT10-02 — Admin-Portal Nutzerliste lädt nicht
**Type:** Bug
**Story:** Als Admin möchte ich `/admin/users` fehlerfrei aufrufen, damit ich Kundendaten einsehen kann.
**AC:**
- Given `/admin/users` aufgerufen, Then Kundenliste oder „Keine Kunden registriert." — kein „Interner Serverfehler".
- Given Ursache identifiziert (Vercel-Logs, Prisma-Trace), Then im PR dokumentiert.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT10-US-IT10-03 — Buchungsanfrage kann nicht abgesendet werden
**Type:** Bug
**Story:** Als Kunde möchte ich eine Buchungsanfrage erfolgreich absenden, damit Tom sie erhält.
**AC:**
- Given Formular vollständig ausgefüllt, When abgesendet, Then Erfolgsmeldung oder Weiterleitung zu `/buchung/bestaetigt` — kein „Interner Serverfehler".
- Given Buchungsanfrage erfolgreich, Then im Admin-Portal als PENDING sichtbar + Tom erhält E-Mail.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT10-US-IT10-04 — Kalender-Quick-Booking Modal
**Type:** Feature
**Story:** Als Kunde möchte ich nach Slot-Auswahl im Kalender ein Modal sehen (statt Seitenwechsel), damit ich den Buchungs-Flow schneller abschließen kann.
**AC:**
- Given verfügbaren Slot geklickt, Then Modal öffnet sich mit vollständigem Buchungsformular (Datum/Zeit vorausgefüllt).
- Given Modal offen + Schließen/Escape/Hintergrund, Then Modal schließt ohne Datenverlust.
- Given Smartphone, Then Modal vollständig scrollbar, alle Felder erreichbar.
**Status:** ✅ Done | **Priority:** Should Have | **SP:** 5

---

#### IT10-US-IT10-05 — Kunden-Dashboard Self-Service
**Type:** Feature
**Story:** Als eingeloggter Kunde möchte ich alle eigenen Anfragen mit Status sehen und beim Buchen ein mit Profildaten vorausgefülltes Formular vorfinden.
**AC:**
- Given `/konto` geladen, Then Anfragen-Liste mit Datum, Service, Status-Badge (DE), Erstellungsdatum.
- Given keine Anfragen, Then CTA „Jetzt erste Anfrage stellen".
- Given eingeloggt + Buchungsformular, Then Name/E-Mail/Telefon/Adresse aus Profil vorausgefüllt.
- Given Formularwert geändert und abgesendet, Then geänderter Wert für Buchung verwendet (Profil nicht überschrieben).
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 8

---

### Iteration 11 — Produktions-Stabilisierung & UX-Konsolidierung

#### IT11-US-IT11-01 — Buchung end-to-end in Produktion zum Laufen bringen
**Type:** Bug
**Story:** Als Kunde möchte ich eine Buchungsanfrage erfolgreich absenden, damit Tom sie erhält und ich eine Bestätigung bekomme.
**AC:**
- Given `prisma migrate deploy` ausgeführt + alle Pflicht-ENV gesetzt (RESEND_API_KEY, MAIL_FROM, MAIL_TO_ADMIN, NEXTAUTH_URL, NEXT_PUBLIC_BASE_URL), When Formular abgesendet, Then Buchung mit PENDING in DB gespeichert — kein P2022-Fehler.
- Given Buchung gespeichert, Then Tom erhält E-Mail + Buchung im Admin-Portal sichtbar.
- Given Live-Smoke-Test, Then Gast-Buchung + eingeloggte Buchung beide erfolgreich.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT11-US-IT11-02 — Buchungsweg konsolidieren
**Type:** Enhancement
**Story:** Als Kunde möchte ich einen einzigen offensichtlichen Weg finden um eine Buchung zu stellen, damit ich nicht durch mehrere Einstiegspunkte verwirrt werde.
**AC:**
- Given Startseite Hero/Header-CTA geklickt, Then Quick-Booking-Modal öffnet sich — keine Weiterleitung zu `/buchen`.
- Given Startseite durchgescrollt, Then genau ein CTA für Buchungen.
- Given `/buchen` direkt aufgerufen, Then vollständiges Buchungsformular als Fallback sichtbar.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT11-US-IT11-03 — Klare Rückmeldung nach Buchungsabsenden
**Type:** Bug
**Story:** Als Kunde möchte ich nach dem Absenden sofort wissen ob meine Anfrage erfolgreich war, damit ich nicht unsicher bin ob sie angekommen ist.
**AC:**
- Given Server antwortet 201, Then grüner Toast + Weiterleitung zu `/buchung/bestaetigt` innerhalb 2 Sekunden (enthält Buchungsnummer, Service, Datum).
- Given Modal-Absenden erfolgreich, Then Modal schließt, Toast erscheint.
- Given Server antwortet 4xx/5xx, Then deutschsprachige Fehlermeldung im Formular, Button wieder aktiv.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT11-US-IT11-04 — Datei-Upload im Admin anzeigen
**Type:** Bug
**Story:** Als Admin möchte ich in der Auftragsdetailansicht alle hochgeladenen Bilder/Videos sehen und herunterladen, damit ich den Auftrag beurteilen kann.
**AC:**
- Given Bild hochgeladen (JPG/PNG ≤ 10 MB), When Buchung abgesendet, Then Datei persistent in Vercel Blob gespeichert.
- Given Tom öffnet Auftragsdetail, Then Anhänge als Vorschau, Dateiname, Dateigröße, Download-Link sichtbar.
- Given kein Upload, Then Hinweis „Keine Dateien hochgeladen".
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT11-US-IT11-05 — Profildaten-Vorausfüllung produktionsfähig machen
**Type:** Bug
**Story:** Als eingeloggter Kunde möchte ich beim Öffnen des Buchungsformulars meine Profildaten automatisch vorausgefüllt sehen, damit ich keine bekannten Informationen erneut eingeben muss.
**AC:**
- Given eingeloggt + Buchungsformular geöffnet, Then Name/E-Mail/Telefon/Adresse (wenn vorhanden) vorausgefüllt.
- Given `GET /api/customer/me` in Produktion mit aktiver Session, Then HTTP 200 mit Profildaten.
- Given nicht eingeloggt, Then alle Felder leer, kein Fehler.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT11-US-IT11-06 — Auftrag stornieren (Kundenseite)
**Type:** Feature
**Story:** Als eingeloggter Kunde möchte ich meine Buchungsanfrage stornieren, damit ich Tom nicht anrufen muss wenn sich meine Pläne ändern.
**AC:**
- Given Status PENDING/CONFIRMED, Then „Stornieren"-Button sichtbar.
- Given Bestätigungsdialog bestätigt, Then Status sofort „Storniert" in Kunden- und Admin-Dashboard, Tom erhält E-Mail.
- Given Buchung mit TimeSlot storniert, Then Slot wieder als AVAILABLE markiert.
- Given Gast-Buchung + Stornierungslink aus E-Mail geklickt, Then Stornierung über signierten Token.
- Given bereits storniert + API erneut aufgerufen, Then HTTP 409.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

### Iteration 12 — Stakeholder-Feedback-Sweep

#### IT12-S01 — Google OAuth „Bad Request" beheben
**Type:** Bug
**Story:** Als nicht eingeloggter Kunde möchte ich mich mit Google anmelden, damit kein „Bad Request"-Fehler auf dem Callback entsteht.
**AC:**
- Given Redirect-URI korrekt in Google Cloud Console + GOOGLE_CLIENT_ID/-SECRET in Vercel, When OAuth-Flow abgeschlossen, Then eingeloggt, Weiterleitung zu Kunden-Dashboard.
- Given Fix deployed, Then keine HTTP-4xx-Fehler im Vercel-Log für Callback-Route.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT12-S02 — Service-Detailseiten: echte Bilder + Icon neben Servicenamen
**Type:** Enhancement
**Story:** Als Website-Besucher möchte ich auf Service-Detailseiten ein echtes Foto sehen und das Icon kompakt neben dem Namen, damit ich einen visuellen Eindruck des Angebots bekomme.
**AC:**
- Given Detailseite eines Services geladen, Then zugeordnetes Bild aus `/public` als Hero-Bild, Icon links neben Servicenamen in kleinerer Größe.
- Given Bild fehlt (Edge-Case), Then neutraler Fallback-Container (grauer Hintergrund + Icon), kein 404.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT12-S03 — Buchungskalender: Ladezeit und Tage-Klickbarkeit reparieren
**Type:** Bug
**Story:** Als Kunde möchte ich einen Buchungstermin im Kalender schnell auswählen, damit der Buchungsvorgang flüssig ist.
**AC:**
- Given Kalender-Schritt erreicht, Then Kalender in < 1,5 Sekunden vollständig sichtbar.
- Given verfügbaren Tag geklickt, Then Tag als ausgewählt markiert + Buchungsfluss kann voranschreiten.
- Given Tag ohne Slots, Then visuell nicht auswählbar (ausgegraut), Klick ohne Auswirkung.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT12-S04 — Scroll-Jump nach Slot-Auswahl bei „Wie lange?" unterbinden
**Type:** Bug
**Story:** Als Kunde möchte ich beim Auswählen eines Zeitslots keine unbeabsichtigte Seitennavigation erleben, damit der Buchungsfluss nicht verwirrend wirkt.
**AC:**
- Given Slot bei „Wie lange?" ausgewählt, Then Scrollposition unverändert — kein Sprung zum Seitenanfang.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT12-S05 — Nach Gast-Buchung Konto-Erstellung anbieten
**Type:** Feature
**Story:** Als Gast der gerade gebucht hat möchte ich gefragt werden ob ich ein Konto anlegen möchte, damit ich Anfragen später einsehen kann.
**AC:**
- Given Gast-Buchung erfolgreich, Then Hinweis „Möchten Sie ein Konto anlegen?" mit Button + E-Mail/Name aus Buchung vorausgefüllt.
- Given Angebot ignoriert, Then keine weitere Aktion, Buchung bleibt gespeichert.
- Given Nutzer eingeloggt, Then Angebot nicht angezeigt.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT12-S06 — Kundendashboard: „Anfragen konnten nicht geladen werden" beheben
**Type:** Bug
**Story:** Als eingeloggter Kunde möchte ich meine Buchungsanfragen im Dashboard sehen, damit ich den Status meiner Aufträge verfolgen kann.
**AC:**
- Given `/konto` geladen, Then Buchungsanfragen oder leere Liste mit Hinweis — kein Interner Serverfehler.
- Given keine Buchungen, Then „Sie haben noch keine Buchungsanfragen".
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT12-S07 — „Anmelden"-Button nach Profil-Speichern: Login-State konsistent
**Type:** Bug
**Story:** Als eingeloggter Kunde möchte ich nach dem Speichern meiner Profildaten weiterhin als eingeloggt angezeigt werden, damit keine irreführende Navigation erscheint.
**AC:**
- Given Profil gespeichert, Then Navigation zeigt Nutzername oder „Mein Konto" — kein „Anmelden"-Button.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT12-S08 — Buchungsformular (eingeloggt): Profildaten vorausfüllen
**Type:** Enhancement
**Story:** Als eingeloggter Kunde möchte ich das Buchungsformular mit meinen Profildaten vorausgefüllt sehen, damit ich keine bekannten Informationen erneut eingeben muss.
**AC:**
- Given eingeloggt + Buchungsformular, Then Name/E-Mail/Telefon/Adresse (wenn vorhanden) vorausgefüllt.
- Given Formularwert geändert + abgesendet, Then geänderter Wert für Buchung, Profil nicht überschrieben.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT12-S09 — Buchungsformular: Scroll-Jump bei Feldwechsel unterbinden
**Type:** Bug
**Story:** Als eingeloggter Kunde möchte ich beim Ausfüllen des Buchungsformulars keine Scrollsprünge erleben, damit das Ausfüllen komfortabel ist.
**AC:**
- Given zwischen Feldern gewechselt (Tab/Klick), Then Scrollposition unverändert.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT12-S10 — Bild-Upload im Buchungsformular reparieren (INTERNAL_ERROR)
**Type:** Bug
**Story:** Als Kunde möchte ich Bilder zum Buchungsformular hochladen, damit Tom einen visuellen Eindruck des Auftrags bekommt.
**AC:**
- Given Bild (JPEG/PNG ≤ 10 MB) hochgeladen, Then erfolgreich zu Vercel Blob hochgeladen, öffentliche URL zurückgegeben — kein INTERNAL_ERROR.
- Given BLOB_READ_WRITE_TOKEN in Vercel gesetzt, Then Upload-Endpoint funktioniert.
- Given Datei zu groß, Then deutschsprachige Fehlermeldung — kein technischer Stack-Trace.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT12-S11 — Buchungsformular: Submission-Feedback reparieren + Anfragen im Dashboard
**Type:** Bug
**Story:** Als eingeloggter Kunde möchte ich nach dem Absenden des Buchungsformulars klares Feedback erhalten und meine Anfrage im Dashboard sehen.
**AC:**
- Given Buchung erfolgreich (201), Then Loader verschwindet, Erfolgsmeldung erscheint, Submit-Button deaktiviert oder Weiterleitung.
- Given Buchung erfolgreich + `/konto` aufgerufen, Then neue Anfrage in Buchungsliste.
- Given 4xx/5xx, Then Loader verschwindet, Fehlermeldung DE, Button wieder aktiv.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 5

---

#### IT12-S12 — Admin-Dashboard „Bevorstehende Termine": Interner Serverfehler
**Type:** Bug
**Story:** Als Admin möchte ich bevorstehende Termine im Dashboard sehen, damit ich meinen Arbeitstag planen kann.
**AC:**
- Given Admin-Dashboard geladen, Then Widget „Bevorstehende Termine" zeigt Termine oder „Keine bevorstehenden Termine" — kein Fehler.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT12-S13 — Admin-Dashboard „Buchungsanfragen": Interner Serverfehler
**Type:** Bug
**Story:** Als Admin möchte ich alle eingegangenen Buchungsanfragen einsehen, damit ich auf Anfragen reagieren kann.
**AC:**
- Given Buchungsanfragen-Bereich geladen, Then alle offenen Anfragen sichtbar — kein Fehler.
- Given keine Anfragen, Then „Keine Buchungsanfragen vorhanden".
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 2

---

#### IT12-S14 — Admin-Navigation neu strukturieren
**Type:** Enhancement
**Story:** Als Admin möchte ich eine klar strukturierte Navigation ohne Duplikate, damit ich schnell zu den richtigen Bereichen navigiere.
**AC:**
- Given Admin-Navigation, Then 3 Gruppen: (1) Kalender & Zeitmanagement, (2) Nutzerverwaltung, (3) Auswertungen — kein doppelter „Bewertungen"-Eintrag.
- Given alle Navigationspunkte geklickt, Then jeder führt zu funktionierender Seite (kein 404/500).
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 3

---

#### IT12-S15 — Admin: Kunden per E-Mail ansprechen (Marketing-E-Mail mit Service-Filter)
**Type:** Feature
**Story:** Als Admin möchte ich Kunden gefiltert nach genutztem Service per E-Mail anschreiben, damit ich gezielte Marketing-E-Mails versenden kann.
**AC:**
- Given Nutzerverwaltung, Then Service-Filter (Mehrfachauswahl) vorhanden; Liste zeigt nur Kunden mit Buchung für gewählte Services.
- Given Kunden ausgewählt + „E-Mail senden" geklickt, Then Compose-Modal mit Betreff/Nachricht + Empfänger-Vorschau.
- Given > 50 Empfänger, Then Bestätigungswarnung „X Empfänger — fortfahren?".
- Given Versand abgeschlossen, Then Erfolgsmeldung mit Anzahl versendeter E-Mails; bei Fehlern: Liste fehlgeschlagener Adressen.
**Status:** ✅ Done | **Priority:** Must Have | **SP:** 8

---

## Backlog (zukünftig)

- **US-09** Instagram-Feed einbinden — letzte 3–6 Posts auf Startseite als Vorschau
- **US-28-Erweiterung** Automatische Preisberechnung (aktuell: manuell von Tom)
- **IT6-UX** Drag-and-drop für bestätigte Buchungen verschieben im Admin-Kalender (Could Have)

---

## Definition of Done
- Alle Bug-Stories: Reproduktionsschritte führen in Produktion nicht mehr zum Fehler
- Alle Feature-Stories: End-to-End getestet (Nutzerinteraktion → API → DB → sichtbares Ergebnis) in Produktion
- `next build` ohne Typ- oder Laufzeitfehler
- Vercel-Logs zeigen keine neuen ungeklärten Fehler nach Deployment
- Tom Siefert hat Must-Have-Stories im Produktions-Build manuell abgenommen
- Keine admin-internen Felder (`adminNote`, `adminRating`, `passwordHash`, `final_price_eur`) in Kunden-API-Responses
- Prisma-Migrationen in Produktion applied (`prisma migrate deploy` bestätigt)
