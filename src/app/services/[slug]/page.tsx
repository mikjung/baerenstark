/**
 * /services/[slug] — Service-Detail-Page (US-IT6-04 / Defekt D1).
 *
 * Eine eigene SEO-Landing-Page pro echtem Service. Inhalte stammen aus
 * `src/lib/services.ts` (Single Source of Truth, gemeinsam mit Sitemap und
 * JSON-LD-Helper). Statisch generiert via `generateStaticParams`.
 *
 * Enthält:
 *  - Hero mit Icon, Label, Subtitle, Description, Preis-Badge.
 *  - Vorher/Nachher-Sektion.
 *  - Inkludiert-Liste.
 *  - FAQ (Kurz-Antworten zu typischen Fragen).
 *  - JSON-LD (Schema.org `Service`) via `serviceJsonLd()`.
 *  - CTA „Jetzt buchen" → `/buchung?service=<slug>`.
 *
 * Nicht enthalten ist `'sonstiges'` — das ist nur eine Anfrage-Kategorie
 * im Buchungs-Formular und bekommt deshalb keine eigene Detail-Page.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/JsonLd';
import { ServiceDetailHero } from '@/components/services/ServiceDetailHero';
import { serviceJsonLd } from '@/lib/seo/jsonLd';
import {
  getServiceBySlug,
  SERVICE_DETAIL_SLUGS,
} from '@/lib/services';
import { CONTACT } from '@/lib/contact';

interface PageProps {
  params: { slug: string };
}

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return SERVICE_DETAIL_SLUGS.map((slug) => ({ slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const info = getServiceBySlug(params.slug);
  if (!info) {
    return {
      title: 'Service nicht gefunden',
      robots: { index: false, follow: false },
    };
  }
  const title = `${info.label} in Darmstadt`;
  const description = info.description;
  const canonical = `/services/${info.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} · Bärenstark Hausservice`,
      description,
      type: 'website',
      locale: 'de_DE',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · Bärenstark Hausservice`,
      description,
    },
  };
}

/**
 * FAQ-Stamm pro Service. Bewusst hier statt in `services.ts`, weil die
 * Antworten Page-spezifisch sind und die Service-Lib sonst zu groß würde.
 * Tonalität: Tom direkt, regional, vertrauensvoll.
 */
const FAQS: Record<string, ReadonlyArray<{ q: string; a: string }>> = {
  entruempelung: [
    {
      q: 'Wie schnell könnt ihr loslegen?',
      a: 'In der Regel innerhalb von 1–2 Wochen — bei dringenden Fällen oft schneller. Ruf einfach an, dann finden wir einen Termin.',
    },
    {
      q: 'Was kostet eine Entrümpelung?',
      a: 'Wir kalkulieren individuell — je nach Umfang und Aufwand. Nach einer kostenlosen Besichtigung erhältst du ein faires, transparentes Angebot.',
    },
    {
      q: 'Übernehmt ihr auch die Entsorgung?',
      a: 'Ja, vollständig. Sperrmüll, Wertstoffe und Sondermüll werden fachgerecht getrennt und entsorgt. Du musst nichts selbst zur Deponie fahren.',
    },
    {
      q: 'Werdet ihr auch außerhalb von Darmstadt aktiv?',
      a: 'Wir bedienen Darmstadt und Umgebung (Darmstadt-Dieburg, Bergstraße). Frag einfach nach, wenn du außerhalb wohnst.',
    },
  ],
  entkernung: [
    {
      q: 'Bis wohin reicht eure Entkernung?',
      a: 'Wir entfernen Innenausbau, Bodenbeläge, Sanitär, abgehängte Decken und nichttragende Wände — bis der Rohbau wieder sichtbar ist.',
    },
    {
      q: 'Müssen wir Container organisieren?',
      a: 'Auf Wunsch übernehmen wir das mit. Wir kennen die Verwerter in der Region und sortieren die Materialien direkt für das Recycling.',
    },
    {
      q: 'Wie lange dauert eine Entkernung?',
      a: 'Das hängt von Größe und Substanz ab. Nach einer Besichtigung geben wir dir einen verbindlichen Zeitrahmen.',
    },
  ],
  reinigung: [
    {
      q: 'Welche Reinigungs-Arten bietet ihr an?',
      a: 'Bauschluss-Reinigung, Grundreinigung, Endreinigung bei Wohnungs-Übergaben, Fensterreinigung und Sanitärbereiche — drinnen wie draußen.',
    },
    {
      q: 'Bringt ihr Reinigungsmittel mit?',
      a: 'Auf Wunsch ja. Du kannst aber auch deine eigenen Mittel verwenden, wenn du sensible Oberflächen oder Allergien hast.',
    },
    {
      q: 'Reinigt ihr auch nach Auszug?',
      a: 'Ja — übergabefertig für Vermieter. Inklusive Bad, Küche, Fenster und allen Räumen.',
    },
  ],
  gruenflaechenpflege: [
    {
      q: 'Macht ihr Einzelaufträge oder nur Verträge?',
      a: 'Beides. Einmalig (Hecke schneiden, Garten herrichten) oder regelmäßig im Pflegevertrag — ganz wie du es brauchst.',
    },
    {
      q: 'Bringt ihr eigenes Werkzeug mit?',
      a: 'Ja, Standard-Werkzeug ist dabei. Bei Sonderfällen (sehr hohe Hecken, große Bäume) sprechen wir das vorab ab.',
    },
    {
      q: 'Was passiert mit dem Grünschnitt?',
      a: 'Wir nehmen ihn mit und entsorgen ihn fachgerecht — oder lassen ihn auf dem Komposthaufen, wenn du das möchtest.',
    },
  ],
  muelltonnenservice: [
    {
      q: 'Wie funktioniert der Service?',
      a: 'Wir stellen deine Tonnen am Vorabend des Abfuhrtermins raus und holen sie nach der Leerung wieder rein — als Einzelauftrag oder im Abo.',
    },
    {
      q: 'Was kostet das?',
      a: 'Die Konditionen sprechen wir individuell ab — je nach Tonnen-Anzahl und Häufigkeit. Im Abo wird es günstiger.',
    },
    {
      q: 'Was passiert, wenn ich kurzfristig verhindert bin?',
      a: 'Sag uns einfach Bescheid, wir springen ein. Genau dafür ist der Service da.',
    },
  ],
  entsorgung: [
    {
      q: 'Was nehmt ihr alles mit?',
      a: 'Alteisen, Maschinen, Werkzeuge, Metallreste, Heizkörper, Geländer — alles Metallische. Bei größeren Teilen demontieren wir vor Ort.',
    },
    {
      q: 'Bekomme ich etwas für den Schrott?',
      a: 'Ab gewissen Mengen ja — wir besprechen den Materialwert transparent mit dir und ziehen ihn vom Aufwand ab.',
    },
    {
      q: 'Gibt es eine Mindestmenge?',
      a: 'Nicht zwingend. Sprich uns einfach an — bei kleinen Mengen können wir das oft mit einem anderen Auftrag in der Region kombinieren.',
    },
  ],
};

export default function ServiceDetailPage({ params }: PageProps) {
  const info = getServiceBySlug(params.slug);
  if (!info) {
    notFound();
  }

  const ctaHref = `/buchung?service=${encodeURIComponent(info.slug)}`;
  const faq = FAQS[info.slug] ?? [];

  return (
    <>
      <JsonLd data={serviceJsonLd(info.slug)} />

      {/* Hero — IT12-S02: echtes Foto + kleines Icon neben H1.
          Layout Mobile: Heading-Block (Icon-32 + h1) → Foto darunter.
          Layout Desktop: Foto rechts (60% Breite), Heading + Body links. */}
      <section
        aria-labelledby="service-title"
        className="relative overflow-hidden bg-gradient-to-b from-baerenstark-cream to-baerenstark-sand/40"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:py-20">
          <div className="order-2 md:order-1">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-baerenstark-wood">
              Service in {CONTACT.region}
            </p>
            <div className="mb-3 flex items-center gap-3 sm:gap-4">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-baerenstark-sand bg-baerenstark-cream text-lg sm:h-10 sm:w-10 sm:text-xl"
              >
                {info.icon}
              </span>
              <h1
                id="service-title"
                className="font-serif text-2xl font-bold leading-tight text-baerenstark-bark sm:text-3xl md:text-4xl"
              >
                {info.label}
              </h1>
            </div>
            <p className="mb-2 text-base font-medium text-baerenstark-wood">
              {info.short}
            </p>
            <p className="mb-6 text-base text-baerenstark-bark/80 sm:text-lg">
              {info.description}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-6 py-3 text-base font-medium text-baerenstark-cream shadow-soft transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
              >
                Anfrage stellen
              </Link>
              <a
                href={`tel:${CONTACT.phoneTel}`}
                className="inline-flex items-center justify-center rounded-lg border-2 border-baerenstark-wood px-6 py-3 text-base font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
                aria-label={`Anrufen unter ${CONTACT.phoneDisplay}`}
              >
                Anrufen: {CONTACT.phoneDisplay}
              </a>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <ServiceDetailHero
              serviceSlug={info.slug}
              serviceName={info.label}
              fallbackIcon={info.icon}
              priority
            />
          </div>
        </div>
      </section>

      {/* Vorher / Nachher */}
      <section
        aria-labelledby="ba-title"
        className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16"
      >
        <h2
          id="ba-title"
          className="mb-6 font-serif text-2xl font-bold text-baerenstark-bark sm:text-3xl"
        >
          So sieht es vorher und nachher aus
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-red-200 bg-red-50/60 p-5 sm:p-6">
            <h3 className="mb-2 flex items-center gap-2 font-serif text-lg font-semibold text-red-900">
              <span aria-hidden="true">🚧</span> Vorher
            </h3>
            <p className="text-sm text-red-900/90 sm:text-base">
              {info.details.before}
            </p>
          </article>
          <article className="rounded-2xl border border-leaf/40 bg-leaf/10 p-5 sm:p-6">
            <h3 className="mb-2 flex items-center gap-2 font-serif text-lg font-semibold text-baerenstark-bark">
              <span aria-hidden="true">✨</span> Nachher
            </h3>
            <p className="text-sm text-baerenstark-bark/90 sm:text-base">
              {info.details.after}
            </p>
          </article>
        </div>
      </section>

      {/* Inbegriffen */}
      <section
        aria-labelledby="includes-title"
        className="bg-white/60 py-12 sm:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2
            id="includes-title"
            className="mb-6 font-serif text-2xl font-bold text-baerenstark-bark sm:text-3xl"
          >
            Was bei uns inbegriffen ist
          </h2>
          <ul
            role="list"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {info.details.includes.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl border border-baerenstark-sand bg-baerenstark-cream/70 p-4 text-sm text-baerenstark-bark sm:text-base"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-leaf text-xs font-bold text-white"
                >
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      {faq.length > 0 && (
        <section
          aria-labelledby="faq-title"
          className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16"
        >
          <h2
            id="faq-title"
            className="mb-6 font-serif text-2xl font-bold text-baerenstark-bark sm:text-3xl"
          >
            Häufig gestellte Fragen
          </h2>
          <div className="space-y-3">
            {faq.map((entry, idx) => (
              <details
                key={entry.q}
                className="group rounded-xl border border-baerenstark-sand bg-white/70 p-4 shadow-soft open:shadow-card"
                {...(idx === 0 ? { open: true } : {})}
              >
                <summary className="cursor-pointer list-none font-serif text-base font-semibold text-baerenstark-bark marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2">
                  <span className="flex items-center justify-between gap-2">
                    {entry.q}
                    <span
                      aria-hidden="true"
                      className="text-baerenstark-wood transition-transform group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-baerenstark-bark/80 sm:text-base">
                  {entry.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* CTA-Footer */}
      <section
        aria-labelledby="cta-title"
        className="bg-gradient-to-b from-baerenstark-sand/40 to-baerenstark-cream py-12 sm:py-16"
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2
            id="cta-title"
            className="mb-3 font-serif text-2xl font-bold text-baerenstark-bark sm:text-3xl"
          >
            Bereit für {info.label.toLowerCase()}?
          </h2>
          <p className="mb-6 text-base text-baerenstark-bark/80 sm:text-lg">
            Schreib uns kurz, was du brauchst — wir melden uns innerhalb von
            24 Stunden mit einem fairen, transparenten Angebot.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center rounded-lg bg-leaf px-6 py-3 text-base font-medium text-white shadow-soft transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
            >
              Jetzt Anfrage stellen →
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border-2 border-baerenstark-wood px-6 py-3 text-base font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
            >
              Alle Dienstleistungen ansehen
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
