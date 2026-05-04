'use client';

/**
 * AdminWelcomeHintBanner — Einmaliger Hinweis-Banner für Admin nach IT12-
 * Deploy. Erklärt die neue Admin-Navigation. Persistenz: localStorage.
 *
 * Spec: admin-information-architecture.md §6.1,
 * component-library-iteration-12.md §7.4,
 * frontend-requirements-iteration-12.md §IT12-S14.
 */

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'admin-nav-welcome-dismissed';

export function AdminWelcomeHintBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  // Bevor wir wissen, ob es schon dismissed wurde, NICHT rendern (verhindert
  // Flash beim Hydrate).
  if (dismissed === null || dismissed) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 rounded-lg border-l-4 border-baerenstark-wood bg-baerenstark-cream/70 px-4 py-3 text-sm text-baerenstark-bark"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 text-base">ℹ</span>
          <div>
            <p className="font-semibold">Wir haben die Navigation neu strukturiert.</p>
            <p className="mt-1 text-baerenstark-bark/80">
              Buchungsanfragen, Zeitfenster und Verfügbarkeit finden Sie jetzt
              unter „Kalender &amp; Zeitmanagement". Bewertungen liegen
              zusammen mit Analytics unter „Auswertungen".
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Hinweis ausblenden"
          className="self-start rounded-md border border-baerenstark-wood/40 px-3 py-1.5 text-sm font-medium text-baerenstark-bark transition-colors hover:bg-baerenstark-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
        >
          Verstanden
        </button>
      </div>
    </div>
  );
}
