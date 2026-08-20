import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("AI status (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  const originalApiKey = process.env.AI_PROVIDER_API_KEY;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    await prisma.champion.upsert({
      where: { email: "ai-status-tester@example.com" },
      create: { email: "ai-status-tester@example.com", passwordHash: await bcrypt.hash("correct-horse", 10), role: "admin" },
      update: {},
    });

    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "ai-status-tester@example.com", password: "correct-horse" });
    cookie = loginRes.headers["set-cookie"][0];
  });

  afterAll(async () => {
    process.env.AI_PROVIDER_API_KEY = originalApiKey;
    await prisma.champion.deleteMany({ where: { email: "ai-status-tester@example.com" } });
    await app.close();
  });

  it("returns enabled: false when AI_PROVIDER_API_KEY is not set", async () => {
    delete process.env.AI_PROVIDER_API_KEY;
    const res = await request(app.getHttpServer()).get("/api/ai/status").set("Cookie", cookie).expect(200);
    expect(res.body).toEqual({ enabled: false });
  });

  it("returns enabled: true when AI_PROVIDER_API_KEY is set", async () => {
    process.env.AI_PROVIDER_API_KEY = "test-key";
    const res = await request(app.getHttpServer()).get("/api/ai/status").set("Cookie", cookie).expect(200);
    expect(res.body).toEqual({ enabled: true });
  });

  it("returns 401 without a valid session", async () => {
    await request(app.getHttpServer()).get("/api/ai/status").expect(401);
  });
});
