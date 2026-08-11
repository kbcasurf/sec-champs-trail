import { PrismaClient } from "@prisma/client";
import { seed } from "./seed";

describe("seed", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("upserts all 10 principles and every checklist item, idempotently", async () => {
    await seed(prisma);
    await seed(prisma); // run twice — must not throw or duplicate

    const principleCount = await prisma.principle.count();
    expect(principleCount).toBe(10);

    const checklistCount = await prisma.checklistItem.count();
    expect(checklistCount).toBeGreaterThan(0);

    const anyPrinciple = await prisma.principle.findFirst({ orderBy: { order: "asc" } });
    expect(anyPrinciple?.license).toBe("CC BY-SA 4.0");
  });
});
