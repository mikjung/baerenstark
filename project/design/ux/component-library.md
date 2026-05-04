# Component-Library — Iteration 11 (Bärenstark Hausservice)

> Sprache: **deutsch**, Sie-Form. Stack: Next.js 14 + Tailwind + shadcn/ui. Brand-Tokens `baerenstark-*`.
> Diese Datei **ergänzt** `component-library-iteration-10.md`. Alle bereits dokumentierten Komponenten (`QuickBookingModal`, `CustomerBookingsList`, `BookingStatusBadge`, `PasswordResetForm`, `Toast` (Basis), `EmptyState`, `ErrorState`, `PaginationControls`) bleiben in Kraft. Diese Datei dokumentiert die IT11-spezifischen Anpassungen und neuen Komponenten.
> RSC-Hinweis: alle interaktiven Komponenten sind `"use client"` (markiert pro Komponente).

---

## Komponenten-Übersicht IT11

| Komponente              | Status IT11   | Datei (Vorschlag)                                       |
|-------------------------|---------------|---------------------------------------------------------|
| `Toast` + `Toaster`     | **MODIFIZIERT** (Microcopy + tel-Link) | `src/components/ui/Toast.tsx` + `Toaster.tsx`           |
| `BookingConfirmation`   | **MODIFIZIERT IT11-Update** (30-Tage-Hinweis-Card + Storno-CTA Gast) | `src/components/booking/BookingConfirmation.tsx`        |
| `FileUpload`            | **MODIFIZIERT IT11-Update** (Limits 10/50 MB, Drop-Zone-Microcopy) | `src/components/booking/FileUpload.tsx`        |
| `FileGallery`           | **NEU**       | `src/components/admin/FileGallery.tsx`                  |
| `BookingModal` (alias QuickBookingModal) | **MODIFIZIERT** (CTA-Inventarliste + Erfolgs-Pfad + Submit-Block) | `src/components/booking/QuickBookingModal.tsx` |
| `PrefillBadge`          | **NEU**       | `src/components/booking/PrefillBadge.tsx`               |
| `LightboxModal`         | **OUT-OF-SCOPE IT11 (IT12-Backlog)** — siehe §5 | `src/components/admin/LightboxModal.tsx` (nicht implementieren in IT11) |
| `ConfirmCancelDialog`   | **NEU IT11-Update**       | `src/components/booking/ConfirmCancelDialog.tsx`        |
| `CancelOrderPage`       | **NEU IT11-Update**       | `src/app/buchung/[id]/stornieren/page.tsx` (Layout-Spec)|
| `TokenExpiredState`     | **NEU IT11-Update**       | `src/components/ui/TokenExpiredState.tsx`               |
| `BookingListItem`       | **MODIFIZIERT IT11-Update** (Stornieren-Button konditional) | `src/components/customer/BookingListItem.tsx` |

---

## 1. `Toast` + `Toaster` (MODIFIZIERT IT11, Client)

**Datei:** `src/components/ui/Toast.tsx` + `src/components/ui/Toaster.tsx`

### Zweck (unverändert IT10 §5)

Kurzlebige Statusmeldungen außerhalb des Form-Kontexts. IT11 verfeinert Microcopy für den Buchungs-Flow und macht Telefonnummer als `tel:`-Link verbindlich.

### Variants (unverändert)

| Variant     | Tone-Token            | Icon              | Default-Duration IT11 |
|-------------|-----------------------|-------------------|------------------------|
| `success`   | `feedback-success`    | `CheckCircle2`    | **5 s** (IT10 war 4 s; IT11 verlängert für Submit-Erfolg, weil Telefonnummer enthalten) |
| `info`      | `feedback-info`       | `Info`            | 5 s                    |
| `warning`   | `feedback-warning`    | `AlertTriangle`   | 6 s                    |
| `error`     | `feedback-error`      | `XCircle`         | 6 s                    |

### States (unverändert IT10)

`entering` / `visible` / `paused` (Hover/Focus) / `exiting`.

### Props (geändert: `message` akzeptiert ReactNode)

| Prop       | Typ                                       | Default       | Beschreibung                                                                 |
|------------|-------------------------------------------|---------------|------------------------------------------------------------------------------|
| `id`       | `string`                                  | auto          | Eindeutig pro Toast.                                                         |
| `variant`  | `'success' \| 'info' \| 'warning' \| 'error'` | `'info'`  | Farbe + Icon.                                                                |
| `title`    | `string`                                  | —             | Optional, fett.                                                              |
| `message`  | `ReactNode` (**geändert IT11**, vorher nur `string`) | —    | Pflicht. Erlaubt jetzt eingebettete `<a href="tel:">`-Links.                  |
| `duration` | `number \| null`                          | siehe Variant | `null` = persistent.                                                         |
| `onDismiss`| `(id) => void`                            | —             |                                                                              |
| `action`   | `{ label: string; onClick: () => void }`  | —             | Optional Sekundär-CTA.                                                       |

### Behaviour (verfeinert IT11)

- Position: Mobile unten zentriert, Desktop oben rechts (unverändert).
- Stack: max. 3, neuere ersetzen älteste bei Überlauf (unverändert).
- Hover/Focus pausiert Auto-Dismiss-Timer (unverändert).
- **NEU IT11:** Eingebettete `<a href="tel:...">`-Links sind innerhalb des Toasts fokussierbar. Tab-Reihenfolge: Toast-Body-Link → Action-Button → Schließen-Button.
- Klick auf eingebetteten Telefon-Link löst nativen Tel-Handler aus (Mobile: Anruf-App; Desktop: System-Default). Toast bleibt offen, Timer pausiert während Link-Fokus.

### Accessibility

- `role="status"` für `success`/`info`, `role="alert"` für `warning`/`error`.
- `aria-live="polite"` (status) / `aria-live="assertive"` (alert).
- Reduce-Motion: nur Opacity-Fade.
- Eingebettete Links bekommen sichtbare Fokus-Ringe (Token: `--focus-ring`).

### Microcopy IT11 (verbindlich für Booking-Flow)

```ts
// Erfolg nach Booking-Submit (US-IT11-03)
// Phone-Display: '0157 74787512' (mit non-breaking-space; Tel-Link bleibt kompakt im E.164-Format).
toast.success(
  <>
    Anfrage erfolgreich gesendet! Tom meldet sich in Kürze bei Ihnen.
    Telefonisch erreichbar:{' '}
    <a href="tel:+4915774787512" className="font-semibold underline">
      0157&nbsp;74787512
    </a>
  </>,
  { duration: 5000 }
);

// Fehler 5xx (US-IT11-03)
toast.error(
  <>
    Wir konnten Ihre Anfrage nicht speichern. Bitte versuchen Sie es erneut
    oder rufen Sie uns an:{' '}
    <a href="tel:+4915774787512" className="font-semibold underline">
      0157&nbsp;74787512
    </a>
  </>,
  { duration: 6000 }
);

// Slot belegt (Race-Condition)
toast.warning('Dieser Slot ist inzwischen vergeben. Bitte wählen Sie einen anderen Termin.');

// Profil-Vorausfüllen-Info (selten, nur bei Bedarf)
toast.info('Wir haben Ihre Daten aus Ihrem Profil übernommen.');
```

### Keyboard

| Key       | Verhalten                                               |
|-----------|---------------------------------------------------------|
| Tab       | Fokus auf eingebetteten Link → Action-Button → X        |
| Enter     | Aktiviert fokussiertes Element                          |
| Escape    | Toast schließt (nur wenn fokussiert)                    |

### Do / Don't

- ✓ Für Submit-Bestätigungen, Race-Conditions, kurze Server-Fehler.
- ✓ Telefonnummer im Erfolgs-Toast einbetten (US-IT11-03 AC#4).
- ✗ NICHT für kritische Fehler, die Aktion erfordern — dort `<Banner>` (persistent).
- ✗ NICHT für Form-Inline-Fehler — dort Inline-Fehler an Felder.

---

## 2. `BookingConfirmation` (NEU IT11, Client/Server-Hybrid)

**Datei:** `src/components/booking/BookingConfirmation.tsx`

### Zweck

Rendert die Post-Submit-Bestätigungs-Page mit Buchungsnummer, Termin-Daten, Status, Hinweistext und CTAs. Ersetzt **nicht** die bestehende `BestaetigtClient.tsx` (Counter-Proposal-Respond-Confirmation, IT3) — neue, separate Page.

> **Routing (BESTÄTIGT IT11 durch Tom):** Page ist erreichbar via `/buchung/bestaetigung/[bookingId]?token=…`.
> - **Eingeloggter Kunde:** kann auch ohne `?token=…`-Query-Param zugreifen (Auth-Cookie reicht). Tab-Refresh nach Direkt-Aufruf der URL ohne Token funktioniert weiter.
> - **Gast:** **muss** den signierten Token mitführen. Fehlt er oder ist er abgelaufen (>30 Tage), antwortet der Server mit 401/410, UI rendert `<TokenExpiredState>`.
> - Trennung von `/buchung/bestaetigt` (Counter-Proposal-Confirmation, IT3, **nicht** verändert) ist semantisch wichtig — Engineer darf keine der beiden Routes mit der anderen verwechseln.

### Variants

| Variant            | Trigger                                  | Layout                                                                 |
|--------------------|------------------------------------------|------------------------------------------------------------------------|
| `success-customer` | Eingeloggter Kunde                        | Vollständige Daten, Primary-CTA „Zum Kunden-Dashboard →"               |
| `success-guest`    | Gast (kein Login)                         | Vollständige Daten, Primary-CTA „Jetzt Konto erstellen, um den Status zu verfolgen →" |
| `loading`          | Daten werden gefetcht                     | Skeleton                                                               |
| `not-found`        | 404 — Booking-ID existiert nicht          | Error-Block mit Link zur Startseite                                    |
| `forbidden`        | 403 — fremde Booking                      | Error-Block mit Link zum Dashboard                                     |
| `error`            | 5xx                                       | Error-Block mit Retry                                                  |

### States

Identisch zu Variants oben (1:1-Mapping).

### Props

| Prop          | Typ                          | Default | Beschreibung                                                              |
|---------------|------------------------------|---------|---------------------------------------------------------------------------|
| `bookingId`   | `string`                      | —       | Pflicht. Aus URL-Param.                                                    |
| `accessToken` | `string \| null`             | `null`  | Optional. Signed-URL-Token für Gast-Zugriff (siehe IT11-§2.7 NEEDS INPUT). |
| `viewerType`  | `'customer' \| 'guest'`      | —       | Bestimmt CTA-Variant.                                                     |

### Behaviour

- On-Mount: `GET /api/bookings/{bookingId}/confirmation?token={accessToken}` (oder gleichwertiger Endpoint, siehe Architektur).
- Daten werden **nicht** im Page-State persistiert — bei jedem Mount frisch gefetcht. Reload zeigt neue Daten (z.B. wenn Tom in der Zwischenzeit bestätigt hat, wechselt Status-Badge).
- Status-Badge nutzt `BookingStatusBadge` (IT10).
- Bei Variant `success-guest`: Primary-CTA `href="/konto/registrieren?bookingId={id}&prefillEmail={email}"`. Backend kann optional die Booking nach Registrierung dem neuen Account zuordnen (siehe Backlog-Verweis IT10 §6.1).
- Print-Stylesheet: `.bk-confirmation-print { @media print { ... } }` blendet Header/CTAs aus, Page wird zweispaltig kompakt gedruckt.

#### Modifikationen IT11-Update (NEU)

- **„30 Tage aufbewahren"-Hinweis-Card** wird zwischen Info-Banner und CTAs gerendert. Subtle BG (`baerenstark-cream`), Bookmark-Icon (`Bookmark`, lucide, 20 px). Microcopy siehe `ux-spec.md` IT11-§2.2 Microcopy-Tabelle. Ist **nicht** dismissible — soll dauerhaft sichtbar bleiben für Wiederbesucher.
- **Storno-CTA für Gäste** rendert nur wenn `viewerType === 'guest'` AND `accessToken !== null` AND `booking.status` ∈ `{'PENDING', 'CONFIRMED'}`. Variant: sekundär-link, destruktive Farbgebung (`text-button-destructive-fg` als Link-Color, Underline beim Hover). Label: „Anfrage stornieren". Href: `/buchung/{bookingId}/stornieren?token={accessToken}`. Bei `viewerType === 'customer'`: kein Storno-CTA hier — Customer storniert über `/konto`.
- **Token-Expired-State:** wenn API 401/410 liefert, rendert die Komponente den `<TokenExpiredState>` (siehe §11) statt Booking-Daten.

### Layout (verbindlich)

Siehe `ux-spec.md` IT11-§2.2.

### Accessibility

- `<main aria-labelledby="confirmation-heading">`, H1 mit `id="confirmation-heading"`.
- Fokus wandert beim Mount auf H1 (`tabIndex={-1}` + `focus()`).
- Buchungsnummer `<span>` mit `<span>` (kein `code` — wir wollen Sie selectable, aber nicht als „code" gelesen).
- Status-Badge: `<BookingStatusBadge status={...} />` — Text + Icon (Icon `aria-hidden`).
- Info-Banner: `role="status"` mit Headline.
- CTAs: `<Link>` (Next.js).

### Microcopy

Siehe `ux-spec.md` IT11-§2.2.

### Do / Don't

- ✓ Für Post-Submit-Bestätigung nach `POST /api/bookings` (201).
- ✗ NICHT für Counter-Proposal-Respond — dort bleibt `BestaetigtClient.tsx` (IT3).
- ✗ NICHT als Modal — bewusst Page-Wechsel für Vertrauens-Effekt + Bookmarkable + Druck.

### Skizze

Siehe `ux-spec.md` IT11-§2.2.

---

## 3. `FileUpload` (MODIFIZIERT IT11, Client)

**Datei:** `src/components/booking/FileUpload.tsx` (existiert, IT-Stand US-18)

### Zweck (unverändert)

Kunden-seitige Datei-Upload-Komponente mit Drag&Drop, Multi-File, Pro-Datei-Status. Eingebettet im `QuickBookingModal` und im `/buchen`-Form.

### Variants (unverändert)

Eine Komponente, kein Variant-Prop.

### States (verfeinert IT11)

**Drop-Zone:**

| State            | Trigger                          | Visual                                                              |
|------------------|----------------------------------|---------------------------------------------------------------------|
| `idle`           | Default                          | Border `border-dashed border-baerenstark-sand`, Icon + Hilfetext neutral. |
| `drag-over`      | DragEnter im Drop-Zone-Bereich   | Border `upload-dropzone-border-active` (NEU IT11 Token), BG `feedback-info-bg/40`. |
| `drag-rejected`  | DragEnter mit ungültigem Typ     | Border `feedback-error`, BG `feedback-error-bg/40`.                |
| `disabled`       | 5 Dateien erreicht ODER Submit läuft | `opacity-50`, `pointer-events: none`.                          |

**Pro-Datei-Reihe:**

| State        | Visual                                                                                                        |
|--------------|---------------------------------------------------------------------------------------------------------------|
| `pending`    | Datei sichtbar, Icon basierend auf Typ.                                                                       |
| `uploading`  | Linearer `<progress>`-Bar, Prozent. `aria-busy="true"`. Entfernen-Button cancelt XHR.                          |
| `success`    | Grünes Häkchen, Vorschau-Thumbnail (40×40 px) bei Bildern, Icon-Card bei Videos/PDF. Größe + „hochgeladen".   |
| `error`      | Rotes X, Inline-Fehlertext, Inline-Retry-Button (NEU IT11).                                                   |

### Props (verfeinert IT11)

| Prop                  | Typ                                            | Default | Beschreibung                                                                 |
|-----------------------|------------------------------------------------|---------|------------------------------------------------------------------------------|
| `onAttachmentsChange` | `(attachmentIds: string[]) => void`            | —       | Pflicht. Liefert IDs der erfolgreich hochgeladenen Dateien an den Form-Container. |
| `hideSection`         | `boolean`                                      | `false` | Wenn true: Komponente rendert nichts. Genutzt bei `BLOB_NOT_CONFIGURED`.    |
| `disabled`            | `boolean` (**NEU IT11**)                       | `false` | Wenn true (Submit läuft): Drop-Zone disabled, neue Files können nicht hinzugefügt werden, bestehende Reihen behalten ihren State (kein Re-Upload). |
| `maxFiles`            | `number` (**NEU IT11**, default aus Schema)    | `5`     | Override möglich für andere Verwendungen.                                    |
| `maxBytesByType`      | `Record<'image'\|'video'\|'pdf', number>` (**NEU IT11-Update**) | `{ image: 10*1024*1024, video: 50*1024*1024, pdf: 10*1024*1024 }` | MIME-spezifische Limits (BESTÄTIGT IT11). |

### Behaviour (verfeinert)

- Bis zu 5 Dateien parallel verwaltbar.
- Jede Datei wird einzeln via `POST /api/upload` hochgeladen (sequenziell oder parallel — Engineer-Entscheidung; IT11 Spec: parallel, max 3 gleichzeitig, Rest queued).
- **NEU IT11:** Bei `error`-State zeigt die Reihe einen Inline-Retry-Button (`Erneut versuchen`). Klick startet Upload neu.
- Bei `BLOB_NOT_CONFIGURED`-Antwort: Komponente blendet sich aus + zeigt Banner (siehe IT11-§3.4).
- Bei 413/415: Inline-Fehler pro Datei, andere Dateien laufen unbeeinflusst weiter.
- Drag&Drop und nativer File-Picker (`<input type="file" hidden />`).
- `attachmentIds` der erfolgreichen Dateien an Parent.

#### Modifikationen IT11-Update (BESTÄTIGT)

- **MIME-spezifische Limits (BESTÄTIGT durch Tom):** Bilder 10 MB, Videos 50 MB, PDF 10 MB. Client-Side-Validierung muss vor Upload-Start prüfen und die korrekte Microcopy zurückliefern (siehe `ux-spec.md` IT11-§3.1).
- **Drop-Zone-Microcopy konkretisiert:** Default-Hinweis ist jetzt **„Bilder bis 10 MB, Videos bis 50 MB."** (kurz, prominent). Der lange Hilfetext „Bilder bis 10 MB, Videos bis 50 MB, PDF bis 10 MB — bis zu 5 Dateien insgesamt." steht **unter** der Drop-Zone.
- **Fehler-Toast bei Datei-zu-groß (NEU):** Zusätzlich zum Inline-Fehler an der Datei-Reihe wird ein Toast (`warning`, 5 s) ausgelöst mit MIME-spezifischer Limit-Angabe. Verhindert, dass Fehler übersehen werden, falls die Datei-Liste bereits gescrollt ist.

### Accessibility (verfeinert IT11)

- Drop-Zone: `<div role="button" tabIndex={0} aria-label="Datei auswählen oder hierher ziehen, max. 20 MB pro Datei, bis zu 5 Dateien">`.
- Datei-Liste: `<ul role="list">`.
- Pro-Datei-`<li>` mit Datei-Meta + Action-Button (Entfernen oder Retry).
- Upload-Status-Live-Region: `<div role="status" aria-live="polite">` außerhalb der Liste, wird bei jedem State-Wechsel aktualisiert.
- Fortschritts-Bar: `<progress max="100" value={percent} aria-label="Upload {filename}, {percent} Prozent">`.
- Reduce-Motion: Fortschritts-Bar weiterhin animiert (semantisch wichtig); kein zusätzliches Wackeln/Bouncen.

### Keyboard

| Key             | Verhalten                                                            |
|-----------------|----------------------------------------------------------------------|
| Tab in Drop-Zone | Fokus auf `role="button"` Wrapper                                    |
| Enter / Space   | Öffnet File-Picker                                                   |
| Tab nach Drop-Zone | Fokus auf erste Datei-Reihe (Entfernen- oder Retry-Button)        |

### Microcopy

Siehe `ux-spec.md` IT11-§3.2.

### Do / Don't

- ✓ Im `QuickBookingModal` und `/buchen`-Form.
- ✓ `disabled` setzen während Submit läuft.
- ✗ NICHT auf der Admin-Seite — dort `FileGallery` für Anzeige (read-only).

---

## 4. `FileGallery` (NEU IT11, Client)

**Datei:** `src/components/admin/FileGallery.tsx`

### Zweck

Admin-seitige Anzeige aller Anhänge einer Buchung in der Detail-Ansicht (`/admin/bookings/[id]`). Read-only. **Klick auf jedes Thumbnail öffnet die Datei im neuen Tab** (BESTÄTIGT IT11 durch Tom — Lightbox ist IT12-Backlog). Download-Button pro Datei.

### Variants

| Variant      | Trigger        | Layout                                                          |
|--------------|----------------|------------------------------------------------------------------|
| `grid`       | Default        | Thumbnail-Grid responsive (3 Spalten Desktop, 2 Tablet, 1 Mobile) |

### States

| State                  | Trigger                                                  | Visual                                                                  |
|------------------------|----------------------------------------------------------|--------------------------------------------------------------------------|
| `loading`              | Detail-Page-Mount, Daten pending                          | Skeleton: 3 Thumbnail-Placeholder.                                       |
| `populated`            | `attachments.length >= 1`                                 | Grid mit Thumbnails.                                                    |
| `empty-no-attachments` | `attachments.length === 0`                                | Inline-Hinweis „Keine Dateien hochgeladen." mit `Info`-Icon (lucide).   |
| `error-fetch`          | Datei-URL liefert 404/403 beim Thumbnail-Load              | Thumbnail mit Overlay „⚠️ Datei nicht verfügbar", Download disabled.    |

### Props

| Prop          | Typ                                                                            | Default | Beschreibung                                                                              |
|---------------|--------------------------------------------------------------------------------|---------|-------------------------------------------------------------------------------------------|
| `attachments` | `Array<{ id: string; url: string; filename: string; size: number; contentType: string; thumbnailUrl?: string }>` | —       | Pflicht.                                                                                   |
| `bookingId`   | `string`                                                                       | —       | Pflicht (für Aria-Labels und Download-Filename-Fallback).                                 |
| `isLoading`   | `boolean`                                                                      | `false` | Triggert Skeleton.                                                                         |

### Behaviour

- **Klick auf Bild-Thumbnail** → öffnet Bild in **neuem Tab** via `<a href={url} target="_blank" rel="noopener noreferrer">`. Browser nutzt seinen nativen Image-Viewer.
- **Klick auf Video-Thumbnail** → öffnet Video in **neuem Tab** via `<a href={url} target="_blank" rel="noopener noreferrer">`. Browser nutzt seinen nativen Video-Player.
- **Klick auf PDF-Thumbnail** → öffnet PDF in **neuem Tab** via `<a href={url} target="_blank" rel="noopener noreferrer">`. Browser nutzt seinen nativen PDF-Viewer.
- **Klick auf Download-Button** → `<a href={url} download={filename}>` triggert Download.
- Bei Bild-Load-Fehler (`onError`): Thumbnail-Card wechselt auf `error-fetch`-State, Anker-Klick deaktiviert (`pointer-events: none`, `aria-disabled="true"`), Download-Button disabled.

> **Designentscheidung IT11 (Tom-Bestätigung):** Keine Lightbox-Komponente in IT11. Native Browser-Viewer reichen für Toms Use-Case (Single-Admin Vorschau-Workflow). Falls Mehrwert in IT12+ identifiziert: dann nachrüsten.

### Layout

Siehe `ux-spec.md` IT11-§3.3.

### Accessibility

- `<section aria-labelledby="attachments-heading">` mit sichtbarem `<h3 id="attachments-heading">Anhänge</h3>`.
- Counter („3 von 3"): rein dekorativ rechts, kein eigener ARIA-Wert.
- Thumbnail-Wrapper: einheitlich `<a href={url} target="_blank" rel="noopener noreferrer" aria-label="{Datei-Typ} {filename} in neuem Tab öffnen">` für **alle** Datei-Typen (Bild, Video, PDF). Aria-Label-Microcopy konsistent IT11: „Bild {filename} in neuem Tab öffnen" / „Video {filename} in neuem Tab öffnen" / „PDF {filename} in neuem Tab öffnen".
- Download-Button: `<a href={url} download={filename} aria-label="{filename} herunterladen">` mit `Download` Icon.
- Empty-State: `role="status"` (kein Fehlerzustand).
- Error-State: `role="alert"` für Datei-nicht-verfügbar-Markierungen.
- `target="_blank"`-Anker: Screen-Reader (NVDA/VoiceOver) künden „opens in new tab" automatisch — `aria-label` darf zusätzlich zur Klarheit „in neuem Tab öffnen" enthalten (wie oben). `rel="noopener noreferrer"` ist Pflicht für Sicherheit.

### Keyboard

| Key       | Verhalten                                                              |
|-----------|------------------------------------------------------------------------|
| Tab       | Fokus auf Thumbnail-Anker → Download-Button → nächstes Thumbnail …    |
| Enter     | Aktiviert fokussierten Anker (öffnet Datei in neuem Tab) bzw. Download-Button (triggert Download) |

### Microcopy

Siehe `ux-spec.md` IT11-§3.3.

### Do / Don't

- ✓ Auf Admin-Booking-Detail-Page.
- ✓ Datei-Vorschau via „neuer Tab" für **alle** Datei-Typen (Bild, Video, PDF) — IT11 Default.
- ✗ NICHT mit `LightboxModal` integrieren — `LightboxModal` ist out-of-scope für IT11 (IT12-Backlog).
- ✗ NICHT als Bearbeitungs-UI — Admin kann Anhänge nicht löschen/ändern (read-only Scope IT11). Falls Tom später Löschen will → IT12.
- ✗ NICHT auf Customer-Detail-Page — dort werden Anhänge in IT11 nicht angezeigt (out-of-scope; siehe Backlog).

---

## 5. `LightboxModal` — **OUT-OF-SCOPE FÜR IT11 (IT12-Backlog)**

> **Status (BESTÄTIGT IT11 durch Tom, 2026-05-04):** Diese Komponente wird in IT11 **nicht implementiert**. Sie ist nach IT12-Backlog verschoben.
>
> **IT11-Verhalten stattdessen:** `FileGallery`-Klick öffnet die Datei in einem neuen Tab via `<a target="_blank" rel="noopener noreferrer">` über alle Datei-Typen hinweg (Bild, Video, PDF). Browser nutzt seine nativen Viewer/Player. Siehe §4 (`FileGallery`) Behaviour-Section.
>
> **Begründung Tom:** Native Browser-Viewer sind ausreichend für seinen Single-Admin-Vorschau-Workflow. Eine eigene Lightbox mit Focus-Trap, Pfeiltasten-Navigation und Video-Player-Cleanup wäre zusätzlicher Implementations-, Test- und QA-Aufwand ohne klaren Mehrwert in IT11.
>
> **IT12-Backlog-Hinweis für künftige Iterationen:**
> - Wenn die Lightbox in IT12+ wiederaufgenommen wird, kann die ursprüngliche Spec aus der Git-History (Commit unmittelbar vor dem IT11-QA-Update) übernommen werden.
> - Ursprüngliche Anforderungen waren: `role="dialog"`, Focus-Trap, ArrowLeft/ArrowRight-Navigation, Download-Button, Reduce-Motion-Support, neutraler `rgba(0,0,0,0.85)`-Backdrop.
> - Die Design-System-Tokens `backdrop-lightbox` und die animation-tokens `duration-lightbox-enter` / `duration-lightbox-exit` (IT11-D3, IT11-D6 in `design-system.md`) bleiben bestehen, sind aber in IT11 ungenutzt — entweder hier mit „IT12-Backlog"-Status belassen oder aus dem Tailwind-Config entfernen, bis Lightbox real wird. **Empfehlung IT11:** Tokens belassen (kostet nichts, markiert Intent für IT12).
>
> **Engineer-Hinweis IT11:** Datei `src/components/admin/LightboxModal.tsx` darf **nicht** in IT11 erstellt werden. PR-Reviewer rejecten jeden Versuch.

---

## 6. `BookingModal` (alias `QuickBookingModal`, MODIFIZIERT IT11, Client)

**Datei:** `src/components/booking/QuickBookingModal.tsx` (existiert, IT10)

### Zweck (unverändert IT10)

Modal/Bottom-Sheet mit BookingForm. IT11 ändert nur Trigger-Sources und Erfolgs-Pfad — strukturell bleibt die Komponente gleich.

### Anpassungen IT11

#### A. Trigger-Sources erweitert / vereinheitlicht

Bisheriges Verhalten (IT10): geöffnet ausschließlich durch Slot-Klick im Kalender auf der Buchungs-Seite.

**IT11-Verhalten:** geöffnet durch jeden globalen Buchungs-CTA der Inventarliste (siehe `ux-spec.md` IT11-§1.3):

- Hero-CTA (Startseite)
- Service-Card-CTA (Startseite)
- Header-CTA (alle Pages)
- Mobile-Burger-Menü
- Empty-State-CTA `/konto`
- Detail-Page-CTA „Neue Anfrage stellen"

Implementierungs-Hinweis: globaler `BookingModalProvider` im Root-Layout, exposed via `useBookingModal()`-Hook. Hook-API:

```ts
const { openModal, closeModal, isOpen } = useBookingModal();
openModal(); // ohne defaultService
openModal({ defaultService: 'reinigung' }); // mit Vorauswahl
```

#### B. Initialer Slot-State entfällt zwingend

Vorher (IT10): `selectedTimeSlot` war Pflicht-Prop, weil Modal nur aus Kalender getriggert wurde.

**IT11:** `selectedTimeSlot` wird **optional**. Wenn `null`, rendert das Modal **innerhalb** des Modals einen Mini-Kalender (Calendar + TimeSlotPicker, kompakt) statt nur des Slot-Headers. Sobald ein Slot gewählt ist, kollabiert der Mini-Kalender zum Header (Datum + Slot + „Slot ändern").

| Aufruf-Kontext                  | `selectedTimeSlot` Prop | Modal-Initial-State           |
|---------------------------------|-------------------------|-------------------------------|
| Hero-CTA (Startseite)           | `null`                  | Mini-Kalender expanded sichtbar, Form darunter (Service ggf. vorausgewählt) |
| Service-Card-CTA                | `null`                  | wie oben + `defaultService` gesetzt |
| Header-CTA                      | `null`                  | wie oben                      |
| Detail-Page-CTA                 | `null`                  | wie oben                      |
| Slot-Klick im `/buchen`-Fallback | gesetzt                | Slot-Header kompakt, Form sichtbar |

> **Architektur-Hinweis:** Das Mini-Kalender-Pattern verschiebt den IT10-Flow (Slot-Klick → Modal) zu einem Inline-Kalender im Modal. Der bestehende `Calendar` + `TimeSlotPicker` werden ggf. wiederverwendet, aber visuell auf 100% Modal-Breite reduziert. Engineer entscheidet, ob es eine separate `CompactCalendar`-Komponente braucht oder ob `Calendar` einen `compact`-Prop bekommt.

#### B-bis. Submit-Block-Verhalten (BESTÄTIGT IT11-Update)

Während `state === 'submitting'` (zwischen Submit-Klick und Server-Response):

- **Escape:** Event-Handler ignoriert Key — Modal schließt **nicht**.
- **Backdrop-Klick:** Click-Outside-Handler ignoriert Event — Modal schließt **nicht**.
- **X-Button:** `disabled` mit `opacity-40`, `cursor-not-allowed`, `aria-disabled="true"`. Klick löst keine Aktion aus.
- **Submit-Button:** disabled, Spinner-Icon links (`Loader2`, lucide, 16 px, `animate-spin`, `aria-hidden`). Label „Wird gesendet …".
- **Sichtbarer Hinweis im Modal-Body** unterhalb des Submit-Buttons (NEU IT11): `<p role="status" aria-live="polite" className="text-sm text-baerenstark-bark/70">Anfrage wird gesendet …</p>`. Verhindert, dass der Kunde den Tab schließt oder reload-iert.

Implementierung:

```tsx
useEffect(() => {
  if (state !== 'submitting') return;
  const blockEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
  };
  document.addEventListener('keydown', blockEscape, { capture: true });
  return () => document.removeEventListener('keydown', blockEscape, { capture: true });
}, [state]);
```

#### C. Erfolgs-Pfad: Auto-Redirect zu Bestätigungs-Page

| Submit-Schritt                       | IT10 Verhalten                                            | IT11 Verhalten (neu)                                                  |
|--------------------------------------|-----------------------------------------------------------|------------------------------------------------------------------------|
| Server antwortet 201                 | Modal animiert raus → Toast → Slot-Markierung im Kalender → Inline-Confirmation-Block oberhalb Kalender | Modal animiert raus (250 ms) → Toast (`success`, 5 s, mit tel-Link) → **`router.push('/buchung/bestaetigung/' + bookingId)`** unmittelbar nach Modal-Close → Toast bleibt durch Layout-Toaster auf Bestätigungs-Page sichtbar. |
| Slot im Kalender markieren           | direkt im Modal-Close-Cleanup                             | unverändert (Cleanup vor Redirect, so dass Bookmarker zur Startseite den Slot belegt sieht). |

#### D. Props-Update IT11

Zusätzlich zu IT10 §1:

| Prop                  | Typ                                | Default | Pflicht | Beschreibung                                                                |
|-----------------------|------------------------------------|---------|---------|-----------------------------------------------------------------------------|
| `selectedTimeSlot`    | `Slot \| null` (**geändert**: vorher Pflicht, jetzt nullable) | `null` | nein    | Wenn `null`: Modal rendert Mini-Kalender intern.                            |
| `onConfirmationRedirect` | `(bookingId: string) => void`   | `(id) => router.push(\`/buchung/bestaetigung/${id}\`)` | nein | Callback nach erfolgreichem Submit. Default ist Auto-Redirect. Override für Tests/Edge-Cases. |
| `prefillCustomer`     | `Partial<BookingFormInput>`        | `{}`    | nein    | Aus `useCustomerSession()` (US-IT11-05).                                    |

### Behaviour-Diff (IT10 → IT11)

| Aspekt                            | IT10                            | IT11                                                                  |
|-----------------------------------|---------------------------------|------------------------------------------------------------------------|
| Trigger-Source                    | nur Slot-Klick                  | jeder globale Buchungs-CTA                                            |
| `selectedTimeSlot`                | Pflicht                         | optional, intern Mini-Kalender wenn `null`                            |
| Submit-Erfolg                     | Toast + kein Redirect           | Toast + Auto-Redirect zur Bestätigungs-Page                            |
| Inline-Confirmation oberhalb Kalender | sichtbar                    | entfällt (Auto-Redirect übernimmt)                                    |
| Service-Pflicht-Feld              | bleibt (IT10 §5.6)              | unverändert                                                           |
| Race-Condition `409 BOOKING_SLOT_TAKEN` | Banner + „Anderen Slot wählen" | unverändert                                                       |
| Form-State-Persistenz             | Parent-State über Modal-Reopens | unverändert                                                           |

### Accessibility

Unverändert IT10 §5.11. Zusätzlich IT11:

- Bei `selectedTimeSlot === null`: Mini-Kalender-Section bekommt `<fieldset>` mit `<legend>Termin auswählen</legend>` als erstes Pflicht-Feld vor Service-Auswahl.
- Tab-Reihenfolge ändert sich entsprechend: Close → (Mini-Kalender wenn präsent) → Service → Kontakt → Adresse → Beschreibung → Upload → Datenschutz → Abbrechen → Submit.

### Microcopy IT11 (Diff zu IT10)

| Element                            | IT10 Text                                                               | IT11 Text                                                                                          |
|------------------------------------|-------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| Erfolgs-Toast                      | „Anfrage gesendet. Wir melden uns innerhalb von 24 Stunden."           | „Anfrage erfolgreich gesendet! Tom meldet sich in Kürze bei Ihnen. Telefonisch erreichbar: **0157 74787512**." (mit `tel:`-Link; Display mit non-breaking-space) |
| Inline-Confirmation oberhalb Kalender | „Anfrage **{Datum, Zeit}** ist gesendet. → [Zur Bestätigungs-Seite](...)" | entfällt (Auto-Redirect)                                                                          |
| Mini-Kalender-Legend (NEU IT11)    | —                                                                       | „Termin auswählen"                                                                                 |

### Do / Don't IT11

- ✓ Für **alle** primären Buchungs-Einstiegspunkte verwenden (siehe Inventarliste IT11-§1.3).
- ✓ Bei Direkt-URL `/buchen` **nicht** verwenden — dort rendert die Page das BookingForm inline (Fallback ohne Modal).
- ✗ NICHT mehrere Modal-Instanzen — globaler Provider hält genau einen Modal-State.

### Skizze (Mobile, mit Mini-Kalender)

```
┌────────────────────────────────┐
│ Termin anfragen           [✕]  │
├────────────────────────────────┤
│ Termin auswählen               │  ← NEU IT11 (wenn selectedTimeSlot null)
│  ┌──────────────────────────┐  │
│  │  [Mini-Kalender, Mai 26] │  │
│  │  M D M D F S S           │  │
│  │      1 2 3 4 5           │  │
│  │  6 7 8 9 …               │  │
│  └──────────────────────────┘  │
│  Verfügbare Slots am 12.05.    │
│  [09:00] [11:00] [13:00]       │
│                                │
├────────────────────────────────┤
│ (sobald Slot gewählt:)         │
│ Mo, 12.05. · 09:00–11:00       │
│ ────────────  [↺ Slot ändern]  │
├────────────────────────────────┤
│ Welcher Service?               │
│ ⦿ Reinigung    2 h · ab 60 €   │
│ … (wie IT10)                   │
└────────────────────────────────┘
```

---

## 7. `PrefillBadge` (NEU IT11, Server- oder Client-Component)

**Datei:** `src/components/booking/PrefillBadge.tsx`

### Zweck

Visualisiert, dass ein Form-Feld aus dem Profil des eingeloggten Kunden vorausgefüllt wurde. Verschwindet, sobald der Kunde den Wert ändert.

### Variants

Single-Variant (kein Variant-Prop).

### States

| State       | Trigger                                  | Visual                                                                |
|-------------|------------------------------------------|-----------------------------------------------------------------------|
| `visible`   | Field-Wert == Profil-Wert                | Pill sichtbar, Tooltip-fähig                                          |
| `hidden`    | Field-Wert != Profil-Wert (dirty)        | Pill ausgeblendet (Opacity-Fade 150 ms)                               |

### Props

| Prop          | Typ           | Default                              | Beschreibung                                              |
|---------------|---------------|--------------------------------------|-----------------------------------------------------------|
| `isPrefilled` | `boolean`     | —                                    | Pflicht. Steuert Visibility (Parent berechnet via dirty-State). |
| `tooltipText` | `string`      | „Aus Ihrem Profil übernommen — Sie können den Wert für diese Anfrage anpassen." | Override möglich.                                         |

### Behaviour

- Stateless. Visibility wird vom Parent gesteuert via `react-hook-form`'s `formState.dirtyFields[fieldName]`:
  ```tsx
  <PrefillBadge isPrefilled={!formState.dirtyFields.name && !!prefillData.name} />
  ```

### Visual

```
┌──────────────────────────────────┐
│ Name *  [≪ aus Profil ≫]         │
│ [Anna Schmidt                  ] │
└──────────────────────────────────┘
```

- `text-xs font-medium`.
- BG `baerenstark-sand/40`, Border-Radius `radius-full`, Padding `px-2 py-0.5`.
- Icon links: `User` (lucide), 12 px, `aria-hidden`.
- Hover/Focus: Tooltip mit Text aus `tooltipText`.

### Accessibility

- `<span role="note" aria-label={tooltipText}>` (so dass Screen-Reader die Bedeutung kennt).
- Selbst nicht fokussierbar (rein visuell).
- Tooltip via `title` attribute (nativ) oder shadcn `Tooltip` (zugänglich-besser).
- Reduce-Motion: kein Fade-Out, sofortiges Verschwinden.

### Microcopy

```
Pill-Label:        „aus Profil"  (mit Icon `User` davor)
Tooltip-Default:   „Aus Ihrem Profil übernommen — Sie können den Wert für diese Anfrage anpassen."
```

### Do / Don't

- ✓ Direkt rechts neben dem Field-`<label>` rendern (gleiche Zeile).
- ✓ Nur für Felder mit Profil-Korrespondenz (Name, Email, Telefon, Straße, PLZ, Ort).
- ✗ NICHT für Felder, die nicht aus dem Profil kommen (Beschreibung, Service, Datum, Datenschutz).
- ✗ NICHT als Pflichtfeld-Indikator missbrauchen — Asterisk bleibt der Pflicht-Marker.

---

## 8. `ConfirmCancelDialog` (NEU IT11-Update, Client)

**Datei:** `src/components/booking/ConfirmCancelDialog.tsx`

### Zweck

Generischer destruktiver Confirm-Dialog mit Buchungs-Detail-Card und zwei Footer-Actions (sekundär „Abbrechen" + destruktiv-rot „Ja, stornieren"). Wird aus `BookingListItem` im Kunden-Dashboard getriggert (US-IT11-06). Konzipiert als wiederverwendbar — Tom könnte denselben Dialog später für admin-seitiges Storno wiederverwenden.

### Variants

Single-Variant (kein Variant-Prop); Microcopy + Detail-Inhalte sind über Props konfigurierbar.

### States

| State              | Trigger                                    | Visual                                                                        |
|--------------------|--------------------------------------------|-------------------------------------------------------------------------------|
| `idle`             | Dialog geöffnet                            | Beide Buttons aktiv, Detail-Card sichtbar.                                    |
| `submitting`       | Klick „Ja, stornieren"                     | Destruktiv-Button: `disabled`, Spinner, Label-Switch. Abbrechen: `disabled`. Escape + Backdrop **geblockt**. Live-Region: „Stornierung wird verarbeitet, bitte warten." |
| `error`            | API-Fehler 5xx                              | Banner oben im Dialog, beide Buttons wieder aktiv. Inline-Retry möglich.      |

### Props

| Prop              | Typ                                              | Default | Pflicht | Beschreibung                                                                  |
|-------------------|--------------------------------------------------|---------|---------|-------------------------------------------------------------------------------|
| `isOpen`          | `boolean`                                        | —       | ja      | Dialog-Sichtbarkeit.                                                          |
| `onClose`         | `() => void`                                     | —       | ja      | Schließen-Trigger (Escape im idle, Abbrechen-Klick, Backdrop im idle).        |
| `onConfirm`       | `() => Promise<void>`                            | —       | ja      | Aktion bei „Ja, stornieren". Promise-resolve = success → Dialog schließt.    |
| `title`           | `string`                                         | „Anfrage stornieren?" | nein | Dialog-Title.                                                              |
| `description`     | `string`                                         | „Möchten Sie diesen Auftrag wirklich stornieren?" | nein | Body-Frage.                                                       |
| `detailContent`   | `ReactNode`                                      | —       | ja      | Buchungs-Detail-Card-Inhalt (Service, Datum, Buchungsnummer).                 |
| `disclaimerText`  | `string`                                         | „Diese Aktion kann nicht rückgängig gemacht werden. Tom wird per E-Mail über die Stornierung informiert." | nein | Hinweistext, kursiv. |
| `confirmLabel`    | `string`                                         | „Ja, stornieren" | nein | Destruktiv-Button-Label im idle-State.                                       |
| `confirmLoadingLabel` | `string`                                     | „Wird storniert …" | nein | Destruktiv-Button-Label während `submitting`.                              |
| `cancelLabel`     | `string`                                         | „Abbrechen" | nein | Sekundär-Button-Label.                                                            |
| `errorBanner`     | `string \| null`                                 | `null`  | nein    | Banner-Inhalt im `error`-State. Parent steuert.                               |

### Behaviour

- `onConfirm` ist async; Komponente verfolgt internen `submitting`-State während Promise pending.
- Bei Promise-resolve: `onClose()` wird automatisch ausgelöst (Parent kann via Toast Erfolgs-Feedback geben).
- Bei Promise-reject: `submitting` zurückgesetzt; Parent setzt `errorBanner`-Prop für Visual-Feedback.
- Initialer Fokus: **Abbrechen-Button** (sicherer Default vor destruktiver Aktion).
- Tab-Reihenfolge: Close-X → Abbrechen → Ja, stornieren.
- Escape: schließt nur im `idle`-State.

### Layout

Siehe `ux-spec.md` IT11-§6.2.

### Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="cancel-dialog-title"`, `aria-describedby="cancel-dialog-body"`.
- Focus-Trap aktiv.
- Reduce-Motion: kein Backdrop-Fade, kein Scale.
- Destruktiv-Button bekommt zusätzlich `aria-describedby="cancel-disclaimer"` damit Screen-Reader den Hinweistext liest, bevor der Klick ausgelöst wird.

### Keyboard

| Key     | Verhalten                                                          |
|---------|--------------------------------------------------------------------|
| Escape  | Schließt Dialog (nur im `idle`-State)                              |
| Tab     | Focus-Trap zwischen Close → Abbrechen → Ja, stornieren             |
| Enter / Space | Aktiviert fokussiertes Element                              |

### Microcopy

Siehe `ux-spec.md` IT11-§6.2 Microcopy-Tabelle.

### Do / Don't

- ✓ Für destruktive Aktionen mit Buchungs-Kontext (Storno, später ggf. Account-Löschen, Service-Inaktivieren).
- ✓ Mit Detail-Card, damit der Kunde sicher die richtige Buchung storniert.
- ✗ NICHT für nicht-destruktive Confirms (z.B. „Termin verschieben?") — dort generischer `<ConfirmDialog>` aus IT10.
- ✗ NICHT ohne Disclaimer-Text — der Hinweis „kann nicht rückgängig gemacht werden" ist Pflicht.

---

## 9. `CancelOrderPage` (NEU IT11-Update, Client + Server-Component-Hybrid)

**Datei:** `src/app/buchung/[id]/stornieren/page.tsx` (Layout-Spec — die Komposition aus mehreren Sub-Components: `CancelOrderClient.tsx` für interaktive States).

### Zweck

Eigene Page für Gast-Storno via signed URL-Token. Layout-Spec — kein klassisches Komponent-Bundle, sondern eine Route-Komposition mit fünf States.

### Variants

| Variant              | Trigger                                       | Layout                                                                       |
|----------------------|-----------------------------------------------|------------------------------------------------------------------------------|
| `token-valid`        | Token gültig + Status `Offen`/`Bestätigt`     | Buchungsdetails + Confirm-Button + Abbrechen-Link                            |
| `token-expired`      | Token abgelaufen / 401 / 410                  | `<TokenExpiredState>` (siehe §10)                                            |
| `token-invalid`      | Token ungültig / 404                          | `<TokenExpiredState>` (gleiche UX wie expired — Kunde merkt keinen Unterschied) |
| `already-cancelled`  | Buchung bereits storniert                     | Friendly-State mit Hinweis + Link zur Startseite                             |
| `success`            | Nach erfolgreichem POST                       | Erfolgs-Page (siehe IT11-§6.4)                                               |

### States

Identisch zu Variants oben + interner Submit-State:

| State              | Trigger                          | Visual                                                                         |
|--------------------|----------------------------------|--------------------------------------------------------------------------------|
| `loading`          | Page-Mount, Preview-Fetch pending | Skeleton.                                                                      |
| `submitting`       | Klick „Stornierung bestätigen"    | Confirm-Button disabled + Spinner; Abbrechen-Link disabled (`pointer-events: none`, `aria-disabled`). |
| `error-server`     | 5xx beim Submit                   | Banner oben + Retry-Button neben Confirm.                                      |

### Props (für interne Sub-Components)

| Prop              | Typ                                           | Pflicht | Beschreibung                                                |
|-------------------|-----------------------------------------------|---------|-------------------------------------------------------------|
| `bookingId`       | `string`                                      | ja      | Aus URL-Param.                                              |
| `token`           | `string`                                      | ja      | Aus Query-Param `?token=`.                                  |

### Behaviour

- On-Mount: `GET /api/bookings/{bookingId}/public-summary?token={token}` (BESTÄTIGT IT11 durch Tom: kein eigener `cancel-preview`-Endpoint — `public-summary` wird wiederverwendet, weil dieselbe Daten-Shape benötigt wird).
- Bei 200: Render `token-valid`-Layout.
- Bei 410 / 401: Render `<TokenExpiredState>`.
- Bei 404: Render `<TokenExpiredState>` (gleiche UX).
- Bei 200 mit Status `CANCELLED`: Render `already-cancelled`-State.
- Submit: `POST /api/bookings/{bookingId}/cancel` mit Token im Body oder Header.
- Bei Submit-200: State-Wechsel auf `success` (kein Page-Wechsel, In-Place-Render).
- Bei Submit-409: Banner „Diese Buchung wurde inzwischen bereits storniert." + Auto-Wechsel auf `already-cancelled` nach 3 s.
- Bei Submit-5xx: Banner + Retry möglich.
- `beforeunload`-Listener im `submitting`-State warnt vor Tab-Schließen.

### Layout

Siehe `ux-spec.md` IT11-§6.3 (Token-Valid-Layout) und IT11-§6.4 (Erfolgs-Layout).

### Accessibility

- `<main aria-labelledby="cancel-heading">` mit H1 `id="cancel-heading"`.
- Fokus wandert beim Page-Mount auf H1 (`tabIndex={-1}` + `focus()`).
- Confirm-Button bekommt `aria-describedby="cancel-disclaimer"` damit Screen-Reader den Hinweistext liest.
- Erfolgs-State: `role="status"` für die Erfolgs-Bestätigung (Live-Region für Screen-Reader-Announcement).
- Keine Modals, keine Focus-Traps — saubere Page.

### Keyboard

| Key     | Verhalten                                                          |
|---------|--------------------------------------------------------------------|
| Tab     | Standard-Tab-Order: Logo-Link → Zurück-Link → Confirm-Button → Abbrechen-Link |
| Enter / Space | Aktiviert fokussiertes Element                              |

### Microcopy

Siehe `ux-spec.md` IT11-§6.3 + IT11-§6.4.

### Do / Don't

- ✓ Nur als Route mit signed URL-Token, **nicht** als Modal — Page-Wechsel signalisiert Wichtigkeit.
- ✗ NICHT für eingeloggte Kunden — die nutzen `/konto` mit `ConfirmCancelDialog`.
- ✗ NICHT ohne Buchungsdetails — Kunde muss sehen, was er storniert.

---

## 10. `TokenExpiredState` (NEU IT11-Update, Client/Server-agnostisch)

**Datei:** `src/components/ui/TokenExpiredState.tsx`

### Zweck

Wiederverwendbarer Empty-State für abgelaufene oder ungültige signierte Token-Links. Wird genutzt in `CancelOrderPage` (Token abgelaufen, Token ungültig) und `BookingConfirmation` (Token abgelaufen für Bestätigungs-Page nach >30 Tagen). Hat einen `tel:`-CTA als zentrales Recovery-Element — Kunde soll Tom anrufen können, wenn sein Link tot ist.

### Variants

Single-Variant. Title-Text ist über Prop konfigurierbar, Default reicht für beide Use-Cases.

### States

Stateless — pure Presentational Component.

### Props

| Prop          | Typ      | Default                                                                                  | Beschreibung                                              |
|---------------|----------|------------------------------------------------------------------------------------------|-----------------------------------------------------------|
| `title`       | `string` | „Dieser Link ist nicht mehr gültig"                                                      | Override möglich.                                         |
| `description` | `string` | „Bitte rufen Sie uns an, damit wir Ihnen weiterhelfen können."                            | Override möglich.                                         |
| `phoneNumber` | `string` | `'+4915774787512'`                                                                       | E.164-Format für `tel:`-Link.                              |
| `phoneLabel`  | `string` | `'0157 74787512'` (mit non-breaking-space)                                         | Display-Format für sichtbares Label. Kanonisch IT11.       |
| `secondaryHref` | `string` | `'/'`                                                                                  | Sekundär-Link-Ziel.                                       |
| `secondaryLabel` | `string` | „Zur Startseite"                                                                       | Sekundär-Link-Label.                                      |

### Behaviour

Stateless. Klick auf `tel:`-Link öffnet System-Anruf-App (Mobile) bzw. System-Default (Desktop).

### Layout

```
┌────────────────────────────────────────┐
│           [AlertCircle Icon,           │  ← lucide, 64×64, Color baerenstark-bark/40
│            64×64, gedämpft]            │
│                                        │
│   Dieser Link ist nicht mehr gültig    │  ← H2, font-serif, font-bold
│                                        │
│  Bitte rufen Sie uns an, damit wir     │  ← Body, text-baerenstark-bark/70
│  Ihnen weiterhelfen können.            │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  📞  0157 74787512                │  │  ← Primary-CTA: tel:-Link
│  │      (großer Touch-Target)        │  │     (Phone-Icon links, lucide 20 px)
│  └──────────────────────────────────┘  │
│                                        │
│         Zur Startseite →               │  ← Sekundär-Link
└────────────────────────────────────────┘
```

### Accessibility

- `<section role="status" aria-labelledby="token-expired-title">` (kein `alert` — nicht-kritischer Hinweis).
- H2 mit `id="token-expired-title"`.
- Tel-Link: `<a href="tel:+4915774787512" aria-label="Tom anrufen, 0157 74787512">`. Sichtbarer Label-Text nutzt `0157&nbsp;74787512` (non-breaking-space) damit die Nummer in keinem Layout umbricht.
- Touch-Target: min. 44×44 px (WCAG 2.5.5).
- Reduce-Motion: kein Icon-Pulse.

### Keyboard

| Key     | Verhalten                                                  |
|---------|------------------------------------------------------------|
| Tab     | Tel-Link → Sekundär-Link                                   |
| Enter   | Aktiviert fokussierten Link                                |

### Microcopy

Siehe Props-Defaults oben.

### Do / Don't

- ✓ Für jeden abgelaufenen / ungültigen signierten URL-Token.
- ✓ Zentral wiederverwendet (nicht inline duplizieren) — sicherer Single-Point-of-Truth für Toms Telefonnummer.
- ✗ NICHT für reguläre 404 — dafür gibt es die globale 404-Page.
- ✗ NICHT als Toast — der Empty-State braucht Page-Real-Estate, weil der Tel-Link der zentrale Recovery-Pfad ist.

---

## 11. `BookingListItem` (MODIFIZIERT IT11-Update, Client)

**Datei:** `src/components/customer/BookingListItem.tsx` (existiert seit IT8 Kunden-Dashboard)

### Zweck (unverändert)

Ein Eintrag in der Kunden-Anfragen-Liste auf `/konto`. Zeigt Service, Termin, Adresse, Buchungsnummer und Status-Badge.

### Modifikationen IT11-Update

#### A. Stornieren-Button konditional

Neuer sekundärer Button in der Action-Reihe rechts (Desktop) bzw. unten (Mobile):

- Sichtbar nur bei `booking.status` ∈ `{'PENDING' /* "Offen" */, 'CONFIRMED' /* "Bestätigt" */}`.
- **Nicht** sichtbar bei `CANCELLED`, `REJECTED`, `COMPLETED`.
- Variant: **sekundär** (kein Primary-Style — Confirm-Dialog erst ist destruktiv).
- Label: „Stornieren".
- Icon: `XCircle` (lucide, 16 px, links vor Label, `aria-hidden`).
- `aria-label="Anfrage {service} am {datum} stornieren"`.
- `onClick`: öffnet `<ConfirmCancelDialog>` mit pre-filled `detailContent` (Service + Datum + Buchungsnummer).

#### B. Optimistic UI bei Storno-Erfolg

Sobald der `ConfirmCancelDialog` ein 200 OK vom Server bekommt:

- Status-Badge wechselt **sofort** auf „Storniert" (optimistic).
- Stornieren-Button verschwindet (Re-Render basierend auf neuem Status).
- Toast (`success`, 4 s, parent-getriggert): „Auftrag storniert. Sie erhalten in Kürze eine Bestätigung per E-Mail."
- Im Hintergrund: Liste re-fetcht (`SWR.mutate()` o.ä.), um Server-State zu spiegeln. Falls Server-State unerwartet abweicht (z.B. Cache-Mismatch), wird der optimistic Update zurückgerollt.

### Props (Diff zu IT10)

| Prop                | Typ                                  | Default | Pflicht | Beschreibung                                              |
|---------------------|--------------------------------------|---------|---------|-----------------------------------------------------------|
| `onCancel`          | `(bookingId: string) => Promise<void>` | —    | nein    | Callback bei Storno-Bestätigung. Parent ruft API auf. Wenn `undefined`: Stornieren-Button rendert nicht. |
| `cancellableStates` | `BookingStatus[]`                    | `['PENDING', 'CONFIRMED']` | nein | Override falls später andere Stati stornierbar werden. |

### Behaviour

- Stornieren-Button öffnet lokalen `ConfirmCancelDialog`-State.
- Bei Bestätigung: ruft `onCancel(bookingId)` auf.
- Optimistic Update siehe oben.

### Accessibility

- Stornieren-Button: `<button type="button" aria-label="Anfrage {service} am {datum} stornieren">`.
- Tab-Reihenfolge: Details-Link → Stornieren-Button (wenn sichtbar) → nächster Listenpunkt.
- Status-Badge-Änderung wird via Live-Region des Toast-Layers angekündigt (Toast triggert `aria-live="polite"`).

### Microcopy

Siehe `ux-spec.md` IT11-§6.2.

### Do / Don't

- ✓ Stornieren-Button **nur** bei stornierbaren Stati anzeigen.
- ✓ Optimistic Update für sofortiges Feedback.
- ✗ NICHT primary-rot styled — der ConfirmDialog ist der destruktive Schritt, nicht der Listen-Button.
- ✗ NICHT ohne Confirm — direkter API-Call beim Klick wäre destruktiv ohne Sicherheitsnetz.

---

## 12. Komponenten-Coverage IT11 (Story → Komponenten)

| Story        | Komponenten                                                                                        |
|--------------|----------------------------------------------------------------------------------------------------|
| US-IT11-01   | (keine UI-Änderung; verwendet bestehende Toast-Spec)                                                |
| US-IT11-02   | `BookingModal` (modifiziert: Trigger-Sources, optional Slot, Mini-Kalender, **Submit-Block bei Escape/Backdrop**), `BookingModalProvider`-Hook (NEU). Header- und Hero-CTAs auf `useBookingModal().openModal()` umstellen. |
| US-IT11-03   | `Toast` (modifiziert: Microcopy mit tel-Link), `BookingConfirmation` (verfeinert IT11-Update: 30-Tage-Hinweis-Card + Storno-CTA Gast + TokenExpired-Fallback), `BookingForm` (Update: Redirect-Verhalten konsistent zwischen Modal und `/buchen`-Page). |
| US-IT11-04   | `FileUpload` (modifiziert: `disabled`-Prop, Inline-Retry, **MIME-spezifische Limits 10 MB Bilder / 50 MB Videos / 10 MB PDF**), `FileGallery` (NEU, **„neuer Tab"-Vorschau für alle Datei-Typen** statt Lightbox). `LightboxModal` ist **out-of-scope IT11** (IT12-Backlog, Major-06). |
| US-IT11-05   | `PrefillBadge` (NEU), `BookingForm` (Update: prefillCustomer-Banner-States, PrefillBadge-Wiring).            |
| **US-IT11-06** | **`ConfirmCancelDialog` (NEU IT11-Update), `CancelOrderPage` (NEU IT11-Update Layout-Spec), `TokenExpiredState` (NEU IT11-Update — auch in `BookingConfirmation` wiederverwendet), `BookingListItem` (modifiziert IT11-Update: Stornieren-Button konditional + Optimistic UI), `BookingConfirmation` (modifiziert IT11-Update: Storno-CTA für Gäste). Admin: `BookingDetailModal` rendert Cancellation-Info-Block bei Status `CANCELLED`. Status-Badge: `BookingStatusBadge` rendert neuen Token `status-cancelled-*`.** |

---

## 13. Storybook / Visual-QA-Checkliste IT11

| Komponente             | Stories                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------|
| `Toast`                | (bestehend IT10) + neue: success-with-tel-link, error-with-tel-link, message-as-reactnode, warning-file-too-large |
| `BookingConfirmation`  | loading, success-customer, success-guest, not-found, forbidden, error, **token-expired (NEU IT11-Update)**, **success-guest-with-cancel-cta (NEU IT11-Update)** |
| `FileUpload`           | (bestehend IT-US18) + neue: drop-zone-drag-over, drop-zone-drag-rejected, file-uploading-progress, file-error-with-retry, disabled-during-submit, blob-not-configured, **image-too-large-10mb (NEU IT11-Update)**, **video-too-large-50mb (NEU IT11-Update)** |
| `FileGallery`          | loading, empty, populated-1-image, populated-mix-image-video-pdf, error-fetch                  |
| `LightboxModal`        | **OUT-OF-SCOPE IT11 (IT12-Backlog)** — keine Storybook-Stories in IT11.                         |
| `BookingModal` (alias) | desktop-with-mini-calendar, desktop-with-prefilled-slot, mobile-bottom-sheet-with-mini-calendar, success-redirect-flow, **submitting-escape-blocked (NEU IT11-Update)**, **submitting-backdrop-click-blocked (NEU IT11-Update)** |
| `PrefillBadge`         | visible, hidden-after-edit, with-custom-tooltip                                                |
| `ConfirmCancelDialog` (NEU) | idle, submitting-with-spinner, error-with-banner, with-detail-card                       |
| `CancelOrderPage` (NEU) | loading, token-valid, token-expired, token-invalid, already-cancelled, submitting, success, error-server-with-retry |
| `TokenExpiredState` (NEU) | default, custom-title, mobile-large-touch-target                                           |
| `BookingListItem`      | (bestehend) + neue: with-cancel-button-pending, with-cancel-button-confirmed, without-cancel-button-completed, optimistic-cancel-success |

---

## 14. Migration-Hinweis (für Frontend-Engineer)

1. **Schritt 1:** Globaler `BookingModalProvider` in `src/app/layout.tsx` einbauen. Provider hält Modal-State + `defaultService`-State.
2. **Schritt 2:** Alle bisherigen `<Link href="/buchung">Termin buchen</Link>` und `<Link href="/buchen">…</Link>`-Stellen auf `<button onClick={openModal}>` umstellen — außer Server-side rendered SEO-relevant (z.B. Footer-Sitemap-Link).
3. **Schritt 3:** Eingebetteten Slot-Picker auf der Startseite entfernen.
4. **Schritt 4:** `QuickBookingModal` um optionalen Mini-Kalender erweitern (für CTA-getriggerte Modals ohne Slot-Vorauswahl).
5. **Schritt 5:** `/buchung/bestaetigung/[bookingId]/page.tsx` erstellen mit `BookingConfirmation`-Komponente.
6. **Schritt 6:** `BookingForm` Submit-Success-Handler ändern: `router.push('/buchung/bestaetigung/' + bookingId)` statt Inline-Confirmation.
7. **Schritt 7:** `FileUpload` mit `disabled`-Prop + Inline-Retry erweitern.
8. **Schritt 8:** `FileGallery` neu bauen (Klick öffnet Datei in neuem Tab via `<a target="_blank" rel="noopener noreferrer">`), in Admin-Booking-Detail-Page einsetzen. **`LightboxModal` ist out-of-scope IT11 (IT12-Backlog) — nicht implementieren.**
9. **Schritt 9:** `PrefillBadge` neu bauen, in `BookingForm` neben jedem Feld-Label rendern (per `formState.dirtyFields` gesteuert).
10. **Schritt 10:** `Toaster` in Layout prüfen — Persistenz über Page-Wechsel hinweg (für Erfolgs-Toast nach Modal-Close-Redirect).
11. **Schritt 11 (NEU IT11-Update):** `ConfirmCancelDialog` neu bauen, in `BookingListItem` als Modal-Trigger einbinden. Optimistic-Update via SWR `mutate()`.
12. **Schritt 12 (NEU IT11-Update):** Route `/buchung/[id]/stornieren/page.tsx` als Server-Component anlegen, die `<CancelOrderClient>` als interaktiven Inhalt rendert. Token-Validierung server-side für SEO-stabile 410/404-Responses.
13. **Schritt 13 (NEU IT11-Update):** `TokenExpiredState`-Komponente neu bauen. In `BookingConfirmation` (für 30-Tage-abgelaufene Bestätigungs-Token) und `CancelOrderPage` (für Storno-Token) einsetzen.
14. **Schritt 14 (NEU IT11-Update):** `BookingListItem` um Stornieren-Button erweitern (konditional sichtbar). Parent `CustomerBookingsList` muss `onCancel`-Callback bereitstellen.
15. **Schritt 15 (NEU IT11-Update):** `BookingConfirmation` um Token-Hinweis-Card und Storno-CTA erweitern (Gast-Variant).
16. **Schritt 16 (NEU IT11-Update):** Status-Badge `BookingStatusBadge` um neue Variant `cancelled` erweitern (siehe Design-System IT11-D11). `BookingDetailModal` (Admin) um Cancellation-Info-Block ergänzen, sichtbar bei Status `CANCELLED`.
17. **Schritt 17 (NEU IT11-Update):** `QuickBookingModal`-Submit-Block für Escape und Backdrop-Click implementieren. Sichtbarer Hinweistext „Anfrage wird gesendet …" rendern.
18. **Schritt 18 (NEU IT11-Update):** `FileUpload`-Limits MIME-spezifisch konfigurieren (10/50/10 MB). Microcopy in Drop-Zone und Inline-Fehler aktualisieren. Fehler-Toast-Pfad bei Datei-zu-groß ergänzen.

---

## 15. Verbleibende offene Fragen

Siehe `ux-spec.md` IT11-§8. Wichtigste:

**Bestätigt durch Tom (03.05.2026):** Routing `/buchung` ✅, Upload-Limits 10/50/10 MB ✅, Token 30 Tage ✅, Modal-Submit-Escape geblockt ✅.

**Verbleibend:**

- Auto-Backfill Booking → neuer Account nach Gast-Registrierung?
- Profil-Sync-Toast bei Edits (Default: nein)?
- Real-Time-Update Admin-Detail bei Customer-Storno (Default: nein, Tom muss reload)?
- `cancelledBy`-Datenmodell-Bestätigung durch Backend-Engineer/QA.
- Status-Badge-Token für `cancelled`: separat oder Wiederverwendung von `rejected`?
