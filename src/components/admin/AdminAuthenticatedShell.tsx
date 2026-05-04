'use client';

/**
 * IT14 / US-IT14-S02 — Client-Wrapper für authentifizierte Admin-Pages.
 *
 * Der Server-Component-Layout (`src/app/admin/layout.tsx`) hat bereits
 * `requireActiveAdmin()` aufgerufen — wenn dieser Component rendert, ist
 * eine gültige Admin-Session garantiert. Hier setzen wir nur das
 * UI-Shell (`<AdminLayout>` mit Sidebar + Welcome-Banner).
 *
 * Das Bestand-`AdminLayout`-Component ist client-side (Sidebar nutzt
 * `usePathname()` für aktive Markierung) — daher muss dieser Wrapper
 * `'use client'` sein.
 */

import { ReactNode } from 'react';
import { AdminLayout } from './AdminLayout';

interface Props {
  children: ReactNode;
}

export function AdminAuthenticatedShell({ children }: Props) {
  return <AdminLayout>{children}</AdminLayout>;
}
