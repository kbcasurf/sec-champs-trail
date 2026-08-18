import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Assessments (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teamAId: string;
  let teamBId: string;

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
    const teamA = await prisma.team.create({ data: { name: "Assessments E2E Team A", organizationId: organization.id } });
    const teamB = await prisma.team.create({ data: { name: "Assessments E2E Team B", organizationId: organization.id } });
    teamAId = teamA.id;
    teamBId = teamB.id;

    await prisma.champion.upsert({
      where: { email: "assessments-champion-a@example.com" },
      create: {
        email: "assessments-champion-a@example.com",
        passwordHash: await bcrypt.hash("correct-horse", 10),
        role: "champion",
        teamId: teamAId,
      },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.principleScore.deleteMany({ where: { assessment: { teamId: { in: [teamAId, teamBId] } } } });
    await prisma.maturityAssessment.deleteMany({ where: { teamId: { in: [teamAId, teamBId] } } });
    await prisma.champion.deleteMany({ where: { email: "assessments-champion-a@example.com" } });
    await prisma.team.deleteMany({ where: { id: { in: [teamAId, teamBId] } } });
    await app.close();
  });

  async function loginAsChampionA() {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email: "assessments-champion-a@example.com", password: "correct-horse" }).expect(200);
    return agent;
  }

  it("submits a full assessment and reads it back as 'latest'", async () => {
    const champion = await loginAsChampionA();
    const principles = await champion.get("/api/principles").expect(200);
    const scores = principles.body.map((p: { id: string }) => ({ principleId: p.id, score: 2 }));

    await champion.post(`/api/teams/${teamAId}/assessments`).send({ scores }).expect(201);

    const latest = await champion.get(`/api/teams/${teamAId}/assessments/latest`).expect(200);
    expect(latest.body.principleScores).toHaveLength(10);
  });

  it("retaking an assessment preserves history instead of overwriting it", async () => {
    const champion = await loginAsChampionA();
    const principles = await champion.get("/api/principles").expect(200);
    const firstScores = principles.body.map((p: { id: string }) => ({ principleId: p.id, score: 1 }));
    const secondScores = principles.body.map((p: { id: string }) => ({ principleId: p.id, score: 3 }));

    await champion.post(`/api/teams/${teamAId}/assessments`).send({ scores: firstScores }).expect(201);
    await champion.post(`/api/teams/${teamAId}/assessments`).send({ scores: secondScores }).expect(201);

    const history = await champion.get(`/api/teams/${teamAId}/assessments`).expect(200);
    expect(history.body.length).toBeGreaterThanOrEqual(2);

    const createdAtTimestamps = new Set(history.body.map((a: { createdAt: string }) => a.createdAt));
    expect(createdAtTimestamps.size).toBe(history.body.length);

    const latest = await champion.get(`/api/teams/${teamAId}/assessments/latest`).expect(200);
    expect(latest.body.principleScores.every((s: { score: number }) => s.score === 3)).toBe(true);
  });

  it("rejects a submission with fewer than 10 scores", async () => {
    const champion = await loginAsChampionA();
    const principles = await champion.get("/api/principles").expect(200);
    const scores = principles.body.slice(0, 5).map((p: { id: string }) => ({ principleId: p.id, score: 2 }));

    await champion.post(`/api/teams/${teamAId}/assessments`).send({ scores }).expect(400);
  });

  it("rejects a champion reading another team's assessments with 403", async () => {
    const champion = await loginAsChampionA();
    await champion.get(`/api/teams/${teamBId}/assessments/latest`).expect(403);
  });
});
