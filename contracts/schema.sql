-- Bärenstark Hausservice — SQL-Referenz (MVP, v1.2 — Iteration 2)
-- Diese Datei dient als lesbare Referenz. Die produktive Schema-Erstellung
-- erfolgt via `prisma migrate`. Keine direkte Ausführung empfohlen.
--
-- Änderungen v1.2 (Iteration 2):
--   - bookings.cancel_token (UNIQUE) — Aktionslink-Token für Kunden (US-13/US-14).
--   - bookings.counter_proposal_slot_id (FK → slots.id, ON DELETE SET NULL) (US-13).
--   - bookings.status erlaubt jetzt zusätzlich COUNTER_PROPOSED und CANCELLED.
--   - Partial Unique Index erweitert: COUNTER_PROPOSED zählt als "aktive" Buchung.
--   - Neue Tabelle weekly_availability (US-15).
--
-- Änderungen v1.1 (gegenüber v1.0):
--   - BUG-001/006: Partial Unique Index `uniq_active_booking_per_slot`.
--   - BUG-002: Spalten `mail_sent`, `mail_error` in `bookings`.
--   - BUG-003: Spalte `deleted_at` in `slots` (Soft-Delete).
--   - BUG-015: Composite-Index `(starts_at, ends_at)` auf `slots`.

-- ---------------------------------------------------------------------------
-- Tabelle: users
-- Admin-Accounts. Im MVP genau ein Eintrag (Tom). Anlage via Setup-Wizard
-- `/admin/setup`, der nur greift, wenn die Tabelle leer ist.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Tabelle: slots
-- Vom Admin angelegte verfügbare Zeitfenster.
-- Soft-Delete: deleted_at != NULL → Slot ist für GET-Listen unsichtbar.
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
-- Buchungsanfragen von Kunden.
-- status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'COUNTER_PROPOSED' | 'CANCELLED'
-- mail_sent / mail_error: Sichtbarkeit über Resend-Versand-Status (BUG-002).
-- cancel_token (Iteration 2): Aktionslink-Token für Kunden.
-- counter_proposal_slot_id (Iteration 2): vom Admin vorgeschlagener Alternativ-Slot.
-- ---------------------------------------------------------------------------
CREATE TABLE bookings (
  id                        TEXT PRIMARY KEY,
  slot_id                   TEXT NOT NULL,
  customer_name             TEXT NOT NULL,
  customer_phone            TEXT NOT NULL,
  customer_email            TEXT NULL,                                 -- DB-nullable, App-Layer macht es zur Pflicht (Iteration 2)
  service                   TEXT NOT NULL,
  description               TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'COUNTER_PROPOSED', 'CANCELLED')),
  mail_sent                 INTEGER NOT NULL DEFAULT 0   -- 0/1, von Prisma als Boolean gemappt
    CHECK (mail_sent IN (0, 1)),
  mail_error                TEXT NULL,
  cancel_token              TEXT NOT NULL UNIQUE,                      -- ein cuid() pro Booking, lebenslang gültig
  counter_proposal_slot_id  TEXT NULL,                                 -- NULL, solange kein Alternativvorschlag offen ist
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (slot_id) REFERENCES slots (id) ON DELETE RESTRICT,
  FOREIGN KEY (counter_proposal_slot_id) REFERENCES slots (id) ON DELETE SET NULL
);

CREATE INDEX idx_bookings_slot_id                 ON bookings (slot_id);
CREATE INDEX idx_bookings_status_created          ON bookings (status, created_at DESC);
CREATE INDEX idx_bookings_counter_proposal_slot   ON bookings (counter_proposal_slot_id);
CREATE UNIQUE INDEX idx_bookings_cancel_token     ON bookings (cancel_token);

-- ---------------------------------------------------------------------------
-- Partial Unique Index — verhindert Doppelbuchungen auf DB-Ebene (BUG-001/006).
-- Iteration 2: COUNTER_PROPOSED zählt mit, weil ein Slot, für den Admin gerade
-- einen Vorschlag laufen lässt, nicht parallel von einem anderen Kunden gebucht
-- werden darf.
-- SQLite/libSQL unterstützt partial indexes seit langem. Prisma kann diesen
-- Index nicht deklarativ ausdrücken; daher als Raw-SQL-Migration.
--
-- Garantie: pro Slot existiert zu jeder Zeit höchstens EINE Buchung mit
-- Status IN ('PENDING','CONFIRMED','COUNTER_PROPOSED'). REJECTED- und CANCELLED-
-- Bookings sind ausgenommen, der Slot wird damit wieder frei.
--
-- Verstöße führen im Insert/Update zu SQLITE_CONSTRAINT_UNIQUE und werden vom
-- Handler als HTTP 409 (code: CONFLICT) an den Aufrufer gemeldet.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS uniq_active_booking_per_slot;
CREATE UNIQUE INDEX uniq_active_booking_per_slot
  ON bookings (slot_id)
  WHERE status IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED');

-- ---------------------------------------------------------------------------
-- Tabelle: weekly_availability (Iteration 2 — US-15)
-- Wochentag-basierte Verfügbarkeit.
-- Genau 7 Datensätze (dayOfWeek 0–6, 0 = Sonntag, 6 = Samstag).
-- Initial-Seed via Migration (alle 7 Tage, is_active = 0). Admin toggelt Tage
-- via PUT /api/availability.
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
-- Initial-Seed für weekly_availability (Iteration 2 Migration).
-- Alle 7 Wochentage angelegt, is_active = 0 (Admin schaltet selbst frei).
-- IDs sind cuid-Platzhalter — beim Live-Run werden sie via Prisma-Seeder
-- erzeugt; hier nur zur Veranschaulichung.
-- ---------------------------------------------------------------------------
-- INSERT INTO weekly_availability (id, day_of_week, is_active) VALUES
--   ('seed_wa_0', 0, 0),  -- Sonntag
--   ('seed_wa_1', 1, 0),  -- Montag
--   ('seed_wa_2', 2, 0),  -- Dienstag
--   ('seed_wa_3', 3, 0),  -- Mittwoch
--   ('seed_wa_4', 4, 0),  -- Donnerstag
--   ('seed_wa_5', 5, 0),  -- Freitag
--   ('seed_wa_6', 6, 0);  -- Samstag

-- ---------------------------------------------------------------------------
-- Service-Slugs (Konstante, nicht in DB):
--   'entruempelung'        — Entrümpelungen
--   'entkernung'           — Entkernungsarbeiten
--   'reinigung'            — Reinigungsarbeiten
--   'gruenflaechenpflege'  — Grünflächenpflege
--   'muelltonnenservice'   — Mülltonnenservice
--   'entsorgung'           — Entsorgung von Schrott und Metallen
-- ---------------------------------------------------------------------------
