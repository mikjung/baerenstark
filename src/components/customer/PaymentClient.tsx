'use client';

/**
 * PaymentClient — Lädt Booking + Payment-Infos und löst per Klick die
 * Stripe-Checkout-Session aus (US-28).
 *
 * Auth-Modi:
 *   1. Eingeloggter Kunde (Cookie): nutzt `GET /api/customer/bookings/:id`,
 *      um Service / Datum / Betrag zu zeigen.
 *   2. Gast mit `cancelToken`: kann Booking-Details nicht via
 *      Customer-Endpoint lesen — wir versuchen den Aufruf trotzdem
 *      (Backend antwortet 401), und falls fehlgeschlagen, zeigen wir
 *      eine reduzierte Ansicht mit „Jetzt bezahlen“-Button.
 *
 * Beim Klick auf „Jetzt bezahlen“: `POST /api/payments/create-session` →
 * `window.location.assign(url)` (Stripe-hosted Checkout).
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ApiClientError,
  createPaymentSession,
} from '@/lib/api-client';
import {
  formatBerlinDateLong,
  formatCentsAsEuro,
  formatTimeRange,
} from '@/lib/customer-portal';
import type { CustomerBooking } from '@/lib/schemas';
import { getServiceLabel } from '@/lib/services';

interface PaymentClientProps {
  bookingId: string;
  cancelToken?: string;
}

type LoadStatus = 'loading' | 'ready' | 'error' | 'guest';

export function PaymentClient({ bookingId, cancelToken }: PaymentClientProps) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/customer/bookings/${encodeURIComponent(bookingId)}`,
          { credentials: 'same-origin', cache: 'no-store' },
        );
        if (cancelled) return;
        if (res.status === 401) {
          // Gast-Flow: keine Booking-Daten verfügbar; wir zeigen einen
          // reduzierten Hinweis-Block mit „Jetzt bezahlen“-Button.
          setStatus(cancelToken ? 'guest' : 'error');
          if (!cancelToken) {
            setErrorMessage(
              'Bitte logge dich ein oder nutze den Zahlungs-Link aus deiner E-Mail.',
            );
          }
          return;
        }
        if (!res.ok) {
          setStatus('error');
          setErrorMessage(
            'Buchung konnte nicht geladen werden. Bitte später erneut versuchen.',
          );
          return;
        }
        const body = (await res.json()) as { data: CustomerBooking };
        setBooking(body.data);
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage('Verbindung zum Server fehlgeschlagen.');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bookingId, cancelToken]);

  const onPay = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await createPaymentSession(bookingId, cancelToken);
      window.location.assign(res.url);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 404) {
          setSubmitError(
            'Zahlung noch nicht angefordert. Bitte warte, bis Tom dir eine Zahlungsaufforderung schickt.',
          );
        } else if (err.status === 409) {
          setSubmitError(err.message);
        } else if (err.code === 'STRIPE_ERROR') {
          setSubmitError(
            'Zahlungsdienst aktuell nicht erreichbar. Bitte später erneut versuchen.',
          );
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError('Zahlung konnte nicht gestartet werden.');
      }
      setSubmitting(false);
    }
  };

  // Loading
  if (status === 'loading') {
    return (
      <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-card sm:p-8">
        <Skeleton className="mb-4 h-8 w-2/3" ariaLabel="Lade Zahlungsinfos" />
        <Skeleton className="mb-2 h-5 w-full" />
        <Skeleton className="mb-2 h-5 w-1/2" />
        <Skeleton className="mt-6 h-12 w-40" />
      </div>
    );
  }

  // Hard error / Auth fehlt
  if (status === 'error') {
    return (
      <Banner tone="error" title="Zahlung nicht möglich" role="alert">
        <p className="mb-3">{errorMessage}</p>
        <Link
          href="/konto/login"
          className="text-baerenstark-wood underline-offset-2 hover:underline"
        >
          Zum Login
        </Link>
      </Banner>
    );
  }

  // Eingeloggter Kunde mit Booking-Daten
  if (status === 'ready' && booking) {
    const payment = booking.payment;
    const isPaid = payment?.status === 'PAID';
    const isRefunded = payment?.status === 'REFUNDED';
    const noPayment = !payment;

    return (
      <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-card sm:p-8">
        <Link
          href="/konto"
          className="mb-3 inline-block text-sm text-baerenstark-wood underline-offset-2 hover:underline"
        >
          ← Zur Übersicht
        </Link>
        <h1 className="mb-2 font-serif text-2xl font-bold text-baerenstark-bark">
          Zahlung
        </h1>
        <dl className="mb-6 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-medium text-baerenstark-bark">Service:</dt>
          <dd className="text-baerenstark-bark/85">{getServiceLabel(booking.service)}</dd>
          <dt className="font-medium text-baerenstark-bark">Datum:</dt>
          <dd className="text-baerenstark-bark/85">
            {formatBerlinDateLong(booking.date)}
            {formatTimeRange(booking.startTime, booking.endTime) && (
              <>
                {' · '}
                {formatTimeRange(booking.startTime, booking.endTime)}
              </>
            )}
          </dd>
          {payment && (
            <>
              <dt className="font-medium text-baerenstark-bark">Betrag:</dt>
              <dd className="text-baerenstark-bark/85">
                <span className="text-lg font-semibold">
                  {formatCentsAsEuro(payment.amount)}
                </span>
              </dd>
              <dt className="font-medium text-baerenstark-bark">Status:</dt>
              <dd>
                {isPaid && <Badge tone="success">Bereits bezahlt ✓</Badge>}
                {isRefunded && <Badge tone="info">Zurückerstattet</Badge>}
                {payment.status === 'PENDING' && (
                  <Badge tone="warning">Zahlung offen</Badge>
                )}
                {payment.status === 'FAILED' && (
                  <Badge tone="danger">Zahlung fehlgeschlagen</Badge>
                )}
              </dd>
            </>
          )}
        </dl>

        {noPayment && (
          <Banner tone="info" role="status">
            Zahlung noch nicht angefordert. Sobald Tom den Betrag hinterlegt,
            erhältst du eine E-Mail mit dem Zahlungs-Link.
          </Banner>
        )}

        {isPaid && (
          <Banner tone="success" role="status">
            Vielen Dank! Diese Buchung wurde bereits bezahlt.
          </Banner>
        )}

        {isRefunded && (
          <Banner tone="info" role="status">
            Diese Zahlung wurde zurückerstattet.
          </Banner>
        )}

        {payment && (payment.status === 'PENDING' || payment.status === 'FAILED') && (
          <>
            {submitError && (
              <div className="mb-3">
                <Banner tone="error" role="alert">
                  {submitError}
                </Banner>
              </div>
            )}
            <Button onClick={onPay} isLoading={submitting} size="lg">
              Jetzt bezahlen
            </Button>
            <p className="mt-3 text-xs text-baerenstark-bark/60">
              Du wirst zur sicheren Zahlungsseite (Stripe) weitergeleitet —
              dort kannst du mit Karte, PayPal, Apple Pay oder Google Pay
              bezahlen.
            </p>
          </>
        )}
      </div>
    );
  }

  // Gast-Flow (cancelToken vorhanden, aber wir können Booking-Details
  // nicht laden, weil der Customer-Endpoint 401 zurückgibt).
  return (
    <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-6 shadow-card sm:p-8">
      <h1 className="mb-2 font-serif text-2xl font-bold text-baerenstark-bark">
        Zahlung
      </h1>
      <p className="mb-4 text-sm text-baerenstark-bark/85">
        Klicke auf „Jetzt bezahlen“, um zur sicheren Zahlungsseite zu
        gelangen. Du kannst dort mit Karte, PayPal, Apple Pay oder Google
        Pay bezahlen.
      </p>
      {submitError && (
        <div className="mb-3">
          <Banner tone="error" role="alert">
            {submitError}
          </Banner>
        </div>
      )}
      <Button onClick={onPay} isLoading={submitting} size="lg">
        Jetzt bezahlen
      </Button>
    </div>
  );
}
