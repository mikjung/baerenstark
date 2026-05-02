# BUG US-04 — Root-Cause-Analyse & Fix-Anweisungen

**Status:** Blocker — muss vor allen anderen Iteration-2-Stories behoben sein.
**Beschreibung:** Eingegangene Buchungsanfragen erscheinen nicht im Admin-Portal.
**Datum:** 2026-05-02
**Autor:** Solution Architect

---

## TL;DR

Es liegen **zwei kooperierende Root Causes** vor. Beide müssen behoben werden:

1. **Primärursache (Mail-Versand bricht den Request-Path)**: Der Resend-API-Key
   in der laufenden Umgebung ist der Placeholder `re_xxxxxxxxxxxx` aus der
   `.env.example`. Die Resend-SDK akzeptiert den String beim Konstruktor (kein
   Format-Check), wirft aber beim ersten `emails.send()` eine Exception oder
   Antwort, deren Form nicht zuverlässig durch `result.error` abgefangen wird.
   In Kombination mit dem `await prisma.booking.update({ ... mailError })`
   nach dem Versand entsteht in einigen Edge-Cases (insbesondere wenn die
   Resend-API mit 401 + leerem Body antwortet) eine ungefangene Exception,
   die den gesamten Handler in den `internalError`-Zweig schickt — der Client
   bekommt 500, der Frontend-Toast meldet „unbekannter Fehler", und das
   bereits in der DB persistierte Booking erscheint zwar im Admin-Portal,
   aber der Kunde sieht „Fehler", versucht es nochmal, und Tom hat den
   Eindruck „nichts kommt an", weil er die Mails erwartet (US-08).
2. **Sekundärursache (Wahrnehmung)**: Tom prüft als Erstes seinen Posteingang.
   Da der Resend-API-Key Placeholder ist, kommt nie eine E-Mail an. Die
   Anfragen sind im Admin-Portal sichtbar (Seite `/admin/bookings`), aber Tom
   öffnet die Seite gar nicht, weil er „keine Anfrage" erwartet. Aus seiner
   Sicht: „Anfragen erscheinen nicht im Admin-Portal."

Beide Fixes sind klein und sauber lokal kapselbar.

---

## Beweismaterial

### 1. `.env.local` enthält Placeholder-Values

```
RESEND_API_KEY="re_xxxxxxxxxxxx"
MAIL_FROM="onboarding@resend.dev"
MAIL_TO_ADMIN="hausservice-baerenstark@outlook.com"
```

`getResend()` in `src/lib/mail.ts` prüft nur `if (!key) return null;` — der
Placeholder ist truthy, also wird ein echtes Resend-SDK-Objekt erzeugt. Beim
`emails.send()` antwortet die API mit 401 / `Invalid API Key`. In bestimmten
SDK-Versionen wird das als Exception geworfen, in anderen als
`{ data: null, error: { ... } }` zurückgegeben. **Beide Fälle sind durch die
aktuelle `sendOnce`-Implementierung _technisch_ abgedeckt — aber der
Defensive-Check ist nicht eng genug**, weil:

- Resend SDK kann je nach Version eine Antwort liefern, in der `result.error`
  zwar gesetzt ist, aber `result.error.message` `undefined` ist und
  `String(undefined)` literal `"undefined"` ergibt — wenig hilfreich, aber
  noch kein Fehler.
- Wenn der **`from`-Wert** (`onboarding@resend.dev` mit unverifizierter
  Empfänger-Domain) nicht zur Resend-Free-Tier-Policy passt, antwortet Resend
  mit 403 und einer Fehler-Payload, die in alten SDK-Versionen als JSON-Parse-
  Error im Resend-internen Code aufschlägt. Diese Exception _kann_ am
  `try/catch`-Schutz in `sendOnce` vorbeigehen, wenn sie z.B. asynchron
  in einem Promise-Microtask geworfen wird, das gar nicht awaitet wird.

### 2. POST /api/bookings: zu eng angekoppelter Mail-Pfad

```ts
// src/app/api/bookings/route.ts (aktueller Code)
const mailResult = await sendBookingNotification({ ... });

await prisma.booking.update({
  where: { id: booking.id },
  data: {
    mailSent: mailResult.ok,
    mailError: mailResult.ok ? null : mailResult.error.slice(0, 500),
  },
});

try { revalidateTag('slots'); } catch { /* ignore */ }

return apiSuccess({ ... }, 201);
```

**Problem:** Wenn `sendBookingNotification` aus irgendeinem Grund eine
Exception wirft (statt sauber `{ ok: false, error: ... }` zurückzugeben), fällt
der Handler durch in `catch (err)` → `internalError(err)` → **HTTP 500**, **OBWOHL
das Booking erfolgreich in der DB persistiert wurde**. Der Kunde sieht eine
generische Fehlermeldung („unbekannter Fehler"), versucht es nochmal, und es
entsteht u.U. das Symptom „nichts wird gespeichert" — _obwohl_ die DB längst
Datensätze enthält.

**Zusätzliches Problem:** Wenn der Mail-Versand sehr lange braucht (Vercel
Hobby Plan: 10 s Function-Limit, lokal: kein Limit, aber immerhin die
3 Retry-Delays summieren sich auf bis zu 1.8 s + 3 × Resend-Roundtrip = leicht
> 4 s im Fehlerfall), reißt unter Last der ganze Booking-Path mit.

### 3. Frontend customerEmail-Reset

Der Hidden-Field `slotId` wird zwar überschrieben (`payload.slotId =
selectedSlot.id`), aber `customerEmail` wird leer (`''`) gesendet. Zod's
`customerEmail`-Chain lehnt `''` über `.email()` ab und fängt es im
`.or(z.literal(''))`-Branch wieder auf. Das funktioniert in Zod 3.22+,
**aber** sobald der `customerEmail`-Wert mit Whitespace befüllt ist (z.B.
durch Browser-Autofill), durchläuft `.trim()` zuerst — und der Fallback
matcht den getrimmten String nicht (`.literal('')` ist exakt). Das produziert
einen 400-Fehler aus dem Backend mit `field: customerEmail` — der Kunde sieht
„E-Mail ungültig", obwohl er nichts eingegeben hat.

---

## Fixes

Reihenfolge der Implementierung: **Fix 1 zuerst** (Backend-robust gegen
Mail-Fehler), **Fix 2 als Härtung** (Schema), **Fix 3 als Aufräumarbeit**
(Doku/.env).

### Fix 1 — Mail-Versand vom Booking-Erfolg entkoppeln (Backend)

`POST /api/bookings`:

1. Persist Booking (wie bisher) — bei P2002 → 409 CONFLICT.
2. **Sofort 201 OK an den Kunden zurückgeben** — bevor die Mail überhaupt versucht wird.
3. Mail-Versand und `mailSent`/`mailError`-Update in einem **`waitUntil()`-
   Hook** (Next.js 14: `import { after } from 'next/server'` oder
   `event.waitUntil()` in Edge — hier Node-Runtime, also einfach via
   "fire-and-forget Promise mit garantiertem Catch") ausführen.

**Konkret (Pseudocode für Engineer):**

```ts
// src/app/api/bookings/route.ts (POST)
const booking = await prisma.booking.create({ ... });

// Mail asynchron, niemals den Booking-Erfolg blockieren oder kippen.
void runMailDispatch(booking.id, { ...payload }).catch((err) => {
  console.error('[mail-dispatch] unexpected error', err);
});

try { revalidateTag('slots'); } catch { /* ignore */ }

return apiSuccess({
  id: booking.id,
  status: booking.status,
  createdAt: booking.createdAt.toISOString(),
}, 201);
```

Wo `runMailDispatch` so aussieht:

```ts
// src/lib/mail.ts
export async function runMailDispatch(
  bookingId: string,
  payload: BookingMailPayload,
): Promise<void> {
  const result = await sendBookingNotification(payload).catch((err) => ({
    ok: false as const,
    error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
  }));

  await prisma.booking
    .update({
      where: { id: bookingId },
      data: {
        mailSent: result.ok,
        mailError: result.ok ? null : result.error.slice(0, 500),
      },
    })
    .catch((err) => {
      console.error('[mail-dispatch] db-update failed', err);
    });
}
```

**Ergebnis:**
- Selbst wenn Resend hart crasht, sieht der Kunde 201 + Erfolgs-Toast.
- Die Buchung ist garantiert in der DB.
- Tom sieht im Admin-Portal jeden Datensatz, ggf. mit `mailSent: false` +
  rotem Badge → er kann via „Mail erneut senden" reagieren.

> **Hinweis Vercel-Free-Tier**: Auf Vercel Functions endet die Function-
> Execution mit dem Response-Return; ein simples `void promise` kann abgebrochen
> werden. **Korrekte Lösung auf Vercel:** `unstable_after` aus `next/server`
> (Next 14.2+) oder eine Outbox-Tabelle (Backlog). Für **Local/Dev** und
> für die ersten Live-Buchungen reicht `void promise` — die Function läuft
> noch ein paar hundert Millisekunden weiter, was die Resend-Roundtrip in der
> Regel erlaubt. Engineers sollen `unstable_after` ausprobieren und, falls
> verfügbar, vorziehen.

### Fix 2 — `customerEmail`-Schema gegen getrimmte Whitespace härten

`contracts/zod-schemas.ts` → `CreateBookingSchema.customerEmail`:

**Aktueller Code:**

```ts
customerEmail: z
  .string()
  .trim()
  .email('Bitte eine gültige E-Mail-Adresse angeben')
  .max(254)
  .optional()
  .or(z.literal('').transform(() => undefined)),
```

**Neu:**

```ts
customerEmail: z
  .preprocess(
    (v) => {
      if (typeof v !== 'string') return v;
      const trimmed = v.trim();
      return trimmed === '' ? undefined : trimmed;
    },
    z
      .string()
      .email('Bitte eine gültige E-Mail-Adresse angeben')
      .max(254)
      .optional(),
  ),
```

**Begründung:** `preprocess` entfernt vor der Validierung Whitespace und
mappt einen leeren Trim-String auf `undefined`. Damit funktioniert Pflicht/
Optional konsistent — sowohl für `''`, `'   '`, als auch für `'foo@bar.de  '`.

**Vorbereitung für US-13/US-14:** In Iteration 2 wird `customerEmail` zum
Pflichtfeld (siehe Architektur-Update). Dieser Schema-Fix bleibt aber
relevant, weil dann auch `'   '` als „leer" erkannt werden muss (anstatt
einen Phantom-Validierungsfehler zu produzieren).

### Fix 3 — Operational: `.env.local`-Konfiguration klarstellen

`.env.example` und Setup-Doku in `README.md` müssen klarstellen:

```
# Pflicht. Echten Wert in Resend.com → API Keys generieren.
# Mit Placeholder schlägt der Mail-Versand stillschweigend fehl,
# Buchungen werden trotzdem persistiert (siehe Admin-Dashboard, mailSent: false).
RESEND_API_KEY=

# Free-Tier-Hinweis: ohne DNS-verifizierte Domain darf Resend NUR an die
# Resend-Account-E-Mail senden. Für lokale Tests:
#   MAIL_FROM=onboarding@resend.dev
#   MAIL_TO_ADMIN=<deine resend-account-mail>
MAIL_FROM=
MAIL_TO_ADMIN=
```

Zusätzlich: **Wenn `RESEND_API_KEY` weder gesetzt ist NOCH
`re_xxxxxxxxxxxx` enthält**, soll `getResend()` `null` zurückgeben **und
das Logging klarmachen**, dass Mails komplett übersprungen werden:

```ts
// src/lib/mail.ts
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === 're_xxxxxxxxxxxx' || key.startsWith('re_xxxxx')) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[mail] RESEND_API_KEY not configured — mail dispatch skipped.',
      );
    }
    return null;
  }
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}
```

Ergebnis:
- Lokale Dev-Setups ohne echten Key bekommen sauber `{ ok: false, error: 'RESEND_API_KEY is not configured' }`.
- Booking ist trotzdem im Admin-Portal sichtbar.
- Im Admin-Dashboard zeigt das `mailSent: false`-Badge eindeutig, dass die Mail nicht raus ist.

---

## Test-Plan

Verifizierung **nach** Fix 1 + 2 + 3:

1. **Happy Path**: Mit echtem Resend-Key:
   - Booking absenden → 201, Toast „Anfrage gesendet".
   - DB hat Booking mit `mailSent: true`.
   - Admin-Portal listet die Anfrage.
   - Tom-Mail kommt an.
2. **Resend-down (Placeholder-Key)**:
   - Booking absenden → 201, Toast „Anfrage gesendet".
   - DB hat Booking mit `mailSent: false`, `mailError = "RESEND_API_KEY is not configured"`.
   - Admin-Portal listet die Anfrage **mit rotem Mail-Badge**.
3. **Resend-temporary-failure** (z.B. 503 simulieren):
   - 3 Retries werden durchgeführt.
   - Booking trotzdem 201, `mailSent: false`, `mailError` truncated.
   - Tom kann „Mail erneut senden" klicken → bei nächstem Erfolg `mailSent: true`.
4. **Email mit Whitespace** (z.B. Browser-Autofill `"  test@example.com  "`):
   - Schema preprocesst → `"test@example.com"`.
   - 201, kein Validierungsfehler.
5. **Leere Email**: `customerEmail: ""` oder `customerEmail: "   "`:
   - Schema preprocesst → `undefined`.
   - 201, kein Validierungsfehler.
6. **Invalid Email**: `"not-an-email"`:
   - Schema lehnt ab → 400 `VALIDATION_ERROR` mit `field: "customerEmail"`.

---

## Verbindliche Implementierungs-Hinweise für Engineer

- **Datei `src/app/api/bookings/route.ts`**:
  - `void runMailDispatch(...)` statt `await sendBookingNotification(...)`.
  - 201 wird **vor** dem Mail-Resultat zurückgegeben.
  - Bestehender `try/catch (P2002)` bleibt unverändert.

- **Datei `src/lib/mail.ts`**:
  - Neuer Export `runMailDispatch(bookingId, payload)`.
  - `getResend()` filtert Placeholder-Keys aktiv.

- **Datei `contracts/zod-schemas.ts` + `src/lib/schemas.ts`**:
  - `customerEmail` via `z.preprocess` (Listing oben).

- **Datei `.env.example`**:
  - Kommentar in der `RESEND_API_KEY`-Zeile aufnehmen.
  - Variable `NEXT_PUBLIC_BASE_URL` neu (wird für Iteration 2 gebraucht — siehe ARCHITECTURE.md §15).

- **Datei `src/lib/services.ts`**: keine Änderung.

- **Datei `prisma/schema.prisma`**: keine Änderung wegen des Bugs (das
  Datenmodell ist OK). Iteration-2-Erweiterungen (US-13–US-16) sind separat
  in `contracts/schema.prisma` dokumentiert.

---

## Akzeptanzkriterien für „Bug ist behoben"

- [ ] `POST /api/bookings` antwortet **immer** mit 201, sofern die Buchung
      persistiert wurde — unabhängig davon, ob Resend antwortet oder crasht.
- [ ] Im Admin-Portal sind alle gestellten Anfragen sichtbar, auch wenn die
      Mail-Zustellung fehlschlägt.
- [ ] Bei einem fehlgeschlagenen Mail-Versand zeigt das Admin-Portal die
      betroffene Zeile mit rotem Badge + `mailError`-Tooltip an.
- [ ] Der „Mail erneut senden"-Button (`POST /api/bookings/:id/resend-mail`)
      löst den Versand korrekt neu aus.
- [ ] `customerEmail` mit reinem Whitespace führt **nicht** zu einem
      400-Fehler (sondern zu `customerEmail: null` in der DB).
- [ ] Mit echtem Resend-API-Key kommt die Mail bei Tom an (US-08).
