'use client';

/**
 * BookingSubmitButton — 4-State-Lebenszyklus für primäre Submits
 * (IT12-S11, ux-spec-iteration-12.md §1.2 + §3.11).
 *
 * States: idle | idle-disabled | submitting | success | error.
 * Doppelklick-Schutz via disabled. Spinner während `submitting`. Häkchen
 * im `success`-State.
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type BookingSubmitButtonState =
  | 'idle'
  | 'idle-disabled'
  | 'submitting'
  | 'success'
  | 'error';

interface BookingSubmitButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  state?: BookingSubmitButtonState;
  /** Default-Label für `idle`. */
  idleLabel?: string;
  /** Label während `submitting`. */
  submittingLabel?: string;
  /** Label im `success`-State. */
  successLabel?: string;
  /** Tooltip-Text für `idle-disabled` (z. B. „Bitte alle Pflichtfelder ausfüllen"). */
  formInvalidReason?: string;
}

export const BookingSubmitButton = forwardRef<
  HTMLButtonElement,
  BookingSubmitButtonProps
>(function BookingSubmitButton(
  {
    state = 'idle',
    idleLabel = 'Anfrage absenden',
    submittingLabel = 'Anfrage wird gesendet…',
    successLabel = 'Gesendet',
    formInvalidReason,
    className = '',
    type = 'submit',
    ...rest
  },
  ref,
) {
  const isDisabled =
    state === 'submitting' || state === 'success' || state === 'idle-disabled';

  let label = idleLabel;
  if (state === 'submitting') label = submittingLabel;
  else if (state === 'success') label = successLabel;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={state === 'submitting' || undefined}
      aria-disabled={isDisabled || undefined}
      title={state === 'idle-disabled' ? formInvalidReason : undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'bg-baerenstark-wood text-baerenstark-cream hover:bg-baerenstark-bark active:bg-baerenstark-bark',
        'px-5 py-2.5 text-base',
        className,
      ].join(' ')}
      {...rest}
    >
      {state === 'submitting' && (
        <span
          aria-hidden="true"
          className="spinner h-4 w-4"
          style={{ borderTopColor: 'currentColor' }}
        />
      )}
      {state === 'success' && (
        <span aria-hidden="true" className="text-base leading-none">
          ✓
        </span>
      )}
      <span>{label}</span>
    </button>
  );
});
