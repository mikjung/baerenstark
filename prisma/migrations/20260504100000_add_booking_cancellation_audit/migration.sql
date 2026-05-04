-- Iteration 11 / US-IT11-06 — Audit-Trail für Stornierungen.
-- ARCHITECTURE_IT11.md §6.2.
--
-- Drei nullable Spalten an `bookings`:
--   cancelledAt        : Zeitpunkt der Stornierung (UTC). NULL solange nicht storniert.
--   cancelledBy        : 'CUSTOMER' | 'ADMIN' | 'SYSTEM' (App-Layer-Validation).
--   cancellationReason : Optionaler Freitext (max 500 chars, App-Layer).
--
-- Additiver Diff, idempotent für libSQL/Turso (ALTER TABLE ADD COLUMN).
-- Backwards-compatible: Bestand-Buchungen bleiben unangetastet.

ALTER TABLE "bookings" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "bookings" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "bookings" ADD COLUMN "cancellationReason" TEXT;
