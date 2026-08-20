# QA session bugfixes (AI adapter, unknown-route page, admin-page gating) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 3 confirmed findings from a manual Playwright QA session run against the
full app on 2026-08-20 (real Chrome, real Docker Compose stack, real Postgres, real
Anthropic API calls — not a code read-through): the AI-powered features (Training Track
Generator, Executive Report) are completely broken for every user; navigating to an
unknown URL renders a blank page instead of any guidance; and the two admin-only pages
render a fully interactive UI to a logged-in champion who reaches them by typing the URL,
even though the backend already rejects every request they make there.

**Architecture:** `apps/api/src/ai/ai-provider.service.ts` (Task 1, backend, no new
dependency). `apps/web/src/App.tsx` plus one new page component (Task 2) and one new route
guard component (Task 3), both frontend-only. No database schema changes, no new
endpoints, no UI redesign — Task 2 adds one small new page; Task 3 adds zero new UI (it
only changes which existing UI a champion can reach).

**Tech Stack:** Unchanged. NestJS 10.4.x / Jest for Task 1. React 18 / react-router-dom 6 /
Vitest + Testing Library for Tasks 2 and 3.

**Spec:** None — this plan is self-contained. There was no separate spec-writing pass;
the findings below **are** the spec, captured directly from the QA session (see "Findings"
section) with root causes already confirmed by reading the actual code and, for Task 1,
reproducing the bug directly against the live Anthropic API (see Task 1's "Confirmed root
cause" box).

## Findings (2026-08-20 manual QA session)

| # | Severity | Summary | Root cause confirmed in |
|---|----------|---------|--------------------------|
| 1 | **Critical** | Training Track Generator and Executive Report both fail with `502 Bad Gateway` on every attempt | `apps/api/src/ai/ai-provider.service.ts:67-69` |
| 2 | Medium (UX) | Navigating to any unknown URL renders a completely blank page — no message, no way back | `apps/web/src/App.tsx:19-33` (no `path="*"` route) |
| 3 | Low (UX / defense-in-depth) | `/teams` and `/executive-reports` render a fully interactive admin UI to a logged-in champion who reaches them by URL, before every request they make there gets rejected by the backend | `apps/web/src/App.tsx:22-32` (routes not gated by `role`); backend RBAC itself was verified correct (403 on every GET/POST tested) |

Findings 2 and 3 were found by direct URL navigation and button clicks in a real browser,
cross-checked against `docker compose logs app` and the Network tab — not guessed at.
Finding 1 was root-caused by reproducing the exact failing request directly against
`https://api.anthropic.com/v1/messages` with `curl`, outside the app, to rule out
prompt/token-budget issues before touching any code (see Task 1).

## Global Constraints

- **Task 1 is the priority.** The AI features are not degraded, they are 100% broken for
  every organization using this app with an Anthropic-format provider today. Tasks 2 and 3
  are independent UX/hardening improvements — either order, or split across sessions, is
  fine — but land Task 1 first.
- No new npm dependencies for any task.
- No database schema changes.
- Any new UI (Task 2's not-found page) must reuse the existing design tokens already used
  throughout `apps/web` — `font-display` / `font-mono` / `font-body`, the `ink*` / `accent*`
  / `bg*` / `line*` color tokens, `rounded-lg` / `rounded-2xl` radii. Do not introduce a new
  visual style. `apps/web/src/pages/Login.tsx` is a good reference for the token names in
  use.
- After Task 1's code change, the running Docker image is **stale** until rebuilt — the
  compiled `apps/api/dist/` bundled into the image predates the fix. Run
  `docker compose up --build -d` before manually re-testing the AI features live (both this
  plan's Task 1 manual-verification step and any later ad-hoc testing need this).
- The `.env` at the repo root (gitignored) already has a real, working
  `AI_PROVIDER_API_KEY` (Anthropic, copied from a sibling local project during the QA
  session) — reuse it for manual verification instead of provisioning a new one. If it's
  since been revoked, get a fresh key before attempting Task 1's manual verification step;
  the automated Jest test in Task 1 does not need a real key (it mocks `fetch`).
- Run `npm run typecheck`, `npm run lint`, and `npm run test` for the workspace each task
  touches (`apps/api` for Task 1; `apps/web` for Tasks 2 and 3) after every task; all three
  must be clean before moving on.

---

### Task 1: Fix the Anthropic adapter to find the text block instead of assuming `content[0]`

**Confirmed root cause:** Reproduced the exact failing request directly against the real
Anthropic API (same system/user prompt the app builds, same `model: "claude-sonnet-5"`,
same `max_tokens: 10000` from `.env`) with `curl`. The response came back **`200 OK`**,
`stop_reason: "end_turn"` (not `max_tokens` — this is not a truncation/token-budget issue),
with **two content blocks**:

```
content[0] = { type: "thinking", thinking: "...", signature: "..." }   // no "text" field
content[1] = { type: "text", text: "{\"modules\": [...]}" }            // the real, complete, valid JSON
```

`apps/api/src/ai/ai-provider.service.ts:67-69`'s Anthropic adapter reads only
`content[0]?.text`, which is `undefined` on a thinking-first response, so `generate()`
returns `""`. That empty string then fails JSON extraction in
`apps/api/src/training-tracks/training-track-generator.ts` / the equivalent
`executive-report-generator.ts`, which is what surfaces as `502 Bad Gateway` in
`apps/api/src/training-tracks/training-tracks.service.ts:56-61` (and the equivalent
executive-reports service) — confirmed by the exact error in `docker compose logs app`
during the QA session: `Error: AI response did not contain a valid modules array`.

This is a single shared bug affecting **both** AI features — `TrainingTracksService` and
`ExecutiveReportsService` both call `AiProviderService.generate()`, so one fix here closes
both.

**Files:**
- Modify: `apps/api/src/ai/ai-provider.service.ts`
- Test: `apps/api/src/ai/ai-provider.service.spec.ts`

**Interfaces:** none new — `AiProviderService.generate()`'s signature and return type
(`Promise<string>`) are unchanged, only the Anthropic adapter's internal
`extractContent` behavior.

- [ ] **Step 1: Write the failing test**

Add to the `describe("generate", ...)` block in
`apps/api/src/ai/ai-provider.service.spec.ts`, right after the existing
`"builds an Anthropic-format request when AI_PROVIDER_API_FORMAT=anthropic"` test:

```ts
    it("extracts the text block when the response includes a thinking block first (Anthropic extended thinking)", async () => {
      process.env.AI_PROVIDER_API_KEY = "test-key";
      process.env.AI_PROVIDER_API_FORMAT = "anthropic";
      const fakeFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          content: [
            { type: "thinking", thinking: "reasoning about the request...", signature: "abc" },
            { type: "text", text: "hello after thinking" },
          ],
        }),
      });

      const result = await new AiProviderService().generate("sys", "user", fakeFetch as unknown as typeof fetch);

      expect(result).toBe("hello after thinking");
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/api -- ai-provider`
Expected: FAIL — the new test gets `""` instead of `"hello after thinking"`, because the
current code reads `content[0]?.text`, and `content[0]` here is the `thinking` block, which
has no `text` field.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/ai/ai-provider.service.ts`, replace:

```ts
    extractContent: (json) => {
      const content = json.content as Array<{ text?: string }> | undefined;
      return content?.[0]?.text ?? "";
    },
```

with:

```ts
    extractContent: (json) => {
      const content = json.content as Array<{ type?: string; text?: string }> | undefined;
      if (!content) return "";
      // A thinking-enabled response puts its reasoning in an earlier block with no "text"
      // field (type: "thinking") -- the real answer is the first block explicitly typed
      // "text", not necessarily content[0]. Fall back to the first block with a text
      // string for responses/fixtures that omit "type" altogether.
      const textBlock = content.find((block) => block.type === "text") ?? content.find((block) => typeof block.text === "string");
      return textBlock?.text ?? "";
    },
```

(The fallback clause is why the existing test right above — which mocks
`content: [{ text: "hello from anthropic" }]` with no `type` field — keeps passing
unchanged: nothing matches `type === "text"`, so it falls back to the first block with a
`text` string.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/api -- ai-provider`
Expected: PASS (all `AiProviderService` tests, including the new one and the two existing
`openai`/`anthropic` format tests unchanged).

- [ ] **Step 5: Rebuild and manually verify against the real Anthropic API**

```bash
docker compose up --build -d
```

Then, with the stack up and an admin/champion account already bootstrapped (see
`README.md` Quickstart if starting fresh):

1. Log in as a champion, go to **Training track**, fill in a tech stack, click
   **Generate track**, accept the AI consent modal. Expected: a real, multi-module training
   track renders — no `502`, no "Failed to generate a training track" alert.
2. Log in as an admin, go to **Executive report**, click **Generate report**. Expected: a
   real report renders — no `502`, no "Failed to generate the executive report" alert.
3. `docker compose logs app --tail=20` — expected: no
   `Error: AI response did not contain a valid modules array` (or the executive-report
   equivalent) in the recent log output.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ai/ai-provider.service.ts apps/api/src/ai/ai-provider.service.spec.ts
git commit -m "fix(api): read the first text-typed content block from Anthropic responses, not content[0]"
```

---

### Task 2: Add a catch-all not-found page

**Files:**
- Create: `apps/web/src/pages/NotFound.tsx`
- Create: `apps/web/src/pages/NotFound.test.tsx`
- Create: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Produces: `NotFound` component, exported from `apps/web/src/pages/NotFound.tsx` (named
  export, matching every other page in `apps/web/src/pages/`).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/pages/NotFound.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NotFound } from "./NotFound";

describe("NotFound", () => {
  it("renders a not-found message with a link back to the dashboard", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute("href", "/dashboard");
  });
});
```

Create `apps/web/src/App.test.tsx` — this is the actual regression test for the bug (a
missing route in the router table), as opposed to the component test above which only
covers the new component in isolation:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the not-found page for an unknown route", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => null }));
    window.history.pushState({}, "", "/this-route-does-not-exist");

    render(<App />);

    await waitFor(() => expect(screen.getByText(/page not found/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/web -- NotFound App`
Expected: FAIL on both — `NotFound.tsx` doesn't exist yet (import error), and `App.tsx` has
no `path="*"` route, so the unknown route currently renders nothing.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/pages/NotFound.tsx`:

```tsx
import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">404</p>
      <h1 className="font-display text-xl font-bold text-ink">Page not found</h1>
      <p className="max-w-sm font-body text-[13px] text-ink-muted">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        to="/dashboard"
        className="mt-2 rounded-lg bg-accent px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
```

(If the visitor isn't logged in, `/dashboard` is itself wrapped in `ProtectedRoute`, which
bounces them to `/login` — that's the existing, correct behavior, not something this page
needs to special-case.)

In `apps/web/src/App.tsx`, add the import alongside the other page imports:

```ts
import { NotFound } from "./pages/NotFound";
```

and add a new route as the **last** child of `<Routes>`, as a sibling of `/` and
`/login` (not nested inside `<ProtectedRoute />` — it must render regardless of auth
state):

```tsx
          <Route path="*" element={<NotFound />} />
```

so the full `<Routes>` block reads:

```tsx
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/assessment/new" element={<AssessmentForm />} />
            <Route path="/checklist" element={<ChecklistLibrary />} />
            <Route path="/action-plan" element={<ActionPlanPage />} />
            <Route path="/training-tracks" element={<TrainingTrackPage />} />
            <Route path="/executive-reports" element={<ExecutiveReportPage />} />
            <Route path="/training-tracks/:id/print" element={<TrainingTrackPrintPage />} />
            <Route path="/executive-reports/:id/print" element={<ExecutiveReportPrintPage />} />
            <Route path="/teams" element={<TeamsAdmin />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/web -- NotFound App`
Expected: PASS (both new tests).

- [ ] **Step 5: Run the full frontend suite to check for regressions**

Run: `npm run test -w apps/web`
Expected: PASS, no regressions — this change only adds a route and a new page, it doesn't
touch any existing route or component.

- [ ] **Step 6: Manual verification**

With the stack running (`docker compose up -d` is enough — this task doesn't need a
rebuild since Task 1's backend change isn't involved), open
`http://localhost:3000/this-route-does-not-exist` in a browser. Expected: the "Page not
found" page renders (not a blank screen), with a working "Go to dashboard" link.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/NotFound.tsx apps/web/src/pages/NotFound.test.tsx apps/web/src/App.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): add a not-found page for unknown routes instead of a blank screen"
```

---

### Task 3: Gate `/teams` and `/executive-reports` behind an `AdminRoute` guard

**Context:** The backend already correctly rejects every request a champion makes to
`GET/POST /api/teams` and `GET/POST /api/executive-reports` with `403 Forbidden` — this was
verified directly during the QA session (URL navigation, button clicks, and a raw
unauthenticated `curl` all got the right status code). This task is not a security fix, the
authorization boundary already exists and is enforced server-side; it closes a UX gap where
a champion who reaches these routes by URL sees the admin page shell (forms, an active
"Create team" button, a "Generate report" button) render before every action they take
there fails. The frontend already knows the difference — `ProtectedRoute.tsx`'s `NAV_LINKS`
already marks these two links `adminOnly: true` and hides them from a champion's nav bar —
this task makes the routes themselves enforce the same rule, closing the gap between "the
link is hidden" and "the URL still works."

**Files:**
- Create: `apps/web/src/auth/AdminRoute.tsx`
- Create: `apps/web/src/auth/AdminRoute.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Produces: `AdminRoute` component, exported from `apps/web/src/auth/AdminRoute.tsx`,
  following the exact same layout-route pattern as the existing `ProtectedRoute` (renders
  `<Outlet />` when the check passes, `<Navigate>` when it doesn't).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/auth/AdminRoute.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { AdminRoute } from "./AdminRoute";

function renderAdminRoute(role: "admin" | "champion") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "1",
        email: "user@example.com",
        role,
        teamId: role === "champion" ? "team-1" : null,
      }),
    }),
  );

  return render(
    <MemoryRouter initialEntries={["/teams"]}>
      <AuthProvider>
        <Routes>
          <Route path="/dashboard" element={<p>dashboard content</p>} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminRoute />}>
              <Route path="/teams" element={<p>teams admin content</p>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("AdminRoute", () => {
  it("renders the route content for an admin", async () => {
    renderAdminRoute("admin");
    await waitFor(() => expect(screen.getByText("teams admin content")).toBeInTheDocument());
  });

  it("redirects a champion to /dashboard instead of rendering the admin content", async () => {
    renderAdminRoute("champion");
    await waitFor(() => expect(screen.getByText("dashboard content")).toBeInTheDocument());
    expect(screen.queryByText("teams admin content")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- AdminRoute`
Expected: FAIL — `apps/web/src/auth/AdminRoute.tsx` doesn't exist yet (import error).

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/auth/AdminRoute.tsx`:

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function AdminRoute() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
```

(No loading/null check needed here the way `ProtectedRoute` has one — `AdminRoute` is only
ever nested *inside* `ProtectedRoute`'s `<Outlet />`, which already redirected to `/login`
and stopped rendering its children if `user` were `null` or still loading. By the time
`AdminRoute` renders, `user` is guaranteed to be a real, loaded `CurrentUser`.)

In `apps/web/src/App.tsx`, add the import alongside the other imports (after Task 2's
`NotFound` import, or wherever — order doesn't matter):

```ts
import { AdminRoute } from "./auth/AdminRoute";
```

Then wrap the three admin-only routes (`/executive-reports`, its print route, and `/teams`)
in a nested `AdminRoute` layer, moving them after the other protected routes. Replace:

```tsx
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/assessment/new" element={<AssessmentForm />} />
            <Route path="/checklist" element={<ChecklistLibrary />} />
            <Route path="/action-plan" element={<ActionPlanPage />} />
            <Route path="/training-tracks" element={<TrainingTrackPage />} />
            <Route path="/executive-reports" element={<ExecutiveReportPage />} />
            <Route path="/training-tracks/:id/print" element={<TrainingTrackPrintPage />} />
            <Route path="/executive-reports/:id/print" element={<ExecutiveReportPrintPage />} />
            <Route path="/teams" element={<TeamsAdmin />} />
          </Route>
```

with:

```tsx
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/assessment/new" element={<AssessmentForm />} />
            <Route path="/checklist" element={<ChecklistLibrary />} />
            <Route path="/action-plan" element={<ActionPlanPage />} />
            <Route path="/training-tracks" element={<TrainingTrackPage />} />
            <Route path="/training-tracks/:id/print" element={<TrainingTrackPrintPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/executive-reports" element={<ExecutiveReportPage />} />
              <Route path="/executive-reports/:id/print" element={<ExecutiveReportPrintPage />} />
              <Route path="/teams" element={<TeamsAdmin />} />
            </Route>
          </Route>
```

(`/training-tracks` and its print route stay outside `AdminRoute` — both roles can use
Training Track, only `Executive report` and `Teams` are `adminOnly` per
`ProtectedRoute.tsx`'s existing `NAV_LINKS` table.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- AdminRoute`
Expected: PASS (both new tests).

- [ ] **Step 5: Run the full frontend suite to check for regressions**

Run: `npm run test -w apps/web`
Expected: PASS. In particular, re-check `App.test.tsx` (Task 2) and any existing
`TeamsAdmin.test.tsx` / `ExecutiveReport.test.tsx` tests still pass — those component-level
tests render the page components directly, not through the router, so they're unaffected
by where `AdminRoute` sits in `App.tsx`.

- [ ] **Step 6: Manual verification**

With the stack running (`docker compose up -d` — no rebuild needed, frontend-only change):

1. Log in as a champion (not admin).
2. Navigate directly to `http://localhost:3000/teams` — expected: immediately redirected to
   `/dashboard`, the "New team" form never renders.
3. Navigate directly to `http://localhost:3000/executive-reports` — expected: same,
   immediate redirect to `/dashboard`.
4. Log in as an admin and confirm both pages still work exactly as before (no regression
   for the role that's supposed to have access).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/auth/AdminRoute.tsx apps/web/src/auth/AdminRoute.test.tsx apps/web/src/App.tsx
git commit -m "fix(web): redirect champions away from admin-only routes instead of rendering their UI"
```

---

## Final verification (after all 3 tasks)

- [ ] Run `npm run typecheck`, `npm run lint`, `npm run test` (all workspaces) — expect no
      errors.
- [ ] `docker compose down -v && docker compose up --build -d` (full rebuild, fresh
      database) then `docker compose exec app node dist/src/bootstrap/bootstrap-admin.js`
      to re-bootstrap the admin (see `README.md` Quickstart if `ADMIN_EMAIL` /
      `ADMIN_PASSWORD` / `ORGANIZATION_NAME` need setting in `.env` first).
- [ ] As admin: create a team, add a champion to it (via **Teams**).
- [ ] As that champion: submit an assessment, check a couple of checklist items, generate
      an action plan, then generate a Training Track — confirm it succeeds end-to-end (this
      is Task 1's regression check against the real, rebuilt image, not just the mocked
      Jest test).
- [ ] As admin: generate an Executive Report — confirm it succeeds end-to-end.
- [ ] As champion: try `http://localhost:3000/teams` and
      `http://localhost:3000/executive-reports` directly — confirm both redirect to
      `/dashboard` without rendering the admin UI (Task 3).
- [ ] Visit `http://localhost:3000/some-made-up-path` — confirm the not-found page renders,
      not a blank screen (Task 2).
- [ ] `docker compose logs app --tail=50` — confirm no new errors beyond the expected
      `401`/`404` noise on first page load that was already present before this plan (e.g.
      `GET /api/auth/me` 401 before login, `GET .../assessments/latest` 404 before the
      first assessment exists — both pre-existing, unrelated to this plan, not something to
      fix here).
- [ ] Confirm `git log --oneline` on the branch shows 3 commits, one per task above.
