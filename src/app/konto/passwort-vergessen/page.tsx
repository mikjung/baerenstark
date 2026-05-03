/**
 * /konto/passwort-vergessen — Iteration 7 / US-IT7-05.
 *
 * Reaktiviert nach IT6-D3-Reversion. Neutrales Email-Formular für den
 * Passwort-Reset-Flow.
 */

import type { Metadata } from 'next';
import { AuthCardShell } from '@/components/customer/AuthCardShell';
import { ForgotPasswordForm } from '@/components/customer/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Passwort vergessen',
  description: 'Setze dein Bärenstark-Passwort per E-Mail-Link zurück.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthCardShell
      title="Passwort zurücksetzen"
      subtitle="Geben Sie die E-Mail-Adresse Ihres Kontos ein. Wir schicken Ihnen einen Link zum Zurücksetzen."
    >
      <ForgotPasswordForm />
    </AuthCardShell>
  );
}
