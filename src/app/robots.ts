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
        disallow: ['/api', '/api/'],
      },
    ],
    sitemap: `${url}/sitemap.xml`,
  };
}
