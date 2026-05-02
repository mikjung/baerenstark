-- Partial Unique Index: Pro Slot maximal eine aktive Buchung
-- (Status PENDING oder CONFIRMED). REJECTED gibt den Slot wieder frei.
-- Verstoß → SQLITE_CONSTRAINT_UNIQUE → Handler übersetzt zu HTTP 409 CONFLICT.
CREATE UNIQUE INDEX "uniq_active_booking_per_slot"
  ON "bookings"("slotId")
  WHERE "status" IN ('PENDING', 'CONFIRMED');
