import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ChampionsService } from "./champions.service";
import { CreateChampionDto } from "./dto/create-champion.dto";

@Controller("champions")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class ChampionsController {
  constructor(private readonly championsService: ChampionsService) {}

  @Post()
  create(@Body() dto: CreateChampionDto) {
    return this.championsService.create(dto);
  }
}
