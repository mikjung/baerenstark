/**
 * /admin/analytics — Analytics-Übersicht (US-IT6-09).
 *
 * Server-Component prüft Session, Client-Komponente liest die Daten via
 * `GET /api/admin/analytics?range=`. Spec sieht alternativ einen direkten
 * `lib/analytics.ts`-Server-Import vor; im MVP nutzen wir den API-Roundtrip,
 * weil das Backend `lib/analytics.ts` parallel baut.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireActiveAdmin } from '@/lib/require-admin';
import { AnalyticsDashboard } from '@/components/admin/analytics/AnalyticsDashboard';

export const metadata: Metadata = {
  title: 'Analytics',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
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
          Analytics
        </h1>
        <p className="mt-1 text-sm text-baerenstark-bark/70">
          Umsatz, Buchungsvolumen und Service-Performance auf einen Blick.
        </p>
      </header>
      <AnalyticsDashboard />
    </div>
  );
}
