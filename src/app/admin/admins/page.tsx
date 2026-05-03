/**
 * /admin/admins — Admin-Verwaltung (US-IT6-01).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireActiveAdmin } from '@/lib/require-admin';
import { AdminUserTable } from '@/components/admin/admins/AdminUserTable';

export const metadata: Metadata = {
  title: 'Admin-Verwaltung',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminAdminsPage() {
  // D2: Status-Check (DISABLED → redirect /admin/login?error=account_disabled).
  const me = await requireActiveAdmin();
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
          Admin-Verwaltung
        </h1>
        <p className="mt-1 text-sm text-baerenstark-bark/70">
          Lege weitere Admins an, deaktiviere oder lösche bestehende Konten.
          Mindestens ein aktiver Admin muss immer vorhanden sein.
        </p>
      </header>
      <AdminUserTable currentAdminId={me.id} />
    </div>
  );
}
