# Iteration 4 — Kundenportal, Zahlungsabwicklung & Bewertungen

Iteration 4 führt das optionale Kundenportal mit Registrierung/Login ein und ermöglicht
Zahlungen über Stripe (PayPal, Apple Pay, Google Pay). Diese Stories erfordern eine
separate Kunden-Authentifizierungsebene (CustomerUser) und eine Payment-Integration und
werden nach Abschluss von Iteration 3 umgesetzt.

## Vision-Kontext

Kunden, die regelmäßig Bärenstark nutzen, sollen ihre Auftragshistorie einsehen, Termine
eigenständig stornieren, bezahlen und Feedback geben können. Iteration 4 verwandelt
Bärenstark von einer Buchungs-Website in eine vollständige Service-Plattform.

---

## Story: US-25 Kundenportal — Optionale Registrierung und Login

**Als** Kunde,
**möchte ich** optional ein Kundenkonto anlegen und mich einloggen können,
**damit** ich meine Aufträge zentral verwalten kann — ohne zur Buchung gezwungen zu sein.

### Akzeptanzkriterien

- [ ] **Given** ich rufe `/konto/registrieren` auf,
      **When** ich E-Mail-Adresse und Passwort eingebe (mind. 8 Zeichen) und auf „Konto erstellen" klicke,
      **Then** erhalte ich eine Bestätigungs-E-Mail mit Verifizierungslink und sehe den Hinweis „Bitte bestätigen Sie Ihre E-Mail-Adresse".

- [ ] **Given** ich klicke auf den Verifizierungslink in der E-Mail,
      **When** der Link gültig ist (max. 24 h),
      **Then** wird mein Konto aktiviert und ich werde automatisch zu `/konto` weitergeleitet.

- [ ] **Given** ich rufe `/konto/login` auf,
      **When** ich meine verifizierten Zugangsdaten eingebe und auf „Einloggen" klicke,
      **Then** werde ich zu `/konto` weitergeleitet und sehe meinen Namen in der Navigation.

- [ ] **Given** ich gebe beim Login falsche Zugangsdaten ein,
      **When** ich auf „Einloggen" klicke,
      **Then** erscheint die Fehlermeldung „E-Mail oder Passwort ungültig" — ohne Hinweis, welches Feld falsch ist.

- [ ] **Given** ich bin auf `/konto/login`,
      **When** ich auf „Passwort vergessen" klicke und meine E-Mail eingebe,
      **Then** erhalte ich innerhalb von 2 Minuten eine E-Mail mit einem Passwort-Reset-Link (gültig 1 Stunde).

- [ ] **Given** ich klicke auf den Passwort-Reset-Link,
      **When** ich ein neues Passwort (mind. 8 Zeichen) eingebe und bestätige,
      **Then** wird das Passwort geändert und ich werde zu `/konto/login` weitergeleitet.

- [ ] **Given** ich möchte keine Registrierung,
      **When** ich die Buchungsseite aufrufe und das Formular abschicke,
      **Then** funktioniert die Gastbuchung genau wie bisher — inklusive cancelToken per E-Mail.

- [ ] **Given** ich bin eingeloggt und buche einen neuen Auftrag,
      **When** das Formular abgeschickt wird,
      **Then** wird die neue Buchung automatisch meinem Kundenkonto (`CustomerUser`) zugeordnet.

- [ ] **Given** ich rufe eine geschützte Seite unter `/konto/*` auf, ohne eingeloggt zu sein,
      **When** die Seite geladen wird,
      **Then** werde ich zu `/konto/login` weitergeleitet mit dem Hinweis „Bitte einloggen".

- [ ] **Given** ich bin eingeloggt,
      **When** ich unter `/konto/profil` meinen Namen, meine Telefonnummer oder E-Mail-Adresse ändere und speichere,
      **Then** werden die Änderungen gespeichert und ich sehe eine Bestätigungsmeldung.

### Notes
- `CustomerUser` ist eine separate Entität vom Admin-User (`User`). Ein `CustomerUser` hat keinen Zugang zum Admin-Bereich.
- Auth-Anbieter (z.B. Supabase Auth, NextAuth) wird vom Architekten festgelegt.
- Social Login (Google) ist Could Have für spätere Iteration.
- Bestehende Gastbuchungen werden nicht rückwirkend einem Konto zugeordnet.

### Story Points: 8
### Priorität: Must Have

---

## Story: US-26 Kundenportal — Auftragsübersicht

**Als** eingeloggter Kunde,
**möchte ich** alle meine Aufträge in einer übersichtlichen Liste sehen,
**damit** ich Status, Datum und Details jederzeit nachverfolgen kann.

### Akzeptanzkriterien

- [ ] **Given** ich bin eingeloggt und rufe `/konto` auf,
      **When** die Seite geladen ist,
      **Then** sehe ich zwei Bereiche: „Bevorstehende Termine" (Datum >= heute) und „Vergangene Aufträge" (Datum < heute), jeweils chronologisch sortiert.

- [ ] **Given** ich sehe einen Eintrag in der Auftragsübersicht,
      **When** die Zeile angezeigt wird,
      **Then** enthält sie: Datum, Uhrzeit, Service, Status-Badge auf Deutsch und — sofern vom Admin hinterlegt — den Preis.

- [ ] **Given** Status-Badges werden angezeigt,
      **When** ein Auftrag verschiedene Zustände hat,
      **Then** lauten die Beschriftungen ausschließlich: „Offen" (PENDING), „Bestätigt" (CONFIRMED), „Abgelehnt" (REJECTED), „Storniert" (CANCELLED), „Gegenvorschlag ausstehend" (COUNTER_PROPOSED).

- [ ] **Given** ich klicke auf einen Auftrag,
      **When** die Detailseite geladen ist,
      **Then** sehe ich alle Buchungsdetails: Datum, Uhrzeit, Service, Beschreibung, hochgeladene Dateien (klickbare Links/Vorschaubilder), Status, Zahlungsstatus und ggf. hinterlegten Preis.

- [ ] **Given** ich habe noch keine Aufträge,
      **When** ich `/konto` aufrufe,
      **Then** erscheint die Meldung „Sie haben noch keine Aufträge" mit dem CTA-Button „Ersten Auftrag buchen".

- [ ] **Given** ich habe ausschließlich vergangene Aufträge,
      **When** die Seite geladen ist,
      **Then** bleibt der Bereich „Bevorstehende Termine" leer (oder ausgeblendet) und es erscheint ein entsprechender Hinweis.

### Notes
- Nur Buchungen, die nach Kontoerstellung dem `CustomerUser` zugeordnet wurden, erscheinen hier. Gastbuchungen bleiben unsichtbar.

### Story Points: 5
### Priorität: Must Have

---

## Story: US-27 Kundenportal — Stornierung über Portal

**Als** eingeloggter Kunde,
**möchte ich** einen bevorstehenden Auftrag direkt im Portal stornieren können,
**damit** ich keine E-Mail mit Stornierungslink suchen muss.

### Akzeptanzkriterien

- [ ] **Given** ich sehe in meiner Auftragsübersicht einen Auftrag mit Status „Offen" (PENDING) oder „Gegenvorschlag ausstehend" (COUNTER_PROPOSED),
      **When** ich auf „Stornieren" klicke,
      **Then** öffnet sich ein Bestätigungs-Dialog mit dem Text „Möchten Sie diesen Termin wirklich stornieren?" und den Optionen „Ja, stornieren" und „Abbrechen".

- [ ] **Given** der Confirm-Dialog ist offen und ich klicke auf „Ja, stornieren",
      **When** die Stornierung verarbeitet ist,
      **Then** ändert sich der Status-Badge sofort auf „Storniert", der „Stornieren"-Button verschwindet und Tom erhält eine Benachrichtigungs-E-Mail mit Name, Service und ursprünglichem Termin.

- [ ] **Given** ein Auftrag hat Status „Bestätigt" (CONFIRMED) und liegt mehr als 24 Stunden in der Zukunft,
      **When** ich auf „Stornieren" klicke und bestätige,
      **Then** wird der Auftrag storniert, der Zeitslot wird wieder freigegeben und Tom erhält eine Benachrichtigungs-E-Mail.

- [ ] **Given** ein bestätigter Auftrag liegt weniger als 24 Stunden in der Zukunft,
      **When** ich die Auftragsdetails aufrufe,
      **Then** ist der „Stornieren"-Button deaktiviert (ausgegraut) und ein Hinweis erscheint: „Stornierung nur bis 24 Stunden vor dem Termin möglich. Bitte kontaktieren Sie uns direkt: 0157-74787512."

- [ ] **Given** ein Auftrag hat Status „Abgelehnt", „Storniert" oder liegt in der Vergangenheit,
      **When** ich die Auftragsdetails aufrufe,
      **Then** ist kein „Stornieren"-Button sichtbar.

### Notes
- Stornierungsfrist 24 Stunden ist festgelegt — vom Projektinhaber bestätigt.
- Ergänzt US-14 (cancelToken-Mechanismus) für Portal-Nutzer. Beide Wege (E-Mail-Link und Portal) stornieren denselben Datensatz.
- Nach Stornierung wird der gebuchte Zeitslot in der öffentlichen Kalenderansicht wieder als verfügbar angezeigt.

### Story Points: 3
### Priorität: Must Have

---

## Story: US-28 Zahlungsabwicklung

**Als** Kunde,
**möchte ich** nach Bestätigung meines Auftrags bequem per PayPal, Apple Pay oder Google Pay bezahlen können,
**damit** ich keine Banküberweisung durchführen muss und die Transaktion sicher und schnell abläuft.

### Akzeptanzkriterien

- [ ] **Given** Tom hat einen Betrag für einen bestätigten Auftrag im Admin-Dashboard hinterlegt,
      **When** der Betrag gespeichert wird,
      **Then** erhält der Kunde automatisch eine E-Mail mit dem Betreff „Ihre Rechnung von Bärenstark Hausservice", dem fälligen Betrag und einem direkten Link zur Zahlungsseite `/konto/zahlung/:bookingId`.

- [ ] **Given** ich rufe `/konto/zahlung/:bookingId` auf (eingeloggt oder per E-Mail-Link),
      **When** die Seite geladen ist,
      **Then** sehe ich Auftragsdetails (Datum, Service), den fälligen Betrag und Zahlungsoptionen: PayPal, Apple Pay, Google Pay.

- [ ] **Given** ich wähle PayPal auf der Zahlungsseite,
      **When** ich auf „Mit PayPal bezahlen" klicke,
      **Then** öffnet sich der Stripe-Payment-Flow mit PayPal-Option und ich kann die Zahlung in meinem PayPal-Account abschließen.

- [ ] **Given** ich wähle Apple Pay auf einem kompatiblen Gerät,
      **When** ich auf „Mit Apple Pay bezahlen" klicke,
      **Then** öffnet sich der native Apple-Pay-Dialog und ich kann die Zahlung per Touch ID / Face ID bestätigen.

- [ ] **Given** ich wähle Google Pay auf einem kompatiblen Gerät,
      **When** ich auf „Mit Google Pay bezahlen" klicke,
      **Then** öffnet sich der Google-Pay-Dialog und ich kann die Zahlung bestätigen.

- [ ] **Given** eine Zahlung wurde erfolgreich abgeschlossen,
      **When** Stripe die Zahlung bestätigt (Webhook),
      **Then** ändert sich der Zahlungsstatus im Admin-Dashboard auf „Bezahlt", ich erhalte eine Zahlungsbestätigung per E-Mail und Tom erhält ebenfalls eine Benachrichtigung.

- [ ] **Given** eine Zahlung schlägt fehl (z.B. abgelehnte Karte, Abbruch),
      **When** der Fehler eintritt,
      **Then** sehe ich eine deutschsprachige Fehlermeldung und den „Jetzt bezahlen"-Button bleibt aktiv für einen erneuten Versuch.

- [ ] **Given** Tom öffnet im Admin-Dashboard eine bestätigte Buchung,
      **When** er einen Betrag einträgt und speichert,
      **Then** wird der Betrag in der Buchung gespeichert und der Zahlungslink ist aktiv.

- [ ] **Given** der Zahlungsstatus einer Buchung ist „Bezahlt",
      **When** ich die Auftragsdetails im Kundenportal öffne,
      **Then** sehe ich den Badge „Bezahlt" und den bezahlten Betrag. Der „Jetzt bezahlen"-Button ist nicht mehr sichtbar.

### Notes
- Empfohlener Zahlungs-Stack: **Stripe** — unterstützt PayPal, Apple Pay und Google Pay über eine einzige Integration (Stripe Payment Element). Diese Entscheidung erspart separate PayPal-API-Integration und vereinheitlicht Webhook-Handling.
- Betrag wird manuell von Tom nach Terminbestätigung hinterlegt — automatische Preisberechnung ist Backlog.
- Rechnungsstellung als PDF ist Could Have für spätere Iteration.
- Rückerstattungen werden vorerst manuell über das Stripe-Dashboard abgewickelt.
- Apple Pay und Google Pay sind nur auf kompatiblen Geräten/Browsern sichtbar (progressive enhancement).

### Story Points: 8
### Priorität: Must Have

---

## Story: US-29 Kundenbewertungen (echtes Backend)

**Als** eingeloggter Kunde mit einem abgeschlossenen Auftrag,
**möchte ich** eine Bewertung (1–5 Sterne + optionaler Text) hinterlassen können,
**damit** andere Besucher von meiner Erfahrung profitieren und Tom Feedback erhält.

### Akzeptanzkriterien

- [ ] **Given** mein Auftrag hat den Status „Abgeschlossen" (COMPLETED),
      **When** ich die Auftragsdetails in meinem Portal öffne,
      **Then** sehe ich den Button „Bewertung abgeben".

- [ ] **Given** ich klicke auf „Bewertung abgeben",
      **When** das Bewertungsformular erscheint,
      **Then** kann ich 1–5 Sterne auswählen (Pflicht) und einen optionalen Freitext eingeben (max. 500 Zeichen). Ein Zeichenzähler zeigt verbleibende Zeichen an.

- [ ] **Given** ich wähle weniger als 1 Stern oder versuche die Bewertung ohne Sternauswahl abzuschicken,
      **When** ich auf „Absenden" klicke,
      **Then** erscheint die Fehlermeldung „Bitte wählen Sie eine Sternebewertung" und das Formular wird nicht abgeschickt.

- [ ] **Given** ich schicke eine gültige Bewertung ab,
      **When** sie gespeichert wurde,
      **Then** sehe ich die Bestätigung „Vielen Dank für Ihre Bewertung! Sie wird nach Freigabe veröffentlicht." und der Button „Bewertung abgeben" ist deaktiviert.

- [ ] **Given** ich habe für einen Auftrag bereits eine Bewertung abgegeben,
      **When** ich den Auftrag erneut öffne,
      **Then** ist der Bewertungs-Button deaktiviert und meine abgegebene Bewertung (Sterne + Text) wird schreibgeschützt angezeigt.

- [ ] **Given** Tom öffnet im Admin-Bereich die Bewertungsverwaltung,
      **When** eine neue Bewertung vorliegt,
      **Then** sieht er Kundename (oder Alias), Sternebewertung, Freitext, zugehöriger Service und kann „Freigeben" oder „Ablehnen" klicken.

- [ ] **Given** Tom gibt eine Bewertung frei,
      **When** die Freigabe gespeichert wird,
      **Then** erscheint die Bewertung auf der Startseite in der Feedback-Sektion (US-22) mit Kundename, Service, Sternebewertung und Text.

- [ ] **Given** Tom lehnt eine Bewertung ab,
      **When** die Ablehnung gespeichert wird,
      **Then** bleibt die Bewertung unsichtbar auf der Startseite. Der Status im Admin zeigt „Abgelehnt".

- [ ] **Given** genug echte Bewertungen (mind. 4 freigegebene) vorhanden sind,
      **When** die Feedback-Sektion auf der Startseite geladen wird,
      **Then** werden ausschließlich echte Bewertungen angezeigt — die simulierten Platzhalter aus Iteration 3 (US-22) werden ersetzt.

- [ ] **Given** weniger als 4 echte Bewertungen freigegeben sind,
      **When** die Feedback-Sektion geladen wird,
      **Then** werden die Platzhalter aus IT3 weiterhin angezeigt, bis der Schwellenwert erreicht ist.

### Notes
- Admin-Freigabe vor Veröffentlichung ist Pflicht (kein automatisches Publish).
- Datenstruktur muss kompatibel mit US-22 (Feedback-Sektion, IT3) sein — gleiche Rendering-Komponente, unterschiedliche Datenquelle.
- Kundename wird so angezeigt, wie er im `CustomerUser`-Profil hinterlegt ist.

### Story Points: 5
### Priorität: Must Have

---

## Dependencies

- US-26 hängt von US-25 ab (Login muss vorhanden sein).
- US-27 hängt von US-25 und US-26 ab (Stornierung erfolgt über die Auftragsübersicht).
- US-28 hängt von US-25 und US-26 ab (Zahlungsflow läuft über das Portal / per E-Mail-Link).
- US-29 hängt von US-25 und US-26 ab (Bewertung wird an einen abgeschlossenen Auftrag geknüpft).
- US-29 ist abhängig von US-22 (IT3): gleiche Feedback-Sektion, Datenstruktur muss kompatibel sein.

---

## Gesamtpunkte Iteration 4

| Story      | Titel                               | Punkte | Priorität  |
|------------|-------------------------------------|--------|------------|
| US-25      | Kundenportal Registrierung/Login    | 8      | Must Have  |
| US-26      | Kundenportal Auftragsübersicht      | 5      | Must Have  |
| US-27      | Kundenportal Stornierung            | 3      | Must Have  |
| US-28      | Zahlungsabwicklung                  | 8      | Must Have  |
| US-29      | Kundenbewertungen (echtes Backend)  | 5      | Must Have  |
| **Gesamt** |                                     | **29** |            |

---

## Entschiedene Punkte (keine offenen Fragen mehr)

- **Zahlungs-Stack:** Stripe wird eingesetzt. Unterstützt PayPal, Apple Pay und Google Pay über eine einzige Integration — kein separater PayPal-API-Account nötig.
- **Kunden-Auth:** Separate `CustomerUser`-Entität, vollständig getrennt vom Admin-`User`. Kunden haben keinen Zugang zum Admin-Bereich.
- **Daten-Verknüpfung:** Bestehende Gastbuchungen bleiben unverändert. Nur neue Buchungen von eingeloggten Kunden werden dem Konto zugeordnet.
- **Stornierungsfrist:** 24 Stunden vor dem Termin. Bestätigt.
- **Bewertungsmoderation:** Tom gibt Bewertungen manuell frei, bevor sie auf der Startseite erscheinen. Bestätigt.
- **Zahlungsauslöser:** Betrag wird von Tom manuell nach Terminbestätigung hinterlegt. Fälligkeit: sofort nach Betrag-Hinterlegung (E-Mail-Aufforderung wird ausgelöst).
