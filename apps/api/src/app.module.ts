import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TeamsModule } from "./teams/teams.module";
import { ChampionsModule } from "./champions/champions.module";
import { PrinciplesModule } from "./principles/principles.module";
import { ChecklistItemsModule } from "./checklist-items/checklist-items.module";
import { AssessmentsModule } from "./assessments/assessments.module";
import { ChecklistProgressModule } from "./checklist-progress/checklist-progress.module";
import { ActionPlansModule } from "./action-plans/action-plans.module";
import { AiModule } from "./ai/ai.module";
import { TrainingTracksModule } from "./training-tracks/training-tracks.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    TeamsModule,
    ChampionsModule,
    PrinciplesModule,
    ChecklistItemsModule,
    AssessmentsModule,
    ChecklistProgressModule,
    ActionPlansModule,
    AiModule,
    TrainingTracksModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
