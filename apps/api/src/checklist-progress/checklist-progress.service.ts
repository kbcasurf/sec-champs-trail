import { Injectable, NotFoundException } from "@nestjs/common";
import { ActionItemStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ChecklistProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForTeam(teamId: string) {
    const [items, progress] = await Promise.all([
      this.prisma.checklistItem.findMany({ orderBy: { principleId: "asc" } }),
      this.prisma.checklistProgress.findMany({ where: { teamId } }),
    ]);
    const statusByItem = new Map(progress.map((p) => [p.checklistItemId, p.status]));

    return items.map((item) => ({ ...item, status: statusByItem.get(item.id) ?? "pending" }));
  }

  async upsert(teamId: string, checklistItemId: string, status: ActionItemStatus) {
    const item = await this.prisma.checklistItem.findUnique({ where: { id: checklistItemId } });
    if (!item) throw new NotFoundException("Checklist item not found");

    return this.prisma.checklistProgress.upsert({
      where: { teamId_checklistItemId: { teamId, checklistItemId } },
      create: { teamId, checklistItemId, status },
      update: { status },
    });
  }
}
