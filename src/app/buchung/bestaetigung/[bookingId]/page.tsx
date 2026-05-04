/**
 * /buchung/bestaetigung/[bookingId]?token=... — Initiale Bestätigungs-Page
 * (US-IT11-03, neu in v3).
 *
 * Server-Component:
 *   - Liest Path-Param `bookingId` und Query `token`.
 *   - Ruft `GET /api/bookings/:id/public-summary?token=...` serverseitig auf
 *     und reicht das Cookie weiter (für eingeloggte Kunden ohne Token).
 *   - Bei 401 (TOKEN_EXPIRED / TOKEN_INVALID / UNAUTHORIZED) → rendert
 *     `<TokenExpiredPage flow="confirmation">`.
 *   - Bei 200 → rendert `<BookingConfirmation>` mit den Daten aus dem DTO.
 *   - Bei 404 → einfache „Buchung nicht gefunden"-Page.
 *
 * Spec:
 *   - frontend-requirements.md §Pages / Bestätigungsseite (v3)
 *   - ARCHITECTURE_IT11.md §3.2 + §3.5
 */

import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { TokenExpiredPage } from '@/components/booking/TokenExpiredPage';
import type { BookingPublicSummary } from '@/lib/api-client';
import { BookingConfirmation } from './BookingConfirmation';

export const metadata: Metadata = {
  title: 'Bestätigung Ihrer Anfrage',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { bookingId: string };
  searchParams: { token?: string; new?: string };
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

function buildCookieHeader(): string | null {
  const all = cookies().getAll();
  if (all.length === 0) return null;
  return all.map((c) => `${c.name}=${c.value}`).join('; ');
}

async function fetchPublicSummary(
  bookingId: string,
  token: string | undefined,
): Promise<SummaryResult> {
  const cookieHeader = buildCookieHeader();
  const url = `${getBaseUrl()}/api/bookings/${encodeURIComponent(
    bookingId,
  )}/public-summary${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
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

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: PageProps) {
  const { bookingId } = params;
  const token = searchParams.token;
  const isFresh = searchParams.new === 'true';

  const result = await fetchPublicSummary(bookingId, token);

  if (result.kind === 'unauthorized') {
    return <TokenExpiredPage flow="confirmation" />;
  }

  if (result.kind === 'not-found' || result.kind === 'error') {
    // Wir behandeln 404 + Server-Error gleich freundlich — der User soll
    // nie eine technische Fehlerseite sehen.
    return <TokenExpiredPage flow="confirmation" />;
  }

  return (
    <BookingConfirmation
      bookingId={result.data.id}
      service={result.data.service}
      date={result.data.date}
      startTime={result.data.startTime}
      status={result.data.status}
      isFresh={isFresh}
    />
  );
}
