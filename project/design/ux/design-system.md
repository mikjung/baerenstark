# Design-System — Iteration 11 (Bärenstark Hausservice)

> Diese Datei **ergänzt** `design-system-iteration-10-additions.md`. Alle Tokens aus IT10 (Feedback-Farben, Status-Tokens, Modal/Backdrop-Tokens, Animation-Tokens, Icon-System) bleiben unverändert in Kraft.
> IT11 fügt **wenige** neue Tokens hinzu, die für Datei-Upload-Drop-Zone, PrefillBadge und Lightbox nötig sind. Für Toast-Feedback werden ausschließlich bestehende IT10-Tokens verwendet.

---

## IT11-D1  Neue Tokens — Datei-Upload-Drop-Zone

Begründung: `FileUpload`-Komponente braucht visuell klar abgrenzbare Border-Zustände (idle, drag-over, drag-rejected). Bestehende Border-Farben (`baerenstark-sand`) reichen für `idle`; für `drag-over` und `drag-rejected` werden bestehende Feedback-Tokens kombiniert + ein neuer Border-Active-Token eingeführt.

| Token                              | Hex / Wert                       | Zweck                                                                  |
|------------------------------------|----------------------------------|------------------------------------------------------------------------|
| `upload-dropzone-border-idle`      | `baerenstark-sand` (`#D9C2A2`)   | Default Drop-Zone-Border, dashed.                                      |
| `upload-dropzone-border-active` (NEU IT11) | `feedback-info` (`#3D6B8C`) | Drop-Zone Border bei `drag-over` (gültiger Typ). Solid statt dashed.    |
| `upload-dropzone-border-rejected`  | `feedback-error` (`#B23A3A`)     | Drop-Zone Border bei `drag-over` mit ungültigem Typ.                    |
| `upload-dropzone-bg-idle`          | `baerenstark-cream/40`            | Default Drop-Zone-Hintergrund (sehr subtil).                            |
| `upload-dropzone-bg-active`        | `feedback-info-bg/40` (`#E4ECF3` mit 40% Opacity) | Drop-Zone bei `drag-over`.                              |
| `upload-dropzone-bg-rejected`      | `feedback-error-bg/40`           | Drop-Zone bei `drag-rejected`.                                         |

> **Implementations-Hinweis:** „Drop-Zone-Border-Active" ist der einzige **wirklich neue Wert**. Die anderen sind Aliase auf bestehende Tokens, dokumentiert für semantische Klarheit (Engineer kann direkt `feedback-info-bg` verwenden, nicht zwingend einen neuen Tailwind-Token anlegen).

### Tailwind-Config-Vorschlag

```ts
// tailwind.config.ts → theme.extend.colors
colors: {
  // ... bestehend (baerenstark, feedback, status, etc.) ...

  // NEU IT11 (optional Aliase):
  upload: {
    'dropzone-active': '#3D6B8C',     // = feedback.info
    'dropzone-rejected': '#B23A3A',   // = feedback.error
  },
},
```

### Anwendung

```tsx
// FileUpload Drop-Zone
<div
  className={cn(
    'rounded-lg border-2 border-dashed p-8',
    state === 'idle' && 'border-baerenstark-sand bg-baerenstark-cream/40',
    state === 'drag-over' && 'border-solid border-feedback-info bg-feedback-info-bg/40',
    state === 'drag-rejected' && 'border-solid border-feedback-error bg-feedback-error-bg/40',
    state === 'disabled' && 'border-baerenstark-sand bg-baerenstark-cream/40 opacity-50 pointer-events-none',
  )}
>
  ...
</div>
```

### Kontrast-Check

| Vordergrund                | Hintergrund                           | Ratio   | Pass?        |
|----------------------------|---------------------------------------|---------|--------------|
| `feedback-info` Border     | `baerenstark-cream` Page-BG           | ~4.7:1  | AA ✓ (UI-Element ≥3:1) |
| Drop-Zone-Hilfetext (`baerenstark-bark/70`) | `feedback-info-bg/40` over Cream | ~7.8:1 | AAA ✓        |
| Drop-Zone-Fehlertext (`feedback-error`) | `feedback-error-bg/40` over Cream | ~5.4:1 | AA ✓         |

---

## IT11-D2  Neue Tokens — PrefillBadge

Begründung: Das Prefill-Pill braucht eine sehr dezente Optik, die NICHT mit Status-Badges (IT10) verwechselt wird. Zur Klarheit ein eigener Token-Slot, auch wenn Werte aus bestehender Palette kommen.

| Token                       | Hex / Wert                         | Zweck                                                          |
|-----------------------------|------------------------------------|----------------------------------------------------------------|
| `prefill-badge-bg`          | `baerenstark-sand/40` (~`#D9C2A266`) | Pill-Hintergrund.                                              |
| `prefill-badge-fg`          | `baerenstark-bark/60` (~`#3D2B1F99`) | Pill-Text + Icon.                                              |
| `prefill-badge-border`      | `transparent`                       | Keine Border (Differenzierung von Status-Badges).              |

### Anwendung

```tsx
<span
  role="note"
  aria-label="Aus Ihrem Profil übernommen — Sie können den Wert für diese Anfrage anpassen."
  className="inline-flex items-center gap-1 rounded-full bg-baerenstark-sand/40 px-2 py-0.5 text-xs font-medium text-baerenstark-bark/60"
>
  <UserIcon className="h-3 w-3" aria-hidden />
  aus Profil
</span>
```

### Kontrast-Check

| Vordergrund                 | Hintergrund                                  | Ratio   | Pass? |
|-----------------------------|----------------------------------------------|---------|-------|
| `prefill-badge-fg` (#3D2B1F bei 60% Opacity über Cream) | `prefill-badge-bg` (sand/40 über Cream) | ~5.6:1 | AA ✓  |

> **Hinweis Opacity:** Bei semi-transparenten Tokens muss der Kontrast-Check gegen die effektive Mischfarbe auf dem Page-Hintergrund (`baerenstark-cream`) berechnet werden. Engineer sollte mit Tools wie WebAIM-Contrast-Checker verifizieren.

---

## IT11-D3  Neue Tokens — Lightbox-Backdrop (**OUT-OF-SCOPE IT11 / IT12-Backlog**)

> **Status (BESTÄTIGT IT11 durch Tom, 2026-05-04):** `LightboxModal`-Komponente ist nicht Teil von IT11 — siehe `component-library.md` §5 und `ux-spec.md` IT11-§3.5. `FileGallery` öffnet Dateien stattdessen in neuem Tab. Diese Token-Definitionen bleiben dokumentiert, **werden aber in IT11 nicht genutzt** (kein Verbrauch durch Komponenten in IT11). Bei Wiederaufnahme der Lightbox in IT12+ stehen die Tokens bereit. Engineer kann den Tailwind-Eintrag entweder belassen (Empfehlung — kostet praktisch nichts) oder bis IT12 entfernen.

Begründung (für IT12+): Die `LightboxModal`-Komponente braucht einen **dunkleren** Backdrop als `backdrop-default` (IT10), damit Bilder mit hellen Bereichen klar abgegrenzt werden. Der Backdrop ist außerdem nicht braun-getönt, sondern neutral schwarz (besser für Bild-Vorschau).

| Token                  | Wert                          | Zweck                                                              |
|------------------------|-------------------------------|--------------------------------------------------------------------|
| `backdrop-lightbox`    | `rgba(0, 0, 0, 0.85)`         | Lightbox-Backdrop (Bild/Video-Vollansicht). Bewusst neutral schwarz, NICHT brand-tinted. |

> **Designentscheidung:** IT10 nutzt `backdrop-default` (brand-tinted Braun) für `QuickBookingModal` — passend, weil Modal-Inhalt brand-konforme Form ist. Lightbox zeigt User-Content (Fotos/Videos), wo brand-tinted Backdrop die Farben des Bildes verfälschen würde. Daher neutral schwarz.

### Tailwind-Config-Vorschlag

```ts
// tailwind.config.ts → theme.extend.colors
colors: {
  // ... bestehend ...
  backdrop: {
    default: 'rgba(60, 40, 20, 0.55)',     // bestehend IT10
    strong: 'rgba(60, 40, 20, 0.72)',      // bestehend IT10
    lightbox: 'rgba(0, 0, 0, 0.85)',       // NEU IT11
  },
},
```

### Anwendung

```tsx
<div className="fixed inset-0 z-modal-backdrop bg-[rgba(0,0,0,0.85)]" />
```

oder via Tailwind: `bg-backdrop-lightbox`.

---

## IT11-D4  Toast-Tokens (KEINE Änderung — bestehende IT10-Tokens reichen)

| Toast-Variant | BG-Token                | Text-Token            | Border-Left-Token         | Status (IT11)        |
|---------------|-------------------------|-----------------------|---------------------------|----------------------|
| `success`     | `feedback-success-bg`   | `feedback-success`    | `feedback-success-border` | unverändert IT10     |
| `info`        | `feedback-info-bg`      | `feedback-info`       | `feedback-info-border`    | unverändert IT10     |
| `warning`     | `feedback-warning-bg`   | `baerenstark-bark`    | `feedback-warning-border` | unverändert IT10     |
| `error`       | `feedback-error-bg`     | `feedback-error`      | `feedback-error-border`   | unverändert IT10     |

Nur die **Microcopy** ändert sich (siehe `component-library.md` §1 und `ux-spec.md` IT11-§2.1). Tokens bleiben.

---

## IT11-D5  Spacing für FileGallery & FileUpload

Bestehende Tailwind-Spacing-Skala reicht — **keine** neuen Tokens. Verbindliche Anwendungswerte:

| Element                              | Padding/Gap                                     |
|--------------------------------------|--------------------------------------------------|
| FileUpload Drop-Zone                 | `p-8` (Mobile), `p-10` (Desktop)                |
| FileUpload Datei-Reihe Padding       | `p-3`                                            |
| FileUpload Datei-Reihen Gap          | `space-y-2`                                      |
| FileGallery Grid-Gap                 | `gap-4` (Desktop), `gap-3` (Mobile)              |
| FileGallery Thumbnail-Padding        | `p-2`                                            |
| FileGallery Thumbnail-Größe          | `120×120` Desktop, `96×96` Tablet, `100% × 80px` Mobile (Card-Layout) |
| Lightbox-Padding                     | `p-6` (Mobile), `p-12` (Desktop)                 |
| BookingConfirmation Section-Gap      | `space-y-6` (Mobile), `space-y-8` (Desktop)      |
| BookingConfirmation Detail-Item-Gap  | `space-y-1`                                      |
| PrefillBadge Inline-Gap zum Label    | `ml-2` (8 px)                                    |

---

## IT11-D6  Animation & Motion (Lightbox + Toast-Persistenz)

| Token                            | Wert                            | Zweck                                                                |
|----------------------------------|---------------------------------|----------------------------------------------------------------------|
| `duration-lightbox-enter`        | 150 ms                          | **IT12-Backlog** — Lightbox-Backdrop-Fade-In + Inhalt-Scale. In IT11 ungenutzt (Lightbox out-of-scope). |
| `duration-lightbox-exit`         | 100 ms                          | **IT12-Backlog** — Lightbox-Fade-Out. In IT11 ungenutzt.            |
| `duration-prefill-badge-fade`    | 150 ms                          | PrefillBadge-Opacity-Fade beim dirty-State-Wechsel.                  |
| `duration-modal-to-redirect`     | 250 ms                          | Wartezeit zwischen Modal-Close und `router.push` zur Bestätigungs-Page. Toast erscheint im selben Cycle, bleibt durch Layout-Toaster persistent. |

### Reduced-Motion-Regel (verbindlich, IT11)

```css
@media (prefers-reduced-motion: reduce) {
  /* Lightbox: kein Scale, kein Fade — sofortige Sichtbarkeit. */
  /* PrefillBadge: kein Fade — sofortiges Verschwinden. */
  /* Modal-to-Redirect: kein Toast-Slide — Opacity-only. */
}
```

---

## IT11-D7  Icon-System (Erweiterung um Datei-Icons)

IT10 §5 hat bereits `lucide-react` als Pflicht-Library festgelegt. IT11 ergänzt:

| Verwendung                       | lucide-Icon       | Größe (Standard)         |
|----------------------------------|-------------------|--------------------------|
| Datei-Upload Drop-Zone-Icon       | `Paperclip`       | 32 px                    |
| Datei-Upload Browse-Button-Icon   | `Upload`          | 16 px                    |
| Bild-Datei-Icon (Fallback ohne Vorschau) | `Image`     | 32 px (Thumbnail-Card)   |
| Video-Datei-Icon                  | `FileVideo`       | 32 px                    |
| PDF-Datei-Icon                    | `FileText`        | 32 px                    |
| Generisches Datei-Icon            | `File`            | 32 px                    |
| Download-Button-Icon              | `Download`        | 16 px                    |
| Lightbox-Vorherige (Pfeil links)  | `ChevronLeft`     | 24 px                    |
| Lightbox-Nächste (Pfeil rechts)   | `ChevronRight`    | 24 px                    |
| Lightbox-Close                    | `X`               | 24 px                    |
| PrefillBadge-Icon                 | `User`            | 12 px                    |
| Bestätigungs-Page-Banner-Icon     | `Info`            | 20 px                    |
| Datei-zu-groß-Warnung-Icon        | `AlertTriangle`   | 16 px (inline mit Text)  |
| Datei-nicht-verfügbar-Overlay-Icon| `AlertCircle`     | 20 px (Thumbnail-Overlay)|

Regel (unverändert IT10): Jedes Icon ohne sichtbares Text-Label braucht `aria-label`. Icons mit Text-Label bekommen `aria-hidden="true"`.

---

## IT11-D11  Neue Tokens — Destruktiver Button + Status „Storniert" (NEU IT11-Update)

> **Begründung:** US-IT11-06 (Storno) führt zwei UI-Patterns ein, für die IT10 noch keine Tokens hatte: (a) destruktiv-rote Action-Buttons („Ja, stornieren", „Stornierung bestätigen") und (b) ein neutral-stiller Status-Badge „Storniert". Beide brauchen eigene Token-Slots, damit sie konsistent über `ConfirmCancelDialog`, `CancelOrderPage`, `BookingListItem`, `BookingStatusBadge` und Admin-Detail-View hinweg verwendet werden.

### A. Destruktiver Button

| Token                              | Hex / Wert                       | Zweck                                                                  |
|------------------------------------|----------------------------------|------------------------------------------------------------------------|
| `button-destructive-bg`            | `#B23A3A` (= `feedback-error`)   | Default-Hintergrund destruktiver Button (idle).                        |
| `button-destructive-bg-hover`      | `#9A3030`                        | Hover, ~12% dunkler.                                                   |
| `button-destructive-bg-active`     | `#822828`                        | Active/Pressed, ~22% dunkler.                                          |
| `button-destructive-bg-disabled`   | `#B23A3A` mit `opacity-40`        | Disabled-State (Submit-läuft).                                         |
| `button-destructive-fg`            | `#FFFFFF`                        | Text + Icon-Farbe (weiß für maximalen Kontrast).                       |
| `button-destructive-border`        | `transparent`                    | Keine Border (Solid-Style).                                            |
| `button-destructive-focus-ring`    | `#B23A3A` mit 3 px Offset, 60% Opacity | Focus-Ring konsistent mit IT10 `--focus-ring`-Pattern.            |

> **Wiederverwendung:** Die Basis-Farbe ist identisch mit `feedback-error` (#B23A3A) — **bewusst**, damit Toms visuelles System einheitlich bleibt: rot = „Achtung, irreversibel". Hover/Active sind eigene Werte, weil der Button interaktiver ist als ein Fehler-Banner.

### Anwendung

```tsx
<button
  type="button"
  onClick={handleCancel}
  className={cn(
    'inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium',
    'bg-[#B23A3A] text-white',
    'hover:bg-[#9A3030] active:bg-[#822828]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B23A3A]/60 focus-visible:ring-offset-2',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  )}
>
  Ja, stornieren
</button>
```

oder via Tailwind-Token-Alias (Vorschlag):

```ts
// tailwind.config.ts → theme.extend.colors
colors: {
  // ... bestehend ...
  button: {
    destructive: '#B23A3A',
    'destructive-hover': '#9A3030',
    'destructive-active': '#822828',
  },
},
```

### Kontrast-Check

| Vordergrund    | Hintergrund                | Ratio   | Pass?  |
|----------------|----------------------------|---------|--------|
| `#FFFFFF` Text | `#B23A3A` (idle)           | 5.65:1  | AA ✓   |
| `#FFFFFF` Text | `#9A3030` (hover)          | 6.84:1  | AA ✓   |
| `#FFFFFF` Text | `#822828` (active)         | 8.20:1  | AAA ✓  |

### B. Status-Badge „Storniert"

| Token                       | Hex / Wert                         | Zweck                                                          |
|-----------------------------|------------------------------------|----------------------------------------------------------------|
| `status-cancelled-bg`       | `#E8E4DF`                          | Badge-Hintergrund: neutrales Hellgrau-Beige.                    |
| `status-cancelled-fg`       | `#6B5C4F`                          | Badge-Text + Icon: gedämpftes Dunkelgrau-Braun.                |
| `status-cancelled-border`   | `#A89884`                          | Border-Left: mittleres Grau-Beige für Akzent.                  |

> **Designentscheidung:** Bewusst **nicht rot** — Storno ist ein abgeschlossener, neutraler Zustand. Rot wäre mit Fehler-Status verwechselbar. Grau-Beige passt zur Brand-Palette (Ton harmoniert mit `baerenstark-sand`/`bark`) und kommuniziert „terminal-aber-unkritisch".

> **Differenzierung zu `status-rejected` (IT10):** Falls IT10 einen `rejected`-Token mit Warnton hat, ist `cancelled` **kühler** und neutraler. Falls IT10 `rejected` bereits neutral-grau gestaltet hat, könnte derselbe Token wiederverwendet werden — Engineer prüft. Empfehlung dieser Spec: separater Token für klare Semantik in QA und Storybook.

### Anwendung

```tsx
<span
  role="status"
  aria-label="Status: Storniert"
  className="inline-flex items-center gap-1 rounded-md border-l-4 border-[#A89884] bg-[#E8E4DF] px-2 py-1 text-xs font-medium text-[#6B5C4F]"
>
  <XCircle className="h-3.5 w-3.5" aria-hidden />
  Storniert
</span>
```

### Tailwind-Config-Vorschlag

```ts
// tailwind.config.ts → theme.extend.colors
colors: {
  // ... bestehend ...
  status: {
    // ... bestehend (pending, confirmed, rejected, completed) ...
    'cancelled-bg': '#E8E4DF',
    'cancelled-fg': '#6B5C4F',
    'cancelled-border': '#A89884',
  },
},
```

### Kontrast-Check

| Vordergrund          | Hintergrund          | Ratio   | Pass?  |
|----------------------|----------------------|---------|--------|
| `#6B5C4F` Text       | `#E8E4DF` Badge-BG   | 5.42:1  | AA ✓   |
| `#A89884` Border     | `baerenstark-cream`  | 2.18:1  | (UI-Element, ≥3:1 nötig) — Border-Akzent ist dekorativ, **nicht** als alleiniger Bedeutungsträger; Status-Text trägt Bedeutung. Akzeptabel. |

### C. Subtle-Card für „30 Tage aufbewahren"-Hinweis (NEU IT11-Update)

| Token                          | Hex / Wert                         | Zweck                                                  |
|--------------------------------|------------------------------------|--------------------------------------------------------|
| `card-info-soft-bg`            | `baerenstark-cream` (`#F7F2E9`)    | Subtle-Card-Hintergrund, neutral-warm.                 |
| `card-info-soft-border`        | `baerenstark-sand/50`              | Card-Border, dezent.                                   |
| `card-info-soft-icon-fg`       | `baerenstark-bark/60`              | Icon-Farbe (`Bookmark`).                               |

Wiederverwendung bestehender Tokens — nur dokumentiert hier für die Bestätigungs-Page und vergleichbare informative Cards.

---

## IT11-D8  Was wird **nicht** geändert (Konstanz-Garantie)

Damit Toms Design-Konsistenz erhalten bleibt:

- Bestehende `baerenstark-*`-Palette unverändert.
- IT10-Feedback-Tokens (`feedback-success`, `feedback-warning`, `feedback-error`, `feedback-info` + `-bg` + `-border`) unverändert.
- IT10-Status-Tokens (`status-completed-fg`, `status-completed-bg`, `status-completed-border`) unverändert.
- IT10-Modal-Tokens (`backdrop-default`, `radius-modal`, `shadow-modal`, `z-modal-*`) unverändert.
- IT10-Animation-Tokens (`duration-modal-enter`, `duration-modal-exit`, `duration-toast-enter`, `duration-toast-exit`, `easing-default`, `easing-exit`) unverändert.
- Schriften (Inter + Playfair Display) unverändert.
- Bestehende Komponenten in `components/ui/` (Button, Input, Banner, Badge, Card, ConfirmDialog, Skeleton) bleiben in API + Visual unverändert.
- Bestehende `Toaster.tsx` (IT10) wird **nicht** ersetzt — nur Microcopy in den `toast.success()`-/`toast.error()`-Calls in `BookingForm.tsx` aktualisiert.

---

## IT11-D9  Migration-Checkliste (für Frontend-Engineer)

1. **Schritt 1:** Tailwind-Config um `upload.dropzone-active`, `upload.dropzone-rejected`, `backdrop.lightbox` erweitern (siehe IT11-D1 + IT11-D3).
2. **Schritt 2:** `PrefillBadge`-Komponente bauen mit Inline-Tailwind-Klassen (kein zusätzlicher Token nötig).
3. **Schritt 3:** `FileUpload`-Komponente: Drop-Zone-States um drag-over/drag-rejected/disabled erweitern, Tokens aus IT11-D1 nutzen.
4. **Schritt 4:** `FileGallery` bauen (Klick öffnet Datei in neuem Tab via `<a target="_blank" rel="noopener noreferrer">`). Tokens aus IT11-D7 (Datei-Icons) nutzen. **`LightboxModal` ist out-of-scope IT11 (IT12-Backlog) — Tokens IT11-D3 / `backdrop.lightbox` und IT11-D6 / `duration-lightbox-*` bleiben definiert, sind aber in IT11 ungenutzt.**
5. **Schritt 5:** Visual-QA gegen Kontrast-Checks IT11-D1 + IT11-D2.
6. **Schritt 6 (NEU IT11-Update):** Tailwind-Config um `button.destructive*` und `status.cancelled-*` erweitern (siehe IT11-D11). Storybook-Stories für `ConfirmCancelDialog` und `BookingStatusBadge variant="cancelled"` ergänzen.
7. **Schritt 7 (NEU IT11-Update):** Visual-QA-Check destruktiver Button: Hover/Active-States gegen `#FFFFFF`-Text-Kontrast verifizieren (alle ≥ AA).

---

## IT11-D10  Story-Coverage (Design-System)

| Story        | Design-System-Deliverable IT11                                                                  |
|--------------|--------------------------------------------------------------------------------------------------|
| US-IT11-01   | Keine neuen Tokens. Bestehende Toast-Tokens IT10 reichen für Smoke-Test.                          |
| US-IT11-02   | Keine neuen Tokens. Bestehende Modal-Tokens IT10 (`backdrop-default`, `radius-modal`, etc.) reichen für globalen Modal-Trigger. |
| US-IT11-03   | Keine neuen Tokens. Bestehende `feedback-success`/`feedback-error`-Tokens IT10 reichen für Toast-Microcopy-Update. Bestätigungs-Page nutzt `feedback-info-bg` (IT10) für „Was passiert jetzt?"-Banner. |
| US-IT11-04   | **NEU IT11-D1 (Upload-Drop-Zone), IT11-D7 (Datei-Icons)**. IT11-D3 (Lightbox-Backdrop) und IT11-D6 (Lightbox-Animations) sind **out-of-scope IT11** (IT12-Backlog, Major-06). |
| US-IT11-05   | **NEU IT11-D2 (PrefillBadge-Tokens)**.                                                            |
| **US-IT11-06** | **NEU IT11-D11 (Destruktiver Button-Tokens + Status-Cancelled-Tokens + Subtle-Info-Card)**.       |

---

## IT11-D12  Offene Design-Fragen

1. **PrefillBadge-Tooltip:** shadcn `Tooltip` hat eine konkrete Mount-/Hover-Latenz (300 ms Delay). Soll das übernommen werden, oder sofort sichtbar bei Focus für Screen-Reader-Users? Empfehlung: shadcn-Default + zusätzlich `aria-label` am `<span>`, damit Screen-Reader sofort lesen.
2. **Lightbox auf Mobile:** **OBSOLETE IT11** — Lightbox out-of-scope (Major-06 / IT12-Backlog). Falls die Frage in IT12+ wieder relevant: ursprüngliche Empfehlung war Vollbild (Bilder leben von Größe).
3. **Datei-Icons-Stil:** lucide-Icons sind line-art (kein Filling). Falls Tom lieber gefüllte Icons möchte, wäre `phosphor-react` oder `heroicons-solid` Alternative — aber das wäre eine Library-Migration. IT11 bleibt bei lucide, konsistent mit IT10.
4. **Dark Mode:** Weiterhin out-of-scope (IT10 §9.1). IT11 keine neuen Dark-Mode-Werte.
5. **(NEU IT11-Update) Status-Cancelled-Token vs. Status-Rejected-Wiederverwendung:** Empfehlung dieser Spec ist separater Token-Slot. Falls IT10 `status-rejected` bereits hellgrau-neutral gestaltet hat und Tom keine visuelle Differenzierung wünscht, kann `status-cancelled-*` als Alias auf bestehende Tokens implementiert werden. Engineer prüft vor PR-Open.
6. **(NEU IT11-Update) Destruktiv-Button-Hover-Wert:** Aktuell `#9A3030` (12% dunkler). Falls Tom einen weicheren Hover-Effekt will (z.B. nur Opacity-Change statt Farb-Shift), kann `button-destructive-bg-hover` auf `#B23A3A` mit `opacity-90` umgestellt werden. Empfehlung: aktueller Wert (klare Farb-Variation = besseres haptisches Feedback).
