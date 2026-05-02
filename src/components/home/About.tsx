import { CONTACT } from '@/lib/contact';

export function About() {
  return (
    <section
      aria-labelledby="about-title"
      className="bg-baerenstark-sand/30 py-12 sm:py-16"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h2
          id="about-title"
          className="mb-4 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl"
        >
          Über Tom Siefert
        </h2>
        <div className="space-y-4 text-base text-baerenstark-bark/85 sm:text-lg">
          <p>
            Mein Name ist <strong>{CONTACT.ownerName}</strong>, ich bin 29 Jahre alt
            und selbstständig in Darmstadt unterwegs. Mit Bärenstark Hausservice
            biete ich praktische Lösungen rund ums Haus an — vom kompletten
            Räumen einer Wohnung bis zur regelmäßigen Pflege Ihrer Grünanlagen.
          </p>
          <p>
            Was Sie von mir erwarten dürfen: <strong>zuverlässige Termine</strong>,{' '}
            <strong>faire Preise</strong> und <strong>transparente Absprachen</strong>.
            Keine versteckten Kosten, keine leeren Versprechen.
          </p>
          <p>
            Ich arbeite in {CONTACT.region}. Schreiben Sie mir, rufen Sie an
            oder buchen Sie direkt online ein Zeitfenster — ich melde mich
            zeitnah zurück.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark"
          >
            📞 {CONTACT.phoneDisplay}
          </a>
          <a
            href={`mailto:${CONTACT.email}`}
            className="inline-flex items-center justify-center rounded-lg border border-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/50"
          >
            ✉️ {CONTACT.email}
          </a>
        </div>
      </div>
    </section>
  );
}
