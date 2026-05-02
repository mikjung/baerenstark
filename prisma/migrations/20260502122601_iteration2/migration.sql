/*
  Warnings:

  - The required column `cancelToken` was added to the `bookings` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateTable
CREATE TABLE "weekly_availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayOfWeek" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bookings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slotId" TEXT NOT NULL,
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
INSERT INTO "new_bookings" ("createdAt", "customerEmail", "customerName", "customerPhone", "description", "id", "mailError", "mailSent", "service", "slotId", "status", "updatedAt") SELECT "createdAt", "customerEmail", "customerName", "customerPhone", "description", "id", "mailError", "mailSent", "service", "slotId", "status", "updatedAt" FROM "bookings";
DROP TABLE "bookings";
ALTER TABLE "new_bookings" RENAME TO "bookings";
CREATE UNIQUE INDEX "bookings_cancelToken_key" ON "bookings"("cancelToken");
CREATE INDEX "bookings_slotId_idx" ON "bookings"("slotId");
CREATE INDEX "bookings_status_createdAt_idx" ON "bookings"("status", "createdAt");
CREATE INDEX "bookings_counterProposalSlotId_idx" ON "bookings"("counterProposalSlotId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "weekly_availability_dayOfWeek_key" ON "weekly_availability"("dayOfWeek");

-- CreateIndex
CREATE INDEX "weekly_availability_dayOfWeek_idx" ON "weekly_availability"("dayOfWeek");
