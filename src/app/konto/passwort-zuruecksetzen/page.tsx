/**
 * /konto/passwort-zuruecksetzen — Iteration 6 / US-IT6-05.
 *
 * E-Mail/Passwort-Anmeldung wurde entfernt. Diese Seite leitet auf
 * `/konto/login` um.
 */

import { redirect } from 'next/navigation';

export const metadata = {
  robots: { index: false, follow: false },
};

export default function ResetRedirect() {
  redirect('/konto/login');
}
