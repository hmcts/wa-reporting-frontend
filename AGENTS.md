# Development Guidelines

## Core Principles

### I. Code Quality Is Non-Negotiable

Changes must be maintainable: no new duplication, keep cognitive load flat, use idiomatic TypeScript, keep routes modular, and preserve GOV.UK-compliant UI. Lint, formatting, and type errors block merge. Behaviour changes require tests. Match file, class, function, and route names to nearby modules; avoid new abbreviations unless already established.

### II. Tests Define Release Readiness

Every feature ships with appropriate unit tests for edge cases and error paths, route tests for Express endpoints, automated accessibility coverage (Playwright + AxeUtils), and smoke tests for unmocked happy paths. Tests act as living documentation for intended behaviour.

### III. GOV.UK Experience Consistency

GOV.UK Design System patterns (https://design-system.service.gov.uk) are preferred in every flow. Pages use GOV.UK Frontend macros, typography, spacing tokens, and colour palette. Bespoke styling is only allowed when no pattern exists. Content follows the GOV.UK style guide and interactive states retain >= WCAG AA contrast.

### IV. Unit Test Quality

Unit tests must remain clear, deterministic, and resistant to implementation-only refactors. For all non-trivial test changes:

- Assert behaviour and collaborator contracts at module boundaries, for example `toHaveBeenCalledWith(...)` for dependency calls.
- Cover both happy paths and rejection/error paths for dependency-bound logic.
- Use explicit negative-path assertions for error type, status, or message; avoid broad `toThrow()` with no expectation.
- Freeze time for time-sensitive logic with `jest.useFakeTimers().setSystemTime(...)` and restore timer state during teardown.
- Avoid coupling tests to framework/private internals unless no public seam exists and the reason is documented in the test.
- Extract repeated large fixtures into typed builders/factories once duplication appears across scenarios.
- Prefer high-signal assertions; avoid low-value checks such as `toBeDefined`, `expect.any(...)` stand-ins, or "was called" assertions without argument/outcome checks.
- For security-sensitive modules (session, OIDC, helmet, CSRF), assert the full security-relevant configuration contract, not a single field.
- Keep tests focused: one behaviour per test where practical, avoiding large omnibus cases that obscure failure diagnosis.

## Active Technologies

- TypeScript on Node.js + Express 5, Nunjucks/express-nunjucks, govuk-frontend components, Plotly for charts, axios for API data fetch, and Prisma for database integration.
- Playwright smoke/functional tests with `@hmcts/playwright-common`.
- GOV.UK Design System through the `govuk-frontend` library.

## Required Reading

- Start with `docs/README.md` and follow the reading path for the task type.
- Use `docs/technical/change-recipes.md` before common dashboard, SQL, filter, config, AJAX, security, sorting, or chart changes.
- Follow any nested `AGENTS.md` in the target path, especially under analytics modules, analytics shared code, analytics views, and analytics unit tests.
- Before researching or planning a change, review the relevant `docs/` specifications and use them as the starting point for current behaviour, data flows, and constraints.

## Project Structure

```text
docs/
  functional/
  technical/
    data-sources/
    operations/
db/
  current-state/
  migrations/
  flyway/
src/
  main/
    modules/
    routes/
    views/
    assets/
    public/
    resources/
  test/
    unit/
    functional/
    a11y/
    smoke/
    playwright/
charts/
config/
infrastructure/
prisma/
scripts/
skills/
webpack/
```

## Key Commands

- `yarn test:unit`
- `yarn test` (repository wrapper; locally delegates to `yarn test:unit`, currently exits early when `CI=true`)
- `yarn test:coverage`
- `yarn test:routes`
- `yarn test:mutation`
- `yarn lint`
- `yarn build` (frontend assets)
- `yarn build:server` (server TypeScript)
- `yarn build:prod` (production assets + static copy)
- Add dependencies with `yarn add` or `yarn add -D` so Yarn resolves and records the selected versions.

## Change Workflow

- Keep edits scoped to the modules, views, tests, SQL, and docs implied by the request.
- Reuse existing shared analytics helpers before adding new helpers.
- Add or update tests under `src/test/` following existing unit, route, functional, a11y, and smoke patterns.
- For code, config, runtime SQL, or executable asset changes, update the corresponding `docs/` files in the same change set. Dependency-only upgrades must not add or change `docs/` unless the dependency version itself is an operational constraint.
- Documentation updates must carry forward durable context only: final behaviour, rules/constraints, dependencies, migrations, backfills, rollback notes, and operational considerations. Do not add changelog-style file lists.
- Do not duplicate exact versions, image tags, chart versions, package versions, or generated values in docs when already declared in source/config unless the version is an operational constraint.
- If no existing docs page fits, add a linked page under `docs/` and index it from `docs/README.md`.
- If asked to commit, include required docs updates in the commit. If not asked to commit, include them in the final change set and call out any missing docs explicitly.
- Changes that impact these Development Guidelines should update this file.

## Verification Matrix

| Change type | Required verification |
| --- | --- |
| Documentation only (`*.md` under repo root or `docs/`) | Markdown/link review. Mandatory build/test commands are not required. |
| Code/config/runtime SQL/assets | `yarn lint`, `yarn test:coverage`, `yarn test:routes`, `yarn build`, `yarn build:server`. |
| Packaged runtime output or `yarn start` | All code checks plus `yarn build:prod`. |
| Analytics shared helpers, aggregations, repository filter/query composition, or view-model calculations | Code checks plus focused mutation testing where practical, for example `yarn test:mutation --mutate <source-file>` and optional `--testFiles <matching-test-file>`. |
| Dependency upgrade | Relevant install/audit/test checks from the dependency-upgrade skill, plus normal code checks when executable behaviour changes. |

Branch and line coverage for modified executable files should be at least 95% where Jest coverage tooling applies. For generated files, static config, templates, or files outside coverage instrumentation, record the relevant verification instead of inventing coverage.

If a required check cannot run, record the exact command, the blocker, and the risk. Do not claim verification passed. `yarn build:prod` rewrites `src/main/views/webpack/{css.njk,js.njk,analytics-js.njk}` as generated verification artifacts; do not commit those file changes unless asset-manifest generation is intentionally changed.

## Analytics Patterns

- Analytics pages live under `src/main/modules/analytics/<page>/` with `controller.ts`, `service.ts`, `page.ts`, `viewModel.ts`, and optional `visuals/`.
- `controller.ts` owns HTTP entrypoints and route wiring.
- `service.ts` owns data access orchestration and domain aggregation.
- `page.ts` owns async composition and fallbacks.
- `viewModel.ts` shapes data for templates.
- `visuals/` owns chart builders and data fetchers.
- Register new page routes in `src/main/modules/analytics/index.ts` and keep rendering in the page controller with `res.render('analytics/<page>/index')`.
- Nunjucks templates for analytics pages live under `src/main/views/analytics/<page>/index.njk`; per-page partials live under `src/main/views/analytics/<page>/partials/`; shared filters live in `src/main/views/analytics/partials/shared-filters.njk`.
- Prefer Nunjucks macros over pure HTML where macros exist.
- Shared analytics helpers belong in `src/main/modules/analytics/shared/`.
- For AJAX section refreshes, follow the established pattern: wrap the section partial in `data-section`, submit `ajaxSection` with `X-Requested-With: fetch`, render the specific partial in the controller, and send URL-encoded form data including `_csrf`.
- When changing the analytics SQL end state through Flyway migrations, keep `db/current-state/tm-analytics-schema.sql` synchronised with the same final schema, helper, and stored procedure definitions.

## Subagents

Use subagents when available and permitted to parallelise independent work, then consolidate findings in the main thread. Good fits include broad discovery, independent multi-file refactors, test coverage work, documentation sync tasks, and verification orchestration.

For verification after code changes, use independent parallel checks when tooling allows. Prefer one worker each for `yarn lint`, `yarn test:coverage`, `yarn test:routes`, `yarn build`, and `yarn build:server`. Run checks locally in the main thread when subagents are unavailable or not permitted. Treat `yarn build` as frontend assets only; use `yarn build:server` for server TypeScript.

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan as described in `PLANS.md` from design to implementation.

- ExecPlans may be treated as working artifacts and can remain uncommitted.
- Important durable outcomes must be transferred into committed `docs/` before the related code change is considered complete.
- Transfer only what helps future contributors understand and evolve the current system state. Omit transient planning artifacts unless operationally relevant.

## Repo Skills

This repository includes reusable Codex skills under `skills/`.

### Available Skills

- `yarn-dependency-upgrades`: Upgrade dependencies with Yarn 4 for single, multiple, all-package, and CVE-driven flows. Includes precedence-based remediation for `yarn-audit-known-issues` findings and resolution fallback guidance. (file: `skills/yarn-dependency-upgrades/SKILL.md`)
