# UX-Spezifikation — Iteration 11 (Bärenstark Hausservice)

> **Sprache:** Deutsch, Sie-Form (konsistent mit IT7–IT10).
> **Mobile-first:** Spec gilt vorrangig für 360 px Viewport, Desktop zusätzlich.
> **Stack:** Next.js 14 + Tailwind + shadcn/ui (Dialog = Modal). Brand-Tokens `baerenstark-*`.
> **Bezug:** PROJECT.md §Iteration 11, US-IT11-01 bis US-IT11-05; orchestrator-bestätigte Entscheidung (Quick-Booking-Modal als einziger primärer Buchungsweg, `/buchen` als Fallback).
> **Verhältnis zu IT10-Spec:** Diese Datei **ergänzt** `ux-spec-iteration-10.md`. Alle Konventionen aus §1 IT10 (Toast, Inline-Fehler, Fokus-Mgmt, Live-Regions, Fehler-Mapping) bleiben gültig und werden hier verfeinert. IT10-§5 (`QuickBookingModal`) bleibt strukturell bestehen — IT11 streicht den separaten Slot-Picker auf der Startseite und definiert den globalen CTA-Flow neu.

---

## Iteration 11 — UX-Vereinfachung

### IT11-§0  Geltungsbereich & Designziele

| Story        | Designschwerpunkt IT11                                                              |
|--------------|--------------------------------------------------------------------------------------|
| US-IT11-01   | Keine UI-Änderung; verweist auf Server-/Konfig-Fixes. Nur Smoke-Test-UX (Erfolgs-Toast greift). |
| US-IT11-02   | **Buchungsweg konsolidieren** — nur ein primärer CTA, Modal-First, `/buchen` als Fallback. |
| US-IT11-03   | **Klares Erfolgs-/Fehler-Feedback** — Toast-Pattern (geschärft), Bestätigungs-Page mit Buchungsnummer, Fehler-Mapping erweitert. |
| US-IT11-04   | **Datei-Upload UX** — kundenseitig (im Modal/Form) und admin-seitig (Detail-Ansicht mit Galerie). |
| US-IT11-05   | **Profil-Vorausfüllung** — visuelles Feedback, Verhalten bei Edits (lokal, nicht Profil-Sync). |

### IT11-§1  Buchungsweg konsolidieren (US-IT11-02)

#### IT11-§1.1  Information-Architecture-Diff (vorher → nachher)

```
VORHER (IT10):                                  NACHHER (IT11):
┌──────────────────────────┐                    ┌──────────────────────────┐
│ Startseite (/)           │                    │ Startseite (/)           │
│  - Hero-CTA „Termin      │                    │  - Hero-CTA „Termin      │
│    buchen" → /buchung    │                    │    buchen" → openModal() │
│  - ServiceGrid-Cards     │                    │  - ServiceGrid-Cards     │
│    „Diesen Service       │                    │    „Diesen Service       │
│    buchen" → /buchung    │                    │    buchen" → openModal() │
│  - **Eingebetteter       │   ← entfällt       │    (mit defaultService)  │
│    Slot-Picker** mit     │   IT11             │  - Header-CTA „Termin    │
│    Kalender → öffnet     │                    │    buchen" → openModal() │
│    Modal                 │                    │                          │
│                          │                    │  KEIN eingebetteter      │
│ Header: „Termin buchen"  │                    │  Slot-Picker mehr.       │
│   → /buchung             │                    │                          │
└──────────────────────────┘                    └──────────────────────────┘
        │                                                 │
        ▼                                                 ▼
┌──────────────────────────┐                    ┌──────────────────────────┐
│ /buchung (Page)          │                    │ /buchen (Fallback-Page)  │
│  - Vollständiger Flow    │                    │  - Identisches           │
│    mit Kalender + Form   │                    │    Buchungsformular      │
│                          │                    │    + Kalender,           │
│ /buchung/bestaetigt      │                    │    OHNE Modal-Wrapper.   │
│  - Counter-Proposal-     │                    │  - Bleibt Fallback für   │
│    Confirmation (IT3)    │                    │    Direkt-URL und        │
│                          │                    │    JS-disabled.          │
│                          │                    │                          │
│                          │                    │ /buchung/bestaetigung/   │
│                          │                    │   [bookingId]            │
│                          │                    │  - **NEU IT11**          │
│                          │                    │    Post-Submit-          │
│                          │                    │    Bestätigungs-Page.    │
│                          │                    │                          │
│                          │                    │ /buchung/bestaetigt      │
│                          │                    │  - bestehend (Counter-   │
│                          │                    │    Proposal-Respond),   │
│                          │                    │    NICHT verändert.      │
└──────────────────────────┘                    └──────────────────────────┘
```

> **Routing-Hinweis (BESTÄTIGT IT11):** Kanonischer Pfad ist **`/buchung`**. Alle Spec-Erwähnungen von `/buchen` aus Story-Text werden auf `/buchung` ausgelegt. Falls Tom auf `/buchen` als Marketing-Pfad besteht: 301-Redirect `/buchen → /buchung` (kein UX-Impact). Storno-Page-URL: **`/buchung/[id]/stornieren?token=…`**.

#### IT11-§1.2  User-Flow „Buchung anfragen" (NEU IT11)

```
                ┌──────────────────────┐
                │     Startseite (/)   │
                └──────────────────────┘
                         │
       ┌─────────────────┼─────────────────────┐
       │                 │                      │
   Hero-CTA        Service-Card-CTA       Header-CTA
   „Termin          „Diesen Service       „Termin buchen"
    buchen"          buchen"
       │                 │                      │
       │                 │ defaultService = X   │
       └─────────────────┴──────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │  QuickBookingModal öffnet  │
            │  (Bottom-Sheet Mobile,     │
            │   zentriert Desktop)       │
            │                            │
            │  Schritt 1: Service        │
            │   (vorausgewählt oder      │
            │    Pflicht-Auswahl)        │
            │  Schritt 2: Kalender +     │
            │   Slot-Auswahl             │
            │  Schritt 3: Kontakt-       │
            │   formular (vorausgefüllt  │
            │   bei Login, US-IT11-05)   │
            │  Schritt 4: Datei-Upload   │
            │   (optional, US-IT11-04)   │
            │  Schritt 5: Datenschutz +  │
            │   Submit                   │
            └────────────────────────────┘
                         │
                  POST /api/bookings
                         │
            ┌────────────┴────────────┐
            │                         │
       201 Created               4xx / 5xx
            │                         │
            ▼                         ▼
   ┌─────────────────┐      ┌──────────────────────┐
   │ Modal schließt  │      │ Modal bleibt offen   │
   │ Toast (success) │      │ Banner / Inline-     │
   │ + Redirect →    │      │  Fehler              │
   │ /buchung/       │      │ (US-IT11-03)         │
   │  bestaetigung/  │      └──────────────────────┘
   │  [bookingId]    │
   └─────────────────┘
            │
            ▼
   ┌─────────────────────────────────┐
   │ Bestätigungs-Page               │
   │  - Buchungsnummer #BK-2026-0042 │
   │  - Service / Datum / Adresse    │
   │  - Status-Badge „Offen"         │
   │  - Hinweistext „Tom meldet      │
   │    sich innerhalb 24 h"         │
   │  - CTAs: „Zur Startseite",      │
   │    „Zum Kunden-Dashboard"       │
   │    (eingeloggt) bzw. „Konto     │
   │    erstellen" (Gast)            │
   └─────────────────────────────────┘
```

**Fallback-Flow (`/buchen` direkt aufgerufen):**

```
/buchen direkt aufrufen ─► Page rendert dasselbe BookingForm + Kalender
                          inline (kein Modal-Wrapper).
                          Submit ─► gleiches POST /api/bookings
                          Erfolg ─► Redirect /buchung/bestaetigung/[id]
                          (kein Toast nötig — Page-Wechsel vermittelt
                           die Erfolgs-Bestätigung)
```

#### IT11-§1.3  Buchungs-Einstiegspunkte (verbindliche Inventarliste)

| Einstiegspunkt                  | Verhalten IT11                                   | Notiz                                  |
|---------------------------------|--------------------------------------------------|----------------------------------------|
| Hero-CTA „Termin buchen" (`/`)  | `openModal()` — keine Navigation                 | Primary-Button, sichtbar without scroll |
| Service-Card-CTA „Diesen Service buchen" (`/`) | `openModal({ defaultService: slug })` | gilt für alle 4 Service-Cards          |
| Header-CTA „Termin buchen" (alle Pages) | `openModal()`                            | rechts in der Top-Nav, persistent      |
| Mobile-Burger-Menü „Termin buchen" | `openModal()` + Menü-Schließen                | gleiche Wirkung wie Header-CTA         |
| Direkt-URL `/buchen`            | Page rendert (Fallback)                          | für SEO, Bookmarks, JS-disabled        |
| Detail-Page „Neue Anfrage stellen" (`/konto/anfragen/[id]`) | `openModal()` (eingeloggt) | siehe IT10 §6.9                        |
| Empty-State `/konto` „Jetzt erste Anfrage stellen" | `openModal()`                          | siehe IT10 §6.4                        |

> **Verbot IT11:** Es darf außerhalb dieser Liste keinen weiteren Buchungs-CTA und keinen eingebetteten Slot-Picker geben. Insbesondere **kein** Slot-Picker auf der Startseite oder den Service-Detail-Pages.

#### IT11-§1.4  State-Tabelle: Startseite (`/`) bezogen auf Buchungs-CTAs

| State                    | Trigger                          | Sichtbar                                                              |
|--------------------------|----------------------------------|-----------------------------------------------------------------------|
| `idle-page-load`         | Page-Mount                       | Hero mit Primary-CTA „Termin buchen"; ServiceGrid-Cards mit Sekundär-CTAs; Header-CTA persistent. **Kein** Slot-Picker. |
| `modal-open`             | CTA-Klick                        | QuickBookingModal überlagert die Page; Body-Scroll gesperrt; Backdrop sichtbar. |
| `modal-closing-success`  | Submit 201                       | Modal animiert raus; Toast (success) erscheint; **Auto-Redirect** zu `/buchung/bestaetigung/[id]` nach 250 ms. |
| `modal-closing-cancel`   | Escape / X / Backdrop / „Abbrechen" | Modal animiert raus; Page-State unverändert. |
| `modal-error`            | 4xx/5xx Submit                   | Modal bleibt offen, Banner/Inline-Fehler (siehe IT10 §4.2 + IT11-§2). |

> **Hinweis zur Erfolgs-UX-Änderung gegenüber IT10:** IT10 hatte „Modal schließt + Toast + KEIN Auto-Redirect" gespezt. IT11 ändert das **bewusst** (US-IT11-03 Akzeptanzkriterium 1: „auf eine Bestätigungsseite mit Buchungsnummer, Service und Datum weitergeleitet"). Toast erscheint kurz (4 s), Auto-Redirect zur Bestätigungs-Page nach 250 ms. Toast bleibt auch auf der Bestätigungs-Page sichtbar (rendert über Layout-Toaster).

### IT11-§2  Erfolgs- & Fehler-Feedback (US-IT11-03)

#### IT11-§2.1  Toast-Pattern (geschärft)

> **Ergänzung zu IT10 §1.1.** Die Grund-Spec bleibt — Position, Dauer, A11y, Reduce-Motion. IT11 ergänzt die Microcopy-Slots für den Buchungs-Flow:

| Variant       | Trigger                         | Dauer | Position Mobile / Desktop      | Microcopy IT11 |
|---------------|---------------------------------|-------|--------------------------------|----------------|
| `success`     | Booking-POST 201                | 5 s   | unten zentriert / oben rechts  | „Anfrage erfolgreich gesendet! Tom meldet sich in Kürze bei Ihnen. Telefonisch erreichbar: **0157 74787512**." |
| `error`       | Booking-POST 5xx / Netzwerk     | 6 s   | unten zentriert / oben rechts  | „Wir konnten Ihre Anfrage nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: **0157 74787512**." |
| `warning`     | Booking-POST 409 (Slot-belegt)  | 6 s   | unten zentriert / oben rechts  | „Dieser Slot ist inzwischen vergeben. Bitte wählen Sie einen anderen Termin." |
| `info`        | Profil-Vorausfüllung-Hinweis    | 5 s   | unten zentriert / oben rechts  | (siehe IT11-§4.3) |

**Farben (Tokens, IT10 design-system-additions §1.1):**

- `success` → BG `feedback-success-bg`, Text `feedback-success`, Border-Left `feedback-success`. Icon `CheckCircle2`.
- `error` → BG `feedback-error-bg`, Text `feedback-error`, Border-Left `feedback-error`. Icon `XCircle`.
- `warning` → BG `feedback-warning-bg`, Text `baerenstark-bark`, Border-Left `feedback-warning`. Icon `AlertTriangle`.
- `info` → BG `feedback-info-bg`, Text `feedback-info`, Border-Left `feedback-info`. Icon `Info`.

**A11y (verbindlich):**

- Erfolgs-Toast: `role="status"` + `aria-live="polite"`.
- Fehler-Toast: `role="alert"` + `aria-live="assertive"`.
- Telefonnummer im Toast: `<a href="tel:+4915774787512">0157&nbsp;74787512</a>` (Display: `0157 74787512` mit non-breaking-space; `tel:`-Link bleibt `tel:+4915774787512`), fokussierbar mit Tab.
- Schließen-Button: `aria-label="Hinweis schließen"`, immer sichtbar.

**Stacking + Pause:**

- Maximal 3 Toasts gleichzeitig. Beim Hinzukommen eines vierten verschwindet der älteste sofort (kein Animations-Klotz).
- Hover/Focus pausiert Auto-Dismiss-Timer (übernommen aus IT10).

#### IT11-§2.2  Bestätigungs-Page (`/buchung/bestaetigung/[bookingId]?token=…`, NEU IT11)

> **Wichtig — separate Route gegenüber bestehender `/buchung/bestaetigt`:** Die bestehende Page `/buchung/bestaetigt` ist die Counter-Proposal-Respond-Confirmation (IT3). Sie bleibt unverändert. IT11 führt eine **neue** Route `/buchung/bestaetigung/[bookingId]` für Post-Submit ein.
>
> **Routing (BESTÄTIGT IT11 durch Tom):** Page ist erreichbar via `/buchung/bestaetigung/[bookingId]?token=…`. Eingeloggte Kunden können auch ohne `?token=…`-Query-Param zugreifen (Auth-Cookie reicht). Gäste **müssen** den signierten Token mitführen — fehlt er, antwortet der Server mit 401, UI rendert `<TokenExpiredState>`.

**Layout (Mobile, 360 px):**

```
┌────────────────────────────────────────────┐
│  ← Zurück zur Startseite                   │  ← Sekundär-Link, oben links
├────────────────────────────────────────────┤
│              [Logo, 80×80]                 │
│                                            │
│         Anfrage erfolgreich                │  ← H1, font-serif, font-bold
│              gesendet                      │
│                                            │
│     Buchungsnummer: #BK-2026-0042          │  ← H2, semibold, monospace-Hint
│                                            │
├────────────────────────────────────────────┤
│  Termin                                    │
│  Mo, 12.05.2026 · 09:00 – 11:00            │
│                                            │
│  Service                                   │
│  Reinigung · 2 Stunden                     │
│                                            │
│  Adresse                                   │
│  Musterstraße 12, 64283 Darmstadt          │
│                                            │
│  Status                                    │
│  [● Offen]  ← Status-Badge                 │
├────────────────────────────────────────────┤
│  ┌────────────────────────────────────┐    │
│  │  ℹ️  Was passiert jetzt?            │    │  ← Info-Banner
│  │                                    │    │     (Token feedback-info)
│  │  Tom meldet sich innerhalb von     │    │
│  │  24 Stunden bei Ihnen. Sie         │    │
│  │  erhalten eine E-Mail, sobald      │    │
│  │  Tom Ihre Anfrage bestätigt.       │    │
│  │                                    │    │
│  │  Telefonisch erreichbar:          │    │
│  │  📞 0157 74787512  (klickbar)      │    │
│  └────────────────────────────────────┘    │
├────────────────────────────────────────────┤
│  ┌────────────────────────────────────┐    │  ← NEU IT11
│  │  🔖  Diesen Link 30 Tage           │    │     Hinweis-Card
│  │      aufbewahren                   │    │     (Token-Erklärung)
│  │                                    │    │
│  │  Diese Seite ist Ihr Zugang zu     │    │
│  │  Status und Stornierung Ihrer      │    │
│  │  Anfrage. Speichern Sie den Link   │    │
│  │  oder die Bestätigungs-E-Mail.     │    │
│  └────────────────────────────────────┘    │
├────────────────────────────────────────────┤
│  [Zur Startseite]    (Sekundär, full-w)    │
│  [Zum Kunden-Dashboard →]  (Primary,       │  ← nur eingeloggt
│   eingeloggt)                              │
│  [Jetzt Konto erstellen, um den Status     │  ← nur Gast
│   zu verfolgen →]  (Primary, Gast)         │
│                                            │
│  [Anfrage stornieren]  (sekundär,          │  ← NEU IT11 (Gast)
│   destruktiv-link, nur bei Status          │     nur sichtbar bei
│   „Offen" oder „Bestätigt")                │     Status Offen/Bestätigt
└────────────────────────────────────────────┘
```

**Layout (Desktop, ≥1024 px):**

- Karten-Layout, max-width `min(720px, 90vw)`, vertikal zentriert mit `mt-12`.
- Detail-Daten 2-spaltig (Label links, Wert rechts).
- CTAs nebeneinander, rechtsbündig.

**State-Tabelle:**

| State                | Trigger                                                                  | Sichtbar                                                             |
|----------------------|--------------------------------------------------------------------------|----------------------------------------------------------------------|
| `loading`            | Page-Mount, `GET /api/bookings/{id}/confirmation` pending               | Skeleton: 80×80 Logo-Placeholder, 3 Zeilen Header-Skeleton, 4 Zeilen Detail-Skeleton, 1 Banner-Skeleton, 2 Button-Skeletons |
| `success`            | API liefert Booking-Daten                                                | Vollständiges Layout (siehe oben), inkl. „30 Tage aufbewahren"-Hinweis-Card und ggf. Storno-CTA. |
| `not-found`          | 404 — Booking-ID existiert nicht                                          | Error-Block: „Diese Anfrage konnten wir nicht finden. Falls Sie gerade eine Anfrage gestellt haben, prüfen Sie bitte Ihr E-Mail-Postfach. Andernfalls **[zurück zur Startseite](/)**." |
| `forbidden`          | 403 — eingeloggter Kunde fragt fremde Booking ab                         | Error-Block: „Sie haben keinen Zugriff auf diese Anfrage. **[Zur Übersicht](/konto)**" |
| `token-expired` (NEU IT11) | 401/410 — signed URL-Token abgelaufen (>30 Tage)                  | `<TokenExpiredState>` (siehe Component-Library): Icon, Text „Dieser Link ist nicht mehr gültig. Bitte rufen Sie uns an: **0157 74787512**" mit `tel:`-Link, Sekundär-Link „Zur Startseite". |
| `error`              | 5xx                                                                       | Error-Block: „Wir konnten die Bestätigung gerade nicht laden. Bitte versuchen Sie es in einem Moment erneut." + Retry-Button |

**Microcopy (verbindlich, deutsch):**

| Element                        | Text                                                                                       |
|--------------------------------|--------------------------------------------------------------------------------------------|
| H1                             | „Anfrage erfolgreich gesendet"                                                            |
| Buchungsnummer-Label           | „Buchungsnummer:" (gefolgt von ID, fett + monospace-Hint)                                  |
| Section-Headers                | „Termin", „Service", „Adresse", „Status"                                                  |
| Info-Banner-Title              | „Was passiert jetzt?"                                                                      |
| Info-Banner-Body               | „Tom meldet sich innerhalb von 24 Stunden bei Ihnen. Sie erhalten eine E-Mail, sobald Tom Ihre Anfrage bestätigt." |
| Telefon-Hinweis                | „Telefonisch erreichbar: **0157 74787512**" (klickbar; kanonische Phrase IT11) |
| **Token-Hinweis-Card-Title (NEU IT11)** | „Diesen Link 30 Tage aufbewahren"                                                |
| **Token-Hinweis-Card-Body (NEU IT11)**  | „Diese Seite ist Ihr Zugang zu Status und Stornierung Ihrer Anfrage. Speichern Sie den Link oder die Bestätigungs-E-Mail." |
| Sekundär-CTA                   | „Zur Startseite"                                                                           |
| Primary-CTA (eingeloggt)       | „Zum Kunden-Dashboard →"                                                                   |
| Primary-CTA (Gast)             | „Jetzt Konto erstellen, um den Status zu verfolgen →" → `/konto/registrieren?bookingId=X` |
| **Storno-CTA Gast (NEU IT11)** | „Anfrage stornieren" → `/buchung/[id]/stornieren?token={token}` (sekundär, destruktiv-link, nur bei Status `Offen` / `Bestätigt`) |
| Empty/Error: not-found         | „Diese Anfrage konnten wir nicht finden. Falls Sie gerade eine Anfrage gestellt haben, prüfen Sie bitte Ihr E-Mail-Postfach." |
| **Token-expired-State (NEU IT11)** | „Dieser Link ist nicht mehr gültig. Bitte rufen Sie uns an: **0157 74787512**." |
| Error-Retry-Button             | „Erneut versuchen"                                                                         |

**A11y:**

- `<main aria-labelledby="confirmation-heading">` mit H1 `id="confirmation-heading"`.
- Fokus wandert beim Page-Mount auf H1 (`tabIndex={-1}` + `focus()`).
- Status-Badge: Text + Icon (Icon `aria-hidden="true"`).
- Info-Banner: `role="status"` (nicht `alert` — kein Fehlerzustand).
- Buchungsnummer ist text-selectable (kein `user-select: none`).

**Print-Stylesheet (Bonus, optional IT11):**

- Bestätigungs-Page sollte druckbar sein. CTAs ausgeblendet (`@media print`), Header reduziert.

#### IT11-§2.3  Inline-Feldfehler vs. Toast (Decision-Tabelle)

> **Klarstellung zu IT10 §1.2:** Wann zeigt man Inline-Fehler, wann Toast, wann Banner? IT11 schreibt das eindeutig fest.

| Fehler-Typ                                         | UI-Location                                                                |
|----------------------------------------------------|----------------------------------------------------------------------------|
| Validierungsfehler an einem konkreten Feld         | **Inline unter dem Feld**, plus Banner oben „Bitte prüfen Sie die markierten Felder." (Aggregat). Kein Toast. |
| Slot-belegt (`409` + `subcode: 'BOOKING_SLOT_TAKEN'`) | **Banner oben im Modal/Form**, Submit-Button-Label wechselt auf „Anderen Slot wählen". Kein Toast (Banner ist persistenter). |
| Server-5xx, Netzwerk-Timeout, unklarer Fehler       | **Toast (Fehler)** + zusätzlich Banner unter Submit-Button mit Retry-Hinweis. Toast für Aufmerksamkeit, Banner für Persistenz. |
| Datei-Upload-Fehler (einzelne Datei)                | **Inline an der Datei-Reihe** (siehe IT11-§3.4). Kein Toast — Submit kann ohne diese Datei weiterlaufen. |
| Auth-Fehler beim Profil-Vorausfüllen (401/500)     | **Stiller Fallback** auf leere Felder. Kein Toast (würde verwirren, weil der Submit-Pfad funktioniert). |

#### IT11-§2.4  Loading-States während Submit

| Element                | State `loading` Verhalten                                                            |
|------------------------|--------------------------------------------------------------------------------------|
| Submit-Button          | `disabled`, Label-Switch auf „Wird gesendet…", Spinner-Icon links (16 px), `aria-busy="true"`. Doppel-Submit verhindert. |
| Alle Form-Inputs       | `disabled`, visuell mit `opacity-60`, `pointer-events: none`. Tab-Reihenfolge übersprungen. |
| Modal-Close-Buttons    | `disabled` bis Response — Kunde soll während Submit nicht abbrechen. **Escape geblockt (BESTÄTIGT IT11).** Backdrop-Klick **ebenfalls geblockt**. X-Button visuell `disabled` (`opacity-40`, `cursor-not-allowed`, `aria-disabled="true"`). Begründung: vermeidet Race-Conditions zwischen Abort und Server-Persistenz. |
| Datei-Upload-Reihen    | Bereits hochgeladene Dateien bleiben sichtbar, neue Dateien können nicht hinzugefügt werden. |
| Live-Region            | `<div role="status" aria-live="polite">` rendert „**Anfrage wird gesendet …**" beim Submit-Start. Wird beim Response-Empfang geleert. Visueller Hinweistext erscheint im Modal-Body unterhalb des Submit-Buttons (gleiche Microcopy, sichtbar). |
| Submit-Button-Microcopy | „Wird gesendet …" mit `Loader2`-Spinner-Icon (lucide, 16 px, `animate-spin`, `aria-hidden`). |

### IT11-§3  Datei-Upload UX (US-IT11-04)

#### IT11-§3.1  Limits & akzeptierte Dateitypen

> **BESTÄTIGT IT11 (Tom):**
>
> - **Bilder (`image/*`):** max. **10 MB pro Datei**.
> - **Videos (`video/*`):** max. **50 MB pro Datei**.
> - **PDF (`application/pdf`):** max. **10 MB pro Datei**.
> - `UPLOAD_MAX_FILES_PER_BOOKING = 5` → **5 Dateien pro Buchung**.
> - `UPLOAD_ACCEPTED_CONTENT_TYPES`: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/quicktime`, `application/pdf`.

> **Microcopy-Konsequenz:** UI nennt jetzt **konkret zwei Limits** statt eines einheitlichen Werts. Validierungs-Fehler nennen das Limit, das auf den jeweiligen MIME-Typ zutrifft.

**Microcopy für UI-Hinweise (BESTÄTIGT IT11):**

- Drop-Zone-Hinweis (Default): „**Bilder bis 10 MB, Videos bis 50 MB.**"
- Hilfe-Text unter dem Upload-Feld (länger): „Bilder bis 10 MB, Videos bis 50 MB, PDF bis 10 MB — bis zu **5 Dateien** insgesamt."
- Validierungs-Fehler bei zu großer Bild-Datei: „Diese Datei ist zu groß ({size} MB). Bilder dürfen maximal **10 MB** groß sein."
- Validierungs-Fehler bei zu großer Video-Datei: „Diese Datei ist zu groß ({size} MB). Videos dürfen maximal **50 MB** groß sein."
- Validierungs-Fehler bei zu großem PDF: „Diese Datei ist zu groß ({size} MB). PDFs dürfen maximal **10 MB** groß sein."
- Validierungs-Fehler bei ungültigem Typ: „Dieser Dateityp wird nicht unterstützt. Erlaubt: Bilder (JPG, PNG, WebP, GIF), Videos (MP4, MOV) oder PDF."
- **Fehler-Toast (NEU IT11)** zusätzlich bei Datei-zu-groß: „{filename}: Datei zu groß. Limit für **{Bilder|Videos|PDFs}**: **{10|50|10} MB**." (Toast-Variant `warning`, 5 s).

#### IT11-§3.2  Kundenseitige Upload-Komponente — `FileUpload`

**Verwendung:** Im `QuickBookingModal` und im `/buchen`-Form (Fallback). Komponente bereits vorhanden (`src/components/booking/FileUpload.tsx`, IT-Stand US-18) — IT11 verfeinert UX-Spec **nicht** Re-Implementation.

**Layout (Mobile):**

```
Anhänge (optional)                               ← Section-Label
─────────────────────────────────────────
┌─────────────────────────────────────────┐
│                                         │
│         [📎 Drop-Zone-Icon, 32×32]      │
│                                         │
│   Dateien hierher ziehen oder           │   ← Drop-Zone-Label
│   [Datei auswählen]   ← Sekundär-Button │
│                                         │
│   Bilder bis 10 MB, Videos bis 50 MB.   │   ← Hilfe-Text (BESTÄTIGT IT11)
│   Bis zu 5 Dateien insgesamt.           │
└─────────────────────────────────────────┘

(Sobald Dateien ausgewählt sind:)
┌─────────────────────────────────────────┐
│ [🖼️] foto-1.jpg                          │
│      1.4 MB                              │
│      [▓▓▓▓▓▓▓░░░] 65%                    │   ← Fortschritts-Bar
│                                  [✕]    │   ← Entfernen-Button
├─────────────────────────────────────────┤
│ [🖼️] foto-2.jpg            [✓]          │   ← Erfolgreich hochgeladen
│      2.1 MB · hochgeladen        [✕]    │
├─────────────────────────────────────────┤
│ [🎥] kueche.mp4            [✕ Fehler]   │
│      Diese Datei ist zu groß (24 MB).   │
│      Maximum: 20 MB.             [✕]    │
└─────────────────────────────────────────┘

[+ Weitere Datei hinzufügen]   ← solange < 5 Dateien

(Wenn 5 erreicht:)
ℹ️ Maximum erreicht — bis zu 5 Dateien.
```

**Drop-Zone-States:**

| State              | Trigger                          | Visual                                                                   |
|--------------------|----------------------------------|--------------------------------------------------------------------------|
| `idle`             | Default                          | Border `border-dashed border-baerenstark-sand`, Icon und Hilfe-Text neutral. |
| `drag-over`        | DragEnter im Drop-Zone-Bereich   | Border-Token wechselt auf `upload-dropzone-border-active` (siehe Design-System §IT11-D1), BG `feedback-info-bg/40`. Microcopy: „Dateien hier loslassen". |
| `drag-rejected`    | DragEnter mit ungültigem Typ     | Border `feedback-error`, BG `feedback-error-bg/40`. Microcopy: „Dieser Dateityp wird nicht unterstützt." |
| `disabled`         | 5 Dateien bereits hinzugefügt ODER Submit läuft | Drop-Zone `opacity-50`, `pointer-events: none`, Hilfe-Text wechselt auf „Maximum erreicht — bis zu 5 Dateien." |

**Pro-Datei-Reihen-States:**

| State        | Visual                                                                                          |
|--------------|-------------------------------------------------------------------------------------------------|
| `pending`    | Datei sichtbar, kein Fortschritts-Bar (noch nicht gestartet). Selten — meistens direkt `uploading`. |
| `uploading`  | Linearer Fortschritts-Bar (`<progress>` Element), Prozent-Anzeige. Aria-busy. Entfernen-Button cancelt Upload. |
| `success`    | Grünes Häkchen, Datei-Größe + „hochgeladen". Vorschau-Thumbnail bei Bildern (`<img>` mit `object-cover`, 40×40 px). Bei Videos/PDF: Icon-Platzhalter (siehe IT11-§3.6). Entfernen-Button entfernt aus Liste. |
| `error`      | Rotes X, Inline-Fehlertext (siehe Microcopy unten). Entfernen-Button schließt die Reihe. |

**Microcopy:**

| Element                       | Text                                                               |
|-------------------------------|--------------------------------------------------------------------|
| Section-Label                 | „Anhänge (optional)"                                                |
| Drop-Zone-Label (idle)        | „Dateien hierher ziehen oder"                                       |
| Browse-Button-Label           | „Datei auswählen"                                                   |
| Hilfe-Text (Drop-Zone)        | „Bilder bis 10 MB, Videos bis 50 MB."                               |
| Hilfe-Text (lang, unter Feld) | „Bilder bis 10 MB, Videos bis 50 MB, PDF bis 10 MB — bis zu 5 Dateien insgesamt." |
| Drag-Over                     | „Dateien hier loslassen"                                            |
| Drag-Rejected                 | „Dieser Dateityp wird nicht unterstützt."                           |
| Datei-zu-groß-Fehler (Bild)   | „Diese Datei ist zu groß ({size} MB). Bilder dürfen maximal 10 MB groß sein." |
| Datei-zu-groß-Fehler (Video)  | „Diese Datei ist zu groß ({size} MB). Videos dürfen maximal 50 MB groß sein." |
| Datei-zu-groß-Fehler (PDF)    | „Diese Datei ist zu groß ({size} MB). PDFs dürfen maximal 10 MB groß sein." |
| Datei-Typ-ungültig-Fehler     | „Dieser Dateityp wird nicht unterstützt. Erlaubt: JPG, PNG, WebP, GIF, MP4, MOV oder PDF." |
| Upload-läuft-Status (a11y)    | „{filename} wird hochgeladen, {percent} Prozent."                   |
| Upload-erfolgreich            | „hochgeladen"                                                       |
| Upload-fehlgeschlagen-Generic | „Upload fehlgeschlagen. Bitte erneut versuchen."                    |
| Server nicht erreichbar       | „Wir konnten die Datei nicht hochladen. Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut." |
| Maximum-erreicht              | „Maximum erreicht — bis zu 5 Dateien."                              |
| Entfernen-Button-Aria         | „{filename} entfernen"                                              |
| Server-Storage-disabled       | „Datei-Upload ist gerade nicht verfügbar. Sie können Ihre Anfrage trotzdem absenden — schicken Sie uns Bilder gerne nachträglich per E-Mail." |

**A11y:**

- Drop-Zone: `<div role="button" tabIndex={0} aria-label="Datei auswählen oder hierher ziehen, Bilder bis 10 MB, Videos bis 50 MB, bis zu 5 Dateien">`. Enter/Space öffnet File-Picker.
- Datei-Liste: `<ul role="list">` mit `<li>` pro Datei.
- Upload-Status: `<div role="status" aria-live="polite">` außerhalb der Liste. Update bei jedem State-Wechsel: „{filename} hochgeladen" / „{filename} fehlgeschlagen: {reason}".
- Fortschritts-Bar: `<progress max="100" value={percent} aria-label="Upload {filename}">`.
- Entfernen-Button: `<button aria-label="{filename} entfernen">` mit `<X>` Icon (`aria-hidden`).
- Reduce-Motion: Fortschritts-Bar weiterhin sichtbar (kein Animations-Flicker).

**Keyboard:**

| Key             | Verhalten                                                            |
|-----------------|----------------------------------------------------------------------|
| Tab in Drop-Zone | Fokussiert das `role="button"` Wrapper-Element                       |
| Enter / Space   | Öffnet nativen File-Picker                                           |
| Tab nach Drop-Zone | nächstes interaktives Element ist die erste Datei-Reihe (Entfernen-Button) |
| Tab in Datei-Reihe | Fokus auf Entfernen-Button. Enter/Space löst Entfernen aus.        |

#### IT11-§3.3  Admin-seitige Anzeige — Auftragsdetail mit `FileGallery`

**Verwendung:** Im Admin-Booking-Detail (`/admin/bookings/[id]` — bestehende Page), als Sektion „Hochgeladene Dateien" / „Anhänge" am Ende der Detail-Spalte. Komponente NEU IT11 (siehe Component-Library §`FileGallery`).

**Layout (Desktop):**

```
┌──────────────────────────────────────────────────────────┐
│ Anhänge                                          (3 von 3) │  ← Section-Header + Counter
├──────────────────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐                      │
│  │        │  │        │  │  🎥    │                      │
│  │  IMG   │  │  IMG   │  │   MP4  │                      │   ← Thumbnail-Grid
│  │ 120×120│  │ 120×120│  │ 120×120│                      │
│  └────────┘  └────────┘  └────────┘                      │
│  foto-1.jpg  foto-2.jpg  kueche.mp4                       │
│  1.4 MB      2.1 MB      18.3 MB                          │
│  [↓ Download][↓ Download][↓ Download]                    │
└──────────────────────────────────────────────────────────┘
```

**Layout (Mobile):**

- Grid wechselt von `grid-cols-3` (Desktop) → `grid-cols-2` (Tablet) → `grid-cols-1` (Mobile ≤ 480 px). Auf Mobile rendert eine Card pro Datei (Thumbnail links, Meta+Download-Button rechts).

**Klick-Verhalten (BESTÄTIGT IT11 durch Tom — neuer Tab statt Lightbox):**

- **Klick auf Bild-Thumbnail:** öffnet Bild in neuem Tab via `<a href={url} target="_blank" rel="noopener noreferrer">`. Browser zeigt Bild im nativen Image-Viewer / nativen Tab.
- **Klick auf Video-Thumbnail:** öffnet Video in neuem Tab via `<a href={url} target="_blank" rel="noopener noreferrer">`. Browser nutzt seinen nativen Video-Player.
- **Klick auf PDF-Thumbnail:** öffnet PDF in neuem Tab via `<a href={url} target="_blank" rel="noopener noreferrer">`. Browser nutzt seinen nativen PDF-Viewer.
- **Klick auf Download-Button:** triggert Download (`<a download href={url}>`).

> **Designentscheidung IT11 (Tom-Bestätigung):** Eigene Lightbox-Komponente ist **out-of-scope für IT11** — sie ist nach IT12-Backlog verschoben. „Neuer Tab" ist für IT11 die kanonische Vorschau-UX über alle Datei-Typen hinweg (Bild, Video, PDF). Das vereinfacht die Implementation drastisch und nutzt native Browser-Capabilities.

**Aria-Label-Microcopy für Thumbnail-Anker (BESTÄTIGT IT11):**

- Bild: `aria-label="Bild {filename} in neuem Tab öffnen"`
- Video: `aria-label="Video {filename} in neuem Tab öffnen"`
- PDF: `aria-label="PDF {filename} in neuem Tab öffnen"`

> Microcopy-Konvention IT11: einheitlich „Datei in neuem Tab öffnen" — kein „Vollansicht", kein „ansehen", kein „abspielen".

**State-Tabelle:**

| State                  | Trigger                                                  | Sichtbar                                                              |
|------------------------|----------------------------------------------------------|-----------------------------------------------------------------------|
| `loading`              | Detail-Page-Mount, Booking-Daten pending                  | Skeleton: 3 Thumbnail-Placeholder im Grid                              |
| `populated`            | Booking hat Anhänge                                       | Grid mit Thumbnails (siehe oben)                                      |
| `empty-no-attachments` | Booking hat keine Anhänge (`attachments.length === 0`)    | Inline-Hinweis: „Keine Dateien hochgeladen." in Token `feedback-info` |
| `error-fetch`          | Datei-URL liefert 404/403                                  | Thumbnail mit „⚠️ Datei nicht verfügbar" Overlay, Download-Button disabled |

**Microcopy:**

| Element                       | Text                                                                          |
|-------------------------------|-------------------------------------------------------------------------------|
| Section-Header                | „Anhänge"                                                                     |
| Counter (rechts)              | „{n} von {total}"                                                             |
| Empty-State                   | „Keine Dateien hochgeladen."                                                  |
| Datei-Meta-Format             | „{filename}\n{size}"                                                          |
| Download-Button-Label         | „Download" (mit Icon `Download`, lucide)                                      |
| Thumbnail-Aria-Label (Bild)   | „Bild {filename} in neuem Tab öffnen"                                          |
| Thumbnail-Aria-Label (Video)  | „Video {filename} in neuem Tab öffnen"                                         |
| Thumbnail-Aria-Label (PDF)    | „PDF {filename} in neuem Tab öffnen"                                           |
| Datei-nicht-verfügbar         | „Datei nicht verfügbar"                                                        |

**A11y:**

- `<section aria-labelledby="attachments-heading">` mit hidden H3 oder sichtbarem H3.
- Thumbnail-Wrapper: `<a href={url} target="_blank" rel="noopener noreferrer" aria-label="{Datei-Typ} {filename} in neuem Tab öffnen">` (Anker, kein Button — der native Anker ist semantisch korrekt für „öffnet in neuem Tab" und wird von Screen-Readern korrekt angekündigt).
- Download-Button: `<a href={url} download={filename} aria-label="{filename} herunterladen">`.
- Hinweis Screen-Reader: `target="_blank"` wird von modernen Screen-Readern automatisch als „öffnet in neuem Tab" angekündigt — `aria-label` muss das nicht zusätzlich erwähnen, sondern darf es zur Klarheit dennoch (Konsistenz mit `<a>`-Konvention der App).

#### IT11-§3.4  Edge-Cases (Upload)

| Case                                                | Verhalten                                                                |
|-----------------------------------------------------|--------------------------------------------------------------------------|
| Server-Storage nicht konfiguriert (`BLOB_NOT_CONFIGURED`) | Upload-Sektion blendet sich aus, kleiner Hinweistext: „Datei-Upload ist gerade nicht verfügbar. Sie können Ihre Anfrage trotzdem absenden — schicken Sie uns Bilder gerne nachträglich per E-Mail." Submit bleibt aktiv. |
| Datei zu groß (Bild >10 MB / Video >50 MB / PDF >10 MB) | Inline-Fehler an dieser Datei mit MIME-spezifischer Limit-Angabe; Datei wird **nicht** gesendet; andere Dateien laufen weiter. Zusätzlich Toast (`warning`, 5 s) mit konkreter Limit-Angabe. Submit bleibt aktiv (Datei-Upload optional). |
| Ungültiger Dateityp                                 | Datei wird gar nicht in Liste aufgenommen, Toast (warning, 4 s): „{filename}: Dieser Dateityp wird nicht unterstützt." |
| Mehr als 5 Dateien gewählt                          | Erste 5 werden akzeptiert, Rest verworfen + Toast: „Nur 5 Dateien erlaubt — die ersten 5 wurden übernommen." |
| Upload-Abbruch (Kunde klickt Entfernen während Upload) | XHR/Fetch wird abgebrochen, Datei aus Liste entfernt. Kein Fehler.       |
| Submit mit laufenden Uploads                        | Submit-Button disabled solange mind. eine Datei `uploading` ist. Hinweis im Submit-Bereich: „Bitte warten Sie, bis alle Dateien hochgeladen sind." |
| Netzwerk während Upload abgebrochen                 | Datei-Reihe wechselt auf `error`, Inline-Fehler: „Verbindung verloren. **Erneut versuchen** oder Datei entfernen." Mit Inline-Retry-Button. |

#### IT11-§3.5  Lightbox / Vollbild-Modal (Admin-Galerie) — **OUT-OF-SCOPE FÜR IT11 (IT12-Backlog)**

> **Status (BESTÄTIGT IT11 durch Tom, 2026-05-04):** Lightbox-Komponente und alle in dieser Sektion ursprünglich spezifizierten Patterns (Backdrop, Focus-Trap, Vorherige/Nächste-Navigation, Video-Player-Cleanup) sind **nicht** Teil von IT11 und dürfen **nicht** implementiert werden.
>
> **Stattdessen:** Klick auf Thumbnail in `FileGallery` öffnet Datei in **neuem Tab** via `<a target="_blank" rel="noopener noreferrer">` über alle Datei-Typen hinweg (Bild, Video, PDF). Browser nutzt seinen nativen Viewer/Player. Siehe IT11-§3.3 „Klick-Verhalten".
>
> **Begründung:** Native Browser-Viewer erfüllen den Vorschau-Use-Case in der Admin-Detail-Ansicht ausreichend. Eine eigene Lightbox-Komponente mit Focus-Trap, Pfeiltasten-Navigation und Video-Cleanup wäre zusätzlicher Implementations- und QA-Aufwand ohne klaren Mehrwert für Tom als Single-Admin-User.
>
> **IT12-Backlog:** Falls in einer späteren Iteration eine eingebettete Lightbox gewünscht wird (z.B. für nahtloses Vorherige/Nächste-Browsing innerhalb einer Galerie), wird in IT12 entschieden. Die ehemalige Detail-Spec wurde aus dieser Datei entfernt — bei Wiederaufnahme in IT12 wird sie aus der Git-History (Commit vor IT11-Update) übernommen oder neu erstellt.

#### IT11-§3.6  Datei-Icons (Token-Abhängigkeit)

| Datei-Typ              | Icon (lucide)         | Hintergrund-Token         |
|------------------------|-----------------------|---------------------------|
| `image/*`              | (Vorschau-Thumbnail) — kein Icon | n/a                |
| `video/mp4`, `video/quicktime` | `FileVideo`   | `baerenstark-sand/30`     |
| `application/pdf`      | `FileText`            | `baerenstark-sand/30`     |
| Generisches/unbekanntes Format (Fallback) | `File` | `baerenstark-sand/30` |

Icon-Größe in Thumbnail-Card: 32 px Mobile, 40 px Desktop. Icon-Farbe: `baerenstark-bark/70`.

### IT11-§4  Profil-Vorausfüllung (US-IT11-05)

#### IT11-§4.1  Datenfluss

```
Page-Mount (BookingForm im /buchen oder im Modal)
        │
        ▼
useCustomerSession() → status: 'authenticated' | 'guest' | 'loading'
        │
        ├── guest      ─► Form leer rendern, kein Banner.
        ├── loading    ─► Form-Skeleton oder Form leer + Spinner-Hinweis-Banner.
        └── authenticated
                │
                ▼
        GET /api/customer/me
                │
                ├── 200 mit Profil-Daten ─► defaultValues merge in form.reset()
                │                            ├── alle Felder gesetzt → State `prefilled-complete`
                │                            └── Adresse fehlt        → State `prefilled-partial`
                ├── 401 (Session abgelaufen) ─► Form leer rendern + stiller Reload
                └── 5xx                       ─► Form leer rendern + Banner (info, dismissible):
                                                 „Wir konnten Ihre Profildaten gerade nicht laden.
                                                  Sie können das Formular trotzdem ausfüllen."
```

#### IT11-§4.2  Visuelles Feedback bei vorausgefüllten Feldern

> **Ergänzung zu IT10 §6.10:** IT10 hatte einen einmaligen Banner oben gespezt (kein Per-Feld-Marker). IT11 verfeinert: zusätzlich zum Banner bekommen vorausgefüllte Felder ein **dezentes Per-Feld-Hinweis-Element** („PrefillBadge", siehe Component-Library), das bei Änderung verschwindet.

**Drei Sub-States (verbindlich, IT11):**

| State                   | Trigger                                          | Visual                                                                                                              |
|-------------------------|--------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| `prefilled-complete`    | Profil hat alle Pflicht-Adressfelder              | Banner oben (siehe IT10 §6.10) **plus** `PrefillBadge` rechts neben jedem vorausgefüllten Feld-Label.               |
| `prefilled-partial`     | Profil ohne Adresse                               | Banner oben (Info-Tone): „Wir haben Ihre Kontaktdaten vorausgefüllt. Bitte ergänzen Sie noch die Adresse für diese Anfrage." `PrefillBadge` an Name/Email/Telefon. Kein Badge an leeren Adressfeldern. **Sekundär-Hinweis unter Adresse-Section:** „Tipp: Hinterlegen Sie Ihre Adresse im **[Profil](/konto)**, dann ist sie beim nächsten Mal vorausgefüllt." |
| `prefilled-empty`       | Gast / nicht eingeloggt                            | Kein Banner, keine Badges. Form leer.                                                                                |
| `loading-prefill`       | Session ok, `GET /api/customer/me` pending        | Form-Felder mit Subtle-Skeleton (animiertes Background-Gradient) für 200–500 ms. Wenn länger als 800 ms: Inline-Hinweis „Profil wird geladen…". |
| `prefill-error`         | `GET /api/customer/me` 5xx                        | Form leer + Info-Banner oben: „Wir konnten Ihre Profildaten gerade nicht laden. Sie können das Formular trotzdem ausfüllen." (dismissible) |

#### IT11-§4.3  `PrefillBadge` Visual

```
┌──────────────────────────────┐
│ Name *  [≪ aus Profil ≫]     │   ← Badge rechts neben Label
│ [Anna Schmidt              ] │
└──────────────────────────────┘
```

**Visual:**

- Klein, inline, `text-xs font-medium text-baerenstark-bark/60`.
- BG `baerenstark-sand/40`, Border-Radius `radius-full` (Pill).
- Padding `px-2 py-0.5`.
- Mit Icon links: `User` (lucide, 12 px, `aria-hidden`).
- Hover: Tooltip „Aus Ihrem Profil übernommen — Sie können den Wert für diese Anfrage anpassen."

**Verhalten bei Field-Change:**

- Sobald der Kunde den Wert ändert (`onChange` mit `dirty: true`), wird die Badge ausgeblendet (Opacity-Fade 150 ms).
- Bei Reset auf Original-Wert kommt die Badge zurück.
- **Keine** Schreib-Aktion auf Profil — Änderung lebt nur im Form-State, das Profil bleibt unverändert (Akzeptanzkriterium US-IT11-05).

**A11y:**

- `<span role="note" aria-label="Aus Ihrem Profil übernommen">≪ aus Profil ≫</span>`
- Tooltip-Text via `aria-describedby` zugänglich, fokussierbar nicht (rein visuell).

#### IT11-§4.4  Banner-Microcopy IT11

| State                   | Banner-Text                                                                                                  |
|-------------------------|--------------------------------------------------------------------------------------------------------------|
| `prefilled-complete`    | „Wir haben Ihre Daten aus Ihrem Profil übernommen. Sie können alle Werte für diese Anfrage anpassen — Ihr Profil bleibt unverändert." (dismissible, info-tone) |
| `prefilled-partial`     | „Wir haben Ihre Kontaktdaten aus dem Profil übernommen. Bitte ergänzen Sie noch die Adresse für diese Anfrage. **[Adresse jetzt im Profil hinterlegen →](/konto)**" |
| `prefill-error`         | „Wir konnten Ihre Profildaten gerade nicht laden. Sie können das Formular trotzdem ausfüllen."                |

### IT11-§5  Cross-Cutting State-Tabellen

#### IT11-§5.1  Startseite (`/`)

| State              | Trigger                       | Sichtbar                                                              |
|--------------------|-------------------------------|-----------------------------------------------------------------------|
| `idle`             | Page-Mount                    | Hero (CTA), ServiceGrid, Header-CTA. **Kein** Slot-Picker.            |
| `modal-open`       | CTA-Klick                     | QuickBookingModal überlagert; Body-Scroll gesperrt.                   |

#### IT11-§5.2  `/buchen` (Fallback-Page)

| State              | Trigger                       | Sichtbar                                                              |
|--------------------|-------------------------------|-----------------------------------------------------------------------|
| `loading-prefill`  | Page-Mount, Profil pending    | BookingForm-Skeleton + Kalender-Skeleton                              |
| `idle-guest`       | Form bereit, kein Login       | BookingForm leer, Kalender ready                                      |
| `idle-prefilled`   | Form bereit, Profil geladen   | BookingForm vorausgefüllt + Banner + PrefillBadges                    |
| `submitting`       | Submit-Klick                  | Form disabled, Submit-Button mit Spinner                              |
| `error-validation` | 4xx                            | Banner + Inline-Fehler                                                |
| `error-slot-taken` | 409                            | Banner + Submit-Label „Anderen Slot wählen"                            |
| `error-server`     | 5xx                            | Toast + Banner unter Submit                                           |
| `success-redirect` | 201                            | Auto-Redirect → `/buchung/bestaetigung/[id]`                          |

#### IT11-§5.3  `/buchung/bestaetigung/[bookingId]` (NEU IT11)

Siehe IT11-§2.2 oben.

#### IT11-§5.4  `/admin/bookings/[id]` — neue Section „Anhänge"

| State                  | Trigger                                                  | Sichtbar                                                              |
|------------------------|----------------------------------------------------------|-----------------------------------------------------------------------|
| `loading`              | Detail-Page-Mount, Booking-Daten pending                  | Skeleton: 3 Thumbnail-Placeholder                                      |
| `populated`            | Booking hat Anhänge                                       | Thumbnail-Grid                                                        |
| `empty-no-attachments` | Booking hat keine Anhänge                                  | Inline-Hinweis „Keine Dateien hochgeladen."                            |
| `error-fetch`          | Datei-URL liefert 404/403                                  | Thumbnail mit Overlay „⚠️ Datei nicht verfügbar"                       |

#### IT11-§5.5  `QuickBookingModal` — Erfolgs-Pfad-Diff zu IT10

| Aspekt                          | IT10 Verhalten                                | IT11 Verhalten                                                |
|---------------------------------|-----------------------------------------------|---------------------------------------------------------------|
| Submit 201                      | Modal schließt + Toast + Slot belegt markiert + Inline-Confirmation-Block oberhalb Kalender, **kein** Auto-Redirect. | Modal schließt + Toast + **Auto-Redirect** zu `/buchung/bestaetigung/[id]` nach 250 ms. Toast bleibt auf Bestätigungs-Page sichtbar. |
| Toast-Microcopy                 | „Anfrage gesendet. Wir melden uns innerhalb von 24 Stunden." | „Anfrage erfolgreich gesendet! Tom meldet sich in Kürze bei Ihnen. Telefonisch erreichbar: **0157 74787512**." (Telefonnummer als `tel:`-Link) |
| Inline-Confirmation oberhalb Kalender | sichtbar, Link „Zur Bestätigungs-Seite →" | entfällt, weil Auto-Redirect erfolgt.                          |
| Slot-belegt-Markierung im Kalender | direkt nach Submit         | erfolgt **vor** Redirect (im Page-Cleanup), so dass Bookmarker zur Startseite den Slot belegt sehen. |

#### IT11-§5.6  Edge-Case: Profil-Vorausfüllung beim Modal-Edit-Schließen-Wiederöffnen (NEU IT11, Major-07)

> **Verbindliches Verhalten (BESTÄTIGT IT11 durch Tom):** Wenn ein eingeloggter Kunde das `QuickBookingModal` öffnet, ein vorausgefülltes Feld editiert (z.B. Telefon „0151 …" → „0152 …"), das Modal **ohne Submit** schließt (Escape, X-Button, Backdrop-Klick, Abbrechen-Button) und es danach **erneut öffnet**, gilt:

| Verhalten                                          | Spezifikation                                                                                                                                          |
|---------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Modal-State-Reset beim Schließen**              | Der `BookingDialogProvider` ruft beim Modal-Close `reset()` auf. Lokaler `react-hook-form`-State wird verworfen.                                       |
| **Profil-Werte beim Wieder-Öffnen**               | `useCustomerSession()` + `GET /api/customer/me` liefern beim Re-Mount erneut die aktuellen Profil-Werte. `defaultValues` werden via `form.reset()` neu gesetzt. Alle vorausgefüllten Felder zeigen wieder die **Profil-Werte**, **nicht** die zwischenzeitlichen User-Edits. |
| **User-Edits gehen verloren**                     | Edits ohne Submit werden **nicht** persistiert — weder im Form-State noch im Profil. Konsistent mit US-IT11-05 AC „Profildaten werden nicht überschrieben". |
| **Microcopy / Hinweis im Modal (optional IT11)**  | Kein expliziter Hinweis im Modal nötig — das Verhalten matched die Standard-User-Erwartung („Modal-Schließen verwirft Eingaben"). Falls Tom in QA Drift bemerkt: optional Hint-Text unter dem Submit-Button: „Änderungen werden mit dem Absenden gespeichert." (IT11-Backlog für Iteration nach QA). |
| **Ausnahme: Submit-Erfolg-Pfad**                  | Bei erfolgreichem Submit (201) löst der `BookingDialogProvider` ebenfalls `reset()` aus, **nach** dem Auto-Redirect zur Bestätigungs-Page. Damit ist der State sauber, falls der Kunde via Browser-Back zurück zum Modal gelangt. |

**Warum dieses Verhalten?**

- Vermeidet kognitives Mismatch: „Was ich eingegeben habe, sehe ich noch" wäre erwartet, wenn der Kunde Modal-Submit erwartet hätte. Modal-Schließen ohne Submit ist aber semantisch „Abbrechen", also „Zustand verwerfen".
- Verhindert Konflikt zwischen Profil-Werten und Stale-Form-State, falls der Kunde das Profil zwischenzeitlich in einem anderen Tab geändert hat.
- Vereinfacht Implementation drastisch — keine Persistenz-Layer für Modal-State nötig.

**Bewusster Trade-off:** User, der versehentlich Modal schließt und dann wieder öffnet, muss seine Edits erneut machen. Akzeptabel, weil (a) die Edit-Felder selten sind (Telefon/Adresse-Override), (b) der Submit-Flow im Modal wenige Sekunden dauert, (c) keine validen Use-Cases für „Modal kurz wegklicken um was nachzuschauen, dann zurück" identifiziert wurden.

**Implementations-Hinweis:** `BookingDialogProvider.reset()` muss sowohl bei Modal-Close (Escape/X/Backdrop/Abbrechen) als auch nach Submit-Erfolg aufgerufen werden. Engineer wirelt dies in die `useBookingModal()`-Hook-Implementation ein.

### IT11-§6  Storno-Flow (US-IT11-06, NEU IT11)

#### IT11-§6.1  Zwei Eingangs-Pfade

```
                ┌──────────────────────────────────────────┐
                │ Eingeloggter Kunde         |    Gast     │
                │ (Session aktiv)            |             │
                └──────────────────────────────────────────┘
                          │                        │
                          ▼                        ▼
              /konto (Anfragen-Liste)       Email mit signed URL
                          │                        │
                  Klick „Stornieren"               │
                  am BookingListItem               │
                          │                        │
                          ▼                        ▼
          ┌───────────────────────┐    /buchung/[id]/stornieren
          │  ConfirmCancelDialog  │    ?token=…  (eigene Page)
          │  (Modal)              │           │
          └───────────────────────┘           │
                          │                   │
                  Klick „Ja, stornieren"      │
                          │             Klick „Stornieren bestätigen"
                          │                   │
                          ▼                   ▼
                POST /api/bookings/{id}/cancel  (mit oder ohne token)
                          │                   │
            ┌─────────────┼─────────────┐     │
            ▼             ▼             ▼     ▼
         200 OK         409          Error  …
         Storniert    bereits          5xx
                      storniert
```

#### IT11-§6.2  Eingeloggter Kunde — Stornieren über `/konto`

**Trigger:** „Stornieren"-Button auf jedem `BookingListItem` mit Status `Offen` (`PENDING`) oder `Bestätigt` (`CONFIRMED`). Bei Status `Storniert` (`CANCELLED`), `Abgelehnt` (`REJECTED`), `Erledigt` (`COMPLETED`): Button **nicht** sichtbar.

**Layout im `BookingListItem` (Desktop, Diff zu IT10):**

```
┌────────────────────────────────────────────────────────┐
│ Reinigung · Mo, 12.05.2026 · 09:00      [● Offen]      │
│ Musterstraße 12, 64283 Darmstadt                       │
│ #BK-2026-0042                                          │
│                                                        │
│ [Details ansehen]                  [Stornieren]        │  ← Sekundär-Buttons,
│                                    ↑ NEU IT11           │     rechts ausgerichtet
└────────────────────────────────────────────────────────┘
```

**Stornieren-Button-Spec:**

- Variant: **sekundär** (kein Primary-Style — keine destruktive Farbe auf Listen-Ebene, der Confirm-Dialog erst ist destruktiv).
- Label: „Stornieren".
- Icon: `XCircle` (lucide, 16 px, links).
- `aria-label="Anfrage {service} am {datum} stornieren"` (kanonische Variante IT11; konsistent mit `BookingListItem`-Spec). Beispiel: `aria-label="Anfrage Reinigung am 12.05.2026 stornieren"`. Engineer formatiert das Datum mit `de-DE`-Locale, kurze Form (`TT.MM.JJJJ`), keine Uhrzeit. Falls Service-Name fehlt (Edge-Case): Fallback auf `aria-label="Anfrage am {datum} stornieren"`.
- `onClick`: öffnet `ConfirmCancelDialog`.

**ConfirmCancelDialog Layout:**

```
┌──────────────────────────────────────────────┐
│  Anfrage stornieren?                    [✕]  │  ← Heading + Close
├──────────────────────────────────────────────┤
│                                              │
│  Möchten Sie diesen Auftrag                  │
│  wirklich stornieren?                        │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Reinigung                              │  │  ← Buchungs-Detail
│  │ Mo, 12.05.2026 · 09:00 – 11:00         │  │     (Card mit Rahmen)
│  │ #BK-2026-0042                          │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Diese Aktion kann nicht rückgängig          │  ← Hinweis
│  gemacht werden. Tom wird per E-Mail         │
│  über die Stornierung informiert.            │
│                                              │
├──────────────────────────────────────────────┤
│        [Abbrechen]      [Ja, stornieren]     │  ← Footer-Actions
└──────────────────────────────────────────────┘
```

**Footer-Actions:**

- **Abbrechen** (sekundär, links / mobile zuerst): schließt Dialog ohne Aktion.
- **Ja, stornieren** (destruktiv, rot, rechts / mobile danach): triggert API-Call.

**State-Tabelle:**

| State              | Trigger                                    | Visual                                                                        |
|--------------------|--------------------------------------------|-------------------------------------------------------------------------------|
| `idle`             | Dialog geöffnet                            | Beide Buttons aktiv, Detail-Card sichtbar.                                    |
| `submitting`       | Klick „Ja, stornieren"                     | Destruktiv-Button: `disabled`, Spinner-Icon links, Label „Wird storniert …". Abbrechen-Button: `disabled`. Escape und Backdrop-Klick: **geblockt** (konsistent mit Modal-Submit-Block IT11-§2.4). Live-Region: „Stornierung wird verarbeitet …". |
| `success`          | API 200                                    | Dialog schließt, Toast (`success`, 4 s): „**Auftrag storniert.** Sie erhalten in Kürze eine Bestätigung per E-Mail." Status-Badge im `BookingListItem` wechselt sofort auf „Storniert", Stornieren-Button verschwindet. |
| `error-conflict`   | API 409 (bereits storniert)                | Dialog schließt, Toast (`warning`, 5 s): „Diese Anfrage ist bereits storniert." `BookingListItem` wird neu gefetcht. |
| `error-server`     | API 5xx / Netzwerk                          | Dialog bleibt offen, Banner oben im Dialog: „Stornierung fehlgeschlagen. Bitte versuchen Sie es erneut oder rufen Sie uns an: **0157 74787512**." Beide Buttons wieder aktiv. |

**A11y:**

- Dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="cancel-dialog-title"`, `aria-describedby="cancel-dialog-body"`.
- Initialer Fokus: **Abbrechen-Button** (sicherer Default, nicht der destruktive Button — siehe IT10 §1.5 Confirm-Dialog-Pattern).
- Tab-Reihenfolge: Close-X → Abbrechen → Ja, stornieren.
- Escape: schließt Dialog, aber **nur im `idle`-State** — während `submitting` geblockt.
- Reduce-Motion: kein Backdrop-Fade, kein Scale.

**Microcopy (verbindlich):**

| Element                          | Text                                                                                  |
|----------------------------------|---------------------------------------------------------------------------------------|
| Dialog-Title                     | „Anfrage stornieren?"                                                                  |
| Dialog-Frage                     | „Möchten Sie diesen Auftrag wirklich stornieren?"                                      |
| Detail-Card-Inhalt               | Service · Datum · Uhrzeit · Buchungsnummer (mehrzeilig, ohne weitere Action)           |
| Hinweis (Body, kursiv)           | „Diese Aktion kann nicht rückgängig gemacht werden. Tom wird per E-Mail über die Stornierung informiert." |
| Sekundär-Button                  | „Abbrechen"                                                                            |
| Destruktiv-Button (idle)         | „Ja, stornieren"                                                                       |
| Destruktiv-Button (submitting)   | „Wird storniert …" (mit Spinner)                                                      |
| Erfolgs-Toast                    | „Auftrag storniert. Sie erhalten in Kürze eine Bestätigung per E-Mail."                |
| Konflikt-Toast (409)             | „Diese Anfrage ist bereits storniert."                                                 |
| Fehler-Banner im Dialog          | „Stornierung fehlgeschlagen. Bitte versuchen Sie es erneut oder rufen Sie uns an: **0157 74787512**." |
| Live-Region (submitting)         | „Stornierung wird verarbeitet, bitte warten."                                          |

#### IT11-§6.3  Gast — Stornieren über signierten Link (`/buchung/[id]/stornieren?token=…`)

**Trigger:** Klick auf „Anfrage stornieren"-Link in der Bestätigungs-E-Mail (siehe US-IT11-06 AC#6) **oder** Klick auf den Storno-CTA in der Bestätigungs-Page (siehe IT11-§2.2 Layout-Update). Page öffnet als eigene Route — **kein Modal**.

**Layout (Mobile, 360 px):**

```
┌────────────────────────────────────────────┐
│  ← Zurück zur Startseite                   │  ← Sekundär-Link, oben links
├────────────────────────────────────────────┤
│              [Logo, 64×64]                 │
│                                            │
│         Anfrage stornieren                 │  ← H1, font-serif, font-bold
│                                            │
│  Möchten Sie diese Anfrage stornieren?     │  ← Lead-Text
├────────────────────────────────────────────┤
│  Service                                   │
│  Reinigung · 2 Stunden                     │
│                                            │
│  Termin                                    │
│  Mo, 12.05.2026 · 09:00 – 11:00            │
│                                            │
│  Adresse                                   │
│  Musterstraße 12, 64283 Darmstadt          │
│                                            │
│  Buchungsnummer                            │
│  #BK-2026-0042                             │
├────────────────────────────────────────────┤
│  Diese Aktion kann nicht rückgängig        │  ← Hinweis (Subtext, kursiv)
│  gemacht werden. Tom wird per E-Mail       │
│  benachrichtigt.                           │
├────────────────────────────────────────────┤
│  [Stornierung bestätigen]  (destruktiv,    │  ← Primary-Action
│   rot, full-width)                         │
│                                            │
│  [Abbrechen → Zur Startseite]   (Link)     │  ← Sekundär-Link
└────────────────────────────────────────────┘
```

**Layout (Desktop, ≥1024 px):**

- Karten-Layout, max-width `min(640px, 90vw)`, vertikal zentriert mit `mt-12`.
- Detail-Daten 2-spaltig (Label links, Wert rechts).
- Buttons nebeneinander, rechts: Abbrechen (sekundär) → Stornierung bestätigen (destruktiv).

**State-Tabelle:**

| State                  | Trigger                                                            | Sichtbar                                                                    |
|------------------------|--------------------------------------------------------------------|-----------------------------------------------------------------------------|
| `loading`              | Page-Mount, `GET /api/bookings/{id}/public-summary?token=…` pending  | Skeleton: Logo + Header + 4 Detail-Zeilen + 2 Button-Skeletons. (Endpoint-Bestätigung Tom IT11: kein eigener `cancel-preview` — `public-summary` wird wiederverwendet.) |
| `token-valid`          | API 200, Buchung im Status `Offen` / `Bestätigt`                   | Vollständiges Layout (siehe oben), Confirm-Button aktiv.                    |
| `token-expired`        | API 410 oder 401                                                    | `<TokenExpiredState>`-Empty-State (siehe Component-Library).                |
| `token-invalid`        | API 404 — Token gehört zu keiner Buchung                            | gleicher Empty-State wie `token-expired`, semantisch konsistent für Kunde. |
| `already-cancelled`    | API 200 mit Buchungs-Status `CANCELLED`                             | Friendly-State: „**Diese Buchung ist bereits storniert.**" + Link „Zur Startseite". Kein Confirm-Button. |
| `submitting`           | Klick „Stornierung bestätigen"                                      | Confirm-Button: `disabled`, Spinner, Label „Wird storniert …". Abbrechen-Link: `disabled` (`pointer-events: none`, `aria-disabled="true"`). Live-Region: „Stornierung wird verarbeitet, bitte warten." |
| `success`              | API 200 (POST cancel)                                               | Page wechselt auf Erfolgs-State (siehe IT11-§6.4).                          |
| `error-conflict` (409) | Buchung wurde zwischenzeitlich storniert                            | Banner oben: „Diese Buchung wurde inzwischen bereits storniert." + Link „Zur Startseite". |
| **`frist-abgelaufen` (NEU IT11, Critical-04)** | Preview lädt erfolgreich (200), aber Submit liefert 409 wegen <24h-Vorlauf zum Termin (subcode `BOOKING_NOT_CANCELLABLE_LATE` o.ä.). | Banner oben (Variante `error`/`warning`): **„Stornierung nicht mehr möglich"** + Body „Dieser Termin liegt weniger als 24 Stunden in der Zukunft und kann online nicht mehr storniert werden. Bitte rufen Sie uns an: **[0157 74787512](tel:+4915774787512)**." Confirm-Button **disabled** (`opacity-40`, `cursor-not-allowed`, `aria-disabled="true"`). Abbrechen-Link aktiv. Tel-Link ist primärer Recovery-Pfad und touch-target-konform (≥ 44 × 44 px). |
| `error-server` (5xx)   | Server-Fehler                                                       | Banner oben: „Wir konnten die Stornierung gerade nicht durchführen. Bitte versuchen Sie es erneut oder rufen Sie uns an: **0157 74787512**." + Retry-Button neben Confirm. |

**Microcopy (verbindlich):**

| Element                          | Text                                                                              |
|----------------------------------|-----------------------------------------------------------------------------------|
| H1                               | „Anfrage stornieren"                                                              |
| Lead-Text                        | „Möchten Sie diese Anfrage stornieren?"                                           |
| Section-Headers                  | „Service", „Termin", „Adresse", „Buchungsnummer"                                  |
| Hinweis (Body, kursiv)           | „Diese Aktion kann nicht rückgängig gemacht werden. Tom wird per E-Mail benachrichtigt." |
| Confirm-Button (idle)            | „Stornierung bestätigen"                                                          |
| Confirm-Button (submitting)      | „Wird storniert …"                                                                |
| Abbrechen-Link                   | „Abbrechen → Zur Startseite" → `/`                                                |
| Already-cancelled-Headline       | „Diese Buchung ist bereits storniert"                                             |
| Already-cancelled-Body           | „Falls das ein Versehen war, rufen Sie uns gerne an: **0157 74787512**."          |
| Already-cancelled-Link           | „Zur Startseite"                                                                  |
| Token-expired (siehe `<TokenExpiredState>`) | „Dieser Link ist nicht mehr gültig. Bitte rufen Sie uns an: **0157 74787512**." |
| **Frist-abgelaufen-Banner-Title (NEU IT11)** | „Stornierung nicht mehr möglich"                                                |
| **Frist-abgelaufen-Banner-Body (NEU IT11)** | „Dieser Termin liegt weniger als 24 Stunden in der Zukunft und kann online nicht mehr storniert werden. Bitte rufen Sie uns an: **0157 74787512**." (Telefonnummer als `tel:`-Link) |

#### IT11-§6.4  Gast — Erfolgs-Page nach Storno

Nach erfolgreichem Submit wird die gleiche Route (`/buchung/[id]/stornieren?token=…`) gerendert, aber im Erfolgs-State. **Kein** zusätzlicher Redirect — Page wechselt In-Place auf:

```
┌────────────────────────────────────────────┐
│              [Logo, 64×64]                 │
│              [✓ Icon, grün, 48×48]         │
│                                            │
│         Ihr Auftrag wurde storniert        │  ← H1
│                                            │
│  Eine Bestätigung wurde an                 │  ← Body
│  anna@example.com gesendet.                │
│                                            │
│  Buchungsnummer: #BK-2026-0042             │  ← Subtext
│                                            │
├────────────────────────────────────────────┤
│  [Zur Startseite]   (Primary, full-width)  │
└────────────────────────────────────────────┘
```

**Microcopy:**

| Element        | Text                                                                                |
|----------------|-------------------------------------------------------------------------------------|
| H1             | „Ihr Auftrag wurde storniert"                                                       |
| Body           | „Eine Bestätigung wurde an **{email-masked}** gesendet."                            |
| Subtext        | „Buchungsnummer: #{bookingId}"                                                      |
| CTA            | „Zur Startseite" → `/`                                                              |

**E-Mail-Maskierung:** Erste 2 Zeichen + `***` + `@domain.tld` (z.B. `an***@example.com`). Falls API maskiert liefert, direkt übernehmen.

**A11y:**

- Fokus wandert beim Page-Mount auf H1.
- `role="status"` für den Container (Erfolgs-Bestätigung — Live-Region für Screen-Reader-Announcement).
- Reduce-Motion: kein Icon-Pulse, kein Confetti.

#### IT11-§6.5  Admin — Storno-Anzeige

**Im Admin-Booking-Listing (`/admin/bookings`):**

- Status-Badge „Storniert" — gleicher Token wie für andere inaktive/abgesagte Status: `status-cancelled-bg`, `status-cancelled-fg`, `status-cancelled-border`.
- Falls ein eigener Token noch nicht existiert (IT10 hatte nur `pending`/`confirmed`/`completed`/`rejected`), siehe Design-System-Erweiterung IT11-D11 unten.

**Im Admin-Booking-Detail-Modal:**

- **Cancellation-Info** als eigene Sektion direkt unter dem Status-Header, nur sichtbar bei Status `CANCELLED`:

```
┌──────────────────────────────────────────────┐
│ Status: [● Storniert]                         │
│                                               │
│ ⓘ  Storniert vom Kunden am 03.05.2026         │  ← NEU IT11
└──────────────────────────────────────────────┘
```

**Microcopy (BESTÄTIGT IT11 durch Tom — keine Quelle-Differenzierung zwischen eingeloggtem Customer und Gast-Storno):**

| Cancelled-By (Backend) | Text                                                                                |
|------------------------|-------------------------------------------------------------------------------------|
| `CUSTOMER`             | „Storniert vom Kunden am {datum}" — gilt sowohl für eingeloggte Kunden als auch für Gast-Storno via signiertem Link. Backend speichert in beiden Fällen `cancelledBy: 'CUSTOMER'`. |
| `ADMIN`                | „Storniert vom Admin am {datum}" — wird in IT11 noch nicht aus der UI ausgelöst (Admin-seitiges Storno ist Backlog), aber Backend-Enum unterstützt es bereits. |
| `SYSTEM`               | „Storniert (System) am {datum}" — Default-Text, falls Backend automatisch storniert (z.B. Cleanup-Jobs). |

> **Hinweis (BESTÄTIGT Tom IT11):** Die UX differenziert **nicht** zwischen „Customer-eingeloggt-Storno" und „Gast-Storno-via-Link". Beide Pfade landen im Backend-Enum als `CUSTOMER`. Aus Toms Sicht: ist nur eine Information „der Kunde hat storniert" — die Source (Login vs. signed link) ist für seinen Workflow irrelevant. Backend-Enum: `cancelledBy: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'` + `cancelledAt: DateTime` (kein `'GUEST_TOKEN'`).
>
> **Detail-Anzeige Datum:** Format „TT.MM.JJJJ" (ohne Uhrzeit) für Konsistenz mit anderen Datums-Anzeigen im Admin-Detail. Falls Tom später Uhrzeit-Detail wünscht: trivial nachträglich erweiterbar.

**A11y:**

- Cancellation-Info-Block: `role="note"` mit `aria-label="Stornierungs-Information"`.
- Icon `Info` (lucide, 16 px, `aria-hidden`).

**State-Tabelle Admin-Booking-Detail (Diff zu IT10):**

| State                | Trigger                                       | Sichtbar                                                                  |
|----------------------|-----------------------------------------------|---------------------------------------------------------------------------|
| `cancelled`          | Booking-Status `CANCELLED`                    | Status-Badge + Cancellation-Info-Block + Aktionen-Sektion (Bestätigen/Ablehnen) **ausgeblendet** (terminal-Status). |

#### IT11-§6.6  Storno-Flow — Decision-Tabelle (Inline-Fehler vs. Toast vs. Banner)

| Fehler-Typ                                          | UI-Location                                                                |
|-----------------------------------------------------|----------------------------------------------------------------------------|
| Eingeloggt, 200 OK                                   | Toast (success, 4 s) — siehe IT11-§6.2.                                    |
| Eingeloggt, 409 (bereits storniert)                  | Toast (warning, 5 s) + Refetch der Liste.                                  |
| Eingeloggt, 5xx / Netzwerk                           | **Banner im Dialog** (Dialog bleibt offen, Retry möglich).                 |
| Gast, Token abgelaufen / ungültig                    | `<TokenExpiredState>` Empty-State auf Page.                                |
| Gast, 200 OK                                         | Page wechselt auf Erfolgs-State (kein Toast nötig — Page-Wechsel reicht).  |
| Gast, 409 (bereits storniert)                        | Banner oben auf Page + Friendly-Hinweis.                                   |
| Gast, 5xx                                            | Banner oben auf Page + Retry-Button.                                       |

#### IT11-§6.7  Storno-Edge-Cases

| Case                                                              | Verhalten                                                                            |
|-------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| Buchung wechselt zwischen Dialog-Open und Submit auf `COMPLETED`  | API liefert 409 mit subcode `BOOKING_NOT_CANCELLABLE`. Banner: „Diese Anfrage kann nicht mehr storniert werden, da der Termin abgeschlossen ist." Dialog schließt nach 3 s automatisch. |
| Mehrfach-Klick auf „Ja, stornieren"                                | Button disabled nach erstem Klick — keine Doppel-Submission möglich.                 |
| Browser-Back während `submitting`                                  | Browser-Native Confirm „Möchten Sie diese Seite verlassen?" via `beforeunload`-Listener (nur Gast-Page, nicht Modal). |
| Gast schließt Tab nach Storno-Klick aber vor Server-Response       | Server-Storno läuft trotzdem durch (idempotent via Token). Beim Wieder-Aufruf der URL: `already-cancelled`-State. |
| Eingeloggter Kunde löst Storno aus während Tom in Admin gerade Detail-Modal offen hat | Optimistic UI im Admin nicht implementiert in IT11. Tom muss neu laden — kein Real-Time-Update in IT11. **[NEEDS INPUT — Tom: ist das ok? Vermutlich ja, da geringe Frequenz.]** |

#### IT11-§6.8  Storno — Visualisierung Status-Badge „Storniert"

**Token-Vorschlag (siehe Design-System IT11-D11):**

- Hintergrund: `status-cancelled-bg` → neutrales Hellgrau (`#E8E4DF` über Cream).
- Vordergrund: `status-cancelled-fg` → gedämpftes Dunkelgrau-Braun (`#6B5C4F`).
- Border-Left: `status-cancelled-border` → mittleres Grau (`#A89884`).
- Icon: `XCircle` (lucide, 14 px, links vor Label).

**Begründung:** Storno ist **nicht** ein „Fehler"-Zustand (rot wäre falsch), sondern ein **terminal-aber-neutraler** Status. Gedämpftes Grau-Braun signalisiert „abgeschlossen, nicht mehr aktiv" ohne negative Konnotation. Konsistent mit `REJECTED` (siehe IT10), aber visuell unterscheidbar (Reject hat einen Warnton, Cancel ist neutraler).

> **Wichtig:** Falls IT10 bereits einen Token `status-rejected` definiert hat, der hellgrau-neutral ist, kann derselbe Token wiederverwendet werden — Engineer prüft. Empfehlung dieser Spec: separater Token für klare Semantik.

### IT11-§7  Story-Coverage IT11

| Story        | UX-Deliverable IT11                                                                                                  |
|--------------|----------------------------------------------------------------------------------------------------------------------|
| US-IT11-01   | Keine UI-Änderung. Smoke-Test-UX greift bestehende Toast-Spec aus IT10 §1.1 + IT11-§2.1.                              |
| US-IT11-02   | IT11-§1 (Information-Architecture-Diff, User-Flow, CTA-Inventarliste, Verbot Slot-Picker), `BookingModal` IT10-§5 unverändert; Konsolidierung im Component-Library §`BookingModal` (Anpassungen). |
| US-IT11-03   | IT11-§2 (Toast-Pattern verfeinert, Bestätigungs-Page neu inkl. „30 Tage aufbewahren"-Hinweis-Card und Storno-CTA für Gäste, Inline-vs-Toast-Decision-Tabelle, Loading-States Submit, Modal-Submit-Block bei Escape/Backdrop). Component-Library §`Toast` (verfeinert), §`BookingConfirmation` (verfeinert IT11). |
| US-IT11-04   | IT11-§3 (Limits **10 MB Bilder / 50 MB Videos / 10 MB PDF** bestätigt, kundenseitige Upload-UX inkl. Drag&Drop, Vorschau, Fortschritt; admin-seitige Galerie mit **„neuer Tab"-Vorschau** statt Lightbox (Major-06 — IT11-§3.5 Lightbox in IT12-Backlog verschoben); Edge-Cases; Datei-Icons). Component-Library §`FileUpload` (verfeinert IT11) + §`FileGallery` (NEU). |
| US-IT11-05   | IT11-§4 (Datenfluss, Sub-States `prefilled-complete` / `-partial` / `-empty` / `-loading` / `-error`, `PrefillBadge`, Banner-Microcopy) + **IT11-§5.6 (Edge-Case Modal-Edit-Reopen: State-Reset, Profil-Werte werden frisch geladen, User-Edits ohne Submit gehen verloren — Major-07)**. Component-Library §`PrefillBadge` (NEU). |
| **US-IT11-06** | **IT11-§6 (Storno-Flow für eingeloggte Kunden via ConfirmCancelDialog, Storno-Flow für Gäste via signed-URL-Page mit Token-Valid/Expired/Already-Cancelled/`frist-abgelaufen`-States (Critical-04), Erfolgs-Page Gast, Admin-Anzeige Storniert-Status + Cancellation-Info ohne Quelle-Differenzierung (Major-01), Status-Badge „Storniert", Decision-Tabelle, Edge-Cases). Endpoint: `GET /api/bookings/{id}/public-summary?token=…` (Critical-03 — kein eigener `cancel-preview`). Lightbox out-of-scope (Major-06 / IT12-Backlog). Component-Library §`ConfirmCancelDialog` (NEU), §`CancelOrderPage` (NEU), §`TokenExpiredState` (NEU), §`BookingListItem` (modifiziert), §`BookingConfirmation` (modifiziert). Design-System §IT11-D11 (NEU: `status-cancelled-*` + `button-destructive-*` Tokens).** |

### IT11-§8  Offene UX-Fragen

**Bestätigt durch Tom (Stand 04.05.2026):**

- ✅ **Upload-Limits:** 10 MB pro Bild, 50 MB pro Video, 10 MB pro PDF. Bestätigt.
- ✅ **Bestätigungs-Page-Token:** signed URL, 30 Tage gültig. Bestätigt.
- ✅ **Routing Bestätigungs-Page (Critical-01):** `/buchung/bestaetigung/[bookingId]?token=…` — UX-Variante übernommen. Bestätigt.
- ✅ **Routing Storno-Page (Critical-02):** `/buchung/[id]/stornieren?token=…` — UX-Variante übernommen. Bestätigt.
- ✅ **Storno-Preview-Endpoint (Critical-03):** kein eigener `cancel-preview`-Endpoint — `GET /api/bookings/{id}/public-summary?token=…` wird wiederverwendet. Bestätigt.
- ✅ **`frist-abgelaufen`-State (Critical-04):** Banner „Stornierung nicht mehr möglich — bitte rufen Sie 0157 74787512 an" bei Submit-409. Spezifiziert in IT11-§6.3 State-Tabelle. Bestätigt.
- ✅ **`cancelledBy`-Enum (Major-01):** Tom hat „nicht differenzieren" gewählt. Backend speichert nur `'CUSTOMER' | 'ADMIN' | 'SYSTEM'`. Gast-Storno wird als `'CUSTOMER'` markiert. UI zeigt „Storniert vom Kunden am [Datum]" ohne Quelle-Detail. Bestätigt.
- ✅ **Lightbox im Admin (Major-06):** Tom hat „neuer Tab" gewählt. Lightbox ist out-of-scope für IT11 (IT12-Backlog). FileGallery-Klick öffnet alle Datei-Typen via `<a target="_blank" rel="noopener noreferrer">`. Bestätigt.
- ✅ **Routing `/buchung`:** `/buchung` als kanonischer Pfad. Bestätigt.
- ✅ **Modal-Submit-Escape:** geblockt während Submit (inkl. Backdrop-Klick und X-Button). Bestätigt.
- ✅ **Telefonnummer-Display (Minor-02):** Kanonisch `0157 74787512` (mit non-breaking-space im sichtbaren Text). `tel:`-Link bleibt `tel:+4915774787512`. Bestätigt.
- ✅ **Telefon-Hinweis-Microcopy (Minor-01):** Kanonische Phrase „Telefonisch erreichbar: 0157 74787512". Variante „Bei dringenden Anliegen" wird **nicht** mehr verwendet. Bestätigt.
- ✅ **`aria-label` Stornieren-Button (Minor-05):** Kanonisch `aria-label="Anfrage {service} am {datum} stornieren"`. Bestätigt.
- ✅ **Profil-Vorausfüllung Edit-Reopen (Major-07):** Modal-State wird beim Schließen zurückgesetzt; bei Wiederöffnen werden Profil-Werte frisch geladen. User-Edits gehen ohne Submit verloren — siehe IT11-§5.5. Bestätigt.

**Verbleibende offene Fragen IT11:**

1. **[NEEDS INPUT — Tom — Gast-Flow nach Submit]** Bestätigungs-Page zeigt für Gäste den CTA „Jetzt Konto erstellen, um den Status zu verfolgen". Soll der Registrierungs-Flow die Booking automatisch dem neuen Account zuordnen? (Backlog-Verweis aus IT10 §6.1: Backfill war IT11-Backlog.)
2. **[NEEDS INPUT — Tom — Profil-Sync nach Edit]** Wenn der Kunde im Form ein vorausgefülltes Feld ändert (z.B. Telefon), soll am Ende des Submit-Flows ein dezenter Toast erscheinen „Möchten Sie diese Änderung auch in Ihr Profil übernehmen?"? IT11 spec: **nein** (US-IT11-05 verlangt „Profildaten werden nicht überschrieben"). Sync wäre Backlog — bestätigen.
3. **[NEEDS INPUT — Tom — Storno-Real-Time im Admin]** Wenn ein eingeloggter Kunde stornieren während Tom in Admin gerade das Detail-Modal offen hat: Tom muss neu laden — kein Real-Time-Update in IT11. Geringe Frequenz, vermutlich akzeptabel — bestätigen.
4. **[NEEDS INPUT — QA — Status-Badge-Token-Wiederverwendung]** Falls IT10 bereits `status-rejected` als hellgrau-neutral definiert hat, könnte derselbe Token für `status-cancelled` wiederverwendet werden. Empfehlung dieser Spec: separater Token für Semantik. Engineer prüft, ob Tom die visuelle Differenzierung will.
