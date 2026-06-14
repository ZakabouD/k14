-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OK', 'ANOMALY', 'PENDING', 'RESOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "zktecoUserId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "shiftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "baseHours" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawPunch" (
    "id" TEXT NOT NULL,
    "sn" INTEGER NOT NULL,
    "zktecoUserId" TEXT NOT NULL,
    "recordTime" TIMESTAMP(3) NOT NULL,
    "type" INTEGER NOT NULL,
    "state" INTEGER NOT NULL,
    "ip" TEXT NOT NULL,

    CONSTRAINT "RawPunch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalculatedDailyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "firstPunchIn" TIMESTAMP(3),
    "lastPunchOut" TIMESTAMP(3),
    "regularHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime150Hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime200Hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "anomalyReason" TEXT,

    CONSTRAINT "CalculatedDailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_zktecoUserId_key" ON "User"("zktecoUserId");

-- CreateIndex
CREATE INDEX "RawPunch_zktecoUserId_recordTime_idx" ON "RawPunch"("zktecoUserId", "recordTime");

-- CreateIndex
CREATE UNIQUE INDEX "RawPunch_zktecoUserId_recordTime_key" ON "RawPunch"("zktecoUserId", "recordTime");

-- CreateIndex
CREATE UNIQUE INDEX "CalculatedDailyReport_userId_date_key" ON "CalculatedDailyReport"("userId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawPunch" ADD CONSTRAINT "RawPunch_zktecoUserId_fkey" FOREIGN KEY ("zktecoUserId") REFERENCES "User"("zktecoUserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalculatedDailyReport" ADD CONSTRAINT "CalculatedDailyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
