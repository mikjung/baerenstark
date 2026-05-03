'use client';

/**
 * DurationPicker — Iteration 5 (US-33).
 *
 * Kachel-Auswahl für die gewünschte Auftragsdauer. Wird VOR dem
 * Zeitslot-Picker angezeigt — der TimeSlotPicker lädt erst dann die
 * verfügbaren Slots, wenn eine Dauer gewählt ist.
 *
 * Optionen-Quelle: `BOOKING_DURATION_OPTIONS` aus dem Vertrag (Single
 * Source of Truth). Pro Kachel zeigen wir Stunden-Label, Hint-Text und
 * eine Preisschätzung basierend auf `priceFrom * durationHours` (Min)
 * bis `priceFrom * durationHours * 2` (Max). Bei Service `'sonstiges'`
 * (priceFrom: null) → "Auf Anfrage".
 *
 * Mobile-first: 2 Spalten <640px, 3 Spalten ≥640px. Volle
 * Tastatur-Bedienung (Radiogroup-ARIA).
 */

import { BOOKING_DURATION_OPTIONS } from '@/lib/schemas';
import { getServiceInfo, type Service } from '@/lib/services';

interface DurationOptionMeta {
  minutes: number;
  label: string;
  hint: string;
}

const DURATION_META: ReadonlyArray<DurationOptionMeta> = [
  { minutes: 60, label: '1 Stunde', hint: 'Kleiner Auftrag' },
  { minutes: 120, label: '2 Stunden', hint: 'Standard' },
  { minutes: 180, label: '3 Stunden', hint: 'Mittlerer Auftrag' },
  { minutes: 240, label: '4 Stunden', hint: 'Halber Tag' },
  { minutes: 300, label: '5 Stunden', hint: 'Großer Auftrag' },
  { minutes: 360, label: '6 Stunden', hint: 'Großer Auftrag' },
  { minutes: 480, label: '8 Stunden', hint: 'Ganztag' },
];

const PRICE_RANGE_FACTOR_MAX = 2; // siehe ARCHITECTURE.md §18.4.3

interface DurationPickerProps {
  /** Aktuell gewählte Dauer in Minuten (oder null wenn keine Auswahl). */
  value: number | null;
  /** Wird aufgerufen wenn der Kunde eine Kachel auswählt. */
  onSelect: (durationMinutes: number) => void;
  /** Service-Slug für die Preisschätzung. Wenn unbekannt: "Auf Anfrage". */
  service: Service | null;
}

function formatPriceRange(priceFrom: number | null, hours: number): string {
  if (priceFrom == null) return 'Auf Anfrage';
  const min = priceFrom * hours;
  const max = priceFrom * hours * PRICE_RANGE_FACTOR_MAX;
  if (min === max) return `ca. ${min} €`;
  return `ca. ${min}–${max} €`;
}

export function DurationPicker({
  value,
  onSelect,
  service,
}: DurationPickerProps) {
  const serviceInfo = service ? safeGetServiceInfo(service) : null;
  const priceFrom = serviceInfo?.priceFrom ?? null;

  // Sicherheits-Check: Nur Optionen aus der Whitelist anzeigen.
  const visible = DURATION_META.filter((m) =>
    (BOOKING_DURATION_OPTIONS as readonly number[]).includes(m.minutes),
  );

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Auftragsdauer"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {visible.map((option) => {
          const selected = value === option.minutes;
          const hours = option.minutes / 60;
          const priceLabel = formatPriceRange(priceFrom, hours);
          return (
            <button
              key={option.minutes}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(option.minutes)}
              className={[
                'flex flex-col items-start justify-between gap-1 rounded-lg border px-3 py-3 text-left text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-baerenstark-accent',
                selected
                  ? 'bg-leaf text-white ring-2 ring-leaf border-leaf shadow-card'
                  : 'bg-white border border-baerenstark-sand text-baerenstark-bark hover:border-leaf hover:bg-leaf/5 cursor-pointer',
              ].join(' ')}
            >
              <span className="text-base font-semibold leading-tight">
                {option.label}
              </span>
              <span
                className={[
                  'text-xs leading-tight',
                  selected ? 'text-white/85' : 'text-baerenstark-bark/65',
                ].join(' ')}
              >
                {option.hint}
              </span>
              <span
                className={[
                  'mt-1 text-xs font-medium',
                  selected ? 'text-white' : 'text-baerenstark-wood',
                ].join(' ')}
              >
                {priceLabel}
              </span>
            </button>
          );
        })}
      </div>
      {priceFrom != null && (
        <p className="text-xs text-baerenstark-bark/60">
          Preisschätzung — Endpreis nach Besichtigung. Service-Faktor variiert
          je nach Aufwand.
        </p>
      )}
      {service === 'sonstiges' && (
        <p className="text-xs text-baerenstark-bark/60">
          Bei „Sonstiges" erstellt Tom dir nach Sichtung deiner Anfrage ein
          individuelles Angebot.
        </p>
      )}
    </div>
  );
}

/**
 * Service-Lookup mit defensivem Fallback. `getServiceInfo` wirft nicht,
 * gibt aber `undefined` für unbekannte Slugs — wir typisieren das ohne
 * Cast.
 */
function safeGetServiceInfo(slug: Service) {
  try {
    return getServiceInfo(slug);
  } catch {
    return null;
  }
}
