/*
  Warnings:

  - You are about to drop the column `role` on the `people` table. All the data in the column will be lost.
  - You are about to drop the column `isPrimary` on the `person_addresses` table. All the data in the column will be lost.
  - You are about to drop the column `street` on the `person_addresses` table. All the data in the column will be lost.
  - You are about to drop the column `isPrimary` on the `person_emails` table. All the data in the column will be lost.
  - You are about to drop the column `isPrimary` on the `person_phones` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `person_urls` table. All the data in the column will be lost.

*/
-- AlterTable: Remove role field from people
ALTER TABLE "people" DROP COLUMN "role";

-- AlterTable: Replace street with streetLine1 and streetLine2, remove isPrimary
ALTER TABLE "person_addresses" DROP COLUMN "isPrimary",
DROP COLUMN "street",
ADD COLUMN     "streetLine1" TEXT,
ADD COLUMN     "streetLine2" TEXT;

-- AlterTable: Remove isPrimary from emails
ALTER TABLE "person_emails" DROP COLUMN "isPrimary";

-- AlterTable: Remove isPrimary from phones
ALTER TABLE "person_phones" DROP COLUMN "isPrimary";

-- AlterTable: Remove label from urls
ALTER TABLE "person_urls" DROP COLUMN "label";
