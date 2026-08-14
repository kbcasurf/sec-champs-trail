import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface PrincipleScoreInput {
  principleId: string;
  score: number;
}

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(teamId: string, scores: PrincipleScoreInput[]) {
    const principles = await this.prisma.principle.findMany({ select: { id: true } });
    const validIds = new Set(principles.map((p) => p.id));
    const providedIds = new Set(scores.map((s) => s.principleId));

    if (providedIds.size !== scores.length) {
      throw new BadRequestException("Duplicate principleId in scores");
    }
    for (const s of scores) {
      if (!validIds.has(s.principleId)) {
        throw new BadRequestException(`Unknown principleId: ${s.principleId}`);
      }
    }
    if (providedIds.size !== validIds.size) {
      throw new BadRequestException("Scores must cover all seeded principles exactly once");
    }

    return this.prisma.maturityAssessment.create({
      data: { teamId, principleScores: { create: scores } },
      include: { principleScores: true },
    });
  }

  findAll(teamId: string) {
    return this.prisma.maturityAssessment.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      include: { principleScores: true },
    });
  }

  async findLatest(teamId: string) {
    const assessment = await this.prisma.maturityAssessment.findFirst({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      include: { principleScores: { include: { principle: true } } },
    });
    if (!assessment) throw new NotFoundException("No assessment found for this team yet");
    return assessment;
  }
}
