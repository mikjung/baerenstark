/**
 * Iteration 6 / US-IT6-01 — Server-Side-Authorization-Helper für Admin-Routen.
 *
 * Prüft Session UND `User.status === 'ACTIVE'`. Disabled-Admins werden
 * abgelehnt (FORBIDDEN), auch wenn sie noch ein gültiges Cookie haben.
 *
 * Es gibt ZWEI Varianten:
 *   - `requireAdmin()`         — für API-Route-Handler unter
 *                                src/app/api/admin/[...]/route.ts.
 *                                Liefert eine `RequireAdminResult` zurück: bei Fehler
 *                                ein Response-Objekt, das der Caller direkt zurückgibt.
 *   - `requireActiveAdmin()`   — für Server-Components / Page-Routes unter
 *                                src/app/admin/[...]/page.tsx. Wirft per
 *                                `redirect()` (Next.js) zur Login-Seite, wenn
 *                                Session fehlt oder Status !== 'ACTIVE'.
 *
 * D2 (QA IT6): Page-Components dürfen sich NICHT mehr nur auf
 * `await auth()` verlassen — ein DISABLED-Admin mit gültigem Cookie würde
 * sonst Page-Shells öffnen und nur API-Calls als 403 sehen (schlechte UX +
 * Info-Leak). Page-Components rufen daher `await requireActiveAdmin()` als
 * ersten Befehl in der `default async function`.
 *
 * Verwendung im API-Handler:
 *
 *   const me = await requireAdmin();
 *   if ('error' in me) return me.error;
 *   // me.id, me.email, me.name verfügbar
 *
 * Verwendung in einer Page (Server-Component):
 *
 *   export default async function AdminUsersPage() {
 *     const me = await requireActiveAdmin();
 *     return <UserTable currentAdminId={me.id} />;
 *   }
 *
 * `requireActiveAdmin()` wirft NIE — bei FAIL macht Next.js intern einen
 * Redirect und die Server-Component rendert nicht weiter.
 */

import { redirect } from 'next/navigation';
import { auth } from './auth';
import { prisma } from './prisma';
import { apiError } from './api';

export interface AdminPrincipal {
  id: string;
  email: string;
  name: string;
}

export type RequireAdminResult =
  | AdminPrincipal
  | { error: Response };

/**
 * Lädt die Admin-Session aus NextAuth. Wenn keine Session vorhanden →
 * 401 UNAUTHORIZED. Wenn der zugehörige `User.status !== 'ACTIVE'` →
 * 403 FORBIDDEN (Code-String passt zur Frontend-Hint).
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: apiError({
        code: 'UNAUTHORIZED',
        message: 'Bitte einloggen.',
      }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, status: true },
  });
  if (!user) {
    return {
      error: apiError({
        code: 'UNAUTHORIZED',
        message: 'Account nicht gefunden.',
      }),
    };
  }
  if (user.status !== 'ACTIVE') {
    return {
      error: apiError({
        code: 'FORBIDDEN',
        message: 'Ihr Konto wurde deaktiviert. Bitte wenden Sie sich an Tom Siefert.',
      }),
    };
  }

  return { id: user.id, email: user.email, name: user.name };
}

/**
 * Hilfs-Type-Guard für Konsumenten.
 */
export function isAdminError(
  result: RequireAdminResult,
): result is { error: Response } {
  return 'error' in result;
}

/**
 * Page-Variante: für Server-Components unter src/app/admin/[...]/page.tsx.
 *
 * Verhalten:
 *   - Keine Session              → `redirect('/admin/login')`.
 *   - Session-User existiert nicht (Race nach Wipe) → `redirect('/admin/login?error=session_invalid')`.
 *   - `status !== 'ACTIVE'`      → `redirect('/admin/login?error=account_disabled')`.
 *   - OK                         → gibt das `AdminPrincipal` zurück.
 *
 * `redirect()` aus `next/navigation` wirft intern einen Sentinel-Error,
 * den Next.js fängt und zu einer 307-Redirect-Response macht. Daher kommt
 * der Aufrufer im Erfolgsfall normal weiter, im Fehlerfall rendert die
 * Page nicht.
 *
 * Architecture-Anker: §3.1 / §12.1 / §17.2 / D2-Resolution.
 */
export async function requireActiveAdmin(): Promise<AdminPrincipal> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/admin/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, status: true },
  });
  if (!user) {
    redirect('/admin/login?error=session_invalid');
  }
  if (user.status !== 'ACTIVE') {
    redirect('/admin/login?error=account_disabled');
  }

  return { id: user.id, email: user.email, name: user.name };
}
