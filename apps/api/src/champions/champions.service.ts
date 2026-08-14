import { BadRequestException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { CreateChampionDto } from "./dto/create-champion.dto";

@Injectable()
export class ChampionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateChampionDto) {
    if (dto.role === "champion" && !dto.teamId) {
      throw new BadRequestException("teamId is required for role 'champion'");
    }
    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } });
      if (!team) throw new BadRequestException("teamId does not reference an existing Team");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.champion.create({
      data: { email: dto.email, passwordHash, role: dto.role, teamId: dto.teamId ?? null },
      select: { id: true, email: true, role: true, teamId: true },
    });
  }
}
