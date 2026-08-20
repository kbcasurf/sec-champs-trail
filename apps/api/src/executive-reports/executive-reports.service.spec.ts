import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ExecutiveReportsService } from "./executive-reports.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderService } from "../ai/ai-provider.service";

describe("ExecutiveReportsService", () => {
  const prisma = {
    organization: { findFirstOrThrow: jest.fn() },
    team: { findMany: jest.fn() },
    executiveReport: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  } as unknown as PrismaService;

  const aiProvider = { isEnabled: jest.fn(), generate: jest.fn() } as unknown as AiProviderService;

  const service = new ExecutiveReportsService(prisma, aiProvider);

  beforeEach(() => jest.clearAllMocks());

  it("throws ForbiddenException when the AI provider is not configured", async () => {
    (aiProvider.isEnabled as jest.Mock).mockReturnValue(false);
    await expect(service.generate()).rejects.toThrow(ForbiddenException);
    expect(aiProvider.generate).not.toHaveBeenCalled();
  });

  it("aggregates every team's scores and progress into the prompt, then persists the report", async () => {
    (aiProvider.isEnabled as jest.Mock).mockReturnValue(true);
    (prisma.organization.findFirstOrThrow as jest.Mock).mockResolvedValue({ id: "org-1", name: "Acme Corp" });
    (prisma.team.findMany as jest.Mock).mockResolvedValue([
      {
        name: "Payments",
        maturityAssessments: [
          { principleScores: [{ score: 2, principle: { title: "Champion Advocacy" } }] },
        ],
        checklistProgress: [{ status: "done" }, { status: "pending" }],
      },
    ]);
    (aiProvider.generate as jest.Mock).mockResolvedValue(JSON.stringify({ report: "# Report" }));
    (prisma.executiveReport.create as jest.Mock).mockResolvedValue({ id: "report-1", content: "# Report" });

    await service.generate();

    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      include: {
        maturityAssessments: { orderBy: { createdAt: "asc" }, include: { principleScores: { include: { principle: true } } } },
        checklistProgress: true,
      },
    });
    expect(aiProvider.generate).toHaveBeenCalledWith(expect.stringContaining("STRICT JSON"), expect.stringContaining("Payments"));
    expect(prisma.executiveReport.create).toHaveBeenCalledWith({ data: { organizationId: "org-1", content: "# Report" } });
  });

  it("wraps an AI provider failure in BadGatewayException", async () => {
    (aiProvider.isEnabled as jest.Mock).mockReturnValue(true);
    (prisma.organization.findFirstOrThrow as jest.Mock).mockResolvedValue({ id: "org-1", name: "Acme Corp" });
    (prisma.team.findMany as jest.Mock).mockResolvedValue([]);
    (aiProvider.generate as jest.Mock).mockRejectedValue(new Error("network error"));

    await expect(service.generate()).rejects.toThrow("Failed to generate the executive report. Please try again.");
  });

  it("findOne throws NotFoundException when the report doesn't exist", async () => {
    (prisma.executiveReport.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne("report-1")).rejects.toThrow(NotFoundException);
  });
});
