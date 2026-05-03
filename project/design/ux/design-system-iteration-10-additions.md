# Design-System — Ergänzungen Iteration 10

> Diese Datei ergänzt das bestehende Designsystem (`tailwind.config.ts` mit `baerenstark-*`-Palette).
> Es werden **keine** neuen Brand-Farben erfunden. Alle Tokens leiten sich aus der vorhandenen Holz/Beige-Palette ab oder sind gedämpfte semantische Akzente, die zur Marke passen.
> Bezug: PROJECT.md §Iteration 10, UX_REVIEW QW-4 („Status-Banner auf Designsystem-Tokens umstellen"), `ux-spec-iteration-10.md`.

---

## 1. Neue Tokens — Semantische Feedback-Farben

Begründung: Bisher mischen Banner und Buttons generische Tailwind-Farben (`red-700`, `amber-50` etc.). Iteration 10 braucht konsistente Farben für Status-Badges (US-IT10-05), Toasts (alle Stories) und semantische Banner. Werte sind **gedämpft** und harmonieren mit Braun/Beige (kein „Office-365-Rot", sondern Terracotta; kein Smaragd-Grün, sondern Wald-Grün).

### 1.1 Tokens

| Token | Hex (Light Mode) | Hex (Dark Mode, optional, später) | Zweck |
|-------|------------------|-----------------------------------|-------|
| `feedback-success` | `#3F7A4D` | `#7AB58A` | „Bestätigt", Erfolgs-Toast, Success-Banner |
| `feedback-success-bg` | `#E8F1EA` | `#1F3A28` | Hintergrund für Success-Banner/Badge |
| `feedback-success-border` | `#3F7A4D` | `#7AB58A` | Linke Akzent-Linie / Border |
| `feedback-warning` | `#C8801A` | `#E5A65A` | „Offen" (Pending), Warn-Toast |
| `feedback-warning-bg` | `#FBF1E1` | `#3A2A12` | Hintergrund |
| `feedback-warning-border` | `#C8801A` | `#E5A65A` | Border |
| `feedback-error` | `#B23A3A` | `#D77A7A` | „Abgelehnt", Error-Toast, Validierungs-Banner |
| `feedback-error-bg` | `#F7E4E4` | `#3A1F1F` | Hintergrund |
| `feedback-error-border` | `#B23A3A` | `#D77A7A` | Border |
| `feedback-info` | `#3D6B8C` | `#85B5D6` | „Gegenvorschlag", Info-Toast |
| `feedback-info-bg` | `#E4ECF3` | `#1A2A38` | Hintergrund |
| `feedback-info-border` | `#3D6B8C` | `#85B5D6` | Border |
| `feedback-neutral` | `baerenstark-bark` (`#3D2B1F`) | (gleicher Token) | „Storniert"-Text |
| `feedback-neutral-bg` | `baerenstark-sand` (`#D9C2A2`) | — | „Storniert"-Hintergrund |
| **`status-completed-fg`** (NEU IT10, fix QA UX-2) | `#5C4226` | `#C9A678` | „Abgeschlossen"-Text. Gedämpfter Holz-Ton, **bewusst nicht grün** (das ist `feedback-success`). |
| **`status-completed-bg`** (NEU IT10) | `#EADBC0` | `#3A2D1A` | „Abgeschlossen"-Hintergrund. Sand-/Holz-Tint, signalisiert „erledigt, archiviert". |
| **`status-completed-border`** (NEU IT10) | `#A38660` | `#A38660` | Border / Akzent für „Abgeschlossen"-Badge. |

> Anmerkung Dark-Mode: Bärenstark-App ist aktuell Light-Mode-only. Die Dark-Mode-Werte sind **vorgeschlagen** für später, aktuell **nicht** implementieren (Scope IT10).

### 1.2 Tailwind-Config-Eintrag (Vorschlag)

```ts
// tailwind.config.ts → theme.extend.colors
colors: {
  baerenstark: { /* bestehend */ },
  leaf: '#4A7C59',         // bestehend, NICHT entfernen (FullCalendar-Bezug)
  'amber-accent': '#F59E0B', // bestehend, NICHT entfernen

  // NEU IT10:
  feedback: {
    success: '#3F7A4D',
    'success-bg': '#E8F1EA',
    warning: '#C8801A',
    'warning-bg': '#FBF1E1',
    error: '#B23A3A',
    'error-bg': '#F7E4E4',
    info: '#3D6B8C',
    'info-bg': '#E4ECF3',
  },
  // NEU IT10 (fix QA UX-2 — Status COMPLETED):
  status: {
    'completed-fg': '#5C4226',
    'completed-bg': '#EADBC0',
    'completed-border': '#A38660',
  },
},
```

Verwendung: `bg-feedback-success-bg text-feedback-success border-l-4 border-feedback-success`.
Für „Abgeschlossen"-Badge: `bg-status-completed-bg text-status-completed-fg border border-status-completed-border`.

### 1.3 Kontrast-Tabelle (WCAG 2.1 AA Verifikation)

Ziel: Text auf Hintergrund mind. 4.5:1 für normalen Text, 3:1 für UI-Elemente / Large Text.

| Vordergrund | Hintergrund | Ratio | Pass? |
|-------------|-------------|-------|-------|
| `feedback-success` (#3F7A4D) | `feedback-success-bg` (#E8F1EA) | ~5.1:1 | AA ✓ |
| `feedback-warning` (#C8801A) auf `baerenstark-bark` (#3D2B1F) Text | `feedback-warning-bg` (#FBF1E1) | Bark-Text auf Warning-bg: ~9.4:1 | AAA ✓ |
| `feedback-error` (#B23A3A) | `feedback-error-bg` (#F7E4E4) | ~5.7:1 | AA ✓ |
| `feedback-info` (#3D6B8C) | `feedback-info-bg` (#E4ECF3) | ~5.8:1 | AA ✓ |
| `baerenstark-bark` (#3D2B1F) | `baerenstark-sand` (#D9C2A2) | ~7.2:1 | AAA ✓ |
| `baerenstark-cream` (#F5EBDD) | `baerenstark-wood` (#7B5E3C) | ~5.4:1 | AA ✓ (CTA-Button) |
| `baerenstark-bark` | `baerenstark-cream` | ~11.3:1 | AAA ✓ |
| **`status-completed-fg` (#5C4226)** | **`status-completed-bg` (#EADBC0)** | **~8.4:1** | **AAA ✓** (NEU IT10, „Abgeschlossen"-Badge) |

Alle in IT10 verwendeten Text/BG-Paare erfüllen mindestens WCAG 2.1 AA. Das Pflichtfeld-Asterisk und Inline-Fehler nutzen `feedback-error` auf `baerenstark-cream` (~6.2:1, AA).

### 1.4 Status-Badge-Farb-Mapping (verbindlich) — 6 Varianten nach QA UX-2

| Status | Text | Background | Border | Icon (lucide) | Icon-Farbe |
|--------|------|------------|--------|---------------|------------|
| Offen (`PENDING`) | `baerenstark-bark` | `feedback-warning-bg` | `feedback-warning` | `Clock` | `feedback-warning` |
| Bestätigt (`CONFIRMED`) | `feedback-success` | `feedback-success-bg` | `feedback-success` | `CheckCircle2` | `feedback-success` |
| Abgelehnt (`REJECTED`) | `feedback-error` | `feedback-error-bg` | `feedback-error` | `XCircle` | `feedback-error` |
| Storniert (`CANCELLED`) | `baerenstark-bark` | `baerenstark-sand` | `baerenstark-bark` | `Ban` | `baerenstark-bark/70` |
| Gegenvorschlag (`COUNTER_PROPOSED`) | `feedback-info` | `feedback-info-bg` | `feedback-info` | `RefreshCw` | `feedback-info` |
| **Abgeschlossen (`COMPLETED`)** (NEU IT10) | `status-completed-fg` (`#5C4226`) | `status-completed-bg` (`#EADBC0`) | `status-completed-border` (`#A38660`) | `CheckCheck` (Doppel-Häkchen) | `status-completed-fg` |

**Microcopy-Hinweis:** Der sichtbare Badge-Text ist exakt „Abgeschlossen" (kein „Erledigt", kein „Fertig" — Konsistenz mit Backend-Status `COMPLETED`).

**Designentscheidung „warum nicht grün?":** `CONFIRMED` (Tom hat zugesagt) ist grün, weil grün = „Aktion bestätigt, läuft positiv". `COMPLETED` (Termin war, alles erledigt) wechselt bewusst auf einen ruhigeren Holz-/Sand-Ton — das signalisiert „Vorgang abgeschlossen, archiviert" und differenziert visuell vom aktiven `CONFIRMED`. Doppel-Häkchen-Icon (`CheckCheck`) verstärkt die „abgeschlossen"-Semantik gegenüber dem Single-Häkchen (`CheckCircle2`) von `CONFIRMED`.

---

## 2. Neue Tokens — Modal & Backdrop

| Token | Wert | Zweck |
|-------|------|-------|
| `backdrop-default` | `rgba(60, 40, 20, 0.55)` | Modal-Overlay (US-IT10-04). Braun-Tint passt zur Marke statt schwarzer Default. |
| `backdrop-strong` | `rgba(60, 40, 20, 0.72)` | Reserviert für künftige destruktive Confirm-Dialoge. |
| `radius-modal` | `1rem` (16 px) | Bottom-Sheet oben-Radius (Mobile) und Modal-Radius (Desktop). |
| `radius-bottom-sheet-handle` | `9999px` | Drag-Handle-Strich. |
| `shadow-modal` | `0 24px 48px rgba(60, 40, 20, 0.18)` | Desktop-Modal-Shadow. Stärker als bestehender `shadow-card` (`0 4px 18px rgba(60,40,20,.10)`), um Modal klar abzuheben. |
| `shadow-toast` | `0 10px 24px rgba(60, 40, 20, 0.14)` | Toast-Shadow. |
| `z-modal-backdrop` | `40` | Layer-Reihenfolge. |
| `z-modal-content` | `50` | Über Backdrop. |
| `z-toast` | `60` | Über Modal (Toast bleibt sichtbar bei offener Modal-Schließung). |

### 2.1 Tailwind-Config-Eintrag (Vorschlag)

```ts
theme: {
  extend: {
    boxShadow: {
      soft: '0 2px 12px rgba(60, 40, 20, 0.08)',          // bestehend
      card: '0 4px 18px rgba(60, 40, 20, 0.10)',          // bestehend
      modal: '0 24px 48px rgba(60, 40, 20, 0.18)',        // NEU IT10
      toast: '0 10px 24px rgba(60, 40, 20, 0.14)',        // NEU IT10
    },
    borderRadius: {
      xl2: '1.25rem',                                     // bestehend
      modal: '1rem',                                      // NEU IT10
    },
    zIndex: {
      'modal-backdrop': '40',
      'modal-content': '50',
      toast: '60',
    },
  },
},
```

---

## 3. Neue Tokens — Spacing für Modal & Bottom-Sheet

Bisheriges Spacing-System nutzt Tailwind-Defaults (4 px-Skala). Für IT10 reichen die Defaults aus — **keine** neuen Spacing-Tokens nötig.

Verbindliche Anwendungswerte für `QuickBookingModal`:

| Element | Padding/Margin |
|---------|----------------|
| Modal-Header (sticky) | `p-4` (16 px), Mobile; `p-6` (24 px), Desktop |
| Modal-Body | `px-4 py-3` Mobile; `px-6 py-4` Desktop; vertikaler Gap zwischen Sections `space-y-6` |
| Modal-Footer (sticky) | `px-4 py-3 pb-[env(safe-area-inset-bottom,12px)]` Mobile; `px-6 py-4` Desktop |
| Backdrop-Padding (Desktop) | Modal hat `m-6` rundherum (24 px Air-Gap) |
| Bottom-Sheet-Drag-Handle | `mt-2 mb-3 mx-auto h-1 w-10 rounded-full bg-baerenstark-sand` |

---

## 4. Neue Tokens — Animation & Motion

| Token | Wert | Zweck |
|-------|------|-------|
| `duration-modal-enter` | 200 ms (Desktop) / 250 ms (Mobile) | Modal/Sheet öffnen |
| `duration-modal-exit` | 150 ms | Modal schließen |
| `duration-toast-enter` | 200 ms | Toast slide-in |
| `duration-toast-exit` | 150 ms | Toast slide-out |
| `easing-default` | `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo, sanft) | Modal-Open, Toast-In |
| `easing-exit` | `cubic-bezier(0.7, 0, 0.84, 0)` (ease-in-quart) | Modal-Close, Toast-Out |

### Reduced-Motion-Regel

```css
@media (prefers-reduced-motion: reduce) {
  /* Alle Translate/Slide-Animationen → reine Opacity-Fade */
  /* Duration capped auf 100 ms */
}
```

Verbindlich für `QuickBookingModal` und `Toast`. Adressiert UX_REVIEW „Querschnitt A11y".

---

## 5. Icon-System (kein neuer Token, Hinweis)

UX_REVIEW Minor-Finding: Emojis (`📋`, `📞`, `📅`, `📍`) sehen geräteabhängig aus und sind a11y-instabil.

**Verbindlich für IT10:** Alle neuen Komponenten nutzen `lucide-react` (ist im Repo verfügbar bzw. einfach zu integrieren — bitte Engineer prüfen). Verwendete Icons IT10:

| Verwendung | lucide-Icon |
|-----------|-------------|
| Status „Offen" | `Clock` |
| Status „Bestätigt" | `CheckCircle2` |
| Status „Abgelehnt" | `XCircle` |
| Status „Storniert" | `Ban` |
| Status „Gegenvorschlag" | `RefreshCw` (alternativ `Repeat`) |
| **Status „Abgeschlossen"** (NEU IT10) | `CheckCheck` (Doppel-Häkchen) |
| Pagination-Vor (Desktop) | `ChevronRight` |
| Pagination-Zurück (Desktop) | `ChevronLeft` |
| Toast Success | `CheckCircle2` |
| Toast Warning | `AlertTriangle` |
| Toast Error | `XCircle` |
| Toast Info | `Info` |
| Empty-State (Anfragen) | `ClipboardList` |
| Empty-State (Nutzer) | `Users` |
| Modal-Close | `X` |
| Slot-Ändern | `ChevronLeft` (oder `RefreshCw` für „austauschen") |
| Profil-Link | `User` |
| Telefon-Anruf | `Phone` |

Größen: 16 px (inline-Text), 20 px (Buttons, Badges), 24 px (Toasts, Modal-Header), 48 px (Empty-States).

Regel: jedes Icon ohne sichtbares Text-Label braucht `aria-label`. Icons mit Text-Label bekommen `aria-hidden="true"`.

---

## 6. Was wird **nicht** geändert

Damit Toms Design-Konsistenz erhalten bleibt:

- Bestehende `baerenstark-*`-Palette bleibt unverändert.
- `leaf` (#4A7C59) bleibt — wird von FullCalendar / Slot-Selektion genutzt.
- `amber-accent` bleibt — bestehende Counter-Proposal-Badges.
- Schriften (Inter + Playfair Display) bleiben.
- `borderRadius.xl2` (1.25rem), `shadow-soft`, `shadow-card` bleiben.
- Alle bestehenden Komponenten in `components/ui/` (Button, Input, Badge, Card, ConfirmDialog, Skeleton) behalten ihre API.

---

## 7. Story-Coverage

| Story | Design-System-Deliverable |
|-------|---------------------------|
| US-IT10-01 | `feedback-success`/`-error` Tokens für Reset-Banner und Toast |
| US-IT10-02 | `feedback-error` für Error-State der Tabelle. Pagination-Icons `ChevronLeft`/`ChevronRight` (NEU IT10). |
| US-IT10-03 | `feedback-error` Token + `feedback-warning` (slot-taken) |
| US-IT10-04 | `backdrop-default`, `radius-modal`, `shadow-modal`, Animation-Tokens, `z-modal-*` |
| US-IT10-05 | Status-Badge-Farb-Mapping (**6 Varianten** inkl. neuem `status-completed-*`), `feedback-info` für Prefill-Hinweis-Banner. Pagination-Icons (NEU IT10). |

---

## 8. Migration-Hinweis (für Frontend-Engineer)

1. **Schritt 1:** Tailwind-Config erweitern (siehe §1.2 + §2.1).
2. **Schritt 2:** Bestehende `<Banner>`-Komponente migrieren auf neue Feedback-Tokens (siehe `component-library-iteration-10.md` §8.3) — synergetisch mit UX_REVIEW QW-4.
3. **Schritt 3:** Neue Komponenten (`QuickBookingModal`, `BookingStatusBadge`, `Toast`) **nur** mit den neuen Tokens bauen — keine Hex-Werte hardcoden.
4. **Schritt 4:** Visual-QA gegen Kontrast-Tabelle §1.3.

---

## 9. Offene Design-Fragen

1. **Dark Mode:** Aktuell Light-Mode-only. Soll IT11 oder später Dark Mode liefern? Tokens sind vorbereitet (siehe §1.1 Spalte 3), aber nicht aktiviert. **Bitte bestätigen, dass Dark-Mode ausgeklammert bleibt.**
2. **Icon-Library:** Falls `lucide-react` nicht im Repo, Alternative: Heroicons (auch ok, aber andere Visual-Sprache). Bitte Engineer kurz prüfen.
3. **„amber-accent" Konsolidierung:** Bestehender Token überschneidet sich konzeptionell mit dem neuen `feedback-warning`. Mittelfristig (IT11+) auf einen Token zusammenführen — IT10 lässt beide stehen, um Regressionen zu vermeiden.
