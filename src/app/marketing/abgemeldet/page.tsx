/**
 * IT12 / US-IT12-15 — Bestätigungsseite für Marketing-Mail-Abmeldung.
 *
 * Public Page. Wird angesteuert vom HMAC-Unsubscribe-Endpoint
 * (`/api/customer/unsubscribe`) per 302-Redirect:
 *   - `?ok=1`            → "Sie wurden erfolgreich abgemeldet."
 *   - `?error=invalid`   → "Token ungültig oder abgelaufen."
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.3 + §R.5.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Marketing-Abmeldung',
  description:
    'Bestätigung der Abmeldung von Marketing-E-Mails von Bärenstark Hausservice.',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: { ok?: string; error?: string };
}

export default function MarketingUnsubscribedPage({ searchParams }: PageProps) {
  const isOk = searchParams.ok === '1';
  const isError = searchParams.error === 'invalid';

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-baerenstark-bark/10 bg-white p-8 shadow-sm">
        {isOk && (
          <>
            <h1 className="mb-4 font-serif text-2xl font-bold text-baerenstark-bark sm:text-3xl">
              Sie wurden erfolgreich abgemeldet
            </h1>
            <p className="mb-4 text-baerenstark-bark/90">
              Sie erhalten ab sofort keine weiteren Marketing-E-Mails von uns.
              Transaktionale E-Mails (z. B. Bestätigungen Ihrer Buchungen) sind
              davon nicht betroffen.
            </p>
            <p className="text-sm text-baerenstark-bark/70">
              Falls dies ein Versehen war, melden Sie sich bitte direkt bei uns
              — wir können Ihre Marketing-Einwilligung manuell wiederherstellen.
            </p>
          </>
        )}

        {isError && (
          <>
            <h1 className="mb-4 font-serif text-2xl font-bold text-baerenstark-bark sm:text-3xl">
              Abmelde-Link ungültig
            </h1>
            <p className="mb-4 text-baerenstark-bark/90">
              Der Abmelde-Link ist ungültig oder abgelaufen. Bitte verwenden Sie
              den Link aus Ihrer letzten E-Mail oder kontaktieren Sie uns direkt.
            </p>
          </>
        )}

        {!isOk && !isError && (
          <>
            <h1 className="mb-4 font-serif text-2xl font-bold text-baerenstark-bark sm:text-3xl">
              Marketing-Abmeldung
            </h1>
            <p className="mb-4 text-baerenstark-bark/90">
              Diese Seite wird normalerweise über den Abmelde-Link in einer
              Marketing-E-Mail aufgerufen.
            </p>
          </>
        )}

        <div className="mt-6 flex gap-4">
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-baerenstark-amber px-4 py-2 text-sm font-medium text-baerenstark-bark hover:bg-baerenstark-amber/90"
          >
            Zur Startseite
          </Link>
          <Link
            href="/impressum"
            className="inline-flex items-center rounded-md border border-baerenstark-bark/20 px-4 py-2 text-sm font-medium text-baerenstark-bark hover:bg-baerenstark-bark/5"
          >
            Impressum
          </Link>
        </div>
      </div>
    </main>
  );
}
