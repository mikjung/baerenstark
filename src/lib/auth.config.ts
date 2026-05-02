/**
 * Edge-sichere NextAuth-Basiskonfiguration.
 *
 * Diese Datei wird von src/middleware.ts importiert und MUSS daher Edge-Runtime-
 * kompatibel bleiben (kein bcrypt, kein Prisma, kein Node-only-Code).
 * Der eigentliche Provider mit DB-Zugriff lebt in `src/lib/auth.ts`.
 */

import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  session: {
    strategy: 'jwt' as const,
    maxAge: 24 * 60 * 60, // 24h
    updateAge: 60 * 60, // sliding refresh: 1h
  },
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  trustHost: true,
  providers: [],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // BUG-005: same-origin Policy für callbackUrl.
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        const target = new URL(url);
        if (target.origin === baseUrl) return target.toString();
      } catch {
        /* fall through */
      }
      return `${baseUrl}/admin`;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        if (user.email) token.email = user.email;
        if (user.name) token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) ?? token.sub ?? '';
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/setup'];
      const isPublicAdmin = PUBLIC_ADMIN_PATHS.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
      if (pathname.startsWith('/admin')) {
        if (isPublicAdmin) return true;
        return !!auth?.user;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
