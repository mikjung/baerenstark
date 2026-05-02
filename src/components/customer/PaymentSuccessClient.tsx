'use client';

/**
 * PaymentSuccessClient — Stripe-Redirect-Ziel (US-28 AC6, AC7).
 *
 * Pollt den öffentlichen Status-Endpoint `GET /api/payments/session-status`
 * bis zu 5× (1s-Intervall). Bei PAID → Erfolgs-Card. Bei FAILED → Fehler-
 * Hinweis. Bei PENDING nach 5 Versuchen → "Wir verarbeiten deine Zahlung".
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import {
  ApiClientError,
  fetchPaymentSessionStatus,
} from '@/lib/api-client';
import {
  PAYMENT_SESSION_POLL_INTERVAL_MS,
  PAYMENT_SESSION_POLL_MAX_ATTEMPTS,
  type SessionStatus,
} from '@/lib/schemas';

type Phase = 'polling' | 'paid' | 'failed' | 'pending-timeout' | 'error' | 'invalid';

export function PaymentSuccessClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [phase, setPhase] = useState<Phase>('polling');
  const [data, setData] = useState<SessionStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setPhase('invalid');
      return;
    }
    let cancelled = false;
    let attempt = 0;

    async function poll() {
      while (!cancelled && attempt < PAYMENT_SESSION_POLL_MAX_ATTEMPTS) {
        attempt += 1;
        try {
          const res = await fetchPaymentSessionStatus(sessionId!);
          if (cancelled) return;
          setData(res);
          if (res.status === 'PAID') {
            setPhase('paid');
            return;
          }
          if (res.status === 'FAILED') {
            setPhase('failed');
            return;
          }
          if (res.status === 'REFUNDED') {
            // sollte hier nicht direkt nach Redirect auftreten — sicherheitshalber
            setPhase('paid'); // bezahlt war — UI zeigt Bestätigung mit Hinweis
            return;
          }
          // PENDING → weiter pollen, falls noch Versuche übrig.
        } catch (err) {
          if (cancelled) return;
          if (err instanceof ApiClientError) {
            if (err.status === 404) {
              // Webhook noch nicht durch — als pending behandeln.
            } else {
              setErrorMessage(err.message);
              setPhase('error');
              return;
            }
          } else {
            setErrorMessage('Status konnte nicht abgefragt werden.');
            setPhase('error');
            return;
          }
        }
        if (attempt < PAYMENT_SESSION_POLL_MAX_ATTEMPTS) {
          await new Promise((r) =>
            setTimeout(r, PAYMENT_SESSION_POLL_INTERVAL_MS),
          );
        }
      }
      if (!cancelled) setPhase('pending-timeout');
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (phase === 'invalid') {
    return (
      <Banner tone="error" title="Ungültiger Link" role="alert">
        Es fehlt eine gültige `session_id`. Wenn du gerade bezahlt hast,
        prüfe bitte deine E-Mails — du erhältst dort eine Bestätigung.
      </Banner>
    );
  }

  if (phase === 'polling') {
    return (
      <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-8 text-center shadow-card">
        <div className="mb-4 text-3xl" aria-hidden="true">
          ⏳
        </div>
        <h1 className="mb-2 font-serif text-2xl font-bold text-baerenstark-bark">
          Zahlung wird bestätigt …
        </h1>
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-baerenstark-bark/80"
        >
          Einen Augenblick bitte — wir prüfen den Status deiner Zahlung.
        </p>
      </div>
    );
  }

  if (phase === 'paid') {
    return (
      <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-8 text-center shadow-card">
        <div className="mb-3 text-5xl" aria-hidden="true">
          🎉
        </div>
        <h1 className="mb-2 font-serif text-2xl font-bold text-baerenstark-bark">
          Zahlung erfolgreich!
        </h1>
        <p className="mb-6 text-sm text-baerenstark-bark/85">
          Vielen Dank — wir haben deine Zahlung erhalten. Eine Bestätigung
          per E-Mail folgt in Kürze.
        </p>
        {data?.bookingId && (
          <Link
            href={`/konto`}
            className="inline-flex items-center gap-2 rounded-lg bg-baerenstark-wood px-5 py-2.5 text-sm font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark"
          >
            Zur Auftragsübersicht
          </Link>
        )}
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <Banner tone="error" title="Zahlung fehlgeschlagen" role="alert">
        <p className="mb-3">
          Deine Zahlung konnte nicht verarbeitet werden. Bitte versuche es
          erneut oder kontaktiere Tom unter 0157-74787512.
        </p>
        {data?.bookingId && (
          <Link
            href={`/konto/zahlung/${data.bookingId}`}
            className="text-baerenstark-wood underline-offset-2 hover:underline"
          >
            Erneut versuchen
          </Link>
        )}
      </Banner>
    );
  }

  if (phase === 'error') {
    return (
      <Banner tone="error" title="Status nicht abrufbar" role="alert">
        {errorMessage ??
          'Zahlung konnte nicht bestätigt werden. Bitte kontaktiere Tom: 0157-74787512.'}
      </Banner>
    );
  }

  // pending-timeout
  return (
    <div className="rounded-2xl border border-baerenstark-sand bg-white/85 p-8 text-center shadow-card">
      <div className="mb-3 text-3xl" aria-hidden="true">
        ⏳
      </div>
      <h1 className="mb-2 font-serif text-xl font-bold text-baerenstark-bark">
        Wir verarbeiten deine Zahlung
      </h1>
      <p className="mb-4 text-sm text-baerenstark-bark/85">
        Du erhältst in Kürze eine E-Mail-Bestätigung. Falls nicht, melde
        dich bitte bei Tom: 0157-74787512.
      </p>
      <Link
        href="/konto"
        className="text-baerenstark-wood underline-offset-2 hover:underline"
      >
        Zur Auftragsübersicht
      </Link>
    </div>
  );
}
