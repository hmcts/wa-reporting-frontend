# Development Guidelines

## Core Rules

- Keep changes maintainable: no new duplication, flat cognitive load, idiomatic TypeScript, modular routes, and GOV.UK-compliant UI.
- Match file, class, function, route, and test names to nearby modules; avoid new abbreviations unless already established.
- Behaviour changes require tests. Lint, formatting, type errors, and failing required tests block merge.
- GOV.UK Design System patterns are preferred in every flow. Use GOV.UK Frontend macros, typography, spacing tokens, colour palette, and content style.
- Unit tests must be deterministic, focused, and behaviour-oriented. Follow `docs/technical/testing.md` for assertion quality, fixture, coverage, and security-sensitive test standards.

## Required Reading

- Start with `docs/README.md` and follow the reading path for the task type.
- Use `docs/technical/change-recipes.md` before dashboard, SQL, filter, config, AJAX, security, sorting, or chart changes.
- Follow any nested `AGENTS.md` in the target path, especially under analytics modules, analytics shared code, analytics views, and analytics unit tests.
- Refer to `docs/technical/architecture.md` for the stack and runtime shape, `docs/technical/runtime-and-build.md` for command semantics, and `docs/technical/testing.md` for verification detail.

## Change Workflow

- Review the relevant `docs/` specifications before planning or editing.
- Keep edits scoped to the modules, views, tests, SQL, and docs implied by the request.
- Reuse existing shared analytics helpers before adding new helpers.
- Add or update tests under `src/test/` following existing unit, route, functional, a11y, and smoke patterns.
- For code, config, runtime SQL, or executable asset changes, update the corresponding `docs/` files in the same change set.
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
| Packaged runtime output or `yarn start` | All code checks plus `yarn build:prod`. |
| Analytics shared helpers, aggregations, repository filter/query composition, or view-model calculations | Code checks plus focused mutation testing where practical, for example `yarn test:mutation --mutate <source-file>` and optional `--testFiles <matching-test-file>`. |
| Dependency upgrade | Relevant install/audit/test checks from `skills/yarn-dependency-upgrades`, plus normal code checks when executable behaviour changes. |

Branch and line coverage for modified executable files should be at least 95% where Jest coverage tooling applies. For generated files, static config, templates, or files outside coverage instrumentation, record the relevant verification instead of inventing coverage.

If a required check cannot run, record the exact command, the blocker, and the risk. Do not claim verification passed.

## Non-Negotiable Implementation Rules

- `yarn build` is the frontend asset build only; use `yarn build:server` for the server TypeScript compile.
- `yarn test` is a repository wrapper: locally it delegates to `yarn test:unit`, and when `CI=true` it currently exits early.
- `yarn build:prod` rewrites `src/main/views/webpack/{css.njk,js.njk,analytics-js.njk}` as generated verification artifacts. Do not commit those files unless asset-manifest generation is intentionally changed.
- When changing the analytics SQL end state through Flyway migrations, keep `db/current-state/tm-analytics-schema.sql` synchronised with the same final schema, helper, and stored procedure definitions.
- Flyway migrations that touch snapshot refresh procedures, snapshot parent/partition tables, partition indexes, or refresh publish/retention cleanup must coordinate with the refresh advisory lock before DDL and use a 20 minute `lock_timeout`; follow `docs/technical/operations/flyway.md`.
- For AJAX section refreshes, follow the established pattern: wrap the section partial in `data-section`, submit `ajaxSection` with `X-Requested-With: fetch`, render the specific partial in the controller, and send URL-encoded form data including `_csrf`.

## Subagents

Use subagents when available and permitted to parallelise independent work, then consolidate findings in the main thread.

For verification after code changes, use independent parallel checks when tooling allows. Prefer one worker each for `yarn lint`, `yarn test:coverage`, `yarn test:routes`, `yarn build`, and `yarn build:server`. Run checks locally in the main thread when subagents are unavailable or not permitted.

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
