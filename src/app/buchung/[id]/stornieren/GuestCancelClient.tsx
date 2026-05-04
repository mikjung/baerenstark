'use client';

/**
 * GuestCancelClient — Client-Component für die Gast-Storno-Page (US-IT11-06).
 *
 * Spec:
 *   - frontend-requirements.md §`<GuestCancelClient>`
 *   - ARCHITECTURE_IT11.md §6.3 (Mail-Scanner-Race-Schutz) + §6.4 + §6.7
 *
 * Verhalten:
 *   - Zeigt Buchungs-Details aus den Server-Component-Props.
 *   - **Niemals automatisch POST** beim Page-Load (Mail-Scanner-Schutz).
 *   - Klick auf „Anfrage stornieren" öffnet `<CancelConfirmationDialog>`.
 *   - Bestätigung im Dialog → POST `/api/bookings/[id]/cancel?token=...`.
 *
 * State-Maschine:
 *   idle → submitting →  success (Erfolgs-Card)
 *                     →  already-cancelled (Idempotenz-Card)
 *                     →  expired (409 Frist abgelaufen → Card mit Telefon)
 *                     →  error (anderer Fehler → Card mit Retry)
 */

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CancelConfirmationDialog } from '@/components/booking/CancelConfirmationDialog';
import { ApiClientError, cancelBookingAsGuest } from '@/lib/api-client';
import { CONTACT } from '@/lib/contact';
import { formatBerlinDateShort } from '@/lib/format';
import { getServiceLabel } from '@/lib/services';

interface GuestCancelClientProps {
  bookingId: string;
  token: string;
  service: string;
  date: string | null;
  startTime: string | null;
  status: string;
}

type ViewState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; alreadyCancelled: boolean }
  | { kind: 'deadline-passed' }
  | { kind: 'error'; message: string };

export function GuestCancelClient({
  bookingId,
  token,
  service,
  date,
  startTime,
  status,
}: GuestCancelClientProps) {
  const [view, setView] = useState<ViewState>(
    // Wenn die Buchung bei Server-Component-Load schon CANCELLED ist, zeigen
    // wir direkt die Idempotenz-Card.
    status === 'CANCELLED'
      ? { kind: 'success', alreadyCancelled: true }
      : { kind: 'idle' },
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const serviceLabel = getServiceLabel(service);
  const dateLabel = date ? formatBerlinDateShort(date) : null;

  const isStillCancellable =
    status === 'PENDING' || status === 'CONFIRMED' || status === 'COUNTER_PROPOSED';

  // ---- Erfolgs-/Idempotenz-/Frist-Cards ----------------------------------

  if (view.kind === 'success') {
    return (
      <Card>
        <h2 className="mb-3 font-serif text-xl font-semibold text-baerenstark-bark">
          {view.alreadyCancelled
            ? 'Anfrage bereits storniert'
            : 'Anfrage erfolgreich storniert'}
        </h2>
        <p className="mb-4 text-baerenstark-bark/85">
          {view.alreadyCancelled
            ? 'Diese Anfrage wurde bereits storniert. Tom wurde benachrichtigt.'
            : 'Tom wurde benachrichtigt. Vielen Dank für Ihre Rückmeldung.'}
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
        >
          Zur Startseite
        </Link>
      </Card>
    );
  }

  if (view.kind === 'deadline-passed') {
    return (
      <Card tone="warning">
        <h2 className="mb-3 font-serif text-xl font-semibold text-baerenstark-bark">
          Stornierung nicht mehr möglich
        </h2>
        <p className="mb-4 text-baerenstark-bark/85">
          Die Stornierungs-Frist ist abgelaufen. Bitte rufen Sie uns an, damit
          wir gemeinsam eine Lösung finden:
        </p>
        <a
          href={`tel:${CONTACT.phoneTel}`}
          className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-cream shadow-soft hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
        >
          <span aria-hidden="true">📞 </span>
          {CONTACT.phoneDisplay}
        </a>
      </Card>
    );
  }

  if (view.kind === 'error') {
    return (
      <Card tone="error">
        <h2 className="mb-3 font-serif text-xl font-semibold text-baerenstark-bark">
          Stornierung fehlgeschlagen
        </h2>
        <p className="mb-4 text-baerenstark-bark/85">{view.message}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setView({ kind: 'idle' })}>
            Erneut versuchen
          </Button>
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="inline-flex items-center justify-center rounded-lg border-2 border-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-bark hover:bg-baerenstark-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
          >
            {CONTACT.phoneDisplay}
          </a>
        </div>
      </Card>
    );
  }

  // ---- Idle / Confirm-State ----------------------------------------------

  async function handleConfirm(reason?: string) {
    setView({ kind: 'submitting' });
    setDialogError(null);
    try {
      const res = await cancelBookingAsGuest(bookingId, token, reason);
      setDialogOpen(false);
      setView({
        kind: 'success',
        alreadyCancelled: res.alreadyCancelled,
      });
    } catch (err) {
      // Dialog bleibt offen, errorMessage zeigt den Hinweis.
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          // Frist abgelaufen / Status nicht stornierbar → Top-Level-Card.
          setDialogOpen(false);
          setView({ kind: 'deadline-passed' });
          return;
        }
        if (err.status === 401) {
          // Token expired/invalid — eigentlich vom Server-Component
          // schon abgefangen, aber defensiv.
          setDialogOpen(false);
          setView({
            kind: 'error',
            message: `Dieser Storno-Link ist nicht mehr gültig. Bitte rufen Sie ${CONTACT.phoneDisplay} an.`,
          });
          return;
        }
        setDialogError(err.message);
      } else {
        setDialogError('Stornierung fehlgeschlagen. Bitte erneut versuchen.');
      }
      setView({ kind: 'idle' });
    }
  }

  return (
    <>
      <Card>
        <h2 className="mb-3 font-serif text-xl font-semibold text-baerenstark-bark">
          Anfrage stornieren
        </h2>
        <p className="mb-4 text-baerenstark-bark/85">
          Sie können Ihre Anfrage hier stornieren. Tom wird automatisch
          benachrichtigt.
        </p>

        <dl className="mb-5 rounded-lg border border-baerenstark-sand bg-baerenstark-cream/40 p-3 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="font-medium text-baerenstark-bark/70">Service:</dt>
            <dd className="text-baerenstark-bark">{serviceLabel}</dd>
          </div>
          {dateLabel && (
            <div className="mt-1 flex items-baseline gap-2">
              <dt className="font-medium text-baerenstark-bark/70">Datum:</dt>
              <dd className="text-baerenstark-bark">
                {dateLabel}
                {startTime ? ` · ${startTime} Uhr` : ''}
              </dd>
            </div>
          )}
        </dl>

        {!isStillCancellable && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            Diese Anfrage hat den Status „{status}" und kann nicht über diesen
            Link storniert werden. Bei Fragen rufen Sie bitte{' '}
            {CONTACT.phoneDisplay} an.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            variant="danger"
            onClick={() => setDialogOpen(true)}
            disabled={!isStillCancellable}
          >
            Anfrage stornieren
          </Button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-baerenstark-wood/40 px-5 py-2.5 text-sm font-medium text-baerenstark-bark hover:bg-baerenstark-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
          >
            Abbrechen
          </Link>
        </div>
      </Card>

      <CancelConfirmationDialog
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setDialogError(null);
        }}
        onConfirm={handleConfirm}
        booking={{ service, date, startTime }}
        isSubmitting={view.kind === 'submitting'}
        errorMessage={dialogError}
      />
    </>
  );
}

function Card({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'error';
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-300 bg-amber-50/40'
      : tone === 'error'
        ? 'border-red-300 bg-red-50/40'
        : 'border-baerenstark-sand bg-white/85';
  return (
    <article
      role="status"
      aria-live="polite"
      className={`rounded-2xl border ${toneClass} p-6 shadow-soft sm:p-8`}
    >
      {children}
    </article>
  );
}
