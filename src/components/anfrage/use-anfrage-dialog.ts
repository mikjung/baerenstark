'use client';

import { useContext } from 'react';
import {
  AnfrageDialogContext,
  type AnfrageDialogContextValue,
} from './anfrage-dialog-context';

export function useAnfrageDialog(): AnfrageDialogContextValue {
  const ctx = useContext(AnfrageDialogContext);
  if (!ctx) {
    throw new Error(
      'useAnfrageDialog must be used inside <AnfrageDialogProvider> (siehe src/app/layout.tsx).',
    );
  }
  return ctx;
}
