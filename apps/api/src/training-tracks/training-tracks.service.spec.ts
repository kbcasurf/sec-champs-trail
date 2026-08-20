import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ExperienceLevel } from "@prisma/client";
import { TrainingTracksService } from "./training-tracks.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderService } from "../ai/ai-provider.service";

describe("TrainingTracksService", () => {
  const prisma = {
    maturityAssessment: { findFirst: jest.fn() },
    checklistProgress: { findMany: jest.fn() },
    trainingTrack: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  } as unknown as PrismaService;

  const aiProvider = { isEnabled: jest.fn(), generate: jest.fn() } as unknown as AiProviderService;

  const service = new TrainingTracksService(prisma, aiProvider);

  const input = { techStack: "Node.js", experienceLevel: ExperienceLevel.intermediate, hoursPerWeek: 4 };

  beforeEach(() => jest.clearAllMocks());

  it("throws ForbiddenException when the AI provider is not configured", async () => {
    (aiProvider.isEnabled as jest.Mock).mockReturnValue(false);
    await expect(service.generate("team-1", input)).rejects.toThrow(ForbiddenException);
    expect(aiProvider.generate).not.toHaveBeenCalled();
  });

  it("generates and persists a track using the team's weakest principles and pending checklist items", async () => {
    (aiProvider.isEnabled as jest.Mock).mockReturnValue(true);
    (prisma.maturityAssessment.findFirst as jest.Mock).mockResolvedValue({
      principleScores: [
        { score: 3, principle: { title: "Strong principle" } },
        { score: 0, principle: { title: "Weak principle" } },
      ],
    });
    (prisma.checklistProgress.findMany as jest.Mock).mockResolvedValue([
      { checklistItem: { title: "Do the thing" } },
    ]);
    (aiProvider.generate as jest.Mock).mockResolvedValue(
      JSON.stringify({ modules: [{ title: "Module 1", content: "content" }] }),
    );
    (prisma.trainingTrack.create as jest.Mock).mockResolvedValue({ id: "track-1", modules: [] });

    await service.generate("team-1", input);

    expect(aiProvider.generate).toHaveBeenCalledWith(expect.stringContaining("STRICT JSON"), expect.stringContaining("Weak principle"));
    expect(prisma.trainingTrack.create).toHaveBeenCalledWith({
      data: {
        teamId: "team-1",
        techStack: "Node.js",
        experienceLevel: ExperienceLevel.intermediate,
        hoursPerWeek: 4,
        modules: { create: [{ order: 0, title: "Module 1", content: "content" }] },
      },
      include: { modules: { orderBy: { order: "asc" } } },
    });
  });

  it("works for a team with no assessment yet (empty weakest-principles list)", async () => {
    (aiProvider.isEnabled as jest.Mock).mockReturnValue(true);
    (prisma.maturityAssessment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.checklistProgress.findMany as jest.Mock).mockResolvedValue([]);
    (aiProvider.generate as jest.Mock).mockResolvedValue(JSON.stringify({ modules: [{ title: "M", content: "c" }] }));
    (prisma.trainingTrack.create as jest.Mock).mockResolvedValue({ id: "track-1", modules: [] });

    await expect(service.generate("team-1", input)).resolves.toBeDefined();
  });

  it("wraps an AI provider failure in BadGatewayException", async () => {
    (aiProvider.isEnabled as jest.Mock).mockReturnValue(true);
    (prisma.maturityAssessment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.checklistProgress.findMany as jest.Mock).mockResolvedValue([]);
    (aiProvider.generate as jest.Mock).mockRejectedValue(new Error("network error"));

    await expect(service.generate("team-1", input)).rejects.toThrow(
      "Failed to generate a training track. Please try again.",
    );
  });

  it("wraps a malformed AI response in BadGatewayException", async () => {
    (aiProvider.isEnabled as jest.Mock).mockReturnValue(true);
    (prisma.maturityAssessment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.checklistProgress.findMany as jest.Mock).mockResolvedValue([]);
    (aiProvider.generate as jest.Mock).mockResolvedValue("not json");

    await expect(service.generate("team-1", input)).rejects.toThrow(
      "Failed to generate a training track. Please try again.",
    );
  });

  it("findOne throws NotFoundException when the track doesn't exist for that team", async () => {
    (prisma.trainingTrack.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne("team-1", "track-1")).rejects.toThrow(NotFoundException);
  });
});
