-- Bärenstark Hausservice — SQL-Referenz (MVP, v1.5 — Iteration 5)
-- Diese Datei dient als lesbare Referenz. Die produktive Schema-Erstellung
-- erfolgt via `prisma migrate`. Keine direkte Ausführung empfohlen.
--
-- Änderungen v1.5 (Iteration 5 — US-30 bis US-34):
--   - customer_users:
--       * password_hash wird NULLABLE (US-31: OAuth-only-Konten ohne lokales Pw).
--       * NEUE Spalten: oauth_provider, oauth_id, avatar_url (alle NULL).
--       * NEUER Index idx_customer_users_oauth (oauth_provider, oauth_id).
--   - bookings:
--       * NEUE Spalten: address_street, address_zip, address_city (alle NULL
--         im DB-Schema; API-Layer macht sie ab IT5 Pflicht für neue Buchungen).
--       * NEUE Spalte: duration_minutes INTEGER NOT NULL DEFAULT 60.
--   - NEUE Tabelle: buffer_config (Singleton, US-34). Default-Wert
--     30 Minuten wird beim ersten Lesen on-the-fly geseedet.
--   - US-30 (Admin-Pw-Reset UX): kein Schema-Eingriff — `users.reset_token`
--     existiert bereits seit IT4-Vorarbeit (siehe Live-Schema).
--
-- Änderungen v1.4.1 (Iteration 4 — QA-Revision: BUG-401):
--   - customer_users: NEUE Spalte verification_token_expiry DATETIME NULL
--     (BUG-401-Fix). Wird bei Registrierung UND bei resend-verification
--     auf now+24h gesetzt. Verifikation prüft nun gegen diese Spalte
--     statt gegen created_at.
--   - BUG-402 (E-Mail-Änderung): kein Schema-Eingriff — die Funktion
--     wird im MVP NICHT angeboten (siehe ARCHITECTURE.md §17.1). Das
--     Schema ist bereits korrekt; ein pending_email-Mechanismus bleibt
--     Backlog (IT5).
--   - MAJOR-403 (Review.customer_name): kein Schema-Eingriff — Anzeige-
--     name wird per Live-Join aus customer_users.first_name/last_name
--     gebildet. Fallback "Anonym" bei customer_id IS NULL.
--
-- Änderungen v1.4 (Iteration 4 — US-25 bis US-29):
--   - NEUE Tabelle customer_users (US-25): Kunden-Auth, separat von users.
--   - NEUE Tabelle payments (US-28): Stripe-Zahlung 1:1 zu Booking.
--   - NEUE Tabelle reviews (US-29): Kundenbewertungen mit Admin-Freigabe.
--   - bookings: NEU customer_id (FK → customer_users, ON DELETE SET NULL).
--   - bookings.status: COMPLETED zusätzlich erlaubt (neuer Endstatus).
--   - Partial Unique Index uniq_active_booking_per_timeslot bleibt
--     unverändert (COMPLETED zählt nicht als aktiv — Termin ist vergangen).
--
-- Änderungen v1.3 (Iteration 3): availability_template, day_overrides,
-- booking_attachments, bookings.date/start_time/end_time.
--
-- Änderungen v1.2 (Iteration 2): bookings.cancel_token,
-- bookings.counter_proposal_slot_id, weekly_availability,
-- BookingStatus COUNTER_PROPOSED + CANCELLED.
--
-- Änderungen v1.1: Soft-Delete, Mail-Reliability, Partial Unique Index.

-- ---------------------------------------------------------------------------
-- Tabelle: users (Admin-User, unverändert)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Tabelle: customer_users (Iteration 4 — US-25)
--
-- Kunden-Auth, vollständig getrennt vom Admin-`users`. Eigenes Cookie
-- (`customer-session`), eigene Endpunkte (`/api/customer/*`).
-- ---------------------------------------------------------------------------
CREATE TABLE customer_users (
  id                          TEXT PRIMARY KEY,
  email                       TEXT NOT NULL UNIQUE,             -- lowercase, normalisiert
  -- IT5 / US-31: NULLABLE — OAuth-only-Konten ohne lokales Passwort.
  password_hash               TEXT NULL,                         -- bcrypt cost 10
  first_name                  TEXT NOT NULL,
  last_name                   TEXT NOT NULL,
  phone                       TEXT NULL,
  email_verified              INTEGER NOT NULL DEFAULT 0
    CHECK (email_verified IN (0, 1)),
  verification_token          TEXT NULL UNIQUE,                  -- cuid, gesetzt bei Reg.
  verification_token_expiry   DATETIME NULL,                     -- 24h nach Erstellung (BUG-401-Fix v1.4.1)
                                                                 --   wird bei resend-verification mit-aktualisiert.
  reset_token                 TEXT NULL UNIQUE,                  -- cuid, gesetzt bei Forgot
  reset_token_expiry          DATETIME NULL,                     -- 1h nach Anfrage
  -- IT5 / US-31: OAuth2-Verknüpfung (Google + GitHub).
  oauth_provider              TEXT NULL,                         -- 'google' | 'github' | NULL
  oauth_id                    TEXT NULL,                         -- Provider-spezifische User-ID
  avatar_url                  TEXT NULL,                         -- Profilbild-URL vom Provider
  created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_users_email ON customer_users (email);
-- IT5 / US-31: Index für OAuth-Callback-Lookup (Provider+ID).
CREATE INDEX idx_customer_users_oauth ON customer_users (oauth_provider, oauth_id);

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
-- IT4: customer_id NEU; status erlaubt COMPLETED zusätzlich.
-- ---------------------------------------------------------------------------
CREATE TABLE bookings (
  id                        TEXT PRIMARY KEY,
  -- IT1/IT2-Modus (Bestand): slot_id gesetzt, date/start_time/end_time NULL.
  slot_id                   TEXT NULL,
  -- IT3-Modus: date/start_time/end_time gesetzt, slot_id NULL.
  date                      TEXT NULL,                                  -- "YYYY-MM-DD" Berlin-TZ
  start_time                TEXT NULL,                                  -- "HH:MM" Berlin-TZ
  end_time                  TEXT NULL,                                  -- "HH:MM" Berlin-TZ
  -- IT5 / US-33: vom Kunden gewählte Auftragsdauer in Minuten.
  -- end_time = start_time + duration_minutes (App-Layer berechnet).
  duration_minutes          INTEGER NOT NULL DEFAULT 60
    CHECK (duration_minutes >= 15 AND duration_minutes <= 1440),
  -- IT4 (US-25/26): optionale Verknüpfung mit Kundenkonto.
  customer_id               TEXT NULL,
  customer_name             TEXT NOT NULL,
  customer_phone            TEXT NOT NULL,
  customer_email            TEXT NULL,
  service                   TEXT NOT NULL,                              -- Slug-Liste siehe Footer
  description               TEXT NOT NULL,
  -- IT5 / US-32: Adresse des Auftragsorts. DB-nullable für Bestand,
  -- API-Layer macht alle drei Felder ab IT5 Pflicht für neue Buchungen.
  address_street            TEXT NULL,                                  -- "Musterstraße 12"
  address_zip               TEXT NULL,                                  -- "64283" (5 Ziffern, App-Validierung)
  address_city              TEXT NULL,                                  -- "Darmstadt"
  status                    TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'COUNTER_PROPOSED', 'CANCELLED', 'COMPLETED')),
  mail_sent                 INTEGER NOT NULL DEFAULT 0
    CHECK (mail_sent IN (0, 1)),
  mail_error                TEXT NULL,
  cancel_token              TEXT NOT NULL UNIQUE,
  counter_proposal_slot_id  TEXT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (slot_id) REFERENCES slots (id) ON DELETE RESTRICT,
  FOREIGN KEY (counter_proposal_slot_id) REFERENCES slots (id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customer_users (id) ON DELETE SET NULL,
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
-- IT4-Index für Kundenportal-Listen (`GET /api/customer/bookings`).
CREATE INDEX idx_bookings_customer_id_date        ON bookings (customer_id, date);

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
-- COMPLETED zählt NICHT als aktiv (Termin liegt in der Vergangenheit; eine
-- Doppelbuchung auf vergangene Slots ist ohnehin durch das
-- "date-in-Zukunft"-Check ausgeschlossen, das bei `POST /api/bookings`
-- erzwungen wird).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS uniq_active_booking_per_timeslot;
CREATE UNIQUE INDEX uniq_active_booking_per_timeslot
  ON bookings (date, start_time, end_time)
  WHERE date IS NOT NULL
    AND status IN ('PENDING', 'CONFIRMED', 'COUNTER_PROPOSED');

-- ---------------------------------------------------------------------------
-- Tabelle: availability_template (Iteration 3 — US-17, unverändert IT4)
-- ---------------------------------------------------------------------------
CREATE TABLE availability_template (
  id                    TEXT PRIMARY KEY,
  day_of_week           INTEGER NOT NULL UNIQUE
    CHECK (day_of_week BETWEEN 0 AND 6),
  is_active             INTEGER NOT NULL DEFAULT 0
    CHECK (is_active IN (0, 1)),
  start_time            TEXT NOT NULL DEFAULT '08:00',
  end_time              TEXT NOT NULL DEFAULT '17:00',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (slot_duration_minutes >= 15 AND slot_duration_minutes <= 480),
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_availability_template_day ON availability_template (day_of_week);

-- ---------------------------------------------------------------------------
-- Tabelle: day_overrides (Iteration 3 — US-17, unverändert IT4)
-- ---------------------------------------------------------------------------
CREATE TABLE day_overrides (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL UNIQUE,
  is_active   INTEGER NOT NULL
    CHECK (is_active IN (0, 1)),
  start_time  TEXT NULL,
  end_time    TEXT NULL,
  reason      TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_day_overrides_date ON day_overrides (date);

-- ---------------------------------------------------------------------------
-- Tabelle: booking_attachments (Iteration 3 — US-18, unverändert IT4)
-- IT3-Patch: booking_id ist nullable (Upload vor Booking-Insert).
-- ---------------------------------------------------------------------------
CREATE TABLE booking_attachments (
  id           TEXT PRIMARY KEY,
  booking_id   TEXT NULL,
  url          TEXT NOT NULL,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL
    CHECK (size_bytes > 0 AND size_bytes <= 20971520),
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
);

CREATE INDEX idx_booking_attachments_booking_id ON booking_attachments (booking_id);

-- ---------------------------------------------------------------------------
-- Tabelle: weekly_availability (Iteration 2 — DEPRECATED in IT3, unverändert IT4)
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
-- Tabelle: payments (Iteration 4 — US-28)
--
-- 1:1 zu Booking. Tom legt sie an via POST /api/admin/bookings/:id/payment.
-- Stripe-Webhook aktualisiert status + paid_at.
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
  id                  TEXT PRIMARY KEY,
  booking_id          TEXT NOT NULL UNIQUE,
  stripe_session_id   TEXT NULL UNIQUE,                                  -- "cs_test_..." / "cs_live_..."
  amount              INTEGER NOT NULL                                    -- in Cents
    CHECK (amount > 0),
  currency            TEXT NOT NULL DEFAULT 'eur',
  description         TEXT NULL,                                          -- Stripe-Checkout-Description
  status              TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  paid_at             DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
);

CREATE INDEX idx_payments_status            ON payments (status);
CREATE INDEX idx_payments_stripe_session_id ON payments (stripe_session_id);

-- ---------------------------------------------------------------------------
-- Tabelle: reviews (Iteration 4 — US-29)
--
-- 1:1 zu Booking, optional zu CustomerUser. Pro Buchung max. EINE Review.
-- approved=0 ist Default, Admin gibt manuell frei (PATCH /api/admin/reviews/:id).
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NULL,
  booking_id  TEXT NULL UNIQUE,                                          -- 1:1 (Pro Buchung max. eine Review)
  stars       INTEGER NOT NULL
    CHECK (stars BETWEEN 1 AND 5),
  text        TEXT NULL,                                                  -- max 500 Zeichen (App-Layer)
  approved    INTEGER NOT NULL DEFAULT 0
    CHECK (approved IN (0, 1)),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customer_users (id) ON DELETE SET NULL,
  FOREIGN KEY (booking_id)  REFERENCES bookings (id)       ON DELETE SET NULL
);

-- Composite-Index für öffentliches GET /api/reviews (approved=1, sortiert nach Datum).
CREATE INDEX idx_reviews_approved_created  ON reviews (approved, created_at DESC);
CREATE INDEX idx_reviews_customer_id       ON reviews (customer_id);

-- ---------------------------------------------------------------------------
-- Tabelle: buffer_config (Iteration 5 — US-34)
--
-- Singleton — genau ein Datensatz darf existieren. Default-Wert 30 Minuten
-- wird beim ersten Lesen on-the-fly geseedet. App-Layer validiert auf
-- Whitelist [0, 15, 30, 45, 60]; DB CHECK lässt Forward-Kompatibilität
-- (z.B. 90/120) offen.
-- ---------------------------------------------------------------------------
CREATE TABLE buffer_config (
  id              TEXT PRIMARY KEY,
  buffer_minutes  INTEGER NOT NULL DEFAULT 30
    CHECK (buffer_minutes >= 0 AND buffer_minutes <= 240),
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Service-Slugs (Konstante, nicht in DB) — Iteration 3 erweitert:
--   'entruempelung'        — Entrümpelungen
--   'entkernung'           — Entkernungsarbeiten
--   'reinigung'            — Reinigungsarbeiten
--   'gruenflaechenpflege'  — Grünflächenpflege
--   'muelltonnenservice'   — Mülltonnenservice
--   'entsorgung'           — Entsorgung von Schrott und Metallen
--   'sonstiges'            — Individuelle Anfrage (US-19)
-- ---------------------------------------------------------------------------
