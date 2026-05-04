# Admin-Information-Architecture (IT12-S14)

> Bezug: PROJECT.md §IT12-S14, `ux-spec-iteration-12.md` §3.14, `component-library-iteration-12.md` §7.
> Datum: 2026-05-04.
> Letztes Update: 2026-05-04 (Phase-2-Revision nach QA — Welcome-Banner localStorage-final, siehe §9 am Ende).
> Sprache: Deutsch (Sie-Form).
> Adressat: Solution Architect (für Routing-Plan), Frontend-Engineer (für Sidebar-Implementierung), Tom Siefert (für Akzeptanz).

---

## 1. Problemstellung

Die aktuelle Admin-Navigation enthält:

```
Aktuell (vor IT12):
├─ Kalender
├─ Admins
├─ Nutzer
├─ Analytics
├─ Bewertungen
├─ Buchungsanfragen      ← Sektion taucht nochmal auf, unklar verortet
├─ Zeitfenster           ← Sektion taucht nochmal auf
├─ Verfügbarkeit         ← Sektion taucht nochmal auf
└─ Bewertungen           ← Duplikat
```

**Stakeholder-Feedback (Tom):**
- Verwirrung über doppelten Eintrag „Bewertungen".
- Unklar, ob „Buchungsanfragen", „Zeitfenster" und „Verfügbarkeit" zur Kalender-Welt oder eigenständig gehören.
- Keine erkennbare Hierarchie / Gruppierung — alle Items wirken gleichrangig.

**Ziel:** Drei klar getrennte Mental-Modelle, jedes ein eigener Bereich:
1. **Kalender & Zeitmanagement** = „Was passiert wann? Was muss ich tun?"
2. **Nutzerverwaltung** = „Wer nutzt die Plattform? Wem gebe ich Admin-Rechte?"
3. **Auswertungen** = „Wie läuft das Geschäft? Was sagen die Kunden?"

---

## 2. Neue Information-Architecture (verbindlich)

```
Admin-Bereich
│
├─ Dashboard                                  /admin
│   └─ Übersicht: KPI-Widgets, bevorstehende Termine,
│      letzte Anfragen
│
├─ Kalender & Zeitmanagement                  /admin/calendar
│   ├─ Übersicht (Default-View)               /admin/calendar
│   │   └─ FullCalendar-Wochen-/Monatsansicht mit
│   │      Buchungen + Zeitfenstern visuell überlagert
│   ├─ Buchungsanfragen                       /admin/bookings
│   │   └─ Liste aller offenen/bestätigten Buchungen
│   ├─ Zeitfenster verwalten                  /admin/slots
│   │   └─ CRUD von TimeSlot-Templates
│   └─ Verfügbarkeit                          /admin/calendar/availability
│       └─ Wochenraster (Mo–So × Stunden), an dem
│          Tom seine Verfügbarkeit setzt
│
├─ Nutzerverwaltung                           /admin/users
│   ├─ Kunden                                 /admin/users
│   │   └─ Liste mit Filter (NEU: nach Service),
│   │      Multi-Select, Aktion „E-Mail senden" (IT12-S15)
│   └─ Admins                                 /admin/admins
│       └─ Nur sichtbar für SUPER_ADMIN-Rolle
│
└─ Auswertungen                               /admin/analytics
    ├─ Analytics                              /admin/analytics
    │   └─ KPIs: Buchungen/Monat, Umsatz, Service-Verteilung
    └─ Bewertungen                            /admin/reviews
        └─ Kundenbewertungen-Liste (einmalig, kein Duplikat)
```

### 2.1 Visualisierung der Sidebar (Desktop, expanded)

```
┌─────────────────────────────────┐
│  🐻  Bärenstark Admin           │
│  ───────────────────────────────│
│                                 │
│  ⌂  Dashboard                   │
│                                 │
│  📅  Kalender & Zeitmanagement  │   ← Group-Header, klickbar = Übersicht
│      ▸ Übersicht                │   ← aktive Sub via Pfeil + Highlight
│      ▸ Buchungsanfragen         │
│      ▸ Zeitfenster              │
│      ▸ Verfügbarkeit            │
│                                 │
│  👥  Nutzerverwaltung           │
│      ▸ Kunden                   │
│      ▸ Admins                   │   ← nur SUPER_ADMIN
│                                 │
│  📊  Auswertungen               │
│      ▸ Analytics                │
│      ▸ Bewertungen              │
│                                 │
│  ───────────────────────────────│
│  ⚙  Einstellungen (später)     │
│  ↪  Abmelden                    │
└─────────────────────────────────┘
```

### 2.2 Visualisierung Mobile (Bottom-Tab + Gruppen-Übersicht-Page)

```
Tab-Bar unten (4 Tabs):
[ ⌂ Dashboard ] [ 📅 Kalender ] [ 👥 Nutzer ] [ 📊 Auswertungen ]

Klick auf „📅 Kalender" → /admin/calendar (Gruppen-Übersicht):
┌─────────────────────────────────┐
│  ← Admin                        │
│  Kalender & Zeitmanagement      │   ← h1
│                                 │
│  ┌──────────────────────────┐   │
│  │  📅  Kalender-Übersicht  │   │   ← Card 1 (Default-Subsektion,
│  │  Wochen- und Monats-     │   │     auf-Klick scroll/render)
│  │  ansicht aller Termine   │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │  📋  Buchungsanfragen    │   │   ← Card 2 → /admin/bookings
│  │  Liste aller Anfragen    │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │  ⏰  Zeitfenster         │   │   ← Card 3 → /admin/slots
│  │  Verwalten               │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │  ✅  Verfügbarkeit       │   │   ← Card 4 → /admin/calendar/availability
│  │  Wann arbeiten Sie?      │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

---

## 3. Mapping Alt → Neu (verbindlich für Migration)

| Alter Eintrag | Alte Route | Neue Sektion | Neue Route | Status |
|---------------|------------|--------------|------------|--------|
| Kalender | `/admin/calendar` | Kalender & Zeitmanagement → Übersicht | `/admin/calendar` | erhalten, gleiche Route |
| Buchungsanfragen | `/admin/bookings` | Kalender & Zeitmanagement → Buchungsanfragen | `/admin/bookings` | erhalten, **unter neuer Gruppe** |
| Zeitfenster | `/admin/slots` | Kalender & Zeitmanagement → Zeitfenster | `/admin/slots` | erhalten |
| Verfügbarkeit | `/admin/calendar/availability` (oder ähnlich) | Kalender & Zeitmanagement → Verfügbarkeit | `/admin/calendar/availability` | erhalten |
| Nutzer | `/admin/users` | Nutzerverwaltung → Kunden | `/admin/users` | erhalten, neuer Default-Tab „Kunden" |
| Admins | `/admin/admins` | Nutzerverwaltung → Admins | `/admin/admins` | erhalten |
| Analytics | `/admin/analytics` | Auswertungen → Analytics | `/admin/analytics` | erhalten |
| Bewertungen (Eintrag 1) | `/admin/reviews` | Auswertungen → Bewertungen | `/admin/reviews` | erhalten |
| Bewertungen (Eintrag 2 — Duplikat) | (unklar, evtl. `/admin/calendar/reviews`?) | — | — | **gelöscht** (Duplikat-Entfernung) |

**Verbindlich:**
- Keine Route wird umbenannt (Backwards-Kompatibilität, keine Bookmark-Brüche bei Tom).
- Falls eine zweite Reviews-Route existiert (`/admin/some-other-reviews`): Server-Redirect auf `/admin/reviews` (HTTP 301 in `next.config.js`).
- Sub-Items werden nur **logisch** gruppiert (Sidebar), keine Route ändert sich.

---

## 4. Begründung der neuen Struktur

### 4.1 Warum genau drei Top-Level-Gruppen?

- **Kognitive Last:** Miller's Rule (7±2) gilt für gleichrangige Items; bei Top-Level-Gruppen liegt die Komfortzone bei 3–5. Drei Gruppen sind sofort erfassbar und merkbar.
- **Mentale Modelle entsprechen Tom's täglichem Workflow:**
  1. *Was tun?* → Kalender & Zeitmanagement (operative Arbeit).
  2. *Mit wem?* → Nutzerverwaltung (Kontakte, Berechtigungen).
  3. *Wie läuft's?* → Auswertungen (Reflexion, KPIs).

### 4.2 Warum „Kalender & Zeitmanagement" statt nur „Kalender"?

- Der Kalender ist die Visualisierung; Zeitmanagement ist die Aktivität. Tom muss **mehrere Dinge** in dieser Gruppe tun (Anfragen prüfen, Slots erstellen, Verfügbarkeit setzen). Der Doppelname kommuniziert: „Hier ist alles zu Zeit."

### 4.3 Warum „Buchungsanfragen" unter „Kalender & Zeitmanagement"?

- Eine Buchungsanfrage ist immer mit einem Datum/Slot verknüpft → konzeptuell Teil des Zeitmanagements.
- Tom's typischer Workflow: Anfrage einsehen → im Kalender prüfen → Slot zuweisen / bestätigen. Das passiert sequentiell innerhalb derselben Gruppe.

### 4.4 Warum nicht „Marketing" als eigene Gruppe?

- Geprüft, verworfen. Marketing-Mails (IT12-S15) sind eine **Aktion auf einer gefilterten Kundenliste** — nicht ein eigenes Mental-Modell. Sie leben unter Nutzerverwaltung → Kunden als Aktion „E-Mail senden".
- Falls Marketing-Funktionen in späteren Iterationen wachsen (Newsletter-Templates, Segmentierung, Automatisierung), kann eine 4. Gruppe „Marketing" entstehen. Für IT12 nicht nötig.

### 4.5 Warum nicht Bewertungen + Analytics getrennt?

- Bewertungen sind Lese-Daten (Reflexion, Reaktion auf Kundensignale); Analytics sind Lese-Daten (Reflexion, Geschäftszahlen). Beide gehören zum Mental-Modell „Auswertung". Ein gemeinsamer Container reduziert Sidebar-Lärm.

---

## 5. Wireframe-Beschreibungen pro Sektion

### 5.1 Kalender & Zeitmanagement → Übersicht (`/admin/calendar`)

**Hero-Element:** FullCalendar (bereits implementiert in IT8/IT9), Wochen-Ansicht als Default.
**Content-Bereich:**
- Top-Toolbar: Heute / Vor / Zurück / Wechsel Wochen↔Monats-Ansicht / Filter „Service".
- Buchungen werden als bunte Blöcke gerendert (Service-Color-Coding).
- Zeitfenster (TimeSlot-Templates) werden als unterlegte schraffierte Bereiche gezeigt.
- Verfügbarkeits-Bereiche sind als grünlicher Hintergrund-Tint sichtbar.
**Klick-Aktionen:**
- Klick auf Buchung → Modal/Drawer mit Booking-Details + Status-Aktionen.
- Klick auf leeren Zeitfenster-Slot → Drawer „Buchung manuell anlegen" (Backlog, in IT12 nicht implementiert).

### 5.2 Kalender & Zeitmanagement → Buchungsanfragen (`/admin/bookings`)

**Hero-Element:** Filterbare Tabelle aller Buchungsanfragen.
**Content-Bereich:**
- Top-Filter-Bar: Status (Offen, Bestätigt, Storniert, Abgeschlossen), Service, Datum-Range.
- Tabellen-Spalten: Anfrage-Nr., Customer-Name, Service, Termin (Datum + Zeit), Status-Badge, Aktionen (Detail, Bestätigen, Stornieren).
- Empty-State: siehe ux-spec §3.13.1.

### 5.3 Kalender & Zeitmanagement → Zeitfenster (`/admin/slots`)

**Hero-Element:** Liste aller TimeSlot-Templates mit CRUD.
**Content-Bereich:**
- Tabelle: Wochentag, Start–Ende, Dauer, Service-Whitelist, Aktiv-Toggle, Aktionen (Bearbeiten, Löschen).
- Top-Right-Button: „+ Neues Zeitfenster".

### 5.4 Kalender & Zeitmanagement → Verfügbarkeit (`/admin/calendar/availability`)

**Hero-Element:** Wochenraster (Mo–So × 06:00–20:00 in 30-min-Slots).
**Content-Bereich:**
- Drag-to-paint Verfügbarkeit (vorhandenes IT9-Feature).
- Top-Toolbar: Wochenwahl, Vorlage anwenden, Reset.

### 5.5 Nutzerverwaltung → Kunden (`/admin/users`)

**Hero-Element:** Filterbare/sortierbare Tabelle der Customer.
**Content-Bereich:**
- **NEU IT12:** Filter-Dropdown „Nach Service" (Multi-Select aller Services). Anwendung filtert auf Customer mit min. einer abgeschlossenen Buchung im gewählten Service.
- Spalten: Name, E-Mail, Telefon, Anzahl Buchungen, In-Anspruch-genommene Services (Tag-Liste), Registriert am.
- **NEU IT12:** Multi-Select-Checkboxes pro Zeile + Header-Checkbox „Alle".
- **NEU IT12:** Aktion-Bar oben: „[X ausgewählt]    [📧 E-Mail senden]" (siehe `marketing-email-flow.md`).
- Empty-State: „Keine Kunden registriert."

### 5.6 Nutzerverwaltung → Admins (`/admin/admins`)

**Sichtbarkeit:** Nur SUPER_ADMIN-Rolle. CUSTOMER und normale ADMIN sehen den Eintrag in der Sidebar nicht.
**Hero-Element:** Liste der Admins.
**Content-Bereich:**
- Tabelle: Name, E-Mail, Rolle (ADMIN / SUPER_ADMIN), Erstellt am, Aktionen (Bearbeiten, Deaktivieren).
- Top-Right: „+ Admin einladen".

### 5.7 Auswertungen → Analytics (`/admin/analytics`)

**Bereits implementiert (IT5).** Keine Strukturänderung in IT12.

### 5.8 Auswertungen → Bewertungen (`/admin/reviews`)

**Bereits implementiert (IT8).** Keine Strukturänderung in IT12. **Sicherstellen, dass nur ein einziger Sidebar-Eintrag dorthin führt** (Duplikat entfernen!).

---

## 6. Migrations-Strategie für eingelernte Admins

Tom hat sich an die alte Navigation gewöhnt. Direkter Wechsel ohne Onboarding wäre unfreundlich.

### 6.1 Welcome-Hint-Banner (einmalig, dismissible)

**Trigger:** Beim ersten Login nach IT12-Deploy, im Admin-Layout oben sichtbar.

**Design:**

```
┌────────────────────────────────────────────────────────────────┐
│  ℹ  Die Admin-Navigation wurde überarbeitet                    │
│     Buchungsanfragen, Zeitfenster und Verfügbarkeit finden     │
│     Sie jetzt unter „Kalender & Zeitmanagement". Bewertungen   │
│     liegen zusammen mit Analytics unter „Auswertungen".        │
│                                            [ Verstanden ]      │
└────────────────────────────────────────────────────────────────┘
```

**Persistenz (Phase-2-Revision QA-Mn8 — entschieden: localStorage):**

Nach „Verstanden"-Klick wird der Banner via **localStorage** persistiert:
- Key: `'adminNavV2Dismissed'`
- Value: `'1'` (oder Timestamp)
- Implementierungs-Pattern siehe `component-library-iteration-12.md` §7.4 (`AdminWelcomeHintBanner`).

**Begründung:**
- Einfacher als DB-Feld; keine Migration, keine API-Round-Trip.
- Tom nutzt im Alltag meist denselben Browser/Device → akzeptable UX-Kosten.
- Trade-off (dokumentiert): Tom sieht den Banner pro Browser einmal. Falls er auf Tablet oder im Inkognito wechselt, erscheint er erneut. Das ist akzeptabel; die DB-Variante kann in IT13 nachgezogen werden, falls Multi-Device-Konsistenz wichtig wird.

**A11y:**
- `role="status"`, `aria-live="polite"`.
- Schließen-Button: `aria-label="Hinweis ausblenden"`.

### 6.2 Tooltip-Hints auf umgezogenen Items

Für die ersten **7 Tage** nach Deploy (oder bis Banner dismissed wurde, je nachdem was zuerst eintritt) zeigen die Items in der Sidebar zusätzliche Tooltips bei Hover:

| Item | Tooltip |
|------|---------|
| „Buchungsanfragen" (in Kalender-Gruppe) | „Liegt jetzt unter Kalender & Zeitmanagement." |
| „Bewertungen" (in Auswertungen) | „Bewertungen sind jetzt unter Auswertungen — nicht mehr doppelt." |

**Implementierung:** Conditional via Prop `showMigrationTooltip` auf den betroffenen Items.

### 6.3 Search / Quick-Switcher (Backlog, nicht in IT12)

Längerfristig hilfreich: Cmd+K-Quick-Switcher, der jede Sektion per Stichwort findet. Für IT12 nicht erforderlich.

---

## 7. Acceptance-Checkliste IT12-S14

- ✓ Maximal 3 Top-Level-Gruppen + 1 Dashboard-Standalone in der Sidebar.
- ✓ „Bewertungen" erscheint exakt einmal in der Sidebar.
- ✓ Jeder Sub-Item hat eine funktionierende Route (kein 404, kein 500).
- ✓ Aktive Gruppe + Subsektion sind visuell hervorgehoben (Border-Left + Highlight).
- ✓ Auf Mobile (≤1024 px) ersetzt `AdminTabBar` die Sidebar; Gruppen-Übersicht-Pages zeigen Sub-Items als Cards.
- ✓ Welcome-Hint-Banner erscheint einmalig nach IT12-Deploy beim ersten Admin-Login.
- ✓ Sidebar-State (collapsed/expanded) persistiert in `localStorage`.
- ✓ Keine Route wird umbenannt (außer evtl. Redirect für altes Reviews-Duplikat).
- ✓ `aria-current="page"` auf aktivem Item, `aria-label="Admin-Navigation"` auf der `<nav>`.
- ✓ Keyboard-Navigation: Tab durchläuft alle Items, Enter aktiviert Link, ArrowUp/Down innerhalb einer Gruppe.

---

## 8. Offene Fragen an Architect / Stakeholder

1. **Welche Route ist der „Bewertungen"-Duplikat?** (QA-M9) Bevor das Duplikat entfernt wird, muss die Architect-Untersuchung klären, ob eine zweite Route existiert (`/admin/calendar/reviews`?) oder ob es nur ein Sidebar-Item-Duplikat ist, das auf dieselbe Route zeigt. Empfehlung: Im Code suchen nach `/admin/reviews` und alternativen Pfaden. Acceptance-Test (QA-Vorgabe): `cy.contains('Bewertungen').should('have.length', 1)` auf jeder Admin-Page.
2. ~~DB-Feld für Welcome-Hint-Dismissal?~~ **Entschieden Phase-2-Revision: localStorage** (siehe §6.1).
3. **Verfügbarkeits-Route:** Aktuelle Route unklar (`/admin/calendar/availability`?). Architect klärt im Code.
4. **Admins-Sichtbarkeit:** Nur SUPER_ADMIN sieht den „Admins"-Eintrag — diese Rollen-Logik existiert bereits (IT8); UX setzt nur darauf auf. Architect bestätigt.
5. **Backwards-Compat-Redirect** (QA-M10): Falls Tom Bookmarks auf das alte `/admin/calendar/reviews` o. ä. hat, sollte ein 308-Redirect in `next.config.js` eingebaut werden. Architect entscheidet basierend auf der Code-Recherche zu Frage 1.

---

## 9. Phase-2-Revision (Post-QA) — Change-Log

> **Datum:** 2026-05-04. **Anlass:** `QA_DESIGN_REVIEW_IT12.md` (M9, M10, Mn8).

| # | QA-Issue / Stakeholder-Antwort | Sektion | Änderung |
|---|--------------------------------|---------|----------|
| 1 | Mn8 (DB vs. localStorage) | §6.1 | Welcome-Banner-Persistenz auf **localStorage** festgelegt (Key `adminNavV2Dismissed`). DB-Variante als IT13-Backlog dokumentiert. Trade-off (Multi-Device) explizit benannt. Implementierungs-Pattern in `component-library-iteration-12.md` §7.4 ergänzt. |
| 2 | M9 (Bewertungen-Duplikat) | §8 (Offene Fragen) | Acceptance-Test als Cypress-Pattern dokumentiert: `cy.contains('Bewertungen').should('have.length', 1)`. |
| 3 | M10 (Bookmark-Kompatibilität) | §8 (Offene Fragen) — neu Punkt 5 | Backwards-Compat-Redirect-Empfehlung für altes Reviews-Duplikat aufgenommen. Architect entscheidet final basierend auf Code-Recherche. |
| 4 | Stakeholder-E (Marketing in Nutzerverwaltung) | §2 + §5.5 + §4.4 | Marketing bleibt explizit unter „Nutzerverwaltung → Kunden → Aktion: E-Mail senden" (siehe `marketing-email-flow.md` §2). Begründung gegenüber „Marketing als 4. Gruppe" unverändert. |

---

*Ende der Admin-Information-Architecture (Phase-2-Revision).*
