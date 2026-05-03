/**
 * POST /api/customer/reset-password — Iteration 7 / US-IT7-05.
 *
 * Body:    `CustomerResetPasswordSchema` — `{ token, password, passwordConfirm }`.
 * Auth:    keine (Token = Authority).
 * Response 200: `{ ok: true }` — KEIN customerUser-DTO, KEIN passwordHash.
 *
 * **m2-IT7 — Conditional UPDATE für atomare Token-Verbrauchs-Logik:**
 *   - Statt Read-then-Write nutzen wir `prisma.$executeRaw` mit
 *     `UPDATE password_reset_tokens SET usedAt=NOW() WHERE id=:id
 *        AND usedAt IS NULL AND expiresAt > NOW()`.
 *   - Wenn `affectedRows === 1` → Token war gültig, Token jetzt verbraucht.
 *   - Wenn `affectedRows === 0` → Token bereits verbraucht / abgelaufen
 *     → 410 INVALID_OR_EXPIRED_TOKEN.
 *   - Erst DANACH neuen `passwordHash` auf User setzen, im selben
 *     `$transaction`. Verhindert TOCTOU-Race (P4 in QA-Plan).
 *
 * Sicherheits-Anker:
 *   - bcrypt cost 12 → `customer_users.passwordHash`.
 *   - SHA-256-Hex(token) gegen DB-Hash (UNIQUE-Constraint auf tokenHash).
 *   - Cookie wird NICHT gesetzt — Kunde muss neu einloggen
 *     (= explizite Re-Authentication).
 *   - Rate-Limit: 5/h IP.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import {
  apiError,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import { CustomerResetPasswordSchema } from '@/lib/schemas';
import {
  resetPasswordIpLimiter,
  getClientIp,
} from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // 1. Rate-Limit IP.
    const ip = getClientIp(req.headers);
    const ipLimit = await resetPasswordIpLimiter.limit(`reset:ip:${ip}`);
    if (!ipLimit.success) {
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Versuche. Bitte später erneut.',
      });
    }

    // 2. Body parsen + validieren.
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const data = CustomerResetPasswordSchema.parse(json);
    const tokenHash = sha256Hex(data.token);

    // 3. Token-Lookup (nur ID + customerId — keine sensiblen Felder).
    const tokenRow = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, customerId: true, expiresAt: true, usedAt: true },
    });

    if (
      !tokenRow ||
      tokenRow.usedAt !== null ||
      tokenRow.expiresAt.getTime() <= Date.now()
    ) {
      return apiError({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Dieser Link ist nicht mehr gültig. Bitte fordern Sie einen neuen Reset-Link an.',
      });
    }

    // 4. m2-IT7: Conditional UPDATE für atomaren Token-Verbrauch.
    //    Wenn das UPDATE 0 Zeilen betrifft → ein paralleler Reset hat
    //    den Token bereits verbraucht (TOCTOU-Race) → 410.
    //
    //    Hinweis libSQL/SQLite: `CURRENT_TIMESTAMP` liefert UTC.
    //    `expiresAt > CURRENT_TIMESTAMP` greift auch bei abgelaufenen
    //    Tokens (Defense-in-Depth zur Read-Time-Prüfung oben).
    const passwordHash = await bcrypt.hash(data.password, 12);

    const txResult = await prisma.$transaction(async (tx) => {
      // Prisma + SQLite/libSQL: DateTime-Spalten sind ISO-Text (UTC).
      // Wir binden `new Date()` per Parameter — der Adapter formatiert
      // das ISO-konform und stellt sicher dass Vergleiche funktionieren.
      // `CURRENT_TIMESTAMP` (SQLite) wäre `'YYYY-MM-DD HH:MM:SS'` und
      // würde lexikografisch FALSCH gegen ISO-mit-Millisekunden sortieren.
      const now = new Date();
      const affectedRows = await tx.$executeRaw`
        UPDATE password_reset_tokens
           SET usedAt = ${now}
         WHERE id = ${tokenRow.id}
           AND usedAt IS NULL
           AND expiresAt > ${now}
      `;
      if (Number(affectedRows) !== 1) {
        // Race-Verlierer: Token wurde von einem parallelen Aufruf
        // bereits verbraucht.
        return { ok: false as const };
      }
      // Erst nach erfolgreichem Token-Lock setzen wir den neuen Hash.
      await tx.customerUser.update({
        where: { id: tokenRow.customerId },
        data: { passwordHash },
      });
      return { ok: true as const };
    });

    if (!txResult.ok) {
      return apiError({
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Dieser Link ist nicht mehr gültig. Bitte fordern Sie einen neuen Reset-Link an.',
      });
    }

    // 5. Konstante Response — kein DTO, kein passwordHash, kein Cookie.
    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
