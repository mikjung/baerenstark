-- Iteration 7 / m3-IT7 — Plan B (Tabelle-Recreate) für `customer_users`.
--
-- Verwende dieses Skript NUR, wenn `migration.sql` (Plan A) im Cloud-Build
-- mit „DROP COLUMN not supported"-Fehler abbricht. libSQL/Turso unterstützt
-- DROP COLUMN seit v3.35 — falls aus irgendeinem Grund die DB älter ist
-- oder eine bestimmte Strict-Mode-Konfiguration aktiv ist, ersetzt dieses
-- Skript den DROP-COLUMN-Block durch das klassische SQLite-Recreate-Pattern.
--
-- WICHTIG: Falls Plan B benötigt wird, ersetzt der Engineer den
-- entsprechenden Block in `migration.sql` (Schritt 2) durch das hier
-- aufgeführte SQL. Plan A bleibt der Default.
--
-- Roll-back: identisch zu Plan A — siehe Kopfkommentar in migration.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- Plan B: customer_users-Recreate ohne resetToken / resetTokenExpiry.
-- ─────────────────────────────────────────────────────────────────────────────

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- 1. neue Tabelle ohne die zu entfernenden Spalten.
CREATE TABLE "new_customer_users" (
    "id"                      TEXT NOT NULL PRIMARY KEY,
    "email"                   TEXT NOT NULL,
    "passwordHash"            TEXT,
    "firstName"               TEXT NOT NULL,
    "lastName"                TEXT NOT NULL,
    "phone"                   TEXT,
    "emailVerified"           BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt"         DATETIME,
    "verificationToken"       TEXT,
    "verificationTokenExpiry" DATETIME,
    "oauthProvider"           TEXT,
    "oauthId"                 TEXT,
    "avatarUrl"               TEXT,
    "adminNote"               TEXT,
    "adminRating"             INTEGER,
    "createdAt"               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               DATETIME NOT NULL
);

-- 2. Daten kopieren (resetToken/resetTokenExpiry werden NICHT übernommen).
INSERT INTO "new_customer_users" (
  "id", "email", "passwordHash", "firstName", "lastName", "phone",
  "emailVerified", "emailVerifiedAt",
  "verificationToken", "verificationTokenExpiry",
  "oauthProvider", "oauthId", "avatarUrl",
  "adminNote", "adminRating",
  "createdAt", "updatedAt"
)
SELECT
  "id", "email", "passwordHash", "firstName", "lastName", "phone",
  "emailVerified", NULL,
  "verificationToken", "verificationTokenExpiry",
  "oauthProvider", "oauthId", "avatarUrl",
  "adminNote", "adminRating",
  "createdAt", "updatedAt"
FROM "customer_users";

-- 3. alte Tabelle droppen + neue Tabelle umbenennen.
DROP TABLE "customer_users";
ALTER TABLE "new_customer_users" RENAME TO "customer_users";

-- 4. Indizes neu anlegen (Bestand aus IT4–IT6).
CREATE UNIQUE INDEX "customer_users_email_key"
  ON "customer_users"("email");
CREATE UNIQUE INDEX "customer_users_verificationToken_key"
  ON "customer_users"("verificationToken");
CREATE INDEX "customer_users_email_idx"
  ON "customer_users"("email");
CREATE INDEX "customer_users_oauthProvider_oauthId_idx"
  ON "customer_users"("oauthProvider", "oauthId");
CREATE INDEX "customer_users_lastName_firstName_idx"
  ON "customer_users"("lastName", "firstName");
CREATE INDEX "customer_users_adminRating_idx"
  ON "customer_users"("adminRating");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- 5. Anschließend Schritt 3 aus migration.sql (CREATE TABLE
--    password_reset_tokens) ausführen. Plan B ersetzt NUR den Schritt 2
--    aus Plan A.
