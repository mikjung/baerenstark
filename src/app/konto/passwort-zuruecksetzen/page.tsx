/**
 * /konto/passwort-zuruecksetzen — Iteration 7 / US-IT7-05.
 *
 * Reaktiviert nach IT6-D3-Reversion. Liest `?token=...` aus der URL und
 * verarbeitet den Reset über `POST /api/customer/reset-password`.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCardShell } from '@/components/customer/AuthCardShell';
import { ResetPasswordForm } from '@/components/customer/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Neues Passwort setzen',
  description: 'Wähle ein neues Passwort für dein Bärenstark-Konto.',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthCardShell
      title="Neues Passwort festlegen"
      subtitle="Wählen Sie ein sicheres Passwort für Ihr Konto."
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
        <ResetPasswordForm />
      </Suspense>
    </AuthCardShell>
  );
}
