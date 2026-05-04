# QA Implementation Review — Iteration 12

**Datum:** 2026-05-04
**Mode:** Build QA — Phase 4 (Implementation Review)
**Reviewer:** Senior QA Engineer
**Scope:** IT12-S01 bis IT12-S15
**Build-Stand:** alle Stories markiert "fertig" durch Backend- und Frontend-Engineer

---

## Verdict pro Story

| Story | Verdict | Defects |
|-------|---------|---------|
| IT12-S01 OAuth Bad Request | **Done with conditions** | DevOps-Aktion (Vercel-Env + Google Cloud Console) ist Pflicht; Code/`.env.production` korrekt; `OAuthButtons.tsx` nutzt `window.location.href` (kein `signIn`), funktioniert aber für reinen Auth-Redirect. Kein Frontend-Fix nötig (wie spezifiziert). |
| IT12-S02 Service-Bilder + Icon | **Done** | `service-images.ts` SSOT, alle 6 PNGs in `/public`, Hero-Layout: Icon (h-8/h-10) neben `<h1>`, Foto rechts via `<ServiceDetailHero>`. Fallback-Container vorhanden. |
| IT12-S03 Kalender Performance | **Done with conditions** | N+1 in `/api/availability/calendar` durch Batch-Load (Promise.all auf bookings/overrides/templates/buffer) eliminiert; In-Memory-Aggregation. Cache-Header gesetzt. **Verifikation in Production gegen Turso steht aus** — p95<300ms ist Spec, nicht gemessen. |
| IT12-S04 Scroll-Jump (Slot) | **Done** | `scrollIntoViewIfNeeded`-Helper in `src/lib/scroll-into-view.ts`, alle 5 Aufrufstellen in `BookingClient.tsx` migriert. Grep `scrollIntoView` (raw) zeigt: nur Helper-Definition + 1 Kommentar im Client; kein direkter `scrollIntoView`-Call mehr. |
| IT12-S05 Konto-Anbieten nach Buchung | **Done with conditions** | Embedded-Card auf Bestätigungsseite (kein Modal), 409-Banner mit Login-CTA, Dismiss via `sessionStorage`-Key, `register-from-booking`-Endpoint korrekt. **Open:** AC2 verlangt vorausgefüllte E-Mail/Vorname/Nachname; Card zeigt `displayEmail=""` (public-summary liefert keine E-Mail aus PII-Gründen) → User sieht "Wir verknüpfen das Konto mit der E-Mail aus Ihrer Anfrage" statt der konkreten Adresse. Funktional korrekt (Backend zieht E-Mail aus dem Token), aber AC-Buchstabe nicht erfüllt. Siehe BUG-002. |
| IT12-S06 Customer-Bookings 500 | **Done with conditions** | Code-seitig sauber, `cancelledAt`/`cancelledBy` werden gelesen. **Pflicht-DevOps-Aktion: `prisma migrate deploy` in Production**, sonst weiterhin 500. |
| IT12-S07 Login-State nach Profil-Save | **Done** | `customer-sync.ts` (EventTarget-basiert) + `useCustomer.ts` mit `lastKnownStatusRef` + Subscription. `ProfileForm` ruft `emitCustomerChanged()`; `loginCustomer`/`logoutCustomer` in `api-client.ts` ebenfalls. Network-Errors fallen NICHT mehr auf `unauthenticated` zurück. |
| IT12-S08 Form-Prefill | **Done** | Render-Gate auf `customerStatus === 'loading'` in `BookingClient.tsx` Zeile 248. Skeleton-Block gerendert; danach RHF mounted mit korrekten Defaults. |
| IT12-S09 Scroll-Jump (Form) | **Done** | `useEffect` bei `watchedService` ist via `lastServiceRef` deduped (Zeile 171–177 in `BookingForm.tsx`). |
| IT12-S10 Bild-Upload INTERNAL_ERROR | **Done with conditions** | Code unverändert (sauber); reine Konfig-Frage. **Pflicht-DevOps: `BLOB_READ_WRITE_TOKEN` in Vercel verifizieren/regenerieren.** |
| IT12-S11 Submission-Feedback + Idempotency | **Done** | `try/catch/finally`-Wrapper in `BookingForm.onSubmit`; Loading-State zurückgesetzt. Idempotency-Key wird FE generiert (UUID), als Header gesendet, Backend cached über `IdempotencyKey`-Tabelle 24h. Tests passing. |
| IT12-S12 Admin Upcoming Termine | **Done with conditions** | Same root cause wie S06; Migration in Production deployen. |
| IT12-S13 Admin Buchungsanfragen | **Done with conditions** | Same root cause wie S06; Migration in Production deployen. |
| IT12-S14 Admin-Navigation | **Done** | `AdminLayout` + `AdminSidebar` mit drei Gruppen (Kalender & Zeitmanagement / Nutzerverwaltung / Auswertungen). Bewertungen erscheint einmalig (nur in Auswertungen). Welcome-Banner via `localStorage`-Key dismissable. Layout-Wrapper umschließt alle Admin-Routen außer Login/Setup/Reset. |
| IT12-S15 Marketing-Mails | **Not done — blocking bug** | 6-Step-Wizard, Hard-Cap 50, Char-Counter ≤5000, UWG-Pflicht-Checkbox, Pflicht-Footer-Vorschau, HMAC-Stateless-Unsubscribe, MarketingEmail+Recipient-Audit-Trail. **BLOCKER: Send-Endpoint-Body-Mismatch** (siehe BUG-001) und **DSGVO/UWG-Risiko: kein Bestandskunden-Filter im Backend-Send** (siehe BUG-003). |

**Zusammenfassung Counts:**
- Done: 7 (S02, S04, S07, S08, S09, S11, S14)
- Done with conditions: 7 (S01, S03, S05, S06, S10, S12, S13)
- Not done (Blocker): 1 (S15)

---

## Defects (Must Fix vor Iteration-12-Sign-Off)

### BUG-001 — S15 Bulk-Send-Endpoint: FE + OpenAPI senden keinen Body, Backend erfordert Body
- **Severity:** Critical (Blocker)
- **Layer:** Contract (FE-↔-BE-Drift)
- **Routing:** backend-engineer (primär) ODER frontend-engineer (sekundär)
- **Repro:**
  1. Als Admin auf `/admin/marketing` gehen.
  2. Empfänger-Filter setzen, ≥1 Empfänger auswählen.
  3. Schritt 1 → 5 durchklicken (Subject, Body, Footer-Preview, Test-Send überspringen, UWG-Checkbox setzen).
  4. „Senden"-Button drücken → `sendMarketingEmail(draftId)` ruft `POST /api/admin/marketing/emails/{id}/send` ohne Body auf.
- **Erwartet:** 200 mit `MarketingEmailSendResponse`.
- **Actual:** 400 `VALIDATION_ERROR` „Body muss JSON sein" (Backend-Route Zeile 65–68: `await req.json().catch(() => null)` → null → 400).
- **Suggested Fix (Option A, schneller):** Frontend `sendMarketingEmail(emailId)` in `src/lib/api-client.ts` Zeile 940 erweitern um `recipientIds`-Param und Body senden:
  ```ts
  export async function sendMarketingEmail(
    emailId: string,
    recipientIds: string[],
  ): Promise<MarketingEmailSendResponse> {
    return request(..., { method: 'POST', body: { recipientIds } });
  }
  ```
  Composer Zeile 262 entsprechend mit `Array.from(selectedIds)` aufrufen.
- **Suggested Fix (Option B):** Backend liest `recipientIds` aus `MarketingEmail`-Tabelle statt aus dem Request-Body (würde aber bedeuten, dass Recipient-IDs persistiert sein müssen — aktuell sind sie nur via `MarketingEmailRecipient` nach erstem `performBulkSend`-Run vorhanden, also komplexer).
- **Empfehlung:** **Option A.** OpenAPI 3.1 Spec entsprechend nachziehen (`/send` mit RequestBody `{ recipientIds: string[] }`).

### BUG-002 — S05 AC2: E-Mail-/Vorname-/Nachname-Vorausfüllung im Konto-Card
- **Severity:** Major
- **Layer:** Frontend / Backend (PII-Trade-off)
- **Routing:** solution-architect (Trade-off-Entscheidung) → frontend-engineer
- **Repro:**
  1. Als Gast Buchungsformular vollständig ausfüllen, „Anfrage absenden".
  2. Auf Bestätigungsseite landen → Konto-Anbieten-Card sehen.
  3. Erwartet (laut AC2): „E-Mail-Adresse, Vorname und Nachname aus dem Buchungsformular bereits vorausgefüllt."
  4. Actual: Card zeigt KEIN E-Mail-Eingabefeld; statt dessen nur Hinweistext „Wir verknüpfen das Konto mit der E-Mail aus Ihrer Anfrage." Vorname wird in der Begrüßung verwendet (`Hallo {firstName}`); Nachname wird gar nicht angezeigt.
- **Wurzel:** `BookingConfirmation` ruft `<CreateAccountOfferSheet displayEmail="" />` auf, weil `public-summary` die E-Mail bewusst nicht in der Antwort liefert (PII).
- **Erwartet:** Entweder die E-Mail-Adresse anzeigen (read-only), oder die AC explizit als „funktional erfüllt — User muss nur Passwort setzen, Email wird vom Token abgeleitet" markieren und im UX-Spec festhalten.
- **Suggested Fix (Option A):** `BookingPublicSummary` um optional `customerEmail` ergänzen, **nur** wenn Token-Auth (nicht Cookie-Auth) und `?new=true` (verhindert E-Mail-Leak via Public-Link). Frontend zeigt E-Mail dann read-only. Strenger an AC2.
- **Suggested Fix (Option B):** AC2 als „Spirit erfüllt" akzeptieren (User muss tatsächlich nur ein Passwort setzen) und die `BookingConfirmation` nicht ändern, aber UX-Spec §3.5 nachziehen.
- **Empfehlung:** **Option B akzeptieren bei PM-Review.** Wenn PM auf strikten Buchstaben besteht: Option A.

### BUG-003 — S15 DSGVO/UWG-Risiko: Backend-Send filtert nicht auf "Bestandskunde"
- **Severity:** Major (Compliance)
- **Layer:** Backend
- **Routing:** backend-engineer + solution-architect-Review
- **Repro:**
  1. Als Admin POST `/api/admin/marketing/recipients?hasBooked=false` aufrufen → liefert ALLE `CustomerUser`-Records, auch ohne COMPLETED-Booking.
  2. Eine dieser IDs in `POST /api/admin/marketing/emails` mit `status: 'send'` packen.
  3. `performMarketingBulkSend` (Zeile 62–69 in `marketing-bulk-send.ts`) filtert NUR auf `unsubscribedAt: null` und `email != null/empty`. Kein Booking-Check.
- **Erwartet (laut UWG §7 Abs. 3 / Phase-2-Revision §R.0):** Marketing-Mails dürfen ausschließlich an Bestandskunden gehen, also `CustomerUser` mit ≥1 COMPLETED-Booking.
- **Actual:** Wenn der Admin (versehentlich) `hasBooked=false` aktiviert hat oder die Frontend-Logik bricht, kann ein Customer ohne Booking eine Marketing-Mail erhalten — UWG §7 Abs. 3 Verletzung.
- **Suggested Fix:** In `performMarketingBulkSend` vor dem Send einen Subquery hinzufügen:
  ```ts
  const validCustomers = await prisma.customerUser.findMany({
    where: {
      id: { in: args.recipientCustomerIds },
      unsubscribedAt: null,
      bookings: { some: { status: 'COMPLETED' } },  // NEU
    },
    select: { id: true, email: true, firstName: true },
  });
  ```
  Differenz zwischen `intendedRecipients` und `actualRecipients` ist im Response transparent.
- **Empfehlung:** **Sofortiger Fix vor Production-Deploy.** Compliance-Risiko zu hoch, um auf "Tom wird's nicht falsch klicken" zu vertrauen.

### BUG-004 — OpenAPI-Spec Drift: `/send` ohne Body, Implementierung mit Body
- **Severity:** Major (Doku/Verträge)
- **Layer:** Contract
- **Routing:** solution-architect
- **Repro:** Vergleiche `contracts/iteration-12.openapi.yaml` Zeile 342–384 (kein `requestBody`) mit `src/app/api/admin/marketing/emails/[id]/send/route.ts` Zeile 31–36 (`SendBodySchema` mit `recipientIds`).
- **Erwartet:** OpenAPI-Spec spiegelt die tatsächliche Backend-Schnittstelle.
- **Actual:** Drift. Wenn BUG-001 via Option A gefixt wird (Frontend sendet Body), muss die OpenAPI auch nachgezogen werden.
- **Suggested Fix:** Bei Behebung von BUG-001 (Option A) auch `iteration-12.openapi.yaml` updaten: `requestBody` mit `{ recipientIds: string[], minItems: 1, maxItems: 50 }`.

---

## Findings (Should Fix)

### FIND-001 — S05 Backend gibt 401 statt subcode `INVALID_TOKEN` zurück (kosmetisch)
- **Severity:** Minor
- **Layer:** Contract
- **Befund:** Backend `register-from-booking` Zeile 102–117 setzt `code: 'UNAUTHORIZED'` mit `subcode: 'INVALID_TOKEN'` — das ist 401-Pfad. Frontend prüft `err.status === 401 || err.status === 400 || subcode === 'INVALID_TOKEN'` — funktioniert. OpenAPI-Spec sagt 401 mit subcode INVALID_TOKEN. Konsistent, aber das `apiError({ code: 'UNAUTHORIZED' })` mappt vermutlich auf HTTP 401 — bitte verifizieren.
- **Fix:** Optional — testen, dass `apiError(code: 'UNAUTHORIZED')` tatsächlich HTTP 401 setzt (lib/api.ts).

### FIND-002 — Marketing-Composer auto-saved Draft kann nicht aktualisiert werden
- **Severity:** Minor (UX)
- **Layer:** Frontend
- **Befund:** Composer Zeile 158–171: nach erstem Auto-Save wird kein neuer Draft mehr angelegt. Wenn Tom Subject/Body danach ändert, ist der neue Inhalt im Draft NICHT gespeichert; der Send geht aber via `bodyText` aus dem ersten Draft. Tom merkt das nicht, weil das Step-5-„Bestätigen"-Panel die aktuelle Body-State zeigt — nicht den DB-Inhalt.
- **Wurzel:** Backend hat keinen `PATCH /api/admin/marketing/emails/{id}`-Endpoint. Frontend kommentiert das in Zeile 159 explizit als „kein Update".
- **Fix:** Entweder einen PATCH-Endpoint nachziehen ODER beim Send den AKTUELLEN Subject/Body aus dem Frontend-State an `/send` mitschicken (siehe BUG-001 Fix). Letzteres deckt sich mit Option A.

### FIND-003 — S15 Marketing-Historie nicht implementiert (Should-Have, nicht Must-Have)
- **Severity:** Minor
- **Layer:** Frontend
- **Befund:** `GET /api/admin/marketing/emails` (Liste) ist Backend-implementiert, aber kein Frontend-UI/Page (`/admin/marketing/historie` o. ä.). Sidebar verlinkt nur Composer.
- **Empfehlung:** **Bestätigt als Backlog für IT13** — kein Blocker für IT12 Sign-Off.

### FIND-004 — S03 Performance-Target Production-Verifikation
- **Severity:** Should fix
- **Layer:** Verifikation/Test
- **Befund:** AC1 fordert „Kalender in unter 1.5s sichtbar". Code-seitig ist N+1 eliminiert. Es liegt KEIN Performance-Smoke-Test vor (Lighthouse, k6, oder lokale Messung gegen Turso-Prod). Ohne Production-Messung kann kein hartes Pass behauptet werden.
- **Empfehlung:** Tom soll nach Deploy explizit messen (Browser DevTools Network-Tab → `/api/availability/calendar`-Response-Time + Time-to-Visible des Kalenders).

### FIND-005 — S02 Service-Tests nicht im Test-Lauf abgedeckt
- **Severity:** Minor
- **Layer:** Tests
- **Befund:** `pnpm test:it12` deckt nur Backend-Logik (Marketing + Idempotency). Service-Image-Mapping ist ein einfacher Lookup — kein Test, aber trivial. Kein Frontend-Test (Cypress/Vitest) für das Hero-Layout oder den Fallback-Pfad.
- **Empfehlung:** Manueller Smoke-Test pro Slug ist akzeptabel.

### FIND-006 — S07 ProfileForm: schwacher Header-Refresh durch `router.refresh()` fehlt
- **Severity:** Minor (Defensive)
- **Layer:** Frontend
- **Befund:** `ProfileForm` ruft nach erfolgreichem Save `emitCustomerChanged()` (gut), aber keinen `router.refresh()` für Server-Components, die Customer-Daten zeigen. Wenn ein Server-Component (z. B. eine zukünftige `/konto/order-history`-Seite) den Customer-Snapshot zeigt, würde der nach Save stale bleiben bis zum nächsten Navigation-Trigger.
- **Empfehlung:** `router.refresh()` zusätzlich aufrufen. Nicht kritisch für IT12 (alle aktuellen Customer-Views sind Client-Side).

---

## Test-Ergebnisse

- **`tsc --noEmit`:** ✅ Clean (keine Type-Errors).
- **`npm run test:it12`:** ✅ 19/19 passed (Unsubscribe-Token, Marketing-Template, Footer, MarketingEmail-Schema, Idempotency-Key-Schema/Header).
- **`npx next build`:** ✅ Build erfolgreich. Alle 6 Service-Slug-Pfade werden generiert (`/services/entruempelung`, `/services/entkernung`, `/services/reinigung`, +3). Marketing-Routes prerendered. **0 Build-Errors, 0 unerwartete Warnings.**

### OpenAPI Compliance

| Endpoint | Status | Bemerkung |
|----------|--------|-----------|
| `POST /api/customer/register-from-booking` | ✅ | Vollständig konform. |
| `POST /api/bookings` (Idempotency) | ✅ | Header `Idempotency-Key` gelesen + cached. |
| `GET /api/bookings` (Admin) | ✅ | |
| `GET /api/admin/marketing/recipients` | ✅ | Alle Filter implementiert + `dailyQuotaRemaining`. |
| `POST /api/admin/marketing/emails` | ✅ | Draft + Send-Pfad. |
| `GET /api/admin/marketing/emails` | ✅ | Pagination. |
| `GET /api/admin/marketing/emails/{id}` | ✅ | mit `failedRecipients`. |
| `POST /api/admin/marketing/emails/{id}/test-send` | ✅ | Body-frei, Admin-Email aus Session. |
| `POST /api/admin/marketing/emails/{id}/send` | ❌ **DRIFT** | OpenAPI spec sagt kein Body, Backend erfordert `recipientIds`. Siehe BUG-001 + BUG-004. |
| `GET /api/customer/unsubscribe` | ✅ | HMAC-Verify + 302-Redirects. |
| `GET /api/availability/calendar` | ✅ | Cache-Header + Batch-Loads. |
| `GET /api/customer/bookings` | ✅ | mit `cancelledAt`. |
| `GET /api/admin/upcoming-bookings` | ✅ | |

### Spezial-Checks

- **DSGVO-Audit-Trail:** ✅ `MarketingEmail` + `MarketingEmailRecipient`-Tabellen im Schema; im `performMarketingBulkSend` werden pro Empfänger PENDING-Records angelegt, dann SENT/FAILED-Update mit `resendMessageId` (Zeile 107–158). Email wird als Snapshot gespeichert (line 113).
- **HMAC-Stateless-Unsubscribe:** ✅ `verifyUnsubscribeToken` arbeitet ohne DB-Lookup; `generateUnsubscribeToken` ist deterministisch. DB-Update für `unsubscribedAt` erfolgt im Endpoint (route.ts Zeile 50–57). Konstante-Zeit-Vergleich der Signaturen implementiert (Zeile 86–92 in marketing-tokens.ts).
- **Resend-Quota-Logik:** ✅ Daily-Cap 100/Tag wird vor Send geprüft (`marketing-bulk-send.ts` Zeile 53–59 + 91–98). Bei Überschreitung → 429 `DAILY_QUOTA_EXCEEDED`.
- **Bestandskunden-Definition:** ❌ **siehe BUG-003** — Backend filtert NICHT auf COMPLETED-Booking beim Send. Recipients-Endpoint kann mit `hasBooked=false` Customer ohne Booking liefern. Frontend nutzt `hasBooked=true`, aber Backend ist letzte Verteidigungslinie und darf das nicht annehmen.
- **Service-Filter S15:** ✅ Recipients-Endpoint filtert in `prisma.booking.findMany` korrekt auf `service: { in: serviceFilter }` UND `status: 'COMPLETED'`. Service-Slugs werden gegen `SERVICE_SET` validiert (Zeile 86–94). Hard-Cap 200 pro Page.
- **Idempotency-Key in S11:** ✅ `IdempotencyKey`-Tabelle vorhanden, `lookupIdempotencyResponse` vor Insert in `bookings/route.ts` Zeile 202–213. `Idempotency-Replay: 1`-Header gesetzt bei Replay.
- **Kalender-Performance N+1:** ✅ `Promise.all` mit 4 parallelen Queries (`booking.findMany`, `dayOverride.findMany`, `availabilityTemplate.findMany`, `bufferConfig.findFirst`) — keine Schleife mehr.
- **Service-Bilder S02:** ✅ Layout korrekt (Icon + h1 nebeneinander, Foto separat).
- **Scroll-Stabilität:** ✅ Grep `scrollIntoView` ohne `IfNeeded`-Suffix findet nur Helper-Definition; alle Aufrufstellen migriert.
- **Login-State Sync S07:** ✅ `customer-sync.ts` + `useCustomer.ts`-Subscription + `lastKnownStatusRef` gegen Network-Race.
- **Form-Prefill S08:** ✅ Render-Gate auf `customerStatus === 'loading'` in BookingClient.
- **Konto-anbieten S05:** ✅ Embedded-Card (kein Modal); 409 ACCOUNT_EXISTS mit Login-CTA.
- **Admin-Nav S14:** ✅ 3 Top-Level-Gruppen wie spezifiziert; Welcome-Banner localStorage-gated; keine Bewertungen-Duplikate.
- **Marketing-Composer S15:** ✅ 6 Steps, Hard-Cap 50, Char-Counter `{body.length} / 5000`, Plain-Text only, Pflicht-Footer-Preview, UWG-Confirm-Checkbox.

---

## Manuelle Tests für Tom (Production-Smoke nach Deploy)

> Reihenfolge: zuerst die DevOps-Pflicht-Aktionen (Migration + Env-Vars), dann pro Story.

### Phase 1 — DevOps-Pflichtaktionen (vor allem)

1. **Vercel-Env-Vars setzen/verifizieren:**
   - `NEXTAUTH_URL=https://www.baerenstark-hausservice.app`
   - `NEXT_PUBLIC_BASE_URL=https://www.baerenstark-hausservice.app`
   - `UNSUBSCRIBE_TOKEN_SECRET` (32+ Random-Bytes — `openssl rand -base64 32`)
   - `BLOB_READ_WRITE_TOKEN` (regenerieren falls 10er-INTERNAL_ERROR-Verdacht)
   - `RESEND_API_KEY` (gültig, kein Placeholder)
   - `MAIL_FROM` (verifizierte Domain, z. B. `kontakt@baerenstark-hausservice.app`)
2. **Google Cloud Console — Authorized Redirect URI:** exakt `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`.
3. **Prisma-Migration deployen:**
   ```bash
   npx prisma migrate deploy
   ```
   Erwartete neue Migrationen: Marketing-Tabellen + `customer_users.unsubscribedAt/Reason` + `idempotency_keys`.

### Phase 2 — Smoke-Tests pro Story

4. **S01:** Inkognito-Browser → `https://www.baerenstark-hausservice.app/konto/login` → „Mit Google anmelden" → Google-Konto wählen → Redirect zurück → erwartet: eingeloggt auf `/konto`, kein 4xx in Vercel-Logs auf der Callback-Route.
5. **S02:** `/services/entruempelung` öffnen → Hero-Foto sichtbar (Foto rechts auf Desktop, oben auf Mobile), Icon klein neben H1. Wiederholen für alle 6 Slugs (entkernung, reinigung, gruenflaechenpflege, muelltonnenservice, entsorgung).
6. **S03:** `/buchung` → Schritt „Wann?" → Stoppuhr: Kalender muss < 1.5s sichtbar sein. Auf einen verfügbaren Tag klicken → muss visuell als ausgewählt markieren (kein Hängen).
7. **S04:** `/buchung` → Schritt „Wie lange?" → Slot auswählen → Scrollposition NICHT verändert.
8. **S05:** Als Gast (kein Cookie) → Buchung absenden → auf Bestätigungsseite landen → Konto-Card sichtbar → Passwort eingeben → Konto erstellt + eingeloggt → Redirect/Toast → `/konto` zeigt die Anfrage.
9. **S06:** Als Customer eingeloggt → `/konto` → Anfragen-Liste rendert (kein 500).
10. **S07:** `/konto/profil` → Adresse ändern → Speichern → Header zeigt **weiterhin** „Mein Konto", **kein** „Anmelden"-Button.
11. **S08:** Als Customer eingeloggt → `/buchung` → Form prüfen: Name/E-Mail/Telefon/Adresse vorausgefüllt.
12. **S09:** Als Customer eingeloggt → `/buchung` → zwischen Feldern Tab/Klick wechseln → KEIN Scroll-Sprung.
13. **S10:** `/buchung` → Bild-Upload (1 MB JPEG) → erfolgreich, im Form Preview sichtbar. Großdatei (>10 MB) testen → klare deutsche Fehlermeldung.
14. **S11:** `/buchung` als Customer → Submit → Loader verschwindet, Toast „Anfrage gesendet", Redirect zur Bestätigung. `/konto` zeigt die Anfrage. **Doppelklick-Schutz:** zweimal schnell submitten → nur EIN Booking entsteht (Idempotency-Key).
15. **S12:** Als Admin → `/admin` → Widget „Bevorstehende Termine" lädt.
16. **S13:** Als Admin → `/admin/bookings` → Buchungsanfragen-Liste rendert.
17. **S14:** Als Admin → Sidebar prüfen: 3 Gruppen, Bewertungen NUR in Auswertungen. Welcome-Banner einmalig sichtbar, dann durch Klick auf „Verstanden" verschwunden, bleibt nach Reload weg.
18. **S15 — Marketing-Mail (KRITISCH, nach BUG-001-Fix):**
    - `/admin/marketing` → Service-Filter „Entrümpelung" → Liste zeigt Customer mit COMPLETED-Bookings im Service.
    - 1 Customer auswählen → Schritt 2 → Subject + Body (≤5000 chars) → Schritt 3 (Footer-Preview) → Schritt 4 Test-Send an Tom's Admin-Email → Mail in Tom's Postfach prüfen, Pflicht-Footer + Unsubscribe-Link sichtbar.
    - Schritt 5: UWG-Checkbox setzen → „Senden". Erwartet: Step 6 mit `successCount: 1, failureCount: 0`.
    - **Unsubscribe-Test:** Im Postfach des Test-Empfängers den Footer-Link klicken → `/marketing/abgemeldet?ok=1` Bestätigungsseite. In DB prüfen: `customer_users.unsubscribedAt` ist gesetzt.
    - **Daily-Quota-Test:** Wenn vorhanden (≥100 Empfänger im Verteiler), 51 Empfänger auswählen → `RECIPIENT_CAP_EXCEEDED`-Banner.

### Phase 3 — Logs & Monitoring

19. Vercel-Logs auf `4xx` und `5xx` für alle in Phase 2 getesteten Routes prüfen — keine neuen ungeklärten Fehler.
20. Resend-Dashboard auf bounced/failed Mails prüfen.

---

## Iteration-12 Sign-Off-Empfehlung

- [ ] **APPROVED** — alle Stories Done
- [ ] **APPROVED with caveats** — kleinere Issues offen, akzeptabel
- [x] **BLOCKED** — Defects müssen gefixt werden, Loop zurück zu Phase 3

**Begründung:** S15 ist der Kern dieser Iteration (8 Story-Points, größtes Feature). Der Bulk-Send-Pfad ist durch BUG-001 funktional kaputt (FE→BE-Body-Mismatch). Compliance-Risiko BUG-003 (Bestandskunden-Filter im Backend fehlend) muss vor Production-Deploy adressiert werden — UWG §7 Abs. 3 ist nicht verhandelbar.

**Empfohlener Loop:**

1. **Backend-Engineer (oder Frontend, je nach Option-Wahl):** BUG-001 (Body-Mismatch) fixen — Empfehlung Option A (Frontend sendet `recipientIds` im Body).
2. **Backend-Engineer:** BUG-003 — `bookings: { some: { status: 'COMPLETED' } }` in `performMarketingBulkSend` ergänzen.
3. **Solution-Architect:** OpenAPI-Spec `iteration-12.openapi.yaml` für `/send` mit `requestBody` aktualisieren (BUG-004).
4. **Project-Manager / Stakeholder:** BUG-002 entscheiden — strikter Buchstabe von AC2 (Email anzeigen) oder Spirit (User muss nur Passwort setzen). Ich empfehle Spirit-Akzeptanz + UX-Spec-Update.
5. **Frontend-Engineer (optional, FIND-002):** Composer Body-Update beim Send, falls Tom zwischendurch Subject/Body editiert.
6. **DevOps:** Phase 1 der Manual-Tests ausführen (Env-Vars + Migration + Google-Cloud-Console).

Nach BUG-001/003/004-Fix kann erneut QA-Verify aufgesetzt werden — geschätzt 1-2h Arbeit, 30 Min QA-Re-Run.

---

## Re-Verify (Post-Bug-Fix)

**Datum Re-Verify:** 2026-05-04
**Scope:** BUG-001, BUG-002, BUG-003, BUG-004, FIND-002 + Cross-Story-Regression-Smoke

### Defect-Status (Re-Verify)

| Bug-ID | Original-Verdict | Re-Verify-Verdict | Notes |
|--------|------------------|-------------------|-------|
| BUG-001 | Critical | **Resolved** | Frontend-Composer (`MarketingEmailComposer.tsx` Z. 272–281) ruft `sendMarketingEmail(draftId, { recipientIds, subject, body })` auf. `api-client.ts` Z. 967–975 typisiert + sendet Payload. Backend (`route.ts` Z. 96–157) parst Body, fällt sauber auf DB-Werte zurück, persistiert FE-Edits vor Send. Kein 400-Pfad mehr. |
| BUG-002 | Major | **Resolved** | `public-summary/route.ts` Z. 92 + 175 liefert `customerEmail` aus (Token-Auth ODER Cookie-Auth-Owner — beide bereits authorisiert, daher kein PII-Leak). Page-Chain (`page.tsx` Z. 116) reicht es an `BookingConfirmation` durch. `CreateAccountOfferSheet` Z. 234–303 zeigt Email read-only mit „Erstellen Sie ein Konto für {email}". Vorname-Greeting via `displayFirstName`. AC2 strikt erfüllt. |
| BUG-003 | Major (Compliance) | **Resolved** | `marketing-bulk-send.ts` Z. 91–98 filtert auf `bookings: { some: { status: 'COMPLETED' } }` UND `unsubscribedAt: null` UND nicht-leerer Email. `strictRecipients: true`-Pfad (Z. 119–129) wirft 422 INVALID_RECIPIENTS. `excludedRecipientIds` werden via Header `X-Excluded-Count`/`X-Excluded-Ids` an FE durchgereicht (Backend `route.ts` Z. 190–193). Dedicated Backend-Test (it12-backend.test.ts) validiert den Filter-Pfad. |
| BUG-004 | Major (Doku) | **Resolved** | `iteration-12.openapi.yaml` Z. 413–506: `/send` mit optionalem `requestBody` (`MarketingEmailSendRequest`-Schema Z. 744–772, `recipientIds`+`subject`+`body` optional, max 50). 422-Response Z. 480–496 mit Header-Doku `X-Excluded-Count` / `X-Excluded-Ids`. Schema in der `MarketingEmailSendResponse` enthält `excludedRecipientIds`. |
| FIND-002 | Minor (UX) | **Resolved** | Lösung: Send-Body-Pfad (Option B aus dem Original-Report). Composer schickt aktuelle Composer-State-Werte an `/send`; Backend persistiert sie auf der MarketingEmail-Row vor dem Send (`route.ts` Z. 144–157). Kein dedizierter PATCH-Endpoint nötig. Auto-Save-Draft-Edit-Lücke ist damit geschlossen. |

### Test-Status

- **`tsc --noEmit`:** ✅ Clean (0 Errors).
- **`npm run test:it12`:** ✅ **20/20 passed** (vorher 19/19; +1 neuer Test `BUG-003 — performMarketingBulkSend filtert auf Bestandskunden — strictRecipients=true wirft INVALID_RECIPIENTS für Customer ohne COMPLETED-Booking`).
- **`npx next build`:** ✅ Build erfolgreich (Exit-Code 0). Alle 6 Service-Slugs prerendered. Marketing-Routes (`/admin/marketing`, `/marketing/abgemeldet`) gebaut. Build-Warnings sind Node-Deprecations (`punycode`) und Webpack-Pack-Cache (kein Fail).

### Cross-Story-Regression (Smoke)

| Story | Check | Status |
|-------|-------|--------|
| S02 Service-Detail | `ServiceDetailHero` weiterhin importiert + verwendet (`services/[slug]/page.tsx` Z. 24, 241). Layout unverändert. | ✅ |
| S07 customer-sync | `emitCustomerChanged()` weiterhin in `customer-sync.ts` exportiert. `CreateAccountOfferSheet` ruft es korrekt auf (Z. 108). | ✅ |
| S11 Idempotency-Key | `lookupIdempotencyResponse` weiterhin in `bookings/route.ts` Z. 55 + 203 referenziert. Test-Suite-Block „Idempotency-Key-Header-Validation" passing (4/4). | ✅ |
| S08 Form-Prefill | Render-Gate auf `customerStatus === 'loading'` unverändert (BookingClient nicht modifiziert). | ✅ |

### Bewertung der Fix-Qualität

- **Backend** hat über die ursprünglichen Fix-Vorschläge hinaus zwei Verbesserungen eingebaut:
  1. **Optional-Body-Pfad** statt strict-required — alte Aufrufer (z.B. inline-send aus `POST /api/admin/marketing/emails` mit `status='send'`) bleiben funktional.
  2. **Subject/Body-Persistenz beim Send** löst FIND-002 ohne neuen PATCH-Endpoint — sauberer als die ursprünglich vorgeschlagene Architekturänderung.
- **Frontend** hat den Send-Call mit defensivem 422-Handling erweitert — ausgeschlossene IDs werden im Failure-Banner angezeigt (auch wenn die Backend-Implementierung sie aktuell nur per Header durchreicht; FE liest noch nicht den Header, sondern erwartet sie im `details`-Feld → siehe Caveat unten).
- **OpenAPI** ist vollständig konsistent mit der Implementierung.

### Caveats (Minor — kein Blocker)

- **CAVEAT-001 (Minor):** Frontend-Composer Z. 307–312 versucht ausgeschlossene Recipient-IDs aus `err.details.excludedRecipients` zu lesen. Backend liefert sie aber via HTTP-Header `X-Excluded-Ids` (comma-separated). Resultat: Bei 422 sieht Tom die Fehlermeldung „Empfänger wurden ausgeschlossen…", aber NICHT die konkrete ID-Liste im UI. Funktional korrekt (Tom kann Auswahl reduzieren), aber Audit-Transparenz im UI fehlt. **Empfehlung:** in IT13 nachziehen — entweder ApiClientError den Header parsen lassen oder Backend die Liste zusätzlich im Body unter `details.excludedRecipients` zurückgeben.
- **CAVEAT-002 (Minor):** Originaler FIND-001 (UNAUTHORIZED→401-Mapping) wurde im Re-Verify nicht erneut geprüft — war als „Optional/kosmetisch" eingestuft und ist nicht Teil der Fix-Loop.

### Final Sign-Off-Empfehlung

- [x] **APPROVED with caveats** — alle Critical/Major-Bugs resolved, deploy-ready für Production. Caveats sind nicht-blockierend und können in IT13 adressiert werden.
- [ ] APPROVED — alle Stories Done
- [ ] BLOCKED — Loop nötig

**Begründung:** BUG-001 (Body-Mismatch) ist auf allen drei Layern (FE, BE, OpenAPI) konsistent gefixt. BUG-003 (UWG-Compliance-Filter) ist in der `marketing-bulk-send`-Helper als letzte Verteidigungslinie implementiert UND durch einen automatisierten Test abgesichert. BUG-002 (PII-Email-Vorausfüllung) ist strikt nach AC2-Buchstabe gelöst (Email read-only sichtbar). FIND-002 ist eleganter gelöst als ursprünglich vorgeschlagen (kein zusätzlicher Endpoint). tsc + tests + build alle grün. Cross-Story-Regression sauber.

**Production-Ready** sobald Tom die Phase-1-DevOps-Aktionen (Vercel-Env-Vars, Google-Cloud-Console-Redirect-URI, `prisma migrate deploy`) ausgeführt hat — diese sind unverändert aus dem Original-Report Pflicht und nicht Teil des Code-Fix-Loops.
