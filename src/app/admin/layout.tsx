'use client';

/**
 * /admin Layout — wickelt alle Admin-Routen in `<AdminLayout>` (Sidebar +
 * Welcome-Banner, IT12-S14). Ausnahmen: Login, Setup, Passwort-Reset —
 * dort wird der Sidebar nicht angezeigt (keine Auth-Session vorhanden).
 */

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';

const UNAUTHENTICATED_PREFIXES = [
  '/admin/login',
  '/admin/setup',
  '/admin/passwort-vergessen',
  '/admin/passwort-reset',
];

export default function AdminRouteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const isUnauth = UNAUTHENTICATED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isUnauth) {
    return <>{children}</>;
  }
  return <AdminLayout>{children}</AdminLayout>;
}
