/**
 * /konto/passwort-zuruecksetzen — Passwort-Reset via Token (Architektur-
 * konformer Pfad, vom Backend in der Mail verlinkt). Renderdiese Seite
 * dieselbe Form wie /konto/passwort-reset.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCardShell } from '@/components/customer/AuthCardShell';
import { ResetPasswordForm } from '@/components/customer/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Neues Passwort setzen',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPageDe() {
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
