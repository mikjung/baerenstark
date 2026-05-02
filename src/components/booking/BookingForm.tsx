'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ApiClientError, createBooking } from '@/lib/api-client';
import { formatSlotRange } from '@/lib/format';
import { CreateBookingSchema, type CreateBookingInput, type SlotPublic } from '@/lib/schemas';
import { SERVICE_LIST } from '@/lib/services';

type FormStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'conflict' }
  | { kind: 'rate-limited' }
  | { kind: 'error'; message: string };

interface BookingFormProps {
  selectedSlot: SlotPublic | null;
  onClearSlot: () => void;
  onSubmitted: () => void; // wird nach Erfolg getriggert (Slots neu laden)
}

const SERVICE_OPTIONS = SERVICE_LIST.map((s) => ({ value: s.slug, label: s.label }));

export function BookingForm({ selectedSlot, onClearSlot, onSubmitted }: BookingFormProps) {
  const [status, setStatus] = useState<FormStatus>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateBookingInput>({
    resolver: zodResolver(CreateBookingSchema),
    mode: 'onBlur',
    defaultValues: {
      slotId: selectedSlot?.id ?? '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      service: undefined,
      description: '',
      privacyAccepted: undefined as unknown as true,
    },
  });

  // slotId wird über hidden input mitgesendet (immer current selectedSlot.id)
  const slotIdValue = selectedSlot?.id ?? '';

  if (!selectedSlot) {
    return (
      <Banner tone="info" title="Bitte zuerst einen Termin auswählen">
        <p>
          Wähle oben ein freies Zeitfenster aus, um die Buchungsanfrage
          auszufüllen.
        </p>
      </Banner>
    );
  }

  if (status.kind === 'success') {
    return (
      <Banner tone="success" title="Anfrage erfolgreich gesendet" role="status">
        <p className="mb-3">
          Vielen Dank! Deine Anfrage ist eingegangen — Tom meldet sich zeitnah
          bei dir, um den Termin zu bestätigen.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setStatus({ kind: 'idle' });
            reset();
            onClearSlot();
          }}
        >
          Weitere Anfrage stellen
        </Button>
      </Banner>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setStatus({ kind: 'submitting' });
    try {
      // Sicherstellen, dass slotId der aktuell ausgewählte Slot ist
      const payload: CreateBookingInput = {
        ...values,
        slotId: selectedSlot.id,
        // Leere E-Mail wird vom Schema bereits zu undefined transformiert
      };
      await createBooking(payload);
      setStatus({ kind: 'success' });
      onSubmitted();
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'CONFLICT') {
          setStatus({ kind: 'conflict' });
          onSubmitted(); // Slots neu laden, der gewählte Slot ist nun "Belegt"
          return;
        }
        if (err.code === 'RATE_LIMITED') {
          setStatus({ kind: 'rate-limited' });
          return;
        }
        if (err.code === 'VALIDATION_ERROR' && err.field) {
          setError(err.field as keyof CreateBookingInput, {
            type: 'server',
            message: err.message,
          });
          setStatus({ kind: 'idle' });
          return;
        }
        setStatus({
          kind: 'error',
          message: err.message,
        });
        return;
      }
      setStatus({
        kind: 'error',
        message: 'Es ist ein unbekannter Fehler aufgetreten. Bitte erneut versuchen.',
      });
    }
  });

  const isBusy = isSubmitting || status.kind === 'submitting';

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={isBusy || undefined}
      className="rounded-2xl border border-baerenstark-sand bg-white/80 p-6 shadow-soft"
    >
      <div className="mb-5 rounded-lg border-l-4 border-baerenstark-wood bg-baerenstark-sand/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-baerenstark-wood">
          Gewähltes Zeitfenster
        </p>
        <p className="mt-1 font-serif text-lg font-semibold text-baerenstark-bark">
          {formatSlotRange(selectedSlot.startsAt, selectedSlot.endsAt)}
        </p>
        {selectedSlot.description && (
          <p className="text-sm text-baerenstark-bark/70">{selectedSlot.description}</p>
        )}
        <button
          type="button"
          onClick={onClearSlot}
          className="mt-2 text-sm text-baerenstark-wood underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
        >
          Anderen Termin wählen
        </button>
      </div>

      {status.kind === 'conflict' && (
        <div className="mb-5">
          <Banner tone="error" title="Zeitfenster nicht mehr verfügbar" role="alert">
            <p>
              Dieses Zeitfenster wurde gerade von jemand anderem gebucht. Bitte
              wähle einen anderen freien Termin aus der Liste.
            </p>
          </Banner>
        </div>
      )}

      {status.kind === 'rate-limited' && (
        <div className="mb-5">
          <Banner tone="warning" title="Zu viele Anfragen" role="alert">
            <p>
              Du hast in kurzer Zeit zu viele Anfragen gesendet. Bitte versuche
              es in ein paar Minuten erneut.
            </p>
          </Banner>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="mb-5">
          <Banner tone="error" title="Anfrage konnte nicht gesendet werden" role="alert">
            <p>{status.message}</p>
          </Banner>
        </div>
      )}

      <input type="hidden" value={slotIdValue} {...register('slotId')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          required
          autoComplete="name"
          placeholder="Maria Mustermann"
          error={errors.customerName?.message}
          {...register('customerName')}
        />
        <Input
          label="Telefon"
          required
          type="tel"
          autoComplete="tel"
          placeholder="0157 1234567"
          hint="Mind. 6 Ziffern. Erlaubt sind Ziffern, +, -, /, ( )"
          error={errors.customerPhone?.message}
          {...register('customerPhone')}
        />
        <Input
          label="E-Mail (optional)"
          type="email"
          autoComplete="email"
          placeholder="optional@example.com"
          hint="Optional, für eine spätere Bestätigung."
          error={errors.customerEmail?.message}
          {...register('customerEmail')}
        />
        <Select
          label="Service"
          required
          options={SERVICE_OPTIONS}
          placeholder="Bitte wählen"
          error={errors.service?.message}
          {...register('service')}
        />
      </div>

      <div className="mt-4">
        <Textarea
          label="Beschreibung"
          required
          rows={5}
          placeholder="Was muss gemacht werden? (z. B. Keller mit ca. 30 m³ entrümpeln)"
          error={errors.description?.message}
          {...register('description')}
        />
      </div>

      <div className="mt-5 rounded-lg border border-baerenstark-sand bg-baerenstark-cream/60 p-3">
        <label className="flex items-start gap-3 text-sm text-baerenstark-bark">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 cursor-pointer accent-baerenstark-wood"
            aria-required="true"
            aria-invalid={errors.privacyAccepted ? true : undefined}
            {...register('privacyAccepted')}
          />
          <span>
            Ich habe die{' '}
            <Link
              href="/datenschutz"
              className="text-baerenstark-wood underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener"
            >
              Datenschutzerklärung
            </Link>{' '}
            gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung
            der Anfrage zu. <span aria-hidden="true">*</span>
          </span>
        </label>
        {errors.privacyAccepted && (
          <p role="alert" className="mt-2 text-xs font-medium text-red-700">
            {errors.privacyAccepted.message}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => reset()}
          disabled={isBusy}
        >
          Zurücksetzen
        </Button>
        <Button type="submit" isLoading={isBusy}>
          Anfrage absenden
        </Button>
      </div>
    </form>
  );
}
