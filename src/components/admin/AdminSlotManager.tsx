'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, fetchSlots } from '@/lib/api-client';
import type { SlotPublic } from '@/lib/schemas';
import { SlotForm } from './SlotForm';
import { SlotTable } from './SlotTable';

export function AdminSlotManager() {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [slots, setSlots] = useState<SlotPublic[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchSlots();
      setSlots(data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError ? err.message : 'Unbekannter Fehler',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <SlotForm onCreated={load} />
      <div>
        <h3 className="mb-4 font-serif text-lg font-semibold text-baerenstark-bark">
          Bestehende Zeitfenster
        </h3>
        <SlotTable
          status={status}
          slots={slots}
          errorMessage={errorMessage}
          onChanged={load}
          onRetry={load}
        />
      </div>
    </div>
  );
}
