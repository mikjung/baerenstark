'use client';

/**
 * Client-Hook: liefert den eingeloggten Kunden (oder null).
 *
 * Nutzt `GET /api/customer/me`, weil das Cookie `customer-session` httpOnly
 * ist und vom JS nicht direkt gelesen werden kann. Wird im Header und in
 * jeder Client-Komponente genutzt, die sich zur Auth-Lage verhält.
 *
 * IT12-S07 (Phase-2-Revision):
 * - Bei Network-Error fällt der Status NICHT mehr auf `'unauthenticated'`,
 *   sondern bleibt auf dem zuletzt bekannten Wert (oder geht auf `'error'`).
 *   So flackert der Header nach einem Profil-Save nicht mehr auf „Anmelden".
 * - Subscribed auf `customer-sync.ts`-Events: Profil-Save / Login / Logout /
 *   Register-from-Booking rufen `emitCustomerChanged()`, alle Subscriber
 *   re-fetchen.
 */

import { useEffect, useRef, useState } from 'react';
import { ApiClientError, getCustomerMe } from './api-client';
import { onCustomerChanged } from './customer-sync';
import type { CustomerUserPublic } from './schemas';

export type CustomerStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'error';

export interface UseCustomerResult {
  status: CustomerStatus;
  customer: CustomerUserPublic | null;
  refresh: () => Promise<void>;
}

export function useCustomer(): UseCustomerResult {
  const [status, setStatus] = useState<CustomerStatus>('loading');
  const [customer, setCustomer] = useState<CustomerUserPublic | null>(null);
  // Wir merken uns den letzten bekannten Customer, um bei Network-Errors
  // nicht versehentlich „eingeloggt" zu „nicht eingeloggt" zu kippen.
  const lastKnownStatusRef = useRef<CustomerStatus>('loading');

  const fetchMe = async (signal?: AbortSignal) => {
    try {
      const me = await getCustomerMe();
      if (signal?.aborted) return;
      if (me) {
        setCustomer(me);
        setStatus('authenticated');
        lastKnownStatusRef.current = 'authenticated';
      } else {
        setCustomer(null);
        setStatus('unauthenticated');
        lastKnownStatusRef.current = 'unauthenticated';
      }
    } catch (err) {
      if (signal?.aborted) return;
      // 401 ist „echt nicht eingeloggt" — getCustomerMe wandelt das schon in
      // `null` um, kommt also gar nicht hier an. Hier landen Network-/5xx-
      // Fehler. IT12-S07: Status NICHT auf 'unauthenticated' setzen, sonst
      // flackert der Header nach Profil-Save.
      if (err instanceof ApiClientError && err.status === 401) {
        setCustomer(null);
        setStatus('unauthenticated');
        lastKnownStatusRef.current = 'unauthenticated';
        return;
      }
      // Network/5xx → bleibe beim letzten bekannten Status, falls einer
      // existiert. Beim Initial-Load (status === 'loading') gehen wir in
      // 'error' und der Header zeigt seinen Skeleton/Fallback weiter.
      if (lastKnownStatusRef.current === 'authenticated') {
        // bewusst nichts ändern — Customer bleibt sichtbar.
        return;
      }
      setStatus('error');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchMe(controller.signal);
    // IT12-S07: Auf Customer-Sync-Events reagieren (Profil-Save, Login,
    // Logout, Register-from-Booking).
    const unsub = onCustomerChanged(() => {
      void fetchMe();
    });
    return () => {
      controller.abort();
      unsub();
    };
  }, []);

  return {
    status,
    customer,
    refresh: () => fetchMe(),
  };
}
