/**
 * Alias-Endpoint zu `GET /api/customer/verify` — wird vom Orchestrator-
 * Brief gefordert. Behandelt eingehende Token-Links identisch.
 *
 * Beide Pfade sind funktional gleich; der Hauptpfad bleibt
 * `/api/customer/verify` (siehe contracts/api-routes.md §11).
 */

export const dynamic = 'force-dynamic';
export { GET } from '../verify/route';
