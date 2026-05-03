'use client';

/**
 * VerifyEmailClient — Iteration 7 / US-IT7-01.
 *
 * Liest `?token=...` aus der URL und ruft `GET /api/customer/verify` auf.
 *
 * States:
 *   - 'loading'  — Token wird geprüft.
 *   - 'success'  — `emailVerified=true`, Hinweis + Link zur Anmeldung.
 *   - 'invalid'  — Token unbekannt / abgelaufen / verbraucht (410).
 *                  „Resend"-Button wenn der User eingeloggt ist.
 *   - 'missing'  — Kein Token in der URL.
 *   - 'error'    — Sonstige Server-Fehler.
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import {
  ApiClientError,
  resendVerification,
  verifyEmail,
} from '@/lib/api-client';
import { useCustomer } from '@/lib/use-customer';

type VerifyState =
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'invalid' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

export function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<VerifyState>(() =>
    token ? { kind: 'loading' } : { kind: 'missing' },
  );
  const [resendStatus, setResendStatus] = useState<
    'idle' | 'pending' | 'sent' | 'error'
  >('idle');
  const [resendError, setResendError] = useState<string | null>(null);

  const { status: customerStatus } = useCustomer();
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (calledRef.current) return;
    calledRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        await verifyEmail(token);
        if (cancelled) return;
        setState({ kind: 'success' });
        // Nach kurzer Pause auf Login mit Banner umleiten.
        setTimeout(() => {
          if (!cancelled) {
            router.replace('/konto/login?verified=1');
          }
        }, 2500);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiClientError) {
          if (err.code === 'INVALID_OR_EXPIRED_TOKEN' || err.code === 'GONE') {
            setState({ kind: 'invalid' });
            return;
          }
          if (err.code === 'RATE_LIMITED') {
            setState({
              kind: 'error',
              message:
                'Zu viele Verifizierungs-Versuche. Bitte später erneut versuchen.',
            });
            return;
          }
          setState({
            kind: 'error',
            message:
              err.message ||
              'Verifizierung fehlgeschlagen. Bitte später erneut versuchen.',
          });
          return;
        }
        setState({
          kind: 'error',
          message: 'Verifizierung fehlgeschlagen. Bitte erneut versuchen.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const handleResend = async () => {
    setResendStatus('pending');
    setResendError(null);
    try {
      await resendVerification();
      setResendStatus('sent');
    } catch (err) {
      setResendStatus('error');
      if (err instanceof ApiClientError) {
        if (err.code === 'ALREADY_VERIFIED') {
          setResendError(
            'Deine E-Mail-Adresse ist bereits bestätigt. Du kannst dich anmelden.',
          );
          return;
        }
        if (err.code === 'UNAUTHORIZED') {
          setResendError(
            'Bitte melde dich zuerst an, um einen neuen Verifizierungs-Link anzufordern.',
          );
          return;
        }
        if (err.code === 'RATE_LIMITED') {
          setResendError(
            'Zu viele Anfragen. Bitte später erneut versuchen.',
          );
          return;
        }
        setResendError(
          err.message ||
            'Senden fehlgeschlagen. Bitte später erneut versuchen.',
        );
        return;
      }
      setResendError('Senden fehlgeschlagen. Bitte erneut versuchen.');
    }
  };

  if (state.kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="space-y-3">
        <p className="text-sm text-baerenstark-bark/80">
          Deine E-Mail-Adresse wird bestätigt …
        </p>
        <div
          aria-hidden="true"
          className="spinner h-6 w-6"
          style={{ borderTopColor: 'currentColor' }}
        />
      </div>
    );
  }

  if (state.kind === 'success') {
    return (
      <div className="space-y-4">
        <Banner tone="success" title="E-Mail bestätigt" role="status">
          Deine E-Mail-Adresse wurde erfolgreich bestätigt. Du kannst dich
          jetzt einloggen.
        </Banner>
        <Link
          href="/konto/login?verified=1"
          className="inline-flex w-full items-center justify-center rounded-lg bg-baerenstark-wood px-5 py-2.5 text-base font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
        >
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  if (state.kind === 'missing') {
    return (
      <div className="space-y-4">
        <Banner tone="error" title="Link unvollständig" role="alert">
          Der Verifizierungs-Link ist unvollständig. Bitte öffne den Link
          aus deiner Bestätigungs-E-Mail erneut.
        </Banner>
        <Link
          href="/konto/login"
          className="text-sm text-baerenstark-wood underline-offset-2 hover:underline"
        >
          ← Zurück zur Anmeldung
        </Link>
      </div>
    );
  }

  if (state.kind === 'invalid') {
    return (
      <div className="space-y-4">
        <Banner tone="warning" title="Link nicht mehr gültig" role="alert">
          Dieser Verifizierungs-Link ist abgelaufen oder wurde bereits
          verwendet.
        </Banner>

        {customerStatus === 'authenticated' ? (
          <div className="space-y-3">
            <p className="text-sm text-baerenstark-bark/80">
              Klicke auf den folgenden Button, um einen neuen Link an deine
              E-Mail-Adresse zu senden.
            </p>
            <Button
              type="button"
              onClick={handleResend}
              isLoading={resendStatus === 'pending'}
              className="w-full"
              disabled={resendStatus === 'sent'}
            >
              {resendStatus === 'sent'
                ? 'E-Mail gesendet'
                : 'Neuen Verifizierungs-Link senden'}
            </Button>
            {resendStatus === 'sent' && (
              <Banner tone="success" role="status">
                Wir haben dir einen neuen Bestätigungs-Link geschickt. Bitte
                prüfe dein Postfach.
              </Banner>
            )}
            {resendStatus === 'error' && resendError && (
              <Banner tone="error" role="alert">
                {resendError}
              </Banner>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-baerenstark-bark/80">
              Bitte melde dich an, um einen neuen Verifizierungs-Link
              anzufordern. Du kannst dich auch ohne Bestätigung einloggen.
            </p>
            <Link
              href="/konto/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-baerenstark-wood px-5 py-2.5 text-base font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
            >
              Zur Anmeldung
            </Link>
          </div>
        )}
      </div>
    );
  }

  // state.kind === 'error'
  return (
    <div className="space-y-4">
      <Banner tone="error" title="Verifizierung fehlgeschlagen" role="alert">
        {state.message}
      </Banner>
      <Link
        href="/konto/login"
        className="text-sm text-baerenstark-wood underline-offset-2 hover:underline"
      >
        ← Zurück zur Anmeldung
      </Link>
    </div>
  );
}
