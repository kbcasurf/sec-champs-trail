import { BadGatewayException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ExperienceLevel } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderService } from "../ai/ai-provider.service";
import { buildTrainingTrackPrompt, parseTrainingTrackResponse } from "./training-track-generator";

interface GenerateInput {
  techStack: string;
  experienceLevel: ExperienceLevel;
  hoursPerWeek: number;
}

@Injectable()
export class TrainingTracksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
  ) {}

  async generate(teamId: string, input: GenerateInput) {
    if (!this.aiProvider.isEnabled()) {
      throw new ForbiddenException("AI provider is not configured");
    }

    const assessment = await this.prisma.maturityAssessment.findFirst({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      include: { principleScores: { include: { principle: true } } },
    });

    const weakestPrinciples = assessment
      ? [...assessment.principleScores]
          .sort((a, b) => a.score - b.score)
          .slice(0, 3)
          .map((ps) => ({ title: ps.principle.title, score: ps.score }))
      : [];

    const pendingProgress = await this.prisma.checklistProgress.findMany({
      where: { teamId, status: { not: "done" } },
      include: { checklistItem: true },
    });
    const pendingChecklistItems = pendingProgress.map((p) => p.checklistItem.title);

    const { systemPrompt, userPrompt } = buildTrainingTrackPrompt({
      techStack: input.techStack,
      experienceLevel: input.experienceLevel,
      hoursPerWeek: input.hoursPerWeek,
      weakestPrinciples,
      pendingChecklistItems,
    });

    let modules;
    try {
      const raw = await this.aiProvider.generate(systemPrompt, userPrompt);
      modules = parseTrainingTrackResponse(raw);
    } catch {
      throw new BadGatewayException("Failed to generate a training track. Please try again.");
    }

    return this.prisma.trainingTrack.create({
      data: {
        teamId,
        techStack: input.techStack,
        experienceLevel: input.experienceLevel,
        hoursPerWeek: input.hoursPerWeek,
        modules: { create: modules },
      },
      include: { modules: { orderBy: { order: "asc" } } },
    });
  }

  findAll(teamId: string) {
    return this.prisma.trainingTrack.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      include: { modules: { orderBy: { order: "asc" } } },
    });
  }

  async findOne(teamId: string, id: string) {
    const track = await this.prisma.trainingTrack.findFirst({
      where: { id, teamId },
      include: { modules: { orderBy: { order: "asc" } } },
    });
    if (!track) throw new NotFoundException("Training track not found");
    return track;
  }
}
