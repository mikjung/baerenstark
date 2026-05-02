/**
 * /konto/passwort-vergessen — Forgot Password (US-25 AC5).
 *
 * Antwort ist immer "ok", egal ob die E-Mail registriert ist
 * (Enumeration-Schutz). Frontend zeigt eine generische Bestätigung.
 */

import type { Metadata } from 'next';
import { AuthCardShell } from '@/components/customer/AuthCardShell';
import { ForgotPasswordForm } from '@/components/customer/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Passwort zurücksetzen',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthCardShell
      title="Passwort vergessen?"
      subtitle="Trage deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen."
    >
      <ForgotPasswordForm />
    </AuthCardShell>
  );
}
