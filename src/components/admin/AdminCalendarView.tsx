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
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ArrowUpRightIcon } from '@/components/ui/icons';
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

// IT8 / US-IT8-02: Der frühere `'idle'`-Zustand wurde entfernt — die
// Komponente startet sofort in `'loading'` und triggert den initialen
// Fetch im `useEffect`. Damit ist der alte Deadlock-Pfad ausgeschlossen.
type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Berechnet den initialen Range, der vor dem Mount von `<AppCalendar>`
 * geladen wird (US-IT8-02). Default-View des Admin-Kalenders ist
 * `timeGridWeek` auf Desktop und `timeGridDay` auf Mobile — wir laden eine
 * komfortable 14-Tage-Spanne (heute − 1, +13 Tage), die beide Ansichten
 * sicher abdeckt. Sobald FullCalendar gemountet ist, feuert sein
 * `datesSet`-Hook und wir laden den exakten View-Range nach (de-dupliziert
 * via `lastRangeRef`, siehe `loadEvents`).
 */
function computeInitialRangeBerlin(): { from: string; to: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 1);
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + 13);
  return { from: fmt.format(fromDate), to: fmt.format(toDate) };
}

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
  // IT8 / US-IT8-02:
  // Zuvor: `status: 'idle'` blockierte den Mount von `<AppCalendar>` (Skeleton-
  // Ersatz). Da `<AppCalendar>` aber die einzige Quelle für `onRangeChange`
  // war, wurde `loadEvents` nie aufgerufen → `status` blieb für immer `idle`
  // → Deadlock, kein Kalender sichtbar.
  // Jetzt: Kalender mountet immer; Skeleton ist Overlay während des
  // initialen/laufenden Loads. Der initiale Range wird vor dem Mount per
  // `useEffect` einmal manuell geladen.
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [draft, setDraft] = useState<CreatedDraft | null>(null);

  /**
   * De-Duplizierungs-Strategie (QA-Major BUG-IT8-02-A):
   * - `lastRangeRef`: hält den zuletzt angeforderten `{from,to}` und macht
   *   `loadEvents` zum No-Op, wenn der Range identisch ist.
   * - `abortRef`: bricht laufende Fetches ab, sobald ein neuer startet —
   *   verhindert Race-Conditions, bei denen ein alter Response einen
   *   neueren `setEvents`-State überschreibt.
   * - `mountedRef`: gibt frei, ob die Komponente noch montiert ist; verhindert
   *   `setState` nach Unmount (React-Warning).
   */
  const lastRangeRef = useRef<{ from: string; to: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const loadEvents = useCallback(async (from: string, to: string) => {
    // De-Dup: Range unverändert → kein erneuter Fetch.
    const last = lastRangeRef.current;
    if (last && last.from === from && last.to === to) return;
    lastRangeRef.current = { from, to };

    // In-Flight-Fetch abbrechen, falls vorhanden.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchAdminCalendarEvents(from, to, ctrl.signal);
      if (ctrl.signal.aborted || !mountedRef.current) return;
      setEvents(data);
      setStatus('ready');
    } catch (err) {
      if (ctrl.signal.aborted || !mountedRef.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Auch bei Fehlern: Kalender bleibt sichtbar, Banner zeigt Fehler.
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

  // Initialer Range-Fetch vor dem Mount von `<AppCalendar>` — löst den
  // IT7-Deadlock auf (US-IT8-02). `datesSet` aus FullCalendar feuert dann
  // ggf. mit dem exakten View-Range; `loadEvents` filtert das via
  // `lastRangeRef` als No-Op heraus, wenn der Range identisch ist.
  useEffect(() => {
    const { from, to } = computeInitialRangeBerlin();
    void loadEvents(from, to);
  }, [loadEvents]);

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
      // IT14-S06 / M-8 — BUFFER/AVAILABILITY haben keine Booking-Detail-Ziel.
      // Popover gar nicht öffnen (UX-Spec §5.3 — verbindlich: Button nicht
      // rendern, statt disabled).
      setPopover(null);
      return;
    }
    // Detail-Route ist seit IT14 sauber: `/admin/bookings/[id]` existiert.
    // Backend liefert `event.url` bereits korrekt; Fallback nur als
    // Defense-in-Depth.
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
          {/*
            IT14-S06 — Buchung-öffnen-Button:
              · nur rendern, wenn `event.type === 'BOOKING'` UND `popover.href`.
              · Mobile-Touch-Target ≥ 44 px (`min-h-[44px]`, `py-3` Layout).
              · Nutzt Next.js `<Link>` für Client-Navigation ohne Full-Reload.
          */}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPopover(null)}>
              Schließen
            </Button>
            {ev.type === 'BOOKING' && popover.href && (
              <Link
                href={popover.href}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-baerenstark-wood px-4 py-3 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
              >
                Buchung öffnen
                <span aria-hidden="true">
                  <ArrowUpRightIcon size={14} />
                </span>
              </Link>
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

      {/*
        IT8 / US-IT8-02: `<AppCalendar>` immer mounten, damit der Mount nicht
        vom Load-Status abhängt (alter Bug: Skeleton-Ersatz blockierte den
        einzigen Range-Change-Trigger). Skeleton liegt jetzt als Overlay über
        dem Kalender, solange der initiale/laufende Fetch nicht abgeschlossen
        ist.
      */}
      <div className="relative rounded-lg border border-baerenstark-sand bg-white p-2 sm:p-4">
        <AppCalendar
          mode="admin"
          events={events}
          onRangeChange={handleRangeChange}
          onEventClick={handleEventClick}
          onSelectRange={handleSelectRange}
        />
        {status === 'loading' && (
          <div
            className="pointer-events-none absolute inset-0 flex items-start justify-center rounded-lg bg-white/60 p-4"
            aria-hidden="true"
          >
            <div className="w-full max-w-md">
              <SkeletonCard />
            </div>
          </div>
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
