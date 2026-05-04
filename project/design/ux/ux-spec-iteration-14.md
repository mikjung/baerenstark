# UX-Spec — Iteration 14 (Bärenstark Hausservice)

> **Bezug:** `project/user-stories/iteration-14.md` (IT14-S01–S08).
> **Verhältnis zu Basis-Spec:** Diese Datei ergänzt `ux-spec.md` und `ux-spec-iteration-13.md` mit **Bug-Fix-spezifischen UX-Details**. Iteration 14 ist überwiegend Bug-Fixing — die UX-Arbeit ist gezielt auf wenige Stories begrenzt.
> **Sprache:** Deutsch (Sie-Form für Kunden-Touchpoints, Du-Form intern bei Admin-Microcopy nicht verwendet — Tom ist alleiniger Admin und nutzt das System operativ).
> **Datum:** 2026-05-04.
> **Adressat:** Solution Architect, Frontend-Engineer, Tom Siefert (Akzeptanz).
>
> **Reconciliation-Update 2026-05-04 (post-QA):** Diese Datei wurde nach dem QA-Review (`QA_DESIGN_REVIEW_IT14.md`) und der Architect-Synchronisation überarbeitet. Konkret aligned:
> - **C-1 PaymentMethod-Enum:** Kanonische Liste ist `['CASH', 'BANK_TRANSFER']` (synced laut Orchestrator-Direktive — Architect-Doc wird parallel aktualisiert). Begründung Architect: Tom hat aktuell **keine** Stripe-/Card-Integration in der Admin-UI. `CARD`/`INVOICE`/`STRIPE` würden falsche Erwartungen erzeugen.
> - **C-2 Calendar-Link:** Echte Detail-Route `/admin/bookings/[id]/page.tsx` wird gebaut (Architect-Entscheidung, ersetzt frühere Anker-Variante). Detail-Page-Spec siehe §5a.
> - **M-S03 Multi-Select:** Filter-Pills sind explizit Multi-Select-Toggle-Pills (`role="checkbox"`, `aria-checked`).
> - **COUNTER_PROPOSED + COMPLETED:** Voller 6-Werte-Enum aus Prisma (`PENDING, CONFIRMED, REJECTED, COUNTER_PROPOSED, CANCELLED, COMPLETED`) — kein `DONE`.
> - **Customer-Submit ohne Payment-Method:** Bestätigt — Customer-Buchungsformular zeigt **kein** Payment-Method-Feld; Admin setzt das nachträglich.

---

## Inhalt

| Story | Bereich | Scope dieser Spec |
|-------|---------|-------------------|
| IT14-S01 | Prefill-Regression (Production) | Bug-Manifestation dokumentieren — keine neue UX |
| IT14-S03 | Admin-Dashboard Default-Filter | Initial-State + Reset-Verhalten + Empty-State |
| IT14-S04 | Preis-Feld Save-Feedback | Save-Feedback + Error-State |
| IT14-S05 | Barzahlung als Zahlungsoption | Dropdown-Erweiterung + Microcopy |
| IT14-S06 | Calendar „Buchung öffnen" 404 | Link-Behavior + Disabled-Variant + Mobile-Touch |
| IT14-S08 | Image-Upload in Production | User-freundliche Fehler-Microcopy für Production-Failures |

> **Stories ohne UX-Anteil:** IT14-S02 (Auth-Gate, reine Server-/Middleware-Logik — Login-Redirect bestehende Spec), IT14-S07 (Analytics-Datenkorrektur, kein UI-Change).

---

## 1. IT14-S01 — Prefill-Regression: Bug-Manifestation aus User-Sicht

> **Kein neuer UX-Entwurf.** Das Feature ist in IT13-S04 spezifiziert (`ux-spec-iteration-13.md` IT13-§4 + `component-library-iteration-13.md` §3 PrefillNotice). Diese Sektion dokumentiert **ausschließlich**, wie sich der Production-Bug für Tom (Reporter) und Endkunden zeigt — damit QA und Engineering die richtige UX-Hypothese gegen die richtige Symptomatik prüfen.

### 1.1 Was Tom (als Reporter) berichtet

Tom hat sich produktiv mit seinem Customer-Account eingeloggt, `/buchen` aufgerufen — die Felder Vorname, Nachname, E-Mail, Adresse blieben **leer**. Lokal funktioniert das Prefill, in Production nicht.

### 1.2 Welche bestehenden UX-States betroffen sind

Bestehende State-Tabelle aus `ux-spec.md` IT11-§5 (BookingForm-States):

| Bestehender State (IT11) | Prefill-Bug-Manifestation |
|--------------------------|---------------------------|
| `loading-prefill` (Page-Mount, Profil pending) | **Korrekt** — Skeleton erscheint kurz. |
| `idle-customer` (Form bereit, eingeloggt, Felder vorausgefüllt) | **Defekt** — Form wechselt in diesen State, aber die Felder sind leer (als wäre `idle-guest` gerendert worden). PrefillNotice aus IT13-§3 erscheint **nicht** (korrektes Verhalten gemäß IT13-§3.6: „Notice nicht rendern, wenn der User nicht eingeloggt ist oder die Felder leer sind"). Tom sieht also visuell denselben Zustand wie ein Gast — keinen Fehler-Hinweis. |
| `idle-guest` (Form bereit, kein Login) | Visuell identisch zum defekten `idle-customer`-State — daher die Verwechslung. |

**Konsequenz für die Diagnose:** Der User sieht **keinen Fehler-Toast, kein 401-Banner, keine sichtbare Anomalie** — nur leere Felder. Das Symptom ist „still" (silent failure), wie in IT11-§2.3 für Auth-Fehler beim Profil-Vorausfüllen vorgesehen („Stiller Fallback auf leere Felder. Kein Toast — würde verwirren, weil der Submit-Pfad funktioniert"). Genau dieser Stille-Fallback maskiert den Bug — was korrektes UX-Verhalten ist, aber die Diagnose erschwert.

### 1.3 Akzeptanz-Vermerk für QA

- **Visueller Akzeptanz-Test (manuell):** Eingeloggter Customer öffnet `/buchen` — Felder müssen vorausgefüllt sein, **PrefillNotice muss sichtbar sein** (Du-Form: „Aus deinem Profil übernommen. Du kannst die Angaben für diese Anfrage anpassen — dein Profil wird dadurch nicht verändert.", siehe IT13-§3.3).
- **Negativ-Test:** Nicht eingeloggter Nutzer öffnet `/buchen` — Felder leer, kein PrefillNotice. (Bestand IT13.)
- **Keine UI-Änderung in IT14-S01.** Reine Backend-/Hydration-Korrektur, deren Erfolg an PrefillNotice + gefüllten Feldern visuell verifiziert wird.

---

## 2. IT14-S03 — Admin-Dashboard Default-Filter (Offen + Bestätigt)

### 2.1 Bestehende Filter-UI (IT12-Bestand)

Die Buchungsanfragen-Tabelle (`/admin/bookings`, siehe `admin-information-architecture.md` §5.2) verfügt heute über eine **Top-Filter-Bar** mit Status-Filtern. **QA-Befund (verifiziert):** der heutige Code in `BookingTable.tsx` Zeile 75 ist **Single-Select** (`StatusFilter = 'ALL' | BookingStatus`). Die UX-Spec verlangt jedoch Multi-Select. **Folge:** IT14 enthält den Refactor von Single- auf Multi-Select-Pills — UX-Spec ist bewusst der „Soll"-Zustand.

> **Pattern-Bestätigung (verbindlich für IT14):** Pills (Chips) bleiben das visuelle Pattern. **Semantik wechselt von Single-Select auf Multi-Select** — jede Pill ist unabhängig toggelbar. Architect-Doc und Component-Library sind hierauf aligned.

### 2.2 Verbindliches Multi-Select-Verhalten

- **Pattern:** Multi-Select-Toggle-Pills. Jede Pill ist unabhängig an-/abschaltbar.
- **A11y-Semantik:** Jede Pill hat `role="checkbox"` und `aria-checked={isActive}` (nicht `aria-pressed` — Multi-Select-Filter ist semantisch eine Checkbox-Gruppe, kein Toggle-Button-Set). Container: `role="group" aria-label="Status-Filter"`.
- **Default-State beim Page-Load:** `PENDING` und `CONFIRMED` aktiv. Andere Status-Pills inaktiv.
- **Toggle-Verhalten:**
  - Klick auf eine **aktive** Pill → deaktiviert sie, feuert eine neue Liste-Abfrage mit reduziertem Status-Set.
  - Klick auf eine **inaktive** Pill → aktiviert sie, feuert eine neue Liste-Abfrage mit erweitertem Status-Set.
- **Edge-Case „alle Pills deaktiviert":** Wenn Tom alle Pills abschaltet → Liste leer + Empty-State **„Wähle mindestens einen Status"** (eigene Variant, nicht der „Keine offenen Anfragen"-Empty-State). Microcopy siehe §2.5. **Verbindlich:** Wir blockieren das **nicht** technisch (z.B. „letzte aktive Pill bleibt klickbar"), sondern lassen Tom alle deaktivieren und zeigen den klärenden Empty-State.

### 2.3 Initial-State beim Page-Load (vollständiger 6-Werte-Enum)

> **Wichtig (QA-M-2):** Prisma-Enum hat **sechs** Werte. Component-Library und UX-Spec listen alle sechs. Es gibt **kein** `DONE`-Status — der Endwert ist `COMPLETED`.

| Filter-Pill | Enum-Wert | Visual-State beim Page-Load |
|-------------|-----------|------------------------------|
| Offen | `PENDING` | **Aktiv (Solid)** |
| Bestätigt | `CONFIRMED` | **Aktiv (Solid)** |
| Gegenvorschlag | `COUNTER_PROPOSED` | Inaktiv (Outline) |
| Storniert | `CANCELLED` | Inaktiv (Outline) |
| Abgelehnt | `REJECTED` | Inaktiv (Outline) |
| Abgeschlossen | `COMPLETED` | Inaktiv (Outline) |

**Sichtbares Ergebnis:** Tom öffnet `/admin/bookings` — er sieht oben sechs Pills, davon zwei (`Offen` + `Bestätigt`) gefüllt-aktiv, die Tabelle darunter zeigt nur diese beiden Status.

**Aktiv-Markierung visuell:**
- Aktiv: `bg-baerenstark-bark text-baerenstark-cream` (Solid).
- Inaktiv: `bg-transparent text-baerenstark-bark/70 border border-baerenstark-sand` (Outline).
- Hover (inaktiv): `bg-baerenstark-sand/20`.
- Focus-visible: zusätzlich `ring-2 ring-baerenstark-bark ring-offset-2`.

### 2.4 Reload-Verhalten und „Standard zurücksetzen"

- **Reload (F5):** Default „Offen + Bestätigt" wird wiederhergestellt — keine Persistierung in localStorage/Cookie/DB. Begründung: Tom möchte **immer den aktuellen Arbeits-Status** beim Tagesstart sehen.
- **Calendar-Anker-Ausnahme (S06):** Wenn Tom über den Calendar-Link auf einen abgeschlossenen Auftrag (`COMPLETED`) navigiert, ist die Filter-Verhalten dort über die Detail-Route abgedeckt (siehe §5a). Die Liste-Filter werden **nicht** automatisch erweitert, weil die Detail-Route eine eigenständige Page ist, kein In-Page-Anker mehr.
- **Kein In-UI-Reset-Button in IT14:** Reload ist der definierte Reset-Pfad. Anpassbar, falls Tom in QA wünscht.

### 2.4a Empty-State „Keine offenen Anfragen" (Default-Filter, 0 Treffer)

Wenn der Default-Filter aktiv ist und null Buchungen mit Status `PENDING` oder `CONFIRMED` existieren:

```
┌──────────────────────────────────────────────────────────┐
│  [Filter-Pills: ● Offen   ● Bestätigt   ○ Storniert ...] │
│                                                          │
│                                                          │
│                       📭                                 │
│                                                          │
│            Keine offenen Anfragen                        │
│                                                          │
│   Sobald eine neue Buchungsanfrage eingeht, erscheint   │
│            sie hier automatisch.                         │
│                                                          │
│         [ Alle Anfragen anzeigen → ]                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Verbindliches Layout:**
- **Centered**, vertikal mittig im Tabellen-Bereich (mind. 240 px Höhe).
- **Icon:** Lucide `Inbox` (32 px, `text-baerenstark-bark/40`). Kein Foto, keine Illustration — konsistent mit bestehenden Empty-States (IT12).
- **Headline:** „Keine offenen Anfragen" — `text-lg font-semibold text-baerenstark-bark`.
- **Subline:** „Sobald eine neue Buchungsanfrage eingeht, erscheint sie hier automatisch." — `text-sm text-baerenstark-bark/70`, max. 2 Zeilen.
- **Sekundär-CTA:** „Alle Anfragen anzeigen →" — Ghost-Button, schaltet alle Filter-Pills aktiv (zeigt auch storniert/abgelehnt/abgeschlossen). Gibt Tom den Ausweg, falls er denkt es fehlt was.

**Accessibility:**
- Empty-State-Container: `role="status"` + `aria-live="polite"` — Screenreader liest die Headline beim ersten Render.
- Icon: `aria-hidden="true"`.
- CTA-Button: regulärer `<button>` mit klarem Label.

> **Hinweis (QA-m-1):** Der CTA „Alle Anfragen anzeigen →" schaltet alle 6 Pills aktiv. Beim nächsten Reload greift wieder der Default „Offen + Bestätigt" (kein Persist). Tom soll das verstehen — die Beschriftung ist explizit „Alle anzeigen", kein „Reset".

### 2.4b Empty-State „Wähle mindestens einen Status" (alle Pills deaktiviert)

Wenn Tom alle Filter-Pills deaktiviert hat → Liste ist leer per Definition. Eigener Empty-State-Variant:

| Element | Text |
|---------|------|
| Icon | Lucide `Filter` (32 px, `text-baerenstark-bark/40`) |
| Headline | „Wähle mindestens einen Status" |
| Subline | „Aktiviere oben mindestens einen Status-Filter, um Buchungen zu sehen." |
| CTA | „Standard wiederherstellen" → setzt Filter auf `['PENDING', 'CONFIRMED']` |

A11y wie §2.4a (Container `role="status"`, Icon `aria-hidden`).

### 2.5 Microcopy-Tabelle

| Element | Text |
|---------|------|
| Pill-Labels | „Offen", „Bestätigt", „Gegenvorschlag", „Storniert", „Abgelehnt", „Abgeschlossen" |
| Empty-State (Default-Filter, 0 Treffer) Headline | „Keine offenen Anfragen" |
| Empty-State (Default-Filter, 0 Treffer) Subline | „Sobald eine neue Buchungsanfrage eingeht, erscheint sie hier automatisch." |
| Empty-State (Default-Filter, 0 Treffer) CTA | „Alle Anfragen anzeigen →" |
| Empty-State (alle Pills aus) Headline | „Wähle mindestens einen Status" |
| Empty-State (alle Pills aus) Subline | „Aktiviere oben mindestens einen Status-Filter, um Buchungen zu sehen." |
| Empty-State (alle Pills aus) CTA | „Standard wiederherstellen" |

---

## 3. IT14-S04 — Preis-Feld Save-Feedback (Admin-Detail)

### 3.1 Aktuelles Layout des Preis-Feldes (Bestand)

Das Preis-Feld liegt im **Admin-Booking-Detail-Drawer** (oder Detail-Page, abhängig von Viewport), unter der Sektion „Auftragsdaten" oder „Preis & Zahlung". Aktueller Bestand:

```
┌────────────────────────────────────────┐
│  Endpreis                              │
│  ┌──────────────────────────────┐ €    │
│  │                              │      │
│  └──────────────────────────────┘      │
│  Brutto, inkl. MwSt.                   │
└────────────────────────────────────────┘
```

- **Input-Typ:** `<input type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*">` (numerisch via inputMode, aber Komma als Dezimaltrenner erlaubt — DE-Format).
- **Suffix:** „€" rechts vom Feld (oder als Adornment innerhalb).
- **Helper-Text:** „Brutto, inkl. MwSt." unter dem Feld, `text-xs text-baerenstark-bark/60`.
- **Touch-Target:** Mindesthöhe 44 px (verbindlich, schon Bestand).

> **Verbindlich:** Layout des Feldes selbst bleibt unverändert in IT14. Bug ist Persistierung — Frontend-Submit-Payload und Backend-Update.

### 3.2 Save-Feedback nach erfolgreicher Persistierung

Tom ändert den Preis (z.B. auf „150") und klickt „Speichern" (oder das Feld blurrt mit Save-on-Blur — siehe §3.4 Decision).

| Sub-State | Trigger | Sichtbar |
|-----------|---------|----------|
| `saving` | Submit gestartet, API-Request läuft | Save-Button: Spinner + Label „Wird gespeichert …", Button disabled. Preis-Feld disabled (kein erneutes Editieren während Save). |
| `success` | API 200 | **Toast (success, 4 s):** „**Preis gespeichert.** Neuer Endpreis: 150,00 €." + **Inline-Bestätigung** rechts neben/unter dem Save-Button: grünes Check-Icon (`CheckCircle2`, 16 px) + Text „Gespeichert" — fadet nach 3 s aus. |
| `error-server` | API 5xx, Netzwerk | Toast (error, 5 s): „**Speichern fehlgeschlagen.** Bitte erneut versuchen oder die Seite neu laden." Save-Button bleibt aktiv, Feldwert wird **nicht** auf alten Wert zurückgesetzt (Tom kann erneut speichern). |
| `error-validation` | API 400 (z.B. negativer Wert, ungültiges Format) | Inline-Fehler unter dem Feld: „Bitte einen gültigen Betrag eingeben (z. B. 150,00)." `text-feedback-error`. Save-Button bleibt aktiv. Kein Toast. |

**Verbindliche Microcopy:**

| Feedback-Slot | Text |
|---------------|------|
| Save-Button (idle) | „Speichern" |
| Save-Button (saving) | „Wird gespeichert …" |
| Toast (success) | „Preis gespeichert. Neuer Endpreis: {wert} €." |
| Inline-Confirm-Chip | „Gespeichert" (mit Check-Icon, 3 s sichtbar, dann Fade-out 200 ms) |
| Toast (error-server) | „Speichern fehlgeschlagen. Bitte erneut versuchen oder die Seite neu laden." |
| Inline-Fehler (error-validation) | „Bitte einen gültigen Betrag eingeben (z. B. 150,00)." |

### 3.3 Rationale: Toast + Inline-Chip kombiniert

- **Toast** schafft Aufmerksamkeit und persistiert das Feedback auch nach Page-Wechsel (z.B. wenn Tom direkt zur nächsten Anfrage navigiert).
- **Inline-Chip „Gespeichert"** gibt unmittelbares räumliches Feedback am Ort der Aktion — wichtig für Power-User-Flow (Tom speichert mehrere Anfragen hintereinander, will pro-Anfrage-Feedback ohne Toast-Spam).
- **Beide gleichzeitig** ist konsistent mit IT11-§2.3 (Toast für Aufmerksamkeit, Inline für Persistenz/Lokalität bei Server-Erfolg).

### 3.4 Default-Entscheidung: Save-Trigger

> **Default-Entscheidung:** **Explizit per Save-Button** (nicht Save-on-Blur). Tom soll bewusst commiten — Preis ist ein finanziell relevanter Wert. Save-on-Blur könnte unbeabsichtigte Speicherungen erzeugen (Tom verlässt das Feld zum Lesen). Kann in QA-Phase angepasst werden, falls Tom Save-on-Blur klar wünscht.

### 3.5 Accessibility & Mobile

- **Touch-Target:** Input ≥ 44 px Höhe, Save-Button ≥ 44 × 44 px.
- **Keyboard:** Tab führt Input → Save-Button. Enter im Input triggert Save (Form-Submit-Konvention).
- **Live-Region:** Inline-Confirm-Chip nutzt `role="status" aria-live="polite"` — Screen-Reader liest „Gespeichert" automatisch beim Erscheinen.
- **Mobile:** Input bekommt `inputMode="decimal"` → numerisches Keypad mit Komma. Save-Button bleibt auch auf < 768 px ≥ 44 px.

---

## 4. IT14-S05 — Barzahlung als Zahlungsoption

### 4.1 Position des Zahlungsart-Felds

Das Feld lebt im **Admin-Booking-Detail (`/admin/bookings/[id]`, siehe §5a)**, in der Sektion „Preis & Zahlung" (oder analog), **direkt unter** dem Preis-Feld aus IT14-S04. Kunden-sichtbares Buchungsformular bleibt **unverändert** — der Customer wählt **keine** Zahlungsart beim Buchen, das ist ein Admin-internes Feld (Architect-bestätigt).

> **Customer-Submit-Bestätigung (verbindlich):** Im Customer-Buchungsformular (`/buchen`) erscheint **kein** Payment-Method-Feld. Das `paymentMethod`-Attribut wird Admin-seitig im Detail-Editor gesetzt. `POST /api/bookings` (Customer-Pfad) erwartet das Feld nicht. Bestandsbuchungen vor IT14-Migration bleiben mit `paymentMethod = NULL`.

### 4.2 UI-Pattern: Dropdown (Select)

> **Verbindlich:** **Native `<select>`** (oder shadcn `<Select>` falls bestehend in der Detail-View). Begründung:
> - Pills/Radios würden auf < 768 px viel vertikalen Platz fressen.
> - Native-Select hat volle Browser-A11y und Touch-Target ≥ 44 px out-of-the-box.
> - Bei nur 2 Werten (`CASH`, `BANK_TRANSFER`) wäre auch eine Radio-Group denkbar — wir bleiben aber bei Select für Zukunftssicherheit (falls weitere Werte hinzukommen) und Konsistenz mit anderen Admin-Form-Feldern.

### 4.3 Optionen + Microcopy (kanonisch)

> **Kanonische Liste (synced laut Orchestrator-Direktive — alignt mit ARCHITECTURE_IT14.md):** **`['CASH', 'BANK_TRANSFER']`**. Frühere Listen mit `CARD`, `INVOICE`, `STRIPE` sind **entfernt** — Tom hat aktuell keine Stripe-/Card-Integration in der Admin-UI; weitere Werte würden falsche Erwartungen erzeugen.

| Position | Wert (Enum) | Label (DE, sichtbar) |
|----------|-------------|----------------------|
| (default) | `null` / leer | „— bitte wählen —" (nur sichtbar wenn `paymentMethod` NULL) |
| 1 | `BANK_TRANSFER` | Überweisung |
| 2 | `CASH` | Barzahlung |

> **Reihenfolge-Begründung:** Überweisung zuerst, Barzahlung zweitens. Erfahrung aus Tom's Geschäftsalltag (B2C-Hausservice, Privatkunden in Darmstadt): ein nennenswerter Anteil der Aufträge wird bargeldlos beglichen, Überweisung ist das gängige Default-Verfahren bei Rechnungsstellung. Barzahlung tritt häufig bei Kleinbeträgen oder spontanen Kunden-Wünschen auf. Reihenfolge spiegelt damit die wahrscheinliche Häufigkeit nicht sklavisch wider, sondern ordnet das „Standard-Geschäftsverfahren" (Überweisung) an erste Stelle. **Anpassbar** in QA, falls Tom „Barzahlung an Position 1" wünscht (Begründung müsste „Bar ist häufiger" sein).

> **Microcopy-Entscheidung:** Labels = **„Überweisung"** und **„Barzahlung"** (nicht „Bar", „Bar (vor Ort)", „Bank-Überweisung"). Begründung:
> - „Barzahlung" ist die geschäftsübliche Substantiv-Form (Rechnungen, Kontoauszüge) — eindeutige Tom-Sprache.
> - „Überweisung" ist im Banking-Kontext eindeutig (Bank-Überweisung wäre redundant).
> - Konsistent in der Form (substantiviert, kein Adverb).

### 4.4 NULL-Render-Verhalten (Bestandsbuchungen)

Existing Bookings (vor IT14-Migration) haben `paymentMethod = NULL` (kein Default-Wert in Migration). Verbindliches Render-Verhalten:

| Kontext | Darstellung bei NULL |
|---------|----------------------|
| Detail-Page Select (`/admin/bookings/[id]`) | Placeholder-Option **„— bitte wählen —"** ist als selected gerendert (`<option value="">`). Save-Button neutral (kein Dirty-State, weil NULL der Bestand ist). |
| Listing/Karte in `BookingTable.tsx` | **Kein Zahlungsart-Badge** rendern. Begründung: ein dezenter Strich („—") oder „nicht gesetzt" wäre visuelles Rauschen. Tom erkennt am fehlenden Badge implizit, dass das Feld noch zu setzen ist. **Verbindlich:** kein Badge bei NULL. |
| Detail-Page Header-Summary | Badge **nur** wenn `paymentMethod !== null`. Sonst weglassen, kein Platzhalter-Text. |

> **A11y-Bemerkung:** Im Select bekommt die Placeholder-Option `<option value="" disabled hidden>— bitte wählen —</option>` damit Tom sie nicht versehentlich „aktiv wählen" kann. Der NULL-Bestand bleibt nur initial sichtbar, bis Tom eine echte Option wählt — ab dann ist der Wert gesetzt und Speichern überträgt ihn.

### 4.4 Save-Behavior + Erfolgs-Feedback

Identisches Pattern wie Preis-Feld (IT14-S04 §3.2):

| Sub-State | Sichtbar |
|-----------|----------|
| `saving` | Save-Button: „Wird gespeichert …", disabled. Select disabled. |
| `success` | Toast (success, 4 s): „**Zahlungsart gespeichert.** {Label}." + Inline-Chip „Gespeichert" rechts neben Save-Button (3 s). |
| `error-server` | Toast (error, 5 s): „Speichern fehlgeschlagen. Bitte erneut versuchen." Select bleibt auf Tom's Auswahl. |

> **Hinweis:** Falls in der Detail-View ein **gemeinsamer Save-Button** für mehrere Felder existiert (z.B. „Anfrage aktualisieren" speichert Preis + Zahlungsart + Notizen in einem Submit), reicht **ein** Toast: „Anfrage aktualisiert." — kein separates Toast pro Feld. Engineer entscheidet final basierend auf bestehender Submit-Architektur.

### 4.5 Accessibility

- **Label:** `<label htmlFor="payment-method">Zahlungsart</label>` — sichtbar über dem Select.
- **Required-Indikator:** Falls Pflichtfeld → Asterisk + `aria-required="true"`. Default-Entscheidung: **kein Pflichtfeld** (manche Aufträge laufen ohne expliziten Zahlungsart-Eintrag bis zum Abschluss). Kann in QA angepasst werden.
- **Keyboard:** Pfeil-Up/Down navigiert Optionen, Enter/Space bestätigt — Standard-Select-Verhalten.
- **Touch-Target:** Select ≥ 44 px Höhe.

### 4.6 Regression-Check

- **Kanonisches Enum:** Nur die zwei Werte `BANK_TRANSFER` und `CASH` sind erlaubt. Frühere UI-Optionen (`CARD`, `INVOICE`, `STRIPE`) werden **nicht** im Select angeboten.
- Falls die heutige `PaymentMethodSelect`-Komponente (oder Bestand-Code in der Detail-View) noch andere Werte enthält: **diese werden in IT14 entfernt**, sofern sie nicht in produktiven Daten verwendet werden. Falls in der DB Werte außerhalb des Enums existieren (sehr unwahrscheinlich, da Migration neu): Engineer-Sanity-Check, ggf. mit Architect besprechen.
- **PaymentBadge-Tokens (falls in Liste/Detail):** Beide Werte nutzen einen neutralen Stil (kein Status-Color), gleiche Token-Familie (`baerenstark-cream/sand`-neutral). Kein neuer Design-Token nötig.

---

## 5. IT14-S06 — Calendar „Buchung öffnen" Detail-Behavior

### 5.1 Heutiges Verhalten (Bestand) und IT14-Korrektur

Im Admin-Kalender (`/admin/calendar`, FullCalendar) klickt Tom auf einen Kalender-Eintrag (Buchung als bunter Block). Bestand-Verhalten gemäß `admin-information-architecture.md` §5.1 + IT12-Spec: Es erscheint ein **Popover / Mini-Detail-Card** (oder Drawer, je nach Viewport) mit Buchungs-Kerndaten (Service, Kunde, Status). Darin ein Link/Button **„Buchung öffnen"**, der zur Detail-Page navigieren soll — **dieser Link führt aktuell zu HTTP 404**, weil `app/admin/bookings/[id]/page.tsx` nicht existiert (Bug IT14-S06).

> **IT14-Architect-Entscheidung (verbindlich, post-QA):** Es wird eine **echte Detail-Route** `app/admin/bookings/[id]/page.tsx` gebaut. Die frühere Anker-Variante (`/admin?tab=bookings&focus=...#booking-...`) ist verworfen. Calendar-Popover-CTA „Buchung öffnen" navigiert auf die Detail-Page (HTTP 200, kein 404). Detail-Page-Spec siehe §5a.
>
> **Begründung:** Eine echte Detail-Route ist der saubere Pfad — Tom kann direkt verlinken (z.B. an Mitarbeiter oder per Lesezeichen), URL ist semantisch stabil, Page-Layout ist nicht durch das Dashboard-Tab-Layout limitiert. Aufwand ~80 LOC laut Architect §5.3 Option B.

> **Verbindlich für IT14:** Popover-/Drawer-Pattern bleibt unverändert. Nur die Link-URL ist jetzt eine echte Route. Kein Redesign am Popover selbst.

### 5.2 Link-Label

> **Verbindliche Entscheidung:** Label bleibt **„Buchung öffnen"** (nicht „Details", nicht „Anfrage anzeigen", nicht „Zur Detailseite"). Begründung:
> - Tom kennt das Wording — keine Umlern-Kosten in Bug-Iteration.
> - „Buchung" ist konsistent mit „Buchungsanfragen" (Sidebar-Item) und „/admin/bookings".
> - „Öffnen" kommuniziert Page-Navigation klarer als „Details" (das ist mehrdeutig).

**Visuell:**

```
┌──────────────────────────────────────────────┐
│  [● Bestätigt]              ↗ Buchung öffnen │
│  Wohnungsreinigung                           │
│  Maria Müller                                │
│  Mo, 12.05.2026 · 09:00–11:00                │
└──────────────────────────────────────────────┘
```

- Link-Label: „Buchung öffnen" mit `ExternalLink` oder `ArrowUpRight`-Icon (12 px) rechts.
- Pattern: `<Link>` (Next.js) oder `<a>` mit korrekter Detail-URL (`/admin/bookings/{bookingId}` — der Bug ist genau die falsche URL, siehe Story-Hinweise).
- Style: Ghost/Link-Variant, `text-baerenstark-bark underline-offset-2 hover:underline`.

### 5.3 Variant: Eintrag ohne zugeordnete Buchung

Falls ein Kalender-Eintrag **kein** Booking referenziert (z.B. ein leerer Slot, eine Verfügbarkeits-Markierung, ein TimeSlot-Template ohne Buchung):

| Eintrags-Typ | „Buchung öffnen"-Verhalten |
|--------------|----------------------------|
| Buchung mit `bookingId` | Link aktiv → `/admin/bookings/{id}` |
| Leerer Zeitfenster-Slot (kein Booking) | **Button/Link nicht rendern** — stattdessen sekundärer CTA „Buchung manuell anlegen" (falls in Backlog, IT12 §5.1) **oder gar kein CTA** (IT14-Default). |
| Verfügbarkeits-Block (Tom's Verfügbarkeit, kein Slot) | Kein „Buchung öffnen" — Popover zeigt nur „Verfügbar" + Link „Verfügbarkeit bearbeiten" (falls Pattern existiert) oder keinen CTA. |

> **Verbindlich:** Wenn keine `bookingId` vorhanden ist, wird der Button **nicht gerendert** (statt disabled). Disabled-Buttons in Popovern sind verwirrend („wieso ist das Grau?"). Pattern: Button nur dann rendern, wenn ein definitives Ziel existiert. Default-Entscheidung — kann in QA-Phase angepasst werden, falls Tom konsistente Layout-Höhe pro Popover wünscht (dann disabled-Variant mit Tooltip „Kein Auftrag zu diesem Eintrag").

### 5.4 Mobile-Verhalten (Viewport < 768 px)

Auf Smartphones ist der Popover knapp — der „Buchung öffnen"-Link muss komfortabel klickbar sein.

| Aspekt | Anforderung |
|--------|-------------|
| Touch-Target | ≥ 44 × 44 px (verbindlich, WCAG 2.1 AA) |
| Position | Eigene Zeile (Block-Layout), unten im Popover, voller Breite |
| Padding | `py-3` (12 px vertikal) → ergibt mit Text-Line-Height 44 px |
| Visual | Ghost-Button mit voller Breite (`w-full`), zentriert, Pfeil-Icon rechts |
| Alternative falls Popover zu klein | Auf Mobile: statt Popover direkt zur Detail-Page navigieren (kein Zwischenschritt). Default-Entscheidung: **Popover bleibt** (UX-Konsistenz), aber Engineer prüft, ob FullCalendar auf Mobile ein anderes Default-Behavior hat. |

**Markup-Anhalt (Mobile):**

```tsx
<div className="rounded-lg border border-baerenstark-sand bg-baerenstark-cream/95 p-3 shadow-md">
  <StatusBadge status="CONFIRMED" />
  <h3 className="mt-2 text-sm font-medium">Wohnungsreinigung</h3>
  <p className="text-xs text-baerenstark-bark/70">Maria Müller</p>
  <p className="text-xs text-baerenstark-bark/70">Mo, 12.05.2026 · 09:00–11:00</p>
  {bookingId && (
    <Link
      href={`/admin/bookings/${bookingId}`}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-baerenstark-sand py-3 text-sm font-medium text-baerenstark-bark hover:bg-baerenstark-sand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-bark"
    >
      Buchung öffnen
      <ArrowUpRight className="h-4 w-4" aria-hidden />
    </Link>
  )}
</div>
```

### 5.5 Accessibility

- Link hat keinen zusätzlichen `aria-label` nötig — Text-Label „Buchung öffnen" ist eindeutig.
- Icon `aria-hidden="true"`.
- Bei aktivem Popover: `role="dialog" aria-label="Buchungsdetails"` am Popover-Container (Bestand IT12).
- Keyboard: Tab führt vom Popover-Header zum „Buchung öffnen"-Link, Enter aktiviert. Escape schließt Popover (Bestand).

### 5.6 Acceptance-Vermerk

- Klick auf „Buchung öffnen" lädt `/admin/bookings/{id}` mit HTTP 200 — kein 404.
- Mehrere Einträge: jeder hat seine eigene korrekte ID-Zuordnung.
- Mobile: Touch-Target erfüllt 44 × 44 px ohne Zoom/Scroll.

---

## 5a. Booking-Detail-Page (`/admin/bookings/[id]`) — kompakte Spec

> **Scope:** Kompakte Layout- und Interaktions-Spec für die neue Detail-Route. **Kein Neudesign** — konsistent mit bestehendem Admin-Layout (Sidebar + Content-Container, Tokens aus `design-system.md`/IT11-D1). Engineer kann existierende `BookingTable`-Item-Render-Pfade als Vorlage nutzen, oder einen dünnen Wrapper schreiben.

### 5a.1 Page-Layout (Desktop ≥ 1024 px)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Sidebar: Admin-Nav]   ┌───────────────────────────────────────┐│
│                        │ [← Zurück zu Buchungen]               ││
│                        │                                       ││
│                        │ Buchung #ab12cd · Wohnungsreinigung   ││  ← Header
│                        │ Mo, 12.05.2026 · 09:00–11:00          ││
│                        │ [● Bestätigt]                         ││  ← Status-Badge
│                        │                                       ││
│                        │ ── Aktionen ────────────────────────  ││  ← Aktions-Bereich
│                        │ [Bestätigen]  [Ablehnen]  [Abgeschl.] ││
│                        │ Endpreis: [____] €  [Speichern]       ││
│                        │ Zahlungsart: [Select] [Speichern]     ││
│                        │                                       ││
│                        │ ── Kunde ───────────────────────────  ││  ← Kunden-Info
│                        │ Maria Müller · maria@…  · +49 …       ││
│                        │ Adresse: Musterstr. 1, 64283 DA       ││
│                        │                                       ││
│                        │ ── Beschreibung ────────────────────  ││  ← Beschreibung/Notizen
│                        │ „2 Zimmer, Bad, Küche. Bitte …"       ││
│                        │ [Interne Notiz: textarea]             ││
│                        │                                       ││
│                        │ ── Bilder (3) ──────────────────────  ││  ← Galerie (optional)
│                        │ [img] [img] [img]                     ││
│                        └───────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

Auf < 768 px: Sidebar collapsed, Content full-width, Sektionen vertikal gestapelt; Aktions-Buttons werden auf Wunsch in einem Sticky-Bottom-Bar zusammengefasst — Engineer prüft Bestand-Pattern, IT14-Default: einfach untereinander.

### 5a.2 Page-Header

| Slot | Inhalt | Microcopy |
|------|--------|-----------|
| Back-Link | Pfeil-Icon + Text | „← Zurück zu Buchungen" → navigiert zu `/admin?tab=bookings` (oder zu `/admin/bookings` falls Liste-Page existiert; Engineer entscheidet basierend auf Routing-Bestand) |
| Heading | `<h1>` | „Buchung #{idShort} · {Service-Label}" — z.B. „Buchung #ab12cd · Wohnungsreinigung" |
| Sub-Heading | Termin + Dauer | „Mo, 12.05.2026 · 09:00–11:00" (DE-formatiert) |
| Status-Badge | Pill-Style, Solid | Aktueller Status (Pill-Tokens analog zu §2.3) |

### 5a.3 Aktions-Bereich

**Reihenfolge der Aktions-Buttons (verbindlich):**

1. **Bestätigen** (`PENDING → CONFIRMED`) — Primary-Solid, nur sichtbar wenn Status `PENDING`.
2. **Ablehnen** (`PENDING → REJECTED`) — Secondary-Outline, nur sichtbar wenn Status `PENDING`.
3. **Gegenvorschlag** (`PENDING → COUNTER_PROPOSED`) — Tertiary/Ghost, nur wenn Pattern bereits in Bestand existiert; sonst weglassen in IT14.
4. **Abgeschlossen markieren** (`CONFIRMED → COMPLETED`) — Primary-Solid, nur sichtbar wenn Status `CONFIRMED`.
5. **Stornieren** (`CONFIRMED → CANCELLED`) — Destructive-Ghost, nur wenn Bestand-Pattern existiert.

> Status-Übergänge folgen `ADMIN_ALLOWED_TRANSITIONS` aus `src/app/api/admin/bookings/[id]/route.ts`. Buttons rendern conditional basierend auf `booking.status`.

**Preis + Zahlungsart-Felder (siehe §3 + §4):**

- Preis-Feld: Input + „€"-Suffix + Save-Button + SaveFeedbackChip (siehe §3.2).
- Zahlungsart-Select: Native-Select mit Optionen `[BANK_TRANSFER, CASH]` + Placeholder „— bitte wählen —" wenn NULL (siehe §4.3, §4.4).
- **Save-Pattern:** Default ist **gemeinsamer Save-Button** „Anfrage aktualisieren" am Ende des Aktions-Bereichs (oder pro Feld, falls Bestand das so macht — Engineer entscheidet, siehe §9.3 Open Question). Bei gemeinsamem Save: ein Toast „Anfrage aktualisiert.". Bei pro-Feld-Save: Toasts wie in §3.2 / §4.4 Tabelle.

### 5a.4 Kunden-Info-Sektion

- **Heading:** `<h2>` „Kunde", `text-heading-3`-Token.
- **Felder (read-only, plain text):** Vorname Nachname · E-Mail (mailto-Link) · Telefon (tel-Link) · Adresse (Straße, PLZ, Ort).
- **Optional:** Falls Kunde einen Customer-Account hat, Link „Kundenprofil öffnen" → `/admin/users/{customerId}` (falls Bestand-Route existiert).
- A11y: E-Mail/Telefon-Links nutzen `mailto:` und `tel:`-Schemata; Tab-fokussierbar.

### 5a.5 Beschreibungs-/Notizen-Sektion

- **Kunden-Beschreibung (read-only):** Was der Kunde im Buchungsformular angegeben hat. Sektion-Heading „Beschreibung". Markup: `<p>` mit `whitespace-pre-wrap` (Zeilenumbrüche erhalten).
- **Interne Notiz (editierbar, optional):** Falls `internalNote`-Feld in Bestand-Schema existiert: `<textarea>` mit Save-Button (oder als Teil des gemeinsamen Save). Microcopy Label „Interne Notiz" + Helper „Nur für dich sichtbar — der Kunde sieht das nicht.". Falls kein internes Notiz-Feld in Schema: Sektion entfällt.

### 5a.6 Bilder-Galerie (optional)

Falls die Buchung Anhänge (`BookingAttachment[]`) hat, rendere Galerie:

- **Heading:** „Bilder ({count})".
- **Layout:** Grid mit 3 Spalten (Desktop), 2 Spalten (< 768 px). Thumbnails 120×120 px (Desktop) / 100×100 px (Mobile), `object-cover`, `rounded-md`.
- **Klick auf Thumbnail:** öffnet Lightbox/Modal (Bestand-Pattern, falls IT13 bereits eines liefert — sonst öffnet das Bild in neuem Tab via `<a href={url} target="_blank">`).
- **Empty-State:** keine Galerie-Sektion rendern, wenn `attachments.length === 0`.
- **A11y:** jedes Thumbnail hat `alt={`Bild ${index + 1} zu Buchung #${idShort}`}` (oder den vom Customer angegebenen Filename).

### 5a.7 Loading- und Error-States der Detail-Page

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `loading` | Page mountet, Daten pending | Skeleton mit Header-Skeleton + 3 Sektion-Skeletons |
| `not-found` | API 404 (Buchung gelöscht / falsche ID) | Centered: „Buchung nicht gefunden" + „← Zurück zu Buchungen" Link |
| `forbidden` | API 403 (z.B. Multi-Tenant zukünftig) | Centered: „Keine Berechtigung" + Link zu `/admin` |
| `error-server` | API 5xx | Centered: „Daten konnten nicht geladen werden" + „Erneut versuchen"-Button |
| `loaded` | Daten OK | Voller Page-Render wie in §5a.1 |

### 5a.8 Story-Coverage-Vermerk

| Story | Verwendung in Detail-Page |
|-------|---------------------------|
| IT14-S04 | Preis-Feld + SaveFeedbackChip im Aktions-Bereich |
| IT14-S05 | Zahlungsart-Select im Aktions-Bereich |
| IT14-S06 | Detail-Page selbst (Calendar-Popover-Ziel) |

---

## 6. IT14-S08 — Image-Upload-Status-States in Production

### 6.1 Bestehende States (IT13-Spec, unverändert in IT14)

Aus `ux-spec-iteration-13.md` IT13-S05 / `component-library-iteration-13.md` (FileUpload + bestehende IT11-D1-Tokens):

| State | Trigger | Sichtbar |
|-------|---------|----------|
| `idle` | Kein File ausgewählt | Drop-Zone neutral, Helper-Text „Bilder hierher ziehen oder auswählen" |
| `uploading` | File wurde ausgewählt, Upload läuft | Datei-Reihe mit Progress-Bar (0–100 %), Filename, Cancel-X |
| `success` | Upload abgeschlossen | Datei-Reihe mit Thumbnail/Vorschau + grüner Check, „Hochgeladen" |
| `error` | Upload fehlgeschlagen | Datei-Reihe mit rotem Warn-Icon + Inline-Fehler-Text, Retry-Button |

**Verbindlich für IT14-S08:** Diese States bleiben strukturell unverändert. Neu ist nur die **deutsche, user-freundliche Microcopy** für Production-spezifische Failure-Modi.

### 6.2 Production-Failure-Modi und User-Microcopy

Die in der Story benannten technischen Failures (`POST /api/upload/token` 503, `BLOB_NOT_CONFIGURED`, Direct-Upload zu Vercel Blob fehlgeschlagen) dürfen **niemals als Roh-Code-String** beim User landen. Mapping:

| Technischer Failure | User-Microcopy (DE, Du-Form, Inline an Datei-Reihe) | Toast-Variant |
|---------------------|------------------------------------------------------|---------------|
| `POST /api/upload/token` 503 + `BLOB_NOT_CONFIGURED` | „Upload aktuell nicht möglich. Wir kümmern uns darum — bitte später erneut versuchen oder ohne Bild abschicken." | error, 6 s |
| `POST /api/upload/token` 500 / generischer Server-Fehler | „Upload fehlgeschlagen. Bitte erneut versuchen." | error, 5 s |
| Direct-Upload zu Vercel Blob Network-Fehler / Timeout | „Verbindung zum Bild-Speicher unterbrochen. Bitte erneut versuchen." | error, 5 s |
| Direct-Upload Auth-Fehler (Token expired/invalid) | „Upload-Sitzung abgelaufen. Bitte Datei erneut wählen." | warning, 5 s |
| `POST /api/upload/confirm` 4xx/5xx (nach erfolgreichem Direct-Upload) | „Bild wurde hochgeladen, konnte aber nicht zugeordnet werden. Bitte erneut versuchen." | error, 5 s |
| Datei zu groß (Bild > 10 MB) | „Datei zu groß (max. 10 MB)." | warning, 5 s (Bestand IT11) |
| Falscher Dateityp | „Dieser Dateityp wird nicht unterstützt. Erlaubt: JPEG, PNG." | warning, 4 s (Bestand IT11) |

> **Verbindliche Regel:** Niemals englische Codes (`BLOB_NOT_CONFIGURED`, `INTERNAL_ERROR`, `503`), niemals Stack-Traces, niemals technische ID-Strings im User-sichtbaren Text. Die `X-Request-Id` darf optional **klein und leise** im Inline-Fehler-Block stehen für Support-Zwecke (`text-xs text-baerenstark-bark/40`, z.B. „Code: req_a1b2"), aber nur falls Tom das im Support-Workflow nutzen möchte.

### 6.3 Sichtbarer Inline-Fehler-Block

```
┌────────────────────────────────────────────────────┐
│  📷 wohnzimmer.jpg                       [↻]       │
│  ────────────────────────────────────────  3.2 MB  │
│  ⚠ Upload aktuell nicht möglich. Wir kümmern      │
│     uns darum — bitte später erneut versuchen      │
│     oder ohne Bild abschicken.                     │
│     Code: req_a1b2c3 (optional, sehr klein)        │
│  [ Erneut versuchen ]   [ Datei entfernen ]        │
└────────────────────────────────────────────────────┘
```

- **Warn-Icon:** `AlertTriangle` (16 px, `text-feedback-error`).
- **Retry-Button:** „Erneut versuchen" — primär (lädt erneut hoch).
- **Remove-Button:** „Datei entfernen" — sekundär/ghost (entfernt aus Liste, Submit kann ohne Datei weiterlaufen).

### 6.4 Submit-Verhalten bei Upload-Failure

> **Verbindlich (Bestand IT11-§3.4):** Submit des Buchungsformulars bleibt **aktiv**, auch wenn ein Upload fehlschlägt. Bilder sind optional. User kann die Anfrage ohne Bild abschicken — Tom ruft dann ggf. zurück.

Microcopy am Submit-Button (falls eine Datei mit Error-State in der Liste ist):

- Submit-Button bleibt aktiv. Kein zusätzliches Banner. Der Inline-Fehler an der Datei-Reihe + die Möglichkeit, sie zu entfernen, ist ausreichend.

### 6.5 Accessibility

- Upload-Status-Live-Region (Bestand IT11-§3.4): `<div role="status" aria-live="polite">` — bei Error-State Announcement: „{filename}: Upload fehlgeschlagen. {Microcopy}."
- Retry-Button: regulärer `<button>` — keyboard-fokussierbar.
- Inline-Error-Text hat keinen `role="alert"` (würde mit Live-Region kollidieren) — die Live-Region außenrum trägt die SR-Announcement.

### 6.6 Acceptance-Vermerk

- Bei Production-Failure sieht der User **nie** englische Codes oder Stack-Traces.
- Microcopy ist deutschsprachig und konstruktiv (sagt was zu tun ist: erneut versuchen / ohne Bild abschicken).
- Submit-Pfad bleibt funktional (User kann Anfrage ohne Bild senden).

---

## 7. Globale Acceptance — UX IT14

- ✓ Pill-Pattern in `/admin/bookings` ist **Multi-Select** (`role="checkbox"`, `aria-checked`); zeigt beim Page-Load „Offen" + „Bestätigt" als aktiv, alle anderen vier (`COUNTER_PROPOSED`, `CANCELLED`, `REJECTED`, `COMPLETED`) als outline.
- ✓ Edge-Case „alle Pills aus" zeigt eigenen Empty-State „Wähle mindestens einen Status" mit Reset-CTA.
- ✓ Empty-State „Keine offenen Anfragen" rendert centered mit `Inbox`-Icon, Headline, Subline, sekundärem CTA.
- ✓ Preis-Speichern liefert Toast (success) + Inline-„Gespeichert"-Chip; Server-Fehler liefert Toast (error) ohne Wertverlust im Feld.
- ✓ Zahlungsart-Dropdown enthält **nur** `BANK_TRANSFER` und `CASH` — keine `CARD`/`INVOICE`/`STRIPE`-Optionen. NULL-Bestand zeigt Placeholder „— bitte wählen —", kein Badge in Liste.
- ✓ Customer-Buchungsformular zeigt **kein** Payment-Method-Feld; `paymentMethod` wird Admin-seitig nachgetragen.
- ✓ „Buchung öffnen"-Link im Calendar-Popover navigiert zu `/admin/bookings/{id}` (echte Detail-Route, HTTP 200, kein 404); auf Mobile ≥ 44 px Touch-Target; ohne `bookingId` wird Button nicht gerendert.
- ✓ Detail-Page (`/admin/bookings/[id]`) folgt §5a-Spec: Header mit Status-Badge, Aktions-Bereich (Status-Übergänge + Preis + Zahlungsart), Kunden-Info, Beschreibung/Notizen, optional Bilder.
- ✓ Image-Upload-Failures werden mit deutscher, user-freundlicher Microcopy angezeigt — kein roher Error-Code im UI; Submit-Pfad bleibt offen.
- ✓ Prefill-Regression: bestehende UX-States bleiben gültig; Fix verifiziert via gefüllter Felder + sichtbarem PrefillNotice (Du-Form, IT13-§3).

---

## 8. Story-Coverage IT14

| Story | UX-Deliverable IT14 |
|-------|---------------------|
| IT14-S01 | §1 — Bug-Manifestation dokumentiert; keine neue UX. |
| IT14-S02 | (Reine Server-/Middleware-Story, kein UX-Anteil — Login-Redirect nutzt bestehende Spec.) |
| IT14-S03 | §2 — Multi-Select-Filter-Pills (mit `role="checkbox"`), Default `[PENDING, CONFIRMED]`, voller 6-Werte-Enum, zwei Empty-State-Variants. |
| IT14-S04 | §3 — Save-Feedback (Toast + Inline-Chip), Error-States, Mobile/A11y. |
| IT14-S05 | §4 — Select-Pattern mit kanonischem Enum `[BANK_TRANSFER, CASH]`, NULL-Render-Verhalten, Customer-Submit-Bestätigung. |
| IT14-S06 | §5 — Link-URL auf echte Detail-Route, Mobile-Touch-Target. **§5a — Detail-Page-Spec** (Layout, Aktions-Bereich, Kunden-Info, Beschreibung, Bilder, Loading/Error-States). |
| IT14-S07 | (Reine Datenkorrektur-Story, kein UX-Anteil.) |
| IT14-S08 | §6 — Microcopy-Mapping für Production-Failures, Inline-Fehler-Block, Submit-Verhalten. |

---

## 9. Offene Fragen / NEEDS INPUT

1. **[NEEDS INPUT — Tom — IT14-S03]** Soll im Empty-State der CTA „Alle Anfragen anzeigen →" wirklich alle 6 Status aktiv schalten, oder nur einen Reset auf Default? **Default-Entscheidung dieser Spec:** schaltet alle 6 aktiv (gibt Tom maximale Sicht); kann in QA-Phase angepasst werden.
2. **[NEEDS INPUT — Tom — IT14-S05]** Soll Zahlungsart als Pflichtfeld markiert werden (vor Status-Übergang auf „Abgeschlossen")? **Default-Entscheidung:** **kein Pflichtfeld**, optional. Anpassbar.
3. **[NEEDS INPUT — Engineer — IT14-S04 / S05 / S06]** Existiert in der Detail-Page ein **gemeinsamer** Save-Button (für Preis + Zahlungsart + Notizen) oder pro Feld? **Default-Entscheidung:** gemeinsamer Save-Button „Anfrage aktualisieren" mit ein Toast „Anfrage aktualisiert.". Wenn pro-Feld-Save bevorzugt wird (z.B. weil die Status-Übergangs-Buttons schon individuelle Aktionen sind), pro-Feld-Toasts wie in §3 / §4.
4. **[NEEDS INPUT — Engineer — IT14-S06]** Bei Kalender-Einträgen ohne `bookingId`: ist die Variant „Button nicht rendern" backend-seitig sauber von „leerer Slot" vs. „Verfügbarkeits-Block" unterscheidbar? Falls nicht, müsste die Logik vereinfacht werden auf „Button nur rendern wenn `event.extendedProps.bookingId`".
5. **[NEEDS INPUT — Tom — IT14-S05]** Reihenfolge der zwei Payment-Methods im Select: aktuell „Überweisung" zuerst, „Barzahlung" zweitens. Tom kann das in QA umkehren, falls Bar häufiger verwendet wird.

---

*Ende der UX-Spec Iteration 14.*
