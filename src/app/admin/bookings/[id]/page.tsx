/**
 * IT14 / US-IT14-S06 — Admin-Booking-Detail-Page.
 *
 * Server-Component-Wrapper. Rolle:
 *   1. Auth-Gate: `await requireActiveAdmin()` als erste Anweisung.
 *   2. Booking laden — alle Felder, die der Detail-View braucht (Slot,
 *      Anhänge, Payment, Customer-Beziehung).
 *   3. Bei `notFound()`: Next.js rendert 404.
 *   4. Daten an `<AdminBookingDetailView>` (Client-Component) reichen.
 *
 * Spec:
 *   - frontend-requirements-it14.md §4 (S06).
 *   - ux-spec-iteration-14.md §5a.
 *   - ARCHITECTURE_IT14.md §5.4.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireActiveAdmin } from '@/lib/require-admin';
import { AdminBookingDetailView } from '@/components/admin/AdminBookingDetailView';
import type { PaymentMethod } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Buchung – Bärenstark Admin',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminBookingDetailPage({ params }: PageProps) {
  // Schicht-3 Defense-in-Depth (siehe ARCHITECTURE_IT14.md §2): Page-Level-
  // Check zusätzlich zur Middleware. Kein Try/Catch — `redirect()` wirft
  // intern und wird von Next.js korrekt verarbeitet.
  await requireActiveAdmin();

  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      slot: true,
      counterProposalSlot: true,
      attachments: true,
      payment: true,
    },
  });

  if (!booking) {
    notFound();
  }

  // Prisma-Decimal serialisieren für Client-Component (Server→Client-Boundary
  // kann keine Decimal-Klasse übertragen). Strings entsprechen dem Format,
  // das Admin-API-Endpoints liefern (`finalPriceEur: "150.00"`).
  const detail = {
    id: booking.id,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail ?? null,
    customerPhone: booking.customerPhone,
    addressStreet: booking.addressStreet ?? null,
    addressZip: booking.addressZip ?? null,
    addressCity: booking.addressCity ?? null,
    service: booking.service,
    description: booking.description,
    status: booking.status as
      | 'PENDING'
      | 'CONFIRMED'
      | 'REJECTED'
      | 'COUNTER_PROPOSED'
      | 'CANCELLED'
      | 'COMPLETED',
    date: booking.date ?? null,
    startTime: booking.startTime ?? null,
    endTime: booking.endTime ?? null,
    durationMinutes: booking.durationMinutes,
    slot: booking.slot
      ? {
          id: booking.slot.id,
          startsAt: booking.slot.startsAt.toISOString(),
          endsAt: booking.slot.endsAt.toISOString(),
          description: booking.slot.description ?? null,
          deletedAt: booking.slot.deletedAt
            ? booking.slot.deletedAt.toISOString()
            : null,
        }
      : null,
    counterProposalSlot: booking.counterProposalSlot
      ? {
          id: booking.counterProposalSlot.id,
          startsAt: booking.counterProposalSlot.startsAt.toISOString(),
          endsAt: booking.counterProposalSlot.endsAt.toISOString(),
          description: booking.counterProposalSlot.description ?? null,
        }
      : null,
    attachments: booking.attachments.map((a) => ({
      id: a.id,
      url: a.url,
      filename: a.filename,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
    })),
    finalPriceEur:
      booking.finalPriceEur != null
        ? String(booking.finalPriceEur as unknown as string | number)
        : null,
    finalPriceNote: booking.finalPriceNote ?? null,
    paymentMethod:
      (booking.paymentMethod as PaymentMethod | null | undefined) ?? null,
    payment: booking.payment
      ? {
          id: booking.payment.id,
          bookingId: booking.payment.bookingId,
          amount: booking.payment.amount,
          currency: booking.payment.currency,
          status: booking.payment.status as
            | 'PENDING'
            | 'PAID'
            | 'FAILED'
            | 'REFUNDED',
          paidAt: booking.payment.paidAt
            ? booking.payment.paidAt.toISOString()
            : null,
          stripeSessionId: booking.payment.stripeSessionId ?? null,
          description: booking.payment.description ?? null,
          createdAt: booking.payment.createdAt.toISOString(),
          updatedAt: booking.payment.updatedAt.toISOString(),
        }
      : null,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };

  return <AdminBookingDetailView booking={detail} />;
}
