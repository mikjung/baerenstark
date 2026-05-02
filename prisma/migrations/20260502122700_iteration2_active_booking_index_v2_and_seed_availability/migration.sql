-- Iteration 2:
-- 1) Partial Unique Index neu anlegen (er ging beim RedefineTables in der
--    vorherigen Migration verloren) und um COUNTER_PROPOSED erweitern.
-- 2) Initial-Seed der weekly_availability mit allen 7 Wochentagen (isActive=false).

-- 1. Partial Unique Index v2: COUNTER_PROPOSED zählt jetzt auch als aktiv.
DROP INDEX IF EXISTS "uniq_active_booking_per_slot";
CREATE UNIQUE INDEX "uniq_active_booking_per_slot"
  ON "bookings"("slotId")
  WHERE "status" IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED');

-- 2. Seed weekly_availability — alle 7 Tage, isActive=false.
--    INSERT OR IGNORE, damit die Migration auch dann durchläuft, wenn
--    bereits Datensätze existieren (z.B. via getOrSeedWeeklyAvailability()
--    beim ersten GET /api/availability).
INSERT OR IGNORE INTO "weekly_availability" ("id", "dayOfWeek", "isActive", "createdAt", "updatedAt")
VALUES
  ('seed_wa_0', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_wa_1', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_wa_2', 2, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_wa_3', 3, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_wa_4', 4, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_wa_5', 5, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_wa_6', 6, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
