'use client';

import { createContext } from 'react';
import type { Service } from '@/lib/services';

export interface AnfrageDialogContextValue {
  isOpen: boolean;
  defaultService: Service | null;
  open: (options?: { service?: Service | null }) => void;
  close: () => void;
}

export const AnfrageDialogContext =
  createContext<AnfrageDialogContextValue | null>(null);
