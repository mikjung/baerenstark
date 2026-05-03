/**
 * /konto/verifizieren — Iteration 6 / US-IT6-05 (D3-Resolution).
 *
 * E-Mail/Passwort-Auth wurde komplett entfernt; Verifikations-Token gibt es
 * nicht mehr. Alte Mail-Links zeigen einen freundlichen Banner und leiten
 * auf das OAuth-Login um.
 */

import { redirect } from 'next/navigation';

export const metadata = {
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  redirect('/konto/login?error=legacy_credentials');
}
