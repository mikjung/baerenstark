'use client';

/**
 * AnfrageDialogProvider — globaler State für den Anfrage-Dialog.
 *
 * Wird einmal im Root-Layout gemountet. Aus jeder Client-Komponente kann
 * der Dialog mit `useAnfrageDialog().open({ service })` geöffnet werden.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AnfrageDialog } from './AnfrageDialog';
import {
  AnfrageDialogContext,
  type AnfrageDialogContextValue,
} from './anfrage-dialog-context';
import type { Service } from '@/lib/services';

interface AnfrageDialogProviderProps {
  children: ReactNode;
}

export function AnfrageDialogProvider({ children }: AnfrageDialogProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [defaultService, setDefaultService] = useState<Service | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const open = useCallback<AnfrageDialogContextValue['open']>((options) => {
    setDefaultService(options?.service ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setDefaultService(null);
  }, []);

  const value = useMemo<AnfrageDialogContextValue>(
    () => ({ isOpen, defaultService, open, close }),
    [isOpen, defaultService, open, close],
  );

  return (
    <AnfrageDialogContext.Provider value={value}>
      {children}
      {mounted && (
        <AnfrageDialog
          isOpen={isOpen}
          onClose={close}
          defaultService={defaultService}
        />
      )}
    </AnfrageDialogContext.Provider>
  );
}
