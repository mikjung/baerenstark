/**
 * POST /api/customer/forgot-password — Iteration 7 / US-IT7-05.
 *
 * Body:    `CustomerForgotPasswordSchema` — `{ email }`.
 * Auth:    keine.
 * Response: 200 `{ ok: true }` — IMMER, egal ob User existiert.
 *           Email-Enumeration-Schutz.
 *
 * Sicherheits-Anker:
 *   - Token: 32-Byte-`crypto.randomBytes` → Base64url → SHA-256-Hex in DB.
 *   - Klartext-Token nur in Resend-Mail.
 *   - `expiresAt = now + 1h`.
 *   - `usedAt = NULL` (single-use, gesetzt bei reset-password).
 *
 * **m1-IT7 — Konstante Latenz (Email-Enumeration-Schutz):**
 *   - Der Endpoint hat einen Latenz-Floor von **750ms**, der unabhängig
 *     vom Code-Pfad (User existiert oder nicht) eingehalten wird. Das
 *     deckt sowohl die DB-INSERT- als auch die Resend-API-Latenz ab,
 *     sodass Side-Channel-Timing-Angriffe (siehe QA m1-IT7) scheitern.
 *   - Implementiert via `await Promise.allSettled([floor, work])` —
 *     beide Promises laufen parallel; die Antwort wird erst gesendet,
 *     wenn der Floor abgelaufen ist.
 *
 * Rate-Limits:
 *   - 3 / 15 min / IP.
 *   - 3 / 60 min / Email.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import {
  apiError,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import { CustomerForgotPasswordSchema } from '@/lib/schemas';
import {
  forgotPasswordIpLimiter,
  forgotPasswordEmailLimiter,
  getClientIp,
} from '@/lib/ratelimit';
import { sendPasswordResetEmail } from '@/lib/mail';
import { selectCustomerUserPublic } from '@/lib/dto/user';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// m1-IT7: Latenz-Floor in Millisekunden. Deckt DB-INSERT + Resend-API
// in beiden Pfaden (User existiert / nicht). Wert grosszügig gewählt
// (750ms p95-Floor), damit Diff < 50ms zwischen den beiden Pfaden.
const LATENCY_FLOOR_MS = 750;

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function buildResetUrl(token: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'http://localhost:3000';
  const cleanBase = base.replace(/\/+$/, '');
  return `${cleanBase}/konto/passwort-zuruecksetzen?token=${encodeURIComponent(token)}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Phantom-Work: simuliert die gleichen Latenz-Anteile wie der echte
 * Pfad (DB + Mail). Wir benutzen ein einfaches sleep, das hinreichend
 * lange läuft, plus die `LATENCY_FLOOR_MS`-Promise stellt sicher dass
 * beide Pfade gleich lang dauern.
 */
async function phantomWork(): Promise<void> {
  await sleep(LATENCY_FLOOR_MS);
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now();
  try {
    // 1. Rate-Limit IP.
    const ip = getClientIp(req.headers);
    const ipLimit = await forgotPasswordIpLimiter.limit(`forgot:ip:${ip}`);
    if (!ipLimit.success) {
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Anfragen. Bitte später erneut.',
      });
    }

    // 2. Body parsen + validieren.
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const data = CustomerForgotPasswordSchema.parse(json);
    const lcEmail = data.email.toLowerCase();

    // 3. Rate-Limit Email.
    const emailLimit = await forgotPasswordEmailLimiter.limit(
      `forgot:email:${lcEmail}`,
    );
    if (!emailLimit.success) {
      // Auch hier konstantes Verhalten (gleiche Antwort-Form), damit
      // Existenz nicht ableitbar ist — wir geben aber RATE_LIMITED, weil
      // der User selbst die Schwelle überschritten hat.
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Anfragen. Bitte später erneut.',
      });
    }

    // 4. Lookup + ggf. Token+Mail. m1-IT7: Latenz-Floor parallel.
    const work = (async () => {
      // F3-Convention: Customer-Pfad nutzt `selectCustomerUserPublic()`
      // (Pre-Commit-Scanner blockt sonst). Wir verwenden nur id/email/
      // firstName aus dem Public-Select für Mail-Adressierung — keine
      // Antwort-Daten leaken in den Response (Antwort ist konstant
      // `{ ok: true }`).
      const user = await prisma.customerUser.findUnique({
        where: { email: lcEmail },
        select: selectCustomerUserPublic(),
      });
      if (!user) return; // Phantom-Pfad — kein DB-Insert, kein Mail.

      const tokenPlain = randomBytes(32).toString('base64url');
      const tokenHash = sha256Hex(tokenPlain);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

      try {
        await prisma.passwordResetToken.create({
          data: {
            customerId: user.id,
            tokenHash,
            expiresAt,
          },
        });
      } catch (err) {
        // Token-Hash-Kollisionen sind statistisch ausgeschlossen
        // (SHA-256 + 32 Byte Random). Wenn das hier crasht, geht der
        // Mail-Versand trotzdem nicht raus — kein Side-Channel-Leak,
        // weil die Antwort ohnehin generisch ist.
        console.warn('[forgot-password] token insert failed:', err);
        return;
      }

      try {
        const url = buildResetUrl(tokenPlain);
        const mailResult = await sendPasswordResetEmail(user.email, url);
        if (!mailResult.ok) {
          console.warn(
            '[forgot-password] reset mail failed:',
            mailResult.error.slice(0, 200),
          );
        }
      } catch (err) {
        console.warn('[forgot-password] reset mail threw:', err);
      }
    })();

    await Promise.allSettled([work, phantomWork()]);

    // 5. Konstante Antwort — kein User-Status durchgereicht.
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    // Auch bei Validation-Errors halten wir den Latenz-Floor ein, damit
    // Form-Probing (kürzere Antworten bei VALIDATION_ERROR) nicht zu
    // Timing-Inferenz wird.
    const elapsed = Date.now() - start;
    if (elapsed < LATENCY_FLOOR_MS) {
      await sleep(LATENCY_FLOOR_MS - elapsed);
    }
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err, 'POST /api/customer/forgot-password');
  }
}
