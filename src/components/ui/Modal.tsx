'use client';

/**
 * Modal — Iteration 10.
 *
 * Generischer Dialog/Bottom-Sheet-Wrapper für `QuickBookingModal` (US-IT10-04)
 * und ggf. weitere Modal-Verwendungen. Spec:
 *   `project/design/ux/component-library-iteration-10.md` §1.
 *   `project/design/ux/ux-spec-iteration-10.md` §5.9 + §5.10.
 *
 * - Mobile (≤ 640 px): Bottom-Sheet (slide-up, sticky-Header + sticky-Footer).
 * - Desktop (≥ 641 px): Zentriertes Modal (fade-in).
 * - Backdrop-Klick und Escape schließen das Modal (Default-Verhalten,
 *   per `closeOnEscape`/`closeOnBackdrop` deaktivierbar).
 * - Body-Scroll wird gesperrt, solange das Modal offen ist.
 * - WAI-ARIA Dialog-Pattern (`role="dialog"`, `aria-modal="true"`).
 *
 * Focus-Trap ist eine schlanke Eigenimplementierung — `next/dialog` oder
 * `shadcn/ui`-Dialog ist im Repo nicht installiert.
 */

import { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Wird via `aria-labelledby` angesteuert — IDs des Titels referenzieren. */
  labelledBy: string;
  /** Optional: id einer Beschreibung (z. B. Slot-Info). */
  describedBy?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({
  isOpen,
  onClose,
  labelledBy,
  describedBy,
  closeOnEscape = true,
  closeOnBackdrop = true,
  className = '',
  children,
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Body-Scroll-Lock + Fokus-Save (auf Auslöser zurückspringen).
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // Initial-Fokus + Escape + Focus-Trap.
  useEffect(() => {
    if (!isOpen) return;
    const node = containerRef.current;
    if (!node) return;

    // Initial-Fokus auf erstes fokussierbares Element ODER auf den Container
    // selbst, damit Screenreader den Title vorlesen können.
    const focusables = Array.from(
      node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => !el.hasAttribute('data-modal-skip-initial-focus'));
    const initialTarget = focusables.find((el) => !el.matches('[data-modal-close]'));
    requestAnimationFrame(() => {
      (initialTarget ?? node).focus?.();
    });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (closeOnEscape) {
          e.preventDefault();
          onClose();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(
        node!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal-content flex items-end justify-center sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && closeOnBackdrop) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-modal-backdrop bg-[rgba(60,40,20,0.55)] motion-safe:animate-fade-in"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={[
          'relative z-modal-content w-full bg-baerenstark-cream shadow-modal outline-none',
          // Mobile: Bottom-Sheet
          'rounded-t-modal max-h-[92vh] motion-safe:animate-sheet-up',
          // Desktop: Centered Modal
          'sm:max-w-xl sm:rounded-modal sm:max-h-[88vh] sm:motion-safe:animate-fade-in',
          'flex flex-col',
          className,
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
