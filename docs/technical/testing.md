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
- `yarn test:a11y`
- `yarn test:functional`
- `yarn test:smoke`

## Accessibility
- Playwright a11y tests run with `AUTH_ENABLED=false` and perform Axe checks.
- Each analytics page should have coverage in the a11y suite.

## Playwright browsers
- Functional tests run against Chromium, Firefox, WebKit, and Edge via Playwright projects.
- Smoke and a11y tests run on Chromium only.

## Playwright common
- Prefer using `@hmcts/playwright-common` helpers and shared configuration in the first instance for new Playwright tests.
- Only introduce custom Playwright utilities when a requirement is not covered by the shared helpers.
- Keep new Playwright tests aligned with the shared patterns to reduce maintenance overhead.

## Coverage targets
- Project guidelines require at least 95% branch and line coverage on modified files.

## Linting and formatting
- `yarn lint` runs stylelint (SCSS), eslint (TS/JS), and prettier checks.
- `yarn lint:fix` runs auto-fix for ESLint and Prettier.
