'use client';

/**
 * CancelConfirmationDialog — Confirm-Modal für die Storno-Aktion (US-IT11-06).
 *
 * Spec:
 *   - frontend-requirements.md §`<CancelConfirmationDialog>`
 *   - ARCHITECTURE_IT11.md §6.7
 *
 * Verhalten:
 *   - Modal mit Titel „Anfrage stornieren?", Body mit Service + Datum + Zeit.
 *   - Optionaler `<textarea>` für „Grund (optional)" — max. 500 Zeichen
 *     (Counter sichtbar; Tom-Empfehlung Q5).
 *   - Buttons: „Abbrechen" (links, sekundär) + „Ja, stornieren" (rechts,
 *     destruktiv-rot).
 *   - **Submit-Block:** während `isSubmitting` ist Escape und Backdrop-Click
 *     deaktiviert; Buttons sind disabled.
 *   - A11y: Focus initial auf „Abbrechen"-Button (sicherer Default — der
 *     primäre Action ist destruktiv).
 *
 * Wird verwendet im Customer-Dashboard (`/konto`) und im Gast-Storno-Flow
 * (`/buchung/[id]/stornieren`).
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { formatBerlinDateShort } from '@/lib/format';
import { getServiceLabel } from '@/lib/services';

interface CancelConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Wird mit optionalem Reason aufgerufen, sobald der User bestätigt. */
  onConfirm: (reason?: string) => void | Promise<void>;
  /** Buchungs-Display-Daten für den Dialog-Body. */
  booking: {
    service: string; // Slug ODER Label
    date: string | null; // YYYY-MM-DD
    startTime: string | null; // HH:MM
  };
  /** Wenn true, blockiert der Dialog Escape und Backdrop-Click + Buttons. */
  isSubmitting?: boolean;
  /** Optional: Fehlermeldung anzeigen (z.B. 409 Frist abgelaufen). */
  errorMessage?: string | null;
}

const REASON_MAX = 500;

export function CancelConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  booking,
  isSubmitting = false,
  errorMessage = null,
}: CancelConfirmationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [reason, setReason] = useState<string>('');
  const titleId = useId();
  const descId = useId();

  // Fokus-Save + Initial-Fokus auf „Abbrechen" (destruktiv-Action ist rechts).
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // Escape-Handler — gesperrt während Submit (Spec §`CancelConfirmationDialog`).
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isSubmitting) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isSubmitting, onClose]);

  // Reset Reason bei jedem Öffnen.
  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  if (!isOpen) return null;

  const serviceLabel = getServiceLabel(booking.service);
  const dateLabel = booking.date ? formatBerlinDateShort(booking.date) : null;

  function handleConfirm() {
    if (isSubmitting) return;
    const trimmed = reason.trim();
    void onConfirm(trimmed.length > 0 ? trimmed : undefined);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-baerenstark-bark/50"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-baerenstark-sand bg-white p-6 shadow-card">
        <h2
          id={titleId}
          className="mb-2 text-xl font-semibold text-baerenstark-bark"
        >
          Anfrage stornieren?
        </h2>
        <p id={descId} className="mb-4 text-sm text-baerenstark-bark/85">
          Möchten Sie diese Anfrage wirklich stornieren? Diese Aktion kann nicht
          rückgängig gemacht werden.
        </p>

        <dl className="mb-4 rounded-lg border border-baerenstark-sand bg-baerenstark-cream/40 p-3 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="font-medium text-baerenstark-bark/70">Service:</dt>
            <dd className="text-baerenstark-bark">{serviceLabel}</dd>
          </div>
          {dateLabel && (
            <div className="mt-1 flex items-baseline gap-2">
              <dt className="font-medium text-baerenstark-bark/70">Datum:</dt>
              <dd className="text-baerenstark-bark">
                {dateLabel}
                {booking.startTime ? ` · ${booking.startTime} Uhr` : ''}
              </dd>
            </div>
          )}
        </dl>

        <div className="mb-4">
          <Textarea
            label="Grund (optional)"
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            placeholder="z.B. Termin verschiebt sich"
            hint={`${reason.length} / ${REASON_MAX}`}
          />
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            variant="ghost"
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            aria-disabled={isSubmitting || undefined}
          >
            {isSubmitting ? 'Wird storniert…' : 'Ja, stornieren'}
          </Button>
        </div>
      </div>
    </div>
  );
}
