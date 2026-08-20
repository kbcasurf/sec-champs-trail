import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AiProviderService } from "../src/ai/ai-provider.service";

describe("Training tracks (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let teamId: string;

  beforeAll(async () => {
    const fakeAiProvider = {
      isEnabled: () => true,
      generate: async () =>
        JSON.stringify({ modules: [{ title: "Intro to OWASP Top 10", content: "## Overview\nSome content." }] }),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiProviderService)
      .useValue(fakeAiProvider)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const organization = await prisma.organization.upsert({
      where: { id: "org-training-track-test" },
      create: { id: "org-training-track-test", name: "Training Track Test Org" },
      update: {},
    });
    const team = await prisma.team.create({ data: { name: "Training Track E2E Team", organizationId: organization.id } });
    teamId = team.id;

    await prisma.champion.upsert({
      where: { email: "training-track-tester@example.com" },
      create: {
        email: "training-track-tester@example.com",
        passwordHash: await bcrypt.hash("correct-horse", 10),
        role: "champion",
        teamId,
      },
      update: { teamId },
    });

    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "training-track-tester@example.com", password: "correct-horse" });
    cookie = loginRes.headers["set-cookie"][0];
  });

  afterAll(async () => {
    await prisma.trainingModule.deleteMany({ where: { trainingTrack: { teamId } } });
    await prisma.trainingTrack.deleteMany({ where: { teamId } });
    await prisma.champion.deleteMany({ where: { email: "training-track-tester@example.com" } });
    await prisma.team.delete({ where: { id: teamId } });
    await app.close();
  });

  it("POST generates and persists a training track with its modules", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/teams/${teamId}/training-tracks`)
      .set("Cookie", cookie)
      .send({ techStack: "Node.js, Express", experienceLevel: "intermediate", hoursPerWeek: 4 })
      .expect(201);

    expect(res.body.techStack).toBe("Node.js, Express");
    expect(res.body.modules).toHaveLength(1);
    expect(res.body.modules[0].title).toBe("Intro to OWASP Top 10");
  });

  it("POST rejects an invalid experienceLevel", async () => {
    await request(app.getHttpServer())
      .post(`/api/teams/${teamId}/training-tracks`)
      .set("Cookie", cookie)
      .send({ techStack: "Node.js", experienceLevel: "expert", hoursPerWeek: 4 })
      .expect(400);
  });

  it("GET lists generated tracks, most recent first", async () => {
    const res = await request(app.getHttpServer()).get(`/api/teams/${teamId}/training-tracks`).set("Cookie", cookie).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("GET rejects a champion accessing another team's tracks", async () => {
    const organization = await prisma.organization.findFirstOrThrow();
    const otherTeam = await prisma.team.create({ data: { name: "Other Team", organizationId: organization.id } });
    await request(app.getHttpServer()).get(`/api/teams/${otherTeam.id}/training-tracks`).set("Cookie", cookie).expect(403);
    await prisma.team.delete({ where: { id: otherTeam.id } });
  });
});

describe("Training tracks without AI configured (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  let teamId: string;
  const originalApiKey = process.env.AI_PROVIDER_API_KEY;

  beforeAll(async () => {
    delete process.env.AI_PROVIDER_API_KEY;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const organization = await prisma.organization.upsert({
      where: { id: "org-training-track-no-ai-test" },
      create: { id: "org-training-track-no-ai-test", name: "Training Track No-AI Test Org" },
      update: {},
    });
    const team = await prisma.team.create({ data: { name: "No-AI E2E Team", organizationId: organization.id } });
    teamId = team.id;

    await prisma.champion.upsert({
      where: { email: "no-ai-tester@example.com" },
      create: { email: "no-ai-tester@example.com", passwordHash: await bcrypt.hash("correct-horse", 10), role: "champion", teamId },
      update: { teamId },
    });

    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "no-ai-tester@example.com", password: "correct-horse" });
    cookie = loginRes.headers["set-cookie"][0];
  });

  afterAll(async () => {
    process.env.AI_PROVIDER_API_KEY = originalApiKey;
    await prisma.champion.deleteMany({ where: { email: "no-ai-tester@example.com" } });
    await prisma.team.delete({ where: { id: teamId } });
    await app.close();
  });

  it("returns 403 when no AI provider is configured", async () => {
    await request(app.getHttpServer())
      .post(`/api/teams/${teamId}/training-tracks`)
      .set("Cookie", cookie)
      .send({ techStack: "Node.js", experienceLevel: "intermediate", hoursPerWeek: 4 })
      .expect(403);
  });
});
