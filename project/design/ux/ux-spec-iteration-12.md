# UX-Spezifikation — Iteration 12 (Bärenstark Hausservice)

> **Sprache:** Deutsch (Sie-Form, konsistent zu IT7–IT11).
> **Mobile-first:** 360 px Viewport zuerst, Desktop zusätzlich.
> **Stack:** Next.js 14 (App Router) + Tailwind + shadcn/ui. Brand-Tokens `baerenstark-*`, Feedback-Tokens `feedback-*` aus `design-system-iteration-10-additions.md`.
> **Bezug:** PROJECT.md §Iteration 12, Stories IT12-S01 bis IT12-S15.
> **Geltungsbereich:** Diese Spec ist Quelle der Wahrheit für die Iteration-12-Stories. Sie ergänzt — ersetzt nicht — `ux-spec.md` und `ux-spec-iteration-10.md`. Querverweise sind als „§…" im Text markiert.
> **Datum:** 2026-05-04.
> **Letztes Update:** 2026-05-04 (Phase-2-Revision nach QA — siehe §6 am Ende).

---

## 0. Iterations-Vision (UX-Sicht)

Iteration 12 ist eine **Bug-Fix- und Konsolidierungs-Runde**. Ziel: Tom Siefert (Inhaber, Admin) und seine Kunden erleben die Plattform als „funktioniert leise und vorhersehbar". Visuell wird wenig Neues hinzugefügt; stattdessen werden Reibungspunkte aus dem Live-Betrieb beseitigt: Kalender wird klickbar, Submissions liefern Feedback, Service-Detailseiten bekommen echte Bilder, der Admin-Bereich wird logisch neu gegliedert. Zwei echte neue Features: das **Konto-anbieten-Sheet** nach Gast-Buchung (IT12-S05) und der **Admin-Marketing-Mailer** (IT12-S15).

---

## 1. Globale UX-Konventionen für Iteration 12

Diese Konventionen gelten querschnittlich für alle Stories. Sie erweitern §1 von IT10.

### 1.1 Scroll-Stabilität (NEU systemisch — IT12-S04, IT12-S09)

Während eines mehrstufigen Form-Flows (Buchungsformular, Konto-anbieten-Modal) **muss die Scroll-Position des Browsers zwischen Field-Wechseln, Slot-Auswahl und Step-Wechseln stabil bleiben**. Erlaubte Ausnahmen:

| Erlaubt | Begründung |
|---------|-----------|
| Scroll auf erstes Fehlerfeld nach Submit (validation-error) | A11y-Standard, vom Nutzer erwartet |
| Scroll auf Erfolgs-Banner nach erfolgreichem Submit | Bestätigung des erfolgreichen Vorgangs |
| Scroll-Sprung beim Step-Wechsel im Buchungsformular **nur auf den neuen Step-Container** (nicht zum Seitenanfang) | Kontextuelle Orientierung |

Verboten:
- `window.scrollTo(0, 0)` bei `onChange`/`onBlur` einzelner Felder.
- Default-Submit eines `<button>` ohne `type="button"` innerhalb eines `<form>`-Kontexts.
- `router.refresh()` oder `router.push()` im `onChange`-Handler einer Auswahl.

### 1.2 Submit-Button-Lebenszyklus (NEU systemisch — IT12-S11)

Jeder primäre Submit-Button in der App folgt diesem 4-State-Lebenszyklus:

| State | Trigger | Sichtbar | Verhalten |
|-------|---------|----------|-----------|
| `idle` | Form gültig, kein Submit aktiv | Volltext-Label, Button enabled | Klick → `submitting` |
| `submitting` | nach Klick, vor Server-Antwort | Spinner-Icon links, Label „Wird gesendet…" oder kontextspezifisch (z. B. „Anfrage wird gesendet…"), Button disabled, `aria-busy="true"` | Doppelklicks blockiert. Min. Anzeigedauer 250 ms (verhindert Flash). |
| `success` | Server 2xx | Häkchen-Icon links, Label „Gesendet" für 1.5 s, Button bleibt disabled | Danach Redirect ODER Erfolgs-View ODER Idle-Reset (Form-spezifisch, siehe §3.2 IT12-S11). |
| `error` | Server 4xx/5xx oder Netzwerkfehler | Volltext-Label zurück, Button enabled, Fehler-Banner ODER Toast erscheint (siehe §1.5 IT10) | Re-Klick erlaubt. |

**Doppelklick-Schutz:** Submit-Handler verwendet einen `submittingRef` (oder `formState.isSubmitting` bei React Hook Form), der den zweiten Klick blockiert, **auch wenn die Button-`disabled`-Prop noch nicht gerendert ist** (Race-Condition zwischen State-Update und User-Input).

### 1.3 Login-State im Header (NEU systemisch — IT12-S07)

Der Header-Auth-Bereich muss **immer** den real-time Auth-Status zeigen. **Wichtig (Phase-2-Revision QA-M4):** Customer-Auth und Admin-Auth nutzen **unterschiedliche** Auth-Mechanismen — das beeinflusst direkt den Sync-Pattern:

| Bereich | Auth-Mechanismus | Sync-Pattern |
|---------|-------------------|--------------|
| **Customer** (`/konto`, `/buchung`, Public-Pages) | Custom JWT-Cookie (`src/lib/customer-session.ts`) — KEIN NextAuth | Eigener EventBus `customer-sync.ts` (siehe ARCHITECTURE_IT12.md §0.4) → `emitCustomerChanged()` + `router.refresh()` |
| **Admin** (`/admin/*`) | NextAuth (Google OAuth + Credentials) | `useSession().update()` + `router.refresh()` |

| Auth-Zustand | Header-Anzeige (Mobile) | Header-Anzeige (Desktop) |
|--------------|-------------------------|---------------------------|
| Nicht eingeloggt | „Anmelden"-Button (Primary) | „Anmelden"-Button (Primary) |
| Eingeloggt als Customer | Avatar-Initial + Hamburger → Drawer mit „Mein Konto", „Profil bearbeiten", „Abmelden" | Avatar-Initial + Vorname + ChevronDown → Dropdown „Mein Konto", „Profil bearbeiten", „Abmelden" |
| Eingeloggt als Admin (im `/admin`-Bereich) | siehe `admin-information-architecture.md` (eigene Top-Bar) | siehe `admin-information-architecture.md` |

**Konsistenz-Regel (überarbeitet):** Nach jeder Aktion, die den Auth-State verändern *könnte* (Login, Logout, Profil-Save, Konto-Erstellen aus Sheet, Storno):
- **Im Customer-Bereich:** `emitCustomerChanged()` aus `src/lib/customer-sync.ts` + `router.refresh()` (KEIN `useSession().update()` — gibt es nicht im Customer-Kontext).
- **Im Admin-Bereich:** `useSession().update()` + `router.refresh()`.
- Nie nur eines von beiden — Server-Komponenten in der gleichen Page brauchen `router.refresh()` für SSR-Neurender, Client-Components brauchen den jeweiligen State-Sync.

### 1.4 Profil-Prefill-Pattern (NEU systemisch — IT12-S08)

Wenn ein eingeloggter Customer ein Formular öffnet, das Felder enthält, die in seinem Profil hinterlegt sind, gilt:

- Felder werden **vorausgefüllt, aber editierbar** (kein `readonly`, kein `disabled`).
- Über jedem vorausgefüllten Block (Kontaktdaten / Adresse) erscheint ein dezenter Hinweis: „Aus Ihrem Profil übernommen — Sie können die Angaben für diese Anfrage anpassen." (`text-baerenstark-bark/70`, `text-sm`).
- Eine geänderte Eingabe **überschreibt nicht** das Profil. Profil-Änderungen erfolgen ausschließlich über `/konto/profil`.
- Fehlt ein Profil-Feld (z. B. keine Adresse hinterlegt), bleibt das Feld leer und zeigt sein Standard-Placeholder.
- Felder mit Profilwert haben kein „bereits vorausgefüllt"-Badge am Feld selbst (zu visuell laut). Stattdessen reicht der Block-Hinweis.

### 1.5 Loading-Skeletons vs. Spinner (Erinnerung an IT10 §1.6, präzisiert)

| Situation | Pattern |
|-----------|---------|
| Initial-Page-Load mit unbekannter Layout-Struktur | Skeleton-Layout mit Shapes |
| Initial-Page-Load mit bekannter Struktur, Daten kommen | Skeleton-Karten / -Tabellen-Zeilen |
| Submit / einzelner API-Call, dessen Antwort die UI nicht strukturell ändert | Inline-Spinner im Button |
| Kalender / Datumsraster mit langsamer API | **Skeleton-Raster** (Tage als graue Quadrate, NICHT Spinner) — siehe IT12-S03 |
| Re-Fetch nach Filter-Änderung (z. B. Marketing-Mail Empfängerliste) | Tabellen-Body wird transparent (`opacity-50`) + Spinner zentriert über Tabelle, Header bleibt klickbar |

---

## 2. Story-Coverage-Matrix

| Story | Klassifikation | UX-Aufwand | Sektion in dieser Spec | Neue Components |
|-------|----------------|------------|------------------------|------------------|
| IT12-S01 | Backend-Bug | none (UX-Validierung) | §3.1 | — |
| IT12-S02 | Frontend-Feature | hoch (Layout-Redesign) | §3.2 | `ServiceDetailHero` |
| IT12-S03 | Frontend-Bug | mittel (Loading-Pattern) | §3.3 | `BookingCalendarSkeleton`, `BookingDayCell` (refined) |
| IT12-S04 | Frontend-Bug | low (Verhaltens-Spec) | §3.4 | — |
| IT12-S05 | Frontend-Feature | hoch (neuer Flow) | §3.5 | `CreateAccountOfferSheet` |
| IT12-S06 | Backend-Bug | low (Empty/Error-Spec) | §3.6 | — |
| IT12-S07 | Frontend-Bug | mittel (Auth-Sync-Spec) | §3.7 | `AuthHeaderSlot` (refined) |
| IT12-S08 | Frontend-Feature | mittel (Prefill-Pattern) | §3.8 | `PrefillNotice` |
| IT12-S09 | Frontend-Bug | low (s. IT12-S04) | §3.4 | — |
| IT12-S10 | Backend-Bug | low (Error-Mapping) | §3.10 | — |
| IT12-S11 | Frontend-Bug | mittel (Submit-Lifecycle) | §3.11 | — |
| IT12-S12 | Backend-Bug | low (Empty/Error-Spec) | §3.12 | — |
| IT12-S13 | Backend-Bug | low (Empty/Error-Spec) | §3.13 | — |
| IT12-S14 | UX-Restrukturierung | sehr hoch | siehe `admin-information-architecture.md` | `AdminSidebar` (refined), `AdminBreadcrumb`, `AdminTabBar` |
| IT12-S15 | Neues Feature | sehr hoch | siehe `marketing-email-flow.md` | siehe `component-library-iteration-12.md` §6 |

---

## 3. Story-Specs

### 3.1 IT12-S01 — Google OAuth Bad Request (UX-Validierung)

**UX-Aufgabe:** Reine Verifikation. Der Login-Button und der Callback sind UX-mäßig unverändert (siehe `ux-spec.md` Auth-Flow).

**Verbindliche Acceptance:**
- Nach Klick auf „Mit Google anmelden" sieht der Nutzer **maximal 2 Sekunden** den Google-Consent-Screen, danach Redirect ins Dashboard.
- Bei Fehler **darf** keine technische Meldung („Bad Request", Stack-Trace) erscheinen. Stattdessen Page-Redirect auf `/konto/login?error=oauth` mit Banner: „Die Anmeldung mit Google ist gerade nicht möglich. Bitte versuchen Sie es erneut oder melden Sie sich mit E-Mail und Passwort an."
- Banner erhält `role="alert"` und ist via `tabIndex={-1}` fokussierbar.

---

### 3.2 IT12-S02 — Service-Detailseite: Foto + kleines Icon

**Route:** `/services/[slug]`
**Stories-Mapping:** IT12-S02
**Components:** neu `ServiceDetailHero` (siehe `component-library-iteration-12.md` §1)

#### 3.2.1 Designziel
Das aktuelle prominente Icon-Hero (großer Sand-/Holz-Container mit zentriertem Lucide-Icon) wirkt wie ein Platzhalter. Mit echten Fotos aus `/public/` rückt der Service emotional näher. Das Icon wird zur **sekundären visuellen Anker** und wandert links neben den Servicenamen — vergleichbar zu einer Section-Heading-Mark.

#### 3.2.2 Mapping Service → Bilddatei (verbindlich, mit Codebase synchronisiert)

> **Korrektur Phase-2-Revision (QA-C2):** Die Slugs entsprechen jetzt 1:1 dem `SERVICES`-Array aus `src/lib/services.ts`. Plurale (`entruempelungen`) und `-arbeiten`/`-schrott-metalle`-Suffixe sind raus. Diese Tabelle ist die einzige Wahrheit für Frontend-Engineer.

| Service-Slug (kanonisch) | Service-Name (UI) | Bilddatei (in `/public/`) |
|---------------------------|-------------------|----------------------------|
| `gruenflaechenpflege` | Grünflächenpflege | `grünflächenpflege.png` |
| `entruempelung` | Entrümpelungen | `entruemplungen.png` |
| `entkernung` | Entkernungsarbeiten | `entkernungsarbeiten.png` |
| `reinigung` | Reinigungsarbeiten | `reinigungsarbeiten.png` |
| `muelltonnenservice` | Mülltonnenservice | `mülltonnenservice.png` |
| `entsorgung` | Entsorgung Schrott & Metalle | `metal_schrott.png` |
| `sonstiges` | Sonstige Anfrage | (kein Hero-Bild — Fallback-Variant `<ServiceDetailHero variant="fallback">`) |

> **Engineer-Hinweis:** Umlaute in Dateinamen sind zulässig in Next.js (`<Image src="/grünflächenpflege.png" />`). Falls in Production CDN-Encoding-Probleme auftreten: Mapping in `serviceImageMap` als Konstante in `src/lib/service-images.ts` (vom Architect vorgeschlagen, §2 ARCHITECTURE_IT12.md) zentralisieren — dort wird das Encoding einmalig geklärt. Display-Name (Spalte „Service-Name (UI)") wird weiterhin aus dem Übersetzungs-/Service-Map gezogen, nicht aus dem Slug.

#### 3.2.3 Layout — Mobile (≤640 px)

```
┌─────────────────────────────────────┐
│  ← Zurück zur Übersicht             │   ← Breadcrumb-Link, text-sm
├─────────────────────────────────────┤
│  ┌───┐ Grünflächenpflege            │   ← Heading-Block: Icon 32×32 + h1
│  │ 🌿│                              │
│  └───┘                              │
│  Untertitel / Tagline               │   ← p, text-base, text-bark/80
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │       <ServiceDetailHero>       │ │   ← Foto, aspect-[4/3], full-width
│ │                                 │ │     border-radius-lg, shadow-md
│ │                                 │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│  Beschreibungstext (mehrere Absätze)│
│  …                                  │
├─────────────────────────────────────┤
│  Inkludiert / Leistungsumfang-Liste │
├─────────────────────────────────────┤
│  Preis-Hinweis-Card                 │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │  Anfrage stellen (Primary)  │    │   ← sticky-Bottom-CTA on Mobile
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

#### 3.2.4 Layout — Desktop (≥1024 px)

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Zurück zur Übersicht                                            │
├────────────────────────────────────────────────────────────────────┤
│  ┌────┐ Grünflächenpflege                                          │   ← Icon 40×40 + h1 (text-3xl)
│  │ 🌿 │                                                            │
│  └────┘ Untertitel / Tagline                                       │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  ┌────────────────────────┐ │
│  │                                  │  │  Beschreibungstext     │ │
│  │      <ServiceDetailHero>         │  │  ────────────────────  │ │
│  │     aspect-[3/2], 60% width      │  │  Inkludiert-Liste      │ │
│  │                                  │  │  ────────────────────  │ │
│  │                                  │  │  Preis-Hinweis         │ │
│  └──────────────────────────────────┘  │  ────────────────────  │ │
│                                        │  [Anfrage stellen]     │ │
│                                        └────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

#### 3.2.5 Hierarchie & Token-Spec

| Element | Mobile | Desktop |
|---------|--------|---------|
| Icon-Container neben h1 | 32×32 px (`w-8 h-8`), Icon 20px innen | 40×40 px (`w-10 h-10`), Icon 24px innen |
| Icon-Hintergrund | `bg-baerenstark-cream`, `rounded-md`, leichter Border `border-baerenstark-sand` | wie Mobile, etwas mehr Padding |
| H1-Größe | `text-2xl` (24px), `font-semibold` | `text-3xl` (30px), `font-semibold` |
| Icon-zu-H1-Gap | `gap-3` (12 px) | `gap-4` (16 px) |
| Foto Aspect-Ratio | `aspect-[4/3]` | `aspect-[3/2]` |
| Foto Border-Radius | `rounded-lg` (8 px) | `rounded-xl` (12 px) |
| Foto max-width | volle Spaltenbreite (16 px Page-Padding) | 60% der Content-Breite, max 640 px |

#### 3.2.6 State-Tabelle: `/services/[slug]`

| State | Trigger | Sichtbar | A11y / Microcopy |
|-------|---------|----------|-------------------|
| `loading` | Initial-Render, Bild noch nicht geladen | Skeleton 4:3-Block, `bg-baerenstark-sand/40 animate-pulse` | `aria-label="Bild wird geladen"` |
| `populated` | Bild + Text vollständig | Foto sichtbar, alle Texte gerendert | `<img alt="`{Service-Name}` — Beispielbild"`>` |
| `image-fallback` | Bild-Asset fehlt (`onError`) | Sand-Hintergrund-Block mit großem Icon (Lucide, 64 px), Text „Bild folgt in Kürze." `text-sm text-bark/60` | Kein 404-Tag, kein zerbrochenes `<img>` |
| `cta-disabled` | (kein Use-Case in IT12, nur Vollständigkeit) | — | — |

#### 3.2.7 Interactions

- Klick auf Foto: **kein Lightbox** in IT12 (Backlog).
- Klick auf „Anfrage stellen": Navigation zu `/buchung?service={slug}`.
- Hover über Foto (Desktop): leichte Skalierung `scale-[1.02]`, 200 ms ease-out. Auf `prefers-reduced-motion`: keine Animation.

#### 3.2.8 Acceptance — UX-spezifisch

- ✓ Auf Mobile bleibt das Foto **über dem Beschreibungstext** sichtbar (Above-the-Fold-Test bei 360×640 px).
- ✓ Icon ist visuell zweitrangig zum Foto: kein Icon größer als 40 px in IT12.
- ✓ Bei fehlendem Bild kein roter Browser-Fehler-Indikator (Console-Warning ist akzeptabel, sichtbarer DOM-Bruch nicht).

---

### 3.3 IT12-S03 — Buchungskalender: Loading + Klickbarkeit

**Route:** `/buchung` Schritt 3 („Wann?")
**Components:** `BookingCalendar` (refined), neu `BookingCalendarSkeleton`, refined `BookingDayCell` (siehe `component-library-iteration-12.md` §2)

#### 3.3.1 Loading-Pattern

Während die Verfügbarkeits-API antwortet (Erwartung: < 1.5 s nach Architect-Fix), zeigt der Kalender nicht einen einzigen zentralen Spinner, sondern ein **Skeleton-Raster**:

```
Mo Di Mi Do Fr Sa So
[░][░][░][░][░][░][░]
[░][░][░][░][░][░][░]
[░][░][░][░][░][░][░]
[░][░][░][░][░][░][░]
[░][░][░][░][░][░][░]
```

- 7×5 graue Quadrate (`bg-baerenstark-sand/30`, `animate-pulse`).
- Header (Wochentage) ist bereits real — Skeleton nur für Tageskacheln.
- Min-Anzeigedauer 200 ms (sonst Flash bei schnellem Cache-Hit).
- Begleittext **unter** dem Kalender (live-region): „Verfügbare Termine werden geladen…" mit `aria-live="polite"`.

#### 3.3.2 Day-Cell-States (kanonisch IT12)

| State | Visual | Interaktiv? | A11y |
|-------|--------|-------------|------|
| `available` | Cream-Hintergrund (`bg-baerenstark-cream`), Text `bark`, kleiner Punkt unten Mitte (`bg-feedback-success`) als Verfügbarkeits-Indikator | ja | `aria-label="{Datum}, verfügbar"`, `role="button"` |
| `available-hover` | `bg-baerenstark-sand/60`, Cursor-Pointer | ja | — |
| `available-focus` | Focus-Ring `ring-2 ring-baerenstark-bark` | ja | — |
| `selected` | `bg-baerenstark-bark`, Text `cream`, Punkt unten weiß | ja (Klick = abwählen) | `aria-pressed="true"` |
| `unavailable` | Hintergrund `bg-baerenstark-sand/15`, Text `bark/30`, kleines Schloss-Icon oder leerer Punkt | **nein** | `aria-disabled="true"`, `tabindex="-1"`, Tooltip on hover „Keine Termine verfügbar" |
| `past` | wie `unavailable`, zusätzlich diagonal durchgestrichen | nein | `aria-label="{Datum}, vergangen"`, `aria-disabled="true"` |
| `today` | Border `border-2 border-baerenstark-bark`, sonst wie der Verfügbarkeits-State | abhängig | `aria-current="date"` |
| `loading` (Skeleton) | siehe §3.3.1 | nein | `aria-busy="true"` |

**Click-Affordance:** Jede `available`-Zelle hat zusätzlich zum Hintergrund einen subtilen Schatten on hover (`shadow-sm`), damit der Nutzer den Klick visuell erwartet. Punkt-Indikator unten wechselt von Grün zu Voll-Cream im `selected`-State.

#### 3.3.3 Error-Fallback

Bei API-Fehler (5xx, Timeout):

```
┌────────────────────────────────────────────┐
│ ⚠  Termine konnten nicht geladen werden.   │
│    Bitte versuchen Sie es erneut.          │
│                                            │
│    [ Erneut laden ]   [ Anrufen: 0157… ]   │
└────────────────────────────────────────────┘
```

- Banner mit `role="alert"`, `aria-live="assertive"`, gefärbt `bg-feedback-error-bg`, Border `border-l-4 border-feedback-error-border`.
- „Erneut laden": triggert React-Query-Refetch.
- „Anrufen": `tel:+4915774787512` (Brand-Sprache, klickbar auf Mobile).

#### 3.3.4 State-Tabelle Buchungs-Schritt „Wann?"

| State | Trigger | Sichtbar | UI-Antwort |
|-------|---------|----------|------------|
| `idle` | Step betreten, kein Datum gewählt | Skeleton oder vollständiges Raster | Continue-Button **disabled** mit Tooltip „Bitte Datum wählen" |
| `loading` | API-Call läuft | Skeleton + Live-Region-Text | Continue-Button disabled |
| `populated-no-selection` | Kalender geladen, kein Tag ausgewählt | Verfügbare Tage interaktiv | Continue-Button disabled |
| `populated-with-selection` | Ein Tag ausgewählt | Tag visuell hervorgehoben, Slot-Liste rechts/unten erscheint | Continue-Button **enabled** |
| `error` | API 4xx/5xx oder Timeout | Error-Banner statt Kalender | Continue-Button disabled, „Erneut laden"-Button im Banner |
| `empty-month` | Kein Tag im aktuellen Monat hat Slots | Vollständiges Raster, alle Tage `unavailable`, **zusätzlich** Hinweis-Banner unter dem Kalender: „In diesem Zeitraum sind keine Termine frei. Versuchen Sie einen anderen Monat oder rufen Sie uns an." | Continue-Button disabled |

#### 3.3.5 Performance-UX-Garantien (verbindlich für Engineer)

- Erste Skeleton-Anzeige innerhalb von **100 ms** ab Step-Wechsel (kein „weißer Flash").
- Echtes Raster spätestens nach **1500 ms** (Acceptance-Kriterium aus PROJECT.md).
- Falls API > 3 s: Skeleton bleibt sichtbar, zusätzlich Live-Region „Wir laden noch — bitte einen Moment."
- Falls API > 8 s: Auto-Switch in `error`-State mit Retry-Button.

---

### 3.4 IT12-S04 + IT12-S09 — Scroll-Stabilität (Verhaltens-Spec)

**Routes:** `/buchung` (alle Schritte), insbesondere Schritt „Wie lange?" und Adress-/Beschreibungs-Schritt.

#### 3.4.1 Erwartetes Verhalten

| Aktion | Erwartete Scroll-Position |
|--------|---------------------------|
| Slot-Auswahl in „Wie lange?" | **unverändert** — Form-Position bleibt stabil, ausgewählter Slot bekommt nur visuelles Highlight. |
| Tab-Wechsel zwischen Eingabefeldern | unverändert |
| Klick in ein anderes Feld | unverändert |
| Tippen in einem Feld | unverändert |
| Step-Wechsel (Continue-Button) | Scroll auf den **Anfang des neuen Step-Containers** (nicht auf Page-Top); 300 ms smooth scroll, falls `prefers-reduced-motion: no-preference`. |
| Submit-Fehler (validation) | Scroll auf erstes Fehlerfeld + Fokus auf dieses Feld. |
| Submit-Erfolg | Scroll auf den Erfolgs-Banner / Erfolgs-Page-Top. |

#### 3.4.2 UX-Validierung

- Manueller Test: Auf Mobile (360×640) mit langem Form, Slot in der Mitte des Viewports auswählen → Slot bleibt im sichtbaren Bereich.
- Keyboard-Test: Tab-Reihenfolge führt durch alle Felder ohne unerwarteten Scroll.

(Implementierung ist Architect-Sache — siehe IT12-S04/S09 Architect-Hinweise. Diese Spec stellt nur die UX-Anforderung.)

---

### 3.5 IT12-S05 — Konto-anbieten-Sheet nach Gast-Buchung

**Route:** Buchungs-Erfolgsseite `/buchung/erfolg` (oder vergleichbarer Success-State im Buchungsfluss).
**Trigger:** Erfolgreiche Buchungs-Submission durch einen **nicht eingeloggten** Gast (`session?.user` ist `null`).
**Components:** neu `CreateAccountOfferSheet` (siehe `component-library-iteration-12.md` §3)

#### 3.5.1 Trigger-Zeitpunkt — Designentscheidung

**Gewählt:** Sheet erscheint **eingebettet im Success-Page-Body**, nicht als sofortiges Pop-up-Modal. Begründung:
1. Der Nutzer hat gerade einen wichtigen Schritt abgeschlossen (Buchung gesendet) — ein Pop-up direkt danach wirkt drängend und kann mit dem Bestätigungsmoment kollidieren.
2. Embedded-Card auf Erfolgsseite respektiert die Aufmerksamkeitshierarchie: zuerst Bestätigung („Anfrage gesendet"), dann Zusatzangebot.
3. Reduziert kognitive Last: kein Modal-Dismissal-Druck.

**Form-Faktor (Phase-2-Revision: vereinfacht — QA-Mn4 + Stakeholder-Antwort D):**
- **Desktop und Mobile gleich:** Eingebettete Card (`bg-baerenstark-cream`, `border-baerenstark-sand`) **unterhalb** der grünen Erfolgs-Bestätigung. Volle Spaltenbreite auf Mobile, max-width auf Desktop.
- **Kein Modal, kein Bottom-Sheet** — die Card ist immer Embedded, Passwort-Felder sind direkt innerhalb der Card sichtbar (kein Akkordeon, keine Variant-Switch).
- Diese Vereinfachung spart Code (kein Dialog/AlertDialog-Mount), reduziert Test-Aufwand und folgt der Stakeholder-Entscheidung „Embedded-Card auf Success-Seite".

#### 3.5.2 Page-Layout `/buchung/erfolg` (Gast)

```
┌──────────────────────────────────────────────────┐
│   ✓  Anfrage gesendet                             │
│   ──────────────────────                          │
│   Vielen Dank! Wir melden uns in Kürze unter      │
│   {email} oder {phone}.                           │
│                                                  │
│   Anfrage-Nr.: BST-2026-0042                     │
│   Termin: Mo, 12. Mai 2026, 09:00 Uhr            │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Möchten Sie ein Konto erstellen?                │   ← <CreateAccountOfferSheet />
│  ───────────────────────────────                 │
│  Mit einem Konto können Sie:                     │
│   • Ihre Anfragen jederzeit einsehen             │
│   • Den Status verfolgen                         │
│   • Schneller weitere Termine buchen             │
│                                                  │
│   E-Mail: tom@example.com  (vorausgefüllt)       │
│   ┌──────────────────────────────────┐           │
│   │ Passwort *                       │           │
│   └──────────────────────────────────┘           │
│   ┌──────────────────────────────────┐           │
│   │ Passwort wiederholen *           │           │
│   └──────────────────────────────────┘           │
│                                                  │
│   [ Konto erstellen (Primary) ]                  │
│   [ Nein, danke (Tertiary-Link) ]                │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│   Weitere Buchung anfragen →                     │
│   Zur Startseite →                               │
└──────────────────────────────────────────────────┘
```

#### 3.5.3 Flow-Diagramm

```
[Gast submitted Buchung] 
         │
         ▼
[POST /api/bookings → 201 Created]
         │
         ▼
[Redirect /buchung/erfolg?bookingId={id}&token={confirmationToken}]
         │
         ▼
[Erfolgsseite liest URL-Param `token`,
 ruft GET /api/customer/booking-summary?bookingId&token (für E-Mail/Vorname-Anzeige)
 ODER nutzt Server-Component-Fetch → rendert Success-Card + CreateAccountOfferSheet]
         │
   ┌─────┴──────────┐
   ▼                ▼
[Klick "Nein,    [Klick "Konto
 danke"]          erstellen"]
   │                │
   ▼                ▼
[Sheet kollab-   [Inline-Card entfaltet
 piert + bleibt    sich → Passwort-Form
 ausgeblendet     (auf Mobile gleiche
 für Session]     Embedded-Card, KEIN
                  Bottom-Sheet — siehe
                  Mn4-Vereinfachung)]
                    │
                    ▼
        [User füllt Passwort + Wiederholung]
                    │
                    ▼
        [POST /api/customer/register-from-booking
         { bookingId: "BST-2026-0042",
           confirmationToken: "ey…" (aus URL-Param `token`),
           password: "min12chars" }]
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
    [201 Created                [409 ACCOUNT_EXISTS]
     { customerId,
       linkedBookingsCount }]
        │                        │
        ▼                        ▼
[Backend hat Set-Cookie         [Sheet zeigt:
 in 201-Response gesetzt        "Diese E-Mail ist
 (Architect-SSOT §R.4 #1).      bereits registriert.
 Frontend ruft nur              Stattdessen anmelden?"
 emitCustomerChanged()          + [Anmelden]-Button
        │                       (Link → /konto/login
        ▼                        ?email={email})]
[Sheet wird ersetzt
 durch grünen Banner:
 "Konto erstellt! Sie
 sind jetzt angemeldet.
 {linkedBookingsCount}
 Anfragen verknüpft."
 + Link "Zu meinen
 Anfragen →"]
```

> **Phase-2-Revision (QA-C4/C5/M3):** Endpoint ist `POST /api/customer/register-from-booking` (Architect-SSOT, ARCHITECTURE_IT12.md **§R.4 Endpoint #1**). Request-Body: `{ bookingId, confirmationToken, password }` — KEINE `email`/`firstName`/`lastName` (Backend leitet diese aus dem Booking ab). Confirmation-Token wird aus dem URL-Query-Param `?token=…` gelesen, der bereits beim Buchungs-Submit erzeugt wird (siehe `BookingForm.tsx`). 409-Subcode ist `ACCOUNT_EXISTS` (NICHT `EMAIL_EXISTS`). Die 201-Response setzt direkt `Set-Cookie` — kein separater Login-Call nötig; Frontend ruft danach nur `emitCustomerChanged()` + `router.refresh()`.

#### 3.5.4 State-Tabelle `<CreateAccountOfferSheet />`

| State | Trigger | Sichtbar | Microcopy |
|-------|---------|----------|-----------|
| `idle-collapsed` | Erstdarstellung (Standard) | Card mit Vorteilen + 2 Inputs + 2 Buttons | Headline: „Möchten Sie ein Konto erstellen?" |
| `idle-loading-prefill` | E-Mail aus URL noch nicht geparst (sehr kurz) | Email-Feld mit Skeleton-Placeholder | — |
| `submitting` | Klick „Konto erstellen", API-Call läuft | Button mit Spinner, Inputs disabled, Label „Konto wird erstellt…" | — |
| `success` | Server 201 | Card-Inhalt wird ersetzt durch grüne Success-Card | „Konto erstellt! Sie sind jetzt angemeldet." + Link „→ Zu meinen Anfragen" |
| `account-exists` | Server 409 `ACCOUNT_EXISTS` | Inline-Banner über dem Form: orange | „Diese E-Mail ist bereits registriert. Möchten Sie sich stattdessen anmelden?" + Button „Anmelden →" (Link zu `/konto/login?email=...`) |
| `validation-error` | Passwort zu kurz / passt nicht überein | Inline-Feld-Fehler an betroffenen Inputs | „Passwort muss mindestens 8 Zeichen enthalten." / „Passwörter stimmen nicht überein." |
| `server-error` | Server 5xx oder Netzwerk | Banner unter Submit-Button | „Konto konnte gerade nicht erstellt werden. Bitte später erneut versuchen." |
| `dismissed` | Klick „Nein, danke" | Card wird durch dezenten Hinweis ersetzt | „Sie können jederzeit später ein Konto erstellen." (small text, link „→ Konto erstellen" führt zu `/konto/registrieren`) |

#### 3.5.5 Eingeloggte Customer

Wenn `session?.user` existiert und der Customer gerade eine Buchung abgeschickt hat:
- Sheet wird **nicht gerendert**.
- Stattdessen erscheint nur die normale Success-Card mit zusätzlichem Link „→ Zu meinen Anfragen".

#### 3.5.6 Session-Persistenz der Ablehnung

Wenn der Nutzer „Nein, danke" klickt: Setze `sessionStorage.setItem('accountPromptDismissed:' + bookingId, '1')` (per-Booking, QA-Mn5). Innerhalb der gleichen Browser-Session erscheint das Sheet **für genau diese Buchung** nicht erneut. Bei einer neuen Buchung (anderer `bookingId`) erscheint es wieder — dies entspricht dem Real-World-Verhalten: Ein Kunde stornt vielleicht, bucht neu, und will diesmal doch ein Konto.

#### 3.5.7 A11y / Keyboard

- Sheet hat `role="region"`, `aria-labelledby="account-offer-title"`.
- Auf Klick „Konto erstellen" wandert Fokus auf das Passwort-Feld.
- Embedded-Card auf allen Viewports — kein Modal/Dialog-Wrapper nötig, kein Focus-Trap, keine Escape-Schließung.
- Submit per Enter im Passwort-Feld erlaubt (verhindert nicht: Doppelklick-Schutz §1.2).

---

### 3.6 IT12-S06 — Kunden-Dashboard Anfragen-Fehler (Empty/Error-Spec)

**Route:** `/konto`
**UX-Aufgabe:** Architect fixt den Backend-Bug. UX bestätigt nur die drei sichtbaren States.

#### 3.6.1 State-Tabelle `/konto` (Bookings-Liste)

| State | Trigger | Sichtbar | Microcopy |
|-------|---------|----------|-----------|
| `loading` | Initial-Render | Skeleton: 3 Booking-Card-Shapes (`bg-sand/30`, `animate-pulse`) | (Live-Region: „Anfragen werden geladen…") |
| `populated` | API 200 mit Bookings | Liste der Booking-Cards (siehe `component-library.md` Booking-Card) | — |
| `empty` | API 200 mit `[]` | Empty-State-Card mit Lucide-Icon (`InboxIcon`, 48 px), Headline „Sie haben noch keine Buchungsanfragen.", Untertext „Stellen Sie Ihre erste Anfrage in wenigen Schritten.", Primary-Button „Jetzt Anfrage stellen →" | — |
| `error` | API 5xx | Error-Banner: `bg-feedback-error-bg`, Border, Headline „Anfragen konnten nicht geladen werden.", Untertext „Bitte versuchen Sie es in einer Minute erneut oder rufen Sie uns an: 0157-74787512.", Buttons „Erneut laden" + Anrufen | — |

**Verbindlich:** Im `error`-State **niemals** „Interner Serverfehler" als sichtbarer Text. Nutzer sieht freundliche Brand-Sprache, technische Details landen im Vercel-Log.

---

### 3.7 IT12-S07 — Login-State im Header

**Component:** `AuthHeaderSlot` (siehe `component-library-iteration-12.md` §4)

#### 3.7.1 Verhalten (siehe §1.3)

#### 3.7.2 Trigger-Liste „update Auth-State"

Nach jeder dieser Aktionen muss der **passende** Sync-Trigger aufgerufen werden (Customer- vs. Admin-Bereich, siehe §1.3):

| Aktion | Komponente / Route | Sync-Trigger | Reason |
|--------|---------------------|--------------|--------|
| Customer: Profil speichern | `/konto/profil` Submit | `emitCustomerChanged()` + `router.refresh()` | name/email könnte sich geändert haben → Header-Avatar/Name |
| Customer: Passwort ändern | `/konto/profil` Passwort-Section | `emitCustomerChanged()` + `router.refresh()` | (kein Display-Change, aber Cookie rotiert ggf.) |
| Customer: Konto erstellen aus Sheet | IT12-S05 Erfolgs-State (`/buchung/erfolg`) | `emitCustomerChanged()` + `router.refresh()` | von `null` zu eingeloggt |
| Customer: Logout | überall im Customer-Bereich | `emitCustomerChanged()` + `router.refresh()` | von eingeloggt zu `null` |
| Customer: Storno einer Buchung | `/konto` | nur `router.refresh()` (kein Auth-Change) | — |
| Admin: Login (NextAuth) | `/admin/auth/signin` Callback | `useSession().update()` + `router.refresh()` | NextAuth signIn |
| Admin: Logout (NextAuth) | überall im Admin-Bereich | `signOut()` (Redirect inkludiert) | — |

#### 3.7.3 Anti-Pattern (verbietet diese Spec)

- ❌ Customer-Bereich: nach `fetch('/api/customer/profile', { method: 'PATCH' })` nur `router.refresh()` ohne `emitCustomerChanged()` → Client-Komponenten (Avatar-Initial im Header) rendern mit alter Customer-Session.
- ❌ Customer-Bereich: `useSession()` aufrufen — gibt es nicht (kein NextAuth-SessionProvider im Customer-Kontext).
- ❌ Admin-Bereich: `signOut({ redirect: false })` ohne anschließendes `router.refresh()` → Header zeigt weiter eingeloggten Nutzer.
- ❌ Hardcoded `<Link href="/konto/login">Anmelden</Link>` in der Header-Komponente, ohne Auth-State-Conditional.
- ❌ Mischen der Patterns (z. B. NextAuth-`useSession` im Customer-Header) — führt zu Bugs, weil die Customer-Cookie ein anderer Mechanismus ist.

#### 3.7.4 State-Tabelle `<AuthHeaderSlot />`

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `loading` | Customer-Status wird beim Page-Mount aufgelöst (`/api/customer/me` läuft) | Skeleton: rundes Avatar-Shape `w-8 h-8 bg-sand/40 animate-pulse` |
| `unauthenticated` | `customer === null` (kein Cookie / abgelaufen) | Button „Anmelden" (Primary, kompakt) |
| `authenticated-customer` | `customer !== null` (Cookie-Validation OK) | Avatar (Initial) + Vorname (Desktop) / Avatar only (Mobile) → Dropdown bei Klick |
| `authenticated-admin` | NextAuth-Session vorhanden + `role === 'ADMIN'` (NUR im `/admin`-Layout sichtbar) | Im Public-Layout sieht Tom als Admin: derselbe Customer-Style, falls er auch als Customer angemeldet ist. Im `/admin`-Layout: separate Admin-Topbar (siehe IA-Spec). |

---

### 3.8 IT12-S08 — Buchungsformular-Prefill

**Route:** `/buchung` (alle Steps mit Eingabefeldern)
**Components:** `PrefillNotice` (neu, siehe `component-library-iteration-12.md` §5)

#### 3.8.1 Verhalten (gemäß §1.4)

#### 3.8.2 Field-Mapping

| Profil-Feld (`/api/customer/me`) | Buchungsformular-Feld | Verhalten bei fehlendem Profilwert |
|-----------------------------------|------------------------|-------------------------------------|
| `firstName` | „Vorname" | leer, Placeholder „Max" |
| `lastName` | „Nachname" | leer, Placeholder „Mustermann" |
| `email` | „E-Mail" | leer, Placeholder „max@example.com" |
| `phone` | „Telefon" | leer, Placeholder „0151 …" |
| `street` | „Straße & Hausnummer" | leer |
| `postalCode` | „PLZ" | leer |
| `city` | „Ort" | leer |

#### 3.8.3 PrefillNotice-Microcopy

Über dem Block „Ihre Kontaktdaten":

> ℹ Aus Ihrem Profil übernommen. Sie können die Angaben für diese Anfrage anpassen — Ihr Profil wird dadurch nicht verändert.

(Klein gesetzt, `text-sm`, `text-bark/70`, `bg-baerenstark-cream/50`, `rounded-md`, `px-3 py-2`. Icon: Lucide `InfoIcon` 16 px.)

Wenn KEIN Profilwert geladen werden konnte (z. B. Customer hat sich gerade nach OAuth ohne Adresse registriert):
- PrefillNotice **nicht** rendern.
- Kontaktdaten-Block zeigt leere Felder, Hint-Text „Falls Sie häufiger buchen, können Sie Ihre Daten in Ihrem [Profil →](/konto/profil) speichern."

#### 3.8.4 State-Tabelle Buchungsformular „Kontaktdaten"-Section

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `loading` | Profil-API antwortet noch | Felder mit Skeleton-Lines im Wertebereich (`bg-sand/30`, `h-4`, `w-3/4`) |
| `prefilled-with-notice` | Profil-API 200, Felder befüllt | PrefillNotice + befüllte Felder (editierbar) |
| `empty-no-notice` | Profil-API 200, alle Felder leer (z. B. neuer OAuth-User) | Felder leer + Soft-Hint „Daten in Profil speichern" |
| `partial-prefill` | Profil-API 200, einige Felder gefüllt, andere leer | PrefillNotice (Text leicht angepasst: „Einige Daten aus Ihrem Profil übernommen.") + gemischte Felder |
| `error-fallback` | Profil-API fehlgeschlagen | Felder leer, kein Notice, kein Fehler-Banner (Buchung soll nicht blockiert werden), nur Console-Log |

---

### 3.10 IT12-S10 — Bild-Upload Error-Mapping

**Route:** `/buchung` Upload-Step
**UX-Aufgabe:** Reines Error-Mapping (Architect fixt Backend).

#### 3.10.1 Microcopy-Mapping

| Server-Code | Sichtbare Meldung |
|-------------|-------------------|
| `400 FILE_TOO_LARGE` (Bild > 10 MB) | „Das Bild ist zu groß (max. 10 MB). Bitte verkleinern Sie das Bild und versuchen Sie es erneut." |
| `400 FILE_TOO_LARGE` (Video > 50 MB) | „Das Video ist zu groß (max. 50 MB). Bitte schneiden oder komprimieren Sie das Video." |
| `400 INVALID_FILE_TYPE` | „Dieses Dateiformat wird nicht unterstützt. Bitte JPEG, PNG oder MP4 hochladen." |
| `5xx INTERNAL_ERROR` | „Upload ist gerade nicht möglich. Bitte versuchen Sie es in einer Minute erneut oder fügen Sie das Bild später per E-Mail hinzu: kontakt@baerenstark-hausservice.app" |
| Network-Timeout | „Die Verbindung ist langsam — bitte prüfen Sie Ihr Netzwerk und versuchen Sie es erneut." |

**Verbindlich:** Niemals „INTERNAL_ERROR" als sichtbarer String, niemals Stack-Traces.

#### 3.10.2 State-Tabelle Upload-Komponente

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `idle` | Kein File ausgewählt | Drop-Zone „Bild oder Video hierher ziehen oder [auswählen]" |
| `selected` | File gewählt | Vorschau-Thumbnail + Dateiname + „× Entfernen" |
| `uploading` | Upload läuft | Vorschau + Progressbar `0–100%` + „Hochladen…" |
| `success` | Upload 201 | Vorschau + grünes Häkchen + URL gespeichert in Form-State |
| `error` | siehe Mapping | Inline-Fehler unter Drop-Zone, „Erneut versuchen"-Button |

---

### 3.11 IT12-S11 — Submit-Feedback Buchungsformular

**Route:** `/buchung` (finaler Submit)

#### 3.11.1 Submit-Lifecycle (gemäß §1.2)

Konkrete Microcopy-Variante:

| Phase | Button-Label | Icon | Sichtbar zusätzlich |
|-------|--------------|------|---------------------|
| `idle` | „Anfrage absenden" | (kein) | — |
| `submitting` | „Anfrage wird gesendet…" | Spinner (links) | Live-Region (`aria-live="polite"`): „Anfrage wird übermittelt — bitte warten." |
| `success` | „Gesendet" | Häkchen (links) | (sehr kurz, dann Redirect) |
| `error` | „Anfrage absenden" (zurück) | (kein) | Banner unter Button mit Fehler-Microcopy + Anruf-Fallback |

#### 3.11.2 Success-Verhalten — Designentscheidung

**Gewählt:** Nach Server-201 `Created`:
1. Button kurz im `success`-State (1 s).
2. **Redirect** auf `/buchung/erfolg?bookingId={id}` (Gast) bzw. `/konto?highlight={id}` (eingeloggter Customer).
3. Auf der Ziel-Page wird die neue Buchung visuell hervorgehoben — z. B. neuer Eintrag mit kurzer Pulse-Animation (1 s, `bg-feedback-success-bg/50` fadet auf normal).
4. Zusätzlich: Toast (Erfolg) unten zentriert (Mobile) bzw. oben rechts (Desktop): „Anfrage gesendet. Wir melden uns in Kürze."

**Begründung:**
- Inline-Erfolgs-Banner ohne Redirect lässt den Nutzer im Form mit alten Daten zurück → Verwirrung über „nochmal schicken?"
- Redirect auf Dashboard (für eingeloggte Customer) erfüllt direkt den nächsten User-Goal („meine Anfrage sehen").
- Highlight + Toast bestätigt den Erfolg auch nach Page-Wechsel ohne aufdringliches Modal.

#### 3.11.3 Error-Verhalten

Bei Server-Fehler:
- Loader verschwindet (Promise-`finally` reset Loading-State auch bei Catch).
- Submit-Button geht zurück in `idle` (re-klickbar).
- Banner unter Button: rot/Terracotta, Microcopy aus IT10 §1.5 Tabelle (`booking-submit-failed`).
- Form-Inhalt bleibt **vollständig erhalten** (kein Reset).
- Zusätzlich: Falls fehlerhafte Felder erkennbar (validation-error mit `errors[]`): Inline-Field-Errors am betroffenen Feld + Auto-Scroll zum ersten Feld (siehe §3.4.1 Ausnahme).

#### 3.11.4 Doppelklick-Schutz

- Submit-Handler nutzt `formState.isSubmitting` aus React Hook Form.
- Zusätzlich `useRef<boolean>(false)` als sofortiger Synchron-Guard:
  ```ts
  const submittingRef = useRef(false);
  const onSubmit = async (data) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try { ... } finally { submittingRef.current = false; }
  };
  ```

#### 3.11.5 State-Tabelle `<BookingSubmitButton>`

| State | Trigger | Sichtbar | A11y |
|-------|---------|----------|------|
| `idle` | Form valid | Label „Anfrage absenden", enabled | — |
| `idle-disabled` | Form invalid (z. B. Pflichtfeld leer) | Label, disabled, Tooltip „Bitte alle Pflichtfelder ausfüllen" | `aria-disabled="true"` |
| `submitting` | nach Klick | Spinner + „Anfrage wird gesendet…", disabled | `aria-busy="true"` |
| `success` | Server 201 | Häkchen + „Gesendet", disabled, 1 s sichtbar | — |
| `error` | Server 4xx/5xx | Label zurück, enabled, Banner darunter | — |

---

### 3.12 IT12-S12 — Admin-Dashboard „Bevorstehende Termine"

**Route:** `/admin` (Dashboard-Widget)

#### 3.12.1 State-Tabelle Widget „Bevorstehende Termine"

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `loading` | Initial | 3 Skeleton-Zeilen |
| `populated` | API 200 mit Terminen | Liste: Datum + Uhrzeit + Service + Customer-Name, Klick auf Zeile → Booking-Detail |
| `empty` | API 200 mit `[]` | Card-Inhalt: Lucide `CalendarCheckIcon` 32 px, Text „Keine bevorstehenden Termine in den nächsten 14 Tagen." |
| `error` | API 5xx | Inline-Error: „Termine konnten gerade nicht geladen werden." + „Erneut laden"-Button |

---

### 3.13 IT12-S13 — Admin „Buchungsanfragen"-Liste

**Route:** `/admin/bookings` (im neuen IA: unter „Kalender & Zeitmanagement → Buchungsanfragen")

#### 3.13.1 State-Tabelle

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `loading` | Initial | Tabellen-Skeleton (5 Zeilen) |
| `populated` | API 200 mit Bookings | Tabelle (siehe Component-Library Booking-Table) |
| `empty` | API 200 mit `[]` | Empty-Card: Lucide `FileTextIcon` 48 px, Headline „Keine Buchungsanfragen vorhanden.", Subtext „Neue Anfragen erscheinen hier automatisch." |
| `error` | API 5xx | Banner mit Retry-Button |

---

### 3.14 IT12-S14 — Admin-Navigation neu strukturieren

> Vollständige IA-Definition: siehe **`admin-information-architecture.md`** (separate Datei).

**Hier in dieser Spec:** State-Tabelle der Admin-Top-Level-Pages und Behavior bei Navigation.

#### 3.14.1 Cross-Page Behavior

- Aktive Sektion in der Sidebar visuell hervorgehoben (`bg-baerenstark-bark/10`, Border-Left `border-l-4 border-baerenstark-bark`).
- Aktive Subsektion: zusätzlicher inset-Marker.
- Breadcrumb oben: „Admin / Kalender & Zeitmanagement / Buchungsanfragen".
- Bei Sektionswechsel: kein Page-Reload, Client-Navigation. Scroll setzt zurück auf Section-Top (das ist erwünscht hier — Step-Wechsel-Pattern wie §3.4.1).

---

### 3.15 IT12-S15 — Admin Marketing-E-Mail

> Vollständige Flow-Definition: siehe **`marketing-email-flow.md`** (separate Datei).

**Verortung in der neuen IA:** Sektion „Nutzerverwaltung → Kunden → Aktion: E-Mail senden" (siehe IA-Spec). Begründung: Marketing-Mails sind keine Insights/Auswertung, sondern eine **Aktion auf einer gefilterten Kundenmenge**. Alternative Verortung „Insights" wurde geprüft und verworfen — Insights sind Lese-Daten, nicht Outbound-Aktionen.

#### 3.15.1 DSGVO-Variante 3 (Phase-2-Revision, Stakeholder-Antwort A)

Bärenstark sendet Marketing-Mails ausschließlich an **Bestandskunden** unter der UWG §7 Abs. 3-Sonderregel (Werbung an bestehende Kundenbeziehungen für ähnliche eigene Services). Die UX muss diese Compliance-Anforderungen sichtbar machen:

1. **Pflicht-Footer in jeder Mail** (Backend rendert automatisch, Composer zeigt ihn als nicht-editierbaren Block am Ende der Vorschau):
   > „Sie erhalten diese E-Mail, weil Sie bereits Kunde bei Bärenstark Hausservice waren. Sie können dem Erhalt weiterer Werbe-E-Mails jederzeit widersprechen: [Hier abmelden]({unsubscribeUrl}). Impressum: {impressumUrl}."

   Der Composer rendert diesen Block visuell deutlich abgesetzt (graue Trennlinie, `text-xs text-bark/60`), damit Tom versteht, dass dieser Text **automatisch** angefügt wird und nicht editierbar ist.

2. **Sender-Bestätigungs-Dialog mit Checkbox** (vor dem finalen POST):
   > Headline: „Sie werden eine Werbe-E-Mail an {n} Empfänger senden."
   > Body: „Bitte bestätigen Sie, dass diese Empfänger Bestandskunden sind und nicht widersprochen haben."
   > Pflicht-Checkbox: „Ich bestätige, dass alle ausgewählten Empfänger Bestandskunden im Sinne von § 7 UWG sind."
   > Buttons: [Abbrechen] (Initial-Fokus) | [Senden]

3. **Recipient-Liste zeigt `unsubscribed`-State** explizit:
   - Standard-Filter: „Hat widersprochen" ist **standardmäßig ausgeschlossen** — diese Customer erscheinen nicht in der Tabelle.
   - Toggle „Auch Widerspruchskunden anzeigen" (visuell deaktiviert/grau): zeigt Tom an, dass es solche Customer gibt, blendet sie aber nicht ein. Die Checkboxen für Widerspruchskunden sind permanent disabled und mit einem `aria-disabled="true"` + Tooltip „Dieser Kunde hat widersprochen — kann nicht angeschrieben werden" markiert.
   - In IT12 kann Tom widerspruchnde Customer **nicht** auswählen (Backend würde sie sowieso herausfiltern, das Frontend macht das transparent).
   - Re-Subscribe ist in IT12 **nicht** möglich (entspricht UWG-Praxis: Re-Opt-In nötig, kommt in IT13).

4. **Hard-Cap 50 Empfänger pro Send-Operation** (Stakeholder-Antwort C — Resend Free 100/Tag, Vercel Hobby 10s Timeout):
   - Wenn User > 50 Customer auswählt: Composer zeigt persistente Warnung im Step 1 „Empfänger prüfen":
     > „⚠ Maximal 50 Empfänger pro Versand. Bitte Selektion einschränken oder in mehreren Wellen senden."
   - Hilfe-Tooltip neben der Warnung („?"-Icon): „Limit kommt von unserem aktuellen E-Mail-Anbieter. Wird in einer kommenden Iteration erhöht."
   - Der „Weiter →"-Button ist disabled, solange > 50 Empfänger ausgewählt sind. Erst nach Reduktion (Tom geht zurück zur Customer-Tabelle, deselektiert) wird er enabled.
   - Detail-Spec: siehe `marketing-email-flow.md` §4.1 Edge-Cases.

#### 3.15.2 Unsubscribe-Page (Public)

**Backend-Endpoint:** `GET /api/customer/unsubscribe?token=…` (öffentlich, kein Auth, HMAC-Token, stateless — Architect-SSOT §R.4 Endpoint #11 + §R.5).
**Result-Page-Route:** `/marketing/abgemeldet?ok=1` (Erfolg) bzw. `?error=invalid` (Token ungültig). Backend redirected nach Token-Verifikation per 302 auf diese Page.

**Layout (Mobile-first, minimal):**

```
┌──────────────────────────────────────┐
│        🐻  Bärenstark Hausservice    │   ← Mini-Logo, kein voller Header
├──────────────────────────────────────┤
│                                      │
│  ✓  Sie wurden erfolgreich abgemeldet│  ← role="status"
│                                      │
│  Sie erhalten keine weiteren         │
│  Werbe-E-Mails von uns.              │
│                                      │
│  Buchungs- und Service-bezogene      │
│  E-Mails (Bestätigungen, Erinnerungen│
│  zu aktiven Aufträgen) werden weiter │
│  zugestellt.                         │
│                                      │
│  [Zur Startseite →]                  │
│                                      │
└──────────────────────────────────────┘
```

**State-Tabelle:**

| State | Trigger | Sichtbar | Microcopy |
|-------|---------|----------|-----------|
| `success` | Token valide, Backend hat `unsubscribed=true` gesetzt | Grüne Card mit Häkchen-Icon | „Sie wurden erfolgreich abgemeldet." + Erläuterungstext (siehe oben) |
| `error-invalid` | Token nicht in DB / Hash-Mismatch | Orange Card mit Warn-Icon | „Link ungültig oder abgelaufen. Falls Sie sich abmelden möchten, antworten Sie bitte direkt auf eine unserer E-Mails." |
| `error-server` | Backend 5xx | Banner: „Aktion konnte nicht durchgeführt werden. Bitte später erneut versuchen oder antworten Sie auf eine unserer E-Mails." | — |

**A11y:**
- `<main role="main" aria-labelledby="unsubscribe-title">`.
- Success-Variant: `role="status"`, `aria-live="polite"`.
- Error-Variant: `role="alert"`, `aria-live="assertive"`.
- Page-`<title>`: „Abmeldung — Bärenstark Hausservice".
- Kein Re-Subscribe-Button in IT12 (Backlog IT13).

#### 3.15.3 Verbindliche Acceptance (DSGVO-relevant)

- ✓ Footer-Pflichttext erscheint in **jeder** versandten Marketing-Mail.
- ✓ Composer-Vorschau zeigt den Footer als nicht-editierbaren Block.
- ✓ Sender-Dialog hat Pflicht-Checkbox „Bestandskunden bestätigt".
- ✓ Customer mit `unsubscribed=true` können nicht ausgewählt werden (Frontend disabled, Backend filtert zusätzlich).
- ✓ `/unsubscribe?token=…` ist öffentlich erreichbar, ohne Login.
- ✓ Hard-Cap 50: User kann den Wizard nicht starten mit > 50 Empfängern.

---

## 4. Globale Microcopy-Bibliothek (IT12-Ergänzungen)

| Slot | Microcopy |
|------|-----------|
| Submit-Loading-Default | „Wird gesendet…" |
| Submit-Loading-Buchung | „Anfrage wird gesendet…" |
| Submit-Loading-Marketing | „E-Mails werden versandt…" |
| Submit-Loading-Konto-erstellen | „Konto wird erstellt…" |
| Submit-Success-Toast (Buchung) | „Anfrage gesendet. Wir melden uns in Kürze." |
| Submit-Success-Toast (Konto) | „Konto erstellt. Sie sind jetzt angemeldet." |
| Submit-Success-Toast (Marketing) | „{n} E-Mails versandt." |
| Empty-State-Booking-Liste (Customer) | „Sie haben noch keine Buchungsanfragen." |
| Empty-State-Booking-Liste (Admin) | „Keine Buchungsanfragen vorhanden." |
| Empty-State-Termine (Admin) | „Keine bevorstehenden Termine in den nächsten 14 Tagen." |
| Prefill-Notice | „Aus Ihrem Profil übernommen. Sie können die Angaben für diese Anfrage anpassen." |
| Konto-anbieten-Headline | „Möchten Sie ein Konto erstellen?" |
| Konto-anbieten-Decline | „Nein, danke" |
| Konto-anbieten-Submit | „Konto erstellen" |
| Konto-anbieten-Success | „Konto erstellt! Sie sind jetzt angemeldet." |
| E-Mail-existiert-Hint | „Diese E-Mail ist bereits registriert. Möchten Sie sich stattdessen anmelden?" |
| Marketing-Footer-Pflichttext (automatisch) | „Sie erhalten diese E-Mail, weil Sie bereits Kunde bei Bärenstark Hausservice waren. Sie können dem Erhalt weiterer Werbe-E-Mails jederzeit widersprechen: [Hier abmelden]({unsubscribeUrl}). Impressum: {impressumUrl}." |
| Marketing-Sender-Dialog-Headline | „Sie werden eine Werbe-E-Mail an {n} Empfänger senden." |
| Marketing-Sender-Dialog-Body | „Bitte bestätigen Sie, dass diese Empfänger Bestandskunden sind und nicht widersprochen haben." |
| Marketing-Sender-Dialog-Checkbox | „Ich bestätige, dass alle ausgewählten Empfänger Bestandskunden im Sinne von § 7 UWG sind." |
| Marketing-Hard-Cap-Warnung (> 50) | „⚠ Maximal 50 Empfänger pro Versand. Bitte Selektion einschränken oder in mehreren Wellen senden." |
| Marketing-Hard-Cap-Tooltip | „Limit kommt von unserem aktuellen E-Mail-Anbieter. Wird in einer kommenden Iteration erhöht." |
| Marketing-Recipient-Unsubscribed-Tooltip | „Dieser Kunde hat widersprochen — kann nicht angeschrieben werden." |
| Unsubscribe-Page-Success | „Sie wurden erfolgreich abgemeldet." |
| Unsubscribe-Page-Success-Body | „Sie erhalten keine weiteren Werbe-E-Mails von uns. Buchungs- und Service-bezogene E-Mails werden weiter zugestellt." |
| Unsubscribe-Page-Error | „Link ungültig oder abgelaufen. Falls Sie sich abmelden möchten, antworten Sie bitte direkt auf eine unserer E-Mails." |

---

## 5. Cross-Cutting Acceptance — Iteration 12

- ✓ Keine Page in IT12-S03/S05/S06/S08/S11/S12/S13 zeigt einen rohen Fehler-String wie „INTERNAL_ERROR", „500", „Internal Server Error".
- ✓ Jeder Submit-Button folgt §1.2 (idle/submitting/success/error).
- ✓ Jeder Auth-State-Change folgt §1.3 (`update()` + `router.refresh()`).
- ✓ Kein `window.scrollTo(0, 0)` in `onChange`/`onBlur`-Handlern.
- ✓ Alle neuen Components (`ServiceDetailHero`, `BookingCalendarSkeleton`, `CreateAccountOfferSheet`, `PrefillNotice`, `MarketingEmailComposer`, `RecipientPicker`) haben dokumentierte ARIA-Rollen und Keyboard-Verhalten in `component-library-iteration-12.md`.
- ✓ Bestehende `tailwind.config.ts`-Tokens (`baerenstark-*`, `feedback-*`, `status-*`) werden ausschließlich verwendet — keine neuen Hex-Werte in IT12.

---

## 6. Phase-2-Revision (Post-QA)

> **Datum:** 2026-05-04. **Anlass:** `QA_DESIGN_REVIEW_IT12.md` (8 Critical, 12 Major Issues). Diese Sektion fasst die UX-relevanten Änderungen zusammen, die nach dem QA-Review eingearbeitet wurden.

### 6.1 Change-Log

| # | QA-Issue | Sektion in dieser Spec | Änderung |
|---|----------|-------------------------|----------|
| 1 | C2 | §3.2.2 | Service-Slugs auf Codebase-`SERVICES`-Array aligned: `entruempelung` (singular), `entkernung`, `reinigung`, `entsorgung`, `gruenflaechenpflege`, `muelltonnenservice`, `sonstiges`. Die Display-Names („Entrümpelungen" etc.) bleiben — sie kommen aus der separaten i18n-/Service-Map. |
| 2 | C3 | §3.2 + global | Alle Verweise `/leistungen/[slug]` → `/services/[slug]` (Codebase-Realität). |
| 3 | C4 / M3 | §3.5.3 + §3.5.4 | S05-Endpoint auf `POST /api/customer/register-from-booking` (Architect-SSOT). Request-Body: `{ bookingId, confirmationToken, password }`. Confirmation-Token wird aus URL-Param `?token=…` gelesen. Response 201 enthält `linkedBookingsCount`, in Success-Microcopy aufgenommen. |
| 4 | C5 | §3.5.4 | 409-Subcode `EMAIL_EXISTS` → `ACCOUNT_EXISTS`. Banner-State umbenannt von `email-exists` → `account-exists`. |
| 5 | C6 | §3.15.2 + §3.15.3 | Marketing-Endpoints aus Architect-SSOT **§R.4** synchronisiert: `GET /api/admin/marketing/recipients`, `POST /api/admin/marketing/emails` (2-stage draft → send), `POST .../{id}/test-send`, `POST .../{id}/send`, `GET .../{id}`, `GET .../`, `GET /api/customer/unsubscribe`. UX-Doku-Verweise mit Verlinkung auf `marketing-email-flow.md` §7. |
| 6 | C7 + Stakeholder-Antwort A | §3.15.1 | DSGVO-Variante 3 dokumentiert: UWG §7 Abs. 3 Bestandskunden-Sonderregel. Pflicht-Footer in jeder Mail, Sender-Bestätigungs-Dialog mit Checkbox, `unsubscribedAt`-Filter im Recipient-Picker (Architect-SSOT §R.5: 2 Spalten direkt auf `CustomerUser`). |
| 7 | C8 | §3.15 + Querverweis | Test-Send-Endpoint **finalisiert** in Architect-SSOT: `POST /api/admin/marketing/emails/{id}/test-send` (§R.4 #7 + §R.7). Setzt `status === 'draft'` voraus → Composer braucht Auto-Save vor Test-Send. UI-Button aktiviert, sobald Draft existiert. |
| 8 | M4 | §1.3 + §3.7 | Customer- vs. Admin-Auth-Sync getrennt: Customer nutzt eigenen EventBus (`emitCustomerChanged()` aus `src/lib/customer-sync.ts`), Admin nutzt NextAuth `useSession().update()`. Anti-Patterns explizit dokumentiert. |
| 9 | M5 | §3.8.2 | Profil-Feld-Naming: TODO: align with ARCHITECTURE_IT12.md SSOT — Architect bestätigt im echten DTO, ob `street` oder `streetAndNumber` Pflicht ist. Field-Mapping-Tabelle wird beim nächsten Build-Tag-1 finalisiert. |
| 10 | M7 | §3.10.1 | Status-Code-Mapping: 5xx-Block vereinfacht zu „500 INTERNAL_ERROR" (kein 502 mehr im Frontend-Parse) — siehe Microcopy-Tabelle. |
| 11 | Mn4 (Stakeholder-Antwort D) | §3.5.1 + §3.5.7 | Embedded-Card auf Success-Seite — kein Mobile-Bottom-Sheet mehr. Variant-Set in Component-Library entsprechend reduziert. |
| 12 | Mn5 | §3.5.6 | sessionStorage-Flag per-Booking: `'accountPromptDismissed:' + bookingId` statt globalem `'booking-account-offer-dismissed'`. |
| 13 | Mn6 | §1.3 + Microcopy-Bibliothek | Customer-Dropdown-Items: „Mein Konto" → `/konto`, „Profil bearbeiten" → `/konto/profil`, „Abmelden". |
| 14 | Mn9 | §4 (Microcopy-Bibliothek) | Marketing-Footer-Pflichttext + Hard-Cap-Microcopy + Sender-Dialog-Microcopy + Unsubscribe-Page-Microcopy als verbindliche Slots aufgenommen. |
| 15 | Hard-Cap 50 (Stakeholder-Antwort C) | §3.15.1 + Microcopy | Frontend zeigt Warnung + disabled „Weiter →"-Button, wenn > 50 Empfänger ausgewählt. Tooltip erklärt das Limit als Anbieter-Beschränkung. |

### 6.2 Offene Punkte (nach QA, an Architect/Orchestrator)

- ~~Architect-SSOT-Endpoint-Tabelle~~ ✓ Finalisiert in ARCHITECTURE_IT12.md **§R.4 (Phase-2-Revision)**. Alle UX-Specs sind dort synchronisiert. Aktuelle Endpoint-Pfade in dieser Datei sind die SSOT.
- ~~C1 (NEXTAUTH_URL)~~ ✓ Architect hat `.env.production` korrigiert (§R.1). DevOps muss Vercel-Production-Env nachziehen.
- **M1/M2 (Performance + Indexe S03):** Architect/Backend-Sache (§R.8), UX-Spec-AC bleibt unverändert (< 1500 ms vom Step-Wechsel zum Grid).
- **M5 (Profil-Feld-Naming):** Architect bestätigt vor Build-Tag 1 (Backend-DTO-Field-Name `street` vs. `streetAndNumber`).
- ~~M8 (Idempotency-Key Booking-Submit)~~ ✓ Architect-SSOT §R.8: `Idempotency-Key`-Header als UUID, Backend-Cache 24h. Frontend generiert Key per `useRef`. UX-neutral.
- ~~M11/M12 (Send-Failure-Recovery)~~ ✓ Architect-SSOT §R.6: Hard-Cap 50 + synchroner Send eliminieren das Recovery-Problem in IT12. Quota-Anzeige (Heute X/100) wird im Composer gerendert.
- **Auto-Save Draft im Composer:** Architect klärt Auto-Save-Timing (Debounce vs. expliziter Button). UX-Default-Empfehlung: 1.5s Debounce nach letztem Edit, mit „Entwurf gespeichert ✓"-Indikator.

---

*Ende der UX-Spec Iteration 12 (Phase-2-Revision).*
