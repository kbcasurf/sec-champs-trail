import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeamScopeGuard } from "../auth/team-scope.guard";
import { AssessmentsService } from "./assessments.service";
import { SubmitAssessmentDto } from "./dto/submit-assessment.dto";

@Controller("teams/:teamId/assessments")
@UseGuards(JwtAuthGuard, TeamScopeGuard)
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}

  @Post()
  submit(@Param("teamId") teamId: string, @Body() dto: SubmitAssessmentDto) {
    return this.service.submit(teamId, dto.scores);
  }

  @Get()
  findAll(@Param("teamId") teamId: string) {
    return this.service.findAll(teamId);
  }

  @Get("latest")
  findLatest(@Param("teamId") teamId: string) {
    return this.service.findLatest(teamId);
  }
}
