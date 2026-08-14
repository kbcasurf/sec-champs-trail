import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TeamsModule } from "./teams/teams.module";
import { ChampionsModule } from "./champions/champions.module";
import { PrinciplesModule } from "./principles/principles.module";
import { ChecklistItemsModule } from "./checklist-items/checklist-items.module";

@Module({
  imports: [PrismaModule, AuthModule, TeamsModule, ChampionsModule, PrinciplesModule, ChecklistItemsModule],
  controllers: [AppController],
})
export class AppModule {}
