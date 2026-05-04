/**
 * Customer-Auth-Sync — Event-Bus zwischen Customer-Auth-State-änderenden
 * Aktionen (Login, Logout, Profil-Save, Register-from-Booking, OAuth-Finalize)
 * und allen `useCustomer()`-Subscribern (insb. Header).
 *
 * IT12-S07: Vor dem Fix gab es keinen globalen Sync, deshalb fiel der Header
 * nach Profil-Save auf „Anmelden" zurück, sobald `useCustomer()` (in einer
 * anderen Component-Instanz) erneut fetchte und temporär einen Fehler bekam.
 *
 * Spec: ARCHITECTURE_IT12.md §0.4 + §S07,
 * frontend-requirements-iteration-12.md Querschnitt.
 *
 * SSR-safe: Im Server-Rendering ist `window` undefined → wir geben No-Op-
 * Funktionen zurück. Der Listener wird erst im Browser via `useEffect`
 * registriert.
 */

const target: EventTarget | null =
  typeof window !== 'undefined' ? new EventTarget() : null;

const EVENT_NAME = 'customer-changed';

export function emitCustomerChanged(): void {
  if (!target) return;
  target.dispatchEvent(new Event(EVENT_NAME));
}

export function onCustomerChanged(cb: () => void): () => void {
  if (!target) return () => {};
  target.addEventListener(EVENT_NAME, cb);
  return () => target.removeEventListener(EVENT_NAME, cb);
}
