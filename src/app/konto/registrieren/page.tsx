/**
 * /konto/registrieren — Kunden-Registrierung (US-25 AC1).
 *
 * Iteration 5 (US-31): RegisterForm liest `?error=oauth_*`-Params via
 * `useSearchParams` und braucht daher einen Suspense-Boundary.
 *
 * Layout: zentriertes Card-Layout, Logo oben, Braun/Beige.
 * Submit ruft `POST /api/customer/register` auf.
 * Bei Erfolg: Bestätigungs-Hinweis (E-Mail-Verifikation nötig).
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/customer/RegisterForm';
import { AuthCardShell } from '@/components/customer/AuthCardShell';

export const metadata: Metadata = {
  title: 'Konto erstellen',
  description: 'Erstelle ein Kundenkonto bei Bärenstark Hausservice.',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <AuthCardShell title="Konto erstellen" subtitle="Verwalte deine Aufträge zentral in deinem Bärenstark-Konto.">
      <Suspense
        fallback={
          <div role="status" aria-live="polite" className="text-sm text-baerenstark-bark/70">
            Lade …
          </div>
        }
      >
        <RegisterForm />
      </Suspense>
    </AuthCardShell>
  );
}
