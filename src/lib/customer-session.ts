/**
 * Server-side Helper, die das `customer-session`-Cookie verifizieren und
 * via `GET /api/customer/me` das Profil laden.
 *
 * Das Frontend ist hier nicht für die JWT-Verifikation zuständig — das
 * macht das Backend. Wir rufen nur den eigenen API-Endpoint auf und
 * reichen das Cookie weiter, damit Server-Components die Auth-Lage
 * zuverlässig kennen, ohne den `jose`-Helper im FE-Bundle zu duplizieren.
 *
 * Wenn der Backend-Endpoint noch nicht läuft (Iteration-Reihenfolge),
 * gibt diese Funktion sauber `null` zurück, was den Aufruferseiten
 * erlaubt, einen Login-Redirect auszulösen.
 */

import { cookies, headers } from 'next/headers';
import type {
  CustomerBookingsResponse,
  CustomerUserPublic,
} from './schemas';

const CUSTOMER_COOKIE_NAME = 'customer-session';

function getBaseUrl(): string {
  // Bevorzugt: explizit konfigurierter Wert (Production / Preview).
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  // Fallback: aus den eingehenden Headers ableiten (Same-Origin).
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

/**
 * Liefert das eingeloggte Kundenprofil oder `null`. Wirft nicht.
 */
export async function getServerCustomer(): Promise<CustomerUserPublic | null> {
  const session = cookies().get(CUSTOMER_COOKIE_NAME);
  if (!session) return null;

  const cookieHeader = buildCookieHeader();
  try {
    const res = await fetch(`${getBaseUrl()}/api/customer/me`, {
      method: 'GET',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: CustomerUserPublic };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Lädt die Buchungen (`GET /api/customer/bookings`) für die /konto-Seite.
 * Wirft bei Fehlern, damit die Seite einen Error-State rendern kann.
 */
export async function getServerCustomerBookings(): Promise<CustomerBookingsResponse> {
  const cookieHeader = buildCookieHeader();
  const res = await fetch(`${getBaseUrl()}/api/customer/bookings`, {
    method: 'GET',
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to load bookings (HTTP ${res.status})`);
  }
  const body = (await res.json()) as { data: CustomerBookingsResponse };
  return body.data;
}
