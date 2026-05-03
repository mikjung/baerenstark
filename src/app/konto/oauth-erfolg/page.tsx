/**
 * /konto/oauth-erfolg — Iteration 5 (US-31).
 *
 * Optionale Bestätigungsseite nach erfolgreichem OAuth-Login. Wird vom
 * Browser nur dann erreicht, wenn der `?oauth=success`-Param gesetzt ist
 * (siehe `oauth-finalize`-Route). Zeigt eine kurze Bestätigung und leitet
 * nach 2 Sekunden auf `/konto` weiter.
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OAuthSuccessClient } from './OAuthSuccessClient';

export const metadata: Metadata = {
  title: 'Anmeldung erfolgreich',
  description: 'Erfolgreich angemeldet bei Bärenstark Hausservice.',
  robots: { index: false, follow: false },
};

export default function OAuthSuccessPage() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-live="polite" className="px-4 py-12 text-center">
          Lade …
        </div>
      }
    >
      <OAuthSuccessClient />
    </Suspense>
  );
}
