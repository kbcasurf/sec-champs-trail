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

## Decision — close 4 of 5 findings, mitigate and track the 5th

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
5. **Outdated `react-router`/`react-router-dom`** (open redirect → XSS advisory): version
   bumped to `^6.30.6` (same major, no behavior change) as a general hygiene update, but
   this does NOT close the underlying advisory — `npm audit` confirms the vulnerable range
   is `react-router 6.0.0 - 7.17.0` (GHSA-wrjc-x8rr-h8h6, a bypass of an earlier CVE fix,
   and GHSA-337j-9hxr-rhxg), and the only real fix is `react-router@8.3.0`, which requires
   React 19.2.7+ — a major, breaking upgrade this app's React 18.3.0 doesn't support, and
   out of scope for this hardening pass. The CI `npm-audit` job's gate was left at
   `--audit-level=high` (not lowered to `--audit-level=moderate` as originally planned) —
   lowering it now would make CI permanently red without actually closing the gap. Tracked
   as backlog below, alongside the NestJS 11 upgrade.

**Explicitly not done here — tracked as follow-up:**

- **NestJS 10 → 11 upgrade.** This is the only fix for the remaining moderate CVEs in
  `@nestjs/core`, `@nestjs/platform-express`, and transitively `express`/`body-parser`/
  `qs`/`file-type`. It's a semver-major bump with its own breaking-change surface and
  deserves its own spec/plan rather than riding along with an auth/headers hardening pass.
- **`react-router` 6 → 8 (and the React 18 → 19 bump it requires).** The real fix for
  finding 4's react-router advisory — `npm audit` still flags `6.0.0 - 7.17.0` as
  vulnerable even after the `^6.30.6` hygiene bump above. Bundled with the NestJS 11
  upgrade as future work rather than done here: both are major, breaking version bumps
  that deserve their own spec/plan rather than riding along with this pass.
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
- CI's `npm-audit` job is unchanged (`--audit-level=high`, scoped to production
  dependencies only) — it was not lowered to `moderate` as originally planned, because the
  react-router advisory it would have been lowered to catch isn't actually closed by the
  `^6.30.6` bump. The gap stays open and tracked as backlog above rather than being papered
  over with a weaker CI gate.
