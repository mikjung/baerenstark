/**
 * /konto/verifizieren — Iteration 7 / US-IT7-01.
 *
 * Reaktiviert nach IT6-D3-Reversion. Liest `?token=...` aus der URL und
 * ruft `GET /api/customer/verify` auf. Bei Erfolg → Redirect zu
 * `/konto/login?verified=1`. Bei abgelaufenem/verbrauchtem Token →
 * freundliche Meldung mit „Resend"-Option (für eingeloggte User).
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCardShell } from '@/components/customer/AuthCardShell';
import { VerifyEmailClient } from '@/components/customer/VerifyEmailClient';

export const metadata: Metadata = {
  title: 'E-Mail bestätigen',
  description: 'Bestätige deine E-Mail-Adresse für dein Bärenstark-Konto.',
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <AuthCardShell
      title="E-Mail bestätigen"
      subtitle="Wir prüfen deinen Bestätigungs-Link."
    >
      <Suspense
        fallback={
          <div
            role="status"
            aria-live="polite"
            className="text-sm text-baerenstark-bark/70"
          >
            Lade …
          </div>
        }
      >
        <VerifyEmailClient />
      </Suspense>
    </AuthCardShell>
  );
}
