# Bärenstark Hausservice — Skripte

Alle Skripte werden via `npx tsx scripts/<name>.ts` ausgeführt. Sie sind
ENV-gegated und absichtlich nicht in `package.json` als Aliase registriert,
damit ein versehentlicher `npm run …`-Aufruf nicht möglich ist.

## promote-admin.ts (US-IT7-04)

Stellt einen Admin-Account wieder her oder legt einen neuen an. Idempotent,
F1-kompatibel. Ausführliche Anleitung: [`docs/ADMIN_PROMOTE_RUNBOOK.md`](../docs/ADMIN_PROMOTE_RUNBOOK.md).

**Quickstart (interaktiv, bevorzugt):**

```bash
ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts hausservice-baerenstark@outlook.com
```

**Mit Passwort als CLI-Arg (NICHT empfohlen — Shell-History-Leak, m4-IT7):**

```bash
ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts hausservice-baerenstark@outlook.com --password=Temp1234!Change
```

## reset-users.ts (US-IT6-06)

Wipe aller User-Konten (Admin + Customer). Anonymisiert Buchungen statt zu
löschen, bewahrt Buchhaltungs-Historie. Pair-Run mit Tom Pflicht.

```bash
ALLOW_USER_WIPE=true npx tsx scripts/reset-users.ts --dry-run
```

## reset-admin-password.ts (US-30)

Setzt das Passwort eines existierenden Admins zurück. Wird selten genutzt,
seitdem `/admin/passwort-vergessen` UI-basiert verfügbar ist.

## check-dto-leaks.ts (F3-CI-Gate)

Architektur-Test: scannt `/api/customer/*` auf DTO-Leak-Muster
(`prisma.customerUser.find*` ohne `selectCustomerUserPublic()`,
`adminNote`/`adminRating`/`passwordHash`/`verificationToken`/`oauthId`
in Response-Bodies). Pflicht-Gate vor Merge.

```bash
npx tsx scripts/check-dto-leaks.ts
```

## test-prisma-adapter.ts

Sanity-Check, dass der libSQL-Adapter mit der `DATABASE_URL` verbinden
kann. Nützlich nach ENV-Änderungen.
