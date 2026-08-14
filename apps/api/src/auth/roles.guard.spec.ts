import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY } from "./roles.decorator";

function mockContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows the request when no @Roles metadata is set", () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(mockContext({ role: "champion" }))).toBe(true);
  });

  it("allows the request when the user's role is in the required list", () => {
    const reflector = { getAllAndOverride: () => ["admin"] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(mockContext({ role: "admin" }))).toBe(true);
  });

  it("rejects the request when the user's role is not in the required list", () => {
    const reflector = { getAllAndOverride: () => ["admin"] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(mockContext({ role: "champion" }))).toThrow(ForbiddenException);
  });
});
