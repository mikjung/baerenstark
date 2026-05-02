'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AdminSlotManager } from './AdminSlotManager';
import { BookingTable } from './BookingTable';

type Tab = 'bookings' | 'slots';

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('bookings');

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
            Admin-Bereich
          </h1>
          <p className="mt-1 text-sm text-baerenstark-bark/70">
            Verwalte Zeitfenster und eingegangene Buchungsanfragen.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/' })}
          aria-label="Abmelden"
        >
          Abmelden
        </Button>
      </header>

      <div role="tablist" aria-label="Bereich" className="mb-6 inline-flex rounded-lg border border-baerenstark-sand bg-white/60 p-1">
        <TabButton active={tab === 'bookings'} onClick={() => setTab('bookings')}>
          Buchungsanfragen
        </TabButton>
        <TabButton active={tab === 'slots'} onClick={() => setTab('slots')}>
          Zeitfenster
        </TabButton>
      </div>

      <div role="tabpanel" aria-labelledby={tab}>
        {tab === 'bookings' && <BookingTable />}
        {tab === 'slots' && <AdminSlotManager />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'rounded-md px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2',
        active
          ? 'bg-baerenstark-wood text-baerenstark-cream'
          : 'text-baerenstark-bark hover:bg-baerenstark-sand/40',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
