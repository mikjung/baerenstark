# Google-OAuth-„Bad request"-Fix — Runbook (US-IT6-05)

**Status:** Iteration 6, 2026-05-03
**Verantwortlich:** Tom Siefert (Eigentümer der Google Cloud Console),
unterstützt vom Backend-Engineer.

## Symptom

Beim Klick auf „Mit Google anmelden" auf `/konto/login` erscheint die
Fehlermeldung „Bad request" — kein Login möglich.

## Häufigste Ursachen (nach Wahrscheinlichkeit sortiert)

1. **Authorized Redirect URI in Google Cloud Console stimmt nicht mit
   der `NEXTAUTH_URL`-Env überein.** (Häufigster Fall.)
2. `NEXTAUTH_URL` enthält Trailing-Slash oder fehlerhaftes Schema.
3. OAuth-Consent-Screen ist im „Testing"-Mode und Tom hat seine Test-User
   nicht freigeschaltet.
4. OAuth-Client-ID gehört zu einer anderen GCP-Projekt-Domain.

## Fix-Schritte

### 1. NEXTAUTH_URL prüfen

Lokale Entwicklung:

```
NEXTAUTH_URL="http://localhost:3000"
```

Produktion:

```
NEXTAUTH_URL="https://www.baerenstark-hausservice.app"
```

**Verbindlich:** Kein Trailing-Slash. Kein `http://` in Produktion.

### 2. Authorized Redirect URI in Google Cloud Console

1. Öffne https://console.cloud.google.com/apis/credentials
2. Wähle dein OAuth 2.0 Client-ID-Eintrag aus.
3. Unter **„Authorized redirect URIs"** **EXAKT** folgendes eintragen
   (Komma-separiert, einer pro Zeile):

```
http://localhost:3000/api/auth/customer/callback/google
https://www.baerenstark-hausservice.app/api/auth/customer/callback/google
```

> **Hinweis:** Die exakte Pfad-Struktur ist `/api/auth/customer/callback/google`
> (nicht `/api/auth/callback/google`) — der Customer-NextAuth-Handler
> liegt unter `/api/auth/customer/[...nextauth]`. Falls du eine andere
> Schreibweise siehst, ist das ein Tippfehler.

4. „Save" klicken.

### 3. OAuth Consent Screen

1. https://console.cloud.google.com/apis/credentials/consent
2. Scopes: `email`, `profile`, `openid`.
3. Wenn der App-Status „Testing" ist:
   - Tom + alle Engineering-E-Mails als Test-User hinzufügen.
   - Ohne diesen Schritt schlägt der Login mit „Bad request" fehl,
     wenn der User nicht in der Test-Liste steht.
4. Vor Go-Live: App-Status auf „In production" stellen (Google-Review
   nicht erforderlich, solange Scopes auf `email/profile/openid` begrenzt
   bleiben).

### 4. Verbindliche Backend-Konfiguration (bereits umgesetzt)

In `src/lib/customer-oauth.ts`:

```ts
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  authorization: { params: { scope: 'openid email profile' } },
});
```

Plus `trustHost: true` (NextAuth v5).

### 5. Verifikations-Test

Nach Konfig-Änderung:

```bash
# Cookies löschen oder Inkognito-Tab öffnen.
# /konto/login öffnen → "Mit Google anmelden" klicken.
# Nach erfolgreichem Login: redirect auf /konto.
```

Wenn der Fehler weiterhin auftritt, in der Browser-DevTools-Console und
im Server-Log die genaue Fehlermeldung suchen:

- `redirect_uri_mismatch` → Schritt 2 falsch.
- `invalid_client` → `GOOGLE_CLIENT_SECRET` falsch oder Client-ID
  veraltet.
- `access_denied` → User hat im Consent-Screen abgelehnt; kein Bug.

---

## Stripe-Cleanup (manuell, DSGVO-Verantwortung Tom)

**Kontext:** Das Skript `scripts/reset-users.ts` (US-IT6-06) macht
**keine** Stripe-API-Calls. Nach Wipe muss Tom die nicht mehr benötigten
Stripe-Customer-Records manuell archivieren oder löschen.

### Schritte

1. Wipe-Skript ausführen, Output kopieren.
2. Im Output erscheint ein Block „Stripe-Cleanup":

```
[reset-users] Stripe-Cleanup (manuell, DSGVO-Verantwortung Tom):
  Bitte folgende Stripe-Sessions/Customer im Stripe Dashboard
  archivieren oder löschen (Customers-Tab → Suche per Session-ID):
    - cs_test_xxxxx
    - cs_live_yyyyy
```

3. Im Stripe Dashboard:
   - https://dashboard.stripe.com/customers
   - Per Session-ID den Customer suchen (Stripe verlinkt von Session
     direkt auf Customer).
   - „Delete customer" oder „Archive" klicken.
4. Wiederholen für jede Session-ID.

> Ein automatischer Stripe-Delete-Hook wäre IT7-Backlog (rechtliche
> Klarstellung mit Steuerberater nötig: Stripe-Records dürfen für
> Buchhaltungszwecke aufbewahrt werden — manueller Schritt ist die
> sichere Default-Option).

---

## Facebook-OAuth (US-IT6-05)

Facebook erfordert eine **verifizierte App-Domain**:

- **Localhost-Login funktioniert nur, wenn die App im „Development"-
  Mode ist.** Für Produktion muss die App auf „Live" geschaltet sein.
- Authorized Redirect URI: `https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook`
- ENV-Vars: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`.

Tom liefert Client-ID/Secret aus dem Meta Developer Portal
(https://developers.facebook.com/apps).
