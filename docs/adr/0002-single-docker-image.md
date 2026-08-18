# ADR 0002: Single Docker image (api + web in the same process)

- Status: Accepted
- Date: 2026-08-17
- Motivated by: setting up a CI/CD pipeline (lint, tests, security scans, Docker
  image build scanned by Trivy and published to GHCR). Building that pipeline
  required revisiting how `apps/api` and `apps/web` were packaged, which is
  what this ADR records, ahead of the pipeline itself being implemented.

## Context

Before this ADR, `apps/api` and `apps/web` each had their own `Dockerfile`,
both **development**-mode (`nest start --watch`/`vite dev`, no production
build), orchestrated by `docker-compose.yml` as two separate services (`api`
on port 3000, `web` on port 5173). No production Dockerfile existed in the
repository.

While planning the CI/CD pipeline (which needs to end in "build a Docker
image, scan it, publish it"), it became clear that adding a third
Dockerfile — a "production" one nobody would run locally — would reintroduce
exactly the kind of dev/prod drift this review was meant to avoid: the image
published to GHCR would never be the one tested via `docker compose up`.

## Decision — one image, served by the same process

`apps/web` is a SPA (static Vite build); `apps/api` is already an Express
server (via NestJS). Instead of two deployables, the api now serves the web
build as static assets from the same process/port, via `ServeStaticModule`.

**Options considered:**
- **Two images** (one per app), as before — allows independent scaling and a
  smaller blast radius (the frontend doesn't go down if the API has a bad
  deploy), but doubles the pipeline's surface (2 Dockerfiles, 2 Trivy scans, 2
  GHCR pushes) and is complexity this project — an internal tool for a small
  number of users, with no indication of scale that would justify it — doesn't
  need right now.
- **Single image**, api serving the web build via `ServeStaticModule`.

**Decision:** single image. `apps/api/src/app.module.ts` imports
`ServeStaticModule.forRoot({ rootPath: .../public, exclude: ["/api*"] })`;
`apps/api/src/main.ts` gained `app.setGlobalPrefix("api")`.

**Why the `/api` prefix is required, not optional:** routing by
specificity/registration order (the common pattern for serving a SPA from
Express) isn't enough here because **React Router routes and API routes
collide by name** — e.g. `TeamsController` already answered at `/teams`, and
the React Router `TeamsAdmin` page also lives at `/teams`. Without a prefix, a
browser GET (refresh/direct link) to `/teams` would be caught by
`TeamsController`, not by the SPA's `index.html`. All API routes were moved
under `/api/*` (main.ts, all 9 `*.e2e-spec.ts` files, and
`apps/web/src/lib/api.ts`).

## Consequences

**`docker-compose.yml` simplified to a single `app` service** (+ `postgres`),
built from the new root-level `Dockerfile` — the same image that goes to
GHCR. The old `apps/api/Dockerfile` and `apps/web/Dockerfile` (dev) were
removed; there is no longer a "production-only" Dockerfile that isn't tested
locally.

**Loss of hot-reload in `docker compose up`.** The old Dockerfiles ran
`vite dev`/`nest start --watch`. The single image runs the compiled build;
changing code requires rebuilding the image. The active development loop
remains `npm run start:dev -w apps/api` / `npm run dev -w apps/web` directly
on the host (the "Running without Docker" README section, unchanged) —
`docker compose up` now exists to answer "does this run the way it really
will?", not for fast iteration.

**`VITE_API_URL` built as a relative path (`/api`), not host:port.** Since
the api and web are now served from the same origin, the image is built with
`VITE_API_URL=/api` (a Dockerfile `ARG`, defaulted). This also simplifies the
frontend: `apps/web/src/lib/api.ts` no longer needs to know where the API is.
`.env.example`'s `VITE_API_URL=http://localhost:3000/api` still exists only
for `npm run dev -w apps/web` run outside Docker (port 5173 is a different
origin from the api's 3000, so it still needs the full URL).

**`packages/owasp-content` gained its own build step.** Its `package.json`
pointed `"main"` at raw `src/index.ts` — this worked because every consumer
until now (`ts-node`, `ts-jest`, Vitest) transpiled it on the fly. The
production image runs `node dist/prisma/seed.js` directly (no `ts-node`), and
that file imports `@sec-champs-trail/owasp-content`; plain Node `require()`
can't parse raw TypeScript. Attempting to work around this by switching the
image to a Node version with native type-stripping (22+) didn't work: the
file uses `__dirname` (CommonJS semantics) *and* `import`/`export` (ESM
semantics) at the same time — syntax meant to be rewritten by a transpiler,
not just have its type annotations stripped. The real fix was giving the
package an actual build (`tsconfig.build.json` with `module: commonjs`;
`packages/owasp-content` gained a `"build"` script; `"main"` now points to
`dist/index.js`). **Side effect:** `npm test`/`npm run typecheck` in
`apps/api` (and the CI pipeline, once it exists) now depend on
`packages/owasp-content` having been built first — the Dockerfile already
does this explicitly; local devs need to run
`npm run build -w packages/owasp-content` once (documented in the README).

**`prisma` (the CLI) moved from `devDependencies` to `dependencies`** in
`apps/api/package.json`. `prisma migrate deploy` runs at container boot (the
image's `CMD`); classifying it as dev-only would prevent the production
image (installed with `npm ci --omit=dev`) from running migrations.

**`NODE_ENV=production` is now fixed in the image** (neither dev Dockerfile
set this variable before). This turns on the `Secure` flag on the login
cookie (`apps/api/src/auth`), which is the correct behavior for the image
published to GHCR. Tested via `docker compose up` locally over
`http://localhost`: it works (modern browsers treat `localhost` as a secure
context even without HTTPS), but it's worth noting this differs from what the
dev Dockerfiles did before.

**The PRD's static-deploy option remains viable.** The PRD (section 5.1)
mentions "static deploy option (Vercel/Netlify) for a demo version" as an
alternative to self-hosting via Docker Compose. This decision doesn't affect
that: `apps/web` is still independently buildable
(`npm run build -w apps/web`), producing a static `dist/` that can be
published anywhere, pointing via `VITE_API_URL` (build-time) at an
API hosted separately. The single image changed the *default* way to
self-host — it didn't remove that alternative.

**No impact on roadmap Phases 1b/2/3.** F3/F5 (AI), F6 (quiz), F7 (community),
and F8 (multi-tenant) are ordinary NestJS-module/React-page work that falls
under the already-configured `/api` prefix automatically; F9 (SAMM/Threat
Dragon integration) is described in the PRD as a unified dashboard, which
suggests integrating via outbound link/API, not embedding another app in this
same container — if that changes in the future, this decision would need to
be revisited.

**Future consideration (not a blocker now):** F3/F5 call the Anthropic API,
potentially slowly. Today that would run in the same Node process serving
everything else — fine at this project's current scale (a handful of users),
since network calls don't block Node's event loop. If that ever needs a
background queue/worker (retries, more serious rate limiting), it would be an
**additional service** alongside the current image (one more service in
`docker-compose.yml`, one more build/scan stage in the CI/CD pipeline), not a
reversal of this decision — consolidating into a single image doesn't close
that door, it just describes today's topology.

## Notes

- The monorepo's `.nvmrc`/`engines.node` stay on Node 20; the Docker image is
  also `node:20-alpine` in every stage (the attempt to use Node 22 was
  reverted — see the `owasp-content` consequence above).
- Tested end to end via `docker compose up --build`: health check
  (`/api/health`), SPA fallback on routes that collided with the API
  (`/teams`), `/` (SPA) vs `/api/*` (JSON) separation, `bootstrap-admin` via
  `node dist/src/bootstrap/bootstrap-admin.js` (the compiled equivalent of the
  npm script, which depends on `ts-node` and doesn't exist in the production
  image), login, and cookie-based session.
