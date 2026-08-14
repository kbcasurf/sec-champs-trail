import { Module } from "@nestjs/common";
import { ChecklistItemsController } from "./checklist-items.controller";
import { ChecklistItemsService } from "./checklist-items.service";

@Module({
  controllers: [ChecklistItemsController],
  providers: [ChecklistItemsService],
})
export class ChecklistItemsModule {}
