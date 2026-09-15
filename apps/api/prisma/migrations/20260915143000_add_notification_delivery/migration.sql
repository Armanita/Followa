-- P7 is additive storage only. Existing notification reads and sends are unchanged.
CREATE TYPE "notification_delivery_status" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "notification_delivery_attempt_outcome" AS ENUM ('SENT', 'FAILED');

ALTER TABLE "notifications" ADD COLUMN "companyId" TEXT;

CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "messaging_channel" NOT NULL,
    "messagingIdentityId" TEXT,
    "identityVersion" INTEGER,
    "destinationId" TEXT NOT NULL,
    "status" "notification_delivery_status" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_delivery_attempts" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "outcome" "notification_delivery_attempt_outcome" NOT NULL,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_companyId_createdAt_idx" ON "notifications"("companyId", "createdAt");
CREATE UNIQUE INDEX "notification_deliveries_notificationId_channel_key" ON "notification_deliveries"("notificationId", "channel");
CREATE INDEX "notification_deliveries_status_availableAt_idx" ON "notification_deliveries"("status", "availableAt");
CREATE INDEX "notification_deliveries_messagingIdentityId_idx" ON "notification_deliveries"("messagingIdentityId");
CREATE UNIQUE INDEX "notification_delivery_attempts_deliveryId_attemptNumber_key" ON "notification_delivery_attempts"("deliveryId", "attemptNumber");
CREATE INDEX "notification_delivery_attempts_deliveryId_attemptedAt_idx" ON "notification_delivery_attempts"("deliveryId", "attemptedAt");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_deliveries"
ADD CONSTRAINT "notification_deliveries_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_deliveries"
ADD CONSTRAINT "notification_deliveries_messagingIdentityId_fkey"
FOREIGN KEY ("messagingIdentityId") REFERENCES "messaging_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_delivery_attempts"
ADD CONSTRAINT "notification_delivery_attempts_deliveryId_fkey"
FOREIGN KEY ("deliveryId") REFERENCES "notification_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
