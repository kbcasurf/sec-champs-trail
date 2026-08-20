import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";

// Regression test for the finding fixed alongside this file: .env.example used to ship
// TRUST_PROXY_HOPS=1 *active* even though the default docker-compose.yml has no reverse
// proxy in front of the app. With trust proxy on and no real proxy present, Express takes
// the client-supplied X-Forwarded-For header at face value for req.ip -- which is exactly
// what @nestjs/throttler keys its rate-limit buckets on -- so any client could spoof a
// fresh IP on every request and dodge both the login and global rate limiters entirely.
//
// This app instance is built the same way auth.e2e-spec.ts builds its app: via
// Test.createTestingModule, never through src/main.ts's bootstrap(). Only bootstrap()
// reads TRUST_PROXY_HOPS and calls app.set("trust proxy", ...), so an app built this way
// never has trust proxy configured -- matching the default (TRUST_PROXY_HOPS unset)
// deployment. req.ip must therefore reflect supertest's real loopback connection, never
// an attacker-supplied X-Forwarded-For header.
describe("Rate limiting with a spoofed X-Forwarded-For header (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("still triggers the login rate limit within 10 attempts even when every request carries a different spoofed X-Forwarded-For", async () => {
    let sawTooManyRequests = false;
    let attemptsUntilThrottled = 0;

    for (let i = 0; i < 20 && !sawTooManyRequests; i++) {
      attemptsUntilThrottled++;
      const res = await request(app.getHttpServer())
        .post("/api/auth/login")
        .set("X-Forwarded-For", `10.0.0.${i}`) // a different spoofed client IP on every attempt
        .send({ email: "nobody@example.com", password: "wrong" });

      if (res.status === 429) {
        sawTooManyRequests = true;
      } else {
        expect(res.status).toBe(401);
      }
    }

    // The login route is throttled at 10 requests/minute (see AuthController): 10 requests
    // are allowed through and the 11th is blocked. If the spoofed header were honored, each
    // request would land in its own bucket and this would never trip -- proving trust proxy
    // is genuinely off by default.
    expect(sawTooManyRequests).toBe(true);
    expect(attemptsUntilThrottled).toBeLessThanOrEqual(11);
  });
});
