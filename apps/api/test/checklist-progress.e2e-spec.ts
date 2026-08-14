import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("ChecklistProgress (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teamId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const organization = await prisma.organization.upsert({
      where: { id: "org-default" },
      create: { id: "org-default", name: "Default Organization" },
      update: {},
    });
    const team = await prisma.team.create({ data: { name: "Checklist Progress E2E Team", organizationId: organization.id } });
    teamId = team.id;

    await prisma.champion.upsert({
      where: { email: "checklist-progress-champion@example.com" },
      create: {
        email: "checklist-progress-champion@example.com",
        passwordHash: await bcrypt.hash("correct-horse", 10),
        role: "champion",
        teamId,
      },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.checklistProgress.deleteMany({ where: { teamId } });
    await prisma.champion.deleteMany({ where: { email: "checklist-progress-champion@example.com" } });
    await prisma.team.delete({ where: { id: teamId } });
    await app.close();
  });

  it("defaults every item to pending, then reflects a PATCH", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/login").send({ email: "checklist-progress-champion@example.com", password: "correct-horse" }).expect(200);

    const initial = await agent.get(`/teams/${teamId}/checklist-progress`).expect(200);
    expect(initial.body.every((i: { status: string }) => i.status === "pending")).toBe(true);

    const firstItemId = initial.body[0].id;
    await agent.patch(`/teams/${teamId}/checklist-progress/${firstItemId}`).send({ status: "done" }).expect(200);

    const updated = await agent.get(`/teams/${teamId}/checklist-progress`).expect(200);
    expect(updated.body.find((i: { id: string }) => i.id === firstItemId).status).toBe("done");
  });
});
