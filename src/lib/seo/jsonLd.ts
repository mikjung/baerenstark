/**
 * JSON-LD Helper. Strukturierte Daten für:
 *   - LocalBusiness (Startseite)
 *   - Service (eine Seite pro Service-Slug)
 */

import { CONTACT } from '@/lib/contact';
import { SERVICE_LIST, type Service as ServiceSlug } from '@/lib/services';

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
    telephone: CONTACT.phoneTel || '+49-???-?????',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Mustergasse 1',
      addressLocality: 'Darmstadt',
      postalCode: '64283',
      addressCountry: 'DE',
    },
    areaServed: ['Darmstadt', 'Darmstadt-Dieburg', 'Bergstraße'],
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
