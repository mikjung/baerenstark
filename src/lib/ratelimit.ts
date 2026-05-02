/**
 * Rate-Limit-Wrapper.
 *
 * - Wenn UPSTASH_REDIS_REST_URL und UPSTASH_REDIS_REST_TOKEN gesetzt sind:
 *   nutzt @upstash/ratelimit (sliding window, shared store über alle Vercel-
 *   Instanzen).
 * - Sonst: No-op-Limiter (gibt immer { success: true } zurück) — dokumentierter
 *   Fallback für lokale Entwicklung. Begründung in ARCHITECTURE.md §5.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix-ms-Timestamp wenn das Window endet
};

interface Limiter {
  limit(identifier: string): Promise<LimitResult>;
}

const noopLimiter: Limiter = {
  async limit() {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  },
};

function makeLimiter(
  windowSeconds: number,
  maxRequests: number,
  prefix: string,
): Limiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return noopLimiter;
  }

  const redis = new Redis({ url, token });
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    analytics: false,
    prefix,
  });

  return {
    async limit(identifier: string) {
      const res = await rl.limit(identifier);
      return {
        success: res.success,
        limit: res.limit,
        remaining: res.remaining,
        reset: res.reset,
      };
    },
  };
}

// 5 Login-Versuche / 15 Minuten / IP (BUG-004).
export const loginLimiter = makeLimiter(15 * 60, 5, 'rl:login');

// 10 Buchungs-Anfragen / 60 Minuten / IP (BUG-004).
export const bookingLimiter = makeLimiter(60 * 60, 10, 'rl:booking');

// 10 Datei-Uploads / 60 Sekunden / IP (Iteration 3 / US-18).
// Spec sagt 10/Min für die Auftragsstellung; Architektur-Doku 20/h.
// Wir nutzen das engere Limit, das im Aufgaben-Brief vorgegeben wurde.
export const uploadLimiter = makeLimiter(60, 10, 'rl:upload');

// ---------------------------------------------------------------------------
// Iteration 4 — Customer-Auth + Payments (siehe api-routes.md §20)
// ---------------------------------------------------------------------------

// 5 Registrierungen / 60 min / IP (siehe §11).
export const customerRegisterLimiter = makeLimiter(60 * 60, 5, 'rl:cust-reg');

// 10 Login-Versuche / 15 min / IP (siehe §11). Aufgaben-Brief sagt 5/15min;
// api-routes.md §20 sagt 10/15min — wir folgen der API-Spec.
export const customerLoginLimiter = makeLimiter(15 * 60, 10, 'rl:cust-login');

// 3 Forgot/Resend / 60 min / IP.
export const customerSensitiveActionLimiter = makeLimiter(
  60 * 60,
  3,
  'rl:cust-sensitive',
);

// 5 Reset-Versuche / 60 min / IP.
export const customerResetLimiter = makeLimiter(60 * 60, 5, 'rl:cust-reset');

// 5 Reviews / 60 min / Customer (per customerId).
export const customerReviewLimiter = makeLimiter(60 * 60, 5, 'rl:cust-review');

// 20 Stripe-Session-Erstellungen / 60 min / IP.
export const paymentSessionLimiter = makeLimiter(60 * 60, 20, 'rl:pay-session');

// 60 Session-Status-Polls / 5 min / IP.
export const paymentStatusLimiter = makeLimiter(5 * 60, 60, 'rl:pay-status');

/**
 * Liefert die anfragende IP aus den üblichen Vercel-Headern.
 * Fallback: 'unknown' (alle Anfragen ohne Header werden gemeinsam gezählt —
 * akzeptables Risiko in der Dev-Umgebung).
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  );
}
