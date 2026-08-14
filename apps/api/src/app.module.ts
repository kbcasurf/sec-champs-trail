import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TeamsModule } from "./teams/teams.module";
import { ChampionsModule } from "./champions/champions.module";

@Module({
  imports: [PrismaModule, AuthModule, TeamsModule, ChampionsModule],
  controllers: [AppController],
})
export class AppModule {}
