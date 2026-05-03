/**
 * BASE_URL-Resolver für Reset-/Verifikations-Links + OAuth-Callback.
 *
 * Iteration 5 / US-30 Fix: Auf Vercel ist `NEXTAUTH_URL` die Single-source-of-
 * truth (vom Hosting auto-injected). In Dev/Custom-Setups erlauben wir
 * `NEXT_PUBLIC_BASE_URL` und fallen auf `VERCEL_URL` (ohne Schema) bzw.
 * `localhost:3000` zurück.
 *
 * Garantien:
 *  - kein trailing slash
 *  - immer ein gültiger String mit Schema (http/https) bzw. localhost:3000
 */
export function adminBaseUrl(): string {
  const candidates: (string | null | undefined)[] = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:3000',
  ];
  const first = candidates.find(
    (c): c is string => typeof c === 'string' && c.length > 0,
  )!;
  return first.replace(/\/+$/, '');
}

/**
 * Alias mit identischer Logik für Kunden-OAuth-Callback (US-31). Beide
 * Kontexte teilen dieselbe Auflösungs-Reihenfolge.
 */
export const customerBaseUrl = adminBaseUrl;
