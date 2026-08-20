import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtPayload } from "./jwt.strategy";

const COOKIE_NAME = "accessToken";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const champion = await this.authService.validateCredentials(dto.email, dto.password);
    if (!champion) throw new UnauthorizedException("Invalid credentials");

    const { accessToken } = this.authService.issueToken(champion);
    res.cookie(COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    return { id: champion.id, email: champion.email, role: champion.role, teamId: champion.teamId };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: JwtPayload }) {
    const { sub, email, role, teamId } = req.user;
    return { id: sub, email, role, teamId };
  }
}
