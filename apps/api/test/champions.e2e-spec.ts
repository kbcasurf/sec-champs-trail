import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Champions (e2e)", () => {
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

    await prisma.champion.upsert({
      where: { email: "champions-admin@example.com" },
      create: { email: "champions-admin@example.com", passwordHash: await bcrypt.hash("correct-horse", 10), role: "admin" },
      update: {},
    });
    const organization = await prisma.organization.upsert({
      where: { id: "org-default" },
      create: { id: "org-default", name: "Default Organization" },
      update: {},
    });
    const team = await prisma.team.create({ data: { name: "Champions E2E Team", organizationId: organization.id } });
    teamId = team.id;

    await prisma.champion.upsert({
      where: { email: "champions-non-admin@example.com" },
      create: { email: "champions-non-admin@example.com", passwordHash: await bcrypt.hash("correct-horse", 10), role: "champion", teamId },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.champion.deleteMany({
      where: { email: { in: ["champions-admin@example.com", "champions-non-admin@example.com", "new-champion@example.com", "duplicate@example.com"] } },
    });
    await prisma.team.delete({ where: { id: teamId } });
    await app.close();
  });

  async function loginAsAdmin() {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email: "champions-admin@example.com", password: "correct-horse" }).expect(200);
    return agent;
  }

  it("creates a champion assigned to a team", async () => {
    const admin = await loginAsAdmin();
    const res = await admin
      .post("/api/champions")
      .send({ email: "new-champion@example.com", password: "correct-horse", role: "champion", teamId })
      .expect(201);
    expect(res.body).toEqual({ id: expect.any(String), email: "new-champion@example.com", role: "champion", teamId });
  });

  it("rejects role 'champion' with no teamId", async () => {
    const admin = await loginAsAdmin();
    await admin
      .post("/api/champions")
      .send({ email: "no-team@example.com", password: "correct-horse", role: "champion" })
      .expect(400);
  });

  it("rejects duplicate email with 409", async () => {
    const admin = await loginAsAdmin();
    await admin
      .post("/api/champions")
      .send({ email: "duplicate@example.com", password: "correct-horse", role: "admin" })
      .expect(201);
    await admin
      .post("/api/champions")
      .send({ email: "duplicate@example.com", password: "different-password", role: "admin" })
      .expect(409);
  });

  it("rejects a non-admin creating a champion with 403", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email: "champions-non-admin@example.com", password: "correct-horse" }).expect(200);
    await agent.post("/api/champions").send({ email: "should-not-exist@example.com", password: "correct-horse", role: "champion", teamId }).expect(403);
  });
});
