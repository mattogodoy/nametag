-- AlterTable: Add user-level OCR toggle
ALTER TABLE "google_integrations" ADD COLUMN "ocrEnabled" BOOLEAN NOT NULL DEFAULT true;
