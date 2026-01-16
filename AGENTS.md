# Development Guidelines

## Core Principles

### I. Code Quality Is Non-Negotiable

Changes must be maintainable: no new duplication, keep cognitive load flat, idiomatic TypeScript, modular routes, and GOV.UK-compliant UI. Lint, formatting, and type errors block merge; behavior changes require tests. Use existing naming patterns: match file, class, function, and route names to nearby modules; avoid new abbreviations unless already established.

### II. Tests Define Release Readiness

Every feature ships with appropriate unit tests for edge cases and error
paths, route tests for Express endpoints, automated accessibility coverage (pa11y/jest-a11y), and
smoke tests for unmocked happy paths. Tests act as living documentation for intended behavior.

### III. GOV.UK Experience Consistency

GOV.UK Design System patterns (https://design-system.service.gov.uk) are the preferred option in every flow.
Pages use GOV.UK Frontend macros, typography, spacing tokens, and colour palette;
bespoke styling is only allowed when no pattern exists. Content follows the GOV.UK style guide and
interactive states retain ≥ WCAG AA contrast.

## Active Technologies

- TypeScript on Node.js + Express 5, Nunjucks/express-nunjucks, govuk-frontend components, Plotly for charts, axios for API data fetch, Prisma for database integration.
- GOV.UK Design System using the `govuk-frontend` library; refer to https://design-system.service.gov.uk/ for official documentation and usage.

## Project Structure

```text
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
config/
```

## Key commands

- `yarn test`
- `yarn test:coverage`
- `yarn lint`
- `yarn build`
- Add dependencies with `yarn add` (or `yarn add -D` for dev deps) to ensure the latest versions are pulled in.

## Implementation Guidance

- Analytics pages live under `src/main/modules/analytics/<page>/` with `controller.ts`, `service.ts`, `page.ts`, `viewModel.ts`, and optional `visuals/` for charts/data fetchers. Purpose — `controller.ts`: HTTP entrypoint and route wiring; `service.ts`: data access orchestration; `page.ts`: async composition and fallbacks; `viewModel.ts`: shape data for templates; `visuals/`: chart builders and data fetchers.
- Register new page routes in `src/main/modules/analytics/index.ts` and keep rendering in the page controller (`res.render('analytics/<page>/index')`).
- Nunjucks templates for analytics pages live under `src/main/views/analytics/<page>/index.njk`, with per-page partials in `src/main/views/analytics/<page>/partials/` and shared filters in `src/main/views/analytics/partials/shared-filters.njk`.
- Where Nunjucks macros exist, they should be preferred over pure HTML.
- Shared analytics helpers belong in `src/main/modules/analytics/shared/` (filters, services, viewModels, charts, cache, repositories); reuse before adding new helpers.
- For AJAX section refreshes (e.g., user overview sorting), follow the established pattern: add a `data-section` wrapper around the section partial, submit `ajaxSection` with `X-Requested-With: fetch`, render the specific partial in the controller when the header/section is present, and send URL-encoded form data (including `_csrf`) so `csurf` can validate it.
- Add or update tests under `src/test/` following existing unit/functional/a11y/smoke patterns for the change. Branch and line coverage per file should be at least 95%.
- Mandatory: the final step after any change is to run `yarn lint`, `yarn test`, and `yarn build`; do not consider work complete unless all three pass.
- Any changes which impact these Development Guidelines should be accompanied with changes to the Development Guidelines.
