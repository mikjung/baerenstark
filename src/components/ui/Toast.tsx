'use client';

/**
 * Toast — Iteration 10 (systemisch).
 *
 * Spec:
 *   `project/design/ux/component-library-iteration-10.md` §5.
 *   `project/design/ux/ux-spec-iteration-10.md` §1.1.
 *
 * Variants: success / info / warning / error.
 * Position: Mobile unten zentriert, Desktop oben rechts.
 *
 * Nutzung:
 *   1. `<Toaster />` einmal im Root-Layout rendern.
 *   2. In Komponenten `import { toast } from '@/lib/toast'` und z. B.
 *      `toast.success('…')` aufrufen.
 */

import { useEffect, useState } from 'react';
import { subscribeToasts, dismissToast, type ToastEntry } from '@/lib/toast';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  XCircleIcon,
  XIcon,
} from './icons';

const VARIANT_CLASSES: Record<ToastEntry['variant'], string> = {
  success: 'bg-feedback-success-bg text-feedback-success border-feedback-success',
  info: 'bg-feedback-info-bg text-feedback-info border-feedback-info',
  warning:
    'bg-feedback-warning-bg text-baerenstark-bark border-feedback-warning',
  error: 'bg-feedback-error-bg text-feedback-error border-feedback-error',
};

function VariantIcon({ variant }: { variant: ToastEntry['variant'] }) {
  switch (variant) {
    case 'success':
      return <CheckCircle2Icon size={20} />;
    case 'info':
      return <InfoIcon size={20} />;
    case 'warning':
      return <AlertTriangleIcon size={20} />;
    case 'error':
      return <XCircleIcon size={20} />;
  }
}

export function Toaster() {
  const [items, setItems] = useState<ToastEntry[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div
      // Container ohne role — die einzelnen Toasts haben role.
      className="pointer-events-none fixed inset-0 z-toast"
    >
      <div
        className={[
          'pointer-events-none flex flex-col gap-2 p-4',
          // Mobile: bottom-center, full width minus padding.
          'absolute bottom-0 left-0 right-0 items-stretch',
          // Desktop: top-right.
          'sm:bottom-auto sm:left-auto sm:top-6 sm:right-6 sm:max-w-md sm:items-end',
        ].join(' ')}
      >
        {items.slice(-3).map((t) => (
          <ToastView key={t.id} toast={t} />
        ))}
      </div>
    </div>
  );
}

function ToastView({ toast }: { toast: ToastEntry }) {
  const isAlert = toast.variant === 'error' || toast.variant === 'warning';
  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      className={[
        'pointer-events-auto rounded-lg border-l-4 p-3 shadow-toast animate-toast-in',
        'flex gap-3 items-start',
        VARIANT_CLASSES[toast.variant],
      ].join(' ')}
    >
      <span aria-hidden="true" className="mt-0.5 inline-flex shrink-0">
        <VariantIcon variant={toast.variant} />
      </span>
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
        <p className="text-sm">{toast.message}</p>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              dismissToast(toast.id);
            }}
            className="mt-1 text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Hinweis schließen"
        className="ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-current opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
