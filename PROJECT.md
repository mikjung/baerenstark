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
| US-IT10-01 | Passwort-Reset E-Mail funktioniert nicht      | Must Have    | Iteration 10                         |
| US-IT10-02 | Admin-Nutzerliste lädt nicht                  | Must Have    | Iteration 10                         |
| US-IT10-03 | Buchungsanfrage kann nicht abgesendet werden  | Must Have    | Iteration 10                         |
| US-IT10-04 | Kalender-Quick-Booking Modal                  | Should Have  | Iteration 10                         |
| US-IT10-05 | Kunden-Dashboard Self-Service                 | Should Have  | Iteration 10                         |
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

---

## Iteration 9 — Admin-Stabilität, Kunden-Adresse & Buchungs-Kalender

### Kontext

Nach Abschluss von Iteration 8 (Bugfix-Sweep) hat Tom vier neue Punkte
gemeldet: ein weiterer Admin-Seiten-Crash (`/admin/users`), die fehlende
Möglichkeit für Kunden, ihre Adresse zu hinterlegen, ein nicht
ladendes Kalender-Widget im öffentlichen Buchungs-Flow sowie den Bedarf
an einem verständlichen Schritt-für-Schritt-Guide zur Google-OAuth-Konfiguration
in der Google Cloud Console.

Iteration 9 enthält ausschließlich diese vier Punkte. Das bereits angekündigte
UX/UI-Review (mit externem UX-Experten, Architect und PM) findet separat nach
IT9 statt — es ist kein Teil dieses Build-Loops.

---

#### US-IT9-01: Admin-Seite `/admin/users` — Crash-Ursache finden und beheben

> **Kritischer Bug.** `/admin/users` rendert die in IT8 eingebaute Error-Boundary
> (`src/app/admin/error.tsx`) mit der Meldung „Etwas ist schiefgelaufen." Das
> bedeutet, die Seite crasht serverseitig (Next.js Server Component) oder
> clientseitig (React-Laufzeit) nach dem Hydration. Analog zu US-IT8-01
> (`/admin/admins`), aber eine andere Route und wahrscheinlich eine andere
> Ursache.

**Als** Admin (Tom)
**möchte ich** `/admin/users` fehlerfrei aufrufen können,
**damit** ich Kundendaten einsehen und verwalten kann, ohne auf die
Error-Boundary-Meldung zu treffen.

**Akzeptanzkriterien:**

- **Given** ich rufe `/admin/users` als eingeloggter Admin auf,
  **When** die Seite lädt,
  **Then** sehe ich die Kundenübersicht (Tabelle oder Liste der registrierten
  Kunden) — die Error-Boundary wird nicht mehr gezeigt.

- **Given** der Entwickler öffnet Vercel-Logs oder den Browser-Error-Stack
  direkt nach dem Crash,
  **When** er die Stack-Trace analysiert,
  **Then** ist die Ursache dokumentiert (z. B. ungültiger Datenzugriff auf
  `undefined`, fehlende Null-Prüfung, falsche Prisma-Query, fehlender
  null-Check bei Server-Component-Props) — damit ist der Root Cause nachvollziehbar.

- **Given** die Seite `/admin/users` lädt korrekt,
  **When** es in der DB keine registrierten Kunden gibt,
  **Then** erscheint ein leerer Zustand mit dem Text „Keine Kunden registriert."
  statt eines Crashes oder leeren Containers.

- **Given** die Seite `/admin/users` lädt korrekt,
  **When** mindestens ein Kunde in der DB existiert,
  **Then** werden mindestens Name (oder E-Mail), Registrierungsdatum und
  Status des Kunden angezeigt.

**Hinweis:** Diagnose-Reihenfolge: (1) Server-Logs in Vercel prüfen —
ist der Fehler eine Prisma-Exception, ein undefined-Access oder ein
Auth-Guard-Problem? (2) Lokale Reproduktion mit `next dev`. (3) Fix +
Regressionscheck für `/admin/admins` (darf durch den Fix nicht
zurückbrechen). Diese Story schließt ausdrücklich nur `/admin/users` ein —
andere Admin-Routen sind Out of Scope.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT9-02: Kunden-Adresse — Eingabe bei Registrierung und Bearbeitung im Profil

> **Neue Funktion.** Tom muss zum Kunden fahren — die Kundenadresse ist für
> ihn operativ relevant. Die Adresse gehört dem Kunden (DSGVO): Kunden können
> sie selbst eintragen, ändern und löschen. Das Schema-Modell `CustomerUser`
> wird um die Adressfelder erweitert (Prisma-Migration).

**Als** Kunde
**möchte ich** meine Adresse (Straße + Hausnummer, PLZ, Ort) angeben und
jederzeit selbst ändern können,
**damit** Tom weiß, wohin er für den gebuchten Termin fahren muss, und ich
die DSGVO-Hoheit über meine Daten behalte.

**Akzeptanzkriterien:**

- **Given** ich öffne das Registrierungsformular (`/konto/registrieren`),
  **When** die Seite lädt,
  **Then** sehe ich drei optionale Adressfelder: „Straße & Hausnummer",
  „PLZ" und „Ort" — mit einem Hinweistext „Wird für Terminbuchungen
  benötigt." Felder sind optional bei der Registrierung (keine Pflichtfelder,
  damit der Einstieg reibungslos bleibt).

- **Given** ich fülle Adressfelder aus und schließe die Registrierung ab,
  **When** ich mein Profil unter `/konto` öffne,
  **Then** sehe ich die eingetragene Adresse in den Profilfeldern vorausgefüllt.

- **Given** ich öffne mein Profil unter `/konto`,
  **When** die Seite lädt,
  **Then** sehe ich die Adressfelder (vorausgefüllt mit gespeicherten Werten
  oder leer) und kann sie bearbeiten und speichern.

- **Given** ich ändere meine Adresse im Profil und klicke auf „Speichern",
  **When** der Request erfolgreich ist,
  **Then** erscheint eine Bestätigung „Adresse gespeichert." und der neue
  Wert wird sofort in der Ansicht angezeigt — kein Seitenneuladen.

- **Given** ich möchte meine Adresse löschen,
  **When** ich alle drei Adressfelder leere und speichere,
  **Then** werden die Felder in der DB auf `null` gesetzt — die Adresse ist
  damit entfernt.

- **Given** der Admin (Tom) öffnet `/admin/users` und wählt einen Kunden,
  **When** die Detailansicht lädt,
  **Then** sieht Tom die Adresse des Kunden (lesend) — Tom kann die Adresse
  nicht im Namen des Kunden ändern.

- **Given** ein eingeloggter Kunde startet einen Buchungs-Flow und hat
  noch keine Adresse hinterlegt,
  **When** er auf den letzten Schritt des Buchungsformulars zugreift,
  **Then** erscheint ein Hinweis „Bitte vervollständige zuerst deine Adresse
  in deinem Profil." mit einem Link zu `/konto` — Adresse ist Pflicht beim
  Buchen, nicht bei der Registrierung.

- **Given** `GET /api/customer/me` oder ein äquivalenter Profil-Endpoint
  wird aufgerufen,
  **When** der Response serialisiert wird,
  **Then** sind die Adressfelder im Response enthalten — keine anderen
  kundeninternen Felder wie `adminNote` oder `adminRating` werden
  herausgegeben (Prisma-Select explizit).

- **Given** eine Prisma-Migration für die neuen Felder wird ausgeführt,
  **When** die Migration in Produktion applied wird,
  **Then** brechen keine bestehenden Queries auf `CustomerUser` (Felder
  nullable, additive Migration).

**Hinweis:** Schema-Erweiterung (alle nullable):
`streetAndNumber String?`, `postalCode String?` (5-stellig, DE-Validation),
`city String?`. Prisma-Migration ist Pflicht — kein Raw-SQL-Workaround.
DSGVO: Adresse wird ausschließlich unter der eigenen Customer-Session
lesbar und schreibbar. Tom sieht die Adresse im Admin-Read-only-View.
PLZ-Validierung: `/^\d{5}$/` (clientseitig + serverseitig).
Annahme: Adresse ist optional bei der Registrierung, Pflicht beim Buchen —
Tom bitte bestätigen, falls abweichend.

**Priorität:** Should Have | **Story Points:** 5

---

#### US-IT9-03: Buchungs-Kalender im Kunden-Flow — Slot interaktiv auswählen

> **Kritischer Bug / fehlende Funktion.** Der öffentliche Buchungs-Flow
> zeigt keinen funktionierenden Kalender — vermutlich ein endloser Skeleton
> oder ein leerer Container. Analog zum Admin-Kalender-Bug aus IT8, aber
> im kundenseitigen Flow. Ohne Kalender kann kein Termin gebucht werden.

**Als** Kunde
**möchte ich** im Buchungs-Flow einen Kalender sehen, der verfügbare Zeitslots
anzeigt, und einen Slot per Klick auswählen können,
**damit** meine Terminwahl direkt in das Buchungsformular übernommen wird
und ich die Buchung abschließen kann.

**Akzeptanzkriterien:**

- **Given** ich öffne den Buchungs-Flow (z. B. `/buchen`),
  **When** der Kalender-Schritt erreicht wird,
  **Then** rendert der Kalender sichtbar innerhalb von 3 Sekunden — kein
  dauerhafter Skeleton, kein leerer Container.

- **Given** der Kalender geladen ist,
  **When** ich einen Tag mit verfügbaren Slots auswähle,
  **Then** sehe ich die verfügbaren Zeitslots für diesen Tag als klickbare
  Elemente (z. B. „09:00–10:00", „10:30–11:30" etc.).

- **Given** ich auf einen Slot klicke,
  **When** die Auswahl registriert wird,
  **Then** wird der Slot visuell hervorgehoben (selected-State) und der
  gewählte Termin (Datum + Uhrzeit) erscheint im nachfolgenden
  Buchungsformular vorausgefüllt.

- **Given** ein Tag hat keine verfügbaren Slots (z. B. vollständig belegt
  oder DayOverride „Geschlossen"),
  **When** ich diesen Tag im Kalender anklicke,
  **Then** sehe ich den Hinweis „Für diesen Tag sind keine Termine verfügbar."
  — der Tag ist nicht buchbar.

- **Given** der Kalender-Daten-Endpoint (z. B. `GET /api/slots/available`)
  antwortet mit einem Fehler oder Timeout,
  **When** der Kalender versucht zu laden,
  **Then** erscheint eine Fehlermeldung „Verfügbare Termine konnten nicht
  geladen werden. Bitte Seite neu laden." statt eines dauerhaften Skeletons.

- **Given** ich habe einen Slot ausgewählt und wechsle zurück zum
  vorherigen Buchungsschritt,
  **When** ich erneut auf den Kalender-Schritt navigiere,
  **Then** ist mein vorher gewählter Slot noch selektiert (State bleibt
  erhalten während der Session).

**Hinweis:** Diagnose-Reihenfolge: (1) Prüfe, ob der Slot-Endpoint
(`/api/slots/available` o. Ä.) in Produktion erreichbar ist und Daten
zurückgibt. (2) Prüfe, ob der Kalender-Fetch clientseitig korrekt
ausgelöst wird (Network-Tab). (3) Prüfe, ob die Kalender-Komponente
auf den Fetch-State korrekt reagiert (Loading / Error / Data).
Empfohlene Bibliothek für Kunden-Kalender: `react-day-picker` (laut
IT6-Annahme). Falls der Bug ein CORS-Problem oder ein fehlender
API-Route-Handler ist, ist der Fix Teil dieser Story.

**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT9-04: Google-OAuth-Setup-Guide für Tom — Schritt-für-Schritt-Dokumentation

> **Reine Doku-Story, kein Code-Fix.** Laut Diagnose-Ergebnis aus IT8
> (US-IT8-05) ist der Code-seitige OAuth-Setup korrekt (`actionRequired:
> "config"`). Tom kommt mit der Google Cloud Console-Konfiguration nicht
> zurecht: Er weiß nicht, welche URL in welches Feld eingetragen werden muss
> und was `redirect_uri_mismatch` bedeutet. Diese Story liefert einen
> vollständigen, selbsterklärenden Guide — kein Code, keine Vercel-Änderung.

**Als** Tom (Inhaber, nicht-technisch)
**möchte ich** eine Schritt-für-Schritt-Anleitung haben, die mir genau zeigt,
wo und was ich in der Google Cloud Console eintragen muss,
**damit** ich Google-OAuth ohne Rückfragen an die Entwicklung lauffähig kriege.

**Akzeptanzkriterien:**

- **Given** Tom öffnet `docs/GOOGLE_OAUTH_SETUP_GUIDE.md`,
  **When** er die Anleitung von Anfang bis Ende liest,
  **Then** kann er ohne weitere Rückfragen die Google Cloud Console öffnen,
  ein OAuth-Projekt anlegen (oder das bestehende auswählen) und alle
  notwendigen Redirect-URIs eintragen.

- **Given** der Guide beschreibt den Schritt „Redirect-URIs eintragen",
  **When** Tom diesen Abschnitt liest,
  **Then** sieht er die exakten URLs, die einzutragen sind (z. B.
  `https://www.baerenstark-hausservice.app/api/auth/callback/google`),
  und eine Screenshot-Beschreibung, die beschreibt, welches Feld in der
  Cloud Console gemeint ist (z. B. „Im Abschnitt ‚Autorisierte
  Weiterleitungs-URIs' unter ‚OAuth 2.0-Client-IDs' → deinen App-Eintrag
  → Bearbeiten").

- **Given** Tom erhält beim Login-Versuch den Fehler `redirect_uri_mismatch`,
  **When** er den entsprechenden Abschnitt im Guide aufschlägt,
  **Then** findet er eine Erklärung auf Deutsch, was dieser Fehler bedeutet,
  warum er auftritt und welchen konkreten Schritt in der Cloud Console er
  als nächstes ausführen muss.

- **Given** Tom hat alle Schritte des Guides ausgeführt,
  **When** er auf „Mit Google anmelden" klickt,
  **Then** wird er durch den Google-OAuth-Flow geleitet und danach auf
  `/admin` weitergeleitet — kein `redirect_uri_mismatch`, kein Fehler.
  (Dieses Kriterium ist manuell durch Tom zu verifizieren.)

- **Given** der Guide ist fertiggestellt,
  **When** ein unabhängiger Leser ohne Cloud-Console-Erfahrung die Anleitung
  liest,
  **Then** enthält der Guide mindestens folgende Abschnitte in dieser
  Reihenfolge: (1) Voraussetzungen, (2) Google Cloud Console öffnen und
  Projekt auswählen, (3) OAuth-Consent-Screen prüfen, (4) OAuth-Client-ID
  finden/anlegen, (5) Redirect-URIs eintragen (mit exakten URLs),
  (6) Client-ID und Client-Secret in Vercel-Umgebungsvariablen eintragen,
  (7) Fehlerdiagnose (`redirect_uri_mismatch` erklären + Lösung).

**Hinweis:** Dateiname und -pfad sind festgelegt: `docs/GOOGLE_OAUTH_SETUP_GUIDE.md`.
Der Guide muss auf Deutsch verfasst sein. Screenshot-Beschreibungen ersetzen
echte Screenshots (da Markdown keine eingebetteten Screenshots aus der Cloud
Console mitliefern kann) — jede Beschreibung muss präzise genug sein, dass
Tom das UI-Element eindeutig identifizieren kann. Exakte Redirect-URI-Werte
werden aus dem IT8-Diagnose-Endpoint (`expectedCallbacks.google`) übernommen.
Diese Story ist Must Have, weil Google-OAuth für Tom der primäre Login-Weg
ist und er aktuell blockiert ist.

**Priorität:** Must Have | **Story Points:** 2

---

### Backlog-Eintrag (Post-IT9, kein Bestandteil dieser Iteration)

**UX/UI-Review — Separate Folge-Iteration nach IT9**

Tom hat angekündigt, nach Abschluss von IT9 einen gemeinsamen Review-Termin
mit einem UX-Experten, dem Architect und dem PM anzusetzen. Dieses Review
ist kein normaler Build-Loop: Es handelt sich um eine strukturierte
Evaluierung der bestehenden UI/UX auf Basis von Nutzerfeedback und
Usability-Heuristiken, aus der ein neues Backlog für gezielte UX-Verbesserungen
entsteht. Keine Story für IT9 — wird nach IT9-Abschluss separat initiiert.

**Priorität:** Must Have | **Story Points:** 3

---

## UX-Backlog — aus dem UX-Review vom 2026-05-03

Am 2026-05-03 hat ein UX/UI-Senior ein vollständiges Heuristik-Review der Bärenstark-App durchgeführt (Methode: Quellcode-Sichtung + Nielsen-Heuristiken + projektspezifische Achsen Conversion, Admin-Effizienz, Accessibility). Das Review-Dokument liegt unter `UX_REVIEW.md` im Projekt-Root. Die folgenden Stories sind direkt aus den Findings abgeleitet und stellen den UX-Backlog für Iteration 10 und darüber hinaus dar — Tom entscheidet pro Sprint, welche Stories er zieht.

---

### Bucket A — Trust + Conversion

*Niedrigstes Risiko: rein additive UI-Änderungen, keine API-Vertrags-Änderungen. Empfohlen als IT10.*

---

#### US-UX-A-01: Vertrauensleiste oberhalb des Buchungs-Kalenders

**Als** potenzieller Kunde auf `/buchung`
**möchte ich** direkt unter der Überschrift eine kompakte Leiste mit Sterne-Schnitt, Bewertungsanzahl, dem Hinweis „Persönlich von Tom Siefert" und einem Telefon-CTA sehen,
**damit** ich Vertrauen schöpfe, bevor ich einen Termin wähle, und nicht ohne Orientierung vor dem Kalender stehe.

**Akzeptanzkriterien:**

- **Given** ich rufe `/buchung` auf, **When** die Seite geladen ist, **Then** sehe ich direkt unterhalb der H1 eine Trust-Bar mit Bewertungs-Schnitt (`REVIEWS_AVERAGE`), Bewertungsanzahl (`REVIEWS_COUNT`) und einem klickbaren Telefon-Link — noch bevor der Kalender sichtbar wird.
- **Given** ich nutze ein Smartphone, **When** ich die Trust-Bar sehe, **Then** ist der Telefon-Button als Touch-Target mindestens 44 × 44 px groß und direkt wählbar.

**Aufwand:** S | **Priorität:** P0
**Datei-Referenz:** `src/app/buchung/page.tsx:19–31`, neue Komponente `BookingTrustBar.tsx`, Daten aus `lib/reviews.ts`

---

#### US-UX-A-02: Adress-Hinweis für eingeloggte Kunden vor dem Kalender

**Als** eingeloggter Kunde ohne hinterlegte Adresse
**möchte ich** bereits ganz oben auf der Buchungsseite einen gut sichtbaren Hinweis mit direktem Link zu meinem Profil sehen,
**damit** ich nicht erst nach Auswahl von Tag, Dauer und Slot am Ende des Formulars erfahre, dass meine Adresse fehlt.

**Akzeptanzkriterien:**

- **Given** ich bin eingeloggt und mein Konto hat keine Adresse, **When** ich `/buchung` aufrufe, **Then** erscheint direkt unter der H1 (oberhalb des Kalenders) ein gelber Hinweis-Banner mit dem Text „Deine Adresse fehlt noch" und einem Link „Adresse jetzt ergänzen" zu `/konto`.
- **Given** ich bin eingeloggt und mein Konto hat eine vollständige Adresse, **When** ich `/buchung` aufrufe, **Then** erscheint dieser Banner nicht.

**Aufwand:** S | **Priorität:** P0
**Datei-Referenz:** `src/app/buchung/BookingClient.tsx` (oberhalb von `<section aria-labelledby="calendar-heading">`), `BookingForm.tsx:475–491` (bisherige Position)

---

#### US-UX-A-03: Designsystem-Tokens für Feedback-Farben konsolidieren

**Als** Tom
**möchte ich** konsistente Marken-konforme Farben für alle Status-Banner, Fehler-Felder und Buttons,
**damit** Fehler-Meldungen und Erfolgs-Hinweise zum Holz-/Beige-Design passen und die App professionell und einheitlich wirkt.

**Akzeptanzkriterien:**

- **Given** ein Fehler-Banner wird angezeigt, **When** ich es auf jeder Seite sehe, **Then** nutzt es das Token `error` (`#B23A3A`) statt generisches `red-700` — gleiches gilt für `warning`, `success`, `info` jeweils mit Marken-kalibrierter Sättigung.
- **Given** die Tokens in `tailwind.config.ts` eingetragen sind, **When** `Banner.tsx`, `Button.tsx` (danger-Variante) und `Input.tsx` (Error-State) gerendert werden, **Then** referenzieren alle drei die neuen semantischen Tokens statt Tailwind-Default-Farben.

**Aufwand:** S | **Priorität:** P0
**Datei-Referenz:** `tailwind.config.ts`, `src/components/ui/Banner.tsx:5–10`, `src/components/ui/Button.tsx:20`, `src/components/ui/Input.tsx:71`

---

#### US-UX-A-04: Telefon-Icon im Mobile-Header sichtbar machen

**Als** mobiler Besucher (insbesondere telefon-affine Kunden 50+)
**möchte ich** auf jeder Seite im Mobile-Header einen sichtbaren Telefon-Icon-Button haben,
**damit** ich Tom direkt anrufen kann, ohne erst zum Footer scrollen zu müssen.

**Akzeptanzkriterien:**

- **Given** ich besuche die Seite auf einem Smartphone (Viewport < 1024 px), **When** der Header geladen ist, **Then** sehe ich neben dem Logo einen Telefon-Icon-Button (44 × 44 px Tap-Target) der `tel:0157-74787512` öffnet — ohne die Nummer auszuschreiben.
- **Given** ich besuche die Seite auf einem Desktop (Viewport ≥ 1024 px), **When** der Header geladen ist, **Then** ist der Icon-Button ausgeblendet und der bisherige Text-Telefon-Link bleibt sichtbar.

**Aufwand:** S | **Priorität:** P0
**Datei-Referenz:** `src/components/layout/Header.tsx:35` (`hidden ... lg:inline-flex`)

---

#### US-UX-A-05: Buchungs-Erfolg auf dedizierte Bestätigungsseite umleiten

**Als** Kunde, der eine Buchungsanfrage erfolgreich abgesendet hat,
**möchte ich** auf eine eigene Bestätigungsseite weitergeleitet werden, die mir zeigt, was als nächstes passiert,
**damit** ich sicher bin, dass meine Buchung eingegangen ist, und nicht vor einem halb-gefüllten Formular stehe.

**Akzeptanzkriterien:**

- **Given** ich habe das Buchungsformular vollständig ausgefüllt und abgesendet, **When** die Server-Antwort „Erfolg" zurückgibt, **Then** werde ich auf `/buchung/bestaetigt` weitergeleitet — das Formular mit den vorherigen Eingaben ist nicht mehr sichtbar.
- **Given** ich lande auf `/buchung/bestaetigt`, **When** die Seite lädt, **Then** sehe ich eine klare Bestätigungsmeldung, ein Vertrauenssignal (z. B. Tom-Foto oder Bärenstark-Icon) und einen „Was passiert als Nächstes?"-Abschnitt, der erklärt, wann Tom sich meldet.

**Aufwand:** S | **Priorität:** P1
**Datei-Referenz:** `src/app/buchung/BookingForm.tsx:172–194` (bisherige Inline-Erfolgsanzeige), `/buchung/bestaetigt`-Route existiert bereits

---

#### US-UX-A-06: Service-Karten mit zwei sichtbaren CTAs ausstatten

**Als** Besucher auf der Service-Übersicht
**möchte ich** auf jeder Service-Karte sowohl einen „Mehr erfahren"- als auch einen „Direkt buchen"-Button sehen,
**damit** ich nicht erst das Detail-Modal öffnen, lesen und schließen muss, um zur Buchung zu gelangen.

**Akzeptanzkriterien:**

- **Given** ich sehe die Service-Übersicht, **When** die Karten geladen sind, **Then** hat jede Karte zwei sichtbare Aktionen: „Mehr erfahren" (öffnet das bisherige Modal) und „Direkt buchen" (navigiert zu `/buchung?service=<slug>`).
- **Given** ich klicke „Direkt buchen" auf einer Service-Karte, **When** der Buchungs-Flow lädt, **Then** ist der entsprechende Service vorausgewählt (bestehende `?service=`-Query-Logik greift).

**Aufwand:** S | **Priorität:** P1
**Datei-Referenz:** `src/components/services/ServiceGrid.tsx:36–80`

---

#### US-UX-A-07: scroll-margin-top für Buchungs-Sektionen einbauen

**Als** mobiler Kunde im Buchungs-Flow
**möchte ich** nach jeder Auswahl zur nächsten Sektion scrollen, ohne dass deren Überschrift hinter dem Sticky-Header versteckt wird,
**damit** ich immer sehe, was im nächsten Schritt von mir erwartet wird.

**Akzeptanzkriterien:**

- **Given** ich wähle einen Tag im Kalender aus, **When** der Flow automatisch zur nächsten Sektion scrollt, **Then** ist die Sektions-H2 vollständig sichtbar — nicht vom Sticky-Header (`position: sticky; top: 0`) verdeckt.
- **Given** der CSS `scroll-margin-top` ist gesetzt, **When** ich auf allen Abschnitten (`#calendar-heading`, `#duration-heading`, `#slot-heading`, `#form-heading`) prüfe, **Then** beträgt der Wert mindestens 5 rem.

**Aufwand:** S | **Priorität:** P1
**Datei-Referenz:** `src/app/buchung/BookingClient.tsx:267–414`, `src/components/layout/Header.tsx:8`

---

### Bucket B — Buchungs-Flow neu denken

*Mittleres Risiko: betrifft die kritischste Kunden-Reise. Aufbauend auf Bucket A; gute QA-Pässe erforderlich.*

---

#### US-UX-B-01: Buchungs-Flow als sichtbaren Stepper mit Auswahl-Pill umbauen

**Als** Kunde im Buchungs-Flow (besonders auf Mobile)
**möchte ich** oben einen Stepper sehen, der meinen Fortschritt anzeigt, und eine kompakte Auswahl-Zusammenfassung, die meine bisherigen Entscheidungen festhält,
**damit** ich weiß, wo ich im Prozess stehe und was ich bereits gewählt habe, ohne zurückscrollen zu müssen.

**Akzeptanzkriterien:**

- **Given** ich befinde mich auf `/buchung`, **When** ich eine Auswahl treffe (Tag, Dauer oder Slot), **Then** aktualisiert sich ein Sticky-Stepper oben sofort und zeigt den aktuellen Schritt hervorgehoben an (z. B. „Tag → Dauer → Slot → Daten").
- **Given** ich habe Tag und Dauer gewählt, **When** ich zum Slot-Schritt komme, **Then** zeigt eine Auswahl-Pill oben „Mo 12. Mai · 2 Stunden" dauerhaft sichtbar — auch wenn ich nach unten scrolle.
- **Given** ein Schritt noch nicht relevant ist, **When** ich die Seite betrachte, **Then** ist dieser Abschnitt eingeklappt (Disclosure) — die Seite ist nicht eine lange scrollbare Seite mit allen vier Sektionen gleichzeitig.

**Aufwand:** M | **Priorität:** P1
**Datei-Referenz:** `src/app/buchung/BookingClient.tsx:196–221`, neue Komponente `components/booking/BookingStepper.tsx`

---

#### US-UX-B-02: Mobile Tap-Targets systemisch auf 44 px hochziehen

**Als** mobiler Nutzer (Tom auf der Baustelle, ältere Kunden mit größeren Fingern)
**möchte ich**, dass alle interaktiven Elemente mindestens 44 × 44 px Klickfläche haben,
**damit** ich nicht versehentlich den falschen Button treffe und Fehlklicks reduziert werden.

**Akzeptanzkriterien:**

- **Given** `Button` size="sm" wird gerendert, **When** ich die Höhe messe, **Then** ist die Mindesthöhe 44 px (`min-h-[44px]`) — nicht mehr ~32 px wie aktuell.
- **Given** Slot-Kacheln im `TimeSlotPicker` werden im 2-Spalten-Grid angezeigt, **When** ich den Abstand messe, **Then** beträgt der Gap mindestens `gap-3` (12 px) statt `gap-2` (8 px) — ausreichend für Daumen-Trennschärfe.

**Aufwand:** M | **Priorität:** P1
**Datei-Referenz:** `src/components/ui/Button.tsx:24` (size="sm"), `src/components/booking/TimeSlotPicker.tsx:202–211`

---

#### US-UX-B-03: Datenschutz-Checkbox im Buchungsformular mit 44-px-Klickfläche

**Als** Kunde am Ende des Buchungsformulars
**möchte ich** die Datenschutz-Checkbox bequem antippen können,
**damit** ich auf Mobile nicht mehrfach tippen muss, weil die Checkbox zu klein ist.

**Akzeptanzkriterien:**

- **Given** ich befinde mich auf dem Buchungsformular (Step 4), **When** ich zur Datenschutz-Checkbox scrolle, **Then** ist die gesamte `<label>`-Fläche klickbar und mindestens 44 px hoch.
- **Given** ich nutze einen Screen-Reader, **When** ich zur Checkbox navigiere, **Then** wird sie als Checkbox mit korrekter Beschriftung angesagt — keine rein visuelle Darstellung.

**Aufwand:** S | **Priorität:** P1
**Datei-Referenz:** `src/app/buchung/BookingForm.tsx:564–571`

---

#### US-UX-B-04: Status-Icons in Banner für farbenblinde Nutzbarkeit ergänzen

**Als** Nutzer mit Rot-Grün-Schwäche
**möchte ich** in Hinweis-Banners neben der Farbe auch ein Icon sehen, das den Typ der Meldung klar macht,
**damit** ich nicht allein auf Farbunterscheidung angewiesen bin.

**Akzeptanzkriterien:**

- **Given** ein Fehler-Banner angezeigt wird, **When** ich ihn sehe, **Then** enthält er ein `<AlertTriangle>`-Icon (oder äquivalent) links neben dem Text — zusätzlich zur Hintergrundfarbe.
- **Given** ein Erfolgs-Banner angezeigt wird, **When** ich ihn sehe, **Then** enthält er ein `<CheckCircle>`-Icon links neben dem Text — zusätzlich zur Hintergrundfarbe.

**Aufwand:** S | **Priorität:** P1
**Datei-Referenz:** `src/components/ui/Banner.tsx:24`

---

### Bucket C — Admin-Effizienz

*Mittleres Risiko: mehrere zusammenhängende Änderungen am Admin-Bereich. Empfohlen als zusammenhängendes Release mit kurzem Walkthrough für Tom.*

---

#### US-UX-C-01: Admin-Navigation auf eine einzige Sektions-Leiste konsolidieren

**Als** Tom im Admin-Bereich
**möchte ich** eine einzige klare Navigationsleiste haben, die alle Bereiche auflistet,
**damit** ich nicht zwischen fünf Quick-Links oben und vier Tabs darunter wählen muss und „Bewertungen" nicht zweimal auftaucht.

**Akzeptanzkriterien:**

- **Given** ich öffne `/admin`, **When** die Seite geladen ist, **Then** sehe ich genau eine horizontale Navigationsleiste (sticky) mit allen Bereichen — die separaten Quick-Link-Buttons existieren nicht mehr parallel.
- **Given** ich navigiere zwischen Bereichen, **When** ich auf einen Navigations-Eintrag klicke, **Then** wechselt der Inhalt darunter ohne Seitenwechsel — kein doppelter Bewertungs-Eintrag.

**Aufwand:** S–M | **Priorität:** P0
**Datei-Referenz:** `src/components/admin/AdminDashboard.tsx:62–96`

---

#### US-UX-C-02: Admin-Dashboard als „Was muss ich heute tun?"-Ansicht

**Als** Tom
**möchte ich** auf `/admin` sofort sehen, welche Buchungen meine Aufmerksamkeit brauchen (neue Anfragen, fällige Bestätigungen, unbearbeitete Items > 24 h),
**damit** ich nicht durch Tabs suchen muss, um meinen Arbeitstag zu starten.

**Akzeptanzkriterien:**

- **Given** ich öffne `/admin`, **When** offene Buchungsanfragen existieren, **Then** sehe ich ganz oben eine „Heute zu erledigen"-Sektion mit diesen Anfragen und einem visuellen Indikator (z. B. roter Punkt), wenn eine Anfrage mehr als 24 Stunden ohne Reaktion ist.
- **Given** keine offenen Anfragen vorliegen, **When** ich `/admin` öffne, **Then** zeigt die „Heute zu erledigen"-Sektion den Leerstand freundlich an — kein leerer Container.

**Aufwand:** M–L | **Priorität:** P1
**Datei-Referenz:** `src/components/admin/AdminDashboard.tsx`, `UpcomingBookingsList.tsx`, evtl. neue `AdminInbox.tsx`

---

#### US-UX-C-03: Admin-Buchungskarten komprimieren — primäre Aktion herausstellen

**Als** Tom in der Buchungsverwaltung
**möchte ich** auf jeder Buchungskarte sofort die wichtigste Aktion erkennen (z. B. „Bestätigen" bei PENDING),
**damit** ich schnell entscheiden kann und nicht jede Karte komplett lesen muss, um den richtigen Button zu finden.

**Akzeptanzkriterien:**

- **Given** ich sehe eine PENDING-Buchung in der Admin-Tabelle, **When** die Karte gerendert wird, **Then** ist der primäre Aktion-Button (z. B. „Bestätigen") prominent (groß, oben rechts) — Sekundäres (Mail erneut, Preis-Editor, Counter-Proposal) ist hinter einem „…"-Menü oder Detail-Drawer ausgeblendet.
- **Given** ich öffne das Detail-Menü oder den Drawer, **When** alle Informationen angezeigt werden, **Then** sehe ich alle bisherigen Informationen vollständig — kein Datenverlust durch die Komprimierung.

**Aufwand:** M | **Priorität:** P1
**Datei-Referenz:** `src/components/admin/BookingTable.tsx:258–535`, `PaymentEditor.tsx`, `FinalPriceEditor.tsx`

---

#### US-UX-C-04: Verfügbarkeits-Konfiguration mit Inline-Hilfe und klarer Struktur

**Als** Tom in der Verfügbarkeitsverwaltung
**möchte ich** zu jedem Konfigurationsbereich (Buffer, Wochenvorlage, Tages-Überschreibungen) einen erklärenden Titel und kurzen Hilfetext sehen,
**damit** ich als Nicht-Techniker verstehe, was jede Einstellung bewirkt.

**Akzeptanzkriterien:**

- **Given** ich öffne den Verfügbarkeits-Tab, **When** die Seite lädt, **Then** sehe ich mindestens drei klar benannte Sektionen mit je einer kurzen Erklärung, z. B. „Puffer zwischen Aufträgen — wie viel Pause Tom zwischen zwei Buchungen braucht".
- **Given** ich eine Sektion aufklappe (Collapsible) oder den Tab wechsle, **When** der Inhalt erscheint, **Then** ist er thematisch geschlossen — kein Vermischen von Buffer-Config und Tages-Überschreibungen in einer langen `<hr />`-getrennten Liste.

**Aufwand:** M | **Priorität:** P2
**Datei-Referenz:** `src/components/admin/WeeklyAvailabilityForm.tsx:21–30`

---

#### US-UX-C-05: Adresse und Maps-Link in der „Bevorstehende Termine"-Liste

**Als** Tom auf dem Weg zum Kunden
**möchte ich** in der Liste der bevorstehenden Termine direkt die Kunden-Adresse sehen und per Tap in Maps öffnen können,
**damit** ich keine Buchungskarte aufklappen muss, um die Zieladresse zu kopieren.

**Akzeptanzkriterien:**

- **Given** ich sehe die „Bevorstehende Termine"-Liste, **When** ein Termin eine Kunden-Adresse hat, **Then** wird die Adresse direkt in der Zeile angezeigt, und ein Tap auf die Adresse öffnet sie in der Karten-App des Geräts (`geo:`-URI oder Maps-URL).
- **Given** ein Termin hat keine hinterlegte Adresse, **When** die Liste angezeigt wird, **Then** erscheint ein Hinweis „Keine Adresse hinterlegt" — kein leerer Platz.

**Aufwand:** S | **Priorität:** P1
**Datei-Referenz:** `src/components/admin/UpcomingBookingsList.tsx:107–137`

---

#### US-UX-C-06: Zeitfenster-Formular einklappbar machen

**Als** Tom in der Zeitfensterverwaltung
**möchte ich** das „Neues Zeitfenster anlegen"-Formular nicht dauerhaft aufgeklappt sehen,
**damit** ich bei vielen bestehenden Slots nicht jedes Mal an der Form vorbeiscrollen muss, um zur Liste zu gelangen.

**Akzeptanzkriterien:**

- **Given** ich öffne den Zeitfenster-Tab, **When** die Seite lädt, **Then** ist das Formular eingeklappt und ein Button „+ Neues Zeitfenster anlegen" ist sichtbar.
- **Given** ich klicke auf „+ Neues Zeitfenster anlegen", **When** das Formular aufklappt, **Then** scrollt die Ansicht sanft zum Formular und ich kann direkt mit der Eingabe beginnen.

**Aufwand:** S | **Priorität:** P2
**Datei-Referenz:** `src/components/admin/SlotForm.tsx:114–187`

---

### Bucket D — Designsystem-Reife

*Niedrig–mittleres Risiko. Kann parallel zu Bucket A/B/C laufen; nicht conversion-kritisch, zahlt auf Wartbarkeit ein.*

---

#### US-UX-D-01: Polymorphes Button-Komponente — alle Inline-Buttons migrieren

**Als** Tom
**möchte ich** überall auf der Seite gleich aussehende Buttons und Links, unabhängig davon ob sie navigieren oder eine Aktion auslösen,
**damit** die App visuell kohärent wirkt und zukünftige Design-Anpassungen an einer Stelle gemacht werden können.

**Akzeptanzkriterien:**

- **Given** `Button.tsx` wird erweitert, **When** ein Entwickler `<Button as="a" href="…">` verwendet, **Then** rendert es ein natives `<a>` mit allen Button-Styles — keine eigene Tailwind-Klassen-Kette nötig.
- **Given** die Migration abgeschlossen ist, **When** ich Hero-CTA, Header-„Termin buchen"-Link, „Jetzt bezahlen"-Link in `CustomerBookingCard` und OAuth-Buttons in `LoginForm` vergleiche, **Then** haben alle dieselbe Höhe, denselben Hover-State und dasselbe Fokus-Ring-Verhalten.

**Aufwand:** M | **Priorität:** P2
**Datei-Referenz:** `src/components/ui/Button.tsx`, `Hero.tsx:33–39`, `Header.tsx:28–33`, `CustomerBookingCard.tsx:215–220`, `LoginForm.tsx:209–238`

---

#### US-UX-D-02: Datums-Formatierungs-Helfer konsolidieren

**Als** Entwickler (und indirekt als Tom, der überall dasselbe Datumsformat sieht)
**möchte ich** eine einzige zentrale Format-API mit benannten Modi (`'date-short'`, `'date-long'`, `'date-time'`, `'range'`) statt sechs konkurrierender Helfer-Funktionen,
**damit** Datums-Darstellungen im gesamten Projekt konsistent sind und Änderungen nur an einer Stelle gemacht werden müssen.

**Akzeptanzkriterien:**

- **Given** die neue zentrale `format(date, mode)`-Funktion existiert, **When** sie mit jedem der vier Modi aufgerufen wird, **Then** gibt sie ein korrekt formatiertes deutsches Datum zurück — gleich wie die bisherigen Helfer.
- **Given** alle Verbraucher-Komponenten migriert sind, **When** ich nach `formatBerlinDateShort`, `formatDateShort`, `formatDateTime`, `formatSlotRange`, `formatSlotRangeCompact` und der lokalen `formatDate` in `UpcomingBookingsList.tsx` suche, **Then** finden sich keine Aufrufe dieser alten Helfer mehr.

**Aufwand:** M | **Priorität:** P2
**Datei-Referenz:** `src/lib/` (mehrere Helfer), `UpcomingBookingsList.tsx:21–32`, `DayOverrideManager.tsx:44–48`

---

#### US-UX-D-03: Kalender-Komponenten konsolidieren

**Als** Entwickler
**möchte ich** nur eine Kalender-Implementierung im Buchungs-Flow statt zwei parallele (`BookingCalendar.tsx` FullCalendar-basiert und `Calendar.tsx` Legacy),
**damit** Bugfixes und Design-Änderungen am Kalender nicht doppelt gepflegt werden müssen.

**Akzeptanzkriterien:**

- **Given** die Konsolidierung abgeschlossen ist, **When** der Buchungs-Flow die Kalender-Komponente nutzt, **Then** gibt es genau eine Kalender-Implementierung — `Calendar.tsx` ist entweder entfernt oder klar als „Re-Booking only" dokumentiert und nicht mehr im Haupt-Flow eingebunden.
- **Given** die konsolidierte Komponente verwendet wird, **When** ich Regressionstest des Buchungs-Flows durchführe, **Then** funktioniert die Slot-Auswahl wie vor der Konsolidierung — keine Funktionalitätsverlust.

**Aufwand:** M | **Priorität:** P2
**Datei-Referenz:** `src/components/booking/BookingCalendar.tsx` (FullCalendar), `src/components/ui/Calendar.tsx` (Legacy)

---

### Empfehlung für Tom — was als nächstes ziehen?

**IT10 — Bucket A komplett (empfohlen):**
US-UX-A-01, US-UX-A-02, US-UX-A-03, US-UX-A-04, US-UX-A-05, US-UX-A-06, US-UX-A-07

Begründung: Bucket A enthält ausschließlich additive UI-Änderungen — kein API-Vertrag wird berührt, kein bestehender Flow wird umgebaut. Die Stories adressieren direkt die Conversion-Schwachstellen (Vertrauen im Buchungs-Flow, Adress-Frust, Fehler-Design, Mobile-Telefon-Erreichbarkeit). Niedriges Risiko, sichtbare Wirkung nach einem Sprint.

**Parallel lauffähig — Bucket D:**
US-UX-D-01, US-UX-D-02, US-UX-D-03 können gleichzeitig zu Bucket A oder B bearbeitet werden. Sie berühren keine User-sichtbaren Flows, sondern das Fundament. Empfohlen: D-01 und D-02 parallel zu IT10 starten, damit das Designsystem für den Stepper-Umbau (Bucket B) bereit ist.

**Reihenfolge-Abhängigkeiten:**
- US-UX-A-03 (Token-Konsolidierung) sollte vor US-UX-B-04 (Banner-Icons) abgeschlossen sein — B-04 baut auf den semantischen Tokens auf.
- US-UX-D-01 (polymorphes Button) sollte vor dem großen Stepper-Umbau (US-UX-B-01) fertig sein — der Stepper nutzt Button-Varianten intensiv.
- US-UX-D-02 (Format-Helfer) und US-UX-D-03 (Kalender-Konsolidierung) haben keine harten Vorbedingungen, aber erleichtern die spätere Wartung von Bucket C.

**Bucket B und C:**
Bucket B (Stepper) folgt auf Bucket A — man hat dann bereits Trust-Signale oben, jetzt kommt die Reise selbst. Bucket C (Admin) hat den längsten Atem und kann als separater Sprint nach Bucket B folgen. Tom sollte Bucket C zusammen mit einem kurzen Walkthrough ausrollen, da sich die Admin-Ansicht grundlegend ändert.

*Diese Empfehlung ist eine Orientierung — Tom entscheidet die Priorisierung eigenständig pro Sprint.*

---

## Iteration 10 — Bug-Triage & Customer-Self-Service

### Kontext

Nach dem Go-Live von Iteration 9 hat Tom fünf Punkte aus dem Live-Test gemeldet:
drei kritische Bugs, die Kernfunktionen blockieren (Passwort-Reset, Admin-Nutzerliste,
Anfrage-Absenden), ein UX-Wunsch für ein Kalender-Quick-Booking-Modal und eine
Self-Service-Funktion für das Kunden-Dashboard (eigene Anfragen + Vorausfüllung des
Formulars). Die drei Bug-Stories deuten auf konkrete Implementierungs-Defekte hin
(E-Mail-Versand, Admin-API-Endpoint, Buchungs-API-Endpoint), die der Solution Architect
in der Analyse-Phase diagnostizieren muss, bevor die Implementierung beginnt.

Iteration 10 adressiert ausschließlich die fünf gemeldeten Punkte.

---

#### US-IT10-01: Passwort-Reset per E-Mail funktioniert nicht (Bug-Fix)

> **Kritischer Bug — E-Mail-Versand-Defekt.** Tom hat als Kunde den „Passwort
> vergessen"-Flow getestet. Nach Eingabe der E-Mail-Adresse bleibt die Reset-E-Mail
> aus. Der Fehler liegt wahrscheinlich im Resend-Aufruf (fehlende ENV-Variable,
> falscher API-Key in Produktion, falsche Absender-Domain) oder im Token-Speicher-
> /Abruf-Flow. Der Endpoint `/api/customer/forgot-password` wurde in IT7 (US-IT7-05)
> wiederhergestellt — entweder wurde er in IT9 versehentlich beschädigt oder die
> Produktions-Konfiguration fehlt.
>
> **Aktuelles Verhalten:** Kunde klickt „Passwort vergessen", gibt E-Mail ein —
> keine E-Mail kommt an, kein sichtbarer Fehler in der UI.
> **Erwartetes Verhalten:** Innerhalb von 2 Minuten erhält der Kunde eine
> deutschsprachige Reset-E-Mail via Resend mit einem gültigen (1 Stunde) Single-Use-Link.

**Als** Kunde
**möchte ich** nach Klick auf „Passwort vergessen" zuverlässig eine Reset-E-Mail
erhalten,
**damit** ich mein Passwort zurücksetzen und mich wieder einloggen kann.

**Akzeptanzkriterien:**

- **Given** ich rufe `/konto/passwort-vergessen` auf und gebe meine registrierte
  E-Mail-Adresse ein,
  **When** ich auf „Link anfordern" klicke,
  **Then** erhalte ich innerhalb von 2 Minuten eine E-Mail mit einem gültigen
  Passwort-Reset-Link — unabhängig von der Umgebung (Produktion und lokale
  Entwicklung).

- **Given** der Entwickler analysiert den Fehler-Pfad (Vercel-Logs, Resend-Dashboard,
  ENV-Vars `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXTAUTH_URL`),
  **When** die Ursache identifiziert ist,
  **Then** ist sie im PR dokumentiert: fehlende ENV-Var, ungültiger API-Key,
  nicht-autorisierte Absender-Domain oder Code-Defekt im Token-Flow.

- **Given** der Fix eingespielt ist und ein Kunde den Reset-Link empfängt,
  **When** er auf den Link klickt,
  **Then** sieht er das Formular `/konto/passwort-zuruecksetzen` mit zwei Feldern —
  der Link ist gültig (max. 1 Stunde) und single-use.

- **Given** ein Kunde gibt auf der Reset-Seite ein neues Passwort (mind. 8 Zeichen)
  ein und bestätigt es,
  **When** er auf „Passwort ändern" klickt,
  **Then** wird das Passwort gespeichert, der Token invalidiert und er wird zu
  `/konto/login` mit der Meldung „Passwort erfolgreich geändert" weitergeleitet.

- **Given** ein abgelaufener oder bereits verwendeter Reset-Link aufgerufen wird,
  **When** die Seite lädt,
  **Then** erscheint die Meldung „Dieser Link ist nicht mehr gültig. Bitte fordern
  Sie einen neuen Reset-Link an." — kein unbehandelter Fehler.

**Hinweis für den Architect:** Diagnose-Reihenfolge: (1) Vercel-Logs zum Zeitpunkt des
Forgot-Password-Requests prüfen — gibt der Endpoint einen 500 zurück oder antwortet er
200 ohne E-Mail zu verschicken? (2) Resend-Dashboard auf fehlgeschlagene Sends prüfen.
(3) ENV-Vars `RESEND_API_KEY`, `RESEND_FROM_EMAIL` und `NEXTAUTH_URL` in Vercel auf
Korrektheit prüfen. (4) Absender-Domain in Resend auf Verifizierungsstatus prüfen.

**Klassifikation:** Bug-Fix
**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT10-02: Admin-Portal — Nutzerliste lädt nicht (Bug-Fix)

> **Kritischer Bug — Admin-API-Endpoint-Defekt.** Tom ruft im Admin-Portal die
> Nutzerverwaltung auf (Route `/admin/users`). Die Seite zeigt die Fehlermeldung
> „Interner Serverfehler. Bitte später erneut versuchen." — die Kundenliste wird
> nicht geladen. US-IT9-01 hat einen ähnlichen Crash auf `/admin/users` behoben;
> es ist möglich, dass der Fix unvollständig war, ein Regressionsfall vorliegt oder
> ein anderer API-Endpunkt fehlschlägt (z. B. `/api/admin/users` oder ein
> Prisma-Query-Timeout in Produktion).
>
> **Aktuelles Verhalten:** `/admin/users` zeigt „Interner Serverfehler. Bitte später
> erneut versuchen." — kein Laden der Kundenliste.
> **Erwartetes Verhalten:** Die Seite lädt die Kundenliste korrekt. Bei leerer DB
> erscheint ein leerer Zustand mit Text „Keine Kunden registriert."

**Als** Admin (Tom)
**möchte ich** im Admin-Portal die Liste aller registrierten Nutzer fehlerfrei
aufrufen können,
**damit** ich Kundendaten einsehen und verwalten kann.

**Akzeptanzkriterien:**

- **Given** ich bin als Admin eingeloggt und rufe `/admin/users` auf,
  **When** die Seite lädt,
  **Then** sehe ich entweder die Kundenliste oder — bei leerer Datenbank — den
  Text „Keine Kunden registriert." — die Fehlermeldung „Interner Serverfehler"
  erscheint nicht mehr.

- **Given** der Entwickler analysiert den Fehler (Vercel-Logs, Server-Response des
  API-Endpoints, Prisma-Query-Trace),
  **When** die Ursache identifiziert ist,
  **Then** ist sie im PR dokumentiert: z. B. Prisma-Exception, ungültiger
  Datenzugriff auf `undefined`, fehlende Null-Prüfung, Auth-Guard-Problem oder
  Timeout.

- **Given** der Fix eingespielt ist und mindestens ein Kunde in der Datenbank
  existiert,
  **When** Tom `/admin/users` aufruft,
  **Then** werden mindestens Name (oder E-Mail), Registrierungsdatum und Status
  des Kunden angezeigt.

- **Given** der API-Endpunkt für die Nutzerliste aufgerufen wird,
  **When** die Response zurückkommt,
  **Then** sind keine admin-internen Felder (`adminNote`, `adminRating`,
  `passwordHash`) in der UI sichtbar — nur die für den Admin vorgesehenen
  Felder.

- **Given** der Crash behoben ist,
  **When** der CI-Build läuft,
  **Then** ist `next build` ohne Typ- oder Laufzeitfehler in der betreffenden
  Route erfolgreich.

**Hinweis für den Architect:** Da IT9 (US-IT9-01) denselben Pfad bereits einmal
repariert hat, zuerst prüfen: (1) Wurde die IT9-Reparatur korrekt deployed? Vercel-
Deployment-Log prüfen. (2) Gibt es einen separaten API-Endpunkt (`GET /api/admin/users`),
der fehlschlägt — unabhängig von der Page-Route? (3) Prisma Studio lokal gegen Produkt-
ions-DB-Dump prüfen, ob die Query korrekt ausgeführt werden kann.

**Klassifikation:** Bug-Fix
**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT10-03: Buchungsanfrage kann nicht abgesendet werden (Bug-Fix)

> **Kritischer Bug — Buchungs-API-Endpoint-Defekt.** Beim Absenden einer Buchungsanfrage
> erscheint die Fehlermeldung „Anfrage konnte nicht gesendet werden. Interner
> Serverfehler. Bitte später erneut versuchen." — die Anfrage erreicht Tom nicht, kein
> Eintrag erscheint im Admin-Portal, keine Bestätigungs-E-Mail wird versendet. Dieser
> Fehler ist ein direkter Blocker für Toms Geschäftsbetrieb: kein Neukunde kann eine
> Anfrage stellen. Ähnliche Defekte wurden in Iteration 2 (BUG US-04) und Iteration 3
> (BUG IT3) bereits behoben — es ist möglich, dass eine spätere Änderung (z. B. in IT9)
> eine Regression eingeführt hat.
>
> **Aktuelles Verhalten:** Formular wird ausgefüllt und abgesendet → Fehlermeldung
> „Interner Serverfehler" → kein Eintrag im Admin-Portal, keine E-Mail an Tom.
> **Erwartetes Verhalten:** Nach erfolgreichem Absenden erscheint die Anfrage sofort
> im Admin-Portal, Tom erhält eine Benachrichtigungs-E-Mail, der Kunde wird auf
> `/buchung/bestaetigt` weitergeleitet oder sieht eine Erfolgsmeldung.

**Als** Kunde
**möchte ich** eine Buchungsanfrage erfolgreich absenden können,
**damit** Tom meine Anfrage erhält und wir einen Termin vereinbaren können.

**Akzeptanzkriterien:**

- **Given** ich fülle das Buchungsformular vollständig aus (Name, E-Mail, Telefon,
  Adresse, Service, Datum/Zeitslot, Dauer) und klicke auf „Absenden",
  **When** der Request den Server erreicht und erfolgreich verarbeitet wird,
  **Then** erscheint eine Erfolgsmeldung oder ich werde auf `/buchung/bestaetigt`
  weitergeleitet — keine Fehlermeldung „Interner Serverfehler".

- **Given** die Buchungsanfrage erfolgreich abgesendet wurde,
  **When** Tom das Admin-Portal öffnet,
  **Then** erscheint die neue Anfrage mit Status „Offen" (PENDING) in der
  Buchungsübersicht.

- **Given** die Buchungsanfrage erfolgreich verarbeitet wurde,
  **When** das System die Benachrichtigung versendet,
  **Then** erhält Tom eine Benachrichtigungs-E-Mail an `hausservice-baerenstark@outlook.com`
  mit den Anfragedetails (Kundenname, Service, Datum, Kontaktdaten).

- **Given** der Entwickler den Fehler-Pfad analysiert (Vercel-Logs, HTTP-Response
  des Booking-Endpoints, Prisma-Trace, E-Mail-Versand-Log),
  **When** die Ursache identifiziert ist,
  **Then** ist sie im PR dokumentiert: Prisma-Validierungsfehler, fehlende
  Pflichtfelder in der Request-Payload, Resend-Fehler, fehlerhafte Middleware oder
  unbehandelter Edge-Case im Booking-Handler.

- **Given** der Fix eingespielt ist und ein Kunde das Formular mit gültigen Daten
  absendet,
  **When** ein Pflichtfeld fehlt oder ungültig ist,
  **Then** erscheint eine verständliche deutschsprachige Inline-Fehlermeldung am
  betreffenden Feld — kein generischer 500-Fehler.

**Hinweis für den Architect:** Diagnose-Reihenfolge: (1) Vercel-Logs des
Booking-POST-Endpoints analysieren — welcher Fehler tritt auf (Prisma-Exception,
Zod-Validierungsfehler, TypeError)? (2) Prüfen, ob alle Felder der aktuellen Payload
(inkl. IT9-Erweiterungen wie `streetAndNumber`, `postalCode`, `city`, `durationMinutes`)
im Prisma-Schema und Zod-Schema korrekt abgebildet sind. (3) Resend-Aufruf isoliert
testen. (4) Prüfen, ob eine Prisma-Migration nach IT9 fehlt (Schema-Mismatch).

**Klassifikation:** Bug-Fix
**Priorität:** Must Have | **Story Points:** 5

---

#### US-IT10-04: Kalender-Quick-Booking — Modal statt Seitennavigation (Neues Feature)

> **UX-Verbesserung.** Tom wünscht sich, dass nach Auswahl eines Datum/Zeitfensters
> im Kalender-Widget kein Seitenwechsel stattfindet, sondern direkt ein
> Popup/Modal erscheint, in dem alle Anfrageformular-Felder ausgefüllt werden können.
> Das reduziert den Kontext-Wechsel und soll die Conversion erhöhen.

**Als** Kunde auf der Buchungsseite
**möchte ich** nach Auswahl eines Zeitslots im Kalender ein Modal sehen, in dem ich
alle Buchungsfelder direkt ausfüllen kann,
**damit** ich den Buchungs-Flow ohne Seitennavigation abschließen und schneller
buchen kann.

**Akzeptanzkriterien:**

- **Given** ich rufe die Buchungsseite auf und der Kalender ist geladen,
  **When** ich auf einen verfügbaren Zeitslot klicke (Datum + Uhrzeit ausgewählt),
  **Then** öffnet sich ein Modal/Popup mit dem vollständigen Buchungsformular —
  Datum und Uhrzeit sind bereits vorausgefüllt.

- **Given** das Modal geöffnet ist,
  **When** ich alle Pflichtfelder (Name, E-Mail, Telefon, Adresse, Service,
  Beschreibung) ausfülle und auf „Anfrage absenden" klicke,
  **Then** wird die Buchungsanfrage abgesendet, das Modal schließt sich und eine
  Erfolgsmeldung erscheint — kein Seitenwechsel notwendig.

- **Given** das Modal geöffnet ist und ich auf „Schließen", den Hintergrund oder
  die Escape-Taste klicke,
  **When** die Schließ-Aktion ausgelöst wird,
  **Then** schließt sich das Modal ohne Datenverlust (bereits eingetragene Felder
  bleiben erhalten, wenn das Modal erneut geöffnet wird) — der Kalender ist
  weiterhin sichtbar.

- **Given** ich das Modal öffne und ein Pflichtfeld leer lasse,
  **When** ich auf „Anfrage absenden" klicke,
  **Then** erscheint eine Inline-Fehlermeldung direkt am betreffenden Feld —
  das Modal bleibt offen.

- **Given** ich das Modal auf einem Smartphone nutze,
  **When** das Modal geöffnet ist,
  **Then** ist es vollständig scrollbar, alle Felder erreichbar und der
  Absenden-Button ohne horizontales Scrollen sichtbar.

**Hinweis:** Das Modal kann auf der bestehenden `BookingForm`-Komponente aufgebaut
werden — kein neues Formular notwendig, nur eine neue Wrapper-Logik (Dialog/Sheet).
Vorausfüllen von Datum + Uhrzeit aus dem Kalender-State via Props. Die bestehende
Seitennavigation bleibt als Fallback erhalten (für Nutzer ohne JavaScript oder bei
direktem URL-Aufruf).

**Klassifikation:** Neues Feature
**Priorität:** Should Have | **Story Points:** 5

---

#### US-IT10-05: Kunden-Dashboard Self-Service — eigene Anfragen + Formular-Vorausfüllung (Neues Feature)

> **UX-Verbesserung / Self-Service.** Tom wünscht zwei verbundene Funktionen für
> eingeloggte Kunden: (a) eine Übersicht aller eigenen Anfragen mit aktuellem Status,
> und (b) das Buchungsformular soll mit den bereits im Konto hinterlegten Daten
> (Name, E-Mail, Telefon, Adresse) vorausgefüllt sein, damit die Buchung so einfach
> wie möglich ist. Für (a) existiert bereits die Grundlage aus US-26 (IT4) — diese
> Story prüft und ergänzt fehlende Funktionalität; für (b) ist das Vorausfüllen eine
> neue Integration zwischen Kunden-Session und Buchungsformular.

**Als** eingeloggter Kunde
**möchte ich** alle meine eigenen Buchungsanfragen mit aktuellem Status sehen und
beim Buchen ein mit meinen Profildaten vorausgefülltes Formular vorfinden,
**damit** ich meinen Buchungsstatus jederzeit nachverfolgen und neue Anfragen
schnell und ohne Datenneuerfassung stellen kann.

**Akzeptanzkriterien:**

**Teil A — Anfragen-Übersicht:**

- **Given** ich bin eingeloggt und rufe `/konto` auf,
  **When** die Seite geladen ist,
  **Then** sehe ich eine Liste aller meiner Buchungsanfragen mit mindestens:
  Datum/Uhrzeit, Service, Status-Badge auf Deutsch (Offen / Bestätigt /
  Abgelehnt / Storniert / Gegenvorschlag ausstehend) und dem Erstellungsdatum
  der Anfrage.

- **Given** ich habe noch keine Buchungsanfragen gestellt,
  **When** ich `/konto` aufrufe,
  **Then** erscheint der Hinweis „Sie haben noch keine Anfragen" mit einem
  CTA-Button „Jetzt erste Anfrage stellen".

- **Given** ich klicke auf einen Eintrag in der Anfragen-Übersicht,
  **When** die Detailseite lädt,
  **Then** sehe ich alle Buchungsdetails: Datum, Uhrzeit, Service, Beschreibung,
  Adresse, Status und — falls vorhanden — hochgeladene Dateien.

**Teil B — Formular-Vorausfüllung:**

- **Given** ich bin eingeloggt und öffne das Buchungsformular (direkt oder über
  das Quick-Booking-Modal aus US-IT10-04),
  **When** das Formular geladen ist,
  **Then** sind die Felder Name, E-Mail, Telefon sowie Straße & Hausnummer, PLZ
  und Ort mit den in meinem Konto hinterlegten Werten vorausgefüllt.

- **Given** mein Konto hat keine Adresse hinterlegt,
  **When** das Buchungsformular lädt,
  **Then** bleiben die Adressfelder leer und ein Hinweis „Adresse in Ihrem
  Profil hinterlegen" mit Link zu `/konto` ist sichtbar — das Formular kann
  dennoch ausgefüllt und abgesendet werden (Adresse als Pflichtfeld im Formular,
  nicht im Profil).

- **Given** ich bin eingeloggt, die Formularfelder sind vorausgefüllt und ich
  ändere einen Wert im Formular,
  **When** ich das Formular absende,
  **Then** wird der geänderte Wert für diese Buchung verwendet — die Profildaten
  im Konto werden nicht automatisch überschrieben.

- **Given** ich bin nicht eingeloggt und öffne das Buchungsformular,
  **When** das Formular geladen ist,
  **Then** sind alle Felder leer (kein Vorausfüllen) — das Formular funktioniert
  unverändert als Gastbuchung.

**Hinweis:** Teil A baut auf US-26 (IT4) auf — prüfen, ob die bestehende
`/konto`-Übersicht bereits alle geforderten Status-Badges und Detailfelder zeigt,
oder ob Ergänzungen nötig sind. Teil B erfordert, dass beim Laden des Buchungsformulars
die Kunden-Session ausgelesen und die Profildaten als Default-Values übergeben werden
(`useSession` oder Server-Side-Props). Profildaten im Konto werden nicht durch das
Formular-Absenden geändert (keine ungewollten Überschreibungen).

**Klassifikation:** Neues Feature
**Priorität:** Must Have | **Story Points:** 8

---

## Iteration 11 — Produktions-Stabilisierung & UX-Konsolidierung

### Kontext

Nach dem Deployment von Iteration 10 hat Tom fünf Punkte aus dem Live-Betrieb gemeldet.
Das QA-Review zu IT10 hatte bereits festgehalten, dass alle fünf IT10-Stories
code-seitig korrekt implementiert wurden — die anhaltenden Fehler in Produktion sind
teils auf fehlende operative Schritte zurückzuführen (ENV-Variablen in Vercel,
`prisma migrate deploy` gegen die Produktions-Datenbank), teils auf neu aufgetauchte
oder bisher nicht adressierte Defekte (Datei-Upload-Anzeige im Admin, Profil-
Vorausfüllung in Produktion).

Darüber hinaus hat Tom explizit kritisiert, dass es zu viele Stellen gibt, an denen
ein Kunde einen Termin auswählen kann (Startseite, `/buchen`-Seite,
Quick-Booking-Modal, Kalender). Iteration 11 vereinfacht: ein klarer Buchungsweg
bleibt erhalten, alle redundanten Einstiegspunkte werden entfernt oder auf diesen
einen Weg umgeleitet.

Iteration 11 enthält ausschließlich Bug-Fixes und UX-Konsolidierungen — keine neuen
Features.

---

#### US-IT11-01: Buchung end-to-end zum Laufen bringen (Bug-Fix / Produktions-Diagnose)

> **Kritischer Bug — Buchung schlägt in Produktion fehl.** Tom berichtet, dass
> Buchungen an keiner Stelle funktionieren. Das QA-Review zu IT10 hat festgestellt,
> dass der Code korrekt ist, aber drei operative Schritte nicht abgeschlossen wurden:
> (1) `MAIL_FROM` und weitere ENV-Variablen in Vercel fehlen, (2) `prisma migrate
> deploy` gegen die Produktions-Datenbank (Turso/libSQL) wurde nicht ausgeführt —
> ohne diese Migration fehlen die Spalten `streetAndNumber`, `postalCode`, `city`,
> `durationMinutes` im Prod-Schema, was zu `P2022 Column does not exist` und damit
> zum 500-Fehler bei jedem Booking-POST führt, (3) Resend-Domain nicht verifiziert.
>
> **Aktuelles Verhalten:** Buchungsformular wird abgesendet → interner Fehler,
> keine Buchung in der DB, keine E-Mail.
> **Erwartetes Verhalten:** Buchung wird in der DB gespeichert, Tom erhält
> Benachrichtigungs-E-Mail, Kunde erhält Bestätigung.

**Als** Kunde
**möchte ich** eine Buchungsanfrage erfolgreich absenden können,
**damit** Tom meine Anfrage erhält und ich eine Bestätigung bekomme.

**Akzeptanzkriterien:**

- **Given** der Solution Architect die Vercel-Logs zum Zeitpunkt eines fehlgeschlagenen
  Booking-POST analysiert,
  **When** der Fehlertyp identifiziert ist (Prisma `P2022`, ENV-Fehler, Resend-Fehler),
  **Then** ist die genaue Ursache im PR-Kommentar dokumentiert und die operative
  Gegenmassnahme (ENV setzen, `migrate deploy`, Domain-Verifikation) ist ausgeführt
  und bestätigt.

- **Given** `prisma migrate deploy` gegen die Produktions-Datenbank ausgeführt wurde
  und alle Pflicht-ENV (`RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO_ADMIN`,
  `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`) in Vercel gesetzt sind,
  **When** ein Kunde das Buchungsformular vollständig ausfüllt und absendet,
  **Then** wird die Buchungsanfrage mit Status `PENDING` in der Datenbank gespeichert
  — kein 500-Fehler.

- **Given** eine Buchungsanfrage erfolgreich gespeichert wurde,
  **When** der E-Mail-Versand ausgeführt wird,
  **Then** erhält Tom eine Benachrichtigungs-E-Mail an `hausservice-baerenstark@outlook.com`
  mit Kundenname, Service, Datum und Kontaktdaten.

- **Given** eine Buchungsanfrage erfolgreich gespeichert wurde,
  **When** Tom das Admin-Portal öffnet,
  **Then** erscheint die neue Anfrage mit Status „Offen" in der Buchungsübersicht.

- **Given** der Live-Smoke-Test nach dem Fix durchgeführt wird,
  **When** eine Testbuchung als Gast und als eingeloggter Kunde abgesendet wird,
  **Then** erscheinen beide Buchungen im Admin-Portal und beide
  Benachrichtigungs-E-Mails kommen bei Tom an — kein interner Fehler.

**Hinweis für den Architect:** Diagnose-Reihenfolge: (1) Vercel-Logs auf
`[prisma_error] P2022` prüfen — das wäre der Beweis für fehlende Migration.
(2) Vercel-Dashboard → Environment Variables: `RESEND_API_KEY`, `MAIL_FROM`
(nicht `RESEND_FROM_EMAIL`!), `MAIL_TO_ADMIN`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`,
`DATABASE_URL`. (3) `prisma migrate deploy` lokal gegen Prod-Connection-String
ausführen (oder über Vercel Build Hook). (4) Resend-Dashboard auf Domain-
Verifizierungsstatus prüfen. (5) Nach operativen Fixes: Live-Smoke-Test.

**Klassifikation:** Bug-Fix (Produktions-Konfiguration + ausstehende operative Schritte IT10)
**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT11-02: Buchungsweg konsolidieren — ein klarer Einstiegspunkt (UX-Vereinfachung)

> **UX-Problem.** Tom hat kritisiert, dass es zu viele Stellen für die Terminauswahl
> gibt: Startseite, `/buchen`-Seite, Quick-Booking-Modal (US-IT10-04), Kalender.
> Das verwirrt Kunden und führt zu inkonsistenter Nutzererfahrung.
>
> **Empfohlener Ansatz:** Das Quick-Booking-Modal (US-IT10-04) auf der Startseite
> bleibt als primärer Einstiegspunkt erhalten — es bietet den schnellsten
> Buchungsweg ohne Seitenwechsel. Der „Termin buchen"-CTA auf der Startseite und
> im Header öffnet dieses Modal. Die `/buchen`-Seite wird als eigenständige
> Alternative für Nutzer beibehalten, die direkt zur URL navigieren (z. B. über
> Bookmark oder mobilen Browser ohne JavaScript). Alle anderen isolierten
> Datums-/Slot-Picker, die ausserhalb des Modals oder der `/buchen`-Seite
> eingebettet sind, werden entfernt.

**Als** Kunde
**möchte ich** einen einzigen, offensichtlichen Weg finden, um eine Buchungsanfrage
zu stellen,
**damit** ich nicht verwirrt werde und den Prozess problemlos abschließen kann.

**Akzeptanzkriterien:**

- **Given** ich öffne die Startseite (`/`),
  **When** ich auf den primären „Termin buchen"-Button im Hero oder im Header klicke,
  **Then** öffnet sich das Quick-Booking-Modal direkt — keine Weiterleitung auf
  eine andere Seite.

- **Given** ich öffne die Startseite,
  **When** ich die Seite von oben bis unten durchscrolle,
  **Then** gibt es genau einen CTA für Buchungen (im Hero und/oder Header) —
  kein weiterer eingebetteter Datums- oder Slot-Picker ist auf der Startseite
  sichtbar.

- **Given** ich rufe `/buchen` direkt auf (z. B. über Bookmark),
  **When** die Seite lädt,
  **Then** sehe ich das vollständige Buchungsformular mit Kalender — diese Seite
  funktioniert als eigenständiger Fallback-Weg und ist verlinkbar.

- **Given** ich suche auf der Website nach weiteren Buchungs-Einstiegspunkten
  (z. B. separate Slot-Picker-Widgets auf anderen Seiten oder in Sektionen),
  **When** ich die Startseite und alle verlinkten Seiten durchsuche,
  **Then** finde ich ausschließlich den Hero/Header-CTA (→ Modal) und den
  direkten URL-Aufruf `/buchen` als Buchungswege — keine dritten, vierten oder
  fünften Einstiegspunkte.

- **Given** Tom die Startseite aus Kundenperspektive betrachtet,
  **When** er den Buchungsweg evaluiert,
  **Then** ist ein einziger prominenter CTA sofort erkennbar — ein Klick reicht,
  um zum Buchungsformular zu gelangen.

**Hinweis für den Architect:** Konkret: (1) Alle direkt auf der Startseite
eingebetteten Kalender- oder Slot-Picker-Komponenten (ausserhalb des Modals)
entfernen. (2) Alle „Termin buchen"-Links/Buttons im Header und Hero auf
`openModal()` umstellen statt auf `href="/buchen"`. (3) `/buchen` bleibt bestehen
als Fallback-Seite (für direkte URL-Aufrufe und SEO). (4) Das Quick-Booking-Modal
(US-IT10-04) ist der primäre Flow — nicht neu bauen, nur konsolidieren.

**Klassifikation:** UX-Vereinfachung
**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT11-03: Klare Rückmeldung nach Buchungsabsenden — Toast + Bestätigungsseite (Bug-Fix / UX)

> **UX-Problem.** Nach dem Absenden einer Buchungsanfrage erhält der Kunde keine
> erkennbare Rückmeldung — weder eine Erfolgsmeldung noch eine Fehleranzeige.
> US-IT10-03 hat den Backend-Fehler behoben und die Microcopy im Code hinterlegt,
> aber in Produktion kommt beim Kunden nichts an (entweder weil die Buchung selbst
> noch fehlschlägt — abhängig von US-IT11-01 — oder weil der Toast/Redirect im
> Frontend in der Produktionsumgebung nicht korrekt ausgelöst wird).
>
> Diese Story stellt sicher, dass nach einer erfolgreichen Buchung ein Toast und
> ein Redirect zur Bestätigungsseite stattfinden, und dass bei einem Fehler eine
> verständliche Fehlermeldung erscheint. US-IT11-01 ist Vorbedingung.

**Als** Kunde
**möchte ich** nach dem Absenden meiner Buchungsanfrage sofort wissen, ob sie
erfolgreich war oder warum sie fehlgeschlagen ist,
**damit** ich Sicherheit habe und nicht unsicher bin, ob meine Anfrage angekommen ist.

**Akzeptanzkriterien:**

- **Given** ich habe das Buchungsformular vollständig ausgefüllt und abgesendet,
  **When** der Server die Anfrage erfolgreich verarbeitet (`201 Created`),
  **Then** erscheint ein grüner Toast mit der Meldung „Anfrage erfolgreich gesendet!
  Tom meldet sich in Kürze bei Ihnen." UND ich werde innerhalb von 2 Sekunden auf
  eine Bestätigungsseite weitergeleitet (z. B. `/buchung/bestaetigt`), die mindestens
  Buchungsnummer, Service und Datum anzeigt.

- **Given** ich habe das Buchungsformular über das Quick-Booking-Modal abgesendet,
  **When** der Server die Anfrage erfolgreich verarbeitet,
  **Then** schließt sich das Modal, ein grüner Toast erscheint und ich bleibe auf
  der aktuellen Seite — oder ich werde zur Bestätigungsseite weitergeleitet
  (konsistent mit dem Verhalten auf `/buchen`).

- **Given** ich habe das Buchungsformular abgesendet und der Server antwortet mit
  einem Fehler (4xx oder 5xx),
  **When** die Fehlerantwort im Frontend verarbeitet wird,
  **Then** erscheint eine deutschsprachige Fehlermeldung direkt im Formular oder
  als roter Toast — niemals eine leere Seite oder ein technischer Stack-Trace —
  und ich kann die Anfrage korrigieren oder erneut versuchen.

- **Given** der Erfolgs-Toast erscheint,
  **When** ich ihn lese,
  **Then** enthält er Toms Telefonnummer als Kontaktmöglichkeit, falls ich
  dringende Rückfragen habe.

- **Given** ich bin eingeloggt und die Buchung ist erfolgreich gespeichert,
  **When** ich anschließend mein Kunden-Dashboard unter `/konto` aufrufe,
  **Then** erscheint die soeben erstellte Anfrage mit Status „Offen" in meiner
  Anfragen-Liste.

**Hinweis für den Architect:** US-IT11-01 muss zuerst abgeschlossen sein. Dann
prüfen: (1) Löst `BookingForm.tsx` nach `201 Created` tatsächlich den Toast und
den Redirect aus? (2) Öffnet `QuickBookingModal.tsx` nach Erfolg den Toast korrekt
(globaler `<Toaster />` in `layout.tsx` — prüfen ob er in Prod aktiv ist)?
(3) Bestätigungsseite (`/buchung/bestaetigt`) prüfen: existiert sie, rendert sie
korrekte Daten aus dem Booking-Response?
(4) Die Bestätigungsseite muss auch nach einem Browser-Reload erreichbar sein —
Implementierung per signiertem Link aus der Bestätigungs-E-Mail (z. B. JWT oder
HMAC-Hash mit Buchungs-ID). Empfohlene Token-Gültigkeit: 30 Tage. Ohne gültigen
Token: freundlicher Hinweis mit Buchungsnummer und Toms Telefonnummer anzeigen.

**Klassifikation:** Bug-Fix (Feedback-Anzeige) + UX-Verbesserung
**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT11-04: Datei-Upload im Admin — hochgeladene Bilder/Videos anzeigen (Bug-Fix)

> **Bug.** Tom kann im Admin-Bereich die von Kunden hochgeladenen Bilder und Videos
> nicht sehen. Er benötigt diese Dateien, um zu entscheiden, ob er einen Auftrag
> annimmt. Entweder werden die Dateien nicht korrekt gespeichert (Upload-Endpoint
> fehlerhaft oder Storage nicht konfiguriert), oder sie werden gespeichert aber in
> der Admin-Auftragsdetailansicht nicht angezeigt. Dieser Defekt ist ein direkter
> Blocker für Toms Entscheidungsprozess.

**Als** Admin (Tom)
**möchte ich** in der Auftragsdetailansicht alle vom Kunden hochgeladenen Bilder
und Videos sehen und herunterladen können,
**damit** ich den Auftrag beurteilen und entscheiden kann, ob ich ihn annehme.

**Akzeptanzkriterien:**

- **Given** der Entwickler den Upload-Flow analysiert (Upload-Endpoint,
  Storage-Konfiguration, DB-Verknüpfung),
  **When** die Ursache für die fehlende Anzeige identifiziert ist,
  **Then** ist sie im PR dokumentiert: fehlgeschlagener Upload (Endpoint-Fehler,
  fehlende ENV-Variable für Storage-Provider), fehlende DB-Relation zwischen
  `Booking` und `Attachment`, oder fehlende Anzeige-Komponente in der Admin-
  Detailansicht.

- **Given** ein Kunde beim Buchen mindestens eine Bilddatei (JPG/PNG, max. 10 MB)
  hochlädt,
  **When** die Buchungsanfrage erfolgreich abgesendet wird,
  **Then** ist die Datei persistent gespeichert (Vercel Blob, S3 oder äquivalent —
  kein lokales Filesystem in Produktion) und über einen stabilen URL aufrufbar.

- **Given** Tom die Detailansicht einer Buchungsanfrage im Admin-Portal öffnet,
  **When** der Kunde mindestens eine Datei hochgeladen hat,
  **Then** sieht Tom eine Liste der Anhänge mit: Vorschaubild (bei Bildern),
  Dateiname, Dateigröße und einem Download-Link/Button — keine leere Sektion,
  kein Fehler.

- **Given** Tom die Detailansicht einer Buchungsanfrage öffnet, bei der kein
  Upload vorhanden ist,
  **When** die Seite lädt,
  **Then** erscheint der Hinweis „Keine Dateien hochgeladen" — kein leerer Bereich
  ohne Erklärung.

- **Given** ein Kunde eine Videodatei (MP4, max. 50 MB) hochlädt,
  **When** Tom die Detailansicht öffnet,
  **Then** wird die Videodatei mit einem direkten Download-Link angezeigt —
  eine Inline-Vorschau ist optional (Nice-to-Have), aber kein Pflichtkriterium.

**Upload-Limits (von Tom bestätigt):** Bilder (`image/*`) max. 10 MB, Videos
(`video/*`) max. 50 MB. Die Validierung erfolgt zweistufig: clientseitig mit
sofortigem Feedback im Formular (bevor der Upload startet) und serverseitig
mit HTTP 413 und einer deutschsprachigen Fehlermeldung, falls die Grenze
dennoch überschritten wird.

**Hinweis für den Architect:** Zuerst klären: Wurde der Datei-Upload in einer
früheren Iteration tatsächlich implementiert? Falls ja, welcher Storage-Provider
wird genutzt? Bei Vercel sind lokale Dateisystemschreibzugriffe nicht persistent
(nach Cold Start weg) — falls der Upload auf `/tmp` schreibt, ist das der Defekt.
Wahrscheinlichste Ursachen: (1) Storage-Provider nicht konfiguriert / ENV-Variable
fehlt, (2) Upload-Endpoint existiert nicht oder schlägt fehl (Vercel-Logs prüfen),
(3) Anzeige-Komponente in der Admin-Detailansicht fehlt oder hat einen Rendering-Fehler.

**Klassifikation:** Bug-Fix
**Priorität:** Must Have | **Story Points:** 5

---

#### US-IT11-05: Profildaten-Vorausfüllung im Buchungsformular — produktionsfähig machen (Bug-Fix)

> **Bug.** Eingeloggte Kunden müssen ihre Daten (Name, E-Mail, Telefon, Adresse)
> beim Buchen erneut eingeben, obwohl US-IT10-05 Teil B diese Funktion implementiert
> hat. Das QA-Review zu IT10 hat festgehalten, dass der Code korrekt ist und der
> `useCustomer()`-Hook die Profildaten lädt — das Problem liegt vermutlich in der
> Produktionsumgebung: die Datenbankmigrierung fehlt (identisch mit US-IT11-01),
> der Session-Aufruf schlägt fehl, oder `GET /api/customer/me` gibt in Prod keine
> Daten zurück.

**Als** eingeloggter Kunde
**möchte ich** beim Öffnen des Buchungsformulars meine hinterlegten Profildaten
automatisch vorausgefüllt sehen,
**damit** ich keine bereits bekannten Informationen erneut eingeben muss.

**Akzeptanzkriterien:**

- **Given** ich bin eingeloggt (NextAuth-Session aktiv) und öffne das
  Buchungsformular (auf `/buchen` oder über das Quick-Booking-Modal),
  **When** das Formular geladen ist,
  **Then** sind die Felder Vorname/Name, E-Mail, Telefon sowie — falls im Profil
  hinterlegt — Straße & Hausnummer, PLZ und Ort mit meinen gespeicherten
  Profildaten vorausgefüllt.

- **Given** der Solution Architect den Fehler-Pfad analysiert,
  **When** er `GET /api/customer/me` in der Produktionsumgebung mit einer aktiven
  Kunden-Session aufruft,
  **Then** gibt der Endpoint HTTP 200 mit den Profildaten zurück — kein 401,
  kein 500, keine leere Antwort. Falls die Antwort fehlerhaft ist, ist die Ursache
  (fehlende ENV, fehlende Migration, Session-Konfigurationsfehler) im PR dokumentiert.

- **Given** mein Konto hat keine Adresse hinterlegt,
  **When** das Buchungsformular lädt,
  **Then** sind Name, E-Mail und Telefon vorausgefüllt, die Adressfelder bleiben
  leer und der Hinweis „Adresse in Ihrem Profil hinterlegen" mit Link zu `/konto`
  ist sichtbar.

- **Given** ich ein vorausgefülltes Feld im Buchungsformular ändere und absende,
  **When** die Buchung gespeichert wird,
  **Then** wird der geänderte Formularwert für diese Buchung verwendet — meine
  Profildaten im Konto werden nicht überschrieben.

- **Given** ich nicht eingeloggt bin und das Buchungsformular öffne,
  **When** das Formular geladen ist,
  **Then** sind alle Felder leer — kein Vorausfüllen, kein Fehler.

**Hinweis für den Architect:** US-IT11-01 muss zuerst abgeschlossen sein (dieselbe
Datenbankmigrierung ist Vorbedingung). Dann prüfen: (1) Gibt `GET /api/customer/me`
in Prod HTTP 200 zurück — Network-Tab in DevTools nach Login prüfen. (2) Liefert
`useCustomer()` in `BookingClient.tsx` tatsächlich Daten oder `undefined`/`null`?
(3) Werden die `defaultValues` in `BookingForm.tsx` korrekt an React Hook Form
übergeben — Hydration-Reihenfolge prüfen. (4) Ist `NEXTAUTH_URL` in Vercel korrekt
gesetzt — NextAuth-Sessions funktionieren in Prod nur mit korrektem `NEXTAUTH_URL`.

**Klassifikation:** Bug-Fix (US-IT10-05 Teil B in Produktion nicht funktionsfähig)
**Priorität:** Must Have | **Story Points:** 3

---

#### US-IT11-06: Auftrag stornieren (Kundenseite) — Neues Feature

> **Neues Feature.** Kunden müssen Tom aktuell anrufen, wenn sie eine Buchungsanfrage
> zurückziehen möchten. Eine selbstständige Stornierungsmöglichkeit im Kunden-Dashboard
> reduziert den manuellen Aufwand auf beiden Seiten. Für Gast-Buchungen (ohne Login)
> erfolgt die Stornierung per signiertem Link aus der Bestätigungs-E-Mail.

**Als** eingeloggter Kunde
**möchte ich** meine eigene Buchungsanfrage stornieren können,
**damit** ich Tom nicht anrufen muss, wenn sich meine Pläne ändern.

**Akzeptanzkriterien:**

- **Given** ich bin eingeloggt und rufe mein Kunden-Dashboard unter `/konto` auf,
  **When** ich eine Buchungsanfrage mit Status „Offen" oder „Bestätigt" sehe,
  **Then** ist ein „Stornieren"-Button bei dieser Anfrage sichtbar — bei Status
  „Abgelehnt" oder „Storniert" ist kein Stornieren-Button vorhanden.

- **Given** ich auf den „Stornieren"-Button klicke,
  **When** der Button gedrückt wird,
  **Then** erscheint ein Bestätigungsdialog mit dem Text „Möchten Sie diese Anfrage
  wirklich stornieren?" und den Optionen „Ja, stornieren" und „Abbrechen" — die
  Stornierung wird erst nach Bestätigung ausgeführt.

- **Given** ich die Stornierung im Dialog bestätige,
  **When** die Stornierung serverseitig verarbeitet wird,
  **Then** wechselt der Status der Buchung auf „Storniert" und die Änderung ist
  sofort im Kunden-Dashboard sowie im Admin-Dashboard sichtbar — kein Seitenreload
  erforderlich.

- **Given** eine Buchung storniert wurde,
  **When** der Status auf „Storniert" wechselt,
  **Then** erhält Tom eine E-Mail-Benachrichtigung an `hausservice-baerenstark@outlook.com`
  mit Kundenname, Service, Datum und dem Hinweis „Storniert durch Kunden".

- **Given** eine Buchung mit einem zugewiesenen TimeSlot storniert wurde,
  **When** der Status auf „Storniert" wechselt,
  **Then** wird der zugehörige TimeSlot wieder als verfügbar markiert (Status
  `AVAILABLE`) und steht für neue Buchungen offen.

- **Given** ich bin nicht eingeloggt und habe eine Gast-Buchung getätigt,
  **When** ich die Bestätigungs-E-Mail öffne und auf den Stornieren-Link klicke,
  **Then** öffnet sich eine Bestätigungsseite mit dem Bestätigungsdialog — die
  Stornierung erfolgt über einen signierten Token in der URL.

- **Given** der signierte Stornierungstoken aus der Gast-E-Mail ist abgelaufen,
  **When** ich den Link aufrufe,
  **Then** erscheint eine freundliche Meldung: „Dieser Stornierungslink ist
  abgelaufen. Bitte rufen Sie uns an: 0157-74787512" — kein technischer Fehler,
  kein Stack-Trace.

- **Given** eine Buchung bereits den Status „Storniert" hat,
  **When** ein erneuter Stornierungsversuch (per API oder per Link) eingeht,
  **Then** gibt der Server HTTP 409 zurück und es werden keine weiteren
  Statusänderungen vorgenommen (Idempotenz).

**Hinweis für den Architect:** Storno-Endpoint: `PATCH /api/bookings/[id]/cancel`
oder `POST /api/bookings/[id]/cancel` — nach Konvention entscheiden. Gast-Storno-Token:
signierter JWT oder HMAC-Hash mit Buchungs-ID und Ablaufzeit; 30 Tage Gültigkeit
empfohlen (konsistent mit Bestätigungsseiten-Token aus US-IT11-03). Stornierung
durch den Kunden ist von einer Admin-seitigen Stornierung zu unterscheiden — diese
Story deckt ausschließlich die Kundenseite ab. Hängt von US-IT11-01 ab.

**Klassifikation:** Neues Feature
**Priorität:** Must Have | **Story Points:** 5

---

### Abhängigkeiten Iteration 11

- US-IT11-02 kann parallel zu US-IT11-01 entwickelt werden (reines Frontend).
- US-IT11-03 **hängt von US-IT11-01 ab** — ohne funktionierende Buchung in Prod
  kann das Erfolgs-Feedback nicht end-to-end getestet werden.
- US-IT11-05 **hängt von US-IT11-01 ab** — dieselbe Datenbankmigrierung und
  ENV-Konfiguration ist Vorbedingung.
- US-IT11-04 ist in der Diagnose unabhängig von US-IT11-01, für den End-to-End-Test
  (Upload nach erfolgreicher Buchung) ist US-IT11-01 aber Vorbedingung.
- US-IT11-06 **hängt von US-IT11-01 ab** — Buchungen müssen in Prod gespeichert
  werden, bevor eine Stornierung möglich ist.

### Empfohlene Bearbeitungsreihenfolge

1. **US-IT11-01** — Produktionskonfiguration reparieren (alle anderen Stories bauen
   darauf auf).
2. **US-IT11-02** — parallel zu US-IT11-01 (kein Backend-Eingriff nötig).
3. **US-IT11-03 + US-IT11-05** — nach US-IT11-01, können parallel laufen.
4. **US-IT11-04** — Diagnose sofort starten, End-to-End-Test nach US-IT11-01.
5. **US-IT11-06** — nach US-IT11-01; kann parallel zu US-IT11-03/05 entwickelt werden.
**Priorität:** Should Have | **Story Points:** 5
