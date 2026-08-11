import { Body, Controller, HttpCode, Post, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const champion = await this.authService.validateCredentials(dto.email, dto.password);
    if (!champion) throw new UnauthorizedException("Invalid credentials");
    return this.authService.issueToken(champion);
  }
}
