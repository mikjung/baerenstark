/**
 * /admin/users — Admin-Nutzerverwaltung (US-IT6-07).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireActiveAdmin } from '@/lib/require-admin';
import { UserTable } from '@/components/admin/users/UserTable';

export const metadata: Metadata = {
  title: 'Nutzerverwaltung',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  // D2: Status-Check (DISABLED → redirect /admin/login?error=account_disabled).
  await requireActiveAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <Link
          href="/admin"
          className="text-sm text-baerenstark-wood underline-offset-2 hover:underline"
        >
          ← Zum Admin-Dashboard
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
          Nutzerverwaltung
        </h1>
        <p className="mt-1 text-sm text-baerenstark-bark/70">
          Sieh alle registrierten Kunden, hinterlege interne Notizen und ein
          internes Admin-Rating. Diese Felder sind niemals für Kunden sichtbar.
        </p>
      </header>
      <UserTable />
    </div>
  );
}
