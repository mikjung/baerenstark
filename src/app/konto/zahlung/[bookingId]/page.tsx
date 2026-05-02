/**
 * /konto/zahlung/[bookingId] — Stripe-Checkout-Auslöser (US-28 AC2-5).
 *
 * Öffentlich erreichbar:
 *   - Eingeloggte Kunden: Cookie-basiert.
 *   - Gäste: müssen `?token=<cancelToken>` mitliefern (siehe Mail-Link).
 *
 * Lädt Booking-Infos + Payment-Betrag (für Eingeloggte via
 * `GET /api/customer/bookings/:id`, für Gäste via separater Lookup —
 * siehe Architektur). Im MVP zeigen wir für Gäste nur die minimal
 * notwendigen Infos und triggern direkt Stripe.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentClient } from '@/components/customer/PaymentClient';

export const metadata: Metadata = {
  title: 'Zahlung',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { bookingId: string };
  searchParams: { token?: string };
}

export default function PaymentPage({ params, searchParams }: PageProps) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Suspense
        fallback={
          <div role="status" aria-live="polite" className="text-sm text-baerenstark-bark/70">
            Lade Zahlungsinfos …
          </div>
        }
      >
        <PaymentClient bookingId={params.bookingId} cancelToken={searchParams.token} />
      </Suspense>
    </section>
  );
}
