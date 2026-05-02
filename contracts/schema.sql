-- Bärenstark Hausservice — SQL-Referenz (MVP, v1.3 — Iteration 3)
-- Diese Datei dient als lesbare Referenz. Die produktive Schema-Erstellung
-- erfolgt via `prisma migrate`. Keine direkte Ausführung empfohlen.
--
-- Änderungen v1.3 (Iteration 3 — US-17 bis US-24):
--   - bookings.date / start_time / end_time NEU (nullable, Pflicht für IT3-Buchungen).
--   - bookings.slot_id wird nullable (Bestandsbuchungen behalten ihn).
--   - NEUE Tabelle availability_template (US-17): Default-Vorlage pro Wochentag.
--   - NEUE Tabelle day_overrides (US-17): individuelle Tages-Überschreibung.
--   - NEUE Tabelle booking_attachments (US-18): Datei-Anhänge.
--   - NEUER Partial Unique Index uniq_active_booking_per_timeslot.
--   - Bestandsindex uniq_active_booking_per_slot bleibt erhalten (greift nur,
--     wenn slot_id IS NOT NULL).
--   - weekly_availability bleibt erhalten (deprecated, für Bestandsdaten).
--
-- Änderungen v1.2 (Iteration 2):
--   - bookings.cancel_token, bookings.counter_proposal_slot_id.
--   - bookings.status: COUNTER_PROPOSED, CANCELLED erlaubt.
--   - Tabelle weekly_availability.
--
-- Änderungen v1.1: Soft-Delete, Mail-Reliability, Partial Unique Index.

-- ---------------------------------------------------------------------------
-- Tabelle: users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Tabelle: slots (DEPRECATED in IT3, bleibt für Bestand)
-- ---------------------------------------------------------------------------
CREATE TABLE slots (
  id          TEXT PRIMARY KEY,
  starts_at   DATETIME NOT NULL,
  ends_at     DATETIME NOT NULL,
  description TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at  DATETIME NULL
);

CREATE INDEX idx_slots_starts_at        ON slots (starts_at);
CREATE INDEX idx_slots_starts_ends      ON slots (starts_at, ends_at);
CREATE INDEX idx_slots_deleted_at       ON slots (deleted_at);

-- ---------------------------------------------------------------------------
-- Tabelle: bookings
-- IT3: slot_id wird nullable; date/start_time/end_time NEU.
-- ---------------------------------------------------------------------------
CREATE TABLE bookings (
  id                        TEXT PRIMARY KEY,
  -- IT1/IT2-Modus (Bestand): slot_id gesetzt, date/start_time/end_time NULL.
  slot_id                   TEXT NULL,                                  -- IT3: nullable
  -- IT3-Modus: date/start_time/end_time gesetzt, slot_id NULL.
  date                      TEXT NULL,                                  -- "YYYY-MM-DD" Berlin-TZ
  start_time                TEXT NULL,                                  -- "HH:MM" Berlin-TZ
  end_time                  TEXT NULL,                                  -- "HH:MM" Berlin-TZ
  customer_name             TEXT NOT NULL,
  customer_phone            TEXT NOT NULL,
  customer_email            TEXT NULL,
  service                   TEXT NOT NULL,                              -- Slug-Liste siehe Footer
  description               TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'COUNTER_PROPOSED', 'CANCELLED')),
  mail_sent                 INTEGER NOT NULL DEFAULT 0
    CHECK (mail_sent IN (0, 1)),
  mail_error                TEXT NULL,
  cancel_token              TEXT NOT NULL UNIQUE,
  counter_proposal_slot_id  TEXT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (slot_id) REFERENCES slots (id) ON DELETE RESTRICT,
  FOREIGN KEY (counter_proposal_slot_id) REFERENCES slots (id) ON DELETE SET NULL,
  -- IT3: Konsistenz-Check — entweder Slot-Modus oder Date-Modus, nicht beide leer.
  CHECK (
    (slot_id IS NOT NULL)
    OR (date IS NOT NULL AND start_time IS NOT NULL AND end_time IS NOT NULL)
  )
);

CREATE INDEX idx_bookings_slot_id                 ON bookings (slot_id);
CREATE INDEX idx_bookings_status_created          ON bookings (status, created_at DESC);
CREATE INDEX idx_bookings_counter_proposal_slot   ON bookings (counter_proposal_slot_id);
CREATE UNIQUE INDEX idx_bookings_cancel_token     ON bookings (cancel_token);
-- IT3-Index für Verfügbarkeits-Lookup (GET /api/slots/available).
CREATE INDEX idx_bookings_date_status             ON bookings (date, status);
-- IT3-Index für Admin-Dashboard (US-21: bevorstehende Termine).
CREATE INDEX idx_bookings_status_date_time        ON bookings (status, date, start_time);

-- ---------------------------------------------------------------------------
-- Partial Unique Index — Iteration 1/2 (Slot-basiert), bleibt erhalten.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS uniq_active_booking_per_slot;
CREATE UNIQUE INDEX uniq_active_booking_per_slot
  ON bookings (slot_id)
  WHERE slot_id IS NOT NULL
    AND status IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED');

-- ---------------------------------------------------------------------------
-- Partial Unique Index — Iteration 3 (Date/Time-basiert).
--
-- Verhindert auf DB-Ebene, dass derselbe (date, start_time, end_time)
-- mehrfach aktiv gebucht wird. Greift nur, wenn date IS NOT NULL —
-- IT1/IT2-Bestandsbuchungen werden nicht erfasst.
--
-- Beachte: Die Granularität ist (date, start_time, end_time). Wenn ein
-- Verfügbarkeitsfenster z.B. 08:00–17:00 mit 60-min-Slots ist, gibt es
-- 9 mögliche aktive Buchungen pro Tag — der Index erlaubt sie alle, solange
-- sie unterschiedliche start_time-Werte haben. Überlappungen (z.B. 09:00–11:00
-- und 10:00–12:00) müssen im App-Layer geprüft werden (siehe lib/availability.ts).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS uniq_active_booking_per_timeslot;
CREATE UNIQUE INDEX uniq_active_booking_per_timeslot
  ON bookings (date, start_time, end_time)
  WHERE date IS NOT NULL
    AND status IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED');

-- ---------------------------------------------------------------------------
-- Tabelle: availability_template (Iteration 3 — US-17)
-- Default-Vorlage pro Wochentag mit Zeit-Komponenten.
-- ---------------------------------------------------------------------------
CREATE TABLE availability_template (
  id                    TEXT PRIMARY KEY,
  day_of_week           INTEGER NOT NULL UNIQUE
    CHECK (day_of_week BETWEEN 0 AND 6),
  is_active             INTEGER NOT NULL DEFAULT 0
    CHECK (is_active IN (0, 1)),
  start_time            TEXT NOT NULL DEFAULT '08:00',                  -- "HH:MM"
  end_time              TEXT NOT NULL DEFAULT '17:00',                  -- "HH:MM"
  slot_duration_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (slot_duration_minutes >= 15 AND slot_duration_minutes <= 480),
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_availability_template_day ON availability_template (day_of_week);

-- Initial-Seed (Iteration-3-Migration legt 7 Tage an, Mo–Fr aktiv 08:00–17:00):
-- INSERT INTO availability_template (id, day_of_week, is_active, start_time, end_time, slot_duration_minutes) VALUES
--   ('seed_at_0', 0, 0, '08:00', '17:00', 60),
--   ('seed_at_1', 1, 1, '08:00', '17:00', 60),
--   ('seed_at_2', 2, 1, '08:00', '17:00', 60),
--   ('seed_at_3', 3, 1, '08:00', '17:00', 60),
--   ('seed_at_4', 4, 1, '08:00', '17:00', 60),
--   ('seed_at_5', 5, 1, '08:00', '17:00', 60),
--   ('seed_at_6', 6, 0, '08:00', '17:00', 60);

-- ---------------------------------------------------------------------------
-- Tabelle: day_overrides (Iteration 3 — US-17)
-- Individuelle Tages-Überschreibung (z.B. Urlaub, Feiertag, Sondertag).
-- ---------------------------------------------------------------------------
CREATE TABLE day_overrides (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL UNIQUE,                                     -- "YYYY-MM-DD" Berlin-TZ
  is_active   INTEGER NOT NULL
    CHECK (is_active IN (0, 1)),
  start_time  TEXT NULL,                                                -- "HH:MM" oder NULL = Template-Default
  end_time    TEXT NULL,                                                -- "HH:MM" oder NULL = Template-Default
  reason      TEXT NULL,                                                -- "Urlaub", "Feiertag" etc.
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_day_overrides_date ON day_overrides (date);

-- ---------------------------------------------------------------------------
-- Tabelle: booking_attachments (Iteration 3 — US-18)
-- Datei-Anhänge an Buchungen, gehostet auf Vercel Blob.
-- ---------------------------------------------------------------------------
CREATE TABLE booking_attachments (
  id           TEXT PRIMARY KEY,
  booking_id   TEXT NOT NULL,
  url          TEXT NOT NULL,                                           -- Vercel-Blob-URL
  filename     TEXT NOT NULL,                                           -- sanitized
  content_type TEXT NOT NULL,                                           -- image/*, video/mp4, application/pdf
  size_bytes   INTEGER NOT NULL
    CHECK (size_bytes > 0 AND size_bytes <= 20971520),                  -- 20 MB Limit
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
);

CREATE INDEX idx_booking_attachments_booking_id ON booking_attachments (booking_id);

-- ---------------------------------------------------------------------------
-- Tabelle: weekly_availability (Iteration 2 — DEPRECATED in IT3)
-- Bleibt für Bestandsdaten und Migration. Neue UI nutzt availability_template.
-- ---------------------------------------------------------------------------
CREATE TABLE weekly_availability (
  id          TEXT PRIMARY KEY,
  day_of_week INTEGER NOT NULL UNIQUE
    CHECK (day_of_week BETWEEN 0 AND 6),
  is_active   INTEGER NOT NULL DEFAULT 0
    CHECK (is_active IN (0, 1)),
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weekly_availability_day ON weekly_availability (day_of_week);

-- ---------------------------------------------------------------------------
-- Service-Slugs (Konstante, nicht in DB) — Iteration 3 erweitert:
--   'entruempelung'        — Entrümpelungen
--   'entkernung'           — Entkernungsarbeiten
--   'reinigung'            — Reinigungsarbeiten
--   'gruenflaechenpflege'  — Grünflächenpflege
--   'muelltonnenservice'   — Mülltonnenservice
--   'entsorgung'           — Entsorgung von Schrott und Metallen
--   'sonstiges'            — NEU IT3 / US-19: Individuelle Anfrage
-- ---------------------------------------------------------------------------
