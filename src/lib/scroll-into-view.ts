/**
 * Scroll-Stabilität-Helper (IT12-S04 + IT12-S09).
 *
 * Scrollt nur dann zu einem Element, wenn es nicht bereits im Viewport ist.
 * Verhindert die in IT12-S04/S09 berichteten „Scroll-Jumps", die durch
 * unkonditioniertes `scrollIntoView` ausgelöst wurden, obwohl das Ziel-
 * Element bereits sichtbar war.
 *
 * Spec: ux-spec-iteration-12.md §1.1, frontend-requirements-iteration-12.md
 * Querschnitt.
 */

export function scrollIntoViewIfNeeded(
  elementId: string,
  opts?: ScrollIntoViewOptions,
): void {
  if (typeof window === 'undefined') return;
  const el = document.getElementById(elementId);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  // Wenn das Element vollständig im Viewport ist → kein Scroll.
  const inViewport = rect.top >= 0 && rect.bottom <= viewportHeight;
  if (inViewport) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start', ...opts });
}
