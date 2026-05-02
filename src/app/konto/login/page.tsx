/**
 * /konto/login — Kunden-Login (US-25 AC3, AC4).
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/customer/LoginForm';
import { AuthCardShell } from '@/components/customer/AuthCardShell';

export const metadata: Metadata = {
  title: 'Anmelden',
  description: 'Melde dich mit deinem Bärenstark-Konto an.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthCardShell title="Anmelden" subtitle="Schön, dich wieder zu sehen.">
      <Suspense
        fallback={
          <div role="status" aria-live="polite" className="text-sm text-baerenstark-bark/70">
            Lade …
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthCardShell>
  );
}
