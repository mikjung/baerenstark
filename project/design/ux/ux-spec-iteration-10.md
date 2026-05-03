# UX-Spezifikation — Iteration 10 (Bärenstark Hausservice)

> **Sprache:** Deutsch (Du-/Sie-Form: durchgängig **Sie**, konsistent zu IT7–IT9-Microcopy).
> **Mobile-first:** Alle Specs werden für 360 px Viewport vorrangig beschrieben, Desktop-Variante zusätzlich.
> **Stack:** Next.js 14 + Tailwind + shadcn/ui (Dialog = Modal). Brand-Tokens `baerenstark-*` (Braun/Beige/Holz, siehe `tailwind.config.ts`).
> **Bezug:** PROJECT.md §Iteration 10, US-IT10-01 bis US-IT10-05. Frontend-Requirements-Datei zum Zeitpunkt dieser Spec noch IT7-Stand — diese Spec füllt die Lücke und gilt für IT10 als Quelle der Wahrheit, bis der Solution Architect die Frontend-Requirements ergänzt.

> **Revision 2026-05-03 — Updates nach QA Design-Review (`QA_DESIGN_REVIEW_IT10.md`):**
> - **STRUCT-3 (Major):** Slot-Konflikt-Error-Mapping aligned mit `ARCHITECTURE_IT10.md` §9.1 — kanonisch `409` + `subcode: 'BOOKING_SLOT_TAKEN'` mit Fallback `code: 'CONFLICT'` + `field: 'date'`. Siehe §1.5 + §4.2 + §5.2 Pkt. 6 + §5.3.
> - **STRUCT-4 (Major):** `QuickBookingModal` enthält Service als **Pflicht-Feld im Body** (Radio-Group / Dropdown), nicht mehr nur Header-Chip. Default-Value via `defaultService`-Prop bei vorausgewähltem Service auf der Page. Siehe §5.2 Pkt. 3 + §5.4 + §5.6 + §5.12.
> - **UX-1 (Minor):** Pagination ergänzt für `/admin/users` (§3.4) und `/konto`-Bookings (§6.4.1) — Mobile „Mehr laden", Desktop „Vor/Zurück".
> - **UX-2 (Minor):** Status-Badge `Abgeschlossen` (`COMPLETED`) als 6. Variante ergänzt — Holz-/Sand-Ton (kein Grün), Doppel-Häkchen-Icon. Siehe §6.6.
> - **PM-2 (Trivial):** Modal-Deep-Linking via URL-Param ist Backlog. Spec enthält keine entsprechende Logik.
> - **PM-3 (Minor):** Storno-Self-Service ist Backlog. Detail-Page §6.8/§6.9 zeigt nur Status, kein Storno-Button.

---

## 1. Globale UX-Konventionen für Iteration 10

Diese Konventionen gelten querschnittlich für alle fünf Stories.

### 1.1 Toast / Snackbar-Pattern (NEU systemisch)

Bisheriges Verhalten in der App: Erfolg- und Fehlermeldungen werden überwiegend als statische `<Banner>`-Komponente (oben in der Page) gerendert. Für IT10 wird ein zusätzliches **Toast-Pattern** spezifiziert (siehe `component-library-iteration-10.md` → `Toast`), weil mehrere Stories (US-IT10-01 Reset-Mail-Erfolg, US-IT10-04 Modal-Erfolg) Feedback **außerhalb** des Form-Kontexts brauchen.

- **Position Mobile (≤640 px):** unten zentriert, `bottom: 16px`, volle Breite minus 16 px Padding links/rechts.
- **Position Desktop:** oben rechts, `top: 24px`, `right: 24px`, `max-width: 420px`.
- **Anzeigedauer:** Erfolg 4 s, Info 5 s, Fehler 6 s, mit Hover-Pause.
- **Dismiss:** automatisch nach Timeout, manuell über Schließen-Icon (`aria-label="Hinweis schließen"`).
- **A11y:** `role="status"` für Erfolg/Info, `role="alert"` für Fehler. `aria-live="polite"` (status) bzw. `aria-live="assertive"` (alert).
- **Reduce-Motion:** Slide-in entfällt, nur Opacity-Fade (Dauer 100 ms).
- **Stacking:** maximal 3 Toasts gleichzeitig, neueste oben (Mobile: oben heißt nahe Bildschirmrand, also unterhalb von älteren).
- **Farben:** semantische Tokens, siehe `design-system-iteration-10-additions.md` (`feedback-success`, `feedback-error`, `feedback-warning`, `feedback-info` — markenkonform aus Braun/Beige-Palette abgeleitet).

### 1.2 Inline-Feldfehler (verbindlich)

Fehlertexte werden **niemals** als generisches „Interner Serverfehler. Bitte später erneut versuchen." angezeigt — auch nicht in Bug-Fallback-Stellen. Stattdessen:

| Situation | Microcopy |
|-----------|-----------|
| Validierungsfehler am Feld | spezifischer Text, z. B. „Bitte geben Sie eine gültige E-Mail-Adresse ein." |
| Server antwortet 4xx mit Fehler-Code | dt. Mapping aus IT7-Tabelle (siehe `frontend-requirements.md` IT7), erweitert um IT10-Codes (siehe Tabelle 1.5) |
| Server antwortet 5xx | „Da ist etwas schiefgegangen. Bitte versuchen Sie es erneut oder rufen Sie uns an: 0157-74787512." (mit klickbarem `tel:`-Link, immer mit Brand-Sprache) |
| Netzwerkfehler / Timeout | „Wir konnten den Server nicht erreichen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut." |

**Regel:** Jede Server-Fehlermeldung enthält entweder eine **konkrete Anleitung** oder eine **konkrete Alternative** (Telefonnummer). Niemals nur „Fehler aufgetreten".

### 1.3 Fokus-Management

- Bei Page-Submit (Reset, Login, Buchung) wandert der Fokus auf den Erfolgs-Banner / die Erfolgs-Karte (`tabIndex={-1}` + `focus()` nach Render).
- Bei Modal-Open (US-IT10-04): Fokus wandert in das **erste interaktive Element** des Modal-Inhalts, **nicht** auf den Schließen-Button (Schließen ist sekundär).
- Bei Modal-Close: Fokus geht zurück zum Auslöser (Slot-Kachel im Kalender).
- Bei Inline-Validierungsfehler: Fokus wandert auf das **erste fehlerhafte Feld** (RHF Standard, beibehalten).

### 1.4 Live-Regions

| Element | aria-live |
|---------|-----------|
| Erfolgs-Toast | `polite` |
| Fehler-Toast | `assertive` |
| Status-Wechsel im Modal („Wird gesendet…") | `polite` |
| Slot-konflikt-Banner im Modal (Race-Condition, US-IT10-04) | `assertive` |

### 1.5 Fehler-Mapping IT10 (Erweiterung der IT7-Tabelle, aligned mit ARCHITECTURE_IT10 §9.1)

> **Aligned mit Architektur-Entscheidung (STRUCT-3):** Backend antwortet auf Slot-Konflikte kanonisch mit `409` + `code: 'CONFLICT'` + **`subcode: 'BOOKING_SLOT_TAKEN'`** + `field: 'date'`. Frontend mapped primär auf `subcode`, Fallback auf `code === 'CONFLICT' && field === 'date'` (defensiv für Endpoints, die den Subcode noch nicht setzen).

| FE-UI-State | Story | Server-Erkennung (status + code/subcode + field) | Deutsche Meldung | UI-Anzeige |
|-------------|-------|---------------------------------------------------|------------------|-----------|
| `token-invalid` | US-IT10-01 | `410` + `code: 'INVALID_OR_EXPIRED_TOKEN'` | „Dieser Reset-Link ist nicht mehr gültig. Bitte fordern Sie einen neuen Link an." | `<TokenInvalidCard />` (siehe IT7) |
| `reset-request-failed` | US-IT10-01 | `5xx` (Fallback-Bucket) | „Wir konnten den Reset-Link gerade nicht senden. Bitte versuchen Sie es in einer Minute erneut." | Toast (Fehler) |
| `validation-error` | US-IT10-03, -04 | `400`/`422` + `code: 'VALIDATION_ERROR'` + `errors[]` mit `field`-Liste | „Einige Angaben sind unvollständig. Bitte prüfen Sie die markierten Felder." | Banner oben im Form + Inline an jedem Feld |
| `slot-taken` | US-IT10-03, -04 | **Primär:** `409` + `subcode: 'BOOKING_SLOT_TAKEN'` (kanonisch IT10, ARCHITECTURE_IT10 §9.1).<br>**Fallback:** `409` + `code: 'CONFLICT'` (oder `'OVERLAP'`) + `field: 'date'`. | „Dieser Termin wurde inzwischen leider von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot." | Banner im Modal/Form mit CTA „Anderen Slot wählen" |
| `booking-submit-failed` | US-IT10-03, -04 | `5xx` (Fallback-Bucket) **oder** `400/409` ohne erkannten `subcode`/`field`/`code` | „Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: 0157-74787512." | Banner unter Submit-Button |
| `admin-users-fetch-failed` | US-IT10-02 | beliebiger Non-2xx-Fehler beim `GET /api/admin/users` | „Die Nutzerliste kann gerade nicht geladen werden. Bitte versuchen Sie es erneut." | Inline im Listen-Container + Retry-Button |

**FE-Mapping-Snippet (verbindlich für Engineer, aligned mit ARCHITECTURE_IT10 §9.1):**

```ts
// in frontend booking-error mapper
function mapBookingError(res: { status: number; code?: string; subcode?: string; field?: string }) {
  // Primary: subcode (kanonisch IT10)
  if (res.status === 409 && res.subcode === 'BOOKING_SLOT_TAKEN') return 'slot-taken';
  // Fallback: code + field (rückwärts-kompatibel, defensiv)
  if (res.status === 409 && (res.code === 'CONFLICT' || res.code === 'OVERLAP') && res.field === 'date') {
    return 'slot-taken';
  }
  if (res.status === 400 || res.status === 422) return 'validation-error';
  return 'booking-submit-failed';
}
```

> **Hinweis Storno (US-IT10-05):** Die Storno-Funktion ist im IT10-Scope **gestrichen** (siehe §6.9 + Backlog). Der Code `BOOKING_CANCEL_FORBIDDEN` wird in IT10 daher nicht im Frontend gerendert.

---

## 2. US-IT10-01 — Passwort-Reset-Mail (Bug-Fix mit UX-Härtung)

### 2.1 Betroffene Pages

- `/konto/passwort-vergessen` (Request-Form)
- `/konto/passwort-zuruecksetzen?token=…` (Set-New-Password-Form)
- `/konto/login` (Erfolgs-Banner nach Reset)

### 2.2 User Flow

1. **Trigger:** Kunde klickt auf `/konto/login` den Link „Passwort vergessen?".
2. **Aktion:** Kunde landet auf `/konto/passwort-vergessen`. Form mit einem Feld („E-Mail-Adresse") + Primary-Button „Link anfordern".
3. **Submit:** Button geht in `loading`-State (Spinner-Icon links, Label „Wird gesendet…", `disabled`). Tab- und Enter-Submit deaktiviert solange der Request läuft.
4. **Antwort 200:** Form wird durch `<ConfirmationCard />` ersetzt (bestehende IT7-Komponente, weiterverwenden). Zusätzlich Toast (Erfolg) **unten am Bildschirm** mit Text „Falls die Adresse registriert ist, ist die E-Mail unterwegs." Toast verschwindet nach 4 s.
5. **Kunde wechselt zu E-Mail-Postfach** → klickt auf den Reset-Link → landet auf `/konto/passwort-zuruecksetzen?token=…`.
6. **Set-New-Password-Form:** zwei Felder (Passwort, Passwort wiederholen) + Submit „Passwort ändern". Live-Validierung (Stärke-Indikator, siehe IT7) + Match-Validierung beim Blur des Bestätigungs-Feldes.
7. **Submit erfolgreich (200):** Redirect auf `/konto/login?reset=success`. Login-Page zeigt grünen Erfolgs-Banner oben: „Passwort erfolgreich geändert. Bitte melden Sie sich an." Banner verschwindet nach 8 s **oder** beim ersten Klick in ein Login-Feld.
8. **Submit-Fehler (410 `INVALID_OR_EXPIRED_TOKEN`):** Form wird durch `<TokenInvalidCard />` ersetzt. CTA-Button „Neuen Reset-Link anfordern" → `/konto/passwort-vergessen`.
9. **Abandonment:** Schließt Kunde den Browser-Tab nach Schritt 4, ist der Token weiterhin 1 h gültig — keine zusätzliche UX nötig.

### 2.3 State-Tabelle: `/konto/passwort-vergessen`

| State | Trigger | Sichtbar | Microcopy / CTAs |
|-------|---------|----------|------------------|
| `idle` | Page-Mount | Form mit E-Mail-Feld, Submit-Button | Header: „Passwort zurücksetzen" / Body: „Geben Sie die E-Mail-Adresse Ihres Kontos ein. Wir schicken Ihnen einen Link zum Zurücksetzen." / Button: „Link anfordern" |
| `loading` | Submit-Klick | Form weiterhin sichtbar, Inputs disabled, Button mit Spinner | Button-Label wechselt auf „Wird gesendet…" |
| `success` | 200-Response | `<ConfirmationCard />` ersetzt Form + Toast | Card-Header: „Bitte prüfen Sie Ihr Postfach" / Card-Body: „Falls **{email}** registriert ist, finden Sie dort einen Link zum Zurücksetzen. Der Link ist 1 Stunde gültig." / Sekundär-Link: „Falscher Tippfehler? Erneut versuchen" |
| `error` (Validierung) | Submit ohne gültige E-Mail | Inline-Fehler unter dem Feld, Button bleibt aktiv | „Bitte geben Sie eine gültige E-Mail-Adresse ein." |
| `error` (RATE_LIMITED) | 429 | Banner oberhalb der Form (rote Akzent-Linie) | „Zu viele Versuche. Bitte versuchen Sie es in einer Stunde erneut oder rufen Sie uns an: 0157-74787512." |
| `error` (RESET_REQUEST_FAILED, 5xx) | 500 | Toast (Fehler) + Banner | „Wir konnten den Reset-Link gerade nicht senden. Bitte versuchen Sie es in einer Minute erneut." |

### 2.4 State-Tabelle: `/konto/passwort-zuruecksetzen?token=…`

| State | Trigger | Sichtbar | Microcopy / CTAs |
|-------|---------|----------|------------------|
| `idle` | Page-Mount mit gültigem Token | Form: zwei Passwort-Felder, Stärke-Indikator, Submit | Header: „Neues Passwort festlegen" / Hinweis: „Das Passwort muss mindestens 8 Zeichen lang sein." / Button: „Passwort ändern" |
| `loading` | Submit-Klick | Inputs disabled, Button mit Spinner | Button: „Wird gespeichert…" |
| `error` (Validierung Match) | Bestätigungs-Passwort weicht ab | Inline am zweiten Feld | „Die Passwörter stimmen nicht überein." |
| `error` (Validierung Länge) | <8 Zeichen | Inline am ersten Feld | „Mindestens 8 Zeichen erforderlich." |
| `error` (Token-fehlt clientseitig) | `?token=` ist leer / fehlt | `<TokenInvalidCard />` statt Form (schon bei Mount) | siehe IT7 |
| `error` (410, Server) | Token abgelaufen / verbraucht | `<TokenInvalidCard />` | „Dieser Link ist nicht mehr gültig. Bitte fordern Sie einen neuen Link an." + Button „Neuen Link anfordern" |
| `success` | 200 | Redirect → `/konto/login?reset=success` | (Banner auf Login-Page, siehe oben) |

### 2.5 Interaction Rules

- **Tab-Order:** E-Mail-Feld → Submit → Sekundär-Link „Zurück zum Login".
- **Enter im Feld:** triggert Submit (Standard-Form-Verhalten).
- **Reset-Page:** Tab-Order: Passwort → Passwort wiederholen → Passwort-Anzeigen-Toggle (falls vorhanden, optional) → Submit.

### 2.6 Responsive

- Mobile (≤640 px): Single-Column, `max-width: 100%`, Padding 16 px, Submit-Button volle Breite, `min-height: 44px`.
- Desktop (≥1024 px): Karten-Layout mittig, `max-width: 28rem` (bestehend, IT7-Konvention).

### 2.7 A11y

- `<form aria-labelledby="reset-heading">`, H1 mit `id="reset-heading"`.
- E-Mail-Feld: `<label for>` + `aria-describedby` zur Hilfe-Note.
- Inline-Fehler: `aria-live="polite"`, `aria-invalid="true"` am Feld bei Fehler.
- `<TokenInvalidCard />`: H1 als `<h1>`, Fokus wandert beim Mount auf die Card.

### 2.8 Microcopy (verbindlich, deutsch)

| Element | Text |
|---------|------|
| H1 Vergessen-Page | „Passwort zurücksetzen" |
| Sub-Text | „Geben Sie die E-Mail-Adresse Ihres Kontos ein. Wir schicken Ihnen einen Link zum Zurücksetzen." |
| Label | „E-Mail-Adresse" |
| Submit-Button (idle) | „Link anfordern" |
| Submit-Button (loading) | „Wird gesendet…" |
| Confirmation-Card-Title | „Bitte prüfen Sie Ihr Postfach" |
| Confirmation-Card-Body | „Falls **{email}** registriert ist, finden Sie dort einen Link zum Zurücksetzen. Der Link ist 1 Stunde gültig." |
| Toast (Erfolg) | „Falls die Adresse registriert ist, ist die E-Mail unterwegs." |
| Sekundär-Link (Confirmation) | „Falscher Tippfehler? Erneut versuchen" |
| H1 Reset-Page | „Neues Passwort festlegen" |
| Submit-Button Reset (idle) | „Passwort ändern" |
| Submit-Button Reset (loading) | „Wird gespeichert…" |
| Login-Erfolgs-Banner | „Passwort erfolgreich geändert. Bitte melden Sie sich an." |
| Token-Invalid-Card-Title | „Dieser Link ist nicht mehr gültig" |
| Token-Invalid-Card-Body | „Reset-Links sind nur 1 Stunde gültig und können nur einmal verwendet werden. Bitte fordern Sie einen neuen Link an." |
| Token-Invalid-CTA | „Neuen Link anfordern" |

---

## 3. US-IT10-02 — Admin-Nutzerliste lädt nicht (Empty/Error-States)

### 3.1 Betroffene Page

- `/admin/users` (Komponente: `UserTable.tsx`)

### 3.2 State-Tabelle: Admin-Nutzerliste

| State | Trigger | Sichtbar | Microcopy / CTAs |
|-------|---------|----------|------------------|
| `idle` / `loading` | Page-Mount, Daten pending | `<Skeleton />` mit 5 Tabellen-Zeilen, Header sichtbar | (kein Text, nur Skeleton) |
| `populated` | API liefert Liste | Tabelle mit Spalten: Name, E-Mail, Telefon, Registriert am, Status | (Spaltenüberschriften, siehe Tabelle 3.3) |
| `empty` | API liefert `[]` | Empty-State-Block mittig in der Tabellen-Region | Headline: „Noch keine Kunden registriert." / Body: „Sobald sich Kunden auf der Seite registrieren, erscheinen sie hier." / Sekundärer Hinweis-Link: „Brauchen Sie Testdaten? → an Entwicklung wenden." |
| `error` (5xx, Timeout, Netzwerk) | API antwortet ≠2xx oder Promise-rejection | Error-Block mittig + sichtbarer Retry | Headline: „Wir konnten die Nutzerliste nicht laden." / Body: „Das passiert manchmal bei einer langsamen Verbindung. Bitte versuchen Sie es erneut." / Primary-Button: „Erneut versuchen" / Sekundär-Link: „Bei wiederholtem Fehler bitte Entwicklung kontaktieren." |
| `partial-error` | Liste lädt, aber einzelne Felder undefined | Zeile mit Platzhalter „—" für fehlende Felder | (kein Banner, nur visueller Platzhalter) |

### 3.3 Spalten der Tabelle (verbindlich)

| Spalte | Mobile (≤640 px) | Desktop |
|--------|------------------|---------|
| Name | sichtbar | sichtbar |
| E-Mail | sichtbar (kleinerer Font) | sichtbar |
| Telefon | versteckt → in Detail-Drawer | sichtbar |
| Registriert am | versteckt → in Detail-Drawer | sichtbar (Format: `12.05.2026`) |
| Status | sichtbar (Badge: aktiv / nicht verifiziert) | sichtbar |

**Verbotene Felder in der UI** (auch wenn Backend sie liefert): `passwordHash`, `adminNote`, `adminRating`. Akzeptanzkriterium aus US-IT10-02.

### 3.4 Pagination (NEU IT10, fix QA-Defekt UX-1)

Backend-Endpoint `GET /api/admin/users` unterstützt bereits `page` + `pageSize` (siehe `contracts/api-routes.md` §22.4). Das Frontend rendert Pagination-Controls — Strategie **mobile-first „Mehr laden", Desktop „Vor/Zurück"**:

| Viewport | Strategie | Verhalten |
|----------|-----------|-----------|
| ≤ 640 px (Mobile) | „Mehr laden"-Button (infinite-scroll-light) | Page-Size 20. Liste startet mit Page 1. Unter der letzten Card: Sekundär-Button „Weitere 20 Kunden laden". Klick → Append nächste Page an die bestehende Liste. Wenn Backend `hasMore: false` liefert: Button durch dezenten Hinweis ersetzen: „Sie sehen alle Kunden." |
| ≥ 641 px (Desktop) | Klassische Page-Buttons | Page-Size 20. Unterhalb der Tabelle, rechtsbündig: `[< Zurück]  Seite {n} von {total}  [Weiter >]`. Buttons disabled bei Rändern. Links daneben unscheinbar: „{from}–{to} von {total} Kunden". |

#### Microcopy

| Element | Text |
|---------|------|
| Mobile-Button (idle, hasMore) | „Weitere 20 Kunden laden" |
| Mobile-Button (loading) | „Wird geladen…" |
| Mobile-Hinweis (Ende erreicht) | „Sie sehen alle Kunden." |
| Desktop-Vor-Button | „Weiter" (mit Chevron-Right-Icon) |
| Desktop-Zurück-Button | „Zurück" (mit Chevron-Left-Icon) |
| Desktop-Range-Hinweis | „{from}–{to} von {total} Kunden" |
| Desktop-Page-Indicator | „Seite {n} von {total}" |
| Empty-Page-State (Page 2+ leer) | „Auf dieser Seite gibt es keine Kunden mehr. → [Zur ersten Seite](?page=1)" |

#### A11y

- Page-Status wird in einer Live-Region angesagt: `<div role="status" aria-live="polite">` enthält den Text „Seite {n} von {total} geladen, {count} Kunden angezeigt." Wird nach jedem erfolgreichen Page-Wechsel aktualisiert.
- Desktop-Pagination-Container: `<nav aria-label="Seiten-Navigation">`.
- Mobile-„Mehr laden": `aria-label="Weitere 20 Kunden in der Liste laden"`. Während Loading: `aria-busy="true"`.
- Fokus nach Page-Wechsel (Desktop): bleibt auf dem Page-Button (kein Sprung). Auf Mobile: bleibt auf dem „Mehr laden"-Button (oder dem Hinweis-Text, falls nun Ende).
- Keyboard: Tab-Reihenfolge schließt die Pagination-Controls als letztes Element der Sektion ein, vor Footer.

#### Empty-Page-State

Wenn der User auf Desktop „Weiter" klickt und die nächste Page leer ist (Daten haben sich zwischen Requests geändert), wird ein Mini-Empty-State innerhalb des Tabellenbereichs gezeigt mit Link „Zur ersten Seite" (`?page=1`). Live-Region kündigt an: „Diese Seite ist leer. Bitte zur ersten Seite zurückkehren."

### 3.5 Interaction Rules

- Klick auf Zeile → öffnet bestehenden `UserDetailDrawer.tsx` (kein Page-Wechsel).
- Retry-Button im Error-State: `aria-label="Nutzerliste erneut laden"`.
- Tastatur: Tab durch Zeilen, Enter öffnet Drawer, Escape im Drawer schließt + Fokus zurück zur Zeile.

### 3.6 A11y

- `<table role="table">` (semantisches Tabellen-Markup, kein div-Soup).
- `aria-busy="true"` während Loading.
- Error-Block: `role="alert"`, Fokus wandert beim Mount auf Headline.
- Empty-State: `role="status"`, kein `alert` (kein Fehlerzustand).

### 3.7 Microcopy

Siehe Tabellen 3.2 + 3.4 oben. Wichtig: **niemals** „Interner Serverfehler" — Akzeptanzkriterium der Story.

---

## 4. US-IT10-03 — Buchungs-POST-Bug + UX-Härtung Buchungsformular

### 4.1 Betroffene Komponenten

- `BookingForm.tsx` (bestehend)
- Identisch verwendet im **Quick-Booking-Modal** (US-IT10-04, siehe §5)

### 4.2 Inline-Fehler-Mapping (verbindlich)

Bisher zeigt das Form bei 5xx ein generisches „Interner Serverfehler". Ab IT10 gilt:

| Server-Antwort | UI-Verhalten |
|----------------|--------------|
| **200** | Erfolg: Redirect zu `/buchung/bestaetigt` (außerhalb Modal) bzw. Modal schließen + Toast (innerhalb Modal, siehe §5) |
| **400 mit `code: 'VALIDATION_ERROR'` + `errors[]`** | Banner oben im Form: „Einige Angaben sind unvollständig. Bitte prüfen Sie die markierten Felder." + jedes Feld in der Felder-Liste bekommt `aria-invalid="true"` und einen feldspezifischen Inline-Text aus der Server-Response (`message`-Property pro Feld, deutsch). Fokus wandert auf das erste fehlerhafte Feld. |
| **409 mit `subcode: 'BOOKING_SLOT_TAKEN'`** (kanonisch IT10 laut `ARCHITECTURE_IT10.md` §9.1; Fallback: `code: 'CONFLICT'`/`'OVERLAP'` + `field: 'date'`; FE-State `slot-taken`) | Banner oben (Warnung-Tone): „Dieser Termin wurde inzwischen leider von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot." + Primary-CTA „Anderen Slot wählen" → scrollt zum Slot-Picker (Form-Fall) bzw. schließt Modal und scrollt zum Kalender (Modal-Fall). |
| **422 mit feldspezifischen Codes** | siehe 400, gleiches Verhalten |
| **429** | Banner: „Zu viele Anfragen in kurzer Zeit. Bitte warten Sie einen Moment und versuchen Sie es erneut." |
| **5xx** | Banner unter Submit: „Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: **0157-74787512**." (Telefonnummer als `tel:`-Link) + Primary-Button bleibt klickbar (Retry = erneuter Submit). |
| **Netzwerk-Timeout** | Banner: „Wir konnten den Server nicht erreichen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut." |

**Regel:** Das Wort „Interner Serverfehler" verschwindet vollständig aus der UI. Wo es noch im Code steht, wird es ersetzt.

### 4.3 Feldspezifische Validierung (Client-side, Zod, vorab)

| Feld | Regel | Inline-Fehler (deutsch) |
|------|-------|-------------------------|
| Name | min. 2, max. 120 | „Bitte geben Sie Ihren vollständigen Namen an." |
| E-Mail | E-Mail-Format | „Bitte geben Sie eine gültige E-Mail-Adresse ein." |
| Telefon | min. 6 Ziffern | „Bitte geben Sie eine gültige Telefonnummer ein (mind. 6 Ziffern)." |
| Straße & Hausnummer | min. 3 | „Bitte geben Sie Straße und Hausnummer an." |
| Postleitzahl | exakt 5 Ziffern | „Eine deutsche Postleitzahl hat genau 5 Ziffern." |
| Ort | min. 2 | „Bitte geben Sie Ihren Wohnort an." |
| Service | required | „Bitte wählen Sie einen Service aus." |
| Datum/Slot | required | „Bitte wählen Sie ein Datum und einen Zeitslot." |
| Beschreibung | max. 2000 | „Maximal 2000 Zeichen." |
| Datenschutz-Checkbox | `true` | „Bitte stimmen Sie der Datenschutzerklärung zu." |

### 4.4 Interaktions-Regeln

- **Validierungs-Timing:** `onBlur` für Einzelfelder, **erneut** `onSubmit` für ganze Form. Keine Validierung `onChange` (zu aggressiv für ältere Kunden).
- **Submit-Button:**
  - `idle`: aktiv, Label „Anfrage absenden".
  - `loading`: disabled, Spinner, Label „Wird gesendet…", Form-Inputs ebenfalls disabled (verhindert Doppel-Submit).
  - `error`: aktiv, Label zurück zu „Anfrage absenden". Server-Banner sichtbar.
- **Reset-Button** (sekundär, Ghost-Style): nur sichtbar im Form-Fall (nicht im Modal). Klick zeigt Confirm-Dialog: „Möchten Sie alle Eingaben verwerfen?" / „Ja, zurücksetzen" / „Abbrechen". (Adressiert Major-Finding aus UX_REVIEW „Mobile-User können versehentlich zurücksetzen".)

### 4.5 A11y

- Banner: `role="alert"` (Server-Fehler) bzw. `role="status"` (Erfolg).
- Inline-Fehler: `aria-invalid="true"` + `aria-describedby="<feld-id>-error"`.
- Submit-Button: `aria-busy="true"` während loading.

---

## 5. US-IT10-04 — Calendar-Quick-Booking-Modal (KERNAUFGABE)

### 5.1 Information Architecture

- **Trigger-Page:** `/buchung` (bestehend, `BookingClient.tsx`).
- **Trigger-Element:** Slot-Kachel in `TimeSlotPicker.tsx` (bestehend).
- **Modal-Komponente (NEU):** `QuickBookingModal` (siehe `component-library-iteration-10.md`), gebaut auf shadcn/ui `Dialog`. Mobile (≤640 px) rendert als **Bottom-Sheet** (full-width, von unten ein), Desktop als zentriertes Modal mit Backdrop.
- **Fallback:** Wenn JavaScript deaktiviert ist, bleibt der bestehende Inline-Form-Pfad in `BookingClient.tsx` aktiv (Akzeptanzkriterium der Story).

### 5.2 User Flow

> **Geändert nach QA STRUCT-4:** Der Service ist ein **Pflicht-Feld im Modal-Body** (Radio-Group / Dropdown), **nicht** mehr nur ein Header-Chip. Damit kann ein Kunde auch dann buchen, wenn er auf den Kalender klickt, ohne vorher einen Service auf der Seite ausgewählt zu haben. Eine bestehende Service-Vorauswahl (z. B. via Service-Karte mit „Diesen Service buchen"-Button oder URL-Param `?service=…`) wird ins Modal als **Default-Value** durchgereicht.

1. **Trigger:** Kunde klickt auf einen verfügbaren Slot in `TimeSlotPicker`. **Keine** Service-Vorauswahl mehr nötig — Slot-Klick öffnet das Modal in jedem Fall.
2. **Aktion:** Statt Smooth-Scroll zur Form-Sektion (bisheriges Verhalten) öffnet das `QuickBookingModal`. Backdrop fade-in (200 ms), Modal slide-up (Mobile) bzw. fade-in (Desktop).
3. **Initialer State:**
   - **Header:** Datum + Zeitfenster als zwei kompakte Chips. Rechts daneben Sekundär-Link „Slot ändern" (schließt Modal, Fokus zurück auf Slot-Picker). Service erscheint **nicht mehr** im Header (siehe §5.6 Field-Order).
   - **Body — erstes Pflicht-Feld:** Service-Auswahl als **Radio-Group** (≤ 4 Services) bzw. **Dropdown** (> 4 Services).
     - **Default-Value-Logik:**
       - Wenn der Kunde vorher einen Service auf der Seite gewählt hat (Service-Karte „Diesen Service buchen" oder URL-Param `?service=…` → Page-State `selectedService`): Service ist **vorausgewählt**, Submit-Button initial aktivierbar.
       - Sonst: **leer**, kein Service vorausgewählt. Hinweis-Text unter der Radio-Group: „Bitte wählen Sie einen Service aus." (neutral, nicht rot — Pflicht-Indikator, kein Validierungsfehler vor dem ersten Submit).
   - **Body — restliche Felder:** Name, E-Mail, Telefon, Straße & Hausnummer, PLZ, Ort, Beschreibung, Datei-Upload optional, Datenschutz-Checkbox. Für eingeloggte Kunden vorausgefüllt (siehe US-IT10-05 §6).
   - **Footer (Modal):** Sekundär-Button „Abbrechen" + Primary-Button „Anfrage absenden". **Submit-Button ist disabled, solange kein Service ausgewählt ist** (zusätzlich zu allen anderen Pflichtfeld-Validierungen).
4. **Pflichtfeld leer + Submit:** Inline-Fehler an betroffenem Feld, Modal bleibt offen, Fokus auf erstes Fehlerfeld, Banner oben im Modal-Body „Bitte prüfen Sie die markierten Felder." (gleiche Logik wie §4).
   - Speziell für Service: Wenn Submit ohne Service versucht wird (Submit ist eigentlich disabled, aber per Tastatur-Enter erzwingbar), wird der Service-Radio-Group-Container rot umrandet, Live-Region kündigt an „Bitte wählen Sie zuerst einen Service.", Fokus springt auf den ersten Radio-Button.
5. **Erfolg (200):**
   - Modal schließt sich (slide-down auf Mobile, fade-out auf Desktop, 200 ms).
   - Toast (Erfolg, unten Mobile / oben rechts Desktop, 5 s): „Anfrage gesendet. Wir melden uns innerhalb von 24 Stunden."
   - Im Kalender wird der gerade gebuchte Slot als „belegt" markiert (`aria-disabled="true"`, gleiches Stylings wie andere belegte Slots).
   - Fokus geht auf den Toast (`role="status"`), nach Toast-Dismiss zurück auf den Kalender-Header.
   - Nach 5 s zusätzlich: kompakter Inline-Confirmation-Block oberhalb des Kalenders mit Link „Zur Bestätigungs-Seite →" (`/buchung/bestaetigt`, optional, kein Auto-Redirect — der Kunde soll sehen, dass der Slot weg ist).
6. **Race-Condition (Slot-belegt, `409` mit `subcode: 'BOOKING_SLOT_TAKEN'`, kanonisch laut `ARCHITECTURE_IT10.md` §9.1; Fallback: `code: 'CONFLICT'` + `field: 'date'`):**
   - Modal bleibt offen.
   - Banner oben im Modal (Warning-Tone): „Dieser Termin wurde inzwischen leider von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot."
   - Primary-Button-Label wechselt zu „Anderen Slot wählen". Klick: schließt Modal, Fokus zurück auf den Slot-Picker, **eingegebene Form-Daten (inkl. Service-Auswahl) bleiben im React-State erhalten** (siehe §5.7), beim erneuten Slot-Klick füllen sich die Felder automatisch wieder.
7. **Schließen ohne Submit:**
   - Klick auf X / Escape / Klick auf Backdrop / Klick auf „Abbrechen".
   - Wenn der Form-State unverändert ist: Modal schließt direkt.
   - Wenn der Kunde mindestens **ein Pflichtfeld berührt** hat (Form ist `dirty`): kleiner inline-Confirm im Modal-Footer „Eingaben verwerfen?" / „Ja, schließen" / „Weiter ausfüllen". Kein zusätzlicher Confirm-Dialog (zu schwergewichtig). State bleibt erhalten, Modal-Reopen füllt Form wieder.
   - Wenn der Kunde explizit „Slot ändern" wählt: Modal schließt ohne Confirm (Slot-Wechsel ist kein Datenverlust).

### 5.3 State-Tabelle: `QuickBookingModal`

| State | Trigger | Sichtbar | Microcopy |
|-------|---------|----------|-----------|
| `closed` | Default | nichts | — |
| `open-idle-no-service` | Slot-Klick **ohne** Service-Vorauswahl im Page-State | Modal mit Header (Slot-Chips), Service-Radio-Group (leer), restliche Form, Submit **disabled** | Header: „Termin anfragen — **{Datum}, {Zeit}**" / Service-Hinweis: „Bitte wählen Sie einen Service aus." / Submit (disabled): „Anfrage absenden" |
| `open-idle-service-prefilled` | Slot-Klick **mit** Service-Vorauswahl (Page-State `selectedService` gesetzt) | Modal mit Header, Service-Radio-Group vorausgewählt, restliche Form, Submit aktivierbar wenn Pflichtfelder ok | Header: „Termin anfragen — **{Datum}, {Zeit}**" / Submit: „Anfrage absenden" |
| `open-loading` | Submit-Klick | Inputs disabled, Submit mit Spinner | Submit: „Wird gesendet…" |
| `open-validation-error` | Pflichtfelder leer (inkl. Service) | Banner oben + Inline-Fehler | Banner: „Bitte prüfen Sie die markierten Felder." / Wenn nur Service fehlt: Live-Region: „Bitte wählen Sie zuerst einen Service." |
| `open-server-error` (5xx) | Server-Fehler | Banner unter Submit + Submit wieder aktiv | Banner: „Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: 0157-74787512." |
| `open-slot-taken` | `409` + `subcode: 'BOOKING_SLOT_TAKEN'` (FE-State `slot-taken`; Fallback `code: 'CONFLICT'` + `field: 'date'`) | Warning-Banner + Submit-Label „Anderen Slot wählen" | Banner: „Dieser Termin wurde inzwischen leider von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot." |
| `closing-success` | 200 | Modal animiert raus | (Toast erscheint nach Animation) |
| `closing-cancel` | Abbrechen / Escape / Backdrop | Modal animiert raus | (kein Toast) |

### 5.4 Modal-Header (Mobile-360 px) — geändert nach QA STRUCT-4

```
┌─────────────────────────────────────────┐
│ Termin anfragen                       X │  ← H2 + Close-Icon (44×44 Tap-Target)
│ Mo, 12. Mai · 09:00 – 11:00              │  ← Datum + Slot
│ ─────────────────────────             ↺  │  ← Sekundär-Link „Slot ändern" rechtsbündig
└─────────────────────────────────────────┘
```

- Titel-H2: `font-serif` (Playfair Display, brand-konform).
- Slot-Info: eine Zeile, kompakt, `text-baerenstark-bark`, lesbar bei kleinem Viewport.
- Service erscheint **nicht** mehr im Header (siehe §5.6 — Service ist Pflicht-Feld im Body).
- „Slot ändern": Text-Link mit Icon (rotierender Pfeil oder Chevron-Left), `min-height: 44px` Tap-Target, `aria-label="Anderen Slot wählen — Modal schließen"`.

### 5.5 Modal-Header (Desktop ≥1024 px)

- Identische Inhalte, aber alles in einer Zeile. Slot-Info als zwei horizontale Chips mit Trennzeichen (Datum · Slot).

### 5.6 Field Order (Mobile-first, eine Spalte) — geändert nach QA STRUCT-4

1. **Service-Auswahl (NEU als erstes Pflicht-Feld)** (`<fieldset>` mit `<legend>` „Welcher Service?")
   1. Service * — Radio-Group bei ≤ 4 Services, Dropdown bei > 4 Services. Default-Value siehe §5.2.
2. **Pflichtfelder-Abschnitt** (`<fieldset>` mit `<legend>` „Ihre Kontaktdaten")
   1. Name *
   2. E-Mail *
   3. Telefon *
3. **Adresse** (`<fieldset>` mit `<legend>` „Wohin sollen wir kommen?")
   1. Straße & Hausnummer *
   2. PLZ *
   3. Ort *
4. **Anfragedetails** (`<fieldset>` mit `<legend>` „Worum geht es?")
   1. Beschreibung (Textarea, optional, max. 2000 Zeichen)
   2. Datei-Upload (optional, max. 5 Dateien, je 5 MB)
5. **Einwilligung**
   1. Datenschutz-Checkbox *

\* = Pflichtfeld, in der UI markiert mit „*" hinter dem Label + globaler Legende oben im Modal: „Mit * markierte Felder sind Pflicht."

#### Service-Feld — Detail-Spec

- **Rendering Radio-Group (≤ 4 Services):** Vertikale Liste, jede Option als Button-ähnliche Card mit `<input type="radio">` (visuell gehidden), Service-Name fett, Dauer + Preis-Anker als Sub-Text, links farbiger Akzentstreifen wenn `checked`.
- **Rendering Dropdown (> 4 Services):** shadcn `Select`, Trigger-Label „Service auswählen…" wenn leer, sonst aktiver Service-Name + Dauer-Sub-Text.
- **Default-Hinweis (kein Service vorausgewählt):** unter dem Feld neutraler Hinweistext „Bitte wählen Sie einen Service aus." in `text-baerenstark-bark/70`. Erscheint **nicht** rot (das wäre erst nach erstem Submit-Versuch ohne Service ein Validierungsfehler).
- **Validierungsfehler (nach Submit-Versuch):** Hinweistext wechselt auf rot (`feedback-error`), Live-Region (`aria-live="assertive"`) sagt „Bitte wählen Sie zuerst einen Service.", Fokus springt auf den ersten Radio-Button (oder Dropdown-Trigger).
- **Service-Wechsel im Modal:** ändert nur die Service-Auswahl. Die Dauer wird **nicht** automatisch angepasst (Dauer wurde mit dem Slot vorausgewählt; Wechsel der Dauer würde den Slot invalidieren). Falls der gewählte Service eine andere Default-Dauer hat als der ursprünglich ausgewählte, erscheint ein dezenter Hinweis: „Hinweis: Dieser Service hat normalerweise {Default-Dauer} — Ihr gewählter Slot deckt {gewählte Dauer} ab. Sie können nach dem Absenden einen anderen Slot wählen, falls nötig." Kein Validierungsfehler, nur Information.

**Datum/Zeit** ist im Header sichtbar, **nicht** als editierbares Feld im Form (Kunde wechselt über „Slot ändern"). Das reduziert Scroll-Höhe und kognitive Last.

### 5.7 Form-State-Persistenz

- `react-hook-form` State lebt im Parent von `QuickBookingModal` (wahrscheinlich `BookingClient.tsx`), **nicht** im Modal selbst.
- Schließen + Wieder-Öffnen rendert den Modal-Inhalt mit `defaultValues = currentFormState`.
- Erfolgreiches Submit setzt den State auf Initial zurück.
- Bei Slot-Wechsel über „Slot ändern": Slot-Felder im Header aktualisieren, alle anderen Felder bleiben erhalten.

### 5.8 Interaction Rules / Keyboard

| Aktion | Verhalten |
|--------|-----------|
| Modal öffnen | Backdrop fade (200 ms), Mobile slide-up (250 ms), Desktop fade (150 ms). Body-Scroll wird gesperrt (`position: fixed` auf `<body>` mit Top-Offset, iOS-safe). |
| Initialer Fokus | Wenn Service **nicht** vorausgewählt: Fokus auf erste Radio-Option (bzw. Dropdown-Trigger). Wenn Service vorausgewählt und alle Kontakt-/Adressfelder leer: Fokus auf „Name". Wenn alles vorausgefüllt: Fokus auf „Beschreibung". |
| Tab-Order | Header-Close-Button → „Slot ändern" → **Service-Radio-Group / -Dropdown (Pflicht-Feld 1)** → Name → E-Mail → Telefon → Straße → PLZ → Ort → Beschreibung → **Datei-Upload-Button** → Datenschutz-Checkbox → Datenschutz-Link (öffnet in neuem Tab) → Abbrechen → Anfrage absenden. |
| Focus-Trap | Tab vom letzten Element zurück zum Close-Button, Shift+Tab vom ersten zurück zum Submit. (shadcn `Dialog` macht das nativ — bestätigen, sonst Fallback einbauen.) |
| Escape | Schließt Modal (siehe §5.2 Schließen-Logik). |
| Klick auf Backdrop | Schließt Modal (gleiche Logik wie Escape). |
| Klick auf X | Schließt Modal. |
| Enter im letzten Feld | Submit. |
| Enter im Textarea | Zeilenumbruch (kein Submit). |

### 5.9 Responsive

| Viewport | Modal-Verhalten |
|----------|-----------------|
| ≤640 px (Mobile) | **Bottom-Sheet:** `position: fixed; bottom: 0; left: 0; right: 0; max-height: 92vh; border-radius: 16px 16px 0 0; overflow-y: auto;`. Header sticky-top innerhalb des Sheets. Footer mit Submit-Button sticky-bottom. Inhalt scrollt zwischen Header und Footer. |
| 641–1023 px (Tablet) | Zentriertes Modal, `width: min(560px, calc(100% - 48px))`, vertikal zentriert, `max-height: calc(100vh - 48px)`, scroll im Inhalt. |
| ≥1024 px (Desktop) | Zentriertes Modal, `width: 640px`, `max-height: 88vh`, scroll im Inhalt. Form 2-spaltig nur für Adress-Felder (Straße/PLZ/Ort): PLZ + Ort in einer Zeile (PLZ schmaler). Andere Felder bleiben 1-spaltig (Lesbarkeit). |

### 5.10 Bottom-Sheet auf Mobile-360 px (verbindliche Detail-Specs)

- **Backdrop:** `rgba(60, 40, 20, 0.55)` (Token `backdrop-default`, siehe Design-System-Additions).
- **Sheet-Animation:** `translateY(100%)` → `translateY(0)`, 250 ms ease-out. Bei `prefers-reduced-motion: reduce` nur Opacity.
- **Sticky-Header (innerhalb Sheet):** white background `baerenstark-cream`, 12 px Padding, Drop-shadow `shadow-soft` beim Scroll.
- **Sticky-Footer:** white background, Border-Top `baerenstark-sand`, Submit-Button volle Breite, 16 px Padding.
- **Drag-Handle (visuell):** kleiner grauer Strich (4 px hoch, 40 px breit, `baerenstark-sand`) zentriert oben im Sheet, rein dekorativ — funktional ist Wischen optional und nicht initial implementiert (KISS).
- **Safe-Area-Inset:** `padding-bottom: env(safe-area-inset-bottom)` am Footer (iPhone-Home-Indicator).

### 5.11 A11y

| Aspekt | Spec |
|--------|------|
| Modal-Role | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="quick-booking-title"`, `aria-describedby="quick-booking-slot-info"`. |
| Title | `<h2 id="quick-booking-title">Termin anfragen</h2>` |
| Slot-Info | `<p id="quick-booking-slot-info">{Datum, Slot, Service}</p>` |
| Close-Button | `aria-label="Modal schließen"`, `<svg aria-hidden="true">`. |
| „Slot ändern" | `aria-label="Anderen Slot wählen"`. |
| Form-Banner (Server-Fehler) | `role="alert"`, `aria-live="assertive"`. |
| Slot-belegt-Banner | identisch + `aria-live="assertive"`. |
| Kontrast | Slot-Chips: `baerenstark-bark` auf `baerenstark-cream` ≈ 11:1 (AAA). Submit-Button: `baerenstark-cream` auf `baerenstark-wood` ≈ 5.4:1 (AA). |
| Touch-Targets | alle Buttons + Felder ≥ 44×44 px. |

### 5.12 Microcopy (verbindlich, deutsch)

| Element | Text |
|---------|------|
| H2 Modal | „Termin anfragen" |
| Slot-Info-Format | „{Wochentag-kurz}, {Tag}. {Monat}. · {Startzeit} – {Endzeit}" (Bsp. „Mo, 12. Mai · 09:00 – 11:00") |
| Service-Option-Format (Radio-Card) | Erste Zeile fett: „{Service-Name}" / Sub-Zeile: „{Dauer} h · ab {Preis} €" |
| Service-Dropdown-Trigger (leer) | „Service auswählen…" |
| Service-Dropdown-Trigger (gewählt) | „{Service-Name} · {Dauer} h" |
| Service-Hinweis (leer, neutral) | „Bitte wählen Sie einen Service aus." |
| Service-Hinweis (nach Submit-Versuch ohne Auswahl) | „Bitte wählen Sie zuerst einen Service." (rot, `feedback-error`) |
| Service-Dauer-Mismatch-Hinweis | „Hinweis: Dieser Service hat normalerweise {Default-Dauer} h — Ihr gewählter Slot deckt {gewählte Dauer} h ab. Sie können nach dem Absenden einen anderen Slot wählen, falls nötig." |
| „Slot ändern"-Link | „Anderen Slot wählen" |
| Pflichtfeld-Legende | „Mit * markierte Felder sind Pflicht." |
| Section-Legend Service | „Welcher Service?" |
| Section-Legend Kontaktdaten | „Ihre Kontaktdaten" |
| Section-Legend Adresse | „Wohin sollen wir kommen?" |
| Section-Legend Anfragedetails | „Worum geht es?" |
| Datenschutz-Label | „Ich habe die [Datenschutzerklärung](/datenschutz) gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung der Anfrage zu. *" |
| Submit (idle) | „Anfrage absenden" |
| Submit (loading) | „Wird gesendet…" |
| Submit (slot-taken) | „Anderen Slot wählen" |
| Sekundär (idle) | „Abbrechen" |
| Confirm-Schließen-Inline | „Eingaben verwerfen?" — Buttons „Ja, schließen" / „Weiter ausfüllen" |
| Erfolgs-Toast | „Anfrage gesendet. Wir melden uns innerhalb von 24 Stunden." |
| Slot-Taken-Banner | „Dieser Termin wurde inzwischen leider von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot." |
| Server-Error-Banner | „Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: 0157-74787512." |
| Validation-Banner | „Bitte prüfen Sie die markierten Felder." |
| Inline-Confirmation-nach-Erfolg | „Anfrage **{Datum}, {Zeit}** ist gesendet. → [Zur Bestätigungs-Seite](/buchung/bestaetigt)" |

---

## 6. US-IT10-05 — Customer-Dashboard Self-Service (KERNAUFGABE)

### 6.1 Information Architecture

- **Bestehender Bereich:** `/konto` (eingeloggte Kunden, gerendert durch `CustomerDashboard.tsx`). Aus US-26/IT4 existiert bereits eine Anfragen-Übersicht; diese Story prüft + ergänzt fehlende Status-Badges, Detail-Anzeige und das Vorausfüllen des Buchungsformulars.
- **Scope-Klarstellung (ARCHITECTURE_IT10 §9.5):** Die Liste zeigt **ausschließlich** Anfragen, die der Kunde **als angemeldeter Kunde** gestellt hat. Vor-Account-Buchungen (Gast-Buchungen mit gleicher E-Mail vor der Registrierung) erscheinen in IT10 **nicht** — bewusste Limitation, Backfill-Mechanismus ist Backlog für IT11. Diese Klarstellung wird auf der Page als kleiner Footnote-Hinweis unterhalb der Liste angezeigt: „Sie sehen Anfragen, die Sie als angemeldeter Kunde gestellt haben."
- **Entscheidung:** Die Übersicht **bleibt** auf `/konto` (NICHT eigene Route `/meine-anfragen`). Begründung: Tom hat im UX_REVIEW die Forderung „Self-Service in einer flachen Hierarchie" gespiegelt; ein zusätzlicher Pfad würde die Information-Architecture aufblähen. `/konto` wird zur Dashboard-Heimat für eingeloggte Kunden.
- **Neue Route:** `/konto/anfragen/[id]` für die Detail-Ansicht einer einzelnen Anfrage (Akzeptanzkriterium aus Story).
- **Neue Komponenten:**
  - `CustomerBookingsList` (ersetzt / erweitert die bestehende Logik in `CustomerDashboard.tsx`).
  - `CustomerBookingDetail` (für `/konto/anfragen/[id]`).
  - `BookingStatusBadge` (siehe Component-Library).
  - `useCustomerProfilePrefill` (Hook, der Profildaten aus `useCustomerSession()` als `defaultValues` für `BookingForm` liefert).

### 6.2 Page Layout: `/konto`

#### Mobile (≤640 px)

```
┌─────────────────────────────────────────┐
│  Header (Bärenstark)                    │
├─────────────────────────────────────────┤
│  Begrüßung „Hallo, Anna!"               │
│  Sub: „Hier sehen Sie Ihre Anfragen."   │
├─────────────────────────────────────────┤
│  [+ Neue Anfrage stellen]    (Primary)  │
├─────────────────────────────────────────┤
│  Filter-Pills: Alle · Offen · Bestätigt │
├─────────────────────────────────────────┤
│  ┌───── Anfrage-Card ─────────┐         │
│  │ [Status-Badge: Offen]      │         │
│  │ Mo, 12.05.2026 · 09:00     │         │
│  │ Reinigung                  │         │
│  │ Erstellt am 03.05.         │         │
│  │ → Details ansehen          │         │
│  └────────────────────────────┘         │
│  ┌───── nächste Card ─────────┐         │
│  ...                                    │
├─────────────────────────────────────────┤
│  Footer: Profil bearbeiten · Abmelden   │
└─────────────────────────────────────────┘
```

#### Desktop (≥1024 px)

- 2-Spalten-Layout: Links sticky sidebar (Profil-Snippet, Quick-Actions: „Neue Anfrage", „Profil", „Abmelden"). Rechts Anfragen-Liste als **Tabelle** mit Spalten: Status, Datum/Zeit, Service, Erstellt, Aktion.

### 6.3 Layout-Entscheidung: Cards (Mobile) vs. Tabelle (Desktop)

| Viewport | Format |
|----------|--------|
| ≤640 px | **Cards** (eine pro Anfrage, 16 px Vertical-Gap) |
| 641–1023 px | **Cards in 2-Spalten-Grid** (Tablet-Optimierung) |
| ≥1024 px | **Tabelle** (5 Spalten: Status, Datum/Zeit, Service, Erstellt, Aktion) |

Begründung: Cards sind auf Mobile mit Daumen besser scanbar; Tabelle ist auf Desktop kompakter und unterstützt Sortier-Aktionen besser.

### 6.4 State-Tabelle: `CustomerBookingsList`

| State | Trigger | Sichtbar | Microcopy |
|-------|---------|----------|-----------|
| `idle` / `loading` | Page-Mount | 3 Skeleton-Cards | (kein Text) |
| `populated` | API liefert ≥1 Anfrage | Cards/Tabelle + Filter-Pills oben + Pagination-Control unten (siehe §6.4.1) | (siehe 6.2) |
| `empty` | API liefert `[]` | Empty-State zentriert | Headline: „Sie haben noch keine Anfragen." / Body: „Buchen Sie Ihren ersten Termin in wenigen Klicks." / Primary-CTA: „Jetzt erste Anfrage stellen" → `/buchung` |
| `empty-filtered` | Liste vorhanden, aber Filter trifft 0 | Empty-State innerhalb des Filter-Bereichs | Headline: „Keine Anfragen mit diesem Status." / Sekundär-Link: „Alle Anfragen anzeigen" |
| `empty-page` | Pagination, Page 2+ leer (Daten haben sich geändert) | Mini-Empty-State im Listen-Container | „Auf dieser Seite gibt es keine Anfragen mehr. → [Zur ersten Seite](?page=1)" |
| `error` | API ≠ 2xx | Error-Block + Retry | Headline: „Wir konnten Ihre Anfragen nicht laden." / Body: „Bitte versuchen Sie es erneut." / Button: „Erneut versuchen" |

### 6.4.1 Pagination (NEU IT10, fix QA-Defekt UX-1)

Backend-Endpoint `GET /api/customer/bookings` liefert in der bestehenden IT4-Version `{ upcoming, past }` ohne Limit. Für IT10 wird Pagination im Frontend ergänzt; falls das Backend ein optionales `limit`/`page`-Param bekommen kann, nutzt das Frontend dieses (siehe Architektur-Doc, Architekt-Entscheidung). Falls Backend unverändert bleibt: clientseitige Pagination über das geladene Array (Page-Size 20, slice).

**Strategie pro Sektion:**

- Die `/konto`-Liste ist bereits semantisch in **„Anstehend"** (`upcoming`) und **„Vergangen"** (`past`) geteilt. Pagination wird **nur auf `past`** angewendet — `upcoming` ist normalerweise klein (selten > 5 offene Termine).
- Filter-Pills filtern über die Vereinigung beider Listen.

| Viewport | Strategie | Verhalten |
|----------|-----------|-----------|
| ≤ 640 px (Mobile) | „Mehr laden"-Button | Page-Size 20. `past`-Liste startet mit den 20 neuesten Anfragen. Unter dem letzten Card: Sekundär-Button „Frühere Anfragen anzeigen". Klick → Append nächste 20. Wenn Ende: dezenter Hinweis „Sie sehen alle Ihre Anfragen." |
| ≥ 641 px (Desktop) | „Vor/Zurück"-Buttons | Page-Size 20. Unterhalb der `past`-Tabelle: `[< Zurück]  Seite {n} von {total}  [Weiter >]`. Buttons disabled bei Rändern. Range-Hinweis: „{from}–{to} von {total} vergangenen Anfragen". |

#### Microcopy

| Element | Text |
|---------|------|
| Mobile-Button (idle) | „Frühere Anfragen anzeigen" |
| Mobile-Button (loading) | „Wird geladen…" |
| Mobile-Hinweis (Ende) | „Sie sehen alle Ihre Anfragen." |
| Desktop-Vor-Button | „Weiter" |
| Desktop-Zurück-Button | „Zurück" |
| Desktop-Range | „{from}–{to} von {total} vergangenen Anfragen" |
| Desktop-Page-Indicator | „Seite {n} von {total}" |
| Empty-Page-State | „Auf dieser Seite gibt es keine Anfragen mehr. → [Zur ersten Seite](?page=1)" |

#### A11y

- Page-Status in Live-Region: `<div role="status" aria-live="polite">` enthält den Text „Seite {n} von {total} geladen, {count} Anfragen angezeigt." Aktualisiert sich nach jedem Page-Wechsel oder „Mehr laden".
- Pagination-Container: `<nav aria-label="Anfragen-Seitennavigation">`.
- Mobile-„Mehr laden": `aria-label="20 frühere Anfragen zusätzlich laden"`. Während Loading: `aria-busy="true"`.
- Fokus-Management: nach „Mehr laden" bleibt der Fokus auf dem Button (oder dem Hinweis-Text bei Ende). Nach Desktop-Page-Wechsel bleibt der Fokus auf dem geklickten Button.
- Reduce-Motion: kein Auto-Scroll zu neuen Cards (auch sonst nicht).

### 6.5 Anfrage-Card (Mobile)

```
┌───────────────────────────────────────┐
│ [● Offen]                             │  ← Status-Badge (Farbe: amber-warm)
│ Mo, 12.05.2026 · 09:00 – 11:00        │  ← bold, primary-text
│ Reinigung · 2 Stunden                 │  ← regular
│ Erstellt am 03.05.2026                │  ← caption, secondary-text
│ ─────────────────────────────────     │
│ [Details ansehen →]    (Ghost-Button) │
└───────────────────────────────────────┘
```

- Klick auf Card oder „Details ansehen" → Navigation zu `/konto/anfragen/[id]`.
- Card-Hover (Desktop): leichter `shadow-card`-Effekt.
- Touch-Target Card: ganze Card ist klickbar (`<a>` als Wrapper), `min-height: 96px`.

### 6.6 Status-Badges (6 Varianten — nach QA UX-2 ergänzt um „Abgeschlossen")

| Status (DE) | Backend-Code | Farbe (Token) | Icon | Verwendung |
|-------------|--------------|---------------|------|------------|
| Offen | `PENDING` | `feedback-warning` (amber-warm, gedämpft) | Clock | Anfrage gestellt, wartet auf Tom |
| Bestätigt | `CONFIRMED` | `feedback-success` (forest-green, brand-konform) | CheckCircle2 | Tom hat bestätigt |
| Abgelehnt | `REJECTED` | `feedback-error` (terracotta, brand-konform) | XCircle | Tom hat abgelehnt |
| Storniert | `CANCELLED` | `baerenstark-sand` (neutral) | Ban | Kunde oder Tom hat storniert |
| Gegenvorschlag | `COUNTER_PROPOSED` | `feedback-info` (blau-grau, brand-konform) | RefreshCw | Tom schlägt anderen Termin vor |
| **Abgeschlossen** (NEU IT10) | `COMPLETED` | `status-completed` — gedämpfter Holz-/Sand-Ton (`baerenstark-wood`-Tint, **nicht** grün — das ist `confirmed`) | CheckCheck (Doppel-Häkchen) | Termin hat stattgefunden, Auftrag erledigt |

Siehe `design-system-iteration-10-additions.md` §1.4 für genaue Farbwerte (Token `status-completed-bg` + `status-completed-fg`). Alle Badges erfüllen WCAG 2.1 AA Kontrast.

**Microcopy „Abgeschlossen":** der sichtbare Text im Badge ist exakt „Abgeschlossen" (ein Wort, Großbuchstabe nur am Anfang). Kein Wechsel auf „Erledigt" o.ä. — Konsistenz mit Backend-Status-Map.

### 6.7 Filter-Pills (über der Liste)

- Pills: „Alle (n)", „Offen (n)", „Bestätigt (n)", „Abgelehnt (n)", „Storniert (n)", „Gegenvorschlag (n)", **„Abgeschlossen (n)"** (NEU IT10).
- Default-Selektion: „Alle".
- ARIA: `role="tablist"`, jede Pill `role="tab"`, `aria-selected="true"` für aktive.
- Mobile: horizontal scroll, kein Wrap (verhindert Layout-Shift). Bei 7 Pills auf 360 px Viewport ist horizontaler Scroll Pflicht — die letzten 1–2 Pills sind angeschnitten und visuell als „weiterscrollen" erkennbar.

### 6.8 Detail-Ansicht: `/konto/anfragen/[id]`

#### Layout

```
┌─────────────────────────────────────────┐
│ ← Zurück zur Übersicht                  │
├─────────────────────────────────────────┤
│ Anfrage vom 03.05.2026                  │
│ [Status-Badge: Offen]                   │
├─────────────────────────────────────────┤
│ Termin                                  │
│ Mo, 12.05.2026 · 09:00 – 11:00          │
│                                         │
│ Service                                 │
│ Reinigung · 2 Stunden                   │
│                                         │
│ Adresse                                 │
│ Musterstraße 12, 64283 Darmstadt        │
│                                         │
│ Beschreibung                            │
│ „Bitte mit Geräten und Reinigungs-…"    │
│                                         │
│ Anhänge                                 │
│ [datei1.jpg] [datei2.pdf]               │
├─────────────────────────────────────────┤
│ Aktionen                                │
│ [Tom anrufen: 0157-74787512]            │
│ [Neue Anfrage stellen →]                │
└─────────────────────────────────────────┘
```

> **Geändert nach QA PM-3 (Storno aus Scope gestrichen):** Die Detail-Seite zeigt **keinen** Storno-Button. Storno-Funktion für bestätigte Anfragen wurde vom Orchestrator als Backlog-Item für IT11 markiert (siehe §8 Backlog). Kunden, die stornieren möchten, sehen den „Tom anrufen"-CTA und können telefonisch um Storno bitten. Der Backend-Endpoint `POST /api/customer/bookings/:id/cancel` (IT4) bleibt funktional, wird aber in IT10 vom Frontend nicht aufgerufen.

#### State-Tabelle

| State | Trigger | Sichtbar | Microcopy |
|-------|---------|----------|-----------|
| `loading` | Page-Mount | Skeleton mit 5 Zeilen | — |
| `populated` | 200 | Detail-Layout (read-only) | siehe oben |
| `not-found` | 404 | Error-Block mit Link zurück | „Diese Anfrage gibt es nicht (mehr)." / Link: „Zur Übersicht →" |
| `forbidden` | 403 (Anfrage gehört anderem Kunden) | Error-Block | „Sie haben keinen Zugriff auf diese Anfrage." / Link: „Zur Übersicht →" |
| `error` | 5xx | Error-Block + Retry | „Wir konnten diese Anfrage gerade nicht laden." / Button: „Erneut versuchen" |

### 6.9 Aktions-Bereich (Backlog: Storno)

Der Aktions-Bereich am Seitenende zeigt in IT10 ausschließlich:

- **„Tom anrufen: 0157-74787512"** — primärer CTA, `tel:`-Link, vollbreiter Button auf Mobile.
- **„Neue Anfrage stellen →"** — Sekundär-Link zu `/buchung` (vor allem nützlich nach „Abgelehnt" oder „Abgeschlossen"-Status).

Kein „Stornieren"-Button. Kein Confirm-Dialog für Storno. Kein 24h-Frist-Hinweis.

> **Backlog-Hinweis (für IT11):** Storno-Self-Service (PM-3 entschieden: out-of-scope IT10). Spec für 24h-Frist + ConfirmDialog wird in IT11-UX-Spec wiederbelebt; Backend-Endpoint und Code-Mapping `BOOKING_CANCEL_FORBIDDEN` existieren bereits.

### 6.10 Teil B: Vorausgefülltes Buchungsformular

Trigger: Kunde ist eingeloggt **und** öffnet `/buchung` (oder das `QuickBookingModal` aus US-IT10-04).

#### State-Tabelle

| State | Trigger | Sichtbar | Microcopy |
|-------|---------|----------|-----------|
| `prefilled-complete` | Profil hat alle Adressfelder | Felder gefüllt (Name, E-Mail, Telefon, Straße, PLZ, Ort), Hinweis-Banner oben | Banner (info-tone, persistent, dismissible): „Wir haben Ihre Daten aus Ihrem Konto vorausgefüllt. Sie können alles für diese Anfrage anpassen — Ihr Profil bleibt unverändert." |
| `prefilled-partial` | Profil ohne Adresse | Name, E-Mail, Telefon gefüllt; Adressfelder leer; zusätzlicher Hinweis | Hinweis-Block oberhalb der Adresse-Section: „Sie haben noch keine Adresse in Ihrem Profil. **[Adresse jetzt im Profil ergänzen →](/konto/profil)** (spart Zeit beim nächsten Mal). Sie können die Adresse aber auch nur für diese Anfrage angeben." |
| `prefilled-empty` (Gast) | nicht eingeloggt | alle Felder leer, kein Hinweis-Banner | (kein Text) |

#### Verhalten

- **Quelle der Daten:** `useCustomerSession()` (bestehend) oder Server-Side via Layout-Loader.
- **Profil-Update-Logik:** Änderungen am Form werden **nur** für die Buchung verwendet. Profil-Daten in `/konto/profil` werden **nicht** überschrieben (Akzeptanzkriterium der Story).
- **Gast-Modus:** Kein Vorausfüllen, kein Hinweis-Banner — Form verhält sich wie bisher.
- **Visuelle Markierung vorausgefüllter Felder:** keine separate Markierung (würde stigmatisieren). Stattdessen einmal sichtbarer Hinweis-Banner oben.

### 6.11 Microcopy (verbindlich, deutsch)

| Element | Text |
|---------|------|
| H1 `/konto` | „Hallo, **{Vorname}**!" |
| Sub-Text | „Hier sehen Sie alle Ihre Anfragen und können neue stellen." |
| Primary-CTA | „Neue Anfrage stellen" |
| Filter-Pills | „Alle ({n})", „Offen ({n})", „Bestätigt ({n})", „Abgelehnt ({n})", „Storniert ({n})", „Gegenvorschlag ({n})", „Abgeschlossen ({n})" |
| Status-Badge-Texte | „Offen", „Bestätigt", „Abgelehnt", „Storniert", „Gegenvorschlag", „Abgeschlossen" |
| Empty-State Headline | „Sie haben noch keine Anfragen." |
| Empty-State Body | „Buchen Sie Ihren ersten Termin in wenigen Klicks." |
| Empty-State CTA | „Jetzt erste Anfrage stellen" |
| Card Datums-Format | „{Wochentag-kurz}, {DD}.{MM}.{YYYY} · {HH:mm} – {HH:mm}" |
| Card Service-Format | „{Service} · {Dauer} h" |
| Card Erstellt-Format | „Erstellt am {DD}.{MM}.{YYYY}" |
| Card-Link | „Details ansehen →" |
| Detail-Page-Title | „Anfrage vom {DD}.{MM}.{YYYY}" |
| Section-Headers (Detail) | „Termin", „Service", „Adresse", „Beschreibung", „Anhänge", „Aktionen" |
| Detail-Action Tom-anrufen | „Tom anrufen: 0157-74787512" |
| Detail-Action Neue-Anfrage | „Neue Anfrage stellen →" |
| Prefill-Banner (komplett) | „Wir haben Ihre Daten aus Ihrem Konto vorausgefüllt. Sie können alles für diese Anfrage anpassen — Ihr Profil bleibt unverändert." |
| Prefill-Hinweis (Adresse fehlt) | „Sie haben noch keine Adresse in Ihrem Profil. **Adresse jetzt im Profil ergänzen →** (spart Zeit beim nächsten Mal). Sie können die Adresse aber auch nur für diese Anfrage angeben." |

### 6.12 A11y

- `/konto` H1 enthält den Vornamen. Live-Region nicht nötig (statisch beim Page-Load).
- Filter-Pills: `role="tablist"`, Tab-Wechsel mit Pfeiltasten (links/rechts).
- Cards: ganze Card als `<a>` mit `aria-label="Details zur Anfrage vom {Datum} ansehen"`.
- Status-Badge: Status-Text ist Text (nicht nur Farbe), Icon `aria-hidden="true"`.
- Detail-Page: `<main>`-Landmark, `<h1>` einzeln.
- Pagination-Live-Region (§6.4.1): `<div role="status" aria-live="polite">` mit Page-Status-Update nach jedem Page-Wechsel oder „Mehr laden". Pagination-Container `<nav aria-label="Anfragen-Seitennavigation">`.
- Storno-Confirm-Dialog: **entfällt in IT10** (PM-3 Backlog).

### 6.13 Responsive

| Viewport | Verhalten |
|----------|-----------|
| ≤640 px | Cards 1-spaltig, Filter-Pills horizontal scroll, Footer-Quick-Actions als Bottom-Bar |
| 641–1023 px | Cards 2-spaltig |
| ≥1024 px | Tabelle, Sidebar links (Profil-Snippet sticky) |

---

## 7. Story-Coverage-Tabelle

| Story | UX-Deliverable |
|-------|---------------|
| US-IT10-01 | §2 — Reset-Request-Page (state table), Reset-Set-Page (state table), Login-Erfolgs-Banner, alle Microcopy DE, Token-Invalid-Card-Verhalten, Toast-Pattern |
| US-IT10-02 | §3 — Empty-State, Error-State (Retry-Button), Spalten-Liste mit Mobile-Responsive-Strategie, Verbots-Liste DTO-Felder, **Pagination Mobile/Desktop (§3.4, NEU IT10)** |
| US-IT10-03 | §4 — Inline-Fehler-Mapping (komplett, an Backend-`CONFLICT`-Code angeglichen), feldspezifische Validierung, Submit-Button-States, Reset-Confirm-Dialog |
| US-IT10-04 | §5 — `QuickBookingModal` komplett (Header, **Service-Pflicht-Feld §5.6 NEU IT10**, Body, Footer, alle States inkl. `open-idle-no-service`, Bottom-Sheet auf Mobile, Race-Condition mit kanonischem `409 CONFLICT`-Mapping, Form-State-Persistenz, A11y, Microcopy) |
| US-IT10-05 | §6 — `/konto` Layout, `CustomerBookingsList`, Detail-Page `/konto/anfragen/[id]` (read-only, kein Storno), `BookingStatusBadge` (**6 Varianten inkl. „Abgeschlossen" §6.6, NEU IT10**), Vorausfüll-Logik (drei Sub-States), Prefill-Banner, **Pagination §6.4.1 (NEU IT10)**, Microcopy |

---

## 8. Offene UX-Fragen / Backlog

### Backlog (vom Orchestrator nach QA-Design-Review IT10 ausgeklammert)

- **Storno-Self-Service** (ehemals offene Frage 1 + QA PM-3): Out-of-Scope IT10. Detail-Page rendert keinen Storno-Button. Backlog für IT11 — Spec wird dort neu aufgesetzt (24h-Frist + ConfirmDialog + Status-Wechsel + Toast).
- **Quick-Booking-Modal Deep-Linking via URL-Param** (ehemals QA PM-2): Out-of-Scope IT10. Modal öffnet sich ausschließlich durch Slot-Klick im Kalender, nicht über `?date=…&time=…`. Backlog für später.

### Verbleibende offene Fragen (für Tom)

1. **Annehmen/Ablehnen eines Gegenvorschlags:** Wenn Tom einen Gegenvorschlag gemacht hat — kann der Kunde diesen direkt aus der Detail-Ansicht annehmen/ablehnen in IT10? Die Story nennt nur „eigene Anfragen einsehen", nicht Annehmen/Ablehnen. Spec klammert das aus IT10 aus — wäre Folgestory.
2. **Profildaten-Sync nach Anfrage:** Wenn Kunde im Buchungsformular eine **andere** Adresse als im Profil eingibt — sollen wir am Ende anbieten „Möchten Sie diese Adresse auch in Ihr Profil übernehmen?" (Optional-Checkbox)? Wäre Conversion-positiv, ist aber aus Story nicht explizit gefordert. Spec lässt es offen → IT11 ggf.
3. **Erfolgs-Toast vs. Bestätigungs-Page:** US-IT10-04 Akzeptanz fordert „Modal schließt + Erfolgsmeldung — kein Seitenwechsel notwendig." Bestehende Bestätigungsseite `/buchung/bestaetigt` ist gut gemacht. Spec entscheidet für **Toast** + optionalen Link auf die Bestätigungsseite. Falls Tom den vollen Vertrauens-Effekt möchte, müssten wir nach Toast-Dismiss automatisch redirecten — bitte bestätigen, ob Toast allein reicht.
4. **Card vs. Tabelle Tablet:** Tablet (641–1023 px) zeigt Cards in 2-Spalten. Falls Tom dort lieber Tabelle hätte (mehr Übersicht für Power-User), bitte Hinweis.
