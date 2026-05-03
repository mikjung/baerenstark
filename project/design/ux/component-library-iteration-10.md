# Component-Library — Iteration 10 (Bärenstark Hausservice)

> Sprache: **deutsch**. Stack: Next.js 14 + Tailwind + shadcn/ui. Brand-Tokens: `baerenstark-*` aus `tailwind.config.ts`.
> Diese Datei ergänzt bestehende Komponenten (`Banner`, `Button`, `Input`, `Badge`, `Card`, `ConfirmDialog`, `Skeleton` in `src/components/ui/`) **nicht ersetzen**, sondern **erweitern**.
> Alle Komponenten sind RSC-kompatibel oder `"use client"` wo angegeben.

---

## 1. `QuickBookingModal` (NEU, Client)

**Datei (Vorschlag):** `src/components/booking/QuickBookingModal.tsx`

### Zweck
Zeigt das Buchungsformular als Modal/Bottom-Sheet, ausgelöst durch Slot-Klick im Kalender. Kapselt `BookingForm.tsx` und reicht Slot-Daten als `defaultValues` durch.

### Variants
| Variant | Trigger | Rendering |
|---------|---------|-----------|
| `desktop-modal` | Viewport ≥ 641 px | Zentriertes Modal, fade-in, `width: min(640px, calc(100% - 48px))`. |
| `mobile-bottom-sheet` | Viewport ≤ 640 px | Bottom-Sheet, slide-up, `max-height: 92vh`, sticky-Header + sticky-Footer. |

(Variants werden via CSS Media Query gewählt — eine Komponente, zwei Layouts.)

### States
- `closed` — Modal nicht im DOM (oder `hidden`).
- `open-idle-no-service` — **(NEU IT10, fix QA STRUCT-4)** Modal mit leerem Service-Pflicht-Feld, Submit **disabled**, restliche Form aktiv. Hinweistext unter Service-Feld: „Bitte wählen Sie einen Service aus." (neutral).
- `open-idle-service-prefilled` — Service-Feld vorausgewählt (aus `defaultService`-Prop), Submit aktivierbar, restliche Form aktiv.
- `open-loading` — Submit läuft, Inputs disabled, Submit-Button mit Spinner.
- `open-validation-error` — Banner oben „Bitte prüfen Sie die markierten Felder.", Inline-Fehler an Feldern. Wenn nur Service fehlt: zusätzliche Live-Region „Bitte wählen Sie zuerst einen Service.", Fokus-Sprung auf Service-Feld.
- `open-server-error` — Banner unter Submit „Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: 0157-74787512.".
- `open-slot-taken` — Warning-Banner oben „Dieser Termin wurde inzwischen leider von jemand anderem gebucht. …", Submit-Label wechselt zu „Anderen Slot wählen". Triggert auf `409` + `subcode: 'BOOKING_SLOT_TAKEN'` (kanonisch IT10) oder Fallback `code: 'CONFLICT'` + `field: 'date'`.
- `closing-success` — Animation raus, danach Toast-Render.
- `closing-cancel` — Animation raus, kein Toast.

### Props (geändert nach QA STRUCT-4 + ARCHITECTURE_IT10 §9.2)

| Prop | Typ | Default | Pflicht | Beschreibung |
|------|-----|---------|---------|--------------|
| `isOpen` / `open` | `boolean` | `false` | ja | Steuert Sichtbarkeit (Naming aligned mit ARCHITECTURE_IT10 §9.2 — Engineer wählt finalen Namen). |
| `onClose` / `onOpenChange` | `() => void` / `(open: boolean) => void` | — | ja | Schließen-Callback (shadcn-Dialog-Convention). |
| `selectedTimeSlot` | `{ date: string; startTime: string; endTime: string; durationMinutes: number } \| null` | — | ja | Vom Kalender vorausgewählt; im Header angezeigt. |
| `defaultService` | `ServiceSlug \| null` | `null` | **nein** (geändert: ehemals Pflicht-Prop `service` entfällt) | Wenn Page-State einen Service hält (URL-Param `?service=…` oder ServiceGrid-Klick), wird er ins Modal-Form vorausgewählt. Sonst `null` → Modal startet im State `open-idle-no-service`. |
| `defaultValues` / `prefillCustomer` | `Partial<BookingFormInput>` / `{ name?, email?, phone?, street?, postalCode?, city? }` | `{}` | nein | Aus `useCustomerSession()` (US-IT10-05 Teil B). |
| `onSlotChange` | `() => void` | — | nein | Wird bei Klick auf „Anderen Slot wählen" aufgerufen. |
| `onSubmitted` / `onSubmitSuccess` | `() => void` / `(bookingId: string) => void` | — | ja | Erfolgs-Callback (Toast triggert via Parent). |

> **Geändert nach QA STRUCT-4 + ARCHITECTURE_IT10 §9.2:** Der bisherige Pflicht-Prop `service` (komplettes Service-Objekt) entfällt. Stattdessen `defaultService: ServiceSlug \| null` als optionaler Prop. Die endgültige Service-Auswahl steckt im Form-State und wird beim Submit als `serviceId` an `POST /api/bookings` übergeben (Backend-Vertrag unverändert). Service ist Pflicht-Feld **im Modal-Body**, nicht mehr Pflicht-Prop.

### Behaviour
- Initialer Fokus:
  - Wenn `defaultService === null`: Fokus auf erste Service-Radio-Option (bzw. Dropdown-Trigger).
  - Wenn `defaultService` gesetzt + Kontaktfelder leer: Fokus auf „Name".
  - Wenn alles vorausgefüllt: Fokus auf „Beschreibung".
- Submit-Button: `disabled` solange Service nicht ausgewählt ODER andere Pflichtfelder leer/invalid.
- Body-Scroll-Lock via `position: fixed` auf `<body>` (iOS-safe).
- Form-State (inkl. Service-Auswahl) persistiert über Modal-Open/Close-Cycles in einem Parent-State (Hook oder Lift-Up nach `BookingClient.tsx`).
- Bei Schließen mit `dirty`-State: Inline-Confirm im Footer „Eingaben verwerfen?" (nicht extra Dialog).
- Bei Submit-Erfolg: `onSubmitSuccess()` triggern, danach Modal animieren raus (250 ms), danach Toast rendern (im Parent), danach Slot im Kalender als belegt markieren.
- Service-Wechsel im Modal ändert NICHT die Slot-Dauer (siehe ux-spec §5.6 Service-Dauer-Mismatch-Hinweis).

### Accessibility
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="quick-booking-title"`, `aria-describedby="quick-booking-slot-info"`.
- Close-Button: `aria-label="Modal schließen"`.
- „Anderen Slot wählen"-Link: `aria-label="Anderen Slot wählen — Modal schließen"`.
- Focus-Trap aktiv (shadcn-Dialog macht das nativ; bei eigener Implementierung Fallback einbauen).
- Banner mit `role="alert"` + `aria-live="assertive"` für Server-/Slot-Fehler, `role="status"` für Success.

### Keyboard
| Key | Verhalten |
|-----|-----------|
| Tab | nächster Fokus innerhalb Modal (Wrap zurück zu Close-Button). |
| Shift+Tab | rückwärts. |
| Escape | Modal schließen (siehe Schließ-Logik). |
| Enter (in Field) | Submit (außer Textarea: Newline). |

### Microcopy
Siehe `ux-spec-iteration-10.md` §5.12.

### Do / Don't
- ✓ Verwenden, wenn der Kunde aus dem Kalender heraus direkt buchen soll (US-IT10-04).
- ✗ NICHT verwenden für Re-Booking aus Detail-Seite — dort eigene Page-Logik.

### Skizze (Mobile-360 px) — geändert nach QA STRUCT-4

```
┌────────────────────────────────┐
│        ▬▬▬ (drag-handle)       │
│ Termin anfragen           [✕]  │
│ Mo, 12.05. · 09:00–11:00       │
│ ─────────────  [↺ Slot ändern] │
├────────────────────────────────┤  ← Sticky-Header endet
│ [Banner-Slot — nur bei Fehler] │
│                                │
│ Welcher Service?               │  ← NEU (Pflicht-Feld 1)
│ ⦿ Reinigung    2 h · ab 60 €   │
│ ⦾ Entrümpelung 4 h · ab 240 €  │
│ ⦾ Gartenpflege 2 h · ab 80 €   │
│ ⦾ Hausmeister  1 h · ab 50 €   │
│ Bitte wählen Sie einen Service.│
│                                │
│ Ihre Kontaktdaten              │
│ Name *           [____________]│
│ E-Mail *         [____________]│
│ Telefon *        [____________]│
│                                │
│ Wohin sollen wir kommen?       │
│ Straße & Hausnummer *          │
│                  [____________]│
│ PLZ *  [____]  Ort * [_______] │
│                                │
│ Worum geht es?                 │
│ Beschreibung    [Textarea]     │
│ [+ Datei hinzufügen]           │
│                                │
│ ☐ Datenschutz akzeptiert *     │
├────────────────────────────────┤  ← Sticky-Footer beginnt
│ [Abbrechen]  [Anfrage absenden]│  ← Submit disabled solange Service leer
└────────────────────────────────┘
```

---

## 2. `CustomerBookingsList` (NEU, Server-Component mit Client-Filter)

**Datei (Vorschlag):** `src/components/customer/CustomerBookingsList.tsx`

### Zweck
Zeigt alle Buchungsanfragen eines eingeloggten Kunden, mit Filter-Pills, in adaptivem Layout (Cards Mobile, Tabelle Desktop).

### Variants
| Variant | Trigger | Layout |
|---------|---------|--------|
| `cards-1col` | Viewport ≤ 640 px | Eine Karte pro Anfrage, vertikal gestapelt. |
| `cards-2col` | 641–1023 px | Karten in 2-Spalten-Grid. |
| `table` | ≥ 1024 px | Tabelle: Status, Datum/Zeit, Service, Erstellt, Aktion. |

### States
- `loading` — 3 Skeleton-Cards / Skeleton-Rows.
- `populated` — Liste rendert.
- `empty` — Empty-State mit CTA „Jetzt erste Anfrage stellen".
- `empty-filtered` — Filter ohne Treffer; Sekundär-Link „Alle Anfragen anzeigen".
- `error` — Error-Block mit Retry-Button.

### Props
| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `bookings` | `Booking[]` | `[]` | Pre-fetched serverseitig oder über Hook. |
| `isLoading` | `boolean` | `false` | Triggert Skeleton-Render. |
| `error` | `string \| null` | `null` | Triggert Error-Block. |
| `onRetry` | `() => void` | — | Retry-Handler im Error-State. |
| `initialFilter` | `BookingStatus \| 'ALL'` | `'ALL'` | Default-Filter beim Mount. |

### Behaviour
- Filter-Pills oberhalb. Klick filtert clientseitig (keine Re-Fetch).
- Klick auf Card / Zeile → `router.push('/konto/anfragen/[id]')`.
- Hover-State (Desktop): leichter `shadow-card`-Lift.

### Accessibility
- `<section aria-labelledby="bookings-list-heading">` mit hidden H2.
- Cards/Tabellen-Zeilen als `<a>` mit `aria-label="Details zur Anfrage vom {Datum} ansehen"`.
- Filter-Pills: `role="tablist"` + Pfeiltasten-Navigation + `aria-selected="true"`.

### Microcopy
Siehe `ux-spec-iteration-10.md` §6.11.

### Do / Don't
- ✓ Auf `/konto` als Hauptinhalt.
- ✗ NICHT auf `/admin/users` (das ist `UserTable.tsx`).

---

## 3. `BookingStatusBadge` (NEU, Server-Component)

**Datei (Vorschlag):** `src/components/customer/BookingStatusBadge.tsx`

### Zweck
Visualisiert den Status einer Buchung mit Icon + Text + Farb-Akzent.

### Variants (6 Stück — nach QA UX-2 ergänzt um „completed")
| Variant | Backend-Code | Farbe (Token) | Icon (lucide) |
|---------|--------------|---------------|----------------|
| `pending` | `PENDING` | `feedback-warning` (amber, gedämpft) | `Clock` |
| `confirmed` | `CONFIRMED` | `feedback-success` (forest-green, brand-konform) | `CheckCircle2` |
| `rejected` | `REJECTED` | `feedback-error` (terracotta) | `XCircle` |
| `cancelled` | `CANCELLED` | `baerenstark-sand` (neutral) | `Ban` |
| `counter-proposed` | `COUNTER_PROPOSED` | `feedback-info` (blau-grau) | `RefreshCw` |
| **`completed`** (NEU IT10) | `COMPLETED` | `status-completed` — gedämpfter Holz-/Sand-Ton (Hintergrund `status-completed-bg = #EADBC0`, Text `status-completed-fg = #5C4226`). **Bewusst nicht grün** (das ist `confirmed`). | `CheckCheck` (Doppel-Häkchen) |

### States
- Single-State (Display-Only).

### Props
| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `status` | `'PENDING' \| 'CONFIRMED' \| 'REJECTED' \| 'CANCELLED' \| 'COUNTER_PROPOSED' \| 'COMPLETED'` | — | **Pflicht.** Erweitert um `'COMPLETED'`. |
| `size` | `'sm' \| 'md'` | `'md'` | `sm` für Tabellen-Zeilen, `md` für Cards. |

### Visual
```
[●  Offen]              ← amber dot + amber-toned bg + bark text
[✓  Bestätigt]          ← forest-green dot + green-toned bg + dark-green text
[✕  Abgelehnt]          ← terracotta dot + tinted bg + dark-red text
[⊘  Storniert]          ← sand dot + sand bg + bark text
[↻  Gegenvorschlag]     ← blue-grey dot + tinted bg + dark-blue text
[✓✓ Abgeschlossen]      ← wood-tone dot + wood-tinted bg + bark text  (NEU IT10)
```

- Padding: `px-2 py-1` (sm), `px-3 py-1.5` (md).
- Border-Radius: `radius-full` (Pill-Form).
- Font: `text-xs` (sm), `text-sm` (md), Weight `font-medium`.

### Accessibility
- Text ist sichtbar (nicht nur Farbe), Icon `aria-hidden="true"`.
- Im Card-Kontext nicht extra `role` (Inline-Bestandteil).
- Kontrast: alle 6 Varianten erfüllen WCAG 2.1 AA (≥ 4.5:1 für Text auf Hintergrund) — siehe `design-system-iteration-10-additions.md` Tabelle Kontraste (inkl. `status-completed-fg` auf `status-completed-bg` ≈ 8.4:1, AAA).

### Microcopy
Status-Texte: „Offen", „Bestätigt", „Abgelehnt", „Storniert", „Gegenvorschlag", „Abgeschlossen".

### Do / Don't
- ✓ Innerhalb Cards, Tabellen, Detail-Pages.
- ✗ NICHT als alleiniger Status-Indikator (Text muss immer sichtbar sein, kein „nur Farbe").

---

## 4. `PasswordResetForm` (NEU bzw. UPDATE, Client)

**Datei (Vorschlag):** `src/components/customer/PasswordResetForm.tsx` (zwei Sub-Komponenten oder ein Form mit zwei Modi).
Bestehend in IT7: `ForgotPasswordForm.tsx` und `ResetPasswordForm.tsx`. Diese Spec konsolidiert beide unter einem Schema und ergänzt UX-Härtungen für IT10.

### Variants
| Variant | Trigger / Route | Inhalt |
|---------|-----------------|--------|
| `request` | `/konto/passwort-vergessen` | Ein E-Mail-Feld, Submit „Link anfordern". |
| `set-new` | `/konto/passwort-zuruecksetzen?token=…` | Zwei Passwort-Felder, Stärke-Indikator, Submit „Passwort ändern". |

### States (beide Varianten)
- `idle`, `loading`, `success`, `error-validation`, `error-rate-limited`, `error-server`, `error-token-invalid` (nur set-new).

### Props
| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `variant` | `'request' \| 'set-new'` | — | **Pflicht.** |
| `token` | `string` | — | Nur für `set-new`, aus `?token=` Query-Param. |
| `onSuccess` | `() => void` | — | Triggert Redirect / ConfirmationCard-Switch. |

### Behaviour
- Validierungs-Timing: `onBlur` für E-Mail, `onChange` für Passwort-Stärke (sofortiges Feedback), `onBlur` für Passwort-Match.
- Bei `success` (variant=`request`): Form wird durch `<ConfirmationCard />` ersetzt + Toast (Erfolg).
- Bei `success` (variant=`set-new`): Redirect via `router.push('/konto/login?reset=success')`.
- Bei `error-token-invalid` (410): Form wird durch `<TokenInvalidCard />` (bestehend, IT7) ersetzt.
- Bei `set-new` und `?token=` ist leer / fehlt: Beim Mount sofort `<TokenInvalidCard />` zeigen, **kein** API-Call.

### Accessibility
- Pflichtfeld-Markierung mit `*` und `aria-required="true"`.
- Stärke-Indikator: Live-Region (`aria-live="polite"`) statt nur visueller Bar (UX_REVIEW-Backlog-Punkt adressiert).
- Inline-Fehler: `role="alert"` (assertive) für submit-getriebene, `aria-live="polite"` für blur-getriebene.
- Submit-Button: `aria-busy="true"` während loading.

### Microcopy
Siehe `ux-spec-iteration-10.md` §2.8.

### Do / Don't
- ✓ Verwenden für Reset-Flow.
- ✗ NICHT für Profil-Passwort-Wechsel (eigener Flow `/konto/profil` mit altem-Passwort-Feld).

---

## 5. `Toast` (NEU systemisch, Client)

**Datei (Vorschlag):** `src/components/ui/Toast.tsx` + `Toaster.tsx` (Provider).

### Zweck
Kurzlebige Statusmeldungen außerhalb des Form-Kontexts. Ergänzt das bestehende `<Banner>` (Banner ist statisch, Toast ist dismissible + auto-fade).

### Variants
| Variant | Tone-Token | Icon | Default-Duration |
|---------|-----------|------|-------------------|
| `success` | `feedback-success` | `CheckCircle2` | 4 s |
| `info` | `feedback-info` | `Info` | 5 s |
| `warning` | `feedback-warning` | `AlertTriangle` | 6 s |
| `error` | `feedback-error` | `XCircle` | 6 s |

### States
- `entering` — Slide/Fade in (200 ms).
- `visible` — Aktiv, Timer läuft.
- `paused` — Hover/Focus, Timer pausiert.
- `exiting` — Slide/Fade out (150 ms).

### Props
| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `id` | `string` | auto | Eindeutig pro Toast (für dismiss). |
| `variant` | s. o. | `'info'` | Farbe + Icon. |
| `title` | `string` | — | Optional, fett. |
| `message` | `string` | — | **Pflicht.** |
| `duration` | `number \| null` | siehe Variant | `null` = persistent (manuell dismissen). |
| `onDismiss` | `(id) => void` | — | Wird bei manuellem Schließen oder Auto-Timeout aufgerufen. |
| `action` | `{ label: string; onClick: () => void }` | — | Optional Sekundär-CTA (z. B. „Rückgängig"). |

### Behaviour
- Position: Mobile unten zentriert, Desktop oben rechts.
- Stack: max. 3 gleichzeitig, neuere ersetzen älteste bei Überlauf.
- Hover/Focus pausiert Auto-Dismiss-Timer.
- Klick auf Action-Button löst `onClick` aus + Toast verschwindet.
- Schließen-Icon (X) immer sichtbar, `aria-label="Hinweis schließen"`.

### Accessibility
- `role="status"` für `success`/`info`, `role="alert"` für `warning`/`error`.
- `aria-live="polite"` (status) / `aria-live="assertive"` (alert).
- Tastatur: Tab fokussiert Action-Button → Schließen-Button.
- Reduce-Motion: nur Opacity-Fade (keine Translate-Animation).

### API-Beispiel
```ts
import { toast } from '@/lib/toast';

toast.success('Anfrage gesendet. Wir melden uns innerhalb von 24 Stunden.');
toast.error('Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut.');
toast.info('Wir haben Ihre Daten vorausgefüllt.', { action: { label: 'Bearbeiten', onClick: ... } });
```

### Do / Don't
- ✓ Für Bestätigungen kurzlebiger Aktionen (Submit, Save, Delete).
- ✗ NICHT für kritische Fehler, die Aktion erfordern — dort `<Banner>` (persistent).
- ✗ NICHT für Form-Inline-Fehler — dort Inline-Fehler an Felder.

---

## 6. `EmptyState` (NEU oder Pattern-Doku)

**Datei (Vorschlag):** `src/components/ui/EmptyState.tsx`

### Zweck
Wiederverwendbarer Empty-State-Block für Listen-Komponenten (Anfragen, Nutzer, etc.).

### Props
| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `icon` | `React.ReactNode` | — | Lucide-Icon, 48×48 px, `baerenstark-wood`. |
| `title` | `string` | — | **Pflicht.** Headline (z. B. „Sie haben noch keine Anfragen."). |
| `body` | `string` | — | Sub-Text. |
| `cta` | `{ label: string; href?: string; onClick?: () => void }` | — | Optional Primary-Button. |
| `secondary` | `{ label: string; href?: string }` | — | Optional Sekundär-Link. |

### A11y
- `role="status"` (kein Fehlerzustand).
- Icon `aria-hidden="true"`.

### Microcopy
Siehe `ux-spec-iteration-10.md` für jede konkrete Verwendung.

---

## 7. `ErrorState` (NEU oder Pattern-Doku)

**Datei (Vorschlag):** `src/components/ui/ErrorState.tsx`

### Zweck
Wiederverwendbarer Error-Block mit Retry für Listen-Komponenten (US-IT10-02 Admin, US-IT10-05 Customer).

### Props
| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `title` | `string` | — | Pflicht. |
| `body` | `string` | — | Pflicht. |
| `onRetry` | `() => void` | — | Pflicht. Triggert Retry-Button. |
| `phoneNumber` | `string` | `'0157-74787512'` | Sekundär-Hinweis bei wiederholten Fehlern. |

### A11y
- `role="alert"`, Fokus wandert beim Mount auf Title.
- Retry-Button: `aria-label="{title} erneut laden"`.

---

## 8. Update bestehender Komponenten

### 8.1 `BookingForm.tsx` (UPDATE)

Änderungen:
- Server-Fehler-Handling: explizite Mapping-Tabelle (siehe `ux-spec-iteration-10.md` §4.2). Generischer „Interner Serverfehler"-Pfad **entfernen**.
- Reset-Button mit `ConfirmDialog` (UX_REVIEW-Major-Finding).
- Adress-Hinweis-Banner früher rendern (nicht erst am Ende — adressiert UX_REVIEW QW-2; orthogonal zu IT10, aber synergie-fähig).
- Akzeptiert neue Props: `prefillCustomer`, `disabledFields` (für Slot/Service, wenn im Modal verwendet — Slot kommt aus Header, nicht aus Form).

### 8.2 `CustomerDashboard.tsx` (UPDATE bzw. Refactor)

Aktuell ist die Anfragen-Liste in `CustomerDashboard.tsx` direkt eingebaut. Spec für IT10:
- Auslagern in `CustomerBookingsList` (siehe §2 oben).
- Empty-State bekommt Bär-/Holz-Icon statt Emoji `📋` (UX_REVIEW Minor-Finding).
- 6 Status-Badges (inkl. „Abgeschlossen", NEU IT10) statt aktuell ggf. 3.
- „Neue Anfrage stellen"-CTA prominent oben.

### 8.3 `Banner.tsx` (UPDATE — synergetisch mit QW-4)

Banner-Komponente nutzt aktuell Tailwind-Default-Farben (`red-50`, `amber-50`). Für IT10-Konsistenz mit Status-Badges + Toasts:
- Tone-Mapping auf semantische Tokens umstellen (`feedback-success`, `feedback-warning`, `feedback-error`, `feedback-info`).
- Status-Icons hinzufügen (UX_REVIEW Major-A11y-Finding: linker Akzentstreifen reicht nicht für Farbblinde).

### 8.4 `Skeleton.tsx` (kein Update nötig)

Bestehend, wird wiederverwendet für Loading-States in `CustomerBookingsList` und Admin-`UserTable`.

---

## 9. `PaginationControls` (NEU IT10, fix QA UX-1, Client)

**Datei (Vorschlag):** `src/components/ui/PaginationControls.tsx`

### Zweck
Wiederverwendbare Pagination-Steuerung für Listen (Admin-Users, Customer-Bookings) mit responsivem Verhalten: Mobile = „Mehr laden"-Button (infinite-scroll-light), Desktop = „Vor/Zurück"-Buttons + Page-Indicator.

### Variants
| Variant | Trigger | Layout |
|---------|---------|--------|
| `mobile-load-more` | Viewport ≤ 640 px | Single-Button „Weitere {n} laden" am Listenende. Bei Ende: Hinweistext statt Button. |
| `desktop-prev-next` | Viewport ≥ 641 px | Footer-Bar mit Range-Hinweis links, Zurück-Button + Page-Indicator + Vor-Button rechts. |

### States
- `idle` — Buttons aktiv (sofern Page-Boundaries es erlauben).
- `loading` — angeklickter Button mit Spinner, alle Pagination-Controls disabled.
- `boundary-reached` — Mobile: Button durch Hinweis ersetzt. Desktop: Vor- bzw. Zurück-Button disabled.

### Props
| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `currentPage` | `number` (1-based) | — | **Pflicht.** Aktuelle Page. |
| `totalPages` | `number` | — | **Pflicht.** Gesamtzahl Pages. |
| `pageSize` | `number` | `20` | Default 20 für Admin-Users + Customer-Bookings. |
| `totalItems` | `number` | — | **Pflicht.** Für Range-Hinweis „{from}–{to} von {total}". |
| `isLoading` | `boolean` | `false` | Triggert Spinner + disabled-State. |
| `onPageChange` | `(page: number) => void` | — | Desktop-Vor/Zurück-Handler. |
| `onLoadMore` | `() => void` | — | Mobile-Handler (akkumulierend). |
| `mode` | `'page-jump' \| 'load-more'` | viewport-based | Erzwingt Mode (Override für Tests). |
| `itemLabelSingular` | `string` | `'Eintrag'` | Z. B. „Kunde", „Anfrage" — wird in Microcopy eingesetzt. |
| `itemLabelPlural` | `string` | `'Einträge'` | Z. B. „Kunden", „Anfragen". |

### Behaviour
- Auf Mobile (≤ 640 px) wird `onLoadMore` genutzt; das Parent-Komponent appendiert die nächste Seite an die bestehende Liste.
- Auf Desktop (≥ 641 px) wird `onPageChange(currentPage ± 1)` genutzt; das Parent-Komponent ersetzt die Liste durch die neue Seite.
- Fokus bleibt auf dem geklickten Button (oder Hinweistext bei Ende).
- Empty-Page-Edge-Case (Page 2+ leer nach Datenänderung): Parent zeigt Mini-Empty-State; PaginationControls rendert weiterhin sichtbar mit `currentPage = 1` als Empfehlung.

### Accessibility
- Pagination-Container: `<nav aria-label="{itemLabelPlural}-Seitennavigation">`.
- Page-Status-Live-Region (im Parent, nicht in der Komponente — Komponente exposed nur die Strings): `<div role="status" aria-live="polite">Seite {n} von {total} geladen, {count} {itemLabelPlural} angezeigt.</div>` Wird nach jedem Page-Wechsel oder „Mehr laden" aktualisiert. **Pflicht (a11y-Anforderung aus QA UX-1).**
- Mobile-Button: `aria-label="Weitere {pageSize} {itemLabelPlural} laden"`. Während Loading: `aria-busy="true"`.
- Desktop-Vor-Button: `aria-label="Nächste Seite anzeigen"`. Disabled-State: `aria-disabled="true"`.
- Desktop-Zurück-Button: `aria-label="Vorherige Seite anzeigen"`.
- Reduce-Motion: kein Auto-Scroll bei „Mehr laden" — Liste wächst nach unten, User scrollt selbst.

### Microcopy (default; via Props anpassbar)

| Element | Default-Text |
|---------|--------------|
| Mobile-Button (idle) | „Weitere {pageSize} {itemLabelPlural} laden" |
| Mobile-Button (loading) | „Wird geladen…" |
| Mobile-Hinweis (Ende) | „Sie sehen alle {itemLabelPlural}." |
| Desktop-Vor-Button | „Weiter" (mit ChevronRight-Icon) |
| Desktop-Zurück-Button | „Zurück" (mit ChevronLeft-Icon) |
| Desktop-Range | „{from}–{to} von {total} {itemLabelPlural}" |
| Desktop-Page-Indicator | „Seite {n} von {total}" |

### Do / Don't
- ✓ Verwenden in Listen-Komponenten mit > 20 Einträgen Potential (`UserTable`, `CustomerBookingsList`).
- ✗ NICHT für Filter-Pills oder Tabs — andere Pattern.
- ✗ NICHT mit beiden Modes gleichzeitig — entweder „mehr laden" ODER „page-jump".

---

## 10. Storybook / Visual-QA-Checkliste

Pro neuer Komponente sollten folgende Stories existieren (Storybook oder Playwright-Snapshots):

| Komponente | Stories |
|-----------|---------|
| `QuickBookingModal` | desktop-idle-no-service, desktop-idle-service-prefilled, desktop-loading, desktop-validation-error (Service fehlt), desktop-server-error, desktop-slot-taken, mobile-bottom-sheet-idle-no-service, mobile-bottom-sheet-loading, prefilled-customer |
| `CustomerBookingsList` | loading, empty, populated-1, populated-many, empty-filtered, empty-page, error, with-pagination-mobile, with-pagination-desktop |
| `BookingStatusBadge` | pending, confirmed, rejected, cancelled, counter-proposed, **completed** × {sm, md} |
| `PasswordResetForm` | request-idle, request-loading, request-success, request-rate-limited, set-new-idle, set-new-loading, set-new-token-invalid |
| `Toast` | success, info, warning, error, mit Action, persistent |
| `EmptyState` | mit/ohne CTA, mit/ohne Icon |
| `ErrorState` | mit Retry, mit Telefon-Hinweis |
| `PaginationControls` | mobile-idle, mobile-loading, mobile-end-reached, desktop-page-1, desktop-page-middle, desktop-page-last |

---

## 11. Komponenten-Coverage-Tabelle (Story → Komponenten)

| Story | Komponenten |
|-------|-------------|
| US-IT10-01 | `PasswordResetForm` (request + set-new), `Toast` (success), `Banner` (rate-limited), bestehende `<TokenInvalidCard />` |
| US-IT10-02 | `EmptyState`, `ErrorState`, `Skeleton` (in `UserTable.tsx`), **`PaginationControls` (NEU IT10)** |
| US-IT10-03 | `BookingForm` (Update inkl. `subcode: 'BOOKING_SLOT_TAKEN'`-Mapping), `Banner` (server-error mit Telefon-CTA), `ConfirmDialog` (Reset-Schutz) |
| US-IT10-04 | `QuickBookingModal` (mit **Service-Pflicht-Feld im Body**, ehemals Header-Chip), `BookingForm` (Update für Modal-Variante), `Toast` (success), `Banner` (slot-taken via `subcode`-Mapping) |
| US-IT10-05 | `CustomerBookingsList`, `BookingStatusBadge` (**6 Varianten inkl. „Abgeschlossen"**), `EmptyState`, `ErrorState`, **`PaginationControls` (NEU IT10)**, `useCustomerProfilePrefill` Hook. **Kein** `ConfirmDialog` (Storno) mehr — out-of-scope IT10 (PM-3 Backlog). |
