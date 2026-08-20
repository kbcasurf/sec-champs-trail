import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AiProviderService } from "./ai-provider.service";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiProvider: AiProviderService) {}

  @Get("status")
  status() {
    return { enabled: this.aiProvider.isEnabled() };
  }
}
