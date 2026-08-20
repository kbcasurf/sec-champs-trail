import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { AiProviderService } from "../src/ai/ai-provider.service";

describe("Executive reports (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let championCookie: string;

  beforeAll(async () => {
    const fakeAiProvider = {
      isEnabled: () => true,
      generate: async () => JSON.stringify({ report: "# Executive summary\nAll teams reviewed." }),
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

    await prisma.organization.upsert({
      where: { id: "org-default" },
      create: { id: "org-default", name: "Default Organization" },
      update: {},
    });

    await prisma.champion.upsert({
      where: { email: "exec-report-admin@example.com" },
      create: { email: "exec-report-admin@example.com", passwordHash: await bcrypt.hash("correct-horse", 10), role: "admin" },
      update: {},
    });
    await prisma.champion.upsert({
      where: { email: "exec-report-champion@example.com" },
      create: { email: "exec-report-champion@example.com", passwordHash: await bcrypt.hash("correct-horse", 10), role: "champion" },
      update: {},
    });

    const adminLogin = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "exec-report-admin@example.com", password: "correct-horse" });
    adminCookie = adminLogin.headers["set-cookie"][0];

    const championLogin = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "exec-report-champion@example.com", password: "correct-horse" });
    championCookie = championLogin.headers["set-cookie"][0];
  });

  afterAll(async () => {
    const organization = await prisma.organization.findFirstOrThrow();
    await prisma.executiveReport.deleteMany({ where: { organizationId: organization.id } });
    await prisma.champion.deleteMany({ where: { email: { in: ["exec-report-admin@example.com", "exec-report-champion@example.com"] } } });
    await app.close();
  });

  it("POST generates and persists an executive report (admin only)", async () => {
    const res = await request(app.getHttpServer()).post("/api/executive-reports").set("Cookie", adminCookie).expect(201);
    expect(res.body.content).toContain("Executive summary");
  });

  it("POST rejects a non-admin champion", async () => {
    await request(app.getHttpServer()).post("/api/executive-reports").set("Cookie", championCookie).expect(403);
  });

  it("GET lists generated reports, most recent first (admin only)", async () => {
    const res = await request(app.getHttpServer()).get("/api/executive-reports").set("Cookie", adminCookie).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("GET rejects a non-admin champion", async () => {
    await request(app.getHttpServer()).get("/api/executive-reports").set("Cookie", championCookie).expect(403);
  });
});
