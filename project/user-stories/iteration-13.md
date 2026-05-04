# EPIC-IT13: Iteration 13 — Stakeholder-Feedback & Facebook-OAuth-Vorbereitung

Production-Bugs die aktive Buchungen blockieren beheben, sichtbare Bild- und
UX-Defekte aus Tom's Feedback-Runde beseitigen und die rechtlichen Voraussetzungen
für Facebook-OAuth schaffen.

## Vision context

Iteration 12 hat die Kernfunktionalität stabilisiert. Tom hat das System nach dem
Go-Live getestet und dabei zwei Production-Blocker (Upload-Fehler, Booking-API-Fehler)
sowie mehrere UX-Defekte (Scroll-Verhalten, Formular-Prefill, Bilddarstellung) und
einen Compliance-Bedarf (Datenlöschungsseite für Facebook-OAuth) identifiziert.
Diese Iteration räumt alle gemeldeten Punkte vollständig ab — danach ist Facebook
OAuth freigebbar und das Buchungserlebnis reibungslos.

---

## Erfolgsbestätigung: Google OAuth

**Google OAuth funktioniert in Produktion korrekt.** Kein Handlungsbedarf.
Wurde in IT12-S01 behoben und von Tom nach IT12 als funktionierend bestätigt.

---

## Story: IT13-S01 — Facebook-OAuth: Datenlöschungsseite einrichten

**Type:** Compliance

**Als** Website-Besucher (und potenzieller Facebook-OAuth-Nutzer),
**möchte ich** eine öffentlich zugängliche Datenlöschungsseite auf der Website finden,
**so dass** ich weiß, wie ich die Löschung meiner personenbezogenen Daten beantragen
kann, und Facebook die App-Freigabe erteilt.

### Fehlerbeschreibung / Compliance-Anforderung

Facebook App Review verlangt zwingend eine öffentlich erreichbare, von der Facebook
App-Konfiguration aus verlinkte URL, die erklärt wie Nutzer ihre Daten löschen lassen
können. Ohne diese URL kann die Facebook-App nicht auf „Live" gestellt werden und
Facebook OAuth bleibt inaktiv. Die Seite muss:
- unter einer stabilen URL erreichbar sein (z. B. `/datenschutz/datenloesung` oder
  `/datenschutz#datenloesung`),
- in der Facebook App-Dashboard-Konfiguration unter „Data Deletion Instructions URL"
  eingetragen sein,
- den Löschprozess klar beschreiben (Kontakt-E-Mail genügt laut Facebook-Richtlinien,
  da keine automatische Selbstlöschung im Portal existiert).

### Acceptance Criteria

- [ ] Given die URL `https://www.baerenstark-hausservice.app/datenschutz/datenloesung` wird in einem beliebigen Browser aufgerufen, when die Seite lädt, then antwortet der Server HTTP 200 und die Seite ist ohne Login erreichbar.
- [ ] Given die Datenlöschungsseite geladen ist, when ein Nutzer sie liest, then enthält sie: (1) eine klare Überschrift „Datenlöschung", (2) eine Erklärung dass Löschanfragen per E-Mail an `hausservice-baerenstark@outlook.com` gestellt werden können, (3) den Hinweis dass Anfragen innerhalb von 30 Tagen bearbeitet werden, (4) eine Auflistung welche Daten gespeichert werden (Name, E-Mail, ggf. Buchungshistorie).
- [ ] Given Facebook App-Dashboard, when unter „Data Deletion Instructions URL" die Seiten-URL eingetragen ist, then schlägt die URL-Validierung durch Facebook nicht fehl (HTTP 200, kein Redirect auf Login-Seite).
- [ ] Given die Datenschutzhauptseite (`/datenschutz`) geladen ist, when ein Nutzer nach dem Abschnitt zur Datenlöschung sucht, then findet er einen Abschnitt „Datenlöschung" mit denselben Informationen wie auf der Detailseite — alternativ einen direkten Link zur Detailseite.
- [ ] Given Footer der Website, when Nutzer darauf klickt, then ist ein Link „Datenlöschung" oder der Link über „Datenschutz" erreichbar.

### Notes

- Annahme: Löschung erfolgt manuell durch Tom per E-Mail-Anfrage innerhalb von 30 Tagen
  (Service-Level-Annahme, da kein automatisches Lösch-Portal existiert). Diese Frist
  entspricht DSGVO-Anforderungen (Art. 17).
- Die Seite muss vor dem Facebook-App-Review live sein — IT13-S02 hängt von dieser
  Story ab.
- Technisch reicht eine statische Next.js-Seite ohne Datenbankzugriff.
- Der Link zur Seite muss in der Facebook Developer Console manuell eingetragen werden
  (kein automatischer Schritt, gehört zur Betriebsdoku).

### Story Points: 2
### Priority: Must Have
### Status: Draft

---

## Story: IT13-S02 — Facebook OAuth aktivieren und testen

**Type:** Feature

**Als** Kunde,
**möchte ich** mich mit meinem Facebook-Konto bei Bärenstark anmelden können,
**so dass** ich kein weiteres Passwort benötigen muss und die Anmeldung schnell geht.

### Acceptance Criteria

- [ ] Given `/konto/login` geladen, when die Seite angezeigt wird, then ist ein „Mit Facebook anmelden"-Button sichtbar und aktiv.
- [ ] Given Klick auf „Mit Facebook anmelden", when der OAuth-Flow durch Facebook abgeschlossen wird, then wird der Nutzer eingeloggt und zu `/konto` weitergeleitet — kein Fehler.
- [ ] Given erster Facebook-Login, when der Flow abgeschlossen wird, then wird ein neues CustomerUser-Konto angelegt (keine E-Mail-Verifizierung erforderlich).
- [ ] Given ein bestehender Nutzer mit derselben E-Mail-Adresse (aus E-Mail/Passwort-Konto), when er Facebook OAuth nutzt, then wird er mit dem bestehenden Konto verknüpft — kein Duplikat angelegt.
- [ ] Given `FACEBOOK_CLIENT_ID` und `FACEBOOK_CLIENT_SECRET` in Vercel gesetzt, when der OAuth-Flow ausgeführt wird, then kein `redirect_uri_mismatch` und kein „App nicht live"-Fehler in den Vercel-Logs.
- [ ] Given Facebook App auf „Live" gestellt + Datenlöschungsseite (IT13-S01) in Facebook Developer Console eingetragen, when Tom den OAuth-Flow in Produktion testet, then ist der Login-Flow vollständig ohne Facebook-Review-Blocker.
- [ ] Given OAuth-Fehler oder Nutzer bricht den Facebook-Flow ab, when die Fehlerseite erscheint, then ist die Meldung auf Deutsch und enthält keine technischen Stack-Traces.

### Notes

- Vorbedingung: IT13-S01 (Datenlöschungsseite) muss live sein, bevor Facebook den
  App-Status auf „Live" akzeptiert.
- NextAuth v5 Facebook Provider prüfen — Konfiguration analog zu Google Provider.
- Redirect URI in Facebook Developer Console: `https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook` (mit `www.`).
- FACEBOOK_CLIENT_ID / FACEBOOK_CLIENT_SECRET müssen als Vercel Environment Variables
  für Production gesetzt sein.
- Annahme: Konto-Verknüpfung nach E-Mail erfolgt über NextAuth `signIn`-Callback
  (bereits für Google vorhanden — Facebook konsistent implementieren).

### Story Points: 3
### Priority: Must Have
### Status: Draft

---

## Story: IT13-S03 — Scroll-Bug: Automatisches Scrollen zur nächsten Sektion (alle Formulare)

**Type:** Bug

**Als** Kunde,
**möchte ich** nach jeder Auswahl in einem mehrstufigen Formular automatisch zur
nächsten Sektion scrollen, wobei die Abschnittsüberschrift vollständig sichtbar ist,
**so dass** ich nicht manuell nach unten scrollen muss und immer weiß wo ich mich
im Formular befinde.

### Fehlerbeschreibung

Tom meldet: Klick auf „Termin buchen" und anschließend auf einen Tag — es passiert
nichts oder der Scroll greift nicht. Das Problem tritt in allen Formularen/Wizards
auf. Bei bestehendem `scroll-margin-top`-Ansatz (UX-A-07 aus Backlog) wird die
Überschrift teilweise vom Sticky-Header überdeckt. Das neue Verhalten soll immer
die Überschrift der Zielsektion als erste sichtbare Zeile zeigen.

### Acceptance Criteria

**Buchungsformular / Wizard (`/buchen`, Quick-Booking-Modal):**

- [ ] Given der Nutzer wählt einen Tag im Kalender, when die Auswahl getätigt wird, then scrollt die Seite automatisch so, dass die Überschrift der Dauer-Sektion (z.B. „Wie lange?") die erste vollständig sichtbare Zeile unterhalb des Sticky-Headers ist — sie darf nicht abgeschnitten oder versteckt sein.
- [ ] Given der Nutzer wählt eine Dauer, when die Auswahl getätigt wird, then scrollt die Seite automatisch so, dass die Überschrift der Zeitslot-Sektion vollständig sichtbar ist.
- [ ] Given der Nutzer wählt einen Zeitslot, when die Auswahl getätigt wird, then scrollt die Seite automatisch so, dass die Überschrift der Kontaktdaten-Sektion vollständig sichtbar ist.
- [ ] Given der automatische Scroll ausgelöst wird, when die Animation endet, then ist die jeweilige Abschnittsüberschrift (H2 oder H3) die erste sichtbare Überschrift — nicht der mittlere Bereich der Sektion.
- [ ] Given der Sticky-Header eine variable Höhe hat (z.B. 64px Desktop / 56px Mobile), when der Scroll berechnet wird, then wird der `offsetTop` des Sektions-Containers minus der tatsächlichen Header-Höhe als Scrollziel verwendet — kein hartcodierter Offset.

**Profil-Formular (`/konto`):**

- [ ] Given der Nutzer klickt auf „Profil bearbeiten" oder öffnet einen Abschnitt im Profil-Formular, when der Abschnitt sich öffnet, then scrollt die Seite so, dass die Formular-Überschrift vollständig sichtbar ist.

**Kontaktformular (falls vorhanden):**

- [ ] Given ein Kontaktformular auf der Seite existiert und ein Nutzer zum Formular navigiert (per CTA-Klick oder Anker-Link), when die Navigation ausgelöst wird, then ist die Formular-Überschrift vollständig sichtbar — kein Header-Overlap.

**Allgemein:**

- [ ] Given der automatische Scroll auf einem Smartphone (Viewport < 768px) ausgelöst wird, when die Animation endet, then ist die Zielüberschrift vollständig im Viewport — kein Teil der Überschrift verdeckt durch den Sticky-Header.
- [ ] Given `prefers-reduced-motion: reduce` im Betriebssystem gesetzt, when ein Scroll ausgelöst wird, then erfolgt der Sprung ohne Smooth-Scrolling-Animation (barrierefreiheitskonform).
- [ ] Given das Quick-Booking-Modal offen ist und ein Scroll-Schritt ausgelöst wird, when die Zielsektion sichtbar sein soll, then scrollt das Modal-Innere (nicht das Hintergrunddokument) zur Zielüberschrift.

### Notes

- Technischer Ansatz: `element.scrollIntoView({ block: 'start', behavior: 'smooth' })`
  in Kombination mit `scroll-margin-top` CSS-Property an den Sektionscontainern.
  Alternativ: manuell `window.scrollTo({ top: element.offsetTop - headerHeight })`.
- Header-Höhe dynamisch via `document.querySelector('[data-header]')?.offsetHeight`
  ermitteln — nicht hardcoden.
- Diese Story ersetzt / schließt UX-A-07 aus dem UX-Backlog.
- Regressionstest: Scroll-Jump-Bug aus IT12-S04 und IT12-S09 darf nicht wieder
  eingeführt werden.

### Story Points: 3
### Priority: Must Have
### Status: Draft

---

## Story: IT13-S04 — Formular-Prefill: Alle Formulare für eingeloggte Nutzer automatisch befüllen

**Type:** Enhancement

**Als** eingeloggter Kunde,
**möchte ich** dass alle Formulare auf der Website automatisch mit meinen
hinterlegten Profildaten vorausgefüllt sind,
**so dass** ich keine bekannten Informationen wiederholt eingeben muss.

### Acceptance Criteria

**Buchungsformular (`/buchen`, Quick-Booking-Modal):**

- [ ] Given eingeloggt + Buchungsformular geöffnet (Kontaktdaten-Schritt), when das Formular rendert, then ist das Feld „Vorname" mit dem gespeicherten Vornamen vorausgefüllt.
- [ ] Given eingeloggt + Buchungsformular geöffnet, when das Formular rendert, then ist das Feld „Nachname" mit dem gespeicherten Nachnamen vorausgefüllt.
- [ ] Given eingeloggt + Buchungsformular geöffnet, when das Formular rendert, then ist das Feld „E-Mail" mit der gespeicherten E-Mail-Adresse vorausgefüllt.
- [ ] Given eingeloggt + Buchungsformular geöffnet, when das Formular rendert, then ist das Feld „Telefon" mit der gespeicherten Telefonnummer vorausgefüllt (sofern im Profil hinterlegt — sonst leer).
- [ ] Given eingeloggt + Buchungsformular geöffnet + Adresse im Profil hinterlegt, when das Formular rendert, then sind die Felder „Straße & Hausnummer", „PLZ" und „Ort" mit den gespeicherten Adressdaten vorausgefüllt.
- [ ] Given eingeloggt + kein Adresse im Profil hinterlegt, when das Formular rendert, then sind Adressfelder leer und ein Hinweis „Adresse in Ihrem Profil hinterlegen" mit Link zu `/konto` ist sichtbar.
- [ ] Given vorausgefülltes Feld vom Nutzer geändert und Formular abgesendet, when die Buchung gespeichert wird, then wird der geänderte Wert für die Buchung verwendet — das Profil wird nicht überschrieben.

**Profilformular (`/konto`):**

- [ ] Given eingeloggt + Profilseite geöffnet, when das Formular rendert, then sind alle Felder (Vorname, Nachname, E-Mail, Telefon, Straße & Hausnummer, PLZ, Ort) mit den in der Datenbank gespeicherten Werten vorausgefüllt.
- [ ] Given Profil noch nicht vollständig, when leere Felder vorhanden sind, then sind diese leer — kein falscher Platzhalter-Wert.

**Kontaktformular (sofern auf der Website vorhanden):**

- [ ] Given eingeloggt + Kontaktformular aufgerufen, when das Formular rendert, then sind Name und E-Mail-Felder mit den Profildaten vorausgefüllt.

**Alle Formulare — Grenzfälle:**

- [ ] Given nicht eingeloggt + beliebiges Formular geöffnet, when das Formular rendert, then sind alle Felder leer — kein Fehler, kein 401 im Frontend.
- [ ] Given `GET /api/customer/me` in Produktion schlägt fehl (z.B. Session abgelaufen), when der API-Call einen Fehler zurückgibt, then rendert das Formular leer und zeigt einen Hinweis „Bitte erneut anmelden" — kein ungefangener Fehler.

### Notes

- IT11-S05 und IT12-S08 haben dieses Verhalten für das Buchungsformular teilweise
  implementiert — diese Story erweitert es auf alle Formulare und stellt die
  konsistente Anwendung sicher.
- Annahme: Telefon ist ein optionales Profilfeld — fehlt es, bleibt das Formularfeld
  leer ohne Fehlermeldung.
- Annahme: Kontaktformular existiert oder ist geplant; falls es in IT13 noch nicht
  existiert, gilt dieses Kriterium als „Not Applicable" und ist explizit im PR-Kommentar
  zu vermerken.

### Story Points: 3
### Priority: Must Have
### Status: Draft

---

## Story: IT13-S05 — Production-Bug: Bilder-Upload schlägt fehl (INTERNAL_ERROR)

**Type:** Bug

**Als** Kunde,
**möchte ich** Bilder zum Buchungsformular hochladen können,
**so dass** Tom einen visuellen Eindruck des Auftrags erhält.

### Fehlerbeschreibung

Tom meldet: „Upload zum Speicher fehlgeschlagen. Bitte später erneut versuchen.
(INTERNAL_ERROR)" beim Hochladen von Bildern im Buchungsformular in der
Production-Umgebung. Endpoint: `POST /api/upload` (Vercel Blob). Der Fehler
tritt ausschließlich in Production auf; lokale Entwicklungsumgebung nicht betroffen.

Bereits behoben in IT12-S10, aber offenbar in Production erneut aufgetreten oder
der Fix wurde nicht korrekt in Prod deployt.

### Acceptance Criteria

- [ ] Given die Vercel-Logs für `POST /api/upload` analysiert werden, when der Fehler identifiziert ist, then ist die Ursache im PR dokumentiert (ENV-Variable fehlend, Blob-Token abgelaufen, Rate-Limit, Code-Fehler o.ä.).
- [ ] Given `BLOB_READ_WRITE_TOKEN` als Vercel Environment Variable für Production gesetzt ist, when ein Nutzer ein JPEG oder PNG (≤ 10 MB) hochlädt, then antwortet `/api/upload` mit HTTP 200 und einer gültigen Vercel-Blob-URL — kein INTERNAL_ERROR.
- [ ] Given ein PNG-Bild (≤ 10 MB) hochgeladen wird, when der Upload abgeschlossen ist, then erscheint eine Vorschau des Bildes im Buchungsformular.
- [ ] Given eine Datei > 10 MB hochgeladen wird, when die Validierung greift, then erscheint eine deutschsprachige Fehlermeldung „Datei zu groß (max. 10 MB)" — kein technischer Stack-Trace.
- [ ] Given Upload erfolgreich + Buchung abgesendet, when Tom die Auftragsdetailseite im Admin öffnet, then sind die Bilder mit Vorschau und Download-Link sichtbar.
- [ ] Given Upload-Endpoint in Prod nach dem Fix aufgerufen wird, then keine INTERNAL_ERROR-Antworten mehr in den Vercel-Logs.

### Notes

- Diagnose-Reihenfolge: (1) Vercel Environment Variable `BLOB_READ_WRITE_TOKEN`
  prüfen — ist sie für den Production-Branch gesetzt? (2) Vercel-Blob-Dashboard
  prüfen ob das Store noch existiert. (3) Token-Ablaufdatum prüfen (Vercel Blob
  Tokens laufen nicht ab, aber Store-Zuordnung kann sich ändern). (4) Next.js
  Route Handler Config (`export const runtime = 'nodejs'`) prüfen.
- IT12-S10 hatte diesen Bug bereits behoben — Regression-Ursache prüfen.
- Annahme: Maximale Uploadgröße bleibt bei 10 MB für Bilder (von Tom in IT11 bestätigt).

### Story Points: 3
### Priority: Must Have
### Status: Draft

---

## Story: IT13-S06 — Production-Bug: Anfrage absenden schlägt fehl (Interner Serverfehler)

**Type:** Bug

**Als** Kunde,
**möchte ich** eine Buchungsanfrage in Produktion erfolgreich absenden können,
**so dass** Tom meine Anfrage erhält und ich eine Bestätigung bekomme.

### Fehlerbeschreibung

Tom meldet: „Interner Serverfehler. Bitte später erneut versuchen." beim Absenden
einer Anfrage in der Production-Umgebung. Endpoint: `POST /api/bookings`. Der
Fehler blockiert aktiv das Kerngeschäft — keine Buchung kann eingehen.

### Acceptance Criteria

- [ ] Given Vercel-Logs für `POST /api/bookings` analysiert werden, when der Fehler identifiziert ist (P2022 Datenbankfehler, fehlende ENV, Prisma-Verbindungsfehler, Resend-Fehler o.ä.), then ist die Ursache im PR dokumentiert.
- [ ] Given alle erforderlichen ENV-Variablen gesetzt sind (`DATABASE_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO_ADMIN`, `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_URL`), when ein Kunde das Buchungsformular vollständig ausfüllt und absendet, then antwortet `POST /api/bookings` mit HTTP 201 — kein 500.
- [ ] Given Buchung mit HTTP 201 gespeichert wurde, when das Admin-Dashboard aufgerufen wird, then erscheint die neue Anfrage mit Status „Offen".
- [ ] Given Buchung mit HTTP 201 gespeichert wurde, when der E-Mail-Versand ausgeführt wird, then erhält Tom eine Benachrichtigungsmail an `hausservice-baerenstark@outlook.com` mit Kundenname, Service, Datum und Kontaktdaten.
- [ ] Given Smoke-Test in Production durchgeführt wird (Gast-Buchung + eingeloggte Buchung), when beide Formulare abgesendet werden, then erscheinen beide Anfragen im Admin-Portal — kein Fehler.
- [ ] Given 4xx/5xx-Antwort vom Server, when das Frontend die Antwort verarbeitet, then erscheint eine deutschsprachige Fehlermeldung — kein leerer Zustand, kein Stack-Trace.

### Notes

- Diagnose-Reihenfolge: (1) Vercel-Logs auf genauen Fehlertyp prüfen (Prisma `P2022`
  = DB-Migration fehlt; `P1001` = Verbindung fehlgeschlagen; Resend-Error = API-Key
  fehlt). (2) Turso-DB `baerenstark-prod` prüfen ob alle Migrations eingespielt sind
  (`turso db shell baerenstark-prod < migration.sql`). (3) Alle Pflicht-ENV in Vercel
  für Production-Branch prüfen.
- Dieser Fehler wurde in IT11-S01 und IT12 bereits behoben — eine erneute Regression
  deutet auf eine ENV-Änderung oder ein Re-Deployment ohne Migration hin.
- Blockiert das Kerngeschäft — höchste Priorität innerhalb IT13.
- Annahme: Die DB-Schema ist korrekt; wahrscheinlichste Ursache ist eine fehlende
  oder zurückgesetzte ENV-Variable nach einem Vercel-Re-Deployment.

### Story Points: 3
### Priority: Must Have
### Status: Draft

---

## Story: IT13-S07 — Bilder: PNG-Transparenz korrekt darstellen

**Type:** Bug

**Als** Website-Besucher,
**möchte ich** Service-Bilder auf transparentem Hintergrund sehen,
**so dass** das Design der Seite sauber und professionell wirkt ohne störende
weiße oder graue Boxen um die Bilder.

### Fehlerbeschreibung

Tom meldet: Alle Service-Bilder haben einen transparenten Hintergrund im PNG, aber
die Transparenz wird nicht angezeigt — stattdessen wird ein opaker Hintergrund
(vermutlich weiß oder grau) gerendert. Der transparente Bereich der PNGs soll
tatsächlich transparent durchscheinen, sodass der Seiten-/Container-Hintergrund
sichtbar ist.

### Acceptance Criteria

- [ ] Given eine Service-Karte auf der Startseite geladen ist, when das Service-Bild angezeigt wird, then ist der transparente Bereich des PNG-Bildes durchsichtig — der Seitenhintergrund (Braun/Beige-Thema) ist durch die transparenten Pixel sichtbar.
- [ ] Given alle 7 Service-Detail-Seiten (`/services/entruempelung`, `/services/entkernung`, `/services/reinigung`, `/services/gruenflaechenpflege`, `/services/muelltonnenservice`, `/services/entsorgung`, `/services/sonstiges`) aufgerufen werden, when das Service-Bild geladen ist, then werden transparente Bereiche des PNG ohne opaken Hintergrund dargestellt.
- [ ] Given das `<img>`-Element oder das Next.js `<Image>`-Element im DOM inspiziert wird, when CSS-Styles geprüft werden, then ist kein `background-color: white`, `background-color: #fff`, `background: white` oder äquivalenter opaker Hintergrund am Bild-Element oder dessen direktem Container gesetzt.
- [ ] Given ein Browser-Screenshot der Service-Karten erstellt wird, when Bilddarstellung geprüft wird, then sind keine weißen oder grauen Boxen um die Bilder sichtbar.
- [ ] Given die Bilder in einem Container mit dem Braun/Beige-Designthema liegen, when Transparenz korrekt gerendert wird, then fügen sich die Bilder visuell in den Hintergrund ein.

### Notes

- Ursachen-Hypothesen: (1) `background-color: white` auf Container oder
  `<img>`-Wrapper-Element, (2) Tailwind-Klasse wie `bg-white` oder `bg-gray-100` an
  Container, (3) Next.js `<Image>` mit `placeholder="blur"` generiert opaken
  Blur-Placeholder, (4) CSS-Reset setzt `img { background: white }`.
- Lösungsansatz: Container-Div auf `bg-transparent` setzen, sicherstellen dass
  kein Elternelement einen opaken Hintergrund hat. Bei Next.js `<Image>`:
  `placeholder="empty"` oder keinen Placeholder setzen.
- Regressionstest: Sicherstellen dass Service-Bilder auf allen Seiten (Startseite,
  Detailseiten) transparent dargestellt werden.

### Story Points: 2
### Priority: Must Have
### Status: Draft

---

## Story: IT13-S08 — Service-Detail-Bilder: Größe anpassen (vollständig im Frame sichtbar)

**Type:** Bug

**Als** Website-Besucher auf einer Service-Detail-Seite (`/services/[slug]`),
**möchte ich** das Service-Bild vollständig und nicht abgeschnitten sehen,
**so dass** ich einen vollständigen visuellen Eindruck des Services bekomme.

### Fehlerbeschreibung

Tom meldet: Auf den Service-Detail-Seiten (`/services/[slug]`) sind die Bilder zu
groß für ihren Frame und werden abgeschnitten. Das Bild muss vollständig im
vorgesehenen Bereich sichtbar sein.

### Acceptance Criteria

- [ ] Given eine Service-Detail-Seite geladen ist (z.B. `/services/entruempelung`), when das Bild dargestellt wird, then ist das gesamte Bild vollständig sichtbar — kein Teil des Bildes wird durch den Container abgeschnitten (`overflow: hidden` ohne passendes Sizing ist das typische Symptom).
- [ ] Given das Bild-Element im DOM inspiziert wird, when CSS-Klassen geprüft werden, then ist `object-fit: contain` (oder ein äquivalentes Layout, z.B. automatische Höhe) gesetzt — kein `object-fit: cover` in Kombination mit einer fixen Containergröße die kleiner als das Bild ist.
- [ ] Given alle 7 Service-Detail-Seiten aufgerufen werden, when Bilder geprüft werden, then sind auf allen Seiten Bilder vollständig sichtbar — kein Abschneiden auf keiner Seite.
- [ ] Given die Seite auf einem Smartphone (Viewport 375px Breite) aufgerufen wird, when das Bild dargestellt wird, then ist das Bild vollständig sichtbar und skaliert responsiv mit dem Viewport — kein horizontales Overflow.
- [ ] Given die Seite auf einem Desktop-Viewport (1280px+) aufgerufen wird, when das Bild dargestellt wird, then ist das Bild innerhalb seines vorgesehenen Containers vollständig sichtbar und hat angemessene Dimensionen (nicht zu groß, nicht zu klein).
- [ ] Given die Bildgröße angepasst wurde, when die Service-Detail-Seiten visuell geprüft werden, then wirkt das Layout ausgewogen — Bild und Text-Content stehen in vernünftiger Proportion.

### Notes

- Lösungsansatz: `object-fit: contain` statt `cover` am `<img>` oder Next.js
  `<Image>`, oder Container-Höhe auf `height: auto` setzen und feste Maximalbreite
  definieren. Alternativ: `max-height` am Container begrenzen.
- Bei Next.js `<Image>` mit `fill`-Prop: Container-Dimensionen kontrollieren oder
  `width`/`height`-Props statt `fill` verwenden.
- Regressionstest: Sicherstellen dass Bilder auf der Startseite (Service-Karten)
  nicht negativ beeinflusst werden.
- Diese Story ist unabhängig von IT13-S07 (Transparenz), kann parallel entwickelt
  werden.

### Story Points: 2
### Priority: Must Have
### Status: Draft

---

## Dependencies

- IT13-S01 muss vor IT13-S02 abgeschlossen sein (Datenlöschungsseite ist Vorbedingung
  für Facebook App Review / „Live"-Status).
- IT13-S05 und IT13-S06 sind unabhängig voneinander und können parallel bearbeitet
  werden — beide sind Production-Blocker mit höchster Priorität.
- IT13-S03 und IT13-S04 sind unabhängig und können parallel entwickelt werden.
- IT13-S07 und IT13-S08 sind unabhängig voneinander und können parallel entwickelt
  werden.
- Empfohlene Bearbeitungsreihenfolge: IT13-S06 → IT13-S05 → IT13-S03 → IT13-S04
  → IT13-S01 → IT13-S02 → IT13-S07 → IT13-S08.
