import { Module } from "@nestjs/common";
import { ChecklistProgressController } from "./checklist-progress.controller";
import { ChecklistProgressService } from "./checklist-progress.service";

@Module({
  controllers: [ChecklistProgressController],
  providers: [ChecklistProgressService],
  exports: [ChecklistProgressService],
})
export class ChecklistProgressModule {}
