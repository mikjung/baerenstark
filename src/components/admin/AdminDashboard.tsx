'use client';

import { signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AdminSlotManager } from './AdminSlotManager';
import { BookingTable } from './BookingTable';
import { ReviewModerationTable } from './ReviewModerationTable';
import { UpcomingBookingsList } from './UpcomingBookingsList';
import { WeeklyAvailabilityForm } from './WeeklyAvailabilityForm';
import { ApiClientError, fetchAdminReviews } from '@/lib/api-client';

type Tab = 'bookings' | 'slots' | 'availability' | 'reviews';

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('bookings');
  const [pendingReviewCount, setPendingReviewCount] = useState<number | null>(null);

  // Lazy-Load Pending-Review-Count fürs Tab-Badge.
  useEffect(() => {
    let cancelled = false;
    fetchAdminReviews()
      .then((reviews) => {
        if (cancelled) return;
        setPendingReviewCount(reviews.filter((r) => !r.approved).length);
      })
      .catch((err) => {
        if (cancelled) return;
        // Wenn der Endpoint noch nicht existiert (Backend noch nicht deployed),
        // ignorieren wir den Fehler still.
        if (err instanceof ApiClientError && err.status === 404) {
          setPendingReviewCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
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
        <TabButton
          active={tab === 'reviews'}
          onClick={() => setTab('reviews')}
          badge={pendingReviewCount && pendingReviewCount > 0 ? pendingReviewCount : null}
        >
          Bewertungen
        </TabButton>
      </div>

      <div role="tabpanel" aria-labelledby={tab}>
        {tab === 'bookings' && <BookingTable />}
        {tab === 'slots' && <AdminSlotManager />}
        {tab === 'availability' && <WeeklyAvailabilityForm />}
        {tab === 'reviews' && <ReviewModerationTable />}
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
