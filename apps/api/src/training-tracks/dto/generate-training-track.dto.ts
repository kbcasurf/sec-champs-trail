import { IsEnum, IsInt, IsString, Max, Min } from "class-validator";
import { ExperienceLevel } from "@prisma/client";

export class GenerateTrainingTrackDto {
  @IsString()
  techStack!: string;

  @IsEnum(ExperienceLevel)
  experienceLevel!: ExperienceLevel;

  @IsInt()
  @Min(1)
  @Max(40)
  hoursPerWeek!: number;
}
