/**
 * EmptyState — Iteration 10.
 *
 * Wiederverwendbarer Empty-State-Block (siehe
 * `project/design/ux/component-library-iteration-10.md` §6).
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  /** Lucide-Icon o. ä., 48×48 px erwartet. */
  icon?: ReactNode;
  title: string;
  body?: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  secondary?: { label: string; href?: string };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  body,
  cta,
  secondary,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'rounded-2xl border border-baerenstark-sand bg-white/70 p-8 text-center shadow-soft',
        className,
      ].join(' ')}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-baerenstark-cream/80 text-baerenstark-wood"
        >
          {icon}
        </div>
      )}
      <h2 className="mb-2 font-serif text-xl font-semibold text-baerenstark-bark">
        {title}
      </h2>
      {body && <p className="mx-auto mb-5 max-w-md text-sm text-baerenstark-bark/80">{body}</p>}
      {cta &&
        (cta.href ? (
          <Link
            href={cta.href}
            className="inline-flex items-center gap-2 rounded-lg bg-baerenstark-wood px-6 py-3 text-sm font-medium text-baerenstark-cream transition-colors hover:bg-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent"
          >
            {cta.label}
          </Link>
        ) : (
          <Button onClick={cta.onClick}>{cta.label}</Button>
        ))}
      {secondary && (
        <p className="mt-3 text-sm">
          {secondary.href ? (
            <Link
              href={secondary.href}
              className="text-baerenstark-wood underline-offset-2 hover:underline"
            >
              {secondary.label}
            </Link>
          ) : (
            secondary.label
          )}
        </p>
      )}
    </div>
  );
}
