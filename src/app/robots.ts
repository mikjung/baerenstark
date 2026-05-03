/**
 * robots.txt — Next.js Route Handler (US-IT6-04).
 *
 * Erlaubt Crawler auf öffentlichen Pfaden, sperrt Admin-Bereich,
 * API-Routes und das Kunden-Konto.
 */

import type { MetadataRoute } from 'next';

const DEFAULT_BASE_URL = 'https://www.baerenstark-hausservice.app';

function siteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL;
  return (envUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api', '/api/', '/konto', '/konto/'],
      },
    ],
    sitemap: `${url}/sitemap.xml`,
  };
}
