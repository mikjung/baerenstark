/**
 * /api/bookings/rebook  GET + POST (public, Token-basiert) — US-13 AC4.
 *
 * GET ?token=xxx
 *   Liefert Booking-Infos für die Frontend-Prebefüllung (Re-Booking-Flow).
 *   Nur erlaubt, wenn Status COUNTER_PROPOSED. Sonst 410 GONE.
 *
 * POST { token, newSlotId }
 *   Setzt einen neuen Wunsch-Slot. Übergang COUNTER_PROPOSED → PENDING.
 *   Mail an Tom: "Kunde hat einen neuen Termin gewählt".
 */

import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { RebookingSchema, ServiceSchema } from '@/lib/schemas';
import {
  apiError,
  apiSuccess,
  internalError,
  zodErrorResponse,
} from '@/lib/api';
import {
  sendRebookingToAdmin,
  type CounterAcceptedMailPayload,
} from '@/lib/mail';
import { revalidateTag } from 'next/cache';
import type { Service } from '@/lib/services';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'COUNTER_PROPOSED'];

/**
 * GET /api/bookings/rebook?token=xxx
 * Lookup für das Frontend (Vorbefüllen der Buchungsseite mit Booking-Daten).
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return apiError({
        code: 'VALIDATION_ERROR',
        message: 'Token fehlt.',
        field: 'token',
      });
    }

    const booking = await prisma.booking.findUnique({
      where: { cancelToken: token },
      include: {
        slot: true,
        counterProposalSlot: true,
      },
    });
    if (!booking) {
      return apiError({
        code: 'NOT_FOUND',
        message: 'Diese Anfrage konnte nicht gefunden werden.',
      });
    }
    if (booking.status !== 'COUNTER_PROPOSED') {
      return apiError({
        code: 'GONE',
        message:
          'Diese Anfrage ist nicht mehr aktiv (z.B. bereits bestätigt oder storniert).',
      });
    }

    return apiSuccess({
      id: booking.id,
      status: booking.status,
      slotId: booking.slotId,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      service: booking.service,
      description: booking.description,
      currentSlot: booking.slot
        ? {
            id: booking.slot.id,
            startsAt: booking.slot.startsAt.toISOString(),
            endsAt: booking.slot.endsAt.toISOString(),
            description: booking.slot.description,
          }
        : null,
      counterProposalSlot: booking.counterProposalSlot
        ? {
            id: booking.counterProposalSlot.id,
            startsAt: booking.counterProposalSlot.startsAt.toISOString(),
            endsAt: booking.counterProposalSlot.endsAt.toISOString(),
            description: booking.counterProposalSlot.description,
          }
        : null,
    });
  } catch (err) {
    return internalError(err);
  }
}

/**
 * POST /api/bookings/rebook
 * Body: { token, newSlotId }
 * Setzt slotId = newSlotId, status = PENDING. Mail an Tom.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return apiError({ code: 'VALIDATION_ERROR', message: 'Body muss JSON sein' });
    }
    const { token, newSlotId } = RebookingSchema.parse(json);

    const booking = await prisma.booking.findUnique({
      where: { cancelToken: token },
      include: { slot: true },
    });
    if (!booking) {
      return apiError({
        code: 'NOT_FOUND',
        message: 'Diese Anfrage konnte nicht gefunden werden.',
      });
    }
    if (booking.status !== 'COUNTER_PROPOSED') {
      return apiError({
        code: 'GONE',
        message:
          'Diese Anfrage ist nicht mehr im Vorschlags-Status. Re-Booking nicht mehr möglich.',
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
        message: 'Der gewählte Slot existiert nicht.',
        field: 'newSlotId',
      });
    }
    if (newSlot.bookings.length > 0 && newSlot.bookings[0].id !== booking.id) {
      return apiError({
        code: 'CONFLICT',
        message: 'Der gewählte Slot ist bereits aktiv gebucht.',
      });
    }

    let updated;
    try {
      updated = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          slot: { connect: { id: newSlotId } },
          counterProposalSlot: { disconnect: true },
          status: 'PENDING',
          mailSent: false,
          mailError: null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return apiError({
          code: 'CONFLICT',
          message: 'Der gewählte Slot wurde gerade gebucht. Bitte einen anderen wählen.',
        });
      }
      throw err;
    }

    // Mail an Tom — fire-and-forget.
    const serviceParsed = ServiceSchema.safeParse(booking.service);
    const service: Service = serviceParsed.success
      ? serviceParsed.data
      : 'entruempelung';

    const payload: CounterAcceptedMailPayload = {
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail,
      service,
      newSlot: {
        startsAt: newSlot.startsAt,
        endsAt: newSlot.endsAt,
        description: newSlot.description,
      },
    };
    void sendRebookingToAdmin(payload)
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
            console.error('[rebook] db-update failed:', err),
          ),
      )
      .catch((err) => console.error('[rebook] mail send threw:', err));

    try {
      revalidateTag('slots');
    } catch {
      /* ignore */
    }

    return apiSuccess({
      id: updated.id,
      status: updated.status,
      slotId: updated.slotId,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ZodError) return zodErrorResponse(err);
    return internalError(err);
  }
}
