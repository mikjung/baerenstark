'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookingForm } from '@/components/booking/BookingForm';
import { SlotList } from '@/components/booking/SlotList';
import { ApiClientError, fetchSlots } from '@/lib/api-client';
import type { SlotPublic } from '@/lib/schemas';

type LoadStatus = 'loading' | 'ready' | 'error';

export function BookingClient() {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [slots, setSlots] = useState<SlotPublic[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchSlots();
      setSlots(data);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unbekannter Fehler beim Laden der Termine.');
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Wenn der ausgewählte Slot durch ein Reload aus der Liste verschwindet
  // (z.B. weil er zwischenzeitlich gebucht oder gelöscht wurde), Auswahl leeren.
  useEffect(() => {
    if (!selectedSlotId) return;
    const stillAvailable = slots.find(
      (s) => s.id === selectedSlotId && !s.isBooked,
    );
    if (!stillAvailable) {
      setSelectedSlotId(null);
    }
  }, [slots, selectedSlotId]);

  const selectedSlot = selectedSlotId
    ? slots.find((s) => s.id === selectedSlotId) ?? null
    : null;

  return (
    <div className="space-y-10">
      <section aria-labelledby="slots-heading">
        <h2
          id="slots-heading"
          className="mb-4 font-serif text-2xl font-semibold text-baerenstark-bark"
        >
          1. Wähle ein Zeitfenster
        </h2>
        <SlotList
          status={status}
          slots={slots}
          selectedSlotId={selectedSlotId}
          errorMessage={errorMessage}
          onSelect={(slot) => {
            if (!slot.isBooked) {
              setSelectedSlotId(slot.id);
              // Sanft zur Form scrollen
              setTimeout(() => {
                document
                  .getElementById('booking-form-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 50);
            }
          }}
          onRetry={load}
        />
      </section>

      <section aria-labelledby="form-heading" id="booking-form-section">
        <h2
          id="form-heading"
          className="mb-4 font-serif text-2xl font-semibold text-baerenstark-bark"
        >
          2. Deine Kontaktdaten
        </h2>
        <BookingForm
          selectedSlot={selectedSlot}
          onClearSlot={() => setSelectedSlotId(null)}
          onSubmitted={() => {
            void load();
          }}
        />
      </section>
    </div>
  );
}
