'use client';

/**
 * HeaderOffsetSync — IT13-S03 / IT13-D3.
 *
 * Misst zur Laufzeit die Höhe des `[data-app-header]`-Elements und schreibt
 * den Wert (+ 16 px Komfort-Buffer) in die CSS-Variable `--header-offset`.
 * Damit greift `scroll-mt-[var(--header-offset)]` an Section-Anchors
 * automatisch auch dann, wenn die Header-Höhe sich ändert (Resize,
 * Inhaltsupdate, A/B-Variante).
 *
 * Renderiert kein DOM. Wird einmal global in `app/layout.tsx` montiert.
 */

import { useEffect } from 'react';

export function HeaderOffsetSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function updateOffset() {
      const header = document.querySelector<HTMLElement>('[data-app-header]');
      if (!header) return;
      const offsetPx = header.offsetHeight + 16;
      document.documentElement.style.setProperty(
        '--header-offset',
        `${offsetPx}px`,
      );
    }

    updateOffset();
    window.addEventListener('resize', updateOffset);

    // Wenn Header-Inhalt sich asynchron ändert (z. B. Auth-State / Logo
    // lädt nach), via ResizeObserver beobachten — defensiv, ohne harte
    // Abhängigkeit: nur wenn der Browser das Feature kennt.
    let observer: ResizeObserver | null = null;
    const header = document.querySelector<HTMLElement>('[data-app-header]');
    if (header && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateOffset);
      observer.observe(header);
    }

    return () => {
      window.removeEventListener('resize', updateOffset);
      observer?.disconnect();
    };
  }, []);

  return null;
}
