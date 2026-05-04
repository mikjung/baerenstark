'use client';

/**
 * AdminBookingDetailView — Client-Component für `/admin/bookings/[id]`.
 *
 * IT14-S06: dünner Wrapper um Booking-Card-Inhalte. Zeigt Header (Customer,
 * Status, Termin), Aktions-Buttons je nach Status, Kunden-Info, Beschreibung,
 * Anhänge, FinalPriceEditor (S04 + S05) und PaymentEditor (Stripe-Bestand).
 *
 * Spec:
 *   - ux-spec-iteration-14.md §5a (Layout, Sektionen, Aktions-Reihenfolge).
 *   - frontend-requirements-it14.md §4 (S06).
 *   - ARCHITECTURE_IT14.md §5.4.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ArrowLeftIcon } from '@/components/ui/icons';
import {
  ApiClientError,
  updateBookingStatus,
} from '@/lib/api-client';
import {
  formatBerlinDateShort,
  formatDateTime,
  formatSlotRangeCompact,
  humanSize,
} from '@/lib/format';
import type { BookingStatus, PaymentMethod } from '@/lib/schemas';
import { getServiceLabel } from '@/lib/services';
import { toast } from '@/lib/toast';
import { FinalPriceEditor } from './FinalPriceEditor';
import { PaymentEditor } from './PaymentEditor';

interface BookingDetail {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  service: string;
  description: string;
  status: BookingStatus;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  slot: {
    id: string;
    startsAt: string;
    endsAt: string;
    description: string | null;
    deletedAt: string | null;
  } | null;
  counterProposalSlot: {
    id: string;
    startsAt: string;
    endsAt: string;
    description: string | null;
  } | null;
  attachments: Array<{
    id: string;
    url: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }>;
  finalPriceEur: string | null;
  finalPriceNote: string | null;
  paymentMethod: PaymentMethod | null;
  payment: {
    id: string;
    bookingId: string;
    amount: number;
    currency: string;
    status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
    paidAt: string | null;
    stripeSessionId: string | null;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Offen',
  CONFIRMED: 'Bestätigt',
  REJECTED: 'Abgelehnt',
  COUNTER_PROPOSED: 'Vorschlag ausstehend',
  CANCELLED: 'Storniert',
  COMPLETED: 'Abgeschlossen',
};

type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

const STATUS_TONE: Record<BookingStatus, BadgeTone> = {
  PENDING: 'neutral',
  CONFIRMED: 'success',
  REJECTED: 'danger',
  COUNTER_PROPOSED: 'warning',
  CANCELLED: 'neutral',
  COMPLETED: 'info',
};

interface PendingAction {
  next: 'CONFIRMED' | 'REJECTED' | 'COMPLETED';
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

interface Props {
  booking: BookingDetail;
}

export function AdminBookingDetailView({ booking: initial }: Props) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail>(initial);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync, wenn der Server-Render einen neuen Booking-State liefert (z.B. nach
  // Re-Fetch/Refresh).
  useEffect(() => {
    setBooking(initial);
  }, [initial]);

  const slotRange = booking.slot
    ? formatSlotRangeCompact(booking.slot.startsAt, booking.slot.endsAt)
    : booking.date && booking.startTime && booking.endTime
      ? `${formatBerlinDateShort(booking.date)} · ${booking.startTime}–${booking.endTime}`
      : '—';

  const slotDeleted = Boolean(booking.slot?.deletedAt);

  const handleStatusAction = useCallback(
    async (next: 'CONFIRMED' | 'REJECTED' | 'COMPLETED') => {
      setActionError(null);
      setActionInProgress(true);
      try {
        await updateBookingStatus(booking.id, next);
        setBooking((prev) => ({ ...prev, status: next }));
        toast.success(
          next === 'CONFIRMED'
            ? 'Anfrage wurde bestätigt.'
            : next === 'COMPLETED'
              ? 'Auftrag als abgeschlossen markiert.'
              : 'Anfrage wurde abgelehnt.',
        );
        setPendingAction(null);
        // Server-Daten aktualisieren (z.B. updatedAt, ggf. Side-Effects).
        router.refresh();
      } catch (err) {
        if (err instanceof ApiClientError) {
          setActionError(err.message);
        } else {
          setActionError('Aktion fehlgeschlagen.');
        }
      } finally {
        setActionInProgress(false);
      }
    },
    [booking.id, router],
  );

  const isPending = booking.status === 'PENDING';
  const isConfirmed = booking.status === 'CONFIRMED';
  const isCompleted = booking.status === 'COMPLETED';
  const isCancelled = booking.status === 'CANCELLED';
  const isRejected = booking.status === 'REJECTED';

  const fullAddress = [
    booking.addressStreet,
    [booking.addressZip, booking.addressCity].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <header className="space-y-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-baerenstark-wood underline-offset-2 hover:underline"
          aria-label="Zurück zur Buchungsübersicht"
        >
          <span aria-hidden="true">
            <ArrowLeftIcon size={14} />
          </span>
          Zurück zu Buchungen
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-bold text-baerenstark-bark sm:text-3xl">
              Buchung #{shortId(booking.id)} · {getServiceLabel(booking.service)}
            </h1>
            <p className="mt-1 text-sm text-baerenstark-bark/80">
              {slotRange}
              {booking.slot?.description && (
                <span className="text-baerenstark-bark/60">
                  {' · '}
                  {booking.slot.description}
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-baerenstark-bark/60">
              Eingang {formatDateTime(booking.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[booking.status]}>
              {STATUS_LABEL[booking.status]}
            </Badge>
            {slotDeleted && <Badge tone="warning">Slot gelöscht</Badge>}
          </div>
        </div>
      </header>

      {actionError && (
        <Banner tone="error" role="alert">
          {actionError}
        </Banner>
      )}

      {/* Aktions-Bereich */}
      <section
        aria-labelledby="actions-heading"
        className="rounded-2xl border border-baerenstark-sand bg-white/80 p-4 shadow-soft sm:p-5"
      >
        <h2
          id="actions-heading"
          className="font-serif text-lg font-semibold text-baerenstark-bark"
        >
          Aktionen
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isPending && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPendingAction({ next: 'CONFIRMED' })}
              >
                Bestätigen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingAction({ next: 'REJECTED' })}
              >
                Ablehnen
              </Button>
            </>
          )}
          {isConfirmed && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPendingAction({ next: 'COMPLETED' })}
            >
              Abgeschlossen markieren
            </Button>
          )}
          {(isCompleted || isCancelled || isRejected) && (
            <p className="text-sm text-baerenstark-bark/60">
              Diese Buchung ist in einem Endzustand. Status-Aktionen sind nicht
              mehr verfügbar.
            </p>
          )}
        </div>

        {/* Preis + Zahlungsart (S04 + S05) */}
        <div className="mt-4">
          <FinalPriceEditor
            bookingId={booking.id}
            initialFinalPriceEur={booking.finalPriceEur}
            initialFinalPriceNote={booking.finalPriceNote}
            initialPaymentMethod={booking.paymentMethod}
            onSaved={(price, note, method) => {
              setBooking((prev) => ({
                ...prev,
                finalPriceEur: price,
                finalPriceNote: note,
                paymentMethod: method,
              }));
            }}
          />
        </div>

        {/* Stripe-Payment (Bestand) — falls vorhanden */}
        {(isConfirmed || isCompleted) && (
          <div className="mt-3">
            <PaymentEditor
              bookingId={booking.id}
              initialPayment={booking.payment}
            />
          </div>
        )}
      </section>

      {/* Kunden-Info */}
      <section
        aria-labelledby="customer-heading"
        className="rounded-2xl border border-baerenstark-sand bg-white/80 p-4 shadow-soft sm:p-5"
      >
        <h2
          id="customer-heading"
          className="font-serif text-lg font-semibold text-baerenstark-bark"
        >
          Kunde
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-baerenstark-bark/70">Name</dt>
            <dd>{booking.customerName}</dd>
          </div>
          <div>
            <dt className="font-medium text-baerenstark-bark/70">Telefon</dt>
            <dd>
              <a
                href={`tel:${booking.customerPhone.replace(/[^+\d]/g, '')}`}
                className="text-baerenstark-wood underline-offset-2 hover:underline"
              >
                {booking.customerPhone}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-baerenstark-bark/70">E-Mail</dt>
            <dd>
              {booking.customerEmail ? (
                <a
                  href={`mailto:${booking.customerEmail}`}
                  className="break-all text-baerenstark-wood underline-offset-2 hover:underline"
                >
                  {booking.customerEmail}
                </a>
              ) : (
                <span className="text-baerenstark-bark/40">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-baerenstark-bark/70">Adresse</dt>
            <dd>
              {fullAddress || (
                <span className="text-baerenstark-bark/40">—</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Beschreibung */}
      <section
        aria-labelledby="description-heading"
        className="rounded-2xl border border-baerenstark-sand bg-white/80 p-4 shadow-soft sm:p-5"
      >
        <h2
          id="description-heading"
          className="font-serif text-lg font-semibold text-baerenstark-bark"
        >
          Beschreibung
        </h2>
        <p className="mt-3 whitespace-pre-line text-sm text-baerenstark-bark/90">
          {booking.description || (
            <span className="text-baerenstark-bark/40">—</span>
          )}
        </p>
      </section>

      {/* Counter-Proposal-Hinweis */}
      {booking.status === 'COUNTER_PROPOSED' && booking.counterProposalSlot && (
        <section className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">
            Vorgeschlagener Alternativtermin (wartet auf Kunden-Reaktion):
          </p>
          <p className="mt-1 text-baerenstark-bark/90">
            {formatSlotRangeCompact(
              booking.counterProposalSlot.startsAt,
              booking.counterProposalSlot.endsAt,
            )}
            {booking.counterProposalSlot.description && (
              <span className="text-baerenstark-bark/60">
                {' · '}
                {booking.counterProposalSlot.description}
              </span>
            )}
          </p>
        </section>
      )}

      {/* Anhänge */}
      {booking.attachments.length > 0 && (
        <section
          aria-labelledby="attachments-heading"
          className="rounded-2xl border border-baerenstark-sand bg-white/80 p-4 shadow-soft sm:p-5"
        >
          <h2
            id="attachments-heading"
            className="font-serif text-lg font-semibold text-baerenstark-bark"
          >
            Bilder ({booking.attachments.length})
          </h2>
          <ul
            role="list"
            className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {booking.attachments.map((att, idx) => {
              const isImage = att.contentType.startsWith('image/');
              return (
                <li key={att.id}>
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-baerenstark-sand bg-white/80 p-2 hover:border-baerenstark-wood hover:bg-baerenstark-sand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={att.url}
                        alt={`Bild ${idx + 1} zu Buchung #${shortId(booking.id)}`}
                        loading="lazy"
                        className="aspect-square w-full rounded-md object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex aspect-square w-full items-center justify-center rounded-md bg-baerenstark-sand/60 text-3xl"
                      >
                        📎
                      </span>
                    )}
                    <span className="mt-2 block truncate text-xs font-medium text-baerenstark-bark">
                      {att.filename}
                    </span>
                    <span className="block text-xs text-baerenstark-bark/60">
                      {humanSize(att.sizeBytes)}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction?.next === 'CONFIRMED'
            ? 'Anfrage bestätigen?'
            : pendingAction?.next === 'COMPLETED'
              ? 'Auftrag abschließen?'
              : 'Anfrage ablehnen?'
        }
        description={
          pendingAction
            ? `Anfrage von ${booking.customerName} ${
                pendingAction.next === 'CONFIRMED'
                  ? 'bestätigen'
                  : pendingAction.next === 'COMPLETED'
                    ? 'als abgeschlossen markieren'
                    : 'ablehnen'
              }?`
            : ''
        }
        confirmLabel={
          pendingAction?.next === 'CONFIRMED'
            ? 'Bestätigen'
            : pendingAction?.next === 'COMPLETED'
              ? 'Abschließen'
              : 'Ablehnen'
        }
        variant={pendingAction?.next === 'REJECTED' ? 'danger' : 'primary'}
        isLoading={actionInProgress}
        onConfirm={() => {
          if (pendingAction) void handleStatusAction(pendingAction.next);
        }}
        onCancel={() => {
          if (!actionInProgress) {
            setPendingAction(null);
            setActionError(null);
          }
        }}
      />
    </div>
  );
}
