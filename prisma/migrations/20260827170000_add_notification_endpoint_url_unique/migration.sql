-- CreateIndex
CREATE UNIQUE INDEX "notification_endpoints_userId_url_key" ON "notification_endpoints"("userId", "url");
