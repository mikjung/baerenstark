'use client';

/**
 * US-17 — Zeitslot-Picker (Iteration 5: Dauer-aware, US-33).
 *
 * Lädt nach Tag- + Dauer-Auswahl `GET /api/slots/available?date=...&duration=...`
 * und zeigt die zurückgegebenen Blöcke als klickbare Kacheln.
 *
 * Zustände:
 *   - idle      → keine Tag/Dauer-Auswahl, nichts gerendert
 *   - loading   → Skeleton-Grid
 *   - ready     → Kacheln (verfügbar / belegt / ausgewählt)
 *   - empty     → "Tag nicht verfügbar" + Telefonnummer
 *   - error     → Fehler-Banner mit Retry
 */

import { useCallback, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { CONTACT } from '@/lib/contact';
import { ApiClientError, fetchAvailableSlots } from '@/lib/api-client';
import type { AvailableSlotsResponse, AvailableTimeSlot } from '@/lib/schemas';

export interface SelectedTimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  /** Iteration 5: tatsächlich gewählte Dauer (Minuten). */
  durationMinutes: number;
}

interface TimeSlotPickerProps {
  /** "YYYY-MM-DD" — wenn null, rendert die Komponente nichts. */
  date: string | null;
  /** Iteration 5 (US-33): vom Kunden gewählte Dauer (Minuten). */
  duration: number | null;
  /** Aktuell ausgewählter Slot (oder null). */
  selectedSlot: SelectedTimeSlot | null;
  onSelect: (slot: SelectedTimeSlot) => void;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

function isSameSlot(
  a: SelectedTimeSlot | null,
  date: string,
  s: AvailableTimeSlot,
): boolean {
  if (!a) return false;
  return a.date === date && a.startTime === s.startTime && a.endTime === s.endTime;
}

function formatRange(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime} Uhr`;
}

export function TimeSlotPicker({
  date,
  duration,
  selectedSlot,
  onSelect,
}: TimeSlotPickerProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<AvailableSlotsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!date || duration == null) return;
      setStatus('loading');
      setErrorMessage(null);
      try {
        const result = await fetchAvailableSlots(date, duration, signal);
        setData(result);
        setStatus('ready');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStatus('error');
        setErrorMessage(
          err instanceof ApiClientError
            ? err.message
            : 'Zeitslots konnten nicht geladen werden.',
        );
      }
    },
    [date, duration],
  );

  useEffect(() => {
    if (!date || duration == null) {
      setData(null);
      setStatus('idle');
      return;
    }
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [date, duration, load]);

  if (!date) {
    return null;
  }

  if (duration == null) {
    return (
      <Banner tone="info">
        <p>
          Bitte wähle zuerst die gewünschte Auftragsdauer — dann zeigen wir dir
          die passenden freien Zeitfenster.
        </p>
      </Banner>
    );
  }

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Verfügbare Zeitslots werden geladen"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14" ariaLabel="Lade Zeitslot" />
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Banner tone="error" title="Zeitslots konnten nicht geladen werden" role="alert">
        <p className="mb-3">{errorMessage ?? 'Bitte erneut versuchen.'}</p>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Erneut versuchen
        </Button>
      </Banner>
    );
  }

  if (!data) {
    return null;
  }

  // Empty / Tag inaktiv
  if (!data.isDayActive || data.slots.length === 0) {
    return (
      <Banner tone="info" title="Für diesen Tag sind keine Termine verfügbar">
        <p className="mb-3">
          {data.overrideReason
            ? `Hinweis: ${data.overrideReason}`
            : 'An diesem Tag bietet Tom keine Termine an oder die gewählte Dauer passt nicht in das verfügbare Zeitfenster.'}{' '}
          Falls es dringend ist, ruf uns gerne direkt an:
        </p>
        <a
          href={`tel:${CONTACT.phoneTel}`}
          className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
        >
          {CONTACT.phoneDisplay} anrufen
        </a>
      </Banner>
    );
  }

  // Sind überhaupt freie Slots dabei?
  const anyAvailable = data.slots.some((s) => s.available);

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label={`Verfügbare Zeitslots (${duration} Minuten)`}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
      >
        {data.slots.map((s) => {
          const selected = isSameSlot(selectedSlot, data.date, s);
          const disabled = !s.available;
          const label = formatRange(s.startTime, s.endTime);
          const ariaLabel = disabled
            ? `${label} (nicht verfügbar)`
            : selected
              ? `${label} (ausgewählt)`
              : `${label}`;
          return (
            <button
              key={`${s.startTime}-${s.endTime}`}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={ariaLabel}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onSelect({
                  date: data.date,
                  startTime: s.startTime,
                  endTime: s.endTime,
                  durationMinutes: duration,
                });
              }}
              className={[
                'flex items-center justify-center rounded-lg border px-3 py-3 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-baerenstark-accent',
                disabled
                  ? 'cursor-not-allowed border-baerenstark-sand/60 bg-baerenstark-sand/20 text-baerenstark-bark/40 line-through'
                  : selected
                    ? 'border-leaf bg-leaf text-white shadow-card'
                    : 'border-leaf bg-leaf/10 text-baerenstark-bark hover:bg-leaf/20 cursor-pointer',
              ].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </div>

      {!anyAvailable && (
        <Banner tone="warning" title="Alle Termine an diesem Tag sind belegt">
          <p>
            Für die gewählte Dauer ({duration} Minuten) ist an diesem Tag kein
            freies Zeitfenster verfügbar. Bitte wähle eine andere Dauer oder
            einen anderen Tag im Kalender — oder ruf uns direkt an:{' '}
            <strong>{CONTACT.phoneDisplay}</strong>.
          </p>
        </Banner>
      )}
    </div>
  );
}
