# EPIC-IT7: Iteration 7 — Auth-Stabilisierung & Email-Auth-Wiederherstellung

Auth-Stack vollständig funktionstüchtig machen: Email/Password-Registrierung
wiederherstellen (Reversion von US-IT6-05), Google- und Facebook-OAuth reparieren,
Tom als Admin wiederherstellen und den Passwort-Reset-Flow end-to-end absichern.

## Vision context

Iteration 6 hat den Auth-Stack bewusst auf reines OAuth reduziert (US-IT6-05).
Tom hat nach Deployment fünf kritische Probleme gemeldet: Beide OAuth-Provider
funktionieren nicht, er kann sich selbst nicht mehr als Admin anmelden, und er
möchte Email/Password-Registrierung für Kunden zurück. Iteration 7 ist eine
reine Stabilisierungs-Iteration — keine neuen Features, ausschließlich
Reparatur und bewusste Reversion einer IT6-Entscheidung. Nach IT7 müssen sich
Kunden per Email/Password ODER Google ODER Facebook anmelden können, Tom muss
wieder als Admin aktiv sein, und der Passwort-Reset-Flow muss zuverlässig
funktionieren.

---

## Story: US-IT7-01 Email/Password-Registrierung und -Login wiederherstellen

> **Pivot-Hinweis (Reversion von US-IT6-05):** US-IT6-05 hat die
> Email/Password-Registrierung und alle zugehörigen API-Endpoints bewusst
> entfernt und die Routes auf HTTP 404 gesetzt. US-IT7-01 revertiert diese
> Entscheidung vollständig. OAuth bleibt als optionale Convenience-Methode
> erhalten. Email/Password ist ab IT7 wieder der Standard-Registrierungsweg
> für alle Kunden ohne Google- oder Facebook-Konto.
>
> Konkret müssen folgende in IT6 (D3-Fix) gelöschte Verzeichnisse
> wiederhergestellt werden:
> `src/app/api/customer/register/`,
> `src/app/api/customer/login/`,
> `src/app/api/customer/verify-email/`,
> `src/app/api/customer/forgot-password/`,
> `src/app/api/customer/reset-password/`,
> `src/app/api/customer/resend-verification/`
>
> Sowie folgende UI-Seiten:
> `/konto/registrieren` (echtes Registrierungsformular, kein Redirect mehr),
> `/konto/login` (Email-Form ZUSÄTZLICH zu OAuth-Buttons),
> `/konto/passwort-vergessen`,
> `/konto/passwort-zuruecksetzen`,
> Verify-Email-Page.

**Als** Kunde,
**I want to** mich per Email-Adresse und Passwort bei Bärenstark Hausservice
registrieren und einloggen können,
**so that** ich ein Kundenkonto anlegen kann, ohne zwingend ein Google- oder
Facebook-Konto zu benötigen.

### Acceptance Criteria

- [ ] Given ich rufe `/konto/registrieren` auf, when die Seite geladen ist,
  then sehe ich ein Formular mit den Feldern: Vorname, Nachname, Email,
  Passwort, Passwort bestätigen — sowie die OAuth-Buttons „Mit Google
  anmelden" und „Mit Facebook anmelden" als Alternative.
- [ ] Given ich fülle das Registrierungsformular korrekt aus (Passwort mind.
  8 Zeichen) und klicke „Konto erstellen", when die Anfrage verarbeitet wird,
  then wird mein Account angelegt, ich erhalte eine deutschsprachige
  Bestätigungs-Email via Resend und sehe den Hinweis „Bitte bestätigen Sie
  Ihre E-Mail-Adresse".
- [ ] Given ich lasse ein Pflichtfeld leer oder das Passwort ist kürzer als
  8 Zeichen, when ich auf „Konto erstellen" klicke, then erscheint eine
  Inline-Fehlermeldung am betreffenden Feld ohne Seitenneuladen.
- [ ] Given ich rufe `/konto/login` auf, when die Seite geladen ist, then
  sehe ich sowohl das Email/Passwort-Formular als auch die Buttons „Mit
  Google anmelden" und „Mit Facebook anmelden".
- [ ] Given ich gebe korrekte Email und Passwort ein und klicke „Einloggen",
  when die Authentifizierung erfolgt, then werde ich zu `/konto`
  weitergeleitet.
- [ ] Given ich gebe falsche Zugangsdaten ein, when ich auf „Einloggen"
  klicke, then erscheint die Meldung „E-Mail oder Passwort ungültig" — ohne
  Hinweis, ob Email oder Passwort falsch ist (keine Kontoexistenz-Preisgabe).
- [ ] Given ich rufe die Verify-Email-Page mit einem gültigen Token auf, when
  der Token verarbeitet wird, then wird mein Account als verifiziert markiert
  und ich werde zu `/konto/login` mit Erfolgshinweis weitergeleitet.
- [ ] Given ein Kunde ohne verifizierten Account versucht sich einzuloggen,
  when die Authentifizierung läuft, then kann er sich einloggen (Verifizierung
  ist Convenience, kein harter Block) — er sieht jedoch einen
  Info-Banner „Bitte bestätigen Sie Ihre E-Mail-Adresse".
- [ ] Given `POST /api/customer/login` aufgerufen wird, when die Response
  zurückkommt, then enthält sie ausschließlich die in `CustomerUserPublicSchema`
  definierten Felder — kein `passwordHash`, kein `adminNote`, kein
  `adminRating` (F3-Garantie aus IT6 bleibt unverändert aktiv).
- [ ] Given `POST /api/customer/register` mit einer bereits registrierten
  Email aufgerufen wird, when verarbeitet, then antwortet der Endpoint mit
  HTTP 409 und der Meldung „Diese E-Mail-Adresse ist bereits registriert."

### Notes
- Passwort-Hashing: `bcrypt` mit Faktor 12 (kein Plaintext, kein MD5/SHA1).
- Rate-Limiting auf `POST /api/customer/login` und
  `POST /api/customer/register` über bestehenden Upstash-Stack.
- `CredentialsProvider` wird in `customer-oauth.ts` wieder hinzugefügt,
  parallel zu `GoogleProvider` und `FacebookProvider`.
- Die in IT6 gesetzten 410/404-Stub-Responses werden vollständig durch
  echte Implementierungen ersetzt.
- Email-Versand via Resend (bestehende Integration); Email-Template auf
  Deutsch mit Bärenstark-Branding.
- DTO-Leak-CI-Scan (`scripts/check-dto-leaks.ts`) muss nach Implementierung
  wieder grün bleiben.

### Story Points: 5
### Priority: Must Have

---

## Story: US-IT7-02 Google OAuth funktional reparieren

> **Bug-Kontext (Folge von US-IT6-05):** Der Google-OAuth-Bug wurde in IT6 nur
> über ein Runbook (`docs/AUTH_GOOGLE_FIX_RUNBOOK.md`) dokumentiert, aber nicht
> behoben. Tom hat das Runbook ausgeführt ohne Erfolg. Diese Story verlangt
> aktive Diagnose + konkrete Code/Konfig-Reparatur, nicht nur Dokumentation.

**Als** Kunde,
**I want to** mich mit meinem Google-Konto bei `/konto/login` anmelden können,
**so that** ich kein eigenes Passwort anlegen muss.

### Acceptance Criteria

- [ ] Given Tom (oder ein Entwickler) führt die Diagnose-Checkliste aus (siehe
  Notes), when die konkrete Fehlerursache identifiziert ist, then ist sie
  schriftlich dokumentiert (kommt in den Commit-Kommentar / PR-Beschreibung):
  `redirect_uri_mismatch`, `invalid_client`, `NEXTAUTH_URL falsch`, oder
  `trustHost fehlt`.
- [ ] Given die Redirect-URI in der Google Cloud Console ist nicht gesetzt oder
  falsch, when der Entwickler sie auf
  `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`
  und `http://localhost:3000/api/auth/customer/callback/google` korrigiert,
  then schlägt der OAuth-Flow danach nicht mehr mit `redirect_uri_mismatch`
  fehl.
- [ ] Given `NEXTAUTH_URL` in der Produktionsumgebung fehlt oder enthält einen
  Trailing-Slash, when der Wert auf
  `https://www.baerenstark-hausservice.app` (kein Trailing-Slash) gesetzt
  wird, then wird dieser Wert von NextAuth korrekt als Basis für den
  Callback-URL verwendet.
- [ ] Given `trustHost: true` nicht in der NextAuth-Konfiguration gesetzt ist,
  when es ergänzt wird, then entfällt der „Bad request"-Fehler, der durch
  Host-Verifikation in NextAuth v5 ausgelöst wird.
- [ ] Given der OAuth-Consent-Screen im Status „Testing" ist und Tom nicht
  als Test-User eingetragen ist, when Tom als Test-User hinzugefügt wird (oder
  der Status auf „In production" gesetzt wird), then kann sich Tom erfolgreich
  einloggen.
- [ ] Given alle Korrekturen eingespielt sind, when Tom auf `/konto/login`
  auf „Mit Google anmelden" klickt und den Flow abschließt, then ist er
  eingeloggt, wird zu `/konto` weitergeleitet und eine neue Session ist
  angelegt — kein „Bad request"-Fehler.
- [ ] Given ein OAuth-Fehler auftritt (z.B. User bricht ab), when er
  zurückgeleitet wird, then erscheint eine deutschsprachige Fehlermeldung auf
  `/konto/login`.

### Notes
- Diagnose-Reihenfolge (Entwickler führt diese Punkte durch, bevor Code
  geändert wird):
  1. Browser DevTools → Network-Tab → OAuth-Redirect beobachten, genauen
     Fehlercode aus URL-Parameter (`error=...`) ablesen.
  2. Server-Log auf `redirect_uri_mismatch` oder `invalid_client` prüfen.
  3. `NEXTAUTH_URL` in `.env.production` gegen tatsächliche Domain vergleichen.
  4. Google Cloud Console: Credentials → OAuth 2.0 Client → Authorized Redirect
     URIs auf exakte Pfad-Schreibweise prüfen
     (`/api/auth/customer/callback/google`).
  5. `customer-oauth.ts`: `trustHost: true` vorhanden?
  6. OAuth Consent Screen: Status „Testing" oder „In production"? Tom als
     Test-User eingetragen?
- Benötigte ENV-Variablen: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `NEXTAUTH_URL`. Tom liefert Client-ID/Secret aus Google Cloud Console.
- `NEXTAUTH_SECRET` muss in Produktion gesetzt sein (NextAuth v5 Pflicht).
- Kein neues Runbook — die Reparatur wird in Code und ENV eingecheckt, nicht
  nur dokumentiert.

### Story Points: 3
### Priority: Must Have

---

## Story: US-IT7-03 Facebook OAuth funktional reparieren

> **Bug-Kontext (Folge von US-IT6-05):** Facebook OAuth wurde in IT6
> implementiert aber nie vollständig konfiguriert. Tom hat keine erfolgreiche
> Facebook-Anmeldung durchgeführt. Diese Story verlangt, dass der Entwickler
> gemeinsam mit Tom die Meta-Developer-Portal-Konfiguration abschließt und
> den Flow testet. Falls die Facebook-App noch im Developer-Mode ist (nur
> Test-User), muss Tom sie auf „Live" schalten.

**Als** Kunde,
**I want to** mich mit meinem Facebook-Konto bei `/konto/login` anmelden
können,
**so that** ich eine weitere bequeme Anmelde-Option habe.

### Acceptance Criteria

- [ ] Given der Entwickler prüft die Facebook-App-Konfiguration im Meta
  Developer Portal, when er den App-Status und die OAuth-Redirect-URIs
  kontrolliert, then ist dokumentiert, welcher Konfigurationsschritt fehlt
  (App im Developer-Mode, falsche Redirect-URI, fehlende ENV-Vars, Domain
  nicht verifiziert).
- [ ] Given `FACEBOOK_CLIENT_ID` und `FACEBOOK_CLIENT_SECRET` nicht in der
  Produktionsumgebung gesetzt sind, when sie aus dem Meta Developer Portal
  bezogen und gesetzt werden, then erscheint kein `invalid_client`-Fehler
  mehr.
- [ ] Given die Authorized Redirect URI in der Facebook-App nicht gesetzt ist,
  when sie auf
  `https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook`
  gesetzt wird, then schlägt der OAuth-Callback nicht mehr mit
  `redirect_uri_mismatch` fehl.
- [ ] Given die Facebook-App im „Development"-Mode ist, when Tom sie im Meta
  Developer Portal auf „Live" schaltet (App Review ist bei ausschließlich
  `email`- und `public_profile`-Berechtigungen nicht erforderlich), then
  können sich alle Facebook-Nutzer (nicht nur Test-User) anmelden.
- [ ] Given alle Korrekturen eingespielt sind, when Tom auf `/konto/login`
  auf „Mit Facebook anmelden" klickt und den Flow abschließt, then ist er
  eingeloggt, wird zu `/konto` weitergeleitet und eine neue Session ist
  angelegt.
- [ ] Given ein OAuth-Fehler oder Abbruch auftritt, when der Nutzer
  zurückgeleitet wird, then erscheint eine deutschsprachige Fehlermeldung auf
  `/konto/login`.

### Notes
- Was Tom selbst im Meta Developer Portal tun muss (Entwickler kann das
  nicht für Tom übernehmen, da es Toms Facebook-App-Konto ist):
  1. https://developers.facebook.com/apps → App auswählen.
  2. Facebook Login → Einstellungen → Valid OAuth Redirect URIs:
     `https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook`
     eintragen.
  3. App-Domain eintragen: `www.baerenstark-hausservice.app`.
  4. App-Status prüfen: „Live" statt „Development".
  5. Berechtigungen: `email` und `public_profile` — kein App Review nötig.
  6. App-ID und App-Secret aus „Einstellungen > Allgemeines" kopieren und an
     Entwickler übergeben für ENV-Setzung.
- Architect-Klärungsfrage: Soll Facebook-OAuth weiterhin Pflicht sein oder
  als „Could Have" eingestuft werden, falls der Meta-App-Review-Prozess
  Tom zu viel Zeit kostet? (Markiert als offene Frage in Dependencies.)

### Story Points: 3
### Priority: Must Have

---

## Story: US-IT7-04 Admin-Bootstrap-Reset — Tom als Admin wiederherstellen

> **Blocker.** Tom kann sich nicht mehr als Admin anmelden. Ursache ist
> unklar: entweder hat der DB-Reset aus US-IT6-06 alle Admin-Accounts
> inklusive Toms gelöscht, oder die Bootstrap-Konfig (`BOOTSTRAP_ADMIN_EMAIL`
> + `/api/admin/setup`) schlägt fehl, weil die Tabelle nicht leer ist (F1:
> 410 GONE wenn `count(users) >= 1`). Diese Story stellt sicher, dass Tom
> binnen Minuten wieder als ACTIVE-Admin agieren kann — ohne Code-Eingriff
> und ohne Datenbankzugang (falls möglich).

**Als** Admin (Tom),
**I want to** einen klar dokumentierten CLI-Befehl oder Web-Pfad haben, der
mich als ACTIVE-Admin in der Datenbank wiederherstellt,
**so that** ich die Admin-Konsole wieder nutzen kann, ohne auf Entwickler-
Unterstützung warten zu müssen.

### Acceptance Criteria

- [ ] Given der Entwickler führt `npx tsx scripts/promote-admin.ts
  hausservice-baerenstark@outlook.com` (oder äquivalent) aus, when das Skript
  läuft, then wird entweder (a) ein neuer Admin-User mit dieser Email und
  Status ACTIVE angelegt, oder (b) ein bestehender User mit dieser Email auf
  Status ACTIVE gesetzt — je nachdem, ob der User existiert.
- [ ] Given das Skript erfolgreich durchgelaufen ist, when Tom die URL
  `/admin/login` aufruft und sein Passwort eingibt, then ist er als
  ACTIVE-Admin eingeloggt.
- [ ] Given das Skript mit einer unbekannten Email aufgerufen wird und kein
  passender User existiert, when es einen neuen User anlegt, then wird ein
  temporäres Passwort generiert, im Terminal ausgegeben und Tom muss es beim
  ersten Login ändern (oder es wird direkt ein Passwort-Reset-Link angezeigt).
- [ ] Given die Users-Tabelle leer ist (vollständiger Reset), when das Skript
  ausgeführt wird, then legt es einen neuen Admin an und setzt
  `BOOTSTRAP_ADMIN_EMAIL` als Vorlage für die Email.
- [ ] Given der Bootstrap-Pfad `/api/admin/setup` aktiviert werden soll (als
  Alternative zum CLI-Skript), when keine ACTIVE-Admins in der Tabelle
  existieren, then ist der Endpoint wieder zugänglich (sendet nicht 410 GONE).
  Wenn mindestens ein ACTIVE-Admin existiert, bleibt er auf 410 GONE
  gesperrt (F1-Sicherheitsgarantie bleibt erhalten).
- [ ] Given Tom das Skript selbst ausführen möchte (ohne Entwickler), when
  die README/Runbook-Dokumentation gelesen wird, then enthält sie einen
  klaren Ein-Zeilen-Befehl und die Voraussetzungen (Node, ENV-Datei).

### Notes
- Implementierung als `scripts/promote-admin.ts <email> [--password <pwd>]`.
- Das Skript muss `ALLOW_ADMIN_PROMOTE=true` als ENV-Guard verlangen
  (analog zu `ALLOW_USER_WIPE` aus US-IT6-06) — verhindert versehentliches
  Ausführen.
- Sicherheitshinweis: Das Skript darf NIEMALS über eine HTTP-Route erreichbar
  sein — nur als lokales CLI-Tool.
- Passwort-Hashing: bcrypt, gleiche Implementierung wie Admin-Passwort in
  IT1.
- Falls der Bootstrap-Pfad-Ansatz (AC 5) bevorzugt wird: F1-Bedingung wird
  erweitert zu „count(ACTIVE users) >= 1 → 410 GONE" statt „count(users) >= 1
  → 410 GONE". Architekt muss entscheiden, welche Variante umgesetzt wird.
  (Offene Frage für Architekten: CLI-Skript bevorzugt wegen Sicherheit oder
  Bootstrap-Pfad für Self-Service?)

### Story Points: 2
### Priority: Must Have — BLOCKER

---

## Story: US-IT7-05 Passwort-Reset-Flow End-to-End funktional (Kunden)

> **Abhängig von US-IT7-01.** Die Endpoints `POST /api/customer/forgot-password`
> und `POST /api/customer/reset-password` wurden in IT6 (D3-Fix) gelöscht.
> Mit der Wiederherstellung der Email-Auth in US-IT7-01 müssen diese Endpoints
> zurück — und der gesamte Reset-Flow muss als E2E-Szenario getestet sein.

**Als** Kunde,
**I want to** mein Passwort zurücksetzen können, wenn ich es vergessen habe,
**so that** ich wieder Zugang zu meinem Konto erhalte, ohne ein neues Konto
anlegen zu müssen.

### Acceptance Criteria

- [ ] Given ich rufe `/konto/passwort-vergessen` auf und gebe meine
  Email-Adresse ein, when ich auf „Link anfordern" klicke, then erhalte ich
  innerhalb von 2 Minuten eine deutschsprachige Email (via Resend) mit einem
  Reset-Link — auch wenn kein Account mit dieser Email existiert, erscheint
  dieselbe neutrale Meldung „Falls diese Adresse registriert ist, erhalten
  Sie eine E-Mail." (keine Kontoexistenz-Preisgabe).
- [ ] Given ich klicke auf den Reset-Link in der Email, when der Link
  aufgerufen wird und noch gültig ist (max. 1 Stunde, single-use), then sehe
  ich die Seite `/konto/passwort-zuruecksetzen` mit zwei Feldern: „Neues
  Passwort" und „Passwort bestätigen".
- [ ] Given ich gebe ein neues Passwort (mind. 8 Zeichen) ein, das in beiden
  Feldern übereinstimmt, and klicke „Passwort ändern", when die Anfrage
  verarbeitet wird, then wird das neue Passwort gespeichert (bcrypt-gehashed),
  der Token invalidiert und ich werde zu `/konto/login` mit der Meldung
  „Passwort erfolgreich geändert. Bitte melden Sie sich an." weitergeleitet.
- [ ] Given ich kann mich nach dem Reset mit dem neuen Passwort einloggen, when
  ich Email und neues Passwort eingebe, then werde ich zu `/konto`
  weitergeleitet.
- [ ] Given ich rufe einen abgelaufenen Reset-Link auf (älter als 1 Stunde),
  when die Seite lädt, then sehe ich die Fehlermeldung „Dieser Link ist nicht
  mehr gültig. Bitte fordern Sie einen neuen Reset-Link an." mit Link zu
  `/konto/passwort-vergessen`.
- [ ] Given ich rufe einen bereits verwendeten Reset-Link erneut auf, when die
  Seite lädt, then erscheint dieselbe Fehlermeldung wie bei abgelaufenem Link
  (Token wurde nach Nutzung invalidiert).
- [ ] Given `POST /api/customer/forgot-password` mit einer gültigen Email
  aufgerufen wird, when die Rate-Limit-Grenze überschritten wird (z.B. mehr
  als 5 Anfragen in 15 Minuten von derselben IP), then antwortet der Endpoint
  mit HTTP 429 (Too Many Requests).

### Notes
- Token-Generierung: `crypto.randomBytes(32)` → Base64url-enkodiert → als
  SHA-256-Hash in der Datenbank gespeichert (nicht der Klartext-Token).
  Token-Ablauf: 1 Stunde nach Ausstellung. Nach Nutzung sofort invalidiert
  (`usedAt`-Timestamp setzen oder Record löschen).
- Email-Template auf Deutsch: Betreff „Passwort zurücksetzen —
  Bärenstark Hausservice", Inhalt mit Reset-Link und Ablaufhinweis „Link
  gültig für 1 Stunde".
- Rate-Limiting auf `POST /api/customer/forgot-password` und
  `POST /api/customer/reset-password` via bestehendem Upstash-Stack.
- Das Datenbankschema benötigt eine `PasswordResetToken`-Tabelle oder ein
  gleichwertiges Feld auf `CustomerUser` (Architekt entscheidet Variante).
- DTO-Garantie: `POST /api/customer/reset-password` darf niemals
  `passwordHash` in der Response zurückgeben.

### Story Points: 3
### Priority: Must Have

---

## Dependencies

- US-IT7-01 muss vor US-IT7-05 abgeschlossen sein (Endpoints müssen
  existieren bevor der Reset-Flow getestet wird).
- US-IT7-04 ist vollständig unabhängig von US-IT7-01 bis US-IT7-03 —
  BLOCKER, sollte zuerst bearbeitet werden.
- US-IT7-02 und US-IT7-03 sind unabhängig voneinander und können parallel
  entwickelt werden.
- US-IT7-02 und US-IT7-03 sind unabhängig von US-IT7-01 — OAuth-Reparatur
  berührt nur `customer-oauth.ts` und ENV-Konfiguration, nicht die
  Email/Password-Endpoints.
- US-IT7-05 hängt logisch von US-IT7-01 ab (gleiche Endpoints, gleiches
  Email-Auth-System).

## Offene Fragen für den Architekten

1. **US-IT7-04 Variante:** CLI-Skript `promote-admin.ts` (bevorzugt wegen
   Sicherheit) ODER Bootstrap-Pfad `/api/admin/setup` mit erweiterter
   F1-Bedingung (Self-Service für Tom)?
2. **US-IT7-03 Priorität:** Soll Facebook OAuth `Must Have` bleiben oder auf
   `Should Have` herabgestuft werden, wenn sich die Meta-App-Konfiguration
   als aufwendig erweist (App-Domain-Verifikation, Live-Schaltung)? Tom
   sollte hier entscheiden.
3. **US-IT7-05 Token-Storage:** `PasswordResetToken`-Tabelle (sauberes
   Schema) ODER Hash-Feld direkt auf `CustomerUser`
   (`resetTokenHash`, `resetTokenExpiresAt`)?
4. **US-IT7-01 Verifizierungs-Pflicht:** Bestätigung, dass Email-Verifizierung
   optional (kein harter Login-Block) korrekt ist — oder soll Tom einen
   harten Block wünschen?
