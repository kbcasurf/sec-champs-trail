import { IsIn, IsOptional, IsString } from "class-validator";

export class ChecklistItemsQueryDto {
  @IsOptional()
  @IsString()
  principleId?: string;

  @IsOptional()
  @IsIn(["recruitment", "development_retention"])
  phase?: "recruitment" | "development_retention";
}
