import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { generateActionItems } from "./action-plan-generator";

@Injectable()
export class ActionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(teamId: string) {
    const assessment = await this.prisma.maturityAssessment.findFirst({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      include: { principleScores: { include: { principle: true } } },
    });
    if (!assessment) {
      throw new BadRequestException("Team has no assessment yet — submit one before generating an action plan");
    }

    const checklistItems = await this.prisma.checklistItem.findMany({ select: { id: true, principleId: true } });

    const generated = generateActionItems(
      assessment.principleScores.map((ps) => ({
        principleId: ps.principleId,
        principleOrder: ps.principle.order,
        score: ps.score,
      })),
      checklistItems,
    );

    return this.prisma.actionPlan.create({
      data: { teamId, assessmentId: assessment.id, actionItems: { create: generated } },
      include: { actionItems: true },
    });
  }

  async findLatestWithProgress(teamId: string) {
    const plan = await this.prisma.actionPlan.findFirst({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      include: { actionItems: { include: { checklistItem: true } } },
    });
    if (!plan) throw new NotFoundException("No action plan found for this team yet");

    const progress = await this.prisma.checklistProgress.findMany({ where: { teamId } });
    const statusByItem = new Map(progress.map((p) => [p.checklistItemId, p.status]));

    return {
      ...plan,
      actionItems: plan.actionItems.map((item) => ({
        ...item,
        status: statusByItem.get(item.checklistItemId) ?? "pending",
      })),
    };
  }
}
