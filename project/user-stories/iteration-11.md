# EPIC-IT11: Iteration 11 — Produktions-Stabilisierung & UX-Konsolidierung

Alle kritischen Bugs aus Tom's Feedback nach Iteration 10 beheben und den
Buchungsweg auf einen einzigen, klaren Einstiegspunkt konsolidieren.

## Vision context

Nach zehn Iterationen ist die Kernfunktionalität code-seitig vollständig
implementiert, aber in Produktion blockieren Konfigurationslücken (fehlende
ENV-Variablen, ausstehende Datenbankmigrierung) und zwei bisher nicht adressierte
Defekte (Datei-Upload-Anzeige, UX-Fragmentierung) den produktiven Betrieb.
Iteration 11 macht das System produktionsfähig: Buchungen funktionieren
end-to-end, Kunden bekommen Feedback, Tom sieht Anhänge, und der Buchungsweg
ist auf einen klaren Einstiegspunkt reduziert.

---

## Story: US-IT11-01 — Buchung end-to-end zum Laufen bringen

**Als** Kunde,
**möchte ich** eine Buchungsanfrage erfolgreich absenden können,
**so dass** Tom meine Anfrage erhält und ich eine Bestätigung bekomme.

### Hintergrund

Das QA-Review IT10 stellte fest: Code ist korrekt, aber `prisma migrate deploy`
gegen Prod-DB fehlt (führt zu `P2022 Column does not exist` bei jedem
Booking-POST) und Pflicht-ENV-Variablen in Vercel sind nicht gesetzt.

### Acceptance Criteria

- [ ] Given Vercel-Logs werden auf einen fehlgeschlagenen Booking-POST analysiert, when der Fehlertyp identifiziert ist, then ist die Ursache im PR dokumentiert und die operative Gegenmassnahme (migrate deploy, ENV setzen, Domain-Verifikation) ist ausgeführt.
- [ ] Given `prisma migrate deploy` und alle Pflicht-ENV (`RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO_ADMIN`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`) sind in Prod gesetzt, when ein Kunde das Formular vollständig absendet, then wird die Buchung mit Status `PENDING` in der DB gespeichert — kein 500-Fehler.
- [ ] Given eine Buchung gespeichert wurde, when der E-Mail-Versand ausgeführt wird, then erhält Tom eine Benachrichtigungs-E-Mail an `hausservice-baerenstark@outlook.com` mit Kundenname, Service, Datum und Kontaktdaten.
- [ ] Given eine Buchung gespeichert wurde, when Tom das Admin-Portal öffnet, then erscheint die neue Anfrage mit Status „Offen".
- [ ] Given ein Live-Smoke-Test als Gast und als eingeloggter Kunde, when beide Buchungen abgesendet werden, then erscheinen beide im Admin-Portal und beide E-Mails kommen bei Tom an.

### Notes

- `MAIL_FROM` (nicht `RESEND_FROM_EMAIL`) ist der kanonische ENV-Key laut IT10.
- Migration: `20260503163821_add_customer_address` — ohne sie fehlen `streetAndNumber`, `postalCode`, `city`, `durationMinutes`.
- Diese Story ist Vorbedingung für US-IT11-03 und US-IT11-05.

### Story Points: 3
### Priority: Must Have

---

## Story: US-IT11-02 — Buchungsweg konsolidieren

**Als** Kunde,
**möchte ich** einen einzigen, offensichtlichen Weg finden, um eine Buchungsanfrage
zu stellen,
**so dass** ich nicht verwirrt werde und den Prozess problemlos abschließen kann.

### Acceptance Criteria

- [ ] Given ich öffne die Startseite, when ich auf den primären „Termin buchen"-Button klicke, then öffnet sich das Quick-Booking-Modal direkt — keine Weiterleitung.
- [ ] Given ich scrolle die Startseite von oben bis unten, when ich nach Buchungs-CTAs suche, then gibt es genau einen CTA — kein weiterer eingebetteter Slot-Picker ist sichtbar.
- [ ] Given ich rufe `/buchen` direkt auf, when die Seite lädt, then sehe ich das vollständige Buchungsformular mit Kalender als eigenständigen Fallback-Weg.
- [ ] Given ich suche auf allen Seiten nach Buchungs-Einstiegspunkten, when ich alle verlinkten Seiten durchsuche, then gibt es ausschließlich Hero/Header-CTA (Modal) und `/buchen` — keine weiteren Einstiegspunkte.
- [ ] Given Tom die Startseite aus Kundenperspektive bewertet, when er den Buchungsweg evaluiert, then ist ein prominenter CTA sofort erkennbar.

### Notes

- Primärer Flow: Quick-Booking-Modal (US-IT10-04) — nicht neu bauen, nur konsolidieren.
- Alle „Termin buchen"-Links im Header und Hero auf `openModal()` umstellen.
- `/buchen` bleibt als Fallback-Seite für SEO und direkte URL-Aufrufe.
- Kann parallel zu US-IT11-01 entwickelt werden (reines Frontend).

### Story Points: 3
### Priority: Must Have

---

## Story: US-IT11-03 — Klare Rückmeldung nach Buchungsabsenden

**Als** Kunde,
**möchte ich** nach dem Absenden meiner Buchungsanfrage sofort wissen, ob sie
erfolgreich war oder warum sie fehlgeschlagen ist,
**so dass** ich Sicherheit habe und nicht unsicher bin, ob meine Anfrage angekommen ist.

### Acceptance Criteria

- [ ] Given das Formular wurde vollständig ausgefüllt und abgesendet, when der Server `201 Created` antwortet, then erscheint ein grüner Toast „Anfrage erfolgreich gesendet! Tom meldet sich in Kürze bei Ihnen." und ich werde auf eine Bestätigungsseite mit Buchungsnummer, Service und Datum weitergeleitet.
- [ ] Given das Quick-Booking-Modal wurde abgesendet, when der Server `201 Created` antwortet, then schließt sich das Modal und ein grüner Toast erscheint (konsistentes Verhalten mit der `/buchen`-Seite).
- [ ] Given der Server mit 4xx oder 5xx antwortet, when die Fehlerantwort im Frontend verarbeitet wird, then erscheint eine deutschsprachige Fehlermeldung im Formular oder als roter Toast — niemals eine leere Seite oder Stack-Trace.
- [ ] Given der Erfolgs-Toast erscheint, when ich ihn lese, then enthält er Toms Telefonnummer als Kontaktmöglichkeit.
- [ ] Given ich bin eingeloggt und die Buchung erfolgreich gespeichert wurde, when ich `/konto` aufrufe, then erscheint die soeben erstellte Anfrage mit Status „Offen".

### Notes

- Hängt von US-IT11-01 ab (ohne funktionierende Buchung in Prod kein End-to-End-Test).
- Prüfen ob `BookingForm.tsx` den Redirect nach `201 Created` tatsächlich auslöst.
- Globaler `<Toaster />` in `layout.tsx` — in Prod aktiv prüfen.
- Bestätigungsseite muss auch nach einem Browser-Reload erreichbar sein: sie wird per signiertem Link aus der Bestätigungs-E-Mail aufgerufen. Token-Gültigkeit: 30 Tage empfohlen. Ohne gültigen Token: freundlicher Hinweis mit Buchungsnummer und Toms Telefonnummer.

### Story Points: 3
### Priority: Must Have

---

## Story: US-IT11-04 — Datei-Upload im Admin anzeigen

**Als** Admin (Tom),
**möchte ich** in der Auftragsdetailansicht alle vom Kunden hochgeladenen Bilder
und Videos sehen und herunterladen können,
**so dass** ich den Auftrag beurteilen und entscheiden kann, ob ich ihn annehme.

### Acceptance Criteria

- [ ] Given der Upload-Flow analysiert wird, when die Ursache für die fehlende Anzeige identifiziert ist, then ist sie im PR dokumentiert (Storage-Konfiguration, fehlende DB-Relation oder fehlende Anzeige-Komponente).
- [ ] Given ein Kunde beim Buchen eine Bilddatei (JPG/PNG, max. 10 MB) hochlädt, when die Buchung abgesendet wird, then ist die Datei persistent gespeichert (kein lokales Filesystem in Prod) und über einen stabilen URL aufrufbar.
- [ ] Given Tom die Detailansicht einer Buchung öffnet und der Kunde Dateien hochgeladen hat, when die Seite lädt, then sieht Tom eine Liste der Anhänge mit Vorschaubild (bei Bildern), Dateiname, Dateigröße und Download-Link.
- [ ] Given Tom die Detailansicht einer Buchung ohne Anhänge öffnet, when die Seite lädt, then erscheint der Hinweis „Keine Dateien hochgeladen".
- [ ] Given ein Kunde eine MP4-Videodatei (max. 50 MB) hochlädt, when Tom die Detailansicht öffnet, then wird die Videodatei mit einem Download-Link angezeigt (Inline-Vorschau ist optional).

### Notes

- Wichtigste Klärung: Wurde Upload in früherer Iteration implementiert? Welcher Storage-Provider?
- Bei Vercel: lokales Filesystem nicht persistent — falls Upload auf `/tmp` schreibt, ist das der Defekt.
- Diagnose unabhängig von US-IT11-01, End-to-End-Test setzt US-IT11-01 voraus.
- Upload-Limits (von Tom bestätigt): Bilder (`image/*`) max. 10 MB, Videos (`video/*`) max. 50 MB. Validierung muss clientseitig (sofortiges Feedback im Formular) UND serverseitig (HTTP 413 mit aussagekräftiger Fehlermeldung) erfolgen.

### Story Points: 5
### Priority: Must Have

---

## Story: US-IT11-05 — Profildaten-Vorausfüllung produktionsfähig machen

**Als** eingeloggter Kunde,
**möchte ich** beim Öffnen des Buchungsformulars meine hinterlegten Profildaten
automatisch vorausgefüllt sehen,
**so dass** ich keine bereits bekannten Informationen erneut eingeben muss.

### Acceptance Criteria

- [ ] Given ich bin eingeloggt und öffne das Buchungsformular (auf `/buchen` oder über das Quick-Booking-Modal), when das Formular geladen ist, then sind Name, E-Mail, Telefon und hinterlegte Adressfelder mit meinen Profildaten vorausgefüllt.
- [ ] Given `GET /api/customer/me` in Prod mit aktiver Session aufgerufen wird, when die Response zurückkommt, then gibt der Endpoint HTTP 200 mit Profildaten zurück — kein 401, kein 500.
- [ ] Given mein Konto hat keine Adresse hinterlegt, when das Formular lädt, then sind Name, E-Mail und Telefon vorausgefüllt, Adressfelder leer, und ein Hinweis „Adresse in Ihrem Profil hinterlegen" mit Link zu `/konto` ist sichtbar.
- [ ] Given ich ein vorausgefülltes Feld ändere und das Formular absende, when die Buchung gespeichert wird, then wird der geänderte Wert verwendet — Profildaten im Konto werden nicht überschrieben.
- [ ] Given ich nicht eingeloggt bin und das Formular öffne, when das Formular lädt, then sind alle Felder leer — kein Fehler.

### Notes

- Hängt von US-IT11-01 ab (dieselbe Datenbankmigrierung ist Vorbedingung).
- US-IT10-05 Teil B ist code-seitig korrekt — Defekt liegt in der Prod-Konfiguration.
- `NEXTAUTH_URL` in Vercel korrekt setzen — NextAuth-Sessions funktionieren sonst nicht.

### Story Points: 3
### Priority: Must Have

---

## Story: US-IT11-06 — Auftrag stornieren (Kundenseite)

**Als** eingeloggter Kunde,
**möchte ich** meine eigene Buchungsanfrage stornieren können,
**so that** ich Tom nicht anrufen muss, wenn sich meine Pläne ändern.

### Acceptance Criteria

- [ ] Given ich bin eingeloggt und rufe mein Kunden-Dashboard unter `/konto` auf, when ich eine Buchungsanfrage mit Status „Offen" oder „Bestätigt" sehe, then ist ein „Stornieren"-Button bei dieser Anfrage sichtbar — bei Status „Abgelehnt" oder „Storniert" ist kein Stornieren-Button vorhanden.
- [ ] Given ich auf den „Stornieren"-Button klicke, when der Button gedrückt wird, then erscheint ein Bestätigungsdialog mit dem Text „Möchten Sie diese Anfrage wirklich stornieren?" und den Optionen „Ja, stornieren" und „Abbrechen" — die Stornierung wird erst nach Bestätigung ausgeführt.
- [ ] Given ich die Stornierung im Dialog bestätige, when die Stornierung serverseitig verarbeitet wird, then wechselt der Status der Buchung auf „Storniert" und die Änderung ist sofort im Kunden-Dashboard sowie im Admin-Dashboard sichtbar.
- [ ] Given eine Buchung storniert wurde, when der Status auf „Storniert" wechselt, then erhält Tom eine E-Mail-Benachrichtigung mit Kundenname, Service, Datum und dem Hinweis „Storniert durch Kunden".
- [ ] Given eine Buchung mit einem zugewiesenen TimeSlot storniert wurde, when der Status auf „Storniert" wechselt, then wird der zugehörige TimeSlot wieder als verfügbar markiert (Status `AVAILABLE`) und steht für neue Buchungen offen.
- [ ] Given ich bin nicht eingeloggt und habe eine Gast-Buchung getätigt, when ich die Bestätigungs-E-Mail öffne und auf den Stornieren-Link klicke, then öffnet sich eine Bestätigungsseite mit dem Bestätigungsdialog — die Stornierung erfolgt per signiertem Token in der URL.
- [ ] Given der signierte Stornier-Token aus der Gast-E-Mail ist abgelaufen, when ich den Link aufrufe, then erscheint eine freundliche Meldung: „Dieser Stornierungslink ist abgelaufen. Bitte rufen Sie uns an: 0157-74787512" — kein technischer Fehler, kein Stack-Trace.
- [ ] Given eine Buchung bereits den Status „Storniert" hat, when ein erneuter Stornierungsversuch (per API oder Link) eingeht, then gibt der Server HTTP 409 zurück und es werden keine weiteren Statusänderungen vorgenommen (Idempotenz).

### Notes

- Klassifikation: Neues Feature.
- Storno-Endpoint: `PATCH /api/bookings/[id]/cancel` oder `POST /api/bookings/[id]/cancel` — Architect entscheidet.
- Gast-Storno-Token: signierter JWT oder HMAC-Hash mit Buchungs-ID und Ablaufzeit; Gültigkeit 30 Tage empfohlen (konsistent mit Bestätigungsseiten-Token aus US-IT11-03).
- Storno durch Kunden ist zu unterscheiden von Storno durch Tom (Admin-seitig) — diese Story deckt ausschließlich die Kundenseite ab.
- Hängt von US-IT11-01 ab (Buchungen müssen in Prod funktionieren).

### Story Points: 5
### Priority: Must Have

---

## Dependencies

- US-IT11-02 ist unabhängig (parallel zu US-IT11-01 entwickelbar)
- US-IT11-03 hängt von US-IT11-01 ab
- US-IT11-05 hängt von US-IT11-01 ab
- US-IT11-04 (Diagnose) ist unabhängig; End-to-End-Test hängt von US-IT11-01 ab
- US-IT11-06 hängt von US-IT11-01 ab (Buchungen müssen in Prod gespeichert werden)
