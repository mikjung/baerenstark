# Component-Library — Iteration 14 (Bärenstark Hausservice)

> **Bezug:** `ux-spec-iteration-14.md` (IT14-S01–S08).
> **Geltungsbereich:** Diese Datei dokumentiert ausschließlich **neue oder geänderte** Komponenten/Patterns in IT14. Bestehende Components aus IT10–IT13 bleiben unverändert.
> **Stack:** Next.js 14 + Tailwind + shadcn/ui. Lucide-React für Icons.
> **Datum:** 2026-05-04.
>
> **Reconciliation-Update 2026-05-04 (post-QA):** Diese Datei wurde nach `QA_DESIGN_REVIEW_IT14.md` und Architect-Sync überarbeitet:
> - **C-1 PaymentMethod-Enum:** Kanonische Liste **`['CASH', 'BANK_TRANSFER']`** (synced laut Orchestrator-Direktive). `CARD`, `INVOICE`, `STRIPE` sind **entfernt**.
> - **C-2 Calendar-Link:** echte Detail-Route `/admin/bookings/[id]` statt Anker. Component-Library bestätigt URL-Format.
> - **M-S03:** Multi-Select-Pills mit `role="checkbox"` + `aria-checked` (statt `aria-pressed`).
> - **M-2:** Voller 6-Werte-Status-Enum (`PENDING, CONFIRMED, REJECTED, COUNTER_PROPOSED, CANCELLED, COMPLETED`) — kein `DONE`.
> - **NULL-Render:** Listen-Badge weglassen, Detail-Select Placeholder „— bitte wählen —".

---

## Übersicht — IT14 Component-Delta

| # | Component / Pattern | Status | Story-Bezug |
|---|----------------------|--------|--------------|
| 1 | `<BookingStatusFilterPills>` (Multi-Select-Refactor + voller 6-Enum) | UPDATED | IT14-S03 |
| 2 | `<BookingsEmptyState>` (3 Variants: default-empty, no-data, no-active-filter) | UPDATED | IT14-S03 |
| 3 | `<PriceField>` mit `<SaveFeedbackChip>` | UPDATED | IT14-S04 |
| 4 | `<PaymentMethodSelect>` (kanonisches Enum `[CASH, BANK_TRANSFER]`) | UPDATED | IT14-S05 |
| 5 | `<CalendarEventPopover>` „Buchung öffnen"-Link (echte Detail-Route + Mobile-Variant) | UPDATED | IT14-S06 |
| 6 | `<FileUpload>` Error-State-Microcopy (DE-Mapping) | UPDATED | IT14-S08 |
| 7 | `<BookingDetailPage>` (Wrapper-Layout für `/admin/bookings/[id]`) | **NEU** | IT14-S06 |

> **Ein neues NEU-Component** (`<BookingDetailPage>`) als Folge der Architect-Entscheidung, eine echte Detail-Route statt Anker zu bauen. Restliche Änderungen sind Updates an bestehenden Komponenten.

---

## 1. `<BookingStatusFilterPills>` — Multi-Select mit aktualisierten Default-Werten

**Purpose:** Top-Filter-Bar in `/admin/bookings` (und ggf. `/admin/calendar`-Filter) für Multi-Select-Status-Filter.

> **QA-Klarstellung (verbindlich):** Der heutige `BookingTable.tsx`-Code (Zeile 75) ist **Single-Select**. IT14-S03 enthält den Refactor auf **Multi-Select**. Diese Component-Spec beschreibt den Soll-Zustand nach IT14.

### 1.1 Variants

- `default` (Multi-Select-Pills, voll funktional). Einziger Variant in IT14.

### 1.2 States

| Pill-State | Trigger | Visual |
|------------|---------|--------|
| `active` | Pill ist im aktiven Filter-Set | `bg-baerenstark-bark text-baerenstark-cream`, kein Border, Solid |
| `inactive` | Pill ist nicht aktiv | `bg-transparent text-baerenstark-bark/70 border border-baerenstark-sand`, Outline |
| `hover-inactive` | Mouse-Hover auf inaktivem Pill | `bg-baerenstark-sand/20`, gleiche Schrift |
| `focus-visible` | Tastatur-Fokus | Zusätzlich `ring-2 ring-baerenstark-bark ring-offset-2` |
| `disabled` | (nicht in IT14 verwendet) | — |

### 1.3 Props (verbindlich für Implementierung)

```ts
// Verbindlich: voller 6-Werte-Enum aus prisma/schema.prisma.
// Es gibt KEIN 'DONE' — der Endwert ist 'COMPLETED'.
type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COUNTER_PROPOSED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'COMPLETED';

interface BookingStatusFilterPillsProps {
  /** Aktuell aktive Status-Werte (Multi-Select-Set). */
  value: BookingStatus[];
  /** Callback bei Toggle einer einzelnen Pill. */
  onChange: (next: BookingStatus[]) => void;
  /**
   * Default-Werte beim ersten Render. Verbindlich IT14:
   * ['PENDING', 'CONFIRMED'].
   */
  defaultValue?: BookingStatus[];
}
```

**Verbindliches Default + Toggle-Handler:**

```tsx
const DEFAULT_FILTER: BookingStatus[] = ['PENDING', 'CONFIRMED'];

function AdminBookingsPage() {
  const [filter, setFilter] = useState<BookingStatus[]>(DEFAULT_FILTER);

  const togglePill = (status: BookingStatus) => {
    setFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)  // aktive Pill → deaktivieren
        : [...prev, status]                  // inaktive Pill → aktivieren
    );
    // ... API-Call mit neuem Filter-Set
  };
  // ...
}
```

**Edge-Case „alle Pills aus":** Wenn `filter.length === 0` → Empty-State `<EmptyStateNoActiveFilter>` rendern (siehe §2.8). Liste wird nicht geladen.

### 1.4 Accessibility — Multi-Select-Semantik

> **Verbindlich (post-QA):** Pills sind **Checkboxes**, nicht Toggle-Buttons. Begründung: Multi-Select-Filter ist semantisch eine Checkbox-Gruppe; Screen-Reader sollen jede Pill als unabhängig auswählbar ankündigen.

- Container: `role="group" aria-label="Status-Filter"`.
- Jeder Pill: `<button type="button" role="checkbox" aria-checked={isActive}>` — `aria-checked` (true/false) ist der semantische Träger des Aktiv-Zustands. **Nicht** `aria-pressed`.
- Keyboard:
  - Tab navigiert zwischen Pills.
  - Enter / Space toggelt die fokussierte Pill (Checkbox-Konvention).
  - Pfeil-Links/Rechts (optional): nicht IT14-verbindlich.

### 1.5 Microcopy (DE) — voller 6-Werte-Enum

| Status-Enum | Pill-Label |
|-------------|-----------|
| `PENDING` | „Offen" |
| `CONFIRMED` | „Bestätigt" |
| `COUNTER_PROPOSED` | „Gegenvorschlag" |
| `CANCELLED` | „Storniert" |
| `REJECTED` | „Abgelehnt" |
| `COMPLETED` | „Abgeschlossen" |

### 1.6 Do / Don't

| ✓ Use when | ✗ Don't use when |
|-------------|-------------------|
| Admin-Tabellen mit klaren Status-Kategorien (Bookings, Reviews) | Single-Select-Filter (dort: Tabs oder Radio-Group mit `role="radiogroup"`) |
| 3–7 Status-Werte mit klar lesbaren Labels | > 8 Werte (dann Dropdown) |
| Multi-Select-Semantik (mehrere gleichzeitig sichtbar) | Single-Select erforderlich (z.B. Sort-Order) |

### 1.7 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT14-S03 | Multi-Select-Refactor + Default-Wert `['PENDING', 'CONFIRMED']` + voller 6-Werte-Enum mit Microcopy. |

---

## 2. `<BookingsEmptyState>` — drei Variants (Default-Empty / No-Data / No-Active-Filter)

**Purpose:** Empty-State unter der Filter-Bar in `/admin/bookings`, sichtbar wenn der aktive Filter null Buchungen liefert oder Tom alle Filter deaktiviert hat.

### 2.1 Variants

- `default-empty` — Filter aktiv, aber keine passenden Buchungen (IT14-Update).
- `no-data-at-all` — keine Buchungen in der Datenbank überhaupt (Bestand IT12, unverändert).
- `no-active-filter` — Tom hat alle Filter-Pills deaktiviert (NEU IT14, post-QA).

### 2.2 Props

```ts
interface BookingsEmptyStateProps {
  variant: 'default-empty' | 'no-data-at-all' | 'no-active-filter';
  /** Callback für „Alle Anfragen anzeigen"-CTA (Variant default-empty). */
  onShowAll?: () => void;
  /** Callback für „Standard wiederherstellen"-CTA (Variant no-active-filter). */
  onResetToDefault?: () => void;
}
```

### 2.3 Microcopy (verbindlich IT14)

| Variant | Icon | Headline | Subline | CTA |
|---------|------|----------|---------|-----|
| `default-empty` | `Inbox` | „Keine offenen Anfragen" | „Sobald eine neue Buchungsanfrage eingeht, erscheint sie hier automatisch." | „Alle Anfragen anzeigen →" (Ghost) — schaltet alle 6 Pills aktiv |
| `no-data-at-all` | `Inbox` | „Noch keine Buchungsanfragen" (Bestand) | „Wenn Kunden über das Buchungsformular eine Anfrage senden, erscheint sie hier." (Bestand) | (Bestand) |
| `no-active-filter` | `Filter` | „Wähle mindestens einen Status" | „Aktiviere oben mindestens einen Status-Filter, um Buchungen zu sehen." | „Standard wiederherstellen" (Ghost) — setzt Filter auf `['PENDING', 'CONFIRMED']` |

### 2.4 States

Statisches Layout — keine internen States. Reagiert nur auf `variant`-Prop.

### 2.5 Markup-Anhalt

```tsx
<div
  role="status"
  aria-live="polite"
  className="flex flex-col items-center justify-center gap-3 py-16 text-center"
>
  <Inbox className="h-8 w-8 text-baerenstark-bark/40" aria-hidden />
  <h2 className="text-lg font-semibold text-baerenstark-bark">
    Keine offenen Anfragen
  </h2>
  <p className="max-w-md text-sm text-baerenstark-bark/70">
    Sobald eine neue Buchungsanfrage eingeht, erscheint sie hier automatisch.
  </p>
  <button
    type="button"
    onClick={onShowAll}
    className="mt-2 inline-flex items-center gap-1 rounded-md border border-baerenstark-sand px-3 py-2 text-sm font-medium text-baerenstark-bark hover:bg-baerenstark-sand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-bark focus-visible:ring-offset-2"
  >
    Alle Anfragen anzeigen
    <ArrowRight className="h-4 w-4" aria-hidden />
  </button>
</div>
```

### 2.6 Accessibility

- Container: `role="status" aria-live="polite"`.
- Icon: `aria-hidden="true"`.
- CTA: standard `<button>`, Tab-fokussierbar.

### 2.7 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT14-S03 | `default-empty`-Variant, neue Wording + CTA „Alle Anfragen anzeigen". |

---

## 3. `<PriceField>` mit `<SaveFeedbackChip>`

**Purpose:** Endpreis-Eingabe im Admin-Booking-Detail mit klarem Save-Feedback.

### 3.1 Variants

- `inline-edit` (mit Save-Button neben Feld). Einziger Variant IT14.

### 3.2 States

| State | Trigger | Visual |
|-------|---------|--------|
| `idle` | Default | Input editierbar, Save-Button enabled |
| `dirty` | User hat Wert geändert (≠ initial) | Save-Button optisch hervorgehoben (Solid-Variant) |
| `saving` | Submit gestartet | Input disabled, Save-Button: Spinner + „Wird gespeichert …" |
| `saved` | API 200 | SaveFeedbackChip „Gespeichert" sichtbar (3 s), Input wieder enabled |
| `error-server` | API 5xx, Netzwerk | Toast (error) erscheint, Input wieder enabled, Wert bleibt erhalten |
| `error-validation` | API 400 | Inline-Fehler unter Input, Input enabled |

### 3.3 Props

```ts
interface PriceFieldProps {
  initialValue: number | null;
  onSave: (value: number | null) => Promise<void>;
  /** Pflichtfeld? Default false. */
  required?: boolean;
}
```

### 3.4 `<SaveFeedbackChip>` (NEU IT14)

**Purpose:** Kleines, ephemeres „Gespeichert"-Chip rechts neben dem Save-Button — gibt unmittelbares räumliches Feedback.

```ts
interface SaveFeedbackChipProps {
  visible: boolean;
  /** Auto-fade-out nach `durationMs` (Default 3000). */
  durationMs?: number;
  /** Variant: success (default) oder reusable für andere Save-Pattern. */
  variant?: 'success';
}
```

**Markup:**

```tsx
<span
  role="status"
  aria-live="polite"
  className={cn(
    'inline-flex items-center gap-1 rounded-full bg-feedback-success-bg px-2 py-0.5 text-xs font-medium text-feedback-success',
    'transition-opacity duration-200',
    visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
  )}
>
  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
  Gespeichert
</span>
```

**Verhalten:**
- Bei `visible=true` setzt der Parent ein `setTimeout(() => setVisible(false), 3000)`.
- Reduced-Motion: `transition-opacity` respektiert `prefers-reduced-motion` automatisch (Tailwind handhabt das nicht — Engineer fügt expliziten Check ein, falls nötig: `motion-safe:transition-opacity`).

### 3.5 Markup-Anhalt PriceField

```tsx
<div className="space-y-2">
  <label htmlFor="final-price" className="text-sm font-medium text-baerenstark-bark">
    Endpreis
  </label>
  <div className="flex items-center gap-2">
    <div className="relative flex-1">
      <input
        id="final-price"
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={state === 'saving'}
        aria-describedby="final-price-helper"
        aria-invalid={state === 'error-validation' ? 'true' : 'false'}
        className="h-11 w-full rounded-md border border-baerenstark-sand bg-white pr-8 pl-3 text-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-bark"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-baerenstark-bark/60">
        €
      </span>
    </div>
    <button
      type="button"
      onClick={handleSave}
      disabled={state === 'saving'}
      className="inline-flex h-11 items-center gap-2 rounded-md bg-baerenstark-bark px-4 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark/90 disabled:opacity-50"
    >
      {state === 'saving' ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Wird gespeichert …
        </>
      ) : (
        'Speichern'
      )}
    </button>
    <SaveFeedbackChip visible={state === 'saved'} />
  </div>
  <p id="final-price-helper" className="text-xs text-baerenstark-bark/60">
    Brutto, inkl. MwSt.
  </p>
  {state === 'error-validation' && (
    <p role="alert" className="text-sm text-feedback-error">
      Bitte einen gültigen Betrag eingeben (z. B. 150,00).
    </p>
  )}
</div>
```

### 3.6 Accessibility

- Label: explizit per `htmlFor`/`id`.
- `aria-describedby` auf Input → Helper-Text.
- `aria-invalid` bei Validation-Error.
- Inline-Fehler: `role="alert"`.
- SaveFeedbackChip: `role="status" aria-live="polite"` — Screen-Reader liest „Gespeichert" beim Erscheinen.
- Touch-Target: Input und Save-Button beide ≥ 44 px Höhe (`h-11`).

### 3.7 Keyboard

- Tab → Input → Save-Button.
- Enter im Input triggert Save (Form-Submit-Konvention).

### 3.8 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT14-S04 | PriceField mit SaveFeedbackChip; Toast-Trigger im Parent-Hook. |

---

## 4. `<PaymentMethodSelect>` — kanonisches Enum `[CASH, BANK_TRANSFER]`

**Purpose:** Dropdown im Admin-Booking-Detail (`/admin/bookings/[id]`, siehe ux-spec §5a) für Zahlungsart-Auswahl.

### 4.1 Variants

- `inline-edit` (Select + gemeinsamer oder eigener Save-Button). Einziger Variant IT14.

### 4.2 Optionen (kanonisch, verbindlich IT14)

> **Kanonische Liste (synced laut Orchestrator-Direktive — alignt mit ARCHITECTURE_IT14.md):** Nur **`['CASH', 'BANK_TRANSFER']`**. Frühere Werte (`CARD`, `INVOICE`, `STRIPE`) sind **entfernt**, weil Tom keine entsprechende Backend-Integration in der Admin-UI hat — sie würden falsche Erwartungen erzeugen.

```tsx
// Type-Definition (Single Source of Truth wäre contracts/zod-schemas.ts —
// Component-Library spiegelt den dortigen Enum):
type PaymentMethod = 'CASH' | 'BANK_TRANSFER';

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Überweisung' },  // Position 1
  { value: 'CASH',          label: 'Barzahlung' },   // Position 2
];
```

**Reihenfolge-Begründung:** Überweisung zuerst (geschäftsübliches Default), Barzahlung zweitens (häufig bei Kleinbeträgen). Anpassbar in QA, falls Tom „Bar zuerst" wünscht.

### 4.3 States

| State | Trigger | Visual |
|-------|---------|--------|
| `idle-null` | Bestand-Buchung mit `paymentMethod = NULL` | Select zeigt Placeholder „— bitte wählen —" als selected; Dirty-State erst nach echter Auswahl |
| `idle-set` | `paymentMethod` ist gesetzt | Select zeigt entsprechenden Eintrag selected |
| `saving` | Submit läuft | Select disabled |
| `saved` | API 200 | SaveFeedbackChip (siehe §3.4) sichtbar 3 s |
| `error-server` | API 5xx | Toast (error), Select-Wert bleibt auf User-Auswahl |

### 4.4 Markup-Anhalt (NULL-Handling)

```tsx
<div className="space-y-2">
  <label htmlFor="payment-method" className="text-sm font-medium text-baerenstark-bark">
    Zahlungsart
  </label>
  <select
    id="payment-method"
    value={value ?? ''}
    onChange={(e) => {
      const raw = e.target.value;
      setValue(raw === '' ? null : (raw as PaymentMethod));
    }}
    disabled={state === 'saving'}
    className="h-11 w-full rounded-md border border-baerenstark-sand bg-white px-3 text-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-bark"
  >
    {/* Placeholder nur sichtbar, wenn Wert NULL ist — nicht wieder auswählbar. */}
    <option value="" disabled hidden>
      — bitte wählen —
    </option>
    {PAYMENT_OPTIONS.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
</div>
```

> **NULL-Verhalten (verbindlich):**
> - Existing Bookings haben `paymentMethod = NULL` (Migration ohne Default).
> - Detail-Page Select rendert Placeholder „— bitte wählen —" als selected.
> - Wenn Tom eine echte Option wählt, wechselt der State von `idle-null` → `dirty`. Save überträgt den Wert.
> - **In der Liste / Karten-Render:** wenn `paymentMethod === null`, wird **kein Badge** gerendert (kein Strich, kein „nicht gesetzt"-Text). Tom erkennt am fehlenden Badge implizit, dass das Feld noch zu setzen ist.

### 4.5 Accessibility

- Label per `htmlFor`/`id`.
- `<select>`-Native-Element → volle Browser-Accessibility (Screen-Reader, Keyboard-Navigation, Touch-Target).
- Touch-Target: `h-11` (44 px).

### 4.6 Keyboard

- Pfeil-Up/Down: Optionen wechseln.
- Enter / Space: bei Native-Select öffnet sich das Dropdown.
- Tab: navigiert weiter.

### 4.7 Toast-Microcopy

| Trigger | Toast-Variant | Text |
|---------|---------------|------|
| Save success (pro-Feld-Save) | success, 4 s | „Zahlungsart gespeichert. {Label}." (z.B. „Zahlungsart gespeichert. Barzahlung.") |
| Save error | error, 5 s | „Speichern fehlgeschlagen. Bitte erneut versuchen." |

> **Hinweis:** Default in IT14 ist gemeinsamer Save-Button auf Detail-Page (siehe ux-spec §5a.3) — dann reicht ein Toast „Anfrage aktualisiert.". Pro-Feld-Toast nur falls pro-Feld-Save gewünscht ist.

### 4.8 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT14-S05 | Kanonisches Enum `['CASH', 'BANK_TRANSFER']`, NULL-Handling für Bestandsbuchungen, kein Customer-sichtbares Feld. |

---

## 5. `<CalendarEventPopover>` — „Buchung öffnen"-Link (URL-Fix + Mobile-Variant)

**Purpose:** Popover beim Klick auf Kalender-Eintrag in `/admin/calendar`. Zeigt Buchungs-Kerndaten + Link zur Detail-Page.

### 5.1 Variants

- `desktop-popover` (Bestand IT12) — Popover am Click-Punkt.
- `mobile-bottom-sheet` (Bestand IT12, falls implementiert) — Bottom-Sheet auf < 768 px. Falls nicht implementiert: Popover bleibt auch auf Mobile, mit Full-Width-Link.

### 5.2 States

| State | Trigger | Visual |
|-------|---------|--------|
| `with-booking` | Event hat `bookingId` | Vollständiger Inhalt + Link „Buchung öffnen" |
| `without-booking` | Event ohne `bookingId` (leerer Slot, Verfügbarkeits-Block) | Kein „Buchung öffnen"-Link rendern (NICHT disabled) |
| `loading` | Daten werden nachgeladen (selten) | Skeleton-Lines |

### 5.3 Link-Markup (verbindlich IT14, post-QA)

```tsx
{event.bookingId && (
  <Link
    href={`/admin/bookings/${event.bookingId}`}
    className={cn(
      'mt-3 inline-flex items-center justify-center gap-2 rounded-md',
      'border border-baerenstark-sand px-3 py-3',
      'text-sm font-medium text-baerenstark-bark',
      'hover:bg-baerenstark-sand/30 transition',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-bark focus-visible:ring-offset-2',
      'w-full md:w-auto',  // Mobile: Full-Width, Desktop: Inline
    )}
  >
    Buchung öffnen
    <ArrowUpRight className="h-4 w-4" aria-hidden />
  </Link>
)}
```

**Verbindliche URL-Konvention (post-QA, mit Architect aligned):** `/admin/bookings/{id}` (Plural) — **echte Detail-Route**. `app/admin/bookings/[id]/page.tsx` wird im Rahmen von IT14-S06 neu angelegt (Architect-Entscheidung, siehe ARCHITECTURE_IT14.md §5.3 Option B). Frühere Anker-Variante (`/admin?tab=bookings&focus=...`) ist verworfen.

Detail-Page-Layout siehe `ux-spec-iteration-14.md` §5a.

### 5.4 Accessibility

- Popover: `role="dialog" aria-label="Buchungsdetails"` (Bestand).
- Link: kein zusätzliches `aria-label` nötig — Text-Label ist eindeutig.
- Icon `aria-hidden="true"`.
- Touch-Target: `py-3` + Schrift-Line-Height ergibt ≥ 44 px Höhe; `w-full` auf Mobile.
- Tab-Order: vom Popover-Body zum Link.
- Escape schließt Popover (Bestand IT12).

### 5.5 Keyboard

- Tab navigiert in den Popover, Enter aktiviert den Link.
- Escape schließt Popover.

### 5.6 Microcopy

| Slot | Text |
|------|------|
| Link-Label | „Buchung öffnen" |
| Tooltip (optional, nur Desktop bei Hover) | (kein Tooltip — Label spricht für sich) |

### 5.7 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT14-S06 | URL-Korrektur auf `/admin/bookings/{id}`, conditional Render bei fehlender ID, Mobile-Touch-Target. |

---

## 6. `<FileUpload>` — Error-State-Microcopy (DE-Mapping)

**Purpose:** Bestehende FileUpload-Komponente (IT11/IT13) mit aktualisierter, user-freundlicher deutscher Fehler-Microcopy für Production-Failures.

### 6.1 Keine strukturelle Änderung

Die State-Maschine `idle | uploading | success | error` bleibt unverändert (siehe `component-library.md` IT11-§3 sowie `component-library-iteration-13.md` für Direct-Upload-Flow).

### 6.2 Error-Microcopy-Mapping (NEU/AKTUALISIERT IT14)

Verbindliche Übersetzungs-Tabelle: technische Error-Codes → User-Microcopy. Engineer mapt im Frontend (z.B. in `useUpload`-Hook oder `FileUpload.tsx`):

```ts
type UploadErrorCode =
  | 'BLOB_NOT_CONFIGURED'      // 503 vom Token-Endpoint
  | 'TOKEN_ENDPOINT_5XX'       // generischer Server-Fehler
  | 'BLOB_DIRECT_NETWORK'      // Direct-Upload Netzwerk-Fehler
  | 'BLOB_DIRECT_AUTH'         // Token expired/invalid
  | 'CONFIRM_FAILED'           // Confirm-Endpoint failed nach Direct-Upload
  | 'FILE_TOO_LARGE'           // > 10 MB
  | 'INVALID_TYPE';            // nicht JPEG/PNG

const ERROR_MICROCOPY: Record<UploadErrorCode, { inline: string; toast?: { variant: 'error' | 'warning'; durationMs: number } }> = {
  BLOB_NOT_CONFIGURED: {
    inline: 'Upload aktuell nicht möglich. Wir kümmern uns darum — bitte später erneut versuchen oder ohne Bild abschicken.',
    toast: { variant: 'error', durationMs: 6000 },
  },
  TOKEN_ENDPOINT_5XX: {
    inline: 'Upload fehlgeschlagen. Bitte erneut versuchen.',
    toast: { variant: 'error', durationMs: 5000 },
  },
  BLOB_DIRECT_NETWORK: {
    inline: 'Verbindung zum Bild-Speicher unterbrochen. Bitte erneut versuchen.',
    toast: { variant: 'error', durationMs: 5000 },
  },
  BLOB_DIRECT_AUTH: {
    inline: 'Upload-Sitzung abgelaufen. Bitte Datei erneut wählen.',
    toast: { variant: 'warning', durationMs: 5000 },
  },
  CONFIRM_FAILED: {
    inline: 'Bild wurde hochgeladen, konnte aber nicht zugeordnet werden. Bitte erneut versuchen.',
    toast: { variant: 'error', durationMs: 5000 },
  },
  FILE_TOO_LARGE: {
    inline: 'Datei zu groß (max. 10 MB).',
    toast: { variant: 'warning', durationMs: 5000 },
  },
  INVALID_TYPE: {
    inline: 'Dieser Dateityp wird nicht unterstützt. Erlaubt: JPEG, PNG.',
    toast: { variant: 'warning', durationMs: 4000 },
  },
};
```

### 6.3 Verbindliche Regeln

- Niemals englische Server-Codes (`BLOB_NOT_CONFIGURED`, `INTERNAL_ERROR`) im sichtbaren UI.
- Niemals Stack-Traces, niemals `Error.message` direkt.
- Optional: `X-Request-Id` aus dem Response-Header sehr klein und neutral darstellen für Support — z.B. `<span className="text-xs text-baerenstark-bark/40">Code: req_xxxx</span>` direkt unter dem Inline-Fehler. Engineer entscheidet final.

### 6.4 Inline-Fehler-Block-Markup (Aktualisierung)

```tsx
<div className="rounded-md border border-feedback-error/40 bg-feedback-error-bg/30 p-3">
  <div className="flex items-start gap-2">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-feedback-error" aria-hidden />
    <div className="flex-1 space-y-2">
      <p className="text-sm text-baerenstark-bark">
        {ERROR_MICROCOPY[errorCode].inline}
      </p>
      {requestId && (
        <p className="text-xs text-baerenstark-bark/40">Code: {requestId}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-baerenstark-bark px-3 py-1.5 text-xs font-medium text-baerenstark-cream hover:bg-baerenstark-bark/90"
        >
          Erneut versuchen
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-baerenstark-sand px-3 py-1.5 text-xs font-medium text-baerenstark-bark hover:bg-baerenstark-sand/30"
        >
          Datei entfernen
        </button>
      </div>
    </div>
  </div>
</div>
```

### 6.5 Accessibility

- Live-Region (Bestand IT11-§3.4): `<div role="status" aria-live="polite">` außerhalb der Liste, announced „{filename}: Upload fehlgeschlagen. {Microcopy}.".
- Inline-Block hat selbst keinen `role="alert"` (würde mit Live-Region kollidieren).
- Buttons: standard `<button>`, Tab-fokussierbar, ≥ 32 px Touch-Target (sekundär; Hauptpfad „Erneut versuchen" hat ≥ 32 px Höhe — Mobile-Anpassung optional auf 44 px, falls Tom es testet).

### 6.6 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT14-S08 | Error-Microcopy-Mapping für Production-Failures, Inline-Block + Toast-Pattern. |

---

## 7. `<BookingDetailPage>` — neue Page-Komponente (Layout-Wrapper)

**Purpose:** Wrapper-Page-Layout für `/admin/bookings/[id]`. Komposition aus bestehenden Sub-Komponenten + neuer Detail-spezifischer Sektionen. Vollständige UX-Spec: `ux-spec-iteration-14.md` §5a.

### 7.1 Sub-Komponenten-Komposition

| Region | Komponente(n) | Bestand / Neu |
|--------|----------------|----------------|
| Page-Header | `<PageBackLink>` (Bestand IT12) + `<h1>` + Termin-Subtext + `<StatusBadge>` (Bestand) | Bestand |
| Aktions-Bereich | `<StatusActionButtons>` (conditional pro Status) + `<PriceField>` (§3) + `<PaymentMethodSelect>` (§4) + `<SaveActionsBar>` (gemeinsam oder pro Feld) | Mix |
| Kunden-Info | `<CustomerInfoBlock>` (Read-only, plain markup) | Neu (oder aus IT11-Bestand wiederverwenden) |
| Beschreibung/Notizen | `<DescriptionBlock>` (read-only) + `<InternalNoteEditor>` (falls Schema-Feld existiert) | Mix |
| Galerie | `<AttachmentGrid>` (3-Spalten Grid mit Thumbnails) | Neu / Mix |

### 7.2 Page-States

| State | Render |
|-------|--------|
| `loading` | Skeleton: Header-Skeleton (h-8) + 3 Sektion-Skeletons (h-32 each) |
| `not-found` | Centered Empty-State: Icon `FileQuestion` (32 px), Headline „Buchung nicht gefunden", BackLink |
| `forbidden` | Centered: Icon `Lock` (32 px), Headline „Keine Berechtigung", Link zu `/admin` |
| `error-server` | Centered: Icon `AlertTriangle` (32 px), Headline „Daten konnten nicht geladen werden", Retry-Button |
| `loaded` | Voller Page-Render mit allen Sektionen |

### 7.3 Status-Action-Buttons

Conditional Rendering basierend auf `booking.status`:

```ts
const ACTIONS_BY_STATUS: Record<BookingStatus, Array<{ id: string; label: string; nextStatus: BookingStatus; variant: 'primary' | 'secondary' | 'destructive' | 'ghost' }>> = {
  PENDING: [
    { id: 'confirm',  label: 'Bestätigen',         nextStatus: 'CONFIRMED', variant: 'primary' },
    { id: 'reject',   label: 'Ablehnen',           nextStatus: 'REJECTED',  variant: 'secondary' },
    // 'counter-propose' optional — nur falls Bestand-Pattern existiert
  ],
  CONFIRMED: [
    { id: 'complete', label: 'Abgeschlossen markieren', nextStatus: 'COMPLETED', variant: 'primary' },
    { id: 'cancel',   label: 'Stornieren',              nextStatus: 'CANCELLED', variant: 'destructive' },
  ],
  COUNTER_PROPOSED: [
    // Tom kann nach Customer-Antwort manuell weiter: meist zurück zu CONFIRMED oder CANCELLED.
    // Aktionen abhängig von Bestand-State-Machine.
  ],
  // CANCELLED, REJECTED, COMPLETED: keine weiteren Aktionen (Endzustände).
  CANCELLED: [],
  REJECTED: [],
  COMPLETED: [],
};
```

**Reihenfolge auf der Page:** Primary-Action zuerst (links), Destructive zuletzt (rechts). Buttons in einer `flex flex-wrap gap-2`-Row, auf Mobile vertikal gestapelt.

### 7.4 Accessibility

- Page-`<h1>`: eindeutig pro Page (z.B. „Buchung #ab12cd · Wohnungsreinigung").
- Sektion-Headings (`<h2>`): „Aktionen", „Kunde", „Beschreibung", „Bilder".
- Status-Action-Buttons: `<button type="button">` mit klarem Label; gefährliche Aktionen (Stornieren, Ablehnen) öffnen Confirmation-Modal (Bestand IT12-Pattern).
- Skip-to-Content-Link bleibt bestand-konform.

### 7.5 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT14-S04 | `<PriceField>` im Aktions-Bereich. |
| IT14-S05 | `<PaymentMethodSelect>` im Aktions-Bereich. |
| IT14-S06 | Detail-Page selbst (Calendar-Popover-Ziel + neue Route). |

---

## 8. Globale Acceptance — Component-Library IT14

- ✓ `BookingStatusFilterPills` initialisiert mit `['PENDING', 'CONFIRMED']`, **Multi-Select** mit `role="checkbox"` + `aria-checked`, voller 6-Werte-Enum (kein `DONE`), kein localStorage-Persist.
- ✓ `BookingsEmptyState` hat drei Variants: `default-empty`, `no-data-at-all`, `no-active-filter`.
- ✓ `PriceField` zeigt nach Save success: Toast (success) + ephemerer SaveFeedbackChip „Gespeichert" 3 s; bei Server-Fehler bleibt Eingabe erhalten.
- ✓ `PaymentMethodSelect` enthält **nur** `CASH` und `BANK_TRANSFER` (kanonische Liste); NULL-Bestand zeigt Placeholder, kein Listen-Badge.
- ✓ `CalendarEventPopover` Link-URL ist `/admin/bookings/{id}` (Plural, echte Detail-Route); Button wird nicht gerendert ohne `bookingId`; Mobile-Touch-Target ≥ 44 px.
- ✓ `BookingDetailPage` (NEU) Wrapper-Layout für `/admin/bookings/[id]` mit Header, Aktions-Bereich, Kunden-Info, Beschreibung, optional Galerie.
- ✓ `FileUpload` Error-Microcopy ausschließlich auf Deutsch, niemals Server-Codes.
- ✓ Alle Komponenten respektieren bestehende Tokens aus IT10–IT13 — **keine** neuen Design-System-Tokens nötig.

---

## 9. Open Questions

1. **`<select>` vs. shadcn `<Select>`:** Falls die Detail-View bereits shadcn `<Select>` nutzt, wird das kanonische Optionen-Array dort eingefügt. Falls Native-`<select>`: ebenfalls. Engineer prüft Bestand.
2. **Gemeinsamer Save-Button vs. pro Feld:** Siehe `ux-spec-iteration-14.md` §9.3. Default IT14: gemeinsamer Save-Button auf Detail-Page mit ein Toast „Anfrage aktualisiert.".
3. **Disabled vs. nicht-rendern für „Buchung öffnen" ohne bookingId:** Spec sagt **nicht-rendern**. Falls Tom in QA konsistente Layout-Höhe wünscht, auf disabled-Variant mit Tooltip wechseln.
4. **`<InternalNoteEditor>` Bestand:** Falls `internalNote`-Feld nicht im Booking-Schema existiert, entfällt die Sektion „Interne Notiz" auf der Detail-Page. Engineer prüft.
5. **`COUNTER_PROPOSED`-Aktionen auf Detail-Page:** Welche Status-Übergänge erlaubt die Bestand-`ADMIN_ALLOWED_TRANSITIONS` von `COUNTER_PROPOSED` aus? Engineer prüft Bestand und ergänzt entsprechende Buttons.

---

*Ende der Component-Library Iteration 14.*
