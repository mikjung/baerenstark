# QA Design Review — Iteration 11

**Modus:** Design QA (vor Implementierung)
**Datum:** 2026-05-04
**Iteration:** 11
**Stories im Scope:** US-IT11-01 bis US-IT11-06
**Quellen:** `PROJECT.md` §IT11, `project/user-stories/iteration-11.md`, `ARCHITECTURE_IT11.md`, `contracts/bookings-cancel.openapi.yaml`, `project/design/requirements/frontend-requirements.md`, `project/design/ux/ux-spec.md`, `project/design/ux/component-library.md`

---

## 1. Sign-off-Status pro Story

| Story | Verdikt | Begründung |
|---|---|---|
| US-IT11-01 | Approved with conditions | Operative Story — Konfig-Fix. Akzeptanztest klar, aber Sequenz/Rollback-Plan und Mail-Verifikations-Übergang nicht explizit (siehe BUG-MAJOR-04). |
| US-IT11-02 | Approved with conditions | Modal-Refactoring sauber spezifiziert. UX-Q4 (Bottom-Sheet vs. Step-Indicator) noch offen — wirkt sich auf Mobile-Implementation aus. |
| US-IT11-03 | **Blocked** | Hartes URL-/Komponenten-Konflikt zwischen Architecture + frontend-requirements (`/buchung/bestaetigt?id=&token=`, Edit von `BestaetigtClient.tsx`) und UX-Spec + component-library (neue Route `/buchung/bestaetigung/[bookingId]`, neue Komponente `BookingConfirmation`). Nicht implementierbar bis aufgelöst. Siehe BUG-CRITICAL-01. |
| US-IT11-04 | Approved with conditions | Limits klar (10/50/10 MB), MIME-Validation gut. Aber: 0-Byte-Datei, MIME-Spoofing, Lightbox-Spec vs. Architecture „neuer Tab nur" widersprechen sich. Siehe BUG-MAJOR-05, MAJOR-06. |
| US-IT11-05 | Approved | Reines Operatives Story. Defensiver Index-Cast bleibt. Edge-Case (Pre-Fill nach Editieren beibehalten beim Reopen) nicht spezifiziert — siehe BUG-MAJOR-07. |
| US-IT11-06 | **Blocked** | Mehrere Konflikte: (a) Storno-Page-URL `/buchung/stornieren?id=&token=` (FE-Req) vs. `/buchung/[id]/stornieren?token=` (UX-Spec) — siehe BUG-CRITICAL-02. (b) Phantom-Endpoint `GET /api/bookings/{id}/cancel-preview` in UX-Spec — nicht in Architecture/OpenAPI. (c) `cancelledBy`-Enum-Drift `'GUEST_TOKEN'` vs. `'CUSTOMER'`. |

**Zusammenfassung:** 2 von 6 Stories sind hart blockiert (US-IT11-03, US-IT11-06). Beide Blocker sind **Spezifikations-Konflikte**, nicht inhaltliche Probleme. Sobald die Routing-/Endpoint-Drift behoben ist (eine Architect-/UX-Designer-Sitzung von ~1h), lassen sich beide Stories sauber implementieren.

---

## 2. Defekt-Liste

### CRITICAL

**BUG-CRITICAL-01 — Bestätigungsseiten-Routing widerspricht sich (US-IT11-03)**
- Architecture/FE-Req: `/buchung/bestaetigt?id=&token=`, Edit von `BestaetigtClient.tsx`.
- UX-Spec/Component-Lib: neue Route `/buchung/bestaetigung/[bookingId]?token=…`, neue Komponente `BookingConfirmation`.
- **Empfehlung:** UX-Variante (semantische Trennung Counter-Proposal vs. Initial-Confirmation).
- **Routing:** solution-architect + ux-designer.

**BUG-CRITICAL-02 — Storno-Page-Routing widerspricht sich (US-IT11-06)**
- Architecture/FE-Req: `/buchung/stornieren?id=&token=` (Query).
- UX-Spec/Component-Lib: `/buchung/[id]/stornieren?token=…` (Path).
- **Empfehlung:** UX-Variante (RESTful, sauberer).
- **Routing:** solution-architect.

**BUG-CRITICAL-03 — Phantom-Endpoint `GET /api/bookings/{id}/cancel-preview` (US-IT11-06)**
- UX-Spec/Component-Lib referenzieren ihn — Architecture und OpenAPI haben ihn nicht.
- **Empfehlung:** Wiederverwendung des bestehenden `public-summary`-Endpoints.
- **Routing:** ux-designer (Korrektur) + solution-architect (Bestätigung).

**BUG-CRITICAL-04 — Storno-Token-Lifecycle: 30 Tage gültig + 24h-Frist + Single-Use Edge-Case (US-IT11-06)**
- UX-Spec hat keinen State für „Token gültig, aber 24h-Frist abgelaufen" → Cancel-Submit gibt 409, UI zeigt nur generisches 5xx-Banner.
- **Empfehlung:** UX-Spec um State `frist-abgelaufen` (200 OK auf Preview, 409 auf Submit) ergänzen mit Banner „Stornierung nicht mehr möglich — bitte rufen Sie an".
- **Routing:** ux-designer.

### MAJOR

**BUG-MAJOR-01 — `cancelledBy`-Enum-Drift**
- Architecture: `'CUSTOMER'|'ADMIN'|'SYSTEM'`. UX-Spec: `…|'GUEST_TOKEN'`.
- **Empfehlung:** GUEST_TOKEN ergänzen (Tom sieht Quelle in Admin-Detail).
- **Routing:** solution-architect + ux-designer.

**BUG-MAJOR-02 — TimeSlot-Race bei parallel Cancel + Book nicht abgedeckt**
- Architecture spezifiziert keine Concurrency-Strategie zwischen Cancel und Book auf demselben Slot.
- **Empfehlung:** Optimistic, mit klarem 409 für den Verlierer. Test-Case ergänzen.
- **Routing:** solution-architect.

**BUG-MAJOR-03 — Kein Server-seitiger Doppel-Submit-Schutz für `POST /api/bookings`**
- Bei Network-Retry oder Doppel-Klick könnten zwei DB-Zeilen + zwei Mails entstehen.
- **Empfehlung:** Optimistic Dedup `(customerEmail, slotId, createdAt within 60s)`.
- **Routing:** solution-architect.

**BUG-MAJOR-04 — Resend-Sandbox-Modus-Übergang nicht im Akzeptanztest**
- AC3 (Mail an Tom) klappt im Sandbox nur bei manueller Test-Empfänger-Listung.
- **Empfehlung:** Sign-off-Checkliste um „Domain verifiziert ODER Test-Empfänger gepflegt" + Smoke mit nicht-test-Empfänger.
- **Routing:** solution-architect + project-manager.

**BUG-MAJOR-05 — Datei-Upload-Edge-Cases unvollständig**
- 0-Byte-Datei, MIME-Spoofing, korruptes Video, paralleler Upload (max 3?) nicht spezifiziert.
- **Empfehlung:** Architecture um Min-Size + Magic-Bytes-Check + parallele Upload-Anzahl ergänzen.
- **Routing:** solution-architect.

**BUG-MAJOR-06 — Lightbox-Spec widerspricht Architecture-„Backlog IT12"**
- UX-Spec spezifiziert vollständige Lightbox; Architecture sagt „neuer Tab reicht für MVP".
- **Empfehlung:** Tom-Entscheidung. Default: Backlog (kein Scope-Creep).
- **Routing:** project-manager (Tom) + ux-designer.

**BUG-MAJOR-07 — Profil-Vorausfüllung: Edit-Dann-Modal-Schließen-Verhalten**
- Wenn User Field editiert, schließt, erneut öffnet — Edit verloren oder persistiert?
- **Empfehlung:** Modal frisch (re-load aus Profil), explizit dokumentieren.
- **Routing:** ux-designer.

**BUG-MAJOR-08 — Storno-Token-Re-Verbrauch durch Mail-Provider-Scanner**
- Konzeptionell sicher (GET ist read-only, Storno braucht POST), aber nicht explizit dokumentiert.
- **Empfehlung:** Architecture-Hinweis „POST nie via GET auslösen".
- **Routing:** solution-architect.

**BUG-MAJOR-09 — `BookingDialogProvider`-State-Reset nach Submit nicht spezifiziert**
- Nach erfolgreichem Submit + Auto-Redirect: bleibt State im Provider stehen?
- **Empfehlung:** `reset()`-Methode + Aufruf nach Redirect.
- **Routing:** solution-architect oder ux-designer.

### MINOR

- **BUG-MINOR-01:** Microcopy-Drift „Telefonisch erreichbar" vs. „Bei dringenden Anliegen" — eine kanonische Variante.
- **BUG-MINOR-02:** Telefon-Format-Inkonsistenz `0157-74787512` vs. `0157 74787512` vs. `+4915774787512`.
- **BUG-MINOR-03:** `Toaster`-Render-Position bei Page-Wechsel — Engineer-Hinweis fehlt.
- **BUG-MINOR-04:** Doppelter `useCustomer()`-Call in `/buchung`-Fallback + Provider — dokumentationswürdig.
- **BUG-MINOR-05:** A11y-Stornieren-Button `aria-label` Microcopy-Varianten — eine wählen.
- **BUG-MINOR-06:** Test-Strategie ohne systematische A11y-Tests — Test-Plan ergänzen.

---

## 3. Test-Strategie pro Story (Auszug)

### US-IT11-01 — Buchung end-to-end
- **Manual/Smoke (Pflicht):** Gast-Buchung → 201, Tom-Mail < 60s, Admin-Eintrag. Migration-Status `prisma migrate status` → up to date. Mail-Test mit nicht-Test-Empfänger.
- **Integration:** Smoke gegen Prod-DB nach `migrate deploy`.

### US-IT11-02 — Buchungsweg konsolidieren
- **E2E:** Hero-CTA → Modal, Header-CTA → Modal, `/buchung` direkt → Inline-Form.
- **Visual-Regression:** kein Slot-Picker mehr im Hero.
- **A11y:** Modal-Trigger `aria-haspopup="dialog"`.

### US-IT11-03 — Erfolgs-/Fehler-Feedback
- **Unit:** Token-Sign+Verify Roundtrip (alle Fehlerpfade).
- **Integration:** `GET /public-summary?token=…` mit gültigem/abgelaufenem/falschem Token.
- **E2E:** Modal-Submit → Toast → Auto-Redirect → Reload bleibt sichtbar.

### US-IT11-04 — Datei-Upload
- **Unit:** `getUploadLimitForType()` — image=10MB, video=50MB, default=10MB.
- **Integration:** 8MB JPG=200, 12MB JPG=413, 30MB MP4=200, 60MB MP4=413, 0-Byte=?, MIME-Spoof=?.
- **E2E:** Upload im Modal → Submit → Admin-Thumbnail.

### US-IT11-05 — Profildaten-Vorausfüllung
- **Integration:** `GET /api/customer/me` mit Cookie. Vor IT11-01 → 500, danach → 200.
- **E2E:** Login → Modal → Felder befüllt → Edit → Submit → Profil unverändert.

### US-IT11-06 — Auftrag stornieren
- **Unit:** Token Scope `booking-cancellation`.
- **Integration:** Mit gültigem Token+PENDING=200, zweimal=200+`alreadyCancelled`+1 Mail, REJECTED=409, < 24h+CONFIRMED=409, expired=401, falsche Sig=401, fremder Customer=404.
- **Race-Test:** `Promise.all([cancel(A), book(B same slot)])` → genau ein Erfolg.
- **E2E (Customer):** Login → /konto → Stornieren → Confirm → Toast → Status-Badge → Slot frei.
- **E2E (Gast):** Mail → Storno-Link → Page → Confirm → Erfolg.
- **A11y:** ConfirmCancelDialog Focus auf „Abbrechen", Escape/Backdrop-Block bei Submit.

---

## 4. Offene Fragen für Tom

1. **Routing-Format Bestätigungsseite (Critical-01):** UX-Variante `/buchung/bestaetigung/[id]?token=…`? — **Empfehlung: ja**.
2. **Routing-Format Storno-Page (Critical-02):** UX-Variante `/buchung/[id]/stornieren?token=…`? — **Empfehlung: ja**.
3. **`cancel-preview`-Endpoint (Critical-03):** Wiederverwendung von `public-summary`? — **Empfehlung: ja**.
4. **`cancelledBy`-Enum (Major-01):** Soll Backend zwischen `'CUSTOMER'` (eingeloggt) und `'GUEST_TOKEN'` differenzieren? — **Empfehlung: ja**.
5. **Lightbox im Admin (Major-06):** in IT11 oder Backlog IT12? — **Empfehlung: IT12 (Backlog)**.
6. Profil-Sync nach Field-Edit Toast „auch ins Profil"? — Default nein.
7. Real-Time-Update Storno im Admin — Reload ok?
8. Storno-Reason-Textarea anzeigen oder V2?
9. Telefon-Display-Format: `0157-74787512` vs. `0157 74787512`?
10. Resend-Domain-Verifikation — Status `baerenstark-hausservice.app`?

---

## Verdikt

**Needs Fixes — 4 Critical Blocker + 9 Major.** Iteration 11 ist konzeptionell solide. Die Story-AC sind eindeutig, Architecture deckt Idempotenz, Token-Lifecycle und Migrations-Sequenz sauber ab, UX-Spec/Component-Lib liefern detaillierte States, Microcopy und A11y-Constraints. **Aber: zwischen den Spec-Quellen gibt es harte Routing- und Endpoint-Konflikte, die sofort blockieren.** Empfehlung an den Orchestrator: Loop zurück an solution-architect + ux-designer, um Routing-Konflikte und Phantom-Endpoint aufzulösen. Tom-Klärung für Lightbox-Scope und `cancelledBy`-Enum. Danach US-IT11-01, US-IT11-02 und US-IT11-05 sind direkt go-ahead. US-IT11-03/04/06 nach Spec-Update — alle Major-Issues sind dann mit minimalen Doc-Edits fixbar. **Nicht zur Implementierung vor Resolution.**
