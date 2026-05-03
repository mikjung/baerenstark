/**
 * /konto/registrieren — Iteration 6 / US-IT6-05.
 *
 * Die separate Registrierungs-Seite gibt es nicht mehr: OAuth (Google /
 * Facebook) legt Kunden-Accounts automatisch an. Wir leiten alte Links
 * auf `/konto/login` um.
 */

import { redirect } from 'next/navigation';

export const metadata = {
  robots: { index: false, follow: false },
};

export default function RegisterRedirect() {
  redirect('/konto/login');
}
