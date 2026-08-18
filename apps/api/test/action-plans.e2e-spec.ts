import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("ActionPlans (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teamId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const organization = await prisma.organization.upsert({
      where: { id: "org-default" },
      create: { id: "org-default", name: "Default Organization" },
      update: {},
    });
    const team = await prisma.team.create({ data: { name: "Action Plans E2E Team", organizationId: organization.id } });
    teamId = team.id;

    await prisma.champion.upsert({
      where: { email: "action-plans-champion@example.com" },
      create: {
        email: "action-plans-champion@example.com",
        passwordHash: await bcrypt.hash("correct-horse", 10),
        role: "champion",
        teamId,
      },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.checklistProgress.deleteMany({ where: { teamId } });
    await prisma.actionItem.deleteMany({ where: { actionPlan: { teamId } } });
    await prisma.actionPlan.deleteMany({ where: { teamId } });
    await prisma.principleScore.deleteMany({ where: { assessment: { teamId } } });
    await prisma.maturityAssessment.deleteMany({ where: { teamId } });
    await prisma.champion.deleteMany({ where: { email: "action-plans-champion@example.com" } });
    await prisma.team.delete({ where: { id: teamId } });
    await app.close();
  });

  it("generating a plan without an assessment returns 400", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email: "action-plans-champion@example.com", password: "correct-horse" }).expect(200);
    await agent.post(`/api/teams/${teamId}/action-plans`).expect(400);
  });

  it("regenerating a plan preserves checklist progress already marked", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email: "action-plans-champion@example.com", password: "correct-horse" }).expect(200);

    const principles = await agent.get("/api/principles").expect(200);
    const scores = principles.body.map((p: { id: string }, i: number) => ({ principleId: p.id, score: i % 5 }));
    await agent.post(`/api/teams/${teamId}/assessments`).send({ scores }).expect(201);

    await agent.post(`/api/teams/${teamId}/action-plans`).expect(201);
    const firstPlan = await agent.get(`/api/teams/${teamId}/action-plans/latest`).expect(200);
    const someItemId = firstPlan.body.actionItems[0].checklistItemId;

    await agent.patch(`/api/teams/${teamId}/checklist-progress/${someItemId}`).send({ status: "done" }).expect(200);

    await agent.post(`/api/teams/${teamId}/action-plans`).expect(201);
    const secondPlan = await agent.get(`/api/teams/${teamId}/action-plans/latest`).expect(200);
    const sameItemInSecondPlan = secondPlan.body.actionItems.find(
      (i: { checklistItemId: string }) => i.checklistItemId === someItemId,
    );

    expect(sameItemInSecondPlan.status).toBe("done");
  });
});
