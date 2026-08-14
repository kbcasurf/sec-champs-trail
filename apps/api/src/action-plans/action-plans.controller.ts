import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeamScopeGuard } from "../auth/team-scope.guard";
import { ActionPlansService } from "./action-plans.service";

@Controller("teams/:teamId/action-plans")
@UseGuards(JwtAuthGuard, TeamScopeGuard)
export class ActionPlansController {
  constructor(private readonly service: ActionPlansService) {}

  @Post()
  generate(@Param("teamId") teamId: string) {
    return this.service.generate(teamId);
  }

  @Get("latest")
  findLatest(@Param("teamId") teamId: string) {
    return this.service.findLatestWithProgress(teamId);
  }
}
