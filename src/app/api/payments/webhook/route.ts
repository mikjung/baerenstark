/**
 * POST /api/payments/webhook — US-28 AC6.
 *
 * Stripe-Webhook-Endpoint. Stripe sendet POST mit Event-Payload und
 * `stripe-signature`-Header.
 *
 * Sicherheits-Anforderungen:
 *   1. Raw-Body (NICHT JSON!) — `await req.text()`.
 *   2. Stripe-Signatur via `STRIPE_WEBHOOK_SECRET` validieren.
 *   3. Idempotenz: Status-Check vor Update (kein Double-Mail).
 */

import type { NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import {
  sendPaymentReceivedEmail,
  sendPaymentReceivedToCustomer,
} from '@/lib/mail';
import type { Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function adminToAddress(): string {
  return (
    process.env.MAIL_TO_ADMIN || 'hausservice-baerenstark@outlook.com'
  );
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const sessionId = session.id;
  const payment = await prisma.payment.findUnique({
    where: { stripeSessionId: sessionId },
    include: {
      booking: { select: { customerEmail: true, customerName: true, service: true, id: true } },
    },
  });

  if (!payment) {
    console.warn(
      '[stripe-webhook] payment not found for session',
      sessionId,
    );
    return;
  }

  if (payment.status === 'PAID') {
    // Idempotenz — kein Update, keine zweite Mail.
    return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });

  if (payment.booking) {
    const adminPayload = {
      amount: payment.amount,
      customerName: payment.booking.customerName,
      service: payment.booking.service as Service,
      bookingId: payment.booking.id,
    };
    void sendPaymentReceivedEmail(adminToAddress(), adminPayload).catch((err) => {
      console.warn('[stripe-webhook] admin mail failed:', err);
    });
    if (payment.booking.customerEmail) {
      void sendPaymentReceivedToCustomer(
        payment.booking.customerEmail,
        adminPayload,
      ).catch((err) => {
        console.warn('[stripe-webhook] customer mail failed:', err);
      });
    }
  }
}

async function handleCheckoutExpired(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (!payment || payment.status === 'PAID') return;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'FAILED' },
  });
}

async function handlePaymentFailed(
  pi: Stripe.PaymentIntent,
): Promise<void> {
  // PaymentIntent → finde Session über Metadata (bookingId / paymentId).
  const paymentId =
    typeof pi.metadata?.paymentId === 'string' ? pi.metadata.paymentId : null;
  if (!paymentId) return;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === 'PAID') return;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'FAILED' },
  });
}

async function handleChargeRefunded(
  charge: Stripe.Charge,
): Promise<void> {
  const sessionId =
    typeof charge.metadata?.sessionId === 'string'
      ? charge.metadata.sessionId
      : null;
  // Stripe-Charges referenzieren Payments via `payment_intent` → wir
  // suchen indirekt. Als Fallback nutzen wir `metadata.paymentId`, falls
  // unsere Checkout-Session sie weiterreicht.
  const paymentId =
    typeof charge.metadata?.paymentId === 'string'
      ? charge.metadata.paymentId
      : null;

  let payment = paymentId
    ? await prisma.payment.findUnique({ where: { id: paymentId } })
    : null;

  if (!payment && sessionId) {
    payment = await prisma.payment.findUnique({
      where: { stripeSessionId: sessionId },
    });
  }

  if (!payment) return;

  if (payment.status === 'REFUNDED') return;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'REFUNDED' },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Missing signature' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    // Stripe nicht konfiguriert — wir lehnen still ab. Stripe wiederholt nicht
    // wegen 400, aber das ist OK in einer Dev-Umgebung ohne Stripe-Setup.
    return new Response(
      JSON.stringify({ error: { code: 'STRIPE_NOT_CONFIGURED', message: 'Stripe not configured.' } }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Raw-Body als String (Buffer ist im Edge-Runtime nicht verfügbar; Stripe-
  // Lib akzeptiert beide, weil constructEvent intern UTF-8-Bytes nimmt).
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.warn('[stripe-webhook] signature check failed:', err);
    return new Response(
      JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid signature' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.expired':
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        // Andere Event-Types: ignorieren, aber 200 zurück (Stripe-Konvention).
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] handler threw:', err);
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
