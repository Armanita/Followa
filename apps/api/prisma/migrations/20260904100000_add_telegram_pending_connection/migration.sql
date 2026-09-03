-- CreateTable
CREATE TABLE "telegram_pending_connections" (
    "telegramUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_pending_connections_pkey" PRIMARY KEY ("telegramUserId")
);

-- CreateIndex
CREATE INDEX "telegram_pending_connections_expiresAt_idx" ON "telegram_pending_connections"("expiresAt");

-- AddForeignKey
ALTER TABLE "telegram_pending_connections" ADD CONSTRAINT "telegram_pending_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
