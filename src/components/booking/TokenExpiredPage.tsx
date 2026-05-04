'use client';

/**
 * TokenExpiredPage — wiederverwendbare Hinweis-Page für abgelaufene oder
 * ungültige Booking-Tokens (Confirmation-Flow ODER Cancellation-Flow).
 *
 * Spec:
 *   - frontend-requirements.md §`<TokenExpiredPage>`
 *   - ARCHITECTURE_IT11.md §3.2 (Token-Expiry-Fallback) + §6.7
 *
 * Wird von Server-Components gerendert (`/buchung/bestaetigung/[id]/page.tsx`,
 * `/buchung/[id]/stornieren/page.tsx`), wenn der Token-Verify fehlschlägt.
 *
 * Inhalt:
 *   - Heading („Link abgelaufen" oder „Stornierungslink abgelaufen")
 *   - Body „Bitte rufen Sie uns direkt an"
 *   - `tel:`-CTA mit Toms Telefonnummer
 *   - Sekundärer Link „Zur Startseite"
 *   - Optional: „Neue Anfrage stellen"-Button (öffnet Booking-Modal,
 *     Empfehlung Q7 aus frontend-requirements.md).
 */

import Link from 'next/link';
import { CONTACT } from '@/lib/contact';
import { OpenBookingDialogButton } from './OpenBookingDialogButton';

interface TokenExpiredPageProps {
  /** Welcher Flow ist betroffen — bestimmt die Microcopy. */
  flow: 'confirmation' | 'cancellation';
}

export function TokenExpiredPage({ flow }: TokenExpiredPageProps) {
  const isCancellation = flow === 'cancellation';
  const heading = isCancellation
    ? 'Stornierungslink abgelaufen'
    : 'Link abgelaufen';
  const body = isCancellation
    ? 'Dieser Stornierungslink ist nicht mehr gültig (Gültigkeit: 30 Tage). Bitte rufen Sie uns direkt an, damit wir Ihre Anfrage stornieren können:'
    : 'Dieser Link ist nicht mehr gültig (Gültigkeit: 30 Tage). Bitte rufen Sie uns direkt an, falls Sie Ihre Anfrage einsehen möchten:';

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:py-16">
      <article
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-soft sm:p-8"
      >
        <h1 className="mb-3 font-serif text-2xl font-semibold text-baerenstark-bark sm:text-3xl">
          {heading}
        </h1>
        <p className="mb-5 text-base text-baerenstark-bark/85">{body}</p>

        <a
          href={`tel:${CONTACT.phoneTel}`}
          className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-6 py-3 text-base font-medium text-baerenstark-cream shadow-soft transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
          aria-label={`Anrufen unter ${CONTACT.phoneDisplay}`}
        >
          <span aria-hidden="true">📞 </span>
          {CONTACT.phoneDisplay}
        </a>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-baerenstark-wood underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
          >
            Zur Startseite
          </Link>
          {!isCancellation && (
            <OpenBookingDialogButton className="text-baerenstark-wood underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent">
              Neue Anfrage stellen
            </OpenBookingDialogButton>
          )}
        </div>

        <p className="mt-6 border-t border-baerenstark-sand/60 pt-4 text-xs text-baerenstark-bark/60">
          Diesen Link erhalten Sie 30 Tage lang in Ihrer Bestätigungs-E-Mail.
          Falls Sie nicht mehr darauf zugreifen können, wenden Sie sich bitte
          telefonisch an uns.
        </p>
      </article>
    </main>
  );
}
