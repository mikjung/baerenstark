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
 *
 * IT9 / US-IT9-03 (State-Machine-Deadlock-Fix):
 *   - Vorher: `status: 'idle'` blockierte den Mount von `<AppCalendar>`
 *     (Skeleton-Ersatz). Da `<AppCalendar>` aber die einzige Quelle für
 *     `onRangeChange` war, wurde `loadDays` nie aufgerufen → `status` blieb
 *     für immer `idle` → permanenter Skeleton, kein sichtbarer Kalender,
 *     keine Buchung möglich (1:1 Bug-Klasse wie US-IT8-02 in
 *     `AdminCalendarView.tsx`).
 *   - Jetzt: Kalender mountet immer. Skeleton liegt als Overlay über dem
 *     Kalender, solange der initiale/laufende Fetch nicht abgeschlossen
 *     ist. Initialer Range wird vor dem Mount per `useEffect` einmal manuell
 *     geladen (`computeInitialMonthRangeBerlin` aus `src/lib/calendar-range`).
 *   - De-Duplizierung: `lastRangeRef` skipped redundante Fetches (Initial-
 *     Effect + datesSet-Trigger). `abortRef` bricht in-flight Fetches ab,
 *     `mountedRef` verhindert `setState` nach Unmount.
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ApiClientError } from '@/lib/api-client';
import { fetchAvailabilityCalendar } from '@/lib/api-client-it6';
import { computeInitialMonthRangeBerlin } from '@/lib/calendar-range';
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

// IT9 / US-IT9-03: Kein `'idle'` mehr — Komponente startet sofort in
// `'loading'` und triggert den initialen Fetch im `useEffect`. Damit ist der
// alte Deadlock-Pfad ausgeschlossen.
type LoadStatus = 'loading' | 'ready' | 'error';

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
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [days, setDays] = useState<AvailabilityCalendarDay[]>([]);

  /**
   * De-Duplizierungs-Strategie (IT9 / US-IT9-03, analog IT8-02 BUG-IT8-02-A):
   * - `lastRangeRef`: hält den zuletzt angeforderten `{from,to}` und macht
   *   `loadDays` zum No-Op, wenn der Range identisch ist. Verhindert den
   *   initialen Doppel-Fetch (useEffect → datesSet feuert beim Mount mit
   *   ggf. identischem Range).
   * - `abortRef`: bricht laufende Fetches ab, sobald ein neuer startet —
   *   verhindert Race-Conditions, bei denen ein alter Response einen
   *   neueren `setDays`-State überschreibt.
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

  const loadDays = useCallback(async (from: string, to: string) => {
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
      const data = await fetchAvailabilityCalendar(from, to, ctrl.signal);
      if (ctrl.signal.aborted || !mountedRef.current) return;
      setDays(data);
      setStatus('ready');
    } catch (err) {
      if (ctrl.signal.aborted || !mountedRef.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Auch bei Fehlern: Kalender bleibt sichtbar, Banner zeigt Fehler.
      setStatus('error');
      if (err instanceof ApiClientError) {
        if (err.status === 404) {
          // Backend-Endpoint noch nicht da → Bestand-Meldung mit
          // Telefon-Fallback (Tom hat das in IT6 so eingeführt).
          setDays([]);
          setErrorMessage(
            'Verfügbarkeits-Kalender ist gerade nicht erreichbar. Bitte rufe uns alternativ an.',
          );
        } else {
          // IT9 / US-IT9-03 AC5: 5xx / Network / sonstige Fehler bekommen
          // den Story-AC5-Wortlaut.
          setErrorMessage(
            'Verfügbare Termine konnten nicht geladen werden. Bitte Seite neu laden.',
          );
        }
      } else {
        setErrorMessage(
          'Verfügbare Termine konnten nicht geladen werden. Bitte Seite neu laden.',
        );
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

  // IT9 / US-IT9-03: Initialer Range-Fetch BEVOR `<AppCalendar>` gemountet
  // ist (löst den IT7/IT8-Deadlock auf — derselbe Pattern-Fix wie in
  // `AdminCalendarView.tsx`). Sobald FullCalendar gemountet ist, feuert
  // `datesSet` mit dem View-Range; `loadDays` filtert das via `lastRangeRef`
  // als No-Op heraus, falls der Range identisch ist.
  useEffect(() => {
    const { from, to } = computeInitialMonthRangeBerlin();
    void loadDays(from, to);
  }, [loadDays]);

  // Tone für Fehler-Banner: Bei reinem 404-Fallback bleiben wir auf
  // 'warning' (Bestand), bei harten Lade-Fehlern eskalieren wir auf
  // 'error', damit der User die AC5-Aktion (Seite neu laden) klar sieht.
  const errorBannerTone =
    errorMessage?.includes('rufe uns alternativ an') ? 'warning' : 'error';

  // Empty-State: Kalender ist geladen, aber es gibt im sichtbaren Range
  // keinen einzigen verfügbaren oder partial-Tag. Geschlossene Tage
  // erscheinen weiterhin als grau im Kalender — der Hinweis darüber sagt
  // dem Kunden, dass derzeit keine Buchung möglich ist.
  const hasAnyBookableDay =
    status === 'ready' && days.some((d) => d.status !== 'unavailable');
  const showEmptyHint = status === 'ready' && days.length > 0 && !hasAnyBookableDay;

  return (
    <div className="space-y-3">
      {errorMessage && (
        <Banner tone={errorBannerTone} role="alert" title="Hinweis">
          {errorMessage}
        </Banner>
      )}
      {showEmptyHint && (
        <Banner tone="info" role="status" title="Im aktuellen Zeitraum keine Termine">
          <p>
            Im sichtbaren Zeitraum sind aktuell keine freien Termine verfügbar.
            Bitte navigiere im Kalender weiter (Pfeile oben) oder rufe uns
            alternativ an.
          </p>
        </Banner>
      )}
      {/*
        IT9 / US-IT9-03: `<AppCalendar>` IMMER mounten, damit der Mount nicht
        vom Load-Status abhängt (alter Bug: Skeleton-Ersatz blockierte den
        einzigen Range-Change-Trigger). Skeleton liegt jetzt als Overlay über
        dem Kalender, solange der initiale/laufende Fetch nicht abgeschlossen
        ist.
      */}
      <div className="relative rounded-lg border border-baerenstark-sand bg-white p-2 sm:p-4">
        <AppCalendar
          mode="customer"
          days={enrichedDays}
          onRangeChange={handleRangeChange}
          onDaySelect={handleDaySelect}
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
