/**
 * /konto/registrieren — Iteration 7 / US-IT7-01.
 *
 * Reaktiviert nach IT6-D3-Reversion: vollwertiges Email/Password-
 * Registrierungs-Formular. OAuth bleibt parallel über `/konto/login`
 * verfügbar.
 */

import type { Metadata } from 'next';
import { AuthCardShell } from '@/components/customer/AuthCardShell';
import { RegisterForm } from '@/components/customer/RegisterForm';

export const metadata: Metadata = {
  title: 'Registrieren',
  description: 'Erstelle dein Bärenstark-Kundenkonto mit E-Mail und Passwort.',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <AuthCardShell
      title="Konto erstellen"
      subtitle="Schön, dass du da bist. Mit deinem Konto kannst du Buchungen verwalten."
    >
      <RegisterForm />
    </AuthCardShell>
  );
}
