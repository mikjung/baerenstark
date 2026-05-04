/**
 * /datenschutz/datenloesung — Datenlöschungsseite (IT13-S01).
 *
 * Pflicht für Facebook App Review: öffentlich erreichbare URL mit Datenlösch-
 * Anweisungen. Die URL wird in der Facebook Developer Console unter
 * „Data Deletion Instructions URL" eingetragen.
 *
 * Decision IT13 (Source of Truth, 2026-05-04):
 *   Kanonische URL = `/datenschutz/datenloesung`. Story-AC + UX-Spec
 *   stimmen überein, Backend/Architecture wurden angeglichen.
 *
 * Inhalt + Tonalität: ux-spec-iteration-13.md §3.1, Du-Form (IT13-Default
 * für neue Microcopy). Statische Server Component — kein API-Call,
 * kein Auth-Wall, indexierbar.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTACT } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Datenlöschung',
  description:
    'So beantragst du die Löschung deiner Daten bei Bärenstark Hausservice — DSGVO-konform innerhalb von 30 Tagen.',
  alternates: { canonical: '/datenschutz/datenloesung' },
  robots: { index: true, follow: true },
};

export default function DatenloesungPage() {
  return (
    <article
      aria-labelledby="page-title"
      className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16"
    >
      {/* Breadcrumb */}
      <p className="mb-4 text-sm text-baerenstark-bark/70">
        <Link href="/datenschutz" className="underline-offset-2 hover:underline">
          Datenschutz
        </Link>
        {' / '}
        <span aria-current="page">Datenlöschung</span>
      </p>

      <h1
        id="page-title"
        className="mb-6 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl"
      >
        Datenlöschung
      </h1>

      <p className="mb-8 text-lg text-baerenstark-bark/90">
        Du möchtest deine Daten bei Bärenstark löschen lassen? Kein Problem —
        wir machen das schnell und unkompliziert.
      </p>

      <hr className="mb-8 border-baerenstark-sand/60" />

      <section
        aria-labelledby="data-types-heading"
        className="mb-8 space-y-3 text-baerenstark-bark/90"
      >
        <h2
          id="data-types-heading"
          className="font-serif text-xl font-semibold text-baerenstark-bark"
        >
          Welche Daten speichern wir?
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Name (Vor- und Nachname)</li>
          <li>E-Mail-Adresse</li>
          <li>Telefonnummer (sofern angegeben)</li>
          <li>Adresse (sofern angegeben)</li>
          <li>Buchungshistorie (Service, Datum, Status)</li>
          <li>Bewertungen (sofern abgegeben)</li>
          <li>
            Login-Daten (Passwort-Hash bzw. OAuth-Verknüpfung mit Google oder
            Facebook)
          </li>
        </ul>
      </section>

      <hr className="mb-8 border-baerenstark-sand/60" />

      <section
        aria-labelledby="how-to-heading"
        className="mb-8 space-y-3 text-baerenstark-bark/90"
      >
        <h2
          id="how-to-heading"
          className="font-serif text-xl font-semibold text-baerenstark-bark"
        >
          So beantragst du die Löschung
        </h2>
        <ol className="list-decimal space-y-4 pl-6">
          <li>
            <span>Schreib uns eine E-Mail an:</span>
            <div className="mt-2">
              <a
                href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(
                  'Datenlöschung',
                )}`}
                aria-label="E-Mail an Bärenstark zur Datenlöschung senden"
                className="inline-flex items-center gap-2 rounded-lg border border-baerenstark-sand bg-baerenstark-cream px-4 py-2 font-medium text-baerenstark-bark transition hover:bg-baerenstark-sand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-bark"
              >
                <span aria-hidden="true">✉</span>
                {CONTACT.email}
              </a>
            </div>
            <span className="mt-1 block text-sm text-baerenstark-bark/70">
              Betreff: „Datenlöschung"
            </span>
          </li>
          <li>
            Falls du ein Konto hast: nenne uns deine Anmelde-E-Mail (zur
            eindeutigen Zuordnung).
          </li>
          <li>
            Wir bestätigen den Eingang innerhalb von{' '}
            <strong>48 Stunden</strong> und löschen deine Daten innerhalb von{' '}
            <strong>30 Tagen</strong> — wie es die DSGVO vorsieht (Art. 17).
          </li>
        </ol>
      </section>

      <hr className="mb-8 border-baerenstark-sand/60" />

      <section
        aria-labelledby="retention-heading"
        className="mb-8 space-y-3 text-baerenstark-bark/90"
      >
        <h2
          id="retention-heading"
          className="font-serif text-xl font-semibold text-baerenstark-bark"
        >
          Was wir nach der Löschung behalten müssen
        </h2>
        <p>
          Aus rechtlichen Gründen müssen wir bestimmte Daten länger
          aufbewahren — zum Beispiel Rechnungen (10 Jahre, AO §147 / HGB §257).
          Diese werden aber nicht mehr aktiv verwendet, sondern für die
          weitere Verarbeitung gesperrt und nach Ablauf der Frist automatisch
          gelöscht.
        </p>
      </section>

      <hr className="mb-8 border-baerenstark-sand/60" />

      <section
        aria-labelledby="contact-heading"
        className="mb-8 space-y-3 text-baerenstark-bark/90"
      >
        <h2
          id="contact-heading"
          className="font-serif text-xl font-semibold text-baerenstark-bark"
        >
          Fragen?
        </h2>
        <p>Schreib uns eine E-Mail oder ruf uns an:</p>
        <ul className="space-y-2">
          <li>
            <a
              href={`mailto:${CONTACT.email}`}
              className="inline-flex items-center gap-2 text-baerenstark-bark underline underline-offset-2 hover:no-underline"
            >
              <span aria-hidden="true">✉</span>
              {CONTACT.email}
            </a>
          </li>
          <li>
            <a
              href={`tel:${CONTACT.phoneTel}`}
              aria-label={`Bärenstark anrufen, ${CONTACT.phoneDisplay}`}
              className="inline-flex items-center gap-2 text-baerenstark-bark underline underline-offset-2 hover:no-underline"
            >
              <span aria-hidden="true">📞</span>
              {CONTACT.phoneDisplay}
            </a>
          </li>
        </ul>
      </section>

      <hr className="mb-8 border-baerenstark-sand/60" />

      <p>
        <Link
          href="/datenschutz"
          className="inline-flex items-center gap-1 text-baerenstark-bark/80 underline underline-offset-2 hover:text-baerenstark-bark"
        >
          ← Zurück zur Datenschutzerklärung
        </Link>
      </p>
    </article>
  );
}
