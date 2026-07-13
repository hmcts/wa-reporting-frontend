# Development Guidelines

## Core Rules

- Keep changes maintainable: no new duplication, flat cognitive load, idiomatic TypeScript, modular routes, and GOV.UK-compliant UI.
- Match file, class, function, route, and test names to nearby modules; avoid new abbreviations unless already established.
- Behaviour changes require tests. Lint, formatting, type errors, and failing required tests block merge.
- Use GOV.UK Design System patterns and content style in every flow, including GOV.UK Frontend macros, typography, spacing tokens, and colour palette. Retain an established repository pattern only where compatibility requires it.
- Unit tests must be deterministic, focused, and behaviour-oriented. Follow `docs/technical/testing.md` for assertion quality, fixture, coverage, and security-sensitive test standards.

## Required Reading

- Start with `docs/README.md` and follow its reading path for the task type; it is the authoritative guide to task-specific documentation.
- Use `docs/technical/change-recipes.md` before dashboard, SQL, filter, config, AJAX, security, sorting, or chart changes.
- Follow any nested `AGENTS.md` in the target path, especially under analytics modules, analytics shared code, analytics views, and analytics unit tests.
- Read `docs/technical/architecture.md` for stack or runtime-shape changes, `docs/technical/runtime-and-build.md` for commands, packaging, or deployment, and `docs/technical/testing.md` for test or verification changes, as directed by the selected reading path.

## Change Workflow

- Review the relevant `docs/` specifications before planning or editing.
- Keep edits scoped to the modules, views, tests, SQL, and docs implied by the request.
- Reuse existing shared analytics helpers before adding new helpers.
- Add or update tests under `src/test/` following existing unit, route, functional, a11y, and smoke patterns.
- Update `docs/` in the same change set when code, configuration, SQL, or executable assets alter durable user behaviour, architecture, operations, configuration, data/schema contracts, or developer workflow.
- Dependency-only upgrades must not add or change `docs/` unless the dependency version itself is an operational constraint.
- Documentation updates must carry forward durable context only: final behaviour, rules/constraints, dependencies, migrations, backfills, rollback notes, and operational considerations.
- If no existing docs page fits, add a linked page under `docs/` and index it from `docs/README.md`.
- If asked to commit, include required docs updates in the commit. If not asked to commit, include them in the final change set and call out any missing docs explicitly.
- Changes that impact these guidelines should update this file.

## Verification Matrix

| Change type | Required verification |
| --- | --- |
| Documentation only (`*.md` under repo root or `docs/`) | Markdown/link review. Mandatory build/test commands are not required. |
| Code/config/runtime SQL/assets | `yarn lint`, `yarn test:coverage`, `yarn test:routes`, `yarn build`, `yarn build:server`. |
| Changes affecting production-packaged output or production startup | All code checks plus `yarn build:prod`. |
| Analytics shared helpers, aggregations, repository filter/query composition, or view-model calculations | Code checks plus focused mutation testing where practical, for example `yarn test:mutation --mutate <source-file>` and optional `--testFiles <matching-test-file>`. |
| Dependency upgrade | Relevant install/audit/test checks from `skills/yarn-dependency-upgrades`, plus normal code checks when executable behaviour changes. |

These are local merge-readiness requirements and may exceed checks currently enforced by checked-in CI; see `docs/technical/deployment-and-ci.md` for the current CI behaviour.

Modified executable source files covered by Jest should have at least 95% line coverage and 95% branch coverage. Use Jest's per-file line and branch coverage report as the evidence. For generated files, static config, templates, or files outside coverage instrumentation, record why coverage does not apply and the relevant verification instead of inventing coverage.

If a required check cannot run, record the exact command, the blocker, and the risk. Do not claim verification passed.

## Non-Negotiable Implementation Rules

- `yarn build` is the frontend asset build only; use `yarn build:server` for the server TypeScript compile.
- `yarn test` is a repository wrapper: locally it delegates to `yarn test:unit`, and when `CI=true` it currently exits early.
- `yarn build:prod` rewrites `src/main/views/webpack/css.njk`, `src/main/views/webpack/js.njk`, and `src/main/views/webpack/analytics-js.njk` as generated verification artifacts. Do not commit those files unless asset-manifest generation is intentionally changed.
- When changing the analytics SQL end state through Flyway migrations, keep `db/current-state/tm-analytics-schema.sql` synchronised with the same final schema, helper, and stored procedure definitions.
- Flyway migrations that touch snapshot refresh procedures, snapshot parent/partition tables, partition indexes, or refresh publish/retention cleanup must coordinate with the refresh advisory lock before DDL and use a 20 minute `lock_timeout`; `docs/technical/operations/flyway.md` is the detailed authority.
- For AJAX section refreshes, follow the established pattern: wrap the section partial in `data-section`, submit `ajaxSection` with `X-Requested-With: fetch`, render the specific partial in the controller, and send URL-encoded form data including `_csrf`.

For analytics changes, follow the nearest nested guidance in `src/main/modules/analytics/AGENTS.md`, `src/main/modules/analytics/shared/AGENTS.md`, `src/main/views/analytics/AGENTS.md`, or `src/test/unit/analytics/AGENTS.md` for module, shared-code, view, and analytics-unit-test patterns.

## Subagents

Use subagents when available and permitted to parallelise independent work, then consolidate findings in the main thread.

For verification after code changes, use independent parallel checks when tooling allows. Prefer one worker each for `yarn lint`, `yarn test:coverage`, `yarn test:routes`, `yarn build`, and `yarn build:server`. Run checks locally in the main thread when subagents are unavailable or not permitted.

Parallelise only commands that do not write shared output. Run build commands that write `dist/` or generated artifacts sequentially; in particular, `yarn build:server` and `yarn build:prod` both write under `dist/`.

## ExecPlans

When writing complex features or significant refactors, use an ExecPlan as described in `PLANS.md`.

- ExecPlans may be working artifacts and can remain uncommitted.
- Important durable outcomes must be transferred into `docs/` before the related code change is considered complete, and committed when the task includes committing.
- Transfer only what helps future contributors understand and evolve the current system state. Omit transient planning artifacts unless operationally relevant.

## Repo Skills

This repository includes reusable Codex skills under `skills/`.

### Available Skills

- `local-app-startup`: Start, restart, rebuild, or smoke-check the app locally with the Flyway-backed seeded Docker database, auth disabled, and configurable local seed record counts. (file: `skills/local-app-startup/SKILL.md`)
- `yarn-dependency-upgrades`: Upgrade dependencies with Yarn 4 for single, multiple, all-package, and CVE-driven flows. Includes precedence-based remediation for `yarn-audit-known-issues` findings and resolution fallback guidance. (file: `skills/yarn-dependency-upgrades/SKILL.md`)
