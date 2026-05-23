'use client';

/**
 * AnfrageDialog — modaler Dialog mit dem AnfrageForm.
 *
 * Schließen via X, Backdrop, oder ESC. Focus-Trap und Body-Scroll-Lock
 * analog zum ServiceDetailModal.
 */

import { useEffect, useRef } from 'react';
import { AnfrageForm } from './AnfrageForm';
import type { Service } from '@/lib/services';

interface AnfrageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultService: Service | null;
}

export function AnfrageDialog({ isOpen, onClose, defaultService }: AnfrageDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-baerenstark-bark/60 p-4 backdrop-blur-sm transition-opacity duration-150 sm:p-6"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="anfrage-dialog-title"
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-baerenstark-sand bg-baerenstark-cream shadow-card transition-transform duration-150"
      >
        <header className="flex items-start justify-between gap-4 border-b border-baerenstark-sand bg-gradient-to-br from-baerenstark-sand/50 to-baerenstark-cream p-5 sm:p-6">
          <div className="min-w-0 flex-1">
            <h2
              id="anfrage-dialog-title"
              className="font-serif text-2xl font-bold text-baerenstark-bark sm:text-3xl"
            >
              Anfrage stellen
            </h2>
            <p className="mt-1 text-sm text-baerenstark-bark/80 sm:text-base">
              Beschreiben Sie Ihr Anliegen — wir melden uns zeitnah per E-Mail
              oder Telefon.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Dialog schließen"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/80 text-xl text-baerenstark-bark hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-baerenstark-accent focus-visible:ring-offset-2"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="p-5 sm:p-6">
          <AnfrageForm
            defaultService={defaultService}
            variant="dialog"
            onSuccess={() => {
              // Nach Erfolg den Dialog kurz offen lassen, damit der User die
              // Erfolgsmeldung lesen kann — der Provider entscheidet wann
              // geschlossen wird via close-Button.
            }}
          />
        </div>
      </div>
    </div>
  );
}
