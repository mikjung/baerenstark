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

### Iteration 2 (aktuell)

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
| BUG US-04  | Buchungsanfrage absenden schlägt fehl         | Blocker      | Iteration 2 (aktuell)                |
| US-13      | Alternativtermin vorschlagen (Admin)          | Must Have    | Iteration 2 (aktuell)                |
| US-14      | Anfrage stornieren (Kunde)                    | Must Have    | Iteration 2 (aktuell)                |
| US-15      | Wochentag-basierte Verfügbarkeit (Admin)      | Must Have    | Iteration 2 (aktuell)                |
| US-16      | Kalenderansicht für Kunden                    | Must Have    | Iteration 2 (aktuell)                |
| US-09      | Instagram-Feed einbinden                      | Should Have  | Backlog                              |
| US-10      | Kundenbewertungen anzeigen                    | Should Have  | Backlog                              |
| US-11      | Bestätigungs-E-Mail an Kunden                 | Should Have  | Backlog                              |

---

## Annahmen

- Das Admin-Interface ist eine einfache, passwortgeschützte Web-Oberfläche (keine nativen Apps).
- Die Buchungsanfrage erfordert keine sofortige automatische Bestätigung — Tom prüft und antwortet manuell (US-11 im Backlog).
- Zahlungsabwicklung ist nicht Teil des Scopes (Abrechnung offline).
- Das Impressum wird inhaltlich von Tom geliefert; technisch ist es eine statische Unterseite.
- Instagram-Verlinkung im Footer ist MVP; ein eingebetteter Feed (US-09) ist Backlog.
