'use client';

/**
 * BookingForm — Iteration 5 (US-32 Adresse + US-33 Dauer).
 *
 * Wichtige Änderungen gegenüber IT3:
 *  - Drei neue Adress-Pflichtfelder (Straße, PLZ, Ort) im Schema und im UI.
 *  - `durationMinutes` wird programmatisch aus `selectedTimeSlot.durationMinutes`
 *    in den Payload gemergt (IT5 / US-33).
 *
 * Wichtige Änderungen gegenüber IT2 (unverändert seit IT3):
 *  - `slotId` / `date` / `startTime` / `endTime` sind NICHT mehr Teil des
 *    React-Hook-Form-Schemas. Stattdessen verwaltet der Parent (BookingClient)
 *    die Termin-Auswahl via Props (`selectedSlot` legacy ODER `selectedTimeSlot` IT5).
 *  - `attachmentIds` werden über die FileUpload-Komponente (US-18) gesammelt.
 *  - Sonstiges-Service zwingt 30+ Zeichen Beschreibung (US-19).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { FileUpload } from './FileUpload';
import {
  ApiClientError,
  createBooking,
  rebookViaToken,
} from '@/lib/api-client';
import { formatSlotRange } from '@/lib/format';
import { toast } from '@/lib/toast';
import { CONTACT } from '@/lib/contact';
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
  /** IT3+IT5-Modus: Datum + Zeit + Dauer. */
  selectedTimeSlot: SelectedTimeSlot | null;
  /** Default-Service aus dem URL-Parameter (?service=slug). Wird in das Form vorausgewählt. */
  defaultService?: string | null;
  /** Wird bei Service-Wechsel aufgerufen — der Parent kann die Preisschätzung im DurationPicker aktualisieren. */
  onServiceChange?: (slug: string | null) => void;
  onClearSelection: () => void;
  onSubmitted: () => void;
  rebookToken?: string | null;
  /**
   * IT9 / US-IT9-02 — Profil-Adress-Defaults. Wenn gesetzt, werden die drei
   * Adressfelder vorausgefüllt und der Kunde kann sie für diese Buchung noch
   * überschreiben (Stichwort: Auftrag bei den Eltern). Pflicht für
   * eingeloggte Kunden ist die Adresse hier wie bisher (Booking-Schema),
   * aber wenn der Customer schon eine Profil-Adresse hat, ist das Form
   * bereits ausgefüllt — kein erneutes Tippen.
   */
  profileAddress?: {
    streetAndNumber: string | null;
    postalCode: string | null;
    city: string | null;
  } | null;
  /** Hinweis-Banner anzeigen, wenn der Kunde eingeloggt ist und noch keine Profil-Adresse hat. */
  showProfileAddressHint?: boolean;
  /** E-Mail des eingeloggten Kunden für Vorausfüllung des E-Mail-Felds. */
  defaultEmail?: string | null;
  /** Default-Name (Vor- + Nachname) des eingeloggten Kunden. */
  defaultName?: string | null;
  /** Default-Telefon des eingeloggten Kunden. */
  defaultPhone?: string | null;
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
  onServiceChange,
  onClearSelection,
  onSubmitted,
  rebookToken = null,
  profileAddress = null,
  showProfileAddressHint = false,
  defaultEmail = null,
  defaultName = null,
  defaultPhone = null,
}: BookingFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<FormStatus>({ kind: 'idle' });
  const [rebookSubmitting, setRebookSubmitting] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  // IT10 / Spec §4.4 — Reset-Bestätigung gegen versehentliches Reset auf Mobile.
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

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
      // IT9 / US-IT9-02: Vorausfüllung aus dem eingeloggten Kunden-Profil.
      customerName: defaultName ?? '',
      customerPhone: defaultPhone ?? '',
      customerEmail: defaultEmail ?? '',
      service: initialService,
      description: '',
      // IT9 / US-IT9-02: Profil-Adresse mappt auf Booking-Adressfelder
      // (`profile.streetAndNumber → bookingForm.addressStreet`, etc.).
      // Naming-Drift zwischen Profil-Schema und Booking-Schema ist Architektur-
      // Vorgabe (siehe ARCHITECTURE_IT9.md §2.3 Naming-Hinweis): Profil-
      // Adresse = Default, Booking-Adresse = unveränderlicher Auftrags-
      // Snapshot.
      addressStreet: profileAddress?.streetAndNumber ?? '',
      addressZip: profileAddress?.postalCode ?? '',
      addressCity: profileAddress?.city ?? '',
      // IT5 / US-33: durationMinutes wird vom selectedTimeSlot gemergt,
      // ist aber im Form-Schema Pflicht — Default 60, wird beim Submit
      // mit dem aktuellen `selectedTimeSlot.durationMinutes` überschrieben.
      durationMinutes: 60,
      privacyAccepted: undefined as unknown as true,
    },
  });

  const watchedService = watch('service');
  const isCustomService = watchedService === 'sonstiges';

  // Service-Wechsel an den Parent kommunizieren (für Preis-Schätzung).
  useEffect(() => {
    onServiceChange?.(watchedService ?? null);
  }, [watchedService, onServiceChange]);

  // Genau eine Selektion muss gesetzt sein.
  const hasSelection = Boolean(selectedSlot) || Boolean(selectedTimeSlot);

  if (!hasSelection) {
    return (
      <Banner tone="info" title="Bitte zuerst einen Termin auswählen">
        <p>
          Wähle oben einen Tag im Kalender, eine Auftragsdauer und ein freies
          Zeitfenster aus, um die Buchungsanfrage auszufüllen.
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
   * Nutzt entweder IT3-Modus (date/startTime/endTime/durationMinutes) ODER
   * Bestand-Modus (slotId).
   */
  const onSubmitNewBooking = handleSubmit(async (values) => {
    setStatus({ kind: 'submitting' });

    // slotId/date/startTime/endTime/durationMinutes werden HIER programmatisch
    // in den Payload gemergt (außerhalb von RHF — siehe BUG IT3-Fix).
    const slotInfo: Partial<CreateBookingInput> = selectedTimeSlot
      ? {
          date: selectedTimeSlot.date,
          startTime: selectedTimeSlot.startTime,
          endTime: selectedTimeSlot.endTime,
          durationMinutes: selectedTimeSlot.durationMinutes,
        }
      : selectedSlot
        ? { slotId: selectedSlot.id }
        : {};

    const payload: CreateBookingInput = {
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      customerEmail: values.customerEmail,
      service: values.service,
      description: values.description,
      // IT5 / US-32: Adress-Pflicht im IT3/IT5-Modus.
      addressStreet: values.addressStreet,
      addressZip: values.addressZip,
      addressCity: values.addressCity,
      privacyAccepted: values.privacyAccepted,
      ...slotInfo,
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
    };

    // Debug-Hilfe (siehe BUG_BOOKING_IT3 Patch 5).
    if (process.env.NODE_ENV !== 'production') {
      console.log('[BookingForm] Submit payload:', payload);
    }

    try {
      const res = await createBooking(payload);
      // IT11 / US-IT11-03 — Erfolgs-Toast und Redirect zur Bestätigungsseite.
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
      setStatus({ kind: 'success' });
      onSubmitted();
      const tokenQuery = res.confirmationToken
        ? `?token=${encodeURIComponent(res.confirmationToken)}&new=true`
        : '?new=true';
      router.push(`/buchung/bestaetigung/${encodeURIComponent(res.id)}${tokenQuery}`);
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
      // IT10 / ARCHITECTURE_IT10 §9.1 (STRUCT-3) — Slot-Belegt-Erkennung primär
      // über `subcode`, Fallback über `code === 'CONFLICT'/'OVERLAP'` mit
      // `field === 'date'`.
      const isSlotTaken =
        err.subcode === 'BOOKING_SLOT_TAKEN' ||
        ((err.code === 'CONFLICT' || err.code === 'OVERLAP') && err.field === 'date');
      if (isSlotTaken) {
        setStatus({ kind: 'conflict' });
        onSubmitted();
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
          formField === 'addressStreet' ||
          formField === 'addressZip' ||
          formField === 'addressCity' ||
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
      // IT10 §1.2 / §4.2 — generische 4xx/5xx-Fehler bekommen die freundliche
      // Brand-Microcopy mit Telefon-CTA. Niemals „Interner Serverfehler".
      if (err.status >= 500 || err.code === 'INTERNAL_ERROR') {
        setStatus({
          kind: 'error',
          message:
            'Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: 0157-74787512.',
        });
        return;
      }
      setStatus({ kind: 'error', message: err.message });
      return;
    }
    setStatus({
      kind: 'error',
      message:
        'Wir konnten Ihre Anfrage gerade nicht speichern. Bitte versuchen Sie es erneut oder rufen Sie uns an: 0157-74787512.',
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
        {selectedTimeSlot && (
          <p className="text-sm text-baerenstark-bark/70">
            Auftragsdauer: {selectedTimeSlot.durationMinutes} Minuten
          </p>
        )}
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
          <Banner tone="warning" title="Termin nicht mehr verfügbar" role="alert">
            <p className="mb-3">
              Dieser Termin wurde inzwischen leider von jemand anderem gebucht.
              Bitte wählen Sie einen anderen Slot.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setStatus({ kind: 'idle' });
                onClearSelection();
              }}
            >
              Anderen Slot wählen
            </Button>
          </Banner>
        </div>
      )}

      {status.kind === 'rate-limited' && (
        <div className="mb-5">
          <Banner tone="warning" title="Zu viele Anfragen" role="alert">
            <p>
              Zu viele Anfragen in kurzer Zeit. Bitte warten Sie einen Moment
              und versuchen Sie es erneut.
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

          {/* IT9 / US-IT9-02 — Profil-Adress-Hinweis für eingeloggte Kunden
              ohne hinterlegte Adresse. */}
          {showProfileAddressHint && (
            <div className="mt-5">
              <Banner tone="info" title="Tipp: Adresse im Profil hinterlegen">
                <p className="text-sm">
                  Wenn du deine Adresse einmal in deinem{' '}
                  <Link
                    href="/konto/profil"
                    className="font-medium text-baerenstark-wood underline-offset-2 hover:underline"
                  >
                    Profil
                  </Link>{' '}
                  hinterlegst, ist sie bei jeder Buchung automatisch
                  vorausgefüllt.
                </p>
              </Banner>
            </div>
          )}

          {/* IT5 / US-32: Adresse des Auftragsorts */}
          <div className="mt-5 rounded-xl border border-baerenstark-sand/60 bg-baerenstark-cream/30 p-4 space-y-3">
            <p className="text-sm font-medium text-baerenstark-bark">
              <span aria-hidden="true">📍 </span>Adresse des Auftragsorts
              {profileAddress && (
                <span className="ml-2 inline-block rounded bg-baerenstark-cream/80 px-2 py-0.5 text-xs font-normal text-baerenstark-bark/70">
                  Aus deinem Profil — überschreibbar
                </span>
              )}
            </p>
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
            onClick={() => setResetConfirmOpen(true)}
            disabled={isBusy}
          >
            Zurücksetzen
          </Button>
        )}
        <Button type="submit" isLoading={isBusy}>
          {rebookToken ? 'Neuen Termin senden' : 'Anfrage absenden'}
        </Button>
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Möchten Sie alle Eingaben verwerfen?"
        description="Bereits eingetragene Felder gehen verloren — Datum und Slot bleiben erhalten."
        confirmLabel="Ja, zurücksetzen"
        cancelLabel="Abbrechen"
        variant="danger"
        onConfirm={() => {
          reset();
          setAttachmentIds([]);
          setResetConfirmOpen(false);
        }}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </form>
  );
}

/**
 * Formatiert eine IT3/IT5-Zeit-Auswahl als
 * "Donnerstag, 15. Mai 2026 · 09:00 – 11:00 Uhr".
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
