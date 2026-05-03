# Auth-Diagnose & Google/Facebook-OAuth-Fix — Runbook (US-IT7-02 + US-IT7-03)

**Status:** Iteration 7, 2026-05-03
**Verantwortlich:** Tom Siefert (Eigentümer der Google Cloud Console und der
Meta-Developer-App), unterstützt vom Backend-Engineer.

> **Iteration 7 Update:** Es gibt jetzt einen Self-Service-Diagnose-Endpoint
> `GET /api/auth/diagnose`. Der zeigt dir live, welche ENV-Vars gesetzt sind,
> welche Provider aktiv sind, und welche Callback-URLs Google/Facebook
> erwarten. Nutze diesen Endpoint **als Erstes**, bevor du etwas in der
> Cloud-Console anfasst.
>
> **Iteration 8 Update (US-IT8-05):** Der Endpoint liefert jetzt ein neues
> Top-Level-Feld `verdict` direkt am Anfang der Antwort. Damit muss Tom
> nicht mehr manuell durch das JSON scrollen — `verdict.actionRequired`
> sagt unmissverständlich, ob *du selbst* (Tom) etwas tun musst oder ob
> der *Engineer* einen Code-Fix deployen muss.

## TOP-0: Lies zuerst `verdict` (IT8)

Wenn du `/api/auth/diagnose` aufrufst, steht ganz oben im JSON:

```jsonc
{
  "verdict": {
    "actionRequired": "code" | "config" | "none",
    "summary":        "Deutsch, 1–2 Sätze, was zu tun ist.",
    "codeFailures":   ["check.id1", "..."],
    "configActions":  ["[check.id] Was Tom tun muss …"]
  },
  "checks": [ /* einzelne Check-Ergebnisse */ ],
  // … (env, providersActive, expectedCallbacks, notes — wie bisher)
}
```

So entscheidest du:

- **`actionRequired: "none"`** → Alle Checks grün. Falls Login trotzdem
  hakt: Cookies löschen, Inkognito-Tab probieren.
- **`actionRequired: "config"`** → Code ist OK. **Du** musst in Vercel
  oder in der Cloud-Console etwas tun. `configActions` enthält die
  konkrete Schritt-Liste; arbeite sie ab und rufe danach den Endpoint
  erneut auf.
- **`actionRequired: "code"`** → **Engineer** muss zuerst einen Fix
  deployen. `codeFailures` listet die betroffenen Check-IDs.
  Stop hier, wende dich an den Backend-Engineer.

> Hinweis: `auth_secret_length` ist *immer* `warn` mit
> `actionRequired: "config"`, weil der Endpoint das Secret nie lesen darf.
> Im Best-Case ist das einzige verbleibende Verdikt deshalb `"config"` —
> verifiziere manuell, dass dein AUTH_SECRET ≥ 32 Zeichen hat (z.B. aus
> `openssl rand -base64 32`), dann ist alles in Ordnung.

## TOP-5-Checkliste — vor jeder Fehlerdiagnose

Öffne `/api/auth/diagnose` (lokal: `http://localhost:3000/api/auth/diagnose`,
in Vercel-Preview: `https://<preview-url>/api/auth/diagnose`). In Produktion
ist der Endpoint per Default 404; um ihn dort temporär zu aktivieren, setze
`AUTH_DIAGNOSE_ENABLED=true` in den Vercel-ENV-Vars (und entferne den Wert
nach der Diagnose wieder).

Aus dem JSON-Output prüfe in dieser Reihenfolge:

1. **`env.NEXTAUTH_URL`** — exakte Produktions-URL ohne Trailing-Slash.
   - Lokal: `http://localhost:3000`
   - Prod:  `https://www.baerenstark-hausservice.app`
   - **Häufigster Fehler:** Trailing-Slash (`https://...app/`) oder fehlendes
     `https://`. Beides bricht den OAuth-Callback.

2. **`secret_source`** — welche ENV-Var liefert das NextAuth-Secret?
   - `"AUTH_SECRET"` → korrekt (Pflicht-Name in NextAuth v5).
   - `"NEXTAUTH_SECRET (alias)"` → funktioniert (Read-Compat-Alias), aber
     setze besser `AUTH_SECRET` direkt.
   - `null` → **DEFEKT.** Kein Secret gesetzt; Login crasht. 32+ Zeichen
     Pflicht. Generiere via `openssl rand -base64 32`.

3. **`env.AUTH_TRUST_HOST`** — auf Vercel/Tunnel-Build muss `"true"` stehen.
   - Ohne diesen Wert wirft NextAuth v5 in Prod „Bad request" durch
     Host-Verifikation.

4. **`expectedCallbacks.googleC`** und **`.facebook`** — kopiere DIESE
   exakten Strings in die Cloud-Console deiner App:
   - **Google Cloud Console:** Credentials → OAuth 2.0 Client → Authorized
     Redirect URIs. Müssen **EXAKT** so eingetragen sein (Komma-separiert,
     einer pro Zeile).
   - **Meta Developer Portal:** Facebook Login → Einstellungen → Valid
     OAuth Redirect URIs. Gleiches Prinzip.

5. **`providersActive.google` / `.facebook`** — ist der Provider überhaupt
   aktiv?
   - Wenn `false`, fehlen `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
     bzw. `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` in ENV.

## Häufige Fehler

| Symptom | Wahrscheinliche Ursache | Fix |
|---------|------------------------|-----|
| „Bad request" | NEXTAUTH_URL hat Trailing-Slash | Slash entfernen, redeploy. |
| `redirect_uri_mismatch` | Cloud-Console Redirect-URI ≠ `expectedCallbacks` aus diagnose | Eintrag in Console exakt anpassen. |
| `invalid_client` | Falsche Client-ID/Secret oder anderes GCP-Projekt | Aus richtigem Projekt neu kopieren. |
| Google-Login klappt nur mit Toms Mail | OAuth Consent Screen ist „Testing" und Tom nicht als Test-User eingetragen | Test-User hinzufügen ODER Status auf „In production" setzen. |
| Facebook-Login funktioniert lokal, in Prod nicht | App im „Development"-Mode | Im Meta Developer Portal auf „Live" schalten. |
| Facebook-User ohne Email | Privacy-Setting blockiert email-Scope | Frontend zeigt Fehler `?error=oauth_no_email` mit Link auf E-Mail-Registrierung. |

## Konkrete Schritte für Tom

### Google Cloud Console

1. https://console.cloud.google.com/apis/credentials → richtiges Projekt wählen.
2. OAuth 2.0 Client-ID auswählen.
3. **Authorized Redirect URIs** — füge **exakt** ein, was `/api/auth/diagnose`
   unter `expectedCallbacks.googleC` zeigt. Sowohl der Localhost- als auch
   der Prod-Wert:

   ```
   http://localhost:3000/api/auth/customer/callback/google
   https://www.baerenstark-hausservice.app/api/auth/customer/callback/google
   ```

4. **Save** klicken.
5. **OAuth Consent Screen** prüfen:
   - https://console.cloud.google.com/apis/credentials/consent
   - Status: „In production" (oder Tom + Engineering als Test-User
     eingetragen, falls noch „Testing").
   - Scopes: `email`, `profile`, `openid`. Kein App Review nötig.

### Meta Developer Portal (Facebook)

1. https://developers.facebook.com/apps → App auswählen.
2. **Facebook Login → Einstellungen → Valid OAuth Redirect URIs:**

   ```
   https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook
   ```

3. **App-Domain** eintragen: `www.baerenstark-hausservice.app`.
4. **App-Status:** „Live" (nicht „Development"). App Review ist bei
   `email` + `public_profile` nicht erforderlich.
5. **Privacy Policy URL** setzen (Meta-Pflicht für Live-Mode).
6. App-ID und App-Secret aus „Einstellungen → Allgemeines" an Engineer
   übergeben für ENV (`FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`).

## Verifikations-Test

Nach Konfig-Änderung:

```bash
# Cookies löschen oder Inkognito-Tab öffnen.
# /konto/login öffnen → "Mit Google anmelden" klicken.
# Nach erfolgreichem Login: redirect auf /konto.
```

Wenn der Fehler weiterhin auftritt, in der Browser-DevTools-Console und
im Server-Log die genaue Fehlermeldung suchen:

- `redirect_uri_mismatch` → TOP-5 Schritt 4 falsch.
- `invalid_client` → `GOOGLE_CLIENT_SECRET` / `FACEBOOK_CLIENT_SECRET`
  falsch oder Client-ID veraltet.
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

> Ein automatischer Stripe-Delete-Hook wäre IT8-Backlog (rechtliche
> Klarstellung mit Steuerberater nötig: Stripe-Records dürfen für
> Buchhaltungszwecke aufbewahrt werden — manueller Schritt ist die
> sichere Default-Option).
