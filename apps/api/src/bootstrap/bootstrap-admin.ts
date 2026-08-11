import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

export async function bootstrapAdmin(
  prisma: PrismaClient,
  env: Pick<NodeJS.ProcessEnv, "ADMIN_EMAIL" | "ADMIN_PASSWORD" | "ORGANIZATION_NAME">,
): Promise<void> {
  const existing = await prisma.organization.findFirst();
  if (existing) {
    throw new Error("An Organization already exists for this instance — bootstrap can only run once");
  }

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.ORGANIZATION_NAME) {
    throw new Error("ADMIN_EMAIL, ADMIN_PASSWORD and ORGANIZATION_NAME are required to bootstrap");
  }

  await prisma.organization.create({
    data: { name: env.ORGANIZATION_NAME },
  });

  await prisma.champion.create({
    data: {
      email: env.ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 10),
      role: "admin",
    },
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  bootstrapAdmin(
    prisma,
    process.env as Pick<NodeJS.ProcessEnv, "ADMIN_EMAIL" | "ADMIN_PASSWORD" | "ORGANIZATION_NAME">,
  )
    .then(() => {
      console.log("Bootstrap complete.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err.message);
      await prisma.$disconnect();
      process.exit(1);
    });
}
