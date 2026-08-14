import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ChecklistItemsService } from "./checklist-items.service";
import { ChecklistItemsQueryDto } from "./dto/checklist-items-query.dto";

@Controller("checklist-items")
@UseGuards(JwtAuthGuard)
export class ChecklistItemsController {
  constructor(private readonly service: ChecklistItemsService) {}

  @Get()
  findAll(@Query() query: ChecklistItemsQueryDto) {
    return this.service.findAll(query);
  }
}
