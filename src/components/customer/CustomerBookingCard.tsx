'use client';

/**
 * CustomerBookingCard — Karten-Darstellung einer Buchung im Kundenportal
 * (US-26 / US-27 / US-29).
 *
 * Zeigt:
 *   - Datum / Zeit
 *   - Service-Label
 *   - Status-Badge mit korrekter Farbe (siehe `customer-portal.ts`)
 *   - Preis (wenn Payment vorhanden)
 *   - Stornieren-Button (wenn isCancellable)
 *   - "Bewertung abgeben" + Inline-Form (wenn canReview)
 *   - Schreibgeschützte Bewertung (wenn bereits abgegeben)
 *   - Zahlungs-Button (wenn Payment PENDING/FAILED)
 *
 * Hält State lokal — meldet Updates über `onChange(booking)` an den Parent.
 */

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiClientError, cancelCustomerBooking } from '@/lib/api-client';
import {
  PORTAL_STATUS_LABEL,
  PORTAL_STATUS_TONE,
  formatBerlinDateLong,
  formatCentsAsEuro,
  formatTimeRange,
} from '@/lib/customer-portal';
import type { CustomerBooking } from '@/lib/schemas';
import { getServiceLabel } from '@/lib/services';
import { ReviewForm } from '@/components/portal/ReviewForm';

interface CustomerBookingCardProps {
  booking: CustomerBooking;
  variant: 'upcoming' | 'past';
  onChange: (updated: CustomerBooking) => void;
}

export function CustomerBookingCard({
  booking,
  variant,
  onChange,
}: CustomerBookingCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const isPast = variant === 'past';

  const onCancelConfirm = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await cancelCustomerBooking(booking.id);
      onChange({
        ...booking,
        status: res.status,
        isCancellable: false,
        cancellableUntilHours: null,
        updatedAt: res.cancelledAt,
      });
      setConfirmOpen(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setCancelError(
            err.message ||
              'Stornierung nicht mehr möglich. Bitte rufe uns an: 0157-74787512.',
          );
        } else if (err.status === 401) {
          setCancelError('Bitte logge dich erneut ein.');
        } else {
          setCancelError(err.message);
        }
      } else {
        setCancelError('Stornierung fehlgeschlagen. Bitte erneut versuchen.');
      }
    } finally {
      setCancelling(false);
    }
  };

  const dateLabel = formatBerlinDateLong(booking.date);
  const timeLabel = formatTimeRange(booking.startTime, booking.endTime);
  const serviceLabel = getServiceLabel(booking.service);

  const hasPaidPayment = booking.payment?.status === 'PAID';
  const needsPayment =
    booking.payment &&
    (booking.payment.status === 'PENDING' || booking.payment.status === 'FAILED');

  return (
    <article
      aria-labelledby={`booking-${booking.id}-title`}
      className={[
        'rounded-2xl border border-baerenstark-sand bg-white/85 p-5 shadow-soft sm:p-6',
        isPast ? 'opacity-80' : '',
      ].join(' ')}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id={`booking-${booking.id}-title`}
            className="font-serif text-lg font-semibold text-baerenstark-bark"
          >
            {serviceLabel}
          </h3>
          <p className="mt-0.5 text-sm text-baerenstark-bark/80">
            {dateLabel}
            {timeLabel && (
              <>
                <span className="mx-1.5 text-baerenstark-bark/40">·</span>
                {timeLabel}
              </>
            )}
          </p>
        </div>
        <Badge tone={PORTAL_STATUS_TONE[booking.status]}>
          {PORTAL_STATUS_LABEL[booking.status]}
        </Badge>
      </header>

      {booking.description && (
        <p className="mb-3 text-sm text-baerenstark-bark/85">
          {booking.description}
        </p>
      )}

      {booking.attachments.length > 0 && (
        <p className="mb-3 text-xs text-baerenstark-bark/70">
          📎 {booking.attachments.length}{' '}
          {booking.attachments.length === 1 ? 'Anhang' : 'Anhänge'}
        </p>
      )}

      {booking.payment && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-baerenstark-bark">Betrag:</span>
          <span className="text-baerenstark-bark/85">
            {formatCentsAsEuro(booking.payment.amount)}
          </span>
          {hasPaidPayment ? (
            <Badge tone="success">Bereits bezahlt ✓</Badge>
          ) : booking.payment.status === 'FAILED' ? (
            <Badge tone="danger">Zahlung fehlgeschlagen</Badge>
          ) : booking.payment.status === 'REFUNDED' ? (
            <Badge tone="info">Zurückerstattet</Badge>
          ) : (
            <Badge tone="warning">Zahlung offen</Badge>
          )}
        </div>
      )}

      {/* Bestehende Review schreibgeschützt anzeigen */}
      {booking.review && (
        <div className="mb-3 rounded-lg border border-baerenstark-sand bg-baerenstark-cream/50 p-3">
          <p className="text-sm font-medium text-baerenstark-bark">
            Deine Bewertung:{' '}
            <span aria-label={`${booking.review.stars} von 5 Sternen`} className="text-amber-accent">
              {'★'.repeat(booking.review.stars) + '☆'.repeat(5 - booking.review.stars)}
            </span>
          </p>
          {booking.review.text && (
            <p className="mt-1 text-sm text-baerenstark-bark/85">
              „{booking.review.text}"
            </p>
          )}
          {!booking.review.approved && (
            <p className="mt-1 text-xs text-baerenstark-bark/60">
              Wartet auf Freigabe.
            </p>
          )}
        </div>
      )}

      {cancelError && (
        <div className="mb-3">
          <Banner tone="error" role="alert">
            {cancelError}
          </Banner>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Stornieren-Button (US-27) — nur wenn isCancellable */}
        {booking.isCancellable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            aria-label="Termin stornieren"
          >
            Stornieren
          </Button>
        )}

        {/* Hinweis, wenn 24h-Frist verletzt (Confirmed mit zu wenig Vorlauf) */}
        {!booking.isCancellable &&
          booking.status === 'CONFIRMED' &&
          variant === 'upcoming' && (
            <p className="text-xs text-baerenstark-bark/60">
              Stornierung nur bis 24 Stunden vor dem Termin möglich. Bitte
              rufe uns an: 0157-74787512.
            </p>
          )}

        {/* Zahlungs-Button (US-28) */}
        {needsPayment && (
          <Link
            href={`/konto/zahlung/${booking.id}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark"
          >
            Jetzt bezahlen
          </Link>
        )}

        {/* Bewertung-Button (US-29) — nur in past + canReview */}
        {booking.canReview && !booking.review && !showReviewForm && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowReviewForm(true)}
            aria-expanded={false}
          >
            Bewertung abgeben
          </Button>
        )}
      </div>

      {/* Inline Review-Form */}
      {booking.canReview && !booking.review && showReviewForm && (
        <div className="mt-4 border-t border-baerenstark-sand pt-4">
          <ReviewForm
            bookingId={booking.id}
            onCancel={() => setShowReviewForm(false)}
            onSubmitted={(review) => {
              setShowReviewForm(false);
              onChange({
                ...booking,
                canReview: false,
                review: {
                  id: review.id,
                  stars: review.stars,
                  text: review.text,
                  approved: review.approved,
                  createdAt: review.createdAt,
                },
              });
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Termin stornieren?"
        description={`Möchtest du deinen Termin am ${dateLabel}${
          timeLabel ? ` (${timeLabel})` : ''
        } wirklich stornieren?`}
        confirmLabel="Ja, stornieren"
        cancelLabel="Abbrechen"
        variant="danger"
        isLoading={cancelling}
        onConfirm={onCancelConfirm}
        onCancel={() => {
          if (!cancelling) {
            setConfirmOpen(false);
            setCancelError(null);
          }
        }}
      />
    </article>
  );
}
