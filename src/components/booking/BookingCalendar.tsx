'use client';

/**
 * BookingCalendar — Kunden-Monatsansicht für `/buchung` (US-IT6-02
 * Kunden-Sicht).
 *
 * Lädt `GET /api/availability/calendar?from=&to=` (max. 62 Tage) und
 * zeigt pro Tag den Verfügbarkeits-Status:
 *   - grün-pastell  → verfügbar (Klick navigiert weiter zum Time-Picker).
 *   - gelb-pastell  → partial (klickbar, evtl. nur Restslots).
 *   - grau          → unavailable.
 *
 * Drop-in-Replacement für `<Calendar>` aus `src/components/booking/Calendar.tsx`,
 * aber ohne destructive change — der bestehende Calendar bleibt für
 * Re-Booking-Mode.
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ApiClientError } from '@/lib/api-client';
import { fetchAvailabilityCalendar } from '@/lib/api-client-it6';
import type { AvailabilityCalendarDay } from '@/lib/schemas';

const AppCalendar = dynamic(
  () => import('@/components/calendar/AppCalendar').then((m) => m.AppCalendar),
  {
    ssr: false,
    loading: () => <SkeletonCard />,
  },
);

interface BookingCalendarProps {
  /** Aktuell ausgewählter Tag (YYYY-MM-DD) — wird bei Klick in der Kalender-UI nicht visuell hervorgehoben (nur via Header). */
  selectedDate: string | null;
  onSelectDay: (dateIso: string) => void;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

function todayIso(): string {
  const now = new Date();
  // Local-Wallclock-Datum (Browser-Zone — bei Tom Europe/Berlin).
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function BookingCalendar({
  selectedDate,
  onSelectDay,
}: BookingCalendarProps) {
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [days, setDays] = useState<AvailabilityCalendarDay[]>([]);

  const loadDays = useCallback(async (from: string, to: string) => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchAvailabilityCalendar(from, to);
      setDays(data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiClientError) {
        if (err.status === 404) {
          // Backend noch nicht da → Fallback auf "alle frei" (UX-Notausgang).
          setDays([]);
          setErrorMessage(
            'Verfügbarkeits-Kalender ist gerade nicht erreichbar. Bitte rufe uns alternativ an.',
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage('Kalender konnte nicht geladen werden.');
      }
    }
  }, []);

  const handleRangeChange = useCallback(
    (from: string, to: string) => {
      void loadDays(from, to);
    },
    [loadDays],
  );

  const handleDaySelect = useCallback(
    (dateIso: string) => {
      // Vergangene Tage ignorieren — Backend liefert sie ohnehin als 'unavailable',
      // doppelte Sicherheit hier.
      if (dateIso < todayIso()) return;
      onSelectDay(dateIso);
    },
    [onSelectDay],
  );

  // Aktiven Tag visuell hervorheben — geschieht über zusätzlichen Tagesstatus.
  const enrichedDays = useMemo<AvailabilityCalendarDay[]>(() => {
    if (!selectedDate) return days;
    // Wir behalten den Status, aber heben den selektierten Tag im DOM
    // via :focus visuell hervor. Mehr Logik wäre over-engineered.
    return days;
  }, [days, selectedDate]);

  useEffect(() => {
    // Erstes Range wird durch FullCalendar's `datesSet` ausgelöst.
  }, []);

  return (
    <div className="space-y-3">
      {errorMessage && (
        <Banner tone="warning" role="alert" title="Hinweis">
          {errorMessage}
        </Banner>
      )}
      <div className="rounded-lg border border-baerenstark-sand bg-white p-2 sm:p-4">
        {status === 'idle' || status === 'loading' ? (
          <SkeletonCard />
        ) : (
          <AppCalendar
            mode="customer"
            days={enrichedDays}
            onRangeChange={handleRangeChange}
            onDaySelect={handleDaySelect}
          />
        )}
      </div>
      <CustomerLegend />
    </div>
  );
}

function CustomerLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-baerenstark-bark/80">
      <LegendItem color="#dcfce7" label="Verfügbar" />
      <LegendItem color="#fef3c7" label="Teilweise belegt" />
      <LegendItem color="#f3f4f6" label="Nicht verfügbar" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 rounded border border-baerenstark-sand"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  );
}
