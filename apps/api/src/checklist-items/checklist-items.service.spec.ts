import { ChecklistItemsService } from "./checklist-items.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ChecklistItemsService", () => {
  const prisma = { checklistItem: { findMany: jest.fn() } } as unknown as PrismaService;
  const service = new ChecklistItemsService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it("lists all items when no filter is given", async () => {
    (prisma.checklistItem.findMany as jest.Mock).mockResolvedValue([]);
    await service.findAll({});
    expect(prisma.checklistItem.findMany).toHaveBeenCalledWith({ where: {}, orderBy: { principleId: "asc" } });
  });

  it("filters by principleId and phase when given", async () => {
    (prisma.checklistItem.findMany as jest.Mock).mockResolvedValue([]);
    await service.findAll({ principleId: "p1", phase: "recruitment" });
    expect(prisma.checklistItem.findMany).toHaveBeenCalledWith({
      where: { principleId: "p1", phase: "recruitment" },
      orderBy: { principleId: "asc" },
    });
  });
});
