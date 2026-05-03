'use client';

/**
 * Admin Route-Segment Error-Boundary (IT8 / US-IT8-01).
 *
 * Fängt unbehandelte Render-Fehler in `/admin/**`-Client-Components ab
 * (z. B. den IT7-Crash `admins.filter is not a function` auf
 * `/admin/admins`). Zeigt eine deutsche Fehlermeldung statt einer weißen
 * Seite und bietet einen "Erneut versuchen"-Button (Next.js `reset`-API),
 * der den fehlerhaften Subtree neu rendert, ohne die ganze Seite zu reloaden.
 *
 * Wichtig: Diese Boundary fängt **nur** Errors aus dem Render-Pfad
 * (synchron geworfen während Render). Unbehandelte Promise-Rejections aus
 * `useEffect`/Async-Callbacks werden hiervon **nicht** erfasst — die
 * Komponenten müssen weiterhin selbst `try/catch` um Fetches legen
 * (vgl. QA-Hinweis BUG-IT8-01-C). Aktueller Code in `AdminUserTable.load()`
 * tut das bereits korrekt.
 */

import { useEffect } from 'react';

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminSegmentError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    // Fehler in der Server-Konsole sichtbar machen — Vercel-Logs sammeln das
    // automatisch, sodass wir Tom-Reports leichter zuordnen können.
    // eslint-disable-next-line no-console
    console.error('[admin] segment error boundary caught:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-soft"
      >
        <h1 className="font-serif text-2xl font-bold text-baerenstark-bark">
          Etwas ist schiefgelaufen.
        </h1>
        <p className="mt-2 text-sm text-baerenstark-bark/80">
          Diese Admin-Seite konnte nicht geladen werden. Der Fehler wurde
          protokolliert. Bitte versuche es erneut. Tritt das Problem weiter
          auf, melde dich bei der Entwicklung.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-baerenstark-bark/60">
            Fehler-ID: {error.digest}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark focus:outline-none focus:ring-2 focus:ring-baerenstark-wood focus:ring-offset-2"
          >
            Erneut versuchen
          </button>
          <a
            href="/admin"
            className="inline-flex items-center justify-center rounded-md border border-baerenstark-sand bg-white px-4 py-2 text-sm font-medium text-baerenstark-bark hover:bg-baerenstark-cream focus:outline-none focus:ring-2 focus:ring-baerenstark-wood focus:ring-offset-2"
          >
            Zum Admin-Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
