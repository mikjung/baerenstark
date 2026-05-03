-- Iteration 5 — follow-up:
--   1) Partial Unique Indexes wiederherstellen (gingen beim RedefineTables in
--      `20260502235443_iteration5` verloren — Prisma räumt sie automatisch auf).
--   2) BufferConfig-Singleton seeden (Default 30 Minuten).
--   3) durationMinutes-Backfill für IT3/IT4-Bestandsbuchungen.

-- 1. Slot-basierter Partial Unique Index (Bestand IT2/IT3).
DROP INDEX IF EXISTS "uniq_active_booking_per_slot";
CREATE UNIQUE INDEX "uniq_active_booking_per_slot"
  ON "bookings"("slotId")
  WHERE "slotId" IS NOT NULL
    AND "status" IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED');

-- 2. Date/Time-basierter Partial Unique Index (Bestand IT3 / IT5).
--    Schützt vor exakt-Tupel-Doppelbuchungen. Überlappende Tupel werden
--    in `lib/booking-create.ts` durch Serializable-Transaktion gefangen
--    (siehe ARCHITECTURE.md §18.5.5).
DROP INDEX IF EXISTS "uniq_active_booking_per_timeslot";
CREATE UNIQUE INDEX "uniq_active_booking_per_timeslot"
  ON "bookings"("date", "startTime", "endTime")
  WHERE "date" IS NOT NULL
    AND "status" IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED');

-- 3. BufferConfig-Singleton seeden.
INSERT OR IGNORE INTO "buffer_config" ("id", "bufferMinutes", "updatedAt")
VALUES ('global', 30, CURRENT_TIMESTAMP);

-- 4. durationMinutes-Backfill für IT3/IT4-Bestandsbuchungen.
--    Bestand hat Default 60 (Migration-Default) — wir überschreiben es nur
--    dort, wo wir aus startTime/endTime den tatsächlichen Wert berechnen
--    können. Behutsam: nur Datensätze anfassen, die den Default tragen.
UPDATE "bookings"
   SET "durationMinutes" = (
     (CAST(substr("endTime", 1, 2) AS INTEGER) * 60
       + CAST(substr("endTime", 4, 2) AS INTEGER))
     - (CAST(substr("startTime", 1, 2) AS INTEGER) * 60
       + CAST(substr("startTime", 4, 2) AS INTEGER))
   )
 WHERE "startTime" IS NOT NULL
   AND "endTime" IS NOT NULL
   AND "durationMinutes" = 60
   AND (
     -- Nur Datensätze, deren tatsächliche Dauer von 60 abweicht.
     (CAST(substr("endTime", 1, 2) AS INTEGER) * 60
       + CAST(substr("endTime", 4, 2) AS INTEGER))
     - (CAST(substr("startTime", 1, 2) AS INTEGER) * 60
       + CAST(substr("startTime", 4, 2) AS INTEGER))
   ) <> 60;
