# Facebook-OAuth einrichten — Schritt für Schritt für Tom

> Diese Anleitung führt dich von Anfang bis Ende durch die Konfiguration der
> Facebook-Anmeldung („Mit Facebook anmelden") für `baerenstark-hausservice.app`.
> Sie ist auf Deutsch verfasst, ohne Fachbegriffe, und du brauchst keinen
> technischen Hintergrund. Plane circa 25 Minuten Zeit ein und nutze möglichst
> einen Desktop-Computer (am Smartphone ist das Meta Developer Portal schwer
> bedienbar).
>
> Die Struktur dieser Anleitung ist absichtlich identisch zum
> **Google-Setup-Guide** (`docs/GOOGLE_OAUTH_SETUP_GUIDE.md`). Wenn du den
> kennst, fühlt sich das hier sehr vertraut an — es gibt aber zwei
> Facebook-Besonderheiten, auf die du achten musst:
>
> 1. **Privacy-Policy-URL ist Pflicht** — Meta lässt dich ohne diese URL
>    nicht in den „Live"-Modus.
> 2. **App muss von „Entwicklung" auf „Live" geschaltet werden** — vergisst
>    du das, können sich nur Test-Konten anmelden.
>
> Beide Schritte stehen ausführlich weiter unten.
>
> Wenn am Ende etwas nicht funktioniert: in **Sektion 9** stehen die
> häufigsten Fehler mit ihrer Bedeutung und der Lösung dazu.

---

## Inhaltsverzeichnis

1. Voraussetzungen
2. Meta Developer Portal öffnen und App anlegen
3. Facebook Login zur App hinzufügen
4. App-Domain und Site-URL eintragen (mit Privacy-Policy-URL)
5. Valid OAuth Redirect URIs eintragen (mit exakten URLs)
6. App-ID und App-Secret kopieren
7. App-ID und App-Secret in Vercel-Umgebungsvariablen eintragen
8. App von „Entwicklung" auf „Live" schalten
9. Diagnose-Endpoint nutzen — Selbst-Check
10. Häufige Fehler und ihre Bedeutung
11. Wenn nichts hilft

---

## 1. Voraussetzungen

Bevor du loslegst, vergewissere dich, dass du Folgendes parat hast:

- **Ein Facebook-Konto.** Bestenfalls dein geschäftliches Konto bei
  Bärenstark. Mit diesem Konto wirst du Inhaber der Meta-Developer-App sein.
  Wenn du noch kein Facebook-Konto hast, lege dir eines an
  (`https://www.facebook.com/r.php`).

- **Zugang zum Vercel-Dashboard.** Das ist die Plattform, auf der die
  Webseite läuft. Login-URL: `https://vercel.com/login`. Falls du dein
  Passwort nicht weißt, nutze „Forgot password" auf der Login-Seite.

- **Eine erreichbare Privacy-Policy-URL.** Meta verlangt für den Live-Mode
  eine öffentlich abrufbare Datenschutz-Erklärung. Bei Bärenstark ist das
  in der Regel:

  ```
  https://www.baerenstark-hausservice.app/datenschutz
  ```

  Öffne diese URL einmal im Browser und überprüfe, dass die Seite lädt.
  Falls nicht: Engineer kontaktieren, BEVOR du im Meta Portal startest —
  ohne diese URL kommst du in **Sektion 4** nicht weiter.

- **20 bis 25 Minuten ungestörte Zeit.** Es lohnt sich nicht, mittendrin
  zu unterbrechen — du verlierst sonst den roten Faden.

- **Ein Desktop- oder Laptop-Rechner.** Das Meta Developer Portal hat sehr
  kleine Schaltflächen, die am Smartphone schwer zu treffen sind.

- **Idealerweise zwei Browser-Tabs nebeneinander offen:** einer für das
  Meta Developer Portal, einer für Vercel. Du wechselst zwischen beiden
  hin und her.

> Du brauchst KEINE Programmier-Kenntnisse. Du brauchst auch nicht die
> Webseite oder den Code anzufassen — alles, was du tust, läuft entweder im
> Browser auf dem Meta Developer Portal oder im Browser auf Vercel.

---

## 2. Meta Developer Portal öffnen und App anlegen

1. Öffne in deinem Browser: **`https://developers.facebook.com/`**

2. Logge dich oben rechts mit deinem Facebook-Konto (siehe Sektion 1) ein.
   Falls Meta dich fragt, ob du den „Platform Terms" und „Developer
   Policies" zustimmst, klicke auf **„I Accept" / „Akzeptieren"**.

3. **App anlegen oder vorhandene App auswählen:**

   Oben in der Navigation klicke auf **„Meine Apps"** (englisch: „My Apps").
   Du landest auf einer Übersichtsseite mit deinen bestehenden Apps und
   rechts oben einem grünen Button **„App erstellen"** (englisch: „Create App").

   - **Falls du noch keine App für Bärenstark hast:** Klicke auf
     **„App erstellen"**.

     Meta fragt dich nach dem **App-Typ**. Die Auswahl variiert leicht je
     nach Meta-Version — du siehst meistens diese Optionen:
     - „Consumer" (oder neu: „Verbraucher")
     - „Business" (oder neu: „Unternehmen")
     - „Other" (oder „Andere")

     **Wähle „Consumer".** Bärenstark verwendet Facebook nur, damit private
     Endkunden sich mit ihrem Facebook-Konto einloggen können — das ist
     genau der „Consumer"-Use-Case. „Business" ist für Werbe-/Marketing-
     APIs gedacht, die du nicht brauchst.

     Klicke **„Weiter"** / **„Next"**.

     Auf der nächsten Seite trage ein:
     - **App-Name (Anzeigename):** `Bärenstark Hausservice`
       (Diesen Namen sehen deine Kunden später im Facebook-Login-Dialog.)
     - **App-Kontakt-E-Mail:** deine geschäftliche E-Mail-Adresse.
     - **Business-Konto:** lass leer (oder den Default).

     Klicke **„App erstellen"** und löse ggf. eine Sicherheitsabfrage
     (Passwort erneut eingeben) aus.

   - **Falls du schon eine App für Bärenstark hast:** Klicke darauf in
     der Liste. Du landest direkt im **App-Dashboard**.

> **Wichtig:** ALLE folgenden Schritte beziehen sich auf die gerade
> ausgewählte App. Wenn du dich versehentlich in einer anderen App
> wiederfindest, sind deine Einstellungen am falschen Ort und Facebook-Login
> wird nicht funktionieren. Prüfe oben links im Portal regelmäßig den
> App-Namen und die App-ID.

---

## 3. Facebook Login zur App hinzufügen

Standardmäßig hat eine neue Meta-App noch kein Login-Produkt aktiviert.
Das musst du einmalig hinzufügen.

1. Im App-Dashboard siehst du in der linken Seitenleiste den Punkt
   **„Produkte hinzufügen"** (englisch: „Add Products" oder „Add a Product").
   Klicke darauf.

2. Du landest auf einer Seite mit Produkt-Kacheln. Suche die Kachel
   **„Facebook Login"** (Symbol: weißes „f" auf blau).

3. Klicke auf der Facebook-Login-Kachel auf **„Set Up"** / **„Einrichten"**.

4. Meta fragt dich nach der **Plattform**. Du siehst Optionen wie
   „iOS", „Android", „Web", „Other". **Wähle „Web"**.

5. Auf der nächsten Seite fragt Meta nach der **Site URL** für eine
   Schnell-Konfiguration. Du kannst hier eintragen:

   ```
   https://www.baerenstark-hausservice.app
   ```

   Klicke **„Speichern"** / **„Save"** und danach **„Weiter"** / **„Continue"**.

6. **Du musst die Quickstart-Schritte 3 bis 5 NICHT durchlaufen** (das ist
   Code-Setup, den der Engineer schon erledigt hat). Klicke einfach links in
   der Seitenleiste weiter — du siehst jetzt unter
   **„Produkte"** den Eintrag **„Facebook Login"** mit den Unterpunkten
   **„Quickstart"** und **„Einstellungen"**.

> Falls in der Seitenleiste statt „Facebook Login" nur ein graues
> „Facebook-Login" mit Hinweis „nicht eingerichtet" steht: Wiederhole
> Schritt 1–3, du hast wahrscheinlich vorzeitig den Tab geschlossen.

---

## 4. App-Domain und Site-URL eintragen (mit Privacy-Policy-URL)

Damit Facebook deine Webseite überhaupt als gültiges Ziel akzeptiert, musst
du die Domain einmalig im App-Dashboard hinterlegen — UND die
Privacy-Policy-URL setzen, die Meta für den Live-Mode verlangt.

1. In der linken Seitenleiste klicke auf **„Einstellungen"** → **„Allgemeines"**
   (englisch: „Settings" → „Basic").

2. Du siehst eine Seite mit vielen Feldern. Fülle aus / verifiziere:

   - **App-Domains:**
     Klicke ins Feld und tippe ein:
     ```
     www.baerenstark-hausservice.app
     ```
     (Ohne `https://`, ohne Slash am Ende — nur die nackte Domain.)
     Drücke **Enter**, sodass die Domain als blauer „Tag" erscheint.

   - **Privacy Policy URL** (deutsch: „URL für Datenschutzrichtlinien"):
     Trage ein:
     ```
     https://www.baerenstark-hausservice.app/datenschutz
     ```
     **Dies ist Pflichtfeld für den Live-Mode.** Lässt du es leer, kannst
     du in **Sektion 8** die App nicht auf „Live" schalten.

   - **Nutzungsbedingungen URL** (englisch: „Terms of Service URL"):
     Optional, aber empfohlen. Trage ein:
     ```
     https://www.baerenstark-hausservice.app/agb
     ```
     (Falls die Seite nicht existiert, lass das Feld leer — Meta
     verlangt es nicht zwingend.)

   - **Kategorie** (englisch: „Category"):
     Wähle aus dem Drop-Down z.B. **„Business and Pages"** oder
     **„Local Service"** — die genaue Wahl ist nicht kritisch.

3. Scrolle ganz nach unten und klicke **„Änderungen speichern"** /
   **„Save Changes"**.

> **Stolperfalle:** Wenn die Privacy-Policy-URL nicht öffentlich erreichbar
> ist (z.B. weil die Webseite gerade ein Deployment-Problem hat), zeigt
> Meta in **Sektion 8** beim Umschalten auf „Live" eine rote Fehlermeldung.
> Verifiziere die URL einmal in einem Inkognito-Tab, BEVOR du weitermachst.

---

## 5. Valid OAuth Redirect URIs eintragen (mit exakten URLs)

Das ist der Schritt, an dem die meisten Setup-Fehler passieren. Lies ihn
sorgfältig.

Eine „Redirect-URI" ist die genaue Webadresse, an die Facebook den Kunden
zurückschickt, nachdem er sich angemeldet hat. **Sie muss BUCHSTABENGENAU
mit der URL übereinstimmen, die unsere Webseite verwendet.** Schon ein
falscher Slash oder ein falsches Wort führt zu einem Fehler.

1. In der linken Seitenleiste klicke auf
   **„Facebook Login"** → **„Einstellungen"**
   (englisch: „Facebook Login" → „Settings").

2. Du landest auf einer Seite mit mehreren Schaltern und Eingabefeldern.
   Suche das Feld **„Valid OAuth Redirect URIs"** (deutsch:
   „Gültige OAuth-Weiterleitungs-URIs").

3. **Klicke ins Feld** und füge ZWEI URLs ein, die du jeweils mit Enter
   bestätigst — Buchstabe für Buchstabe identisch zu dem, was unten steht:

   ```
   http://localhost:3000/api/auth/customer/callback/facebook
   https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook
   ```

4. **Achtung — der Pfad enthält das Wort `customer`.** Wenn du gewohnt bist,
   bei Facebook-Setups `…/api/auth/callback/facebook` einzutragen, vergiss
   das hier — Bärenstark verwendet einen separaten Pfad für Kunden-Logins.
   Das `customer` zwischen `auth` und `callback` MUSS dabei sein.

5. **Achte auf:**
   - **Kein** Slash am Ende der URL (kein `/facebook/`).
   - Klein geschrieben (kein `Facebook`, sondern `facebook`).
   - Bei der Produktions-URL: `https://`, nicht `http://`.
   - `www.` davor.
   - Bei der Localhost-URL: `http://` (ohne `s`) und Port `3000`.

6. Die Localhost-URL ist für den Backend-Engineer beim lokalen Entwickeln.
   Wenn du dir unsicher bist: trag sie mit ein, schadet nichts.

7. Scrolle nach unten und klicke **„Änderungen speichern"** /
   **„Save Changes"**.

8. Meta zeigt dir eine grüne Bestätigung. Manchmal dauert es bis zu
   5 Minuten, bis die Änderung weltweit aktiv ist.

> **Pro-Tipp:** Wenn du später den Fehler `URL Blocked` oder
> `redirect_uri_mismatch` siehst, komm hierher zurück und vergleiche
> Buchstabe für Buchstabe. Den exakten Soll-Wert siehst du auch im
> Diagnose-Endpoint (Sektion 9) unter `expectedCallbacks.facebook`.

---

## 6. App-ID und App-Secret kopieren

Hier holst du dir die zwei Zugangsdaten, mit denen die Webseite mit Facebook
reden darf.

1. In der linken Seitenleiste klicke auf
   **„Einstellungen"** → **„Allgemeines"**.

2. Du siehst ganz oben auf der Seite zwei Felder:
   - **App-ID** (englisch: „App ID") — eine lange Zahl, im Klartext sichtbar.
   - **App-Secret** (englisch: „App Secret") — anfangs durch Punkte verdeckt
     mit einem Button **„Anzeigen"** / **„Show"** daneben.

3. **App-ID kopieren:**
   - Klicke auf das Kopier-Symbol oder markiere die Zahl und kopiere sie
     (Cmd+C / Strg+C).
   - Speichere sie in einem sicheren Notiz-Dokument (z.B. einem
     Password-Manager).

4. **App-Secret kopieren:**
   - Klicke neben dem App-Secret-Feld auf **„Anzeigen"** / **„Show"**.
   - Meta fragt dich aus Sicherheitsgründen erneut nach deinem
     Facebook-Passwort. Gib es ein und bestätige.
   - Das App-Secret erscheint im Klartext. Markiere und kopiere es
     (Cmd+C / Strg+C).
   - Speichere es im selben sicheren Notiz-Dokument wie die App-ID.

5. **WICHTIG:** Das App-Secret behandelst du wie ein Passwort.
   - Niemals per Mail / Chat / Slack im Klartext verschicken.
   - Niemals in den Code einchecken.
   - Wenn du den Verdacht hast, dass das Secret in falsche Hände geraten
     ist: auf derselben Seite gibt es einen Button **„Zurücksetzen"** /
     **„Reset"** — danach musst du den neuen Wert in Vercel aktualisieren
     (Sektion 7).

6. Beide Werte brauchst du in **Sektion 7** (Vercel-Eintragung).

---

## 7. App-ID und App-Secret in Vercel-Umgebungsvariablen eintragen

Jetzt teilst du der Webseite mit, welche Zugangsdaten sie für Facebook
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

7. **Variable 1 — `FACEBOOK_CLIENT_ID`:**
   - **Key (oder Name):** `FACEBOOK_CLIENT_ID` (genau so geschrieben,
     komplett groß).
   - **Value:** der App-ID-Wert, den du in Sektion 6 Schritt 3 kopiert hast
     (eine lange Zahl).
   - **Environments:** setze die Häkchen bei allen drei: **Production**,
     **Preview**, **Development**.
   - Klicke auf **„Save"**.

8. **Variable 2 — `FACEBOOK_CLIENT_SECRET`:**
   - Klicke erneut auf „Add Another" (oder das Plus-Icon).
   - **Key:** `FACEBOOK_CLIENT_SECRET`
   - **Value:** der App-Secret-Wert aus Sektion 6 Schritt 4.
   - **Environments:** wieder alle drei Häkchen.
   - Klicke **„Save"**.

9. **`NEXTAUTH_URL`, `AUTH_SECRET` und `AUTH_TRUST_HOST` müssen ebenfalls
   gesetzt sein.** Das hast du beim Google-Setup vermutlich schon erledigt
   — die drei Variablen werden für Facebook und Google gemeinsam genutzt.
   Wenn du dir unsicher bist, lies in **`docs/GOOGLE_OAUTH_SETUP_GUIDE.md`
   Sektion 6, Schritt 9** nach. Doppelt eintragen brauchst du sie NICHT.

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

## 8. App von „Entwicklung" auf „Live" schalten

**Diesen Schritt gibt es bei Google nicht — bei Facebook ist er Pflicht.**

Eine neu erstellte Meta-App steht standardmäßig im **Entwicklungs-Modus**.
In diesem Zustand können sich nur Konten anmelden, die als Entwickler oder
Test-User in der App eingetragen sind. Echte Endkunden würden eine
Fehlermeldung „App nicht aktiv" sehen.

1. Im App-Dashboard ganz oben in der Leiste siehst du einen Schalter mit
   der Aufschrift **„Entwicklung"** / **„Development"** (links) und
   **„Live"** (rechts). Aktuell steht der Schalter auf „Entwicklung".

2. Klicke auf den Schalter, um auf **„Live"** umzuschalten.

3. Meta prüft jetzt automatisch, ob alle Pflichtfelder ausgefüllt sind:
   - **Privacy Policy URL** muss in **Sektion 4** eingetragen sein.
   - **Kategorie** muss in **Sektion 4** gewählt sein.
   - **App-Symbol** ist optional.

   Falls etwas fehlt, zeigt Meta eine rote Fehlermeldung mit dem fehlenden
   Feld. Geh dann zurück in **Sektion 4** und ergänze es.

4. Sobald alle Pflichtfelder erfüllt sind, fragt Meta dich:
   **„Möchtest du diese App live schalten?"** — bestätige mit **„Live"**.

5. Der Schalter steht jetzt auf **„Live"** (grün). Echte Kunden können sich
   ab sofort einloggen.

> **Kein App-Review nötig.** Bärenstark fordert nur die Standard-Berechtigungen
> `email` und `public_profile` an. Für diese beiden Berechtigungen führt Meta
> KEIN App-Review durch — die App geht direkt live, ohne dass du Formulare
> ausfüllen, Demo-Videos einreichen oder auf einen Reviewer warten musst.
>
> Falls dir Meta irgendwann eine Aufforderung „App Review beantragen" zeigt
> — ignorieren. Das betrifft nur erweiterte Berechtigungen, die wir nicht
> anfragen.

---

## 9. Diagnose-Endpoint nutzen — Selbst-Check

Bärenstark hat einen kleinen Diagnose-Endpoint eingebaut, der dir
auf einen Blick sagt, ob alles richtig konfiguriert ist. Du musst nur eine
Webadresse aufrufen und das Ergebnis ablesen.

1. **Voraussetzung — einmalig in Vercel-ENV setzen:**
   - In Vercel → Settings → Environment Variables (Sektion 7).
   - Lege eine neue Variable an (falls du sie nicht schon beim Google-Setup
     gesetzt hast):
     - **Key:** `AUTH_DIAGNOSE_ENABLED`
     - **Value:** `true`
     - **Environments:** alle drei Häkchen.
   - Klicke **„Save"**.
   - Mache erneut **„Redeploy"** (siehe Sektion 7 Schritt 10).

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
   - Suche im Output das Feld **`expectedCallbacks.facebook`**. Dort steht
     genau die URL, die im Meta Developer Portal in der Liste der
     **Valid OAuth Redirect URIs** (Sektion 5) eingetragen sein muss. Wenn
     du nicht 100%-ig sicher bist, dass dein Eintrag in Meta identisch ist:
     Sektion 5 noch einmal abarbeiten.
   - Suche das Feld **`providersActive.facebook`**. Es muss `true` sein.
     Steht dort `false`, fehlt eine der beiden Variablen `FACEBOOK_CLIENT_ID`
     oder `FACEBOOK_CLIENT_SECRET` in Vercel — Sektion 7 erneut prüfen.

5. **Sicherheitshinweis — entferne den Diagnose-Zugang nach dem Test:**
   - Sobald `verdict.actionRequired` auf `"none"` steht und der Login
     funktioniert: Geh zurück nach Vercel → Settings → Environment Variables.
   - Suche `AUTH_DIAGNOSE_ENABLED`, klicke auf die drei Punkte daneben
     und wähle **„Remove"**.
   - **Redeploy** klicken (Sektion 7 Schritt 10).
   - Dieser Schritt ist Pflicht: Der Diagnose-Endpoint zeigt
     Konfigurations-Hinweise, die in einem produktiven System nicht
     öffentlich abrufbar sein sollen.

---

## 10. Häufige Fehler und ihre Bedeutung

Wenn der Login fehlschlägt, siehst du im Browser meist eine englische
Fehlermeldung. Hier die häufigsten:

| Fehler-Symptom | Was passiert ist | Was du tun musst |
|----------------|------------------|------------------|
| `redirect_uri_mismatch` (oder Meta-Variante: „Ungültiger Redirect-URI") | Facebook sagt: Die Redirect-URI, die unsere Webseite gerade benutzt, steht NICHT in deiner Liste der erlaubten URIs. | **Sektion 5** noch einmal sorgfältig prüfen. Rufe `/api/auth/diagnose` auf, lies das Feld `expectedCallbacks.facebook` ab und trage GENAU diesen String im Meta Developer Portal als Valid OAuth Redirect URI ein. Achte auf Tippfehler, Slash am Ende, Groß-/Kleinschreibung. |
| „App nicht aktiv" / „App is in Development Mode" / „This app is in development mode" | Du hast in **Sektion 8** vergessen, die App von „Entwicklung" auf „Live" zu schalten. | **Sektion 8** durchgehen und den Schalter umlegen. Wenn Meta meckert, dass Pflichtfelder fehlen: zurück zu Sektion 4. |
| Login klappt, aber Webseite zeigt „Email-Adresse nicht erhalten" / `?error=oauth_no_email` in der URL | Der Kunde hat im Facebook-Consent-Dialog die Email-Berechtigung explizit abgelehnt — ODER sein Facebook-Privacy-Setting blockiert die Email-Weitergabe. Es gibt Facebook-Konten ohne hinterlegte Email. | **Kein Bug.** Die Webseite zeigt automatisch einen Hinweis mit Link auf die normale E-Mail-Registrierung. Der Kunde kann sich dort mit Email + Passwort anmelden. Du musst hier nichts tun. |
| `Invalid App Secret` / `invalid_client` | Du hast in Sektion 7 das falsche Secret kopiert oder das Secret eines anderen App-Projekts. | **Sektion 6 + 7** wiederholen. Hast du das Secret aus der RICHTIGEN App kopiert? Oben links im Meta Portal den App-Namen verifizieren. Nach Korrektur unbedingt **Redeploy** klicken. |
| „URL Blocked: This redirect failed because the redirect URI is not white-listed in the app's client OAuth settings" | Entweder die Site-URL/App-Domain in **Sektion 4** fehlt, oder die Redirect-URI in **Sektion 5** ist falsch / fehlt. | Erst **Sektion 4** prüfen: App-Domain `www.baerenstark-hausservice.app` muss als Tag eingetragen sein. Dann **Sektion 5**: Valid OAuth Redirect URIs müssen exakt die Werte aus dem Diagnose-Endpoint enthalten. |
| Weiße Seite, kein Login-Formular | Wahrscheinlich fehlt `AUTH_SECRET` oder `NEXTAUTH_URL` ist falsch. | **`docs/GOOGLE_OAUTH_SETUP_GUIDE.md` Sektion 6 Schritt 9** durchgehen und beide Variablen verifizieren. Danach `/api/auth/diagnose` (Sektion 9) aufrufen. |
| Login klappt nur mit deinem eigenen Facebook-Konto, andere Kunden bekommen einen Fehler | Die App steht noch im „Entwicklung"-Modus — nur Konten mit Entwickler-Rolle können sich anmelden. | **Sektion 8** abarbeiten: App auf „Live" schalten. |

---

## 11. Wenn nichts hilft

Wenn du alle Schritte sorgfältig durchgegangen bist, der Diagnose-Endpoint
`actionRequired: "none"` zeigt und der Login trotzdem nicht funktioniert:

1. **Browser-Cookies löschen** oder **Inkognito-Tab öffnen** und dort den
   Login probieren. Manchmal hängen alte Sitzungen im Browser fest.

2. Wenn das nicht hilft, kontaktiere den Backend-Engineer mit folgenden
   Infos in deiner Nachricht:

   - Den vollständigen Output von `https://www.baerenstark-hausservice.app/api/auth/diagnose`
     (Copy-Paste der Webseite).
   - Die exakte Fehlermeldung, die im Browser angezeigt wird.
   - Ein Screenshot der Meta-Developer-Portal-Detail-Ansicht deiner App
     (insbesondere die Liste der Valid OAuth Redirect URIs aus Sektion 5
     UND der Schalter „Entwicklung / Live" oben aus Sektion 8).

   Mit diesen drei Informationen kann der Engineer in unter fünf Minuten
   sagen, woran es liegt.

3. **Wenn auch das nichts bringt:** Das technische Tiefen-Runbook
   `docs/AUTH_GOOGLE_FIX_RUNBOOK.md` enthält Engineer-Sprache mit
   detaillierten Diagnose-Schritten. Dort schaut der Engineer im
   Eskalationsfall nach.

---

**Stand:** 2026-05-03 — Iteration 9 / Setup-Guide Facebook (analog zu US-IT9-04)

**Pfad-Verifikation:** Die in Sektion 5 verwendeten Redirect-URIs entsprechen
exakt dem Feld `expectedCallbacks.facebook` aus
`/Users/.../src/app/api/auth/diagnose/route.ts:166`
(NextAuth-Customer-Handler liegt unter
`src/app/api/auth/customer/[...nextauth]/route.ts`).
