/**
 * Inline-SVG-Icons für Iteration 10 — Ersatz für `lucide-react`, das nicht im
 * Repo installiert ist (siehe `design-system-iteration-10-additions.md` §5).
 *
 * Alle Icons folgen der gleichen API:
 *   - props.size — Pixel (Default 20)
 *   - props.className — Zusatz-Klassen (Färbung via `currentColor`)
 *   - props['aria-hidden'] standardmäßig true (textbegleitend)
 *
 * Visuell stark angelehnt an Lucide (24×24-Grid, stroke-width 2).
 */

import type { SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  size?: number;
};

function Base({ size = 20, className = '', ...rest }: IconProps & { children: React.ReactNode }) {
  const { children, ...svgProps } = rest as IconProps & { children: React.ReactNode };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...svgProps}
    >
      {children}
    </svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Base>
  );
}

export function CheckCircle2Icon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Base>
  );
}

export function XCircleIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </Base>
  );
}

export function BanIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </Base>
  );
}

export function RefreshCwIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </Base>
  );
}

export function CheckCheckIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </Base>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="m15 18-6-6 6-6" />
    </Base>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="m9 18 6-6-6-6" />
    </Base>
  );
}

export function AlertTriangleIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Base>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Base>
  );
}

export function ClipboardListIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </Base>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Base>
  );
}

export function XIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Base>
  );
}

export function PhoneIcon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </Base>
  );
}

// IT14-S03 — Empty-State-Icons (Lucide-Style).
export function InboxIcon(p: IconProps) {
  return (
    <Base {...p}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Base>
  );
}

export function FilterIcon(p: IconProps) {
  return (
    <Base {...p}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </Base>
  );
}

export function ArrowUpRightIcon(p: IconProps) {
  return (
    <Base {...p}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </Base>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <Base {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </Base>
  );
}

export function ArrowLeftIcon(p: IconProps) {
  return (
    <Base {...p}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </Base>
  );
}
