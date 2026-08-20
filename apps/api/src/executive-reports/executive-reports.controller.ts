import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ExecutiveReportsService } from "./executive-reports.service";

@Controller("executive-reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class ExecutiveReportsController {
  constructor(private readonly service: ExecutiveReportsService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  generate() {
    return this.service.generate();
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }
}
