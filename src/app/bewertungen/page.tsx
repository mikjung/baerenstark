/**
 * /bewertungen — öffentliche Bewertungs-Übersicht (US-IT6-03 / US-IT6-04).
 *
 * Lädt freigegebene Bewertungen aus `GET /api/reviews` (Backend filtert
 * `approved=true AND rejectedAt IS NULL` und serialisiert via
 * `PublicReviewSchema.strict()` — keine `customerId`/`bookingId`,
 * Format „Vorname N.").
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  aggregateRatingJsonLd,
  reviewJsonLd,
} from '@/lib/seo/jsonLd';
import type { PublicReview } from '@/lib/schemas';
import { getServiceLabel } from '@/lib/services';

export const metadata: Metadata = {
  title: 'Kundenbewertungen',
  description:
    'Echte Bewertungen unserer Kundinnen und Kunden in Darmstadt — ehrlich, geprüft, freigegeben.',
  openGraph: {
    title: 'Kundenbewertungen · Bärenstark Hausservice',
    description:
      'Lies, was unsere Kundinnen und Kunden über Bärenstark Hausservice in Darmstadt sagen.',
    type: 'website',
  },
};

export const revalidate = 300;

interface FetchedReviews {
  items: PublicReview[];
  average: number;
  total: number;
}

function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  if (host) return `${proto}://${host}`;
  return 'http://localhost:3000';
}

async function fetchAll(): Promise<FetchedReviews | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/reviews?limit=100`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: FetchedReviews };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export default async function BewertungenPage() {
  const data = await fetchAll();
  const reviews = data?.items ?? [];
  const average = data?.average ?? 0;
  const total = data?.total ?? 0;

  return (
    <article className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {total >= 3 && (
        <JsonLd data={aggregateRatingJsonLd(average, total)} />
      )}
      {reviews.slice(0, 5).map((r) => (
        <JsonLd key={r.id} data={reviewJsonLd(r)} />
      ))}

      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
          Kundenbewertungen
        </h1>
        <p className="mt-2 text-baerenstark-bark/80">
          Diese Bewertungen stammen ausschließlich von Kundinnen und Kunden mit
          abgeschlossenen Aufträgen — geprüft und manuell freigegeben.
        </p>
        {total > 0 && (
          <p className="mt-3 text-sm text-baerenstark-bark/70">
            <strong>{average.toFixed(1)} / 5</strong> aus {total} Bewertungen
          </p>
        )}
      </header>

      {reviews.length === 0 ? (
        <p className="rounded-lg border border-baerenstark-sand bg-white p-6 text-center text-baerenstark-bark/70">
          Bisher liegen noch keine freigegebenen Bewertungen vor.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-baerenstark-sand bg-white p-5 shadow-sm"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-medium text-baerenstark-bark">
                  {r.customerName}
                </span>
                <span aria-label={`${r.stars} von 5 Sternen`} className="text-baerenstark-wood">
                  {'★'.repeat(r.stars)}
                  <span className="text-baerenstark-bark/30">
                    {'★'.repeat(5 - r.stars)}
                  </span>
                </span>
              </div>
              {r.service && (
                <p className="mt-1 text-xs uppercase tracking-wide text-baerenstark-bark/60">
                  {getServiceLabel(r.service)}
                </p>
              )}
              {r.text && (
                <p className="mt-3 text-sm leading-relaxed text-baerenstark-bark/90">
                  {r.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
