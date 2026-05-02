'use client';

/**
 * CustomerDashboard — Kundenportal-Hauptansicht (US-26 / US-27 / US-29).
 *
 * Lädt Buchungen via `GET /api/customer/bookings` (Client-Side, damit
 * Storno-/Review-Aktionen ohne Reload möglich sind).
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { CustomerBookingCard } from '@/components/customer/CustomerBookingCard';
import {
  ApiClientError,
  fetchCustomerBookings,
  logoutCustomer,
} from '@/lib/api-client';
import type {
  CustomerBooking,
  CustomerBookingsResponse,
  CustomerUserPublic,
} from '@/lib/schemas';

interface CustomerDashboardProps {
  customer: CustomerUserPublic;
  justVerified?: boolean;
}

type Status = 'loading' | 'ready' | 'error';

export function CustomerDashboard({ customer, justVerified }: CustomerDashboardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookings, setBookings] = useState<CustomerBookingsResponse>({
    upcoming: [],
    past: [],
  });
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchCustomerBookings();
      setBookings(data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Aufträge konnten nicht geladen werden.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onBookingChanged = useCallback((updated: CustomerBooking) => {
    setBookings((prev) => {
      const replaceIn = (list: CustomerBooking[]): CustomerBooking[] =>
        list.map((b) => (b.id === updated.id ? updated : b));
      return {
        upcoming: replaceIn(prev.upcoming),
        past: replaceIn(prev.past),
      };
    });
  }, []);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutCustomer();
    } catch {
      // ignore — Cookie ohnehin per Set-Cookie max-age=0 entfernt.
    } finally {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
            Hallo, {customer.firstName}!
          </h1>
          <p className="mt-1 text-sm text-baerenstark-bark/70">
            Hier findest du alle deine Aufträge bei Bärenstark Hausservice.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/konto/profil"
            className="rounded-lg border border-baerenstark-wood/40 px-4 py-2 text-sm font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40"
          >
            Profil
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            isLoading={loggingOut}
            aria-label="Abmelden"
          >
            Abmelden
          </Button>
        </div>
      </header>

      {justVerified && (
        <div className="mb-6">
          <Banner tone="success" role="status">
            Deine E-Mail-Adresse wurde bestätigt. Willkommen bei Bärenstark!
          </Banner>
        </div>
      )}

      {status === 'error' && (
        <Banner tone="error" title="Fehler beim Laden" role="alert">
          <p className="mb-3">{errorMessage ?? 'Bitte erneut versuchen.'}</p>
          <Button variant="secondary" size="sm" onClick={load}>
            Erneut versuchen
          </Button>
        </Banner>
      )}

      {status === 'loading' && <DashboardSkeleton />}

      {status === 'ready' && bookings.upcoming.length === 0 && bookings.past.length === 0 && (
        <EmptyState />
      )}

      {status === 'ready' && (bookings.upcoming.length > 0 || bookings.past.length > 0) && (
        <>
          <Section title="Bevorstehende Termine">
            {bookings.upcoming.length === 0 ? (
              <p className="text-sm text-baerenstark-bark/70">
                Du hast aktuell keine bevorstehenden Termine.
              </p>
            ) : (
              <ul role="list" className="grid grid-cols-1 gap-4">
                {bookings.upcoming.map((b) => (
                  <li key={b.id}>
                    <CustomerBookingCard
                      booking={b}
                      variant="upcoming"
                      onChange={onBookingChanged}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Vergangene Aufträge" className="mt-10">
            {bookings.past.length === 0 ? (
              <p className="text-sm text-baerenstark-bark/70">
                Noch keine vergangenen Aufträge.
              </p>
            ) : (
              <ul role="list" className="grid grid-cols-1 gap-4">
                {bookings.past.map((b) => (
                  <li key={b.id}>
                    <CustomerBookingCard
                      booking={b}
                      variant="past"
                      onChange={onBookingChanged}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className} aria-labelledby={`section-${title}`}>
      <h2
        id={`section-${title}`}
        className="mb-4 font-serif text-2xl font-semibold text-baerenstark-bark"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-4 h-7 w-56" ariaLabel="Lade Bevorstehende Termine" />
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32" ariaLabel="Lade Termin" />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="mb-4 h-7 w-56" ariaLabel="Lade Vergangene Aufträge" />
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 1 }).map((_, i) => (
            <Skeleton key={i} className="h-28" ariaLabel="Lade Termin" />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-baerenstark-sand bg-white/70 p-10 text-center shadow-soft">
      <p className="mb-2 text-2xl" aria-hidden="true">
        📋
      </p>
      <h2 className="mb-2 font-serif text-xl font-semibold text-baerenstark-bark">
        Du hast noch keine Buchungen
      </h2>
      <p className="mb-6 text-sm text-baerenstark-bark/80">
        Lass uns das ändern — Tom freut sich auf deine Anfrage.
      </p>
      <Link
        href="/buchung"
        className="inline-flex items-center gap-2 rounded-lg bg-baerenstark-wood px-6 py-3 text-sm font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark"
      >
        Jetzt Termin buchen →
      </Link>
    </div>
  );
}
