'use client';

/**
 * FinalPriceEditor — Eingabefeld für den finalen Preis pro Buchung
 * (US-IT6-08).
 *
 * - Number-Input mit Komma als Dezimaltrenner (DE-Format).
 * - Optionales Notizfeld (`finalPriceNote`, max. 200 Zeichen).
 * - Submit via `PATCH /api/admin/bookings/:id`.
 * - Inline-Validierung (0–100.000) und Fehlermeldung.
 *
 * Sichtbarkeit: ausschließlich im Admin-Frontend. Customer-API filtert
 * `finalPriceEur`/`finalPriceNote` automatisch aus.
 */

import { useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiClientError } from '@/lib/api-client';
import { patchAdminBooking } from '@/lib/api-client-it6';
import {
  BOOKING_FINAL_PRICE_MAX_EUR,
  BOOKING_FINAL_PRICE_MIN_EUR,
  BOOKING_FINAL_PRICE_NOTE_MAX_LENGTH,
} from '@/lib/schemas';

interface Props {
  bookingId: string;
  /** Decimal-String von Prisma ("185.00") oder null. */
  initialFinalPriceEur: string | null;
  initialFinalPriceNote: string | null;
  /** Callback nach erfolgreichem Speichern, damit die Liste oben sich aktualisiert. */
  onSaved?: (finalPriceEur: string | null, finalPriceNote: string | null) => void;
}

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
  onSaved,
}: Props) {
  const [priceInput, setPriceInput] = useState(formatEurInput(initialFinalPriceEur));
  const [noteInput, setNoteInput] = useState(initialFinalPriceNote ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedTick, setSavedTick] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    setSavedTick(null);
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
      const updated = await patchAdminBooking(bookingId, {
        finalPriceEur: v.value,
        finalPriceNote: noteInput.trim() === '' ? null : noteInput.trim(),
      });
      setSavedTick('Gespeichert.');
      setPriceInput(formatEurInput(updated.finalPriceEur));
      setNoteInput(updated.finalPriceNote ?? '');
      onSaved?.(updated.finalPriceEur, updated.finalPriceNote);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'VALIDATION_ERROR') {
          setValidationError(err.message);
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Speichern fehlgeschlagen.');
      }
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="mt-2 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
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
        <Input
          label="Notiz (optional)"
          type="text"
          maxLength={BOOKING_FINAL_PRICE_NOTE_MAX_LENGTH}
          placeholder="z.B. inkl. Anfahrt"
          autoComplete="off"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
        />
        <Button type="submit" size="sm" isLoading={submitting}>
          Speichern
        </Button>
      </div>
      {serverError && (
        <div className="mt-2">
          <Banner tone="error" role="alert">
            {serverError}
          </Banner>
        </div>
      )}
      {savedTick && (
        <div className="mt-2">
          <Banner tone="success" role="status">
            {savedTick}
          </Banner>
        </div>
      )}
    </form>
  );
}
