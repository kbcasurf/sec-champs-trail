import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { TeamsService } from "./teams.service";
import { CreateTeamDto } from "./dto/create-team.dto";

@Controller("teams")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto.name);
  }

  @Get()
  findAll() {
    return this.teamsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.teamsService.findOne(id);
  }
}
