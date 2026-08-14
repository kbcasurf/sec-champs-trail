import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeamScopeGuard } from "../auth/team-scope.guard";
import { ChecklistProgressService } from "./checklist-progress.service";
import { UpdateChecklistProgressDto } from "./dto/update-checklist-progress.dto";

@Controller("teams/:teamId/checklist-progress")
@UseGuards(JwtAuthGuard, TeamScopeGuard)
export class ChecklistProgressController {
  constructor(private readonly service: ChecklistProgressService) {}

  @Get()
  findAll(@Param("teamId") teamId: string) {
    return this.service.findAllForTeam(teamId);
  }

  @Patch(":checklistItemId")
  update(
    @Param("teamId") teamId: string,
    @Param("checklistItemId") checklistItemId: string,
    @Body() dto: UpdateChecklistProgressDto,
  ) {
    return this.service.upsert(teamId, checklistItemId, dto.status);
  }
}
