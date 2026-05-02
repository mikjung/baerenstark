import type { Metadata } from 'next';
import { BookingClient } from './BookingClient';
import { CONTACT } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Termin buchen',
  description:
    'Wähle ein freies Zeitfenster und sende deine Buchungsanfrage an Bärenstark Hausservice.',
};

export default function BuchungPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <h1 className="mb-3 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
          Termin buchen
        </h1>
        <p className="max-w-2xl text-base text-baerenstark-bark/80 sm:text-lg">
          Such dir ein freies Zeitfenster aus, fülle deine Kontaktdaten aus —
          und {CONTACT.ownerName} meldet sich zur Bestätigung. Lieber direkt
          telefonieren?{' '}
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
          >
            {CONTACT.phoneDisplay}
          </a>
          .
        </p>
      </header>
      <BookingClient />
    </div>
  );
}
