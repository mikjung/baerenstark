-- Admin password reset tokens (Iteration 4 follow-up)
ALTER TABLE "users" ADD COLUMN "resetToken" TEXT;
ALTER TABLE "users" ADD COLUMN "resetTokenExpiry" DATETIME;
CREATE UNIQUE INDEX "users_resetToken_key" ON "users"("resetToken");
