import { BadGatewayException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiProviderService } from "../ai/ai-provider.service";
import { buildExecutiveReportPrompt, parseExecutiveReportResponse, TeamSummary } from "./executive-report-generator";

@Injectable()
export class ExecutiveReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
  ) {}

  async generate() {
    if (!this.aiProvider.isEnabled()) {
      throw new ForbiddenException("AI provider is not configured");
    }

    const organization = await this.prisma.organization.findFirstOrThrow();

    const teams = await this.prisma.team.findMany({
      where: { organizationId: organization.id },
      include: {
        maturityAssessments: {
          orderBy: { createdAt: "asc" },
          include: { principleScores: { include: { principle: true } } },
        },
        checklistProgress: true,
      },
    });

    const teamSummaries: TeamSummary[] = teams.map((team) => {
      const latest = team.maturityAssessments[team.maturityAssessments.length - 1];
      const latestScores = latest
        ? latest.principleScores.map((ps) => ({ principleTitle: ps.principle.title, score: ps.score }))
        : [];
      const historicalAverageScores = team.maturityAssessments.map((a) => {
        const total = a.principleScores.reduce((sum, ps) => sum + ps.score, 0);
        return a.principleScores.length > 0 ? total / a.principleScores.length : 0;
      });
      const done = team.checklistProgress.filter((p) => p.status === "done").length;
      const checklistCompletionPercent =
        team.checklistProgress.length > 0 ? Math.round((done / team.checklistProgress.length) * 100) : 0;

      return { teamName: team.name, latestScores, historicalAverageScores, checklistCompletionPercent };
    });

    const { systemPrompt, userPrompt } = buildExecutiveReportPrompt({
      organizationName: organization.name,
      teams: teamSummaries,
    });

    let content: string;
    try {
      const raw = await this.aiProvider.generate(systemPrompt, userPrompt);
      content = parseExecutiveReportResponse(raw);
    } catch {
      throw new BadGatewayException("Failed to generate the executive report. Please try again.");
    }

    return this.prisma.executiveReport.create({ data: { organizationId: organization.id, content } });
  }

  async findAll() {
    const organization = await this.prisma.organization.findFirstOrThrow();
    return this.prisma.executiveReport.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.executiveReport.findFirst({ where: { id } });
    if (!report) throw new NotFoundException("Executive report not found");
    return report;
  }
}
