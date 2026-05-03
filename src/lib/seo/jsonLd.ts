/**
 * JSON-LD Helper (US-IT6-04). Wir liefern strukturierte Daten für:
 *   - LocalBusiness (Startseite + Pflicht für SERP-Anreicherung)
 *   - Service (eine Seite pro Service-Slug)
 *   - AggregateRating + Review (Bewertungs-Sektion)
 *
 * NEEDS INPUT: openingHours + Telefon + Adresse — Tom muss finale Werte
 * liefern. Bis dahin Platzhalter (siehe ARCHITECTURE_IT6.md §6.2).
 */

import type { PublicReview } from '@/lib/schemas';
import { CONTACT } from '@/lib/contact';
import {
  SERVICE_LIST,
  type Service as ServiceSlug,
} from '@/lib/services';

const DEFAULT_BASE_URL = 'https://www.baerenstark-hausservice.app';

function siteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL;
  return (envUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

export function localBusinessJsonLd(): Record<string, unknown> {
  const url = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${url}/#localbusiness`,
    name: 'Bärenstark Hausservice',
    image: `${url}/opengraph-image.png`,
    logo: `${url}/icon.png`,
    url,
    // NEEDS INPUT — Tom liefert finale Telefonnummer.
    telephone: CONTACT.phoneTel || '+49-???-?????',
    address: {
      '@type': 'PostalAddress',
      // NEEDS INPUT — Adresse (Tom liefert).
      streetAddress: 'Mustergasse 1',
      addressLocality: 'Darmstadt',
      postalCode: '64283',
      addressCountry: 'DE',
    },
    areaServed: ['Darmstadt', 'Darmstadt-Dieburg', 'Bergstraße'],
    // NEEDS INPUT — finale Geschäftszeiten von Tom (Platzhalter Mo–Fr 07:00–18:00).
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '07:00',
        closes: '18:00',
      },
    ],
    sameAs: [],
  };
}

export function serviceJsonLd(slug: ServiceSlug): Record<string, unknown> {
  const url = siteUrl();
  const info = SERVICE_LIST.find((s) => s.slug === slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: info?.label ?? slug,
    description: info?.description ?? '',
    serviceType: info?.label ?? slug,
    provider: {
      '@type': 'LocalBusiness',
      '@id': `${url}/#localbusiness`,
      name: 'Bärenstark Hausservice',
    },
    areaServed: {
      '@type': 'AdministrativeArea',
      name: 'Darmstadt',
    },
    url: `${url}/services/${slug}`,
  };
}

export function aggregateRatingJsonLd(
  averageStars: number,
  total: number,
): Record<string, unknown> {
  const url = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'AggregateRating',
    itemReviewed: {
      '@type': 'LocalBusiness',
      '@id': `${url}/#localbusiness`,
      name: 'Bärenstark Hausservice',
    },
    ratingValue: averageStars.toFixed(1),
    bestRating: '5',
    worstRating: '1',
    ratingCount: String(total),
  };
}

export function reviewJsonLd(review: PublicReview): Record<string, unknown> {
  const url = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    author: { '@type': 'Person', name: review.customerName },
    datePublished: review.createdAt,
    reviewBody: review.text ?? '',
    reviewRating: {
      '@type': 'Rating',
      ratingValue: String(review.stars),
      bestRating: '5',
      worstRating: '1',
    },
    itemReviewed: {
      '@type': 'LocalBusiness',
      '@id': `${url}/#localbusiness`,
      name: 'Bärenstark Hausservice',
    },
  };
}
