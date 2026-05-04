'use client';

/**
 * Header — globale Navigation.
 *
 * IT11 / US-IT11-02:
 *   - Der „Termin buchen"-CTA ist jetzt ein Button, der über den
 *     `useBookingDialog()`-Hook das globale Booking-Modal öffnet — kein
 *     `<Link href="/buchung">` mehr.
 *   - Die `/buchung`-Seite bleibt als Fallback (SEO + JS-Off-Browser +
 *     direkter URL-Aufruf).
 */

import Image from 'next/image';
import Link from 'next/link';
import { CustomerHeaderMenu } from '@/components/customer/CustomerHeaderMenu';
import { useBookingDialog } from '@/components/booking/use-booking-dialog';
import { CONTACT } from '@/lib/contact';

export function Header() {
  const { open } = useBookingDialog();

  return (
    <header className="sticky top-0 z-30 border-b border-baerenstark-sand/60 bg-baerenstark-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
          aria-label="Bärenstark Hausservice — Startseite"
        >
          <Image
            src="/logo.png"
            alt=""
            width={48}
            height={48}
            className="h-10 w-10 rounded-md object-contain sm:h-12 sm:w-12"
            priority
          />
          <span className="font-serif text-lg font-bold text-baerenstark-bark sm:text-xl">
            Bärenstark <span className="hidden sm:inline">Hausservice</span>
          </span>
        </Link>
        <nav aria-label="Hauptnavigation" className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => open()}
            aria-haspopup="dialog"
            className="rounded-lg bg-baerenstark-wood px-3 py-2 text-sm font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent sm:px-5 sm:py-2.5 sm:text-base"
          >
            Termin buchen
          </button>
          <CustomerHeaderMenu />
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="hidden rounded-lg border border-baerenstark-wood/40 px-3 py-2 text-sm font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40 lg:inline-flex lg:px-4"
            aria-label={`Anrufen unter ${CONTACT.phoneDisplay}`}
          >
            <span aria-hidden="true">📞 </span>
            {CONTACT.phoneDisplay}
          </a>
        </nav>
      </div>
    </header>
  );
}
