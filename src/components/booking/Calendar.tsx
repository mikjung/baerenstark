'use client';

/**
 * Kalender-Monatsansicht (US-16).
 *
 * Lädt `GET /api/calendar?year=YYYY&month=M` und stellt verfügbare Tage
 * grün, blockierte Tage rot, vergangene Tage ausgegraut dar. Klick auf
 * einen verfügbaren Tag triggert `onSelectDay`. Klick auf einen blockierten
 * Tag zeigt einen kurzen Hinweis.
 *
 * Bewusst ohne externe Library gebaut, damit Bundle klein bleibt und das
 * Verhalten 1:1 zur Spec passt. Touch-freundlich, mobile-first.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { CONTACT } from '@/lib/contact';
import { ApiClientError, fetchCalendar } from '@/lib/api-client';
import type { CalendarDay, CalendarMonth } from '@/lib/schemas';

interface CalendarProps {
  /** YYYY-MM-DD des aktuell ausgewählten Tages, oder null. */
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  onBlockedClick?: (date: string) => void;
}

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_LABELS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

function todayInBerlin(): { year: number; month: number; day: number; iso: string } {
  // Aktuelles Datum in Europe/Berlin als YYYY-MM-DD ableiten.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const iso = fmt.format(new Date()); // "2026-05-02"
  const [y, m, d] = iso.split('-').map((p) => Number(p));
  return { year: y, month: m, day: d, iso };
}

/**
 * Liefert den Wochentag (Mo=0..So=6) für ein YYYY-MM-DD.
 * Wir behandeln das Datum als Mittag-UTC, damit DST-Wechsel keine Off-by-One
 * verursachen.
 */
function weekdayMondayBased(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // JS getUTCDay: 0=Sun..6=Sat → wir wollen 0=Mo..6=So
  const jsDay = dt.getUTCDay();
  return (jsDay + 6) % 7;
}

function isPastDate(date: string): boolean {
  return date < todayInBerlin().iso;
}

function isToday(date: string): boolean {
  return date === todayInBerlin().iso;
}

export function Calendar({ selectedDate, onSelectDay, onBlockedClick }: CalendarProps) {
  const initial = todayInBerlin();
  const [year, setYear] = useState<number>(initial.year);
  const [month, setMonth] = useState<number>(initial.month); // 1..12
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blockedToast, setBlockedToast] = useState<string | null>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setStatus('loading');
      setErrorMessage(null);
      try {
        const result = await fetchCalendar(year, month, signal);
        setData(result);
        setStatus('ready');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStatus('error');
        setErrorMessage(
          err instanceof ApiClientError ? err.message : 'Kalender konnte nicht geladen werden.',
        );
      }
    },
    [year, month],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // Auto-clear blocked-toast nach 4 s.
  useEffect(() => {
    if (!blockedToast) return;
    const t = setTimeout(() => setBlockedToast(null), 4000);
    return () => clearTimeout(t);
  }, [blockedToast]);

  function goPrev() {
    if (year === initial.year && month === initial.month) return; // keine Vergangenheit
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNext() {
    // Hard-Cap: max 12 Monate in die Zukunft (Backend-Vorlauf 365 Tage).
    const maxYear = initial.year + (initial.month + 12 > 12 ? 1 : 0);
    if (year >= maxYear && month >= ((initial.month + 11) % 12) + 1) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const canGoPrev = !(year === initial.year && month === initial.month);

  // Map date → CalendarDay für O(1) Lookup
  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    if (data) {
      for (const d of data.days) map.set(d.date, d);
    }
    return map;
  }, [data]);

  // Grid-Tage berechnen (Leading-Padding bis Mo)
  const gridCells = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const leading = weekdayMondayBased(firstDate); // 0..6
    const cells: Array<{ date: string | null; day: CalendarDay | null }> = [];
    for (let i = 0; i < leading; i++) {
      cells.push({ date: null, day: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, day: dayMap.get(date) ?? null });
    }
    // Trailing-Padding bis voll auf 7er-Reihe
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null });
    return cells;
  }, [year, month, dayMap]);

  // Empty-State: alle Tage rot
  const allBlocked =
    data !== null &&
    data.days.length > 0 &&
    data.days.every((d) => !d.available);

  function handleDayClick(date: string, day: CalendarDay | null) {
    if (isPastDate(date)) return;
    const available = day?.available === true;
    if (!available) {
      setBlockedToast(date);
      onBlockedClick?.(date);
      return;
    }
    onSelectDay(date);
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    date: string,
    day: CalendarDay | null,
  ) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDayClick(date, day);
    }
  }

  return (
    <div className="rounded-2xl border border-baerenstark-sand bg-white/80 p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label="Vorheriger Monat"
        >
          ‹ Zurück
        </Button>
        <h3
          className="font-serif text-lg font-semibold text-baerenstark-bark sm:text-xl"
          aria-live="polite"
        >
          {MONTH_LABELS[month - 1]} {year}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={goNext}
          aria-label="Nächster Monat"
        >
          Weiter ›
        </Button>
      </div>

      {status === 'error' && (
        <Banner tone="error" title="Kalender konnte nicht geladen werden" role="alert">
          <p className="mb-3">{errorMessage ?? 'Bitte erneut versuchen.'}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Erneut versuchen
          </Button>
        </Banner>
      )}

      {status !== 'error' && (
        <>
          <div
            role="grid"
            aria-label={`Kalender ${MONTH_LABELS[month - 1]} ${year}`}
            className="select-none"
          >
            <div role="row" className="mb-2 grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  role="columnheader"
                  className="py-1 text-xs font-semibold uppercase tracking-wide text-baerenstark-bark/60"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {gridCells.map((cell, idx) => {
                if (!cell.date) {
                  return (
                    <div
                      key={`pad-${idx}`}
                      role="gridcell"
                      aria-hidden="true"
                      className="aspect-square"
                    />
                  );
                }
                const past = isPastDate(cell.date);
                const today = isToday(cell.date);
                const available = cell.day?.available === true && !past;
                const blocked = !available;
                const isSelected = selectedDate === cell.date;
                const isLoading = status === 'loading';
                const dayNumber = Number(cell.date.split('-')[2]);

                const baseClasses = [
                  'relative flex aspect-square w-full items-center justify-center rounded-lg border text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-baerenstark-accent',
                ];
                if (isLoading) {
                  baseClasses.push(
                    'border-baerenstark-sand bg-baerenstark-sand/20 text-baerenstark-bark/40',
                  );
                } else if (past) {
                  baseClasses.push(
                    'border-baerenstark-sand/50 bg-white/40 text-baerenstark-bark/30 cursor-not-allowed',
                  );
                } else if (isSelected) {
                  baseClasses.push('bg-leaf text-white border-leaf shadow-card');
                } else if (available) {
                  baseClasses.push(
                    'bg-leaf/20 text-leaf border-leaf hover:bg-leaf/30 cursor-pointer',
                  );
                } else if (blocked) {
                  baseClasses.push(
                    'bg-red-100 text-red-400 border-red-200 cursor-not-allowed',
                  );
                }
                if (today) {
                  baseClasses.push('ring-2 ring-baerenstark-wood ring-offset-1');
                }

                const ariaLabel =
                  past
                    ? `${cell.date} (vergangen, nicht buchbar)`
                    : available
                      ? `${cell.date} verfügbar — Termine anzeigen`
                      : `${cell.date} nicht verfügbar`;

                return (
                  <button
                    key={cell.date}
                    type="button"
                    role="gridcell"
                    disabled={isLoading || past}
                    aria-disabled={blocked || past || undefined}
                    aria-pressed={isSelected || undefined}
                    aria-label={ariaLabel}
                    onClick={() => handleDayClick(cell.date!, cell.day)}
                    onKeyDown={(e) => handleKeyDown(e, cell.date!, cell.day)}
                    className={baseClasses.join(' ')}
                  >
                    <span>{dayNumber}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ARIA-Live-Region für blockierte Klicks (US-16 AC3) */}
          <div
            ref={liveRegionRef}
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            {blockedToast ? `Tag ${blockedToast} ist nicht verfügbar.` : ''}
          </div>

          {blockedToast && (
            <div className="mt-3">
              <Banner tone="warning" role="status">
                Dieser Tag ist nicht verfügbar. Bitte wähle einen grün
                markierten Tag aus.
              </Banner>
            </div>
          )}

          {/* Empty-State: alle Tage rot — Anruf empfehlen */}
          {status === 'ready' && allBlocked && (
            <div className="mt-4">
              <Banner tone="info" title="Aktuell keine freien Termine in diesem Monat">
                <p className="mb-3">
                  In diesem Monat ist kein Tag freigeschaltet. Schau im
                  Folgemonat nach — oder ruf uns direkt an:
                </p>
                <a
                  href={`tel:${CONTACT.phoneTel}`}
                  className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark"
                >
                  {CONTACT.phoneDisplay} anrufen
                </a>
              </Banner>
            </div>
          )}

          <Legend />
        </>
      )}
    </div>
  );
}

function Legend() {
  return (
    <ul
      role="list"
      aria-label="Legende"
      className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-baerenstark-bark/70"
    >
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 rounded border border-leaf bg-leaf/20"
        />
        verfügbar
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 rounded border border-red-200 bg-red-100"
        />
        nicht verfügbar
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 rounded border ring-2 ring-baerenstark-wood ring-offset-1"
        />
        heute
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 rounded border border-leaf bg-leaf"
        />
        ausgewählt
      </li>
    </ul>
  );
}
