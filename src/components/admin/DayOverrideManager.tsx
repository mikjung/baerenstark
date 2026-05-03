'use client';

/**
 * US-17 — Day-Override-Verwaltung im Admin-Bereich.
 *
 * IT8 / US-IT8-04: Umbau von monatsgefilterter Liste auf **Gesamtliste**.
 * Tom hatte Overrides angelegt, sah sie aber nirgendwo, weil die Liste
 * nur den im Picker ausgewählten Monat zeigte. Jetzt:
 *   - Liste aller Einträge (`?scope=all`), sortiert nach Datum aufsteigend.
 *   - Vergangene Einträge bleiben sichtbar, aber **ausgegraut** (Badge
 *     „vergangen", `opacity-60`).
 *   - Empty-State: „Keine Überschreibungen eingetragen." (AC2 wörtlich).
 *   - Lösch-Button mit Bestätigung pro Eintrag.
 *   - Optimistic-Update beim Anlegen/Löschen vermeidet Skeleton-Flackern
 *     (QA-Minor BUG-IT8-04-A); `load()` läuft danach trotzdem als Backup.
 *   - Truncated-Hinweis, falls Backend mehr als 365 Einträge findet
 *     (QA-Minor BUG-IT8-04-B).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ApiClientError,
  createDayOverride,
  deleteDayOverride,
  fetchAllDayOverrides,
} from '@/lib/api-client';
import type { DayOverride } from '@/lib/schemas';

type Status = 'loading' | 'ready' | 'error';

function todayInBerlin(): { iso: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return { iso: fmt.format(new Date()) };
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

function monthLabelFromIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-/.exec(iso);
  if (!m) return iso;
  const month = Number(m[2]);
  return `${MONTH_LABELS[month - 1] ?? m[2]} ${m[1]}`;
}

function isPast(iso: string, todayIso: string): boolean {
  // Lexikografischer Vergleich für YYYY-MM-DD ist exakt der Datumsvergleich.
  return iso < todayIso;
}

function sortByDateAsc(list: DayOverride[]): DayOverride[] {
  return [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

interface MonthGroup {
  label: string;
  items: DayOverride[];
}

function groupByMonth(list: DayOverride[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  let currentKey = '';
  for (const o of list) {
    const key = o.date.slice(0, 7); // YYYY-MM
    if (key !== currentKey) {
      groups.push({ label: monthLabelFromIso(o.date), items: [] });
      currentKey = key;
    }
    groups[groups.length - 1]!.items.push(o);
  }
  return groups;
}

export function DayOverrideManager() {
  const today = todayInBerlin();
  const [overrides, setOverrides] = useState<DayOverride[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [pickerDate, setPickerDate] = useState<string>('');
  const [pickerReason, setPickerReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<
    { tone: 'success' | 'error' | 'warning'; message: string } | null
  >(null);

  // De-Dup für initialen Doppel-Mount im React-Strict-Mode + Abort bei Unmount.
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const load = useCallback(async (silent = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (!silent) setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchAllDayOverrides(ctrl.signal);
      if (ctrl.signal.aborted || !mountedRef.current) return;
      setOverrides(sortByDateAsc(data.overrides));
      setTruncated(Boolean(data.truncated));
      setStatus('ready');
    } catch (err) {
      if (ctrl.signal.aborted || !mountedRef.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Übersicht konnte nicht geladen werden.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

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
      // Optimistic-Update: neuen Eintrag direkt in die Liste packen
      // (deduplizieren via `date`, weil POST ein Upsert ist).
      setOverrides((prev) => {
        const without = prev.filter((o) => o.date !== result.override.date);
        return sortByDateAsc([...without, result.override]);
      });
      if (result.warning) {
        setToast({ tone: 'warning', message: result.warning.message });
      } else {
        setToast({
          tone: 'success',
          message: `Tag ${formatDate(pickerDate)} wurde gesperrt.`,
        });
      }
      setPickerDate('');
      setPickerReason('');
      // Backup-Reload (silent → kein Skeleton-Flackern), um eventuelle
      // Server-seitige Korrekturen / Truncation-Flag zu spiegeln.
      void load(true);
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
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Override für ${formatDate(date)} wirklich entfernen?`)
    ) {
      return;
    }
    // Optimistic-Update: Eintrag sofort entfernen, bei Fehler zurückrollen.
    const snapshot = overrides;
    setOverrides((prev) => prev.filter((o) => o.id !== id));
    try {
      await deleteDayOverride(id);
      setToast({
        tone: 'success',
        message: `Override für ${formatDate(date)} entfernt.`,
      });
    } catch (err) {
      // Rollback.
      setOverrides(snapshot);
      setToast({
        tone: 'error',
        message:
          err instanceof ApiClientError
            ? err.message
            : 'Override konnte nicht entfernt werden.',
      });
    }
  }

  const grouped = useMemo(() => groupByMonth(overrides), [overrides]);

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
          tone={
            toast.tone === 'success'
              ? 'success'
              : toast.tone === 'warning'
                ? 'warning'
                : 'error'
          }
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

      {/* Gesamtliste */}
      <div className="rounded-xl border border-baerenstark-sand bg-white/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="font-medium text-baerenstark-bark">
            Alle Überschreibungen
          </h4>
          {status === 'ready' && overrides.length > 0 && (
            <span className="text-xs text-baerenstark-bark/60">
              {overrides.length} Eintr{overrides.length === 1 ? 'ag' : 'äge'}
            </span>
          )}
        </div>

        {truncated && (
          <div className="mb-3">
            <Banner tone="warning" role="status">
              Es sind mehr als 365 Einträge vorhanden — angezeigt werden nur die
              ältesten 365. Bitte alte Einträge löschen.
            </Banner>
          </div>
        )}

        {status === 'loading' && (
          <div className="space-y-2" data-testid="overrides-loading">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" ariaLabel="Lade Override" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <Banner tone="error" title="Fehler beim Laden" role="alert">
            <p className="mb-3">{errorMessage ?? 'Bitte erneut versuchen.'}</p>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Erneut versuchen
            </Button>
          </Banner>
        )}

        {status === 'ready' && overrides.length === 0 && (
          <p className="text-sm text-baerenstark-bark/70">
            Keine Überschreibungen eingetragen.
          </p>
        )}

        {status === 'ready' && overrides.length > 0 && (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.label}>
                <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-baerenstark-bark/60">
                  {group.label}
                </h5>
                <ul role="list" className="divide-y divide-baerenstark-sand/50">
                  {group.items.map((o) => {
                    const past = isPast(o.date, today.iso);
                    return (
                      <li
                        key={o.id}
                        className={[
                          'flex flex-wrap items-center justify-between gap-3 py-2 text-sm',
                          past ? 'opacity-60' : '',
                        ].join(' ')}
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
                          {past && (
                            <span
                              className="rounded-full border border-baerenstark-sand bg-baerenstark-cream/60 px-2 py-0.5 text-xs font-medium text-baerenstark-bark/70"
                              aria-label="vergangen"
                            >
                              vergangen
                            </span>
                          )}
                          {o.reason && (
                            <span className="text-baerenstark-bark/70">
                              — {o.reason}
                            </span>
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
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
