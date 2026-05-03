# Google-OAuth einrichten — Schritt für Schritt für Tom

> Diese Anleitung führt dich von Anfang bis Ende durch die Konfiguration der
> Google-Anmeldung für `baerenstark-hausservice.app`. Sie ist auf Deutsch
> verfasst, ohne Fachbegriffe, und du brauchst keinen technischen Hintergrund.
> Plane circa 20 Minuten Zeit ein und nutze möglichst einen Desktop-Computer
> (am Smartphone ist die Google-Konsole schwer bedienbar).
>
> Wenn am Ende etwas nicht funktioniert: in **Sektion 8** stehen die häufigsten
> Fehler mit ihrer Bedeutung und der Lösung dazu.

---

## Inhaltsverzeichnis

1. Voraussetzungen
2. Google Cloud Console öffnen und Projekt auswählen
3. OAuth-Consent-Screen konfigurieren
4. OAuth-Client-ID finden oder anlegen
5. Redirect-URIs eintragen (mit exakten URLs)
6. Client-ID und Client-Secret in Vercel-Umgebungsvariablen eintragen
7. Diagnose-Endpoint nutzen — Selbst-Check
8. Häufige Fehler und ihre Bedeutung
9. Wenn nichts hilft

---

## 1. Voraussetzungen

Bevor du loslegst, vergewissere dich, dass du Folgendes parat hast:

- **Ein Google-Konto.** Bestenfalls dein geschäftliches Konto bei Bärenstark.
  Mit diesem Konto wirst du Inhaber des Google-OAuth-Clients sein. Wenn du
  noch kein Google-Konto hast, lege dir eines an (`https://accounts.google.com/signup`).

- **Zugang zum Vercel-Dashboard.** Das ist die Plattform, auf der die Webseite
  läuft. Login-URL: `https://vercel.com/login`. Falls du dein Passwort nicht
  weißt, nutze „Forgot password" auf der Login-Seite.

- **15 bis 20 Minuten ungestörte Zeit.** Es lohnt sich nicht, mittendrin zu
  unterbrechen — du verlierst sonst den roten Faden.

- **Ein Desktop- oder Laptop-Rechner.** Die Google-Konsole hat sehr kleine
  Schaltflächen, die am Smartphone schwer zu treffen sind.

- **Idealerweise zwei Browser-Tabs nebeneinander offen:** einer für die Google
  Cloud Console, einer für Vercel. Du wechselst zwischen beiden hin und her.

> Du brauchst KEINE Programmier-Kenntnisse. Du brauchst auch nicht die
> Webseite oder den Code anzufassen — alles, was du tust, läuft entweder im
> Browser auf der Google-Konsole oder im Browser auf Vercel.

---

## 2. Google Cloud Console öffnen und Projekt auswählen

1. Öffne in deinem Browser: **`https://console.cloud.google.com/`**

2. Logge dich mit deinem Google-Konto (siehe Sektion 1) ein. Falls Google
   dich fragt, ob du den Nutzungsbedingungen zustimmst, klicke auf
   **„Akzeptieren"**.

3. **Projekt auswählen oder anlegen:**

   Oben in der dunkelblauen Leiste, etwa in der Mitte links, siehst du einen
   Bereich, der entweder „Projekt auswählen" oder einen vorhandenen
   Projekt-Namen anzeigt. Klicke darauf.

   Ein Modal öffnet sich mit einer Liste deiner Projekte und rechts oben
   einem blauen Button **„NEUES PROJEKT"**.

   - **Falls du noch kein Projekt für Bärenstark hast:** Klicke auf
     **„NEUES PROJEKT"**.
     - Im Feld „Projektname" gibst du ein: `baerenstark-hausservice`
     - Das Feld „Organisation" lässt du leer (oder den Default).
     - Klicke unten auf **„ERSTELLEN"**.
     - Warte 10-30 Sekunden. Oben rechts erscheint eine Benachrichtigung,
       dass das Projekt erstellt wurde. Klicke darauf, oder klicke erneut
       oben in der Leiste auf den Projekt-Picker und wähle dein neues Projekt.

   - **Falls du schon ein Projekt für Bärenstark hast:** Klicke darauf in
     der Liste. Verifiziere oben in der Leiste, dass jetzt der korrekte
     Projektname steht (z.B. „baerenstark-hausservice").

> **Wichtig:** ALLE folgenden Schritte beziehen sich auf das gerade
> ausgewählte Projekt. Wenn du dich versehentlich in einem anderen Projekt
> wiederfindest, sind deine Einstellungen am falschen Ort und Google-Login
> wird nicht funktionieren. Prüfe oben in der dunkelblauen Leiste regelmäßig
> den Projektnamen.

---

## 3. OAuth-Consent-Screen konfigurieren

Der „Consent-Screen" ist der Bildschirm, den deine Kunden später sehen, wenn
sie sich mit Google bei Bärenstark einloggen. Google verlangt, dass du
einmalig einrichtest, was dort erscheint.

1. Klicke links oben auf das **Burger-Menü** (drei waagerechte Striche). Es
   öffnet sich eine Seitenleiste.

2. Wähle **„APIs und Dienste"** → **„OAuth-Zustimmungsbildschirm"**.

3. **Falls du den Consent-Screen noch nie konfiguriert hast,** wirst du
   gefragt, welchen User-Type du wählen willst:
   - Wähle **„Extern"** (= alle Google-Nutzer können sich anmelden).
   - Klicke **„ERSTELLEN"**.

4. **Pflichtfelder ausfüllen:**
   - **App-Name:** `Bärenstark Hausservice`
   - **Nutzersupport-E-Mail:** deine geschäftliche E-Mail-Adresse.
   - **App-Logo:** optional. Kannst du leer lassen.
   - **Scrollen bis „Autorisierte Domains":**
     - Klicke **„+ DOMAIN HINZUFÜGEN"** und trage ein:
       `baerenstark-hausservice.app`
     - (Ohne `https://`, ohne Slash am Ende — nur die nackte Domain.)
   - **Entwickler-Kontaktdaten:** deine E-Mail-Adresse.
   - Klicke unten **„SPEICHERN UND FORTFAHREN"**.

5. **Scopes** (zweite Seite): Du musst hier KEINEN Scope hinzufügen.
   Klicke direkt **„SPEICHERN UND FORTFAHREN"**. Bärenstark braucht nur die
   Standard-Scopes (E-Mail, Name, Profilbild), die Google automatisch zur
   Verfügung stellt.

6. **Test-User** (dritte Seite): Du musst hier keinen Test-User eintragen,
   wenn du gleich auf „In Produktion" gehst (siehe Schritt 7).
   Klicke **„SPEICHERN UND FORTFAHREN"**.

7. **Veröffentlichen ist Pflicht.** Sonst können sich nur Test-Konten anmelden.
   - Du landest jetzt auf der Übersicht des Consent-Screens. Oben siehst du
     ein Status-Feld. Steht dort **„Test"**, dann klicke auf den Button
     **„APP VERÖFFENTLICHEN"** (gelbe oder blaue Schaltfläche).
   - Google fragt dich noch einmal: **„Bestätigen"**.

   > **Keine Sorge — kein App-Review erforderlich.** Bärenstark verwendet nur
   > die Basis-Scopes `email`, `profile` und `openid`. Für diese Scopes
   > prüft Google deine App nicht — die Veröffentlichung geht direkt durch.

   Nach erfolgreichem Veröffentlichen steht der Status auf **„In Produktion"**.

---

## 4. OAuth-Client-ID finden oder anlegen

Hier erzeugst (oder bearbeitest) du die Zugangsdaten, mit denen die Webseite
mit Google reden darf.

1. Im Burger-Menü: **„APIs und Dienste"** → **„Anmeldedaten"**.

2. Du landest auf einer Seite mit verschiedenen Tabellen. Suche die
   Tabelle mit dem Header **„OAuth 2.0-Client-IDs"**.

3. **Falls du dort schon einen Eintrag für Bärenstark hast:** Klicke auf
   den Namen des Eintrags. Du landest in der Detail-Ansicht. Springe zu
   **Sektion 5** (Redirect-URIs eintragen).

4. **Falls noch kein Eintrag existiert:** Klicke oben auf **„+ ANMELDEDATEN
   ERSTELLEN"** und im Drop-Down auf **„OAuth-Client-ID"**.
   - **Anwendungstyp:** wähle **„Webanwendung"**.
   - **Name:** `Bärenstark Web` (Name dient nur dir zur Wiedererkennung).
   - **Autorisierte JavaScript-Quellen:** kannst du leer lassen.
   - **Autorisierte Weiterleitungs-URIs:** lass auch leer — die füllst du
     im nächsten Schritt aus.
   - Klicke unten auf **„ERSTELLEN"**.

5. **WICHTIG:** Direkt nach dem Erstellen erscheint ein Modal mit deiner
   neuen **Client-ID** und einem **Client-Secret**. Kopiere BEIDE Werte in
   ein sicheres Notiz-Dokument (z.B. einen Password-Manager). Das Client-
   Secret wird dir später nicht mehr im Klartext angezeigt — wenn du es
   verlierst, musst du es zurücksetzen lassen.

   Beide Werte brauchst du in **Sektion 6** (Vercel-Eintragung).

6. Schließe das Modal und klicke auf den gerade erstellten Eintrag in der
   Tabelle, um in die Detail-Ansicht zu gelangen.

---

## 5. Redirect-URIs eintragen (mit exakten URLs)

Das ist der Schritt, an dem die meisten Setup-Fehler passieren. Lies ihn
sorgfältig.

Eine „Redirect-URI" ist die genaue Webadresse, an die Google den Kunden
zurückschickt, nachdem er sich angemeldet hat. **Sie muss BUCHSTABENGENAU
mit der URL übereinstimmen, die unsere Webseite verwendet.** Schon ein
falscher Slash oder ein falsches Wort führt zu einem Fehler.

1. Du befindest dich in der Detail-Ansicht deiner OAuth-Client-ID (siehe
   Sektion 4 Schritt 3 oder 6).

2. Scrolle nach unten zum Abschnitt **„Autorisierte Weiterleitungs-URIs"**.
   Darunter ist ein Eingabefeld mit einem Plus-Button **„+ URI HINZUFÜGEN"**.

3. **Klicke auf „+ URI HINZUFÜGEN"** und füge die folgende URL ein —
   Buchstabe für Buchstabe identisch zu dem, was unten steht:

   ```
   https://www.baerenstark-hausservice.app/api/auth/customer/callback/google
   ```

4. **Achtung — der Pfad enthält das Wort `customer`.** Wenn du gewohnt bist,
   bei Google-Setups `…/api/auth/callback/google` einzutragen, vergiss
   das hier — Bärenstark verwendet einen separaten Pfad für Kunden-Logins.
   Das `customer` zwischen `auth` und `callback` MUSS dabei sein.

5. **Achte auf:**
   - **Kein** Slash am Ende der URL (kein `/google/`).
   - Klein geschrieben (kein `Google`, sondern `google`).
   - `https://`, nicht `http://`.
   - `www.` davor.

6. **Optional — nur falls die Webseite auch lokal entwickelt wird:** Klicke
   erneut auf **„+ URI HINZUFÜGEN"** und füge zusätzlich diese URL hinzu:

   ```
   http://localhost:3000/api/auth/customer/callback/google
   ```

   (Das brauchst du im Normalbetrieb nicht — diese URL ist für den
   Backend-Engineer beim lokalen Entwickeln. Wenn du dir unsicher bist:
   trag sie mit ein, schadet nichts.)

7. Klicke unten in der Detail-Ansicht auf **„SPEICHERN"**.

8. Google zeigt dir eine grüne Bestätigung. Manchmal dauert es bis zu
   5 Minuten, bis die Änderung weltweit aktiv ist.

> **Pro-Tipp:** Wenn du später den Fehler `redirect_uri_mismatch` siehst,
> komm hierher zurück und vergleiche Buchstabe für Buchstabe.

---

## 6. Client-ID und Client-Secret in Vercel-Umgebungsvariablen eintragen

Jetzt teilst du der Webseite mit, welche Zugangsdaten sie für Google
verwenden soll.

1. Öffne in einem neuen Browser-Tab: **`https://vercel.com/`**

2. Logge dich ein. Du siehst eine Übersicht deiner Projekte.

3. **Klicke auf das Bärenstark-Projekt** (heißt vermutlich
   „baerenstark-hausservice" oder ähnlich).

4. Oben in der Leiste siehst du Tabs: **„Overview", „Deployments", „Logs",
   „Settings"** etc. Klicke auf **„Settings"**.

5. In der linken Seitenleiste der Settings siehst du eine Liste. Klicke auf
   **„Environment Variables"**.

6. Du siehst eine Übersicht aller bereits gesetzten Variablen plus oben ein
   Formular **„Add new"** (oder ein Knopf „Add Another").

7. **Variable 1 — `GOOGLE_CLIENT_ID`:**
   - **Key (oder Name):** `GOOGLE_CLIENT_ID` (genau so geschrieben,
     komplett groß).
   - **Value:** der Client-ID-Wert, den du in Sektion 4 Schritt 5 kopiert
     hast (eine lange Zeichenkette, die meistens mit einer Zahl beginnt
     und mit `.apps.googleusercontent.com` endet).
   - **Environments:** setze die Häkchen bei allen drei: **Production**,
     **Preview**, **Development**.
   - Klicke auf **„Save"**.

8. **Variable 2 — `GOOGLE_CLIENT_SECRET`:**
   - Klicke erneut auf „Add Another" (oder das Plus-Icon).
   - **Key:** `GOOGLE_CLIENT_SECRET`
   - **Value:** der Client-Secret-Wert aus Sektion 4 Schritt 5.
   - **Environments:** wieder alle drei Häkchen.
   - Klicke **„Save"**.

9. **Diese zwei zusätzlichen Variablen müssen ebenfalls gesetzt sein** — sind
   sie wahrscheinlich schon, weil der Engineer sie in einer früheren
   Iteration eingetragen hat. Verifiziere die Existenz in der Liste:

   - **`NEXTAUTH_URL`** — sollte auf `https://www.baerenstark-hausservice.app`
     stehen (kein Slash am Ende, mit `https://`).
   - **`AUTH_SECRET`** — wird dir nicht im Klartext angezeigt; das ist
     normal. Der Eintrag muss aber in der Liste vorhanden sein.
   - **`AUTH_TRUST_HOST`** — Wert: `true` (kleingeschrieben).

   Falls eine davon fehlt: lege sie an wie oben beschrieben. `AUTH_SECRET`
   und `NEXTAUTH_URL` MUSST du beim Engineer erfragen, wenn du die Werte
   nicht kennst.

10. **Variablen werden erst beim nächsten Deploy aktiv.**
    - Klicke oben in der Tab-Leiste auf **„Deployments"**.
    - Suche das oberste Deployment (= das aktuelle Production-Deployment).
    - Rechts daneben siehst du drei Punkte (`...`). Klicke darauf.
    - Wähle **„Redeploy"** und bestätige.
    - Warte 1-3 Minuten, bis das Deployment „Ready" anzeigt.

> **Wichtig:** Solange du nicht „Redeploy" geklickt hast, sind deine
> Änderungen NICHT aktiv. Vercel cached die alte Konfiguration, bis ein
> neuer Build läuft.

---

## 7. Diagnose-Endpoint nutzen — Selbst-Check

Bärenstark hat einen kleinen Diagnose-Endpoint eingebaut, der dir
auf einen Blick sagt, ob alles richtig konfiguriert ist. Du musst nur eine
Webadresse aufrufen und das Ergebnis ablesen.

1. **Voraussetzung — einmalig in Vercel-ENV setzen:**
   - In Vercel → Settings → Environment Variables (Sektion 6).
   - Lege eine neue Variable an:
     - **Key:** `AUTH_DIAGNOSE_ENABLED`
     - **Value:** `true`
     - **Environments:** alle drei Häkchen.
   - Klicke **„Save"**.
   - Mache erneut **„Redeploy"** (siehe Sektion 6 Schritt 10).

2. Öffne in deinem Browser:

   ```
   https://www.baerenstark-hausservice.app/api/auth/diagnose
   ```

3. Du siehst einen Block mit Text — sieht aus wie ein Code-Auszug. Ganz oben
   steht ein Bereich namens **`verdict`**. Lies dort das Feld
   **`actionRequired`**:

   | Wert | Was es bedeutet |
   |------|-----------------|
   | `"none"` | Alles grün. Login sollte sofort funktionieren. |
   | `"config"` | Code ist OK, aber DU musst noch etwas einstellen. Im Block `configActions` darunter steht, was. Liste durchgehen, dann erneut prüfen. |
   | `"code"` | STOP. Es gibt einen Fehler im Code. **Engineer kontaktieren.** Du kannst nichts tun. |

4. **Vergleiche dein Setup gegen die erwarteten Werte:**
   - Suche im Output das Feld **`expectedCallbacks.googleC`**. Dort steht
     genau die URL, die in Google in der Liste der Redirect-URIs (Sektion 5)
     eingetragen sein muss. Wenn du nicht 100%-ig sicher bist, dass dein
     Eintrag in Google identisch ist: Sektion 5 noch einmal abarbeiten.

5. **Sicherheitshinweis — entferne den Diagnose-Zugang nach dem Test:**
   - Sobald `verdict.actionRequired` auf `"none"` steht und der Login
     funktioniert: Geh zurück nach Vercel → Settings → Environment Variables.
   - Suche `AUTH_DIAGNOSE_ENABLED`, klicke auf die drei Punkte daneben
     und wähle **„Remove"**.
   - **Redeploy** klicken (Sektion 6 Schritt 10).
   - Dieser Schritt ist Pflicht: Der Diagnose-Endpoint zeigt
     Konfigurations-Hinweise, die in einem produktiven System nicht
     öffentlich abrufbar sein sollen.

---

## 8. Häufige Fehler und ihre Bedeutung

Wenn der Login fehlschlägt, siehst du im Browser meist einen englischen
Fehler-Code. Hier die häufigsten:

| Fehler-Symptom | Was passiert ist | Was du tun musst |
|----------------|------------------|------------------|
| `redirect_uri_mismatch` | Google sagt: Die Redirect-URI, die unsere Webseite gerade benutzt, steht NICHT in deiner Liste der erlaubten URIs. | **Sektion 5** noch einmal sorgfältig prüfen. Rufe `/api/auth/diagnose` auf, lies das Feld `expectedCallbacks.googleC` ab und trage GENAU diesen String in der Google-Konsole als Redirect-URI ein. Achte auf Tippfehler, Slash am Ende, Groß-/Kleinschreibung. |
| `invalid_client` | Client-ID oder Client-Secret stimmen nicht. | **Sektion 4 + 6** prüfen. Hast du die Werte aus dem RICHTIGEN Google-Projekt kopiert? Sind in Vercel beide Variablen `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` korrekt eingetragen? Nach Korrektur unbedingt **Redeploy** klicken. |
| `access_denied` | Du hast im Google-Login-Bildschirm auf „Abbrechen" geklickt. | Kein echter Fehler. Versuche den Login einfach erneut und klicke diesmal auf „Zulassen". |
| Weiße Seite, kein Login-Formular | Wahrscheinlich fehlt `AUTH_SECRET` oder `NEXTAUTH_URL` ist falsch. | **Sektion 6 Schritt 9** durchgehen und beide Variablen verifizieren. Danach `/api/auth/diagnose` (Sektion 7) aufrufen. |
| „Bad request" beim Klick auf „Mit Google anmelden" | `NEXTAUTH_URL` ist falsch (z.B. mit Slash am Ende) oder `AUTH_TRUST_HOST` fehlt. | **Sektion 6 Schritt 9** prüfen: `NEXTAUTH_URL=https://www.baerenstark-hausservice.app` (ohne Slash am Ende!) und `AUTH_TRUST_HOST=true`. Danach **Redeploy**. |
| Login klappt nur mit deinem Google-Konto, andere Kunden bekommen einen Fehler | Der OAuth-Consent-Screen steht noch auf „Test", nicht auf „In Produktion". | **Sektion 3 Schritt 7** abarbeiten: App veröffentlichen. |

---

## 9. Wenn nichts hilft

Wenn du alle Schritte sorgfältig durchgegangen bist, der Diagnose-Endpoint
`actionRequired: "none"` zeigt und der Login trotzdem nicht funktioniert:

1. **Browser-Cookies löschen** oder **Inkognito-Tab öffnen** und dort den
   Login probieren. Manchmal hängen alte Sitzungen im Browser fest.

2. Wenn das nicht hilft, kontaktiere den Backend-Engineer mit folgenden
   Infos in deiner Nachricht:

   - Den vollständigen Output von `https://www.baerenstark-hausservice.app/api/auth/diagnose`
     (Copy-Paste der Webseite).
   - Die exakte Fehlermeldung, die im Browser angezeigt wird.
   - Ein Screenshot der Google-Konsole-Detail-Ansicht deiner OAuth-Client-ID
     (insbesondere die Liste der Redirect-URIs aus Sektion 5).

   Mit diesen drei Informationen kann der Engineer in unter fünf Minuten
   sagen, woran es liegt.

---

**Stand:** 2026-05-03 — Iteration 9 / US-IT9-04

**Pfad-Verifikation:** Die in Sektion 5 verwendeten Redirect-URIs entsprechen
exakt dem Feld `expectedCallbacks.googleC` aus
`/Users/.../src/app/api/auth/diagnose/route.ts:165`
(NextAuth-Customer-Handler liegt unter
`src/app/api/auth/customer/[...nextauth]/route.ts`).
