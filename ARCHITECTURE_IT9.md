# ARCHITECTURE_IT9.md — Iteration 9

**Admin-Stabilität, Kunden-Adresse, öffentlicher Buchungs-Kalender & OAuth-Setup-Guide**

Datum: 2026-05-03
Vorgänger: `ARCHITECTURE_IT8.md` (Bugfix-Sweep), `ARCHITECTURE_IT7.md` (Auth-Stabilisierung).
Stack: Next.js 14 App Router, Prisma 5, libSQL/Turso, NextAuth v5, Vercel.

> Vier Stories: zwei direkte Wiederholungen bekannter IT8-Bug-Klassen
> (Envelope-Mismatch in `/admin/users`, State-Machine-Deadlock im Kunden-Kalender),
> eine echte neue Funktion (Customer-Profile-Adresse) und eine reine
> Doku-Story (Google-OAuth-Setup-Guide für Tom).

---

## 0. Untersuchungs-Ergebnis (Kurzfassung)

| Story | Symptom | Root Cause | Schicht |
|-------|---------|------------|---------|
| US-IT9-01 | Crash auf `/admin/users` (Error-Boundary) | Identischer Envelope-Mismatch wie US-IT8-01: GET `/api/admin/users` antwortet `apiSuccess({ data, total, page, pageSize })` → tatsächliche Response `{ data: { data: [...], total, page, pageSize } }`. `fetchAdminUsers()` ist als `Promise<{ data, total, page, pageSize }>` typisiert und liefert das **äußere** Objekt. `setUsers(res.data)` setzt das **innere** Objekt (kein Array) → später `users.map(...)` wirft `TypeError: users.map is not a function`. | Backend-Routen-Vertrag **+** FE-Client. |
| US-IT9-02 | Kunde kann keine Adresse hinterlegen | Schema und Endpoints kennen aktuell nur `Booking.address*` (US-32 IT5) — pro Buchung. Es gibt **keine** Default-Adresse am `CustomerUser`. Profil-Form (`/konto/profil`) fragt heute nur Vorname/Nachname/Telefon ab. Registrierung ohne Adressfelder. | Schema (additive Migration) + Backend (Endpoints) + Frontend (Forms). |
| US-IT9-03 | Kein Kalender im öffentlichen Buchungs-Flow | Identischer Deadlock wie US-IT8-02, eine Datei tiefer: `BookingCalendar.tsx:121` rendert `SkeletonCard` solange `status === 'idle' \| 'loading'`. `<AppCalendar>` mountet nie → `datesSet`-Hook feuert nie → `loadDays()` wird nie aufgerufen → `status` bleibt `'idle'`. Slot-Auswahl per Klick funktioniert ab dann (TimeSlotPicker existiert und ist verdrahtet). | Frontend (`BookingCalendar.tsx`). |
| US-IT9-04 | Tom kann Google-OAuth nicht selbst konfigurieren | Diagnose-Endpoint liefert seit IT8 ein klares `actionRequired: "config"`, aber das Runbook (`docs/AUTH_GOOGLE_FIX_RUNBOOK.md`) ist eher Engineer-Sprache. Tom braucht eine schrittweise, bildlich beschriebene, deutsch verfasste Anleitung. | Doku (`docs/GOOGLE_OAUTH_SETUP_GUIDE.md`). |

---

## 1. US-IT9-01 — `/admin/users` Crash

### 1.1 Root Cause (verifiziert via Code-Inspektion)

- `src/app/api/admin/users/route.ts:111` — Handler ruft
  ```ts
  return apiSuccess({ data, total, page: parsed.page, pageSize: parsed.pageSize });
  ```
- `src/lib/api.ts:110` — `apiSuccess(x)` umhüllt `x` zu `{ data: x }`. **Tatsächliche
  Response-Form**:
  ```jsonc
  { "data": { "data": [...], "total": 12, "page": 1, "pageSize": 25 } }
  ```
- `src/lib/api-client-it6.ts:226-244` — `fetchAdminUsers()` ist als
  `Promise<AdminUsersListResponse>` typisiert mit
  `AdminUsersListResponse = { data: CustomerUserAdmin[]; total; page; pageSize }`.
  Die Helper-Funktion `request<T>()` (`src/lib/api-client.ts:97-159`) gibt
  das **rohe Response-JSON** unverändert zurück. `fetchAdminUsers` macht
  **keinen** Unwrap-Mapper. Damit entspricht `res.data` zur Laufzeit dem
  inneren Objekt (selbst `{ data, total, page, pageSize }`) — KEIN Array.
- `src/components/admin/users/UserTable.tsx:78` —
  ```ts
  setUsers(res.data);    // setzt ein OBJEKT als angeblichen CustomerUserAdmin[]
  setTotal(res.total);   // res.total ist undefined → total wird 0
  ```
- `src/components/admin/users/UserTable.tsx:185` —
  ```tsx
  {visibleUsers.map((u) => ( ... ))}
  ```
  wirft **`TypeError: users.map is not a function`**. Das wird von der in
  IT8 gebauten Error-Boundary `src/app/admin/error.tsx` abgefangen → Tom
  sieht „Etwas ist schiefgelaufen.".

> **1:1 derselbe Bug-Typ wie US-IT8-01** (`/admin/admins`). Ursache: Beim
> Aufbau der `/admin/users`-Route hat IT6 die `apiSuccess()`-Hülle
> vergessen. Der IT8-Fix hat nur `/admin/admins` umgestellt.

### 1.2 Fix-Strategie

**Variante A (bevorzugt — Vertrag bereinigen, Symmetrie zu IT8-01-Fix):**

Backend-Route schickt die Liste direkt im `data`, ergänzt um die Pagination-
Felder als Geschwister:

```ts
return apiSuccess({ items: data, total, page, pageSize });
```

Hinweis: Wir können nicht einfach `apiSuccess(data)` schicken (wie bei
`/admin/admins`-Fix), weil hier `total/page/pageSize` mitgeschickt werden
müssen. Saubere Lösung: Liste in ein `items`-Feld umbenennen, damit der
Konflikt mit dem äußeren `data`-Wrapper verschwindet:

```jsonc
// Antwort:
{ "data": { "items": [...], "total": 12, "page": 1, "pageSize": 25 } }
```

FE-Client `fetchAdminUsers()`:
```ts
interface AdminUsersListEnvelope {
  items: CustomerUserAdmin[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchAdminUsers(...): Promise<AdminUsersListResponse> {
  const res = await request<DataEnvelope<AdminUsersListEnvelope>>(path, { signal });
  return {
    data: res.data.items,
    total: res.data.total,
    page: res.data.page,
    pageSize: res.data.pageSize,
  };
}
```

**Defense-in-Depth:**
1. In `UserTable.load()` Zeile 78–79: `Array.isArray(res.data) ?` Guard
   ergänzen, der bei Schema-Drift einen klaren Banner zeigt
   („Datenformat-Fehler — bitte Engineer kontaktieren") statt eines
   unbehandelten Crashes.
2. Vertragstest `tests/contracts/admin-users-list-shape.test.ts` (analog
   IT8-01), der Endpoint aufruft und assertiert `Array.isArray(json.data.items)`.

> **Zur Konsistenz:** `/admin/admins` (IT8-01-Fix) gibt `{ data: [...] }`
> direkt zurück — keine Pagination. `/admin/users` braucht Pagination,
> daher `{ data: { items, total, page, pageSize } }`. Diese Asymmetrie
> ist OK, weil sie unterschiedliche Resource-Charakteristika reflektiert.
> Ein zukünftiger Refactor könnte `PaginatedEnvelope<T>` als Standard
> einführen — Backlog, nicht IT9.

### 1.3 Berührte Dateien

- `src/app/api/admin/users/route.ts` — Response-Shape umstellen.
- `src/lib/api-client-it6.ts` — `fetchAdminUsers()` Mapper anpassen.
- `src/components/admin/users/UserTable.tsx` — Defensive Guard ergänzen.
- *Optional:* `tests/contracts/admin-users-list-shape.test.ts` (Smoke-Regression).

### 1.4 Test-Hooks (QA)

- `/admin/users` lädt, zeigt Tabelle mit Kunden — kein Crash, keine
  Error-Boundary.
- `curl -b cookies.txt /api/admin/users | jq '.data.items | type'` → `"array"`.
- `curl -b cookies.txt /api/admin/users | jq '.data | keys'` →
  `["items","page","pageSize","total"]`.
- DB ohne Kunden: leerer Zustand zeigt „Noch keine Kunden registriert."
  (heutige Implementierung in `UserTable.tsx:169` ist korrekt; kein Fix nötig).
- DB mit ≥1 Kunde: Spalten Name, E-Mail, Reg.-Datum, Buchungen, Rating
  sichtbar (Akzeptanzkriterium 4).
- Regression: `/admin/admins` lädt weiterhin korrekt (IT8-01 darf nicht
  zurückbrechen — disjunkter Code-Pfad, aber QA prüft).

### 1.5 Risk

- **Mittel.** Backend-Vertrag ändert sich; BE und FE-Client müssen in
  einem Deploy mergen (sonst zeigt die Tabelle für einen Deploy-Fenster
  weiter den Crash).
- Keine externen Konsumenten — `/api/admin/users` wird nur intern vom
  Admin-UI aufgerufen.
- `UserDetailDrawer` (`/api/admin/users/:id`) ist davon nicht betroffen
  (gibt korrekt `apiSuccess(toAdminCustomer(...))` mit `bookings[]` zurück
  und Client unwrappt via `DataEnvelope`).

---

## 2. US-IT9-02 — Kunden-Adresse im Profil

### 2.1 Ist-Zustand

- `Booking.addressStreet/addressZip/addressCity` existieren seit IT5
  (US-32) und sind im Booking-Form Pflicht.
- `CustomerUser` hat **keine** Adressfelder.
- `/konto/profil` und `/konto/registrieren` fragen Adresse nicht ab.
- Bei jeder Buchung muss der Kunde die Adresse erneut eintippen — Tom
  hat das als Reibungspunkt gemeldet.

### 2.2 Design-Entscheidungen

**E1: Adresse am `CustomerUser`, nicht in einer separaten Tabelle.**
1:1-Beziehung zum Kunden, keine Versionierung nötig (Adressen-Historie
ist im Booking selbst persistiert — `Booking.address*` bleibt der
Wahrheits-Anker pro Auftrag). Eigene Tabelle wäre over-engineered.

**E2: Profil-Adresse ≠ Booking-Adresse — beide unabhängig speichern.**
- Profil-Adresse ist der **Default**, der das Booking-Form vorausfüllt.
- Beim Buchen kann der Kunde sie überschreiben (z.B. Auftrag bei den
  Eltern). Was ins `Booking` geschrieben wird, ist eine Kopie zum
  Buchungszeitpunkt.
- Vorteil: Keine Migration der Bestand-`Booking`-Adressen, kein
  Konflikt mit US-32-Logik.

**E3: Felder optional bei Registrierung, Pflicht beim Buchen.**
- Registrierung soll niedrigschwellig bleiben (AC1).
- Bookings-POST verlangt vollständige Adresse (AC7) — entweder im
  Booking-Body übermittelt oder am Profil hinterlegt + automatisch
  übernommen.

**E4: PLZ-Validierung `/^\d{5}$/` (DE-Format), client + server.**
- Wir reusen `ZipCodeSchema` aus `contracts/zod-schemas.ts:354`.
- Keine erweiterte PLZ-Region-Validierung (z.B. „04 nicht in BY") —
  zu fragil, false positives, Backlog.

**E5: DSGVO-Hoheit.**
- Customer kann jederzeit alle 3 Felder leeren (`null` in DB).
- Admin sieht Adresse nur lesend in `/admin/users` Detail-Drawer.
- Wipe-Skript (`scripts/reset-users.ts`) räumt automatisch mit (kein Code-
  Change, da es `customer_users` ohnehin truncated).
- **Account-Self-Delete existiert nicht** (geprüft: kein DELETE-Handler
  in `src/app/api/customer/*`). Account-Löschung läuft heute über Tom
  (`DELETE /api/admin/users/:id`). Story IT9-02 verlangt nicht zwingend
  Customer-Self-Delete; Adress-Lösch-Pfad „alle 3 Felder leeren →
  speichern" reicht für AC5. Self-Delete-Story bleibt Backlog.

### 2.3 Schema-Diff (Prisma)

```diff
 model CustomerUser {
   id                      String    @id @default(cuid())
   email                   String    @unique
   passwordHash            String?
   firstName               String
   lastName                String
   phone                   String?
   emailVerified           Boolean   @default(false)
   emailVerifiedAt         DateTime?
   verificationToken       String?   @unique
   verificationTokenExpiry DateTime?

   oauthProvider String?
   oauthId       String?
   avatarUrl     String?

+  // IT9 / US-IT9-02 — Default-Adresse des Kunden (Profil).
+  // Alle drei Felder optional → niemand wird beim Onboarding blockiert.
+  // Pflicht-Validierung greift im Booking-POST (siehe §2.5 Endpoints).
+  // App-Layer-Validierung über ZipCodeSchema (`/^\d{5}$/`, DE).
+  /// Straße + Hausnummer (App-Layer 3..100 chars).
+  streetAndNumber String?
+  /// 5-stellige deutsche PLZ (App-Layer Regex).
+  postalCode      String?
+  /// Ort (App-Layer 2..100 chars).
+  city            String?

   adminNote   String?
   adminRating Int?

   createdAt DateTime @default(now())
   updatedAt DateTime @updatedAt
   ...
 }
```

> **Naming-Hinweis.** Story-Text und PROJECT.md verwenden
> `streetAndNumber`, `postalCode`, `city` (englisch, neutraler Stil
> wie der Rest des Schemas). Bewusst NICHT die Booking-Naming-Convention
> `addressStreet/addressZip/addressCity` recyceln — diese ist semantisch
> an die Buchungs-Auftrags-Adresse gebunden. Die getrennten Namen machen
> beim Code-Review sofort klar, welche Adresse gemeint ist.

### 2.4 Migration

```bash
# Lokal:
npx prisma migrate dev --name it9_customer_address

# Vercel/Prod (Turso libSQL): Migration läuft beim Deploy automatisch
# über das `prisma migrate deploy`-Skript (Bestand seit IT4).
```

Migration ist **rein additiv**, alle drei Felder nullable. Keine
Backfill-Skripte, keine Bestandsverletzung. Bestehende Queries auf
`CustomerUser` brechen nicht (selbst wenn sie alle Felder selecten —
neue Felder kommen einfach als `null` zurück).

### 2.5 Endpoints

#### Erweitert: `PATCH /api/customer/me`

`CustomerProfileUpdateSchema` (in `contracts/zod-schemas.ts:1067`) wird
um die drei Felder erweitert:

```ts
export const CustomerProfileUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    phone: phoneOptionalSchema,
    // IT9 / US-IT9-02 — alle nullable, leerer String/null = löschen.
    streetAndNumber: z
      .string().trim().min(3).max(100).nullable().optional(),
    postalCode: ZipCodeSchema.nullable().optional(),
    city: z.string().trim().min(2).max(100).nullable().optional(),
  })
  .strict();
```

Handler-Logik in `src/app/api/customer/me/route.ts` PATCH:
- Für jedes Feld: `data.field !== undefined ? { field: data.field ?? null } : {}`.
- Leerer String aus dem Form → vorher in `null` mappen (Frontend-
  Verantwortung; Server akzeptiert beides).

#### Erweitert: `GET /api/customer/me`

- DTO-Helper `selectCustomerUserPublic()` in `src/lib/dto/user.ts:50`
  ergänzt um `streetAndNumber: true`, `postalCode: true`, `city: true`.
- Mapper `toCustomerPublic()` in `src/lib/customer-auth-server.ts:62`
  ergänzt um die drei Felder.
- `CustomerUserPublicSchema` in `contracts/zod-schemas.ts:1099` (strict!)
  bekommt:
  ```ts
  streetAndNumber: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  ```
- Sicherheits-Check: weder `adminNote` noch `adminRating` werden mit
  ausgegeben (DTO-Helper bleibt strikt).

#### Erweitert: `POST /api/customer/register`

`CustomerRegisterSchema` (Zeile 998) bekommt die drei Felder als
**optional**:

```ts
streetAndNumber: z.string().trim().min(3).max(100).optional(),
postalCode: ZipCodeSchema.optional(),
city: z.string().trim().min(2).max(100).optional(),
```

Register-Handler persistiert sie 1:1 in `customerUser.create({ data })`.

#### Erweitert: `POST /api/bookings` — Adresse Pflicht für eingeloggte Kunden

Heute: `BookingAddressSchema` ist im `BookingCreateSchema` Pflicht (das
ist OK so). Neuer Pre-Check in der Route:

- Wenn der Request einen `customerSession` hat UND der Body **keine**
  Adresse enthält → versuche, die Profil-Adresse aus `CustomerUser` zu
  ziehen und damit den Body zu vervollständigen.
- Wenn weder Body noch Profil eine vollständige Adresse haben → 400
  `VALIDATION_ERROR` mit Message „Bitte vervollständige zuerst deine
  Adresse in deinem Profil." und Pointer auf `/konto/profil` (AC7).
  - Frontend (BookingForm) prüft diesen Code und zeigt den Banner mit
    Link auf `/konto/profil`.
- Gastbuchungen (kein `customerSession`) brauchen die Adresse weiterhin
  im Request (Bestandsverhalten).

> **Wichtig:** Adresse im `Booking` bleibt eine eigenständige Kopie.
> Wenn der Kunde später seine Profil-Adresse ändert, ändert sich
> NICHTS an früheren Buchungen — das ist die richtige Semantik
> (historische Auftragsorte bleiben stabil).

#### Admin-Sicht: `GET /api/admin/users/:id`

- `selectCustomerUserAdmin()` in `src/lib/dto/user.ts:77` ergänzt um
  die drei Felder.
- `toAdminCustomer()` in `src/app/api/admin/users/[id]/route.ts:44`
  liefert sie mit zurück.
- `UserDetailDrawer.tsx` zeigt einen neuen `<section>`-Block „Adresse"
  unterhalb der Buchungshistorie — **read-only**, kein Edit-Button.
  Tom kann die Adresse nicht im Namen des Kunden ändern (AC6, DSGVO).

### 2.6 UI-Änderungen

**A) Registrierungsformular (`src/components/customer/RegisterForm.tsx`
oder analog):**
- Neuer Abschnitt „Deine Adresse (für Termine vor Ort)" mit Hinweistext
  „Wird für Terminbuchungen benötigt." (AC1 wörtlich-nahe).
- Drei Inputs: „Straße & Hausnummer", „PLZ", „Ort".
- Alle drei optional, kein Sternchen, kein Required-Validation auf
  Form-Level.

**B) Profil-Page (`src/components/customer/ProfileForm.tsx`):**
- Neuer Abschnitt „Adresse" zwischen „Kontaktdaten" und „Konto-Aktionen".
- Drei Inputs (vorausgefüllt aus `initialCustomer` props).
- „Speichern"-Button (analog Bestand) → PATCH `/api/customer/me` mit
  den drei Feldern.
- Bestätigungs-Toast „Adresse gespeichert." (AC4).
- Lösch-UX: einfach alle drei Felder leeren + speichern. Kein extra
  „Adresse entfernen"-Button (overhead, Bestätigungs-Modal sparen wir).

**C) Buchungs-Form (`src/components/booking/BookingForm.tsx`):**
- Wenn eingeloggt UND Profil-Adresse vorhanden → Adressfelder im
  Buchungs-Form vorausgefüllt mit den Profil-Werten, aber editierbar.
- Wenn eingeloggt UND Profil-Adresse fehlt → Adressfelder leer + ein
  Hint-Banner „Tipp: Hinterlege deine Adresse im Profil, dann ist sie
  bei jeder Buchung schon vorausgefüllt." mit Link auf `/konto/profil`.
- Wenn der Server-Response 400 mit der spezifischen Message liefert
  (siehe §2.5 Bookings) → Banner „Bitte vervollständige zuerst deine
  Adresse in deinem Profil." + großer Link-Button zu `/konto/profil`
  (AC7 wörtlich).

### 2.7 Berührte Dateien

- `prisma/schema.prisma` — neue Felder am `CustomerUser`.
- `contracts/zod-schemas.ts` — `CustomerProfileUpdateSchema`,
  `CustomerRegisterSchema`, `CustomerUserPublicSchema` erweitern.
- `src/lib/dto/user.ts` — `selectCustomerUserPublic`,
  `selectCustomerUserAdmin` erweitern.
- `src/lib/customer-auth-server.ts` — `toCustomerPublic` mappt neue
  Felder.
- `src/app/api/customer/me/route.ts` — PATCH-Handler erweitert.
- `src/app/api/customer/register/route.ts` — neue Felder persistieren.
- `src/app/api/bookings/route.ts` — Profil-Adress-Fallback + 400-Pfad
  bei fehlender Adresse für eingeloggte Kunden.
- `src/app/api/admin/users/[id]/route.ts` — Admin-View liefert die
  Adresse mit.
- `src/components/customer/RegisterForm.tsx` — neuer Abschnitt.
- `src/components/customer/ProfileForm.tsx` — neuer Abschnitt + Save-
  Logik.
- `src/components/booking/BookingForm.tsx` — Vorausfüllung +
  Profil-Hinweis + Error-Pfad-Banner.
- `src/components/admin/users/UserDetailDrawer.tsx` — read-only
  Adress-Section (US-IT9-02 AC6).
- *Optional:* Smoke-Tests
  `tests/api/customer-me-address-update.test.ts`,
  `tests/api/booking-requires-address-for-logged-in.test.ts`.

### 2.8 Test-Hooks (QA)

- Registrieren mit ausgefüllter Adresse → Profil zeigt sie vorausgefüllt
  (AC2).
- Registrieren ohne Adresse → Konto wird angelegt (kein Validierungsfehler).
- Profil: Adresse eingeben + speichern → Toast erscheint, Refresh zeigt
  die Werte weiterhin (AC4).
- Profil: alle 3 Felder leeren + speichern → DB-Werte sind `null` (AC5).
  Verifikation per `sqlite3 dev.db 'SELECT streetAndNumber, postalCode, city FROM customer_users WHERE id="…";'`
  → drei NULLs.
- PLZ „abc12" → Form zeigt „PLZ muss 5 Ziffern enthalten", kein Save.
- Buchen ohne Adresse im Profil und ohne Adresse im Body → 400 mit
  spezifischer Message + Frontend-Banner mit Link zu `/konto/profil`
  (AC7).
- Buchen mit Adresse im Profil → BookingForm vorausgefüllt, Buchung
  geht durch ohne erneutes Tippen.
- Admin öffnet Kunden im Drawer → Adress-Section sichtbar, kein Edit-
  Feld (AC6).
- `GET /api/customer/me` Response enthält `streetAndNumber`,
  `postalCode`, `city`, aber **kein** `adminNote`/`adminRating` (AC8) —
  via `CustomerUserPublicSchema.strict()` strukturell garantiert.

### 2.9 Risk

- **Niedrig–Mittel.** Migration ist additiv. Hauptrisiko ist, dass die
  Booking-POST-Route durch den neuen Pflicht-Pfad eine Regression
  bekommt. Mitigation: Test `booking-requires-address-for-logged-in`
  und manueller QA-Smoke vor Deploy.
- DSGVO: kein zusätzliches Risiko, Adresse ist nur unter eigener
  Customer-Session schreibbar.

---

## 3. US-IT9-03 — Buchungs-Kalender im Kunden-Flow

### 3.1 Root Cause (verifiziert)

`src/components/booking/BookingCalendar.tsx`:
- Zeile 55: `const [status, setStatus] = useState<LoadStatus>('idle');`
- Zeile 121:
  ```tsx
  {status === 'idle' || status === 'loading' ? (
    <SkeletonCard />
  ) : (
    <AppCalendar
      mode="customer"
      days={enrichedDays}
      onRangeChange={handleRangeChange}
      onDaySelect={handleDaySelect}
    />
  )}
  ```
- `<AppCalendar>` ruft `onRangeChange` (→ `loadDays`) erst aus seinem
  internen FullCalendar-`datesSet`-Hook, NACHDEM es gemountet ist.
- Da `<AppCalendar>` nie gemountet wird (immer Skeleton), wird
  `loadDays` nie aufgerufen → `status` bleibt für immer `'idle'` →
  Skeleton ist permanent sichtbar.

> **1:1 derselbe Bug-Typ wie US-IT8-02** in `AdminCalendarView.tsx`.
> Die Komponente wurde dort gefixt, aber `BookingCalendar.tsx` (Public-
> Sicht, separater Code-Pfad) wurde übersehen.

### 3.2 Slot-Auswahl ist bereits korrekt verdrahtet (Verifikation)

Der ganze Flow nach dem Kalender funktioniert konzeptuell schon, ist
aber durch den Deadlock verdeckt:

- `BookingClient.tsx:169-181` — `handleDaySelect(date)` setzt
  `selectedDate` und scrollt zur „Dauer"-Sektion.
- `BookingClient.tsx:183-193` — `handleDurationSelect(minutes)` setzt
  `durationMinutes` und scrollt zur „Slot-Liste"-Sektion.
- `BookingClient.tsx:325-332` — `<TimeSlotPicker date duration ... onSelect={handleTimeSlotSelect}>`
  lädt verfügbare Zeit-Slots via `GET /api/slots/available?date=…&duration=…`.
- `BookingClient.tsx:195-202` — `handleTimeSlotSelect(slot)` setzt
  `selectedTimeSlot` (mit `date`, `startTime`, `endTime`,
  `durationMinutes`) und scrollt zum Form.
- `BookingClient.tsx:364-385` — `<BookingForm selectedTimeSlot={…}>`
  konsumiert die Auswahl und sendet sie im POST-Body.

→ Story-Text „Slot-Auswahl per Klick → Slot-ID landet im Buchungs-Form-
State" ist bereits implementiert. Der Klick auf einen Tag im **Kalender**
löst den Drilldown aus; der Klick auf einen Slot in der nachgelagerten
**TimeSlotPicker**-Liste landet im Form-State. Das ist ein
zwei-stufiger UX-Flow (Tag → Slot), nicht ein einstufiger
„im Kalender direkt einen Slot klicken". Story-Akzeptanzkriterien sind
mit dieser Stufung kompatibel (AC2: „verfügbare Zeitslots als klickbare
Elemente"; AC3: Slot wird hervorgehoben + erscheint im Form vorausgefüllt).

### 3.3 Fix-Strategie

**Identische Lösung wie IT8-02 (Variante 3 aus ARCHITECTURE_IT8.md §2.2):**

Ein initialer Range-Fetch in `useEffect`, BEVOR `<AppCalendar>` gemountet
wird:

```tsx
// In BookingCalendar.tsx, ergänzen:
useEffect(() => {
  // Initialer Range = aktuelle Woche (Mo–So) oder aktueller Monat —
  // konsistent mit der ersten View, die FullCalendar im 'customer'-Mode
  // rendert (laut AdminCalendarView-Fix: Monatsansicht für Kunden).
  const { from, to } = computeInitialMonthRangeBerlin();
  void loadDays(from, to);
}, [loadDays]);
```

Und das Skeleton-Layout umstellen: `<AppCalendar>` IMMER mounten, Skeleton
als Overlay nur während `'loading'` zeigen:

```tsx
<div className="relative rounded-lg border border-baerenstark-sand bg-white p-2 sm:p-4">
  <AppCalendar
    mode="customer"
    days={enrichedDays}
    onRangeChange={handleRangeChange}
    onDaySelect={handleDaySelect}
  />
  {(status === 'idle' || status === 'loading') && (
    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
      <SkeletonCard />
    </div>
  )}
</div>
```

**Helper-Wiederverwendung:** Wenn `computeInitialMonthRangeBerlin` (oder
ein analoges Pendant) für IT8-02 in `src/lib/date-helpers.ts` gelandet
ist, wiederverwenden. Wenn nicht: hier neu, exportieren, dann auch in
`AdminCalendarView` reusen.

**Range-Fetch-Deduplizierung:** Wie IT8-02 — `useRef` auf den letzten
gefetchten Range, `loadDays` skipped wenn identisch. Vermeidet
Doppel-Request initial → datesSet.

**Fehler-Pfad (AC5):** Bei Fetch-Fehler zeigt der Banner heute schon
„Verfügbarkeits-Kalender ist gerade nicht erreichbar." (Zeile 73 — nur
für 404). Erweitern auf alle Fehler-Cases:
- 404 → Bestandsmeldung (Backend nicht da).
- 5xx / Network → „Verfügbare Termine konnten nicht geladen werden.
  Bitte Seite neu laden." (AC5 wörtlich).

**State-Persistenz beim Zurück-Navigieren (AC6):**
- `BookingClient.tsx` hält `selectedDate` und `selectedTimeSlot` in
  React-State. Beim Wechsel zwischen Sektionen geht der State NICHT
  verloren (alles in einer Komponente).
- Beim Browser-Back/Forward (über die Page hinaus) ist der State weg —
  das ist OK und nicht Bestandteil der Story (AC6 spricht von „während
  der Session" innerhalb des Buchungs-Flows).
- AC6 ist also bereits erfüllt, kein Code-Change nötig — als
  Nebenbestätigung im PR notieren.

### 3.4 Berührte Dateien

- `src/components/booking/BookingCalendar.tsx` — State-Machine umbauen,
  initialer Range-Fetch, Skeleton-Overlay, erweiterter Fehler-Pfad.
- `src/lib/date-helpers.ts` — falls noch nicht vorhanden:
  `computeInitialMonthRangeBerlin()`. Konsistent mit IT8-02-Helper.
- *Optional:* `src/components/calendar/AppCalendar.tsx` — wenn der
  initiale `datesSet` doppelt feuert, einen `useRef`-basierten Dedup
  ergänzen (aber im Fix beweisen, ob nötig).

### 3.5 Test-Hooks (QA)

- `/buchung` öffnen → Kalender ist sichtbar binnen 3 s, kein Skeleton-
  Loop (AC1).
- Network-Tab: ein `GET /api/availability/calendar?from=…&to=…` wird
  beim Page-Load gefeuert (nicht erst nach View-Klick).
- Verfügbaren Tag klicken → Sektion „2. Wähle die Auftragsdauer"
  scrollt in Sicht; nach Dauer-Auswahl erscheinen Zeitslots (AC2).
- Slot klicken → Slot ist visuell hervorgehoben, Form weiter unten zeigt
  „Datum + Zeit" vorausgefüllt (AC3).
- Tag mit DayOverride „Geschlossen" klicken → Hint „Für diesen Tag
  sind keine Termine verfügbar." (AC4 — entweder bereits in
  TimeSlotPicker `empty`-State implementiert; verifizieren).
- Backend down (z.B. /api/availability/calendar zu 500 mocken) →
  Banner mit „Verfügbare Termine konnten nicht geladen werden. Bitte
  Seite neu laden." statt endlosem Skeleton (AC5).
- Slot wählen, dann zur Tagesauswahl zurück, dann erneut zur Slot-
  Sektion → Auswahl bleibt erhalten (AC6 — innerhalb der Session,
  kein Reload).
- Regression: `/admin/calendar` lädt weiterhin korrekt (IT8-02 darf
  nicht zurückbrechen — disjunkte Komponente).

### 3.6 Risk

- **Niedrig.** Reine Frontend-Änderung in einer Komponente. Bekanntes
  Lösungspattern aus IT8-02.
- Risiko: Doppelter initialer Fetch (Effect + datesSet). Mit
  `useRef`-Dedup ausgeschlossen.
- Risiko: Helper-Duplikation zwischen Admin- und Customer-Kalender.
  Mitigation: Beide rufen den gleichen `date-helpers`-Export auf —
  Code-Review-Punkt.

---

## 4. US-IT9-04 — Google-OAuth-Setup-Guide für Tom

### 4.1 Story-Charakter

Reine Doku, kein Code-Fix. Outcome ist eine Markdown-Datei. Der Architekt
liefert hier die **Outline + Pflicht-Inhalte als Liste**, nicht den
Volltext. Den Volltext schreibt der Backend-Engineer in der Build-Phase
(siehe Aufgaben-Verteilung §5).

### 4.2 Datei-Spezifikation

- **Pfad:** `docs/GOOGLE_OAUTH_SETUP_GUIDE.md` (Story AC, fest).
- **Sprache:** Deutsch durchgängig. Kein „NEXTAUTH_URL muss gesetzt
  sein"-Engineer-Slang. Stattdessen umschreiben:
  „In Vercel klickst du auf …, dann fügst du eine Variable hinzu mit
  Namen `NEXTAUTH_URL` und Wert `https://www.baerenstark-hausservice.app`."
- **Zielgruppe:** Tom — kein Cloud-Console-Vorwissen, kein NextAuth-
  Wissen. Jede Aktion muss reproduzierbar sein, ohne Rückfrage.
- **Format:** Markdown. Echte Screenshots sind nicht möglich (nicht
  einbettbar). Stattdessen **Bildschirm-Beschreibungen** in Anführungs-
  zeichen, die UI-Elemente eindeutig referenzieren.

### 4.3 Outline (Pflichtsektionen)

> Der Engineer hält sich exakt an diese Reihenfolge und Section-Titel.
> Akzeptanzkriterium 5 verlangt diese Sektionen explizit.

#### Sektion 1: Voraussetzungen

Pflicht-Stichworte:
- Google-Konto, mit dem Tom Inhaber des Bärenstark-OAuth-Clients ist
  (oder werden soll).
- Google-Cloud-Project, in dem die OAuth-Client-ID lebt. Falls noch
  keins: Hinweis „Du legst eins beim ersten Schritt 2 an."
- Login-Daten zum Vercel-Dashboard (für Schritt 6).
- 15–20 Minuten Zeit, am Desktop-Rechner (Mobile-Browser ist für die
  Cloud Console schlecht).
- Saubere zweite Browser-Tab-Reihe (für parallel offenes Vercel-
  Dashboard).

#### Sektion 2: Google Cloud Console öffnen und Projekt auswählen

Pflicht-Stichworte:
- URL: `https://console.cloud.google.com/`.
- Beschreibung der Projekt-Auswahl-Dropdown: „Oben links siehst du den
  Projekt-Namen — klickst du drauf, öffnet sich ein Modal mit allen
  deinen Projekten und einem ‚Neues Projekt'-Button rechts oben."
- Falls noch kein Projekt: Schritt für „Neues Projekt erstellen"
  (Name z.B. „baerenstark-hausservice", Organisation leer lassen).
- Falls schon ein Projekt: Tom soll prüfen, dass er das richtige
  ausgewählt hat (Projekt-Name oben in der Headerleiste).

#### Sektion 3: OAuth-Consent-Screen prüfen

Pflicht-Stichworte:
- Pfad: linkes Burger-Menü → „APIs und Dienste" → „OAuth-
  Zustimmungsbildschirm".
- Status muss `In Produktion` sein (nicht „Test"). Falls „Test":
  - Erklärung, dass Login dann nur für Tom funktioniert.
  - Schritt: „Auf ‚VERÖFFENTLICHEN' klicken (oben in der App-Detail-
    Karte, blauer Button)".
  - Hinweis: Google fordert KEINEN App-Review für die Scopes
    `email`/`profile`/`openid` — Veröffentlichen geht direkt.
- Pflichtfelder im Consent: App-Name („Bärenstark Hausservice"),
  Support-Mail, Entwickler-Mail.
- Domain (`baerenstark-hausservice.app`) muss bei „Autorisierte
  Domains" eingetragen sein.

#### Sektion 4: OAuth-Client-ID finden oder anlegen

Pflicht-Stichworte:
- Pfad: linkes Menü → „APIs und Dienste" → „Anmeldedaten".
- Bildschirm-Beschreibung: „Du siehst eine Tabelle mit dem Header
  ‚OAuth 2.0-Client-IDs'. Wenn du schon einen Eintrag für Bärenstark
  hast, klick auf den Namen, um in die Detail-Ansicht zu gelangen."
- Falls neu anlegen: Button „+ ANMELDEDATEN ERSTELLEN" oben →
  „OAuth-Client-ID" → Anwendungstyp „Webanwendung" → Name
  „Bärenstark Web".
- Nach dem Anlegen: ein Modal mit Client-ID + Client-Secret erscheint.
  **Beide kopieren und in einem sicheren Notizbuch ablegen** (Client-
  Secret wird später nicht mehr im Klartext angezeigt). Hinweis:
  Schritt 6 verwendet diese beiden Werte.

#### Sektion 5: Redirect-URIs eintragen (mit exakten URLs)

Pflicht-Stichworte:
- Bildschirm-Beschreibung: „In der Detail-Ansicht der Client-ID gibt
  es einen Abschnitt ‚Autorisierte Weiterleitungs-URIs'. Darunter ist
  ein Eingabefeld mit einem Plus-Button (‚+ URI HINZUFÜGEN'). Für jede
  URI klickst du auf Plus, fügst den exakten Wert ein, und klickst am
  Ende unten auf ‚SPEICHERN'."
- **EXAKTE Werte zum Copy-Paste** (Engineer übernimmt sie aus dem
  Diagnose-Endpoint `/api/auth/diagnose` Feld `expectedCallbacks.googleC`):
  ```
  https://www.baerenstark-hausservice.app/api/auth/customer/callback/google
  http://localhost:3000/api/auth/customer/callback/google
  ```
- **Achtung:** Der Pfad heißt `customer/callback/google`, NICHT der
  NextAuth-Default `auth/callback/google`. Tippt sich leicht falsch.
  Genau diese Schreibweise verwenden.
- Hinweis: Trailing-Slash oder Großschreibung führt zu
  `redirect_uri_mismatch`. Tom soll prüfen: Eintrag genauso wie hier,
  ohne Slash am Ende.

#### Sektion 6: Client-ID und Client-Secret in Vercel-Umgebungsvariablen eintragen

Pflicht-Stichworte:
- URL: `https://vercel.com/`.
- Schritt 1: Auf das Bärenstark-Projekt klicken.
- Schritt 2: Tab „Settings" oben.
- Schritt 3: Linke Seitenleiste „Environment Variables".
- Schritt 4: Pro Variable folgende Felder ausfüllen:
  - **Name:** exakt `GOOGLE_CLIENT_ID`
  - **Value:** der in Schritt 4 kopierte Client-ID-Wert
  - **Environments:** Häkchen bei „Production", „Preview" und
    „Development".
  - „Save" klicken.
- Wiederholen für `GOOGLE_CLIENT_SECRET`.
- **Zusätzlich** prüfen, dass folgende Variablen vorhanden sind
  (sollten von Engineer aus IT7 schon gesetzt sein, aber Tom verifiziert):
  - `NEXTAUTH_URL` = `https://www.baerenstark-hausservice.app`
    (kein Slash am Ende, Schema https).
  - `AUTH_SECRET` (Wert nicht prüfbar — wird nicht angezeigt, ist OK).
  - `AUTH_TRUST_HOST` = `true`.
- Nach dem Speichern: oben rechts „Redeploy" am letzten Production-
  Deployment klicken (sonst greifen die ENV-Vars nicht).

#### Sektion 7: Diagnose-Endpoint nutzen

Pflicht-Stichworte:
- URL aufrufen: `https://www.baerenstark-hausservice.app/api/auth/diagnose`
- Voraussetzung: in Vercel-ENV muss `AUTH_DIAGNOSE_ENABLED=true` gesetzt
  sein. Falls nicht: Schritt für „Variable hinzufügen" wie in Sektion 6
  beschreiben, mit Hinweis „Nach erfolgreichem Test wieder entfernen".
- Erwartete Antwort: JSON-Block mit `verdict.actionRequired: "none"`
  oder `"config"`.
- Tabelle „Was bedeutet welcher Wert?":
  - `"none"` → alles grün, Login sollte funktionieren.
  - `"config"` → in `verdict.configActions` steht, was du noch tun
    musst. Liste durchgehen.
  - `"code"` → STOP. Engineer kontaktieren.
- Wert `expectedCallbacks.googleC` mit dem in Sektion 5 eingetragenen
  Wert vergleichen — müssen exakt gleich sein.

#### Sektion 8: Häufige Fehler und ihre Bedeutung

Pflicht-Tabelle (Spalten: Fehler-Symptom | Was passiert ist | Was du
tun musst):

- `redirect_uri_mismatch`
  - Bedeutung: „Google sagt: Die Redirect-URI, die unsere Webseite
    gerade benutzt, steht nicht in deiner Liste der erlaubten URIs."
  - Lösung: Sektion 5 nochmal prüfen. Aufruf von
    `/api/auth/diagnose` → Feld `expectedCallbacks.googleC` →
    diesen exakten String in der Cloud-Console eintragen.
- `invalid_client`
  - Bedeutung: „Client-ID oder Client-Secret stimmen nicht."
  - Lösung: Sektion 4 + 6 — Werte aus dem richtigen Projekt
    kopieren, Vercel speichern, Redeploy.
- `access_denied`
  - Bedeutung: „Du hast im Google-Login-Bildschirm auf ‚Abbrechen'
    geklickt." Kein Fehler — einfach erneut versuchen.
- Weiße Seite, kein Login
  - Bedeutung: Wahrscheinlich `AUTH_SECRET` oder `NEXTAUTH_URL` falsch.
  - Lösung: Sektion 6 prüfen, dann Diagnose-Endpoint.
- Login klappt nur mit Toms Mail
  - Bedeutung: OAuth-Consent ist im Test-Modus.
  - Lösung: Sektion 3 — auf „In Produktion" stellen.

#### Sektion 9 (Optional): Wenn nichts hilft

Pflicht-Stichworte:
- „Schreib dem Backend-Engineer mit folgenden Infos: Output von
  `/api/auth/diagnose`, exakte Fehlermeldung im Browser, Screenshot
  der Cloud-Console-Redirect-URIs."

### 4.4 Berührte Dateien

- `docs/GOOGLE_OAUTH_SETUP_GUIDE.md` (NEU).
- `docs/AUTH_GOOGLE_FIX_RUNBOOK.md` — kleines Update am Top: Verweis
  auf den neuen Guide für Tom („Wenn du keinen technischen Background
  hast, lies stattdessen GOOGLE_OAUTH_SETUP_GUIDE.md").

### 4.5 Test-Hooks (QA)

- Tom liest den Guide selbst durch und versucht, Schritt für Schritt
  Google-OAuth zu konfigurieren — manueller Smoke-Test (AC1).
- Unabhängiger Leser (z.B. PM oder ein Bekannter ohne Cloud-Console-
  Erfahrung) findet alle 9 Sektionen und kann jeden Schritt nachvollziehen
  (AC5).
- Beim erfolgreichen Login wird Tom nach `/admin` weitergeleitet (AC4 —
  manuell durch Tom verifiziert; nicht automatisierbar).
- Sektion 8 enthält `redirect_uri_mismatch` mit klarer Erklärung +
  Sektion-Verweis (AC3).

### 4.6 Risk

- **Niedrig.** Reine Doku, kein Production-Code-Risk.
- Risiko: Google Cloud Console UI ändert sich (Sektionen werden umbenannt).
  Mitigation: Bildschirm-Beschreibungen so generisch halten wie möglich
  („oben links der Projekt-Picker") statt pixelgenaue Pfade.

---

## 5. Aufgaben-Verteilung Backend vs. Frontend

| Story | Backend-Engineer | Frontend-Engineer |
|-------|------------------|-------------------|
| **US-IT9-01** | Route `GET /api/admin/users`: Response-Shape von `{ data: { data, total, page, pageSize } }` auf `{ data: { items, total, page, pageSize } }` umstellen. *Optional:* Vertragstest. | `fetchAdminUsers()` in `api-client-it6.ts` Mapper anpassen, `UserTable.tsx` Defensive Guard. |
| **US-IT9-02** | Prisma-Migration (`it9_customer_address`), `selectCustomerUserPublic` + `selectCustomerUserAdmin` ergänzen, `toCustomerPublic` Mapper, `CustomerProfileUpdateSchema` + `CustomerRegisterSchema` + `CustomerUserPublicSchema` erweitern, PATCH `/api/customer/me` Handler, POST `/api/customer/register` Handler, POST `/api/bookings` Profil-Adress-Fallback + 400-Fehlerpfad, GET `/api/admin/users/:id` neue Felder. | RegisterForm + ProfileForm um Adress-Section erweitern, BookingForm um Vorausfüllung + Hinweis-Banner + Error-Pfad-Banner, UserDetailDrawer um read-only Adress-Section. |
| **US-IT9-03** | — (keine Backend-Änderung). | `BookingCalendar.tsx` State-Machine umbauen (initialer Range-Fetch, Skeleton als Overlay, erweiterte Fehler-Cases). Helper `computeInitialMonthRangeBerlin` ggf. neu in `src/lib/date-helpers.ts`. |
| **US-IT9-04** | **Backend-Engineer** schreibt `docs/GOOGLE_OAUTH_SETUP_GUIDE.md` nach Outline §4.3, übernimmt exakte Redirect-URIs aus `/api/auth/diagnose` `expectedCallbacks.googleC`. Top-Verweis im Bestand-Runbook ergänzen. | — (kein UI-Change). |

**Reine Frontend-Stories:** US-IT9-03.
**Reine Backend-/Doku-Stories:** US-IT9-04.
**Geteilt (BE + FE):** US-IT9-01 (BE führt mit Vertrags-Change),
US-IT9-02 (gemischt — BE Schema/Endpoints, FE Forms/UI).

---

## 6. Build-Reihenfolge (empfohlen)

1. **US-IT9-01** zuerst (BE + FE als ein Commit) — entsperrt Tom
   unmittelbar in der Nutzerverwaltung.
2. **US-IT9-03** parallel (reines Frontend, kein Konflikt) —
   entsperrt den Buchungs-Flow für Kunden (Must-Have).
3. **US-IT9-04** parallel (reine Doku, kein Code-Konflikt) — entsperrt
   Tom für Google-OAuth-Setup.
4. **US-IT9-02** danach — komplexeste Story, braucht Migration +
   gemischtes BE/FE. Sollte nach 1+3 deployt werden, damit Tom in der
   Zwischenzeit schon seine Adresse über das Profil eintragen kann.

---

## 7. Offene Annahmen / nicht verifiziert

- **US-IT9-01:** Verifiziert via Code-Inspektion. Nicht via Browser-Run
  reproduziert — die Schlussfolgerung „Crash + Error-Boundary" basiert
  auf der bekannten Existenz von `src/app/admin/error.tsx` (IT8) und
  dem analogen Verhalten von `/admin/admins`.
- **US-IT9-02:** Annahme „Adresse optional bei Registrierung, Pflicht
  beim Buchen" wird im Story-Text als Annahme markiert. Tom soll bei
  Build-Beginn bestätigen, falls abweichend gewünscht (z.B. Pflicht
  schon bei Registrierung).
- **US-IT9-02:** Annahme „kein Customer-Self-Delete-Endpoint" — bestätigt
  via `grep` (kein DELETE-Handler in `src/app/api/customer/*`). Adress-
  Lösch-Pfad „alle Felder leeren" reicht für AC5 — Self-Delete bleibt
  Backlog.
- **US-IT9-03:** Nicht via Browser-Run reproduziert. Code-Pfad ist
  identisch zu IT8-02; Mehrwert eines manuellen Tests ist gering, aber
  QA muss nach dem Fix sehen, dass Slot-Auswahl tatsächlich im Form
  landet.
- **US-IT9-04:** Tom bestätigt Akzeptanz nach manuellem Durchlauf des
  Guides. Nicht automatisierbar — Story-Erfolg hängt an Toms Feedback.

---

**Ende ARCHITECTURE_IT9.md**
