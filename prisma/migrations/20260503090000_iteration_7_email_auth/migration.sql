-- Iteration 7 / US-IT7-01 + US-IT7-05 — Email-Auth-Reaktivierung +
-- Passwort-Reset-Tabelle. Verbindlich gem. ARCHITECTURE_IT7.md §9.
--
-- Schritt 1 (additiv): emailVerifiedAt auf customer_users.
-- Schritt 2 (Plan A): DROP COLUMN auf alte Reset-Felder. libSQL/SQLite
--   ab v3.35 unterstützt das nativ. Falls die libSQL-Version im Prod-
--   Build das nicht unterstützt, siehe `PLAN_B_RECREATE.sql` für das
--   Tabelle-Recreate-Pattern.
-- Schritt 3: neue Tabelle password_reset_tokens (US-IT7-05).
--
-- Roll-back-Strategie (Plan A):
--   ALTER TABLE customer_users DROP COLUMN emailVerifiedAt;
--   ALTER TABLE customer_users ADD COLUMN resetToken TEXT;
--   ALTER TABLE customer_users ADD COLUMN resetTokenExpiry DATETIME;
--   DROP TABLE password_reset_tokens;
--   (UNIQUE-Index-Recreation auf resetToken erforderlich.)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Neue Spalte emailVerifiedAt auf customer_users.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "customer_users" ADD COLUMN "emailVerifiedAt" DATETIME;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Alte Reset-Felder entfernen (Plan A — DROP COLUMN).
--    Falls libSQL/SQLite-Version < 3.35: Plan B (Tabelle-Recreate, siehe
--    PLAN_B_RECREATE.sql in diesem Verzeichnis).
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "customer_users_resetToken_key";
ALTER TABLE "customer_users" DROP COLUMN "resetToken";
ALTER TABLE "customer_users" DROP COLUMN "resetTokenExpiry";

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Neue Tabelle password_reset_tokens (US-IT7-05).
--    SHA-256 hex digest des Klartext-Tokens (64 chars).
--    ON DELETE CASCADE auf customer_users.id — Wipe (US-IT6-06)
--    räumt verwaiste Tokens automatisch ab.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "password_reset_tokens" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "customerId"  TEXT NOT NULL,
    "tokenHash"   TEXT NOT NULL,
    "expiresAt"   DATETIME NOT NULL,
    "usedAt"      DATETIME,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "customer_users" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key"
  ON "password_reset_tokens"("tokenHash");

CREATE INDEX "password_reset_tokens_customerId_expiresAt_idx"
  ON "password_reset_tokens"("customerId", "expiresAt");
