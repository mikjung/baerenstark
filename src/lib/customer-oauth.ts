/**
 * NextAuth-Customer-Konfiguration für OAuth2-Login.
 *
 * Iteration 7 (US-IT7-01) — Email-Auth-Reaktivierung:
 *   Customer-Login funktioniert ab IT7 wieder per Email/Passwort,
 *   Google ODER Facebook. Die klassischen Customer-Endpoints
 *   (`/api/customer/{register,login,forgot-password,reset-password,
 *   verify,resend-verification}`) sind **wiederhergestellt**.
 *   Der eigentliche Email/Passwort-Login läuft über
 *   `POST /api/customer/login` (klassisch — setzt das langlebige
 *   `customer-session`-Cookie direkt). Der zusätzlich registrierte
 *   `Credentials`-Provider hier ist als alternative NextAuth-Brücke
 *   gedacht; `POST /api/customer/login` bleibt der primäre Pfad.
 *
 * Iteration 6 (US-IT6-05) — Auth-Bereinigung (historisch):
 *   Provider auf Google + Facebook reduziert. GitHub-Provider entfernt.
 *   IT7 fügt den Credentials-Provider zurück, parallel zu OAuth.
 *
 * Diese Instanz läuft separat vom Admin-NextAuth (siehe `lib/auth.ts`).
 *
 *   Pfad:               /api/auth/customer/[...nextauth]
 *   Provider:           Google + Facebook  (IT6 — vorher Google + GitHub)
 *   Session-Strategie:  JWT, kurze TTL (60s — Brücke zur Finalize-Route)
 *
 * Architektur-Hinweis (§18.2.4 ARCHITECTURE.md):
 *   Diese Instanz ist NUR der OAuth-Adapter. Die langlebige
 *   Kunden-Session lebt im Custom-JWT-Cookie `customer-session`
 *   (siehe `lib/customer-auth.ts`). Die Finalize-Route
 *   `GET /api/customer/oauth-finalize` setzt das Cookie nach
 *   erfolgreichem OAuth-Flow.
 *
 * Google-„Bad request"-Fix (US-IT6-05):
 *   - `trustHost: true` ist gesetzt (verhindert Vercel-Tunnel-Probleme).
 *   - Authorization-Scope ist explizit `openid email profile`.
 *   - `NEXTAUTH_URL` MUSS exakt der Produktions-Domain entsprechen
 *     (kein Trailing-Slash). Authorized Redirect URI in der
 *     Google Cloud Console: `${NEXTAUTH_URL}/api/auth/customer/callback/google`.
 *     Schritt-für-Schritt-Runbook: `docs/AUTH_GOOGLE_FIX_RUNBOOK.md`.
 *
 * Feature-Flag:
 *   Wenn weder `GOOGLE_CLIENT_ID` noch `FACEBOOK_CLIENT_ID` gesetzt sind,
 *   liefert die Konfiguration eine leere Provider-Liste. Die Routen-
 *   Handler in `app/api/auth/customer/[...nextauth]/route.ts` antworten
 *   dann mit 503 (siehe dort).
 */

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import type { NextAuthConfig } from 'next-auth';
import { prisma } from './prisma';
import {
  CUSTOMER_OAUTH_PROVIDERS,
  CustomerLoginSchema,
  OAuthProfileNormalizedSchema,
  type CustomerOAuthProvider,
  type OAuthProfileNormalized,
} from './schemas';
import { customerBaseUrl } from './baseUrl';

// Konstanter Bcrypt-Hash für Timing-Side-Channel-Schutz, wenn der User
// nicht existiert. Der Hash darf nicht matchen — es geht nur um konstante Last.
const DUMMY_BCRYPT_HASH =
  '$2a$10$CwTycUXWue0Thq9StjUM0uJ8j.zk8aYPX8Z5OTUyIzKb8C5nrYgtq';

// ---------------------------------------------------------------------------
// Feature-Flag
// ---------------------------------------------------------------------------

/**
 * `true`, wenn mindestens ein Provider konfiguriert ist UND der Engineer
 * das Feature nicht explizit per `FEATURE_OAUTH_LOGIN=false` deaktiviert hat.
 *
 * Iteration 6 (US-IT6-05): Google + Facebook (GitHub raus).
 */
export function isCustomerOAuthEnabled(): boolean {
  const flag = (process.env.FEATURE_OAUTH_LOGIN ?? '').toLowerCase();
  if (flag === 'false' || flag === '0') return false;

  const hasGoogle = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  const hasFacebook = !!(
    process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
  );
  return hasGoogle || hasFacebook;
}

// ---------------------------------------------------------------------------
// Profile-Normalisierung
// ---------------------------------------------------------------------------

interface RawProfileGoogle {
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
  sub?: string;
}

interface RawProfileFacebook {
  email?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  picture?: { data?: { url?: string } } | string | null;
  id?: string;
}

interface AccountSlim {
  provider?: string;
  providerAccountId?: string;
  // GitHub primary email lookup (Backlog) — placeholder.
}

function splitName(full: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const trimmed = (full ?? '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '—' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Normalisiert ein Provider-Profil auf `OAuthProfileNormalized`. Liefert
 * `null`, wenn essentielle Felder fehlen (z.B. keine E-Mail bei GitHub).
 */
export function normalizeProfile(
  provider: string,
  profile: unknown,
  account: AccountSlim | null,
): OAuthProfileNormalized | null {
  if (!profile || typeof profile !== 'object') return null;

  let candidate: Partial<OAuthProfileNormalized>;
  if (provider === 'google') {
    const p = profile as RawProfileGoogle;
    if (!p.email) return null;
    candidate = {
      provider: 'google',
      oauthId: p.sub ?? account?.providerAccountId ?? '',
      email: p.email,
      firstName:
        p.given_name?.trim() || splitName(p.name).firstName || 'Kunde',
      lastName:
        p.family_name?.trim() || splitName(p.name).lastName || '—',
      avatarUrl: p.picture ?? null,
    };
  } else if (provider === 'facebook') {
    const p = profile as RawProfileFacebook;
    if (!p.email) return null;
    const split = splitName(p.name);
    const picture =
      typeof p.picture === 'object' && p.picture && 'data' in p.picture
        ? p.picture.data?.url ?? null
        : typeof p.picture === 'string'
          ? p.picture
          : null;
    candidate = {
      provider: 'facebook',
      oauthId: account?.providerAccountId ?? (p.id ?? ''),
      email: p.email,
      firstName: p.first_name?.trim() || split.firstName || 'Kunde',
      lastName: p.last_name?.trim() || split.lastName || '—',
      avatarUrl: picture,
    };
  } else {
    return null;
  }

  const parsed = OAuthProfileNormalizedSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Account-Verknüpfungs-Logik (§18.2.3 + §18.9.2)
// ---------------------------------------------------------------------------

export type SignInOutcome =
  | { ok: true; customerId: string; email: string }
  | {
      ok: false;
      error:
        | 'oauth_unverified_conflict'
        | 'oauth_no_email'
        | 'oauth_error';
    };

/**
 * Lookup/Create + Linking-Sicherheits-Check. Idempotent (mehrfacher Aufruf
 * für denselben Profile liefert dasselbe CustomerUser-Tupel).
 */
export async function handleCustomerOAuthSignIn(
  provider: CustomerOAuthProvider,
  profile: OAuthProfileNormalized,
): Promise<SignInOutcome> {
  // 1. Provider-ID-Match (existierender OAuth-Login).
  let user = await prisma.customerUser.findFirst({
    where: { oauthProvider: provider, oauthId: profile.oauthId },
  });

  // 2. E-Mail-Match (existierender Account → potenzielle Verknüpfung).
  if (!user) {
    const lcEmail = profile.email.toLowerCase();
    const existing = await prisma.customerUser.findUnique({
      where: { email: lcEmail },
    });

    if (existing) {
      // SICHERHEIT (BUG-IT5-004): Unverifizierte lokale Konten dürfen NICHT
      // automatisch verknüpft werden — Hijacking-Schutz.
      if (!existing.emailVerified) {
        return { ok: false, error: 'oauth_unverified_conflict' };
      }

      // Verifiziertes Konto → sichere Verknüpfung. passwordHash bleibt
      // erhalten (Konto kann mit beiden Methoden weiter genutzt werden).
      user = await prisma.customerUser.update({
        where: { id: existing.id },
        data: {
          oauthProvider: provider,
          oauthId: profile.oauthId,
          avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
          // emailVerified bleibt true.
        },
      });
    }
  }

  // 3. Neuer Account (OAuth-only).
  if (!user) {
    try {
      user = await prisma.customerUser.create({
        data: {
          email: profile.email.toLowerCase(),
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: null,
          passwordHash: null,
          emailVerified: true,
          oauthProvider: provider,
          oauthId: profile.oauthId,
          avatarUrl: profile.avatarUrl ?? null,
        },
      });
    } catch (err) {
      // P2002 (Race auf email-Unique) → erneuter Lookup.
      const existing = await prisma.customerUser.findUnique({
        where: { email: profile.email.toLowerCase() },
      });
      if (!existing) {
        console.error('[customer-oauth] create + race-lookup failed:', err);
        return { ok: false, error: 'oauth_error' };
      }
      if (!existing.emailVerified) {
        return { ok: false, error: 'oauth_unverified_conflict' };
      }
      user = await prisma.customerUser.update({
        where: { id: existing.id },
        data: {
          oauthProvider: provider,
          oauthId: profile.oauthId,
          avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
        },
      });
    }
  }

  return { ok: true, customerId: user.id, email: user.email };
}

// ---------------------------------------------------------------------------
// NextAuth-Konfiguration
// ---------------------------------------------------------------------------

function buildProviders(): NextAuthConfig['providers'] {
  const providers: NextAuthConfig['providers'] = [];

  // IT7 / US-IT7-01 — Customer-Credentials-Provider zurück (parallel zu OAuth).
  // Der primäre Customer-Login läuft weiter über den klassischen Endpoint
  // `POST /api/customer/login` (setzt direkt das langlebige Cookie). Dieser
  // Credentials-Provider hier ist nur als alternative NextAuth-Brücke
  // konfiguriert, falls künftig die Finalize-Route auch Credentials-Logins
  // verarbeiten soll. `POST /api/customer/login` bleibt der Quellort der
  // Wahrheit und führt sein eigenes Rate-Limiting + Cookie-Handling aus.
  providers.push(
    Credentials({
      name: 'CustomerCredentials',
      credentials: {
        email: { label: 'E-Mail', type: 'email' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(creds) {
        const parsed = CustomerLoginSchema.safeParse(creds);
        if (!parsed.success) return null;
        const lc = parsed.data.email.toLowerCase();

        const user = await prisma.customerUser.findUnique({
          where: { email: lc },
          select: {
            id: true,
            email: true,
            passwordHash: true,
          },
        });
        if (!user || !user.passwordHash) {
          // Konstante bcrypt-Last (Timing-Side-Channel-Schutz).
          await bcrypt.compare(parsed.data.password, DUMMY_BCRYPT_HASH);
          return null;
        }
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        // F3-Schutz: NUR die nicht-sensiblen Felder ins Auth-Token reichen.
        // passwordHash, verificationToken etc. werden NIE durchgeschleust.
        return {
          id: user.id,
          email: user.email,
          customerId: user.id,
        };
      },
    }),
  );

  // Iteration 6 (US-IT6-05): Google + Facebook only. GitHub-Provider raus.
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // Explizit `openid email profile` — Google-„Bad request"-Fix
        // (US-IT6-05): falsche Scopes oder fehlendes `openid` triggern
        // den Fehler. Siehe `docs/AUTH_GOOGLE_FIX_RUNBOOK.md`.
        authorization: { params: { scope: 'openid email profile' } },
      }),
    );
  }
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push(
      FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        authorization: { params: { scope: 'email public_profile' } },
      }),
    );
  }
  return providers;
}

const customerOauthConfig: NextAuthConfig = {
  providers: buildProviders(),
  // Auth.js v5 verwendet sonst den Default-basePath `/api/auth`. Da der
  // Customer-Handler unter `/api/auth/customer/[...nextauth]` läuft, würde
  // `customer/csrf`, `customer/signin`, … als unbekannte Action geparst →
  // `UnknownAction: Cannot parse action at /api/auth/customer/csrf`.
  basePath: '/api/auth/customer',
  pages: {
    signIn: '/konto/login',
    error: '/konto/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60, // Kurzlebige Brücke zur Finalize-Route.
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  // IT7 / US-IT7-02: Debug-Mode in Dev — detaillierte NextAuth-Logs.
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async signIn({ account, profile }) {
      if (!account) return false;
      // IT7 / US-IT7-01 — Credentials-Provider signiert via authorize();
      // signIn ist hier transparent (no-op).
      if (account.provider === 'credentials') {
        return true;
      }
      if (!profile) return false;
      if (!CUSTOMER_OAUTH_PROVIDERS.includes(account.provider as CustomerOAuthProvider)) {
        return '/konto/login?error=oauth_error';
      }

      // GitHub: kein E-Mail freigegeben → spezifische Fehlermeldung.
      // Wir haben hier nur das Provider-Profile (kein Zugriff auf
      // /user/emails — Backlog).
      const provider = account.provider as CustomerOAuthProvider;
      const normalized = normalizeProfile(provider, profile, {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      });
      if (!normalized) {
        // Häufigster Fall: GitHub mit privater E-Mail.
        return '/konto/login?error=oauth_no_email';
      }

      const outcome = await handleCustomerOAuthSignIn(provider, normalized);
      if (!outcome.ok) {
        return `/konto/login?error=${outcome.error}`;
      }
      return true;
    },
    async jwt({ token, account, profile, user }) {
      // IT7 / US-IT7-01 — Credentials-Pfad: authorize() liefert {id,email,customerId}.
      if (account?.provider === 'credentials' && user) {
        token.customerId = (user as { customerId?: string; id: string }).customerId
          ?? (user as { id: string }).id;
        token.customerEmail = (user as { email?: string }).email ?? token.email;
        token.exp = Math.floor(Date.now() / 1000) + 60;
        return token;
      }
      if (account && profile) {
        const provider = account.provider as CustomerOAuthProvider;
        const normalized = normalizeProfile(provider, profile, {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });
        if (normalized) {
          const outcome = await handleCustomerOAuthSignIn(provider, normalized);
          if (outcome.ok) {
            token.customerId = outcome.customerId;
            token.customerEmail = outcome.email;
            // 60s TTL (vgl. session.maxAge).
            token.exp = Math.floor(Date.now() / 1000) + 60;
          } else {
            token.linkError = outcome.error;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session && token) {
        // Customer-spezifische Felder in die Session weitergeben.
        (session as { customerId?: string }).customerId =
          (token.customerId as string | undefined) ?? undefined;
        (session as { customerEmail?: string }).customerEmail =
          (token.customerEmail as string | undefined) ?? undefined;
      }
      return session;
    },
    async redirect() {
      // Open-Redirect-Schutz: externe `url`-Werte werden ignoriert.
      // Jeder erfolgreiche OAuth-Flow geht IMMER über die Finalize-Route.
      const base = customerBaseUrl();
      return `${base}/api/customer/oauth-finalize`;
    },
  },
  // Cookie-Pfad-Trennung: NextAuth setzt seine eigenen Cookies. Damit sie
  // nicht mit dem Admin-NextAuth kollidieren, geben wir einen eigenen
  // Cookie-Namen vor.
  cookies: {
    sessionToken: {
      name: '__customer-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: '__customer-next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: '__customer-next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};

export const {
  handlers: customerOAuthHandlers,
  auth: customerOAuthAuth,
  signIn: customerOAuthSignIn,
  signOut: customerOAuthSignOut,
} = NextAuth(customerOauthConfig);

// Re-Export für Tests.
export { customerOauthConfig };
