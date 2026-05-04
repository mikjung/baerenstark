/**
 * IT12 / US-IT12-15 — GET /api/customer/unsubscribe?token=...
 *
 * Public Endpoint. Verifiziert den HMAC-Token (stateless, deterministisch
 * aus customerId + UNSUBSCRIBE_TOKEN_SECRET). Setzt
 * `CustomerUser.unsubscribedAt = now()` und redirect't auf
 * `/marketing/abgemeldet?ok=1` (oder `?error=invalid` bei kaputtem Token).
 *
 * Architektur-Verweis: ARCHITECTURE_IT12.md §R.4 (Endpoint #11) + §R.5.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/marketing-tokens';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function publicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

export async function GET(req: NextRequest): Promise<Response> {
  const base = publicBaseUrl();
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const customerId = verifyUnsubscribeToken(token);

    if (!customerId) {
      // Ungültiger Token → 302 mit error-Hint (kein Hint, ob die ID existiert).
      return NextResponse.redirect(`${base}/marketing/abgemeldet?error=invalid`, 302);
    }

    // Idempotent: wenn Customer schon abgemeldet, einfach success-Redirect.
    const customer = await prisma.customerUser.findUnique({
      where: { id: customerId },
      select: { id: true, unsubscribedAt: true },
    });
    if (!customer) {
      return NextResponse.redirect(`${base}/marketing/abgemeldet?error=invalid`, 302);
    }

    if (!customer.unsubscribedAt) {
      await prisma.customerUser.update({
        where: { id: customer.id },
        data: {
          unsubscribedAt: new Date(),
          unsubscribedReason: 'EMAIL_FOOTER',
        },
      });
    }

    // eslint-disable-next-line no-console
    console.info(`[marketing-audit] unsubscribe customerId=${customer.id}`);

    return NextResponse.redirect(`${base}/marketing/abgemeldet?ok=1`, 302);
  } catch (err) {
    // Bei DB-Fehler: redirect mit error=invalid, damit der User trotzdem
    // eine Seite sieht. Echter Fehler im Server-Log.
    // eslint-disable-next-line no-console
    console.error('[marketing-unsubscribe] failed:', err);
    return NextResponse.redirect(`${base}/marketing/abgemeldet?error=invalid`, 302);
  }
}
