import { PrismaClient } from "@prisma/client";
import { loadPrinciples, loadChecklistItems } from "@sec-champs-trail/owasp-content";

export async function seed(prisma: PrismaClient): Promise<void> {
  for (const principle of loadPrinciples()) {
    await prisma.principle.upsert({
      where: { id: principle.id },
      create: principle,
      update: principle,
    });
  }

  for (const item of loadChecklistItems()) {
    const phase = item.phase === "development-retention" ? "development_retention" : "recruitment";
    await prisma.checklistItem.upsert({
      where: { id: item.id },
      create: { ...item, phase },
      update: { ...item, phase },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
