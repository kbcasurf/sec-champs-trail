import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ActionPlansService } from "./action-plans.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ActionPlansService", () => {
  const prisma = {
    maturityAssessment: { findFirst: jest.fn() },
    checklistItem: { findMany: jest.fn() },
    actionPlan: { create: jest.fn(), findFirst: jest.fn() },
    checklistProgress: { findMany: jest.fn() },
  } as unknown as PrismaService;

  const service = new ActionPlansService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it("throws when the team has no assessment yet", async () => {
    (prisma.maturityAssessment.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.generate("team-1")).rejects.toThrow(BadRequestException);
  });

  it("generates a plan from the latest assessment's scores", async () => {
    (prisma.maturityAssessment.findFirst as jest.Mock).mockResolvedValue({
      id: "assessment-1",
      principleScores: [{ principleId: "p1", score: 0, principle: { order: 1 } }],
    });
    (prisma.checklistItem.findMany as jest.Mock).mockResolvedValue([{ id: "item-1", principleId: "p1" }]);
    (prisma.actionPlan.create as jest.Mock).mockResolvedValue({ id: "plan-1", actionItems: [] });

    await service.generate("team-1");

    expect(prisma.actionPlan.create).toHaveBeenCalledWith({
      data: {
        teamId: "team-1",
        assessmentId: "assessment-1",
        actionItems: { create: [{ checklistItemId: "item-1", bucket: "three_months" }] },
      },
      include: { actionItems: true },
    });
  });

  it("throws NotFoundException when no plan exists yet", async () => {
    (prisma.actionPlan.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findLatestWithProgress("team-1")).rejects.toThrow(NotFoundException);
  });

  it("resolves each action item's status from ChecklistProgress, defaulting to pending", async () => {
    (prisma.actionPlan.findFirst as jest.Mock).mockResolvedValue({
      id: "plan-1",
      actionItems: [
        { checklistItemId: "item-1", bucket: "three_months", checklistItem: { title: "Do the thing" } },
        { checklistItemId: "item-2", bucket: "six_months", checklistItem: { title: "Do another thing" } },
      ],
    });
    (prisma.checklistProgress.findMany as jest.Mock).mockResolvedValue([{ checklistItemId: "item-1", status: "done" }]);

    const result = await service.findLatestWithProgress("team-1");

    expect(result.actionItems[0].status).toBe("done");
    expect(result.actionItems[1].status).toBe("pending");
  });
});
