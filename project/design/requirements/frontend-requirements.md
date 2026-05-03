# Frontend Requirements — Iteration 7 (Auth-Stabilisierung & Email-Auth-Reversion)

> **Hinweis:** Diese Datei ist die IT7-spezifische Anforderungsspez. Für IT1–IT6
> ist der Bestand verbindlich (siehe `ARCHITECTURE.md`, `ARCHITECTURE_IT6.md`).
> Quelle der Wahrheit für IT7: `ARCHITECTURE_IT7.md`. Schemas:
> `contracts/zod-schemas.ts`. Endpoints: `contracts/api-routes.md` §23.

## Overview

IT7 stellt Customer-Email/Password-Auth wieder her (Reversion von US-IT6-05
D3-Fix), repariert Google- und Facebook-OAuth durch Diagnose und Härtung,
gibt Tom ein CLI-Skript zur Admin-Wiederherstellung und implementiert den
Passwort-Reset-Flow E2E.

Frontend-seitig sind 4 Pages neu zu bauen (`/konto/registrieren`,
`/konto/passwort-vergessen`, `/konto/passwort-zuruecksetzen`,
`/konto/verifizieren(/erfolg)`), `/konto/login` ist um Credentials-Form +
verbesserte Fehlermeldungen zu erweitern, und ein Info-Banner für
nicht-verifizierte Konten kommt ins `/konto/layout.tsx`.

## Tech Stack

Bestand (unverändert, identisch mit IT4–IT6):

- **Framework:** Next.js 14 (App Router) + TypeScript
- **State:** React useState + Server-Components + schmaler `useCustomerSession()`-Hook
- **Styling:** Tailwind CSS mit `baerenstark`-Farbtokens (Braun #6b3e2e, Beige #f4ebd9)
- **Forms:** React Hook Form + Zod-Resolver (`src/lib/schemas.ts`)
- **HTTP-Client:** `src/lib/api-client.ts`
- **Build:** Next.js Pipeline auf Vercel

Keine neuen Frontend-Dependencies in IT7.

## Pages / Screens

### Page: Registrierung (route: `/konto/registrieren`)

- **Linked story:** US-IT7-01.
- **Purpose:** Email-/Passwort-Registrierung mit OAuth-Buttons als
  Alternative.
- **War in IT6 D3-Fix:** redirected zu `/konto/login`. Ab IT7: vollwertige
  Form.
- **Components:**
  - `<RegisterForm />` (Client) — RHF + ZodResolver auf
    `CustomerRegisterSchema` (firstName, lastName, email, password,
    passwordConfirm, phone optional, privacyAccepted Checkbox).
  - `<OAuthButtons />` (Client) — Google + Facebook + Hinweistext „oder".
  - `<ServerErrorBanner />` — bei `EMAIL_ALREADY_REGISTERED`,
    `RATE_LIMITED`, `VALIDATION_ERROR`.
  - `<LegalNote />` — Datenschutz- und AGB-Verweis.
- **Data needed:** `POST /api/customer/register`.
- **User interactions:**
  - Submit → `POST /register` → 201 → Redirect zu `/konto` mit
    Success-Banner „Bitte bestätigen Sie Ihre E-Mail-Adresse" (Banner
    persistiert via Layout-Banner-Komponente, siehe unten).
  - 409 `EMAIL_ALREADY_REGISTERED` → Inline-Fehler am Email-Feld + Link
    „Bereits registriert? Zum Login".
  - 429 `RATE_LIMITED` → Banner „Zu viele Versuche. Bitte versuchen Sie
    es in einer Stunde erneut."
- **Validierung (client-side):** alle Pflichtfelder, Email-Format,
  Passwort min. 8 Zeichen, `password === passwordConfirm`,
  `privacyAccepted === true`.

### Page: Login (route: `/konto/login`)

- **Linked story:** US-IT7-01, US-IT7-02, US-IT7-03.
- **Purpose:** Email/Password-Login + Google + Facebook nebeneinander.
- **War in IT6:** nur OAuth-Buttons. Ab IT7: zusätzlich Credentials-Form.
- **Components:**
  - `<LoginForm />` (Client) — RHF + ZodResolver auf
    `CustomerLoginSchema` (email, password, optional `redirectUrl`
    aus Query-Param).
  - `<OAuthButtons />` (Client) — Google + Facebook.
  - `<ForgotPasswordLink />` — `<Link href="/konto/passwort-vergessen">`.
  - `<ServerErrorBanner />` — siehe Mapping unten.
  - `<RegisterPromptLink />` — „Noch kein Konto? Registrieren".
- **Data needed:** `POST /api/customer/login`. OAuth-Flow geht über
  NextAuth-Routes (`/api/auth/customer/[...]`).
- **User interactions:**
  - Submit Credentials → 200 → `redirectUrl` aus Response (oder `/konto`).
  - 401 `INVALID_CREDENTIALS` → Banner „E-Mail oder Passwort ungültig"
    (KEIN Hint, welches Feld falsch ist).
  - 422 `OAUTH_ONLY_ACCOUNT` → Banner „Dieses Konto wurde mit Google/
    Facebook erstellt. Bitte verwenden Sie die OAuth-Buttons unten."
  - 429 `RATE_LIMITED` → Banner siehe oben.
  - OAuth-Klick → `signIn('google', …)` bzw. `signIn('facebook', …)`.
- **Error-Query-Params (von OAuth-Flow):**
  - `?error=oauth_no_email` → Banner „Mit Ihrem Facebook-Konto ist keine
    E-Mail-Adresse verknüpft. Bitte registrieren Sie sich per E-Mail."
  - `?error=oauth_unverified_conflict` → Banner „Es existiert bereits
    ein nicht-verifiziertes Konto mit dieser E-Mail-Adresse. Bitte
    verifizieren Sie es zuerst."
  - `?error=ACCOUNT_DISABLED` (Admin-Login an `/admin/login`, nicht hier
    relevant — dokumentiert für Vollständigkeit).
- **Validierung:** Email-Format, Passwort nicht leer.

### Page: Passwort vergessen (route: `/konto/passwort-vergessen`)

- **Linked story:** US-IT7-05.
- **Purpose:** Reset-Link anfordern.
- **Components:**
  - `<ForgotPasswordForm />` (Client) — RHF + ZodResolver auf
    `CustomerForgotPasswordSchema` (email).
  - `<ConfirmationCard />` — wird nach Submit IMMER angezeigt
    (Email-Enumeration-Schutz).
- **Data needed:** `POST /api/customer/forgot-password`.
- **User interactions:**
  - Submit → 200 → `<ConfirmationCard />` ersetzt Form mit Text:
    „Falls diese Adresse registriert ist, erhalten Sie eine E-Mail mit
    weiteren Anweisungen. Der Link ist 1 Stunde gültig."
  - 429 → Banner.
- **Validierung:** Email-Format.

### Page: Passwort zurücksetzen (route: `/konto/passwort-zuruecksetzen?token=…`)

- **Linked story:** US-IT7-05.
- **Purpose:** Neues Passwort setzen via Token aus Reset-Mail.
- **Components:**
  - `<ResetPasswordForm />` (Client) — RHF + ZodResolver auf
    `CustomerResetPasswordSchema` (password, passwordConfirm). `token`
    kommt aus Query-Param und wird automatisch in den Body gesetzt
    (hidden field).
  - `<TokenInvalidCard />` — wird angezeigt, wenn der Server 410
    `INVALID_OR_EXPIRED_TOKEN` antwortet. Enthält Link zu
    `/konto/passwort-vergessen`.
- **Data needed:** `POST /api/customer/reset-password`.
- **User interactions:**
  - Submit → 200 → Redirect zu `/konto/login?reset=success` mit Success-
    Banner „Passwort erfolgreich geändert. Bitte melden Sie sich an."
  - 410 → `<TokenInvalidCard />` ersetzt die Form.
  - 400 → Inline-Fehler am Feld.
- **Validierung:** Passwort min. 8 Zeichen, `password === passwordConfirm`.
- **UX-Hinweis:** Wenn `?token=` fehlt oder leer ist → sofort
  `<TokenInvalidCard />` zeigen (Frontend prüft das clientseitig, ohne
  API-Call).

### Page: Email verifizieren (route: `/konto/verifizieren?token=…`)

- **Linked story:** US-IT7-01.
- **Purpose:** Klick auf Verify-Link aus Registrierungs-Mail.
- **Components:**
  - `<VerifyClient />` — Client-Component, ruft beim Mount
    `GET /api/customer/verify?token=…` auf. Zeigt Spinner, dann Erfolg
    oder Fehlerkarte.
  - `<TokenInvalidCard />` (geteilt mit Reset-Page).
- **Data needed:** `GET /api/customer/verify?token=…`.
- **User interactions:** Bei 200 → Redirect zu
  `/konto/verifizieren/erfolg`. Bei 410 → Fehlerkarte.

### Page: Email-Verifizierung erfolgreich (route: `/konto/verifizieren/erfolg`)

- **Linked story:** US-IT7-01.
- **Purpose:** Statische Erfolgsseite.
- **Components:**
  - `<SuccessCard />` mit Bärenstark-Logo, Text „Ihre E-Mail wurde
    bestätigt. Sie können sich jetzt einloggen.", Button → `/konto/login`.

### Layout-Erweiterung: `/konto/layout.tsx`

- **Linked story:** US-IT7-01.
- **Purpose:** Info-Banner für Konten ohne `emailVerified`.
- **Components:**
  - `<UnverifiedEmailBanner />` (Client) — wird angezeigt, wenn
    `useCustomerSession().emailVerified === false`. Text: „Bitte bestätigen
    Sie Ihre E-Mail-Adresse." + Button „Erneut senden" →
    `POST /api/customer/resend-verification`. Nach Klick: Banner-Text
    wechselt auf „E-Mail wurde gesendet." (lokal, kein Page-Reload).
- **Data needed:** Customer-Session aus `GET /api/customer/me`.

## Shared Components

| Komponente                 | Props                                                                | Zweck                                                                                 |
| -------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `<OAuthButtons />`         | `redirectUrl?: string`                                               | Google + Facebook Buttons. Nur sichtbar, wenn Provider aktiv (Feature-Flag-Check).   |
| `<ServerErrorBanner />`    | `code: string \| null, message?: string`                            | Mappt Fehler-Codes auf deutsche Texte (siehe Mapping unten).                          |
| `<TokenInvalidCard />`     | —                                                                    | Geteilte Card für Verify- und Reset-Token-Fehler. CTA → `/konto/passwort-vergessen`. |
| `<UnverifiedEmailBanner/>` | —                                                                    | Layout-Banner mit Resend-Button.                                                      |
| `<ConfirmationCard />`     | `title: string, body: string`                                        | Generische „Aktion ausgeführt"-Card.                                                  |

### Fehler-Code → deutsche Meldung (verbindlich)

| Code                          | Meldung                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `INVALID_CREDENTIALS`         | „E-Mail oder Passwort ungültig."                                                                     |
| `EMAIL_ALREADY_REGISTERED`    | „Diese E-Mail-Adresse ist bereits registriert."                                                      |
| `OAUTH_ONLY_ACCOUNT`          | „Dieses Konto wurde mit Google/Facebook erstellt. Bitte verwenden Sie die OAuth-Buttons."             |
| `INVALID_OR_EXPIRED_TOKEN`    | „Dieser Link ist nicht mehr gültig. Bitte fordern Sie einen neuen Link an."                          |
| `ALREADY_VERIFIED`            | „Ihre E-Mail-Adresse ist bereits bestätigt."                                                         |
| `RATE_LIMITED`                | „Zu viele Versuche. Bitte versuchen Sie es in einer Stunde erneut."                                  |
| `oauth_no_email`              | „Mit Ihrem Konto ist keine E-Mail-Adresse verknüpft. Bitte registrieren Sie sich per E-Mail."        |
| `oauth_unverified_conflict`   | „Es existiert bereits ein nicht-verifiziertes Konto mit dieser E-Mail. Bitte verifizieren Sie es zuerst." |
| `oauth_error`                 | „Bei der Anmeldung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut."                       |
| `VALIDATION_ERROR`            | wird inline am Feld angezeigt (RHF + Zod).                                                            |

## API Consumption

Alle Pfade werden via `src/lib/api-client.ts` aufgerufen. Antworten
werden gegen die Schemas aus `contracts/zod-schemas.ts` validiert.

| Endpoint                                          | Verwendet von                                  | Anmerkung                                                                |
| ------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| `POST /api/customer/register`                     | `<RegisterForm />`                             | Body `CustomerRegisterSchema`. 201 → `CustomerUserPublicSchema`.         |
| `POST /api/customer/login`                        | `<LoginForm />`                                | Body `CustomerLoginSchema`. 200 → `CustomerLoginResponseSchema`.         |
| `GET  /api/customer/verify?token=`                | `<VerifyClient />`                             | 200 → `{ ok: true }`. 410 → `<TokenInvalidCard />`.                      |
| `POST /api/customer/resend-verification`          | `<UnverifiedEmailBanner />` Resend-Button      | Auth: Customer-Session. 200 → `{ ok: true }`.                            |
| `POST /api/customer/forgot-password`              | `<ForgotPasswordForm />`                       | 200 → `<ConfirmationCard />`.                                            |
| `POST /api/customer/reset-password`               | `<ResetPasswordForm />`                        | 200 → Redirect Login. 410 → `<TokenInvalidCard />`.                      |
| `GET  /api/auth/customer/[...]` (NextAuth)        | `<OAuthButtons />` (via `signIn()`)            | unverändert seit IT5/IT6.                                                |
| `GET  /api/auth/diagnose`                         | `npm run auth:check` (CLI-Tool, nicht UI)      | Dev-only.                                                                |

Frontend ruft `/api/auth/diagnose` **nicht direkt** aus dem UI auf — es
ist ein Self-Service-Endpoint für Tom/Engineer im Browser oder via Curl.

## State Management

- Customer-Session: `useCustomerSession()` aus `src/lib/use-customer.ts`
  (bestehend). `emailVerified`-Bool steuert Layout-Banner.
- Form-State: lokal in jeder Page via React Hook Form.
- Kein neuer globaler Store. Kein Redux, kein Zustand.

## Validation Rules (Client-Side, RHF + Zod)

| Feld                | Regel                                                            | Schema                              |
| ------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| Email               | `z.string().email().toLowerCase().max(254)`                      | `customerEmailLoginSchema`          |
| Passwort            | min 8, max 200                                                   | `customerPasswordSchema`            |
| firstName/lastName  | min 1, max 120, getrimmt                                         | `CustomerRegisterSchema`            |
| phone (optional)    | `phoneOptionalSchema` (bestehend)                                | `phoneOptionalSchema`               |
| privacyAccepted     | `z.literal(true)` mit dt. Fehlertext                             | `CustomerRegisterSchema`            |
| passwordConfirm     | gleich `password`                                                | `.refine()`                         |
| token (Verify/Reset) | `z.string().min(1)`                                              | `CustomerVerifyTokenQuerySchema`    |

## Accessibility & Responsiveness

- WCAG 2.1 Level AA — Form-Labels, Focus-Outlines, Touch-Targets ≥ 44px
  (IT6 §17.8 Floor bleibt aktiv).
- Mobile-First: Forms 1-spaltig, max-width 28rem, ausreichende Vertical-
  Spacing.
- Error-Banner wird per `role="alert"` ausgezeichnet, damit Screenreader
  ihn vorlesen.
- Submit-Buttons haben ein `disabled`-State während des Requests +
  Spinner-Icon (kein Doppel-Submit).
- Mehrsprachigkeit: Deutsch only (IT7 keine i18n).

## Story Coverage (Frontend)

| Story        | Frontend Deliverable                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-IT7-01    | `/konto/registrieren` (neue Page), `/konto/login` (Credentials-Form ergänzt), `/konto/verifizieren(/erfolg)` (neue Pages), `<UnverifiedEmailBanner />` (Layout-Banner) |
| US-IT7-02    | `/konto/login` Google-Button-Verhalten, deutsche Fehlermeldung bei `?error=` Query-Params                                                              |
| US-IT7-03    | `/konto/login` Facebook-Button-Verhalten, gleiche Fehlerbanner-Logik                                                                                  |
| US-IT7-04    | (kein Frontend) — CLI-Skript, dokumentiert in `scripts/README.md`                                                                                      |
| US-IT7-05    | `/konto/passwort-vergessen` (neue Page), `/konto/passwort-zuruecksetzen` (neue Page), `<TokenInvalidCard />` (geteilt), Success-Banner auf `/konto/login` |

## File Inventory (Frontend)

Neue Dateien:

```
src/app/konto/registrieren/page.tsx              (NEU — IT6 hatte hier nur Redirect)
src/app/konto/passwort-vergessen/page.tsx        (NEU)
src/app/konto/passwort-zuruecksetzen/page.tsx    (NEU)
src/app/konto/verifizieren/page.tsx              (NEU)
src/app/konto/verifizieren/erfolg/page.tsx       (NEU)
src/components/auth/RegisterForm.tsx             (NEU — Client)
src/components/auth/LoginForm.tsx                (UPDATE — Credentials-Form ergänzt)
src/components/auth/ForgotPasswordForm.tsx       (NEU — Client)
src/components/auth/ResetPasswordForm.tsx        (NEU — Client)
src/components/auth/VerifyClient.tsx             (NEU — Client)
src/components/auth/UnverifiedEmailBanner.tsx    (NEU — Client)
src/components/auth/TokenInvalidCard.tsx         (NEU — Server-Component)
src/components/auth/ServerErrorBanner.tsx        (NEU — Server-Component)
src/components/auth/OAuthButtons.tsx             (UPDATE — kein Code-Bruch, ggf. nur Refactor)
```

Updates:

```
src/app/konto/layout.tsx                         (UPDATE — Banner einbauen)
src/lib/api-client.ts                            (UPDATE — neue Endpoints typisiert)
```
