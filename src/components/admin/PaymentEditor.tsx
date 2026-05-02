'use client';

/**
 * PaymentEditor — Inline-Bearbeitung der Zahlungsanforderung im Admin-Bereich
 * (US-28 AC1).
 *
 * Tom gibt einen Betrag in Euro ein → Frontend rechnet `Math.round(€ * 100)`
 * in Cent um → POST `/api/admin/bookings/:id/payment`.
 * Bei bestehender Pending-Payment kann er via DELETE die Zahlung
 * zurücksetzen (z.B. nach Tippfehler).
 *
 * Kann inline in einer Booking-Karte verwendet werden — UI ist kompakt
 * und kollabierbar.
 */

import { useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  ApiClientError,
  createPaymentRequest,
  deletePaymentRequest,
} from '@/lib/api-client';
import { formatCentsAsEuro } from '@/lib/customer-portal';
import type { Payment, PaymentStatus } from '@/lib/schemas';

/**
 * Eingebettetes Payment-Mini-Modell — die `BookingAdminSchema.payment`-Form
 * enthält nicht alle Felder von `PaymentSchema` (kein bookingId/updatedAt),
 * deshalb akzeptieren wir hier eine Untermenge.
 */
export interface InlinePayment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  paidAt: string | null;
  stripeSessionId: string | null;
  createdAt: string;
}

interface PaymentEditorProps {
  bookingId: string;
  initialPayment: InlinePayment | null;
  onChange?: (payment: Payment | null) => void;
}

export function PaymentEditor({
  bookingId,
  initialPayment,
  onChange,
}: PaymentEditorProps) {
  const [payment, setPayment] = useState<InlinePayment | null>(initialPayment);
  const [editing, setEditing] = useState(false);
  const [amountEuro, setAmountEuro] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSave = async () => {
    setError(null);
    setSuccess(null);
    const num = Number.parseFloat(amountEuro.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) {
      setError('Bitte einen gültigen Betrag in Euro eingeben.');
      return;
    }
    const cents = Math.round(num * 100);
    if (cents < 100) {
      setError('Mindestbetrag ist 1,00 €.');
      return;
    }
    if (cents > 1_000_000) {
      setError('Höchstbetrag ist 10.000 €.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createPaymentRequest(bookingId, {
        amount: cents,
        currency: 'eur',
        description: description.trim() ? description.trim() : undefined,
      });
      setPayment(created);
      setEditing(false);
      setAmountEuro('');
      setDescription('');
      setSuccess('Zahlbetrag hinterlegt. Kunde erhält jetzt eine E-Mail.');
      onChange?.(created);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setError(err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError('Speichern fehlgeschlagen. Bitte erneut versuchen.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!payment) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await deletePaymentRequest(bookingId);
      setPayment(null);
      setSuccess('Zahlung zurückgezogen.');
      onChange?.(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Löschen fehlgeschlagen.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (payment) {
    const isPaid = payment.status === 'PAID';
    return (
      <div className="rounded-lg border border-baerenstark-sand bg-baerenstark-cream/40 p-3">
        <p className="mb-1 text-sm">
          <strong className="text-baerenstark-bark">Zahlung:</strong>{' '}
          {formatCentsAsEuro(payment.amount)}{' '}
          <span className="text-baerenstark-bark/70">
            (
            {payment.status === 'PAID'
              ? 'Bezahlt'
              : payment.status === 'PENDING'
                ? 'Ausstehend'
                : payment.status === 'FAILED'
                  ? 'Fehlgeschlagen'
                  : 'Zurückerstattet'}
            )
          </span>
        </p>
        {payment.description && (
          <p className="mb-2 text-xs text-baerenstark-bark/70">
            {payment.description}
          </p>
        )}
        {success && (
          <div className="mb-2">
            <Banner tone="success" role="status">
              {success}
            </Banner>
          </div>
        )}
        {error && (
          <div className="mb-2">
            <Banner tone="error" role="alert">
              {error}
            </Banner>
          </div>
        )}
        {!isPaid && payment.status === 'PENDING' && (
          <Button variant="ghost" size="sm" onClick={onDelete} isLoading={submitting}>
            Zahlung zurückziehen
          </Button>
        )}
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="rounded-lg border border-baerenstark-sand bg-baerenstark-cream/30 p-3">
        {success && (
          <div className="mb-2">
            <Banner tone="success" role="status">
              {success}
            </Banner>
          </div>
        )}
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          Zahlbetrag hinterlegen
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-baerenstark-sand bg-baerenstark-cream/30 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Betrag in Euro"
          type="text"
          inputMode="decimal"
          required
          value={amountEuro}
          onChange={(e) => setAmountEuro(e.currentTarget.value)}
          placeholder="z.B. 140,00"
          hint="Min. 1,00 €, max. 10.000,00 €"
        />
        <Input
          label="Beschreibung (optional)"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          placeholder="z.B. Entrümpelung Keller, 4 Std."
        />
      </div>
      {error && (
        <div className="mt-2">
          <Banner tone="error" role="alert">
            {error}
          </Banner>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onSave} isLoading={submitting}>
          Speichern & Mail senden
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setAmountEuro('');
            setDescription('');
            setError(null);
          }}
          disabled={submitting}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
