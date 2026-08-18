# Single production image: the compiled api serves the compiled web build as
# static assets from the same process/port (see docs/adr/0002-imagem-docker-unica.md).

FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/owasp-content/package.json packages/owasp-content/package.json
RUN npm ci

FROM deps AS web-build
WORKDIR /app
COPY apps/web apps/web
# Relative path: the api serves the web build from its own origin, so no host/port
# needs to be baked in. Overridable at build time if that ever stops being true.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w apps/web

FROM deps AS api-build
WORKDIR /app
COPY packages/owasp-content packages/owasp-content
COPY apps/api apps/api
# owasp-content's package.json "main" points at its compiled dist/ (not the raw
# src/*.ts it ships for its own Vitest suite and apps/api's ts-jest tests) --
# plain `node` (no ts-node/nest-cli, as used below and in the runner stage)
# cannot parse un-transpiled TypeScript, so it must be built before anything
# that `require()`s it at runtime.
RUN npm run build -w packages/owasp-content
RUN npm run db:generate -w apps/api
RUN npm run build -w apps/api

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/owasp-content/package.json packages/owasp-content/package.json
RUN npm ci --omit=dev
# npm's own bundled CLI (not our dependency tree -- see package.json's "overrides")
# vendors its own old tar/glob/minimatch/cross-spawn/etc with known HIGH/CRITICAL
# CVEs; Trivy flags them under /usr/local/lib/node_modules/npm/node_modules. It's
# only needed to run the `npm ci` above -- nothing at runtime invokes `npm`/`npx`
# (the CMD below calls the installed `prisma` binary directly instead of `npx prisma`).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Prisma's generated client + query engine (produced by `prisma generate` in the
# api-build stage; a plain prod `npm ci` does not regenerate it).
COPY --from=api-build /app/node_modules/.prisma node_modules/.prisma

COPY --from=api-build /app/apps/api/dist apps/api/dist
COPY --from=api-build /app/apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY --from=api-build /app/apps/api/prisma/migrations apps/api/prisma/migrations

# Compiled owasp-content (dist/) plus the curated JSON data it reads from disk,
# relative to its own directory, at runtime -- see the api-build stage comment.
COPY --from=api-build /app/packages/owasp-content/dist packages/owasp-content/dist
COPY --from=api-build /app/packages/owasp-content/principles packages/owasp-content/principles
COPY --from=api-build /app/packages/owasp-content/checklists packages/owasp-content/checklists
COPY --from=api-build /app/packages/owasp-content/maturity-levels packages/owasp-content/maturity-levels

# ServeStaticModule reads from apps/api/dist/public (join(__dirname, '..', 'public')
# resolved from the compiled apps/api/dist/src/app.module.js).
COPY --from=web-build /app/apps/web/dist apps/api/dist/public

RUN addgroup -g 1001 -S nodejs && adduser -S championforge -u 1001
USER championforge

WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "/app/node_modules/.bin/prisma migrate deploy && node dist/prisma/seed.js && node dist/src/main.js"]
