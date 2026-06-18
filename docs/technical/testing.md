# Testing and quality

## Test suites
- Unit tests: Jest (`src/test/unit`).
- Jest TypeScript compilation uses `tsconfig.test.json`, which extends `tsconfig.json` with Jest globals and keeps Jest transforms on CommonJS-compatible settings so test-only ambient types and module semantics do not leak into the production server compile.
- Route tests: Jest with `jest.routes.config.js` (`src/test/routes`).
- Accessibility tests: Playwright + Axe (`src/test/a11y`).
- Functional tests: Playwright (`src/test/functional`).
- Smoke tests: Playwright (`src/test/smoke`).
- Opt-in local database checks use `docker-compose.local-db.yml`, the `db:local:*` package scripts, and deterministic Flyway-backed seed data under `db/local/`.

## Key commands
- `yarn test:unit` (direct Jest unit-test suite)
- `yarn test` (repository wrapper: runs `yarn test:unit` locally, currently exits early when `CI=true`)
- `yarn test:coverage`
- `yarn test:routes`
- `yarn test:mutation`
- `yarn test:mutation:ci`
- `yarn test:a11y`
- `yarn test:functional`
- `yarn test:smoke`
- `yarn test:ui` (Playwright UI mode)
- `yarn setup:edge` (install Edge for Playwright)
- `yarn db:local:up` (start the opt-in local Postgres container)
- `yarn db:local:rebuild` (reset local databases, run Flyway, generate source data, run snapshot refresh, and validate)
- `yarn db:local:refresh` (run only `analytics.run_snapshot_refresh_batch()` against the local TM database)
- `yarn db:local:validate` (check that the local seeded TM, CRD, and LRD data published a valid snapshot)

## Current command semantics
- Use `yarn test:unit` when you specifically need the unit-test suite.
- Treat `yarn test` as a repository wrapper, not as proof that Jest executed in every environment.
- `yarn build` is the frontend webpack build only; `yarn build:server` is the server TypeScript compile.
- The local database scripts are not part of the default Jest route/unit suites. Use them before unmocked local browser checks or when manually testing repository SQL against PostgreSQL.

## Local database-backed checks
- Run `yarn db:local:up`, then `yarn db:local:rebuild`.
- Use `LOCAL_DB_SEED_RECORD_COUNT` to change the total generated `cft_task_db.reportable_task` source rows. The default is `500000`, and values below `20` are rejected. Use `LOCAL_DB_SEED_RANDOM_SEED` to reproduce a specific generated dataset.
- Start the app with `AUTH_ENABLED=false yarn start:dev`.
- Load `/`, `/outstanding`, `/completed`, and `/users`, or run the relevant Playwright smoke/functional checks against the local server.
- If the database is exposed on a non-default port, set `TM_DB_PORT`, `CRD_DB_PORT`, and `LRD_DB_PORT` to the same value before starting the app.
- The seed generates upstream TM source rows and publishes a snapshot through the real Flyway-created refresh procedure. It is deterministic for a given record count and random seed.
- Local seed dimensions use weighted sampling across services, regions, locations, work types, task names, scenarios, and 5,000 generated users. Coverage is best effort, so small seeds may not contain every available value.

## Accessibility
- Playwright a11y tests run with `AUTH_ENABLED=false` and perform Axe checks.
- Each analytics page should have coverage in the a11y suite.

## Playwright browsers
- Functional tests run against Chromium, Firefox, WebKit, and Edge via Playwright projects.
- Smoke and a11y tests run on Chromium only.
- Install Edge with `yarn setup:edge` if you see missing `msedge` errors.

## Playwright common
- Prefer using `@hmcts/playwright-common` helpers and shared configuration in the first instance for new Playwright tests.
- Only introduce custom Playwright utilities when a requirement is not covered by the shared helpers.
- Keep new Playwright tests aligned with the shared patterns to reduce maintenance overhead.

## Coverage targets
- Project guidelines require at least 95% branch and line coverage on modified executable files where Jest coverage tooling applies.
- For generated files, static config, templates, or files outside coverage instrumentation, record the relevant verification instead of inventing coverage.
- The contributor guidance for non-documentation changes currently expects `yarn test:coverage` and `yarn test:routes` alongside the relevant build commands, but the checked-in CI scripts are narrower than that guidance.

## Unit test quality checklist
- Name tests as clear behavior statements (condition and expected outcome).
- Keep tests deterministic: avoid runtime clock/random/network dependencies unless explicitly controlled.
- Structure tests as Arrange/Act/Assert and keep each test focused on one primary behavior.
- Assert observable behavior and dependency contracts, not only implementation internals.
- Assert collaborator contracts at module boundaries when call parameters or order are part of behaviour.
- For dependency-bound logic, include rejection/error-path tests alongside success-path tests.
- Prefer precise assertions over broad ones (for example explicit error/status checks instead of bare `toThrow()`).
- Use typed fixture builders/factories for repeated complex objects to reduce duplication and improve readability.
- Restore global state in teardown (`process.env`, timers, DOM globals, spies, and module caches where relevant).

## Assertion quality patterns
- Prefer `toHaveBeenCalledWith(...)` or `toHaveBeenNthCalledWith(...)` when call parameters/order are part of behavior.
- Avoid low-signal assertions (`toBeDefined`, `expect.any(...)` placeholders, or "was called" only checks) when stronger checks are possible.
- Prefer semantic assertions on returned structures over brittle serialization checks (for example exact JSON string equality).
- Prefer parsing URL/query outputs (`URL`/`URLSearchParams`) over substring assertions for pagination/filter links.

## Maintainability patterns
- Split large omnibus tests into focused cases to reduce failure blast radius and improve diagnostics.
- Consolidate duplicate coverage ownership so one suite is the source of truth for a module's behavior.
- Replace repeated inline fixtures with shared builders once the same shape appears in multiple tests.
- Avoid coupling to framework-private internals (such as Express stack index positions, middleware arity heuristics, or private method access) unless no public seam exists and the reason is documented in the test.
- Freeze time in date-sensitive tests with `jest.useFakeTimers().setSystemTime(...)` and reset in teardown.

## Security-sensitive unit tests
- Session tests should assert security-relevant options, including cookie flags and session behavior fields.
- OIDC tests should assert explicit authorization failure semantics (error type/status/message), not only generic throws.
- Helmet tests should cover a stable set of CSP and related directives beyond a single script directive.
- CSRF tests should assert both token generation and validation wiring for enabled/default states.

## Mutation testing
- Mutation testing runs with StrykerJS against Jest unit tests (`jest.config.js`).
- Local command: `yarn test:mutation`.
- CI-friendly command: `yarn test:mutation:ci`.
- HTML report output: `reports/mutation/html/report.html`.
- Current mutation scope covers analytics shared, completed, overview, outstanding, and user-overview module TypeScript files.
- Current thresholds are `break: 80`, `low: 70`, and `high: 80`, validated by two consecutive `80.13` mutation-score runs on 14 February 2026.
- Local runtime budget for the expanded scope is typically 12-20 minutes. Keep `mutate` scope unchanged and tune Stryker concurrency only if runtime/stability degrades.
- Current setting uses `concurrency: 2` for stability; occasional worker OOM/SIGSEGV restarts may still occur during long runs.
- Surviving mutants should be triaged by business risk, and addressed with targeted unit test improvements rather than broad file exclusions.

## Linting and formatting
- `yarn lint` runs stylelint (SCSS), eslint (TS/JS), and prettier checks.
- `yarn lint:fix` runs auto-fix for ESLint and Prettier.
