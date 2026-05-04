# Component-Library — Iteration 12 (Bärenstark Hausservice)

> Sprache: **deutsch**. Stack: Next.js 14 + Tailwind + shadcn/ui. Brand-Tokens `baerenstark-*` aus `tailwind.config.ts`, Feedback-Tokens aus `design-system-iteration-10-additions.md`.
> Diese Datei ergänzt `component-library.md` (IT7) und `component-library-iteration-10.md` (IT10) — **erweitert, ersetzt nicht**.
> Datum: 2026-05-04. Bezug: `ux-spec-iteration-12.md`, PROJECT.md §Iteration 12.
> **Letztes Update:** 2026-05-04 (Phase-2-Revision nach QA — siehe §10 am Ende).

---

## 0. Überblick

| # | Component | Story | Status | Datei (Vorschlag) |
|---|-----------|-------|--------|--------------------|
| 1 | `ServiceDetailHero` | IT12-S02 | NEU | `src/components/services/ServiceDetailHero.tsx` |
| 2 | `BookingCalendarSkeleton` + refined `BookingDayCell` | IT12-S03 | NEU + refined | `src/components/booking/BookingCalendar.tsx` |
| 3 | `CreateAccountOfferSheet` | IT12-S05 | NEU | `src/components/booking/CreateAccountOfferSheet.tsx` |
| 4 | `AuthHeaderSlot` | IT12-S07 | refined | `src/components/layout/AuthHeaderSlot.tsx` |
| 5 | `PrefillNotice` | IT12-S08 | NEU | `src/components/forms/PrefillNotice.tsx` |
| 4.1 | OAuth-Login-Button-Pattern (Admin) | IT12-S01/S07 | NEU dokumentiert | Teil von `src/app/admin/auth/signin/page.tsx` |
| 6 | `MarketingEmailComposer` + Subkomponenten + `UnsubscribePage` | IT12-S15 | NEU | `src/components/admin/marketing/*`, `src/app/marketing/abgemeldet/page.tsx` |
| 7 | `AdminSidebar` (refined) + `AdminBreadcrumb` (NEU) + `AdminWelcomeHintBanner` (NEU) | IT12-S14 | refined + NEU | `src/components/admin/AdminSidebar.tsx`, `AdminBreadcrumb.tsx`, `AdminWelcomeHintBanner.tsx` |
| 8 | `BookingSubmitButton` (refined) | IT12-S11 | refined | `src/components/booking/BookingSubmitButton.tsx` |

---

## 1. `ServiceDetailHero` (NEU)

**Datei:** `src/components/services/ServiceDetailHero.tsx`
**Story:** IT12-S02

### Zweck
Stellt das Service-Foto auf der Service-Detailseite dar. Ersetzt den bisherigen prominenten Icon-Block. Das Icon wird ausgelagert in den Heading-Block (siehe §1.7 unten).

### Variants

| Variant | Trigger | Rendering |
|---------|---------|-----------|
| `with-image` | Bilddatei aus `/public/` existiert | `<Image>` mit `aspect-[4/3]` Mobile / `aspect-[3/2]` Desktop |
| `fallback` | Bilddatei fehlt (`onError` triggert) | Sand-Hintergrund-Block mit großem Lucide-Icon zentriert + Text „Bild folgt in Kürze." |

### Props

| Prop | Typ | Default | Pflicht | Beschreibung |
|------|-----|---------|---------|--------------|
| `serviceSlug` | `string` | — | ja | z. B. `"gruenflaechenpflege"` — wird gegen `serviceImageMap` aufgelöst |
| `serviceName` | `string` | — | ja | für `alt`-Attribut: „{serviceName} — Beispielbild" |
| `fallbackIcon` | `LucideIcon` | — | ja | Fallback-Icon, wenn Bild fehlt |
| `priority` | `boolean` | `true` | nein | LCP-relevant → Next-Image `priority` |

### States

- `loading` (next/image lädt) — Skeleton-Overlay (`bg-sand/40 animate-pulse`).
- `loaded` (Default).
- `error` → switch zu Fallback-Variant.

### Behaviour

- Bei Hover (Desktop, `prefers-reduced-motion: no-preference`): leichtes Skalieren `scale-[1.02]`, 200 ms ease-out.
- Klick: keine Aktion (kein Lightbox in IT12).
- Image-Loader: `next/image`, `quality={85}`, `sizes="(max-width: 1024px) 100vw, 60vw"`.

### Accessibility

- `<img alt="{serviceName} — Beispielbild">` (nicht `alt=""`, da das Bild informationstragend ist).
- Fallback-Variant: `<div role="img" aria-label="{serviceName} — Bild folgt in Kürze">` mit visuellem Icon innen.
- Keine eigene Tab-Stop (Image ist nicht interaktiv).

### Tokens

| Element | Token |
|---------|-------|
| Container Border-Radius | Mobile: `rounded-lg`, Desktop: `rounded-xl` |
| Container Shadow | `shadow-md` |
| Fallback Background | `bg-baerenstark-sand` |
| Fallback Icon Color | `text-baerenstark-bark/40` |
| Fallback Text | `text-sm text-baerenstark-bark/60` |

### Do / Don't

- ✓ Verwenden auf jeder Service-Detailseite (`/services/[slug]` — Phase-2-Revision-korrigiert).
- ✗ Nicht auf der Service-Übersicht `/services` verwenden — dort bleibt der bisherige `ServiceCard` mit Icon-Variante.

---

## 1.7 Service-Heading-Block (refined Layout-Pattern, kein eigener Component)

**Verwendung:** Über `<ServiceDetailHero>` auf `/services/[slug]`.

```tsx
<div className="flex items-center gap-3 sm:gap-4">
  <div className="
    w-8 h-8 sm:w-10 sm:h-10
    rounded-md
    bg-baerenstark-cream
    border border-baerenstark-sand
    flex items-center justify-center
    shrink-0
  ">
    <ServiceIcon className="w-5 h-5 sm:w-6 sm:h-6 text-baerenstark-bark" />
  </div>
  <h1 className="text-2xl sm:text-3xl font-semibold text-baerenstark-bark">
    {serviceName}
  </h1>
</div>
```

**A11y:** Icon hat kein `aria-hidden` nicht nötig — der h1-Text trägt die Information. Icon ist visueller Anker.

---

## 2. `BookingCalendarSkeleton` (NEU) + `BookingDayCell` (refined)

**Datei:** `src/components/booking/BookingCalendar.tsx` (oder Subdatei)
**Story:** IT12-S03

### 2.1 `BookingCalendarSkeleton` — Zweck

Platzhalter-Raster, während Verfügbarkeits-API antwortet. Zeigt 7 Wochentag-Header (echt) + 5 Reihen × 7 Skeleton-Zellen.

### 2.1 Props

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `weeks` | `number` | `5` | Anzahl der Skeleton-Reihen |
| `weekdayLabels` | `string[]` | `['Mo','Di',…,'So']` | Wochentag-Header-Labels (real, nicht skeleton) |

### 2.1 States
Nur ein State: `loading`. Kein `idle`/`error` — bei Error-State wird stattdessen `<BookingCalendarError>` gerendert (Banner).

### 2.1 Behaviour
- Min-Anzeigedauer: 200 ms (bei Cache-Hit; mit `useDelayedFlag(200)` Hook lösen).
- `aria-busy="true"` auf dem Container, `aria-live="polite"`-Region außen mit Text „Verfügbare Termine werden geladen…".

### 2.1 Tokens
- Skeleton-Cell: `bg-baerenstark-sand/30`, `aspect-square`, `rounded-md`, `animate-pulse`.
- Gap zwischen Cells: `gap-1` (4 px).

### 2.1 A11y
- Container `role="grid"`, `aria-busy="true"`, `aria-label="Kalender wird geladen"`.
- Skeleton-Cells haben kein interaktives `role`, sind nicht fokussierbar.

---

### 2.2 `BookingDayCell` — refined

**Datei:** Teil von `BookingCalendar.tsx`.

### 2.2 Props

| Prop | Typ | Default | Pflicht | Beschreibung |
|------|-----|---------|---------|--------------|
| `date` | `Date` | — | ja | Kalendertag |
| `state` | `'available' \| 'unavailable' \| 'past' \| 'today-available' \| 'today-unavailable' \| 'selected'` | — | ja | Kanonischer Zustand |
| `slotsCount` | `number` | `0` | nein | Für ARIA-Label („{n} Termine verfügbar") |
| `onSelect` | `(date: Date) => void` | — | ja | Click-Handler |
| `isInCurrentMonth` | `boolean` | `true` | nein | Nicht-Monat-Tage werden ausgegraut |

### 2.2 States (siehe `ux-spec-iteration-12.md` §3.3.2)

| State | Visual | Interaktiv? |
|-------|--------|-------------|
| `available` | `bg-baerenstark-cream` Text `bark`, Punkt `bg-feedback-success` unten | ja |
| `unavailable` | `bg-baerenstark-sand/15`, Text `bark/30` | nein |
| `past` | wie `unavailable` + diagonal durchgestrichen via `before:`-Pseudo | nein |
| `today-available` | `available` + `border-2 border-baerenstark-bark` | ja |
| `today-unavailable` | `unavailable` + `border-2 border-baerenstark-bark` | nein |
| `selected` | `bg-baerenstark-bark`, Text `cream`, Punkt weiß | ja (Re-Klick = abwählen) |

### 2.2 Behaviour
- Hover (`available`, `today-available`): `bg-baerenstark-sand/60`, `shadow-sm`.
- Focus: `ring-2 ring-baerenstark-bark ring-offset-1`.
- Klick `unavailable`/`past`: keine Aktion, kein State-Change, kein Tooltip-Flicker.
- Tooltip-Anzeige nur on hover für `unavailable`: „Keine Termine verfügbar".

### 2.2 A11y

| Attribut | Wert |
|----------|------|
| `role` | `"button"` (für interaktive States), `"presentation"` (für `unavailable`/`past`) |
| `aria-label` | available: `"{Wochentag}, {Tag} {Monat}, {n} Termine verfügbar"`. unavailable: `"{Wochentag}, {Tag} {Monat}, keine Termine verfügbar"`. past: `"{Wochentag}, {Tag} {Monat}, vergangen"`. selected: `"…, ausgewählt"`. |
| `aria-pressed` | `true` auf `selected`, `false` auf `available` |
| `aria-disabled` | `true` auf `unavailable`/`past` |
| `aria-current="date"` | auf today-Variants |
| `tabindex` | `0` auf interaktiven, `-1` auf nicht-interaktiven |

### 2.2 Keyboard

| Key | Verhalten |
|-----|-----------|
| Enter / Space | Wenn `available`: Auswahl. Wenn `selected`: Abwahl. Sonst: keine Aktion. |
| Arrow Left/Right | Move-Focus zum Vor-/Nach-Tag (überspringt Disabled-Tage NICHT — Sprache-Standard nach W3C-Calendar-Pattern). |
| Arrow Up/Down | Move-Focus zur gleichen Wochentagsspalte vor/nach 7 Tagen. |
| Home / End | Erster / letzter Tag der Woche. |
| Page Up / Page Down | Vor-/nach-Monat. |

### 2.2 Tokens
Alle `bg-*`/`text-*` siehe State-Tabelle. Cell-Größe Mobile: `w-[44px] h-[44px]` (Touch-Target ≥ 44 px Pflicht). Desktop: `w-[48px] h-[48px]`.

### 2.2 Do / Don't
- ✓ Verwenden im Buchungs-Kalender.
- ✗ Nicht im Admin-Kalender (FullCalendar) — dort eigenes Rendering.

---

## 3. `CreateAccountOfferSheet` (NEU)

**Datei:** `src/components/booking/CreateAccountOfferSheet.tsx`
**Story:** IT12-S05

### Zweck
Bietet einem Gast nach erfolgreicher Buchung an, mit den eingegebenen Daten ein Konto zu erstellen. Form-Faktor adaptiv: Inline-Card (Desktop & Mobile-Default), Bottom-Sheet (Mobile, wenn User auf „Konto erstellen" klickt).

### Variants (Phase-2-Revision QA-Mn4 + Stakeholder-Antwort D — vereinfacht)

| Variant | Trigger |
|---------|---------|
| `inline-card` | Default auf der Erfolgsseite (Mobile UND Desktop, kein Bottom-Sheet) |
| `success-card` | Nach erfolgreichem Submit |
| `dismissed-hint` | Nach „Nein, danke" |

> Frühere Variants `mobile-bottom-sheet` und `desktop-inline-expanded` sind entfernt. Card ist immer Embedded. Passwort-Felder sind im Initial-Render sichtbar, kein Akkordeon.

### Props

| Prop | Typ | Default | Pflicht | Beschreibung |
|------|-----|---------|---------|--------------|
| `bookingId` | `string` | — | ja | Booking-ID (aus URL-Param, identifiziert die Buchung serverseitig) |
| `confirmationToken` | `string` | — | ja | JWT aus URL-Param `?token=…` (booking-confirmation-Scope) |
| `displayEmail` | `string` | — | ja | E-Mail aus dem Booking, nur zur Anzeige (Backend liest sie aus dem Token) |
| `displayFirstName` | `string` | — | nein | Vorname aus Booking (für „Hallo {firstName}" o. ä.) |
| `onAccountCreated` | `(result: { customerId, linkedBookingsCount }) => void` | — | nein | Callback nach erfolgreichem Auto-Login (für Toast-Trigger im Parent) |
| `onDismiss` | `() => void` | — | nein | Callback nach „Nein, danke" |

> **Phase-2-Revision (QA-C4/M3):** Props vereinfacht. Backend nutzt `confirmationToken` als Single Source of Truth für E-Mail/Name (kein Trust auf URL-Params, die ein Angreifer manipulieren könnte). Die UI zeigt `displayEmail` nur zur visuellen Bestätigung („wir erstellen ein Konto für tom@example.com").

### States (siehe ux-spec §3.5.4)

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `idle` | Default | Vorteils-Liste + Email (read-only-Anzeige) + 2 Password-Inputs + Buttons |
| `submitting` | Klick „Konto erstellen", Request läuft | Inputs disabled, Button mit Spinner („Konto wird erstellt…") |
| `success` | Server 201 + Auto-Login erfolgreich | Card-Inhalt ersetzt durch grüne Success-Card; Microcopy enthält `linkedBookingsCount` aus Response |
| `account-exists` | Server 409 `ACCOUNT_EXISTS` (Phase-2-Revision QA-C5) | Inline-Banner orange + „Anmelden →"-Button (Link zu `/konto/login?email={email}`) |
| `validation-error` | Pwd zu kurz / mismatch | Inline-Errors am Feld |
| `token-invalid` | Server 401/400 (Token abgelaufen/gefälscht) | Banner: „Dieser Bestätigungs-Link ist nicht mehr gültig. Bitte buchen Sie erneut oder kontaktieren Sie uns." + Versteckt das Form |
| `server-error` | 5xx | Banner unter Button + Retry möglich |
| `dismissed` | Nach „Nein, danke" | Card durch Hint ersetzt |

### Behaviour

- Initial: Card vollständig sichtbar (Vorteile + Email-Anzeige + Passwort-Felder gleichzeitig sichtbar — kein zusätzlicher Klick zum Expandieren, kein Akkordeon, kein Bottom-Sheet).
- Submit-Endpoint (Phase-2-Revision QA-C4): `POST /api/customer/register-from-booking` mit `{ bookingId, confirmationToken, password }`. Backend leitet `email`/`firstName`/`lastName` aus dem Token ab — Frontend sendet sie nicht mit.
- Auto-Login nach Konto-Erstellung: `signIn('credentials', { email: displayEmail, password, redirect: false })` direkt nach 201-Response. (Hinweis: NextAuth-Customer-Setup nutzt Custom-JWT-Cookie — siehe ux-spec §1.3 + ARCHITECTURE_IT12.md §0.4. Auto-Login-Path wird vom Architect bestätigt.)
- Bei Auto-Login-Failure (sehr selten): Card zeigt grünen Hinweis „Konto erstellt. [Bitte einmal anmelden →]" mit Link zu `/konto/login?email={displayEmail}`.
- `sessionStorage`-Flag bei Dismiss: `sessionStorage.setItem('accountPromptDismissed:' + bookingId, '1')` (per-Booking, Phase-2-Revision QA-Mn5).
- Nach erfolgreichem Auto-Login: `emitCustomerChanged()` aus `src/lib/customer-sync.ts` + `router.refresh()` — siehe ux-spec §1.3 (Customer-Sync-Pattern).

### Accessibility

- Card: `<section role="region" aria-labelledby="account-offer-title">` (kein Dialog/Modal — Embedded-Card auf allen Viewports, Phase-2-Revision QA-Mn4).
- `account-exists`-Banner: `role="alert"`, `aria-live="assertive"`.
- `token-invalid`-Banner: `role="alert"`, `aria-live="assertive"`.
- Success-Card: `role="status"`, `aria-live="polite"`, Fokus wandert auf den Link „→ Zu meinen Anfragen" (sofort nach Render).
- Submit-Button-`aria-busy="true"` während `submitting`.

### Keyboard

| Key | Verhalten |
|-----|-----------|
| Tab | Standard-Tab-Order: Passwort → Wiederholung → Konto-erstellen-Button → Nein-danke-Link |
| Enter im Passwort-Feld | Submit (wie üblicher Form-Submit) |

### Microcopy

Siehe `ux-spec-iteration-12.md` §3.5 + §4.

### Tokens

| Element | Token |
|---------|-------|
| Card-Background | `bg-baerenstark-cream` |
| Card-Border | `border border-baerenstark-sand`, `rounded-lg` |
| Card-Padding | `p-5 sm:p-6` |
| Headline | `text-xl font-semibold text-baerenstark-bark` |
| Vorteils-Liste-Bullet | `text-feedback-success` (Häkchen-Icon) |
| Primary-Button | `bg-baerenstark-bark text-cream` (Standard-Primary) |
| Decline-Link | `text-baerenstark-bark/70 underline-offset-2 hover:underline` |
| Success-Card-Background | `bg-feedback-success-bg` |
| Account-Exists-Banner | `bg-feedback-warning-bg`, Border `border-l-4 border-feedback-warning-border` |
| Token-Invalid-Banner | `bg-feedback-error-bg`, Border `border-l-4 border-feedback-error-border` |

### Do / Don't

- ✓ Auf Erfolgs-Page nach Gast-Buchung.
- ✗ Nicht für eingeloggte User rendern.
- ✗ Nicht als sofortiges Pop-up-Modal — Embedded-Card-Pattern bewusst gewählt (siehe ux-spec §3.5.1).

---

## 4. `AuthHeaderSlot` (refined — Phase-2-Revision QA-M4)

**Datei:** `src/components/layout/AuthHeaderSlot.tsx`
**Story:** IT12-S07

### Zweck
Header-Slot, der je nach Auth-State entweder „Anmelden"-Button oder Avatar-Dropdown rendert. Ersetzt aktuell verstreute Auth-Conditional-Logik in der Header-Komponente.

### Wichtig — zwei Auth-Mechanismen

Diese Komponente lebt im **Customer-Bereich** (Public-Layout, `/konto/*`, `/buchung`). Der Customer-Auth-Stack ist ein **Custom JWT-Cookie** (`src/lib/customer-session.ts`), KEIN NextAuth. NextAuth wird ausschließlich für Admin-Auth genutzt (`/admin/*`).

→ `AuthHeaderSlot` ruft **nicht** `useSession()` auf. Stattdessen liest es den Customer-State aus einem eigenen Hook `useCustomerSession()` (oder vergleichbarer Wrapper, siehe ARCHITECTURE_IT12.md §0.4).

### States (siehe ux-spec §3.7.4)

| State | Trigger |
|-------|---------|
| `loading` | Customer-API (`/api/customer/me`) noch nicht aufgelöst |
| `unauthenticated` | `customer === null` |
| `authenticated-customer` | `customer !== null` |
| (Admin-Topbar im Admin-Layout: separate Komponente, siehe §7) |

### Props

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `align` | `'desktop' \| 'mobile'` | (von Parent gesetzt) | Steuert Layout-Variante |
| `initialCustomer` | `Customer \| null` | — | Server-fetched Initial-State (verhindert Flicker zwischen „Anmelden" und Avatar beim Hydrate) |

### Behaviour

- **Verbindlich:** Im SSR muss der Customer-State aus dem Server-Cookie-Read kommen. Das verhindert Flicker zwischen „Anmelden" und Avatar.
- Pattern (Engineer-Hinweis, Phase-2-Revision QA-M4):
  ```tsx
  // src/components/layout/Header.tsx (Server-Component)
  import { readCustomerSession } from '@/lib/customer-session';
  const customer = await readCustomerSession();
  return <AuthHeaderSlot initialCustomer={customer} />;

  // AuthHeaderSlot ('use client')
  const { customer, status } = useCustomerSession(); // hook subscribes to customer-sync EventBus
  const effective = customer ?? props.initialCustomer;
  ```
- Dropdown-Items (Customer): „Mein Konto" → `/konto`, „Profil bearbeiten" → `/konto/profil`, „Abmelden" → `POST /api/customer/logout` + `emitCustomerChanged()` + `router.push('/')`.
- Nach Logout: `emitCustomerChanged()` aus `src/lib/customer-sync.ts` triggert ein Re-Render aller `useCustomerSession()`-Subscriber.
- Nach Profil-Save: Caller ist verantwortlich für `emitCustomerChanged()` + `router.refresh()` (siehe ux-spec §3.7.2).

### „Anmelden"-Button (NEU dokumentiert — Phase-2-Revision QA-M4)

Im Customer-Bereich ist der „Anmelden"-Button ein **einfacher Link** auf `/konto/login` — KEIN POST mit CSRF. Begründung: Customer-Login ist eine eigenständige Page (E-Mail/Passwort-Form mit serverseitiger Validierung), kein NextAuth-OAuth-Flow.

```tsx
<Link href="/konto/login" className="...">Anmelden</Link>
```

→ Kein Side-Effect beim Klick, keine CSRF-Token nötig.

### Accessibility

- Dropdown-Trigger: `<button aria-haspopup="menu" aria-expanded={open} aria-label="Mein Konto-Menü">`.
- Dropdown-Items: `role="menuitem"`, Tab- und Pfeiltasten-Navigation (shadcn `DropdownMenu` macht das nativ).
- Avatar: `<div role="img" aria-label="{firstName} {lastName}">` mit Initialen visuell.
- Loading-State: `aria-busy="true"`, Skeleton.

### Keyboard

| Key | Verhalten |
|-----|-----------|
| Tab | Auf Trigger fokussieren |
| Enter / Space | Dropdown öffnen |
| ArrowDown | Erstes Menüitem |
| Escape | Dropdown schließen, Fokus zurück auf Trigger |

---

## 4.1 Login-Button-Pattern für Admin-OAuth (NEU — Phase-2-Revision QA-M4)

**Kontext:** Im Admin-Login-Bereich (`/admin/auth/signin` o. ä.) gibt es einen „Mit Google anmelden"-Button. Im Gegensatz zum Customer-Anmelden-Link nutzt Admin-Login NextAuth v5.

### Pattern: NICHT ein einfacher Link

Falsch:
```tsx
// ❌ Veraltet / unsicher: einfacher Link auf API-Route
<a href="/api/auth/customer/google">Mit Google anmelden</a>
```

Richtig (NextAuth v5):
```tsx
// ✓ POST mit CSRF via signIn-Helper
'use client';
import { signIn } from 'next-auth/react';

<button
  type="button"
  onClick={() => signIn('google', { callbackUrl: '/admin' })}
  className="..."
>
  <GoogleIcon /> Mit Google anmelden
</button>
```

`signIn('google')` aus `next-auth/react`:
- Holt das CSRF-Token vom Server.
- Macht intern einen POST auf den richtigen NextAuth-Provider-Endpoint.
- Redirected nach Google OAuth-Consent.
- Verhindert CSRF-Attacken (im Gegensatz zu einem nackten Link).

### Component-Spec

**Datei:** Teil von `src/app/admin/auth/signin/page.tsx` (oder zentralem `AdminLoginButton.tsx`).

| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `provider` | `'google'` | `'google'` | NextAuth-Provider-ID |
| `callbackUrl` | `string` | `'/admin'` | Wohin nach erfolgreicher Auth |
| `disabled` | `boolean` | `false` | Während eines anderen In-Flight-Logins |

### States

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `idle` | Default | „Mit Google anmelden" + Google-Icon |
| `submitting` | nach Klick, vor Redirect | Spinner + „Wird umgeleitet…", Button disabled |
| `error` | OAuth-Callback liefert `error`-Query-Param | Banner über Button: „Anmeldung fehlgeschlagen. Bitte erneut versuchen." (siehe ux-spec §3.1) |

### Accessibility

- `<button type="button">` (NICHT `<a>` — kein Link-Verhalten, kein Right-Click-Kontextmenü).
- `aria-label="Mit Google anmelden"` (Icon-only-Variante hätte sonst keinen lesbaren Text).
- `aria-busy="true"` während `submitting`.

### Do / Don't

- ✓ Verwenden für jeden Admin-OAuth-Button (Google, ggf. weitere Provider).
- ✗ Keine `<a href="/api/auth/...">`-Links für OAuth-Initiierung — verletzt CSRF-Schutz und passt nicht zum NextAuth-v5-Flow.
- ✗ Nicht für Customer-Login verwenden — Customer-Login geht über die Custom-Cookie-Route (E-Mail + Passwort), nicht über NextAuth.

---

## 5. `PrefillNotice` (NEU)

**Datei:** `src/components/forms/PrefillNotice.tsx`
**Story:** IT12-S08

### Zweck
Dezenter Hinweis-Block über vorausgefüllten Form-Sections. Kommuniziert dem Nutzer: „Diese Daten kommen aus deinem Profil und können angepasst werden, ohne das Profil zu ändern."

### Props

| Prop | Typ | Default | Pflicht | Beschreibung |
|------|-----|---------|---------|--------------|
| `variant` | `'all' \| 'partial'` | `'all'` | nein | Steuert Microcopy: alle Felder gefüllt vs. nur einige |
| `profileLink` | `string` | `'/konto/profil'` | nein | Link zur Profil-Seite |

### States
Statisch. Kein Loading/Error/Hover (rein informativ).

### Microcopy

| Variant | Text |
|---------|------|
| `all` | „Aus Ihrem Profil übernommen. Sie können die Angaben für diese Anfrage anpassen — Ihr Profil wird dadurch nicht verändert." |
| `partial` | „Einige Daten aus Ihrem Profil übernommen. Bitte ergänzen Sie die fehlenden Felder. Ihr Profil wird dadurch nicht verändert." |

### A11y
- `role="note"` auf Container.
- Icon `aria-hidden="true"` (Text trägt Information).

### Tokens

| Element | Token |
|---------|-------|
| Container-Bg | `bg-baerenstark-cream/50` |
| Container-Padding | `px-3 py-2` |
| Container-Border-Radius | `rounded-md` |
| Text | `text-sm text-baerenstark-bark/70` |
| Icon | Lucide `InfoIcon`, 16 px, `text-baerenstark-bark/50` |

---

## 6. Marketing-E-Mail-Komponenten (NEU — Phase-2-Revision)

**Story:** IT12-S15
**Detail-Spec:** `marketing-email-flow.md`

Dieser Abschnitt listet alle Komponenten als Übersicht; vollständige Details (Wireframes, Microcopy, Edge Cases) sind im Flow-Dokument.

### Backend-SSOT-Endpoints (Phase-2-Revision aligned mit ARCHITECTURE_IT12.md §R.4)

| Endpoint | Verwendet von |
|----------|---------------|
| `GET /api/admin/marketing/recipients?service=&hasBooked=&unsubscribed=&search=&page=&limit=` | `RecipientPicker` (§6.2) |
| `POST /api/admin/marketing/emails` (Body inkl. `status: 'draft' \| 'send'`) | `MarketingEmailComposer` (§6.1) Step 4: erstellt Draft mit `status:'draft'` vor Confirm; `status:'send'` als alternativer Direkt-Pfad |
| `POST /api/admin/marketing/emails/{id}/test-send` | `EmailComposeForm` (§6.3) Test-Button — setzt `status === 'draft'` voraus |
| `POST /api/admin/marketing/emails/{id}/send` | `BulkSendConfirmDialog` (§6.5) Confirm — synchroner Bulk-Send (Hard-Cap 50). Error 413 `RECIPIENT_CAP_EXCEEDED` falls überschritten. |
| `GET /api/admin/marketing/emails?limit=&page=` | `MarketingHistoryList` (§6.8) |
| `GET /api/admin/marketing/emails/{id}` | `SendingProgress` (§6.6) optional polling, `SendReport` (§6.7) bezieht `failedRecipients` |
| `GET /api/customer/unsubscribe?token=…` (public, HMAC-Token, stateless) | E-Mail-Footer-Link, ergibt Result-Page `/marketing/abgemeldet?ok=1` bzw. `?error=invalid` (§6.9) |

### 6.1 `MarketingEmailComposer` (Container, neu)

**Datei:** `src/components/admin/marketing/MarketingEmailComposer.tsx`

Container-Komponente für den End-to-End-Flow: Empfänger-Auswahl → Compose → Vorschau → Versand → Report. Hält den State des Wizards.

#### Props
| Prop | Typ | Beschreibung |
|------|-----|--------------|
| `initialRecipients` | `Customer[]` | Vorausgewählte Customer (z. B. aus Customer-Liste mit aktivem Filter) |
| `availableServices` | `Service[]` | für Filter-Dropdown |
| `onClose` | `() => void` | Wenn der Composer in einem Modal/Drawer lebt |

#### States
- `step: 'recipients' | 'compose' | 'preview' | 'confirm' | 'sending' | 'report'`
- `recipientFilter: { serviceIds: string[], includeUnsubscribed: false }` (Phase-2-Revision: `includeUnsubscribed` ist hardcoded `false`, Toggle nicht aktivierbar in IT12)
- `selectedRecipientIds: Set<string>` (Hard-Cap-Validation: max 50 — Phase-2-Revision Stakeholder-Antwort C)
- `subject: string`, `body: string`
- `compliantConfirmed: boolean` (DSGVO-Pflicht-Checkbox im Confirm-Dialog, Phase-2-Revision Stakeholder-Antwort A)
- `sendResult: { sent: number, failed: { email: string, reason: string }[] }`

#### Hard-Cap-Verhalten (Phase-2-Revision)
- Wenn `selectedRecipientIds.size > 50` im Step `recipients`:
  - Persistente Warnung oben: „⚠ Maximal 50 Empfänger pro Versand. Bitte Selektion einschränken oder in mehreren Wellen senden."
  - Hilfe-Tooltip neben Warnung („?"-Icon): „Limit kommt von unserem aktuellen E-Mail-Anbieter. Wird in einer kommenden Iteration erhöht."
  - „Weiter →"-Button disabled.
- Bei `selectedRecipientIds.size <= 50` im Step `recipients`: normale Wizard-Progression.

#### A11y
- `role="region"`, `aria-labelledby="marketing-composer-title"`.
- Wizard-Steps via `aria-current="step"` markiert.
- Step-Wechsel triggert Live-Region-Announcement: „Schritt {n} von 6: {Name}" (mit DSGVO-Confirm-Step jetzt 6 Steps).
- Hard-Cap-Warnung als `role="alert"` mit `aria-live="assertive"` beim Überschreiten.

### 6.2 `RecipientPicker` (NEU — Phase-2-Revision)

**Datei:** `src/components/admin/marketing/RecipientPicker.tsx`

Tabelle/Liste mit Customer-Daten, Filter-Bar (Service-Multi-Select), Multi-Select-Checkboxes, Header-Checkbox „Alle auswählen". Zeigt explizit den `unsubscribed`-State pro Customer (Phase-2-Revision Stakeholder-Antwort A).

#### Props
| Prop | Typ |
|------|-----|
| `customers` | `Customer[]` (mit `unsubscribed: boolean`-Field) |
| `services` | `Service[]` |
| `selectedIds` | `Set<string>` |
| `onSelectionChange` | `(ids: Set<string>) => void` |
| `onFilterChange` | `(filter: { serviceIds: string[] }) => void` |
| `loading` | `boolean` |
| `maxSelection` | `number` | default `50` (Phase-2-Revision Hard-Cap) |

#### States: `idle`, `loading-filter` (transparente Tabelle + Spinner zentral), `empty-after-filter`, `error`.

#### Verhalten Customer-Zeilen mit `unsubscribed=true` (Phase-2-Revision)
- Standard: Diese Customer werden vom Backend-Endpoint `/api/admin/customers/marketing-list` **ausgeschlossen** (Backend-Filter `unsubscribed=false`). Sie erscheinen also gar nicht in der Tabelle.
- UX-Toggle „Auch Widerspruchskunden anzeigen": permanent **deaktiviert/grau** in IT12. Tom kann darauf hovern → Tooltip: „Widerspruchskunden werden in einer späteren Version anzeigbar (Re-Opt-In-Flow)."
- Falls (in einem späteren Iteration) Widerspruchskunden angezeigt werden:
  - Customer-Zeile ist `aria-disabled="true"`, Checkbox permanent disabled.
  - Visuelle Markierung: `bg-baerenstark-sand/10`, Tag „Abgemeldet" rechts in der Zeile (`text-xs text-bark/60`).
  - Tooltip auf Hover über Zeile: „Dieser Kunde hat widersprochen — kann nicht angeschrieben werden."

#### Hard-Cap-Verhalten (Phase-2-Revision)
- Wenn der User versucht, eine 51. Checkbox zu aktivieren: Klick wird ignoriert, kurzer visueller Shake (250ms) auf der Header-Zeile + Toast „Maximal 50 Empfänger pro Versand."
- Header-Checkbox „Alle auswählen": Wenn die Tabelle > 50 Customer enthält, wählt sie nur die ersten 50 aus (FIFO, sortierung egal — Tom soll bewusst filtern). Header-Tooltip: „Wählt maximal 50 Empfänger aus. Filter erst eingrenzen für gezielte Versendung."

#### A11y
- Tabelle mit `<table role="table">`, Header-Checkbox `aria-label="Bis zu 50 Empfänger auswählen"`.
- Pro Zeile: `<input type="checkbox" aria-label="{Customer-Name} auswählen" aria-disabled={unsubscribed}>`.
- Disabled-Toggle für Widerspruchskunden: `aria-disabled="true"`, Tooltip via `title`.
- Filter: `<fieldset>` mit `<legend>Nach Service filtern</legend>`.

#### Keyboard
- Space toggle Checkbox (außer auf disabled), Tab navigiert durch Zeilen, Shift+Click Range-Selection (Bonus, max 50 wird respektiert).

### 6.3 `EmailComposeForm` (NEU — Phase-2-Revision)

**Datei:** `src/components/admin/marketing/EmailComposeForm.tsx`

Subject + Body-Felder, Charakter-Counter, Test-Send-Button (siehe SSOT-TODO oben), und seit Phase-2-Revision ein **nicht-editierbarer DSGVO-Footer-Block** am Ende des Formulars.

#### Props
| Prop | Typ |
|------|-----|
| `subject` | `string` |
| `body` | `string` |
| `onChange` | `(field: 'subject' \| 'body', value: string) => void` |
| `onTestSend` | `(emailId: string) => void` — sendet `POST /api/admin/marketing/emails/{id}/test-send` an `session.user.email`. Setzt voraus, dass die Mail bereits als Draft (`status === 'draft'`) gespeichert wurde. |
| `draftEmailId` | `string \| null` — UI-State: `null`, solange noch kein Draft im Backend existiert; `string` nach Auto-Save. Test-Button ist disabled, solange `draftEmailId === null`. |
| `testSendAvailable` | `boolean` (default `true`, Architect-SSOT bestätigt) — kann auf `false` gesetzt werden, falls Resend nicht erreichbar (Backend liefert 502). |

#### States: `idle`, `test-sending`, `test-sent` (kurze Erfolgsmeldung neben Button), `test-failed` (Inline-Banner), `validation-error` (leeres Subject oder Body).

#### DSGVO-Footer-Block (NEU — Phase-2-Revision Stakeholder-Antwort A)

Unterhalb des Body-Textareas wird ein nicht-editierbarer Block gerendert, der den Tom zeigt, was am Ende der Mail automatisch angefügt wird:

```tsx
<div
  role="note"
  aria-label="Pflicht-Footer wird automatisch angefügt"
  className="
    mt-4 px-4 py-3
    bg-baerenstark-sand/15
    border-l-4 border-baerenstark-bark/30
    rounded-md
    text-xs text-baerenstark-bark/70
    select-none
  "
>
  <div className="font-semibold mb-1 flex items-center gap-1">
    <LockIcon className="w-3 h-3" /> Pflicht-Footer (wird automatisch angefügt)
  </div>
  <div className="whitespace-pre-line">
    {`Sie erhalten diese E-Mail, weil Sie bereits Kunde bei Bärenstark Hausservice waren. Sie können dem Erhalt weiterer Werbe-E-Mails jederzeit widersprechen: [Hier abmelden](unsubscribe-Link wird pro Empfänger generiert). Impressum: ${impressumUrl}`}
  </div>
</div>
```

- Block ist visuell getrennt vom editierbaren Body durch eine graue Border-Linie und Lock-Icon.
- `select-none` verhindert versehentliches Bearbeiten/Kopieren.
- Tooltip auf den Block (Hover): „Dieser Text wird durch das System ergänzt und kann nicht bearbeitet werden (DSGVO/UWG-Pflicht)."

#### A11y
- `<label for="subject">Betreff</label>`.
- `<textarea aria-describedby="body-helper">` mit Helper-Text „Plain-Text. Persönliche Anrede erfolgt automatisch."
- Char-Counter: `<span aria-live="polite">{n} / 5000 Zeichen</span>` (Limit `5000` — Phase-2-Revision QA-Mn7-Konsistenz; Backend muss auf 5000 angepasst werden).
- Pflicht-Footer-Block: `role="note"`, `aria-label="Pflicht-Footer wird automatisch angefügt"`.
- Test-Send-Button: `disabled={draftEmailId === null || !testSendAvailable}`. Tooltip:
  - `draftEmailId === null`: „Mail wird zunächst als Entwurf gespeichert, dann ist Test-Versand möglich." (Auto-Save kann via Debounce nach Subject+Body-Eingabe oder per expliziter „Als Entwurf speichern"-Aktion erfolgen).
  - `testSendAvailable === false`: „E-Mail-Service nicht erreichbar — bitte später erneut versuchen."

### 6.4 `RecipientPreviewList` (NEU)

**Datei:** `src/components/admin/marketing/RecipientPreviewList.tsx`

Read-only Liste der ausgewählten Empfänger-Emails als Vorschau im Compose-Step.

#### Props
| Prop | Typ |
|------|-----|
| `recipients` | `{ email: string, name: string }[]` |
| `maxVisible` | `number` (default 5) — danach „und weitere {n}" |

#### A11y
- `<ul role="list">`, jede Zeile `<li>`.

### 6.5 `BulkSendConfirmDialog` (NEU — Phase-2-Revision DSGVO)

**Datei:** `src/components/admin/marketing/BulkSendConfirmDialog.tsx`

shadcn-`AlertDialog`-basiert, erscheint immer vor dem finalen Versand. **Pflicht-Checkbox** für UWG §7-Konformität (Phase-2-Revision Stakeholder-Antwort A).

#### Props
| Prop | Typ |
|------|-----|
| `recipientCount` | `number` (≤ 50, da Hard-Cap im Step 1 greift) |
| `subject` | `string` |
| `onConfirm` | `() => void` |
| `onCancel` | `() => void` |

#### Microcopy (Phase-2-Revision)

> **Hinweis:** Die alte > 50-Variante entfällt — der Hard-Cap im Step 1 verhindert, dass jemals > 50 in diesen Dialog kommen.

| Slot | Text |
|------|------|
| Headline | „Sie werden eine Werbe-E-Mail an {n} Empfänger senden." |
| Body (Absatz 1) | „Bitte bestätigen Sie, dass diese Empfänger Bestandskunden sind und nicht widersprochen haben." |
| Body (Absatz 2, kleingedruckt) | „Betreff: „{subject}". Diese Aktion kann nicht rückgängig gemacht werden." |
| Pflicht-Checkbox-Label | „Ich bestätige, dass alle ausgewählten Empfänger Bestandskunden im Sinne von § 7 UWG sind." |
| Cancel-Button | „Abbrechen" |
| Confirm-Button | „Senden" — disabled, solange Checkbox nicht aktiviert |

#### Verhalten

- Initial: Checkbox unchecked, „Senden"-Button disabled.
- User aktiviert Checkbox → „Senden"-Button enabled.
- Initial-Fokus auf „Abbrechen" (sicherer Default).
- Tab-Reihenfolge: Checkbox → Abbrechen → Senden.

#### A11y
- shadcn-AlertDialog: `role="alertdialog"`, `aria-labelledby` + `aria-describedby` automatisch.
- Pflicht-Checkbox: `<input type="checkbox" required aria-required="true">`. Submit-Button hat `aria-disabled={!compliantConfirmed}`.
- Screenreader-Announcement nach Checkbox-Aktivierung: „Senden-Button wurde aktiviert".

#### Tokens
- Checkbox-Container: `bg-baerenstark-sand/20`, `rounded-md`, `px-3 py-2`, `border border-baerenstark-sand`.
- Confirm-Button: `bg-baerenstark-bark text-cream`. Disabled-State: `opacity-50 cursor-not-allowed`.

### 6.6 `SendingProgress` (NEU)

**Datei:** `src/components/admin/marketing/SendingProgress.tsx`

Zeigt während des Versands den Fortschritt: „{sent} / {total} versandt".

#### Props
| Prop | Typ |
|------|-----|
| `total` | `number` |
| `sent` | `number` |
| `failed` | `number` |

#### A11y
- `<progress max={total} value={sent}>`.
- Live-Region: `aria-live="polite"` mit „{sent} von {total} E-Mails versandt".

### 6.7 `SendReport` (NEU)

**Datei:** `src/components/admin/marketing/SendReport.tsx`

Abschluss-Card nach Versand. Zeigt erfolgs/fail Statistik + Liste der fehlgeschlagenen E-Mails.

#### Props
| Prop | Typ |
|------|-----|
| `result` | `{ sent: number, failed: { email: string, reason: string }[] }` |
| `onClose` | `() => void` |
| `onSendAnother` | `() => void` |

#### States: `success-only` (alle versendet), `partial-failure`, `total-failure`.

#### A11y
- Headline + `role="status"` für `success-only`.
- Headline + `role="alert"` für `partial-failure`/`total-failure`.

### 6.8 `MarketingHistoryList` (NEU, Should-Have)

**Datei:** `src/components/admin/marketing/MarketingHistoryList.tsx`

Liste vergangener Marketing-Mails (auf Sub-Page `/admin/users/marketing/history`).

> **Hinweis:** Dies ist ein Should-Have für IT12. Falls Backend keine History-Persistenz in IT12 liefert, Component-Stub mit Empty-State „Versand-Historie kommt in einer späteren Version." rendern. Im Zweifel mit dem Solution Architect klären.

### 6.9 `UnsubscribePage` (NEU — Phase-2-Revision DSGVO)

**Datei:** `src/app/marketing/abgemeldet/page.tsx` (Server-Component — liest Query-Param `?ok=1` oder `?error=invalid`)
**Route:** `/marketing/abgemeldet?ok=1` (Erfolg) bzw. `/marketing/abgemeldet?error=invalid` (Token ungültig). Result-Page wird vom Backend-Endpoint `GET /api/customer/unsubscribe?token=…` per 302-Redirect angesteuert (Architect-SSOT §R.4 Endpoint #11).

#### Zweck
Public-Page (kein Auth) für Empfänger, die sich aus dem Marketing-Verteiler abmelden möchten. Wird per Link aus der Mail aufgerufen.

#### Variants
| Variant | Trigger |
|---------|---------|
| `success` | Query `?ok=1` (Backend hat `CustomerUser.unsubscribedAt` gesetzt) |
| `error-invalid` | Query `?error=invalid` (HMAC-Token-Verify fehlgeschlagen) |
| `error-server` | Query enthält weder `ok=1` noch `error=invalid` (Edge-Case) — als Fallback wie `error-invalid` rendern |

#### Layout (Mobile-first)
- Mini-Header: Bärenstark-Logo (klein, 32px), kein voller Site-Header.
- Main-Card zentriert, max-width 480px, padding 24px.
- Footer mit Impressum-Link + Datenschutz-Link.

#### Microcopy (siehe ux-spec §3.15.2)
- Success-Headline: „Sie wurden erfolgreich abgemeldet."
- Success-Body (zwei Absätze): „Sie erhalten keine weiteren Werbe-E-Mails von uns. Buchungs- und Service-bezogene E-Mails (Bestätigungen, Erinnerungen zu aktiven Aufträgen) werden weiter zugestellt."
- Success-CTA: „[Zur Startseite →]"
- Error-Invalid-Headline: „Link ungültig oder abgelaufen."
- Error-Invalid-Body: „Falls Sie sich abmelden möchten, antworten Sie bitte direkt auf eine unserer E-Mails — wir kümmern uns dann manuell darum."
- Error-Server-Body: „Aktion konnte nicht durchgeführt werden. Bitte später erneut versuchen oder antworten Sie auf eine unserer E-Mails."

#### Verhalten
- Re-Subscribe ist in IT12 **nicht** möglich (entspricht UWG-Praxis: Re-Opt-In nötig, kommt in IT13).
- Klick auf „Zur Startseite": Redirect auf `/`.
- Page hat keinen Logout-/Login-Bezug; auch wenn der Empfänger gleichzeitig eingeloggter Customer ist, bleibt sein Customer-Cookie unangerührt.
- Page liest Query-Params `?ok=1` / `?error=invalid` und rendert die entsprechende Variant. Der eigentliche DB-Update wird vom Backend-Endpoint `GET /api/customer/unsubscribe?token=…` ausgeführt; diese Page ist nur die Result-Anzeige nach dem 302-Redirect.

#### A11y
- Page-`<title>`: „Abmeldung — Bärenstark Hausservice".
- `<main role="main" aria-labelledby="unsubscribe-title">`.
- Success: `<div role="status" aria-live="polite">` umschließt die Headline + Body.
- Error: `<div role="alert" aria-live="assertive">`.
- Lang-Attribut auf `<html lang="de">`.
- Alle Texte auf Deutsch (kein i18n in IT12).

#### Tokens
| Element | Token |
|---------|-------|
| Card-Background | `bg-baerenstark-cream` |
| Card-Border | `border border-baerenstark-sand`, `rounded-lg`, `shadow-md` |
| Success-Icon | Lucide `CheckCircle2`, 48px, `text-feedback-success` |
| Error-Icon | Lucide `AlertCircle`, 48px, `text-feedback-warning` (für `error-invalid`) bzw. `text-feedback-error` (für `error-server`) |
| Headline | `text-2xl font-semibold text-baerenstark-bark` |
| Body | `text-base text-baerenstark-bark/80` |
| CTA-Link-Button | `bg-baerenstark-bark text-cream`, Standard-Primary |

#### Do / Don't
- ✓ Public, kein Auth-Check.
- ✓ Token-Validierung passiert im Backend-Endpoint `/api/marketing/unsubscribe?token=…`; die Page selbst rendert nur das Ergebnis.
- ✗ Keine Re-Subscribe-Option in IT12.
- ✗ Kein Tracking, keine Analytics (Page ist Compliance-pur).

---

## 7. `AdminSidebar` (refined) + `AdminBreadcrumb` (NEU) + `AdminTabBar` (NEU für Mobile)

**Datei:** `src/components/admin/AdminSidebar.tsx` (refined), `AdminBreadcrumb.tsx` (NEU), `AdminTabBar.tsx` (NEU)
**Story:** IT12-S14
**Detail-Spec:** `admin-information-architecture.md`

### 7.1 `AdminSidebar` (Desktop)

#### Variants
| Variant | Trigger |
|---------|---------|
| `expanded` | Default Desktop ≥ 1024 px |
| `collapsed` | User hat Sidebar via Toggle eingeklappt |

#### Props
| Prop | Typ | Beschreibung |
|------|-----|--------------|
| `currentPath` | `string` | aus `usePathname()` für Active-Highlighting |
| `userRole` | `'ADMIN' \| 'SUPER_ADMIN'` | für conditional Items (Admin-Verwaltung nur SUPER_ADMIN) |

#### Structure
Drei Top-Level-Gruppen (siehe IA-Doc):
1. **Kalender & Zeitmanagement** (Icon: `Calendar`)
   - Übersicht (`/admin/calendar`)
   - Buchungsanfragen (`/admin/bookings`)
   - Zeitfenster (`/admin/slots`)
   - Verfügbarkeit (`/admin/calendar/availability`)
2. **Nutzerverwaltung** (Icon: `Users`)
   - Kunden (`/admin/users`)
   - Admins (`/admin/admins`) — nur SUPER_ADMIN
3. **Auswertungen** (Icon: `BarChart3`)
   - Analytics (`/admin/analytics`)
   - Bewertungen (`/admin/reviews`)

Plus: „Dashboard" als oberste Single-Sektion (`/admin`) ohne Gruppe.

#### States: `expanded` (default), `collapsed` (icons-only), `hovered-collapsed-section` (Tooltip mit Section-Name).

#### Behaviour
- Aktive Top-Level-Gruppe: Header `bg-baerenstark-bark/10`, Border-Left `border-l-4 border-baerenstark-bark`.
- Aktive Subsektion: zusätzlicher inset-Marker (`pl-6 bg-baerenstark-cream/40`).
- Toggle Collapse: persistiert in `localStorage` (`'admin-sidebar-collapsed'`).
- Auf < 1024 px wird Sidebar nicht gerendert; stattdessen `AdminTabBar` (siehe §7.3) am unteren Bildschirmrand.

#### A11y
- `<nav aria-label="Admin-Navigation">`.
- Gruppen als `<ul role="group" aria-labelledby="group-{name}-heading">`.
- Aktive Items mit `aria-current="page"`.
- Collapse-Toggle: `<button aria-expanded={!collapsed} aria-label="Sidebar einklappen">`.

#### Keyboard
- Tab durch alle Items, Enter aktiviert Link.
- ArrowUp/Down innerhalb einer Gruppe.

### 7.2 `AdminBreadcrumb` (NEU)

**Datei:** `src/components/admin/AdminBreadcrumb.tsx`

Sichtbar **oberhalb** des Page-Contents auf jeder Admin-Page. Zeigt: „Admin / {Gruppe} / {Page}".

#### Props
| Prop | Typ |
|------|-----|
| `items` | `{ label: string, href?: string }[]` |

#### A11y
- `<nav aria-label="Brotkrumen">`.
- `<ol>`, jede Item `<li>`. Letztes Item ohne `<a>`, mit `aria-current="page"`.
- Trenner `/` mit `aria-hidden="true"`.

### 7.3 `AdminTabBar` (NEU, Mobile)

**Datei:** `src/components/admin/AdminTabBar.tsx`
**Sichtbar:** ≤ 1024 px (statt Sidebar).

Bottom-Tab-Bar mit 4 Tabs:
1. Dashboard (Home-Icon)
2. Kalender (Calendar-Icon)
3. Nutzer (Users-Icon)
4. Auswertungen (BarChart-Icon)

Klick auf Tab führt zur **Gruppen-Übersicht** (z. B. `/admin/calendar`); Sub-Items werden in der Gruppen-Übersicht als Cards/Tabs gezeigt (siehe IA-Spec).

#### A11y
- `<nav aria-label="Admin-Navigation" role="tablist">`.
- Aktiver Tab `aria-selected="true"`.
- Mind. 44 px Touch-Target.

#### Tokens
- Höhe: `h-14` (56 px).
- Background: `bg-baerenstark-cream`, Border-Top `border-t border-baerenstark-sand`.
- Active-Tab-Indicator: Top-Border `border-t-2 border-baerenstark-bark`.

### 7.4 `AdminWelcomeHintBanner` (NEU — Phase-2-Revision)

**Datei:** `src/components/admin/AdminWelcomeHintBanner.tsx`
**Story:** IT12-S14
**Detail-Spec:** `admin-information-architecture.md` §6.1

#### Zweck
Einmalige Hinweis-Banner für Tom nach IT12-Deploy: erklärt die neue Admin-Navigation (Gruppen statt flache Liste). Dismissible.

#### Props
| Prop | Typ | Default | Beschreibung |
|------|-----|---------|--------------|
| `onDismiss` | `() => void` | — | Callback bei „Verstanden"-Klick |

#### Persistenz (Phase-2-Revision QA-Mn8 / Stakeholder-Antwort)
- **localStorage** (nicht DB) — entschieden für IT12.
- Key: `'adminNavV2Dismissed'`
- Value: `'1'` nach Dismiss; nichts beim ersten Render → Banner sichtbar.
- Implementierung:
  ```tsx
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem('adminNavV2Dismissed') === '1');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('adminNavV2Dismissed', '1');
    setDismissed(true);
  };

  if (dismissed) return null;
  ```

> **Trade-off (dokumentiert):** Tom benutzt potentiell mehrere Browser/Devices (Desktop + Tablet). Mit localStorage sieht er den Banner pro Browser einmal. Für IT12 akzeptabel; bei späteren Iterationen (Multi-Device-Onboarding) ggf. auf DB-Feld migrieren.

#### Microcopy (siehe `admin-information-architecture.md` §6.1)

> „Die Admin-Navigation wurde überarbeitet. Buchungsanfragen, Zeitfenster und Verfügbarkeit finden Sie jetzt unter „Kalender & Zeitmanagement". Bewertungen liegen zusammen mit Analytics unter „Auswertungen"."

CTA: `[Verstanden]`

#### A11y
- Container: `role="status"`, `aria-live="polite"`.
- Dismiss-Button: `<button aria-label="Hinweis ausblenden">[Verstanden]</button>`.
- Nicht im Focus-Trap (User darf den Banner überlesen).

#### Tokens
| Element | Token |
|---------|-------|
| Container-Background | `bg-feedback-info-bg` |
| Container-Border | `border-l-4 border-feedback-info-border` |
| Padding | `px-4 py-3` |
| Icon | Lucide `Info`, 20 px, `text-feedback-info` |
| Verstanden-Button | Sekundär-Button (kein Primary, da nicht-destruktive Bestätigung) |

#### Do / Don't
- ✓ Nur im Admin-Layout rendern (oberhalb des Page-Contents, unterhalb der Topbar).
- ✓ Genau einmal pro Browser anzeigen (localStorage-gated).
- ✗ Nicht in die DB schreiben (Phase-2-Revision-Entscheidung).
- ✗ Nicht im Customer-Bereich verwenden.

---

## 8. `BookingSubmitButton` (refined)

**Datei:** `src/components/booking/BookingSubmitButton.tsx`
**Story:** IT12-S11

### Zweck
Ersetzt verstreute Submit-Button-Implementierungen im Buchungsformular. Enkapsuliert den 4-State-Lebenszyklus aus ux-spec §1.2.

### Props

| Prop | Typ | Default | Pflicht | Beschreibung |
|------|-----|---------|---------|--------------|
| `state` | `'idle' \| 'idle-disabled' \| 'submitting' \| 'success' \| 'error'` | `'idle'` | ja | Externer State (vom Form-Hook gesteuert) |
| `onClick` | `() => void` | — | ja | Submit-Handler |
| `formInvalidReason` | `string` | — | nein | Tooltip-Text für `idle-disabled` (z. B. „Bitte alle Pflichtfelder ausfüllen") |

### Microcopy (siehe ux-spec §3.11.1)

### A11y
- `<button type="submit" aria-busy={state === 'submitting'} aria-disabled={state === 'idle-disabled' || state === 'submitting' || state === 'success'}>`.
- Spinner mit `aria-hidden="true"`, Text trägt die Live-Information.
- `idle-disabled`: Tooltip via `title` + `aria-describedby`.

### Tokens
- Standard: Primary-Button-Tokens aus `component-library.md`.
- `submitting`-State: 250 ms Min-Anzeige (verhindert Flash bei schnellem Server).
- `success`-State: 1 s Anzeige, dann Redirect.

### Doppelklick-Schutz

Siehe ux-spec §3.11.4. Implementierung im Component oder im Caller-Hook — verbindlich ist nur das Verhalten.

---

## 9. Querverweise

- ux-spec: `ux-spec-iteration-12.md`
- design-system: `design-system.md` (Basis), `design-system-iteration-10-additions.md` (semantische Tokens)
- IT10-Components: `component-library-iteration-10.md` (Toast, QuickBookingModal, StatusBadge, etc.) — bleiben gültig
- IT7-Components: `component-library.md` (Banner, Button, Input, Card, ConfirmDialog, Skeleton) — bleiben gültig

---

## 10. Phase-2-Revision (Post-QA)

> **Datum:** 2026-05-04. **Anlass:** `QA_DESIGN_REVIEW_IT12.md`. Diese Sektion fasst die Component-Library-Änderungen aus der Revision zusammen.

### 10.1 Change-Log

| # | QA-Issue | Component | Änderung |
|---|----------|-----------|----------|
| 1 | C2/C3 | `ServiceDetailHero` | Service-Slug-Verweise auf Codebase-`SERVICES` aligned (siehe ux-spec §3.2.2). Routen `/services/[slug]` (statt `/leistungen`). |
| 2 | C4/C5/M3/Mn4/Mn5 | `CreateAccountOfferSheet` | Variants `mobile-bottom-sheet` und `desktop-inline-expanded` entfernt — Embedded-Card auf allen Viewports. Props `prefillEmail/FirstName/LastName/linkBookingId` ersetzt durch `bookingId`, `confirmationToken`, `displayEmail`. State `email-exists` umbenannt zu `account-exists`, neuer State `token-invalid`. Endpoint auf `/api/customer/register-from-booking`. sessionStorage-Flag per-Booking. |
| 3 | M4 | `AuthHeaderSlot` | Komplett überarbeitet: Customer-Bereich nutzt Custom-JWT-Cookie + EventBus (`useCustomerSession()` + `emitCustomerChanged()`), KEIN NextAuth `useSession()`. Anti-Patterns explizit. „Anmelden"-Link bleibt einfacher Link auf `/konto/login`. |
| 4 | M4 (NEU) | OAuth-Login-Button-Pattern §4.1 | Neuer Component-Spec: Admin-OAuth-Button MUSS `signIn('google')` aus `next-auth/react` aufrufen (POST mit CSRF), kein nackter Link auf `/api/auth/...`. Verhindert CSRF, entspricht NextAuth v5 Best Practice. |
| 5 | C6/C7/Mn7 (Stakeholder A+C) | `MarketingEmailComposer` + Subkomponenten | DSGVO-Variante 3 durchgezogen: `EmailComposeForm` mit nicht-editierbarem Footer-Block, `BulkSendConfirmDialog` mit Pflicht-Checkbox UWG, `RecipientPicker` mit `unsubscribed`-Handling + Hard-Cap 50, neuer Step `confirm` (insgesamt 6 Steps). Endpoint-Pfade auf Architect-SSOT umgeschrieben. Char-Counter bei 5000. |
| 6 | NEU (DSGVO) | `UnsubscribePage` (§6.9) | Neuer Component-Spec für Public-Page `/unsubscribe?token=…` (Result-Page bei `/marketing/abgemeldet`) mit Success / Error-Variants. Kein Re-Subscribe in IT12. |
| 7 | Mn8 | `AdminWelcomeHintBanner` (§7.4) | Neuer Component-Spec: Welcome-Banner für Admin-Nav-Migration. Persistenz via **localStorage** (Key `adminNavV2Dismissed`), nicht DB. |
| 8 | Mn6 | `AuthHeaderSlot` Dropdown | Items vereinfacht: „Mein Konto" → `/konto`, „Profil bearbeiten" → `/konto/profil`, „Abmelden". |

### 10.2 Offene Abhängigkeiten

- ~~Test-Send-Endpoint~~ ✓ Erledigt: `POST /api/admin/marketing/emails/{id}/test-send` (Architect-SSOT §R.4 Endpoint #7 + §R.7). UI-Constraint: setzt `status === 'draft'` voraus, daher braucht Composer einen Auto-Save / „Als Entwurf speichern"-Schritt vor dem Test-Send (siehe §6.3).
- **Customer-Session-Hook (`useCustomerSession`):** Architect dokumentiert in ARCHITECTURE_IT12.md §0.4 den Hook-Namen + API. UX-Spec verwendet aktuell `useCustomerSession()` als Platzhalter — finalen Namen vom Architect übernehmen.
- **Auto-Login nach Konto-Erstellung:** Architect-SSOT §R.4 Endpoint #1 setzt direkt `Set-Cookie` in der 201-Response — kein separater `signIn`-Call nötig. UX-Behaviour-Block in §3 anpassen (Engineer-Hinweis: nach 201-Response einfach `emitCustomerChanged()` + `router.refresh()`, der Cookie ist bereits gesetzt).
- **Auto-Save Draft im Composer:** Architect klärt Auto-Save-Trigger (Debounce-Time, expliziter „Als Entwurf speichern"-Button). Default-Empfehlung UX: Auto-Save 1.5s nach letztem Subject- oder Body-Edit (Debounce), zeigt Tom kleine Indikator „Entwurf gespeichert ✓" rechts oben.

*Ende der Component-Library Iteration 12 (Phase-2-Revision).*
