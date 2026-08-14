import { NotFoundException } from "@nestjs/common";
import { ChecklistProgressService } from "./checklist-progress.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ChecklistProgressService", () => {
  const prisma = {
    checklistItem: { findMany: jest.fn(), findUnique: jest.fn() },
    checklistProgress: { findMany: jest.fn(), upsert: jest.fn() },
  } as unknown as PrismaService;

  const service = new ChecklistProgressService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it("defaults status to 'pending' for items with no progress row yet", async () => {
    (prisma.checklistItem.findMany as jest.Mock).mockResolvedValue([{ id: "item-1" }, { id: "item-2" }]);
    (prisma.checklistProgress.findMany as jest.Mock).mockResolvedValue([{ checklistItemId: "item-1", status: "done" }]);

    const result = await service.findAllForTeam("team-1");

    expect(result).toEqual([
      { id: "item-1", status: "done" },
      { id: "item-2", status: "pending" },
    ]);
  });

  it("throws NotFoundException when the checklist item does not exist", async () => {
    (prisma.checklistItem.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.upsert("team-1", "missing-item", "done")).rejects.toThrow(NotFoundException);
  });

  it("upserts progress by [teamId, checklistItemId]", async () => {
    (prisma.checklistItem.findUnique as jest.Mock).mockResolvedValue({ id: "item-1" });
    (prisma.checklistProgress.upsert as jest.Mock).mockResolvedValue({ teamId: "team-1", checklistItemId: "item-1", status: "done" });

    await service.upsert("team-1", "item-1", "done");

    expect(prisma.checklistProgress.upsert).toHaveBeenCalledWith({
      where: { teamId_checklistItemId: { teamId: "team-1", checklistItemId: "item-1" } },
      create: { teamId: "team-1", checklistItemId: "item-1", status: "done" },
      update: { status: "done" },
    });
  });
});
