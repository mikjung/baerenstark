/**
 * KpiTile — KPI-Kachel für `/admin/analytics` (US-IT6-09 AC1).
 *
 * Server-Component. Optional klickbar (z.B. „Buchungen diesen Monat" →
 * gefilterte Liste).
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  href?: string;
  hint?: string;
}

export function KpiTile({ label, value, href, hint }: Props) {
  const inner = (
    <>
      <span className="block text-xs uppercase tracking-wide text-baerenstark-bark/60">
        {label}
      </span>
      <span className="mt-1 block font-serif text-3xl font-bold text-baerenstark-bark">
        {value}
      </span>
      {hint && (
        <span className="mt-1 block text-xs text-baerenstark-bark/60">{hint}</span>
      )}
    </>
  );

  const baseClass =
    'block rounded-lg border border-baerenstark-sand bg-white p-4 shadow-sm';

  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClass} hover:border-baerenstark-wood transition-colors`}
        aria-label={`${label} öffnen`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={baseClass}>{inner}</div>;
}
