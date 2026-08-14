import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Champion } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<Champion | null> {
    const champion = await this.prisma.champion.findUnique({ where: { email } });
    if (!champion) return null;

    const passwordMatches = await bcrypt.compare(password, champion.passwordHash);
    return passwordMatches ? champion : null;
  }

  issueToken(champion: Pick<Champion, "id" | "email" | "role" | "teamId">): { accessToken: string } {
    const accessToken = this.jwtService.sign({
      sub: champion.id,
      email: champion.email,
      role: champion.role,
      teamId: champion.teamId,
    });
    return { accessToken };
  }
}
