# Frontend Requirements — Iteration 13

> Stand: 2026-05-04. Architektur-Basis: `ARCHITECTURE.md` (Stand IT12).
> Sprache UI: Deutsch.
>
> Frontend-relevante Stories:
> - **S01** Datenlöschungsseite: neue Page + Footer-Link + Datenschutz-Update.
> - **S02** Facebook-Button: existiert bereits, kleinere QA-Polishings.
> - **S03** Scroll-Verhalten: konsistente Sektion-Heading-Sichtbarkeit.
> - **S04** Prefill: alle Formulare mit eingeloggten Profil-Daten füllen.
> - **S07** PNG-Transparenz: opaken Hintergrund entfernen.
> - **S08** Service-Detail-Bilder: `object-contain`-Frame mit max-Dim.

---

## Tech Stack (unverändert ggü. IT12)

- Framework: Next.js 14 App Router, TypeScript.
- Styling: TailwindCSS (Braun/Beige Theme — `baerenstark-bark`,
  `baerenstark-cream`, `baerenstark-sand`, `baerenstark-wood`,
  `baerenstark-accent`, `leaf`).
- Forms: React Hook Form + Zod-Resolver.
- Hooks: `useCustomer()` (`src/lib/use-customer.ts`).
- State: kein globaler Store — Component-local + EventTarget-Bus
  (`customer-sync.ts`).
- Routing: Next.js Server Components + Client Components.

---

## S01 — Datenlöschungsseite (Frontend-Anteil)

### Neue Page

> **Decision IT13 (Source of Truth):** Kanonische URL ist
> `/datenschutz/datenloesung` (Story-AC + UX-Spec stimmen überein).
> Frühere Variante `/datenschutz/loeschung` ist verworfen.

`src/app/datenschutz/datenloesung/page.tsx` — Server Component, statisch.
Layout-Konvention identisch zu `src/app/datenschutz/page.tsx`:

```
<article class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
  <h1 class="mb-6 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
    Datenlöschung
  </h1>
  <section class="space-y-5 text-baerenstark-bark/90">
    <p>...Erklärung...</p>
    <h2 class="mt-6 font-serif text-xl font-semibold">So beantragen Sie die Löschung</h2>
    <ul class="list-disc space-y-1 pl-6">
      <li>E-Mail an <a href="mailto:..">hausservice-baerenstark@outlook.com</a></li>
      <li>Betreff "Datenlöschung"</li>
      <li>Bearbeitung innerhalb von 30 Tagen (DSGVO Art. 17)</li>
    </ul>
    <h2>Welche Daten werden gespeichert?</h2>
    <ul>
      <li>Vor- und Nachname</li>
      <li>E-Mail-Adresse</li>
      <li>Telefonnummer (falls hinterlegt)</li>
      <li>Adresse (falls hinterlegt)</li>
      <li>Buchungshistorie & Bewertungen</li>
    </ul>
    <h2>Datenschutzerklärung</h2>
    <p>Mehr Details: <Link href="/datenschutz">Datenschutz</Link></p>
  </section>
</article>
```

Keine Client-Interaktion, keine API-Calls.

### Footer-Link (`src/components/layout/Footer.tsx`)

In der Sektion „Rechtliches" (`footer-legal`) einen neuen `<li>`
eintragen, **direkt nach dem Datenschutz-Link**:

```tsx
<li>
  <Link href="/datenschutz/datenloesung" className="hover:text-baerenstark-accent">
    Datenlöschung
  </Link>
</li>
```

Der Link steht damit im Footer auf jeder Seite — Facebook-App-Review-
Anforderung erfüllt (Story-AC: „Footer der Website … ist ein Link
,Datenlöschung' oder der Link über ,Datenschutz' erreichbar").

### Datenschutz-Page-Update (`src/app/datenschutz/page.tsx`)

Neuen Abschnitt einfügen (z. B. zwischen den bestehenden Sektionen oder
am Ende):

```tsx
<h2 className="mt-6 font-serif text-xl font-semibold">
  Datenlöschung
</h2>
<p>
  Sie können die Löschung Ihrer personenbezogenen Daten jederzeit per
  E-Mail an <a className="underline" href="mailto:hausservice-baerenstark@outlook.com">
  hausservice-baerenstark@outlook.com</a> beantragen. Wir bearbeiten
  Ihre Anfrage innerhalb von 30 Tagen.
</p>
<p>
  Mehr Details und alle Informationen, die Facebook für die
  App-Review verlangt, finden Sie auf unserer separaten{' '}
  <Link href="/datenschutz/datenloesung" className="underline">
    Datenlöschungs-Seite
  </Link>.
</p>
```

---

## S02 — Facebook OAuth (Frontend)

### Status quo

`src/components/customer/LoginForm.tsx` rendert bereits beide OAuth-
Buttons (Google + Facebook, Zeile 240–270). Layout ist:

1. E-Mail/Passwort-Form (oben).
2. Divider „oder".
3. Google-Button (weißer Hintergrund + Brand-Icon).
4. **Facebook-Button (Brand-Farbe `#1877F2`, weißes Logo)**.
5. Footer-Link "Noch kein Konto? Registrieren".

Der Button-Code ist bereits korrekt:

- Brand-Farbe: `bg-[#1877F2]` und `hover:bg-[#155EBF]`.
- Icon: `<FacebookIcon />` SVG inline (currentColor → weiß).
- a11y: `aria-label="Mit Facebook anmelden"`.
- Loading-Text: „Wird umgeleitet …".
- Disabled wenn anderer Provider gerade pendet.

### IT13-Anpassungen

**Keine zwingenden Änderungen** — Code ist sauber. Eventuell:

- Visual-QA: Button-Höhe / -Padding identisch zum Google-Button (beide
  `px-4 py-3`, gleicher `rounded-lg`). ✓ — bereits identisch.
- Disabled-Zustand: aktuell `disabled:opacity-60`. ✓
- Falls Facebook im Backend (S02 ENV-Setup) noch nicht aktiv ist:
  Frontend zeigt den Button trotzdem; ein Klick führt zum NextAuth-
  Handler, der bei fehlender Provider-Config einen 500/404 wirft.
  → Härtung (optional): Server Component könnte `getCustomerOauthEnabled()`
  abfragen und Buttons konditional rendern. Bisher nicht der Fall, und
  Story-AC verlangt es nicht. Skip.

### Error-Handling (bestehend)

`mapOAuthErrorMessage()` in `LoginForm.tsx` mappt bereits:

- `oauth_no_email` → „Mit deinem Konto ist keine E-Mail-Adresse verknüpft. …"
- `oauth_unverified_conflict` → „Es existiert bereits ein Konto mit dieser E-Mail-Adresse. …"
- `oauth_error` → „Die Anmeldung wurde abgebrochen oder ist fehlgeschlagen. …"

Diese Mappings decken die Facebook-Cases ebenfalls. **Kein neuer Code nötig.**

---

## S03 — Scroll-zu-Section-Heading

### Problem-Recap

- Aktuell: `scrollIntoViewIfNeeded(elementId)` (siehe
  `src/lib/scroll-into-view.ts`). Verwendet `scrollIntoView({ behavior:
  'smooth', block: 'start' })`.
- Sticky-Header (Höhe variabel: 64 px Desktop / 56 px Mobile)
  verdeckt das Heading häufig — Tom meldet, die Section-Heading ist
  manchmal abgeschnitten oder gar nicht sichtbar.

### Technische Spezifikation

> **Decision IT13 (Orchestrator-Entscheidung 2026-05-04 — Source of
> Truth, UX-Spec gewinnt):**
> - **Public API ist ein Hook**: `useScrollToSection(target)`. Es gibt
>   **keine** freistehende `scrollToSection()`-Funktion in der
>   öffentlichen API. (Eine interne `_scrollToTarget()`-Helper darf
>   existieren, aber wird nicht exportiert.)
> - **Header-Selector**: `[data-app-header]` (NICHT `[data-header]`).
> - **Modal-Body-Selector**: `[data-modal-body]` (NICHT
>   `[data-scroll-container]`).
> - Hook-Pflicht-Sequenz beim Scroll: `requestAnimationFrame` × 2 →
>   `scrollIntoView` → `heading.focus({ preventScroll: true })`. Damit
>   ist der Section-Heading nach dem Scroll programmatisch fokussiert
>   (a11y) und Screen-Reader liest ihn vor.

Neuer Helper-Hook in **`src/lib/scroll-to-section.ts`**:

```ts
import { useCallback, useRef } from 'react';

/**
 * Hook, der eine stabile `scrollTo()`-Funktion zurückgibt. Akzeptiert
 * entweder eine Section-ID (string) oder einen HTMLElement-Ref.
 *
 * Verhalten:
 *   1. requestAnimationFrame x 2 (gibt React Zeit den Layout-Pass
 *      abzuschließen, bevor wir Geometrie messen).
 *   2. Header-Höhe aus `[data-app-header]` lesen; fallback 64.
 *   3. Modal-Container über `closest('[data-modal-body]')` erkennen
 *      (wenn Element in einem Modal liegt → Modal-internen
 *      Scroll-Container scrollen, NICHT das Dokument).
 *   4. scrollIntoView({ behavior, block: 'start' })  — `behavior`
 *      hängt von `prefers-reduced-motion` ab.
 *   5. Heading im Element finden (h1/h2/h3 — erstes Match) und
 *      `.focus({ preventScroll: true })` aufrufen. Falls das Element
 *      selbst ein Heading ist, fokussiere das Element direkt. Wir
 *      setzen `tabIndex=-1` per Render-Side am Heading (CSS-Klasse
 *      `focus:outline-none` damit kein sichtbarer Focus-Ring auftaucht
 *      — der Focus ist programmatisch, nicht user-getriggert).
 *   6. Komfort-Tolerance ±8 px: wenn Element bereits im Idealbereich
 *      unterhalb des Headers liegt, **kein Scroll**, aber Heading wird
 *      trotzdem fokussiert (a11y).
 *
 * Returns: stabile Callback-Funktion. Im useCallback gewrapped, sodass
 * Aufrufer sie problemlos in useEffect-Deps verwenden können.
 */
export function useScrollToSection(): (
  target: string | React.RefObject<HTMLElement>,
) => void;
```

Implementierung (Pseudo-Code):

```ts
const HEADER_DEFAULT = 64;
const COMFORT_TOLERANCE = 8;
const HEADER_SELECTOR = '[data-app-header]';
const MODAL_BODY_SELECTOR = '[data-modal-body]';

export function useScrollToSection() {
  // useRef stabilisiert den Callback ohne Re-Renders
  return useCallback((target: string | React.RefObject<HTMLElement>) => {
    if (typeof window === 'undefined') return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el =
          typeof target === 'string'
            ? document.getElementById(target)
            : target.current;
        if (!el) return;

        const headerEl = document.querySelector<HTMLElement>(HEADER_SELECTOR);
        const headerHeight = headerEl?.offsetHeight ?? HEADER_DEFAULT;

        const reduceMotion = window
          .matchMedia('(prefers-reduced-motion: reduce)').matches;
        const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';

        const modalBody = el.closest<HTMLElement>(MODAL_BODY_SELECTOR);

        // Geometry-Check für Komfort-Tolerance
        let needsScroll = true;
        if (modalBody) {
          const cRect = modalBody.getBoundingClientRect();
          const eRect = el.getBoundingClientRect();
          const offset = eRect.top - cRect.top;
          // Im Modal: Header-Höhe meist 0 (Modal überlagert), aber
          // Modal-Header kann existieren. Wir prüfen [data-modal-header].
          const modalHeader = modalBody.querySelector<HTMLElement>('[data-modal-header]');
          const effectiveHeader = modalHeader?.offsetHeight ?? 0;
          if (Math.abs(offset - effectiveHeader) <= COMFORT_TOLERANCE) {
            needsScroll = false;
          } else {
            modalBody.scrollTo({
              top: modalBody.scrollTop + offset - effectiveHeader,
              behavior,
            });
          }
        } else {
          const rect = el.getBoundingClientRect();
          if (Math.abs(rect.top - headerHeight) <= COMFORT_TOLERANCE) {
            needsScroll = false;
          } else {
            // scrollIntoView mit scroll-margin-top am Element ist
            // einfacher als window.scrollTo-Mathematik. Element MUSS
            // dafür ein passendes scroll-mt-X haben (siehe Section-IDs
            // unten — alle haben scroll-mt-20 sm:scroll-mt-24).
            el.scrollIntoView({ behavior, block: 'start' });
          }
        }

        // Heading-Fokus (a11y) — IMMER, auch wenn kein Scroll nötig.
        const heading = isHeading(el)
          ? el
          : el.querySelector<HTMLElement>('h1,h2,h3,h4,h5,h6');
        if (heading) {
          if (!heading.hasAttribute('tabindex')) {
            heading.setAttribute('tabindex', '-1');
          }
          heading.focus({ preventScroll: true });
        }
      });
    });
  }, []);
}

function isHeading(el: HTMLElement): boolean {
  return /^H[1-6]$/.test(el.tagName);
}
```

> **Hinweis Migration:** Das in IT12 geschriebene
> `src/lib/scroll-into-view.ts` (`scrollIntoViewIfNeeded`) wird in
> IT13 **gelöscht**, sobald alle Aufrufer auf `useScrollToSection()`
> umgestellt sind. Es gibt keine externe Verwendung außerhalb des
> Repos. Saubere Single-API ist das Ziel.

### Header-Markierung

`src/components/layout/Header.tsx` muss das Sticky-Element mit
**`data-app-header`** (verbindlich, nicht `data-header`) markieren.
Wenn das Attribut nicht vorhanden ist:

```tsx
<header data-app-header className="sticky top-0 z-30 ...">
```

### Section-Heading-Markierung

Jede Wizard-Step-Sektion bekommt ein stabiles `id` und (optional)
`scroll-margin-top` als CSS-Fallback (für Anker-Links und falls JS
deaktiviert):

```tsx
<section id="duration-section" className="scroll-mt-20 sm:scroll-mt-24">
  <h2>Wie lange?</h2>
  ...
</section>
```

`scroll-mt-20` = 5 rem = 80 px (decken den 64-px-Header + Komfort-Padding).

### Konkret betroffene Aufrufstellen

**Buchungs-Wizard (`src/app/buchung/BookingClient.tsx`):**

Bestehende Aufrufe (mit Section-IDs):

| Step | Trigger | Ziel-Section-ID | Migration |
|------|---------|-----------------|-----------|
| Tag-Wahl → Dauer | `handleDaySelect()` Zeile 200 | `duration-section` | `scrollIntoViewIfNeeded` → `scrollTo('duration-section')` |
| Dauer-Wahl → Zeitslot | `handleDurationSelect()` Zeile 211 | `slot-list-section` | `scrollIntoViewIfNeeded` → `scrollTo('slot-list-section')` |
| Zeitslot → Form (Rebook-Mode) | `handleTimeSlotSelect()` Zeile 219 | `booking-form-section` | `scrollIntoViewIfNeeded` → `scrollTo('booking-form-section')` |
| Re-Auswahl Service | Zeile 391 | `booking-form-section` | ditto |
| Slot-Picker bei Rebook | Zeile 460 | `slot-list-section` | ditto |

→ Alle 5 Aufrufstellen auf den `useScrollToSection()`-Hook migrieren.
IDs bleiben. Beispiel-Migration:

```ts
// vorher
import { scrollIntoViewIfNeeded } from '@/lib/scroll-into-view';
setTimeout(() => scrollIntoViewIfNeeded('duration-section'), 50);

// nachher
import { useScrollToSection } from '@/lib/scroll-to-section';
const scrollTo = useScrollToSection(); // im Component-Body
// im Handler:
scrollTo('duration-section'); // requestAnimationFrame x2 ist intern, kein setTimeout mehr
```

**QuickBookingModal (`src/components/booking/QuickBookingModal.tsx`):**

Modal hat seinen eigenen Scroll-Container (DialogContent). Den DOM-Knoten
mit **`data-modal-body`** (verbindlich) markieren, dann greift die
Modal-Branch im Hook. Falls ein interner Modal-Header existiert
(z. B. Sticky-Header oben im Dialog), bekommt der `data-modal-header`.

Die Form-Stages innerhalb des Modals (Service-Wahl → Tag → Dauer →
Zeit → Details → Bestätigung) bekommen jeweils eine `id`
(`modal-step-service`, `modal-step-day`, `modal-step-duration`,
`modal-step-time`, `modal-step-details`, `modal-step-confirm`) und
`scroll-mt-4` als CSS-Fallback (Modal-interner Header ist meist 0–48 px;
16 px Komfort-Padding reicht).

> **Decision IT13:** Modal-Header-Detection: wenn der Scroll-Container
> (`[data-modal-body]`) existiert UND innerhalb davon ein
> `[data-modal-header]` gefunden wird, wird dessen Höhe als
> Header-Offset verwendet, sonst 0.

**Profil-Form (`src/app/konto/profil/...`):**

Nach Mount der Profil-Page einmal scrollen, falls Hash-Anker vorhanden
(`#kontakt`, `#adresse`). Aufrufer:

```ts
const scrollTo = useScrollToSection();
useEffect(() => {
  const hash = window.location.hash.slice(1);
  if (hash) scrollTo(hash);
}, [scrollTo]);
```

Sektionen mit IDs:

| Section            | ID                |
|--------------------|-------------------|
| Persönliche Daten  | `profile-section-personal` |
| Kontaktdaten       | `profile-section-contact` |
| Adresse            | `profile-section-address` |

Bei „Profil bearbeiten" (Inline-Toggle) auf die Section scrollen.

**Anfragen-Detailseite (`src/app/konto/anfragen/[id]/...`):**

Nach Mount, falls die Page mit `?focus=cancel` aufgerufen wird (z. B.
aus E-Mail-CTA): `scrollTo('cancel-section')` aus dem
`useScrollToSection()`-Hook.

**Kontaktformular:** Aktuell existiert KEIN dediziertes Kontakt-
Formular auf der Site (nur `mailto:`/`tel:`-Links und das Buchungs-
Formular). **Acceptance: not-applicable** für IT13. Markieren im PR.

### Allgemein

- `prefers-reduced-motion`: bereits im Helper berücksichtigt.
- Mobile (Viewport < 768 px): Header höhe wird über
  `[data-app-header].offsetHeight` gelesen → automatisch korrekt.

### Story Coverage S03

Section-Heading sichtbar mit Komfort-Tolerance ±8 px,
prefers-reduced-motion berücksichtigt, modale + dokumentbasierte Scroll-
Container differenziert.

---

## S04 — Prefill in allen Formularen

### Datenquelle

`useCustomer()` (`src/lib/use-customer.ts`) — Client-Hook ohne globalen
Store; jede Component-Instanz fetcht `GET /api/customer/me` beim Mount,
returns:

```ts
type CustomerStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface UseCustomerResult {
  status: CustomerStatus;
  customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    streetAndNumber: string | null;
    postalCode: string | null;
    city: string | null;
  } | null;
}
```

### Hydration-Sicherheit

Die Werte dürfen NICHT in den initialen Server-Render einfließen, weil
sie sonst zu Hydration-Mismatch führen. Reihenfolge:

1. Server-Render: alle Inputs mit `defaultValue=""` (oder leer).
2. Client-Hydration: `useCustomer()` mountet, status='loading'.
3. Skeleton-Anzeige während `status === 'loading'`.
4. Sobald `status === 'authenticated'` und `customer` da ist:
   - Wenn React Hook Form: `reset()` mit den Profilwerten aufrufen
     (über `useEffect`).
   - Wenn unkontrolliert: `defaultValues`-Prop bereits mit `customer`
     setzen, weil das Formular durch das Skeleton-Gating ohnehin erst
     nach dem ersten Customer-Fetch mountet.

`BookingClient.tsx` macht das bereits richtig (Zeile 248–256: Skeleton
während `customerStatus === 'loading'`). Diesen Pattern auf alle
anderen Formulare ausweiten.

### Formular-spezifische Prefill-Mappings

#### Buchungs-Wizard / `BookingForm.tsx`

| Profil-Feld           | Form-Feld                | Behavior wenn leer |
|-----------------------|--------------------------|--------------------|
| `firstName`           | `customerName` (split-on-blur) ODER `firstName` falls eigenes Feld | leer |
| `lastName`            | `customerName` (kombiniert) ODER `lastName` | leer |
| `email`               | `customerEmail`          | leer |
| `phone`               | `customerPhone`          | leer (kein Hinweis) |
| `streetAndNumber`     | `addressStreet`          | leer + Banner „Adresse in Profil hinterlegen" mit Link `/konto/profil#profile-section-address` |
| `postalCode`          | `addressZip`             | (siehe oben — alle 3 Adressfelder gemeinsam) |
| `city`                | `addressCity`            | (siehe oben) |

> Hinweis: aktuelle Schema hat **`customerName` als ein Feld**, nicht
> First/Last separat. Prefill-Strategie: `customerName = `${firstName} ${lastName}`.trim()`.
> Wenn First/Last leer, leeres String-Default.

**Override-Verhalten:** User-Edit in einem Feld überschreibt den
Prefill-Wert für die laufende Buchung. Profil bleibt unangetastet
(keine `PATCH /api/customer/me` aus der Booking-Form).

**Ungeguardet-Pfad:** `status === 'unauthenticated'` → alle Felder leer,
Banner „Adresse in Profil…" wird NICHT angezeigt (kein Profil zum
Bearbeiten).

**Fehler-Pfad:** Wenn `GET /api/customer/me` einen 401 wirft (Cookie
abgelaufen) → `useCustomer.status = 'unauthenticated'` → leere Felder,
keine Fehlerbanner. Wenn 5xx → bleibt im Loading-State (kein silent
Fallback auf 'unauthenticated' — IT12-S07 Verhalten beibehalten).

#### Profilformular (`/konto/profil`)

| DB-Feld           | Form-Feld         | Initial wenn leer |
|-------------------|-------------------|-------------------|
| `firstName`       | `firstName`       | leer + `placeholder="Max"` |
| `lastName`        | `lastName`        | leer + `placeholder="Mustermann"` |
| `email`           | `email` (read-only) | gefüllt — E-Mail-Wechsel ist UI-disabled (IT12 BUG-402) |
| `phone`           | `phone`           | leer + `placeholder="0151 12345678"` |
| `streetAndNumber` | `streetAndNumber` | leer + `placeholder="Beispielstraße 1"` |
| `postalCode`      | `postalCode`      | leer + `placeholder="64283"` |
| `city`            | `city`            | leer + `placeholder="Darmstadt"` |

Kein Adress-Banner (Profil IST der Ort der Adresse).

#### Kontaktformular

**Existiert nicht.** Story-AC: not-applicable. Im PR-Kommentar vermerken.

#### Bewertungs-Formular (`/konto/anfragen/[id]/bewerten`)

Falls Reviewer-Felder vorhanden (Name, E-Mail) → analog Booking-Form
prefillen. Bewertungs-Schema hat aber bereits `customerId`-FK, also
keine separaten Name/E-Mail-Felder im Standardfall. Kein Action-Item.

### Story Coverage S04

Buchungs-Wizard, Profil-Formular: prefill via `useCustomer()` mit
Skeleton-Gating. Adressbanner mit Link auf Profil. Override-only-local.
Auth-Fehler stay-state-Behavior.

---

## S07 — PNG-Transparenz

### Problem-Lokation

Service-Karten auf der Startseite (`ServiceGrid.tsx`) und auf den
Service-Detail-Seiten (`ServiceDetailHero.tsx`).

### Ursachen-Analyse

`src/components/services/ServiceDetailHero.tsx` Zeile 56:

```tsx
<div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg
                border border-baerenstark-sand bg-baerenstark-cream/40 shadow-md
                sm:aspect-[3/2] sm:rounded-xl">
  <Image src={imageSrc} … className="object-cover …" />
</div>
```

→ Container hat **`bg-baerenstark-cream/40`** = beige/40 % Opacity.
Hier wird der opake Hintergrund gerendert. Auf den
Service-Detail-Seiten ist das aktuell „kosmetisch" akzeptabel, aber
die Story verlangt vollständige Transparenz.

`src/components/home/ServiceGrid.tsx` analoge Untersuchung —
ServiceCard-Wrapper hat höchstwahrscheinlich `bg-white` oder
`bg-baerenstark-cream` Ähnliches.

### Fix-Strategie

> **Decision IT13 (Orchestrator-Entscheidung 2026-05-04 — Source of
> Truth, UX-Spec gewinnt):** Drei-Schicht-Modell mit verbindlichen
> Tailwind-Klassen pro Schicht. Engineer darf nicht improvisieren.
>
> | Schicht                                  | Tailwind-Klasse              | Rolle |
> |------------------------------------------|------------------------------|-------|
> | **Card / Outer-Wrapper**                 | `bg-baerenstark-cream/60`    | „Letterbox-Token" — sichtbarer Karten-Hintergrund hinter dem Bild, sodass `object-contain`-Ränder nicht ins Nichts schauen. |
> | **Image-Container** (direkt um `<Image>`) | `bg-transparent`             | Keine eigene Farbe — der Cream-Layer scheint durch die transparenten PNG-Pixel. |
> | **`<Image>` selbst**                     | `bg-transparent object-contain` | Bild voll sichtbar (siehe S08), kein opaker Self-Background. |

```tsx
// src/components/services/ServiceDetailHero.tsx — Ziel-Markup
<div
  /* Card / Outer-Wrapper — Letterbox-Token */
  className="rounded-lg border border-baerenstark-sand
             bg-baerenstark-cream/60 shadow-md sm:rounded-xl"
>
  <div
    /* Image-Container */
    className="relative aspect-[4/3] w-full overflow-hidden
               bg-transparent sm:aspect-[3/2]"
  >
    <Image
      src={imageSrc}
      alt={`${serviceName} — Beispielbild`}
      fill
      sizes="(max-width: 1024px) 100vw, 60vw"
      quality={85}
      priority={priority}
      onError={() => setErrored(true)}
      /* Image self */
      className="bg-transparent object-contain
                 transition-transform duration-200 ease-out
                 motion-safe:hover:scale-[1.02]"
    />
  </div>
</div>
```

> **Hinweis:** `<Image>` selbst zusätzlich `bg-transparent` zu setzen
> ist defensiv gegen mögliche Browser-Default-Backgrounds und
> Tailwind-Reset-Quirks. Kein funktionaler Impact wenn der Default
> bereits transparent ist, aber explizit ist besser.

`Image`-Component-Konfig:

- `fill`-Prop bleibt.
- `placeholder` NICHT gesetzt → kein Blur-Placeholder, kein opaker
  Background-Color-Trick.
- `style={{ backgroundColor: 'transparent' }}` als Inline-Override
  optional, falls Tailwind-Klasse durch SSR-Reihenfolge nicht greift.

**Service-Card auf Startseite (`src/components/home/ServiceGrid.tsx`):**

Gleiche Drei-Schicht-Logik. Karten-Outer-Wrapper darf einen subtileren
Theme-Hintergrund haben (z. B. `bg-baerenstark-cream` oder `bg-white/80`)
für Karten-Optik, aber:

- Image-Container direkt um `<Image>`: **`bg-transparent`**.
- `<Image>` selbst: **`bg-transparent object-contain`** (oder
  `object-cover` falls die Karten-Komposition es verlangt — UX
  entscheidet pro Karte).

### CSS-Reset / Globale Styles

Sicherstellen, dass `globals.css` keinen `img { background: white }`
Override hat. Standard-Tailwind-Reset macht das **nicht**, also
unwahrscheinlich. Trotzdem prüfen.

### `placeholder="empty"` Hardening

Aktuell ist kein `placeholder`-Prop gesetzt → Default ist `empty` →
kein Blur-Background. ✓ Nichts zu tun.

### Story Coverage S07

Service-Detail-Hero auf allen 7 Service-Pages, Service-Cards auf der
Startseite. Verifikation: visuelle Inspektion + DOM-Inspektion (kein
`background-color` auf Container).

---

## S08 — Service-Detail-Bilder: Frame-Größe

### Problem

`object-cover` (Zeile 65 in `ServiceDetailHero.tsx`) zoomt das Bild
in den Container und schneidet Ränder ab. Tom will das **gesamte Bild
sichtbar** haben.

### Fix

`object-cover` → **`object-contain`**.

```tsx
// ServiceDetailHero.tsx — Zeile 65
className="object-contain transition-transform duration-200 ease-out motion-safe:hover:scale-[1.02]"
```

### Frame-Dimensionen — verbindlich kombiniert mit S07

Drei-Schicht-Modell aus S07 wird hier weitergeführt: das **Outer-Wrapper**
trägt die Letterbox-Farbe (`bg-baerenstark-cream/60`), der **Image-
Container** ist `bg-transparent`, das **`<Image>`** ist
`bg-transparent object-contain`.

```tsx
// src/components/services/ServiceDetailHero.tsx — finale Markup-Form
<div
  /* Card / Outer-Wrapper — Letterbox-Token */
  className="rounded-lg border border-baerenstark-sand
             bg-baerenstark-cream/60 shadow-md sm:rounded-xl"
>
  <div
    /* Image-Container */
    className="relative aspect-[4/3] w-full overflow-hidden
               bg-transparent
               sm:aspect-[3/2]
               max-h-[28rem]"
  >
    <Image
      src={imageSrc}
      alt={`${serviceName} — Beispielbild`}
      fill
      sizes="(max-width: 1024px) 100vw, 60vw"
      quality={85}
      priority={priority}
      onError={() => setErrored(true)}
      className="bg-transparent object-contain
                 transition-transform duration-200 ease-out
                 motion-safe:hover:scale-[1.02]"
    />
  </div>
</div>
```

**Eckpunkte:**

- Outer-Wrapper `bg-baerenstark-cream/60` = Letterbox sichtbar (kein
  „Loch" durchs Layout).
- Image-Container `bg-transparent` = Cream-Layer scheint durch
  PNG-Pixel.
- `<Image>` `bg-transparent object-contain` = vollständig sichtbar +
  kein Self-Background.
- `max-h-[28rem]` (≈ 448 px) am Image-Container als Hard-Cap für sehr
  breite Viewports — verhindert dass das Bild auf 4K-Screens unförmig
  groß wird.
- `aspect-[4/3]` / `sm:aspect-[3/2]` bleibt → konsistente Höhe in der
  Page-Komposition.
- `rounded-lg` / `sm:rounded-xl` und `border` bleiben am Outer-Wrapper
  → Frame-Optik bleibt erhalten.

### Mobile (Viewport 375 px)

- `w-full` greift, max-Breite ist die Viewport-Breite minus Padding.
- `aspect-[4/3]` → Container ist 375 × ~280 px.
- Mit `object-contain` wird ein 1080 × 720 PNG vollständig sichtbar.
- Kein horizontaler Overflow.

### Desktop (Viewport ≥ 1280 px)

- Layout im `md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` — Container ist
  ~50 % der `max-w-6xl` (= 72 rem = 1152 px) → ~575 px.
- Aspect-Ratio `3/2` → Container 575 × ~383 px.
- `max-h-[28rem]` (448 px) ist nicht-blockierend.

### ServiceGrid (Startseite)

`ServiceGrid.tsx` — Service-Karten verwenden Bilder aus dem gleichen
`SERVICE_IMAGE_MAP`. Hier ist das Bild kleiner (Card-Format), `object-cover`
ist akzeptabel, weil die Card-Komposition davon lebt. **Keine Änderung
auf der Startseite** für S08 nötig — die Story bezieht sich explizit auf
`/services/[slug]`.

### Story Coverage S08

`object-contain` + `max-h-[28rem]` + transparenter Container, Mobile
und Desktop verifiziert.

---

## Pages / Screens — Story-Mapping

### Page: Datenlöschung (route: `/datenschutz/datenloesung`)

- **Linked story**: S01.
- **Purpose**: Compliance-Seite für Facebook App Review + DSGVO Art. 17.
- **Components**: nur statisches Markup, kein Dynamic-Content.
- **Data needed**: keine.
- **User interactions**: `mailto:`-Link.

### Page: Datenschutz (route: `/datenschutz`)

- **Linked story**: S01 (Update).
- **Purpose**: bestehende Datenschutzerklärung + neuer Abschnitt
  „Datenlöschung".

### Page: Login (route: `/konto/login`)

- **Linked story**: S02.
- **Purpose**: E-Mail/Pw + Google + **Facebook** Login.
- **User interactions**: Klick „Mit Facebook anmelden" → NextAuth Flow.

### Page: Buchungs-Wizard (route: `/buchung`)

- **Linked story**: S03 (Scroll), S04 (Prefill).
- **Components**: `BookingClient`, `BookingCalendar`, `DurationPicker`,
  `TimeSlotPicker`, `BookingForm`, `QuickBookingModal`.
- **Data needed**: `useCustomer()`, availability, slots.
- **User interactions**: Tag/Dauer/Zeit-Wahl mit Auto-Scroll auf
  Section-Heading; Form-Felder prefilled für eingeloggte Kunden.

### Page: Service-Detail (route: `/services/[slug]`)

- **Linked story**: S07, S08.
- **Components**: `ServiceDetailHero` (Bild-Frame + transparenter
  Container).

### Page: Profil (route: `/konto/profil`)

- **Linked story**: S04.
- **Components**: `ProfileForm` mit prefilled Werten.

### Page: Footer (alle Routen)

- **Linked story**: S01.
- **Components**: `Footer` mit neuem Datenlöschungs-Link.

---

## Shared Components / Utils

### Neuer Hook: `src/lib/scroll-to-section.ts`

```ts
// Public API — verbindlich (Decision IT13):
export function useScrollToSection(): (
  target: string | React.RefObject<HTMLElement>,
) => void;
```

Ersetzt **alle** `scrollIntoViewIfNeeded()`-Aufrufe; `scroll-into-view.ts`
wird in IT13 gelöscht. Migrations-Stellen:

- `src/app/buchung/BookingClient.tsx` (5 Stellen).
- `src/components/booking/QuickBookingModal.tsx` (Modal-Steps).
- `src/components/booking/BookingForm.tsx` (falls vorhanden).
- `src/components/customer/ProfileForm.tsx` (Hash-Anker, Inline-Edit).

### Header-Markierung: `[data-app-header]` am Sticky-`<header>`

In `src/components/layout/Header.tsx` Attribut **`data-app-header`**
ergänzen (verbindlich, Decision IT13).

### Modal-Markierung: `[data-modal-body]` am Modal-Scroll-Container

In `src/components/booking/QuickBookingModal.tsx` (und allen anderen
Modal-Wrappern, die einen scrollbaren Body haben) das Attribut
**`data-modal-body`** am DOM-Knoten setzen, der die Scroll-Logik trägt
(meist der Dialog-Content-Wrapper). Optional `[data-modal-header]` an
einem internen Sticky-Header innerhalb des Modals — der Hook liest
dessen `offsetHeight` als effektiven Header-Offset.

### Section-IDs (verbindlich)

| Seite              | Section            | ID                          | scroll-mt-X |
|--------------------|--------------------|-----------------------------|-------------|
| `/buchung`         | Tag-Wahl           | `calendar-section`          | `scroll-mt-20 sm:scroll-mt-24` |
| `/buchung`         | Dauer-Wahl         | `duration-section`          | `scroll-mt-20 sm:scroll-mt-24` |
| `/buchung`         | Zeit-Wahl          | `slot-list-section`         | `scroll-mt-20 sm:scroll-mt-24` |
| `/buchung`         | Form               | `booking-form-section`      | `scroll-mt-20 sm:scroll-mt-24` |
| QuickBookingModal  | Service            | `modal-step-service`        | `scroll-mt-4` |
| QuickBookingModal  | Tag                | `modal-step-day`            | `scroll-mt-4` |
| QuickBookingModal  | Dauer              | `modal-step-duration`       | `scroll-mt-4` |
| QuickBookingModal  | Zeit               | `modal-step-time`           | `scroll-mt-4` |
| QuickBookingModal  | Details            | `modal-step-details`        | `scroll-mt-4` |
| QuickBookingModal  | Bestätigung        | `modal-step-confirm`        | `scroll-mt-4` |
| `/konto/profil`    | Persönliche Daten  | `profile-section-personal`  | `scroll-mt-20 sm:scroll-mt-24` |
| `/konto/profil`    | Kontaktdaten       | `profile-section-contact`   | `scroll-mt-20 sm:scroll-mt-24` |
| `/konto/profil`    | Adresse            | `profile-section-address`   | `scroll-mt-20 sm:scroll-mt-24` |
| Anfrage-Detail     | Storno             | `cancel-section`            | `scroll-mt-20 sm:scroll-mt-24` |

---

## API Consumption (Frontend)

### Bestehende, in IT13 unverändert genutzt

- `GET /api/customer/me` — Profil-Prefill in allen Forms (S04). Cached
  via `useCustomer()`-Hook.
- `POST /api/bookings` — Buchungsanfrage (S06 Bug-Fix wirkt im Backend;
  FE-Verhalten unverändert; bei 5xx zeigt FE den `X-Request-Id`-Wert
  als Fehler-Code-Hinweis).
- `/api/auth/customer/signin/facebook` — NextAuth-Trigger via
  CSRF-Form-POST (siehe `LoginForm.tsx`).

### Neu in IT13 (S05 Direct-Upload)

Decision IT13: Frontend-Upload-Flow wird auf
**Client-Side Direct-Upload via `@vercel/blob/client`** umgestellt.

Datei: `src/components/booking/FileUpload.tsx` (Bestand wird angepasst).

**Neuer Flow (3 Schritte):**

```ts
import { upload } from '@vercel/blob/client';

async function handleFile(file: File) {
  // 1. Token vom Server anfordern
  const tokenRes = await fetch('/api/upload/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });
  if (!tokenRes.ok) {
    // Fehlermapping aus dem Body — VALIDATION_ERROR / PAYLOAD_TOO_LARGE etc.
    throw await mapTokenError(tokenRes);
  }
  const { uploadUrl, token, blobPath, attachmentId } =
    (await tokenRes.json()).data;

  // 2. Direct-Upload Browser → Vercel Blob (KEIN Server)
  const blob = await upload(blobPath, file, {
    access: 'public',
    handleUploadUrl: uploadUrl,
    clientPayload: token,
  });

  // 3. Attachment-URL nachtragen
  await fetch(`/api/upload/attachments/${attachmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ url: blob.url }),
  });

  return { attachmentId, url: blob.url };
}
```

**Fehler-Mapping (deutsch, kein Stack-Trace):**

| HTTP / Code               | UI-Meldung |
|---------------------------|------------|
| 413 PAYLOAD_TOO_LARGE     | „Datei zu groß. Max. 10 MB für Bilder, 50 MB für Videos." |
| 415 UNSUPPORTED_MEDIA_TYPE| „Dateityp wird nicht unterstützt. Erlaubt: JPG, PNG, PDF, MP4." |
| 400 FILE_EMPTY            | „Die Datei ist leer." |
| 401 UNAUTHORIZED          | „Bitte melden Sie sich an oder geben Sie zuerst Kontaktdaten an." |
| 429 RATE_LIMITED          | „Zu viele Uploads. Bitte später erneut versuchen." |
| 503 BLOB_NOT_CONFIGURED   | „Datei-Upload aktuell nicht möglich. Bitte ohne Anhang absenden." |
| 5xx (mit `X-Request-Id`)  | „Bitte später erneut versuchen oder anrufen: 0157 74787512. Fehler-Code: <id>" |

**Progress-Anzeige:** `@vercel/blob/client.upload()` exposed
`onUploadProgress` (oder via `xhr` Polyfill). Frontend zeigt prozentuale
Progress-Bar pro File. Wichtig bei großen Dateien (10 MB Bilder, 50 MB
Videos), weil der Upload nicht mehr instant ist (kein lokaler-Server-
Buffer mehr).

**Limits Frontend-Validierung (vor `/api/upload/token`-Call):**

- max 5 Dateien pro Buchung (analog Bestand).
- max 3 parallele Uploads (analog Bestand).
- max-Bytes pro MIME (Backend re-validiert):
  - `image/*` → 10 MB
  - `video/*` → 50 MB
  - `application/pdf` → 10 MB

**Legacy-Endpoint-Verhalten:** `POST /api/upload` (Server-Multipart) gibt
während der Übergangsphase 410 GONE zurück. FE muss damit nicht
expliziet umgehen — nach Deploy ist der neue Flow aktiv und alte
Browser-Tabs sehen schlimmstenfalls eine generische Fehlermeldung
(„Bitte Seite neu laden — neuer Upload-Pfad aktiv.").

### Andere neue Endpoints

- `POST /api/upload/token` (siehe oben).
- `PATCH /api/upload/attachments/[id]` (siehe oben).

---

## Validation Rules

Keine neuen client-seitigen Validations.

---

## Accessibility & Responsiveness

- WCAG 2.1 AA (unverändert).
- `prefers-reduced-motion: reduce` wird im Scroll-Helper berücksichtigt.
- Section-Headings als `h2`/`h3` (semantische Hierarchie unverändert).
- Tab-Order der Login-Buttons: E-Mail → Passwort → Submit → Google →
  **Facebook** (bestehend, korrekt).
- Mobile-Breakpoints: `sm:` (640 px), `md:` (768 px), `lg:` (1024 px).

---

## Story Coverage

| Story | Frontend Deliverable |
| ----- | -------------------- |
| S01   | `src/app/datenschutz/datenloesung/page.tsx` (neu) + `Footer.tsx` Link + `src/app/datenschutz/page.tsx` Abschnitt. |
| S02   | `LoginForm.tsx` Facebook-Button bereits vorhanden — keine Code-Änderung; Visual-QA. |
| S03   | Neuer Hook `useScrollToSection()` in `src/lib/scroll-to-section.ts` (Pflicht-Sequenz `rAF×2 → scrollIntoView → heading.focus`). Header bekommt `[data-app-header]`, Modal-Body `[data-modal-body]`. Section-IDs/`scroll-mt-X` an allen Wizard-Steps, Modal-Stages, Profil-Sektionen. Migration der 5 `scrollIntoViewIfNeeded`-Aufrufstellen; alte Datei `scroll-into-view.ts` wird gelöscht. |
| S04   | `useCustomer()`-Prefill in `BookingForm.tsx` (Buchungs-Wizard, alle Felder + Adress-Banner) und `ProfileForm.tsx` (alle Felder). Skeleton-Gating während `loading`. |
| S05   | `FileUpload.tsx` Refactor auf Direct-Upload via `@vercel/blob/client` (Token-Anfrage → Direct-Upload → Attachment-URL-Patch). Progress-Anzeige, deutsches Fehler-Mapping inkl. `X-Request-Id`. |
| S07   | `ServiceDetailHero.tsx` Drei-Schicht-Modell: Outer-Wrapper `bg-baerenstark-cream/60`, Image-Container `bg-transparent`, `<Image>` `bg-transparent object-contain`. Audit auf `ServiceGrid.tsx`. |
| S08   | `ServiceDetailHero.tsx` `object-cover` → `object-contain`, `max-h-[28rem]` am Image-Container. |

---

## Decisions IT13 (Source of Truth — durch Orchestrator/QA festgelegt)

Diese Punkte sind **verbindlich entschieden** und überstimmen frühere
Open Questions:

1. **Datenlöschungs-URL:** `/datenschutz/datenloesung`.
2. **Scroll-API:** Hook `useScrollToSection(target)` (kein freistehendes
   `scrollToSection()`). Pflicht-Sequenz `rAF × 2 → scrollIntoView →
   heading.focus({ preventScroll: true })`.
3. **Header-Selector:** `[data-app-header]`.
4. **Modal-Body-Selector:** `[data-modal-body]` (mit optionalem
   `[data-modal-header]` für Modal-internen Sticky-Header).
5. **S07 Drei-Schicht-Modell:** Outer-Wrapper
   `bg-baerenstark-cream/60` (Letterbox-Token); Image-Container
   `bg-transparent`; `<Image>` `bg-transparent object-contain`.
6. **S08 Frame-Cap:** `max-h-[28rem]` am Image-Container.
7. **S05 Upload-Pfad:** Direct-Upload via `@vercel/blob/client`.
   `POST /api/upload/token` + `PATCH /api/upload/attachments/[id]` neu;
   alter `POST /api/upload` → 410 GONE.
8. **Adress-Banner-Link** geht auf den Anchor
   `/konto/profil#profile-section-address` (mit Auto-Scroll im
   Profil-Mount-`useEffect`).

## Open Questions (für QA / UX-Designer)

1. **Telefon-Prefill leeres Feld:** aktuell kein Hinweis, wenn
   `phone === null` im Profil. Soll IT13 einen dezenten Hinweis
   „Telefon aus Profil" anzeigen, wenn das Feld leer prefilled ist?
   Story-AC sagt: leer ohne Fehlermeldung — also kein Hinweis nötig,
   aber UX-Optimum wäre ein opt-in Hint. **Vorschlag: kein Hinweis,
   um Story-AC nicht zu verbiegen.**
2. **Service-Card-Hintergrund auf Startseite:** Drei-Schicht-Modell
   exakt so übernehmen wie auf Service-Detail-Page (Outer
   `bg-baerenstark-cream/60`)? Oder Karten-Outer-Wrapper darf eine
   andere Theme-Farbe (`bg-white/80`) haben? **Vorschlag: gleiche
   Token wie Detail-Page für Konsistenz.**
