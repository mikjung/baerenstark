# Bärenstark Hausservice — Projektdokumentation

**Slogan:** "Ihr Haus in bärenstarken Händen!"

---

## Vision

Eine professionelle, mobiloptimierte Website für Bärenstark Hausservice, die Besuchern in Darmstadt und Umgebung das Service-Portfolio übersichtlich präsentiert und gleichzeitig eine unkomplizierte Online-Buchung ermöglicht — sodass Tom Siefert Anfragen zentral verwalten kann, ohne technisches Vorwissen zu benötigen.

---

## Kontaktdaten

| Feld       | Wert                              |
|------------|-----------------------------------|
| Inhaber    | Tom Siefert                       |
| Telefon    | 0157-74787512                     |
| E-Mail     | hausservice-baerenstark@outlook.com |
| Standort   | Darmstadt und Umgebung            |
| Instagram  | vorhanden (Link folgt)            |

---

## Services

- Entrümpelungen
- Entkernungsarbeiten
- Reinigungsarbeiten
- Grünflächenpflege
- Mülltonnenservice
- Entsorgung von Schrott und Metallen

---

## Design-Vorgaben

- **Sprache:** Deutsch
- **Farbschema:** Braun / Beige / Holz-Töne passend zum Logo
- **Logo:** `images/logo.png`
- **Ansatz:** Mobile-first, responsive

---

## User Stories

### Kernbereiche

1. **Portfolio** — Besucher kann Services entdecken
2. **Buchung (Kundenseite)** — Kunde kann ein Zeitfenster anfragen
3. **Admin-Verwaltung** — Tom verwaltet Zeitfenster und Anfragen

---

### Iteration 1 (abgeschlossen)

---

#### US-01: Service-Portfolio einsehen

**Als** Besucher  
**möchte ich** alle angebotenen Dienstleistungen auf einen Blick sehen,  
**damit** ich schnell einschätzen kann, ob Bärenstark der richtige Anbieter für mein Anliegen ist.

**Akzeptanzkriterien:**

- **Given** ich öffne die Startseite,  
  **When** die Seite geladen ist,  
  **Then** sehe ich alle sechs Services (Entrümpelungen, Entkernungsarbeiten, Reinigungsarbeiten, Grünflächenpflege, Mülltonnenservice, Entsorgung) mit je einem Titel und einer kurzen Beschreibung.

- **Given** ich nutze ein Smartphone,  
  **When** ich die Service-Übersicht scrolle,  
  **Then** sind alle Karten lesbar ohne horizontales Scrollen (Mobile-first-Layout).

**Priorität:** Must Have

---

#### US-02: Kontaktinformationen finden

**Als** Besucher  
**möchte ich** Telefonnummer und E-Mail-Adresse sofort finden,  
**damit** ich bei Bedarf direkt Kontakt aufnehmen kann.

**Akzeptanzkriterien:**

- **Given** ich befinde mich auf einer beliebigen Seite,  
  **When** ich nach unten scrolle,  
  **Then** finde ich im Footer Telefonnummer, E-Mail-Adresse und Standort.

- **Given** ich nutze ein Smartphone,  
  **When** ich auf die Telefonnummer tippe,  
  **Then** öffnet sich die Telefon-App mit der vorausgefüllten Nummer.

**Priorität:** Must Have

---

#### US-03: Verfügbare Zeitfenster anzeigen lassen

**Als** Kunde  
**möchte ich** sehen, wann Bärenstark verfügbar ist,  
**damit** ich einen passenden Termin für meinen Auftrag wählen kann.

**Akzeptanzkriterien:**

- **Given** ich öffne die Buchungsseite,  
  **When** die Seite geladen ist,  
  **Then** sehe ich eine Liste oder Kalenderansicht der vom Admin freigegebenen Zeitfenster.

- **Given** ein Zeitfenster ist bereits ausgebucht,  
  **When** ich die Buchungsseite aufrufe,  
  **Then** ist dieses Zeitfenster als nicht buchbar markiert und kann nicht ausgewählt werden.

**Priorität:** Must Have

---

#### US-04: Buchungsanfrage stellen

**Als** Kunde  
**möchte ich** ein verfügbares Zeitfenster auswählen und meine Kontaktdaten hinterlassen,  
**damit** Tom meine Anfrage prüfen und bestätigen kann.

**Akzeptanzkriterien:**

- **Given** ich habe ein Zeitfenster ausgewählt,  
  **When** ich das Buchungsformular ausfülle (Name, Telefon, Service, kurze Beschreibung) und abschicke,  
  **Then** erhalte ich eine Bestätigungsmeldung auf der Seite, dass meine Anfrage eingegangen ist.

- **Given** ich lasse ein Pflichtfeld leer,  
  **When** ich auf „Absenden" klicke,  
  **Then** erscheint eine Fehlermeldung direkt am betreffenden Feld, ohne die Seite neu zu laden.

**Priorität:** Must Have

---

#### US-05: Zeitfenster einpflegen (Admin)

**Als** Admin (Tom)  
**möchte ich** neue Zeitfenster anlegen und vorhandene löschen,  
**damit** Kunden nur tatsächlich verfügbare Termine buchen können.

**Akzeptanzkriterien:**

- **Given** ich bin eingeloggt im Admin-Bereich,  
  **When** ich Datum, Uhrzeit und optionale Beschreibung eingebe und speichere,  
  **Then** erscheint das neue Zeitfenster sofort in der öffentlichen Buchungsansicht.

- **Given** ich bin eingeloggt,  
  **When** ich ein bestehendes Zeitfenster lösche,  
  **Then** ist es innerhalb von Sekunden nicht mehr buchbar.

**Priorität:** Must Have

---

#### US-06: Buchungsanfragen verwalten (Admin)

**Als** Admin (Tom)  
**möchte ich** alle eingegangenen Buchungsanfragen einsehen und als bestätigt oder abgelehnt markieren,  
**damit** ich den Überblick behalte und keine Anfrage vergesse.

**Akzeptanzkriterien:**

- **Given** ich bin eingeloggt,  
  **When** ich den Bereich „Anfragen" öffne,  
  **Then** sehe ich alle Anfragen mit Name, Service, gewähltem Zeitfenster und Status (offen / bestätigt / abgelehnt).

- **Given** eine Anfrage hat den Status „offen",  
  **When** ich auf „Bestätigen" klicke,  
  **Then** wechselt der Status auf „bestätigt" und das Zeitfenster wird in der Buchungsansicht als belegt markiert.

**Priorität:** Must Have

---

#### US-07: Admin-Login

**Als** Admin (Tom)  
**möchte ich** mich mit Benutzername und Passwort einloggen,  
**damit** nur ich Zugang zur Verwaltungsoberfläche habe.

**Akzeptanzkriterien:**

- **Given** ich rufe `/admin` auf,  
  **When** ich gültige Zugangsdaten eingebe,  
  **Then** werde ich zum Admin-Dashboard weitergeleitet.

- **Given** ich gebe falsche Zugangsdaten ein,  
  **When** ich auf „Anmelden" klicke,  
  **Then** erscheint eine Fehlermeldung, ohne dass sensible Details (z.B. ob Benutzername existiert) preisgegeben werden.

- **Given** ich bin nicht eingeloggt,  
  **When** ich direkt eine Admin-URL aufrufe,  
  **Then** werde ich zur Login-Seite weitergeleitet.

**Priorität:** Must Have

---

#### US-08: E-Mail-Benachrichtigung bei neuer Anfrage (Admin)

**Als** Admin (Tom)  
**möchte ich** eine E-Mail erhalten, sobald eine neue Buchungsanfrage eingeht,  
**damit** ich schnell reagieren kann, auch wenn ich nicht im Admin-Bereich eingeloggt bin.

**Akzeptanzkriterien:**

- **Given** ein Kunde hat eine Buchungsanfrage abgeschickt,  
  **When** das Formular erfolgreich verarbeitet wurde,  
  **Then** erhält Tom eine E-Mail an `hausservice-baerenstark@outlook.com` mit Name, Service, Zeitfenster und Kontaktdaten des Kunden.

**Priorität:** Must Have

---

### Iteration 2 (abgeschlossen)

---

#### BUG US-04: Buchungsanfrage absenden schlägt fehl

**Beschreibung:** Eingegangene Buchungsanfragen erscheinen nicht im Admin-Portal. Der Absende-Vorgang schlägt serverseitig fehl, sodass Tom keine Anfragen erhält.

**Erwartetes Verhalten:** Nach erfolgreichem Absenden des Buchungsformulars (US-04) erscheint die Anfrage sofort unter „Anfragen" im Admin-Portal (US-06).

**Priorität:** Blocker — muss vor allen anderen Iteration-2-Stories behoben sein.

---

#### US-13: Alternativtermin vorschlagen (Admin)

**Als** Admin (Tom)  
**möchte ich** einer offenen Buchungsanfrage einen alternativen Terminvorschlag schicken,  
**damit** ich Kunden flexibel einen anderen Slot anbieten kann, ohne die Anfrage sofort ablehnen zu müssen.

**Akzeptanzkriterien:**

- **Given** ich bin eingeloggt und öffne eine offene Anfrage,  
  **When** ich auf „Alternativtermin vorschlagen" klicke, einen neuen Wunschtermin (Datum + Uhrzeit) eingebe und bestätige,  
  **Then** wird der Status der Anfrage auf „Alternativvorschlag gesendet" gesetzt und der Kunde erhält eine E-Mail mit dem vorgeschlagenen Termin sowie einem eindeutigen Aktionslink.

- **Given** der Kunde erhält die E-Mail mit dem Alternativvorschlag,  
  **When** er den Aktionslink öffnet,  
  **Then** sieht er eine Seite mit drei Optionen: „Vorschlag annehmen", „Neuen Termin wählen" und „Anfrage stornieren".

- **Given** der Kunde klickt auf „Vorschlag annehmen",  
  **When** die Aktion verarbeitet wurde,  
  **Then** wechselt der Anfrage-Status im Admin-Portal auf „bestätigt", der Termin wird als belegt markiert und Tom erhält eine Benachrichtigungs-E-Mail.

- **Given** der Kunde klickt auf „Neuen Termin wählen",  
  **When** er einen verfügbaren Tag im Kalender auswählt und den Wunschtermin einreicht,  
  **Then** erscheint die Anfrage erneut als „offen" im Admin-Portal, mit dem neu gewünschten Termin, und Tom erhält eine Benachrichtigungs-E-Mail.

- **Given** der Aktionslink wurde bereits verwendet,  
  **When** jemand ihn erneut aufruft,  
  **Then** wird eine Hinweisseite angezeigt, dass der Link nicht mehr gültig ist.

**Priorität:** Must Have

---

#### US-14: Anfrage stornieren (Kunde)

**Als** Kunde  
**möchte ich** meine eigene Buchungsanfrage stornieren können,  
**damit** ich eine unbenötigte Anfrage selbstständig zurückziehen kann, ohne Tom persönlich kontaktieren zu müssen.

**Akzeptanzkriterien:**

- **Given** ich habe eine Buchungsanfrage gestellt und eine Bestätigungs- oder Vorschlags-E-Mail mit Aktionslink erhalten,  
  **When** ich den Link öffne und auf „Anfrage stornieren" klicke,  
  **Then** wird der Status der Anfrage im Admin-Portal auf „storniert" gesetzt und das zugehörige Zeitfenster wird wieder als verfügbar markiert.

- **Given** die Anfrage wurde erfolgreich storniert,  
  **When** die Stornierung verarbeitet wurde,  
  **Then** erhält Tom eine E-Mail mit dem Hinweis, dass der Kunde die Anfrage storniert hat (Name, Service, ursprünglicher Termin).

- **Given** der Stornierungslink wurde bereits verwendet oder die Anfrage ist bereits in einem Endstatus (bestätigt / abgelehnt),  
  **When** jemand den Link aufruft,  
  **Then** erscheint eine Hinweisseite, dass die Stornierung nicht mehr möglich ist oder bereits erfolgt ist.

**Priorität:** Must Have

---

#### US-15: Wochentag-basierte Verfügbarkeit einpflegen (Admin)

**Als** Admin (Tom)  
**möchte ich** Wochentage als grundsätzlich verfügbar definieren und bestätigte Buchungen als Blocker sehen,  
**damit** ich auf einen Blick erkenne, wann mein Kalender noch offen ist und Kunden nur an realistisch buchbaren Tagen anfragen.

**Akzeptanzkriterien:**

- **Given** ich bin eingeloggt im Admin-Bereich,  
  **When** ich den Bereich „Verfügbarkeit" öffne,  
  **Then** sehe ich eine Übersicht der sieben Wochentage, bei der ich jeden Tag einzeln als „verfügbar" oder „nicht verfügbar" ein- oder ausschalten kann.

- **Given** ich habe Montag bis Freitag als verfügbar gesetzt und speichere,  
  **When** ein Kunde die Buchungsseite aufruft,  
  **Then** werden Samstag und Sonntag als nicht buchbar angezeigt.

- **Given** eine Buchungsanfrage wurde bestätigt (Status „bestätigt"),  
  **When** ich die Verfügbarkeitsübersicht aufrufe,  
  **Then** wird der jeweilige Termin als Blocker in der Kalenderansicht hervorgehoben und der entsprechende Tag zeigt die Anzahl bestätigter Buchungen.

- **Given** ich ändere die Verfügbarkeit eines Wochentags,  
  **When** ich die Änderung speichere,  
  **Then** ist die Änderung innerhalb von Sekunden in der öffentlichen Kalenderansicht für Kunden sichtbar.

**Priorität:** Must Have

---

#### US-16: Kalenderansicht für Kunden

**Als** Kunde  
**möchte ich** einen Kalender mit grün markierten (verfügbaren) und rot markierten (blockierten) Tagen sehen,  
**damit** ich sofort erkenne, wann ich Bärenstark buchen kann, und direkt aus dem Kalender heraus den Buchungsflow starten kann.

**Akzeptanzkriterien:**

- **Given** ich rufe die Buchungsseite auf,  
  **When** der Kalender geladen ist,  
  **Then** sehe ich eine Monatsansicht, bei der verfügbare Tage grün und nicht verfügbare Tage (gesperrte Wochentage oder bestätigte Buchungen) rot eingefärbt sind.

- **Given** ich sehe einen grün markierten Tag,  
  **When** ich auf diesen Tag klicke,  
  **Then** öffnet sich das Buchungsformular mit dem ausgewählten Datum vorausgefüllt.

- **Given** ich sehe einen rot markierten Tag,  
  **When** ich auf diesen Tag klicke,  
  **Then** erscheint ein Hinweis, dass dieser Tag nicht verfügbar ist; das Buchungsformular öffnet sich nicht.

- **Given** ich befinde mich im aktuellen Monat,  
  **When** der Kalender angezeigt wird,  
  **Then** sind vergangene Tage ebenfalls als nicht buchbar markiert und können nicht ausgewählt werden.

- **Given** ich nutze ein Smartphone,  
  **When** ich den Kalender aufrufe,  
  **Then** ist die Kalenderansicht touch-freundlich und vollständig bedienbar ohne horizontales Scrollen.

**Priorität:** Must Have

---

### Iteration 3 (aktuell)

---

#### BUG: Buchungsformular-Übermittlung schlägt fehl

**Beschreibung:** Das Absenden des Buchungsformulars schlägt serverseitig fehl — Anfragen erscheinen nicht im Admin-Portal, Tom erhält keine Benachrichtigungs-E-Mail und der Kunde bekommt keine Rückmeldung über Erfolg oder Misserfolg.

**Erwartetes Verhalten:** Nach erfolgreichem Absenden erscheint die Anfrage sofort im Admin-Portal, Tom erhält eine E-Mail, der Kunde sieht eine Erfolgsmeldung. Bei Fehler: verständliche deutschsprachige Fehlermeldung.

**Priorität:** Blocker — wird als erstes behoben.

---

#### US-17: Zeitfenster-Redesign — Verfügbarkeitsfenster mit Default-Vorlage

**Als** Admin (Tom)  
**möchte ich** pro Wochentag ein Von/Bis-Verfügbarkeitsfenster definieren und eine Default-Vorlage auf alle Tage anwenden,  
**damit** Kunden innerhalb dieser Fenster einen konkreten Wunschtermin auswählen können, ohne dass ich jeden Slot manuell anlegen muss.

**Akzeptanzkriterien:**

- **Given** ich öffne „Verfügbarkeit" im Admin-Bereich, **When** ich eine Default-Vorlage (z.B. Mo–Fr 08:00–17:00) definiere und auf „Auf alle Tage anwenden" klicke, **Then** werden alle sieben Wochentage mit diesem Fenster befüllt.
- **Given** die Default-Vorlage wurde angewendet, **When** ich einen einzelnen Tag manuell auf ein anderes Fenster ändere, **Then** überschreibt die Änderung nur diesen Tag; alle anderen Tage bleiben unberührt.
- **Given** ich habe Fenster gesetzt, **When** ein Kunde einen verfügbaren Tag auswählt, **Then** kann er im Buchungsformular eine Uhrzeit innerhalb des Fensters in 30-Minuten-Schritten wählen.

**Hinweis:** Ersetzt das manuelle Slot-Modell aus US-05. Bestehende verfügbar/nicht-verfügbar-Einstellungen aus US-15 bleiben erhalten.

**Priorität:** Must Have | **Story Points:** 5

---

#### US-18: Datei-Upload im Buchungsformular

**Als** Kunde  
**möchte ich** beim Ausfüllen der Buchungsanfrage Fotos, Videos oder Dokumente hochladen können,  
**damit** Tom meine Situation besser einschätzen kann, bevor er den Termin bestätigt.

**Akzeptanzkriterien:**

- **Given** ich befinde mich im Buchungsformular, **When** ich auf „Dateien hinzufügen" klicke, **Then** kann ich Bilder (jpg, png, webp), Videos (mp4, mov) und Dokumente (pdf) auswählen.
- **Given** eine Datei überschreitet 20 MB, **When** ich sie auswähle, **Then** erscheint eine Fehlermeldung „Datei zu groß (max. 20 MB)".
- **Given** Dateien wurden hochgeladen und die Anfrage wird abgeschickt, **When** Tom die Anfrage im Admin-Portal öffnet, **Then** sieht er die Dateien als klickbare Links oder Vorschaubilder.
- **Given** kein Upload gewünscht, **When** das Formular abgeschickt wird, **Then** funktioniert die Übermittlung ohne Anhänge problemlos (Upload ist optional).

**Priorität:** Must Have | **Story Points:** 5

---

#### US-19: Individuelle Serviceanfrage als Formularoption

**Als** Kunde  
**möchte ich** im Buchungsformular „Sonstige / Individuelle Anfrage" als Service-Option auswählen können,  
**damit** ich auch für nicht gelistete Leistungen unkompliziert anfragen kann.

**Akzeptanzkriterien:**

- **Given** ich öffne die Service-Auswahl im Formular, **When** ich die Liste aufklappe, **Then** erscheint „Sonstige / Individuelle Anfrage" als letzter Eintrag.
- **Given** ich wähle diese Option, **When** die Auswahl getroffen ist, **Then** erscheint ein Pflichtfeld „Beschreiben Sie Ihr Anliegen".
- **Given** die Anfrage wurde abgeschickt, **When** Tom sie im Admin-Portal öffnet, **Then** wird der Service als „Sonstige / Individuelle Anfrage" angezeigt mit dem Freitext in einem eigenen Feld.

**Priorität:** Must Have | **Story Points:** 2

---

#### US-20: Preise für Serviceleistungen anzeigen

**Als** Besucher  
**möchte ich** Richtwerte für die Stundensätze der einzelnen Services sehen,  
**damit** ich vor einer Anfrage eine erste Preiseinschätzung erhalten kann.

**Richtwerte (Darmstadt-Region):**

| Service                       | Richtpreis         |
|-------------------------------|--------------------|
| Entrümpelungen                | ab 35 €/h          |
| Entkernungsarbeiten           | ab 45 €/h          |
| Reinigungsarbeiten            | ab 25 €/h          |
| Grünflächenpflege             | ab 30 €/h          |
| Mülltonnenservice             | ab 20 €/h          |
| Entsorgung Schrott / Metalle  | ab 40 €/h / Gewicht|

**Akzeptanzkriterien:**

- **Given** ich betrachte die Service-Karten, **When** die Seite geladen ist, **Then** sehe ich bei jedem Service den Richtpreis.
- **Given** ich lese den Preishinweis, **When** ich ihn hover (Desktop) oder direkt sehe (Mobile), **Then** ist ein Disclaimer sichtbar: „Richtpreis für die Region Darmstadt. Finale Preise nach Besichtigung / auf Anfrage."

**Priorität:** Must Have | **Story Points:** 3

---

#### US-21: Admin-Dashboard — Übersicht bevorstehende Termine

**Als** Admin (Tom)  
**möchte ich** auf einen Blick alle bevorstehenden bestätigten Termine chronologisch sehen,  
**damit** ich meinen Arbeitstag planen kann, ohne jeden Eintrag einzeln aufrufen zu müssen.

**Akzeptanzkriterien:**

- **Given** ich öffne das Admin-Dashboard, **When** die Seite geladen ist, **Then** sehe ich alle zukünftigen bestätigten Termine sortiert nach Datum mit Uhrzeit, Kundenname und Service.
- **Given** heute Termine anstehen, **When** das Dashboard geladen ist, **Then** sind diese mit einem „Heute"-Label visuell hervorgehoben.
- **Given** ich klicke auf einen Termin, **When** der Klick verarbeitet ist, **Then** navigiere ich zur vollständigen Anfrage-Detailseite.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-22: Feedback-Sektion mit Kundenbewertungen

**Als** Besucher  
**möchte ich** Kundenbewertungen mit Sternebewertung lesen,  
**damit** ich Vertrauen in Bärenstark aufbaue, bevor ich anfrage.

**Akzeptanzkriterien:**

- **Given** ich scrolle zur Feedback-Sektion, **When** die Sektion geladen ist, **Then** sehe ich 10 Bewertungen mit Kundename, Service, Text und Sternen (visuell).
- **Given** die Beispieldaten eingebaut sind, **When** ich die Sektion aufrufe, **Then** ist der sichtbare Gesamtdurchschnitt 4 von 5 Sternen.
- **Given** mehr als 6 Bewertungen vorhanden sind, **When** die Sektion geladen ist, **Then** werden initial 4–6 angezeigt mit einem „Mehr anzeigen"-Button.

**Hinweis:** Ersetzt und erfüllt US-10 (Backlog). US-10 gilt als abgeschlossen. Datenstruktur muss kompatibel mit US-29 (Iteration 4) sein.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-23: Service-Popups mit Vorher/Nachher-Darstellung

**Als** Besucher  
**möchte ich** bei jedem Service ein interaktives Popup mit Vorher/Nachher-Beispielen und Leistungsdetails öffnen können,  
**damit** ich besser verstehe, was mich bei Bärenstark erwartet.

**Akzeptanzkriterien:**

- **Given** ich klicke auf eine Service-Karte oder „Mehr erfahren", **When** das Popup öffnet, **Then** sehe ich Servicename, ausführliche Beschreibung, mindestens ein Vorher/Nachher-Bildpaar und einen CTA „Jetzt anfragen".
- **Given** das Popup geöffnet ist, **When** ich auf X klicke, den Hintergrund anklicke oder Escape drücke, **Then** schließt sich das Popup.
- **Given** ich klicke auf „Jetzt anfragen" im Popup, **When** der Klick verarbeitet ist, **Then** schließt sich das Popup und das Buchungsformular öffnet sich mit vorausgewähltem Service.
- **Given** sechs Services existieren, **When** Iteration 3 abgeschlossen ist, **Then** hat jeder Service ein eigenes Popup mit individuellem Inhalt.

**Hinweis:** Vorher/Nachher-Bilder sind für IT3 Platzhalter. Tom liefert echte Fotos nach. Design muss Braun/Beige/Holz-Palette nutzen.

**Priorität:** Must Have | **Story Points:** 5

---

#### US-24: Bestätigungs- und Storno-E-Mail an Kunden (ohne Portal)

**Als** Kunde  
**möchte ich** nach jeder relevanten Statusänderung meiner Anfrage eine E-Mail erhalten — mit Eingangsbestätigung, Terminbestätigung und Stornierungslink —,  
**damit** ich jederzeit informiert bin und meine Anfrage ohne Kundenportal verwalten kann.

**Akzeptanzkriterien:**

- **Given** ich habe eine Anfrage mit E-Mail abgeschickt, **When** das Formular verarbeitet wurde, **Then** erhalte ich eine Eingangsbestätigung mit Anfragedaten und cancelToken-Link.
- **Given** Tom bestätigt eine Anfrage, **When** der Status auf „bestätigt" gesetzt wird, **Then** erhalte ich eine Terminbestätigungs-E-Mail mit Datum, Uhrzeit, Service und Stornierungslink.
- **Given** Tom lehnt eine Anfrage ab, **When** der Status auf „abgelehnt" gesetzt wird, **Then** erhalte ich eine E-Mail mit dem Hinweis und einer Einladung, neu anzufragen.
- **Given** alle E-Mails versendet werden, **When** sie ankommen, **Then** sind sie auf Deutsch, vom Absender „Bärenstark Hausservice" und enthalten Toms Kontaktdaten im Footer.

**Hinweis:** Verbindet und schließt US-11 (Backlog) ab. Ergänzt den cancelToken-Mechanismus aus US-14.

**Priorität:** Must Have | **Story Points:** 5

---

### Iteration 4 (abgeschlossen)

---

#### US-25: Kundenportal — Optionale Registrierung und Login

**Als** Kunde  
**möchte ich** optional ein Kundenkonto anlegen und mich einloggen können,  
**damit** ich meine Aufträge zentral verwalten kann — ohne zur Buchung gezwungen zu sein.

**Akzeptanzkriterien:**

- **Given** ich rufe `/konto/registrieren` auf,  
  **When** ich E-Mail-Adresse und Passwort (mind. 8 Zeichen) eingebe und auf „Konto erstellen" klicke,  
  **Then** erhalte ich eine Bestätigungs-E-Mail mit Verifizierungslink und sehe den Hinweis „Bitte bestätigen Sie Ihre E-Mail-Adresse".

- **Given** ich klicke auf den Verifizierungslink in der E-Mail,  
  **When** der Link gültig ist (max. 24 h),  
  **Then** wird mein Konto aktiviert und ich werde automatisch zu `/konto` weitergeleitet.

- **Given** ich rufe `/konto/login` auf,  
  **When** ich meine verifizierten Zugangsdaten eingebe und auf „Einloggen" klicke,  
  **Then** werde ich zu `/konto` weitergeleitet und sehe meinen Namen in der Navigation.

- **Given** ich gebe beim Login falsche Zugangsdaten ein,  
  **When** ich auf „Einloggen" klicke,  
  **Then** erscheint die Fehlermeldung „E-Mail oder Passwort ungültig" — ohne Hinweis, welches Feld falsch ist.

- **Given** ich bin auf `/konto/login`,  
  **When** ich auf „Passwort vergessen" klicke und meine E-Mail eingebe,  
  **Then** erhalte ich innerhalb von 2 Minuten eine E-Mail mit einem Passwort-Reset-Link (gültig 1 Stunde).

- **Given** ich klicke auf den Passwort-Reset-Link,  
  **When** ich ein neues Passwort (mind. 8 Zeichen) eingebe und bestätige,  
  **Then** wird das Passwort geändert und ich werde zu `/konto/login` weitergeleitet.

- **Given** ich möchte keine Registrierung,  
  **When** ich die Buchungsseite aufrufe und das Formular abschicke,  
  **Then** funktioniert die Gastbuchung wie bisher — inklusive cancelToken per E-Mail.

- **Given** ich bin eingeloggt und buche einen neuen Auftrag,  
  **When** das Formular abgeschickt wird,  
  **Then** wird die neue Buchung automatisch meinem Kundenkonto zugeordnet.

- **Given** ich rufe eine geschützte Seite unter `/konto/*` auf ohne eingeloggt zu sein,  
  **When** die Seite geladen wird,  
  **Then** werde ich zu `/konto/login` weitergeleitet.

- **Given** ich bin eingeloggt,  
  **When** ich unter `/konto/profil` meinen Namen, meine Telefonnummer oder E-Mail ändere und speichere,  
  **Then** werden die Änderungen gespeichert und eine Bestätigungsmeldung erscheint.

**Hinweis:** `CustomerUser` ist eine separate Entität vom Admin-`User`. Kunden haben keinen Zugang zum Admin-Bereich. Gastbuchungen werden nicht rückwirkend einem Konto zugeordnet.

**Priorität:** Must Have | **Story Points:** 8

---

#### US-26: Kundenportal — Auftragsübersicht

**Als** eingeloggter Kunde  
**möchte ich** alle meine Aufträge in einer übersichtlichen Liste sehen,  
**damit** ich Status, Datum und Details jederzeit nachverfolgen kann.

**Akzeptanzkriterien:**

- **Given** ich bin eingeloggt und rufe `/konto` auf,  
  **When** die Seite geladen ist,  
  **Then** sehe ich zwei Bereiche: „Bevorstehende Termine" (Datum >= heute) und „Vergangene Aufträge" (Datum < heute), jeweils chronologisch sortiert.

- **Given** ich sehe einen Eintrag in der Auftragsübersicht,  
  **When** die Zeile angezeigt wird,  
  **Then** enthält sie: Datum, Uhrzeit, Service, Status-Badge auf Deutsch und — sofern hinterlegt — den Preis.

- **Given** Status-Badges werden angezeigt,  
  **When** ein Auftrag verschiedene Zustände hat,  
  **Then** lauten die Beschriftungen: „Offen" (PENDING), „Bestätigt" (CONFIRMED), „Abgelehnt" (REJECTED), „Storniert" (CANCELLED), „Gegenvorschlag ausstehend" (COUNTER_PROPOSED).

- **Given** ich klicke auf einen Auftrag,  
  **When** die Detailseite geladen ist,  
  **Then** sehe ich alle Buchungsdetails: Datum, Uhrzeit, Service, Beschreibung, hochgeladene Dateien, Status und Zahlungsstatus.

- **Given** ich habe noch keine Aufträge,  
  **When** ich `/konto` aufrufe,  
  **Then** erscheint die Meldung „Sie haben noch keine Aufträge" mit dem CTA-Button „Ersten Auftrag buchen".

**Hinweis:** Nur Buchungen nach Kontoerstellung erscheinen hier. Gastbuchungen bleiben unsichtbar.

**Priorität:** Must Have | **Story Points:** 5

---

#### US-27: Kundenportal — Stornierung über Portal

**Als** eingeloggter Kunde  
**möchte ich** einen bevorstehenden Auftrag direkt im Portal stornieren können,  
**damit** ich keine E-Mail mit Stornierungslink suchen muss.

**Akzeptanzkriterien:**

- **Given** ich sehe einen Auftrag mit Status „Offen" (PENDING) oder „Gegenvorschlag ausstehend" (COUNTER_PROPOSED),  
  **When** ich auf „Stornieren" klicke,  
  **Then** öffnet sich ein Confirm-Dialog: „Möchten Sie diesen Termin wirklich stornieren?" mit „Ja, stornieren" und „Abbrechen".

- **Given** ich bestätige die Stornierung,  
  **When** sie verarbeitet ist,  
  **Then** ändert sich der Status-Badge sofort auf „Storniert", der Button verschwindet und Tom erhält eine Benachrichtigungs-E-Mail.

- **Given** ein bestätigter Termin liegt mehr als 24 Stunden in der Zukunft,  
  **When** ich auf „Stornieren" klicke und bestätige,  
  **Then** wird der Auftrag storniert und der Zeitslot wird wieder freigegeben.

- **Given** ein bestätigter Termin liegt weniger als 24 Stunden in der Zukunft,  
  **When** ich die Auftragsdetails aufrufe,  
  **Then** ist der „Stornieren"-Button deaktiviert mit dem Hinweis: „Stornierung nur bis 24 Stunden vor dem Termin möglich. Bitte kontaktieren Sie uns direkt: 0157-74787512."

- **Given** ein Auftrag hat Status „Abgelehnt", „Storniert" oder liegt in der Vergangenheit,  
  **When** ich die Auftragsdetails aufrufe,  
  **Then** ist kein „Stornieren"-Button sichtbar.

**Hinweis:** Stornierungsfrist 24 Stunden ist festgelegt. Ergänzt US-14 (cancelToken) für Portal-Nutzer.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-28: Zahlungsabwicklung

**Als** Kunde  
**möchte ich** nach Bestätigung meines Auftrags per PayPal, Apple Pay oder Google Pay bezahlen können,  
**damit** keine Banküberweisung nötig ist und die Transaktion sicher und schnell abläuft.

**Akzeptanzkriterien:**

- **Given** Tom hat einen Betrag für einen bestätigten Auftrag im Admin-Dashboard hinterlegt,  
  **When** der Betrag gespeichert wird,  
  **Then** erhält der Kunde eine E-Mail mit Betreff „Ihre Rechnung von Bärenstark Hausservice", dem fälligen Betrag und dem Link zur Zahlungsseite `/konto/zahlung/:bookingId`.

- **Given** ich rufe `/konto/zahlung/:bookingId` auf,  
  **When** die Seite geladen ist,  
  **Then** sehe ich Auftragsdetails, den fälligen Betrag und Zahlungsoptionen: PayPal, Apple Pay, Google Pay.

- **Given** ich wähle PayPal,  
  **When** ich auf „Mit PayPal bezahlen" klicke,  
  **Then** öffnet sich der Stripe-Payment-Flow mit PayPal-Option.

- **Given** ich wähle Apple Pay auf einem kompatiblen Gerät,  
  **When** ich auf „Mit Apple Pay bezahlen" klicke,  
  **Then** öffnet sich der native Apple-Pay-Dialog zur Bestätigung per Touch ID / Face ID.

- **Given** ich wähle Google Pay auf einem kompatiblen Gerät,  
  **When** ich auf „Mit Google Pay bezahlen" klicke,  
  **Then** öffnet sich der Google-Pay-Dialog.

- **Given** eine Zahlung wurde erfolgreich abgeschlossen,  
  **When** Stripe die Zahlung bestätigt (Webhook),  
  **Then** ändert sich der Zahlungsstatus im Admin-Dashboard auf „Bezahlt" und beide Parteien erhalten eine Zahlungsbestätigung per E-Mail.

- **Given** eine Zahlung schlägt fehl,  
  **When** der Fehler eintritt,  
  **Then** sehe ich eine deutschsprachige Fehlermeldung und kann es erneut versuchen.

- **Given** der Zahlungsstatus ist „Bezahlt",  
  **When** ich die Auftragsdetails im Portal öffne,  
  **Then** sehe ich den Badge „Bezahlt" und den bezahlten Betrag. Der Zahlungs-Button ist nicht mehr sichtbar.

**Hinweis:** Empfohlener Zahlungs-Stack: **Stripe** — unterstützt PayPal, Apple Pay und Google Pay über eine einzige Integration (Stripe Payment Element), ohne separaten PayPal-API-Account. Betrag wird manuell von Tom hinterlegt. Apple Pay / Google Pay nur auf kompatiblen Geräten sichtbar (progressive enhancement).

**Priorität:** Must Have | **Story Points:** 8

---

#### US-29: Kundenbewertungen (echtes Backend)

**Als** eingeloggter Kunde mit einem abgeschlossenen Auftrag  
**möchte ich** eine Bewertung (1–5 Sterne + optionaler Text) hinterlassen können,  
**damit** andere Besucher von meiner Erfahrung profitieren und Tom Feedback erhält.

**Akzeptanzkriterien:**

- **Given** mein Auftrag hat den Status „Abgeschlossen" (COMPLETED),  
  **When** ich die Auftragsdetails im Portal öffne,  
  **Then** sehe ich den Button „Bewertung abgeben".

- **Given** ich klicke auf „Bewertung abgeben",  
  **When** das Formular erscheint,  
  **Then** kann ich 1–5 Sterne auswählen (Pflicht) und einen optionalen Freitext eingeben (max. 500 Zeichen, Zeichenzähler sichtbar).

- **Given** ich versuche die Bewertung ohne Sternauswahl abzuschicken,  
  **When** ich auf „Absenden" klicke,  
  **Then** erscheint die Fehlermeldung „Bitte wählen Sie eine Sternebewertung".

- **Given** ich schicke eine gültige Bewertung ab,  
  **When** sie gespeichert wurde,  
  **Then** erscheint die Bestätigung „Vielen Dank für Ihre Bewertung! Sie wird nach Freigabe veröffentlicht." und der Button ist deaktiviert.

- **Given** ich habe für einen Auftrag bereits eine Bewertung abgegeben,  
  **When** ich den Auftrag erneut öffne,  
  **Then** ist der Bewertungs-Button deaktiviert und meine Bewertung wird schreibgeschützt angezeigt.

- **Given** Tom öffnet im Admin-Bereich die Bewertungsverwaltung,  
  **When** eine neue Bewertung vorliegt,  
  **Then** sieht er Kundename, Sternebewertung, Freitext, Service und kann „Freigeben" oder „Ablehnen" klicken.

- **Given** Tom gibt eine Bewertung frei,  
  **When** die Freigabe gespeichert wird,  
  **Then** erscheint die Bewertung auf der Startseite in der Feedback-Sektion (US-22).

- **Given** genug echte Bewertungen vorhanden sind (mind. 4 freigegebene),  
  **When** die Feedback-Sektion auf der Startseite geladen wird,  
  **Then** werden ausschließlich echte Bewertungen angezeigt — die Platzhalter aus US-22 (IT3) werden ersetzt.

**Hinweis:** Admin-Freigabe vor Veröffentlichung ist Pflicht. Datenstruktur muss kompatibel mit US-22 sein.

**Priorität:** Must Have | **Story Points:** 5

---

### Iteration 5 (aktuell)

---

#### US-30: Admin-Passwort-Reset verbessern (UX-Fix)

**Als** Admin (Tom)
**möchte ich** auf der Login-Seite einen gut sichtbaren „Passwort vergessen?"-Link finden und einen funktionierenden Reset-Prozess sowohl in der lokalen Entwicklungsumgebung als auch in der Produktion nutzen,
**damit** ich mich auch nach einem vergessenen Passwort zuverlässig und ohne fremde Hilfe wieder einloggen kann.

**Akzeptanzkriterien:**

- **Given** ich rufe `/admin/login` auf,
  **When** die Seite geladen ist,
  **Then** ist der Link „Passwort vergessen?" direkt unterhalb des Passwortfelds gut sichtbar platziert (ausreichende Schriftgröße, klickbare Fläche, kein visuelles Verstecken).

- **Given** ich klicke auf „Passwort vergessen?" und gebe meine Admin-E-Mail ein,
  **When** das Formular abgeschickt wird,
  **Then** erhalte ich innerhalb von 2 Minuten eine E-Mail über Resend mit einem Reset-Link, der auf die korrekte Umgebungs-URL zeigt (lokale Entwicklung: `http://localhost:3000/admin/passwort-reset`, Produktion: `https://<produktions-domain>/admin/passwort-reset`).

- **Given** ich klicke auf den Reset-Link in der E-Mail,
  **When** der Link aufgerufen wird und noch gültig ist (max. 1 Stunde),
  **Then** sehe ich das Formular unter `/admin/passwort-reset` mit zwei Feldern: „Neues Passwort" und „Passwort bestätigen".

- **Given** ich gebe ein neues Passwort (mind. 8 Zeichen) ein und bestätige es,
  **When** ich auf „Passwort ändern" klicke,
  **Then** wird das Passwort gespeichert, ich werde zu `/admin/login` weitergeleitet und sehe die Erfolgsmeldung „Passwort erfolgreich geändert. Bitte melden Sie sich an."

- **Given** ich lasse eines der Passwortfelder leer oder die Felder stimmen nicht überein,
  **When** ich auf „Passwort ändern" klicke,
  **Then** erscheint eine verständliche deutschsprachige Inline-Fehlermeldung direkt am entsprechenden Feld.

- **Given** ich rufe einen abgelaufenen oder bereits verwendeten Reset-Link auf,
  **When** die Seite geladen wird,
  **Then** sehe ich die Fehlermeldung „Dieser Link ist nicht mehr gültig. Bitte fordern Sie einen neuen Reset-Link an." mit einem Link zurück zu `/admin/passwort-vergessen`.

- **Given** ich gebe beim „Passwort vergessen?"-Formular eine unbekannte E-Mail ein,
  **When** das Formular abgeschickt wird,
  **Then** sehe ich dennoch die neutrale Meldung „Falls diese Adresse registriert ist, erhalten Sie eine E-Mail." (keine Preisgabe von Kontoexistenz).

**Hinweis:** Reset-Link-Basis-URL muss aus der Umgebungsvariable `NEXTAUTH_URL` (oder äquivalent) ausgelesen werden — kein Hardcoding. Implementierung mit NextAuth v5 und Resend.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-31: OAuth2-Login für Kunden (Google + GitHub)

**Als** Kunde
**möchte ich** mich alternativ mit meinem Google- oder GitHub-Konto anmelden können,
**damit** ich kein separates Passwort erstellen und merken muss.

**Akzeptanzkriterien:**

- **Given** ich rufe `/konto/login` auf,
  **When** die Seite geladen ist,
  **Then** sehe ich neben „E-Mail / Passwort" zwei zusätzliche Schaltflächen: „Mit Google anmelden" und „Mit GitHub anmelden".

- **Given** ich klicke auf „Mit Google anmelden",
  **When** ich den Google-OAuth2-Flow abschließe und Google meine Identität bestätigt,
  **Then** bin ich eingeloggt, werde zu `/konto` weitergeleitet und sehe meinen Vor- und Nachnamen (aus dem Google-Profil übernommen) in der Navigation.

- **Given** ich klicke auf „Mit GitHub anmelden",
  **When** ich den GitHub-OAuth2-Flow abschließe und GitHub meine Identität bestätigt,
  **Then** bin ich eingeloggt, werde zu `/konto` weitergeleitet und sehe meinen Anzeigenamen (aus dem GitHub-Profil übernommen) in der Navigation.

- **Given** ich melde mich zum ersten Mal per OAuth an,
  **When** mein Konto automatisch angelegt wird,
  **Then** enthält es Vorname und Nachname aus dem Provider-Profil; E-Mail-Verifizierung ist für OAuth-Konten nicht erforderlich.

- **Given** ich habe bereits ein E-Mail/Passwort-Konto mit derselben E-Mail-Adresse,
  **When** ich mich mit OAuth und dieser E-Mail-Adresse anmelde,
  **Then** wird mein bestehendes Konto erkannt, beide Methoden sind für dieselbe E-Mail verknüpft, und ich werde ohne Fehler eingeloggt.

- **Given** ich bin per OAuth eingeloggt,
  **When** ich mein Profil unter `/konto/profil` aufrufe,
  **Then** ist das Passwortfeld nicht sichtbar (OAuth-Konten haben kein lokales Passwort); alle anderen Profildaten können wie gewohnt bearbeitet werden.

- **Given** ich nutze E-Mail/Passwort,
  **When** ich die Login-Seite aufrufe,
  **Then** ist die bestehende E-Mail/Passwort-Anmeldung unverändert und funktioniert weiterhin.

- **Given** der OAuth-Anbieter einen Fehler zurückgibt oder ich den Flow abbreche,
  **When** ich zur Anwendung zurückgeleitet werde,
  **Then** erscheint eine verständliche deutschsprachige Fehlermeldung und ich befinde mich weiterhin auf `/konto/login`.

**Hinweis:** Provider-Konfiguration (Client-ID, Client-Secret) erfolgt über Umgebungsvariablen. Google und GitHub müssen als OAuth-Apps in den jeweiligen Developer-Konsolen registriert sein — Zugangsdaten liefert Tom. E-Mail/Passwort-Login bleibt vollständig erhalten (OAuth ist additiv).

**Priorität:** Must Have | **Story Points:** 5

---

#### US-32: Adressfeld in Buchungsformular

**Als** Kunde
**möchte ich** beim Ausfüllen einer Buchungsanfrage die Adresse des Auftragsorts angeben,
**damit** Tom direkt weiß, wo der Einsatz stattfindet, und Anfahrt sowie Aufwand vorab einschätzen kann.

**Akzeptanzkriterien:**

- **Given** ich befinde mich im Buchungsformular,
  **When** die Seite geladen ist,
  **Then** sehe ich drei neue Pflichtfelder: „Straße & Hausnummer", „PLZ" und „Ort", die klar als Pflichtfelder gekennzeichnet sind.

- **Given** ich lasse eines der drei Adressfelder leer und klicke auf „Absenden",
  **When** die Validierung ausgeführt wird,
  **Then** erscheint eine Inline-Fehlermeldung direkt am leeren Feld (z.B. „Bitte geben Sie die Straße an"), ohne dass die Seite neu geladen wird.

- **Given** ich gebe eine PLZ ein, die nicht aus 5 Ziffern besteht,
  **When** ich das PLZ-Feld verlasse,
  **Then** erscheint die Fehlermeldung „PLZ muss 5 Ziffern enthalten".

- **Given** ich habe alle Felder inklusive Adresse korrekt ausgefüllt und schicke das Formular ab,
  **When** die Buchungsanfrage verarbeitet wird,
  **Then** wird die vollständige Adresse (Straße, PLZ, Ort) in der Datenbank gespeichert und ist der Anfrage zugeordnet.

- **Given** Tom öffnet eine eingegangene Anfrage im Admin-Portal,
  **When** die Detailansicht geladen ist,
  **Then** ist die Auftragsadresse (Straße, PLZ, Ort) gut sichtbar als eigener Abschnitt dargestellt.

- **Given** Tom ruft die Buchungsübersicht oder die Terminliste im Admin-Bereich auf,
  **When** die Liste geladen ist,
  **Then** wird die Adresse (zumindest PLZ und Ort) als Kurzinfo pro Eintrag angezeigt.

- **Given** ich bin eingeloggter Kunde und rufe meine Auftragsdetails im Kundenportal auf,
  **When** die Detailseite geladen ist,
  **Then** ist die von mir angegebene Adresse sichtbar.

**Hinweis:** Adresse ist immer Pflicht — keine Gastbuchung ohne Adresse. Datenbankschema (`Booking`-Modell) muss um `street`, `zip` und `city` erweitert werden.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-33: Buchungsdauer auswählen (Multi-Stunden)

**Als** Kunde
**möchte ich** beim Buchen eine gewünschte Auftragsdauer wählen können,
**damit** Tom und ich von Anfang an das gleiche Zeitfenster einplanen und ein realistisches Angebot erstellt werden kann.

**Akzeptanzkriterien:**

- **Given** ich habe im Buchungsformular einen Startzeitpunkt gewählt,
  **When** der Durationsschritt angezeigt wird,
  **Then** sehe ich Kacheln mit den Optionen: 1 h, 2 h, 3 h, 4 h, 5 h, 6 h, 8 h und „Ganztag".

- **Given** die Dauer-Kacheln angezeigt werden,
  **When** eine Kachel dargestellt wird,
  **Then** enthält sie die Dauer (z.B. „3 h") und eine Preisschätzung (z.B. „ca. 105–210 €") basierend auf dem gewählten Service und dem Richtpreis aus US-20.

- **Given** ich klicke auf eine Dauer-Kachel,
  **When** die Auswahl gespeichert wird,
  **Then** ist die Kachel visuell hervorgehoben (aktiver Zustand) und die übrigen Kacheln sind deaktiviert.

- **Given** ich habe eine Dauer gewählt,
  **When** das System die Verfügbarkeit prüft,
  **Then** wird geprüft, ob das Verfügbarkeitsfenster (DayOverride oder Wochentag-Template) ausreichend Zeit ab der gewählten Startzeit hat; Kacheln, für die das Zeitfenster nicht ausreicht, sind ausgegraut und nicht wählbar.

- **Given** ich wähle einen Ganztag,
  **When** die Buchungsanfrage abgeschickt wird,
  **Then** wird der gesamte Verfügbarkeitszeitraum des Tages reserviert und andere Buchungen an diesem Tag sind nicht mehr möglich.

- **Given** die Buchungsanfrage erfolgreich abgeschickt wurde,
  **When** Tom die Anfrage im Admin-Portal öffnet,
  **Then** sieht er die gewählte Dauer als eigenes Feld (z.B. „Dauer: 3 Stunden") zusätzlich zu Start- und Endzeit.

- **Given** Tom die Terminliste im Admin-Dashboard aufruft,
  **When** die Liste geladen ist,
  **Then** ist die Dauer pro Eintrag sichtbar.

- **Given** ich lasse die Dauer-Auswahl leer und versuche, das Formular abzuschicken,
  **When** die Validierung ausgeführt wird,
  **Then** erscheint die Fehlermeldung „Bitte wählen Sie eine Auftragsdauer."

**Hinweis:** Preisschätzung ist ein Richtwert ohne rechtliche Bindung — ein Disclaimer muss sichtbar sein (analog US-20). Datenbankschema (`Booking`) um `durationMinutes` erweitern. Ganztag = gesamte Dauer des Verfügbarkeitsfensters des jeweiligen Tages. Endzeit = Startzeit + gewählte Dauer.

**Priorität:** Must Have | **Story Points:** 5

---

#### US-34: Buffer-Zeit zwischen Buchungen (Admin)

**Als** Admin (Tom)
**möchte ich** eine globale Buffer-Zeit nach jeder bestätigten Buchung konfigurieren können,
**damit** Fahrtzeiten und mögliche Pausen automatisch reserviert werden und kein Folgeauftrag zu knapp anschließt.

**Akzeptanzkriterien:**

- **Given** ich bin eingeloggt im Admin-Bereich und öffne die Einstellungen,
  **When** die Einstellungsseite geladen ist,
  **Then** sehe ich einen Konfigurationsbereich „Buffer-Zeit nach Buchungen" mit einer Auswahl: 0 min, 15 min, 30 min, 45 min, 60 min.

- **Given** ich wähle eine Buffer-Zeit und speichere,
  **When** die Einstellung gespeichert wird,
  **Then** erscheint die Bestätigungsmeldung „Einstellung gespeichert" und der neue Wert ist dauerhaft aktiv.

- **Given** eine Buchung ist bestätigt (Status CONFIRMED) und die Buffer-Zeit beträgt 30 Minuten,
  **When** die API `GET /api/slots/available` aufgerufen wird,
  **Then** werden die 30 Minuten direkt nach dem Endzeitpunkt der bestätigten Buchung als nicht buchbar markiert und nicht als verfügbarer Slot zurückgegeben.

- **Given** eine bestätigte Buchung endet um 14:00 Uhr und die Buffer-Zeit ist 30 Minuten,
  **When** ein Kunde die Buchungsseite aufruft,
  **Then** sind Zeitslots zwischen 14:00 und 14:30 nicht verfügbar; ab 14:30 sind Slots (sofern im Verfügbarkeitsfenster) wieder buchbar.

- **Given** ich rufe die Admin-Kalenderansicht auf,
  **When** eine bestätigte Buchung mit Buffer angezeigt wird,
  **Then** ist der Buffer-Zeitraum als grauer Block direkt anschließend an die Buchung dargestellt — visuell klar von der eigentlichen Buchung (farbig) unterschieden.

- **Given** kein Admin-Wert gesetzt wurde (Erstinstallation / Reset),
  **When** das System Slots berechnet,
  **Then** gilt ein Default-Wert von 30 Minuten.

- **Given** ich stelle die Buffer-Zeit auf 0 Minuten und speichere,
  **When** die Slot-Berechnung ausgeführt wird,
  **Then** werden keine Buffer-Blöcke reserviert und Folgebuchungen können direkt im Anschluss an bestehende Buchungen beginnen.

**Hinweis:** Buffer gilt nur nach bestätigten Buchungen (CONFIRMED), nicht nach offenen (PENDING) oder abgelehnten/stornierten Buchungen. Default-Wert 30 Minuten muss in der Datenbank oder Konfiguration hinterlegt sein. Buffer-Logik muss zentral in der Slot-Berechnung implementiert werden.

**Priorität:** Must Have | **Story Points:** 5

---

### Backlog (nach MVP)

---

#### US-09: Instagram-Feed einbinden

**Als** Besucher  
**möchte ich** aktuelle Beiträge von Bärenstark auf Instagram sehen,  
**damit** ich einen lebendigen Eindruck der Arbeit bekomme.

**Akzeptanzkriterien:**

- **Given** ich befinde mich auf der Startseite,  
  **When** ich nach unten scrolle,  
  **Then** sehe ich die letzten 3–6 Instagram-Beiträge als Vorschaubilder mit Link zum Profil.

**Priorität:** Should Have

---

#### US-10: Kundenbewertungen anzeigen

**Als** Besucher  
**möchte ich** Erfahrungsberichte anderer Kunden lesen,  
**damit** ich Vertrauen in Bärenstark gewinne, bevor ich buche.

**Akzeptanzkriterien:**

- **Given** ich befinde mich auf der Startseite oder einer dedizierten Unterseite,  
  **When** ich die Bewertungssektion erreiche,  
  **Then** sehe ich mindestens drei Erfahrungsberichte mit Name, Service und Sternebewertung.

**Priorität:** Should Have

---

#### US-11: Bestätigungs-E-Mail an Kunden

**Als** Kunde  
**möchte ich** nach einer Buchungsanfrage eine automatische Bestätigungs-E-Mail erhalten,  
**damit** ich sicher bin, dass meine Anfrage angekommen ist.

**Akzeptanzkriterien:**

- **Given** ich habe eine Buchungsanfrage mit E-Mail-Adresse abgeschickt,  
  **When** das Formular erfolgreich verarbeitet wurde,  
  **Then** erhalte ich eine E-Mail mit einer Zusammenfassung meiner Anfrage und dem Hinweis, dass Tom sich meldet.

**Priorität:** Should Have

---

#### US-12: Impressum und Datenschutz

**Als** Besucher  
**möchte ich** Impressum und Datenschutzerklärung einsehen können,  
**damit** ich weiß, wer hinter der Website steht, und die Website rechtlich konform ist.

**Akzeptanzkriterien:**

- **Given** ich befinde mich auf einer beliebigen Seite,  
  **When** ich im Footer auf „Impressum" oder „Datenschutz" klicke,  
  **Then** öffnet sich die jeweilige Unterseite mit den erforderlichen gesetzlichen Angaben.

**Priorität:** Must Have (rechtlich erforderlich — wird als eigene Aufgabe behandelt, kein technischer Aufwand im MVP-Sprint)

---

## Priorisierungsübersicht

| Story      | Titel                                         | Priorität    | Iteration                            |
|------------|-----------------------------------------------|--------------|--------------------------------------|
| US-01      | Service-Portfolio einsehen                    | Must Have    | Iteration 1 (abgeschlossen)          |
| US-02      | Kontaktinformationen finden                   | Must Have    | Iteration 1 (abgeschlossen)          |
| US-03      | Verfügbare Zeitfenster anzeigen               | Must Have    | Iteration 1 (abgeschlossen)          |
| US-04      | Buchungsanfrage stellen                       | Must Have    | Iteration 1 (abgeschlossen)          |
| US-05      | Zeitfenster einpflegen (Admin)                | Must Have    | Iteration 1 (abgeschlossen)          |
| US-06      | Buchungsanfragen verwalten (Admin)            | Must Have    | Iteration 1 (abgeschlossen)          |
| US-07      | Admin-Login                                   | Must Have    | Iteration 1 (abgeschlossen)          |
| US-08      | E-Mail-Benachrichtigung bei neuer Anfrage     | Must Have    | Iteration 1 (abgeschlossen)          |
| US-12      | Impressum & Datenschutz                       | Must Have    | Iteration 1 (abgeschlossen, Content) |
| BUG US-04  | Buchungsanfrage absenden schlägt fehl         | Blocker      | Iteration 2 (abgeschlossen)          |
| US-13      | Alternativtermin vorschlagen (Admin)          | Must Have    | Iteration 2 (abgeschlossen)          |
| US-14      | Anfrage stornieren (Kunde)                    | Must Have    | Iteration 2 (abgeschlossen)          |
| US-15      | Wochentag-basierte Verfügbarkeit (Admin)      | Must Have    | Iteration 2 (abgeschlossen)          |
| US-16      | Kalenderansicht für Kunden                    | Must Have    | Iteration 2 (abgeschlossen)          |
| BUG IT3    | Buchungsformular-Übermittlung                 | Blocker      | Iteration 3 (abgeschlossen)          |
| US-17      | Zeitfenster-Redesign (Von/Bis + Default)      | Must Have    | Iteration 3 (abgeschlossen)          |
| US-18      | Datei-Upload im Buchungsformular              | Must Have    | Iteration 3 (abgeschlossen)          |
| US-19      | Individuelle Serviceanfrage                   | Must Have    | Iteration 3 (abgeschlossen)          |
| US-20      | Preise für Serviceleistungen                  | Must Have    | Iteration 3 (abgeschlossen)          |
| US-21      | Admin-Dashboard Terminübersicht               | Must Have    | Iteration 3 (abgeschlossen)          |
| US-22      | Feedback-Sektion mit Bewertungen              | Must Have    | Iteration 3 (abgeschlossen)          |
| US-23      | Service-Popups Vorher/Nachher                 | Must Have    | Iteration 3 (abgeschlossen)          |
| US-24      | Bestätigungs- und Storno-E-Mail               | Must Have    | Iteration 3 (abgeschlossen)          |
| US-25      | Kundenportal Registrierung/Login              | Must Have    | Iteration 4 (abgeschlossen)          |
| US-26      | Kundenportal Auftragsübersicht                | Must Have    | Iteration 4 (abgeschlossen)          |
| US-27      | Kundenportal Stornierung                      | Must Have    | Iteration 4 (abgeschlossen)          |
| US-28      | Zahlungsabwicklung PayPal / Apple Pay         | Must Have    | Iteration 4 (abgeschlossen)          |
| US-29      | Kundenportal Feedback/Bewertung               | Must Have    | Iteration 4 (abgeschlossen)          |
| US-30      | Admin-Passwort-Reset verbessern (UX-Fix)      | Must Have    | Iteration 5 (aktuell)                |
| US-31      | OAuth2-Login für Kunden (Google + GitHub)     | Must Have    | Iteration 5 (aktuell)                |
| US-32      | Adressfeld in Buchungsformular                | Must Have    | Iteration 5 (aktuell)                |
| US-33      | Buchungsdauer auswählen (Multi-Stunden)       | Must Have    | Iteration 5 (aktuell)                |
| US-34      | Buffer-Zeit zwischen Buchungen (Admin)        | Must Have    | Iteration 5 (aktuell)                |
| US-09      | Instagram-Feed einbinden                      | Should Have  | Backlog                              |
| US-10      | Kundenbewertungen anzeigen                    | Should Have  | Ersetzt durch US-22                  |
| US-11      | Bestätigungs-E-Mail an Kunden                 | Should Have  | Ersetzt durch US-24                  |

---

## Annahmen

- Das Admin-Interface ist eine einfache, passwortgeschützte Web-Oberfläche (keine nativen Apps).
- Die Buchungsanfrage erfordert keine sofortige automatische Bestätigung — Tom prüft und antwortet manuell.
- Zahlungsabwicklung ist nicht Teil von Iteration 3 — folgt in Iteration 4 (US-28).
- Das Impressum wird inhaltlich von Tom geliefert; technisch ist es eine statische Unterseite.
- Instagram-Verlinkung im Footer ist MVP; ein eingebetteter Feed (US-09) bleibt im Backlog.
- Zeitfenster-Schritte für Kundenbuchung: 30 Minuten (Annahme — Tom bestätigen).
- Maximale Dateianzahl pro Buchungsanfrage: 5 Dateien, max. 20 MB pro Datei, 50 MB gesamt (Annahme).
- Preise in US-20 sind Richtwerte — Tom gibt finale Werte vor Go-Live frei.
- Bewertungsmoderation (US-29, Iteration 4): Tom gibt Bewertungen manuell frei, bevor sie auf der Startseite erscheinen. Entschieden.
- Stornierungsfrist im Kundenportal (US-27): 24 Stunden vor dem Termin. Entschieden.
- Zahlungsauslöser (US-28): Betrag wird manuell von Tom nach Terminbestätigung hinterlegt — E-Mail-Aufforderung an Kunden wird beim Speichern des Betrags ausgelöst. Automatische Preisberechnung ist Backlog.
- Zahlungs-Stack (US-28): Stripe wird eingesetzt — unterstützt PayPal, Apple Pay und Google Pay über eine einzige Integration. Entschieden.
- Kunden-Auth (US-25): Separate `CustomerUser`-Entität, vollständig getrennt vom Admin-`User`. Entschieden.
- OAuth2-Provider (US-31): Google und GitHub. Client-IDs und Client-Secrets liefert Tom. E-Mail/Passwort-Login bleibt parallel erhalten. OAuth ist additiv.
- Buchungsdauer (US-33): Verfügbare Optionen 1 h, 2 h, 3 h, 4 h, 5 h, 6 h, 8 h und Ganztag. Preisschätzung basiert auf Richtpreisen aus US-20 — kein rechtsverbindlicher Preis.
- Buffer-Zeit (US-34): Default 30 Minuten. Gilt nur nach bestätigten Buchungen (CONFIRMED). Konfiguration global (ein Wert für alle Buchungen).
- Adressfelder (US-32): Straße + Hausnummer, PLZ (5-stellig, Deutschland), Ort — alle Pflichtfelder, keine optionale Adresse.
