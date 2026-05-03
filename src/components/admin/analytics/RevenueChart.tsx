'use client';

/**
 * RevenueChart — 12-Monats-Umsatz als Balkendiagramm (US-IT6-09 AC3).
 *
 * recharts in Client-Komponenten-Insel — siehe ARCHITECTURE_IT6.md §11.3.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface DataPoint {
  month: string; // "YYYY-MM"
  totalEur: number;
  count: number;
}

interface Props {
  data: DataPoint[];
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];

function formatMonthLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const idx = Number(m[2]) - 1;
  return `${MONTH_LABELS[idx] ?? m[2]} ${m[1]?.slice(2) ?? ''}`;
}

function eur(n: number): string {
  return n.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
}

export function RevenueChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-baerenstark-sand bg-white p-6 text-sm text-baerenstark-bark/70">
        Noch keine Umsatzdaten im gewählten Zeitraum.
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label="Balkendiagramm: Umsatz pro Monat"
      className="h-72 w-full rounded-lg border border-baerenstark-sand bg-white p-4"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7DAC7" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthLabel}
            stroke="#5A3818"
            fontSize={11}
          />
          <YAxis
            stroke="#5A3818"
            fontSize={11}
            tickFormatter={(v: number) => eur(v)}
            width={70}
          />
          <Tooltip
            formatter={(v) => eur(typeof v === 'number' ? v : Number(v))}
            labelFormatter={(label) =>
              typeof label === 'string' ? formatMonthLabel(label) : String(label ?? '')
            }
            contentStyle={{
              backgroundColor: '#ffffff',
              borderColor: '#B08454',
              fontSize: '0.875rem',
            }}
          />
          <Bar dataKey="totalEur" fill="#B08454" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
