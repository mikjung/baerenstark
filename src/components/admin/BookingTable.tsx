'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  ApiClientError,
  fetchBookings,
  resendBookingMail,
  updateBookingStatus,
} from '@/lib/api-client';
import {
  formatBerlinDateShort,
  formatDateTime,
  formatSlotRangeCompact,
} from '@/lib/format';
import type { BookingAdmin, BookingStatus } from '@/lib/schemas';
import { getServiceLabel } from '@/lib/services';
import { CounterProposalDialog } from './CounterProposalDialog';
import { PaymentEditor } from './PaymentEditor';

type StatusFilter = 'ALL' | BookingStatus;

const FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Alle' },
  { value: 'PENDING', label: 'Offen' },
  { value: 'COUNTER_PROPOSED', label: 'Vorschlag offen' },
  { value: 'CONFIRMED', label: 'Bestätigt' },
  { value: 'COMPLETED', label: 'Abgeschlossen' },
  { value: 'REJECTED', label: 'Abgelehnt' },
  { value: 'CANCELLED', label: 'Storniert' },
];

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
  bookingId: string;
  next: 'CONFIRMED' | 'REJECTED' | 'COMPLETED';
  customerName: string;
}

interface CounterProposalTarget {
  bookingId: string;
  customerName: string;
  currentSlot: { id: string; startsAt: string; endsAt: string };
}

export function BookingTable() {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [bookings, setBookings] = useState<BookingAdmin[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [counterProposalTarget, setCounterProposalTarget] =
    useState<CounterProposalTarget | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchBookings();
      setBookings(data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError ? err.message : 'Unbekannter Fehler',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-clear toast nach 5 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return bookings;
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  async function confirmAction() {
    if (!pendingAction) return;
    setActionError(null);
    setActionInProgress(true);
    try {
      await updateBookingStatus(pendingAction.bookingId, pendingAction.next);
      setPendingAction(null);
      setToast({
        tone: 'success',
        message:
          pendingAction.next === 'CONFIRMED'
            ? 'Anfrage wurde bestätigt.'
            : pendingAction.next === 'COMPLETED'
              ? 'Auftrag als abgeschlossen markiert.'
              : 'Anfrage wurde abgelehnt.',
      });
      void load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'CONFLICT') {
          setActionError(
            'Dieser Slot ist inzwischen anderweitig vergeben. Liste wurde aktualisiert.',
          );
          void load();
        } else if (err.code === 'GONE') {
          setActionError(
            'Diese Anfrage ist in einem Endstatus — Aktion nicht mehr möglich.',
          );
          void load();
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError('Aktion fehlgeschlagen.');
      }
    } finally {
      setActionInProgress(false);
    }
  }

  async function onResendMail(id: string) {
    setResendingId(id);
    setToast(null);
    try {
      await resendBookingMail(id);
      setToast({ tone: 'success', message: 'Mail wurde erneut versendet.' });
      void load();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'MAIL_FAILED') {
        setToast({
          tone: 'error',
          message: 'Mail-Versand erneut fehlgeschlagen. Bitte später nochmal versuchen.',
        });
      } else if (err instanceof ApiClientError) {
        setToast({ tone: 'error', message: err.message });
      } else {
        setToast({ tone: 'error', message: 'Mail-Versand fehlgeschlagen.' });
      }
    } finally {
      setResendingId(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className="grid gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Banner tone="error" title="Anfragen konnten nicht geladen werden" role="alert">
        <p className="mb-3">{errorMessage ?? 'Bitte erneut versuchen.'}</p>
        <Button variant="secondary" size="sm" onClick={load}>
          Erneut versuchen
        </Button>
      </Banner>
    );
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Status-Filter" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.value)}
              className={[
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2',
                active
                  ? 'border-baerenstark-wood bg-baerenstark-wood text-baerenstark-cream'
                  : 'border-baerenstark-sand bg-white/60 text-baerenstark-bark hover:bg-baerenstark-sand/50',
              ].join(' ')}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {toast && (
        <Banner tone={toast.tone === 'success' ? 'success' : 'error'} role="status">
          {toast.message}
        </Banner>
      )}

      {filtered.length === 0 ? (
        <Banner tone="info" title="Keine Anfragen in dieser Ansicht">
          <p>
            {filter === 'ALL'
              ? 'Es liegen noch keine Anfragen vor.'
              : 'In dieser Filteransicht ist nichts vorhanden.'}
          </p>
        </Banner>
      ) : (
        <ul role="list" className="space-y-3">
          {filtered.map((b) => {
            // Iteration 3: `slot` ist nullable. Bestand-Buchungen haben einen
            // Slot, neue IT3-Buchungen haben date/startTime/endTime.
            const slotRange = b.slot
              ? formatSlotRangeCompact(b.slot.startsAt, b.slot.endsAt)
              : b.date && b.startTime && b.endTime
                ? `${formatBerlinDateShort(b.date)} · ${b.startTime}–${b.endTime}`
                : '—';
            const slotDeleted = Boolean(b.slot?.deletedAt);
            const slotDescription = b.slot?.description ?? null;
            const mailFailed = !b.mailSent;
            const isCancelled = b.status === 'CANCELLED';
            const isRejected = b.status === 'REJECTED';
            const isCounterProposed = b.status === 'COUNTER_PROPOSED';
            return (
              <li key={b.id}>
                <article
                  aria-labelledby={`bk-${b.id}-name`}
                  className={[
                    'rounded-2xl border p-4 shadow-soft sm:p-5',
                    mailFailed
                      ? 'border-red-300 bg-red-50/60'
                      : isCancelled
                        ? 'border-baerenstark-sand bg-baerenstark-sand/20 opacity-80'
                        : isCounterProposed
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-baerenstark-sand bg-white/80',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3
                        id={`bk-${b.id}-name`}
                        className="font-serif text-lg font-semibold text-baerenstark-bark"
                      >
                        {b.customerName}
                      </h3>
                      <p className="text-sm text-baerenstark-bark/80">
                        {getServiceLabel(b.service)} · Eingang{' '}
                        {formatDateTime(b.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                      {mailFailed && (
                        <Badge tone="danger" title={b.mailError ?? 'Mail-Versand fehlgeschlagen'}>
                          Mail nicht zugestellt
                        </Badge>
                      )}
                      {slotDeleted && <Badge tone="warning">Slot gelöscht</Badge>}
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-baerenstark-bark/70">Zeitfenster</dt>
                      <dd>
                        {slotRange}
                        {slotDescription && (
                          <span className="text-baerenstark-bark/60"> · {slotDescription}</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-baerenstark-bark/70">Telefon</dt>
                      <dd>
                        <a
                          href={`tel:${b.customerPhone.replace(/[^+\d]/g, '')}`}
                          className="text-baerenstark-wood underline-offset-2 hover:underline"
                        >
                          {b.customerPhone}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-baerenstark-bark/70">E-Mail</dt>
                      <dd>
                        {b.customerEmail ? (
                          <a
                            href={`mailto:${b.customerEmail}`}
                            className="break-all text-baerenstark-wood underline-offset-2 hover:underline"
                          >
                            {b.customerEmail}
                          </a>
                        ) : (
                          <span className="text-baerenstark-bark/40">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-baerenstark-bark/70">Beschreibung</dt>
                      <dd className="whitespace-pre-line text-baerenstark-bark/90">
                        {b.description}
                      </dd>
                    </div>
                    {b.attachments && b.attachments.length > 0 && (
                      <div className="sm:col-span-2">
                        <dt className="font-medium text-baerenstark-bark/70">
                          Anhänge ({b.attachments.length})
                        </dt>
                        <dd>
                          <ul role="list" className="mt-1 flex flex-wrap gap-2">
                            {b.attachments.map((att) => (
                              <li key={att.id}>
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-md border border-baerenstark-sand bg-white/80 px-2 py-1 text-xs text-baerenstark-bark hover:border-baerenstark-wood hover:bg-baerenstark-sand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
                                >
                                  <span aria-hidden="true">
                                    {att.contentType.startsWith('image/')
                                      ? '🖼️'
                                      : att.contentType === 'application/pdf'
                                        ? '📄'
                                        : att.contentType.startsWith('video/')
                                          ? '🎬'
                                          : '📎'}
                                  </span>
                                  <span className="max-w-[16ch] truncate">
                                    {att.filename}
                                  </span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                  </dl>

                  {isCounterProposed && b.counterProposalSlot && (
                    <div className="mt-4 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">
                      <p className="font-medium text-amber-900">
                        Vorgeschlagener Alternativtermin (wartet auf Kunden-Reaktion):
                      </p>
                      <p className="mt-1 text-baerenstark-bark/90">
                        {formatSlotRangeCompact(
                          b.counterProposalSlot.startsAt,
                          b.counterProposalSlot.endsAt,
                        )}
                        {b.counterProposalSlot.description && (
                          <span className="text-baerenstark-bark/60">
                            {' '}
                            · {b.counterProposalSlot.description}
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {mailFailed && b.mailError && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-100/50 p-2 text-xs text-red-900">
                      <strong>Mail-Fehler:</strong> {b.mailError}
                    </p>
                  )}

                  {/* US-28: Zahlbetrag hinterlegen — nur für CONFIRMED/COMPLETED */}
                  {(b.status === 'CONFIRMED' || b.status === 'COMPLETED') && (
                    <div className="mt-3">
                      <PaymentEditor
                        bookingId={b.id}
                        initialPayment={b.payment ?? null}
                      />
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    {mailFailed && !isCancelled && (
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={resendingId === b.id}
                        onClick={() => onResendMail(b.id)}
                      >
                        Mail erneut senden
                      </Button>
                    )}
                    {b.status === 'PENDING' && !slotDeleted && b.slot && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setCounterProposalTarget({
                            bookingId: b.id,
                            customerName: b.customerName,
                            currentSlot: {
                              id: b.slot!.id,
                              startsAt: b.slot!.startsAt,
                              endsAt: b.slot!.endsAt,
                            },
                          })
                        }
                      >
                        Gegenvorschlag senden
                      </Button>
                    )}
                    {!isCancelled &&
                      b.status !== 'CONFIRMED' &&
                      b.status !== 'COMPLETED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            setPendingAction({
                              bookingId: b.id,
                              next: 'CONFIRMED',
                              customerName: b.customerName,
                            })
                          }
                        >
                          Bestätigen
                        </Button>
                      )}
                    {b.status === 'CONFIRMED' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setPendingAction({
                            bookingId: b.id,
                            next: 'COMPLETED',
                            customerName: b.customerName,
                          })
                        }
                      >
                        Als abgeschlossen markieren
                      </Button>
                    )}
                    {!isCancelled &&
                      !isRejected &&
                      b.status !== 'COMPLETED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPendingAction({
                              bookingId: b.id,
                              next: 'REJECTED',
                              customerName: b.customerName,
                            })
                          }
                        >
                          Ablehnen
                        </Button>
                      )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
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
            ? `Anfrage von ${pendingAction.customerName} ${
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
        onConfirm={confirmAction}
        onCancel={() => {
          if (!actionInProgress) {
            setPendingAction(null);
            setActionError(null);
          }
        }}
      />

      {counterProposalTarget && (
        <CounterProposalDialog
          open={true}
          bookingId={counterProposalTarget.bookingId}
          customerName={counterProposalTarget.customerName}
          currentSlot={counterProposalTarget.currentSlot}
          onClose={() => setCounterProposalTarget(null)}
          onSuccess={() => {
            setCounterProposalTarget(null);
            setToast({
              tone: 'success',
              message: 'Alternativtermin wurde an den Kunden gesendet.',
            });
            void load();
          }}
        />
      )}

      {actionError && (
        <Banner tone="error" role="alert">
          {actionError}
        </Banner>
      )}
    </div>
  );
}
