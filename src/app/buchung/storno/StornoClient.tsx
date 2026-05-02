'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { CONTACT } from '@/lib/contact';

/**
 * Bestätigungsseite nach `GET /api/bookings/respond?action=cancel`-Redirect (US-14).
 *
 * URL-Parameter:
 *   - `cancelled=true` → Standard-Erfolgsfall.
 *   - `status=gone` → bereits storniert oder im Endstatus.
 *   - `error=not_found` → Token unbekannt / ungültig.
 */
export function StornoClient() {
  const params = useSearchParams();
  const status = params.get('status');
  const error = params.get('error');

  if (error === 'not_found') {
    return (
      <Banner tone="error" title="Storno-Link ungültig" role="alert">
        <p className="mb-3">
          Der Storno-Link ist nicht mehr gültig. Falls du Hilfe brauchst, ruf
          uns einfach direkt an:
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

  if (status === 'gone') {
    return (
      <Banner tone="info" title="Bereits storniert oder nicht mehr aktiv">
        <p className="mb-3">
          Diese Anfrage wurde bereits storniert oder ist nicht mehr aktiv.
          Falls du eine neue Anfrage stellen möchtest:
        </p>
        <Link href="/buchung">
          <Button variant="primary" size="sm">
            Neue Anfrage stellen
          </Button>
        </Link>
      </Banner>
    );
  }

  return (
    <div className="rounded-2xl border border-baerenstark-sand bg-white/80 p-8 shadow-card sm:p-12">
      <h1 className="mb-3 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
        Deine Anfrage wurde storniert
      </h1>
      <p className="mb-6 text-baerenstark-bark/80">
        Wir haben deine Anfrage erfolgreich storniert und {CONTACT.ownerName}{' '}
        wurde informiert. Das Zeitfenster ist wieder freigegeben.
      </p>
      <div className="rounded-lg border-l-4 border-baerenstark-wood bg-baerenstark-sand/30 p-4 text-sm text-baerenstark-bark/80">
        <p>
          Wenn du später doch noch einen Termin brauchst, kannst du jederzeit
          eine neue Anfrage starten. Bei Fragen erreichst du uns telefonisch
          unter{' '}
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
          >
            {CONTACT.phoneDisplay}
          </a>
          .
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/buchung">
          <Button variant="primary">Neue Anfrage stellen</Button>
        </Link>
        <Link href="/">
          <Button variant="ghost">Zur Startseite</Button>
        </Link>
      </div>
    </div>
  );
}
