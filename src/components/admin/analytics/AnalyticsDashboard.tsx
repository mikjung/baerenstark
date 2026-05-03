'use client';

/**
 * AnalyticsDashboard — `/admin/analytics` Client-Wrapper (US-IT6-09).
 *
 * Range-Filter (90d / 12m / ytd / custom). Lädt Daten über
 * `GET /api/admin/analytics?range=`, rendert KPI-Kacheln, Umsatz-Chart,
 * Service-Pie und Top-Kunden.
 *
 * Empty-State: wenn keine Buchung mit `final_price_eur` existiert →
 * Hinweis-Banner gemäß US-IT6-09 AC5.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Banner } from '@/components/ui/Banner';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ApiClientError } from '@/lib/api-client';
import { fetchAnalytics } from '@/lib/api-client-it6';
import type { AnalyticsRange, AnalyticsResponse } from '@/lib/schemas';
import { KpiTile } from './KpiTile';
import { RevenueChart } from './RevenueChart';
import { ServicePieChart } from './ServicePieChart';

const RANGE_OPTIONS: ReadonlyArray<{ value: AnalyticsRange; label: string }> = [
  { value: '90d', label: 'Letzte 90 Tage' },
  { value: '12m', label: 'Letzte 12 Monate' },
  { value: 'ytd', label: 'Aktuelles Jahr' },
];

type LoadStatus = 'loading' | 'ready' | 'error';

interface Props {
  /** Optionaler Server-prefetch (kein API-Roundtrip nötig). */
  initialData?: AnalyticsResponse;
}

function eur(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function parseDecimalString(s: string | null | undefined): number | null {
  if (s === null || s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function AnalyticsDashboard({ initialData }: Props) {
  const [range, setRange] = useState<AnalyticsRange>('12m');
  const [data, setData] = useState<AnalyticsResponse | null>(initialData ?? null);
  const [status, setStatus] = useState<LoadStatus>(initialData ? 'ready' : 'loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (r: AnalyticsRange) => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const res = await fetchAnalytics(r);
      setData(res);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiClientError && err.status === 404) {
        setErrorMessage(
          'Analytics-Endpoint ist noch nicht aktiv. Daten erscheinen, sobald das Backend deployed ist.',
        );
      } else {
        setErrorMessage(
          err instanceof ApiClientError
            ? err.message
            : 'Analytics konnten nicht geladen werden.',
        );
      }
    }
  }, []);

  useEffect(() => {
    if (initialData && range === '12m') return;
    void load(range);
  }, [range, load, initialData]);

  const totalRev = data ? parseDecimalString(data.kpis.totalRevenueEur) : null;
  const avg = data ? parseDecimalString(data.kpis.averageOrderValueEur) : null;
  const completed = data?.kpis.completedBookings ?? 0;
  const thisMonth = data?.kpis.bookingsThisMonth ?? 0;
  const isEmpty = data ? totalRev === null || totalRev === 0 : false;

  const monthData = (data?.revenueByMonth ?? []).map((r) => ({
    month: r.month,
    totalEur: parseDecimalString(r.totalEur) ?? 0,
    count: r.count,
  }));

  const serviceData = data?.bookingsByService ?? [];
  const topCustomers = data?.topCustomers ?? [];

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Zeitraum"
        className="inline-flex flex-wrap rounded-lg border border-baerenstark-sand bg-white/60 p-1"
      >
        {RANGE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={range === o.value}
            onClick={() => setRange(o.value)}
            className={[
              'rounded-md px-4 py-2 text-sm font-medium transition-colors min-h-[44px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2',
              range === o.value
                ? 'bg-baerenstark-wood text-baerenstark-cream'
                : 'text-baerenstark-bark hover:bg-baerenstark-sand/40',
            ].join(' ')}
          >
            {o.label}
          </button>
        ))}
      </div>

      {errorMessage && (
        <Banner tone="error" role="alert" title="Fehler">
          {errorMessage}
        </Banner>
      )}

      {isEmpty && status === 'ready' && (
        <Banner tone="info" role="status" title="Noch keine Umsatzdaten">
          Hinterlege bei abgeschlossenen Buchungen einen finalen Preis (€) —
          dann erscheinen hier die Auswertungen.
        </Banner>
      )}

      <section aria-labelledby="kpis-heading">
        <h2 id="kpis-heading" className="sr-only">
          Kennzahlen
        </h2>
        {status === 'loading' ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile
              label="Gesamtumsatz"
              value={totalRev === null ? '—' : eur(totalRev)}
              hint="Summe aller Endpreise"
            />
            <KpiTile
              label="Abgeschlossene Buchungen"
              value={completed}
              hint="Status: Abgeschlossen"
            />
            <KpiTile
              label="Ø Auftragswert"
              value={avg === null ? '—' : eur(avg)}
            />
            <KpiTile
              label="Buchungen diesen Monat"
              value={thisMonth}
              href="/admin?filter=this-month"
            />
          </div>
        )}
      </section>

      <section aria-labelledby="revenue-heading" className="space-y-3">
        <h2 id="revenue-heading" className="font-serif text-xl font-bold text-baerenstark-bark">
          Umsatz pro Monat
        </h2>
        {status === 'loading' ? <SkeletonCard /> : <RevenueChart data={monthData} />}
      </section>

      <section aria-labelledby="services-heading" className="space-y-3">
        <h2 id="services-heading" className="font-serif text-xl font-bold text-baerenstark-bark">
          Buchungen pro Service
        </h2>
        {status === 'loading' ? <SkeletonCard /> : <ServicePieChart data={serviceData} />}
      </section>

      <section aria-labelledby="top-customers-heading" className="space-y-3">
        <h2
          id="top-customers-heading"
          className="font-serif text-xl font-bold text-baerenstark-bark"
        >
          Top-Kunden
        </h2>
        {status === 'loading' ? (
          <SkeletonCard />
        ) : topCustomers.length === 0 ? (
          <p className="rounded-lg border border-baerenstark-sand bg-white p-4 text-sm text-baerenstark-bark/70">
            Noch keine Daten.
          </p>
        ) : (
          <ol className="rounded-lg border border-baerenstark-sand bg-white">
            {topCustomers.map((c, idx) => (
              <li
                key={c.customerId}
                className="flex items-center justify-between border-b border-baerenstark-sand px-4 py-2.5 last:border-b-0"
              >
                <div>
                  <span className="text-baerenstark-bark/60">{idx + 1}.</span>{' '}
                  <Link
                    href={`/admin/users?focus=${encodeURIComponent(c.customerId)}`}
                    className="font-medium text-baerenstark-bark hover:underline"
                  >
                    {c.customerName}
                  </Link>
                  <span className="ml-2 text-xs text-baerenstark-bark/60">
                    ({c.bookingCount} Buchungen)
                  </span>
                </div>
                <span className="font-mono">
                  {eur(parseDecimalString(c.totalEur))}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
