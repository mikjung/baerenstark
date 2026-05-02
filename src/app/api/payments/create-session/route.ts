/**
 * POST /api/payments/create-session — US-28 AC2, AC3, AC4, AC5.
 *
 * Erzeugt eine Stripe-Checkout-Session und gibt die Stripe-URL zurück.
 *
 * Auth-Modi:
 *   1. Eingeloggter Kunde (`customer-session`-Cookie) → Booking muss
 *      `customerId === me.id` haben.
 *   2. Anonym mit `cancelToken` (Gast-Zahlung über E-Mail-Link).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { CreatePaymentSessionSchema } from '@/lib/schemas';
import { apiError, apiSuccess, internalError, zodErrorResponse } from '@/lib/api';
import { getCustomerFromRequest } from '@/lib/customer-auth-server';
import { getStripe, STRIPE_NOT_CONFIGURED_MESSAGE } from '@/lib/stripe';
import { paymentSessionLimiter, getClientIp } from '@/lib/ratelimit';
import { SERVICE_LABELS } from '@/lib/services';
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

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(req.headers);
    const limit = await paymentSessionLimiter.limit(`pay-create:${ip}`);
    if (!limit.success) {
      const retryAfter = Math.max(0, Math.ceil((limit.reset - Date.now()) / 1000));
      return apiError({
        code: 'RATE_LIMITED',
        message: 'Zu viele Anfragen. Bitte später erneut versuchen.',
        headers: { 'Retry-After': String(retryAfter || 600) },
      });
    }

    const stripe = getStripe();
    if (!stripe) {
      return apiError({
        code: 'STRIPE_NOT_CONFIGURED',
        message: STRIPE_NOT_CONFIGURED_MESSAGE,
      });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }

    const data = CreatePaymentSessionSchema.parse(json);

    const me = await getCustomerFromRequest(req);

    const booking = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { payment: true },
    });

    if (!booking) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    // Auth-Check
    if (me) {
      if (booking.customerId !== me.id) {
        return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
      }
    } else {
      if (!data.cancelToken || data.cancelToken !== booking.cancelToken) {
        return apiError({ code: 'UNAUTHORIZED', message: 'Bitte einloggen.' });
      }
    }

    if (!booking.payment) {
      return apiError({
        code: 'NOT_FOUND',
        message: 'Für diese Buchung wurde noch kein Betrag hinterlegt.',
      });
    }

    if (booking.payment.status === 'PAID') {
      return apiError({
        code: 'CONFLICT',
        message: 'Diese Buchung wurde bereits bezahlt.',
      });
    }
    if (booking.payment.status === 'REFUNDED') {
      return apiError({
        code: 'CONFLICT',
        message: 'Diese Zahlung wurde zurückerstattet.',
      });
    }

    const baseUrl = publicBaseUrl();
    let stripeSession;
    try {
      stripeSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card', 'paypal'],
        line_items: [
          {
            price_data: {
              currency: booking.payment.currency,
              product_data: {
                name: `Bärenstark Hausservice — ${SERVICE_LABELS[booking.service as Service] ?? booking.service}`,
                description: booking.payment.description ?? undefined,
              },
              unit_amount: booking.payment.amount,
            },
            quantity: 1,
          },
        ],
        metadata: {
          bookingId: booking.id,
          paymentId: booking.payment.id,
        },
        success_url: `${baseUrl}/konto/zahlung/erfolg?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/konto/zahlung/${booking.id}`,
        ...(booking.customerEmail
          ? { customer_email: booking.customerEmail }
          : {}),
        locale: 'de',
      });
    } catch (err) {
      console.error('[payments-create-session] stripe error:', err);
      return apiError({
        code: 'STRIPE_ERROR',
        message: 'Zahlung konnte nicht gestartet werden. Bitte erneut versuchen.',
      });
    }

    if (!stripeSession.url) {
      return apiError({
        code: 'STRIPE_ERROR',
        message: 'Stripe lieferte keine Checkout-URL zurück.',
      });
    }

    // Payment-Datensatz mit Session-ID aktualisieren. Bei FAILED → zurück
    // auf PENDING (neuer Versuch).
    await prisma.payment.update({
      where: { id: booking.payment.id },
      data: {
        stripeSessionId: stripeSession.id,
        ...(booking.payment.status === 'FAILED' ? { status: 'PENDING' } : {}),
      },
    });

    return apiSuccess(
      {
        url: stripeSession.url,
        sessionId: stripeSession.id,
      },
      201,
    );
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
