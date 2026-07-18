-- AlterTable
ALTER TABLE "person_addresses" ADD COLUMN     "geocodeHash" TEXT,
ADD COLUMN     "geocodeStatus" TEXT,
ADD COLUMN     "geocodedAt" TIMESTAMP(3),
ADD COLUMN     "latitude" DECIMAL(10,8),
ADD COLUMN     "longitude" DECIMAL(11,8);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "geocodingEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "geocode_cache" (
    "hash" TEXT NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "person_addresses_geocodeStatus_idx" ON "person_addresses"("geocodeStatus");
