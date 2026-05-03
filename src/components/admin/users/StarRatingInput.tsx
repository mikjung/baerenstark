'use client';

/**
 * StarRatingInput — wiederverwendbare 1–5-Sterne-Auswahl mit Tastatur-
 * Bedienung (US-IT6-07 AC2). Cleared-State erlaubt (null = keine Bewertung).
 */

import { useId, useState } from 'react';

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Gibt der Komponente einen sprechenden Label-Text. */
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_PX: Record<NonNullable<Props['size']>, number> = {
  sm: 18,
  md: 24,
  lg: 32,
};

export function StarRatingInput({
  value,
  onChange,
  label = 'Bewertung',
  disabled = false,
  size = 'md',
}: Props) {
  const [hover, setHover] = useState<number>(0);
  const groupId = useId();
  const px = SIZE_PX[size];

  const currentDisplay = hover || value || 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      e.preventDefault();
      onChange(Number(e.key));
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, (value ?? 0) + 1));
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(0, (value ?? 0) - 1);
      onChange(next === 0 ? null : next);
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onChange(null);
    }
  };

  return (
    <div className="space-y-1">
      <span id={`${groupId}-label`} className="text-sm font-medium text-baerenstark-bark">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
        className="inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2 rounded p-1"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'Stern' : 'Sterne'}`}
            disabled={disabled}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => !disabled && onChange(value === n ? null : n)}
            className="cursor-pointer p-0.5 text-baerenstark-wood disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <Star filled={n <= currentDisplay} size={px} />
          </button>
        ))}
        {value !== null && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-2 text-xs text-baerenstark-bark/60 underline hover:text-baerenstark-bark"
            aria-label="Bewertung entfernen"
          >
            entfernen
          </button>
        )}
      </div>
    </div>
  );
}

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.5l2.95 6.42 7.05.65-5.35 4.83 1.6 6.95L12 17.77 5.75 21.35l1.6-6.95L2 9.57l7.05-.65L12 2.5z" />
    </svg>
  );
}
