/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "User";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "DeviceStatus" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "project" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastActivityTime" DATETIME,
    "offlineHours" REAL,
    "reportId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReportTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "totalDevices" INTEGER NOT NULL,
    "onlineCount" INTEGER NOT NULL,
    "offlineCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "DeviceStatus_project_idx" ON "DeviceStatus"("project");

-- CreateIndex
CREATE INDEX "DeviceStatus_reportId_idx" ON "DeviceStatus"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTask_date_key" ON "ReportTask"("date");
