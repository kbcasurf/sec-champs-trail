import { PrinciplesService } from "./principles.service";
import { PrismaService } from "../prisma/prisma.service";

describe("PrinciplesService", () => {
  const prisma = { principle: { findMany: jest.fn() } } as unknown as PrismaService;
  const service = new PrinciplesService(prisma);

  it("lists principles ordered by 'order', with maturityLevels ordered by 'level'", async () => {
    (prisma.principle.findMany as jest.Mock).mockResolvedValue([{ id: "p1", order: 1 }]);

    const result = await service.findAllWithLevels();

    expect(prisma.principle.findMany).toHaveBeenCalledWith({
      orderBy: { order: "asc" },
      include: { maturityLevels: { orderBy: { level: "asc" } } },
    });
    expect(result).toEqual([{ id: "p1", order: 1 }]);
  });
});
