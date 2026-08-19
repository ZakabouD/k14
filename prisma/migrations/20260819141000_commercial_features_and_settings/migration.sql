-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "childrenCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cin" TEXT,
ADD COLUMN     "cnss" TEXT,
ADD COLUMN     "contractType" TEXT,
ADD COLUMN     "exitDate" TIMESTAMP(3),
ADD COLUMN     "exitReason" TEXT,
ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "isExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maritalStatus" TEXT,
ADD COLUMN     "monthlySalary" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "paymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "rib" TEXT,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "autoClose" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gracePeriod" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "lunchBreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "saturdayHours" DOUBLE PRECISION NOT NULL DEFAULT 4.0;

-- AlterTable
ALTER TABLE "CalculatedDailyReport" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT,
ALTER COLUMN "status" SET DEFAULT 'OK';

-- DropEnum
DROP TYPE IF EXISTS "ReportStatus";

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Congé Payé',
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Leave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodDate" TIMESTAMP(3),
    "periodStartDate" TIMESTAMP(3),
    "periodEndDate" TIMESTAMP(3),
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "companyName" TEXT NOT NULL DEFAULT 'Mon Entreprise',
    "companyAddress" TEXT,
    "companyPhone" TEXT,
    "companyEmail" TEXT,
    "logoUrl" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'DH',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Casablanca',
    "deviceIp" TEXT NOT NULL DEFAULT '192.168.1.201',
    "devicePort" INTEGER NOT NULL DEFAULT 4370,
    "deviceTimeout" INTEGER NOT NULL DEFAULT 10000,
    "syncRequested" BOOLEAN NOT NULL DEFAULT false,
    "syncStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "syncError" TEXT,
    "lastHeartbeat" TIMESTAMP(3),
    "deviceOnline" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriod" INTEGER NOT NULL DEFAULT 15,
    "otThresholdLimit" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "otRate1" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "otRate2" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "adminEmail" TEXT NOT NULL DEFAULT 'admin@example.com',
    "adminPasswordHash" TEXT NOT NULL,
    "contractTypes" TEXT NOT NULL DEFAULT '[]',
    "maritalStatuses" TEXT NOT NULL DEFAULT '[]',
    "leaveTypes" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "canManagePersonnel" BOOLEAN NOT NULL DEFAULT true,
    "canManageShifts" BOOLEAN NOT NULL DEFAULT true,
    "canManageLeaves" BOOLEAN NOT NULL DEFAULT true,
    "canViewSalaries" BOOLEAN NOT NULL DEFAULT true,
    "canManageSettings" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Leave_userId_startDate_endDate_idx" ON "Leave"("userId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardUser_email_key" ON "DashboardUser"("email");

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryTransaction" ADD CONSTRAINT "SalaryTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
