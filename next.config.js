/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // IT5 / US-31: OAuth-Feature-Flag.
  // `NEXT_PUBLIC_FEATURE_OAUTH_LOGIN` wird zur Build-Zeit aus
  // `GOOGLE_CLIENT_ID` abgeleitet — wenn der Wert vorhanden ist, wird das
  // Flag aktiv ('true'), sonst inaktiv ('false'). Frontend-Komponenten
  // (OAuthButtons) prüfen das Flag und blenden die Buttons andernfalls
  // aus, damit nicht-konfigurierte Provider keine 500er werfen.
  env: {
    NEXT_PUBLIC_FEATURE_OAUTH_LOGIN: process.env.GOOGLE_CLIENT_ID
      ? 'true'
      : 'false',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
