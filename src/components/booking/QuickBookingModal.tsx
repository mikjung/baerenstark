'use client';

/**
 * QuickBookingModal — Iteration 10 / US-IT10-04.
 *
 * Spec:
 *   `project/design/ux/component-library-iteration-10.md` §1.
 *   `project/design/ux/ux-spec-iteration-10.md` §5.
 *   `ARCHITECTURE_IT10.md` §2.1 + §9.2.
 *
 * Verhalten (verbindlich):
 *   - Slot-Klick im Kalender öffnet das Modal IMMER, unabhängig davon, ob
 *     vorher ein Service ausgewählt wurde (Service ist Pflicht-Feld im Body,
 *     nicht mehr im Header).
 *   - Service ist Pflicht-Feld; Submit ist disabled, solange leer (zusätzlich
 *     zu allen anderen Pflichtfeld-Validierungen).
 *   - Bei `defaultService` wird der Service vorausgewählt.
 *   - Mobile: Bottom-Sheet. Desktop: zentriertes Modal.
 *   - Form-State persistiert über Open/Close (siehe Spec §5.7).
 *   - 409 + `subcode === 'BOOKING_SLOT_TAKEN'` (Fallback: code === 'CONFLICT'
 *     + field === 'date') → Slot-Belegt-Banner mit „Anderen Slot wählen"-CTA.
 *   - 5xx → freundliche Microcopy mit Telefon-CTA, NIE „Interner Serverfehler".
 *   - Erfolg → Modal schließt, Toast „Anfrage gesendet …".
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { XIcon } from '@/components/ui/icons';
import { ApiClientError, createBooking } from '@/lib/api-client';
import {
  BookingFormSchema,
  CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH,
  type BookingFormInput,
  type CreateBookingInput,
} from '@/lib/schemas';
import { SERVICE_LIST, type Service } from '@/lib/services';
import { toast } from '@/lib/toast';
import type { SelectedTimeSlot } from './TimeSlotPicker';

const SERVICE_OPTIONS = SERVICE_LIST.map((s) => ({ value: s.slug, label: s.label }));

export interface QuickBookingPrefill {
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  addressStreet?: string | null;
  addressZip?: string | null;
  addressCity?: string | null;
}

interface QuickBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Slot-Auswahl aus dem Kalender. Wird im Header angezeigt. */
  selectedTimeSlot: SelectedTimeSlot | null;
  /** Wenn vom Trigger gesetzt, wird der Service vorausgewählt. */
  defaultService?: Service | null;
  /** Vorausfüllung aus eingeloggter Customer-Session (US-IT10-05 Teil B). */
  defaultValues?: QuickBookingPrefill;
  /** Wird beim Klick auf „Anderen Slot wählen" aufgerufen (auch in slot-taken). */
  onSlotChange?: () => void;
  /** Wird nach erfolgreichem Submit aufgerufen — Parent kann Slot-Liste neuladen. */
  onSubmitSuccess: (bookingId: string) => void;
}

type ModalState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'validation-error' }
  | { kind: 'slot-taken' }
  | { kind: 'server-error'; message: string };

function isService(slug: string | null | undefined): slug is Service {
  if (!slug) return false;
  return SERVICE_LIST.some((s) => s.slug === slug);
}

function formatSlotHeader(slot: SelectedTimeSlot | null): string {
  if (!slot) return '';
  const [y, m, d] = slot.date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: 'long',
  });
  const dateLabel = Number.isNaN(dt.getTime()) ? slot.date : formatter.format(dt);
  return `${dateLabel} · ${slot.startTime} – ${slot.endTime}`;
}

export function QuickBookingModal({
  isOpen,
  onClose,
  selectedTimeSlot,
  defaultService = null,
  defaultValues = {},
  onSlotChange,
  onSubmitSuccess,
}: QuickBookingModalProps) {
  const [state, setState] = useState<ModalState>({ kind: 'idle' });

  const initialValues = useMemo<Partial<BookingFormInput>>(() => {
    return {
      customerName: defaultValues.customerName ?? '',
      customerPhone: defaultValues.customerPhone ?? '',
      customerEmail: defaultValues.customerEmail ?? '',
      service: isService(defaultService) ? defaultService : (undefined as unknown as Service),
      description: '',
      addressStreet: defaultValues.addressStreet ?? '',
      addressZip: defaultValues.addressZip ?? '',
      addressCity: defaultValues.addressCity ?? '',
      durationMinutes: selectedTimeSlot?.durationMinutes ?? 60,
      privacyAccepted: undefined as unknown as true,
    };
  }, [defaultService, defaultValues, selectedTimeSlot]);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<BookingFormInput>({
    resolver: zodResolver(BookingFormSchema),
    mode: 'onBlur',
    defaultValues: initialValues,
  });

  // Wenn das Modal geschlossen UND submit erfolgreich war, sollen wir den Form-State
  // resetten — aber nicht beim "Cancel" (Spec §5.7: Persistenz). Deshalb tun wir das
  // explizit nur in `handleSuccess` mit `reset(...)`. Beim Wechsel des Slots:
  // dauer-Update reicht — RHF behält die anderen Felder.
  useEffect(() => {
    if (selectedTimeSlot?.durationMinutes) {
      // durationMinutes ist im Form, aber nur intern — RHF braucht keinen `setValue`,
      // der Submit-Handler liest direkt aus `selectedTimeSlot`.
    }
  }, [selectedTimeSlot]);

  const watchedService = watch('service');
  const isCustomService = watchedService === 'sonstiges';

  const closeBtnRef = useRef<HTMLButtonElement>(null);

  function handleClose() {
    // Spec §5.2: Schließen bei dirty-State darf den Form-State NICHT clearen
    // (Persistenz). RHF behält die Eingaben automatisch, solange wir nicht
    // `reset()` aufrufen — wir ändern hier also nur den `state`.
    setState({ kind: 'idle' });
    onClose();
  }

  function handleSlotChange() {
    setState({ kind: 'idle' });
    onSlotChange?.();
    onClose();
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!selectedTimeSlot) {
      setState({
        kind: 'server-error',
        message:
          'Bitte wählen Sie zuerst einen Termin im Kalender, bevor Sie die Anfrage absenden.',
      });
      return;
    }

    setState({ kind: 'submitting' });

    const payload: CreateBookingInput = {
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      customerEmail: values.customerEmail,
      service: values.service,
      description: values.description,
      addressStreet: values.addressStreet,
      addressZip: values.addressZip,
      addressCity: values.addressCity,
      privacyAccepted: values.privacyAccepted,
      date: selectedTimeSlot.date,
      startTime: selectedTimeSlot.startTime,
      endTime: selectedTimeSlot.endTime,
      durationMinutes: selectedTimeSlot.durationMinutes,
    };

    try {
      const res = await createBooking(payload);
      // Erfolg — Form leeren, Modal schließen, Toast.
      reset();
      setState({ kind: 'idle' });
      toast.success('Anfrage gesendet. Wir melden uns innerhalb von 24 Stunden.');
      onSubmitSuccess(res.id);
      onClose();
    } catch (err) {
      handleApiError(err);
    }
  });

  function handleApiError(err: unknown) {
    if (!(err instanceof ApiClientError)) {
      setState({
        kind: 'server-error',
        message:
          'Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: 0157-74787512.',
      });
      return;
    }

    // IT10 / ARCHITECTURE_IT10 §9.1 — Slot-Belegt erkennen.
    const isSlotTaken =
      (err.status === 409 && err.subcode === 'BOOKING_SLOT_TAKEN') ||
      (err.status === 409 &&
        (err.code === 'CONFLICT' || err.code === 'OVERLAP') &&
        err.field === 'date');
    if (isSlotTaken) {
      setState({ kind: 'slot-taken' });
      return;
    }

    // Validation-Fehler mit `field`-Pfad → Inline am Feld.
    if ((err.status === 400 || err.status === 422) && err.code === 'VALIDATION_ERROR' && err.field) {
      const formField = err.field as keyof BookingFormInput;
      const allowed: ReadonlyArray<keyof BookingFormInput> = [
        'customerName',
        'customerPhone',
        'customerEmail',
        'service',
        'description',
        'addressStreet',
        'addressZip',
        'addressCity',
        'privacyAccepted',
      ];
      if ((allowed as readonly string[]).includes(formField)) {
        setError(formField, { type: 'server', message: err.message });
        setState({ kind: 'validation-error' });
        return;
      }
    }

    if (err.code === 'NETWORK_ERROR') {
      setState({
        kind: 'server-error',
        message:
          'Wir konnten den Server nicht erreichen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.',
      });
      return;
    }

    if (err.code === 'RATE_LIMITED') {
      setState({
        kind: 'server-error',
        message:
          'Zu viele Anfragen in kurzer Zeit. Bitte warten Sie einen Moment und versuchen Sie es erneut.',
      });
      return;
    }

    // 5xx oder unerwarteter Fehler — generische, freundliche Meldung mit Tel.
    setState({
      kind: 'server-error',
      message:
        'Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: 0157-74787512.',
    });
  }

  const slotLabel = formatSlotHeader(selectedTimeSlot);
  const isBusy = state.kind === 'submitting';
  const submitDisabled = isBusy || !watchedService;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      labelledBy="quick-booking-title"
      describedBy="quick-booking-slot-info"
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-modal border-b border-baerenstark-sand bg-baerenstark-cream p-4 shadow-soft sm:p-6">
        <div className="min-w-0">
          <h2
            id="quick-booking-title"
            className="font-serif text-lg font-semibold text-baerenstark-bark sm:text-xl"
          >
            Termin anfragen
          </h2>
          <p
            id="quick-booking-slot-info"
            className="mt-1 text-sm text-baerenstark-bark/80"
          >
            {slotLabel ||
              'Bitte wählen Sie einen Slot im Kalender, bevor Sie die Anfrage absenden.'}
          </p>
          {selectedTimeSlot && (
            <button
              type="button"
              onClick={handleSlotChange}
              aria-label="Anderen Slot wählen — Modal schließen"
              className="mt-2 text-sm text-baerenstark-wood underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
            >
              Anderen Slot wählen
            </button>
          )}
        </div>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={handleClose}
          aria-label="Modal schließen"
          data-modal-close
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-baerenstark-bark hover:bg-baerenstark-sand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
        >
          <XIcon size={20} />
        </button>
      </header>

      {/* Scrollable Body */}
      <form
        id="quick-booking-form"
        noValidate
        onSubmit={onSubmit}
        aria-busy={isBusy || undefined}
        className="flex-1 overflow-y-auto p-4 sm:p-6"
      >
        <p className="mb-4 text-xs text-baerenstark-bark/70">
          Mit <span aria-hidden="true">*</span> markierte Felder sind Pflicht.
        </p>

        {state.kind === 'validation-error' && (
          <div className="mb-4">
            <Banner tone="error" role="alert" title="Bitte prüfen Sie die markierten Felder.">
              <p>Einige Pflichtfelder sind nicht oder unvollständig ausgefüllt.</p>
            </Banner>
          </div>
        )}

        {state.kind === 'slot-taken' && (
          <div className="mb-4">
            <Banner
              tone="warning"
              role="alert"
              title="Termin nicht mehr verfügbar"
            >
              <p>
                Dieser Termin wurde inzwischen leider von jemand anderem
                gebucht. Bitte wählen Sie einen anderen Slot.
              </p>
            </Banner>
          </div>
        )}

        {state.kind === 'server-error' && (
          <div className="mb-4">
            <Banner tone="error" role="alert" title="Anfrage konnte nicht gesendet werden">
              <p>{state.message}</p>
            </Banner>
          </div>
        )}

        {/* Service-Pflicht-Feld (zuerst — STRUCT-4) */}
        <fieldset className="mb-5">
          <legend className="mb-2 font-serif text-sm font-semibold text-baerenstark-bark">
            Welcher Service?
          </legend>
          <Select
            label="Service"
            required
            options={SERVICE_OPTIONS}
            placeholder="Service auswählen…"
            error={errors.service?.message}
            {...register('service')}
          />
          {!watchedService && !errors.service && (
            <p className="mt-1 text-xs text-baerenstark-bark/70">
              Bitte wählen Sie einen Service aus.
            </p>
          )}
        </fieldset>

        {/* Kontaktdaten */}
        <fieldset className="mb-5 space-y-3">
          <legend className="mb-2 font-serif text-sm font-semibold text-baerenstark-bark">
            Ihre Kontaktdaten
          </legend>
          <Input
            label="Name"
            required
            autoComplete="name"
            placeholder="Maria Mustermann"
            error={errors.customerName?.message}
            {...register('customerName')}
          />
          <Input
            label="E-Mail-Adresse"
            required
            type="email"
            autoComplete="email"
            placeholder="maria@example.com"
            error={errors.customerEmail?.message}
            {...register('customerEmail')}
          />
          <Input
            label="Telefon"
            required
            type="tel"
            autoComplete="tel"
            placeholder="0157 1234567"
            hint="Mind. 6 Ziffern."
            error={errors.customerPhone?.message}
            {...register('customerPhone')}
          />
        </fieldset>

        {/* Adresse */}
        <fieldset className="mb-5 space-y-3 rounded-xl border border-baerenstark-sand/60 bg-baerenstark-cream/40 p-3">
          <legend className="mb-1 font-serif text-sm font-semibold text-baerenstark-bark">
            Wohin sollen wir kommen?
          </legend>
          <Input
            label="Straße und Hausnummer"
            required
            autoComplete="street-address"
            placeholder="Musterstraße 12"
            error={errors.addressStreet?.message}
            {...register('addressStreet')}
          />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Input
                label="PLZ"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                autoComplete="postal-code"
                placeholder="64283"
                error={errors.addressZip?.message}
                {...register('addressZip')}
              />
            </div>
            <div className="col-span-2">
              <Input
                label="Ort"
                required
                autoComplete="address-level2"
                placeholder="Darmstadt"
                error={errors.addressCity?.message}
                {...register('addressCity')}
              />
            </div>
          </div>
        </fieldset>

        {/* Anfragedetails */}
        <fieldset className="mb-5">
          <legend className="mb-2 font-serif text-sm font-semibold text-baerenstark-bark">
            Worum geht es?
          </legend>
          <Textarea
            label={isCustomService ? 'Beschreibe dein Anliegen' : 'Beschreibung'}
            required
            rows={isCustomService ? 5 : 4}
            placeholder={
              isCustomService
                ? 'Schildern Sie bitte ausführlich, worum es geht.'
                : 'Was muss gemacht werden? (z. B. Keller mit ca. 30 m³ entrümpeln)'
            }
            hint={
              isCustomService
                ? `Mind. ${CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH} Zeichen.`
                : undefined
            }
            error={errors.description?.message}
            {...register('description')}
          />
        </fieldset>

        {/* Datenschutz */}
        <div className="mb-2 rounded-lg border border-baerenstark-sand bg-baerenstark-cream/60 p-3">
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
                target="_blank"
                rel="noopener"
                className="text-baerenstark-wood underline-offset-2 hover:underline"
              >
                Datenschutzerklärung
              </Link>{' '}
              gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung
              der Anfrage zu. <span aria-hidden="true">*</span>
            </span>
          </label>
          {errors.privacyAccepted && (
            <p role="alert" className="mt-2 text-xs font-medium text-feedback-error">
              {errors.privacyAccepted.message}
            </p>
          )}
        </div>

        {/* Live-Region für isDirty-Hinweis (subtil) */}
        <div role="status" aria-live="polite" className="sr-only">
          {isDirty && state.kind === 'idle' ? 'Eingaben werden gespeichert.' : ''}
        </div>
      </form>

      {/* Sticky Footer */}
      <footer className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 rounded-b-modal border-t border-baerenstark-sand bg-baerenstark-cream p-4 sm:flex-row sm:justify-end sm:p-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <Button type="button" variant="ghost" onClick={handleClose} disabled={isBusy}>
          Abbrechen
        </Button>
        {state.kind === 'slot-taken' ? (
          <Button onClick={handleSlotChange}>Anderen Slot wählen</Button>
        ) : (
          <Button
            type="submit"
            form="quick-booking-form"
            isLoading={isBusy}
            disabled={submitDisabled}
            aria-disabled={submitDisabled || undefined}
          >
            {isBusy ? 'Wird gesendet…' : 'Anfrage absenden'}
          </Button>
        )}
      </footer>
    </Modal>
  );
}
