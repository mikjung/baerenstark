/**
 * /konto/anfragen/[id] — Customer-Anfrage Detail-Ansicht (US-IT10-05).
 *
 * Spec: `project/design/ux/ux-spec-iteration-10.md` §6.8.
 *
 * Read-only Detail-Page einer eigenen Buchung. KEIN Storno-Button (PM-3
 * → Backlog). Aktionsleiste enthält nur Telefon-CTA und „Neue Anfrage stellen".
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { getServerCustomer } from '@/lib/customer-session';
import { BookingStatusBadge } from '@/components/customer/BookingStatusBadge';
import { Button } from '@/components/ui/Button';
import { PhoneIcon } from '@/components/ui/icons';
import {
  formatBerlinDateLong,
  formatCentsAsEuro,
  formatIsoBerlinShort,
  formatTimeRange,
} from '@/lib/customer-portal';
import { getServiceLabel } from '@/lib/services';
import type { CustomerBooking } from '@/lib/schemas';

export const metadata: Metadata = {
  title: 'Anfrage-Details',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

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

async function fetchBooking(id: string): Promise<CustomerBooking | null | 'forbidden'> {
  const cookieHeader = buildCookieHeader();
  const res = await fetch(
    `${getBaseUrl()}/api/customer/bookings/${encodeURIComponent(id)}`,
    {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: 'no-store',
    },
  );
  if (res.status === 404) return null;
  if (res.status === 403) return 'forbidden';
  if (!res.ok) {
    throw new Error(`Failed to load booking ${id} (HTTP ${res.status})`);
  }
  const body = (await res.json()) as { data: CustomerBooking };
  return body.data;
}

export default async function KontoAnfrageDetailPage({ params }: PageProps) {
  const me = await getServerCustomer();
  if (!me) redirect('/konto/login');

  let booking: CustomerBooking | null | 'forbidden';
  try {
    booking = await fetchBooking(params.id);
  } catch {
    return (
      <DetailErrorShell
        title="Wir konnten diese Anfrage gerade nicht laden."
        body="Bitte versuchen Sie es erneut, oder rufen Sie uns an: 0157-74787512."
      />
    );
  }
  if (booking === 'forbidden') {
    return (
      <DetailErrorShell
        title="Sie haben keinen Zugriff auf diese Anfrage."
        body="Diese Anfrage gehört nicht zu Ihrem Konto."
      />
    );
  }
  if (!booking) notFound();

  const dateLabel = formatBerlinDateLong(booking.date);
  const timeLabel = formatTimeRange(booking.startTime, booking.endTime);
  const createdAtLabel = formatIsoBerlinShort(booking.createdAt);
  const serviceLabel = getServiceLabel(booking.service);

  const addressLine = [
    booking.addressStreet,
    [booking.addressZip, booking.addressCity].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/konto"
        className="inline-flex items-center gap-1 text-sm text-baerenstark-wood underline-offset-2 hover:underline"
      >
        ← Zurück zur Übersicht
      </Link>

      <header className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-baerenstark-bark sm:text-4xl">
            Anfrage vom {createdAtLabel.split(',')[0]}
          </h1>
          <p className="mt-1 text-sm text-baerenstark-bark/70">
            Erstellt am {createdAtLabel}
          </p>
        </div>
        <BookingStatusBadge status={booking.status} />
      </header>

      <div className="space-y-6 rounded-2xl border border-baerenstark-sand bg-white/80 p-6 shadow-soft">
        <Field label="Termin">
          {dateLabel}
          {timeLabel && (
            <>
              <span className="mx-1.5 text-baerenstark-bark/40">·</span>
              {timeLabel}
            </>
          )}
        </Field>

        <Field label="Service">
          {serviceLabel}
          {booking.durationMinutes > 0 && (
            <span className="ml-1 text-baerenstark-bark/70">
              · {Math.round(booking.durationMinutes / 60)} Stunden
            </span>
          )}
        </Field>

        {addressLine && <Field label="Adresse">{addressLine}</Field>}

        {booking.description && (
          <Field label="Beschreibung">
            <span className="whitespace-pre-line">{booking.description}</span>
          </Field>
        )}

        {booking.attachments.length > 0 && (
          <Field label="Anhänge">
            <ul className="flex flex-wrap gap-2">
              {booking.attachments.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-baerenstark-sand bg-baerenstark-cream/60 px-3 py-1 text-sm text-baerenstark-bark/80"
                >
                  {a.filename ?? 'Datei'}
                </li>
              ))}
            </ul>
          </Field>
        )}

        {booking.payment && (
          <Field label="Zahlung">
            {formatCentsAsEuro(booking.payment.amount)} —{' '}
            {booking.payment.status === 'PAID' ? 'bezahlt' : 'offen'}
          </Field>
        )}
      </div>

      {/* Aktionen — KEIN Storno (PM-3 → Backlog) */}
      <section className="mt-6" aria-labelledby="actions-heading">
        <h2
          id="actions-heading"
          className="mb-3 font-serif text-lg font-semibold text-baerenstark-bark"
        >
          Aktionen
        </h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="tel:015774787512"
            className="inline-flex items-center gap-2 rounded-lg bg-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
          >
            <PhoneIcon size={16} />
            <span>Tom anrufen: 0157-74787512</span>
          </a>
          <Link
            href="/buchung"
            className="inline-flex items-center gap-2 rounded-lg border border-baerenstark-wood/40 px-5 py-2.5 text-sm font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40"
          >
            Neue Anfrage stellen →
          </Link>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-baerenstark-bark/60">
        {label}
      </p>
      <p className="mt-1 text-baerenstark-bark">{children}</p>
    </div>
  );
}

function DetailErrorShell({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/konto"
        className="inline-flex items-center gap-1 text-sm text-baerenstark-wood underline-offset-2 hover:underline"
      >
        ← Zur Übersicht
      </Link>
      <div className="mt-6 rounded-2xl border border-feedback-error bg-feedback-error-bg p-6">
        <h1 className="mb-2 font-serif text-xl font-semibold text-feedback-error">
          {title}
        </h1>
        <p className="text-sm text-baerenstark-bark/80">{body}</p>
      </div>
    </div>
  );
}
