# Quickstart – Tasks analytics portal

## Prerequisites

- Node.js per repo baseline (upgrade path to 20.x), Yarn
- Install dependencies: `yarn install`

## Run with mock data

1. Build assets (govuk-frontend + Plotly bundles): `yarn build` (or `yarn build:prod` for production mode). This emits both `main` and `analytics` bundles.
2. Start dev server with nodemon: `yarn start:dev` (uses mock data services for analytics endpoints).
3. Open `http://localhost:3100` and navigate to `/analytics/overview`, `/analytics/outstanding`, `/analytics/completed`, `/analytics/users/{userId}`. Filters drive server-rendered pages; charts hydrate via Plotly using server-provided JSON.

## Tests (aligning to constitution)

- Lint/types/style: `yarn lint`
- Unit tests: `yarn test:unit`
- Route/contract tests: `yarn test:routes`
- Accessibility: `yarn test:a11y`
- Smoke: `yarn test:smoke`

## Notes

- All dashboards use govuk-frontend components with Chart/Data table toggles; Plotly color palette should map to GOV.UK priority colors.
- Data is mocked in backend services; swap-in real data sources later by replacing mock providers without changing templates.
- Screenshots: add Overview, Outstanding, Completed, and User overview once visuals are approved.
