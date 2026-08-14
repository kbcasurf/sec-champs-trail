import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PrinciplesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllWithLevels() {
    return this.prisma.principle.findMany({
      orderBy: { order: "asc" },
      include: { maturityLevels: { orderBy: { level: "asc" } } },
    });
  }
}
