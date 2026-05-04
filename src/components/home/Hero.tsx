'use client';

/**
 * Hero — Startseite-Header.
 *
 * IT11 / US-IT11-02:
 *   - Primärer CTA „Jetzt Termin buchen" öffnet jetzt das globale Booking-
 *     Modal über `useBookingDialog().open()` statt zu `/buchung` zu
 *     navigieren.
 *   - Sekundärer Tel-CTA bleibt unverändert.
 */

import Image from 'next/image';
import { useBookingDialog } from '@/components/booking/use-booking-dialog';
import { CONTACT } from '@/lib/contact';

export function Hero() {
  const { open } = useBookingDialog();

  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-gradient-to-b from-baerenstark-cream to-baerenstark-sand/40"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-2 md:items-center md:py-20">
        <div className="order-2 md:order-1">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-baerenstark-wood">
            {CONTACT.region}
          </p>
          <h1
            id="hero-title"
            className="mb-4 font-serif text-3xl font-bold leading-tight text-baerenstark-bark sm:text-4xl md:text-5xl"
          >
            Ihr Haus in bärenstarken Händen!
          </h1>
          <p className="mb-6 text-base text-baerenstark-bark/80 sm:text-lg">
            Entrümpelung, Entkernung, Reinigung, Grünflächenpflege und mehr —
            zuverlässig, fair und transparent von {CONTACT.ownerName}.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => open()}
              aria-haspopup="dialog"
              className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-6 py-3 text-base font-medium text-baerenstark-cream shadow-soft transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
            >
              Jetzt Termin buchen
            </button>
            <a
              href={`tel:${CONTACT.phoneTel}`}
              className="inline-flex items-center justify-center rounded-lg border-2 border-baerenstark-wood px-6 py-3 text-base font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
              aria-label={`Anrufen unter ${CONTACT.phoneDisplay}`}
            >
              <span aria-hidden="true">📞 </span>
              {CONTACT.phoneDisplay}
            </a>
          </div>
        </div>
        <div className="order-1 flex items-center justify-center md:order-2">
          <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-baerenstark-sand bg-white/60 p-6 shadow-card">
            <Image
              src="/logo.png"
              alt="Logo Bärenstark Hausservice"
              fill
              sizes="(max-width: 768px) 80vw, 400px"
              className="object-contain p-6"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
