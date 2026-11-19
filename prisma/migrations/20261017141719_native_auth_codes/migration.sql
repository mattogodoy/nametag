-- CreateTable
CREATE TABLE "native_auth_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "appVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "native_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "native_auth_codes_codeHash_key" ON "native_auth_codes"("codeHash");

-- CreateIndex
CREATE INDEX "native_auth_codes_expiresAt_idx" ON "native_auth_codes"("expiresAt");

-- AddForeignKey
ALTER TABLE "native_auth_codes" ADD CONSTRAINT "native_auth_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
