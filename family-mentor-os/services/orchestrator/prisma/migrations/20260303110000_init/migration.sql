-- Create enums
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'BREAK', 'SUBMITTED', 'AUTO_SUBMITTED');
CREATE TYPE "BehaviorEventType" AS ENUM ('TAB_BLUR', 'TAB_FOCUS', 'COPY_PASTE', 'RAPID_ANSWERING', 'BREAK_REQUEST', 'RESUME', 'SUBMIT', 'HEARTBEAT');
CREATE TYPE "OverrideVerdict" AS ENUM ('APPROVED', 'FLAGGED', 'CLEARED');

CREATE TABLE "Tenant" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Test" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "totalSeconds" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TestSection" (
  "id" TEXT PRIMARY KEY,
  "testId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Item" (
  "id" TEXT PRIMARY KEY,
  "sectionId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "correctAnswer" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "expectedTime" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TestAttempt" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "testId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "autoSubmittedAt" TIMESTAMP(3),
  "breakUsed" BOOLEAN NOT NULL DEFAULT false,
  "breakStartedAt" TIMESTAMP(3),
  "breakEndsAt" TIMESTAMP(3),
  "pausedSeconds" INTEGER NOT NULL DEFAULT 0,
  "outOfFocusSeconds" INTEGER NOT NULL DEFAULT 0,
  "lastBlurAt" TIMESTAMP(3),
  "scorePercent" DOUBLE PRECISION,
  "riskScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Answer" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "answerText" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT false,
  "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "timeSpentSec" INTEGER NOT NULL DEFAULT 0,
  UNIQUE ("attemptId", "itemId")
);

CREATE TABLE "AiCheck" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL UNIQUE,
  "similarityScore" DOUBLE PRECISION NOT NULL,
  "stylometryScore" DOUBLE PRECISION NOT NULL,
  "aiGeneratedProbability" DOUBLE PRECISION NOT NULL,
  "speedingFlag" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tabBlurScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "webcamFlag" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pasteEvents" INTEGER NOT NULL DEFAULT 0,
  "riskScore" DOUBLE PRECISION NOT NULL,
  "explanation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "BehaviorEvent" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "eventType" "BehaviorEventType" NOT NULL,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "attemptId" TEXT,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "verdict" "OverrideVerdict",
  "note" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "Test_tenantId_idx" ON "Test"("tenantId");
CREATE INDEX "TestSection_testId_order_idx" ON "TestSection"("testId", "order");
CREATE INDEX "Item_sectionId_order_idx" ON "Item"("sectionId", "order");
CREATE INDEX "TestAttempt_tenantId_studentId_idx" ON "TestAttempt"("tenantId", "studentId");
CREATE INDEX "TestAttempt_testId_status_idx" ON "TestAttempt"("testId", "status");
CREATE INDEX "Answer_tenantId_attemptId_idx" ON "Answer"("tenantId", "attemptId");
CREATE INDEX "AiCheck_tenantId_riskScore_idx" ON "AiCheck"("tenantId", "riskScore");
CREATE INDEX "BehaviorEvent_tenantId_attemptId_eventType_idx" ON "BehaviorEvent"("tenantId", "attemptId", "eventType");
CREATE INDEX "AuditLog_tenantId_attemptId_idx" ON "AuditLog"("tenantId", "attemptId");
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Test" ADD CONSTRAINT "Test_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestSection" ADD CONSTRAINT "TestSection_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TestSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAttempt" ADD CONSTRAINT "TestAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCheck" ADD CONSTRAINT "AiCheck_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BehaviorEvent" ADD CONSTRAINT "BehaviorEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
