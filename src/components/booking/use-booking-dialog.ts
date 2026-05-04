'use client';

/**
 * useBookingDialog — Hook zum Öffnen/Schliessen des globalen Booking-Dialogs.
 *
 * Quelle: ARCHITECTURE_IT11.md §2.3 + §2.8 (BookingDialogProvider mit
 * `reset()`-Methode).
 *
 * Der Hook kapselt den Context-Zugriff und wirft, wenn er ausserhalb des
 * Providers verwendet wird — verhindert lautlose No-Ops im Header/Hero/etc.
 */

import { useContext } from 'react';
import {
  BookingDialogContext,
  type BookingDialogContextValue,
} from './booking-dialog-context';

export function useBookingDialog(): BookingDialogContextValue {
  const ctx = useContext(BookingDialogContext);
  if (!ctx) {
    throw new Error(
      'useBookingDialog must be used inside <BookingDialogProvider> ' +
        '(check src/app/layout.tsx).',
    );
  }
  return ctx;
}
