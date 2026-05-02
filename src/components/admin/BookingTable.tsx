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
import { formatDateTime, formatSlotRangeCompact } from '@/lib/format';
import type { BookingAdmin, BookingStatus } from '@/lib/schemas';
import { getServiceLabel } from '@/lib/services';

type StatusFilter = 'ALL' | BookingStatus;

const FILTERS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Alle' },
  { value: 'PENDING', label: 'Offen' },
  { value: 'CONFIRMED', label: 'Bestätigt' },
  { value: 'REJECTED', label: 'Abgelehnt' },
];

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Offen',
  CONFIRMED: 'Bestätigt',
  REJECTED: 'Abgelehnt',
};

const STATUS_TONE: Record<BookingStatus, 'neutral' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  CONFIRMED: 'success',
  REJECTED: 'danger',
};

interface PendingAction {
  bookingId: string;
  next: 'CONFIRMED' | 'REJECTED';
  customerName: string;
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
            const slotRange = formatSlotRangeCompact(b.slot.startsAt, b.slot.endsAt);
            const slotDeleted = Boolean(b.slot.deletedAt);
            const mailFailed = !b.mailSent;
            return (
              <li key={b.id}>
                <article
                  aria-labelledby={`bk-${b.id}-name`}
                  className={[
                    'rounded-2xl border p-4 shadow-soft sm:p-5',
                    mailFailed
                      ? 'border-red-300 bg-red-50/60'
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
                          ✉️ Mail nicht zugestellt
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
                        {b.slot.description && (
                          <span className="text-baerenstark-bark/60"> · {b.slot.description}</span>
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
                  </dl>

                  {mailFailed && b.mailError && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-100/50 p-2 text-xs text-red-900">
                      <strong>Mail-Fehler:</strong> {b.mailError}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    {mailFailed && (
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={resendingId === b.id}
                        onClick={() => onResendMail(b.id)}
                      >
                        Mail erneut senden
                      </Button>
                    )}
                    {b.status !== 'CONFIRMED' && (
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
                    {b.status !== 'REJECTED' && (
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
            : 'Anfrage ablehnen?'
        }
        description={
          pendingAction
            ? `Anfrage von ${pendingAction.customerName} ${
                pendingAction.next === 'CONFIRMED' ? 'bestätigen' : 'ablehnen'
              }?`
            : ''
        }
        confirmLabel={
          pendingAction?.next === 'CONFIRMED' ? 'Bestätigen' : 'Ablehnen'
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

      {actionError && (
        <Banner tone="error" role="alert">
          {actionError}
        </Banner>
      )}
    </div>
  );
}
