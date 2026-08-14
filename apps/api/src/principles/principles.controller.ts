import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrinciplesService } from "./principles.service";

@Controller("principles")
@UseGuards(JwtAuthGuard)
export class PrinciplesController {
  constructor(private readonly principlesService: PrinciplesService) {}

  @Get()
  findAll() {
    return this.principlesService.findAllWithLevels();
  }
}
