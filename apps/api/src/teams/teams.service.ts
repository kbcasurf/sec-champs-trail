import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string) {
    const organization = await this.prisma.organization.findFirstOrThrow();
    return this.prisma.team.create({ data: { name, organizationId: organization.id } });
  }

  findAll() {
    return this.prisma.team.findMany({ orderBy: { createdAt: "asc" } });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { champions: { select: { id: true, email: true, role: true } } },
    });
    if (!team) throw new NotFoundException("Team not found");
    return team;
  }
}
