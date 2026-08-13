-- AlterEnum
ALTER TYPE "ReminderEntityType" ADD VALUE 'WEEKLY_DIGEST';

-- AlterTable
ALTER TABLE "important_dates" ADD COLUMN     "lastLeadReminderSent" TIMESTAMP(3),
ADD COLUMN     "reminderLeadDays" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "defaultReminderLeadDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastWeeklyDigestSent" TIMESTAMP(3),
ADD COLUMN     "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyDigestWeekday" INTEGER NOT NULL DEFAULT 1;
