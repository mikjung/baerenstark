# Frontend Requirements — Iteration 14

**Owner:** Solution Architect
**Datum:** 2026-05-04
**Revision:** 2 (nach QA_DESIGN_REVIEW_IT14)
**Scope:** Frontend-spezifische Änderungen für IT14 (Bug-Fix-Iteration).
Backend-Änderungen siehe `ARCHITECTURE_IT14.md` und
`contracts/iteration-14.openapi.yaml`.

> Diese Datei beschreibt **nur, was sich im Frontend ändert**. Stack
> (Next.js 14 App Router, TypeScript, TailwindCSS, RHF + Zod) bleibt
> unverändert.

## Revision-Log

**Rev 2 (2026-05-04 — nach QA-Review):**
- S05 Zahlungsart-Liste finalisiert: `'CASH' | 'BANK_TRANSFER'` (kein
  STRIPE/CARD/INVOICE — siehe ARCHITECTURE_IT14.md §4.2).
- S06 wechselt von Anker-Pattern auf neue Detail-Route
  `/admin/bookings/[id]` — `BookingTable.tsx` braucht KEINE Anker-IDs
  mehr.
- S04 Schema-Refactor (C-5) ist **verbindlich**, kein „kosmetisch":
  `BookingAdminSchemaIT14` ist kanonischer Liste-Type, alle `as`-Casts
  entfernen.
- S03 Multi-Select bestätigt — Bestand ist Single-Select, Refactor
  ist explizit gewollt (siehe §2 unten).
- COUNTER_PROPOSED-Behandlung im Filter explizit dokumentiert (§2).
- NULL-paymentMethod-Render explizit dokumentiert (§3).

---

## 1. Story-übergreifende Hinweise

- Alle Komponenten-Änderungen sind chirurgisch; keine neuen Pages,
  keine neuen Routen außer ggf. die in S06.
- **i18n:** Du-Form (IT13-Default).
- **a11y:** alle neuen Form-Elemente brauchen `aria-label` /
  `aria-describedby`; alle Foki-Reihenfolgen erhalten.

---

## 2. S03 — Default-Filter im Admin-Dashboard

### Datei: `src/components/admin/BookingTable.tsx`

**Bug-Lokalisierung:** Zeile 75:
```ts
const [filter, setFilter] = useState<StatusFilter>('ALL');
```

**Problem:** Bei initialem Mount zeigt der Filter „Alle" — Tom muss
manuell auf „Offen + Bestätigt" klicken um seine offenen Aufträge zu
sehen. Dies ist nicht erlaubt: Story-AC#1 verlangt **„Offen" + „Bestätigt"
sind vorausgewählt**.

### Lösung: Multi-Select-Filter

**Bestand (Code-Read verifiziert):** `StatusFilter = 'ALL' | BookingStatus`.
**Single-Select-Pattern**. Tom kann genau einen Status oder „Alle" wählen.

**Soll (Rev 2 final):** **Multi-Select-Pattern**. Initial-State:
`new Set(['PENDING', 'CONFIRMED'])`.

**WICHTIG (Klarstellung nach QA-Review M-S03):** Die UX-Spec §2.1
spricht von „Pills bleiben das UI-Pattern. Multi-Select." — dieser
Refactor von Single-Select auf Multi-Select ist **bewusst und
gewollt** in IT14. Bestand wird nicht beibehalten; das Pill-UI bleibt
optisch ähnlich, aber semantisch wechselt es auf Multi-Select.

### Status-Werte (vollständig, kanonisch)

`BookingStatusSchema` (in `contracts/zod-schemas.ts` Zeile 175–182)
hat **6 Werte** — alle müssen im Filter-Pill-Set vorhanden sein:

| Pill-Label | BookingStatus-Wert | Default-aktiv? |
|---|---|---|
| Offen | `PENDING` | **JA** |
| Bestätigt | `CONFIRMED` | **JA** |
| Gegenvorschlag | `COUNTER_PROPOSED` | NEIN |
| Abgelehnt | `REJECTED` | NEIN |
| Storniert | `CANCELLED` | NEIN |
| Abgeschlossen | `COMPLETED` | NEIN |

**M-COUNTER_PROPOSED-Auflösung:** `COUNTER_PROPOSED` ist im Default-
Filter **ausgeschlossen**, aber als Pill **sichtbar und aktivierbar**.
Tom kann jederzeit auf den Pill klicken um Gegenvorschläge zu sehen.

**Wichtig: kein verstecktes Datenleck.** Der Default-Filter zeigt nur
zwei Status — wenn Tom einen Counter-Proposal-State hat, ist die
Buchung im Default-View **nicht** sichtbar. Das ist akzeptabel, weil
der Pill „Gegenvorschlag" mit einem Badge-Counter (Bestand der
Component-Library) anzeigt: „Du hast 2 Buchungen im Status
Gegenvorschlag — klicke um anzuzeigen."

**Tipp Engineer:** Falls die Pill-Counter heute nicht implementiert
sind, **nicht** im Rahmen IT14 nachrüsten — separates UX-Ticket.
IT14 geht es nur um den Default-Filter und die Multi-Select-Mechanik.

**State-Refactor:**
```ts
type ActiveFilters = ReadonlySet<BookingStatus>;
const DEFAULT_FILTERS: ActiveFilters = new Set(['PENDING', 'CONFIRMED']);
const [filter, setFilter] = useState<ActiveFilters>(DEFAULT_FILTERS);

const filtered = useMemo(() => {
  if (filter.size === 0) return bookings; // „Keine Auswahl = alle"
  return bookings.filter((b) => filter.has(b.status));
}, [bookings, filter]);
```

**UI-Änderung der Filter-Pills (Zeile 203–225):**
- Aus „Tabs" (single-select, role="tab") werden „Toggle-Chips"
  (multi-select, role="checkbox" oder role="button" mit aria-pressed).
- Die „Alle"-Pille wird zu „Alle anzeigen" — Klick setzt `filter` auf
  `new Set([all status values])`.
- Eine zusätzliche „Zurücksetzen"-Pille setzt `filter` auf
  `DEFAULT_FILTERS`.

**a11y:**
```tsx
<button
  type="button"
  role="checkbox"
  aria-checked={filter.has('PENDING')}
  onClick={() => toggle('PENDING')}
  className={isActive ? activeClasses : inactiveClasses}
>
  Offen
</button>
```

**AC#3 (kein Persist über Sessions):** Nichts in localStorage / DB
speichern. Default-Filter wird beim Mount jedes Mal frisch gesetzt
(`useState(DEFAULT_FILTERS)` reicht).

**AC#4 (Empty-State):** Bestand-Logik in Zeile 234–241 nutzt schon
`filter === 'ALL'`. Nach Refactor: `filter.size === 0 || filter ===
DEFAULT_FILTERS_EQUIV` für die Default-Frage „Es liegen noch keine
Anfragen vor" oder „Keine offenen Anfragen". Kosmetischer Detail —
Engineer wählt klare Texte.

### Story-Coverage S03

| AC | Frontend-Deliverable |
|---|---|
| AC#1 | Filter-Initial-State auf `['PENDING', 'CONFIRMED']` |
| AC#2 | `filtered`-Memo greift `filter.has(b.status)` |
| AC#3 | Kein Persist (kein localStorage, kein URL-Param) |
| AC#4 | Empty-State mit angepasstem Text „Keine offenen Anfragen" wenn DEFAULT_FILTERS aktiv und Liste leer |

---

## 3. S05 — Cash-Payment-Auswahl

### Wo erscheint das UI

Story-AC#1: „Tom öffnet die Detail-Ansicht einer Buchungsanfrage im
Admin-Dashboard, … Zahlungsart-Auswahl angezeigt".

**Detail-Ansicht** = Karten-View in `BookingTable.tsx`. Es gibt aktuell
keine separate Detail-Page (siehe S06-Diagnose). Die Zahlungsart-
Auswahl wird in **`FinalPriceEditor.tsx`** ergänzt — diese Komponente
wird bereits in jeder Buchungs-Karte gerendert (Zeile 466–491 in
`BookingTable.tsx`).

### Datei: `src/components/admin/FinalPriceEditor.tsx`

**Bestand (Code-Read Zeile 70–155 verifiziert):** Zwei Felder (Endpreis €,
Notiz) + Speichern-Button. **Save-Pattern: expliziter Submit-Button**
(`<form onSubmit={...}>` Zeile 119, `<Button type="submit">` Zeile 151).
Der `savedTick`-State zeigt „Gespeichert." als Inline-Bestätigung
(Zeile 75, 99). **Kein Pattern-Wechsel nötig** (M-5-Auflösung); UX-Spec
§3.4 alignt automatisch mit Bestand.

**Soll:** Drittes Feld „Zahlungsart" als Select (Dropdown) mit den
Werten (Rev 2 final):

| Anzeige | Submit-Wert |
|---|---|
| „— Nicht erfasst —" | `''` → serialisiert als `null` |
| „Bar" | `'CASH'` |
| „Überweisung" | `'BANK_TRANSFER'` |

**STRIPE/CARD/INVOICE entfallen** — siehe ARCHITECTURE_IT14.md §4.2
Begründung. Stripe-Bookings werden im Bestand-Pfad (`PaymentEditor` /
Stripe-Audit-Trail) angezeigt, nicht über `paymentMethod`.

**Reihenfolge im Dropdown** (UX-Vorgabe): „Nicht erfasst" oben,
dann „Bar", dann „Überweisung".

**Layout:** das Grid in Zeile 131 wechseln auf
`sm:grid-cols-[180px_160px_1fr_auto]` (Endpreis | Zahlungsart |
Notiz | Button). Auf Mobile stapelt es vertikal.

**Submit-Pfad:** existierender `patchAdminBooking()`-Call in Zeile
95–98. Payload um `paymentMethod` erweitern:
```ts
await patchAdminBooking(bookingId, {
  finalPriceEur: v.value,
  finalPriceNote: noteInput.trim() === '' ? null : noteInput.trim(),
  paymentMethod: paymentMethodInput === '' ? null : paymentMethodInput,
});
```

Dropdown-Component: native `<select>` ist OK (a11y out-of-the-box,
kein Redesign-Aufwand). Falls `Select`-Component aus
`src/components/ui/` existiert, gerne nutzen — Engineer-Wahl.

**Initial-State:**
```ts
const [paymentMethodInput, setPaymentMethodInput] =
  useState<PaymentMethod | ''>(initialPaymentMethod ?? '');
```

Neue Prop:
```ts
import type { PaymentMethod } from '@/contracts/zod-schemas';

interface Props {
  bookingId: string;
  initialFinalPriceEur: string | null;
  initialFinalPriceNote: string | null;
  initialPaymentMethod: PaymentMethod | null;  // ← NEU
  onSaved?: (
    finalPriceEur: string | null,
    finalPriceNote: string | null,
    paymentMethod: PaymentMethod | null,       // ← NEU
  ) => void;
}
```

### Datei: `src/components/admin/BookingTable.tsx`

**Aufruf-Stelle Zeile 467–491:**
- Neue Prop `initialPaymentMethod={b.paymentMethod}` durchreichen
  — **kein** `as`-Cast mehr (siehe §5 für Schema-Refactor).
- `onSaved`-Callback um den dritten Parameter erweitern.

**Zusätzlich: Badge-Anzeige** (analog zum existierenden
`finalPriceEur`-Badge Zeile 287–303):

| `paymentMethod`-Wert | Badge | Tone |
|---|---|---|
| `'CASH'` | „Bar" | `info` |
| `'BANK_TRANSFER'` | „Überweisung" | `info` |
| `null` / `undefined` | **kein Badge** | — |

**M-3-Auflösung (NULL-Render):** Bestandsbuchungen mit
`paymentMethod = NULL` zeigen **keinen** Badge in der Liste — sauber
leer, kein „—", kein Empty-Box-Glitch. Tom sieht nur dort einen Badge,
wo er bewusst eine Zahlungsart erfasst hat. Der `FinalPriceEditor`-
Select zeigt dann „— Nicht erfasst —" als Default-Option.

### Story-Coverage S05

| AC | Frontend-Deliverable |
|---|---|
| AC#1 | „Bar"-Option im Select sichtbar (1. echte Option nach „Nicht erfasst") |
| AC#2 | Nach Save + Reload: gewählter Wert wieder im Select. Badge in der Liste sichtbar. |
| AC#3 | Bestehende Optionen (Endpreis, Notiz) funktionieren unverändert |
| AC#4 | API-Response enthält `paymentMethod: 'CASH'` (siehe OpenAPI §components/PaymentMethod) |

---

## 4. S06 — Calendar-404-Fix (Rev 2: Detail-Route)

### Architektur-Entscheidung (Rev 2)

Statt Anker-Pattern (frühere Rev 1) wird eine **echte Detail-Route**
`/admin/bookings/[id]` neu angelegt — alignt mit UX-Spec, vermeidet
Edge-Cases mit Default-Filter und Mobile. Siehe ARCHITECTURE_IT14.md
§5.3 für Begründung.

### Datei (NEU): `src/app/admin/bookings/[id]/page.tsx`

Server-Component-Page, dünner Wrapper. Architect-Vorgabe siehe
ARCHITECTURE_IT14.md §5.4 — Page-Inhalt minimal:
1. `await requireActiveAdmin()` als erste Anweisung (Auth-Gate).
2. `prisma.booking.findUnique({ where: { id } })` — alle Felder, die
   der Detail-View braucht.
3. Bei nicht gefunden: `notFound()`.
4. Render: `<AdminBookingDetailView booking={booking} />`.

**Metadata:** `{ title: 'Buchung – Bärenstark Admin', robots: { index:
false, follow: false } }`.

### Datei (NEU): `src/components/admin/AdminBookingDetailView.tsx`

Client-Component (`'use client'`), dünner Wrapper. **Geschätzt
50–80 LOC.**

**Inhalts-Vertrag:**
- Header: Customer-Name, Status-Badge (Bestand-Badge-Komponente),
  „← Zurück zur Übersicht"-Link auf `/admin`.
- Booking-Details-Block (Datum, Uhrzeit, Service, Adresse,
  Beschreibung) — Bestand-Markup aus `BookingTable.tsx` Zeile
  257–500 kann übernommen werden.
- Action-Buttons je nach `booking.status`:
  - `PENDING` → „Bestätigen", „Ablehnen", „Gegenvorschlag" (Bestand-
    Handler `patchBookingStatus`).
  - `CONFIRMED` → „Abschließen", „Stornieren".
  - `COMPLETED` → keine Status-Aktion (nur Preis-Felder editierbar).
- `<FinalPriceEditor>` — eingebettet, S05-erweitert um Zahlungsart-Select.
- `<PaymentEditor>` — falls `payment` existiert, Bestand-Block unten.

**Engineer-Hinweis:** Refactor von `BookingTable.tsx`-Item-Render in
eine geteilte `BookingCard`-Komponente ist erlaubt aber nicht zwingend
— Minimal-Variante: Markup duplizieren und Aktion-Handler direkt im
DetailView aufrufen.

### Datei: `src/components/admin/AdminCalendarView.tsx`

**Zeile 178–187 — `handleEventClick`:**
```ts
const handleEventClick = useCallback((event: CalendarEvent) => {
  if (event.type !== 'BOOKING' || !event.url) {
    setPopover(null);
    return;
  }
  setPopover({
    event,
    href: event.url ?? `/admin/bookings/${encodeURIComponent(event.id)}`,
  });
}, []);
```

**Zeile 185 — Fallback-Pfad** zurück auf saubere Detail-Route:
```ts
href: event.url ?? `/admin/bookings/${encodeURIComponent(event.id)}`,
```

**M-8-Auflösung (BUFFER/AVAILABILITY):** Backend setzt `url` nur bei
`type='BOOKING'`. Frontend MUSS den „Buchung öffnen"-Button **nur**
rendern, wenn `event.type === 'BOOKING' && event.url` truthy ist.
Bei BUFFER/AVAILABILITY: Popover ohne Link-Button (oder gar kein
Popover — Engineer-Wahl gemäß UX-Spec).

### Datei: `src/components/admin/BookingTable.tsx`

**KEINE Änderung in IT14 aus S06.** Die Anker-IDs aus Rev 1 sind nicht
mehr nötig — Calendar-Klick führt zu eigener Detail-Page.

### Story-Coverage S06 (Rev 2)

| AC | Frontend-Deliverable |
|---|---|
| AC#1 | „Buchung öffnen"-Link bestehend im Popover (nur bei `type='BOOKING' && url`) |
| AC#2 | Link führt nicht mehr zu 404 — landet auf neu angelegter `/admin/bookings/[id]` |
| AC#3 | Korrekte ID-Zuordnung durch URL-Parameter `[id]` (eindeutig, kein Filter-Edge-Case) |
| AC#4 | Mobile: Detail-Page nutzt Bestand-Tailwind-Responsive — kein Code-Aufwand |

---

## 5. S04 — Preis-Persistierung + Schema-Refactor (C-5 verbindlich)

**Klassifikation:** Backend-Bug (siehe ARCHITECTURE_IT14 §3) PLUS
Frontend-Schema-Refactor. Der Schema-Refactor ist **verbindlich** für
IT14, **nicht „kosmetisch"** — siehe QA-Review C-5.

### TypeScript-Type für die Booking-Liste — Source of Truth

**Datei:** `contracts/zod-schemas.ts`.

**Heute (Bestand):**
```ts
// Zeile 670+: Bestand-Schema, OHNE finalPriceEur:
export const BookingAdminSchema = z.object({ /* IT12-Felder */ });
export type BookingAdmin = z.infer<typeof BookingAdminSchema>;

// Zeile 2138+: IT6-Erweiterung mit finalPriceEur, ohne paymentMethod:
export const BookingAdminSchemaIT6 = BookingAdminSchema.extend({
  finalPriceEur: z.string().nullable(),
  finalPriceNote: z.string().nullable(),
});
export type BookingAdminIT6 = z.infer<typeof BookingAdminSchemaIT6>;
```

**Soll (NEU in IT14):**
```ts
import type { PaymentMethod } from './zod-schemas'; // gleiche Datei

export const PaymentMethodSchema = z.enum(['CASH', 'BANK_TRANSFER']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const BookingAdminSchemaIT14 = BookingAdminSchemaIT6.extend({
  paymentMethod: PaymentMethodSchema.nullable(),
});
export type BookingAdminIT14 = z.infer<typeof BookingAdminSchemaIT14>;
```

### Wo der Type konsumiert wird (verbindliche Liste)

| Datei | Aktuell | Soll (IT14) |
|---|---|---|
| `src/lib/api-client-it6.ts` `fetchBookings()` | gibt `BookingAdmin[]` zurück (Cast nötig) | `Promise<BookingAdminIT14[]>` |
| `src/lib/api-client-it6.ts` `patchAdminBooking()` Rückgabe | `BookingAdminIT6` | `BookingAdminIT14` |
| `src/components/admin/BookingTable.tsx` Zeile 287–303 (Badge-Render) | `(b as BookingAdmin & {...}).finalPriceEur` | `b.finalPriceEur` (kein Cast) |
| `src/components/admin/BookingTable.tsx` Zeile 469–475 (FinalPriceEditor-Aufruf) | `(b as ...).finalPriceEur` | `b.finalPriceEur`, `b.finalPriceNote`, `b.paymentMethod` |

**Verbindliche Engineer-Aufgabe in Phase 3:**
1. `BookingAdminSchemaIT14` in `contracts/zod-schemas.ts` einführen.
2. `fetchBookings()`-Rückgabe-Type auf `BookingAdminIT14[]` setzen
   und intern via `z.array(BookingAdminSchemaIT14).parse(...)`
   validieren (oder `safeParse` mit Logging).
3. **Alle `as BookingAdmin & {...}`-Casts entfernen** —
   `BookingTable.tsx` Zeile 287–303 und 469–475 (zwei Stellen).
4. TypeScript-Build muss durchlaufen ohne Casts (Compiler garantiert,
   dass das Server-Response-Schema mit dem Liste-Type konsistent ist).

**Warum das nicht kosmetisch ist:** ohne den Refactor bleibt der
Cast als Vertragsbruch zwischen Server-Response und Frontend-Type
bestehen. Nach S05 kommt `paymentMethod` dazu — wenn der Cast bleibt,
erweitert sich die Liste der „as"-Properties auf 3, und jeder
nachfolgende Engineer muss raten, welche Felder aus dem Server
wirklich kommen. **Der Refactor schließt die Vertragslücke.**

### Story-Coverage S04 (Frontend-Anteil)

| AC | Frontend-Deliverable |
|---|---|
| AC#1 (200 + Erfolgs-Toast) | Bestand: `FinalPriceEditor.tsx` Zeile 99 zeigt „Gespeichert." |
| AC#2 (Reload zeigt Wert) | Backend-Fix + Schema-Refactor (oben) |
| AC#3 (überschreiben) | Bestand |
| AC#4 (leer-speichern) | Bestand: `validate('')` → `{ ok: true, value: null }` |
| AC#5 (GET enthält Wert) | Backend-Fix |
| **C-5 (Schema-Cleanup)** | `BookingAdminSchemaIT14` als Liste-Type, alle Casts entfernt |

---

## 6. S01 — Prefill-Regression (UI-seitige Annahme)

**Klassifikation:** Production-spezifischer Diagnose-Bug (siehe
ARCHITECTURE_IT14 §1.1). Code-Pfad ist sauber laut IT13-QA.

### Annahme: UI ändert sich nicht

Wenn die Production-Diagnose ergibt, dass die Ursache eine
**Cookie-Domain** oder **AUTH_SECRET-Drift** ist (höchste
Wahrscheinlichkeit), ist KEINE UI-Änderung nötig.

### Falls UI-Änderung doch erforderlich: defensiv-Patch im `useCustomer`-Hook

**Hypothese — vom Engineer in Phase 3 zu bestätigen:** wenn nach
`emitCustomerChanged()` ein 401-Race auftritt, könnte folgender
defensive-Patch helfen:

**Datei:** `src/lib/use-customer.ts` Zeile 39–73:

```ts
const fetchMe = async (signal?: AbortSignal) => {
  // Defensiv: bei initial-load (lastKnown === 'loading') in den
  // ersten 500ms keinen 401-Status setzen (verhindert Skeleton-
  // Flackern in der ersten Hydration-Phase).
  const isInitialLoad = lastKnownStatusRef.current === 'loading';
  const startTime = Date.now();

  try {
    const me = await getCustomerMe();
    if (signal?.aborted) return;
    if (me) { /* ... */ }
    else {
      // Wenn initial-load und Antwort kommt zu schnell (<200ms),
      // einen Frame warten — verhindert Race mit OAuth-Finalize.
      if (isInitialLoad && Date.now() - startTime < 200) {
        await new Promise(r => setTimeout(r, 100));
        const retry = await getCustomerMe();
        if (signal?.aborted) return;
        if (retry) {
          setCustomer(retry);
          setStatus('authenticated');
          lastKnownStatusRef.current = 'authenticated';
          return;
        }
      }
      setCustomer(null);
      setStatus('unauthenticated');
      lastKnownStatusRef.current = 'unauthenticated';
    }
  } catch (err) { /* unverändert */ }
};
```

**Engineer-Aufgabe:** dieser Patch ist Hypothese — nur einbauen, wenn
Diagnose-Schritte 1+2 in §1.1 keine Production-Setup-Ursache zeigen.

### Story-Coverage S01

| AC | Frontend-Deliverable |
|---|---|
| AC#1–AC#3 | Falls Production-Setup OK ist: Bestand. Falls Race-Bedingung: defensive Patch wie oben. |
| AC#4 | Bestand: anonyme User → `getCustomerMe() → null` → leere Defaults |
| AC#5 | Backend-Aufgabe (Production-Logs) |
| AC#6 | Doku-Aufgabe — PR-Beschreibung |

---

## 7. Komponenten-Matrix (geändert in IT14, Rev 2)

| Komponente | Story | Änderung |
|---|---|---|
| `AdminDashboard` | — | KEINE Änderung |
| `BookingTable` | S03 | Filter-Default auf Multi-Select `['PENDING', 'CONFIRMED']` |
| `BookingTable` | S04 | `as`-Casts entfernen — Liste-Type wechselt auf `BookingAdminIT14[]` |
| `BookingTable` | S05 | `paymentMethod`-Badge (Bar/Überweisung) in der Karte; Prop für `FinalPriceEditor` |
| `BookingTable` | S06 | KEINE Änderung (Detail-Route übernimmt — Anker-Pattern verworfen) |
| `FinalPriceEditor` | S05 | drittes Feld „Zahlungsart" (Select), Submit-Pfad erweitert |
| `AdminCalendarView` | S06 | Fallback-URL zurück auf `/admin/bookings/{id}`; BUFFER/AVAILABILITY → kein Link-Button |
| **NEU `app/admin/bookings/[id]/page.tsx`** | S06 | Server-Component-Detail-Page |
| **NEU `AdminBookingDetailView`** | S06 | Client-Component, dünner Wrapper um Booking-Card-Inhalte |
| **NEU `app/admin/layout.tsx`** | S02 | `await requireActiveAdmin()` (Schicht 2) |
| `useCustomer` | S01 | OPTIONAL: defensive Retry (nur wenn Race-Bedingung in Phase 3 nachgewiesen) |
| `BookingForm` / `BookingClient` | S01 | KEINE Änderung — Code-Pfad ist OK |

---

## 8. State-Verträge

### 8.1 BookingTable Filter-State

```ts
type ActiveFilters = ReadonlySet<BookingStatus>;
const DEFAULT_FILTERS: ActiveFilters = new Set(['PENDING', 'CONFIRMED']);

interface BookingTableState {
  filter: ActiveFilters;       // NEU multi-select
}
```

(Anker-/Highlight-State aus Rev 1 entfernt — S06 nutzt jetzt eine
echte Detail-Route, nicht mehr `?focus=`.)

### 8.2 FinalPriceEditor State

```ts
interface FinalPriceEditorState {
  priceInput: string;
  noteInput: string;
  paymentMethodInput: PaymentMethod | '';  // NEU
  validationError: string | null;
  serverError: string | null;
  submitting: boolean;
  savedTick: string | null;
}
```

---

## 9. Validation Rules (Frontend)

| Feld | Regel |
|---|---|
| `paymentMethod` | Select mit Werten `''` (leer = NULL), `'CASH'`, `'BANK_TRANSFER'`. Submit serialisiert `''` → `null`. KEINE STRIPE/CARD/INVOICE-Werte. |
| `finalPriceEur` | Bestand: `^\d+([.,]\d{1,2})?$`, 0..100 000. |
| `finalPriceNote` | max 200 Zeichen. |

---

## 10. a11y-Notizen

- Die Filter-Pills in `BookingTable.tsx` werden von `role="tab"` auf
  `role="checkbox"` mit `aria-checked` umgestellt (Multi-Select).
- Native `<select>` für `paymentMethod` ist a11y-konform out-of-the-box;
  ein custom-Combobox-Pattern wäre Mehr-Aufwand und für IT14 nicht
  gerechtfertigt.
- Detail-Page `app/admin/bookings/[id]/page.tsx` setzt `<h1>` auf den
  Customer-Namen (Heading-Hierarchie); „Zurück zur Übersicht" als
  semantischer Link mit `aria-label="Zurück zur Buchungsübersicht"`.

---

## 11. Story-Coverage-Tabelle (gesamt)

| Story | Frontend-Deliverable |
|---|---|
| S01 | KEINE UI-Änderung erwartet (Production-Setup-Diagnose). Optional: defensive Retry in `useCustomer`. Customer-Form (`BookingForm.tsx`) bleibt komplett unverändert — kein `paymentMethod`-Feld im Customer-Submit (M-7). |
| S02 | NEU `app/admin/layout.tsx` mit `await requireActiveAdmin()` (Schicht 2). Middleware-Patch wirkt server-seitig. |
| S03 | Multi-Select-Filter mit Default `['PENDING', 'CONFIRMED']` in `BookingTable.tsx`. |
| S04 | Schema-Refactor: `BookingAdminSchemaIT14` einführen, alle `as`-Casts entfernen (verbindlich, C-5). |
| S05 | `FinalPriceEditor.tsx` um Zahlungsart-Select erweitern (`CASH`/`BANK_TRANSFER`). Badge in `BookingTable.tsx` für gesetzte Werte; kein Badge bei NULL. |
| S06 | NEU `app/admin/bookings/[id]/page.tsx` + `AdminBookingDetailView.tsx`. `AdminCalendarView.tsx` Fallback-URL auf `/admin/bookings/{id}`. |
| S07 | KEINE UI-Änderung — Backend-Fix in `analytics.ts`. UI zeigt automatisch korrekte Werte. |
| S08 | KEINE UI-Änderung — Production-Setup. |

---

*Ende frontend-requirements-it14.md — Solution Architect, 2026-05-04.*
