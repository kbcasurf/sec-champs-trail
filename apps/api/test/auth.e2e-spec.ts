import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
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

  it("POST /auth/login returns a token for valid credentials", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "captain@example.com", password: "correct-horse" })
      .expect(200);
    expect(typeof res.body.accessToken).toBe("string");
  });

  it("POST /auth/login returns 401 for wrong password", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "captain@example.com", password: "wrong" })
      .expect(401);
  });
});
