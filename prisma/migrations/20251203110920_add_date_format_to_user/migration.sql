-- CreateEnum
CREATE TYPE "DateFormat" AS ENUM ('MDY', 'DMY', 'YMD');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dateFormat" "DateFormat" NOT NULL DEFAULT 'MDY';
