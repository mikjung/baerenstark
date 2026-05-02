'use client';

/**
 * Client-Komponente für die Reviews-Karten + Show-More-Toggle.
 *
 * Rendert die Karten selbst (statt als Render-Prop), damit keine Funktion
 * von Server- zu Client-Component übergeben werden muss (Next.js erlaubt
 * keine Function-Props ohne explizites `'use server'`).
 */

import { useState } from 'react';
import { getServiceLabel } from '@/lib/services';

export interface ReviewItem {
  id: string;
  customerName: string;
  service: string | null;
  stars: number;
  text: string;
  createdAt: string;
}

interface ReviewSectionShowMoreProps {
  items: ReviewItem[];
}

const INITIAL_VISIBLE = 6;
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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function truncate(text: string, max = 220): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

export function ReviewSectionShowMore({ items }: ReviewSectionShowMoreProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE);

  return (
    <>
      <ul
        role="list"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {visible.map((review) => (
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
                {review.service ? getServiceLabel(review.service) : 'Allgemein'}
              </p>
              <p className="flex-1 text-sm text-baerenstark-bark/85">
                „{truncate(review.text)}"
              </p>
              <p className="mt-3 text-xs text-baerenstark-bark/60">
                {formatGermanDate(review.createdAt)}
              </p>
            </article>
          </li>
        ))}
      </ul>

      {!showAll && items.length > INITIAL_VISIBLE && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="rounded-full border-2 border-baerenstark-wood px-6 py-2 text-sm font-semibold text-baerenstark-wood transition hover:bg-baerenstark-wood hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
          >
            Alle {items.length} Bewertungen anzeigen
          </button>
        </div>
      )}
    </>
  );
}
