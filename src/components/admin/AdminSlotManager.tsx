'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, fetchSlots } from '@/lib/api-client';
import type { SlotPublic } from '@/lib/schemas';
import { SlotForm } from './SlotForm';
import { SlotTable } from './SlotTable';

/**
 * IT8 / US-IT8-03: Tom legte um 14:30 Uhr einen Slot für „heute 09:00–11:00"
 * an, sah ihn aber nicht in der Liste. Ursache: Backend filterte mit
 * `startsAt: { gte: now() }` — heutige Vormittag-Slots wurden ausgeblendet.
 *
 * Fix (QA-Empfehlung BUG-IT8-03-A: Variante B alleinstehend, ohne Backend-
 * Default zu ändern, damit die Public-View nicht regrediert): Der
 * Admin-Manager übergibt explizit `from = heute 00:00 Berlin` und
 * `to = heute + 180 Tage`. Das Backend bleibt für Public-Aufrufe wie zuvor.
 */
const ADMIN_SLOT_RANGE_DAYS = 180;

function adminSlotRangeBerlin(): { from: string; to: string } {
  // `startOfTodayBerlin` als ISO-Zeitstempel: wir nehmen Berlin-Mitternacht
  // (heute 00:00 lokale Zeit) und kodieren sie als ISO mit Offset. Der
  // einfachste robuste Weg ohne externe TZ-Library: aus der Berlin-
  // Datumskomponente ein lokales Date-Objekt bauen und `toISOString()`
  // benutzen — das Browser-API liefert UTC, was der Server als gültigen
  // Timestamp parst (`startsAt: { gte: from }` vergleicht in UTC).
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayBerlin = fmt.format(new Date()); // "YYYY-MM-DD"
  // Nimm 00:00 in Berlin-Zeit. Berlin ist UTC+1/+2 → wir nehmen Mitternacht
  // im *Browser* und ziehen einen Sicherheitspuffer von 12h ab, damit Slots
  // an der Tageskante (Sommer/Winterzeit) nicht versehentlich rausfallen.
  const safeFrom = new Date(`${todayBerlin}T00:00:00Z`);
  // Sicherheitspuffer: 14 Stunden zurück (deckt UTC+1/+2 sicher ab).
  safeFrom.setUTCHours(safeFrom.getUTCHours() - 14);
  const to = new Date(safeFrom);
  to.setUTCDate(to.getUTCDate() + ADMIN_SLOT_RANGE_DAYS);
  return { from: safeFrom.toISOString(), to: to.toISOString() };
}

export function AdminSlotManager() {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [slots, setSlots] = useState<SlotPublic[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const { from, to } = adminSlotRangeBerlin();
      const data = await fetchSlots({ from, to });
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
