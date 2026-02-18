-- DropIndex
DROP INDEX "people_uid_key";

-- CreateIndex
CREATE UNIQUE INDEX "people_userId_uid_key" ON "people"("userId", "uid");
