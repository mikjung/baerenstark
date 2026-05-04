# Iteration 12 — Deploy-Checklist (DevOps / Tom)

> Status: Erstellt vom Backend-Engineer am 2026-05-04.
> Zielgruppe: Tom Siefert (Inhaber, DevOps-Rolle).
> Reihenfolge: Strikt von oben nach unten abarbeiten.

Diese Checkliste ist die Pflicht-Liste für den Roll-Out von Iteration 12.
Schritte 1–5 müssen VOR dem nächsten Vercel-Deploy erfolgen, sonst sind
die Bug-Fixes wirkungslos und die neuen Features schlagen fehl.

---

## 1. Production-Migration deployen (S06 + S11 + S12 + S13 root cause)

**Hypothese:** Die in IT11 angelegte Migration `20260504100000_add_booking_cancellation_audit`
ist in Production noch nicht ausgeführt — daher schlagen alle Endpoints
fehl, die `booking.cancelledAt` / `booking.cancelledBy` lesen
(`/api/customer/bookings`, `/api/admin/upcoming-bookings`,
 `GET /api/bookings`).

Zusätzlich liegt die NEUE Iteration-12-Migration `20260504120000_iteration_12_marketing`
im Repo — sie muss ebenfalls deployed werden, BEVOR der Iteration-12-Code
deployed wird (sonst fehlen die Marketing-Tabellen + die neuen
`unsubscribedAt`-Spalten an `customer_users`).

### Action

```bash
# 1) ENV laden (Production):
vercel env pull .env.vercel.production --environment=production

# 2) Migration-Status checken:
DATABASE_URL=$(grep ^DATABASE_URL .env.vercel.production | cut -d= -f2- | tr -d '"') \
  npx prisma migrate status

# Erwartete Ausgabe (vor Deploy):
#   Following migration have not yet been applied:
#     20260504100000_add_booking_cancellation_audit
#     20260504120000_iteration_12_marketing

# 3) Migrationen deployen:
DATABASE_URL=$(grep ^DATABASE_URL .env.vercel.production | cut -d= -f2- | tr -d '"') \
  npx prisma migrate deploy

# 4) Smoke-Tests (gegen Production-URL):
curl -s -i 'https://www.baerenstark-hausservice.app/api/availability/calendar?from=2026-05-04&to=2026-06-30' | head -5
# Erwartet: HTTP 200
```

**Risiko:** Wenn Schritt 1 oder 3 schlägt fehl, KEIN Code-Deploy — sonst
laufen die alten Endpoints weiterhin in 500-Loops. Bei Fehlern: Backend-
Engineer ansprechen, Stack-Trace aus dem `prisma migrate deploy`-Run
mitschicken.

**Rollback:** Migrationen sind additive ALTER TABLE / CREATE TABLE-Statements.
Ein Rollback ist nicht trivial (wir haben keinen `down`-Migration-Pfad),
aber die zusätzlichen Spalten / Tabellen brechen den Bestand-Code nicht
— sie werden dort schlicht ignoriert. Im Notfall: Spalten manuell per
SQL droppen (Backup vorher!).

---

## 2. Vercel Production-Env-Vars: NEXTAUTH_URL und NEXT_PUBLIC_BASE_URL (S01)

**Befund:** Die im Repo committete `.env.production` wurde bereits korrigiert
auf `https://www.baerenstark-hausservice.app`. **ABER:** Vercel liest
die Werte aus dem Vercel-Dashboard, nicht aus der Repo-Datei.
DevOps muss daher MANUELL in Vercel beide Werte aktualisieren.

### Action

1. Vercel Dashboard → Projekt `baerenstark` → Settings → Environment Variables.
2. Filter „Production".
3. **`NEXTAUTH_URL`** auf `https://www.baerenstark-hausservice.app` setzen
   (KEIN Trailing-Slash, MIT `www.`).
4. **`NEXT_PUBLIC_BASE_URL`** auf den gleichen Wert setzen.
5. Beide Variablen NUR in `Production` aktiv lassen (Preview/Dev unangetastet).
6. **Deploy triggern** — env-Var-Änderungen greifen erst beim nächsten
   Build.

### Verifikation

- Inkognito → `https://www.baerenstark-hausservice.app/konto/login` →
  „Mit Google anmelden" → Google-Consent → Erwartung: Redirect ohne
  4xx zurück auf `/konto`.
- Vercel Function-Logs zur Repro-Zeit prüfen — keine 4xx auf
  `/api/auth/customer/callback/google`.

---

## 3. Google Cloud Console: Authorized Redirect URI (S01)

**Befund:** Wenn `NEXTAUTH_URL` korrigiert ist, MUSS auch der Authorized
Redirect URI in der Google Cloud Console exakt dem neuen Wert
entsprechen — sonst lehnt Google den OAuth-Callback ab.

### Action

1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0
   Client (für Customer-Login).
2. **Authorized redirect URIs** prüfen:
   - Pflicht: `https://www.baerenstark-hausservice.app/api/auth/customer/callback/google`
   - Empfehlung: zusätzlich `http://localhost:3000/api/auth/customer/callback/google` (Dev).
3. Falls die alte Apex-URI (`https://baerenstark-hausservice.app/...`)
   noch eingetragen ist: drin lassen oder entfernen, beides ok — wichtig
   ist, dass die `www.`-Variante existiert.

---

## 4. Vercel Blob-Token regenerieren (S10)

**Befund:** S10 (Bild-Upload INTERNAL_ERROR) zeigt symptomatisch auf einen
expired oder falsch zugeordneten `BLOB_READ_WRITE_TOKEN`. Token-Wert in
`.env.production` (Repo) ist nicht autoritativ — Vercel-Production-Env
gewinnt.

### Action

1. Vercel Dashboard → Storage → Blob → `baerenstark`-Store öffnen.
2. „Tokens" → bestehenden `BLOB_READ_WRITE_TOKEN` prüfen
   (Status, Expiration).
3. Wenn unsicher: **Token regenerieren** und sofort in
   Vercel → Settings → Environment Variables → `BLOB_READ_WRITE_TOKEN`
   (Production) eintragen.
4. **Deploy triggern.**

### Verifikation

- Eingeloggter Customer → Buchungsformular → 1 MB JPEG hochladen.
- Erwartung: Upload erfolgreich, Datei erscheint im Admin-Drawer.
- Vercel Function-Logs für `/api/upload` prüfen — kein
  `[upload] vercel blob put failed`.

---

## 5. NEUER Env-Var: UNSUBSCRIBE_TOKEN_SECRET (S15)

**Pflicht für IT12-S15** — ohne diese Variable schlägt jede Marketing-
Mail-Anlage fehl (Backend wirft beim Generieren des Unsubscribe-Tokens).

### Action

1. Generieren (lokal, einmalig):
   ```bash
   openssl rand -base64 32
   ```
   (Beispiel-Output: `kAg8z3zMqr0XJ...` — mind. 16 Zeichen, ≥ 32 empfohlen.)

2. Vercel Dashboard → Settings → Environment Variables → **NEU anlegen**:
   - Name: `UNSUBSCRIBE_TOKEN_SECRET`
   - Value: der oben generierte Wert
   - Scope: **Production** (Preview/Dev separat oder leer lassen — dort
     erfolgt kein echter Versand).

3. Wichtig: NICHT denselben Wert wie `AUTH_SECRET` oder `BOOKING_TOKEN_SECRET`
   verwenden — separater Blast-Radius.

4. **Deploy triggern.**

### Verifikation

- Admin → `/admin/marketing` (oder Customer-Liste mit Marketing-Modus) →
  Test-Mail an eigene Admin-Email senden.
- Im Footer der Test-Mail erscheint ein Unsubscribe-Link →
  `https://www.baerenstark-hausservice.app/api/customer/unsubscribe?token=...`
- Klick darauf → 302 → `/marketing/abgemeldet?ok=1`.

### Rotation

Wenn die Variable rotiert wird, werden ALLE bisherigen Unsubscribe-Links
in alten Marketing-Mails ungültig. Das ist der bewusste, sichere Default
(stateless HMAC). Bei Verdacht auf Compromise: rotieren — Tom's
Bestandskunden müssen sich dann ggf. erneut abmelden.

---

## 6. Resend-Tageskontingent im Auge behalten (S15)

Resend Free-Tier: **100 Mails/Tag** (3.000/Monat).

- Backend prüft VOR jedem Bulk-Send das aktuelle Tageskontingent
  und antwortet mit `429 DAILY_QUOTA_EXCEEDED`, wenn der Send das
  Kontingent überschreiten würde.
- Frontend zeigt das verbleibende Kontingent („Heute: X von 100").
- Hard-Cap pro Send-Operation: **50 Empfänger** (Vercel-Hobby-Timeout).

**Empfehlung:** Bei mehreren großen Versänden in einer Woche → Resend Pro
upgraden ($20/Monat, 50 000 Mails). Frontend-Spec sieht keinen
Auto-Switch vor; Pro-Upgrade ist eine reine Stripe-Aktion bei Resend.

---

## 7. (Nach Deploy) Vercel-Function-Logs aktiv beobachten (24h)

Nach jedem Iteration-12-Deploy mindestens 24h lang die Vercel-Function-
Logs filtern auf:

- `[internal_error]` — unerwartete 500er.
- `[prisma_error]` — DB-Fehler (deutet auf Migration-Drift).
- `[marketing-audit]` — Marketing-Mail-Versand-Aktivität (gut für
  DSGVO-Audit-Spur).
- `[upload] vercel blob put failed` — Indiz dass Blob-Token noch immer
  Probleme macht.

Wenn nach 24h **keine** dieser Marker auftauchen (außer geplante
`[marketing-audit]`-Einträge): IT12 ist sauber gelaufen.

---

## Zusammenfassung — Was MUSS getan werden, was ist optional?

| Schritt | Pflicht? | Wann |
|--------:|---------|------|
| 1. Migrationen deployen | **Pflicht** | VOR Code-Deploy |
| 2. NEXTAUTH_URL in Vercel | **Pflicht** | VOR Code-Deploy |
| 3. Google Console URI | **Pflicht** | VOR Code-Deploy (wenn nicht schon erledigt) |
| 4. BLOB_READ_WRITE_TOKEN | Pflicht (S10) | VOR Code-Deploy |
| 5. UNSUBSCRIBE_TOKEN_SECRET | **Pflicht** für S15 | VOR Code-Deploy |
| 6. Resend-Tier-Check | Empfehlung | wann Tom > 50 Empfänger plant |
| 7. Function-Logs beobachten | Empfehlung | 24h nach Deploy |

**Wenn Schritte 1, 2, 5 nicht erledigt sind: NICHT deployen.**

---

## Frage offen / NEEDS INPUT (an Backend-Engineer / Architect)

- Resend-Tier-Upgrade auf Pro? (Stakeholder-Entscheidung).
- Vercel-Plan-Upgrade auf Pro für 60s-Timeout (würde Hard-Cap auf
  100+ Empfänger pro Send erlauben)? (Stakeholder-Entscheidung).
