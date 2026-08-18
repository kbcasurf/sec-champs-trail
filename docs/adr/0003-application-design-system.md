# ADR 0003: Application UI design system

- Status: Accepted
- Date: 2026-08-18
- Motivated by: the first end-to-end runtime walkthrough of Phase 1a (see
  `docs/superpowers/plans/2026-08-13-fase1a-mvp-execution-log.md`) surfaced that every
  screen was still unstyled Tailwind on bare HTML elements — no colors, no typography,
  no visual hierarchy — while `assets/banner.png` (the project's own README banner)
  already carried a distinct brand identity the app never used.

## Context

Before this ADR, `apps/web/tailwind.config.js` had an empty `theme.extend`, and every
page (`Login`, `Dashboard`, `AssessmentForm`, `ChecklistLibrary`, `ActionPlan`,
`TeamsAdmin`) rendered native browser-default `<input>`, `<button>`, `<label>`, and
`<select>` elements with only ad hoc layout utilities (`mx-auto mt-12 max-w-2xl`,
`text-xl font-semibold`). This was functional but had no design system: no color
tokens, no type scale, no component patterns — and, in `AssessmentForm`, no block-level
styling on the maturity-level `<label>` elements at all, which made every option run
together on one line.

`assets/banner.png` (added for the README, unrelated to the app UI) already
established a brand direction the app didn't share: a near-black background, a single
orange accent, monospace uppercase technical labels, and a decagon radar-chart motif —
the same shape as the real Program Maturity radar chart on `/dashboard`.

## Decision — extend the banner's identity into the app, prototyped before coding

The banner's direction became the app's design system rather than inventing a new one:
dark surfaces, one orange accent, and a three-font pairing (a display face for
headings, a body face for paragraphs, a mono face for technical/UI labels).

**Process:** the direction was first prototyped as a clickable mockup (Claude Design's
canvas — all six real screens, wired to realistic interaction, not just static frames)
and approved before any application code changed. That mockup is not part of this
repository; this ADR and the resulting code are the durable record.

**Tokens** — added to `apps/web/tailwind.config.js` (`theme.extend.colors` /
`fontFamily`) instead of scattering literal hex values across components:

- Surfaces: `bg` / `bg-elevated` / `surface` / `surface-hover` / `surface-2`, `line` /
  `line-soft` for borders.
- Ink: `ink` (headings), `ink-body` (paragraphs), `ink-muted` / `ink-muted-2`
  (secondary/tertiary text).
- One brand accent, `accent` (`#f97316`, matching the banner), with `hover` / `active`
  / `soft` / `border` variants — no second decorative accent color.
- Semantic-only colors `success` / `danger` / `info`, reserved for state (done/error/
  in-progress), never used as decoration.
- `fontFamily.display` (Space Grotesk), `fontFamily.body` (IBM Plex Sans),
  `fontFamily.mono` (IBM Plex Mono) — loaded via a Google Fonts `<link>` in
  `apps/web/index.html`. Each has a `system-ui`/`ui-monospace` fallback stack.

**Component patterns, not a UI kit:** no component library (Radix, shadcn, MUI, ...)
was added. Every screen is still plain Tailwind utility classes on native elements,
consistent with how this app was already built — the redesign is a shared token
vocabulary and a few repeated hand-written patterns, not a new dependency:

- `ProtectedRoute.tsx`'s nav is now the single shared app shell (brand mark, active-link
  highlighting via `useLocation`, role badge, log-out), replacing the bare `flex gap-4`
  bar. It was already the one place all authenticated pages share; the redesign didn't
  introduce a new shared component for this.
- Native form controls stay native (real `<input type="radio">` / `type="checkbox">`
  for accessibility, keyboard support, and to keep the existing test suite's
  `getByLabelText`/`getByRole("checkbox", …)` queries meaningful) but are visually
  restyled: the control itself is visually hidden (`sr-only-label`, a utility added to
  `index.css`) behind a custom-drawn box, with the accessible name supplied via
  `aria-label` on the input where the visible text is intentionally more compact than
  the full label (see `AssessmentForm` below).
- `Dashboard`'s radar chart keeps `recharts` (already a dependency) rather than being
  replaced by a hand-drawn SVG chart — it's re-themed (accent stroke/fill, mono-font
  axis ticks) and gained a hover tooltip it didn't have before.

**One real interaction change, not just a reskin:** `AssessmentForm` used to render all
five level descriptions, fully expanded, for all ten principles at once. It now renders
five compact numbered chips per principle, showing one description at a time (on hover,
or the selected level once answered) plus a running "N / 10 answered" progress bar. The
accessible name of each radio (`"{level} — {description}"`, via `aria-label`) is
unchanged, so this only changed what's visually rendered, not what the form submits.

**Alternatives considered:**
- *Keep native styling, add only colors* — rejected: color alone doesn't fix the
  underlying legibility problem in `AssessmentForm` (still a wall of text) or the lack
  of any visual hierarchy across pages.
- *Adopt a component library* — rejected: this is a small internal tool (ADR 0002 made
  the same call about deployment complexity); a UI kit is a dependency and an
  abstraction layer this app's surface area doesn't need yet.

## Consequences

**Google Fonts is now a runtime dependency for full typography.** `index.html` fetches
`fonts.googleapis.com`/`fonts.gstatic.com` at page load. Every custom font has a
system fallback stack, so the app remains fully usable without network access to
Google — text falls back to the OS's default sans/mono — but the branded look
(Space Grotesk / IBM Plex) requires it. Worth revisiting if this tool is ever deployed
somewhere genuinely air-gapped (self-hosting the font files would remove the
dependency); not a blocker at today's scale.

**No new npm dependencies.** `recharts` was already used; no charting or UI-kit library
was added or removed.

**No test files changed.** All 18 existing frontend tests
(`apps/web/src/**/*.test.tsx`) pass unmodified — the redesign was constrained to keep
every `getByLabelText`, `getByRole`, and `getByText` query the tests already relied on
valid, which is why native form controls were kept (see Decision) instead of switching
to `<div>`-based custom controls.

**`docker compose up --build` required after this change** — the production image
bundles the built `apps/web/dist` (ADR 0002); the redesign doesn't change that
workflow, just makes rebuilding necessary again for this content.

## Notes

- Tested via `npm run test -w apps/web` (18/18 passing), `tsc -b` (no errors),
  `eslint apps/web/src` (no errors), and a full `docker compose up --build` cycle
  followed by a manual walkthrough of all six screens.
- The maturity-level and checklist copy shown in the redesigned `AssessmentForm` /
  `ChecklistLibrary` is unchanged — this ADR is about presentation, not content; the
  curated OWASP content pipeline from ADR 0001 is untouched.

## Amendment — runtime QA fixes (2026-08-18)

A `/hm-qa` pass against the running container (real login flows for both `admin` and
`champion` roles, Chromium-driven) found four defects introduced or exposed by the
redesign above. All four are fixed in this same change set; 20/20 frontend tests pass
(18 original + 2 new), `tsc -b` and `eslint` remain clean.

- **Mobile nav caused horizontal overflow on every authenticated page.**
  `ProtectedRoute.tsx`'s header (`flex h-16 items-center gap-8 ...`) never wrapped, so
  the brand mark, five nav links, role badge, email, and log-out button were forced
  onto one line — measured at ~985px minimum width. On a 390px viewport this produced
  `document.documentElement.scrollWidth: 985` vs `clientWidth: 390`, a horizontal
  scrollbar, and (on `Dashboard`) a squeezed, near-illegible two-column grid. Fixed by
  making the header and nav `flex-wrap` (`h-16` → auto height with `py-3`); verified
  `scrollWidth === clientWidth` at 390px afterward, with no visible change at desktop
  widths.
- **Dashboard "Snapshot" panel truncated every principle title with no way to read
  it.** The `truncate` class on a fixed 96px column (`Dashboard.tsx`) cut off nearly
  every title (e.g. "Be passionate about security" → "Be passionate _") with no
  `title` attribute for a hover tooltip. Fixed by adding `title={s.principle.title}`.
- **Admin users saw a silently blank Checklist and a no-op "Generate new plan"
  button.** `ChecklistLibrary` and `ActionPlan` read `user?.teamId` directly, which is
  `null` for admins (by design — `TeamsAdmin.tsx` states "admins can exist without
  one [team]"). Unlike `Dashboard`, neither page offered an admin team selector, so an
  admin without a team saw an empty page (`Checklist`) or a button that did nothing
  when clicked (`ActionPlan`, since `handleGenerate` also early-returns on
  `!teamId`). Fixed by giving both pages the same admin-only team-selector `<select>`
  pattern `Dashboard` already used, clearing stale state on team change, and disabling
  "Generate new plan" until a team is selected instead of letting it no-op silently.
  Covered by two new tests (`ChecklistLibrary.test.tsx`, `ActionPlan.test.tsx`).
- **Native scrollbar was effectively invisible against the dark background.** No
  `color-scheme` was declared anywhere, so browsers rendered scrollbars (and other
  native UI) in their light-theme default — on platforms with overlay/auto-hiding
  scrollbars (common on Linux and macOS) this made the scrollbar nearly impossible to
  see against the app's near-black surfaces, so users on long pages had no visual cue
  that more content existed below the fold. Fixed in `index.css`: `color-scheme: dark`
  on `html`, plus explicit `::-webkit-scrollbar` styling (Chrome/Edge) and
  `scrollbar-color` (Firefox) using the existing `line`/`bg` tokens, so the scrollbar
  is always visible and on-theme rather than left to per-platform defaults.
