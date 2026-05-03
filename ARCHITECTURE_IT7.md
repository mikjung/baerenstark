# ARCHITECTURE_IT7.md — Iteration 7

**Auth-Stabilisierung & Email-Auth-Wiederherstellung**

Datum: 2026-05-03
Vorgänger: `ARCHITECTURE_IT6.md` (Anhang B / §17 — F1, F2, F3, m1–m7)
Stack: Next.js 14 App Router, Prisma 5, libSQL/Turso, NextAuth v5, bcryptjs, Resend, Upstash, Stripe.

> **Diese Datei ist verbindliche Architektur-Spezifikation für IT7.** Sie ergänzt
> `ARCHITECTURE.md` und `ARCHITECTURE_IT6.md`. Keine IT6-Garantie wird aufgehoben:
> F1 (Bootstrap-Allowlist), F2 (Conditional-UPDATE), F3 (DTO-Helper +
> `.strict()`-Output) bleiben **vollständig aktiv**. IT7 fügt
> Customer-Email/Password-Auth zurück, repariert OAuth und liefert ein
> CLI-Skript zur Admin-Wiederherstellung.

---

## 0. Kontext und Ziel

Tom hat nach IT6-Go-Live fünf Probleme gemeldet:

| Problem | Story | Architektur-Eingriff |
|---------|-------|----------------------|
| Tom aus Admin-Konsole ausgesperrt | US-IT7-04 | CLI-Skript `scripts/promote-admin.ts` (BLOCKER, sofort fixbar). |
| Google OAuth „Bad request" | US-IT7-02 | Diagnose-Endpoint `/api/auth/diagnose` + `debug:true` + Env-Härtung in `customer-oauth.ts`. |
| Facebook OAuth funktioniert nicht | US-IT7-03 | gleiche Diagnose-Schiene + `oauth_no_email`-Failure-Mode. |
| Kunden ohne Google/FB können sich nicht registrieren | US-IT7-01 | Reversion von US-IT6-05 D3: 6 gelöschte Endpoints + 4 Pages werden wiederhergestellt. Credentials-Provider in NextAuth wieder aktiv. |
| Passwort-Reset kaputt | US-IT7-05 | Neue `PasswordResetToken`-Tabelle, sichere Token-Lifecycle (SHA256-Hash, 1h-Ablauf, single-use). |

**Querschnitt:** alle Customer-DTO-Pfade durchlaufen weiterhin
`selectCustomerUserPublic()` + `CustomerUserPublicSchema.strict()`. Neue Felder
`passwordHash` / `verificationToken` werden explizit in der DTO-Blacklist
gepflegt (siehe §6 unten).

**Build-Reihenfolge (verbindlich):**

```
Phase A — sofort, parallelisierbar:
  T-A1  scripts/promote-admin.ts implementieren            (US-IT7-04)
  T-A2  /api/auth/diagnose Dev-only-Endpoint              (US-IT7-02 + 03)
  T-A3  AUTH_GOOGLE_FIX_RUNBOOK.md auf TOP-5 Liste neu    (US-IT7-02)

Phase B — sequentiell, nach A1:
  T-B1  Prisma-Migration `iteration_7_email_auth`         (Schema-Eingriff)
  T-B2  Customer-Credentials-Provider in customer-oauth.ts (US-IT7-01)
  T-B3  6 Customer-API-Endpoints wiederherstellen          (US-IT7-01 + 05)
  T-B4  4 Customer-Pages wiederherstellen                  (US-IT7-01 + 05)

Phase C — Stabilisierung:
  T-C1  DTO-Helper `selectCustomerUserPublic()` Blacklist erweitern
  T-C2  scripts/check-dto-leaks.ts Felder-Blacklist erweitern
  T-C3  Architektur-Tests für PasswordResetToken-Lifecycle
```

Phase A blockiert nicht Phase B. T-A1 entsperrt Tom *unabhängig* vom Code-Refactor.

---

## 1. US-IT7-04 — Admin-Bootstrap-Reset (BLOCKER)

### 1.1 Entscheidung

**CLI-Skript `scripts/promote-admin.ts`**, KEIN Public-Setup-Endpoint.

Begründung:
- F1 aus IT6 §17.1 bleibt unangetastet (`/api/admin/setup` antwortet weiter
  mit 410 GONE, sobald `count(users) >= 1`). Kein neuer öffentlicher Pfad,
  über den Angreifer einen zusätzlichen Admin anlegen könnten.
- Gleicher Sicherheits-Mechanismus wie `scripts/reset-users.ts` (US-IT6-06):
  ENV-Guard + Pair-Run mit Tom.
- Skript ist idempotent — mehrfaches Ausführen mit identischer Email
  upsertet, ohne Duplikate.

### 1.2 Verbindliche Spec

```ts
// scripts/promote-admin.ts (verbindlich, Pseudo-Code)
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

async function main() {
  // 1. ENV-Guard.
  if (process.env.ALLOW_ADMIN_PROMOTE !== 'true') {
    console.error(
      '[promote-admin] ABORT — ENV ALLOW_ADMIN_PROMOTE=true erforderlich.',
    );
    process.exit(1);
  }

  // 2. Args parsen.
  const [, , rawEmail, ...rest] = process.argv;
  if (!rawEmail) {
    console.error('Usage: ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts <email> [--password=<pwd>]');
    process.exit(1);
  }
  const email = rawEmail.trim().toLowerCase();
  const passwordArg = rest.find((a) => a.startsWith('--password='));
  const explicitPwd = passwordArg ? passwordArg.split('=')[1] : null;

  // 3. Lookup.
  const existing = await prisma.user.findUnique({ where: { email } });

  // 4. Passwort bestimmen.
  //    - Wenn `--password=<pwd>` gesetzt: nimm diesen (mind. 12 Zeichen — Tom-Convention).
  //    - Sonst, falls neuer User: generiere 16-Byte-Random-Base64.
  //    - Sonst, falls bestehender User ohne --password: belasse passwordHash unverändert.
  let plaintextPwd: string | null = explicitPwd ?? null;
  if (!existing && !plaintextPwd) {
    plaintextPwd = randomBytes(16).toString('base64url');
  }
  if (plaintextPwd && plaintextPwd.length < 12) {
    console.error('[promote-admin] ABORT — Passwort muss mindestens 12 Zeichen haben.');
    process.exit(1);
  }
  const passwordHash = plaintextPwd ? await bcrypt.hash(plaintextPwd, 12) : null;

  // 5. Upsert.
  let result;
  if (existing) {
    result = await prisma.user.update({
      where: { email },
      data: {
        status: 'ACTIVE',
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: { id: true, email: true, name: true, status: true },
    });
    console.log(`[promote-admin] UPDATE — ${email} → status=ACTIVE`);
  } else {
    if (!passwordHash) {
      console.error('[promote-admin] ABORT — neuer Admin braucht ein Passwort.');
      process.exit(1);
    }
    result = await prisma.user.create({
      data: {
        email,
        name: email.split('@')[0],
        passwordHash,
        status: 'ACTIVE',
        // createdById bleibt NULL (Bootstrap-Pfad).
      },
      select: { id: true, email: true, name: true, status: true },
    });
    console.log(`[promote-admin] CREATE — neuer Admin angelegt: ${email}`);
  }

  // 6. Output.
  console.log(JSON.stringify(result, null, 2));
  if (plaintextPwd) {
    console.log('');
    console.log(`>>> Temporäres Passwort: ${plaintextPwd}`);
    console.log('>>> Bitte SOFORT ändern unter /admin/forgot-password.');
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('[promote-admin] FATAL', e);
  process.exit(1);
});
```

### 1.3 README

`scripts/README.md` (neu) enthält:

```
# Admin aus Lock-out befreien

Wenn aus Admin-Konsole ausgesperrt:

  ALLOW_ADMIN_PROMOTE=true \
  npx tsx scripts/promote-admin.ts hausservice-baerenstark@outlook.com \
    --password=Temp1234!Change

Skript ist idempotent. Bestehende User werden auf status=ACTIVE gesetzt;
ein optional übergebenes `--password=...` ersetzt den Hash. Neue User
werden mit Bootstrap-Pfad angelegt (createdById=NULL).

Sicherheit:
- ENV `ALLOW_ADMIN_PROMOTE=true` ist Pflicht (analog ALLOW_USER_WIPE).
- Niemals über HTTP erreichbar — reines lokales CLI.
- Nach erfolgreichem Login Passwort SOFORT über /admin/forgot-password ändern.
```

### 1.4 Failure-Modes (QA)

| Szenario | Ergebnis |
|----------|----------|
| `ALLOW_ADMIN_PROMOTE` fehlt | exit(1) mit klarem Hinweis |
| keine Email-Arg | Usage-Hinweis, exit(1) |
| `--password` mit < 12 Zeichen | exit(1), abort |
| Email existiert, kein `--password` | nur `status=ACTIVE` setzen, Hash bleibt |
| Email existiert, mit `--password` | `status=ACTIVE`, Hash überschrieben |
| Email existiert nicht, kein `--password` | Random-Pwd generiert + ausgegeben |
| Skript läuft 2x mit gleichen Args | idempotent, kein Duplikat (UNIQUE auf email) |

### 1.5 F1-Garantie bleibt aktiv

`/api/admin/setup` ändert sich **nicht**. Sobald das Skript einen Admin
angelegt hat, ist `count(users) >= 1` und der Setup-Endpoint antwortet
weiter mit 410 GONE — wie in §17.1 spezifiziert.

---

## 2. US-IT7-02 — Google OAuth reparieren

### 2.1 Diagnose-Endpoint `GET /api/auth/diagnose` (Dev-only)

**Zweck:** Tom (oder Engineer) bekommt Self-Service-Sicht auf alle
auth-relevanten Konfigurationsbits, ohne die Codebase zu lesen.

**Verbindlich:** Endpoint antwortet **nur in Dev-Mode** (`NODE_ENV !== 'production'`)
mit 200 + JSON. In Prod liefert er 404 (Next.js `notFound()`).

```ts
// src/app/api/auth/diagnose/route.ts
import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';

export async function GET() {
  if (process.env.NODE_ENV === 'production') notFound();

  const expectedCallbacks = {
    admin:    `${process.env.NEXTAUTH_URL ?? '<UNSET>'}/api/auth/callback/credentials`,
    googleC:  `${process.env.NEXTAUTH_URL ?? '<UNSET>'}/api/auth/customer/callback/google`,
    facebook: `${process.env.NEXTAUTH_URL ?? '<UNSET>'}/api/auth/customer/callback/facebook`,
  };

  return NextResponse.json({
    env: {
      NODE_ENV: process.env.NODE_ENV ?? null,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
      AUTH_SECRET_set: !!process.env.AUTH_SECRET,
      NEXTAUTH_SECRET_set: !!process.env.NEXTAUTH_SECRET,
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? null,
      GOOGLE_CLIENT_ID_set: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET_set: !!process.env.GOOGLE_CLIENT_SECRET,
      FACEBOOK_CLIENT_ID_set: !!process.env.FACEBOOK_CLIENT_ID,
      FACEBOOK_CLIENT_SECRET_set: !!process.env.FACEBOOK_CLIENT_SECRET,
      FEATURE_OAUTH_LOGIN: process.env.FEATURE_OAUTH_LOGIN ?? null,
      RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
    },
    providersActive: {
      google:   !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      facebook: !!(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
      credentialsCustomer: true, // ab IT7 immer aktiv
      credentialsAdmin: true,
    },
    expectedCallbacks,
    notes: [
      'NEXTAUTH_URL darf KEINEN Trailing-Slash haben.',
      'Google: Authorized Redirect URI muss exakt expectedCallbacks.googleC entsprechen.',
      'Facebook: gleiche Regel + App-Domain im Meta-Portal verifiziert + App-Status "Live".',
      'AUTH_SECRET ist NextAuth v5 Pflicht (32+ Zeichen).',
      'AUTH_TRUST_HOST=true ist auf Vercel/Tunnel/Production Pflicht.',
    ],
  });
}
```

**Niemals** ein Secret im Klartext ausliefern — nur Bool-Flags.

### 2.2 Härtung in `src/lib/customer-oauth.ts`

Drei Eingriffe:

```ts
const customerOauthConfig: NextAuthConfig = {
  providers: buildProviders(),
  pages: { signIn: '/konto/login', error: '/konto/login' },
  session: { strategy: 'jwt', maxAge: 60 },
  trustHost: true, // BLEIBT — bestätigt
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  // NEU IT7: Debug-Mode in Dev liefert NextAuth-Internals in console.log.
  debug: process.env.NODE_ENV === 'development',
  callbacks: { /* … unverändert … */ },
  cookies: { /* … unverändert … */ },
};
```

Außerdem in `src/lib/auth.ts` (Admin-NextAuth) ebenfalls:
```ts
debug: process.env.NODE_ENV === 'development',
```

### 2.3 Aktualisiertes Runbook `docs/AUTH_GOOGLE_FIX_RUNBOOK.md`

Wird inhaltlich auf **TOP-5 prüfbar** umstrukturiert:

1. `NEXTAUTH_URL` korrekt (kein Trailing-Slash, exaktes Schema)?
2. `AUTH_SECRET` gesetzt und 32+ Zeichen?
3. `AUTH_TRUST_HOST=true` in Prod-Env?
4. Google Cloud Console: Authorized Redirect URIs enthält `${NEXTAUTH_URL}/api/auth/customer/callback/google`?
5. OAuth Consent Screen: Status „In production" ODER Tom als Test-User eingetragen?

Plus neuer Self-Check-Befehl im README:

```
npm run auth:check
# Curlt /api/auth/diagnose (Dev) und printet eine Tabelle.
```

### 2.4 ENV-Updates

`.env.example` erhält:

```
# Iteration 7 / US-IT7-02 — NextAuth v5 verbindlich.
# AUTH_SECRET ist Pflicht (32+ Zeichen). NEXTAUTH_SECRET bleibt als Alias
# erhalten, beide werden gelesen.
AUTH_SECRET="generate-via-`openssl rand -base64 32`"
# AUTH_TRUST_HOST: muss "true" sein für Vercel/Tunnel/Production.
AUTH_TRUST_HOST="true"
```

(Werte sind im Repo bereits angelegt, IT7 stellt sicher dass sie **nicht
leer** sind und im Runbook als Pflichtchecks erwähnt werden.)

---

## 3. US-IT7-03 — Facebook OAuth reparieren

### 3.1 Diagnose

Gleicher Mechanismus wie Google (siehe §2.1 Diagnose-Endpoint und §2.3
Runbook). Zusätzlich Facebook-spezifische Checks im Runbook:

1. App-Status im Meta Developer Portal: „Live" (nicht „Development").
2. App-Domain im Portal eingetragen: `www.baerenstark-hausservice.app`.
3. Valid OAuth Redirect URI: `${NEXTAUTH_URL}/api/auth/customer/callback/facebook`.
4. Permissions: nur `email` + `public_profile` (kein App Review nötig).
5. App ID und App Secret aus „Einstellungen → Allgemeines" in `.env`
   gesetzt.

### 3.2 Failure-Mode `oauth_no_email`

Manche Facebook-Konten geben keine Email zurück (Privacy-Settings).
`normalizeProfile()` liefert in dem Fall bereits `null`, die `signIn`-
Callback mappt das auf `redirect → /konto/login?error=oauth_no_email`.

**Verbindlich (bleibt aus IT6):** Frontend zeigt deutsche Fehlermeldung
„Mit Ihrem Facebook-Konto ist keine E-Mail-Adresse verknüpft. Bitte
registrieren Sie sich per E-Mail." mit Button → `/konto/registrieren`.

### 3.3 Tom-Self-Service

Im Runbook neu: kompakter „Tom-Checklist"-Block für das Meta-Portal:

```
[ ] App-Status auf „Live" gesetzt
[ ] App-Domain `www.baerenstark-hausservice.app` eingetragen
[ ] Valid OAuth Redirect URI gesetzt:
      https://www.baerenstark-hausservice.app/api/auth/customer/callback/facebook
[ ] App-ID und App-Secret per sicherem Kanal an Engineer übergeben
[ ] Privacy Policy URL gesetzt (Meta-Pflicht für Live-Mode)
```

### 3.4 Provider bleibt MUST

Facebook OAuth bleibt **Must Have** in IT7 (Vorentscheidung Orchestrator,
nicht herabgestuft).

---

## 4. US-IT7-01 — Email/Password-Auth wiederherstellen

### 4.1 Schema-Eingriff (Migration `iteration_7_email_auth`)

| Feld | Tabelle | Aktion |
|------|---------|--------|
| `passwordHash` | `customer_users` | **bleibt** (seit IT5 nullable). |
| `emailVerified` | `customer_users` | **bleibt**. |
| `emailVerifiedAt` | `customer_users` | **NEU** — `DateTime?`. Optional, gesetzt bei erfolgreicher Verifikation. |
| `verificationToken` / `verificationTokenExpiry` | `customer_users` | **bleibt** (waren in IT4 angelegt). |
| `resetToken` / `resetTokenExpiry` | `customer_users` | **ENTFERNT** — Reset-Logik wandert in neue Tabelle (siehe §5). |
| `password_reset_tokens` | (neue Tabelle) | **NEU** — siehe §5. |

Migration-Dateiname: `prisma/migrations/20260503090000_iteration_7_email_auth/migration.sql`.

### 4.2 NextAuth — Customer-Credentials-Provider zurück

`src/lib/customer-oauth.ts` wird umbenannt zu **`customer-auth-config.ts`**
(*nicht* zwingend, aber sauberer; das Modul ist nicht mehr nur OAuth).
Engineering-Hinweis: Wenn umbenannt, alle Importe aktualisieren.

Provider-Liste (verbindlich):

```ts
function buildProviders(): NextAuthConfig['providers'] {
  const providers: NextAuthConfig['providers'] = [];

  // IT7 / US-IT7-01: Credentials zurück.
  providers.push(
    Credentials({
      name: 'CustomerCredentials',
      credentials: {
        email:    { label: 'E-Mail', type: 'email' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(creds) {
        // Rate-Limit (BUG-IT5-style — 10/h IP, 5/h Email).
        await checkCustomerLoginRateLimit(creds);

        const parsed = CustomerLoginSchema.safeParse(creds);
        if (!parsed.success) return null;

        const lc = parsed.data.email.toLowerCase();
        const user = await prisma.customerUser.findUnique({ where: { email: lc } });
        if (!user || !user.passwordHash) {
          // Konstante bcrypt-Last (Timing-Side-Channel-Schutz).
          await bcrypt.compare(parsed.data.password, DUMMY_BCRYPT_HASH);
          return null;
        }

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        // emailVerified ist KEIN harter Block (Vorentscheidung Orchestrator).
        // Frontend zeigt Banner, wenn user.emailVerified === false.
        return {
          id: user.id,
          email: user.email,
          customerId: user.id,
        };
      },
    }),
  );

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(GoogleProvider({ /* …unverändert… */ }));
  }
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push(FacebookProvider({ /* …unverändert… */ }));
  }
  return providers;
}
```

> **Wichtig:** Der Customer-Credentials-Authorize-Pfad setzt KEIN
> `customer-session`-Cookie selbst — er produziert einen NextAuth-JWT
> (60s TTL, wie OAuth) und wird über die bestehende Finalize-Route
> `GET /api/customer/oauth-finalize` in das langlebige Cookie umgemünzt.
> Vorteil: ein einziger Cookie-Setter-Pfad, keine Drift zwischen
> Credentials- und OAuth-Login.

**Alternative (wenn Engineer das Finalize-Pattern für Credentials zu
kompliziert findet):** Eigener `POST /api/customer/login` Endpoint, der
direkt das `customer-session`-Cookie schreibt — wie es vor IT6 implementiert
war. Engineer entscheidet final; Architektur lässt beide Wege offen.

### 4.3 Wiederherzustellende Endpoints

Verzeichnisse, die in IT6 D3 gelöscht wurden — **alle wieder neu anlegen**:

| Endpoint | Methode | Body / Query | Auth | Rate-Limit |
|----------|---------|--------------|------|------------|
| `POST /api/customer/register` | Public | `CustomerRegisterSchema` | none | 5/h IP, 3/h Email |
| `POST /api/customer/login` | Public | `CustomerLoginSchema` | none | 10/h IP, 5/h Email |
| `GET  /api/customer/verify?token=` | Public | `CustomerVerifyTokenQuerySchema` | none | 30/h IP |
| `POST /api/customer/resend-verification` | Customer-session | none body | customer | 3/h Email |
| `POST /api/customer/forgot-password` | Public | `CustomerForgotPasswordSchema` | none | 3/h IP, 3/h Email |
| `POST /api/customer/reset-password` | Public | `CustomerResetPasswordSchema` | none | 5/h IP |

Alle Endpoints liefern Antworten gemäß bestehender Schemas in
`contracts/zod-schemas.ts` (siehe §11). DTO-Garantie aus §6 unten gilt
für Antworten von register/login/me.

### 4.4 Email-Verifizierung optional (Vorentscheidung)

- Registrierung sendet eine Verify-Mail via Resend (deutsche Vorlage,
  Bärenstark-Branding).
- User kann sich **sofort** einloggen, auch ohne Klick auf den
  Verify-Link.
- `/konto/*` zeigt einen Info-Banner „Bitte bestätigen Sie Ihre
  E-Mail-Adresse — [Link erneut senden]" wenn `emailVerified === false`.
- Verify-Link gültig 24h (wie schon in IT4 spezifiziert).
- Klick auf Link setzt `emailVerified=true`, `emailVerifiedAt=now()`,
  `verificationToken=null`, `verificationTokenExpiry=null`. Redirect zu
  `/konto/verifizieren/erfolg`.

---

## 5. US-IT7-05 — Passwort-Reset E2E

### 5.1 Schema — neue Tabelle `PasswordResetToken`

```prisma
/// IT7 / US-IT7-05 — Passwort-Reset für Kunden.
///
/// Sicherheits-Design:
///   - tokenHash: SHA-256-Hash des Klartext-Tokens. Klartext NIEMALS in DB.
///   - expiresAt: 1h nach createdAt.
///   - usedAt: Single-Use; wird beim erfolgreichen Reset gesetzt.
///   - ON DELETE CASCADE auf customerId — wenn Kundenkonto gelöscht
///     wird (US-IT6-06), verschwinden ungenutzte Tokens automatisch.
model PasswordResetToken {
  id          String       @id @default(cuid())
  customerId  String
  customer    CustomerUser @relation(fields: [customerId], references: [id], onDelete: Cascade)
  /// SHA-256 hex digest, 64 chars.
  tokenHash   String       @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime     @default(now())

  @@index([customerId, expiresAt])
  @@map("password_reset_tokens")
}
```

`CustomerUser` erhält den Backref:

```prisma
model CustomerUser {
  // … bestehend …
  passwordResetTokens PasswordResetToken[]
  // entfernt: resetToken, resetTokenExpiry
}
```

### 5.2 Token-Lifecycle

```
[forgot-password]                           [reset-password]
       |                                            |
       v                                            v
  randomBytes(32)                                tokenHash = sha256(input)
  base64url → token                              SELECT … WHERE tokenHash=?
  tokenHash = sha256(token)                      check expiresAt > now()
  INSERT password_reset_tokens                   check usedAt IS NULL
  Resend.send(link?token=token)                  bcrypt.hash(newPassword, 12)
                                                 UPDATE customer_users SET passwordHash=…
                                                 UPDATE password_reset_tokens SET usedAt=now()
                                                 (alles in $transaction)
```

### 5.3 Endpoint-Specs

#### `POST /api/customer/forgot-password`

```ts
// Body: { email: string }
// Response: 200 immer (kein Email-Enumeration).
// Body: { ok: true } — kein User-Status durchgereicht.

const { email } = CustomerForgotPasswordSchema.parse(await req.json());
const lc = email.toLowerCase();
const user = await prisma.customerUser.findUnique({ where: { email: lc } });

// Konstante Latenz (Side-Channel): immer Token generieren + bcrypt-Dummy.
const tokenPlain = randomBytes(32).toString('base64url');
const tokenHash = sha256Hex(tokenPlain);

if (user) {
  await prisma.passwordResetToken.create({
    data: {
      customerId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
    },
  });
  await sendPasswordResetMail(user.email, user.firstName, tokenPlain);
}

return NextResponse.json({ ok: true });
```

> **Email-Enumeration-Schutz:** Antwort ist konstant `{ ok: true }`, egal
> ob User existiert oder nicht. Frontend zeigt **immer** „Falls diese
> Adresse registriert ist, erhalten Sie eine E-Mail." — keine Differenzierung.

#### `POST /api/customer/reset-password`

```ts
// Body: { token: string, password: string, passwordConfirm: string }
const { token, password } = CustomerResetPasswordSchema.parse(await req.json());
const tokenHash = sha256Hex(token);

const result = await prisma.$transaction(async (tx) => {
  const row = await tx.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, customerId: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return { ok: false, code: 'INVALID_OR_EXPIRED_TOKEN' as const };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await tx.customerUser.update({
    where: { id: row.customerId },
    data: { passwordHash },
  });
  await tx.passwordResetToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return { ok: true as const };
});

if (!result.ok) {
  return apiError('INVALID_OR_EXPIRED_TOKEN', 410);
}
return NextResponse.json({ ok: true }); // KEIN passwordHash, KEIN customerUser-DTO
```

### 5.4 Email-Template (Resend)

Datei: `src/lib/mail.ts` erhält neue Funktion `sendPasswordResetMail()`.

Inhalt (Deutsch, Bärenstark-Branding):

```
Subject: Passwort zurücksetzen — Bärenstark Hausservice

Hallo {firstName},

Sie haben einen Passwort-Reset-Link angefordert.

Klicken Sie auf den folgenden Link, um Ihr Passwort zurückzusetzen
(gültig für 1 Stunde):

{NEXTAUTH_URL}/konto/passwort-zuruecksetzen?token={tokenPlain}

Falls Sie keinen Reset angefordert haben, ignorieren Sie diese E-Mail.

— Bärenstark Hausservice
   Tom Siefert · Darmstadt
```

HTML-Variante (Logo + Markenfarben Braun #6b3e2e / Beige #f4ebd9) — siehe
bestehender `mail.ts` für Vorlagen-Pattern.

### 5.5 Cleanup

Optional: Background-Cleanup-Skript `scripts/cleanup-expired-tokens.ts`
(Backlog). Für IT7 nicht zwingend — abgelaufene Tokens stören die App
nicht (Lookup filtert über `expiresAt`).

---

## 6. DTO-Garantie — F3 bleibt aktiv und wird erweitert

### 6.1 Verbindliche Field-Blacklist (Customer-DTOs)

`selectCustomerUserPublic()` in `src/lib/dto/user.ts` darf **niemals**
folgende Felder ausgeben:

| Feld | Grund |
|------|-------|
| `passwordHash` | Geheimnis. Nur intern für `hasPassword`-Ableitung gelesen, vor Response gemappt. |
| `verificationToken` | Geheimnis (single-use Klartext-Token). |
| `verificationTokenExpiry` | (Hint auf User-Existenz; bleibt intern.) |
| `adminNote` | F3 aus IT6 §17.3. |
| `adminRating` | F3 aus IT6 §17.3. |
| `oauthId` | Provider-spezifische ID — nicht customer-facing. |

Engineer-Eingriff in `src/lib/dto/user.ts`: Keine Schema-Änderung — der
bestehende Helper selektiert bereits korrekt. **Aber** der Mapper
`toCustomerPublic()` muss nach Migration explizit `verificationToken`
auch nicht durchschleusen (zur Sicherheit nochmal im `select`-Block
auslassen).

### 6.2 `scripts/check-dto-leaks.ts` — Blacklist erweitern

Aktueller AST-Scanner sucht nach `adminNote` und `adminRating`. IT7
ergänzt:

```ts
const FORBIDDEN_FIELDS = [
  'adminNote',
  'adminRating',
  'passwordHash',
  'verificationToken',
  // verificationTokenExpiry ist Bool-derivable, weniger sensibel — optional.
  'oauthId',
];
```

CI-Test in `tests/architecture/no-customer-dto-leak.test.ts` wird
parameter-basiert auf alle Felder ausgeweitet.

### 6.3 `CustomerUserPublicSchema.strict()` bleibt

Output-Validierung in `toCustomerPublic()` wirft, wenn ein Feld
unerwartet durchschlägt. IT7 setzt **keine neuen Felder** auf das
Public-Schema.

---

## 7. Auth-Trennung Customer vs. Admin

| Pfad | NextAuth-Instanz | Provider | Cookie |
|------|------------------|----------|--------|
| `/api/auth/[...nextauth]` | `lib/auth.ts` | Credentials (Admin-Login) | `next-auth.session-token` |
| `/api/auth/customer/[...nextauth]` | `lib/customer-oauth.ts` (umzubenennen → `customer-auth-config.ts`) | Credentials (Customer) **+** Google **+** Facebook | `__customer-next-auth.session-token` (60s TTL) |
| Custom Customer-Cookie | `lib/customer-auth.ts` (Edge-safe) | n/a | `customer-session` (langlebig, JWT, signiert) |

Die `customer-session`-Cookie wird ausschließlich von der Finalize-Route
`GET /api/customer/oauth-finalize` gesetzt (siehe IT5/§21.2.1). IT7
erweitert die Finalize-Route nicht — sie funktioniert für Credentials-
Login identisch (NextAuth-Session liefert `customerId`, Finalize signiert
das langlebige Cookie).

**Verbindlich:** keine Vermischung. Der Admin-NextAuth-Handler bleibt
auf Credentials. Der Customer-Handler hat ab IT7 drei Provider, läuft
aber dennoch durch dieselbe Finalize-Brücke.

---

## 8. Rate-Limits (IT7-Erweiterung)

`src/lib/ratelimit.ts` erhält neue Limiter-Instanzen:

| Limiter | Limit | Window | Schlüssel |
|---------|-------|--------|-----------|
| `customerRegisterLimiter` | 5 | 1h | `register:ip:<ip>` |
| `customerRegisterEmailLimiter` | 3 | 1h | `register:email:<lc-email>` |
| `customerLoginIpLimiter` | 10 | 1h | `customer-login:ip:<ip>` |
| `customerLoginEmailLimiter` | 5 | 1h | `customer-login:email:<lc-email>` |
| `forgotPasswordIpLimiter` | 3 | 15min | `forgot:ip:<ip>` |
| `forgotPasswordEmailLimiter` | 3 | 1h | `forgot:email:<lc-email>` |
| `resetPasswordIpLimiter` | 5 | 1h | `reset:ip:<ip>` |
| `verifyResendLimiter` | 3 | 1h | `verify-resend:email:<lc-email>` |

Bei Limit-Überschreitung: 429 mit `{ error: { code: 'RATE_LIMITED' } }`.
Ohne Upstash-Konfiguration sind Limiter No-Op (Dev-Mode), wie bestehend.

---

## 9. Migration `iteration_7_email_auth`

Datei: `prisma/migrations/20260503090000_iteration_7_email_auth/migration.sql`

```sql
-- 1. Neue Spalte emailVerifiedAt auf customer_users (optional, nullable).
ALTER TABLE customer_users ADD COLUMN emailVerifiedAt DATETIME;

-- 2. Alte Reset-Felder entfernen (waren in IT4 angelegt, IT7 ersetzt sie
--    durch eigene Tabelle). SQLite-Hinweis: ADD COLUMN ist trivial,
--    DROP COLUMN benötigt Tabelle-Recreate via PRAGMA. Für libSQL ist
--    DROP COLUMN ab v3.35 unterstützt — Engineering verifiziert.
ALTER TABLE customer_users DROP COLUMN resetToken;
ALTER TABLE customer_users DROP COLUMN resetTokenExpiry;

-- 3. Neue Tabelle password_reset_tokens.
CREATE TABLE password_reset_tokens (
  id         TEXT PRIMARY KEY,
  customerId TEXT NOT NULL,
  tokenHash  TEXT NOT NULL UNIQUE,
  expiresAt  DATETIME NOT NULL,
  usedAt     DATETIME,
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customer_users(id) ON DELETE CASCADE
);

CREATE INDEX password_reset_tokens_customerId_expiresAt_idx
  ON password_reset_tokens(customerId, expiresAt);
```

**Roll-out (verbindlich):**

1. Migration im Staging gegen leere DB testen.
2. In Prod: Migration **vor** dem Deploy von Phase B (T-B2/B3/B4) ziehen,
   damit der neue Code gegen das neue Schema läuft.
3. DTO-Leak-Scanner CI muss vor Merge grün sein.

---

## 10. ENV-Variablen IT7

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `ALLOW_ADMIN_PROMOTE` | nur für `scripts/promote-admin.ts` | Guard analog `ALLOW_USER_WIPE`. |
| `AUTH_SECRET` | **ja (Prod)** | NextAuth v5 — 32+ Zeichen. Pflicht. |
| `AUTH_TRUST_HOST` | **ja (Vercel/Tunnel)** | `"true"` damit NextAuth Host akzeptiert. |
| `NEXTAUTH_URL` | **ja** | exakt Produktions-Domain, kein Trailing-Slash. |
| `RESEND_API_KEY` | **ja (Prod)** | Verify- und Reset-Mails. |
| `MAIL_FROM` | **ja** | Bärenstark-Absenderadresse. |
| `GOOGLE_CLIENT_ID` / `_SECRET` | wenn Google aktiv | Provider-Konfiguration. |
| `FACEBOOK_CLIENT_ID` / `_SECRET` | wenn Facebook aktiv | Provider-Konfiguration. |

`.env.example` wird um `ALLOW_ADMIN_PROMOTE=""` ergänzt + Kommentar mit
Hinweis auf README.

---

## 11. Contract-Eingriffe

| Datei | Eingriff |
|-------|----------|
| `contracts/schema.prisma` | (a) `CustomerUser.emailVerifiedAt` neu (`DateTime?`). (b) `resetToken`, `resetTokenExpiry` entfernen. (c) Neues Model `PasswordResetToken` (siehe §5.1). (d) Backref `passwordResetTokens` auf CustomerUser. |
| `contracts/api-routes.md` | Neuer §23 „Iteration 7 — Email-Auth-Wiederherstellung": 6 wiederhergestellte Endpoints + `/api/auth/diagnose` + Rate-Limits aus §8 + ENV-Tabelle aus §10. Aufhebung der IT6-§14-Notiz „Endpoints liefern 404/410". |
| `contracts/zod-schemas.ts` | (a) `CustomerLoginResponseSchema.strict()` ergänzen falls nicht schon. (b) Neue `PasswordResetTokenInfoSchema` (intern, nicht exportiert in API). (c) Neue Fehlercodes `INVALID_OR_EXPIRED_TOKEN` (410), `EMAIL_ALREADY_REGISTERED` (409 — bestehend, nochmal dokumentieren). (d) Bestehende `CustomerRegisterSchema`/`CustomerLoginSchema`/`CustomerForgotPasswordSchema`/`CustomerResetPasswordSchema`/`CustomerVerifyTokenQuerySchema` bleiben **unverändert** — sie wurden in IT6 nicht entfernt, nur verwaist. |
| `src/lib/dto/user.ts` | Mapper-Kommentar erweitern + Field-Blacklist-Notiz im Doc-Block. |
| `scripts/check-dto-leaks.ts` | `FORBIDDEN_FIELDS` um `passwordHash`, `verificationToken`, `oauthId` ergänzen. |

---

## 12. Test-Plan (Pflicht-Smoke + Pressure)

### 12.1 Pflicht-Smoke (CI grün vor Merge)

| # | Test | Bezug |
|---|------|-------|
| S1 | `promote-admin.ts` ohne ENV → exit 1 | §1.4 |
| S2 | `promote-admin.ts` legt User an, `count(users) === 1`, `/api/admin/setup` antwortet 410 GONE | §1.5 + IT6 §17.1 |
| S3 | Customer-Register → 201 + Verify-Mail (Mock) | §4.3 |
| S4 | Customer-Login mit korrekten Credentials → Cookie gesetzt | §4.2 |
| S5 | Customer-Login ohne `emailVerified` → 200, NICHT 401 | §4.4 (Vorentscheidung) |
| S6 | Forgot-Password mit existierender Email → 200, Token in DB, Mail-Mock-Aufruf | §5.3 |
| S7 | Forgot-Password mit unbekannter Email → 200, **kein** Token in DB, **kein** Mail-Versand | §5.3 (Enumeration-Schutz) |
| S8 | Reset-Password mit gültigem Token → 200, neuer Hash, Token `usedAt` gesetzt | §5.3 |
| S9 | Reset-Password mit verwendetem Token → 410 INVALID_OR_EXPIRED_TOKEN | §5.3 |
| S10 | DTO-Leak-Scanner findet `passwordHash` in keinem Customer-Endpoint | §6.2 |
| S11 | `/api/auth/diagnose` in Prod → 404 | §2.1 |
| S12 | `/api/auth/diagnose` in Dev → 200 mit `providersActive` | §2.1 |

### 12.2 Pressure / Edge

| # | Test | Bezug |
|---|------|-------|
| P1 | 11 Login-Versuche in 1h von einer IP → 429 | §8 |
| P2 | 4 Forgot-Password mit gleicher Email in 1h → 429 | §8 |
| P3 | Race-Test: 2 parallele Forgot-Password für gleiche Email → beide produzieren je einen Token-Row, kein Konflikt | §5.3 |
| P4 | Race-Test: 2 parallele Reset-Password mit gleichem Token → genau einer 200, einer 410 (TOCTOU im `$transaction` greift) | §5.3 |
| P5 | Long-Token-Garbage in `?token=` → 410, kein Crash | §5.3 |
| P6 | Facebook-Login ohne Email → Redirect auf `/konto/login?error=oauth_no_email` | §3.2 |

---

## 13. Risiken und QA-Schwerpunkte

1. **DTO-Leak `passwordHash`:** höchstes Risiko. Jeder neue Endpoint
   muss `selectCustomerUserPublic()` benutzen. CI-Scanner muss am Tag des
   PRs grün sein.
2. **Migration-Drop-Column:** SQLite/libSQL — falls die Drop-Column-Syntax
   im Cloud-Build fehlschlägt, Fallback auf Tabelle-Recreate-Pattern.
3. **NextAuth-Cookie-Kollision:** Customer-NextAuth (§7) hat eigene
   Cookies. Wenn Engineer den Provider umbenennt, muss er sicherstellen,
   dass Admin-NextAuth (`/api/auth/[...nextauth]`) nicht versehentlich
   Customer-Cookies überschreibt.
4. **Email-Enumeration:** `forgot-password` muss konstant antworten.
   QA prüft Response-Body und Latenz (Side-Channel).
5. **Token-Hash-Format:** Engineer benutzt **SHA-256 hex digest**,
   nicht Base64 — `tokenHash`-Spalte ist 64-char fix; UNIQUE-Constraint
   würde sonst inkonsistent.
6. **`AUTH_SECRET` vs. `NEXTAUTH_SECRET`:** Beide müssen lesbar sein
   (NextAuth v5 akzeptiert beide). Wenn `AUTH_SECRET` leer ist und
   `NEXTAUTH_SECRET` gesetzt → muss funktionieren. Smoke-Test S11
   verifiziert das.
7. **Tom-Self-Service:** Der Diagnose-Endpoint muss dokumentiert sein
   (`/api/auth/diagnose` in Dev), damit Tom in einem Vercel-Preview-
   Build selbst die Provider-Aktivität checken kann.

---

## 14. Tom-Self-Service-Aktionen (zusammengefasst)

| Aktion | Zugang | Zweck |
|--------|--------|-------|
| Admin-Lock-out beheben | Terminal: `ALLOW_ADMIN_PROMOTE=true npx tsx scripts/promote-admin.ts <email> --password=<pwd>` | sofortige Wiederherstellung. |
| OAuth-Konfiguration prüfen | Browser: `/api/auth/diagnose` (nur Dev/Preview) | Live-Sicht auf ENV + Callbacks. |
| Google-OAuth-Probleme | Runbook `docs/AUTH_GOOGLE_FIX_RUNBOOK.md` TOP-5 Punkte | strukturierte Diagnose. |
| Facebook-OAuth-Probleme | Runbook (selbe Datei, Abschnitt „Facebook") | Meta-Portal-Checklist. |
| Eigenes Passwort ändern (nach Promote) | UI: `/admin/forgot-password` | Reset-Flow für Admins existiert seit IT5/US-30. |

---

## 15. Verlinkung zu IT6-Architektur

| IT6-Garantie | IT7-Status |
|--------------|------------|
| §17.1 F1 — Bootstrap-Allowlist | **bleibt aktiv** (Promote-Skript macht sie nicht obsolet). |
| §17.2 F2 — Letzter-Admin-Race | **unangetastet**. |
| §17.3 F3 — DTO-Leak strukturell | **erweitert** um `passwordHash`/`verificationToken` (siehe §6). |
| §17.5 m1 — Public-Reviews-Schema | **unangetastet**. |
| §17.10 m6 — Reihenfolge Wipe → Auth | **bleibt** für historische Refs; in IT7 nicht mehr relevant (kein Wipe). |

---

**Ende ARCHITECTURE_IT7.md**
