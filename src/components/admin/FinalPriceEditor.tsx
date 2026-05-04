'use client';

/**
 * FinalPriceEditor — Eingabefeld für den finalen Preis pro Buchung
 * (US-IT6-08 + US-IT14-S04 + US-IT14-S05).
 *
 * - Number-Input mit Komma als Dezimaltrenner (DE-Format).
 * - Optionales Notizfeld (`finalPriceNote`, max. 200 Zeichen).
 * - IT14-S05: drittes Feld „Zahlungsart" (Select, Werte 'CASH'/'BANK_TRANSFER',
 *   leer = NULL). Reihenfolge: Überweisung, Barzahlung.
 * - Submit via `PATCH /api/admin/bookings/:id`.
 * - IT14-S04: Save-Feedback. Toast (success, 4 s) + Inline-Chip „Gespeichert"
 *   (3 s, fadet aus). Server-Fehler → Toast (error, 5 s) + Banner.
 * - Inline-Validierung (0–100.000) und Fehlermeldung.
 *
 * Sichtbarkeit: ausschließlich im Admin-Frontend. Customer-API filtert
 * `finalPriceEur`/`finalPriceNote`/`paymentMethod` automatisch aus.
 */

import { useEffect, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CheckCircle2Icon } from '@/components/ui/icons';
import { ApiClientError } from '@/lib/api-client';
import { patchAdminBooking } from '@/lib/api-client-it6';
import {
  BOOKING_FINAL_PRICE_MAX_EUR,
  BOOKING_FINAL_PRICE_MIN_EUR,
  BOOKING_FINAL_PRICE_NOTE_MAX_LENGTH,
} from '@/lib/schemas';
import type { PaymentMethod } from '@/lib/schemas';
import { toast } from '@/lib/toast';

interface Props {
  bookingId: string;
  /** Decimal-String von Prisma ("185.00") oder null. */
  initialFinalPriceEur: string | null;
  initialFinalPriceNote: string | null;
  /** IT14-S05 — Zahlungsart, NULL = nicht erfasst. */
  initialPaymentMethod: PaymentMethod | null;
  /** Callback nach erfolgreichem Speichern, damit die Liste oben sich aktualisiert. */
  onSaved?: (
    finalPriceEur: string | null,
    finalPriceNote: string | null,
    paymentMethod: PaymentMethod | null,
  ) => void;
}

const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{
  value: PaymentMethod;
  label: string;
}> = [
  // Reihenfolge gemäß UX-Spec §4.3: Überweisung zuerst, Barzahlung zweitens.
  { value: 'BANK_TRANSFER', label: 'Überweisung' },
  { value: 'CASH', label: 'Barzahlung' },
];

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Überweisung',
  CASH: 'Barzahlung',
};

function formatEurInput(s: string | null): string {
  if (s === null || s === '') return '';
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function validate(input: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, value: null };
  // Erlaubt: nur Zahlen, ein Komma oder Punkt, optional negativ wäre invalid.
  if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) {
    return {
      ok: false,
      error: `Bitte einen gültigen Betrag in Euro eingeben (z.B. 150,00).`,
    };
  }
  const n = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(n) || n < BOOKING_FINAL_PRICE_MIN_EUR || n > BOOKING_FINAL_PRICE_MAX_EUR) {
    return {
      ok: false,
      error: `Bitte einen gültigen Betrag in Euro eingeben (${BOOKING_FINAL_PRICE_MIN_EUR}–${BOOKING_FINAL_PRICE_MAX_EUR}).`,
    };
  }
  return { ok: true, value: n };
}

export function FinalPriceEditor({
  bookingId,
  initialFinalPriceEur,
  initialFinalPriceNote,
  initialPaymentMethod,
  onSaved,
}: Props) {
  const [priceInput, setPriceInput] = useState(formatEurInput(initialFinalPriceEur));
  const [noteInput, setNoteInput] = useState(initialFinalPriceNote ?? '');
  const [paymentMethodInput, setPaymentMethodInput] = useState<
    PaymentMethod | ''
  >(initialPaymentMethod ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedChipVisible, setSavedChipVisible] = useState(false);

  // IT14-S04 — SaveFeedbackChip „Gespeichert" 3 s sichtbar, dann Fade-out.
  useEffect(() => {
    if (!savedChipVisible) return;
    const t = setTimeout(() => setSavedChipVisible(false), 3000);
    return () => clearTimeout(t);
  }, [savedChipVisible]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    setSavedChipVisible(false);
    const v = validate(priceInput);
    if (!v.ok) {
      setValidationError(v.error);
      return;
    }
    setValidationError(null);
    if (noteInput.length > BOOKING_FINAL_PRICE_NOTE_MAX_LENGTH) {
      setValidationError(
        `Notiz ist zu lang (max. ${BOOKING_FINAL_PRICE_NOTE_MAX_LENGTH} Zeichen).`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const nextPaymentMethod: PaymentMethod | null =
        paymentMethodInput === '' ? null : paymentMethodInput;
      const updated = await patchAdminBooking(bookingId, {
        finalPriceEur: v.value,
        finalPriceNote: noteInput.trim() === '' ? null : noteInput.trim(),
        paymentMethod: nextPaymentMethod,
      });
      // Backend liefert nach IT14 finalPriceEur/finalPriceNote im Patch-Response;
      // paymentMethod wird vom Client durchgereicht (Server-Wert ist identisch zum
      // Submit-Wert wenn der Save erfolgreich war).
      const updatedAny = updated as unknown as {
        finalPriceEur?: string | null;
        finalPriceNote?: string | null;
        paymentMethod?: PaymentMethod | null;
      };
      const persistedPrice = updatedAny.finalPriceEur ?? null;
      const persistedNote = updatedAny.finalPriceNote ?? null;
      const persistedMethod = updatedAny.paymentMethod ?? nextPaymentMethod;
      setPriceInput(formatEurInput(persistedPrice));
      setNoteInput(persistedNote ?? '');
      setPaymentMethodInput(persistedMethod ?? '');
      setSavedChipVisible(true);
      // Toast-Microcopy gemäß UX-Spec §3.2 / §4.4. Wenn Preis gesetzt:
      // „Preis gespeichert. Neuer Endpreis: 150,00 €."; sonst neutral.
      const priceLabel =
        persistedPrice != null
          ? `${Number(persistedPrice).toLocaleString('de-DE', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} €`
          : null;
      const methodLabel = persistedMethod
        ? PAYMENT_METHOD_LABEL[persistedMethod]
        : null;
      const parts: string[] = [];
      if (priceLabel) parts.push(`Endpreis: ${priceLabel}`);
      if (methodLabel) parts.push(`Zahlungsart: ${methodLabel}`);
      const detail = parts.length > 0 ? ` ${parts.join(' · ')}.` : '';
      toast.success(`Anfrage aktualisiert.${detail}`);
      onSaved?.(persistedPrice, persistedNote, persistedMethod ?? null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'VALIDATION_ERROR') {
          setValidationError(err.message);
        } else {
          setServerError(err.message);
          toast.error('Speichern fehlgeschlagen. Bitte erneut versuchen.');
        }
      } else {
        setServerError('Speichern fehlgeschlagen.');
        toast.error('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const paymentMethodSelectId = `final-payment-method-${bookingId}`;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-lg border border-baerenstark-sand bg-baerenstark-cream/30 p-3"
      aria-labelledby={`final-price-heading-${bookingId}`}
    >
      <h4
        id={`final-price-heading-${bookingId}`}
        className="text-xs font-semibold uppercase tracking-wide text-baerenstark-bark/70"
      >
        Finaler Preis (Admin-intern)
      </h4>
      <div className="mt-2 grid gap-3 sm:grid-cols-[180px_180px_1fr_auto] sm:items-end">
        <Input
          label="Endpreis (€)"
          type="text"
          inputMode="decimal"
          placeholder="0,00 €"
          autoComplete="off"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
          error={validationError ?? undefined}
        />
        <div className="flex flex-col gap-1">
          <label
            htmlFor={paymentMethodSelectId}
            className="text-sm font-medium text-baerenstark-bark"
          >
            Zahlungsart
          </label>
          <select
            id={paymentMethodSelectId}
            value={paymentMethodInput}
            onChange={(e) => {
              const raw = e.target.value;
              setPaymentMethodInput(raw === '' ? '' : (raw as PaymentMethod));
            }}
            disabled={submitting}
            className="h-11 w-full rounded-md border border-baerenstark-sand bg-white px-3 text-sm text-baerenstark-bark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
          >
            <option value="">— bitte wählen —</option>
            {PAYMENT_METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Notiz (optional)"
          type="text"
          maxLength={BOOKING_FINAL_PRICE_NOTE_MAX_LENGTH}
          placeholder="z.B. inkl. Anfahrt"
          autoComplete="off"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" isLoading={submitting}>
            Speichern
          </Button>
          {/*
            IT14-S04 — SaveFeedbackChip. role="status"+aria-live="polite",
            damit Screen-Reader das „Gespeichert" beim Erscheinen vorlesen.
            3 s sichtbar, dann opacity-Fadeout.
          */}
          <span
            role="status"
            aria-live="polite"
            className={[
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
              'border-feedback-success bg-feedback-success-bg text-feedback-success',
              'transition-opacity duration-200',
              savedChipVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
            ].join(' ')}
            aria-hidden={savedChipVisible ? undefined : true}
          >
            <CheckCircle2Icon size={14} />
            Gespeichert
          </span>
        </div>
      </div>
      {serverError && (
        <div className="mt-2">
          <Banner tone="error" role="alert">
            {serverError}
          </Banner>
        </div>
      )}
    </form>
  );
}
