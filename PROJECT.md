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
| US-34      | Buffer-Zeit zwischen Buchungen (Admin)        | Must Have    | Iteration 5 (abgeschlossen)          |
| US-IT6-01  | Weitere Admins anlegen                        | Must Have    | Iteration 6                          |
| US-IT6-02  | Kalender-UX Outlook/Google-Style              | Must Have    | Iteration 6                          |
| US-IT6-03  | Kundenbewertungen nach Abschluss + Freigabe   | Must Have    | Iteration 6                          |
| US-IT6-04  | SEO-Optimierung                               | Must Have    | Iteration 6                          |
| US-IT6-05  | Auth-Bereinigung Google + Facebook only       | Must Have    | Iteration 6                          |
| US-IT6-06  | Alle User-Accounts löschen (DB-Reset)         | Must Have    | Iteration 6                          |
| US-IT6-07  | Nutzerverwaltung Admin mit Kommentar + Rating | Must Have    | Iteration 6                          |
| US-IT6-08  | Finaler Preis pro Buchung (EUR-Betrag)        | Must Have    | Iteration 6                          |
| US-IT6-09  | Analytics-Seite in Admin-Konsole              | Must Have    | Iteration 6                          |
| US-IT7-04  | Admin-Bootstrap-Reset (BLOCKER)               | Must Have    | Iteration 7                          |
| US-IT7-01  | Email/Password-Auth wiederherstellen          | Must Have    | Iteration 7 (Reversion US-IT6-05)   |
| US-IT7-02  | Google OAuth reparieren                       | Must Have    | Iteration 7                          |
| US-IT7-03  | Facebook OAuth reparieren                     | Must Have    | Iteration 7                          |
| US-IT7-05  | Passwort-Reset-Flow E2E (Kunden)              | Must Have    | Iteration 7                          |
| US-09      | Instagram-Feed einbinden                      | Should Have  | Backlog                              |
| US-10      | Kundenbewertungen anzeigen                    | Should Have  | Ersetzt durch US-22                  |
| US-11      | Bestätigungs-E-Mail an Kunden                 | Should Have  | Ersetzt durch US-24                  |

---

## Iteration 6 — Admin-Reife, Auth-Bereinigung & Wachstums-Features

### Vision (aktualisiert)

Bärenstark Hausservice verfügt ab Iteration 6 über eine produktionsreife Verwaltungsplattform: mehrere Admins können unabhängig arbeiten, die Kalender-UX entspricht etablierten Tools wie Google Calendar, echte Kundenbewertungen fließen nach Moderationsfreigabe auf die Website, und die SEO-Basis sichert organische Sichtbarkeit in Darmstadt. Intern bekommt Tom volle Transparenz über Kunden (inkl. Admin-Notizen und internem Rating), Buchungspreise und Umsatzentwicklung — alles in einer Konsole.

---

#### US-IT6-01: Weitere Admins anlegen

**Als** Admin (Tom)
**möchte ich** neue Admin-Konten anlegen, bestehende Admins deaktivieren und löschen können,
**damit** ich z.B. eine Unterstützungskraft Zugang zur Admin-Konsole geben kann, ohne ihr mein eigenes Passwort weiterzugeben.

**Akzeptanzkriterien:**

- **Given** ich bin als Admin eingeloggt und öffne „Admin-Verwaltung",
  **When** die Seite geladen ist,
  **Then** sehe ich eine Liste aller Admin-Accounts mit Name, E-Mail und Status (aktiv/inaktiv).

- **Given** ich klicke auf „Neuen Admin anlegen" und fülle Name, E-Mail und initiales Passwort aus,
  **When** ich auf „Speichern" klicke,
  **Then** wird der neue Admin-Account angelegt und erscheint sofort in der Liste.

- **Given** ich versuche, alle vorhandenen Admin-Accounts zu löschen,
  **When** nur noch ein Admin-Account existiert,
  **Then** ist der Löschen-Button für diesen letzten Account deaktiviert mit dem Hinweis: „Mindestens ein Admin muss immer vorhanden sein."

- **Given** ich deaktiviere einen Admin-Account (statt ihn zu löschen),
  **When** der betroffene Admin beim nächsten Login versucht sich einzuloggen,
  **Then** erhält er die Meldung „Ihr Konto wurde deaktiviert. Bitte wenden Sie sich an Tom Siefert." und der Zugang wird verweigert.

- **Given** ein deaktivierter Admin versucht über eine direkte URL auf eine Admin-Seite zuzugreifen,
  **When** die Middleware die Session prüft,
  **Then** wird er zur Login-Seite umgeleitet.

- **Given** ich editiere einen bestehenden Admin (Name oder E-Mail),
  **When** ich speichere,
  **Then** werden die Änderungen sofort in der Liste sichtbar.

**Hinweis:** Passwort-Reset für andere Admins ist out-of-scope für IT6 (Tom kann Passwort des Fremd-Admins beim Anlegen setzen). Der angemeldete Admin kann sich nicht selbst löschen oder deaktivieren, um Lock-out zu verhindern.

**Priorität:** Must Have | **Story Points:** 5

---

#### US-IT6-02: Kalender-UX — Outlook/Google-Calendar-Style für Admin und Kunde

**Als** Admin (Tom) und als Kunde
**möchte ich** Zeitfenster in einer intuitiven, drag-and-drop-fähigen Kalenderansicht sehen und verwalten — vergleichbar mit Google Calendar oder Microsoft Outlook —,
**damit** ich Termine auf einen Blick erkenne, direkt im Kalender neue Slots anlege und die Buchungsauswahl für Kunden deutlich komfortabler wird.

**Akzeptanzkriterien:**

**Admin-Kalender:**

- **Given** ich öffne den Admin-Bereich „Kalender / Verfügbarkeit",
  **When** die Seite geladen ist,
  **Then** sehe ich eine Wochen- oder Tagesansicht mit einem Zeitraster (Stunden-Spalten), analog zu Google Calendar.

- **Given** ich befinde mich in der Kalenderansicht,
  **When** ich auf einen freien Zeitblock klicke oder per Drag-and-drop einen Bereich markiere,
  **Then** öffnet sich ein Formular zur Erstellung eines neuen Verfügbarkeitsfensters mit vorausgefülltem Datum und Uhrzeit.

- **Given** bestätigte Buchungen existieren,
  **When** ich die Kalenderansicht lade,
  **Then** sind bestätigte Buchungen als farbige Blöcke (z.B. Grün = bestätigt, Blau = offen/pending, Grau = Buffer) im Kalender sichtbar.

- **Given** ich klicke auf einen Buchungsblock im Kalender,
  **When** der Klick verarbeitet ist,
  **Then** öffnet sich eine Detail-Popover/Sidebar mit Kundenname, Service, Dauer und einem Link zur vollständigen Buchungsdetailseite.

- **Given** ich wechsle zwischen Wochen- und Monatsansicht,
  **When** ich auf den entsprechenden Toggle klicke,
  **Then** wird die Ansicht sofort umgeschaltet, ohne Seitenneuladen.

**Kunden-Kalender:**

- **Given** ich rufe die Buchungsseite auf,
  **When** der Kalender geladen ist,
  **Then** sehe ich eine Monatsansicht (analog zu Google Calendar) mit farblich markierten Tagen: verfügbar (grün), nicht verfügbar (grau/rot), heute (blau umrandet).

- **Given** ich klicke auf einen verfügbaren Tag,
  **When** der Tag ausgewählt ist,
  **Then** erscheinen darunter (oder in einem Panel) die buchbaren Zeitslots als klickbare Chips in 30-Minuten-Schritten — analog zur Zeitauswahl in Google Calendar / Calendly.

- **Given** ich wähle einen Zeitslot,
  **When** der Slot ausgewählt ist,
  **Then** ist er visuell hervorgehoben und das Buchungsformular wird mit Datum und Uhrzeit vorausgefüllt.

- **Given** ich nutze ein Smartphone,
  **When** ich den Kalender bediene,
  **Then** sind alle Interaktionen (Tippen, Swipe zwischen Monaten) vollständig touch-optimiert ohne horizontales Scrollen.

**Hinweis:** Empfohlene Bibliothek für Admin-Ansicht: `react-big-calendar` oder `@fullcalendar/react` (beide MIT-lizenziert). Kunden-Ansicht kann leichtgewichtigere Custom-Komponente oder `react-day-picker` verwenden. Drag-and-drop für Admin-Slots ist Must Have; Drag-and-drop zum Verschieben bestätigter Buchungen ist Could Have (nicht in IT6). Ersetzt/erweitert die bisherigen Kalender-Implementierungen aus US-15, US-16, US-17 — diese bleiben als Datenbasis erhalten.

**Priorität:** Must Have | **Story Points:** 8

---

#### US-IT6-03: Kundenbewertungen nach Abschluss mit Admin-Freigabe (Verbesserung)

**Als** Kunde mit einem abgeschlossenen Auftrag (Status `COMPLETED`)
**möchte ich** eine Bewertung (1–5 Sterne + optionaler Text) abgeben können,
**damit** andere Interessenten von meiner Erfahrung profitieren — und Tom weiß, dass die Bewertungsmöglichkeit erst nach echtem Abschluss erscheint.

**Hinweis zum Scope:** US-29 (Iteration 4) hat die Grundstruktur bereits implementiert. US-IT6-03 ergänzt / korrigiert folgende Punkte explizit: (a) Sicherstellung, dass der Trigger ausschließlich auf Status `COMPLETED` basiert (nicht auf `CONFIRMED`), (b) Verbesserung der Admin-Moderations-UI, (c) Sicherstellung, dass Bewertungen nie über öffentliche APIs ohne Freigabe abrufbar sind.

**Akzeptanzkriterien:**

- **Given** mein Auftrag hat den Status `COMPLETED` (explizit durch Admin gesetzt),
  **When** ich meine Auftragsdetails im Kundenportal öffne,
  **Then** sehe ich den Button „Jetzt bewerten" — und zwar ausschließlich bei diesem Status.

- **Given** mein Auftrag hat einen anderen Status (PENDING, CONFIRMED, REJECTED, CANCELLED),
  **When** ich die Auftragsdetails öffne,
  **Then** ist kein Bewertungs-Button sichtbar.

- **Given** ich schicke eine Bewertung ab,
  **When** sie gespeichert wurde,
  **Then** hat sie den internen Status `PENDING_APPROVAL` und ist für keinen Endkunden sichtbar.

- **Given** Tom öffnet die Bewertungsverwaltung im Admin-Bereich,
  **When** eine neue Bewertung vorliegt (Status `PENDING_APPROVAL`),
  **Then** sieht er Kundenname, Buchungsdatum, Service, Sternezahl und Text und kann „Freigeben" oder „Ablehnen" klicken.

- **Given** Tom gibt eine Bewertung frei (Status `APPROVED`),
  **When** die öffentliche Bewertungssektion auf der Startseite geladen wird,
  **Then** erscheint die Bewertung dort.

- **Given** die öffentliche API `GET /api/reviews` aufgerufen wird,
  **When** der Request verarbeitet wird,
  **Then** werden ausschließlich Bewertungen mit Status `APPROVED` zurückgegeben — Bewertungen mit `PENDING_APPROVAL` oder `REJECTED` sind in keiner öffentlichen API-Response enthalten.

- **Given** ich habe für einen Auftrag bereits eine Bewertung abgegeben,
  **When** ich den Auftrag erneut öffne,
  **Then** ist der Bewertungs-Button nicht mehr vorhanden und meine bestehende Bewertung ist schreibgeschützt sichtbar.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT6-04: SEO-Optimierung der gesamten Website

**Als** Besucher (und als Google-Crawler)
**möchte ich** eine technisch sauber optimierte Website vorfinden,
**damit** Bärenstark Hausservice bei lokalen Suchanfragen in Darmstadt und Umgebung gut auffindbar ist.

**Akzeptanzkriterien:**

- **Given** ich rufe eine beliebige öffentliche Seite auf,
  **When** ich den Quelltext prüfe,
  **Then** enthält jede Seite ein eindeutiges `<title>`-Tag (max. 60 Zeichen) und eine `<meta name="description">` (max. 160 Zeichen) mit relevantem Keyword-Bezug.

- **Given** ich teile die Startseite oder eine Unterseite auf WhatsApp, LinkedIn oder Facebook,
  **When** der Link gepostet wird,
  **Then** werden korrekte Open-Graph-Tags angezeigt (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`).

- **Given** ein Google-Crawler ruft die Website auf,
  **When** er `https://<domain>/sitemap.xml` aufruft,
  **Then** gibt die Datei eine gültige XML-Sitemap zurück, die alle öffentlichen Seiten (Startseite, Services, Buchung, Impressum, Datenschutz) mit `<loc>` und `<lastmod>` enthält.

- **Given** ein Crawler ruft `https://<domain>/robots.txt` auf,
  **When** die Datei geliefert wird,
  **Then** erlaubt sie das Crawlen öffentlicher Seiten und sperrt Admin-Routen (`/admin/*`) und API-Routen (`/api/*`).

- **Given** die öffentlichen Seiten gerendert werden,
  **When** ich den HTML-Output mit einem Accessibility/SEO-Linter prüfe,
  **Then** enthalten alle Seiten semantische HTML5-Elemente (`<header>`, `<main>`, `<footer>`, `<nav>`, `<article>`, `<section>`) anstelle von reinen `<div>`-Containern.

- **Given** ich prüfe die Startseite mit Google Rich Results Test oder schema.org Validator,
  **When** der Test durchgeführt wird,
  **Then** ist ein valides `LocalBusiness`-Structured-Data-JSON-LD-Block vorhanden mit: `name`, `address` (Darmstadt), `telephone`, `url`, `openingHours` (Platzhalter, von Tom zu bestätigen).

- **Given** ich messe die Core Web Vitals der Startseite (z.B. mit Lighthouse),
  **When** der Test auf Desktop ausgeführt wird,
  **Then** erzielt die Seite einen Performance-Score von mindestens 80/100 (Lighthouse).

**Hinweis:** `sitemap.xml` und `robots.txt` werden als Next.js Route Handler implementiert. Structured Data wird als `<script type="application/ld+json">` in das `<head>`-Element der betroffenen Seiten injiziert. Lighthouse-Score 80+ ist Richtwert — Bildoptimierung (WebP, next/image) ist Voraussetzung. `openingHours` und exakte Geschäftszeiten: Tom muss Werte liefern (Platzhalter: Mo–Fr 07:00–18:00).

**Priorität:** Must Have | **Story Points:** 5

---

#### US-IT6-05: Auth-Bereinigung — nur Google und Facebook OAuth

**Als** Admin (Tom)
**möchte ich**, dass sich Kunden ausschließlich über Google OAuth oder Facebook OAuth registrieren und einloggen können — E-Mail/Passwort und alle anderen Provider werden entfernt —,
**damit** die Anmeldestrecke übersichtlich und wartungsarm ist und der bekannte Google-OAuth-Fehler „Bad request" behoben wird.

**Akzeptanzkriterien:**

- **Given** ich rufe `/konto/login` auf,
  **When** die Seite geladen ist,
  **Then** sehe ich ausschließlich zwei Schaltflächen: „Mit Google anmelden" und „Mit Facebook anmelden". Das E-Mail/Passwort-Formular, der GitHub-Button und alle anderen Provider-Buttons sind vollständig entfernt.

- **Given** ein Kunde klickt auf „Mit Google anmelden",
  **When** er den Google-OAuth-Flow abschließt,
  **Then** ist er erfolgreich eingeloggt und wird zu `/konto` weitergeleitet — ohne „Bad request"-Fehler.

- **Given** ein Kunde klickt auf „Mit Facebook anmelden",
  **When** er den Facebook-OAuth-Flow abschließt,
  **Then** ist er erfolgreich eingeloggt und wird zu `/konto` weitergeleitet.

- **Given** ein Kunde bricht den OAuth-Flow ab oder der Provider gibt einen Fehler zurück,
  **When** er zur Anwendung zurückgeleitet wird,
  **Then** erscheint eine deutschsprachige Fehlermeldung auf `/konto/login`.

- **Given** die Routen `/konto/registrieren` (E-Mail/Passwort-Formular) und `/api/auth/register` existierten bisher,
  **When** IT6 deployed wird,
  **Then** sind diese Routen deaktiviert oder geben HTTP 404 zurück — bestehende Passwort-Hashes in der DB bleiben vorerst erhalten, werden aber nicht mehr genutzt.

- **Given** bestehende Kunden-Accounts, die sich per E-Mail/Passwort registriert haben,
  **When** sie versuchen, sich nach IT6 einzuloggen,
  **Then** erscheint der Hinweis: „Die E-Mail/Passwort-Anmeldung ist nicht mehr verfügbar. Bitte melden Sie sich mit Google oder Facebook an." (falls ihre E-Mail bei einem der Provider existiert, erfolgt Account-Verknüpfung automatisch).

- **Given** der GitHub-Provider war bisher konfiguriert (US-31),
  **When** IT6 deployed wird,
  **Then** ist der GitHub-OAuth-Provider vollständig aus der NextAuth-Konfiguration entfernt.

- **Given** ich prüfe die NextAuth-Provider-Konfiguration (`customer-oauth.ts` oder äquivalent),
  **When** ich die Datei lese,
  **Then** sind nur `GoogleProvider` und `FacebookProvider` konfiguriert — kein `GitHubProvider`, kein `CredentialsProvider`.

**Hinweis:** Der Google-OAuth-Fehler „Bad request" ist mit hoher Wahrscheinlichkeit auf eine falsch konfigurierte Redirect-URI in der Google Cloud Console zurückzuführen (localhost vs. Produktions-Domain) oder auf einen fehlenden `NEXTAUTH_URL`-Wert in der Produktionsumgebung. Der Architekt muss die OAuth-App-Konfigurationen in Google Cloud Console und Meta Developer Portal prüfen und die `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` als Env-Variablen sicherstellen. Facebook OAuth erfordert eine verifizierte App-Domain (kein localhost in Produktion).

**Priorität:** Must Have | **Story Points:** 5

---

#### US-IT6-06: Alle User-Accounts löschen (Datenbank-Reset für Neustart)

**Als** Admin (Tom)
**möchte ich**, dass alle bestehenden Kunden-Registrierungen und Admin-Accounts aus der Datenbank gelöscht werden,
**damit** ich mit einem sauberen Stand neu starten und mich als erster Admin frisch registrieren kann.

**Akzeptanzkriterien:**

- **Given** das Migrations-Skript wurde ausgeführt,
  **When** ich die Datenbank prüfe,
  **Then** enthält die Tabelle `CustomerUser` keine Einträge mehr.

- **Given** das Migrations-Skript wurde ausgeführt,
  **When** ich die Datenbank prüfe,
  **Then** enthält die Tabelle `User` (Admin) keine Einträge mehr.

- **Given** Tom nach dem Reset die URL `/admin/login` aufruft und Zugangsdaten eingibt,
  **When** er sich erfolgreich authentifiziert,
  **Then** ist er als einziger Admin eingeloggt.

- **Given** Buchungen mit `COMPLETED`- oder `CONFIRMED`-Status existieren, die einem gelöschten `CustomerUser` zugeordnet waren,
  **When** das Skript ausgeführt wird,
  **Then** werden diese Buchungen **anonymisiert** (d.h. `customerId` auf `NULL` gesetzt, Kundenname/E-Mail bleiben als statische Strings erhalten) — sie werden nicht hart gelöscht, damit Buchungshistorie und Finanzdaten erhalten bleiben.

- **Given** Buchungen mit Status `PENDING` oder `COUNTER_PROPOSED` existieren, die einem gelöschten Kunden zugeordnet waren,
  **When** das Skript ausgeführt wird,
  **Then** werden diese Buchungen auf `CANCELLED` gesetzt und `customerId` auf `NULL` — da sie kein aktives Geschäft darstellen.

- **Given** das Skript erfolgreich durchgelaufen ist,
  **When** eine Zusammenfassung ausgegeben wird,
  **Then** enthält sie: Anzahl gelöschter `CustomerUser`-Einträge, Anzahl gelöschter `User`-Einträge, Anzahl anonymisierter Buchungen, Anzahl stornierter Buchungen.

**Hinweis:** Dieses Skript ist ein einmaliger Migrations-Run — kein dauerhafter Feature-Toggle. Implementierung als `scripts/reset-users.ts` (ts-node). Vor Ausführung: Datenbank-Backup empfohlen. DSGVO-Konformität: Hartes Löschen von Personendaten ist zulässig auf expliziten Betreiberauftrag (Tom ist der Verantwortliche). Die Anonymisierung abgeschlossener Buchungen stellt sicher, dass Buchhaltungs- und Umsatzdaten nicht verloren gehen.

**Priorität:** Must Have | **Story Points:** 2

---

#### US-IT6-07: Admin-Nutzerverwaltung mit Kommentarfeld und internem Rating

**Als** Admin (Tom)
**möchte ich** in der Admin-Konsole alle registrierten Kunden einsehen, editieren, löschen sowie interne Notizen und eine interne Sternebewertung pro Kunde hinterlegen können,
**damit** ich gute und schlechte Kunden unterscheiden und relevante Hinweise festhalten kann — ohne dass diese Informationen jemals für den Kunden sichtbar sind.

**Akzeptanzkriterien:**

- **Given** ich öffne den Admin-Bereich „Nutzerverwaltung",
  **When** die Seite geladen ist,
  **Then** sehe ich eine tabellarische Liste aller `CustomerUser`-Einträge mit: Name, E-Mail, Registrierungsdatum, Anzahl Buchungen und internem Admin-Rating (Sterne-Icon, 1–5).

- **Given** ich klicke auf einen Kunden,
  **When** die Detailansicht öffnet,
  **Then** sehe ich alle Profilfelder (Name, E-Mail, Telefon, Adresse) und zusätzlich zwei admin-exklusive Felder: „Internes Kommentarfeld" (Freitext, max. 1000 Zeichen) und „Interne Bewertung" (1–5 Sterne, klickbare Sterne-Icons).

- **Given** ich speichere eine interne Notiz oder ein Admin-Rating für einen Kunden,
  **When** das Speichern abgeschlossen ist,
  **Then** erscheint die Bestätigung „Gespeichert" und die Werte sind beim nächsten Öffnen des Kundenprofils noch vorhanden.

- **Given** ein Kunde ruft sein eigenes Profil unter `/konto/profil` auf,
  **When** die Seite geladen ist,
  **Then** sind weder das Admin-Kommentarfeld noch das interne Admin-Rating sichtbar oder in der HTTP-Response enthalten.

- **Given** die API `GET /api/customer/profile` oder eine äquivalente öffentliche Kunden-API aufgerufen wird,
  **When** die Response zurückgegeben wird,
  **Then** enthalten die JSON-Daten kein `adminNote`-Feld und kein `adminRating`-Feld.

- **Given** ich lösche einen Kunden-Account aus der Nutzerverwaltung,
  **When** der Lösch-Dialog bestätigt wird,
  **Then** wird der `CustomerUser`-Eintrag hart gelöscht; verknüpfte Buchungen werden anonymisiert (analog US-IT6-06: `customerId` = NULL, Buchungsdaten bleiben erhalten).

- **Given** ich editiere Profildaten eines Kunden (z.B. Namenskorrektur, Telefonnummer),
  **When** ich speichere,
  **Then** werden die Änderungen sofort in der Nutzerliste und im Kundenprofil sichtbar.

- **Given** ich suche in der Nutzerliste per Freitextsuche (Name oder E-Mail),
  **When** ich mindestens 2 Zeichen eingebe,
  **Then** wird die Liste auf passende Einträge gefiltert (case-insensitive, Debounce 300 ms).

**Hinweis:** `adminNote` und `adminRating` werden als neue Felder im `CustomerUser`-Prisma-Modell ergänzt. Diese Felder dürfen in keinem Kunden-facing API-Endpunkt (`/api/customer/*`, `/api/auth/*`) serialisiert werden — Prisma-Select muss diese Felder explizit ausschließen. Das interne Admin-Rating hat nichts mit den öffentlichen Kundenbewertungen (US-IT6-03 / US-29) zu tun.

**Priorität:** Must Have | **Story Points:** 5

---

#### US-IT6-08: Finaler Preis pro Buchung (EUR-Betrag vermerken)

**Als** Admin (Tom)
**möchte ich** bei jeder Buchung einen finalen Euro-Betrag (`final_price_eur`) hinterlegen können,
**damit** ich meine Einnahmen pro Auftrag direkt in der Buchungsübersicht im Blick habe und für die Analytics-Auswertung (US-IT6-09) eine Datenbasis habe.

**Hinweis zum Scope:** US-28 (Iteration 4) hat bereits ein Preisfeld für die Stripe-Zahlungsaufforderung eingeführt. US-IT6-08 ergänzt ein separates `final_price_eur`-Feld, das unabhängig vom Stripe-Payment-Betrag befüllt werden kann — z.B. für Barzahlung, nachträgliche Korrekturen oder Aufträge ohne Online-Zahlung.

**Akzeptanzkriterien:**

- **Given** ich öffne die Detailansicht einer Buchung im Admin-Portal,
  **When** die Seite geladen ist,
  **Then** sehe ich das editierbare Feld „Finaler Preis (EUR)" mit dem Wert in Euro (leer = noch nicht gesetzt, Platzhalter: „0,00 €").

- **Given** ich gebe einen Betrag ein (z.B. „185,00") und speichere,
  **When** das Speichern abgeschlossen ist,
  **Then** erscheint „Gespeichert" und der Betrag ist in der Buchungsübersichtsliste sichtbar (zusätzliche Spalte oder Badge).

- **Given** ich gebe einen ungültigen Wert ein (negativer Betrag, nicht-numerischer String),
  **When** ich auf „Speichern" klicke,
  **Then** erscheint die Inline-Fehlermeldung „Bitte geben Sie einen gültigen Betrag in Euro ein (z.B. 150,00)."

- **Given** eine Buchung hat `final_price_eur` gesetzt,
  **When** die Buchungsübersicht geladen wird,
  **Then** ist der Betrag pro Eintrag als Kurzinfo sichtbar (z.B. „185 €" als Badge oder in einer eigenen Spalte).

- **Given** ein Kunde ruft seine Buchungsdetails im Kundenportal auf,
  **When** die Detailseite geladen ist,
  **Then** ist das `final_price_eur`-Feld nicht sichtbar — es ist ein internes Admin-Feld.

- **Given** `final_price_eur` in der API `GET /api/bookings/:id` aufgerufen wird (Kunden-API),
  **When** die Response zurückgegeben wird,
  **Then** ist das Feld `final_price_eur` nicht in der JSON-Response enthalten.

**Hinweis:** `final_price_eur` wird als `Decimal?`-Feld (nullable) im `Booking`-Prisma-Modell ergänzt. Dezimaltrenner in der UI: Komma (deutsch). API-Validierung: `>= 0`. Wert wird für US-IT6-09 (Analytics) als Umsatz-Basis verwendet.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT6-09: Analytics-Seite in der Admin-Konsole

**Als** Admin (Tom)
**möchte ich** in der Admin-Konsole eine Übersichtsseite sehen, die mir Umsatz, Buchungsvolumen und Service-Performance visualisiert,
**damit** ich auf einen Blick erkenne, wie sich das Geschäft entwickelt, und fundierte Entscheidungen treffen kann.

**Akzeptanzkriterien:**

- **Given** ich öffne den Admin-Bereich „Analytics",
  **When** die Seite geladen ist,
  **Then** sehe ich folgende KPI-Kacheln: „Gesamtumsatz (gesetzt)" (Summe aller `final_price_eur`), „Abgeschlossene Buchungen gesamt", „Durchschnittlicher Auftragswert", „Buchungen diesen Monat".

- **Given** ich wähle einen Zeitraum-Filter (Monat, Quartal, Jahr oder benutzerdefinierter Bereich),
  **When** der Filter angewendet wird,
  **Then** aktualisieren sich alle KPI-Kacheln und Diagramme auf den gefilterten Zeitraum.

- **Given** ich sehe das Umsatz-Diagramm,
  **When** die Seite geladen ist,
  **Then** ist ein Balken- oder Liniendiagramm sichtbar, das den monatlichen Umsatz (Summe `final_price_eur` nach `COMPLETED`-Buchungen) der letzten 12 Monate anzeigt.

- **Given** ich sehe die Service-Aufschlüsselung,
  **When** die Seite geladen ist,
  **Then** ist ein Tortendiagramm oder eine sortierte Liste sichtbar, die die Anzahl abgeschlossener Buchungen pro Service-Typ anzeigt.

- **Given** noch keine Buchungen mit gesetztem `final_price_eur` existieren,
  **When** die Analytics-Seite geladen wird,
  **Then** zeigen die KPI-Kacheln „0" oder „–" (kein Fehler, kein leerer Bildschirm) und ein Hinweis: „Noch keine Umsatzdaten vorhanden. Hinterlegen Sie finale Preise bei abgeschlossenen Buchungen."

- **Given** ich klicke auf eine KPI-Kachel (z.B. „Abgeschlossene Buchungen diesen Monat"),
  **When** der Klick verarbeitet ist,
  **Then** navigiere ich zur gefilterten Buchungsliste mit den entsprechenden Buchungen.

- **Given** die Analytics-Seite über einen API-Endpoint befüllt wird (`GET /api/admin/analytics`),
  **When** ein nicht-autorisierter Request eintrifft,
  **Then** gibt der Endpoint HTTP 401 zurück — die Seite ist ausschließlich für eingeloggte Admins zugänglich.

**Hinweis:** Diagramme mit `recharts` (bereits weit verbreitet im Next.js-Ökosystem, MIT-Lizenz) oder `chart.js` + `react-chartjs-2`. Umsatz basiert auf `final_price_eur` von Buchungen mit Status `COMPLETED`. Buchungen ohne gesetzten `final_price_eur` werden in Umsatzsummen nicht mitgezählt (NULL = kein Betrag). Datums-Aggregation erfolgt serverseitig im API-Endpunkt.

**Priorität:** Must Have | **Story Points:** 5

---

---

## Iteration 7 — Auth-Stabilisierung & Email-Auth-Wiederherstellung

### Kontext

Tom hat nach Go-Live von Iteration 6 fünf kritische Probleme gemeldet. Iteration 7
adressiert ausschließlich diese Probleme — keine neuen Features.

**Wichtigster Pivot:** US-IT7-01 ist eine bewusste **Reversion von US-IT6-05**.
US-IT6-05 hat Email/Password-Auth entfernt und alle zugehörigen Endpoints gelöscht.
Tom möchte Email-Registrierung zurück. Ab IT7 sind alle drei Methoden verfügbar:
Email/Password als Standard plus Google OAuth und Facebook OAuth als Convenience.

**Blocker:** US-IT7-04 (Admin-Wiederherstellung) muss vor allen anderen Stories
bearbeitet werden, da Tom aktuell keinen Admin-Zugang hat.

---

#### US-IT7-01: Email/Password-Registrierung und -Login wiederherstellen

> **Reversion von US-IT6-05.** US-IT6-05 hat Email/Password-Auth und alle
> zugehörigen Endpoints entfernt (`/api/customer/register`, `/login`,
> `/verify-email`, `/forgot-password`, `/reset-password`, `/resend-verification`
> sowie Pages `/konto/registrieren`, `/konto/passwort-vergessen`,
> `/konto/passwort-zuruecksetzen`). Diese Story stellt alle gelöschten
> Endpoints und Pages vollständig wieder her. OAuth bleibt erhalten —
> Email/Password ist additiv, keine Entweder-oder-Entscheidung mehr.

**Als** Kunde
**möchte ich** mich per Email-Adresse und Passwort bei Bärenstark Hausservice
registrieren und einloggen können,
**damit** ich ein Kundenkonto anlegen kann, ohne zwingend ein Google- oder
Facebook-Konto zu benötigen.

**Akzeptanzkriterien:**

- **Given** ich rufe `/konto/registrieren` auf,
  **When** die Seite geladen ist,
  **Then** sehe ich ein Registrierungsformular mit Vorname, Nachname, Email,
  Passwort und „Passwort bestätigen" — sowie die OAuth-Buttons als Alternative.

- **Given** ich fülle das Formular korrekt aus (Passwort mind. 8 Zeichen),
  **When** ich auf „Konto erstellen" klicke,
  **Then** wird mein Account angelegt, ich erhalte eine deutschsprachige
  Bestätigungs-Email via Resend und sehe den Hinweis „Bitte bestätigen Sie
  Ihre E-Mail-Adresse".

- **Given** ich lasse ein Pflichtfeld leer oder das Passwort ist zu kurz,
  **When** ich auf „Konto erstellen" klicke,
  **Then** erscheint eine Inline-Fehlermeldung am betreffenden Feld ohne
  Seitenneuladen.

- **Given** ich rufe `/konto/login` auf,
  **When** die Seite geladen ist,
  **Then** sehe ich sowohl das Email/Passwort-Formular als auch die OAuth-Buttons.

- **Given** ich gebe korrekte Zugangsdaten ein,
  **When** ich auf „Einloggen" klicke,
  **Then** werde ich zu `/konto` weitergeleitet.

- **Given** ich gebe falsche Zugangsdaten ein,
  **When** ich auf „Einloggen" klicke,
  **Then** erscheint „E-Mail oder Passwort ungültig" — ohne Hinweis, welches Feld
  falsch ist.

- **Given** ein Kunde ohne verifizierten Account loggt sich ein,
  **When** die Authentifizierung erfolgt,
  **Then** kann er sich einloggen (Verifizierung ist Convenience, kein harter Block)
  — es erscheint ein Info-Banner „Bitte bestätigen Sie Ihre E-Mail-Adresse".

- **Given** `POST /api/customer/login` aufgerufen wird,
  **When** die Response zurückkommt,
  **Then** enthält sie ausschließlich `CustomerUserPublicSchema`-Felder —
  kein `passwordHash`, kein `adminNote`, kein `adminRating` (F3-Garantie aus
  IT6 bleibt unverändert aktiv).

**Hinweis:** Passwort-Hashing mit bcrypt (Faktor 12). Rate-Limiting auf Login und
Register via Upstash. DTO-Leak-CI-Scan muss nach Implementierung grün bleiben.

**Priorität:** Must Have | **Story Points:** 5

---

#### US-IT7-02: Google OAuth funktional reparieren

> **Bug-Reparatur (Folge von US-IT6-05).** Der Google-OAuth-Bug wurde in IT6
> nur per Runbook dokumentiert. Tom hat das Runbook ohne Erfolg ausgeführt.
> Diese Story verlangt aktive Diagnose + konkrete Reparatur — kein neues
> Runbook.

**Als** Kunde
**möchte ich** mich mit meinem Google-Konto bei `/konto/login` anmelden können,
**damit** ich kein eigenes Passwort anlegen muss.

**Akzeptanzkriterien:**

- **Given** der Entwickler führt die Diagnose-Checkliste aus (Browser DevTools
  Network-Tab → OAuth-Redirect-Fehlercode, Server-Log, NEXTAUTH_URL-Check,
  Google Cloud Console Redirect-URIs, `trustHost`-Check, Consent-Screen-Status),
  **When** die konkrete Fehlerursache identifiziert ist,
  **Then** ist sie im PR dokumentiert: `redirect_uri_mismatch`, `invalid_client`,
  `NEXTAUTH_URL falsch` oder `trustHost fehlt`.

- **Given** die Authorized Redirect URI in der Google Cloud Console fehlt oder
  ist falsch,
  **When** sie auf `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`
  und `http://localhost:3000/api/auth/customer/callback/google` korrigiert wird,
  **Then** schlägt der OAuth-Flow nicht mehr mit `redirect_uri_mismatch` fehl.

- **Given** `NEXTAUTH_URL` enthält einen Trailing-Slash oder ist leer,
  **When** der Wert auf `https://www.baerenstark-hausservice.app` gesetzt wird,
  **Then** wird er von NextAuth korrekt als Callback-Basis verwendet.

- **Given** `trustHost: true` fehlt in der NextAuth-Konfiguration,
  **When** es in `customer-oauth.ts` ergänzt wird,
  **Then** entfällt der „Bad request"-Fehler durch Host-Verifikation in NextAuth v5.

- **Given** alle Korrekturen eingespielt sind,
  **When** Tom auf „Mit Google anmelden" klickt und den Flow abschließt,
  **Then** ist er eingeloggt, wird zu `/konto` weitergeleitet — kein Fehler.

**Hinweis:** Benötigte ENV: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`NEXTAUTH_URL`, `NEXTAUTH_SECRET`. Tom liefert Client-ID/Secret.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT7-03: Facebook OAuth funktional reparieren

> **Bug-Reparatur (Folge von US-IT6-05).** Facebook OAuth wurde in IT6
> implementiert aber nie vollständig konfiguriert. Diese Story schließt die
> Konfiguration ab — inklusive der Schritte, die Tom selbst im Meta Developer
> Portal ausführen muss.

**Als** Kunde
**möchte ich** mich mit meinem Facebook-Konto bei `/konto/login` anmelden können,
**damit** ich eine weitere bequeme Anmelde-Option habe.

**Akzeptanzkriterien:**

- **Given** der Entwickler prüft die Facebook-App-Konfiguration,
  **When** er App-Status, Redirect-URIs und ENV-Vars kontrolliert,
  **Then** ist dokumentiert, welcher Konfigurationsschritt fehlt.

- **Given** `FACEBOOK_CLIENT_ID` und `FACEBOOK_CLIENT_SECRET` gesetzt sind und
  die Redirect URI auf
  `https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook`
  zeigt,
  **When** Tom auf „Mit Facebook anmelden" klickt und den Flow abschließt,
  **Then** ist er eingeloggt und wird zu `/konto` weitergeleitet.

- **Given** die Facebook-App im „Development"-Mode ist,
  **When** Tom sie im Meta Developer Portal auf „Live" schaltet,
  **Then** können sich alle Facebook-Nutzer anmelden (kein App Review nötig bei
  ausschließlich `email` + `public_profile`).

**Hinweis zu Toms Aufgaben im Meta Developer Portal:**
1. Facebook Login → Einstellungen → Valid OAuth Redirect URIs setzen.
2. App-Domain `www.baerenstark-hausservice.app` eintragen.
3. App-Status auf „Live" setzen.
4. App-ID + App-Secret an Entwickler übergeben.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT7-04: Admin-Bootstrap-Reset — Tom als Admin wiederherstellen

> **BLOCKER.** Tom kann sich nicht mehr als Admin anmelden. Ursache ist unklar —
> wahrscheinlich hat der DB-Reset aus US-IT6-06 alle Admin-Accounts gelöscht
> und der Bootstrap-Pfad (`/api/admin/setup`) ist durch die F1-Bedingung
> (410 GONE wenn `count(users) >= 1`) gesperrt. Diese Story stellt Toms
> Admin-Zugang binnen Minuten wieder her.

**Als** Admin (Tom)
**möchte ich** einen klar dokumentierten CLI-Befehl haben, der mich als
ACTIVE-Admin in der Datenbank wiederherstellt,
**damit** ich die Admin-Konsole wieder nutzen kann, ohne auf Entwickler-
Unterstützung warten zu müssen.

**Akzeptanzkriterien:**

- **Given** der Entwickler führt `npx tsx scripts/promote-admin.ts hausservice-baerenstark@outlook.com` aus,
  **When** das Skript läuft,
  **Then** wird entweder (a) ein neuer Admin mit dieser Email und Status ACTIVE
  angelegt, oder (b) ein bestehender User auf ACTIVE gesetzt — je nachdem, ob
  der User existiert.

- **Given** das Skript erfolgreich durchgelaufen ist,
  **When** Tom `/admin/login` aufruft und sein Passwort eingibt,
  **Then** ist er als ACTIVE-Admin eingeloggt.

- **Given** das Skript mit unbekannter Email und leerer Tabelle aufgerufen wird,
  **When** es einen neuen User anlegt,
  **Then** wird ein temporäres Passwort generiert und im Terminal ausgegeben.

- **Given** das Skript aufgerufen wird ohne `ALLOW_ADMIN_PROMOTE=true` gesetzt zu
  sein,
  **When** es startet,
  **Then** bricht es sofort mit einem Hinweis ab — kein unbeabsichtigtes
  Ausführen möglich.

- **Given** mindestens ein ACTIVE-Admin existiert,
  **When** `/api/admin/setup` aufgerufen wird,
  **Then** gibt der Endpoint weiterhin 410 GONE zurück (F1-Sicherheitsgarantie
  bleibt erhalten).

**Hinweis:** Skript `scripts/promote-admin.ts` — Passwort bcrypt-gehashed.
Nur als lokales CLI-Tool, nie über HTTP-Route erreichbar. ENV-Guard:
`ALLOW_ADMIN_PROMOTE=true`.

**Priorität:** Must Have — BLOCKER | **Story Points:** 2

---

#### US-IT7-05: Passwort-Reset-Flow End-to-End funktional (Kunden)

> **Abhängig von US-IT7-01.** `POST /api/customer/forgot-password` und
> `POST /api/customer/reset-password` wurden in IT6 (D3-Fix) gelöscht. Sie
> werden mit US-IT7-01 wiederhergestellt und müssen als vollständiger
> E2E-Flow getestet sein.

**Als** Kunde
**möchte ich** mein Passwort zurücksetzen können,
**damit** ich wieder Zugang zu meinem Konto erhalte, ohne ein neues Konto
anlegen zu müssen.

**Akzeptanzkriterien:**

- **Given** ich rufe `/konto/passwort-vergessen` auf und gebe meine Email ein,
  **When** ich auf „Link anfordern" klicke,
  **Then** erhalte ich innerhalb von 2 Minuten eine deutschsprachige Email via
  Resend mit Reset-Link — unabhängig davon, ob ein Account existiert, erscheint
  dieselbe neutrale Meldung „Falls diese Adresse registriert ist, erhalten Sie
  eine E-Mail."

- **Given** ich klicke auf den Reset-Link (gültig max. 1 Stunde, single-use),
  **When** die Seite `/konto/passwort-zuruecksetzen` geladen wird,
  **Then** sehe ich zwei Felder: „Neues Passwort" und „Passwort bestätigen".

- **Given** ich gebe ein neues Passwort (mind. 8 Zeichen, übereinstimmend) ein,
  **When** ich auf „Passwort ändern" klicke,
  **Then** wird das neue Passwort bcrypt-gehashed gespeichert, der Token
  invalidiert und ich werde zu `/konto/login` mit Erfolgsmeldung weitergeleitet.

- **Given** ich logge mich nach dem Reset mit neuem Passwort ein,
  **When** ich Email und neues Passwort eingebe,
  **Then** werde ich zu `/konto` weitergeleitet.

- **Given** ich rufe einen abgelaufenen oder bereits verwendeten Reset-Link auf,
  **When** die Seite lädt,
  **Then** sehe ich „Dieser Link ist nicht mehr gültig. Bitte fordern Sie einen
  neuen Reset-Link an." mit Link zu `/konto/passwort-vergessen`.

- **Given** `POST /api/customer/forgot-password` wird mehr als 5 Mal in
  15 Minuten von derselben IP aufgerufen,
  **When** das Limit überschritten wird,
  **Then** antwortet der Endpoint mit HTTP 429.

**Hinweis:** Token: `crypto.randomBytes(32)` → Base64url → SHA-256-Hash in DB
gespeichert. Ablauf: 1 Stunde. Nach Nutzung sofort invalidiert. Email-Template
auf Deutsch. Rate-Limiting via Upstash.

**Priorität:** Must Have | **Story Points:** 3

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
- IT6 — Admin-Verwaltung (US-IT6-01): Ein eingeloggter Admin kann sich nicht selbst löschen oder deaktivieren (Lock-out-Schutz). Passwort-Reset für Fremd-Admins ist IT7-Backlog.
- IT6 — Kalender-UX (US-IT6-02): Drag-and-drop zum Verschieben bestätigter Buchungen ist Could Have / IT7. Empfohlene Bibliothek: `react-big-calendar` oder `@fullcalendar/react` für Admin; `react-day-picker` für Kunden.
- IT6 — Auth-Bereinigung (US-IT6-05): Facebook OAuth erfordert eine verifizierte App-Domain (kein localhost in Produktion). `FACEBOOK_CLIENT_ID` und `FACEBOOK_CLIENT_SECRET` liefert Tom. Google-„Bad request"-Fix: Redirect-URI-Konfiguration in Google Cloud Console muss geprüft werden.
- IT6 — DB-Reset (US-IT6-06): Abgeschlossene und bestätigte Buchungen werden anonymisiert (customerId = NULL), nicht hart gelöscht — Buchungshistorie und Finanzdaten bleiben erhalten. Offene/stornierte Buchungen verwaister Kunden werden auf CANCELLED gesetzt. Skript: `scripts/reset-users.ts`.
- IT6 — Nutzerverwaltung (US-IT6-07): `adminNote` und `adminRating` dürfen in keinem Kunden-facing Endpoint serialisiert werden. Prisma-Select muss diese Felder explizit ausschließen.
- IT6 — Finaler Preis (US-IT6-08): `final_price_eur` ist vom Stripe-Betrag (US-28) getrennt — deckt auch Barzahlung und manuelle Korrekturen ab. Dezimaltrenner in der UI: Komma (DE-Format).
- IT6 — Analytics (US-IT6-09): Nur Buchungen mit Status `COMPLETED` und gesetztem `final_price_eur` fließen in Umsatzsummen ein. Empfohlene Charting-Bibliothek: `recharts`.
- IT6 — SEO (US-IT6-04): `openingHours` im Structured Data (LocalBusiness) muss Tom bestätigen. Platzhalter: Mo–Fr 07:00–18:00. Lighthouse-Score 80+ auf Desktop ist Richtwert.

---

## Iteration 8 — Bugfix-Sweep & DayOverride-Sichtbarkeit

### Kontext

Nach dem Go-Live von Iteration 7 hat Tom fünf Produktionsprobleme gemeldet.
Drei davon sind kritische Bugs, die Admin-Arbeit blockieren (weiße Seiten,
fehlender Kalender, nicht aktualisierte Zeitfenster-Liste). Eine Story
adressiert fehlende UI-Sichtbarkeit für DayOverrides. Eine Story untersucht
den weiterhin fehlschlagenden Google-OAuth-Flow und klärt verbindlich, ob
es sich um einen Code-Bug oder eine ausstehende Cloud-Console-Konfiguration
handelt.

Iteration 8 enthält ausschließlich die gemeldeten Probleme — keine neuen
Features.

---

#### US-IT8-01: Admin-Verwaltungsseite `/admin/admins` — Client-Side-Crash beheben

> **Kritischer Bug.** `/admin/admins` wirft einen unbehandelten Client-Side-
> Fehler und zeigt nur eine weiße Seite. Tom kann die Admin-Verwaltung nicht
> nutzen. Ursache ist unbekannt — wahrscheinlich ein fehlender Error-Boundary,
> ein ungültiger Datenzugriff auf `undefined` oder eine fehlende Null-Prüfung
> in der Komponente.

**Als** Admin (Tom)
**möchte ich** die Seite `/admin/admins` fehlerfrei aufrufen können,
**damit** ich Admins einsehen und verwalten kann, ohne auf eine weiße Fehlerseite
zu treffen.

**Akzeptanzkriterien:**

- **Given** ich rufe `/admin/admins` auf,
  **When** die Seite lädt,
  **Then** sehe ich entweder die Admin-Liste oder — falls noch keine Admins
  vorhanden sind — einen leeren Zustand mit erklärendem Text, aber niemals
  eine weiße Seite oder „Application error".

- **Given** der API-Call zum Laden der Admin-Liste schlägt fehl (z. B. Netzwerk
  oder Datenbankfehler),
  **When** die Komponente den Fehler empfängt,
  **Then** zeigt sie eine lesbare Fehlermeldung (kein leerer Screen, kein
  unbehandelter Crash).

- **Given** der Entwickler öffnet die Browser-Konsole auf `/admin/admins`,
  **When** die Seite vollständig geladen ist,
  **Then** erscheinen keine unbehandelten JavaScript-Exceptions.

- **Given** der Crash wurde behoben,
  **When** der CI-Build läuft,
  **Then** ist `next build` ohne Typ- oder Laufzeitfehler in der betreffenden
  Komponente erfolgreich.

**Hinweis:** Entwickler prüft zuerst die Browser-Konsole auf den genauen
Stack-Trace, um die fehlerhafte Zeile zu identifizieren, bevor Code geändert
wird. Error-Boundary auf Seiten-Ebene im Admin-Bereich empfohlen.

**Priorität:** Must Have | **Story Points:** 2

---

#### US-IT8-02: Admin-Kalender `/admin/calendar` — Kalender-Komponente rendert nicht

> **Kritischer Bug.** Die Seite `/admin/calendar` lädt ohne Fehler, zeigt
> aber keinen Kalender. Die Kalender-Komponente (wahrscheinlich
> `react-big-calendar` oder `@fullcalendar/react` aus IT6-Annahme) wird
> nicht gerendert. Ursache ist unklar — mögliche Kandidaten: fehlende CSS-
> Imports, SSR-/Hydrations-Problem, leeres Datenfetch-Ergebnis ohne
> Fallback-Rendering, oder fehlerhafte Prop-Übergabe.

**Als** Admin (Tom)
**möchte ich** auf `/admin/calendar` einen Kalender sehen, der meine
bestätigten Buchungen anzeigt,
**damit** ich meinen Terminüberblick nutzen kann.

**Akzeptanzkriterien:**

- **Given** ich rufe `/admin/calendar` auf,
  **When** die Seite geladen ist,
  **Then** ist die Kalender-Komponente sichtbar (Tages-/Wochen-/Monatsraster
  erkennbar) — auch wenn noch keine Buchungen vorhanden sind.

- **Given** es existieren bestätigte Buchungen in der Datenbank,
  **When** ich den Kalender aufrufe,
  **Then** erscheinen die Buchungen als Einträge im Kalender.

- **Given** es existieren keine Buchungen,
  **When** der Kalender lädt,
  **Then** wird das leere Kalender-Raster trotzdem korrekt dargestellt
  (kein leerer weißer Bereich ohne Raster).

- **Given** der Fix ist eingespielt,
  **When** ich die Seite im Browser-DevTools-Tab „Network" beobachte,
  **Then** werden die erforderlichen CSS-Assets der Kalender-Bibliothek
  erfolgreich geladen (HTTP 200).

**Hinweis:** Typische Ursachen bei `react-big-calendar`: fehlendes
`import 'react-big-calendar/lib/css/react-big-calendar.css'`. Bei
`@fullcalendar/react`: fehlendes CSS-Plugin oder `dynamic()` ohne
`{ ssr: false }`. Entwickler prüft beide Kandidaten.

**Priorität:** Must Have | **Story Points:** 2

---

#### US-IT8-03: Zeitfenster-Liste `/admin/slots` — Liste nach Speichern nicht aktualisiert

> **Kritischer Bug.** Nach dem Absenden des Zeitfenster-Formulars auf
> `/admin/slots` erscheint das neu gespeicherte Zeitfenster nicht in der
> Liste. Der Form-Submit selbst scheint zu funktionieren (kein sichtbarer
> Fehler). Ursache ist wahrscheinlich: (a) der GET-Request nach dem POST
> wird nicht neu ausgelöst (fehlende Revalidation), (b) der POST-Endpoint
> gibt keinen Fehler zurück, aber das Slot-Objekt wird nicht korrekt in der
> DB persistiert, oder (c) der GET-Endpoint filtert falsch und gibt ein
> leeres Array zurück.

**Als** Admin (Tom)
**möchte ich**, dass ein neu gespeichertes Zeitfenster sofort in der
Zeitfenster-Liste erscheint,
**damit** ich den Erfolg meiner Eingabe direkt bestätigt sehe und weiterarbeiten
kann.

**Akzeptanzkriterien:**

- **Given** ich fülle das Zeitfenster-Formular korrekt aus und klicke
  „Speichern",
  **When** der POST erfolgreich abgeschlossen ist,
  **Then** erscheint das neue Zeitfenster ohne Seitenneuladen in der Liste
  darunter.

- **Given** ich speichere ein Zeitfenster,
  **When** ich anschließend die Seite manuell neu lade (F5),
  **Then** ist das Zeitfenster weiterhin in der Liste sichtbar — es ist
  persistent in der Datenbank gespeichert.

- **Given** der Entwickler prüft den GET-Endpoint (`GET /api/admin/slots`
  o. Ä.),
  **When** er die Datenbank direkt abfragt (Prisma Studio oder SQL),
  **Then** ist dokumentiert, ob das Slot-Objekt nach dem POST in der DB
  vorhanden ist (Persistenz-Check vor UI-Fix).

- **Given** der POST-Endpoint antwortet mit HTTP 200/201,
  **When** die UI den Response erhält,
  **Then** löst sie exakt einen GET-Request aus, um die Liste zu
  aktualisieren — kein vollständiges Page-Reload erforderlich.

**Hinweis:** Entwickler prüft in dieser Reihenfolge: (1) Ist das Slot-Objekt
nach dem POST in der DB? (2) Gibt der GET den Slot zurück? (3) Aktualisiert
die UI-State den List nach dem POST korrekt? Erst dann ist klar, auf welcher
Schicht der Bug sitzt.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT8-04: DayOverride-Liste in `DayOverrideManager.tsx` sichtbar machen

> **Fehlende UI-Funktion.** Tom hat DayOverrides (tagesspezifische
> Öffnungszeiten-Überschreibungen) eingetragen, kann sie aber nirgends
> einsehen oder bearbeiten. Die Komponente `DayOverrideManager.tsx` enthält
> wahrscheinlich nur ein Formular zum Anlegen, aber keine Liste der
> vorhandenen Einträge. Diese Story ergänzt die Listenansicht.

**Als** Admin (Tom)
**möchte ich** alle eingetragenen DayOverrides in einer übersichtlichen Liste
sehen können,
**damit** ich überblicken kann, welche Tages-Überschreibungen aktiv sind, und
einzelne Einträge bei Bedarf löschen oder anpassen kann.

**Akzeptanzkriterien:**

- **Given** ich öffne die Seite, die `DayOverrideManager.tsx` enthält,
  **When** die Komponente lädt,
  **Then** sehe ich eine Liste aller gespeicherten DayOverrides mit mindestens:
  Datum, überschriebenen Öffnungszeiten (oder „Geschlossen"), und einem
  Löschen-Button pro Eintrag.

- **Given** es sind keine DayOverrides vorhanden,
  **When** die Liste lädt,
  **Then** erscheint ein leerer Zustand mit dem Text „Keine Überschreibungen
  eingetragen."

- **Given** ich klicke auf „Löschen" für einen DayOverride-Eintrag,
  **When** ich die Aktion bestätige,
  **Then** wird der Eintrag aus der Datenbank entfernt und verschwindet sofort
  aus der Liste ohne Seitenneuladen.

- **Given** ich lege einen neuen DayOverride über das bestehende Formular an,
  **When** das Speichern erfolgreich war,
  **Then** erscheint der neue Eintrag sofort in der Liste (analog zu
  US-IT8-03-Verhalten).

- **Given** ein DayOverride-Datum liegt in der Vergangenheit,
  **When** die Liste geladen wird,
  **Then** ist der Eintrag visuell als „vergangen" markiert (z. B. ausgegraut)
  — er bleibt sichtbar, wird aber optisch unterschieden.

**Hinweis:** GET-Endpoint für alle DayOverrides muss geprüft oder angelegt
werden, falls noch nicht vorhanden. Sortierung: chronologisch aufsteigend
nach Datum. Vergangene Einträge können automatisch ausgeblendet werden —
Tom bestätigen, was er bevorzugt (Annahme: sichtbar aber ausgegraut).

**Priorität:** Should Have | **Story Points:** 3

---

#### US-IT8-05: Google-OAuth-Diagnose verbindlich abschließen — Code-Bug vs. Config-Aufgabe

> **Abhängig von US-IT7-02 + Runbook `docs/AUTH_GOOGLE_FIX_RUNBOOK.md`.**
> Google OAuth schlägt in Produktion weiterhin fehl (`redirect_uri_mismatch`
> oder ähnlich), obwohl IT7 einen Diagnose-Endpoint (`/api/auth/diagnose`)
> geliefert hat. Das Runbook wurde nicht erfolgreich ausgeführt. Diese Story
> hat ein eng gefasstes Akzeptanzkriterium: Nicht „Tom kann sich einloggen"
> (das hängt von Toms Cloud-Console-Konfiguration ab), sondern: Der
> Diagnose-Endpoint zeigt eindeutig grün/rot pro Check, sodass klar ist,
> ob auf Code-Seite noch etwas fehlt oder ob Tom selbst einen Konfigurationsschritt
> in der Google Cloud Console ausführen muss.

**Als** Admin (Tom)
**möchte ich** durch einen einzigen Aufruf von `/api/auth/diagnose`
unmissverständlich sehen, ob Google OAuth auf Code-Seite korrekt konfiguriert
ist — und falls nicht, welcher konkrete Schritt fehlt,
**damit** ich ohne Entwickler-Unterstützung entscheiden kann, ob ich selbst
in der Google Cloud Console etwas ändern muss oder ob zuerst ein Code-Fix
deployt werden muss.

**Akzeptanzkriterien:**

- **Given** `AUTH_DIAGNOSE_ENABLED=true` ist in den Vercel-ENV-Vars gesetzt,
  **When** ich `GET /api/auth/diagnose` in Produktion aufrufe,
  **Then** liefert der Endpoint ein JSON-Objekt mit einem `checks`-Array,
  in dem jeder Check ein `status`-Feld (`"ok"` | `"error"` | `"warning"`)
  und ein `message`-Feld auf Deutsch enthält.

- **Given** `NEXTAUTH_URL` fehlt oder enthält einen Trailing-Slash,
  **When** der Diagnose-Endpoint ausgeführt wird,
  **Then** erscheint dieser Check mit `status: "error"` und einer Meldung,
  die den genauen Ist-Wert und den erwarteten Soll-Wert nennt.

- **Given** `AUTH_SECRET` (oder `NEXTAUTH_SECRET`) ist nicht gesetzt,
  **When** der Diagnose-Endpoint ausgeführt wird,
  **Then** erscheint dieser Check mit `status: "error"` — der Geheimwert
  selbst wird nie ausgegeben, nur ob er gesetzt ist.

- **Given** `GOOGLE_CLIENT_ID` oder `GOOGLE_CLIENT_SECRET` fehlen,
  **When** der Diagnose-Endpoint ausgeführt wird,
  **Then** zeigt `providersActive.google: false` mit `status: "error"` und
  dem Hinweis „ENV-Var GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET fehlt."

- **Given** alle Code-seitigen Checks sind `"ok"`,
  **When** der Diagnose-Endpoint ausgeführt wird,
  **Then** enthält das JSON einen Abschnitt `"actionRequired": "config"` mit
  der Anweisung, welche exakten Redirect-URIs (`expectedCallbacks.google`)
  Tom in der Google Cloud Console eintragen muss — damit ist für Tom
  eindeutig: „Code ist korrekt, ich muss selbst in der Console etwas tun."

- **Given** mindestens ein Code-seitiger Check ist `"error"`,
  **When** der Diagnose-Endpoint ausgeführt wird,
  **Then** enthält das JSON `"actionRequired": "code"` mit einer Auflistung
  der fehlgeschlagenen Checks — damit ist für den Entwickler eindeutig,
  welcher Code-Fix vor Toms Cloud-Console-Aktion deployt werden muss.

- **Given** alle Checks sind `"ok"` und Tom hat die Redirect-URIs laut
  `expectedCallbacks.google` korrekt in der Google Cloud Console eingetragen,
  **When** Tom auf „Mit Google anmelden" klickt,
  **Then** schlägt der OAuth-Flow nicht mehr mit `redirect_uri_mismatch`
  fehl (dieser Schritt ist Tom-seitige Config-Verifikation, kein
  automatisierter Test).

**Hinweis:** Akzeptanzkriterium für „Erfolg" dieser Story ist ausdrücklich
der grün/rot-Diagnose-Output — nicht der funktionierende Login (der hängt
von Toms Cloud-Console-Konfiguration ab und liegt außerhalb des Code-Repos).
Falls der Diagnose-Endpoint einen Code-Bug aufdeckt, ist der Fix Teil dieser
Story. Falls alle Checks grün sind, liefert der Entwickler Tom einen
Screenshot des Diagnose-Outputs mit den einzutragenden Redirect-URIs als
einzige verbleibende Aufgabe.

**Priorität:** Must Have | **Story Points:** 3
