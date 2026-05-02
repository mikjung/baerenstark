/**
 * US-22 — Feedback-Sektion auf der Startseite.
 *
 * - Statische Daten aus `lib/reviews.ts` (Iteration 4 → Backend-Modell).
 * - Karten in 1-Spalten (Mobile) / 2 (Tablet) / 3 (Desktop).
 * - Sterne als ⭐-Unicode (visuell + sr-only Aria-Label).
 * - Header zeigt Durchschnittsbewertung + Anzahl.
 */

import { REVIEWS, REVIEWS_AVERAGE, REVIEWS_COUNT } from '@/lib/reviews';
import { getServiceLabel } from '@/lib/services';

const FULL = '★';
const EMPTY = '☆';

function StarRating({ stars }: { stars: number }) {
  const rounded = Math.round(stars);
  return (
    <span aria-label={`${stars} von 5 Sternen`} className="text-amber-accent">
      <span aria-hidden="true">
        {FULL.repeat(rounded)}
        {EMPTY.repeat(5 - rounded)}
      </span>
    </span>
  );
}

function formatGermanDate(iso: string): string {
  // "2026-04-20" → "20.04.2026"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function truncate(text: string, max = 220): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

export function ReviewSection() {
  const averageLabel = REVIEWS_AVERAGE.toFixed(1).replace('.', ',');

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
          <strong>{averageLabel} / 5,0</strong> — basierend auf {REVIEWS_COUNT}{' '}
          Bewertungen
        </p>
      </div>

      <ul
        role="list"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {REVIEWS.map((review) => (
          <li key={review.id}>
            <article
              aria-labelledby={`review-${review.id}-name`}
              className="flex h-full flex-col rounded-2xl border border-baerenstark-sand bg-baerenstark-cream/70 p-5 shadow-soft"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p
                  id={`review-${review.id}-name`}
                  className="font-serif text-lg font-semibold text-baerenstark-bark"
                >
                  {review.customerName}
                </p>
                <StarRating stars={review.stars} />
              </div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-baerenstark-wood">
                {review.service === 'allgemein'
                  ? 'Allgemein'
                  : getServiceLabel(review.service)}
              </p>
              <p className="flex-1 text-sm text-baerenstark-bark/85">
                „{truncate(review.text)}"
              </p>
              <p className="mt-3 text-xs text-baerenstark-bark/60">
                {formatGermanDate(review.date)}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
