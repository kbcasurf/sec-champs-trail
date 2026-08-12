# Fase 0 (Fundação) Implementation Plan

> **Status: Executado.** Todas as 13 tarefas foram implementadas via
> subagent-driven-development, revisadas individualmente (com rounds de fix
> onde necessário) e passaram por uma revisão final de branch inteira antes
> do merge em `main` (2026-08-12). Os checkboxes abaixo foram marcados
> retroativamente para refletir esse estado. Para o histórico completo de
> execução (achados de revisão, rounds de fix, decisões) ver
> `docs/superpowers/plans/2026-08-10-fase0-fundacao-execution-log.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the ChampionForge monorepo foundation — tooling, curated OWASP content, full Prisma data model, JWT auth, Docker Compose — with no product UI/endpoints yet, so Fase 1a can build directly on top of it.

**Architecture:** npm-workspaces monorepo with three members: `apps/api` (NestJS + Prisma + Postgres), `apps/web` (React + Vite + Tailwind), and `packages/owasp-content` (pure curated JSON data, no runtime logic). `apps/api` seeds `Principle`/`ChecklistItem` tables from `packages/owasp-content` on migration. Everything else in the Prisma schema (assessments, action plans, training, reports) is modeled now but has no endpoints until later phases.

**Tech Stack:** Node.js ≥20, TypeScript everywhere, npm workspaces, NestJS, Prisma + PostgreSQL, Passport JWT + bcrypt, React + Vite + Tailwind CSS, Jest (`apps/api`), Vitest (`apps/web` and `packages/owasp-content`), Docker Compose, GitHub Actions.

## Global Constraints

- Node.js `>=20` (repo has v24.4.1 installed; set `"engines": {"node": ">=20"}` in every `package.json`).
- Package manager: npm only (no pnpm/yarn) — per ADR 0001, Decision 9.
- ORM: Prisma only (no TypeORM) — ADR 0001, Decision 9.
- Backend framework: NestJS only — ADR 0001, Decision 4.
- Auth: JWT local only, no OIDC/SSO in this phase — ADR 0001, Decision 5.
- Exactly one `Organization` row per instance; no public "create organization" route — ADR 0001, Decision 3; spec section 7.
- `packages/owasp-content` is pure data (JSON + typed loader), no business logic — spec section 5.
- Every curated content item (`Principle`, `ChecklistItem`) must carry `sourceUrl` and `license: "CC BY-SA 4.0"` — PRD section 1.5.
- No scraping at runtime or build time — ADR 0001, Decision 1. Content is fetched and transcribed once, by hand, during Task 3/4 below, then committed as static JSON.
- Prisma schema must include all entities from spec section 6 (including Fase 1a/1b tables) even though most have no endpoints yet — spec section 6, acceptance criterion in section 9.
- Every task must leave its own tests green. No task commits with a failing test as its final state — where a later task supplies real content that an earlier task's tests will eventually also check, the earlier task tests against fixture data instead, and the later task swaps the fixture for real content while adding its own additional assertions (see Tasks 2/3/4).

---

## File Structure

```
sec-champs-trail/
├── package.json                        # root workspaces
├── .gitignore
├── .env.example
├── docker-compose.yml
├── ATTRIBUTION.md
├── .github/workflows/ci.yml
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json / tsconfig.build.json
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── config/env.validation.ts
│   │   │   ├── prisma/prisma.module.ts
│   │   │   ├── prisma/prisma.service.ts
│   │   │   ├── auth/auth.module.ts
│   │   │   ├── auth/auth.service.ts
│   │   │   ├── auth/auth.controller.ts
│   │   │   ├── auth/jwt.strategy.ts
│   │   │   ├── auth/dto/login.dto.ts
│   │   │   └── bootstrap/bootstrap-admin.ts
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/seed.ts
│   │   └── test/ (Jest unit + e2e)
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.js / postcss.config.js
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           └── pages/Login.tsx (+ Login.test.tsx)
└── packages/
    └── owasp-content/
        ├── package.json
        ├── src/types.ts
        ├── src/index.ts
        ├── principles/*.json (fixtures in Task 2, replaced by 10 real files in Task 3)
        ├── checklists/*.json (fixture in Task 2, replaced by real recruitment/development-retention files in Task 4)
        └── test/schema.test.ts
```

- `packages/owasp-content` has zero dependencies beyond its own type definitions — it is loaded by `apps/api`'s seed script via a normal workspace import (`@sec-champs-trail/owasp-content`).
- `apps/api/src/config/env.validation.ts` is the single place that knows which env vars are required; `main.ts` calls it before the Nest app boots. It is implemented fully in Task 6, alongside the rest of the app scaffold — there is no intermediate stub.
- `apps/api/src/bootstrap/bootstrap-admin.ts` is a standalone script (run via `npm run bootstrap:admin -w apps/api`), not an HTTP endpoint — this is what keeps "no public create-organization route" true.

---

### Task 1: Root monorepo scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.nvmrc`

**Interfaces:**
- Produces: npm workspaces `apps/*` and `packages/*`, so every later task can run `npm install` once at the root and `npm run <script> -w <workspace-name>` per package.

- [x] **Step 1: Create the root `package.json`**

```json
{
  "name": "sec-champs-trail",
  "private": true,
  "version": "0.0.0",
  "engines": { "node": ">=20" },
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "lint": "npm run lint --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [x] **Step 2: Create `.nvmrc`**

```
20
```

- [x] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
build/
.env
*.log
coverage/
.DS_Store
apps/web/vite.config.ts.timestamp-*
```

- [x] **Step 4: Create `.env.example`** (placeholder skeleton — real keys are added incrementally in later tasks as each part of the stack needs them; start with the two every workspace will need)

```
# Postgres (apps/api)
DATABASE_URL=postgresql://champion:champion@localhost:5432/championforge

# Auth (apps/api)
JWT_SECRET=change-me-in-production
```

- [x] **Step 5: Verify workspaces resolve**

Run: `mkdir -p apps/api apps/web packages/owasp-content && npm install`
Expected: `npm install` completes without error (no workspace has a `package.json` yet, so npm just creates `node_modules/` and `package-lock.json` for the root). If npm errors because a workspace folder has no `package.json`, remove the empty dirs — Task 2/6/11 will recreate them with real content.

- [x] **Step 6: Commit**

```bash
git add package.json .nvmrc .gitignore .env.example
git commit -m "Scaffold npm workspaces monorepo"
```

---

### Task 2: `packages/owasp-content` — types, loader, and schema validation harness (fixture data)

**Files:**
- Create: `packages/owasp-content/package.json`
- Create: `packages/owasp-content/tsconfig.json`
- Create: `packages/owasp-content/src/types.ts`
- Create: `packages/owasp-content/src/index.ts`
- Create: `packages/owasp-content/principles/00-fixture-a.json`
- Create: `packages/owasp-content/principles/00-fixture-b.json`
- Create: `packages/owasp-content/checklists/00-fixture.json`
- Test: `packages/owasp-content/test/schema.test.ts`

**Interfaces:**
- Produces: `Principle` type (`id`, `order`, `title`, `description`, `sourceUrl`, `license`), `ChecklistItem` type (`id`, `principleId`, `phase: "recruitment" | "development-retention"`, `title`, `description`, `sourceUrl`, `license`), and `loadPrinciples(): Principle[]` / `loadChecklistItems(): ChecklistItem[]` — these two functions are what `apps/api`'s seed script (Task 8) imports. This task ships with 2 fixture principles and 1 fixture checklist item so the deliverable is fully green on its own; Task 3 deletes the fixture principles and replaces them with the 10 real curated ones, Task 4 deletes the fixture checklist item and replaces it with the real recruitment/development-retention content.
- Consumes: nothing (leaf package).

- [x] **Step 1: Create `packages/owasp-content/package.json`**

```json
{
  "name": "@sec-champs-trail/owasp-content",
  "private": true,
  "version": "0.0.0",
  "engines": { "node": ">=20" },
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [x] **Step 2: Create `packages/owasp-content/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

- [x] **Step 3: Create `packages/owasp-content/src/types.ts`**

```typescript
export type ChecklistPhase = "recruitment" | "development-retention";

export interface Principle {
  id: string;
  order: number;
  title: string;
  description: string;
  sourceUrl: string;
  license: "CC BY-SA 4.0";
}

export interface ChecklistItem {
  id: string;
  principleId: string;
  phase: ChecklistPhase;
  title: string;
  description: string;
  sourceUrl: string;
  license: "CC BY-SA 4.0";
}
```

- [x] **Step 4: Write the failing test for the loader mechanics (fixture-scoped, not content-scoped)**

```typescript
// packages/owasp-content/test/schema.test.ts
import { describe, expect, it } from "vitest";
import { loadPrinciples, loadChecklistItems } from "../src/index";
import type { ChecklistPhase } from "../src/types";

const VALID_PHASES: ChecklistPhase[] = ["recruitment", "development-retention"];

describe("owasp-content loader mechanics", () => {
  it("loads principles sorted by their order field, each with attribution fields", () => {
    const principles = loadPrinciples();
    expect(principles.length).toBeGreaterThanOrEqual(1);

    const orders = principles.map((p) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));

    for (const p of principles) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.sourceUrl).toMatch(/^https:\/\/securitychampions\.owasp\.org\//);
      expect(p.license).toBe("CC BY-SA 4.0");
    }
  });

  it("loads checklist items that each reference a real principle and a valid phase", () => {
    const principles = loadPrinciples();
    const principleIds = new Set(principles.map((p) => p.id));
    const items = loadChecklistItems();

    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(principleIds.has(item.principleId)).toBe(true);
      expect(VALID_PHASES).toContain(item.phase);
      expect(item.sourceUrl).toMatch(/^https:\/\/securitychampions\.owasp\.org\//);
      expect(item.license).toBe("CC BY-SA 4.0");
    }
  });
});
```

- [x] **Step 5: Run the test to verify it fails**

Run: `npm install -w packages/owasp-content && npx vitest run --root packages/owasp-content`
Expected: FAIL — `../src/index` has no exported member `loadPrinciples` (module doesn't exist yet).

- [x] **Step 6: Implement the loader**

```typescript
// packages/owasp-content/src/index.ts
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ChecklistItem, Principle } from "./types";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRINCIPLES_DIR = join(HERE, "..", "principles");
const CHECKLISTS_DIR = join(HERE, "..", "checklists");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function loadPrinciples(): Principle[] {
  return readdirSync(PRINCIPLES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<Principle>(join(PRINCIPLES_DIR, f)))
    .sort((a, b) => a.order - b.order);
}

export function loadChecklistItems(): ChecklistItem[] {
  return readdirSync(CHECKLISTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => readJson<ChecklistItem[]>(join(CHECKLISTS_DIR, f)));
}

export type { ChecklistItem, ChecklistPhase, Principle } from "./types";
```

- [x] **Step 7: Add fixture content so the loader has real files to read**

```json
// packages/owasp-content/principles/00-fixture-a.json
{
  "id": "fixture-principle-a",
  "order": 1,
  "title": "Fixture Principle A",
  "description": "Placeholder principle used only to exercise the loader in Task 2. Replaced by real curated content in Task 3.",
  "sourceUrl": "https://securitychampions.owasp.org/manifesto/",
  "license": "CC BY-SA 4.0"
}
```

```json
// packages/owasp-content/principles/00-fixture-b.json
{
  "id": "fixture-principle-b",
  "order": 2,
  "title": "Fixture Principle B",
  "description": "Placeholder principle used only to exercise the loader in Task 2. Replaced by real curated content in Task 3.",
  "sourceUrl": "https://securitychampions.owasp.org/manifesto/",
  "license": "CC BY-SA 4.0"
}
```

```json
// packages/owasp-content/checklists/00-fixture.json
[
  {
    "id": "fixture-checklist-item",
    "principleId": "fixture-principle-a",
    "phase": "recruitment",
    "title": "Fixture checklist item",
    "description": "Placeholder checklist item used only to exercise the loader in Task 2. Replaced by real curated content in Task 4.",
    "sourceUrl": "https://securitychampions.owasp.org/manifesto/",
    "license": "CC BY-SA 4.0"
  }
]
```

- [x] **Step 8: Run the test to verify it passes**

Run: `npx vitest run --root packages/owasp-content`
Expected: PASS (both tests, against fixture data).

- [x] **Step 9: Commit**

```bash
git add packages/owasp-content
git commit -m "Add owasp-content package: types, loader, schema test harness (fixture data)"
```

---

### Task 3: Curate the 10 OWASP Security Champions Manifesto principles

**Files:**
- Create: `packages/owasp-content/principles/01-be-passionate-about-security.json` … `10-anticipate-personnel-changes.json` (10 files)
- Delete: `packages/owasp-content/principles/00-fixture-a.json`, `packages/owasp-content/principles/00-fixture-b.json`
- Modify: `packages/owasp-content/checklists/00-fixture.json` (repoint `principleId` at a real curated principle instead of the deleted fixture — see Step 3)
- Modify: `packages/owasp-content/test/schema.test.ts` (add a content-completeness assertion)

**Interfaces:**
- Consumes: `Principle` type from Task 2 (`src/types.ts`).
- Produces: the 10 JSON files that this task's added test assertion checks, and that Task 8's seed script reads via `loadPrinciples()`.

This is manual curation, not code generation — ADR 0001 Decision 1 and spec section 5 are explicit that transcription must be done by a human/agent reading the real page, not fabricated. Do not invent description text.

- [x] **Step 1: Fetch the real manifesto index and record the exact link for each of the 10 principles**

Run WebFetch on `https://securitychampions.owasp.org/manifesto/` asking for every hyperlink on the page as `[text](href)` pairs. The 10 principle titles are confirmed to be (in this order): "Be passionate about security", "Start with a clear vision for your program", "Secure management support", "Nominate a dedicated captain", "Trust your champions", "Create a community", "Promote knowledge sharing", "Reward responsibility", "Invest in your champions", "Anticipate personnel changes". Use the fetch to get their **real** URLs — do not guess URL paths (earlier attempts at guessed paths like `/manifesto/1-be-passionate-about-security/` returned 404).

- [x] **Step 2: Fetch each of the 10 linked pages and transcribe verbatim**

For each principle, WebFetch its real URL from Step 1 asking for the full title and description text verbatim (not summarized/paraphrased). Write one JSON file per principle:

```json
{
  "id": "be-passionate-about-security",
  "order": 1,
  "title": "Be passionate about security",
  "description": "<verbatim text from the fetched page>",
  "sourceUrl": "<exact URL fetched in Step 1>",
  "license": "CC BY-SA 4.0"
}
```

Repeat for all 10, with `id` as a stable kebab-case slug of the title and `order` 1 through 10 matching the manifesto's own ordering. File names: `01-be-passionate-about-security.json` through `10-anticipate-personnel-changes.json` (zero-padded order prefix keeps directory listing sorted, though `loadPrinciples()` sorts by the `order` field regardless of filename).

- [x] **Step 3: Remove the fixture principles and repoint the fixture checklist item**

```bash
rm packages/owasp-content/principles/00-fixture-a.json packages/owasp-content/principles/00-fixture-b.json
```

`packages/owasp-content/checklists/00-fixture.json` (from Task 2) has `"principleId": "fixture-principle-a"`, which no longer exists. Edit that field to point at the real `id` of principle #1 (`"be-passionate-about-security"`) so Task 2's checklist test keeps passing until Task 4 replaces this fixture file for real:

```json
[
  {
    "id": "fixture-checklist-item",
    "principleId": "be-passionate-about-security",
    "phase": "recruitment",
    "title": "Fixture checklist item",
    "description": "Placeholder checklist item used only to exercise the loader in Task 2. Replaced by real curated content in Task 4.",
    "sourceUrl": "https://securitychampions.owasp.org/manifesto/",
    "license": "CC BY-SA 4.0"
  }
]
```

- [x] **Step 4: Add the content-completeness assertion to the schema test**

```typescript
// packages/owasp-content/test/schema.test.ts — add this additional test
it("has exactly 10 curated principles, ordered 1-10", () => {
  const principles = loadPrinciples();
  expect(principles).toHaveLength(10);
  expect(principles.map((p) => p.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
```

- [x] **Step 5: Run the full schema test suite**

Run: `npx vitest run --root packages/owasp-content`
Expected: PASS (all three tests — the two loader-mechanics tests from Task 2 still pass against real+fixture data, plus the new count assertion).

- [x] **Step 6: Commit**

```bash
git add packages/owasp-content/principles packages/owasp-content/checklists/00-fixture.json packages/owasp-content/test/schema.test.ts
git commit -m "Curate OWASP Security Champions Manifesto (10 principles)"
```

---

### Task 4: Curate OWASP checklists (recruitment + development-retention phases)

**Files:**
- Create: `packages/owasp-content/checklists/recruitment.json`
- Create: `packages/owasp-content/checklists/development-retention.json`
- Delete: `packages/owasp-content/checklists/00-fixture.json`
- Modify: `packages/owasp-content/test/schema.test.ts` (add phase-coverage assertion)

**Interfaces:**
- Consumes: `ChecklistItem` type from Task 2; the 10 `principleId` slugs curated in Task 3 (each item must reference one of them).
- Produces: the two real files this task's added test assertion checks, consumed by Task 8's seed script.

- [x] **Step 1: Look for a structured checklist on the live site**

WebFetch `https://securitychampions.owasp.org/` asking for the full site navigation with real hrefs (not guessed), specifically any "Guide", "Artifacts", or phase-based (attraction/recruitment vs. development/retention) pages. Follow any such link found and check whether it contains a literal checklist (numbered/bulleted actionable items), transcribing exact text if so.

- [x] **Step 2: If no dedicated checklist page exists, derive items from each principle's own actionable guidance**

If Step 1 turns up no standalone checklist page (this was the case in earlier exploration of this site), fall back to: re-read each of the 10 principle pages already fetched in Task 3, and for every concrete action/recommendation the text makes (e.g. "get executive sponsorship", "set measurable goals", "run regular knowledge-sharing sessions"), write one `ChecklistItem` referencing that principle's `id`, classified into whichever phase it fits:
  - `recruitment`: actions about attracting/selecting/onboarding champions (e.g. principles 2, 3, 4 tend to map here).
  - `development-retention`: actions about growing, rewarding, and keeping champions engaged (e.g. principles 5–10 tend to map here).

Each item's `sourceUrl` in this fallback is the principle page it was derived from (the literal source of the guidance), and its `description` should state the concrete action, not just restate the principle title.

```json
{
  "id": "secure-executive-sponsorship",
  "principleId": "secure-management-support",
  "phase": "recruitment",
  "title": "Secure executive sponsorship before recruiting champions",
  "description": "<action derived from the 'Secure management support' principle page, in your own words describing the concrete step, citing the source>",
  "sourceUrl": "<the principle's page URL from Task 3>",
  "license": "CC BY-SA 4.0"
}
```

Produce a reasonable number of items per phase (aim for at least 3-5 per phase to be useful for Fase 1a's checklist library) across `recruitment.json` and `development-retention.json`, each file being a JSON array of `ChecklistItem` objects.

- [x] **Step 3: Remove the fixture checklist file**

```bash
rm packages/owasp-content/checklists/00-fixture.json
```

- [x] **Step 4: Add the phase-coverage assertion to the schema test**

```typescript
// packages/owasp-content/test/schema.test.ts — add this additional test
it("has at least one checklist item per phase", () => {
  const items = loadChecklistItems();
  expect(items.some((i) => i.phase === "recruitment")).toBe(true);
  expect(items.some((i) => i.phase === "development-retention")).toBe(true);
});
```

- [x] **Step 5: Run the full schema test suite**

Run: `npx vitest run --root packages/owasp-content`
Expected: PASS (all four tests).

- [x] **Step 6: Commit**

```bash
git add packages/owasp-content/checklists packages/owasp-content/test/schema.test.ts
git commit -m "Curate OWASP checklists for recruitment and development-retention phases"
```

---

### Task 5: `ATTRIBUTION.md`

**Files:**
- Create: `ATTRIBUTION.md`

**Interfaces:** none (standalone doc).

- [x] **Step 1: Write the attribution file**

```markdown
# Attribution

This project's Security Champions content (the 10-principle Manifesto and the
recruitment / development-retention checklists in `packages/owasp-content`) is
sourced and adapted from the **OWASP Security Champions Guide**:

- https://securitychampions.owasp.org/
- Manifesto: https://securitychampions.owasp.org/manifesto/

Licensed under **Creative Commons Attribution-ShareAlike 4.0 International
(CC BY-SA 4.0)**: https://creativecommons.org/licenses/by-sa/4.0/

Every curated item in `packages/owasp-content` carries its own `sourceUrl` and
`license` field pointing back to the exact page it was transcribed or derived
from. Content generated or adapted by AI features in later phases (e.g.
AI-generated training tracks or executive reports) is treated as a derivative
of this material and is labeled as "AI-generated/adapted" wherever it is
shown to end users, to keep it distinguishable from the original OWASP text.

This project's own code is licensed separately — see `LICENSE`.
```

- [x] **Step 2: Commit**

```bash
git add ATTRIBUTION.md
git commit -m "Add ATTRIBUTION.md for OWASP Security Champions Guide content"
```

---

### Task 6: `apps/api` — NestJS scaffold with a health endpoint and fail-fast environment validation

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/app.controller.ts`
- Create: `apps/api/src/config/env.validation.ts`
- Test: `apps/api/src/config/env.validation.spec.ts`
- Test: `apps/api/test/app.e2e-spec.ts`

**Interfaces:**
- Produces: a bootable Nest app on `PORT` (default 3000) with `GET /health` returning `{ "status": "ok" }`, and `validateEnv(env: NodeJS.ProcessEnv): void` (throws on missing `DATABASE_URL`/`JWT_SECRET`, or a `JWT_SECRET` shorter than 16 characters) — `main.ts` calls `validateEnv` before the app boots. Later tasks add modules to `app.module.ts`'s `imports` array without touching this task's files, and add required env vars to the same validation function.

- [x] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@sec-champs-trail/api",
  "private": true,
  "version": "0.0.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "typecheck": "tsc --noEmit -p tsconfig.build.json",
    "lint": "eslint \"src/**/*.ts\"",
    "test": "jest",
    "test:e2e": "jest --config test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/testing": "^10.4.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.0",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.0",
    "typescript": "^5.6.0"
  }
}
```

- [x] **Step 2: Create `apps/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

- [x] **Step 3: Create `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "declaration": false,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "baseUrl": "./"
  }
}
```

- [x] **Step 4: Create `apps/api/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

- [x] **Step 5: Write the failing unit test for `validateEnv`**

```typescript
// apps/api/src/config/env.validation.spec.ts
import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
  const validEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    JWT_SECRET: "a-secret-that-is-long-enough",
  };

  it("does not throw when all required vars are present and valid", () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("throws when JWT_SECRET is missing", () => {
    const { JWT_SECRET, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow(/JWT_SECRET/);
  });

  it("throws when JWT_SECRET is shorter than 16 characters", () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });
});
```

- [x] **Step 6: Run the test to verify it fails**

Run: `npm install -w apps/api && npm run test -w apps/api -- env.validation`
Expected: FAIL — `./env.validation` doesn't exist.

- [x] **Step 7: Implement `validateEnv`**

```typescript
// apps/api/src/config/env.validation.ts
export function validateEnv(env: NodeJS.ProcessEnv): void {
  const missing: string[] = [];

  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.JWT_SECRET) missing.push("JWT_SECRET");

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  if (env.JWT_SECRET!.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters long");
  }
}
```

- [x] **Step 8: Run the test to verify it passes**

Run: `npm run test -w apps/api -- env.validation`
Expected: PASS.

- [x] **Step 9: Write the failing e2e test for the health endpoint**

```typescript
// apps/api/test/app.e2e-spec.ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns ok status", () => {
    return request(app.getHttpServer())
      .get("/health")
      .expect(200)
      .expect({ status: "ok" });
  });
});
```

- [x] **Step 10: Create `apps/api/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

- [x] **Step 11: Run the e2e test to verify it fails**

Run: `npm run test:e2e -w apps/api`
Expected: FAIL — cannot find module `../src/app.module` (doesn't exist yet).

- [x] **Step 12: Implement `app.controller.ts`, `app.module.ts`, `main.ts`**

```typescript
// apps/api/src/app.controller.ts
import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("health")
  health(): { status: string } {
    return { status: "ok" };
  }
}
```

```typescript
// apps/api/src/app.module.ts
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";

@Module({
  imports: [],
  controllers: [AppController],
})
export class AppModule {}
```

```typescript
// apps/api/src/main.ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { validateEnv } from "./config/env.validation";

async function bootstrap() {
  validateEnv(process.env);
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

Note: the e2e test in Step 9 builds `AppModule` directly through Nest's testing module and never calls `main.ts`'s `bootstrap()`, so it does not require `DATABASE_URL`/`JWT_SECRET` to be set — `validateEnv` only runs on real process boot.

- [x] **Step 13: Run the e2e test to verify it passes**

Run: `npm run test:e2e -w apps/api`
Expected: PASS.

- [x] **Step 14: Commit**

```bash
git add apps/api/package.json apps/api/nest-cli.json apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/src apps/api/test
git commit -m "Scaffold NestJS API with health endpoint and fail-fast env validation"
```

---

### Task 7: `apps/api` — Prisma schema (full data model) and initial migration

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Modify: `apps/api/package.json` (add `prisma` + `@prisma/client` deps and `db:migrate`/`db:generate` scripts)

**Interfaces:**
- Produces: Prisma Client types (`Organization`, `Team`, `Champion`, `Principle`, `ChecklistItem`, `MaturityAssessment`, `PrincipleScore`, `ActionPlan`, `ActionItem`, `TrainingTrack`, `TrainingModule`, `ExecutiveReport`) and an injectable `PrismaService` — Task 8 (seed), Task 9 (auth), Task 10 (bootstrap) all inject `PrismaService`.

This task has no unit test in the traditional sense — its "test" is the migration actually running against a real Postgres and Prisma Client generating without error.

- [x] **Step 1: Add Prisma dependencies**

```json
// apps/api/package.json — add to "dependencies"
"@prisma/client": "^5.20.0"
// add to "devDependencies"
"prisma": "^5.20.0"
// add to "scripts"
"db:generate": "prisma generate",
"db:migrate": "prisma migrate dev",
"db:migrate:deploy": "prisma migrate deploy",
"db:seed": "ts-node prisma/seed.ts"
```

Also add `"ts-node": "^10.9.0"` to devDependencies (needed by `db:seed`), and this Prisma block anywhere in the file:

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

- [x] **Step 2: Write `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ChampionRole {
  admin
  champion
}

enum ChecklistPhase {
  recruitment
  development_retention
}

enum ActionItemStatus {
  pending
  in_progress
  done
}

model Organization {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())

  teams            Team[]
  actionPlans      ActionPlan[]
  executiveReports ExecutiveReport[]
}

model Team {
  id             String   @id @default(uuid())
  name           String
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdAt      DateTime @default(now())

  champions          Champion[]
  maturityAssessments MaturityAssessment[]
  trainingTracks      TrainingTrack[]
}

model Champion {
  id           String       @id @default(uuid())
  email        String       @unique
  passwordHash String
  role         ChampionRole @default(champion)
  teamId       String?
  team         Team?        @relation(fields: [teamId], references: [id])
  createdAt    DateTime     @default(now())
}

model Principle {
  id          String   @id
  order       Int      @unique
  title       String
  description String
  sourceUrl   String
  license     String

  checklistItems  ChecklistItem[]
  principleScores PrincipleScore[]
}

model ChecklistItem {
  id          String         @id
  principleId String
  principle   Principle      @relation(fields: [principleId], references: [id])
  phase       ChecklistPhase
  title       String
  description String
  sourceUrl   String
  license     String

  actionItems ActionItem[]
}

model MaturityAssessment {
  id        String   @id @default(uuid())
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id])
  createdAt DateTime @default(now())

  principleScores PrincipleScore[]
}

model PrincipleScore {
  id           String             @id @default(uuid())
  assessmentId String
  assessment   MaturityAssessment @relation(fields: [assessmentId], references: [id])
  principleId  String
  principle    Principle          @relation(fields: [principleId], references: [id])
  score        Int

  @@unique([assessmentId, principleId])
}

model ActionPlan {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdAt      DateTime     @default(now())

  actionItems ActionItem[]
}

model ActionItem {
  id              String            @id @default(uuid())
  actionPlanId    String
  actionPlan      ActionPlan        @relation(fields: [actionPlanId], references: [id])
  checklistItemId String
  checklistItem   ChecklistItem     @relation(fields: [checklistItemId], references: [id])
  status          ActionItemStatus  @default(pending)
}

model TrainingTrack {
  id        String   @id @default(uuid())
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id])
  createdAt DateTime @default(now())

  modules TrainingModule[]
}

model TrainingModule {
  id              String        @id @default(uuid())
  trainingTrackId String
  trainingTrack   TrainingTrack @relation(fields: [trainingTrackId], references: [id])
  order           Int
  title           String
  content         String
}

model ExecutiveReport {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdAt      DateTime     @default(now())
  content        String
}
```

- [x] **Step 3: Implement `PrismaService` and `PrismaModule`**

```typescript
// apps/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```typescript
// apps/api/src/prisma/prisma.module.ts
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [x] **Step 4: Register `PrismaModule` in `app.module.ts`**

```typescript
// apps/api/src/app.module.ts
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
})
export class AppModule {}
```

- [x] **Step 5: Start Postgres locally and run the migration**

Run: `docker run -d --name championforge-db -e POSTGRES_USER=champion -e POSTGRES_PASSWORD=champion -e POSTGRES_DB=championforge -p 5432:5432 postgres:16-alpine`
Run: `npm install -w apps/api`
Run: `DATABASE_URL=postgresql://champion:champion@localhost:5432/championforge npm run db:migrate -w apps/api -- --name init`
Expected: migration succeeds, creates all tables listed in Step 2, `apps/api/prisma/migrations/<timestamp>_init/` is generated.

- [x] **Step 6: Verify Prisma Client generates and the e2e test from Task 6 still passes**

Run: `npm run db:generate -w apps/api && DATABASE_URL=postgresql://champion:champion@localhost:5432/championforge npm run test:e2e -w apps/api`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/prisma apps/api/src/prisma apps/api/src/app.module.ts
git commit -m "Add full Prisma data model and initial migration"
```

---

### Task 8: `apps/api` — seed script populating Principle/ChecklistItem from owasp-content

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json` (workspace dependency on `@sec-champs-trail/owasp-content`)
- Test: `apps/api/prisma/seed.spec.ts`

**Interfaces:**
- Consumes: `loadPrinciples()`, `loadChecklistItems()` from `@sec-champs-trail/owasp-content` (Task 2, with real content from Tasks 3/4); `PrismaService`/`PrismaClient` (Task 7).
- Produces: `seed(prisma: PrismaClient): Promise<void>` — idempotent upsert of `Principle` and `ChecklistItem` rows.

- [x] **Step 1: Add the workspace dependency**

```json
// apps/api/package.json — add to "dependencies"
"@sec-champs-trail/owasp-content": "*"
```

Run: `npm install`

- [x] **Step 2: Write the failing test**

```typescript
// apps/api/prisma/seed.spec.ts
import { PrismaClient } from "@prisma/client";
import { seed } from "./seed";

describe("seed", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("upserts all 10 principles and every checklist item, idempotently", async () => {
    await seed(prisma);
    await seed(prisma); // run twice — must not throw or duplicate

    const principleCount = await prisma.principle.count();
    expect(principleCount).toBe(10);

    const checklistCount = await prisma.checklistItem.count();
    expect(checklistCount).toBeGreaterThan(0);

    const anyPrinciple = await prisma.principle.findFirst({ orderBy: { order: "asc" } });
    expect(anyPrinciple?.license).toBe("CC BY-SA 4.0");
  });
});
```

- [x] **Step 3: Run the test to verify it fails**

Run: `DATABASE_URL=postgresql://champion:champion@localhost:5432/championforge npm run test -w apps/api -- seed`
Expected: FAIL — `./seed` has no exported member `seed`.

- [x] **Step 4: Implement the seed script**

```typescript
// apps/api/prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { loadPrinciples, loadChecklistItems } from "@sec-champs-trail/owasp-content";

export async function seed(prisma: PrismaClient): Promise<void> {
  for (const principle of loadPrinciples()) {
    await prisma.principle.upsert({
      where: { id: principle.id },
      create: principle,
      update: principle,
    });
  }

  for (const item of loadChecklistItems()) {
    const phase = item.phase === "development-retention" ? "development_retention" : "recruitment";
    await prisma.checklistItem.upsert({
      where: { id: item.id },
      create: { ...item, phase },
      update: { ...item, phase },
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
```

- [x] **Step 5: Run the test to verify it passes**

Run: `DATABASE_URL=postgresql://champion:champion@localhost:5432/championforge npm run test -w apps/api -- seed`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/prisma/seed.ts apps/api/prisma/seed.spec.ts
git commit -m "Add seed script populating Principle/ChecklistItem from owasp-content"
```

---

### Task 9: `apps/api` — Auth module (bcrypt + JWT + login endpoint)

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/jwt.strategy.ts`
- Create: `apps/api/src/auth/dto/login.dto.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`
- Modify: `apps/api/package.json` (add `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`)
- Modify: `apps/api/src/app.module.ts` (import `AuthModule`)

**Interfaces:**
- Consumes: `PrismaService` (Task 7), `JWT_SECRET` env var (validated in Task 6).
- Produces: `AuthService.validateCredentials(email, password): Promise<Champion | null>`, `AuthService.issueToken(champion): { accessToken: string }`; `POST /auth/login` returning `{ accessToken }` on valid credentials, `401` otherwise. Task 10 (bootstrap-admin) creates the `Champion` rows this logs in against.

- [x] **Step 1: Add auth dependencies**

```json
// apps/api/package.json — add to "dependencies"
"@nestjs/jwt": "^10.2.0",
"@nestjs/passport": "^10.0.0",
"passport": "^0.7.0",
"passport-jwt": "^4.0.0",
"bcrypt": "^5.1.0"
// add to "devDependencies"
"@types/passport-jwt": "^4.0.0",
"@types/bcrypt": "^5.0.0"
```

Run: `npm install`

- [x] **Step 2: Write the failing unit test for `AuthService`**

```typescript
// apps/api/src/auth/auth.service.spec.ts
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuthService", () => {
  const champion = {
    id: "champ-1",
    email: "captain@example.com",
    passwordHash: bcrypt.hashSync("correct-horse", 10),
    role: "admin" as const,
    teamId: null,
    createdAt: new Date(),
  };

  const prisma = {
    champion: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  const jwt = new JwtService({ secret: "test-secret-at-least-16-chars" });
  const service = new AuthService(prisma, jwt);

  beforeEach(() => jest.clearAllMocks());

  it("returns the champion when credentials are valid", async () => {
    (prisma.champion.findUnique as jest.Mock).mockResolvedValue(champion);
    const result = await service.validateCredentials("captain@example.com", "correct-horse");
    expect(result?.id).toBe("champ-1");
  });

  it("returns null when the password is wrong", async () => {
    (prisma.champion.findUnique as jest.Mock).mockResolvedValue(champion);
    const result = await service.validateCredentials("captain@example.com", "wrong-password");
    expect(result).toBeNull();
  });

  it("returns null when no champion has that email", async () => {
    (prisma.champion.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await service.validateCredentials("nobody@example.com", "anything");
    expect(result).toBeNull();
  });

  it("issues a JWT containing the champion's id, email and role", () => {
    const { accessToken } = service.issueToken(champion);
    const decoded = jwt.decode(accessToken) as Record<string, unknown>;
    expect(decoded.sub).toBe("champ-1");
    expect(decoded.email).toBe("captain@example.com");
    expect(decoded.role).toBe("admin");
  });
});
```

- [x] **Step 3: Run the test to verify it fails**

Run: `npm run test -w apps/api -- auth.service`
Expected: FAIL — `./auth.service` doesn't exist.

- [x] **Step 4: Implement `AuthService`**

```typescript
// apps/api/src/auth/auth.service.ts
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Champion } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<Champion | null> {
    const champion = await this.prisma.champion.findUnique({ where: { email } });
    if (!champion) return null;

    const passwordMatches = await bcrypt.compare(password, champion.passwordHash);
    return passwordMatches ? champion : null;
  }

  issueToken(champion: Pick<Champion, "id" | "email" | "role">): { accessToken: string } {
    const accessToken = this.jwtService.sign({
      sub: champion.id,
      email: champion.email,
      role: champion.role,
    });
    return { accessToken };
  }
}
```

- [x] **Step 5: Run the test to verify it passes**

Run: `npm run test -w apps/api -- auth.service`
Expected: PASS.

- [x] **Step 6: Implement `jwt.strategy.ts`, `dto/login.dto.ts`, `auth.controller.ts`, `auth.module.ts`**

```typescript
// apps/api/src/auth/jwt.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export interface JwtPayload {
  sub: string;
  email: string;
  role: "admin" | "champion";
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
```

```typescript
// apps/api/src/auth/dto/login.dto.ts
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
```

```typescript
// apps/api/src/auth/auth.controller.ts
import { Body, Controller, HttpCode, Post, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const champion = await this.authService.validateCredentials(dto.email, dto.password);
    if (!champion) throw new UnauthorizedException("Invalid credentials");
    return this.authService.issueToken(champion);
  }
}
```

```typescript
// apps/api/src/auth/auth.module.ts
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: "8h" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

Add `class-validator` and `class-transformer` to `apps/api/package.json` dependencies (`^0.14.0` / `^0.5.0`), and enable a global `ValidationPipe` in `main.ts`:

```typescript
// apps/api/src/main.ts — add these two lines inside bootstrap(), after app creation
import { ValidationPipe } from "@nestjs/common";
// ...
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
```

- [x] **Step 7: Register `AuthModule` in `app.module.ts`**

```typescript
// apps/api/src/app.module.ts
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
```

- [x] **Step 8: Write the e2e test for the login endpoint**

```typescript
// apps/api/test/auth.e2e-spec.ts
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
```

- [x] **Step 9: Run the e2e test**

Run: `DATABASE_URL=postgresql://champion:champion@localhost:5432/championforge JWT_SECRET=test-secret-at-least-16-chars npm run test:e2e -w apps/api`
Expected: PASS.

- [x] **Step 10: Commit**

```bash
git add apps/api/package.json apps/api/src/auth apps/api/src/app.module.ts apps/api/src/main.ts apps/api/test/auth.e2e-spec.ts
git commit -m "Add JWT auth module with login endpoint"
```

---

### Task 10: `apps/api` — bootstrap-admin script

**Files:**
- Create: `apps/api/src/bootstrap/bootstrap-admin.ts`
- Test: `apps/api/src/bootstrap/bootstrap-admin.spec.ts`
- Modify: `apps/api/package.json` (add `bootstrap:admin` script)

**Interfaces:**
- Consumes: `PrismaClient` (Task 7), env vars `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ORGANIZATION_NAME`.
- Produces: `bootstrapAdmin(prisma: PrismaClient, env: NodeJS.ProcessEnv): Promise<void>` — creates the singleton `Organization` and first admin `Champion` exactly once; throws if an `Organization` already exists (enforces "one org per instance" from ADR 0001 Decision 3 without a public HTTP route).

- [x] **Step 1: Write the failing test**

```typescript
// apps/api/src/bootstrap/bootstrap-admin.spec.ts
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { bootstrapAdmin } from "./bootstrap-admin";

describe("bootstrapAdmin", () => {
  const prisma = new PrismaClient();
  const env = {
    ADMIN_EMAIL: "captain@example.com",
    ADMIN_PASSWORD: "correct-horse-battery-staple",
    ORGANIZATION_NAME: "Acme Corp",
  };

  afterEach(async () => {
    await prisma.champion.deleteMany({ where: { email: env.ADMIN_EMAIL } });
    await prisma.organization.deleteMany({ where: { name: env.ORGANIZATION_NAME } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates one Organization and one admin Champion", async () => {
    await bootstrapAdmin(prisma, env);

    const org = await prisma.organization.findFirst({ where: { name: "Acme Corp" } });
    expect(org).not.toBeNull();

    const admin = await prisma.champion.findUnique({ where: { email: env.ADMIN_EMAIL } });
    expect(admin?.role).toBe("admin");
    expect(await bcrypt.compare(env.ADMIN_PASSWORD, admin!.passwordHash)).toBe(true);
  });

  it("throws if an Organization already exists", async () => {
    await bootstrapAdmin(prisma, env);
    await expect(bootstrapAdmin(prisma, env)).rejects.toThrow(/already exists/i);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `DATABASE_URL=postgresql://champion:champion@localhost:5432/championforge npm run test -w apps/api -- bootstrap-admin`
Expected: FAIL — module doesn't exist.

- [x] **Step 3: Implement `bootstrapAdmin`**

```typescript
// apps/api/src/bootstrap/bootstrap-admin.ts
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

export async function bootstrapAdmin(
  prisma: PrismaClient,
  env: Pick<NodeJS.ProcessEnv, "ADMIN_EMAIL" | "ADMIN_PASSWORD" | "ORGANIZATION_NAME">,
): Promise<void> {
  const existing = await prisma.organization.findFirst();
  if (existing) {
    throw new Error("An Organization already exists for this instance — bootstrap can only run once");
  }

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.ORGANIZATION_NAME) {
    throw new Error("ADMIN_EMAIL, ADMIN_PASSWORD and ORGANIZATION_NAME are required to bootstrap");
  }

  await prisma.organization.create({
    data: { name: env.ORGANIZATION_NAME },
  });

  await prisma.champion.create({
    data: {
      email: env.ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 10),
      role: "admin",
    },
  });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  bootstrapAdmin(prisma, process.env)
    .then(() => {
      console.log("Bootstrap complete.");
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err.message);
      await prisma.$disconnect();
      process.exit(1);
    });
}
```

- [x] **Step 4: Add the npm script**

```json
// apps/api/package.json — add to "scripts"
"bootstrap:admin": "ts-node src/bootstrap/bootstrap-admin.ts"
```

- [x] **Step 5: Run the test to verify it passes**

Run: `DATABASE_URL=postgresql://champion:champion@localhost:5432/championforge npm run test -w apps/api -- bootstrap-admin`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/src/bootstrap
git commit -m "Add bootstrap-admin script enforcing single Organization per instance"
```

---

### Task 11: `apps/web` — Vite + React + Tailwind scaffold with a minimal login page

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.js`, `apps/web/postcss.config.js`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/index.css`
- Create: `apps/web/src/pages/Login.tsx`
- Test: `apps/web/src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: `POST /auth/login` from Task 9 (via `fetch`, base URL from `VITE_API_URL` env var).
- Produces: nothing consumed by later Fase 0 tasks — this is the leaf UI. Fase 1a builds more pages on top of `App.tsx`'s routing.

- [x] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@sec-champs-trail/web",
  "private": true,
  "version": "0.0.0",
  "engines": { "node": ">=20" },
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [x] **Step 2: Create `apps/web/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
});
```

```typescript
// apps/web/src/setupTests.ts
import "@testing-library/jest-dom";
```

- [x] **Step 3: Create Tailwind config files**

```javascript
// apps/web/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

```javascript
// apps/web/postcss.config.js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

```css
/* apps/web/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [x] **Step 4: Create `apps/web/index.html` and `src/main.tsx`**

```html
<!-- apps/web/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>ChampionForge</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```tsx
// apps/web/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [x] **Step 5: Write the failing test for the login page**

```tsx
// apps/web/src/pages/Login.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Login } from "./Login";

describe("Login page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: "fake-token" }),
      }),
    );
  });

  it("submits email and password to the login endpoint", async () => {
    render(<Login />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "captain@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/login"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows an error message when login fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    render(<Login />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "wrong@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
```

- [x] **Step 6: Run the test to verify it fails**

Run: `npm install -w apps/web && npm run test -w apps/web -- Login`
Expected: FAIL — `./Login` doesn't exist.

- [x] **Step 7: Implement `Login.tsx`**

```tsx
// apps/web/src/pages/Login.tsx
import { FormEvent, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setError("Invalid credentials");
      return;
    }

    const { accessToken } = await res.json();
    localStorage.setItem("accessToken", accessToken);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-24 flex max-w-sm flex-col gap-4">
      <h1 className="text-xl font-semibold">ChampionForge</h1>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Log in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

```tsx
// apps/web/src/App.tsx
import { Login } from "./pages/Login";

export default function App() {
  return <Login />;
}
```

- [x] **Step 8: Run the test to verify it passes**

Run: `npm run test -w apps/web -- Login`
Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add apps/web
git commit -m "Scaffold React+Vite+Tailwind web app with minimal login page"
```

---

### Task 12: Docker Compose wiring + `.env.example` finalization

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `.env.example`

**Interfaces:** none new — this wires together artifacts from Tasks 1–11 into `docker compose up`.

- [x] **Step 1: Create `apps/api/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/owasp-content/package.json packages/owasp-content/package.json
RUN npm install
COPY packages/owasp-content packages/owasp-content
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npm run db:generate
CMD ["sh", "-c", "npm run db:migrate:deploy && npm run start"]
```

- [x] **Step 2: Create `apps/web/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY apps/web apps/web
WORKDIR /app/apps/web
CMD ["npm", "run", "dev", "--", "--host"]
```

- [x] **Step 3: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: champion
      POSTGRES_PASSWORD: champion
      POSTGRES_DB: championforge
    ports:
      - "5432:5432"
    volumes:
      - championforge-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U champion"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://champion:champion@postgres:5432/championforge
      JWT_SECRET: ${JWT_SECRET:-dev-only-secret-change-me}
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      VITE_API_URL: http://localhost:3000
    ports:
      - "5173:5173"
    depends_on:
      - api

volumes:
  championforge-db:
```

- [x] **Step 4: Update `.env.example` with the full variable set**

```
# Postgres (apps/api)
DATABASE_URL=postgresql://champion:champion@localhost:5432/championforge

# Auth (apps/api)
JWT_SECRET=change-me-in-production

# Bootstrap (apps/api — run once via `npm run bootstrap:admin -w apps/api`)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-in-production
ORGANIZATION_NAME=My Organization

# Frontend (apps/web)
VITE_API_URL=http://localhost:3000
```

- [x] **Step 5: Bring the full stack up and verify**

Run: `docker compose up --build -d`
Run: `curl -sf http://localhost:3000/health`
Expected: `{"status":"ok"}`.
Run: `curl -sf http://localhost:5173/`
Expected: HTML response (Vite dev server serving `index.html`).
Run: `docker compose down`

- [x] **Step 6: Commit**

```bash
git add apps/api/Dockerfile apps/web/Dockerfile docker-compose.yml .env.example
git commit -m "Wire Docker Compose for postgres, api and web"
```

---

### Task 13: CI — GitHub Actions (lint, typecheck, test)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:** none.

- [x] **Step 1: Write the workflow**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: champion
          POSTGRES_PASSWORD: champion
          POSTGRES_DB: championforge
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U champion"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://champion:champion@localhost:5432/championforge
      JWT_SECRET: ci-only-secret-not-for-production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm install
      - run: npm run db:migrate:deploy -w apps/api
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
```

- [x] **Step 2: Verify locally that every script the workflow calls exists**

Run: `npm run lint --workspaces --if-present && npm run typecheck --workspaces --if-present && npm run test --workspaces --if-present`
Expected: all succeed (or print nothing for workspaces without that script, since `--if-present` is used at the root and each workspace defines its own `lint`/`typecheck`/`test` from earlier tasks).

Note: `apps/api` and `apps/web`'s `package.json` don't yet have an `eslint` config file — add a minimal one to each so `npm run lint` doesn't fail on missing config:

```json
// apps/api/.eslintrc.json and apps/web/.eslintrc.json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "env": { "node": true, "es2022": true }
}
```

Add `"eslint": "^8.57.0"`, `"@typescript-eslint/parser": "^7.0.0"`, `"@typescript-eslint/eslint-plugin": "^7.0.0"` to each workspace's `devDependencies`.

- [x] **Step 3: Commit and push to trigger CI**

```bash
git add .github/workflows/ci.yml apps/api/.eslintrc.json apps/web/.eslintrc.json apps/api/package.json apps/web/package.json
git commit -m "Add CI workflow running lint, typecheck and test"
```

Verify: open the PR/branch in GitHub Actions and confirm the `test` job goes green.

---

## Self-Review Notes

- **Spec coverage:** every bullet in spec section 9 (acceptance criteria) maps to a task — Docker Compose (Task 12), seed with real content (Tasks 3/4/8), `ATTRIBUTION.md` (Task 5), bootstrap + JWT login (Tasks 9/10), CI (Task 13), full Prisma schema (Task 7), git already initialized (done, `f0c78b5`/`60b110f`).
- **Content curation caveat:** Tasks 3 and 4 depend on live-fetching `securitychampions.owasp.org` during execution rather than embedding pre-written OWASP text in this plan — per ADR 0001 Decision 1 and spec section 5, this transcription is explicitly human/agent curation work, not something to fabricate ahead of time. Whoever executes Task 3/4 must actually fetch the real pages; do not invent description text to satisfy the schema test faster.
- **Green-at-every-task-boundary fix:** Task 2 originally shipped with empty content directories and an intentionally failing test, deferring to Tasks 3/4. Restructured so Task 2 ships 2 fixture principles + 1 fixture checklist item and ends fully green; Tasks 3 and 4 delete the fixtures, add the real curated content, and each append their own additional test assertion (principle count, phase coverage) rather than relying on assertions written two tasks earlier. Task 6's `env.validation.ts` was originally a no-op stub replaced by a separate Task 7; folded into a single Task 6 so the module is real and tested from the moment it's created, eliminating the intermediate placeholder. This removed one task from the plan and shifted every task from the old Task 8 onward down by one number (final count: 13 tasks, was 14).
- **Type consistency check:** `Principle.id` / `ChecklistItem.principleId` (owasp-content, Task 2) are plain strings matching the Prisma `Principle.id` / `ChecklistItem.principleId` (Task 7) and are used identically in the seed script (Task 8). `ChecklistPhase` uses hyphenated values (`"development-retention"`) in `packages/owasp-content` but underscored enum values (`development_retention`) in Prisma — the seed script (Task 8, Step 4) explicitly translates between the two; this mismatch is intentional (JSON convention vs. Prisma enum naming convention) and documented inline rather than left implicit.
