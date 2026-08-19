import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Champion } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

// A hash of a random password no real champion uses. Comparing against it on the
// "no such email" path means that path pays the same bcrypt cost as a real login
// attempt, closing the timing side-channel that would otherwise let a caller
// distinguish "no such account" from "wrong password" by response latency alone.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("no-champion-has-this-password", 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<Champion | null> {
    const champion = await this.prisma.champion.findUnique({ where: { email } });
    const passwordMatches = await bcrypt.compare(password, champion?.passwordHash ?? DUMMY_PASSWORD_HASH);
    return champion && passwordMatches ? champion : null;
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
