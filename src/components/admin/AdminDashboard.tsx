'use client';

import { useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AdminSlotManager } from './AdminSlotManager';
import { BookingTable } from './BookingTable';
import { UpcomingBookingsList } from './UpcomingBookingsList';
import { WeeklyAvailabilityForm } from './WeeklyAvailabilityForm';
import { ApiClientError, fetchAdminReviews } from '@/lib/api-client';

type Tab = 'bookings' | 'slots' | 'availability';

function parseTab(value: string | null): Tab {
  return value === 'slots' || value === 'availability' || value === 'bookings'
    ? value
    : 'bookings';
}

export function AdminDashboard() {
  // IT12-S14: Tab kann via `?tab=…`-Query gesetzt werden (Sidebar-Links).
  const searchParams = useSearchParams();
  const initialTab = parseTab(searchParams?.get('tab') ?? null);
  const [tab, setTab] = useState<Tab>(initialTab);

  // Reagiere auf Query-Änderung (z. B. wenn Sidebar-Link erneut geklickt wird).
  useEffect(() => {
    const next = parseTab(searchParams?.get('tab') ?? null);
    setTab(next);
  }, [searchParams]);
  // IT12-S14: Pending-Review-Count nicht mehr im Dashboard verwendet
  // (Tab entfernt — siehe Sidebar). Wir lassen den Fetch dennoch, falls
  // Tom später ein Notification-Pattern wünscht.
  const [, setPendingReviewCount] = useState<number | null>(null);

  // Lazy-Load Pending-Review-Count (Reserve für künftige Notification-UX).
  useEffect(() => {
    let cancelled = false;
    fetchAdminReviews()
      .then((reviews) => {
        if (cancelled) return;
        setPendingReviewCount(reviews.filter((r) => !r.approved).length);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 404) {
          setPendingReviewCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
            Admin-Bereich
          </h1>
          <p className="mt-1 text-sm text-baerenstark-bark/70">
            Verwalte Zeitfenster, Verfügbarkeit, Buchungsanfragen und Bewertungen.
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

      {/* IT12-S14: QuickLinks-Block entfernt — Navigation läuft jetzt
          ausschließlich über die Sidebar (`AdminSidebar` mit 3 Gruppen).
          „Bewertungen" darf in der Admin-Page DOM nur einmal vorkommen. */}

      <UpcomingBookingsList />

      <div
        role="tablist"
        aria-label="Bereich"
        className="mb-6 inline-flex flex-wrap rounded-lg border border-baerenstark-sand bg-white/60 p-1"
      >
        <TabButton active={tab === 'bookings'} onClick={() => setTab('bookings')}>
          Buchungsanfragen
        </TabButton>
        <TabButton active={tab === 'slots'} onClick={() => setTab('slots')}>
          Zeitfenster
        </TabButton>
        <TabButton active={tab === 'availability'} onClick={() => setTab('availability')}>
          Verfügbarkeit
        </TabButton>
        {/* IT12-S14: Bewertungen-Tab entfernt — Duplikat zur Sidebar
            "Auswertungen → Bewertungen" (acceptance-relevant). */}
      </div>

      <div role="tabpanel" aria-labelledby={tab}>
        {tab === 'bookings' && <BookingTable />}
        {tab === 'slots' && <AdminSlotManager />}
        {tab === 'availability' && <WeeklyAvailabilityForm />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number | null;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2',
        active
          ? 'bg-baerenstark-wood text-baerenstark-cream'
          : 'text-baerenstark-bark hover:bg-baerenstark-sand/40',
      ].join(' ')}
    >
      {children}
      {badge && badge > 0 && (
        <span
          aria-label={`${badge} ausstehend`}
          className={[
            'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-semibold',
            active ? 'bg-white/30 text-white' : 'bg-red-600 text-white',
          ].join(' ')}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
