# Security Code Review — ChampionForge (sec-champs-trail)

**Date:** 2026-08-19
**Scope:** Full application (`apps/api`, `apps/web`, `packages/owasp-content`, Docker/Compose, CI pipeline) — not limited to the pending diff, since there were no uncommitted code changes at review time.
**Method:** Manual source review of every auth/authorization path, DTO/validation layer, Prisma schema and query layer, cookie/session handling, CORS/headers config, Docker image, and `npm audit` against the installed dependency tree. Cross-checked against the existing CI security gates (Semgrep, CodeQL, TruffleHog, ZAP baseline, `npm audit --audit-level=high`) to avoid duplicating what those already catch, and to identify gaps in what they catch.

## Summary

The codebase is in good shape for a project of this size: every data-bearing controller is behind `JwtAuthGuard`, role checks (`RolesGuard`) and team-scoping (`TeamScopeGuard`) are applied consistently, there's no raw SQL anywhere (Prisma only, so no SQL injection surface), no `dangerouslySetInnerHTML`/`eval` on the frontend, the JWT lives in an `httpOnly` + `Secure` (prod) + `SameSite=Strict` cookie rather than `localStorage`, secrets aren't committed, and the CI pipeline already runs SAST/DAST/secret-scanning/dependency-audit on every PR. This is above average for a self-hosted internal tool.

That said, five findings survived verification — one High, three Medium, one Low/hygiene — plus a couple of hardening notes. None are "the app is trivially pwnable," but for a tool whose entire purpose is demonstrating security hygiene, several are the kind of finding a reviewer (or an auditor of your own program) would flag on sight.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | No rate limiting / brute-force protection on `POST /auth/login` | **High** | Confirmed |
| 2 | Missing HTTP security headers (no Helmet/CSP/HSTS/etc.) | **Medium** | Confirmed |
| 3 | Login has a timing side-channel that enables account/email enumeration | **Medium** | Confirmed |
| 4 | Production dependencies carry known moderate-severity CVEs the CI audit gate doesn't catch | **Medium** | Confirmed |
| 5 | `JWT_SECRET` minimum-length policy (16 chars) is weak for HS256 | **Low** | Confirmed |
| 6 | No server-side session/token revocation on logout | Informational | Confirmed (accepted trade-off, flagged for awareness) |
| 7 | Created-champion password policy has no complexity/breach check | Informational | Confirmed |

---

## Finding 1 — No rate limiting on authentication (High)

**Where:** `apps/api/src/auth/auth.controller.ts:14-29`, `apps/api/src/main.ts` (bootstrap), `apps/api/src/app.module.ts` (module list)

**What:** There is no `ThrottlerModule`, no `express-rate-limit`, and no other request-throttling mechanism anywhere in the API. `POST /api/auth/login` accepts unlimited attempts per IP/account, with no lockout, backoff, or CAPTCHA.

```ts
@Post("login")
@HttpCode(200)
async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const champion = await this.authService.validateCredentials(dto.email, dto.password);
  if (!champion) throw new UnauthorizedException("Invalid credentials");
  ...
}
```

**Why it's exploitable:** `validateCredentials` (`apps/api/src/auth/auth.service.ts:14-20`) is the only gate — a scripted client can send thousands of password guesses per minute against any known or guessed champion/admin email. bcrypt slows each attempt individually, but that's a weak substitute for rate limiting at scale, and it does nothing against credential-stuffing (reusing breached email/password pairs, which doesn't need many attempts per account).

**Verification:** Confirmed by reading `main.ts`, `app.module.ts`, and every `*.module.ts` — no throttling guard/middleware/dependency exists anywhere in `apps/api`. The DAST job in CI (ZAP baseline) does not perform active brute-force testing, so this would not currently be caught by the pipeline.

**Remediation:** Add `@nestjs/throttler` (or equivalent) globally, with a tighter limit specifically on `POST /auth/login` (e.g. 5–10 attempts / minute / IP, plus a per-account counter backed by Redis or Postgres if you want to survive multi-IP credential stuffing). Consider a short exponential lockout after repeated failures on the same account.

---

## Finding 2 — Missing HTTP security headers (Medium)

**Where:** `apps/api/src/main.ts:11-34`

**What:** `helmet` is not a dependency, and no security headers are set manually. The app ships without `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, or `Permissions-Policy`. Since the API and the SPA are served from the same origin/process (`app.useStaticAssets` + the SPA-fallback middleware right below it), this applies to both the HTML shell and every JSON response.

**Why it matters:** No `X-Frame-Options`/CSP `frame-ancestors` means the login page and authenticated app can be framed by another site (clickjacking). No HSTS means a user who ever reaches the app over plain HTTP (e.g. a typo, a stale bookmark, an on-path attacker) isn't forced to upgrade to HTTPS. No CSP removes a real defense-in-depth layer if an XSS is ever introduced later (React's default escaping is good, but it's not a substitute for CSP as a second layer — and third-party/future components can reintroduce `dangerouslySetInnerHTML`).

**Verification:** `grep -rn helmet` across `apps/api` returns nothing; `main.ts` has no manual header-setting middleware. ZAP baseline would normally flag several of these ("Missing Anti-clickjacking Header", "CSP Header Not Set", etc.) but only at Low/Medium risk, which is below the CI gate's High-only failure threshold (`.github/scripts/check-zap-severity.py` only fails on `riskcode >= 3`) — so this is very likely already sitting unaddressed in your ZAP artifacts today.

**Remediation:** Add `helmet()` as global middleware in `main.ts` (right after `app.use(cookieParser())`), with a CSP tuned to the SPA's actual asset origins (self only, given the single-origin deployment). Enable HSTS conditionally in production (it's already gated on `NODE_ENV=production` for the cookie's `Secure` flag, so the same signal can drive HSTS).

---

## Finding 3 — Login timing side-channel enables account enumeration (Medium)

**Where:** `apps/api/src/auth/auth.service.ts:14-20`

```ts
async validateCredentials(email: string, password: string): Promise<Champion | null> {
  const champion = await this.prisma.champion.findUnique({ where: { email } });
  if (!champion) return null;                                    // fast path

  const passwordMatches = await bcrypt.compare(password, champion.passwordHash); // slow path
  return passwordMatches ? champion : null;
}
```

**What:** When the email doesn't exist, the function returns immediately after a single indexed DB lookup. When the email *does* exist, it additionally runs `bcrypt.compare`, which is deliberately slow (with cost factor 10, tens of milliseconds). The controller's error response (`UnauthorizedException("Invalid credentials")`) is identical either way, but the **response latency** differs measurably and consistently between "no such account" and "wrong password" — a classic timing side-channel.

**Why it matters:** An attacker can distinguish valid from invalid emails by measuring response time, even though the error message itself is generic. For an app whose champion list maps to specific people/teams inside an organization, this leaks who has an account (and by extension, who's a security champion / admin), which is useful recon for a targeted phishing or credential-stuffing campaign — especially combined with Finding 1's lack of rate limiting.

**Verification:** Read the full code path; confirmed there's no dummy-hash comparison on the not-found branch. This is a real, well-known vulnerability class (CWE-208 / OWASP user-enumeration-via-response-timing), not a theoretical one — it's directly measurable with a handful of local requests.

**Remediation:** Always perform a bcrypt comparison of equal cost, even when the account doesn't exist — compare against a precomputed dummy hash so the two code paths take statistically indistinguishable time:

```ts
const champion = await this.prisma.champion.findUnique({ where: { email } });
const hash = champion?.passwordHash ?? DUMMY_HASH; // a hash of a random, unused password
const passwordMatches = await bcrypt.compare(password, hash);
return champion && passwordMatches ? champion : null;
```

---

## Finding 4 — Production dependencies have known moderate CVEs below the CI audit gate (Medium)

**Where:** `apps/api/package.json`, `apps/web/package.json`, CI gate at `.github/workflows/ci.yml` (`npm-audit` job: `npm audit --omit=dev --audit-level=high`)

**What:** Running `npm audit --omit=dev` against the current lockfile reports **9 moderate-severity** advisories in packages that ship in the production image / production bundle:

- `@nestjs/core`, `@nestjs/platform-express`, `express`, `body-parser`, `qs` — all pulled in by the pinned NestJS 10.4.x line; fixed only by the NestJS 11 major upgrade.
- `react-router` / `react-router-dom` — **"Open redirect via backslash in `<Link>`/`useNavigate`, leading to XSS"** (GHSA-jjmj-jmhj-qwj2 and related). This one is client-facing and worth prioritizing over the others.
- `file-type` — DoS via malformed input (infinite loop / zip-bomb-style decompression), pulled in transitively.

None of these are High/Critical, so the existing `npm audit --omit=dev --audit-level=high` CI gate passes cleanly and doesn't surface them — they're not currently visible in a failing check anywhere in the pipeline.

**Verification:** Ran `npm ci` then `npm audit --omit=dev --json` directly against this repo's lockfile; full output cross-checked against each advisory's GHSA page. (Note: `npm audit` without `--omit=dev` also reports 1 critical + 5 high, but all of those — `@nestjs/cli`, `glob`, `picomatch`, `tmp`, `vite`, `vitest` — are devDependencies/build tooling that never ship in the Docker runner stage, so they don't affect the running application; I'm not counting them as app-facing risk, just noting them for completeness.)

**Remediation:**
- Prioritize the `react-router`/`react-router-dom` upgrade (open-redirect-to-XSS, user-facing) — check if a non-major patch closes it, otherwise schedule the major bump.
- Track the NestJS 10 → 11 upgrade as a scheduled piece of work (it's a semver-major bump affecting `@nestjs/core`, `@nestjs/platform-express`, and transitively `express`/`body-parser`/`qs`) rather than leaving it open-ended.
- Consider lowering the CI gate to `--audit-level=moderate` (or adding a separate non-blocking moderate report you actually triage on a cadence) so this class of gap doesn't recur silently — a High-only gate on a security-focused product is a meaningfully weaker bar than the rest of your pipeline (Semgrep/CodeQL fail on High, ZAP fails on High, but "moderate CVE in a production HTTP framework" currently ships silently).

---

## Finding 5 — `JWT_SECRET` minimum length is weak for HS256 (Low)

**Where:** `apps/api/src/config/env.validation.ts:12-14`

```ts
if (env.JWT_SECRET!.length < 16) {
  throw new Error("JWT_SECRET must be at least 16 characters long");
}
```

**What:** 16 ASCII characters is 128 bits *only if every character is drawn from a high-entropy random source*; in practice this validation accepts low-entropy human-chosen strings like `"change-me-in-pro"` (16 chars) that are far weaker than 128 bits, and it's below the commonly recommended ≥32-byte (256-bit) minimum for HMAC-SHA256 signing keys used to protect session-equivalent tokens.

**Verification:** Confirmed this is the only validation applied to `JWT_SECRET` before it's handed to `JwtModule.register({ secret: process.env.JWT_SECRET, ... })` (`apps/api/src/auth/auth.module.ts:11-14`) and to `passport-jwt`'s `secretOrKey` (`apps/api/src/auth/jwt.strategy.ts:23`). No algorithm-confusion risk here — `jsonwebtoken` restricts to HMAC algorithms automatically when given a plain string key — so this is specifically about brute-forceability of a weak secret, not a structural JWT bug.

**Remediation:** Raise the minimum to 32 characters, and note in `.env.example` that it should be a randomly generated value (e.g. `openssl rand -base64 32`), not a memorable phrase.

---

## Informational notes (not independently "fix this now," but worth recording)

**6. No server-side token revocation.** `POST /auth/logout` (`auth.controller.ts:31-36`) only clears the cookie client-side; the JWT itself remains valid for the rest of its 8-hour lifetime if it were ever extracted and replayed elsewhere. This is an inherent trade-off of stateless JWT auth and is commonly accepted, but given there's also no champion-deactivation/role-change endpoint yet, there's currently no way to immediately cut off a compromised or offboarded account short of rotating `JWT_SECRET` (which invalidates every session). Worth keeping in mind as the champions/teams admin surface grows — e.g. before adding a "deactivate champion" feature, decide whether that needs to invalidate outstanding tokens too (short-lived access token + refresh token, or a lightweight revocation list).

**7. Password policy for created champions is minimal.** `CreateChampionDto` (`apps/api/src/champions/dto/create-champion.dto.ts`) only enforces `@MinLength(8)`, no complexity or breached-password check. Low priority since only admins can create champions (not self-serve signup), but worth a `zxcvbn`-style strength check if you want the tool's own onboarding to model the practices it's teaching.

---

## What's already solid (no action needed)

- Every controller except the intentionally-public `/api/health` and `/api/auth/login|logout` sits behind `JwtAuthGuard`; role-restricted routes additionally use `RolesGuard`/`@Roles("admin")`; team-scoped routes use `TeamScopeGuard` comparing `user.teamId` against the URL's `:teamId` — verified across all 8 controllers, no gaps found.
- No raw SQL anywhere (`$queryRaw`/`$executeRaw` — zero hits); all data access goes through Prisma's parameterized query builder, so SQL injection isn't a realistic concern here.
- JWT is stored in an `httpOnly`, `SameSite=Strict`, prod-only-`Secure` cookie — not `localStorage` — so it isn't reachable from JS even if an XSS were ever introduced, and `SameSite=Strict` already provides strong CSRF protection without a separate CSRF token.
- `ValidationPipe({ whitelist: true })` is applied globally and every DTO uses `class-validator` decorators — no mass-assignment path found.
- Password hashes are correctly excluded from every API response (`select`/relation shapes checked in `champions.service.ts` and `teams.service.ts`).
- No hardcoded secrets in source; `.env` is gitignored and not tracked; CI already runs TruffleHog, Semgrep, CodeQL, and a ZAP baseline scan on every PR — a stronger baseline than most projects this size have.
- `bootstrapAdmin` is a one-shot CLI script, not an HTTP endpoint, and refuses to run if an `Organization` already exists — no privilege-escalation path through it.

---

## Suggested next step

This document is written to be turned directly into a spec + implementation plan (e.g. via your `docs/superpowers/specs` / `docs/superpowers/plans` workflow). Suggested grouping for that plan:

1. **Auth hardening** (Findings 1 + 3 + 5): rate limiting, timing-safe login, stronger `JWT_SECRET` policy — these touch the same two files (`auth.controller.ts`, `auth.service.ts`, `env.validation.ts`) and are naturally one unit of work.
2. **Transport/response hardening** (Finding 2): add `helmet` with a CSP tuned to the single-origin deployment.
3. **Dependency hygiene** (Finding 4): react-router patch/upgrade first (user-facing), NestJS 11 migration tracked separately, and a decision on the CI audit-level threshold.
4. Informational items 6–7 as backlog notes, not blocking.
