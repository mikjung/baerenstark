/**
 * /konto/zahlung/erfolg — Stripe-Redirect-Ziel (US-28).
 *
 * Liest `?session_id=...` und pollt `GET /api/payments/session-status`
 * (max 5×, 1s Intervall — siehe `PAYMENT_SESSION_POLL_*`).
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentSuccessClient } from '@/components/customer/PaymentSuccessClient';

export const metadata: Metadata = {
  title: 'Zahlungsbestätigung',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function PaymentSuccessPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Suspense
        fallback={
          <div role="status" aria-live="polite" className="text-sm text-baerenstark-bark/70">
            Zahlung wird bestätigt …
          </div>
        }
      >
        <PaymentSuccessClient />
      </Suspense>
    </section>
  );
}
