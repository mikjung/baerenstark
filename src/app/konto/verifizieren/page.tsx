/**
 * /konto/verifizieren — leitet den Verifikations-Token an das Backend weiter.
 *
 * Backend (`GET /api/customer/verify?token=...`) führt die Verifikation
 * serverseitig durch und macht einen 302 Redirect auf
 *   - `/konto?verified=1`  bei Erfolg
 *   - `/konto/login?error=invalid_token` bei ungültigem Token
 *
 * Diese Seite existiert hauptsächlich, um Usern mit alten Mail-Links eine
 * sinnvolle Antwort zu liefern, falls der Backend-Endpoint mal nicht mit
 * dem Frontend-Pfad übereinstimmt.
 */

import { redirect } from 'next/navigation';
import { Banner } from '@/components/ui/Banner';
import { AuthCardShell } from '@/components/customer/AuthCardShell';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { token?: string };
}

export default function VerifyPage({ searchParams }: PageProps) {
  const token = searchParams.token;
  if (token) {
    // Server-Component: 302 zum Backend-Endpoint weiterreichen.
    redirect(`/api/customer/verify?token=${encodeURIComponent(token)}`);
  }

  return (
    <AuthCardShell title="E-Mail bestätigen">
      <Banner tone="error" role="alert">
        Der Bestätigungslink ist unvollständig. Bitte öffne den Link aus der
        E-Mail, oder fordere einen neuen Link an.
      </Banner>
    </AuthCardShell>
  );
}
