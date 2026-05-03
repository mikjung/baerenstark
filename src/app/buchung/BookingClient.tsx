'use client';

/**
 * Iteration 5 — Buchungs-Client (US-32 Adresse, US-33 Dauer).
 *
 * Flow:
 *   1. Kunde wählt Tag im Kalender (US-16, vorhandener Calendar bleibt).
 *   2. Kunde wählt Auftragsdauer (DurationPicker, IT5 / US-33).
 *   3. TimeSlotPicker lädt verfügbare Blöcke der gewählten Dauer
 *      (`/api/slots/available?date=...&duration=...`).
 *   4. Kunde wählt einen Block → BookingForm (Adresse + Daten).
 *   5. POST /api/bookings sendet
 *      `{ date, startTime, endTime, durationMinutes, addressStreet, ... }`.
 *
 * Re-Booking-Modus (rebookToken in URL): Slot-basierte IT2-Logik bleibt.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookingForm } from '@/components/booking/BookingForm';
import { Calendar } from '@/components/booking/Calendar';
import { BookingCalendar } from '@/components/booking/BookingCalendar';
import { SlotList } from '@/components/booking/SlotList';
import {
  TimeSlotPicker,
  type SelectedTimeSlot,
} from '@/components/booking/TimeSlotPicker';
import { DurationPicker } from '@/components/booking/DurationPicker';
import { Banner } from '@/components/ui/Banner';
import {
  ApiClientError,
  fetchRebook,
  fetchSlots,
  type RebookInfoResponse,
} from '@/lib/api-client';
import type { SlotPublic } from '@/lib/schemas';
import { SERVICE_LIST, type Service } from '@/lib/services';

type LoadStatus = 'loading' | 'ready' | 'error';

/** Default-Dauer wenn der Kunde noch nichts gewählt hat. */
const DEFAULT_DURATION_MINUTES = 120;

/**
 * Liefert YYYY-MM-DD eines Slot-Starts in Europe/Berlin (Re-Booking-Filter).
 */
function slotDateInBerlin(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function isService(slug: string | null): slug is Service {
  if (!slug) return false;
  return SERVICE_LIST.some((s) => s.slug === slug);
}

export function BookingClient() {
  const params = useSearchParams();
  const rebookToken = params.get('rebookToken');
  const defaultService = params.get('service');

  const isRebookMode = Boolean(rebookToken);

  // === IT3-Modus: Datum + Zeit ===
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<SelectedTimeSlot | null>(null);

  // === IT5: Dauer-Auswahl ===
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);

  // === IT5: Service (für Preis-Schätzung im DurationPicker) ===
  const initialService: Service | null = isService(defaultService) ? defaultService : null;
  const [pickedService, setPickedService] = useState<Service | null>(initialService);

  // === Bestand: Slot-basiert (für Re-Booking) ===
  const [legacyStatus, setLegacyStatus] = useState<LoadStatus>('ready');
  const [legacySlots, setLegacySlots] = useState<SlotPublic[]>([]);
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Re-Booking-Info-Banner
  const [rebookInfo, setRebookInfo] = useState<RebookInfoResponse | null>(null);
  const [rebookStatus, setRebookStatus] = useState<
    'idle' | 'loading' | 'ready' | 'gone' | 'error'
  >('idle');

  // ----- Legacy Slots laden (nur im Re-Booking-Modus) -----
  const loadLegacySlots = useCallback(async () => {
    setLegacyStatus('loading');
    setLegacyError(null);
    try {
      const data = await fetchSlots();
      setLegacySlots(data);
      setLegacyStatus('ready');
    } catch (err) {
      setLegacyStatus('error');
      if (err instanceof ApiClientError) {
        setLegacyError(err.message);
      } else {
        setLegacyError('Unbekannter Fehler beim Laden der Termine.');
      }
    }
  }, []);

  useEffect(() => {
    if (isRebookMode) {
      void loadLegacySlots();
    }
  }, [isRebookMode, loadLegacySlots]);

  // ----- Re-Booking-Info-Banner -----
  useEffect(() => {
    if (!rebookToken) {
      setRebookStatus('idle');
      setRebookInfo(null);
      return;
    }
    let cancelled = false;
    setRebookStatus('loading');
    fetchRebook(rebookToken)
      .then((info) => {
        if (cancelled) return;
        setRebookInfo(info);
        setRebookStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (
          err instanceof ApiClientError &&
          (err.code === 'GONE' || err.code === 'NOT_FOUND')
        ) {
          setRebookStatus('gone');
          return;
        }
        setRebookStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [rebookToken]);

  // Wenn der ausgewählte Legacy-Slot durch ein Reload aus der Liste verschwindet, leeren.
  useEffect(() => {
    if (!selectedSlotId) return;
    const stillAvailable = legacySlots.find(
      (s) => s.id === selectedSlotId && !s.isBooked,
    );
    if (!stillAvailable) {
      setSelectedSlotId(null);
    }
  }, [legacySlots, selectedSlotId]);

  const selectedLegacySlot = selectedSlotId
    ? legacySlots.find((s) => s.id === selectedSlotId) ?? null
    : null;

  // Legacy-Slots nach Tag filtern
  const visibleLegacySlots = useMemo(() => {
    if (!selectedDate) return legacySlots;
    return legacySlots.filter((s) => slotDateInBerlin(s.startsAt) === selectedDate);
  }, [legacySlots, selectedDate]);

  function handleDaySelect(date: string) {
    setSelectedDate(date);
    // Wenn der gewählte Tag wechselt, Zeit-Slot-Auswahl resetten.
    if (selectedTimeSlot && selectedTimeSlot.date !== date) {
      setSelectedTimeSlot(null);
    }
    // Sanft zur Dauer-Sektion scrollen
    setTimeout(() => {
      document
        .getElementById('duration-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function handleDurationSelect(minutes: number) {
    setDurationMinutes(minutes);
    // Wenn der Kunde die Dauer wechselt, den bisher gewählten Zeitslot fallen lassen
    // (der gehört zur alten Dauer und ist nicht mehr gültig).
    setSelectedTimeSlot(null);
    setTimeout(() => {
      document
        .getElementById('slot-list-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function handleTimeSlotSelect(slot: SelectedTimeSlot) {
    setSelectedTimeSlot(slot);
    setTimeout(() => {
      document
        .getElementById('booking-form-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  // Im Re-Booking-Modus brauchen wir keine Dauer-Auswahl (Slot enthält die Zeit).
  const showDurationPicker = !isRebookMode;
  const showTimeSlotPicker = !isRebookMode;

  // Der Default für die Dauer wird gesetzt, sobald ein Tag gewählt ist —
  // das vermeidet eine "leere" Dauer im Picker.
  useEffect(() => {
    if (!isRebookMode && selectedDate && durationMinutes == null) {
      setDurationMinutes(DEFAULT_DURATION_MINUTES);
    }
  }, [selectedDate, durationMinutes, isRebookMode]);

  return (
    <div className="space-y-10">
      {isRebookMode && rebookStatus === 'gone' && (
        <Banner tone="warning" title="Anfrage nicht mehr aktiv" role="alert">
          <p>
            Diese Anfrage ist nicht mehr aktiv (z.B. bereits bestätigt oder
            storniert). Du kannst direkt eine neue Anfrage starten — wähle dazu
            unten ein Zeitfenster.
          </p>
        </Banner>
      )}

      {isRebookMode && rebookStatus !== 'gone' && (
        <Banner tone="info" title="Du wählst einen neuen Termin für deine Anfrage">
          <p>
            {rebookInfo
              ? `Hallo ${rebookInfo.customerName} — wähle unten einen passenden Termin. Tom meldet sich nach dem Absenden zur Bestätigung.`
              : 'Wähle unten einen passenden Termin für deine bestehende Anfrage. Tom meldet sich nach dem Absenden zur Bestätigung.'}
          </p>
        </Banner>
      )}

      {defaultService && !isRebookMode && (
        <Banner tone="info" title="Service vorausgewählt" role="status">
          <p>
            Der Service ist bereits im Formular ausgewählt — du kannst ihn
            unten jederzeit ändern.
          </p>
        </Banner>
      )}

      <section aria-labelledby="calendar-heading">
        <h2
          id="calendar-heading"
          className="mb-4 font-serif text-2xl font-semibold text-baerenstark-bark"
        >
          1. Wähle einen Tag
        </h2>
        {isRebookMode ? (
          <Calendar selectedDate={selectedDate} onSelectDay={handleDaySelect} />
        ) : (
          <BookingCalendar
            selectedDate={selectedDate}
            onSelectDay={handleDaySelect}
          />
        )}
      </section>

      {showDurationPicker && (
        <section
          aria-labelledby="duration-heading"
          id="duration-section"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="duration-heading"
              className="font-serif text-2xl font-semibold text-baerenstark-bark"
            >
              2. Wähle die Auftragsdauer
            </h2>
          </div>
          {!selectedDate ? (
            <Banner tone="info">
              <p>
                Bitte wähle zuerst einen Tag im Kalender, bevor du die
                Auftragsdauer festlegst.
              </p>
            </Banner>
          ) : (
            <DurationPicker
              value={durationMinutes}
              onSelect={handleDurationSelect}
              service={pickedService}
            />
          )}
        </section>
      )}

      <section aria-labelledby="slots-heading" id="slot-list-section">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="slots-heading"
            className="font-serif text-2xl font-semibold text-baerenstark-bark"
          >
            {isRebookMode ? '2. Wähle ein Zeitfenster' : '3. Wähle ein Zeitfenster'}
          </h2>
          {selectedDate && (
            <button
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setSelectedTimeSlot(null);
              }}
              className="text-sm text-baerenstark-wood underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent"
            >
              Zurück zur Tagesauswahl
            </button>
          )}
        </div>

        {!selectedDate && (
          <Banner tone="info">
            <p>
              Bitte wähle oben zuerst einen Tag im Kalender — dann erscheinen
              die freien Zeitfenster.
            </p>
          </Banner>
        )}

        {selectedDate && showTimeSlotPicker && (
          <TimeSlotPicker
            date={selectedDate}
            duration={durationMinutes}
            selectedSlot={selectedTimeSlot}
            onSelect={handleTimeSlotSelect}
          />
        )}

        {selectedDate && isRebookMode && (
          <SlotList
            status={legacyStatus}
            slots={visibleLegacySlots}
            selectedSlotId={selectedSlotId}
            errorMessage={legacyError}
            onSelect={(slot) => {
              if (!slot.isBooked) {
                setSelectedSlotId(slot.id);
                setTimeout(() => {
                  document
                    .getElementById('booking-form-section')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
              }
            }}
            onRetry={loadLegacySlots}
          />
        )}
      </section>

      <section aria-labelledby="form-heading" id="booking-form-section">
        <h2
          id="form-heading"
          className="mb-4 font-serif text-2xl font-semibold text-baerenstark-bark"
        >
          {isRebookMode
            ? '3. Neuen Termin bestätigen'
            : '4. Deine Kontaktdaten'}
        </h2>
        <BookingForm
          selectedSlot={selectedLegacySlot}
          selectedTimeSlot={isRebookMode ? null : selectedTimeSlot}
          defaultService={defaultService}
          onServiceChange={(slug) => setPickedService(isService(slug) ? slug : null)}
          onClearSelection={() => {
            setSelectedSlotId(null);
            setSelectedTimeSlot(null);
          }}
          rebookToken={isRebookMode ? rebookToken : null}
          onSubmitted={() => {
            if (isRebookMode) {
              void loadLegacySlots();
            } else if (selectedDate) {
              // Force reload des TimeSlotPickers durch kurzes "Wackeln" am Datum.
              const d = selectedDate;
              setSelectedDate(null);
              setTimeout(() => setSelectedDate(d), 0);
              setSelectedTimeSlot(null);
            }
          }}
        />
      </section>
    </div>
  );
}
