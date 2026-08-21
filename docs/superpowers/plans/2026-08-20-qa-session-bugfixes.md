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

---

## Follow-up QA verification session (2026-08-20, after Tasks 1–3 were implemented)

**Context:** Tasks 1, 2, and 3 above were implemented and committed on branch
`worktree-qa-session-bugfixes` (commits `693cf03`, `55c3416`, `5dacce0`, plus test commit
`20dfed6` and this doc's own commit `e5a3ba9`). A follow-up manual QA pass was then run
against a **Docker image rebuilt from this branch** (`docker compose -p sec-champs-trail up
--build -d` from the worktree directory — **not** `main`, these fixes are not yet merged),
against real Postgres data, real login flows (the existing admin, plus a freshly created
`qa.champion@example.com` champion), and real Anthropic API calls, driven live in Chrome via
browser automation (`claude-in-chrome`, not Playwright — the Playwright MCP browser profile
was already locked by another concurrent Claude Code session) so results could be watched in
real time.

### What's already tested and confirmed working — do not redo this

- **Task 1**: Training Track generation succeeded end-to-end against the real Anthropic API
  (a real 7-module track, no `502`). Confirms the `content[0]` → find-the-`"text"`-block fix
  works for the case it was written for.
- **Task 2**: Unknown route (`/this-route-does-not-exist`) renders the "Page not found" page
  with a working "Go to dashboard" link.
- **Task 3**: A champion navigating directly to `/teams` or `/executive-reports` is
  redirected to `/dashboard`; the admin UI never renders for them.
- Full non-AI flows exercised without incident: admin login/logout, Teams admin (create
  team, create champion), champion login, the 10-question maturity assessment (submission +
  radar chart), Checklist Library (checkbox toggling persists via
  `PATCH .../checklist-progress/:id`, `200`), Action Plan generation (correctly reflects
  checklist progress), admin Dashboard team switcher, the executive-report print route
  (`/executive-reports/:id/print`, reachable and correctly admin-gated — it invokes the
  browser's native `window.print()`, which is expected print-page behavior, not a bug). No
  browser console errors were observed anywhere in the session.
- **New finding surfaced by this pass, not yet fixed — see below**: the AI features are
  **still not fully reliable** even after Task 1, for a different reason than Task 1 fixed.

### New Finding #4 (Critical, intermittent) — AI JSON parsing breaks on unescaped control characters, still causes 502s

**Severity:** Critical — same user-facing symptom as the original Finding #1 (a `502` on
"Generate report" / "Generate track"), but a **different root cause, not fixed by Task 1**.

**Reproduction:** As admin, clicked "Generate report" on `/executive-reports` (org already
had 2 teams with assessments). First attempt: **`502`**. `docker compose logs app` showed:

```
[ExecutiveReportsService] Failed to generate the executive report
Error: AI response did not contain a valid report
    at parseExecutiveReportResponse (.../executive-report-generator.js:37:15)
```

Clicking "Generate report" again immediately after, same data, same prompt: **succeeded**
(`201`). This confirms the failure is non-deterministic, not a permanent regression from
Task 1's change.

**Confirmed root cause:** Reproduced directly against the real Anthropic API with `curl`,
replaying the exact system/user prompt `buildExecutiveReportPrompt()` builds for this data.
The response came back `200 OK`, `stop_reason: "end_turn"` (not truncated), with a `text`
content block that looks like valid JSON at a glance — but `JSON.parse` fails on it:

```
Invalid control character at: line 1 column 2864 (char 2863)
```

Inspecting that byte offset shows the model wrote a **literal, unescaped newline character**
inside the `"report"` string value (`...culture.\n- **Reward...` — an actual `0x0A` byte, not
the two-character escape sequence `\n`), which is illegal inside a JSON string per the JSON
spec. `apps/api/src/ai/extract-json.ts`'s `tryParse()` uses plain `JSON.parse`, which has
zero tolerance for this.

**Why Task 1 didn't fix this:** Task 1 fixed *which content block* `AiProviderService` reads
(`content[0]` → the block with `type: "text"`). This is a *separate* bug, one step later in
the pipeline: even once the correct text block is extracted, its content is not always
strictly valid JSON, because the model is asked to embed long, free-form Markdown (a
`report` field, or `modules[].content`) inside a JSON string, and it occasionally emits a raw
control character instead of the escaped form.

**Why this isn't Training-Track-specific or Executive-Report-specific:** Both
`apps/api/src/training-tracks/training-track-generator.ts` and
`apps/api/src/executive-reports/executive-report-generator.ts` call the same
`extractJson()` from `apps/api/src/ai/extract-json.ts`, and both prompts ask for long
Markdown inside a JSON string field. Training Track happened to succeed on its one and only
attempt in this QA session purely by luck — it is equally exposed to this failure mode, just
not caught failing in this specific session.

**Brainstorming outcome (2026-08-20):** Ran `superpowers:brainstorming` with the user before
writing any code, as required above. Four directions were weighed:

- **(A) Chosen — a narrow, state-machine-based sanitizer** that walks the raw response
  character by character and escapes only raw control bytes (`0x00`–`0x1F`) found *inside a
  JSON string literal*, leaving everything else (including JSON's own structural whitespace)
  untouched. It does not loosen structural validation — missing braces, missing commas, and
  truncated JSON still fail exactly as today. No new dependency; lives entirely inside
  `apps/api/src/ai/extract-json.ts`, so it transparently covers both generators and both
  provider formats (OpenAI, Anthropic) through the one shared code path, with **no change**
  to `AiProviderService`'s contract or `ai-provider.service.spec.ts`.
- (B) Rejected for now — moving to native structured output (Anthropic `tool_use` /
  OpenAI function calling / `response_format`) so the provider itself guarantees valid JSON,
  eliminating client-side `JSON.parse` entirely. Genuinely the most robust long-term
  direction, but it changes `AiProviderService.generate()`'s contract and duplicates
  schema-handling logic across both adapters — a materially bigger change than this finding's
  severity requires right now. Worth a dedicated future spec, not bundled here.
- (C) Rejected — a generic third-party "JSON repair" library. Broader tolerance than the
  confirmed defect needs, adds a new dependency to a security-adjacent parsing path, and a
  parser that lenient risks masking a genuinely corrupted or manipulated response instead of
  failing loudly.
- (D) Rejected (for now) — an automatic one-shot retry on parse failure as a complementary
  safety net. Treats the symptom, not the cause, and costs an extra real API call on every
  occurrence. The user chose not to add this on top of (A); (A) alone is expected to close
  the confirmed defect.

Security framing: (A) was chosen specifically because it does not expand what the parser
*accepts* in any general sense — it corrects one narrowly-defined, already-illegal byte
sequence back to spec-compliant JSON, inside the exact code path both generators already
share, without touching the untrusted-data fencing already in place in the two prompts
(`<dados_do_time>` / `<dados_da_organizacao>`) or introducing a new dependency.

### Task 4: Escape raw control characters inside JSON string values before parsing AI responses

**Context:** See "New Finding #4" above for the full reproduction and root-cause analysis,
and "Brainstorming outcome" immediately above for why this approach (and not one of the three
rejected alternatives) was chosen. `apps/api/src/ai/extract-json.ts`'s `tryParse()` calls
plain `JSON.parse`, which has zero tolerance for a raw, unescaped control character (e.g. a
literal `0x0A` newline byte) inside a JSON string value — legal-looking Markdown content from
the AI, illegal JSON. This is a single shared bug affecting both `TrainingTracksService` and
`ExecutiveReportsService`, the same way Task 1 was, because both call the same
`extractJson()`.

**Files:**
- Modify: `apps/api/src/ai/extract-json.ts`
- Test: Create `apps/api/src/ai/extract-json.spec.ts` (does not exist yet — today this module
  is only covered indirectly through the two generators' own spec files)

**Interfaces:** none new — `extractJson<T>(raw: string): T | null`'s signature and behavior
for already-valid JSON are unchanged; only its tolerance for one specific, illegal byte
sequence inside string values changes.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/ai/extract-json.spec.ts`:

```ts
import { extractJson } from "./extract-json";

describe("extractJson", () => {
  it("parses a bare JSON object with a properly-escaped newline", () => {
    const raw = '{"report": "line one\\nline two"}';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: "line one\nline two" });
  });

  it("repairs a literal unescaped newline inside a JSON string value (the confirmed Finding #4 defect)", () => {
    // The template literal below embeds an ACTUAL newline byte (0x0A) inside
    // the string value, not the two-character escape sequence -- this is
    // exactly what plain JSON.parse rejects with an "invalid/bad control
    // character" error, and what the real Anthropic response in Finding #4
    // was shown (via curl, outside the app) to contain.
    const raw = '{"report": "First paragraph.\n- Bullet one\n- Bullet two"}';
    expect(extractJson<{ report: string }>(raw)).toEqual({
      report: "First paragraph.\n- Bullet one\n- Bullet two",
    });
  });

  it("repairs a literal unescaped tab and carriage return inside a string value", () => {
    const raw = '{"content": "before\tafter\rend"}';
    expect(extractJson<{ content: string }>(raw)).toEqual({ content: "before\tafter\rend" });
  });

  it("does not corrupt whitespace used as JSON structural formatting outside of strings", () => {
    const raw = '{\n  "report": "one line, no control chars"\n}';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: "one line, no control chars" });
  });

  it("does not get confused by an escaped quote inside a string value that also has a raw newline", () => {
    const raw = '{"report": "She said \\"hello\\".\nNext line."}';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: 'She said "hello".\nNext line.' });
  });

  it("still returns null for structurally malformed JSON (missing closing brace)", () => {
    const raw = '{"report": "unterminated';
    expect(extractJson(raw)).toBeNull();
  });

  it("repairs a raw control character even when the JSON is wrapped in a fenced code block", () => {
    const raw = '```json\n{"report": "line one\nline two"}\n```';
    expect(extractJson<{ report: string }>(raw)).toEqual({ report: "line one\nline two" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/api -- extract-json`
Expected: FAIL on the "repairs a literal unescaped ..." tests (plain `JSON.parse` rejects the
raw control byte) — the "does not corrupt ..." and "still returns null ..." tests already pass
against the current implementation, since they don't exercise the new behavior.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/ai/extract-json.ts`, add (above `tryParse`):

```ts
const JSON_ESCAPES: Record<number, string> = {
  0x08: "\\b",
  0x09: "\\t",
  0x0a: "\\n",
  0x0c: "\\f",
  0x0d: "\\r",
};

// AI responses occasionally embed a raw, unescaped control byte (most often
// a literal newline) inside a JSON string value instead of its two-character
// escape sequence -- illegal per the JSON spec, but not a structural error.
// This repairs exactly that, and only inside string literals: it tracks
// whether the scan is currently inside a JSON string (toggled on an
// unescaped `"`) and whether the current character is itself the target of
// a preceding backslash, so it never touches JSON's own structural
// whitespace or double-escapes an already-valid sequence.
function escapeRawControlChars(source: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const char of source) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      result += char;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    const code = char.charCodeAt(0);
    if (inString && code < 0x20) {
      result += JSON_ESCAPES[code] ?? `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }
    result += char;
  }

  return result;
}
```

Then replace:

```ts
function tryParse<T>(source: string): T | null {
  try {
    return JSON.parse(source) as T;
  } catch {
    return null;
  }
}
```

with:

```ts
function tryParse<T>(source: string): T | null {
  try {
    return JSON.parse(source) as T;
  } catch {
    // fall through -- retry once below after repairing raw control
    // characters, before giving up.
  }
  try {
    return JSON.parse(escapeRawControlChars(source)) as T;
  } catch {
    return null;
  }
}
```

(Trying the raw string first, and only paying for the character-by-character repair pass on
failure, keeps the existing fast path unchanged for the common case where the AI already
produced strictly valid JSON.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/api -- extract-json`
Expected: PASS (all new tests).

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `npm run typecheck -w apps/api && npm run lint -w apps/api && npm run test -w apps/api`
Expected: PASS, no regressions — in particular re-check that
`training-track-generator`/`executive-report-generator`-related specs (if any exist) and
`ai-provider.service.spec.ts` are unaffected, since this task doesn't touch either of those
files.

- [ ] **Step 6: Manual verification**

```bash
docker compose -p sec-champs-trail up --build -d
```

Then, reusing the existing QA data (`QA Test Team` / `qa.champion@example.com`, or create
fresh data per `README.md` Quickstart):

1. As admin, generate an Executive Report several times in a row (the defect is
   intermittent — a handful of successes doesn't prove the fix on its own, the unit test
   above is the authoritative check, but this builds live confidence). Expected: no `502`,
   and `docker compose logs app` shows no
   `Error: AI response did not contain a valid report`.
2. As champion, generate a Training Track a couple of times. Expected: same — no `502`, no
   `Error: AI response did not contain a valid modules array`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/ai/extract-json.ts apps/api/src/ai/extract-json.spec.ts
git commit -m "fix(api): repair raw control characters inside AI JSON string values before parsing"
```

---

### Task 5: Add a loading indicator while an AI feature is generating

**Problem:** Clicking "Generate track" (`/training-tracks`) or "Generate report"
(`/executive-reports`) shows minimal visual feedback while the request is in flight. A real
generation against the Anthropic API took roughly 15–35 seconds in this QA session
(`AI_PROVIDER_TIMEOUT_MS` allows up to 120s).

**Ruling (preflight scan, 2026-08-20) — this task's scope is narrower than the original
Finding #5 text above:** Both `apps/web/src/pages/TrainingTrack.tsx` and
`apps/web/src/pages/ExecutiveReport.tsx` already have a `generating` state
(`const [generating, setGenerating] = useState(false)`, set `true` at the top of
`doGenerate()` and back to `false` at its end) already wired to
`disabled={generating || ...}` on the button, with `disabled:cursor-not-allowed
disabled:opacity-70` in its class list. So the button **is** already disabled and dimmed
while generating, and a second click during generation **cannot** already fire a concurrent
request — that part of the original finding does not hold against the current code. The one
genuinely missing piece is that the button's **label text never changes** — it always reads
"Generate track" / "Generate report", even while `generating` is `true`. This task is scoped
to exactly that: swap the label while `generating` is `true`. Do not rename the existing
`generating` state or restructure `doGenerate()` — reuse both as they are.

**Files:**
- Modify: `apps/web/src/pages/TrainingTrack.tsx`, `apps/web/src/pages/ExecutiveReport.tsx`
- Test: extend `apps/web/src/pages/TrainingTrack.test.tsx` and
  `apps/web/src/pages/ExecutiveReport.test.tsx` — both already exist, no new dependency, no
  new test file needed.

**Interfaces:** none new — purely local component state, no prop/API changes.

- [ ] **Step 1: Write the failing tests**

In each of `apps/web/src/pages/TrainingTrack.test.tsx` and
`apps/web/src/pages/ExecutiveReport.test.tsx`, following the mocking pattern already used in
that file, add a test asserting: while the mocked `fetch` promise for the generate call is
unresolved, the button's accessible name is `"Generating…"` (not `"Generate track"` /
`"Generate report"`), and once it resolves the button's accessible name returns to the
original label. (The disabled-state assertion for this same window is not new coverage to
add here if the file already asserts it elsewhere — check first; this task only needs to add
label coverage.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/web -- TrainingTrack ExecutiveReport`
Expected: FAIL on the new label assertions only.

- [ ] **Step 3: Write minimal implementation**

In both `apps/web/src/pages/TrainingTrack.tsx` and `apps/web/src/pages/ExecutiveReport.tsx`,
change the generate button's children from the static label string to a conditional:
`{generating ? "Generating…" : "Generate track"}` (respectively `"Generate report"`). Keep
the existing `disabled={generating || ...}` and class list exactly as they are — both already
satisfy the disabled/dimmed part of this finding.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/web -- TrainingTrack ExecutiveReport`
Expected: PASS.

- [ ] **Step 5: Run the full frontend suite to check for regressions**

Run: `npm run test -w apps/web`
Expected: PASS, no regressions.

- [ ] **Step 6: Manual verification**

With the stack running, click "Generate track" / "Generate report" and confirm the button
visibly changes state for the duration of a real AI call, and that clicking it repeatedly
during generation does not fire multiple requests (check the Network tab).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/TrainingTrack.tsx apps/web/src/pages/ExecutiveReport.tsx
git commit -m "feat(web): show a generating state on the AI-generation buttons while a request is in flight"
```

(Include each page's test file in the `git add` above too.)

---

### Task 6: Render AI-generated Markdown as formatted content

**Problem:** Both the Training Track and Executive Report pages display the AI's Markdown
output (headings `##`, bold `**text**`, numbered lists, etc.) as literal, unrendered text in
the browser — `## Overview` appears on screen exactly as those four characters, not as a
heading. This makes the primary generated content harder to scan than it should be for a
tool meant for daily AppSec use, even though the same content already exports correctly via
the existing "Export Markdown" / "Export PDF" buttons (those clearly already understand it's
Markdown).

**Dependency decision (confirmed with the user, 2026-08-20):** `apps/web/package.json` has no
Markdown-rendering dependency today. Rather than add one (e.g. `react-markdown`), the user
chose a **hand-rolled minimal renderer, zero new dependencies** — scoped to exactly the
Markdown subset the two prompts actually ask the model to produce (headings `#`/`##`/`###`,
bold `**text**`, unordered lists `- `, ordered lists `1. `, plain paragraphs). This keeps
`package.json`'s dependency surface unchanged and the rendering logic small enough to read
in one sitting; it does not attempt to support Markdown syntax the prompts don't request
(tables, images, links, nested lists, code fences).

**Files:**
- Create: `apps/web/src/components/Markdown.tsx`
- Create: `apps/web/src/components/Markdown.test.tsx`
- Modify: `apps/web/src/pages/TrainingTrack.tsx` (each `module.content` string, in the
  `track.modules.map(...)` block)
- Modify: `apps/web/src/pages/ExecutiveReport.tsx` (each `report.content` string, in the
  `reports.map(...)` block — note the field is named `content` on `ExecutiveReportView`, not
  `report`)

**Interfaces:**
- Produces: `Markdown` component, exported from `apps/web/src/components/Markdown.tsx`,
  props `{ text: string }`, renders semantic HTML elements (`h1`–`h3`, `ul`/`ol`/`li`, `p`,
  `strong`) — no raw HTML pass-through of any kind, since it never uses
  `dangerouslySetInnerHTML`; every character of `text` either matches a recognized Markdown
  token or is rendered as plain text content, which React escapes automatically. This is
  what keeps this component safe even though its input is model-generated, not another
  user's input — same reasoning as `Steps to fix` note below.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/Markdown.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings as heading elements, not literal '#' text", () => {
    render(<Markdown text={"## Overview\n\nSome text."} />);
    expect(screen.getByRole("heading", { level: 2, name: "Overview" })).toBeInTheDocument();
  });

  it("renders bold text inside a strong element", () => {
    render(<Markdown text="This is **important** context." />);
    expect(screen.getByText("important").tagName).toBe("STRONG");
  });

  it("renders an unordered list as list items", () => {
    render(<Markdown text={"- First item\n- Second item"} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("First item")).toBeInTheDocument();
  });

  it("renders an ordered list (e.g. a reinforcement quiz) as list items", () => {
    render(<Markdown text={"1. What is XSS?\n2. What is CSRF?"} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("What is XSS?")).toBeInTheDocument();
  });

  it("does not interpret raw HTML in the input as markup", () => {
    render(<Markdown text={"<img src=x onerror=alert(1)>"} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/<img/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/web -- Markdown`
Expected: FAIL — `apps/web/src/components/Markdown.tsx` doesn't exist yet (import error).

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/Markdown.tsx`:

```tsx
import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

const LIST_ITEM = /^[-*] |^\d+\. /;

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const heading = /^(#{1,3}) (.*)/.exec(line);

    if (heading) {
      const level = heading[1].length;
      const Tag = (`h${level}` as unknown) as "h1" | "h2" | "h3";
      const classes = level === 1 ? "font-display text-xl font-bold text-ink" : level === 2 ? "font-display text-lg font-bold text-ink" : "font-display text-base font-bold text-ink";
      blocks.push(
        <Tag key={key++} className={classes}>
          {renderInline(heading[2])}
        </Tag>,
      );
      i++;
      continue;
    }

    if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items: string[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i])) {
        items.push(lines[i].replace(ordered ? /^\d+\. / : /^[-*] /, ""));
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key++} className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5 font-body text-[13px] text-ink`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3} |[-*] |\d+\. )/.test(lines[i])) {
      paragraphLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="font-body text-[13px] text-ink-muted">
        {renderInline(paragraphLines.join(" "))}
      </p>,
    );
  }

  return <>{blocks}</>;
}
```

Then in `apps/web/src/pages/TrainingTrack.tsx`, replace the existing
`<pre className="whitespace-pre-wrap font-body text-[13px] text-ink-body">{module.content}</pre>`
with `<Markdown text={module.content} />` (import `{ Markdown } from "../components/Markdown"`
— note the existing `<pre>` wrapper is what currently forces the raw-text rendering; remove
it, `Markdown` supplies its own element-level styling). Same substitution in
`apps/web/src/pages/ExecutiveReport.tsx`: replace
`<pre className="whitespace-pre-wrap font-body text-[13px] text-ink-body">{report.content}</pre>`
with `<Markdown text={report.content} />`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/web -- Markdown`
Expected: PASS (all 5 new tests, including the raw-HTML-is-not-markup one).

- [ ] **Step 5: Extend the page-level tests**

Add or extend one Testing Library test per page (`TrainingTrackPage`, `ExecutiveReportPage`)
asserting a `##` line in the mocked API response renders as a heading element (not literal
`##` text) after generation.

- [ ] **Step 6: Run the full frontend suite to check for regressions**

Run: `npm run test -w apps/web`
Expected: PASS, no regressions.

- [ ] **Step 7: Manual verification**

With the stack running, generate a Training Track and an Executive Report and visually
confirm headings, bold text, and lists render as formatted content, and that
"Export Markdown" / "Export PDF" still produce correct, unchanged output (they read the same
raw string this task doesn't modify).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/Markdown.tsx apps/web/src/components/Markdown.test.tsx apps/web/src/pages/TrainingTrack.tsx apps/web/src/pages/ExecutiveReport.tsx
git commit -m "feat(web): render AI-generated Markdown as formatted content instead of raw text"
```

(Include each page's test file in the `git add` above too, if extended.)

### Where to resume

Tasks 1–3 are **done**: implemented, committed, and manually verified live against a real
rebuilt image (see "What's already tested and confirmed working" above) — do not redo that
work or re-litigate those three fixes. The branch `worktree-qa-session-bugfixes` (currently
at commit `20dfed6` for code / `e5a3ba9` for this doc) already has everything needed to build
and manually re-verify: `docker compose -p sec-champs-trail up --build -d` from the worktree
directory reuses the existing `sec-champs-trail_championforge-db` volume, so prior test data
(the `QA Test Team` / `qa.champion@example.com` champion created during this QA pass) is
still there.

**Status (2026-08-20, this session):** `superpowers:brainstorming` was run for Finding #4 as
required; see "Brainstorming outcome" above for the four options weighed and why the chosen
one doesn't expand the app's trust surface. Finding #4 is now written up as **Task 4** (full
TDD steps, in the same format as Tasks 1–3). A second, small decision (whether Task 6 may add
a Markdown-rendering npm dependency) was also confirmed with the user — see "Dependency
decision" under Task 6 — and Findings #5/#6 are likewise now written up as **Task 5** and
**Task 6** in the same checkbox format. Nothing has been implemented yet in this session.

**Start the next session here:**

1. Execute Task 4, Task 5, and Task 6 above via `superpowers:subagent-driven-development`, in
   that order — Task 4 first regardless, since it's the only one of the three with real
   functional (not cosmetic/UX) impact, and Tasks 5/6 both touch the same two page components
   Task 4's fix makes reliable.
2. Run this plan's "Final verification (after all 3 tasks)" checklist again against a fresh
   rebuild once Tasks 4–6 are done, extended to also confirm: the executive report and
   training track pages show a generating state during a real AI call (Task 5) and render
   Markdown as formatted content, not raw text (Task 6).

---

## Second follow-up QA verification session (2026-08-21, after Tasks 4–6 were implemented)

**Context:** Tasks 4, 5, and 6 above were implemented and committed on branch
`worktree-qa-session-bugfixes` (commits `bdb57da`, `10934d0`, `5e21764`, plus review-fixup
commit `ff2f417`). A further QA pass was run against a **Docker image rebuilt from this
branch** (`docker compose -p sec-champs-trail up --build -d` from the worktree directory —
the container that was already running had been left on a stale image pulled from
`ghcr.io/kbcasurf/sec-champs-trail:latest`, predating even Task 1), against real Postgres
data (reusing the existing `sec-champs-trail_championforge-db` volume, plus a freshly created
`Red Team QA` team / `redteam.champion@example.com` champion), and real Anthropic API calls,
driven live via Playwright MCP browser automation (not `claude-in-chrome` this time) so
results could be watched in real time, covering both the admin and champion roles.

### What's already tested and confirmed working — do not redo this

- **Task 1**: Training Track and Executive Report both generated successfully
  (`201 Created`) across multiple runs, as both admin and champion — no `502` observed.
- **Task 2**: Unknown route renders the "Page not found" page with a working
  "Go to dashboard" link.
- **Task 3**: A champion navigating directly to `/teams` or `/executive-reports` is
  redirected to `/dashboard` before any admin UI renders.
- **Task 4**: No `502` / "AI response did not contain a valid ..." errors across repeated
  Executive Report and Training Track generations in this session (consistent with the fix,
  though this session did not specifically force the raw-control-character edge case the way
  the original `curl` reproduction did).
- **Task 5**: Both "Generate track" and "Generate report" buttons show a disabled
  `"Generating…"` label for the duration of the AI call.
- **Task 6**: Headings, bold text, and lists in AI-generated content all render as real HTML
  elements, not raw Markdown syntax.
- Full non-AI flows exercised without incident: admin login/logout, an invalid-password login
  attempt (clean `401` + "Invalid credentials" message, no crash), Teams admin (create team,
  create champion), champion login, the 10-question maturity assessment (submission + radar
  chart), Checklist Library (checkbox toggling persists via `PATCH
  .../checklist-progress/:id`, `200`), Action Plan generation (correctly reflects checklist
  progress), Export Markdown on both the Training Track and Executive Report pages. No
  unexpected browser console errors were observed anywhere in the session — only the
  pre-existing, already-documented `401`/`404` noise before login / before an assessment or
  action plan exists.
- **New findings surfaced by this pass, not yet fixed — see below.**

### New Finding #7 (Minor, cosmetic/completeness) — the Markdown renderer doesn't handle horizontal rules or tables

**Reproduction:** Generated two Executive Reports as admin. Both prompts produce `---` as a
section separator between team-level analyses, and the model occasionally formats a
per-principle score breakdown as a GFM pipe table (observed in one of the two generations in
this session) instead of a list.

**Confirmed root cause:** `apps/web/src/components/Markdown.tsx`'s block-level scanner (lines
17–72) only recognizes three block types — a heading (`^(#{1,3}) `), a list item (`^[-*] |
^\d+\. `), and a blank line — before falling through to its generic paragraph branch (lines
62–71). A line consisting of just `---` doesn't match any of the three, so it falls into the
paragraph branch and renders as the literal three-character string `---`, not an `<hr>`. Same
mechanism for a table row starting with `| Dimension | Score |`: it doesn't match the heading
or list regexes either, so it renders as one long literal paragraph of pipe-delimited text
instead of an HTML table. This isn't a regression in Task 6's implementation — Task 6's own
"Dependency decision" explicitly scoped the hand-rolled renderer to only "the Markdown subset
the two prompts actually ask the model to produce (headings, bold, lists)" and named tables as
one of the syntaxes deliberately left unsupported — but the prompts themselves don't instruct
the model to avoid `---` or tables, so the model reaches for both anyway in practice, which is
exactly what happened in this session.

**Suggested next step:** Decide (with the user, since it's the same kind of scope/dependency
call Task 6 already made once) between: (a) extending the hand-rolled parser with a horizontal
rule case and a minimal pipe-table case, keeping the zero-new-dependency approach; or (b)
tightening `buildExecutiveReportPrompt()` / the training-track prompt to explicitly forbid
`---` and tables, steering the model toward the syntax the renderer already supports. Not
implemented in this session — this is a finding, not a fix.

### New Finding #8 (Medium, data integrity/UX) — Teams admin allows creating multiple teams with the identical name

**Reproduction:** On `/teams` as admin, created a team named "Red Team QA", then submitted
the "New team" form again with the exact same name. Both requests returned `201 Created`
(`POST /api/teams`), and the team list on the left then showed **two** buttons both labeled
"Red Team QA", with no visible distinguishing detail (no ID, no creation date) to tell them
apart before clicking into one.

**Confirmed root cause:** `apps/api/src/teams/teams.service.ts:8-11`'s `create(name)` calls
`this.prisma.team.create(...)` directly with no pre-check for an existing team with the same
`name` in the organization. `apps/api/prisma/schema.prisma:47-61`'s `Team` model has no
`@@unique` constraint on `name` (or on `[organizationId, name]`) to reject it at the database
level either — only a plain `@@index([organizationId])`. So nothing in the stack, from the UI
down to the schema, currently prevents this.

**Suggested next step:** Add a `@@unique([organizationId, name])` constraint at the schema
level (new migration) and surface the resulting conflict as a `409`/validation error in
`TeamsService.create()` / `TeamsController`, with a clear inline message in the "New team"
form — the same pattern already used for the empty-name case (`apps/web` already shows "Could
not create team." on a `400`). Not implemented in this session — this is a finding, not a fix.

### New Finding #9 (Minor, i18n/polish) — a Portuguese string on an otherwise all-English UI

**Reproduction:** The label directly under the "Generate track" / "Generate report" button,
and the same label repeated in the exported Markdown's attribution line and on both print
pages, all read **"Conteúdo gerado por IA"** (Portuguese for "Content generated by AI"), while
every other string in the app — nav labels, form fields, empty states, error messages — is in
English.

**Confirmed locations:** `apps/web/src/pages/TrainingTrack.tsx:148` (on-screen label) and
`:160` (Export Markdown attribution line); `apps/web/src/pages/ExecutiveReport.tsx:95` and
`:102` (same two spots); `apps/web/src/pages/TrainingTrackPrint.tsx:41`; and
`apps/web/src/pages/ExecutiveReportPrint.tsx:30`. All five occurrences are the same literal
string, so this looks like one label that was written in Portuguese from the start (not a
one-off typo introduced later) and never translated when the rest of the app's copy was
written in English.

**Suggested next step:** Replace all five occurrences with an English equivalent (e.g.
"AI-generated content"), matching the rest of the app's copy. A small, mechanical
find-and-replace across the five files above — no design or product decision needed. Not
implemented in this session — this is a finding, not a fix.

### Operational note (not a bug) — the print routes' native `window.print()` blocks CDP-driven browser automation

Navigating to `/training-tracks/:id/print` or `/executive-reports/:id/print` triggers the
browser's native `window.print()` call immediately on load — correct, expected behavior for a
real user (already confirmed in the first follow-up session above), but when the browser is
being driven over CDP (as both Playwright MCP and `claude-in-chrome` do), the native print
dialog fully blocks the automation connection: every subsequent tool call — including
navigating away, taking a snapshot, listing tabs, and even closing the tab — hung until a
human manually dismissed the print dialog from outside the automation session. This cost real
time in this session and will do so again for any future live-browser QA pass, and would
break a headless CI run outright. Not a defect in the app — a real user's print dialog is
supposed to appear — but worth flagging so a future automated E2E suite covering these two
routes stubs/mocks `window.print` (e.g. `vi.spyOn(window, "print").mockImplementation(() =>
{})`) rather than driving them via a live, real browser session the way the rest of this
plan's manual verification steps do.

### Where to resume (updated 2026-08-21)

Tasks 1–6 are now all **done and manually verified live** (see both "What's already tested and
confirmed working" sections above). Findings #7, #8, and #9 above are newly surfaced,
confirmed by reading the actual code (not guessed at), and **not yet fixed or written up as
formal TDD tasks** — that write-up (spec, files, test steps, and for #7 specifically a
brainstorming pass on the same scope/dependency question Task 6 already raised once) is the
next session's starting point, the same way Findings #4–#6 were written up as Tasks 4–6 before
being implemented.
