/**
 * /admin/calendar — Outlook/Google-Style Admin-Kalender (US-IT6-02).
 *
 * Server-Component: prüft Session, leitet zu /admin/login um, falls
 * nicht authentifiziert. Rendert die Client-Calendar-View.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireActiveAdmin } from '@/lib/require-admin';
import { AdminCalendarView } from '@/components/admin/AdminCalendarView';

export const metadata: Metadata = {
  title: 'Kalender',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCalendarPage() {
  // D2: Status-Check (DISABLED → redirect /admin/login?error=account_disabled).
  await requireActiveAdmin();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <Link
          href="/admin"
          className="text-sm text-baerenstark-wood underline-offset-2 hover:underline"
        >
          ← Zum Admin-Dashboard
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
          Kalender
        </h1>
        <p className="mt-1 text-sm text-baerenstark-bark/70">
          Wochen-, Tages- und Monatsansicht aller Buchungen, Buffer und
          Verfügbarkeitsfenster. Klicke auf einen freien Bereich, um einen
          neuen Slot anzulegen.
        </p>
      </header>
      <AdminCalendarView />
    </div>
  );
}
