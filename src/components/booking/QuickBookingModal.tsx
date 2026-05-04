'use client';

/**
 * QuickBookingModal — IT10 (US-IT10-04) + IT11 (US-IT11-02 + 03 + 04 + 05).
 *
 * Modes:
 *   - `'embedded'` (Default, IT10): Slot kommt vom Parent (`/buchung`-Page),
 *     Modal zeigt nur das Form. Verhalten unverändert.
 *   - `'standalone'` (IT11): Modal rendert intern Service-Picker + Kalender +
 *     Slot-Picker + Form (Steps A–D in einer scrollbaren Liste). Wird vom
 *     `<BookingDialogProvider>` aus Header-/Hero-CTAs geöffnet.
 *
 * IT11-Verhalten:
 *   - **FileUpload** zwischen „Beschreibung" und „Datenschutz" — in beiden Modes.
 *   - **Submit-Block:** während Submit (`state.kind === 'submitting'`) ignoriert
 *     das Modal Escape und Backdrop-Click (Prop `closeOnEscape={false}` /
 *     `closeOnBackdrop={false}` am `<Modal>`).
 *   - **Erfolgs-Redirect:** nach `201 Created` ruft das Modal
 *     `useBookingDialog().reset()` auf (Form-Remount) UND macht
 *     `router.push('/buchung/bestaetigung/<id>?token=<jwt>')`.
 *   - **Fallback ohne Token:** wenn das Backend (noch) keinen
 *     `confirmationToken` zurückgibt, redirected das Modal trotzdem auf die
 *     Confirmation-Seite ohne Token-Param — die Server-Component fällt dann
 *     auf den Auth-Cookie-Pfad zurück (eingeloggte Kunden) ODER zeigt die
 *     `<TokenExpiredPage>`-UI mit Telefonnummer (Gäste).
 *   - **Erfolgs-Toast:** „Anfrage gesendet — Tom meldet sich innerhalb von
 *     24h" + Action-Button „Anrufen" mit `tel:`-Link.
 *   - **Profil-Banner:** wenn `showProfileAddressHint`, zeigt das Modal
 *     einen Hinweis-Banner mit Link zu `/konto/profil`.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { XIcon } from '@/components/ui/icons';
import { ApiClientError, createBooking } from '@/lib/api-client';
import { useScrollToSection } from '@/lib/scroll-to-section';
import {
  BookingFormSchema,
  CUSTOM_SERVICE_MIN_DESCRIPTION_LENGTH,
  type BookingFormInput,
  type CreateBookingInput,
} from '@/lib/schemas';
import { SERVICE_LIST, type Service } from '@/lib/services';
import { toast } from '@/lib/toast';
import { CONTACT } from '@/lib/contact';
import { BookingCalendar } from './BookingCalendar';
import { DurationPicker } from './DurationPicker';
import { TimeSlotPicker, type SelectedTimeSlot } from './TimeSlotPicker';
import { FileUpload } from './FileUpload';
import { BookingDialogContext } from './booking-dialog-context';

const SERVICE_OPTIONS = SERVICE_LIST.map((s) => ({ value: s.slug, label: s.label }));
const DEFAULT_DURATION_MINUTES = 120;

export interface QuickBookingPrefill {
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  addressStreet?: string | null;
  addressZip?: string | null;
  addressCity?: string | null;
}

type ModalMode = 'embedded' | 'standalone';

interface QuickBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * `'embedded'` (Default, IT10): Slot kommt vom Parent (`selectedTimeSlot`-
   * Prop ist Pflicht).
   * `'standalone'` (IT11): Modal verwaltet Datum / Dauer / Slot intern.
   */
  mode?: ModalMode;
  /** Pflicht im embedded-Mode. Im standalone-Mode wird er nicht durchgereicht. */
  selectedTimeSlot: SelectedTimeSlot | null;
  /** Wenn vom Trigger gesetzt, wird der Service vorausgewählt. */
  defaultService?: Service | null;
  /** Vorausfüllung aus eingeloggter Customer-Session. */
  defaultValues?: QuickBookingPrefill;
  /** Wird beim Klick auf „Anderen Slot wählen" aufgerufen (embedded-Mode). */
  onSlotChange?: () => void;
  /**
   * Wird nach erfolgreichem Submit aufgerufen — Parent kann Slot-Liste neu
   * laden oder weitere Side-Effects triggern. Im standalone-Mode rein optional.
   */
  onSubmitSuccess: (bookingId: string) => void;
  /**
   * IT11 / US-IT11-05 — Hinweis-Banner „Adresse im Profil hinterlegen"
   * anzeigen (Link zu `/konto/profil`).
   */
  showProfileAddressHint?: boolean;
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
  mode = 'embedded',
  selectedTimeSlot: externalTimeSlot,
  defaultService = null,
  defaultValues = {},
  onSlotChange,
  onSubmitSuccess,
  showProfileAddressHint = false,
}: QuickBookingModalProps) {
  const router = useRouter();
  const scrollToSection = useScrollToSection();
  // Direkt den Context lesen — wenn das Modal außerhalb des Providers
  // gerendert wird (Bestand-Pfad in `BookingClient.tsx`), ist `dialog === null`
  // und das `dialog?.reset()` ist ein No-Op.
  const dialog = useContext(BookingDialogContext);
  const [state, setState] = useState<ModalState>({ kind: 'idle' });
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  // Standalone-Mode: interner Slot-/Datum-/Dauer-State.
  const [internalDate, setInternalDate] = useState<string | null>(null);
  const [internalDuration, setInternalDuration] = useState<number | null>(null);
  const [internalTimeSlot, setInternalTimeSlot] = useState<SelectedTimeSlot | null>(
    null,
  );

  const isStandalone = mode === 'standalone';
  const selectedTimeSlot = isStandalone ? internalTimeSlot : externalTimeSlot;

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

  // Im Standalone-Mode: wenn ein Default-Service aus dem Trigger kommt, im
  // Service-Picker initial nutzen (DurationPicker-Preisschätzung).
  const watchedService = watch('service');
  const isCustomService = watchedService === 'sonstiges';
  const pickedServiceForPricing: Service | null = isService(watchedService)
    ? watchedService
    : isService(defaultService)
      ? defaultService
      : null;

  // Effektive Dauer im Standalone-Mode — sobald ein Tag gewählt, default 120.
  useEffect(() => {
    if (isStandalone && internalDate && internalDuration === null) {
      setInternalDuration(DEFAULT_DURATION_MINUTES);
    }
  }, [isStandalone, internalDate, internalDuration]);

  // Reset internen Slot-State, wenn Datum oder Dauer wechseln.
  useEffect(() => {
    setInternalTimeSlot(null);
  }, [internalDate, internalDuration]);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const isBusy = state.kind === 'submitting';

  function handleClose() {
    // Submit-Block: niemals während Submit schließen — `closeOnEscape` und
    // `closeOnBackdrop` am `<Modal>` sind ohnehin auf `false` gesetzt; der
    // Header-X-Button und der „Abbrechen"-Footer-Button sind disabled.
    if (isBusy) return;
    setState({ kind: 'idle' });
    setInternalDate(null);
    setInternalDuration(null);
    setInternalTimeSlot(null);
    setAttachmentIds([]);
    onClose();
  }

  function handleSlotChange() {
    setState({ kind: 'idle' });
    if (isStandalone) {
      setInternalTimeSlot(null);
      return;
    }
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
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
    };

    try {
      const res = await createBooking(payload);

      // IT11 / US-IT11-03 — Erfolgs-Toast mit Telefon-Action.
      toast.success(
        `Anfrage gesendet — Tom meldet sich innerhalb von 24h. Telefonisch erreichbar: ${CONTACT.phoneDisplay}`,
        {
          action: {
            label: 'Anrufen',
            onClick: () => {
              window.location.href = `tel:${CONTACT.phoneTel}`;
            },
          },
        },
      );

      // Form-State leeren BEVOR der Push passiert (sonst zeigt das Modal beim
      // nächsten Open noch alte Werte).
      reset();
      setAttachmentIds([]);
      setState({ kind: 'idle' });

      // Provider-Reset (frisches Modal beim nächsten Open) — siehe
      // ARCHITECTURE_IT11 §2.8.
      dialog?.reset();

      onSubmitSuccess(res.id);
      onClose();

      // Push auf die kanonische Bestätigungsseite (v3). Wenn das Backend
      // (noch) keinen Token zurückgibt, redirecten wir trotzdem — die Server-
      // Component fällt auf den Auth-Cookie-Pfad zurück oder rendert die
      // Token-Expired-UI für Gäste.
      const tokenQuery = res.confirmationToken
        ? `?token=${encodeURIComponent(res.confirmationToken)}&new=true`
        : '?new=true';
      router.push(`/buchung/bestaetigung/${encodeURIComponent(res.id)}${tokenQuery}`);
    } catch (err) {
      handleApiError(err);
    }
  });

  function handleApiError(err: unknown) {
    if (!(err instanceof ApiClientError)) {
      setState({
        kind: 'server-error',
        message: `Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: ${CONTACT.phoneDisplay}.`,
      });
      return;
    }

    const isSlotTaken =
      (err.status === 409 && err.subcode === 'BOOKING_SLOT_TAKEN') ||
      (err.status === 409 &&
        (err.code === 'CONFLICT' || err.code === 'OVERLAP') &&
        err.field === 'date');
    if (isSlotTaken) {
      setState({ kind: 'slot-taken' });
      return;
    }

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

    setState({
      kind: 'server-error',
      message: `Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: ${CONTACT.phoneDisplay}.`,
    });
  }

  const slotLabel = formatSlotHeader(selectedTimeSlot);
  const submitDisabled = isBusy || !watchedService || !selectedTimeSlot;

  return (
    <Modal
      isOpen={isOpen}
      // Submit-Block: Escape und Backdrop-Click ignorieren während Submit.
      onClose={handleClose}
      closeOnEscape={!isBusy}
      closeOnBackdrop={!isBusy}
      labelledBy="quick-booking-title"
      describedBy="quick-booking-slot-info"
    >
      {/* Sticky Header */}
      <header
        data-modal-header
        className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-modal border-b border-baerenstark-sand bg-baerenstark-cream p-4 shadow-soft sm:p-6"
      >
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
            {selectedTimeSlot
              ? slotLabel
              : isStandalone
                ? 'Wählen Sie unten Service, Tag und Zeitfenster.'
                : 'Bitte wählen Sie einen Slot im Kalender, bevor Sie die Anfrage absenden.'}
          </p>
          {selectedTimeSlot && (
            <button
              type="button"
              onClick={handleSlotChange}
              disabled={isBusy}
              aria-label="Anderen Slot wählen"
              className="mt-2 text-sm text-baerenstark-wood underline-offset-2 hover:underline disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
            >
              Anderen Slot wählen
            </button>
          )}
        </div>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={handleClose}
          disabled={isBusy}
          aria-label="Modal schließen"
          data-modal-close
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-baerenstark-bark hover:bg-baerenstark-sand/40 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
        >
          <XIcon size={20} />
        </button>
      </header>

      {/* Scrollable Body */}
      <form
        id="quick-booking-form"
        data-modal-body
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
        <fieldset
          data-section-anchor="modal-step-service"
          className="mb-5 scroll-mt-[var(--header-offset-modal)]"
        >
          <h3 tabIndex={-1} className="sr-only focus:outline-none">
            Welcher Service?
          </h3>
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

        {/* IT11 / US-IT11-02 — Standalone-Mode: Steps B (Kalender) + C
            (Dauer + TimeSlotPicker). */}
        {isStandalone && (
          <>
            <fieldset
              data-section-anchor="modal-step-when"
              className="mb-5 scroll-mt-[var(--header-offset-modal)]"
            >
              <h3 tabIndex={-1} className="sr-only focus:outline-none">
                Wann?
              </h3>
              <legend className="mb-2 font-serif text-sm font-semibold text-baerenstark-bark">
                Wann?
              </legend>
              <BookingCalendar
                selectedDate={internalDate}
                onSelectDay={(d) => {
                  setInternalDate(d);
                  // IT13-S03: Auto-Scroll zur nächsten Sektion
                  // (Modal-internes useScrollToSection — komfort-toleriert).
                  scrollToSection('modal-step-duration');
                }}
              />
            </fieldset>

            {internalDate && (
              <fieldset
                data-section-anchor="modal-step-duration"
                className="mb-5 scroll-mt-[var(--header-offset-modal)]"
              >
                <h3 tabIndex={-1} className="sr-only focus:outline-none">
                  Wie lange?
                </h3>
                <legend className="mb-2 font-serif text-sm font-semibold text-baerenstark-bark">
                  Wie lange?
                </legend>
                <DurationPicker
                  value={internalDuration}
                  onSelect={(m) => {
                    setInternalDuration(m);
                    scrollToSection('modal-step-time-slot');
                  }}
                  service={pickedServiceForPricing}
                />
              </fieldset>
            )}

            {internalDate && internalDuration !== null && (
              <fieldset
                data-section-anchor="modal-step-time-slot"
                className="mb-5 scroll-mt-[var(--header-offset-modal)]"
              >
                <h3 tabIndex={-1} className="sr-only focus:outline-none">
                  Welches Zeitfenster?
                </h3>
                <legend className="mb-2 font-serif text-sm font-semibold text-baerenstark-bark">
                  Welches Zeitfenster?
                </legend>
                <TimeSlotPicker
                  date={internalDate}
                  duration={internalDuration}
                  selectedSlot={internalTimeSlot}
                  onSelect={(slot) => {
                    setInternalTimeSlot(slot);
                    scrollToSection('modal-step-contact');
                  }}
                />
              </fieldset>
            )}
          </>
        )}

        {/* Profil-Adress-Hinweis (US-IT11-05). Vor dem Adressblock anzeigen. */}
        {showProfileAddressHint && (
          <div className="mb-5">
            <Banner tone="info" title="Tipp: Adresse im Profil hinterlegen">
              <p className="text-sm">
                Wenn Sie Ihre Adresse einmal in Ihrem{' '}
                <Link
                  href="/konto/profil#profile-section-address"
                  className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
                >
                  Profil
                </Link>{' '}
                hinterlegen, ist sie bei jeder Buchung automatisch
                vorausgefüllt.
              </p>
            </Banner>
          </div>
        )}

        {/* Kontaktdaten */}
        <fieldset
          data-section-anchor="modal-step-contact"
          className="mb-5 space-y-3 scroll-mt-[var(--header-offset-modal)]"
        >
          <h3 tabIndex={-1} className="sr-only focus:outline-none">
            Ihre Kontaktdaten
          </h3>
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
        <fieldset
          data-section-anchor="modal-step-address"
          className="mb-5 space-y-3 rounded-xl border border-baerenstark-sand/60 bg-baerenstark-cream/40 p-3 scroll-mt-[var(--header-offset-modal)]"
        >
          <h3 tabIndex={-1} className="sr-only focus:outline-none">
            Wohin sollen wir kommen?
          </h3>
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
        <fieldset
          data-section-anchor="modal-step-description"
          className="mb-5 scroll-mt-[var(--header-offset-modal)]"
        >
          <h3 tabIndex={-1} className="sr-only focus:outline-none">
            Worum geht es?
          </h3>
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

        {/* IT11 / US-IT11-04 — FileUpload zwischen Beschreibung und Datenschutz. */}
        <div className="mb-5">
          <FileUpload onAttachmentsChange={setAttachmentIds} />
        </div>

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

        {/* Live-Region für isDirty-Hinweis (subtil) + Submit-Status. */}
        <div role="status" aria-live="polite" className="sr-only">
          {isBusy
            ? 'Anfrage wird gesendet …'
            : isDirty && state.kind === 'idle'
              ? 'Eingaben werden gespeichert.'
              : ''}
        </div>
      </form>

      {/* Sticky Footer */}
      <footer
        className="sticky bottom-0 z-10 flex flex-col-reverse gap-2 rounded-b-modal border-t border-baerenstark-sand bg-baerenstark-cream p-4 sm:flex-row sm:justify-end sm:p-6"
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
            {isBusy ? 'Anfrage wird gesendet …' : 'Anfrage absenden'}
          </Button>
        )}
      </footer>
    </Modal>
  );
}

