'use client';

/**
 * CustomerDashboard — Kundenportal-Hauptansicht (US-26 / US-IT10-05).
 *
 * IT10:
 *   - Status-Badge wechselt auf neue `BookingStatusBadge` (6 Varianten).
 *   - Microcopy aus `ux-spec-iteration-10.md` §6.11.
 *   - Pagination für "past"-Liste (mobile = Mehr laden, desktop = Vor/Zurück)
 *     via `PaginationControls`.
 *   - Empty-State + Error-State auf neue `EmptyState`/`ErrorState`-Komponenten.
 *   - Footer-Hinweis: Sichtbarkeit von Vor-Account-Buchungen (ARCHITECTURE_IT10 §9.5).
 *
 * Lädt Buchungen via `GET /api/customer/bookings` (Client-Side, damit
 * Storno-/Review-Aktionen ohne Reload möglich sind).
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Skeleton } from '@/components/ui/Skeleton';
import { ClipboardListIcon } from '@/components/ui/icons';
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

const PAST_PAGE_SIZE = 20;

export function CustomerDashboard({ customer, justVerified }: CustomerDashboardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookings, setBookings] = useState<CustomerBookingsResponse>({
    upcoming: [],
    past: [],
  });
  const [loggingOut, setLoggingOut] = useState(false);
  const [pastVisibleCount, setPastVisibleCount] = useState(PAST_PAGE_SIZE);
  const [pastPage, setPastPage] = useState(1);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchCustomerBookings();
      setBookings(data);
      setStatus('ready');
      setPastVisibleCount(PAST_PAGE_SIZE);
      setPastPage(1);
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Wir konnten Ihre Anfragen nicht laden. Bitte versuchen Sie es erneut.',
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

  const totalPast = bookings.past.length;
  const pastTotalPages = Math.max(1, Math.ceil(totalPast / PAST_PAGE_SIZE));
  // Mobile: zeige `pastVisibleCount` Items (cumulativ via "Mehr laden").
  // Desktop: zeige Slice für Page `pastPage`.
  const pastForMobile = useMemo(
    () => bookings.past.slice(0, pastVisibleCount),
    [bookings.past, pastVisibleCount],
  );
  const pastForDesktop = useMemo(
    () =>
      bookings.past.slice(
        (pastPage - 1) * PAST_PAGE_SIZE,
        pastPage * PAST_PAGE_SIZE,
      ),
    [bookings.past, pastPage],
  );

  const isEmpty =
    status === 'ready' && bookings.upcoming.length === 0 && bookings.past.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
            Hallo, {customer.firstName}!
          </h1>
          <p className="mt-1 text-sm text-baerenstark-bark/70">
            Hier sehen Sie alle Ihre Anfragen und können neue stellen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/buchung"
            className="inline-flex items-center gap-2 rounded-lg bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
          >
            Neue Anfrage stellen
          </Link>
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
            Ihre E-Mail-Adresse wurde bestätigt. Willkommen bei Bärenstark!
          </Banner>
        </div>
      )}

      {status === 'error' && (
        <ErrorState
          title="Wir konnten Ihre Anfragen nicht laden."
          body={errorMessage ?? 'Bitte versuchen Sie es erneut.'}
          onRetry={load}
        />
      )}

      {status === 'loading' && <DashboardSkeleton />}

      {isEmpty && (
        <EmptyState
          icon={<ClipboardListIcon size={28} />}
          title="Sie haben noch keine Anfragen."
          body="Buchen Sie Ihren ersten Termin in wenigen Klicks."
          cta={{ label: 'Jetzt erste Anfrage stellen', href: '/buchung' }}
        />
      )}

      {status === 'ready' && !isEmpty && (
        <>
          <Section title="Anstehende Termine">
            {bookings.upcoming.length === 0 ? (
              <p className="text-sm text-baerenstark-bark/70">
                Sie haben aktuell keine anstehenden Termine.
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

          <Section title="Vergangene Anfragen" className="mt-10">
            {bookings.past.length === 0 ? (
              <p className="text-sm text-baerenstark-bark/70">
                Noch keine vergangenen Anfragen.
              </p>
            ) : (
              <>
                {/* Mobile: Cumulative-Liste */}
                <ul role="list" className="grid grid-cols-1 gap-4 sm:hidden">
                  {pastForMobile.map((b) => (
                    <li key={b.id}>
                      <CustomerBookingCard
                        booking={b}
                        variant="past"
                        onChange={onBookingChanged}
                      />
                    </li>
                  ))}
                </ul>

                {/* Desktop: Page-Slice */}
                <ul role="list" className="hidden grid-cols-1 gap-4 sm:grid">
                  {pastForDesktop.map((b) => (
                    <li key={b.id}>
                      <CustomerBookingCard
                        booking={b}
                        variant="past"
                        onChange={onBookingChanged}
                      />
                    </li>
                  ))}
                </ul>

                <PaginationControls
                  currentPage={pastPage}
                  totalPages={pastTotalPages}
                  pageSize={PAST_PAGE_SIZE}
                  totalItems={totalPast}
                  itemLabelSingular="Anfrage"
                  itemLabelPlural="Anfragen"
                  hasMore={pastVisibleCount < totalPast}
                  onLoadMore={() =>
                    setPastVisibleCount((n) =>
                      Math.min(totalPast, n + PAST_PAGE_SIZE),
                    )
                  }
                  onPageChange={setPastPage}
                />
              </>
            )}
          </Section>

          {/* ARCHITECTURE_IT10 §9.5 — Hinweis auf Vor-Account-Buchungen. */}
          <p className="mt-8 text-xs text-baerenstark-bark/60">
            Sie sehen Anfragen, die Sie als angemeldeter Kunde gestellt haben.
          </p>
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
        <Skeleton className="mb-4 h-7 w-56" ariaLabel="Lade anstehende Termine" />
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32" ariaLabel="Lade Anfrage" />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="mb-4 h-7 w-56" ariaLabel="Lade vergangene Anfragen" />
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 1 }).map((_, i) => (
            <Skeleton key={i} className="h-28" ariaLabel="Lade Anfrage" />
          ))}
        </div>
      </div>
    </div>
  );
}
