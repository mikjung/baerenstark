-- CreateTable
CREATE TABLE "buffer_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bookings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slotId" TEXT,
    "date" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "service" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "addressStreet" TEXT,
    "addressZip" TEXT,
    "addressCity" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mailSent" BOOLEAN NOT NULL DEFAULT false,
    "mailError" TEXT,
    "cancelToken" TEXT NOT NULL,
    "counterProposalSlotId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bookings_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slots" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bookings_counterProposalSlotId_fkey" FOREIGN KEY ("counterProposalSlotId") REFERENCES "slots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_bookings" ("cancelToken", "counterProposalSlotId", "createdAt", "customerEmail", "customerId", "customerName", "customerPhone", "date", "description", "endTime", "id", "mailError", "mailSent", "service", "slotId", "startTime", "status", "updatedAt") SELECT "cancelToken", "counterProposalSlotId", "createdAt", "customerEmail", "customerId", "customerName", "customerPhone", "date", "description", "endTime", "id", "mailError", "mailSent", "service", "slotId", "startTime", "status", "updatedAt" FROM "bookings";
DROP TABLE "bookings";
ALTER TABLE "new_bookings" RENAME TO "bookings";
CREATE UNIQUE INDEX "bookings_cancelToken_key" ON "bookings"("cancelToken");
CREATE INDEX "bookings_slotId_idx" ON "bookings"("slotId");
CREATE INDEX "bookings_status_createdAt_idx" ON "bookings"("status", "createdAt");
CREATE INDEX "bookings_counterProposalSlotId_idx" ON "bookings"("counterProposalSlotId");
CREATE INDEX "bookings_date_status_idx" ON "bookings"("date", "status");
CREATE INDEX "bookings_status_date_startTime_idx" ON "bookings"("status", "date", "startTime");
CREATE INDEX "bookings_customerId_date_idx" ON "bookings"("customerId", "date");
CREATE TABLE "new_customer_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verificationTokenExpiry" DATETIME,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "oauthProvider" TEXT,
    "oauthId" TEXT,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_customer_users" ("createdAt", "email", "emailVerified", "firstName", "id", "lastName", "passwordHash", "phone", "resetToken", "resetTokenExpiry", "updatedAt", "verificationToken", "verificationTokenExpiry") SELECT "createdAt", "email", "emailVerified", "firstName", "id", "lastName", "passwordHash", "phone", "resetToken", "resetTokenExpiry", "updatedAt", "verificationToken", "verificationTokenExpiry" FROM "customer_users";
DROP TABLE "customer_users";
ALTER TABLE "new_customer_users" RENAME TO "customer_users";
CREATE UNIQUE INDEX "customer_users_email_key" ON "customer_users"("email");
CREATE UNIQUE INDEX "customer_users_verificationToken_key" ON "customer_users"("verificationToken");
CREATE UNIQUE INDEX "customer_users_resetToken_key" ON "customer_users"("resetToken");
CREATE INDEX "customer_users_email_idx" ON "customer_users"("email");
CREATE INDEX "customer_users_oauthProvider_oauthId_idx" ON "customer_users"("oauthProvider", "oauthId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
