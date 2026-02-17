# Testing and quality

## Test suites
- Unit tests: Jest (`src/test/unit`).
- Route tests: Jest with `jest.routes.config.js` (`src/test/routes`).
- Accessibility tests: Playwright + Axe (`src/test/a11y`).
- Functional tests: Playwright (`src/test/functional`).
- Smoke tests: Playwright (`src/test/smoke`).

## Key commands
- `yarn test` (unit tests)
- `yarn test:coverage`
- `yarn test:routes`
- `yarn test:mutation`
- `yarn test:mutation:ci`
- `yarn test:a11y`
- `yarn test:functional`
- `yarn test:smoke`
- `yarn test:ui` (Playwright UI mode)
- `yarn setup:edge` (install Edge for Playwright)

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
- Project guidelines require at least 95% branch and line coverage on modified files.

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
