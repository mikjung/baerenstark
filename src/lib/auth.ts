/**
 * NextAuth v5 Vollkonfiguration mit Credentials Provider (Node-only) für ADMIN-Login.
 *
 * Iteration 6 (US-IT6-01) Erweiterung:
 *   - Login bricht ab, wenn `User.status === 'DISABLED'` (lehnt mit
 *     ACCOUNT_DISABLED-Hint ab — Frontend zeigt Banner).
 *   - Bei erfolgreichem Login wird `user.lastLoginAt = now()` aktualisiert
 *     (best-effort, kein Crash bei Schreibfehler).
 *
 * Iteration 6 (US-IT6-05): Customer-Auth ist auf OAuth (Google + Facebook)
 * umgestellt; **dieser** NextAuth-Handler bleibt aber für Tom (Admin)
 * und nutzt weiter Credentials-Provider — kein Bruch.
 *
 * Edge-Middleware importiert NICHT diese Datei, sondern `auth.config.ts` —
 * sonst zieht bcryptjs / Prisma in den Edge-Build, was Warnings produziert.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { authConfig } from './auth.config';
import { prisma } from './prisma';
import { LoginSchema } from './schemas';
import { loginLimiter, getClientIp } from './ratelimit';

// Konstanter Bcrypt-Hash für Timing-Side-Channel-Schutz, wenn der User nicht
// existiert. Der Hash darf gar nicht matchen — es geht nur um konstante Last.
const DUMMY_BCRYPT_HASH =
  '$2a$10$CwTycUXWue0Thq9StjUM0uJ8j.zk8aYPX8Z5OTUyIzKb8C5nrYgtq';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'E-Mail', type: 'email' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(credentials) {
        // Rate-Limit (BUG-004) — no-op ohne Upstash-Konfig.
        try {
          const reqHeaders = await headers();
          const ip = getClientIp(reqHeaders as unknown as Headers);
          const limitRes = await loginLimiter.limit(`login:${ip}`);
          if (!limitRes.success) {
            // NextAuth wandelt das in ?error=RateLimited um (siehe authConfig).
            throw new Error('RateLimited');
          }
        } catch (err) {
          if (err instanceof Error && err.message === 'RateLimited') throw err;
          // headers() schlägt nur in Edge-Kontexten fehl; in dem Fall verzichten
          // wir auf Rate-Limit (Fallback ist im ARCHITECTURE-Doc dokumentiert).
        }

        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user) {
          // Konstante Bcrypt-Last gegen Timing-Side-Channel.
          await bcrypt.compare(parsed.data.password, DUMMY_BCRYPT_HASH);
          return null;
        }

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        // IT6 / US-IT6-01: DISABLED-Konten werden abgelehnt (?error=ACCOUNT_DISABLED).
        if (user.status === 'DISABLED') {
          throw new Error('ACCOUNT_DISABLED');
        }

        // IT6 / US-IT6-01: lastLoginAt aktualisieren (best-effort).
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[auth] failed to update lastLoginAt:', err);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
});
