'use client';

/**
 * US-23 — Service-Popup mit Vorher/Nachher, Inkludiertes, Preis und CTA.
 *
 * Verhalten:
 *   - Öffnen via Klick auf eine ServiceCard (oder "Mehr erfahren"-Button).
 *   - Schließen mit X-Button, Backdrop-Klick oder ESC.
 *   - Focus-Trap: Erster Fokus liegt auf dem Schließen-Button.
 *   - Smooth Animation: opacity + scale (~150ms).
 *   - CTA "Jetzt Termin anfragen" → /buchung?service=<slug>.
 *   - Bären-Farbschema (Bark/Cream/Sand/Leaf-Grün für CTA).
 */

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { type ServiceInfo } from '@/lib/services';

interface ServiceDetailModalProps {
  service: ServiceInfo | null;
  onClose: () => void;
}

export function ServiceDetailModal({ service, onClose }: ServiceDetailModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = service !== null;

  // ESC schließt
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Body-Scroll-Lock während offen
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Initial-Focus auf Schließen-Button
  useEffect(() => {
    if (!isOpen) return;
    // Zwei rAF-Ticks, damit Browser die transform-Animation mounten kann.
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  // Sehr leichter Focus-Trap: Tab-Cycling im Dialog halten.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (!service) return null;

  const ctaHref = `/buchung?service=${encodeURIComponent(service.slug)}`;
  // Detail-Page existiert für alle Services außer `'sonstiges'` (Anfrage-Kategorie).
  const detailHref =
    service.slug === 'sonstiges'
      ? null
      : `/services/${encodeURIComponent(service.slug)}`;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6',
        'bg-baerenstark-bark/60 backdrop-blur-sm',
        'transition-opacity duration-150',
      ].join(' ')}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-modal-title"
        aria-describedby="service-modal-desc"
        className={[
          'relative w-full max-w-3xl overflow-hidden rounded-2xl border border-baerenstark-sand',
          'bg-baerenstark-cream shadow-card',
          'transition-transform duration-150',
          'max-h-[92vh] overflow-y-auto',
        ].join(' ')}
      >
        {/* Header */}
        <header className="flex items-start gap-4 border-b border-baerenstark-sand bg-gradient-to-br from-baerenstark-sand/50 to-baerenstark-cream p-5 sm:p-6">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-white text-3xl shadow-soft sm:h-16 sm:w-16 sm:text-4xl"
          >
            {service.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="service-modal-title"
              className="font-serif text-2xl font-bold text-baerenstark-bark sm:text-3xl"
            >
              {service.label}
            </h2>
            <p
              id="service-modal-desc"
              className="mt-1 text-sm text-baerenstark-bark/80 sm:text-base"
            >
              {service.description}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Dialog schließen"
            className={[
              'flex h-9 w-9 flex-none items-center justify-center rounded-full text-xl',
              'bg-white/80 text-baerenstark-bark hover:bg-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent',
            ].join(' ')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {/* Vorher / Nachher */}
        <section
          aria-label="Vorher und Nachher"
          className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:gap-4 sm:p-6"
        >
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
            <h3 className="mb-2 flex items-center gap-2 font-serif text-lg font-semibold text-red-900">
              <span aria-hidden="true">🚧</span> Vorher
            </h3>
            <p className="text-sm text-red-900/90">{service.details.before}</p>
          </div>
          <div className="rounded-xl border border-leaf/40 bg-leaf/10 p-4">
            <h3 className="mb-2 flex items-center gap-2 font-serif text-lg font-semibold text-baerenstark-bark">
              <span aria-hidden="true">✨</span> Nachher
            </h3>
            <p className="text-sm text-baerenstark-bark/90">{service.details.after}</p>
          </div>
        </section>

        {/* Inbegriffen */}
        <section
          aria-labelledby="includes-heading"
          className="border-t border-baerenstark-sand bg-white/60 p-5 sm:p-6"
        >
          <h3
            id="includes-heading"
            className="mb-3 font-serif text-lg font-semibold text-baerenstark-bark"
          >
            Was ist inbegriffen
          </h3>
          <ul role="list" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {service.details.includes.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-baerenstark-bark"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-leaf text-xs font-bold text-white"
                >
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <footer className="flex flex-col-reverse items-stretch gap-3 border-t border-baerenstark-sand bg-baerenstark-cream p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Schließen
          </Button>
          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:gap-3">
            {detailHref && (
              <Link
                href={detailHref}
                onClick={onClose}
                className={[
                  'inline-flex items-center justify-center gap-2 rounded-lg border-2 border-baerenstark-wood px-5 py-2.5 text-base font-medium text-baerenstark-bark',
                  'hover:bg-baerenstark-sand/40 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent',
                ].join(' ')}
              >
                Zur Service-Seite
              </Link>
            )}
            <Link
              href={ctaHref}
              onClick={onClose}
              className={[
                'inline-flex items-center justify-center gap-2 rounded-lg bg-leaf px-5 py-2.5 text-base font-medium text-white shadow-soft',
                'hover:bg-baerenstark-bark transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent',
              ].join(' ')}
            >
              Jetzt Anfrage stellen →
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
