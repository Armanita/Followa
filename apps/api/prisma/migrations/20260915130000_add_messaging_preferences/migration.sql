-- P6 is additive storage only. Dispatch and OTP do not read these tables yet.
CREATE TABLE "messaging_system_policies" (
    "channel" "messaging_channel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "notificationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "otpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "messaging_system_policies_pkey" PRIMARY KEY ("channel")
);

CREATE TABLE "company_messaging_policies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channel" "messaging_channel" NOT NULL,
    "notificationEnabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_messaging_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "membership_messaging_preferences" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "channel" "messaging_channel" NOT NULL,
    "notificationEnabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "membership_messaging_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_messaging_preferences" (
    "userId" TEXT NOT NULL,
    "otpChannel" "messaging_channel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_messaging_preferences_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "company_messaging_policies_companyId_channel_key"
ON "company_messaging_policies"("companyId", "channel");
CREATE UNIQUE INDEX "membership_messaging_preferences_membershipId_channel_key"
ON "membership_messaging_preferences"("membershipId", "channel");

ALTER TABLE "company_messaging_policies"
ADD CONSTRAINT "company_messaging_policies_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "membership_messaging_preferences"
ADD CONSTRAINT "membership_messaging_preferences_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_messaging_preferences"
ADD CONSTRAINT "user_messaging_preferences_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
