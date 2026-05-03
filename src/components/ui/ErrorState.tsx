/**
 * ErrorState — Iteration 10.
 *
 * Wiederverwendbarer Error-Block mit Retry-Button und optionalem Telefon-
 * Kontakt-Hinweis (siehe `project/design/ux/component-library-iteration-10.md` §7).
 */

import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { PhoneIcon } from './icons';

interface ErrorStateProps {
  title: string;
  body: string;
  onRetry: () => void;
  retryLabel?: string;
  /** Telefonnummer für Sekundär-Hinweis. Default: 0157-74787512. */
  phoneNumber?: string;
  /**
   * Sichtbarer Sekundär-Hinweis (nach dem Retry-Button). Default-Microcopy aus
   * `ux-spec-iteration-10.md` §3.2.
   */
  secondaryHint?: string;
  className?: string;
}

const DEFAULT_PHONE = '0157-74787512';

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel = 'Erneut versuchen',
  phoneNumber = DEFAULT_PHONE,
  secondaryHint,
  className = '',
}: ErrorStateProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // A11y — Fokus wandert beim Mount auf die Headline (Spec §3.6).
    titleRef.current?.focus();
  }, []);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'rounded-2xl border border-feedback-error bg-feedback-error-bg p-6 text-center shadow-soft',
        className,
      ].join(' ')}
    >
      <h2
        ref={titleRef}
        tabIndex={-1}
        className="mb-2 font-serif text-xl font-semibold text-feedback-error focus:outline-none"
      >
        {title}
      </h2>
      <p className="mx-auto mb-4 max-w-md text-sm text-baerenstark-bark/80">
        {body}
      </p>
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button onClick={onRetry} aria-label={`${title} erneut laden`}>
          {retryLabel}
        </Button>
        <a
          href={`tel:${phoneNumber.replace(/[^0-9+]/g, '')}`}
          className="inline-flex items-center gap-2 text-sm text-baerenstark-wood underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
        >
          <PhoneIcon size={16} />
          <span>Anrufen: {phoneNumber}</span>
        </a>
      </div>
      {secondaryHint && (
        <p className="mt-3 text-xs text-baerenstark-bark/60">{secondaryHint}</p>
      )}
    </div>
  );
}
