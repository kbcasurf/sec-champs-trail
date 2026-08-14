import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("ChecklistItems (e2e)", () => {
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
      where: { email: "checklist-reader@example.com" },
      create: { email: "checklist-reader@example.com", passwordHash: await bcrypt.hash("correct-horse", 10), role: "champion" },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.champion.deleteMany({ where: { email: "checklist-reader@example.com" } });
    await app.close();
  });

  it("filters by phase", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/login").send({ email: "checklist-reader@example.com", password: "correct-horse" }).expect(200);

    const res = await agent.get("/checklist-items?phase=recruitment").expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((i: { phase: string }) => i.phase === "recruitment")).toBe(true);
  });
});
