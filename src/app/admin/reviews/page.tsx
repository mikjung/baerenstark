/**
 * /admin/reviews — Bewertungs-Moderation (US-29 AC6).
 *
 * Auth-geschützt via Middleware. Server-Component prüft Session erneut
 * und rendert die Client-Tabelle mit Approve/Reject-Buttons.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireActiveAdmin } from '@/lib/require-admin';
import { ReviewModerationTable } from '@/components/admin/ReviewModerationTable';

export const metadata: Metadata = {
  title: 'Bewertungs-Moderation',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
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
          Bewertungs-Moderation
        </h1>
        <p className="mt-1 text-sm text-baerenstark-bark/70">
          Prüfe eingegangene Kunden-Bewertungen und gib sie für die Startseite frei.
        </p>
      </header>
      <ReviewModerationTable />
    </div>
  );
}
