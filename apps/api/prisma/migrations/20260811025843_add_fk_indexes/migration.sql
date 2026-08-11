-- CreateIndex
CREATE INDEX "ActionItem_actionPlanId_idx" ON "ActionItem"("actionPlanId");

-- CreateIndex
CREATE INDEX "ActionItem_checklistItemId_idx" ON "ActionItem"("checklistItemId");

-- CreateIndex
CREATE INDEX "ActionPlan_organizationId_idx" ON "ActionPlan"("organizationId");

-- CreateIndex
CREATE INDEX "Champion_teamId_idx" ON "Champion"("teamId");

-- CreateIndex
CREATE INDEX "ChecklistItem_principleId_idx" ON "ChecklistItem"("principleId");

-- CreateIndex
CREATE INDEX "ExecutiveReport_organizationId_idx" ON "ExecutiveReport"("organizationId");

-- CreateIndex
CREATE INDEX "MaturityAssessment_teamId_idx" ON "MaturityAssessment"("teamId");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE INDEX "TrainingModule_trainingTrackId_idx" ON "TrainingModule"("trainingTrackId");

-- CreateIndex
CREATE INDEX "TrainingTrack_teamId_idx" ON "TrainingTrack"("teamId");
