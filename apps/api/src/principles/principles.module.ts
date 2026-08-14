import { Module } from "@nestjs/common";
import { PrinciplesController } from "./principles.controller";
import { PrinciplesService } from "./principles.service";

@Module({
  controllers: [PrinciplesController],
  providers: [PrinciplesService],
})
export class PrinciplesModule {}
