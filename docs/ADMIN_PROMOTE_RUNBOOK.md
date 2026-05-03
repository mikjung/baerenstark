# Admin-Bootstrap-Reset — Runbook (US-IT7-04)

**Status:** Iteration 7, 2026-05-03
**Zielgruppe:** Tom Siefert (selbst ausführbar, ohne Engineer-Hilfe).
**Skript:** `scripts/promote-admin.ts`

## Wann nutzen?

- Du bist aus der Admin-Konsole ausgesperrt (Login schlägt fehl).
- `/admin/setup` antwortet mit 410 GONE (das ist normal — F1-Schutz).
- Die Datenbank enthält bereits einen User, aber er ist nicht ACTIVE
  oder du kennst dein Passwort nicht mehr.

## Voraussetzungen

- Node.js installiert (`node --version` ≥ 20).
- `npm install` (oder `pnpm install`) wurde mindestens einmal ausgeführt.
- Du bist im Repo-Root: `/Users/<dein-user>/.../baerenstark/`.
- ENV-Datei `.env` oder `.env.local` enthält `DATABASE_URL=...` (Prod-DB
  oder lokale `dev.db`).

## Aufruf — interaktiv (bevorzugt, KEIN Shell-History-Leak)

```bash
ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts hausservice-baerenstark@outlook.com
```

Das Skript fragt im Terminal nach dem Passwort:

```
[promote-admin] Neuer Admin "hausservice-baerenstark@outlook.com" — Passwort eingeben (mind. 12 Zeichen):
```

Tippe dein gewünschtes Passwort ein und drücke Enter. Das Passwort wird
**nicht** auf dem Bildschirm angezeigt und wird **nicht** in die Shell-
History geschrieben.

## Aufruf — explizit mit Passwort (m4-IT7 — WARNUNG)

```bash
ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts hausservice-baerenstark@outlook.com --password=Temp1234!Change
```

> **WARNUNG (m4-IT7):** Bei dieser Variante landet das Passwort in deiner
> Shell-History (z.B. `~/.zsh_history`). Selbst wenn du das Passwort
> später änderst, ist der ursprüngliche Wert in der History rekonstruierbar.
>
> Nutze diese Variante NUR, wenn:
> - du in einem Skript/CI-Job aufrufst und der History-Pfad `/dev/null` ist,
> - oder du danach **sofort** das Passwort über `/admin/passwort-vergessen`
>   änderst UND zusätzlich `fc -p` (zsh) bzw. `history -c` (bash)
>   ausführst, um die History zu bereinigen.
>
> Das Skript druckt selbst eine WARNUNG, wenn du `--password=` nutzt.

## Verhalten

| Eingabe | Verhalten |
|--------|-----------|
| User existiert NICHT, kein --password, TTY | Interaktiv Passwort abfragen, neuen ACTIVE-Admin anlegen. |
| User existiert NICHT, kein --password, kein TTY | ABORT (exit 1). |
| User existiert NICHT, mit --password | Neuen ACTIVE-Admin mit dem Passwort anlegen. |
| User existiert, kein --password, TTY | Interaktive Abfrage; bei Enter ohne Eingabe → status=ACTIVE setzen, Hash bleibt. |
| User existiert, mit --password | status=ACTIVE setzen + Passwort-Hash überschreiben. |
| Skript zweimal mit gleichen Args | Idempotent — kein Duplicate, kein Crash. |

## F1-Garantie bleibt aktiv

Nach erfolgreichem Skript-Lauf ist `count(users) >= 1`. Das bedeutet:

- `POST /api/admin/setup` antwortet weiter mit **410 GONE** (Bootstrap
  ist „abgeschlossen").
- `BOOTSTRAP_ADMIN_EMAIL`-Allowlist greift nicht — das Skript ist der
  einzige sichere Weg, einen weiteren Initial-Admin anzulegen.
- Promote-Skript ist NICHT über HTTP erreichbar — nur lokales CLI.

## Nach erfolgreichem Login

1. Logge dich auf `/admin/login` mit dem Passwort ein, das du dem Skript
   gegeben hast.
2. **SOFORT** über `/admin/passwort-vergessen` ein neues, sicheres
   Passwort setzen — besonders wenn du `--password=` über die Shell
   genutzt hast.
3. (Falls Shell-History betroffen) Bereinige die History:
   - **zsh:** `fc -p`  oder direkt `~/.zsh_history` editieren.
   - **bash:** `history -c && history -w`.

## Sicherheits-Schichten zur Erinnerung

1. **ENV-Guard:** `ALLOW_ADMIN_PROMOTE=true` ist Pflicht. Ohne diese
   Variable bricht das Skript mit Exit-Code 1 ab.
2. **CLI-only:** Skript ist niemals über HTTP erreichbar.
3. **Idempotenz:** mehrfacher Lauf legt keine Duplicates an.
4. **F1-Verträglichkeit:** ändert nichts am `/api/admin/setup`-Verhalten.
