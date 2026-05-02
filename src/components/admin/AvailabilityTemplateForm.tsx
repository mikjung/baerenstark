'use client';

/**
 * US-17 — Verfügbarkeits-Vorlage (AvailabilityTemplate).
 *
 * Pro Wochentag konfigurierbar:
 *   - Toggle (aktiv / inaktiv)
 *   - Startzeit (HH:MM)
 *   - Endzeit (HH:MM)
 *   - Slot-Dauer (30 / 60 / 90 / 120 min)
 *
 * "Standard anwenden" setzt alle aktiven Tage auf 08:00–17:00, 60 min.
 * Speichern via PUT /api/admin/availability-template (Bulk-Update).
 */

import { useCallback, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ApiClientError,
  fetchAvailabilityTemplate,
  updateAvailabilityTemplate,
} from '@/lib/api-client';
import type { AvailabilityTemplateDay } from '@/lib/schemas';

const DAY_ORDER: ReadonlyArray<{ dayOfWeek: number; label: string; short: string }> = [
  { dayOfWeek: 1, label: 'Montag', short: 'Mo' },
  { dayOfWeek: 2, label: 'Dienstag', short: 'Di' },
  { dayOfWeek: 3, label: 'Mittwoch', short: 'Mi' },
  { dayOfWeek: 4, label: 'Donnerstag', short: 'Do' },
  { dayOfWeek: 5, label: 'Freitag', short: 'Fr' },
  { dayOfWeek: 6, label: 'Samstag', short: 'Sa' },
  { dayOfWeek: 0, label: 'Sonntag', short: 'So' },
];

const DURATION_OPTIONS = [30, 60, 90, 120] as const;

function emptyTemplate(): AvailabilityTemplateDay[] {
  return DAY_ORDER.map((d) => ({
    dayOfWeek: d.dayOfWeek,
    isActive: d.dayOfWeek >= 1 && d.dayOfWeek <= 5,
    startTime: '08:00',
    endTime: '17:00',
    slotDurationMinutes: 60,
  }));
}

export function AvailabilityTemplateForm() {
  const [days, setDays] = useState<AvailabilityTemplateDay[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<
    { tone: 'success' | 'error'; message: string } | null
  >(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchAvailabilityTemplate();
      // Sicherstellen, dass alle 7 Tage vorhanden sind.
      const merged = emptyTemplate().map(
        (defaultDay) =>
          data.find((d) => d.dayOfWeek === defaultDay.dayOfWeek) ?? defaultDay,
      );
      setDays(merged);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Vorlage konnte nicht geladen werden.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function updateDay(
    dayOfWeek: number,
    patch: Partial<AvailabilityTemplateDay>,
  ) {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)),
    );
  }

  function applyDefaults() {
    setDays((prev) =>
      prev.map((d) =>
        d.isActive
          ? { ...d, startTime: '08:00', endTime: '17:00', slotDurationMinutes: 60 }
          : d,
      ),
    );
    setToast({ tone: 'success', message: 'Standard auf aktive Tage angewendet (noch nicht gespeichert).' });
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      const updated = await updateAvailabilityTemplate(days);
      // Wieder mergen, damit alle 7 Tage in der UI bleiben.
      const merged = emptyTemplate().map(
        (defaultDay) =>
          updated.find((d) => d.dayOfWeek === defaultDay.dayOfWeek) ?? defaultDay,
      );
      setDays(merged);
      setToast({ tone: 'success', message: 'Verfügbarkeits-Vorlage gespeichert.' });
    } catch (err) {
      setToast({
        tone: 'error',
        message:
          err instanceof ApiClientError
            ? err.message
            : 'Speichern fehlgeschlagen — bitte erneut versuchen.',
      });
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-20" ariaLabel="Lade Wochentag" />
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Banner tone="error" title="Vorlage konnte nicht geladen werden" role="alert">
        <p className="mb-3">{errorMessage ?? 'Bitte erneut versuchen.'}</p>
        <Button variant="secondary" size="sm" onClick={load}>
          Erneut versuchen
        </Button>
      </Banner>
    );
  }

  return (
    <section aria-labelledby="template-heading" className="space-y-4">
      <div>
        <h3
          id="template-heading"
          className="font-serif text-lg font-semibold text-baerenstark-bark"
        >
          Standard-Wochenvorlage
        </h3>
        <p className="text-sm text-baerenstark-bark/70">
          Lege pro Wochentag fest, wann Tom Termine annimmt. Slots werden
          automatisch in der gewählten Dauer aus dem Zeitfenster generiert.
        </p>
      </div>

      {toast && (
        <Banner tone={toast.tone === 'success' ? 'success' : 'error'} role="status">
          {toast.message}
        </Banner>
      )}

      <ul role="list" className="space-y-3">
        {DAY_ORDER.map((entry) => {
          const day =
            days.find((d) => d.dayOfWeek === entry.dayOfWeek) ?? {
              dayOfWeek: entry.dayOfWeek,
              isActive: false,
              startTime: '08:00',
              endTime: '17:00',
              slotDurationMinutes: 60,
            };
          return (
            <li
              key={entry.dayOfWeek}
              className={[
                'rounded-xl border p-3 transition-colors sm:p-4',
                day.isActive
                  ? 'border-leaf/50 bg-leaf/5'
                  : 'border-baerenstark-sand bg-white/60',
              ].join(' ')}
            >
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-[120px] items-center gap-2 font-medium text-baerenstark-bark">
                  <input
                    type="checkbox"
                    className="h-5 w-5 cursor-pointer accent-baerenstark-wood"
                    checked={day.isActive}
                    onChange={(e) =>
                      updateDay(entry.dayOfWeek, { isActive: e.target.checked })
                    }
                    aria-label={`${entry.label} aktiv`}
                  />
                  <span>{entry.label}</span>
                </label>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="flex items-center gap-1 text-baerenstark-bark/80">
                    <span>Von</span>
                    <input
                      type="time"
                      value={day.startTime}
                      disabled={!day.isActive}
                      onChange={(e) =>
                        updateDay(entry.dayOfWeek, { startTime: e.target.value })
                      }
                      className="rounded-md border border-baerenstark-sand bg-white px-2 py-1 disabled:opacity-50"
                      aria-label={`${entry.label} Startzeit`}
                    />
                  </label>
                  <label className="flex items-center gap-1 text-baerenstark-bark/80">
                    <span>Bis</span>
                    <input
                      type="time"
                      value={day.endTime}
                      disabled={!day.isActive}
                      onChange={(e) =>
                        updateDay(entry.dayOfWeek, { endTime: e.target.value })
                      }
                      className="rounded-md border border-baerenstark-sand bg-white px-2 py-1 disabled:opacity-50"
                      aria-label={`${entry.label} Endzeit`}
                    />
                  </label>
                  <label className="flex items-center gap-1 text-baerenstark-bark/80">
                    <span>Dauer</span>
                    <select
                      value={day.slotDurationMinutes}
                      disabled={!day.isActive}
                      onChange={(e) =>
                        updateDay(entry.dayOfWeek, {
                          slotDurationMinutes: Number(e.target.value),
                        })
                      }
                      className="rounded-md border border-baerenstark-sand bg-white px-2 py-1 disabled:opacity-50"
                      aria-label={`${entry.label} Slot-Dauer`}
                    >
                      {DURATION_OPTIONS.map((d) => (
                        <option key={d} value={d}>
                          {d} min
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="ghost" type="button" onClick={applyDefaults} disabled={saving}>
          Standard anwenden (08:00–17:00, 60 min)
        </Button>
        <Button type="button" onClick={handleSave} isLoading={saving}>
          Speichern
        </Button>
      </div>
    </section>
  );
}
