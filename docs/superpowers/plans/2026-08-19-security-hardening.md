# Security hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 5 confirmed findings from the 2026-08-19 manual security review
(`docs/security-review-2026-08-19.md`) — a login timing side-channel, a missing
`JWT_SECRET` length floor, no rate limiting on auth, no HTTP security headers, and
outdated frontend dependencies with a known open-redirect/XSS advisory — plus add an
optional local-HTTPS dev setup (modeled on `~/Documentos/repos/threat-dragon-ai`'s Caddy
setup) so the `Secure` cookie flag and HSTS header from the headers fix can actually be
exercised locally instead of only in a real deployment.

**Architecture:** Mostly `apps/api` (auth service, env validation, app bootstrap, one new
dependency each for rate limiting and headers). One dependency bump in `apps/web`
(`react-router-dom`, no code change). Two new files at the repo root for the optional
Caddy setup. No database schema changes, no new endpoints, no UI changes.

**Tech Stack:** NestJS 10.4.x (unchanged — the NestJS 11 upgrade that would resolve the
remaining moderate CVEs is out of scope, see spec section 2), `@nestjs/throttler@^6.5.0`,
`helmet@^8.3.0`, Caddy 2 (Docker image, no new language/runtime).

**Spec:** `docs/superpowers/specs/2026-08-19-security-hardening-design.md`

## Global Constraints

- No UI/design changes in `apps/web` beyond the `react-router-dom` version bump (no code
  changes needed for that bump — same major version, see Task 5).
- Do not attempt the NestJS 10 → 11 upgrade in this plan — it's tracked as backlog in
  ADR 0004 (Task 7), not implemented here (spec section 2).
- Do not edit the historical plan files `docs/superpowers/plans/2026-08-10-*` or
  `2026-08-13-*` even though they also mention "16 characters" for `JWT_SECRET` — they're
  immutable records of what was decided/done at the time, not the current source of truth
  (spec section 2).
- The `JWT_SECRET` minimum-length change (Task 2) is a deliberate breaking change: any
  environment with a 16-31 character secret will fail to boot after this ships, with a
  clear error. That's intended — don't add a migration shim or a warning-only mode.
- Run `npm run typecheck -w apps/api`, `npm run lint -w apps/api`, `npm run test -w apps/api`
  after every backend task (1-4); all three must be clean before moving on. Task 5 also
  touches `apps/web` (`npm run typecheck -w apps/web`, `npm run test -w apps/web`).
- Task 6 (Caddy) is optional dev/test tooling, not a vulnerability fix — it doesn't block
  Tasks 1-5 being considered complete, but is part of this plan because it's the only way
  to verify Task 4's `Secure`/HSTS behavior locally (spec section 1).

---

### Task 1: Timing-safe login (close the account-enumeration side-channel)

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`

**Interfaces:** none new — `validateCredentials`'s signature and return type are
unchanged, only its internal behavior on the "no such email" path changes.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/auth/auth.service.spec.ts`, inside the existing `describe("AuthService", ...)` block:

```ts
  it("still runs a bcrypt comparison when no champion has that email (timing-safe)", async () => {
    const compareSpy = jest.spyOn(bcrypt, "compare");
    (prisma.champion.findUnique as jest.Mock).mockResolvedValue(null);

    await service.validateCredentials("nobody@example.com", "anything");

    expect(compareSpy).toHaveBeenCalledTimes(1);
    compareSpy.mockRestore();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/api -- auth.service`
Expected: FAIL — `compareSpy` is called 0 times (the current code returns `null` before
ever calling `bcrypt.compare` when `champion` is `null`).

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/auth/auth.service.ts`, add a module-level constant right after the
imports:

```ts
// A hash of a random password no real champion uses. Comparing against it on the
// "no such email" path means that path pays the same bcrypt cost as a real login
// attempt, closing the timing side-channel that would otherwise let a caller
// distinguish "no such account" from "wrong password" by response latency alone.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("no-champion-has-this-password", 10);
```

Then replace `validateCredentials`:

```ts
  async validateCredentials(email: string, password: string): Promise<Champion | null> {
    const champion = await this.prisma.champion.findUnique({ where: { email } });
    const passwordMatches = await bcrypt.compare(password, champion?.passwordHash ?? DUMMY_PASSWORD_HASH);
    return champion && passwordMatches ? champion : null;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/api -- auth.service`
Expected: PASS (all `AuthService` tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.service.spec.ts
git commit -m "fix(api): compare against a dummy hash on login to close a timing side-channel"
```

---

### Task 2: Raise the `JWT_SECRET` minimum to 32 characters

**Files:**
- Modify: `apps/api/src/config/env.validation.ts`
- Test: `apps/api/src/config/env.validation.spec.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:** none new — `validateEnv`'s signature is unchanged, only the threshold and
its error message.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/config/env.validation.spec.ts`, replace the existing boundary test:

```ts
  it("throws when JWT_SECRET is shorter than 16 characters", () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });
```

with:

```ts
  it("throws when JWT_SECRET is shorter than 32 characters", () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: "a".repeat(31) })).toThrow(/JWT_SECRET/);
  });

  it("does not throw when JWT_SECRET is exactly 32 characters", () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: "a".repeat(32) })).not.toThrow();
  });
```

Also update the top-of-file `validEnv` fixture, since `"a-secret-that-is-long-enough"` is
only 28 characters:

```ts
  const validEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    JWT_SECRET: "a-secret-that-is-at-least-32-characters-long",
    WEB_ORIGIN: "http://localhost:5173",
  };
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/api -- env.validation`
Expected: FAIL — the new `"does not throw when JWT_SECRET is exactly 32 characters"` case
passes already (32 ≥ 16), but the new "shorter than 32" case fails because the current
threshold is 16 and `"a".repeat(31)` (31 chars) doesn't throw yet.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/config/env.validation.ts`, replace:

```ts
  if (env.JWT_SECRET!.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters long");
  }
```

with:

```ts
  if (env.JWT_SECRET!.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/api -- env.validation`
Expected: PASS (all `validateEnv` tests, including the 2 new/changed ones).

- [ ] **Step 5: Update the docs that quote the old threshold**

In `.env.example`, replace line 5:

```
# Required — no default is provided. Must be at least 16 characters.
```

with:

```
# Required — no default is provided. Must be at least 32 characters (e.g.
# `openssl rand -base64 32`) — a short, memorable phrase is not enough entropy
# for an HMAC-SHA256 signing key.
```

In `README.md`, replace (around line 95):

```
   At minimum, set `JWT_SECRET` (16+ characters, no default value) and `ADMIN_EMAIL`,
```

with:

```
   At minimum, set `JWT_SECRET` (32+ characters, no default value — generate one with
   `openssl rand -base64 32`) and `ADMIN_EMAIL`,
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config/env.validation.ts apps/api/src/config/env.validation.spec.ts .env.example README.md
git commit -m "fix(api): raise the JWT_SECRET minimum length from 16 to 32 characters"
```

---

### Task 3: Rate limiting (`@nestjs/throttler`), tighter on `/auth/login`

**Files:**
- Modify: `apps/api/package.json` (add `@nestjs/throttler`)
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Produces: a global `ThrottlerGuard` (100 req/min/IP) registered as `APP_GUARD` in
  `AppModule`; `POST /auth/login` overridden to 10 req/min/IP via `@Throttle(...)`.

- [ ] **Step 1: Install the dependency**

```bash
npm install @nestjs/throttler@^6.5.0 -w apps/api
```

- [ ] **Step 2: Write the failing test**

Add to the end of the `describe("Auth (e2e)", ...)` block in
`apps/api/test/auth.e2e-spec.ts` (after the existing 5 `it`s — order matters here, see
spec section 3's note on why this test loops instead of asserting an exact count):

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:e2e -w apps/api -- auth`
Expected: FAIL — every one of the 20 attempts returns 401, never 429 (no throttling
exists yet).

- [ ] **Step 4: Write minimal implementation**

In `apps/api/src/app.module.ts`, add the imports:

```ts
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
```

Add `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` as the first entry in
`imports`, and add a `providers` array:

```ts
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    TeamsModule,
    ChampionsModule,
    PrinciplesModule,
    ChecklistItemsModule,
    AssessmentsModule,
    ChecklistProgressModule,
    ActionPlansModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

In `apps/api/src/auth/auth.controller.ts`, add the import:

```ts
import { Throttle } from "@nestjs/throttler";
```

and add the decorator right above the login handler:

```ts
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:e2e -w apps/api -- auth`
Expected: PASS (all `Auth (e2e)` tests, including the new one).

- [ ] **Step 6: Run the full e2e suite to check for cross-file regressions**

Run: `npm run test:e2e -w apps/api`
Expected: PASS. Each e2e spec file compiles its own `AppModule` instance in its own
`beforeAll`, so `ThrottlerStorage` isn't shared across files — the global 100/min limit
has ample headroom against any single file's request count (the busiest non-auth file
makes 2 requests total, per the spec's audit of every `*.e2e-spec.ts`).

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/app.module.ts apps/api/src/auth/auth.controller.ts apps/api/test/auth.e2e-spec.ts
git commit -m "feat(api): add rate limiting, with a tighter limit on login"
```

---

### Task 4: HTTP security headers via `helmet`

**Files:**
- Modify: `apps/api/package.json` (add `helmet`)
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/test/app.e2e-spec.ts`

**Interfaces:** none new — pure middleware addition, no new exports.

- [ ] **Step 1: Install the dependency**

```bash
npm install helmet@^8.3.0 -w apps/api
```

- [ ] **Step 2: Write the failing test**

`apps/api/test/app.e2e-spec.ts` currently builds its Nest app without replicating
`main.ts`'s middleware (same pattern `auth.e2e-spec.ts` already uses — each e2e file
manually mirrors the subset of `bootstrap()` it needs). Update its `beforeAll` to add the
same `helmet` call `main.ts` will get in Step 4, and add a new test. Replace the whole
file with:

```ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import helmet from "helmet";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "frame-ancestors": ["'none'"],
          },
        },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health returns ok status", () => {
    return request(app.getHttpServer())
      .get("/api/health")
      .expect(200)
      .expect({ status: "ok" });
  });

  it("GET /api/health sends hardened security headers", async () => {
    const res = await request(app.getHttpServer()).get("/api/health").expect(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:e2e -w apps/api -- app`
Expected: FAIL — `helmet` isn't installed yet (import error), or once installed but
before Step 4, the headers aren't present (the test app now sends them because Step 2
already added `helmet` to *this test's* `beforeAll`, but this confirms the test itself is
correctly written and would fail without it — temporarily comment out the `app.use(helmet(...))`
call to verify the header assertions actually fail before restoring it, then proceed to
Step 4 to add the equivalent call to `main.ts` for the real running app).

- [ ] **Step 4: Write minimal implementation**

In `apps/api/src/main.ts`, add the import:

```ts
import helmet from "helmet";
```

and add the middleware right after `app.use(cookieParser())`:

```ts
  app.use(cookieParser());
  app.use(
    helmet({
      // helmet's own defaults (style-src 'self' https: 'unsafe-inline', font-src 'self'
      // https: data:, script-src 'self', connect-src via default-src 'self', etc.) already
      // cover this app as-is: the Google Fonts stylesheet/font files load over https:, the
      // Vite build has no inline scripts, and every fetch is same-origin (VITE_API_URL=/api).
      // The one directive worth tightening beyond the default is frame-ancestors: this app
      // has no legitimate reason to ever be framed, including by itself, so 'none' instead
      // of helmet's default 'self'.
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "frame-ancestors": ["'none'"],
        },
      },
    }),
  );
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:e2e -w apps/api -- app`
Expected: PASS (both `AppController (e2e)` tests).

- [ ] **Step 6: Manual verification against the running app**

With the stack running (`docker compose up --build`), run:

```bash
curl -sD - http://localhost:3000/api/health -o /dev/null | grep -i "content-security-policy\|x-frame-options\|strict-transport-security"
```

Expected: all three headers present, `content-security-policy` containing
`frame-ancestors 'none'`. Then open the web app in a browser and confirm the Google Fonts
(Space Grotesk / IBM Plex Sans / IBM Plex Mono) still render and the progress bars
(Checklist, Assessment form, Dashboard score bars) still show their inline-width fill —
these are exactly the two things a misconfigured CSP would silently break.

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/package-lock.json apps/api/src/main.ts apps/api/test/app.e2e-spec.ts
git commit -m "feat(api): add HTTP security headers via helmet"
```

---

### Task 5: Dependency hygiene — patch `react-router`, lower the CI audit gate

**Files:**
- Modify: `apps/web/package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:** none — dependency version bump and a CI threshold change only.

- [ ] **Step 1: Bump `react-router-dom`**

```bash
npm install react-router-dom@^6.30.6 react-router@^6.30.6 -w apps/web
```

- [ ] **Step 2: Verify the advisories are gone**

Run: `npm audit --omit=dev`
Expected: `react-router` and `react-router-dom` no longer appear in the report (9
moderate advisories → 6; the remaining 6 —`@nestjs/core`, `@nestjs/platform-express`,
`body-parser`, `express`, `qs`, `file-type`— all require the NestJS 11 upgrade tracked in
Task 7's ADR, not fixable independently).

- [ ] **Step 3: Confirm the frontend still builds and tests pass**

Run: `npm run typecheck -w apps/web && npm run test -w apps/web`
Expected: PASS, unchanged — this is a patch-level bump within the same major version
(`^6.26.0`'s declared range already permitted it), no API changes.

- [ ] **Step 4: Lower the CI audit gate on the production-only job**

In `.github/workflows/ci.yml`, inside the `npm-audit` job, replace:

```yaml
      - run: npm audit --omit=dev --audit-level=high
```

with:

```yaml
      - run: npm audit --omit=dev --audit-level=moderate
```

- [ ] **Step 5: Confirm the lowered gate currently passes**

Run: `npm audit --omit=dev --audit-level=moderate`
Expected: exit code 0 — after Step 1's bump, the only remaining moderate advisories are
the 6 tied to the NestJS 11 upgrade (Task 7 tracks this as backlog, not a blocker for this
gate change; if this step fails, stop and re-check the finding-4 analysis in the spec
before proceeding, since it would mean the gate is now failing CI for everyone).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json .github/workflows/ci.yml
git commit -m "fix(web): patch react-router open-redirect/XSS advisory, tighten CI audit gate"
```

---

### Task 6: Optional local HTTPS via Caddy

**Files:**
- Create: `Caddyfile`
- Create: `docker-compose.https.yml`
- Modify: `apps/api/src/main.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: `TRUST_PROXY_HOPS` env var (optional, default `0`), read once in `main.ts`.

- [ ] **Step 1: Create the Caddyfile**

Create `Caddyfile` at the repo root:

```
localhost {
    reverse_proxy app:3000
}
```

- [ ] **Step 2: Create the standalone HTTPS compose file**

Create `docker-compose.https.yml` at the repo root:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: champion
      POSTGRES_PASSWORD: champion
      POSTGRES_DB: championforge
    volumes:
      - championforge-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U champion"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build:
      context: .
      dockerfile: Dockerfile
    env_file:
      - path: .env
        required: false
    environment:
      DATABASE_URL: postgresql://champion:champion@postgres:5432/championforge
      JWT_SECRET: ${JWT_SECRET}
      WEB_ORIGIN: https://localhost
      NODE_ENV: production
      TRUST_PROXY_HOPS: "1"
      PORT: 3000
    depends_on:
      postgres:
        condition: service_healthy

  caddy:
    image: caddy:2-alpine
    depends_on:
      - app
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config

volumes:
  championforge-db:
  caddy-data:
  caddy-config:
```

(Self-contained rather than a compose override of the base file — see spec section 3 for
why: Compose can't cleanly *remove* the base file's direct `3000:3000` port publish from
an override without `!reset` tags, and this stays as simple to read/run as the existing
`docker-compose.yml`.)

- [ ] **Step 3: Wire up `TRUST_PROXY_HOPS` in `main.ts`**

In `apps/api/src/main.ts`, add right after `app.enableCors(...)`:

```ts
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (trustProxyHops > 0) {
    // Trust exactly this many hops of X-Forwarded-* (1 for the bundled local Caddy in
    // docker-compose.https.yml) -- never `true`, which would trust the entire header
    // chain unconditionally and let a client spoof its own IP to dodge the rate limiting
    // above. (See threat-dragon-ai's README for a real instance of that exact misconfiguration.)
    app.set("trust proxy", trustProxyHops);
  }
```

- [ ] **Step 4: Document it**

In `.env.example`, add after the existing `WEB_ORIGIN` line:

```
# Optional. Only set when running behind a reverse proxy (e.g. docker-compose.https.yml's
# bundled Caddy) -- the exact number of proxy hops to trust for X-Forwarded-*, so the
# rate limiter sees the real client IP instead of the proxy's. Leave unset for the default
# docker-compose.yml (app reachable directly, no proxy in front).
TRUST_PROXY_HOPS=1
```

In `README.md`, add a new subsection after `### Resetting the local environment` (before
`### Running without Docker (development)`):

```markdown
### Local HTTPS (optional)

`docker-compose.https.yml` runs the same stack behind a local Caddy reverse proxy on
ports 80/443, terminating TLS with Caddy's own internal certificate authority — modeled
on [threat-dragon-ai's Caddy setup][td-caddy]. This is the only way to actually exercise
the app's `Secure` cookie flag and `Strict-Transport-Security` header locally (the default
`docker-compose.yml` serves plain HTTP, so `NODE_ENV` stays unset and both stay off — see
`.env.example`).

```bash
docker compose -f docker-compose.https.yml up --build
```

Then open `https://localhost`. The browser will show a certificate warning — Caddy can't
install its internal CA into the host's trust store from inside a container, so this is
expected, not a bug. Either click through the warning, or trust it properly:

```bash
docker compose -f docker-compose.https.yml exec caddy cat /data/caddy/pki/authorities/local/root.crt > /tmp/caddy-local-ca.crt
```

and import `/tmp/caddy-local-ca.crt` into your OS or browser's trust store.

[td-caddy]: https://github.com/kbcasurf/threat-dragon-ai
```

- [ ] **Step 5: Manual verification**

```bash
docker compose -f docker-compose.https.yml up --build
```

Open `https://localhost`, click through the certificate warning, log in, and in DevTools
→ Application → Cookies confirm `accessToken` has `Secure` checked. Then:

```bash
curl -skD - https://localhost/api/health -o /dev/null | grep -i strict-transport-security
```

Expected: header present. Tear down with `docker compose -f docker-compose.https.yml down -v`.

- [ ] **Step 6: Commit**

```bash
git add Caddyfile docker-compose.https.yml apps/api/src/main.ts .env.example README.md
git commit -m "feat: add an optional local HTTPS stack via Caddy"
```

---

### Task 7: Document this hardening pass as ADR 0004

**Files:**
- Create: `docs/adr/0004-security-hardening.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0004-security-hardening.md`:

```markdown
# ADR 0004: Security hardening (auth, headers, dependencies)

- Status: Accepted
- Date: 2026-08-19
- Motivated by: a full manual security review of the application (not a diff review —
  the whole codebase), requested ahead of any external audit, given the app's own subject
  matter is application security. Full findings in `docs/security-review-2026-08-19.md`;
  design decisions in `docs/superpowers/specs/2026-08-19-security-hardening-design.md`;
  implemented via `docs/superpowers/plans/2026-08-19-security-hardening.md`.

## Context

The review found 5 confirmed findings by reading (not guessing at) the actual auth,
validation, and bootstrap code, cross-checked against what the existing CI security gates
(Semgrep, CodeQL, TruffleHog, ZAP baseline, `npm audit --audit-level=high`) already catch,
to avoid duplicating coverage and to find the gaps between them.

## Decision — close all 5 findings, track what can't be closed safely

1. **Login timing side-channel** (`auth.service.ts`): fixed by always running a bcrypt
   comparison, against a dummy hash when no champion matches the email, instead of
   returning early.
2. **`JWT_SECRET` minimum length**: raised from 16 to 32 characters. Deliberately
   breaking — any environment with a weaker secret fails fast on boot with a clear error
   rather than continuing to accept it silently.
3. **No rate limiting on login**: added `@nestjs/throttler`, global default (100 req/min/IP)
   plus a tighter override on `POST /auth/login` (10 req/min/IP).
4. **No HTTP security headers**: added `helmet`, using its own default CSP directives
   (already compatible with this app's Google Fonts usage and its handful of
   runtime-computed `style={{width}}` progress bars) with only `frame-ancestors`
   tightened from the default `'self'` to `'none'`.
5. **Outdated `react-router`/`react-router-dom`** (open redirect → XSS advisory): patched
   to `^6.30.6`, a same-major bump. The CI `npm-audit` job's gate was also lowered from
   `--audit-level=high` to `--audit-level=moderate` (scoped to production dependencies
   only, so devDependency-only high/critical findings — build tooling like `vite`,
   `vitest`, `@nestjs/cli` — stay out of scope, as they don't ship in the runtime image),
   closing the gap that let this class of finding land unnoticed.

**Explicitly not done here — tracked as follow-up:**

- **NestJS 10 → 11 upgrade.** This is the only fix for the remaining moderate CVEs in
  `@nestjs/core`, `@nestjs/platform-express`, and transitively `express`/`body-parser`/
  `qs`/`file-type`. It's a semver-major bump with its own breaking-change surface and
  deserves its own spec/plan rather than riding along with an auth/headers hardening pass.
- **Server-side session/token revocation.** Logout only clears the cookie; a copied JWT
  stays valid for its full 8h lifetime. Accepted trade-off of stateless JWT auth for now;
  revisit if/when a "deactivate champion" admin feature is added, since that would need
  the same mechanism.
- **Password complexity policy** for champions created by an admin. Product/UX decision,
  not a vulnerability — `CreateChampionDto` already enforces a length minimum.

## Local HTTPS via Caddy

Added `docker-compose.https.yml` + `Caddyfile`, modeled directly on
`~/Documentos/repos/threat-dragon-ai`'s Caddy setup (inspected before deciding to reuse
the pattern — a 3-line `Caddyfile` reverse-proxying to the app, Caddy handling TLS via its
own internal CA). This isn't a vulnerability fix; it's what makes finding 2's `Secure`
cookie flag and HSTS header actually testable locally, since the default
`docker-compose.yml` only ever serves plain HTTP. Kept as a fully separate, self-contained
compose file rather than an override of the base one, and wired a `TRUST_PROXY_HOPS` env
var (explicit hop count, never `app.set('trust proxy', true)`) so that if this ever moves
beyond local dev, rate limiting can't be bypassed by a spoofed `X-Forwarded-For` header —
exactly the misconfiguration threat-dragon-ai's own README flags about its `trust proxy`
setting.

## Consequences

- Any already-deployed instance must rotate its `JWT_SECRET` to 32+ characters before
  upgrading, or the app won't boot. This is intentional (see point 2 above).
- `style-src 'unsafe-inline'` remains in the CSP (it's helmet's own default, not something
  this ADR turned on) because of `apps/web`'s handful of runtime-computed inline
  `style={{width}}` progress bars. Removing it entirely would require per-request CSP
  nonces, which would mean no longer serving `apps/web/dist` as plain static assets — not
  worth it for this app's size today, but worth remembering if that changes.
- CI's `npm-audit` job is stricter now (moderate instead of high) but still scoped to
  production dependencies only — devDependency-only findings in build tooling are
  unaffected and won't start failing CI.
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/0004-security-hardening.md
git commit -m "docs: record ADR 0004 for the 2026-08-19 security hardening pass"
```

---

## Final verification (after all 7 tasks)

- [ ] Run `npm run typecheck`, `npm run lint`, `npm run test` (all workspaces) — expect
      no errors.
- [ ] Run `npm run test:e2e -w apps/api` — expect all tests passing, including the 2 new
      ones from Tasks 3 and 4.
- [ ] Run `npm audit --omit=dev --audit-level=moderate` — expect exit code 0. If it's
      non-zero, the NestJS 10 line has picked up a *new* moderate+ advisory since Task 5
      was written (the 6 CVEs tracked for the NestJS 11 upgrade in ADR 0004 were all
      accounted for at that time) — investigate before considering this plan done, don't
      just proceed.
- [ ] Run `docker compose up --build` — confirm the plain-HTTP flow still works exactly as
      before (login, cookie set, no `Secure` flag since `NODE_ENV` is unset there).
- [ ] Run `docker compose -f docker-compose.https.yml up --build` — confirm `https://localhost`
      serves the app, login sets a `Secure` cookie, `Strict-Transport-Security` header is
      present.
- [ ] Confirm `git log --oneline` on the branch shows 7 commits, one per task above.
- [ ] Manually re-attempt the two scenarios the original review used to confirm findings 1
      and 3 (11 rapid login attempts → 429; compare response latency for a real vs. a
      nonexistent email — should now be statistically indistinguishable) against the
      running `docker compose up --build` stack, not just the automated tests.
