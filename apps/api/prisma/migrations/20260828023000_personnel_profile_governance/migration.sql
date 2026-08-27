-- AlterTable
ALTER TABLE "users"
ADD COLUMN "profileFinalizedAt" TIMESTAMP(3),
ADD COLUMN "personnelPhotoFilename" TEXT,
ADD COLUMN "personnelPhotoPath" TEXT,
ADD COLUMN "personnelPhotoMimeType" TEXT,
ADD COLUMN "personnelPhotoSize" INTEGER;

-- CreateTable
CREATE TABLE "sensitive_audit_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensitive_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sensitive_audit_logs_companyId_entityType_entityId_createdAt_idx"
ON "sensitive_audit_logs"("companyId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "sensitive_audit_logs_actorId_createdAt_idx"
ON "sensitive_audit_logs"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "sensitive_audit_logs"
ADD CONSTRAINT "sensitive_audit_logs_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_audit_logs"
ADD CONSTRAINT "sensitive_audit_logs_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
