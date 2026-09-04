-- CreateTable
CREATE TABLE "telegram_identities" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_identities_telegramUserId_key" ON "telegram_identities"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_identities_userId_key" ON "telegram_identities"("userId");

-- AddForeignKey
ALTER TABLE "telegram_identities" ADD CONSTRAINT "telegram_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;