'use client';

/**
 * AdminCalendarView — `/admin/calendar` (US-IT6-02 Admin-Sicht).
 *
 * Funktionen:
 *   - Lädt Events via `GET /api/admin/calendar/events?from=&to=` (max. 90 d).
 *   - Klick auf ein Buchungs-Event → Popover mit Detail + Link.
 *   - Drag-to-create (`select`) → vorausgefülltes DayOverride/Slot-Modal
 *     (im MVP: zeigt einen Hinweis-Banner mit den vorausgefüllten Werten —
 *     die alte `<DayOverrideManager>`-Form bleibt unter `/admin#availability`).
 *   - Wochen-/Tag-/Monatsansicht.
 *   - Mobile-Touch-Floor 44 px (siehe AppCalendar).
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ApiClientError } from '@/lib/api-client';
import { fetchAdminCalendarEvents } from '@/lib/api-client-it6';
import { formatDateTime } from '@/lib/format';
import type { CalendarEvent, BookingStatus } from '@/lib/schemas';

// FullCalendar nur im Browser laden (siehe ARCHITECTURE_IT6.md §4.4).
const AppCalendar = dynamic(
  () => import('@/components/calendar/AppCalendar').then((m) => m.AppCalendar),
  {
    ssr: false,
    loading: () => <SkeletonCard />,
  },
);

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Offen',
  CONFIRMED: 'Bestätigt',
  REJECTED: 'Abgelehnt',
  COUNTER_PROPOSED: 'Vorschlag ausstehend',
  CANCELLED: 'Storniert',
  COMPLETED: 'Abgeschlossen',
};

interface PopoverState {
  event: CalendarEvent;
  href: string | null;
}

interface CreatedDraft {
  startIso: string;
  endIso: string;
}

export function AdminCalendarView() {
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [draft, setDraft] = useState<CreatedDraft | null>(null);

  const loadEvents = useCallback(async (from: string, to: string) => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchAdminCalendarEvents(from, to);
      setEvents(data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiClientError) {
        if (err.status === 404) {
          // Backend-Endpoint noch nicht deployed.
          setEvents([]);
          setErrorMessage(
            'Kalender-Endpoint ist noch nicht aktiv. Termine erscheinen, sobald das Backend deployed ist.',
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
      // Range-Limit: max 90 Tage (siehe Schema). Wenn ein User-View
      // (z.B. Monatsansicht) das überschreitet, kürzen wir nicht — der
      // Backend-Validator wirft 400 mit klarer Message.
      void loadEvents(from, to);
    },
    [loadEvents],
  );

  const handleEventClick = useCallback((event: CalendarEvent) => {
    if (event.type !== 'BOOKING') {
      setPopover(null);
      return;
    }
    setPopover({
      event,
      href: event.url ?? `/admin/bookings/${encodeURIComponent(event.id)}`,
    });
  }, []);

  const handleSelectRange = useCallback((startIso: string, endIso: string) => {
    setDraft({ startIso, endIso });
  }, []);

  // Close popover on Escape.
  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popover]);

  const popoverContent = useMemo(() => {
    if (!popover) return null;
    const ev = popover.event;
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-popover-title"
        onClick={() => setPopover(null)}
      >
        <div
          className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="cal-popover-title"
            className="font-serif text-xl font-bold text-baerenstark-bark"
          >
            {ev.title}
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-baerenstark-bark/70">Status</dt>
              <dd className="font-medium">
                {ev.status ? STATUS_LABEL[ev.status] : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-baerenstark-bark/70">Start</dt>
              <dd>{formatDateTime(ev.start)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-baerenstark-bark/70">Ende</dt>
              <dd>{formatDateTime(ev.end)}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPopover(null)}>
              Schließen
            </Button>
            {popover.href && (
              <a
                href={popover.href}
                className="inline-flex items-center justify-center rounded-md bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark"
              >
                Buchung öffnen
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }, [popover]);

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Banner tone="error" role="alert" title="Fehler">
          {errorMessage}
        </Banner>
      )}

      {draft && (
        <Banner
          tone="info"
          title="Neuer Slot angelegt — Auswahl übernommen"
          role="status"
        >
          <p className="text-sm">
            Du hast den Bereich von <strong>{formatDateTime(draft.startIso)}</strong>{' '}
            bis <strong>{formatDateTime(draft.endIso)}</strong> markiert. Die
            detaillierte Slot-Anlage erfolgt im Bestand-Formular unter „Verfügbarkeit/Zeitfenster"
            mit den vorausgefüllten Werten.
          </p>
          <div className="mt-3 flex gap-2">
            <a
              href={`/admin/slots?prefillStart=${encodeURIComponent(
                draft.startIso,
              )}&prefillEnd=${encodeURIComponent(draft.endIso)}`}
              className="inline-flex items-center justify-center rounded-md bg-baerenstark-wood px-3 py-1.5 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark"
            >
              Zum Slot-Formular
            </a>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Verwerfen
            </Button>
          </div>
        </Banner>
      )}

      <div className="rounded-lg border border-baerenstark-sand bg-white p-2 sm:p-4">
        {status === 'idle' || status === 'loading' ? (
          <SkeletonCard />
        ) : (
          <AppCalendar
            mode="admin"
            events={events}
            onRangeChange={handleRangeChange}
            onEventClick={handleEventClick}
            onSelectRange={handleSelectRange}
          />
        )}
      </div>

      <Legend />

      {popoverContent}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-baerenstark-bark/80">
      <LegendItem color="#16a34a" label="Bestätigt" />
      <LegendItem color="#3b82f6" label="Offen" />
      <LegendItem color="#f59e0b" label="Vorschlag" />
      <LegendItem color="#0ea5e9" label="Abgeschlossen" />
      <LegendItem color="#9ca3af" label="Buffer / abgelehnt" />
      <LegendItem color="#bbf7d0" label="Verfügbar (Hintergrund)" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 rounded"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  );
}
