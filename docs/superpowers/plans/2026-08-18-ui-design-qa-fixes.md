# UI design QA fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 confirmed UI bugs and add 1 polish improvement found by an `/hm-designer`
runtime QA pass against the already-shipped design system (ADR 0003) — cropped radar chart
text, an invisible sticky-footer scrim, missing "no team selected" empty states in 4 places,
a missing favicon, and a mobile hamburger menu.

**Architecture:** Pure frontend (`apps/web`), no API changes. One new shared component
(`EmptyState`) reused in 4 pages; 3 small, surgical fixes in existing files (radar tick
wrap, sticky footer classes, mobile nav toggle); one new static asset (favicon).

**Tech Stack:** React 18 + TypeScript, Tailwind CSS (existing token set from ADR 0003 — no
new tokens needed), Recharts (already a dependency), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-18-ui-design-qa-fixes-design.md`

## Global Constraints

- Zero changes to `apps/api` — this is a presentation-only fix set (spec section 2).
- Do not change the "nothing loads until a team is selected" data-flow behavior — it's
  intentional and covered by existing tests (spec section 2).
- Do not touch `ChecklistLibrary.tsx`'s `max-w-[820px]` — deliberate readability choice, not
  a bug (spec section 2).
- Do not revert or duplicate anything already fixed by the ADR 0003 amendment (mobile
  `flex-wrap` on the header, `title` attribute on the Dashboard "Snapshot" panel, the
  admin team-selector on Checklist/ActionPlan, `color-scheme: dark`) — spec section 1.
- Reuse existing Tailwind tokens only (`bg`, `bg-elevated`, `surface`, `line`, `ink*`,
  `accent*` — see `apps/web/tailwind.config.js`). No new colors.
- `ProtectedRoute.tsx`'s nav must remain a single DOM instance (not duplicated for
  mobile/desktop) — spec section 3, avoids breaking `ProtectedRoute.test.tsx`'s
  `getByRole("link", { name: /teams/i })`.
- Run `npm run typecheck -w apps/web`, `npm run lint -w apps/web`, and
  `npm run test -w apps/web` after every task; all three must be clean before moving on.

---

### Task 1: `EmptyState` shared component

**Files:**
- Create: `apps/web/src/components/EmptyState.tsx`
- Create: `apps/web/src/components/EmptyState.test.tsx`

**Interfaces:**
- Produces: `EmptyState` React component, props
  `{ title: string; description?: string; action?: { label: string; to: string } }`,
  default export none (named export `EmptyState`). Tasks 4-7 import it as
  `import { EmptyState } from "../components/EmptyState";`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/EmptyState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title and optional description", () => {
    render(<EmptyState title="Select a team" description="Pick one from the dropdown above." />);
    expect(screen.getByText("Select a team")).toBeInTheDocument();
    expect(screen.getByText("Pick one from the dropdown above.")).toBeInTheDocument();
  });

  it("renders no action link when none is provided", () => {
    render(<EmptyState title="Select a team" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders an action link when provided", () => {
    render(
      <MemoryRouter>
        <EmptyState title="Select a team" action={{ label: "View teams", to: "/teams" }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "View teams" })).toHaveAttribute("href", "/teams");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- EmptyState`
Expected: FAIL — `Cannot find module './EmptyState'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/components/EmptyState.tsx`:

```tsx
import { Link } from "react-router-dom";

interface EmptyStateAction {
  label: string;
  to: string;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-8 py-14 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-muted opacity-50">
        <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" />
      </svg>
      <p className="font-mono text-sm text-ink-muted">{title}</p>
      {description && <p className="font-body text-xs text-ink-muted-2">{description}</p>}
      {action && (
        <Link
          to={action.to}
          className="mt-1 rounded-lg border border-line px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-ink-body hover:border-ink-muted-2 hover:text-ink"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- EmptyState`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/EmptyState.tsx apps/web/src/components/EmptyState.test.tsx
git commit -m "feat(web): add reusable EmptyState component"
```

---

### Task 2: Fix cropped radar chart labels (`Dashboard.tsx`)

**Files:**
- Modify: `apps/web/src/pages/Dashboard.tsx:1-19` (imports + `AxisTick`), `:142-150`
  (`RadarChart`/`ResponsiveContainer` props)
- Test: `apps/web/src/pages/Dashboard.test.tsx` (add a new `describe` block for `wrapLabel`)

**Interfaces:**
- Produces: `wrapLabel(text: string, maxCharsPerLine?: number): string[]`, exported from
  `Dashboard.tsx`. Greedy word-wrap; never splits a word; default `maxCharsPerLine` is 18.

- [ ] **Step 1: Write the failing test**

Add to the bottom of `apps/web/src/pages/Dashboard.test.tsx` (new import needed at top:
`import { wrapLabel } from "./Dashboard";`, alongside the existing `Dashboard` import):

```tsx
describe("wrapLabel", () => {
  it("wraps a long principle title without cutting words, in 3 lines or fewer", () => {
    const lines = wrapLabel("Start with a clear vision for your program");
    expect(lines.join(" ")).toBe("Start with a clear vision for your program");
    expect(lines.length).toBeLessThanOrEqual(3);
    lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(18));
  });

  it("keeps a short title on a single line", () => {
    expect(wrapLabel("Create a community")).toEqual(["Create a community"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- Dashboard`
Expected: FAIL — `wrapLabel` is not exported from `./Dashboard` (TS error / undefined import).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/pages/Dashboard.tsx`, replace lines 1-19 (imports through the `AxisTick`
function) with:

```tsx
import { useEffect, useState } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export function wrapLabel(text: string, maxCharsPerLine = 18): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface AxisTickProps {
  x?: number;
  y?: number;
  textAnchor?: "inherit" | "start" | "middle" | "end";
  payload?: { value: string };
}

function AxisTick({ x, y, payload, textAnchor }: AxisTickProps) {
  const lines = wrapLabel(payload?.value ?? "");
  const lineHeight = 12;
  const startDy = -((lines.length - 1) / 2) * lineHeight;
  return (
    <text x={x} y={y} textAnchor={textAnchor} fontFamily="'IBM Plex Mono', ui-monospace, monospace" fontSize={10.5} fill="#7d8798">
      {lines.map((line, i) => (
        <tspan key={line} x={x} dy={i === 0 ? startDy : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}
```

Then, in the same file, find the `RadarChart` block (originally around line 142-150) and
replace:

```tsx
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={scores.map((s) => ({ principle: s.principle.title, score: s.score }))} outerRadius="70%">
```

with:

```tsx
            <ResponsiveContainer width="100%" height={420}>
              <RadarChart
                data={scores.map((s) => ({ principle: s.principle.title, score: s.score }))}
                outerRadius="60%"
                margin={{ top: 28, right: 84, bottom: 28, left: 84 }}
              >
```

(The rest of the `RadarChart` children — `PolarGrid`, `PolarAngleAxis`, `PolarRadiusAxis`,
`Radar`, `Tooltip` — are unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- Dashboard`
Expected: PASS (all Dashboard tests, including the 2 new `wrapLabel` cases).

- [ ] **Step 5: Manual visual check**

With the stack running (`docker compose up --build`, or `npm run dev -w apps/web` against
a running API), log in as admin, go to `/dashboard`, select a team with a submitted
assessment, and confirm the "Start with a clear vision for your program" label (or
whichever principle has the longest title) wraps onto multiple lines with no character
cut off.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Dashboard.tsx apps/web/src/pages/Dashboard.test.tsx
git commit -m "fix(web): wrap long radar chart labels instead of cropping them"
```

---

### Task 3: Fix the invisible sticky submit-bar scrim (`AssessmentForm.tsx`)

**Files:**
- Modify: `apps/web/src/pages/AssessmentForm.tsx:126`

**Interfaces:**
- Consumes: none new.
- Produces: none new (pure CSS class change, no prop/behavior change).

- [ ] **Step 1: Write the failing test**

No new automated test — this is a visual-only className change with no observable DOM
structure/behavior change that Testing Library (jsdom, no real CSS engine) can assert on.
Verification is manual (Step 3). `AssessmentForm.test.tsx` already exercises the submit
button's functional behavior and must keep passing unmodified — that's this task's
regression check.

Run: `npm run test -w apps/web -- AssessmentForm`
Expected: PASS (baseline, before the change — confirms the existing test suite is green
before you touch the file).

- [ ] **Step 2: Make the change**

In `apps/web/src/pages/AssessmentForm.tsx`, replace line 126:

```tsx
      <div className="sticky bottom-0 mt-6 bg-gradient-to-t from-bg from-60% pb-1 pt-4">
```

with:

```tsx
      <div className="sticky bottom-0 z-10 mt-6 border-t border-line bg-bg/95 pb-1 pt-4 backdrop-blur">
```

(No other lines in this block change — the `<button type="submit" ...>` stays exactly as
is.)

- [ ] **Step 3: Run test to verify nothing broke**

Run: `npm run test -w apps/web -- AssessmentForm`
Expected: PASS (same as Step 1 — this change is CSS-only).

- [ ] **Step 4: Manual visual check**

With the stack running, log in, go to `/assessment/new`, answer 1 of the 10 questions,
scroll down, and confirm the "Submit assessment" bar now has a visible top border and a
blurred/translucent panel behind it — no card content should appear to touch or slide
under the button without a visual seam.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/AssessmentForm.tsx
git commit -m "fix(web): give the sticky submit bar a visible scrim instead of an invisible gradient"
```

---

### Task 4: Empty state on `Dashboard.tsx` before a team is selected

**Files:**
- Modify: `apps/web/src/pages/Dashboard.tsx` (render logic only — imports/`AxisTick`
  already changed by Task 2)
- Test: `apps/web/src/pages/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `EmptyState` from Task 1 (`../components/EmptyState`).

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/pages/Dashboard.test.tsx`, inside the existing
`describe("Dashboard page", ...)` block, as a new `it`:

```tsx
  it("shows an empty state before an admin selects a team", async () => {
    mockFetchFor("admin");
    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>,
    );

    expect(await screen.findByText(/select a team/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- Dashboard`
Expected: FAIL — no text matching `/select a team/i` in the document (the current page
renders nothing when `teamId` is `null`).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/pages/Dashboard.tsx`, add the import (alongside the existing ones):

```tsx
import { EmptyState } from "../components/EmptyState";
```

Then find this block (originally around line 125-135):

```tsx
      {error && (
        <div className="rounded-2xl border border-line bg-surface p-16 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-ink-muted opacity-50">
            <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" />
            <path d="M12 8v8M8 12h8" opacity="0.5" />
          </svg>
          <p role="alert" className="font-body text-[13.5px] text-ink-body">
            {error}
          </p>
        </div>
      )}
```

and add a new branch immediately after it (before the `{scores && (...)}` block):

```tsx
      {!error && !scores && user?.role === "admin" && !teamId && (
        <EmptyState
          title="Select a team to view its maturity dashboard"
          description="Pick a team from the dropdown above to see its radar chart and score breakdown."
        />
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- Dashboard`
Expected: PASS (all Dashboard tests, including the new empty-state case).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Dashboard.tsx apps/web/src/pages/Dashboard.test.tsx
git commit -m "fix(web): show an empty state on Dashboard before a team is selected"
```

---

### Task 5: Empty state on `ChecklistLibrary.tsx` before a team is selected

**Files:**
- Modify: `apps/web/src/pages/ChecklistLibrary.tsx`
- Test: `apps/web/src/pages/ChecklistLibrary.test.tsx`

**Interfaces:**
- Consumes: `EmptyState` from Task 1.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/pages/ChecklistLibrary.test.tsx`, in the existing test
`"shows a team selector for admins and loads the selected team's checklist"`, add one line
right after the existing `expect(screen.queryByRole("heading", { name: "Recruitment" })).not.toBeInTheDocument();`:

```tsx
    expect(screen.getByText(/select a team/i)).toBeInTheDocument();
```

(The full `it` block's relevant portion now reads:)

```tsx
    const select = await screen.findByRole("combobox");
    expect(await screen.findByText("Payments")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recruitment" })).not.toBeInTheDocument();
    expect(screen.getByText(/select a team/i)).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "team-1" } });

    expect(await screen.findByRole("heading", { name: "Recruitment" })).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- ChecklistLibrary`
Expected: FAIL — no text matching `/select a team/i` (only the `<select>`'s own "Select a
team" `<option>` exists today, which is inside a closed dropdown and not matched by
`getByText` the same way visible body text is — confirm this by running the test and
reading the actual failure before proceeding).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/pages/ChecklistLibrary.tsx`, add the import:

```tsx
import { EmptyState } from "../components/EmptyState";
```

Find the existing error block:

```tsx
      {error && (
        <p role="alert" className="mb-4 font-body text-[12.5px] text-danger">
          {error}
        </p>
      )}
```

and add a new branch immediately after it (before `{PHASES.map(...)}`):

```tsx
      {!error && !teamId && user?.role === "admin" && (
        <EmptyState
          title="Select a team to view its checklist progress"
          description="Pick a team from the dropdown above to see recruitment and retention checklist items."
        />
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- ChecklistLibrary`
Expected: PASS (all ChecklistLibrary tests, including the extended one).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/ChecklistLibrary.tsx apps/web/src/pages/ChecklistLibrary.test.tsx
git commit -m "fix(web): show an empty state on Checklist before a team is selected"
```

---

### Task 6: Empty state on `ActionPlan.tsx` before a team is selected

**Files:**
- Modify: `apps/web/src/pages/ActionPlan.tsx`
- Test: `apps/web/src/pages/ActionPlan.test.tsx`

**Interfaces:**
- Consumes: `EmptyState` from Task 1.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/pages/ActionPlan.test.tsx`, in the existing test
`"shows a team selector for admins and disables generation until a team is chosen"`, add one
line right after `expect(generateButton).toBeDisabled();`:

```tsx
    expect(screen.getByText(/select a team/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- ActionPlan`
Expected: FAIL — no visible text matching `/select a team/i` in the rendered page body.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/pages/ActionPlan.tsx`, add the import:

```tsx
import { EmptyState } from "../components/EmptyState";
```

Find the existing error block:

```tsx
      {error && (
        <p role="alert" className="mb-4 rounded-2xl border border-line bg-surface p-16 text-center font-body text-[13.5px] text-ink-body">
          {error}
        </p>
      )}
```

and add a new branch immediately after it (before `{plan && (...)}`):

```tsx
      {!error && !plan && !teamId && user?.role === "admin" && (
        <EmptyState
          title="Select a team to view its action plan"
          description="Pick a team from the dropdown above, then generate a plan from its latest assessment."
        />
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- ActionPlan`
Expected: PASS (all ActionPlan tests, including the extended one).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/ActionPlan.tsx apps/web/src/pages/ActionPlan.test.tsx
git commit -m "fix(web): show an empty state on Action Plan before a team is selected"
```

---

### Task 7: Empty state on `TeamsAdmin.tsx` right column before a team is selected

**Files:**
- Modify: `apps/web/src/pages/TeamsAdmin.tsx`
- Test: `apps/web/src/pages/TeamsAdmin.test.tsx`

**Interfaces:**
- Consumes: `EmptyState` from Task 1.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/pages/TeamsAdmin.test.tsx`, inside the existing
`describe("TeamsAdmin page", ...)` block, as a new `it` (before or after the existing two):

```tsx
  it("shows an empty state in the right column before a team is selected", async () => {
    mockFetch();
    render(
      <AuthProvider>
        <TeamsAdmin />
      </AuthProvider>,
    );

    await screen.findByRole("button", { name: "Payments" });
    expect(screen.getByText(/select a team/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- TeamsAdmin`
Expected: FAIL — no text matching `/select a team/i` (the right column renders nothing
before a team is clicked).

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/pages/TeamsAdmin.tsx`, add the import:

```tsx
import { EmptyState } from "../components/EmptyState";
```

Find the closing of the left column and the start of the conditional right column
(originally around line 125-127):

```tsx
        </div>

        {selected && (
          <div className="rounded-2xl border border-line bg-surface p-5.5">
```

Change the `{selected && (...)}` block to an `if/else` render via ternary — replace
`{selected && (` with `{selected ? (` and, right after that whole conditional block's
closing `)}` (originally line 188, right after the "Add champion" `</form>` and the
`</div>` that closes the `selected` panel), add the `: (...)` else-branch. Concretely, the
full replacement for lines 127-189 (from `{selected && (` through the matching `)}`) is:

```tsx
        {selected ? (
          <div className="rounded-2xl border border-line bg-surface p-5.5">
            <h2 className="mb-4.5 font-display text-[17px] font-bold text-ink">{selected.name}</h2>

            {selected.champions.length > 0 ? (
              <ul className="mb-5.5 flex flex-col gap-2">
                {selected.champions.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-bg-elevated px-3 py-2.5">
                    <span className="flex h-6.5 w-6.5 flex-none items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] font-semibold text-ink-muted">
                      {c.email.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex-1 font-mono text-[12.5px] text-ink-body">{c.email}</span>
                    <span className="flex-none rounded border border-accent-border bg-accent-soft px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-accent">
                      {c.role}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5.5 rounded-lg border border-dashed border-line py-3.5 text-center font-body text-[12.5px] text-ink-muted-2">
                No champions on this team yet.
              </p>
            )}

            <h2 className="mb-1 font-display text-[14.5px] font-semibold text-ink">Add champion to {selected.name}</h2>
            <p className="mb-3 font-body text-xs text-ink-muted">Assigns a new champion account to this team.</p>
            <form onSubmit={handleCreateChampion} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2.5">
              <div>
                <label htmlFor="champion-email" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wide text-ink-muted">
                  Email
                </label>
                <input
                  id="champion-email"
                  type="email"
                  value={newChampionEmail}
                  onChange={(e) => setNewChampionEmail(e.target.value)}
                  placeholder="name@org.com"
                  className="w-full rounded-lg border border-line bg-bg-elevated px-2.5 py-2 font-body text-[13px] text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
                />
              </div>
              <div>
                <label htmlFor="champion-password" className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-wide text-ink-muted">
                  Password
                </label>
                <input
                  id="champion-password"
                  type="password"
                  value={newChampionPassword}
                  onChange={(e) => setNewChampionPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-line bg-bg-elevated px-2.5 py-2 font-body text-[13px] text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
                />
              </div>
              <button
                type="submit"
                className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 font-mono text-[11.5px] font-semibold uppercase tracking-wide text-accent-text hover:bg-accent-hover"
              >
                Add champion
              </button>
            </form>
          </div>
        ) : (
          <EmptyState
            title="Select a team to view its champions"
            description="Pick a team from the list on the left, or create a new one above it."
          />
        )}
```

(Everything else in the file — the left column, `handleCreateTeam`, `handleSelectTeam`,
`handleCreateChampion`, state declarations — is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- TeamsAdmin`
Expected: PASS (all TeamsAdmin tests, including the new empty-state case).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/TeamsAdmin.tsx apps/web/src/pages/TeamsAdmin.test.tsx
git commit -m "fix(web): show an empty state on Teams' right column before a team is selected"
```

---

### Task 8: Add a favicon

**Files:**
- Create: `apps/web/public/favicon.svg`
- Modify: `apps/web/index.html`

**Interfaces:** none (static asset).

- [ ] **Step 1: Create the favicon asset**

Create `apps/web/public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill="#0a0d12" stroke="#f97316" stroke-width="1.8"/>
  <circle cx="12" cy="12" r="2.1" fill="#f97316"/>
</svg>
```

(No Vite config change needed — `apps/web/vite.config.ts` has no `publicDir` override, so
the default `public/` directory is served at `/` in dev and copied into `dist/` on build.)

- [ ] **Step 2: Reference it from `index.html`**

In `apps/web/index.html`, add a line right after `<title>ChampionForge</title>`:

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

- [ ] **Step 3: Verify**

Run: `npm run dev -w apps/web` (or `docker compose up --build`), open the app in a
browser, and confirm the browser tab shows the hexagon icon and the console no longer logs
a `favicon.ico` 404.

There is no automated test for this step — favicon presence isn't observable via
Testing Library/jsdom.

- [ ] **Step 4: Commit**

```bash
git add apps/web/public/favicon.svg apps/web/index.html
git commit -m "fix(web): add a favicon based on the existing brand mark"
```

---

### Task 9: Mobile hamburger menu (`ProtectedRoute.tsx`)

**Files:**
- Modify: `apps/web/src/auth/ProtectedRoute.tsx`

**Interfaces:** none new (internal component state only).

- [ ] **Step 1: Run the existing test to confirm the baseline is green**

Run: `npm run test -w apps/web -- ProtectedRoute`
Expected: PASS (3/3, before any change — this is the regression check for this task,
since the fix must keep every link/button as a single DOM instance; see spec section 3).

- [ ] **Step 2: Replace the header markup**

In `apps/web/src/auth/ProtectedRoute.tsx`, change the import line (originally line 1) from:

```tsx
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
```

to:

```tsx
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
```

Then replace the whole `export function ProtectedRoute() { ... }` body (originally lines
52-116) with:

```tsx
export function ProtectedRoute() {
  const { user, loading, setUser } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return <p className="p-6 font-mono text-sm text-ink-muted">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-bg-elevated px-4 py-3 sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" stroke="#f97316" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="1.6" fill="#f97316" />
            </svg>
            <span className="font-display text-[17px] font-bold tracking-tight text-ink">
              Champion<span className="text-accent">Forge</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex items-center justify-center rounded-md border border-line p-2 text-ink-muted hover:border-ink-muted-2 hover:text-ink md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <div
            className={`${menuOpen ? "flex" : "hidden"} w-full flex-col gap-3 md:flex md:w-auto md:flex-1 md:flex-row md:items-center md:gap-x-8 md:gap-y-3`}
          >
            <nav className="flex flex-col gap-1 md:flex-1 md:flex-row md:flex-wrap md:items-center">
              {NAV_LINKS.filter((l) => !l.adminOnly || user.role === "admin").map((l) => {
                const active = location.pathname === l.to;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={closeMenu}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-2 font-mono text-xs font-medium uppercase tracking-wide ${
                      active
                        ? "border-accent-border bg-accent-soft text-accent"
                        : "border-transparent text-ink-muted hover:bg-surface-hover hover:text-ink"
                    }`}
                  >
                    {NAV_ICONS[l.to]}
                    {l.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex flex-wrap items-center gap-3.5 border-t border-line pt-3 md:border-t-0 md:pt-0">
              <span className="rounded border border-accent-border bg-accent-soft px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                {user.role}
              </span>
              <span className="font-mono text-xs text-ink-body">{user.email}</span>
              <button
                onClick={() => {
                  closeMenu();
                  handleLogout();
                }}
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 font-mono text-xs text-ink-muted hover:border-ink-muted-2 hover:bg-surface-hover hover:text-ink"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
```

(`NAV_ICONS` and `NAV_LINKS` above the component, lines 5-50 in the original file, are
unchanged.)

- [ ] **Step 3: Run test to verify nothing broke**

Run: `npm run test -w apps/web -- ProtectedRoute`
Expected: PASS (3/3) — confirms the single-instance nav didn't break `getByRole` queries.

- [ ] **Step 4: Manual visual check**

With the stack running, resize the browser (or use device emulation) to 390×844, log in,
and confirm: the header shows only the logo and a hamburger button at first; tapping the
hamburger reveals nav links, role badge, email, and log-out stacked vertically below the
header; tapping a nav link both navigates and closes the menu; at desktop width (≥768px)
the hamburger button is hidden and the full horizontal nav is always visible, matching the
pre-existing desktop appearance exactly.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth/ProtectedRoute.tsx
git commit -m "feat(web): collapse header nav behind a hamburger menu on mobile"
```

---

### Task 10: Document this round of fixes as a second ADR 0003 amendment

**Files:**
- Modify: `docs/adr/0003-application-design-system.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Append the amendment**

At the end of `docs/adr/0003-application-design-system.md` (after the existing "Amendment
— runtime QA fixes (2026-08-18)" section), add:

```markdown

## Amendment 2 — `/hm-designer` design QA fixes (2026-08-18)

A second QA pass, this time against the design *quality* bar (not just functional
correctness) rather than a fresh runtime walkthrough, found 4 further defects plus one
polish improvement. Full analysis in
`docs/superpowers/specs/2026-08-18-ui-design-qa-fixes-design.md`; implemented via
`docs/superpowers/plans/2026-08-18-ui-design-qa-fixes.md`.

- **Radar chart principle labels were cropped mid-word.** `Dashboard.tsx`'s `AxisTick`
  rendered each label as a single-line SVG `<text>`; the longest principle title ("Start
  with a clear vision for your program") overflowed the card and was clipped to "...your
  prog". Fixed with a new exported `wrapLabel()` greedy word-wrap helper (never splits a
  word) rendering up to 3 `<tspan>` lines, plus increased `RadarChart` margin/reduced
  `outerRadius` to give the wrapped labels room.
- **The sticky "Submit assessment" bar had an invisible scrim.**
  `AssessmentForm.tsx`'s sticky footer used `bg-gradient-to-t from-bg from-60%` — `from-bg`
  is the exact same color as the page's own background, so the "gradient" never produced
  any visible separation from content scrolling underneath. Fixed by replacing it with
  `border-t border-line bg-bg/95 backdrop-blur`, giving the bar an actual visible seam and
  a translucent, blurred panel.
- **"No team selected" was a blank rectangle, not a designed state.** `Dashboard`,
  `ChecklistLibrary`, `ActionPlan` (main content) and `TeamsAdmin` (right column) all had
  render branches for the error and loaded-data cases, but none for the initial
  `teamId === null` state an admin sees before picking a team from the selector. Fixed
  with a new shared `EmptyState` component (`apps/web/src/components/EmptyState.tsx`,
  reusing the same hexagon brand mark as the header/login), used in all 4 places.
- **No favicon.** `apps/web/index.html` had no `<link rel="icon">` and there was no
  `apps/web/public/` directory, causing a 404 on every page load. Fixed with a new
  `apps/web/public/favicon.svg` reusing the existing hexagon brand mark, referenced from
  `index.html`.
- **Mobile header hamburger menu (polish, not a regression fix).** The first amendment's
  `flex-wrap` fix eliminated horizontal overflow but still let nav links, role badge,
  email, and log-out stack into ~230px of header height on narrow viewports.
  `ProtectedRoute.tsx` now collapses that content behind a hamburger toggle below the `md`
  breakpoint, reusing the same nav/user-info DOM (not a duplicate) so the desktop
  appearance and `ProtectedRoute.test.tsx` are both unaffected.

Tested via `npm run test -w apps/web` (all pre-existing tests plus new/extended cases for
`EmptyState`, `wrapLabel`, and the 4 empty-state usages), `tsc -b`, `eslint apps/web/src`,
and a `docker compose up --build` cycle with a manual walkthrough at both desktop and
390×844 viewport widths.
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/0003-application-design-system.md
git commit -m "docs: record second ADR 0003 amendment for design QA fixes"
```

---

## Final verification (after all 10 tasks)

- [ ] Run `npm run typecheck -w apps/web` — expect no errors.
- [ ] Run `npm run lint -w apps/web` — expect no errors.
- [ ] Run `npm run test -w apps/web` — expect all tests passing (18 pre-existing + 2 from
      Task 1 + 2 from Task 2 + 1 each from Tasks 4-7 = 27 total; re-count against the
      actual suite output rather than trusting this number blindly).
- [ ] Run `docker compose up --build` and manually walk through: Dashboard/Checklist/
      Action Plan/Teams with no team selected (empty state visible in all 4), Dashboard
      radar chart with an assessment submitted (no cropped label), `AssessmentForm`
      scrolled to the middle (visible seam on the submit bar), browser tab (favicon
      visible, no 404 in console), header at 390px width (hamburger works, matches Task 9
      Step 4's manual check).
- [ ] Confirm `git log --oneline` on the branch shows 10 commits, one per task above.
