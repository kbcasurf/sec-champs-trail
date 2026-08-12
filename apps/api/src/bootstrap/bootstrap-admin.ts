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

  const { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, ORGANIZATION_NAME: organizationName } = env;
  if (!adminEmail || !adminPassword || !organizationName) {
    throw new Error("ADMIN_EMAIL, ADMIN_PASSWORD and ORGANIZATION_NAME are required to bootstrap");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.organization.create({
      data: { name: organizationName },
    });

    await tx.champion.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: "admin",
      },
    });
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
