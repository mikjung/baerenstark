# Frontend Requirements — Iteration 4

## Overview

Iteration 4 erweitert das bestehende Next.js-Frontend (Bestand IT1–IT3) um drei
zusammenhängende Subsysteme:

1. **Kundenportal** unter `/konto/*` — Registrierung, Login, Auftragsübersicht,
   Stornierung (US-25, US-26, US-27).
2. **Stripe-Zahlung** unter `/konto/zahlung/:bookingId` — Kunde bezahlt per
   Karte / PayPal / Apple Pay / Google Pay über Stripe Checkout (US-28).
3. **Bewertungen** als echtes Backend-gestütztes Feature — Kunde gibt nach
   Auftragsabschluss eine Bewertung ab, Tom moderiert in `/admin/reviews`,
   freigegebene Reviews ersetzen die statische Liste auf der Startseite (US-29).

Das Frontend bleibt mobile-first, deutschsprachig, im bestehenden Braun-/Beige-/
Holz-Farbschema.

## Tech Stack

Bestand (unverändert):

- **Framework:** Next.js 14 (App Router) + TypeScript
- **State:** React useState + Server-Components wo möglich; kein globaler Store
  (kleines App-Volumen). Customer-Session wird via Server-Component gelesen
  (`/konto/layout.tsx` ruft `GET /api/customer/me`) und per Props an Children
  durchgereicht; Client-Components nutzen einen schmalen Hook
  (`useCustomerSession()`) mit SWR-ähnlichem Caching.
- **Styling:** Tailwind CSS mit `baerenstark`-Farbtokens.
- **Routing:** Next.js App Router (Dateibasiert).
- **Forms:** React Hook Form + Zod-Resolver (`contracts/zod-schemas.ts`).
- **Build-Tool:** Next.js eigene Pipeline (Vercel deploy).
- **HTTP-Client:** Native `fetch()` über `src/lib/api-client.ts` (Wrapper).

Neu Iteration 4:

- **Stripe-Integration:** Frontend führt einen Redirect auf eine Stripe-
  Checkout-Hosted-Page aus. Kein Stripe.js / Stripe Elements im MVP — vollständig
  serverseitig orchestriert. Frontend bekommt nur die `url` aus
  `POST /api/payments/create-session` und macht `window.location = url`.

## Pages / Screens

### Kundenportal (US-25, US-26, US-27, US-29)

#### `/konto/registrieren`
- **Linked story:** US-25 AC1
- **Purpose:** Neues Kundenkonto anlegen.
- **Components:** `<RegisterForm>` (RHF + `CustomerRegisterSchema`), `<CustomerHeaderMenu>`.
- **Data needed:** `POST /api/customer/register`.
- **User interactions:** E-Mail, Passwort (mind. 8 Zeichen), Vorname, Nachname,
  optional Telefon, DSGVO-Checkbox. Submit zeigt Bestätigung "Bitte bestätigen
  Sie Ihre E-Mail-Adresse" + Spam-Hinweis.

#### `/konto/login`
- **Linked story:** US-25 AC3, AC4
- **Purpose:** Eingeloggter Zugang zum Portal.
- **Components:** `<LoginForm>`, "Passwort vergessen"-Link, "Konto erstellen"-Link.
- **Data needed:** `POST /api/customer/login`.
- **User interactions:** E-Mail + Passwort. Bei `EMAIL_NOT_VERIFIED` wird ein
  "Bestätigungs-E-Mail erneut senden"-Button angezeigt
  (`POST /api/customer/resend-verification`).

#### `/konto/passwort-vergessen`
- **Linked story:** US-25 AC5
- **Purpose:** Reset-Mail anfordern.
- **Components:** `<ForgotPasswordForm>`.
- **Data needed:** `POST /api/customer/forgot-password`.
- **User interactions:** E-Mail-Eingabe → Bestätigung "Falls die E-Mail
  registriert ist, haben wir Ihnen einen Link gesendet."

#### `/konto/passwort-zuruecksetzen?token=...`
- **Linked story:** US-25 AC6
- **Purpose:** Neues Passwort setzen.
- **Components:** `<ResetPasswordForm>`.
- **Data needed:** `POST /api/customer/reset-password`.
- **User interactions:** Neues Passwort + Bestätigung. Bei Token ungültig:
  Banner "Link nicht mehr gültig" + Link zu `/konto/passwort-vergessen`.

#### `/konto/verifizieren?token=...`
- **Linked story:** US-25 AC2
- **Purpose:** E-Mail-Verifikation einlösen.
- **Components:** Server-Component, ruft `GET /api/customer/verify?token=...`.
- **Data needed:** `GET /api/customer/verify?token=...` (gibt 302 Redirect zurück).
- **User interactions:** Keine (Auto-Verarbeitung beim Laden). Bei Erfolg:
  Auto-Login + Redirect auf `/konto?verified=1`. Bei Fehler: Redirect auf
  `/konto/login?error=invalid_token`.

#### `/konto` (Auftragsübersicht)
- **Linked story:** US-26 AC1, AC2, AC5
- **Purpose:** Liste aller Aufträge des eingeloggten Kunden.
- **Components:** `<CustomerBookingsList>` mit zwei Sektionen "Bevorstehende
  Termine" und "Vergangene Aufträge", Status-Badge-Komponente, Empty-State
  mit CTA-Button.
- **Data needed:** `GET /api/customer/bookings` (Server-Component fetched).
- **User interactions:** Klick auf Eintrag → Navigation zu
  `/konto/auftrag/:id`. Klick auf "Ersten Auftrag buchen" (Empty-State) →
  `/buchung`.

#### `/konto/auftrag/[id]` (Auftragsdetail)
- **Linked story:** US-26 AC4, US-27, US-28 AC8, US-29 AC1, AC2, AC4, AC5
- **Purpose:** Einzelner Auftrag mit allen Details, Aktionen (Stornieren,
  Bezahlen, Bewerten).
- **Components:** `<BookingDetailCard>`, `<BookingAttachmentList>` (IT3
  wiederverwendet), `<CancelBookingButton>`, `<StripeCheckoutButton>`
  (sichtbar wenn `payment.status === 'PENDING'`), `<ReviewForm>` (sichtbar
  wenn `canReview`).
- **Data needed:** `GET /api/customer/bookings/:id`.
- **User interactions:**
  - **Stornieren** → Confirm-Dialog → `POST /api/customer/bookings/:id/cancel`.
    Bei `< 24h` ist Button disabled mit Tooltip "Stornierung nur bis 24h
    vor Termin möglich. Bitte rufen Sie uns an: 0157-74787512."
  - **Bezahlen** → `POST /api/payments/create-session` → `window.location = url`.
  - **Bewerten** (nur wenn Status COMPLETED + keine Review) → Sterne-Picker
    + Textarea (max 500 Zeichen, Zeichenzähler) → `POST /api/customer/reviews`.
    Erfolg: Form schreibgeschützt, Bestätigung "Vielen Dank! Sie wird nach
    Freigabe veröffentlicht."

#### `/konto/profil`
- **Linked story:** US-25 AC10
- **Purpose:** Profil-Daten ändern.
- **Components:** `<ProfileForm>` mit Vorname, Nachname, Telefon, E-Mail.
- **Data needed:** `GET /api/customer/me` + `PATCH /api/customer/me`.
- **User interactions:** Felder ändern → Speichern → Toast. Bei E-Mail-
  Änderung Hinweis "Wir haben Ihnen einen Bestätigungs-Link an die neue
  Adresse geschickt. Ihre alte Adresse bleibt aktiv, bis Sie bestätigt haben."

### Stripe-Zahlung (US-28)

#### `/konto/zahlung/[bookingId]`
- **Linked story:** US-28 AC2, AC3, AC4, AC5, AC6, AC7
- **Purpose:** Kunde löst Stripe-Checkout aus.
- **Auth-Modi:**
  - Eingeloggter Kunde (Cookie).
  - Anonym mit `?token=<cancelToken>` aus E-Mail-Link.
- **Components:**
  - `<PaymentSummaryCard>` — Auftragsdetails + Betrag (formatiert in Euro).
  - `<StripeCheckoutButton>` — einzelner Button "Bezahlen mit
    Karte / PayPal / Apple Pay / Google Pay" (Stripe rendert die Wallet-Buttons
    auf der Stripe-Page selbst, deshalb ein einziger Button hier).
- **Data needed:** `GET /api/customer/bookings/:id` (für Detail-Anzeige) +
  `POST /api/payments/create-session` (beim Klick).
- **User interactions:** Klick → `window.location = stripeSessionUrl`.
  - Wenn `payment.status === 'PAID'`: Banner "Diese Buchung wurde bereits
    bezahlt am ..." statt Button.
  - Wenn `payment.status === 'FAILED'`: Banner "Letzter Versuch
    fehlgeschlagen — bitte erneut" + Button zum Neustart.

#### `/konto/zahlung/erfolg?session_id=...`
- **Linked story:** US-28 AC6
- **Purpose:** Redirect-Ziel von Stripe nach erfolgreicher Zahlung.
- **Components:** `<PaymentSuccess>` mit Polling.
- **Data needed:** Polling auf `GET /api/customer/bookings/:bookingId`
  (bookingId aus Stripe-Session-Metadata oder Server-side aus `session_id`),
  bis `payment.status === 'PAID'` oder Timeout 10s.
- **User interactions:** Auto-Redirect nach Erfolg auf
  `/konto/auftrag/:bookingId`.

### Admin-Bereich (US-28, US-29)

#### `/admin/bookings` (erweitert)
- **Linked story:** US-28 AC1, US-29 (COMPLETED-Übergang)
- **Purpose:** Bestehende Booking-Tabelle bekommt neue Aktionen.
- **Components (erweitert):**
  - `<PaymentEditor>` — Modal: Betrag in Euro eingeben (Anzeige; intern
    in Cents umgerechnet via `Math.round(eur * 100)`), optional
    Beschreibung. → `POST /api/admin/bookings/:id/payment`.
  - "Termin abschließen"-Button für CONFIRMED-Bookings → `PATCH
    /api/bookings/:id { status: 'COMPLETED' }`.
- **Data needed:** Bestehender Endpunkt `GET /api/bookings` liefert
  jetzt zusätzlich `payment` und `customerId` (siehe
  `BookingAdminSchema`).

#### `/admin/reviews` (NEU)
- **Linked story:** US-29 AC6, AC7
- **Purpose:** Bewertungs-Moderation.
- **Components:** `<ReviewModerationTable>` mit Tabs "Wartend" /
  "Veröffentlicht" / "Alle". Pro Eintrag: Sterne, Text, Kunde, Service,
  Datum, "Freigeben"/"Zurückziehen"-Button mit Confirm-Dialog.
- **Data needed:** `GET /api/admin/reviews` + `PATCH /api/admin/reviews/:id`.
- **User interactions:** Approve/Reject → Modal → API-Call → Liste neu laden.

### Startseite (umgebaut)

#### `/` (`<ReviewSection>` umgebaut, US-29 AC8)
- **Linked story:** US-29 AC8
- **Purpose:** Echte Bewertungen ersetzen statische Daten, sobald
  ≥ 4 freigegebene Reviews vorliegen.
- **Components (geändert):** `<ReviewSection>` — fetched
  `GET /api/reviews` zur Build-Time / Page-Load. Wenn `total >= 4`,
  rendert echte Daten; sonst fallback auf `lib/reviews.ts` (IT3-Bestand).
- **Data needed:** `GET /api/reviews` (Server-Component).

## Shared Components

| Komponente                                 | Props                                        | Verwendung                                              |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------- |
| `<CustomerHeaderMenu>`                     | `{ user: CustomerUserPublic \| null }`        | Im `/konto/*`-Layout. Zeigt Login/Logout, Name, Profil. |
| `<StatusBadge>`                            | `{ status: BookingStatus, paid?: boolean }`   | Mapping auf DE-Labels: "Offen", "Bestätigt", etc. + zusätzlicher "Bezahlt"-Badge. |
| `<StarRating>`                             | `{ value: 1..5, readonly?: boolean, onChange? }` | Im ReviewForm + ReviewSection.                       |
| `<CancelBookingButton>`                    | `{ booking: CustomerBooking, onCancelled }`   | Confirm-Dialog + API-Call.                              |
| `<StripeCheckoutButton>`                   | `{ bookingId, cancelToken? }`                 | `POST create-session` → Redirect.                       |
| `<ReviewForm>`                             | `{ bookingId, onSubmitted }`                  | Sterne + Textarea + Submit.                             |
| `<PaymentEditor>` (Admin)                  | `{ booking: BookingAdmin, onSaved }`          | Modal mit Euro-Eingabe.                                  |
| `<ReviewModerationTable>` (Admin)          | `{ reviews: Review[], onApprove, onReject }`  | Tabelle.                                                 |

## API Consumption

Alle neuen Endpunkte (siehe `contracts/api-routes.md` §11–§14):

### Kunden-Auth (US-25)
- `POST /api/customer/register` — Registrierung.
- `POST /api/customer/login` — Login → Cookie.
- `POST /api/customer/logout` — Logout.
- `GET  /api/customer/me` — Profil-Lookup.
- `PATCH /api/customer/me` — Profil-Update.
- `GET  /api/customer/verify?token=...` — Verifikation (über Browser-Klick).
- `POST /api/customer/resend-verification` — Mail neu senden.
- `POST /api/customer/forgot-password` — Reset-Mail anfordern.
- `POST /api/customer/reset-password` — neues Passwort setzen.

### Kundenportal-Buchungen (US-26, US-27)
- `GET  /api/customer/bookings` — `{ upcoming: [], past: [] }`.
- `GET  /api/customer/bookings/:id` — Detail.
- `POST /api/customer/bookings/:id/cancel` — Stornierung mit 24h-Frist-Check.

### Zahlung (US-28)
- `POST /api/admin/bookings/:id/payment` (Admin) — Betrag hinterlegen.
- `DELETE /api/admin/bookings/:id/payment` (Admin) — PENDING-Payment löschen.
- `POST /api/payments/create-session` — Stripe-URL holen.
- (`POST /api/payments/webhook` — kein Frontend-Aufrufer.)

### Reviews (US-29)
- `POST /api/customer/reviews` — Review abgeben.
- `GET  /api/reviews` — öffentliche Liste (mit `average` + `total`).
- `GET  /api/admin/reviews` (Admin) — Moderations-Liste.
- `PATCH /api/admin/reviews/:id` (Admin) — Approve/Reject.

### Booking-Erweiterung
- `POST /api/bookings` — Body unverändert, aber wenn `customer-session`
  Cookie vorhanden ist, wird `customerId` automatisch befüllt (kein
  Frontend-Aufwand nötig).
- `PATCH /api/bookings/:id` (Admin) — `status: 'COMPLETED'` neu erlaubt.

## State Management

- **Customer-Session:** Server-Component liest beim `/konto/*`-Page-Load
  via `GET /api/customer/me`. Wird per Props an Children durchgereicht.
  Client-Components, die die Session brauchen (z.B.
  `<CustomerHeaderMenu>`), erhalten sie als Prop oder über einen
  schlanken Context-Provider im Layout.
- **Bookings-Liste:** Server-Component fetched. Bei Storno-Aktion:
  Client-Komponente macht den API-Call und triggert ein Re-Validate via
  `router.refresh()`.
- **Review-Form:** Lokaler React-State (Stars, Text). Submit-Button
  während laufendem Request disabled.
- **Stripe-Checkout:** Stateless im Frontend — `window.location` springt
  weg, Rückkehr über `/konto/zahlung/erfolg`.

## Validation Rules

Vollständig in `contracts/zod-schemas.ts` (re-export aus `src/lib/schemas.ts`).
Wichtige Frontend-Regeln:

- **Registrierung:** E-Mail-Format, Passwort ≥ 8 Zeichen, Vor-/Nachname
  jeweils ≥ 1 Zeichen, DSGVO-Checkbox erforderlich.
- **Login:** E-Mail + Passwort nicht leer.
- **Passwort-Reset:** beide Passwort-Felder müssen identisch sein,
  ≥ 8 Zeichen.
- **Profil-Update:** wie Registrierung, alle Felder optional außer
  bei E-Mail-Änderung (Backend-Validierung).
- **Review:** stars 1..5 Pflicht. Text optional, max 500 Zeichen
  (Zeichenzähler sichtbar).
- **Stornierung (Frontend-Check):** wenn Booking `isCancellable === false`,
  Button disabled. Bei Klick trotzdem (z.B. via Devtools) gibt das
  Backend 409 zurück; Frontend zeigt Toast.
- **Payment-Editor (Admin):** Betrag in Euro Eingabe, Frontend rechnet
  in Cents um (`Math.round(parseFloat(input) * 100)`). Min 1.00 €,
  Max 10.000,00 €. Inline-Validierung vor Submit.

## Accessibility & Responsiveness

- **WCAG-Target:** AA (Bestand IT1).
- **Breakpoints:** Mobile-first (Tailwind-Defaults).
- **Forms:** Alle Inputs haben sichtbare Labels (nicht nur Placeholder).
  Errors als `<p role="alert">` mit `aria-describedby`.
- **Star-Rating:** Tastatur-bedienbar (Pfeil-Tasten ändern Sterne; Enter
  bestätigt). Screenreader-Label "Bewertung 4 von 5 Sternen".
- **Modal/Dialogs:** Focus-Trap, Escape schließt, Hintergrund-Klick
  schließt (außer bei Eingabe-Modal — dort nur X-Button).
- **Stripe-Redirect:** vor `window.location` Toast "Sie werden zur
  sicheren Bezahlseite weitergeleitet..." anzeigen.
- **Polling auf `/konto/zahlung/erfolg`:** ARIA-Live-Region "Wir
  verarbeiten Ihre Zahlung...".
- **Touch-Targets:** alle Buttons ≥ 44×44px.

## Story Coverage

| Story | Frontend Deliverable                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-25 | `/konto/registrieren`, `/konto/login`, `/konto/passwort-vergessen`, `/konto/passwort-zuruecksetzen`, `/konto/verifizieren`, `/konto/profil`, `<CustomerHeaderMenu>`, Middleware-Redirect bei `/konto/*`. |
| US-26 | `/konto`-Page mit `<CustomerBookingsList>` (upcoming/past Split, Status-Badge, Empty-State mit CTA), `/konto/auftrag/:id` mit `<BookingDetailCard>`. |
| US-27 | `<CancelBookingButton>` (Confirm-Dialog, Disabled-State mit Hinweistext bei < 24h, sichtbar nur wenn `isCancellable === true`).                       |
| US-28 | `/konto/zahlung/:bookingId` mit `<StripeCheckoutButton>`, `<PaymentSummaryCard>`, `/konto/zahlung/erfolg`-Page mit Polling, "Bezahlt"-Badge in `<BookingDetailCard>` und `<CustomerBookingsList>`. Admin: `<PaymentEditor>`-Modal in `/admin/bookings`. |
| US-29 | `<ReviewForm>` in `/konto/auftrag/:id` (sichtbar wenn `canReview`), Read-only-Anzeige bei bestehender Review, `<ReviewSection>` umgebaut auf `GET /api/reviews`-Aufruf, `/admin/reviews` mit `<ReviewModerationTable>`. |
