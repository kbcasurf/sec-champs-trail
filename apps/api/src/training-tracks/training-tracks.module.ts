import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { TrainingTracksController } from "./training-tracks.controller";
import { TrainingTracksService } from "./training-tracks.service";

@Module({
  imports: [AiModule],
  controllers: [TrainingTracksController],
  providers: [TrainingTracksService],
})
export class TrainingTracksModule {}
