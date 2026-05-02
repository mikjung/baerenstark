interface SkeletonProps {
  className?: string;
  ariaLabel?: string;
}

export function Skeleton({ className = '', ariaLabel = 'Lade Inhalt' }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={['skeleton', className].join(' ')}
    >
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-baerenstark-sand bg-white/50 p-5 shadow-soft">
      <Skeleton className="mb-3 h-5 w-2/3" ariaLabel="Lade Termin" />
      <Skeleton className="h-4 w-1/2" ariaLabel="Lade Termin" />
    </div>
  );
}
