# Marketing-E-Mail-Flow (IT12-S15)

> Bezug: PROJECT.md §IT12-S15, `ux-spec-iteration-12.md` §3.15, `component-library-iteration-12.md` §6.
> Datum: 2026-05-04.
> Letztes Update: 2026-05-04 (Phase-2-Revision nach QA — DSGVO-Variante 3, Hard-Cap 50, Unsubscribe-Flow vollständig durchgezogen; Change-Log siehe §11 am Ende).
> Sprache: Deutsch (Sie-Form).
> Adressat: Frontend-Engineer, Solution Architect (Backend-Vertrag-Abstimmung), Tom Siefert.

---

## 0. DSGVO-Rahmen (Phase-2-Revision Stakeholder-Antwort A)

Bärenstark sendet Marketing-Mails ausschließlich an **Bestandskunden** unter der UWG §7 Abs. 3-Sonderregel:

> § 7 Abs. 3 UWG: Marketing-Mails dürfen an Bestandskunden gesendet werden, wenn:
> 1. Die E-Mail-Adresse beim Erstkauf erhoben wurde.
> 2. Die Mail nur „ähnliche eigene Produkte/Dienstleistungen" bewirbt.
> 3. Der Empfänger jederzeit kostenfrei und einfach widersprechen kann.
> 4. Auf das Widerspruchsrecht in jeder Mail klar hingewiesen wird.

Daraus folgen für die UX zwingend:
- **Unsubscribe-Link in jeder Mail.** Implementiert als Token-basierter Public-Endpoint (§9).
- **Pflicht-Footer** mit Hinweis auf Bestandskunden-Bezug + Widerspruchsrecht + Impressum (§4.2 Compose-Footer-Block).
- **Sender-Bestätigung** vor jedem Versand: Tom muss explizit checken, dass die Empfänger Bestandskunden sind (§4.4 Confirm-Dialog mit Pflicht-Checkbox).
- **Widersprochene Customer** werden im Recipient-Picker nicht angezeigt / nicht auswählbar (§4.1 + §5).
- **Kein Re-Subscribe** in IT12 — wer widersprochen hat, bleibt aus dem Verteiler. Re-Opt-In-Flow kommt in IT13.

---

## 1. Ziel

Tom (Admin) soll Kunden gezielt per E-Mail ansprechen können. Anwendungsfälle:
- „Allen Kunden, die Grünflächenpflege gebucht haben, ein Angebot für Frühjahrs-Schnitt schicken."
- „Kunden mit Mülltonnenservice an die nächste fällige Reinigung erinnern."
- „Allen Kunden des letzten Quartals einen Dankesnewsletter senden."

Die UX muss dabei:
- Tom **nicht** in die Versuchung führen, versehentlich allen Kunden eine Mail zu schicken (Filter-First-Pattern).
- Bei großen Mengen (> 50) explizit zur Bestätigung zwingen.
- Bei Versand-Fehlern transparent zeigen, welche Empfänger nicht erreicht wurden.
- Im bestehenden Resend-Setup (IT11) operieren — keine neuen E-Mail-Provider.

---

## 2. Verortung in der Admin-Navigation

**Sektion:** Nutzerverwaltung → Kunden (`/admin/users`)

**Begründung:**
- Marketing-Mails sind eine **Aktion auf einer gefilterten Kundenmenge**, kein eigenes Mental-Modell. Verortung als Aktion auf der Customer-Liste folgt dem natürlichen Workflow: „Liste filtern → Auswahl → Aktion".
- Alternative „Insights" / „Auswertungen" wurde verworfen, weil dort nur Lese-Daten leben.

**Sichtbare Einstiegspunkte:**

1. **Action-Bar oberhalb der Customer-Tabelle** (sichtbar, sobald Customer ausgewählt sind):
   ```
   ┌────────────────────────────────────────────────────────┐
   │  3 Kunden ausgewählt   [📧 E-Mail senden]  [✕]         │
   └────────────────────────────────────────────────────────┘
   ```
2. **Sub-Page** `/admin/users/marketing/history` — Liste vergangener Marketing-Mails (Should-Have, siehe §8).

---

## 3. End-to-End-Flow

### 3.1 Flow-Diagramm

```
[Tom navigiert zu Admin → Nutzerverwaltung → Kunden]
                  │
                  ▼
[Customer-Tabelle wird angezeigt mit Service-Filter + Multi-Select-Checkboxen]
                  │
                  ▼ Tom filtert „Service: Grünflächenpflege" 
[Tabelle zeigt 17 Kunden, die Grünflächenpflege gebucht haben]
                  │
                  ▼ Tom wählt 12 Kunden aus
[Action-Bar erscheint: „12 ausgewählt | 📧 E-Mail senden"]
                  │
                  ▼ Klick „📧 E-Mail senden"
[<MarketingEmailComposer> öffnet als Drawer (Desktop) /
 Full-Screen-Page (Mobile)]
                  │
       Step 1: Empfänger prüfen
       ┌──────────────────────────────────┐
       │ <RecipientPreviewList>           │
       │ • max@example.com (Max M.)       │
       │ • anna@example.com (Anna S.)     │
       │ … und 10 weitere                 │
       │                                  │
       │ [✏ Auswahl anpassen]  [Weiter →] │
       └──────────────────────────────────┘
                  │
                  ▼ Klick „Weiter"
       Step 2: Compose
       ┌──────────────────────────────────┐
       │ <EmailComposeForm>               │
       │  Betreff: [_________________]    │
       │  Nachricht:                      │
       │  ┌──────────────────────────┐    │
       │  │                          │    │
       │  │                          │    │
       │  └──────────────────────────┘    │
       │                                  │
       │  [📤 Test an mich senden]        │
       │                                  │
       │ [← Zurück]   [Vorschau →]        │
       └──────────────────────────────────┘
                  │
                  ▼ Klick „Vorschau"
       Step 3: Preview
       ┌──────────────────────────────────┐
       │ <EmailPreview> + Empfängerliste  │
       │  ┌─────────────────────────┐     │
       │  │ Von: Bärenstark         │     │
       │  │ An: {personalisiert}    │     │
       │  │ Betreff: …              │     │
       │  │ ──────────────────────  │     │
       │  │ Hallo Max,              │     │
       │  │                         │     │
       │  │ {Body-Text}             │     │
       │  │                         │     │
       │  │ Ihr Bärenstark-Team     │     │
       │  └─────────────────────────┘     │
       │                                  │
       │ Wird an 12 Empfänger gesendet.   │
       │                                  │
       │ [← Bearbeiten] [Senden bestätigen]│
       └──────────────────────────────────┘
                  │
                  ▼ Klick „Senden bestätigen"
       Step 4: Confirm-Dialog
       ┌──────────────────────────────────┐
       │ <BulkSendConfirmDialog>          │
       │   E-Mail an 12 Empfänger senden? │
       │   Diese Aktion kann nicht        │
       │   rückgängig gemacht werden.     │
       │                                  │
       │   [Abbrechen]  [Ja, senden]      │
       └──────────────────────────────────┘
                  │
                  ▼ Klick „Ja, senden"
       Step 5: Sending
       ┌──────────────────────────────────┐
       │ <SendingProgress>                │
       │  ●●●●●●●○○○○○                    │
       │  7 von 12 versandt…              │
       └──────────────────────────────────┘
                  │
                  ▼ alle Sends abgeschlossen
       Step 6: Report
       ┌──────────────────────────────────┐
       │ <SendReport>                     │
       │  ✓ 11 E-Mails erfolgreich        │
       │  ⚠ 1 E-Mail fehlgeschlagen:      │
       │     • peter@invalid.de — Adresse │
       │       konnte nicht zugestellt    │
       │       werden                     │
       │                                  │
       │  [Schließen] [Weitere E-Mail]    │
       └──────────────────────────────────┘
```

### 3.2 Wizard-Steps Übersicht (Phase-2-Revision: 6 Steps)

| Step | Name | Zweck | Pflicht-Aktion zum Weiter |
|------|------|-------|----------------------------|
| 1 | „Empfänger prüfen" | Letzter visueller Check der Liste; **Hard-Cap-Validation 50** | `1..50` Empfänger ausgewählt |
| 2 | „Nachricht verfassen" | Subject + Body schreiben, Test senden, **Pflicht-Footer angezeigt** | Subject **und** Body nicht leer |
| 3 | „Vorschau" | Read-only Vorschau wie Empfänger sie sieht (inkl. Pflicht-Footer) | Klick „Senden bestätigen" |
| 4 | „Bestätigen" (Modal) | Modal-Dialog vor finalem Send mit **DSGVO-Pflicht-Checkbox** | Checkbox aktiviert + Klick „Senden" |
| 5 | „Versand" | Live-Progress | Auto-Wechsel zu Step 6 |
| 6 | „Bericht" | Erfolg/Fehler-Report | Klick „Schließen" oder „Weitere E-Mail" |

---

## 4. Detail-Specs pro Step

### 4.1 Step 1: Empfänger prüfen

**Component:** `<MarketingEmailComposer>` Container + `<RecipientPreviewList>` (read-only).

**Layout:**
- Drawer-Header: Wizard-Steps-Indicator (1/6 — siehe §3.2 für aktualisierte Step-Liste mit DSGVO-Confirm-Step) + Schließen-Button.
- Body:
  - Headline: „Empfänger prüfen ({n} ausgewählt)".
  - **NEU (Phase-2-Revision Hard-Cap):** Wenn `n > 50`, prominent oben:
    > ⚠ **Maximal 50 Empfänger pro Versand.** Bitte Selektion einschränken oder in mehreren Wellen senden. [?]
    >
    > Tooltip „?": „Limit kommt von unserem aktuellen E-Mail-Anbieter (Resend Free-Tier, 100 Mails/Tag). Wird in einer kommenden Iteration erhöht."
  - `<RecipientPreviewList>` — die ersten 5 Empfänger als Liste, danach „und {n} weitere" oder „Alle anzeigen ↓" (expandiert die Liste).
  - Sekundär-Button: „✏ Auswahl anpassen" → schließt Drawer, kehrt zur Customer-Tabelle zurück (Auswahl bleibt erhalten).
- Footer: Sekundär „Abbrechen" + Primary „Weiter →".
  - „Weiter →" ist **disabled, wenn `n > 50` oder `n === 0`**.

**A11y:**
- Drawer: `role="dialog"`, `aria-labelledby="composer-title"`.
- Step-Indicator: `<ol aria-label="Versand-Schritte">`.
- „Auswahl anpassen": `aria-describedby="anpassen-hint"` mit Hint „Schließt diesen Dialog, Ihre Auswahl bleibt erhalten."
- Hard-Cap-Warnung (Phase-2-Revision): `role="alert"`, `aria-live="assertive"` beim ersten Erscheinen.

**Edge-Cases (Phase-2-Revision aktualisiert):**
- 0 Empfänger ausgewählt → Composer kann gar nicht geöffnet werden (Action-Bar-Button deaktiviert).
- 1 Empfänger ausgewählt → trotzdem Wizard durchlaufen (kein Special-Case-UI).
- 1–50 Empfänger → normale Wizard-Progression.
- > 50 Empfänger → Hard-Cap-Warnung + „Weiter"-Button disabled. Hinweis in Microcopy: „Bitte zurück zur Customer-Tabelle und Selektion einschränken." (siehe alte > 200-Variante entfällt — Hard-Cap ersetzt sie).
- Empfänger mit `unsubscribed=true` sind in der Liste **nicht enthalten** (Backend-Filter, siehe §0). Falls einer trotzdem auftaucht (Race-Condition zwischen Filter-Query und Send): Backend filtert ihn beim Send-POST auch nochmal raus, Report-Step zeigt ihn als „nicht angeschrieben (Widerspruch)".

### 4.2 Step 2: Compose

**Component:** `<EmailComposeForm>`.

**Form-Felder:**

| Feld | Typ | Validierung | Hinweis |
|------|-----|-------------|---------|
| Betreff | `<input>` text, 1-200 Zeichen | nicht leer | „Wird im Posteingang als Betreff angezeigt." |
| Nachricht | `<textarea>` 1-5000 Zeichen | nicht leer | „Plain-Text. Persönliche Anrede mit Vornamen wird automatisch hinzugefügt." |

**Plain-Text vs. Rich-Text — Designentscheidung:**

**Gewählt: Plain-Text** in IT12. Begründung:
1. Tom ist kein Newsletter-Profi → Rich-Text-Editor (Bilder, Formatierung) hat hohe Komplexität für geringen Nutzen.
2. Plain-Text-Mails fühlen sich persönlich an („wie eine echte Nachricht von Tom"), nicht wie Massen-Marketing.
3. Resend-Mail-Templates bleiben einfach.
4. Rich-Text kann in einer späteren Iteration als Should-Have ergänzt werden, wenn Tom es vermisst.

**Auto-Personalisierung:**
- Server fügt `Hallo {firstName},\n\n` automatisch vor dem Body ein.
- Server fügt `\n\nIhr Bärenstark-Team\nTom Siefert` automatisch nach dem Body ein.
- Tom muss diese Klammern nicht selber tippen. Helper-Text neben dem Body-Feld informiert: „Anrede und Signatur werden automatisch hinzugefügt — bitte nur den Hauptinhalt eingeben."

**Pflicht-Footer-Block (Phase-2-Revision DSGVO):**

Unterhalb des Body-Textareas wird ein nicht-editierbarer Block gerendert, der Tom zeigt, was am Ende der Mail automatisch angefügt wird:

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔒 Pflicht-Footer (wird automatisch angefügt)                    │
├──────────────────────────────────────────────────────────────────┤
│ Sie erhalten diese E-Mail, weil Sie bereits Kunde bei Bärenstark │
│ Hausservice waren. Sie können dem Erhalt weiterer Werbe-E-Mails  │
│ jederzeit widersprechen: [Hier abmelden] (unsubscribe-Link wird  │
│ pro Empfänger generiert). Impressum: {impressumUrl}              │
└──────────────────────────────────────────────────────────────────┘
```

- Visuell deutlich abgesetzt: graue Trennlinie + Lock-Icon + grauer Hintergrund.
- `select-none` (verhindert versehentliches Bearbeiten/Kopieren).
- Tooltip auf Hover: „Dieser Text wird durch das System ergänzt und kann nicht bearbeitet werden (DSGVO/UWG-Pflicht)."
- A11y: `role="note"`, `aria-label="Pflicht-Footer wird automatisch angefügt"`.

**Test-Send (Phase-2-Revision QA-C8):**
- Button „📤 Test an mich senden" (Sekundär).
- Versendet die zusammengesetzte Mail (mit Anrede an Tom's eigenen Vornamen, INKLUSIVE Pflicht-Footer) an Tom's Admin-Email-Adresse.
- State-Lebenszyklus: idle → test-sending (Spinner im Button) → test-sent (Häkchen + „An {tom-email} versandt", 3 s) → idle.
- Wenn Test-Send fehlschlägt: Inline-Banner „Test-Versand fehlgeschlagen — bitte E-Mail-Konfiguration prüfen oder ohne Test fortfahren."
- **TODO: align with ARCHITECTURE_IT12.md SSOT** — der Test-Send-Endpoint ist im Architecture-Doc derzeit nicht final gelistet. Wenn der Architect entscheidet, ihn nicht in IT12 zu liefern: Test-Send-Button rendert mit `disabled={true}` und Tooltip „Test-Send wird im Backend vorbereitet — kommt in einer späteren Iteration."

**A11y:**
- `<label for="subject">Betreff *</label>` mit Pflicht-Asterisk.
- `<textarea>` mit `aria-describedby="body-helper"`.
- Char-Counter live: `<span aria-live="polite">{n} / 5000 Zeichen</span>`.

### 4.3 Step 3: Vorschau

**Component:** `<EmailPreview>`.

**Layout:**
- Mock-Email-Frame: Von, An (Beispiel: erster Empfänger als Platzhalter), Betreff, Body.
- Body inkl. Auto-Anrede + Auto-Signatur (gerendert wie der Empfänger sie sieht) **+ Pflicht-Footer (Phase-2-Revision DSGVO)** mit Beispiel-Unsubscribe-Link (`/unsubscribe?token=demo` für Vorschauzwecke — der echte Token wird pro Empfänger beim finalen Send generiert).
- Hinweis-Box unten: „Diese Vorschau zeigt die E-Mail mit Daten des ersten Empfängers ({firstName}). Jeder Empfänger erhält die persönlich angepasste Version mit eigenem Abmelde-Link."
- Klein darunter: Liste aller Empfänger-E-Mails (gleicher RecipientPreviewList-Component, nur read-only).

**Design der Mock-Frame:**
- Browser-/Mail-Client-ähnlicher Rahmen mit Fake-Header (Von, An, Betreff).
- Body rendert mit `whiteSpace: 'pre-wrap'` (Zeilenumbrüche werden respektiert).
- Tokens: `bg-baerenstark-cream/40` als Vorschau-Hintergrund, `border-baerenstark-sand` als Frame-Rand.

**A11y:**
- `<article aria-label="E-Mail-Vorschau">`.
- Body hat `role="presentation"` (rein visuell).

### 4.4 Step 4: Bestätigungs-Dialog (Phase-2-Revision DSGVO)

**Component:** `<BulkSendConfirmDialog>` (shadcn AlertDialog-basiert).

**Layout:**

```
┌───────────────────────────────────────────────────────────────────┐
│  Sie werden eine Werbe-E-Mail an {n} Empfänger senden.            │
│  ───────────────────────────────────────────────────────────────  │
│                                                                   │
│  Bitte bestätigen Sie, dass diese Empfänger Bestandskunden sind   │
│  und nicht widersprochen haben.                                   │
│                                                                   │
│  Betreff: „{subject}". Diese Aktion kann nicht rückgängig gemacht │
│  werden.                                                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ☐ Ich bestätige, dass alle ausgewählten Empfänger          │  │
│  │   Bestandskunden im Sinne von § 7 UWG sind.                │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│                                  [Abbrechen]  [Senden] (disabled) │
└───────────────────────────────────────────────────────────────────┘
```

**Microcopy:**

| Slot | Text |
|------|------|
| Headline | „Sie werden eine Werbe-E-Mail an {n} Empfänger senden." |
| Body Absatz 1 | „Bitte bestätigen Sie, dass diese Empfänger Bestandskunden sind und nicht widersprochen haben." |
| Body Absatz 2 | „Betreff: „{subject}". Diese Aktion kann nicht rückgängig gemacht werden." |
| Pflicht-Checkbox-Label | „Ich bestätige, dass alle ausgewählten Empfänger Bestandskunden im Sinne von § 7 UWG sind." |
| Cancel-Button | „Abbrechen" |
| Confirm-Button | „Senden" |

**Verhalten (Phase-2-Revision):**
- Initial: Checkbox unchecked, „Senden"-Button **disabled**.
- User aktiviert Checkbox → „Senden"-Button enabled.
- Initial-Fokus auf „Abbrechen" (sicherer Default).
- Tab-Reihenfolge: Checkbox → Abbrechen → Senden.
- Escape schließt Dialog (= Abbrechen).

**Buttons:**
- Sekundär: „Abbrechen" (Initial-Fokus, sicherer Default).
- Primary (mit `feedback-warning`-Akzent): „Senden" — disabled solange Checkbox unchecked.

**A11y:**
- `role="alertdialog"`, `aria-labelledby` + `aria-describedby` automatisch via shadcn.
- Pflicht-Checkbox: `<input type="checkbox" required aria-required="true">`. Submit-Button hat `aria-disabled={!compliantConfirmed}`.
- Initial-Fokus auf „Abbrechen".
- Escape schließt Dialog (= Abbrechen).
- Screenreader-Announcement nach Checkbox-Aktivierung: „Senden-Button wurde aktiviert".

> **Hinweis:** Die alte > 50-Variante entfällt — der Hard-Cap im Step 1 verhindert, dass jemals > 50 Empfänger in diesen Dialog kommen.

### 4.5 Step 5: Versand-Progress

**Component:** `<SendingProgress>`.

**Verhalten:**
- Sobald „Ja, senden" geklickt: Progress-Bar erscheint. Backend versendet sequentiell (Resend hat kein Bulk-API).
- Backend streamed Status-Updates per Server-Sent-Events (SSE) oder Polling — Architect entscheidet. UX ist agnostisch.
- Pro Send: Counter inkrementiert.
- Estimated Time: „Verbleibend: ca. {Sekunden} Sekunden" (basierend auf bisherigem Mittelwert).

**A11y:**
- `<progress max={total} value={sent}>` (native semantics).
- Live-Region: `<div aria-live="polite">{sent} von {total} E-Mails versandt</div>` (Update alle 5 Sends, nicht jedes einzelne — sonst Screenreader-Spam).

**Cancel-Möglichkeit:**
- Sekundär-Button „⏸ Versand pausieren" (Should-Have).
- Beim Pausieren: bereits gesendete Mails sind raus (irreversibel), restliche werden nicht versandt.
- Implementierung: Architect-Sache (Backend-Cancel-Token).
- Falls in IT12 nicht implementierbar: Button weglassen, einfache Schließen-Bestätigung „Versand läuft im Hintergrund weiter — sind Sie sicher?".

### 4.6 Step 6: Versand-Report

**Component:** `<SendReport>`.

**Layout:**

```
┌──────────────────────────────────────────┐
│  Versand abgeschlossen                   │
│  ──────────────────────                  │
│                                          │
│  ✓ 11 E-Mails erfolgreich versandt       │
│  ⚠ 1 E-Mail fehlgeschlagen:              │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ peter@invalid.de — Anna P.         │  │
│  │ Grund: Adresse konnte nicht        │  │
│  │ zugestellt werden                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [📋 Liste kopieren]                     │
│                                          │
│  [Schließen]  [Weitere E-Mail senden]    │
└──────────────────────────────────────────┘
```

**State-Variants:**

| State | Headline | Icon |
|-------|----------|------|
| `success-only` | „Alle {n} E-Mails erfolgreich versandt" | ✓ grün |
| `partial-failure` | „Versand abgeschlossen — {x} fehlgeschlagen" | ⚠ orange |
| `total-failure` | „Versand fehlgeschlagen" | ⚠ rot |

**Microcopy für Fehler-Gründe:**

| Resend-Error | Sichtbare Microcopy |
|--------------|---------------------|
| Bounced (invalid address) | „Adresse konnte nicht zugestellt werden" |
| Rate-Limit | „Zu viele Anfragen — bitte später erneut versuchen" |
| Other 4xx/5xx | „Versand fehlgeschlagen — bitte E-Mail-Adresse prüfen" |

**Aktionen:**
- „📋 Liste kopieren": Kopiert die fehlgeschlagenen E-Mail-Adressen in die Zwischenablage (für manuelle Nachbearbeitung).
- „Schließen": Schließt Drawer, kehrt zur Customer-Liste zurück. Auswahl wird zurückgesetzt.
- „Weitere E-Mail senden": Setzt Wizard zurück auf Step 1 mit derselben Empfängerliste, leeren Subject/Body.

**A11y:**
- `success-only`: `role="status"`, `aria-live="polite"`.
- `partial-failure`/`total-failure`: `role="alert"`, `aria-live="assertive"`.
- Failed-Liste: `<ul role="list">`, jede Zeile fokussierbar mit Detail-Tooltip.

---

## 5. Edge-Cases und Validierungen

| Szenario | UX-Verhalten |
|----------|--------------|
| Tom hat 0 Customer in der Datenbank | Kunden-Tabelle zeigt Empty-State; Action-Bar erscheint nicht; Marketing-Mailer ist nicht erreichbar (kein toter Pfad). |
| Tom wählt > 50 Customer aus (Phase-2-Revision Hard-Cap) | Im Step 1 erscheint persistente Warnung „⚠ Maximal 50 Empfänger pro Versand. Bitte Selektion einschränken oder in mehreren Wellen senden." mit Hilfe-Tooltip. „Weiter →"-Button disabled. Tom muss zur Customer-Tabelle zurück und Selektion reduzieren. (Die alte > 200/> 500-Variante entfällt.) |
| Tom versucht widersprochenen Customer auszuwählen | Checkbox in der Customer-Tabelle ist permanent disabled mit Tooltip „Dieser Kunde hat widersprochen — kann nicht angeschrieben werden." (siehe §0). Standardmäßig sind diese Customer aber gar nicht in der Liste — Backend-Filter `unsubscribed=false`. |
| Tom verlässt den Wizard mitten im Compose-Step (Schließt Drawer) | Confirm: „Eingaben verwerfen?" mit Sekundär „Verwerfen" und Primary „Weiter bearbeiten". Bei „Verwerfen" gehen Subject/Body verloren. |
| Tom verlässt den Browser-Tab mitten im Versand (Step 5) | Backend versendet weiter (irreversibel). Beim Wiederkommen: Falls Versand noch läuft → Progress sichtbar. Falls fertig → Report. |
| Tom aktiviert die DSGVO-Pflicht-Checkbox nicht im Confirm-Dialog | „Senden"-Button bleibt disabled. Tom kann nur „Abbrechen" oder Checkbox aktivieren. Kein versehentlicher Versand möglich. |
| Test-Send schlägt fehl | Inline-Banner im Compose-Form, Versand kann trotzdem fortgesetzt werden (Test ist optional). |
| Test-Send-Endpoint nicht verfügbar (Architect-Entscheidung) | Test-Send-Button rendert disabled mit Tooltip „Test-Send wird im Backend vorbereitet". Wizard funktioniert ohne Test (Step 2 → 3 → 4 → 5 → 6 unverändert). |
| Resend-API ist offline | Step 4 Confirm-Klick → Step 5 zeigt sofort Error-Banner: „E-Mail-Service nicht erreichbar. Bitte später erneut versuchen." Kein partieller Versand. |
| Subject oder Body leer beim „Weiter →"-Klick | Inline-Field-Errors, Button bleibt disabled. |
| Customer ohne Email-Adresse in der Auswahl | Frontend filtert sie schon im Multi-Select aus (Server sollte aber zusätzlich validieren). Falls trotzdem im Wizard: Vor Send aussortieren mit Hinweis-Banner: „1 Empfänger ohne E-Mail-Adresse wird übersprungen." |
| Customer hat sich aus der Datenbank gelöscht zwischen Auswahl und Send | Backend ignoriert nicht-mehr-existente IDs, Report-Step zeigt sie als „nicht verfügbar — Empfänger nicht mehr im System". |
| Customer hat sich nach Auswahl aber vor Send abgemeldet (Race-Condition) | Backend filtert ihn beim Send-POST raus, Report-Step zeigt ihn als „nicht angeschrieben (Widerspruch)". Tom sieht in der Bilanz `actualRecipients < intendedRecipients`. |

---

## 6. Microcopy-Bibliothek

| Slot | Microcopy |
|------|-----------|
| Action-Bar Button (Customer-Tabelle) | „📧 E-Mail senden" |
| Step-1 Headline | „Empfänger prüfen ({n} ausgewählt)" |
| Step-1 Anpassen-Button | „✏ Auswahl anpassen" |
| Step-1 Hard-Cap-Warnung (Phase-2-Revision) | „⚠ Maximal 50 Empfänger pro Versand. Bitte Selektion einschränken oder in mehreren Wellen senden." |
| Step-1 Hard-Cap-Tooltip (Phase-2-Revision) | „Limit kommt von unserem aktuellen E-Mail-Anbieter. Wird in einer kommenden Iteration erhöht." |
| Step-2 Subject-Label | „Betreff *" |
| Step-2 Body-Label | „Nachricht *" |
| Step-2 Body-Helper | „Plain-Text. Anrede und Signatur werden automatisch hinzugefügt." |
| Step-2 Pflicht-Footer-Label (Phase-2-Revision) | „🔒 Pflicht-Footer (wird automatisch angefügt)" |
| Step-2 Pflicht-Footer-Tooltip (Phase-2-Revision) | „Dieser Text wird durch das System ergänzt und kann nicht bearbeitet werden (DSGVO/UWG-Pflicht)." |
| Step-2 Pflicht-Footer-Inhalt (Phase-2-Revision) | „Sie erhalten diese E-Mail, weil Sie bereits Kunde bei Bärenstark Hausservice waren. Sie können dem Erhalt weiterer Werbe-E-Mails jederzeit widersprechen: [Hier abmelden]({unsubscribeUrl}). Impressum: {impressumUrl}." |
| Step-2 Test-Button | „📤 Test an mich senden" |
| Step-2 Test-Disabled-Tooltip | „Test-Send wird im Backend vorbereitet — kommt in einer späteren Iteration." |
| Step-2 Char-Counter | „{n} / 5000 Zeichen" |
| Step-3 Vorschau-Hint | „Diese Vorschau zeigt die E-Mail mit Daten des ersten Empfängers. Jeder Empfänger erhält die persönlich angepasste Version mit eigenem Abmelde-Link." |
| Step-4 Confirm-Headline (Phase-2-Revision) | „Sie werden eine Werbe-E-Mail an {n} Empfänger senden." |
| Step-4 Confirm-Body-Absatz-1 (Phase-2-Revision) | „Bitte bestätigen Sie, dass diese Empfänger Bestandskunden sind und nicht widersprochen haben." |
| Step-4 Confirm-Checkbox-Label (Phase-2-Revision) | „Ich bestätige, dass alle ausgewählten Empfänger Bestandskunden im Sinne von § 7 UWG sind." |
| Step-4 Confirm-Cancel | „Abbrechen" |
| Step-4 Confirm-Send | „Senden" |
| Step-5 Progress-Label | „{sent} von {total} E-Mails versandt…" |
| Step-6 Success-Headline | „Alle {n} E-Mails erfolgreich versandt" |
| Step-6 Partial-Headline | „Versand abgeschlossen — {x} fehlgeschlagen" |
| Step-6 Total-Failure | „Versand fehlgeschlagen" |
| Step-6 Schließen | „Schließen" |
| Step-6 Weitere | „Weitere E-Mail senden" |
| Versand-Service-Offline-Error | „E-Mail-Service nicht erreichbar. Bitte später erneut versuchen." |
| Recipient-Picker Toggle „Auch Widerspruchskunden" (disabled) | „Auch Widerspruchskunden anzeigen (in einer späteren Version verfügbar)" |
| Unsubscribed-Customer-Tooltip | „Dieser Kunde hat widersprochen — kann nicht angeschrieben werden." |
| Unsubscribe-Page Success-Headline | „Sie wurden erfolgreich abgemeldet." |
| Unsubscribe-Page Error-Headline | „Link ungültig oder abgelaufen." |

---

## 7. Backend-Vertrag (Phase-2-Revision: aligned mit Architect-SSOT §R.4)

> **Phase-2-Revision (QA-C6):** Endpoints folgen jetzt der SSOT in `ARCHITECTURE_IT12.md` **§R.4 (Phase-2-Revision)**. Diese Tabelle stellt die UX-relevanten Endpoints als Frontend-Bauanleitung dar.

| Endpoint | Method | Auth | Body | Response | Verwendet von |
|----------|--------|------|------|----------|----------------|
| `/api/admin/marketing/recipients?service=&hasBooked=&unsubscribed=&search=&page=&limit=` | GET | adminSession | — | `{ data: MarketingRecipient[], total, page, limit }` | `RecipientPicker` |
| `/api/admin/marketing/emails` | POST | adminSession | `{ subject, body, recipientIds[], filterServices[], status: 'draft' \| 'send' }` | 201 `{ id, status }` | `MarketingEmailComposer` (Step 4 → erstellt Draft mit `status:'draft'` ODER direkt Send mit `status:'send'`) |
| `/api/admin/marketing/emails/{id}/test-send` | POST | adminSession | — (sendet an `session.user.email`) | 200 `{ ok: true, sentTo }`. 502 `RESEND_ERROR` falls Resend nicht erreichbar. | `EmailComposeForm` Test-Button |
| `/api/admin/marketing/emails/{id}/send` | POST | adminSession | — (Bulk-Send-Trigger) | 200 `{ id, intendedRecipients, actualRecipients, successCount, failureCount, status: 'completed' \| 'partial_failure' \| 'failed' }`. **413 RECIPIENT_CAP_EXCEEDED** falls > 50. | `BulkSendConfirmDialog` Confirm |
| `/api/admin/marketing/emails?limit=&page=` | GET | adminSession | — | `{ data: MarketingEmail[], total, page, limit }` | `MarketingHistoryList` |
| `/api/admin/marketing/emails/{id}` | GET | adminSession | — | `MarketingEmailDetail` (inkl. `failedRecipients`) | `SendingProgress` (falls Polling nötig), `SendReport` |
| `/api/customer/unsubscribe?token=…` | GET | Public (HMAC-Token) | — | 302 → `/marketing/abgemeldet?ok=1` (oder `?error=invalid` bei 404) | E-Mail-Footer-Link, ergibt Result-Page |

**Hinweis zu Query-Parameter-Naming (Phase-2-Revision):**
- Recipients-Filter heißt **`service`** (Single-Select Slug) plus weitere Filter-Params (`hasBooked`, `unsubscribed`, `search`, `page`, `limit`).
- Slugs entsprechen exakt dem `SERVICES`-Array aus `src/lib/services.ts` (siehe ux-spec §3.2.2 / ARCHITECTURE_IT12.md §R.2).

**Hinweis zum 2-Stage-Send-Flow:**
- Step 1 (Composer „Vorschau" → Confirm): `POST /api/admin/marketing/emails` mit `status: 'draft'` → speichert die Mail als Draft, gibt `{ id }` zurück.
- Step 2 (User klickt „Senden" im Confirm-Dialog mit aktivierter DSGVO-Checkbox): `POST /api/admin/marketing/emails/{id}/send` → triggert Bulk-Send. Antwortet synchron mit Endstatus (Hard-Cap 50 + Vercel Hobby 10s sichern, dass das innerhalb des Function-Timeouts liegt — ARCHITECTURE_IT12.md §R.6).
- Test-Send (optional): `POST /api/admin/marketing/emails/{id}/test-send` setzt voraus, dass `id` ein Draft ist.

**Quota-Anzeige (Phase-2-Revision §R.6):** Frontend zeigt im Composer ein Tageskontingent „Heute: X von 100 Mails versendet" (Wert kommt aus `MarketingEmail`-Aggregation des aktuellen Tages, ggf. via einem zusätzlichen Endpoint — Architect klärt finale Quelle).

---

## 8. Marketing-Historie (Should-Have)

**Route:** `/admin/users/marketing/history`

**Layout:** Liste vergangener Mails als Tabelle:

| Datum | Betreff | Empfänger | Erfolg | Aktionen |
|-------|---------|-----------|--------|----------|
| 12.05.2026 14:32 | „Frühjahrs-Aktion Grünfläche" | 12 | 11/12 | Detail anzeigen |

**Detail-Modal:** Zeigt Subject, Body, Empfängerliste mit Per-Recipient-Status.

**Falls Architect die Persistenz nicht in IT12 liefert:**
- History-Page rendert Empty-State: „Versand-Historie ist in einer späteren Version verfügbar."
- Sidebar-Item „Marketing-Historie" wird trotzdem angelegt, aber als „Coming Soon"-Placeholder (mit klarer Microcopy).

---

## 9. Unsubscribe-Flow (Phase-2-Revision DSGVO)

### 9.1 Empfänger-Sicht

```
[Empfänger erhält Marketing-Mail]
                  │
                  ▼
[Mail-Footer enthält: „Sie können dem Erhalt weiterer
 Werbe-E-Mails jederzeit widersprechen: [Hier abmelden]"]
                  │
                  ▼ Klick auf Abmelden-Link
[Browser öffnet GET https://baerenstark-…/api/marketing/unsubscribe?token=abc…]
                  │
                  ▼ Backend prüft Token (sha256 vs. unsubscribeTokenHash)
   ┌──────────────┴──────────────┐
   ▼                             ▼
[Token valide]              [Token ungültig
   │                         oder abgelaufen]
   ▼                             ▼
[CustomerMarketingPreference.   [Page rendert
 unsubscribed = true gesetzt]   Error-State:
   │                            „Link ungültig
   ▼                             oder abgelaufen."]
[Page rendert Success-State:
 „Sie wurden erfolgreich
  abgemeldet."]
```

### 9.2 Page-Spec (siehe component-library §6.9 + ux-spec §3.15.2)

- **Route:** `/marketing/abgemeldet` (Result-Page nach `GET /api/marketing/unsubscribe?token=…`).
- **Public:** kein Auth.
- **Variants:** `success`, `error-invalid`, `error-server`.
- **Kein Re-Subscribe-Button** in IT12. Ein Empfänger, der versehentlich abbestellt hat, muss manuell auf eine Bärenstark-Mail antworten — Tom trägt ihn dann manuell wieder ein. Re-Opt-In-Self-Service kommt in IT13.

### 9.3 Token-Lebenszyklus

- Token wird **beim ersten Senden** für jeden Customer generiert (siehe ARCHITECTURE_IT12.md §14.4).
- Klartext-Token lebt nur in der gesendeten Mail; in der DB ist nur der `sha256(token)` als `unsubscribeTokenHash` persistiert.
- Token ist Customer-spezifisch — jeder Customer hat seinen eigenen permanenten Unsubscribe-Token (nicht pro Kampagne).
- Falls Customer den Link in einer alten Mail klickt: funktioniert weiterhin (Token rotiert nicht), Backend setzt `unsubscribed=true`.

---

## 10. Acceptance-Checkliste IT12-S15 (Phase-2-Revision)

- ✓ Tom kann die Customer-Liste nach Service filtern (Multi-Select).
- ✓ Tom kann mehrere Customer per Checkbox auswählen.
- ✓ **Hard-Cap 50 Empfänger** ist enforced — > 50 zeigt Warnung + disabled „Weiter →".
- ✓ Customer mit `unsubscribed=true` werden vom Backend ausgeschlossen und sind im Picker nicht auswählbar.
- ✓ Bei Klick „E-Mail senden" öffnet ein Wizard mit 6 klaren Steps.
- ✓ Test-Send-Funktion ist verfügbar (oder mit Tooltip disabled, falls Architect den Endpoint nicht ausliefert).
- ✓ **Pflicht-Footer wird in Compose-Step als nicht-editierbarer Block sichtbar** und in der Vorschau gerendert.
- ✓ Vorschau zeigt die E-Mail wie der Empfänger sie sieht (inkl. Auto-Anrede + Pflicht-Footer mit Beispiel-Unsubscribe-Link).
- ✓ **DSGVO-Confirm-Dialog mit Pflicht-Checkbox** vor jedem Versand. „Senden"-Button disabled solange Checkbox uncheck.
- ✓ Während Versand wird Live-Progress angezeigt.
- ✓ Report zeigt Erfolg/Fehler getrennt mit Fehler-Gründen in deutscher Sprache.
- ✓ Fehlgeschlagene Adressen können kopiert werden.
- ✓ **Unsubscribe-Page** `/marketing/abgemeldet` ist public erreichbar und zeigt Success/Error-States.
- ✓ Wizard ist auf Mobile (≥ 360 px) bedienbar (Full-Screen-Layout).
- ✓ Alle interaktiven Elemente haben ARIA-Labels und Keyboard-Support.
- ✓ Kein technischer Fehler-String („INTERNAL_ERROR", Stack-Traces) sichtbar.
- ✓ Mindestens ein Should-Have erfüllt: Marketing-Historie, Pause-Funktion, oder Rich-Text-Editor (Architect entscheidet).

---

## 10.1 Offene Fragen an Architect / Stakeholder

1. **Rate-Limiting Resend:** Resend Free-Tier (100 Mails/Tag) ist gesetzt (Stakeholder-Antwort C). Hard-Cap 50 pro Send-Operation in IT12 (Architect bestätigt endgültig).
2. **Streaming vs. Polling:** SSE oder einfaches Polling für Progress-Updates? UX ist agnostisch; Architect entscheidet.
3. **Marketing-Historie persistieren:** Soll IT12 bereits eine `MarketingCampaign`-Tabelle anlegen und Versendungen archivieren? Falls ja: Sidebar-Item „Marketing-Historie" rendert echte Daten. Falls nein: „Coming Soon"-Placeholder.
4. **Pause-Funktion:** Implementierbar in IT12 oder Backlog? UX bevorzugt Pause; Architect entscheidet basierend auf Backend-Komplexität.
5. **Test-Send-Endpoint:** TODO: align with ARCHITECTURE_IT12.md SSOT — Architect entscheidet, ob `POST /api/admin/marketing/email/test` o. ä. in IT12 ausgeliefert wird oder ob das Feature gedroppt wird. Frontend hält den Button mit `testSendAvailable`-Prop.
6. **Test-Send-Empfänger** (falls verfügbar): Geht der Test an Tom's Admin-E-Mail (aus Session) oder an eine konfigurierbare Adresse? Empfehlung: Admin-E-Mail aus Session ist der einfachste Default.

---

## 11. Phase-2-Revision (Post-QA) — Change-Log

> **Datum:** 2026-05-04. **Anlass:** `QA_DESIGN_REVIEW_IT12.md` (C6/C7/C8/Mn7/Mn9).

| # | QA-Issue / Stakeholder-Antwort | Sektion | Änderung |
|---|--------------------------------|---------|----------|
| 1 | C6 (Endpoint-Mismatch) | §7 Backend-Vertrag | Endpoints aus Architect-SSOT **§R.4 (Phase-2-Revision)** synchronisiert: `GET /api/admin/marketing/recipients`, `POST /api/admin/marketing/emails` (2-stage: draft → send), `POST .../{id}/test-send`, `POST .../{id}/send`, `GET .../{id}`, `GET .../`, `GET /api/customer/unsubscribe`. Filter-Param heißt `service` (Single-Select). |
| 2 | C7 / Stakeholder-A (DSGVO) | §0, §4.2, §4.4 | DSGVO-Variante 3 (UWG §7 Abs. 3 Bestandskunden-Sonderregel) als Rahmen dokumentiert. Pflicht-Footer in Compose-Step (nicht-editierbar). DSGVO-Confirm-Checkbox im Confirm-Dialog. |
| 3 | C8 (Test-Send finalisiert) | §4.2, §7, §R.7 | Test-Send-Endpoint **finalisiert** in Architect-SSOT: `POST /api/admin/marketing/emails/{id}/test-send`. Setzt `status === 'draft'` voraus. UX-Test-Send-Button zeigt aktiviert. |
| 4 | Stakeholder-C (Hard-Cap 50) | §4.1 + §6 + §10 | Hard-Cap 50 Empfänger pro Send-Operation. Persistente Warnung im Step 1. Disabled „Weiter"-Button. Hilfe-Tooltip erklärt das Limit. Backend-Error-Code: `413 RECIPIENT_CAP_EXCEEDED`. |
| 5 | Mn7 (Char-Counter-Konsistenz) | §4.2 + §6 | Char-Counter bleibt bei 5000 (UX + cl-it12 sind aligned, Backend muss auf 5000 angepasst werden). |
| 6 | Mn9 (Unsubscribe-Footer-Microcopy) | §6 (Microcopy-Bibliothek) | Pflicht-Footer-Inhalt + Tooltips als verbindliche Microcopy-Slots aufgenommen. Backend-SSOT-Footer (§R.5) verwendet leicht andere Wortwahl; UX-Spec ist mit dem Architect-Wortlaut aligned. |
| 7 | NEU (DSGVO) | §3.2 | Wizard erweitert von 4 auf 6 Steps (eigener Confirm-Step explizit). |
| 8 | NEU (DSGVO) | §9 (NEUE Sektion) | Vollständiger Unsubscribe-Flow inkl. Token-Lebenszyklus (HMAC-deterministisch, stateless, §R.5) + Empfänger-Sicht-Diagramm + Page-Spec-Verweis auf component-library §6.9. Result-Page-Pfad: `/marketing/abgemeldet?ok=1` bzw. `?error=invalid`. |
| 9 | NEU (DSGVO) | §0 + §4.1 + §5 (Edge-Cases) | `unsubscribedAt != null`-Customer werden vom Backend gefiltert (Architect-SSOT §R.5: Spalte `CustomerUser.unsubscribedAt` direkt, kein eigenes Preference-Modell mehr). UX-Toggle „Auch Widerspruchskunden anzeigen" ist disabled in IT12 (Re-Opt-In kommt IT13). Race-Condition-Handling: Backend filtert beim Send-POST nochmal. |

### Offene Abhängigkeiten zum Architect

- ~~Test-Send-Endpoint final festlegen~~ ✓ Erledigt (Architect-SSOT §R.7).
- ~~Endpoint-Pfade SSOT~~ ✓ Erledigt (Architect-SSOT §R.4).
- ~~DSGVO-Datenmodell~~ ✓ Erledigt (Architect-SSOT §R.5: 2 Spalten direkt auf `CustomerUser`, kein `CustomerMarketingPreference`).
- Marketing-Historie-Endpoint (Should-Have): Architect liefert `GET /api/admin/marketing/emails` (§R.4 Endpoint #9). UX-Page `MarketingHistoryList` rendert echte Daten.
- Pause-Funktion (Should-Have): in IT12 **gedroppt** (Architect §R.6: synchroner Send mit Hard-Cap 50, kein Polling, kein Pause).
- Body-Char-Limit: UX/cl-it12 = 5000. Backend-Reqs werden vom Architect synchronisiert (siehe §R.11 — backend-requirements aktualisiert).
- Quota-Anzeige (Heute X/100 Mails): Architect klärt finale API-Quelle.

---

*Ende des Marketing-E-Mail-Flows (Phase-2-Revision).*
