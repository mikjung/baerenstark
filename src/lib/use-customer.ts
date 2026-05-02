'use client';

/**
 * Client-Hook: liefert den eingeloggten Kunden (oder null).
 *
 * Nutzt `GET /api/customer/me`, weil das Cookie `customer-session` httpOnly
 * ist und vom JS nicht direkt gelesen werden kann. Wird im Header und in
 * jeder Client-Komponente genutzt, die sich zur Auth-Lage verhält.
 */

import { useEffect, useState } from 'react';
import { getCustomerMe } from './api-client';
import type { CustomerUserPublic } from './schemas';

export type CustomerStatus = 'loading' | 'unauthenticated' | 'authenticated';

export interface UseCustomerResult {
  status: CustomerStatus;
  customer: CustomerUserPublic | null;
  refresh: () => Promise<void>;
}

export function useCustomer(): UseCustomerResult {
  const [status, setStatus] = useState<CustomerStatus>('loading');
  const [customer, setCustomer] = useState<CustomerUserPublic | null>(null);

  const fetchMe = async (signal?: AbortSignal) => {
    try {
      const me = await getCustomerMe();
      if (signal?.aborted) return;
      if (me) {
        setCustomer(me);
        setStatus('authenticated');
      } else {
        setCustomer(null);
        setStatus('unauthenticated');
      }
    } catch {
      // Network / Server-Fehler: stillschweigend als nicht-eingeloggt behandeln
      // (der Header zeigt dann "Anmelden", was richtig ist).
      if (signal?.aborted) return;
      setCustomer(null);
      setStatus('unauthenticated');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchMe(controller.signal);
    return () => controller.abort();
  }, []);

  return {
    status,
    customer,
    refresh: () => fetchMe(),
  };
}
