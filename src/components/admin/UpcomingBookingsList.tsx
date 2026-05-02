'use client';

/**
 * US-21 — Bevorstehende Termine im Admin-Dashboard.
 *
 * Lädt `GET /api/admin/upcoming-bookings?limit=10` und zeigt die nächsten
 * bestätigten Termine mit Heute-Markierung.
 */

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiClientError, fetchUpcomingBookings } from '@/lib/api-client';
import type { UpcomingBooking } from '@/lib/schemas';
import { getServiceLabel } from '@/lib/services';

type Status = 'loading' | 'ready' | 'error';

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12, 0, 0));
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(dt);
}

export function UpcomingBookingsList() {
  const [status, setStatus] = useState<Status>('loading');
  const [items, setItems] = useState<UpcomingBooking[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchUpcomingBookings(10);
      setItems(data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Bevorstehende Termine konnten nicht geladen werden.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      aria-labelledby="upcoming-heading"
      className="mb-8 rounded-2xl border border-baerenstark-sand bg-white/70 p-5 shadow-soft sm:p-6"
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="upcoming-heading"
          className="flex items-center gap-2 font-serif text-xl font-semibold text-baerenstark-bark sm:text-2xl"
        >
          <span aria-hidden="true">📅</span> Bevorstehende Termine
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          aria-label="Termine neu laden"
        >
          ↻ Aktualisieren
        </Button>
      </header>

      {status === 'loading' && (
        <ul role="list" className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-14" ariaLabel="Lade Termin" />
            </li>
          ))}
        </ul>
      )}

      {status === 'error' && (
        <Banner tone="error" title="Fehler beim Laden" role="alert">
          <p className="mb-3">{errorMessage ?? 'Bitte erneut versuchen.'}</p>
          <Button variant="secondary" size="sm" onClick={load}>
            Erneut versuchen
          </Button>
        </Banner>
      )}

      {status === 'ready' && items.length === 0 && (
        <Banner tone="info">
          <p>Keine bevorstehenden Termine.</p>
        </Banner>
      )}

      {status === 'ready' && items.length > 0 && (
        <ul role="list" className="divide-y divide-baerenstark-sand/50">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                {item.isToday && (
                  <Badge tone="warning" title="Heute">
                    Heute
                  </Badge>
                )}
                <span className="font-medium text-baerenstark-bark">
                  {formatDate(item.date)}
                </span>
                <span className="text-baerenstark-bark/80">
                  {item.startTime}–{item.endTime}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-2 text-sm text-baerenstark-bark/80">
                <span className="font-medium text-baerenstark-bark">
                  {item.customerName}
                </span>
                <span className="text-baerenstark-bark/50">·</span>
                <span>{getServiceLabel(item.service)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
