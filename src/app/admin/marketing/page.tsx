/**
 * /admin/marketing — Marketing-E-Mail-Composer (IT12-S15).
 *
 * Server-Component: prüft Admin-Session, rendert Wizard-Client.
 */

import type { Metadata } from 'next';
import { requireActiveAdmin } from '@/lib/require-admin';
import { MarketingEmailComposer } from '@/components/admin/marketing/MarketingEmailComposer';

export const metadata: Metadata = {
  title: 'Marketing-Mails',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminMarketingPage() {
  await requireActiveAdmin();
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
          Marketing-Mails
        </h1>
        <p className="mt-1 text-sm text-baerenstark-bark/70">
          Senden Sie gezielte Werbe-E-Mails an Bestandskunden — DSGVO-konform
          mit Pflicht-Footer und Abmelde-Link.
        </p>
      </header>
      <MarketingEmailComposer />
    </div>
  );
}
