-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL DEFAULT 'info',
    "role" TEXT NOT NULL DEFAULT 'DESIGNER',
    "discipline" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "emailDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'auto',
    "pdfDefault" TEXT NOT NULL DEFAULT 'a4-landscape',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "contractType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "projectManagerId" TEXT,
    "iconEmoji" TEXT NOT NULL DEFAULT '📁',
    "iconColor" TEXT NOT NULL DEFAULT 'purple',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Drawing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drawingNumber" TEXT NOT NULL,
    "drawingTitle" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "requestorId" TEXT NOT NULL,
    "requestDate" DATETIME NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "actualCompletionDate" DATETIME,
    "lateReason" TEXT,
    "lateReasonDetail" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "deletedById" TEXT,
    "deletedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Drawing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Drawing_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Drawing_requestorId_fkey" FOREIGN KEY ("requestorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DrawingDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "formData" TEXT NOT NULL,
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "lastSavedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "DrawingDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "drawingId" TEXT,
    "details" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Drawing_drawingNumber_key" ON "Drawing"("drawingNumber");

-- CreateIndex
CREATE INDEX "Drawing_projectId_isDeleted_idx" ON "Drawing"("projectId", "isDeleted");

-- CreateIndex
CREATE INDEX "Drawing_designerId_status_isDeleted_idx" ON "Drawing"("designerId", "status", "isDeleted");

-- CreateIndex
CREATE INDEX "Drawing_status_endDate_isDeleted_idx" ON "Drawing"("status", "endDate", "isDeleted");

-- CreateIndex
CREATE INDEX "DrawingDraft_userId_expiresAt_idx" ON "DrawingDraft"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_drawingId_createdAt_idx" ON "AuditLog"("drawingId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
