/**
 * BookingStatusBadge — Iteration 10 / US-IT10-05.
 *
 * 6 Varianten, exakt aus
 *   `project/design/ux/component-library-iteration-10.md` §3
 *   `project/design/ux/design-system-iteration-10-additions.md` §1.4
 *
 * Verbindlich: Text + Icon (kein color-only — A11y).
 */

import type { BookingStatus } from '@/lib/schemas';
import {
  BanIcon,
  CheckCheckIcon,
  CheckCircle2Icon,
  ClockIcon,
  RefreshCwIcon,
  XCircleIcon,
} from '@/components/ui/icons';

type Size = 'sm' | 'md';

interface BookingStatusBadgeProps {
  status: BookingStatus;
  size?: Size;
  className?: string;
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Offen',
  CONFIRMED: 'Bestätigt',
  REJECTED: 'Abgelehnt',
  CANCELLED: 'Storniert',
  COUNTER_PROPOSED: 'Gegenvorschlag',
  COMPLETED: 'Abgeschlossen',
};

// Tailwind-Klassen pro Status. `border` mit gleichfarbiger Linie für klaren
// visuellen Kontrast neben Icon + Text.
const STATUS_CLASSES: Record<BookingStatus, string> = {
  PENDING:
    'bg-feedback-warning-bg text-baerenstark-bark border border-feedback-warning',
  CONFIRMED:
    'bg-feedback-success-bg text-feedback-success border border-feedback-success',
  REJECTED:
    'bg-feedback-error-bg text-feedback-error border border-feedback-error',
  CANCELLED:
    'bg-baerenstark-sand text-baerenstark-bark border border-baerenstark-bark/30',
  COUNTER_PROPOSED:
    'bg-feedback-info-bg text-feedback-info border border-feedback-info',
  COMPLETED:
    'bg-status-completed-bg text-status-completed-fg border border-status-completed-border',
};

function StatusIcon({ status, size }: { status: BookingStatus; size: number }) {
  switch (status) {
    case 'PENDING':
      return <ClockIcon size={size} />;
    case 'CONFIRMED':
      return <CheckCircle2Icon size={size} />;
    case 'REJECTED':
      return <XCircleIcon size={size} />;
    case 'CANCELLED':
      return <BanIcon size={size} />;
    case 'COUNTER_PROPOSED':
      return <RefreshCwIcon size={size} />;
    case 'COMPLETED':
      return <CheckCheckIcon size={size} />;
  }
}

export function BookingStatusBadge({
  status,
  size = 'md',
  className = '',
}: BookingStatusBadgeProps) {
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-3 py-1 text-sm gap-1.5';
  const iconSize = size === 'sm' ? 14 : 16;
  return (
    <span
      className={[
        'inline-flex items-center rounded-full font-medium',
        sizeClasses,
        STATUS_CLASSES[status],
        className,
      ].join(' ')}
    >
      <span aria-hidden="true" className="inline-flex items-center">
        <StatusIcon status={status} size={iconSize} />
      </span>
      <span>{STATUS_LABEL[status]}</span>
    </span>
  );
}
