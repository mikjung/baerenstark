'use client';

/**
 * ServicePieChart — Anzahl abgeschlossener Buchungen pro Service
 * (US-IT6-09 AC4).
 */

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { getServiceLabel } from '@/lib/services';
import type { Service } from '@/lib/schemas';

interface DataPoint {
  service: Service;
  count: number;
}

interface Props {
  data: DataPoint[];
}

const COLORS = [
  '#5A3818',
  '#B08454',
  '#D6B084',
  '#A06A2C',
  '#E7DAC7',
  '#8A5A2B',
  '#3F2510',
];

export function ServicePieChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-baerenstark-sand bg-white p-6 text-sm text-baerenstark-bark/70">
        Noch keine abgeschlossenen Buchungen im Zeitraum.
      </div>
    );
  }
  const dataLabeled = data.map((d) => ({
    ...d,
    label: getServiceLabel(d.service),
  }));
  return (
    <div
      role="img"
      aria-label="Tortendiagramm: Buchungen pro Service"
      className="h-72 w-full rounded-lg border border-baerenstark-sand bg-white p-4"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={dataLabeled}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={40}
            label
          >
            {dataLabeled.map((_entry, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
