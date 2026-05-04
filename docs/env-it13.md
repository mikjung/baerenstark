# IT13 — Env-Var-Setup für Tom

Stand: 2026-05-04. Diese Anleitung beschreibt die ENV-Schritte, die Tom in
Vercel + Facebook Developer Console + Turso ausführen muss, damit IT13
in Production funktioniert.

## 1. Vercel Environment Variables (Production)

Alle Werte über `Vercel Dashboard → Project → Settings → Environment Variables`
für **Production** anlegen / prüfen.

### 1.1 Facebook OAuth (S02)

| Variable                  | Pflicht | Beispiel       | Quelle                                 |
|---------------------------|---------|----------------|----------------------------------------|
| `AUTH_FACEBOOK_ID`        | ja      | `1234567890`   | Facebook Developer Console → App-Dashboard → "Settings → Basic" → **App ID** |
| `AUTH_FACEBOOK_SECRET`    | ja      | `abcd1234…`    | Facebook Developer Console → App-Dashboard → "Settings → Basic" → **App Secret** (auf "Show" klicken) |

> **NextAuth-v5-Naming.** Diese Iteration harmonisiert die Variablen-
> Namen auf das offizielle `AUTH_*`-Schema. Die Legacy-Namen
> `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` werden vom Code als
> Fallback weiter akzeptiert (`process.env.AUTH_FACEBOOK_ID ??
> process.env.FACEBOOK_CLIENT_ID`), kein Big-Bang-Switch nötig.
> Empfehlung: bei Gelegenheit auf `AUTH_FACEBOOK_*` umstellen, alte
> Variante danach löschen.

### 1.2 Vercel Blob (S05)

| Variable                  | Pflicht | Beispiel               | Quelle                                  |
|---------------------------|---------|------------------------|-----------------------------------------|
| `BLOB_READ_WRITE_TOKEN`   | ja      | `vercel_blob_rw_…`     | Vercel Dashboard → Storage → Blob-Store → "Connect to Project" |

> **Token-Drift-Risiko.** Wenn der Production-Bug-Sweep aus IT13-S05
> trotz neuem Direct-Upload-Pfad weiter `INTERNAL_ERROR` produziert,
> ist mit hoher Wahrscheinlichkeit der Token zu einem nicht (mehr)
> existierenden Blob-Store verlinkt. Schritte:
> 1. Vercel Dashboard → Storage → Blob → Store auswählen.
> 2. Auf "Connect to Project" klicken und das aktuelle Projekt
>    `baerenstark-hausservice` neu verbinden — Vercel schreibt den
>    Token automatisch in die Environment Variables.
> 3. **Re-Deploy** triggern (sonst greifen ENV-Änderungen nicht).

### 1.3 Bestehende Env-Vars — Vollständigkeits-Check (S06)

Jede dieser Variablen muss in Production gesetzt sein. Wenn auch nur
**eine** fehlt, antwortet `POST /api/bookings` mit 500 (Backend-Spec
§S06 Hypothese 4).

```bash
vercel env ls --environment=production | grep -E \
  "DATABASE_URL|AUTH_SECRET|BOOKING_TOKEN_SECRET|RESEND_API_KEY|MAIL_FROM|MAIL_TO_ADMIN|NEXTAUTH_URL|NEXT_PUBLIC_BASE_URL|UNSUBSCRIBE_TOKEN_SECRET"
```

Erwartete Treffer: 9 — fehlt eine, in Vercel nachsetzen + Re-Deploy.

## 2. Facebook Developer Console

1. App-Dashboard öffnen → linke Seitenleiste **"Use cases" → "Authentication
   and account creation"** → **Customize**.
2. **Valid OAuth Redirect URIs** setzen auf — **EXAKT**, mit `customer/`-Segment:

   ```
   https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook
   ```

   > Decision IT13 (Source of Truth, 2026-05-04): mit `customer/`-Pfad.
   > Die Variante ohne `customer/` (aus Story-Notes Z. 95) ist falsch.
   > Begründung: NextAuth-Customer-Handler hat
   > `basePath: '/api/auth/customer'` — alle Provider-Callbacks landen
   > unter diesem Basis-Pfad (Google nutzt seit IT12 produktiv den
   > gleichen Pfad).

3. **App Domains** setzen auf: `baerenstark-hausservice.app`.

4. **Data Deletion Instructions URL** (Pflicht für App-Live-Status — IT13-S01):

   ```
   https://www.baerenstark-hausservice.app/datenschutz/datenloesung
   ```

5. **Privacy Policy URL** (sollte bereits gesetzt sein):

   ```
   https://www.baerenstark-hausservice.app/datenschutz
   ```

6. App von **Development → Live** schalten — erst möglich, wenn die
   Datenlöschungs-URL validiert wurde (Schritt 4).

## 3. Turso Migrations (S06)

`POST /api/bookings` antwortet aktuell in Production mit 500 — wahrscheinlichste
Ursache: IT11/IT12-Migrationen wurden gegen die Prod-DB nicht eingespielt
(`prisma migrate deploy` funktioniert NICHT gegen `libsql://`).

### 3.1 Skript

`scripts/apply-it13-migrations.sh` (Repo-Root) prüft den Migrations-Stand
gegen `baerenstark-prod`, listet fehlende Migrationen und spielt sie auf
Bestätigung ein. Vorab ein **Dry-Run**:

```bash
cd /Users/mikesiefert/Desktop/baerenstark
./scripts/apply-it13-migrations.sh --dry-run
```

### 3.2 Backup vor dem echten Lauf

```bash
turso db shell baerenstark-prod ".dump" > backup-$(date +%Y%m%d).sql
```

### 3.3 Echte Migration

```bash
./scripts/apply-it13-migrations.sh
```

Bestätigt mit `yes` an der Eingabeaufforderung. Skript läuft idempotent
(bereits eingespielte Migrationen werden übersprungen).

### 3.4 Nach-Verifikation

Das Skript prüft am Ende:
- Existenz von `idempotency_keys`, `marketing_emails`, `marketing_email_recipients`.
- Vorhandensein der Spalten `cancelledAt`, `cancelledBy`, `cancellationReason` in `bookings`.
- Vorhandensein der Spalten `streetAndNumber`, `postalCode`, `city`, `unsubscribedAt` in `customer_users`.

Wenn eine WARN-Meldung erscheint, die entsprechende Migration manuell prüfen.

## 4. Smoke-Tests nach Vercel-Re-Deploy

### 4.1 Datenlöschungsseite (S01)

```bash
curl -I https://www.baerenstark-hausservice.app/datenschutz/datenloesung
# Erwartet: HTTP/2 200, kein Redirect.
```

### 4.2 `/api/bookings` (S06)

```bash
curl -X POST https://www.baerenstark-hausservice.app/api/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "customerName":"Smoke Test",
    "customerEmail":"smoke-test@example.com",
    "customerPhone":"0157 74787512",
    "service":"sonstiges",
    "description":"IT13-Smoke",
    "date":"2026-06-15",
    "startTime":"10:00",
    "durationMinutes":60,
    "addressStreet":"Teststraße 1",
    "addressZip":"64283",
    "addressCity":"Darmstadt",
    "privacyAccepted":true
  }'
# Erwartet: 201 mit { "data": { "id":..., "status":"PENDING" } }
# Bei 500: Response-Header `X-Request-Id` notieren und in den
# Vercel-Logs danach grepen — strukturierter Eintrag enthält die ID.
```

### 4.3 `/api/upload/token` (S05)

```bash
curl -X POST https://www.baerenstark-hausservice.app/api/upload/token \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","contentType":"image/jpeg","sizeBytes":2000000}'
# Erwartet: 201 mit { "data": { "uploadUrl", "token", "blobPath",
#                              "attachmentId", "maxBytes":10485760 } }
```

### 4.4 Facebook OAuth (S02)

1. Inkognito-Tab → `/konto/login`.
2. Auf "Mit Facebook anmelden" klicken.
3. Facebook-Dialog akzeptieren → Redirect zurück auf `/konto`.
4. Vercel-Logs prüfen: kein `redirect_uri_mismatch`, kein `oauth_no_email`,
   kein `oauth_unverified_conflict` (außer absichtlich provoziert).

## 5. Reihenfolge der Schritte

1. **Migrations** (Skript) — bevor Re-Deploy, sonst greift der Booking-
   Bug-Fix nicht.
2. **Vercel ENV-Vars** setzen (`AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET`,
   ggf. `BLOB_READ_WRITE_TOKEN` neu binden).
3. **Vercel Re-Deploy** triggern (ENV-Änderungen brauchen Re-Deploy).
4. **Facebook Developer Console** Redirect-URI + Datenlöschungs-URL setzen.
5. **App Live schalten** (Facebook Dashboard).
6. **Smoke-Tests** durchführen (§4).
