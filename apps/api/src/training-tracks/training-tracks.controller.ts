import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeamScopeGuard } from "../auth/team-scope.guard";
import { TrainingTracksService } from "./training-tracks.service";
import { GenerateTrainingTrackDto } from "./dto/generate-training-track.dto";

@Controller("teams/:teamId/training-tracks")
@UseGuards(JwtAuthGuard, TeamScopeGuard)
export class TrainingTracksController {
  constructor(private readonly service: TrainingTracksService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  generate(@Param("teamId") teamId: string, @Body() dto: GenerateTrainingTrackDto) {
    return this.service.generate(teamId, dto);
  }

  @Get()
  findAll(@Param("teamId") teamId: string) {
    return this.service.findAll(teamId);
  }

  @Get(":id")
  findOne(@Param("teamId") teamId: string, @Param("id") id: string) {
    return this.service.findOne(teamId, id);
  }
}
