-- Iteration 12 / US-IT12-15 — Marketing-E-Mail-Feature.
-- ARCHITECTURE_IT12.md §R.5 (DSGVO Variante 3, stateless HMAC-Tokens).
--
-- Diff:
--   1. customer_users: 2 neue Spalten + Sparse-Index für Filter-Performance.
--      `unsubscribedAt`     — NULL = aktiv (Default), Wert = abgemeldet.
--      `unsubscribedReason` — optionaler Grund ('EMAIL_FOOTER' / 'ADMIN').
--   2. NEU: marketing_emails — Audit-Trail pro Versand.
--   3. NEU: marketing_email_recipients — Pro-Empfänger-Audit + Status.
--   4. NEU: idempotency_keys — Cache für POST /api/bookings (IT12-S11/M8).
--
-- Backwards-compatible: alle Bestand-Customer haben unsubscribedAt=NULL
-- (= aktiv im Sinne der UWG §7 Abs. 3 Bestandskunden-Sonderregel).

-- 1. CustomerUser-Felder.
ALTER TABLE "customer_users" ADD COLUMN "unsubscribedAt"     DATETIME;
ALTER TABLE "customer_users" ADD COLUMN "unsubscribedReason" TEXT;
CREATE INDEX "customer_users_unsubscribedAt_idx" ON "customer_users"("unsubscribedAt");

-- 2. MarketingEmail.
CREATE TABLE "marketing_emails" (
  "id"             TEXT PRIMARY KEY,
  "sentByAdminId"  TEXT NOT NULL,
  "subject"        TEXT NOT NULL,
  "bodyText"       TEXT NOT NULL,
  "filterServices" TEXT NOT NULL,
  "recipientCount" INTEGER NOT NULL,
  "successCount"   INTEGER NOT NULL DEFAULT 0,
  "failureCount"   INTEGER NOT NULL DEFAULT 0,
  "status"         TEXT NOT NULL DEFAULT 'draft',
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"    DATETIME,
  CONSTRAINT "marketing_emails_sentByAdmin_fk"
    FOREIGN KEY ("sentByAdminId") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "marketing_emails_sentByAdmin_createdAt_idx"
  ON "marketing_emails"("sentByAdminId", "createdAt");
CREATE INDEX "marketing_emails_status_createdAt_idx"
  ON "marketing_emails"("status", "createdAt");

-- 3. MarketingEmailRecipient.
CREATE TABLE "marketing_email_recipients" (
  "id"               TEXT PRIMARY KEY,
  "marketingEmailId" TEXT NOT NULL,
  "customerId"       TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'PENDING',
  "resendMessageId"  TEXT,
  "errorMessage"     TEXT,
  "sentAt"           DATETIME,
  "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mer_marketingEmail_fk"
    FOREIGN KEY ("marketingEmailId") REFERENCES "marketing_emails"("id") ON DELETE CASCADE,
  CONSTRAINT "mer_customer_fk"
    FOREIGN KEY ("customerId") REFERENCES "customer_users"("id") ON DELETE CASCADE
);
CREATE INDEX "mer_marketingEmail_status_idx"
  ON "marketing_email_recipients"("marketingEmailId", "status");
CREATE INDEX "mer_customer_idx"
  ON "marketing_email_recipients"("customerId");
CREATE INDEX "mer_sentAt_idx"
  ON "marketing_email_recipients"("sentAt");

-- 4. IdempotencyKey (IT12-S11).
CREATE TABLE "idempotency_keys" (
  "id"        TEXT PRIMARY KEY,
  "key"       TEXT NOT NULL UNIQUE,
  "scope"     TEXT,
  "response"  TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");
