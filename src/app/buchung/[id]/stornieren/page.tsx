/**
 * /buchung/[id]/stornieren?token=... — Gast-Storno-Page (US-IT11-06, neu in v3).
 *
 * Server-Component:
 *   - Liest Path-Param `id` und Query `token`.
 *   - Lädt Buchungsdetails via `GET /api/bookings/:id/public-summary?token=...`
 *     (akzeptiert ab v3 sowohl `booking-confirmation`- als auch
 *     `booking-cancellation`-Scope-Tokens).
 *   - Bei 401 → `<TokenExpiredPage flow="cancellation">`.
 *   - **WICHTIG:** rendert nur UI, **kein Auto-Submit**, keine
 *     `<form method="GET">`, kein `<a href=…/cancel>`. Mail-Provider-Scanner
 *     (Outlook, Gmail) preview-fetchen Links — der GET auf diese Page ist
 *     read-only und konsumiert den Token NICHT. Erst der explizite POST
 *     aus dem Client (nach User-Klick) löst den Cancel aus.
 *
 * Spec:
 *   - frontend-requirements.md §Pages / Gast-Stornierung (v3)
 *   - ARCHITECTURE_IT11.md §6.3 + §6.7
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { TokenExpiredPage } from '@/components/booking/TokenExpiredPage';
import type { BookingPublicSummary } from '@/lib/api-client';
import { GuestCancelClient } from './GuestCancelClient';

export const metadata: Metadata = {
  title: 'Anfrage stornieren',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams: { token?: string };
}

type SummaryResult =
  | { kind: 'ok'; data: BookingPublicSummary }
  | { kind: 'unauthorized' }
  | { kind: 'not-found' }
  | { kind: 'error' };

function getBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  if (host) return `${proto}://${host}`;
  return 'http://localhost:3000';
}

async function fetchPublicSummary(
  bookingId: string,
  token: string,
): Promise<SummaryResult> {
  const url = `${getBaseUrl()}/api/bookings/${encodeURIComponent(
    bookingId,
  )}/public-summary?token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.status === 401) return { kind: 'unauthorized' };
    if (res.status === 404) return { kind: 'not-found' };
    if (!res.ok) return { kind: 'error' };
    const body = (await res.json()) as { data: BookingPublicSummary };
    if (!body.data) return { kind: 'error' };
    return { kind: 'ok', data: body.data };
  } catch {
    return { kind: 'error' };
  }
}

export default async function GuestCancelPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = params;
  const token = searchParams.token;

  if (!token) {
    return <TokenExpiredPage flow="cancellation" />;
  }

  const result = await fetchPublicSummary(id, token);

  if (result.kind === 'unauthorized') {
    return <TokenExpiredPage flow="cancellation" />;
  }

  if (result.kind === 'not-found' || result.kind === 'error') {
    return <TokenExpiredPage flow="cancellation" />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
          aria-label="Bärenstark Hausservice — Startseite"
        >
          <Image
            src="/logo.png"
            alt=""
            width={48}
            height={48}
            className="h-10 w-10 rounded-md object-contain"
          />
          <span className="font-serif text-lg font-semibold text-baerenstark-bark">
            Bärenstark Hausservice
          </span>
        </Link>
      </header>

      <GuestCancelClient
        bookingId={result.data.id}
        token={token}
        service={result.data.service}
        date={result.data.date}
        startTime={result.data.startTime}
        status={result.data.status}
      />
    </div>
  );
}
