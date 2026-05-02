'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { CONTACT } from '@/lib/contact';

/**
 * Bestätigungsseite nach `GET /api/bookings/respond?action=accept`-Redirect (US-13).
 *
 * URL-Parameter:
 *   - `accepted=true` → Standard-Erfolgsfall.
 *   - `status=gone` → Token bereits verbraucht / Endstatus erreicht (410).
 *   - `bookingId=...` → optional, derzeit nicht benötigt im UI.
 */
export function BestaetigtClient() {
  const params = useSearchParams();
  const isGone = params.get('status') === 'gone';

  if (isGone) {
    return (
      <Banner tone="warning" title="Aktion nicht mehr möglich" role="alert">
        <p className="mb-3">
          Dieser Vorschlag ist nicht mehr offen — er wurde bereits angenommen,
          abgelehnt oder ist abgelaufen. Bei Fragen ruf uns einfach an:
        </p>
        <a
          href={`tel:${CONTACT.phoneTel}`}
          className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark"
        >
          {CONTACT.phoneDisplay} anrufen
        </a>
      </Banner>
    );
  }

  return (
    <div className="rounded-2xl border border-baerenstark-sand bg-white/80 p-8 shadow-card sm:p-12">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
        <Image
          src="/logo.png"
          alt="Bärenstark Logo"
          width={80}
          height={80}
          priority
        />
      </div>
      <h1 className="mb-3 text-center font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
        Dein Termin ist bestätigt!
      </h1>
      <p className="mx-auto mb-6 max-w-md text-center text-baerenstark-bark/80">
        Vielen Dank für deine Bestätigung. {CONTACT.ownerName} hat eine
        Benachrichtigung erhalten und meldet sich bei dir, falls noch etwas zu
        klären ist.
      </p>
      <div className="rounded-lg border-l-4 border-leaf bg-leaf/10 p-4 text-sm text-baerenstark-bark/90">
        <p className="font-semibold text-leaf">Nächste Schritte</p>
        <ul role="list" className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Tom kommt zum vereinbarten Termin direkt vor Ort. Bitte stelle
            sicher, dass jemand vor Ort erreichbar ist.
          </li>
          <li>
            Du brauchst nichts vorbereiten — wenn doch, melden wir uns
            telefonisch.
          </li>
          <li>
            Falls sich etwas ändert, ruf uns einfach an:{' '}
            <a
              href={`tel:${CONTACT.phoneTel}`}
              className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
            >
              {CONTACT.phoneDisplay}
            </a>
          </li>
        </ul>
      </div>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/">
          <Button variant="primary">Zur Startseite</Button>
        </Link>
        <a
          href={`tel:${CONTACT.phoneTel}`}
          className="inline-flex items-center justify-center rounded-lg border border-baerenstark-wood/30 bg-transparent px-5 py-2.5 text-base font-medium text-baerenstark-bark hover:bg-baerenstark-sand/40"
        >
          {CONTACT.phoneDisplay}
        </a>
      </div>
    </div>
  );
}
