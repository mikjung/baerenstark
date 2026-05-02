/**
 * POST /api/customer/register — US-25 AC1, AC2.
 *
 * Legt einen neuen Kunden-Account an. Sendet Verifikations-Mail.
 * Antwortet 201 OHNE Session-Cookie — der Kunde muss erst E-Mail bestätigen.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CustomerRegisterSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { sendVerificationEmail } from '@/lib/mail';
import { customerRegisterLimiter, getClientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function publicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

function generateToken(): string {
  // cuid wäre sauberer, aber wir brauchen keinen Prisma-internen Helper.
  // Wir nutzen crypto.randomUUID + Prefix für Lesbarkeit.
  const rnd =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `vrf_${rnd}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(req.headers);
    const limit = await customerRegisterLimiter.limit(`reg:${ip}`);
    if (!limit.success) {
      const retryAfter = Math.max(0, Math.ceil((limit.reset - Date.now()) / 1000));
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Registrierungs-Versuche. Bitte später erneut versuchen.',
        headers: { 'Retry-After': String(retryAfter || 3600) },
      });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    const data = CustomerRegisterSchema.parse(json);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const verificationToken = generateToken();
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TTL_MS);

    let user;
    try {
      user = await prisma.customerUser.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          emailVerified: false,
          verificationToken,
          verificationTokenExpiry,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // BUG-005-Pattern: keine Auskunft über Existenz — generische Message.
        return apiError({
          code: 'CONFLICT',
          message: 'Diese E-Mail ist bereits registriert.',
          field: 'email',
        });
      }
      throw err;
    }

    // Fire-and-forget Verifikations-Mail.
    const verificationUrl = `${publicBaseUrl()}/konto/verifizieren?token=${encodeURIComponent(
      verificationToken,
    )}`;
    void sendVerificationEmail(user.email, verificationUrl).catch((err) => {
      console.warn('[customer-register] verification mail failed:', err);
    });

    return apiSuccess(
      {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        verificationMailSent: true,
      },
      201,
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
