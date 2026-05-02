/**
 * Globale Frontend-Typen.
 *
 * Alle Domain-Typen (Slot, Booking, Service-Slugs) leben in
 * contracts/zod-schemas.ts und werden über @/lib/schemas re-exportiert.
 * Hier nur lokale UI-Helper-Typen.
 */

export type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };
