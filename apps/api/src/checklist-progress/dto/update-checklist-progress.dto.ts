import { IsIn } from "class-validator";

export class UpdateChecklistProgressDto {
  @IsIn(["pending", "in_progress", "done"])
  status!: "pending" | "in_progress" | "done";
}
