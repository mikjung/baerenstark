/**
 * /api/bookings/:id/counter-proposal  POST (admin) — US-13 AC1.
 *
 * Admin schlägt einer offenen (PENDING) Buchungsanfrage einen Alternativ-Slot vor.
 * Status wird auf COUNTER_PROPOSED gesetzt; counterProposalSlotId zeigt auf den
 * neuen Slot. Mail mit 3 Aktionslinks geht fire-and-forget an den Kunden.
 *
 * Validierung:
 *   - Booking muss Status PENDING haben (sonst 409 CONFLICT).
 *   - newSlotId muss existieren, nicht soft-deleted, ≠ aktueller slotId.
 *   - newSlotId darf keine aktive Buchung haben (PENDING/CONFIRMED/COUNTER_PROPOSED).
 *
 * Slot-Locking: der ursprüngliche Slot bleibt durch die Booking selbst gesperrt
 * (COUNTER_PROPOSED zählt im Partial Unique Index als aktiv). Der vorgeschlagene
 * Slot wird NICHT zusätzlich gesperrt — Trade-off im MVP (siehe ARCHITECTURE.md §3).
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  CounterProposalSchema,
  ServiceSchema,
} from '@/lib/schemas';
import {
  apiError,
  apiSuccess,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import {
  sendCounterProposalToCustomer,
  type CounterProposalMailPayload,
} from '@/lib/mail';
import { revalidateTag } from 'next/cache';
import type { Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'];

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
      return apiError({ code: 'VALIDATION_ERROR', message: 'Booking-ID fehlt.', field: 'id' });
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const { newSlotId } = CounterProposalSchema.parse(json);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { slot: true },
    });
    if (!booking) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    if (booking.status !== 'PENDING') {
      return apiError({
        code: 'CONFLICT',
        message: 'Alternativvorschlag ist nur für offene Anfragen (PENDING) möglich.',
      });
    }

    // Counter-Proposal arbeitet nur auf Bestand-Buchungen mit slot (US-13).
    // IT3-Date/Time-Buchungen unterstützen Counter-Proposal noch nicht (Backlog).
    if (!booking.slot) {
      return apiError({
        code: 'CONFLICT',
        message:
          'Alternativvorschlag ist für Date/Time-basierte Buchungen aktuell nicht verfügbar.',
      });
    }

    if (newSlotId === booking.slotId) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Der Alternativ-Slot darf nicht der aktuelle Slot sein.',
        field: 'newSlotId',
      });
    }

    const newSlot = await prisma.slot.findUnique({
      where: { id: newSlotId },
      include: {
        bookings: {
          where: { status: { in: ACTIVE_STATUSES } },
          select: { id: true },
        },
      },
    });
    if (!newSlot || newSlot.deletedAt !== null) {
      return apiError({
        code: 'NOT_FOUND',
        message: 'Der gewählte Alternativ-Slot existiert nicht.',
        field: 'newSlotId',
      });
    }
    if (newSlot.bookings.length > 0) {
      return apiError({
        code: 'CONFLICT',
        message: 'Der gewählte Alternativ-Slot hat bereits eine aktive Buchung.',
      });
    }

    let updated;
    try {
      updated = await prisma.booking.update({
        where: { id },
        data: {
          status: 'COUNTER_PROPOSED',
          counterProposalSlotId: newSlotId,
          // Reset mail-status, damit Admin-UI sieht, ob die Vorschlags-Mail durchging.
          mailSent: false,
          mailError: null,
        },
        include: { counterProposalSlot: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return apiError({
          code: 'CONFLICT',
          message:
            'Konflikt beim Speichern des Alternativvorschlags. Bitte erneut versuchen.',
        });
      }
      throw err;
    }

    // Service-Slug absichern.
    const serviceParsed = ServiceSchema.safeParse(booking.service);
    const service: Service = serviceParsed.success ? serviceParsed.data : 'entruempelung';

    // Fire-and-forget Mail an den Kunden.
    if (booking.customerEmail) {
      const payload: CounterProposalMailPayload = {
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        service,
        cancelToken: booking.cancelToken,
        originalSlot: {
          startsAt: booking.slot.startsAt,
          endsAt: booking.slot.endsAt,
        },
        proposedSlot: {
          startsAt: updated.counterProposalSlot!.startsAt,
          endsAt: updated.counterProposalSlot!.endsAt,
          description: updated.counterProposalSlot!.description,
        },
      };

      void sendCounterProposalToCustomer(payload)
        .then((res) =>
          prisma.booking
            .update({
              where: { id: booking.id },
              data: {
                mailSent: res.ok,
                mailError: res.ok ? null : res.error.slice(0, 500),
              },
            })
            .catch((err) =>
              console.error('[counter-proposal] db-update failed:', err),
            ),
        )
        .catch((err) => {
          console.error('[counter-proposal] mail send threw:', err);
        });
    } else {
      // Sollte gemäß Iteration-2-Schema nicht passieren (customerEmail ist
      // Pflicht), aber zur Sicherheit markieren wir den Mail-Status.
      await prisma.booking
        .update({
          where: { id: booking.id },
          data: {
            mailSent: false,
            mailError: 'Keine Kunden-E-Mail vorhanden.',
          },
        })
        .catch(() => {});
    }

    try {
      revalidateTag('slots');
    } catch {
      /* ignore */
    }

    return apiSuccess({
      id: updated.id,
      status: updated.status,
      counterProposalSlot: updated.counterProposalSlot
        ? {
            id: updated.counterProposalSlot.id,
            startsAt: updated.counterProposalSlot.startsAt.toISOString(),
            endsAt: updated.counterProposalSlot.endsAt.toISOString(),
            description: updated.counterProposalSlot.description,
          }
        : null,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
