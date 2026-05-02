/**
 * /konto/passwort-reset — Passwort-Reset via Token (US-25 AC6).
 *
 * Liest `?token=xxx` aus der URL. Spec verlangt diesen Pfad zusätzlich zum
 * von Backend genutzten `/konto/passwort-zuruecksetzen`. Beide Wege landen
 * auf demselben Form.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCardShell } from '@/components/customer/AuthCardShell';
import { ResetPasswordForm } from '@/components/customer/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Neues Passwort setzen',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthCardShell
      title="Neues Passwort setzen"
      subtitle="Wähle ein neues Passwort mit mindestens 8 Zeichen."
    >
      <Suspense
        fallback={
          <div role="status" aria-live="polite" className="text-sm text-baerenstark-bark/70">
            Lade …
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthCardShell>
  );
}
