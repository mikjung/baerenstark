'use client';

/**
 * BufferConfigForm — Iteration 5 (US-34).
 *
 * Standalone-Form für die globale Buffer-Einstellung. Lädt
 * `GET /api/admin/buffer-config` und speichert via
 * `PUT /api/admin/buffer-config`. Whitelist [0, 15, 30, 45, 60].
 */

import { useCallback, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  ApiClientError,
  fetchBufferConfig,
  updateBufferConfig,
} from '@/lib/api-client';
import {
  BUFFER_MINUTES_DEFAULT,
  BUFFER_MINUTES_OPTIONS,
} from '@/lib/schemas';

type Status = 'loading' | 'ready' | 'error';

const OPTION_LABELS: Record<number, string> = {
  0: 'Kein Buffer',
  15: '15 Minuten',
  30: '30 Minuten (empfohlen)',
  45: '45 Minuten',
  60: '1 Stunde',
};

export function BufferConfigForm() {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bufferMinutes, setBufferMinutes] = useState<number>(
    BUFFER_MINUTES_DEFAULT,
  );
  const [originalValue, setOriginalValue] = useState<number>(
    BUFFER_MINUTES_DEFAULT,
  );
  const [toast, setToast] = useState<
    { tone: 'success' | 'error'; message: string } | null
  >(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const cfg = await fetchBufferConfig();
      setBufferMinutes(cfg.bufferMinutes);
      setOriginalValue(cfg.bufferMinutes);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Buffer-Konfiguration konnte nicht geladen werden.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Toast nach 4 Sekunden ausblenden.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      const updated = await updateBufferConfig(bufferMinutes);
      setBufferMinutes(updated.bufferMinutes);
      setOriginalValue(updated.bufferMinutes);
      setToast({
        tone: 'success',
        message: 'Pufferzeit gespeichert.',
      });
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
      <div className="rounded-xl border border-baerenstark-sand bg-baerenstark-cream/30 p-4">
        <Skeleton className="mb-3 h-5 w-64" ariaLabel="Lade Buffer-Konfiguration" />
        <Skeleton className="h-9 w-48" ariaLabel="Lade Buffer-Auswahl" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Banner
        tone="error"
        title="Buffer-Konfiguration konnte nicht geladen werden"
        role="alert"
      >
        <p className="mb-3">{errorMessage ?? 'Bitte erneut versuchen.'}</p>
        <Button variant="secondary" size="sm" onClick={load}>
          Erneut versuchen
        </Button>
      </Banner>
    );
  }

  const dirty = bufferMinutes !== originalValue;

  return (
    <section
      aria-labelledby="buffer-heading"
      className="rounded-xl border border-baerenstark-sand bg-baerenstark-cream/30 p-4"
    >
      <h3
        id="buffer-heading"
        className="mb-2 font-medium text-baerenstark-bark"
      >
        <span aria-hidden="true">🚗 </span>Pufferzeit zwischen Aufträgen
      </h3>
      <p className="mb-3 text-sm text-baerenstark-bark/70">
        Reservierte Zeit nach jedem bestätigten Termin (z.B. für Anfahrt und
        Pausen). Wirkt sich nur auf bereits bestätigte Buchungen aus —
        unbestätigte Anfragen blockieren keinen Buffer.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="buffer-minutes-select"
          className="text-sm font-medium text-baerenstark-bark"
        >
          Pufferzeit:
        </label>
        <select
          id="buffer-minutes-select"
          value={bufferMinutes}
          onChange={(e) => setBufferMinutes(Number(e.target.value))}
          disabled={saving}
          className="rounded-lg border border-baerenstark-sand bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent disabled:opacity-50"
        >
          {BUFFER_MINUTES_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {OPTION_LABELS[minutes] ?? `${minutes} Minuten`}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          isLoading={saving}
          disabled={!dirty}
        >
          Speichern
        </Button>
      </div>

      {toast && (
        <div className="mt-3">
          <Banner
            tone={toast.tone === 'success' ? 'success' : 'error'}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            {toast.message}
          </Banner>
        </div>
      )}
    </section>
  );
}
