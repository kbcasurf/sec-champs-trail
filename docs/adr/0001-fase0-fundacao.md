# ADR 0001: Phase 0 (Foundation) architecture decisions

- Status: Accepted
- Date: 2026-08-10
- Source PRD: `PRD-security-champions-assistant.md`
- Derived spec: `docs/superpowers/specs/2026-08-10-fase0-fundacao-design.md`

## Context

This ADR records the decisions made in an (assisted) brainstorming session about the
original ChampionForge / Security Champions Assistant PRD, before detailing Phase 0's
technical spec. The original session in which these decisions were discussed was lost
to an environment crash before an ADR was saved; this document was reconstructed from
the session's transcript history and matches the content already recorded in the
Phase 0 spec (no new decision is introduced here — this is the formal record of what
was already implicit in the spec).

Each decision below adjusts or details section 5 ("Technical Architecture") or 7
("Roadmap") of the original PRD.

---

## Decision 1 — OWASP content ingestion: manual curation, not scraping

**Problem:** the PRD (section 5.1) suggested ingesting OWASP content via
scraping/parsing at runtime, but section 8 (risks) already acknowledged that approach as
fragile and proposed periodic manual synchronization — the two sections contradicted
each other.

**Options considered:**
- Manual curation, versioned as JSON in the repo, with a documented periodic manual
  update process.
- Keep an automated scraping/parsing pipeline (runtime or build-time) with a local
  cache.

**Decision:** manual curation. Manifesto and checklist content is transcribed once into
`packages/owasp-content`, versioned in git. No automatic scraping.

**Consequences:** simpler and more robust, eliminates the runtime dependency on the
source site's availability/layout. Cost: content updates require a recurring manual
process (no automatic sync).

---

## Decision 2 — Splitting the MVP into Phase 1a (no AI) and Phase 1b (with AI)

**Problem:** the PRD treated F1-F5 as a single MVP delivery in 4-6 weeks, an estimate
considered optimistic given that F3 (AI training tracks) and F5 (AI executive report)
are each, on their own, prompt-engineering and schema-validation projects.

**Options considered:**
- Split into Phase 1a (F1 maturity assessment, F4 checklists, F2 simple rule-based
  action plan — no AI) and Phase 1b (F3 + F5 — AI layer on top of the 1a base).
- Keep F1-F5 as a single MVP delivery.

**Decision:** split into 1a and 1b.

**Consequences:** the product becomes usable (assessment + checklists + action plan)
before the AI layer exists, reducing the risk of delay from F3/F5's complexity and
allowing the product's base to be validated before investing in prompt engineering.

---

## Decision 3 — Multi-tenancy: one Organization per instance

**Problem:** the PRD's data model already implied support for multiple organizations,
but F8 (multi-tenant) was only planned for Phase 3 — ambiguity over whether the MVP
already needed to support multiple isolated orgs on the same instance.

**Options considered:**
- A single `Organization` per self-hosted instance from Phase 0 onward (but multiple
  `Team`s within it, per the already-planned `Organization → Team` model).
- Multi-org from the MVP, anticipating a possible future hosted SaaS model.

**Decision:** one `Organization` per instance. The original F8 is re-evaluated in
Phase 3 (it may no longer make sense as a separate feature).

**Consequences:** simplifies MVP auth, permissions, and onboarding. A future multi-org
offering would require data-model migration work, not just a feature.

---

## Decision 4 — Backend: NestJS (not FastAPI)

**Problem:** the PRD left the backend choice open between NestJS (Node/TS) or FastAPI
(Python).

**Options considered:**
- Node.js + NestJS — full-stack TypeScript, consistent with the React frontend;
  official Anthropic SDK in TS; Nest's modular structure makes it easier to organize
  domains (assessments, training, reports).
- Python + FastAPI — good if there were more familiarity with Python; pydantic fits
  well with validating structured LLM outputs.

**Decision:** NestJS.

**Consequences:** a single language (TypeScript) across the whole product stack,
reducing context-switching cost between frontend and backend.

---

## Decision 5 — MVP authentication: local JWT only

**Problem:** the PRD suggested "JWT + optional SSO/OIDC" without defining whether OIDC
would be needed already in the MVP.

**Options considered:**
- Simple local JWT (username/password), with OIDC/SSO documented as a future extension
  (Phase 2/3).
- OIDC from the MVP, anticipating corporate adoption that requires SSO from first use.

**Decision:** local JWT only in Phase 0/1. No OIDC/SSO implemented now.

**Consequences:** reduces initial auth complexity. Corporate adoption requiring
mandatory SSO isn't served until a future phase.

---

## Decision 6 — Approved roadmap: Phase 0 → 1a → 1b → 2 → 3

**Decision:** follow the breakdown below, each phase with its own spec and
implementation plan, written and approved sequentially:

| Phase | Scope | Deliverable |
|---|---|---|
| Phase 0 | Monorepo, OWASP curation, `ATTRIBUTION.md`, full data model, Docker Compose, local JWT auth | Repo running locally, no product features |
| Phase 1a | F1 (maturity assessment) + F4 (checklists) + simplified F2 (rule-based action plan) | Product usable without an AI key configured |
| Phase 1b | F3 (AI training tracks) + F5 (AI executive report) | Complete MVP per the original PRD |
| Phase 2 | F6 (quiz/gamification) + F7 (community) | Post-MVP |
| Phase 3 | F8 (multi-tenant, re-evaluated per Decision 3) + F9 (SAMM/Threat Dragon integration) | Expansion |

---

## Decision 7 — Monorepo structure: plain npm workspaces

**Problem:** how to organize the frontend (React), backend (NestJS), and curated OWASP
content in the same repository.

**Options considered:**
- Plain npm workspaces (`apps/web`, `apps/api`, `packages/owasp-content` under a root
  `package.json`), no extra build-orchestration tool.
- Turborepo — same folder structure, with build/cache orchestration.
- Polyrepo — frontend, backend, and OWASP content in separate git repositories.

**Decision:** plain npm workspaces.

**Consequences:** lower barrier to entry for contributors to a new open-source project;
no extra tooling overhead. If the number of packages grows significantly, build
orchestration may need to be revisited.

---

## Decision 8 — Location of the curated OWASP content: inside the monorepo

**Options considered:**
- `packages/owasp-content` inside the monorepo, versioned alongside the code that
  consumes it.
- A separate repository, consumed as an external dependency (submodule or published
  package).

**Decision:** inside the monorepo, as its own package.

**Consequences:** keeps the content schema and the code that consumes it always in
sync on the same revision/PR. Reuse of the content by other projects would require
later extraction.

---

## Decision 9 — Backend tooling: npm + Prisma

**Options considered:**
- npm + Prisma — declarative migrations, typed schema, good ergonomics for the
  `Organization → Team → Champion → Assessment` model.
- pnpm + TypeORM — pnpm is more disk-efficient; TypeORM is the NestJS ecosystem's most
  common integration via decorators, but with more cumbersome manual migrations.

**Decision:** npm + Prisma.

**Consequences:** an ORM with good documentation for open-source contributors; a single
package manager (npm) across the whole monorepo, no mixing with pnpm.

---

## Decision 10 — Version control initialization

**Decision:** `git init` + `.gitignore` + first commit at the end of Phase 0, done in
`f0c78b5` ("Add PRD and Fase 0 (foundation) design spec").

**Consequences:** none — an operational decision, already executed.

---

## Notes

- All decisions above were already reflected in the approved spec
  `docs/superpowers/specs/2026-08-10-fase0-fundacao-design.md`; this ADR is the formal
  record that was missing, not a scope revision.
- The original session had also created a backlog of 8 tasks (specs + plans for
  Phase 0, 1a, 1b, 2, and 3), which didn't survive the crash. It should be recreated as
  work progresses.
