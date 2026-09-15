-- CreateEnum
CREATE TYPE "messaging_channel" AS ENUM (
    'TELEGRAM',
    'BALE',
    'EITAA',
    'WHATSAPP',
    'SMS'
);

-- CreateEnum
CREATE TYPE "messaging_identity_status" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "messaging_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "messaging_channel" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "destinationId" TEXT,
    "status" "messaging_identity_status" NOT NULL DEFAULT 'ACTIVE',
    "verifiedAt" TIMESTAMP(3),
    "verificationMethod" TEXT,
    "legacySource" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_link_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "messaging_channel" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "destinationId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messaging_link_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "messaging_identities_userId_channel_key"
    ON "messaging_identities"("userId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_identities_channel_externalUserId_key"
    ON "messaging_identities"("channel", "externalUserId");

-- CreateIndex
CREATE INDEX "messaging_identities_userId_status_idx"
    ON "messaging_identities"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "messaging_link_challenges_tokenHash_key"
    ON "messaging_link_challenges"("tokenHash");

-- CreateIndex
CREATE INDEX "messaging_link_challenges_userId_channel_consumedAt_idx"
    ON "messaging_link_challenges"("userId", "channel", "consumedAt");

-- CreateIndex
CREATE INDEX "messaging_link_challenges_channel_externalUserId_idx"
    ON "messaging_link_challenges"("channel", "externalUserId");

-- CreateIndex
CREATE INDEX "messaging_link_challenges_expiresAt_idx"
    ON "messaging_link_challenges"("expiresAt");

-- AddForeignKey
ALTER TABLE "messaging_identities"
    ADD CONSTRAINT "messaging_identities_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging_link_challenges"
    ADD CONSTRAINT "messaging_link_challenges_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
