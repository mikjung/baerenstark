/**
 * /admin Layout — Server-Component-Wrapper.
 *
 * IT14 / US-IT14-S02 Defense-in-Depth Schicht 2:
 *   Für nicht-Public-Routen wird `requireActiveAdmin()` AUFGERUFEN, BEVOR
 *   die Page rendert. Damit:
 *     - DISABLED-Admins werden hier abgefangen (Middleware kann das nicht
 *       prüfen ohne DB-Lookup).
 *     - selbst wenn der Edge-Cache stale wäre, würde die Server-Component
 *       die Page nicht ausliefern.
 *
 * Public-Whitelist (kein Auth-Gate, keine Sidebar):
 *   /admin/login, /admin/setup, /admin/passwort-vergessen,
 *   /admin/passwort-reset.
 *
 * Path-Detection: die Edge-Middleware setzt einen `x-pathname`-Header für
 * alle `/admin/**`-Requests, der hier serverseitig ausgelesen wird.
 * `usePathname()` ist client-only und nicht verwendbar in Server-Components.
 *
 * Die Path-spezifische Sidebar-Logik lebt im Client-Wrapper
 * `<AdminAuthenticatedShell>`, der NUR für authentifizierte Routen gerendert
 * wird. Public-Routen liefern ihre Children direkt aus.
 */

import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { requireActiveAdmin } from '@/lib/require-admin';
import { AdminAuthenticatedShell } from '@/components/admin/AdminAuthenticatedShell';

const UNAUTHENTICATED_PREFIXES = [
  '/admin/login',
  '/admin/setup',
  '/admin/passwort-vergessen',
  '/admin/passwort-reset',
];

function isUnauthPath(pathname: string): boolean {
  if (!pathname) return false;
  return UNAUTHENTICATED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export default async function AdminRouteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const h = await headers();
  // Middleware schreibt `x-pathname`; Fallback-Header für Robustheit
  // (falls Middleware-Cache stale ist).
  const pathname =
    h.get('x-pathname') ??
    h.get('x-invoke-path') ??
    '';

  if (isUnauthPath(pathname)) {
    // Public — kein Auth-Gate, kein Sidebar (Login-/Setup-Pages haben
    // ihre eigene Layout-Behandlung in den Page-Komponenten).
    return <>{children}</>;
  }

  // IT14 / S02 — Schicht 2: serverseitige Auth-Verifikation. Schlägt der
  // Check fehl, ruft der Helper `redirect('/admin/login...')` auf — die
  // Page rendert dann nicht weiter. Greift insbesondere für DISABLED-
  // Admins (deren Cookie zwar gültig ist, aber `User.status !== 'ACTIVE'`).
  await requireActiveAdmin();

  return <AdminAuthenticatedShell>{children}</AdminAuthenticatedShell>;
}
