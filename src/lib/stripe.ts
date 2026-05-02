/**
 * Stripe-Integration (Iteration 4 / US-28).
 *
 * Singleton-Pattern mit Lazy-Init. Wenn `STRIPE_SECRET_KEY` nicht gesetzt
 * ist, gibt `getStripe()` `null` zurück — Aufrufer prüfen das und antworten
 * mit dem Fehlercode `STRIPE_NOT_CONFIGURED`. Damit bleibt das Backend in
 * Dev-Umgebungen ohne Stripe-Account bedienbar.
 */

import Stripe from 'stripe';

let cached: Stripe | null = null;
let failedInit = false;

/**
 * Liefert den Stripe-Client oder `null`, wenn `STRIPE_SECRET_KEY` fehlt
 * oder ein Placeholder ist.
 *
 * Engineers-Hinweis: Wir folgen dem Pattern der Mail-Lib (`getResend()`)
 * und filtern offensichtliche Platzhalter aktiv.
 */
export function getStripe(): Stripe | null {
  if (cached) return cached;
  if (failedInit) return null;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.length < 10) {
    failedInit = true;
    return null;
  }
  if (!/^sk_(test|live)_/.test(key)) {
    // Placeholder oder Tippfehler — wir wollen keine reale Stripe-Anfrage
    // mit einem fehlerhaften Key machen.
    failedInit = true;
    return null;
  }

  cached = new Stripe(key, {
    // 2024-11-20.acacia ist die zum Zeitpunkt von IT4 relevante stable API
    // Version. Stripe-Lib akzeptiert ältere Versionen via `as any`-Pattern,
    // aber wir setzen die Version, die zur installierten Lib passt.
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
    typescript: true,
  });
  return cached;
}

/**
 * Bequemer Boolean-Check für Routen, die nur "ist konfiguriert?" wissen
 * müssen.
 */
export function isStripeConfigured(): boolean {
  return getStripe() !== null;
}

export const STRIPE_NOT_CONFIGURED_MESSAGE =
  'Stripe ist nicht konfiguriert. Setzen Sie STRIPE_SECRET_KEY in der Umgebung.';
