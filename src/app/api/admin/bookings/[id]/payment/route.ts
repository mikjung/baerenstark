/**
 * POST   /api/admin/bookings/:id/payment — US-28 AC1.
 * DELETE /api/admin/bookings/:id/payment — US-28 (Hilfs-Endpoint).
 *
 * Tom legt einen Zahlbetrag für eine Buchung fest. Es wird ein Payment-
 * Datensatz mit Status PENDING angelegt und eine Zahlungsaufforderung an
 * den Kunden geschickt.
 *
 * Wichtig: Endpoint funktioniert auch OHNE konfiguriertes Stripe — die
 * Datenbank-Operation und Mail-Versand sind unabhängig davon. Der
 * `STRIPE_NOT_CONFIGURED`-Hinweis wird im Response mitgeliefert, damit Tom
 * sieht, dass der Kunde ohne Stripe-Setup nicht bezahlen kann.
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CreatePaymentSchema } from '@/lib/schemas';
import { apiError, apiSuccess, apiNoContent, internalError, zodErrorResponse } from '@/lib/api';
import { sendPaymentRequestEmail } from '@/lib/mail';
import { isStripeConfigured } from '@/lib/stripe';
import type { Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function publicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const params = await ctx.params;
    const { id } = params;
    if (!id) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    const data = CreatePaymentSchema.parse(json);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!booking) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    if (booking.status !== 'CONFIRMED' && booking.status !== 'COMPLETED') {
      return apiError({
        code: 'CONFLICT',
        message: 'Zahlbetrag erst nach Terminbestätigung möglich.',
      });
    }

    if (booking.payment) {
      return apiError({
        code: 'CONFLICT',
        message: 'Für diese Buchung wurde bereits ein Betrag hinterlegt.',
      });
    }

    let payment;
    try {
      payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          amount: data.amount,
          currency: data.currency ?? 'eur',
          description: data.description ?? null,
          status: 'PENDING',
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return apiError({
          code: 'CONFLICT',
          message: 'Für diese Buchung wurde bereits ein Betrag hinterlegt.',
        });
      }
      throw err;
    }

    // Mail an Kunden — fire-and-forget. Auch wenn Stripe nicht konfiguriert
    // ist, schicken wir die Mail mit dem Portal-Link (Frontend zeigt dort
    // einen "Stripe nicht konfiguriert"-Hinweis bzw. Tom kann manuell
    // kassieren). Kunde wird per Cancel-Token authentifiziert.
    if (booking.customerEmail) {
      const paymentUrl = `${publicBaseUrl()}/konto/zahlung/${booking.id}?token=${encodeURIComponent(
        booking.cancelToken,
      )}`;
      void sendPaymentRequestEmail(booking.customerEmail, {
        bookingId: booking.id,
        amount: payment.amount,
        paymentUrl,
        customerName: booking.customerName,
        service: booking.service as Service,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
      }).catch((err) => {
        console.warn('[admin-payment] payment-request mail failed:', err);
      });
    }

    const stripeConfigured = isStripeConfigured();

    return apiSuccess(
      {
        id: payment.id,
        bookingId: payment.bookingId,
        stripeSessionId: payment.stripeSessionId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        description: payment.description,
        paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
        // Hinweis fürs Frontend: wenn nicht konfiguriert, ist `create-session`
        // nicht möglich. Tom kann den Betrag aber bereits dokumentieren.
        stripeConfigured,
        ...(stripeConfigured ? {} : { warning: 'STRIPE_NOT_CONFIGURED' }),
      },
      201,
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
    }

    const params = await ctx.params;
    const { id } = params;
    if (!id) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { bookingId: id },
    });

    if (!payment) {
      return apiError({ code: 'NOT_FOUND', message: 'Zahlung nicht gefunden.' });
    }

    if (payment.status !== 'PENDING') {
      return apiError({
        code: 'CONFLICT',
        message: 'Bereits bezahlte oder erstattete Zahlungen können nicht gelöscht werden.',
      });
    }

    await prisma.payment.delete({ where: { id: payment.id } });

    return apiNoContent();
  } catch (err) {
    return internalError(err);
  }
}
