/**
 * GET /api/bookings/:id/public-summary  — IT11 / US-IT11-03 (+ US-IT11-06).
 *
 * Read-only Buchungs-Summary für die reload-feste Bestätigungs- und
 * Storno-Page. Auth-Polymorphismus:
 *   1. `?token=<jwt>` mit Scope `booking-confirmation` ODER
 *      `booking-cancellation` (beide read-only-äquivalent, ARCH §3.5).
 *   2. Fallback: Customer-Session-Cookie + `booking.customerId === me.id`.
 *
 * Antwort-DTO ist bewusst minimal — keine Adresse, keine Description, kein
 * Telefon, keine internen Felder. Nur Felder, die der User selbst eingegeben
 * hat (Service, Datum, Zeit, Status, Anzeige-Name) plus Attachment-Liste
 * (für die Bestätigungs-Page).
 *
 * IT12 Bug-Fix BUG-002 (S05 AC2):
 *   Wenn `?token=…` valide ist (User hat den Confirmation-/Cancellation-
 *   Link aus seiner eigenen E-Mail), liefern wir `customerEmail` ZUSÄTZLICH
 *   aus, damit die „Konto erstellen?"-Card die Email vorausfüllen kann.
 *   Cookie-Pfad liefert die Email ebenfalls, da der eingeloggte Customer
 *   sowieso seine eigene Buchung anschaut. Ohne Token UND ohne Cookie
 *   würde der Endpoint mit 401 antworten — der PII-Pfad „nur Token, keine
 *   Email" existiert also gar nicht mehr.
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess, internalError } from '@/lib/api';
import { verifyBookingReadToken } from '@/lib/booking-tokens';
import { getCustomerFromRequest } from '@/lib/customer-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    let authorized = false;

    // ----- Pfad A: Token-Auth (Gast oder eingeloggt). -----
    if (token) {
      const verify = await verifyBookingReadToken(token);
      if (!verify.ok) {
        const code =
          verify.reason === 'TOKEN_EXPIRED'
            ? 'UNAUTHORIZED'
            : 'UNAUTHORIZED';
        const message =
          verify.reason === 'TOKEN_EXPIRED'
            ? 'Dieser Bestätigungslink ist abgelaufen. Bitte rufen Sie 0157-74787512 an.'
            : 'Ungültiger Link.';
        // Nutzen den ApiErrorCode `UNAUTHORIZED` (401), spezialisieren über
        // den `subcode` für FE-Mapping (TOKEN_EXPIRED vs. TOKEN_INVALID).
        return apiError({
          code,
          message,
          subcode: verify.reason,
        });
      }
      if (verify.payload.sub !== id) {
        return apiError({
          code: 'UNAUTHORIZED',
          message: 'Ungültiger Link.',
          subcode: 'TOKEN_INVALID',
        });
      }
      authorized = true;
    }

    // ----- Pfad B: Cookie-Auth (Customer-Session). -----
    let cookieCustomerId: string | null = null;
    if (!authorized) {
      const me = await getCustomerFromRequest(req);
      if (me) cookieCustomerId = me.id;
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        customerName: true,
        customerEmail: true, // IT12 BUG-002: nur ausliefern, wenn authorisiert.
        service: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        createdAt: true,
        slot: {
          select: {
            startsAt: true,
            endsAt: true,
          },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            url: true,
            filename: true,
            contentType: true,
            sizeBytes: true,
          },
        },
      },
    });

    if (!booking) {
      return apiError({ code: 'NOT_FOUND', message: 'Buchung nicht gefunden.' });
    }

    if (!authorized) {
      // Cookie-Pfad: Owner-Match Pflicht, sonst 401 (kein 404 — Existenz wird
      // durch Token-Pfad ohnehin offengelegt; Cookie-Pfad ist nur convenience).
      if (
        !cookieCustomerId ||
        booking.customerId === null ||
        booking.customerId !== cookieCustomerId
      ) {
        return apiError({
          code: 'UNAUTHORIZED',
          message: 'Bitte melden Sie sich an oder verwenden Sie den Link aus der Bestätigungs-E-Mail.',
        });
      }
    }

    // Date-Modus oder Slot-Modus normalisieren auf YYYY-MM-DD + HH:MM.
    let date: string | null = booking.date ?? null;
    let startTime: string | null = booking.startTime ?? null;
    if ((!date || !startTime) && booking.slot) {
      // Slot-Modus (Bestand IT2): aus startsAt rekonstruieren (Berlin-TZ).
      try {
        const fmtDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Berlin',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const fmtTime = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Berlin',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        date = fmtDate.format(booking.slot.startsAt);
        startTime = fmtTime.format(booking.slot.startsAt);
      } catch {
        /* ignore */
      }
    }

    return apiSuccess({
      id: booking.id,
      service: booking.service,
      date,
      startTime,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
      customerName: booking.customerName,
      // IT12 BUG-002: Email-Ausgabe nur, wenn authorisiert (Token oder
      // Cookie-Owner). Der gesamte Endpoint ist bereits durch die obige
      // Authorisierung geschützt — wir geben deshalb `customerEmail`
      // direkt zurück. Konsumenten (nur die Bestätigungs-Page) nutzen
      // sie zum Vorausfüllen der „Konto erstellen?"-Card.
      customerEmail: booking.customerEmail ?? null,
      attachments: booking.attachments.map((a) => ({
        id: a.id,
        url: a.url,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
      })),
    });
  } catch (err) {
    return internalError(err, 'GET /api/bookings/:id/public-summary');
  }
}
