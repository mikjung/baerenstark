/**
 * ReviewSection (US-22 / US-29 — Iteration 4 umgebaut).
 *
 * Server-Component — lädt `GET /api/reviews`. Wenn weniger als
 * `REVIEW_MIN_APPROVED_TO_REPLACE_STATIC` (4) freigegebene Reviews
 * vorhanden sind, fällt sie auf die statische Liste aus `lib/reviews.ts`
 * zurück und zeigt einen dezenten Hinweis.
 *
 * Die UI-Darstellung bleibt identisch zur IT3-Version (gleiches Grid,
 * gleiche Karten-Optik) — nur die Datenquelle hat sich geändert.
 */

import { headers } from 'next/headers';
import {
  REVIEW_MIN_APPROVED_TO_REPLACE_STATIC,
  type PublicReview,
} from '@/lib/schemas';
import { REVIEWS, REVIEWS_AVERAGE, REVIEWS_COUNT } from '@/lib/reviews';
import { ReviewSectionShowMore } from './ReviewSectionShowMore';

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

async function fetchReviews(): Promise<FetchedReviews | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/reviews?limit=20`, {
      // Server-Component-Cache: 60s, stale-while-revalidate analog Spec.
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: FetchedReviews };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export async function ReviewSection() {
  const live = await fetchReviews();
  const useLive =
    live !== null && live.items.length >= REVIEW_MIN_APPROVED_TO_REPLACE_STATIC;

  // Datenstruktur unifizieren für die Render-Schleife.
  type ViewItem = {
    id: string;
    customerName: string;
    service: string | null;
    stars: number;
    text: string;
    createdAt: string; // ISO oder YYYY-MM-DD
  };

  const items: ViewItem[] = useLive
    ? live!.items.map((r) => ({
        id: r.id,
        customerName: r.customerName,
        service: r.service,
        stars: r.stars,
        text: r.text ?? '',
        createdAt: r.createdAt,
      }))
    : REVIEWS.map((r) => ({
        id: r.id,
        customerName: r.customerName,
        service: r.service === 'allgemein' ? null : r.service,
        stars: r.stars,
        text: r.text,
        createdAt: r.date,
      }));

  const average = useLive ? live!.average : REVIEWS_AVERAGE;
  const total = useLive ? live!.total : REVIEWS_COUNT;
  const averageLabel = average.toFixed(1).replace('.', ',');

  return (
    <section
      aria-labelledby="reviews-title"
      className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16"
    >
      <div className="mb-8 text-center">
        <h2
          id="reviews-title"
          className="mb-3 font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl"
        >
          Was Kund:innen sagen
        </h2>
        <p className="text-base text-baerenstark-bark/80">
          <span className="text-xl text-amber-accent" aria-hidden="true">
            ★
          </span>{' '}
          <strong>{averageLabel} / 5,0</strong> — basierend auf {total}{' '}
          {total === 1 ? 'Bewertung' : 'Bewertungen'}
        </p>
        {!useLive && (
          <p className="mt-2 text-xs text-baerenstark-bark/60">
            Basierend auf Beispielbewertungen — sobald genug echte
            Erfahrungsberichte vorliegen, werden diese hier angezeigt.
          </p>
        )}
      </div>

      <ReviewSectionShowMore items={items} />
    </section>
  );
}
