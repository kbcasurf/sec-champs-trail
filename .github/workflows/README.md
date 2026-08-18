# CI/CD workflows

## `ci.yml`

Runs on every pull request and push to `main`, plus a weekly schedule (Mondays
06:00 UTC) that re-runs only the security jobs (code doesn't change on a
schedule, but disclosed CVEs / rules can).

| Job | What it checks | Runs on schedule? |
|---|---|---|
| `lint` | ESLint (`apps/api`, `apps/web`) | no |
| `typecheck` | `tsc --noEmit` across all workspaces | no |
| `unit` | Jest (`apps/api`) + Vitest (`apps/web`, `packages/owasp-content`) | no |
| `e2e` | `apps/api`'s supertest-based API integration tests | no |
| `npm-audit` | `npm audit --omit=dev --audit-level=high` | yes |
| `semgrep` | SAST (security-audit, JS, TS, React, Dockerfile rule packs) | yes |
| `secrets-scan` | TruffleHog (verified/unknown secrets in the diff or history) | yes |
| `codeql` | CodeQL static analysis (`javascript-typescript`) | yes |
| `dast` | OWASP ZAP baseline scan against a running instance of the app | yes |

`unit`, `e2e`, and `dast` provision a `postgres:16-alpine` service — most of
`apps/api`'s unit specs mock `PrismaService`, but `prisma/seed.spec.ts` and
`bootstrap-admin.spec.ts` hit a real database, as does everything under `e2e`.

`typecheck`, `unit`, `e2e`, and `dast` all build `packages/owasp-content`
before running anything else in `apps/api`: that package's compiled output
(not its raw TypeScript source) is what `apps/api` actually imports at
runtime — see
[ADR 0002](../../docs/adr/0002-single-docker-image.md).

`semgrep`, `codeql`, and `dast` are **report-only but gated**: they always
run to completion and upload their full report as an artifact, then a
separate step fails the job if the report contains any HIGH/CRITICAL
(Semgrep: `error`; CodeQL: `security_severity_level` high/critical; ZAP:
`riskcode >= 3`) finding, via the scripts in `.github/scripts/`.

## `docker-build-push.yml`

Builds the Docker image from the repository-root `Dockerfile` (the single
image that serves both `apps/api` and the `apps/web` build — see
[ADR 0002](../../docs/adr/0002-single-docker-image.md)), scans it, and
pushes it to the GitHub Container Registry (GHCR).

### Trigger

- `push` to `main` (in practice, this only happens when a pull request is
  merged — direct pushes to `main` are blocked by branch protection).
- `workflow_dispatch`, for manual runs from the Actions tab.

### Workflow

1. Check out the repository.
2. Set up QEMU and Docker Buildx.
3. Log in to `ghcr.io` using `github.actor` and the built-in `GITHUB_TOKEN`
   (no external secrets required).
4. Build the image locally (`push: false`, `load: true`), tagged
   `sec-champs-trail:scan`.
5. Scan the image with Trivy (`severity: HIGH,CRITICAL`, `exit-code: 1`). The
   build fails here if high/critical vulnerabilities are found. If a finding
   needs to be accepted (e.g. unfixed upstream), add a `.trivyignore` file at
   the repo root and pass `trivyignores: '.trivyignore'` to the scan step —
   none exists yet, since none has been needed.
6. If the scan passes, build and push the image to
   `ghcr.io/<repository_owner>/sec-champs-trail:latest`.

### Permissions

The workflow only needs:

```yaml
permissions:
  contents: read
  packages: write
```

No repository secrets need to be configured — authentication to GHCR uses the
automatically provided `GITHUB_TOKEN`.
