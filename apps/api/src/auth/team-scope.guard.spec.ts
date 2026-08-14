import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { TeamScopeGuard } from "./team-scope.guard";

function mockContext(user: unknown, params: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
  } as unknown as ExecutionContext;
}

describe("TeamScopeGuard", () => {
  const guard = new TeamScopeGuard();

  it("allows an admin regardless of teamId", () => {
    expect(guard.canActivate(mockContext({ role: "admin", teamId: null }, { teamId: "team-2" }))).toBe(true);
  });

  it("allows a champion whose teamId matches the route param", () => {
    expect(guard.canActivate(mockContext({ role: "champion", teamId: "team-1" }, { teamId: "team-1" }))).toBe(true);
  });

  it("rejects a champion whose teamId does not match the route param", () => {
    expect(() =>
      guard.canActivate(mockContext({ role: "champion", teamId: "team-1" }, { teamId: "team-2" })),
    ).toThrow(ForbiddenException);
  });

  it("rejects an admin when the route teamId param is missing", () => {
    expect(() => guard.canActivate(mockContext({ role: "admin", teamId: null }, {}))).toThrow(ForbiddenException);
  });

  it("rejects a champion when the route teamId param is missing", () => {
    expect(() => guard.canActivate(mockContext({ role: "champion", teamId: "team-1" }, {}))).toThrow(
      ForbiddenException,
    );
  });
});
