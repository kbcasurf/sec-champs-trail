import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Principles (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    prisma = moduleRef.get(PrismaService);

    await prisma.champion.upsert({
      where: { email: "principles-reader@example.com" },
      create: { email: "principles-reader@example.com", passwordHash: await bcrypt.hash("correct-horse", 10), role: "champion" },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.champion.deleteMany({ where: { email: "principles-reader@example.com" } });
    await app.close();
  });

  it("returns the 10 seeded principles with 5 maturity levels each, for any authenticated role", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/login").send({ email: "principles-reader@example.com", password: "correct-horse" }).expect(200);

    const res = await agent.get("/principles").expect(200);
    expect(res.body).toHaveLength(10);
    expect(res.body[0].maturityLevels).toHaveLength(5);
  });

  it("returns 401 without a cookie", async () => {
    await request(app.getHttpServer()).get("/principles").expect(401);
  });
});
