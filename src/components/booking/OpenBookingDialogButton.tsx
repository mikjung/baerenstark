'use client';

/**
 * OpenBookingDialogButton — kleiner, wiederverwendbarer Button, der das
 * globale Booking-Modal über `useBookingDialog().open()` öffnet.
 *
 * Wird verwendet auf:
 *   - `<TokenExpiredPage flow="confirmation">` als sekundärer CTA.
 *   - `<BookingConfirmation>` als „Eine weitere Anfrage stellen"-Link.
 *
 * Im Gegensatz zum Hero/Header-CTA sind hier die Styles flexibel über
 * `className` setzbar — der Button gibt keine eigenen Tailwind-Klassen vor.
 */

import type { ReactNode } from 'react';
import { SERVICES, type Service } from '@/lib/services';
import { useBookingDialog } from './use-booking-dialog';

interface OpenBookingDialogButtonProps {
  children: ReactNode;
  className?: string;
  /** Optional: vorausgewählter Service-Slug. */
  service?: string | null;
}

function isService(slug: string | null | undefined): slug is Service {
  if (!slug) return false;
  return (SERVICES as readonly string[]).includes(slug);
}

export function OpenBookingDialogButton({
  children,
  className,
  service = null,
}: OpenBookingDialogButtonProps) {
  const { open } = useBookingDialog();
  return (
    <button
      type="button"
      onClick={() => {
        open({ service: isService(service) ? service : null });
      }}
      aria-haspopup="dialog"
      className={className}
    >
      {children}
    </button>
  );
}
