'use client';

/**
 * ReviewForm — Inline-Bewertungs-Formular im Kundenportal (US-29 AC2-4).
 *
 * Felder:
 *   - Sterne (1–5, Pflicht) — klickbare Sterne ★, Tastatur-bedienbar
 *     (Pfeil-Tasten + Zahlen 1–5).
 *   - Text (optional, max 500 Zeichen, Zeichenzähler).
 *
 * Submit ruft `POST /api/customer/reviews`. Bei Erfolg meldet `onSubmitted`
 * dem Parent das neue Review-Objekt.
 */

import { useId, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ApiClientError, submitReview } from '@/lib/api-client';
import {
  REVIEW_MAX_TEXT_LENGTH,
  type Review,
} from '@/lib/schemas';

interface ReviewFormProps {
  bookingId: string;
  onCancel: () => void;
  onSubmitted: (review: Review) => void;
}

export function ReviewForm({ bookingId, onCancel, onSubmitted }: ReviewFormProps) {
  const [stars, setStars] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState<string | null>(null);

  const textareaId = useId();
  const counterId = `${textareaId}-counter`;
  const remaining = REVIEW_MAX_TEXT_LENGTH - text.length;
  const tooLong = remaining < 0;

  const onStarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      e.preventDefault();
      setStars(Number(e.key));
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setStars((s) => Math.min(5, (s || 0) + 1));
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setStars((s) => Math.max(0, (s || 0) - 1));
      return;
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (stars < 1) {
      setError('Bitte wähle eine Sternebewertung.');
      return;
    }
    if (tooLong) {
      setError(`Maximal ${REVIEW_MAX_TEXT_LENGTH} Zeichen.`);
      return;
    }
    setSubmitting(true);
    try {
      const review = await submitReview({
        bookingId,
        stars,
        text: text.trim() ? text.trim() : undefined,
      });
      setSubmittedSuccess(
        'Danke für deine Bewertung! Sie wird nach Prüfung veröffentlicht.',
      );
      // Eltern informieren — Card schaltet auf "schreibgeschützt" um.
      // Das machen wir mit kurzer Verzögerung, damit der Nutzer die
      // Erfolgsmeldung kurz sehen kann.
      setTimeout(() => onSubmitted(review), 1200);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setError(err.message || 'Diese Buchung wurde bereits bewertet.');
        } else if (err.status === 401) {
          setError('Bitte logge dich erneut ein.');
        } else if (err.code === 'VALIDATION_ERROR') {
          setError(err.message);
        } else {
          setError(err.message || 'Bewertung konnte nicht gespeichert werden.');
        }
      } else {
        setError('Bewertung konnte nicht gespeichert werden.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedSuccess) {
    return (
      <Banner tone="success" role="status">
        {submittedSuccess}
      </Banner>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Bewertungsformular" className="space-y-3">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-baerenstark-bark">
          Wie zufrieden warst du? <span aria-hidden="true" className="text-baerenstark-wood">*</span>
        </legend>
        <div
          role="radiogroup"
          aria-label="Sternebewertung"
          aria-required="true"
          tabIndex={0}
          onKeyDown={onStarKeyDown}
          className="inline-flex items-center gap-1 rounded-lg p-1 text-3xl outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = (hover || stars) >= n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} ${n === 1 ? 'Stern' : 'Sterne'}`}
                onClick={() => setStars(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(0)}
                className={[
                  'rounded p-0.5 transition-transform hover:scale-110',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent',
                  filled ? 'text-amber-accent' : 'text-baerenstark-sand',
                ].join(' ')}
              >
                {filled ? '★' : '☆'}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={textareaId} className="text-sm font-medium text-baerenstark-bark">
          Dein Text (optional)
        </label>
        <textarea
          id={textareaId}
          aria-describedby={counterId}
          aria-invalid={tooLong || undefined}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={REVIEW_MAX_TEXT_LENGTH + 50 /* Hard-Cap, damit der Counter sichtbar bleibt */}
          className={[
            'w-full rounded-lg border bg-white/90 px-3 py-2 text-baerenstark-bark',
            'placeholder:text-baerenstark-bark/40',
            'focus:border-baerenstark-wood focus:outline-none focus:ring-2 focus:ring-baerenstark-accent',
            tooLong ? 'border-red-500' : 'border-baerenstark-sand',
          ].join(' ')}
          placeholder="Was hat dir besonders gefallen?"
        />
        <p
          id={counterId}
          className={[
            'text-xs',
            tooLong ? 'font-medium text-red-700' : 'text-baerenstark-bark/60',
          ].join(' ')}
          aria-live="polite"
        >
          {text.length} / {REVIEW_MAX_TEXT_LENGTH} Zeichen
        </p>
      </div>

      {error && (
        <Banner tone="error" role="alert">
          {error}
        </Banner>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={submitting} disabled={stars < 1 || tooLong}>
          Bewertung absenden
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
