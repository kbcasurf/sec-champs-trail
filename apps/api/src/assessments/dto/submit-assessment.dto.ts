import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class PrincipleScoreInput {
  @IsString()
  principleId!: string;

  @IsInt()
  @Min(0)
  @Max(4)
  score!: number;
}

export class SubmitAssessmentDto {
  @IsArray()
  @ArrayMinSize(10)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PrincipleScoreInput)
  scores!: PrincipleScoreInput[];
}
