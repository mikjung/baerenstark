/**
 * /api/bookings/respond  GET (public, Token-basiert) — US-13 / US-14.
 *
 * Aufruf via E-Mail-Link: ?token=<cancelToken>&action=accept|cancel
 *
 * action=accept (US-13 AC3):
 *   COUNTER_PROPOSED → CONFIRMED
 *   slotId = counterProposalSlotId; counterProposalSlotId = NULL.
 *   Mail an Tom: "Kunde hat Alternativvorschlag angenommen".
 *   Redirect → /buchung/bestaetigt?bookingId=<id>&accepted=true
 *
 * action=cancel (US-14 AC1/AC2):
 *   PENDING|COUNTER_PROPOSED → CANCELLED
 *   Mail an Tom: "Kunde hat Anfrage storniert".
 *   Redirect → /buchung/storno?bookingId=<id>&cancelled=true
 *
 * Idempotenz/Endstatus:
 *   - Booking existiert nicht → Redirect /buchung?error=invalid-token
 *   - Bei action=accept und Status ≠ COUNTER_PROPOSED → Redirect zur passenden
 *     Bestätigungsseite mit ?status=gone (kein Fehler).
 *   - Bei action=cancel und Status in CONFIRMED/REJECTED/CANCELLED → Redirect
 *     /buchung/storno?status=gone.
 *
 * Trade-off GET-Endpoint mit Side-Effects: bewusst, weil Mail-Clients keine
 * POST-Forms öffnen. Idempotenz wird über Status-Check garantiert.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { TokenActionSchema, ServiceSchema } from '@/lib/schemas';
import {
  sendCounterAcceptedToAdmin,
  sendCancellationToAdmin,
  type CounterAcceptedMailPayload,
  type CancellationMailPayload,
} from '@/lib/mail';
import { revalidateTag } from 'next/cache';
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

function redirectTo(path: string): NextResponse {
  const url = `${publicBaseUrl()}${path}`;
  return NextResponse.redirect(url, 302);
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const tokenRaw = url.searchParams.get('token');
    const actionRaw = url.searchParams.get('action');

    const parsed = TokenActionSchema.safeParse({
      token: tokenRaw ?? '',
      action: actionRaw ?? '',
    });
    if (!parsed.success) {
      return redirectTo('/buchung?error=invalid-token');
    }
    const { token, action } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { cancelToken: token },
      include: {
        slot: true,
        counterProposalSlot: true,
      },
    });

    if (!booking) {
      return redirectTo('/buchung?error=invalid-token');
    }

    const serviceParsed = ServiceSchema.safeParse(booking.service);
    const service: Service = serviceParsed.success
      ? serviceParsed.data
      : 'entruempelung';

    if (action === 'accept') {
      // Übergang nur erlaubt, wenn aktuell COUNTER_PROPOSED.
      if (booking.status !== 'COUNTER_PROPOSED') {
        // Idempotenz-Pfad: Wenn schon angenommen (CONFIRMED), Redirect zur Bestätigungsseite.
        if (booking.status === 'CONFIRMED') {
          return redirectTo(
            `/buchung/bestaetigt?bookingId=${booking.id}&status=already`,
          );
        }
        // Andernfalls: Endstatus → /buchung/bestaetigt mit Hinweis "gone".
        return redirectTo(
          `/buchung/bestaetigt?bookingId=${booking.id}&status=gone`,
        );
      }

      const proposed = booking.counterProposalSlot;
      if (!proposed || proposed.deletedAt !== null) {
        // Vorgeschlagener Slot ist nicht mehr da → Redirect mit Fehler.
        return redirectTo(
          `/buchung/bestaetigt?bookingId=${booking.id}&status=gone`,
        );
      }

      try {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: 'CONFIRMED',
            slot: { connect: { id: proposed.id } },
            counterProposalSlot: { disconnect: true },
            // Mail-Status zurücksetzen für die "Vorschlag angenommen"-Mail an Tom.
            mailSent: false,
            mailError: null,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          // Vorgeschlagener Slot wurde inzwischen anderweitig aktiv gebucht.
          return redirectTo(
            `/buchung/bestaetigt?bookingId=${booking.id}&status=conflict`,
          );
        }
        throw err;
      }

      // Mail an Tom (fire-and-forget).
      const adminPayload: CounterAcceptedMailPayload = {
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerEmail: booking.customerEmail,
        service,
        newSlot: {
          startsAt: proposed.startsAt,
          endsAt: proposed.endsAt,
          description: proposed.description,
        },
      };
      void sendCounterAcceptedToAdmin(adminPayload)
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
              console.error('[respond:accept] db-update failed:', err),
            ),
        )
        .catch((err) =>
          console.error('[respond:accept] mail send threw:', err),
        );

      try {
        revalidateTag('slots');
      } catch {
        /* ignore */
      }

      return redirectTo(
        `/buchung/bestaetigt?bookingId=${booking.id}&accepted=true`,
      );
    }

    // action === 'cancel'
    if (
      booking.status === 'CONFIRMED' ||
      booking.status === 'REJECTED' ||
      booking.status === 'CANCELLED'
    ) {
      // Endstatus erreicht → idempotent: zur Storno-Seite mit Hinweis.
      const flag =
        booking.status === 'CANCELLED' ? 'already' : 'gone';
      return redirectTo(
        `/buchung/storno?bookingId=${booking.id}&status=${flag}`,
      );
    }

    // Status ist PENDING oder COUNTER_PROPOSED → CANCELLED setzen.
    const originalSlot = booking.slot;
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
        counterProposalSlot: { disconnect: true },
        mailSent: false,
        mailError: null,
      },
    });

    const cancelPayload: CancellationMailPayload = {
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail,
      service,
      description: booking.description,
      originalSlot: originalSlot
        ? {
            startsAt: originalSlot.startsAt,
            endsAt: originalSlot.endsAt,
          }
        : null,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
    };
    void sendCancellationToAdmin(cancelPayload)
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
            console.error('[respond:cancel] db-update failed:', err),
          ),
      )
      .catch((err) =>
        console.error('[respond:cancel] mail send threw:', err),
      );

    try {
      revalidateTag('slots');
    } catch {
      /* ignore */
    }

    return redirectTo(
      `/buchung/storno?bookingId=${booking.id}&cancelled=true`,
    );
  } catch (err) {
    console.error('[respond] unexpected error:', err);
    // Im Zweifel zur Buchungsseite zurück.
    return redirectTo('/buchung?error=internal');
  }
}
