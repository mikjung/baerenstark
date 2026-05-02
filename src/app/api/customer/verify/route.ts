/**
 * GET /api/customer/verify?token=... — US-25 AC2.
 *
 * Aktiviert ein Konto via Verifikations-Link. Bei Erfolg → Redirect auf
 * `/konto?verified=true`. Bei Fehler → Redirect auf
 * `/konto/login?error=invalid_token`.
 *
 * BUG-401-Fix (v1.4.1): Ablauf wird gegen die dedizierte Spalte
 * `verificationTokenExpiry` geprüft (NICHT mehr gegen `createdAt + 24h`).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function publicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

function redirectTo(path: string): NextResponse {
  return NextResponse.redirect(`${publicBaseUrl()}${path}`, 302);
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return redirectTo('/konto/login?error=invalid_token');
    }

    const user = await prisma.customerUser.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      return redirectTo('/konto/login?error=invalid_token');
    }

    if (
      !user.verificationTokenExpiry ||
      user.verificationTokenExpiry.getTime() <= Date.now()
    ) {
      return redirectTo('/konto/login?error=invalid_token');
    }

    await prisma.customerUser.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return redirectTo('/konto?verified=1');
  } catch (err) {
    console.error('[customer-verify] unexpected error:', err);
    return redirectTo('/konto/login?error=invalid_token');
  }
}
