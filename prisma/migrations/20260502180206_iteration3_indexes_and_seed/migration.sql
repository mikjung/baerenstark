-- Iteration 3 — follow-up:
--   1) Partial Unique Indexes wiederherstellen (gingen beim RedefineTables verloren).
--   2) Neuen Partial Unique Index für Date/Time-basierte Buchungen anlegen.
--   3) AvailabilityTemplate seeden — übernimmt isActive aus weekly_availability.

-- 1. Bestand: pro Slot maximal eine aktive Buchung — jetzt nur, wenn slot_id gesetzt.
DROP INDEX IF EXISTS "uniq_active_booking_per_slot";
CREATE UNIQUE INDEX "uniq_active_booking_per_slot"
  ON "bookings"("slotId")
  WHERE "slotId" IS NOT NULL
    AND "status" IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED');

-- 2. NEU IT3: pro Tupel (date, startTime, endTime) maximal eine aktive Buchung.
DROP INDEX IF EXISTS "uniq_active_booking_per_timeslot";
CREATE UNIQUE INDEX "uniq_active_booking_per_timeslot"
  ON "bookings"("date", "startTime", "endTime")
  WHERE "date" IS NOT NULL
    AND "status" IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED');

-- 3. Seed availability_template — übernimmt isActive aus weekly_availability,
--    Default-Zeiten 08:00-17:00, slotDurationMinutes=60.
--    Mo-Fr (1-5) standardmäßig aktiv, Sa/So inaktiv (falls weekly_availability leer).
INSERT OR IGNORE INTO "availability_template"
  ("id", "dayOfWeek", "isActive", "startTime", "endTime", "slotDurationMinutes", "updatedAt")
VALUES
  ('seed_at_0', 0, COALESCE((SELECT "isActive" FROM "weekly_availability" WHERE "dayOfWeek" = 0), 0), '08:00', '17:00', 60, CURRENT_TIMESTAMP),
  ('seed_at_1', 1, COALESCE((SELECT "isActive" FROM "weekly_availability" WHERE "dayOfWeek" = 1), 1), '08:00', '17:00', 60, CURRENT_TIMESTAMP),
  ('seed_at_2', 2, COALESCE((SELECT "isActive" FROM "weekly_availability" WHERE "dayOfWeek" = 2), 1), '08:00', '17:00', 60, CURRENT_TIMESTAMP),
  ('seed_at_3', 3, COALESCE((SELECT "isActive" FROM "weekly_availability" WHERE "dayOfWeek" = 3), 1), '08:00', '17:00', 60, CURRENT_TIMESTAMP),
  ('seed_at_4', 4, COALESCE((SELECT "isActive" FROM "weekly_availability" WHERE "dayOfWeek" = 4), 1), '08:00', '17:00', 60, CURRENT_TIMESTAMP),
  ('seed_at_5', 5, COALESCE((SELECT "isActive" FROM "weekly_availability" WHERE "dayOfWeek" = 5), 1), '08:00', '17:00', 60, CURRENT_TIMESTAMP),
  ('seed_at_6', 6, COALESCE((SELECT "isActive" FROM "weekly_availability" WHERE "dayOfWeek" = 6), 0), '08:00', '17:00', 60, CURRENT_TIMESTAMP);
