/*
  Warnings:

  - You are about to drop the column `fullName` on the `people` table. All the data in the column will be lost.
  - Added the required column `name` to the `people` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "people_userId_fullName_idx";

-- AlterTable
ALTER TABLE "people" DROP COLUMN "fullName",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "surname" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "surname" TEXT,
ALTER COLUMN "name" SET NOT NULL;

-- CreateIndex
CREATE INDEX "people_userId_name_idx" ON "people"("userId", "name");

-- CreateIndex
CREATE INDEX "people_userId_surname_idx" ON "people"("userId", "surname");

-- CreateIndex
CREATE INDEX "people_userId_nickname_idx" ON "people"("userId", "nickname");
