'use client';

/**
 * BookingConfirmation — Initial-Bestätigungs-Page (US-IT11-03, neu in v3).
 *
 * Wird gerendert von `/buchung/bestaetigung/[bookingId]/page.tsx` (Server-
 * Component) NACH erfolgreichem Token-Verify und Public-Summary-Load.
 *
 * Inhalt (Spec frontend-requirements.md §`<BookingConfirmation>`):
 *   - Heading: „Anfrage erhalten — Tom meldet sich!"
 *   - Buchungsnummer: `#${id.slice(0, 8).toUpperCase()}`
 *   - Service-Label aus `getServiceLabel()`.
 *   - Datum + Uhrzeit aus `formatBerlinDateShort(date)` + `startTime`.
 *   - Status-Badge.
 *   - CTAs: „Zur Startseite", `tel:`-Link, „Eine weitere Anfrage stellen".
 *
 * Microcopy:
 *   - „Diesen Link 30 Tage aufbewahren — er ist Ihr Zugang zu Status und
 *     Stornierung."
 */

import Link from 'next/link';
import { CONTACT } from '@/lib/contact';
import { formatBerlinDateShort } from '@/lib/format';
import { getServiceLabel } from '@/lib/services';
import { OpenBookingDialogButton } from '@/components/booking/OpenBookingDialogButton';

interface BookingConfirmationProps {
  bookingId: string; // CUID, gekürzt anzeigen (erste 8 Zeichen)
  service: string; // Service-Slug
  date: string | null; // YYYY-MM-DD oder null bei Bestand-Buchungen
  startTime: string | null; // HH:MM
  status?: string; // optional: PENDING / CONFIRMED — für Status-Badge
  /** True wenn Submit gerade frisch passiert ist (?new=true). */
  isFresh?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Offen',
  CONFIRMED: 'Bestätigt',
  REJECTED: 'Abgelehnt',
  COUNTER_PROPOSED: 'Vorschlag ausstehend',
  CANCELLED: 'Storniert',
  COMPLETED: 'Abgeschlossen',
};

export function BookingConfirmation({
  bookingId,
  service,
  date,
  startTime,
  status,
  isFresh,
}: BookingConfirmationProps) {
  const shortId = bookingId.slice(0, 8).toUpperCase();
  const serviceLabel = getServiceLabel(service);
  const dateLabel = date ? formatBerlinDateShort(date) : null;
  const statusLabel = status ? STATUS_LABEL[status] ?? status : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <article
        role="status"
        aria-live="polite"
        aria-labelledby="booking-confirmation-heading"
        className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-soft sm:p-8"
      >
        <p
          aria-hidden="true"
          className="mb-2 text-3xl"
          title="Anfrage erhalten"
        >
          ✅
        </p>
        <h1
          id="booking-confirmation-heading"
          className="mb-3 font-serif text-2xl font-semibold text-baerenstark-bark sm:text-3xl"
        >
          {isFresh
            ? 'Anfrage erhalten — Tom meldet sich!'
            : 'Ihre Anfrage'}
        </h1>
        <p className="mb-5 text-base text-baerenstark-bark/85">
          {isFresh
            ? 'Vielen Dank! Wir melden uns innerhalb von 24 Stunden bei Ihnen.'
            : 'Hier finden Sie die Details zu Ihrer Anfrage.'}
        </p>

        <dl className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-baerenstark-sand/60 bg-baerenstark-cream/40 p-4 text-sm sm:grid-cols-2 sm:p-5">
          <div>
            <dt className="font-medium text-baerenstark-bark/70">Buchungsnummer</dt>
            <dd className="font-mono text-baerenstark-bark">#{shortId}</dd>
          </div>
          <div>
            <dt className="font-medium text-baerenstark-bark/70">Service</dt>
            <dd className="text-baerenstark-bark">{serviceLabel}</dd>
          </div>
          {dateLabel && (
            <div>
              <dt className="font-medium text-baerenstark-bark/70">Datum</dt>
              <dd className="text-baerenstark-bark">
                {dateLabel}
                {startTime && (
                  <>
                    {' · '}
                    {startTime} Uhr
                  </>
                )}
              </dd>
            </div>
          )}
          {statusLabel && (
            <div>
              <dt className="font-medium text-baerenstark-bark/70">Status</dt>
              <dd className="text-baerenstark-bark">{statusLabel}</dd>
            </div>
          )}
        </dl>

        <div className="mb-6 rounded-lg border-l-4 border-baerenstark-wood bg-baerenstark-sand/30 p-4 text-sm">
          <p className="font-medium text-baerenstark-bark">
            Diesen Link 30 Tage aufbewahren
          </p>
          <p className="mt-1 text-baerenstark-bark/80">
            Sie können diese Seite jederzeit erneut öffnen — der Link bleibt
            30 Tage gültig und ist Ihr Zugang zu Status und Stornierung.
            Telefonisch erreichbar:{' '}
            <a
              href={`tel:${CONTACT.phoneTel}`}
              className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
            >
              {CONTACT.phoneDisplay}
            </a>
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-cream shadow-soft transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
            aria-label={`Anrufen unter ${CONTACT.phoneDisplay}`}
          >
            <span aria-hidden="true">📞 </span>
            {CONTACT.phoneDisplay}
          </a>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border-2 border-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
          >
            Zur Startseite
          </Link>
          <OpenBookingDialogButton className="inline-flex items-center justify-center rounded-lg border border-baerenstark-wood/40 px-5 py-2.5 text-sm font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2">
            Eine weitere Anfrage stellen
          </OpenBookingDialogButton>
        </div>
      </article>
    </main>
  );
}
