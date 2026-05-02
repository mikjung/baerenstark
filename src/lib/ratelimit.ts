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
