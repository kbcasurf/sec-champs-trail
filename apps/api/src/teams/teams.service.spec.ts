import { NotFoundException } from "@nestjs/common";
import { TeamsService } from "./teams.service";
import { PrismaService } from "../prisma/prisma.service";

describe("TeamsService", () => {
  const prisma = {
    organization: { findFirstOrThrow: jest.fn() },
    team: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  } as unknown as PrismaService;

  const service = new TeamsService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it("creates a Team under the instance's single Organization", async () => {
    (prisma.organization.findFirstOrThrow as jest.Mock).mockResolvedValue({ id: "org-1" });
    (prisma.team.create as jest.Mock).mockResolvedValue({ id: "team-1", name: "Payments", organizationId: "org-1" });

    const result = await service.create("Payments");

    expect(prisma.team.create).toHaveBeenCalledWith({ data: { name: "Payments", organizationId: "org-1" } });
    expect(result.id).toBe("team-1");
  });

  it("throws NotFoundException when the team does not exist", async () => {
    (prisma.team.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
  });
});
