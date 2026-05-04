# QA Implementation Review — Iteration 11

**Mode:** Build QA (Phase 4 nach Phase 3)
**Datum:** 2026-05-04
**Iteration:** 11
**Stories im Scope:** US-IT11-01 bis US-IT11-06
**Quellen:** `PROJECT.md` §IT11, `ARCHITECTURE_IT11.md` (v3), `project/design/ux/ux-spec.md`, `QA_DESIGN_REVIEW_IT11.md`, `contracts/bookings-cancel.openapi.yaml` (v11.1)

---

## Verdikt — Tabelle

| Story | Verdikt | Begründung |
|---|---|---|
| US-IT11-01 | **Done** (mit Caveat) | Code/Schema/Migration/Mail-Pfad sind vollständig, alle 33 IT11-Tests grün. Operativer Smoke-Test in Prod (Vercel-ENV gesetzt + `prisma migrate deploy` ausgeführt + Resend-Domain verifiziert) liegt außerhalb der Code-Review und muss von Tom manuell verifiziert werden — siehe Smoke-Checkliste §5. |
| US-IT11-02 | **Done** | `BookingDialogProvider` global im Root-Layout (`src/app/layout.tsx:57`), Header-CTA (`Header.tsx:46-51`) + Hero-CTA (`home/Hero.tsx:18, 44-47`) öffnen Modal über `useBookingDialog().open()`, beide mit `aria-haspopup="dialog"`. `/buchung` bleibt Fallback. Keine eingebetteten Slot-Picker im `page.tsx`. |
| US-IT11-03 | **Done** | Token-Modul (`booking-tokens.ts`) mit HS256, 30d TTL, Scope-Validation. `public-summary` akzeptiert beide Scopes (read-only-Polymorphismus). Bestätigungs-Page Server-Component lädt Summary, rendert `<TokenExpiredPage>` bei 401/404/Error. Toast + Redirect funktionieren in `QuickBookingModal.tsx:265-297`. Form-Reset vor `router.push` korrekt. |
| US-IT11-04 | **Done** | `/api/upload` validiert 0-Byte (400 FILE_EMPTY), Whitelist-MIME (415), Split-Limits 10/50/10 MB (413 FILE_TOO_LARGE), Magic-Bytes via `file-type` mit MIME-Alias-Match (400 FILE_TYPE_MISMATCH). Admin-`BookingTable.tsx:355-426` zeigt Anhang-Liste mit Thumbnail (60×60), Dateiname, Größe, Klick öffnet neuen Tab (`target="_blank"`, `rel="noopener noreferrer"`). Empty-State „Keine Dateien hochgeladen". |
| US-IT11-05 | **Done** | `BookingDialogProvider` zieht `useCustomer()` zentral, baut `defaultValues` defensiv (Adressfelder optional, `streetAndNumber|postalCode|city`-Cast über `Record<string, unknown>` zur Migration-Robustheit). `BookingForm.tsx:548-557` zeigt „Aus deinem Profil — überschreibbar" Badge wenn `profileAddress` vorhanden, sonst Banner mit `/konto/profil`-Link. Modal-Reset bei jedem Close (BUG-MAJOR-07-Auflösung). |
| US-IT11-06 | **Done** | Endpoint `POST /api/bookings/[id]/cancel` mit Auth-Polymorphismus (Token bevorzugt, Cookie-Fallback), Token-Scope-strict, 24h-Frist via `isCancellable()`, Idempotenz mit `alreadyCancelled: true` ohne Zweit-Mail, Ownership-Hide (404 statt 403), atomarer Conditional-Update für Race-Schutz. Customer-`CancelConfirmationDialog` mit Focus-Trap auf Abbrechen, Escape/Backdrop-Block bei Submit. Gast-Page `/buchung/[id]/stornieren` rendert NUR UI (kein Auto-POST). Alle States (idle/submitting/success/already-cancelled/deadline-passed/error/expired) implementiert. |

**Aggregat:** 6 von 6 Stories *Done* aus Code-Sicht. US-IT11-01 wartet auf operativen Smoke-Test in Prod (Tom).

---

## Test-Ergebnisse

### IT11-Backend-Suite (`npm run test:it11`)
**33 von 33 Tests grün** — alle Pfade abgedeckt:
- Token-Roundtrip (8 Tests): Confirmation/Cancellation Sign+Verify, Scope-Strict, Read-Token akzeptiert beide, Expired/Invalid/Empty.
- Migration-Smoke (2): Cancellation-Audit-Felder + CustomerUser-Adress-Felder lesbar.
- `public-summary` (5): Token mit beiden Scopes, Expired/Sub-Mismatch/Unauthorized.
- `cancel` (8): Erfolg, Persistenz `cancelledBy=CUSTOMER`, Idempotenz, REJECTED→409, CONFIRMED+<24h→409, Expired-Token→401, Confirmation-Token→401 (Scope-Strict), Unauthorized→401, Ownership-Hide-Pfad.
- Doppel-Submit-Dedup (2): 60s-Window match + außerhalb match nicht.
- Upload Edge-Cases (6): 0-Byte→400 FILE_EMPTY, 12 MB JPG→413, 60 MB MP4→413, MIME-Spoof→400 FILE_TYPE_MISMATCH, 8 MB JPG + 30 MB MP4 passen Validierung (scheitern nur am fehlenden BLOB_TOKEN→503).
- Race-Test (1): paralleler Cancel → 1 echter + 1 idempotenter.

### Gesamt-Suite (`npm test`)
**181 von 181 Tests grün, 2 SKIP** (IT6 F2 + Setup-Bootstrap, Setup nur leer testbar — Standard).

### TypeScript (`npx tsc --noEmit`)
**Sauber.** Nur ESM-Loading-Hinweis von Node.

### Lint (`next lint`)
**No ESLint warnings or errors.**

### Build (`npm run build`)
**Erfolgreich.** Alle IT11-Routen vorhanden:
- `/buchung/bestaetigung/[bookingId]` (Dynamic, 1.65 kB)
- `/buchung/[id]/stornieren` (Dynamic, 3.68 kB)
- `/api/bookings/[id]/cancel` (Function)
- `/api/bookings/[id]/public-summary` (Function)
- Legacy `/buchung/bestaetigt` + `/buchung/storno` bleiben für Counter-Proposal-Accept/Decline-Flow (US-13) — kein Konflikt.

### Coverage-Lücken
- **Keine E2E-Tests** (Playwright/Cypress) — nicht im IT11-Scope, aber Smoke-Liste in §5 deckt manuell ab.
- **`public-summary` mit Cookie-only-Auth (kein Token)**: nur durch statische Code-Review verifiziert, kein automatisierter Test mit echtem Cookie. Akzeptiert.
- **Resend-Domain-Verifikation + Mail-Empfang in Prod**: nicht testbar im Build. Pflicht-Item in Tom-Smoke (§5).
- **Magic-Bytes-Check fällt zurück (`file-type`-Modul fehlt)**: Logging vorhanden, aber kein Alarming. Akzeptabel — Library ist installiert.

---

## Build-Status

| Check | Ergebnis |
|---|---|
| `npm run test:it11` | **PASS** 33/33 |
| `npm test` | **PASS** 181/181 (+ 2 environment-bedingte SKIP) |
| `npx tsc --noEmit` | **PASS** (clean) |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** (alle Routen + Bundle-Größen ok) |

---

## Defekt-Liste

**Keine Blocker. Keine Major-Defekte.** Statisch und dynamisch wurde kein AC-Bruch identifiziert.

### MINOR (4 Hinweise, nicht blockierend)

**MIN-01 — Magic-Bytes-Check kann silently übersprungen werden**
- Severity: Minor (Defense-in-Depth)
- Story: US-IT11-04
- Datei: `src/app/api/upload/route.ts:73-93` (`detectFileMime`)
- Beobachtet: Wenn `file-type` zur Laufzeit nicht geladen werden kann (Cold-Start, Bundling), liefert die Funktion `{ ok: 'skipped' }` und MIME-Spoofing-Schutz ist disabled — nur ein `console.warn` warnt. Tests verifizieren das Verhalten mit installiertem Modul.
- Empfehlung: Optional in Prod-Boot-Check (`/api/health`) `import('file-type')` versuchen und Logging-Alarm setzen, falls fehlend.
- Routing: backend-engineer (Backlog IT12).

**MIN-02 — Doppel-Submit-Dedup nur bei `customerEmail`-Match (oder eingeloggt)**
- Severity: Minor
- Story: US-IT11-03 (BUG-MAJOR-03 aus Design-QA)
- Datei: `src/app/api/bookings/route.ts:273-325`
- Beobachtet: Dedup-Key fällt durch, wenn der Body weder `customerEmail` noch `customerSession.customerId` enthält. Im aktuellen Schema ist `customerEmail` `z.string().email()` Pflicht, daher praktisch immer gesetzt. Defensiv ok.
- Empfehlung: Kommentar im Code („dedupCustomerKey kann theoretisch null sein, in Prod nie") + Telemetrie-Hook bei `dedupCustomerKey === null`.
- Routing: backend-engineer (Wartungs-Backlog).

**MIN-03 — Bestätigungs-Page bei `kind: 'error'` rendert dieselbe `<TokenExpiredPage>` wie bei `kind: 'unauthorized'`**
- Severity: Minor (UX-Granularität)
- Story: US-IT11-03
- Datei: `src/app/buchung/bestaetigung/[bookingId]/page.tsx:98-102`
- Beobachtet: 5xx-Server-Fehler beim `public-summary`-Fetch wird mit identischer Microcopy „Link abgelaufen" abgefangen. Aus User-Sicht freundlich, aber bei intermittentem Backend-Ausfall verwirrend (Token war ggf. valid).
- Empfehlung: Bei `kind: 'error'` dedizierte „Wir konnten die Anfrage gerade nicht laden — bitte später erneut probieren oder anrufen"-Variant. Kein Blocker für IT11.
- Routing: frontend-engineer (Backlog IT12).

**MIN-04 — Tom-Mail-Pfad bei Cancel: best-effort, kein Retry**
- Severity: Minor
- Story: US-IT11-06
- Datei: `src/app/api/bookings/[id]/cancel/route.ts:201-229`
- Beobachtet: `sendCancellationToAdmin()` wird `void`-fired. Bei Mail-Fehler wird `mailError` in der DB persistiert, aber kein Retry/DLQ. Konsistent mit existierender Booking-Mail-Strategie (gleicher Pattern).
- Empfehlung: Akzeptabel für IT11. Backlog: Background-Worker für DLQ.
- Routing: backend-engineer (Backlog).

---

## Contract-Konformität

Cross-Check `contracts/bookings-cancel.openapi.yaml` (v11.1) gegen Implementierung:

| Vertragsteil | Status |
|---|---|
| `POST /api/bookings/{id}/cancel`, `?token=` optional | OK (`route.ts:67`) |
| 200 mit `{id, status: CANCELLED, cancelledAt, alreadyCancelled}` | OK (`route.ts:127-132, 238-243`) |
| 401 TOKEN_EXPIRED / TOKEN_INVALID / UNAUTHORIZED | OK (subcode propagiert via `apiError`) |
| 404 Ownership-Hide | OK (`route.ts:117-121`) |
| 409 CANCELLATION_DEADLINE_PASSED + Telefon-Hint | OK (`route.ts:147-153`) |
| 409 nicht stornierbarer Status | OK (`route.ts:138-145`) |
| `GET /public-summary` akzeptiert beide Scopes | OK (`booking-tokens.ts:218-225`) |
| Schreibender Cancel: nur `booking-cancellation` | OK (`route.ts:73`) |
| `cancelledBy = 'CUSTOMER'` (auch via Token) | OK (`route.ts:168`) |
| Storno-Page `/buchung/{id}/stornieren?token=…` | OK (Path-Param) |
| Bestätigungs-Page `/buchung/bestaetigung/{id}?token=…` | OK |

**Keine Vertragsverletzung.**

---

## Microcopy + A11y Stichproben

| Check | Ergebnis | Quelle |
|---|---|---|
| Telefon-Display `0157 74787512` (NBSP) | **OK** — Byte-Inspektion bestätigt `c2 a0` zwischen Vorwahl und Rufnummer | `src/lib/contact.ts:12` |
| `tel:`-Link `tel:+4915774787512` (E.164) | **OK** | `src/lib/contact.ts:13`, mehrfach genutzt |
| Stornieren-Button `aria-label="Anfrage {service} am {datum} stornieren"` | **OK** | `CustomerBookingCard.tsx:216` |
| Modal-Trigger `aria-haspopup="dialog"` | **OK** im Header (`Header.tsx:47`) und Hero (`home/Hero.tsx:44`); `OpenBookingDialogButton` ebenfalls (`OpenBookingDialogButton.tsx:43`) |
| Cancel-Dialog `role="dialog"` + `aria-modal="true"` + Focus auf Abbrechen | **OK** (`CancelConfirmationDialog.tsx:68, 113`) |
| Escape/Backdrop-Block während Submit | **OK** (Cancel-Dialog `:82-85, 121`; QuickBookingModal `closeOnEscape={!isBusy}` `:374`) |
| Bestätigungs-Page `<TokenExpiredPage>` für 401/404 | **OK** (`bestaetigung/[bookingId]/page.tsx:94-102`) |
| Bestätigungs-Page Buchungsnummer + Service + Datum + Status | **OK** (`BookingConfirmation.tsx:89-118`) |

---

## Manuelle Smoke-Test-Empfehlung für Tom (Pre-Sign-off)

Der Code ist grün — was Tom in Produktion (nach Deploy) zwingend manuell prüfen muss:

### A) Operative Vorbedingungen (US-IT11-01 — KRITISCH)

1. **Vercel-ENV vollständig:**
   - `RESEND_API_KEY`, `MAIL_FROM` (Format `Bärenstark <noreply@verifizierte-domain>`),
     `MAIL_TO_ADMIN=hausservice-baerenstark@outlook.com`,
   - `NEXTAUTH_URL=https://<prod-domain>`, `NEXT_PUBLIC_BASE_URL=https://<prod-domain>`,
   - `DATABASE_URL` (Turso/libSQL), `DATABASE_AUTH_TOKEN`,
   - `BLOB_READ_WRITE_TOKEN` (Vercel Blob),
   - **NEU:** `BOOKING_TOKEN_SECRET` (32+ Zeichen Random — `openssl rand -base64 48`).

2. **Migrationsstand:** `npx prisma migrate deploy` lokal gegen Prod-Connection — `migrate status` zeigt „up to date" inkl. `20260504100000_add_booking_cancellation_audit`.

3. **Resend-Domain-Verifikation:** Resend-Dashboard → Status `verified`. Andernfalls Tom als Test-Empfänger pflegen.

### B) End-to-End-Smoke (Reihenfolge)

1. **Gast-Buchung:** `/` → „Termin buchen" → Modal → Service + Datum + Slot + Adresse + 1 Bild (≤10 MB) hochladen → Absenden → grüner Toast „Anfrage gesendet — Tom meldet sich…" + Redirect auf `/buchung/bestaetigung/<id>?token=…&new=true` mit Buchungsnummer/Service/Datum.

2. **Reload der Bestätigungs-Page:** Browser-Refresh → Page bleibt sichtbar mit denselben Daten (Token verify).

3. **Token entfernen + Reload:** `?token=…` aus URL löschen → `<TokenExpiredPage>` mit Telefonnummer erscheint.

4. **E-Mail an Tom:** Inbox `hausservice-baerenstark@outlook.com` → Mail mit Kundenname, Service, Datum, Telefon. Cancel- und Confirmation-Token in den E-Mail-Links enthalten.

5. **Admin-Ansicht:** `/admin/bookings` → neuer Eintrag „Offen" → Detail aufklappen → Anhang-Sektion zeigt Thumbnail + Dateiname + Größe → Klick öffnet neuen Tab mit Bild.

6. **Eingeloggter Buchung-Flow + Pre-Fill:** Login als bestehender Kunde → Modal öffnen → Name/Email/Telefon/Adresse vorausgefüllt → „Aus deinem Profil — überschreibbar" Badge sichtbar → Datum überschreiben → Submit → Profil unter `/konto/profil` unverändert.

7. **Doppel-Submit-Test:** Im Modal Submit-Button rasch zweimal klicken → nur 1 Buchung in DB, nur 1 Mail an Tom (Server-Dedup 60s-Window).

8. **Customer-Cancel:** `/konto` → eine Anfrage „Offen" → „Stornieren" → Confirm-Dialog (Focus auf Abbrechen) → Bestätigen → Toast „Auftrag storniert" → Status sofort „Storniert" ohne Reload → Tom-Mail kommt an.

9. **Gast-Cancel:** Aus Bestätigungs-Mail Storno-Link kopieren → in Inkognito öffnen → Page zeigt Buchungs-Details + „Anfrage stornieren"-Button (kein Auto-POST!) → Klick → Confirm-Dialog → Bestätigen → Erfolgs-Card. Zweiter Aufruf desselben Links → „Anfrage bereits storniert"-Card (Idempotenz).

10. **Storno-Frist (24h):** Test-CONFIRMED-Booking < 24h vor Termin → Storno-Versuch → 409 + Toast/Card „Stornierung nicht mehr möglich. Bitte rufen Sie uns an: 0157 74787512".

11. **Upload-Edge-Cases:** im Modal versuchen: 0-Byte-Datei, 12 MB JPG, 60 MB MP4, eine umbenannte `.txt`-als-`.jpg` → jeweils kurzer deutschsprachiger Fehler im Drop-Zone, kein Crash.

12. **Telefon-Anzeige:** Footer / Header / Bestätigungs-Page → `0157` und `74787512` bleiben in einer Zeile, brechen nicht zwischen Vorwahl und Nummer (NBSP).

### Sign-off-Kriterium

Iteration 11 ist erst dann live-fertig, wenn (1) alle 12 Smoke-Schritte oben funktionieren UND (2) mindestens eine Mail an Tom (`hausservice-baerenstark@outlook.com`) bei einem **Nicht-Test-Empfänger** angekommen ist (verifiziert die Resend-Domain).

---

## Sign-off-Checkliste

- [x] Alle Critical-Issues resolved (keine identifiziert)
- [x] Alle Major-Issues resolved (keine identifiziert)
- [x] Alle 33 IT11-Akzeptanztests grün
- [x] Gesamte Test-Suite grün (181/181)
- [x] TypeScript clean, Lint clean, Build erfolgreich
- [x] Contract-Konformität (OpenAPI v11.1) verifiziert
- [x] Microcopy + A11y stichprobenartig OK
- [ ] **Tom-Smoke-Test in Prod** — siehe §B oben (12 Schritte)
- [ ] **Resend-Domain verifiziert + Test-Mail bei Nicht-Test-Empfänger angekommen**
- [ ] **`prisma migrate deploy` gegen Turso-Prod ausgeführt**
- [ ] **Vercel-ENV vollständig (inkl. `BOOKING_TOKEN_SECRET`)**

---
