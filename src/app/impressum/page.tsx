import type { Metadata } from 'next';
import { CONTACT } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Impressum von Bärenstark Hausservice — Tom Siefert, Darmstadt.',
};

export default function ImpressumPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="mb-6 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
        Impressum
      </h1>

      <section className="space-y-4 text-baerenstark-bark/90">
        <p className="rounded-lg border-l-4 border-baerenstark-accent bg-baerenstark-sand/40 p-4 text-sm">
          Hinweis: Dieser Inhalt ist eine vorläufige Platzhalter-Fassung.
          Die finalen rechtlichen Angaben werden von {CONTACT.ownerName}
          ergänzt.
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">Angaben gemäß § 5 TMG</h2>
        <p>
          {CONTACT.ownerName}
          <br />
          Bärenstark Hausservice
          <br />
          [Straße, Hausnummer wird ergänzt]
          <br />
          [PLZ, Ort] — {CONTACT.region}
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">Kontakt</h2>
        <p>
          Telefon:{' '}
          <a className="underline" href={`tel:${CONTACT.phoneTel}`}>
            {CONTACT.phoneDisplay}
          </a>
          <br />
          E-Mail:{' '}
          <a className="break-all underline" href={`mailto:${CONTACT.email}`}>
            {CONTACT.email}
          </a>
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">
          Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
        </h2>
        <p>{CONTACT.ownerName} (Anschrift wie oben)</p>

        <h2 className="mt-6 font-serif text-xl font-semibold">Haftungshinweis</h2>
        <p>
          Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung
          für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten
          sind ausschließlich deren Betreiber verantwortlich.
        </p>
      </section>
    </article>
  );
}
