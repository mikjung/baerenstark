/**
 * Toast-Service — Iteration 10.
 *
 * Single-Source-Of-Truth für Toast-State. Komponenten nutzen die `toast.*`-API
 * (`toast.success`, `toast.error`, …); der `<Toaster />`-Component aus
 * `@/components/ui/Toast` rendert die aktuellen Toasts.
 *
 * Default-Dauer pro Variant aus
 *   `project/design/ux/component-library-iteration-10.md` §5:
 *     success 4 s, info 5 s, warning 6 s, error 6 s.
 */

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastEntry {
  id: string;
  variant: ToastVariant;
  message: string;
  title?: string;
  duration: number | null;
  action?: ToastAction;
  createdAt: number;
}

type Listener = (toasts: ToastEntry[]) => void;

const listeners = new Set<Listener>();
let toasts: ToastEntry[] = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const fn of listeners) fn([...toasts]);
}

function clearTimer(id: string) {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
}

function scheduleDismiss(entry: ToastEntry) {
  if (entry.duration === null) return;
  const t = setTimeout(() => dismissToast(entry.id), entry.duration);
  timers.set(entry.id, t);
}

export function subscribeToasts(fn: Listener): () => void {
  listeners.add(fn);
  fn([...toasts]);
  return () => {
    listeners.delete(fn);
  };
}

export function dismissToast(id: string) {
  const before = toasts.length;
  toasts = toasts.filter((t) => t.id !== id);
  clearTimer(id);
  if (toasts.length !== before) emit();
}

const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 6000,
};

interface ShowOptions {
  title?: string;
  duration?: number | null;
  action?: ToastAction;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function show(variant: ToastVariant, message: string, opts: ShowOptions = {}) {
  const entry: ToastEntry = {
    id: makeId(),
    variant,
    message,
    title: opts.title,
    duration: opts.duration === undefined ? DEFAULT_DURATIONS[variant] : opts.duration,
    action: opts.action,
    createdAt: Date.now(),
  };
  // Stack max 3 — älteste verdrängen.
  toasts = [...toasts, entry].slice(-3);
  emit();
  scheduleDismiss(entry);
  return entry.id;
}

export const toast = {
  success: (message: string, opts?: ShowOptions) => show('success', message, opts),
  info: (message: string, opts?: ShowOptions) => show('info', message, opts),
  warning: (message: string, opts?: ShowOptions) => show('warning', message, opts),
  error: (message: string, opts?: ShowOptions) => show('error', message, opts),
  dismiss: dismissToast,
};
