-- CreateTable
CREATE TABLE "customer_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verificationTokenExpiry" DATETIME,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "bookingId" TEXT,
    "stars" INTEGER NOT NULL,
    "text" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "service" TEXT NOT NULL,
    "description" TEXT NOT NULL,
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
INSERT INTO "new_bookings" ("cancelToken", "counterProposalSlotId", "createdAt", "customerEmail", "customerName", "customerPhone", "date", "description", "endTime", "id", "mailError", "mailSent", "service", "slotId", "startTime", "status", "updatedAt") SELECT "cancelToken", "counterProposalSlotId", "createdAt", "customerEmail", "customerName", "customerPhone", "date", "description", "endTime", "id", "mailError", "mailSent", "service", "slotId", "startTime", "status", "updatedAt" FROM "bookings";
DROP TABLE "bookings";
ALTER TABLE "new_bookings" RENAME TO "bookings";
CREATE UNIQUE INDEX "bookings_cancelToken_key" ON "bookings"("cancelToken");
CREATE INDEX "bookings_slotId_idx" ON "bookings"("slotId");
CREATE INDEX "bookings_status_createdAt_idx" ON "bookings"("status", "createdAt");
CREATE INDEX "bookings_counterProposalSlotId_idx" ON "bookings"("counterProposalSlotId");
CREATE INDEX "bookings_date_status_idx" ON "bookings"("date", "status");
CREATE INDEX "bookings_status_date_startTime_idx" ON "bookings"("status", "date", "startTime");
CREATE INDEX "bookings_customerId_date_idx" ON "bookings"("customerId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "customer_users_email_key" ON "customer_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_users_verificationToken_key" ON "customer_users"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "customer_users_resetToken_key" ON "customer_users"("resetToken");

-- CreateIndex
CREATE INDEX "customer_users_email_idx" ON "customer_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "payments_bookingId_key" ON "payments"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripeSessionId_key" ON "payments"("stripeSessionId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_stripeSessionId_idx" ON "payments"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");

-- CreateIndex
CREATE INDEX "reviews_approved_createdAt_idx" ON "reviews"("approved", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_customerId_idx" ON "reviews"("customerId");
