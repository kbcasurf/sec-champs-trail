import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Teams (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    await prisma.organization.upsert({
      where: { id: "org-default" },
      create: { id: "org-default", name: "Default Organization" },
      update: {},
    });

    await prisma.champion.upsert({
      where: { email: "teams-admin@example.com" },
      create: { email: "teams-admin@example.com", passwordHash: await bcrypt.hash("correct-horse", 10), role: "admin" },
      update: {},
    });
    await prisma.champion.upsert({
      where: { email: "teams-champion@example.com" },
      create: { email: "teams-champion@example.com", passwordHash: await bcrypt.hash("correct-horse", 10), role: "champion" },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.team.deleteMany({ where: { name: "Payments Squad" } });
    await prisma.champion.deleteMany({ where: { email: { in: ["teams-admin@example.com", "teams-champion@example.com"] } } });
    await app.close();
  });

  async function loginAs(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/login").send({ email, password: "correct-horse" }).expect(200);
    return agent;
  }

  it("lets an admin create and list Teams", async () => {
    const admin = await loginAs("teams-admin@example.com");

    const created = await admin.post("/teams").send({ name: "Payments Squad" }).expect(201);
    expect(created.body.name).toBe("Payments Squad");

    const list = await admin.get("/teams").expect(200);
    expect(list.body.some((t: { id: string }) => t.id === created.body.id)).toBe(true);

    const detail = await admin.get(`/teams/${created.body.id}`).expect(200);
    expect(detail.body.champions).toEqual([]);
  });

  it("rejects a non-admin champion with 403", async () => {
    const champion = await loginAs("teams-champion@example.com");
    await champion.get("/teams").expect(403);
  });

  it("rejects an unauthenticated request with 401", async () => {
    await request(app.getHttpServer()).get("/teams").expect(401);
  });
});
