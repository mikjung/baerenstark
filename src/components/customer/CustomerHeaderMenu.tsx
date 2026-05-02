'use client';

/**
 * CustomerHeaderMenu — zeigt im Header entweder
 *   - "Mein Konto" + Logout-Button (wenn `customer-session`-Cookie gültig)
 *   - "Anmelden"-Link (wenn nicht eingeloggt)
 *
 * Liest den Auth-Status via `GET /api/customer/me`, weil das Cookie httpOnly
 * ist und nicht clientseitig per `document.cookie` lesbar.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiClientError, logoutCustomer } from '@/lib/api-client';
import { useCustomer } from '@/lib/use-customer';

export function CustomerHeaderMenu() {
  const router = useRouter();
  const { status, customer, refresh } = useCustomer();
  const [loggingOut, setLoggingOut] = useState(false);

  if (status === 'loading') {
    // Kein "Lade…"-Spinner im Header — nimmt Platz und springt; stattdessen
    // einfach Platzhalter, der ungefähr die Login-Link-Breite hat.
    return (
      <span
        aria-hidden="true"
        className="hidden h-9 w-20 rounded-lg bg-baerenstark-sand/40 sm:inline-block"
      />
    );
  }

  if (status === 'unauthenticated' || !customer) {
    return (
      <Link
        href="/konto/login"
        className="rounded-lg border border-baerenstark-wood/40 px-3 py-2 text-sm font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40 sm:px-4"
      >
        Anmelden
      </Link>
    );
  }

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutCustomer();
    } catch (err) {
      // Selbst bei Fehler weiterleiten — Server löscht das Cookie via
      // Max-Age=0; im worst case räumt der nächste me-Call auf.
      if (!(err instanceof ApiClientError)) {
        // unbekannte Fehler ignorieren
      }
    } finally {
      await refresh();
      setLoggingOut(false);
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/konto"
        className="rounded-lg border border-baerenstark-wood/40 px-3 py-2 text-sm font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40 sm:px-4"
      >
        <span className="hidden sm:inline">Mein Konto</span>
        <span className="sm:hidden">Konto</span>
      </Link>
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="rounded-lg px-2 py-2 text-sm font-medium text-baerenstark-bark/70 transition-colors hover:bg-baerenstark-sand/40 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
        aria-label="Abmelden"
      >
        {loggingOut ? '…' : 'Abmelden'}
      </button>
    </div>
  );
}
