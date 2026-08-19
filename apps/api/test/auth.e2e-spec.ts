import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    await prisma.champion.upsert({
      where: { email: "captain@example.com" },
      create: {
        email: "captain@example.com",
        passwordHash: await bcrypt.hash("correct-horse", 10),
        role: "admin",
      },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.champion.deleteMany({ where: { email: "captain@example.com" } });
    await app.close();
  });

  it("POST /api/auth/login sets an httpOnly cookie and returns the champion's identity", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "captain@example.com", password: "correct-horse" })
      .expect(200);

    expect(res.body).toEqual({ id: expect.any(String), email: "captain@example.com", role: "admin", teamId: null });
    const cookieHeader = res.headers["set-cookie"][0];
    expect(cookieHeader).toContain("accessToken=");
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=Strict");
  });

  it("POST /api/auth/login returns 401 for wrong password", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "captain@example.com", password: "wrong" })
      .expect(401);
  });

  it("GET /api/auth/me returns the authenticated champion using the login cookie", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email: "captain@example.com", password: "correct-horse" }).expect(200);

    const res = await agent.get("/api/auth/me").expect(200);
    expect(res.body).toEqual({ id: expect.any(String), email: "captain@example.com", role: "admin", teamId: null });
  });

  it("GET /api/auth/me returns 401 without a cookie", async () => {
    await request(app.getHttpServer()).get("/api/auth/me").expect(401);
  });

  it("POST /api/auth/logout clears the cookie", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/api/auth/login").send({ email: "captain@example.com", password: "correct-horse" }).expect(200);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);
  });

  it("POST /api/auth/login enforces a rate limit after repeated failed attempts", async () => {
    let sawTooManyRequests = false;
    for (let i = 0; i < 20 && !sawTooManyRequests; i++) {
      const res = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "captain@example.com", password: "wrong" });
      if (res.status === 429) {
        sawTooManyRequests = true;
      } else {
        expect(res.status).toBe(401);
      }
    }
    expect(sawTooManyRequests).toBe(true);
  });
});
