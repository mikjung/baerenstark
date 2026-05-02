'use client';

/**
 * Iteration 3 — Buchungs-Client.
 *
 * Flow:
 *   1. Kunde wählt Tag im Kalender (US-16, vorhandener Calendar bleibt).
 *   2. Nach Tag-Auswahl lädt der TimeSlotPicker die verfügbaren Blöcke
 *      via GET /api/slots/available?date=... (US-17).
 *   3. Kunde wählt einen Block → BookingForm öffnet sich.
 *   4. Kunde füllt Formular aus, optional Datei-Upload (US-18), Submit
 *      schickt POST /api/bookings mit { date, startTime, endTime, ... }.
 *
 * Re-Booking-Modus (rebookToken in URL): Der alte Slot-basierte Flow wird
 * weiterhin unterstützt — der Calendar zeigt verfügbare Slots, BookingForm
 * geht in den Rebook-Modus.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookingForm } from '@/components/booking/BookingForm';
import { Calendar } from '@/components/booking/Calendar';
import { SlotList } from '@/components/booking/SlotList';
import { TimeSlotPicker, type SelectedTimeSlot } from '@/components/booking/TimeSlotPicker';
import { Banner } from '@/components/ui/Banner';
import {
  ApiClientError,
  fetchRebook,
  fetchSlots,
  type RebookInfoResponse,
} from '@/lib/api-client';
import type { SlotPublic } from '@/lib/schemas';

type LoadStatus = 'loading' | 'ready' | 'error';

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

export function BookingClient() {
  const params = useSearchParams();
  const rebookToken = params.get('rebookToken');
  const defaultService = params.get('service');

  const isRebookMode = Boolean(rebookToken);

  // === IT3-Modus: Datum + Zeit ===
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<SelectedTimeSlot | null>(null);

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
    // Sanft zur Slot-Liste scrollen
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
        <Calendar selectedDate={selectedDate} onSelectDay={handleDaySelect} />
      </section>

      <section aria-labelledby="slots-heading" id="slot-list-section">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="slots-heading"
            className="font-serif text-2xl font-semibold text-baerenstark-bark"
          >
            2. Wähle ein Zeitfenster
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

        {selectedDate && !isRebookMode && (
          <TimeSlotPicker
            date={selectedDate}
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
          3. {isRebookMode ? 'Neuen Termin bestätigen' : 'Deine Kontaktdaten'}
        </h2>
        <BookingForm
          selectedSlot={selectedLegacySlot}
          selectedTimeSlot={isRebookMode ? null : selectedTimeSlot}
          defaultService={defaultService}
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
