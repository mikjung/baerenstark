/**
 * ReviewSection — statische Kunden-Bewertungen für die Startseite.
 */

import { REVIEWS, REVIEWS_AVERAGE, REVIEWS_COUNT } from '@/lib/reviews';
import { ReviewSectionShowMore } from './ReviewSectionShowMore';

export function ReviewSection() {
  const items = REVIEWS.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    service: r.service === 'allgemein' ? null : r.service,
    stars: r.stars,
    text: r.text,
    createdAt: r.date,
  }));

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
          {REVIEWS_COUNT === 1 ? 'Bewertung' : 'Bewertungen'}
        </p>
      </div>

      <ReviewSectionShowMore items={items} />
    </section>
  );
}
