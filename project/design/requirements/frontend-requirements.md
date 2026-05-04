# Frontend Requirements — Iteration 11 (Produktions-Stabilisierung & UX-Konsolidierung)

> **Hinweis:** Diese Datei ist die IT11-spezifische Anforderungsspez. Für IT1–IT10
> bleibt der Bestand verbindlich (siehe `ARCHITECTURE.md`, `ARCHITECTURE_IT10.md`).
> Quelle der Wahrheit für IT11: `ARCHITECTURE_IT11.md`. Schemas: `contracts/zod-schemas.ts`.
> Endpoints: `contracts/api-routes.md` (zwei neue Endpoints in IT11, siehe §API Consumption).
>
> **Revision v2 (2026-05-03):** Tom hat drei Detailentscheidungen bestätigt
> (Upload-Limits 10/50 MB, signierter Bestätigungs-Token, Routing `/buchung`),
> und es gibt eine neue Story **US-IT11-06 (Auftrag stornieren)**. Diese Datei
> wurde entsprechend ergänzt — siehe Sektionen „Pages / Storno" und „Upload-Validierung".
>
> **Revision v3 (2026-05-04, nach QA-Review IT11):**
> - Bestätigungsseite: kanonische neue Route `/buchung/bestaetigung/[bookingId]?token=…` mit neuer Komponente `BookingConfirmation`. Bestehende `BestaetigtClient.tsx` bleibt **unangetastet** für Counter-Proposal-Flow.
> - Storno-Page: kanonische Route `/buchung/[id]/stornieren?token=…` (Path-Param-ID).
> - `cancelledBy`-Enum vereinheitlicht: `'CUSTOMER' | 'ADMIN' | 'SYSTEM'`. Gast-Storno via Token = `'CUSTOMER'`. Keine Differenzierung im Admin-UI.
> - Lightbox im Admin: out-of-scope für IT11, IT12-Backlog. Klick öffnet weiterhin neuer Tab.

## Overview

IT11 ist eine **Konsolidierungs- und Bug-Fix-Iteration**. Es entstehen keine neuen
Pages, Routen oder Datenmodelle. Stattdessen wird der bestehende Buchungsweg auf
**einen primären Einstiegspunkt** (Quick-Booking-Modal) verdichtet, das vorhandene
Toast-System für Erfolgs-/Fehler-Feedback aktiviert, der existierende Datei-Upload-
Pfad im Modal ergänzt und im Admin-View ausgebaut, sowie die Pre-Fill-Logik durch
eine korrekte Prod-Konfiguration produktionsfähig gemacht.

Frontend-seitig betrifft IT11 sechs Komponenten-Bereiche:

1. **Modal-Provider + Header/Hero-Trigger** (US-IT11-02): neuer App-weiter Modal-Provider,
   Header- und Hero-CTAs öffnen das Modal direkt.
2. **Modal-Erweiterung** (US-IT11-02 + 04): das `QuickBookingModal` wird um Kalender,
   Slot-Picker und FileUpload erweitert (Standalone-Mode). Modal blockiert Escape
   während Submit (verhindert versehentlichen Datenverlust).
3. **Toast + Bestätigungsseite mit Token** (US-IT11-03): existierende Toast-Lib wird
   konsequent nach jedem Submit gerufen, Bestätigungsseite ist via signiertem JWT-Token
   reload-fest und 30 Tage gültig.
4. **Admin-Anhang-Anzeige + Upload-Validierung 10/50 MB** (US-IT11-04): `BookingTable.tsx`
   erhält Thumbnail, Dateigröße und Empty-State für Anhänge. `FileUpload`-Komponente
   validiert Bilder auf 10 MB und Videos auf 50 MB clientseitig (Server validiert ebenfalls).
5. **Stornieren — Customer + Gast** (US-IT11-06): Stornieren-Button im Kunden-Dashboard,
   Bestätigungs-Dialog vor Submit, Erfolgs-Toast, Gast-Stornierungsseite mit signiertem Token.
6. **Routing-Konsolidierung:** `/buchung` ist die kanonische Buchungs-Route. Wenn
   `/buchen` an einer Stelle existiert, wird er per `next.config.js`-Redirect auf
   `/buchung` umgeleitet (Engineer prüft).

Pre-Fill-Logik (US-IT11-05) und Buchung-end-to-end (US-IT11-01) sind **operative**
Aufgaben — kein Frontend-Code-Change nötig, der Defekt liegt in der Prod-Konfiguration.

## Tech Stack

Bestand (unverändert, identisch mit IT10):

- **Framework:** Next.js 14 (App Router) + TypeScript
- **State:** React useState + Context (neu: `BookingDialogProvider`) + RHF + `useCustomer()`-Hook
- **Styling:** Tailwind CSS mit `baerenstark`-Farbtokens
- **Forms:** React Hook Form 7.53 + Zod-Resolver
- **Toast-System:** eigenständige Lib `src/lib/toast.ts` (kein `sonner`, keine externe Dep)
- **Modal-Wrapper:** `src/components/ui/Modal.tsx` (eigenständig, Focus-Trap, ARIA-konform)
- **HTTP-Client:** `src/lib/api-client.ts`
- **Datei-Upload:** `@vercel/blob: 2.3.3` (bereits Dependency, neu: `BLOB_READ_WRITE_TOKEN` in Prod)

**Keine neuen Frontend-Dependencies in IT11.**

---

## Pages / Screens

### Page: Startseite (route: `/`) — **edit**

- **Linked stories:** US-IT11-02.
- **Purpose:** Einstiegspunkt mit Hero-CTA der das Buchungs-Modal öffnet.
- **Komponenten-Änderungen:**
  - `<Hero />` (`src/components/home/Hero.tsx`): primärer CTA „Jetzt Termin buchen"
    wird von `<Link href="/buchung">` zu `<button onClick={openBookingDialog}>`.
  - Sekundärer Tel-Link (`tel:`-Anchor) bleibt unverändert.
- **Data needed:** keine.
- **A11y:** Button hat `aria-haspopup="dialog"`, fokussierbar, gleiche Tastatur-
  Shortcuts wie ein Link.

### Page: Buchung (route: `/buchung`) — **read-only Fallback**

- **Linked stories:** US-IT11-02 (AC3, Fallback-Pfad).
- **Purpose:** SEO-fähige Fallback-Seite, direkter URL-Aufruf, JS-Off-Browser.
- **Komponenten:** unverändert (`BookingClient.tsx`, `BookingForm.tsx`, `Calendar`,
  `TimeSlotPicker`, `DurationPicker`, `FileUpload`).
- **Verhalten:** identisch zu IT10 — Slot-Klick öffnet das embedded Modal innerhalb
  der Seite.

### Page: Bestätigungsseite (route: `/buchung/bestaetigung/[bookingId]?token=<jwt>`) — **neu (v3)**

- **Linked stories:** US-IT11-03.
- **Purpose:** zeigt nach erfolgreichem Submit die Buchungsnummer + Service + Datum.
  **Neue Route + neue Komponente** (v3) — kanonische initiale-Bestätigung.
  **Reload-fest** durch signierten JWT-Token in der URL.
- **URL-Format:** `/buchung/bestaetigung/<bookingId>?token=<jwt>` — Token
  HMAC-signiert mit `BOOKING_TOKEN_SECRET`, Scope `booking-confirmation`,
  Ablauf 30 Tage. Eingebettet in der Bestätigungs-E-Mail.
  Eingeloggte Kunden: ohne Token reicht ebenfalls (Auth-Cookie via Server-Component validiert).
- **Komponenten:**
  - **NEU:** Server-Component `src/app/buchung/bestaetigung/[bookingId]/page.tsx` —
    liest Path-Param `bookingId` und Query `token`, ruft serverseitig
    `GET /api/bookings/:id/public-summary?token=<jwt>` auf. Bei 401 → rendert
    `<TokenExpiredPage flow="confirmation" />` direkt server-side.
  - **NEU:** Client-Component `BookingConfirmation` unter
    `src/app/buchung/bestaetigung/[bookingId]/BookingConfirmation.tsx` —
    rendert Buchungsnummer (gekürzte ID, erste 8 Zeichen UPPERCASE), Service-Label,
    Datum/Uhrzeit, Status-Badge, Telefonnummer als CTA, Links „Zur Startseite" und
    „Eine weitere Anfrage stellen" (öffnet Booking-Modal via `useBookingDialog`).
- **A11y:** `role="status"`, Heading-Level h1, Live-Region für Screen-Reader.
- **No-Token Edge-Case:** wenn ohne Token UND kein Auth-Cookie → 401
  vom Endpoint → Server-Component rendert `<TokenExpiredPage>` mit Login-Hinweis +
  Telefonnummer-CTA.

### Page: Counter-Proposal-Bestätigung (route: `/buchung/bestaetigt`) — **read-only (v3)**

- **Linked stories:** US-14 (Counter-Proposal-Flow, Bestand).
- **Purpose:** Bestätigungsseite des Counter-Proposal-Antwort-Flows (Tom→Kunde).
  Bleibt in IT11 **unangetastet**. URL-Params `?accepted=true` / `?status=gone` /
  `?id=…&token=…` bleiben Bestand.
- **Komponenten:** `<BestaetigtClient />` (Bestand) — KEIN Edit in IT11.

### Page: Gast-Stornierung (route: `/buchung/[id]/stornieren?token=<jwt>`) — **neu (v3, Path-Param)**

- **Linked stories:** US-IT11-06.
- **Purpose:** Gast-Storno-Flow per signiertem Token aus der Bestätigungs-E-Mail.
  Eingeloggte Kunden brauchen diese Seite nicht — sie stornieren aus `/konto`.
- **URL-Format (v3):** `/buchung/<bookingId>/stornieren?token=<jwt>` mit Scope
  `booking-cancellation` (separater Token vom Confirmation-Token). Path-Param-ID,
  RESTful, kanonisch.
- **Komponenten:**
  - Server-Component (`src/app/buchung/[id]/stornieren/page.tsx`): liest Path-Param
    `id` und Query `token`. Ruft serverseitig `verifyBookingCancellationToken()`
    aus `src/lib/booking-tokens.ts` auf. Bei Erfolg: lädt Buchungsdetails via interner
    DB-Query oder `GET /api/bookings/:id/public-summary?token=<jwt>` (der Endpoint
    akzeptiert v3 auch den `booking-cancellation`-Scope) und reicht sie an
    `<GuestCancelClient />` weiter.
  - Client-Component (`src/app/buchung/[id]/stornieren/GuestCancelClient.tsx`):
    zeigt Buchungsdetails (Service, Datum, Zeit) + `<CancelConfirmationDialog />`
    („Möchten Sie diese Anfrage wirklich stornieren?") mit „Ja, stornieren" und
    „Abbrechen". Bei „Ja": **explizit POST nach User-Klick** auf
    `POST /api/bookings/:id/cancel?token=<jwt>`. **Niemals GET** — schützt vor
    Mail-Provider-Scanner-Race (siehe ARCHITECTURE_IT11 §6.3).
  - Erfolg → Erfolgs-Page „Anfrage erfolgreich storniert. Tom wurde informiert."
    (kein Redirect, in-place Update).
  - Idempotenz-Path: wenn Server `alreadyCancelled: true` liefert, zeige
    „Diese Anfrage wurde bereits storniert."
- **Token-Expiry:** wenn Server-side Token-Verify fehlschlägt → Server-Component
  rendert direkt `<TokenExpiredPage />` (kein Roundtrip zum Client).
- **Mail-Scanner-Schutz:** Page rendert ausschließlich UI; kein Auto-Submit, kein
  GET-Trigger, kein `<a href=…/cancel>`.
- **A11y:** Modal mit `role="dialog"`, `aria-modal="true"`, Focus-Trap, Escape
  schliesst Dialog (außer während Submit).

### Token-Expired-Fallback — **inline (v3)**

- **Linked stories:** US-IT11-03 + US-IT11-06.
- **Purpose:** Hinweis-UI, wenn der Confirmation- oder Cancel-Link abgelaufen ist.
- **Implementierung:** `<TokenExpiredPage flow="confirmation" | "cancellation" />`
  wird direkt von der jeweiligen Server-Component (Bestätigungs- oder Storno-Page)
  inline gerendert, wenn der Server-side Token-Verify fehlschlägt. **Keine separate
  Route mehr.** Vereinfacht das Routing und vermeidet Redirect-Roundtrips.
- **Inhalt:** „Dieser Link ist abgelaufen. Bitte rufen Sie uns direkt an:
  0157 74787512." mit `tel:`-CTA + Link „Zur Startseite" + (optional)
  „Neue Anfrage stellen" (öffnet Booking-Modal).

### Page: Kunden-Dashboard (route: `/konto`) — **edit**

- **Linked stories:** US-IT11-06.
- **Purpose:** zeigt eingeloggten Kunden ihre Buchungen mit Stornieren-Button.
- **Komponenten-Änderungen:**
  - `<CustomerBookingsClient />` (oder Äquivalent in `src/app/konto/...`):
    pro Buchung in der Liste: wenn `b.isCancellable === true` (Server-berechnetes
    Flag aus `GET /api/customer/bookings`) und `b.status NOT IN ['CANCELLED', 'REJECTED', 'COMPLETED']`,
    zeige Stornieren-Button.
  - Klick auf Stornieren → öffnet `<CancelConfirmationDialog />` (siehe Shared
    Components unten).
  - Nach erfolgreichem Cancel: optimistic UI-Update (Status-Badge → „Storniert",
    Stornieren-Button verschwindet) + Re-Fetch der Liste + `toast.success('Auftrag
    storniert.')`.
  - Bei Fehler 409 (Frist überschritten): Toast-Error mit Hinweis „Bitte rufen Sie
    0157-74787512 an".
- **A11y:** Stornieren-Button hat `aria-label="Anfrage <Service> am <Datum> stornieren"`
  für Screen-Reader-Klarheit.

### Page: Admin-Buchungsliste (route: `/admin/bookings`) — **edit**

- **Linked stories:** US-IT11-04 (Admin-Anzeige).
- **Purpose:** Tom sieht alle Buchungen mit Anhängen.
- **Komponenten-Änderungen:**
  - `<BookingTable />` (`src/components/admin/BookingTable.tsx`): Anhang-Sektion pro
    Buchung wird ausgebaut.
  - Neu: bei `image/*`-MIME ein Thumbnail (60×60 px, `object-cover`, lazy-loaded).
  - Neu: Dateigröße in lesbarem Format (`humanSize()`-Helper, ggf. nach
    `src/lib/format.ts` extrahieren).
  - Neu: bei leerer Anhangs-Liste ein expliziter „Keine Dateien hochgeladen"-Hinweis.
  - Klick auf Anhang öffnet weiterhin in neuem Tab (kein Lightbox in IT11 — Backlog).

---

## Shared Components

### `<BookingDialogProvider>` — **neu**

**Datei:** `src/components/booking/BookingDialogProvider.tsx`

```typescript
'use client';

interface BookingDialogContextValue {
  isOpen: boolean;
  defaultService: Service | null;
  open: (options?: { service?: Service }) => void;
  close: () => void;
}

interface BookingDialogProviderProps {
  children: React.ReactNode;
}

export function BookingDialogProvider(props: BookingDialogProviderProps): JSX.Element;
```

Verantwortlichkeiten:
- Hält App-weiten Modal-State (`isOpen`, `defaultService`).
- Ruft `useCustomer()` einmal zentral und liefert den Customer als Context an die
  internen Booking-Komponenten — vermeidet redundante `/api/customer/me`-Calls.
- Rendert das `<QuickBookingModal mode="standalone" />` in einem Portal am Ende des
  Body, sodass es über alle anderen Inhalte legt.

### `<QuickBookingModal>` — **edit**

**Datei:** `src/components/booking/QuickBookingModal.tsx`

```typescript
type ModalMode = 'embedded' | 'standalone';

interface QuickBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 'embedded' (default, IT10): Slot kommt vom Parent, Modal zeigt nur Form.
   *  'standalone' (IT11): Modal rendert Service-Picker + Kalender + Slot-Picker + Form. */
  mode?: ModalMode;
  /** Pflicht im 'embedded'-Mode, optional/intern verwaltet im 'standalone'-Mode. */
  selectedTimeSlot: SelectedTimeSlot | null;
  defaultService?: Service | null;
  defaultValues?: QuickBookingPrefill;
  onSlotChange?: () => void;
  onSubmitSuccess: (bookingId: string) => void;
}
```

Erweiterungen:
- Im `standalone`-Mode interne Steps A-D (siehe ARCHITECTURE_IT11 §2.2).
- `<FileUpload onAttachmentsChange={setAttachmentIds} />` zwischen Beschreibung und
  Datenschutz einfügen (in beiden Modes).
- Nach Erfolg: `useBookingDialog().reset()` aufrufen, dann `router.push('/buchung/bestaetigung/<bookingId>?token=<jwt>')`
  (v3-Route) statt nur `onClose()`.

### `<BookingForm>` — **edit (klein)**

**Datei:** `src/components/booking/BookingForm.tsx`

Änderungen:
- Submit-Erfolg: redirect statt Inline-Banner. Der `setStatus({ kind: 'success' })`-
  Branch wird zu einem kurzen Übergangs-State, anschliessend `router.push(...)`.
- Toast wird parallel zum Push aufgerufen (4 s sichtbar, auf der Bestätigungsseite
  immer noch lesbar).

### `<BookingConfirmation>` — **neu (v3)**

**Datei:** `src/app/buchung/bestaetigung/[bookingId]/BookingConfirmation.tsx`
(separate Client-Component, nicht in `BestaetigtClient.tsx` integriert — siehe
v3-Trennung).

```typescript
interface BookingConfirmationProps {
  bookingId: string;       // CUID, gekürzt anzeigen (erste 8 Zeichen)
  service: string;         // Service-Slug
  date: string;            // YYYY-MM-DD
  startTime: string;       // HH:MM
  status?: string;         // optional: PENDING / CONFIRMED — für Status-Badge
}

export function BookingConfirmation(props: BookingConfirmationProps): JSX.Element;
```

UI:
- Heading: „Anfrage erhalten — Tom meldet sich!"
- Buchungsnummer: `#${bookingId.slice(0, 8).toUpperCase()}`
- Service-Label aus `getServiceLabel(slug)`.
- Datum + Uhrzeit aus `formatBerlinDateShort(date)` + `startTime`.
- CTAs: „Zur Startseite", `tel:`-Link, „Eine weitere Anfrage stellen" (öffnet
  das Modal via `useBookingDialog().open()`).

### `<FileUpload>` — **edit (Limits)**

**Datei:** `src/components/booking/FileUpload.tsx`

Erweiterungen für IT11-04 (Tom-Bestätigung 2026-05-03):

- **MIME-spezifische Limits** (statt heutiges einheitliches 20 MB):
  - Bilder (`image/*`) → max. 10 MB
  - Videos (`video/*`) → max. 50 MB
  - PDFs (`application/pdf`) → max. 10 MB
- **Client-Validation:** beim `change`-Event und Drag-Drop-Drop-Event:
  `getUploadLimitForType(file.type)` aus `src/lib/schemas.ts` rufen, bei
  Überschreitung Inline-Fehler pro File-Entry rendern (rote Banner-Card,
  exakte Bytes-Differenz angezeigt). KEIN Upload-Request abschicken.
- **Server-Error-Handling:** wenn der Server trotzdem 413 antwortet (defense-in-depth),
  Fehlermeldung der Server-Response (`error.message`) anzeigen.
- **Hint-Text** unter dem File-Input: „Bilder bis 10 MB · Videos bis 50 MB · max. 5 Dateien".
- **A11y:** Fehler-Banner pro File-Entry mit `role="alert"` + `aria-live="polite"`.

Wird zusätzlich im `QuickBookingModal` eingebunden (zweiter Verwendungs-Ort).

### `<CancelConfirmationDialog>` — **neu**

**Datei:** `src/components/booking/CancelConfirmationDialog.tsx`

```typescript
interface CancelConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Wird mit optionalem Reason aufgerufen, sobald der User bestätigt. */
  onConfirm: (reason?: string) => Promise<void>;
  /** Buchungs-Display-Daten für den Dialog-Body. */
  booking: {
    service: string;
    date: string;       // YYYY-MM-DD
    startTime: string;  // HH:MM
  };
  /** Wenn true, blockiert der Dialog Escape und Backdrop-Click (während Submit). */
  isSubmitting?: boolean;
}

export function CancelConfirmationDialog(props: CancelConfirmationDialogProps): JSX.Element;
```

Verantwortlichkeiten:
- Standard-Confirm-Modal mit Titel „Anfrage stornieren?", Body mit Buchungsdaten
  + Standard-Text „Möchten Sie diese Anfrage wirklich stornieren? Diese Aktion
  kann nicht rückgängig gemacht werden.".
- Optionaler `<textarea>` für „Grund (optional)" — max. 500 Zeichen
  (Counter sichtbar). UX-Designer entscheidet, ob das Feld in V1 sichtbar ist
  (siehe Open Question Q5).
- Buttons: „Abbrechen" (sekundär, links) + „Ja, stornieren" (primär gefährlich,
  rote Akzent-Variante, rechts).
- **Escape-Block während Submit:** wenn `isSubmitting === true`, ignoriert das
  Modal Escape-Taste und Backdrop-Click. Verhindert versehentlichen Datenverlust
  während des laufenden API-Calls.
- A11y: `role="dialog"`, `aria-modal="true"`, Focus auf „Abbrechen" beim Open
  (sicherer Default, primärer Action ist destruktiv).

Wird verwendet im Customer-Dashboard `/konto` und im Gast-Storno-Flow
`/buchung/stornieren`.

### `<GuestCancelClient>` — **neu**

**Datei:** `src/app/buchung/stornieren/GuestCancelClient.tsx`

Client-Component für die Gast-Storno-Page. Verantwortlichkeiten:
- Zeigt Buchungs-Details aus den Server-Component-Props (Service, Datum, Zeit, Status).
- Rendert den `<CancelConfirmationDialog />`.
- Bei „Ja, stornieren": ruft `cancelBookingAsGuest(id, token, reason)` aus
  `api-client.ts`.
- Erfolg → ersetzt UI durch Erfolgs-Card „Anfrage erfolgreich storniert. Tom wurde
  benachrichtigt.".
- Idempotenz (`alreadyCancelled: true`) → zeigt Card „Diese Anfrage wurde bereits
  storniert.".
- Fehler 409 (Frist abgelaufen) → Card „Stornierung nicht mehr möglich. Bitte
  rufen Sie uns an: 0157-74787512".
- Fehler 401 (Token expired/invalid) → kann eigentlich nicht passieren (Server-Component
  hat schon validiert), aber defensiv: Re-Direct auf Token-Expired-Fallback.

### `<TokenExpiredPage>` — **neu**

**Datei:** `src/components/booking/TokenExpiredPage.tsx`

Wiederverwendbare Hinweis-Page für abgelaufene Tokens (Confirmation- ODER
Cancellation-Flow). Wird von Server-Components gerendert, wenn Token-Verify
fehlschlägt.

```typescript
interface TokenExpiredPageProps {
  /** Welcher Flow ist betroffen — bestimmt die Microcopy. */
  flow: 'confirmation' | 'cancellation';
}
```

Inhalt:
- Heading: „Link abgelaufen" (oder „Stornierungslink abgelaufen")
- Body: „Dieser Link ist nicht mehr gültig. Bitte rufen Sie uns direkt an:"
- CTA: `<a href="tel:+4915774787512">{CONTACT.phoneDisplay}</a>`
- Sekundärer Link: „Zur Startseite"

### `<BookingTable>` — **edit**

**Datei:** `src/components/admin/BookingTable.tsx`

Änderungen in der Anhang-Sektion (heute Z. 354–387):
- Empty-State: wenn `b.attachments.length === 0`, zeige `<dt>Anhänge</dt><dd className="text-baerenstark-bark/60">Keine Dateien hochgeladen</dd>`.
- Pro Anhang:
  - Bei `contentType.startsWith('image/')`: zusätzlich zum Icon ein 60×60 px Thumbnail
    (`<img src={att.url} alt="" loading="lazy" className="h-15 w-15 rounded-md object-cover" />`).
  - Dateigröße via `humanSize(att.sizeBytes)` (z.B. „2.3 MB").
  - Layout: Card-Style mit Thumbnail + Filename + Size + Download-Icon, statt Inline-Pill.

### `<Header>` — **edit**

**Datei:** `src/components/layout/Header.tsx`

Änderung Z. 28–33: `<Link href="/buchung">` ersetzen durch:

```tsx
<button
  type="button"
  onClick={() => openBookingDialog()}
  aria-haspopup="dialog"
  className="rounded-lg bg-baerenstark-wood px-3 py-2 …"
>
  Termin buchen
</button>
```

Wobei `openBookingDialog` aus `useBookingDialog()` kommt.

### `<Hero>` — **edit**

**Datei:** `src/components/home/Hero.tsx`

Änderung Z. 27–32: gleiche Ersetzung wie Header. Sekundärer Tel-CTA bleibt.

---

## API Consumption

**Zwei neue Endpoints in IT11** (siehe `ARCHITECTURE_IT11.md` §3.5 + §6.4):

| Aufrufer                          | Endpunkt                                                  | Zweck                                       |
|-----------------------------------|-----------------------------------------------------------|---------------------------------------------|
| `bestaetigung/[id]/page.tsx` (Server-Component, v3) | **NEU** `GET /api/bookings/:id/public-summary?token=<jwt>` | Reload-feste Bestätigungsseite (US-IT11-03). Akzeptiert Token-Scope `booking-confirmation`. |
| `[id]/stornieren/page.tsx` (Server-Component, v3) | **NEU** `GET /api/bookings/:id/public-summary?token=<jwt>` | Storno-Page-Preview (US-IT11-06). Akzeptiert Token-Scope `booking-cancellation` (v3 Scope-Polymorphismus, kein separater Endpoint). |
| `GuestCancelClient`               | **NEU** `POST /api/bookings/:id/cancel?token=<jwt>`       | Gast-Storno (US-IT11-06). Explizit POST nach User-Klick. |
| `CustomerBookingsClient` (`/konto`) | **NEU** (kanonisch) `POST /api/bookings/:id/cancel`     | Eingeloggter Kunden-Storno (US-IT11-06). Auth via Cookie. |

**Bestand-Aufrufe (unverändert):**

| Aufrufer                  | Endpunkt                              | Zweck                                       |
|---------------------------|---------------------------------------|---------------------------------------------|
| `BookingDialogProvider`   | `GET /api/customer/me`                | Pre-Fill-Daten                              |
| `QuickBookingModal`       | `POST /api/upload` (via FileUpload)   | Datei in Vercel Blob hochladen (Limits 10/50 MB serverseitig erzwungen) |
| `QuickBookingModal`       | `POST /api/bookings`                  | Buchung anlegen (mit `attachmentIds[]`); Response enthält jetzt zusätzlich `confirmationToken` und `cancellationToken` |
| `BookingForm`             | `POST /api/bookings`                  | gleicher Endpunkt (Fallback-Pfad)           |
| `BookingTable` (Admin)    | `GET /api/bookings`                   | Liste inkl. `attachments[]`                 |
| `CustomerBookingsClient`  | `GET /api/customer/bookings`          | Liefert `isCancellable`-Flag pro Buchung; Stornieren-Button basiert darauf |
| `CustomerBookingsClient`  | `POST /api/customer/bookings/:id/cancel` | **Bestand seit IT4**, optional ablösbar durch neuen kanonischen Endpoint (Engineer-Entscheidung) |

**API-Client-Funktionen (zu ergänzen in `src/lib/api-client.ts`):**

```typescript
/** US-IT11-03 — Reload-feste Bestätigungsseite. Server-Component-Aufruf. */
export async function getBookingPublicSummary(
  id: string,
  token?: string,    // optional bei Auth-Cookie-Auth
): Promise<BookingPublicSummary>;

/** US-IT11-06 — Gast-Storno mit signiertem Token. */
export async function cancelBookingAsGuest(
  id: string,
  token: string,
  reason?: string,
): Promise<{ id: string; status: 'CANCELLED'; cancelledAt: string; alreadyCancelled: boolean }>;

/** US-IT11-06 — Eingeloggter Storno (kanonisch via /api/bookings/:id/cancel). */
export async function cancelBookingAsCustomer(
  id: string,
  reason?: string,
): Promise<{ id: string; status: 'CANCELLED'; cancelledAt: string; alreadyCancelled: boolean }>;
```

---

## State Management

### Globaler State (neu: BookingDialog)

```typescript
interface BookingDialogState {
  isOpen: boolean;
  defaultService: Service | null;
  // Customer aus useCustomer() wird hier zentralisiert geholt:
  customer: CustomerUserPublic | null;
  customerStatus: 'loading' | 'authenticated' | 'unauthenticated';
}
```

### Pro-Komponente lokaler State

| Komponente            | Lokaler State                                                |
|-----------------------|--------------------------------------------------------------|
| `QuickBookingModal`   | `state: ModalState`, `attachmentIds: string[]`, RHF-Form-State, `selectedDate`, `durationMinutes`, `selectedTimeSlot` (im Standalone-Mode) |
| `FileUpload`          | `entries: UploadEntry[]`, `dragOver`, `blobUnavailable`     |
| `BookingTable`        | unverändert (`bookings`, `filter`, `pendingAction`, …)       |
| `BestaetigtClient`    | unverändert                                                  |

---

## Validation Rules

**Änderungen in IT11:**

- **Upload-Limits — split by MIME (Tom-Bestätigung 2026-05-03):**
  - `image/*` → max. 10 MB (`UPLOAD_MAX_IMAGE_BYTES`)
  - `video/*` → max. 50 MB (`UPLOAD_MAX_VIDEO_BYTES`)
  - `application/pdf` → max. 10 MB (`UPLOAD_MAX_DOCUMENT_BYTES`)
  - Helper `getUploadLimitForType(contentType)` zentralisiert die Logik in
    `src/lib/schemas.ts`.
  - Client validiert vor Upload (Inline-Fehler pro File-Entry, kein Network-Roundtrip).
  - Server validiert ebenfalls (HTTP 413 mit aussagekräftigem Body bei Verstoss).
- **Storno-Reason** (optional, US-IT11-06): max. 500 Zeichen, Whitespace getrimmt,
  leerer String wird zu `null` normalisiert.

**Bestand:**

- `BookingFormSchema` aus `src/lib/schemas.ts` (Pflicht-Felder, Telefon-Mindestlänge,
  PLZ-Regex, Privacy-Checkbox) — unverändert.
- `UPLOAD_ACCEPTED_CONTENT_TYPES` (Whitelist) — unverändert.
- `UPLOAD_MAX_FILES_PER_BOOKING = 5` — unverändert.

---

## Accessibility & Responsiveness

### A11y-Auflagen für IT11 (zusätzlich zu Bestand)

- **Modal-Trigger Button** hat `aria-haspopup="dialog"`, identische Tab-Reihenfolge
  wie ein Link, Tastatur-Aktivierung via Enter und Space.
- **Bestätigungsseite** rendert `role="status"` für die Erfolgsmeldung (Screen-Reader-
  Live-Region nach Page-Load).
- **Toast** mit `role="alert"` (Error) bzw. `role="status"` (Success) — bereits in
  IT10 implementiert, bleibt.
- **Admin-Thumbnail** hat `alt=""` (dekorativ, der Filename steht daneben).
- **Empty-State „Keine Dateien hochgeladen"** ist semantischer Text in `<dd>`, kein
  Icon-only.

### Responsiveness

- Modal: Mobile-Bottom-Sheet (≤ sm-Breakpoint, full-width, sticky-Header/Footer),
  Desktop zentriertes Modal (max-w-2xl).
- Im Standalone-Mode auf Desktop: zwei-Spalten-Layout (links Kalender + Slot-Picker,
  rechts Form). Auf Mobile: vertikal gestapelt.

---

## Story Coverage

| Story         | Frontend-Deliverable                                                                  |
|---------------|---------------------------------------------------------------------------------------|
| US-IT11-01    | **Kein FE-Change.** Operativ: Migration deployen, ENV setzen.                         |
| US-IT11-02    | `BookingDialogProvider` neu, `QuickBookingModal` Standalone-Mode (Escape blockiert während Submit), Header + Hero CTAs umstellen, ServiceDetailModal optional CTA. |
| US-IT11-03    | Toast nach Submit (in `BookingForm` + `QuickBookingModal`), **neue Route `/buchung/bestaetigung/[bookingId]?token=…`** (v3) mit Server-Component-Token-Verify + neue `BookingConfirmation`-Komponente, Push nach Erfolg. `<TokenExpiredPage flow="confirmation" />` inline-Fallback. **Bestand `BestaetigtClient.tsx` bleibt unangetastet.** |
| US-IT11-04    | `<FileUpload />` in `QuickBookingModal` einbinden, **MIME-spezifische Client-Validation 10 MB Bilder / 50 MB Videos**, **Min-Size-Check 1 Byte**, **Parallel-Upload-Limit max 3** (v3), `BookingTable` Anhang-Anzeige mit Thumbnail/Größe/Empty-State (Lightbox **out-of-scope**, IT12), `BLOB_READ_WRITE_TOKEN` in Vercel setzen. |
| US-IT11-05    | **Kein FE-Code-Change.** Operativ: Migration (US-IT11-01) deployen → `useCustomer()` liefert dann korrekt befüllte Profile. Defensive Index-Cast in `BookingClient.tsx` bleibt als Hardening. |
| US-IT11-06    | Stornieren-Button im `/konto`-Dashboard, `<CancelConfirmationDialog />` (Standard-Confirm-Modal mit optionalem Reason-Feld, Escape blockiert während Submit), Erfolgs-Toast „Auftrag storniert", optimistic Status-Badge-Update. **Gast-Storno:** neue Page **`/buchung/[id]/stornieren?token=…`** (v3, Path-Param) mit Server-Component-Token-Verify, `<GuestCancelClient />`, Erfolgs-/Idempotenz-/Frist-Cards, `<TokenExpiredPage flow="cancellation" />` inline. Bestätigungs-E-Mail enthält Storno-Link mit neuer Route. **`cancelledBy` einheitlich `'CUSTOMER'`** (keine Differenzierung Gast vs. eingeloggt). |

---

## Dateien-Inventar (Pflicht-Änderungen)

| Datei                                                                | Aktion |
|----------------------------------------------------------------------|--------|
| `src/components/booking/BookingDialogProvider.tsx`                   | NEU (mit `reset()`-Methode, v3) |
| `src/components/booking/use-booking-dialog.ts`                       | NEU    |
| `src/components/booking/CancelConfirmationDialog.tsx`                | NEU (US-IT11-06) |
| `src/components/booking/TokenExpiredPage.tsx`                        | NEU (US-IT11-03 + 06) |
| `src/app/buchung/bestaetigung/[bookingId]/page.tsx`                  | **NEU (v3)** — Server-Component, Token-Verify + Public-Summary-Call |
| `src/app/buchung/bestaetigung/[bookingId]/BookingConfirmation.tsx`   | **NEU (v3)** — Client-Component für initiale Bestätigung |
| `src/app/buchung/[id]/stornieren/page.tsx`                           | **NEU (v3)** — Server-Component, Token-Verify, Path-Param-ID |
| `src/app/buchung/[id]/stornieren/GuestCancelClient.tsx`              | **NEU (v3)** — Client-Component für Gast-Storno |
| `src/components/booking/QuickBookingModal.tsx`                       | EDIT (Standalone-Mode + FileUpload + Push, Escape-Block beim Submit, ruft `reset()` vor Push v3) |
| `src/components/booking/BookingForm.tsx`                             | EDIT (Push auf neue Route `/buchung/bestaetigung/<id>?token=…`) |
| `src/components/booking/FileUpload.tsx`                              | EDIT (MIME-spezifische Limits 10/50 MB; v3: Min-Size-Check, Parallel-Upload-Limit max 3) |
| `src/components/admin/BookingTable.tsx`                              | EDIT (Anhang-Anzeige; Lightbox out-of-scope, neuer Tab) |
| `src/components/layout/Header.tsx`                                   | EDIT (CTA → Modal) |
| `src/components/home/Hero.tsx`                                       | EDIT (CTA → Modal) |
| `src/components/home/ServiceDetailModal.tsx`                         | EDIT (optional, sekundärer Buchen-CTA) |
| `src/app/layout.tsx`                                                 | EDIT (`<BookingDialogProvider>` wraps `<main>`) |
| `src/app/buchung/bestaetigt/BestaetigtClient.tsx`                    | **read-only (v3)** — bleibt unangetastet für Counter-Proposal-Flow |
| `src/app/buchung/bestaetigt/page.tsx`                                | **read-only (v3)** — bleibt unangetastet |
| `src/app/konto/...` (Customer-Bookings-Komponente)                   | EDIT (Stornieren-Button + Toast + optimistic Update) |
| `src/lib/api-client.ts`                                              | EDIT (drei neue Funktionen — siehe API Consumption) |
| `src/lib/schemas.ts`                                                 | EDIT (`UPLOAD_MAX_IMAGE_BYTES`, `UPLOAD_MAX_VIDEO_BYTES`, `getUploadLimitForType`) |
| `next.config.js`                                                     | OPTIONAL EDIT (Redirect `/buchen` → `/buchung`, falls `/buchen` irgendwo existiert) |

**Keine Änderungen:**
- `src/lib/use-customer.ts`
- `src/lib/toast.ts`
- `src/components/ui/Modal.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/booking/Calendar.tsx`, `BookingCalendar.tsx`, `TimeSlotPicker.tsx`, `DurationPicker.tsx`
- `src/app/buchung/page.tsx`, `BookingClient.tsx`
- `src/app/buchung/storno/...` (Bestand für `respond`-Cancel-Flow, NICHT umbenennen)
- `contracts/api-routes.md` (Backend-Architect aktualisiert separat — zwei neue Endpoints)

---

## Open Questions (für UX-Designer / Tom)

1. **(Q1, Tom — beantwortet 2026-05-03):** Upload-Limits split by MIME — 10 MB
   Bilder, 50 MB Videos, 10 MB PDFs. **Erledigt — in Validation Rules eingearbeitet.**
2. **(Q2, UX-Designer):** ServiceDetailModal sekundärer CTA „Diesen Service buchen"
   wünschenswert? Empfehlung: ja, mit `defaultService=<slug>`.
3. **(Q3, UX-Designer):** Microcopy auf Bestätigungsseite — „Eine weitere Anfrage
   stellen" als CTA wünschenswert? Wie ist die exakte Erfolgs-Headline?
4. **(Q4, UX-Designer):** Bottom-Sheet auf Mobile — soll der Standalone-Mode wirklich
   alle vier Steps (Service + Kalender + Slot + Form) in einer einzelnen scrollbaren
   Liste zeigen, oder mit Step-Indicator und Vor/Zurück-Buttons gechunkt?
5. **(Q5, UX-Designer):** Soll das `<CancelConfirmationDialog />` einen optionalen
   „Grund"-Textarea anzeigen (mappt auf `cancellationReason`)? Empfehlung: ja,
   optional, max. 500 Zeichen, Placeholder „Grund (optional)". Tom-Mehrwert: er
   sieht in seiner Storno-Mail warum der Kunde abgesprungen ist.
6. **(Q6, UX-Designer):** Microcopy auf der Gast-Storno-Page `/buchung/stornieren`:
   Soll die Buchungsdetails-Anzeige vor der Bestätigung nur Service+Datum zeigen,
   oder auch die Adresse und Beschreibung? Empfehlung: minimal — Service+Datum+Status.
7. **(Q7, UX-Designer):** Token-Expired-Page (`<TokenExpiredPage />`) — soll sie
   einen sekundären CTA „Neue Anfrage stellen" bekommen, der das Booking-Modal öffnet?
   Empfehlung: ja, defensiv (User landet hier evtl. weil er einen 30-Tage-alten Link
   öffnet — gibt ihm einen klaren Next-Step).

---

**Ende frontend-requirements.md (IT11 v3 — 2026-05-04, QA-Review-Resolution: Routing-Fixes, `cancelledBy`-Vereinheitlichung, Lightbox out-of-scope).**
