# Iteration 4 — Kundenportal, Zahlungsabwicklung & Bewertungen

Iteration 4 führt das optionale Kundenportal mit Registrierung/Login ein und ermöglicht
Zahlungen über PayPal und Apple Pay. Diese Stories erfordern eine separate
Authentifizierungsebene und Payment-Integration und werden nach Abschluss von Iteration 3
ausgebaut.

Die Stories hier sind bewusst kürzer gehalten — sie werden vor Iterationsstart verfeinert.

## Vision-Kontext

Kunden, die regelmäßig Bärenstark nutzen, sollen ihre Auftragshistorie einsehen, Termine
eigenständig stornieren und Feedback geben können. Zahlungen laufen zukünftig direkt über
die Plattform. Iteration 4 verwandelt Bärenstark von einer Buchungs-Website in eine
vollständige Service-Plattform.

---

## Story: US-25 Kundenportal — Optionale Registrierung und Login

**Als** Kunde,
**möchte ich** optional ein Kundenkonto anlegen und mich einloggen können,
**damit** ich meine Aufträge und mein Profil zentral verwalten kann — ohne zur Buchung gezwungen zu sein.

### Akzeptanzkriterien
- [ ] Given ich befinde mich auf der Website, When ich auf „Mein Konto" klicke, Then kann ich mich registrieren (E-Mail + Passwort) oder einloggen.
- [ ] Given ich möchte keine Registrierung, When ich die Buchungsseite nutze, Then kann ich auch ohne Konto eine Anfrage stellen (Gastbuchung bleibt erhalten).
- [ ] Given ich registriere mich mit einer E-Mail-Adresse, When die Registrierung abgeschlossen ist, Then erhalte ich eine Bestätigungs-E-Mail zur Verifizierung.
- [ ] Given ich bin eingeloggt, When ich mein Profil aufrufe, Then kann ich Name, Telefonnummer und E-Mail-Adresse ändern.

### Notes
- Auth-Anbieter (Supabase Auth, NextAuth o.ä.) wird vom Architekten festgelegt.
- Passwort-Reset per E-Mail ist Pflicht.
- Social Login (Google) ist Could Have für diese Iteration.

### Story Points: 8
### Priorität: Must Have

---

## Story: US-26 Kundenportal — Auftragsübersicht

**Als** eingeloggter Kunde,
**möchte ich** alle meine Aufträge (vergangene und bevorstehende) in einer Übersicht sehen,
**damit** ich jederzeit den Status und die Details meiner Buchungen nachverfolgen kann.

### Akzeptanzkriterien
- [ ] Given ich bin eingeloggt und öffne „Meine Aufträge", When die Seite geladen ist, Then sehe ich alle meine Aufträge mit Datum, Service, Status und Gesamtbetrag — aufgeteilt in „Bevorstehend" und „Vergangen".
- [ ] Given ich klicke auf einen Auftrag, When die Detailseite geladen ist, Then sehe ich alle Buchungsdetails inklusive hochgeladener Dateien (falls vorhanden) und Zahlungsstatus.
- [ ] Given ich habe noch keine Aufträge, When ich die Seite aufrufe, Then erscheint eine Leer-Meldung mit CTA „Ersten Auftrag buchen".

### Notes
- Vergangene Gastbuchungen (ohne Konto) können nicht rückwirkend einem Konto zugeordnet werden — nur neue Buchungen nach Registrierung.

### Story Points: 5
### Priorität: Must Have

---

## Story: US-27 Kundenportal — Stornierung über Portal

**Als** eingeloggter Kunde,
**möchte ich** einen bevorstehenden Auftrag direkt im Portal stornieren können,
**damit** ich keine E-Mail mit Stornierungslink suchen muss.

### Akzeptanzkriterien
- [ ] Given ich befinde mich in meiner Auftragsübersicht und ein Termin liegt in der Zukunft, When ich auf „Stornieren" klicke, Then erscheint eine Bestätigungsabfrage.
- [ ] Given ich bestätige die Stornierung, When sie verarbeitet ist, Then wechselt der Status auf „storniert", Tom erhält eine Benachrichtigungs-E-Mail, und der Zeitslot wird wieder freigegeben.
- [ ] Given ein Termin liegt weniger als 24 Stunden in der Zukunft, When ich versuche zu stornieren, Then erscheint ein Hinweis auf die Stornierungsfrist und eine Empfehlung, Tom direkt zu kontaktieren.

### Notes
- Stornierungsfrist (24h) ist eine Annahme — Tom bestätigen.
- Ergänzt und erweitert US-14 (cancelToken-Mechanismus) für Portal-Nutzer.

### Story Points: 3
### Priorität: Must Have

---

## Story: US-28 Zahlungsabwicklung PayPal und Apple Pay

**Als** Kunde,
**möchte ich** nach Bestätigung meines Auftrags bequem per PayPal oder Apple Pay bezahlen können,
**damit** ich keine Banküberweisung durchführen muss und die Transaktion sicher und schnell abläuft.

### Akzeptanzkriterien
- [ ] Given mein Auftrag hat den Status „bestätigt" und ein Zahlungsbetrag ist hinterlegt, When ich den Auftrag im Portal öffne, Then sehe ich einen „Jetzt bezahlen"-Button mit PayPal- und Apple-Pay-Option.
- [ ] Given ich wähle PayPal, When der Zahlungsflow abgeschlossen ist, Then wechselt der Zahlungsstatus auf „bezahlt", Tom und ich erhalten eine Zahlungsbestätigung per E-Mail.
- [ ] Given ich wähle Apple Pay, When der Zahlungsflow abgeschlossen ist, Then gelten dieselben Bedingungen wie bei PayPal.
- [ ] Given eine Zahlung schlägt fehl, When der Fehler auftritt, Then sehe ich eine klare Fehlermeldung und kann es erneut versuchen.

### Notes
- Payment-Provider (Stripe mit PayPal/Apple Pay, oder direkte PayPal-API) wird vom Architekten festgelegt.
- Rechnungsstellung / PDF-Rechnung ist Could Have für diese Iteration.
- Betrag wird zunächst manuell von Tom im Admin-Portal hinterlegt — automatische Preisberechnung ist Backlog.

### Story Points: 8
### Priorität: Must Have

---

## Story: US-29 Kundenportal — Feedback und Bewertung abgeben

**Als** eingeloggter Kunde mit einem abgeschlossenen Auftrag,
**möchte ich** eine Bewertung (1–5 Sterne + Freitext) hinterlassen können,
**damit** andere Besucher von meiner Erfahrung profitieren und Tom Feedback bekommt.

### Akzeptanzkriterien
- [ ] Given mein Auftrag hat den Status „abgeschlossen", When ich die Auftragsdetails öffne, Then sehe ich einen „Bewertung abgeben"-Button.
- [ ] Given ich klicke auf „Bewertung abgeben", When das Formular erscheint, Then kann ich 1–5 Sterne und einen optionalen Freitext eingeben.
- [ ] Given ich schicke die Bewertung ab, When sie gespeichert wurde, Then erscheint sie in der Feedback-Sektion der Website (nach Admin-Freigabe oder automatisch — Tom entscheidet).
- [ ] Given ich habe für einen Auftrag bereits eine Bewertung abgegeben, When ich den Auftrag erneut aufrufe, Then ist der Bewertungs-Button deaktiviert und meine Bewertung wird angezeigt.

### Notes
- Admin-Freigabe vor Veröffentlichung ist Annahme — Tom bestätigen, ob er Bewertungen moderieren möchte.
- Datenstruktur muss kompatibel mit US-22 (Feedback-Sektion) sein.

### Story Points: 5
### Priorität: Must Have

---

## Dependencies

- US-26, US-27, US-29 hängen von US-25 ab (Login muss vorhanden sein).
- US-28 hängt von US-25 und US-26 ab (Zahlungsflow läuft über das Portal).
- US-29 hängt von US-26 ab (Bewertung wird an einen abgeschlossenen Auftrag geknüpft).

## Gesamtpunkte Iteration 4

| Story       | Titel                               | Punkte | Priorität    |
|-------------|-------------------------------------|--------|--------------|
| US-25       | Kundenportal Registrierung/Login    | 8      | Must Have    |
| US-26       | Kundenportal Auftragsübersicht      | 5      | Must Have    |
| US-27       | Kundenportal Stornierung            | 3      | Must Have    |
| US-28       | Zahlungsabwicklung PayPal/Apple Pay | 8      | Must Have    |
| US-29       | Kundenportal Feedback/Bewertung     | 5      | Must Have    |
| **Gesamt**  |                                     | **29** |              |

---

## Offene Fragen vor Iterationsstart

- Stornierungsfrist (US-27): 24 Stunden oder eine andere Frist?
- Bewertungsmoderation (US-29): Soll Tom Bewertungen vor Veröffentlichung freigeben?
- Zahlungsauslöser (US-28): Wann wird der Betrag fällig — bei Bestätigung, nach Erbringung oder auf Rechnung?
- Rechnungsstellung: Soll eine PDF-Rechnung generiert werden?
