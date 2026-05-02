'use client';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { CONTACT } from '@/lib/contact';
import { formatSlotRange } from '@/lib/format';
import type { SlotPublic } from '@/lib/schemas';

interface SlotListProps {
  status: 'loading' | 'error' | 'ready';
  slots: SlotPublic[];
  selectedSlotId: string | null;
  errorMessage?: string | null;
  onSelect: (slot: SlotPublic) => void;
  onRetry?: () => void;
}

export function SlotList({
  status,
  slots,
  selectedSlotId,
  errorMessage,
  onSelect,
  onRetry,
}: SlotListProps) {
  if (status === 'loading') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Banner tone="error" title="Termine konnten nicht geladen werden" role="alert">
        <p className="mb-3">
          {errorMessage ?? 'Bitte versuche es in einem Moment erneut.'} Alternativ
          kannst du uns jederzeit anrufen — wir helfen dir auch direkt am Telefon
          weiter.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Erneut versuchen
            </Button>
          )}
          <a
            href={`tel:${CONTACT.phoneTel}`}
            className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark"
          >
            📞 {CONTACT.phoneDisplay} anrufen
          </a>
        </div>
      </Banner>
    );
  }

  if (slots.length === 0) {
    return (
      <Banner tone="info" title="Aktuell keine Termine verfügbar">
        <p className="mb-3">
          Es sind gerade keine Zeitfenster freigeschaltet. Ruf uns einfach kurz
          an, dann finden wir gemeinsam einen passenden Termin:
        </p>
        <a
          href={`tel:${CONTACT.phoneTel}`}
          className="inline-flex items-center justify-center rounded-lg bg-baerenstark-wood px-4 py-2 text-sm font-medium text-baerenstark-cream hover:bg-baerenstark-bark"
        >
          📞 {CONTACT.phoneDisplay} anrufen
        </a>
      </Banner>
    );
  }

  return (
    <ul role="list" className="grid gap-4 sm:grid-cols-2">
      {slots.map((slot) => {
        const isSelected = slot.id === selectedSlotId;
        const isBooked = slot.isBooked;
        return (
          <li key={slot.id}>
            <button
              type="button"
              disabled={isBooked}
              onClick={() => onSelect(slot)}
              aria-pressed={isSelected}
              aria-label={`Zeitfenster wählen: ${formatSlotRange(slot.startsAt, slot.endsAt)}${isBooked ? ' (bereits belegt)' : ''}`}
              className={[
                'flex w-full flex-col items-start rounded-2xl border p-5 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2',
                isBooked
                  ? 'cursor-not-allowed border-baerenstark-sand/60 bg-baerenstark-sand/30 text-baerenstark-bark/50'
                  : isSelected
                    ? 'border-baerenstark-wood bg-baerenstark-wood text-baerenstark-cream shadow-card'
                    : 'border-baerenstark-sand bg-white/80 text-baerenstark-bark shadow-soft hover:border-baerenstark-wood hover:shadow-card',
              ].join(' ')}
            >
              <div className="mb-2 flex w-full items-center justify-between gap-2">
                <span className="font-serif text-lg font-semibold">
                  {formatSlotRange(slot.startsAt, slot.endsAt)}
                </span>
                {isBooked ? (
                  <Badge tone="warning">Belegt</Badge>
                ) : isSelected ? (
                  <Badge tone="success">Ausgewählt</Badge>
                ) : (
                  <Badge tone="success">Frei</Badge>
                )}
              </div>
              {slot.description && (
                <p
                  className={[
                    'text-sm',
                    isSelected ? 'text-baerenstark-cream/90' : 'text-baerenstark-bark/70',
                  ].join(' ')}
                >
                  {slot.description}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
