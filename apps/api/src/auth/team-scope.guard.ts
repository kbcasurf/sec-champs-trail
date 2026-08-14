import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { JwtPayload } from "./jwt.strategy";

@Injectable()
export class TeamScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user, params } = context
      .switchToHttp()
      .getRequest<{ user?: JwtPayload; params: Record<string, string> }>();

    if (!user || (user.role !== "admin" && user.teamId !== params.teamId)) {
      throw new ForbiddenException("Cannot access another team's data");
    }
    return true;
  }
}
