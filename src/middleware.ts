/**
 * Edge-Middleware — schützt /admin/*, /api/admin/* und /konto/*.
 *
 * Iteration 4: zweite Schutz-Schicht für `/konto/*` mit eigener
 * `customer-session`-Cookie-Logik (siehe `lib/customer-auth.ts`).
 *
 * Iteration 14 / US-IT14-S02 — Defense-in-Depth Schicht 1:
 *   - Matcher um `/api/admin/*` erweitert. NextAuth liest weiterhin nur das
 *     Admin-Cookie (`__Secure-next-auth.session-token` / `next-auth.session-token`).
 *     Customer-Cookies haben einen eigenen Namen
 *     (`__customer-next-auth.session-token`) und werden hier ignoriert —
 *     ein eingeloggter Customer kommt also NICHT in die Admin-Sektion.
 *   - `/api/admin/**` ohne gültige Session → JSON-401 mit kanonischer
 *     Error-Shape `{ error: { code, message } }`. Sub-Whitelist für
 *     `/api/admin/setup`, `/api/admin/forgot-password`,
 *     `/api/admin/reset-password` und `/api/auth/*` (Bootstrap/Reset-Public).
 *   - `/admin/**` ohne Session → 302 auf `/admin/login` mit `callbackUrl`.
 *   - DISABLED-Status wird hier NICHT geprüft (kein DB-Lookup in Edge);
 *     das übernimmt die Schicht 3 — `requireAdmin()`/`requireActiveAdmin()`
 *     im Route-Handler bzw. der Server-Component-Layout.
 *
 * Edge-Sicherheit: hier laufen ausschließlich Edge-kompatible Module
 * (NextAuth-`auth.config.ts` ohne Prisma/bcrypt; `customer-auth.ts` nutzt
 * nur `jose`). Kein DB-Lookup — der findet im Route-Handler statt.
 */

import NextAuth from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import {
  readCustomerSessionFromRequest,
  safeCustomerCallback,
} from '@/lib/customer-auth';

const PUBLIC_ADMIN_PATHS = [
  '/admin/login',
  '/admin/setup',
  '/admin/passwort-vergessen',
  '/admin/passwort-reset',
];

/**
 * IT14 / S02 — Public-Whitelist für `/api/admin/**`. Diese Pfade sind
 * bewusst ohne Auth erreichbar:
 *   - /api/admin/setup           — Bootstrap der ersten Admin-Anlage.
 *   - /api/admin/forgot-password — Reset-Mail anfordern (ohne Login).
 *   - /api/admin/reset-password  — Reset-Token einlösen (ohne Login).
 * `/api/auth/*` (NextAuth-Routen für Admin- und Customer-Provider) MUSS
 * ebenfalls durchgereicht werden, sonst funktioniert Login nicht.
 */
const PUBLIC_ADMIN_API_PATHS = [
  '/api/admin/setup',
  '/api/admin/forgot-password',
  '/api/admin/reset-password',
];

const PUBLIC_KONTO_PATHS = [
  '/konto/login',
  '/konto/registrieren',
  '/konto/passwort-vergessen',
  '/konto/passwort-zuruecksetzen',
  '/konto/verifizieren',
];

const { auth } = NextAuth(authConfig);

/**
 * IT14 / S02 — kanonische 401-JSON-Response (Vertrag siehe
 * iteration-14.openapi.yaml + ARCHITECTURE_IT14.md §2.7). Identisch zu
 * `apiError({ code: 'UNAUTHORIZED', ... })` aus `src/lib/api.ts`.
 */
function jsonUnauthorized(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Bitte einloggen.',
      },
    },
    {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

async function handleKonto(req: NextRequest): Promise<Response | null> {
  const { pathname, search } = req.nextUrl;

  // /konto/zahlung/:id ist mit cancelToken auch für Gäste zugänglich
  // (Stripe-Mail-Link ohne Login-Pflicht). Ohne Token → wie sonst.
  if (pathname.startsWith('/konto/zahlung/')) {
    const token = req.nextUrl.searchParams.get('token');
    if (token) return NextResponse.next();
  }

  if (
    PUBLIC_KONTO_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  ) {
    return NextResponse.next();
  }

  const session = await readCustomerSessionFromRequest(req);
  if (session) return NextResponse.next();

  const loginUrl = new URL('/konto/login', req.nextUrl.origin);
  // safeCustomerCallback verhindert Open-Redirect-Schmuggel über das
  // pathname (kann theoretisch von Reverse-Proxy manipuliert werden).
  loginUrl.searchParams.set(
    'callbackUrl',
    safeCustomerCallback(`${pathname}${search}`),
  );
  return NextResponse.redirect(loginUrl);
}

export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;

  // /konto/* — IT4
  if (pathname.startsWith('/konto')) {
    const res = await handleKonto(req as unknown as NextRequest);
    if (res) return res;
    return NextResponse.next();
  }

  // /api/admin/* — IT14 / S02 Schicht 1: JSON-401 ohne Admin-Session.
  if (pathname.startsWith('/api/admin')) {
    const isPublicApi = PUBLIC_ADMIN_API_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (isPublicApi) return NextResponse.next();
    if (req.auth?.user) return NextResponse.next();
    return jsonUnauthorized();
  }

  if (!pathname.startsWith('/admin')) return NextResponse.next();

  // IT14 / S02 — Pfad als Header weiterreichen, damit der Server-Component-
  // Layout (`src/app/admin/layout.tsx`) zuverlässig zwischen Public- und
  // Auth-Pfaden unterscheiden kann (`usePathname()` ist client-only).
  // `headers()` in Server-Components liest `x-pathname` zurück.
  const forwardHeaders = new Headers(req.headers);
  forwardHeaders.set('x-pathname', pathname);

  const isPublicAdmin = PUBLIC_ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isPublicAdmin) {
    return NextResponse.next({ request: { headers: forwardHeaders } });
  }

  const isLoggedIn = !!req.auth?.user;
  if (isLoggedIn) {
    return NextResponse.next({ request: { headers: forwardHeaders } });
  }

  const loginUrl = new URL('/admin/login', req.nextUrl.origin);
  loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: [
    '/admin/:path*',
    '/konto/:path*',
    // IT14 / S02 — Defense-in-Depth Schicht 1 für die Admin-API.
    // Die einzelnen Route-Handler haben zusätzlich `requireAdmin()` (Schicht 3),
    // aber die Middleware blockiert hier schon vor dem Routing.
    '/api/admin/:path*',
  ],
};
