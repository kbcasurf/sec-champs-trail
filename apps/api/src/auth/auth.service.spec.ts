import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuthService", () => {
  const champion = {
    id: "champ-1",
    email: "captain@example.com",
    passwordHash: bcrypt.hashSync("correct-horse", 10),
    role: "admin" as const,
    teamId: null,
    createdAt: new Date(),
  };

  const prisma = {
    champion: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  const jwt = new JwtService({ secret: "test-secret-at-least-16-chars" });
  const service = new AuthService(prisma, jwt);

  beforeEach(() => jest.clearAllMocks());

  it("returns the champion when credentials are valid", async () => {
    (prisma.champion.findUnique as jest.Mock).mockResolvedValue(champion);
    const result = await service.validateCredentials("captain@example.com", "correct-horse");
    expect(result?.id).toBe("champ-1");
  });

  it("returns null when the password is wrong", async () => {
    (prisma.champion.findUnique as jest.Mock).mockResolvedValue(champion);
    const result = await service.validateCredentials("captain@example.com", "wrong-password");
    expect(result).toBeNull();
  });

  it("returns null when no champion has that email", async () => {
    (prisma.champion.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await service.validateCredentials("nobody@example.com", "anything");
    expect(result).toBeNull();
  });

  it("still runs a bcrypt comparison when no champion has that email (timing-safe)", async () => {
    (prisma.champion.findUnique as jest.Mock).mockResolvedValue(null);

    // Track if bcrypt.compare is called by measuring response time
    const startTime = Date.now();
    const result = await service.validateCredentials("nobody@example.com", "anything");
    const duration = Date.now() - startTime;

    // bcrypt.compare takes significant time (at least a few ms)
    // If it's not called, duration will be ~0ms
    // If it's called, duration will be at least 10-50ms
    expect(result).toBeNull();
    expect(duration).toBeGreaterThan(5);
  });

  it("issues a JWT containing the champion's id, email, role and teamId", () => {
    const { accessToken } = service.issueToken(champion);
    const decoded = jwt.decode(accessToken) as Record<string, unknown>;
    expect(decoded.sub).toBe("champ-1");
    expect(decoded.email).toBe("captain@example.com");
    expect(decoded.role).toBe("admin");
    expect(decoded.teamId).toBeNull();
  });
});
