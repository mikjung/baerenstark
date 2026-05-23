import type { Metadata } from 'next';
import { CONTACT } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Datenschutz',
  description:
    'Datenschutzerklärung von Bärenstark Hausservice: welche Daten wir erheben, wozu, wie lange.',
};

export default function DatenschutzPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="mb-6 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
        Datenschutzerklärung
      </h1>

      <section className="space-y-5 text-baerenstark-bark/90">
        <p>
          Diese Erklärung informiert Sie darüber, welche personenbezogenen Daten
          beim Besuch dieser Website und beim Absenden einer Anfrage verarbeitet
          werden, zu welchem Zweck und auf welcher Rechtsgrundlage.
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Datenverarbeitung ist:
          <br />
          {CONTACT.ownerName} — Bärenstark Hausservice, {CONTACT.region}.
          <br />
          E-Mail:{' '}
          <a className="break-all underline" href={`mailto:${CONTACT.email}`}>
            {CONTACT.email}
          </a>
          <br />
          Telefon:{' '}
          <a className="underline" href={`tel:${CONTACT.phoneTel}`}>
            {CONTACT.phoneDisplay}
          </a>
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">
          2. Welche Daten werden erhoben?
        </h2>
        <p>Beim Absenden einer Anfrage erheben wir folgende Daten:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Name</strong> — damit wir wissen, wer die Anfrage stellt.
          </li>
          <li>
            <strong>Telefonnummer</strong> — um Rückfragen zu klären.
          </li>
          <li>
            <strong>E-Mail-Adresse</strong> — für die Antwort auf Ihre Anfrage.
          </li>
          <li>
            <strong>Servicewunsch und Beschreibung</strong> — zur konkreten
            Bearbeitung Ihres Anliegens.
          </li>
          <li>
            <strong>Optionale Anhänge</strong> (Fotos, PDF) — sofern Sie welche
            mitschicken.
          </li>
        </ul>

        <h2 className="mt-6 font-serif text-xl font-semibold">
          3. Zweck und Rechtsgrundlage
        </h2>
        <p>
          Wir verarbeiten Ihre Daten ausschließlich zur Bearbeitung Ihrer Anfrage
          und zur Vorbereitung eines möglichen Vertragsverhältnisses.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung und Erfüllung
          eines Vertrags) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
          Interesse, Anfragen zu beantworten).
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">4. Speicherdauer</h2>
        <p>
          Anfragen werden ausschließlich per E-Mail an uns übermittelt und in
          unserem Mail-Postfach gespeichert. Eine Löschung ist auf Anfrage
          jederzeit möglich.
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">
          5. Empfänger / Auftragsverarbeiter
        </h2>
        <p>
          Zur Bereitstellung der Website und zum Versand der Anfrage-E-Mails
          setzen wir folgende Dienstleister ein:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Vercel Inc. — Webhosting</li>
          <li>Resend — Versand von Anfrage-E-Mails</li>
        </ul>

        <h2 className="mt-6 font-serif text-xl font-semibold">6. Ihre Rechte</h2>
        <p>
          Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung,
          Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch.
          Außerdem haben Sie das Recht, sich bei einer
          Datenschutz-Aufsichtsbehörde zu beschweren. Für alle Anliegen rund um
          Ihre Daten erreichen Sie uns unter{' '}
          <a className="break-all underline" href={`mailto:${CONTACT.email}`}>
            {CONTACT.email}
          </a>
          .
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">
          7. Keine Weitergabe an Dritte
        </h2>
        <p>
          Eine Weitergabe Ihrer Daten an Dritte zu Werbezwecken oder zu sonstigen
          nicht unmittelbar mit der Anfragebearbeitung verbundenen Zwecken
          findet nicht statt.
        </p>
      </section>
    </article>
  );
}
