'use client';

/**
 * BookingDialogProvider — globaler Modal-State für US-IT11-02.
 *
 * Spec:
 *   - frontend-requirements.md §Shared Components / `<BookingDialogProvider>`
 *   - ARCHITECTURE_IT11.md §2.3 + §2.8 (reset-Methode, v3)
 *
 * Verantwortlichkeiten:
 *   1. Hält den App-weiten Modal-State (`isOpen`, `defaultService`).
 *   2. Lädt `useCustomer()` einmal zentral und reicht den Customer-Context an
 *      die internen Booking-Komponenten — vermeidet redundante
 *      `/api/customer/me`-Aufrufe.
 *   3. Rendert `<QuickBookingModal mode="standalone" />` am Ende des Layouts,
 *      sodass es über alle anderen Inhalte legt (Modal hat eigenen z-index).
 *   4. Stellt `open()`, `close()`, `reset()` bereit. `reset()` setzt
 *      `isOpen=false`, `defaultService=null` UND inkrementiert einen
 *      `formKey`, der auf das Modal als `key` durchgereicht wird → erzwingt
 *      Remount → frischer Form-State (BUG-MAJOR-09 / BUG-MAJOR-07).
 *
 * Verwendung:
 *   - `<BookingDialogProvider>{children}</BookingDialogProvider>` einmalig im
 *     Root-Layout.
 *   - Aus jeder Client-Komponente: `const { open } = useBookingDialog();`
 */

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useCustomer } from '@/lib/use-customer';
import type { Service } from '@/lib/services';
import { QuickBookingModal } from './QuickBookingModal';
import { BookingDialogModalHost } from './BookingDialogModalHost';
import {
  BookingDialogContext,
  type BookingDialogContextValue,
} from './booking-dialog-context';

export type { BookingDialogContextValue };
export { BookingDialogContext };

interface BookingDialogProviderProps {
  children: ReactNode;
}

export function BookingDialogProvider({ children }: BookingDialogProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [defaultService, setDefaultService] = useState<Service | null>(null);
  // formKey dient als Remount-Trigger für das Modal-Skelett — bei jedem
  // `reset()` wird er inkrementiert, sodass `<QuickBookingModal key={formKey}/>`
  // einen kompletten Remount macht und der RHF-State neu initialisiert wird.
  const [formKey, setFormKey] = useState(0);

  // IT11 / US-IT11-05 — zentral einmal laden, downstream nutzbar.
  const { customer, status: customerStatus } = useCustomer();

  const open = useCallback<BookingDialogContextValue['open']>((options) => {
    setDefaultService(options?.service ?? null);
    setIsOpen(true);
  }, []);

  const reset = useCallback(() => {
    setIsOpen(false);
    setDefaultService(null);
    setFormKey((k) => k + 1);
  }, []);

  const close = useCallback(() => {
    // Tom-Entscheidung BUG-MAJOR-07: jedes Schließen (Backdrop / Escape /
    // X-Button / „Abbrechen") resettet den Form-State, sodass beim nächsten
    // Öffnen ein frisches Formular erscheint.
    reset();
  }, [reset]);

  const value = useMemo<BookingDialogContextValue>(
    () => ({ isOpen, defaultService, open, close, reset }),
    [isOpen, defaultService, open, close, reset],
  );

  // Profil-Adresse defensiv lesen (Migration könnte in Prod fehlen) — gleiche
  // Logik wie in `BookingClient.tsx`.
  const profileAddress = useMemo(() => {
    if (!customer) return null;
    const c = customer as unknown as Record<string, unknown>;
    const street = typeof c.streetAndNumber === 'string' ? c.streetAndNumber : null;
    const zip = typeof c.postalCode === 'string' ? c.postalCode : null;
    const city = typeof c.city === 'string' ? c.city : null;
    if (!street && !zip && !city) return null;
    return { streetAndNumber: street, postalCode: zip, city };
  }, [customer]);

  const defaultValues = useMemo(() => {
    if (!customer) {
      return {
        customerName: null,
        customerEmail: null,
        customerPhone: null,
        addressStreet: null,
        addressZip: null,
        addressCity: null,
      };
    }
    return {
      customerName: `${customer.firstName} ${customer.lastName}`.trim() || null,
      customerEmail: customer.email ?? null,
      customerPhone: customer.phone ?? null,
      addressStreet: profileAddress?.streetAndNumber ?? null,
      addressZip: profileAddress?.postalCode ?? null,
      addressCity: profileAddress?.city ?? null,
    };
  }, [customer, profileAddress]);

  // Hinweis: Zeige den „Adresse im Profil hinterlegen"-Banner, wenn der Kunde
  // eingeloggt ist UND keine Adresse hat. Wird intern vom Modal ausgewertet.
  const showProfileAddressHint =
    customerStatus === 'authenticated' && !profileAddress;

  return (
    <BookingDialogContext.Provider value={value}>
      {children}
      <BookingDialogModalHost>
        <QuickBookingModal
          key={formKey}
          mode="standalone"
          isOpen={isOpen}
          onClose={close}
          selectedTimeSlot={null}
          defaultService={defaultService}
          defaultValues={{
            customerName: defaultValues.customerName,
            customerEmail: defaultValues.customerEmail,
            customerPhone: defaultValues.customerPhone,
            addressStreet: defaultValues.addressStreet,
            addressZip: defaultValues.addressZip,
            addressCity: defaultValues.addressCity,
          }}
          showProfileAddressHint={showProfileAddressHint}
          onSubmitSuccess={() => {
            // Provider-Reset wird vom Modal selbst (vor dem router.push)
            // aufgerufen — siehe ARCHITECTURE_IT11 §2.8.
          }}
        />
      </BookingDialogModalHost>
    </BookingDialogContext.Provider>
  );
}
