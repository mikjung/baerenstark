'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  ArrowRightIcon,
  FilterIcon,
  InboxIcon,
} from '@/components/ui/icons';
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
  humanSize,
} from '@/lib/format';
import type { BookingAdminIT14, BookingStatus } from '@/lib/schemas';
import { getServiceLabel } from '@/lib/services';
import { CounterProposalDialog } from './CounterProposalDialog';
import { PaymentEditor } from './PaymentEditor';
import { FinalPriceEditor } from './FinalPriceEditor';

// IT14-S03 — Multi-Select-Filter über die kanonischen 6 BookingStatus-Werte
// (`PENDING, CONFIRMED, COUNTER_PROPOSED, REJECTED, CANCELLED, COMPLETED`).
// Default beim Mount: nur PENDING + CONFIRMED — Tom sieht offene + bestätigte
// Anfragen, ohne erst manuell filtern zu müssen.
type ActiveFilters = ReadonlySet<BookingStatus>;

const ALL_STATUS: ReadonlyArray<BookingStatus> = [
  'PENDING',
  'CONFIRMED',
  'COUNTER_PROPOSED',
  'CANCELLED',
  'REJECTED',
  'COMPLETED',
];

const DEFAULT_FILTERS: ActiveFilters = new Set<BookingStatus>([
  'PENDING',
  'CONFIRMED',
]);

const FILTER_PILL_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Offen',
  CONFIRMED: 'Bestätigt',
  COUNTER_PROPOSED: 'Gegenvorschlag',
  CANCELLED: 'Storniert',
  REJECTED: 'Abgelehnt',
  COMPLETED: 'Abgeschlossen',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Offen',
  CONFIRMED: 'Bestätigt',
  REJECTED: 'Abgelehnt',
  COUNTER_PROPOSED: 'Vorschlag ausstehend',
  CANCELLED: 'Storniert',
  COMPLETED: 'Abgeschlossen',
};

const PAYMENT_METHOD_LABEL: Record<'CASH' | 'BANK_TRANSFER', string> = {
  CASH: 'Bar',
  BANK_TRANSFER: 'Überweisung',
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
  const [bookings, setBookings] = useState<BookingAdminIT14[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // IT14-S03 — Multi-Select-Filter, Default-Werte ['PENDING', 'CONFIRMED'].
  // Kein localStorage-Persist (AC#3): bei jedem Mount ist Default aktiv.
  const [filter, setFilter] = useState<ActiveFilters>(DEFAULT_FILTERS);
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

  // IT14-S03 — Multi-Select-Filter. `filter.size === 0` zeigt einen
  // separaten Empty-State (Tom hat alle Pills deaktiviert), nicht „alle".
  const filtered = useMemo(() => {
    if (filter.size === 0) return [];
    return bookings.filter((b) => filter.has(b.status));
  }, [bookings, filter]);

  const togglePill = useCallback((s: BookingStatus) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setFilter(new Set(ALL_STATUS));
  }, []);

  const resetToDefault = useCallback(() => {
    setFilter(new Set(DEFAULT_FILTERS));
  }, []);

  // IT14-S03 — Erkennt, ob aktuell der Default-Filter aktiv ist (für die
  // korrekte Empty-State-Headline „Keine offenen Anfragen").
  const isDefaultFilter = useMemo(() => {
    if (filter.size !== DEFAULT_FILTERS.size) return false;
    for (const s of DEFAULT_FILTERS) {
      if (!filter.has(s)) return false;
    }
    return true;
  }, [filter]);

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
      {/*
        IT14-S03 — Multi-Select-Toggle-Pills. Semantik: jede Pill ist eine
        Checkbox (`role="checkbox"` + `aria-checked`), keine Tabs. Container
        ist `role="group"` mit Label „Status-Filter".
      */}
      <div role="group" aria-label="Status-Filter" className="flex flex-wrap gap-2">
        {ALL_STATUS.map((s) => {
          const active = filter.has(s);
          return (
            <button
              key={s}
              type="button"
              role="checkbox"
              aria-checked={active}
              onClick={() => togglePill(s)}
              className={[
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors min-h-[44px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2',
                active
                  ? 'border-baerenstark-wood bg-baerenstark-wood text-baerenstark-cream'
                  : 'border-baerenstark-sand bg-white/60 text-baerenstark-bark hover:bg-baerenstark-sand/50',
              ].join(' ')}
            >
              {FILTER_PILL_LABEL[s]}
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
        // IT14-S03 — Drei Empty-State-Variants:
        //  1) `no-active-filter` — Tom hat alle Pills deaktiviert.
        //  2) `default-empty`   — Default-Filter aktiv, aber 0 Treffer.
        //  3) Fallback          — Andere Filter-Kombination, 0 Treffer
        //                          (z. B. nur „Abgelehnt" und keine
        //                          abgelehnten Anfragen vorhanden).
        filter.size === 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-baerenstark-sand bg-white/70 py-12 text-center"
          >
            <span aria-hidden="true" className="text-baerenstark-bark/40">
              <FilterIcon size={32} />
            </span>
            <h3 className="text-lg font-semibold text-baerenstark-bark">
              Wähle mindestens einen Status
            </h3>
            <p className="max-w-md text-sm text-baerenstark-bark/70">
              Aktiviere oben mindestens einen Status-Filter, um Buchungen zu sehen.
            </p>
            <Button variant="ghost" size="sm" onClick={resetToDefault}>
              Standard wiederherstellen
            </Button>
          </div>
        ) : isDefaultFilter ? (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-baerenstark-sand bg-white/70 py-12 text-center"
          >
            <span aria-hidden="true" className="text-baerenstark-bark/40">
              <InboxIcon size={32} />
            </span>
            <h3 className="text-lg font-semibold text-baerenstark-bark">
              Keine offenen Anfragen
            </h3>
            <p className="max-w-md text-sm text-baerenstark-bark/70">
              Sobald eine neue Buchungsanfrage eingeht, erscheint sie hier
              automatisch.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={showAll}
              className="inline-flex items-center gap-1"
            >
              Alle Anfragen anzeigen
              <span aria-hidden="true">
                <ArrowRightIcon size={14} />
              </span>
            </Button>
          </div>
        ) : (
          <Banner tone="info" title="Keine Anfragen in dieser Ansicht">
            <p>In dieser Filteransicht ist nichts vorhanden.</p>
          </Banner>
        )
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
                      {/*
                        IT14-S04 — Schema-Refactor: kein `as`-Cast mehr,
                        `b.finalPriceEur` ist Teil von `BookingAdminIT14`.
                      */}
                      {(() => {
                        const fp = b.finalPriceEur;
                        if (fp === null || fp === undefined || fp === '') return null;
                        const n = Number(fp);
                        if (!Number.isFinite(n)) return null;
                        return (
                          <Badge tone="info" title="Finaler Preis">
                            {n.toLocaleString('de-DE', {
                              style: 'currency',
                              currency: 'EUR',
                              maximumFractionDigits: 0,
                            })}
                          </Badge>
                        );
                      })()}
                      {/*
                        IT14-S05 — Zahlungsart-Badge (Bar / Überweisung) nur
                        rendern, wenn `paymentMethod` gesetzt ist. NULL =
                        kein Badge (UX-Spec §4.4).
                      */}
                      {b.paymentMethod && (
                        <Badge tone="info" title="Zahlungsart">
                          {PAYMENT_METHOD_LABEL[b.paymentMethod]}
                        </Badge>
                      )}
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
                    {/* IT11 / US-IT11-04 — Anhang-Anzeige mit Thumbnail,
                        Dateigröße und Empty-State. Lightbox out-of-scope (IT12). */}
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-baerenstark-bark/70">
                        Anhänge
                        {b.attachments.length > 0
                          ? ` (${b.attachments.length})`
                          : ''}
                      </dt>
                      {b.attachments.length === 0 ? (
                        <dd className="text-baerenstark-bark/60">
                          Keine Dateien hochgeladen
                        </dd>
                      ) : (
                        <dd>
                          <ul
                            role="list"
                            className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2"
                          >
                            {b.attachments.map((att) => {
                              const isImage = att.contentType.startsWith('image/');
                              const isVideo = att.contentType.startsWith('video/');
                              const icon = isImage
                                ? '🖼️'
                                : att.contentType === 'application/pdf'
                                  ? '📄'
                                  : isVideo
                                    ? '🎬'
                                    : '📎';
                              return (
                                <li key={att.id}>
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 rounded-md border border-baerenstark-sand bg-white/80 p-2 text-xs text-baerenstark-bark hover:border-baerenstark-wood hover:bg-baerenstark-sand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
                                  >
                                    {isImage ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={att.url}
                                        alt=""
                                        loading="lazy"
                                        className="h-15 w-15 flex-none rounded-md object-cover"
                                        style={{ height: 60, width: 60 }}
                                      />
                                    ) : (
                                      <span
                                        aria-hidden="true"
                                        className="flex flex-none items-center justify-center rounded-md bg-baerenstark-sand/60 text-2xl"
                                        style={{ height: 60, width: 60 }}
                                      >
                                        {icon}
                                      </span>
                                    )}
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate font-medium">
                                        {att.filename}
                                      </span>
                                      <span className="block text-baerenstark-bark/60">
                                        {humanSize(att.sizeBytes)} ·{' '}
                                        {att.contentType}
                                      </span>
                                    </span>
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        </dd>
                      )}
                    </div>
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

                  {/* US-IT6-08 + IT14-S04/S05: Finaler Preis + Zahlungsart (Admin-intern) */}
                  <div className="mt-3">
                    <FinalPriceEditor
                      bookingId={b.id}
                      initialFinalPriceEur={b.finalPriceEur ?? null}
                      initialFinalPriceNote={b.finalPriceNote ?? null}
                      initialPaymentMethod={b.paymentMethod ?? null}
                      onSaved={(price, note, method) => {
                        setBookings((prev) =>
                          prev.map((x) =>
                            x.id === b.id
                              ? {
                                  ...x,
                                  finalPriceEur: price,
                                  finalPriceNote: note,
                                  paymentMethod: method,
                                }
                              : x,
                          ),
                        );
                      }}
                    />
                  </div>

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
