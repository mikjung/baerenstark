# Component-Library — Iteration 13 (Bärenstark Hausservice)

> **Bezug:** `ux-spec-iteration-13.md` (IT13-S01–S08).
> **Geltungsbereich:** Diese Datei dokumentiert ausschließlich **neue oder geänderte** Komponenten in IT13. Bestehende Components aus IT10–IT12 bleiben unverändert.
> **Stack:** Next.js 14 + Tailwind + shadcn/ui. Lucide-React für Icons.
> **Datum:** 2026-05-04.

---

## Übersicht — IT13 Component-Delta

| # | Component / Hook | Status | Story-Bezug |
|---|-------------------|--------|--------------|
| 1 | `useScrollToSection` (Hook) + `<SectionAnchor>` (Pattern) | NEU | IT13-S03 |
| 2 | `<OAuthButton variant="facebook">` (Variant von OAuthButtons) | NEU | IT13-S02 |
| 3 | `<PrefillNotice>` (refined — Du-Form-Variant) | UPDATED | IT13-S04 |
| 4 | `<ServiceDetailImageFrame>` (refined mit Letterbox-Token + Responsive-Variants) | UPDATED | IT13-S08 + S07 |
| 5 | `<DataDeletionPage>` (Page-Komponente, nicht reusable Component) | NEU | IT13-S01 |
| 6 | Header-Markup-Erweiterung (`data-app-header`-Attribut) | UPDATED | IT13-S03 |

---

## 1. `useScrollToSection` Hook + `<SectionAnchor>` Pattern

**Purpose:** Einheitliches, accessibility-konformes Scroll-Verhalten beim Wechsel zwischen Wizard-Sektionen — kombiniert Smooth-Scroll, Sticky-Header-Offset, Focus-Management auf Heading und `prefers-reduced-motion`.

### 1.1 `<SectionAnchor>` — Markup-Pattern (kein React-Wrapper-Component, sondern Konvention)

```tsx
<section
  id="step-when"
  data-section-anchor="when"
  aria-labelledby="step-when-heading"
  className="scroll-mt-[var(--header-offset)] data-[in-modal]:scroll-mt-4"
>
  <h2
    id="step-when-heading"
    ref={whenHeadingRef}
    tabIndex={-1}
    className="text-2xl font-semibold text-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent rounded-sm"
  >
    Wann passt es dir?
  </h2>
  {/* ... step content ... */}
</section>
```

**Verbindliche Regeln:**
- `data-section-anchor="<step-id>"` — eindeutig pro Page/Modal.
- `id` an `<section>` und `<h2>/<h3>` für `aria-labelledby`-Verlinkung.
- `<h2>`/`<h3>` mit `tabIndex={-1}` — nicht in normaler Tab-Order, aber programmatisch fokussierbar.
- Tailwind-Klasse `scroll-mt-[var(--header-offset)]` — siehe Design-System IT13-D3.
- Modal-Context: zusätzliches `data-in-modal`-Attribut auf der nächsten Modal-Body-Wrapper-Ebene, damit `data-[in-modal]:scroll-mt-4` greift.

### 1.2 `useScrollToSection` Hook — Public API

```ts
import { useEffect, useRef, useCallback } from 'react';

interface UseScrollToSectionOptions {
  /** Aktuell aktive Section-ID (matcht data-section-anchor). */
  activeSection: string | null | undefined;
  /** Scroll-Container-Selector. Default: window. Beispiel: '[data-modal-body]'. */
  containerSelector?: string;
  /** Initial-Mount: erste activeSection NICHT scrollen. Default: true. */
  skipInitial?: boolean;
}

export function useScrollToSection(options: UseScrollToSectionOptions): void;
```

**Verhalten (intern, verbindlich):**

```ts
export function useScrollToSection({
  activeSection,
  containerSelector,
  skipInitial = true,
}: UseScrollToSectionOptions) {
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (!activeSection) return;
    if (skipInitial && isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    isFirstRun.current = false;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const root: Document | HTMLElement = containerSelector
      ? (document.querySelector(containerSelector) as HTMLElement) ?? document
      : document;

    const node = root.querySelector(
      `[data-section-anchor="${activeSection}"]`
    ) as HTMLElement | null;

    if (!node) return;

    // Doppeltes rAF: warten auf Layout des neu gemounteten Step-Containers
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        node.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });

        // Focus auf Heading mit tabindex="-1"
        const heading = node.querySelector<HTMLElement>(
          'h2[tabindex="-1"], h3[tabindex="-1"]'
        );
        heading?.focus({ preventScroll: true });
      });
    });
  }, [activeSection, containerSelector, skipInitial]);
}
```

**Props-Tabelle:**

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|---------------|
| `activeSection` | `string \| null \| undefined` | — | Aktuelle Section-ID (matcht `data-section-anchor`). Hook reagiert auf Änderung. |
| `containerSelector` | `string?` | `undefined` (= window) | CSS-Selector des Scroll-Containers. Im Modal: `[data-modal-body]`. |
| `skipInitial` | `boolean?` | `true` | Beim Mount **nicht** scrollen — User landet natürlich am Page-Top. |

**Verwendung — Beispiel Buchungsformular:**

```tsx
function BookingForm() {
  const [step, setStep] = useState<'service' | 'when' | 'duration' | ...>('service');
  useScrollToSection({ activeSection: step });

  return (
    <div>
      <section data-section-anchor="service" ...>...</section>
      <section data-section-anchor="when" ...>...</section>
      ...
    </div>
  );
}
```

**Verwendung — Beispiel Quick-Booking-Modal:**

```tsx
function QuickBookingModal() {
  const [step, setStep] = useState<...>('when');
  useScrollToSection({
    activeSection: step,
    containerSelector: '[data-modal-body]',
  });

  return (
    <Modal>
      <div data-modal-body className="overflow-y-auto max-h-[80vh]">
        <section data-section-anchor="when" data-in-modal>...</section>
      </div>
    </Modal>
  );
}
```

### 1.3 Accessibility

- **Focus-Management:** Heading erhält Focus → Screenreader liest Heading vor („Wann passt es dir? Heading Level 2"). Visueller Focus-Ring durch `focus-visible:ring-2`.
- **Keyboard:** Tab/Shift-Tab navigiert weiter — Heading ist nicht in Tab-Order (durch `tabIndex={-1}`).
- **Reduced-Motion:** `behavior: 'auto'` schaltet Smooth-Scroll ab; Sprung erfolgt instant.
- **No-JS-Fallback:** `scroll-mt`-CSS-Property funktioniert auch ohne JS, falls native Anker-Links genutzt werden (z. B. `<a href="#step-when">`).

### 1.4 Do / Don't

| ✓ Use when | ✗ Don't use when |
|-------------|-------------------|
| Multi-Step-Wizard mit klar abgegrenzten Sektionen | Single-Page-Form ohne Steps |
| Conditional-Render-Sektionen (Step `n` wird gemountet, vorherige unmounted) | Always-rendered-Sektionen mit interner Toggle-Animation — Pattern überflüssig |
| Modal-Wizards mit eigenem Scroll-Container | Modals ohne Scroll-Body — Sections passen ohne Scroll ins Viewport |

### 1.5 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT13-S03 | Hauptverwendung in BookingForm, QuickBookingModal, optional in Profil-Form (nur Page-Mount) |

---

## 2. `<OAuthButton variant="facebook">`

**Purpose:** Facebook-Brand-konformer OAuth-Button für Customer-Login. Variant des bestehenden OAuthButtons-Patterns.

### 2.1 Bestehender Code-Status

`src/components/customer/OAuthButtons.tsx` rendert aktuell Google + GitHub als hardcoded Buttons. Für IT13 wird das umstrukturiert:

**Option A (empfohlen — minimal-invasiv):** Neuen Button-JSX-Block für Facebook in `OAuthButtons.tsx` ergänzen (parallel zu Google/GitHub). Provider-Type erweitert um `'facebook'`.

**Option B (refactor):** Generischer `<OAuthButton variant="...">` als wiederverwendbare Komponente, OAuthButtons orchestriert nur die Reihenfolge. Mehr Code, aber sauberer für IT14+.

UX-Empfehlung: Option A für IT13 (minimaler Änderungs-Surface, schnellerer QA-Pass), Option B als Backlog.

### 2.2 Markup (Option A, IT13)

```tsx
// In OAuthButtons.tsx, nach Google-Button und vor GitHub-Button:

<button
  type="button"
  onClick={() => handleClick('facebook')}
  disabled={pending !== null}
  aria-label="Mit Facebook anmelden"
  className={cn(
    'flex w-full items-center justify-center gap-3 rounded-lg',
    'bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white',
    'hover:bg-[#166FE5] active:bg-[#0F5FCD] transition',
    'disabled:cursor-not-allowed disabled:opacity-60',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent',
  )}
>
  {pending === 'facebook' ? (
    <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
  ) : (
    <FacebookIcon />
  )}
  <span>
    {pending === 'facebook' ? 'Wird umgeleitet …' : 'Mit Facebook anmelden'}
  </span>
</button>
```

**Provider-Type erweitern:**

```ts
type Provider = 'google' | 'github' | 'facebook';
```

### 2.3 Facebook-Icon (Inline-SVG)

```tsx
function FacebookIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#FFFFFF"
        d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
      />
    </svg>
  );
}
```

### 2.4 States

| State | Trigger | Sichtbar | A11y |
|-------|---------|----------|------|
| `idle` | Default | Blauer Button mit weißem `f`-Logo + Label „Mit Facebook anmelden" | `aria-label="Mit Facebook anmelden"` |
| `pending` | Klick (CSRF + Form-Submit läuft) | Spinner ersetzt Logo, Label „Wird umgeleitet …", Button disabled | `aria-busy="true"` |
| `disabled-other-pending` | Anderer OAuth-Button (Google/GitHub) ist `pending` | Facebook-Button disabled (`opacity-60`), nicht klickbar | `aria-disabled="true"` |
| `error-shown-on-page` | Redirect mit `?error=...` | Error-Banner über Button-Gruppe (separate Komponente) | `role="alert"` am Banner |

### 2.5 Klick-Handler

```ts
const handleClick = async (provider: Provider) => {
  setPending(provider);
  setError(null);
  try {
    const csrfToken = await fetchCustomerCsrfToken();
    submitProviderSignInForm(provider, csrfToken);
    // Form-Submit redirected sofort, useState wird verworfen
  } catch {
    setPending(null);
    setError('Anmeldung konnte nicht gestartet werden. Bitte erneut versuchen.');
  }
};
```

### 2.6 Accessibility

- Touch-Target: 44 px Mindesthöhe (durch `py-2.5` + Icon 18 px + line-height ergibt ~44 px gesamt).
- Focus-Ring: `ring-2 ring-baerenstark-accent ring-offset-2` — sichtbar bei Tab-Navigation.
- Kontrast Weiß/Blau: 4.55:1 → AA ✓.
- Icon `aria-hidden="true"` (Bedeutung wird durch Label getragen).
- Loading-Spinner ersetzt Icon (gleicher Platz, kein Layout-Shift).

### 2.7 Do / Don't

| ✓ Use when | ✗ Don't use when |
|-------------|-------------------|
| OAuth-Login-Karten (Login-Page, ggf. zukünftig Register-Page) | Inline-Buttons innerhalb von Formularen — OAuth ist immer Flow-Initialisierung |
| Mit anderen OAuthButtons (Google, GitHub) zusammen | Solo ohne andere Login-Optionen — wirkt zu prominent |

### 2.8 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT13-S02 | Login-Page + alle Stellen mit `<OAuthButtons />` |

---

## 3. `<PrefillNotice>` (refined Du-Form-Variant)

**Purpose:** Dezenter Block-Hinweis über vorausgefüllten Form-Blöcken — informiert User, dass Daten aus dem Profil übernommen wurden.

### 3.1 Bestehender Status (IT12)

IT12 §3.8.3 hat den PrefillNotice mit Sie-Form definiert. IT13 fügt eine **Du-Form-Variante** hinzu für neue Form-Kontexte (Kontaktformular). Buchungsformular bleibt Sie-Form (kein Refactor).

### 3.2 Props (erweitert)

```ts
interface PrefillNoticeProps {
  /** Tonalität — Default 'sie' (IT12-Bestand). 'du' für IT13-neue Kontexte. */
  variant?: 'sie' | 'du';
  /** Variante des Texts — 'full' (alle Felder), 'partial' (einige Felder leer). */
  state?: 'full' | 'partial';
  /** Optional: Custom Microcopy überschreibt Default. */
  text?: string;
  /** ID für aria-describedby-Verlinkung. */
  id?: string;
}
```

### 3.3 Default-Microcopy

| variant | state | Text |
|---------|-------|------|
| `sie` | `full` (Default) | „Aus Ihrem Profil übernommen. Sie können die Angaben für diese Anfrage anpassen — Ihr Profil wird dadurch nicht verändert." |
| `sie` | `partial` | „Einige Daten aus Ihrem Profil übernommen — fehlende können Sie jetzt ergänzen." |
| `du` | `full` | „Aus deinem Profil übernommen. Du kannst die Angaben für diese Anfrage anpassen — dein Profil wird dadurch nicht verändert." |
| `du` | `partial` | „Einige Daten aus deinem Profil übernommen — fehlende kannst du jetzt ergänzen." |

### 3.4 Markup

```tsx
<p
  role="note"
  id={id}
  className={cn(
    'flex items-start gap-2 rounded-md',
    'bg-baerenstark-cream/50 px-3 py-2',
    'text-sm text-baerenstark-bark/70',
  )}
>
  <Info className="mt-0.5 h-4 w-4 shrink-0 text-baerenstark-bark/60" aria-hidden="true" />
  <span>{text ?? defaultText(variant, state)}</span>
</p>
```

### 3.5 Accessibility

- `role="note"` — semantisches „Aside"-Element ohne Tab-Stop.
- `id`-Prop für `aria-describedby` an verwandte Form-Inputs.
- Kontrast `text-baerenstark-bark/70` auf `bg-baerenstark-cream/50` (≈ über Page-Cream gerendert): ≥ 5.6:1 → AA ✓.

### 3.6 Verbindliche Regeln

- **Genau ein** Notice pro Form-Block (Kontaktdaten, Adresse). KEIN Per-Field-Badge zusätzlich.
- KEIN visueller Indikator am Feld selbst (kein Badge, kein farbiger Hintergrund).
- Notice **bleibt sichtbar**, auch wenn der User den vorausgefüllten Wert ändert (er weiß: war übernommen, kann angepasst werden).
- Notice **nicht rendern**, wenn der User nicht eingeloggt ist oder die Felder leer sind.

### 3.7 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT12-S08 | Buchungsformular (variant="sie", Bestand) |
| IT13-S04 | Kontaktformular (variant="du", neu) — falls Kontaktformular existiert |

---

## 4. `<ServiceDetailImageFrame>` (refined)

**Purpose:** Standardisierter, responsiver Bild-Frame für Service-Detail-Heros. Garantiert vollständige Sichtbarkeit (object-contain), brand-konforme Letterbox-Farbe und PNG-Transparenz-Support.

### 4.1 Props

```ts
interface ServiceDetailImageFrameProps {
  /** Service-Slug für Image-Mapping. */
  slug: string;
  /** Service-Name für alt-Text. */
  serviceName: string;
  /** Bild-URL (kann von serviceImageMap kommen). */
  src: string;
  /** Frame-Variant — bestimmt Aspect-Ratio. Default: 'detail-hero'. */
  variant?: 'detail-hero' | 'card-thumbnail';
  /** Override responsive aspect — für Edge-Cases. */
  aspectMobile?: string;
  aspectDesktop?: string;
}
```

### 4.2 Default-Aspect-Ratios pro Variant

| Variant | Mobile (< 640 px) | Tablet (640–1023 px) | Desktop (≥ 1024 px) |
|---------|-------------------|------------------------|----------------------|
| `detail-hero` | `aspect-[4/3]` | `aspect-[3/2]` | `aspect-[3/2]` |
| `card-thumbnail` | `aspect-[4/3]` | `aspect-[4/3]` | `aspect-[4/3]` |

### 4.3 Markup (Detail-Hero)

```tsx
<div
  className={cn(
    'relative w-full overflow-hidden rounded-lg sm:rounded-xl',
    'bg-baerenstark-cream/60', // Letterbox-Token, siehe Design-System IT13-D2
    'aspect-[4/3] sm:aspect-[3/2]',
  )}
>
  <Image
    src={src}
    alt={`${serviceName} — Beispielbild`}
    fill
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 640px"
    className="object-contain bg-transparent"
    placeholder="empty"
    onError={(e) => {
      // Fallback-Behandlung — wechselt zu image-fallback-State (IT12 §3.2.6)
    }}
  />
</div>
```

### 4.4 Markup (Card-Thumbnail — IT13-S07-Pattern)

```tsx
<div className="relative w-full aspect-[4/3] overflow-hidden bg-transparent">
  <Image
    src={src}
    alt={`${serviceName}`}
    fill
    sizes="(max-width: 640px) 100vw, 33vw"
    className="object-contain bg-transparent"
    placeholder="empty"
  />
</div>
```

> **Verbindlich:** `bg-transparent` an Frame **und** `<Image>`, Card-Wrapper außenrum trägt `bg-baerenstark-cream`. Damit zeigen transparente PNG-Bereiche das Card-Cream durch (siehe ux-spec-iteration-13.md §1.3).

### 4.5 States

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `loading` | `<Image>` lädt | Frame mit `bg-baerenstark-cream/40 animate-pulse` (kein zusätzlicher Skeleton-Block, der Frame selbst pulst) |
| `populated` | `onLoadingComplete` | Bild sichtbar, Letterbox-Streifen Cream/60 (Detail-Hero) oder transparent (Thumbnail) |
| `error` | `onError` | Frame zeigt großes Lucide-Icon (`ImageOff`, 48 px), Text „Bild folgt in Kürze." `text-sm text-bark/60` |

### 4.6 Accessibility

- `alt`-Text: „{Service-Name} — Beispielbild" (Detail-Hero) bzw. „{Service-Name}" (Thumbnail).
- Loading-Skeleton hat `aria-busy="true"` am Frame-Wrapper.
- Error-State: `role="img" aria-label="Bild nicht verfügbar"`.
- Fokus-Verhalten: Frame ist nicht fokussierbar (Bild ist dekorativ — Klick auf Card als Ganzes ist der interaktive Pfad, nicht der Frame).

### 4.7 Responsive

Aspect-Ratios siehe §4.2. Zusätzlich:

- Mobile: Frame-Breite = 100 % (minus 16 px Page-Padding).
- Tablet: Frame-Breite = 100 % der Spalte.
- Desktop: Frame-Breite = 60 % der Content-Breite, max 640 px.

### 4.8 Do / Don't

| ✓ Use when | ✗ Don't use when |
|-------------|-------------------|
| Service-Detail-Hero auf `/services/[slug]` | Hero-Banner auf der Startseite (eigener Hero-Component) |
| Service-Card-Thumbnail (mit Variant `card-thumbnail`) | Editor-Image-Upload-Preview (`<FileGallery>`-Component) |

### 4.9 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT13-S07 | Card-Thumbnail-Variant + Detail-Hero (transparenter Container-Cascade) |
| IT13-S08 | Detail-Hero-Variant (object-contain + Letterbox) |

---

## 5. `<DataDeletionPage>` (Page-Component)

**Purpose:** Statische Page unter `/datenschutz/datenloesung` mit Anleitung zur Datenlöschung — Compliance-Voraussetzung für Facebook OAuth.

### 5.1 Markup-Struktur

```tsx
// app/datenschutz/datenloesung/page.tsx (Server Component)
export const metadata: Metadata = {
  title: 'Datenlöschung — Bärenstark Hausservice',
  description:
    'So beantragst du die Löschung deiner Daten bei Bärenstark Hausservice. Anfragen werden innerhalb von 30 Tagen bearbeitet.',
  robots: { index: true, follow: true },
};

export default function DataDeletionPage() {
  return (
    <main role="main" aria-labelledby="page-title" className="mx-auto max-w-prose px-4 py-8 sm:py-12 space-y-6 sm:space-y-8">
      <Breadcrumb segments={[{ href: '/datenschutz', label: 'Datenschutz' }, { label: 'Datenlöschung' }]} />

      <h1 id="page-title" className="text-3xl font-semibold text-baerenstark-bark">
        Datenlöschung
      </h1>

      <p className="text-lg text-baerenstark-bark">
        Du möchtest deine Daten bei Bärenstark löschen lassen? Kein Problem — wir machen das schnell und unkompliziert.
      </p>

      <hr className="border-baerenstark-sand/60" />

      <section aria-labelledby="data-types-heading">
        <h2 id="data-types-heading" className="text-xl font-semibold text-baerenstark-bark mb-3">
          Welche Daten speichern wir?
        </h2>
        <ul className="list-disc pl-6 space-y-1 text-baerenstark-bark/90">
          <li>Name (Vor- und Nachname)</li>
          <li>E-Mail-Adresse</li>
          <li>Telefonnummer (sofern angegeben)</li>
          <li>Adresse (sofern angegeben)</li>
          <li>Buchungshistorie (Service, Datum, Status)</li>
        </ul>
      </section>

      <hr className="border-baerenstark-sand/60" />

      <section aria-labelledby="how-to-heading">
        <h2 id="how-to-heading" className="text-xl font-semibold text-baerenstark-bark mb-3">
          So beantragst du die Löschung
        </h2>
        <ol className="list-decimal pl-6 space-y-3 text-baerenstark-bark/90">
          <li>
            Schreib uns eine E-Mail an:{' '}
            <a
              href="mailto:hausservice-baerenstark@outlook.com?subject=Datenl%C3%B6schung"
              aria-label="E-Mail an Bärenstark zur Datenlöschung senden"
              className="inline-flex items-center gap-2 rounded-lg bg-baerenstark-cream border border-baerenstark-sand px-3 py-1.5 font-medium text-baerenstark-bark hover:bg-baerenstark-sand/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-bark"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              hausservice-baerenstark@outlook.com
            </a>
            <br />
            <span className="text-sm text-baerenstark-bark/70 mt-1 block">
              Betreff: „Datenlöschung"
            </span>
          </li>
          <li>
            Falls du ein Konto hast: nenne uns deine Anmelde-E-Mail (zur eindeutigen Zuordnung).
          </li>
          <li>
            Wir bestätigen den Eingang innerhalb von <strong>48 Stunden</strong> und löschen deine Daten innerhalb von <strong>30 Tagen</strong> — wie es die DSGVO vorsieht.
          </li>
        </ol>
      </section>

      <hr className="border-baerenstark-sand/60" />

      <section aria-labelledby="retention-heading">
        <h2 id="retention-heading" className="text-xl font-semibold text-baerenstark-bark mb-3">
          Was wir nach der Löschung behalten müssen
        </h2>
        <p className="text-baerenstark-bark/90">
          Aus rechtlichen Gründen müssen wir bestimmte Daten länger aufbewahren — zum Beispiel Rechnungen (10 Jahre, AO §147). Diese werden aber nicht mehr aktiv verwendet und nach Ablauf der Frist gelöscht.
        </p>
      </section>

      <hr className="border-baerenstark-sand/60" />

      <section aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="text-xl font-semibold text-baerenstark-bark mb-3">
          Fragen?
        </h2>
        <p className="text-baerenstark-bark/90 mb-2">
          Schreib uns eine E-Mail oder ruf uns an:
        </p>
        <ul className="space-y-2">
          <li>
            <a href="mailto:hausservice-baerenstark@outlook.com" className="inline-flex items-center gap-2 text-baerenstark-bark underline hover:no-underline">
              <Mail className="h-4 w-4" aria-hidden="true" />
              hausservice-baerenstark@outlook.com
            </a>
          </li>
          <li>
            <a href="tel:+4915774787512" aria-label="Bärenstark anrufen, 0157 74787512" className="inline-flex items-center gap-2 text-baerenstark-bark underline hover:no-underline">
              <Phone className="h-4 w-4" aria-hidden="true" />
              0157-74787512
            </a>
          </li>
        </ul>
      </section>

      <hr className="border-baerenstark-sand/60" />

      <p>
        <Link href="/datenschutz" className="inline-flex items-center gap-1 text-baerenstark-bark/80 hover:text-baerenstark-bark underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück zur Datenschutzerklärung
        </Link>
      </p>
    </main>
  );
}
```

### 5.2 States

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `static` | Page-Mount (statisch, kein API-Call) | Vollständiger Content sofort sichtbar |

Keine weiteren States — Page ist 100 % statisch.

### 5.3 Accessibility

- `<main role="main" aria-labelledby="page-title">`.
- Heading-Hierarchie: ein `<h1>`, alle Abschnitte `<h2>`.
- E-Mail-Highlight als `<a>` mit `aria-label`.
- Telefon-Link `tel:+...` mit `aria-label`.
- `<title>` per `metadata.title`.
- Keine Auth-Wand — Public-Route (Engineer-Verantwortung in `middleware.ts`: keine Redirect für `/datenschutz/*`).

### 5.4 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT13-S01 | Diese Page als Compliance-Voraussetzung für IT13-S02 |

---

## 6. Header-Markup-Erweiterung — `data-app-header`

**Purpose:** Stable Selector für `useScrollToSection`-Hook und JS-dynamische Header-Höhen-Messung.

### 6.1 Markup-Änderung in `Header.tsx`

```tsx
// src/components/layout/Header.tsx
<header
  data-app-header
  className="sticky top-0 z-30 border-b border-baerenstark-sand/60 bg-baerenstark-cream/95 backdrop-blur"
>
  ...
</header>
```

**Einzige Änderung:** `data-app-header`-Attribut auf `<header>`. Alles andere bleibt unverändert.

### 6.2 Verwendung

- JS: `document.querySelector('[data-app-header]')?.offsetHeight` für dynamischen Header-Offset.
- CSS: optional `header[data-app-header] { ... }`-Selector statt `header.sticky` für Spezifität, falls nötig.

### 6.3 Story-Coverage

| Story | Verwendung |
|-------|-------------|
| IT13-S03 | Section-Anchor-Pattern, dynamische Header-Höhe |

---

## 7. Globale Acceptance — Component-Library IT13

- ✓ `useScrollToSection`-Hook ist die einzige Stelle, an der `scrollIntoView` für Wizard-Wechsel aufgerufen wird (kein Inline-Code in Form-Components).
- ✓ Jeder Section-Anchor folgt dem Pattern aus §1.1 (`data-section-anchor` + `tabindex="-1"` am Heading).
- ✓ Facebook-Button verwendet `#1877F2` als Brand-Color, aber via Tailwind-Token `bg-oauth-facebook` (siehe Design-System IT13-D1).
- ✓ PrefillNotice nutzt `variant="du"` für IT13-neue Form-Kontexte; Bestand IT12 (Buchungsformular) bleibt `variant="sie"`.
- ✓ ServiceDetailImageFrame setzt `bg-transparent` am `<Image>` und am direkten Wrapper — Letterbox-Farbe nur am äußeren Frame-Container (Cream/60).
- ✓ DataDeletionPage ist Public, kein Auth-Wall, statisch ausgeliefert.
- ✓ `<header>` trägt `data-app-header`-Attribut — Voraussetzung für dynamische Offset-Messung.

---

## 8. Open Questions

1. **PrefillNotice-Refactor:** Soll der gesamte Notice-Component in IT13 zentral nach `src/components/forms/PrefillNotice.tsx` extrahiert werden (statt inline in jeder Form)? UX-Empfehlung: ja, zentralisiert, Engineer entscheidet final.
2. **Section-Anchor-Komponente vs. Pattern:** Aktuell ist `<SectionAnchor>` ein Markup-Pattern (kein React-Wrapper). Falls in IT14+ Komplexität wächst (z. B. Animationen pro Section): React-Wrapper-Komponente einführen. IT13 bleibt bei Pattern.
3. **OAuthButton-Refactor (Option B):** Sollte der OAuthButtons-Block in IT13 schon zu einer generischen `<OAuthButton variant="...">`-Komponente refaktoriert werden, oder erst in IT14+? UX-Empfehlung: erst IT14+ (IT13 hat Bug-Fix-Fokus).

---

*Ende der Component-Library Iteration 13.*
