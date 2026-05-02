# Iteration 3 — Buchungsverbesserungen, Preise, Inhalte & Admin-Dashboard

Fortlaufende Verbesserungen auf Basis von Toms Feedback nach Iteration 2.
Schwerpunkte: stabiler Buchungsflow, reichhaltigeres Formular, Preistransparenz,
Service-Präsentation, Admin-Tagesübersicht und E-Mail-Kommunikation mit Kunden.

Kein Zahlungssystem, kein Kundenportal mit Login — das folgt in Iteration 4.

## Vision-Kontext

Nach Iteration 2 funktioniert der Kalender und die Wochentag-Verfügbarkeit ist eingebaut.
Iteration 3 stabilisiert den Buchungsflow technisch (Bug), erweitert das Formular um Upload
und individuelle Serviceoption, macht Preise für Besucher sichtbar, gibt Tom eine schnelle
Tagesübersicht und verbessert die Kundenkommunikation per E-Mail — alles ohne neue
Authentifizierungsebenen einzuführen.

---

## Stakeholder

| Rolle         | Beschreibung                                              |
|---------------|-----------------------------------------------------------|
| Kunde         | Besucher der Website, der einen Service buchen möchte     |
| Admin (Tom)   | Inhaber, verwaltet Verfügbarkeit und Anfragen             |
| E-Mail-System | Transaktionaler E-Mail-Versand (z.B. Resend / SMTP)       |

---

## BUG: Buchungsformular-Übermittlung schlägt fehl

**Beschreibung:** Das Absenden des Buchungsformulars schlägt serverseitig fehl — Anfragen
erscheinen nicht im Admin-Portal, Tom erhält keine Benachrichtigungs-E-Mail und der Kunde
bekommt keine Rückmeldung über Erfolg oder Misserfolg.

**Erwartetes Verhalten:**
- Nach erfolgreichem Absenden: Erfolgsmeldung im Browser, Eintrag im Admin-Portal, E-Mail an Tom.
- Bei Serverfehler: klar lesbare Fehlermeldung im Formular mit Hinweis, es erneut zu versuchen oder Tom direkt zu kontaktieren.

**Akzeptanzkriterien:**
- [ ] Given das Formular ist vollständig ausgefüllt, When der Nutzer auf „Absenden" klickt, Then wird die Anfrage in der Datenbank gespeichert und erscheint im Admin-Portal.
- [ ] Given die Anfrage wurde gespeichert, When die Verarbeitung abgeschlossen ist, Then erhält Tom eine Benachrichtigungs-E-Mail (US-08-Verhalten).
- [ ] Given ein Serverfehler tritt auf, When das Formular abgeschickt wird, Then sieht der Nutzer eine deutliche, deutschsprachige Fehlermeldung — kein stilles Scheitern.
- [ ] Given das Formular wurde erfolgreich abgeschickt, When die Antwort zurückkommt, Then wird dem Nutzer eine sichtbare Erfolgsmeldung angezeigt (Toast oder Inline-Banner).

**Priorität:** Blocker — muss als erstes behoben werden.

---

## Story: US-17 Zeitfenster-Redesign — Verfügbarkeitsfenster mit Default-Vorlage

**Als** Admin (Tom),
**möchte ich** pro Wochentag ein Verfügbarkeitsfenster (Von/Bis-Uhrzeit) definieren und eine Default-Vorlage auf alle Tage anwenden,
**damit** Kunden innerhalb dieser Fenster einen konkreten Wunschtermin auswählen können, ohne dass ich jeden einzelnen Slot manuell anlegen muss.

### Akzeptanzkriterien
- [ ] Given ich bin im Admin-Bereich unter „Verfügbarkeit", When ich eine Default-Vorlage (z.B. Mo–Fr 08:00–17:00) definiere und auf „Auf alle Tage anwenden" klicke, Then werden alle sieben Wochentage mit diesem Zeitfenster befüllt.
- [ ] Given die Default-Vorlage wurde angewendet, When ich einen einzelnen Wochentag (z.B. Samstag) manuell auf 09:00–13:00 ändere, Then überschreibt die individuelle Einstellung die Default-Vorlage nur für diesen Tag; die anderen Tage bleiben unberührt.
- [ ] Given ich setze einen Wochentag auf „nicht verfügbar", When ein Kunde den Kalender aufruft, Then ist dieser Wochentag durchgängig nicht buchbar (keine Uhrzeitauswahl möglich).
- [ ] Given ich habe Fenster für Mo–Fr 08:00–17:00 gesetzt, When ein Kunde einen verfügbaren Tag auswählt, Then kann er im Buchungsformular eine Uhrzeit innerhalb dieses Fensters in 30-Minuten-Schritten wählen.
- [ ] Given ich speichere eine Änderung am Verfügbarkeitsfenster, When die Speicherung abgeschlossen ist, Then ist die Änderung innerhalb von Sekunden in der öffentlichen Kalenderansicht sichtbar.
- [ ] Given Iteration-2-Daten existieren (Wochentag-Flags aus US-15), When das neue Modell aktiviert wird, Then bleiben bestehende „verfügbar/nicht verfügbar"-Einstellungen erhalten; lediglich die Von/Bis-Felder werden neu hinzugefügt (kein Datenverlust).

### Notes
- Ersetzt das bisherige manuelle Slot-Modell aus US-05. US-05 bleibt als Referenz erhalten, ist aber durch dieses Modell abgelöst.
- 30-Minuten-Schritte sind Annahme — Tom kann das finale Intervall bestätigen oder anpassen.
- Zeitzone: Europe/Berlin durchgängig verwenden.

### Story Points: 5
### Priorität: Must Have

---

## Story: US-18 Datei-Upload im Buchungsformular

**Als** Kunde,
**möchte ich** beim Ausfüllen der Buchungsanfrage Fotos, Videos oder Dokumente hochladen können,
**damit** Tom meine Situation besser einschätzen kann, bevor er den Termin bestätigt.

### Akzeptanzkriterien
- [ ] Given ich befinde mich im Buchungsformular, When ich auf „Dateien hinzufügen" klicke, Then öffnet sich ein Datei-Dialog, in dem ich Bilder (jpg, png, webp), Videos (mp4, mov) und Dokumente (pdf) auswählen kann.
- [ ] Given ich habe Dateien ausgewählt, When sie hochgeladen sind, Then sehe ich eine Liste der hochgeladenen Dateien mit Dateiname und Dateigröße sowie die Option, einzelne Dateien wieder zu entfernen.
- [ ] Given eine einzelne Datei überschreitet 20 MB, When ich sie auswähle, Then erscheint eine Fehlermeldung „Datei zu groß (max. 20 MB)" und die Datei wird nicht hochgeladen.
- [ ] Given die Gesamtgröße aller Uploads überschreitet 50 MB, When der Nutzer versucht eine weitere Datei hinzuzufügen, Then erscheint eine Meldung, dass das Gesamtlimit erreicht ist.
- [ ] Given Dateien wurden hochgeladen und die Anfrage wird abgeschickt, When Tom die Anfrage im Admin-Portal öffnet, Then sieht er die hochgeladenen Dateien als klickbare Links oder Vorschaubilder.
- [ ] Given ein Nutzer schickt das Formular ohne Upload ab, When die Pflichtfelder ausgefüllt sind, Then wird die Anfrage ohne Anhänge problemlos übermittelt (Upload ist optional).

### Notes
- Speicherort: Cloud-Storage (z.B. Supabase Storage oder S3-kompatibel). Konkrete Wahl liegt beim Architekten.
- Maximale Dateianzahl: 5 Dateien pro Anfrage (Annahme — Tom bestätigen).
- Dateien werden nicht in der Bestätigungs-E-Mail angehängt, sondern nur über das Admin-Portal zugänglich gemacht (wegen E-Mail-Größenbeschränkungen).

### Story Points: 5
### Priorität: Must Have

---

## Story: US-19 Individuelle Serviceanfrage als Formulároption

**Als** Kunde,
**möchte ich** im Buchungsformular „Sonstige / Individuelle Anfrage" als Service-Option auswählen können,
**damit** ich auch für nicht gelistete Leistungen unkompliziert anfragen kann.

### Akzeptanzkriterien
- [ ] Given ich öffne das Buchungsformular und wähle den Service, When ich die Dropdown-Liste aufklappe, Then erscheint „Sonstige / Individuelle Anfrage" als letzter Eintrag.
- [ ] Given ich wähle „Sonstige / Individuelle Anfrage", When die Auswahl getroffen ist, Then erscheint ein Freitextfeld „Beschreiben Sie Ihr Anliegen" als Pflichtfeld.
- [ ] Given ich habe einen der Standard-Services gewählt, When das Formular angezeigt wird, Then bleibt das Freitextfeld optional (bereits als „Beschreibung" vorhanden) — kein neues Pflichtfeld.
- [ ] Given die individuelle Anfrage wurde abgeschickt, When Tom die Anfrage im Admin-Portal sieht, Then wird der Service als „Sonstige / Individuelle Anfrage" angezeigt mit dem Freitext in einem eigenen Feld sichtbar.

### Notes
- Der Freitext für individuelle Anfragen wird bei Standard-Services als optionales Beschreibungsfeld behandelt — nur bei „Sonstige" ist er Pflichtfeld.

### Story Points: 2
### Priorität: Must Have

---

## Story: US-20 Preise für Serviceleistungen anzeigen

**Als** Besucher,
**möchte ich** Richtwerte für die Stundensätze der einzelnen Services sehen,
**damit** ich vor einer Anfrage eine erste Preiseinschätzung erhalten und entscheiden kann, ob Bärenstark in mein Budget passt.

### Akzeptanzkriterien
- [ ] Given ich befinde mich auf der Startseite oder der Services-Sektion, When ich die Service-Karten betrachte, Then sehe ich bei jedem Service einen Richtpreis-Hinweis (z.B. „ab 35 €/h").
- [ ] Given ich lese den Preishinweis, When ich ihn anklicke oder darüber hovere (Desktop), Then erscheint ein kurzer Tooltip oder Hinweistext: „Richtpreis für die Region Darmstadt. Finale Preise nach Besichtigung / auf Anfrage."
- [ ] Given folgende Richtwerte sind implementiert: Entrümpelungen ab 35 €/h, Entkernungsarbeiten ab 45 €/h, Reinigungsarbeiten ab 25 €/h, Grünflächenpflege ab 30 €/h, Mülltonnenservice ab 20 €/h, Entsorgung Schrott/Metalle ab 40 €/h (alternativ: nach Gewicht/Vereinbarung), When die Seite geladen ist, Then stimmen alle angezeigten Preise mit diesen Vorgaben überein.
- [ ] Given ich nutze ein Smartphone, When ich die Preisanzeige sehe, Then sind die Preise ohne Tooltip zugänglich (z.B. als permanenter Hinweistext unter dem Stundensatz).

### Notes
- Preise sind Richtwerte — Disclaimer „Richtpreise, finale Preisvereinbarung nach Besichtigung/Anfrage" ist zwingend auf der Seite anzuzeigen.
- Entsorgung Schrott/Metalle kann als „ab 40 €/h oder nach Gewicht" dargestellt werden.
- Tom muss finale Preise vor Go-Live freigeben — diese Story gilt als abgeschlossen, sobald die Richtwerte live sind.

### Story Points: 3
### Priorität: Must Have

---

## Story: US-21 Admin-Dashboard — Übersicht bevorstehende Termine

**Als** Admin (Tom),
**möchte ich** auf einen Blick alle bevorstehenden bestätigten Termine chronologisch sehen,
**damit** ich meinen Arbeitstag planen kann, ohne jeden Eintrag einzeln aufrufen zu müssen.

### Akzeptanzkriterien
- [ ] Given ich bin eingeloggt und öffne das Admin-Dashboard, When die Seite geladen ist, Then sehe ich eine chronologisch sortierte Liste aller Termine mit Status „bestätigt", die in der Zukunft liegen — mit Datum, Uhrzeit, Kundenname und Service.
- [ ] Given ich befinde mich auf dem Dashboard, When heute Termine anstehen, Then sind diese visuell hervorgehoben (z.B. „Heute" als Label oder farblicher Akzent).
- [ ] Given es gibt keine bevorstehenden Termine, When das Dashboard geladen ist, Then erscheint eine freundliche Leer-Meldung (z.B. „Keine bevorstehenden Termine").
- [ ] Given ich klicke auf einen Termin in der Liste, When ich den Eintrag öffne, Then navigiere ich zur vollständigen Anfrage-Detailseite.
- [ ] Given eine neue Anfrage eingeht oder ein Status sich ändert, When ich das Dashboard neu lade, Then ist die Liste aktuell und zeigt den neuesten Stand.

### Notes
- „Bevorstehend" = Datum liegt ab heute (inklusive heute).
- Vergangene Termine werden im Dashboard nicht angezeigt — sie sind nur in der Anfragen-Gesamtliste abrufbar.
- Keine Echtzeit-Updates via WebSocket nötig — normales Laden/Neuladen reicht für MVP.

### Story Points: 3
### Priorität: Must Have

---

## Story: US-22 Feedback-Sektion mit Kundenbewertungen

**Als** Besucher,
**möchte ich** echte (oder repräsentative) Kundenbewertungen mit Sternebewertung lesen,
**damit** ich Vertrauen in Bärenstark aufbaue, bevor ich eine Anfrage stelle.

### Akzeptanzkriterien
- [ ] Given ich befinde mich auf der Startseite, When ich zur Feedback-Sektion scrolle, Then sehe ich mindestens 10 Bewertungen mit je: Kundename (oder Initial), Service, Bewertungstext und Sternebewertung (1–5 Sterne visuell als Sterne-Symbole).
- [ ] Given die Beispieldaten eingebaut sind, When ich die Sektion aufrufe, Then liegt die Durchschnittsbewertung bei 4 von 5 Sternen und dies ist sichtbar (Gesamt-Durchschnitt sichtbar über der Sektion).
- [ ] Given mehr als 10 Bewertungen vorhanden sind, When die Sektion geladen ist, Then werden initial maximal 4–6 Bewertungen angezeigt mit einem „Mehr anzeigen"-Button.
- [ ] Given ich nutze ein Smartphone, When ich die Feedback-Sektion aufrufe, Then ist sie als horizontal scrollbares Karussell oder vertikal gestapelt vollständig lesbar.
- [ ] Given zukünftig echte Bewertungen über das Kundenportal eingehen (US-29), When sie freigeschaltet werden, Then können sie die Beispieldaten ersetzen oder ergänzen — die Datenstruktur muss kompatibel sein.

### Notes
- Für Iteration 3: 10 statische Beispieldaten mit realistischen deutschen Texten, Vornamen und Servicebezug.
- Durchschnitt von 4/5 Sternen ist Vorgabe aus Toms Feedback.
- US-10 (Backlog) wird durch diese Story ersetzt/erfüllt — US-10 kann als abgeschlossen markiert werden.

### Story Points: 3
### Priorität: Must Have

---

## Story: US-23 Service-Popups mit Vorher/Nachher-Darstellung

**Als** Besucher,
**möchte ich** bei jedem Service ein interaktives Popup öffnen können, das mir Vorher/Nachher-Beispiele und eine detaillierte Leistungsbeschreibung zeigt,
**damit** ich besser verstehe, was mich bei Bärenstark erwartet, und schneller Vertrauen aufbaue.

### Akzeptanzkriterien
- [ ] Given ich befinde mich auf der Service-Übersicht, When ich auf eine Service-Karte oder einen „Mehr erfahren"-Button klicke, Then öffnet sich ein Modal/Popup mit dem Namen des Services, einer ausführlichen Beschreibung, mindestens einem Vorher-Nachher-Bildpaar (oder Platzhalter-Illustration) und einem CTA-Button „Jetzt anfragen".
- [ ] Given das Popup geöffnet ist, When ich auf das X klicke, auf den Hintergrund klicke oder die Escape-Taste drücke, Then schließt sich das Popup und ich kehre zur ursprünglichen Seite zurück.
- [ ] Given das Popup geöffnet ist und ich auf „Jetzt anfragen" klicke, When der Klick verarbeitet wird, Then schließt sich das Popup und das Buchungsformular öffnet sich mit dem entsprechenden Service vorausgewählt.
- [ ] Given ich nutze ein Smartphone, When das Popup geöffnet ist, Then ist es vollständig im sichtbaren Bereich (kein Overflow), scrollbar und schließbar per Swipe oder X-Button.
- [ ] Given das Design des Popups ist implementiert, When ich es betrachte, Then verwendet es Braun/Beige/Holz-Töne passend zum Bärenstark-Layout und wirkt hochwertig (z.B. weiche Schatten, Animationsübergang beim Öffnen/Schließen).
- [ ] Given sechs Services existieren, When die Iteration abgeschlossen ist, Then hat jeder Service ein eigenes Popup mit individuellem Inhalt.

### Notes
- Vorher/Nachher-Bilder: Für Iteration 3 sind qualitativ passende Platzhalter-Bilder (oder Stock-Fotos) akzeptabel. Tom liefert echte Fotos nach.
- Vorher/Nachher-Darstellung kann als einfacher Side-by-Side-Vergleich oder als Slider umgesetzt werden — Wahl liegt beim Entwickler, muss aber mobiltauglich sein.
- Der Popup-Inhalt (Texte) wird initial vom Entwickler auf Basis der bestehenden Service-Beschreibungen verfasst.

### Story Points: 5
### Priorität: Must Have

---

## Story: US-24 Bestätigungs- und Storno-E-Mail an Kunden (ohne Portal)

**Als** Kunde,
**möchte ich** nach jeder relevanten Statusänderung meiner Buchungsanfrage eine E-Mail erhalten — mit Eingangsbestätigung, Terminbestätigung durch Tom und einem Link zur Stornierung —,
**damit** ich jederzeit informiert bin und meine Anfrage ohne Kundenportal verwalten kann.

### Akzeptanzkriterien
- [ ] Given ich habe eine Buchungsanfrage mit E-Mail-Adresse abgeschickt, When das Formular erfolgreich verarbeitet wurde, Then erhalte ich innerhalb von Sekunden eine Eingangsbestätigungs-E-Mail mit: Zusammenfassung meiner Anfrage (Datum, Uhrzeit, Service, Name), Hinweis dass Tom sich meldet, und einem Link zum Stornieren der Anfrage (cancelToken).
- [ ] Given Tom hat eine Anfrage im Admin-Portal als „bestätigt" markiert, When die Statusänderung gespeichert wird, Then erhalte ich eine Terminbestätigungs-E-Mail mit: bestätigtem Datum und Uhrzeit, Service, Kontaktdaten von Tom und dem Stornierungslink.
- [ ] Given Tom hat eine Anfrage als „abgelehnt" markiert, When die Statusänderung gespeichert wird, Then erhalte ich eine E-Mail mit der Mitteilung, dass der gewünschte Termin leider nicht möglich ist, und dem Hinweis, eine neue Anfrage zu stellen.
- [ ] Given ich erhalte eine E-Mail mit dem Stornierungslink, When ich auf den Link klicke, Then lande ich auf einer Seite, auf der mir die Stornierung angezeigt und nach Bestätigung ausgeführt wird (Verknüpfung mit US-14-cancelToken-Mechanismus).
- [ ] Given der cancelToken wurde bereits verwendet, When ich den Stornierungslink erneut aufrufe, Then erscheint eine freundliche Hinweisseite „Dieser Link ist nicht mehr gültig."
- [ ] Given alle E-Mails werden versendet, When ich sie erhalte, Then sind sie auf Deutsch, haben den Absender „Bärenstark Hausservice" und enthalten im Footer Toms Kontaktdaten.

### Notes
- Verbindet und schließt US-11 (Backlog: Bestätigungs-E-Mail) ab — US-11 kann als erfüllt markiert werden.
- Ergänzt US-14 (Stornierung per cancelToken): der Token-Mechanismus existiert bereits, die Bestätigungs-Mail mit eingebettetem Link fehlte bisher.
- E-Mail-Templates müssen zum Bärenstark-Branding (Braun/Beige) passen.

### Story Points: 5
### Priorität: Must Have

---

## Dependencies

- US-17 hängt von der Behebung des Buchungsformular-Bugs ab (neues Zeitmodell nur sinnvoll, wenn Übermittlung funktioniert).
- US-18 hängt vom Buchungsformular-Bug-Fix ab (Upload wird mit der Anfrage übermittelt).
- US-19 hängt vom Buchungsformular-Bug-Fix ab.
- US-24 hängt vom Buchungsformular-Bug-Fix ab (Eingangsbestätigung setzt funktionierende Übermittlung voraus).
- US-21 hängt von US-17 ab (Termine mit Von/Bis-Fenster müssen vorhanden sein, um sinnvoll angezeigt zu werden).
- US-24 ergänzt US-14 — cancelToken-Mechanismus muss aus IT2 stabil sein.

## Gesamtpunkte Iteration 3

| Story       | Titel                                      | Punkte | Priorität    |
|-------------|--------------------------------------------|--------|--------------|
| BUG         | Buchungsformular-Übermittlung              | —      | Blocker      |
| US-17       | Zeitfenster-Redesign                       | 5      | Must Have    |
| US-18       | Datei-Upload im Buchungsformular           | 5      | Must Have    |
| US-19       | Individuelle Serviceanfrage                | 2      | Must Have    |
| US-20       | Preise für Serviceleistungen               | 3      | Must Have    |
| US-21       | Admin-Dashboard Terminübersicht            | 3      | Must Have    |
| US-22       | Feedback-Sektion mit Bewertungen           | 3      | Must Have    |
| US-23       | Service-Popups Vorher/Nachher              | 5      | Must Have    |
| US-24       | Bestätigungs- und Storno-E-Mail            | 5      | Must Have    |
| **Gesamt**  |                                            | **31** |              |
