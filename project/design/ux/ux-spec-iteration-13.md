# UX-Spezifikation — Iteration 13 (Bärenstark Hausservice)

> **Sprache:** Deutsch, **Du-Form** (konsistent zu IT12 — Master-Spec verwendet vorwiegend „Sie"; IT13-Stories nutzen Du-Form. Diese Spec hält **Du-Form als Default für IT13-neue Texte**, Bestandstexte aus IT10–IT12 werden nicht angefasst).
> **Mobile-first:** 360 px Viewport zuerst, Desktop zusätzlich.
> **Stack:** Next.js 14 (App Router) + Tailwind + shadcn/ui. Brand-Tokens `baerenstark-*`, Feedback-Tokens `feedback-*`.
> **Bezug:** `project/user-stories/iteration-13.md`, Stories IT13-S01 bis IT13-S08.
> **Geltungsbereich:** Diese Spec ist Quelle der Wahrheit für die Iteration-13-Stories. Sie ergänzt — ersetzt nicht — `ux-spec.md`, `ux-spec-iteration-12.md`. Nicht enthaltene Stories (IT13-S05, IT13-S06) sind Backend-Bugs ohne UX-Delta.
> **Datum:** 2026-05-04.

---

## 0. Iterations-Vision (UX-Sicht)

Iteration 13 räumt **sichtbare** Reibung aus Toms Live-Test ab und bereitet Facebook-OAuth vor:
- Scroll-Verhalten in allen Wizards wird **deterministisch** und barrierefrei (S03).
- Eingeloggte Nutzer sehen ihre Daten **in jedem Formular** vorausgefüllt — auch im Kontaktformular (S04).
- PNG-Bilder im Service-Bereich zeigen ihre echte Transparenz auf dem Brown/Beige-Theme (S07).
- Service-Detail-Bilder werden **vollständig** im Frame gezeigt — kein Cropping mehr (S08).
- Datenlöschungsseite (S01) und Facebook-Login-Button (S02) machen Facebook-OAuth-App-Review-fähig.

Visuell wird **wenig Neues** hinzugefügt; Schwerpunkt liegt auf Konsistenz und Compliance.

---

## 1. Globale Konventionen IT13 (Erweiterung von IT12 §1)

### 1.1 Scroll-Verhalten in Wizards (NEU systemisch — IT13-S03, ersetzt IT12 §1.1 Pkt. „Step-Wechsel-Scroll")

**Geltungsbereich:** Alle mehrstufigen Auswahl-Flows (Buchungsformular `/buchen`, Quick-Booking-Modal, Profil-Bearbeiten-Formular, Kontaktformular sofern vorhanden).

#### 1.1.1 Definition: „Section-Anchor"

Jede Wizard-Sektion bekommt einen festen DOM-Knoten, der als Scroll-Ziel und Focus-Ziel dient:

```html
<section
  id="step-when"
  data-section-anchor="when"
  aria-labelledby="step-when-heading"
  tabindex="-1"
  class="scroll-mt-[var(--header-offset)]"
>
  <h2 id="step-when-heading" tabindex="-1">Wann passt es dir?</h2>
  ...
</section>
```

- Die **Section** trägt `data-section-anchor` für JS-Selektion.
- Das **Heading** trägt `tabindex="-1"`, damit es **fokussierbar** ist, ohne im Tab-Order zu erscheinen.
- Tailwind-Utility `scroll-mt-[var(--header-offset)]` (entspricht `scroll-margin-top`) sorgt CSS-seitig dafür, dass `scrollIntoView` den Sticky-Header berücksichtigt.

#### 1.1.2 Sticky-Header-Offset (verbindlich)

| Viewport | Header-Höhe (gemessen aus `Header.tsx`: Logo `h-10` + Padding) | `--header-offset` |
|----------|----------------------------------------------------------------|--------------------|
| Mobile (`< 640 px`) | 64 px (Logo `h-10` + `py-2.5`) | **80 px** (= 64 + 16 Buffer) |
| `sm` und größer (`≥ 640 px`) | 80 px (Logo `h-12` + `py-3`) | **96 px** (= 80 + 16 Buffer) |

**Engineer-Hinweis:** Der Header-Offset wird als CSS-Variable in `globals.css` an `:root` gesetzt:

```css
:root {
  --header-offset: 80px;
}
@media (min-width: 640px) {
  :root {
    --header-offset: 96px;
  }
}
```

**Alternative — JS-dynamisch (empfohlen):** Beim Mount via `useEffect` die echte Header-Höhe messen und CSS-Variable setzen, damit zukünftige Header-Höhenänderungen automatisch greifen:

```ts
const header = document.querySelector('[data-app-header]') as HTMLElement | null;
if (header) {
  document.documentElement.style.setProperty(
    '--header-offset',
    `${header.offsetHeight + 16}px`
  );
}
```

> **Acceptance-Mapping S03:** „Header-Höhe dynamisch via `document.querySelector('[data-header]')?.offsetHeight` ermitteln — nicht hardcoden." → Selektor präzisiert auf `[data-app-header]` (siehe Component-Library-IT13 §1).

#### 1.1.3 Trigger-Zeitpunkt (Scroll + Focus)

| Trigger | Wann scrollt? | Wann fokussiert? |
|---------|----------------|-------------------|
| Step-Wechsel im Wizard (z. B. nach Datums-, Dauer- oder Slot-Auswahl) | **nach Render** der nächsten Sektion (`useEffect` mit `requestAnimationFrame`-Doppel-Sprung) | direkt nach Scroll-Start: `<h2>` der Zielsektion bekommt programmatischen Fokus (`elementRef.current?.focus({ preventScroll: true })`) |
| Validation-Error nach Submit | nach Render der Fehler-Banner | erstes fehlerhaftes Feld |
| Erfolg (Submit 2xx) | nach Redirect-Render (Erfolgsseite) | Erfolgs-Heading |

**Reihenfolge im Code (verbindlich):**
```ts
// Wenn `currentStep` sich ändert:
useEffect(() => {
  const node = document.querySelector(`[data-section-anchor="${currentStep}"]`);
  if (!node) return;

  // 1. Doppeltes rAF: warten bis Layout/Paint des neuen Steps abgeschlossen ist.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // 2. Scroll
      node.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      // 3. Focus auf Heading (nicht auf Section selbst — sonst liest Screen-Reader nichts Konkretes vor)
      const heading = node.querySelector('h2[tabindex="-1"], h3[tabindex="-1"]') as HTMLElement | null;
      heading?.focus({ preventScroll: true });
    });
  });
}, [currentStep, prefersReducedMotion]);
```

#### 1.1.4 Smooth vs. Instant — `prefers-reduced-motion`

| Media-Query-State | `behavior`-Wert |
|-------------------|------------------|
| `prefers-reduced-motion: no-preference` (Default) | `'smooth'` |
| `prefers-reduced-motion: reduce` | `'auto'` (= instant Sprung, kein Smoothing) |

Detection: `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. In React via `useReducedMotion()`-Hook (Tailwind/framer-motion-Utility — falls nicht verfügbar, eigener Hook in `src/hooks/useReducedMotion.ts`).

#### 1.1.5 Scroll-Container im Modal

**Edge-Case Quick-Booking-Modal** (IT13-S03 AC „Modal-Inneres scrollen, nicht das Hintergrunddokument"):

- Im Modal-Kontext ist der Scroll-Container nicht `window`, sondern die innere Modal-Body-Div (`<div class="overflow-y-auto" data-modal-body>...</div>`).
- `scrollIntoView` mit Standard-Optionen scrollt **automatisch** den nächsten scrollbaren Vorfahren — funktioniert also korrekt, solange der Modal-Body `overflow-y-auto` und eine begrenzte Höhe hat.
- **`scroll-margin-top` der Section gilt auch hier** — wird relativ zum Modal-Body interpretiert.
- Im Modal **muss** kein Header-Offset eingerechnet werden (Modal hat keinen Sticky-Header), aber ein kleiner Komfort-Buffer (16 px) ist erlaubt — daher Section-Tailwind-Klasse: `scroll-mt-[var(--header-offset)] data-[in-modal]:scroll-mt-4`.

#### 1.1.6 Wizard-Sektions-Reihenfolge (Buchungsformular)

Verbindliche Reihenfolge der Section-Anchors (Master-Spec ux-spec.md Stand IT11/IT12 referenziert):

1. `service` — Service-Auswahl (Karten)
2. `when` — Datums-Picker
3. `duration` — Dauer-Auswahl (z. B. Stunden, Pauschal)
4. `time-slot` — Zeitslot-Picker
5. `contact` — Kontaktdaten (Vorname, Nachname, E-Mail, Telefon)
6. `address` — Adresse (Straße, PLZ, Ort)
7. `description` — Beschreibung + Datei-Anhänge
8. `confirm` — Zusammenfassung + Datenschutz-Checkbox + Submit

Ein Wechsel `from → to` triggert immer Scroll + Focus auf das `to`-Heading. **Ausnahme:** Initial-Mount des Formulars triggert **kein** Auto-Scroll (Nutzer landet natürlich am Page-Anfang).

---

### 1.2 Profil-Prefill-Pattern (Erweiterung IT12 §1.4 für IT13-S04)

IT12 §1.4 etabliert das Prefill-Pattern für das Buchungsformular. IT13-S04 erweitert es **ohne semantische Änderung** auf:
- Profilformular `/konto/profil` (war in IT12 schon implementiert).
- Kontaktformular (sofern vorhanden — siehe §3.4 unten).

**Erweiterung — visuelles Feedback (verfeinert):**

Über jedem vorausgefüllten Block (Kontaktdaten, Adresse) erscheint **genau ein** dezenter Block-Hinweis (kein Per-Field-Badge, das war schon IT12-Konsens):

```
┌───────────────────────────────────────────────────────┐
│ ℹ Aus deinem Profil übernommen.                       │
│   Du kannst die Angaben für diese Anfrage anpassen —  │
│   dein Profil wird dadurch nicht verändert.           │
└───────────────────────────────────────────────────────┘
```

**Ton:** Du-Form (IT13-Default für neue Microcopy). IT12-Bestand „Sie"-Form bleibt — **kein** Refactor, weil Story IT13-S04 nur Funktionalität, nicht Texte ändert.

**Verbindlich neu in IT13-S04 — Verhalten bei „User überschreibt Wert":**

| Aktion | Profil-Update? |
|--------|------------------|
| User editiert vorausgefülltes Feld (z. B. Adresse für Großmutters Wohnung) | **Nein** — nur lokal in dieser Buchung |
| User klickt am Ende „Anfrage senden" mit geänderter Adresse | Buchung verwendet geänderte Adresse, Profil bleibt **unverändert** |
| User möchte das Profil aktualisieren | nur über `/konto/profil` möglich (separater Submit) |

Diese Regel ist explizit in der UI als Hinweis hinter dem Block-Notice formuliert: „dein Profil wird dadurch nicht verändert."

**Edge-Case — Logout während offener Formular-Sitzung:**

| Schritt | UX-Verhalten |
|---------|----------------|
| User ist eingeloggt, hat Buchungsformular geöffnet, vorausgefüllt | normaler Flow |
| User klickt im Header „Abmelden" (z. B. anderer Tab → Cookie weg) | Formular bleibt geöffnet, **Werte bleiben sichtbar** (im React-State bereits gehalten) |
| User klickt „Anfrage senden" | Submit läuft als **Gast-Buchung** (eingegebene Daten werden mitgeschickt). Server prüft Cookie nicht zwingend → 201 möglich. Falls Server 401 zurückgibt: Inline-Banner „Bitte erneut anmelden" mit Login-Link, Form-Inhalt bleibt erhalten. |
| User wechselt in den nächsten Step und ein neuer Prefill-Call würde ausgelöst | Da Cookie weg, antwortet `/api/customer/me` mit 401 → IT12 §3.8 `error-fallback`-State greift, Formular zeigt eingegebene Werte (kein Reset) und kein Notice. |

**Verbindlich:** Logout darf **niemals** den Form-State löschen. Reset-Trigger sind ausschließlich expliziter Submit-Erfolg oder „Abbrechen"-Button.

---

### 1.3 Bild-Container & PNG-Transparenz (NEU systemisch — IT13-S07)

Alle Service-Bild-Container (auf der Homepage, in Service-Cards, in Service-Detail-Heros) folgen dem **transparenten Container-Pattern**:

```tsx
<div className="bg-transparent">          {/* Container */}
  <Image src="..." alt="..."             {/* Bild */}
         className="bg-transparent" />
</div>
```

- **Verboten:** `bg-white`, `bg-gray-100`, `bg-baerenstark-cream` direkt am `<img>`-Element oder am direkten `<div>`-Wrapper.
- **Erlaubt:** Hintergrundfarbe an einem **äußeren** Container (z. B. Card-Wrapper mit `bg-baerenstark-cream`) — die Karte trägt Brand-Hintergrund, das Bild liegt darauf transparent. Das ist der gewünschte „neue Look".

**Visueller Eindruck (verbindlich für QA-Visual-Check):**

| Kontext | Karten-Hintergrund | Bild-Hintergrund (transparente PNG-Pixel zeigen…) |
|---------|---------------------|-----------------------------------------------------|
| Service-Card auf Homepage | `bg-baerenstark-cream` (warmes Beige) | Cream durchscheinend — Bild integriert sich farblich in die Karte |
| Service-Detail-Hero (`/services/[slug]`) | `bg-baerenstark-cream/60` (sanfteres Beige, etwas heller als die Cards) | Cream/60 durchscheinend — Bild wirkt lebendig vor warmem Hintergrund |
| Quick-Booking-Modal Service-Picker (falls Bilder dort auftauchen) | Modal-Body (`bg-baerenstark-cream`) | wie Cards |

**Begründung:** Reines Brown wäre zu dunkel und würde dunklere Bildbereiche „verschlucken". Pures Weiß würde das warme Brand-Gefühl brechen. Cream/Beige ist der Sweet-Spot.

**Engineer-Hinweis (IT13-S07 AC #3):** Beim DOM-Inspect darf am `<img>` und am direkten Wrapper-`<div>` weder `background-color: white` noch `background: white` noch `background-color: #fff` gesetzt sein. Tailwinds `bg-transparent` ist explizit zu setzen, falls Browser-Defaults oder geerbte Cascade-Werte einspringen.

**Next.js `<Image>`-Spezifika:**
- `placeholder="empty"` (Default) verwenden — KEIN `placeholder="blur"`, weil Blur-Placeholder einen opaken Platzhalter rendert, der durch das transparente PNG durchscheinen würde.
- Falls im Code `placeholder="blur"` gesetzt ist: entfernen.

---

### 1.4 Bild-Frame-Pattern für Service-Detail (NEU systemisch — IT13-S08)

Service-Detail-Bilder müssen **vollständig** im Frame sichtbar sein. Pattern:

```tsx
<div className="relative w-full aspect-[4/3] bg-baerenstark-cream/60 rounded-lg overflow-hidden">
  <Image
    src="/services/{slug}.png"
    alt="..."
    fill
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 640px"
    className="object-contain"
  />
</div>
```

**Kern-Entscheidung:** `object-fit: contain` (nicht `cover`). Das bedeutet: Wenn das Bild ein anderes Aspect-Ratio als der Frame hat, entstehen **Letterbox-Streifen** (oben/unten oder links/rechts).

**Letterbox-Farbe (verbindlich):**

| Kontext | Frame-Hintergrund (= Letterbox-Farbe) |
|---------|----------------------------------------|
| Service-Detail-Hero | **`bg-baerenstark-cream/60`** (= Token `letterbox-bg-default`, siehe `design-system-iteration-13-additions.md` IT13-D2) |
| Service-Card-Thumbnails | **`bg-transparent`** (in Cards bereits Cream — Letterbox = Cream durch Vererbung) |

Pures `#FFFFFF` ist **explizit verboten** als Letterbox — würde das Brand-Gefühl brechen. Pures `#000000` ebenfalls verboten — zu kontrastreich.

**Frame-Dimensionen — Responsive (verbindlich für Engineer):**

| Viewport | Frame-Breite | Frame-Aspect-Ratio | Frame-Höhe (effektiv) |
|----------|---------------|---------------------|------------------------|
| Mobile (< 640 px) | `100%` (volle Spaltenbreite minus 16 px Page-Padding) | `aspect-[4/3]` | ~252 px bei 360 px Breite |
| Tablet (640 – 1024 px) | `100%` Spaltenbreite | `aspect-[3/2]` | ~427 px bei 640 px Breite |
| Desktop (≥ 1024 px) | 60 % der Content-Breite, max 640 px | `aspect-[3/2]` | max 427 px |

> **Konsistenz mit IT12 §3.2.5:** IT12 hat `aspect-[4/3]` Mobile, `aspect-[3/2]` Desktop bereits festgelegt. IT13 ergänzt nur den **Letterbox-BG** (Token siehe Design-System-Additions IT13-D2) und hält die Aspect-Ratios.

**Sehr breite oder sehr hohe Bilder:**
- Bild-Asset wirkt im Frame **immer** vollständig (durch `object-contain`), auch wenn es 16:9 oder 1:1 ist.
- Letterbox-Streifen sind erwünscht und sehen mit Cream/60 stimmig aus.

**Acceptance-Mapping S08:**
- AC „Kein Teil des Bildes wird abgeschnitten" → erfüllt durch `object-contain`.
- AC „Mobile 375 px vollständig sichtbar" → erfüllt durch `100%` Frame-Breite + `object-contain` + `aspect-[4/3]`.
- AC „Desktop ausgewogen" → erfüllt durch `60 %` max-width.

---

## 2. Story-Coverage-Matrix

| Story | Klassifikation | UX-Aufwand | Sektion in dieser Spec |
|-------|----------------|------------|------------------------|
| IT13-S01 | Compliance/Content-Page | mittel | §3.1 |
| IT13-S02 | Frontend-Feature | mittel (Button-Variant + Error-Mapping) | §3.2 |
| IT13-S03 | Frontend-Bug | hoch (systemisches Pattern) | §3.3 + §1.1 |
| IT13-S04 | Frontend-Enhancement | mittel (Pattern-Erweiterung) | §3.4 + §1.2 |
| IT13-S05 | Backend-Bug | none (UX bereits in IT12 §3.10) | — |
| IT13-S06 | Backend-Bug | none (UX bereits in IT12 §3.6/§3.11) | — |
| IT13-S07 | Frontend-Bug | low (Pattern-Definition) | §3.7 + §1.3 |
| IT13-S08 | Frontend-Bug | low (Pattern-Definition) | §3.8 + §1.4 |

---

## 3. Story-Specs

### 3.1 IT13-S01 — Datenlöschungsseite

**Route:** `/datenschutz/datenloesung` (kanonisch).
**Alternativ-Routing:** Auch `/datenschutz#datenloesung` als Anker auf der Hauptseite muss funktionieren (Footer-Link kann auf beides zeigen — diese Spec entscheidet sich für die **Detail-Seite** als kanonische Variante, damit Facebook eine **eindeutige URL** ohne Fragment-Hash bekommt).

#### 3.1.1 Layout-Skizze (textbasiert)

```
┌────────────────────────────────────────────────────────┐
│  [Header — sticky, Logo, Nav]                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Datenschutz / Datenlöschung                           │  ← Breadcrumb (text-sm)
│                                                        │
│  ╔════════════════════════════════════════════════╗    │
│  ║  Datenlöschung                                 ║    │  ← <h1>, text-3xl
│  ╚════════════════════════════════════════════════╝    │
│                                                        │
│  Du möchtest deine Daten bei Bärenstark löschen        │  ← Lead-Paragraph,
│  lassen? Kein Problem — wir machen das schnell             text-lg, text-bark
│  und unkompliziert.                                        max-w-prose
│                                                        │
│  ──────────────────────────────────────────────        │
│                                                        │
│  ## Welche Daten speichern wir?                        │  ← <h2>, text-xl
│                                                        │
│   • Name (Vor- und Nachname)                           │  ← Liste
│   • E-Mail-Adresse                                     │
│   • Telefonnummer (sofern angegeben)                   │
│   • Adresse (sofern angegeben)                         │
│   • Buchungshistorie (Service, Datum, Status)          │
│                                                        │
│  ──────────────────────────────────────────────        │
│                                                        │
│  ## So beantragst du die Löschung                      │  ← <h2>, text-xl
│                                                        │
│   1. Schreib uns eine E-Mail an:                       │  ← Schritt-Liste
│      ┌──────────────────────────────────────────┐      │     (numbered list,
│      │  📧  hausservice-baerenstark@outlook.com │      │      mit Highlight
│      └──────────────────────────────────────────┘      │      auf E-Mail —
│      Betreff: „Datenlöschung"                          │      siehe §3.1.2)
│                                                        │
│   2. Falls du ein Konto hast: nenne uns deine          │
│      Anmelde-E-Mail (zur eindeutigen Zuordnung).       │
│                                                        │
│   3. Wir bestätigen den Eingang innerhalb von          │
│      48 Stunden und löschen deine Daten innerhalb      │
│      von 30 Tagen — wie es die DSGVO vorsieht.         │
│                                                        │
│  ──────────────────────────────────────────────        │
│                                                        │
│  ## Was wir nach der Löschung behalten müssen          │  ← <h2>, text-xl
│                                                        │
│  Aus rechtlichen Gründen müssen wir bestimmte Daten    │
│  länger aufbewahren — zum Beispiel Rechnungen          │
│  (10 Jahre, AO §147). Diese werden aber nicht mehr     │
│  aktiv verwendet und nach Ablauf der Frist gelöscht.   │
│                                                        │
│  ──────────────────────────────────────────────        │
│                                                        │
│  ## Fragen?                                            │  ← <h2>, text-xl
│                                                        │
│  Schreib uns eine E-Mail oder ruf uns an:              │
│   📧  hausservice-baerenstark@outlook.com              │
│   📞  0157-74787512                                    │  ← tel:-Link
│                                                        │
│  ──────────────────────────────────────────────        │
│                                                        │
│  ← Zurück zur Datenschutzerklärung                     │  ← Link zu /datenschutz
│                                                        │
├────────────────────────────────────────────────────────┤
│  [Footer]                                              │
└────────────────────────────────────────────────────────┘
```

#### 3.1.2 Microcopy (verbindlich, Du-Form)

| Element | Text |
|---------|------|
| `<title>` | „Datenlöschung — Bärenstark Hausservice" |
| `<h1>` | „Datenlöschung" |
| Lead-Paragraph | „Du möchtest deine Daten bei Bärenstark löschen lassen? Kein Problem — wir machen das schnell und unkompliziert." |
| `<h2>` 1 | „Welche Daten speichern wir?" |
| `<h2>` 2 | „So beantragst du die Löschung" |
| Schritt 1 | „Schreib uns eine E-Mail an: hausservice-baerenstark@outlook.com — Betreff: ‚Datenlöschung'." |
| Schritt 2 | „Falls du ein Konto hast: nenne uns deine Anmelde-E-Mail (zur eindeutigen Zuordnung)." |
| Schritt 3 | „Wir bestätigen den Eingang innerhalb von 48 Stunden und löschen deine Daten innerhalb von 30 Tagen — wie es die DSGVO vorsieht." |
| `<h2>` 3 | „Was wir nach der Löschung behalten müssen" |
| `<h2>` 4 | „Fragen?" |
| Footer-Link-Label | „Datenlöschung" |

#### 3.1.3 E-Mail-Highlight-Card (verbindlich)

Die E-Mail `hausservice-baerenstark@outlook.com` wird in Schritt 1 visuell hervorgehoben:

```html
<a
  href="mailto:hausservice-baerenstark@outlook.com?subject=Datenl%C3%B6schung"
  class="inline-flex items-center gap-2 rounded-lg bg-baerenstark-cream
         border border-baerenstark-sand px-4 py-2 font-medium text-baerenstark-bark
         hover:bg-baerenstark-sand/30 transition focus-visible:ring-2
         focus-visible:ring-baerenstark-bark"
>
  <MailIcon class="h-4 w-4" aria-hidden="true" />
  hausservice-baerenstark@outlook.com
</a>
```

- Klick öffnet den Mail-Client mit vorbefülltem Betreff „Datenlöschung".
- Hover-Zustand sichtbar.
- Auf Touch-Geräten: gleicher Effekt (Mail-App öffnet sich).

#### 3.1.4 Page-States

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `static` | Page-Mount (statisch, kein API-Call) | Vollständiger Content sofort sichtbar |

**Keine Loading/Empty/Error-States nötig** — die Seite ist statisch und hat keine API-Abhängigkeit (verbindlich aus Notes der Story).

#### 3.1.5 Datenschutz-Hauptseite (`/datenschutz`) — Anker-Sektion

In der bestehenden Datenschutzerklärung wird ein neuer Abschnitt eingefügt:

```html
<section id="datenloesung" aria-labelledby="datenloesung-heading">
  <h2 id="datenloesung-heading" class="scroll-mt-[var(--header-offset)]">
    Datenlöschung
  </h2>
  <p>
    Du kannst die Löschung deiner Daten jederzeit beantragen. Eine ausführliche
    Anleitung findest du auf unserer
    <a href="/datenschutz/datenloesung">Datenlöschungsseite</a>.
  </p>
  <p>
    Schreib uns dazu an
    <a href="mailto:hausservice-baerenstark@outlook.com">
      hausservice-baerenstark@outlook.com</a>.
    Wir bearbeiten Anfragen innerhalb von 30 Tagen.
  </p>
</section>
```

> Acceptance-Mapping AC „findet einen Abschnitt ‚Datenlöschung'" → erfüllt durch obigen Anker + Link auf Detail-Seite.

#### 3.1.6 Footer-Integration

Im globalen Footer wird ein neuer Link ergänzt:

```
Impressum  ·  Datenschutz  ·  Datenlöschung  ·  AGB
```

- Position: zwischen „Datenschutz" und „AGB".
- Label: „Datenlöschung" (kein Untermenü nötig).
- Style: konsistent mit bestehenden Footer-Links (`text-sm text-bark/70 hover:text-bark`).

#### 3.1.7 Responsive

| Viewport | Layout-Änderung |
|----------|------------------|
| Mobile (< 640 px) | Content max-width 100% (minus 16 px Padding), Section-Gap `space-y-6`, Listen mit `pl-5` |
| Desktop (≥ 1024 px) | Content max-width `max-w-prose` (~65ch), Section-Gap `space-y-8` |

#### 3.1.8 Accessibility

- `<main role="main" aria-labelledby="page-title">`.
- Heading-Hierarchie strikt: ein `<h1>`, alle Sektionen `<h2>`, keine Sprünge.
- E-Mail-Link mit `aria-label="E-Mail an Bärenstark senden zur Datenlöschung"`.
- Telefon-Link `tel:+4915774787512` mit `aria-label="Bärenstark anrufen, 0157 74787512"`.
- Lese-Reihenfolge logisch: Was → Wie → Ausnahmen → Kontakt.
- Page-Title `<title>`: „Datenlöschung — Bärenstark Hausservice".
- Keine Login-Wand (verbindlich aus AC #1).

#### 3.1.9 Acceptance-Mapping S01

| AC | Erfüllt durch |
|----|----------------|
| URL liefert HTTP 200 ohne Login | §3.1.4 + Engineer-Implementierung als Public-Route (`/datenschutz/datenloesung`) |
| Headline „Datenlöschung" + E-Mail + 30-Tage-Frist + Daten-Auflistung | §3.1.2 + §3.1.1 (Layout) |
| Facebook-URL-Validierung kein Redirect-auf-Login | Public-Route, keine Auth-Middleware |
| Sektion in /datenschutz | §3.1.5 |
| Footer-Link „Datenlöschung" | §3.1.6 |

---

### 3.2 IT13-S02 — Facebook-Login-Button

**Route:** `/konto/login` und überall, wo `<OAuthButtons>` gerendert wird.
**Component:** `<OAuthButton variant="facebook">` (neu, siehe `component-library-iteration-13.md` §2).

#### 3.2.1 Position & Layout

Im bestehenden `OAuthButtons.tsx` (Stand IT12) sind Google und GitHub bereits gerendert. IT13 fügt **Facebook** hinzu.

**Reihenfolge der OAuth-Buttons (verbindlich):**

```
┌─────────────────────────────────────┐
│  [G] Mit Google anmelden            │  ← 1. Position (oben) — meist genutzt
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  [f] Mit Facebook anmelden          │  ← 2. Position (NEU IT13)
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  [Gh] Mit GitHub anmelden           │  ← 3. Position (Dev/Edge-Use-Case,
└─────────────────────────────────────┘     bleibt unten)

────────── oder ──────────              ← OAuthDivider

[E-Mail / Passwort-Form]
```

**Begründung der Reihenfolge:**
1. Google = breiteste Reichweite in Toms Zielgruppe (Privatkunden) → oben.
2. Facebook = neu eingeführt, ebenfalls hohe Reichweite bei der älteren Zielgruppe → direkt unter Google.
3. GitHub = Edge-Case (Power-User, Tom selbst zum Test) → unten.

**Spacing zwischen Buttons:** `space-y-3` (12 px) — konsistent mit bestehendem Wrapper im OAuthButtons-Component.

#### 3.2.2 Button-Branding (verbindlich)

| Property | Wert |
|----------|------|
| Hintergrund | `#1877F2` (Facebook Brand Blue, siehe Design-System IT13-D1) |
| Hintergrund Hover | `#166FE5` (~5 % dunkler) |
| Hintergrund Active | `#0F5FCD` (~12 % dunkler) |
| Hintergrund Disabled | `#1877F2` mit `opacity-60` |
| Text-Farbe | `#FFFFFF` (Weiß) |
| Border | `transparent` (Solid-Style, kein Border) |
| Border-Radius | `rounded-lg` (konsistent mit Google-Button) |
| Padding | `px-4 py-2.5` (konsistent mit Google-Button) |
| Font | `text-sm font-medium` |
| Icon | offizielles Facebook „f"-Logo (SVG, 18×18 px, weiß auf blauem Grund **oder** blau auf weißem Kreis — siehe §3.2.3) |
| Focus-Ring | `ring-2 ring-baerenstark-accent ring-offset-2` (konsistent mit Google) |

**Kontrast-Check:**
| Vordergrund | Hintergrund | Ratio | Pass |
|-------------|-------------|-------|------|
| `#FFFFFF` Text | `#1877F2` (idle) | 4.55:1 | AA ✓ |
| `#FFFFFF` Text | `#166FE5` (hover) | 4.78:1 | AA ✓ |
| `#FFFFFF` Text | `#0F5FCD` (active) | 5.50:1 | AA ✓ |

#### 3.2.3 Facebook-Logo-Variante

Facebooks Brand-Guidelines erlauben zwei Varianten für den Login-Button:

**Variante A (gewählt für IT13):** Weißes „f"-Logo direkt auf blauem Button-Hintergrund.

```svg
<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#FFFFFF" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/>
</svg>
```

Begründung Variante A: Volle Brand-Recognition, kein zusätzliches weißes Hintergrund-Element nötig, weniger DOM.

#### 3.2.4 Klick-Verhalten

> **🔒 Source of Truth — Facebook OAuth URLs (Architect SSOT, QA-Pressure-Test 2026-05-04):**
>
> - **Sign-In-Endpoint (Frontend → Server):** `POST /api/auth/customer/signin/facebook`
> - **Callback-URL (Facebook → Server, in Facebook Developer Console eintragen):**
>   `https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook`
>   (mit `www.`, mit `customer/`-Pfad — verbindlich für AC IT13-S02 #5 „kein `redirect_uri_mismatch`").
> - **Post-Login-Redirect:** `/konto/oauth-erfolg` → `/konto`
>
> Diese URLs sind die einzige Quelle der Wahrheit. Andere Pfade (z. B. `/api/auth/callback/facebook` ohne `customer/`) sind **falsch** und führen zu `redirect_uri_mismatch`.

| State | Trigger | Verhalten |
|-------|---------|-----------|
| `idle` | Default | Button enabled, Label „Mit Facebook anmelden" |
| Klick | User klickt | (1) `pending = 'facebook'` → Button disabled, Label „Wird umgeleitet …", Spinner (kein Icon-Tausch); (2) CSRF-Token via `fetchCustomerCsrfToken()` holen; (3) Form-Submit zu `/api/auth/customer/signin/facebook` mit `callbackUrl = /konto/oauth-erfolg` |
| Erfolg | Facebook redirect zurück an `/api/auth/customer/callback/facebook` + Cookie gesetzt | NextAuth-Callback → Redirect zu `/konto/oauth-erfolg` → von dort zu `/konto`. Header-State updated via `emitCustomerChanged()` (siehe IT12 §1.3) |
| User bricht ab (Facebook-Cancel) | Facebook redirect mit `error=access_denied` an `/api/auth/customer/callback/facebook` | Redirect zu `/konto/login?error=oauth_error` → Inline-Banner |
| Server-Fehler (CSRF, Network) | Exception | `setError('Anmeldung konnte nicht gestartet werden. Bitte erneut versuchen.')` (konsistent mit Google-Pattern in OAuthButtons.tsx) |

#### 3.2.5 Error-State

Bei Facebook-OAuth-Fehler (z. B. App nicht „Live", Token-Mismatch) oder Nutzer-Abbruch landet der User auf `/konto/login?error=oauth_error`. Dort wird ein Inline-Banner über den OAuth-Buttons gerendert:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠ Die Anmeldung wurde abgebrochen oder ist             │
│   fehlgeschlagen. Bitte versuche es erneut oder        │
│   melde dich mit E-Mail und Passwort an.               │
└─────────────────────────────────────────────────────────┘
```

- `role="alert"`, `aria-live="assertive"`, `tabindex="-1"` (programmatisch fokussiert nach Page-Mount).
- Style: konsistent mit IT12 §3.1 (`bg-feedback-error-bg`, Border-Left).
- Microcopy in `mapOAuthErrorMessage`-Funktion erweitern um Facebook-spezifische Codes:

| Error-Code | Microcopy |
|------------|-----------|
| `oauth_error` (generisch, bestehend) | „Die Anmeldung wurde vom Anbieter abgebrochen oder ist fehlgeschlagen. Bitte erneut versuchen." |
| `oauth_no_email` (Facebook gibt keine E-Mail zurück, Nutzer hat sie nicht freigegeben) | „Facebook hat keine E-Mail-Adresse übermittelt. Bitte erlaube den E-Mail-Zugriff in den Facebook-Anmelde-Einstellungen oder registriere dich manuell mit E-Mail und Passwort." |
| `oauth_unverified` | bestehend (siehe IT12) |
| `oauth_unverified_conflict` | bestehend |

> **Verbindlich AC #7 S02:** Niemals technische Stack-Traces oder englische Default-Messages. Alle sichtbaren Texte deutsch.

#### 3.2.6 State-Tabelle `<OAuthButton variant="facebook">`

| State | Trigger | Sichtbar | A11y |
|-------|---------|----------|------|
| `idle` | Default | Button blau, Label „Mit Facebook anmelden", `aria-label="Mit Facebook anmelden"` | — |
| `pending` | Klick, CSRF wird geholt | Button disabled, Label „Wird umgeleitet …", Spinner ersetzt Icon | `aria-busy="true"` |
| `error-banner` | Redirect mit `?error=...` | Banner über Button-Gruppe | `role="alert"` am Banner |

#### 3.2.7 Responsive

| Viewport | Layout |
|----------|--------|
| Mobile (< 640 px) | Buttons full-width (`w-full`), gleiche Reihenfolge |
| Desktop (≥ 640 px) | Buttons full-width innerhalb der Login-Card (max-width ~ 400 px), gleiche Reihenfolge |

Keine Layout-Verkleinerung auf Mobile — Touch-Target soll bei 44 px bleiben (`py-2.5` + line-height ≥ 44 px insgesamt).

#### 3.2.8 Acceptance-Mapping S02

| AC | Erfüllt durch |
|----|----------------|
| Button auf `/konto/login` sichtbar und aktiv | §3.2.1 + Component-Library-IT13 §2 |
| OAuth-Flow → Redirect `/konto` | §3.2.4 (NextAuth-Callback bestehend) |
| Erster Login → CustomerUser angelegt | Backend-Sache (Architect), UX zeigt nur Result |
| Bestehende E-Mail → Account-Verknüpfung | bestehend (IT12-Konsens NextAuth-`signIn`-Callback) |
| Kein `redirect_uri_mismatch` | Backend-Sache |
| Kein „App nicht live"-Fehler nach Facebook-Live-Status | Backend + Operations |
| Deutsche Fehlermeldungen | §3.2.5 |

---

### 3.3 IT13-S03 — Scroll-zu-Sektion (alle Wizards)

> **Pattern-Definition:** §1.1 (siehe oben). Diese Sektion fügt **Story-spezifische** UX-Details hinzu.

#### 3.3.1 User-Flow Buchungsformular (`/buchen`, ausführlich)

```
[User landet auf /buchen]
   │
   ▼
[Initial-Render: Step 1 "Service" sichtbar, Header kein Scroll-Trigger]
   │
   │  User klickt eine Service-Card
   ▼
[onChange Service: setStep('when')]
   │
   ▼
[Section "when" rendert (Datums-Picker)]
   │  ─── useEffect feuert ───
   ▼
[requestAnimationFrame x2]
   │
   ▼
[scrollIntoView({ block: 'start', behavior: 'smooth' })
 → "when"-Section bewegt sich an die Top-Kante des Viewports
   minus --header-offset (= 80 px Mobile / 96 px Desktop)]
   │
   ▼
[h2#step-when-heading erhält Focus
 → Screenreader liest "Wann passt es dir? Heading Level 2" vor]
   │
   ▼
[Smooth-Scroll abgeschlossen (~300 ms)]
   │
   │  User wählt einen Tag
   ▼
[onChange Day: setStep('duration') → derselbe Pattern wiederholt sich]
   │
   ▼   ... usw. bis Step 'confirm'
```

#### 3.3.2 User-Flow Quick-Booking-Modal

```
[Modal öffnet, Mini-Kalender + Datums-Picker sichtbar]
   │  User wählt Tag
   ▼
[setStep('time-slot')]
   │
   ▼
[scrollIntoView innerhalb des Modal-Body
 → ScrollContainer ist <div data-modal-body>, nicht window.
 → "time-slot"-Section scrollt an die Modal-Top-Kante]
   │
   ▼
[h3#modal-step-time-slot-heading erhält Focus]
```

> **Verbindlich:** Im Modal-Kontext **darf das Hintergrunddokument nicht scrollen**. Das ist durch `overflow: hidden` am `<body>` während Modal offen sicherzustellen (siehe IT12 Modal-Pattern).

#### 3.3.3 User-Flow Profil-Formular

Profil-Formular ist **kein** Multi-Step-Wizard, sondern ein einseitiges Formular mit Sektionen (Kontaktdaten, Adresse, Passwort). Für Story IT13-S03 gilt:

```
[User klickt "Profil bearbeiten" auf /konto]
   │
   ▼
[Navigation zu /konto/profil]
   │
   ▼
[Page-Mount: scrollIntoView auf <h1>"Profil bearbeiten"
 → so dass Heading vollständig sichtbar ist]
```

- **Trigger:** ausschließlich Page-Mount (nicht jeder onChange im Formular).
- Keine Scroll-Sprünge bei Feld-Wechseln (konsistent mit IT12 §1.1 „Scroll-Stabilität bei Tab-Wechseln").

#### 3.3.4 Page-States — Wizard-Übergang (universell)

| State | Trigger | UI-Antwort | A11y |
|-------|---------|------------|------|
| `step-active` | Step `n` ist aktiv | Section sichtbar, Heading fokussiert | `aria-current="step"` an aktivem Step-Indikator |
| `step-transitioning` | onChange triggert Step-Wechsel | (kurz, < 16 ms) — alter Step wird abgemountet, neuer Step gemountet, dann Scroll + Focus | — |
| `step-scrolling` | rAF + scrollIntoView läuft | Section zieht ins Viewport, Browser-Animation (oder instant bei reduced-motion) | — |
| `step-arrived` | Scroll fertig, Focus auf Heading | Heading sichtbar an Top-Kante, Outline-Ring (Focus-Indikator) sichtbar bis erstes interaktives Element berührt wird | Screenreader liest Heading vor |

#### 3.3.5 Interaktionsverhalten

| Aktion | Klick (Mouse/Touch) | Keyboard | Screenreader |
|--------|---------------------|----------|---------------|
| Service-Card auswählen | Karte klickbar, gesamte Card als Click-Target | Tab → Enter/Space wählt | „{Service-Name}, ausgewählt" → dann beim nächsten Step: „Wann passt es dir? Heading Level 2" |
| Datum auswählen (Calendar-Cell) | Cell klickbar | Pfeiltasten navigieren, Enter wählt | „{Datum}, ausgewählt" → „Wie lange? Heading Level 2" |
| Slot auswählen | Slot-Pill klickbar | Tab → Enter/Space wählt | analog |
| Step zurück (Browser-Back oder „← Zurück"-Button) | Klick | Esc oder Backspace im Form-Context | „Schritt {n} verlassen, Schritt {n-1} aktiv" — Focus springt auf vorheriges Heading |

**Wichtig:** Beim Step-zurück-Aktion gilt das **gleiche Scroll+Focus-Pattern**, nur in entgegengesetzte Richtung.

#### 3.3.6 Responsive

| Viewport | Verhalten |
|----------|------------|
| Mobile (< 640 px) | `--header-offset: 80px`, Smooth-Scroll am `window` (Standard-Buchungsseite) bzw. am Modal-Body (Quick-Booking) |
| Desktop (≥ 640 px) | `--header-offset: 96px`, sonst identisch |

Keine speziellen Animations-Unterschiede zwischen Viewports — Verhalten ist konsistent.

#### 3.3.7 Acceptance-Mapping S03

| AC | Erfüllt durch |
|----|----------------|
| Tag → scroll zu Dauer-Heading vollständig sichtbar | §1.1.3 + §1.1.2 (Header-Offset) |
| Dauer → scroll zu Slot-Heading | analog |
| Slot → scroll zu Kontakt-Heading | analog |
| Heading ist erste sichtbare Überschrift, nicht Mitte | §1.1.1 (`scroll-margin-top` + Section-Anchor auf Heading) |
| Header-Höhe dynamisch | §1.1.2 Engineer-Hinweis (JS-dynamisch via `data-app-header`) |
| Profil-Formular: Heading sichtbar | §3.3.3 |
| Kontaktformular: Heading sichtbar | §3.3.3 (gleicher Page-Mount-Trigger) — Kontaktformular existiert in IT13 evtl. noch nicht; falls nicht, AC ist „Not Applicable" und Engineer dokumentiert das im PR (siehe S04 Notes-Pattern) |
| Mobile: Heading nicht verdeckt | §1.1.2 (mobile-spezifischer Offset) |
| `prefers-reduced-motion` | §1.1.4 |
| Modal: Modal-Inneres scrollen | §1.1.5 + §3.3.2 |

---

### 3.4 IT13-S04 — Formular-Prefill (alle Formulare)

> **Pattern-Definition:** §1.2 (siehe oben). Diese Sektion fügt Formular-spezifische Microcopy + Field-Mappings hinzu.

#### 3.4.1 Field-Mapping pro Formular

**Buchungsformular `/buchen` (erweitert IT12 §3.8.2):**

| Profil-Feld | Buchungsformular-Feld | Verhalten bei fehlendem Profilwert |
|-------------|------------------------|-------------------------------------|
| `firstName` | „Vorname" | leer, Placeholder „Max" |
| `lastName` | „Nachname" | leer, Placeholder „Mustermann" |
| `email` | „E-Mail" | leer, Placeholder „max@example.com" |
| `phone` | „Telefon" | leer, Placeholder „0151 …" — KEIN Block-Hinweis-Update (Telefon ist optional) |
| `street` | „Straße & Hausnummer" | leer + Hint „Adresse in deinem Profil hinterlegen — [zum Profil →](/konto/profil)" |
| `postalCode` | „PLZ" | leer |
| `city` | „Ort" | leer |

**Profilformular `/konto/profil` (Bestand IT11/IT12):**

| Profil-Feld | Profilformular-Feld | Verhalten |
|-------------|----------------------|-----------|
| Alle | Alle | mit DB-Wert vorausgefüllt; leer wenn nicht gesetzt — KEIN Placeholder-Wert, der wie ein echter Wert wirkt |

> **Acceptance AC „kein falscher Platzhalter-Wert":** Engineer prüft `defaultValue` vs. `placeholder` — nur Letzteres bleibt grau.

**Kontaktformular** (sofern existiert):

| Profil-Feld | Kontaktformular-Feld | Verhalten |
|-------------|------------------------|-----------|
| `firstName + lastName` (zusammengefügt) | „Name" | „{firstName} {lastName}" oder leer wenn nicht gesetzt |
| `email` | „E-Mail" | wie Buchungsformular |
| (kein Profil-Feld) | „Nachricht" | immer leer |

> **Hinweis:** Falls das Kontaktformular in IT13 noch nicht existiert (siehe Story-Notes), dokumentiert der Engineer das im PR-Kommentar als „Not Applicable". UX-Spec hält das Mapping bereit für die Zukunft.

#### 3.4.2 PrefillNotice — Microcopy (Du-Form, IT13-Update)

```
┌──────────────────────────────────────────────────────────┐
│ ℹ Aus deinem Profil übernommen.                         │
│   Du kannst die Angaben für diese Anfrage anpassen —    │
│   dein Profil wird dadurch nicht verändert.             │
└──────────────────────────────────────────────────────────┘
```

- Style: `bg-baerenstark-cream/50`, `text-sm`, `text-bark/70`, `rounded-md`, `px-3 py-2`, Icon `InfoIcon` 16 px (Lucide).
- Position: über dem ersten betroffenen Feld-Block.
- IT12-Bestand „Aus Ihrem Profil übernommen" (Sie-Form) bleibt im Buchungsformular **unverändert** (IT12-Konsens, nicht angefasst). IT13-S04-Erweiterung auf das Kontaktformular nutzt **Du-Form** (konsistent mit S01 + S02 IT13).

#### 3.4.3 User-Flow

**Eingeloggter Customer:**

```
[Login → /konto]
   │
   ▼
[User klickt "Termin buchen"]
   │
   ▼
[Modal/Buchungsseite öffnet]
   │
   ▼
[GET /api/customer/me parallel zum Render]
   │
   ▼
[Profil-Daten kommen → React-State updated → Felder werden befüllt]
   │
   ▼
[Block-Notice "Aus deinem Profil übernommen" erscheint über Kontakt-Block]
   │
   ▼
[User editiert oder akzeptiert]
   │
   ▼
[Submit → POST /api/bookings mit ggf. abweichenden Werten]
```

**Nicht eingeloggter User:**

```
[Buchungsseite öffnet]
   │
   ▼
[Felder leer, KEIN Notice]
   │
   ▼
[Optional: dezenter Hint unter Kontakt-Block:
 "Häufiger Kunde? In deinem Profil hinterlegte Daten
  werden automatisch übernommen — [hier registrieren →]"]
```

#### 3.4.4 Page-States — Prefill-Block (universell)

(Erweitert IT12 §3.8.4.)

| State | Trigger | Sichtbar | Microcopy |
|-------|---------|----------|-----------|
| `loading` | `/api/customer/me` läuft | Felder mit Skeleton-Lines (`bg-sand/30`, `h-4`, `w-3/4`) | — |
| `prefilled-with-notice` | API 200, alle Felder gefüllt | Notice + befüllte Felder | „Aus deinem Profil übernommen…" |
| `partial-prefill` | API 200, einige Felder leer | Notice (leicht angepasst) + gemischte Felder | „Einige Daten aus deinem Profil übernommen — fehlende kannst du jetzt ergänzen." |
| `empty-not-logged-in` | Nicht eingeloggt | Felder leer, Soft-Hint | „Häufiger Kunde? In deinem Profil hinterlegte Daten werden automatisch übernommen." |
| `empty-no-profile-data` | Eingeloggt, aber Profil leer | Felder leer, Soft-Hint | „Daten in deinem Profil hinterlegen — [zum Profil →](/konto/profil)" |
| `error-fallback` | API 401/500 | Felder leer, KEIN Notice | (kein sichtbarer Fehler — siehe IT12 §3.8.4) |
| `auth-lost-mid-session` | Cookie weg während offener Session | Werte bleiben, Submit kann fehlschlagen → 401-Banner: „Bitte erneut anmelden — deine Eingaben bleiben erhalten" + Login-Link | siehe §1.2 oben |

#### 3.4.4a Adress-Prefill — „Andere Adresse als im Profil" (NEU, QA-Pressure-Test 2026-05-04)

**Use-Case:** Eingeloggter Kunde hat seine Heim-Adresse im Profil hinterlegt, möchte aber für eine Buchung an einer anderen Adresse buchen — z. B. Großmutters Wohnung, Mietobjekt, Ferienhaus, Auftrag für einen Verwandten.

**Designentscheidung — gewähltes Pattern: „Editable-Default" (kein Toggle).**

Die Adressfelder werden mit den Profil-Werten **vorausgefüllt, sind aber jederzeit editierbar** wie jedes andere Feld auch. Es gibt **keinen separaten Toggle** „andere Adresse" und **keinen Modus-Wechsel**. Der User überschreibt einfach die Felder.

**Begründung:**
1. **Konsistenz mit Kontaktdaten-Block:** Vorname/Nachname/E-Mail werden ebenfalls als „Editable-Default" behandelt (User könnte für eine Verwandten-Buchung auch andere Kontaktdaten eingeben). Eigene Adress-Logik wäre inkonsistent.
2. **Weniger UI-Komplexität:** Toggle-Buttons, Modus-Wechsel und Reset-States bedeuten 3+ zusätzliche Components, mehr Test-Aufwand und mehr Edge-Cases (was passiert beim Toggle, wenn schon getippt wurde?).
3. **Mental Model:** Der User versteht „vorausgefülltes Formular" intuitiv — wie bei jedem Browser-Autofill. Ein Toggle „andere Adresse" würde fragen, was vorher offensichtlich war.
4. **Bestätigt durch IT12-S08-Konsens:** „Felder werden vorausgefüllt, aber editierbar (kein readonly, kein disabled)" — diese Spec erweitert das nur explizit auf den Adress-Use-Case.

**Verhalten — verbindlich:**

| Schritt | UX-Verhalten |
|---------|----------------|
| User öffnet Buchungsformular, eingeloggt mit Profil-Adresse | Adressfelder mit Profil-Werten vorausgefüllt, Block-Notice „Aus deinem Profil übernommen…" sichtbar |
| User möchte für andere Adresse buchen | User klickt einfach in das Feld „Straße & Hausnummer", **markiert den Wert mit Cmd+A / Ctrl+A** (oder löscht ihn), tippt neue Adresse |
| User editiert nur PLZ und Ort, behält Straße aus Profil | Mix-Werte zulässig — Buchung wird mit der **finalen Eingabe** (Mix aus Profil und Edit) gespeichert |
| Submit | `POST /api/bookings` enthält die **eingegebenen** Adress-Werte. **Profil-Adresse bleibt unverändert** (siehe §1.2 — verbindliche Regel). |
| Hint-Text unter Adress-Block (verbindlich) | Klein gesetzt, `text-xs text-bark/60`: „Möchtest du an einer anderen Adresse buchen? Überschreibe die Felder einfach — dein Profil bleibt unverändert." |

**Layout-Skizze (Adress-Block im Buchungsformular, eingeloggt):**

```
┌──────────────────────────────────────────────────────────┐
│ ℹ Aus deinem Profil übernommen.                         │
│   Du kannst die Angaben für diese Anfrage anpassen —    │
│   dein Profil wird dadurch nicht verändert.             │
└──────────────────────────────────────────────────────────┘

Adresse

  Straße & Hausnummer *
  ┌────────────────────────────────────────────┐
  │ Hauptstraße 12                             │   ← editierbar, vorausgefüllt
  └────────────────────────────────────────────┘

  PLZ *           Ort *
  ┌──────────┐   ┌────────────────────────────┐
  │ 64283    │   │ Darmstadt                  │
  └──────────┘   └────────────────────────────┘

  ↳ Möchtest du an einer anderen Adresse buchen?
    Überschreibe die Felder einfach — dein Profil
    bleibt unverändert.
    (text-xs text-bark/60, kein Icon, einrückt 8px)
```

**Verworfene Alternativen (nur zur Dokumentation):**

| Alternative | Warum verworfen |
|-------------|------------------|
| Toggle „Andere Adresse" → Felder leeren | Zusätzlicher UI-Schritt, der für 90 % der User unnötig ist (sie buchen für ihr eigenes Haus). Toggle-Reset-Verhalten wäre schwer zu kommunizieren. |
| Radio-Group „Profil-Adresse / Andere Adresse" | Optisch laut, mehr Vertical-Space, gleicher Effekt wie Editable-Default. |
| Read-Only-Default mit „Bearbeiten"-Button | Widerspricht IT12-S08-Konsens (kein readonly/disabled bei Prefill). |
| Address-Picker-Dropdown mit gespeicherten Adressen | Out-of-scope IT13 — Profil hat aktuell **eine** Adresse, kein Address-Book. Backlog-Idee für IT15+. |

**Acceptance-Mapping S04 — ergänzend zu §3.4.7:**

| Implizite AC (aus QA-Pressure-Test) | Erfüllt durch |
|--------------------------------------|----------------|
| User kann an anderer als der Profil-Adresse buchen | §3.4.4a (Editable-Default-Pattern) |
| Profil-Adresse wird durch Buchung an anderer Adresse **nicht** überschrieben | §1.2 + §3.4.4a Verhaltens-Tabelle |
| User versteht, dass er die Adresse einfach überschreiben kann | §3.4.4a Hint-Text unter Adress-Block (verbindlich) |

#### 3.4.5 Interaktionsverhalten

| Aktion | Verhalten |
|--------|-----------|
| Klick in vorausgefülltes Feld | Cursor an Ende des Wertes, Wert wird **nicht** automatisch markiert (Default-Browser-Behavior) |
| Tippen | Wert ändert sich, Notice bleibt sichtbar |
| Wert komplett gelöscht | Notice bleibt (User weiß: war mal übernommen) |
| Submit | geänderter Wert wird verschickt, Profil-Update **nicht** ausgelöst |

**Keyboard:**
- Tab-Reihenfolge: Notice ist nicht in Tab-Order (es ist nur ein `<p>` mit `role="note"`).
- Felder bleiben in normaler Tab-Order.

**Screenreader:**
- Notice wird beim Page-Mount **nicht** zwingend automatisch vorgelesen (kein `aria-live`), aber wenn der User mit Tab-Navigation auf den Block zukommt, liest der Screenreader: „Aus deinem Profil übernommen, Hinweis."
- Felder haben `aria-describedby` auf die Notice-ID gesetzt:

```html
<p id="prefill-notice-contact" role="note" class="...">Aus deinem Profil übernommen…</p>
<input
  id="firstName"
  type="text"
  aria-describedby="prefill-notice-contact"
  defaultValue="Max"
/>
```

#### 3.4.6 Responsive

| Viewport | Layout |
|----------|--------|
| Mobile | Notice voller Breite, Felder darunter gestapelt (1 Spalte) |
| Desktop | Notice voller Breite des Blocks, Felder ggf. 2 Spalten (z. B. Vorname/Nachname) |

#### 3.4.7 Acceptance-Mapping S04

| AC | Erfüllt durch |
|----|----------------|
| Buchungsformular: Vorname/Nachname/E-Mail/Telefon prefilled | §3.4.1 + §3.4.4 `prefilled-with-notice` |
| Buchungsformular: Adresse prefilled | §3.4.1 |
| Buchungsformular: Adresse fehlt → Hint + Link zum Profil | §3.4.4 `empty-no-profile-data` |
| Geänderter Wert nicht ins Profil zurück | §1.2 + §3.4.5 |
| Profilformular: alle Felder prefilled | §3.4.1 |
| Leeres Profil-Feld → leer, kein falscher Placeholder | §3.4.1 |
| Kontaktformular: Name + E-Mail prefilled | §3.4.1 — falls Kontaktformular existiert; sonst „N/A" |
| Nicht eingeloggt → leer, kein Fehler | §3.4.4 `empty-not-logged-in` |
| `/api/customer/me` schlägt fehl → leer + „Bitte erneut anmelden" | §1.2 + §3.4.4 `auth-lost-mid-session` + `error-fallback` |

---

### 3.7 IT13-S07 — PNG-Transparenz

> **Pattern-Definition:** §1.3 (siehe oben). Diese Sektion fügt Story-spezifische Visualisierungs-Details hinzu.

#### 3.7.1 User-Flow

```
[User landet auf /]
   │
   ▼
[Service-Cards laden — Cards haben bg-baerenstark-cream]
   │
   ▼
[Bilder rendern — bg-transparent am <img> + direktem Wrapper]
   │
   ▼
[Transparente Pixel der PNGs zeigen Card-Hintergrund (Cream) durch]
   │
   ▼
[Visuell sauberer Look — kein weißer/grauer Kasten um die Bilder]
```

#### 3.7.2 Page-States

Reines Visual-Pattern, keine zusätzlichen States — das Bild ist entweder geladen (`populated`) oder noch nicht (`loading` mit Skeleton-Block, IT12 §3.2.6 — gleicher Pattern).

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `loading` | `<Image>` lädt | Skeleton-Block (Cream/40, animate-pulse) im Frame |
| `populated` | Bild geladen | PNG sichtbar, transparente Bereiche zeigen Card-Hintergrund (Cream) |
| `error` | `onError` | Fallback (siehe IT12 §3.2.6 `image-fallback`) |

#### 3.7.3 Interaktionsverhalten

Keine eigenständige Interaktion durch S07 — die Bilder sind bereits durch IT12 mit Hover/Focus-Verhalten ausgestattet (Klick auf Service-Card → Navigation zu Detail-Seite). S07 ändert nur die Hintergrund-Cascade.

#### 3.7.4 Responsive

Pattern gilt unverändert auf allen Viewports. Letterbox-Farbe (im Detail-Hero) folgt §1.4 (Cream/60).

#### 3.7.5 Acceptance-Mapping S07

| AC | Erfüllt durch |
|----|----------------|
| Service-Card: transparenter Bereich durchsichtig | §1.3 (Container-Cascade) |
| 7 Detail-Seiten: keine opaken Hintergründe | §1.3 + Engineer-Audit aller Container |
| DOM-Inspect: kein `bg-white` etc. | §1.3 (verbotene Klassen) |
| Browser-Screenshot: keine weißen/grauen Boxen | §1.3 + §3.7.4 |
| Bilder fügen sich in Brown/Beige-Theme | §1.3 + §1.4 (Letterbox-Token Cream/60) |

---

### 3.8 IT13-S08 — Service-Detail-Bilder vollständig sichtbar

> **Pattern-Definition:** §1.4 (siehe oben). Diese Sektion fügt Visual-Details und Story-Acceptance-Mapping hinzu.

#### 3.8.1 Visueller Eindruck (verbindlich)

Bei `object-contain` im Frame mit `aspect-[4/3]` (Mobile) oder `aspect-[3/2]` (Desktop):
- Hochformat-Bilder erzeugen **horizontale Letterbox-Streifen** (links/rechts) in Cream/60.
- Querformat-Bilder erzeugen **vertikale Letterbox-Streifen** (oben/unten).
- Im Realbestand der Bärenstark-Bilder (PNGs aus `/public/`) sind die meisten Querformat → erwartete Letterbox-Streifen oben/unten.

**Erwartetes Aussehen** (Beispiel Service-Detail-Hero, Desktop, `aspect-[3/2]`):

```
┌──────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← Letterbox Cream/60
│                                              │
│        [vollständiges PNG, contain]          │
│                                              │
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← Letterbox Cream/60
└──────────────────────────────────────────────┘
   bg-baerenstark-cream/60, rounded-xl
```

Die Letterbox-Farbe `bg-baerenstark-cream/60` harmoniert sanft mit dem Page-Hintergrund — wirkt nicht wie ein Bug, sondern wie ein bewusster Frame.

#### 3.8.2 User-Flow

```
[User klickt Service-Card auf /]
   │
   ▼
[Navigation zu /services/{slug}]
   │
   ▼
[Detail-Page rendert]
   │
   ▼
[<ServiceDetailHero>-Frame initialisiert (aspect-[4/3] Mobile)]
   │
   ▼
[<Image fill object-contain> lädt Asset]
   │
   ▼
[Bild komplett sichtbar im Frame, ggf. mit Letterbox-Streifen]
```

#### 3.8.3 Page-States

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `loading` | Initial | Frame mit Cream/40 + Pulse-Animation |
| `populated` | Bild geladen | Vollständiges Bild im Frame, Letterbox-Streifen Cream/60 |
| `error` | `onError` | Fallback-Block (Cream-Hintergrund, großes Lucide-Icon, Text „Bild folgt in Kürze.") — IT12 §3.2.6 |

#### 3.8.4 Interaktionsverhalten

| Aktion | Verhalten |
|--------|-----------|
| Hover (Desktop) | leichte Skalierung des Bildes innerhalb des Frames (`scale-[1.02]`, 200 ms) — Frame bleibt fix; bei `prefers-reduced-motion: reduce` keine Skalierung |
| Klick | kein Lightbox in IT13 (Backlog) |
| Touch | reagiert wie Klick (kein Hover) |

#### 3.8.5 Responsive

Tabelle siehe §1.4. Konsistenz-Check für QA:
- 360 px Viewport: Frame voll-Breite minus 16 px Page-Padding, `aspect-[4/3]` → ~252 px Höhe.
- 1280 px Viewport: Frame 60 % der Content-Breite (Content-Breite 1024 px → 614 px Frame-Breite), `aspect-[3/2]` → ~410 px Höhe.

Visuelle Validierung bei diesen Breakpoints durch QA.

#### 3.8.6 Acceptance-Mapping S08

| AC | Erfüllt durch |
|----|----------------|
| Bild vollständig sichtbar, kein Cropping | §1.4 (`object-contain`) |
| `object-fit: contain` gesetzt | §1.4 |
| Alle 7 Detail-Seiten konsistent | §1.4 + Engineer-Audit aller `<ServiceDetailHero>`-Instanzen |
| 375 px Mobile: vollständig sichtbar, kein Overflow | §3.8.5 |
| Desktop 1280 px+: ausgewogen | §3.8.5 |
| Layout ausgewogen | §1.4 + §3.8.1 |

---

## 4. Globale Microcopy-Bibliothek (IT13-Ergänzungen)

| Slot | Microcopy |
|------|-----------|
| Datenlöschungsseite Page-Title | „Datenlöschung — Bärenstark Hausservice" |
| Datenlöschungsseite Headline | „Datenlöschung" |
| Datenlöschungsseite Lead | „Du möchtest deine Daten bei Bärenstark löschen lassen? Kein Problem — wir machen das schnell und unkompliziert." |
| Datenlöschungsseite E-Mail-Highlight | „hausservice-baerenstark@outlook.com" |
| Datenlöschungsseite Frist-Hinweis | „Wir bestätigen den Eingang innerhalb von 48 Stunden und löschen deine Daten innerhalb von 30 Tagen — wie es die DSGVO vorsieht." |
| Footer-Link | „Datenlöschung" |
| Facebook-Login-Button (idle) | „Mit Facebook anmelden" |
| Facebook-Login-Button (pending) | „Wird umgeleitet …" |
| Facebook-OAuth-Error (no_email) | „Facebook hat keine E-Mail-Adresse übermittelt. Bitte erlaube den E-Mail-Zugriff in den Facebook-Anmelde-Einstellungen oder registriere dich manuell mit E-Mail und Passwort." |
| Prefill-Notice (Du-Form, IT13) | „Aus deinem Profil übernommen. Du kannst die Angaben für diese Anfrage anpassen — dein Profil wird dadurch nicht verändert." |
| Prefill-Notice (Partial) | „Einige Daten aus deinem Profil übernommen — fehlende kannst du jetzt ergänzen." |
| Prefill-Hint (Adresse fehlt) | „Adresse in deinem Profil hinterlegen — [zum Profil →](/konto/profil)" |
| Prefill-Auth-Lost | „Bitte erneut anmelden — deine Eingaben bleiben erhalten." |
| Wizard-Step-Heading-Wann | „Wann passt es dir?" (Du-Form, neu IT13) — alternativ Bestand „Wann?" aus IT12 belassen, falls Codebase das aktuell so heißt; Engineer prüft |

---

## 5. Cross-Cutting Acceptance — Iteration 13

- ✓ Jeder Wizard-Step-Wechsel scrollt deterministisch + setzt Focus auf das Heading der Zielsektion (§1.1).
- ✓ `prefers-reduced-motion: reduce` schaltet Smooth-Scroll global ab (§1.1.4).
- ✓ Keine hardcoded Header-Höhen; CSS-Variable `--header-offset` ist die einzige Quelle (§1.1.2).
- ✓ Alle vorausgefüllten Form-Blöcke haben einen einzigen Block-Notice — keine Per-Field-Badges (§1.2).
- ✓ Logout während offener Form-Sitzung verliert keine Eingaben (§1.2 Edge-Case).
- ✓ Kein `bg-white`, `bg-gray-100` direkt am `<img>` oder dessen Wrapper (§1.3).
- ✓ Service-Detail-Bilder nutzen `object-contain` + Letterbox-Token Cream/60 (§1.4).
- ✓ Datenlöschungsseite ist öffentlich (kein Auth-Wall) und unter `/datenschutz/datenloesung` erreichbar (§3.1).
- ✓ Facebook-Login-Button verwendet exakt `#1877F2` als Brand-Color (§3.2.2).
- ✓ Alle Fehlertexte deutsch, Du-Form (IT13-Default für neue Microcopy).

---

## 6. Open Questions for Architect

> Diese Punkte werden vom QA-Agent gegen die Architect-SSOT geprüft und ggf. nachgereicht.

1. **Facebook-OAuth-Endpoint:** NextAuth-Provider-Konfiguration für Facebook ist Standard, aber: Welche **Scopes** werden angefragt? Mindestens `email` (sonst `oauth_no_email`-Pfad permanent) und `public_profile`. Architect bestätigt im NextAuth-Config.
2. ~~**Facebook-Callback-URL:**~~ ✓ **GEKLÄRT (QA-Pressure-Test 2026-05-04, Architect SSOT):** Verbindliche Callback-URL ist `https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook` (mit `www.`, mit `customer/`-Pfad). Diese URL ist in der Facebook Developer Console als „Valid OAuth Redirect URI" einzutragen. SSOT-Marker siehe §3.2.4.
3. **Datenlöschungs-API (optional zukünftig):** Aktuell rein E-Mail-basiert (manuell bei Tom). Falls in IT14+ ein Self-Service-Lösch-Portal kommen soll, brauchen wir einen `/api/customer/delete-account`-Endpoint. UX-Spec hat den Hook bereit (siehe §3.1 — Skeleton kann erweitert werden).
4. **Kontaktformular existiert?** Story IT13-S04 Notes erwähnen es als optional. Architect bestätigt, ob ein Kontaktformular in der Codebase existiert (z. B. unter `/kontakt`). Falls nicht: AC ist „N/A" und wird im PR-Kommentar dokumentiert.
5. **Header-Height-Token vs. CSS-Variable:** §1.1.2 nutzt `--header-offset` als CSS-Variable. Architect bestätigt, ob alternative Tailwind-Theme-Tokens (`theme.spacing['header-offset']`) bevorzugt werden. UX-Empfehlung: CSS-Variable, weil dynamisch beschreibbar via JS.
6. **Auto-Save-Verhalten bei Auth-Loss (§1.2):** Soll der Form-State im sessionStorage persistiert werden, falls die Session während des Buchens abläuft? UX-Empfehlung: ja (Defensive-UX), Architect klärt Implementierungs-Aufwand.

---

*Ende der UX-Spec Iteration 13.*
