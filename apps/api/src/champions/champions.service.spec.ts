import { BadRequestException } from "@nestjs/common";
import { ChampionsService } from "./champions.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ChampionsService", () => {
  const prisma = {
    team: { findUnique: jest.fn() },
    champion: { create: jest.fn() },
  } as unknown as PrismaService;

  const service = new ChampionsService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it("throws when role is 'champion' and no teamId is given", async () => {
    await expect(
      service.create({ email: "a@example.com", password: "correct-horse", role: "champion" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws when teamId does not reference an existing Team", async () => {
    (prisma.team.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      service.create({ email: "a@example.com", password: "correct-horse", role: "champion", teamId: "missing" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("creates an admin with no teamId", async () => {
    (prisma.champion.create as jest.Mock).mockResolvedValue({ id: "c1", email: "a@example.com", role: "admin", teamId: null });
    const result = await service.create({ email: "a@example.com", password: "correct-horse", role: "admin" });
    expect(result.teamId).toBeNull();
  });

  it("creates a champion with a valid teamId", async () => {
    (prisma.team.findUnique as jest.Mock).mockResolvedValue({ id: "team-1" });
    (prisma.champion.create as jest.Mock).mockResolvedValue({ id: "c2", email: "b@example.com", role: "champion", teamId: "team-1" });

    const result = await service.create({ email: "b@example.com", password: "correct-horse", role: "champion", teamId: "team-1" });
    expect(result.teamId).toBe("team-1");
  });
});
