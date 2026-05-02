-- CreateTable
CREATE TABLE "availability_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayOfWeek" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT NOT NULL DEFAULT '08:00',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "day_overrides" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "booking_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_attachments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    CONSTRAINT "bookings_counterProposalSlotId_fkey" FOREIGN KEY ("counterProposalSlotId") REFERENCES "slots" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_bookings" ("cancelToken", "counterProposalSlotId", "createdAt", "customerEmail", "customerName", "customerPhone", "description", "id", "mailError", "mailSent", "service", "slotId", "status", "updatedAt") SELECT "cancelToken", "counterProposalSlotId", "createdAt", "customerEmail", "customerName", "customerPhone", "description", "id", "mailError", "mailSent", "service", "slotId", "status", "updatedAt" FROM "bookings";
DROP TABLE "bookings";
ALTER TABLE "new_bookings" RENAME TO "bookings";
CREATE UNIQUE INDEX "bookings_cancelToken_key" ON "bookings"("cancelToken");
CREATE INDEX "bookings_slotId_idx" ON "bookings"("slotId");
CREATE INDEX "bookings_status_createdAt_idx" ON "bookings"("status", "createdAt");
CREATE INDEX "bookings_counterProposalSlotId_idx" ON "bookings"("counterProposalSlotId");
CREATE INDEX "bookings_date_status_idx" ON "bookings"("date", "status");
CREATE INDEX "bookings_status_date_startTime_idx" ON "bookings"("status", "date", "startTime");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "availability_template_dayOfWeek_key" ON "availability_template"("dayOfWeek");

-- CreateIndex
CREATE INDEX "availability_template_dayOfWeek_idx" ON "availability_template"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "day_overrides_date_key" ON "day_overrides"("date");

-- CreateIndex
CREATE INDEX "day_overrides_date_idx" ON "day_overrides"("date");

-- CreateIndex
CREATE INDEX "booking_attachments_bookingId_idx" ON "booking_attachments"("bookingId");
