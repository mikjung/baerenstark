'use client';

/**
 * US-17 — Day-Override-Verwaltung im Admin-Bereich.
 *
 * Lädt für einen Monat alle DayOverrides (`GET /api/admin/day-overrides?month=YYYY-MM`)
 * und erlaubt:
 *   - Tag-Picker + "Tag sperren"-Button (POST mit isActive=false)
 *   - Liste bestehender Overrides mit Lösch-Button (DELETE)
 *
 * Komplexere Override-Modi (eigene Zeiten / Reaktivierung) sind absichtlich
 * minimal gehalten — Tom braucht primär die Sperr-Funktion.
 */

import { useCallback, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ApiClientError,
  createDayOverride,
  deleteDayOverride,
  fetchDayOverrides,
} from '@/lib/api-client';
import type { DayOverride } from '@/lib/schemas';

type Status = 'loading' | 'ready' | 'error';

function todayInBerlin(): { iso: string; year: number; month: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const iso = fmt.format(new Date());
  const [y, m] = iso.split('-').map(Number);
  return { iso, year: y, month: m };
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

const MONTH_LABELS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function DayOverrideManager() {
  const today = todayInBerlin();
  const [year, setYear] = useState<number>(today.year);
  const [month, setMonth] = useState<number>(today.month);
  const [overrides, setOverrides] = useState<DayOverride[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [pickerDate, setPickerDate] = useState<string>('');
  const [pickerReason, setPickerReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<
    { tone: 'success' | 'error' | 'warning'; message: string } | null
  >(null);

  const monthString = monthKey(year, month);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchDayOverrides(monthString);
      setOverrides(data.overrides);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Übersicht konnte nicht geladen werden.',
      );
    }
  }, [monthString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  function goPrev() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goNext() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  async function handleBlockDay() {
    if (!pickerDate) {
      setToast({ tone: 'error', message: 'Bitte ein Datum auswählen.' });
      return;
    }
    setSubmitting(true);
    setToast(null);
    try {
      const result = await createDayOverride({
        date: pickerDate,
        isActive: false,
        startTime: null,
        endTime: null,
        reason: pickerReason.trim() ? pickerReason.trim() : null,
      });
      if (result.warning) {
        setToast({
          tone: 'warning',
          message: result.warning.message,
        });
      } else {
        setToast({ tone: 'success', message: `Tag ${formatDate(pickerDate)} wurde gesperrt.` });
      }
      setPickerDate('');
      setPickerReason('');
      void load();
    } catch (err) {
      setToast({
        tone: 'error',
        message:
          err instanceof ApiClientError
            ? err.message
            : 'Tag konnte nicht gesperrt werden.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, date: string) {
    if (!window.confirm(`Override für ${formatDate(date)} wirklich entfernen?`)) {
      return;
    }
    try {
      await deleteDayOverride(id);
      setToast({ tone: 'success', message: `Override für ${formatDate(date)} entfernt.` });
      void load();
    } catch (err) {
      setToast({
        tone: 'error',
        message:
          err instanceof ApiClientError
            ? err.message
            : 'Override konnte nicht entfernt werden.',
      });
    }
  }

  return (
    <section aria-labelledby="overrides-heading" className="space-y-4">
      <div>
        <h3
          id="overrides-heading"
          className="font-serif text-lg font-semibold text-baerenstark-bark"
        >
          Tages-Überschreibungen
        </h3>
        <p className="text-sm text-baerenstark-bark/70">
          Sperre einzelne Tage (z.B. Urlaub, Krankheit). Bestehende Buchungen
          bleiben erhalten — sperre Tage ggf. zusätzlich manuell oder leg sie um.
        </p>
      </div>

      {toast && (
        <Banner
          tone={toast.tone === 'success' ? 'success' : toast.tone === 'warning' ? 'warning' : 'error'}
          role="status"
        >
          {toast.message}
        </Banner>
      )}

      {/* Tag sperren */}
      <div className="rounded-xl border border-baerenstark-sand bg-white/70 p-4">
        <h4 className="mb-3 font-medium text-baerenstark-bark">Tag sperren</h4>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-baerenstark-bark/80">Datum</span>
            <input
              type="date"
              value={pickerDate}
              min={today.iso}
              onChange={(e) => setPickerDate(e.target.value)}
              className="rounded-md border border-baerenstark-sand bg-white px-3 py-2"
              aria-label="Datum für Tagessperre"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-baerenstark-bark/80">Grund (optional)</span>
            <input
              type="text"
              value={pickerReason}
              onChange={(e) => setPickerReason(e.target.value)}
              maxLength={200}
              placeholder="z.B. Urlaub"
              className="rounded-md border border-baerenstark-sand bg-white px-3 py-2"
              aria-label="Grund für Tagessperre"
            />
          </label>
          <Button
            type="button"
            onClick={handleBlockDay}
            isLoading={submitting}
            disabled={!pickerDate}
          >
            Tag sperren
          </Button>
        </div>
      </div>

      {/* Monat-Navigation + Liste */}
      <div className="rounded-xl border border-baerenstark-sand bg-white/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={goPrev} aria-label="Vorheriger Monat">
            ‹ Zurück
          </Button>
          <h4 className="font-medium text-baerenstark-bark">
            {MONTH_LABELS[month - 1]} {year}
          </h4>
          <Button variant="ghost" size="sm" onClick={goNext} aria-label="Nächster Monat">
            Weiter ›
          </Button>
        </div>

        {status === 'loading' && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" ariaLabel="Lade Override" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <Banner tone="error" title="Fehler beim Laden" role="alert">
            <p className="mb-3">{errorMessage ?? 'Bitte erneut versuchen.'}</p>
            <Button variant="secondary" size="sm" onClick={load}>
              Erneut versuchen
            </Button>
          </Banner>
        )}

        {status === 'ready' && overrides.length === 0 && (
          <p className="text-sm text-baerenstark-bark/70">
            Keine Überschreibungen für diesen Monat.
          </p>
        )}

        {status === 'ready' && overrides.length > 0 && (
          <ul role="list" className="divide-y divide-baerenstark-sand/50">
            {overrides.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium text-baerenstark-bark">
                    {formatDate(o.date)}
                  </span>
                  <span
                    className={[
                      'rounded-full border px-2 py-0.5 text-xs font-medium',
                      o.isActive
                        ? 'border-leaf/50 bg-leaf/10 text-baerenstark-bark'
                        : 'border-red-200 bg-red-50 text-red-900',
                    ].join(' ')}
                  >
                    {o.isActive ? 'aktiv (eigene Zeiten)' : 'gesperrt'}
                  </span>
                  {o.reason && (
                    <span className="text-baerenstark-bark/70">— {o.reason}</span>
                  )}
                  {o.isActive && o.startTime && o.endTime && (
                    <span className="text-baerenstark-bark/70">
                      {o.startTime}–{o.endTime}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(o.id, o.date)}
                  aria-label={`Override für ${formatDate(o.date)} löschen`}
                >
                  Löschen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
