/**
 * /konto — Kundenportal Dashboard (US-26).
 *
 * Zeigt Willkommens-Header + Buchungsübersicht (bevorstehend / vergangen).
 * Stornierungen (US-27) und Bewertungen (US-29) sind in den jeweiligen
 * Karten-Komponenten integriert.
 *
 * Server-Component, prüft Session über `/api/customer/me`. Bei 401 → Redirect
 * auf `/konto/login` (auch wenn die Edge-Middleware das schon tut — Tiefe-
 * Verteidigung).
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CustomerDashboard } from '@/components/customer/CustomerDashboard';
import { getServerCustomer } from '@/lib/customer-session';

export const metadata: Metadata = {
  title: 'Mein Konto',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { verified?: string };
}

export default async function KontoPage({ searchParams }: PageProps) {
  const me = await getServerCustomer();
  if (!me) {
    redirect('/konto/login');
  }
  const justVerified = searchParams.verified === '1';

  return <CustomerDashboard customer={me} justVerified={justVerified} />;
}
