'use client';

/**
 * BookingDialogContext — separates Modul, um eine Zirkular-Abhängigkeit
 * zwischen `QuickBookingModal.tsx` (liest Context für `reset()`) und
 * `BookingDialogProvider.tsx` (rendert das Modal) zu vermeiden.
 *
 * Spec: ARCHITECTURE_IT11.md §2.3 + §2.8.
 */

import { createContext } from 'react';
import type { Service } from '@/lib/services';

export interface BookingDialogContextValue {
  isOpen: boolean;
  defaultService: Service | null;
  open: (options?: { service?: Service | null }) => void;
  close: () => void;
  reset: () => void;
}

export const BookingDialogContext =
  createContext<BookingDialogContextValue | null>(null);
