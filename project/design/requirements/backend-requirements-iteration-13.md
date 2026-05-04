# Backend Requirements — Iteration 13

> Stand: 2026-05-04. Architektur-Basis: `ARCHITECTURE.md` (Stand IT12).
> Diese Iteration ist primär ein Bug-Fix-Sweep und eine kleine
> Compliance-/Auth-Erweiterung. Keine neuen Subsysteme.
>
> Stories Backend-relevant: **S01** (Datenlöschungsseite — keine API,
> nur statische Page + Footer/Datenschutz-Update), **S02** (Facebook
> OAuth aktivieren), **S05** (`/api/upload` 500-Bug), **S06**
> (`/api/bookings` 500-Bug).

---

## Tech Stack (unverändert ggü. IT12)

- Runtime: Next.js 14 App Router, **`runtime = 'nodejs'`** für alle
  betroffenen Routes (kein Edge — Prisma + Vercel Blob brauchen Node).
- ORM: Prisma 5.22 → Turso (libSQL) via `@libsql/client`.
- Auth: NextAuth v5 (Customer-Handler an `/api/auth/customer/[...nextauth]`).
- Mail: Resend, fire-and-forget Dispatch.
- File-Storage: Vercel Blob (`@vercel/blob` 2.3.x).

---

## S01 — Datenlöschungsseite (Compliance, kein neuer Backend-State)

### Zweck

Facebook App Review verlangt eine öffentlich erreichbare URL mit
Datenlösch-Anweisungen. Reine statische Server-Component, kein DB-Zugriff,
keine Mutationen — gehört rein backend-seitig nur, weil sie als
Server-Component im App-Router gerendert wird.

### Route (verbindlich)

> **Decision IT13 (Orchestrator-Entscheidung 2026-05-04 — Source of Truth):**
> Kanonische URL ist **`/datenschutz/datenloesung`**. Story-AC und
> UX-Spec stimmen überein. Frühere Variante `/datenschutz/loeschung`
> (aus Pre-QA-Vorschlag) ist verworfen. Diese URL wird in der Facebook
> Developer Console unter „Data Deletion Instructions URL" eingetragen.

```
GET https://www.baerenstark-hausservice.app/datenschutz/datenloesung
→ 200 OK, statisch, kein Auth, kein Token, kein Cookie, kein Login-Redirect
```

### Datei

`src/app/datenschutz/datenloesung/page.tsx` — Server Component,
statisches Rendering (App-Router-Default). Bewusst kein `force-dynamic`,
damit der Facebook-Crawler ohne Function-Invocation zugreifen kann.

### Inhalt (Pflicht laut S01-AC)

1. H1 „Datenlöschung".
2. Erklärung, dass Lösch­anfragen per E-Mail an
   `hausservice-baerenstark@outlook.com` gestellt werden können.
3. Hinweis auf 30-Tage-SLA (DSGVO Art. 17).
4. Liste der gespeicherten Daten: Name, E-Mail, Telefon (falls hinterlegt),
   Adresse (falls hinterlegt), Buchungshistorie, Bewertungen.
5. Hinweis dass nach Löschung die Buchungs-Audit-Daten nach 6 Jahren
   (HGB-Aufbewahrungspflicht) anonymisiert vernichtet werden, falls
   relevant.
6. Link zurück auf `/datenschutz`.

Kein Backend-State, kein API-Endpoint. Page ist über Footer und
`/datenschutz` verlinkt (Frontend-Story, siehe Frontend-Doc).

### Update auf `/datenschutz`

Im bestehenden `src/app/datenschutz/page.tsx` neuen Abschnitt
„Datenlöschung" einfügen — mit Inline-Erklärung + prominentem Link auf
`/datenschutz/datenloesung`. Keine API, kein Code-Path.

---

## S02 — Facebook OAuth aktivieren

### Status quo

`src/lib/customer-oauth.ts` registriert bereits einen
`FacebookProvider` (Zeilen 348–356), wenn `FACEBOOK_CLIENT_ID` und
`FACEBOOK_CLIENT_SECRET` gesetzt sind. `LoginForm.tsx` rendert bereits
einen „Mit Facebook anmelden"-Button (Zeile 257–269). Die Pipeline ist
vorhanden — IT13-S02 ist primär eine **Konfigurations- und Smoke-Test-
Aufgabe**, kein Code-Patch im Standardfall.

### Provider-Konfiguration (NextAuth v5)

Datei: `src/lib/customer-oauth.ts`. Aktueller Stand ist korrekt; einzige
Anpassung: ENV-Variablen-Naming **harmonisieren** auf NextAuth-v5-Konvention:

| Bisheriger Name (IT12)  | Neuer Name (IT13)        | Begründung |
|-------------------------|--------------------------|------------|
| `FACEBOOK_CLIENT_ID`    | `AUTH_FACEBOOK_ID`       | NextAuth v5 erkennt `AUTH_*` Provider-Vars automatisch. |
| `FACEBOOK_CLIENT_SECRET`| `AUTH_FACEBOOK_SECRET`   | Konsistent zu Auth.js v5 Auto-Detect. |

> **Migration:** beide Naming-Varianten **gleichzeitig** akzeptieren
> (`process.env.AUTH_FACEBOOK_ID ?? process.env.FACEBOOK_CLIENT_ID`),
> damit der Vercel-Operator keinen Big-Bang-Switch braucht.
> `isCustomerOAuthEnabled()` und `buildProviders()` entsprechend erweitern.

```ts
// src/lib/customer-oauth.ts
const fbId = process.env.AUTH_FACEBOOK_ID ?? process.env.FACEBOOK_CLIENT_ID;
const fbSecret = process.env.AUTH_FACEBOOK_SECRET ?? process.env.FACEBOOK_CLIENT_SECRET;
if (fbId && fbSecret) {
  providers.push(
    FacebookProvider({
      clientId: fbId,
      clientSecret: fbSecret,
      authorization: { params: { scope: 'email,public_profile' } },
    }),
  );
}
```

> Hinweis: Facebook erwartet `scope` als **Komma-Liste** (`email,public_profile`),
> nicht space-separated wie Google. Aktueller Code verwendet
> `'email public_profile'` — das funktioniert in Praxis bei Facebook
> auch, aber zur Sicherheit auf `'email,public_profile'` setzen.

### Required Env-Vars (Vercel Production)

| Variable                    | Beispiel                | Notwendig | Begründung |
|-----------------------------|-------------------------|-----------|------------|
| `AUTH_FACEBOOK_ID`          | `1234567890`            | ja        | App-ID aus Facebook Developer Console. |
| `AUTH_FACEBOOK_SECRET`      | `abcdef…`               | ja        | App-Secret. **Production-Branch only**. |
| `NEXTAUTH_URL`              | `https://www.baerenstark-hausservice.app` | ja (gesetzt) | Wird für Callback-URL-Berechnung gebraucht — exakte `www.`-Schreibweise. |

**Domain-Pflicht:** `www.baerenstark-hausservice.app` (mit `www.`).
Apex-Domain redirected per 301 auf `www.` — Cookie würde sonst auf
einer der beiden verloren gehen.

### Redirect-URI in Facebook Developer Console

> **Source of Truth (Decision IT13 — Orchestrator-Entscheidung 2026-05-04):**
> Die einzige verbindliche Callback-URL für Facebook OAuth ist die
> hier dokumentierte. Die in der PM-Story-Notes-Variante genannte URL
> ohne `customer/`-Pfadsegment ist **falsch** und wird parallel vom PM
> in der Story-Datei korrigiert. Engineer darf nur die hier genannte
> URL in der Facebook Developer Console eintragen.

```
https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook
```

**Begründung:** Der Customer-NextAuth-Handler hat den
`basePath: '/api/auth/customer'` (siehe `customer-oauth.ts` Zeile 366).
Sämtliche Provider-Callbacks landen unter diesem Basis-Pfad. Dieselbe
Konvention ist seit IT12 für Google produktiv aktiv
(`/api/auth/customer/callback/google`).

### Account-Linking-Strategie

Konsistent mit Google (siehe `handleCustomerOAuthSignIn()` in
`customer-oauth.ts`):

1. **Provider-ID-Match** (`oauthProvider='facebook' & oauthId=<fb-sub>`)
   → bestehender Account, einloggen, fertig.
2. **E-Mail-Match** auf bestehendes Konto:
   - Wenn `emailVerified=true` (lokal verifiziertes E-Mail/Pw-Konto oder
     vorher mit Google verlinktes Konto): **automatisch verlinken** —
     `oauthProvider`/`oauthId` werden auf Facebook gesetzt. ⚠ Damit
     überschreibt Facebook eine vorher gespeicherte Google-Verknüpfung.
     Die `customer_users.oauthProvider`/`oauthId`-Spalten sind
     single-valued — **akzeptierter Trade-off**: das Konto ist mit der
     E-Mail verknüpft, beide OAuth-Provider liefern dieselbe E-Mail,
     also funktioniert der Login mit beiden (über E-Mail-Match-Pfad).
     Nur die zuletzt verlinkte Provider-ID wird persistiert.
   - Wenn `emailVerified=false` (unverifiziertes E-Mail/Pw-Konto):
     **kein Auto-Link**, Antwort `oauth_unverified_conflict` (422) →
     Frontend zeigt „Es existiert bereits ein Konto mit dieser
     E-Mail-Adresse. …" Banner. Hijacking-Schutz (BUG-IT5-004 aus IT5).
3. **Kein Match** → neuer Account anlegen, `passwordHash=null`,
   `emailVerified=true` (Facebook hat E-Mail bereits verifiziert),
   `oauthProvider='facebook'`, `oauthId=<fb-sub>`.

### Fallback wenn Facebook keine E-Mail liefert

`normalizeProfile('facebook', profile, account)` returns `null` wenn
`profile.email` fehlt (Code-Pfad existiert: Zeile 162). NextAuth-`signIn`-
Callback antwortet mit Redirect `/konto/login?error=oauth_no_email`.
Der Frontend-Banner-Text ist bereits vorhanden:

> „Mit deinem Konto ist keine E-Mail-Adresse verknüpft. Bitte registriere
> dich per E-Mail und Passwort."

**Profil-Vervollständigungs-Pflichtfluss (Open für IT13):** Wenn
Facebook ohne E-Mail zurückkommt, bieten wir nicht an, eine E-Mail
nachträglich anzugeben. Zukunftspfad wäre: Account anlegen mit
`emailVerified=false` und einer Pseudo-E-Mail wie `<fbId>@no-email.fb`,
und im `/konto/profil` zur E-Mail-Vervollständigung zwingen. **Für IT13
nicht in Scope** — wir bleiben bei der harten Ablehnung mit Fehlerbanner.

### Endpoint-Übersicht (alles bestehend)

| Path                                          | Method | Auth   | Zweck                                                |
|-----------------------------------------------|--------|--------|------------------------------------------------------|
| `/api/auth/customer/[...nextauth]`            | GET/POST | none | NextAuth Handler (Google + Facebook + Credentials).  |
| `/api/auth/customer/signin/facebook`          | POST   | CSRF  | Auslöser für Facebook-OAuth-Flow (NextAuth-intern).  |
| `/api/auth/customer/callback/facebook`        | GET    | OAuth | Provider-Callback. Wird von Facebook aufgerufen.     |
| `/api/customer/oauth-finalize`                | GET    | NextAuth-Session | Setzt `customer-session`-Cookie nach erfolgreichem OAuth-Flow. |

Keine neuen Routes. Smoke-Test in Production nach ENV-Setup ist die
eigentliche Akzeptanz.

### Test-Plan S02 (Smoke in Production)

1. ENV-Vars in Vercel Production setzen.
2. Vercel Re-Deploy triggern (ENV-Änderungen brauchen Re-Deploy).
3. `/konto/login` aufrufen → „Mit Facebook anmelden"-Button sichtbar
   und nicht disabled.
4. Klick → Redirect zu `facebook.com/dialog/oauth?...` (kein „App nicht
   live" / kein „URL Blocked").
5. Facebook-Dialog akzeptieren → Redirect zurück → Account angelegt
   bzw. verlinkt → Cookie `customer-session` gesetzt → Redirect auf
   `/konto`.
6. Vercel-Logs (Function `auth/customer/[...nextauth]`) auf Fehler
   prüfen — `redirect_uri_mismatch`, `oauth_unverified_conflict`,
   `oauth_no_email` sind die drei wahrscheinlichsten Fehlerklassen.

---

## Cross-Cutting für S05 + S06: Strukturiertes Pflicht-Logging

> **Decision IT13 (Orchestrator-Entscheidung 2026-05-04 — verbindlich,
> kein „optional"):** Bei jedem 5xx-Pfad in `/api/upload` und
> `/api/bookings` MUSS ein strukturierter Server-Log-Eintrag mit dem
> unten spezifizierten Schema in den Vercel-Logs landen. Ziel: kein
> Stochern mehr im Nebel bei Production-Bugs.

### Helper

Neue Datei: `src/lib/log-request-error.ts`.

```ts
import type { NextRequest } from 'next/server';

export interface RequestErrorContext {
  endpoint: string;                 // z.B. 'POST /api/bookings'
  requestId: string;                // UUID v4 pro Request
  authState: 'anonymous' | 'authenticated' | 'admin';
  customerId?: string | null;       // gesetzt bei authenticated
  status: number;                   // HTTP-Status der Antwort
}

export interface ExtractedErrorFields {
  errorClass: string;               // err.constructor.name
  errorMessage: string;
  prismaCode?: string;              // P-Code wenn Prisma-Fehler
  prismaMeta?: unknown;             // err.meta wenn Prisma
  resendCode?: string;              // wenn Resend SDK-Error
  resendStatusCode?: number;
  blobErrorName?: string;           // wenn @vercel/blob-Error
  blobStatusCode?: number;
}

export function logRequestError(
  ctx: RequestErrorContext,
  err: unknown,
): void {
  const fields = extractErrorFields(err);
  // Single-line JSON für Vercel-Logs-Grep + Strukturierte Suche.
  console.error(
    `[${ctx.endpoint}] requestId=${ctx.requestId} status=${ctx.status} ` +
      `auth=${ctx.authState} customerId=${ctx.customerId ?? '-'} ` +
      `errorClass=${fields.errorClass} ` +
      (fields.prismaCode ? `prismaCode=${fields.prismaCode} ` : '') +
      (fields.prismaMeta ? `prismaMeta=${JSON.stringify(fields.prismaMeta)} ` : '') +
      (fields.resendCode ? `resendCode=${fields.resendCode} ` : '') +
      (fields.resendStatusCode ? `resendStatus=${fields.resendStatusCode} ` : '') +
      (fields.blobErrorName ? `blobError=${fields.blobErrorName} ` : '') +
      (fields.blobStatusCode ? `blobStatus=${fields.blobStatusCode} ` : '') +
      `message=${JSON.stringify(fields.errorMessage)}`,
    err, // raw error als zweites Argument für Stack-Trace im Log-Stream
  );
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

function extractErrorFields(err: unknown): ExtractedErrorFields { /* … */ }
```

### Pflicht-Schema pro 5xx-Logeintrag

Jeder Eintrag MUSS folgende Felder enthalten:

| Feld          | Quelle                                    | Beispiel |
|---------------|-------------------------------------------|----------|
| `endpoint`    | `'POST /api/bookings'` oder `'POST /api/upload'` | — |
| `requestId`   | UUID v4, frisch pro Request               | `e1f2…` |
| `authState`   | `anonymous` / `authenticated` / `admin`   | `anonymous` |
| `customerId`  | aus `customer-session`-Cookie wenn da     | `cuid…` |
| `status`      | HTTP-Status der Response                  | `500` |
| `errorClass`  | `err.constructor.name`                    | `PrismaClientKnownRequestError` |
| `prismaCode`  | bei Prisma-Fehlern (P10xx/P20xx/P21xx)    | `P2022` |
| `prismaMeta`  | bei Prisma-Fehlern (Spalten-/Tabellen-Info) | `{column:'cancelledAt'}` |
| `resendCode`  | bei Resend-Fehlern                        | `validation_error` |
| `resendStatusCode` | bei Resend-Fehlern                   | `422` |
| `blobErrorName` / `blobStatusCode` | bei `@vercel/blob`-Fehlern | `BlobAccessError` / `403` |
| `message`     | `err.message` JSON-escaped                | — |

### Integration in beide Routen

`/api/upload/route.ts` und `/api/bookings/route.ts`:

1. Am Anfang des `POST`-Handlers: `const requestId = newRequestId();`
2. Im äußeren `catch (err)`-Block:
   ```ts
   logRequestError(
     { endpoint: 'POST /api/bookings', requestId, authState, customerId, status: 500 },
     err,
   );
   ```
3. Response-Header `X-Request-Id: <requestId>` mitgeben — der Kunde
   kann dem Support diese ID nennen für Log-Korrelation.
4. `internalError(err, route)` in `src/lib/api.ts` wird ergänzt: nimmt
   optional einen `requestId` entgegen und ruft intern `logRequestError`
   auf, damit Bestands-Code automatisch profitiert.

### Frontend-Sichtbarkeit

Frontend zeigt bei 5xx-Antworten den `X-Request-Id` als kleinen Hinweis:

> „Bitte später erneut versuchen oder anrufen: 0157 74787512.
> Fehler-Code: e1f2-…"

Tom kann die ID in den Vercel-Logs suchen.

### Akzeptanzkriterium-Erweiterung

Sowohl S05 als auch S06 haben als Pflicht-Akzeptanzkriterium:

- [ ] Given ein 5xx-Pfad in `/api/upload` oder `/api/bookings` wird
      ausgelöst, when der Request endet, then existiert in den
      Vercel-Logs ein einzeiliger strukturierter `console.error`-Eintrag
      mit allen Pflicht-Feldern (siehe Schema oben).

---

## S05 — Bug `/api/upload` (INTERNAL_ERROR)

### Symptom (Tom)

> „Upload zum Speicher fehlgeschlagen. Bitte später erneut versuchen.
> (INTERNAL_ERROR)"

Tritt nur in Production auf. Lokal nicht reproduzierbar.

### Quellcode-Analyse

`src/app/api/upload/route.ts` ist sauber:

- Hat korrekt `runtime = 'nodejs'` (Zeile 43). ✓
- Hat korrekt `dynamic = 'force-dynamic'` (Zeile 42). ✓
- Multipart-Parsing via `req.formData()` mit Try/Catch. ✓
- 0-Byte/Whitelist/Magic-Bytes-Validation. ✓
- `BLOB_READ_WRITE_TOKEN`-Check vor `put()` mit klarem 503-Fallback
  (Zeile 242–250). ✓
- `put()`-Fehler-Catch mit Auth-Detection und Status-Code-Mapping
  (Zeile 265–292). ✓
- Defensives Logging mit Kontext (Zeile 273–278). ✓

Die Fehlermeldung „Upload zum Speicher fehlgeschlagen. Bitte später
erneut versuchen." kommt aus dem `put()`-Catch (Zeile 289). Der Code
`INTERNAL_ERROR` mit Status 502 wird zurückgegeben. **Das deutet auf
einen Fehler im `put()`-Aufruf hin**, nicht auf einen früheren Crash.

### Hypothesen-Liste (priorisiert nach Wahrscheinlichkeit)

1. **`BLOB_READ_WRITE_TOKEN` fehlt oder ist falsch im Production-Branch
   gesetzt.** Test passt **nicht**: Wenn der Token gar nicht gesetzt
   wäre, würde der Code 503 `BLOB_NOT_CONFIGURED` zurückgeben (Zeile
   244), nicht `INTERNAL_ERROR`. → Wahrscheinlich gesetzt aber **mit
   falschem Wert** (z. B. von einem alten/gelöschten Blob-Store).
2. **Vercel-Blob-Store wurde im Vercel-Dashboard neu angelegt / gelöscht
   und der Token gehört zu einem nicht mehr existierenden Store.** Sehr
   wahrscheinlich, denn IT11/IT12 hatten dieses Feature live, und Tom
   hat möglicherweise das Marketplace-Integration neu konfiguriert.
3. **Vercel-Function-Body-Size-Limit überschritten.** Vercel Hobby hat
   ein Default-Body-Size-Limit von **4.5 MB für Serverless Functions**.
   Bei einer 10 MB Bilddatei (laut Story-Limit erlaubt) **schlägt der
   Upload bereits beim `req.formData()`-Parsing fehl**, bevor unser
   Code den Token-Check erreicht. Allerdings würde das einen
   `VALIDATION_ERROR` triggern (Zeile 144–149: Catch um `formData()`),
   nicht `INTERNAL_ERROR`. → **Konkrete Hypothese:** das `formData()`-
   Parsen wirft eine Exception, die nicht vom inneren Try erfasst wird,
   weil sie aus dem Stream-Reader kommt und erst beim
   `f.arrayBuffer()`-Aufruf (Zeile 205) auftritt. Dieser Pfad wirft
   eine Exception, die vom äußeren `try/catch` gefangen wird (Zeile
   315) und zu `internalError(err)` führt — was als `INTERNAL_ERROR`
   gerendert wird.
4. **Vercel Function Memory/Timeout.** Hobby-Plan: 1024 MB RAM, 10 s
   Timeout. Bei 10 MB Bild + Magic-Bytes-Check (4100 Bytes) +
   `arrayBuffer()` (10 MB Kopie) ist die Memory-Belastung groß aber
   verkraftbar. Timeout: das Hochladen einer 10 MB-Datei zu Vercel Blob
   sollte unter 10s bleiben, aber bei schlechter Kunden-Bandbreite
   (3G-Smartphone) wird die `req.formData()`-Phase schon den Großteil
   der 10s konsumieren.
5. **`@vercel/blob` Library-Update / SDK-Inkompatibilität.** ARCHITECTURE
   sagt `@vercel/blob 2.3.x`. Falls Vercel Build mit einem neueren SDK
   gebaut hat (`npm install` ohne lockfile-Pin), könnte das `put()`-
   Argument-Format leicht geändert haben. Niedrige Wahrscheinlichkeit,
   da package-lock.json normalerweise gepinnt ist.
6. **Wrong region / Blob-Store-Region-Mismatch.** Vercel Blob ist
   single-region; wenn die Function in einer anderen Region läuft als
   der Blob-Store, kann es zu Latenz kommen, aber kein 502.

### Verifikations-Schritte (sequenziell)

```bash
# 1. ENV-Vars in Vercel prüfen
vercel env ls --environment=production
# erwartet: BLOB_READ_WRITE_TOKEN gesetzt, beginnt mit "vercel_blob_rw_"

# 2. Token-Validität gegen API testen
# Im Vercel-Dashboard → Storage → den passenden Blob-Store öffnen, Token-
# Liste prüfen. Ist der Token aktiv? Gehört er zu DEM Store, den die App
# gerade nutzt?

# 3. Vercel-Logs der letzten Upload-Fails analysieren
vercel logs --since=1h | grep "vercel blob put failed"
# erwartet: konkrete name/code/status/path-Logs (siehe Zeile 273-278)

# 4. Lokal mit Production-Token reproduzieren
BLOB_READ_WRITE_TOKEN=<prod-token> npm run dev
# Datei hochladen über das lokale UI → erwartete 201

# 5. Body-Size-Limit testen
# Eine 5 MB-Datei hochladen → wenn das funktioniert, eine 9 MB → wenn das
# scheitert, ist Vercel-Body-Limit das Problem (Hobby-Default ~4.5 MB).
```

### Lösungspfad — Direct-Upload via `@vercel/blob/client` (verbindlich)

> **Decision IT13 (Orchestrator-Entscheidung 2026-05-04 — verbindlich):**
> Wir lösen S05 strukturell durch **Client-Side Direct-Upload**. Der
> Browser lädt die Datei direkt zu Vercel Blob hoch, der Server stellt
> nur ein kurz-lebiges signed Token aus. Damit fällt das Vercel-Hobby-
> 4.5-MB-Body-Limit komplett weg, und 10-MB-Uploads (Story-AC) sind
> sauber möglich. Begründung gegen die Alternativen:
> - Client-Side-Resize (Variante B): Qualitätsverlust, keine Lösung
>   für 10 MB PDFs/Videos. Verworfen.
> - Pro-Plan-Upgrade (Variante C): kostet Geld, löst Body-Limit aber
>   nicht ENV-Token-Drift. Verworfen.
> - Aktueller Server-Side-Upload behalten + Größe deckeln auf 4 MB:
>   verstößt gegen Story-AC „bis 10 MB akzeptiert". Verworfen.

#### Endpoint-Vertrag — neuer Token-Endpoint

```
POST /api/upload/token
Auth: customer-session-Cookie ODER Booking-Session (kein anonymer Zugriff)
     → 401 UNAUTHORIZED wenn weder Customer-Session noch eingeloggter Kunde
     → Begründung: Direct-Upload ohne Auth wäre offen für
       Drittnutzung; Kunden, die anonym buchen, hängen Dateien aktuell
       NICHT an (Buchungs-Wizard hat den Upload-Schritt eh nur für
       eingeloggte Sessions / nach Konto-Anlegen)
Content-Type: application/json
Body: {
  filename: string,         // Original-Dateiname (für Pfad-Suffix)
  contentType: string,      // MIME-Type — gegen Whitelist geprüft
  sizeBytes: number,        // 1 .. (10 MB | 50 MB | 10 MB) je nach MIME
}

Response 201:
  { data: {
      uploadUrl: string,    // signed URL zu blob.vercel-storage.com
      token: string,        // Client-Token, 5 Min gültig
      blobPath: string,     // uploads/<ts>-<rnd>-<sanitizedName>
      attachmentId: string, // bereits angelegtes BookingAttachment (bookingId=null)
      maxBytes: number,     // server-enforced final limit
    } }

Errors:
  400 VALIDATION_ERROR (filename/contentType/sizeBytes)
  401 UNAUTHORIZED (kein Cookie/Session)
  413 PAYLOAD_TOO_LARGE (sizeBytes über MIME-Limit)
  415 UNSUPPORTED_MEDIA_TYPE (MIME nicht in Whitelist)
  429 RATE_LIMITED (10/min/IP — analog Bestand)
  500 INTERNAL_ERROR (Blob-Token-Generation fehlgeschlagen)
  503 BLOB_NOT_CONFIGURED
```

#### Implementierung (Server)

```ts
// src/app/api/upload/token/route.ts
import { handleUpload } from '@vercel/blob/client';
// alternativ low-level: generateClientTokenFromReadWriteToken
```

> `@vercel/blob/client` exportiert `handleUpload({ token, request,
> onBeforeGenerateToken, onUploadCompleted })`. Wir nutzen
> `onBeforeGenerateToken` für: (a) Auth-Check, (b) MIME-Whitelist-Check,
> (c) Size-Limit-Check, (d) BookingAttachment-Pre-Insert mit
> `bookingId=null`.

```ts
// Pseudo-Code (Skeleton — Engineer detailliert in der Implementierung):
export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  try {
    const session = await readCustomerSessionFromRequest(req);
    const authState = session?.customerId ? 'authenticated' : 'anonymous';

    // Anonymer Zugriff: erlaubt für Gast-Buchungen (siehe Decision IT13 unten),
    // aber Rate-Limiter strikter ziehen.
    const ip = getClientIp(req.headers);
    const limit = await uploadLimiter.limit(`upload-token:${ip}`);
    if (!limit.success) return apiError({ code: 'RATE_LIMITED', ... });

    const body = await req.json();
    const parsed = UploadTokenRequestSchema.parse(body);

    // MIME + Size-Whitelist
    if (!ACCEPTED_TYPES.has(parsed.contentType))
      return apiError({ code: 'UNSUPPORTED_MEDIA_TYPE', ... });
    const limitBytes = getUploadLimitForType(parsed.contentType);
    if (parsed.sizeBytes > limitBytes)
      return apiError({ code: 'PAYLOAD_TOO_LARGE', ... });

    // BookingAttachment vorab anlegen
    const safeName = sanitizeFilename(parsed.filename);
    const blobPath = `uploads/${Date.now()}-${randSuffix()}-${safeName}`;
    const attachment = await prisma.bookingAttachment.create({
      data: { bookingId: null, url: '', filename: parsed.filename,
              contentType: parsed.contentType, sizeBytes: parsed.sizeBytes },
    });

    // Token von Vercel Blob anfordern
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) return apiError({ code: 'BLOB_NOT_CONFIGURED', status: 503 });

    const { token, uploadUrl } = await generateClientTokenFromReadWriteToken({
      token: blobToken,
      pathname: blobPath,
      allowedContentTypes: [parsed.contentType],
      maximumSizeInBytes: limitBytes,
      validUntil: Date.now() + 5 * 60 * 1000, // 5 Min
      addRandomSuffix: false, // wir kontrollieren den Pfad selbst
    });

    return apiSuccess({
      uploadUrl, token, blobPath,
      attachmentId: attachment.id,
      maxBytes: limitBytes,
    }, 201);
  } catch (err) {
    logRequestError({ endpoint: 'POST /api/upload/token', requestId,
      authState: 'unknown', status: 500 }, err);
    return internalError(err, 'POST /api/upload/token');
  }
}
```

> **Hinweis Vercel-SDK:** Die exakte SDK-Funktion heißt je nach
> `@vercel/blob`-Version unterschiedlich
> (`generateClientTokenFromReadWriteToken` oder `handleUpload`-Wrapper).
> Engineer prüft die installierte Version (`npm ls @vercel/blob`) und
> wählt das passende API. Verhalten nach außen identisch.

#### Anonyme vs. authentifizierte Direct-Uploads — Entscheidung

> **Decision IT13:** Direct-Upload-Token MUSS auch für
> **anonyme Gast-Buchungen** funktionieren — sonst können
> Nicht-eingeloggte Kunden keine Bilder zu ihrer Anfrage anhängen
> (ist aber bereits IT11-Bestand, also Regression vermeiden).
> Schutz gegen Drittmissbrauch:
> - Rate-Limit `10/min/IP` (wie Bestand).
> - Token nur 5 Minuten gültig.
> - Blob-Pfad enthält randomisiertes Präfix.
> - `maximumSizeInBytes` und `allowedContentTypes` werden in den Token
>   eingebrannt — kein Größen-/MIME-Bypass möglich.
> - `BookingAttachment` mit `bookingId=null` ist orphan und wird vom
>   bestehenden Cleanup-Backlog (24 h-Cron, ARCHITECTURE §12) eingesammelt.

#### Frontend-Flow

```ts
// src/components/booking/FileUpload.tsx (Pseudo-Code)
import { upload } from '@vercel/blob/client';

async function handleFile(file: File) {
  // 1. Token-Anfrage an unseren Server
  const tokenRes = await apiClient.post('/api/upload/token', {
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  const { uploadUrl, token, blobPath, attachmentId } = tokenRes.data;

  // 2. Direct-Upload zum Blob (Browser → Vercel Blob, KEIN Server)
  const blob = await upload(blobPath, file, {
    access: 'public',
    handleUploadUrl: uploadUrl,
    clientPayload: token,
  });

  // 3. Attachment-Record finalisieren (URL nachtragen)
  await apiClient.patch(`/api/upload/attachments/${attachmentId}`, {
    url: blob.url,
  });

  return { attachmentId, url: blob.url };
}
```

#### Zweiter neuer Endpoint: Attachment-Finalize

```
PATCH /api/upload/attachments/[id]
Auth: same as token-Endpoint (Cookie/Session ODER anonym mit Token-Match)
Body: { url: string }   // Vercel-Blob-URL aus Direct-Upload
Response 200: { data: { attachmentId, url } }
Validierung:
  - id existiert
  - bookingId === null (noch nicht verlinkt)
  - url passt zur erwarteten Blob-Domain (`*.public.blob.vercel-storage.com`)
  - alter URL-Wert ist leer (idempotenter Re-Submit erlaubt)
```

> Alternativ: das `onUploadCompleted`-Webhook von `@vercel/blob`
> könnte Vercel→Server callen und die URL automatisch nachtragen.
> Setzt aber öffentliche Webhook-URL voraus und Webhook-Secret-
> Verification. **Decision IT13:** wir bleiben bei der expliziten
> Frontend-PATCH-Variante — einfacher, weniger Moving Parts.

#### Migration vom alten `/api/upload`-Endpoint

> **Decision IT13:** Der bestehende `POST /api/upload` (Multipart-
> Server-Side-Upload) wird **gelöscht**, sobald Frontend den neuen
> Direct-Upload-Flow nutzt. Während der Übergangsphase (eine
> Deployment-Iteration) bleibt der alte Endpoint erhalten und gibt
> Status 410 GONE mit Body
> `{ error: { code: 'UPLOAD_LEGACY', message: 'Bitte Seite neu laden — neuer Upload-Pfad aktiv.' } }`
> zurück, falls noch alte Browser-Tabs offen sind.

#### Sofort-Maßnahme parallel zum Refactor

Auch wenn Direct-Upload die strukturelle Lösung ist: **vorher** prüfen,
ob der `BLOB_READ_WRITE_TOKEN` in Production überhaupt korrekt gesetzt
ist (siehe Verifikations-Schritte oben). Ein Token-Drift würde auch
den neuen Direct-Upload-Pfad sofort scheitern lassen.

```bash
vercel env ls --environment=production | grep BLOB_READ_WRITE_TOKEN
# Im Vercel-Dashboard: Storage → Blob-Store → Connect to Project
# (Token wird automatisch in die Project-Envs geschrieben)
```

### Endpoint-Spezifikation Übersicht (Stand IT13 nach Refactor)

```
POST /api/upload/token              (NEU)
PATCH /api/upload/attachments/[id]  (NEU)
POST /api/upload                    (DEPRECATED, 410 GONE während Übergang)
```

Alle drei Endpoints loggen 5xx über `logRequestError()` (siehe
Cross-Cutting-Sektion).

---

## S06 — Bug `/api/bookings` (Interner Serverfehler)

### Symptom (Tom)

> „Interner Serverfehler. Bitte später erneut versuchen."

Tritt nur in Production auf. Blockiert das Kerngeschäft (höchste Prio).

### Quellcode-Analyse

`src/app/api/bookings/route.ts` ist die zentrale Booking-POST-Route.

- `runtime = 'nodejs'`. ✓
- `dynamic = 'force-dynamic'`. ✓
- Idempotency-Key-Lookup vor Rate-Limit. ✓
- Rate-Limiter, dann JSON-Parse, dann Zod-Validate (`CreateBookingSchema`).
- Customer-Session-Lookup (`readCustomerSessionFromRequest`).
- Adress-Pflicht-Check für eingeloggte Kunden ohne Adresse im Body.
- Doppel-Submit-Dedup-Lookup auf Bookings der letzten 60s.
- Slot-Verfügbarkeits-Check (Date-Modus) oder Slot-Lookup (Slot-Modus).
- **Booking-Insert in Serializable-Tx** über
  `createBookingWithOverlapCheck()`.
- Attachment-Linking, Token-Signierung, fire-and-forget Mail.

Der Catch am Ende (Zeile 678–681) ist:

```ts
} catch (err) {
  if (err instanceof ZodError) return zodErrorResponse(err);
  return internalError(err, 'POST /api/bookings');
}
```

`internalError()` rendert genau die Meldung „Interner Serverfehler. Bitte
später erneut versuchen." mit `code: 'INTERNAL_ERROR'`, Status 500.

### Hypothesen-Liste (priorisiert)

1. **Prisma kann sich nicht zur Turso-DB verbinden — `DATABASE_URL`
   fehlt oder ist falsch im Production-Branch.** Symptome: P1001
   (`Can't reach database server`) oder P1017 (Connection closed). Das
   wäre ein Logging-Eintrag à la
   `[POST /api/bookings] PrismaClientKnownRequestError P1001 …`.
2. **Migration fehlt in Production-DB.** P2022 (`The column ... does
   not exist`). Wahrscheinlichkeit hoch — IT11
   (`20260504100000_add_booking_cancellation_audit`), IT12
   (`20260504120000_iteration_12_marketing`) und Customer-Address
   (`20260503163821_add_customer_address`) sind die letzten
   Migrationen. Wenn nach einem Re-Deploy nicht alle gegen Turso
   ausgerollt wurden (`turso db shell …`-Schritt vergessen), passt
   Prisma-Client-Schema nicht zur Realität. → **Vergangenheits-Muster**:
   IT10 hat genau diesen Bug schon gefixt (siehe ARCHITECTURE §11 IT10).
3. **`BOOKING_TOKEN_SECRET` fehlt in Production.** Zeile 609–619:
   `signBookingConfirmationToken`/`signBookingCancellationToken` werden
   in `Promise.all` gerufen. Bei fehlender Env wirft `jose` einen Fehler
   (`Missing or invalid secret`). Der `try/catch` darum (Zeile 609–619)
   loggt aber nur und wirft nicht weiter — also kann das Booking-Insert
   gelingen, der Token sein null. → **Wenig wahrscheinlich**, dass
   genau diese Stelle das `INTERNAL_ERROR` triggert. Ausschließbar durch
   Log-Inspektion.
4. **`AUTH_SECRET` fehlt → `readCustomerSessionFromRequest` wirft.**
   Diese Funktion (`src/lib/customer-auth.ts`) verifiziert den
   `customer-session`-Cookie. Wenn die Env fehlt, wirft `jose` —
   landet im äußeren Catch.
5. **Idempotency-Tabelle fehlt in Production-DB.** Wenn die Migration
   `20260504120000_iteration_12_marketing` (die `idempotency_keys`
   anlegt) nicht eingespielt wurde, würde `lookupIdempotencyResponse`
   bei einem nicht-leeren `Idempotency-Key` einen P2021 (`The table
   ...does not exist`) werfen. Das Frontend setzt diesen Header (siehe
   IT12). → Sehr wahrscheinliche Ursache, falls Migration fehlt.
6. **`buffer_config`-Singleton fehlt.** `createBookingWithOverlapCheck`
   liest `BufferConfig` (siehe `lib/booking-create.ts`). Wenn die Tabelle
   leer ist (Seed-Schritt vergessen), würde `findFirst()` `null` liefern
   — der Code-Pfad mit Default `30` greift, kein Crash. Niedrig.
7. **Resend-Fehler killt den Request.** Die Mail läuft fire-and-forget
   (`void runMailDispatch(...).catch(...)`, Zeile 639–641). Das ist
   syntaktisch korrekt — auch wenn Resend fehlschlägt, wirft das nicht
   in den `POST`-Handler zurück. Außer: `runMailDispatch` ist async
   und der erste `await` wirft synchron (z. B. wenn die Funktion gar
   keinen `await` enthält und nur eine Exception synchron wirft). → Code
   sieht okay aus, niedrig.
8. **Customer-Session-Lookup gegen kaputtes Schema.**
   `readCustomerSessionFromRequest` läuft eine Prisma-Query gegen
   `customer_users`. Wenn dort eine in IT13 noch fehlende Spalte
   abgefragt würde, wäre das ein P2022. Aber für IT13 sind keine neuen
   `customer_users`-Spalten geplant — niedrig.

### Verifikations-Schritte (sequenziell)

```bash
# 1. Vercel-Logs auf den genauen Fehler-Code
vercel logs --since=2h | grep "POST /api/bookings" | grep -iE "P10|P20|P21|prisma"
# Erwartet: ein Prisma-Code wie P1001/P2022/P2021

# 2. ENV-Vars Vollständigkeit
vercel env ls --environment=production | grep -E "DATABASE_URL|AUTH_SECRET|BOOKING_TOKEN_SECRET|RESEND_API_KEY|MAIL_FROM|MAIL_TO_ADMIN|NEXTAUTH_URL|NEXT_PUBLIC_BASE_URL"
# Alle 8 Vars müssen vorhanden sein.

# 3. Migrations-Status gegen Turso prüfen
turso db shell baerenstark-prod "SELECT name FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10"
# Erwartet: 20260504120000_iteration_12_marketing als jüngster Eintrag

# 4. Schema-Drift-Check — IT11 + IT12 Migrations einzeln verifizieren
turso db shell baerenstark-prod "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('idempotency_keys','marketing_emails','marketing_email_recipients')"
# Erwartet: 3 Zeilen.

turso db shell baerenstark-prod "PRAGMA table_info(bookings)" | grep -E "cancelledAt|cancelledBy|cancellationReason"
# Erwartet: 3 Treffer.

turso db shell baerenstark-prod "PRAGMA table_info(customer_users)" | grep -E "streetAndNumber|postalCode|city|unsubscribedAt"
# Erwartet: 4 Treffer.

# 5. Lokal mit Production-DB-Snapshot reproduzieren (read-only).
DATABASE_URL=<prod-url-readonly> npm run dev
# Versuch eine Buchung zu posten. Wenn es lokal genauso scheitert, ist
# es ein Schema/DB-Problem. Wenn lokal funktioniert, ist es ein
# Vercel-spezifisches Env- oder Network-Problem.

# 6. Manueller curl-Test in Production
curl -X POST https://www.baerenstark-hausservice.app/api/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"customerName":"Test","customerEmail":"test@example.com","customerPhone":"+49 …","service":"sonstiges","description":"Smoke","date":"2026-05-15","startTime":"10:00","durationMinutes":60,"addressStreet":"…","addressZip":"64283","addressCity":"Darmstadt","privacyAccepted":true}'
# Erwartet: 201 mit { data: { id, … } }
# Bei 500: Vercel-Logs sofort danach durchforsten (Zeitstempel-Match).
```

### Lösungspfad (priorisiert)

1. **Migration nachziehen** (wahrscheinlichste Ursache):
   ```bash
   turso db shell baerenstark-prod < prisma/migrations/20260504120000_iteration_12_marketing/migration.sql
   turso db shell baerenstark-prod < prisma/migrations/20260504100000_add_booking_cancellation_audit/migration.sql
   # _prisma_migrations-Tabelle pflegen
   ```
   Re-Deploy / oder einfach Cache-Bust durch Function-Invocation.
2. **ENV-Vars prüfen und nachsetzen** falls eine fehlt.
3. **Strukturiertes Pflicht-Logging integrieren** (siehe Cross-Cutting-
   Sektion oben — verbindlich, kein Optional). `internalError()` in
   `src/lib/api.ts` wird so erweitert, dass es `logRequestError()`
   intern aufruft und den `requestId` als `X-Request-Id`-Header
   zurückgibt:
   ```ts
   // src/lib/api.ts (gekürzt)
   export function internalError(
     err: unknown,
     route: string,
     ctx?: { requestId?: string; authState?: 'anonymous' | 'authenticated' | 'admin'; customerId?: string | null },
   ): Response {
     const requestId = ctx?.requestId ?? newRequestId();
     logRequestError(
       { endpoint: route, requestId,
         authState: ctx?.authState ?? 'anonymous',
         customerId: ctx?.customerId, status: 500 },
       err,
     );
     return apiError({
       code: 'INTERNAL_ERROR',
       message: 'Interner Serverfehler. Bitte später erneut versuchen.',
       status: 500,
       headers: { 'X-Request-Id': requestId },
     });
   }
   ```
   In `POST /api/bookings`-Handler dann:
   ```ts
   const requestId = newRequestId();
   const session = await readCustomerSessionFromRequest(req);
   const authState = session?.customerId ? 'authenticated' : 'anonymous';
   // ... 
   } catch (err) {
     if (err instanceof ZodError) return zodErrorResponse(err);
     return internalError(err, 'POST /api/bookings',
       { requestId, authState, customerId: session?.customerId ?? null });
   }
   ```

### Endpoint-Spezifikation (unverändert ggü. IT12)

```
POST /api/bookings
Auth: none (öffentlich) — eingeloggte Kunden via customer-session-Cookie
Headers (optional): Idempotency-Key: <uuid>
Body: CreateBookingSchema (Zod) — Date- ODER Slot-Modus

Response 201:
  { data: { id, status, createdAt, confirmationToken, cancellationToken } }
Response 200 (Idempotency-Replay oder Doppel-Submit-Dedup):
  { data: { id, status, createdAt, confirmationToken, cancellationToken, deduplicated?: true } }

Errors:
  400 VALIDATION_ERROR (Zod-Fehler, address_required, durationMinutes,
                        attachmentIds-zu-viele)
  404 NOT_FOUND (slotId, attachmentIds)
  409 CONFLICT (date — Tag nicht aktiv)
  409 CONFLICT (date, subcode BOOKING_SLOT_TAKEN — Race / Overlap)
  409 CONFLICT (durationMinutes — Window/Buffer-Verletzung)
  409 CONFLICT (attachmentIds — bereits verknüpft)
  429 RATE_LIMITED
  500 INTERNAL_ERROR  ← ZIEL: nicht mehr triggern.
```

---

## Datenmodell

Keine Schema-Änderungen in IT13. Keine neue Migration.

---

## Authentication & Authorization

Keine neuen Helper, keine neuen Policies. Bestehende Helper:
- `getCustomerFromRequest()` für eingeloggte Kunden.
- `requireActiveAdmin()` für Admin-Routes (in IT13 nicht relevant).

---

## Background Jobs / External Integrations

Keine neuen. Bestehende Resend-fire-and-forget-Pipeline und Vercel-Blob-
Upload bleiben unverändert (außer den ENV-Fixes).

---

## Non-functional Requirements

- `/api/upload/token` p95 < 200 ms (nur Token-Issue + DB-Insert).
- Direct-Upload Browser→Vercel Blob: Latenz hängt von Kunden-Bandbreite
  ab; nicht mehr Vercel-Function-Pfad. Kein 10s-Timeout-Risiko.
- `/api/upload/attachments/[id]` p95 < 100 ms.
- `/api/bookings` p95 < 800 ms (Idempotency-Replay < 200 ms).
- Strukturiertes Pflicht-Logging (siehe Cross-Cutting): jede 5xx-Antwort
  muss einen `requestId`-stamped, single-line `console.error`-Eintrag
  in den Vercel-Logs hinterlassen.
- Rate-Limits: 10/min/IP für `/api/upload/token`; 10/h/IP für
  `/api/bookings`.

---

## Story Coverage

| Story | Backend Deliverable |
| ----- | ------------------- |
| S01   | Statische Server Component `src/app/datenschutz/datenloesung/page.tsx` + Update auf `src/app/datenschutz/page.tsx`. Keine API. |
| S02   | ENV-Var-Setup (`AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET`, mit Alias-Akzeptanz für `FACEBOOK_CLIENT_ID/SECRET`); FB-Console-Redirect-URI-Eintrag (mit `customer/`-Pfad — siehe SoT-Box); minimaler Code-Adjust in `src/lib/customer-oauth.ts` (ENV-Naming-Akzeptanz, Scope-Komma). |
| S05   | Direct-Upload-Refactor: neue Endpoints `POST /api/upload/token` + `PATCH /api/upload/attachments/[id]`, alter `POST /api/upload` → 410 GONE während Übergangsphase. ENV-Token-Verifikation parallel. Strukturiertes Pflicht-Logging (`logRequestError`). |
| S06   | Migrations-Drift gegen Turso fixen; ENV-Vollständigkeit; `internalError()` ergänzt um `logRequestError()`-Aufruf + `X-Request-Id`-Header. |

---

## Decisions IT13 (Source of Truth)

Diese Entscheidungen sind **verbindlich** und überstimmen frühere
Vorschläge / Open Questions / Story-Notes.

1. **Datenlöschungs-URL:** `/datenschutz/datenloesung` (nicht
   `/datenschutz/loeschung`). Story-AC und UX-Spec stimmen überein.
2. **Facebook-Callback-URL:**
   `https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook`
   (mit `customer/`-Segment). PM korrigiert die Story-Notes parallel.
3. **Strukturiertes Pflicht-Logging** in beiden Bug-Routen via
   `src/lib/log-request-error.ts` und `internalError()`-Erweiterung.
   Keine 5xx-Antwort darf ohne strukturierten Log-Eintrag passieren.
4. **S05 Lösungsweg** = **Direct-Upload via `@vercel/blob/client`**
   (Variante A). Variante B (Client-Side-Resize) und C (Pro-Plan) sind
   verworfen.
5. **S05 Endpoint-Migration:** Bestehender `POST /api/upload` wird
   **gelöscht** und gibt während der Übergangsphase 410 GONE zurück.
6. **Anonyme Direct-Uploads erlaubt** (Gast-Buchungen brauchen den
   Pfad). Schutz: 5-Min-Token, 10/min/IP-Rate-Limit, MIME-/Size-Limit
   im Token eingebrannt.

---

## Open Questions (für QA / Tom)

1. **Account-Linking-Konflikt Facebook ⟷ Google:** Wenn ein Kunde
   bisher mit Google verlinkt war und nun Facebook nutzt (gleiche
   E-Mail), wird `oauthProvider`/`oauthId` auf Facebook überschrieben.
   Beide Provider funktionieren weiter (E-Mail-Match-Pfad), aber der
   "primäre" Provider in der DB-Spalte wechselt. Akzeptabler Trade-off
   oder soll IT13 ein Multi-OAuth-Schema (separate
   `customer_oauth_accounts`-Tabelle) einführen? **Empfehlung: nicht
   in IT13**, Backlog.
2. **`BOOKING_TOKEN_SECRET` Fallback:** Aktuell loggt der Code nur,
   wenn die Env fehlt, und schreibt `confirmationToken=null` in die
   DB. Soll IT13 den Booking-Insert hart fehlschlagen lassen, wenn
   Tokens nicht signiert werden können? **Empfehlung: ja, hart fehlen**
   — sonst kommt der Kunde nicht auf seine Bestätigungsseite.
3. **Migration-Auto-Apply:** Lohnt sich für IT13 ein
   `scripts/migrate-turso.sh` (CLI-Wrapper) Backlog-Item zu erledigen,
   um die manuellen Turso-Shell-Schritte zu automatisieren? **Vorschlag:
   ja**, kostet ~30 min und beseitigt die Hauptursache von S06 strukturell.
4. **`@vercel/blob`-SDK-Funktion exakter Name:** Je nach SDK-Version
   heißt der Token-Issuer `generateClientTokenFromReadWriteToken` oder
   `handleUpload`. Engineer prüft `npm ls @vercel/blob`. Verhalten
   nach außen identisch — bekannte Variabilität, kein Decision-Block.
