'use client';

/**
 * useScrollToSection — IT13-S03.
 *
 * Einheitliches, accessibility-konformes Scroll-Verhalten beim Wechsel
 * zwischen Wizard-Sektionen (Buchungsformular, Quick-Booking-Modal,
 * Profil-Form, Kontaktformular).
 *
 * Pflicht-Sequenz (siehe `frontend-requirements-iteration-13.md`,
 * `ux-spec-iteration-13.md` §1.1.3, `component-library-iteration-13.md` §1.2):
 *
 *   1. requestAnimationFrame × 2 (Layout/Paint des neu gemounteten Steps).
 *   2. Header-Höhe aus `[data-app-header]` (Default 64 px) lesen.
 *   3. Modal-Container über `closest('[data-modal-body]')` erkennen — wenn
 *      Element in einem Modal liegt, scrollt das Modal-Innere, NICHT das
 *      Hintergrund-Dokument.
 *   4. `scrollIntoView({ behavior, block: 'start' })` — `behavior` hängt von
 *      `prefers-reduced-motion` ab.
 *   5. Heading im Element finden (h1–h6, erstes Match) und programmatisch
 *      `.focus({ preventScroll: true })` aufrufen — Screenreader liest das
 *      Heading vor.
 *   6. Komfort-Tolerance ±8 px: wenn Element bereits im Idealbereich liegt,
 *      kein Scroll, aber Heading wird trotzdem fokussiert.
 *
 * Public API: ausschließlich `useScrollToSection()` (Hook). Es gibt keine
 * freistehende `scrollToSection()`-Funktion. Stabiler `useCallback`-Wrapper
 * für problemloses Verwenden in `useEffect`-Dependencies.
 */

import { useCallback, type RefObject } from 'react';

const HEADER_DEFAULT = 64;
const COMFORT_TOLERANCE = 8;
const HEADER_SELECTOR = '[data-app-header]';
const MODAL_BODY_SELECTOR = '[data-modal-body]';
const MODAL_HEADER_SELECTOR = '[data-modal-header]';

export type ScrollToSectionTarget = string | RefObject<HTMLElement>;

function isHeading(el: HTMLElement): boolean {
  return /^H[1-6]$/.test(el.tagName);
}

/**
 * Resolve `target` to a concrete HTMLElement.
 *
 * Akzeptiert:
 *   - eine Section-/Anchor-ID (sucht erst `#id`, dann
 *     `[data-section-anchor="id"]`).
 *   - einen RefObject<HTMLElement>.
 */
function resolveTarget(target: ScrollToSectionTarget): HTMLElement | null {
  if (typeof target === 'string') {
    if (typeof document === 'undefined') return null;
    const byId = document.getElementById(target);
    if (byId) return byId;
    return document.querySelector<HTMLElement>(
      `[data-section-anchor="${target}"]`,
    );
  }
  return target.current ?? null;
}

function findHeadingIn(el: HTMLElement): HTMLElement | null {
  if (isHeading(el)) return el;
  return el.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6');
}

function focusHeading(el: HTMLElement): void {
  const heading = findHeadingIn(el);
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) {
    heading.setAttribute('tabindex', '-1');
  }
  heading.focus({ preventScroll: true });
}

export function useScrollToSection(): (target: ScrollToSectionTarget) => void {
  return useCallback((target: ScrollToSectionTarget) => {
    if (typeof window === 'undefined') return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = resolveTarget(target);
        if (!el) return;

        const reduceMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;
        const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';

        const modalBody = el.closest<HTMLElement>(MODAL_BODY_SELECTOR);

        if (modalBody) {
          // Modal-Branch: Scroll-Container ist das Modal-Body, nicht window.
          const cRect = modalBody.getBoundingClientRect();
          const eRect = el.getBoundingClientRect();
          const offsetWithinContainer = eRect.top - cRect.top;
          const modalHeader =
            modalBody.querySelector<HTMLElement>(MODAL_HEADER_SELECTOR);
          const effectiveHeader = modalHeader?.offsetHeight ?? 0;

          if (
            Math.abs(offsetWithinContainer - effectiveHeader) > COMFORT_TOLERANCE
          ) {
            modalBody.scrollTo({
              top:
                modalBody.scrollTop + offsetWithinContainer - effectiveHeader,
              behavior,
            });
          }
        } else {
          // Document-Branch: Standard-Page-Scroll.
          const headerEl =
            document.querySelector<HTMLElement>(HEADER_SELECTOR);
          const headerHeight = headerEl?.offsetHeight ?? HEADER_DEFAULT;
          const rect = el.getBoundingClientRect();
          if (Math.abs(rect.top - headerHeight) > COMFORT_TOLERANCE) {
            // `scroll-margin-top` an den Section-Anchors (Tailwind
            // `scroll-mt-[var(--header-offset)]`) sorgt CSS-seitig für
            // den korrekten Offset. `scrollIntoView({ block: 'start' })`
            // respektiert diese Property.
            el.scrollIntoView({ behavior, block: 'start' });
          }
        }

        // a11y — IMMER Heading fokussieren, auch wenn kein Scroll nötig war.
        focusHeading(el);
      });
    });
  }, []);
}
