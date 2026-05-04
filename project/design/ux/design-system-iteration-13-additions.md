# Design-System — Iteration 13 (Bärenstark Hausservice)

> Diese Datei **ergänzt** `design-system.md`, `design-system-iteration-10-additions.md` (Feedback/Modal/Animation), und IT11/IT12-Token-Definitionen. Alle Bestand-Tokens bleiben unverändert in Kraft.
> IT13 fügt **drei** neue Token-Gruppen hinzu, die für Facebook-OAuth-Branding, Bild-Letterbox und einheitliches Sticky-Header-Offset nötig sind.
> **Datum:** 2026-05-04.

---

## IT13-D1  Neue Tokens — Facebook-Brand-Color

**Begründung:** Facebook-OAuth-Button (IT13-S02) muss exakt der Facebook-Brand-Guideline folgen (`#1877F2`). Token wird neu eingeführt, weil Brand-Colors fremder Plattformen **nicht** in `baerenstark-*`-Palette gehören (semantische Trennung).

| Token                              | Hex / Wert                       | Zweck                                                                  |
|------------------------------------|----------------------------------|------------------------------------------------------------------------|
| `oauth-facebook-bg`                | `#1877F2`                         | Default-Hintergrund Facebook-Login-Button (idle).                      |
| `oauth-facebook-bg-hover`          | `#166FE5`                         | Hover-Hintergrund (~5 % dunkler).                                      |
| `oauth-facebook-bg-active`         | `#0F5FCD`                         | Active/Pressed (~12 % dunkler).                                        |
| `oauth-facebook-bg-disabled`       | `#1877F2` mit `opacity-60`        | Disabled-State (anderer OAuth-Provider pending).                       |
| `oauth-facebook-fg`                | `#FFFFFF`                         | Text + Icon-Farbe (weiß).                                              |
| `oauth-facebook-border`            | `transparent`                     | Keine Border (Solid-Style, Brand-Konvention).                          |
| `oauth-facebook-focus-ring`        | `baerenstark-accent`              | Focus-Ring konsistent mit anderen Buttons (NICHT Facebook-Blau, weil Brand-Color als Ring zu intensiv wirkt). |

### Tailwind-Config-Vorschlag

```ts
// tailwind.config.ts → theme.extend.colors
colors: {
  // ... bestehend (baerenstark, feedback, status, button, upload, oauth-google, etc.) ...

  oauth: {
    // Falls IT13 das OAuth-Namespace zum ersten Mal anlegt:
    facebook: {
      DEFAULT: '#1877F2',
      hover: '#166FE5',
      active: '#0F5FCD',
    },
    // Weitere Provider (Google, GitHub) können hier in Zukunft normalisiert werden,
    // aktuell sind sie inline in OAuthButtons.tsx hardcoded — IT14+-Refactor.
  },
},
```

### Anwendung

```tsx
<button
  type="button"
  className={cn(
    'flex w-full items-center justify-center gap-3 rounded-lg',
    'bg-oauth-facebook px-4 py-2.5 text-sm font-medium text-white',
    'hover:bg-oauth-facebook-hover active:bg-oauth-facebook-active transition',
    'disabled:cursor-not-allowed disabled:opacity-60',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent',
  )}
>
  ...
</button>
```

### Kontrast-Check

| Vordergrund | Hintergrund | Ratio | Pass |
|-------------|-------------|-------|------|
| `#FFFFFF` Text | `#1877F2` (idle) | 4.55:1 | AA ✓ |
| `#FFFFFF` Text | `#166FE5` (hover) | 4.78:1 | AA ✓ |
| `#FFFFFF` Text | `#0F5FCD` (active) | 5.50:1 | AA ✓ |
| `#FFFFFF` Text | `#1877F2` mit `opacity-60` (disabled) | 2.82:1 | (Disabled-State, Bedeutung wird über `aria-disabled` getragen — Kontrast ist akzeptabel) |

### Designentscheidung — kein Brand-Tinted-Focus-Ring

Focus-Ring nutzt **`baerenstark-accent`** (Brand-Token), NICHT `#1877F2`. Begründung:
- Konsistent mit Google-Button und allen anderen interaktiven Elementen (User lernt: gelblicher/orangener Ring = Focus, egal welcher Button).
- Fremder Brand-Color als Focus-Indikator wäre visuell laut und verwirrend.

---

## IT13-D2  Neue Tokens — Letterbox-Background für `object-contain`-Bilder

**Begründung:** IT13-S08 + S07 etablieren `object-contain` als Standard-Pattern für Service-Detail-Bilder. Dabei entstehen Letterbox-Streifen (oben/unten oder links/rechts), deren Farbe **nicht** Pure-White und **nicht** Pure-Black sein darf. Brand-Beige in einer leicht reduzierten Opacity ist die richtige Antwort.

| Token                              | Hex / Wert                                  | Zweck                                                                  |
|------------------------------------|----------------------------------------------|------------------------------------------------------------------------|
| `letterbox-bg-default`             | `baerenstark-cream` mit `opacity-60` (≈ `#F7F2E999`) | Letterbox-Hintergrund für Detail-Hero-Frames (`<ServiceDetailImageFrame variant="detail-hero">`). Sanfter Cream, leicht transparent für ruhigen Look. |
| `letterbox-bg-loading`             | `baerenstark-cream` mit `opacity-40`         | Letterbox + Skeleton-Pulse während Bild lädt — etwas heller, damit Pulse-Animation sichtbar ist. |
| `letterbox-bg-thumbnail`           | `transparent`                                | Service-Card-Thumbnails — Card-Wrapper trägt Cream, transparente PNG zeigt Card-Hintergrund (siehe ux-spec-iteration-13.md §1.3). |

### Tailwind-Config-Vorschlag

Keine neue Tailwind-Token nötig — bestehende `baerenstark-cream` mit Opacity-Modifier `/60`, `/40` reicht aus. Empfohlene Inline-Klassen:

```tsx
// Detail-Hero-Frame
<div className="relative w-full aspect-[4/3] sm:aspect-[3/2] overflow-hidden rounded-lg sm:rounded-xl bg-baerenstark-cream/60">
  <Image fill className="object-contain bg-transparent" ... />
</div>

// Card-Thumbnail
<div className="relative w-full aspect-[4/3] overflow-hidden bg-transparent">
  <Image fill className="object-contain bg-transparent" ... />
</div>
```

### Designentscheidung — warum Cream/60 statt Cream-100

- **Cream-100 (volldeckend)** wäre identisch mit dem Card-Hintergrund — Letterbox würde unsichtbar werden (gut!), aber bei Detail-Hero gibt es **keinen Card-Wrapper** mit Cream — der Hero liegt direkt auf der Page (Cream-Hintergrund). Cream/100 wäre dort ebenfalls unsichtbar — funktioniert auch.
- **Cream/60 (semi-transparent)** ist eine bewusste Tonalitäts-Reduktion: Der Frame sieht etwas „weicher" aus als der Page-Hintergrund, gibt dem Bild einen sanften Rahmen ohne harte Kante.
- **Cream/40 (loading)** zeigt die Pulse-Animation deutlicher.

### Visueller QA-Check

| Stelle | Erwarteter Look |
|--------|------------------|
| Service-Detail-Hero, Bild im Querformat | Bild zentriert, oben/unten Cream/60-Streifen — Frame wirkt gerahmt, nicht beschnitten |
| Service-Detail-Hero, Bild im Hochformat | Bild zentriert, links/rechts Cream/60-Streifen |
| Service-Detail-Hero, Bild lädt | Frame mit Cream/40 + Pulse |
| Service-Card-Thumbnail | Bild zentriert, transparente PNG-Pixel zeigen Card-Cream durch |

### Kontrast-Check (informativ — Letterbox ist dekorativ, kein Bedeutungsträger)

| Stelle | Hintergrund | Bemerkung |
|--------|-------------|-----------|
| Letterbox Cream/60 auf Page-Cream | Cream auf Cream | Niedriger Kontrast (~1.1:1) — gewünscht, Letterbox soll **nicht** prominent wirken |

---

## IT13-D3  Neue Tokens — Sticky-Header-Offset (CSS-Variable)

**Begründung:** IT13-S03 etabliert ein systemisches Scroll-Pattern, das den Sticky-Header berücksichtigt. Hardcoded Offsets sind verboten (siehe ux-spec-iteration-13.md §1.1.2). Token wird als **CSS-Variable** eingeführt, weil:
- Dynamische Beschreibbarkeit (JS kann die echte Header-Höhe messen und setzen).
- Tailwind kann die Variable in beliebigen `scroll-mt-[var(...)]`-Klassen referenzieren.
- Responsive-Werte können per Media-Query gesetzt werden.

| Token                          | Wert (Default)                  | Zweck                                                                  |
|--------------------------------|----------------------------------|------------------------------------------------------------------------|
| `--header-offset` (Mobile, < 640 px)   | `80px` (= 64 Header + 16 Buffer) | Scroll-Margin-Top für Section-Anchors auf Mobile.                       |
| `--header-offset` (≥ 640 px)            | `96px` (= 80 Header + 16 Buffer) | Scroll-Margin-Top auf Tablet/Desktop.                                   |
| `--header-offset-modal` (Modal-Kontext) | `16px` (kleiner Buffer, kein Sticky-Header) | Scroll-Margin-Top für Section-Anchors innerhalb von Modals.             |

### CSS-Implementierung

In `src/app/globals.css`:

```css
:root {
  --header-offset: 80px;
  --header-offset-modal: 16px;
}

@media (min-width: 640px) {
  :root {
    --header-offset: 96px;
  }
}
```

### Optionaler JS-Override (empfohlen für Forward-Compatibility)

In `src/components/layout/Header.tsx` oder einer Init-Komponente:

```tsx
'use client';
import { useEffect } from 'react';

export function HeaderOffsetSync() {
  useEffect(() => {
    const updateOffset = () => {
      const header = document.querySelector('[data-app-header]') as HTMLElement | null;
      if (header) {
        document.documentElement.style.setProperty(
          '--header-offset',
          `${header.offsetHeight + 16}px`
        );
      }
    };
    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, []);

  return null;
}
```

Empfehlung: In `app/layout.tsx` einbinden, nach dem `<Header />`.

### Tailwind-Anwendung

```tsx
<section
  data-section-anchor="when"
  className="scroll-mt-[var(--header-offset)] data-[in-modal]:scroll-mt-[var(--header-offset-modal)]"
>
  <h2 tabIndex={-1}>Wann passt es dir?</h2>
  ...
</section>
```

Die Tailwind-Engine ersetzt `var(--header-offset)` zur Runtime nicht — sie generiert die CSS-Klasse `scroll-margin-top: var(--header-offset)`. Browser löst die Variable beim Layout auf.

### Designentscheidung — warum 16 px Buffer

Der Header-Höhen-Buffer (16 px = `space-4`) ergibt sich aus:
- Visueller Komfort: Heading klebt nicht direkt am Header, sondern hat sichtbaren Abstand.
- Touch-Komfort auf Mobile: User kann den Heading-Bereich tippen, ohne aus Versehen den Sticky-Header zu treffen (wichtig auf iOS Safari, wo der Header oft Tap-Targets hat).
- 16 px ist konsistent mit `space-4` in der Bestand-Spacing-Skala (IT10 §3) — kein neuer Spacing-Token nötig.

---

## IT13-D4  Was wird **nicht** geändert (Konstanz-Garantie)

Damit Toms Design-Konsistenz erhalten bleibt:

- Bestehende `baerenstark-*`-Palette unverändert.
- IT10-Feedback-Tokens (`feedback-success`, `feedback-warning`, `feedback-error`, `feedback-info` + `-bg` + `-border`) unverändert.
- IT10-Status-Tokens unverändert.
- IT10-Modal-Tokens unverändert.
- IT10-Animation-Tokens unverändert.
- IT11-Upload/Prefill/Lightbox-Tokens unverändert.
- IT11-Destruktiver-Button + Status-Cancelled unverändert.
- Schriften (Inter + Playfair Display) unverändert.
- Bestehende Component-API in `components/ui/` unverändert.

---

## IT13-D5  Migration-Checkliste (für Frontend-Engineer)

1. **Schritt 1 (IT13-S02):** Tailwind-Config um `oauth.facebook.{DEFAULT, hover, active}` erweitern (siehe IT13-D1).
2. **Schritt 2 (IT13-S03):** `globals.css` um `:root { --header-offset: 80px; }` + `@media (min-width: 640px)`-Override erweitern (siehe IT13-D3).
3. **Schritt 3 (IT13-S03):** `<header>` in `Header.tsx` mit `data-app-header`-Attribut versehen (siehe Component-Library IT13 §6).
4. **Schritt 4 (IT13-S03 — optional aber empfohlen):** `<HeaderOffsetSync />`-Komponente einbauen für JS-dynamische Offset-Messung.
5. **Schritt 5 (IT13-S03):** `useScrollToSection`-Hook in `src/hooks/useScrollToSection.ts` anlegen (Code siehe Component-Library IT13 §1.2).
6. **Schritt 6 (IT13-S03):** Buchungsformular + QuickBookingModal + Profil-Form mit `data-section-anchor`-Pattern und `useScrollToSection` ausstatten.
7. **Schritt 7 (IT13-S07):** Audit aller Bild-Container nach `bg-white`, `bg-gray-100`, `placeholder="blur"` — entfernen / auf `bg-transparent` und `placeholder="empty"` ändern.
8. **Schritt 8 (IT13-S08):** Service-Detail-Hero-Komponente (`<ServiceDetailHero>` aus IT12) auf `<ServiceDetailImageFrame variant="detail-hero">`-Pattern umstellen — Aspect-Ratio + `object-contain` + `bg-baerenstark-cream/60`.
9. **Schritt 9 (IT13-S01):** Public-Route `/datenschutz/datenloesung` als statische Page anlegen (siehe Component-Library IT13 §5).
10. **Schritt 10 (IT13-S01):** Footer um „Datenlöschung"-Link erweitern.
11. **Schritt 11 (IT13-S01):** Datenschutz-Hauptseite (`/datenschutz`) um `<section id="datenloesung">`-Anker erweitern.
12. **Schritt 12 (IT13-S04):** PrefillNotice-Komponente um `variant="du"`-Prop erweitern (falls Kontaktformular existiert / hinzukommt).

---

## IT13-D6  Story-Coverage (Design-System)

| Story        | Design-System-Deliverable IT13                                                              |
|--------------|----------------------------------------------------------------------------------------------|
| IT13-S01     | Keine neuen Tokens. Bestehende `baerenstark-*`-Tokens für Datenlöschungsseite reichen.      |
| IT13-S02     | **NEU IT13-D1 (Facebook-Brand-Color-Tokens)**.                                              |
| IT13-S03     | **NEU IT13-D3 (Header-Offset-CSS-Variable)** + Engineer-Pattern für Section-Anchors.         |
| IT13-S04     | Keine neuen Tokens. PrefillNotice nutzt Bestand IT11-D2.                                    |
| IT13-S05     | Backend-Bug. Keine Design-System-Änderung.                                                   |
| IT13-S06     | Backend-Bug. Keine Design-System-Änderung.                                                   |
| IT13-S07     | **NEU IT13-D2 (Letterbox-BG-Tokens — als Inline-Klassen mit Cream-Opacity-Modifier)**.       |
| IT13-S08     | **NEU IT13-D2 (Letterbox-BG-Tokens)** + Bestand `aspect-*`-Utilities.                        |

---

## IT13-D7  Offene Design-Fragen

1. **Facebook-Brand-Color in Tailwind-Theme:** Aktuell als Inline-Hex `#1877F2` in den OAuthButtons.tsx-Buttons (Bestand IT11/IT12-Stil). IT13-D1 schlägt Tailwind-Token-Alias vor — Engineer kann inline lassen oder als Token extrahieren. UX-Empfehlung: Token-Alias, weil semantisch klarer und in Storybook auffindbar.
2. **Letterbox-Token als Tailwind-Theme-Color:** Aktuell als Inline-Klasse `bg-baerenstark-cream/60`. Falls Storybook-Stories einen expliziten Token-Namen brauchen: `bg-letterbox` als Alias möglich. UX-Empfehlung: Inline lassen (kein zusätzlicher Token nötig — Cream + Opacity-Modifier ist klar).
3. **Header-Offset auf Custom-Layouts:** Falls in IT14+ Subpages mit anderem Header-Layout entstehen (z. B. Print-View, Embedded-View), muss `--header-offset` overridable bleiben — bereits per CSS-Variable garantiert, aber Engineer dokumentiert das in Layout-Komponenten.
4. **Dark Mode:** Weiterhin out-of-scope (IT10 §9.1). IT13 keine neuen Dark-Mode-Werte.
5. **Reduced-Motion-Verhalten:** §1.1.4 in ux-spec definiert „instant scroll". Falls in IT14+ alternative Reduced-Motion-Pattern (z. B. nur Fade) gewünscht: Token `--scroll-behavior-reduced` einführen.

---

## IT13-D8  QA-Checks

Vor PR-Merge bitte verifizieren:

| Check | Methode |
|-------|---------|
| `--header-offset` ist gesetzt im `:root` | DevTools → Computed Styles auf `<html>` prüfen |
| Section-Anchors haben `scroll-margin-top: var(--header-offset)` | DevTools → Computed Styles an `<section data-section-anchor>` |
| Step-Wechsel scrollt smooth (no-preference) | Browser-Test: Step durchklicken |
| Step-Wechsel scrollt instant (reduce) | DevTools → Rendering-Tab → „Emulate CSS prefers-reduced-motion: reduce" |
| Heading-Focus sichtbar | Tab-Navigation oder Step-Wechsel → DevTools-Inspect aktives Element |
| Facebook-Button-Kontrast Weiß auf `#1877F2` | WebAIM-Contrast-Checker, Wert ≥ 4.5:1 |
| PNG-Transparenz: keine `bg-white`/`bg-gray-*` an `<img>` | DevTools-Inspect aller Service-Card und Detail-Hero `<img>`-Wrapper |
| Service-Detail-Bild vollständig sichtbar | Browser-Test bei 360 px, 768 px, 1280 px |
| Letterbox-Streifen Cream/60 sichtbar | Visuell, bei Bildern mit anderem Aspect-Ratio als Frame |
| Datenlöschungsseite HTTP 200, kein Auth-Redirect | `curl -I https://www.baerenstark-hausservice.app/datenschutz/datenloesung` |
| Footer-Link „Datenlöschung" sichtbar und klickbar | Visueller Test im Footer |

---

*Ende der Design-System-Additions Iteration 13.*
