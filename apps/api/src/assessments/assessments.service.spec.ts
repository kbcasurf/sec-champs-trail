import { BadRequestException } from "@nestjs/common";
import { AssessmentsService } from "./assessments.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AssessmentsService.submit", () => {
  const prisma = {
    principle: { findMany: jest.fn() },
    maturityAssessment: { create: jest.fn() },
  } as unknown as PrismaService;

  const service = new AssessmentsService(prisma);
  const tenPrincipleIds = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` }));

  beforeEach(() => jest.clearAllMocks());

  it("rejects a submission with a duplicate principleId", async () => {
    (prisma.principle.findMany as jest.Mock).mockResolvedValue(tenPrincipleIds);
    const scores = tenPrincipleIds.map((p) => ({ principleId: p.id, score: 2 }));
    scores[1] = { ...scores[1], principleId: scores[0].principleId };

    await expect(service.submit("team-1", scores)).rejects.toThrow(BadRequestException);
  });

  it("rejects a submission with an unknown principleId", async () => {
    (prisma.principle.findMany as jest.Mock).mockResolvedValue(tenPrincipleIds);
    const scores = tenPrincipleIds.map((p) => ({ principleId: p.id, score: 2 }));
    scores[0] = { ...scores[0], principleId: "not-a-real-principle" };

    await expect(service.submit("team-1", scores)).rejects.toThrow(BadRequestException);
  });

  it("rejects a submission that does not cover all 10 principles", async () => {
    (prisma.principle.findMany as jest.Mock).mockResolvedValue(tenPrincipleIds);
    const scores = tenPrincipleIds.slice(0, 9).map((p) => ({ principleId: p.id, score: 2 }));

    await expect(service.submit("team-1", scores)).rejects.toThrow(BadRequestException);
  });

  it("creates a MaturityAssessment when scores cover all 10 principles exactly once", async () => {
    (prisma.principle.findMany as jest.Mock).mockResolvedValue(tenPrincipleIds);
    (prisma.maturityAssessment.create as jest.Mock).mockResolvedValue({ id: "a1" });
    const scores = tenPrincipleIds.map((p) => ({ principleId: p.id, score: 2 }));

    const result = await service.submit("team-1", scores);

    expect(prisma.maturityAssessment.create).toHaveBeenCalledWith({
      data: { teamId: "team-1", principleScores: { create: scores } },
      include: { principleScores: true },
    });
    expect(result.id).toBe("a1");
  });
});
