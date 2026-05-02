'use client';

/**
 * BookingForm — Iteration 3 (BUG IT3 Fix + Date/Time + Datei-Upload + Sonstiges).
 *
 * Wichtige Änderungen gegenüber IT2:
 *  - `slotId` / `date` / `startTime` / `endTime` sind NICHT mehr Teil des
 *    React-Hook-Form-Schemas. Stattdessen verwaltet der Parent (BookingClient)
 *    die Termin-Auswahl via Props (`selectedSlot` legacy ODER `selectedTimeSlot` IT3).
 *    Beim Submit wird der ausgewählte Termin programmatisch in den Payload gemergt.
 *    → Behebt BUG_BOOKING_IT3 (Hidden-Input + register-Konflikt).
 *  - `attachmentIds` werden über die FileUpload-Komponente (US-18) gesammelt.
 *  - Sonstiges-Service zwingt 30+ Zeichen Beschreibung (US-19).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { FileUpload } from './FileUpload';
import {
  ApiClientError,
  createBooking,
  rebookViaToken,
} from '@/lib/api-client';
import { formatSlotRange } from '@/lib/format';
import {
  BookingFormSchema,
  CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH,
  type BookingFormInput,
  type CreateBookingInput,
  type SlotPublic,
} from '@/lib/schemas';
import { SERVICE_LIST } from '@/lib/services';
import type { SelectedTimeSlot } from './TimeSlotPicker';

type FormStatus =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'rebook-success' }
  | { kind: 'conflict' }
  | { kind: 'rate-limited' }
  | { kind: 'gone' }
  | { kind: 'network' }
  | { kind: 'error'; message: string };

interface BookingFormProps {
  /** IT2-Bestand: legacy Slot. */
  selectedSlot: SlotPublic | null;
  /** IT3-Modus: Datum + Zeit. */
  selectedTimeSlot: SelectedTimeSlot | null;
  /** Default-Service aus dem URL-Parameter (?service=slug). Wird in das Form vorausgewählt. */
  defaultService?: string | null;
  onClearSelection: () => void;
  onSubmitted: () => void;
  rebookToken?: string | null;
}

const SERVICE_OPTIONS = SERVICE_LIST.map((s) => ({ value: s.slug, label: s.label }));

function isValidDefaultService(slug: string | null | undefined): slug is BookingFormInput['service'] {
  if (!slug) return false;
  return SERVICE_LIST.some((s) => s.slug === slug);
}

export function BookingForm({
  selectedSlot,
  selectedTimeSlot,
  defaultService,
  onClearSelection,
  onSubmitted,
  rebookToken = null,
}: BookingFormProps) {
  const [status, setStatus] = useState<FormStatus>({ kind: 'idle' });
  const [rebookSubmitting, setRebookSubmitting] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  const initialService = isValidDefaultService(defaultService) ? defaultService : undefined;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormInput>({
    resolver: zodResolver(BookingFormSchema),
    mode: 'onBlur',
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      service: initialService,
      description: '',
      privacyAccepted: undefined as unknown as true,
    },
  });

  const watchedService = watch('service');
  const isCustomService = watchedService === 'sonstiges';

  // Genau eine Selektion muss gesetzt sein.
  const hasSelection = Boolean(selectedSlot) || Boolean(selectedTimeSlot);

  if (!hasSelection) {
    return (
      <Banner tone="info" title="Bitte zuerst einen Termin auswählen">
        <p>
          Wähle oben einen Tag im Kalender und ein freies Zeitfenster aus, um die
          Buchungsanfrage auszufüllen.
        </p>
      </Banner>
    );
  }

  if (status.kind === 'success') {
    return (
      <Banner tone="success" title="Deine Anfrage wurde erfolgreich übermittelt!" role="status">
        <p className="mb-3">
          Vielen Dank! Tom meldet sich zeitnah bei dir, um den Termin zu
          bestätigen. Eine Eingangsbestätigung mit Storno-Link findest du in
          deiner E-Mail.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setStatus({ kind: 'idle' });
            reset();
            setAttachmentIds([]);
            onClearSelection();
          }}
        >
          Weitere Anfrage stellen
        </Button>
      </Banner>
    );
  }

  if (status.kind === 'rebook-success') {
    return (
      <Banner tone="success" title="Neuer Wunschtermin gespeichert" role="status">
        <p>
          Vielen Dank! Tom meldet sich zeitnah, sobald er den neuen Termin
          bestätigt hat.
        </p>
      </Banner>
    );
  }

  if (status.kind === 'gone') {
    return (
      <Banner tone="warning" title="Anfrage nicht mehr aktiv" role="alert">
        <p>
          Diese Anfrage ist nicht mehr aktiv — sie wurde bereits bestätigt oder
          storniert. Falls du einen neuen Termin suchst, starte einfach eine
          neue Anfrage.
        </p>
      </Banner>
    );
  }

  /**
   * Standard-Pfad: neue Buchung über POST /api/bookings.
   * Nutzt entweder IT3-Modus (date/startTime/endTime) ODER Bestand-Modus (slotId).
   */
  const onSubmitNewBooking = handleSubmit(async (values) => {
    setStatus({ kind: 'submitting' });

    // slotId/date/startTime/endTime werden HIER programmatisch in den Payload gemergt
    // (außerhalb von RHF — siehe BUG IT3-Fix).
    const slotInfo: Partial<CreateBookingInput> = selectedTimeSlot
      ? {
          date: selectedTimeSlot.date,
          startTime: selectedTimeSlot.startTime,
          endTime: selectedTimeSlot.endTime,
        }
      : selectedSlot
        ? { slotId: selectedSlot.id }
        : {};

    const payload: CreateBookingInput = {
      ...values,
      ...slotInfo,
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
    };

    // Debug-Hilfe (siehe BUG_BOOKING_IT3 Patch 5).
    if (process.env.NODE_ENV !== 'production') {
      console.log('[BookingForm] Submit payload:', payload);
    }

    try {
      await createBooking(payload);
      setStatus({ kind: 'success' });
      onSubmitted();
    } catch (err) {
      handleApiError(err);
    }
  });

  /** Re-Booking: nutzt POST /api/bookings/rebook ohne Form-Validierung. */
  async function onSubmitRebook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rebookToken || !selectedSlot) return;
    setRebookSubmitting(true);
    setStatus({ kind: 'submitting' });
    try {
      await rebookViaToken(rebookToken, selectedSlot.id);
      setStatus({ kind: 'rebook-success' });
      onSubmitted();
    } catch (err) {
      handleApiError(err);
    } finally {
      setRebookSubmitting(false);
    }
  }

  function handleApiError(err: unknown) {
    if (err instanceof ApiClientError) {
      if (err.code === 'NETWORK_ERROR') {
        setStatus({ kind: 'network' });
        return;
      }
      if (err.code === 'CONFLICT') {
        setStatus({ kind: 'conflict' });
        onSubmitted();
        return;
      }
      if (err.code === 'RATE_LIMITED') {
        setStatus({ kind: 'rate-limited' });
        return;
      }
      if (err.code === 'GONE') {
        setStatus({ kind: 'gone' });
        return;
      }
      if (err.code === 'VALIDATION_ERROR' && err.field) {
        // Nur Form-Felder können vom RHF gesetzt werden — Slot/Zeit-Felder
        // werden separat als Top-Level-Fehler angezeigt.
        const formField = err.field as keyof BookingFormInput;
        if (
          formField === 'customerName' ||
          formField === 'customerPhone' ||
          formField === 'customerEmail' ||
          formField === 'service' ||
          formField === 'description' ||
          formField === 'privacyAccepted'
        ) {
          setError(formField, {
            type: 'server',
            message: err.message,
          });
          setStatus({ kind: 'idle' });
          return;
        }
      }
      setStatus({ kind: 'error', message: err.message });
      return;
    }
    setStatus({
      kind: 'error',
      message:
        'Es ist ein unerwarteter Fehler aufgetreten. Bitte erneut versuchen oder direkt anrufen.',
    });
  }

  const isBusy = isSubmitting || rebookSubmitting || status.kind === 'submitting';

  // Anzeige-Text für gewählten Termin
  const selectionLabel = selectedTimeSlot
    ? formatTimeSlotLabel(selectedTimeSlot)
    : selectedSlot
      ? formatSlotRange(selectedSlot.startsAt, selectedSlot.endsAt)
      : '';

  const selectionDescription = selectedSlot?.description ?? null;

  return (
    <form
      onSubmit={rebookToken ? onSubmitRebook : onSubmitNewBooking}
      noValidate
      aria-busy={isBusy || undefined}
      className="rounded-2xl border border-baerenstark-sand bg-white/80 p-6 shadow-soft"
    >
      <div className="mb-5 rounded-lg border-l-4 border-baerenstark-wood bg-baerenstark-sand/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-baerenstark-wood">
          Gewählter Termin
        </p>
        <p className="mt-1 font-serif text-lg font-semibold text-baerenstark-bark">
          {selectionLabel}
        </p>
        {selectionDescription && (
          <p className="text-sm text-baerenstark-bark/70">{selectionDescription}</p>
        )}
        <button
          type="button"
          onClick={onClearSelection}
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

      {status.kind === 'network' && (
        <div className="mb-5">
          <Banner tone="error" title="Verbindung fehlgeschlagen" role="alert">
            <p>
              Wir konnten den Server nicht erreichen. Bitte prüfe deine
              Internetverbindung und versuche es erneut. Alternativ erreichst
              du uns direkt telefonisch.
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

      {rebookToken ? (
        <div className="mb-2">
          <Banner tone="info" title="Neuen Termin für deine Anfrage wählen">
            <p>
              Dein gewählter neuer Termin wird direkt an deine bestehende
              Anfrage angehängt. Tom meldet sich nach dem Absenden zur
              Bestätigung — deine Kontaktdaten sind bereits hinterlegt.
            </p>
          </Banner>
        </div>
      ) : (
        <>
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
              label="E-Mail-Adresse"
              required
              type="email"
              autoComplete="email"
              placeholder="maria@example.com"
              hint="Wir senden dir deinen Buchungsstatus per E-Mail (inkl. Storno-Link)."
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
              label={isCustomService ? 'Beschreibe dein Anliegen' : 'Beschreibung'}
              required
              rows={isCustomService ? 6 : 5}
              placeholder={
                isCustomService
                  ? 'Schildere bitte ausführlich, worum es geht — Tom kann so besser einschätzen, wie er dir hilft.'
                  : 'Was muss gemacht werden? (z. B. Keller mit ca. 30 m³ entrümpeln)'
              }
              hint={
                isCustomService
                  ? `Bitte beschreibe dein Anliegen ausführlich (mind. ${CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH} Zeichen).`
                  : undefined
              }
              error={errors.description?.message}
              {...register('description')}
            />
          </div>

          <div className="mt-5">
            <FileUpload onAttachmentsChange={setAttachmentIds} />
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
        </>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {!rebookToken && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              setAttachmentIds([]);
            }}
            disabled={isBusy}
          >
            Zurücksetzen
          </Button>
        )}
        <Button type="submit" isLoading={isBusy}>
          {rebookToken ? 'Neuen Termin senden' : 'Anfrage absenden'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Formatiert eine IT3-Zeit-Auswahl als
 * "Donnerstag, 15. Mai 2026 · 09:00 – 10:00 Uhr".
 */
function formatTimeSlotLabel(slot: SelectedTimeSlot): string {
  const [y, m, d] = slot.date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const dateLabel = Number.isNaN(dt.getTime()) ? slot.date : formatter.format(dt);
  return `${dateLabel} · ${slot.startTime} – ${slot.endTime} Uhr`;
}
