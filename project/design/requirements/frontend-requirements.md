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

---

# Frontend Requirements — Iteration 10 (Bug-Triage & Customer-Self-Service)

> **Quelle der Wahrheit:** `ARCHITECTURE_IT10.md`. Vertrags-Schemas:
> `contracts/api-routes.md` §24, `contracts/zod-schemas.ts` (unverändert).
> Diese Datei ist **Hauptinput für den UX-Designer**.

## Overview

Iteration 10 enthält drei Bug-Fixes (zwei davon ohne FE-Touchpoint) und
zwei FE-getriebene Features:

1. **US-IT10-04 Quick-Booking-Modal:** Klick auf Slot im Kalender öffnet
   ein Modal mit dem vollständigen Buchungsformular — kein Seitenwechsel.
2. **US-IT10-05 Customer-Self-Service:** eingeloggte Kunden sehen alle
   eigenen Anfragen mit Status; Buchungsformular wird mit Profildaten
   vorausgefüllt (Name, Email, Telefon, Adresse).

Bug-Stories US-IT10-01/02/03 sind fast vollständig backend-/konfig-seitig;
das FE muss lediglich verifizieren, dass die bestehenden Seiten
(`/konto/passwort-vergessen`, `/admin/users`, `/buchung`) den behobenen
Endpoints korrekt vertrauen — keine UI-Änderung nötig.

## Tech Stack (unverändert)

- Next.js 14 App Router · React Server Components + Client Components
- Tailwind CSS · React Hook Form · Zod
- Native `<dialog>`-Element ODER bestehendes Headless-UI-Pattern für Modal
  (Entscheidung trifft UX-Designer / Engineer).

## Story Coverage (Iteration 10)

| Story        | Frontend-Deliverable                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-IT10-01   | Keine UI-Änderung. Bestehende Pages `/konto/passwort-vergessen` und `/konto/passwort-zuruecksetzen` profitieren vom Backend-Konfig-Fix.            |
| US-IT10-02   | Keine UI-Änderung. Bestehende Page `/admin/users` profitiert vom Backend-Migrations-Fix.                                                            |
| US-IT10-03   | Keine UI-Änderung. Bestehende Page `/buchung` profitiert vom Backend-Migrations-Fix.                                                                |
| US-IT10-04   | Neue Modal-Komponente `<QuickBookingModal />`; Update an `BookingCalendar` + `/buchung`-Page (State-Lifting für Modal-Open).                        |
| US-IT10-05   | Page-Update `/konto` (Status-Badges-Mapping, Empty-State); Page-Update `/buchung` (SSR-Profil-Pre-Fill); ggf. neue Detail-Page `/konto/anfragen/[id]`. |

## Pages / Screens

### `/buchung` (UPDATE — Quick-Booking-Modal + Profil-Pre-Fill)

- **Linked Stories:** US-IT10-04, US-IT10-05 (Teil B)
- **Purpose:** Anonymer Gast oder eingeloggter Kunde stellt eine Buchungsanfrage.
- **Komponenten:**
  - `BookingCalendar` (UPDATE — Click-Handler ruft Parent-State-Setter, der das Modal öffnet)
  - `QuickBookingModal` (NEU — Wrapper um `BookingForm`)
  - `BookingForm` (UPDATE — `defaultValues`-Prop um `customerName/Email/Phone` erweitert; Adressfelder vorhanden)
  - `ProfileAddressHint` (NEU — Hinweis-Banner "Adresse in Ihrem Profil hinterlegen" mit Link zu `/konto/profil`)
- **Server-Side-Logik (Page Server-Component):**
  - Liest `customer-session` via `getCustomerFromRequest()`.
  - Falls eingeloggt: lädt Profil aus DB (oder via `/api/customer/me`-äquivalentem Server-Lookup) und reicht Felder als `defaultValues` an Modal/Form.
  - Falls nicht eingeloggt: `defaultValues = {}`, Form bleibt leer.
- **API-Konsumierungen (alle unverändert):**
  - `GET /api/availability/calendar` — Kalender-Tagesstatus.
  - `GET /api/slots/available?date=YYYY-MM-DD` — Slot-Liste pro Tag.
  - `POST /api/bookings` — Buchungs-Anlage.
  - `POST /api/upload` — Datei-Anhänge.
- **User-Interactions:**
  - Klick auf verfügbaren Slot im Kalender → `onSelectTimeSlot(slot)` setzt Parent-State `selectedTimeSlot` und `isQuickBookingOpen=true` → Modal öffnet sich. **Wichtig (STRUCT-4):** Modal-Trigger hat KEINE Vorbedingung „Service muss gewählt sein" — der Service wird im Modal selbst ausgewählt.
  - Im Modal: Service auswählen (Pflichtfeld, kein Default — siehe „Service-Auswahl im Modal" unten), Pflichtfelder ausfüllen (Profilfelder bereits gefüllt bei eingeloggtem Kunden), „Anfrage absenden".
  - Erfolg: Modal schließt, Erfolgs-Toast/Inline-Banner auf der Buchungs-Seite. **Kein Seitenwechsel** zu `/buchung/bestaetigt`.
  - Schließen ohne Submit (Escape, Backdrop-Klick, Close-Button): Modal schließt, Form-Werte bleiben erhalten (Modal bleibt gemountet, `display:none`-Variante).
  - Validation-Fehler: Inline am Feld, Modal bleibt offen.
  - **409 mit `error.subcode === 'BOOKING_SLOT_TAKEN'`** (Slot inzwischen weg): Banner im Modal „Dieser Termin wurde inzwischen leider von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot." — Modal bleibt offen, Submit-Label wechselt zu „Anderen Slot wählen", Klick schließt Modal und Fokus geht zurück zum Slot-Picker. Form-State bleibt erhalten. Defensiver Fallback: bei fehlendem `subcode` wird `code === 'CONFLICT' && field === 'date'` wie `BOOKING_SLOT_TAKEN` behandelt. Andere 409 (Tag inaktiv) → generische Konflikt-Microcopy.

#### Service-Auswahl im Modal (STRUCT-4-Fix, verbindlich)

- **Service ist Pflichtfeld im Modal-Form**, nicht Voraussetzung für den Modal-Trigger.
- **Default-Service:** keiner. Wenn die Page-State einen `serviceSlug` hält (z. B. via URL-Param `?service=…` oder vorheriger ServiceGrid-Klick), wird er als Default ins Modal vorausgewählt; sonst startet das Service-Feld leer.
- UI: Radio-Group oder Select mit allen `SERVICES`-Slugs (`reinigung`, `entruempelung`, `gartenpflege`, `hausmeister`, `umzugshilfe`, `sonstiges`). Genaue Position im Field-Order entscheidet UX-Designer in `ux-spec-iteration-10.md` §5.6.
- Validation: leerer Service vor Submit → Inline-Fehler „Bitte wählen Sie einen Service." + Banner oben „Bitte prüfen Sie die markierten Felder." Submit bleibt blockiert.
- Submit-Body an `POST /api/bookings`: `service` (Pflicht, der gewählte Slug). Backend-Validation greift wie bisher.

### `/konto` (UPDATE — Anfragen-Übersicht refinement)

- **Linked Story:** US-IT10-05 (Teil A)
- **Purpose:** Eingeloggter Kunde sieht alle eigenen Anfragen mit Status.
- **Komponenten:**
  - `CustomerBookingCard` (Bestand — UPDATE: Status-Badge-Mapping prüfen)
  - `EmptyState` (NEU oder Refinement) — „Sie haben noch keine Anfragen" + CTA-Button "Jetzt erste Anfrage stellen" (Link `/buchung`)
- **API-Konsumierungen (unverändert):**
  - `GET /api/customer/bookings` — `{ upcoming, past }` mit kompletten Booking-Details.
- **Status-Badge-Mapping (deutsch):**

  | BookingStatus       | Badge-Text                  | Farbe (Hinweis für UX)               |
  | ------------------- | --------------------------- | ------------------------------------ |
  | `PENDING`           | „Offen"                     | Neutral / Bärenstark-Wood            |
  | `CONFIRMED`         | „Bestätigt"                 | Erfolg / Grün                        |
  | `REJECTED`          | „Abgelehnt"                 | Fehler / Rot                         |
  | `COUNTER_PROPOSED`  | „Gegenvorschlag ausstehend" | Warnung / Orange                     |
  | `CANCELLED`         | „Storniert"                 | Neutral / Grau                       |
  | `COMPLETED`         | „Abgeschlossen"             | Info / Bärenstark-Bark               |

  Genaue Farb-Tokens in `tailwind.config.ts`. UX-Designer entscheidet im Detail.
- **User-Interactions:**
  - Liste anzeigen (sortiert: `upcoming` zuerst, dann `past`).
  - Klick auf Eintrag → Detailseite `/konto/anfragen/:id`.
  - Empty-State wenn `upcoming.length === 0 && past.length === 0`.

### `/konto/anfragen/[id]` (NEU/PRÜFEN — Anfragen-Detailseite)

- **Linked Story:** US-IT10-05 (Teil A) AC3
- **Purpose:** Detailansicht einer einzelnen Anfrage.
- **Hinweis:** Engineer prüft, ob diese Page bereits aus IT4 (US-26) existiert. Falls ja, AC3 nur auf Vollständigkeit verifizieren. Falls nein, neu anlegen.
- **API-Konsumierung (unverändert):**
  - `GET /api/customer/bookings/:id` — komplette Booking-Details.
- **Pflichtfelder in der UI:**
  - Datum (`date`)
  - Uhrzeit (`startTime` – `endTime`)
  - Service (Label aus `SERVICE_LABELS[service]`)
  - Beschreibung
  - Adresse (Straße + PLZ + Ort)
  - Status-Badge (gleiches Mapping wie in `/konto`)
  - Liste hochgeladener Dateien (Filename + Download-Link)
  - Falls vorhanden: Bewertung (Sternen + Text + Approval-Status)
  - Falls vorhanden: Zahlung (Betrag + Status + Pay-Link für PENDING)
- **Optionale Aktionen (wenn Backend liefert):**
  - „Anfrage stornieren" (wenn `isCancellable === true`) — **gilt in IT10 nur für `PENDING`-Buchungen** (bestehende IT4-Storno-Logik). Storno für `CONFIRMED`/`COUNTER_PROPOSED`-Buchungen ist **out-of-scope IT10** (PM-3, Backlog IT11+).
  - „Bewertung abgeben" (wenn `canReview === true`).

### `/admin/users`, `/konto/passwort-vergessen`, `/konto/passwort-zuruecksetzen`

**Keine UI-Änderung in IT10.** Diese Pages werden durch die Backend-Bug-Fixes (Konfig + Migrations-Drift) wieder funktionsfähig. FE-Code bleibt unverändert.

## Komponenten — Detail-Spec

### `<QuickBookingModal />` (NEU)

- **Props (final, nach STRUCT-4-Fix):**

  | Prop                    | Typ                              | Pflicht | Beschreibung                                                          |
  | ----------------------- | -------------------------------- | ------- | --------------------------------------------------------------------- |
  | `isOpen`                | `boolean`                        | ja      | Steuert die Sichtbarkeit. Modal bleibt gemountet (Datenverlust-Schutz). |
  | `onClose`               | `() => void`                     | ja      | Wird bei Escape, Backdrop-Klick, Close-Button gerufen.                  |
  | `selectedTimeSlot`      | `TimeSlotInfo \| null`           | ja      | Vom Kalender vorausgewählter Slot (Datum + Start/End + Dauer).          |
  | `defaultService`        | `ServiceSlug \| null`            | nein    | **NEU.** Optional vorausgewählter Service (aus Page-State / URL-Param `?service=…`); kein Default, wenn nicht gesetzt. Service ist Pflichtfeld im Modal selbst — siehe „Service-Auswahl im Modal". |
  | `defaultValues`         | `Partial<BookingFormInput>`      | nein    | Pre-Fill aus Profil (US-IT10-05 Teil B).                                |
  | `onSubmitted`           | `() => void`                     | ja      | Wird nach erfolgreichem Submit aufgerufen — Parent zeigt Erfolgs-Banner und schließt das Modal. |

  Hinweis: Ein früher in der Component-Library angedachter Pflicht-Prop `service` entfällt mit STRUCT-4 — er wird ersetzt durch `defaultService` (optional). Die endgültige Service-Auswahl steckt im Form-State des Modals.

- **Verhalten:**
  - Rendert `BookingForm` als Inhalt.
  - Tab-Trap, Focus-Restore beim Schließen.
  - Auf Mobile: Vollflächig oder Bottom-Sheet (UX-Designer entscheidet).
  - WAI-ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` zeigt auf Modal-Headline.
- **Conformance:** WCAG 2.1 AA — Focus-Outline sichtbar, Touch-Targets >= 44 px, Color-Contrast >= 4.5:1.

### `<BookingForm />` (UPDATE)

- **Bestehende Props bleiben.**
- **Änderung:** `defaultValues`-Mechanik so erweitern, dass auch `customerName`, `customerEmail`, `customerPhone` aus dem Parent gesetzt werden können (heute gibt es bereits einen `profileAddress`-Prop für die drei Adressfelder — siehe `BookingForm.tsx` Z. 134–145).
- **Empfohlene Strategie:** neuer Prop `customerProfile?: { name: string; email: string; phone: string | null; }` ODER Erweiterung des bestehenden `profileAddress`-Props zu einem allgemeineren `customerProfileDefaults`-Prop. Engineer entscheidet.
- **Wichtig:** RHF `defaultValues` werden bei Mount gesetzt; beim Re-Mount müssen sie aus aktualisiertem Prop kommen. `useEffect`+`reset()` ist der RHF-konforme Weg.

### `<ProfileAddressHint />` (NEU)

- **Props:**

  | Prop      | Typ       | Pflicht | Beschreibung                                          |
  | --------- | --------- | ------- | ----------------------------------------------------- |
  | `visible` | `boolean` | ja      | Nur sichtbar, wenn eingeloggt UND Profil-Adresse leer. |

- **Inhalt:** Banner mit Text „Hinterlegen Sie Ihre Adresse im Profil — beim nächsten Mal ist sie schon vorausgefüllt." und Link `→ Zum Profil` (`/konto/profil` oder `/konto`, je nach bestehender Routing-Struktur).
- **Position:** Über den Adressfeldern im Form.

## API-Konsumierung (Iteration 10)

| Endpoint                                  | Stories             | Methode | Verwendung                                                              |
| ----------------------------------------- | ------------------- | ------- | ----------------------------------------------------------------------- |
| `POST /api/customer/forgot-password`      | US-IT10-01          | POST    | Bestehende `<ForgotPasswordForm />`. Body: `{ email }`. Response: `{ ok: true }`. |
| `POST /api/customer/reset-password`       | US-IT10-01          | POST    | Bestehende `<ResetPasswordForm />`. Body: `{ token, password, passwordConfirm }`. |
| `GET /api/admin/users?…`                  | US-IT10-02          | GET     | Bestehender `<UserTable />`. Response: `{ data: { items, total, page, pageSize } }`. |
| `POST /api/bookings`                      | US-IT10-03/04       | POST    | Bestehender `<BookingForm />`. Date-Mode mit `date/startTime/endTime/durationMinutes` + Adresse. |
| `GET /api/customer/bookings`              | US-IT10-05          | GET     | `/konto`-Page. Response: `{ data: { upcoming, past } }`.                |
| `GET /api/customer/bookings/:id`          | US-IT10-05          | GET     | `/konto/anfragen/:id`-Page. Response: einzelnes `CustomerBooking`-DTO.   |
| `GET /api/customer/me`                    | US-IT10-05          | GET     | Server-Side Pre-Fill auf `/buchung` (über `getCustomerFromRequest()`). Alternativ Client-Side bei Bedarf. |

**Keine neuen API-Wrapper** in `src/lib/api-client.ts` — alle Endpoints sind bereits typisiert.

## Validation Rules (Frontend)

Unverändert — `BookingFormSchema` aus `contracts/zod-schemas.ts` ist
verbindlich. Die Quick-Booking-Modal verwendet das gleiche Schema.

| Feld                | Regel                                                            |
| ------------------- | ---------------------------------------------------------------- |
| `customerName`      | `min(2)`, `max(120)`, getrimmt                                   |
| `customerPhone`     | `phoneSchema` (mind. 6 Ziffern, erlaubte Sonderzeichen)          |
| `customerEmail`     | `email`, `max(254)`, getrimmt                                    |
| `service`           | `enum SERVICES`                                                  |
| `description`       | `min(5)`, `max(2000)`. Bei `service === 'sonstiges'`: `min(20)`  |
| `addressStreet`     | `min(3)`, `max(100)`, getrimmt                                   |
| `addressZip`        | `^\d{5}$`                                                         |
| `addressCity`       | `min(2)`, `max(100)`, getrimmt                                   |
| `durationMinutes`   | Whitelist `[60,120,180,240,300,360,480]` oder `-1` (Ganztag)     |
| `privacyAccepted`   | `literal(true)`                                                   |

## Pre-Fill-Mapping (US-IT10-05 Teil B)

**Verbindliche Mapping-Tabelle Profil → Booking-Form:**

| Profil-Feld (`CustomerUser`) | Booking-Form-Feld (`BookingFormInput`) | Verhalten bei NULL                        |
| ---------------------------- | -------------------------------------- | ----------------------------------------- |
| `firstName + ' ' + lastName` | `customerName`                         | Beide Pflicht in DB → immer befüllt        |
| `email`                      | `customerEmail`                        | Pflicht in DB → immer befüllt              |
| `phone`                      | `customerPhone`                        | NULL → Feld leer, User muss eingeben       |
| `streetAndNumber`            | `addressStreet`                        | NULL → Feld leer, `<ProfileAddressHint />` einblenden |
| `postalCode`                 | `addressZip`                           | NULL → Feld leer                           |
| `city`                       | `addressCity`                          | NULL → Feld leer                           |

**User-Override:** geänderte Werte werden im Submit für **diese** Buchung verwendet; Profil bleibt unverändert. (Backend-Verhalten seit IT9 etabliert — siehe `schema.prisma` Doku zu `CustomerUser.streetAndNumber`.)

## State Management

### Globaler State

Unverändert — Customer-Session via `customer-session`-JWT-Cookie. Kein neuer globaler State in IT10.

### Per-Page State (`/buchung`)

Neu in IT10:

- `selectedTimeSlot: TimeSlotInfo | null` — Bestand, Quelle ist `BookingCalendar`.
- `isQuickBookingOpen: boolean` — NEU. Setzt Parent bei Slot-Klick auf `true`, Modal-Close ruft `setIsQuickBookingOpen(false)`.
- `customerProfile: CustomerProfileDefaults | null` — NEU. Wird in der Server-Component aus der Session gelesen und als Prop an Client-Component übergeben.

Modal-State liegt **bewusst nicht** in URL-Params (PM-2-Entscheidung: Tiefen-Verlinkung ist **out-of-scope für IT10**). Modal-State ist rein ephemerer Client-State. **Backlog (IT11+):** Tiefen-Verlinkung über `?date=…&time=…&duration=…[&service=…]` so dass Tom Termin-Links teilen kann. Kein UX-Spec-Eintrag für IT10 vorgesehen.

## Accessibility & Responsiveness

- **WCAG 2.1 Level AA** — Modal: Focus-Trap, Escape-Schließen, ARIA-Dialog-Pattern, Focus-Restore, sichtbare Focus-Outlines.
- **Mobile (`< 640px`):** Modal vollflächig oder Bottom-Sheet. Form-Felder einspaltig. Touch-Targets >= 44 px.
- **Desktop (`>= 1024px`):** Modal zentriert, max-width 32rem, Backdrop dunkel mit Blur (UX-Designer entscheidet).
- **Tablet:** Mittelweg, modal-zentriert mit max-width 28rem.
- **Reduced-Motion:** Modal-Open/Close-Transition respektiert `prefers-reduced-motion`.
- **Keyboard:** Tab-Reihenfolge folgt visueller Reihenfolge (oberster Slot-Hinweis → Form-Felder → Submit-Button → Close-Button).

## File Inventory (Frontend, Iteration 10)

Neu:

```
src/components/booking/QuickBookingModal.tsx       (NEU — Modal-Wrapper um BookingForm)
src/components/booking/ProfileAddressHint.tsx      (NEU — Hinweisbanner für fehlende Profil-Adresse)
src/app/konto/anfragen/[id]/page.tsx               (NEU oder PRÜFEN — Detail-Page falls noch nicht aus IT4)
```

Updates:

```
src/components/booking/BookingCalendar.tsx         (UPDATE — Slot-Klick triggert Modal-Open im Parent)
src/components/booking/BookingForm.tsx             (UPDATE — defaultValues für customerName/Email/Phone aus Prop)
src/app/buchung/page.tsx                           (UPDATE — Server-Side Profil-Lookup, Modal-State, Render Modal)
src/app/konto/page.tsx                             (UPDATE — Status-Badge-Mapping vollständig, Empty-State)
src/components/customer/CustomerBookingCard.tsx    (UPDATE — Status-Mapping vollständig)
```

Keine Änderung:

```
src/lib/api-client.ts                              (alle benötigten Wrapper bereits vorhanden)
contracts/zod-schemas.ts                           (keine Schema-Änderungen)
```

## Test-Plan (Frontend)

- **Modal-Smoke:**
  - M1: Slot-Klick im Kalender öffnet Modal mit korrekt vorausgefülltem Datum/Uhrzeit/Dauer — auch dann, wenn auf der Page kein Service vorausgewählt ist (STRUCT-4).
  - M2: Escape, Backdrop-Klick und Close-Button schließen das Modal ohne Datenverlust (eingegebene Felder bleiben erhalten).
  - M3: Submit im Modal mit gültigen Werten (inklusive im Modal gewähltem Service) → Modal schließt, Erfolgs-Banner sichtbar, Buchung in `/admin/bookings` sichtbar.
  - M4: Submit im Modal mit ungültigem Pflichtfeld → Inline-Fehler am Feld, Modal bleibt offen.
  - M5: Submit im Modal, Backend antwortet `409` mit `error.subcode === 'BOOKING_SLOT_TAKEN'` → Conflict-Banner mit UX-konformer Microcopy, Submit-Label wechselt zu „Anderen Slot wählen", Modal bleibt offen mit erhaltenem Form-State (STRUCT-3).
  - M6 (STRUCT-4): Modal ohne Service-Auswahl absenden → Inline-Fehler am Service-Feld „Bitte wählen Sie einen Service.", Submit blockiert, Modal bleibt offen.

- **Pre-Fill-Smoke:**
  - PF1: Eingeloggter Kunde mit vollständigem Profil öffnet `/buchung` → Form ist mit Name, Email, Telefon, Adresse vorausgefüllt.
  - PF2: Eingeloggter Kunde **ohne** Profil-Adresse öffnet `/buchung` → Adressfelder leer, `<ProfileAddressHint />` sichtbar.
  - PF3: Anonymer Gast öffnet `/buchung` → alle Felder leer, kein Hint.
  - PF4: Eingeloggter Kunde ändert vorausgefüllten Wert und sendet ab → Buchung verwendet geänderten Wert; `GET /api/customer/me` zeigt Profil unverändert.

- **Übersicht-Smoke:**
  - O1: Eingeloggter Kunde mit Buchungen öffnet `/konto` → Liste zeigt alle Status-Badges korrekt auf Deutsch.
  - O2: Eingeloggter Kunde ohne Buchungen öffnet `/konto` → Empty-State + CTA „Jetzt erste Anfrage stellen".
  - O3: Klick auf Eintrag → Detailseite zeigt alle Pflichtfelder.

- **A11y:**
  - A1: Modal ist mit Tastatur vollständig bedienbar (Tab, Shift-Tab, Escape).
  - A2: Screenreader liest Modal-Titel beim Öffnen.

## UX-Hand-off Hinweise

UX-Designer entscheidet:

1. Modal-Pattern (zentriert vs. Bottom-Sheet auf Mobile, Side-Panel-Variante auf Desktop?).
2. Status-Badge-Farb-Tokens (innerhalb der bestehenden Bärenstark-Palette).
3. Empty-State-Illustration / Icon (oder rein typografisch?).
4. Erfolgs-Feedback nach Modal-Submit (Toast vs. Inline-Banner auf der Buchungs-Seite).
5. Mobile-Behaviour des Modals — Bottom-Sheet mit Drag-to-Close-Geste oder Standard-Vollbild?
6. Position und Wording des `<ProfileAddressHint />`-Banners.
7. **Position und Pattern der Service-Auswahl im Modal** (STRUCT-4): Radio-Group oben (vor Kontaktdaten) ODER Select / nach Slot-Chips ODER zwischen Adresse und Beschreibung — UX-Designer entscheidet.
8. **Service-Chip im Modal-Header** (STRUCT-4): Wie wird der Header dargestellt, wenn kein Service vorausgewählt ist? (Empfehlung: Placeholder-Pille „Service wählen", Klick scrollt Fokus zum Service-Feld im Body.)

## Updates aus QA-Design-Review (2026-05-03, IT10)

| Defekt    | FE-Auswirkung                                                                                                       | Status in dieser Datei |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| STRUCT-3  | FE liest 409 primär über `error.subcode === 'BOOKING_SLOT_TAKEN'`, Fallback `code === 'CONFLICT' && field === 'date'`. | dokumentiert in `/buchung`-User-Interactions + Modal-Smoke M5 |
| STRUCT-4  | Service ist Pflichtfeld im Modal-Form (kein Pflicht-Trigger-Vorbedingung). `defaultService` ersetzt `service`-Prop. | dokumentiert in `<QuickBookingModal />`-Spec + neue Modal-Smoke M6 |
| PM-2      | Modal-URL-Deep-Link **out-of-scope IT10** → Backlog.                                                                 | aktualisiert im State-Management-Abschnitt |
| PM-3      | Storno bestätigter Anfragen **out-of-scope IT10** → Backlog. Detail-Page rendert keinen Storno-Button für `CONFIRMED`-Buchungen. | siehe `/konto/anfragen/[id]` Aktionen unten |
