# BUG-Analyse — Buchungsformular schlägt erneut fehl (Iteration 3)

**Status:** Blocker für Iteration 3
**Stand:** 2026-05-02
**Vorgängeranalyse:** `contracts/BUG_US04_ANALYSIS.md` (Iteration 2)

---

## 1. Symptom

Das Buchungsformular auf `/buchung` lässt sich auch nach Iteration 2 nicht
zuverlässig absenden. Konkret:

- Klick auf "Anfrage absenden" passiert sichtbar nichts (Submit-Button
  feuert nicht oder feuert mit leerem Effekt).
- Buchung erscheint nicht im Admin-Portal.
- Tom erhält keine Benachrichtigungs-E-Mail.
- Eingangsbestätigung an den Kunden bleibt aus.
- Der Kunde sieht weder Erfolgs-Toast noch Fehlerbanner — der Status
  bleibt `idle`.

Iteration 2 hatte den Server-seitigen Bug behoben (Mail-Versand blockiert
nicht mehr die 201-Response). Der jetzt sichtbare Defekt ist
**ausschließlich Frontend-seitig** — der `POST /api/bookings`-Handler ist
korrekt und würde die Buchung speichern, falls er denn aufgerufen würde.

---

## 2. Root Cause — Hauptursache

### Bug A (kritisch, blockiert jede Submission): `slotId` wird nicht in den Form-State geschrieben

In `src/components/booking/BookingForm.tsx` (Zeilen 60–75 und 286):

```tsx
const {
  register,
  handleSubmit,
  // ...
} = useForm<CreateBookingInput>({
  resolver: zodResolver(CreateBookingSchema),
  mode: 'onBlur',
  defaultValues: {
    slotId: selectedSlot?.id ?? '',     // <-- nur beim ersten Render gesetzt
    // ...
  },
});

const slotIdValue = selectedSlot?.id ?? '';

// ...später im JSX:
<input type="hidden" value={slotIdValue} {...register('slotId')} />
```

**Das Problem in zwei Schritten:**

1. **Stale defaultValue.** `useForm`-`defaultValues` werden **nur beim
   ersten Mount** ausgewertet. Wenn `BookingForm` schon gerendert wird,
   solange `selectedSlot === null` (was wegen des Early-Return `if
   (!selectedSlot)` unmöglich erscheint, aber siehe Bug B), startet das
   Form-Feld `slotId` mit `''` und bleibt dort.

2. **`value=` auf einem `register`-Input bricht React Hook Form.**
   Sobald `register('slotId')` an einen Input gebunden ist, **muss** RHF
   die Quelle der Wahrheit für den Wert sein. Wenn React selbst über das
   `value`-Prop einen abweichenden Wert vorschreibt, gibt es eine der
   folgenden Symptome (je nach RHF-Version):

   - React loggt im Dev-Mode "A component is changing an uncontrolled
     input to be controlled" — das Feld wird zur "controlled"-Komponente
     und RHF schreibt ihren Tracking-Wert nicht zurück.
   - Submit greift den RHF-internen Wert (initial leerer String), nicht
     den DOM-`value`.
   - In bestimmten Render-Reihenfolgen (z.B. wenn `selectedSlot` erst per
     Klick im Calendar gesetzt wird, also nach dem Form-Mount) bleibt
     der RHF-State auf `''` stehen, obwohl im DOM der korrekte
     `slot.id` steht.

**Konsequenz:** Beim Submit liefert `handleSubmit(values => ...)`
`values.slotId === ''`. Zod-Validation `z.string().min(1, 'Bitte wählen
Sie ein Zeitfenster')` schlägt fehl. RHF zeigt **keinen Inline-Fehler**,
weil das Feld als `hidden` ohne sichtbares Label gerendert ist — der
Benutzer sieht den Fehler nicht. Der Submit-Handler-Body läuft niemals.

Dass der Workaround `payload = { ...values, slotId: selectedSlot.id }`
in `onSubmitNewBooking` existiert, hilft **nicht**, weil `handleSubmit`
den Callback erst nach erfolgreicher Validation aufruft — und die
Validation scheitert vorher am leeren `slotId`.

### Bug B (verstärkend): Form wird vor selectedSlot gemountet

```tsx
if (!selectedSlot) {
  return (
    <Banner tone="info" title="Bitte zuerst einen Termin auswählen">
      ...
    </Banner>
  );
}
```

Der Early-Return verhindert, dass das Form gerendert wird, **solange
selectedSlot null ist** — aber `useForm` läuft trotzdem in jedem
Render-Lauf am Anfang der Funktion. Der Hook-Aufruf passiert vor dem
`if (!selectedSlot)`. **Beim ersten Render** mit `selectedSlot === null`
wird `useForm` mit `defaultValues.slotId === ''` initialisiert. Wenn
danach `selectedSlot` gesetzt wird, rendert die Komponente zwar das
Form, aber die `defaultValues` aus dem ersten Render bleiben bestehen
— RHF re-initialisiert nicht.

**Kombination Bug A + B:** Selbst wenn man den `value=`-Prop entfernt
und sich auf den hidden Input mit `register` verlässt, muss RHF erst
über `setValue('slotId', selectedSlot.id)` informiert werden — solange
das nicht aktiv passiert, bleibt der Form-State auf `''`.

---

## 3. Sekundärursachen

### Bug C: Validation-Errors auf hidden Inputs sind unsichtbar

Selbst wenn Bug A korrekt diagnostiziert wäre, würde der Benutzer den
Validierungsfehler "Bitte wählen Sie ein Zeitfenster" nicht sehen,
weil der `slotId`-Input als `<input type="hidden">` ohne sichtbares
Error-Element gerendert wird. Engineers müssen entweder:

- ein sichtbares Error-Banner für `errors.slotId` rendern, oder
- `slotId` aus den Form-Feldern herausnehmen und ausschließlich aus
  `selectedSlot.id` ableiten (siehe Lösung Variante 2 unten).

### Bug D: `service`-Slug `'sonstiges'` fehlt (US-19)

`SERVICES` in `src/lib/services.ts` und `contracts/zod-schemas.ts`
listet aktuell sechs Slugs:
`entruempelung | entkernung | reinigung | gruenflaechenpflege |
muelltonnenservice | entsorgung`. Wenn ein Kunde im Iteration-3-UI
"Sonstiges / Individuelle Anfrage" auswählt, schickt das Form
`service: 'sonstiges'` — die Zod-Enum-Validierung `ServiceSchema` lehnt
den Wert ab, der Submit scheitert mit 400 `VALIDATION_ERROR` auf
`field: 'service'`. Iteration 3 muss `'sonstiges'` zur Liste hinzufügen
(siehe Iteration-3-Spec, Teil 4).

### Bug E: Fehlende `slotId`-Validation für Iteration-3-Slot-Modell

In Iteration 3 (US-17) gibt es keine festen Slots mehr — Buchungen
speichern stattdessen `date + startTime + endTime`. Solange die Iteration
unvollständig ist, wird das Form noch versuchen, ein altes `slotId` zu
schicken; der neue Buchungs-Flow (siehe Iteration-3-Spec, Teil 2) muss
das Form vom Slot-Picker auf einen Datum+Zeit-Picker umbauen. Der
aktuelle Bug A blockiert beide Modi — er muss zuerst gefixt sein.

---

## 4. Wieso Iteration 2 das nicht abgefangen hat

Iteration 2 hatte den Backend-Bug behoben (Mail-Crash blockierte den
Booking-Insert) und das Schema verschärft (`customerEmail` Pflicht).
Das Form-State-Problem mit `slotId` war bereits in Iteration 1 latent
vorhanden, aber:

- In Iteration 1 wurde der `selectedSlot.id` direkt an den Submit
  weitergegeben (kein `register('slotId')`-Konflikt mit `value=`).
- Iteration 2 hat `slotId` nachträglich in das Form-State-Modell
  aufgenommen (für Re-Booking-Flow), ohne die Hidden-Input-Implementation
  korrekt umzubauen. Das versteckte das Problem hinter dem
  Re-Booking-Pfad, der eine andere Code-Verzweigung nimmt — der
  Standard-Fall blieb defekt.

**Lehre:** Hidden Inputs mit `register` + explizitem `value=` sind ein
Anti-Pattern in React Hook Form. In Iteration 3 wird das Anti-Pattern
restlos entfernt.

---

## 5. Patch — Engineering-Anweisung

### Patch 1: `slotId` aus Form-Feldern entfernen (empfohlen)

**Datei:** `src/components/booking/BookingForm.tsx`

```tsx
// 1) Zod-Schema entkoppeln: das Submit-Schema muss slotId NICHT mehr
//    erzwingen — die Komponente liefert ihn programmatisch.
//
// In contracts/zod-schemas.ts: KEINE Änderung am CreateBookingSchema selbst
// (es bleibt die API-Vertrags-Wahrheit). Stattdessen ein Form-Schema:

import { CreateBookingSchema } from '@/lib/schemas';

const FormSchema = CreateBookingSchema.omit({ slotId: true });
type FormInput = z.infer<typeof FormSchema>;

// 2) useForm benutzt das verkleinerte Form-Schema:
const {
  register,
  handleSubmit,
  reset,
  setError,
  formState: { errors, isSubmitting },
} = useForm<FormInput>({
  resolver: zodResolver(FormSchema),
  mode: 'onBlur',
  defaultValues: {
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    service: undefined,
    description: '',
    privacyAccepted: undefined as unknown as true,
  },
});

// 3) Hidden Input ENTFERNEN. selectedSlot.id ist die Wahrheit.

// 4) onSubmit setzt slotId beim Aufruf von createBooking() programmatisch:
const onSubmitNewBooking = handleSubmit(async (values) => {
  if (!selectedSlot) {
    setStatus({ kind: 'error', message: 'Bitte einen Termin auswählen.' });
    return;
  }
  setStatus({ kind: 'submitting' });
  try {
    await createBooking({
      ...values,
      slotId: selectedSlot.id,
    });
    setStatus({ kind: 'success' });
    onSubmitted();
  } catch (err) {
    handleApiError(err);
  }
});
```

### Patch 2 (für Iteration-3-Slot-Modell, US-17): Date/Time statt slotId

In Iteration 3 wird das Slot-Modell durch Verfügbarkeitsfenster ersetzt.
Der Buchungs-Flow gibt `date`, `startTime`, `endTime` an die API.
Engineers ersetzen den hidden Slot-Picker durch einen `TimeSlotPicker`,
der die ausgewählte Uhrzeit als drei Strings (`date`, `startTime`,
`endTime`) im React-State (außerhalb von RHF) hält. Die Submission
übergibt diese drei Werte zusätzlich an `createBooking()` — analog zu
Patch 1, einfach drei statt einem Wert.

### Patch 3: Sichtbares Fehler-Banner bei fehlender Auswahl

Falls aus irgendeinem Grund (z.B. State-Race) kein Slot/Zeitslot gewählt
ist, beim Submit ein Banner anzeigen. **Niemals** stilles Scheitern.

```tsx
{!selectedSlot && (
  <Banner tone="error" title="Kein Termin gewählt" role="alert">
    <p>Bitte oben zuerst einen freien Termin auswählen.</p>
  </Banner>
)}
```

### Patch 4: `'sonstiges'` zu `SERVICES` hinzufügen (US-19)

**Datei:** `src/lib/services.ts` (und synchron `contracts/zod-schemas.ts`)

```ts
export const SERVICES = [
  'entruempelung',
  'entkernung',
  'reinigung',
  'gruenflaechenpflege',
  'muelltonnenservice',
  'entsorgung',
  'sonstiges',     // <-- US-19, Iteration 3
] as const;
```

Backend-Validation für US-19: wenn `service === 'sonstiges'`, dann muss
`description.length >= 30` sein. Das wird im `CreateBookingSchema` als
`superRefine` ergänzt (siehe `contracts/zod-schemas.ts` Iteration-3-Update).

### Patch 5: Console-Logging für Debugging

Engineers fügen im `onSubmitNewBooking` ein `console.log` mit dem
gesamten `values`-Objekt direkt vor `createBooking()` ein. Wenn der
Submit hängt, ist sofort sichtbar, ob der Callback überhaupt aufgerufen
wird (Bug A) oder ob nur der Netzwerk-Call scheitert.

---

## 6. Verifikation

Nach Patch:

1. **Manueller Test:** Slot/Zeitslot wählen → Form ausfüllen → Submit →
   Erfolgs-Toast erscheint → Buchung erscheint im Admin-Portal.
2. **Edge-Case:** Form ausfüllen, dann `selectedSlot` mit "Anderen
   Termin wählen" auf null zurücksetzen, dann erneut Slot wählen →
   Submit funktioniert weiterhin.
3. **Validation-Test:** Pflichtfelder leer lassen → Inline-Fehler
   erscheinen unter den richtigen Feldern.
4. **'sonstiges'-Test:** Service "Sonstiges" wählen, Beschreibung mit
   nur 10 Zeichen → Validation-Fehler "Beschreibung muss mind. 30
   Zeichen haben". Mit ≥30 Zeichen → Submit erfolgreich.
5. **Network-Test:** DevTools → Network-Tab. POST `/api/bookings` muss
   genau einmal feuern, Response-Status 201, Response-Body
   `{ data: { id, status: 'PENDING', createdAt } }`.

---

## 7. Akzeptanzkriterium für QA

- [ ] Form-Submit ruft `POST /api/bookings` mit korrektem `slotId`
  (oder `date/startTime/endTime` ab US-17) auf.
- [ ] Buchung erscheint im Admin-Portal innerhalb 2 s.
- [ ] Tom erhält Benachrichtigungs-E-Mail (in Dev: Resend-Logs prüfen).
- [ ] Kunde erhält Eingangsbestätigung (Iteration 3 / US-24).
- [ ] Kunde sieht Erfolgs-Toast "Anfrage erfolgreich gesendet".
- [ ] Bei Validation-Fehler: Inline-Fehler unter dem betroffenen Feld.
- [ ] Bei 409 CONFLICT (Slot doppelt gebucht): Banner "Zeitfenster
  nicht mehr verfügbar".
- [ ] Bei 429 RATE_LIMITED: Banner "Zu viele Anfragen".
- [ ] Service "Sonstiges" zwingt 30-Zeichen-Mindestbeschreibung.
