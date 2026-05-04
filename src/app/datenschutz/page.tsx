import type { Metadata } from 'next';
import Link from 'next/link';
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
          beim Besuch dieser Website und beim Ausfüllen des Buchungsformulars
          verarbeitet werden, zu welchem Zweck und auf welcher Rechtsgrundlage.
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
        <p>Beim Absenden einer Buchungsanfrage erheben wir folgende Daten:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Name</strong> — damit wir wissen, wer die Anfrage stellt.
          </li>
          <li>
            <strong>Telefonnummer</strong> — um Rückfragen zu klären und Termine
            zu bestätigen.
          </li>
          <li>
            <strong>E-Mail-Adresse</strong> — optional, falls Sie eine spätere
            Bestätigung per E-Mail wünschen.
          </li>
          <li>
            <strong>Servicewunsch und Beschreibung</strong> — zur konkreten
            Bearbeitung Ihres Anliegens.
          </li>
          <li>
            <strong>Zeitfenster (Datum, Uhrzeit)</strong> — für die Terminplanung.
          </li>
        </ul>

        <h2 className="mt-6 font-serif text-xl font-semibold">
          3. Zweck und Rechtsgrundlage
        </h2>
        <p>
          Wir verarbeiten Ihre Daten ausschließlich zur Bearbeitung Ihrer Anfrage
          und zur Vorbereitung eines möglichen Vertragsverhältnisses. Rechtsgrundlage
          ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung und Erfüllung eines Vertrags)
          sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse, Anfragen zu
          beantworten).
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">4. Speicherdauer</h2>
        <p>
          Buchungsanfragen werden für maximal{' '}
          <strong>2 Jahre nach Eingang</strong> gespeichert und anschließend
          automatisch gelöscht. Eine frühere Löschung ist auf Anfrage jederzeit
          möglich.
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">
          5. Empfänger / Auftragsverarbeiter
        </h2>
        <p>
          Zur Bereitstellung der Website und des Buchungssystems setzen wir
          folgende Dienstleister ein:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Vercel Inc. — Webhosting</li>
          <li>Turso (libSQL) — Datenbankspeicherung</li>
          <li>Resend — Versand von Benachrichtigungs-E-Mails</li>
          <li>Upstash — technisches Rate-Limit (keine personenbezogenen Daten)</li>
        </ul>

        <h2 className="mt-6 font-serif text-xl font-semibold">6. Ihre Rechte</h2>
        <p>
          Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung,
          Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch.
          Außerdem haben Sie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde
          zu beschweren. Für alle Anliegen rund um Ihre Daten erreichen Sie uns
          unter{' '}
          <a className="break-all underline" href={`mailto:${CONTACT.email}`}>
            {CONTACT.email}
          </a>
          .
        </p>

        {/*
          IT13 / S01 — Datenlöschungs-Abschnitt mit Anker `#datenloesung`.
          Dient (a) dem Footer-Link-Ziel und (b) der Querverlinkung aus der
          Facebook Developer Console; die separate Detail-Seite liegt unter
          `/datenschutz/datenloesung` (Decision IT13 — kanonische URL).
        */}
        <h2
          id="datenloesung"
          className="mt-6 scroll-mt-24 font-serif text-xl font-semibold"
        >
          6a. Datenlöschung
        </h2>
        <p>
          Sie können die Löschung Ihrer personenbezogenen Daten jederzeit per
          E-Mail beantragen. Schreiben Sie eine Nachricht mit dem Betreff{' '}
          <strong>„Datenlöschung"</strong> an{' '}
          <a
            className="break-all underline"
            href={`mailto:${CONTACT.email}?subject=Datenl%C3%B6schung`}
          >
            {CONTACT.email}
          </a>
          . Wir bearbeiten Ihre Anfrage innerhalb von 30 Tagen (Art. 17 DSGVO).
          Eine ausführliche Erläuterung — welche Daten gelöscht werden, welche
          aus gesetzlichen Aufbewahrungspflichten weiter gespeichert bleiben
          und wie der Ablauf konkret aussieht — finden Sie auf unserer{' '}
          <Link
            href="/datenschutz/datenloesung"
            className="underline underline-offset-2"
          >
            Datenlöschungs-Seite
          </Link>
          .
        </p>

        <h2 className="mt-6 font-serif text-xl font-semibold">
          7. Keine Weitergabe an Dritte
        </h2>
        <p>
          Eine Weitergabe Ihrer Daten an Dritte zu Werbezwecken oder zu sonstigen
          nicht unmittelbar mit der Anfragebearbeitung verbundenen Zwecken findet
          nicht statt.
        </p>
      </section>
    </article>
  );
}
