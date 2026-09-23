-- AlterTable
ALTER TABLE "reminders" ADD COLUMN "notifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "reminders_status_remindAt_idx" ON "reminders"("status", "remindAt");
