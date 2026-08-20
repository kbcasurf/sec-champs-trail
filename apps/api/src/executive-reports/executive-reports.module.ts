import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ExecutiveReportsController } from "./executive-reports.controller";
import { ExecutiveReportsService } from "./executive-reports.service";

@Module({
  imports: [AiModule],
  controllers: [ExecutiveReportsController],
  providers: [ExecutiveReportsService],
})
export class ExecutiveReportsModule {}
