'use client';

/**
 * Modal: Admin schlägt einen Alternativtermin für eine PENDING-Buchung vor (US-13).
 *
 * - Lädt freie Slots via `GET /api/slots`.
 * - Filtert den aktuell auf der Booking liegenden Slot heraus.
 * - Sendet `POST /api/bookings/:id/counter-proposal` mit `{ newSlotId }`.
 * - Zwei Schritte: 1) Slot wählen, 2) Confirm-Dialog "Vorschlag senden".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import {
  ApiClientError,
  fetchSlots,
  sendCounterProposal,
} from '@/lib/api-client';
import { formatSlotRange, formatSlotRangeCompact } from '@/lib/format';
import type { SlotPublic } from '@/lib/schemas';

interface CounterProposalDialogProps {
  open: boolean;
  bookingId: string;
  customerName: string;
  currentSlot: { id: string; startsAt: string; endsAt: string };
  onClose: () => void;
  onSuccess: () => void;
}

export function CounterProposalDialog({
  open,
  bookingId,
  customerName,
  currentSlot,
  onClose,
  onSuccess,
}: CounterProposalDialogProps) {
  const [slots, setSlots] = useState<SlotPublic[]>([]);
  const [slotsStatus, setSlotsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [stage, setStage] = useState<'choose' | 'confirm'>('choose');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const firstFocusableRef = useRef<HTMLSelectElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setSlotsStatus('loading');
    try {
      const data = await fetchSlots();
      // Nur freie Slots, exkl. den aktuellen Slot der Booking
      const freeOthers = data.filter((s) => !s.isBooked && s.id !== currentSlot.id);
      setSlots(freeOthers);
      setSlotsStatus('ready');
    } catch {
      setSlotsStatus('error');
    }
  }, [currentSlot.id]);

  useEffect(() => {
    if (!open) return;
    setStage('choose');
    setSubmitError(null);
    setSelectedSlotId('');
    void load();
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    setTimeout(() => firstFocusableRef.current?.focus(), 50);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const slotOptions = useMemo(
    () =>
      slots.map((s) => ({
        value: s.id,
        label:
          formatSlotRangeCompact(s.startsAt, s.endsAt) +
          (s.description ? ` · ${s.description}` : ''),
      })),
    [slots],
  );

  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null;

  async function onSendProposal() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await sendCounterProposal(bookingId, selectedSlot.id);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Vorschlag konnte nicht gesendet werden.');
      }
      setStage('choose');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="counter-title"
      aria-describedby="counter-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-baerenstark-bark/50"
        onClick={() => !submitting && onClose()}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-baerenstark-sand bg-white p-6 shadow-card">
        <h2
          id="counter-title"
          className="mb-1 font-serif text-xl font-semibold text-baerenstark-bark"
        >
          Alternativtermin vorschlagen
        </h2>
        <p id="counter-desc" className="mb-4 text-sm text-baerenstark-bark/70">
          Schlage {customerName} einen anderen Termin vor. Der Kunde erhält
          eine E-Mail mit drei Optionen (Annehmen / Neu wählen / Stornieren).
        </p>

        <div className="mb-4 rounded-lg border-l-4 border-baerenstark-wood bg-baerenstark-sand/30 p-3 text-sm">
          <p className="font-medium text-baerenstark-bark/90">Aktueller Termin:</p>
          <p className="text-baerenstark-bark">
            {formatSlotRange(currentSlot.startsAt, currentSlot.endsAt)}
          </p>
        </div>

        {submitError && (
          <div className="mb-4">
            <Banner tone="error" role="alert">
              {submitError}
            </Banner>
          </div>
        )}

        {slotsStatus === 'loading' && (
          <p className="text-sm text-baerenstark-bark/70">Slots werden geladen…</p>
        )}

        {slotsStatus === 'error' && (
          <Banner tone="error" title="Slots konnten nicht geladen werden" role="alert">
            <p className="mb-3">Bitte später erneut versuchen.</p>
            <Button variant="secondary" size="sm" onClick={load}>
              Erneut versuchen
            </Button>
          </Banner>
        )}

        {slotsStatus === 'ready' && slotOptions.length === 0 && (
          <Banner tone="warning" title="Keine freien Slots verfügbar">
            <p>
              Lege zuerst einen freien Slot im Tab „Zeitfenster" an, dann kannst
              du ihn hier als Alternativtermin vorschlagen.
            </p>
          </Banner>
        )}

        {slotsStatus === 'ready' && slotOptions.length > 0 && stage === 'choose' && (
          <>
            <Select
              ref={firstFocusableRef}
              label="Alternativer Slot"
              required
              placeholder="Bitte wählen"
              options={slotOptions}
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
            />

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={onClose} disabled={submitting}>
                Abbrechen
              </Button>
              <Button
                variant="primary"
                disabled={!selectedSlot}
                onClick={() => setStage('confirm')}
              >
                Weiter
              </Button>
            </div>
          </>
        )}

        {stage === 'confirm' && selectedSlot && (
          <>
            <div className="rounded-lg border border-leaf bg-leaf/10 p-3 text-sm text-baerenstark-bark">
              <p className="font-medium text-leaf">Du schlägst diesen Termin vor:</p>
              <p className="mt-1">
                {formatSlotRange(selectedSlot.startsAt, selectedSlot.endsAt)}
                {selectedSlot.description && (
                  <span className="text-baerenstark-bark/70"> · {selectedSlot.description}</span>
                )}
              </p>
              <p className="mt-2 text-xs text-baerenstark-bark/70">
                {customerName} erhält eine E-Mail mit drei Aktionslinks. Die
                Buchung wird auf „Vorschlag offen" gesetzt.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => setStage('choose')}
                disabled={submitting}
              >
                Zurück
              </Button>
              <Button
                variant="primary"
                onClick={onSendProposal}
                isLoading={submitting}
              >
                Vorschlag senden
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
