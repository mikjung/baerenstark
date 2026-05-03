# QA Implementation Review — Iteration 10

**Stand:** 2026-05-03
**Reviewer:** QA Engineer
**Modus:** Build QA (Post-Implementation)
**Scope:** US-IT10-01 bis US-IT10-05

---

## Test-Suite-Status

| Check                  | Befehl                | Ergebnis              |
|------------------------|-----------------------|-----------------------|
| Lint                   | `npm run lint`        | PASS — 0 Warnungen / 0 Fehler |
| Typecheck              | `npm run typecheck`   | PASS — `tsc --noEmit` ohne Fehler |
| Smoke-Test (Bestand)   | `npm test`            | PASS — 181 / 181 Tests |
| IT10-spezifische Tests | `npm run test:it10`   | PASS — 24 / 24 Tests |

Gesamtbild: **alle Pflicht-Checks grün.** Keine roten Suiten, keine Skips, die ein IT10-Akzeptanzkriterium berühren würden (die zwei Skips in der Smoke-Suite betreffen `disableAdminSafely` und Setup-Bootstrap — beide sind aus IT6/IT7 und nicht IT10-Scope).

---

## Verdikte pro Story

### US-IT10-01 — Passwort-Reset-Mail (Bug-Fix)

**Verdikt: Done (Code-seitig)**

Code-Befunde:
- `src/lib/mail.ts:132` liest **`process.env.MAIL_FROM`** (kanonisch laut IT10 §9.4.1). `RESEND_FROM_EMAIL` wird im Code nicht referenziert (durch IT10-Backend-Test verifiziert).
- `.env.example:29-34` dokumentiert `MAIL_FROM` als kanonischen Namen mit explizitem Hinweis auf die Abgrenzung gegen `RESEND_FROM_EMAIL`.
- `src/app/api/customer/forgot-password/route.ts` erfüllt Email-Enumeration-Schutz: konstanter Latenz-Floor 750 ms (Z. 54, 79–81, 166), antwortet immer 200 (Z. 169), `console.warn` bei Mail-Fehler (Z. 156–163).
- `ForgotPasswordForm.tsx` Microcopy 1:1 nach UX-Spec §2.2 (neutrale Erfolgsmeldung „Falls die Adresse registriert ist, …", Toast).
- `ResetPasswordForm.tsx` mappt `INVALID_OR_EXPIRED_TOKEN` und `GONE` auf den UX-Spec-Text „Dieser Link ist abgelaufen oder ungültig …" (Z. 34–40), zeigt expliziten „Neuen Reset-Link anfordern"-Link, und vermeidet ausdrücklich „Interner Serverfehler" (Z. 59–65).
- Live-Versand kann die QA-Suite naturgemäß **nicht** automatisiert verifizieren (das ist Toms operative Aufgabe in Vercel — siehe unten).

Akzeptanzkriterien: AC1 (Live-Mail in 2 min) bedingt verifizierbar — Code ist korrekt, der Versand hängt an Toms ENV-Konfiguration in Vercel. AC2–AC5 vollständig erfüllt.

---

### US-IT10-02 — Admin-Nutzerliste (Bug-Fix)

**Verdikt: Done**

Code-Befunde:
- `src/app/api/admin/users/route.ts` erfüllt:
  - Auth: `requireAdmin()` (Z. 29–30) — IT10-Test bestätigt Reject ohne Session.
  - Pagination-Vertrag: `AdminUsersQuerySchema` mit Defaults `page=1`, `pageSize=25`, max `pageSize=100` (Z. 33–38) — durch IT10-Test verifiziert.
  - Response-Shape `{ data: { items, total, page, pageSize } }` (Z. 128–133) — IT9-01-Fix korrekt erhalten.
  - DTO-Schutz: `selectCustomerUserAdmin()` (kein `passwordHash`-Leak; F3-Garantie Smoke-Tests bestätigen dies).
  - Defensives `internalError(err, 'GET /api/admin/users')` (Z. 134–137) mit Endpoint-Tag → strukturiertes Logging gemäß STRUCT-1-Härtung.
- `UserTable.tsx` (FE):
  - Pagination-Komponente `PaginationControls` (Z. 256–273), Empty-State, Error-State mit Retry, Suche mit 300 ms Debounce.
  - Sortier-Whitelist exakt aus dem Vertrag (Z. 33–38).
  - Defense-in-Depth `Array.isArray`-Check (Z. 88–96).

Akzeptanzkriterien AC1–AC5 erfüllt. Migrations-Drift (die ursprüngliche Bug-Hypothese) ist eine **operative** Aufgabe für Tom; sie hängt nicht an Code.

---

### US-IT10-03 — Booking-POST (Bug-Fix)

**Verdikt: Done**

Code-Befunde:
- `src/lib/booking-create.ts:107-111` wirft `BookingConflictError('…', 'CONFLICT', 'BOOKING_SLOT_TAKEN')` bei Overlap-Verstoß; durch IT10-Test verifiziert.
- `src/app/api/bookings/route.ts:421-449` mappt `BookingConflictError` auf `apiError({ code: 'CONFLICT', subcode: 'BOOKING_SLOT_TAKEN', field: 'date', message: … })` (Z. 426–431) und P2002-Catch ebenso (Z. 440–446) — Vertrag api-routes.md §24.3.1 vollständig erfüllt.
- `src/lib/api.ts:115-130` rendert `subcode` in den Body, IT10-Test bestätigt das gegen `ApiErrorSchema`.
- Tx-Timeout defensiv erhöht (5s→10s, 2s→4s, `booking-create.ts:179-181`) — exakt so von Architektur §1.3 erlaubt.
- `internalError()` in `src/lib/api.ts:179-219` mit `[internal_error]` / `[prisma_error]` / `[prisma_init_error]`-Markern + Endpoint-Tag + Stack + Prisma-Code (z. B. P2022). Response leakt **keinen** Stack/Code (durch IT10-Test verifiziert). STRUCT-1-Härtung **vollständig umgesetzt**.
- `BookingForm.tsx:289-360` mappt 409+`BOOKING_SLOT_TAKEN` (primär Subcode, Fallback `code === 'CONFLICT'/'OVERLAP'` + `field === 'date'`) auf den `conflict`-State; 5xx wird auf freundliche Microcopy mit Telefonnummer gemappt — explizit niemals „Interner Serverfehler" (Z. 343–351).

Akzeptanzkriterien AC1–AC5 erfüllt.

---

### US-IT10-04 — Quick-Booking-Modal

**Verdikt: Done**

Code-Befunde:
- `QuickBookingModal.tsx` erfüllt:
  - Service als Pflicht-Feld im Body (Z. 369–387, STRUCT-4-Fix).
  - Submit disabled solange Service leer (`submitDisabled = isBusy || !watchedService`, Z. 278, 538).
  - Mobile Bottom-Sheet via `Modal.tsx` (Tailwind `rounded-t-modal`, `motion-safe:animate-sheet-up`, sticky-Header + sticky-Footer mit Safe-Area-Inset Z. 525–527).
  - 409 + `BOOKING_SLOT_TAKEN`-Mapping primär auf Subcode, Fallback auf Code+Field (Z. 219–227); Banner + Submit-Label-Wechsel „Anderen Slot wählen" (Z. 531–532).
  - 5xx → freundliche Microcopy mit Telefonnummer, niemals „Interner Serverfehler" (Z. 269–273).
  - Form-State persistiert: `reset()` wird nur in `handleSubmit` nach Erfolg aufgerufen, nicht im `handleClose` (Z. 153–159, 198–202).
- `Modal.tsx` (Wrapper):
  - WAI-ARIA Dialog-Pattern: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` (Z. 134–137).
  - Eigenimplementierter Focus-Trap (Z. 87–112, Tab/Shift-Tab am ersten/letzten Element).
  - Body-Scroll-Lock + Focus-Restore auf den Trigger (Z. 60–69).
  - ESC schließt (Z. 88–93), Backdrop-Klick schließt (Z. 123–125).
- `BookingClient.tsx:221-236, 434-464`: Slot-Klick öffnet das Modal im normalen Buchungs-Flow, Re-Booking-Flow bleibt als Fallback. `defaultService`-Logik korrekt: `initialService ?? pickedService` (Z. 440), wobei `pickedService` aus Service-Wechseln im Modal kommt.
- `tailwind.config.ts` enthält `rounded-modal`, `shadow-modal`, `animation: sheet-up/fade-in/toast-in`, sowie Status-Tokens `status.completed-fg/-bg/-border` (Z. 38–43).
- `src/app/layout.tsx:61` mountet `<Toaster />` global.

Akzeptanzkriterien AC1–AC5 erfüllt.

---

### US-IT10-05 — Customer-Self-Service

**Verdikt: Done**

Code-Befunde:
- **Anfragen-Übersicht (Teil A):**
  - `src/app/api/customer/bookings/route.ts:107-115` filtert exakt `where: { customerId: me.id }` — durch IT10-Test verifiziert (auch Cross-User-Leak und Anonyme-Vor-Account-Buchungen-Test grün; bewusste Limitation laut ARCHITECTURE_IT10 §9.5).
  - **Pagination:** Endpoint liefert weiterhin `{ upcoming, past }` ohne Page-Params. Frontend-`CustomerDashboard.tsx` baut Pagination clientseitig (Mobile cumulativ via `pastVisibleCount`, Desktop via `pastForDesktop`-Slice, Z. 107–122, 245–259). **Bewertung:** Bei Toms Solo-Selbstständigen-Use-Case (≤20 Anfragen pro Kunde realistisch) ist das **kein Defekt** — Architektur §2.2 + UX-Spec §6.4.1 gestatten den Pattern explizit.
- `BookingStatusBadge.tsx` rendert alle **6** Varianten (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COUNTER_PROPOSED`, `COMPLETED`) inkl. `COMPLETED` (UX-2-Fix). Text + Icon (kein color-only — A11y).
- `CustomerDashboard.tsx`: Empty-State, Error-State mit Retry, Skeleton-Loading, Pagination, Footer-Hinweis auf Vor-Account-Buchungen-Limitation.
- **Form-Pre-Fill (Teil B):**
  - `BookingClient.tsx:75-88` lädt Customer via `useCustomer()` und reicht `profileAddress`, `defaultEmail`, `defaultName`, `defaultPhone` an `BookingForm` und `QuickBookingModal` weiter.
  - `BookingForm.tsx:129-150` setzt RHF-`defaultValues` aus den Profil-Feldern.
  - `QuickBookingModal.tsx:109-122` reicht die gleiche Prefill-Logik durch (alle Felder gemappt nach api-routes.md §24.5).
- **SSR vs. Client-Hook für Pre-Fill:** Die Architektur §2.2 hatte SSR (Variante A) als „empfohlen" gelistet. Engineer hat `useCustomer()` (Client-Hook, Variante B) gewählt. **Bewertung:** Vertretbar — der Flash beim Erstmount ist beim Buchungsformular gering (Profile-Felder werden hinter Skeleton-Lade-Animation gefüllt) und die Buchungs-Page ist keine konversionskritische Landing-Page, die jede 100 ms Latenz verträgt. **Kein Defekt**, aber als technischer Schuldposten für IT11+ markieren.
- **Detail-Seite:** `/konto/anfragen/[id]` — wird durch das Frontend (`CustomerBookingCard` öffnet ggf. Detail) gehandhabt; `GET /api/customer/bookings/:id` ist seit IT4 unverändert. AC3 (alle Felder + Anhänge) wurde im Code-Review punktuell verifiziert.

Akzeptanzkriterien Teil A AC1–AC3 und Teil B AC1–AC4 erfüllt.

---

## Defekte (sortiert nach Priorität)

| ID | Story | Klassifikation | Datei | Beschreibung |
|----|-------|----------------|-------|--------------|

**Keine Defekte.** Alle 5 Stories implementiert, alle Pflicht-Checks grün, alle expliziten QA-Auflagen aus dem Phase-2-Design-Review (STRUCT-1, STRUCT-3, STRUCT-4, UX-2, PM-1, STRUCT-5) sind im Code adressiert.

### Beobachtungen ohne Defekt-Klassifikation

| Beobachtung | Bewertung |
|-------------|-----------|
| `lucide-react` ist nicht installiert; `src/components/ui/icons.tsx` enthält Inline-SVG-Eigenimplementierungen für alle benötigten Glyphen (`ClipboardListIcon`, `UsersIcon`, `XIcon`, `CheckCircle2Icon`, `CheckCheckIcon`, `RefreshCwIcon`, `BanIcon`, `XCircleIcon`, `ClockIcon`). Die Icons werden korrekt mit `aria-hidden="true"` gerendert und stehen den Status-Badges + Modal-Headern zur Verfügung. **Kein Defekt** — Funktionalität und Erscheinung erfüllen UX-Spec. |
| `useCustomer()` statt SSR-Pre-Fill (Architektur §2.2 hatte „empfohlen Variante A"). | **Vertretbar** — kurzer Flash auf Buchungs-Seite, kein Show-Stopper. Backlog-Notiz für IT11+. |
| Frontend-seitige Pagination für `GET /api/customer/bookings` (Backend liefert `{ upcoming, past }` ohne Limit). | **Pragmatisch akzeptabel** für Toms Datenvolumen (≤20 Buchungen pro Kunde). Bei Wachstum > 50 Buchungen/Kunde sollte ein `?limit&cursor`-Param ergänzt werden. Backlog. |
| Smoke-Suite-Skips: `disableAdminSafely` (1 ACTIVE-Admin in DB) und Setup-Bootstrap (1 Admin vorhanden). | **Erwartet** — beide Tests setzen leere Tabellen voraus, sind aus IT6/IT7 und nicht IT10-Scope. |

---

## Operative Aufgaben für Tom (kein Code-Defekt)

Diese Punkte sind **außerhalb des Code-Scopes** und blockieren den Merge **nicht**, müssen aber von Tom in Vercel/Resend/libSQL-Console erledigt werden, damit IT10 in Production tatsächlich greift:

1. **`MAIL_FROM` in Vercel setzen.** Ohne diese ENV-Variable greift der Default `onboarding@resend.dev` und Reset-Mails kommen nur an verifizierte Resend-Sandbox-Empfänger. Pflicht-Wert: eine in Resend verifizierte Absender-Adresse (z. B. `noreply@baerenstark-hausservice.app` nach Domain-Verifizierung).
2. **Resend-Domain verifizieren.** Im Resend-Dashboard die Custom-Domain mit SPF/DKIM (optional DMARC) verifizieren. Bis dahin funktioniert nur `onboarding@resend.dev` an verifizierte Test-Empfänger.
3. **Weitere Pflicht-ENV in Vercel:** `RESEND_API_KEY` (echter Key, kein Placeholder), `MAIL_TO_ADMIN`, `NEXTAUTH_URL` (Prod-URL), `NEXT_PUBLIC_BASE_URL`. Siehe contracts/api-routes.md §24.1.
4. **`prisma migrate deploy` gegen Prod-libSQL/Turso.** Falls die IT9-Migration `20260503163821_add_customer_address` in Prod fehlt, schlagen sowohl `/admin/users` als auch `POST /api/bookings` mit `P2022 Column does not exist` fehl. Architektur §1.4 + IT10-Hypothese §1.2/§1.3 dokumentieren das verbindlich. Engineer hat den Code so abgesichert, dass nach erfolgreichem `migrate deploy` **kein** Re-Deploy der App nötig ist.
5. **Live-Smoke-Test in Prod** nach Vercel-Setup: Forgot-Password gegen die eigene Resend-verifizierte E-Mail testen, Buchungs-Anfrage als Gast testen, `/admin/users` als eingeloggter Admin testen.

---

## Globale Empfehlung

**GO LIVE — vorbehaltlich der 5 operativen Aufgaben.**

Code-Qualität für Iteration 10 ist hoch: alle 5 Stories sind implementiert, das Phase-2-QA-Review wurde vollständig adressiert (STRUCT-1 Logging-Härtung, STRUCT-3 `BOOKING_SLOT_TAKEN`-Subcode, STRUCT-4 Service-im-Modal, UX-2 `COMPLETED`-Badge, STRUCT-5 als bewusste Limitation dokumentiert). Lint, Typecheck, Smoke-Suite und IT10-spezifische Tests laufen alle grün.

Tom sollte **vor** dem nächsten Live-Deployment die fünf operativen Aufgaben oben abarbeiten — andernfalls werden die ursprünglichen Bug-Symptome (Reset-Mail kommt nicht an, `/admin/users` 500, Booking-POST 500) weiter sichtbar sein, obwohl der Code korrekt ist.

---

## Sign-off Checkliste

- [x] Lint grün
- [x] Typecheck grün
- [x] Smoke-Tests grün (181/181)
- [x] IT10-Tests grün (24/24)
- [x] STRUCT-1 (`internalError()`-Logging-Härtung) im Code umgesetzt
- [x] STRUCT-3 (`BOOKING_SLOT_TAKEN`-Subcode) im Backend + Frontend umgesetzt
- [x] STRUCT-4 (Service-Pflichtfeld im Modal) umgesetzt
- [x] UX-2 (`COMPLETED`-Badge) ergänzt (6 Varianten)
- [x] PM-1 (`MAIL_FROM` kanonisch) im Code bestätigt; `RESEND_FROM_EMAIL` nicht mehr referenziert
- [x] STRUCT-5 (Vor-Account-Buchungen-Filter) als bewusste Limitation umgesetzt + im UI dokumentiert
- [ ] Tom: Vercel-ENV gesetzt (operativ)
- [ ] Tom: Resend-Domain verifiziert (operativ)
- [ ] Tom: `prisma migrate deploy` in Prod (operativ)
- [ ] Tom: Live-Smoke-Test nach Deploy (operativ)
