import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ChecklistItemsQueryDto } from "./dto/checklist-items-query.dto";

@Injectable()
export class ChecklistItemsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ChecklistItemsQueryDto) {
    return this.prisma.checklistItem.findMany({
      where: {
        ...(query.principleId ? { principleId: query.principleId } : {}),
        ...(query.phase ? { phase: query.phase } : {}),
      },
      orderBy: { principleId: "asc" },
    });
  }
}
