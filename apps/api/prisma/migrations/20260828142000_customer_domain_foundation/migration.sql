-- Phase C: company-scoped customer master data + optional Case -> Customer relation.
-- Customer records are archived, not deleted, in normal product flows.

-- CreateEnum
CREATE TYPE "customer_type" AS ENUM ('INDIVIDUAL', 'LEGAL');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "customer_type" NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "phone" TEXT,
    "nationalId" TEXT,
    "economicCode" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "cases" ADD COLUMN "customerId" TEXT;

-- CreateIndex
CREATE INDEX "customers_companyId_isActive_name_idx"
ON "customers"("companyId", "isActive", "name");

-- CreateIndex
CREATE INDEX "customers_companyId_type_idx"
ON "customers"("companyId", "type");

-- CreateIndex
CREATE INDEX "customers_companyId_mobile_idx"
ON "customers"("companyId", "mobile");

-- CreateIndex
CREATE INDEX "customers_companyId_nationalId_idx"
ON "customers"("companyId", "nationalId");

-- CreateIndex
CREATE INDEX "customers_companyId_economicCode_idx"
ON "customers"("companyId", "economicCode");

-- CreateIndex
CREATE INDEX "cases_companyId_customerId_idx"
ON "cases"("companyId", "customerId");

-- AddForeignKey
ALTER TABLE "customers"
ADD CONSTRAINT "customers_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases"
ADD CONSTRAINT "cases_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
