/**
 * /api/bookings/:id/resend-mail  POST (admin) — Mail-Recovery.
 *
 * Idempotent: wenn mailSent === true bereits → 200 no-op.
 * Ansonsten: bis zu 3 Versuche; bei finalem Fehlschlag 502 MAIL_FAILED.
 */

import type { NextRequest } from 'next/server';
import { Service } from '@/lib/services';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError } from '@/lib/api';
import { sendBookingNotification } from '@/lib/mail';
import { ServiceSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
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

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { slot: true },
    });
    if (!booking) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    if (booking.mailSent) {
      return apiSuccess({
        id: booking.id,
        mailSent: true,
        mailError: null,
      });
    }

    // Service-Slug absichern (sollte immer ein gültiger Wert sein, aber wir
    // verteidigen uns gegen Datenmüll, der irgendwann an Resend ginge).
    const serviceParsed = ServiceSchema.safeParse(booking.service);
    const service: Service = serviceParsed.success ? serviceParsed.data : 'entruempelung';

    const result = await sendBookingNotification({
      bookingId: booking.id,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail,
      service,
      description: booking.description,
      slot: {
        startsAt: booking.slot.startsAt,
        endsAt: booking.slot.endsAt,
        description: booking.slot.description,
      },
    });

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        mailSent: result.ok,
        mailError: result.ok ? null : result.error.slice(0, 500),
      },
      select: { id: true, mailSent: true, mailError: true },
    });

    if (!result.ok) {
      return apiError({
        code: 'MAIL_FAILED',
        message: 'Mail-Versand ist fehlgeschlagen. Bitte später erneut versuchen.',
      });
    }

    return apiSuccess({
      id: updated.id,
      mailSent: updated.mailSent,
      mailError: updated.mailError,
    });
  } catch (err) {
    return internalError(err);
  }
}
