import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateChampionDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(["admin", "champion"])
  role!: "admin" | "champion";

  @IsOptional()
  @IsString()
  teamId?: string;
}
