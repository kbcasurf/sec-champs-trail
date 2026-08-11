import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { bootstrapAdmin } from "./bootstrap-admin";

describe("bootstrapAdmin", () => {
  const prisma = new PrismaClient();
  const env = {
    ADMIN_EMAIL: "captain@example.com",
    ADMIN_PASSWORD: "correct-horse-battery-staple",
    ORGANIZATION_NAME: "Acme Corp",
  };

  afterEach(async () => {
    await prisma.champion.deleteMany({ where: { email: env.ADMIN_EMAIL } });
    await prisma.organization.deleteMany({ where: { name: env.ORGANIZATION_NAME } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates one Organization and one admin Champion", async () => {
    await bootstrapAdmin(prisma, env);

    const org = await prisma.organization.findFirst({ where: { name: "Acme Corp" } });
    expect(org).not.toBeNull();

    const admin = await prisma.champion.findUnique({ where: { email: env.ADMIN_EMAIL } });
    expect(admin?.role).toBe("admin");
    expect(await bcrypt.compare(env.ADMIN_PASSWORD, admin!.passwordHash)).toBe(true);
  });

  it("throws if an Organization already exists", async () => {
    await bootstrapAdmin(prisma, env);
    await expect(bootstrapAdmin(prisma, env)).rejects.toThrow(/already exists/i);
  });
});
