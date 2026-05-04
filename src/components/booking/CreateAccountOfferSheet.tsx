'use client';

/**
 * CreateAccountOfferSheet — Embedded-Card auf der Buchungs-Bestätigungsseite,
 * die Gast-Bucher fragt, ob sie aus den eingegebenen Daten ein Konto erstellen
 * möchten.
 *
 * Spec:
 * - ux-spec-iteration-12.md §3.5
 * - component-library-iteration-12.md §3
 * - frontend-requirements-iteration-12.md §IT12-S05
 *
 * Phase-2-Revision: Embedded-Card auf allen Viewports (kein Modal,
 * kein Bottom-Sheet). Endpoint `POST /api/customer/register-from-booking`
 * mit `{ bookingId, confirmationToken, password }`. Bei 409 ACCOUNT_EXISTS
 * → Banner mit Login-CTA. Dismiss persistiert per-Booking via sessionStorage.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  ApiClientError,
  registerFromBooking,
} from '@/lib/api-client';
import { emitCustomerChanged } from '@/lib/customer-sync';

interface CreateAccountOfferSheetProps {
  bookingId: string;
  confirmationToken: string;
  /** Anzeige-Email (read-only). Backend liest die echte Email aus dem Token. */
  displayEmail: string;
  /** Optional: Vorname für „Hallo {firstName}, …"-Tonalität. */
  displayFirstName?: string | null;
}

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; linkedBookingsCount: number }
  | { kind: 'account-exists'; loginEmail: string }
  | { kind: 'token-invalid' }
  | { kind: 'server-error'; message: string }
  | { kind: 'dismissed' };

const MIN_PASSWORD = 12;

function dismissKey(bookingId: string): string {
  return `accountPromptDismissed:${bookingId}`;
}

export function CreateAccountOfferSheet({
  bookingId,
  confirmationToken,
  displayEmail,
  displayFirstName,
}: CreateAccountOfferSheetProps) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // sessionStorage-Check beim Mount (per-Booking).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem(dismissKey(bookingId)) === '1') {
        setState({ kind: 'dismissed' });
      }
    } catch {
      /* sessionStorage nicht verfügbar — wir zeigen die Card */
    }
  }, [bookingId]);

  const passwordsMatch = password.length === 0 || password === passwordConfirm;
  const passwordLongEnough = password.length >= MIN_PASSWORD;
  const isFormValid = passwordLongEnough && passwordsMatch && !!password;

  const greetName = useMemo(() => {
    const trimmed = (displayFirstName ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [displayFirstName]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!passwordLongEnough) {
      setValidationError(`Passwort muss mindestens ${MIN_PASSWORD} Zeichen lang sein.`);
      return;
    }
    if (!passwordsMatch) {
      setValidationError('Passwörter stimmen nicht überein.');
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const res = await registerFromBooking({
        bookingId,
        confirmationToken,
        password,
      });
      // Backend hat `Set-Cookie: customer-session=...` mitgeschickt — wir
      // sind eingeloggt. Subscriber benachrichtigen + Page refreshen.
      emitCustomerChanged();
      router.refresh();
      setState({
        kind: 'success',
        linkedBookingsCount: res.linkedBookingsCount,
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        const subcode = err.subcode;
        if (err.status === 409 || subcode === 'ACCOUNT_EXISTS') {
          setState({ kind: 'account-exists', loginEmail: displayEmail });
          return;
        }
        if (
          err.status === 401 ||
          err.status === 400 ||
          subcode === 'INVALID_TOKEN'
        ) {
          setState({ kind: 'token-invalid' });
          return;
        }
        setState({
          kind: 'server-error',
          message:
            err.status >= 500
              ? 'Konto konnte gerade nicht erstellt werden. Bitte später erneut versuchen.'
              : err.message,
        });
        return;
      }
      setState({
        kind: 'server-error',
        message: 'Konto konnte gerade nicht erstellt werden. Bitte später erneut versuchen.',
      });
    }
  };

  const onDismiss = () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(dismissKey(bookingId), '1');
      }
    } catch {
      /* ignore */
    }
    setState({ kind: 'dismissed' });
  };

  if (state.kind === 'dismissed') {
    // Card komplett ausblenden — Spec §3.5.4 lässt einen kleinen Hint zu,
    // den wir hier dezent rendern.
    return (
      <p className="mt-6 text-sm text-baerenstark-bark/60">
        Sie können jederzeit später ein Konto erstellen —{' '}
        <Link
          href="/konto/registrieren"
          className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
        >
          → Konto erstellen
        </Link>
        .
      </p>
    );
  }

  if (state.kind === 'success') {
    return (
      <section
        role="status"
        aria-live="polite"
        aria-labelledby="account-offer-success"
        className="mt-6 rounded-lg border border-baerenstark-sand bg-white p-5 shadow-soft sm:p-6"
      >
        <h2
          id="account-offer-success"
          className="mb-2 font-serif text-xl font-semibold text-baerenstark-bark"
        >
          Konto erstellt! Sie sind jetzt angemeldet.
        </h2>
        <p className="mb-4 text-sm text-baerenstark-bark/80">
          {state.linkedBookingsCount > 1
            ? `Wir haben ${state.linkedBookingsCount} Anfragen mit Ihrem Konto verknüpft.`
            : 'Ihre Anfrage ist jetzt mit Ihrem Konto verknüpft.'}
        </p>
        <Link
          href="/konto"
          className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-cream shadow-soft transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
        >
          Zu meinen Anfragen →
        </Link>
      </section>
    );
  }

  if (state.kind === 'token-invalid') {
    return (
      <div className="mt-6">
        <Banner tone="error" title="Bestätigungs-Link abgelaufen" role="alert">
          <p>
            Dieser Bestätigungs-Link ist nicht mehr gültig. Bitte buchen Sie
            erneut oder kontaktieren Sie uns telefonisch.
          </p>
        </Banner>
      </div>
    );
  }

  // ACCOUNT_EXISTS (409) als Banner UND Submit-Button auf „Anmelden" wechseln.
  const showAccountExistsBanner = state.kind === 'account-exists';
  const showServerError = state.kind === 'server-error';
  const isSubmitting = state.kind === 'submitting';

  return (
    <section
      role="region"
      aria-labelledby="account-offer-title"
      className="mt-6 rounded-lg border border-baerenstark-sand bg-baerenstark-cream p-5 shadow-soft sm:p-6"
    >
      <h2
        id="account-offer-title"
        className="mb-2 font-serif text-xl font-semibold text-baerenstark-bark"
      >
        Möchten Sie ein Konto erstellen?
      </h2>
      {/* IT12-Bugfix BUG-002: Wenn die E-Mail vom Backend bekannt ist, zeigen
          wir sie explizit in der Begrüßung — sonst neutraler Text. */}
      {displayEmail ? (
        <p className="mb-4 text-sm text-baerenstark-bark/85">
          {greetName ? `Hallo ${greetName}, e` : 'E'}rstellen Sie ein Konto für{' '}
          <strong className="font-medium text-baerenstark-bark">
            {displayEmail}
          </strong>{' '}
          — verfolgen Sie alle Ihre Anfragen einfacher.
        </p>
      ) : (
        <p className="mb-4 text-sm text-baerenstark-bark/80">
          {greetName ? `Hallo ${greetName} — m` : 'M'}it einem Konto können Sie:
        </p>
      )}
      <ul className="mb-4 space-y-1.5 text-sm text-baerenstark-bark/85">
        <li className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 text-feedback-success">✓</span>
          Ihre Anfragen jederzeit einsehen
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 text-feedback-success">✓</span>
          Den Status verfolgen
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 text-feedback-success">✓</span>
          Schneller weitere Termine buchen
        </li>
      </ul>

      {showAccountExistsBanner && (
        <div className="mb-4">
          <Banner tone="warning" role="alert">
            <p className="mb-2">
              Diese E-Mail ist bereits registriert. Möchten Sie sich
              stattdessen anmelden?
            </p>
            <Link
              href={
                displayEmail
                  ? `/konto/login?email=${encodeURIComponent(displayEmail)}`
                  : '/konto/login'
              }
              className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
            >
              Anmelden →
            </Link>
          </Banner>
        </div>
      )}

      {!showAccountExistsBanner && (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {displayEmail ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-baerenstark-bark">
                E-Mail
              </label>
              <input
                type="email"
                value={displayEmail}
                readOnly
                disabled
                aria-label="E-Mail (vorausgefüllt aus Buchung)"
                className="w-full rounded-md border border-baerenstark-sand bg-white/60 px-3 py-2 text-sm text-baerenstark-bark/80"
              />
            </div>
          ) : (
            <p className="text-sm text-baerenstark-bark/70">
              Wir verknüpfen das Konto mit der E-Mail aus Ihrer Anfrage.
            </p>
          )}

          <Input
            label="Passwort"
            type="password"
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            hint={`Mindestens ${MIN_PASSWORD} Zeichen.`}
          />

          <Input
            label="Passwort wiederholen"
            type="password"
            required
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            disabled={isSubmitting}
          />

          {validationError && (
            <Banner tone="error" role="alert">
              {validationError}
            </Banner>
          )}

          {showServerError && state.kind === 'server-error' && (
            <Banner tone="error" role="alert">
              {state.message}
            </Banner>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onDismiss}
              disabled={isSubmitting}
              className="text-sm text-baerenstark-bark/70 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              Nein, danke
            </button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={!isFormValid && !isSubmitting}
            >
              Konto erstellen
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
