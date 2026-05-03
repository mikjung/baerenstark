'use client';

/**
 * PaginationControls — Iteration 10 (QA UX-1).
 *
 * Wiederverwendbare Pagination-Steuerung. Mobile = „Mehr laden",
 * Desktop = „Vor/Zurück" + Page-Indicator. Spec:
 *   `project/design/ux/component-library-iteration-10.md` §9.
 *   `project/design/ux/ux-spec-iteration-10.md` §3.4 + §6.4.1.
 *
 * Responsive Switch erfolgt via CSS (`hidden`-Klassen mit `sm:`-Breakpoint).
 * Engineer kann via `mode`-Prop einen festen Modus erzwingen (Tests).
 */

import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize?: number;
  totalItems: number;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  onLoadMore?: () => void;
  /** Override für Tests. Default: viewport-based via CSS. */
  mode?: 'page-jump' | 'load-more';
  itemLabelSingular?: string;
  itemLabelPlural?: string;
  /** Wird gesetzt, sobald die mobile Liste bereits alle Items zeigt. */
  hasMore?: boolean;
}

export function PaginationControls({
  currentPage,
  totalPages,
  pageSize = 20,
  totalItems,
  isLoading = false,
  onPageChange,
  onLoadMore,
  mode,
  itemLabelSingular = 'Eintrag',
  itemLabelPlural = 'Einträge',
  hasMore,
}: PaginationControlsProps) {
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // A11y: Page-Status in eine Live-Region schreiben (Spec §3.4 + §6.4.1).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (liveRegionRef.current && !isLoading) {
      const visibleCount = Math.min(currentPage * pageSize, totalItems);
      liveRegionRef.current.textContent = `Seite ${currentPage} von ${totalPages} geladen, ${visibleCount} ${itemLabelPlural} angezeigt.`;
    }
  }, [currentPage, totalPages, pageSize, totalItems, itemLabelPlural, isLoading]);

  if (totalItems === 0) return null;

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  // Override-Modus (Tests / forcierte Ansicht).
  const forceMobile = mode === 'load-more';
  const forceDesktop = mode === 'page-jump';

  const showLoadMore =
    typeof hasMore === 'boolean' ? hasMore : currentPage < totalPages;

  return (
    <nav
      aria-label={`${itemLabelPlural}-Seitennavigation`}
      className="mt-4"
    >
      {/* Mobile: „Mehr laden" — sichtbar < sm, versteckt ≥ sm (außer wenn forceMobile). */}
      <div
        className={
          forceMobile
            ? 'flex flex-col items-center gap-2'
            : forceDesktop
              ? 'hidden'
              : 'flex flex-col items-center gap-2 sm:hidden'
        }
      >
        {showLoadMore ? (
          <Button
            variant="secondary"
            isLoading={isLoading}
            onClick={() => onLoadMore?.()}
            aria-label={`Weitere ${pageSize} ${itemLabelPlural} laden`}
            aria-busy={isLoading || undefined}
            className="w-full"
          >
            {isLoading ? 'Wird geladen…' : `Weitere ${pageSize} ${itemLabelPlural} laden`}
          </Button>
        ) : (
          <p className="text-sm text-baerenstark-bark/70">
            Sie sehen alle {itemLabelPlural}.
          </p>
        )}
      </div>

      {/* Desktop: „Vor/Zurück" — sichtbar ≥ sm, versteckt < sm (außer wenn forceDesktop). */}
      <div
        className={
          forceDesktop
            ? 'flex items-center justify-between gap-3'
            : forceMobile
              ? 'hidden'
              : 'hidden items-center justify-between gap-3 sm:flex'
        }
      >
        <span className="text-sm text-baerenstark-bark/70">
          {from}–{to} von {totalItems} {itemLabelPlural}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
            aria-label="Vorherige Seite anzeigen"
          >
            <ChevronLeftIcon size={16} />
            <span>Zurück</span>
          </Button>
          <span className="text-sm text-baerenstark-bark/80" aria-hidden="true">
            Seite {currentPage} von {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange?.(Math.min(totalPages, currentPage + 1))}
            aria-label="Nächste Seite anzeigen"
          >
            <span>Weiter</span>
            <ChevronRightIcon size={16} />
          </Button>
        </div>
      </div>

      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        className="sr-only"
      />
    </nav>
  );
}
