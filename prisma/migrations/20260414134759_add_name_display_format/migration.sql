-- CreateEnum
CREATE TYPE "NameDisplayFormat" AS ENUM ('FULL', 'NICKNAME_PREFERRED', 'SHORT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nameDisplayFormat" "NameDisplayFormat" NOT NULL DEFAULT 'FULL';
