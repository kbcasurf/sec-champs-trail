-- CreateEnum
CREATE TYPE "ActionBucket" AS ENUM ('three_months', 'six_months', 'twelve_months');

-- CreateTable
CREATE TABLE "PrincipleMaturityLevel" (
    "id" TEXT NOT NULL,
    "principleId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "PrincipleMaturityLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistProgress" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'pending',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistProgress_pkey" PRIMARY KEY ("id")
);

-- DropForeignKey
ALTER TABLE "ActionPlan" DROP CONSTRAINT "ActionPlan_organizationId_fkey";

-- DropIndex
DROP INDEX "ActionPlan_organizationId_idx";

-- AlterTable
ALTER TABLE "ActionPlan" DROP COLUMN "organizationId",
ADD COLUMN "teamId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "assessmentId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ActionItem" DROP COLUMN "status",
ADD COLUMN "bucket" "ActionBucket" NOT NULL DEFAULT 'three_months';

-- CreateIndex
CREATE UNIQUE INDEX "PrincipleMaturityLevel_principleId_level_key" ON "PrincipleMaturityLevel"("principleId", "level");

-- CreateIndex
CREATE INDEX "PrincipleMaturityLevel_principleId_idx" ON "PrincipleMaturityLevel"("principleId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistProgress_teamId_checklistItemId_key" ON "ChecklistProgress"("teamId", "checklistItemId");

-- CreateIndex
CREATE INDEX "ChecklistProgress_teamId_idx" ON "ChecklistProgress"("teamId");

-- CreateIndex
CREATE INDEX "ChecklistProgress_checklistItemId_idx" ON "ChecklistProgress"("checklistItemId");

-- CreateIndex
CREATE INDEX "ActionPlan_teamId_idx" ON "ActionPlan"("teamId");

-- CreateIndex
CREATE INDEX "ActionPlan_assessmentId_idx" ON "ActionPlan"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionItem_actionPlanId_checklistItemId_key" ON "ActionItem"("actionPlanId", "checklistItemId");

-- AddForeignKey
ALTER TABLE "PrincipleMaturityLevel" ADD CONSTRAINT "PrincipleMaturityLevel_principleId_fkey" FOREIGN KEY ("principleId") REFERENCES "Principle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistProgress" ADD CONSTRAINT "ChecklistProgress_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistProgress" ADD CONSTRAINT "ChecklistProgress_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "MaturityAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
