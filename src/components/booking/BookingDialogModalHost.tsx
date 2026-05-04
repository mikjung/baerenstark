'use client';

/**
 * BookingDialogModalHost — kleiner Wrapper, der das Modal **erst nach Mount**
 * rendert. Das vermeidet SSR/CSR-Mismatches, wenn der Provider im Root-Layout
 * sitzt und SSG-Pages das Modal-DOM gar nicht haben sollen.
 *
 * Die `<Modal>`-Komponente selbst rendert per Default an Ort der JSX-Position;
 * wir setzen sie ans Ende des `<body>` in CSS via `position: fixed` (siehe
 * `Modal.tsx`). Ein zusätzlicher `createPortal`-Roundtrip ist nicht nötig —
 * `position: fixed` reicht für den Stacking-Context, weil das Modal eine
 * eigene z-index-Klasse hat.
 *
 * Wir warten dennoch auf `useEffect`, sodass der Modal-DOM-Tree erst nach dem
 * ersten Client-Render entsteht — vermeidet React-Hydration-Warnungen, falls
 * `isOpen` durch URL-Params direkt initial true wäre.
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface BookingDialogModalHostProps {
  children: ReactNode;
}

export function BookingDialogModalHost({ children }: BookingDialogModalHostProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <>{children}</>;
}
