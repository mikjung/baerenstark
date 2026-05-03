/**
 * sitemap.xml — Next.js Route Handler (US-IT6-04).
 *
 * Listet alle öffentlichen Seiten:
 *   - Startseite, Buchung, Bewertungen, Kontakt, Impressum, Datenschutz.
 *   - Service-Detail-Pages (1 pro Service-Slug).
 */

import type { MetadataRoute } from 'next';
import { SERVICE_LIST } from '@/lib/services';

const DEFAULT_BASE_URL = 'https://www.baerenstark-hausservice.app';

function siteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL;
  return (envUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${url}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${url}/buchung`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${url}/bewertungen`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${url}/impressum`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${url}/datenschutz`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // `sonstiges` ist nur eine Anfrage-Kategorie im Buchungs-Formular und hat
  // keine eigene Detail-Page (siehe `src/app/services/[slug]/page.tsx`).
  const servicePages: MetadataRoute.Sitemap = SERVICE_LIST
    .filter((s) => s.slug !== 'sonstiges')
    .map((s) => ({
      url: `${url}/services/${s.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    }));

  return [...staticPages, ...servicePages];
}
