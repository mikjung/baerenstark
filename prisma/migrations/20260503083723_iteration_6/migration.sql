-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "finalPriceEur" DECIMAL;
ALTER TABLE "bookings" ADD COLUMN "finalPriceNote" TEXT;

-- AlterTable
ALTER TABLE "customer_users" ADD COLUMN "adminNote" TEXT;
ALTER TABLE "customer_users" ADD COLUMN "adminRating" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "bookingId" TEXT,
    "stars" INTEGER NOT NULL,
    "text" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "rejectedAt" DATETIME,
    "moderatedById" TEXT,
    "moderatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reviews_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_reviews" ("approved", "bookingId", "createdAt", "customerId", "id", "stars", "text", "updatedAt") SELECT "approved", "bookingId", "createdAt", "customerId", "id", "stars", "text", "updatedAt" FROM "reviews";
DROP TABLE "reviews";
ALTER TABLE "new_reviews" RENAME TO "reviews";
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");
CREATE INDEX "reviews_approved_createdAt_idx" ON "reviews"("approved", "createdAt");
CREATE INDEX "reviews_approved_rejectedAt_createdAt_idx" ON "reviews"("approved", "rejectedAt", "createdAt");
CREATE INDEX "reviews_customerId_idx" ON "reviews"("customerId");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("createdAt", "email", "id", "name", "passwordHash", "resetToken", "resetTokenExpiry") SELECT "createdAt", "email", "id", "name", "passwordHash", "resetToken", "resetTokenExpiry" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");
CREATE INDEX "users_status_idx" ON "users"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "bookings_customerId_status_idx" ON "bookings"("customerId", "status");

-- CreateIndex
CREATE INDEX "customer_users_lastName_firstName_idx" ON "customer_users"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "customer_users_adminRating_idx" ON "customer_users"("adminRating");
