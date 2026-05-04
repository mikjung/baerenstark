# Frontend Requirements — Iteration 12

> Source-of-Truth ist `ARCHITECTURE_IT12.md` (Repo-Root).
> Dieses Dokument adressiert konkret den Frontend-Engineer und (für
> Layout-/UX-Fragen) den `ux-designer`.
>
> Stack-Reminder: Next.js App Router, TypeScript, React 18, Tailwind,
> React Hook Form, Zod, NextAuth v5 (Customer-Provider separat),
> Vercel Blob, Resend, dynamic-imported FullCalendar.

---

## Querschnitt: neue Helper / Patterns

### `src/lib/scroll-into-view.ts` (NEU, für S04 + S09)

Helper:

```ts
export function scrollIntoViewIfNeeded(elementId: string, opts?: ScrollIntoViewOptions): void {
  if (typeof window === 'undefined') return;
  const el = document.getElementById(elementId);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const inViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
  if (inViewport) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start', ...opts });
}
```

Alle bestehenden `scrollIntoView`-Aufrufe in `src/app/buchung/BookingClient.tsx`
(5 Stellen, Zeilen 203, 215, 232, 382, 454) auf diesen Helper migrieren.

### `src/lib/customer-sync.ts` (NEU, für S07)

Event-Bus für Customer-Auth-State-Sync:

```ts
// SSR-safe: nur im Browser ein EventTarget anlegen.
const target: EventTarget | null = typeof window !== 'undefined' ? new EventTarget() : null;

export function emitCustomerChanged(): void {
  target?.dispatchEvent(new Event('change'));
}

export function onCustomerChanged(cb: () => void): () => void {
  if (!target) return () => {};
  target.addEventListener('change', cb);
  return () => target.removeEventListener('change', cb);
}
```

`useCustomer` lauscht. Login/Logout/Profile-Save/Register-from-Booking
rufen `emitCustomerChanged()`.

---

## Story-by-Story

### IT12-S01 — Google OAuth „Bad Request"

**Frontend-Anteil:** Keiner. Reine Konfigurations-Sache (Vercel-Env +
Google Cloud Console). Falls QA nach dem Fix einen Login-Test macht,
muss `/konto/login` weiterhin den „Mit Google anmelden"-Button via
`OAuthButtons.tsx` rendern (existiert bereits).

**Test:** `cy.contains('Mit Google anmelden').click()` → Redirect zu
`accounts.google.com/...`, nach Login Redirect zu `/konto`.

---

### IT12-S02 — Service-Detailseiten Bilder + Icon

**Pages:** `src/app/services/[slug]/page.tsx`

**Änderungen:**

1. **Hero-Image neu:** `next/image` mit Mapping-Tabelle
   (siehe ARCHITECTURE_IT12 §2). Mapping zentral in
   `src/lib/service-images.ts`:
   ```ts
   export const SERVICE_IMAGE_MAP: Record<string, string> = {
     gruenflaechenpflege: '/grünflächenpflege.png',
     entruempelung: '/entruemplungen.png',
     entkernung: '/entkernungsarbeiten.png',
     reinigung: '/reinigungsarbeiten.png',
     muelltonnenservice: '/mülltonnenservice.png',
     entsorgung: '/metal_schrott.png',
   };
   ```

2. **Layout Hero:**
   - Aktuell rechts in der Hero: 7xl-Icon in einer 44x44-Box.
   - Neu: Hero-Bild rechts (`width=400 height=300`, `priority` für LCP).
   - Bei `<h1>` links: kleines Icon (1.5em, inline mit Text) — so wie
     in der Story beschrieben.

3. **Image-Fallback (AC3):** Eine Wrapper-Komponente
   `<ServiceHeroImage slug={slug} icon={info.icon} />` mit `useState('loaded'|'errored')`.
   Bei `onError`: grauer Container (`bg-baerenstark-sand/20 rounded-2xl`)
   mit zentriertem Icon.

**UX-Spec NICHT eigenständig entscheiden:** Genaues Größenverhältnis
zwischen Bild und Icon-im-Header → wartet auf `ux-designer`.
Empfehlung: Bild ~400×300, Icon im H1 ca. 28-32px.

**Coverage-Test:** Cypress-Test, der für jeden der 6 Slugs (`SERVICE_DETAIL_SLUGS`)
die Page öffnet und prüft, dass `<img>` mit dem zugeordneten Bild geladen ist.

---

### IT12-S03 — Buchungskalender langsam / nicht klickbar

**Frontend-Anteil:**

1. `src/components/calendar/AppCalendar.tsx`: prüfen, dass
   `selectable: true` UND `dateClick: handleDayClick` im FullCalendar-
   Config gesetzt sind. Im `'customer'`-Mode sicherstellen, dass die
   `dayCellClassNames` korrekt zwischen `available` (klickbar),
   `partial` (klickbar) und `unavailable` (NICHT klickbar) trennen.
2. Falls die Backend-Optimierung den Endpoint deutlich beschleunigt:
   keine Frontend-Änderung nötig. Falls weiterhin > 1.5s: ein
   Skeleton-Overlay einblenden (existiert schon), aber zusätzlich
   einen `aria-busy` setzen.

**Performance-Test:** `cy.get('[data-testid="calendar"]').should('be.visible')`
innerhalb 1500ms ab Navigations-Start zur Buchungsseite.

---

### IT12-S04 — Scroll-Jump bei Slot-Auswahl

**Components:** `src/app/buchung/BookingClient.tsx`

**Änderung:** Alle `scrollIntoView`-Aufrufe auf `scrollIntoViewIfNeeded(...)`
migrieren (siehe Querschnitt). Zusätzlich in `handleTimeSlotSelect`:
den Scroll-Aufruf NUR im Rebook-Mode ausführen.

```ts
function handleTimeSlotSelect(slot: SelectedTimeSlot) {
  setSelectedTimeSlot(slot);
  if (!isRebookMode) {
    setIsQuickBookingOpen(true);
    return; // KEIN scrollIntoView
  }
  // Nur im Rebook-Mode:
  setTimeout(() => scrollIntoViewIfNeeded('booking-form-section'), 50);
}
```

**Test:** Cypress: Scrollposition vor Slot-Auswahl messen, Slot
auswählen, danach Scrollposition prüfen — darf sich um max ±50 Pixel
verändert haben.

---

### IT12-S05 — Konto-Erstellung nach Gast-Buchung

**Components / Pages:**

- **NEU:** `src/components/booking/CreateAccountAfterBookingPrompt.tsx`
  - Card auf der Bestätigungsseite (NICHT als störendes Modal).
  - Conditional Render: nur wenn `customer === null` (nicht eingeloggt)
    UND `bookingResponse.customerEmail` vorhanden ist UND URL hat
    `?new=true`.
  - Fields:
    - E-Mail (read-only, aus Buchung)
    - Vorname (read-only, aus Buchung — split aus customerName)
    - Nachname (read-only, aus Buchung)
    - Passwort (RHF-Input, min 12, validate gegen Standard-Passwort-
      Schema in `lib/schemas.ts`)
    - Passwort wiederholen
  - Submit:
    ```ts
    POST /api/customer/register-from-booking
    { bookingId, confirmationToken, password }
    ```
  - Bei Erfolg: Toast „Konto erstellt — du bist jetzt eingeloggt", dann
    `emitCustomerChanged()`, `router.push('/konto')`.
  - Bei 409 CONFLICT: Hinweis „Du hast bereits ein Konto" + Login-Link.
  - „Nein danke"-Button: schließt die Card (per `useState` lokal); im
    selben Session-Kontext erscheint sie nicht erneut (sessionStorage-
    Flag `'accountPromptDismissed:'+bookingId`).

- **GEÄNDERT:** `src/app/buchung/bestaetigung/[id]/page.tsx`
  - Zeigt die Bestätigungsdetails (existiert).
  - Rendert zusätzlich `<CreateAccountAfterBookingPrompt />` unter den
    Bestätigungsdetails.

**API-Contract** (siehe Backend §S05):

```jsonc
// POST /api/customer/register-from-booking
// Request
{
  "bookingId": "string",
  "confirmationToken": "string",
  "password": "string (min 12)"
}
// Response 201
{
  "customerId": "string",
  "linkedBookingsCount": 1
}
// Response 409 (Konto existiert) — Frontend zeigt Login-CTA
{
  "error": { "code": "CONFLICT", "message": "Konto existiert bereits", "subcode": "ACCOUNT_EXISTS" }
}
```

**UX-Spec NICHT eigenständig:** Card vs. Modal vs. Inline-Form →
`ux-designer` entscheidet. Empfehlung: Inline-Card unterhalb der
Bestätigungs-Box, weil weniger störend.

---

### IT12-S06 — Kundendashboard 500

**Frontend-Anteil:** Nach dem Backend-Fix (Migration) verifizieren,
dass `/konto` korrekt rendert. Bonus: `CustomerDashboard.tsx`
Error-Handling prüfen — bei Endpoint-Fehler aktuell wahrscheinlich
schwacher Banner. Empfehlung: Ein „Anfragen konnten nicht geladen
werden — [Erneut versuchen]"-Block mit Retry-Button.

**Test:** Login als Customer ohne Buchungen → leere Liste mit Hinweis.
Login als Customer mit Buchungen → Liste rendert.

---

### IT12-S07 — Login-State Sync

**Components:**

- **GEÄNDERT:** `src/lib/use-customer.ts`
  - In `fetchMe`: Bei Network-Error NICHT auf `'unauthenticated'`
    fallen — statt dessen den vorherigen Status erhalten oder einen
    expliziten `'error'`-State einführen.
  - In `useEffect`: zusätzlich auf `onCustomerChanged`-Event lauschen.
    ```ts
    useEffect(() => {
      const ctrl = new AbortController();
      void fetchMe(ctrl.signal);
      const unsub = onCustomerChanged(() => { void fetchMe(); });
      return () => { ctrl.abort(); unsub(); };
    }, []);
    ```

- **GEÄNDERT:** `src/components/customer/ProfileForm.tsx`
  - Nach erfolgreichem `updateCustomerProfile(...)`: `emitCustomerChanged()`
    aufrufen, damit der Header sich refresht.

- **GEÄNDERT:** `src/lib/api-client.ts`
  - In `loginCustomer`, `logoutCustomer`, evtl. OAuth-Finalize-Flow:
    `emitCustomerChanged()` aufrufen.

**UX-Hinweis:** Während `useCustomer.status === 'loading'` zeigt der
Header bereits einen unsichtbaren Platzhalter. Das bleibt; nach dem
Fix soll der Header NIE mehr in einen ungewollten `'unauthenticated'`-
State zurückfallen.

**Test:** Cypress: Login → `/konto/profil` → Profil ändern → Speichern.
Erwartet: Header zeigt weiterhin „Mein Konto", kein „Anmelden".

---

### IT12-S08 — Buchungsformular Profil-Vorausfüllung

**Components:**

- **GEÄNDERT:** `src/app/buchung/BookingClient.tsx`
  - **Render-Gate:** Wenn `useCustomer().status === 'loading'`, ein
    Skeleton der ganzen Buchungs-Sektion anzeigen (oder mindestens
    des `<BookingForm>`-Teils). Erst rendern, sobald
    `'authenticated'` ODER `'unauthenticated'`.
  - Konkret: aktuelle Z. 75 (`const { customer } = useCustomer();`)
    auf `const { status, customer } = useCustomer();` erweitern, dann
    am Render-Top:
    ```tsx
    if (status === 'loading') {
      return <BookingSkeletonOverall />;
    }
    ```

- **GEÄNDERT (Fallback):** `src/components/booking/BookingForm.tsx`
  - Falls Render-Gate nicht ausreicht: `useEffect` mit `reset()`-Call
    bei Änderung der `defaultName`/`defaultEmail`/etc.-Props. Aber
    NUR wenn `formState.isDirty === false` (sonst überschreibt es
    User-Input).

**Coverage-Test:** Cypress: Customer mit Profildaten loggt sich ein,
öffnet `/buchung`, scrollt zur Form. Erwartet: Name/Email/Telefon/Adresse
sind vorausgefüllt.

---

### IT12-S09 — Scroll-Jump beim Feldwechsel

**Components:**

- **GEÄNDERT:** `src/components/booking/BookingForm.tsx`
  - Den `useEffect`-Hook bei `watchedService` (Z. 161–163) refactorn:
    nur `onServiceChange?.(...)` aufrufen, wenn der Service tatsächlich
    geändert wurde:
    ```ts
    const lastServiceRef = useRef<string | null | undefined>(initialService);
    useEffect(() => {
      if (watchedService !== lastServiceRef.current) {
        lastServiceRef.current = watchedService;
        onServiceChange?.(watchedService ?? null);
      }
    }, [watchedService, onServiceChange]);
    ```

- **DEBUG (Frontend-Engineer):** Mit DevTools-Performance-Tab das
  exakte Scroll-Event identifizieren. Wenn die useDeferredValue-Lösung
  nicht reicht: Banner-Re-Mounts memoizen.

**Test:** Cypress: Form ausfüllen, von Feld zu Feld via Tab springen,
Scrollposition überwachen — keine Sprünge.

---

### IT12-S10 — Bild-Upload INTERNAL_ERROR

**Frontend-Anteil:**

- `src/components/booking/FileUpload.tsx` zeigt bei INTERNAL_ERROR
  aktuell wahrscheinlich eine generische Fehlermeldung. Verbessern:
  bei `BLOB_NOT_CONFIGURED` (503) einen Hinweis „Datei-Upload aktuell
  nicht verfügbar — bitte später erneut versuchen oder anrufen".
  Bei `INTERNAL_ERROR` (502) gleicher Hinweis.
- Nach dem Backend-Fix (Token regenerieren) keine Code-Änderung nötig.

---

### IT12-S11 — Submission ohne Feedback

**Components:**

- **GEÄNDERT:** `src/components/booking/BookingForm.tsx`
  - Defensives `try/catch/finally` um den ganzen Submit-Block
    (siehe ARCHITECTURE §S11). Den Loading-State im `finally` zurücksetzen
    auf `idle`, falls noch `submitting`.

- **NACH erfolgreichem Submit:** Wenn der Customer eingeloggt ist,
  `router.refresh()` auf der Bestätigungsseite triggern (oder besser:
  `revalidateTag('customer-bookings')` server-side, das der Backend-
  Endpoint im POST-Handler nach erfolgreicher Insert tut — siehe
  Backend-Reqs).

**Test:** Cypress: Form abschicken (eingeloggt) → Loader verschwindet
→ Erfolgs-Banner → Redirect zur Bestätigungsseite → `/konto` zeigt
die neue Anfrage.

---

### IT12-S12 + S13 — Admin Dashboard Endpoints

**Frontend-Anteil:** Nach Backend-Fix verifizieren. Falls Code-Anpassung
nötig: `UpcomingBookingsList.tsx` und `BookingTable.tsx` Error-Handling
zeigen aktuell „Interner Serverfehler" pauschal — mit einem freundlicheren
Banner ersetzen („Anfragen konnten nicht geladen werden — Erneut versuchen").

---

### IT12-S14 — Admin-Navigation neu strukturieren

**Components:**

- **NEU:** `src/components/admin/AdminLayout.tsx` (Sidebar / Top-Bar)
  - Drei Gruppen, siehe ARCHITECTURE §13.
  - Mobile-First: Top-Bar mit Akkordeon, Desktop: Sidebar links.
  - Aktive Route hervorgehoben (via `usePathname` aus `next/navigation`).

- **GEÄNDERT:** `src/components/admin/AdminDashboard.tsx`
  - Den `<nav>`-Block (QuickLinks, Z. 62–71) und die Tab-Bar mit
    Bewertungen-Tab (Z. 76–95) konsolidieren — Bewertungen darf NUR
    in der neuen Sidebar erscheinen.
  - Die Tabs (Buchungsanfragen, Zeitfenster, Verfügbarkeit) bleiben
    optional als interne Tabs *innerhalb* von `/admin`, ABER ohne
    Bewertungen-Duplikat.

- **GEÄNDERT:** `src/app/admin/layout.tsx`
  - Wickelt alle `/admin/*`-Routes in `<AdminLayout>`.

**UX-Spec NICHT eigenständig:** Visuelles Layout (Farben, Icons,
Abstände) → `ux-designer`. Frontend-Engineer rendert die Struktur, der
UX-Designer liefert das Aussehen.

**Test:** Cypress: `cy.contains('Bewertungen').should('have.length', 1)`
auf jeder Admin-Seite.

---

### IT12-S15 — Admin Marketing-E-Mail

**Pages / Components:**

- **GEÄNDERT:** `src/app/admin/users/page.tsx` (Server-Component
  Wrapper) — passend zum neuen `AdminLayout` (S14).

- **NEU:** `src/components/admin/users/MarketingCustomerListClient.tsx`
  (Client-Component für die interaktive Liste).
  - Service-Filter: Multi-Select aller `SERVICE_LABELS`.
  - Such-Feld (Name / E-Mail).
  - Tabelle mit Spalten: Checkbox, Name, E-Mail, Genutzte Services
    (Tags), Letzte Buchung, Unsubscribe-Status.
  - „X Kunden ausgewählt | E-Mail senden"-Bar oben.
  - „E-Mail senden"-Button öffnet das Compose-Modal.
  - Datenquelle: `GET /api/admin/customers/marketing-list?services=...`

- **NEU:** `src/components/admin/users/MarketingEmailComposeModal.tsx`
  - Felder: Betreff (text input, max 200), Nachricht (textarea, max 10k).
  - Empfänger-Vorschau: max 5 sichtbar, „+N weitere".
  - Hinweis-Banner bei > 50 Empfängern, Confirm-Dialog vor Submit.
  - Bei Submit:
    ```ts
    POST /api/admin/marketing/email
    { subject, body, recipientIds, filterServices }
    ```
  - Polling auf `GET /api/admin/marketing/email/:id` alle 2s, bis
    `status === 'completed'`. Erfolgs-Toast mit `successCount`/`failureCount`.

- **NEU:** `src/components/admin/users/UnsubscribeBadge.tsx`
  - Kleiner Tag „Abgemeldet" (rot/grau) für Customer mit
    `unsubscribed === true`.

**UX-Spec NICHT eigenständig:**

- Genaue Position des Filters (oben vs. Sidebar). UX-Designer.
- Compose-Modal-Layout (Templates? Vorschau?). Empfehlung:
  Plaintext-Editor mit Preview-Pane darunter. UX-Designer entscheidet.

**Test:**

- Filter setzen → Liste filtert.
- 60 Kunden auswählen → Confirm-Dialog erscheint.
- Senden → 60 E-Mails verarbeitet, Toast mit Anzahl.

---

## Coverage Matrix (Frontend)

| Story | Frontend-Deliverable |
|-------|----------------------|
| IT12-S01 | Keine Code-Änderung; Test-Verifikation. |
| IT12-S02 | `service-images.ts`, ServiceHeroImage, Hero-Layout. |
| IT12-S03 | AppCalendar Click-Handler-Verify; Skeleton-Overlay. |
| IT12-S04 | `scrollIntoViewIfNeeded` + 5 Migrationen. |
| IT12-S05 | `CreateAccountAfterBookingPrompt`, Bestätigungsseite. |
| IT12-S06 | Verifikation; ggf. Error-Banner. |
| IT12-S07 | `customer-sync.ts`, useCustomer-Patch, ProfileForm-Hook. |
| IT12-S08 | Render-Gate auf useCustomer.status. |
| IT12-S09 | useEffect-Dedup im BookingForm. |
| IT12-S10 | Verbesserte Error-Banner-Texte. |
| IT12-S11 | Defensives `finally` im Submit. |
| IT12-S12/S13 | Verifikation; ggf. Error-Banner. |
| IT12-S14 | AdminLayout, AdminDashboard-Refactor. |
| IT12-S15 | MarketingCustomerListClient, ComposeModal, UnsubscribeBadge. |

---

## Post-QA Revision (2026-05-04)

> SSOT bei Konflikten: **diese Sektion**. Vollständige Begründung siehe
> `ARCHITECTURE_IT12.md` §Phase-2-Revision (R.0-R.11).

### Routen (überschreibt frühere Pfade)

- Service-Detailseite: `/services/[slug]` (NICHT `/leistungen/[slug]`).
- Marketing-Abmeldung-Bestätigung: `/marketing/abgemeldet?ok=1` oder `?error=invalid`.

### Service-Slugs (SSOT)

```
entruempelung, entkernung, reinigung, gruenflaechenpflege,
muelltonnenservice, entsorgung, sonstiges
```

(Plural-Slugs wie `entruempelungen` oder `*-arbeiten` werden NICHT verwendet.)

### S05 — Endpoint final

```ts
POST /api/customer/register-from-booking
Body: { bookingId: string, confirmationToken: string, password: string }
Response 201: { customerId, linkedBookingsCount } + Set-Cookie
Errors: 400 / 401 INVALID_TOKEN / 404 BOOKING_NOT_FOUND
        / 409 CONFLICT subcode='ACCOUNT_EXISTS' / 429
```

**409-Banner-Text:** „Du hast bereits ein Konto. Bitte logge dich ein." mit Link zu `/konto/login?email=...`.

**UI:** Embedded-Card unterhalb der Bestätigungsdetails (kein Modal, kein Bottom-Sheet). Auf Mobile + Desktop identisches Layout (vertikales Stacking unter Bestätigungs-Box).

**Dismiss:** „Nein danke"-Button → sessionStorage `'accountPromptDismissed:'+bookingId` setzen, Card ausblenden.

### S15 — Endpoints final (überschreibt §IT12-S15 Compose-Modal-Block)

| Aktion | Method + Path |
|--------|---------------|
| Empfänger laden | `GET /api/admin/marketing/recipients?service=&hasBooked=true&unsubscribed=false` |
| Mail anlegen (Draft oder direkt senden) | `POST /api/admin/marketing/emails` mit `{ subject, body, recipientIds, filterServices, status: 'draft' \| 'send' }` |
| Test-Send | `POST /api/admin/marketing/emails/{id}/test-send` |
| Bulk-Send | `POST /api/admin/marketing/emails/{id}/send` |
| Historie | `GET /api/admin/marketing/emails?page=&limit=` |
| Detail | `GET /api/admin/marketing/emails/{id}` |

**Hard-Cap-Verhalten:**
- Bei > 50 ausgewählten Empfängern: Frontend disabled den „Senden"-Button im Confirm-Step und zeigt Banner: „Hard-Cap: max. 50 Empfänger pro Versand. Bitte Auswahl reduzieren oder in mehreren Schüben senden."
- Bei < 50 aber Daily-Quota überschritten (Server-429 `DAILY_QUOTA_EXCEEDED`): Banner „Heute sind bereits {sent} von 100 Mails versandt. Bitte morgen erneut versuchen."

**Quota-Anzeige:** Im Composer Step 1 Header zeigt „Heute: {n} von 100 Mails versandt" (load via `GET /api/admin/marketing/emails?...` mit Tagesfilter, oder neuer Mini-Endpoint — Architect entscheidet, kann auch im `/recipients`-Response mitkommen).

**State-Mapping `MarketingEmail.status` → UI:**
- `draft` → Wizard-Step 1-4 (lokal vor Server-Persist) oder Composer kann Draft speichern.
- `sent` → Step 6 grün „Alle erfolgreich".
- `partial_failure` → Step 6 orange mit Failed-Liste.
- `failed` → Step 6 rot „Versand fehlgeschlagen".

**Kein Polling nötig** in IT12 (Hard-Cap 50 → Send synchron < 10s). Wizard zeigt Spinner während `POST .../send`-Request, danach direkt Step 6.

### S11 — Idempotency-Key

`POST /api/bookings` mit Header `Idempotency-Key: <crypto.randomUUID()>` (Frontend generiert pro Submit). Bei Network-Error & Retry: gleicher Key wiederverwenden. Backend liefert dann cached 201, kein doppelter Insert.

### Marketing-Footer-Hinweis (UX)

UX-Designer-TODO: Im Composer-Vorschau-Step (Step 3) wird der Pflicht-Footer als „Wird automatisch hinzugefügt"-Box dargestellt (read-only, ausgegraut). Tom kann ihn nicht editieren, soll ihn aber sehen.

### TODO für UX-Designer (Frontend wartet)

- UX-Spec §3.2 Routen `/leistungen/[slug]` → `/services/[slug]`.
- UX-Spec §3.2.2 Service-Slugs auf SSOT.
- UX-Spec §3.5.4 `EMAIL_EXISTS` → `ACCOUNT_EXISTS`.
- UX-Spec §3.5 Konto-Card überall embedded (kein Bottom-Sheet/Modal-Variante mehr).
- marketing-email-flow.md §7 Endpoint-Tabelle aktualisieren.
- component-library-iteration-12.md §3, §6 Endpoints synchronisieren.
